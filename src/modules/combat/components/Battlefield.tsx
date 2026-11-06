/**
 * Campo de batalla – selección de objetivo tocando unidades
 * Héroes (izq) / Enemigos (der). Targets ≥ 48 dp para dos pulgares.
 * Día 18: animación de impacto en actor/objetivo.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import type { Hero, EnemyInstance, Action } from '../../../core/types/combat';
import { getHeroStatus } from '../../../core/rules/HeroStatus';

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

/** Iconos temporales por clase (MVP) */
const CLASS_ICON: Record<Hero['class'], string> = {
	warrior: '⚔️',
	rogue: '🗡️',
	cleric: '✝️',
	wizard: '🔮',
};

function lifePct(cur: number, max: number) {
	return `${Math.max(0, Math.min(100, Math.round((cur / Math.max(1, max)) * 100)))}%`;
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
		scale.setValue(1);
		glow.setValue(0);
		const anim = Animated.sequence([
			Animated.parallel([
				Animated.timing(scale, {
					toValue: 1.12,
					duration: 100,
					useNativeDriver: true,
				}),
				Animated.timing(glow, {
					toValue: 1,
					duration: 100,
					useNativeDriver: true,
				}),
			]),
			Animated.parallel([
				Animated.spring(scale, {
					toValue: 1,
					friction: 4,
					tension: 120,
					useNativeDriver: true,
				}),
				Animated.timing(glow, {
					toValue: 0,
					duration: 450,
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
	children,
	style,
}: {
	activeImpact: boolean;
	impactKey?: string | null;
	children: React.ReactNode;
	style: object | object[];
}) {
	const { scale, glow } = useImpactAnim(activeImpact, impactKey);
	const borderExtra = glow.interpolate({
		inputRange: [0, 1],
		outputRange: [0, 1],
	});

	return (
		<Animated.View
			style={[
				style,
				{
					transform: [{ scale }],
					// glow vía opacity de un overlay interno no es trivial con border;
					// usamos scale + ligera elevación visual del contenedor
					opacity: borderExtra.interpolate({
						inputRange: [0, 1],
						outputRange: [1, 1],
					}),
				},
				activeImpact && { zIndex: 2 },
			]}
		>
			{children}
			{activeImpact && (
				<Animated.View
					pointerEvents="none"
					style={[
						StyleSheet.absoluteFillObject,
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
	// Solo pedir toque de enemigo si hace falta elegir (objetivos distintos)
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
						const selectable = canTap && targetingHero && !down;
						const icon = CLASS_ICON[h.class] ?? '👤';
						const hit =
							impactKey != null &&
							(h.id === impactTargetId || h.id === impactActorId);

						return (
							<UnitCardShell
								key={h.id}
								activeImpact={!!hit}
								impactKey={impactKey}
								style={[
									styles.card,
									active && styles.cardActive,
									selected && styles.cardSelectedHero,
									down && styles.cardDown,
									selectable && styles.cardSelectable,
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
									accessibilityLabel={`${h.name}, ${h.class}, ${getHeroStatus(h)}, ${h.life} de ${h.maxLife}`}
								>
									<View style={styles.nameRow}>
										<Text style={styles.icon}>{icon}</Text>
										<Text
											style={styles.name}
											numberOfLines={1}
										>
											{h.name}
										</Text>
									</View>
									<Text style={styles.meta}>
										{h.class} · {getHeroStatus(h)}
									</Text>
									<View style={styles.barTrack}>
										<View
											style={[
												styles.barHero,
												{ width: lifePct(h.life, h.maxLife) },
											]}
										/>
									</View>
									<Text style={styles.hp}>
										{h.life}/{h.maxLife}
									</Text>
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
						const dead = e.currentLife <= 0;
						const selected = e.id === selectedTargetId;
						const selectable =
							canTap && targetingEnemy && !dead && !targetAutoSelected;
						const hit =
							impactKey != null &&
							(e.id === impactTargetId || e.id === impactActorId);

						return (
							<UnitCardShell
								key={e.id}
								activeImpact={!!hit}
								impactKey={impactKey}
								style={[
									styles.card,
									styles.cardEnemy,
									selected && styles.cardSelectedEnemy,
									dead && styles.cardDown,
									selectable && styles.cardSelectableEnemy,
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
									accessibilityLabel={`${e.name}, level ${e.level}, life ${e.currentLife}`}
								>
									<Text
										style={styles.name}
										numberOfLines={1}
									>
										{e.name}
									</Text>
									<Text style={styles.meta}>L{e.level}</Text>
									<View style={styles.barTrack}>
										<View
											style={[
												styles.barEnemy,
												{
													width: dead
														? '0%'
														: lifePct(
																e.currentLife,
																Math.max(e.currentLife, 1),
															),
												},
											]}
										/>
									</View>
									<Text style={styles.hp}>{e.currentLife}</Text>
								</Pressable>
							</UnitCardShell>
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
	col: { flex: 1, maxWidth: 180 },
	colTitle: {
		color: '#6b6760',
		fontSize: 11,
		textTransform: 'uppercase',
		marginBottom: 6,
		letterSpacing: 1,
	},
	card: {
		minHeight: 56,
		marginBottom: 10,
		paddingVertical: 8,
		paddingHorizontal: 10,
		backgroundColor: '#22222a',
		borderRadius: 10,
		borderWidth: 2,
		borderColor: '#3a3a45',
		overflow: 'hidden',
	},
	cardEnemy: { backgroundColor: '#2a1e1e' },
	cardActive: { borderColor: '#c9a227' },
	cardSelectedHero: { borderColor: '#5dce7a', backgroundColor: '#1e2a22' },
	cardSelectedEnemy: { borderColor: '#e55', backgroundColor: '#3a2020' },
	cardSelectable: { borderColor: '#4a6a50' },
	cardSelectableEnemy: { borderColor: '#6a4040' },
	cardPressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
	cardDown: { opacity: 0.35 },
	nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
	icon: { fontSize: 16 },
	name: { color: '#e8e6e3', fontSize: 14, fontWeight: '700', flexShrink: 1 },
	meta: { color: '#6b6760', fontSize: 11, marginTop: 2 },
	barTrack: {
		height: 6,
		backgroundColor: '#333',
		borderRadius: 3,
		overflow: 'hidden',
		marginTop: 6,
	},
	barHero: { height: '100%', backgroundColor: '#3d8b5f' },
	barEnemy: { height: '100%', backgroundColor: '#a33' },
	hp: { color: '#6b6760', fontSize: 11, marginTop: 2 },
	vs: {
		color: '#5a5650',
		fontSize: 14,
		fontWeight: '700',
		marginHorizontal: 6,
	},
});
