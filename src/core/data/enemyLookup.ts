/**
 * Lookup de perfiles de enemigo por templateId (tablas básicas).
 */

import { VERMIN_TABLE } from './vermin';
import { MINIONS_TABLE } from './minions';
import { BOSSES_TABLE } from './bosses';
import { WEIRD_TABLE } from './weird';
import type { EnemyInstance, EnemyTemplate } from '../types/combat';

const ALL: EnemyTemplate[] = [
  ...VERMIN_TABLE,
  ...MINIONS_TABLE,
  ...BOSSES_TABLE,
  ...WEIRD_TABLE,
];

const BY_ID = new Map(ALL.map((t) => [t.id, t]));

export function getEnemyTemplate(templateId: string): EnemyTemplate | undefined {
  return BY_ID.get(templateId);
}

/** Life máxima para barras de vida (nunca usa current como max). */
export function getEnemyMaxLife(enemy: EnemyInstance): number {
  if (typeof enemy.maxLife === 'number' && enemy.maxLife > 0) {
    return enemy.maxLife;
  }
  const t = BY_ID.get(enemy.templateId);
  if (t && t.life > 0) return t.life;
  // Último recurso: al menos 1 (minions de 1 life)
  return Math.max(1, enemy.currentLife);
}
