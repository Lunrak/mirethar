/**
 * Feedback visual de resolución – GDD Día 18
 * - Números flotantes de daño / cura
 * - Texto de resultado (ÉXITO / FALLO / cura…)
 * - Flash de impacto en el objetivo
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';

export type FeedbackKind = 'damage' | 'heal' | 'miss' | 'info' | 'critical';

export type CombatFeedbackData = {
	id: string;
	kind: FeedbackKind;
	/** Valor numérico (daño o cura). 0 en miss/info */
	amount: number;
	/** Texto corto centrado (ej. "ÉXITO", "FALLO", "+4") */
	headline: string;
	/** Mensaje completo del log (opcional, más pequeño) */
	detail?: string;
	actorId?: string | null;
	targetId?: string | null;
};

type Props = {
	feedback: CombatFeedbackData | null;
	/** Se llama cuando termina la secuencia visual (~1 s) */
	onDone?: () => void;
};

export function CombatFeedback({ feedback, onDone }: Props) {
	const opacity = useRef(new Animated.Value(0)).current;
	const rise = useRef(new Animated.Value(0)).current;
	const scale = useRef(new Animated.Value(0.6)).current;
	const flash = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		if (!feedback) {
			opacity.setValue(0);
			rise.setValue(0);
			scale.setValue(0.6);
			flash.setValue(0);
			return;
		}

		opacity.setValue(0);
		rise.setValue(0);
		scale.setValue(0.55);
		flash.setValue(0);

		const anim = Animated.sequence([
			// Entrada + impacto
			Animated.parallel([
				Animated.timing(opacity, {
					toValue: 1,
					duration: 120,
					useNativeDriver: true,
				}),
				Animated.spring(scale, {
					toValue: 1.15,
					friction: 5,
					tension: 140,
					useNativeDriver: true,
				}),
				Animated.timing(flash, {
					toValue: 1,
					duration: 90,
					useNativeDriver: true,
				}),
				Animated.timing(rise, {
					toValue: 1,
					duration: 900,
					easing: Easing.out(Easing.cubic),
					useNativeDriver: true,
				}),
			]),
			// Hold breve
			Animated.delay(180),
			// Salida
			Animated.parallel([
				Animated.timing(opacity, {
					toValue: 0,
					duration: 280,
					useNativeDriver: true,
				}),
				Animated.timing(scale, {
					toValue: 0.9,
					duration: 280,
					useNativeDriver: true,
				}),
				Animated.timing(flash, {
					toValue: 0,
					duration: 200,
					useNativeDriver: true,
				}),
			]),
		]);

		anim.start(({ finished }) => {
			if (finished) onDone?.();
		});

		return () => anim.stop();
	}, [feedback?.id, feedback, opacity, rise, scale, flash, onDone]);

	if (!feedback) return null;

	const isHeal = feedback.kind === 'heal';
	const isMiss = feedback.kind === 'miss';
	const isCrit = feedback.kind === 'critical';
	const showNumber =
		feedback.amount > 0 && (feedback.kind === 'damage' || isHeal || isCrit);

	const numberColor = isHeal ? '#5dce7a' : isCrit ? '#ffd666' : '#e85d5d';
	const headlineColor = isMiss
		? '#9a9690'
		: isHeal
			? '#5dce7a'
			: isCrit
				? '#ffd666'
				: feedback.kind === 'damage'
					? '#e8c547'
					: '#e8e6e3';

	const translateY = rise.interpolate({
		inputRange: [0, 1],
		outputRange: [12, -48],
	});

	const flashOpacity = flash.interpolate({
		inputRange: [0, 0.4, 1],
		outputRange: [0, 0.55, 0],
	});

	return (
		<View
			style={styles.root}
			pointerEvents="none"
		>
			{/* Flash de impacto a pantalla completa (suave) */}
			<Animated.View
				style={[
					styles.flash,
					{
						opacity: flashOpacity,
						backgroundColor: isHeal ? '#2a5a3a' : isMiss ? '#333' : '#6a2020',
					},
				]}
			/>

			{/* Número flotante */}
			{showNumber && (
				<Animated.View
					style={[
						styles.floatWrap,
						{
							opacity,
							transform: [{ translateY }, { scale }],
						},
					]}
				>
					<Text style={[styles.floatNum, { color: numberColor }]}>
						{isHeal ? `+${feedback.amount}` : `-${feedback.amount}`}
					</Text>
				</Animated.View>
			)}

			{/* Headline de resultado */}
			<Animated.View
				style={[
					styles.banner,
					{
						opacity,
						transform: [{ scale }],
					},
				]}
			>
				<Text style={[styles.headline, { color: headlineColor }]}>
					{feedback.headline}
				</Text>
				{feedback.detail ? (
					<Text
						style={styles.detail}
						numberOfLines={2}
					>
						{feedback.detail}
					</Text>
				) : null}
			</Animated.View>
		</View>
	);
}

const styles = StyleSheet.create({
	root: {
		...StyleSheet.absoluteFill,
		zIndex: 40,
		alignItems: 'center',
		justifyContent: 'center',
	},
	flash: {
		...StyleSheet.absoluteFill,
	},
	floatWrap: {
		position: 'absolute',
		top: '38%',
		alignItems: 'center',
	},
	floatNum: {
		fontSize: 42,
		fontWeight: '900',
		textShadowColor: 'rgba(0,0,0,0.85)',
		textShadowOffset: { width: 0, height: 2 },
		textShadowRadius: 6,
	},
	banner: {
		marginTop: 28,
		paddingHorizontal: 18,
		paddingVertical: 10,
		borderRadius: 12,
		backgroundColor: 'rgba(18,18,22,0.88)',
		borderWidth: 1,
		borderColor: '#3a3a45',
		maxWidth: '78%',
		alignItems: 'center',
	},
	headline: {
		fontSize: 22,
		fontWeight: '800',
		letterSpacing: 1,
	},
	detail: {
		marginTop: 4,
		color: '#9a9690',
		fontSize: 12,
		textAlign: 'center',
	},
});
