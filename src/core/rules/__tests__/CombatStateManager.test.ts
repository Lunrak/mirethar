/**
 * Tests de CombatStateManager – solo lógica de estado
 */

import {
  createCombat,
  selectAction,
  selectTarget,
  clearSelection,
  startResolution,
  finishResolution,
  nextActor,
  endCombat,
  canResolve,
  combatReducer,
  initialCombatState,
} from '../CombatStateManager';
import { createDefaultParty } from '../../data/classes';
import { generateEncounter } from '../EncounterGenerator';
import type { Action, CombatState } from '../../types/combat';

const attackAction: Action = { type: 'attack', name: 'Attack', requiresTarget: true };
const defendAction: Action = { type: 'defend', name: 'Defend', requiresTarget: false };

function setupCombat(): CombatState {
  const heroes = createDefaultParty();
  const encounter = generateEncounter('minion');
  return createCombat(heroes, encounter.enemies);
}

describe('CombatStateManager', () => {
  describe('CREATE_COMBAT', () => {
    it('crea un combate con fase heroTurn y el primer héroe como actor', () => {
      const state = setupCombat();

      expect(state.isFinished).toBe(false);
      expect(state.result).toBeNull();
      expect(state.phase).toBe('heroTurn');
      expect(state.round).toBe(1);
      expect(state.heroes).toHaveLength(4);
      expect(state.enemies.length).toBeGreaterThan(0);
      expect(state.currentActorId).toBe(state.heroes[0].id);
      expect(state.heroTurnOrder).toHaveLength(4);
      expect(state.selectedAction).toBeNull();
      expect(state.selectedTargetId).toBeNull();
      expect(state.log.length).toBeGreaterThan(0);
    });
  });

  describe('SELECT_ACTION / SELECT_TARGET', () => {
    it('selecciona acción y limpia el objetivo anterior', () => {
      let state = setupCombat();
      state = selectAction(state, attackAction);

      expect(state.selectedAction?.name).toBe('Attack');
      expect(state.selectedTargetId).toBeNull();
    });

    it('selecciona objetivo solo si hay acción', () => {
      let state = setupCombat();
      const enemyId = state.enemies[0].id;

      // Sin acción → no cambia
      const unchanged = selectTarget(state, enemyId);
      expect(unchanged.selectedTargetId).toBeNull();

      state = selectAction(state, attackAction);
      state = selectTarget(state, enemyId);
      expect(state.selectedTargetId).toBe(enemyId);
    });

    it('clearSelection limpia acción y objetivo', () => {
      let state = setupCombat();
      state = selectAction(state, attackAction);
      state = selectTarget(state, state.enemies[0].id);
      state = clearSelection(state);

      expect(state.selectedAction).toBeNull();
      expect(state.selectedTargetId).toBeNull();
    });
  });

  describe('canResolve / START_RESOLUTION', () => {
    it('canResolve es false si falta acción o objetivo requerido', () => {
      let state = setupCombat();
      expect(canResolve(state)).toBe(false);

      state = selectAction(state, attackAction);
      expect(canResolve(state)).toBe(false); // falta target

      state = selectTarget(state, state.enemies[0].id);
      expect(canResolve(state)).toBe(true);
    });

    it('acciones sin target se pueden resolver sin SELECT_TARGET', () => {
      let state = setupCombat();
      state = selectAction(state, defendAction);
      expect(canResolve(state)).toBe(true);
    });

    it('START_RESOLUTION pasa a fase resolution', () => {
      let state = setupCombat();
      state = selectAction(state, attackAction);
      state = selectTarget(state, state.enemies[0].id);
      state = startResolution(state);

      expect(state.phase).toBe('resolution');
    });

    it('START_RESOLUTION no hace nada si falta acción', () => {
      const state = setupCombat();
      const next = startResolution(state);
      expect(next.phase).toBe('heroTurn');
    });
  });

  describe('FINISH_RESOLUTION / NEXT_ACTOR', () => {
    it('avanza al siguiente héroe del turn order', () => {
      let state = setupCombat();
      const firstId = state.currentActorId;
      const secondId = state.heroTurnOrder[1];

      state = selectAction(state, attackAction);
      state = selectTarget(state, state.enemies[0].id);
      state = startResolution(state);
      state = finishResolution(state);

      expect(state.phase).toBe('heroTurn');
      expect(state.currentActorId).toBe(secondId);
      expect(state.currentActorId).not.toBe(firstId);
      expect(state.selectedAction).toBeNull();
      expect(state.selectedTargetId).toBeNull();
    });

    it('después del último héroe pasa a enemyTurn', () => {
      let state = setupCombat();

      // Avanzamos los 4 héroes
      for (let i = 0; i < 4; i++) {
        state = selectAction(state, defendAction);
        state = startResolution(state);
        state = finishResolution(state);
      }

      expect(state.phase).toBe('enemyTurn');
      expect(state.selectedAction).toBeNull();
    });
  });

  describe('END_COMBAT', () => {
    it('termina el combate con victoria o derrota', () => {
      let state = setupCombat();
      state = endCombat(state, 'victory');

      expect(state.phase).toBe('ended');
      expect(state.isFinished).toBe(true);
      expect(state.result).toBe('victory');
      expect(state.currentActorId).toBeNull();
    });
  });

  describe('inmutabilidad', () => {
    it('el reducer nunca muta el estado anterior', () => {
      const state = setupCombat();
      const snapshot = JSON.stringify(state);

      selectAction(state, attackAction);
      selectTarget(state, state.enemies[0]?.id ?? 'x');
      startResolution(state);
      finishResolution(state);

      expect(JSON.stringify(state)).toBe(snapshot);
    });
  });

  describe('reducer directo', () => {
    it('estado inicial es ended y vacío', () => {
      expect(initialCombatState.phase).toBe('ended');
      expect(initialCombatState.isFinished).toBe(true);
      expect(initialCombatState.heroes).toHaveLength(0);
    });

    it('acción desconocida devuelve el mismo estado', () => {
      const state = setupCombat();
      // @ts-expect-error acción inválida a propósito
      const next = combatReducer(state, { type: 'UNKNOWN' });
      expect(next).toBe(state);
    });
  });
});
