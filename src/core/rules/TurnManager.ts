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
  scavengeFallenInventory,
  pickUpBody,
  moveCarrierToRear,
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
import { getEnemyMaxLife, getEnemyTemplate } from '../data/enemyLookup';
import {
  ensureHeroInventory,
  equipWeapon,
} from './InventoryService';
import type {
  Action,
  CombatLogEntry,
  CombatState,
  EnemyInstance,
  Hero,
} from '../types/combat';

export type EnemyActionBeat = {
  actorId: string;
  targetId: string | null;
  actorName: string;
  actionName: string;
  amount: number;
  kind: 'damage' | 'miss' | 'info';
  message: string;
};


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

  const location = state.location ?? 'room';
  const inCorridor = location === 'corridor';
  const inRoom = location === 'room';
  const frontIds = state.positions?.front ?? [];
  const rearIds = state.positions?.rear ?? [];
  const attackerInFront = frontIds.includes(actor.id);
  const attackerInRear =
    rearIds.includes(actor.id) || (!attackerInFront && rearIds.length > 0);

  const fullCtx: AttackModContext = {
    ...ctx,
    enemiesOutnumbered: ctx.enemiesOutnumbered ?? isPartyOutnumbering(state),
    inCorridor: ctx.inCorridor ?? inCorridor,
    inRoom: ctx.inRoom ?? inRoom,
    attackerInFront: ctx.attackerInFront ?? attackerInFront,
    attackerInRear: ctx.attackerInRear ?? attackerInRear,
    // Sala: solo ronda 1 permite arco/honda
    roomRangedAllowed:
      ctx.roomRangedAllowed ?? (inRoom ? state.round <= 1 : undefined),
    isSurpriseRound: ctx.isSurpriseRound ?? (inRoom && state.round <= 1),
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
 * Asignación de objetivos según 4AD (sala):
 *
 * Minions / vermin (grupo):
 *  - menos monstruos que héroes → cada monstruo ataca a un héroe distinto
 *    (los que sobran no reciben ataque; preferencia: no front / menos tank)
 *  - igual número → 1 ataque por héroe
 *  - más monstruos → reparto equitativo; extras al front / más tank
 *
 * Boss / weird / final (criatura única con N ataques):
 *  - cada ataque elige un héroe al azar entre los vivos
 *  - si hay varios héroes se intenta no repetir hasta agotar el pool
 *    (p. ej. dragón: 2 ataques a 2 personajes aleatorios)
 *
 * Devuelve lista ordenada (enemyId, attackIndex, heroId) para el turno.
 */
export type EnemyAttackAssignment = {
  enemyId: string;
  attackIndex: number;
  heroId: string;
};

function enemyKind(
  enemy: EnemyInstance,
): 'vermin' | 'minion' | 'boss' | 'weird' {
  const t = getEnemyTemplate(enemy.templateId);
  if (t?.type) return t.type;
  if (enemy.isFinalBoss) return 'boss';
  if ((enemy.maxLife ?? enemy.currentLife) > 1) return 'boss';
  return 'minion';
}

function isMajorEnemy(enemy: EnemyInstance): boolean {
  const k = enemyKind(enemy);
  return k === 'boss' || k === 'weird' || !!enemy.isFinalBoss;
}

/** Preferencia “jugador elige”: front rank y más vida máxima primero (tanks). */
function sortHeroesForExtraHits(
  heroes: Hero[],
  frontIds: string[],
): Hero[] {
  return [...heroes].sort((a, b) => {
    const af = frontIds.includes(a.id) ? 0 : 1;
    const bf = frontIds.includes(b.id) ? 0 : 1;
    if (af !== bf) return af - bf;
    return (b.maxLife ?? b.life) - (a.maxLife ?? a.life);
  });
}

/** Preferencia para quién NO recibe ataque cuando sobran héroes: rear / menos tank. */
function sortHeroesToSkip(
  heroes: Hero[],
  frontIds: string[],
): Hero[] {
  return [...heroes].sort((a, b) => {
    const af = frontIds.includes(a.id) ? 1 : 0;
    const bf = frontIds.includes(b.id) ? 1 : 0;
    if (af !== bf) return af - bf; // rear primero
    return (a.maxLife ?? a.life) - (b.maxLife ?? b.life);
  });
}

function pickRandomHero(
  heroes: Hero[],
  rng?: () => number,
  excludeIds?: Set<string>,
): Hero | undefined {
  const pool = excludeIds?.size
    ? heroes.filter((h) => !excludeIds.has(h.id))
    : heroes;
  const use = pool.length > 0 ? pool : heroes;
  if (use.length === 0) return undefined;
  const r = rng ? rng() : Math.random();
  const idx = Math.min(use.length - 1, Math.floor(r * use.length));
  return use[idx];
}

/**
 * Construye la lista de ataques del turno enemigo con objetivos ya repartidos.
 * `eligibleHeroes` debe ser solo héroes vivos (y filtrados por emboscada si aplica).
 */
export function assignEnemyAttackTargets(
  enemies: EnemyInstance[],
  eligibleHeroes: Hero[],
  opts: {
    frontIds?: string[];
    rng?: () => number;
  } = {},
): EnemyAttackAssignment[] {
  const alive = enemies.filter(
    (e) => e.currentLife > 0 && !e.fled && !isInvisibleGremlins(e),
  );
  const heroes = eligibleHeroes.filter(
    (h) => !h.isDead && !h.isFallen && h.life > 0,
  );
  if (alive.length === 0 || heroes.length === 0) return [];

  const frontIds = opts.frontIds ?? [];
  const rng = opts.rng;
  const out: EnemyAttackAssignment[] = [];

  const majors = alive.filter(isMajorEnemy);
  const minors = alive.filter((e) => !isMajorEnemy(e));

  // --- Boss / weird / final: ataques al azar ---
  for (const enemy of majors) {
    const n = Math.max(1, enemy.attacks ?? 1);
    const used = new Set<string>();
    for (let a = 0; a < n; a++) {
      // Preferir héroes aún no elegidos este turno de esta criatura
      let target = pickRandomHero(heroes, rng, used);
      if (!target) target = pickRandomHero(heroes, rng);
      if (!target) break;
      used.add(target.id);
      // Si ya se usaron todos, reiniciar pool para ataques restantes
      if (used.size >= heroes.length) used.clear();
      out.push({ enemyId: enemy.id, attackIndex: a, heroId: target.id });
    }
  }

  // --- Minions / vermin: reparto por número de ataques totales ---
  if (minors.length > 0) {
    // Cada minion aporta `attacks` slots (casi siempre 1)
    const slots: { enemyId: string; attackIndex: number }[] = [];
    for (const e of minors) {
      const n = Math.max(1, e.attacks ?? 1);
      for (let a = 0; a < n; a++) {
        slots.push({ enemyId: e.id, attackIndex: a });
      }
    }

    const nM = slots.length;
    const nH = heroes.length;

    // Orden de héroes para asignar extras / skips
    const preferHit = sortHeroesForExtraHits(heroes, frontIds);
    const preferSkip = sortHeroesToSkip(heroes, frontIds);

    if (nM <= nH) {
      // Cada monstruo (slot) a un héroe distinto; sobran héroes sin ataque
      const targets = preferHit.slice(0, nM);
      for (let i = 0; i < slots.length; i++) {
        out.push({
          enemyId: slots[i].enemyId,
          attackIndex: slots[i].attackIndex,
          heroId: targets[i].id,
        });
      }
    } else {
      // Más ataques que héroes: base + extras
      const base = Math.floor(nM / nH);
      let extra = nM % nH;
      // Cola de heroIds: base veces cada uno (orden preferHit), luego extras
      const queue: string[] = [];
      for (const h of preferHit) {
        for (let i = 0; i < base; i++) queue.push(h.id);
      }
      for (const h of preferHit) {
        if (extra <= 0) break;
        queue.push(h.id);
        extra--;
      }
      // Asignar slots en orden de monstruos
      for (let i = 0; i < slots.length; i++) {
        out.push({
          enemyId: slots[i].enemyId,
          attackIndex: slots[i].attackIndex,
          heroId: queue[i] ?? preferHit[i % preferHit.length].id,
        });
      }
    }

    // preferSkip no se usa en la lista final (solo documenta la regla de “quién se salva”);
    // al coger preferHit.slice(0, nM) los de preferSkip quedan fuera automáticamente.
    void preferSkip;
  }

  return out;
}

/**
 * Turno de enemigos: atacan automáticamente con objetivos repartidos (4AD).
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
  const beats: EnemyActionBeat[] = [];
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
  // Emboscada o pasillo: solo el frente (posiciones 1–2) recibe ataques cuerpo a cuerpo
  const restrictToFront =
    !!state.ambushFrontOnly || state.location === 'corridor';
  const frontOnly = restrictToFront
    ? state.positions.front.length
      ? state.positions.front.slice(0, 2)
      : marchOrder.slice(0, 2)
    : null;
  const targetOrder =
    frontOnly && frontOnly.length > 0
      ? frontOnly
      : marchOrder.length > 0
        ? marchOrder
        : heroes.map((h) => h.id);

  if (state.ambushFrontOnly) {
    logEntries.push(
      log('Emboscada: los enemigos solo atacan a los 2 primeros del orden de marcha.'),
    );
  } else if (state.location === 'corridor') {
    logEntries.push(
      log('Pasillo: los enemigos solo pueden alcanzar al frente de marcha (1–2).'),
    );
  }

  // Héroes elegibles (orden de marcha / emboscada)
  const eligibleHeroes = targetOrder
    .map((id) => heroes.find((h) => h.id === id))
    .filter((h): h is Hero => !!h && !h.isDead && !h.isFallen && h.life > 0);

  // Aliento de quimera/dragón puede sustituir ataques de ese enemigo
  const skippedEnemyIds = new Set<string>();
  for (const enemy of aliveEnemies) {
    if (isInvisibleGremlins(enemy)) {
      skippedEnemyIds.add(enemy.id);
      continue;
    }
    const breath = tryBreathAttack(enemy, heroes, rng);
    if (breath.log.length) {
      for (const m of breath.log) logEntries.push(log(m));
    }
    if (breath.usedBreath) {
      heroes = breath.heroes;
      heroes = releaseBodyIfCarrierDown(heroes);
      skippedEnemyIds.add(enemy.id);
      continue;
    }
    if (breath.heroes !== heroes) {
      heroes = breath.heroes;
    }
  }

  // Recomputar elegibles tras aliento (puede haber caídos)
  const eligibleAfterBreath = targetOrder
    .map((id) => heroes.find((h) => h.id === id))
    .filter((h): h is Hero => !!h && !h.isDead && !h.isFallen && h.life > 0);

  const attackers = aliveEnemies.filter((e) => !skippedEnemyIds.has(e.id));
  const frontIds = state.positions.front ?? [];
  const assignments = assignEnemyAttackTargets(attackers, eligibleAfterBreath, {
    frontIds,
    rng,
  });

  // Ejecutar cada ataque asignado (en orden de monstruos)
  for (const asg of assignments) {
    const enemy = enemies.find((e) => e.id === asg.enemyId);
    if (!enemy || enemy.currentLife <= 0 || enemy.fled) continue;

    const target = heroes.find(
      (h) => h.id === asg.heroId && !h.isDead && !h.isFallen && h.life > 0,
    );
    // Si el objetivo cayó por un ataque anterior, reasignar a otro vivo
    const resolvedTarget =
      target ??
      eligibleAfterBreath.find(
        (h) =>
          !h.isDead &&
          !h.isFallen &&
          h.life > 0 &&
          heroes.some((x) => x.id === h.id && x.life > 0 && !x.isFallen && !x.isDead),
      ) ??
      heroes.find((h) => !h.isDead && !h.isFallen && h.life > 0);

    if (!resolvedTarget) break;

    // Refrescar referencia al héroe actual en el array mutable
    const liveTarget =
      heroes.find((h) => h.id === resolvedTarget.id && !h.isDead && !h.isFallen && h.life > 0) ??
      resolvedTarget;

    const woundsOnHit = getWoundsOnHit(enemy);
    const chargePenalty = minotaurDefensePenalty(enemy, minotaurTracker);

    const heavyOnly =
      isIronEater(enemy) &&
      !!(
        liveTarget.equipment?.armor &&
        (liveTarget.equipment.armor.tags?.includes('heavy') ||
          liveTarget.equipment.armor.id === 'heavy_armor')
      );

    const defResult = resolveDefense(
      liveTarget,
      enemy.level,
      {
        surpriseAttack: false,
        ignoresArmor: heavyOnly,
        attackerName: enemy.name,
        attackerTemplateId: enemy.templateId,
        extra: chargePenalty,
        rng,
      },
      Math.max(1, woundsOnHit || 1),
    );

    if (chargePenalty < 0) {
      logEntries.push(
        log(`Cargo del Minotauro: primera defensa de ${liveTarget.name} a -1.`),
      );
    }

    logEntries.push(
      log(`${enemy.name} ataca a ${liveTarget.name}: ${defResult.message}`),
    );
    beats.push({
      actorId: enemy.id,
      targetId: liveTarget.id,
      actorName: enemy.name,
      actionName: 'Attack',
      amount: defResult.success ? 0 : defResult.damageTaken,
      kind: defResult.success ? 'miss' : 'damage',
      message: defResult.message,
    });

    if (!defResult.success) {
      const heroIdx = heroes.findIndex((h) => h.id === liveTarget.id);
      if (heroIdx < 0) continue;

      if (isIronEater(enemy)) {
        const stolen = applyIronEaterHit(heroes[heroIdx], rng);
        heroes[heroIdx] = stolen.hero;
        logEntries.push(log(stolen.message));
      } else {
        let damaged = applyDamageToHero(heroes[heroIdx], defResult.damageTaken);
        if (damaged.isFallen && !heroes[heroIdx].isFallen) {
          logEntries.push(log(`${damaged.name} ha caído (0 life).`));
          const conv = tryMummyConversion(heroes, enemies, damaged.id, enemy);
          if (conv.log.length) {
            heroes = conv.heroes;
            enemies = conv.enemies;
            for (const m of conv.log) logEntries.push(log(m));
          } else {
            heroes[heroIdx] = damaged;
          }
        } else {
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

  let next: CombatState = {
    ...state,
    heroes,
    enemies,
    log: logEntries,
    enemyBeats: beats,
  };

  next = checkEndCondition(next);
  if (next.isFinished) return { ...next, enemyBeats: beats };

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

  if (actionType === 'switch_weapon') {
    return executeSwitchWeapon(state);
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

/**
 * 4AD: cambiar de arma gasta el turno (no se ataca).
 * Cicla a la siguiente arma del inventario o usa selectedTargetId como instanceId.
 */
export function executeSwitchWeapon(state: CombatState): CombatState {
  const actor = state.heroes.find((h) => h.id === state.currentActorId);
  if (!actor) return state;

  const h = ensureHeroInventory(actor);
  const weapons = h.inventory.weapons;
  if (weapons.length < 2) {
    const next: CombatState = {
      ...state,
      log: [
        ...state.log,
        log(`${actor.name} no tiene otra arma que empuñar.`),
      ],
      selectedAction: null,
      selectedTargetId: null,
    };
    return advanceAfterHeroAction(next);
  }

  const preferred = state.selectedTargetId;
  let nextId =
    preferred && weapons.some((w) => w.instanceId === preferred)
      ? preferred
      : null;
  if (!nextId) {
    const cur = h.inventory.defaultWeaponInstanceId;
    const idx = Math.max(
      0,
      weapons.findIndex((w) => w.instanceId === cur),
    );
    nextId = weapons[(idx + 1) % weapons.length].instanceId;
  }

  const result = equipWeapon(h, nextId);
  const heroes = state.heroes.map((x) =>
    x.id === actor.id ? result.hero : x,
  );
  const next: CombatState = {
    ...state,
    heroes,
    log: [...state.log, log(result.message)],
    selectedAction: null,
    selectedTargetId: null,
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


/**
 * Registrar inventario de un compañero caído: cuesta el turno del héroe activo.
 */
export function executeScavengeFallen(
  state: CombatState,
  fallenId: string,
): CombatState {
  if (state.phase !== 'heroTurn' || state.isFinished) return state;
  const actorId = state.currentActorId;
  if (!actorId) return state;

  const result = scavengeFallenInventory(state.heroes, actorId, fallenId);
  if (!result.ok) {
    return {
      ...state,
      log: [...state.log, log(result.message)],
    };
  }

  let next: CombatState = {
    ...state,
    heroes: result.heroes,
    scavengedItems: [...(state.scavengedItems ?? []), ...result.looted],
    log: [...state.log, log(result.message)],
    selectedAction: null,
    selectedTargetId: null,
  };

  // Gasta el turno
  return advanceAfterHeroAction(next);
}

/**
 * Cargar cuerpo de compañero caído/muerto: portador a última posición de marcha.
 */
export function executePickUpBody(
  state: CombatState,
  bodyId: string,
): CombatState {
  if (state.phase !== 'heroTurn' || state.isFinished) return state;
  const actorId = state.currentActorId;
  if (!actorId) return state;

  const result = pickUpBody(state.heroes, actorId, bodyId);
  if (!result.ok) {
    return { ...state, log: [...state.log, log(result.message)] };
  }

  const positions = moveCarrierToRear(state.positions, actorId);
  let next: CombatState = {
    ...state,
    heroes: result.heroes,
    positions,
    log: [
      ...state.log,
      log(result.message),
      log(`${state.heroes.find((h) => h.id === actorId)?.name} pasa a la retaguardia (carga un cuerpo).`),
    ],
    selectedAction: null,
    selectedTargetId: null,
  };
  return advanceAfterHeroAction(next);
}
