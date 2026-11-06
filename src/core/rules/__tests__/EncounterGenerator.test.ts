/**
 * EncounterGenerator – tablas básicas + weird
 */

import { generateEncounter, generateRandomEncounter } from '../EncounterGenerator';
import type { EncounterResult } from '../EncounterGenerator';

/** Rangos esperados de cantidad por template */
const EXPECTED_RANGES: Record<string, { min: number; max: number; level: number }> = {
  vermin_rats: { min: 3, max: 18, level: 1 },
  vermin_vampire_bats: { min: 3, max: 18, level: 1 },
  vermin_goblin_swarmlings: { min: 2, max: 12, level: 3 },
  vermin_giant_centipedes: { min: 1, max: 6, level: 3 },
  vermin_vampire_frogs: { min: 1, max: 6, level: 4 },
  vermin_skeletal_rats: { min: 2, max: 12, level: 3 },

  minion_skeletons_zombies: { min: 1, max: 8, level: 3 },
  minion_goblins: { min: 4, max: 9, level: 3 },
  minion_hobgoblins: { min: 1, max: 6, level: 4 },
  minion_orcs: { min: 2, max: 7, level: 4 },
  minion_trolls: { min: 1, max: 3, level: 5 },
  minion_fungi_folk: { min: 2, max: 12, level: 3 },

  boss_mummy: { min: 1, max: 1, level: 5 },
  boss_orc_brute: { min: 1, max: 1, level: 5 },
  boss_ogre: { min: 1, max: 1, level: 5 },
  boss_medusa: { min: 1, max: 1, level: 4 },
  boss_chaos_lord: { min: 1, max: 1, level: 6 },
  boss_small_dragon: { min: 1, max: 1, level: 6 },

  weird_minotaur: { min: 1, max: 1, level: 5 },
  weird_iron_eater: { min: 1, max: 1, level: 3 },
  weird_chimera: { min: 1, max: 1, level: 5 },
  weird_catoblepas: { min: 1, max: 1, level: 4 },
  weird_giant_spider: { min: 1, max: 1, level: 5 },
  weird_invisible_gremlins: { min: 1, max: 1, level: 0 },
};

function validateEncounter(enc: EncounterResult): void {
  const range = EXPECTED_RANGES[enc.template.id];
  expect(range).toBeDefined();

  expect(enc.quantity).toBeGreaterThanOrEqual(range.min);
  expect(enc.quantity).toBeLessThanOrEqual(range.max);
  expect(enc.template.level).toBe(range.level);
  expect(enc.enemies.length).toBe(enc.quantity);
  expect(enc.enemies.every((e) => e.currentLife === enc.template.life)).toBe(true);
  expect(enc.enemies.every((e) => e.level === enc.template.level)).toBe(true);
}

describe('EncounterGenerator', () => {
  it('genera 10 encuentros aleatorios válidos', () => {
    for (let i = 0; i < 10; i++) {
      const enc = generateRandomEncounter();
      console.log(
        `${i + 1}. [${enc.type}] #${enc.tableRoll} → ${enc.template.name} x${enc.quantity} (lvl ${enc.template.level})`
      );
      validateEncounter(enc);
    }
  });

  it('genera un encuentro de cada tipo correctamente', () => {
    for (const type of ['vermin', 'minion', 'boss', 'weird'] as const) {
      const enc = generateEncounter(type);
      console.log(
        `${type} → ${enc.template.name} x${enc.quantity}`
      );
      validateEncounter(enc);
      expect(enc.type).toBe(type);
    }
  });

  it('los bosses siempre generan exactamente 1 enemigo', () => {
    for (let i = 0; i < 6; i++) {
      const enc = generateEncounter('boss', () => i / 6);
      expect(enc.quantity).toBe(1);
      expect(enc.enemies).toHaveLength(1);
    }
  });
});
