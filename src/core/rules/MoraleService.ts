/**
 * MoraleService – reglas de moral 4AD (funciones puras)
 *
 * Minions: cuando pierden más de la mitad de su número inicial → tirada d6
 *   1-3 huyen, 4-6 siguen luchando (salvo perfiles especiales)
 * Boss: cuando pierde más de la mitad de sus life points → mismo test;
 *   además su level baja en 1 de inmediato.
 *
 * Algunos perfiles nunca testean moral (esqueletos, momias, fight to the death, etc.)
 */

import { rollD6 } from './DiceService';
import type { EnemyInstance } from '../types/combat';

export type MoraleResult = {
  tested: boolean;
  fled: boolean;
  roll?: number;
  message: string;
  /** Boss: nuevo level tras perder > mitad life */
  newBossLevel?: number;
};

export type MoraleProfile = {
  neverTestsMorale?: boolean;
  moraleModifier?: number; // +1 valiente, -1 cobarde
  alwaysFightToDeath?: boolean;
};

/** Perfiles del manual básico por templateId */
export const MORALE_PROFILES: Record<string, MoraleProfile> = {
  minion_skeletons_zombies: { neverTestsMorale: true },
  boss_mummy: { neverTestsMorale: true },
  vermin_rats: {},
  vermin_vampire_bats: {},
  vermin_goblin_swarmlings: { moraleModifier: -1 },
  minion_goblins: {},
  minion_hobgoblins: {},
  minion_orcs: {},
  minion_trolls: { alwaysFightToDeath: true }, // o fight to death si hay dwarf
  minion_fungi_folk: {},
  boss_orc_brute: {},
  boss_ogre: {},
  boss_medusa: {},
  boss_chaos_lord: {},
  boss_small_dragon: {},
};

/**
 * ¿Debe testear moral el grupo de minions?
 * initialCount = tamaño al empezar el encuentro
 * currentAlive = vivos ahora
 */
export function shouldMinionsTestMorale(
  initialCount: number,
  currentAlive: number,
  templateId: string
): boolean {
  const profile = MORALE_PROFILES[templateId] ?? {};
  if (profile.neverTestsMorale || profile.alwaysFightToDeath) return false;
  if (initialCount <= 0) return false;
  // Más de la mitad eliminados
  return currentAlive < initialCount / 2;
}

/**
 * ¿Debe testear moral un boss?
 */
export function shouldBossTestMorale(
  maxLife: number,
  currentLife: number,
  templateId: string
): boolean {
  const profile = MORALE_PROFILES[templateId] ?? {};
  if (profile.neverTestsMorale || profile.alwaysFightToDeath) return false;
  return currentLife > 0 && currentLife < maxLife / 2;
}

/**
 * Level del boss baja en 1 al perder más de la mitad de life (inmediato).
 */
export function bossLevelAfterHalfDamage(originalLevel: number, maxLife: number, currentLife: number): number {
  if (currentLife < maxLife / 2 && currentLife > 0) {
    return Math.max(1, originalLevel - 1);
  }
  return originalLevel;
}

/**
 * Tirada de moral: d6 + modifier. 1-3 huyen, 4-6 luchan.
 */
export function rollMorale(
  templateId: string,
  rng?: () => number
): MoraleResult {
  const profile = MORALE_PROFILES[templateId] ?? {};
  if (profile.neverTestsMorale) {
    return { tested: false, fled: false, message: 'Nunca testa moral.' };
  }
  if (profile.alwaysFightToDeath) {
    return { tested: false, fled: false, message: 'Fight to the death (no moral).' };
  }

  const roll = rollD6(rng);
  const mod = profile.moraleModifier ?? 0;
  const total = roll + mod;
  // 4AD: 3 or less flee, 4+ fight. Modifier shifts the roll.
  const fled = total <= 3;

  return {
    tested: true,
    fled,
    roll,
    message: fled
      ? `Moral ${roll}${mod ? (mod > 0 ? `+${mod}` : mod) : ''} → huyen`
      : `Moral ${roll}${mod ? (mod > 0 ? `+${mod}` : mod) : ''} → siguen luchando`,
  };
}

/**
 * Tras aplicar daño a minions: si corresponde, testear moral.
 */
export function checkMinionMoraleAfterLoss(
  templateId: string,
  initialCount: number,
  currentAlive: number,
  alreadyTestedThisEncounter: boolean,
  rng?: () => number
): MoraleResult {
  if (alreadyTestedThisEncounter) {
    return { tested: false, fled: false, message: 'Moral ya testeada este encuentro.' };
  }
  if (!shouldMinionsTestMorale(initialCount, currentAlive, templateId)) {
    return { tested: false, fled: false, message: 'Aún no aplica test de moral.' };
  }
  return rollMorale(templateId, rng);
}
