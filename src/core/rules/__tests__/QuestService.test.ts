/**
 * Tests – quest table, progreso múltiple y recompensas
 */

import {
  acceptQuestAtCell,
  rollAndAcceptQuest,
  advanceAllQuests,
  advanceQuest,
  canTurnInQuest,
  questsReadyHere,
  turnInQuest,
  shouldOfferQuest,
  questProgressLabel,
  getQuests,
  applyLootToMap,
  emptyLoot,
} from '../QuestService';
import { QUEST_TABLE } from '../../data/questTable';
import type { DungeonMap } from '../../types/dungeon';
import type { ActiveQuest } from '../../types/quest';

function seqRng(faces: number[]): () => number {
  let i = 0;
  return () => {
    const v = faces[i % faces.length];
    i += 1;
    return (v - 1) / 6 + 0.001;
  };
}

function baseMap(partyCellId = '14,19'): DungeonMap {
  return {
    id: 'test',
    entranceId: 1,
    cells: {
      [partyCellId]: {
        id: partyCellId,
        x: 14,
        y: 19,
        kind: 'entrance',
        content: 'empty',
        doors: ['N'],
        revealed: true,
        isEntrance: true,
      },
      '14,18': {
        id: '14,18',
        x: 14,
        y: 18,
        kind: 'room',
        content: 'empty',
        doors: [],
        revealed: true,
      },
    },
    doors: {},
    partyCellId,
    quests: [],
  };
}

