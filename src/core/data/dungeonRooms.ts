/**
 * Pack de salas/pasillos d66 (11–66). Celda = 192 px.
 * Redibujos alineados a rejilla según diagramas 4AD.
 *
 * '#' = suelo caminable; '.' / huecos = vacío dentro de la huella (p. ej. pozo).
 * Las puertas van en coordenadas locales de la rejilla + lado (N/E/S/W).
 * Usar rotateRoom() al acoplar a un vano existente.
 */

import type { Dir } from '../types/dungeon';

export const CELL_SIZE = 192 as const;

export type Side = Dir; // 'N' | 'E' | 'S' | 'W'
export type RoomKind = 'room' | 'corridor';

export type RoomDoor = {
  x: number;
  y: number;
  side: Side;
};

export type DungeonRoom = {
  id: string;
  width: number;
  height: number;
  kind: RoomKind;
  /** Filas top→bottom; '#' suelo, '.' hueco interior, espacio fuera */
  grid: string[];
  doors: RoomDoor[];
  /** require() del PNG de la huella (opcional; la generación usa solo grid) */
  image?: number;
};

/** Geometría d66; los PNG son opcionales (no bloquean el bundle). */
export const CONTENT_SPRITE_ATLAS: number | null = null;

export const dungeonRooms: Record<string, DungeonRoom> = {
  '11': {
    id: '11',
    width: 3,
    height: 3,
    kind: 'room',
    grid: ['###', '###', '###'],
    doors: [{ x: 1, y: 2, side: 'S' }],
  },
  '12': {
    id: '12',
    width: 3,
    height: 3,
    kind: 'room',
    grid: ['###', '#.#', '###'],
    doors: [{ x: 1, y: 2, side: 'S' }],
  },
  '13': {
    id: '13',
    width: 5,
    height: 4,
    kind: 'room',
    grid: ['#####', '#...#', '#...#', '#####'],
    doors: [
      { x: 1, y: 3, side: 'S' },
      { x: 4, y: 3, side: 'S' },
    ],
  },
  '14': {
    id: '14',
    width: 3,
    height: 4,
    kind: 'room',
    grid: ['###', '###', '###', '###'],
    doors: [
      { x: 0, y: 3, side: 'S' },
      { x: 2, y: 3, side: 'S' },
    ],
  },
  '15': {
    id: '15',
    width: 5,
    height: 4,
    kind: 'room',
    grid: ['.###.', '#####', '#####', '.###.'],
    doors: [
      { x: 1, y: 3, side: 'S' },
      { x: 4, y: 2, side: 'S' },
      { x: 0, y: 2, side: 'S' },
    ],
  },
  '16': {
    id: '16',
    width: 3,
    height: 5,
    kind: 'room',
    grid: ['.#.', '.#.', '.#.', '.#.', '###'],
    doors: [{ x: 2, y: 4, side: 'S' }],
  },
  '21': {
    id: '21',
    width: 3,
    height: 3,
    kind: 'room',
    grid: ['###', '###', '###'],
    doors: [{ x: 1, y: 2, side: 'S' }],
  },
  '22': {
    id: '22',
    width: 3,
    height: 3,
    kind: 'room',
    grid: ['###', '#.#', '###'],
    doors: [{ x: 1, y: 2, side: 'S' }],
  },
  '23': {
    id: '23',
    width: 6,
    height: 3,
    kind: 'room',
    grid: ['######', '..####', '..####'],
    doors: [
      { x: 0, y: 0, side: 'S' },
      { x: 4, y: 2, side: 'S' },
    ],
  },
  '24': {
    id: '24',
    width: 3,
    height: 4,
    kind: 'room',
    grid: ['###', '###', '###', '###'],
    doors: [
      { x: 0, y: 3, side: 'S' },
      { x: 2, y: 3, side: 'S' },
    ],
  },
  '25': {
    id: '25',
    width: 6,
    height: 2,
    kind: 'room',
    grid: ['######', '######'],
    doors: [
      { x: 0, y: 1, side: 'S' },
      { x: 2, y: 1, side: 'S' },
    ],
  },
  '26': {
    id: '26',
    width: 2,
    height: 3,
    kind: 'room',
    grid: ['##', '##', '##'],
    doors: [{ x: 1, y: 2, side: 'S' }],
  },
  '31': {
    id: '31',
    width: 3,
    height: 3,
    kind: 'room',
    grid: ['###', '###', '###'],
    doors: [{ x: 1, y: 2, side: 'S' }],
  },
  '32': {
    id: '32',
    width: 5,
    height: 3,
    kind: 'room',
    grid: ['..###', '..###', '#####'],
    doors: [
      { x: 1, y: 2, side: 'S' },
      { x: 4, y: 2, side: 'S' },
    ],
  },
  '33': {
    id: '33',
    width: 3,
    height: 4,
    kind: 'room',
    grid: ['###', '###', '###', '###'],
    doors: [
      { x: 0, y: 3, side: 'S' },
      { x: 2, y: 3, side: 'S' },
    ],
  },
  '34': {
    id: '34',
    width: 3,
    height: 3,
    kind: 'room',
    grid: ['###', '#.#', '###'],
    doors: [{ x: 1, y: 2, side: 'S' }],
  },
  '35': {
    id: '35',
    width: 6,
    height: 3,
    kind: 'room',
    grid: ['######', '######', '######'],
    doors: [
      { x: 1, y: 2, side: 'S' },
      { x: 4, y: 2, side: 'S' },
      { x: 4, y: 0, side: 'N' },
    ],
  },
  '36': {
    id: '36',
    width: 3,
    height: 5,
    kind: 'room',
    grid: ['.##', '.##', '###', '###', '##.'],
    doors: [
      { x: 0, y: 4, side: 'S' },
      { x: 2, y: 3, side: 'S' },
    ],
  },
  '41': {
    id: '41',
    width: 3,
    height: 4,
    kind: 'room',
    grid: ['###', '###', '###', '###'],
    doors: [
      { x: 0, y: 3, side: 'S' },
      { x: 2, y: 3, side: 'S' },
    ],
  },
  '42': {
    id: '42',
    width: 3,
    height: 4,
    kind: 'room',
    grid: ['##.', '##.', '##.', '###'],
    doors: [{ x: 0, y: 3, side: 'S' }],
  },
  '43': {
    id: '43',
    width: 3,
    height: 3,
    kind: 'room',
    grid: ['###', '###', '###'],
    doors: [{ x: 1, y: 2, side: 'S' }],
  },
  '44': {
    id: '44',
    width: 4,
    height: 3,
    kind: 'room',
    grid: ['####', '####', '####'],
    doors: [
      { x: 1, y: 2, side: 'S' },
      { x: 3, y: 2, side: 'S' },
    ],
  },
  '45': {
    id: '45',
    width: 4,
    height: 4,
    kind: 'room',
    grid: ['.##.', '####', '####', '.##.'],
    doors: [
      { x: 2, y: 3, side: 'S' },
      { x: 0, y: 2, side: 'S' },
    ],
  },
  '46': {
    id: '46',
    width: 3,
    height: 4,
    kind: 'room',
    grid: ['###', '###', '###', '###'],
    doors: [
      { x: 0, y: 3, side: 'S' },
      { x: 2, y: 3, side: 'S' },
    ],
  },
  '51': {
    id: '51',
    width: 3,
    height: 4,
    kind: 'room',
    grid: ['###', '###', '###', '###'],
    doors: [
      { x: 0, y: 3, side: 'S' },
      { x: 2, y: 3, side: 'S' },
    ],
  },
  '52': {
    id: '52',
    width: 4,
    height: 3,
    kind: 'room',
    grid: ['####', '####', '####'],
    doors: [
      { x: 1, y: 2, side: 'S' },
      { x: 3, y: 2, side: 'S' },
    ],
  },
  '53': {
    id: '53',
    width: 3,
    height: 2,
    kind: 'room',
    grid: ['###', '###'],
    doors: [{ x: 0, y: 1, side: 'S' }],
  },
  '54': {
    id: '54',
    width: 5,
    height: 3,
    kind: 'room',
    grid: ['#####', '#####', '#####'],
    doors: [
      { x: 1, y: 2, side: 'S' },
      { x: 4, y: 2, side: 'S' },
      { x: 4, y: 0, side: 'N' },
    ],
  },
  '55': {
    id: '55',
    width: 6,
    height: 2,
    kind: 'room',
    grid: ['######', '######'],
    doors: [
      { x: 0, y: 1, side: 'S' },
      { x: 2, y: 1, side: 'S' },
    ],
  },
  '56': {
    id: '56',
    width: 5,
    height: 4,
    kind: 'room',
    grid: ['#####', '#####', '#####', '#####'],
    doors: [
      { x: 4, y: 3, side: 'S' },
      { x: 1, y: 3, side: 'S' },
      { x: 4, y: 0, side: 'N' },
    ],
  },
  '61': {
    id: '61',
    width: 4,
    height: 5,
    kind: 'room',
    grid: ['####', '####', '####', '####', '####'],
    doors: [
      { x: 3, y: 4, side: 'S' },
      { x: 0, y: 4, side: 'S' },
      { x: 1, y: 0, side: 'N' },
    ],
  },
  '62': {
    id: '62',
    width: 3,
    height: 3,
    kind: 'room',
    grid: ['###', '###', '###'],
    doors: [{ x: 1, y: 2, side: 'S' }],
  },
  '63': {
    id: '63',
    width: 1,
    height: 5,
    kind: 'corridor',
    grid: ['#', '#', '#', '#', '#'],
    doors: [{ x: 0, y: 4, side: 'S' }],
  },
  '64': {
    id: '64',
    width: 3,
    height: 6,
    kind: 'room',
    grid: ['###', '###', '###', '###', '###', '###'],
    doors: [
      { x: 1, y: 5, side: 'S' },
      { x: 0, y: 0, side: 'N' },
      { x: 2, y: 0, side: 'N' },
    ],
  },
  '65': {
    id: '65',
    width: 3,
    height: 6,
    kind: 'room',
    grid: ['##.', '##.', '###', '###', '..#', '..#'],
    doors: [
      { x: 0, y: 3, side: 'S' },
      { x: 2, y: 5, side: 'S' },
    ],
  },
  '66': {
    id: '66',
    width: 4,
    height: 4,
    kind: 'room',
    grid: ['####', '####', '####', '####'],
    doors: [
      { x: 0, y: 3, side: 'S' },
      { x: 2, y: 3, side: 'S' },
      { x: 0, y: 0, side: 'N' },
    ],
  },
};

