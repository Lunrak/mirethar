/** Botín / soborno guardado en una casilla de monstruos */
export type CellStash = {
  gold: number;
  items: string[];
};

/** Estado de monstruos sobornados en la casilla */
export type CellMonsterDeal = {
  /** Fueron sobornados al menos una vez */
  bribed: boolean;
  /** Nombre / tipo del grupo (UI) */
  label: string;
  /** Próximo soborno mínimo exigido (gp) */
  nextBribeGold: number;
  /** Stash acumulado (se recupera al derrotarlos) */
  stash: CellStash;
};
