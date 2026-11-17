/**
 * Tests – tablas de contenido pasillo / sala
 */

import {
  resolveCellContent,
  applyContentToCell,
  formatContentLog,
} from '../RoomContentsService';
import {
  CORRIDOR_CONTENTS,
  ROOM_CONTENTS,
  ROOM_SPECIAL_SUBTABLE,
} from '../../data/roomContents';
import type { MapCell } from '../../types/dungeon';

function seqRng(faces: number[]): () => number {
  let i = 0;
  return () => {
    const v = faces[i % faces.length];
    i += 1;
    return (v - 1) / 6 + 0.001;
  };
}

describe('Tablas de datos', () => {
  test('pasillo y sala tienen 6 filas', () => {
    expect(CORRIDOR_CONTENTS).toHaveLength(6);
    expect(ROOM_CONTENTS).toHaveLength(6);
    expect(ROOM_SPECIAL_SUBTABLE).toHaveLength(6);
  });

  test('rolls 1–6 únicos en cada tabla', () => {
    for (const table of [CORRIDOR_CONTENTS, ROOM_CONTENTS, ROOM_SPECIAL_SUBTABLE]) {
      const rolls = table.map((r) => r.roll).sort();
      expect(rolls).toEqual([1, 2, 3, 4, 5, 6]);
    }
  });
});

describe('resolveCellContent', () => {
  test('entrance siempre vacío sin tirada real', () => {
    const r = resolveCellContent('entrance', seqRng([6]));
    expect(r.kind).toBe('empty');
    expect(r.label).toMatch(/Entrada/i);
  });

  test('pasillo d6=1 vacío', () => {
    const r = resolveCellContent('corridor', seqRng([1]));
    expect(r.roll).toBe(1);
    expect(r.kind).toBe('empty');
  });

  test('pasillo d6=3 encuentro vermin', () => {
    const r = resolveCellContent('corridor', seqRng([3, 1, 1, 1]));
    expect(r.kind).toBe('encounter');
    expect(r.encounter).toBeDefined();
    expect(r.encounter!.type).toBe('vermin');
  });

  test('sala d6=4 tesoro', () => {
    const r = resolveCellContent('room', seqRng([4]));
    expect(r.kind).toBe('treasure');
    expect(r.treasureHint).toBeDefined();
  });

  test('sala d6=6 usa subtabla', () => {
    // room roll 6 → special → subtabla roll 1 → stairs
    const r = resolveCellContent('room', seqRng([6, 1]));
    expect(r.subRoll).toBe(1);
    expect(r.kind).toBe('stairs_down');
  });

  test('sala d6=6 sub 3 weird', () => {
    const r = resolveCellContent('room', seqRng([6, 3, 1, 1]));
    expect(r.kind).toBe('encounter');
    expect(r.encounter?.type).toBe('weird');
  });
});

describe('applyContentToCell / formatContentLog', () => {
  test('aplica content y label a la celda', () => {
    const cell: MapCell = {
      id: '1,1',
      x: 1,
      y: 1,
      kind: 'room',
      content: 'unknown',
      doors: [],
      revealed: true,
    };
    const resolved = resolveCellContent('room', seqRng([4]));
    const next = applyContentToCell(cell, resolved);
    expect(next.content).toBe('treasure');
    expect(next.label).toBe(resolved.label);
  });

  test('formatContentLog incluye tirada y encuentro', () => {
    const r = resolveCellContent('corridor', seqRng([3, 2, 1]));
    const log = formatContentLog(r);
    expect(log).toMatch(/d6=3/);
    if (r.encounter) {
      expect(log).toMatch(new RegExp(r.encounter.template.name));
    }
  });
});
