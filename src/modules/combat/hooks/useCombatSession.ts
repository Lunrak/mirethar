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
import {
  generateEncounter,
  type EncounterResult,
  type EncounterType,
} from '../../../core/rules/EncounterGenerator';
import type { Action, CombatState, EnemyInstance, Hero } from '../../../core/types/combat';
import type { CombatFeedbackData, FeedbackKind } from '../components/CombatFeedback';

export type DiceUiState = 'idle' | 'ready' | 'spinning' | 'result';

export type CombatSessionConfig = {
  encounterType?: EncounterType;
  heroes?: Hero[];
  enemies?: EnemyInstance[];
  positions?: { front: string[]; rear: string[] };
  /** Si se pasa, se usa tal cual (incluye template del generador) */
  encounter?: EncounterResult;
};

export type CombatSession = {
  state: CombatState;
  diceUi: DiceUiState;
  lastDiceTotal: number | null;
  encounterType: EncounterType;
  encounter: EncounterResult | null;
  targetAutoSelected: boolean;
  lastFeedback: CombatFeedbackData | null;
  focusActorId: string | null;
  focusTargetId: string | null;
  selectHeroAction: (action: Action) => void;
  selectEnemyTarget: (enemyId: string) => void;
  clear: () => void;
  resolveDice: () => void;
  acknowledgeResult: () => void;
  canResolveNow: boolean;
};

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
    headline = `Cura +${heroDelta}`;
  } else if (isMiss) {
    kind = 'miss';
    amount = 0;
    headline = 'Fallo — sin daño';
  } else if (enemyDelta > 0) {
    kind = isCrit ? 'critical' : 'damage';
    amount = enemyDelta;
    headline = isCrit
      ? `¡Crítico! −${enemyDelta}`
      : enemyDelta === 1
        ? 'Éxito — 1 herida'
        : `Éxito — ${enemyDelta} heridas`;
  } else if (/ÉXITO/i.test(lastMsg)) {
    kind = isCrit ? 'critical' : 'damage';
    amount = Math.max(1, enemyDelta);
    headline = isCrit ? '¡Crítico!' : 'Éxito';
  } else if (/defiende/i.test(lastMsg)) {
    kind = 'info';
    headline = 'En guardia';
  } else {
    kind = 'info';
    headline = actionType === 'spell' ? 'Hechizo resuelto' : 'Acción resuelta';
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

function parseDiceTotal(message: string): number | null {
  // Cara cruda del d6 si aparece (1–6) antes de mods
  const face = message.match(/\b([1-6])\b\s*(?:\+|\(Explosive|→)/);
  if (face) return Number(face[1]);
  const explosive = message.match(/(\d+)\s*\(Explosive/i);
  if (explosive) {
    const n = Number(explosive[1]);
    return n >= 1 && n <= 6 ? n : ((n - 1) % 6) + 1;
  }
  const simple = message.match(/:\s*(\d+)\s*→/);
  if (simple) {
    const n = Number(simple[1]);
    return n >= 1 && n <= 6 ? n : ((n - 1) % 6) + 1;
  }
  return null;
}

function initFromConfig(config: CombatSessionConfig = {}): {
  state: CombatState;
  encounter: EncounterResult | null;
  encounterType: EncounterType;
} {
  const encounterType = config.encounterType ?? config.encounter?.type ?? 'minion';
  const party = config.heroes ?? createDefaultParty();
  const encounter =
    config.encounter ??
    (config.enemies
      ? null
      : generateEncounter(encounterType));
  const enemies = config.enemies ?? encounter?.enemies ?? [];
  const positions = config.positions;
  const state = createCombat(party, enemies, positions);
  return { state, encounter, encounterType };
}

export function useCombatSession(config: CombatSessionConfig | EncounterType = 'minion'): CombatSession {
  const normalized: CombatSessionConfig =
    typeof config === 'string' ? { encounterType: config } : config;

  const initial = useMemo(() => initFromConfig(normalized), []); // montaje único

  const [state, setState] = useState<CombatState>(() => initial.state);
  const [encounter] = useState<EncounterResult | null>(() => initial.encounter);
  const [encounterType] = useState<EncounterType>(() => initial.encounterType);

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
        next = executeHeroAttack(prev, encounterType);
      }

      const feedback = buildFeedback(prev, next, actionType);
      const lastMsg = next.log[next.log.length - 1]?.message ?? '';
      const diceTotal = parseDiceTotal(lastMsg);

      // Animación: spinning → result (cara final)
      setDiceUi('spinning');
      setLastFeedback(feedback);
      setFocusActorId(actorId);
      setFocusTargetId(targetId);
      setLastDiceTotal(diceTotal);
      setPendingResult(next);
      setTimeout(() => setDiceUi('result'), 900);

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
    encounter,
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
