/**
 * Representación visual básica de unidades – Día 19 + sprites
 * - Silueta / iconos de equipo del héroe
 * - Sprites de héroes y monstruos (idle / attack / defend)
 * - Badges de estado (caído, herido, envenenado…)
 * - Barra de life con color por umbral
 * - Marcador de objetivo primario
 */

import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import type {
	Hero,
	EnemyInstance,
	StatusEffect,
} from '../../../core/types/combat';
import type { Item } from '../../../core/data/items';
import {
	getHeroStatus,
	type HeroStatusKind,
} from '../../../core/rules/HeroStatus';
import {
	type SpritePose,
	getEnemySprite,
	getHeroSprite,
	getHeroSpriteStatus,
	getHeroSpriteKey,
	resolvePose,
} from '../spriteMap';
import { getSpriteSource, getSpriteById } from '../spriteAssets';

// ---------------------------------------------------------------------------
// Iconos de equipo (MVP: emoji / glifo por tipo de ítem)
// ---------------------------------------------------------------------------

const WEAPON_ICON: Record<string, string> = {
	hand_weapon: '⚔️',
	light_hand_weapon: '🗡️',
	two_handed_weapon: '🪓',
	crushing_weapon: '🔨',
	bow: '🏹',
};

const ARMOR_ICON: Record<string, string> = {
	light_armor: '🧥',
	heavy_armor: '🛡️',
};

const MISC_ICON: Record<string, string> = {
	shield: '🛡️',
	spellbook: '📖',
	holy_symbol: '✝️',
	lockpicks: '🗝️',
	rope: '🪢',
	writing_implements: '✒️',
};

const CLASS_BASE: Record<Hero['class'], string> = {
	warrior: '🪖',
	rogue: '🥷',
	cleric: '🙏',
	wizard: '🧙',
};

/** Icono de arma principal del héroe */
export function weaponIcon(hero: Hero): string {
	const w = hero.equipment.mainHand;
	if (!w) return '✊';
	return WEAPON_ICON[w.id] ?? (w.tags?.includes('ranged') ? '🏹' : '⚔️');
}

/** Icono de armadura / cuerpo */
export function armorIcon(hero: Hero): string {
	const a = hero.equipment.armor;
	if (!a) return CLASS_BASE[hero.class] ?? '👤';
	return ARMOR_ICON[a.id] ?? (a.tags?.includes('heavy') ? '🛡️' : '🧥');
}

/** ¿Lleva escudo? */
export function hasShield(hero: Hero): boolean {
	return !!hero.equipment.shield;
}

/** Fila compacta de iconos de equipo (silueta MVP) */
export function HeroGearIcons({ hero }: { hero: Hero }) {
	const body = armorIcon(hero);
	const weapon = weaponIcon(hero);
	const shield = hasShield(hero) ? '🛡️' : null;
	const book = hero.equipment.spellbook ? '📖' : null;
	const holy =
		hero.equipment.misc?.id === 'holy_symbol' ||
		Object.values(hero.equipment).some((i) => i?.id === 'holy_symbol')
			? '✝️'
			: null;

	return (
		<View style={gearStyles.row}>
			<Text style={gearStyles.big}>{body}</Text>
			<View style={gearStyles.side}>
				<Text style={gearStyles.small}>{weapon}</Text>
				{shield ? <Text style={gearStyles.small}>{shield}</Text> : null}
				{book ? <Text style={gearStyles.tiny}>{book}</Text> : null}
				{holy ? <Text style={gearStyles.tiny}>{holy}</Text> : null}
			</View>
		</View>
	);
}

const gearStyles = StyleSheet.create({
	row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
	side: { flexDirection: 'column', alignItems: 'center' },
	big: { fontSize: 22 },
	small: { fontSize: 14, lineHeight: 16 },
	tiny: { fontSize: 11, lineHeight: 13 },
});

// ---------------------------------------------------------------------------
// Estados
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<
	string,
	{ label: string; color: string; bg: string }
