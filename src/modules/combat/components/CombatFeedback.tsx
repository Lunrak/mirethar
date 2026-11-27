/**
 * Overlay cinematográfico de resolución (estilo captura):
 * - Oscurece el resto
 * - Arriba: "NOMBRE USES"
 * - Centro: actor (attack) + objetivo (defend/hit) con sprites
 * - Números flotantes de daño/cura
 * - Abajo: nombre de la acción
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import type { Hero, EnemyInstance } from '../../../core/types/combat';
import { HeroSprite, EnemySprite } from './UnitVisuals';

export type FeedbackKind = 'damage' | 'heal' | 'miss' | 'info' | 'critical';

export type CombatFeedbackData = {
	id: string;
	kind: FeedbackKind;
	amount: number;
	headline: string;
	detail?: string;
	actorId?: string | null;
	targetId?: string | null;
	/** Nombre del actor (para el título) */
	actorName?: string;
	/** Nombre de la acción (Attack, Fireball…) */
	actionName?: string;
};

type Props = {
	feedback: CombatFeedbackData | null;
	heroes?: Hero[];
	enemies?: EnemyInstance[];
	onDone?: () => void;
};

const SPRITE = 120;

export function CombatFeedback({
	feedback,
	heroes = [],
	enemies = [],
	onDone,
}: Props) {
	const opacity = useRef(new Animated.Value(0)).current;
	const scale = useRef(new Animated.Value(0.85)).current;
	const numY = useRef(new Animated.Value(0)).current;
	const numScale = useRef(new Animated.Value(0.5)).current;

	useEffect(() => {
		if (!feedback) {
			opacity.setValue(0);
			scale.setValue(0.85);
			numY.setValue(0);
			numScale.setValue(0.5);
			return;
		}

		opacity.setValue(0);
		scale.setValue(0.85);
		numY.setValue(12);
		numScale.setValue(0.5);

		// ~1.35 s total (coincide con RESULT_AUTO_ACK)
		const anim = Animated.sequence([
			Animated.parallel([
				Animated.timing(opacity, {
					toValue: 1,
					duration: 180,
					easing: Easing.out(Easing.cubic),
					useNativeDriver: true,
				}),
				Animated.spring(scale, {
					toValue: 1,
					friction: 7,
					tension: 100,
					useNativeDriver: true,
				}),
				Animated.parallel([
					Animated.timing(numY, {
						toValue: -28,
						duration: 700,
						easing: Easing.out(Easing.cubic),
						useNativeDriver: true,
					}),
					Animated.spring(numScale, {
						toValue: 1,
						friction: 5,
						tension: 90,
						useNativeDriver: true,
					}),
				]),
			]),
			Animated.delay(520),
			Animated.timing(opacity, {
				toValue: 0,
				duration: 280,
				easing: Easing.in(Easing.cubic),
				useNativeDriver: true,
			}),
		]);

		anim.start(({ finished }) => {
			if (finished) onDone?.();
		});
		return () => anim.stop();
	}, [feedback?.id, feedback, opacity, scale, numY, numScale, onDone]);

	if (!feedback) return null;

	const actorHero = heroes.find((h) => h.id === feedback.actorId);
	const actorEnemy = enemies.find((e) => e.id === feedback.actorId);
	const targetHero = heroes.find((h) => h.id === feedback.targetId);
	const targetEnemy = enemies.find((e) => e.id === feedback.targetId);

	const actorName =
		feedback.actorName ?? actorHero?.name ?? actorEnemy?.name ?? 'Combatiente';
	const actionName = (feedback.actionName ?? 'Attack').toUpperCase();

	const isHeal = feedback.kind === 'heal';
	const isMiss = feedback.kind === 'miss';
	const isCrit = feedback.kind === 'critical';
	const showNumber = !isMiss && feedback.amount > 0;

	// Sprites: actor en attack; objetivo en defend (o dead si amount alto y enemigo)
	const targetDead =
		!isHeal && !isMiss && targetEnemy != null && targetEnemy.currentLife <= 0;

	const actorPose = isHeal ? 'idle' : 'attack';
	const targetPose = targetDead
		? 'dead'
		: isMiss
			? 'idle'
			: isHeal
				? 'idle'
				: 'defend';

	const numColor = isHeal ? '#5dce7a' : isCrit ? '#ff6b4a' : '#e84a4a';
	const actorNumColor = isHeal ? '#5dce7a' : '#e8e6e3';

	/**
	 * El héroe siempre a la izquierda del duelo.
	 * Si el enemigo ataca → se intercambian: héroe (objetivo) izq., enemigo der.
	 * Si el héroe actúa → actor izq., objetivo der.
	 */
	const enemyAttacksHero = !!actorEnemy && !!targetHero;
	const leftHero = enemyAttacksHero ? targetHero : actorHero;
	const leftEnemy = enemyAttacksHero ? null : actorEnemy;
	const leftPose = enemyAttacksHero ? targetPose : actorPose;
	const rightHero = enemyAttacksHero ? null : targetHero;
	const rightEnemy = enemyAttacksHero ? actorEnemy : targetEnemy;
	const rightPose = enemyAttacksHero ? actorPose : targetPose;
	const rightDead = enemyAttacksHero ? false : targetDead;
	// Enemigo a la derecha mira hacia el héroe (izquierda): sin flipX; a la izq. sí flip
	const leftEnemyFlip = true;
	const rightEnemyFlip = enemyAttacksHero ? false : true;

	return (
		<View
			style={styles.root}
			pointerEvents="none"
		>
			{/* Fondo que oculta el resto del combate */}
			<Animated.View style={[styles.backdrop, { opacity }]} />

			<Animated.View
				style={[styles.stage, { opacity, transform: [{ scale }] }]}
			>
				{/* Título: NOMBRE USES */}
				<Text style={styles.usesTitle}>{actorName.toUpperCase()} USES</Text>

				{/* Centro: héroe siempre izquierda | números | otro */}
				<View style={styles.duel}>
					<View style={styles.side}>
						{leftHero ? (
							<HeroSprite
								hero={leftHero}
								pose={leftPose}
								focused
							/>
						) : leftEnemy ? (
							<EnemySprite
								enemy={leftEnemy}
								pose={leftPose}
								focused
								size={SPRITE}
								bare
								flipX={leftEnemyFlip}
							/>
						) : (
							<View style={styles.placeholder} />
						)}
						{isHeal && showNumber && (
							<Animated.Text
								style={[
									styles.floatLeft,
									{
										color: actorNumColor,
										transform: [{ translateY: numY }, { scale: numScale }],
									},
								]}
							>
								+{feedback.amount}
							</Animated.Text>
						)}
						{/* Daño sobre el héroe cuando el enemigo ataca (héroe a la izquierda) */}
						{enemyAttacksHero && !isHeal && showNumber && (
							<Animated.Text
								style={[
									styles.floatLeft,
									{
										color: numColor,
										transform: [{ translateY: numY }, { scale: numScale }],
									},
								]}
							>
								−{feedback.amount}
							</Animated.Text>
						)}
						{enemyAttacksHero && isMiss && (
							<Text style={styles.missTag}>MISS</Text>
						)}
					</View>

					<View style={styles.side}>
						{rightHero ? (
							<HeroSprite
								hero={rightHero}
								pose={rightPose}
								focused
							/>
						) : rightEnemy ? (
							<EnemySprite
								enemy={rightEnemy}
								pose={rightPose}
								focused={!rightDead}
								size={SPRITE}
								bare
								flipX={rightEnemyFlip}
							/>
						) : (
							<View style={styles.placeholder} />
						)}
						{!enemyAttacksHero && !isHeal && showNumber && (
							<Animated.Text
								style={[
									styles.floatRight,
									{
										color: numColor,
										transform: [{ translateY: numY }, { scale: numScale }],
									},
								]}
							>
								−{feedback.amount}
							</Animated.Text>
						)}
						{!enemyAttacksHero && isMiss && (
							<Text style={styles.missTag}>MISS</Text>
						)}
					</View>
				</View>

				{/* Nombre de la acción abajo */}
				<Text style={styles.actionTitle}>{actionName}</Text>
				{feedback.detail ? (
					<Text style={styles.detail}>{feedback.detail}</Text>
				) : null}
			</Animated.View>
		</View>
	);
}

