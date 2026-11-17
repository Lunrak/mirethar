/**
 * Sobornos y stash de monstruos por casilla
 *
 * - Al sobornar: el oro/objetos pasan al stash de la casilla y el grupo evita el combate.
 * - Al volver a una casilla sobornada: piden un nuevo soborno; el stash acumula.
 * - Al derrotar a los monstruos: se recupera todo el stash + loot normal del encuentro.
 */

import { rollD6 } from './DiceService';
import type { DungeonMap, MapCell } from '../types/dungeon';
import type { CellMonsterDeal, CellStash } from '../types/stash';

export function emptyStash(): CellStash {
  return { gold: 0, items: [] };
}

/** Soborno base al primer trato (d6 × 10 gp, mín. 10) */
export function rollInitialBribe(rng?: () => number): number {
  return Math.max(10, rollD6(rng) * 10);
}

/** Nuevo soborno al volver: al menos +10 sobre el anterior, o d6×10 si mayor */
export function rollNextBribe(previousDemand: number, rng?: () => number): number {
  const roll = Math.max(10, rollD6(rng) * 10);
  return Math.max(previousDemand + 10, roll);
}

export function getDeal(cell: MapCell | undefined): CellMonsterDeal | null {
  return cell?.monsterDeal ?? null;
}

/**
 * Inicializa o actualiza el trato al descubrir monstruos en la casilla.
 * No cobra aún: solo fija la demanda actual.
 */
export function ensureMonsterDeal(
  map: DungeonMap,
  cellId: string,
  label: string,
  rng?: () => number,
): DungeonMap {
  const cell = map.cells[cellId];
  if (!cell) return map;

  if (cell.monsterDeal) {
    // Ya había trato: al reencontrar, sube la demanda
    if (cell.monsterDeal.bribed) {
      const nextBribeGold = rollNextBribe(cell.monsterDeal.nextBribeGold, rng);
      const deal: CellMonsterDeal = {
        ...cell.monsterDeal,
        label: label || cell.monsterDeal.label,
        nextBribeGold,
      };
      return {
        ...map,
        cells: {
          ...map.cells,
          [cellId]: { ...cell, monsterDeal: deal },
        },
      };
    }
    return map;
  }

  const deal: CellMonsterDeal = {
    bribed: false,
    label,
    nextBribeGold: rollInitialBribe(rng),
    stash: emptyStash(),
  };
  return {
    ...map,
    cells: {
      ...map.cells,
      [cellId]: { ...cell, monsterDeal: deal },
    },
  };
}

export type BribeResult = {
  map: DungeonMap;
  ok: boolean;
  message: string;
};

/**
 * Paga el soborno exigido (y opcionalmente objetos).
 * El pago se guarda en el stash de la casilla.
 */
export function payBribe(
  map: DungeonMap,
  cellId: string,
  opts?: { extraGold?: number; items?: string[] },
): BribeResult {
  const cell = map.cells[cellId];
  const deal = cell?.monsterDeal;
  if (!cell || !deal) {
    return { map, ok: false, message: 'No hay monstruos con quien negociar aquí.' };
  }

  const demand = deal.nextBribeGold + (opts?.extraGold ?? 0);
  const partyGold = map.goldFound ?? 0;
  if (partyGold < demand) {
    return {
      map,
      ok: false,
      message: `No tenéis suficiente oro (hacen falta ${demand} gp; lleváis ${partyGold}).`,
    };
  }

  const items = opts?.items ?? [];
  const stash: CellStash = {
    gold: deal.stash.gold + demand,
    items: [...deal.stash.items, ...items],
  };

  // Quitar objetos del botín del grupo si coinciden por nombre
  let lootItems = [...(map.lootItems ?? [])];
  for (const it of items) {
    const idx = lootItems.indexOf(it);
    if (idx >= 0) lootItems.splice(idx, 1);
  }

  const nextDeal: CellMonsterDeal = {
    ...deal,
    bribed: true,
    stash,
    // Próxima visita pedirán más
    nextBribeGold: demand,
  };

  const next: DungeonMap = {
    ...map,
    goldFound: partyGold - demand,
    lootItems,
    cells: {
      ...map.cells,
      [cellId]: {
        ...cell,
        monsterDeal: nextDeal,
        content: cell.content === 'encounter' ? 'special' : cell.content,
        label: cell.label ?? deal.label,
      },
    },
  };

  return {
    map: next,
    ok: true,
    message:
      `Sobornáis a ${deal.label} con ${demand} gp` +
      (items.length ? ` y ${items.join(', ')}` : '') +
      `. Guardan el botín en este cuarto (stash: ${stash.gold} gp` +
      (stash.items.length ? `, ${stash.items.join(', ')}` : '') +
      `). Si volvéis, pedirán aún más.`,
  };
}

export type LootClaim = {
  map: DungeonMap;
  /** Stash recuperado de sobornos previos */
  reclaimed: CellStash;
  message: string;
};

/**
 * Tras derrotar a los monstruos: recuperar stash de la casilla.
 * El loot “normal” del encuentro se añade aparte (normalGold / normalItems).
 */
export function claimRoomAfterVictory(
  map: DungeonMap,
  cellId: string,
  normalLoot?: { gold?: number; items?: string[] },
): LootClaim {
  const cell = map.cells[cellId];
  const deal = cell?.monsterDeal;
  const reclaimed: CellStash = deal
    ? { gold: deal.stash.gold, items: [...deal.stash.items] }
    : emptyStash();

  const normalGold = normalLoot?.gold ?? 0;
  const normalItems = normalLoot?.items ?? [];

  const goldFound =
    (map.goldFound ?? 0) + reclaimed.gold + normalGold;
  const lootItems = [
    ...(map.lootItems ?? []),
    ...reclaimed.items,
    ...normalItems,
  ];

  let nextCells = map.cells;
  if (cell) {
    nextCells = {
      ...map.cells,
      [cellId]: {
        ...cell,
        content: 'empty',
        monsterDeal: undefined,
        label: cell.label,
      },
    };
  }

  const parts: string[] = [];
  if (reclaimed.gold > 0 || reclaimed.items.length) {
    parts.push(
      `Recuperáis el soborno acumulado: ${reclaimed.gold} gp` +
        (reclaimed.items.length ? ` + ${reclaimed.items.join(', ')}` : ''),
    );
  }
  if (normalGold > 0 || normalItems.length) {
    parts.push(
      `Botín del combate: ${normalGold} gp` +
        (normalItems.length ? ` + ${normalItems.join(', ')}` : ''),
    );
  }
  if (!parts.length) {
    parts.push('No hay botín adicional en esta casilla.');
  }

  return {
    map: {
      ...map,
      goldFound,
      lootItems,
      cells: nextCells,
    },
    reclaimed,
    message: parts.join(' '),
  };
}

/** Texto de demanda actual para UI */
export function bribeDemandText(deal: CellMonsterDeal): string {
  const base = `${deal.label} exigen ${deal.nextBribeGold} gp`;
  if (deal.bribed) {
    return (
      `${base} (nuevo soborno; ya guardan ${deal.stash.gold} gp` +
      (deal.stash.items.length ? ` y ${deal.stash.items.join(', ')}` : '') +
      `).`
    );
  }
  return `${base} para dejaros pasar.`;
}
