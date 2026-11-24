/**
 * Vista local de mazmorra: 7×9 casillas centradas en el grupo.
 * Usa tiles gráficos (floor / wall / door abierta|cerrada) de assets/map.
 * Las puertas cambian de sprite según Door.state.
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

const CELL = 40;
const GAP = 2;
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

function cellSymbol(c: MapCell | undefined, isParty: boolean): string {
	if (isParty) return '★';
	if (!c || !c.revealed) return '';
	if (c.monsterDeal && (c.monsterDeal.bribed || c.content === 'encounter'))
		return '⚔';
	if (c.content === 'encounter') return '⚔';
	if (c.content === 'treasure') return '◆';
	if (c.content === 'trap') return '!';
	if (c.content === 'stairs_down') return '↓';
	if (c.content === 'special') return '?';
	if (c.kind === 'entrance') return 'E';
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
					const left = vx * (CELL + GAP);
					const top = vy * (CELL + GAP);

					// Fuera de mapa o niebla: muro
					if (!inMap || !revealed) {
						return (
							<View
								key={`t_${x}_${y}`}
								style={[styles.cell, { left, top }]}
							>
								<Image
									source={MAP_TILES.wall}
									style={styles.tileImg}
									resizeMode="cover"
								/>
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

					const symbol = cellSymbol(cell, isParty);

					return (
						<Pressable
							key={id}
							onPress={() => onSelectCell?.(id)}
							style={[
								styles.cell,
								{
									left,
									top,
									borderColor: isParty
										? '#f0d78c'
										: hasEnemy
											? '#e55'
											: '#2a2a32',
									borderWidth: isParty || hasEnemy ? 2 : 1,
								},
							]}
						>
							{/* Suelo de la casilla */}
							<Image
								source={MAP_TILES.floor}
								style={styles.tileImg}
								resizeMode="cover"
							/>

							{/* Glifo de contenido / grupo */}
							{symbol ? (
								<Text
									style={[
										styles.glyph,
										isParty && styles.partyGlyph,
										hasEnemy && styles.enemyGlyph,
									]}
								>
									{symbol}
								</Text>
							) : null}

							{/* Puertas: sprite abierto / cerrado según estado */}
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
										hitSlop={6}
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
				★ grupo · ⚔ enemigo · ◆ tesoro · puerta gráfica (abierta/cerrada) · hoja{' '}
				{MAP_WIDTH}×{MAP_HEIGHT}
			</Text>
			<Text style={styles.coord}>
				Vista centrada en ({px},{py})
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
		overflow: 'hidden',
	},
	cell: {
		position: 'absolute',
		width: CELL,
		height: CELL,
		borderRadius: 3,
		overflow: 'hidden',
		alignItems: 'center',
		justifyContent: 'center',
	},
	tileImg: {
		...StyleSheet.absoluteFill,
		width: CELL,
		height: CELL,
	},
	glyph: {
		color: '#e8e4dc',
		fontSize: 16,
		fontWeight: '800',
		textShadowColor: '#000',
		textShadowOffset: { width: 1, height: 1 },
		textShadowRadius: 2,
		zIndex: 3,
	},
	partyGlyph: {
		color: '#f0d78c',
		fontSize: 18,
	},
	enemyGlyph: {
		color: '#ff6b6b',
	},
	doorMark: {
		position: 'absolute',
		zIndex: 5,
		width: 22,
		height: 22,
	},
	doorImg: {
		width: 22,
		height: 22,
		borderRadius: 2,
	},
	blockedMark: {
		color: '#888',
		fontSize: 14,
		fontWeight: '900',
		textAlign: 'center',
	},
	doorN: { top: 1, alignSelf: 'center', left: (CELL - 22) / 2 },
	doorS: { bottom: 1, alignSelf: 'center', left: (CELL - 22) / 2 },
	doorE: { right: 1, top: (CELL - 22) / 2 },
	doorW: { left: 1, top: (CELL - 22) / 2 },
	wallEdge: {
		position: 'absolute',
		backgroundColor: 'rgba(40,36,48,0.85)',
		zIndex: 2,
	},
	wallN: { top: 0, left: 0, right: 0, height: 4 },
	wallS: { bottom: 0, left: 0, right: 0, height: 4 },
	wallE: { right: 0, top: 0, bottom: 0, width: 4 },
	wallW: { left: 0, top: 0, bottom: 0, width: 4 },
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
