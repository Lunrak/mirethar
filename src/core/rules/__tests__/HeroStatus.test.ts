/**
 * Tests de estados de héroe: vivo / herido / caído / muerto + cargar cadáver
 */

import {
  getHeroStatus,
  applyDamageToHero,
  applyHealToHero,
  finalizeFallenHeroes,
  pickUpBody,
  dropBody,
  finalizeCombatHeroes,
  isCombatCapable,
} from '../HeroStatus';
import { createCombat } from '../CombatStateManager';
import { createHero, createDefaultParty } from '../../data/classes';
import { applyHeroAttack } from '../TurnManager';
import type { EnemyInstance } from '../../types/combat';

describe('getHeroStatus', () => {
  it('alive / wounded / fallen / dead', () => {
    const h = createHero('warrior');
    expect(getHeroStatus(h)).toBe('alive');

    h.life = 3;
    expect(getHeroStatus(h)).toBe('wounded');

    h.life = 0;
    h.isFallen = true;
    expect(getHeroStatus(h)).toBe('fallen');

    h.isDead = true;
    expect(getHeroStatus(h)).toBe('dead');
  });
});

describe('applyDamageToHero / applyHealToHero', () => {
  it('a 0 life → caído, no muerto', () => {
    const h = createHero('wizard'); // life 3
    const dmg = applyDamageToHero(h, 3);
    expect(dmg.life).toBe(0);
    expect(dmg.isFallen).toBe(true);
    expect(dmg.isDead).toBe(false);
    expect(isCombatCapable(dmg)).toBe(false);
  });

  it('curar a un caído lo levanta', () => {
    let h = createHero('rogue');
    h = applyDamageToHero(h, 99);
    expect(h.isFallen).toBe(true);

    h = applyHealToHero(h, 2);
    expect(h.life).toBe(2);
    expect(h.isFallen).toBe(false);
    expect(getHeroStatus(h)).toBe('wounded');
  });

  it('no revive a un muerto', () => {
    let h = createHero('cleric');
    h = { ...h, life: 0, isFallen: true, isDead: true };
    h = applyHealToHero(h, 10);
    expect(h.isDead).toBe(true);
    expect(h.life).toBe(0);
  });
});

describe('finalizeFallenHeroes', () => {
  it('caídos no curados pasan a muertos al final', () => {
    const party = createDefaultParty();
    party[0] = { ...party[0], life: 0, isFallen: true };
    party[1] = { ...party[1], life: 2 }; // herido pero vivo

    const { heroes, newlyDeadIds } = finalizeFallenHeroes(party);
    expect(newlyDeadIds).toEqual([party[0].id]);
    expect(heroes[0].isDead).toBe(true);
    expect(heroes[1].isDead).toBe(false);
  });
});

describe('cargar cadáver', () => {
  it('pickUpBody y dropBody', () => {
    const a = createHero('warrior', { name: 'A' });
    let b = createHero('rogue', { name: 'B' });
    b = applyDamageToHero(b, 99);

    const picked = pickUpBody([a, b], a.id, b.id);
    expect(picked.ok).toBe(true);
    expect(picked.heroes.find((h) => h.id === a.id)?.carryingBodyId).toBe(b.id);

    const dropped = dropBody(picked.heroes, a.id);
    expect(dropped.ok).toBe(true);
    expect(dropped.heroes.find((h) => h.id === a.id)?.carryingBodyId).toBeUndefined();
  });

  it('no se puede cargar si ya llevas uno o si el cuerpo está vivo', () => {
    const a = createHero('warrior');
    const b = createHero('rogue');
    const c = createHero('cleric');
    c.life = 0;
    c.isFallen = true;

    const failAlive = pickUpBody([a, b], a.id, b.id);
    expect(failAlive.ok).toBe(false);

    const ok = pickUpBody([a, c], a.id, c.id);
    expect(ok.ok).toBe(true);

    const d = createHero('wizard');
    d.life = 0;
    d.isFallen = true;
    const failDouble = pickUpBody([...ok.heroes, d], a.id, d.id);
    expect(failDouble.ok).toBe(false);
  });
});

describe('finalizeCombatHeroes en victoria', () => {
  it('al matar al último enemigo, los caídos se marcan muertos', () => {
    const party = createDefaultParty();
    party[3] = { ...party[3], life: 0, isFallen: true }; // wizard caído

    const enemies: EnemyInstance[] = [
      {
        id: 'g1',
        templateId: 'minion_goblins',
        name: 'Goblin',
        level: 1,
        currentLife: 1,
        attacks: 1,
      },
    ];

    let state = createCombat(party, enemies);
    state = applyHeroAttack(state, 'g1', 1, 'minion', 'kill');

    expect(state.isFinished).toBe(true);
    expect(state.result).toBe('victory');
    const wizard = state.heroes.find((h) => h.class === 'wizard')!;
    expect(wizard.isDead).toBe(true);
    expect(state.log.some((l) => l.message.includes('muere'))).toBe(true);
  });
});
