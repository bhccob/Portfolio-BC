/**
 * The compass loader's arithmetic (CompassLoader): how much has loaded, the
 * percentage it reads, when it settles or gives up, the searching needle and
 * the bearing of a point on the screen. Pure, and it imports nothing from
 * three, gsap or lenis, so it runs in the small entry bundle before three.js
 * has arrived.
 */

/**
 * The load's parts and their shares of the readout (scene: the three.js chunk
 * with the controller; textures and warm: CompassScene.onLoad), and the
 * timings in seconds: shown at least `minShow`, given up at `giveUp` without
 * the scene ready, `settle` for the needle to turn onto the pearl, `fade` for
 * the drawing to give way to the live scene.
 */
export const LOADING = {
  weights: { scene: 0.45, textures: 0.25, warm: 0.3 },
  minShow: 1.2,
  giveUp: 10,
  settle: 0.45,
  fade: 0.25
} as const;

export type LoadShare = keyof typeof LOADING.weights;

/** The session's mark that the loader has played: from then on the compass starts without it. */
export const SEEN_KEY = 'bob-compass-seen';

/** The readout's top speed, in shares per second. */
const READOUT_RATE = 1.5;

/** The searching needle: degrees per second, and a wobble of this many degrees at this rate (rad/s). */
const HUNT = { speed: 220, wobble: 35, rate: 2.3 } as const;

/** The pearl's rest spot sits this many rim diameters right of and below the rim's centre, this many px inside the screen (Pearl's restSpot). */
const REST = { offset: 0.42, margin: 24 } as const;

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/** How much of the load is done, 0..1: each part's share (clamped to 0..1, missing as 0) by its weight. */
export function loadedShare(parts: Partial<Record<LoadShare, number>>): number {
  let total = 0;
  for (const part of Object.keys(LOADING.weights) as LoadShare[]) total += LOADING.weights[part] * clamp01(parts[part] ?? 0);
  // Rounded, so a whole load is exactly 1 whatever the sum's rounding (the readout shows 100 only at 1).
  return Math.min(1, Math.round(total * 1e6) / 1e6);
}

/**
 * The readout `dt` seconds on from `shown`, toward `target` at no more than
 * 1.5 a second. It never counts down, and it reads 1 only when `target` is 1.
 */
export function readout(shown: number, target: number, dt: number): number {
  const from = clamp01(shown);
  const to = clamp01(target);
  if (!(to > from) || !(dt > 0)) return from;
  return Math.min(to, from + READOUT_RATE * Math.min(dt, 1));
}

/**
 * What the loader does `elapsed` seconds in: settle once the scene is ready
 * and the minimum has passed, give up at ten seconds without it, else wait.
 */
export function loaderVerdict(elapsed: number, ready: boolean): 'wait' | 'settle' | 'give-up' {
  if (ready) return elapsed >= LOADING.minShow ? 'settle' : 'wait';
  return elapsed >= LOADING.giveUp ? 'give-up' : 'wait';
}

/** The searching needle `t` seconds in, degrees clockwise from north: 220·t + 35·sin(2.3·t). */
export function huntAt(t: number): number {
  return HUNT.speed * t + HUNT.wobble * Math.sin(HUNT.rate * t);
}

/** How fast the searching needle turns `t` seconds in, degrees per second (huntAt's derivative). */
export function huntRate(t: number): number {
  return HUNT.speed + HUNT.wobble * HUNT.rate * Math.cos(HUNT.rate * t);
}

/** The bearing of a screen offset (dx right, dy down) from a centre: radians clockwise from screen north, atan2(dx, −dy). */
export function screenBearing(dx: number, dy: number): number {
  return Math.atan2(dx, -dy);
}

/**
 * Where the loader's pearl rests without a pointer (a touch screen, or a
 * mouse that has not moved): right of and below the rim's centre (x, y) by
 * 0.42 of its `diameter`, kept 24 px inside a `width` × `height` screen, as
 * the scene's pearl rests by its dial (Pearl's restSpot).
 */
export function restAt(x: number, y: number, diameter: number, width: number, height: number): [number, number] {
  const inside = (value: number, size: number): number =>
    size > 2 * REST.margin ? Math.min(size - REST.margin, Math.max(REST.margin, value)) : size / 2;
  return [inside(x + REST.offset * diameter, width), inside(y + REST.offset * diameter, height)];
}
