export type DiceResult = {
	raw: number; // 1-6
	explosive: number[]; // dados extra por Explosive Six
	total: number;
	isExplosive: boolean;
};

// Re-export desde items (fuente de verdad)
export type { EquipmentSlot, Item } from '../data/items';
import type { EquipmentSlot, Item } from '../data/items';

export type StatusEffect = { id: string; name: string };

export type ReactionType =
	| 'flee'
	| 'flee_if_outnumbered'
	| 'bribe'
	| 'fight'
	| 'fight_to_death'
	| 'always_fight'
	| 'quest'
	| 'sleeping';

export type EnemyInstance = {
	id: string;
	templateId: string;
	currentLife: number;
	/** Life máxima del perfil (para barra de vida). Si falta, se infiere del template. */
	maxLife?: number;
	name: string;
	level: number;
	/**
	 * Level original al empezar el combate.
	 * Si falta, se asume igual a `level` (aún no bajó por half-life).
	 * 4AD: al quedar por debajo de la mitad de life, level = baseLevel - 1.
	 */
	baseLevel?: number;
	attacks: number;
	isUndead?: boolean;
};

export type CombatPosition = { front: string[]; rear: string[] };

export type Action = {
	type: string; // 'attack' | 'defend' | 'cast' | 'heal' | 'flee' | ...
	name: string;
	requiresTarget?: boolean;
};

export type CombatLogEntry = {
	id: string;
	message: string;
	timestamp: number;
};

export type Hero = {
	id: string;
	name: string;
	class: 'warrior' | 'rogue' | 'cleric' | 'wizard';
	level: number;
	life: number;
	maxLife: number;
	equipment: Partial<Record<EquipmentSlot, Item>>;
	/** Hechizos preparados (wizard) */
	spells?: string[];
	/** Usos de Healing restantes del clérigo (3 por aventura) */
	healingUsesLeft?: number;
	status: StatusEffect[];
	isFallen: boolean;
	isDead: boolean;
	carryingBodyId?: string;
};

export type EnemyTemplate = {
	id: string;
	name: string;
	type: 'vermin' | 'minion' | 'boss' | 'weird';
	level: number;
	life: number;
	attacks: number;
	treasureModifier: number;
	specialRules: string[];
	reactions: { [roll: number]: ReactionType };
	isUndead?: boolean;
};

export type CombatPhase = 'heroTurn' | 'enemyTurn' | 'resolution' | 'ended';

export type CombatState = {
	id: string;
	round: number;
	currentActorId: string | null;
	phase: CombatPhase;
	heroes: Hero[];
	enemies: EnemyInstance[];
	positions: CombatPosition;
	selectedAction: Action | null;
	selectedTargetId: string | null;
	log: CombatLogEntry[];
	isFinished: boolean;
	result: 'victory' | 'defeat' | null;
	/** Orden de turno de héroes vivos (ids) */
	heroTurnOrder: string[];
	/** Índice del héroe actual dentro de heroTurnOrder */
	heroTurnIndex: number;
};
