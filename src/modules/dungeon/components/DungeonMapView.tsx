/**
 * Vista local de mazmorra: 7 casillas de alto (3 arriba del grupo, 3 abajo).
 * Muestra zona caminable + símbolos de puertas, enemigos y paredes.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
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

const CELL = 36;
const GAP = 3;
/** Alto visible: 3 encima + casilla del grupo + 3 debajo */
const VIEW_H = 7;
const VIEW_HALF_H = 3;
/** Ancho visible centrado en el grupo (impar) */
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

function cellSymbol(c: MapCell | undefined, isParty: boolean): string {
	if (isParty) return '★';
	if (!c || !c.revealed) return '';
	if (c.monsterDeal && (c.monsterDeal.bribed || c.content === 'encounter')) {
		return '⚔';
	}
	if (c.content === 'encounter') return '⚔';
	if (c.content === 'treasure') return '◆';
	if (c.content === 'trap') return '!';
	if (c.content === 'stairs_down') return '↓';
	if (c.content === 'special') return '?';
	if (c.kind === 'entrance') return 'E';
	if (c.kind === 'room') return '·';
	if (c.kind === 'corridor') return '·';
	return '·';
}

function kindColor(c: MapCell | undefined, isParty: boolean): string {
	if (isParty) return '#c9a227';
	if (!c || !c.revealed) return '#121216';
	switch (c.kind) {
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

/** ¿Hay pared en esa dirección? (fuera de mapa o sin casilla revelada vecina y sin puerta) */
function wallToward(map: DungeonMap, x: number, y: number, dir: Dir): boolean {
	const { dx, dy } = DIR_DELTA[dir];
	const nx = x + dx;
	const ny = y + dy;
	if (!inBounds(nx, ny)) return true;
	const neighbor = map.cells[cellKey(nx, ny)];
	if (neighbor?.revealed) return false;
	// Si hay puerta explorables hacia ahí, no es muro cerrado opaco
	const door = Object.values(map.doors).find(
		(d) => d.cellId === cellKey(x, y) && d.dir === dir,
	);
	if (door && door.state !== 'blocked') return false;
	return true;
}

function doorAt(map: DungeonMap, cellId: string, dir: Dir): Door | undefined {
	return Object.values(map.doors).find(
		(d) => d.cellId === cellId && d.dir === dir,
	);
}

export function DungeonMapView({ map, onSelectCell, onOpenDoor }: Props) {
	const party = map.cells[map.partyCellId];
	const px = party?.x ?? Math.floor(MAP_WIDTH / 2);
	const py = party?.y ?? MAP_HEIGHT - 1;

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

	const canvasW = VIEW_W * (CELL + GAP);
	const canvasH = VIEW_H * (CELL + GAP);

	return (
		<View style={styles.wrap}>
			<View style={[styles.canvas, { width: canvasW, height: canvasH }]}>
				{tiles.map(({ x, y, vx, vy }) => {
					const id = cellKey(x, y);
					const cell = map.cells[id];
					const inMap = inBounds(x, y);
					const revealed = !!cell?.revealed;
					const isParty = id === map.partyCellId;
					const walkable = revealed;
					const left = vx * (CELL + GAP);
					const top = vy * (CELL + GAP);

					// Fuera del mapa o no revelado: pared / niebla
					if (!inMap || !revealed) {
						return (
							<View
								key={`t_${x}_${y}`}
								style={[styles.cell, styles.wallCell, { left, top }]}
							>
								<Text style={styles.wallGlyph}>{!inMap ? '█' : '▓'}</Text>
							</View>
						);
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

					return (
						<Pressable
							key={id}
							onPress={() => onSelectCell?.(id)}
							style={[
								styles.cell,
								{
									left,
									top,
									backgroundColor: kindColor(cell, isParty),
									borderColor: isParty
										? '#f0d78c'
										: hasEnemy
											? '#e55'
											: '#2a2a32',
								},
							]}
						>
							<Text style={[styles.glyph, isParty && styles.partyGlyph]}>
								{cellSymbol(cell, isParty)}
							</Text>

							{/* Marcas de puerta en los bordes */}
							{doors.map(({ dir, door }) => {
								const closed = door.state === 'closed' && !door.leadsToCellId;
								const blocked = door.state === 'blocked';
								const open = door.state === 'open' || !!door.leadsToCellId;
								let mark = '□';
								let color = '#e8e6e3';
								if (closed) {
									mark = '▣';
									color = '#e55';
								} else if (blocked) {
									mark = '✕';
									color = '#666';
								} else if (open) {
									mark = '▢';
									color = '#5dce7a';
								}
								const edge =
									dir === 'N'
										? styles.doorN
										: dir === 'S'
											? styles.doorS
											: dir === 'E'
												? styles.doorE
												: styles.doorW;
								const canOpen = closed && onOpenDoor;
								return (
									<Pressable
										key={`${id}_${dir}`}
										disabled={!canOpen}
										onPress={() => canOpen && onOpenDoor?.(door.id)}
										style={[styles.doorMark, edge]}
										hitSlop={4}
									>
										<Text style={[styles.doorMarkText, { color }]}>{mark}</Text>
									</Pressable>
								);
							})}

							{/* Indicadores de muro hacia vacío no explorado */}
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
										style={[styles.wallEdge, edge]}
									/>
								);
							})}
						</Pressable>
					);
				})}
			</View>

			<Text style={styles.legend}>
				★ grupo · ⚔ enemigo · ◆ tesoro · ▣ puerta · █ borde · solo zona cercana
				({VIEW_W}×{VIEW_H})
			</Text>
			<Text style={styles.coord}>
				Vista centrada en ({px},{py}) · hoja {MAP_WIDTH}×{MAP_HEIGHT}
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
	},
	canvas: {
		position: 'relative',
		backgroundColor: '#0c0c10',
		borderWidth: 2,
		borderColor: '#3a3a45',
		borderRadius: 8,
	},
	cell: {
		position: 'absolute',
		width: CELL,
		height: CELL,
		borderRadius: 4,
		borderWidth: 1.5,
		alignItems: 'center',
		justifyContent: 'center',
	},
	wallCell: {
		backgroundColor: '#1a1520',
		borderColor: '#2a2430',
	},
	wallGlyph: {
		color: '#3a3540',
		fontSize: 14,
		fontWeight: '900',
	},
	glyph: {
		color: '#c8c4be',
		fontSize: 14,
		fontWeight: '800',
	},
	partyGlyph: {
		color: '#1a1a1e',
		fontSize: 16,
	},
	doorMark: {
		position: 'absolute',
		zIndex: 4,
	},
	doorMarkText: {
		fontSize: 10,
		fontWeight: '900',
	},
	doorN: { top: -2, alignSelf: 'center' },
	doorS: { bottom: -2, alignSelf: 'center' },
	doorE: { right: -1, top: 11 },
	doorW: { left: -1, top: 11 },
	wallEdge: {
		position: 'absolute',
		backgroundColor: '#6a6570',
		zIndex: 1,
	},
	wallN: { top: 0, left: 4, right: 4, height: 3 },
	wallS: { bottom: 0, left: 4, right: 4, height: 3 },
	wallE: { right: 0, top: 4, bottom: 4, width: 3 },
	wallW: { left: 0, top: 4, bottom: 4, width: 3 },
	legend: {
		color: '#8a8680',
		fontSize: 11,
		marginTop: 8,
		textAlign: 'center',
	},
	coord: {
		color: '#5a5650',
		fontSize: 10,
		marginTop: 2,
	},
});
