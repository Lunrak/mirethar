/**
 * Vermin table (d6) – Manual básico Four Against Darkness
 * Fuente: GDD sección 4.1 + tablas exactas 4AD Revised
 * No dan tirada de XP.
 */

import type { EnemyTemplate } from '../types/combat';

export const VERMIN_TABLE: EnemyTemplate[] = [
	{
		id: 'vermin_rats',
		name: 'Rats',
		type: 'vermin',
		level: 1,
		life: 1,
		attacks: 1,
		treasureModifier: -99, // no treasure
		specialRules: [
			'Any character wounded has a 1 in 6 chance of losing 1 additional life due to an infected wound.',
		],
		reactions: {
			1: 'flee',
			2: 'flee',
			3: 'flee',
			4: 'fight',
			5: 'fight',
			6: 'fight',
		},
	},
	{
		id: 'vermin_vampire_bats',
		name: 'Vampire Bats',
		type: 'vermin',
		level: 1,
		life: 1,
		attacks: 1,
		treasureModifier: -99,
		specialRules: [
			'Spells are cast at -1 due to their distracting shrieking.',
			'Despite the Vampire moniker, these are NOT Undead creatures.',
		],
		reactions: {
			1: 'flee',
			2: 'flee',
			3: 'flee',
			4: 'fight',
			5: 'fight',
			6: 'fight',
		},
	},
	{
		id: 'vermin_goblin_swarmlings',
		name: 'Goblin Swarmlings',
		type: 'vermin',
		level: 3,
		life: 1,
		attacks: 1,
		treasureModifier: -1,
		specialRules: [
			'Morale -1.',
			'Dwarves attack them at +1.',
			'Bribe: 5 gp per goblin',
		],
		reactions: {
			1: 'flee',
			2: 'flee_if_outnumbered',
			3: 'flee_if_outnumbered',
			4: 'bribe',
			5: 'fight',
			6: 'fight',
		},
	},
	{
		id: 'vermin_giant_centipedes',
		name: 'Giant Centipedes',
		type: 'vermin',
		level: 3,
		life: 1,
		attacks: 1,
		treasureModifier: -99,
		specialRules: [
			'Any character wounded by a giant centipede must save versus level 2 poison or lose 1 additional life.',
		],
		reactions: {
			1: 'flee',
			2: 'flee_if_outnumbered',
			3: 'flee_if_outnumbered',
			4: 'fight',
			5: 'fight',
			6: 'fight',
		},
	},
	{
		id: 'vermin_vampire_frogs',
		name: 'Vampire Frogs',
		type: 'vermin',
		level: 4,
		life: 1,
		attacks: 1,
		treasureModifier: -1,
		specialRules: [
			'Despite the Vampire moniker, these are not Undead creatures.',
		],
		reactions: {
			1: 'flee',
			2: 'fight',
			3: 'fight',
			4: 'fight',
			5: 'fight_to_death',
			6: 'fight_to_death',
		},
	},
	{
		id: 'vermin_skeletal_rats',
		name: 'Skeletal Rats',
		type: 'vermin',
		level: 3,
		life: 1,
		attacks: 1,
		treasureModifier: -99,
		isUndead: true,
		specialRules: [
			'Crushing weapon attacks are at +1 against skeletal rats.',
			'They cannot be attacked by bows and slings.',
			'Clerics add +L when attacking them because they are undead.',
		],
		reactions: {
			1: 'flee',
			2: 'flee',
			3: 'fight',
			4: 'fight',
			5: 'fight',
			6: 'fight',
		},
	},
];
