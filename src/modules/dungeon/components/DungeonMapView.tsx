/**
 * Dibuja la hoja de mazmorra 28×20 (cuadrados).
 * Entrada en centro inferior; solo se colorean las casillas reveladas.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import type { Dir, DungeonMap, MapCell } from '../../../core/types/dungeon';
import { DIR_DELTA, MAP_WIDTH, MAP_HEIGHT } from '../../../core/types/dungeon';
import { doorsFromPartyCell } from '../../../core/rules/DungeonGenerator';

const CELL = 18;
const GAP = 1;

type Props = {
	map: DungeonMap;
	onSelectCell?: (cellId: string) => void;
	onOpenDoor?: (doorId: string) => void;
};

function kindColor(kind: MapCell['kind'], isParty: boolean): string {
	if (isParty) return '#c9a227';
	switch (kind) {
		case 'entrance':
			return '#3d6b45';
		case 'corridor':
			return '#3a3a48';
		case 'room':
			return '#5a3a3a';
		default:
			return '#2a2a32';
	}
}

export function DungeonMapView({ map, onSelectCell, onOpenDoor }: Props) {
	const byKey = map.cells;
	const partyDoors = doorsFromPartyCell(map).filter(
		(d) => d.state === 'closed' && !d.leadsToCellId,
	);
	const blockedDoors = doorsFromPartyCell(map).filter(
		(d) => d.state === 'blocked',
	);

	const width = MAP_WIDTH * (CELL + GAP);
	const height = MAP_HEIGHT * (CELL + GAP);

	const gridCells = useMemo(() => {
		const list: { x: number; y: number }[] = [];
		for (let y = 0; y < MAP_HEIGHT; y++) {
			for (let x = 0; x < MAP_WIDTH; x++) {
				list.push({ x, y });
			}
		}
		return list;
	}, []);

	return (
		<ScrollView
			horizontal
			style={styles.scroll}
			contentContainerStyle={styles.scrollContent}
		>
			<ScrollView contentContainerStyle={styles.scrollContent}>
				<View style={[styles.canvas, { width, height }]}>
					{/* Fondo de hoja */}
					{gridCells.map(({ x, y }) => (
						<View
							key={`g_${x}_${y}`}
							style={[
								styles.gridCell,
								{
									left: x * (CELL + GAP),
									top: y * (CELL + GAP),
								},
							]}
						/>
					))}

					{/* Casillas reveladas */}
					{Object.values(byKey).map((c) => {
						const isParty = c.id === map.partyCellId;
						return (
							<Pressable
								key={c.id}
								onPress={() => onSelectCell?.(c.id)}
								style={[
									styles.cell,
									{
										left: c.x * (CELL + GAP),
										top: c.y * (CELL + GAP),
										backgroundColor: kindColor(c.kind, isParty),
										borderColor: isParty ? '#f0d78c' : '#1a1a1e',
									},
								]}
							>
								{isParty && <Text style={styles.party}>★</Text>}
							</Pressable>
						);
					})}

					{/* Puertas cerradas (explorables) */}
					{partyDoors.map((d) => {
						const cell = byKey[d.cellId];
						if (!cell) return null;
						const { dx, dy } = DIR_DELTA[d.dir as Dir];
						const cx = cell.x * (CELL + GAP) + CELL / 2 + dx * (CELL / 2);
						const cy = cell.y * (CELL + GAP) + CELL / 2 + dy * (CELL / 2);
						return (
							<Pressable
								key={d.id}
								onPress={() => onOpenDoor?.(d.id)}
								style={[
									styles.doorDot,
									{
										left: cx - 7,
										top: cy - 7,
										backgroundColor: '#e55',
									},
								]}
							>
								<Text style={styles.doorText}>{d.dir}</Text>
							</Pressable>
						);
					})}

					{/* Puertas bloqueadas por borde */}
					{blockedDoors.map((d) => {
						const cell = byKey[d.cellId];
						if (!cell) return null;
						const { dx, dy } = DIR_DELTA[d.dir as Dir];
						const cx = cell.x * (CELL + GAP) + CELL / 2 + dx * (CELL / 2);
						const cy = cell.y * (CELL + GAP) + CELL / 2 + dy * (CELL / 2);
						return (
							<View
								key={`b_${d.id}`}
								style={[
									styles.doorDot,
									{
										left: cx - 7,
										top: cy - 7,
										backgroundColor: '#555',
									},
								]}
							>
								<Text style={styles.doorText}>✕</Text>
							</View>
						);
					})}
				</View>
				<Text style={styles.legend}>
					Hoja {MAP_WIDTH}×{MAP_HEIGHT} · Entrada centro-inferior · ✕ = límite
				</Text>
			</ScrollView>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	scroll: { flex: 1 },
	scrollContent: { padding: 8, alignItems: 'center' },
	canvas: {
		position: 'relative',
		backgroundColor: '#121216',
		borderWidth: 1,
		borderColor: '#2a2a32',
	},
	gridCell: {
		position: 'absolute',
		width: CELL,
		height: CELL,
		backgroundColor: '#1a1a1e',
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: '#252530',
	},
	cell: {
		position: 'absolute',
		width: CELL,
		height: CELL,
		borderWidth: 1,
		alignItems: 'center',
		justifyContent: 'center',
		zIndex: 2,
	},
	party: { color: '#1a1a1e', fontSize: 10, fontWeight: '900' },
	doorDot: {
		position: 'absolute',
		width: 14,
		height: 14,
		borderRadius: 7,
		alignItems: 'center',
		justifyContent: 'center',
		zIndex: 5,
	},
	doorText: { color: '#fff', fontSize: 7, fontWeight: '800' },
	legend: {
		color: '#6b6760',
		fontSize: 11,
		marginTop: 6,
	},
});
