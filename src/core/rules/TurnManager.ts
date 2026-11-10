/**
 * TurnManager – sistema de turnos completo 4AD
 *
 * Flujo:
 *  1. heroTurn (cada héroe vivo en marching order)
 *  2. resolution del ataque del héroe → aplica daño
 *  3. cuando no quedan héroes en la ronda → enemyTurn
 *  4. enemigos atacan automáticamente (el héroe tira Defense)
 *  5. fin de ronda → nueva ronda de héroes o ended
 *
 * Victoria: todos los enemigos a 0 life
 * Derrota: todos los héroes caídos/muertos
 */

import { resolveAttack } from './CombatResolver';
import { resolveDefense } from './DefenseCalculator';
import { resolveHeal, resolveSpell, applyAbilityEffects } from './AbilityResolver';
import {
  applyDamageToHero,
  finalizeCombatHeroes,
  releaseBodyIfCarrierDown,
} from './HeroStatus';
import type { AttackModContext } from './AttackModifiers';
import {
  getWoundsOnHit,
  tryPoisonSave,
  applyIronEaterHit,
  tryMummyConversion,
  tryBreathAttack,
  applyTrollRegenerationPass,
  isIronEater,
  isInvisibleGremlins,
  minotaurDefensePenalty,
  type MinotaurChargeTracker,
} from './SpecialRulesService';
import {
  bossLevelAfterHalfDamage,
  checkMinionMoraleAfterLoss,
  checkBossMoraleAfterDamage,
  moraleDisplayName,
} from './MoraleService';
import { getEnemyMaxLife } from '../data/enemyLookup';
import type {
  Action,
  CombatLogEntry,
  CombatState,
  EnemyInstance,
  Hero,
} from '../types/combat';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(message: string): CombatLogEntry {
  return {
    id: `log_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    message,
    timestamp: Date.now(),
  };
}

export function getAliveHeroes(heroes: Hero[]): Hero[] {
  return heroes.filter((h) => !h.isDead && !h.isFallen && h.life > 0);
}

export function getAliveEnemies(enemies: EnemyInstance[]): EnemyInstance[] {
  return enemies.filter((e) => e.currentLife > 0 && !e.fled);
}

/**
 * 4AD: enemigo con más de 1 life que queda por debajo de la mitad
 * baja 1 level (más fácil de golpear / menos peligroso).
 * Devuelve mensaje de log si bajó, o null.
 */
export function applyHalfLifeLevelDrop(enemy: EnemyInstance): string | null {
  const maxLife = getEnemyMaxLife(enemy);
  if (maxLife <= 1) return null;
  if (enemy.currentLife <= 0) return null;

  const base = enemy.baseLevel ?? enemy.level;
  const nextLevel = bossLevelAfterHalfDamage(base, maxLife, enemy.currentLife);
  if (nextLevel >= enemy.level) return null;

  enemy.level = nextLevel;
  return `${enemy.name} está herido de gravedad: level ${base} → ${nextLevel}.`;
}

function rebuildHeroTurnOrder(heroes: Hero[]): string[] {
  return getAliveHeroes(heroes).map((h) => h.id);
}

/** ¿La party supera en número al grupo enemigo vivo? */
export function isPartyOutnumbering(state: CombatState): boolean {
  return getAliveHeroes(state.heroes).length > getAliveEnemies(state.enemies).length;
}

function checkEndCondition(state: CombatState): CombatState {
  const aliveHeroes = getAliveHeroes(state.heroes);
  const aliveEnemies = getAliveEnemies(state.enemies);

  if (aliveEnemies.length === 0) {
    const ended: CombatState = {
      ...state,
      phase: 'ended',
      isFinished: true,
      result: 'victory',
      currentActorId: null,
      selectedAction: null,
      selectedTargetId: null,
      log: [...state.log, log('¡Victoria! Todos los enemigos derrotados.')],
    };
    // Caídos no curados → muertos al cerrar el combate
    return finalizeCombatHeroes(ended);
  }

  if (aliveHeroes.length === 0) {
    const ended: CombatState = {
      ...state,
      phase: 'ended',
      isFinished: true,
      result: 'defeat',
      currentActorId: null,
      selectedAction: null,
      selectedTargetId: null,
      log: [...state.log, log('Derrota... Todos los héroes han caído.')],
    };
    return finalizeCombatHeroes(ended);
  }

  return state;
}

// ---------------------------------------------------------------------------
// Aplicar daño de ataque de héroe a enemigos
// ---------------------------------------------------------------------------

/**
 * Aplica el resultado de resolveAttack al estado.
 * - Minions/vermin: elimina `damage` enemigos del mismo template (o reduce life).
 * - Boss: resta `damage` a currentLife; si llega a 0, muere.
 * - Héroes no cambian en esta función.
 */
export function applyHeroAttack(
  state: CombatState,
  targetId: string,
  damage: number,
  targetType: 'vermin' | 'minion' | 'boss' | 'weird',
  message: string,
  rng?: () => number
): CombatState {
  let enemies = state.enemies.map((e) => ({ ...e }));
  const target = enemies.find((e) => e.id === targetId);

  // Limpiar ids técnicos del mensaje de combate
  const cleanMessage = message.replace(/\b[a-z]+_(?:vermin|minion|boss|weird)_[a-z0-9_]+\b/gi, '').trim();

  if (!target || damage <= 0) {
    return {
      ...state,
      phase: 'resolution',
      log: [...state.log, log(cleanMessage || message)],
      selectedAction: null,
      selectedTargetId: null,
    };
  }

  const displayName = moraleDisplayName(target.name, target.templateId);
  const logEntries: CombatLogEntry[] = [
    log((cleanMessage || message).replace(target.name, displayName)),
  ];

  let moraleTested = [...(state.moraleTested ?? [])];
  const initialCounts = state.initialEnemyCounts ?? {};

  if (targetType === 'boss' || targetType === 'weird' || (target.maxLife ?? 1) > 1) {
    target.currentLife = Math.max(0, target.currentLife - damage);
    const dropMsg = applyHalfLifeLevelDrop(target);
    if (dropMsg) {
      logEntries.push(log(dropMsg.replace(target.name, displayName)));
    }

    // Moral de boss / weird (una vez por template)
    if (target.currentLife > 0) {
      const maxLife = getEnemyMaxLife(target);
      const already = moraleTested.includes(target.templateId);
      const morale = checkBossMoraleAfterDamage(
        target.templateId,
        displayName,
        maxLife,
        target.currentLife,
        already,
        rng
      );
      if (morale.message) logEntries.push(log(morale.message));
      if (morale.tested) {
        moraleTested.push(target.templateId);
        if (morale.fled) {
          target.fled = true;
          target.currentLife = 0;
          logEntries.push(log(`${displayName} huye del combate.`));
        }
      }
    }
  } else {
    // Vermin / minion 1 life
    let remaining = damage;
    const sameGroup = enemies.filter(
      (e) => e.templateId === target.templateId && e.currentLife > 0 && !e.fled
    );
    for (const e of sameGroup) {
      if (remaining <= 0) break;
      e.currentLife = 0;
      remaining--;
    }

    const initial = initialCounts[target.templateId] ?? sameGroup.length + damage;
    const aliveNow = enemies.filter(
      (e) => e.templateId === target.templateId && e.currentLife > 0 && !e.fled
    ).length;
    const already = moraleTested.includes(target.templateId);
    const morale = checkMinionMoraleAfterLoss(
      target.templateId,
      displayName,
      initial,
      aliveNow,
      already,
      rng
    );
    if (morale.message) logEntries.push(log(morale.message));
    if (morale.tested) {
      moraleTested.push(target.templateId);
      if (morale.fled) {
        for (const e of enemies) {
          if (e.templateId === target.templateId && e.currentLife > 0) {
            e.fled = true;
            e.currentLife = 0;
          }
        }
        logEntries.push(log(`Los ${displayName} restantes huyen.`));
      }
    }
  }

  let next: CombatState = {
    ...state,
    enemies,
    phase: 'resolution',
    log: [...state.log, ...logEntries],
    selectedAction: null,
    selectedTargetId: null,
    moraleTested,
    initialEnemyCounts: initialCounts,
  };

  return checkEndCondition(next);
}

export function advanceAfterHeroAction(state: CombatState): CombatState {
  if (state.isFinished) return state;

  const order = state.heroTurnOrder;
  const nextIndex = state.heroTurnIndex + 1;

  if (nextIndex < order.length) {
    // Siguiente héroe vivo en la ronda
    const nextId = order[nextIndex];
    const hero = state.heroes.find((h) => h.id === nextId);
    // Si el héroe murió en medio (no debería en su propio turno), saltar
    if (!hero || hero.isFallen || hero.isDead || hero.life <= 0) {
      return advanceAfterHeroAction({
        ...state,
        heroTurnIndex: nextIndex,
        currentActorId: nextId,
      });
    }

    return {
      ...state,
      phase: 'heroTurn',
      heroTurnIndex: nextIndex,
      currentActorId: nextId,
      selectedAction: null,
      selectedTargetId: null,
      log: [...state.log, log(`Turno de ${hero.name}`)],
    };
  }

  // Fin de turnos de héroes → turno enemigo
  return {
    ...state,
    phase: 'enemyTurn',
    currentActorId: null,
    selectedAction: null,
    selectedTargetId: null,
    log: [...state.log, log('— Turno de los enemigos —')],
  };
}

// ---------------------------------------------------------------------------
// Resolver ataque de un héroe (orquesta resolveAttack + apply + advance)
// ---------------------------------------------------------------------------

export function executeHeroAttack(
  state: CombatState,
  targetType: 'vermin' | 'minion' | 'boss' | 'weird',
  ctx: AttackModContext = {},
  rng?: () => number
): CombatState {
  if (state.phase !== 'heroTurn' && state.phase !== 'resolution') {
    return state;
  }
  if (!state.selectedAction || !state.selectedTargetId) return state;

  const actor = state.heroes.find((h) => h.id === state.currentActorId);
  const target = state.enemies.find((e) => e.id === state.selectedTargetId);
  if (!actor || !target) return state;

  const fullCtx: AttackModContext = {
    ...ctx,
    enemiesOutnumbered: ctx.enemiesOutnumbered ?? isPartyOutnumbering(state),
  };

  const result = resolveAttack({
    actor,
    target,
    targetType,
    context: fullCtx,
    rng,
  });

  let next = applyHeroAttack(
    state,
    target.id,
    result.damage,
    targetType,
    result.message
  );

  if (next.isFinished) return next;

  // Avanzar al siguiente actor
  return advanceAfterHeroAction(next);
}

// ---------------------------------------------------------------------------
// Turno de enemigos: atacan automáticamente
// ---------------------------------------------------------------------------

/**
 * Quién recibe el ataque (reglas 4AD simplificadas para room):
 * - Si hay tantos o más enemigos que héroes: 1 ataque por héroe (+ extras al azar)
 * - Si hay menos enemigos: cada enemigo ataca a un héroe distinto (jugador elige → aquí al primero vivo)
 * MVP: cada enemigo vivo realiza `attacks` ataques contra héroes vivos en orden de marcha (front first).
 */
export function runEnemyTurn(
  state: CombatState,
  opts: {
    inCorridor?: boolean;
    rng?: () => number;
    /** Ids de trolls muertos por hechizo (no regeneran) */
    killedBySpellIds?: Set<string>;
    /** Ids de trolls descuartizados */
    choppedIds?: Set<string>;
    /** Tracker de cargo del minotauro (primera defensa -1) */
    minotaurTracker?: MinotaurChargeTracker;
  } = {}
): CombatState {
  if (state.phase !== 'enemyTurn' || state.isFinished) return state;

  let heroes = state.heroes.map((h) => ({ ...h }));
  let enemies = state.enemies.map((e) => ({ ...e }));
  let logEntries = [...state.log];
  const rng = opts.rng;
  const minotaurTracker: MinotaurChargeTracker = opts.minotaurTracker ?? new Set();

  // Regeneración de trolls al inicio del turno enemigo
  const regen = applyTrollRegenerationPass(enemies, {
    killedBySpellIds: opts.killedBySpellIds,
    choppedIds: opts.choppedIds,
    rng,
  });
  enemies = regen.enemies;
  for (const m of regen.log) logEntries.push(log(m));

  const aliveEnemies = getAliveEnemies(enemies);

  // Gremlins invisibles: no combaten
  if (aliveEnemies.length > 0 && aliveEnemies.every(isInvisibleGremlins)) {
    return {
      ...state,
      heroes,
      enemies,
      phase: 'ended',
      isFinished: true,
      result: 'victory',
      log: [...logEntries, log('Invisible Gremlins: no hay combate (sin XP).')],
    };
  }

  const marchOrder = [
    ...state.positions.front,
    ...state.positions.rear.filter((id) => !state.positions.front.includes(id)),
  ];
  const targetOrder =
    marchOrder.length > 0 ? marchOrder : heroes.map((h) => h.id);

  let targetCursor = 0;

  for (const enemy of aliveEnemies) {
    if (isInvisibleGremlins(enemy)) continue;

    // Aliento de quimera / dragón puede sustituir los ataques
    const breath = tryBreathAttack(enemy, heroes, rng);
    if (breath.log.length) {
      for (const m of breath.log) logEntries.push(log(m));
    }
    if (breath.usedBreath) {
      heroes = breath.heroes;
      heroes = releaseBodyIfCarrierDown(heroes);
      continue;
    }
    if (breath.heroes !== heroes) {
      heroes = breath.heroes;
    }

    const attackCount = Math.max(1, enemy.attacks ?? 1);

    for (let a = 0; a < attackCount; a++) {
      let target: Hero | undefined;
      for (let t = 0; t < targetOrder.length; t++) {
        const idx = (targetCursor + t) % targetOrder.length;
        const candidate = heroes.find(
          (h) => h.id === targetOrder[idx] && !h.isDead && !h.isFallen && h.life > 0
        );
        if (candidate) {
          target = candidate;
          targetCursor = (idx + 1) % targetOrder.length;
          break;
        }
      }
      if (!target) break;

      const woundsOnHit = getWoundsOnHit(enemy);
      const chargePenalty = minotaurDefensePenalty(enemy, minotaurTracker);

      // Iron Eater: armadura pesada no cuenta (shield y light sí)
      const heavyOnly =
        isIronEater(enemy) &&
        !!(
          target.equipment?.armor &&
          (target.equipment.armor.tags?.includes('heavy') ||
            target.equipment.armor.id === 'heavy_armor')
        );

      const defResult = resolveDefense(
        target,
        enemy.level,
        {
          surpriseAttack: false,
          ignoresArmor: heavyOnly,
          attackerName: enemy.name,
          attackerTemplateId: enemy.templateId,
          extra: chargePenalty,
          rng,
        },
        Math.max(1, woundsOnHit || 1)
      );

      // Ajuste mensaje minotauro
      if (chargePenalty < 0) {
        logEntries.push(log(`Cargo del Minotauro: primera defensa de ${target.name} a -1.`));
      }

      logEntries.push(log(`${enemy.name} ataca a ${target.name}: ${defResult.message}`));

      if (!defResult.success) {
        const heroIdx = heroes.findIndex((h) => h.id === target!.id);

        if (isIronEater(enemy)) {
          const stolen = applyIronEaterHit(heroes[heroIdx], rng);
          heroes[heroIdx] = stolen.hero;
          logEntries.push(log(stolen.message));
        } else {
          let damaged = applyDamageToHero(heroes[heroIdx], defResult.damageTaken);
          if (damaged.isFallen && !heroes[heroIdx].isFallen) {
            logEntries.push(log(`${damaged.name} ha caído (0 life).`));
            // Conversión momia
            const conv = tryMummyConversion(heroes, enemies, damaged.id, enemy);
            if (conv.log.length) {
              heroes = conv.heroes;
              enemies = conv.enemies;
              for (const m of conv.log) logEntries.push(log(m));
            } else {
              heroes[heroIdx] = damaged;
            }
          } else {
            // Veneno
            const poison = tryPoisonSave(damaged, enemy, rng);
            if (poison.message) logEntries.push(log(poison.message));
            heroes[heroIdx] = poison.hero;
            if (poison.hero.isFallen && !damaged.isFallen) {
              logEntries.push(log(`${poison.hero.name} ha caído por el veneno.`));
            }
          }
        }
      }
      heroes = releaseBodyIfCarrierDown(heroes);
    }
  }

  let next: CombatState = {
    ...state,
    heroes,
    enemies,
    log: logEntries,
  };

  next = checkEndCondition(next);
  if (next.isFinished) return next;

  const newOrder = rebuildHeroTurnOrder(next.heroes);
  if (newOrder.length === 0) {
    return checkEndCondition(next);
  }

  return {
    ...next,
    phase: 'heroTurn',
    round: state.round + 1,
    heroTurnOrder: newOrder,
    heroTurnIndex: 0,
    currentActorId: newOrder[0],
    selectedAction: null,
    selectedTargetId: null,
    log: [
      ...next.log,
      log(
        `— Ronda ${state.round + 1} — Turno de ${next.heroes.find((h) => h.id === newOrder[0])?.name}`
      ),
    ],
  };
}


export function resolveCurrentHeroAction(
  state: CombatState,
  targetType: 'vermin' | 'minion' | 'boss' | 'weird',
  rng?: () => number
): CombatState {
  if (!state.selectedAction) return state;

  const actionType = state.selectedAction.type;

  if (actionType === 'attack') {
    return executeHeroAttack(state, targetType, {}, rng);
  }

  if (actionType === 'heal') {
    return executeHeal(state, rng);
  }

  if (actionType === 'spell') {
    return executeSpell(state, targetType, rng);
  }

  // Defend u otras acciones: consumen el turno
  const next = {
    ...state,
    log: [
      ...state.log,
      log(`${state.heroes.find((h) => h.id === state.currentActorId)?.name} se defiende.`),
    ],
    selectedAction: null,
    selectedTargetId: null,
    phase: 'resolution' as const,
  };
  return advanceAfterHeroAction(next);
}

// ---------------------------------------------------------------------------
// Curación y hechizos
// ---------------------------------------------------------------------------

export function executeHeal(state: CombatState, rng?: () => number): CombatState {
  const cleric = state.heroes.find((h) => h.id === state.currentActorId);
  if (!cleric) return state;

  const targetId = state.selectedTargetId ?? cleric.id;
  const target = state.heroes.find((h) => h.id === targetId) ?? cleric;

  const result = resolveHeal(cleric, target, rng);
  const applied = applyAbilityEffects(state.heroes, state.enemies, result.effects);

  let next: CombatState = {
    ...state,
    heroes: applied.heroes,
    enemies: applied.enemies,
    log: [...state.log, log(result.message)],
    selectedAction: null,
    selectedTargetId: null,
    phase: 'resolution',
  };

  next = checkEndCondition(next);
  if (next.isFinished) return next;
  return advanceAfterHeroAction(next);
}

export function executeSpell(
  state: CombatState,
  targetType: 'vermin' | 'minion' | 'boss' | 'weird',
  rng?: () => number
): CombatState {
  const caster = state.heroes.find((h) => h.id === state.currentActorId);
  if (!caster || !state.selectedAction) return state;

  // El nombre del hechizo va en action.name (ej. "Fireball")
  const spellName = state.selectedAction.name;
  const targetEnemy = state.enemies.find((e) => e.id === state.selectedTargetId);
  const targetHero = state.heroes.find((h) => h.id === state.selectedTargetId);

  const result = resolveSpell(caster, spellName, {
    targetEnemy,
    targetHero,
    enemies: state.enemies,
    targetType,
    rng,
  });

  const applied = applyAbilityEffects(state.heroes, state.enemies, result.effects);

  let next: CombatState = {
    ...state,
    heroes: applied.heroes,
    enemies: applied.enemies,
    log: [...state.log, log(result.message)],
    selectedAction: null,
    selectedTargetId: null,
    phase: 'resolution',
  };

  next = checkEndCondition(next);
  if (next.isFinished) return next;
  return advanceAfterHeroAction(next);
}
