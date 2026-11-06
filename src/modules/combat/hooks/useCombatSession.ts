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
import type { Action, CombatState, EnemyInstance } from '../../../core/types/combat';
import type { CombatFeedbackData, FeedbackKind } from '../components/CombatFeedback';

export type DiceUiState = 'idle' | 'ready' | 'spinning' | 'result';

export type CombatSession = {
  state: CombatState;
  diceUi: DiceUiState;
  lastDiceTotal: number | null;
  encounterType: 'vermin' | 'minion' | 'boss';
  /** True cuando el objetivo enemigo se eligió solo (grupo homogéneo / un solo vivo) */
  targetAutoSelected: boolean;
  /** Feedback visual de la última resolución (números flotantes + texto) */
  lastFeedback: CombatFeedbackData | null;
  /** Actor / objetivo capturados en el momento de resolver (para zoom) */
  focusActorId: string | null;
  focusTargetId: string | null;
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

function sumEnemyLife(enemies: EnemyInstance[]): number {
  return enemies.reduce((s, e) => s + Math.max(0, e.currentLife), 0);
}

function sumHeroLife(heroes: CombatState['heroes']): number {
  return heroes.reduce((s, h) => s + Math.max(0, h.life), 0);
}

/** Construye feedback visual comparando estado antes/después + último mensaje de log */
function buildFeedback(
  before: CombatState,
  after: CombatState,
  actionType: string
): CombatFeedbackData {
  const lastMsg = after.log[after.log.length - 1]?.message ?? '';
  const actorId = before.currentActorId;
  const targetId = before.selectedTargetId;

  const enemyDelta = sumEnemyLife(before.enemies) - sumEnemyLife(after.enemies);
  const heroDelta = sumHeroLife(after.heroes) - sumHeroLife(before.heroes);

  const isMiss =
    /FALLO/i.test(lastMsg) ||
    (actionType === 'attack' && enemyDelta <= 0 && !/ÉXITO|herida|muerto/i.test(lastMsg));
  const isCrit = /CRÍTICO|Explosive/i.test(lastMsg);
  const isHeal = actionType === 'heal' || heroDelta > 0;

  let kind: FeedbackKind = 'info';
  let amount = 0;
  let headline = '…';

  if (isHeal && heroDelta > 0) {
    kind = 'heal';
    amount = heroDelta;
    headline = `+${heroDelta}`;
  } else if (isMiss) {
    kind = 'miss';
    amount = 0;
    headline = 'FALLO';
  } else if (enemyDelta > 0) {
    kind = isCrit ? 'critical' : 'damage';
    amount = enemyDelta;
    headline = isCrit ? '¡CRÍTICO!' : 'ÉXITO';
  } else if (/ÉXITO/i.test(lastMsg)) {
    kind = isCrit ? 'critical' : 'damage';
    amount = Math.max(1, enemyDelta);
    headline = isCrit ? '¡CRÍTICO!' : 'ÉXITO';
  } else if (/defiende/i.test(lastMsg)) {
    kind = 'info';
    headline = 'DEFENSA';
  } else {
    kind = 'info';
    headline = actionType === 'spell' ? 'HECHIZO' : 'RESULTADO';
  }

  return {
    id: `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    kind,
    amount,
    headline,
    detail: lastMsg,
    actorId,
    targetId,
  };
}

/** Intenta extraer el total de dados del mensaje de log (ej. "5 → 9 vs 3") */
function parseDiceTotal(message: string): number | null {
  // Patrones típicos: "5 →", "11 (Explosive: 6+5) →"
  const explosive = message.match(/(\d+)\s*\(Explosive/i);
  if (explosive) return Number(explosive[1]);
  const simple = message.match(/:\s*(\d+)\s*→/);
  if (simple) return Number(simple[1]);
  return null;
}

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
  const [targetAutoSelected, setTargetAutoSelected] = useState(false);
  const [lastFeedback, setLastFeedback] = useState<CombatFeedbackData | null>(null);
  const [focusActorId, setFocusActorId] = useState<string | null>(null);
  const [focusTargetId, setFocusTargetId] = useState<string | null>(null);

  const canResolveNow = useMemo(() => canResolve(state) && diceUi === 'ready', [state, diceUi]);

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
        if (action.requiresTarget && (action.type === 'attack' || action.type === 'spell')) {
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
    [syncDiceFromState]
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
    [syncDiceFromState]
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

      const actionType = prev.selectedAction?.type ?? 'attack';
      const actorId = prev.currentActorId;
      const targetId = prev.selectedTargetId;

      let next = prev;

      if (actionType === 'attack') {
        next = executeHeroAttack(prev, encounterType);
      } else if (actionType === 'heal') {
        next = executeHeal(prev);
      } else if (actionType === 'spell') {
        next = executeSpell(prev, encounterType);
      } else {
        // defend etc.
        next = {
          ...prev,
          log: [
            ...prev.log,
            {
              id: `log_${Date.now()}`,
              message: `${prev.heroes.find((h) => h.id === prev.currentActorId)?.name ?? 'Héroe'} se defiende.`,
              timestamp: Date.now(),
            },
          ],
          selectedAction: null,
          selectedTargetId: null,
          phase: 'resolution',
        };
        // advance via execute path is complex; keep simple for defend MVP
        next = executeHeroAttack(prev, encounterType);
      }

      const feedback = buildFeedback(prev, next, actionType);
      const lastMsg = next.log[next.log.length - 1]?.message ?? '';
      const diceTotal = parseDiceTotal(lastMsg);

      setLastFeedback(feedback);
      setFocusActorId(actorId);
      setFocusTargetId(targetId);
      setLastDiceTotal(diceTotal);
      setPendingResult(next);
      setDiceUi('result');

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
      setLastFeedback(null);
      setFocusActorId(null);
      setFocusTargetId(null);
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
    lastFeedback,
    focusActorId,
    focusTargetId,
    selectHeroAction,
    selectEnemyTarget,
    clear,
    resolveDice,
    acknowledgeResult,
    canResolveNow,
  };
}
