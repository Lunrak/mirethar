/**
 * HeroStatus – estados de héroes 4AD / GDD
 *
 * vivo     → life > 0, !isFallen, !isDead
 * herido   → life > 0 && life < maxLife, !isFallen, !isDead
 * caído    → life <= 0, isFallen, !isDead  (aún se puede curar en combate)
 * muerto   → isDead (permanente; si no se curó el caído al final del combate)
 *
 * Cargar cadáver: un héroe vivo puede llevar el cuerpo de un caído/muerto
 * (carryingBodyId). En el MVP se expone la API; el flujo de mazmorra lo usará después.
 */

import type { CombatState, CombatPosition, Hero, Item } from '../types/combat';

export type HeroStatusKind = 'alive' | 'wounded' | 'fallen' | 'dead';

export function getHeroStatus(hero: Hero): HeroStatusKind {
  if (hero.isDead) return 'dead';
  if (hero.isFallen || hero.life <= 0) return 'fallen';
  if (hero.life < hero.maxLife) return 'wounded';
  return 'alive';
}

export function isCombatCapable(hero: Hero): boolean {
  return !hero.isDead && !hero.isFallen && hero.life > 0;
}

/**
 * Aplica daño a un héroe. Si llega a 0 → caído (no muerto todavía).
 */
export function applyDamageToHero(hero: Hero, damage: number): Hero {
  if (hero.isDead || damage <= 0) return hero;

  const life = Math.max(0, hero.life - damage);
  const fallen = life <= 0;

  return {
    ...hero,
    life,
    isFallen: fallen ? true : hero.isFallen,
    // isDead no se pone aquí: solo al finalizar combate sin curar
  };
}

/**
 * Cura a un héroe. Si estaba caído y life > 0 tras la cura → deja de estar caído.
 * No revive muertos.
 */
export function applyHealToHero(hero: Hero, amount: number): Hero {
  if (hero.isDead || amount <= 0) return hero;

  const life = Math.min(hero.maxLife, Math.max(0, hero.life) + amount);
  return {
    ...hero,
    life,
    isFallen: life <= 0,
  };
}

/**
 * Al terminar el combate: todo caído no curado → muerto permanente.
 * Devuelve los héroes actualizados y la lista de ids que murieron ahora.
 */
export function finalizeFallenHeroes(heroes: Hero[]): {
  heroes: Hero[];
  newlyDeadIds: string[];
} {
  const newlyDeadIds: string[] = [];
  const next = heroes.map((h) => {
    if (!h.isDead && (h.isFallen || h.life <= 0)) {
      newlyDeadIds.push(h.id);
      return {
        ...h,
        life: 0,
        isFallen: true,
        isDead: true,
        // Quien cargaba este cuerpo ya no puede (se resuelve aparte)
      };
    }
    return h;
  });

  return { heroes: next, newlyDeadIds };
}

/**
 * Un héroe vivo carga el cadáver de otro (caído o muerto).
 * Reglas MVP:
 * - carrier debe estar vivo y no caído
 * - body debe estar caído o muerto
 * - un carrier solo puede llevar un cuerpo
 * - el cuerpo no puede estar ya siendo llevado por otro
 */
export function pickUpBody(
  heroes: Hero[],
  carrierId: string,
  bodyId: string
): { heroes: Hero[]; ok: boolean; message: string } {
  const carrier = heroes.find((h) => h.id === carrierId);
  const body = heroes.find((h) => h.id === bodyId);

  if (!carrier || !body) {
    return { heroes, ok: false, message: 'Héroe o cuerpo no encontrado.' };
  }
  if (!isCombatCapable(carrier)) {
    return { heroes, ok: false, message: `${carrier.name} no puede cargar (caído/muerto).` };
  }
  if (carrier.carryingBodyId) {
    return { heroes, ok: false, message: `${carrier.name} ya carga un cuerpo.` };
  }
  if (getHeroStatus(body) !== 'fallen' && getHeroStatus(body) !== 'dead') {
    return { heroes, ok: false, message: `${body.name} no está caído ni muerto.` };
  }
  if (heroes.some((h) => h.carryingBodyId === bodyId)) {
    return { heroes, ok: false, message: `${body.name} ya está siendo cargado.` };
  }

  const next = heroes.map((h) =>
    h.id === carrierId ? { ...h, carryingBodyId: bodyId } : h
  );

  return {
    heroes: next,
    ok: true,
    message: `${carrier.name} carga el cuerpo de ${body.name}.`,
  };
}

