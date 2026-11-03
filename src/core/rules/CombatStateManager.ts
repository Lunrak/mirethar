/**
 * CombatStateManager – estado inmutable + reducer
 * Solo lógica de estado. Sin UI ni resolución de reglas de combate.
 *
 * Flujo de fases MVP:
 *   heroTurn → (SELECT_ACTION + SELECT_TARGET) → resolution → NEXT_ACTOR / enemyTurn / ended
 */

import type {
	Action,
	CombatLogEntry,
	CombatPhase,
	CombatState,
	EnemyInstance,
	Hero,
} from '../types/combat';

// ---------------------------------------------------------------------------
// Actions del reducer
// ---------------------------------------------------------------------------

export type CombatAction =
	| {
			type: 'CREATE_COMBAT';
			payload: {
				heroes: Hero[];
				enemies: EnemyInstance[];
				positions?: { front: string[]; rear: string[] };
			};
	  }
	| { type: 'SELECT_ACTION'; payload: Action }
	| { type: 'SELECT_TARGET'; payload: string }
	| { type: 'CLEAR_SELECTION' }
	| { type: 'START_RESOLUTION' }
	| { type: 'FINISH_RESOLUTION' }
	| { type: 'NEXT_ACTOR' }
	| { type: 'END_COMBAT'; payload: { result: 'victory' | 'defeat' } }
	| { type: 'ADD_LOG'; payload: string }
	| { type: 'SET_PHASE'; payload: CombatPhase };

// ---------------------------------------------------------------------------
// Helpers puros
// ---------------------------------------------------------------------------

