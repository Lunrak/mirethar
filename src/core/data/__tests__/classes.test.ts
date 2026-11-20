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
    expect(hero.equipment.armor?.id).toBe('light_armor');
    expect(hero.equipment.shield?.id).toBe('shield');
    expect(hero.equipment.mainHand?.id).toBe('hand_weapon');
  });

  it('createDefaultParty devuelve las 4 clases en orden', () => {
    const party = createDefaultParty();
    expect(party).toHaveLength(4);
    expect(party.map((h) => h.class)).toEqual(['warrior', 'rogue', 'cleric', 'wizard']);
    expect(party.map((h) => h.life)).toEqual([7, 4, 5, 3]);
  });

  it('todos los items de equipo inicial existen en ITEMS', () => {
    Object.values(CLASSES).forEach((cls) => {
      cls.startingEquipmentIds.forEach((id) => {
        expect(ITEMS[id]).toBeDefined();
      });
    });
  });
});
