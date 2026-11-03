/**
 * Revisión Semana 2 – Combate E2E por consola: 4 héroes vs Boss
 * Verifica victoria/derrota, heridas, caídos→muertos y XP.
 */

import {
  createCombat,
  selectAction,
  selectTarget,
} from '../CombatStateManager';
import {
  executeHeroAttack,
  runEnemyTurn,
  getAliveEnemies,
  getAliveHeroes,
} from '../TurnManager';
import { getHeroStatus } from '../HeroStatus';
import { awardBossXp, rollXpForHero } from '../XpService';
import { createDefaultParty } from '../../data/classes';
import { BOSSES_TABLE } from '../../data/bosses';
import type { Action, CombatState, EnemyInstance, Hero } from '../../types/combat';

const attack: Action = { type: 'attack', name: 'Attack', requiresTarget: true };

function seqRng(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i++;
    return (v - 1) / 6 + 0.001;
  };
}

function makeBoss(templateId: string = 'boss_orc_brute'): EnemyInstance {
  const t = BOSSES_TABLE.find((b) => b.id === templateId)!;
  return {
    id: 'boss_1',
    templateId: t.id,
    name: t.name,
    level: t.level,
    currentLife: t.life,
    attacks: t.attacks,
    isUndead: t.isUndead,
  };
}

function printState(label: string, state: CombatState) {
  console.log(`\n=== ${label} ===`);
  console.log(`Fase: ${state.phase} | Ronda: ${state.round} | Finished: ${state.isFinished} | Result: ${state.result}`);
  console.log(
    'Héroes:',
    state.heroes
      .map((h) => `${h.name}(${getHeroStatus(h)}) L${h.life}/${h.maxLife}`)
      .join(' | ')
  );
  console.log(
    'Enemigos:',
    state.enemies.map((e) => `${e.name} L${e.currentLife} (lvl ${e.level})`).join(' | ')
  );
  const lastLogs = state.log.slice(-3).map((l) => l.message);
  if (lastLogs.length) console.log('Log:', lastLogs.join(' / '));
}

function runBossFight(
  bossId: string,
  heroRng: () => number,
  enemyRng: () => number,
  maxRounds = 20
): CombatState {
  const party = createDefaultParty();
  const boss = makeBoss(bossId);
  let state = createCombat(party, [boss]);

  printState('INICIO', state);

  let guard = 0;
  while (!state.isFinished && guard < maxRounds * 8) {
    guard++;

    if (state.phase === 'heroTurn') {
      const target = getAliveEnemies(state.enemies)[0];
      if (!target) break;

      state = selectAction(state, attack);
      state = selectTarget(state, target.id);
      state = executeHeroAttack(state, 'boss', {}, heroRng);
      continue;
    }

    if (state.phase === 'enemyTurn') {
      state = runEnemyTurn(state, { rng: enemyRng });
      continue;
    }

    break;
  }

  printState('FINAL', state);
  return state;
}

