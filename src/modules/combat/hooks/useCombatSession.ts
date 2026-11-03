/**
 * Hook de sesión de combate – conecta UI con core (TurnManager + StateManager)
 */

import { useCallback, useMemo, useReducer, useState } from 'react';
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
  getAliveEnemies,
} from '../../../core/rules/TurnManager';
import { createDefaultParty } from '../../../core/data/classes';
import { generateEncounter } from '../../../core/rules/EncounterGenerator';
import type { Action, CombatState } from '../../../core/types/combat';

export type DiceUiState = 'idle' | 'ready' | 'spinning' | 'result';

export type CombatSession = {
  state: CombatState;
  diceUi: DiceUiState;
  lastDiceTotal: number | null;
  encounterType: 'vermin' | 'minion' | 'boss';
  selectHeroAction: (action: Action) => void;
  selectEnemyTarget: (enemyId: string) => void;
  clear: () => void;
  /** Llamar cuando el dado está Listo: pasa a Girando y resuelve */
  resolveDice: () => void;
  /** Tras mostrar resultado, volver a Idle / siguiente paso */
  acknowledgeResult: () => void;
  canResolveNow: boolean;
};

export function useCombatSession(
  encounterType: 'vermin' | 'minion' | 'boss' = 'minion'
): CombatSession {
  const [state, setState] = useState<CombatState>(() => {
    const party = createDefaultParty();
    const enc = generateEncounter(encounterType);
    return createCombat(party, enc.enemies);
  });

  const [diceUi, setDiceUi] = useState<DiceUiState>('idle');
  const [lastDiceTotal, setLastDiceTotal] = useState<number | null>(null);
  const [pendingResult, setPendingResult] = useState<CombatState | null>(null);

  const canResolveNow = useMemo(() => canResolve(state) && diceUi === 'ready', [state, diceUi]);

  const syncDiceFromState = useCallback((s: CombatState, ui: DiceUiState) => {
    if (ui === 'spinning' || ui === 'result') return ui;
    if (canResolve(s)) return 'ready';
    return 'idle';
  }, []);

  const selectHeroAction = useCallback((action: Action) => {
    setState((prev) => {
      const next = selectAction(prev, action);
      setDiceUi(syncDiceFromState(next, 'idle'));
      return next;
    });
  }, [syncDiceFromState]);

  const selectEnemyTarget = useCallback((enemyId: string) => {
    setState((prev) => {
      const next = selectTarget(prev, enemyId);
      setDiceUi(syncDiceFromState(next, 'idle'));
      return next;
    });
  }, [syncDiceFromState]);

  const clear = useCallback(() => {
    setState((prev) => {
      const next = clearSelection(prev);
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
      setDiceUi(syncDiceFromState(next, 'idle'));
      return next;
    });
  }, [pendingResult, syncDiceFromState]);

  return {
    state,
    diceUi,
    lastDiceTotal,
    encounterType,
    selectHeroAction,
    selectEnemyTarget,
    clear,
    resolveDice,
    acknowledgeResult,
    canResolveNow,
  };
}
