/**
 * Where the faint circuit traces run over the glass: 70 walks at multiples of
 * 45 degrees, each ending in a small round pad at both ends, scattered over the
 * far field and kept clear of the wordmark. It ports the walk loop of the
 * Blender preview (tools/blender/bob_build.py, `random.seed(2006)` and
 * `blocked`), so the site scatters what the approved frames show. It imports
 * nothing from three.
 *
 * Python's `random` cannot be reproduced here, so the walks are drawn from a
 * small seeded generator (mulberry32) instead: the layout is the same every
 * time for a seed, and it keeps the preview's rules, but it is not the
 * preview's own scatter point for point. One rule is stricter: the preview
 * tested each step's end and middle only, which lets a long step clip a corner
 * of a keep-out between its samples; here every step is tested along its whole
 * length.
 *
 * Lengths are world units on the glass (see ~/engine/bob/wordmark): the
 * preview's (x, y) is (x, -z) here, so its scatter from y -7 to 22 is z 7 to
 * -22, mostly away from the camera.
 */
import { type Point2, WORDMARK } from '~/engine/bob/wordmark';

/**
 * The scatter, as the preview has it. `count` traces from `seed`, each of
 * `steps` (a whole number from the first to the second) steps of `segment`
 * length (from the first to the second), starting at a point in `field`. A
 * trace is kept when it has at least 3 points. `margin` is the room kept round
 * the outer ring and round each letter's box. A pad is a ring of `pad.segments`
 * steps and `pad.radius` round each trace's two ends. `tries` is the most
 * starting points the loop will draw; the preview's field is wide and nearly
 * empty, so it never comes near it.
 */
export const TRACE = {
  count: 70,
  seed: 2006,
  steps: [3, 7],
  segment: [0.5, 2.6],
  field: { x: [-15, 15], z: [-22, 7] },
  margin: 0.25,
  pad: { radius: 0.045, segments: 16 },
  tries: 4000
} as const;

/** The scatter: each trace's points in order, and the pads' centres (a trace's first end, then its last). */
export interface TraceLayout {
  traces: readonly Point2[][];
  pads: readonly Point2[];
}

/** A point on the glass, frozen. */
function point(x: number, z: number): Point2 {
  return Object.freeze([x, z] as const);
}

/**
 * mulberry32: a small seeded generator of numbers in [0, 1). A seed that is
 * not a whole number is cut to its low 32 bits as an unsigned integer
 * (`seed >>> 0`), so NaN reads as 0.
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The eight directions of a walk, every 45 degrees from +x round to +z, as
 * exact numbers: the straight ones have an exact zero, so a step along them
 * stays on its line to the last bit.
 */
const DIRECTIONS: readonly Point2[] = Object.freeze([
  point(1, 0),
  point(Math.SQRT1_2, Math.SQRT1_2),
  point(0, 1),
  point(-Math.SQRT1_2, Math.SQRT1_2),
  point(-1, 0),
  point(-Math.SQRT1_2, -Math.SQRT1_2),
  point(0, -1),
  point(Math.SQRT1_2, -Math.SQRT1_2)
]);

/**
 * Whether `p` is clear of the wordmark by `margin`: farther than
 * `outer + margin` from the centre, and outside each B's box (from its back to
 * its width, and from the top to the foot) grown by `margin` on every side. A
 * point exactly on a boundary is clear.
 */
export function clearOfWordmark(p: Point2, margin: number): boolean {
  const [x, z] = p;
  if (Math.hypot(x, z) < WORDMARK.outer + margin) return false;
  const { leftX, rightX, width, nearZ } = WORDMARK.b;
  for (const ox of [leftX, rightX]) {
    if (x > ox - margin && x < ox + width + margin && z > -nearZ - margin && z < nearZ + margin) return false;
  }
  return true;
}

/** The longest gap between the points a step is tested at: far finer than the smallest thing it could clip. */
const SAMPLE_STEP = 0.05;

/** Whether the whole of the segment from `a` to `b` is clear of the wordmark by `margin`, ends included. */
export function segmentClear(a: Point2, b: Point2, margin: number): boolean {
  const samples = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / SAMPLE_STEP));
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    if (!clearOfWordmark([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], margin)) return false;
  }
  return true;
}

/**
 * The traces and pads for `seed`: the preview's walk. From a random start in
 * the field (drawn again if it is not clear), a trace sets off along one of the
 * four straight directions, and after each step turns 45 degrees one way or
 * the other, so its steps alternate between straight and diagonal. It takes
 * 3 to 7 steps of 0.5 to 2.6 and stops short at the first one that would cross
 * the keep-out; it is kept when it has at least 3 points, and gets a pad at
 * each end. The same seed gives the same layout.
 */
export function traceLayout(seed: number = TRACE.seed): TraceLayout {
  const random = mulberry32(seed);
  const uniform = (low: number, high: number): number => low + (high - low) * random();
  const whole = (low: number, high: number): number => low + Math.floor(random() * (high - low + 1));

  const traces: Point2[][] = [];
  const pads: Point2[] = [];
  let tries = 0;
  while (traces.length < TRACE.count && tries < TRACE.tries) {
    tries++;
    let current = point(uniform(TRACE.field.x[0], TRACE.field.x[1]), uniform(TRACE.field.z[0], TRACE.field.z[1]));
    if (!clearOfWordmark(current, TRACE.margin)) continue;
    // Straight directions only to start: every second one of the eight.
    let heading = whole(0, 3) * 2;
    const points: Point2[] = [current];
    const steps = whole(TRACE.steps[0], TRACE.steps[1]);
    for (let s = 0; s < steps; s++) {
      const length = uniform(TRACE.segment[0], TRACE.segment[1]);
      const [dx, dz] = DIRECTIONS[heading];
      const next = point(current[0] + dx * length, current[1] + dz * length);
      if (!segmentClear(current, next, TRACE.margin)) break;
      points.push(next);
      current = next;
      heading = (heading + (random() < 0.5 ? 1 : 7)) % 8;
    }
    if (points.length >= 3) {
      traces.push(Object.freeze(points) as Point2[]);
      pads.push(points[0], points[points.length - 1]);
    }
  }
  return { traces, pads };
}
