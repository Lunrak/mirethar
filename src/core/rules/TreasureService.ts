/**
 * Botín temporal MVP – 4AD simplificado
 * Usa treasureModifier del template del encuentro.
 * -99 = sin botín; resto: d6 oro * factor aproximado.
 */

import { rollD6 } from './DiceService';
import type { EnemyTemplate } from '../types/combat';

export type LootItem = {
  id: string;
  name: string;
  kind: 'gold' | 'item' | 'note';
  quantity?: number;
};

export type TreasureResult = {
  gold: number;
  items: LootItem[];
  message: string;
  modifier: number;
};

/**
 * Genera botín temporal al terminar el combate con victoria.
 * No persiste inventario todavía (MVP combate).
 */
export function rollTreasure(
  template: Pick<EnemyTemplate, 'name' | 'treasureModifier' | 'type'>,
  rng: () => number = Math.random
): TreasureResult {
  const mod = template.treasureModifier ?? 0;

  if (mod <= -99) {
    return {
      gold: 0,
      items: [],
      message: `${template.name}: sin botín.`,
      modifier: mod,
    };
  }

  const base = rollD6(rng) + rollD6(rng);
  const gold = Math.max(0, base + mod) * (template.type === 'boss' ? 5 : 1);

  const items: LootItem[] = [];
  if (template.type === 'boss' && rollD6(rng) >= 5) {
    items.push({
      id: `loot_magic_${Date.now().toString(36)}`,
      name: 'Objeto menor (temporal)',
      kind: 'item',
      quantity: 1,
    });
  }

  const parts = [`${gold} gp`];
  if (items.length) parts.push(items.map((i) => i.name).join(', '));

  return {
    gold,
    items,
    message: `Botín: ${parts.join(' · ')} (mod ${mod >= 0 ? '+' : ''}${mod})`,
    modifier: mod,
  };
}
