/**
 * Inventario y carga 4AD (manual básico)
 *
 * Límites por personaje:
 * - Máx. 3 armas (arma a dos manos cuenta como 2; bastón mágico cuenta como arma)
 * - Máx. 2 escudos (uno en uso, otro a la espalda)
 * - Máx. 200 gp
 * - Ilimitado: gemas, joyas, pergaminos, varitas, agua bendita, pociones
 *
 * Manos:
 * - Arma a dos manos o arco ocupan las dos manos → no escudo ni antorcha en uso
 * - Cambiar de arma en combate gasta el turno (no atacas)
 * - Guardar el escudo a la espalda para liberar una mano también gasta el turno en combate
 *
 * Sobrecarga: superar límites → −1 a las tiradas de Defensa
 */

import {
  ITEMS,
  isTwoHanded,
  type EquipmentSlot,
  type Item,
} from '../data/items';
import type { Hero } from '../types/combat';
import { CLASSES, type HeroClass } from '../data/classes';

export const MAX_WEAPON_SLOTS = 3;
export const MAX_SHIELDS = 2;
export const MAX_GOLD = 200;

export type InventoryItem = Item & {
  /** Instancia única en el inventario */
  instanceId: string;
};

export type HeroInventory = {
  /** Armas llevadas (incluye la equipada en mainHand) */
  weapons: InventoryItem[];
  /** Escudos (0–2); el equipado está en equipment.shield */
  shields: InventoryItem[];
  /** Herramientas, grimorio, símbolo, etc. */
  gear: InventoryItem[];
  /** Consumibles ilimitados en número de tipos */
  consumables: InventoryItem[];
  gold: number;
  /** Arma por defecto (instanceId) — la que usa al atacar */
  defaultWeaponInstanceId: string | null;
};

export function emptyInventory(): HeroInventory {
  return {
    weapons: [],
    shields: [],
    gear: [],
    consumables: [],
    gold: 0,
    defaultWeaponInstanceId: null,
  };
}

function newInstance(item: Item): InventoryItem {
  return {
    ...item,
    instanceId: `${item.id}_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 7)}`,
  };
}

/** Peso en “slots de arma”: 2H / arco = 2, resto = 1 */
export function weaponSlotCost(item: Item): number {
  if (isTwoHanded(item)) return 2;
  if (item.tags?.includes('bow')) return 2; // arco requiere dos manos
  return 1;
}

export function totalWeaponSlots(weapons: Item[]): number {
  return weapons.reduce((s, w) => s + weaponSlotCost(w), 0);
}

export function isOverencumbered(inv: HeroInventory): boolean {
  if (totalWeaponSlots(inv.weapons) > MAX_WEAPON_SLOTS) return true;
  if (inv.shields.length > MAX_SHIELDS) return true;
  if (inv.gold > MAX_GOLD) return true;
  return false;
}

export function classAllowsWeapon(heroClass: HeroClass, item: Item): boolean {
  if (item.type !== 'weapon') return false;
  const allowed = CLASSES[heroClass].weaponsAllowed;
  if (allowed.includes('any')) return true;
  const tags = item.tags ?? [];
  if (allowed.includes('light weapon') && tags.includes('light')) return true;
  if (allowed.includes('hand weapon') && tags.includes('hand') && !tags.includes('light'))
    return true;
  if (allowed.includes('two-handed weapon') && tags.includes('two-handed')) return true;
  if (allowed.includes('sling') && tags.includes('sling')) return true;
  if (allowed.includes('bow') && tags.includes('bow')) return true;
  // hand_weapon genérico
  if (allowed.includes('hand weapon') && item.id === 'hand_weapon') return true;
  return false;
}

export function classAllowsArmor(heroClass: HeroClass, item: Item): boolean {
  const allowed = CLASSES[heroClass].armorAllowed;
  if (allowed.includes('none')) return item.type !== 'armor' && item.type !== 'shield';
  if (item.type === 'shield') return allowed.includes('shield');
  if (item.type === 'armor') {
    if (item.tags?.includes('heavy')) return allowed.includes('heavy armor');
    if (item.tags?.includes('light')) return allowed.includes('light armor');
  }
  return false;
}

/**
 * Construye inventario a partir del equipo equipado (arranque de héroe).
 */
