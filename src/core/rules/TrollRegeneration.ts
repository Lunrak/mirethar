/**
 * Regeneración de trolls (4AD)
 *
 * Trolls regeneran salvo:
 * - muertos por hechizo, o
 * - un personaje usa un ataque para descuartizar el cadáver
 *
 * Si no: al siguiente turno del troll, d6: 5-6 vuelve a la vida con 1 life.
 */

import { rollD6 } from './DiceService';
import type { EnemyInstance } from '../types/combat';

export type TrollRegenResult = {
  attempted: boolean;
  regenerated: boolean;
  roll?: number;
  message: string;
  enemy: EnemyInstance;
};

/**
 * Marca un troll como "killedBySpell" o "chopped" en un mapa externo.
 * Aquí solo evaluamos la tirada de regeneración.
 */
export function tryTrollRegeneration(
  troll: EnemyInstance,
  opts: {
    killedBySpell?: boolean;
    choppedToBits?: boolean;
    rng?: () => number;
  } = {}
): TrollRegenResult {
  if (troll.currentLife > 0) {
    return {
      attempted: false,
      regenerated: false,
      message: 'El troll sigue vivo.',
      enemy: troll,
    };
  }

  if (opts.killedBySpell) {
    return {
      attempted: false,
      regenerated: false,
      message: 'Troll muerto por hechizo: no regenera.',
      enemy: troll,
    };
  }

  if (opts.choppedToBits) {
    return {
      attempted: false,
      regenerated: false,
      message: 'Troll descuartizado: no regenera.',
      enemy: troll,
    };
  }

  const roll = rollD6(opts.rng);
  if (roll >= 5) {
    return {
      attempted: true,
      regenerated: true,
      roll,
      message: `Troll regenera (sacó ${roll}) y vuelve con 1 life.`,
      enemy: { ...troll, currentLife: 1 },
    };
  }

  return {
    attempted: true,
    regenerated: false,
    roll,
    message: `Troll no regenera (sacó ${roll}).`,
    enemy: troll,
  };
}

export function isTroll(enemy: EnemyInstance): boolean {
  return (
    enemy.templateId === 'minion_trolls' ||
    enemy.name.toLowerCase().includes('troll')
  );
}
