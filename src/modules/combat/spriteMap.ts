/**
 * Mapa de sprites para combate – Four Against Darkness
 * Carpeta: src/assets/sprites/{vermin|minions|bosses|weird|heroes}/
 * Nombre: {key}_{idle|attack|defend|dead}.png
 * dead = muerto / huido (192×192)
 *
 * Pose:
 * - idle   → En espera
 * - attack → Atacando (quien ejecuta la acción)
 * - defend → Recibiendo ataque (quien recibe el impacto)
 */

export type SpritePose = 'idle' | 'attack' | 'defend' | 'dead';

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

/**
 * Convención de sprites de héroe (192×192):
 * - {class}_f_{idle|attack|defend}  → sano (life === maxLife)
 * - {class}_m_{idle|attack|defend}  → herido (0 < life < maxLife)
 * - {class}_dead                    → caído / muerto (life <= 0)
 * - {class}_stone                   → petrificado
 */
export const HERO_SPRITE: Record<string, SpriteRef> = {
  warrior: { folder: 'heroes', key: 'warrior_f' },
  rogue: { folder: 'heroes', key: 'rogue_f' },
  cleric: { folder: 'heroes', key: 'cleric_f' },
  wizard: { folder: 'heroes', key: 'wizard_f' },
};

export type HeroSpriteStatus = 'healthy' | 'wounded' | 'dead' | 'stone';

/** Estado visual del héroe a partir de life / flags / status */
export function getHeroSpriteStatus(hero: {
  life: number;
  maxLife: number;
  isFallen?: boolean;
  isDead?: boolean;
  status?: { id: string }[];
}): HeroSpriteStatus {
  const statuses = hero.status ?? [];
  if (statuses.some((s) => s.id === 'petrified' || s.id === 'stone')) {
    return 'stone';
  }
  if (hero.isDead || hero.isFallen || hero.life <= 0) {
    return 'dead';
  }
  if (hero.life < hero.maxLife) {
    return 'wounded';
  }
  return 'healthy';
}

/**
 * Clave de archivo bajo heroes/:
 * - stone/dead → "cleric_stone" / "cleric_dead" (sin pose)
 * - healthy/wounded → "cleric_f" / "cleric_m" (+ pose en getSpriteSource)
 */
export function getHeroSpriteKey(
  heroClass: string,
  status: HeroSpriteStatus,
): { key: string; usePose: boolean } {
  if (status === 'stone') return { key: `${heroClass}_stone`, usePose: false };
  if (status === 'dead') return { key: `${heroClass}_dead`, usePose: false };
  if (status === 'wounded') return { key: `${heroClass}_m`, usePose: true };
  return { key: `${heroClass}_f`, usePose: true };
}

/** Calcula la pose según actor e impacto del zoom */
export function resolvePose(
  unitId: string,
  impactActorId: string | null | undefined,
  impactTargetId: string | null | undefined,
  /** Si la unidad está muerta o ha huido → pose dead */
  isDown?: boolean,
): SpritePose {
  if (isDown) return 'dead';
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

/** Ref concreta según estado (para UI). */
export function getHeroSpriteRef(
  heroClass: string,
  status: HeroSpriteStatus,
): SpriteRef {
  const { key } = getHeroSpriteKey(heroClass, status);
  return { folder: 'heroes', key };
}

/** Ruta relativa desde el componente (ajusta si mueves la carpeta) */
export function spritePath(ref: SpriteRef, pose: SpritePose): string {
  return `../../../assets/sprites/${ref.folder}/${ref.key}_${pose}.png`;
}
