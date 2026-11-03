/**
 * AbilityResolver – curación, hechizos y habilidades de clase
 * Mismo motor de dados (Explosive Six). Funciones puras.
 */

import { rollWithExplosiveSix, rollDice } from './DiceService';
import type { DiceResult, EnemyInstance, Hero } from '../types/combat';
import { SPELLS, type SpellId, spellIdFromName } from '../data/spells';

export type AbilityResult = {
	success: boolean;
	dice?: DiceResult;
	/** Curación o daño según habilidad */
	amount: number;
	message: string;
	/** Efectos laterales para aplicar al estado */
	effects: AbilityEffect[];
};

export type AbilityEffect =
	| { type: 'heal'; heroId: string; amount: number }
	| {
			type: 'damage_enemies';
			templateId?: string;
			count: number;
			bossDamage?: number;
			targetId?: string;
	  }
	| { type: 'consume_heal_use'; heroId: string }
	| { type: 'consume_spell'; heroId: string; spellName: string }
	| { type: 'add_status'; heroId: string; statusId: string; name: string }
	| { type: 'escape'; heroId: string };

// ---------------------------------------------------------------------------
// Cleric Healing (4AD: d6 + level, 3 uses/adventure, no attack same turn)
// ---------------------------------------------------------------------------

export function resolveHeal(
	cleric: Hero,
	target: Hero,
	rng?: () => number,
): AbilityResult {
	if (cleric.class !== 'cleric') {
		return {
			success: false,
			amount: 0,
			message: 'Solo el Clérigo puede curar.',
			effects: [],
		};
	}
	if ((cleric.healingUsesLeft ?? 0) <= 0) {
		return {
			success: false,
			amount: 0,
			message: 'No quedan usos de Healing.',
			effects: [],
		};
	}
	if (target.isDead) {
		return {
			success: false,
			amount: 0,
			message: 'No se puede curar a un muerto.',
			effects: [],
		};
	}

	const dice = rollWithExplosiveSix(rng);
	const amount = dice.total + cleric.level;
	const actualHeal = Math.min(amount, target.maxLife - target.life);

	return {
		success: true,
		dice,
		amount: actualHeal,
		message: `${cleric.name} cura a ${target.name}: ${dice.total}+${cleric.level}=${amount} → +${actualHeal} life`,
		effects: [
			{ type: 'heal', heroId: target.id, amount: actualHeal },
			{ type: 'consume_heal_use', heroId: cleric.id },
		],
	};
}

// ---------------------------------------------------------------------------
// Wizard / Cleric spells
// ---------------------------------------------------------------------------

export function resolveSpell(
	caster: Hero,
	spellName: string,
	opts: {
		targetEnemy?: EnemyInstance;
		targetHero?: Hero;
		enemies?: EnemyInstance[];
		targetType?: 'vermin' | 'minion' | 'boss' | 'weird';
		rng?: () => number;
	} = {},
): AbilityResult {
	const spellId = spellIdFromName(spellName);
	if (!spellId) {
		return {
			success: false,
			amount: 0,
			message: `Hechizo desconocido: ${spellName}`,
			effects: [],
		};
	}

	const def = SPELLS[spellId];
	if (!def.casters.includes(caster.class as 'wizard' | 'cleric')) {
		return {
			success: false,
			amount: 0,
			message: `${caster.name} no puede lanzar ${def.name}.`,
			effects: [],
		};
	}

	// ¿Lo tiene preparado?
	const prepared = caster.spells?.some(
		(s) =>
			s.toLowerCase() === def.name.toLowerCase() ||
			spellIdFromName(s) === spellId,
	);
	if (caster.class === 'wizard' && !prepared && spellId !== 'blessing') {
		// Permitimos blessing siempre si está en lista; si no tiene spells, fallar
		if (!caster.spells || caster.spells.length === 0) {
			return {
				success: false,
				amount: 0,
				message: 'No hay hechizos preparados.',
				effects: [],
			};
		}
	}

	switch (spellId) {
		case 'fireball':
			return resolveFireball(caster, opts);
		case 'lightning_bolt':
			return resolveLightningBolt(caster, opts);
		case 'sleep':
			return resolveSleep(caster, opts);
		case 'protect':
			return resolveProtect(caster, opts);
		case 'blessing':
			return resolveBlessing(caster, opts);
		case 'escape':
			return {
				success: true,
				amount: 0,
				message: `${caster.name} lanza Escape y desaparece del combate.`,
				effects: [
					{ type: 'escape', heroId: caster.id },
					{ type: 'consume_spell', heroId: caster.id, spellName: def.name },
				],
			};
		default:
			return {
				success: false,
				amount: 0,
				message: 'Hechizo no implementado.',
				effects: [],
			};
	}
}

