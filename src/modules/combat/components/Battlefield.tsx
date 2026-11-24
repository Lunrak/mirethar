/**
 * Combate vertical inspirado en UI de referencia:
 * enemigos arriba, héroes abajo, anillo bajo los pies, barras de vida.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import type { Hero, EnemyInstance, Action } from '../../../core/types/combat';
import { getHeroStatus } from '../../../core/rules/HeroStatus';
import {
	getEnemyMaxLife,
	getEnemyTemplate,
} from '../../../core/data/enemyLookup';
import {
	StatusBadges,
	HeroSprite,
	EnemySprite,
	resolvePose,
} from './UnitVisuals';

type Props = {
	heroes: Hero[];
	enemies: EnemyInstance[];
	currentActorId: string | null;
	selectedTargetId: string | null;
	selectedAction: Action | null;
	phase: string;
	onSelectEnemy: (id: string) => void;
	onSelectHero: (id: string) => void;
	targetAutoSelected?: boolean;
	impactTargetId?: string | null;
	impactActorId?: string | null;
	impactKey?: string | null;
};

function inferTypeFromId(templateId: string): string {
	if (templateId.startsWith('vermin_')) return 'vermin';
	if (templateId.startsWith('minion_')) return 'minion';
	if (templateId.startsWith('boss_')) return 'boss';
	if (templateId.startsWith('weird_')) return 'weird';
	return 'enemigo';
}

/** Anillo elíptico bajo los pies (estilo captura: blanco / dorado de turno) */
function FootRing({
	activeTurn,
	selected,
	selectable,
	isHero,
}: {
	activeTurn: boolean;
	selected: boolean;
	selectable: boolean;
	isHero: boolean;
}) {
	const pulse = useRef(new Animated.Value(1)).current;

	useEffect(() => {
		if (!activeTurn) {
			pulse.setValue(1);
			return;
		}
		const loop = Animated.loop(
			Animated.sequence([
				Animated.timing(pulse, {
					toValue: 1.12,
					duration: 500,
					useNativeDriver: true,
				}),
				Animated.timing(pulse, {
					toValue: 1,
					duration: 500,
					useNativeDriver: true,
				}),
			]),
		);
		loop.start();
		return () => loop.stop();
	}, [activeTurn, pulse]);

	// Neutro: anillo blanco fino. Turno: dorado grueso. Selección: rojo/verde.
	let border = 'rgba(230, 230, 235, 0.85)';
	let borderW = 2;
	let bg = 'transparent';

	if (selectable && !selected && !activeTurn) {
		border = isHero ? 'rgba(180, 210, 255, 0.9)' : 'rgba(255, 160, 160, 0.9)';
		borderW = 2;
	}
	if (selected) {
		border = isHero ? '#7ec8ff' : '#ff5a5a';
		borderW = 3;
		bg = isHero ? 'rgba(126, 200, 255, 0.12)' : 'rgba(255, 90, 90, 0.12)';
	}
	if (activeTurn) {
		border = '#f0c94d';
		borderW = 3.5;
		bg = 'rgba(240, 201, 77, 0.18)';
	}

	return (
		<Animated.View
			style={[
				styles.footRing,
				{
					borderColor: border,
					borderWidth: borderW,
					backgroundColor: bg,
					transform: [{ scaleX: pulse }, { scaleY: pulse }],
				},
			]}
		/>
	);
}

/** Barra de vida estilo captura: fondo oscuro, relleno ámbar, números a los lados */
function CombatLifeBar({
	current,
	max,
	showNumbers = true,
}: {
	current: number;
	max: number;
	showNumbers?: boolean;
}) {
	const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
	return (
		<View style={styles.hpRow}>
			{showNumbers && <Text style={styles.hpNum}>{Math.max(0, current)}</Text>}
			<View style={styles.hpTrack}>
				<View style={[styles.hpFill, { flex: ratio }]} />
				<View style={{ flex: 1 - ratio }} />
			</View>
			{showNumbers && <Text style={styles.hpNumMax}>{max}</Text>}
		</View>
	);
}

