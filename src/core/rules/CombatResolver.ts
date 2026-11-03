/**
 * CombatResolver – resolución de ataques (4AD / GDD §7.3)
 * Solo ataque básico. Puro, sin efectos secundarios.
 *
 * finalValue = dice.total + classModifier + equipmentModifiers
 * success    = finalValue >= defenseValue (level del monstruo)
 * damage     = heridas/kills según exceso sobre el level (regla 4AD)
 * critical   = dice.isExplosive
 */

import { rollWithExplosiveSix } from './DiceService';
import type { DiceResult, EnemyInstance, Hero } from '../types/combat';

export type AttackContext = {
	enemiesOutnumbered?: boolean;
	extraModifiers?: number;
};

export type ResolutionRequest = {
	actor: Hero;
	target: EnemyInstance;
	targetType: 'vermin' | 'minion' | 'boss' | 'weird';
	context?: AttackContext;
	rng?: () => number;
};

export type ResolutionResult = {
	dice: DiceResult;
	finalValue: number;
	defenseValue: number;
	classModifier: number;
	equipmentModifier: number;
	success: boolean;
	damage: number;
	critical: boolean;
	message: string;
};

/** Modificador de clase al ataque (4AD exacto) */
export function getClassAttackModifier(
	actor: Hero,
	target: EnemyInstance,
	context: AttackContext = {},
): number {
	const level = actor.level;

	switch (actor.class) {
		case 'warrior':
			return level;
		case 'cleric':
			return target.isUndead ? level : Math.floor(level / 2);
		case 'rogue':
			return context.enemiesOutnumbered ? level : 0;
		case 'wizard':
			return 0; // arma; hechizos se resuelven aparte
		default:
			return 0;
	}
}

/** Modificador de arma (two-handed +1, light -1, crushing +1 vs undead) */
export function getEquipmentAttackModifier(
	actor: Hero,
	target: EnemyInstance,
): number {
	const weapon = actor.equipment?.mainHand;
	if (!weapon) return 0;

	let mod = 0;
	const tags = (weapon as { tags?: string[] }).tags ?? [];

	if (tags.includes('two-handed')) mod += 1;
	if (tags.includes('light')) mod -= 1;
	if (tags.includes('crushing') && target.isUndead) mod += 1;

	return mod;
}

export function getDefenseValue(target: EnemyInstance): number {
	return target.level;
}

/**
 * Cada bloque de `level` puntos inflige 1 herida / mata 1 minion.
 * Ej: 8 vs level 3 → 2 kills.  9 vs level 4 → 2 heridas.
 */
export function calculateDamage(
	finalValue: number,
	defenseValue: number,
	success: boolean,
): number {
	if (!success || defenseValue <= 0) return 0;
	return Math.floor(finalValue / defenseValue);
}

export function resolveAttack(request: ResolutionRequest): ResolutionResult {
	const { actor, target, targetType, context = {}, rng } = request;

	const dice = rollWithExplosiveSix(rng);
	const classModifier = getClassAttackModifier(actor, target, context);
	const equipmentModifier = getEquipmentAttackModifier(actor, target);
	const extra = context.extraModifiers ?? 0;

	const finalValue = dice.total + classModifier + equipmentModifier + extra;
	const defenseValue = getDefenseValue(target);
	const success = finalValue >= defenseValue;
	const damage = calculateDamage(finalValue, defenseValue, success);
	const critical = dice.isExplosive;

	const message = buildMessage({
		actor,
		target,
		targetType,
		dice,
		finalValue,
		defenseValue,
		success,
		damage,
		critical,
	});

	return {
		dice,
		finalValue,
		defenseValue,
		classModifier,
		equipmentModifier,
		success,
		damage,
		critical,
		message,
	};
}

function buildMessage(p: {
	actor: Hero;
	target: EnemyInstance;
	targetType: string;
	dice: DiceResult;
	finalValue: number;
	defenseValue: number;
	success: boolean;
	damage: number;
	critical: boolean;
}): string {
	const diceStr = p.critical
		? `${p.dice.total} (Explosive: ${[p.dice.raw, ...p.dice.explosive].join('+')})`
		: `${p.dice.total}`;

	if (!p.success) {
		return `${p.actor.name} ataca a ${p.target.name}: ${diceStr} → ${p.finalValue} vs ${p.defenseValue} → FALLO`;
	}

	const isSwarm = p.targetType === 'vermin' || p.targetType === 'minion';
	const dmgStr = isSwarm
		? p.damage === 1
			? '1 muerto'
			: `${p.damage} muertos`
		: p.damage === 1
			? '1 herida'
			: `${p.damage} heridas`;

	return `${p.actor.name} ataca a ${p.target.name}: ${diceStr} → ${p.finalValue} vs ${p.defenseValue} → ÉXITO (${dmgStr})${p.critical ? ' ¡CRÍTICO!' : ''}`;
}
