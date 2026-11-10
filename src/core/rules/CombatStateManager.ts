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
import { applyOpeningToCombatState } from './SpecialRulesService';

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
  | { type: 'FINISH_RESOLUTION' } // avanza al siguiente actor / fase
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

/** Construye el orden de turno inicial (héroes vivos, en el orden del array) */
function buildHeroTurnOrder(heroes: Hero[]): string[] {
  return getAliveHeroes(heroes).map((h) => h.id);
}

// ---------------------------------------------------------------------------
// Estado inicial vacío (antes de CREATE_COMBAT)
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
  moraleTested: [],
  initialEnemyCounts: {},
};

// ---------------------------------------------------------------------------
// Reducer (puro e inmutable)
// ---------------------------------------------------------------------------

export function combatReducer(state: CombatState, action: CombatAction): CombatState {
  switch (action.type) {
    case 'CREATE_COMBAT': {
      const { heroes, enemies, positions } = action.payload;
      const heroTurnOrder = buildHeroTurnOrder(heroes);
      const firstHeroId = heroTurnOrder[0] ?? null;

      const base = {
        id: `combat_${Date.now().toString(36)}`,
        round: 1,
        currentActorId: firstHeroId,
        phase: (firstHeroId ? 'heroTurn' : 'ended') as CombatPhase,
        heroes: heroes.map((h) => ({ ...h })),
        enemies: enemies.map((e) => ({ ...e })),
        positions: positions ?? {
          front: heroes.slice(0, 2).map((h) => h.id),
          rear: heroes.slice(2).map((h) => h.id),
        },
        selectedAction: null,
        selectedTargetId: null,
        log: [createLogEntry('Combate iniciado')],
        isFinished: false,
        result: null as 'victory' | 'defeat' | null,
        heroTurnOrder,
        heroTurnIndex: 0,
        moraleTested: [],
        initialEnemyCounts: enemies.reduce<Record<string, number>>((acc, e) => {
          acc[e.templateId] = (acc[e.templateId] ?? 0) + 1;
          return acc;
        }, {}),
      };
      // Miradas Medusa / Catoblepas al inicio
      let opened = applyOpeningToCombatState(base);
      // Gremlins: encuentro no combativo
      const onlyGremlins =
        opened.enemies.length > 0 &&
        opened.enemies.every(
          (e: EnemyInstance) =>
            e.templateId === 'weird_invisible_gremlins' || /gremlin/i.test(e.name)
        );
      if (onlyGremlins) {
        opened = {
          ...opened,
          phase: 'ended',
          isFinished: true,
          result: 'victory',
          log: [
            ...opened.log,
            createLogEntry('Invisible Gremlins saquean y huyen (sin combate, sin XP).'),
          ],
        };
      }
      return opened;
    }

    case 'SELECT_ACTION': {
      if (state.phase !== 'heroTurn' && state.phase !== 'enemyTurn') {
        return state; // no se puede seleccionar acción fuera de turno
      }
      return {
        ...state,
        selectedAction: action.payload,
        selectedTargetId: null, // al cambiar de acción se limpia el objetivo
        log: [...state.log, createLogEntry(`Acción seleccionada: ${action.payload.name}`)],
      };
    }

    case 'SELECT_TARGET': {
      if (!state.selectedAction) return state;
      return {
        ...state,
        selectedTargetId: action.payload,
        log: [...state.log, createLogEntry(`Objetivo seleccionado: ${action.payload}`)],
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
      // Solo se puede pasar a resolution si hay acción (y objetivo si se requiere)
      if (!state.selectedAction) return state;
      if (state.selectedAction.requiresTarget && !state.selectedTargetId) return state;

      return {
        ...state,
        phase: 'resolution',
        log: [
          ...state.log,
          createLogEntry(
            `Resolviendo: ${state.selectedAction.name}` +
              (state.selectedTargetId ? ` → ${state.selectedTargetId}` : '')
          ),
        ],
      };
    }

    case 'FINISH_RESOLUTION':
    case 'NEXT_ACTOR': {
      // Limpia selección y avanza al siguiente héroe o a enemyTurn / siguiente ronda
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
          log: [...state.log, createLogEntry(`Turno de ${state.heroTurnOrder[nextIndex]}`)],
        };
      }

      // Ya no quedan héroes en esta ronda → enemyTurn (o ended si no hay enemigos vivos)
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
          createLogEntry(action.payload.result === 'victory' ? '¡Victoria!' : 'Derrota...'),
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
// API conveniente (wrappers)
// ---------------------------------------------------------------------------

export function createCombat(
  heroes: Hero[],
  enemies: EnemyInstance[],
  positions?: { front: string[]; rear: string[] }
): CombatState {
  return combatReducer(initialCombatState, {
    type: 'CREATE_COMBAT',
    payload: { heroes, enemies, positions },
  });
}

export function selectAction(state: CombatState, action: Action): CombatState {
  return combatReducer(state, { type: 'SELECT_ACTION', payload: action });
}

export function selectTarget(state: CombatState, targetId: string): CombatState {
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

export function endCombat(state: CombatState, result: 'victory' | 'defeat'): CombatState {
  return combatReducer(state, { type: 'END_COMBAT', payload: { result } });
}

export function addLog(state: CombatState, message: string): CombatState {
  return combatReducer(state, { type: 'ADD_LOG', payload: message });
}

/** ¿Se puede pasar a resolution? (acción seleccionada + objetivo si hace falta) */
export function canResolve(state: CombatState): boolean {
  if (!state.selectedAction) return false;
  if (state.selectedAction.requiresTarget && !state.selectedTargetId) return false;
  return state.phase === 'heroTurn' || state.phase === 'enemyTurn';
}
