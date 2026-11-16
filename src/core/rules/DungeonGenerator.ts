/**
 * DungeonGenerator – generación por etapas al abrir puertas
 * 1) Elegir una de 6 entradas
 * 2) Al cruzar una puerta cerrada → tirada → pasillo o sala + nuevas puertas
 */

import { ENTRANCES, getEntrance, materializeEntranceCells } from '../data/entrances';
import type {
  Dir,
  Door,
  DungeonMap,
  GenerateResult,
  MapCell,
  CellKind,
} from '../types/dungeon';
import {
  DIR_DELTA,
  OPPOSITE,
  cellKey,
} from '../types/dungeon';
import { rollD6 } from './DiceService';
import {
  resolveCellContent,
  applyContentToCell,
  formatContentLog,
} from './RoomContentsService';
import type { ResolvedContent } from './RoomContentsService';
import {
  shouldOfferQuest,
  rollAndAcceptQuest,
  advanceQuest,
} from './QuestService';


function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function occupied(
  cells: Record<string, MapCell>,
  x: number,
  y: number,
): boolean {
  return !!cells[cellKey(x, y)];
}

/** Puertas “hacia vacío” = explorables */
export function listExplorableDoors(map: DungeonMap): Door[] {
  return Object.values(map.doors).filter((d) => d.state === 'closed' && !d.leadsToCellId);
}

function buildDoorsForCells(
  cells: Record<string, MapCell>,
): Record<string, Door> {
  const doors: Record<string, Door> = {};
  for (const cell of Object.values(cells)) {
    for (const dir of cell.doors) {
      const { dx, dy } = DIR_DELTA[dir];
      const nx = cell.x + dx;
      const ny = cell.y + dy;
      const neighbor = cells[cellKey(nx, ny)];
      if (neighbor) {
        // Conexión interna ya revelada: puerta abierta implícita
        continue;
      }
      const id = uid('door');
      doors[id] = {
        id,
        cellId: cell.id,
        dir,
        state: 'closed',
      };
    }
  }
  return doors;
}

/**
 * Crea el mapa inicial con una de las 6 entradas (1–6).
 * Si no se pasa id, se tira d6.
 */
export function createDungeon(
  entranceId?: number,
  rng?: () => number,
): DungeonMap {
  const id = entranceId ?? rollD6(rng);
  const def = getEntrance(id);
  const cells = materializeEntranceCells(def);
  const doors = buildDoorsForCells(cells);
  const entranceCell =
    Object.values(cells).find((c) => c.isEntrance) ?? Object.values(cells)[0];

  return {
    id: uid('dungeon'),
    entranceId: def.id,
    cells,
    doors,
    partyCellId: entranceCell.id,
  };
}

export type ShapeRoll = {
  kind: CellKind;
  /** Celdas relativas al paso desde la puerta (primera = justo al otro lado) */
  offsets: { x: number; y: number; kind: CellKind; doors: Dir[] }[];
  label: string;
};

/**
 * Tirada de forma al abrir una puerta (inspirada en generación por etapas 4AD).
 * 1–2 pasillo corto, 3–4 pasillo largo, 5 sala, 6 sala con más salidas.
 */
export function rollShapeBeyondDoor(
  through: Dir,
  rng?: () => number,
): ShapeRoll {
  const roll = rollD6(rng);
  // Eje hacia adelante = `through`
  const forward = through;
  const back = OPPOSITE[through];
  const left: Dir =
    through === 'N' ? 'W' : through === 'S' ? 'E' : through === 'E' ? 'N' : 'S';
  const right: Dir = OPPOSITE[left];

  if (roll <= 2) {
    // Pasillo de 1 casilla
    return {
      kind: 'corridor',
      label: 'pasillo corto',
      offsets: [
        {
          x: 0,
          y: 0,
          kind: 'corridor',
          doors: [back, forward],
        },
      ],
    };
  }
  if (roll <= 4) {
    // Pasillo de 2 casillas
    return {
      kind: 'corridor',
      label: 'pasillo',
      offsets: [
        { x: 0, y: 0, kind: 'corridor', doors: [back, forward] },
        {
          x: DIR_DELTA[forward].dx,
          y: DIR_DELTA[forward].dy,
          kind: 'corridor',
          doors: [back, forward],
        },
      ],
    };
  }
  if (roll === 5) {
    return {
      kind: 'room',
      label: 'sala',
      offsets: [
        {
          x: 0,
          y: 0,
          kind: 'room',
          doors: [back, forward, left],
        },
      ],
    };
  }
  // 6 – sala con más puertas
  return {
    kind: 'room',
    label: 'sala grande',
    offsets: [
      {
        x: 0,
        y: 0,
        kind: 'room',
        doors: [back, forward, left, right],
      },
    ],
  };
}

/** Rota offsets: el (0,0) del shape está en la celda al otro lado de la puerta */
function worldPos(
  originX: number,
  originY: number,
  ox: number,
  oy: number,
): { x: number; y: number } {
  // offsets ya están en coordenadas de mapa absolutas relativas al primer tile
  return { x: originX + ox, y: originY + oy };
}

/**
 * Abre una puerta cerrada, genera lo que hay detrás y mueve al grupo.
 */
