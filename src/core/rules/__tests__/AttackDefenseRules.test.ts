/**
 * Tests de reglas especiales de ataque y defensa 4AD
 */

import {
  computeAttackModifiers,
  getClassAttackMod,
  getWeaponAttackMod,
  applyAttackNaturalRules,
} from '../AttackModifiers';
import {
  computeDefenseModifiers,
  resolveDefense,
  getArmorDefenseMod,
  getShieldDefenseMod,
  getClassDefenseMod,
} from '../DefenseCalculator';
import { resolveAttack } from '../CombatResolver';
import { createHero } from '../../data/classes';
import type { EnemyInstance } from '../../types/combat';

function enemy(overrides: Partial<EnemyInstance> = {}): EnemyInstance {
  return {
    id: 'e1',
    templateId: 'minion_goblins',
    name: 'Goblin',
    level: 3,
    currentLife: 1,
    attacks: 1,
    ...overrides,
  };
}

function seqRng(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i++;
    return (v - 1) / 6 + 0.001;
  };
}

describe('AttackModifiers – clase', () => {
  it('Warrior +level', () => {
    const w = createHero('warrior', { level: 2 });
    expect(getClassAttackMod(w, enemy()).mod).toBe(2);
  });

  it('Cleric +½ level, +level vs undead', () => {
    const c = createHero('cleric', { level: 3 });
    expect(getClassAttackMod(c, enemy()).mod).toBe(1);
    expect(getClassAttackMod(c, enemy({ isUndead: true })).mod).toBe(3);
  });

  it('Rogue +level solo si outnumbered', () => {
    const r = createHero('rogue', { level: 2 });
    expect(getClassAttackMod(r, enemy()).mod).toBe(0);
    expect(getClassAttackMod(r, enemy(), { enemiesOutnumbered: true }).mod).toBe(2);
  });

  it('Wizard 0 con arma', () => {
    expect(getClassAttackMod(createHero('wizard'), enemy()).mod).toBe(0);
  });
});

describe('AttackModifiers – arma y especiales', () => {
  it('light weapon -1', () => {
    const rogue = createHero('rogue'); // light_hand_weapon
    const result = getWeaponAttackMod(rogue, enemy());
    expect(result.mod).toBe(-1);
  });

  it('crushing +1 vs skeleton', () => {
    const cleric = createHero('cleric');
    // Forzamos crushing en mainHand
    cleric.equipment.mainHand = {
      id: 'crushing_weapon',
      name: 'Mace',
      type: 'weapon',
      slots: ['mainHand'],
      tags: ['crushing', 'hand'],
    } as any;

    const skel = enemy({
      isUndead: true,
      templateId: 'minion_skeletons_zombies',
      name: 'Skeleton',
    });
    expect(getWeaponAttackMod(cleric, skel).mod).toBe(1);
  });

  it('skeletal rats bloquean bow/sling', () => {
    const warrior = createHero('warrior');
    warrior.equipment.mainHand = {
      id: 'bow',
      name: 'Bow',
      type: 'weapon',
      slots: ['mainHand'],
      tags: ['ranged', 'bow'],
    } as any;

    const rats = enemy({
      templateId: 'vermin_skeletal_rats',
      isUndead: true,
      name: 'Skeletal Rats',
    });
    const result = getWeaponAttackMod(warrior, rats);
    expect(result.blocked).toBe(true);
  });

  it('pasillo retaguardia bloquea melee', () => {
    const warrior = createHero('warrior');
    const result = computeAttackModifiers(warrior, enemy(), {
      inCorridor: true,
      attackerInRear: true,
    });
    expect(result.blocked).toBe(true);
  });
});

