/**
 * Día 23 – Weird table + reglas especiales prioritarias
 */
import { WEIRD_TABLE } from '../../data/weird';
import { BOSSES_TABLE } from '../../data/bosses';
import { generateEncounter } from '../EncounterGenerator';
import {
  getWoundsOnHit,
  isMummy,
  tryMummyConversion,
  applyOpeningMonsterEffects,
} from '../SpecialRulesService';
import { tryTrollRegeneration as tryRegen, isTroll } from '../TrollRegeneration';
import { createDefaultParty } from '../../data/classes';
import type { EnemyInstance, Hero } from '../../types/combat';

describe('Weird Monsters table', () => {
  it('tiene 6 entradas', () => {
    expect(WEIRD_TABLE).toHaveLength(6);
  });

  it('generateEncounter weird produce 1 enemigo (salvo gremlins con life 0)', () => {
    for (let i = 0; i < 12; i++) {
      const enc = generateEncounter('weird', () => 0.01); // roll ~1
      expect(enc.type).toBe('weird');
      expect(enc.enemies.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('Boss prioritarios', () => {
  it('tabla boss completa (6)', () => {
    expect(BOSSES_TABLE).toHaveLength(6);
  });

  it('ogre inflige 2 heridas', () => {
    const ogre: EnemyInstance = {
      id: 'o1',
      templateId: 'boss_ogre',
      name: 'Ogre',
      level: 5,
      currentLife: 6,
      attacks: 1,
    };
    expect(getWoundsOnHit(ogre)).toBe(2);
  });
});

describe('Mummy conversion', () => {
  it('convierte héroe caído en momia enemiga', () => {
    const party = createDefaultParty();
    const mummy: EnemyInstance = {
      id: 'm1',
      templateId: 'boss_mummy',
      name: 'Mummy',
      level: 5,
      currentLife: 4,
      attacks: 2,
      isUndead: true,
    };
    expect(isMummy(mummy)).toBe(true);
    const fallenId = party[0].id;
    const heroes = party.map((h, i) =>
      i === 0 ? { ...h, life: 0, isFallen: true } : h
    );
    const res = tryMummyConversion(heroes, [mummy], fallenId, mummy);
    expect(res.enemies.length).toBe(2);
    expect(res.heroes.find((h) => h.id === fallenId)?.isDead).toBe(true);
    expect(res.log.length).toBeGreaterThan(0);
  });
});

describe('Troll regeneration', () => {
  it('regenera con 5-6', () => {
    const troll: EnemyInstance = {
      id: 't1',
      templateId: 'minion_trolls',
      name: 'Troll',
      level: 5,
      currentLife: 0,
      attacks: 1,
    };
    expect(isTroll(troll)).toBe(true);
    const up = tryRegen(troll, { rng: () => 0.9 }); // high → 6
    expect(up.regenerated).toBe(true);
    expect(up.enemy.currentLife).toBe(1);
  });

  it('no regenera si hechizo', () => {
    const troll: EnemyInstance = {
      id: 't1',
      templateId: 'minion_trolls',
      name: 'Troll',
      level: 5,
      currentLife: 0,
      attacks: 1,
    };
    const up = tryRegen(troll, { killedBySpell: true, rng: () => 0.9 });
    expect(up.regenerated).toBe(false);
  });
});

describe('Opening gazes', () => {
  it('medusa puede petrificar', () => {
    const party = createDefaultParty();
    const medusa: EnemyInstance = {
      id: 'med',
      templateId: 'boss_medusa',
      name: 'Medusa',
      level: 4,
      currentLife: 4,
      attacks: 1,
    };
    // rng always low → fail saves
    const res = applyOpeningMonsterEffects(party, [medusa], () => 0.01);
    expect(res.log.some((l) => /Medusa/i.test(l))).toBe(true);
  });
});
