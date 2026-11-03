/**
 * DefenseCalculator – reglas de defensa 4AD (funciones puras)
 * Defense roll = d6 + armor + shield + class/race mods
 * Natural 1 always fail, natural 6 always success.
 */

import { rollWithExplosiveSix } from './DiceService';
import type { DiceResult, EnemyInstance, Hero, Item } from '../types/combat';

export type DefenseContext = {
  /** Ataque por sorpresa (wandering en pasillo): no cuenta el escudo */
  surpriseAttack?: boolean;
  /** Retirada: Defense a +1 */
  withdrawing?: boolean;
  /** El monstruo ignora armadura (algunos perfiles) */
  ignoresArmor?: boolean;
  /** El monstruo ignora escudo */
  ignoresShield?: boolean;
  /** Nombre/tipo del monstruo atacante (para mods raciales futuros) */
  attackerName?: string;
  attackerTemplateId?: string;
  extra?: number;
  rng?: () => number;
};

export type DefenseModifierBreakdown = {
  armorMod: number;
  shieldMod: number;
  classMod: number;
  racialMod: number;
  situationalMod: number;
  total: number;
  notes: string[];
};

export type DefenseResult = {
  dice: DiceResult;
  modifiers: DefenseModifierBreakdown;
  finalValue: number;
  monsterLevel: number;
  success: boolean;
  /** Natural 1 / 6 forzado */
  forced: 'success' | 'failure' | null;
  damageTaken: number; // 0 o 1 (o 2 si el monstruo inflige 2)
  message: string;
};

// ---------------------------------------------------------------------------
// Modificadores de defensa
// ---------------------------------------------------------------------------

export function getArmorDefenseMod(
  hero: Hero,
  ctx: DefenseContext = {}
): { mod: number; notes: string[] } {
  if (ctx.ignoresArmor) return { mod: 0, notes: ['Armor ignored by attack'] };

  const armor = hero.equipment?.armor as Item & { tags?: string[] } | undefined;
  if (!armor) return { mod: 0, notes: [] };

  const tags = armor.tags ?? [];
  if (tags.includes('heavy')) {
    return { mod: 2, notes: ['Heavy armor +2'] };
  }
  if (tags.includes('light')) {
    return { mod: 1, notes: ['Light armor +1'] };
  }
  // fallback por id
  if (armor.id === 'heavy_armor') return { mod: 2, notes: ['Heavy armor +2'] };
  if (armor.id === 'light_armor') return { mod: 1, notes: ['Light armor +1'] };

  return { mod: 0, notes: [] };
}

export function getShieldDefenseMod(
  hero: Hero,
  ctx: DefenseContext = {}
): { mod: number; notes: string[] } {
  if (ctx.ignoresShield || ctx.surpriseAttack) {
    return {
      mod: 0,
      notes: ctx.surpriseAttack
        ? ['Shield ignored (surprise attack)']
        : ['Shield ignored by attack'],
    };
  }

  const shield = hero.equipment?.shield;
  if (!shield) return { mod: 0, notes: [] };
  return { mod: 1, notes: ['Shield +1'] };
}

export function getClassDefenseMod(hero: Hero): { mod: number; notes: string[] } {
  // Solo Rogue suma level a Defense en el MVP de 4 clases
  if (hero.class === 'rogue') {
    return { mod: hero.level, notes: [`Rogue +${hero.level} Defense`] };
  }
  return { mod: 0, notes: [] };
}

/**
 * Mods raciales del MVP futuro (dwarf/halfling).
 * Con las 4 clases actuales siempre 0; se deja listo.
 */
export function getRacialDefenseMod(
  hero: Hero,
  ctx: DefenseContext = {}
): { mod: number; notes: string[] } {
  // Placeholder: cuando haya dwarf/halfling
  // Dwarf +1 vs troll/ogre/giant
  // Halfling +L vs troll/ogre/giant
  void hero;
  void ctx;
  return { mod: 0, notes: [] };
}

export function getSituationalDefenseMod(
  ctx: DefenseContext = {}
): { mod: number; notes: string[] } {
  const notes: string[] = [];
  let mod = 0;

  if (ctx.withdrawing) {
    mod += 1;
    notes.push('Withdrawing +1');
  }
  if (ctx.extra) {
    mod += ctx.extra;
    notes.push(`Extra ${ctx.extra > 0 ? '+' : ''}${ctx.extra}`);
  }

  return { mod, notes };
}

export function computeDefenseModifiers(
  hero: Hero,
  ctx: DefenseContext = {}
): DefenseModifierBreakdown {
  const armor = getArmorDefenseMod(hero, ctx);
  const shield = getShieldDefenseMod(hero, ctx);
  const classMod = getClassDefenseMod(hero);
  const racial = getRacialDefenseMod(hero, ctx);
  const situ = getSituationalDefenseMod(ctx);

  return {
    armorMod: armor.mod,
    shieldMod: shield.mod,
    classMod: classMod.mod,
    racialMod: racial.mod,
    situationalMod: situ.mod,
    total: armor.mod + shield.mod + classMod.mod + racial.mod + situ.mod,
    notes: [...armor.notes, ...shield.notes, ...classMod.notes, ...racial.notes, ...situ.notes],
  };
}

// ---------------------------------------------------------------------------
// resolveDefense
// ---------------------------------------------------------------------------

export function resolveDefense(
  hero: Hero,
  monsterLevel: number,
  ctx: DefenseContext = {},
  /** Algunos monstruos infligen 2 heridas (Ogre, etc.) */
  woundsOnHit: number = 1
): DefenseResult {
  const dice = rollWithExplosiveSix(ctx.rng);
  const modifiers = computeDefenseModifiers(hero, ctx);
  const finalValue = dice.total + modifiers.total;

  // Natural 1 always fail, natural 6 always success (on raw first die)
  let forced: 'success' | 'failure' | null = null;
  let success: boolean;

  if (dice.raw === 1) {
    success = false;
    forced = 'failure';
  } else if (dice.raw === 6) {
    success = true;
    forced = 'success';
  } else {
    success = finalValue >= monsterLevel;
  }

  const damageTaken = success ? 0 : woundsOnHit;

  const diceStr = dice.isExplosive
    ? `${dice.total} (${[dice.raw, ...dice.explosive].join('+')})`
    : `${dice.total}`;

  const message = success
    ? `${hero.name} defiende: ${diceStr}+${modifiers.total}=${finalValue} vs ${monsterLevel} → ÉXITO (sin daño)`
    : `${hero.name} defiende: ${diceStr}+${modifiers.total}=${finalValue} vs ${monsterLevel} → FALLO (−${damageTaken} life)`;

  return {
    dice,
    modifiers,
    finalValue,
    monsterLevel,
    success,
    forced,
    damageTaken,
    message,
  };
}
