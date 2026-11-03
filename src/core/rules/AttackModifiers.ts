/**
 * AttackModifiers – reglas especiales de ataque 4AD (funciones puras)
 * Afecta a las 4 clases del MVP y a monstruos del manual básico.
 */

import type { EnemyInstance, Hero, Item } from '../types/combat';

export type AttackModContext = {
  /** Party supera en número al grupo enemigo (Rogue) */
  enemiesOutnumbered?: boolean;
  /** Primer turno / posible sorpresa */
  isSurpriseRound?: boolean;
  /** El atacante está en retaguardia (pasillo) y usa arma a distancia */
  attackerInRear?: boolean;
  /** En pasillo: solo frente puede atacar cuerpo a cuerpo */
  inCorridor?: boolean;
  /** Modificadores extra manuales */
  extra?: number;
};

export type AttackModifierBreakdown = {
  classMod: number;
  weaponMod: number;
  racialOrSpecialMod: number; // undead, orcs, etc.
  situationalMod: number;     // sorpresa, posicionamiento
  total: number;
  notes: string[];
  /** Si true, el ataque ni siquiera se puede intentar */
  blocked: boolean;
  blockReason?: string;
};

// ---------------------------------------------------------------------------
// Helpers de equipo
// ---------------------------------------------------------------------------

function getWeaponTags(actor: Hero): string[] {
  const weapon = actor.equipment?.mainHand as Item & { tags?: string[] } | undefined;
  return weapon?.tags ?? [];
}

function hasTag(actor: Hero, tag: string): boolean {
  return getWeaponTags(actor).includes(tag);
}

function isRanged(actor: Hero): boolean {
  const tags = getWeaponTags(actor);
  return tags.includes('ranged') || tags.includes('bow') || tags.includes('sling');
}

// ---------------------------------------------------------------------------
// Modificador de clase al ataque
// ---------------------------------------------------------------------------

export function getClassAttackMod(
  actor: Hero,
  target: EnemyInstance,
  ctx: AttackModContext = {}
): { mod: number; notes: string[] } {
  const notes: string[] = [];
  const L = actor.level;

  switch (actor.class) {
    case 'warrior':
      notes.push(`Warrior +${L}`);
      return { mod: L, notes };

    case 'cleric':
      if (target.isUndead) {
        notes.push(`Cleric +${L} vs undead`);
        return { mod: L, notes };
      }
      const half = Math.floor(L / 2);
      notes.push(`Cleric +${half} (½ level)`);
      return { mod: half, notes };

    case 'rogue':
      if (ctx.enemiesOutnumbered) {
        notes.push(`Rogue +${L} (outnumbered minion)`);
        return { mod: L, notes };
      }
      notes.push('Rogue +0 (not outnumbered)');
      return { mod: 0, notes };

    case 'wizard':
      notes.push('Wizard +0 (weapon attack)');
      return { mod: 0, notes };

    default:
      return { mod: 0, notes };
  }
}

// ---------------------------------------------------------------------------
// Modificador de arma
// ---------------------------------------------------------------------------

export function getWeaponAttackMod(
  actor: Hero,
  target: EnemyInstance
): { mod: number; notes: string[]; blocked: boolean; blockReason?: string } {
  const notes: string[] = [];
  let mod = 0;
  const tags = getWeaponTags(actor);

  // Bloqueo: skeletal rats no se pueden atacar con bow/sling
  if (
    target.templateId === 'vermin_skeletal_rats' ||
    (target.isUndead && target.name.toLowerCase().includes('skeletal rat'))
  ) {
    if (isRanged(actor) || tags.includes('bow') || tags.includes('sling')) {
      return {
        mod: 0,
        notes,
        blocked: true,
        blockReason: 'Skeletal rats cannot be attacked with bows or slings',
      };
    }
  }

  if (tags.includes('two-handed')) {
    mod += 1;
    notes.push('Two-handed weapon +1');
  }
  if (tags.includes('light')) {
    mod -= 1;
    notes.push('Light weapon -1');
  }

  // Crushing +1 vs skeletons / skeletal rats
  if (tags.includes('crushing') && target.isUndead) {
    const isSkeleton =
      target.templateId.includes('skeleton') ||
      target.templateId.includes('skeletal') ||
      target.name.toLowerCase().includes('skeleton') ||
      target.name.toLowerCase().includes('skeletal');
    if (isSkeleton) {
      mod += 1;
      notes.push('Crushing +1 vs skeleton');
    }
  }

  // Arrows -1 vs skeletons and zombies (4AD)
  if ((tags.includes('bow') || tags.includes('ranged')) && target.isUndead) {
    mod -= 1;
    notes.push('Arrows -1 vs undead (skeleton/zombie)');
  }

  return { mod, notes, blocked: false };
}

