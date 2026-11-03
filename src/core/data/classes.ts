/**
 * Clases del MVP – Four Against Darkness
 * Valores exactos del GDD §3.2 + tablas de 4AD Revised.
 *
 * Life = base + level  →  nivel 1:
 *   Warrior 7, Rogue 4, Cleric 5, Wizard 3
 */

import { ITEMS } from './items';
import type { Item, EquipmentSlot } from './items';
import type { Hero } from '../types/combat';

export type HeroClass = 'warrior' | 'rogue' | 'cleric' | 'wizard';

export type ClassDefinition = {
	id: HeroClass;
	name: string;
	/** Life en nivel 1 (ya incluye el +level) */
	baseLife: number;
	lifeFormula: string;
	traits: string[];
	armorAllowed: string[];
	weaponsAllowed: string[];
	startingEquipmentIds: string[];
	startingSpells?: string[];
	notes?: string[];
};

export const CLASSES: Record<HeroClass, ClassDefinition> = {
	warrior: {
		id: 'warrior',
		name: 'Warrior',
		baseLife: 7, // 6 + level
		lifeFormula: '6 + level',
		traits: ['Adds full level to Attack rolls.', 'Can use heavy armor.'],
		armorAllowed: ['shield', 'light armor', 'heavy armor'],
		weaponsAllowed: ['any'],
		startingEquipmentIds: ['light_armor', 'shield', 'hand_weapon'],
		notes: [
			'May trade shield + hand weapon for a two-handed weapon or a bow.',
			'Starting wealth: 2d6 gp',
		],
	},

	rogue: {
		id: 'rogue',
		name: 'Rogue',
		baseLife: 4, // 3 + level
		lifeFormula: '3 + level',
		traits: [
			'Adds full level to Defense rolls.',
			'Adds full level when attacking an outnumbered minion (party outnumbers the enemy group).',
		],
		armorAllowed: ['light armor'],
		weaponsAllowed: ['light weapon', 'sling'],
		startingEquipmentIds: [
			'light_armor',
			'light_hand_weapon',
			'lockpicks',
			'rope',
		],
		notes: ['Starting wealth: 3d6 gp'],
	},

	cleric: {
		id: 'cleric',
		name: 'Cleric',
		baseLife: 5, // 4 + level
		lifeFormula: '4 + level',
		traits: [
			'Adds half level (rounded down) to Attack rolls.',
			'Adds full level when attacking undead.',
			'Healing: 3 times per adventure, heal d6 + level (cannot attack same turn).',
		],
		armorAllowed: ['shield', 'light armor'],
		weaponsAllowed: ['hand weapon', 'two-handed weapon'],
		startingEquipmentIds: [
			'light_armor',
			'shield',
			'hand_weapon',
			'holy_symbol',
		],
		notes: [
			'Usually prefer crushing weapons (+1 vs skeletons / skeletal rats).',
			'May trade shield + hand weapon for a two-handed weapon.',
		],
	},

	wizard: {
		id: 'wizard',
		name: 'Wizard',
		baseLife: 3, // 2 + level
		lifeFormula: '2 + level',
		traits: [
			'Adds level only when casting spells (including scrolls) or solving puzzles/riddles.',
			'Cannot wear armor.',
		],
		armorAllowed: ['none'],
		weaponsAllowed: ['light weapon', 'sling'],
		startingEquipmentIds: [
			'light_hand_weapon',
			'spellbook',
			'writing_implements',
		],
		startingSpells: ['Blessing', 'Fireball', 'Lightning Bolt'], // ejemplo; el jugador elige 3
		notes: [
			'Starts with 2 + level prepared spells (player chooses from the 6 basic spells).',
			'Starting wealth: 4d6 gp',
		],
	},
};

const DEFAULT_NAMES: Record<HeroClass, string> = {
	warrior: 'Bruggo',
	rogue: 'Lira',
	cleric: 'Brother Tomas',
	wizard: 'Elandra',
};

/**
 * Factory: crea un héroe de la clase indicada a nivel 1 con equipo inicial de 4AD.
 */
export function createHero(
	heroClass: HeroClass,
	options: { name?: string; level?: number; id?: string } = {},
): Hero {
	const def = CLASSES[heroClass];
	const level = options.level ?? 1;
	const life = def.baseLife - 1 + level;

	const equipment: Partial<Record<EquipmentSlot, Item>> = {};

	for (const itemId of def.startingEquipmentIds) {
		const item = ITEMS[itemId];
		if (!item) continue;
		const slot = item.slots[0];
		equipment[slot] = item;
	}

	return {
		id: options.id ?? `${heroClass}_${Date.now().toString(36)}`,
		name: options.name ?? DEFAULT_NAMES[heroClass],
		class: heroClass,
		level,
		life,
		maxLife: life,
		equipment,
		spells: def.startingSpells ? [...def.startingSpells] : undefined,
		status: [],
		isFallen: false,
		isDead: false,
	};
}

/**
 * Grupo por defecto del MVP: Guerrero, Pícaro, Clérigo y Mago
 * con su equipo inicial exacto de 4AD.
 */
export function createDefaultParty(): Hero[] {
	return [
		createHero('warrior'),
		createHero('rogue'),
		createHero('cleric'),
		createHero('wizard'),
	];
}
