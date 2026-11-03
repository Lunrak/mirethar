/**
 * Pantalla de combate – layout landscape exacto del GDD §5.1
 * Solo estructura estática (sin lógica de juego todavía).
 *
 * Zonas:
 *  - Header (superior)
 *  - Zona Izquierda ~28% (acciones)
 *  - Campo de Batalla (centro)
 *  - Panel Derecho ~22% (info)
 *  - Log de Combate (inferior)
 *  - Dado Central (esquina inferior derecha, superpuesto)
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

const PLACEHOLDER_ACTIONS = ['Attack', 'Defend', 'Heal', 'Spell', 'Flee'];
const PLACEHOLDER_HEROES = ['Bruggo', 'Lira', 'Brother Tomas', 'Elandra'];
const PLACEHOLDER_ENEMIES = ['Goblin', 'Goblin', 'Goblin', 'Goblin'];
const PLACEHOLDER_LOG = [
	'Combate iniciado',
	'Turno de Bruggo',
	'Bruggo ataca a Goblin: 5 vs 3 → ÉXITO (1 muerto)',
	'Turno de Lira',
];

export default function CombatScreen() {
	return (
		<View style={styles.root}>
			{/* ===== HEADER ===== */}
			<View style={styles.header}>
				<Text style={styles.headerTitle}>Combate</Text>
				<Text style={styles.headerMeta}>
					Ronda 1 · Turno: Bruggo · Fase: heroTurn
				</Text>
			</View>

			{/* ===== CUERPO PRINCIPAL ===== */}
			<View style={styles.body}>
				{/* Zona Izquierda – Acciones (~28%) */}
				<View style={styles.leftPanel}>
					<Text style={styles.sectionLabel}>Acciones</Text>
					{PLACEHOLDER_ACTIONS.map((action) => (
						<View
							key={action}
							style={styles.actionButton}
						>
							<Text style={styles.actionButtonText}>{action}</Text>
						</View>
					))}
				</View>

				{/* Campo de Batalla – Centro */}
				<View style={styles.battlefield}>
					<Text style={styles.sectionLabel}>Campo de Batalla</Text>
					<View style={styles.battlefieldRow}>
						{/* Héroes (izquierda, orden de marcha vertical) */}
						<View style={styles.unitColumn}>
							<Text style={styles.columnTitle}>Héroes</Text>
							{PLACEHOLDER_HEROES.map((name, i) => (
								<View
									key={name}
									style={[styles.unitCard, i === 0 && styles.unitActive]}
								>
									<Text style={styles.unitName}>{name}</Text>
									<View style={styles.lifeBarTrack}>
										<View
											style={[
												styles.lifeBarFill,
												{ width: `${[100, 75, 100, 60][i]}%` },
											]}
										/>
									</View>
								</View>
							))}
						</View>

						<Text style={styles.vs}>VS</Text>

						{/* Enemigos (derecha) */}
						<View style={styles.unitColumn}>
							<Text style={styles.columnTitle}>Enemigos</Text>
							{PLACEHOLDER_ENEMIES.map((name, i) => (
								<View
									key={`${name}-${i}`}
									style={[
										styles.unitCard,
										styles.unitEnemy,
										i === 0 && styles.unitTarget,
									]}
								>
									<Text style={styles.unitName}>{name}</Text>
									<View style={styles.lifeBarTrack}>
										<View
											style={[styles.lifeBarFillEnemy, { width: '100%' }]}
										/>
									</View>
								</View>
							))}
						</View>
					</View>
				</View>

				{/* Panel Derecho – Info (~22%) */}
				<View style={styles.rightPanel}>
					<Text style={styles.sectionLabel}>Objetivo</Text>
					<Text style={styles.infoName}>Goblin</Text>
					<Text style={styles.infoLine}>Tipo: minion</Text>
					<Text style={styles.infoLine}>Level / Defense: 3</Text>
					<Text style={styles.infoLine}>Life: 1</Text>
					<Text style={styles.infoLine}>Attacks: 1</Text>
					<Text style={[styles.infoLine, styles.infoRules]}>
						Special: 1 in 6 surprise · Dwarves +1
					</Text>
				</View>
			</View>

			{/* ===== LOG DE COMBATE ===== */}
			<View style={styles.log}>
				<Text style={styles.sectionLabel}>Log</Text>
				<ScrollView
					style={styles.logScroll}
					horizontal={false}
				>
					{PLACEHOLDER_LOG.map((line, i) => (
						<Text
							key={i}
							style={styles.logLine}
						>
							{line}
						</Text>
					))}
				</ScrollView>
			</View>

			{/* ===== DADO CENTRAL (esquina inferior derecha) ===== */}
			<View
				style={styles.diceContainer}
				pointerEvents="box-none"
			>
				<View style={styles.dice}>
					<Text style={styles.diceLabel}>DADO</Text>
					<Text style={styles.diceState}>Idle</Text>
					<View style={styles.diceFace}>
						<Text style={styles.diceFaceText}>—</Text>
					</View>
				</View>
			</View>
		</View>
	);
}

const HEADER_H = 44;
const LOG_H = 72;

