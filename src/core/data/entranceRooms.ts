/**
 * Entradas 1–6 como rejillas de tiles (reconstrucción digital de los diagramas 4AD).
 *
 * Símbolos:
 *   #  muro (wall.png)
 *   .  suelo (floor.png)
 *   D  puerta (door-closed.png / door-open.png según estado)
 *   ' ' fuera de la huella (no se dibuja)
 *
 * Cada celda del grid es 192×192 px en los assets.
 * La puerta abierta/cerrada es solo estado visual en la misma celda; no cambia la geometría.
 *
 * Integración: validar lado, posición y ancho de puerta antes de unir salas.
 */

import type { Dir } from '../types/dungeon';

export const TILE_PX = 192;

export type TileChar = '#' | '.' | 'D' | ' ';

export type EntranceRoomDef = {
  id: number;
  name: string;
  /** Filas de arriba → abajo. Cada string es una fila de columnas. */
  grid: string[];
  /**
   * Puertas lógicas: posición en grid (col, row) + dirección hacia el exterior
   * (para conectar con el generador de mazmorra).
   */
  doors: { col: number; row: number; dir: Dir; label?: string }[];
  /** Ancla de la entrada (col, row) donde aparece el grupo al empezar. */
  entranceCell: { col: number; row: number };
  /** Asset de la sala completa (referencia / fallback). */
  fullImage: number; // require() result
};

// Require assets (Metro / Expo)
const IMG = {
  room1: require('../../assets/map/entrance_room_1.png'),
  room2: require('../../assets/map/entrance_room_2.png'),
  room3: require('../../assets/map/entrance_room_3.png'),
  room4: require('../../assets/map/entrance_room_4.png'),
  room5: require('../../assets/map/entrance_room_5.png'),
  room6: require('../../assets/map/entrance_room_6.png'),
  floor: require('../../assets/map/floor.png'),
  wall: require('../../assets/map/wall.png'),
  doorClosed: require('../../assets/map/door-closed.png'),
  doorOpen: require('../../assets/map/door-open.png'),
};

export const MAP_TILES = {
  floor: IMG.floor,
  wall: IMG.wall,
  doorClosed: IMG.doorClosed,
  doorOpen: IMG.doorOpen,
};

/**
 * Huellas aproximadas a partir de los PNG (192 px/celda) y diagramas 4AD.
 * Las puertas D ocupan celda completa; el generador las trata como vanos hacia fuera.
 */
export const ENTRANCE_ROOMS: EntranceRoomDef[] = [
  {
    id: 1,
    name: 'Entrada ancha con dos vanos al norte',
    grid: [
      '##D##D##',
      '#......#',
      '#......#',
      '###D####',
    ],
    doors: [
      { col: 2, row: 0, dir: 'N' },
      { col: 5, row: 0, dir: 'N' },
      { col: 3, row: 3, dir: 'S', label: 'Entrada' },
    ],
    entranceCell: { col: 3, row: 3 },
    fullImage: IMG.room1,
  },
  {
    id: 2,
    name: 'Cámara con puertas a los cuatro costados',
    grid: [
      '##D###',
      '#....#',
      'D....D',
      '#....#',
      '###D##',
    ],
    doors: [
      { col: 2, row: 0, dir: 'N' },
      { col: 0, row: 2, dir: 'W' },
      { col: 5, row: 2, dir: 'E' },
      { col: 3, row: 4, dir: 'S', label: 'Entrada' },
    ],
    entranceCell: { col: 3, row: 4 },
    fullImage: IMG.room2,
  },
  {
    id: 3,
    name: 'Sala alargada, puerta sur',
    grid: [
      '########',
      '#......#',
      '#......#',
      '#......#',
      '###D####',
    ],
    doors: [{ col: 3, row: 4, dir: 'S', label: 'Entrada' }],
    entranceCell: { col: 3, row: 4 },
    fullImage: IMG.room3,
  },
  {
    id: 4,
    name: 'Sala con vanos N, O y E',
    grid: [
      '###D####',
      '#......#',
      'D......D',
      '#......#',
      '########',
    ],
    doors: [
      { col: 3, row: 0, dir: 'N' },
      { col: 0, row: 2, dir: 'W' },
      { col: 7, row: 2, dir: 'E' },
    ],
    entranceCell: { col: 3, row: 1 },
    fullImage: IMG.room4,
  },
  {
    id: 5,
    name: 'Pasillo vertical, puertas N y S',
    grid: [
      '##D##',
      '#...#',
      '#...#',
      '#...#',
      '#...#',
      '##D##',
    ],
    doors: [
      { col: 2, row: 0, dir: 'N' },
      { col: 2, row: 5, dir: 'S', label: 'Entrada' },
    ],
    entranceCell: { col: 2, row: 5 },
    fullImage: IMG.room5,
  },
  {
    id: 6,
    name: 'Cámara cuadrada, acceso sur',
    grid: [
      '######',
      '#....#',
      '#....#',
      '#....#',
      '#....#',
      '###D##',
    ],
    doors: [{ col: 3, row: 5, dir: 'S', label: 'Entrada' }],
    entranceCell: { col: 3, row: 5 },
    fullImage: IMG.room6,
  },
];

export function getEntranceRoom(id: number): EntranceRoomDef {
  const r = ENTRANCE_ROOMS.find((x) => x.id === id);
  if (!r) throw new Error(`Entrada gráfica inválida: ${id}`);
  return r;
}

/** Rota el grid 90° horario (útil al unir salas en el futuro). */
export function rotateGridCW(grid: string[]): string[] {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const out: string[] = [];
  for (let c = 0; c < cols; c++) {
    let line = '';
    for (let r = rows - 1; r >= 0; r--) {
      line += grid[r][c] ?? ' ';
    }
    out.push(line);
  }
  return out;
}

/** Rota dirección de puerta al rotar el grid. */
export function rotateDirCW(d: Dir): Dir {
  const order: Dir[] = ['N', 'E', 'S', 'W'];
  return order[(order.indexOf(d) + 1) % 4];
}

export function tileAt(grid: string[], col: number, row: number): TileChar {
  const line = grid[row];
  if (!line || col < 0 || col >= line.length) return ' ';
  const ch = line[col];
  if (ch === '#' || ch === '.' || ch === 'D' || ch === ' ') return ch;
  return ' ';
}

export function gridSize(grid: string[]): { cols: number; rows: number } {
  return { cols: grid[0]?.length ?? 0, rows: grid.length };
}
