/**
 * Tests exhaustivos de reglas 4AD – CombatResolver + mods + moral + reacciones + trolls + posicionamiento
 */

import { resolveAttack, calculateDamage, getDefenseValue } from '../CombatResolver';
import {
  computeAttackModifiers,
  applyAttackNaturalRules,
  getClassAttackMod,
  getWeaponAttackMod,
} from '../AttackModifiers';
import {
  computeDefenseModifiers,
  resolveDefense,
} from '../DefenseCalculator';
import {
  shouldMinionsTestMorale,
  shouldBossTestMorale,
  bossLevelAfterHalfDamage,
  rollMorale,
  checkMinionMoraleAfterLoss,
} from '../MoraleService';
import {
  resolveReaction,
  reactionStartsCombat,
  reactionFlees,
  reactionAllowsBribe,
} from '../ReactionService';
import { tryTrollRegeneration, isTroll } from '../TrollRegeneration';
import { rollWithExplosiveSix } from '../DiceService';
import { createHero } from '../../data/classes';
import { VERMIN_TABLE } from '../../data/vermin';
import { MINIONS_TABLE } from '../../data/minions';
import { BOSSES_TABLE } from '../../data/bosses';
import type { EnemyInstance, Hero } from '../../types/combat';

function seqRng(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i++;
    return (v - 1) / 6 + 0.001;
  };
}

function enemy(o: Partial<EnemyInstance> & { level: number }): EnemyInstance {
  return {
    id: 'e1',
    templateId: 'minion_goblins',
    name: 'Goblin',
    currentLife: 1,
    attacks: 1,
    ...o,
  };
}

// ===========================================================================
describe('Ataques normales', () => {
  it('Warrior L1 + d4 vs goblin L3 → 4+1=5 éxito, 1 kill', () => {
    const r = resolveAttack({
      actor: createHero('warrior'),
      target: enemy({ level: 3 }),
      targetType: 'minion',
      rng: seqRng([4]),
    });
    expect(r.success).toBe(true);
    expect(r.finalValue).toBe(5);
    expect(r.damage).toBe(1);
  });

  it('fallo si finalValue < level', () => {
    const r = resolveAttack({
      actor: createHero('wizard'), // +0, light -1
      target: enemy({ level: 5 }),
      targetType: 'minion',
      rng: seqRng([2]),
    });
    expect(r.success).toBe(false);
    expect(r.damage).toBe(0);
  });

  it('exceso: 8 vs L3 → 2 kills; 9 vs L4 boss → 2 heridas', () => {
    expect(calculateDamage(8, 3, true)).toBe(2);
    expect(calculateDamage(9, 4, true)).toBe(2);
  });

  it('Defense Value = level', () => {
    expect(getDefenseValue(enemy({ level: 6 }))).toBe(6);
  });
});

// ===========================================================================
describe('Explosive Six', () => {
  it('6+3 = 9 total, isExplosive', () => {
    const d = rollWithExplosiveSix(seqRng([6, 3]));
    expect(d.total).toBe(9);
    expect(d.isExplosive).toBe(true);
    expect(d.raw).toBe(6);
    expect(d.explosive).toEqual([3]);
  });

  it('6+6+2 = 14', () => {
    const d = rollWithExplosiveSix(seqRng([6, 6, 2]));
    expect(d.total).toBe(14);
    expect(d.explosive).toEqual([6, 2]);
  });

  it('sin 6 → no explosive', () => {
    const d = rollWithExplosiveSix(seqRng([5]));
    expect(d.isExplosive).toBe(false);
    expect(d.total).toBe(5);
  });

  it('Warrior con explosive marca critical', () => {
    const r = resolveAttack({
      actor: createHero('warrior'),
      target: enemy({ level: 3 }),
      targetType: 'minion',
      rng: seqRng([6, 2]),
    });
    expect(r.critical).toBe(true);
    expect(r.dice.total).toBe(8);
    expect(r.finalValue).toBe(9); // 8+1
  });
});

