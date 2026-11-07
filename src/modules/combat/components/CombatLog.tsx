/**
 * Log de combate – colapsable, transparente
 * - Colapsado: franja con título; flash de la última entrada 3 s
 * - Expandido: historial completo (se conserva siempre)
 * - Rojo: daño a héroes / caídas
 * - Verde: daño de héroes / defensa exitosa
 */

import React, { useEffect, useRef, useState } from 'react';
import {
	View,
	Text,
	StyleSheet,
	ScrollView,
	Pressable,
	Animated,
} from 'react-native';
import type { CombatLogEntry } from '../../../core/types/combat';

type Props = {
	entries: CombatLogEntry[];
	maxVisible?: number;
};

/** Rojo = héroe sufre; verde = héroe acierta / defiende */
function lineStyle(message: string) {
	// Daño o mal a héroes
	if (
		/ha caído|muere|petrificado|FALLO \(−|pierde \d+ life|ataca a .+:.→ FALLO|Derrota/i.test(
			message,
		)
	) {
		return styles.lineBad;
	}
	// Éxito ofensivo o defensa del héroe
	if (
		/→ ÉXITO|¡CRÍTICO!|¡Victoria!|defiende:.*ÉXITO|cura a |Cura \+/i.test(
			message,
		)
	) {
		return styles.lineGood;
	}
	if (/turno de|Ronda /i.test(message)) return styles.linePhase;
	return styles.line;
}

export function CombatLog({ entries, maxVisible = 50 }: Props) {
	const [expanded, setExpanded] = useState(false);
	const [toast, setToast] = useState<string | null>(null);
	const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
	const toastOpacity = useRef(new Animated.Value(0)).current;
	const lastLen = useRef(0);
	const visible = entries.slice(-maxVisible);

	// Flash de nueva entrada cuando está colapsado
	useEffect(() => {
		if (entries.length <= lastLen.current) {
			lastLen.current = entries.length;
			return;
		}
		lastLen.current = entries.length;
		const latest = entries[entries.length - 1];
		if (!latest || expanded) return;

		setToast(latest.message);
		toastOpacity.setValue(0);
		Animated.sequence([
			Animated.timing(toastOpacity, {
				toValue: 1,
				duration: 180,
				useNativeDriver: true,
			}),
			Animated.delay(2600),
			Animated.timing(toastOpacity, {
				toValue: 0,
				duration: 320,
				useNativeDriver: true,
			}),
		]).start(({ finished }) => {
			if (finished) setToast(null);
		});
	}, [entries.length, expanded, entries, toastOpacity]);

	useEffect(() => {
		if (!expanded) return;
		const t = setTimeout(() => {
			scrollRef.current?.scrollToEnd({ animated: true });
		}, 40);
		return () => clearTimeout(t);
	}, [entries.length, expanded]);

	return (
		<View
			style={styles.root}
			pointerEvents="box-none"
		>
			{/* Franja siempre visible */}
			<Pressable
				onPress={() => setExpanded((v) => !v)}
				style={styles.strip}
				accessibilityRole="button"
				accessibilityLabel={
					expanded ? 'Cerrar log de combate' : 'Abrir log de combate'
				}
			>
				<Text style={styles.stripTitle}>Log de combate</Text>
				<Text style={styles.stripMeta}>
					{entries.length}
					{expanded ? '  ·  toca para ocultar' : '  ·  toca para ampliar'}
				</Text>
			</Pressable>

			{/* Toast de última línea (solo colapsado) */}
			{!expanded && toast ? (
				<Animated.View
					style={[styles.toast, { opacity: toastOpacity }]}
					pointerEvents="none"
				>
					<Text
						style={[lineStyle(toast), styles.toastText]}
						numberOfLines={2}
					>
						{toast}
					</Text>
				</Animated.View>
			) : null}

			{/* Panel expandido transparente */}
			{expanded && (
				<View style={styles.panel}>
					<ScrollView
						ref={scrollRef}
						style={styles.scroll}
						contentContainerStyle={styles.scrollContent}
						showsVerticalScrollIndicator
						onContentSizeChange={() =>
							scrollRef.current?.scrollToEnd({ animated: true })
						}
					>
						{visible.length === 0 ? (
							<Text style={styles.empty}>Sin entradas todavía</Text>
						) : (
							visible.map((entry, idx) => {
								const isLast = idx === visible.length - 1;
								return (
									<Text
										key={entry.id}
										style={[
											lineStyle(entry.message),
											isLast && styles.lineLatest,
										]}
									>
										{isLast ? '▸ ' : '  '}
										{entry.message}
									</Text>
								);
							})
						)}
					</ScrollView>
				</View>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	root: {
		position: 'relative',
		backgroundColor: 'transparent',
	},
	strip: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 14,
		paddingVertical: 8,
		backgroundColor: 'rgba(18,18,22,0.35)',
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: 'rgba(255,255,255,0.08)',
	},
	stripTitle: {
		color: '#c8c4be',
		fontSize: 13,
		fontWeight: '800',
		textTransform: 'uppercase',
		letterSpacing: 1.2,
	},
	stripMeta: {
		color: '#7a7670',
		fontSize: 12,
		fontWeight: '600',
	},
	toast: {
		position: 'absolute',
		left: 12,
		right: 120,
		bottom: 40,
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 8,
		backgroundColor: 'rgba(0,0,0,0.25)',
	},
	toastText: {
		fontSize: 14,
		lineHeight: 20,
		fontWeight: '700',
	},
	panel: {
		height: 120,
		paddingHorizontal: 12,
		paddingBottom: 6,
		backgroundColor: 'rgba(12,12,16,0.45)',
	},
	scroll: { flex: 1, minHeight: 0 },
	scrollContent: { paddingBottom: 8, paddingRight: 4 },
	empty: {
		color: '#5a5650',
		fontSize: 14,
		fontStyle: 'italic',
	},
	line: {
		color: '#c8c4be',
		fontSize: 14,
		lineHeight: 20,
		marginBottom: 3,
	},
	lineLatest: {
		fontWeight: '800',
		fontSize: 15,
		lineHeight: 22,
		marginTop: 2,
		marginBottom: 4,
	},
	lineGood: {
		color: '#5dce7a',
		fontSize: 14,
		lineHeight: 20,
		marginBottom: 3,
		fontWeight: '700',
	},
	lineBad: {
		color: '#e85d5d',
		fontSize: 14,
		lineHeight: 20,
		marginBottom: 3,
		fontWeight: '700',
	},
	linePhase: {
		color: '#c9a227',
		fontSize: 14,
		lineHeight: 20,
		marginBottom: 3,
		fontWeight: '700',
	},
});
