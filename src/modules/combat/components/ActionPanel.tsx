/**
 * Barra de acciones estilo SkillBar (referencia de combate):
 * iconos centrados en la franja media del escenario.
 * Cada acción es un icono con marco, no un botón de texto.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { Action, Hero } from '../../../core/types/combat';

type Props = {
	actions: Action[];
	selected: Action | null;
	disabled?: boolean;
	currentHero?: Hero | null;
	targetAutoSelected?: boolean;
	onSelect: (action: Action) => void;
	/** 'icons' = franja central (default); 'stack' legacy columna */
	layout?: 'icons' | 'stack' | 'bar' | 'rail';
};

/** Glifo por tipo de acción (sin assets externos). */
function iconFor(action: Action): { glyph: string; accent: string } {
	const n = action.name.toLowerCase();
	if (action.type === 'attack' || n === 'attack') {
		return { glyph: '⚔', accent: '#A72E35' };
	}
	if (action.type === 'heal' || n.includes('heal')) {
		return { glyph: '✚', accent: '#557B36' };
	}
	if (n.includes('fireball') || n.includes('lightning')) {
		return { glyph: '✦', accent: '#C78316' };
	}
	if (action.type === 'spell') {
		return { glyph: '✧', accent: '#C78316' };
	}
	if (action.type === 'scavenge') {
		return { glyph: '👜', accent: '#7a8aaa' };
	}
	if (action.type === 'pickup_body') {
		return { glyph: '†', accent: '#8a7a6a' };
	}
	if (action.type === 'switch_weapon' || n.includes('cambiar arma')) {
		return { glyph: '🗡', accent: '#8a6a3a' };
	}
	if (n.includes('defend') || n.includes('protect') || n.includes('focus')) {
		return { glyph: '🛡', accent: '#557B36' };
	}
	return { glyph: '●', accent: '#C78316' };
}

export function ActionPanel({
	actions,
	selected,
	disabled,
	currentHero,
	targetAutoSelected = false,
	onSelect,
	layout = 'icons',
}: Props) {
	if (layout === 'stack' || layout === 'rail' || layout === 'bar') {
		// Compatibilidad mínima con layout antiguo de texto
		return (
			<View style={styles.legacyCol}>
				{currentHero ? (
					<Text
						style={styles.actorLabel}
						numberOfLines={1}
					>
						{currentHero.name}
					</Text>
				) : null}
				{actions.map((action) => {
					const isSelected =
						selected?.name === action.name && selected?.type === action.type;
					const { glyph, accent } = iconFor(action);
					return (
						<Pressable
							key={`${action.type}-${action.name}`}
							disabled={disabled}
							onPress={() => onSelect(action)}
							style={[
								styles.legacyBtn,
								{ borderColor: accent },
								isSelected && styles.selected,
								disabled && styles.disabled,
							]}
						>
							<Text style={styles.legacyGlyph}>{glyph}</Text>
							<Text style={styles.legacyName}>{action.name}</Text>
						</Pressable>
					);
				})}
			</View>
		);
	}

	// Franja central tipo SkillBar (referencia)
	return (
		<View
			style={styles.row}
			pointerEvents="box-none"
		>
			{actions.map((action) => {
				const isSelected =
					selected?.name === action.name && selected?.type === action.type;
				const { glyph, accent } = iconFor(action);
				const needsTarget =
					action.requiresTarget &&
					!(
						isSelected &&
						targetAutoSelected &&
						(action.type === 'attack' || action.type === 'spell')
					);

				return (
					<Pressable
						key={`${action.type}-${action.name}`}
						disabled={disabled}
						onPress={() => onSelect(action)}
						style={[
							styles.skill,
							isSelected && styles.selected,
							disabled && styles.disabled,
						]}
						accessibilityRole="button"
						accessibilityLabel={action.name}
					>
						<View style={[styles.iconFace, { backgroundColor: accent }]}>
							<Text style={styles.glyph}>{glyph}</Text>
						</View>
						{/* Coste / etiqueta corta esquina */}
						<Text
							style={styles.cost}
							numberOfLines={1}
						>
							{action.name.length > 8
								? action.name.slice(0, 7) + '…'
								: action.name}
						</Text>
						{needsTarget ? <View style={styles.targetDot} /> : null}
					</Pressable>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 10,
		flexWrap: 'wrap',
	},
	skill: {
		width: 64,
		height: 64,
		borderWidth: 4,
		borderColor: '#F0ECE5',
		backgroundColor: '#171717',
		padding: 3,
		elevation: 5,
		shadowColor: '#000',
		shadowOpacity: 0.45,
		shadowRadius: 4,
		shadowOffset: { width: 0, height: 2 },
	},
	iconFace: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1,
		borderColor: '#1A1512',
	},
	glyph: {
		fontSize: 26,
		color: '#FFF4E8',
		textShadowColor: '#000',
		textShadowRadius: 3,
		textShadowOffset: { width: 0, height: 1 },
	},
	cost: {
		position: 'absolute',
		bottom: 2,
		left: 2,
		right: 2,
		color: '#E8E4DF',
		fontSize: 8,
		fontWeight: '800',
		textAlign: 'center',
		textShadowColor: '#000',
		textShadowRadius: 3,
	},
	targetDot: {
		position: 'absolute',
		top: 4,
		right: 4,
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: '#4D83FF',
		borderWidth: 1,
		borderColor: '#FFF',
	},
	selected: {
		borderColor: '#F4B52B',
		borderWidth: 5,
		transform: [{ scale: 1.08 }],
	},
	disabled: { opacity: 0.35 },

	legacyCol: { gap: 8, minWidth: 100 },
	actorLabel: {
		color: '#c9a227',
		fontSize: 11,
		fontWeight: '800',
		textAlign: 'center',
	},
	legacyBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		paddingVertical: 8,
		paddingHorizontal: 10,
		borderWidth: 2,
		borderRadius: 6,
		backgroundColor: 'rgba(20,18,16,0.85)',
	},
	legacyGlyph: { fontSize: 18 },
	legacyName: {
		color: '#e8e6e3',
		fontSize: 12,
		fontWeight: '800',
	},
});