// ===========================================================================
describe('Natural 1 / Natural 6', () => {
  it('natural 1 siempre falla aunque final sea alto', () => {
    expect(applyAttackNaturalRules(1, 99, 3)).toEqual({ success: false, forced: 'miss' });
  });

  it('natural 6 siempre acierta aunque final sea bajo', () => {
    expect(applyAttackNaturalRules(6, 1, 10)).toEqual({ success: true, forced: 'hit' });
  });
});

// ===========================================================================
describe('Undead y armas', () => {
  it('Cleric +level completo vs undead', () => {
    const c = createHero('cleric', { level: 2 });
    const skel = enemy({ level: 3, isUndead: true, name: 'Skeleton', templateId: 'minion_skeletons_zombies' });
    expect(getClassAttackMod(c, skel).mod).toBe(2);
  });

  it('Cleric +½ level vs vivos', () => {
    const c = createHero('cleric', { level: 3 });
    expect(getClassAttackMod(c, enemy({ level: 3 })).mod).toBe(1);
  });

  it('crushing +1 vs skeleton', () => {
    const cleric = createHero('cleric');
    cleric.equipment.mainHand = {
      id: 'crushing_weapon',
      name: 'Mace',
      type: 'weapon',
      slots: ['mainHand'],
      tags: ['crushing', 'hand'],
    } as any;
    const skel = enemy({
      level: 3,
      isUndead: true,
      name: 'Skeleton',
      templateId: 'minion_skeletons_zombies',
    });
    expect(getWeaponAttackMod(cleric, skel).mod).toBe(1);
  });

  it('arrows -1 vs undead', () => {
    const w = createHero('warrior');
    w.equipment.mainHand = {
      id: 'bow',
      name: 'Bow',
      type: 'weapon',
      slots: ['mainHand'],
      tags: ['bow', 'ranged'],
    } as any;
    const z = enemy({ level: 3, isUndead: true, name: 'Zombie' });
    expect(getWeaponAttackMod(w, z).mod).toBe(-1);
  });

  it('skeletal rats: bow bloqueado', () => {
    const w = createHero('warrior');
    w.equipment.mainHand = {
      id: 'bow',
      name: 'Bow',
      type: 'weapon',
      slots: ['mainHand'],
      tags: ['bow', 'ranged'],
    } as any;
    const rats = enemy({
      level: 3,
      isUndead: true,
      templateId: 'vermin_skeletal_rats',
      name: 'Skeletal Rats',
    });
    expect(getWeaponAttackMod(w, rats).blocked).toBe(true);
    const r = resolveAttack({ actor: w, target: rats, targetType: 'vermin' });
    expect(r.blocked).toBe(true);
  });
});

// ===========================================================================
describe('Clases – mods de ataque', () => {
  it('Warrior siempre +L', () => {
    expect(getClassAttackMod(createHero('warrior', { level: 3 }), enemy({ level: 1 })).mod).toBe(3);
  });

  it('Rogue +L solo outnumbered', () => {
    const r = createHero('rogue', { level: 2 });
    expect(getClassAttackMod(r, enemy({ level: 3 })).mod).toBe(0);
    expect(getClassAttackMod(r, enemy({ level: 3 }), { enemiesOutnumbered: true }).mod).toBe(2);
  });

  it('Wizard 0 con arma', () => {
    expect(getClassAttackMod(createHero('wizard'), enemy({ level: 1 })).mod).toBe(0);
  });

  it('light weapon -1, two-handed +1', () => {
    const rogue = createHero('rogue'); // light
    expect(getWeaponAttackMod(rogue, enemy({ level: 1 })).mod).toBe(-1);

    const w = createHero('warrior');
    w.equipment.mainHand = {
      id: 'two_handed_weapon',
      name: 'Greatsword',
      type: 'weapon',
      slots: ['mainHand', 'offHand'],
      tags: ['two-handed'],
    } as any;
    expect(getWeaponAttackMod(w, enemy({ level: 1 })).mod).toBe(1);
  });
});

