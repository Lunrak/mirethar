/**
 * Escenario móvil por defecto en HORIZONTAL (20:9).
 * En pantallas más grandes se amplía manteniendo la proporción;
 * el resto del viewport se rellena de negro y el contenido queda centrado.
 */

import React, { useCallback, useState } from 'react';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';

/** Ancho : Alto del área de juego (móvil apaisado 20:9). */
export const MOBILE_ASPECT_WIDTH = 20;
export const MOBILE_ASPECT_HEIGHT = 9;

type Props = {
	children: React.ReactNode;
};

type Size = { width: number; height: number };

function fitMobileStage(parentW: number, parentH: number): Size {
	if (parentW <= 0 || parentH <= 0) {
		return { width: 0, height: 0 };
	}
	const target = MOBILE_ASPECT_WIDTH / MOBILE_ASPECT_HEIGHT; // 20/9
	const parent = parentW / parentH;
	if (parent > target) {
		// Más ancha que 20:9 → limitar por alto (bandas a los lados)
		const height = parentH;
		const width = height * target;
		return { width, height };
	}
	// Más alta → limitar por ancho (bandas arriba/abajo)
	const width = parentW;
	const height = width / target;
	return { width, height };
}

export function MobileStage({ children }: Props) {
	const [stage, setStage] = useState<Size>({ width: 0, height: 0 });

	const onLayout = useCallback((e: LayoutChangeEvent) => {
		const { width, height } = e.nativeEvent.layout;
		setStage(fitMobileStage(width, height));
	}, []);

	return (
		<View
			style={styles.letterbox}
			onLayout={onLayout}
		>
			<View
				style={[
					styles.stage,
					stage.width > 0 && stage.height > 0
						? { width: stage.width, height: stage.height }
						: styles.stageFallback,
				]}
			>
				{children}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	letterbox: {
		flex: 1,
		width: '100%',
		height: '100%',
		backgroundColor: '#000000',
		alignItems: 'center',
		justifyContent: 'center',
	},
	stage: {
		overflow: 'hidden',
		backgroundColor: '#000000',
	},
	stageFallback: {
		flex: 1,
		width: '100%',
		maxWidth: '100%',
		maxHeight: '100%',
	},
});
