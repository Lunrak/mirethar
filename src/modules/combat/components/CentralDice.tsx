/**
 * Dado Central – GDD §5.1 / §3.4
 * Estados: Idle → Listo → Girando → Resultado
 */

import React, { useEffect, useRef } from 'react';
import {
	View,
	Text,
	StyleSheet,
	Pressable,
	Animated,
	Easing,
} from 'react-native';
import type { DiceUiState } from '../hooks/useCombatSession';

type Props = {
	diceUi: DiceUiState;
	lastTotal?: number | null;
	disabled?: boolean;
	onPress: () => void;
};

const STATE_LABEL: Record<DiceUiState, string> = {
	idle: 'Idle',
	ready: 'Listo',
	spinning: 'Girando',
	result: 'Resultado',
};

export function CentralDice({ diceUi, lastTotal, disabled, onPress }: Props) {
	const spin = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		if (diceUi === 'spinning') {
			spin.setValue(0);
			Animated.loop(
				Animated.timing(spin, {
					toValue: 1,
					duration: 400,
					easing: Easing.linear,
					useNativeDriver: true,
				}),
			).start();
		} else {
			spin.stopAnimation();
			spin.setValue(0);
		}
	}, [diceUi, spin]);

	const rotate = spin.interpolate({
		inputRange: [0, 1],
		outputRange: ['0deg', '360deg'],
	});

	const canPress = !disabled && (diceUi === 'ready' || diceUi === 'result');

	const borderColor =
		diceUi === 'ready'
			? '#5dce7a'
			: diceUi === 'spinning'
				? '#e8c547'
				: diceUi === 'result'
					? '#6ea8fe'
					: '#c9a227';

	return (
		<Pressable
			onPress={canPress ? onPress : undefined}
			disabled={!canPress}
			style={({ pressed }) => [
				styles.wrap,
				pressed && canPress && styles.pressed,
			]}
			accessibilityRole="button"
			accessibilityLabel={`Dado central, estado ${STATE_LABEL[diceUi]}`}
		>
			<View style={[styles.dice, { borderColor }]}>
				<Text style={styles.label}>DADO</Text>

				{diceUi === 'spinning' ? (
					<Animated.View style={{ transform: [{ rotate }] }}>
						<View style={styles.face}>
							<Text style={styles.faceText}>?</Text>
						</View>
					</Animated.View>
				) : (
					<View style={styles.face}>
						<Text style={styles.faceText}>
							{diceUi === 'result' && lastTotal != null
								? String(lastTotal)
								: '—'}
						</Text>
					</View>
				)}

				<Text style={[styles.state, diceUi === 'ready' && styles.stateReady]}>
					{STATE_LABEL[diceUi]}
				</Text>
			</View>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	wrap: {
		position: 'absolute',
		right: 12,
		bottom: 12,
		zIndex: 30,
	},
	pressed: {
		opacity: 0.85,
		transform: [{ scale: 0.96 }],
	},
	dice: {
		width: 88,
		height: 88,
		borderRadius: 14,
		backgroundColor: '#2a2520',
		borderWidth: 2,
		alignItems: 'center',
		justifyContent: 'center',
		elevation: 8,
		shadowColor: '#000',
		shadowOpacity: 0.45,
		shadowRadius: 8,
		shadowOffset: { width: 0, height: 3 },
	},
	label: {
		position: 'absolute',
		top: 5,
		color: '#6b6760',
		fontSize: 9,
		letterSpacing: 1,
	},
	state: {
		position: 'absolute',
		bottom: 5,
		color: '#9a9690',
		fontSize: 10,
		fontWeight: '600',
	},
	stateReady: {
		color: '#5dce7a',
	},
	face: {
		width: 40,
		height: 40,
		borderRadius: 8,
		backgroundColor: '#1a1a1e',
		alignItems: 'center',
		justifyContent: 'center',
	},
	faceText: {
		color: '#e8e6e3',
		fontSize: 20,
		fontWeight: '700',
	},
});
