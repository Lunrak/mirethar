/**
 * Tests de CombatResolver – resolveAttack (GDD §7.3 + 4AD)
 */

import {
	resolveAttack,
	getClassAttackModifier,
	getEquipmentAttackModifier,
	calculateDamage,
	getDefenseValue,
} from '../CombatResolver';
import { createHero } from '../../data/classes';
import type { EnemyInstance, Hero } from '../../types/combat';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEnemy(overrides: Partial<EnemyInstance> = {}): EnemyInstance {
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

/** rng que produce una secuencia fija de d6 (valores 1-6) */
function seqRng(values: number[]): () => number {
	let i = 0;
	return () => {
		const v = values[i % values.length];
		i++;
		// rollD6 usa Math.floor(rng() * 6) + 1 → invertimos
		return (v - 1) / 6 + 0.001;
	};
}

// ---------------------------------------------------------------------------
// getClassAttackModifier
// ---------------------------------------------------------------------------

describe('getClassAttackModifier', () => {
	it('Warrior siempre suma su level', () => {
		const warrior = createHero('warrior', { level: 2 });
		expect(getClassAttackModifier(warrior, makeEnemy())).toBe(2);
	});

	it('Cleric suma floor(level/2), o level vs undead', () => {
		const cleric = createHero('cleric', { level: 3 });
		expect(getClassAttackModifier(cleric, makeEnemy())).toBe(1);
		expect(getClassAttackModifier(cleric, makeEnemy({ isUndead: true }))).toBe(
			3,
		);
	});

	it('Rogue solo suma level si enemiesOutnumbered', () => {
		const rogue = createHero('rogue', { level: 2 });
		expect(getClassAttackModifier(rogue, makeEnemy())).toBe(0);
		expect(
			getClassAttackModifier(rogue, makeEnemy(), { enemiesOutnumbered: true }),
		).toBe(2);
	});

	it('Wizard suma 0 en ataque con arma', () => {
		const wizard = createHero('wizard', { level: 3 });
		expect(getClassAttackModifier(wizard, makeEnemy())).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// calculateDamage (regla de exceso 4AD)
// ---------------------------------------------------------------------------

describe('calculateDamage', () => {
	it('fallo → 0', () => {
		expect(calculateDamage(2, 3, false)).toBe(0);
	});

	it('exacto al level → 1', () => {
		expect(calculateDamage(3, 3, true)).toBe(1);
	});

	it('8 vs level 3 → 2 kills', () => {
		expect(calculateDamage(8, 3, true)).toBe(2);
	});

	it('9 vs level 4 boss → 2 heridas', () => {
		expect(calculateDamage(9, 4, true)).toBe(2);
	});

	it('5 vs level 3 → 1 (sobran 2)', () => {
		expect(calculateDamage(5, 3, true)).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// resolveAttack
// ---------------------------------------------------------------------------

describe('resolveAttack', () => {
	it('Warrior nivel 1 con dado 4 vs goblin level 3 → éxito (4+1=5 >= 3)', () => {
		const warrior = createHero('warrior'); // level 1, +1
		const goblin = makeEnemy({ level: 3 });
		// d6 = 4
		const result = resolveAttack({
			actor: warrior,
			target: goblin,
			targetType: 'minion',
			rng: seqRng([4]),
		});

		expect(result.dice.total).toBe(4);
		expect(result.classModifier).toBe(1);
		expect(result.finalValue).toBe(5); // 4+1
		expect(result.defenseValue).toBe(3);
		expect(result.success).toBe(true);
		expect(result.damage).toBe(1); // floor(5/3)=1
		expect(result.critical).toBe(false);
	});

	it('Warrior con Explosive Six (6+3) vs level 3 → final 10, 3 kills', () => {
		const warrior = createHero('warrior');
		const result = resolveAttack({
			actor: warrior,
			target: makeEnemy({ level: 3 }),
			targetType: 'minion',
			rng: seqRng([6, 3]),
		});

		expect(result.dice.isExplosive).toBe(true);
		expect(result.dice.total).toBe(9); // 6+3
		expect(result.finalValue).toBe(10); // 9+1
		expect(result.success).toBe(true);
		expect(result.damage).toBe(3); // floor(10/3)=3
		expect(result.critical).toBe(true);
	});

	it('fallo: dado bajo', () => {
		const wizard = createHero('wizard'); // +0
		const result = resolveAttack({
			actor: wizard,
			target: makeEnemy({ level: 4 }),
			targetType: 'minion',
			rng: seqRng([2]),
		});

		expect(result.finalValue).toBe(2);
		expect(result.success).toBe(false);
		expect(result.damage).toBe(0);
	});

	it('Cleric vs undead usa +level completo', () => {
		const cleric = createHero('cleric', { level: 2 }); // +2 vs undead
		const skeleton = makeEnemy({ level: 3, isUndead: true, name: 'Skeleton' });
		const result = resolveAttack({
			actor: cleric,
			target: skeleton,
			targetType: 'minion',
			rng: seqRng([2]),
		});

		expect(result.classModifier).toBe(2);
		expect(result.finalValue).toBe(4); // 2+2
		expect(result.success).toBe(true);
	});

	it('Rogue con enemiesOutnumbered suma level', () => {
		const rogue = createHero('rogue', { level: 2 });
		const result = resolveAttack({
			actor: rogue,
			target: makeEnemy({ level: 3 }),
			targetType: 'minion',
			context: { enemiesOutnumbered: true },
			rng: seqRng([2]),
		});

		expect(result.classModifier).toBe(2);
		expect(result.finalValue).toBe(4);
		expect(result.success).toBe(true);
	});

	it('Boss: Explosive 6+2 + warrior1 = 9 vs level 4 → 2 heridas', () => {
		const warrior = createHero('warrior');
		const boss = makeEnemy({ level: 4, currentLife: 6, name: 'Ogre' });
		const result = resolveAttack({
			actor: warrior,
			target: boss,
			targetType: 'boss',
			rng: seqRng([6, 2]),
		});

		expect(result.dice.total).toBe(8);
		expect(result.finalValue).toBe(9);
		expect(result.success).toBe(true);
		expect(result.damage).toBe(2); // floor(9/4)=2
		expect(result.message).toContain('2 heridas');
	});

	it('mensaje de fallo y de éxito son legibles', () => {
		const warrior = createHero('warrior', { name: 'Bruggo' });
		const fail = resolveAttack({
			actor: warrior,
			target: makeEnemy({ level: 10, name: 'Dragon' }),
			targetType: 'boss',
			rng: seqRng([1]),
		});
		expect(fail.message).toContain('FALLO');

		const ok = resolveAttack({
			actor: warrior,
			target: makeEnemy({ level: 1, name: 'Rat' }),
			targetType: 'vermin',
			rng: seqRng([3]),
		});
		expect(ok.message).toContain('ÉXITO');
	});
});

describe('getDefenseValue', () => {
	it('es el level del monstruo', () => {
		expect(getDefenseValue(makeEnemy({ level: 5 }))).toBe(5);
	});
});
