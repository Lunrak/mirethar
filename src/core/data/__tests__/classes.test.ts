import { createHero, createDefaultParty, CLASSES } from '../classes';
import { ITEMS } from '../items';

describe('Classes & Party Factory', () => {
	it('tiene las 4 clases con life correctos de nivel 1', () => {
		expect(CLASSES.warrior.baseLife).toBe(7);
		expect(CLASSES.rogue.baseLife).toBe(4);
		expect(CLASSES.cleric.baseLife).toBe(5);
		expect(CLASSES.wizard.baseLife).toBe(3);
	});

	it('createHero genera un Warrior nivel 1 con equipo correcto', () => {
		const hero = createHero('warrior');

		expect(hero.class).toBe('warrior');
		expect(hero.level).toBe(1);
		expect(hero.life).toBe(7);
		expect(hero.maxLife).toBe(7);
		expect(hero.isFallen).toBe(false);
		expect(hero.isDead).toBe(false);

		// Equipo inicial 4AD
		expect(hero.equipment.armor?.id).toBe('light_armor');
		expect(hero.equipment.shield?.id).toBe('shield');
		expect(hero.equipment.mainHand?.id).toBe('hand_weapon');
	});

	it('createHero genera un Rogue con lockpicks y rope', () => {
		const hero = createHero('rogue');
		expect(hero.life).toBe(4);
		expect(hero.equipment.armor?.id).toBe('light_armor');
		expect(hero.equipment.mainHand?.id).toBe('light_hand_weapon');
		expect(hero.equipment.misc?.id).toBeDefined(); // lockpicks o rope
	});

	it('createHero genera un Cleric con holy symbol', () => {
		const hero = createHero('cleric');
		expect(hero.life).toBe(5);
		expect(hero.equipment.armor?.id).toBe('light_armor');
		expect(hero.equipment.shield?.id).toBe('shield');
	});

	it('createHero genera un Wizard sin armadura y con spellbook', () => {
		const hero = createHero('wizard');
		expect(hero.life).toBe(3);
		expect(hero.equipment.armor).toBeUndefined();
		expect(hero.equipment.spellbook?.id).toBe('spellbook');
		expect(hero.spells).toHaveLength(3);
	});

	it('createDefaultParty devuelve las 4 clases en orden', () => {
		const party = createDefaultParty();

		expect(party).toHaveLength(4);
		expect(party[0].class).toBe('warrior');
		expect(party[1].class).toBe('rogue');
		expect(party[2].class).toBe('cleric');
		expect(party[3].class).toBe('wizard');

		// Todas vivas y con life correcto
		expect(party.map((h) => h.life)).toEqual([7, 4, 5, 3]);
		expect(party.every((h) => !h.isDead && !h.isFallen)).toBe(true);
	});

	it('todos los items de equipo inicial existen en ITEMS', () => {
		Object.values(CLASSES).forEach((cls) => {
			cls.startingEquipmentIds.forEach((id) => {
				expect(ITEMS[id]).toBeDefined();
			});
		});
	});
});
