/**
 * Mapa de sprites para combate – Four Against Darkness
 * Carpeta: src/assets/sprites/{vermin|minions|bosses|weird|heroes}/
 * Nombre: {key}_{idle|attack|defend}.png
 *
 * Pose:
 * - idle   → En espera
 * - attack → Atacando (quien ejecuta la acción)
 * - defend → Recibiendo ataque (quien recibe el impacto)
 */

export type SpritePose = 'idle' | 'attack' | 'defend';

export type SpriteRef = {
  folder: 'vermin' | 'minions' | 'bosses' | 'weird' | 'heroes';
  key: string;
};

/** templateId → sprite */
export const ENEMY_SPRITE: Record<string, SpriteRef> = {
  // Vermin
  vermin_rats: { folder: 'vermin', key: 'rats' },
  vermin_vampire_bats: { folder: 'vermin', key: 'vampire_bat' },
  vermin_goblin_swarmlings: { folder: 'vermin', key: 'small_goblin' },
  vermin_giant_centipedes: { folder: 'vermin', key: 'giant_centipede' },
  vermin_vampire_frogs: { folder: 'vermin', key: 'vampire_frog' },
  vermin_skeletal_rats: { folder: 'vermin', key: 'skeleton_rat' },

  // Minions
  minion_skeletons_zombies: { folder: 'minions', key: 'skeletons' }, // o zombies según d6
  minion_goblins: { folder: 'minions', key: 'goblin' },
  minion_hobgoblins: { folder: 'minions', key: 'hobgoblin' },
  minion_orcs: { folder: 'minions', key: 'orc' },
  minion_trolls: { folder: 'minions', key: 'troll' },
  minion_fungi_folk: { folder: 'minions', key: 'fungi_folk' },

  // Bosses
  boss_mummy: { folder: 'bosses', key: 'mummy' },
  boss_orc_brute: { folder: 'bosses', key: 'orc_brute' },
  boss_ogre: { folder: 'bosses', key: 'ogre' },
  boss_medusa: { folder: 'bosses', key: 'medusa' },
  boss_chaos_lord: { folder: 'bosses', key: 'chaos_lord' },
  boss_small_dragon: { folder: 'bosses', key: 'small_dragon' },

  // Weird
  weird_minotaur: { folder: 'weird', key: 'minotaur' },
  weird_iron_eater: { folder: 'weird', key: 'iron_eater' },
  weird_chimera: { folder: 'weird', key: 'chimera' },
  weird_catoblepas: { folder: 'weird', key: 'catoblepas' },
  weird_giant_spider: { folder: 'weird', key: 'giant_spider' },
  weird_invisible_gremlins: { folder: 'weird', key: 'invisible_gremlins' },
};

/** clase → sprite (variante _m por defecto; cambia a _f si quieres género) */
export const HERO_SPRITE: Record<string, SpriteRef> = {
  warrior: { folder: 'heroes', key: 'warrior_m' },
  rogue: { folder: 'heroes', key: 'rogue_m' },
  cleric: { folder: 'heroes', key: 'cleric_m' },
  wizard: { folder: 'heroes', key: 'wizard_m' },
};

/** Calcula la pose según actor e impacto del zoom */
export function resolvePose(
  unitId: string,
  impactActorId: string | null | undefined,
  impactTargetId: string | null | undefined,
): SpritePose {
  if (impactActorId && unitId === impactActorId) return 'attack';
  if (impactTargetId && unitId === impactTargetId) return 'defend';
  return 'idle';
}

export function getEnemySprite(templateId: string): SpriteRef | null {
  return ENEMY_SPRITE[templateId] ?? null;
}

export function getHeroSprite(heroClass: string): SpriteRef | null {
  return HERO_SPRITE[heroClass] ?? null;
}

/** Ruta relativa desde el componente (ajusta si mueves la carpeta) */
export function spritePath(ref: SpriteRef, pose: SpritePose): string {
  return `../../../assets/sprites/${ref.folder}/${ref.key}_${pose}.png`;
}