export function openDoor(
  map: DungeonMap,
  doorId: string,
  rng?: () => number,
): GenerateResult {
  const door = map.doors[doorId];
  if (!door) {
    return { map, newCellIds: [], message: 'Puerta no encontrada.' };
  }
  if (door.leadsToCellId) {
    return {
      map: {
        ...map,
        partyCellId: door.leadsToCellId,
        doors: {
          ...map.doors,
          [doorId]: { ...door, state: 'open' },
        },
      },
      newCellIds: [],
      message: 'Cruzáis una puerta ya explorada.',
    };
  }

  const from = map.cells[door.cellId];
  if (!from) {
    return { map, newCellIds: [], message: 'Celda de origen inválida.' };
  }

  const { dx, dy } = DIR_DELTA[door.dir];
  const originX = from.x + dx;
  const originY = from.y + dy;

  const shape = rollShapeBeyondDoor(door.dir, rng);
  const cells = { ...map.cells };
  const doors = { ...map.doors };
  const newCellIds: string[] = [];

  const contentLogs: string[] = [];
  let pendingEncounter: ResolvedContent | null = null;
  let pendingQuestOffer: import('../types/quest').ActiveQuest | null = null;
  let quest = map.activeQuest ?? null;

  for (const off of shape.offsets) {
    const { x, y } = worldPos(originX, originY, off.x, off.y);
    const id = cellKey(x, y);
    if (occupied(cells, x, y)) {
      continue;
    }
    let cell: MapCell = {
      id,
      x,
      y,
      kind: off.kind,
      content: 'unknown',
      doors: [...off.doors],
      revealed: true,
      label: shape.label,
    };
    // Solo la primera casilla nueva resuelve contenido de la zona
    if (newCellIds.length === 0) {
      const resolved = resolveCellContent(off.kind, rng);
      cell = applyContentToCell(cell, resolved);
      contentLogs.push(formatContentLog(resolved));
      if (resolved.encounter) pendingEncounter = resolved;

      const hasQuest = !!quest && quest.status !== 'completed';
      if (shouldOfferQuest(off.kind, resolved.kind, hasQuest, rng)) {
        pendingQuestOffer = rollAndAcceptQuest(id, rng);
        contentLogs.push(
          `PNJ ${pendingQuestOffer.giverName} ofrece: «${pendingQuestOffer.title}»`,
        );
      }

      // Progreso: salas exploradas / tesoros
      if (off.kind === 'room' && resolved.kind !== 'empty') {
        quest = advanceQuest(quest, 'explore_rooms');
      } else if (off.kind === 'room') {
        quest = advanceQuest(quest, 'explore_rooms');
      }
      if (resolved.kind === 'treasure') {
        quest = advanceQuest(quest, 'find_treasure');
      }
    } else {
      cell = { ...cell, content: 'empty', label: shape.label };
    }
    cells[id] = cell;
    newCellIds.push(id);
  }

  // Abrir puerta cuenta para misiones de cartografiar
  quest = advanceQuest(quest, 'open_doors');

  const firstId = cellKey(originX, originY);
  // Marcar puerta como abierta y conectada
  doors[doorId] = {
    ...door,
    state: 'open',
    leadsToCellId: cells[firstId]?.id ?? door.leadsToCellId,
  };

  // Regenerar puertas explorables solo desde celdas nuevas (hacia vacío)
  for (const cid of newCellIds) {
    const cell = cells[cid];
    for (const dir of cell.doors) {
      const { dx: ddx, dy: ddy } = DIR_DELTA[dir];
      const nx = cell.x + ddx;
      const ny = cell.y + ddy;
      if (occupied(cells, nx, ny)) continue;
      // Evitar puerta duplicada en sentido contrario ya listada
      const exists = Object.values(doors).some(
        (d) => d.cellId === cell.id && d.dir === dir && !d.leadsToCellId,
      );
      if (exists) continue;
      const nid = uid('door');
      doors[nid] = {
        id: nid,
        cellId: cell.id,
        dir,
        state: 'closed',
      };
    }
  }

  // Quitar de la celda origen la puerta ya abierta de la lista lógica (opcional)
  const next: DungeonMap = {
    ...map,
    cells,
    doors,
    partyCellId: cells[firstId]?.id ?? map.partyCellId,
    activeQuest: quest,
  };

  const contentMsg = contentLogs.length
    ? ` Contenido: ${contentLogs.join(' | ')}`
    : '';
  const questMsg =
    quest && quest.status === 'ready_to_turn_in'
      ? '  Misión lista: volved al cuarto del dador.'
      : '';

  return {
    map: next,
    newCellIds,
    message: `Abrís la puerta (${door.dir}): aparece ${shape.label}.${contentMsg}${questMsg}`,
    pendingEncounter: pendingEncounter?.encounter ?? null,
    pendingQuestOffer,
  };
}

export function movePartyTo(map: DungeonMap, cellId: string): DungeonMap {
  if (!map.cells[cellId]?.revealed) return map;
  return { ...map, partyCellId: cellId };
}

/** Doors saliendo de la celda del grupo (cerradas o abiertas) */
export function doorsFromPartyCell(map: DungeonMap): Door[] {
  return Object.values(map.doors).filter((d) => d.cellId === map.partyCellId);
}

export { ENTRANCES };


/** Llamar tras ganar un combate para progreso de quest */
export function noteEncounterCleared(map: DungeonMap): DungeonMap {
  const q = advanceQuest(map.activeQuest, 'clear_encounters');
  return { ...map, activeQuest: q };
}

/** Aceptar la oferta de misión (la ancla al mapa) */
export function acceptPendingQuest(
  map: DungeonMap,
  offer: import('../types/quest').ActiveQuest,
): DungeonMap {
  return { ...map, activeQuest: { ...offer, status: 'active', progress: 0 } };
}
