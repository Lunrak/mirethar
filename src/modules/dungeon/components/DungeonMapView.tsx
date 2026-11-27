/**
 * Vista local de mazmorra — niebla de guerra.
 * Todo es oscuridad; al revelar se ve suelo, paredes y contenido.
 * El grupo se indica resaltando las paredes de toda la región actual
 * (no un marcador en una sola casilla).
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import type {
	Dir,
	DungeonMap,
	MapCell,
	Door,
} from '../../../core/types/dungeon';
import {
	DIR_DELTA,
	MAP_WIDTH,
	MAP_HEIGHT,
	cellKey,
	inBounds,
} from '../../../core/types/dungeon';
import { MAP_TILES } from '../../../core/data/entranceRooms';

const CELL = 44;
const VIEW_H = 7;
const VIEW_HALF_H = 3;
const VIEW_W = 9;
const VIEW_HALF_W = 4;

type Props = {
	map: DungeonMap;
	onSelectCell?: (cellId: string) => void;
	onOpenDoor?: (doorId: string) => void;
};

function clampViewOrigin(
	party: number,
	half: number,
	max: number,
	size: number,
): number {
	let origin = party - half;
	if (origin < 0) origin = 0;
	if (origin + size > max) origin = Math.max(0, max - size);
	return origin;
}

function contentSymbol(c: MapCell): string {
	if (!c.revealed) return '';
	if (c.monsterDeal && (c.monsterDeal.bribed || c.content === 'encounter'))
		return '⚔';
	if (c.content === 'encounter') return '⚔';
	if (c.content === 'treasure') return '◆';
	if (c.content === 'trap') return '!';
	if (c.content === 'stairs_down') return '↓';
	if (c.content === 'special') return '?';
	return '';
}

function doorAt(map: DungeonMap, cellId: string, dir: Dir): Door | undefined {
	return Object.values(map.doors).find(
		(d) => d.cellId === cellId && d.dir === dir,
	);
}

function wallToward(map: DungeonMap, x: number, y: number, dir: Dir): boolean {
	const { dx, dy } = DIR_DELTA[dir];
	const nx = x + dx;
	const ny = y + dy;
	if (!inBounds(nx, ny)) return true;
	const neighbor = map.cells[cellKey(nx, ny)];
	if (neighbor?.revealed) return false;
	const door = Object.values(map.doors).find(
		(d) => d.cellId === cellKey(x, y) && d.dir === dir,
	);
	if (door && door.state !== 'blocked') return false;
	return true;
}

function regionCellIds(
	map: DungeonMap,
	regionId: string | undefined,
): Set<string> {
	const set = new Set<string>();
	if (!regionId) {
		if (map.partyCellId) set.add(map.partyCellId);
		return set;
	}
	for (const c of Object.values(map.cells)) {
		if (c.regionId === regionId && c.revealed) set.add(c.id);
	}
	if (set.size === 0 && map.partyCellId) set.add(map.partyCellId);
	return set;
}

export function DungeonMapView({ map, onSelectCell, onOpenDoor }: Props) {
	const party = map.cells[map.partyCellId];
	const px = party?.x ?? Math.floor(MAP_WIDTH / 2);
	const py = party?.y ?? MAP_HEIGHT - 1;
	const partyRegionId = party?.regionId;
	const activeRegion = useMemo(
		() => regionCellIds(map, partyRegionId),
		[map, partyRegionId],
	);

	const originX = clampViewOrigin(px, VIEW_HALF_W, MAP_WIDTH, VIEW_W);
	const originY = clampViewOrigin(py, VIEW_HALF_H, MAP_HEIGHT, VIEW_H);

	const tiles = useMemo(() => {
		const list: { x: number; y: number; vx: number; vy: number }[] = [];
		for (let vy = 0; vy < VIEW_H; vy++) {
			for (let vx = 0; vx < VIEW_W; vx++) {
				list.push({ x: originX + vx, y: originY + vy, vx, vy });
			}
		}
		return list;
	}, [originX, originY]);

	const canvasW = VIEW_W * CELL;
	const canvasH = VIEW_H * CELL;

	return (
		<View style={styles.wrap}>
			<View style={[styles.canvas, { width: canvasW, height: canvasH }]}>
				<View style={styles.voidLayer} />

				{tiles.map(({ x, y, vx, vy }) => {
					const id = cellKey(x, y);
					const cell = map.cells[id];
					const inMap = inBounds(x, y);
					const revealed = !!cell?.revealed;
					const inPartyRegion = activeRegion.has(id);
					const left = vx * CELL;
					const top = vy * CELL;

					if (!inMap || !revealed) {
						return null;
					}

					const doors: { dir: Dir; door: Door }[] = [];
					(['N', 'E', 'S', 'W'] as Dir[]).forEach((dir) => {
						const d = doorAt(map, id, dir);
						if (d) doors.push({ dir, door: d });
					});

					const hasEnemy =
						cell.content === 'encounter' ||
						!!cell.monsterDeal ||
						cell.content === 'trap';
					const symbol = contentSymbol(cell);

					return (
						<Pressable
							key={id}
							onPress={() => onSelectCell?.(id)}
							style={[styles.cell, { left, top }]}
						>
							<Image
								source={MAP_TILES.floor}
								style={styles.tileImg}
								resizeMode="cover"
							/>

							{cell.kind === 'corridor' || cell.label === 'unión' ? (
								<View style={styles.corridorTint} />
							) : null}

							{inPartyRegion ? <View style={styles.regionFloorTint} /> : null}

							{symbol ? (
								<Text style={[styles.glyph, hasEnemy && styles.enemyGlyph]}>
									{symbol}
								</Text>
							) : null}

							{doors.map(({ dir, door }) => {
								const closed = door.state === 'closed' && !door.leadsToCellId;
								const blocked = door.state === 'blocked';
								const open = door.state === 'open' || !!door.leadsToCellId;
								const source = open ? MAP_TILES.doorOpen : MAP_TILES.doorClosed;
								const canOpen = closed && onOpenDoor;
								const edge =
									dir === 'N'
										? styles.doorN
										: dir === 'S'
											? styles.doorS
											: dir === 'E'
												? styles.doorE
												: styles.doorW;

								return (
									<Pressable
										key={`${id}_${dir}`}
										disabled={!canOpen}
										onPress={() => canOpen && onOpenDoor?.(door.id)}
										style={[styles.doorMark, edge]}
										hitSlop={8}
									>
										{blocked ? (
											<Text style={styles.blockedMark}>✕</Text>
										) : (
											<Image
												source={source}
												style={styles.doorImg}
												resizeMode="cover"
											/>
										)}
									</Pressable>
								);
							})}

							{(['N', 'E', 'S', 'W'] as Dir[]).map((dir) => {
								if (doorAt(map, id, dir)) return null;
								if (!wallToward(map, x, y, dir)) return null;
								const edge =
									dir === 'N'
										? styles.wallN
										: dir === 'S'
											? styles.wallS
											: dir === 'E'
												? styles.wallE
												: styles.wallW;
								return (
									<View
										key={`w_${dir}`}
										style={[
											styles.wallEdge,
											edge,
											inPartyRegion && styles.wallEdgeActive,
										]}
									/>
								);
							})}
						</Pressable>
					);
				})}
			</View>

			<Text style={styles.legend}>
				Habitación actual: paredes doradas · ⚔ amenaza · tocad puertas en el
				borde
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: 8,
		backgroundColor: '#050508',
	},
	canvas: {
		position: 'relative',
		backgroundColor: '#000000',
		borderRadius: 12,
		overflow: 'hidden',
	},
	voidLayer: {
		position: 'absolute',
		left: 0,
		top: 0,
		right: 0,
		bottom: 0,
		backgroundColor: '#000000',
	},
	cell: {
		position: 'absolute',
		width: CELL,
		height: CELL,
		overflow: 'hidden',
		alignItems: 'center',
		justifyContent: 'center',
	},
	tileImg: {
		position: 'absolute',
		left: 0,
		top: 0,
		width: CELL,
		height: CELL,
	},
	corridorTint: {
		position: 'absolute',
		left: 0,
		top: 0,
		right: 0,
		bottom: 0,
		backgroundColor: 'rgba(0,0,0,0.18)',
	},
	regionFloorTint: {
		position: 'absolute',
		left: 0,
		top: 0,
		right: 0,
		bottom: 0,
		backgroundColor: 'rgba(240, 210, 120, 0.07)',
	},
	glyph: {
		color: '#e8e4dc',
		fontSize: 17,
		fontWeight: '800',
		textShadowColor: '#000',
		textShadowOffset: { width: 1, height: 1 },
		textShadowRadius: 3,
		zIndex: 3,
	},
	enemyGlyph: {
		color: '#ff6b6b',
	},
	doorMark: {
		position: 'absolute',
		zIndex: 5,
		width: 24,
		height: 24,
	},
	doorImg: {
		width: 24,
		height: 24,
	},
	blockedMark: {
		color: '#666',
		fontSize: 14,
		fontWeight: '900',
		textAlign: 'center',
	},
	doorN: { top: 0, left: (CELL - 24) / 2 },
	doorS: { bottom: 0, left: (CELL - 24) / 2 },
	doorE: { right: 0, top: (CELL - 24) / 2 },
	doorW: { left: 0, top: (CELL - 24) / 2 },
	wallEdge: {
		position: 'absolute',
		backgroundColor: '#1a1520',
		zIndex: 2,
	},
	wallEdgeActive: {
		backgroundColor: '#c9a84c',
	},
	wallN: { top: 0, left: 0, right: 0, height: 5 },
	wallS: { bottom: 0, left: 0, right: 0, height: 5 },
	wallE: { right: 0, top: 0, bottom: 0, width: 5 },
	wallW: { left: 0, top: 0, bottom: 0, width: 5 },
	legend: {
		color: '#5a5650',
		fontSize: 11,
		marginTop: 10,
		textAlign: 'center',
		maxWidth: 340,
	},
});