describe('AttackModifiers – natural 1 / 6', () => {
  it('natural 1 siempre falla', () => {
    expect(applyAttackNaturalRules(1, 20, 3)).toEqual({ success: false, forced: 'miss' });
  });

  it('natural 6 siempre acierta', () => {
    expect(applyAttackNaturalRules(6, 1, 10)).toEqual({ success: true, forced: 'hit' });
  });

  it('otros valores usan comparación normal', () => {
    expect(applyAttackNaturalRules(4, 5, 3).success).toBe(true);
    expect(applyAttackNaturalRules(2, 2, 5).success).toBe(false);
  });
});

describe('DefenseCalculator – mods', () => {
  it('light armor +1, shield +1', () => {
    const warrior = createHero('warrior'); // light armor + shield
    const mods = computeDefenseModifiers(warrior);
    expect(mods.armorMod).toBe(1);
    expect(mods.shieldMod).toBe(1);
    expect(mods.total).toBe(2);
  });

  it('Rogue suma level a Defense', () => {
    const rogue = createHero('rogue', { level: 2 });
    expect(getClassDefenseMod(rogue).mod).toBe(2);
  });

  it('surprise ignora shield', () => {
    const warrior = createHero('warrior');
    const mods = computeDefenseModifiers(warrior, { surpriseAttack: true });
    expect(mods.shieldMod).toBe(0);
    expect(mods.armorMod).toBe(1); // armadura sí cuenta
  });

  it('withdrawing +1', () => {
    const warrior = createHero('warrior');
    const mods = computeDefenseModifiers(warrior, { withdrawing: true });
    expect(mods.situationalMod).toBe(1);
  });
});

describe('resolveDefense', () => {
  it('éxito cuando final >= level', () => {
    const warrior = createHero('warrior'); // +2 def (armor+shield)
    // dado 3 → 3+2=5 vs level 3
    const result = resolveDefense(warrior, 3, { rng: seqRng([3]) });
    expect(result.success).toBe(true);
    expect(result.damageTaken).toBe(0);
  });

  it('natural 1 siempre falla aunque los mods sean altos', () => {
    const rogue = createHero('rogue', { level: 5 }); // +5 class +1 armor = mucho
    const result = resolveDefense(rogue, 2, { rng: seqRng([1]) });
    expect(result.forced).toBe('failure');
    expect(result.success).toBe(false);
    expect(result.damageTaken).toBe(1);
  });

  it('natural 6 siempre éxito', () => {
    const wizard = createHero('wizard'); // sin armadura
    const result = resolveDefense(wizard, 10, { rng: seqRng([6, 1]) }); // explosive 6+1=7
    expect(result.forced).toBe('success');
    expect(result.success).toBe(true);
  });
});

describe('resolveAttack integrado con nuevas reglas', () => {
  it('Cleric vs undead con crushing', () => {
    const cleric = createHero('cleric', { level: 2 });
    cleric.equipment.mainHand = {
      id: 'crushing_weapon',
      name: 'Mace',
      type: 'weapon',
      slots: ['mainHand'],
      tags: ['crushing', 'hand'],
    } as any;

    const skel = enemy({
      isUndead: true,
      level: 3,
      templateId: 'minion_skeletons_zombies',
      name: 'Skeleton',
    });

    const result = resolveAttack({
      actor: cleric,
      target: skel,
      targetType: 'minion',
      rng: seqRng([2]),
    });

    // class +2 (undead) + crushing +1 = +3 → final 2+3=5 >= 3
    expect(result.classModifier).toBe(2);
    expect(result.equipmentModifier).toBe(1);
    expect(result.success).toBe(true);
  });

  it('ataque bloqueado a skeletal rats con bow', () => {
    const w = createHero('warrior');
    w.equipment.mainHand = {
      id: 'bow',
      name: 'Bow',
      type: 'weapon',
      slots: ['mainHand'],
      tags: ['bow', 'ranged'],
    } as any;

    const result = resolveAttack({
      actor: w,
      target: enemy({
        templateId: 'vermin_skeletal_rats',
        isUndead: true,
        name: 'Skeletal Rats',
      }),
      targetType: 'vermin',
    });

    expect(result.blocked).toBe(true);
    expect(result.success).toBe(false);
  });
});
