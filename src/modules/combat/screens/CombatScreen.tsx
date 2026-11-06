/**
 * Pantalla de combate – selección acción + objetivo + feedback visual (Día 18)
 * Dos pulgares: izquierda acciones, centro/derecha targets, dado abajo-derecha.
 * Zoom suave hacia actor+objetivo en cada resolución (0.8–1.2 s) y retorno.
 */

import React, { useEffect, useRef, useMemo } from 'react';
import {
	View,
	Text,
	StyleSheet,
	ScrollView,
	Animated,
	Easing,
} from 'react-native';
import { useCombatSession } from '../hooks/useCombatSession';
import { CentralDice } from '../components/CentralDice';
import { ActionPanel } from '../components/ActionPanel';
import { Battlefield } from '../components/Battlefield';
import { CombatFeedback } from '../components/CombatFeedback';
import type { Action } from '../../../core/types/combat';

const BASE_ACTIONS: Action[] = [
	{ type: 'attack', name: 'Attack', requiresTarget: true },
	{ type: 'defend', name: 'Defend', requiresTarget: false },
];

/** Duración del zoom-in / hold / zoom-out (total ~1.1 s dentro de 0.8–1.2) */
const ZOOM_IN_MS = 280;
const ZOOM_HOLD_MS = 520;
const ZOOM_OUT_MS = 320;
const RESULT_AUTO_ACK_MS = 1150;

export default function CombatScreen() {
	const session = useCombatSession('minion');
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
	const logScrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
	const currentHero = state.heroes.find((h) => h.id === state.currentActorId);
	const selectedTargetEnemy = state.enemies.find(
		(e) => e.id === state.selectedTargetId,
	);
	const selectedTargetHero = state.heroes.find(
		(h) => h.id === state.selectedTargetId,
	);

	// Cámara: scale + translate hacia actor/objetivo
	const camScale = useRef(new Animated.Value(1)).current;
	const camTx = useRef(new Animated.Value(0)).current;
	const camTy = useRef(new Animated.Value(0)).current;

	// Mantener el log siempre en la última línea
	useEffect(() => {
		const t = setTimeout(() => {
			logScrollRef.current?.scrollToEnd({ animated: true });
		}, 50);
		return () => clearTimeout(t);
	}, [state.log.length]);

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

	/** Zoom hacia el lado del objetivo (enemigos derecha / héroes izquierda) */
	const runCameraZoom = (actorId: string | null, targetId: string | null) => {
		const isEnemyTarget =
			!!targetId && state.enemies.some((e) => e.id === targetId);
		const isHeroTarget =
			!!targetId && state.heroes.some((h) => h.id === targetId);

		// Aprox. sin measure: acercar al centro-derecha si enemigo, centro-izquierda si héroe
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

	// Al entrar en resultado: zoom + auto-acknowledge
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
				<Text style={styles.headerTitle}>Combate</Text>
				<Text style={styles.headerMeta}>
					Ronda {state.round}
					{currentHero ? `  ·  ${currentHero.name}` : ''}
					{`  ·  ${state.phase}`}
					{state.isFinished ? `  ·  ${state.result?.toUpperCase()}` : ''}
				</Text>
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

				{/* Zona de cámara: zoom sobre el campo */}
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

				<View style={styles.rightPanel}>
					<Text style={styles.sectionLabel}>Objetivo</Text>
					{selectedTargetEnemy ? (
						<>
							<Text style={styles.infoName}>{selectedTargetEnemy.name}</Text>
							<Text style={styles.infoLine}>
								Level / Def: {selectedTargetEnemy.level}
							</Text>
							<Text style={styles.infoLine}>
								Life: {selectedTargetEnemy.currentLife}
							</Text>
							<Text style={styles.infoLine}>
								Attacks: {selectedTargetEnemy.attacks}
							</Text>
							{targetAutoSelected && (
								<Text style={styles.infoLine}>Grupo homogéneo (auto)</Text>
							)}
						</>
					) : selectedTargetHero ? (
						<>
							<Text style={styles.infoName}>{selectedTargetHero.name}</Text>
							<Text style={styles.infoLine}>
								Life: {selectedTargetHero.life}/{selectedTargetHero.maxLife}
							</Text>
							<Text style={styles.infoLine}>
								Clase: {selectedTargetHero.class}
							</Text>
						</>
					) : (
						<Text style={styles.infoLine}>
							{state.selectedAction?.requiresTarget
								? 'Toca un objetivo en el campo'
								: 'Sin objetivo requerido'}
						</Text>
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
				<ScrollView
					ref={logScrollRef}
					style={styles.logScroll}
					onContentSizeChange={() =>
						logScrollRef.current?.scrollToEnd({ animated: true })
					}
				>
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
	cameraClip: {
		flex: 1,
		overflow: 'hidden',
		position: 'relative',
	},
	cameraStage: {
		flex: 1,
	},
	rightPanel: {
		width: '22%',
		padding: 12,
		backgroundColor: '#16161a',
		borderLeftWidth: 1,
		borderLeftColor: '#2a2a32',
	},
	sectionLabel: {
		color: '#6b6760',
		fontSize: 11,
		textTransform: 'uppercase',
		letterSpacing: 1,
		marginBottom: 8,
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
