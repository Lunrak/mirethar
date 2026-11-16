/**
 * QuestService – varias misiones, progreso y entrega en el cuarto de origen
 */

import { rollD6 } from './DiceService';
import { QUEST_TABLE, questByRoll, type QuestGoalType } from '../data/questTable';
import type {
  ActiveQuest,
  ExpeditionLoot,
  QuestRewardResult,
} from '../types/quest';
import type { DungeonMap } from '../types/dungeon';
import type { ContentKind } from '../data/roomContents';

function uid(): string {
  return `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function emptyLoot(): ExpeditionLoot {
  return { gold: 0, items: [], xpMarks: [] };
}

export function getQuests(map: DungeonMap): ActiveQuest[] {
  if (map.quests && map.quests.length) return map.quests;
  // compat: activeQuest único
  if (map.activeQuest) return [map.activeQuest];
  return [];
}

/** Crea instancia de misión anclada a la celda del PNJ */
export function acceptQuestAtCell(
  templateId: string,
  giverCellId: string,
): ActiveQuest {
  const t = QUEST_TABLE.find((q) => q.id === templateId) ?? QUEST_TABLE[0];
  return {
    instanceId: uid(),
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
  if (q.status === 'completed') return q;
  const progress = Math.min(q.target, next);
  const status: ActiveQuest['status'] =
    progress >= q.target ? 'ready_to_turn_in' : 'active';
  return { ...q, progress, status };
}

/** Avanza todas las misiones activas cuyo objetivo coincida */
export function advanceAllQuests(
  quests: ActiveQuest[] | null | undefined,
  event: QuestGoalType,
  amount = 1,
): ActiveQuest[] {
  const list = quests ?? [];
  return list.map((q) => {
    if (q.status === 'completed') return q;
    if (q.goalType !== event) return q;
    return withProgress(q, q.progress + amount);
  });
}

/** @deprecated usar advanceAllQuests */
export function advanceQuest(
  quest: ActiveQuest | null | undefined,
  event: QuestGoalType,
  amount = 1,
): ActiveQuest | null {
  if (!quest) return null;
  const [next] = advanceAllQuests([quest], event, amount);
  return next;
}

export function canTurnInQuest(
  map: DungeonMap,
  quest: ActiveQuest | null | undefined,
): boolean {
  if (!quest) return false;
  if (quest.status !== 'ready_to_turn_in') return false;
  return map.partyCellId === quest.giverCellId;
}

/** Misiones entregables en la celda actual del grupo */
export function questsReadyHere(map: DungeonMap): ActiveQuest[] {
  return getQuests(map).filter((q) => canTurnInQuest(map, q));
}

/**
 * Entrega una misión y aplica recompensa al loot de la expedición.
 */
export function turnInQuest(
  quest: ActiveQuest,
  currentLoot?: ExpeditionLoot | null,
): {
  quest: ActiveQuest;
  reward: QuestRewardResult;
} {
  const loot: ExpeditionLoot = currentLoot
    ? {
        gold: currentLoot.gold,
        items: [...currentLoot.items],
        xpMarks: [...currentLoot.xpMarks],
      }
    : emptyLoot();

  loot.gold += quest.reward.gold;
  if (quest.reward.itemHint) loot.items.push(quest.reward.itemHint);
  if (quest.reward.xpHint) loot.xpMarks.push(quest.reward.xpHint);

  const completed: ActiveQuest = { ...quest, status: 'completed' };
  const reward: QuestRewardResult = {
    gold: quest.reward.gold,
    itemHint: quest.reward.itemHint,
    xpHint: quest.reward.xpHint,
    loot,
    message:
      `${quest.giverName}: «${quest.completeDialogue}»\n` +
      `Recompensa: ${quest.reward.gold} gp` +
      (quest.reward.itemHint ? ` · ${quest.reward.itemHint}` : '') +
      (quest.reward.xpHint ? ` · ${quest.reward.xpHint}` : ''),
  };
  return { quest: completed, reward };
}

/**
 * ¿Puede ofrecerse otra misión en esta sala?
 * Se permiten varias; se evita solo spam en la misma celda con oferta activa sin completar.
 */
export function shouldOfferQuest(
  cellKind: string,
  contentKind: ContentKind,
  quests: ActiveQuest[],
  giverCellId: string,
  rng?: () => number,
): boolean {
  if (cellKind !== 'room') return false;
  if (contentKind === 'encounter' || contentKind === 'trap') return false;

  // Ya hay misión activa o lista originada en esta misma celda
  const sameCellOpen = quests.some(
    (q) =>
      q.giverCellId === giverCellId &&
      (q.status === 'active' || q.status === 'ready_to_turn_in'),
  );
  if (sameCellOpen) return false;

  if (contentKind === 'special' || contentKind === 'stairs_down') return true;
  if (contentKind === 'empty' || contentKind === 'treasure') {
    return rollD6(rng) >= 4; // un poco más frecuente si se permiten varias
  }
  return false;
}

export function questProgressLabel(q: ActiveQuest): string {
  return `${q.progress}/${q.target}`;
}

export function applyLootToMap(
  map: DungeonMap,
  loot: ExpeditionLoot,
): DungeonMap {
  return {
    ...map,
    goldFound: loot.gold,
    lootItems: loot.items,
    xpMarks: loot.xpMarks,
  };
}
