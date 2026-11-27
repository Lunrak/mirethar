/**
 * Vista local de mazmorra — niebla de guerra.
 * Todo es oscuridad; al revelar se ve suelo, paredes y contenido.
 * La lógica sigue en casillas, pero no se dibuja una rejilla de cuadrados.
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

/** Tamaño lógico de casilla (sin gap visual entre ellas). */
const CELL = 44;
const GAP = 0;
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

/** Pared hacia oscuridad / borde de mapa (solo en casillas reveladas). */
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
	// Hay puerta explorable → no dibujar muro sólido (se ve la puerta)
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

	const canvasW = VIEW_W * CELL;
	const canvasH = VIEW_H * CELL;

	return (
		<View style={styles.wrap}>
			<View style={[styles.canvas, { width: canvasW, height: canvasH }]}>
				{/* Capa de oscuridad continua (sin rejilla) */}
				<View style={styles.voidLayer} />

				{tiles.map(({ x, y, vx, vy }) => {
					const id = cellKey(x, y);
					const cell = map.cells[id];
					const inMap = inBounds(x, y);
					const revealed = !!cell?.revealed;
					const isParty = id === map.partyCellId;
					const left = vx * CELL;
					const top = vy * CELL;

					// Niebla: no dibujar casilla (queda el void negro)
					if (!inMap || !revealed) {
						// Solo el grupo podría estar en casilla no revelada en teoría: no
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

					const symbol = cellSymbol(cell, isParty);

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

							{/* Oscurecido suave en uniones de pasillo */}
							{cell.kind === 'corridor' || cell.label === 'unión' ? (
								<View style={styles.corridorTint} />
							) : null}

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

							{/* Puertas en el borde hacia la oscuridad */}
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

							{/* Paredes hacia la niebla (silueta de la habitación) */}
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

							{/* Halo del grupo */}
							{isParty ? (
								<View
									style={styles.partyGlow}
									pointerEvents="none"
								/>
							) : null}
						</Pressable>
					);
				})}
			</View>

			<Text style={styles.legend}>
				Solo lo explorado es visible · ★ grupo · ⚔ amenaza · tocad puertas en el
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
		// Sin borde de “tablero de casillas”
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
		// Sin border ni borderRadius: el suelo se une en un continuo
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
	glyph: {
		color: '#e8e4dc',
		fontSize: 17,
		fontWeight: '800',
		textShadowColor: '#000',
		textShadowOffset: { width: 1, height: 1 },
		textShadowRadius: 3,
		zIndex: 3,
	},
	partyGlyph: {
		color: '#f5e6a8',
		fontSize: 20,
	},
	enemyGlyph: {
		color: '#ff6b6b',
	},
	partyGlow: {
		position: 'absolute',
		left: 4,
		top: 4,
		right: 4,
		bottom: 4,
		borderRadius: 20,
		borderWidth: 1.5,
		borderColor: 'rgba(240,215,140,0.55)',
		zIndex: 2,
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
	// Paredes un poco más gruesas para silueta legible en la niebla
	wallN: { top: 0, left: 0, right: 0, height: 5 },
	wallS: { bottom: 0, left: 0, right: 0, height: 5 },
	wallE: { right: 0, top: 0, bottom: 0, width: 5 },
	wallW: { left: 0, top: 0, bottom: 0, width: 5 },
	legend: {
		color: '#5a5650',
		fontSize: 11,
		marginTop: 10,
		textAlign: 'center',
		maxWidth: 320,
	},
});