export function dropBody(
  heroes: Hero[],
  carrierId: string
): { heroes: Hero[]; ok: boolean; message: string } {
  const carrier = heroes.find((h) => h.id === carrierId);
  if (!carrier?.carryingBodyId) {
    return { heroes, ok: false, message: 'No carga ningún cuerpo.' };
  }

  const body = heroes.find((h) => h.id === carrier.carryingBodyId);
  const next = heroes.map((h) =>
    h.id === carrierId ? { ...h, carryingBodyId: undefined } : h
  );

  return {
    heroes: next,
    ok: true,
    message: `${carrier.name} deja el cuerpo de ${body?.name ?? 'desconocido'}.`,
  };
}

/**
 * Si el carrier cae o muere, suelta el cuerpo automáticamente.
 */
export function releaseBodyIfCarrierDown(heroes: Hero[]): Hero[] {
  return heroes.map((h) => {
    if ((h.isFallen || h.isDead || h.life <= 0) && h.carryingBodyId) {
      return { ...h, carryingBodyId: undefined };
    }
    return h;
  });
}

/**
 * Aplica finalizeFallenHeroes al CombatState al terminar el combate.
 * También libera cuerpos de carriers caídos.
 */
export function finalizeCombatHeroes(state: CombatState): CombatState {
  if (!state.isFinished) return state;

  let heroes = releaseBodyIfCarrierDown(state.heroes);
  const { heroes: finalized, newlyDeadIds } = finalizeFallenHeroes(heroes);

  const deathLogs = newlyDeadIds.map((id) => {
    const name = finalized.find((h) => h.id === id)?.name ?? id;
    return {
      id: `log_dead_${id}`,
      message: `${name} muere (no curado antes del final del combate).`,
      timestamp: Date.now(),
    };
  });

  return {
    ...state,
    heroes: finalized,
    log: [...state.log, ...deathLogs],
  };
}



/**
 * Acceder al inventario de un compañero caído (cuesta el turno en combate).
 * Transfiere todo el equipo del caído a una lista de botín recuperado.
 */
export function scavengeFallenInventory(
  heroes: Hero[],
  actorId: string,
  fallenId: string,
): {
  heroes: Hero[];
  looted: Item[];
  ok: boolean;
  message: string;
} {
  const actor = heroes.find((h) => h.id === actorId);
  const fallen = heroes.find((h) => h.id === fallenId);
  if (!actor || !fallen) {
    return { heroes, looted: [], ok: false, message: 'Héroe no encontrado.' };
  }
  if (!isCombatCapable(actor)) {
    return { heroes, looted: [], ok: false, message: `${actor.name} no puede actuar.` };
  }
  if (!fallen.isFallen && fallen.life > 0 && !fallen.isDead) {
    return { heroes, looted: [], ok: false, message: `${fallen.name} no está caído.` };
  }

  const looted: Item[] = [];
  const emptyEq: Hero['equipment'] = {};
  for (const [slot, item] of Object.entries(fallen.equipment ?? {})) {
    if (item) looted.push(item as Item);
  }

  const next = heroes.map((h) => {
    if (h.id === fallenId) {
      return { ...h, equipment: emptyEq };
    }
    return h;
  });

  return {
    heroes: next,
    looted,
    ok: true,
    message:
      looted.length > 0
        ? `${actor.name} registra a ${fallen.name} y recupera: ${looted.map((i) => i.name).join(', ')}.`
        : `${actor.name} registra a ${fallen.name}: inventario vacío.`,
  };
}

/** Portador del cuerpo va al final del orden de marcha (retaguardia). */
export function moveCarrierToRear(
  positions: CombatPosition,
  carrierId: string,
): CombatPosition {
  const front = positions.front.filter((id) => id !== carrierId);
  const rear = positions.rear.filter((id) => id !== carrierId);
  return {
    front,
    rear: [...rear, carrierId],
  };
}

/**
 * Al dejar el cuerpo solo y volver después: 5/6 de que hayan robado el inventario.
 */
export function rollAbandonedBodyLoot(
  equipment: Hero['equipment'],
  rng: () => number = Math.random,
): { equipment: Hero['equipment']; stolen: boolean; message: string } {
  const roll = Math.floor(rng() * 6) + 1;
  if (roll <= 5) {
    return {
      equipment: {},
      stolen: true,
      message: `d6=${roll}: el cuerpo fue saqueado; el inventario está vacío.`,
    };
  }
  return {
    equipment: { ...equipment },
    stolen: false,
    message: `d6=${roll}: el inventario del cuerpo sigue intacto.`,
  };
}
