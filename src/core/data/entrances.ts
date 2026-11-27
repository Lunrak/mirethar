/**
 * 6 entradas de mazmorra sobre hoja 28×20.
 * Coordenadas relativas al ancla (centro inferior): (0,0) = entrada.
 * +Y en datos relativos = hacia el interior = y de mapa decrece (norte).
 */

import type { CellKind, Dir, MapCell } from '../types/dungeon';
import { cellKey, entranceAnchor, inBounds } from '../types/dungeon';

export type EntranceDef = {
  id: number;
  name: string;
  blurb: string;
  /**
   * Celdas relativas: rx, ry donde ry>=0 hacia el interior (norte).
   * Se transforma a absolutas con ancla en centro-inferior.
   */
  cells: {
    rx: number;
    ry: number;
    kind: CellKind;
    doors: Dir[];
    isEntrance?: boolean;
    label?: string;
  }[];
};

function c(
  rx: number,
  ry: number,
  kind: CellKind,
  doors: Dir[],
  opts?: { isEntrance?: boolean; label?: string },
): EntranceDef['cells'][number] {
  return {
    rx,
    ry,
    kind,
    doors,
    isEntrance: opts?.isEntrance,
    label: opts?.label,
  };
}

/**
 * Formas iniciales (ocupación en cuadrados, estilo hoja de mapeo).
 * ry crece hacia el norte (interior).
 */
export const ENTRANCES: EntranceDef[] = [
  {
    id: 1,
    name: 'Pasillo recto',
    blurb: 'Entrada y pasillo de 3 tramos hacia el interior.',
    cells: [
      c(0, 0, 'entrance', ['N'], { isEntrance: true, label: 'Entrada' }),
      c(0, 1, 'corridor', ['N', 'S'], { label: 'Pasillo' }),
      c(0, 2, 'corridor', ['N', 'S'], { label: 'Pasillo' }),
      c(0, 3, 'corridor', ['S', 'N'], { label: 'Pasillo' }),
    ],
  },
  {
    id: 2,
    name: 'Pasillo en L',
    blurb: 'Pasillo que gira a estribor antes de la primera puerta.',
    cells: [
      c(0, 0, 'entrance', ['N'], { isEntrance: true, label: 'Entrada' }),
      c(0, 1, 'corridor', ['N', 'S'], { label: 'Pasillo' }),
      c(0, 2, 'corridor', ['S', 'E'], { label: 'Giro' }),
      c(1, 2, 'corridor', ['W', 'E'], { label: 'Pasillo' }),
      c(2, 2, 'corridor', ['W', 'E'], { label: 'Pasillo' }),
    ],
  },
  {
    id: 3,
    name: 'Cruce en T',
    blurb: 'Pasillo y cruce a izquierda y derecha.',
    cells: [
      c(0, 0, 'entrance', ['N'], { isEntrance: true, label: 'Entrada' }),
      c(0, 1, 'corridor', ['N', 'S'], { label: 'Pasillo' }),
      c(0, 2, 'corridor', ['S', 'E', 'W', 'N'], { label: 'Cruce' }),
      c(-1, 2, 'corridor', ['E', 'W'], { label: 'Brazo O' }),
      c(1, 2, 'corridor', ['W', 'E'], { label: 'Brazo E' }),
    ],
  },
  {
    id: 4,
    name: 'Cámara 2×2',
    blurb: 'Entrada a una cámara de cuatro cuadrados.',
    cells: [
      c(0, 0, 'entrance', ['N'], { isEntrance: true, label: 'Entrada' }),
      c(0, 1, 'room', ['S', 'N', 'E', 'W'], { label: 'Cámara' }),
      c(1, 1, 'room', ['W', 'N', 'S'], { label: 'Cámara' }),
      c(0, 2, 'room', ['S', 'N', 'E'], { label: 'Cámara' }),
      c(1, 2, 'room', ['S', 'W', 'N'], { label: 'Cámara' }),
    ],
  },
  {
    id: 5,
    name: 'Doble pasillo',
    blurb: 'Dos pasillos paralelos desde el acceso.',
    cells: [
      c(0, 0, 'entrance', ['N'], { isEntrance: true, label: 'Entrada' }),
      c(0, 1, 'corridor', ['S', 'N', 'E'], { label: 'Vestíbulo' }),
      c(0, 2, 'corridor', ['S', 'N'], { label: 'Pasillo O' }),
      c(0, 3, 'corridor', ['S', 'N'], { label: 'Pasillo O' }),
      c(1, 1, 'corridor', ['W', 'N'], { label: 'Pasillo E' }),
      c(1, 2, 'corridor', ['S', 'N'], { label: 'Pasillo E' }),
      c(1, 3, 'corridor', ['S', 'N'], { label: 'Pasillo E' }),
    ],
  },
  {
    id: 6,
    name: 'Vestíbulo ancho',
    blurb: 'Vestíbulo de 3×2 y pasillo al norte.',
    cells: [
      c(-1, 0, 'room', ['E', 'N'], { label: 'Vestíbulo' }),
      c(0, 0, 'entrance', ['W', 'E', 'N'], { isEntrance: true, label: 'Entrada' }),
      c(1, 0, 'room', ['W', 'N'], { label: 'Vestíbulo' }),
      c(-1, 1, 'room', ['S', 'E', 'N'], { label: 'Vestíbulo' }),
      c(0, 1, 'room', ['S', 'E', 'W', 'N'], { label: 'Vestíbulo' }),
      c(1, 1, 'room', ['S', 'W', 'N'], { label: 'Vestíbulo' }),
      c(0, 2, 'corridor', ['S', 'N'], { label: 'Pasillo' }),
    ],
  },
];

export function getEntrance(id: number): EntranceDef {
  const e = ENTRANCES.find((x) => x.id === id);
  if (!e) throw new Error(`Entrada de mazmorra inválida: ${id}`);
  return e;
}

/** Relativo (rx, ry interior) → absoluto en hoja 28×20 */
export function relToAbs(rx: number, ry: number): { x: number; y: number } {
  const a = entranceAnchor();
  // interior = norte = y decrece
  return { x: a.x + rx, y: a.y - ry };
}

export function materializeEntranceCells(
  def: EntranceDef,
): Record<string, MapCell> {
  const out: Record<string, MapCell> = {};
  /** Misma etiqueta → misma región (toda la cámara / pasillo de la entrada). */
  const labelToRegion = new Map<string, string>();
  for (const raw of def.cells) {
    const { x, y } = relToAbs(raw.rx, raw.ry);
    if (!inBounds(x, y)) continue;
    const id = cellKey(x, y);
    const labelKey = raw.label ?? raw.kind;
    if (!labelToRegion.has(labelKey)) {
      labelToRegion.set(
        labelKey,
        `entrance_${def.id}_${labelKey.replace(/\s+/g, '_')}`,
      );
    }
    out[id] = {
      id,
      x,
      y,
      kind: raw.kind,
      doors: [...raw.doors],
      content: 'empty',
      revealed: true,
      isEntrance: raw.isEntrance,
      label: raw.label,
      regionId: labelToRegion.get(labelKey),
    };
  }
  return out;
}
