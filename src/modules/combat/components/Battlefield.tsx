/**
 * Campo de batalla – selección de objetivo tocando unidades
 * Héroes (izq) / Enemigos (der). Targets ≥ 48 dp para dos pulgares.
 * Día 18: animación de impacto.
 * Día 19: life bar, objetivo primario, estados, silueta por equipo.
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
	HeroGearIcons,
	LifeBar,
	StatusBadges,
	PrimaryTargetMarker,
	statusLabel,
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
	/** Si true, el ataque ya tiene objetivo automático (grupo homogéneo) */
	targetAutoSelected?: boolean;
	/** Id de la unidad que recibe impacto visual */
	impactTargetId?: string | null;
	/** Id del actor que actúa (pulso suave) */
	impactActorId?: string | null;
	/** Cambia en cada resolución para reiniciar animación */
	impactKey?: string | null;
};

/** Etiqueta legible del tipo 4AD (vermin / minion / boss / weird) */
function enemyTypeLabel(type: string): string {
	switch (type) {
		case 'vermin':
			return 'Vermin';
		case 'minion':
			return 'Minion';
		case 'boss':
			return 'Boss';
		case 'weird':
			return 'Weird';
		default:
			return type || 'Enemigo';
	}
}

function inferTypeFromId(templateId: string): string {
	if (templateId.startsWith('vermin_')) return 'vermin';
	if (templateId.startsWith('minion_')) return 'minion';
	if (templateId.startsWith('boss_')) return 'boss';
	if (templateId.startsWith('weird_')) return 'weird';
	return 'enemigo';
}

function useImpactAnim(active: boolean, key: string | null | undefined) {
	const scale = useRef(new Animated.Value(1)).current;
	const glow = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		if (!active || !key) {
			scale.setValue(1);
			glow.setValue(0);
			return;
		}
		// Zoom solo en actor / objetivo(s): in → hold → out (~1 s total)
		scale.setValue(1);
		glow.setValue(0);
		const anim = Animated.sequence([
			Animated.parallel([
				Animated.timing(scale, {
					toValue: 1.22,
					duration: 220,
					useNativeDriver: true,
				}),
				Animated.timing(glow, {
					toValue: 1,
					duration: 220,
					useNativeDriver: true,
				}),
			]),
			Animated.delay(480),
			Animated.parallel([
				Animated.timing(scale, {
					toValue: 1,
					duration: 350,
					useNativeDriver: true,
				}),
				Animated.timing(glow, {
					toValue: 0,
					duration: 350,
					useNativeDriver: true,
				}),
			]),
		]);
		anim.start();
		return () => anim.stop();
	}, [active, key, scale, glow]);

	return { scale, glow };
}

function UnitCardShell({
	activeImpact,
	impactKey,
	isPrimaryTarget,
	children,
	style,
}: {
	activeImpact: boolean;
	impactKey?: string | null;
	isPrimaryTarget?: boolean;
	children: React.ReactNode;
	style: object | object[];
}) {
	const { scale, glow } = useImpactAnim(activeImpact, impactKey);

	return (
		<Animated.View
			style={[
				style,
				{
					transform: [{ scale }],
				},
				activeImpact && { zIndex: 2 },
				isPrimaryTarget && styles.cardPrimaryTarget,
			]}
		>
			<PrimaryTargetMarker visible={!!isPrimaryTarget} />
			{children}
			{activeImpact && (
				<Animated.View
					pointerEvents="none"
					style={[
						StyleSheet.absoluteFill,
						{
							borderRadius: 10,
							backgroundColor: '#fff',
							opacity: glow.interpolate({
								inputRange: [0, 1],
								outputRange: [0, 0.28],
							}),
						},
					]}
				/>
			)}
		</Animated.View>
	);
}

