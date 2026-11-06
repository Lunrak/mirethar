/**
 * Log de combate scrollable – Día 20
 * Tipografía y contraste pensados para landscape a distancia de brazo.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { CombatLogEntry } from '../../../core/types/combat';

type Props = {
	entries: CombatLogEntry[];
	/** Cuántas entradas mostrar (las más recientes) */
	maxVisible?: number;
};

/** Colorea líneas según contenido del mensaje */
function lineStyle(message: string) {
	if (/victoria|éxito|crítico/i.test(message)) return styles.lineSuccess;
	if (/derrota|fallo|caído|muerto/i.test(message)) return styles.lineBad;
	if (/turno de los enemigos|turno de /i.test(message)) return styles.linePhase;
	if (/cura|heal|\+/i.test(message)) return styles.lineHeal;
	return styles.line;
}

export function CombatLog({ entries, maxVisible = 40 }: Props) {
	const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
	const visible = entries.slice(-maxVisible);

	useEffect(() => {
		const t = setTimeout(() => {
			scrollRef.current?.scrollToEnd({ animated: true });
		}, 40);
		return () => clearTimeout(t);
	}, [entries.length]);

	return (
		<View style={styles.root}>
			<View style={styles.headerRow}>
				<Text style={styles.title}>Log de combate</Text>
				<Text style={styles.count}>{entries.length}</Text>
			</View>
			<ScrollView
				ref={scrollRef}
				style={styles.scroll}
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator
				persistentScrollbar
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
								style={[lineStyle(entry.message), isLast && styles.lineLatest]}
							>
								{entry.message}
							</Text>
						);
					})
				)}
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
		minHeight: 0,
		backgroundColor: '#121216',
		borderTopWidth: 1,
		borderTopColor: '#2a2a32',
		paddingHorizontal: 14,
		paddingTop: 8,
		paddingBottom: 6,
	},
	headerRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 6,
	},
	title: {
		color: '#9a9690',
		fontSize: 13,
		fontWeight: '700',
		textTransform: 'uppercase',
		letterSpacing: 1.2,
	},
	count: {
		color: '#5a5650',
		fontSize: 12,
		fontWeight: '600',
	},
	scroll: {
		flex: 1,
		minHeight: 0,
	},
	scrollContent: {
		paddingBottom: 8,
		paddingRight: 4,
	},
	empty: {
		color: '#5a5650',
		fontSize: 15,
		fontStyle: 'italic',
	},
	line: {
		color: '#b8b4ae',
		fontSize: 15,
		lineHeight: 22,
		marginBottom: 4,
	},
	lineLatest: {
		color: '#e8e6e3',
		fontWeight: '700',
	},
	lineSuccess: {
		color: '#7dcea0',
		fontSize: 15,
		lineHeight: 22,
		marginBottom: 4,
		fontWeight: '600',
	},
	lineBad: {
		color: '#e07a7a',
		fontSize: 15,
		lineHeight: 22,
		marginBottom: 4,
		fontWeight: '600',
	},
	linePhase: {
		color: '#c9a227',
		fontSize: 15,
		lineHeight: 22,
		marginBottom: 4,
		fontWeight: '700',
	},
	lineHeal: {
		color: '#6ea8fe',
		fontSize: 15,
		lineHeight: 22,
		marginBottom: 4,
		fontWeight: '600',
	},
});
