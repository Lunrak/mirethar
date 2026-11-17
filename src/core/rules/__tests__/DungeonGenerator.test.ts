/**
 * Tests – generación de mazmorra (entradas, puertas, límites 28×20)
 */

import {
  createDungeon,
  openDoor,
  movePartyTo,
  listExplorableDoors,
  doorsFromPartyCell,
  rollShapeBeyondDoor,
  noteEncounterCleared,
  acceptPendingQuest,
  turnInQuestOnMap,
  ENTRANCES,
} from '../DungeonGenerator';
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  inBounds,
  entranceAnchor,
  cellKey,
} from '../../types/dungeon';
import { rollAndAcceptQuest, advanceAllQuests } from '../QuestService';

/** rng que devuelve dados 1–6 en secuencia */
function seqRng(faces: number[]): () => number {
  let i = 0;
  return () => {
    const v = faces[i % faces.length];
    i += 1;
    return (v - 1) / 6 + 0.001;
  };
}

describe('Mapa 28×20 y ancla de entrada', () => {
  test('dimensiones fijas', () => {
    expect(MAP_WIDTH).toBe(28);
    expect(MAP_HEIGHT).toBe(20);
  });

  test('inBounds respeta bordes', () => {
    expect(inBounds(0, 0)).toBe(true);
    expect(inBounds(27, 19)).toBe(true);
    expect(inBounds(-1, 0)).toBe(false);
    expect(inBounds(28, 0)).toBe(false);
    expect(inBounds(0, 20)).toBe(false);
  });

  test('entrada en centro inferior', () => {
    const a = entranceAnchor();
    expect(a.x).toBe(Math.floor(MAP_WIDTH / 2));
    expect(a.y).toBe(MAP_HEIGHT - 1);
  });
});

describe('createDungeon – 6 entradas', () => {
  test.each(ENTRANCES.map((e) => [e.id, e.name] as const))(
    'entrada %i (%s) genera celdas reveladas dentro del mapa',
    (id) => {
      const map = createDungeon(id);
      expect(map.entranceId).toBe(id);
      const cells = Object.values(map.cells);
      expect(cells.length).toBeGreaterThan(0);
      for (const c of cells) {
        expect(inBounds(c.x, c.y)).toBe(true);
        expect(c.revealed).toBe(true);
      }
      const entrance = cells.find((c) => c.isEntrance);
      expect(entrance).toBeDefined();
      expect(map.partyCellId).toBe(entrance!.id);
    },
  );

  test('createDungeon sin id usa d6', () => {
    const map = createDungeon(undefined, seqRng([3]));
    expect(map.entranceId).toBe(3);
  });

  test('puertas iniciales no apuntan fuera del mapa', () => {
    for (const e of ENTRANCES) {
      const map = createDungeon(e.id);
      for (const d of Object.values(map.doors)) {
        const cell = map.cells[d.cellId];
        expect(cell).toBeDefined();
        const { DIR_DELTA } = require('../../types/dungeon');
        const nx = cell.x + DIR_DELTA[d.dir].dx;
        const ny = cell.y + DIR_DELTA[d.dir].dy;
        expect(inBounds(nx, ny)).toBe(true);
        expect(d.state).not.toBe('blocked');
      }
    }
  });
});

describe('rollShapeBeyondDoor', () => {
  test('1–2 pasillo corto (1 casilla)', () => {
    const s = rollShapeBeyondDoor('N', seqRng([1]));
    expect(s.kind).toBe('corridor');
    expect(s.offsets.length).toBe(1);
  });

  test('3–4 pasillo largo (3 casillas)', () => {
    const s = rollShapeBeyondDoor('N', seqRng([3]));
    expect(s.kind).toBe('corridor');
    expect(s.offsets.length).toBe(3);
  });

  test('5 sala 2×2', () => {
    const s = rollShapeBeyondDoor('N', seqRng([5]));
    expect(s.kind).toBe('room');
    expect(s.offsets.length).toBe(4);
  });

  test('6 sala 3×2', () => {
    const s = rollShapeBeyondDoor('N', seqRng([6]));
    expect(s.kind).toBe('room');
    expect(s.offsets.length).toBe(6);
  });
});

describe('openDoor', () => {
  test('abre puerta y añade casillas reveladas', () => {
    const map = createDungeon(1);
    const doors = listExplorableDoors(map);
    expect(doors.length).toBeGreaterThan(0);
    // Forzar pasillo corto
    const result = openDoor(map, doors[0].id, seqRng([1, 1, 1, 1, 1, 1]));
    expect(result.newCellIds.length).toBeGreaterThan(0);
    for (const id of result.newCellIds) {
      expect(result.map.cells[id]).toBeDefined();
      expect(result.map.cells[id].revealed).toBe(true);
      expect(inBounds(result.map.cells[id].x, result.map.cells[id].y)).toBe(
        true,
      );
    }
    expect(result.message).toMatch(/puerta|pasillo|sala|Contenido/i);
  });

  test('puerta ya explorada solo mueve al grupo', () => {
    let map = createDungeon(1);
    const door = listExplorableDoors(map)[0];
    const first = openDoor(map, door.id, seqRng([1, 1, 1]));
    map = first.map;
    const again = openDoor(map, door.id, seqRng([1]));
    expect(again.newCellIds).toEqual([]);
    expect(again.message).toMatch(/ya explorada/i);
  });

  test('movePartyTo solo a casillas reveladas', () => {
    const map = createDungeon(1);
    const other = Object.values(map.cells).find(
      (c) => c.id !== map.partyCellId,
    );
    if (!other) return;
    const moved = movePartyTo(map, other.id, seqRng([6]));
    expect(moved.map.partyCellId).toBe(other.id);
    expect(moved.revisited).toBe(true);
    const blocked = movePartyTo(map, '99,99');
    expect(blocked.map.partyCellId).toBe(map.partyCellId);
  });

  test('doorsFromPartyCell lista puertas de la casilla actual', () => {
    const map = createDungeon(1);
    const doors = doorsFromPartyCell(map);
    for (const d of doors) {
      expect(d.cellId).toBe(map.partyCellId);
    }
  });
});

