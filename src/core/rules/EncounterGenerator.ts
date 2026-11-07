/**
 * EncounterGenerator – Mirethar / 4AD
 * Genera encuentros a partir de las tablas Vermin / Minions / Boss / Weird.
 * Devuelve EnemyInstance[] listos para combate.
 */

import { rollD6, rollDice } from './DiceService';
import { VERMIN_TABLE } from '../data/vermin';
import { MINIONS_TABLE } from '../data/minions';
import { BOSSES_TABLE } from '../data/bosses';
import { WEIRD_TABLE } from '../data/weird';
import type { EnemyTemplate, EnemyInstance } from '../types/combat';

export type EncounterType = 'vermin' | 'minion' | 'boss' | 'weird';

export type EncounterResult = {
  type: EncounterType;
  tableRoll: number; // 1-6
  template: EnemyTemplate;
  enemies: EnemyInstance[];
  /** Cantidad generada (útil para tests y log) */
  quantity: number;
};

/** Mapa de fórmulas de cantidad por id de template (según 4AD) */
const QUANTITY_FORMULAS: Record<string, (rng: () => number) => number> = {
  // Vermin
  vermin_rats: (rng) => rollDice(3, 6, rng),
  vermin_vampire_bats: (rng) => rollDice(3, 6, rng),
  vermin_goblin_swarmlings: (rng) => rollDice(2, 6, rng),
  vermin_giant_centipedes: (rng) => rollDice(1, 6, rng),
  vermin_vampire_frogs: (rng) => rollDice(1, 6, rng),
  vermin_skeletal_rats: (rng) => rollDice(2, 6, rng),

  // Minions
  minion_skeletons_zombies: (rng) => {
    return rng() < 0.5 ? rollDice(1, 6, rng) + 2 : rollDice(1, 6, rng);
  },
  minion_goblins: (rng) => rollDice(1, 6, rng) + 3,
  minion_hobgoblins: (rng) => rollDice(1, 6, rng),
  minion_orcs: (rng) => rollDice(1, 6, rng) + 1,
  minion_trolls: (rng) => rollDice(1, 3, rng),
  minion_fungi_folk: (rng) => rollDice(2, 6, rng),

  // Bosses → siempre 1
  boss_mummy: () => 1,
  boss_orc_brute: () => 1,
  boss_ogre: () => 1,
  boss_medusa: () => 1,
  boss_chaos_lord: () => 1,
  boss_small_dragon: () => 1,

  // Weird → siempre 1 (gremlins también 1 “encuentro”)
  weird_minotaur: () => 1,
  weird_iron_eater: () => 1,
  weird_chimera: () => 1,
  weird_catoblepas: () => 1,
  weird_giant_spider: () => 1,
  weird_invisible_gremlins: () => 1,
};

function getTable(type: EncounterType): EnemyTemplate[] {
  switch (type) {
    case 'vermin':
      return VERMIN_TABLE;
    case 'minion':
      return MINIONS_TABLE;
    case 'boss':
      return BOSSES_TABLE;
    case 'weird':
      return WEIRD_TABLE;
  }
}

/**
 * Genera un encuentro del tipo indicado.
 */
export function generateEncounter(
  type: EncounterType,
  rng: () => number = Math.random
): EncounterResult {
  const table = getTable(type);
  const tableRoll = rollD6(rng);
  const template = table[tableRoll - 1];

  const quantityFn = QUANTITY_FORMULAS[template.id];
  if (!quantityFn) {
    throw new Error(`No quantity formula for template: ${template.id}`);
  }

  // Invisible Gremlins: encuentro sin combate (0 life / 0 attacks)
  const quantity = quantityFn(rng);

  const enemies: EnemyInstance[] = Array.from({ length: quantity }, (_, i) => ({
    id: `${template.id}_${i + 1}_${Date.now().toString(36)}`,
    templateId: template.id,
    name: template.name,
    level: template.level,
    currentLife: template.life,
    maxLife: template.life,
    attacks: template.attacks,
    isUndead: template.isUndead,
  }));

  return {
    type,
    tableRoll,
    template,
    enemies,
    quantity,
  };
}

/**
 * Encuentro aleatorio 4AD wandering:
 * 1-3 vermin, 4 minion, 5 weird, 6 boss
 */
export function generateRandomEncounter(rng: () => number = Math.random): EncounterResult {
  const roll = rollD6(rng);
  if (roll <= 3) return generateEncounter('vermin', rng);
  if (roll === 4) return generateEncounter('minion', rng);
  if (roll === 5) return generateEncounter('weird', rng);
  return generateEncounter('boss', rng);
}
