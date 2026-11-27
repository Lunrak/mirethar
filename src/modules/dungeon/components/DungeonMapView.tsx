/**
 * Vista local de mazmorra — niebla de guerra.
 * Resalta el CONTORNO completo de la habitación/pasillo del grupo
 * y desplaza la cámara con animación al centro de esa región.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import {
	View,
	Text,
	StyleSheet,
	Pressable,
	Image,
	Animated,
	Easing,
} from 'react-native';
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

/**
 * Casillas de la pieza donde está el grupo.
 * Usa regionId; si falta, expande por adyacencia revelada (mismo label o conectadas).
 */
function collectPartyRegion(map: DungeonMap): {
	ids: Set<string>;
	centerX: number;
	centerY: number;
} {
	const party = map.cells[map.partyCellId];
	const empty = {
		ids: new Set<string>(map.partyCellId ? [map.partyCellId] : []),
		centerX: party?.x ?? MAP_WIDTH / 2,
		centerY: party?.y ?? MAP_HEIGHT - 1,
	};
	if (!party?.revealed) return empty;

	const ids = new Set<string>();

	if (party.regionId && !party.regionId.startsWith('join')) {
		for (const c of Object.values(map.cells)) {
			if (c.revealed && c.regionId === party.regionId) ids.add(c.id);
		}
	}

	// Fallback: BFS por vecinos revelados con mismo label / sin cruzar uniones ajenas
	if (ids.size <= 1) {
		const queue: string[] = [party.id];
		const seen = new Set<string>([party.id]);
		const label = party.label;
		while (queue.length) {
			const id = queue.pop()!;
			ids.add(id);
			const c = map.cells[id];
			if (!c) continue;
			for (const dir of ['N', 'E', 'S', 'W'] as Dir[]) {
				const { dx, dy } = DIR_DELTA[dir];
				const nid = cellKey(c.x + dx, c.y + dy);
				if (seen.has(nid)) continue;
				const n = map.cells[nid];
				if (!n?.revealed) continue;
				if (n.label === 'unión' || n.regionId?.startsWith('join')) continue;
				// Misma región explícita o mismo label o sin label y adyacente del mismo kind
				const sameRegion =
					(party.regionId && n.regionId === party.regionId) ||
					(label && n.label === label) ||
					(!party.regionId && !n.regionId && n.kind === party.kind);
				if (
					!sameRegion &&
					n.regionId &&
					party.regionId &&
					n.regionId !== party.regionId
				) {
					continue;
				}
				if (!sameRegion && label && n.label && n.label !== label) continue;
				if (!sameRegion && !label && n.kind !== party.kind) continue;
				seen.add(nid);
				queue.push(nid);
			}
		}
	}

	if (ids.size === 0) ids.add(party.id);

	let sx = 0;
	let sy = 0;
	let n = 0;
	for (const id of ids) {
		const c = map.cells[id];
		if (!c) continue;
		sx += c.x;
		sy += c.y;
		n++;
	}
	return {
		ids,
		centerX: n ? sx / n : party.x,
		centerY: n ? sy / n : party.y,
	};
}

/** Arista del contorno de la región: el vecino no pertenece a la región. */
function isRegionContourEdge(
	map: DungeonMap,
	x: number,
	y: number,
	dir: Dir,
	regionIds: Set<string>,
): boolean {
	const { dx, dy } = DIR_DELTA[dir];
	const nx = x + dx;
	const ny = y + dy;
	if (!inBounds(nx, ny)) return true;
	const nid = cellKey(nx, ny);
	if (!regionIds.has(nid)) return true;
	return false;
}

