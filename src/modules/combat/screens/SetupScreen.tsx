/**
 * SetupScreen – preparación del encuentro (Core Loop GDD §2)
 * Tipo de encuentro + orden de marcha + hoja de personaje
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { createDefaultParty } from '../../../core/data/classes';
import type { Hero } from '../../../core/types/combat';
import type { EncounterType } from '../../../core/rules/EncounterGenerator';
import { HeroGearIcons } from '../components/UnitVisuals';
import { CharacterSheet } from '../components/CharacterSheet';

type Props = {
	onStart: (config: {
		heroes: Hero[];
		encounterType: EncounterType;
		positions: { front: string[]; rear: string[] };
	}) => void;
};

const ENCOUNTER_OPTS: { id: EncounterType; label: string; hint: string }[] = [
	{ id: 'vermin', label: 'Vermin', hint: 'Plagas · cantidades altas' },
	{ id: 'minion', label: 'Minion', hint: 'Grupo típico · trolls regeneran' },
	{ id: 'boss', label: 'Boss', hint: 'Jefe · 1 tirada XP' },
	{ id: 'weird', label: 'Weird', hint: 'Monstruo raro · 1 tirada XP' },
];

export default function SetupScreen({ onStart }: Props) {
	const [heroes, setHeroes] = useState<Hero[]>(() => createDefaultParty());
	const [encounterType, setEncounterType] = useState<EncounterType>('minion');
	const [order, setOrder] = useState<string[]>([]);
	const [sheetHeroId, setSheetHeroId] = useState<string | null>(null);

	React.useEffect(() => {
		setOrder((prev) => {
			if (
				prev.length === heroes.length &&
				prev.every((id) => heroes.some((h) => h.id === id))
			) {
				return prev;
			}
			return heroes.map((h) => h.id);
		});
	}, [heroes]);

	const front = order.slice(0, 2);
	const rear = order.slice(2, 4);

	const byId = useMemo(() => {
		const m = new Map(heroes.map((h) => [h.id, h]));
		return m;
	}, [heroes]);

	const sheetHero = sheetHeroId ? (byId.get(sheetHeroId) ?? null) : null;

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

	const updateHero = (updated: Hero) => {
		setHeroes((prev) => prev.map((h) => (h.id === updated.id ? updated : h)));
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
				<Pressable
					style={styles.heroMain}
					onPress={() => setSheetHeroId(id)}
					accessibilityRole="button"
					accessibilityLabel={`Abrir hoja de ${h.name}`}
				>
					<HeroGearIcons hero={h} />
					<View style={{ flex: 1 }}>
						<Text style={styles.heroName}>{h.name}</Text>
						<Text style={styles.heroMeta}>
							{h.class} · L{h.level} · {h.life}/{h.maxLife}
						</Text>
						<Text style={styles.zoneTag}>
							{zone === 'front' ? 'Frente' : 'Retaguardia'} · #{indexInZone + 1}
						</Text>
						<Text style={styles.openSheet}>Toca para hoja de personaje</Text>
					</View>
				</Pressable>
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
				<Text style={styles.sub}>
					Core Loop · GDD §2 · toca un héroe para su hoja
				</Text>
			</View>

			<ScrollView
				contentContainerStyle={styles.body}
				horizontal={false}
			>
				<View style={styles.row}>
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

					<View style={[styles.col, { flex: 1.4 }]}>
						<Text style={styles.section}>Orden de marcha</Text>
						<Text style={styles.hint}>
							Los dos primeros van al frente. Toca un héroe para abrir su hoja.
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

			{sheetHero && (
				<CharacterSheet
					hero={sheetHero}
					visible={!!sheetHero}
					onClose={() => setSheetHeroId(null)}
					onChange={updateHero}
					party={heroes}
				/>
			)}
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
	openSheet: {
		color: '#5dce7a',
		fontSize: 12,
		marginTop: 3,
		fontWeight: '600',
	},
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