function UnitToken({
	children,
	name,
	levelLabel,
	activeTurn,
	selected,
	selectable,
	down,
	isHero,
	onPress,
	lifeCurrent,
	lifeMax,
	showLife,
	statusSlot,
	spriteSize,
}: {
	children: React.ReactNode;
	name: string;
	levelLabel?: string;
	activeTurn: boolean;
	selected: boolean;
	selectable: boolean;
	down: boolean;
	isHero: boolean;
	onPress: () => void;
	lifeCurrent?: number;
	lifeMax?: number;
	showLife?: boolean;
	statusSlot?: React.ReactNode;
	spriteSize: number;
}) {
	return (
		<Pressable
			disabled={!selectable && !activeTurn}
			onPress={onPress}
			style={({ pressed }) => [
				styles.token,
				down && styles.tokenDown,
				pressed && selectable && styles.tokenPressed,
			]}
			accessibilityRole="button"
			accessibilityLabel={name}
		>
			{/* Badge de nivel (enemigos) */}
			{levelLabel ? (
				<View style={styles.lvBadge}>
					<Text style={styles.lvText}>{levelLabel}</Text>
				</View>
			) : null}

			<View
				style={[
					styles.spriteWrap,
					{ width: spriteSize + 8, height: spriteSize + 4 },
				]}
			>
				{children}
			</View>

			{/* Anillo bajo pies */}
			<FootRing
				activeTurn={activeTurn}
				selected={selected}
				selectable={selectable}
				isHero={isHero}
			/>

			{showLife && lifeCurrent != null && lifeMax != null && (
				<CombatLifeBar
					current={lifeCurrent}
					max={lifeMax}
				/>
			)}

			<Text
				style={styles.tokenName}
				numberOfLines={1}
			>
				{name}
			</Text>
			{statusSlot}
		</Pressable>
	);
}

