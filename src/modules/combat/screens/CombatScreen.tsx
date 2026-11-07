/**
 * Pantalla de combate – landscape, dos pulgares
 * Recibe sesión ya creada (Core Loop) o crea una por defecto.
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import {
	useCombatSession,
	type CombatSession,
	type CombatSessionConfig,
} from '../hooks/useCombatSession';
import { CentralDice } from '../components/CentralDice';
import { ActionPanel } from '../components/ActionPanel';
import { Battlefield } from '../components/Battlefield';
import { CombatFeedback } from '../components/CombatFeedback';
import { CombatLog } from '../components/CombatLog';
import { TargetInfoPanel } from '../components/TargetInfoPanel';
import type { Action } from '../../../core/types/combat';

const BASE_ACTIONS: Action[] = [
	// La defensa es automática al ser atacado (4AD); no es acción de turno
	{ type: 'attack', name: 'Attack', requiresTarget: true },
];

/** Zoom total ~1.05 s alineado con CombatFeedback */
const ZOOM_IN_MS = 220;
const ZOOM_HOLD_MS = 480;
const ZOOM_OUT_MS = 350;
/** Auto-ack tras feedback completo (feedback ~1.05s + margen) */
const RESULT_AUTO_ACK_MS = 1300;

type Props = {
	/** Config para crear sesión interna, o sesión ya levantada desde el flow */
	config?: CombatSessionConfig;
	session?: CombatSession;
	/** Cuando el combate termina (victoria/derrota) */
	onCombatEnd?: (session: CombatSession) => void;
};

