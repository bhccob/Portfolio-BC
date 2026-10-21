/**
 * The v3 compass's measurements: the four glass rings that float over the
 * glowing chip, the hub they ring round, and the 64 hexagrams of the outer
 * ring. One table that the 3D parts and the tests read, so they cannot drift
 * apart. It imports nothing from three.
 *
 * It keeps the dial's frame (src/engine/instrument/dialSpec.ts): the compass
 * lies in its local XZ plane with north -Z and east +X, and a bearing is
 * degrees clockwise from north. Every y here is a height above the compass's
 * own plane (y = 0), in world units, so the rings read as separate layers.
 */
import { DIAL } from '~/engine/instrument/dialSpec';

/** The four glass rings, from the hub outwards. */
export type RingId = 'trigram' | 'direction' | 'degree' | 'hexagram';

/** One glass ring: its radii, how high it floats and how thick the glass is. */
export interface GlassRing {
  id: RingId;
  /** Inner radius, dial-local world units. */
  inner: number;
  /** Outer radius, dial-local world units. */
  outer: number;
  /** Height of the ring's mid-plane above the compass plane. */
  y: number;
  /** The glass's thickness, so its edge catches the light. */
  thickness: number;
}

/**
 * The glass rings, inside out. They take the radii of DIAL.rings, so the
 * v3 compass keeps the proportions of the dial it replaces (the outer
 * "pattern" ring becomes the hexagram ring). Each floats at its own height
 * so the four read as separate layers and not one flat disc, and the gaps
 * between them (0.02) are wide enough for the light underneath to show.
 */
export const GLASS_RINGS: readonly GlassRing[] = [
  { id: 'trigram', inner: DIAL.rings.trigram[0], outer: DIAL.rings.trigram[1], y: 0.036, thickness: 0.018 },
  { id: 'direction', inner: DIAL.rings.direction[0], outer: DIAL.rings.direction[1], y: 0.012, thickness: 0.018 },
  { id: 'degree', inner: DIAL.rings.degree[0], outer: DIAL.rings.degree[1], y: 0.024, thickness: 0.018 },
  { id: 'hexagram', inner: DIAL.rings.pattern[0], outer: DIAL.rings.pattern[1], y: 0.0, thickness: 0.018 }
];

/**
 * The hub the rings sit round, where the needle's pin stands: a radius
 * smaller than the innermost ring's inner edge, and the height of its top.
 */
export const HUB = { radius: 0.2, y: 0.05 } as const;

/** One hexagram's six lines, from the bottom (innermost) to the top: 1 is whole, 0 is broken. */
export type HexLines = readonly [0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1];

/**
 * The hexagram numbered k, 0..63: bit i of k is line i counted from the
 * bottom, and 1 is a whole line. This is the binary (Shao Yong / Fu Xi)
 * sequence placed round the ring, not a claim of a specific traditional
 * circular diagram. The ring is there because it mirrors the chip's 64 pins:
 * one hexagram per pin, 64 and 64.
 *
 * @throws RangeError when k is not an integer in 0..63.
 */
export function hexagramLines(k: number): HexLines {
  if (!Number.isInteger(k) || k < 0 || k > 63) throw new RangeError(`hexagram k must be an integer in 0..63, got ${k}`);
  const bit = (i: number): 0 | 1 => (((k >> i) & 1) as 0 | 1);
  return [bit(0), bit(1), bit(2), bit(3), bit(4), bit(5)];
}

/**
 * All 64 hexagrams in order, hexagram k at bearing k * 360 / 64 degrees
 * (5.625 apart) clockwise from north, so 0 (all broken) stands due north.
 */
export const HEXAGRAMS: readonly { k: number; bearing: number; lines: HexLines }[] = Array.from({ length: 64 }, (_, k) => ({
  k,
  bearing: (k * 360) / 64,
  lines: hexagramLines(k)
}));