> = {
	fallen: { label: 'CAÍDO', color: '#f0a0a0', bg: '#4a2020' },
	dead: { label: 'MUERTO', color: '#888', bg: '#2a2a2a' },
	wounded: { label: 'HERIDO', color: '#e8c547', bg: '#3a3420' },
	poisoned: { label: 'VENENO', color: '#9dce5d', bg: '#2a3a20' },
	cursed: { label: 'MALDITO', color: '#c49bff', bg: '#2a2040' },
	petrified: { label: 'PIEDRA', color: '#a0a0a8', bg: '#303038' },
	fled: { label: 'HUYÓ', color: '#9a9690', bg: '#2a2a32' },
	sleeping: { label: 'DORMIDO', color: '#6ea8fe', bg: '#1e2a3a' },
	blessed: { label: 'BENDITO', color: '#f0d78c', bg: '#3a3420' },
	protected: { label: 'PROTEGIDO', color: '#6ea8fe', bg: '#1e2a3a' },
};

function statusFromHero(hero: Hero): string[] {
	const keys: string[] = [];
	const kind = getHeroStatus(hero);
	if (kind === 'dead') keys.push('dead');
	else if (kind === 'fallen') keys.push('fallen');
	else if (kind === 'wounded') keys.push('wounded');

	for (const s of hero.status ?? []) {
		const id = (s.id || s.name || '').toLowerCase();
		if (id.includes('poison')) keys.push('poisoned');
		else if (id.includes('curse')) keys.push('cursed');
		else if (id.includes('petrif')) keys.push('petrified');
		else if (id.includes('sleep')) keys.push('sleeping');
		else if (id.includes('bless')) keys.push('blessed');
		else if (id.includes('protect')) keys.push('protected');
		else if (s.name) keys.push(s.name.toLowerCase());
	}
	return [...new Set(keys)];
}

export function StatusBadges({
	hero,
	enemy,
}: {
	hero?: Hero;
	enemy?: EnemyInstance;
}) {
	const keys: string[] = [];

	if (hero) keys.push(...statusFromHero(hero));
	if (enemy) {
		if (enemy.fled) keys.push('fled');
		else if (enemy.currentLife <= 0) keys.push('dead');
		if (enemy.isUndead) {
			/* badge aparte abajo */
		}
	}

	if (keys.length === 0 && !enemy?.isUndead) return null;

	return (
		<View style={badgeStyles.row}>
			{keys.map((k) => {
				const conf = STATUS_BADGE[k] ?? {
					label: k.slice(0, 6).toUpperCase(),
					color: '#c0bcb6',
					bg: '#333',
				};
				return (
					<View
						key={k}
						style={[badgeStyles.badge, { backgroundColor: conf.bg }]}
					>
						<Text style={[badgeStyles.text, { color: conf.color }]}>
							{conf.label}
						</Text>
					</View>
				);
			})}
			{enemy?.isUndead ? (
				<View style={[badgeStyles.badge, { backgroundColor: '#2a2040' }]}>
					<Text style={[badgeStyles.text, { color: '#c49bff' }]}>
						NO-MUERTO
					</Text>
				</View>
			) : null}
		</View>
	);
}

const badgeStyles = StyleSheet.create({
	row: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: 3 },
	badge: {
		paddingHorizontal: 5,
		paddingVertical: 1,
		borderRadius: 4,
	},
	text: { fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
});

// ---------------------------------------------------------------------------
// Barra de life
// ---------------------------------------------------------------------------

function barColor(pct: number, isEnemy: boolean): string {
	if (pct <= 0) return '#444';
	if (isEnemy) {
		if (pct <= 25) return '#6a2020';
		if (pct <= 50) return '#a33';
		return '#c44';
	}
	if (pct <= 25) return '#a33';
	if (pct <= 50) return '#c9a227';
	return '#3d8b5f';
}

