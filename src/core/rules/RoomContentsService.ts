/**
 * RoomContentsService – resuelve tablas de contenido al revelar celdas
 */

import { rollD6 } from './DiceService';
import {
  CORRIDOR_CONTENTS,
  ROOM_CONTENTS,
  ROOM_SPECIAL_SUBTABLE,
  rowByRoll,
  type ContentKind,
  type ContentTableRow,
} from '../data/roomContents';
import {
  generateEncounter,
  type EncounterResult,
  type EncounterType,
} from './EncounterGenerator';
import type { CellKind, MapCell } from '../types/dungeon';

export type ResolvedContent = {
  roll: number;
  subRoll?: number;
  kind: ContentKind;
  label: string;
  notes?: string;
  treasureHint?: string;
  /** Si hay combate */
  encounter?: EncounterResult;
  /** Fila cruda (debug / UI) */
  row: ContentTableRow;
};

function mapKindToCellContent(kind: ContentKind): MapCell['content'] {
  switch (kind) {
    case 'empty':
      return 'empty';
    case 'encounter':
      return 'encounter';
    case 'treasure':
      return 'treasure';
    case 'trap':
    case 'hazard':
      return 'trap';
    case 'stairs_down':
      return 'stairs_down';
    case 'special':
      return 'special';
    default:
      return 'empty';
  }
}

/**
 * Tira en la tabla adecuada según el tipo de celda.
 * Las entradas del mapa inicial suelen quedar vacías (sin tirada).
 */
export function resolveCellContent(
  kind: CellKind,
  rng?: () => number,
  opts?: { skipEntrance?: boolean; isEntrance?: boolean },
): ResolvedContent {
  if (opts?.isEntrance || kind === 'entrance') {
    return {
      roll: 0,
      kind: 'empty',
      label: 'Entrada de la mazmorra',
      notes: 'Zona segura de acceso.',
      row: CORRIDOR_CONTENTS[0],
    };
  }

  const table = kind === 'corridor' ? CORRIDOR_CONTENTS : ROOM_CONTENTS;
  const roll = rollD6(rng);
  let row = rowByRoll(table, roll);
  let subRoll: number | undefined;

  // Sala “special” → subtabla
  if (kind === 'room' && row.kind === 'special') {
    subRoll = rollD6(rng);
    row = rowByRoll(ROOM_SPECIAL_SUBTABLE, subRoll);
  }

  let encounter: EncounterResult | undefined;
  if (row.kind === 'encounter' && row.encounterType) {
    encounter = generateEncounter(row.encounterType as EncounterType, rng ?? Math.random);
  }

  return {
    roll,
    subRoll,
    kind: row.kind,
    label: row.label,
    notes: row.notes,
    treasureHint: row.treasureHint,
    encounter,
    row,
  };
}

/** Aplica el resultado a una celda del mapa */
export function applyContentToCell(
  cell: MapCell,
  resolved: ResolvedContent,
): MapCell {
  return {
    ...cell,
    content: mapKindToCellContent(resolved.kind),
    label: resolved.label,
  };
}

export function formatContentLog(resolved: ResolvedContent): string {
  const bits = [
    resolved.roll > 0 ? `d6=${resolved.roll}` : null,
    resolved.subRoll != null ? `sub=${resolved.subRoll}` : null,
    resolved.label,
  ].filter(Boolean);
  let msg = bits.join(' · ');
  if (resolved.encounter) {
    msg += ` → ${resolved.encounter.template.name} x${resolved.encounter.quantity}`;
  }
  if (resolved.treasureHint) {
    msg += ` (${resolved.treasureHint})`;
  }
  return msg;
}

export { mapKindToCellContent };


/** Una sola palabra para el overlay de revelación */
export function contentWord(resolved: ResolvedContent): string {
  switch (resolved.kind) {
    case 'empty':
      return 'Vacío';
    case 'encounter':
      return resolved.encounter?.type === 'boss'
        ? 'Jefe'
        : resolved.encounter?.type === 'weird'
          ? 'Extraño'
          : resolved.encounter?.type === 'vermin'
            ? 'Vermin'
            : 'Enemigos';
    case 'treasure':
      return 'Tesoro';
    case 'trap':
      return 'Trampa';
    case 'stairs_down':
      return 'Escaleras';
    case 'hazard':
      return 'Peligro';
    case 'special':
      return 'Especial';
    default:
      return resolved.label.split(' ')[0] || 'Zona';
  }
}
