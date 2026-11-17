import {
  ensureMonsterDeal,
  payBribe,
  claimRoomAfterVictory,
  rollInitialBribe,
  rollNextBribe,
  bribeDemandText,
} from '../BribeService';
import type { DungeonMap } from '../../types/dungeon';

function seqRng(faces: number[]): () => number {
  let i = 0;
  return () => {
    const v = faces[i % faces.length];
    i += 1;
    return (v - 1) / 6 + 0.001;
  };
}

function mapWithCell(gold = 100): DungeonMap {
  return {
    id: 'm',
    entranceId: 1,
    partyCellId: '5,5',
    goldFound: gold,
    lootItems: ['Antorcha'],
    cells: {
      '5,5': {
        id: '5,5',
        x: 5,
        y: 5,
        kind: 'room',
        content: 'encounter',
        doors: [],
        revealed: true,
        label: 'Sala',
      },
    },
    doors: {},
  };
}

describe('BribeService', () => {
  test('ensureMonsterDeal crea demanda inicial', () => {
    const m = ensureMonsterDeal(mapWithCell(), '5,5', 'Goblins x4', seqRng([3]));
    const d = m.cells['5,5'].monsterDeal!;
    expect(d.bribed).toBe(false);
    expect(d.nextBribeGold).toBe(30);
    expect(d.stash.gold).toBe(0);
  });

  test('payBribe mueve oro al stash y marca bribed', () => {
    let m = ensureMonsterDeal(mapWithCell(50), '5,5', 'Orcs', seqRng([2]));
    const r = payBribe(m, '5,5');
    expect(r.ok).toBe(true);
    expect(r.map.goldFound).toBe(50 - 20);
    expect(r.map.cells['5,5'].monsterDeal!.bribed).toBe(true);
    expect(r.map.cells['5,5'].monsterDeal!.stash.gold).toBe(20);
  });

  test('payBribe falla sin oro', () => {
    let m = ensureMonsterDeal(mapWithCell(5), '5,5', 'Orcs', seqRng([6]));
    const r = payBribe(m, '5,5');
    expect(r.ok).toBe(false);
  });

  test('al volver sobornados sube la demanda y acumula stash', () => {
    let m = ensureMonsterDeal(mapWithCell(200), '5,5', 'Hobgoblins', seqRng([2]));
    m = payBribe(m, '5,5').map;
    // Revisitar: ensure de nuevo con bribed
    m = ensureMonsterDeal(m, '5,5', 'Hobgoblins', seqRng([3]));
    const demand = m.cells['5,5'].monsterDeal!.nextBribeGold;
    expect(demand).toBeGreaterThanOrEqual(20 + 10);
    const r = payBribe(m, '5,5');
    expect(r.ok).toBe(true);
    expect(r.map.cells['5,5'].monsterDeal!.stash.gold).toBe(20 + demand);
  });

  test('claimRoomAfterVictory devuelve stash + loot normal', () => {
    let m = ensureMonsterDeal(mapWithCell(100), '5,5', 'Orcs', seqRng([1]));
    m = payBribe(m, '5,5').map;
    const claim = claimRoomAfterVictory(m, '5,5', { gold: 15, items: ['Gema'] });
    expect(claim.reclaimed.gold).toBe(10);
    expect(claim.map.goldFound).toBe(100 - 10 + 10 + 15);
    expect(claim.map.lootItems).toContain('Gema');
    expect(claim.map.cells['5,5'].monsterDeal).toBeUndefined();
  });

  test('rollNextBribe nunca baja', () => {
    expect(rollNextBribe(50, seqRng([1]))).toBe(60);
    expect(rollNextBribe(10, seqRng([6]))).toBe(60);
  });

  test('bribeDemandText menciona stash si ya sobornó', () => {
    let m = ensureMonsterDeal(mapWithCell(100), '5,5', 'Trolls', seqRng([1]));
    m = payBribe(m, '5,5').map;
    m = ensureMonsterDeal(m, '5,5', 'Trolls', seqRng([2]));
    const text = bribeDemandText(m.cells['5,5'].monsterDeal!);
    expect(text).toMatch(/nuevo soborno|guardan/i);
  });
});