export function LifeBar({
	current,
	max,
	isEnemy = false,
	showLabel = true,
}: {
	current: number;
	max: number;
	isEnemy?: boolean;
	showLabel?: boolean;
}) {
	const safeMax = Math.max(1, max);
	const pct = Math.max(0, Math.min(100, Math.round((current / safeMax) * 100)));
	const color = barColor(pct, isEnemy);

	return (
		<View style={lifeStyles.wrap}>
			<View style={lifeStyles.track}>
				<View
					style={[
						lifeStyles.fill,
						{ width: `${pct}%`, backgroundColor: color },
					]}
				/>
			</View>
			{showLabel && (
				<Text style={lifeStyles.label}>
					{Math.max(0, current)}
					{!isEnemy || max > 1 ? `/${max}` : ''}
				</Text>
			)}
		</View>
	);
}

const lifeStyles = StyleSheet.create({
	wrap: { marginTop: 5 },
	track: {
		height: 7,
		backgroundColor: '#2a2a32',
		borderRadius: 4,
		overflow: 'hidden',
		borderWidth: 1,
		borderColor: '#3a3a45',
	},
	fill: { height: '100%', borderRadius: 3 },
	label: {
		color: '#8a8680',
		fontSize: 10,
		marginTop: 2,
		fontWeight: '600',
	},
});

// ---------------------------------------------------------------------------
// Indicador de objetivo primario
// ---------------------------------------------------------------------------

export function PrimaryTargetMarker({ visible }: { visible: boolean }) {
	if (!visible) return null;
	return (
		<View
			style={targetStyles.wrap}
			pointerEvents="none"
		>
			<Text style={targetStyles.arrow}>▼</Text>
			<View style={targetStyles.ring} />
		</View>
	);
}

const targetStyles = StyleSheet.create({
	wrap: {
		position: 'absolute',
		top: -14,
		left: 0,
		right: 0,
		alignItems: 'center',
		zIndex: 5,
	},
	arrow: {
		color: '#e55',
		fontSize: 12,
		fontWeight: '900',
		lineHeight: 12,
		textShadowColor: '#000',
		textShadowOffset: { width: 0, height: 1 },
		textShadowRadius: 2,
	},
	ring: {
		position: 'absolute',
		top: 10,
		width: '100%',
		height: 4,
		borderTopWidth: 2,
		borderTopColor: '#e55',
		opacity: 0.85,
	},
});

// ---------------------------------------------------------------------------
// Resumen de silueta (para accessibility / debug)
// ---------------------------------------------------------------------------

export function describeHeroLook(hero: Hero): string {
	const parts = [CLASS_BASE[hero.class]];
	const w = hero.equipment.mainHand;
	if (w) parts.push(w.name);
	if (hero.equipment.shield) parts.push('Shield');
	if (hero.equipment.armor) parts.push(hero.equipment.armor.name);
	return parts.join(' · ');
}

export function statusLabel(kind: HeroStatusKind): string {
	switch (kind) {
		case 'dead':
			return 'muerto';
		case 'fallen':
			return 'caído';
		case 'wounded':
			return 'herido';
		default:
			return 'vivo';
	}
}

// ---------------------------------------------------------------------------
// Sprites (idle / attack / defend) – hoja de fantasía oscura
// ---------------------------------------------------------------------------
// Fuentes: src/assets/sprites/ via require() estáticos en spriteAssets.ts

/** PNGs nativos 192×192; marco UI fijo, imagen centrada con contain */
const SPRITE_SIZE = 64;
const SPRITE_SIZE_FOCUS = 72;

type UnitSpriteProps = {
	pose: SpritePose;
	size?: number;
	/** Emoji si no hay PNG o falla la carga */
	fallback: string;
	/** Carpeta + key del mapa (ver spriteMap / spriteAssets) */
	folder?: 'vermin' | 'minions' | 'bosses' | 'weird' | 'heroes';
	spriteKey?: string;
	/** Id completo sin pose, p. ej. "heroes/cleric_dead" */
	fixedAssetId?: string;
};