// ===========================================================================
describe('Posicionamiento (pasillo / retaguardia)', () => {
  it('retaguardia en pasillo no puede melee', () => {
    const w = createHero('warrior');
    const mods = computeAttackModifiers(w, enemy({ level: 3 }), {
      inCorridor: true,
      attackerInRear: true,
    });
    expect(mods.blocked).toBe(true);
  });

  it('retaguardia con bow sí puede', () => {
    const w = createHero('warrior');
    w.equipment.mainHand = {
      id: 'bow',
      name: 'Bow',
      type: 'weapon',
      slots: ['mainHand'],
      tags: ['bow', 'ranged'],
    } as any;
    const mods = computeAttackModifiers(w, enemy({ level: 3 }), {
      inCorridor: true,
      attackerInRear: true,
    });
    expect(mods.blocked).toBe(false);
  });

  it('frente en pasillo puede melee', () => {
    const w = createHero('warrior');
    const mods = computeAttackModifiers(w, enemy({ level: 3 }), {
      inCorridor: true,
      attackerInRear: false,
    });
    expect(mods.blocked).toBe(false);
  });
});

// ===========================================================================
describe('Defensa', () => {
  it('light armor +1, shield +1, rogue +L', () => {
    const warrior = createHero('warrior');
    expect(computeDefenseModifiers(warrior).total).toBe(2);

    const rogue = createHero('rogue', { level: 2 });
    // light armor +1, no shield, +2 rogue
    expect(computeDefenseModifiers(rogue).total).toBe(3);
  });

  it('surprise ignora shield', () => {
    const w = createHero('warrior');
    expect(computeDefenseModifiers(w, { surpriseAttack: true }).shieldMod).toBe(0);
  });

  it('natural 1 defense siempre fallo', () => {
    const r = resolveDefense(createHero('rogue', { level: 5 }), 2, { rng: seqRng([1]) });
    expect(r.forced).toBe('failure');
    expect(r.success).toBe(false);
  });

  it('natural 6 defense siempre éxito', () => {
    const r = resolveDefense(createHero('wizard'), 12, { rng: seqRng([6, 1]) });
    expect(r.forced).toBe('success');
    expect(r.success).toBe(true);
  });
});

// ===========================================================================
describe('Moral', () => {
  it('minions testean al perder más de la mitad', () => {
    expect(shouldMinionsTestMorale(6, 2, 'minion_goblins')).toBe(true);
    expect(shouldMinionsTestMorale(6, 4, 'minion_goblins')).toBe(false);
  });

  it('esqueletos nunca testean moral', () => {
    expect(shouldMinionsTestMorale(10, 1, 'minion_skeletons_zombies')).toBe(false);
  });

  it('boss testa al perder > mitad life; level baja 1', () => {
    expect(shouldBossTestMorale(5, 2, 'boss_orc_brute')).toBe(true);
    expect(bossLevelAfterHalfDamage(6, 5, 2)).toBe(5);
    expect(bossLevelAfterHalfDamage(6, 5, 4)).toBe(6);
  });

  it('tirada moral 1-3 huye, 4-6 lucha', () => {
    expect(rollMorale('minion_goblins', seqRng([2])).fled).toBe(true);
    expect(rollMorale('minion_goblins', seqRng([5])).fled).toBe(false);
  });

  it('goblin swarmlings morale -1: con 4 → 3 → huyen', () => {
    const r = rollMorale('vermin_goblin_swarmlings', seqRng([4]));
    expect(r.fled).toBe(true); // 4 + (-1) = 3
  });

  it('solo una tirada de moral por encuentro', () => {
    const r = checkMinionMoraleAfterLoss('minion_goblins', 6, 2, true, seqRng([1]));
    expect(r.tested).toBe(false);
  });

  it('momia never tests morale', () => {
    expect(shouldBossTestMorale(4, 1, 'boss_mummy')).toBe(false);
  });
});

