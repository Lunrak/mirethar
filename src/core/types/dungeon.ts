/**
 * Tipos de mazmorra – generación por etapas (GDD §2 / 4AD mapping)
 */

export type Dir = 'N' | 'E' | 'S' | 'W';

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

export type DoorState = 'open' | 'closed' | 'secret' | 'locked';

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
	/** Misión activa (tabla de quests) */
	activeQuest?: import('./quest').ActiveQuest | null;
	/** Oro acumulado en la expedición (recompensas de quest, etc.) */
	goldFound?: number;
};

export type GenerateResult = {
	map: DungeonMap;
	/** Celdas recién añadidas */
	newCellIds: string[];
	/** Mensaje de log de exploración */
	message: string;
	/** Encuentro generado por la tabla de contenido (si aplica) */
	pendingEncounter?:
		| import('../rules/EncounterGenerator').EncounterResult
		| null;
	/** PNJ ofrece misión en la celda recién revelada */
	pendingQuestOffer?: import('./quest').ActiveQuest | null;
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