export function inventoryFromEquipment(
  equipment: Partial<Record<EquipmentSlot, Item>>,
  gold = 0,
): HeroInventory {
  const inv = emptyInventory();
  inv.gold = Math.min(MAX_GOLD, Math.max(0, gold));

  const seen = new Set<string>();
  const pushUnique = (item: Item | undefined) => {
    if (!item || seen.has(item.id + (item.slots.join(',')))) return;
    // avoid double-counting two-handed listed on two slots
    if (item.slots.includes('mainHand') && item.slots.includes('offHand')) {
      if (seen.has(item.id + '_2h')) return;
      seen.add(item.id + '_2h');
    } else {
      seen.add(item.id + item.slots[0]);
    }
    const inst = newInstance(item);
    if (item.type === 'weapon') {
      inv.weapons.push(inst);
      if (!inv.defaultWeaponInstanceId) inv.defaultWeaponInstanceId = inst.instanceId;
    } else if (item.type === 'shield') {
      inv.shields.push(inst);
    } else if (
      item.type === 'tool' ||
      item.type === 'spellbook' ||
      item.type === 'holySymbol' ||
      item.type === 'misc' ||
      item.type === 'light'
    ) {
      inv.gear.push(inst);
    }
  };

  pushUnique(equipment.mainHand);
  if (equipment.offHand && equipment.offHand !== equipment.mainHand) {
    pushUnique(equipment.offHand);
  }
  pushUnique(equipment.shield);
  pushUnique(equipment.armor);
  pushUnique(equipment.misc);
  pushUnique(equipment.spellbook);

  return inv;
}

export function ensureHeroInventory(hero: Hero): Hero & { inventory: HeroInventory } {
  if (hero.inventory) {
    return hero as Hero & { inventory: HeroInventory };
  }
  const inv = inventoryFromEquipment(hero.equipment ?? {}, 0);
  return { ...hero, inventory: inv };
}

export type EquipResult = {
  ok: boolean;
  hero: Hero;
  message: string;
};

/**
 * Equipa un arma del inventario como arma activa (mainHand).
 * En combate debe llamarse como acción de turno (no ataca ese turno).
 */
export function equipWeapon(
  hero: Hero,
  weaponInstanceId: string,
): EquipResult {
  const h = ensureHeroInventory(hero);
  const inv = { ...h.inventory, weapons: [...h.inventory.weapons] };
  const weapon = inv.weapons.find((w) => w.instanceId === weaponInstanceId);
  if (!weapon) {
    return { ok: false, hero: h, message: 'Esa arma no está en el inventario.' };
  }
  if (!classAllowsWeapon(h.class, weapon)) {
    return {
      ok: false,
      hero: h,
      message: `${h.name} (${h.class}) no puede usar ${weapon.name}.`,
    };
  }

  const equipment = { ...h.equipment };
  // Quitar 2H / arco del offHand
  if (isTwoHanded(equipment.mainHand) || equipment.mainHand?.tags?.includes('bow')) {
    delete equipment.offHand;
  }
  equipment.mainHand = weapon;
  if (isTwoHanded(weapon) || weapon.tags?.includes('bow')) {
    // Ocupa las dos manos: no escudo ni antorcha en uso
    delete equipment.offHand;
    // Escudo pasa a “espalda” si había uno equipado (sigue en inv.shields)
    if (equipment.shield) {
      // se queda en inventario; solo deja de dar defensa
      delete equipment.shield;
    }
  }

  inv.defaultWeaponInstanceId = weapon.instanceId;

  return {
    ok: true,
    hero: { ...h, equipment, inventory: inv },
    message: `${h.name} empuña ${weapon.name} (cambia de arma: un turno).`,
  };
}

/**
 * Equipa escudo en la mano (debe haber mano libre: no 2H/arco).
 */
export function equipShield(hero: Hero, shieldInstanceId: string): EquipResult {
  const h = ensureHeroInventory(hero);
  const inv = { ...h.inventory, shields: [...h.inventory.shields] };
  const shield = inv.shields.find((s) => s.instanceId === shieldInstanceId);
  if (!shield) {
    return { ok: false, hero: h, message: 'Ese escudo no está en el inventario.' };
  }
  if (!classAllowsArmor(h.class, shield)) {
    return { ok: false, hero: h, message: `${h.name} no puede usar escudo.` };
  }
  const main = h.equipment.mainHand;
  if (isTwoHanded(main) || main?.tags?.includes('bow')) {
    return {
      ok: false,
      hero: h,
      message: 'Con arma a dos manos o arco no se puede usar el escudo (guarda el arma primero).',
    };
  }

  return {
    ok: true,
    hero: {
      ...h,
      equipment: { ...h.equipment, shield },
      inventory: inv,
    },
    message: `${h.name} usa ${shield.name}.`,
  };
}

/** Guarda el escudo a la espalda (deja de dar +1 Defensa; libera mano). */
export function stowShield(hero: Hero): EquipResult {
  const h = ensureHeroInventory(hero);
  if (!h.equipment.shield) {
    return { ok: false, hero: h, message: 'No lleva escudo en uso.' };
  }
  const equipment = { ...h.equipment };
  delete equipment.shield;
  return {
    ok: true,
    hero: { ...h, equipment },
    message: `${h.name} guarda el escudo a la espalda (en combate: un turno).`,
  };
}

