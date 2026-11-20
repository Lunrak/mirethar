/**
 * Tipos de mazmorra – generación por etapas (GDD §2 / 4AD mapping)
 */

export type Dir = 'N' | 'E' | 'S' | 'W';

/** Hoja de mapeo fija (cuadrados) */
export const MAP_WIDTH = 28;
export const MAP_HEIGHT = 20;

export type CellKind = 'entrance' | 'corridor' | 'room';

/** Qué hay en la celda (contenido jugable; se rellena al revelar) */
export type CellContent =
  | 'empty'
  | 'stairs_down'
  | 'special'
  | 'encounter' // combate pendiente / resuelto
  | 'treasure'
  | 'trap'
  | 'unknown';

export type DoorState = 'open' | 'closed' | 'secret' | 'locked' | 'blocked';

export type Door = {
  id: string;
  /** Celda en la que está el vano */
  cellId: string;
  dir: Dir;
  state: DoorState;
  /** Si ya se generó el otro lado */
  leadsToCellId?: string;
};

export type MapCell = {
  id: string;
  x: number;
  y: number;
  kind: CellKind;
  content: CellContent;
  /** Puertas salientes aún no resueltas o abiertas */
  doors: Dir[];
  revealed: boolean;
  /** Entrada del dungeon (solo en el tile de acceso) */
  isEntrance?: boolean;
  /** Etiqueta corta para UI */
  label?: string;
  /**
   * Acuerdo / botín de monstruos en esta casilla:
   * sobornos acumulados se recuperan al derrotarlos.
   */
  monsterDeal?: import('./stash').CellMonsterDeal;
};

/** Cuerpo dejado en una casilla (p. ej. en la entrada) */
export type AbandonedBody = {
  heroId: string;
  heroName: string;
  equipmentSlots: Record<string, import('../data/items').Item | undefined>;
  leftAtCellId: string;
};

export type DungeonMap = {
  id: string;
  /** 1–6 según el mapa de entrada elegido */
  entranceId: number;
  cells: Record<string, MapCell>;
  doors: Record<string, Door>;
  /** Celda donde está el grupo */
  partyCellId: string;
  /** Semilla opcional */
  seed?: number;
  /** @deprecated usar quests[] */
  activeQuest?: import('./quest').ActiveQuest | null;
  /** Misiones aceptadas (varias; la misma plantilla puede repetirse) */
  quests?: import('./quest').ActiveQuest[];
  /** Oro acumulado en la expedición */
  goldFound?: number;
  /** Ítems / pistas de recompensa de misiones */
  lootItems?: string[];
  /** Marcas de XP de recompensa */
  xpMarks?: string[];
  /** Jefes encontrados en este mapa (para tirada de jefe final) */
  bossesFound?: number;
  /** Ya surgió el jefe final */
  finalBossSpawned?: boolean;
  /** Jefe final derrotado */
  finalBossDefeated?: boolean;
  /** Aventura procedural terminada (jefe final muerto + vuelta a entrada) */
  adventureComplete?: boolean;
  /** Cuerpos abandonados en casillas */
  abandonedBodies?: AbandonedBody[];
  /** Héroes de la expedición (para cuerpos / carga) */
  partyHeroes?: import('./combat').Hero[];
  /** Banco de XP del grupo */
  xpBank?: import('../rules/XpService').XpBank;
};

export type GenerateResult = {
  map: DungeonMap;
  /** Celdas recién añadidas */
  newCellIds: string[];
  /** Mensaje de log de exploración */
  message: string;
  /** Encuentro generado por la tabla de contenido (si aplica) */
  pendingEncounter?: import('../rules/EncounterGenerator').EncounterResult | null;
  /** PNJ ofrece misión en la celda recién revelada */
  pendingQuestOffer?: import('./quest').ActiveQuest | null;
  /** true si el encuentro pendiente es emboscada al revisitar */
  ambushEncounter?: boolean;
  /** Palabra única para overlay al revelar */
  revealWord?: string | null;
  revealSubtitle?: string | null;
};

export const DIR_DELTA: Record<Dir, { dx: number; dy: number }> = {
  N: { dx: 0, dy: -1 },
  S: { dx: 0, dy: 1 },
  E: { dx: 1, dy: 0 },
  W: { dx: -1, dy: 0 },
};

export const OPPOSITE: Record<Dir, Dir> = {
  N: 'S',
  S: 'N',
  E: 'W',
  W: 'E',
};

export function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

/** ¿(x,y) dentro de la hoja 28×20? */
export function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT;
}

/** Centro inferior: columna central, fila inferior (entrada) */
export function entranceAnchor(): { x: number; y: number } {
  return { x: Math.floor(MAP_WIDTH / 2), y: MAP_HEIGHT - 1 };
}
