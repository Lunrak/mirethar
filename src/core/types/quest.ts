/**
 * Estado de misiones en la mazmorra (varias a la vez)
 */

import type { QuestGoalType, QuestReward } from '../data/questTable';

export type QuestStatus = 'active' | 'ready_to_turn_in' | 'completed';

export type ActiveQuest = {
  /** Id único de esta instancia (permite repetir la misma plantilla) */
  instanceId: string;
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
  /** Celda donde se recibió — solo aquí se entrega */
  giverCellId: string;
  status: QuestStatus;
  reward: QuestReward;
};

/** Botín de recompensa aplicado al inventario de expedición */
export type ExpeditionLoot = {
  gold: number;
  /** Pistas / ítems narrativos obtenidos */
  items: string[];
  /** Marcas de XP pendientes de asignar */
  xpMarks: string[];
};

export type QuestRewardResult = {
  gold: number;
  itemHint?: string;
  xpHint?: string;
  message: string;
  /** Loot actualizado de la expedición */
  loot: ExpeditionLoot;
};
