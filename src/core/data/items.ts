/**
 * Items básicos del MVP – Four Against Darkness
 * Solo el equipo inicial de las 4 clases + slots necesarios.
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
	| 'misc';

export type Item = {
	id: string;
	name: string;
	type: ItemType;
	/** Slots que ocupa (normalmente 1) */
	slots: EquipmentSlot[];
	/** Bonos o reglas especiales (texto libre por ahora) */
	rules?: string[];
	/** Arma a dos manos, contundente, ligera, etc. */
	tags?: string[];
};

export const ITEMS: Record<string, Item> = {
	// --- Armaduras ---
	light_armor: {
		id: 'light_armor',
		name: 'Light Armor',
		type: 'armor',
		slots: ['armor'],
		tags: ['light'],
	},
	heavy_armor: {
		id: 'heavy_armor',
		name: 'Heavy Armor',
		type: 'armor',
		slots: ['armor'],
		tags: ['heavy'],
	},

	// --- Escudos ---
	shield: {
		id: 'shield',
		name: 'Shield',
		type: 'shield',
		slots: ['shield'],
	},

	// --- Armas ---
	hand_weapon: {
		id: 'hand_weapon',
		name: 'Hand Weapon',
		type: 'weapon',
		slots: ['mainHand'],
		tags: ['hand'],
	},
	light_hand_weapon: {
		id: 'light_hand_weapon',
		name: 'Light Hand Weapon',
		type: 'weapon',
		slots: ['mainHand'],
		tags: ['light', 'hand'],
	},
	two_handed_weapon: {
		id: 'two_handed_weapon',
		name: 'Two-Handed Weapon',
		type: 'weapon',
		slots: ['mainHand', 'offHand'],
		tags: ['two-handed'],
	},
	crushing_weapon: {
		id: 'crushing_weapon',
		name: 'Crushing Weapon',
		type: 'weapon',
		slots: ['mainHand'],
		tags: ['crushing', 'hand'],
		rules: ['+1 vs skeletons / skeletal rats'],
	},
	bow: {
		id: 'bow',
		name: 'Bow',
		type: 'weapon',
		slots: ['mainHand'],
		tags: ['ranged', 'bow'],
	},

	// --- Herramientas / otros ---
	lockpicks: {
		id: 'lockpicks',
		name: 'Lockpicks',
		type: 'tool',
		slots: ['misc'],
	},
	rope: {
		id: 'rope',
		name: 'Rope',
		type: 'tool',
		slots: ['misc'],
	},
	spellbook: {
		id: 'spellbook',
		name: 'Spellbook',
		type: 'spellbook',
		slots: ['spellbook'],
	},
	writing_implements: {
		id: 'writing_implements',
		name: 'Writing Implements',
		type: 'misc',
		slots: ['misc'],
	},
	holy_symbol: {
		id: 'holy_symbol',
		name: 'Holy Symbol',
		type: 'holySymbol',
		slots: ['misc'],
	},
};