/**
 * Añade un arma al inventario si cabe en el límite de 3 slots.
 */
export function addWeaponToInventory(hero: Hero, itemId: string): EquipResult {
  const h = ensureHeroInventory(hero);
  const base = ITEMS[itemId];
  if (!base || base.type !== 'weapon') {
    return { ok: false, hero: h, message: 'Ítem de arma desconocido.' };
  }
  if (!classAllowsWeapon(h.class, base)) {
    return { ok: false, hero: h, message: `Clase no permite ${base.name}.` };
  }
  const cost = weaponSlotCost(base);
  const used = totalWeaponSlots(h.inventory.weapons);
  if (used + cost > MAX_WEAPON_SLOTS) {
    return {
      ok: false,
      hero: h,
      message: `Límite de armas (máx. ${MAX_WEAPON_SLOTS}; 2H/arco cuentan como 2). Llevas ${used}.`,
    };
  }
  const inst = newInstance(base);
  const inv: HeroInventory = {
    ...h.inventory,
    weapons: [...h.inventory.weapons, inst],
    defaultWeaponInstanceId:
      h.inventory.defaultWeaponInstanceId ?? inst.instanceId,
  };
  const equipment = { ...h.equipment };
  if (!equipment.mainHand) {
    equipment.mainHand = inst;
    inv.defaultWeaponInstanceId = inst.instanceId;
  }
  return {
    ok: true,
    hero: { ...h, equipment, inventory: inv },
    message: `${h.name} guarda ${base.name}.`,
  };
}

export function addShieldToInventory(hero: Hero, itemId = 'shield'): EquipResult {
  const h = ensureHeroInventory(hero);
  const base = ITEMS[itemId];
  if (!base || base.type !== 'shield') {
    return { ok: false, hero: h, message: 'Escudo desconocido.' };
  }
  if (h.inventory.shields.length >= MAX_SHIELDS) {
    return {
      ok: false,
      hero: h,
      message: `Máximo ${MAX_SHIELDS} escudos por personaje.`,
    };
  }
  if (!classAllowsArmor(h.class, base)) {
    return { ok: false, hero: h, message: `${h.name} no puede llevar escudo.` };
  }
  const inst = newInstance(base);
  const inv: HeroInventory = {
    ...h.inventory,
    shields: [...h.inventory.shields, inst],
  };
  const equipment = { ...h.equipment };
  if (!equipment.shield && !isTwoHanded(equipment.mainHand) && !equipment.mainHand?.tags?.includes('bow')) {
    equipment.shield = inst;
  }
  return {
    ok: true,
    hero: { ...h, equipment, inventory: inv },
    message: `${h.name} obtiene ${base.name}.`,
  };
}

export function setGold(hero: Hero, amount: number): Hero {
  const h = ensureHeroInventory(hero);
  const gold = Math.max(0, amount);
  return {
    ...h,
    inventory: { ...h.inventory, gold },
  };
}

export function addGold(hero: Hero, delta: number): { hero: Hero; overflow: number; message: string } {
  const h = ensureHeroInventory(hero);
  const next = h.inventory.gold + delta;
  if (next <= MAX_GOLD) {
    return {
      hero: { ...h, inventory: { ...h.inventory, gold: Math.max(0, next) } },
      overflow: 0,
      message: delta >= 0 ? `+${delta} gp` : `${delta} gp`,
    };
  }
  const overflow = next - MAX_GOLD;
  return {
    hero: { ...h, inventory: { ...h.inventory, gold: MAX_GOLD } },
    overflow,
    message: `Límite ${MAX_GOLD} gp: se guardan ${MAX_GOLD}; sobran ${overflow} gp (dejar o repartir).`,
  };
}

export function inventorySummary(hero: Hero): string {
  const h = ensureHeroInventory(hero);
  const w = h.inventory.weapons
    .map((x) =>
      x.instanceId === h.inventory.defaultWeaponInstanceId
        ? `${x.name}★`
        : x.name,
    )
    .join(', ');
  const s = h.inventory.shields.map((x) => x.name).join(', ');
  const overload = isOverencumbered(h.inventory) ? ' [SOBRECARGA −1 Def]' : '';
  return `${h.name}: armas [${w || '—'}] (${totalWeaponSlots(h.inventory.weapons)}/${MAX_WEAPON_SLOTS}) · escudos [${s || '—'}] · ${h.inventory.gold} gp${overload}`;
}