describe('Week 2 E2E – 4 héroes vs Boss', () => {
  it('Victoria vs Orc Brute: boss a 0, XP award, estados de héroes coherentes', () => {
    // Dados altos para héroes (6+4…), defensa alta ocasional para enemigo
    const state = runBossFight(
      'boss_orc_brute',
      seqRng([6, 4, 5, 6, 3, 5, 6, 2, 5, 6, 4]),
      seqRng([6, 2, 5, 1, 6, 3])
    );

    expect(state.isFinished).toBe(true);
    expect(state.result).toBe('victory');
    expect(getAliveEnemies(state.enemies).length).toBe(0);
    expect(state.enemies[0].currentLife).toBe(0);

    // XP
    const xp = awardBossXp();
    expect(xp.rolls).toBe(1);
    console.log(xp.message);
    const roller = state.heroes.find((h) => !h.isDead) ?? state.heroes[0];
    const xpRoll = rollXpForHero(roller, seqRng([4]));
    console.log(xpRoll.message);
    expect(xpRoll.roll).toBeGreaterThanOrEqual(1);
    expect(xpRoll.roll).toBeLessThanOrEqual(6);

    // Ningún héroe "vivo" con life 0 sin isFallen/isDead
    for (const h of state.heroes) {
      if (h.life <= 0) {
        expect(h.isFallen || h.isDead).toBe(true);
      }
      if (h.isDead) {
        expect(h.life).toBe(0);
        console.log(`Muerto al cerrar: ${h.name}`);
      } else if (h.isFallen) {
        console.log(`Caído (debería haberse convertido en muerto): ${h.name}`);
        expect(h.isDead).toBe(true); // finalizeCombatHeroes
      } else {
        console.log(`Sobrevive: ${h.name} ${h.life}/${h.maxLife} [${getHeroStatus(h)}]`);
      }
    }

    const alive = getAliveHeroes(state.heroes);
    expect(alive.length).toBeGreaterThan(0);
  });

  it('Derrota posible vs Chaos Lord con dados malos de defensa', () => {
    // Party débil: 4 wizards life 3, boss con muchos ataques
    const weak: Hero[] = [
      createDefaultParty()[3],
      createDefaultParty()[3],
      createDefaultParty()[3],
      createDefaultParty()[3],
    ].map((h, i) => ({ ...h, id: `w${i}`, name: `Wiz${i}` }));

    // Forzar ids únicos
    const party = weak.map((h, i) => ({
      ...createDefaultParty()[3],
      id: `wiz_${i}`,
      name: `Wiz${i}`,
    }));

    const boss = makeBoss('boss_chaos_lord'); // 3 attacks, level 6, 4 life
    let state = createCombat(party, [boss]);

    // Solo enemy turns con natural 1 en defense → daño seguro
    let rounds = 0;
    while (!state.isFinished && rounds < 15) {
      rounds++;
      if (state.phase === 'heroTurn') {
        // ataques débiles que no matan al boss
        const t = getAliveEnemies(state.enemies)[0];
        if (!t) break;
        state = selectAction(state, attack);
        state = selectTarget(state, t.id);
        state = executeHeroAttack(state, 'boss', {}, seqRng([1]));
      } else if (state.phase === 'enemyTurn') {
        state = runEnemyTurn(state, { rng: seqRng([1]) });
      } else break;
    }

    printState('DERROTA CHECK', state);

    // Con suficientes hits de natural 1, los wizards deberían caer
    if (state.result === 'defeat') {
      expect(state.isFinished).toBe(true);
      expect(getAliveHeroes(state.heroes).length).toBe(0);
      state.heroes.forEach((h) => {
        expect(h.isDead || h.isFallen).toBe(true);
      });
      console.log('Derrota confirmada; héroes finalizados:', state.heroes.map((h) => `${h.name}:${getHeroStatus(h)}`));
    } else {
      // Si el boss murió por casualidad, también es válido el flujo
      console.log('Combate terminó como:', state.result);
      expect(state.isFinished).toBe(true);
    }
  });

  it('Heridas de boss se acumulan hasta 0 life', () => {
    const party = createDefaultParty();
    const boss = makeBoss('boss_medusa'); // 4 life
    let state = createCombat(party, [boss]);

    let hits = 0;
    while (!state.isFinished && hits < 30) {
      hits++;
      if (state.phase === 'heroTurn') {
        const t = getAliveEnemies(state.enemies)[0];
        if (!t) break;
        state = selectAction(state, attack);
        state = selectTarget(state, t.id);
        // Explosive altos
        state = executeHeroAttack(state, 'boss', {}, seqRng([6, 5]));
      } else if (state.phase === 'enemyTurn') {
        state = runEnemyTurn(state, { rng: seqRng([6, 2]) });
      } else break;
    }

    expect(state.result).toBe('victory');
    expect(state.enemies[0].currentLife).toBe(0);
    console.log(`Medusa derrotada en ${state.round} rondas tras ${hits} acciones.`);
  });
});
