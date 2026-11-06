/**
 * Dado Central – GDD §5.1 / pulido Día 24
 * Estados claros: Idle → Listo (pulso) → Girando → Resultado
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
	idle: 'Espera',
	ready: '¡Tira!',
	spinning: 'Girando…',
	result: 'Resultado',
};

const STATE_HINT: Record<DiceUiState, string> = {
	idle: 'Elige acción',
	ready: 'Pulsa el dado',
	spinning: 'Resolviendo',
	result: 'Pulsa o espera',
};

export function CentralDice({ diceUi, lastTotal, disabled, onPress }: Props) {
	const spin = useRef(new Animated.Value(0)).current;
	const pulse = useRef(new Animated.Value(1)).current;

	useEffect(() => {
		if (diceUi === 'spinning') {
			spin.setValue(0);
			Animated.loop(
				Animated.timing(spin, {
					toValue: 1,
					duration: 360,
					easing: Easing.linear,
					useNativeDriver: true,
				}),
			).start();
		} else {
			spin.stopAnimation();
			spin.setValue(0);
		}
	}, [diceUi, spin]);

	useEffect(() => {
		if (diceUi === 'ready') {
			const loop = Animated.loop(
				Animated.sequence([
					Animated.timing(pulse, {
						toValue: 1.08,
						duration: 480,
						easing: Easing.inOut(Easing.sin),
						useNativeDriver: true,
					}),
					Animated.timing(pulse, {
						toValue: 1,
						duration: 480,
						easing: Easing.inOut(Easing.sin),
						useNativeDriver: true,
					}),
				]),
			);
			loop.start();
			return () => loop.stop();
		}
		pulse.setValue(1);
	}, [diceUi, pulse]);

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
					: '#5a5650';

	const faceValue =
		diceUi === 'result' && lastTotal != null
			? String(lastTotal)
			: diceUi === 'spinning'
				? '?'
				: diceUi === 'ready'
					? 'd6'
					: '—';

	return (
		<Pressable
			onPress={canPress ? onPress : undefined}
			disabled={!canPress}
			style={({ pressed }) => [
				styles.wrap,
				pressed && canPress && styles.pressed,
			]}
			accessibilityRole="button"
			accessibilityLabel={`Dado central, ${STATE_LABEL[diceUi]}. ${STATE_HINT[diceUi]}`}
			accessibilityHint={STATE_HINT[diceUi]}
		>
			<Animated.View
				style={[
					styles.dice,
					{ borderColor },
					diceUi === 'ready' && { transform: [{ scale: pulse }] },
				]}
			>
				<Text style={styles.label}>DADO</Text>

				{diceUi === 'spinning' ? (
					<Animated.View style={{ transform: [{ rotate }] }}>
						<View style={styles.face}>
							<Text style={styles.faceText}>?</Text>
						</View>
					</Animated.View>
				) : (
					<View
						style={[
							styles.face,
							diceUi === 'result' && styles.faceResult,
							diceUi === 'ready' && styles.faceReady,
						]}
					>
						<Text
							style={[
								styles.faceText,
								diceUi === 'result' && styles.faceTextResult,
								diceUi === 'ready' && styles.faceTextReady,
							]}
						>
							{faceValue}
						</Text>
					</View>
				)}

				<Text
					style={[
						styles.state,
						diceUi === 'ready' && styles.stateReady,
						diceUi === 'result' && styles.stateResult,
						diceUi === 'spinning' && styles.stateSpin,
					]}
				>
					{STATE_LABEL[diceUi]}
				</Text>
			</Animated.View>
			<Text style={styles.hint}>{STATE_HINT[diceUi]}</Text>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	wrap: {
		position: 'absolute',
		right: 12,
		bottom: 12,
		zIndex: 30,
		alignItems: 'center',
	},
	pressed: {
		opacity: 0.88,
	},
	dice: {
		width: 96,
		height: 96,
		borderRadius: 16,
		backgroundColor: '#2a2520',
		borderWidth: 3,
		alignItems: 'center',
		justifyContent: 'center',
		elevation: 10,
		shadowColor: '#000',
		shadowOpacity: 0.5,
		shadowRadius: 10,
		shadowOffset: { width: 0, height: 4 },
	},
	label: {
		position: 'absolute',
		top: 6,
		color: '#6b6760',
		fontSize: 10,
		fontWeight: '700',
		letterSpacing: 1.2,
	},
	state: {
		position: 'absolute',
		bottom: 6,
		color: '#9a9690',
		fontSize: 11,
		fontWeight: '700',
	},
	stateReady: { color: '#5dce7a' },
	stateResult: { color: '#6ea8fe' },
	stateSpin: { color: '#e8c547' },
	face: {
		width: 44,
		height: 44,
		borderRadius: 10,
		backgroundColor: '#1a1a1e',
		alignItems: 'center',
		justifyContent: 'center',
	},
	faceReady: {
		backgroundColor: '#1e2a22',
		borderWidth: 1,
		borderColor: '#3d8b5f',
	},
	faceResult: {
		backgroundColor: '#1a2230',
		borderWidth: 1,
		borderColor: '#3a5a8a',
	},
	faceText: {
		color: '#e8e6e3',
		fontSize: 20,
		fontWeight: '800',
	},
	faceTextReady: { color: '#5dce7a', fontSize: 18 },
	faceTextResult: { color: '#8ec0ff', fontSize: 22 },
	hint: {
		marginTop: 4,
		color: '#7a7670',
		fontSize: 11,
		fontWeight: '600',
	},
});
