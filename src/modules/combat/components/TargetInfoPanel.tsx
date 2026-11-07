/**
 * Panel de información del objetivo seleccionado – Día 20
 * Tipografía grande, contraste alto, legible en landscape a distancia de brazo.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Hero, EnemyInstance, Action } from '../../../core/types/combat';
import { getHeroStatus } from '../../../core/rules/HeroStatus';
import { getEnemyMaxLife } from '../../../core/data/enemyLookup';
import {
	LifeBar,
	StatusBadges,
	HeroGearIcons,
	statusLabel,
} from './UnitVisuals';

type Props = {
	enemy?: EnemyInstance | null;
	hero?: Hero | null;
	selectedAction?: Action | null;
	targetAutoSelected?: boolean;
	canResolveNow?: boolean;
	/** Texto auxiliar cuando no hay objetivo */
	emptyHint?: string;
};

function Row({ label, value }: { label: string; value: string | number }) {
	return (
		<View style={styles.row}>
			<Text style={styles.rowLabel}>{label}</Text>
			<Text style={styles.rowValue}>{value}</Text>
		</View>
	);
}

export function TargetInfoPanel({
	enemy,
	hero,
	selectedAction,
	targetAutoSelected = false,
	canResolveNow = false,
	emptyHint,
}: Props) {
	const hasTarget = !!(enemy || hero);

	return (
		<View style={styles.root}>
			<Text style={styles.sectionLabel}>Objetivo</Text>

			{!hasTarget && (
				<Text style={styles.empty}>
					{emptyHint ??
						(selectedAction?.requiresTarget
							? 'Toca un objetivo en el campo'
							: 'Sin objetivo requerido')}
				</Text>
			)}

			{enemy && (
				<>
					<Text
						style={styles.name}
						numberOfLines={2}
					>
						{enemy.name.replace(/\s*\(.*\)$/, '')}
					</Text>
					<Text style={styles.kind}>
						Enemigo{enemy.isUndead ? ' · No-muerto' : ''}
					</Text>
					<StatusBadges enemy={enemy} />
					<View style={styles.block}>
						<Row
							label="Nivel / Def"
							value={enemy.level}
						/>
						<Row
							label="Ataques"
							value={enemy.attacks}
						/>
						<Row
							label="Life"
							value={enemy.currentLife}
						/>
					</View>
					<LifeBar
						current={enemy.currentLife <= 0 ? 0 : enemy.currentLife}
						max={getEnemyMaxLife(enemy)}
						isEnemy
					/>
					{targetAutoSelected && (
						<Text style={styles.autoHint}>Grupo homogéneo · auto</Text>
					)}
				</>
			)}

			{hero && !enemy && (
				<>
					<View style={styles.heroHeader}>
						<HeroGearIcons hero={hero} />
						<View style={{ flex: 1 }}>
							<Text
								style={styles.name}
								numberOfLines={2}
							>
								{{
									warrior: 'Guerrero',
									rogue: 'Pícaro',
									cleric: 'Clérigo',
									wizard: 'Mago',
								}[hero.class] ?? hero.class}
							</Text>
							<Text style={styles.kind}>
								{statusLabel(getHeroStatus(hero))} · Niv. {hero.level}
							</Text>
						</View>
					</View>
					<StatusBadges hero={hero} />
					<View style={styles.block}>
						<Row
							label="Nivel"
							value={hero.level}
						/>
						<Row
							label="Life"
							value={`${hero.life} / ${hero.maxLife}`}
						/>
						{hero.healingUsesLeft != null && (
							<Row
								label="Curaciones"
								value={hero.healingUsesLeft}
							/>
						)}
					</View>
					<LifeBar
						current={hero.life}
						max={hero.maxLife}
					/>
					{hero.equipment.mainHand && (
						<Text style={styles.gearLine}>
							Arma: {hero.equipment.mainHand.name}
						</Text>
					)}
					{hero.equipment.armor && (
						<Text style={styles.gearLine}>
							Armadura: {hero.equipment.armor.name}
						</Text>
					)}
					{hero.equipment.shield && (
						<Text style={styles.gearLine}>
							Escudo: {hero.equipment.shield.name}
						</Text>
					)}
				</>
			)}

			{selectedAction && (
				<View style={styles.actionBox}>
					<Text style={styles.actionLabel}>Acción</Text>
					<Text style={styles.actionName}>{selectedAction.name}</Text>
				</View>
			)}

			{canResolveNow && (
				<Text style={styles.readyHint}>Dado listo — púlsalo</Text>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	root: {
		width: '22%',
		minWidth: 160,
		maxWidth: 240,
		paddingHorizontal: 12,
		paddingVertical: 12,
		backgroundColor: '#16161a',
		borderLeftWidth: 1,
		borderLeftColor: '#2a2a32',
	},
	sectionLabel: {
		color: '#9a9690',
		fontSize: 13,
		fontWeight: '700',
		textTransform: 'uppercase',
		letterSpacing: 1.2,
		marginBottom: 10,
	},
	empty: {
		color: '#7a7670',
		fontSize: 16,
		lineHeight: 22,
	},
	name: {
		color: '#f0eee9',
		fontSize: 20,
		fontWeight: '800',
		marginBottom: 2,
	},
	kind: {
		color: '#9a9690',
		fontSize: 14,
		marginBottom: 6,
		textTransform: 'capitalize',
	},
	heroHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		marginBottom: 4,
	},
	block: {
		marginTop: 10,
		marginBottom: 6,
		gap: 6,
	},
	row: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	rowLabel: {
		color: '#7a7670',
		fontSize: 14,
		fontWeight: '600',
	},
	rowValue: {
		color: '#e8e6e3',
		fontSize: 16,
		fontWeight: '700',
	},
	autoHint: {
		marginTop: 8,
		color: '#c9a227',
		fontSize: 13,
		fontWeight: '600',
	},
	gearLine: {
		marginTop: 4,
		color: '#9a9690',
		fontSize: 13,
	},
	actionBox: {
		marginTop: 14,
		paddingTop: 10,
		borderTopWidth: 1,
		borderTopColor: '#2a2a32',
	},
	actionLabel: {
		color: '#6b6760',
		fontSize: 12,
		textTransform: 'uppercase',
		letterSpacing: 1,
		marginBottom: 2,
	},
	actionName: {
		color: '#f0d78c',
		fontSize: 18,
		fontWeight: '800',
	},
	readyHint: {
		marginTop: 14,
		color: '#5dce7a',
		fontSize: 15,
		fontWeight: '800',
	},
});
