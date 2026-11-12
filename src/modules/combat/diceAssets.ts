/**
 * Caras del d6 – PNGs 192×192 en src/assets/dice/
 * Metro exige require() estático.
 */

import type { ImageSourcePropType } from 'react-native';

export const DICE_FACES: Record<number, ImageSourcePropType> = {
  1: require('../../assets/dice/d6_1.png'),
  2: require('../../assets/dice/d6_2.png'),
  3: require('../../assets/dice/d6_3.png'),
  4: require('../../assets/dice/d6_4.png'),
  5: require('../../assets/dice/d6_5.png'),
  6: require('../../assets/dice/d6_6.png'),
};

export const DICE_UNKNOWN: ImageSourcePropType = require('../../assets/dice/d6_unknown.png');

/** Normaliza cualquier total a cara 1–6 (para mostrar imagen). */
export function toDiceFace(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const n = Math.round(value);
  if (n >= 1 && n <= 6) return n;
  // totales con mods / explosive: mapear a cara visible
  const mod = ((n - 1) % 6) + 1;
  return mod > 0 ? mod : 6;
}
