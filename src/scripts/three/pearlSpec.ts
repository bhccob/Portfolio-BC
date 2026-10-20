/**
 * The pearl's numbers that the loader's drawing (CompassLoader) and the live
 * scene (Pearl, CompassScene) must share for the hand-over between them to be
 * unseen: how its position eases toward where it wants to be, where it rests
 * without a pointer, and how close to the pivot it stops steering the needle.
 * One table for both, so neither can drift from the other. It imports
 * nothing, so the loader's bundle runs it before three.js has loaded.
 *
 * Positions are CSS pixels relative to the canvas; times are seconds.
 */

/** The pearl eases toward where it wants to be at this rate (λ of an exponential ease, as three's MathUtils.damp). */
export const PEARL_EASE = 10;

/** It rests `offset` dial diameters right of and below the dial's centre, kept `margin` px inside the canvas. */
export const PEARL_REST = { offset: 0.42, margin: 24 } as const;

/** No bearing within this share of the rim's radius of the pivot: the needle would spin on the spot. */
export const DEAD_ZONE = 0.15;

/** `from` eased `dt` seconds toward `to` (MathUtils.damp's formula at PEARL_EASE). */
export function easePearl(from: number, to: number, dt: number): number {
  return from + (to - from) * (1 - Math.exp(-PEARL_EASE * dt));
}

/** `value` kept PEARL_REST.margin inside [0, size]; a canvas too small for the margin gets its middle. */
export function inside(value: number, size: number): number {
  const { margin } = PEARL_REST;
  return size > 2 * margin ? Math.min(size - margin, Math.max(margin, value)) : size / 2;
}

/**
 * Where the pearl rests on a `width` × `height` canvas for a dial centred at
 * (x, y) with a rim `diameter` across: (x + 0.42 D, y + 0.42 D), kept 24 px
 * inside the canvas. `turn` (0..1; the loader leaves it out) takes it round
 * under the dial, at the same distance from its centre, to the mirrored spot
 * (x − 0.42 D, y + 0.42 D) at 1: the hard drive's actuator stands at the
 * lower right, and the pearl rests clear of it. Out of range is held to
 * 0..1, and NaN reads as 0.
 */
export function restAt(x: number, y: number, diameter: number, width: number, height: number, turn = 0): [number, number] {
  const t = turn > 0 ? Math.min(1, turn) : 0;
  const reach = PEARL_REST.offset * diameter;
  if (t === 0) return [inside(x + reach, width), inside(y + reach, height)];
  // From the lower right (45° below the right) round through straight below to the lower left.
  const a = (Math.PI / 4) * (1 + 2 * t);
  return [inside(x + (reach * Math.cos(a)) / Math.SQRT1_2, width), inside(y + (reach * Math.sin(a)) / Math.SQRT1_2, height)];
}
