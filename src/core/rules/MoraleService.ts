/**
 * MoraleService – reglas de moral 4AD (funciones puras)
 *
 * Minions/Vermin: al perder más de la mitad del número inicial → d6
 *   1-3 huyen, 4-6 siguen (salvo perfiles especiales)
 * Boss/Weird: al quedar por debajo de la mitad de life → mismo test;
 *   el level ya baja en 1 por applyHalfLifeLevelDrop
 */

import { rollD6 } from './DiceService';
import type { EnemyInstance } from '../types/combat';

export type MoraleResult = {
  tested: boolean;
  fled: boolean;
  roll?: number;
  message: string;
  newBossLevel?: number;
};

export type MoraleProfile = {
  neverTestsMorale?: boolean;
  moraleModifier?: number;
  alwaysFightToDeath?: boolean;
};

/** Perfiles del manual básico por templateId */
export const MORALE_PROFILES: Record<string, MoraleProfile> = {
  // Vermin
  vermin_rats: {},
  vermin_vampire_bats: {},
  vermin_goblin_swarmlings: { moraleModifier: -1 },
  vermin_giant_centipedes: {},
  vermin_vampire_frogs: {},
  vermin_skeletal_rats: { neverTestsMorale: true },

  // Minions
  minion_skeletons_zombies: { neverTestsMorale: true },
  minion_goblins: {},
  minion_hobgoblins: {},
  minion_orcs: {},
  minion_trolls: { alwaysFightToDeath: true },
  minion_fungi_folk: {},

  // Boss
  boss_mummy: { neverTestsMorale: true },
  boss_orc_brute: {},
  boss_ogre: {},
  boss_medusa: {},
  boss_chaos_lord: {},
  boss_small_dragon: {},

  // Weird (como bosses)
  weird_minotaur: {},
  weird_iron_eater: {},
  weird_chimera: {},
  weird_catoblepas: {},
  weird_giant_spider: { alwaysFightToDeath: true },
  weird_invisible_gremlins: { neverTestsMorale: true },
};

export function shouldMinionsTestMorale(
  initialCount: number,
  currentAlive: number,
  templateId: string
): boolean {
  const profile = MORALE_PROFILES[templateId] ?? {};
  if (profile.neverTestsMorale || profile.alwaysFightToDeath) return false;
  if (initialCount <= 0) return false;
  return currentAlive < initialCount / 2;
}

export function shouldBossTestMorale(
  maxLife: number,
  currentLife: number,
  templateId: string
): boolean {
  const profile = MORALE_PROFILES[templateId] ?? {};
  if (profile.neverTestsMorale || profile.alwaysFightToDeath) return false;
  return currentLife > 0 && currentLife < maxLife / 2;
}

export function bossLevelAfterHalfDamage(
  originalLevel: number,
  maxLife: number,
  currentLife: number
): number {
  if (currentLife < maxLife / 2 && currentLife > 0) {
    return Math.max(1, originalLevel - 1);
  }
  return originalLevel;
}

/**
 * Nombre limpio para el log (sin ids técnicos).
 */
export function moraleDisplayName(name: string, templateId?: string): string {
  const cleaned = name.replace(/\s*\([^)]*\)\s*/g, '').trim();
  if (cleaned) return cleaned;
  if (templateId) {
    return templateId
      .replace(/^(vermin|minion|boss|weird)_/, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return 'Enemigo';
}

export function rollMorale(
  templateId: string,
  displayNameOrRng?: string | (() => number),
  rng?: () => number
): MoraleResult {
  let displayName = templateId;
  let actualRng = rng;
  if (typeof displayNameOrRng === 'function') {
    actualRng = displayNameOrRng;
  } else if (typeof displayNameOrRng === 'string') {
    displayName = displayNameOrRng;
  }
  const profile = MORALE_PROFILES[templateId] ?? {};
  const label = moraleDisplayName(displayName, templateId);

  if (profile.neverTestsMorale) {
    return {
      tested: false,
      fled: false,
      message: `${label}: no testean moral.`,
    };
  }
  if (profile.alwaysFightToDeath) {
    return {
      tested: false,
      fled: false,
      message: `${label}: luchan hasta la muerte (sin moral).`,
    };
  }

  const roll = rollD6(actualRng);
  const mod = profile.moraleModifier ?? 0;
  const total = roll + mod;
  const fled = total <= 3;
  const modStr = mod ? (mod > 0 ? `+${mod}` : `${mod}`) : '';

  return {
    tested: true,
    fled,
    roll,
    message: fled
      ? `Moral de ${label}: ${roll}${modStr} → ¡Huyen!`
      : `Moral de ${label}: ${roll}${modStr} → siguen luchando.`,
  };
}

export function checkMinionMoraleAfterLoss(
  templateId: string,
  displayNameOrInitial: string | number,
  initialCountOrAlive: number,
  currentAliveOrTested: number | boolean,
  alreadyTestedOrRng?: boolean | (() => number),
  rng?: () => number
): MoraleResult {
  // Nueva firma: (id, name, initial, alive, tested, rng)
  // Antigua:     (id, initial, alive, tested, rng)
  let displayName = templateId;
  let initialCount: number;
  let currentAlive: number;
  let alreadyTested: boolean;
  let actualRng: (() => number) | undefined;

  if (typeof displayNameOrInitial === 'string') {
    displayName = displayNameOrInitial;
    initialCount = initialCountOrAlive;
    currentAlive = currentAliveOrTested as number;
    alreadyTested = Boolean(alreadyTestedOrRng);
    actualRng = rng;
  } else {
    initialCount = displayNameOrInitial;
    currentAlive = initialCountOrAlive;
    alreadyTested = Boolean(currentAliveOrTested);
    actualRng =
      typeof alreadyTestedOrRng === 'function' ? alreadyTestedOrRng : undefined;
  }

  if (alreadyTested) {
    return { tested: false, fled: false, message: '' };
  }
  if (!shouldMinionsTestMorale(initialCount, currentAlive, templateId)) {
    return { tested: false, fled: false, message: '' };
  }
  return rollMorale(templateId, displayName, actualRng);
}

export function checkBossMoraleAfterDamage(
  templateId: string,
  displayName: string,
  maxLife: number,
  currentLife: number,
  alreadyTestedThisEncounter: boolean,
  rng?: () => number
): MoraleResult {
  if (alreadyTestedThisEncounter) {
    return { tested: false, fled: false, message: '' };
  }
  if (!shouldBossTestMorale(maxLife, currentLife, templateId)) {
    return { tested: false, fled: false, message: '' };
  }
  return rollMorale(templateId, displayName, rng);
}
