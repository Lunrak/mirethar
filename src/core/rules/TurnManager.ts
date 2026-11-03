/**
 * TurnManager – sistema de turnos completo 4AD
 *
 * Flujo:
 *  1. heroTurn (cada héroe vivo en marching order)
 *  2. resolution del ataque del héroe → aplica daño
 *  3. cuando no quedan héroes en la ronda → enemyTurn
 *  4. enemigos atacan automáticamente (el héroe tira Defense)
 *  5. fin de ronda → nueva ronda de héroes o ended
 *
 * Victoria: todos los enemigos a 0 life
 * Derrota: todos los héroes caídos/muertos
 */

import { resolveAttack } from './CombatResolver';
import { resolveDefense } from './DefenseCalculator';
import {
	resolveHeal,
	resolveSpell,
	applyAbilityEffects,
} from './AbilityResolver';
import type { AttackModContext } from './AttackModifiers';
import type {
	Action,
	CombatLogEntry,
	CombatState,
	EnemyInstance,
	Hero,
} from '../types/combat';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(message: string): CombatLogEntry {
	return {
		id: `log_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
		message,
		timestamp: Date.now(),
	};
}

export function getAliveHeroes(heroes: Hero[]): Hero[] {
	return heroes.filter((h) => !h.isDead && !h.isFallen && h.life > 0);
}

export function getAliveEnemies(enemies: EnemyInstance[]): EnemyInstance[] {
	return enemies.filter((e) => e.currentLife > 0);
}

function rebuildHeroTurnOrder(heroes: Hero[]): string[] {
	return getAliveHeroes(heroes).map((h) => h.id);
}

/** ¿La party supera en número al grupo enemigo vivo? */
export function isPartyOutnumbering(state: CombatState): boolean {
	return (
		getAliveHeroes(state.heroes).length > getAliveEnemies(state.enemies).length
	);
}

function checkEndCondition(state: CombatState): CombatState {
	const aliveHeroes = getAliveHeroes(state.heroes);
	const aliveEnemies = getAliveEnemies(state.enemies);

	if (aliveEnemies.length === 0) {
		return {
			...state,
			phase: 'ended',
			isFinished: true,
			result: 'victory',
			currentActorId: null,
			selectedAction: null,
			selectedTargetId: null,
			log: [...state.log, log('¡Victoria! Todos los enemigos derrotados.')],
		};
	}

	if (aliveHeroes.length === 0) {
		return {
			...state,
			phase: 'ended',
			isFinished: true,
			result: 'defeat',
			currentActorId: null,
			selectedAction: null,
			selectedTargetId: null,
			log: [...state.log, log('Derrota... Todos los héroes han caído.')],
		};
	}

	return state;
}

// ---------------------------------------------------------------------------
// Aplicar daño de ataque de héroe a enemigos
// ---------------------------------------------------------------------------

/**
 * Aplica el resultado de resolveAttack al estado.
 * - Minions/vermin: elimina `damage` enemigos del mismo template (o reduce life).
 * - Boss: resta `damage` a currentLife; si llega a 0, muere.
 * - Héroes no cambian en esta función.
 */
export function applyHeroAttack(
	state: CombatState,
	targetId: string,
	damage: number,
	targetType: 'vermin' | 'minion' | 'boss' | 'weird',
	message: string,
): CombatState {
	let enemies = state.enemies.map((e) => ({ ...e }));
	const target = enemies.find((e) => e.id === targetId);

	if (!target || damage <= 0) {
		return {
			...state,
			phase: 'resolution',
			log: [...state.log, log(message)],
			selectedAction: null,
			selectedTargetId: null,
		};
	}

	if (targetType === 'boss' || targetType === 'weird') {
		// Boss: restar heridas a un único objetivo
		target.currentLife = Math.max(0, target.currentLife - damage);
	} else {
		// Vermin/minion: cada uno tiene 1 life → matar `damage` unidades del mismo grupo
		// Primero mata al target, luego a otros del mismo templateId
		let remaining = damage;
		const sameGroup = enemies.filter(
			(e) => e.templateId === target.templateId && e.currentLife > 0,
		);

		for (const e of sameGroup) {
			if (remaining <= 0) break;
			e.currentLife = 0;
			remaining--;
		}
	}

	let next: CombatState = {
		...state,
		enemies,
		phase: 'resolution',
		log: [...state.log, log(message)],
		selectedAction: null,
		selectedTargetId: null,
	};

	return checkEndCondition(next);
}

// ---------------------------------------------------------------------------
// Avanzar al siguiente héroe o a enemyTurn / nueva ronda
// ---------------------------------------------------------------------------

export function advanceAfterHeroAction(state: CombatState): CombatState {
	if (state.isFinished) return state;

	const order = state.heroTurnOrder;
	const nextIndex = state.heroTurnIndex + 1;

	if (nextIndex < order.length) {
		// Siguiente héroe vivo en la ronda
		const nextId = order[nextIndex];
		const hero = state.heroes.find((h) => h.id === nextId);
		// Si el héroe murió en medio (no debería en su propio turno), saltar
		if (!hero || hero.isFallen || hero.isDead || hero.life <= 0) {
			return advanceAfterHeroAction({
				...state,
				heroTurnIndex: nextIndex,
				currentActorId: nextId,
			});
		}

		return {
			...state,
			phase: 'heroTurn',
			heroTurnIndex: nextIndex,
			currentActorId: nextId,
			selectedAction: null,
			selectedTargetId: null,
			log: [...state.log, log(`Turno de ${hero.name}`)],
		};
	}

	// Fin de turnos de héroes → turno enemigo
	return {
		...state,
		phase: 'enemyTurn',
		currentActorId: null,
		selectedAction: null,
		selectedTargetId: null,
		log: [...state.log, log('— Turno de los enemigos —')],
	};
}

// ---------------------------------------------------------------------------
// Resolver ataque de un héroe (orquesta resolveAttack + apply + advance)
// ---------------------------------------------------------------------------

export function executeHeroAttack(
	state: CombatState,
	targetType: 'vermin' | 'minion' | 'boss' | 'weird',
	ctx: AttackModContext = {},
	rng?: () => number,
): CombatState {
	if (state.phase !== 'heroTurn' && state.phase !== 'resolution') {
		return state;
	}
	if (!state.selectedAction || !state.selectedTargetId) return state;

	const actor = state.heroes.find((h) => h.id === state.currentActorId);
	const target = state.enemies.find((e) => e.id === state.selectedTargetId);
	if (!actor || !target) return state;

	const fullCtx: AttackModContext = {
		...ctx,
		enemiesOutnumbered: ctx.enemiesOutnumbered ?? isPartyOutnumbering(state),
	};

	const result = resolveAttack({
		actor,
		target,
		targetType,
		context: fullCtx,
		rng,
	});

	let next = applyHeroAttack(
		state,
		target.id,
		result.damage,
		targetType,
		result.message,
	);

	if (next.isFinished) return next;

	// Avanzar al siguiente actor
	return advanceAfterHeroAction(next);
}

// ---------------------------------------------------------------------------
// Turno de enemigos: atacan automáticamente
// ---------------------------------------------------------------------------

/**
 * Quién recibe el ataque (reglas 4AD simplificadas para room):
 * - Si hay tantos o más enemigos que héroes: 1 ataque por héroe (+ extras al azar)
 * - Si hay menos enemigos: cada enemigo ataca a un héroe distinto (jugador elige → aquí al primero vivo)
 * MVP: cada enemigo vivo realiza `attacks` ataques contra héroes vivos en orden de marcha (front first).
 */
export function runEnemyTurn(
	state: CombatState,
	opts: { inCorridor?: boolean; rng?: () => number } = {},
): CombatState {
	if (state.phase !== 'enemyTurn' || state.isFinished) return state;

	let heroes = state.heroes.map((h) => ({ ...h }));
	let logEntries = [...state.log];
	const aliveEnemies = getAliveEnemies(state.enemies);

	// Orden de objetivos: marching order (front primero, luego rear)
	const marchOrder = [
		...state.positions.front,
		...state.positions.rear.filter((id) => !state.positions.front.includes(id)),
	];
	// Fallback: orden del array de héroes
	const targetOrder =
		marchOrder.length > 0 ? marchOrder : heroes.map((h) => h.id);

	let targetCursor = 0;

	for (const enemy of aliveEnemies) {
		const attackCount = Math.max(1, enemy.attacks ?? 1);

		for (let a = 0; a < attackCount; a++) {
			// Buscar siguiente héroe vivo
			let target: Hero | undefined;
			for (let t = 0; t < targetOrder.length; t++) {
				const idx = (targetCursor + t) % targetOrder.length;
				const candidate = heroes.find(
					(h) =>
						h.id === targetOrder[idx] && !h.isDead && !h.isFallen && h.life > 0,
				);
				if (candidate) {
					target = candidate;
					targetCursor = (idx + 1) % targetOrder.length;
					break;
				}
			}
			if (!target) break; // no quedan héroes

			// Ogre y similares infligen 2 heridas
			const woundsOnHit =
				enemy.templateId === 'boss_ogre' || enemy.name === 'Ogre' ? 2 : 1;

			const defResult = resolveDefense(
				target,
				enemy.level,
				{
					surpriseAttack: false,
					rng: opts.rng,
				},
				woundsOnHit,
			);

			logEntries.push(
				log(`${enemy.name} ataca a ${target.name}: ${defResult.message}`),
			);

			if (!defResult.success) {
				const heroIdx = heroes.findIndex((h) => h.id === target!.id);
				const h = { ...heroes[heroIdx] };
				h.life = Math.max(0, h.life - defResult.damageTaken);
				if (h.life <= 0) {
					h.isFallen = true;
					logEntries.push(log(`${h.name} ha caído (0 life).`));
				}
				heroes[heroIdx] = h;
			}
		}
	}

	let next: CombatState = {
		...state,
		heroes,
		log: logEntries,
	};

	next = checkEndCondition(next);
	if (next.isFinished) return next;

	// Nueva ronda de héroes
	const newOrder = rebuildHeroTurnOrder(next.heroes);
	if (newOrder.length === 0) {
		return checkEndCondition(next);
	}

	return {
		...next,
		phase: 'heroTurn',
		round: state.round + 1,
		heroTurnOrder: newOrder,
		heroTurnIndex: 0,
		currentActorId: newOrder[0],
		selectedAction: null,
		selectedTargetId: null,
		log: [
			...next.log,
			log(
				`— Ronda ${state.round + 1} — Turno de ${next.heroes.find((h) => h.id === newOrder[0])?.name}`,
			),
		],
	};
}

// ---------------------------------------------------------------------------
// API de alto nivel: un paso de combate
// ---------------------------------------------------------------------------

/**
 * Ejecuta la acción seleccionada del héroe actual y avanza el turno.
 * Tipos: attack | heal | spell | defend
 */
export function resolveCurrentHeroAction(
	state: CombatState,
	targetType: 'vermin' | 'minion' | 'boss' | 'weird',
	rng?: () => number,
): CombatState {
	if (!state.selectedAction) return state;

	const actionType = state.selectedAction.type;

	if (actionType === 'attack') {
		return executeHeroAttack(state, targetType, {}, rng);
	}

	if (actionType === 'heal') {
		return executeHeal(state, rng);
	}

	if (actionType === 'spell') {
		return executeSpell(state, targetType, rng);
	}

	// Defend u otras acciones: consumen el turno
	const next = {
		...state,
		log: [
			...state.log,
			log(
				`${state.heroes.find((h) => h.id === state.currentActorId)?.name} se defiende.`,
			),
		],
		selectedAction: null,
		selectedTargetId: null,
		phase: 'resolution' as const,
	};
	return advanceAfterHeroAction(next);
}

// ---------------------------------------------------------------------------
// Curación y hechizos
// ---------------------------------------------------------------------------

export function executeHeal(
	state: CombatState,
	rng?: () => number,
): CombatState {
	const cleric = state.heroes.find((h) => h.id === state.currentActorId);
	if (!cleric) return state;

	const targetId = state.selectedTargetId ?? cleric.id;
	const target = state.heroes.find((h) => h.id === targetId) ?? cleric;

	const result = resolveHeal(cleric, target, rng);
	const applied = applyAbilityEffects(
		state.heroes,
		state.enemies,
		result.effects,
	);

	let next: CombatState = {
		...state,
		heroes: applied.heroes,
		enemies: applied.enemies,
		log: [...state.log, log(result.message)],
		selectedAction: null,
		selectedTargetId: null,
		phase: 'resolution',
	};

	next = checkEndCondition(next);
	if (next.isFinished) return next;
	return advanceAfterHeroAction(next);
}

export function executeSpell(
	state: CombatState,
	targetType: 'vermin' | 'minion' | 'boss' | 'weird',
	rng?: () => number,
): CombatState {
	const caster = state.heroes.find((h) => h.id === state.currentActorId);
	if (!caster || !state.selectedAction) return state;

	// El nombre del hechizo va en action.name (ej. "Fireball")
	const spellName = state.selectedAction.name;
	const targetEnemy = state.enemies.find(
		(e) => e.id === state.selectedTargetId,
	);
	const targetHero = state.heroes.find((h) => h.id === state.selectedTargetId);

	const result = resolveSpell(caster, spellName, {
		targetEnemy,
		targetHero,
		enemies: state.enemies,
		targetType,
		rng,
	});

	const applied = applyAbilityEffects(
		state.heroes,
		state.enemies,
		result.effects,
	);

	let next: CombatState = {
		...state,
		heroes: applied.heroes,
		enemies: applied.enemies,
		log: [...state.log, log(result.message)],
		selectedAction: null,
		selectedTargetId: null,
		phase: 'resolution',
	};

	next = checkEndCondition(next);
	if (next.isFinished) return next;
	return advanceAfterHeroAction(next);
}
