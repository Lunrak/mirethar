/**
 * Pantalla de combate – layout GDD §5.1 + Dado Central conectado (Día 16)
 * Idle → Listo → Girando → Resultado
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useCombatSession } from '../hooks/useCombatSession';
import { CentralDice } from '../components/CentralDice';
import { getAliveEnemies } from '../../../core/rules/TurnManager';
import { getHeroStatus } from '../../../core/rules/HeroStatus';
import type { Action } from '../../../core/types/combat';

const ACTIONS: Action[] = [
	{ type: 'attack', name: 'Attack', requiresTarget: true },
	{ type: 'defend', name: 'Defend', requiresTarget: false },
	{ type: 'heal', name: 'Heal', requiresTarget: true },
	{ type: 'spell', name: 'Fireball', requiresTarget: false },
];

export default function CombatScreen() {
	const session = useCombatSession('minion');
	const {
		state,
		diceUi,
		lastDiceTotal,
		selectHeroAction,
		selectEnemyTarget,
		resolveDice,
		acknowledgeResult,
		canResolveNow,
	} = session;

	const spinTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (diceUi === 'result') {
			spinTimeout.current = setTimeout(() => {
				acknowledgeResult();
			}, 1200);
			return () => {
				if (spinTimeout.current) clearTimeout(spinTimeout.current);
			};
		}
	}, [diceUi, acknowledgeResult]);

	const onDicePress = () => {
		if (diceUi === 'ready') {
			resolveDice();
		} else if (diceUi === 'result') {
			if (spinTimeout.current) clearTimeout(spinTimeout.current);
			acknowledgeResult();
		}
	};

	const currentHero = state.heroes.find((h) => h.id === state.currentActorId);
	const selectedTarget = state.enemies.find(
		(e) => e.id === state.selectedTargetId,
	);
	const aliveEnemies = getAliveEnemies(state.enemies);

	const lifePct = (cur: number, max: number) =>
		`${Math.max(0, Math.min(100, Math.round((cur / Math.max(1, max)) * 100)))}%`;

	return (
		<View style={styles.root}>
			<View style={styles.header}>
				<Text style={styles.headerTitle}>Combate</Text>
				<Text style={styles.headerMeta}>
					Ronda {state.round}
					{currentHero ? `  ·  Turno: ${currentHero.name}` : ''}
					{`  ·  ${state.phase}`}
					{state.isFinished ? `  ·  ${state.result?.toUpperCase()}` : ''}
				</Text>
			</View>

			<View style={styles.body}>
				<View style={styles.leftPanel}>
					<Text style={styles.sectionLabel}>Acciones</Text>
					{ACTIONS.map((action) => {
						const selected = state.selectedAction?.name === action.name;
						const disabled =
							state.phase !== 'heroTurn' ||
							state.isFinished ||
							diceUi === 'spinning';
						return (
							<Pressable
								key={action.name}
								disabled={disabled}
								onPress={() => selectHeroAction(action)}
								style={[
									styles.actionButton,
									selected && styles.actionSelected,
									disabled && styles.actionDisabled,
								]}
							>
								<Text style={styles.actionButtonText}>{action.name}</Text>
							</Pressable>
						);
					})}
				</View>

				<View style={styles.battlefield}>
					<Text style={styles.sectionLabel}>Campo de Batalla</Text>
					<View style={styles.battlefieldRow}>
						<View style={styles.unitColumn}>
							<Text style={styles.columnTitle}>Héroes</Text>
							{state.heroes.map((h) => (
								<View
									key={h.id}
									style={[
										styles.unitCard,
										h.id === state.currentActorId && styles.unitActive,
										(h.isFallen || h.isDead) && styles.unitDown,
									]}
								>
									<Text style={styles.unitName}>
										{h.name} · {getHeroStatus(h)}
									</Text>
									<View style={styles.lifeBarTrack}>
										<View
											style={[
												styles.lifeBarFill,
												{ width: lifePct(h.life, h.maxLife) },
											]}
										/>
									</View>
									<Text style={styles.lifeText}>
										{h.life}/{h.maxLife}
									</Text>
								</View>
							))}
						</View>

						<Text style={styles.vs}>VS</Text>

						<View style={styles.unitColumn}>
							<Text style={styles.columnTitle}>Enemigos</Text>
							{state.enemies.map((e) => {
								const dead = e.currentLife <= 0;
								const targeted = e.id === state.selectedTargetId;
								return (
									<Pressable
										key={e.id}
										disabled={dead || state.phase !== 'heroTurn'}
										onPress={() => selectEnemyTarget(e.id)}
										style={[
											styles.unitCard,
											styles.unitEnemy,
											targeted && styles.unitTarget,
											dead && styles.unitDown,
										]}
									>
										<Text style={styles.unitName}>{e.name}</Text>
										<View style={styles.lifeBarTrack}>
											<View
												style={[
													styles.lifeBarFillEnemy,
													{
														width: lifePct(
															Math.max(0, e.currentLife),
															Math.max(e.currentLife, 1),
														),
													},
												]}
											/>
										</View>
										<Text style={styles.lifeText}>
											{e.currentLife} · L{e.level}
										</Text>
									</Pressable>
								);
							})}
							{aliveEnemies.length === 0 && (
								<Text style={styles.columnTitle}>Sin enemigos vivos</Text>
							)}
						</View>
					</View>
				</View>

				<View style={styles.rightPanel}>
					<Text style={styles.sectionLabel}>Objetivo</Text>
					{selectedTarget ? (
						<>
							<Text style={styles.infoName}>{selectedTarget.name}</Text>
							<Text style={styles.infoLine}>
								Level / Def: {selectedTarget.level}
							</Text>
							<Text style={styles.infoLine}>
								Life: {selectedTarget.currentLife}
							</Text>
							<Text style={styles.infoLine}>
								Attacks: {selectedTarget.attacks}
							</Text>
							{selectedTarget.isUndead && (
								<Text style={styles.infoLine}>Undead</Text>
							)}
						</>
					) : (
						<Text style={styles.infoLine}>Selecciona un enemigo</Text>
					)}
					{state.selectedAction && (
						<Text style={[styles.infoLine, { marginTop: 12 }]}>
							Acción: {state.selectedAction.name}
						</Text>
					)}
					{canResolveNow && (
						<Text style={styles.readyHint}>Dado Listo — púlsalo</Text>
					)}
				</View>
			</View>

			<View style={styles.log}>
				<Text style={styles.sectionLabel}>Log</Text>
				<ScrollView style={styles.logScroll}>
					{state.log.slice(-12).map((entry) => (
						<Text
							key={entry.id}
							style={styles.logLine}
						>
							{entry.message}
						</Text>
					))}
				</ScrollView>
			</View>

			<CentralDice
				diceUi={diceUi}
				lastTotal={lastDiceTotal}
				disabled={state.isFinished}
				onPress={onDicePress}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: '#1a1a1e' },
	header: {
		height: 44,
		paddingHorizontal: 16,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		backgroundColor: '#121216',
		borderBottomWidth: 1,
		borderBottomColor: '#2a2a32',
	},
	headerTitle: { color: '#e8e6e3', fontSize: 16, fontWeight: '700' },
	headerMeta: { color: '#9a9690', fontSize: 12 },
	body: { flex: 1, flexDirection: 'row', minHeight: 0 },
	leftPanel: {
		width: '28%',
		padding: 10,
		backgroundColor: '#16161a',
		borderRightWidth: 1,
		borderRightColor: '#2a2a32',
	},
	actionButton: {
		minHeight: 48,
		marginBottom: 8,
		paddingHorizontal: 12,
		justifyContent: 'center',
		backgroundColor: '#2a2a35',
		borderRadius: 8,
		borderWidth: 1,
		borderColor: '#3d3d4a',
	},
	actionSelected: { borderColor: '#c9a227', backgroundColor: '#3a3420' },
	actionDisabled: { opacity: 0.4 },
	actionButtonText: { color: '#e8e6e3', fontSize: 15, fontWeight: '600' },
	battlefield: { flex: 1, padding: 10 },
	battlefieldRow: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-evenly',
	},
	unitColumn: { flex: 1, maxWidth: 170 },
	columnTitle: {
		color: '#6b6760',
		fontSize: 11,
		textTransform: 'uppercase',
		marginBottom: 6,
		letterSpacing: 1,
	},
	unitCard: {
		minHeight: 48,
		marginBottom: 8,
		padding: 8,
		backgroundColor: '#22222a',
		borderRadius: 8,
		borderWidth: 1,
		borderColor: '#3a3a45',
	},
	unitActive: { borderColor: '#c9a227', borderWidth: 2 },
	unitEnemy: { backgroundColor: '#2a1e1e' },
	unitTarget: { borderColor: '#c44', borderWidth: 2 },
	unitDown: { opacity: 0.35 },
	unitName: {
		color: '#e8e6e3',
		fontSize: 12,
		fontWeight: '600',
		marginBottom: 4,
	},
	lifeBarTrack: {
		height: 6,
		backgroundColor: '#333',
		borderRadius: 3,
		overflow: 'hidden',
	},
	lifeBarFill: { height: '100%', backgroundColor: '#3d8b5f' },
	lifeBarFillEnemy: { height: '100%', backgroundColor: '#a33' },
	lifeText: { color: '#6b6760', fontSize: 10, marginTop: 2 },
	vs: {
		color: '#5a5650',
		fontSize: 14,
		fontWeight: '700',
		marginHorizontal: 8,
	},
	rightPanel: {
		width: '22%',
		padding: 12,
		backgroundColor: '#16161a',
		borderLeftWidth: 1,
		borderLeftColor: '#2a2a32',
	},
	infoName: {
		color: '#e8e6e3',
		fontSize: 18,
		fontWeight: '700',
		marginBottom: 8,
	},
	infoLine: { color: '#9a9690', fontSize: 13, marginBottom: 4 },
	readyHint: {
		color: '#5dce7a',
		fontSize: 13,
		marginTop: 12,
		fontWeight: '700',
	},
	sectionLabel: {
		color: '#6b6760',
		fontSize: 11,
		textTransform: 'uppercase',
		letterSpacing: 1,
		marginBottom: 8,
	},
	log: {
		height: 80,
		paddingHorizontal: 12,
		paddingTop: 6,
		paddingRight: 110,
		backgroundColor: '#121216',
		borderTopWidth: 1,
		borderTopColor: '#2a2a32',
	},
	logScroll: { flex: 1 },
	logLine: { color: '#8a8680', fontSize: 12, marginBottom: 2 },
});
