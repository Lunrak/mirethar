/**
 * Test de EncounterGenerator – Mirethar / 4AD
 */

import {
	generateEncounter,
	generateRandomEncounter,
} from '../EncounterGenerator';
import type { EncounterResult } from '../EncounterGenerator';

/** Rangos esperados de cantidad por template */
const EXPECTED_RANGES: Record<
	string,
	{ min: number; max: number; level: number }
> = {
	vermin_rats: { min: 3, max: 18, level: 1 },
	vermin_vampire_bats: { min: 3, max: 18, level: 1 },
	vermin_goblin_swarmlings: { min: 2, max: 12, level: 3 },
	vermin_giant_centipedes: { min: 1, max: 6, level: 3 },
	vermin_vampire_frogs: { min: 1, max: 6, level: 4 },
	vermin_skeletal_rats: { min: 2, max: 12, level: 3 },

	minion_skeletons_zombies: { min: 1, max: 8, level: 3 },
	minion_goblins: { min: 4, max: 9, level: 3 },
	minion_hobgoblins: { min: 1, max: 6, level: 4 },
	minion_orcs: { min: 2, max: 7, level: 4 },
	minion_trolls: { min: 1, max: 3, level: 5 },
	minion_fungi_folk: { min: 2, max: 12, level: 3 },

	boss_mummy: { min: 1, max: 1, level: 5 },
	boss_orc_brute: { min: 1, max: 1, level: 5 },
	boss_ogre: { min: 1, max: 1, level: 5 },
	boss_medusa: { min: 1, max: 1, level: 4 },
	boss_chaos_lord: { min: 1, max: 1, level: 6 },
	boss_small_dragon: { min: 1, max: 1, level: 6 },
};

function validateEncounter(enc: EncounterResult): void {
	const range = EXPECTED_RANGES[enc.template.id];
	expect(range).toBeDefined();

	expect(enc.quantity).toBeGreaterThanOrEqual(range.min);
	expect(enc.quantity).toBeLessThanOrEqual(range.max);
	expect(enc.template.level).toBe(range.level);
	expect(enc.enemies).toHaveLength(enc.quantity);

	enc.enemies.forEach((e) => {
		expect(e.currentLife).toBe(enc.template.life);
		expect(e.level).toBe(enc.template.level);
		expect(e.templateId).toBe(enc.template.id);
		expect(e.name).toBe(enc.template.name);
	});
}

describe('EncounterGenerator', () => {
	it('genera 10 encuentros aleatorios válidos', () => {
		for (let i = 1; i <= 10; i++) {
			const enc = generateRandomEncounter();
			console.log(
				`${i}. [${enc.type}] #${enc.tableRoll} → ${enc.template.name} x${enc.quantity} (lvl ${enc.template.level})`,
			);
			validateEncounter(enc);
		}
	});

	it('genera un encuentro de cada tipo correctamente', () => {
		const vermin = generateEncounter('vermin');
		const minion = generateEncounter('minion');
		const boss = generateEncounter('boss');

		console.log('Vermin →', vermin.template.name, 'x' + vermin.quantity);
		console.log('Minion →', minion.template.name, 'x' + minion.quantity);
		console.log('Boss   →', boss.template.name, 'x' + boss.quantity);

		validateEncounter(vermin);
		validateEncounter(minion);
		validateEncounter(boss);

		expect(vermin.type).toBe('vermin');
		expect(minion.type).toBe('minion');
		expect(boss.type).toBe('boss');
		expect(boss.quantity).toBe(1);
	});

	it('los bosses siempre generan exactamente 1 enemigo', () => {
		for (let i = 0; i < 6; i++) {
			const enc = generateEncounter('boss');
			expect(enc.quantity).toBe(1);
			expect(enc.enemies).toHaveLength(1);
		}
	});
});
