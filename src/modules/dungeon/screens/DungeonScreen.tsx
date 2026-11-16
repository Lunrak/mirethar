/**
 * Exploración de mazmorra – elegir entrada 1–6 y abrir puertas
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import {
	createDungeon,
	openDoor,
	movePartyTo,
	ENTRANCES,
	doorsFromPartyCell,
} from '../../../core/rules/DungeonGenerator';
import type { DungeonMap } from '../../../core/types/dungeon';
import type { EncounterResult } from '../../../core/rules/EncounterGenerator';

import { DungeonMapView } from '../components/DungeonMapView';

type Props = {
	onBack?: () => void;
	/** Más adelante: ir a combate desde una sala */
	onEncounter?: (map: DungeonMap) => void;
};

export default function DungeonScreen({ onBack, onEncounter }: Props) {
	const [map, setMap] = useState<DungeonMap | null>(null);
	const [log, setLog] = useState<string[]>([]);
	const [pendingEncounter, setPendingEncounter] =
		useState<EncounterResult | null>(null);

	const start = (entranceId: number) => {
		const m = createDungeon(entranceId);
		setMap(m);
		setPendingEncounter(null);
		setLog([
			`Entrada ${entranceId}: ${ENTRANCES.find((e) => e.id === entranceId)?.name}`,
			'Tocad una puerta roja para explorar más allá.',
		]);
	};

	const handleOpenDoor = (doorId: string) => {
		if (!map) return;
		const result = openDoor(map, doorId);
		setMap(result.map);
		if (result.pendingEncounter) {
			setPendingEncounter(result.pendingEncounter);
		}
		setLog((prev) => [...prev, result.message].slice(-12));
	};

	const handleSelectCell = (cellId: string) => {
		if (!map) return;
		setMap(movePartyTo(map, cellId));
	};

	if (!map) {
		return (
			<View style={styles.root}>
				<View style={styles.header}>
					<Text style={styles.title}>Mazmorra</Text>
					<Text style={styles.sub}>Elige una de las 6 entradas</Text>
					{onBack && (
						<Pressable
							onPress={onBack}
							style={styles.backBtn}
						>
							<Text style={styles.backText}>Volver</Text>
						</Pressable>
					)}
				</View>
				<ScrollView contentContainerStyle={styles.entranceList}>
					{ENTRANCES.map((e) => (
						<Pressable
							key={e.id}
							onPress={() => start(e.id)}
							style={styles.entranceCard}
						>
							<Text style={styles.entranceId}>#{e.id}</Text>
							<View style={{ flex: 1 }}>
								<Text style={styles.entranceName}>{e.name}</Text>
								<Text style={styles.entranceBlurb}>{e.blurb}</Text>
							</View>
						</Pressable>
					))}
					<Pressable
						onPress={() => start(Math.floor(Math.random() * 6) + 1)}
						style={[styles.entranceCard, styles.randomCard]}
					>
						<Text style={styles.entranceName}>Al azar (d6)</Text>
						<Text style={styles.entranceBlurb}>
							Tira entrada como en la hoja de mapas
						</Text>
					</Pressable>
				</ScrollView>
			</View>
		);
	}

	const partyDoors = doorsFromPartyCell(map);
	const closed = partyDoors.filter(
		(d) => d.state === 'closed' && !d.leadsToCellId,
	);

	return (
		<View style={styles.root}>
			<View style={styles.header}>
				<View>
					<Text style={styles.title}>Mazmorra · Entrada {map.entranceId}</Text>
					<Text style={styles.sub}>
						Sala actual: {map.cells[map.partyCellId]?.label ?? map.partyCellId}
					</Text>
				</View>
				<Pressable
					onPress={() => {
						setMap(null);
						setLog([]);
					}}
					style={styles.backBtn}
				>
					<Text style={styles.backText}>Nueva</Text>
				</Pressable>
			</View>

			<View style={styles.body}>
				<View style={styles.mapPane}>
					<DungeonMapView
						map={map}
						onSelectCell={handleSelectCell}
						onOpenDoor={handleOpenDoor}
					/>
				</View>

				<View style={styles.side}>
					<Text style={styles.sideTitle}>Puertas aquí</Text>
					{partyDoors.length === 0 && (
						<Text style={styles.muted}>Sin puertas en esta celda.</Text>
					)}
					{partyDoors.map((d) => {
						const canOpen = d.state === 'closed' && !d.leadsToCellId;
						return (
							<Pressable
								key={d.id}
								disabled={!canOpen}
								onPress={() => handleOpenDoor(d.id)}
								style={[styles.doorBtn, !canOpen && styles.doorBtnOff]}
							>
								<Text style={styles.doorBtnText}>
									{d.dir} · {canOpen ? 'Cerrada — abrir' : 'Abierta'}
								</Text>
							</Pressable>
						);
					})}
					{closed.length === 0 && (
						<Text style={styles.muted}>
							No quedan puertas sin explorar en esta casilla. Mové el grupo a
							otra (tocá una casilla).
						</Text>
					)}

					{pendingEncounter && (
						<View style={styles.encBox}>
							<Text style={styles.sideTitle}>¡Encuentro!</Text>
							<Text style={styles.encText}>
								{pendingEncounter.template.name} ×{pendingEncounter.quantity}
							</Text>
							<Text style={styles.muted}>
								Tipo: {pendingEncounter.type} (tabla #
								{pendingEncounter.tableRoll})
							</Text>
							<Pressable
								style={styles.encBtn}
								onPress={() => {
									onEncounter?.(map);
									setPendingEncounter(null);
								}}
							>
								<Text style={styles.encBtnText}>Preparar combate</Text>
							</Pressable>
						</View>
					)}

					<Text style={[styles.sideTitle, { marginTop: 12 }]}>Log</Text>
					<ScrollView style={styles.log}>
						{log.map((line, i) => (
							<Text
								key={`${i}_${line}`}
								style={styles.logLine}
							>
								{line}
							</Text>
						))}
					</ScrollView>
				</View>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: '#1a1a1e' },
	header: {
		height: 52,
		paddingHorizontal: 16,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		borderBottomWidth: 1,
		borderBottomColor: '#2a2a32',
	},
	title: { color: '#e8e6e3', fontSize: 18, fontWeight: '800' },
	sub: { color: '#9a9690', fontSize: 12, marginTop: 2 },
	backBtn: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 8,
		backgroundColor: '#2a2a35',
	},
	backText: { color: '#e8e6e3', fontWeight: '700' },
	entranceList: { padding: 16, gap: 10 },
	entranceCard: {
		flexDirection: 'row',
		gap: 12,
		padding: 14,
		borderRadius: 12,
		backgroundColor: '#22222a',
		borderWidth: 2,
		borderColor: '#3a3a45',
		marginBottom: 10,
		alignItems: 'center',
	},
	randomCard: { borderColor: '#c9a227' },
	entranceId: {
		color: '#c9a227',
		fontSize: 22,
		fontWeight: '900',
		width: 36,
	},
	entranceName: { color: '#e8e6e3', fontSize: 16, fontWeight: '700' },
	entranceBlurb: { color: '#9a9690', fontSize: 13, marginTop: 2 },
	body: { flex: 1, flexDirection: 'row' },
	mapPane: { flex: 1.4 },
	side: {
		width: 200,
		borderLeftWidth: 1,
		borderLeftColor: '#2a2a32',
		padding: 10,
	},
	sideTitle: {
		color: '#c9a227',
		fontSize: 12,
		fontWeight: '800',
		textTransform: 'uppercase',
		marginBottom: 8,
	},
	doorBtn: {
		padding: 10,
		borderRadius: 8,
		backgroundColor: '#3a2020',
		borderWidth: 1,
		borderColor: '#e55',
		marginBottom: 6,
	},
	doorBtnOff: {
		backgroundColor: '#1e2a22',
		borderColor: '#3d8b5f',
		opacity: 0.85,
	},
	doorBtnText: { color: '#e8e6e3', fontWeight: '700', fontSize: 13 },
	muted: { color: '#7a7670', fontSize: 12, marginBottom: 8 },
	log: { flex: 1 },
	logLine: { color: '#b8b4ae', fontSize: 12, marginBottom: 4 },
	encBox: {
		padding: 10,
		borderRadius: 10,
		backgroundColor: '#3a2020',
		borderWidth: 1,
		borderColor: '#e55',
		marginBottom: 8,
	},
	encText: { color: '#e8e6e3', fontWeight: '800', fontSize: 14 },
	encBtn: {
		marginTop: 8,
		padding: 10,
		borderRadius: 8,
		backgroundColor: '#3a3420',
		borderWidth: 1,
		borderColor: '#c9a227',
		alignItems: 'center',
	},
	encBtnText: { color: '#f0d78c', fontWeight: '800' },
});