// ===========================================================================
describe('Reacciones', () => {
  it('goblins: roll 1 → flee_if_outnumbered', () => {
    const goblins = MINIONS_TABLE.find((t) => t.id === 'minion_goblins')!;
    const r = resolveReaction(goblins, seqRng([1]));
    expect(r.reaction).toBe('flee_if_outnumbered');
  });

  it('mummy always_fight', () => {
    const mummy = BOSSES_TABLE.find((t) => t.id === 'boss_mummy')!;
    const r = resolveReaction(mummy, seqRng([3]));
    expect(r.reaction).toBe('always_fight');
    expect(reactionStartsCombat(r.reaction)).toBe(true);
  });

  it('flee_if_outnumbered solo si enemyCount < partySize', () => {
    expect(reactionFlees('flee_if_outnumbered', 4, 2)).toBe(true);
    expect(reactionFlees('flee_if_outnumbered', 4, 5)).toBe(false);
    expect(reactionFlees('flee', 4, 10)).toBe(true);
  });

  it('bribe detectado', () => {
    expect(reactionAllowsBribe('bribe')).toBe(true);
    expect(reactionAllowsBribe('fight')).toBe(false);
  });

  it('small dragon roll 1 → sleeping', () => {
    const dragon = BOSSES_TABLE.find((t) => t.id === 'boss_small_dragon')!;
    expect(resolveReaction(dragon, seqRng([1])).reaction).toBe('sleeping');
  });

  it('todas las tablas tienen reactions 1-6', () => {
    for (const t of [...VERMIN_TABLE, ...MINIONS_TABLE, ...BOSSES_TABLE]) {
      for (let i = 1; i <= 6; i++) {
        expect(t.reactions[i]).toBeDefined();
      }
    }
  });
});

// ===========================================================================
describe('Regeneración de trolls', () => {
  const troll = enemy({
    level: 5,
    currentLife: 0,
    templateId: 'minion_trolls',
    name: 'Troll',
  });

  it('isTroll', () => {
    expect(isTroll(troll)).toBe(true);
  });

  it('regenera con 5 o 6', () => {
    const r = tryTrollRegeneration(troll, { rng: seqRng([5]) });
    expect(r.regenerated).toBe(true);
    expect(r.enemy.currentLife).toBe(1);
  });

  it('no regenera con 1-4', () => {
    const r = tryTrollRegeneration(troll, { rng: seqRng([3]) });
    expect(r.regenerated).toBe(false);
  });

  it('no regenera si killedBySpell', () => {
    const r = tryTrollRegeneration(troll, { killedBySpell: true, rng: seqRng([6]) });
    expect(r.regenerated).toBe(false);
    expect(r.message).toMatch(/hechizo/i);
  });

  it('no regenera si choppedToBits', () => {
    const r = tryTrollRegeneration(troll, { choppedToBits: true, rng: seqRng([6]) });
    expect(r.regenerated).toBe(false);
  });
});

// ===========================================================================
describe('Integración resolveAttack – casos combinados', () => {
  it('Cleric L2 crushing vs skeleton L3: class+2 weapon+1 dado2 = 5 éxito', () => {
    const c = createHero('cleric', { level: 2 });
    c.equipment.mainHand = {
      id: 'crushing_weapon',
      name: 'Mace',
      type: 'weapon',
      slots: ['mainHand'],
      tags: ['crushing', 'hand'],
    } as any;
    const r = resolveAttack({
      actor: c,
      target: enemy({
        level: 3,
        isUndead: true,
        name: 'Skeleton',
        templateId: 'minion_skeletons_zombies',
      }),
      targetType: 'minion',
      rng: seqRng([2]),
    });
    expect(r.classModifier).toBe(2);
    expect(r.equipmentModifier).toBe(1);
    expect(r.finalValue).toBe(5);
    expect(r.success).toBe(true);
  });

  it('Rogue outnumbered + light weapon vs L3', () => {
    const r = resolveAttack({
      actor: createHero('rogue', { level: 2 }),
      target: enemy({ level: 3 }),
      targetType: 'minion',
      context: { enemiesOutnumbered: true },
      rng: seqRng([2]),
    });
    // 2 + 2 - 1 = 3 >= 3
    expect(r.finalValue).toBe(3);
    expect(r.success).toBe(true);
  });
});
