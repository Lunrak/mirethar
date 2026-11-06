/**
 * Hook de sesión de combate – conecta UI con core (TurnManager + StateManager)
 */

import { useCallback, useMemo, useState } from 'react';
import {
	createCombat,
	selectAction,
	selectTarget,
	clearSelection,
	canResolve,
} from '../../../core/rules/CombatStateManager';
import {
	executeHeroAttack,
	executeHeal,
	executeSpell,
	runEnemyTurn,
} from '../../../core/rules/TurnManager';
import { createDefaultParty } from '../../../core/data/classes';
import { generateEncounter } from '../../../core/rules/EncounterGenerator';
import type {
	Action,
	CombatState,
	EnemyInstance,
} from '../../../core/types/combat';

export type DiceUiState = 'idle' | 'ready' | 'spinning' | 'result';

export type CombatSession = {
	state: CombatState;
	diceUi: DiceUiState;
	lastDiceTotal: number | null;
	encounterType: 'vermin' | 'minion' | 'boss';
	/** True cuando el objetivo enemigo se eligió solo (grupo homogéneo / un solo vivo) */
	targetAutoSelected: boolean;
	selectHeroAction: (action: Action) => void;
	selectEnemyTarget: (enemyId: string) => void;
	clear: () => void;
	/** Llamar cuando el dado está Listo: pasa a Girando y resuelve */
	resolveDice: () => void;
	/** Tras mostrar resultado, volver a Idle / siguiente paso */
	acknowledgeResult: () => void;
	canResolveNow: boolean;
};

/**
 * ¿Hay que forzar al jugador a elegir enemigo?
 * Solo si hay ≥2 enemigos vivos Y no todos son del mismo tipo (templateId / name+level).
 * En 4AD, un grupo de goblins idénticos no requiere elegir "cuál" goblin matas.
 */
function needsManualEnemyTarget(enemies: EnemyInstance[]): boolean {
	const alive = enemies.filter((e) => e.currentLife > 0);
	if (alive.length <= 1) return false;
	const key = (e: EnemyInstance) => e.templateId || `${e.name}|${e.level}`;
	const first = key(alive[0]);
	return alive.some((e) => key(e) !== first);
}

function firstAliveEnemyId(enemies: EnemyInstance[]): string | null {
	const alive = enemies.find((e) => e.currentLife > 0);
	return alive?.id ?? null;
}

export function useCombatSession(
	encounterType: 'vermin' | 'minion' | 'boss' = 'minion',
): CombatSession {
	const [state, setState] = useState<CombatState>(() => {
		const party = createDefaultParty();
		const enc = generateEncounter(encounterType);
		return createCombat(party, enc.enemies);
	});

	const [diceUi, setDiceUi] = useState<DiceUiState>('idle');
	const [lastDiceTotal, setLastDiceTotal] = useState<number | null>(null);
	const [pendingResult, setPendingResult] = useState<CombatState | null>(null);
	const [targetAutoSelected, setTargetAutoSelected] = useState(false);

	const canResolveNow = useMemo(
		() => canResolve(state) && diceUi === 'ready',
		[state, diceUi],
	);

	const syncDiceFromState = useCallback((s: CombatState, ui: DiceUiState) => {
		if (ui === 'spinning' || ui === 'result') return ui;
		if (canResolve(s)) return 'ready';
		return 'idle';
	}, []);

	const selectHeroAction = useCallback(
		(action: Action) => {
			setState((prev) => {
				let next = selectAction(prev, action);
				let auto = false;

				// Auto-objetivo para ataques/spells a enemigos cuando no hay diferencia real
				// (un solo vivo, o todos del mismo tipo → según 4AD no importa cuál muere)
				if (
					action.requiresTarget &&
					(action.type === 'attack' || action.type === 'spell')
				) {
					if (!needsManualEnemyTarget(next.enemies)) {
						const id = firstAliveEnemyId(next.enemies);
						if (id) {
							next = selectTarget(next, id);
							auto = true;
						}
					}
				}

				setTargetAutoSelected(auto);
				setDiceUi(syncDiceFromState(next, 'idle'));
				return next;
			});
		},
		[syncDiceFromState],
	);

	const selectEnemyTarget = useCallback(
		(enemyId: string) => {
			setState((prev) => {
				const next = selectTarget(prev, enemyId);
				setTargetAutoSelected(false);
				setDiceUi(syncDiceFromState(next, 'idle'));
				return next;
			});
		},
		[syncDiceFromState],
	);

	const clear = useCallback(() => {
		setState((prev) => {
			const next = clearSelection(prev);
			setTargetAutoSelected(false);
			setDiceUi('idle');
			return next;
		});
	}, []);

	const resolveDice = useCallback(() => {
		setState((prev) => {
			if (!canResolve(prev) || prev.isFinished) return prev;

			setDiceUi('spinning');

			// Resolución síncrona; la UI muestra "Girando" un momento vía acknowledge
			const actionType = prev.selectedAction?.type ?? 'attack';
			let next = prev;

			if (actionType === 'attack') {
				next = executeHeroAttack(prev, encounterType);
			} else if (actionType === 'heal') {
				next = executeHeal(prev);
			} else if (actionType === 'spell') {
				next = executeSpell(prev, encounterType);
			} else {
				// defend etc.
				next = executeHeroAttack(prev, encounterType); // fallback
			}

			// Extraer último total de dado del mensaje si es posible — placeholder
			setLastDiceTotal(null);
			setPendingResult(next);
			setDiceUi('result');

			// Si tras el turno de héroes toca enemigos, se procesa al acknowledge
			return next;
		});
	}, [encounterType]);

	const acknowledgeResult = useCallback(() => {
		setState((prev) => {
			let next = pendingResult ?? prev;
			setPendingResult(null);

			if (!next.isFinished && next.phase === 'enemyTurn') {
				next = runEnemyTurn(next);
			}

			setLastDiceTotal(null);
			setTargetAutoSelected(false);
			setDiceUi(syncDiceFromState(next, 'idle'));
			return next;
		});
	}, [pendingResult, syncDiceFromState]);

	return {
		state,
		diceUi,
		lastDiceTotal,
		encounterType,
		targetAutoSelected,
		selectHeroAction,
		selectEnemyTarget,
		clear,
		resolveDice,
		acknowledgeResult,
		canResolveNow,
	};
}
