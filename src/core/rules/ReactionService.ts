/**
 * ReactionService – reacciones de monstruos 4AD (funciones puras)
 * reactions: { [1-6]: ReactionType } en EnemyTemplate
 */

import { rollD6 } from './DiceService';
import type { EnemyTemplate, ReactionType } from '../types/combat';

export type ReactionResult = {
  roll: number;
  reaction: ReactionType;
  message: string;
};

const LABELS: Record<ReactionType, string> = {
  flee: 'Huyen',
  flee_if_outnumbered: 'Huyen si están superados en número',
  bribe: 'Piden soborno',
  fight: 'Luchan',
  fight_to_death: 'Luchan a muerte',
  always_fight: 'Siempre luchan',
  quest: 'Proponen una quest',
  sleeping: 'Están dormidos',
};

export function resolveReaction(
  template: EnemyTemplate,
  rng?: () => number
): ReactionResult {
  const roll = rollD6(rng);
  const reaction: ReactionType =
    template.reactions[roll] ?? template.reactions[6] ?? 'fight';

  return {
    roll,
    reaction,
    message: `${template.name}: reacción ${roll} → ${LABELS[reaction] ?? reaction}`,
  };
}

/** ¿La reacción implica combate inmediato? */
export function reactionStartsCombat(reaction: ReactionType): boolean {
  return (
    reaction === 'fight' ||
    reaction === 'fight_to_death' ||
    reaction === 'always_fight'
  );
}

/** ¿Puede el party intentar sobornar? */
export function reactionAllowsBribe(reaction: ReactionType): boolean {
  return reaction === 'bribe';
}

/** ¿Huyen automáticamente (sin combate)? */
export function reactionFlees(
  reaction: ReactionType,
  partySize: number,
  enemyCount: number
): boolean {
  if (reaction === 'flee') return true;
  if (reaction === 'flee_if_outnumbered') return enemyCount < partySize;
  return false;
}
