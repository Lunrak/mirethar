/**
 * Revisión Semana 1 – Mirethar
 * Ejecuta 5 combates de prueba y verifica que el estado se actualiza correctamente.
 */

import {
	createCombat,
	selectAction,
	selectTarget,
	startResolution,
	finishResolution,
	endCombat,
	canResolve,
} from '../CombatStateManager';
import { createDefaultParty } from '../../data/classes';
import {
	generateEncounter,
	generateRandomEncounter,
} from '../EncounterGenerator';
import { rollWithExplosiveSix, rollD6 } from '../DiceService';
import type { Action, CombatState } from '../../types/combat';

const attack: Action = { type: 'attack', name: 'Attack', requiresTarget: true };
const defend: Action = {
	type: 'defend',
	name: 'Defend',
	requiresTarget: false,
};

function playFullHeroRound(state: CombatState): CombatState {
	let s = state;
	const heroCount = s.heroTurnOrder.length;

	for (let i = 0; i < heroCount; i++) {
		expect(s.phase).toBe('heroTurn');
		expect(s.currentActorId).toBe(s.heroTurnOrder[i]);

		const needsTarget = i % 2 === 0; // alternamos attack / defend
		if (needsTarget && s.enemies.length > 0) {
			s = selectAction(s, attack);
			s = selectTarget(s, s.enemies[0].id);
			expect(canResolve(s)).toBe(true);
		} else {
			s = selectAction(s, defend);
			expect(canResolve(s)).toBe(true);
		}

		s = startResolution(s);
		expect(s.phase).toBe('resolution');

		s = finishResolution(s);
	}

	return s;
}

describe('Week 1 Review – 5 combates de prueba', () => {
	it('Combate 1: party por defecto vs minions – flujo completo de héroes', () => {
		const party = createDefaultParty();
		const encounter = generateEncounter('minion');
		let state = createCombat(party, encounter.enemies);

		expect(state.phase).toBe('heroTurn');
		expect(state.heroes).toHaveLength(4);
		expect(state.enemies.length).toBeGreaterThan(0);
		expect(state.round).toBe(1);

		state = playFullHeroRound(state);
		expect(state.phase).toBe('enemyTurn');
		expect(state.selectedAction).toBeNull();
	});

	it('Combate 2: vs vermin – cantidades y niveles correctos', () => {
		const party = createDefaultParty();
		const encounter = generateEncounter('vermin');
		const state = createCombat(party, encounter.enemies);

		expect(encounter.type).toBe('vermin');
		expect(encounter.quantity).toBe(encounter.enemies.length);
		expect(encounter.template.level).toBeGreaterThanOrEqual(1);
		expect(encounter.template.level).toBeLessThanOrEqual(4);
		expect(
			state.enemies.every((e) => e.level === encounter.template.level),
		).toBe(true);
		expect(
			state.enemies.every((e) => e.currentLife === encounter.template.life),
		).toBe(true);
	});

	it('Combate 3: vs boss – siempre 1 enemigo y life > 1', () => {
		const party = createDefaultParty();
		const encounter = generateEncounter('boss');
		const state = createCombat(party, encounter.enemies);

		expect(encounter.quantity).toBe(1);
		expect(state.enemies).toHaveLength(1);
		expect(state.enemies[0].currentLife).toBeGreaterThanOrEqual(4);
		expect(encounter.template.type).toBe('boss');
	});

	it('Combate 4: 5 encuentros aleatorios – estado siempre coherente', () => {
		for (let i = 0; i < 5; i++) {
			const party = createDefaultParty();
			const enc = generateRandomEncounter();
			const state = createCombat(party, enc.enemies);

			// Invisible Gremlins cierran el encuentro al instante (sin combate)
			const isGremlins = enc.template.id === 'weird_invisible_gremlins';
			if (isGremlins) {
				expect(state.isFinished).toBe(true);
				expect(state.result).toBe('victory');
				continue;
			}

			expect(state.isFinished).toBe(false);
			expect(state.phase).toBe('heroTurn');
			expect(state.currentActorId).toBe(state.heroes[0].id);
			expect(state.heroTurnOrder).toHaveLength(4);
			expect(state.enemies.length).toBe(enc.quantity);
			expect(state.log.length).toBeGreaterThan(0);
		}
	});

	it('Combate 5: victoria forzada y endCombat', () => {
		const party = createDefaultParty();
		const encounter = generateEncounter('boss');
		let state = createCombat(party, encounter.enemies);

		state = endCombat(state, 'victory');
		expect(state.phase).toBe('ended');
		expect(state.isFinished).toBe(true);
		expect(state.result).toBe('victory');
		expect(state.currentActorId).toBeNull();
	});
});

describe('Week 1 Review – sistemas base', () => {
	it('DiceService: Explosive Six funciona', () => {
		// Fuerza un 6 seguido de no-6 con rng controlado
		let calls = 0;
		const rng = () => {
			calls++;
			return calls === 1 ? 0.99 : 0.3; // 6, luego 2
		};
		const result = rollWithExplosiveSix(rng);
		expect(result.raw).toBe(6);
		expect(result.isExplosive).toBe(true);
		expect(result.total).toBeGreaterThan(6);
		expect(result.explosive.length).toBeGreaterThan(0);
	});

	it('DiceService: rollD6 siempre 1-6', () => {
		for (let i = 0; i < 20; i++) {
			const n = rollD6();
			expect(n).toBeGreaterThanOrEqual(1);
			expect(n).toBeLessThanOrEqual(6);
		}
	});

	it('Party factory: Life exactos del GDD', () => {
		const party = createDefaultParty();
		expect(party.map((h) => h.life)).toEqual([7, 4, 5, 3]);
		expect(party.map((h) => h.class)).toEqual([
			'warrior',
			'rogue',
			'cleric',
			'wizard',
		]);
	});

	it('inmutabilidad del estado en un combate completo', () => {
		const party = createDefaultParty();
		const enc = generateEncounter('minion');
		const original = createCombat(party, enc.enemies);
		const snapshot = JSON.stringify(original);

		let state = original;
		state = selectAction(state, attack);
		state = selectTarget(state, state.enemies[0].id);
		state = startResolution(state);
		state = finishResolution(state);

		expect(JSON.stringify(original)).toBe(snapshot);
		expect(state).not.toBe(original);
	});
});
