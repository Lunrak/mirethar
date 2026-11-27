/**
 * Odio racial / de clase (4AD – tabla de odios del manual)
 *
 * Monstruos → priorizan ataques extra (y, si pueden, el objetivo) hacia la clase odiada:
 * - Muertos vivientes → clérigo
 * - Orcos / orclings / orc brutes → elfo
 * - Trolls, goblins, kobolds → enano
 * - Minotauro → halfling (nota de perfil)
 *
 * Héroes → bonos de ataque ya modelados en parte en AttackModifiers:
 * - Clérigo: +nivel completo vs undead
 * - Elfo: +1 ataque/hechizo vs orcos (cuando exista la clase)
 * - Enano: +1 Defensa vs troll/ogro/gigante
 */

import { getEnemyTemplate } from '../data/enemyLookup';
import type { EnemyInstance, Hero } from '../types/combat';

export type HatedClass =
  | 'cleric'
  | 'elf'
  | 'dwarf'
  | 'halfling'
  | 'warrior'
  | 'rogue'
  | 'wizard';

export type HateFaction =
  | 'undead'
  | 'orc'
  | 'goblinoid' // goblins, kobolds
  | 'troll'
  | 'minotaur'
  | 'none';

/** Qué clase odia cada facción de monstruo */
export const FACTION_HATES: Record<HateFaction, HatedClass | null> = {
  undead: 'cleric',
  orc: 'elf',
  goblinoid: 'dwarf',
  troll: 'dwarf',
  minotaur: 'halfling',
  none: null,
};

export function classifyEnemyFaction(enemy: EnemyInstance): HateFaction {
  const t = getEnemyTemplate(enemy.templateId);
  const id = (enemy.templateId ?? '').toLowerCase();
  const name = (enemy.name ?? t?.name ?? '').toLowerCase();
  const undead = !!(enemy.isUndead ?? t?.isUndead);

  if (undead || id.includes('mummy') || id.includes('skeleton') || id.includes('zombie')) {
    return 'undead';
  }
  if (id.includes('orc') || name.includes('orc')) return 'orc';
  if (
    id.includes('goblin') ||
    id.includes('kobold') ||
    name.includes('goblin') ||
    name.includes('kobold')
  ) {
    return 'goblinoid';
  }
  if (id.includes('troll') || name.includes('troll')) return 'troll';
  if (id.includes('minotaur') || name.includes('minotaur')) return 'minotaur';
  return 'none';
}

export function hatedClassByEnemy(enemy: EnemyInstance): HatedClass | null {
  return FACTION_HATES[classifyEnemyFaction(enemy)];
}

/** ¿Este héroe es del tipo que odia el monstruo? */
export function enemyHatesHero(enemy: EnemyInstance, hero: Hero): boolean {
  const hated = hatedClassByEnemy(enemy);
  if (!hated) return false;
  return hero.class === hated;
}

/**
 * Héroes vivos odiados por al menos uno de los enemigos del grupo.
 * Si hay varias facciones, se unen todas las clases odiadas presentes.
 */
export function hatedHeroesAmong(
  enemies: EnemyInstance[],
  heroes: Hero[],
): Hero[] {
  const hatedClasses = new Set<HatedClass>();
  for (const e of enemies) {
    const h = hatedClassByEnemy(e);
    if (h) hatedClasses.add(h);
  }
  if (hatedClasses.size === 0) return [];
  return heroes.filter(
    (hero) =>
      !hero.isDead &&
      !hero.isFallen &&
      hero.life > 0 &&
      hatedClasses.has(hero.class as HatedClass),
  );
}

/**
 * Orden para recibir ataques EXTRA (más monstruos que héroes):
 * 1) clases odiadas
 * 2) resto (front / tank según caller)
 */
export function sortHeroesHateFirst(
  heroes: Hero[],
  enemies: EnemyInstance[],
  secondarySort?: (a: Hero, b: Hero) => number,
): Hero[] {
  const hated = new Set(hatedHeroesAmong(enemies, heroes).map((h) => h.id));
  return [...heroes].sort((a, b) => {
    const ah = hated.has(a.id) ? 0 : 1;
    const bh = hated.has(b.id) ? 0 : 1;
    if (ah !== bh) return ah - bh;
    return secondarySort ? secondarySort(a, b) : 0;
  });
}

/**
 * Al elegir un objetivo al azar (boss multiataque), sesgar hacia odiados.
 * 70% del tiempo elige entre odiados si hay alguno vivo.
 */
export function pickHatedBiasedTarget(
  heroes: Hero[],
  enemy: EnemyInstance,
  rng?: () => number,
  excludeIds?: Set<string>,
): Hero | undefined {
  const pool = excludeIds?.size
    ? heroes.filter((h) => !excludeIds.has(h.id))
    : heroes;
  if (pool.length === 0) return undefined;

  const hated = pool.filter((h) => enemyHatesHero(enemy, h));
  const r = rng ? rng() : Math.random();
  const useHated = hated.length > 0 && r < 0.7;
  const use = useHated ? hated : pool;
  const idx = Math.min(use.length - 1, Math.floor((rng ? rng() : Math.random()) * use.length));
  return use[idx];
}

/** Texto corto para el log de combate */
export function hateLogNote(enemies: EnemyInstance[], heroes: Hero[]): string | null {
  const hated = hatedHeroesAmong(enemies, heroes);
  if (hated.length === 0) return null;
  const factions = new Set(enemies.map(classifyEnemyFaction));
  const parts: string[] = [];
  if (factions.has('undead')) {
    parts.push('los muertos vivientes odian a los clérigos');
  }
  if (factions.has('orc')) {
    parts.push('los orcos odian a los elfos');
  }
  if (factions.has('goblinoid') || factions.has('troll')) {
    parts.push('goblins/trolls odian a los enanos');
  }
  if (factions.has('minotaur')) {
    parts.push('el minotauro odia a los halflings');
  }
  const names = hated.map((h) => h.name).join(', ');
  return `Odio: ${parts.join('; ')}. Objetivo prioritario: ${names}.`;
}
