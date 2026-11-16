/**
 * Quest Table (d6) – misiones que ofrece un PNJ en la mazmorra
 * Textos originales para el MVP; estructura tipo tabla 4AD.
 */

export type QuestGoalType =
  | 'open_doors'
  | 'clear_encounters'
  | 'explore_rooms'
  | 'find_treasure';

export type QuestReward = {
  gold: number;
  /** Texto libre de botín extra */
  itemHint?: string;
  xpHint?: string;
};

export type QuestTemplate = {
  /** 1–6 */
  roll: number;
  id: string;
  /** Nombre corto de la misión */
  title: string;
  /** Quién la ofrece */
  giverName: string;
  /** Rol del PNJ */
  giverRole: string;
  /** Texto que dice el personaje al dar la misión */
  dialogue: string;
  goalType: QuestGoalType;
  /** Cantidad objetivo del contador */
  target: number;
  /** Descripción del objetivo para la UI */
  goalText: string;
  reward: QuestReward;
  /** Mensaje al completar */
  completeDialogue: string;
};

export const QUEST_TABLE: QuestTemplate[] = [
  {
    roll: 1,
    id: 'quest_lost_heirloom',
    title: 'La reliquia perdida',
    giverName: 'Marta',
    giverRole: 'Peregrina herida',
    dialogue:
      'Por favor… unos bandidos me arrebataron la medalla de mi orden en estas salas. No os pido que me venguéis: solo que exploréis y me traigáis noticias o la medalla. Volved a este cuarto cuando hayáis registrado bastantes estancias.',
    goalType: 'explore_rooms',
    target: 3,
    goalText: 'Revelar 3 salas nuevas',
    reward: { gold: 30, itemHint: 'Bendición menor (+1 a una tirada de Defense hoy)' },
    completeDialogue:
      '¡La medalla! O al menos sabéis dónde buscarla. Tomad estas monedas; que los dioses os guarden.',
  },
  {
    roll: 2,
    id: 'quest_rat_infestation',
    title: 'Plaga en los pasillos',
    giverName: 'Corbin',
    giverRole: 'Guardia del gremio',
    dialogue:
      'El gremio pagará si limpiáis la plaga. Cada nido de alimañas o grupo hostil que abatáis cuenta. Cuando hayáis librado varios combates, volved aquí y os pagaré.',
    goalType: 'clear_encounters',
    target: 2,
    goalText: 'Resolver 2 encuentros',
    reward: { gold: 40, xpHint: '1 marca de experiencia para un héroe' },
    completeDialogue:
      'Menos alimañas, menos problemas. Aquí tenéis la recompensa del gremio.',
  },
  {
    roll: 3,
    id: 'quest_map_the_dark',
    title: 'Cartografiar la oscuridad',
    giverName: 'Ilen',
    giverRole: 'Cartógrafo',
    dialogue:
      'Necesito un croquis de más puertas y tramos. Abrid caminos nuevos y volved a este cuarto. Pagaré por cada avance que me describáis.',
    goalType: 'open_doors',
    target: 4,
    goalText: 'Abrir 4 puertas nuevas',
    reward: { gold: 25, itemHint: 'Pergamino de mapa (pista de una puerta secreta)' },
    completeDialogue:
      'Con estas notas podré completar el plano. Gracias; tomad vuestro pago.',
  },
  {
    roll: 4,
    id: 'quest_tax_chest',
    title: 'El cofre del peaje',
    giverName: 'Sera',
    giverRole: 'Comerciante atrapada',
    dialogue:
      'Dejé un cofre con el peaje del camino en alguna sala. Si encontráis tesoros y me los confirmáis aquí, compartiré el hallazgo. No me atrevo a seguir sola.',
    goalType: 'find_treasure',
    target: 2,
    goalText: 'Encontrar 2 tesoros',
    reward: { gold: 50, itemHint: 'Poción de curación (1 uso)' },
    completeDialogue:
      'Sabía que había más oro en estas ruinas. Aquí está vuestra parte… y una poción por las molestias.',
  },
  {
    roll: 5,
    id: 'quest_escort_promise',
    title: 'Promesa de escolta',
    giverName: 'Padre Alden',
    giverRole: 'Clérigo errante',
    dialogue:
      'No puedo abandonar este altar hasta saber que el camino es seguro. Abrid rutas y limpiad amenazas; cuando el progreso sea suficiente, volved y os bendeciré con una ofrenda.',
    goalType: 'open_doors',
    target: 3,
    goalText: 'Abrir 3 puertas nuevas',
    reward: { gold: 20, itemHint: 'Agua bendita (útil vs undead)' },
    completeDialogue:
      'El camino es más seguro gracias a vosotros. Aceptad esta ofrenda y mi gratitud.',
  },
  {
    roll: 6,
    id: 'quest_goblin_toll',
    title: 'El peaje de los goblins',
    giverName: 'Rusk',
    giverRole: 'Mercenario cansado',
    dialogue:
      'Los goblins y su calaña controlan varios tramos. Si les dais una lección en combate un par de veces, pagaré lo que me queda de contrato. Volved a este mismo cuarto.',
    goalType: 'clear_encounters',
    target: 3,
    goalText: 'Resolver 3 encuentros',
    reward: { gold: 60, xpHint: '1 marca de experiencia para el grupo' },
    completeDialogue:
      'Habéis hecho el trabajo sucio. Aquí está el oro del contrato. Yo me vuelvo al pueblo.',
  },
];

export function questByRoll(roll: number): QuestTemplate {
  return QUEST_TABLE.find((q) => q.roll === roll) ?? QUEST_TABLE[0];
}
