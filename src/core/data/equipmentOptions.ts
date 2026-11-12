/**
 * Variantes de equipo por clase y ranura – 4AD / GDD
 * Usado en la hoja de personaje al preparar el encuentro.
 */

import { ITEMS, isTwoHanded, type EquipmentSlot, type Item } from './items';
import type { HeroClass } from './classes';

export type SlotOption = {
  itemId: string | null;
  label: string;
  hint?: string;
};

/** Opciones de arma principal por clase */
export function mainHandOptions(heroClass: HeroClass): SlotOption[] {
  switch (heroClass) {
    case 'warrior':
      return [
        { itemId: 'hand_weapon', label: 'Arma de una mano', hint: 'Espada, hacha…' },
        { itemId: 'two_handed_weapon', label: 'Arma a dos manos', hint: 'Ocupa ambas manos' },
        { itemId: 'crushing_weapon', label: 'Maza de una mano', hint: '+1 vs esqueletos' },
        {
          itemId: 'two_handed_crushing',
          label: 'Maza a dos manos',
          hint: '+1 vs esqueletos · 2 manos',
        },
        { itemId: 'light_hand_weapon', label: 'Cuchillo / arma ligera', hint: '−1 Attack' },
        { itemId: 'bow', label: 'Arco', hint: 'A distancia' },
      ];
    case 'rogue':
      return [
        { itemId: 'light_hand_weapon', label: 'Arma ligera / cuchillo', hint: '−1 Attack' },
        { itemId: 'sling', label: 'Honda', hint: 'A distancia' },
      ];
    case 'cleric':
      return [
        { itemId: 'hand_weapon', label: 'Arma de una mano', hint: 'Estándar' },
        { itemId: 'crushing_weapon', label: 'Maza de una mano', hint: '+1 vs esqueletos' },
        { itemId: 'two_handed_weapon', label: 'Arma a dos manos', hint: 'Sin escudo' },
        {
          itemId: 'two_handed_crushing',
          label: 'Maza a dos manos',
          hint: '+1 vs esqueletos · sin escudo',
        },
      ];
    case 'wizard':
      return [
        { itemId: 'light_hand_weapon', label: 'Arma ligera / cuchillo', hint: '−1 Attack' },
        { itemId: 'sling', label: 'Honda', hint: 'A distancia' },
        {
          itemId: null,
          label: 'Mano libre (sin arma)',
          hint: 'Recomendado para lanzar conjuros',
        },
      ];
    default:
      return [];
  }
}

export function armorOptions(heroClass: HeroClass): SlotOption[] {
  switch (heroClass) {
    case 'warrior':
      return [
        { itemId: 'light_armor', label: 'Armadura ligera', hint: '+1 Defense' },
        { itemId: 'heavy_armor', label: 'Armadura pesada', hint: '+2 Defense' },
        { itemId: null, label: 'Sin armadura', hint: 'Sin bono de armadura' },
      ];
    case 'rogue':
    case 'cleric':
      return [
        { itemId: 'light_armor', label: 'Armadura ligera', hint: '+1 Defense' },
        { itemId: null, label: 'Sin armadura', hint: 'Sin bono' },
      ];
    case 'wizard':
      return [{ itemId: null, label: 'Sin armadura', hint: 'El mago no puede usar armadura' }];
    default:
      return [];
  }
}

/**
 * Mano izquierda / off-hand.
 * Si el arma principal es a 2 manos, no hay opciones (slot bloqueado).
 */
export function offHandOptions(
  heroClass: HeroClass,
  mainHand: Item | undefined,
): SlotOption[] {
  if (isTwoHanded(mainHand) || mainHand?.tags?.includes('bow')) {
    return [
      {
        itemId: null,
        label: 'Ocupada (arma a dos manos / arco)',
        hint: 'No puedes llevar escudo ni antorcha',
      },
    ];
  }

  const opts: SlotOption[] = [
    { itemId: null, label: 'Mano libre', hint: 'Útil para el mago al conjurar' },
  ];

  if (heroClass === 'warrior' || heroClass === 'cleric') {
    opts.unshift({
      itemId: 'shield',
      label: 'Escudo',
      hint: '+1 Defense',
    });
  }

  // Cualquier clase puede llevar antorcha en la mano libre
  opts.push({
    itemId: 'torch',
    label: 'Antorcha',
    hint: 'Luz del grupo · ocupa la mano',
  });

  return opts;
}

export function miscOptions(heroClass: HeroClass): SlotOption[] {
  switch (heroClass) {
    case 'rogue':
      return [
        { itemId: 'lockpicks', label: 'Ganzúas', hint: 'Abrir cerraduras' },
        { itemId: 'rope', label: 'Cuerda', hint: 'Utilidad' },
        { itemId: null, label: 'Vacío', hint: '' },
      ];
    case 'cleric':
      return [
        { itemId: 'holy_symbol', label: 'Símbolo sagrado', hint: 'Clase' },
        { itemId: null, label: 'Vacío', hint: '' },
      ];
    case 'wizard':
      return [
        { itemId: 'writing_implements', label: 'Útiles de escritura', hint: '' },
        { itemId: null, label: 'Vacío', hint: '' },
      ];
    default:
      return [
        { itemId: 'torch', label: 'Antorcha (en bolsas)', hint: 'Alternativa a mano' },
        { itemId: null, label: 'Vacío', hint: '' },
      ];
  }
}

export function spellbookOptions(heroClass: HeroClass): SlotOption[] {
  if (heroClass !== 'wizard') {
    return [{ itemId: null, label: '—', hint: 'Solo mago' }];
  }
  return [
    { itemId: 'spellbook', label: 'Grimorio', hint: 'Requerido' },
    { itemId: null, label: 'Sin grimorio', hint: 'No podrá preparar hechizos' },
  ];
}

export function optionsForSlot(
  heroClass: HeroClass,
  slot: EquipmentSlot,
  equipment: Partial<Record<EquipmentSlot, Item>>,
): SlotOption[] {
  switch (slot) {
    case 'mainHand':
      return mainHandOptions(heroClass);
    case 'armor':
      return armorOptions(heroClass);
    case 'shield':
    case 'offHand':
      return offHandOptions(heroClass, equipment.mainHand);
    case 'misc':
      return miscOptions(heroClass);
    case 'spellbook':
      return spellbookOptions(heroClass);
    default:
      return [];
  }
}

export function applySlotChoice(
  equipment: Partial<Record<EquipmentSlot, Item>>,
  slot: EquipmentSlot,
  itemId: string | null,
): Partial<Record<EquipmentSlot, Item>> {
  const next = { ...equipment };

  if (slot === 'shield' || slot === 'offHand') {
    delete next.shield;
    delete next.offHand;
    if (itemId == null) return next;
    const item = ITEMS[itemId];
    if (!item) return next;
    // escudo usa slot shield; antorcha offHand
    if (item.type === 'shield') next.shield = item;
    else next.offHand = item;
    return next;
  }

  if (itemId == null) {
    delete next[slot];
    return next;
  }

  const item = ITEMS[itemId];
  if (!item) return next;
  next[slot] = item;

  // Arma a 2 manos / arco: limpia off-hand y escudo
  if (slot === 'mainHand' && (isTwoHanded(item) || item.tags?.includes('bow'))) {
    delete next.shield;
    delete next.offHand;
  }

  return next;
}
