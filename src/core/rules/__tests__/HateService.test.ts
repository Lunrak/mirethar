import {
  classifyEnemyFaction,
  enemyHatesHero,
  hatedClassByEnemy,
  sortHeroesHateFirst,
} from '../HateService';
import type { EnemyInstance, Hero } from '../../types/combat';

function hero(partial: Partial<Hero> & { id: string; class: Hero['class'] }): Hero {
  return {
    name: partial.id,
    level: 1,
    life: 5,
    maxLife: 5,
    equipment: {},
    status: [],
    isFallen: false,
    isDead: false,
    ...partial,
  } as Hero;
}

function enemy(partial: Partial<EnemyInstance> & { id: string }): EnemyInstance {
  return {
    templateId: 'minion_skeletons_zombies',
    name: 'Skeleton',
    level: 3,
    currentLife: 1,
    attacks: 1,
    isUndead: true,
    ...partial,
  };
}

describe('HateService', () => {
  it('undead odian clérigo', () => {
    const sk = enemy({ id: 's1', isUndead: true });
    expect(classifyEnemyFaction(sk)).toBe('undead');
    expect(hatedClassByEnemy(sk)).toBe('cleric');
    expect(enemyHatesHero(sk, hero({ id: 'c', class: 'cleric' }))).toBe(true);
    expect(enemyHatesHero(sk, hero({ id: 'w', class: 'warrior' }))).toBe(false);
  });

  it('orcos odian elfo (clase futura)', () => {
    const orc = enemy({
      id: 'o1',
      templateId: 'minion_orcs',
      name: 'Orc',
      isUndead: false,
    });
    expect(classifyEnemyFaction(orc)).toBe('orc');
    expect(hatedClassByEnemy(orc)).toBe('elf');
  });

  it('extras priorizan odiados', () => {
    const heroes = [
      hero({ id: 'w', class: 'warrior', maxLife: 10 }),
      hero({ id: 'c', class: 'cleric', maxLife: 5 }),
      hero({ id: 'r', class: 'rogue', maxLife: 4 }),
    ];
    const undead = [enemy({ id: 's1' }), enemy({ id: 's2' })];
    const ordered = sortHeroesHateFirst(heroes, undead);
    expect(ordered[0].id).toBe('c');
  });
});