export function Battlefield({
	heroes,
	enemies,
	currentActorId,
	selectedTargetId,
	selectedAction,
	phase,
	onSelectEnemy,
	onSelectHero,
	targetAutoSelected = false,
	impactTargetId = null,
	impactActorId = null,
}: Props) {
	const needsTarget = !!selectedAction?.requiresTarget;
	const targetingEnemy =
		needsTarget &&
		(selectedAction?.type === 'attack' || selectedAction?.type === 'spell');
	const targetingHero =
		needsTarget &&
		(selectedAction?.type === 'heal' ||
			selectedAction?.name === 'Protect' ||
			selectedAction?.type === 'scavenge' ||
			selectedAction?.type === 'pickup_body');
	const canTap = phase === 'heroTurn';

	const COLS = 4;
	const STACK_DX = 80;
	const STACK_DY = -80;
	const heroSprite = 128;
	const baseEnemy = 96;

	// Vivos primero, derecha → izquierda dentro de cada fila de 4
	const ordered = [...enemies];
	// Filas de 4: índices 0..3 fila 0 (frente), 4..7 detrás...
	const layers: EnemyInstance[][] = [];
	for (let i = 0; i < ordered.length; i += COLS) {
		const row = ordered.slice(i, i + COLS);
		// derecha a izquierda visual: reverse
		layers.push(row.reverse());
	}

	return (
		<View style={styles.root}>
			{/* ENEMIGOS — filas de 4, derecha→izquierda; capas atrasadas opacas + offset */}
			<View style={styles.enemyZone}>
				{layers.map((row, layerIdx) => (
					<View
						key={`layer_${layerIdx}`}
						style={[
							styles.enemyLayer,
							layerIdx > 0 && {
								position: 'absolute',
								right: layerIdx * STACK_DX,
								top: layerIdx * STACK_DY,
								opacity: Math.max(0.28, 0.7 - layerIdx * 0.18),
								zIndex: 10 - layerIdx,
							},
						]}
						pointerEvents={layerIdx === 0 ? 'auto' : 'none'}
					>
						{row.map((e) => {
							const fled = !!e.fled;
							const killed = e.currentLife <= 0 && !fled;
							const out = killed || fled;
							const selected = e.id === selectedTargetId;
							const activeTurn =
								!out &&
								phase === 'enemyTurn' &&
								(e.id === currentActorId || e.id === impactActorId);
							const selectable =
								canTap && targetingEnemy && !out && !targetAutoSelected;
							const pose = resolvePose(
								e.id,
								impactActorId,
								impactTargetId,
								killed,
							);
							const focused =
								!out && (e.id === impactTargetId || e.id === impactActorId);
							const maxLife = getEnemyMaxLife(e);
							const bossLike =
								e.templateId.startsWith('boss_') || !!e.isFinalBoss;
							const spriteSize = bossLike ? baseEnemy * 2 : baseEnemy;

							return (
								<UnitToken
									key={e.id}
									name={out ? (fled ? 'huyó' : e.name) : e.name}
									levelLabel={out ? undefined : `LV ${e.level}`}
									activeTurn={!!activeTurn}
									selected={selected && !out}
									selectable={selectable && layerIdx === 0}
									down={out}
									isHero={false}
									onPress={() => onSelectEnemy(e.id)}
									showLife={!fled}
									lifeCurrent={killed ? 0 : e.currentLife}
									lifeMax={maxLife}
									spriteSize={spriteSize}
									statusSlot={<StatusBadges enemy={e} />}
								>
									{fled ? (
										<View style={styles.fledBox}>
											<Text style={styles.fledText}>huyó</Text>
										</View>
									) : (
										<EnemySprite
											enemy={e}
											pose={pose}
											focused={!!focused}
											size={spriteSize}
											bare
											flipX
										/>
									)}
								</UnitToken>
							);
						})}
					</View>
				))}
			</View>

			{/* Espacio central (animaciones / skills a futuro) */}
			<View style={styles.mid} />

			{/* HÉROES — fila inferior */}
			<View style={styles.heroZone}>
				<View style={styles.row}>
					{heroes.map((h) => {
						const down = h.isFallen || h.isDead || h.life <= 0;
						const activeTurn = h.id === currentActorId && phase === 'heroTurn';
						const selected = h.id === selectedTargetId;
						const selectable =
							canTap &&
							targetingHero &&
							(selectedAction?.type === 'scavenge' ||
							selectedAction?.type === 'pickup_body'
								? down
								: !down);
						const pose = resolvePose(h.id, impactActorId, impactTargetId);
						const focused = h.id === impactTargetId || h.id === impactActorId;

						return (
							<UnitToken
								key={h.id}
								name={h.name}
								activeTurn={activeTurn}
								selected={selected}
								selectable={selectable}
								down={down}
								isHero
								onPress={() => onSelectHero(h.id)}
								showLife
								lifeCurrent={h.life}
								lifeMax={h.maxLife}
								spriteSize={heroSprite}
								statusSlot={<StatusBadges hero={h} />}
							>
								<HeroSprite
									hero={h}
									pose={pose}
									focused={!!focused}
									size={heroSprite}
								/>
							</UnitToken>
						);
					})}
				</View>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	/**
	 * Disposición tipo referencia 16:9:
	 * enemigos ~y 27% (banda superior), espacio central para iconos de acción,
	 * héroes ~y 78% (banda inferior).
	 */
	root: {
		flex: 1,
		paddingTop: 48,
		paddingHorizontal: 12,
		paddingBottom: 8,
		justifyContent: 'space-between',
	},
	enemyZone: {
		flex: 0.95,
		minHeight: 150,
		maxHeight: '38%',
		justifyContent: 'center',
		alignItems: 'center',
		paddingHorizontal: 24,
		paddingTop: 4,
	},
	enemyLayer: {
		flexDirection: 'row',
		flexWrap: 'nowrap',
		justifyContent: 'center',
		alignItems: 'flex-end',
		gap: 18,
	},
	mid: {
		flex: 0.55,
		minHeight: 72,
	},
	heroZone: {
		flex: 1.05,
		minHeight: 160,
		maxHeight: '42%',
		justifyContent: 'flex-end',
		alignItems: 'center',
		paddingBottom: 8,
		paddingHorizontal: 20,
	},
	row: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'center',
		alignItems: 'flex-end',
		gap: 22,
	},
	token: {
		alignItems: 'center',
		minWidth: 100,
		maxWidth: 150,
	},
	tokenDown: { opacity: 0.35 },
	tokenPressed: { opacity: 0.88, transform: [{ scale: 0.97 }] },
	lvBadge: {
		backgroundColor: 'rgba(12,12,16,0.85)',
		paddingHorizontal: 8,
		paddingVertical: 2,
		borderRadius: 6,
		marginBottom: 2,
		borderWidth: 1,
		borderColor: 'rgba(255,255,255,0.15)',
	},
	lvText: {
		color: '#f0f0f0',
		fontSize: 10,
		fontWeight: '800',
		letterSpacing: 0.5,
	},
	spriteWrap: {
		alignItems: 'center',
		justifyContent: 'flex-end',
	},
	footRing: {
		width: 72,
		height: 20,
		borderRadius: 36,
		marginTop: -2,
		marginBottom: 4,
	},
	hpRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 3,
		width: 88,
		marginBottom: 2,
	},
	hpTrack: {
		flex: 1,
		flexDirection: 'row',
		height: 7,
		borderRadius: 3,
		backgroundColor: 'rgba(20,18,16,0.9)',
		overflow: 'hidden',
		borderWidth: 1,
		borderColor: 'rgba(0,0,0,0.5)',
	},
	hpFill: {
		backgroundColor: '#e8b84a',
		borderRadius: 2,
	},
	hpNum: {
		color: '#e8e6e3',
		fontSize: 9,
		fontWeight: '800',
		minWidth: 16,
		textAlign: 'right',
	},
	hpNumMax: {
		color: '#9a9690',
		fontSize: 9,
		fontWeight: '700',
		minWidth: 16,
	},
	tokenName: {
		color: '#e8e6e3',
		fontSize: 11,
		fontWeight: '700',
		textAlign: 'center',
		maxWidth: 100,
		textShadowColor: 'rgba(0,0,0,0.8)',
		textShadowOffset: { width: 0, height: 1 },
		textShadowRadius: 2,
	},
	fledBox: {
		width: 56,
		height: 56,
		alignItems: 'center',
		justifyContent: 'center',
	},
	fledText: {
		color: '#9a9690',
		fontSize: 12,
		fontWeight: '800',
		textTransform: 'uppercase',
	},
});
