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
  /** require() del PNG de la huella */
  image: number;
};

// Metro / Expo requires (ruta desde src/core/data/)
const R = {
  '11': require('../../assets/map/rooms/room_11.png'),
  '12': require('../../assets/map/rooms/room_12.png'),
  '13': require('../../assets/map/rooms/room_13.png'),
  '14': require('../../assets/map/rooms/room_14.png'),
  '15': require('../../assets/map/rooms/room_15.png'),
  '16': require('../../assets/map/rooms/room_16.png'),
  '21': require('../../assets/map/rooms/room_21.png'),
  '22': require('../../assets/map/rooms/room_22.png'),
  '23': require('../../assets/map/rooms/room_23.png'),
  '24': require('../../assets/map/rooms/room_24.png'),
  '25': require('../../assets/map/rooms/room_25.png'),
  '26': require('../../assets/map/rooms/room_26.png'),
  '31': require('../../assets/map/rooms/room_31.png'),
  '32': require('../../assets/map/rooms/room_32.png'),
  '33': require('../../assets/map/rooms/room_33.png'),
  '34': require('../../assets/map/rooms/room_34.png'),
  '35': require('../../assets/map/rooms/room_35.png'),
  '36': require('../../assets/map/rooms/room_36.png'),
  '41': require('../../assets/map/rooms/room_41.png'),
  '42': require('../../assets/map/rooms/room_42.png'),
  '43': require('../../assets/map/rooms/room_43.png'),
  '44': require('../../assets/map/rooms/room_44.png'),
  '45': require('../../assets/map/rooms/room_45.png'),
  '46': require('../../assets/map/rooms/room_46.png'),
  '51': require('../../assets/map/rooms/room_51.png'),
  '52': require('../../assets/map/rooms/room_52.png'),
  '53': require('../../assets/map/rooms/room_53.png'),
  '54': require('../../assets/map/rooms/room_54.png'),
  '55': require('../../assets/map/rooms/room_55.png'),
  '56': require('../../assets/map/rooms/room_56.png'),
  '61': require('../../assets/map/rooms/room_61.png'),
  '62': require('../../assets/map/rooms/room_62.png'),
  '63': require('../../assets/map/rooms/room_63.png'),
  '64': require('../../assets/map/rooms/room_64.png'),
  '65': require('../../assets/map/rooms/room_65.png'),
  '66': require('../../assets/map/rooms/room_66.png'),
} as const;

export const CONTENT_SPRITE_ATLAS = require('../../assets/map/content_sprite_atlas.png');

export const dungeonRooms: Record<string, DungeonRoom> = {
  '11': {
    id: '11',
    width: 3,
    height: 3,
    kind: 'room',
    grid: ['###', '###', '###'],
    doors: [{ x: 1, y: 2, side: 'S' }],
    image: R['11'],
  },
  '12': {
    id: '12',
    width: 3,
    height: 3,
    kind: 'room',
    grid: ['###', '#.#', '###'],
    doors: [{ x: 1, y: 2, side: 'S' }],
    image: R['12'],
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
    image: R['13'],
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
    image: R['14'],
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
    image: R['15'],
  },
  '16': {
    id: '16',
    width: 3,
    height: 5,
    kind: 'room',
    grid: ['.#.', '.#.', '.#.', '.#.', '###'],
    doors: [{ x: 2, y: 4, side: 'S' }],
    image: R['16'],
  },
  '21': {
    id: '21',
    width: 3,
    height: 3,
    kind: 'room',
    grid: ['###', '###', '###'],
    doors: [{ x: 1, y: 2, side: 'S' }],
    image: R['21'],
  },
  '22': {
    id: '22',
    width: 3,
    height: 3,
    kind: 'room',
    grid: ['###', '#.#', '###'],
    doors: [{ x: 1, y: 2, side: 'S' }],
    image: R['22'],
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
    image: R['23'],
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
    image: R['24'],
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
    image: R['25'],
  },
  '26': {
    id: '26',
    width: 2,
    height: 3,
    kind: 'room',
    grid: ['##', '##', '##'],
    doors: [{ x: 1, y: 2, side: 'S' }],
    image: R['26'],
  },
  '31': {
    id: '31',
    width: 3,
    height: 3,
    kind: 'room',
    grid: ['###', '###', '###'],
    doors: [{ x: 1, y: 2, side: 'S' }],
    image: R['31'],
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
    image: R['32'],
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
    image: R['33'],
  },
  '34': {
    id: '34',
    width: 3,
    height: 3,
    kind: 'room',
    grid: ['###', '#.#', '###'],
    doors: [{ x: 1, y: 2, side: 'S' }],
    image: R['34'],
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
    image: R['35'],
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
    image: R['36'],
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
    image: R['41'],
  },
  '42': {
    id: '42',
    width: 3,
    height: 4,
    kind: 'room',
    grid: ['##.', '##.', '##.', '###'],
    doors: [{ x: 0, y: 3, side: 'S' }],
    image: R['42'],
  },
  '43': {
    id: '43',
    width: 3,
    height: 3,
    kind: 'room',
    grid: ['###', '###', '###'],
    doors: [{ x: 1, y: 2, side: 'S' }],
    image: R['43'],
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
    image: R['44'],
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
    image: R['45'],
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
    image: R['46'],
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
    image: R['51'],
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
    image: R['52'],
  },
  '53': {
    id: '53',
    width: 3,
    height: 2,
    kind: 'room',
    grid: ['###', '###'],
    doors: [{ x: 0, y: 1, side: 'S' }],
    image: R['53'],
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
    image: R['54'],
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
    image: R['55'],
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
    image: R['56'],
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
    image: R['61'],
  },
  '62': {
    id: '62',
    width: 3,
    height: 3,
    kind: 'room',
    grid: ['###', '###', '###'],
    doors: [{ x: 1, y: 2, side: 'S' }],
    image: R['62'],
  },
  '63': {
    id: '63',
    width: 1,
    height: 5,
    kind: 'corridor',
    grid: ['#', '#', '#', '#', '#'],
    doors: [{ x: 0, y: 4, side: 'S' }],
    image: R['63'],
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
    image: R['64'],
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
    image: R['65'],
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
    image: R['66'],
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
