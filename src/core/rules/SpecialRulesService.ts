/**
 * Reglas especiales de monstruos prioritarios – 4AD / GDD Día 23
 *
 * - Ogre: 2 heridas por golpe
 * - Mummy: conversión al matar héroe
 * - Troll: regeneración (delega en TrollRegeneration)
 * - Medusa / Catoblepas: mirada al inicio
 * - Giant Spider / Fungi: veneno al herir
 * - Iron Eater: no heavy armor en defensa; roba equipo en lugar de daño
 * - Minotaur: primera defensa a -1
 * - Chimera / Small Dragon: aliento en lugar de ataques
 */

import { rollD6, rollDice } from './DiceService';
import { tryTrollRegeneration, isTroll } from './TrollRegeneration';
import { applyDamageToHero } from './HeroStatus';
import type { CombatState, EnemyInstance, Hero, Item } from '../types/combat';
import type { EquipmentSlot } from '../data/items';

// ---------------------------------------------------------------------------
// Helpers de perfil
// ---------------------------------------------------------------------------

export function isMummy(enemy: EnemyInstance): boolean {
  return enemy.templateId === 'boss_mummy' || /mummy/i.test(enemy.name);
}

export function isOgre(enemy: EnemyInstance): boolean {
  return enemy.templateId === 'boss_ogre' || /^ogre$/i.test(enemy.name);
}

export function isMedusa(enemy: EnemyInstance): boolean {
  return enemy.templateId === 'boss_medusa' || /medusa/i.test(enemy.name);
}

export function isCatoblepas(enemy: EnemyInstance): boolean {
  return enemy.templateId === 'weird_catoblepas' || /catoblepas/i.test(enemy.name);
}

export function isIronEater(enemy: EnemyInstance): boolean {
  return enemy.templateId === 'weird_iron_eater' || /iron eater/i.test(enemy.name);
}

export function isMinotaur(enemy: EnemyInstance): boolean {
  return enemy.templateId === 'weird_minotaur' || /minotaur/i.test(enemy.name);
}

export function isChimera(enemy: EnemyInstance): boolean {
  return enemy.templateId === 'weird_chimera' || /chimera/i.test(enemy.name);
}

export function isSmallDragon(enemy: EnemyInstance): boolean {
  return enemy.templateId === 'boss_small_dragon' || /dragon/i.test(enemy.name);
}

export function isGiantSpider(enemy: EnemyInstance): boolean {
  return enemy.templateId === 'weird_giant_spider' || /spider/i.test(enemy.name);
}

export function isFungiFolk(enemy: EnemyInstance): boolean {
  return enemy.templateId === 'minion_fungi_folk' || /fungi/i.test(enemy.name);
}

export function isInvisibleGremlins(enemy: EnemyInstance): boolean {
  return (
    enemy.templateId === 'weird_invisible_gremlins' || /gremlin/i.test(enemy.name)
  );
}

/** Heridas que inflige un golpe si la defensa falla */
export function getWoundsOnHit(enemy: EnemyInstance): number {
  if (isOgre(enemy)) return 2;
  if (isIronEater(enemy)) return 0; // no daño: roba equipo
  return 1;
}

/** ¿La defensa ignora armadura pesada? (Iron Eater) */
export function defenseIgnoresHeavyArmor(enemy: EnemyInstance): boolean {
  return isIronEater(enemy);
}

// ---------------------------------------------------------------------------
// Miradas al inicio del combate (Medusa, Catoblepas)
// ---------------------------------------------------------------------------

export type OpeningEffectResult = {
  heroes: Hero[];
  log: string[];
};

/**
 * Aplica efectos de apertura del encuentro (miradas).
 * Medusa: save vs level 4 o petrificado (status + caído a efectos de combate).
 * Catoblepas: save vs level 4 o −1 life.
 * Rogue añade ½ nivel a saves de mirada (Medusa).
 */
export function applyOpeningMonsterEffects(
  heroes: Hero[],
  enemies: EnemyInstance[],
  rng: () => number = Math.random
): OpeningEffectResult {
  let next = heroes.map((h) => ({ ...h }));
  const log: string[] = [];

  const hasMedusa = enemies.some(isMedusa);
  const hasCatoblepas = enemies.some(isCatoblepas);

  if (hasMedusa) {
    for (let i = 0; i < next.length; i++) {
      const h = next[i];
      if (h.isDead || h.isFallen || h.life <= 0) continue;
      const halfLevel = Math.floor(h.level / 2);
      const rogueBonus = h.class === 'rogue' ? halfLevel : 0;
      const roll = rollD6(rng);
      const total = roll + rogueBonus;
      if (total < 4) {
        next[i] = {
          ...h,
          status: [...(h.status ?? []), { id: 'petrified', name: 'Petrified' }],
          isFallen: true,
          life: 0,
        };
        log.push(
          `${h.name} falla la mirada de la Medusa (${total} vs 4) y queda petrificado.`
        );
      } else {
        log.push(`${h.name} resiste la mirada de la Medusa (${total} vs 4).`);
      }
    }
  }

  if (hasCatoblepas) {
    for (let i = 0; i < next.length; i++) {
      const h = next[i];
      if (h.isDead || h.isFallen || h.life <= 0) continue;
      const roll = rollD6(rng);
      if (roll < 4) {
        next[i] = applyDamageToHero(next[i], 1);
        log.push(
          `${h.name} falla la mirada del Catoblepas (${roll} vs 4) y pierde 1 life.`
        );
      } else {
        log.push(`${h.name} resiste la mirada del Catoblepas (${roll} vs 4).`);
      }
    }
  }

  return { heroes: next, log };
}