/** Componente base: muestra el PNG real según pose, o emoji de respaldo */
export function UnitSprite({
	pose,
	size = SPRITE_SIZE,
	fallback,
	folder,
	spriteKey,
	fixedAssetId,
}: UnitSpriteProps) {
	const borderColor =
		pose === 'attack'
			? '#c44'
			: pose === 'defend'
				? '#4a8'
				: pose === 'dead'
					? '#555'
					: '#3a3a45';

	const source = fixedAssetId
		? getSpriteById(fixedAssetId)
		: folder && spriteKey
			? getSpriteSource(folder, spriteKey, pose)
			: null;

	return (
		<View
			style={[
				spriteStyles.wrap,
				{
					width: size,
					height: size,
					borderColor,
					borderWidth: pose === 'idle' ? 1 : 2,
				},
			]}
		>
			{source ? (
				<Image
					source={source}
					style={spriteStyles.image}
					resizeMode="contain"
					accessibilityLabel={`sprite ${spriteKey} ${pose}`}
				/>
			) : (
				<Text style={[spriteStyles.fallback, { fontSize: size * 0.55 }]}>
					{fallback}
				</Text>
			)}
			{pose !== 'idle' && (
				<View
					style={spriteStyles.poseBadge}
					pointerEvents="none"
				>
					<Text style={spriteStyles.poseText}>
						{pose === 'attack'
							? '⚔'
							: pose === 'defend'
								? '🛡'
								: pose === 'dead'
									? '☠'
									: ''}
					</Text>
				</View>
			)}
		</View>
	);
}

/** Sprite de héroe según clase + pose del zoom */
export function HeroSprite({
	hero,
	pose,
	focused = false,
}: {
	hero: Hero;
	pose: SpritePose;
	focused?: boolean;
}) {
	const size = focused ? SPRITE_SIZE_FOCUS : SPRITE_SIZE;
	const status = getHeroSpriteStatus(hero);
	const { key, usePose } = getHeroSpriteKey(hero.class, status);
	const fallback =
		status === 'dead'
			? '💀'
			: status === 'stone'
				? '🪨'
				: (CLASS_BASE[hero.class] ?? '👤');

	// stone / dead: un solo PNG sin pose; sano/herido: _f/_m + idle|attack|defend
	if (!usePose) {
		return (
			<UnitSprite
				pose="idle"
				size={size}
				fallback={fallback}
				fixedAssetId={`heroes/${key}`}
			/>
		);
	}

	return (
		<UnitSprite
			pose={pose}
			size={size}
			fallback={fallback}
			folder="heroes"
			spriteKey={key}
		/>
	);
}

/** Sprite de enemigo según templateId + pose del zoom */
export function EnemySprite({
	enemy,
	pose,
	focused = false,
}: {
	enemy: EnemyInstance;
	pose: SpritePose;
	focused?: boolean;
}) {
	const ref = getEnemySprite(enemy.templateId);
	const size = focused ? SPRITE_SIZE_FOCUS : SPRITE_SIZE;
	// Solo muertos usan sprite _dead; la huida se muestra como texto en el campo
	const killed = enemy.currentLife <= 0 && !enemy.fled;
	const effectivePose: SpritePose = killed ? 'dead' : pose;
	const fallback = killed ? '💀' : enemy.isUndead ? '💀' : '👹';

	return (
		<UnitSprite
			pose={effectivePose}
			size={size}
			fallback={fallback}
			folder={ref?.folder}
			spriteKey={ref?.key}
		/>
	);
}

export { resolvePose, type SpritePose };

const spriteStyles = StyleSheet.create({
	wrap: {
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: 8,
		backgroundColor: '#1a1a22',
		overflow: 'hidden',
	},
	image: {
		width: '100%',
		height: '100%',
	},
	fallback: {
		textAlign: 'center',
	},
	poseBadge: {
		position: 'absolute',
		right: 1,
		bottom: 1,
		backgroundColor: 'rgba(0,0,0,0.65)',
		borderRadius: 4,
		paddingHorizontal: 2,
	},
	poseText: {
		fontSize: 10,
		color: '#eee',
	},
});

// silence unused import lint for Item if any
export type { Item, StatusEffect };
