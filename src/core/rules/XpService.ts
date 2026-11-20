/**
 * Experiencia y subida de nivel (mazmorra procedural)
 *
 * Recompensas al ganar:
 * - Vermin: 0
 * - Minion: 0.1 (se acumula; cada 1.0 = 1 XP entero)
 * - Boss / Weird: 1 XP
 * - Jefe final: 2 XP
 *
 * Subida de nivel (manual, pantalla de party):
 * - Gasta 1 XP entero
 * - No puede ser el mismo héroe dos veces seguidas
 * - d6 > nivel actual → éxito (level +1, maxLife +1, life +1)
 * - si no → el XP se pierde
 */

import { rollD6 } from './DiceService';
import type { Hero } from '../types/combat';

export type XpBank = {
  wholeXp: number;
  minionProgress: number;
  minionEncounters: number;
  lastLeveledHeroId: string | null;
};

export function emptyXpBank(): XpBank {
  return {
    wholeXp: 0,
    minionProgress: 0,
    minionEncounters: 0,
    lastLeveledHeroId: null,
  };
}

export type EncounterXpKind = 'vermin' | 'minion' | 'boss' | 'weird' | 'final_boss';

export function xpAmountForKind(kind: EncounterXpKind): number {
  switch (kind) {
    case 'vermin':
      return 0;
    case 'minion':
      return 0.1;
    case 'boss':
    case 'weird':
      return 1;
    case 'final_boss':
      return 2;
  }
}

export type XpGainResult = {
  bank: XpBank;
  gainedWhole: number;
  message: string;
};

export function applyEncounterXp(
  bank: XpBank,
  kind: EncounterXpKind,
): XpGainResult {
  const amount = xpAmountForKind(kind);
  if (amount <= 0) {
    return { bank, gainedWhole: 0, message: 'Vermin: sin experiencia.' };
  }

  if (kind === 'minion') {
    let minionProgress = bank.minionProgress + 0.1;
    let wholeXp = bank.wholeXp;
    let gainedWhole = 0;
    const minionEncounters = bank.minionEncounters + 1;
    while (minionProgress >= 1 - 1e-9) {
      minionProgress = Math.max(0, minionProgress - 1);
      wholeXp += 1;
      gainedWhole += 1;
    }
    minionProgress = Math.round(minionProgress * 10) / 10;
    const bankNext: XpBank = {
      ...bank,
      wholeXp,
      minionProgress,
      minionEncounters,
    };
    return {
      bank: bankNext,
      gainedWhole,
      message:
        gainedWhole > 0
          ? `Minions: +0.1 XP → +${gainedWhole} XP entero. Banco: ${wholeXp}.`
          : `Minions: +0.1 XP (fracción ${minionProgress}/1).`,
    };
  }

  const gainedWhole = amount;
  const wholeXp = bank.wholeXp + gainedWhole;
  return {
    bank: { ...bank, wholeXp },
    gainedWhole,
    message:
      kind === 'final_boss'
        ? `Jefe final: +${gainedWhole} XP. Banco: ${wholeXp}.`
        : `${kind === 'weird' ? 'Weird' : 'Boss'}: +${gainedWhole} XP. Banco: ${wholeXp}.`,
  };
}

export type LevelUpAttempt = {
  ok: boolean;
  success: boolean;
  roll: number;
  heroId: string;
  heroName: string;
  previousLevel: number;
  newLevel: number;
  message: string;
  bank: XpBank;
  heroes: Hero[];
};

export function attemptLevelUp(
  bank: XpBank,
  heroes: Hero[],
  heroId: string,
  rng?: () => number,
): LevelUpAttempt {
  const hero = heroes.find((h) => h.id === heroId);
  if (!hero) {
    return {
      ok: false,
      success: false,
      roll: 0,
      heroId,
      heroName: '?',
      previousLevel: 0,
      newLevel: 0,
      message: 'Héroe no encontrado.',
      bank,
      heroes,
    };
  }
  if (hero.isDead) {
    return {
      ok: false,
      success: false,
      roll: 0,
      heroId,
      heroName: hero.name,
      previousLevel: hero.level,
      newLevel: hero.level,
      message: `${hero.name} está muerto y no puede subir de nivel.`,
      bank,
      heroes,
    };
  }
  if (bank.wholeXp < 1) {
    return {
      ok: false,
      success: false,
      roll: 0,
      heroId,
      heroName: hero.name,
      previousLevel: hero.level,
      newLevel: hero.level,
      message: 'No hay XP enteros disponibles.',
      bank,
      heroes,
    };
  }
  if (bank.lastLeveledHeroId === heroId) {
    return {
      ok: false,
      success: false,
      roll: 0,
      heroId,
      heroName: hero.name,
      previousLevel: hero.level,
      newLevel: hero.level,
      message: `${hero.name} ya subió de nivel la última vez; elegid a otro héroe.`,
      bank,
      heroes,
    };
  }

  const spent: XpBank = { ...bank, wholeXp: bank.wholeXp - 1 };
  const roll = rollD6(rng);
  const previousLevel = hero.level;

  if (roll > hero.level) {
    const newLevel = hero.level + 1;
    const nextHeroes = heroes.map((h) =>
      h.id === heroId
        ? {
            ...h,
            level: newLevel,
            maxLife: h.maxLife + 1,
            life: Math.min(h.maxLife + 1, h.life + 1),
          }
        : h,
    );
    return {
      ok: true,
      success: true,
      roll,
      heroId,
      heroName: hero.name,
      previousLevel,
      newLevel,
      message: `${hero.name}: d6=${roll} > nivel ${previousLevel} → ¡sube a nivel ${newLevel}!`,
      bank: { ...spent, lastLeveledHeroId: heroId },
      heroes: nextHeroes,
    };
  }

  return {
    ok: true,
    success: false,
    roll,
    heroId,
    heroName: hero.name,
    previousLevel,
    newLevel: previousLevel,
    message: `${hero.name}: d6=${roll} ≤ nivel ${previousLevel} → falla; se pierde 1 XP.`,
    bank: spent,
    heroes,
  };
}

export type XpAward = {
  reason: 'boss' | 'minion_tally' | 'weird' | 'final_boss' | 'vermin' | 'minion';
  rolls: number;
  wholeGained: number;
  message: string;
};

export type XpRollResult = {
  heroId: string;
  heroName: string;
  roll: number;
  message: string;
};

export function awardBossXp(): XpAward {
  return { reason: 'boss', rolls: 1, wholeGained: 1, message: 'Boss derrotado: +1 XP.' };
}

export function awardWeirdXp(): XpAward {
  return { reason: 'weird', rolls: 1, wholeGained: 1, message: 'Weird monster derrotado: +1 XP.' };
}

export function awardFinalBossXp(): XpAward {
  return { reason: 'final_boss', rolls: 2, wholeGained: 2, message: 'Jefe final derrotado: +2 XP.' };
}

export function awardMinionXp(): XpAward {
  return { reason: 'minion', rolls: 0, wholeGained: 0, message: 'Minions: +0.1 XP (se acumula hasta 1).' };
}

export function rollXpForHero(hero: Hero, rng?: () => number): XpRollResult {
  const roll = rollD6(rng);
  return {
    heroId: hero.id,
    heroName: hero.name,
    roll,
    message: `${hero.name} tira XP: ${roll} (nivel actual ${hero.level}).`,
  };
}