const styles = StyleSheet.create({
	root: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		zIndex: 80,
		justifyContent: 'center',
		alignItems: 'center',
	},
	backdrop: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: 'rgba(4, 6, 10, 0.88)',
	},
	stage: {
		width: '100%',
		paddingHorizontal: 24,
		alignItems: 'center',
		justifyContent: 'center',
	},
	usesTitle: {
		color: '#f2efe8',
		fontSize: 28,
		fontWeight: '900',
		letterSpacing: 2,
		textAlign: 'center',
		marginBottom: 18,
		textShadowColor: 'rgba(0,0,0,0.9)',
		textShadowOffset: { width: 0, height: 2 },
		textShadowRadius: 6,
	},
	duel: {
		flexDirection: 'row',
		alignItems: 'flex-end',
		justifyContent: 'center',
		gap: 48,
		minHeight: SPRITE + 40,
		marginBottom: 16,
	},
	side: {
		width: SPRITE + 24,
		alignItems: 'center',
		justifyContent: 'flex-end',
	},
	placeholder: {
		width: SPRITE,
		height: SPRITE,
	},
	floatLeft: {
		position: 'absolute',
		top: 8,
		left: 0,
		fontSize: 36,
		fontWeight: '900',
		textShadowColor: '#000',
		textShadowOffset: { width: 0, height: 2 },
		textShadowRadius: 4,
	},
	floatRight: {
		position: 'absolute',
		top: 8,
		right: 0,
		fontSize: 40,
		fontWeight: '900',
		textShadowColor: '#000',
		textShadowOffset: { width: 0, height: 2 },
		textShadowRadius: 4,
	},
	missTag: {
		position: 'absolute',
		top: 20,
		color: '#9a9690',
		fontSize: 22,
		fontWeight: '900',
		letterSpacing: 2,
	},
	actionTitle: {
		color: '#f2efe8',
		fontSize: 26,
		fontWeight: '900',
		letterSpacing: 1.5,
		textAlign: 'center',
		textShadowColor: 'rgba(0,0,0,0.9)',
		textShadowOffset: { width: 0, height: 2 },
		textShadowRadius: 6,
	},
	detail: {
		color: '#9a9690',
		fontSize: 13,
		marginTop: 6,
		textAlign: 'center',
	},
});
