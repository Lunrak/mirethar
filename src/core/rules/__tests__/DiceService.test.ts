import { rollWithExplosiveSix, rollD6 } from '../DiceService';

/**
 * Helper: crea un generador determinista a partir de una secuencia de valores 1-6.
 * Cada llamada a rng() consume el siguiente valor de la lista.
 */
function createSequenceRng(sequence: number[]): () => number {
  let index = 0;
  return () => {
    if (index >= sequence.length) {
      throw new Error(`Se agotó la secuencia de tiradas (índice ${index})`);
    }
    // Convertimos el valor 1-6 a un float [0,1) que produzca exactamente ese resultado
    // Math.floor(rng() * 6) + 1 === valor
    const value = sequence[index++];
    return (value - 1) / 6 + 0.0001; // pequeño offset para evitar problemas de redondeo
  };
}

describe('DiceService – rollWithExplosiveSix (GDD §7.3)', () => {
  // -------------------------------------------------------
  // 1. Tirada normal (sin 6)
  // -------------------------------------------------------
  test('tirada normal: no sale 6 → isExplosive false, explosive vacío', () => {
    const rng = createSequenceRng([4]);
    const result = rollWithExplosiveSix(rng);

    expect(result.raw).toBe(4);
    expect(result.explosive).toEqual([]);
    expect(result.total).toBe(4);
    expect(result.isExplosive).toBe(false);
  });

  test('tirada normal: 1, 2, 3 y 5 también son normales', () => {
    for (const face of [1, 2, 3, 5]) {
      const result = rollWithExplosiveSix(createSequenceRng([face]));
      expect(result.raw).toBe(face);
      expect(result.explosive).toEqual([]);
      expect(result.total).toBe(face);
      expect(result.isExplosive).toBe(false);
    }
  });

  // -------------------------------------------------------
  // 2. Un solo 6
  // -------------------------------------------------------
  test('un 6 seguido de no-6 → isExplosive true, un dado extra', () => {
    const rng = createSequenceRng([6, 3]);
    const result = rollWithExplosiveSix(rng);

    expect(result.raw).toBe(6);
    expect(result.explosive).toEqual([3]);
    expect(result.total).toBe(9);
    expect(result.isExplosive).toBe(true);
  });

  // -------------------------------------------------------
  // 3. Varios 6 seguidos
  // -------------------------------------------------------
  test('varios 6 seguidos (6,6,2)', () => {
    const rng = createSequenceRng([6, 6, 2]);
    const result = rollWithExplosiveSix(rng);

    expect(result.raw).toBe(6);
    expect(result.explosive).toEqual([6, 2]);
    expect(result.total).toBe(14);
    expect(result.isExplosive).toBe(true);
  });

  test('tres 6 seguidos + 5 (6,6,6,5)', () => {
    const rng = createSequenceRng([6, 6, 6, 5]);
    const result = rollWithExplosiveSix(rng);

    expect(result.raw).toBe(6);
    expect(result.explosive).toEqual([6, 6, 5]);
    expect(result.total).toBe(23);
    expect(result.isExplosive).toBe(true);
  });

  // -------------------------------------------------------
  // 4. Caso extremo: muchos 6
  // -------------------------------------------------------
  test('caso extremo: 10 seises seguidos + un 1', () => {
    const sequence = Array(10).fill(6).concat([1]);
    const rng = createSequenceRng(sequence);
    const result = rollWithExplosiveSix(rng);

    expect(result.raw).toBe(6);
    expect(result.explosive).toHaveLength(10); // 9 seises + el 1 final
    expect(result.explosive.filter((n) => n === 6)).toHaveLength(9);
    expect(result.explosive[result.explosive.length - 1]).toBe(1);
    expect(result.total).toBe(10 * 6 + 1); // 61
    expect(result.isExplosive).toBe(true);
  });

  test('caso extremo: 20 seises + 4', () => {
    const sequence = Array(20).fill(6).concat([4]);
    const rng = createSequenceRng(sequence);
    const result = rollWithExplosiveSix(rng);

    expect(result.raw).toBe(6);
    expect(result.explosive).toHaveLength(20);
    expect(result.total).toBe(20 * 6 + 4); // 124
    expect(result.isExplosive).toBe(true);
  });
});

describe('DiceService – rollD6', () => {
  test('siempre devuelve un entero entre 1 y 6', () => {
    for (let i = 0; i < 100; i++) {
      const value = rollD6();
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(6);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  test('con rng controlado produce el valor esperado', () => {
    expect(rollD6(createSequenceRng([1]))).toBe(1);
    expect(rollD6(createSequenceRng([6]))).toBe(6);
    expect(rollD6(createSequenceRng([3]))).toBe(3);
  });
});
