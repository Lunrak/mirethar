/**
 * Cuerpos caídos en mazmorra: abandonar en entrada y recuperar después.
 */

import { rollAbandonedBodyLoot } from './HeroStatus';
import type { AbandonedBody, DungeonMap } from '../types/dungeon';
import type { Hero } from '../types/combat';

export function abandonBodyAtCell(
  map: DungeonMap,
  hero: Hero,
  cellId: string,
): DungeonMap {
  const body: AbandonedBody = {
    heroId: hero.id,
    heroName: hero.name,
    equipmentSlots: { ...(hero.equipment as Record<string, import('../data/items').Item | undefined>) },
    leftAtCellId: cellId,
  };
  const abandonedBodies = [
    ...(map.abandonedBodies ?? []).filter((b) => b.heroId !== hero.id),
    body,
  ];
  // Quitar del party si estaba
  const partyHeroes = (map.partyHeroes ?? []).map((h) =>
    h.id === hero.id
      ? { ...h, equipment: {}, isFallen: true, isDead: true, life: 0 }
      : h.carryingBodyId === hero.id
        ? { ...h, carryingBodyId: undefined }
        : h,
  );
  return { ...map, abandonedBodies, partyHeroes };
}

/** Al volver a la casilla del cuerpo: 5/6 inventario robado */
export function recoverAbandonedBody(
  map: DungeonMap,
  bodyHeroId: string,
  rng?: () => number,
): { map: DungeonMap; message: string; equipmentSlots: AbandonedBody['equipmentSlots'] } {
  const bodies = map.abandonedBodies ?? [];
  const body = bodies.find((b) => b.heroId === bodyHeroId);
  if (!body) {
    return { map, message: 'No hay cuerpo aquí.', equipmentSlots: {} };
  }
  const roll = rollAbandonedBodyLoot(body.equipmentSlots as Hero['equipment'], rng);
  const abandonedBodies = bodies.filter((b) => b.heroId !== bodyHeroId);
  return {
    map: { ...map, abandonedBodies },
    message: `${body.heroName}: ${roll.message}`,
    equipmentSlots: roll.equipment as AbandonedBody['equipmentSlots'],
  };
}

export function bodiesAtCell(map: DungeonMap, cellId: string): AbandonedBody[] {
  return (map.abandonedBodies ?? []).filter((b) => b.leftAtCellId === cellId);
}
