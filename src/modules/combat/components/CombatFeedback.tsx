/**
 * Feedback visual de resolución – Día 18 + pulido Día 24
 * Nunca ambiguo: headline grande, detalle legible, color por tipo.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';

export type FeedbackKind = 'damage' | 'heal' | 'miss' | 'info' | 'critical';

export type CombatFeedbackData = {
	id: string;
	kind: FeedbackKind;
	amount: number;
	headline: string;
	detail?: string;
	actorId?: string | null;
	targetId?: string | null;
};

type Props = {
	feedback: CombatFeedbackData | null;
	onDone?: () => void;
};

const KIND_LABEL: Record<FeedbackKind, string> = {
	damage: 'IMPACTO',
	heal: 'CURACIÓN',
	miss: 'FALLO',
	info: 'INFO',
	critical: 'CRÍTICO',
};

export function CombatFeedback({ feedback, onDone }: Props) {
	const opacity = useRef(new Animated.Value(0)).current;
	const rise = useRef(new Animated.Value(0)).current;
	const scale = useRef(new Animated.Value(0.7)).current;
	const flash = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		if (!feedback) {
			opacity.setValue(0);
			rise.setValue(0);
			scale.setValue(0.7);
			flash.setValue(0);
			return;
		}

		opacity.setValue(0);
		rise.setValue(0);
		scale.setValue(0.7);
		flash.setValue(0);

		// Secuencia ~1.05 s: entrada 0.15 → hold 0.55 → salida 0.35
		const anim = Animated.sequence([
			Animated.parallel([
				Animated.timing(opacity, {
					toValue: 1,
					duration: 150,
					easing: Easing.out(Easing.cubic),
					useNativeDriver: true,
				}),
				Animated.spring(scale, {
					toValue: 1,
					friction: 6,
					tension: 120,
					useNativeDriver: true,
				}),
				Animated.sequence([
					Animated.timing(flash, {
						toValue: 1,
						duration: 80,
						useNativeDriver: true,
					}),
					Animated.timing(flash, {
						toValue: 0,
						duration: 220,
						useNativeDriver: true,
					}),
				]),
				Animated.timing(rise, {
					toValue: 1,
					duration: 700,
					easing: Easing.out(Easing.cubic),
					useNativeDriver: true,
				}),
			]),
			Animated.delay(280),
			Animated.parallel([
				Animated.timing(opacity, {
					toValue: 0,
					duration: 320,
					easing: Easing.in(Easing.cubic),
					useNativeDriver: true,
				}),
				Animated.timing(scale, {
					toValue: 0.92,
					duration: 320,
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
		(feedback.kind === 'damage' || isHeal || isCrit) && feedback.amount > 0;

	const numberColor = isHeal ? '#5dce7a' : isCrit ? '#ffd666' : '#ff6b6b';
	const bannerBorder = isMiss
		? '#6b6760'
		: isHeal
			? '#3d8b5f'
			: isCrit
				? '#c9a227'
				: feedback.kind === 'damage'
					? '#a33'
					: '#4a4a55';

	const translateY = rise.interpolate({
		inputRange: [0, 1],
		outputRange: [8, -40],
	});

	const flashOpacity = flash.interpolate({
		inputRange: [0, 1],
		outputRange: [0, isMiss ? 0.2 : 0.4],
	});

	return (
		<View
			style={styles.root}
			pointerEvents="none"
		>
			<Animated.View
				style={[
					styles.flash,
					{
						opacity: flashOpacity,
						backgroundColor: isHeal
							? '#1e3a2a'
							: isMiss
								? '#2a2a2a'
								: '#4a1818',
					},
				]}
			/>

			{showNumber && (
				<Animated.View
					style={[
						styles.floatWrap,
						{ opacity, transform: [{ translateY }, { scale }] },
					]}
				>
					<Text style={[styles.floatNum, { color: numberColor }]}>
						{isHeal ? `+${feedback.amount}` : `−${feedback.amount}`}
					</Text>
					<Text style={[styles.floatSub, { color: numberColor }]}>
						{isHeal ? 'vida' : feedback.amount === 1 ? 'herida' : 'heridas'}
					</Text>
				</Animated.View>
			)}

			<Animated.View
				style={[
					styles.banner,
					{
						opacity,
						transform: [{ scale }],
						borderColor: bannerBorder,
					},
				]}
			>
				<Text style={styles.kindTag}>{KIND_LABEL[feedback.kind]}</Text>
				<Text
					style={[
						styles.headline,
						{
							color: isMiss
								? '#c0bcb6'
								: isHeal
									? '#5dce7a'
									: isCrit
										? '#ffd666'
										: '#f0eee9',
						},
					]}
				>
					{feedback.headline}
				</Text>
				{feedback.detail ? (
					<Text
						style={styles.detail}
						numberOfLines={3}
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
		top: '32%',
		alignItems: 'center',
	},
	floatNum: {
		fontSize: 48,
		fontWeight: '900',
		textShadowColor: 'rgba(0,0,0,0.9)',
		textShadowOffset: { width: 0, height: 2 },
		textShadowRadius: 8,
	},
	floatSub: {
		fontSize: 14,
		fontWeight: '700',
		marginTop: -2,
		textTransform: 'uppercase',
		letterSpacing: 1,
		opacity: 0.9,
	},
	banner: {
		marginTop: 36,
		paddingHorizontal: 20,
		paddingVertical: 12,
		borderRadius: 14,
		backgroundColor: 'rgba(12,12,16,0.92)',
		borderWidth: 2,
		maxWidth: '82%',
		alignItems: 'center',
	},
	kindTag: {
		color: '#7a7670',
		fontSize: 11,
		fontWeight: '800',
		letterSpacing: 1.5,
		marginBottom: 4,
	},
	headline: {
		fontSize: 26,
		fontWeight: '900',
		letterSpacing: 0.5,
		textAlign: 'center',
	},
	detail: {
		marginTop: 8,
		color: '#b8b4ae',
		fontSize: 14,
		lineHeight: 20,
		textAlign: 'center',
	},
});
