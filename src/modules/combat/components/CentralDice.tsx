/**
 * Dado central con caras PNG 1–6
 * ready → pulso; al pulsar → giro rápido entre caras → se detiene en el resultado
 */

import React, { useEffect, useRef, useState } from 'react';
import {
	View,
	Text,
	StyleSheet,
	Pressable,
	Animated,
	Easing,
	Image,
} from 'react-native';
import type { DiceUiState } from '../hooks/useCombatSession';
import { DICE_FACES, DICE_UNKNOWN, toDiceFace } from '../diceAssets';

type Props = {
	diceUi: DiceUiState;
	/** Total o cara cruda; se normaliza a 1–6 para la imagen */
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

const FACE_MS = 70;

export function CentralDice({ diceUi, lastTotal, disabled, onPress }: Props) {
	const spin = useRef(new Animated.Value(0)).current;
	const pulse = useRef(new Animated.Value(1)).current;
	const [displayFace, setDisplayFace] = useState<number | null>(null);
	const faceTimer = useRef<ReturnType<typeof setInterval> | null>(null);

	const resultFace = toDiceFace(lastTotal);

	useEffect(() => {
		if (faceTimer.current) {
			clearInterval(faceTimer.current);
			faceTimer.current = null;
		}

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

			let f = 1;
			setDisplayFace(1);
			faceTimer.current = setInterval(() => {
				f = f >= 6 ? 1 : f + 1;
				setDisplayFace(f);
			}, FACE_MS);

			return () => {
				if (faceTimer.current) clearInterval(faceTimer.current);
				faceTimer.current = null;
				spin.stopAnimation();
			};
		}

		spin.stopAnimation();
		spin.setValue(0);

		if (diceUi === 'result' && resultFace != null) {
			setDisplayFace(resultFace);
		} else if (diceUi === 'ready' || diceUi === 'idle') {
			setDisplayFace(null);
		}
	}, [diceUi, resultFace, spin]);

	useEffect(() => {
		if (diceUi === 'ready') {
			const loop = Animated.loop(
				Animated.sequence([
					Animated.timing(pulse, {
						toValue: 1.1,
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

	const faceSource =
		displayFace != null && displayFace >= 1 && displayFace <= 6
			? DICE_FACES[displayFace]
			: DICE_UNKNOWN;

	return (
		<Pressable
			onPress={onPress}
			disabled={!canPress}
			style={({ pressed }) => [
				styles.root,
				{ borderColor },
				pressed && canPress && styles.pressed,
				!canPress && styles.disabled,
			]}
			accessibilityRole="button"
			accessibilityLabel={`Dado ${STATE_LABEL[diceUi]}`}
		>
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

			<Animated.View
				style={[
					styles.dieWrap,
					{
						transform: [
							{ scale: diceUi === 'ready' ? pulse : 1 },
							{ rotate: diceUi === 'spinning' ? rotate : '0deg' },
						],
					},
				]}
			>
				<Image
					source={faceSource}
					style={styles.dieImage}
					resizeMode="contain"
					accessibilityLabel={
						displayFace != null ? `Dado ${displayFace}` : 'Dado'
					}
				/>
			</Animated.View>

			{diceUi === 'result' && resultFace != null && (
				<Text style={styles.resultNum}>{resultFace}</Text>
			)}
			<Text style={styles.hint}>{STATE_HINT[diceUi]}</Text>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	root: {
		width: 100,
		paddingVertical: 8,
		paddingHorizontal: 6,
		borderRadius: 14,
		borderWidth: 2,
		backgroundColor: '#16161c',
		alignItems: 'center',
	},
	pressed: { opacity: 0.88, transform: [{ scale: 0.96 }] },
	disabled: { opacity: 0.55 },
	state: {
		color: '#7a7670',
		fontSize: 11,
		fontWeight: '800',
		textTransform: 'uppercase',
		letterSpacing: 0.6,
		marginBottom: 4,
	},
	stateReady: { color: '#5dce7a' },
	stateResult: { color: '#6ea8fe' },
	stateSpin: { color: '#e8c547' },
	dieWrap: {
		width: 72,
		height: 72,
		alignItems: 'center',
		justifyContent: 'center',
	},
	dieImage: {
		width: 72,
		height: 72,
	},
	resultNum: {
		marginTop: 2,
		color: '#8ec0ff',
		fontSize: 16,
		fontWeight: '800',
	},
	hint: {
		marginTop: 4,
		color: '#7a7670',
		fontSize: 11,
		fontWeight: '600',
		textAlign: 'center',
	},
});
