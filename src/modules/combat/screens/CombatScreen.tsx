/**
 * Pantalla de combate – landscape, dos pulgares
 * Recibe sesión ya creada (Core Loop) o crea una por defecto.
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
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

/** Auto-ack tras feedback / zoom de unidades (~1.05s + margen) */
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

	// Zoom solo en actor + objetivo(s) vía Battlefield (impactActorId / impactTargetId).
	// Ya no se escala ni desplaza todo el campo de batalla.
	useEffect(() => {
		if (diceUi === 'result') {
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
			{/* Campo de batalla a pantalla completa */}
			<View style={styles.field}>
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
				<CombatFeedback feedback={lastFeedback} />
			</View>

			{/* Header transparente superpuesto */}
			<View
				style={styles.header}
				pointerEvents="box-none"
			>
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

			{/* Acciones izquierda, info objetivo derecha — overlays */}
			<View
				style={styles.leftRail}
				pointerEvents="box-none"
			>
				<ActionPanel
					actions={actions}
					selected={state.selectedAction}
					disabled={actionsDisabled}
					currentHero={currentHero}
					targetAutoSelected={targetAutoSelected}
					onSelect={selectHeroAction}
				/>
			</View>

			<View
				style={styles.rightRail}
				pointerEvents="box-none"
			>
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

			{/* Dado fijo esquina inferior derecha, sin fondo opaco */}
			<View
				style={styles.diceSlot}
				pointerEvents="box-none"
			>
				<CentralDice
					diceUi={diceUi}
					lastTotal={lastDiceTotal}
					disabled={state.isFinished}
					onPress={onDicePress}
				/>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: '#1a1a1e' },
	field: {
		...StyleSheet.absoluteFillObject,
		zIndex: 1,
	},
	header: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		zIndex: 30,
		height: 44,
		paddingHorizontal: 14,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		backgroundColor: 'transparent',
	},
	headerTitle: {
		color: '#e8e6e3',
		fontSize: 16,
		fontWeight: '800',
		textShadowColor: 'rgba(0,0,0,0.85)',
		textShadowOffset: { width: 0, height: 1 },
		textShadowRadius: 3,
	},
	headerMeta: {
		color: '#c8c4be',
		fontSize: 12,
		fontWeight: '600',
		marginTop: 1,
		textShadowColor: 'rgba(0,0,0,0.85)',
		textShadowOffset: { width: 0, height: 1 },
		textShadowRadius: 3,
	},
	phasePill: {
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 16,
		backgroundColor: 'rgba(26,26,30,0.35)',
		borderWidth: 1,
		borderColor: 'rgba(58,58,69,0.5)',
	},
	phasePillText: {
		color: '#f0d78c',
		fontSize: 13,
		fontWeight: '800',
	},
	leftRail: {
		position: 'absolute',
		left: 6,
		top: 48,
		bottom: 56,
		zIndex: 20,
		justifyContent: 'center',
		maxWidth: 120,
	},
	rightRail: {
		position: 'absolute',
		right: 6,
		top: 48,
		bottom: 110,
		zIndex: 20,
		maxWidth: 150,
	},
	logSlot: {
		position: 'absolute',
		left: 0,
		right: 100,
		bottom: 0,
		zIndex: 25,
	},
	diceSlot: {
		position: 'absolute',
		right: 8,
		bottom: 8,
		zIndex: 40,
	},
});
