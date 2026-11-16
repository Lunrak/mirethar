/**
 * Estado de misión activa en la mazmorra
 */

import type { QuestGoalType, QuestReward } from '../data/questTable';

export type QuestStatus = 'active' | 'ready_to_turn_in' | 'completed';

export type ActiveQuest = {
  templateId: string;
  title: string;
  giverName: string;
  giverRole: string;
  dialogue: string;
  completeDialogue: string;
  goalType: QuestGoalType;
  goalText: string;
  target: number;
  progress: number;
  /** Celda donde se recibió (hay que volver) */
  giverCellId: string;
  status: QuestStatus;
  reward: QuestReward;
};

export type QuestRewardResult = {
  gold: number;
  itemHint?: string;
  xpHint?: string;
  message: string;
};
