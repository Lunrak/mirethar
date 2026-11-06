/**
 * Resultados post-combate – Core Loop GDD §2
 * Experiencia, heridas, muertes, botín temporal.
 */

import { finalizeFallenHeroes, getHeroStatus } from './HeroStatus';
import { awardBossXp, awardWeirdXp, rollXpForHero, type XpAward, type XpRollResult } from './XpService';
import { rollTreasure, type TreasureResult } from './TreasureService';
import type { CombatState, EnemyTemplate, Hero } from '../types/combat';

export type HeroOutcome = {
  id: string;
  name: string;
  class: Hero['class'];
  status: 'alive' | 'wounded' | 'fallen' | 'dead';
  life: number;
  maxLife: number;
  /** Vida perdida respecto al máximo al inicio del combate (aprox) */
  woundsTaken: number;
};

export type CombatResultsSummary = {
  result: 'victory' | 'defeat';
  rounds: number;
  heroes: HeroOutcome[];
  newlyDead: HeroOutcome[];
  wounded: HeroOutcome[];
  survivors: HeroOutcome[];
  xpAward: XpAward | null;
  xpRoll: XpRollResult | null;
  treasure: TreasureResult | null;
  logTail: string[];
};

export type BuildResultsOptions = {
  /** Plantilla del encuentro (para botín y tipo de XP) */
  encounterTemplate?: Pick<EnemyTemplate, 'name' | 'type' | 'treasureModifier'> | null;
  /** Héroe elegido para tirar XP (por defecto el primero vivo / herido) */
  xpHeroId?: string | null;
  rng?: () => number;
};

/**
 * Construye el resumen de resultados a partir del CombatState final.
 * Aplica finalizeFallenHeroes si aún no se hizo (caídos → muertos).
 */
export function buildCombatResults(
  state: CombatState,
  opts: BuildResultsOptions = {}
): CombatResultsSummary {
  const { encounterTemplate = null, xpHeroId = null, rng } = opts;

  // Asegurar caídos → muertos al cerrar
  let heroes = state.heroes.map((h) => ({ ...h }));
  if (state.isFinished) {
    const fin = finalizeFallenHeroes(heroes);
    heroes = fin.heroes;
  }

  const outcomes: HeroOutcome[] = heroes.map((h) => {
    const status = getHeroStatus(h);
    return {
      id: h.id,
      name: h.name,
      class: h.class,
      status,
      life: h.life,
      maxLife: h.maxLife,
      woundsTaken: Math.max(0, h.maxLife - Math.max(0, h.life)),
    };
  });

  const newlyDead = outcomes.filter((h) => h.status === 'dead');
  const wounded = outcomes.filter((h) => h.status === 'wounded');
  const survivors = outcomes.filter((h) => h.status === 'alive' || h.status === 'wounded');

  const result: 'victory' | 'defeat' =
    state.result === 'victory' ? 'victory' : 'defeat';

  // XP solo en victoria y según tipo de encuentro
  let xpAward: XpAward | null = null;
  let xpRoll: XpRollResult | null = null;

  if (result === 'victory' && encounterTemplate) {
    if (encounterTemplate.type === 'boss') {
      xpAward = awardBossXp();
    } else if (encounterTemplate.type === 'weird') {
      xpAward = awardWeirdXp();
    }
    // minion/vermin: sin tirada inmediata en MVP (tally fuera de alcance)

    if (xpAward && xpAward.rolls > 0) {
      const pool = heroes.filter((h) => !h.isDead);
      const pick =
        (xpHeroId && pool.find((h) => h.id === xpHeroId)) ||
        pool[0] ||
        heroes[0];
      if (pick) {
        xpRoll = rollXpForHero(pick, rng);
      }
    }
  }

  // Botín solo en victoria
  let treasure: TreasureResult | null = null;
  if (result === 'victory' && encounterTemplate) {
    treasure = rollTreasure(encounterTemplate, rng);
  }

  return {
    result,
    rounds: state.round,
    heroes: outcomes,
    newlyDead,
    wounded,
    survivors,
    xpAward,
    xpRoll,
    treasure,
    logTail: state.log.slice(-8).map((e) => e.message),
  };
}