export default function CombatScreen({
	config,
	session: externalSession,
	onCombatEnd,
}: Props) {
	const internal = useCombatSession(config ?? 'minion');
	const session = externalSession ?? internal;

	const {
		state,
		diceUi,
		lastDiceTotal,
		targetAutoSelected,
		lastFeedback,
		focusActorId,
		focusTargetId,
		selectHeroAction,
		selectEnemyTarget,
		resolveDice,
		acknowledgeResult,
		canResolveNow,
	} = session;

	const spinTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
	const endedRef = useRef(false);
	const currentHero = state.heroes.find((h) => h.id === state.currentActorId);
	const selectedTargetEnemy = state.enemies.find(
		(e) => e.id === state.selectedTargetId,
	);
	const selectedTargetHero = state.heroes.find(
		(h) => h.id === state.selectedTargetId,
	);

	const camScale = useRef(new Animated.Value(1)).current;
	const camTx = useRef(new Animated.Value(0)).current;
	const camTy = useRef(new Animated.Value(0)).current;

	const actions = useMemo(() => {
		const list = [...BASE_ACTIONS];
		if (currentHero?.class === 'cleric') {
			list.push({ type: 'heal', name: 'Heal', requiresTarget: true });
		}
		if (currentHero?.class === 'wizard') {
			list.push({ type: 'spell', name: 'Fireball', requiresTarget: false });
			list.push({
				type: 'spell',
				name: 'Lightning Bolt',
				requiresTarget: true,
			});
		}
		return list;
	}, [currentHero?.class]);

	const runCameraZoom = (actorId: string | null, targetId: string | null) => {
		const isEnemyTarget =
			!!targetId && state.enemies.some((e) => e.id === targetId);
		const isHeroTarget =
			!!targetId && state.heroes.some((h) => h.id === targetId);

		let toTx = 0;
		let toTy = -8;
		let toScale = 1.18;

		if (isEnemyTarget) {
			toTx = -28;
			toScale = 1.22;
		} else if (isHeroTarget) {
			toTx = 28;
			toScale = 1.2;
		} else if (actorId) {
			toTx = 18;
			toScale = 1.12;
		}

		camScale.setValue(1);
		camTx.setValue(0);
		camTy.setValue(0);

		Animated.sequence([
			Animated.parallel([
				Animated.timing(camScale, {
					toValue: toScale,
					duration: ZOOM_IN_MS,
					easing: Easing.out(Easing.cubic),
					useNativeDriver: true,
				}),
				Animated.timing(camTx, {
					toValue: toTx,
					duration: ZOOM_IN_MS,
					easing: Easing.out(Easing.cubic),
					useNativeDriver: true,
				}),
				Animated.timing(camTy, {
					toValue: toTy,
					duration: ZOOM_IN_MS,
					easing: Easing.out(Easing.cubic),
					useNativeDriver: true,
				}),
			]),
			Animated.delay(ZOOM_HOLD_MS),
			Animated.parallel([
				Animated.timing(camScale, {
					toValue: 1,
					duration: ZOOM_OUT_MS,
					easing: Easing.inOut(Easing.cubic),
					useNativeDriver: true,
				}),
				Animated.timing(camTx, {
					toValue: 0,
					duration: ZOOM_OUT_MS,
					easing: Easing.inOut(Easing.cubic),
					useNativeDriver: true,
				}),
				Animated.timing(camTy, {
					toValue: 0,
					duration: ZOOM_OUT_MS,
					easing: Easing.inOut(Easing.cubic),
					useNativeDriver: true,
				}),
			]),
		]).start();
	};

	useEffect(() => {
		if (diceUi === 'result') {
			runCameraZoom(focusActorId, focusTargetId);
			spinTimeout.current = setTimeout(
				() => acknowledgeResult(),
				RESULT_AUTO_ACK_MS,
			);
			return () => {
				if (spinTimeout.current) clearTimeout(spinTimeout.current);
			};
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [diceUi, focusActorId, focusTargetId]);

	// Notificar fin de combate al flow
	useEffect(() => {
		if (state.isFinished && !endedRef.current) {
			endedRef.current = true;
			onCombatEnd?.(session);
		}
	}, [state.isFinished, onCombatEnd, session]);

	const onDicePress = () => {
		if (diceUi === 'ready') resolveDice();
		else if (diceUi === 'result') {
			if (spinTimeout.current) clearTimeout(spinTimeout.current);
			acknowledgeResult();
		}
	};

	const onSelectHeroTarget = (id: string) => {
		selectEnemyTarget(id);
	};

	const actionsDisabled =
		state.phase !== 'heroTurn' || state.isFinished || diceUi === 'spinning';

	return (
		<View style={styles.root}>
			<View style={styles.header}>
				<View>
					<Text style={styles.headerTitle}>Combate</Text>
					<Text style={styles.headerMeta}>
						Ronda {state.round}
						{state.isFinished
							? `  ·  ${state.result === 'victory' ? '¡Victoria!' : 'Derrota'}`
							: ''}
					</Text>
				</View>
				<View style={styles.phasePill}>
					<Text style={styles.phasePillText}>
						{state.isFinished
							? state.result === 'victory'
								? 'FIN · Victoria'
								: 'FIN · Derrota'
							: diceUi === 'spinning'
								? 'Resolviendo…'
								: diceUi === 'result'
									? 'Resultado'
									: state.phase === 'enemyTurn'
										? 'Turno enemigo'
										: currentHero
											? `Turno: ${currentHero.name}`
											: 'Combate'}
					</Text>
				</View>
			</View>

			<View style={styles.body}>
				<ActionPanel
					actions={actions}
					selected={state.selectedAction}
					disabled={actionsDisabled}
					currentHero={currentHero}
					targetAutoSelected={targetAutoSelected}
					onSelect={selectHeroAction}
				/>

				<View style={styles.cameraClip}>
					<Animated.View
						style={[
							styles.cameraStage,
							{
								transform: [
									{ translateX: camTx },
									{ translateY: camTy },
									{ scale: camScale },
								],
							},
						]}
					>
						<Battlefield
							heroes={state.heroes}
							enemies={state.enemies}
							currentActorId={state.currentActorId}
							selectedTargetId={state.selectedTargetId}
							selectedAction={state.selectedAction}
							phase={state.phase}
							targetAutoSelected={targetAutoSelected}
							impactTargetId={focusTargetId}
							impactActorId={focusActorId}
							impactKey={lastFeedback?.id ?? null}
							onSelectEnemy={selectEnemyTarget}
							onSelectHero={onSelectHeroTarget}
						/>
					</Animated.View>

					<CombatFeedback feedback={lastFeedback} />
				</View>

				<TargetInfoPanel
					enemy={selectedTargetEnemy}
					hero={selectedTargetHero}
					selectedAction={state.selectedAction}
					targetAutoSelected={targetAutoSelected}
					canResolveNow={canResolveNow}
				/>
			</View>

			<View
				style={styles.logSlot}
				pointerEvents="box-none"
			>
				<CombatLog entries={state.log} />
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
		height: 48,
		paddingHorizontal: 16,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		backgroundColor: '#121216',
		borderBottomWidth: 1,
		borderBottomColor: '#2a2a32',
	},
	headerTitle: { color: '#e8e6e3', fontSize: 18, fontWeight: '800' },
	headerMeta: {
		color: '#b8b4ae',
		fontSize: 13,
		fontWeight: '600',
		marginTop: 2,
	},
	phasePill: {
		paddingHorizontal: 14,
		paddingVertical: 8,
		borderRadius: 20,
		backgroundColor: '#2a2a35',
		borderWidth: 1,
		borderColor: '#3a3a45',
	},
	phasePillText: {
		color: '#f0d78c',
		fontSize: 14,
		fontWeight: '800',
	},
	body: { flex: 1, flexDirection: 'row', minHeight: 0 },
	cameraClip: { flex: 1, overflow: 'hidden', position: 'relative' },
	cameraStage: { flex: 1 },
	logSlot: {
		position: 'absolute',
		left: 0,
		right: 0,
		bottom: 0,
		paddingRight: 110,
		zIndex: 25,
	},
});
