/**
 * Boss table (d6) – Manual básico Four Against Darkness
 * Fuente: GDD sección 4.3 + tablas exactas 4AD Revised
 * Derrotar un Boss da 1 tirada de XP.
 */

import type { EnemyTemplate } from '../types/combat';

export const BOSSES_TABLE: EnemyTemplate[] = [
	{
		id: 'boss_mummy',
		name: 'Mummy',
		type: 'boss',
		level: 5,
		life: 4,
		attacks: 2,
		treasureModifier: 2,
		isUndead: true,
		specialRules: [
			'Any character killed by a mummy becomes another mummy and must be fought by the party.',
			'Mummies never test morale.',
		],
		reactions: {
			1: 'always_fight',
			2: 'always_fight',
			3: 'always_fight',
			4: 'always_fight',
			5: 'always_fight',
			6: 'always_fight',
		},
	},
	{
		id: 'boss_orc_brute',
		name: 'Orc Brute',
		type: 'boss',
		level: 5,
		life: 5,
		attacks: 2,
		treasureModifier: 1,
		specialRules: [
			'May not have any magic items; treat as 2d6 x d6 gold pieces instead.',
			'Bribe: 50 gp',
		],
		reactions: {
			1: 'bribe',
			2: 'fight',
			3: 'fight',
			4: 'fight',
			5: 'fight',
			6: 'fight_to_death',
		},
	},
	{
		id: 'boss_ogre',
		name: 'Ogre',
		type: 'boss',
		level: 5,
		life: 6,
		attacks: 1,
		treasureModifier: 0,
		specialRules: [
			'Each hit from an ogre inflicts 2 life points of damage.',
			'Bribe: 30 gp',
		],
		reactions: {
			1: 'bribe',
			2: 'fight',
			3: 'fight',
			4: 'fight_to_death',
			5: 'fight_to_death',
			6: 'fight_to_death',
		},
	},
	{
		id: 'boss_medusa',
		name: 'Medusa',
		type: 'boss',
		level: 4,
		life: 4,
		attacks: 1,
		treasureModifier: 1,
		specialRules: [
			'All characters at the beginning of the battle must save versus a level 4 gaze attack or be turned to stone.',
			'Petrified characters are out of the game until a Blessing spell is cast on them.',
			'Rogues add half their level to this save.',
			'Bribe: 6d6 gp; also can trigger quest',
		],
		reactions: {
			1: 'bribe',
			2: 'quest',
			3: 'fight',
			4: 'fight',
			5: 'fight',
			6: 'fight_to_death',
		},
	},
	{
		id: 'boss_chaos_lord',
		name: 'Chaos Lord',
		type: 'boss',
		level: 6,
		life: 4,
		attacks: 3,
		treasureModifier: 1, // 2 treasure rolls at +1
		specialRules: [
			'Before the fight begins, roll d6 to determine special powers:',
			'1–3 no powers.',
			'4 evil eye (characters must roll 4+ or be at -1 on all defense rolls until the chaos lord is slain).',
			'5 energy drain (any character taking a wound from the chaos lord must roll 4+ or lose 1 level).',
			'6 hellfire blast (before combat, all characters must roll 6+ or lose 2 life points; Clerics add ½ level to this roll).',
			'When you kill a chaos lord, roll a die; on a 5 or 6 a character of your choice finds a clue.',
		],
		reactions: {
			1: 'flee_if_outnumbered',
			2: 'fight',
			3: 'fight_to_death',
			4: 'fight_to_death',
			5: 'fight_to_death',
			6: 'fight_to_death',
		},
	},
	{
		id: 'boss_small_dragon',
		name: 'Small Dragon',
		type: 'boss',
		level: 6,
		life: 5,
		attacks: 2,
		treasureModifier: 1, // 3 treasure rolls at +1
		specialRules: [
			'On each turn of the dragon, roll d6 to determine what it does.',
			'On a 1 or 2 the dragon breathes fire, inflicting 1 life to all characters who fail to save versus level 6 dragon breath (each character adds ½ level, rounded down).',
			'On a 3 to 6, the Dragon does not breathe and bites 2 random characters instead.',
			'Small dragons are never met as random monsters.',
			'Bribe: all the gold of the party (min 100 gp) or one magic item; also can trigger quest or sleeping',
		],
		reactions: {
			1: 'sleeping',
			2: 'bribe',
			3: 'bribe',
			4: 'fight',
			5: 'fight',
			6: 'quest',
		},
	},
];
