/**
 * Tests de curación, hechizos y combate 4 clases vs goblins
 */

import {
	resolveHeal,
	resolveSpell,
	applyAbilityEffects,
} from '../AbilityResolver';
import {
	executeHeroAttack,
	executeHeal,
	executeSpell,
	runEnemyTurn,
	getAliveEnemies,
} from '../TurnManager';
import {
	createCombat,
	selectAction,
	selectTarget,
} from '../CombatStateManager';
import { createDefaultParty, createHero } from '../../data/classes';
import type { Action, EnemyInstance } from '../../types/combat';

function seqRng(values: number[]): () => number {
	let i = 0;
	return () => {
		const v = values[i % values.length];
		i++;
		return (v - 1) / 6 + 0.001;
	};
}

const attack: Action = { type: 'attack', name: 'Attack', requiresTarget: true };
const healAction: Action = { type: 'heal', name: 'Heal', requiresTarget: true };
const fireball: Action = {
	type: 'spell',
	name: 'Fireball',
	requiresTarget: false,
};
const lightning: Action = {
	type: 'spell',
	name: 'Lightning Bolt',
	requiresTarget: true,
};

function makeGoblins(n: number): EnemyInstance[] {
	return Array.from({ length: n }, (_, i) => ({
		id: `gob_${i}`,
		templateId: 'minion_goblins',
		name: 'Goblin',
		level: 3,
		currentLife: 1,
		attacks: 1,
	}));
}

describe('Cleric Healing', () => {
	it('cura d6+level y consume un uso', () => {
		const cleric = createHero('cleric');
		expect(cleric.healingUsesLeft).toBe(3);

		const wounded = createHero('warrior');
		wounded.life = 3;

		const result = resolveHeal(cleric, wounded, seqRng([4]));
		expect(result.success).toBe(true);
		// amount = min(d6+level, maxLife-life) = min(4+1, 7-3) = 4
		expect(result.amount).toBe(4);

		const applied = applyAbilityEffects([cleric, wounded], [], result.effects);
		const w = applied.heroes.find((h) => h.id === wounded.id)!;
		const c = applied.heroes.find((h) => h.id === cleric.id)!;
		expect(w.life).toBe(7); // 3+4
		expect(c.healingUsesLeft).toBe(2);
	});

	it('falla sin usos restantes', () => {
		const cleric = createHero('cleric');
		cleric.healingUsesLeft = 0;
		const result = resolveHeal(cleric, cleric, seqRng([6]));
		expect(result.success).toBe(false);
	});
});

describe('Wizard spells', () => {
	it('Fireball mata goblins: final - level (mín 1)', () => {
		const wizard = createHero('wizard'); // level 1
		const goblins = makeGoblins(5);

		// dado 5 + 1 = 6, 6-3 = 3 kills
		const result = resolveSpell(wizard, 'Fireball', {
			enemies: goblins,
			targetType: 'minion',
			rng: seqRng([5]),
		});

		expect(result.success).toBe(true);
		expect(result.amount).toBe(3);

		const applied = applyAbilityEffects([wizard], goblins, result.effects);
		expect(getAliveEnemies(applied.enemies).length).toBe(2);
	});

	it('Lightning Bolt mata 1 minion si acierta', () => {
		const wizard = createHero('wizard');
		const goblins = makeGoblins(3);

		const result = resolveSpell(wizard, 'Lightning Bolt', {
			targetEnemy: goblins[0],
			enemies: goblins,
			targetType: 'minion',
			rng: seqRng([4]), // 4+1=5 >= 3
		});

		expect(result.success).toBe(true);
		expect(result.amount).toBe(1);
	});

	it('Sleep no afecta undead', () => {
		const wizard = createHero('wizard');
		wizard.spells = ['Sleep'];
		const skel: EnemyInstance = {
			id: 's1',
			templateId: 'minion_skeletons_zombies',
			name: 'Skeleton',
			level: 3,
			currentLife: 1,
			attacks: 1,
			isUndead: true,
		};

		const result = resolveSpell(wizard, 'Sleep', {
			targetEnemy: skel,
			enemies: [skel],
			targetType: 'minion',
			rng: seqRng([6]),
		});

		expect(result.success).toBe(false);
		expect(result.message).toMatch(/no-muertos|undead/i);
	});
});

describe('Combate completo: 4 clases vs goblins', () => {
	it('party por defecto derrota a 4 goblins usando ataque, heal y fireball', () => {
		const party = createDefaultParty();
		const goblins = makeGoblins(4);
		let state = createCombat(party, goblins);

		// 1) Warrior ataca
		state = selectAction(state, attack);
		state = selectTarget(state, state.enemies[0].id);
		state = executeHeroAttack(state, 'minion', {}, seqRng([5]));

		// 2) Rogue ataca (outnumbered si quedan pocos)
		if (!state.isFinished && state.phase === 'heroTurn') {
			state = selectAction(state, attack);
			const t = getAliveEnemies(state.enemies)[0];
			if (t) {
				state = selectTarget(state, t.id);
				state = executeHeroAttack(state, 'minion', {}, seqRng([4]));
			}
		}

		// 3) Cleric cura al warrior si hace falta, o ataca
		if (!state.isFinished && state.phase === 'heroTurn') {
			const cleric = state.heroes.find((h) => h.class === 'cleric')!;
			if (state.currentActorId === cleric.id) {
				const wounded = state.heroes.find((h) => h.life < h.maxLife);
				if (wounded) {
					state = selectAction(state, healAction);
					state = selectTarget(state, wounded.id);
					state = executeHeal(state, seqRng([3]));
				} else {
					state = selectAction(state, attack);
					const t = getAliveEnemies(state.enemies)[0];
					if (t) {
						state = selectTarget(state, t.id);
						state = executeHeroAttack(state, 'minion', {}, seqRng([4]));
					}
				}
			}
		}

		// 4) Wizard Fireball
		if (!state.isFinished && state.phase === 'heroTurn') {
			const wizard = state.heroes.find((h) => h.class === 'wizard')!;
			if (state.currentActorId === wizard.id) {
				state = selectAction(state, fireball);
				state = executeSpell(state, 'minion', seqRng([6, 2]));
			}
		}

		// Si aún hay enemigos y enemyTurn, correrlo y seguir un poco
		if (!state.isFinished && state.phase === 'enemyTurn') {
			state = runEnemyTurn(state, { rng: seqRng([6, 2]) });
		}

		// Segunda ronda de ataques si hace falta
		let guard = 0;
		while (
			!state.isFinished &&
			getAliveEnemies(state.enemies).length > 0 &&
			guard < 12
		) {
			guard++;
			if (state.phase === 'heroTurn') {
				const t = getAliveEnemies(state.enemies)[0];
				if (!t) break;
				state = selectAction(state, attack);
				state = selectTarget(state, t.id);
				state = executeHeroAttack(state, 'minion', {}, seqRng([5]));
			} else if (state.phase === 'enemyTurn') {
				state = runEnemyTurn(state, { rng: seqRng([6, 1]) });
			} else {
				break;
			}
		}

		expect(state.result).toBe('victory');
		expect(state.isFinished).toBe(true);
		expect(getAliveEnemies(state.enemies).length).toBe(0);
	});
});
