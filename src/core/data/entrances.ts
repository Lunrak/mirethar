/**
 * 6 entradas de mazmorra (mapas iniciales tipo hoja de mapeo 4AD).
 * Cada una es un conjunto de celdas ya reveladas + puertas hacia lo desconocido.
 * Coordenadas: (0,0) cerca de la boca de la mazmorra; +Y hacia el interior.
 */

import type { CellKind, Dir, MapCell } from '../types/dungeon';
import { cellKey } from '../types/dungeon';

export type EntranceDef = {
  id: number;
  name: string;
  /** Descripción corta para el menú */
  blurb: string;
  /** Celdas iniciales (relativas); la con isEntrance es el acceso */
  cells: Omit<MapCell, 'id' | 'revealed'>[];
};

function c(
  x: number,
  y: number,
  kind: CellKind,
  doors: Dir[],
  opts?: { isEntrance?: boolean; label?: string; content?: MapCell['content'] },
): Omit<MapCell, 'id' | 'revealed'> {
  return {
    x,
    y,
    kind,
    doors,
    content: opts?.content ?? 'empty',
    isEntrance: opts?.isEntrance,
    label: opts?.label,
  };
}

/**
 * Seis formas distintas de empezar el mapa
 * (pasillos rectos, en L, en T, cámara, bifurcación, vestíbulo).
 */
export const ENTRANCES: EntranceDef[] = [
  {
    id: 1,
    name: 'Pasillo recto',
    blurb: 'Boca y un pasillo que se adentra; puerta al fondo.',
    cells: [
      c(0, 0, 'entrance', ['N'], { isEntrance: true, label: 'Entrada' }),
      c(0, -1, 'corridor', ['N', 'S'], { label: 'Pasillo' }),
      c(0, -2, 'corridor', ['S', 'N'], { label: 'Pasillo' }),
    ],
  },
  {
    id: 2,
    name: 'Pasillo en L',
    blurb: 'El pasillo gira a la derecha antes de la primera puerta.',
    cells: [
      c(0, 0, 'entrance', ['N'], { isEntrance: true, label: 'Entrada' }),
      c(0, -1, 'corridor', ['N', 'S'], { label: 'Pasillo' }),
      c(0, -2, 'corridor', ['S', 'E'], { label: 'Giro' }),
      c(1, -2, 'corridor', ['W', 'E'], { label: 'Pasillo' }),
    ],
  },
  {
    id: 3,
    name: 'Cruce en T',
    blurb: 'Pasillo corto que abre un cruce a izquierda y derecha.',
    cells: [
      c(0, 0, 'entrance', ['N'], { isEntrance: true, label: 'Entrada' }),
      c(0, -1, 'corridor', ['N', 'S'], { label: 'Pasillo' }),
      c(0, -2, 'corridor', ['S', 'E', 'W'], { label: 'Cruce' }),
    ],
  },
  {
    id: 4,
    name: 'Cámara inicial',
    blurb: 'Entras a una sala con varias puertas.',
    cells: [
      c(0, 0, 'entrance', ['N'], { isEntrance: true, label: 'Entrada' }),
      c(0, -1, 'room', ['S', 'N', 'E', 'W'], { label: 'Cámara' }),
    ],
  },
  {
    id: 5,
    name: 'Doble pasillo',
    blurb: 'Dos bocas de pasillo en paralelo desde el acceso.',
    cells: [
      c(0, 0, 'entrance', ['N'], { isEntrance: true, label: 'Entrada' }),
      c(0, -1, 'corridor', ['S', 'N', 'E'], { label: 'Vestíbulo' }),
      c(0, -2, 'corridor', ['S', 'N'], { label: 'Pasillo O' }),
      c(1, -1, 'corridor', ['W', 'N'], { label: 'Pasillo E' }),
      c(1, -2, 'corridor', ['S', 'N'], { label: 'Pasillo E' }),
    ],
  },
  {
    id: 6,
    name: 'Vestíbulo ancho',
    blurb: 'Sala de acceso ancha y un pasillo al norte.',
    cells: [
      c(-1, 0, 'room', ['E'], { label: 'Vestíbulo' }),
      c(0, 0, 'entrance', ['W', 'E', 'N'], { isEntrance: true, label: 'Entrada' }),
      c(1, 0, 'room', ['W'], { label: 'Vestíbulo' }),
      c(0, -1, 'corridor', ['S', 'N'], { label: 'Pasillo' }),
    ],
  },
];

export function getEntrance(id: number): EntranceDef {
  const e = ENTRANCES.find((x) => x.id === id);
  if (!e) throw new Error(`Entrada de mazmorra inválida: ${id}`);
  return e;
}

/** Materializa celdas con ids estables */
export function materializeEntranceCells(def: EntranceDef): Record<string, MapCell> {
  const out: Record<string, MapCell> = {};
  for (const raw of def.cells) {
    const id = cellKey(raw.x, raw.y);
    out[id] = {
      ...raw,
      id,
      revealed: true,
    };
  }
  return out;
}
