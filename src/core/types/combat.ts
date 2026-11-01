export type DiceResult = {
	raw: number; // 1-6
	explosive: number[]; // dados extra por Explosive Six
	total: number;
	isExplosive: boolean;
};

// Stubs mínimos para que los tipos principales compilen
export type EquipmentSlot = string;
export type Item = { id: string; name: string };
export type StatusEffect = { id: string; name: string };
export type ReactionType = string;
export type EnemyInstance = {
	id: string;
	templateId: string;
	currentLife: number;
};
export type CombatPosition = { front: string[]; rear: string[] };
export type Action = { type: string; name: string };
export type CombatLogEntry = { id: string; message: string; timestamp: number };

export type Hero = {
	id: string;
	name: string;
	class: 'warrior' | 'rogue' | 'cleric' | 'wizard';
	level: number;
	life: number;
	maxLife: number;
	equipment: Partial<Record<EquipmentSlot, Item>>;
	spells?: string[];
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

export type CombatState = {
	id: string;
	round: number;
	currentActorId: string | null;
	phase: 'heroTurn' | 'enemyTurn' | 'resolution' | 'ended';
	heroes: Hero[];
	enemies: EnemyInstance[];
	positions: CombatPosition;
	selectedAction: Action | null;
	selectedTargetId: string | null;
	log: CombatLogEntry[];
	isFinished: boolean;
	result: 'victory' | 'defeat' | null;
};