function resolveFireball(
	caster: Hero,
	opts: { enemies?: EnemyInstance[]; targetType?: string; rng?: () => number },
): AbilityResult {
	const dice = rollWithExplosiveSix(opts.rng);
	const finalValue = dice.total + caster.level; // wizard adds level to spells
	const enemies = (opts.enemies ?? []).filter((e) => e.currentLife > 0);
	if (enemies.length === 0) {
		return {
			success: false,
			dice,
			amount: 0,
			message: 'No hay enemigos.',
			effects: [],
		};
	}

	const level = enemies[0].level;
	const isBoss = opts.targetType === 'boss' || opts.targetType === 'weird';

	if (isBoss) {
		// Fireball vs boss: treat as attack for 1+ wounds via excess
		const success = finalValue >= level;
		const wounds = success ? Math.max(1, Math.floor(finalValue / level)) : 0;
		return {
			success,
			dice,
			amount: wounds,
			message: success
				? `${caster.name} Fireball: ${dice.total}+${caster.level}=${finalValue} vs ${level} → ${wounds} herida(s)`
				: `${caster.name} Fireball: ${finalValue} vs ${level} → FALLO`,
			effects: success
				? [
						{
							type: 'damage_enemies',
							targetId: enemies[0].id,
							count: 0,
							bossDamage: wounds,
						},
						{ type: 'consume_spell', heroId: caster.id, spellName: 'Fireball' },
					]
				: [{ type: 'consume_spell', heroId: caster.id, spellName: 'Fireball' }],
		};
	}

	// Minions: kills = max(1, roll - level) if finalValue conceptually hits
	// 4AD: "die roll minus the level of the minions. A minimum of one creature is always slain."
	// Interpreting: if the attack "works" - actually the example is roll 5+1=6, 6-3=3 goblins
	// So kills = max(1, finalValue - level) always when casting at minions (always at least 1)
	const kills = Math.max(1, finalValue - level);

	return {
		success: true,
		dice,
		amount: kills,
		message: `${caster.name} Fireball: ${dice.total}+${caster.level}=${finalValue} − lvl ${level} → ${kills} muerto(s)`,
		effects: [
			{
				type: 'damage_enemies',
				templateId: enemies[0].templateId,
				count: kills,
			},
			{ type: 'consume_spell', heroId: caster.id, spellName: 'Fireball' },
		],
	};
}

function resolveLightningBolt(
	caster: Hero,
	opts: {
		targetEnemy?: EnemyInstance;
		enemies?: EnemyInstance[];
		targetType?: string;
		rng?: () => number;
	},
): AbilityResult {
	const dice = rollWithExplosiveSix(opts.rng);
	const finalValue = dice.total + caster.level;
	const target =
		opts.targetEnemy ?? opts.enemies?.find((e) => e.currentLife > 0);
	if (!target) {
		return { success: false, amount: 0, message: 'Sin objetivo.', effects: [] };
	}

	const success = finalValue >= target.level;
	const isBoss = opts.targetType === 'boss' || opts.targetType === 'weird';

	if (!success) {
		return {
			success: false,
			dice,
			amount: 0,
			message: `${caster.name} Lightning Bolt: ${finalValue} vs ${target.level} → FALLO`,
			effects: [
				{
					type: 'consume_spell',
					heroId: caster.id,
					spellName: 'Lightning Bolt',
				},
			],
		};
	}

	if (isBoss) {
		return {
			success: true,
			dice,
			amount: 2,
			message: `${caster.name} Lightning Bolt: ${finalValue} vs ${target.level} → 2 heridas`,
			effects: [
				{
					type: 'damage_enemies',
					targetId: target.id,
					count: 0,
					bossDamage: 2,
				},
				{
					type: 'consume_spell',
					heroId: caster.id,
					spellName: 'Lightning Bolt',
				},
			],
		};
	}

	return {
		success: true,
		dice,
		amount: 1,
		message: `${caster.name} Lightning Bolt: ${finalValue} vs ${target.level} → 1 muerto`,
		effects: [
			{
				type: 'damage_enemies',
				templateId: target.templateId,
				count: 1,
				targetId: target.id,
			},
			{ type: 'consume_spell', heroId: caster.id, spellName: 'Lightning Bolt' },
		],
	};
}