describe('Límites del mapa al generar', () => {
  test('generar hacia el sur desde la entrada bloquea o no sale del mapa', () => {
    // Entrada en y=19; cualquier generación S está fuera
    let map = createDungeon(1);
    const entrance = Object.values(map.cells).find((c) => c.isEntrance)!;
    // Inyectar puerta fantasma al sur
    const doorId = 'door_south_test';
    map = {
      ...map,
      cells: {
        ...map.cells,
        [entrance.id]: {
          ...entrance,
          doors: [...entrance.doors, 'S'],
        },
      },
      doors: {
        ...map.doors,
        [doorId]: {
          id: doorId,
          cellId: entrance.id,
          dir: 'S',
          state: 'closed',
        },
      },
    };
    const result = openDoor(map, doorId, seqRng([1]));
    expect(result.newCellIds.length).toBe(0);
    expect(result.map.doors[doorId].state).toBe('blocked');
    expect(result.message).toMatch(/límite|espacio|camino/i);
  });
});

describe('Quests integradas en dungeon', () => {
  test('acceptPendingQuest añade a quests[]', () => {
    const map = createDungeon(1);
    const offer = rollAndAcceptQuest(map.partyCellId, seqRng([2]));
    const next = acceptPendingQuest(map, offer);
    expect(next.quests!.length).toBe(1);
    expect(next.quests![0].templateId).toBe(offer.templateId);
    expect(next.quests![0].giverCellId).toBe(map.partyCellId);
  });

  test('noteEncounterCleared avanza misiones clear_encounters', () => {
    let map = createDungeon(1);
    const offer = rollAndAcceptQuest(map.partyCellId, seqRng([2])); // plaga / encuentros
    // Forzar goal clear_encounters
    const forced = {
      ...offer,
      goalType: 'clear_encounters' as const,
      target: 1,
      progress: 0,
      status: 'active' as const,
    };
    map = acceptPendingQuest(map, forced);
    map = noteEncounterCleared(map);
    const q = map.quests![0];
    expect(q.progress).toBe(1);
    expect(q.status).toBe('ready_to_turn_in');
  });

  test('turnInQuestOnMap solo en giverCellId y aplica oro', () => {
    let map = createDungeon(1);
    const offer = rollAndAcceptQuest(map.partyCellId, seqRng([1]));
    const forced = {
      ...offer,
      status: 'ready_to_turn_in' as const,
      progress: offer.target,
      reward: { gold: 40, itemHint: 'Test item' },
    };
    map = acceptPendingQuest(map, forced);
    // Aceptar resetea progress — re-forzar ready
    map = {
      ...map,
      quests: map.quests!.map((q) => ({
        ...q,
        status: 'ready_to_turn_in' as const,
        progress: q.target,
        reward: { gold: 40, itemHint: 'Test item' },
      })),
    };
    const { map: done, message } = turnInQuestOnMap(
      map,
      map.quests![0].instanceId,
    );
    expect(done.quests![0].status).toBe('completed');
    expect(done.goldFound).toBe(40);
    expect(done.lootItems).toContain('Test item');
    expect(message).toMatch(/Recompensa|gp/i);
  });

  test('no entrega si no estás en el cuarto del dador', () => {
    let map = createDungeon(1);
    const other = Object.values(map.cells).find(
      (c) => c.id !== map.partyCellId,
    );
    const offer = rollAndAcceptQuest(map.partyCellId, seqRng([1]));
    map = acceptPendingQuest(map, {
      ...offer,
      status: 'ready_to_turn_in',
      progress: 99,
    });
    map = {
      ...map,
      quests: map.quests!.map((q) => ({
        ...q,
        status: 'ready_to_turn_in' as const,
        progress: q.target,
      })),
    };
    if (other) map = movePartyTo(map, other.id, seqRng([6])).map;
    if (map.partyCellId === map.quests![0].giverCellId) {
      // mapa de una sola celda útil — skip
      return;
    }
    const { map: same, message } = turnInQuestOnMap(
      map,
      map.quests![0].instanceId,
    );
    expect(same.quests![0].status).toBe('ready_to_turn_in');
    expect(message).toMatch(/cuarto|objetivo/i);
  });
});

describe('Revisita y emboscada', () => {
  test('d6=1 genera emboscada de minions', () => {
    const map = createDungeon(1);
    const other = Object.values(map.cells).find((c) => c.id !== map.partyCellId);
    if (!other) return;
    const result = movePartyTo(map, other.id, seqRng([1, 1, 1, 1]));
    expect(result.revisited).toBe(true);
    expect(result.ambush).not.toBeNull();
    expect(result.ambush!.type).toBe('minion');
    expect(result.message).toMatch(/Emboscada|d6=1/i);
  });

  test('d6≠1 no genera emboscada', () => {
    const map = createDungeon(1);
    const other = Object.values(map.cells).find((c) => c.id !== map.partyCellId);
    if (!other) return;
    const result = movePartyTo(map, other.id, seqRng([3]));
    expect(result.ambush).toBeNull();
    expect(result.message).toMatch(/sin encuentro/i);
  });
});
