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
  inBounds,
  MAP_WIDTH,
  MAP_HEIGHT,
} from '../types/dungeon';
import { rollD6 } from './DiceService';
import { generateEncounter, type EncounterResult } from './EncounterGenerator';

import {
  resolveCellContent,
  applyContentToCell,
  formatContentLog,
} from './RoomContentsService';
import type { ResolvedContent } from './RoomContentsService';
import {
  shouldOfferQuest,
  rollAndAcceptQuest,
  advanceAllQuests,
  getQuests,
  turnInQuest,
  applyLootToMap,
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

/** Casilla destino de una puerta está dentro del mapa */
function doorTargetInBounds(x: number, y: number, dir: Dir): boolean {
  const { dx, dy } = DIR_DELTA[dir];
  return inBounds(x + dx, y + dy);
}

/** Filtra puertas de una celda que saldrían del tablero 28×20 */
function filterDoorsInBounds(x: number, y: number, doors: Dir[]): Dir[] {
  return doors.filter((d) => doorTargetInBounds(x, y, d));
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
    // Limpiar puertas que apuntan fuera del mapa
    cell.doors = filterDoorsInBounds(cell.x, cell.y, cell.doors);
    for (const dir of cell.doors) {
      const { dx, dy } = DIR_DELTA[dir];
      const nx = cell.x + dx;
      const ny = cell.y + dy;
      if (!inBounds(nx, ny)) continue;
      const neighbor = cells[cellKey(nx, ny)];
      if (neighbor) continue;
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
  const forward = through;
  const back = OPPOSITE[through];
  const left: Dir =
    through === 'N' ? 'W' : through === 'S' ? 'E' : through === 'E' ? 'N' : 'S';
  const right: Dir = OPPOSITE[left];
  const F = DIR_DELTA[forward];
  const L = DIR_DELTA[left];
  const R = DIR_DELTA[right];

  if (roll <= 2) {
    // Pasillo 1×1
    return {
      kind: 'corridor',
      label: 'pasillo corto',
      offsets: [
        { x: 0, y: 0, kind: 'corridor', doors: [back, forward] },
      ],
    };
  }
  if (roll <= 4) {
    // Pasillo 1×3
    return {
      kind: 'corridor',
      label: 'pasillo',
      offsets: [
        { x: 0, y: 0, kind: 'corridor', doors: [back, forward] },
        { x: F.dx, y: F.dy, kind: 'corridor', doors: [back, forward] },
        { x: F.dx * 2, y: F.dy * 2, kind: 'corridor', doors: [back, forward] },
      ],
    };
  }
  if (roll === 5) {
    // Sala 2×2
    return {
      kind: 'room',
      label: 'sala 2×2',
      offsets: [
        { x: 0, y: 0, kind: 'room', doors: [back, left] },
        { x: L.dx, y: L.dy, kind: 'room', doors: [back, right, forward] },
        { x: F.dx, y: F.dy, kind: 'room', doors: [back, forward, left] },
        {
          x: F.dx + L.dx,
          y: F.dy + L.dy,
          kind: 'room',
          doors: [forward, right],
        },
      ],
    };
  }
  // 6 – sala 3×2
  return {
    kind: 'room',
    label: 'sala 3×2',
    offsets: [
      { x: 0, y: 0, kind: 'room', doors: [back] },
      { x: L.dx, y: L.dy, kind: 'room', doors: [back, left] },
      { x: R.dx, y: R.dy, kind: 'room', doors: [back, right] },
      { x: F.dx, y: F.dy, kind: 'room', doors: [forward] },
      { x: F.dx + L.dx, y: F.dy + L.dy, kind: 'room', doors: [forward, left] },
      { x: F.dx + R.dx, y: F.dy + R.dy, kind: 'room', doors: [forward, right] },
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
    const moved = movePartyTo(
      {
        ...map,
        doors: {
          ...map.doors,
          [doorId]: { ...door, state: 'open' },
        },
      },
      door.leadsToCellId,
      rng,
    );
    return {
      map: moved.map,
      newCellIds: [],
      message: `Cruzáis una puerta ya explorada. ${moved.message}`,
      pendingEncounter: moved.ambush,
      /** Marca emboscada para el combate */
      ambushEncounter: !!moved.ambush,
    };
  }

  const from = map.cells[door.cellId];
  if (!from) {
    return { map, newCellIds: [], message: 'Celda de origen inválida.' };
  }

  const { dx, dy } = DIR_DELTA[door.dir];
  const originX = from.x + dx;
  const originY = from.y + dy;

  // Destino inmediato fuera del mapa → puerta bloqueada, buscar otro camino
  if (!inBounds(originX, originY)) {
    const doorsBlocked = {
      ...map.doors,
      [doorId]: { ...door, state: 'blocked' as const },
    };
    // Quitar dirección de la celda origen
    const fromCell = { ...from, doors: from.doors.filter((d) => d !== door.dir) };
    return {
      map: {
        ...map,
        cells: { ...map.cells, [from.id]: fromCell },
        doors: doorsBlocked,
      },
      newCellIds: [],
      message: `La puerta al ${door.dir} da al límite del mapa (28×20). Está bloqueada; buscad otro camino.`,
    };
  }

  const shape = rollShapeBeyondDoor(door.dir, rng);
  // Si alguna casilla de la forma sale del mapa, reducir a lo que quepa; si no cabe ninguna, bloquear
  const absOffsets = shape.offsets
    .map((off) => ({
      ...off,
      ax: originX + off.x,
      ay: originY + off.y,
    }))
    .filter((o) => inBounds(o.ax, o.ay));

  if (absOffsets.length === 0 || !absOffsets.some((o) => o.ax === originX && o.ay === originY)) {
    const doorsBlocked = {
      ...map.doors,
      [doorId]: { ...door, state: 'blocked' as const },
    };
    const fromCell = { ...from, doors: from.doors.filter((d) => d !== door.dir) };
    return {
      map: {
        ...map,
        cells: { ...map.cells, [from.id]: fromCell },
        doors: doorsBlocked,
      },
      newCellIds: [],
      message: `No hay espacio en el mapa para lo que hay tras la puerta (${door.dir}). Buscad otro camino.`,
    };
  }

  const cells = { ...map.cells };
  const doors = { ...map.doors };
  const newCellIds: string[] = [];
  // Usar solo offsets que caben
  shape.offsets = absOffsets.map(({ ax, ay, kind, doors: ds, x, y }) => ({
    x: ax - originX,
    y: ay - originY,
    kind,
    doors: ds,
  }));

  const contentLogs: string[] = [];
  let pendingEncounter: ResolvedContent | null = null;
  let pendingQuestOffer: import('../types/quest').ActiveQuest | null = null;
  let quests = getQuests(map);

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

      if (shouldOfferQuest(off.kind, resolved.kind, quests, id, rng)) {
        pendingQuestOffer = rollAndAcceptQuest(id, rng);
        contentLogs.push(
          `PNJ ${pendingQuestOffer.giverName} ofrece: «${pendingQuestOffer.title}»`,
        );
      }

      // Progreso en todas las misiones activas
      if (off.kind === 'room') {
        quests = advanceAllQuests(quests, 'explore_rooms');
      }
      if (resolved.kind === 'treasure') {
        quests = advanceAllQuests(quests, 'find_treasure');
      }
    } else {
      cell = { ...cell, content: 'empty', label: shape.label };
    }
    cells[id] = cell;
    newCellIds.push(id);
  }

  // Abrir puerta cuenta para misiones de cartografiar
  quests = advanceAllQuests(quests, 'open_doors');

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
    cell.doors = filterDoorsInBounds(cell.x, cell.y, cell.doors);
    for (const dir of cell.doors) {
      const { dx: ddx, dy: ddy } = DIR_DELTA[dir];
      const nx = cell.x + ddx;
      const ny = cell.y + ddy;
      if (!inBounds(nx, ny)) continue;
      if (occupied(cells, nx, ny)) continue;
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
    quests,
    activeQuest: quests.find((q) => q.status !== 'completed') ?? null,
  };

  const contentMsg = contentLogs.length
    ? ` Contenido: ${contentLogs.join(' | ')}`
    : '';
  const ready = quests.filter((q) => q.status === 'ready_to_turn_in');
  const questMsg = ready.length
    ? `  ${ready.length} misión(es) lista(s): volved al cuarto del dador.`
    : '';

  return {
    map: next,
    newCellIds,
    message: `Abrís la puerta (${door.dir}): aparece ${shape.label}.${contentMsg}${questMsg}`,
    pendingEncounter: pendingEncounter?.encounter ?? null,
    pendingQuestOffer,
  };
}

export type RevisitResult = {
  map: DungeonMap;
  /** Se volvió a una casilla ya explorada */
  revisited: boolean;
  /** Emboscada de minions (d6=1) */
  ambush: EncounterResult | null;
  message: string;
};

/**
 * Al revisitar un pasillo/cuarto ya explorado: d6; con 1 → minions en emboscada.
 * Los enemigos atacan primero y solo al frente de marcha (reglas de combate).
 */
export function rollRevisitAmbush(
  rng?: () => number,
): { ambush: EncounterResult | null; message: string } {
  const roll = rollD6(rng);
  if (roll !== 1) {
    return {
      ambush: null,
      message: `Reexploráis la zona (d6=${roll}): sin encuentro.`,
    };
  }
  const encounter = generateEncounter('minion', rng ?? Math.random);
  return {
    ambush: encounter,
    message:
      `¡Emboscada al volver! (d6=1) ${encounter.template.name} ×${encounter.quantity}. ` +
      `Los enemigos atacan primero y solo a los 2 primeros del orden de marcha.`,
  };
}

export function movePartyTo(
  map: DungeonMap,
  cellId: string,
  rng?: () => number,
): RevisitResult {
  const cell = map.cells[cellId];
  if (!cell?.revealed) {
    return {
      map,
      revisited: false,
      ambush: null,
      message: 'Casilla no revelada.',
    };
  }
  if (cellId === map.partyCellId) {
    return {
      map,
      revisited: false,
      ambush: null,
      message: 'Ya estáis aquí.',
    };
  }

  const nextMap = { ...map, partyCellId: cellId };
  // Volver a casilla ya explorada (no es la primera visita generada en este paso)
  const { ambush, message } = rollRevisitAmbush(rng);
  return {
    map: nextMap,
    revisited: true,
    ambush,
    message,
  };
}

/** Doors saliendo de la celda del grupo (cerradas o abiertas) */
export function doorsFromPartyCell(map: DungeonMap): Door[] {
  return Object.values(map.doors).filter((d) => d.cellId === map.partyCellId);
}

export { ENTRANCES };


/** Llamar tras ganar un combate para progreso de quest */
export function noteEncounterCleared(map: DungeonMap): DungeonMap {
  const quests = advanceAllQuests(getQuests(map), 'clear_encounters');
  return {
    ...map,
    quests,
    activeQuest: quests.find((q) => q.status !== 'completed') ?? null,
  };
}

/** Aceptar la oferta: se añade a la lista (permite varias / repetidas) */
export function acceptPendingQuest(
  map: DungeonMap,
  offer: import('../types/quest').ActiveQuest,
): DungeonMap {
  const accepted = {
    ...offer,
    status: 'active' as const,
    progress: 0,
  };
  const quests = [...getQuests(map), accepted];
  return {
    ...map,
    quests,
    activeQuest: accepted,
  };
}

/** Entregar una misión concreta en el cuarto donde se recibió */
export function turnInQuestOnMap(
  map: DungeonMap,
  instanceId: string,
): { map: DungeonMap; message: string } {
  const list = getQuests(map);
  const idx = list.findIndex((q) => q.instanceId === instanceId);
  if (idx < 0) return { map, message: 'Misión no encontrada.' };
  const q = list[idx];
  if (q.status !== 'ready_to_turn_in' || map.partyCellId !== q.giverCellId) {
    return {
      map,
      message:
        'Debéis completar el objetivo y volver al cuarto donde os la dieron.',
    };
  }
  const currentLoot = {
    gold: map.goldFound ?? 0,
    items: map.lootItems ?? [],
    xpMarks: map.xpMarks ?? [],
  };
  const { quest, reward } = turnInQuest(q, currentLoot);
  const quests = list.map((x, i) => (i === idx ? quest : x));
  const next = applyLootToMap(
    {
      ...map,
      quests,
      activeQuest: quests.find((x) => x.status !== 'completed') ?? null,
    },
    reward.loot,
  );
  return { map: next, message: reward.message };
}