// ---------------------------------------------------------------------------
// Modificadores situacionales (sorpresa, posicionamiento)
// ---------------------------------------------------------------------------

export function getSituationalAttackMod(
  actor: Hero,
  ctx: AttackModContext = {}
): { mod: number; notes: string[]; blocked: boolean; blockReason?: string } {
  const notes: string[] = [];
  let mod = 0;

  // Pasillo: retaguardia solo puede atacar con ranged o hechizos
  if (ctx.inCorridor && ctx.attackerInRear) {
    if (!isRanged(actor)) {
      return {
        mod: 0,
        notes,
        blocked: true,
        blockReason: 'In corridor, rear rank can only attack with bow/sling or spells',
      };
    }
    notes.push('Rear rank ranged attack (corridor)');
  }

  // Sorpresa: el que sorprende actúa primero; no hay mod numérico estándar al ataque
  // (la ventaja es de iniciativa). Se documenta.
  if (ctx.isSurpriseRound) {
    notes.push('Surprise round (acts first)');
  }

  if (ctx.extra) {
    mod += ctx.extra;
    notes.push(`Extra modifier ${ctx.extra > 0 ? '+' : ''}${ctx.extra}`);
  }

  return { mod, notes, blocked: false };
}

// ---------------------------------------------------------------------------
// API principal: desglose completo
// ---------------------------------------------------------------------------

export function computeAttackModifiers(
  actor: Hero,
  target: EnemyInstance,
  ctx: AttackModContext = {}
): AttackModifierBreakdown {
  const classResult = getClassAttackMod(actor, target, ctx);
  const weaponResult = getWeaponAttackMod(actor, target);
  const situResult = getSituationalAttackMod(actor, ctx);

  if (weaponResult.blocked) {
    return {
      classMod: classResult.mod,
      weaponMod: 0,
      racialOrSpecialMod: 0,
      situationalMod: 0,
      total: 0,
      notes: [...classResult.notes, weaponResult.blockReason!],
      blocked: true,
      blockReason: weaponResult.blockReason,
    };
  }

  if (situResult.blocked) {
    return {
      classMod: classResult.mod,
      weaponMod: weaponResult.mod,
      racialOrSpecialMod: 0,
      situationalMod: 0,
      total: 0,
      notes: [...classResult.notes, ...weaponResult.notes, situResult.blockReason!],
      blocked: true,
      blockReason: situResult.blockReason,
    };
  }

  const total = classResult.mod + weaponResult.mod + situResult.mod;

  return {
    classMod: classResult.mod,
    weaponMod: weaponResult.mod,
    racialOrSpecialMod: 0,
    situationalMod: situResult.mod,
    total,
    notes: [...classResult.notes, ...weaponResult.notes, ...situResult.notes],
    blocked: false,
  };
}

/**
 * 4AD: natural 1 en el d6 base siempre falla; natural 6 siempre acierta
 * (antes de sumar modificadores / explosive).
 */
export function applyAttackNaturalRules(
  rawDie: number,
  finalValue: number,
  defenseValue: number
): { success: boolean; forced: 'hit' | 'miss' | null } {
  if (rawDie === 1) return { success: false, forced: 'miss' };
  if (rawDie === 6) return { success: true, forced: 'hit' };
  return { success: finalValue >= defenseValue, forced: null };
}