const styles = StyleSheet.create({
	root: {
		flex: 1,
		backgroundColor: '#1a1a1e',
		// Landscape: el contenedor padre debe forzar orientation
	},

	// --- Header ---
	header: {
		height: HEADER_H,
		paddingHorizontal: 16,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		backgroundColor: '#121216',
		borderBottomWidth: 1,
		borderBottomColor: '#2a2a32',
	},
	headerTitle: {
		color: '#e8e6e3',
		fontSize: 16,
		fontWeight: '700',
	},
	headerMeta: {
		color: '#9a9690',
		fontSize: 13,
	},

	// --- Body (3 columnas) ---
	body: {
		flex: 1,
		flexDirection: 'row',
		minHeight: 0,
	},

	// Izquierda ~28%
	leftPanel: {
		width: '28%',
		padding: 10,
		backgroundColor: '#16161a',
		borderRightWidth: 1,
		borderRightColor: '#2a2a32',
	},
	actionButton: {
		minHeight: 48,
		marginBottom: 8,
		paddingHorizontal: 12,
		justifyContent: 'center',
		backgroundColor: '#2a2a35',
		borderRadius: 8,
		borderWidth: 1,
		borderColor: '#3d3d4a',
	},
	actionButtonText: {
		color: '#e8e6e3',
		fontSize: 15,
		fontWeight: '600',
	},

	// Centro
	battlefield: {
		flex: 1,
		padding: 10,
		backgroundColor: '#1a1a1e',
	},
	battlefieldRow: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-evenly',
	},
	unitColumn: {
		flex: 1,
		maxWidth: 160,
	},
	columnTitle: {
		color: '#6b6760',
		fontSize: 11,
		textTransform: 'uppercase',
		marginBottom: 6,
		letterSpacing: 1,
	},
	unitCard: {
		minHeight: 48,
		marginBottom: 8,
		padding: 8,
		backgroundColor: '#22222a',
		borderRadius: 8,
		borderWidth: 1,
		borderColor: '#3a3a45',
	},
	unitActive: {
		borderColor: '#c9a227',
		borderWidth: 2,
	},
	unitEnemy: {
		backgroundColor: '#2a1e1e',
	},
	unitTarget: {
		borderColor: '#c44',
		borderWidth: 2,
	},
	unitName: {
		color: '#e8e6e3',
		fontSize: 13,
		fontWeight: '600',
		marginBottom: 4,
	},
	lifeBarTrack: {
		height: 6,
		backgroundColor: '#333',
		borderRadius: 3,
		overflow: 'hidden',
	},
	lifeBarFill: {
		height: '100%',
		backgroundColor: '#3d8b5f',
	},
	lifeBarFillEnemy: {
		height: '100%',
		backgroundColor: '#a33',
	},
	vs: {
		color: '#5a5650',
		fontSize: 14,
		fontWeight: '700',
		marginHorizontal: 8,
	},

	// Derecha ~22%
	rightPanel: {
		width: '22%',
		padding: 12,
		backgroundColor: '#16161a',
		borderLeftWidth: 1,
		borderLeftColor: '#2a2a32',
	},
	infoName: {
		color: '#e8e6e3',
		fontSize: 18,
		fontWeight: '700',
		marginBottom: 8,
	},
	infoLine: {
		color: '#9a9690',
		fontSize: 13,
		marginBottom: 4,
	},
	infoRules: {
		marginTop: 8,
		fontStyle: 'italic',
	},

	sectionLabel: {
		color: '#6b6760',
		fontSize: 11,
		textTransform: 'uppercase',
		letterSpacing: 1,
		marginBottom: 8,
	},

	// --- Log ---
	log: {
		height: LOG_H,
		paddingHorizontal: 12,
		paddingTop: 6,
		backgroundColor: '#121216',
		borderTopWidth: 1,
		borderTopColor: '#2a2a32',
		// Deja hueco a la derecha para el dado
		paddingRight: 100,
	},
	logScroll: {
		flex: 1,
	},
	logLine: {
		color: '#8a8680',
		fontSize: 12,
		marginBottom: 2,
	},

	// --- Dado Central (esquina inferior derecha) ---
	diceContainer: {
		position: 'absolute',
		right: 12,
		bottom: 12,
		zIndex: 20,
	},
	dice: {
		width: 80,
		height: 80,
		borderRadius: 12,
		backgroundColor: '#2a2520',
		borderWidth: 2,
		borderColor: '#c9a227',
		alignItems: 'center',
		justifyContent: 'center',
		// Sombra táctil
		elevation: 6,
		shadowColor: '#000',
		shadowOpacity: 0.4,
		shadowRadius: 6,
		shadowOffset: { width: 0, height: 2 },
	},
	diceLabel: {
		position: 'absolute',
		top: 4,
		color: '#6b6760',
		fontSize: 9,
		letterSpacing: 1,
	},
	diceState: {
		position: 'absolute',
		bottom: 4,
		color: '#9a9690',
		fontSize: 10,
	},
	diceFace: {
		width: 36,
		height: 36,
		borderRadius: 6,
		backgroundColor: '#1a1a1e',
		alignItems: 'center',
		justifyContent: 'center',
	},
	diceFaceText: {
		color: '#e8e6e3',
		fontSize: 18,
		fontWeight: '700',
	},
});
