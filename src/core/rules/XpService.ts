/**
 * XP mínimo 4AD:
 * - Derrotar un Boss → 1 tirada de XP
 * - Vermin → 0 XP
 * - 10 encuentros de minions sobrevividos → 1 tirada (se trackea fuera)
 *
 * Tirada de XP (simplificada MVP): d6 + nivel actual del héroe elegido.
 * En 4AD hay tabla de level-up; aquí solo registramos la tirada.
 */

import { rollD6 } from './DiceService';
import type { Hero } from '../types/combat';

export type XpAward = {
  reason: 'boss' | 'minion_tally' | 'weird';
  rolls: number;
  message: string;
};

export type XpRollResult = {
  heroId: string;
  heroName: string;
  roll: number;
  message: string;
};

/** Al matar un boss/weird → 1 tirada de XP para el party */
export function awardBossXp(): XpAward {
  return {
    reason: 'boss',
    rolls: 1,
    message: 'Boss derrotado: 1 tirada de XP.',
  };
}

export function awardWeirdXp(): XpAward {
  return {
    reason: 'weird',
    rolls: 1,
    message: 'Weird monster derrotado: 1 tirada de XP.',
  };
}

/** El jugador elige un héroe para la tirada */
export function rollXpForHero(hero: Hero, rng?: () => number): XpRollResult {
  const roll = rollD6(rng);
  return {
    heroId: hero.id,
    heroName: hero.name,
    roll,
    message: `${hero.name} tira XP: ${roll} (nivel actual ${hero.level}).`,
  };
}
