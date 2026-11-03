/**
 * Hechizos básicos 4AD (6 del manual)
 */

export type SpellId =
  | 'blessing'
  | 'fireball'
  | 'lightning_bolt'
  | 'sleep'
  | 'escape'
  | 'protect';

export type SpellDefinition = {
  id: SpellId;
  name: string;
  /** Quién puede lanzarlo */
  casters: Array<'wizard' | 'cleric' | 'elf'>;
  description: string;
  /** Requiere objetivo enemigo / aliado / ninguno */
  target: 'enemy' | 'ally' | 'self' | 'none' | 'group';
};

export const SPELLS: Record<SpellId, SpellDefinition> = {
  blessing: {
    id: 'blessing',
    name: 'Blessing',
    casters: ['wizard', 'cleric'],
    description: 'Removes curse or petrification. Clerics may cast up to 3/adventure as spell.',
    target: 'ally',
  },
  fireball: {
    id: 'fireball',
    name: 'Fireball',
    casters: ['wizard'],
    description:
      'Attack roll + level. Vs minions: kills (roll - monster level) min 1. No effect on dragons.',
    target: 'group',
  },
  lightning_bolt: {
    id: 'lightning_bolt',
    name: 'Lightning Bolt',
    casters: ['wizard'],
    description: 'Attack roll + level. Vs minions: kills 1 if hits. Vs boss: 2 wounds if hits.',
    target: 'enemy',
  },
  sleep: {
    id: 'sleep',
    name: 'Sleep',
    casters: ['wizard'],
    description:
      'Attack roll + level. No undead/dragons. Boss: defeat 1. Minions: d6+L if hits. Count as slain.',
    target: 'group',
  },
  escape: {
    id: 'escape',
    name: 'Escape',
    casters: ['wizard'],
    description: 'Teleport to first room. Auto success. Can replace a Defense roll.',
    target: 'self',
  },
  protect: {
    id: 'protect',
    name: 'Protect',
    casters: ['wizard'],
    description: '+1 Defense to one character for the whole battle.',
    target: 'ally',
  },
};

/** Mapeo nombre mostrado → id */
export function spellIdFromName(name: string): SpellId | null {
  const n = name.toLowerCase().replace(/\s+/g, '_');
  if (n in SPELLS) return n as SpellId;
  const found = Object.values(SPELLS).find((s) => s.name.toLowerCase() === name.toLowerCase());
  return found?.id ?? null;
}
