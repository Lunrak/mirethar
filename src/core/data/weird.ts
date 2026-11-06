/**
 * Weird Monsters table (d6) – Manual básico Four Against Darkness
 * Fuente: GDD §4 + 4AD Revised p.38
 * Equivalen a bosses para XP (excepto Invisible Gremlins).
 */

import type { EnemyTemplate } from '../types/combat';

export const WEIRD_TABLE: EnemyTemplate[] = [
  {
    id: 'weird_minotaur',
    name: 'Minotaur',
    type: 'weird',
    level: 5,
    life: 4,
    attacks: 2,
    treasureModifier: 0,
    specialRules: [
      'Due to the power of his bull-rush charge, the first Defense roll against a minotaur is at -1.',
      'Minotaurs love to eat halflings. Halflings may not use Luck in an encounter with a Minotaur.',
      'Bribe: 60 gp',
    ],
    reactions: {
      1: 'bribe',
      2: 'bribe',
      3: 'fight',
      4: 'fight',
      5: 'fight',
      6: 'fight_to_death',
    },
  },
  {
    id: 'weird_iron_eater',
    name: 'Iron Eater',
    type: 'weird',
    level: 3,
    life: 4,
    attacks: 3,
    treasureModifier: -99,
    specialRules: [
      'Defense rolls against the iron eater do not enjoy bonus from heavy armor (shield and light armor count).',
      'If the monster hits, the character takes no damage but loses his armor, shield, main weapon, or 3d6 gp, in this order.',
      'Bribe: d6 gp (no fools’ gold)',
    ],
    reactions: {
      1: 'flee',
      2: 'bribe',
      3: 'bribe',
      4: 'fight',
      5: 'fight',
      6: 'fight',
    },
  },
  {
    id: 'weird_chimera',
    name: 'Chimera',
    type: 'weird',
    level: 5,
    life: 6,
    attacks: 3,
    treasureModifier: 0,
    specialRules: [
      'On every of the chimera’s turns, roll d6. On a 1 or 2 the chimera breathes fire instead of performing multiple attacks.',
      'All characters must save versus level 4 fire or lose 1 life.',
      'Bribe: 50 gp',
    ],
    reactions: {
      1: 'bribe',
      2: 'fight',
      3: 'fight',
      4: 'fight',
      5: 'fight',
      6: 'fight',
    },
  },
  {
    id: 'weird_catoblepas',
    name: 'Catoblepas',
    type: 'weird',
    level: 4,
    life: 4,
    attacks: 1,
    treasureModifier: 1,
    specialRules: [
      'All characters at the beginning of the battle must save versus a level 4 gaze attack or lose 1 life.',
    ],
    reactions: {
      1: 'flee',
      2: 'fight',
      3: 'fight',
      4: 'fight',
      5: 'fight',
      6: 'fight',
    },
  },
  {
    id: 'weird_giant_spider',
    name: 'Giant Spider',
    type: 'weird',
    level: 5,
    life: 3,
    attacks: 2,
    treasureModifier: 0, // 2 treasure rolls — simplificado a normal
    specialRules: [
      'Characters taking a wound must save versus level 3 poison or lose an additional life.',
      'Due to the spider’s webbing, the party may not withdraw from this fight unless they cast a Fireball spell to burn the webs.',
      'Always fight.',
    ],
    reactions: {
      1: 'always_fight',
      2: 'always_fight',
      3: 'always_fight',
      4: 'always_fight',
      5: 'always_fight',
      6: 'always_fight',
    },
  },
  {
    id: 'weird_invisible_gremlins',
    name: 'Invisible Gremlins',
    type: 'weird',
    level: 0,
    life: 0,
    attacks: 0,
    treasureModifier: -99,
    specialRules: [
      'A band of invisible gremlins steal d6+3 objects from the party.',
      'Surrender objects in this order: magic items, scrolls, potions, weapons, gems, coins (bundles of 10 gp).',
      'If they steal ALL equipment, they leave a thank you message that counts as a clue.',
      'Impossible to fight. Encountering them gives no XP roll.',
    ],
    reactions: {
      1: 'flee',
      2: 'flee',
      3: 'flee',
      4: 'flee',
      5: 'flee',
      6: 'flee',
    },
  },
];
