/**
 * Jefe final de mazmorra procedural (no aventura predefinida)
 *
 * - Cada jefe encontrado: d6 + nº de jefes ya vistos en el mapa; ≥6 → jefe final
 * - Si no quedan puertas explorables en el mapa → el contenido pasa a jefe final
 * - Modificadores: +1 life, +1 ataque/turno, reacción always fight to death,
 *   oro ×3, si hay objeto mágico en recompensa → 2
 */

import { rollD6 } from './DiceService';
import { generateEncounter, type EncounterResult } from './EncounterGenerator';
import type { DungeonMap } from '../types/dungeon';
import type { EnemyInstance, EnemyTemplate, ReactionType } from '../types/combat';

const FIGHT_TO_DEATH: ReactionType = 'fight_to_death';

export function hasMagicItemReward(template: EnemyTemplate): boolean {
  const blob = [...template.specialRules, JSON.stringify(template.reactions)].join(' ');
  return /magic item|magical item|objeto mágico|magic weapon|magic armor/i.test(blob);
}

/** ¿Quedan puertas cerradas sin explorar en todo el mapa? */
export function hasUnexploredDoors(map: DungeonMap): boolean {
  return Object.values(map.doors).some(
    (d) => d.state === 'closed' && !d.leadsToCellId,
  );
}

/**
 * Tirada de jefe final: d6 + bossesFoundAlready.
 * bossesFoundAlready = jefes ya encontrados ANTES de este (0 la primera vez).
 * Resultado ≥ 6 → es el jefe final.
 */
export function rollIsFinalBoss(
  bossesFoundAlready: number,
  rng?: () => number,
): { isFinal: boolean; roll: number; total: number } {
  const roll = rollD6(rng);
  const total = roll + bossesFoundAlready;
  return { isFinal: total >= 6, roll, total };
}

/** Aplica modificadores de jefe final a un encuentro boss */
export function applyFinalBossModifiers(enc: EncounterResult): EncounterResult {
  const template: EnemyTemplate = {
    ...enc.template,
    name: `${enc.template.name} (Jefe final)`,
    life: enc.template.life + 1,
    attacks: enc.template.attacks + 1,
    treasureModifier: enc.template.treasureModifier, // oro se triplica al resolver botín
    reactions: {
      1: FIGHT_TO_DEATH,
      2: FIGHT_TO_DEATH,
      3: FIGHT_TO_DEATH,
      4: FIGHT_TO_DEATH,
      5: FIGHT_TO_DEATH,
      6: FIGHT_TO_DEATH,
    },
    specialRules: [
      ...enc.template.specialRules,
      'Jefe final: combate hasta la muerte.',
      'Jefe final: recompensa en oro ×3.',
      ...(hasMagicItemReward(enc.template)
        ? ['Jefe final: si hay objeto mágico, se reciben 2.']
        : []),
    ],
  };

  const enemies: EnemyInstance[] = enc.enemies.map((e) => ({
    ...e,
    name: template.name,
    currentLife: (e.maxLife ?? e.currentLife) + 1,
    maxLife: (e.maxLife ?? e.currentLife) + 1,
    attacks: e.attacks + 1,
    isFinalBoss: true,
  }));

  return {
    ...enc,
    template,
    enemies,
    isFinalBoss: true,
  };
}

/** Genera un jefe (normal o final según tirada / puertas) */
export function generateBossEncounterForMap(
  map: DungeonMap,
  rng?: () => number,
  opts?: { forceFinal?: boolean },
): {
  encounter: EncounterResult;
  isFinal: boolean;
  rollInfo?: { roll: number; total: number; bossesBefore: number };
} {
  const bossesBefore = map.bossesFound ?? 0;
  const noDoors = !hasUnexploredDoors(map);
  const force = !!opts?.forceFinal || noDoors;

  let isFinal = force;
  let rollInfo: { roll: number; total: number; bossesBefore: number } | undefined;

  if (!force) {
    const r = rollIsFinalBoss(bossesBefore, rng);
    isFinal = r.isFinal;
    rollInfo = { roll: r.roll, total: r.total, bossesBefore };
  } else {
    rollInfo = { roll: 6, total: 6 + bossesBefore, bossesBefore };
  }

  let encounter = generateEncounter('boss', rng ?? Math.random);
  if (isFinal) {
    encounter = applyFinalBossModifiers(encounter);
  }

  return { encounter, isFinal, rollInfo };
}

/** Oro base de boss → ×3 si final */
export function finalBossGoldReward(
  baseGold: number,
  isFinal: boolean,
): number {
  return isFinal ? baseGold * 3 : baseGold;
}

/** Cantidad de objetos mágicos de recompensa */
export function finalBossMagicItemCount(
  template: EnemyTemplate,
  isFinal: boolean,
): number {
  if (!hasMagicItemReward(template)) return 0;
  return isFinal ? 2 : 1;
}


/** Tras victoria: marcar jefe final derrotado en el mapa */
export function markFinalBossDefeated(map: DungeonMap): DungeonMap {
  return { ...map, finalBossDefeated: true };
}

/**
 * Si el jefe final está muerto y el grupo está en la entrada → aventura completa.
 */
export function tryCompleteAdventure(map: DungeonMap): {
  map: DungeonMap;
  completed: boolean;
  message: string;
} {
  const atEntrance = !!map.cells[map.partyCellId]?.isEntrance;
  if (map.finalBossDefeated && atEntrance) {
    return {
      map: { ...map, adventureComplete: true },
      completed: true,
      message:
        'Habéis derrotado al jefe final y regresado a la entrada. ¡Aventura completada!',
    };
  }
  return {
    map,
    completed: false,
    message: atEntrance
      ? 'Entrada de la mazmorra.'
      : map.finalBossDefeated
        ? 'Jefe final derrotado — volved a la entrada para terminar la aventura.'
        : '',
  };
}
