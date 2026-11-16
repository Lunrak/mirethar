/**
 * Tablas de contenido de mazmorra (data-driven)
 * Estructura tipo 4AD: d6 por pasillo / sala.
 * Textos y categorías del GDD; sin copiar redacción del manual.
 */

import type { EncounterType } from '../rules/EncounterGenerator';

export type ContentKind =
  | 'empty'
  | 'encounter'
  | 'treasure'
  | 'trap'
  | 'special'
  | 'stairs_down'
  | 'hazard';

/** Resultado resuelto de una fila de tabla */
export type ContentTableRow = {
  /** 1–6 */
  roll: number;
  kind: ContentKind;
  /** Texto corto para log / UI */
  label: string;
  /** Si kind === encounter */
  encounterType?: EncounterType;
  /** Tesoro simple (gp o tirada) */
  treasureHint?: string;
  /** Notas de regla */
  notes?: string;
};

/** Contenido de PASILLO (al revelar tramos de corridor) */
export const CORRIDOR_CONTENTS: ContentTableRow[] = [
  {
    roll: 1,
    kind: 'empty',
    label: 'Pasillo vacío',
    notes: 'Nada de interés.',
  },
  {
    roll: 2,
    kind: 'empty',
    label: 'Pasillo vacío',
    notes: 'Solo eco y polvo.',
  },
  {
    roll: 3,
    kind: 'encounter',
    label: 'Vermin en el pasillo',
    encounterType: 'vermin',
  },
  {
    roll: 4,
    kind: 'trap',
    label: 'Trampa en el pasillo',
    notes: 'Desarme / salvación según clase (púas, foso, dardos…).',
  },
  {
    roll: 5,
    kind: 'encounter',
    label: 'Minions bloquean el paso',
    encounterType: 'minion',
  },
  {
    roll: 6,
    kind: 'special',
    label: 'Detalle especial',
    notes: 'Inscripción, rastros, atajo o pista (narrativo en MVP).',
  },
];

/** Contenido de SALA / cámara */
export const ROOM_CONTENTS: ContentTableRow[] = [
  {
    roll: 1,
    kind: 'empty',
    label: 'Sala vacía',
    notes: 'Podéis descansar con cautela.',
  },
  {
    roll: 2,
    kind: 'encounter',
    label: 'Enemigos (vermin)',
    encounterType: 'vermin',
  },
  {
    roll: 3,
    kind: 'encounter',
    label: 'Enemigos (minions)',
    encounterType: 'minion',
  },
  {
    roll: 4,
    kind: 'treasure',
    label: 'Tesoro sin custodia',
    treasureHint: '1d6 × 10 gp (o tirada de tesoro del nivel)',
    notes: 'Puede haber cerradura o trampa menor.',
  },
  {
    roll: 5,
    kind: 'encounter',
    label: 'Encuentro serio',
    encounterType: 'boss',
    notes: 'Jefe o amenaza fuerte; preparar combate.',
  },
  {
    roll: 6,
    kind: 'special',
    label: 'Extraño / escaleras',
    notes: 'Tirada secundaria: weird, escaleras abajo o evento especial.',
  },
];

/** Subtabla cuando sale “special” en sala (d6) */
export const ROOM_SPECIAL_SUBTABLE: ContentTableRow[] = [
  {
    roll: 1,
    kind: 'stairs_down',
    label: 'Escaleras que bajan',
    notes: 'Acceso a un nivel inferior (futuro).',
  },
  {
    roll: 2,
    kind: 'stairs_down',
    label: 'Pozo / escaleras',
    notes: 'Bajada opcional.',
  },
  {
    roll: 3,
    kind: 'encounter',
    label: 'Monstruo raro (Weird)',
    encounterType: 'weird',
  },
  {
    roll: 4,
    kind: 'treasure',
    label: 'Escondrijo',
    treasureHint: 'Tesoro menor + posible pista',
  },
  {
    roll: 5,
    kind: 'trap',
    label: 'Trampa de sala',
    notes: 'Afecta al entrar; rogue puede detectar.',
  },
  {
    roll: 6,
    kind: 'hazard',
    label: 'Peligro del entorno',
    notes: 'Gas, hongos, oscuridad densa, altar…',
  },
];

export function rowByRoll(table: ContentTableRow[], roll: number): ContentTableRow {
  const row = table.find((r) => r.roll === roll);
  return row ?? table[0];
}