export function rotateSide(side: Side, turns: number): Side {
  const order: Side[] = ['N', 'E', 'S', 'W'];
  return order[(order.indexOf(side) + ((turns % 4) + 4) % 4) % 4];
}

/** Rota la sala 90° × turns (horario). Actualiza grid, tamaño y puertas. */
export function rotateRoom(room: DungeonRoom, turns: number): DungeonRoom {
  const n = ((turns % 4) + 4) % 4;
  let grid = room.grid.map((row) => row.split(''));
  let w = room.width;
  let h = room.height;
  for (let t = 0; t < n; t++) {
    const next = Array.from({ length: w }, (_, y) =>
      Array.from({ length: h }, (_, x) => grid[h - 1 - x][y]).join(''),
    );
    grid = next.map((row) => row.split(''));
    [w, h] = [h, w];
  }
  const doors = room.doors.map((d) => {
    let x = d.x;
    let y = d.y;
    let side = d.side;
    let cw = room.width;
    let ch = room.height;
    for (let t = 0; t < n; t++) {
      const nx = ch - 1 - y;
      const ny = x;
      x = nx;
      y = ny;
      side = rotateSide(side, 1);
      [cw, ch] = [ch, cw];
    }
    return { x, y, side };
  });
  return {
    ...room,
    width: w,
    height: h,
    grid: grid.map((r) => r.join('')),
    doors,
  };
}

export function getRoom(id: string): DungeonRoom | undefined {
  return dungeonRooms[id];
}

/** Lista de ids d66 disponibles (11–66). */
export function listRoomIds(): string[] {
  return Object.keys(dungeonRooms).sort();
}

/** Tirada d66 → id de sala (como string "11"…"66"). */
export function rollRoomId(d6a: number, d6b: number): string {
  const a = Math.max(1, Math.min(6, d6a | 0));
  const b = Math.max(1, Math.min(6, d6b | 0));
  return `${a}${b}`;
}
