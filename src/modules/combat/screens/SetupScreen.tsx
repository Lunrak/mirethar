/**
 * Setup del Core Loop – GDD §2
 * 1. Party por defecto (4 clases)
 * 2. Tipo de encuentro
 * 3. Disposición frente / retaguardia
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { createDefaultParty } from '../../../core/data/classes';
import type { Hero } from '../../../core/types/combat';
import type { EncounterType } from '../../../core/rules/EncounterGenerator';
import { HeroGearIcons } from '../components/UnitVisuals';

export type SetupResult = {
	heroes: Hero[];
	encounterType: EncounterType;
	positions: { front: string[]; rear: string[] };
};

type Props = {
	onStart: (setup: SetupResult) => void;
};

const ENCOUNTER_OPTS: { id: EncounterType; label: string; hint: string }[] = [
	{ id: 'vermin', label: 'Vermin', hint: 'Enjambre débil, sin XP' },
	{ id: 'minion', label: 'Minions', hint: 'Grupo típico de sala' },
	{ id: 'boss', label: 'Boss', hint: 'Jefe · 1 tirada XP' },
];

export default function SetupScreen({ onStart }: Props) {
	const [heroes] = useState<Hero[]>(() => createDefaultParty());
	const [encounterType, setEncounterType] = useState<EncounterType>('minion');
	/** Orden de marcha: índice 0–1 frente, 2–3 retaguardia por defecto */
	const [order, setOrder] = useState<string[]>(() => heroes.map((h) => h.id));

	const front = order.slice(0, 2);
	const rear = order.slice(2, 4);

	const byId = useMemo(() => {
		const m = new Map(heroes.map((h) => [h.id, h]));
		return m;
	}, [heroes]);

	const move = (id: string, dir: -1 | 1) => {
		setOrder((prev) => {
			const i = prev.indexOf(id);
			const j = i + dir;
			if (i < 0 || j < 0 || j >= prev.length) return prev;
			const next = [...prev];
			[next[i], next[j]] = [next[j], next[i]];
			return next;
		});
	};

	const start = () => {
		onStart({
			heroes,
			encounterType,
			positions: { front: [...front], rear: [...rear] },
		});
	};

	const renderSlot = (
		id: string,
		zone: 'front' | 'rear',
		indexInZone: number,
	) => {
		const h = byId.get(id);
		if (!h) return null;
		const globalIndex = order.indexOf(id);
		return (
			<View
				key={id}
				style={styles.heroCard}
			>
				<View style={styles.heroMain}>
					<HeroGearIcons hero={h} />
					<View style={{ flex: 1 }}>
						<Text style={styles.heroName}>{h.name}</Text>
						<Text style={styles.heroMeta}>
							{h.class} · L{h.level} · {h.life}/{h.maxLife}
						</Text>
						<Text style={styles.zoneTag}>
							{zone === 'front' ? 'Frente' : 'Retaguardia'} · #{indexInZone + 1}
						</Text>
					</View>
				</View>
				<View style={styles.moveRow}>
					<Pressable
						onPress={() => move(id, -1)}
						disabled={globalIndex <= 0}
						style={[styles.moveBtn, globalIndex <= 0 && styles.moveBtnOff]}
					>
						<Text style={styles.moveBtnText}>▲</Text>
					</Pressable>
					<Pressable
						onPress={() => move(id, 1)}
						disabled={globalIndex >= order.length - 1}
						style={[
							styles.moveBtn,
							globalIndex >= order.length - 1 && styles.moveBtnOff,
						]}
					>
						<Text style={styles.moveBtnText}>▼</Text>
					</Pressable>
				</View>
			</View>
		);
	};

	return (
		<View style={styles.root}>
			<View style={styles.header}>
				<Text style={styles.title}>Preparar encuentro</Text>
				<Text style={styles.sub}>Core Loop · GDD §2</Text>
			</View>

			<ScrollView
				contentContainerStyle={styles.body}
				horizontal={false}
			>
				<View style={styles.row}>
					{/* Encuentro */}
					<View style={styles.col}>
						<Text style={styles.section}>Tipo de encuentro</Text>
						{ENCOUNTER_OPTS.map((opt) => {
							const selected = encounterType === opt.id;
							return (
								<Pressable
									key={opt.id}
									onPress={() => setEncounterType(opt.id)}
									style={[styles.encBtn, selected && styles.encBtnOn]}
								>
									<Text
										style={[styles.encLabel, selected && styles.encLabelOn]}
									>
										{opt.label}
									</Text>
									<Text style={styles.encHint}>{opt.hint}</Text>
								</Pressable>
							);
						})}
					</View>

					{/* Formación */}
					<View style={[styles.col, { flex: 1.4 }]}>
						<Text style={styles.section}>Orden de marcha</Text>
						<Text style={styles.hint}>
							Los dos primeros van al frente (reciben ataques primero).
						</Text>
						<Text style={styles.zoneTitle}>Frente</Text>
						{front.map((id, i) => renderSlot(id, 'front', i))}
						<Text style={[styles.zoneTitle, { marginTop: 10 }]}>
							Retaguardia
						</Text>
						{rear.map((id, i) => renderSlot(id, 'rear', i))}
					</View>
				</View>
			</ScrollView>

			<View style={styles.footer}>
				<Pressable
					onPress={start}
					style={styles.startBtn}
				>
					<Text style={styles.startText}>Generar encuentro y combatir</Text>
				</Pressable>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: '#1a1a1e' },
	header: {
		height: 52,
		paddingHorizontal: 18,
		justifyContent: 'center',
		backgroundColor: '#121216',
		borderBottomWidth: 1,
		borderBottomColor: '#2a2a32',
	},
	title: { color: '#e8e6e3', fontSize: 20, fontWeight: '800' },
	sub: { color: '#7a7670', fontSize: 13, marginTop: 2 },
	body: { padding: 16 },
	row: { flexDirection: 'row', gap: 20 },
	col: { flex: 1, minWidth: 200 },
	section: {
		color: '#9a9690',
		fontSize: 13,
		fontWeight: '700',
		textTransform: 'uppercase',
		letterSpacing: 1,
		marginBottom: 10,
	},
	hint: { color: '#7a7670', fontSize: 13, marginBottom: 8 },
	encBtn: {
		padding: 14,
		marginBottom: 10,
		borderRadius: 10,
		backgroundColor: '#22222a',
		borderWidth: 2,
		borderColor: '#3a3a45',
	},
	encBtnOn: { borderColor: '#c9a227', backgroundColor: '#3a3420' },
	encLabel: { color: '#e8e6e3', fontSize: 17, fontWeight: '700' },
	encLabelOn: { color: '#f0d78c' },
	encHint: { color: '#7a7670', fontSize: 13, marginTop: 4 },
	zoneTitle: {
		color: '#c9a227',
		fontSize: 14,
		fontWeight: '700',
		marginBottom: 6,
	},
	heroCard: {
		flexDirection: 'row',
		alignItems: 'center',
		padding: 10,
		marginBottom: 8,
		backgroundColor: '#22222a',
		borderRadius: 10,
		borderWidth: 1,
		borderColor: '#3a3a45',
	},
	heroMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
	heroName: { color: '#e8e6e3', fontSize: 16, fontWeight: '700' },
	heroMeta: { color: '#9a9690', fontSize: 13 },
	zoneTag: { color: '#6b6760', fontSize: 12, marginTop: 2 },
	moveRow: { gap: 4 },
	moveBtn: {
		width: 40,
		height: 36,
		borderRadius: 8,
		backgroundColor: '#2a2a35',
		alignItems: 'center',
		justifyContent: 'center',
	},
	moveBtnOff: { opacity: 0.3 },
	moveBtnText: { color: '#e8e6e3', fontSize: 16, fontWeight: '700' },
	footer: {
		padding: 14,
		borderTopWidth: 1,
		borderTopColor: '#2a2a32',
		backgroundColor: '#121216',
	},
	startBtn: {
		minHeight: 54,
		borderRadius: 12,
		backgroundColor: '#3a3420',
		borderWidth: 2,
		borderColor: '#c9a227',
		alignItems: 'center',
		justifyContent: 'center',
	},
	startText: { color: '#f0d78c', fontSize: 17, fontWeight: '800' },
});
