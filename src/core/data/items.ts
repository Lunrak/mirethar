/**
 * Items básicos del MVP – Four Against Darkness
 * Equipo inicial + variantes de carga por clase (manual).
 */

export type EquipmentSlot =
  | 'armor'
  | 'shield'
  | 'mainHand'
  | 'offHand'
  | 'misc'
  | 'spellbook';

export type ItemType =
  | 'armor'
  | 'shield'
  | 'weapon'
  | 'tool'
  | 'spellbook'
  | 'holySymbol'
  | 'misc'
  | 'light';

export type Item = {
  id: string;
  name: string;
  type: ItemType;
  /** Slots que ocupa (two-handed usa mainHand + offHand) */
  slots: EquipmentSlot[];
  /** Bonos o reglas especiales */
  rules?: string[];
  /** Arma a dos manos, contundente, ligera, etc. */
  tags?: string[];
};

export const ITEMS: Record<string, Item> = {
  light_armor: {
    id: 'light_armor',
    name: 'Armadura ligera',
    type: 'armor',
    slots: ['armor'],
    tags: ['light'],
    rules: ['+1 Defense'],
  },
  heavy_armor: {
    id: 'heavy_armor',
    name: 'Armadura pesada',
    type: 'armor',
    slots: ['armor'],
    tags: ['heavy'],
    rules: ['+2 Defense', 'Solo guerrero'],
  },
  shield: {
    id: 'shield',
    name: 'Escudo',
    type: 'shield',
    slots: ['shield'],
    tags: ['shield'],
    rules: ['+1 Defense'],
  },
  torch: {
    id: 'torch',
    name: 'Antorcha',
    type: 'light',
    slots: ['offHand'],
    tags: ['torch', 'light-source'],
    rules: [
      'Ocupa la mano libre / off-hand',
      'Si nadie lleva antorcha, zonas oscuras penalizan (4AD)',
    ],
  },
  hand_weapon: {
    id: 'hand_weapon',
    name: 'Arma de una mano',
    type: 'weapon',
    slots: ['mainHand'],
    tags: ['hand'],
    rules: ['Espada, hacha, etc. de una mano'],
  },
  light_hand_weapon: {
    id: 'light_hand_weapon',
    name: 'Arma ligera / cuchillo',
    type: 'weapon',
    slots: ['mainHand'],
    tags: ['light', 'hand'],
    rules: ['−1 Attack (arma ligera)'],
  },
  crushing_weapon: {
    id: 'crushing_weapon',
    name: 'Maza de una mano',
    type: 'weapon',
    slots: ['mainHand'],
    tags: ['crushing', 'hand'],
    rules: ['+1 vs esqueletos / rats esqueléticos'],
  },
  two_handed_weapon: {
    id: 'two_handed_weapon',
    name: 'Arma a dos manos',
    type: 'weapon',
    slots: ['mainHand', 'offHand'],
    tags: ['two-handed'],
    rules: ['Ocupa las dos manos', 'No se puede llevar escudo ni antorcha'],
  },
  two_handed_crushing: {
    id: 'two_handed_crushing',
    name: 'Maza a dos manos',
    type: 'weapon',
    slots: ['mainHand', 'offHand'],
    tags: ['two-handed', 'crushing'],
    rules: ['Ocupa las dos manos', '+1 vs esqueletos / rats esqueléticos'],
  },
  bow: {
    id: 'bow',
    name: 'Arco',
    type: 'weapon',
    slots: ['mainHand'],
    tags: ['ranged', 'bow'],
    rules: ['A distancia', 'Impide escudo / antorcha en off-hand'],
  },
  sling: {
    id: 'sling',
    name: 'Honda',
    type: 'weapon',
    slots: ['mainHand'],
    tags: ['ranged', 'light', 'sling'],
    rules: ['A distancia', 'Arma ligera'],
  },
  lockpicks: {
    id: 'lockpicks',
    name: 'Ganzúas',
    type: 'tool',
    slots: ['misc'],
  },
  rope: {
    id: 'rope',
    name: 'Cuerda',
    type: 'tool',
    slots: ['misc'],
  },
  spellbook: {
    id: 'spellbook',
    name: 'Grimorio',
    type: 'spellbook',
    slots: ['spellbook'],
    rules: ['Necesario para hechizos del mago'],
  },
  writing_implements: {
    id: 'writing_implements',
    name: 'Útiles de escritura',
    type: 'misc',
    slots: ['misc'],
  },
  holy_symbol: {
    id: 'holy_symbol',
    name: 'Símbolo sagrado',
    type: 'holySymbol',
    slots: ['misc'],
  },
};

export function isTwoHanded(item: Item | undefined | null): boolean {
  if (!item) return false;
  return (
    !!item.tags?.includes('two-handed') ||
    (item.slots.includes('mainHand') && item.slots.includes('offHand'))
  );
}

export function isTorch(item: Item | undefined | null): boolean {
  return !!item && (item.id === 'torch' || !!item.tags?.includes('torch'));
}

/** ¿El equipo deja una mano libre? */
export function hasFreeHand(equipment: Partial<Record<EquipmentSlot, Item>>): boolean {
  const main = equipment.mainHand;
  if (isTwoHanded(main)) return false;
  if (main?.tags?.includes('bow')) return false;
  const off = equipment.offHand ?? equipment.shield;
  return !off;
}
