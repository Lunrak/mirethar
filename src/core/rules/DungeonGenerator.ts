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
  generateBossEncounterForMap,
  hasUnexploredDoors,
} from './FinalBossService';

import { ensureMonsterDeal } from './BribeService';


import {
  resolveCellContent,
  applyContentToCell,
  formatContentLog,
  contentWord,
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

/**
 * Tras una puerta hace falta 1 casilla de unión + 1 de cuerpo (gap).
 * Comprueba que ambos pasos caben en el mapa 28×20.
 */
function doorTargetInBounds(x: number, y: number, dir: Dir): boolean {
  const { dx, dy } = DIR_DELTA[dir];
  return inBounds(x + dx, y + dy) && inBounds(x + dx * 2, y + dy * 2);
}

/** Filtra puertas de una celda que no tendrían hueco (unión + pieza) en el tablero */
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

export type ShapeViability = {
  ok: boolean;
  reason?: string;
  /** Celdas del cuerpo que sí cabrían (solo informativo si !ok) */
  placeableCount: number;
  requiredCount: number;
};

/**
 * Comprueba si una forma es viable ANTES de generar contenido o revelar:
 * - unión (gap) libre y en mapa
 * - TODAS las casillas del cuerpo en mapa y libres
 * - el cuerpo no toca otra región (salvo la unión)
 */
export function checkShapeViability(
  cells: Record<string, MapCell>,
  originX: number,
  originY: number,
  gapX: number,
  gapY: number,
  shape: ShapeRoll,
): ShapeViability {
  if (!inBounds(gapX, gapY)) {
    return {
      ok: false,
      reason: 'La unión sale del mapa',
      placeableCount: 0,
      requiredCount: shape.offsets.length,
    };
  }
  if (occupied(cells, gapX, gapY)) {
    return {
      ok: false,
      reason: 'La casilla de unión está ocupada',
      placeableCount: 0,
      requiredCount: shape.offsets.length,
    };
  }

  const required = shape.offsets.length;
  let placeable = 0;
  const bodyKeys: string[] = [];

  for (const off of shape.offsets) {
    const x = originX + off.x;
    const y = originY + off.y;
    if (!inBounds(x, y)) {
      return {
        ok: false,
        reason: `La forma «${shape.label}» no cabe en el mapa (${required} casillas)`,
        placeableCount: placeable,
        requiredCount: required,
      };
    }
    if (occupied(cells, x, y)) {
      return {
        ok: false,
        reason: `Hay una pieza bloqueando «${shape.label}»`,
        placeableCount: placeable,
        requiredCount: required,
      };
    }
    bodyKeys.push(cellKey(x, y));
    placeable++;
  }

  const bodySet = new Set(bodyKeys);
  const gapId = cellKey(gapX, gapY);

  for (const key of bodyKeys) {
    const [xs, ys] = key.split(',').map(Number);
    // cellKey format — use parse from body
    void xs;
    void ys;
  }

  for (const off of shape.offsets) {
    const x = originX + off.x;
    const y = originY + off.y;
    for (const dir of ['N', 'E', 'S', 'W'] as Dir[]) {
      const { dx, dy } = DIR_DELTA[dir];
      const nx = x + dx;
      const ny = y + dy;
      const nid = cellKey(nx, ny);
      if (nid === gapId) continue;
      if (bodySet.has(nid)) continue;
      const other = cells[nid];
      if (other?.revealed && other.regionId) {
        return {
          ok: false,
          reason: `«${shape.label}» quedaría pegada a otra pieza (hace falta hueco)`,
          placeableCount: placeable,
          requiredCount: required,
        };
      }
    }
  }

  return { ok: true, placeableCount: placeable, requiredCount: required };
}

/** Forma mínima de respaldo (pasillo 1×1) orientada a `through`. */
function minimalCorridorShape(through: Dir): ShapeRoll {
  const back = OPPOSITE[through];
  return {
    kind: 'corridor',
    label: 'pasillo corto',
    offsets: [{ x: 0, y: 0, kind: 'corridor', doors: [back, through] }],
  };
}

/**
 * Elige una forma viable: primero la tirada, luego reintentos, luego pasillo 1×1.
 * No genera contenido; solo geometría.
 */
export function pickViableShapeBeyondDoor(
  cells: Record<string, MapCell>,
  originX: number,
  originY: number,
  gapX: number,
  gapY: number,
  through: Dir,
  rng?: () => number,
  maxAttempts = 6,
): { shape: ShapeRoll; viability: ShapeViability } | null {
  const tried: ShapeRoll[] = [];
  for (let i = 0; i < maxAttempts; i++) {
    const shape = rollShapeBeyondDoor(through, rng);
    tried.push(shape);
    const v = checkShapeViability(cells, originX, originY, gapX, gapY, shape);
    if (v.ok) return { shape, viability: v };
  }
  // Último recurso: pasillo mínimo
  const fallback = minimalCorridorShape(through);
  const vf = checkShapeViability(cells, originX, originY, gapX, gapY, fallback);
  if (vf.ok) return { shape: fallback, viability: vf };
  return null;
}

function blockDoorResult(
  map: DungeonMap,
  door: Door,
  doorId: string,
  from: MapCell,
  message: string,
): GenerateResult {
  const doorsBlocked = {
    ...map.doors,
    [doorId]: { ...door, state: 'blocked' as const },
  };
  const fromCell = {
    ...from,
    doors: from.doors.filter((d) => d !== door.dir),
  };
  return {
    map: {
      ...map,
      cells: { ...map.cells, [from.id]: fromCell },
      doors: doorsBlocked,
    },
    newCellIds: [],
    message,
  };
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
  /**
   * Gap de 1 casilla entre piezas:
   * - connector (unión) en from + 1·dir  → ahí “corre” la puerta
   * - cuerpo de la nueva pieza en from + 2·dir
   * Así salas/pasillos no se pegan; solo la unión las enlaza.
   */
  const gapX = from.x + dx;
  const gapY = from.y + dy;
  const originX = from.x + dx * 2;
  const originY = from.y + dy * 2;

  // Unión o primera casilla del cuerpo fuera del mapa → puerta bloqueada
  if (!inBounds(gapX, gapY) || !inBounds(originX, originY)) {
    return blockDoorResult(
      map,
      door,
      doorId,
      from,
      `La puerta al ${door.dir} da al límite del mapa (28×20). Está bloqueada; buscad otro camino.`,
    );
  }

  // Si el hueco o el origen ya están ocupados, no se puede unir
  if (occupied(map.cells, gapX, gapY) || occupied(map.cells, originX, originY)) {
    return blockDoorResult(
      map,
      door,
      doorId,
      from,
      `No hay hueco libre tras la puerta (${door.dir}) para unir otra pieza. Buscad otro camino.`,
    );
  }

  /**
   * 1) Comprobar viabilidad de la forma (completa, con gap).
   * 2) Solo si cabe → generar contenido y revelar.
   * No se muestra overlay ni encuentro si la pieza no es viable.
   */
  const picked = pickViableShapeBeyondDoor(
    map.cells,
    originX,
    originY,
    gapX,
    gapY,
    door.dir,
    rng,
  );

  if (!picked) {
    return blockDoorResult(
      map,
      door,
      doorId,
      from,
      `No hay espacio viable tras la puerta (${door.dir}) para ninguna pieza. Puerta bloqueada; buscad otro camino.`,
    );
  }

  const shape = picked.shape;
  // Forma íntegra (sin recortar): la viabilidad ya garantizó todas las casillas
  const cells = { ...map.cells };
  const doors = { ...map.doors };
  const newCellIds: string[] = [];

  const contentLogs: string[] = [];
  let pendingEncounter: ResolvedContent | null = null;
  let pendingQuestOffer: import('../types/quest').ActiveQuest | null = null;
  let revealWord: string | null = null;
  let revealSubtitle: string | null = null;
  let quests = getQuests(map);

  // Una sola pieza: un regionId, un contenido para todo el pasillo/sala
  const regionId = uid('region');
  const shapeKind: CellKind = shape.kind;
  const resolved = resolveCellContent(shapeKind, rng);
  contentLogs.push(formatContentLog(resolved));
  revealWord = contentWord(resolved);
  revealSubtitle = shape.label;

  if (resolved.encounter) pendingEncounter = resolved;

  // Jefe final (misma lógica, una vez por pieza)
  const isBossContent =
    resolved.kind === 'encounter' &&
    (resolved.encounter?.type === 'boss' || resolved.row.encounterType === 'boss');
  const forceFinalNoDoors =
    !hasUnexploredDoors({ ...map, cells, doors }) &&
    resolved.kind === 'encounter';

  if (isBossContent || forceFinalNoDoors) {
    const { encounter, isFinal, rollInfo } = generateBossEncounterForMap(
      { ...map, cells, doors, bossesFound: map.bossesFound },
      rng,
      { forceFinal: forceFinalNoDoors },
    );
    pendingEncounter = {
      ...resolved,
      kind: 'encounter',
      label: isFinal ? 'Jefe final' : resolved.label,
      encounter,
    };
    revealWord = isFinal
      ? 'Jefe final'
      : contentWord({ ...resolved, encounter });
    if (rollInfo) {
      contentLogs.push(
        isFinal
          ? `Jefe final (d6=${rollInfo.roll}+${rollInfo.bossesBefore}=${rollInfo.total}${forceFinalNoDoors ? ', sin puertas' : ''})`
          : `Jefe normal (d6=${rollInfo.roll}+${rollInfo.bossesBefore}=${rollInfo.total})`,
      );
    }
  }

  if (shouldOfferQuest(shapeKind, resolved.kind, quests, cellKey(originX, originY), rng)) {
    const offerId = cellKey(originX, originY);
    pendingQuestOffer = rollAndAcceptQuest(offerId, rng);
    contentLogs.push(
      `PNJ ${pendingQuestOffer.giverName} ofrece: «${pendingQuestOffer.title}»`,
    );
  }

  if (shapeKind === 'room') {
    quests = advanceAllQuests(quests, 'explore_rooms');
  }
  if (resolved.kind === 'treasure') {
    quests = advanceAllQuests(quests, 'find_treasure');
  }

  // Casillas de la pieza (viabilidad ya comprobada: todas libres y en mapa)
  const regionKeys = new Set<string>();
  for (const off of shape.offsets) {
    const { x, y } = worldPos(originX, originY, off.x, off.y);
    const id = cellKey(x, y);
    regionKeys.add(id);
    let cell: MapCell = {
      id,
      x,
      y,
      kind: off.kind,
      content: 'unknown',
      doors: [],
      revealed: true,
      label: shape.label,
      regionId,
    };
    cell = applyContentToCell(cell, resolved);
    cell = { ...cell, regionId, label: shape.label };
    cells[id] = cell;
    newCellIds.push(id);
  }

  const entryId = cellKey(originX, originY);
  if (!cells[entryId]) {
    // No debería ocurrir tras checkShapeViability; defensa en profundidad
    return blockDoorResult(
      map,
      door,
      doorId,
      from,
      `Error de colocación tras la puerta (${door.dir}). Puerta bloqueada.`,
    );
  }

  // Casilla de unión en el gap: ahí se “corre” la puerta que une las dos piezas
  const gapId = cellKey(gapX, gapY);
  const gapRegionId = uid('join');
  if (!occupied(cells, gapX, gapY)) {
    const gapCell: MapCell = {
      id: gapId,
      x: gapX,
      y: gapY,
      kind: 'corridor',
      content: 'empty',
      doors: [],
      revealed: true,
      label: 'unión',
      regionId: gapRegionId,
    };
    cells[gapId] = gapCell;
    newCellIds.push(gapId);
  }

  // Puertas solo en el contorno de la pieza (hacia fuera), no entre casillas del mismo pasillo/sala
  for (const id of regionKeys) {
    const cell = cells[id];
    if (!cell) continue;
    const exteriorDirs: Dir[] = [];
    for (const dir of ['N', 'E', 'S', 'W'] as Dir[]) {
      const { dx: edx, dy: edy } = DIR_DELTA[dir];
      const nx = cell.x + edx;
      const ny = cell.y + edy;
      const nid = cellKey(nx, ny);
      // Hacia otra casilla de la misma pieza → no hay puerta
      if (regionKeys.has(nid)) continue;
      // Hacia la unión de entrada → no puerta nueva
      if (nid === gapId) continue;
      // Fuera de mapa → no puerta
      if (!inBounds(nx, ny)) continue;
      // Ya hay celda revelada de otra pieza → sin puerta nueva
      if (cells[nid]?.revealed) continue;
      exteriorDirs.push(dir);
    }
    // Limitar salidas: pasillo suele 1 hacia adelante; salas hasta 2–3
    const maxDoors =
      shapeKind === 'corridor' ? 1 : exteriorDirs.length > 3 ? 3 : exteriorDirs.length;
    // Preferir dirección "forward" (la de la puerta de origen)
    const preferred = door.dir;
    exteriorDirs.sort((a, b) =>
      a === preferred ? -1 : b === preferred ? 1 : 0,
    );
    const chosen = exteriorDirs.slice(0, Math.max(0, maxDoors));
    cells[id] = { ...cell, doors: chosen };
  }

  // La puerta de entrada ya conecta vía la unión; no duplicar hacia atrás en la primera casilla
  if (cells[entryId]) {
    const back = OPPOSITE[door.dir];
    cells[entryId] = {
      ...cells[entryId],
      doors: (cells[entryId].doors ?? []).filter((d) => d !== back),
    };
  }

  // Abrir puerta cuenta para misiones de cartografiar
  quests = advanceAllQuests(quests, 'open_doors');

  // La puerta original enlaza con la casilla de unión (gap); el cuerpo queda un paso más allá
  const firstId = gapId;
  doors[doorId] = {
    ...door,
    state: 'open',
    leadsToCellId: cells[firstId]?.id ?? door.leadsToCellId,
  };

  // Regenerar puertas explorables solo desde celdas nuevas (hacia vacío + hueco de 2)
  // No crear puertas en la casilla de unión (solo es el puente)
  for (const cid of newCellIds) {
    const cell = cells[cid];
    if (!cell || cell.regionId?.startsWith('join') || cell.label === 'unión') {
      if (cell) cell.doors = [];
      continue;
    }
    cell.doors = filterDoorsInBounds(cell.x, cell.y, cell.doors);
    for (const dir of cell.doors) {
      const { dx: ddx, dy: ddy } = DIR_DELTA[dir];
      const nx = cell.x + ddx;
      const ny = cell.y + ddy;
      const nx2 = cell.x + ddx * 2;
      const ny2 = cell.y + ddy * 2;
      if (!inBounds(nx, ny) || !inBounds(nx2, ny2)) continue;
      // Hace falta gap libre + primera casilla de cuerpo libre
      if (occupied(cells, nx, ny) || occupied(cells, nx2, ny2)) continue;
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
  let bossesFound = map.bossesFound ?? 0;
  let finalBossSpawned = map.finalBossSpawned ?? false;
  const bossEnc = pendingEncounter?.encounter;
  if (bossEnc && (bossEnc.type === 'boss' || bossEnc.isFinalBoss)) {
    bossesFound += 1;
    if (bossEnc.isFinalBoss) finalBossSpawned = true;
  }

  const next: DungeonMap = {
    ...map,
    cells,
    doors,
    partyCellId: cells[firstId]?.id ?? map.partyCellId,
    quests,
    activeQuest: quests.find((q) => q.status !== 'completed') ?? null,
    bossesFound,
    finalBossSpawned,
  };

  // Si no quedan puertas en todo el mapa y aún no hay jefe final → esta sala es el jefe final
  let outEncounter = pendingEncounter?.encounter ?? null;
  let outReveal = revealWord;
  let outMap = next;
  if (
    !outMap.finalBossSpawned &&
    !hasUnexploredDoors(outMap) &&
    !(outEncounter?.isFinalBoss)
  ) {
    const { encounter, rollInfo } = generateBossEncounterForMap(outMap, rng, {
      forceFinal: true,
    });
    outEncounter = encounter;
    outReveal = 'Jefe final';
    outMap = {
      ...outMap,
      bossesFound: (outMap.bossesFound ?? 0) + (outEncounter ? 1 : 0),
      finalBossSpawned: true,
    };
    contentLogs.push(
      `Sin más puertas — jefe final (forzado${rollInfo ? `, d6=${rollInfo.roll}` : ''})`,
    );
  }

  const contentMsg = contentLogs.length
    ? ` Contenido: ${contentLogs.join(' | ')}`
    : '';
  const ready = quests.filter((q) => q.status === 'ready_to_turn_in');
  const questMsg = ready.length
    ? `  ${ready.length} misión(es) lista(s): volved al cuarto del dador.`
    : '';

  return {
    map: outMap,
    newCellIds,
    message: `Abrís la puerta (${door.dir}): aparece ${shape.label}.${contentMsg}${questMsg}`,
    pendingEncounter: outEncounter,
    pendingQuestOffer,
    revealWord: outReveal,
    revealSubtitle,
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


/** Asocia demanda de soborno a la casilla del encuentro */
export function attachEncounterDeal(
  map: DungeonMap,
  cellId: string,
  encounterLabel: string,
  rng?: () => number,
): DungeonMap {
  return ensureMonsterDeal(map, cellId, encounterLabel, rng);
}
