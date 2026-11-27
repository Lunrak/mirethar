/**
 * Vista de mazmorra a pantalla completa — niebla de guerra.
 * Ocupa todo el contenedor; solo se dibuja lo revelado.
 * Contorno dorado de la habitación del grupo + cámara centrada animada.
 */

import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import {
	View,
	Text,
	StyleSheet,
	Pressable,
	Image,
	Animated,
	Easing,
	type LayoutChangeEvent,
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

/** Tamaño mínimo de casilla (px); se agranda si cabe. */
const MIN_CELL = 28;
const MAX_CELL = 56;

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
	return !regionIds.has(cellKey(nx, ny));
}

function clampOrigin(
	center: number,
	half: number,
	max: number,
	size: number,
): number {
	let origin = Math.round(center - half);
	if (origin < 0) origin = 0;
	if (origin + size > max) origin = Math.max(0, max - size);
	return origin;
}

export function DungeonMapView({ map, onSelectCell, onOpenDoor }: Props) {
	const [layout, setLayout] = useState({ w: 0, h: 0 });
	const onLayout = useCallback((e: LayoutChangeEvent) => {
		const { width, height } = e.nativeEvent.layout;
		if (width > 0 && height > 0) setLayout({ w: width, h: height });
	}, []);

	// Casillas que caben a pantalla completa
	const cellSize = useMemo(() => {
		if (layout.w <= 0 || layout.h <= 0) return 40;
		// Preferir ~11×6 en landscape 20:9
		const byW = layout.w / 11;
		const byH = layout.h / 6;
		const s = Math.floor(Math.min(byW, byH));
		return Math.max(MIN_CELL, Math.min(MAX_CELL, s));
	}, [layout.w, layout.h]);

	const viewW = useMemo(
		() => Math.max(7, Math.ceil(layout.w / cellSize) || 11),
		[layout.w, cellSize],
	);
	const viewH = useMemo(
		() => Math.max(5, Math.ceil(layout.h / cellSize) || 6),
		[layout.h, cellSize],
	);
	const halfW = (viewW - 1) / 2;
	const halfH = (viewH - 1) / 2;

	const party = map.cells[map.partyCellId];
	const region = useMemo(() => collectPartyRegion(map), [map]);

	const panX = useRef(new Animated.Value(0)).current;
	const panY = useRef(new Animated.Value(0)).current;
	const [viewOrigin, setViewOrigin] = useState({ x: 0, y: 0 });

	useEffect(() => {
		const tx = region.centerX;
		const ty = region.centerY;
		const targetOriginX = clampOrigin(tx, halfW, MAP_WIDTH, viewW);
		const targetOriginY = clampOrigin(ty, halfH, MAP_HEIGHT, viewH);

		const idealLeft = tx - halfW;
		const idealTop = ty - halfH;
		const fineX = (targetOriginX - idealLeft) * cellSize;
		const fineY = (targetOriginY - idealTop) * cellSize;

		Animated.parallel([
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

		setViewOrigin({ x: targetOriginX, y: targetOriginY });
	}, [
		region.centerX,
		region.centerY,
		map.partyCellId,
		viewW,
		viewH,
		halfW,
		halfH,
		cellSize,
		panX,
		panY,
	]);

	const originX = viewOrigin.x;
	const originY = viewOrigin.y;

	const tiles = useMemo(() => {
		const list: { x: number; y: number; vx: number; vy: number }[] = [];
		for (let vy = -1; vy < viewH + 1; vy++) {
			for (let vx = -1; vx < viewW + 1; vx++) {
				list.push({ x: originX + vx, y: originY + vy, vx, vy });
			}
		}
		return list;
	}, [originX, originY, viewW, viewH]);

	const doorPx = Math.max(16, Math.floor(cellSize * 0.45));

	return (
		<View
			style={styles.fill}
			onLayout={onLayout}
		>
			{/* Niebla de guerra a pantalla completa */}
			<View style={styles.voidLayer} />

			{layout.w > 0 && (
				<Animated.View
					style={[
						styles.world,
						{
							width: (viewW + 2) * cellSize,
							height: (viewH + 2) * cellSize,
							transform: [{ translateX: panX }, { translateY: panY }],
						},
					]}
				>
					{tiles.map(({ x, y, vx, vy }) => {
						const id = cellKey(x, y);
						const cell = map.cells[id];
						const revealed = !!cell?.revealed && inBounds(x, y);
						const inPartyRegion = region.ids.has(id);
						const left = vx * cellSize;
						const top = vy * cellSize;

						if (!revealed || !cell) return null;

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
								style={[
									styles.cell,
									{ left, top, width: cellSize, height: cellSize },
								]}
							>
								<Image
									source={MAP_TILES.floor}
									style={{ width: cellSize, height: cellSize }}
									resizeMode="cover"
								/>

								{(cell.kind === 'corridor' || cell.label === 'unión') && (
									<View style={styles.corridorTint} />
								)}
								{inPartyRegion && <View style={styles.regionFloorTint} />}

								{symbol ? (
									<Text
										style={[
											styles.glyph,
											{ fontSize: Math.max(12, cellSize * 0.38) },
											hasEnemy && styles.enemyGlyph,
										]}
									>
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
											? { top: 0, left: (cellSize - doorPx) / 2 }
											: dir === 'S'
												? { bottom: 0, left: (cellSize - doorPx) / 2 }
												: dir === 'E'
													? { right: 0, top: (cellSize - doorPx) / 2 }
													: { left: 0, top: (cellSize - doorPx) / 2 };

									return (
										<Pressable
											key={`${id}_${dir}`}
											disabled={!canOpen}
											onPress={() => canOpen && onOpenDoor?.(door.id)}
											style={[
												styles.doorMark,
												edge,
												{ width: doorPx, height: doorPx },
											]}
											hitSlop={8}
										>
											{blocked ? (
												<Text style={styles.blockedMark}>✕</Text>
											) : (
												<Image
													source={source}
													style={{ width: doorPx, height: doorPx }}
													resizeMode="cover"
												/>
											)}
										</Pressable>
									);
								})}

								{inPartyRegion &&
									(['N', 'E', 'S', 'W'] as Dir[]).map((dir) => {
										if (!isRegionContourEdge(map, x, y, dir, region.ids))
											return null;
										if (doorAt(map, id, dir)) return null;
										const thick = Math.max(3, Math.floor(cellSize * 0.12));
										const edge =
											dir === 'N'
												? { top: 0, left: 0, right: 0, height: thick }
												: dir === 'S'
													? { bottom: 0, left: 0, right: 0, height: thick }
													: dir === 'E'
														? { right: 0, top: 0, bottom: 0, width: thick }
														: { left: 0, top: 0, bottom: 0, width: thick };
										return (
											<View
												key={`c_${dir}`}
												style={[styles.wallEdgeActive, edge]}
											/>
										);
									})}

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
										const thick = Math.max(3, Math.floor(cellSize * 0.1));
										const edge =
											dir === 'N'
												? { top: 0, left: 0, right: 0, height: thick }
												: dir === 'S'
													? { bottom: 0, left: 0, right: 0, height: thick }
													: dir === 'E'
														? { right: 0, top: 0, bottom: 0, width: thick }
														: { left: 0, top: 0, bottom: 0, width: thick };
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
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	fill: {
		position: 'absolute',
		left: 0,
		right: 0,
		top: 0,
		bottom: 0,
		backgroundColor: '#000000',
		overflow: 'hidden',
	},
	voidLayer: {
		position: 'absolute',
		left: 0,
		right: 0,
		top: 0,
		bottom: 0,
		backgroundColor: '#000000',
	},
	world: {
		position: 'absolute',
		left: 0,
		top: 0,
	},
	cell: {
		position: 'absolute',
		overflow: 'hidden',
		alignItems: 'center',
		justifyContent: 'center',
	},
	corridorTint: {
		position: 'absolute',
		left: 0,
		right: 0,
		top: 0,
		bottom: 0,
		backgroundColor: 'rgba(0,0,0,0.18)',
	},
	regionFloorTint: {
		position: 'absolute',
		left: 0,
		right: 0,
		top: 0,
		bottom: 0,
		backgroundColor: 'rgba(240, 210, 120, 0.08)',
	},
	glyph: {
		color: '#e8e4dc',
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
	},
	blockedMark: {
		color: '#666',
		fontSize: 12,
		fontWeight: '900',
		textAlign: 'center',
	},
	wallEdge: {
		position: 'absolute',
		backgroundColor: '#1a1520',
		zIndex: 2,
	},
	wallEdgeActive: {
		position: 'absolute',
		backgroundColor: '#e0b84a',
		zIndex: 4,
	},
});
