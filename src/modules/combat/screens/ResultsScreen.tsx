/**
 * Pantalla de resultados – Core Loop GDD §2 paso 6
 * Experiencia, heridas, muertes, botín temporal.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import type { CombatResultsSummary } from '../../../core/rules/CombatResults';

type Props = {
	summary: CombatResultsSummary;
	onAgain: () => void;
	onNewSetup: () => void;
};

function StatusChip({ status }: { status: string }) {
	const color =
		status === 'dead'
			? '#e07a7a'
			: status === 'fallen'
				? '#e8a070'
				: status === 'wounded'
					? '#e8c547'
					: '#5dce7a';
	return (
		<Text style={[styles.chip, { color, borderColor: color }]}>
			{status.toUpperCase()}
		</Text>
	);
}

export default function ResultsScreen({ summary, onAgain, onNewSetup }: Props) {
	const victory = summary.result === 'victory';

	return (
		<View style={styles.root}>
			<View
				style={[styles.banner, victory ? styles.bannerWin : styles.bannerLose]}
			>
				<Text style={styles.bannerTitle}>
					{victory ? '¡Victoria!' : 'Derrota…'}
				</Text>
				<Text style={styles.bannerSub}>
					Combate cerrado en {summary.rounds} ronda
					{summary.rounds === 1 ? '' : 's'}
				</Text>
			</View>

			<ScrollView contentContainerStyle={styles.body}>
				<View style={styles.grid}>
					{/* Héroes */}
					<View style={styles.card}>
						<Text style={styles.cardTitle}>Héroes</Text>
						{summary.heroes.map((h) => (
							<View
								key={h.id}
								style={styles.heroRow}
							>
								<View style={{ flex: 1 }}>
									<Text style={styles.heroName}>{h.name}</Text>
									<Text style={styles.heroMeta}>
										{h.class} · {h.life}/{h.maxLife}
										{h.woundsTaken > 0 ? ` · −${h.woundsTaken} heridas` : ''}
									</Text>
								</View>
								<StatusChip status={h.status} />
							</View>
						))}
					</View>

					{/* Resumen */}
					<View style={styles.card}>
						<Text style={styles.cardTitle}>Balance</Text>
						<Text style={styles.statLine}>
							Supervivientes: {summary.survivors.length}
						</Text>
						<Text style={styles.statLine}>
							Heridos: {summary.wounded.length}
						</Text>
						<Text style={styles.statLine}>
							Muertos: {summary.newlyDead.length}
							{summary.newlyDead.length
								? ` (${summary.newlyDead.map((h) => h.name).join(', ')})`
								: ''}
						</Text>

						<Text style={[styles.cardTitle, { marginTop: 16 }]}>
							Experiencia
						</Text>
						{summary.xpAward ? (
							<>
								<Text style={styles.statLine}>{summary.xpAward.message}</Text>
								{summary.xpRoll && (
									<Text style={styles.xpRoll}>{summary.xpRoll.message}</Text>
								)}
							</>
						) : (
							<Text style={styles.muted}>
								{victory
									? 'Sin tirada de XP (vermin/minion en MVP).'
									: 'Sin XP en derrota.'}
							</Text>
						)}

						<Text style={[styles.cardTitle, { marginTop: 16 }]}>
							Botín temporal
						</Text>
						{summary.treasure ? (
							<>
								<Text style={styles.statLine}>{summary.treasure.message}</Text>
								{summary.treasure.gold > 0 && (
									<Text style={styles.lootGold}>
										{summary.treasure.gold} gp
									</Text>
								)}
								{summary.treasure.items.map((it) => (
									<Text
										key={it.id}
										style={styles.statLine}
									>
										· {it.name}
									</Text>
								))}
							</>
						) : (
							<Text style={styles.muted}>Sin botín.</Text>
						)}
					</View>

					{/* Log */}
					<View style={[styles.card, { flexBasis: '100%' }]}>
						<Text style={styles.cardTitle}>Últimas entradas del log</Text>
						{summary.logTail.map((line, i) => (
							<Text
								key={`${i}-${line.slice(0, 12)}`}
								style={styles.logLine}
							>
								{line}
							</Text>
						))}
					</View>
				</View>
			</ScrollView>

			<View style={styles.footer}>
				<Pressable
					onPress={onNewSetup}
					style={styles.btnSecondary}
				>
					<Text style={styles.btnSecondaryText}>Nueva preparación</Text>
				</Pressable>
				<Pressable
					onPress={onAgain}
					style={styles.btnPrimary}
				>
					<Text style={styles.btnPrimaryText}>
						{victory ? 'Otro encuentro' : 'Reintentar'}
					</Text>
				</Pressable>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: '#1a1a1e' },
	banner: {
		paddingVertical: 18,
		paddingHorizontal: 20,
		borderBottomWidth: 1,
		borderBottomColor: '#2a2a32',
	},
	bannerWin: { backgroundColor: '#1a2a20' },
	bannerLose: { backgroundColor: '#2a1a1a' },
	bannerTitle: {
		color: '#f0eee9',
		fontSize: 28,
		fontWeight: '900',
	},
	bannerSub: { color: '#9a9690', fontSize: 15, marginTop: 4 },
	body: { padding: 16 },
	grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
	card: {
		flexGrow: 1,
		flexBasis: '42%',
		minWidth: 260,
		backgroundColor: '#16161a',
		borderRadius: 12,
		borderWidth: 1,
		borderColor: '#2a2a32',
		padding: 14,
	},
	cardTitle: {
		color: '#9a9690',
		fontSize: 13,
		fontWeight: '700',
		textTransform: 'uppercase',
		letterSpacing: 1,
		marginBottom: 10,
	},
	heroRow: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 10,
		gap: 8,
	},
	heroName: { color: '#e8e6e3', fontSize: 16, fontWeight: '700' },
	heroMeta: { color: '#9a9690', fontSize: 13 },
	chip: {
		fontSize: 11,
		fontWeight: '800',
		borderWidth: 1,
		borderRadius: 6,
		paddingHorizontal: 8,
		paddingVertical: 3,
		overflow: 'hidden',
	},
	statLine: { color: '#c8c4be', fontSize: 15, marginBottom: 4 },
	xpRoll: { color: '#f0d78c', fontSize: 16, fontWeight: '700', marginTop: 4 },
	lootGold: {
		color: '#e8c547',
		fontSize: 20,
		fontWeight: '800',
		marginVertical: 4,
	},
	muted: { color: '#6b6760', fontSize: 14 },
	logLine: { color: '#8a8680', fontSize: 13, marginBottom: 3 },
	footer: {
		flexDirection: 'row',
		gap: 12,
		padding: 14,
		borderTopWidth: 1,
		borderTopColor: '#2a2a32',
		backgroundColor: '#121216',
	},
	btnSecondary: {
		flex: 1,
		minHeight: 52,
		borderRadius: 12,
		borderWidth: 2,
		borderColor: '#3a3a45',
		alignItems: 'center',
		justifyContent: 'center',
	},
	btnSecondaryText: { color: '#c8c4be', fontSize: 16, fontWeight: '700' },
	btnPrimary: {
		flex: 1.2,
		minHeight: 52,
		borderRadius: 12,
		backgroundColor: '#3a3420',
		borderWidth: 2,
		borderColor: '#c9a227',
		alignItems: 'center',
		justifyContent: 'center',
	},
	btnPrimaryText: { color: '#f0d78c', fontSize: 16, fontWeight: '800' },
});