// ---------------------------------------------------------------------------
// Veneno al herir (Spider, Fungi Folk)
// ---------------------------------------------------------------------------

export function tryPoisonSave(
  hero: Hero,
  enemy: EnemyInstance,
  rng: () => number = Math.random
): { hero: Hero; message: string | null } {
  const needPoison = isGiantSpider(enemy) || isFungiFolk(enemy);
  if (!needPoison) return { hero, message: null };

  const poisonLevel = 3;
  const roll = rollD6(rng);
  // Halfling +level en save vs poison (fungi); no hay halfling en MVP clases
  if (roll < poisonLevel) {
    const damaged = applyDamageToHero(hero, 1);
    return {
      hero: damaged,
      message: `${hero.name} falla save vs veneno (${roll} vs ${poisonLevel}) y pierde 1 life extra.`,
    };
  }
  return {
    hero,
    message: `${hero.name} resiste el veneno (${roll} vs ${poisonLevel}).`,
  };
}

// ---------------------------------------------------------------------------
// Iron Eater: roba equipo en lugar de daño
// ---------------------------------------------------------------------------

const STEAL_ORDER: EquipmentSlot[] = ['armor', 'shield', 'mainHand', 'offHand'];

export function applyIronEaterHit(
  hero: Hero,
  rng: () => number = Math.random
): { hero: Hero; message: string } {
  const equipment = { ...hero.equipment };

  for (const slot of STEAL_ORDER) {
    if (equipment[slot]) {
      const item = equipment[slot] as Item;
      delete equipment[slot];
      return {
        hero: { ...hero, equipment },
        message: `Iron Eater devora el ${item.name} de ${hero.name}.`,
      };
    }
  }

  const goldLost = rollDice(3, 6, rng);
  return {
    hero,
    message: `Iron Eater no encuentra equipo y ${hero.name} pierde ${goldLost} gp (temporal).`,
  };
}

// ---------------------------------------------------------------------------
// Mummy: conversión al matar
// ---------------------------------------------------------------------------

export type MummyConversionResult = {
  heroes: Hero[];
  enemies: EnemyInstance[];
  log: string[];
};

/**
 * Si un héroe cae por un ataque de momia, muere y aparece una momia nueva.
 */
export function tryMummyConversion(
  heroes: Hero[],
  enemies: EnemyInstance[],
  fallenHeroId: string,
  attacker: EnemyInstance
): MummyConversionResult {
  if (!isMummy(attacker)) {
    return { heroes, enemies, log: [] };
  }

  const heroesNext = heroes.map((h) => {
    if (h.id !== fallenHeroId) return h;
    return {
      ...h,
      isDead: true,
      isFallen: true,
      life: 0,
      status: [...(h.status ?? []), { id: 'mummy_conversion', name: 'Converted to Mummy' }],
    };
  });

  const fallen = heroes.find((h) => h.id === fallenHeroId);
  const newMummy: EnemyInstance = {
    id: `boss_mummy_converted_${fallenHeroId}_${Date.now().toString(36)}`,
    templateId: 'boss_mummy',
    name: fallen ? `Mummy (${fallen.name})` : 'Mummy',
    level: 5,
    currentLife: 4,
    attacks: 2,
    isUndead: true,
  };

  return {
    heroes: heroesNext,
    enemies: [...enemies, newMummy],
    log: [
      fallen
        ? `${fallen.name} muere y se convierte en otra momia.`
        : 'Un héroe se convierte en momia.',
    ],
  };
}

// ---------------------------------------------------------------------------
// Aliento (Chimera / Small Dragon) en turno enemigo
// ---------------------------------------------------------------------------

export type BreathResult = {
  usedBreath: boolean;
  heroes: Hero[];
  log: string[];
};

/**
 * Chimera: d6 1–2 aliento fuego level 4 (1 life si falla).
 * Small Dragon: d6 1–2 aliento level 6 (1 life; +½ level al save).
 */