function createLogEntry(message: string): CombatLogEntry {
	return {
		id: `log_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
		message,
		timestamp: Date.now(),
	};
}

function getAliveHeroes(heroes: Hero[]): Hero[] {
	return heroes.filter((h) => !h.isDead && !h.isFallen && h.life > 0);
}

function getAliveEnemies(enemies: EnemyInstance[]): EnemyInstance[] {
	return enemies.filter((e) => e.currentLife > 0);
}

function buildHeroTurnOrder(heroes: Hero[]): string[] {
	return getAliveHeroes(heroes).map((h) => h.id);
}

// ---------------------------------------------------------------------------
// Estado inicial vacío
// ---------------------------------------------------------------------------

export const initialCombatState: CombatState = {
	id: '',
	round: 0,
	currentActorId: null,
	phase: 'ended',
	heroes: [],
	enemies: [],
	positions: { front: [], rear: [] },
	selectedAction: null,
	selectedTargetId: null,
	log: [],
	isFinished: true,
	result: null,
	heroTurnOrder: [],
	heroTurnIndex: 0,
};

// ---------------------------------------------------------------------------
// Reducer (puro e inmutable)
// ---------------------------------------------------------------------------

export function combatReducer(
	state: CombatState,
	action: CombatAction,
): CombatState {
	switch (action.type) {
		case 'CREATE_COMBAT': {
			const { heroes, enemies, positions } = action.payload;
			const heroTurnOrder = buildHeroTurnOrder(heroes);
			const firstHeroId = heroTurnOrder[0] ?? null;

			return {
				id: `combat_${Date.now().toString(36)}`,
				round: 1,
				currentActorId: firstHeroId,
				phase: firstHeroId ? 'heroTurn' : 'ended',
				heroes: heroes.map((h) => ({ ...h })),
				enemies: enemies.map((e) => ({ ...e })),
				positions: positions ?? {
					front: heroes.map((h) => h.id),
					rear: enemies.map((e) => e.id),
				},
				selectedAction: null,
				selectedTargetId: null,
				log: [createLogEntry('Combate iniciado')],
				isFinished: false,
				result: null,
				heroTurnOrder,
				heroTurnIndex: 0,
			};
		}

		case 'SELECT_ACTION': {
			if (state.phase !== 'heroTurn' && state.phase !== 'enemyTurn') {
				return state;
			}
			return {
				...state,
				selectedAction: action.payload,
				selectedTargetId: null,
				log: [
					...state.log,
					createLogEntry(`Acción seleccionada: ${action.payload.name}`),
				],
			};
		}

		case 'SELECT_TARGET': {
			if (!state.selectedAction) return state;
			return {
				...state,
				selectedTargetId: action.payload,
				log: [
					...state.log,
					createLogEntry(`Objetivo seleccionado: ${action.payload}`),
				],
			};
		}

		case 'CLEAR_SELECTION': {
			return {
				...state,
				selectedAction: null,
				selectedTargetId: null,
			};
		}

		case 'START_RESOLUTION': {
			if (!state.selectedAction) return state;
			if (state.selectedAction.requiresTarget && !state.selectedTargetId)
				return state;

			return {
				...state,
				phase: 'resolution',
				log: [
					...state.log,
					createLogEntry(
						`Resolviendo: ${state.selectedAction.name}` +
							(state.selectedTargetId ? ` → ${state.selectedTargetId}` : ''),
					),
				],
			};
		}

		case 'FINISH_RESOLUTION':
		case 'NEXT_ACTOR': {
			const nextIndex = state.heroTurnIndex + 1;
			const hasMoreHeroes = nextIndex < state.heroTurnOrder.length;

			if (hasMoreHeroes) {
				return {
					...state,
					phase: 'heroTurn',
					heroTurnIndex: nextIndex,
					currentActorId: state.heroTurnOrder[nextIndex],
					selectedAction: null,
					selectedTargetId: null,
					log: [
						...state.log,
						createLogEntry(`Turno de ${state.heroTurnOrder[nextIndex]}`),
					],
				};
			}

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
					log: [...state.log, createLogEntry('¡Victoria!')],
				};
			}

			return {
				...state,
				phase: 'enemyTurn',
				currentActorId: aliveEnemies[0]?.id ?? null,
				selectedAction: null,
				selectedTargetId: null,
				log: [...state.log, createLogEntry('Turno de los enemigos')],
			};
		}

		case 'END_COMBAT': {
			return {
				...state,
				phase: 'ended',
				isFinished: true,
				result: action.payload.result,
				currentActorId: null,
				selectedAction: null,
				selectedTargetId: null,
				log: [
					...state.log,
					createLogEntry(
						action.payload.result === 'victory' ? '¡Victoria!' : 'Derrota...',
					),
				],
			};
		}

		case 'ADD_LOG': {
			return {
				...state,
				log: [...state.log, createLogEntry(action.payload)],
			};
		}

		case 'SET_PHASE': {
			return {
				...state,
				phase: action.payload,
			};
		}

		default:
			return state;
	}
}

// ---------------------------------------------------------------------------
// API conveniente
// ---------------------------------------------------------------------------

export function createCombat(
	heroes: Hero[],
	enemies: EnemyInstance[],
	positions?: { front: string[]; rear: string[] },
): CombatState {
	return combatReducer(initialCombatState, {
		type: 'CREATE_COMBAT',
		payload: { heroes, enemies, positions },
	});
}

export function selectAction(state: CombatState, action: Action): CombatState {
	return combatReducer(state, { type: 'SELECT_ACTION', payload: action });
}

export function selectTarget(
	state: CombatState,
	targetId: string,
): CombatState {
	return combatReducer(state, { type: 'SELECT_TARGET', payload: targetId });
}

export function clearSelection(state: CombatState): CombatState {
	return combatReducer(state, { type: 'CLEAR_SELECTION' });
}

export function startResolution(state: CombatState): CombatState {
	return combatReducer(state, { type: 'START_RESOLUTION' });
}

export function finishResolution(state: CombatState): CombatState {
	return combatReducer(state, { type: 'FINISH_RESOLUTION' });
}

export function nextActor(state: CombatState): CombatState {
	return combatReducer(state, { type: 'NEXT_ACTOR' });
}

export function endCombat(
	state: CombatState,
	result: 'victory' | 'defeat',
): CombatState {
	return combatReducer(state, { type: 'END_COMBAT', payload: { result } });
}

export function addLog(state: CombatState, message: string): CombatState {
	return combatReducer(state, { type: 'ADD_LOG', payload: message });
}

export function canResolve(state: CombatState): boolean {
	if (!state.selectedAction) return false;
	if (state.selectedAction.requiresTarget && !state.selectedTargetId)
		return false;
	return state.phase === 'heroTurn' || state.phase === 'enemyTurn';
}