function resolveSleep(
	caster: Hero,
	opts: {
		targetEnemy?: EnemyInstance;
		enemies?: EnemyInstance[];
		targetType?: string;
		rng?: () => number;
	},
): AbilityResult {
	const enemies = (opts.enemies ?? []).filter((e) => e.currentLife > 0);
	const target = opts.targetEnemy ?? enemies[0];
	if (!target) {
		return { success: false, amount: 0, message: 'Sin objetivo.', effects: [] };
	}

	if (target.isUndead) {
		return {
			success: false,
			amount: 0,
			message: 'Sleep no afecta a no-muertos.',
			effects: [
				{ type: 'consume_spell', heroId: caster.id, spellName: 'Sleep' },
			],
		};
	}

	const dice = rollWithExplosiveSix(opts.rng);
	const finalValue = dice.total + caster.level;
	const success = finalValue >= target.level;
	const isBoss = opts.targetType === 'boss' || opts.targetType === 'weird';

	if (!success) {
		return {
			success: false,
			dice,
			amount: 0,
			message: `${caster.name} Sleep: ${finalValue} vs ${target.level} → FALLO`,
			effects: [
				{ type: 'consume_spell', heroId: caster.id, spellName: 'Sleep' },
			],
		};
	}

	if (isBoss) {
		return {
			success: true,
			dice,
			amount: target.currentLife,
			message: `${caster.name} Sleep: derrota al boss.`,
			effects: [
				{
					type: 'damage_enemies',
					targetId: target.id,
					count: 0,
					bossDamage: target.currentLife,
				},
				{ type: 'consume_spell', heroId: caster.id, spellName: 'Sleep' },
			],
		};
	}

	const sleepCount = rollDice(1, 6, opts.rng) + caster.level;
	return {
		success: true,
		dice,
		amount: sleepCount,
		message: `${caster.name} Sleep: ${sleepCount} minions derrotados.`,
		effects: [
			{
				type: 'damage_enemies',
				templateId: target.templateId,
				count: sleepCount,
			},
			{ type: 'consume_spell', heroId: caster.id, spellName: 'Sleep' },
		],
	};
}

function resolveProtect(
	caster: Hero,
	opts: { targetHero?: Hero },
): AbilityResult {
	const target = opts.targetHero ?? caster;
	return {
		success: true,
		amount: 1,
		message: `${caster.name} lanza Protect sobre ${target.name} (+1 Defense este combate).`,
		effects: [
			{
				type: 'add_status',
				heroId: target.id,
				statusId: 'protect',
				name: 'Protect +1 Defense',
			},
			{ type: 'consume_spell', heroId: caster.id, spellName: 'Protect' },
		],
	};
}

function resolveBlessing(
	caster: Hero,
	opts: { targetHero?: Hero },
): AbilityResult {
	const target = opts.targetHero ?? caster;
	return {
		success: true,
		amount: 0,
		message: `${caster.name} lanza Blessing sobre ${target.name} (elimina maldición/petrificación).`,
		effects: [
			{
				type: 'add_status',
				heroId: target.id,
				statusId: 'blessed',
				name: 'Blessed',
			},
			{ type: 'consume_spell', heroId: caster.id, spellName: 'Blessing' },
		],
	};
}

// ---------------------------------------------------------------------------
// Aplicar effects al estado (puro)
// ---------------------------------------------------------------------------

export function applyAbilityEffects(
	heroes: Hero[],
	enemies: EnemyInstance[],
	effects: AbilityEffect[],
): { heroes: Hero[]; enemies: EnemyInstance[] } {
	let h = heroes.map((x) => ({
		...x,
		status: [...x.status],
		spells: x.spells ? [...x.spells] : undefined,
	}));
	let e = enemies.map((x) => ({ ...x }));

	for (const effect of effects) {
		switch (effect.type) {
			case 'heal': {
				const hero = h.find((x) => x.id === effect.heroId);
				if (hero) {
					hero.life = Math.min(hero.maxLife, hero.life + effect.amount);
					if (hero.life > 0) {
						hero.isFallen = false;
					}
				}
				break;
			}
			case 'consume_heal_use': {
				const hero = h.find((x) => x.id === effect.heroId);
				if (hero && hero.healingUsesLeft != null) {
					hero.healingUsesLeft = Math.max(0, hero.healingUsesLeft - 1);
				}
				break;
			}
			case 'consume_spell': {
				// MVP: no eliminamos el hechizo de la lista (se puede spamear en combate
				// como en 4AD prepared spells are per adventure uses - simplified: keep prepared)
				break;
			}
			case 'damage_enemies': {
				if (effect.bossDamage && effect.targetId) {
					const t = e.find((x) => x.id === effect.targetId);
					if (t) t.currentLife = Math.max(0, t.currentLife - effect.bossDamage);
				} else if (effect.count > 0) {
					let remaining = effect.count;
					const group = e.filter(
						(x) =>
							x.currentLife > 0 &&
							(!effect.templateId || x.templateId === effect.templateId) &&
							(!effect.targetId ||
								x.id === effect.targetId ||
								x.templateId === effect.templateId),
					);
					// Prefer targetId first
					if (effect.targetId) {
						const t = group.find((x) => x.id === effect.targetId);
						if (t && remaining > 0) {
							t.currentLife = 0;
							remaining--;
						}
					}
					for (const m of group) {
						if (remaining <= 0) break;
						if (m.currentLife <= 0) continue;
						m.currentLife = 0;
						remaining--;
					}
				}
				break;
			}
			case 'add_status': {
				const hero = h.find((x) => x.id === effect.heroId);
				if (hero && !hero.status.some((s) => s.id === effect.statusId)) {
					hero.status.push({ id: effect.statusId, name: effect.name });
				}
				break;
			}
			case 'escape': {
				const hero = h.find((x) => x.id === effect.heroId);
				if (hero) {
					hero.status.push({ id: 'escaped', name: 'Escaped' });
					// Treat as out of fight
					hero.isFallen = true;
				}
				break;
			}
		}
	}

	return { heroes: h, enemies: e };
}
