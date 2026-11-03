/**
 * CombatResolver – resolución de ataques (4AD / GDD §7.3)
 * Usa AttackModifiers para todas las reglas especiales.
 * Puro, sin efectos secundarios.
 */

import { rollWithExplosiveSix } from './DiceService';
import {
	computeAttackModifiers,
	applyAttackNaturalRules,
	getClassAttackMod,
	getWeaponAttackMod,
	type AttackModContext,
} from './AttackModifiers';
import type { DiceResult, EnemyInstance, Hero } from '../types/combat';

export type ResolutionRequest = {
	actor: Hero;
	target: EnemyInstance;
	targetType: 'vermin' | 'minion' | 'boss' | 'weird';
	context?: AttackModContext;
	rng?: () => number;
};

export type ResolutionResult = {
	dice: DiceResult;
	finalValue: number;
	defenseValue: number;
	classModifier: number;
	equipmentModifier: number;
	situationalModifier: number;
	success: boolean;
	damage: number;
	critical: boolean;
	blocked: boolean;
	message: string;
	notes: string[];
};

export function getDefenseValue(target: EnemyInstance): number {
	return target.level;
}

/**
 * Cada bloque de `level` puntos inflige 1 herida / mata 1 minion.
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

	const mods = computeAttackModifiers(actor, target, context);

	if (mods.blocked) {
		return {
			dice: { raw: 0, explosive: [], total: 0, isExplosive: false },
			finalValue: 0,
			defenseValue: target.level,
			classModifier: mods.classMod,
			equipmentModifier: mods.weaponMod,
			situationalModifier: mods.situationalMod,
			success: false,
			damage: 0,
			critical: false,
			blocked: true,
			message: `${actor.name} no puede atacar a ${target.name}: ${mods.blockReason}`,
			notes: mods.notes,
		};
	}

	const dice = rollWithExplosiveSix(rng);
	const finalValue = dice.total + mods.total;
	const defenseValue = getDefenseValue(target);

	const { success, forced } = applyAttackNaturalRules(
		dice.raw,
		finalValue,
		defenseValue,
	);
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
		forced,
	});

	return {
		dice,
		finalValue,
		defenseValue,
		classModifier: mods.classMod,
		equipmentModifier: mods.weaponMod,
		situationalModifier: mods.situationalMod,
		success,
		damage,
		critical,
		blocked: false,
		message,
		notes: mods.notes,
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
	forced: 'hit' | 'miss' | null;
}): string {
	const diceStr = p.critical
		? `${p.dice.total} (Explosive: ${[p.dice.raw, ...p.dice.explosive].join('+')})`
		: `${p.dice.total}`;

	if (!p.success) {
		const reason = p.forced === 'miss' ? ' (natural 1)' : '';
		return `${p.actor.name} ataca a ${p.target.name}: ${diceStr} → ${p.finalValue} vs ${p.defenseValue} → FALLO${reason}`;
	}

	const isSwarm = p.targetType === 'vermin' || p.targetType === 'minion';
	const dmgStr = isSwarm
		? p.damage === 1
			? '1 muerto'
			: `${p.damage} muertos`
		: p.damage === 1
			? '1 herida'
			: `${p.damage} heridas`;

	const extra =
		(p.critical ? ' ¡CRÍTICO!' : '') +
		(p.forced === 'hit' ? ' (natural 6)' : '');
	return `${p.actor.name} ataca a ${p.target.name}: ${diceStr} → ${p.finalValue} vs ${p.defenseValue} → ÉXITO (${dmgStr})${extra}`;
}

// Wrappers de compatibilidad con la API anterior (devuelven number)
export function getClassAttackModifier(
	actor: Hero,
	target: EnemyInstance,
	context: AttackModContext = {},
): number {
	return getClassAttackMod(actor, target, context).mod;
}

export function getEquipmentAttackModifier(
	actor: Hero,
	target: EnemyInstance,
): number {
	return getWeaponAttackMod(actor, target).mod;
}
