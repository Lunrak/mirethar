/**
 * Revisión Semana 2 – Combate E2E por consola: 4 héroes vs Boss
 * Verifica victoria/derrota, heridas, caídos→muertos y XP.
 */

import {
	createCombat,
	selectAction,
	selectTarget,
} from '../CombatStateManager';
import {
	executeHeroAttack,
	runEnemyTurn,
	getAliveEnemies,
	getAliveHeroes,
} from '../TurnManager';
import { getHeroStatus } from '../HeroStatus';
import { awardBossXp, rollXpForHero } from '../XpService';
import { createDefaultParty } from '../../data/classes';
import { BOSSES_TABLE } from '../../data/bosses';
import type {
	Action,
	CombatState,
	EnemyInstance,
	Hero,
} from '../../types/combat';

const attack: Action = { type: 'attack', name: 'Attack', requiresTarget: true };

function seqRng(values: number[]): () => number {
	let i = 0;
	return () => {
		const v = values[i % values.length];
		i++;
		return (v - 1) / 6 + 0.001;
	};
}

function makeBoss(templateId: string = 'boss_orc_brute'): EnemyInstance {
	const t = BOSSES_TABLE.find((b) => b.id === templateId)!;
	return {
		id: 'boss_1',
		templateId: t.id,
		name: t.name,
		level: t.level,
		currentLife: t.life,
		attacks: t.attacks,
		isUndead: t.isUndead,
	};
}

function printState(label: string, state: CombatState) {
	console.log(`\n=== ${label} ===`);
	console.log(
		`Fase: ${state.phase} | Ronda: ${state.round} | Finished: ${state.isFinished} | Result: ${state.result}`,
	);
	console.log(
		'Héroes:',
		state.heroes
			.map((h) => `${h.name}(${getHeroStatus(h)}) L${h.life}/${h.maxLife}`)
			.join(' | '),
	);
	console.log(
		'Enemigos:',
		state.enemies
			.map((e) => `${e.name} L${e.currentLife} (lvl ${e.level})`)
			.join(' | '),
	);
	const lastLogs = state.log.slice(-3).map((l) => l.message);
	if (lastLogs.length) console.log('Log:', lastLogs.join(' / '));
}

function runBossFight(
	bossId: string,
	heroRng: () => number,
	enemyRng: () => number,
	maxRounds = 20,
): CombatState {
	const party = createDefaultParty();
	const boss = makeBoss(bossId);
	let state = createCombat(party, [boss]);

	printState('INICIO', state);

	let guard = 0;
	while (!state.isFinished && guard < maxRounds * 8) {
		guard++;

		if (state.phase === 'heroTurn') {
			const target = getAliveEnemies(state.enemies)[0];
			if (!target) break;

			state = selectAction(state, attack);
			state = selectTarget(state, target.id);
			state = executeHeroAttack(state, 'boss', {}, heroRng);
			continue;
		}

		if (state.phase === 'enemyTurn') {
			state = runEnemyTurn(state, { rng: enemyRng });
			continue;
		}

		break;
	}

	printState('FINAL', state);
	return state;
}

describe('Week 2 E2E – 4 héroes vs Boss', () => {
	it('Victoria vs Orc Brute: boss a 0, XP award, estados de héroes coherentes', () => {
		// Dados altos para héroes (6+4…), defensa alta ocasional para enemigo
		const state = runBossFight(
			'boss_orc_brute',
			seqRng([6, 4, 5, 6, 3, 5, 6, 2, 5, 6, 4]),
			seqRng([6, 2, 5, 1, 6, 3]),
		);

		expect(state.isFinished).toBe(true);
		expect(state.result).toBe('victory');
		expect(getAliveEnemies(state.enemies).length).toBe(0);
		expect(state.enemies[0].currentLife).toBe(0);

		// XP
		const xp = awardBossXp();
		expect(xp.rolls).toBe(1);
		console.log(xp.message);
		const roller = state.heroes.find((h) => !h.isDead) ?? state.heroes[0];
		const xpRoll = rollXpForHero(roller, seqRng([4]));
		console.log(xpRoll.message);
		expect(xpRoll.roll).toBeGreaterThanOrEqual(1);
		expect(xpRoll.roll).toBeLessThanOrEqual(6);

		// Ningún héroe "vivo" con life 0 sin isFallen/isDead
		for (const h of state.heroes) {
			if (h.life <= 0) {
				expect(h.isFallen || h.isDead).toBe(true);
			}
			if (h.isDead) {
				expect(h.life).toBe(0);
				console.log(`Muerto al cerrar: ${h.name}`);
			} else if (h.isFallen) {
				console.log(`Caído (debería haberse convertido en muerto): ${h.name}`);
				expect(h.isDead).toBe(true); // finalizeCombatHeroes
			} else {
				console.log(
					`Sobrevive: ${h.name} ${h.life}/${h.maxLife} [${getHeroStatus(h)}]`,
				);
			}
		}

		const alive = getAliveHeroes(state.heroes);
		expect(alive.length).toBeGreaterThan(0);
	});

	it('Derrota vs boss cuando todos los héroes caen', () => {
		// 4 wizards (3 life c/u). Boss con 4 ataques/turno → daño seguro con natural 1
		const party = [0, 1, 2, 3].map((i) => {
			const w = createDefaultParty()[3];
			return { ...w, id: `wiz_${i}`, name: `Wiz${i}` };
		});

		const boss = makeBoss('boss_chaos_lord');
		boss.attacks = 4;
		let state = createCombat(party, [boss]);

		for (let i = 0; i < 5 && !state.isFinished; i++) {
			state = { ...state, phase: 'enemyTurn' };
			state = runEnemyTurn(state, { rng: seqRng([1]) });
			printState(`Tras enemy turn ${i + 1}`, state);
		}

		expect(state.isFinished).toBe(true);
		expect(state.result).toBe('defeat');
		expect(getAliveHeroes(state.heroes).length).toBe(0);
		state.heroes.forEach((h) => {
			expect(h.isDead).toBe(true);
			expect(h.life).toBe(0);
		});
		console.log(
			'Derrota OK:',
			state.heroes.map((h) => `${h.name}:${getHeroStatus(h)}`).join(', '),
		);
	});

	it('Heridas de boss se acumulan hasta 0 life', () => {
		// Ogre: 6 life, sin mirada de apertura (Medusa petrifica y falsea el test)
		const party = createDefaultParty();
		const boss = makeBoss('boss_ogre');
		let state = createCombat(party, [boss]);

		let hits = 0;
		while (!state.isFinished && hits < 40) {
			hits++;
			if (state.phase === 'heroTurn') {
				const t = getAliveEnemies(state.enemies)[0];
				if (!t) break;
				state = selectAction(state, attack);
				state = selectTarget(state, t.id);
				// Explosive altos → varias heridas por golpe
				state = executeHeroAttack(state, 'boss', {}, seqRng([6, 5]));
			} else if (state.phase === 'enemyTurn') {
				// Defensa siempre éxito (natural 6) para no morir antes
				state = runEnemyTurn(state, { rng: seqRng([6]) });
			} else break;
		}

		expect(state.result).toBe('victory');
		expect(state.enemies[0].currentLife).toBe(0);
		console.log(
			`Ogre derrotado en ${state.round} rondas tras ${hits} acciones.`,
		);
	});
});