export function DungeonMapView({ map, onSelectCell, onOpenDoor }: Props) {
	const party = map.cells[map.partyCellId];
	const region = useMemo(() => collectPartyRegion(map), [map]);

	// Cámara animada hacia el centro de la habitación
	const camX = useRef(new Animated.Value(party?.x ?? MAP_WIDTH / 2)).current;
	const camY = useRef(new Animated.Value(party?.y ?? MAP_HEIGHT - 1)).current;
	const [viewOrigin, setViewOrigin] = React.useState(() => ({
		x: Math.max(
			0,
			Math.min(
				MAP_WIDTH - VIEW_W,
				Math.round((party?.x ?? MAP_WIDTH / 2) - VIEW_HALF_W),
			),
		),
		y: Math.max(
			0,
			Math.min(
				MAP_HEIGHT - VIEW_H,
				Math.round((party?.y ?? MAP_HEIGHT - 1) - VIEW_HALF_H),
			),
		),
	}));

	// Subpixel offset for smooth slide inside the tile grid
	const panX = useRef(new Animated.Value(0)).current;
	const panY = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		const tx = region.centerX;
		const ty = region.centerY;

		// Destino de origen de vista (entero) centrado en la región
		const targetOriginX = Math.max(
			0,
			Math.min(MAP_WIDTH - VIEW_W, Math.round(tx - VIEW_HALF_W)),
		);
		const targetOriginY = Math.max(
			0,
			Math.min(MAP_HEIGHT - VIEW_H, Math.round(ty - VIEW_HALF_H)),
		);

		// Offset fino para centrar el centro de la región en el canvas
		const idealLeft = tx - VIEW_HALF_W;
		const idealTop = ty - VIEW_HALF_H;
		const fineX = (targetOriginX - idealLeft) * CELL;
		const fineY = (targetOriginY - idealTop) * CELL;

		Animated.parallel([
			Animated.timing(camX, {
				toValue: tx,
				duration: 480,
				easing: Easing.out(Easing.cubic),
				useNativeDriver: false,
			}),
			Animated.timing(camY, {
				toValue: ty,
				duration: 480,
				easing: Easing.out(Easing.cubic),
				useNativeDriver: false,
			}),
			Animated.timing(panX, {
				toValue: fineX,
				duration: 480,
				easing: Easing.out(Easing.cubic),
				useNativeDriver: true,
			}),
			Animated.timing(panY, {
				toValue: fineY,
				duration: 480,
				easing: Easing.out(Easing.cubic),
				useNativeDriver: true,
			}),
		]).start();

		// Actualizar tiles cuando el origen entero cambia (durante o al final)
		setViewOrigin({ x: targetOriginX, y: targetOriginY });
	}, [region.centerX, region.centerY, map.partyCellId, camX, camY, panX, panY]);

	const originX = viewOrigin.x;
	const originY = viewOrigin.y;

	const tiles = useMemo(() => {
		// Margen extra de 1 casilla para el pan suave sin recortes
		const list: { x: number; y: number; vx: number; vy: number }[] = [];
		for (let vy = -1; vy < VIEW_H + 1; vy++) {
			for (let vx = -1; vx < VIEW_W + 1; vx++) {
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

				<Animated.View
					style={[
						styles.world,
						{
							transform: [{ translateX: panX }, { translateY: panY }],
						},
					]}
				>
					{tiles.map(({ x, y, vx, vy }) => {
						const id = cellKey(x, y);
						const cell = map.cells[id];
						const inMap = inBounds(x, y);
						const revealed = !!cell?.revealed;
						const inPartyRegion = region.ids.has(id);
						const left = vx * CELL;
						const top = vy * CELL;

						if (!inMap || !revealed || !cell) {
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

								{(cell.kind === 'corridor' || cell.label === 'unión') && (
									<View style={styles.corridorTint} />
								)}

								{inPartyRegion && <View style={styles.regionFloorTint} />}

								{symbol ? (
									<Text style={[styles.glyph, hasEnemy && styles.enemyGlyph]}>
										{symbol}
									</Text>
								) : null}

								{doors.map(({ dir, door }) => {
									const closed = door.state === 'closed' && !door.leadsToCellId;
									const blocked = door.state === 'blocked';
									const open = door.state === 'open' || !!door.leadsToCellId;
									const source = open
										? MAP_TILES.doorOpen
										: MAP_TILES.doorClosed;
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

								{/* Contorno completo de la habitación activa */}
								{inPartyRegion &&
									(['N', 'E', 'S', 'W'] as Dir[]).map((dir) => {
										if (!isRegionContourEdge(map, x, y, dir, region.ids)) {
											return null;
										}
										// Puerta en ese borde: no tapar con muro sólido
										if (doorAt(map, id, dir)) return null;
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
												key={`c_${dir}`}
												style={[styles.wallEdge, styles.wallEdgeActive, edge]}
											/>
										);
									})}

								{/* Muros normales (otras piezas) hacia la niebla */}
								{!inPartyRegion &&
									(['N', 'E', 'S', 'W'] as Dir[]).map((dir) => {
										if (doorAt(map, id, dir)) return null;
										const { dx, dy } = DIR_DELTA[dir];
										const nx = x + dx;
										const ny = y + dy;
										const nRevealed =
											inBounds(nx, ny) &&
											!!map.cells[cellKey(nx, ny)]?.revealed;
										if (nRevealed) return null;
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
				</Animated.View>
			</View>

			<Text style={styles.legend}>
				Contorno dorado = habitación del grupo · la vista se centra al entrar
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
	world: {
		position: 'absolute',
		left: 0,
		top: 0,
		width: (VIEW_W + 2) * CELL,
		height: (VIEW_H + 2) * CELL,
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
		backgroundColor: 'rgba(240, 210, 120, 0.08)',
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
		backgroundColor: '#e0b84a',
		zIndex: 4,
	},
	wallN: { top: 0, left: 0, right: 0, height: 6 },
	wallS: { bottom: 0, left: 0, right: 0, height: 6 },
	wallE: { right: 0, top: 0, bottom: 0, width: 6 },
	wallW: { left: 0, top: 0, bottom: 0, width: 6 },
	legend: {
		color: '#5a5650',
		fontSize: 11,
		marginTop: 10,
		textAlign: 'center',
		maxWidth: 340,
	},
});
