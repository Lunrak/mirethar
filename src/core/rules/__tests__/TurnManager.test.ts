/**
 * Tests del sistema de turnos completo
 */

import {
  executeHeroAttack,
  runEnemyTurn,
  applyHeroAttack,
  getAliveEnemies,
  isPartyOutnumbering,
} from '../TurnManager';
import {
  createCombat,
  selectAction,
  selectTarget,
} from '../CombatStateManager';
import { createDefaultParty, createHero } from '../../data/classes';
import { generateEncounter } from '../EncounterGenerator';
import type { Action, CombatState, EnemyInstance } from '../../types/combat';

const attack: Action = { type: 'attack', name: 'Attack', requiresTarget: true };

function seqRng(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i++;
    return (v - 1) / 6 + 0.001;
  };
}

function setup(type: 'vermin' | 'minion' | 'boss' = 'minion'): CombatState {
  const party = createDefaultParty();
  const enc = generateEncounter(type);
  return createCombat(party, enc.enemies);
}

describe('TurnManager – applyHeroAttack', () => {
  it('mata minions según damage', () => {
    const state = setup('minion');
    const target = state.enemies[0];
    const before = getAliveEnemies(state.enemies).length;

    const next = applyHeroAttack(state, target.id, 2, 'minion', 'test hit');
    const after = getAliveEnemies(next.enemies).length;

    expect(after).toBe(Math.max(0, before - 2));
    // Puede terminar en victoria si había ≤2 enemigos
    expect(next.log.some((l) => l.message === 'test hit')).toBe(true);
  });

  it('resta life a un boss', () => {
    const state = setup('boss');
    const boss = state.enemies[0];
    const lifeBefore = boss.currentLife;

    const next = applyHeroAttack(state, boss.id, 2, 'boss', '2 heridas');
    expect(next.enemies[0].currentLife).toBe(Math.max(0, lifeBefore - 2));
  });

  it('victoria si se matan todos', () => {
    const party = createDefaultParty();
    const enemies: EnemyInstance[] = [
      {
        id: 'g1',
        templateId: 'minion_goblins',
        name: 'Goblin',
        level: 3,
        currentLife: 1,
        attacks: 1,
      },
    ];
    let state = createCombat(party, enemies);
    state = applyHeroAttack(state, 'g1', 1, 'minion', 'kill');
    expect(state.isFinished).toBe(true);
    expect(state.result).toBe('victory');
  });
});

describe('TurnManager – flujo de héroes', () => {
  it('executeHeroAttack avanza al siguiente héroe', () => {
    let state = setup('minion');
    const first = state.currentActorId;
    const second = state.heroTurnOrder[1];

    state = selectAction(state, attack);
    state = selectTarget(state, state.enemies[0].id);
    state = executeHeroAttack(state, 'minion', {}, seqRng([6, 3]));

    if (!state.isFinished) {
      expect(state.phase).toBe('heroTurn');
      expect(state.currentActorId).toBe(second);
      expect(state.currentActorId).not.toBe(first);
    }
  });

  it('después del último héroe pasa a enemyTurn', () => {
    let state = setup('boss');

    for (let i = 0; i < 4; i++) {
      if (state.isFinished || state.phase !== 'heroTurn') break;
      state = selectAction(state, attack);
      const target = getAliveEnemies(state.enemies)[0];
      if (!target) break;
      state = selectTarget(state, target.id);
      state = executeHeroAttack(state, 'boss', {}, seqRng([1]));
    }

    if (!state.isFinished) {
      expect(state.phase).toBe('enemyTurn');
    }
  });
});

describe('TurnManager – enemy turn', () => {
  it('enemigos atacan e infligen daño (natural 1 en defense)', () => {
    const party = createDefaultParty();
    const totalLifeBefore = party.reduce((s, h) => s + h.life, 0);

    const enemies: EnemyInstance[] = Array.from({ length: 4 }, (_, i) => ({
      id: `e${i}`,
      templateId: 'minion_orcs',
      name: 'Orc',
      level: 5,
      currentLife: 1,
      attacks: 1,
    }));

    let state = createCombat(party, enemies);
    state = { ...state, phase: 'enemyTurn' };
    state = runEnemyTurn(state, { rng: seqRng([1]) });

    const totalLifeAfter = state.heroes.reduce((s, h) => s + h.life, 0);
    expect(totalLifeAfter).toBeLessThan(totalLifeBefore);
  });

  it('después del enemyTurn vuelve a heroTurn con ronda+1', () => {
    let state = setup('boss');
    state = { ...state, phase: 'enemyTurn' };

    // 6 seguido de 2 → sin bucle infinito
    state = runEnemyTurn(state, { rng: seqRng([6, 2]) });

    if (!state.isFinished) {
      expect(state.phase).toBe('heroTurn');
      expect(state.round).toBe(2);
      expect(state.heroTurnIndex).toBe(0);
      expect(state.currentActorId).toBe(state.heroTurnOrder[0]);
    }
  });

  it('derrota cuando todos los héroes caen', () => {
    // Party frágil sin mods de defensa: solo wizards sin equipo
    const weakParty = [0, 1, 2, 3].map((i) => {
      const h = createHero('wizard', { name: `W${i}` });
      return { ...h, equipment: {}, life: 1, maxLife: 1 };
    });
    const enemies: EnemyInstance[] = Array.from({ length: 2 }, (_, i) => ({
      id: `e${i}`,
      templateId: 'minion_orcs',
      name: 'Orc',
      level: 10,
      currentLife: 1,
      attacks: 4,
    }));

    let state = createCombat(weakParty, enemies);
    // Forzar turno enemigo con defensa natural 1 (fallo)
    state = { ...state, phase: 'enemyTurn' as const };
    state = runEnemyTurn(state, { rng: seqRng([1]) });

    expect(state.heroes.every((h) => h.life <= 0 || h.isFallen || h.isDead)).toBe(true);
    expect(state.isFinished).toBe(true);
    expect(state.result).toBe('defeat');
  });
});

describe('TurnManager – combate completo corto', () => {
  it('party vs 1 goblin débil → victoria en ronda 1', () => {
    const party = createDefaultParty();
    const enemies: EnemyInstance[] = [
      {
        id: 'g1',
        templateId: 'minion_goblins',
        name: 'Goblin',
        level: 1,
        currentLife: 1,
        attacks: 1,
      },
    ];

    let state = createCombat(party, enemies);
    state = selectAction(state, attack);
    state = selectTarget(state, 'g1');
    state = executeHeroAttack(state, 'minion', {}, seqRng([5]));

    expect(state.isFinished).toBe(true);
    expect(state.result).toBe('victory');
  });
});

describe('helpers', () => {
  it('isPartyOutnumbering', () => {
    const state = setup('boss');
    expect(isPartyOutnumbering(state)).toBe(true);
  });
});
