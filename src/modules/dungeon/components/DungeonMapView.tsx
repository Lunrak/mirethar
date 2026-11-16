/**
 * Dibuja el mapa de mazmorra revelado (grid).
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { Dir, DungeonMap, MapCell } from '../../../core/types/dungeon';
import { DIR_DELTA } from '../../../core/types/dungeon';
import { doorsFromPartyCell } from '../../../core/rules/DungeonGenerator';

const CELL = 44;
const GAP = 4;

type Props = {
	map: DungeonMap;
	onSelectCell?: (cellId: string) => void;
	onOpenDoor?: (doorId: string) => void;
};

function kindColor(kind: MapCell['kind'], isParty: boolean): string {
	if (isParty) return '#3a3420';
	switch (kind) {
		case 'entrance':
			return '#2a3a2a';
		case 'corridor':
			return '#2a2a32';
		case 'room':
			return '#32282a';
		default:
			return '#22222a';
	}
}

export function DungeonMapView({ map, onSelectCell, onOpenDoor }: Props) {
	const cells = useMemo(() => Object.values(map.cells), [map.cells]);
	const bounds = useMemo(() => {
		if (cells.length === 0) {
			return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
		}
		let minX = Infinity,
			maxX = -Infinity,
			minY = Infinity,
			maxY = -Infinity;
		for (const c of cells) {
			minX = Math.min(minX, c.x);
			maxX = Math.max(maxX, c.x);
			minY = Math.min(minY, c.y);
			maxY = Math.max(maxY, c.y);
		}
		return { minX, maxX, minY, maxY };
	}, [cells]);

	const partyDoors = doorsFromPartyCell(map);

	const toLeft = (x: number) => (x - bounds.minX) * (CELL + GAP);
	const toTop = (y: number) => (y - bounds.minY) * (CELL + GAP);
	const width = (bounds.maxX - bounds.minX + 1) * (CELL + GAP);
	const height = (bounds.maxY - bounds.minY + 1) * (CELL + GAP);

	return (
		<View style={styles.wrap}>
			<View style={[styles.canvas, { width, height }]}>
				{cells.map((c) => {
					const isParty = c.id === map.partyCellId;
					return (
						<Pressable
							key={c.id}
							onPress={() => onSelectCell?.(c.id)}
							style={[
								styles.cell,
								{
									left: toLeft(c.x),
									top: toTop(c.y),
									backgroundColor: kindColor(c.kind, isParty),
									borderColor: isParty ? '#c9a227' : '#3a3a45',
								},
							]}
						>
							<Text style={styles.cellKind}>
								{c.kind === 'corridor' ? 'P' : c.kind === 'room' ? 'S' : 'E'}
							</Text>
							{isParty && <Text style={styles.party}>★</Text>}
							<Text
								style={styles.cellLabel}
								numberOfLines={1}
							>
								{c.label ?? ''}
							</Text>
						</Pressable>
					);
				})}

				{/* Indicadores de puertas cerradas desde la celda del grupo */}
				{partyDoors.map((d) => {
					const cell = map.cells[d.cellId];
					if (!cell) return null;
					const { dx, dy } = DIR_DELTA[d.dir as Dir];
					const closed = d.state === 'closed' && !d.leadsToCellId;
					const cx = toLeft(cell.x) + CELL / 2 + dx * (CELL / 2);
					const cy = toTop(cell.y) + CELL / 2 + dy * (CELL / 2);
					return (
						<Pressable
							key={d.id}
							onPress={() => closed && onOpenDoor?.(d.id)}
							style={[
								styles.doorDot,
								{
									left: cx - 10,
									top: cy - 10,
									backgroundColor: closed ? '#e55' : '#5dce7a',
								},
							]}
							accessibilityLabel={
								closed ? `Abrir puerta ${d.dir}` : `Puerta ${d.dir} abierta`
							}
						>
							<Text style={styles.doorText}>{d.dir}</Text>
						</Pressable>
					);
				})}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: 8,
	},
	canvas: {
		position: 'relative',
	},
	cell: {
		position: 'absolute',
		width: CELL,
		height: CELL,
		borderRadius: 8,
		borderWidth: 2,
		alignItems: 'center',
		justifyContent: 'center',
		padding: 2,
	},
	cellKind: {
		color: '#9a9690',
		fontSize: 10,
		fontWeight: '800',
	},
	party: {
		color: '#f0d78c',
		fontSize: 14,
		fontWeight: '900',
	},
	cellLabel: {
		color: '#6b6760',
		fontSize: 8,
		maxWidth: CELL - 6,
	},
	doorDot: {
		position: 'absolute',
		width: 20,
		height: 20,
		borderRadius: 10,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1,
		borderColor: '#1a1a1e',
		zIndex: 5,
	},
	doorText: {
		color: '#fff',
		fontSize: 9,
		fontWeight: '800',
	},
});