export function tryBreathAttack(
  enemy: EnemyInstance,
  heroes: Hero[],
  rng: () => number = Math.random
): BreathResult {
  const chimera = isChimera(enemy);
  const dragon = isSmallDragon(enemy);
  if (!chimera && !dragon) {
    return { usedBreath: false, heroes, log: [] };
  }

  const roll = rollD6(rng);
  const breathes = roll <= 2;
  if (!breathes) {
    return {
      usedBreath: false,
      heroes,
      log: [
        dragon
          ? `${enemy.name} no sopla fuego (${roll}) y muerde.`
          : `${enemy.name} no usa aliento (${roll}).`,
      ],
    };
  }

  const saveLevel = dragon ? 6 : 4;
  let next = heroes.map((h) => ({ ...h }));
  const log: string[] = [
    `${enemy.name} lanza aliento (sacó ${roll}) — save vs ${saveLevel}.`,
  ];

  for (let i = 0; i < next.length; i++) {
    const h = next[i];
    if (h.isDead || h.isFallen || h.life <= 0) continue;
    const bonus = dragon ? Math.floor(h.level / 2) : 0;
    const clericBonus =
      dragon && h.class === 'cleric' ? Math.floor(h.level / 2) : 0;
    // Chaos lord hellfire usa clérigo; para dragón 4AD: cada personaje +½ level
    const totalBonus = bonus || clericBonus;
    const saveRoll = rollD6(rng);
    const total = saveRoll + totalBonus;
    if (total < saveLevel) {
      next[i] = applyDamageToHero(next[i], 1);
      log.push(
        `${h.name} falla el aliento (${total} vs ${saveLevel}) y pierde 1 life.`
      );
    } else {
      log.push(`${h.name} resiste el aliento (${total} vs ${saveLevel}).`);
    }
  }

  return { usedBreath: true, heroes: next, log };
}

// ---------------------------------------------------------------------------
// Regeneración de trolls al inicio del turno enemigo
// ---------------------------------------------------------------------------

export type RegenPassResult = {
  enemies: EnemyInstance[];
  log: string[];
};

/**
 * Intenta regenerar trolls a 0 life (salvo hechizo / descuartizados).
 * `killedBySpellIds` / `choppedIds` son sets de enemy.id.
 */
export function applyTrollRegenerationPass(
  enemies: EnemyInstance[],
  opts: {
    killedBySpellIds?: Set<string>;
    choppedIds?: Set<string>;
    rng?: () => number;
  } = {}
): RegenPassResult {
  const log: string[] = [];
  const next = enemies.map((e) => {
    if (!isTroll(e) || e.currentLife > 0) return e;
    const result = tryTrollRegeneration(e, {
      killedBySpell: opts.killedBySpellIds?.has(e.id),
      choppedToBits: opts.choppedIds?.has(e.id),
      rng: opts.rng,
    });
    if (result.attempted || result.message.includes('hechizo') || result.message.includes('descuart')) {
      log.push(result.message);
    }
    return result.enemy;
  });
  return { enemies: next, log };
}

// ---------------------------------------------------------------------------
// Invisible Gremlins: encuentro no combativo
// ---------------------------------------------------------------------------

export function resolveInvisibleGremlins(
  heroes: Hero[],
  rng: () => number = Math.random
): { heroes: Hero[]; itemsStolen: number; log: string[] } {
  const count = rollD6(rng) + 3;
  let remaining = count;
  let next = heroes.map((h) => ({ ...h, equipment: { ...h.equipment } }));
  let stolen = 0;

  const stealFromHero = (h: Hero): Hero => {
    const eq = { ...h.equipment };
    for (const slot of STEAL_ORDER) {
      if (remaining <= 0) break;
      if (eq[slot]) {
        delete eq[slot];
        remaining--;
        stolen++;
      }
    }
    return { ...h, equipment: eq };
  };

  next = next.map(stealFromHero);

  const log = [
    `Invisible Gremlins roban ${stolen} objeto(s) (intentaban ${count}).`,
    stolen === 0
      ? 'No había equipo que robar.'
      : remaining > 0
        ? 'También habrían tomado monedas (botín temporal).'
        : 'El equipo prioritario ha sido saqueado.',
  ];

  return { heroes: next, itemsStolen: stolen, log };
}

// ---------------------------------------------------------------------------
// Contexto de defensa extra (minotaur -1 primera vez)
// ---------------------------------------------------------------------------

/** Set mutable de enemy ids que ya aplicaron el cargo del minotauro */
export type MinotaurChargeTracker = Set<string>;

export function minotaurDefensePenalty(
  enemy: EnemyInstance,
  tracker: MinotaurChargeTracker
): number {
  if (!isMinotaur(enemy)) return 0;
  if (tracker.has(enemy.id)) return 0;
  tracker.add(enemy.id);
  return -1;
}

/** Aplica efectos de apertura sobre un CombatState completo */
export function applyOpeningToCombatState(
  state: CombatState,
  rng?: () => number
): CombatState {
  const { heroes, log } = applyOpeningMonsterEffects(state.heroes, state.enemies, rng);
  if (log.length === 0) return state;

  return {
    ...state,
    heroes,
    log: [
      ...state.log,
      ...log.map((message) => ({
        id: `log_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        message,
        timestamp: Date.now(),
      })),
    ],
  };
}
