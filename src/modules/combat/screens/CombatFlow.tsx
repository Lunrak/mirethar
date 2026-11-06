/**
 * Core Loop del MVP (GDD §2) – solo combate
 *
 * 1. Setup: 4 héroes + tipo de encuentro + disposición frente/retaguardia
 * 2. Generación de encuentro
 * 3. Combate completo (acciones, objetivos, dado, feedback)
 * 4. Resultados: XP, heridas, muertes, botín temporal
 */

import React, { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import SetupScreen, { type SetupResult } from './SetupScreen';
import CombatScreen from './CombatScreen';
import ResultsScreen from './ResultsScreen';
import {
	generateEncounter,
	type EncounterResult,
} from '../../../core/rules/EncounterGenerator';
import {
	buildCombatResults,
	type CombatResultsSummary,
} from '../../../core/rules/CombatResults';
import type {
	CombatSession,
	CombatSessionConfig,
} from '../hooks/useCombatSession';

type Phase = 'setup' | 'combat' | 'results';

export default function CombatFlow() {
	const [phase, setPhase] = useState<Phase>('setup');
	const [sessionConfig, setSessionConfig] =
		useState<CombatSessionConfig | null>(null);
	const [encounter, setEncounter] = useState<EncounterResult | null>(null);
	const [results, setResults] = useState<CombatResultsSummary | null>(null);
	const [combatKey, setCombatKey] = useState(0);

	const onSetupStart = useCallback((setup: SetupResult) => {
		const enc = generateEncounter(setup.encounterType);
		setEncounter(enc);
		setSessionConfig({
			heroes: setup.heroes,
			enemies: enc.enemies,
			positions: setup.positions,
			encounterType: setup.encounterType,
			encounter: enc,
		});
		setResults(null);
		setCombatKey((k) => k + 1);
		setPhase('combat');
	}, []);

	const onCombatEnd = useCallback(
		(session: CombatSession) => {
			const summary = buildCombatResults(session.state, {
				encounterTemplate:
					encounter?.template ?? session.encounter?.template ?? null,
			});
			setResults(summary);
			setPhase('results');
		},
		[encounter],
	);

	const backToSetup = useCallback(() => {
		setPhase('setup');
		setSessionConfig(null);
		setEncounter(null);
		setResults(null);
	}, []);

	if (phase === 'setup') {
		return (
			<View style={styles.root}>
				<SetupScreen onStart={onSetupStart} />
			</View>
		);
	}

	if (phase === 'combat' && sessionConfig) {
		return (
			<View style={styles.root}>
				<CombatScreen
					key={combatKey}
					config={sessionConfig}
					onCombatEnd={onCombatEnd}
				/>
			</View>
		);
	}

	if (phase === 'results' && results) {
		return (
			<View style={styles.root}>
				<ResultsScreen
					summary={results}
					onAgain={backToSetup}
					onNewSetup={backToSetup}
				/>
			</View>
		);
	}

	// Fallback seguro (no debería alcanzarse)
	return (
		<View style={styles.root}>
			<SetupScreen onStart={onSetupStart} />
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: '#1a1a1e' },
});