describe('QUEST_TABLE', () => {
  test('6 misiones con rolls 1–6', () => {
    expect(QUEST_TABLE).toHaveLength(6);
    expect(QUEST_TABLE.map((q) => q.roll).sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  test('cada misión tiene diálogo, objetivo y recompensa', () => {
    for (const q of QUEST_TABLE) {
      expect(q.dialogue.length).toBeGreaterThan(10);
      expect(q.target).toBeGreaterThan(0);
      expect(q.reward.gold).toBeGreaterThan(0);
      expect(q.completeDialogue.length).toBeGreaterThan(5);
    }
  });
});

describe('accept / roll', () => {
  test('acceptQuestAtCell genera instanceId y ancla celda', () => {
    const q = acceptQuestAtCell(QUEST_TABLE[0].id, '14,18');
    expect(q.instanceId).toBeTruthy();
    expect(q.giverCellId).toBe('14,18');
    expect(q.progress).toBe(0);
    expect(q.status).toBe('active');
  });

  test('dos aceptaciones misma plantilla → instanceId distintos', () => {
    const a = acceptQuestAtCell(QUEST_TABLE[0].id, '1,1');
    const b = acceptQuestAtCell(QUEST_TABLE[0].id, '2,2');
    expect(a.templateId).toBe(b.templateId);
    expect(a.instanceId).not.toBe(b.instanceId);
  });

  test('rollAndAcceptQuest respeta d6', () => {
    const q = rollAndAcceptQuest('5,5', seqRng([4]));
    expect(q.templateId).toBe(QUEST_TABLE.find((x) => x.roll === 4)!.id);
  });
});

describe('advanceAllQuests', () => {
  test('avanza solo las del goalType indicado', () => {
    const a = acceptQuestAtCell(
      QUEST_TABLE.find((q) => q.goalType === 'open_doors')!.id,
      '1,1',
    );
    const b = acceptQuestAtCell(
      QUEST_TABLE.find((q) => q.goalType === 'find_treasure')!.id,
      '2,2',
    );
    const next = advanceAllQuests([a, b], 'open_doors', 1);
    expect(next[0].progress).toBe(1);
    expect(next[1].progress).toBe(0);
  });

  test('al llegar al target pasa a ready_to_turn_in', () => {
    let q = acceptQuestAtCell(QUEST_TABLE[0].id, '1,1');
    q = { ...q, target: 2, goalType: 'open_doors' };
    const next = advanceAllQuests([q], 'open_doors', 2);
    expect(next[0].status).toBe('ready_to_turn_in');
    expect(next[0].progress).toBe(2);
  });

  test('no modifica completed', () => {
    const q: ActiveQuest = {
      ...acceptQuestAtCell(QUEST_TABLE[0].id, '1,1'),
      status: 'completed',
      progress: 5,
      goalType: 'open_doors',
    };
    const next = advanceAllQuests([q], 'open_doors', 1);
    expect(next[0].progress).toBe(5);
    expect(next[0].status).toBe('completed');
  });
});

describe('turn-in y recompensas', () => {
  test('canTurnInQuest exige celda del dador y ready', () => {
    const map = baseMap('14,19');
    const q = {
      ...acceptQuestAtCell(QUEST_TABLE[0].id, '14,19'),
      status: 'ready_to_turn_in' as const,
      progress: 3,
    };
    map.quests = [q];
    expect(canTurnInQuest(map, q)).toBe(true);
    map.partyCellId = '14,18';
    expect(canTurnInQuest(map, q)).toBe(false);
  });

  test('questsReadyHere filtra por posición', () => {
    const map = baseMap('14,19');
    const here = {
      ...acceptQuestAtCell(QUEST_TABLE[0].id, '14,19'),
      status: 'ready_to_turn_in' as const,
      progress: 9,
    };
    const elsewhere = {
      ...acceptQuestAtCell(QUEST_TABLE[1].id, '14,18'),
      status: 'ready_to_turn_in' as const,
      progress: 9,
    };
    map.quests = [here, elsewhere];
    const ready = questsReadyHere(map);
    expect(ready).toHaveLength(1);
    expect(ready[0].giverCellId).toBe('14,19');
  });

  test('turnInQuest aplica oro, items y xp al loot', () => {
    const q = {
      ...acceptQuestAtCell(QUEST_TABLE[0].id, '1,1'),
      reward: {
        gold: 30,
        itemHint: 'Poción',
        xpHint: '1 XP',
      },
    };
    const { quest, reward } = turnInQuest(q, emptyLoot());
    expect(quest.status).toBe('completed');
    expect(reward.loot.gold).toBe(30);
    expect(reward.loot.items).toContain('Poción');
    expect(reward.loot.xpMarks).toContain('1 XP');
    expect(reward.message).toMatch(/30 gp/);
  });

  test('applyLootToMap escribe goldFound y listas', () => {
    const map = applyLootToMap(baseMap(), {
      gold: 55,
      items: ['A'],
      xpMarks: ['B'],
    });
    expect(map.goldFound).toBe(55);
    expect(map.lootItems).toEqual(['A']);
    expect(map.xpMarks).toEqual(['B']);
  });
});

describe('shouldOfferQuest', () => {
  test('no en pasillo ni con encuentro', () => {
    expect(shouldOfferQuest('corridor', 'empty', [], '1,1', seqRng([6]))).toBe(
      false,
    );
    expect(shouldOfferQuest('room', 'encounter', [], '1,1', seqRng([6]))).toBe(
      false,
    );
  });

  test('special en sala ofrece', () => {
    expect(shouldOfferQuest('room', 'special', [], '1,1', seqRng([1]))).toBe(
      true,
    );
  });

  test('no ofrece si ya hay misión activa en esa celda', () => {
    const existing = acceptQuestAtCell(QUEST_TABLE[0].id, '1,1');
    expect(
      shouldOfferQuest('room', 'special', [existing], '1,1', seqRng([6])),
    ).toBe(false);
  });

  test('sí ofrece en otra celda aunque haya misiones', () => {
    const existing = acceptQuestAtCell(QUEST_TABLE[0].id, '1,1');
    expect(
      shouldOfferQuest('room', 'special', [existing], '2,2', seqRng([6])),
    ).toBe(true);
  });
});

describe('helpers', () => {
  test('questProgressLabel', () => {
    const q = { ...acceptQuestAtCell(QUEST_TABLE[0].id, '1,1'), progress: 2, target: 5 };
    expect(questProgressLabel(q)).toBe('2/5');
  });

  test('getQuests lee quests[] o activeQuest legacy', () => {
    const map = baseMap();
    expect(getQuests(map)).toEqual([]);
    const q = acceptQuestAtCell(QUEST_TABLE[0].id, '1,1');
    expect(getQuests({ ...map, quests: [q] })).toHaveLength(1);
    expect(getQuests({ ...map, activeQuest: q })).toHaveLength(1);
  });

  test('advanceQuest wrapper de uno solo', () => {
    const q = {
      ...acceptQuestAtCell(QUEST_TABLE[0].id, '1,1'),
      goalType: 'open_doors' as const,
      target: 3,
    };
    const next = advanceQuest(q, 'open_doors');
    expect(next!.progress).toBe(1);
  });
});
