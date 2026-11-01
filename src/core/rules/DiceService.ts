import { DiceResult } from '../types/combat';

/**
 * Servicio puro de dados – Mirethar / 4AD
 * No tiene efectos secundarios. Solo genera resultados.
 */

/** Tira un d6 (1-6). */
export function rollD6(rng: () => number = Math.random): number {
  return Math.floor(rng() * 6) + 1;
}

/**
 * Explosive Six exactamente como el pseudocódigo del GDD §7.3
 *
 * Se tira un d6. Si sale 6 se vuelve a tirar y se suma.
 * Se continúa mientras salga 6. El total es la suma de todos los dados.
 */
export function rollWithExplosiveSix(rng: () => number = Math.random): DiceResult {
  const rolls: number[] = [];
  let total = 0;
  let current = rollD6(rng);
  rolls.push(current);
  total += current;

  while (current === 6) {
    current = rollD6(rng);
    rolls.push(current);
    total += current;
  }

  return {
    raw: rolls[0],
    explosive: rolls.slice(1),
    total,
    isExplosive: rolls.length > 1,
  };
}
