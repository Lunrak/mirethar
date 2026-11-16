/**
 * QuestService – tabla de misiones, progreso y entrega
 */

import { rollD6 } from './DiceService';
import { QUEST_TABLE, questByRoll, type QuestGoalType } from '../data/questTable';
import type { ActiveQuest, QuestRewardResult } from '../types/quest';
import type { DungeonMap } from '../types/dungeon';
import type { ContentKind } from '../data/roomContents';

export function rollQuest(rng?: () => number): ActiveQuest['templateId'] {
  const roll = rollD6(rng);
  return questByRoll(roll).id;
}

/** Crea misión activa anclada a la celda del PNJ */
export function acceptQuestAtCell(
  templateId: string,
  giverCellId: string,
): ActiveQuest {
  const t = QUEST_TABLE.find((q) => q.id === templateId) ?? QUEST_TABLE[0];
  return {
    templateId: t.id,
    title: t.title,
    giverName: t.giverName,
    giverRole: t.giverRole,
    dialogue: t.dialogue,
    completeDialogue: t.completeDialogue,
    goalType: t.goalType,
    goalText: t.goalText,
    target: t.target,
    progress: 0,
    giverCellId,
    status: 'active',
    reward: { ...t.reward },
  };
}

export function rollAndAcceptQuest(
  giverCellId: string,
  rng?: () => number,
): ActiveQuest {
  const roll = rollD6(rng);
  const t = questByRoll(roll);
  return acceptQuestAtCell(t.id, giverCellId);
}

function withProgress(q: ActiveQuest, next: number): ActiveQuest {
  const progress = Math.min(q.target, next);
  const status: ActiveQuest['status'] =
    progress >= q.target ? 'ready_to_turn_in' : 'active';
  return { ...q, progress, status };
}

/** Avanza el contador si el evento coincide con el objetivo */
export function advanceQuest(
  quest: ActiveQuest | null | undefined,
  event: QuestGoalType,
  amount = 1,
): ActiveQuest | null {
  if (!quest || quest.status === 'completed') return quest ?? null;
  if (quest.goalType !== event) return quest;
  return withProgress(quest, quest.progress + amount);
}

/** ¿El grupo está en el cuarto del dador y puede entregar? */
export function canTurnInQuest(
  map: DungeonMap,
  quest: ActiveQuest | null | undefined,
): boolean {
  if (!quest) return false;
  if (quest.status !== 'ready_to_turn_in') return false;
  return map.partyCellId === quest.giverCellId;
}

export function turnInQuest(quest: ActiveQuest): {
  quest: ActiveQuest;
  reward: QuestRewardResult;
} {
  const completed: ActiveQuest = { ...quest, status: 'completed' };
  const reward: QuestRewardResult = {
    gold: quest.reward.gold,
    itemHint: quest.reward.itemHint,
    xpHint: quest.reward.xpHint,
    message: `${quest.giverName}: «${quest.completeDialogue}»  Recompensa: ${quest.reward.gold} gp` +
      (quest.reward.itemHint ? ` · ${quest.reward.itemHint}` : '') +
      (quest.reward.xpHint ? ` · ${quest.reward.xpHint}` : ''),
  };
  return { quest: completed, reward };
}

/**
 * Tras resolver contenido de sala: ¿aparece un dador de misión?
 * - kind special sin encuentro, o treasure, o empty en sala (25% vía d6 >= 5 si no hay quest)
 */
export function shouldOfferQuest(
  cellKind: string,
  contentKind: ContentKind,
  hasActiveQuest: boolean,
  rng?: () => number,
): boolean {
  if (hasActiveQuest) return false;
  if (cellKind !== 'room') return false;
  if (contentKind === 'encounter' || contentKind === 'trap') return false;
  // special siempre puede ofrecer; empty/treasure con d6 >= 5
  if (contentKind === 'special' || contentKind === 'stairs_down') return true;
  if (contentKind === 'empty' || contentKind === 'treasure') {
    return rollD6(rng) >= 5;
  }
  return false;
}

export function questProgressLabel(q: ActiveQuest): string {
  return `${q.progress}/${q.target}`;
}