/** Animación de huida: desliza hacia fuera y se desvanece */
function FleeSlide({
	active,
	children,
	style,
}: {
	active: boolean;
	children: React.ReactNode;
	style?: object;
}) {
	const tx = React.useRef(new Animated.Value(0)).current;
	const op = React.useRef(new Animated.Value(1)).current;

	React.useEffect(() => {
		if (!active) {
			tx.setValue(0);
			op.setValue(1);
			return;
		}
		Animated.parallel([
			Animated.timing(tx, {
				toValue: 140,
				duration: 700,
				useNativeDriver: true,
			}),
			Animated.timing(op, {
				toValue: 0,
				duration: 700,
				useNativeDriver: true,
			}),
		]).start();
	}, [active, tx, op]);

	return (
		<Animated.View
			style={[style, { transform: [{ translateX: tx }], opacity: op }]}
		>
			{children}
		</Animated.View>
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
	impactKey = null,
}: Props) {
	const needsTarget = !!selectedAction?.requiresTarget;
	const targetingEnemy =
		needsTarget &&
		(selectedAction?.type === 'attack' || selectedAction?.type === 'spell');
	const targetingHero =
		needsTarget &&
		(selectedAction?.type === 'heal' || selectedAction?.name === 'Protect');

	const canTap = phase === 'heroTurn';
	const showEnemyPickHint =
		canTap && targetingEnemy && !targetAutoSelected && !selectedTargetId;
	const showHeroPickHint = canTap && targetingHero && !selectedTargetId;

	return (
		<View style={styles.root}>
			<Text style={styles.label}>Campo de Batalla</Text>
			{(showEnemyPickHint || showHeroPickHint) && (
				<Text style={styles.hint}>
					{showHeroPickHint
						? 'Toca un héroe objetivo'
						: 'Toca un enemigo objetivo'}
				</Text>
			)}

			<View style={styles.row}>
				{/* Héroes */}
				<View style={styles.col}>
					<Text style={styles.colTitle}>Héroes</Text>
					{heroes.map((h) => {
						const down = h.isFallen || h.isDead || h.life <= 0;
						const active = h.id === currentActorId;
						const selected = h.id === selectedTargetId;
						const isPrimary =
							selected && (targetingHero || phase === 'heroTurn');
						const selectable = canTap && targetingHero && !down;
						const hit =
							impactKey != null &&
							(h.id === impactTargetId || h.id === impactActorId);
						const st = getHeroStatus(h);
						const pose = resolvePose(h.id, impactActorId, impactTargetId);
						const focused = !!hit;

						return (
							<UnitCardShell
								key={h.id}
								activeImpact={!!hit}
								impactKey={impactKey}
								isPrimaryTarget={!!isPrimary}
								style={[
									styles.card,
									active && styles.cardActive,
									selected && styles.cardSelectedHero,
									down && styles.cardDown,
									selectable && styles.cardSelectable,
									st === 'dead' && styles.cardDead,
								]}
							>
								<Pressable
									disabled={!selectable}
									onPress={() => onSelectHero(h.id)}
									hitSlop={6}
									style={({ pressed }) => [
										pressed && selectable && styles.cardPressed,
									]}
									accessibilityRole="button"
									accessibilityLabel={`${h.name}, ${h.class}, ${statusLabel(st)}, ${h.life} de ${h.maxLife}`}
								>
									<View style={styles.heroTop}>
										<HeroSprite
											hero={h}
											pose={pose}
											focused={focused}
										/>
										<View style={styles.heroText}>
											<Text
												style={styles.name}
												numberOfLines={1}
											>
												{h.name}
											</Text>
											<Text style={styles.meta}>
												{h.class}
												{active ? ' · turno' : ''}
												{pose === 'attack'
													? ' · ataca'
													: pose === 'defend'
														? ' · defiende'
														: ''}
											</Text>
										</View>
									</View>
									<StatusBadges hero={h} />
									<LifeBar
										current={h.life}
										max={h.maxLife}
										isEnemy={false}
									/>
								</Pressable>
							</UnitCardShell>
						);
					})}
				</View>

				<Text style={styles.vs}>VS</Text>

				{/* Enemigos */}
				<View style={styles.col}>
					<Text style={styles.colTitle}>Enemigos</Text>
					{enemies.map((e) => {
						const fled = !!e.fled;
						const dead = e.currentLife <= 0 || fled;
						const selected = e.id === selectedTargetId;
						const isPrimary =
							selected && (targetingEnemy || targetAutoSelected);
						const selectable =
							canTap && targetingEnemy && !dead && !targetAutoSelected;
						const hit =
							impactKey != null &&
							(e.id === impactTargetId || e.id === impactActorId);
						const maxLife = getEnemyMaxLife(e);
						const showLifeBar = maxLife > 1;
						const pose = resolvePose(e.id, impactActorId, impactTargetId);
						const focused = !!hit;
						const template = getEnemyTemplate(e.templateId);
						const typeLabel = enemyTypeLabel(
							template?.type ?? inferTypeFromId(e.templateId),
						);
						const poseHint =
							pose === 'attack'
								? ' · ataca'
								: pose === 'defend'
									? ' · defiende'
									: '';

						return (
							<FleeSlide
								key={e.id}
								active={fled}
								style={{ width: '100%' }}
							>
								<UnitCardShell
									activeImpact={!!hit && !fled}
									impactKey={impactKey}
									isPrimaryTarget={!!isPrimary && !fled}
									style={[
										styles.card,
										styles.cardEnemy,
										selected && styles.cardSelectedEnemy,
										dead && styles.cardDown,
										selectable && styles.cardSelectableEnemy,
										fled && styles.cardFled,
									]}
								>
									<Pressable
										disabled={!selectable}
										onPress={() => onSelectEnemy(e.id)}
										hitSlop={6}
										style={({ pressed }) => [
											pressed && selectable && styles.cardPressed,
										]}
										accessibilityRole="button"
										accessibilityLabel={
											showLifeBar
												? `${e.name}, ${typeLabel}, level ${e.level}, life ${e.currentLife} de ${maxLife}`
												: `${e.name}, ${typeLabel}, level ${e.level}`
										}
									>
										<View style={styles.enemyTop}>
											<EnemySprite
												enemy={e}
												pose={pose}
												focused={focused}
											/>
											<View style={{ flex: 1 }}>
												<Text
													style={styles.name}
													numberOfLines={1}
												>
													{e.name}
												</Text>
												<Text style={styles.meta}>
													{showLifeBar
														? `L${e.level} · Atk ${e.attacks}${poseHint}`
														: `${typeLabel} · L${e.level}${poseHint}`}
												</Text>
											</View>
										</View>
										<StatusBadges enemy={e} />
										{showLifeBar && (
											<LifeBar
												current={dead ? 0 : e.currentLife}
												max={maxLife}
												isEnemy
											/>
										)}
									</Pressable>
								</UnitCardShell>
							</FleeSlide>
						);
					})}
				</View>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, padding: 10 },
	label: {
		color: '#6b6760',
		fontSize: 11,
		textTransform: 'uppercase',
		letterSpacing: 1,
		marginBottom: 4,
	},
	hint: {
		color: '#5dce7a',
		fontSize: 12,
		fontWeight: '600',
		marginBottom: 6,
	},
	row: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-evenly',
	},
	col: { flex: 1, maxWidth: 190 },
	colTitle: {
		color: '#6b6760',
		fontSize: 11,
		textTransform: 'uppercase',
		marginBottom: 6,
		letterSpacing: 1,
	},
	card: {
		minHeight: 64,
		marginBottom: 10,
		paddingVertical: 8,
		paddingHorizontal: 10,
		backgroundColor: '#22222a',
		borderRadius: 10,
		borderWidth: 2,
		borderColor: '#3a3a45',
		overflow: 'visible',
		position: 'relative',
	},
	cardEnemy: { backgroundColor: '#2a1e1e' },
	cardActive: { borderColor: '#c9a227' },
	cardSelectedHero: { borderColor: '#5dce7a', backgroundColor: '#1e2a22' },
	cardSelectedEnemy: { borderColor: '#e55', backgroundColor: '#3a2020' },
	cardPrimaryTarget: {
		borderColor: '#e55',
		shadowColor: '#e55',
		shadowOpacity: 0.45,
		shadowRadius: 6,
		shadowOffset: { width: 0, height: 0 },
		elevation: 4,
	},
	cardSelectable: { borderColor: '#4a6a50' },
	cardSelectableEnemy: { borderColor: '#6a4040' },
	cardPressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
	cardDown: { opacity: 0.4 },
	cardFled: { opacity: 0.55, borderColor: '#5a5650' },
	cardDead: { opacity: 0.3, borderColor: '#333' },
	heroTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	heroText: { flex: 1, minWidth: 0 },
	enemyTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	enemyIcon: { fontSize: 22 },
	name: { color: '#e8e6e3', fontSize: 14, fontWeight: '700' },
	meta: { color: '#6b6760', fontSize: 11, marginTop: 1 },
	vs: {
		color: '#5a5650',
		fontSize: 14,
		fontWeight: '700',
		marginHorizontal: 6,
	},
});
