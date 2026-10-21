/**
 * The 64 circuit traces of the v3 opening: one runs out from each of the
 * chip's pins across the board, and when the chip powers up each one lifts off
 * the board and bends into an arc just under one of the compass's glass rings.
 * Both shapes are 48 points sampled at equal steps along their length, so the
 * trace can be drawn as one line whose points slide from the board path to the
 * ring arc and every part of it moves at the same pace. Pure, and it imports
 * nothing from three, so the tests read exactly the numbers the scene draws.
 *
 * Lengths are world units and the frame is the dial's (see
 * src/engine/instrument/dialSpec.ts): north -Z, east +X, a bearing in degrees
 * clockwise from north. A path is a flat `Float32Array` of 48 x, y, z triples.
 */
import { bearingOf, DIAL, onDial } from '~/engine/instrument/dialSpec';
import { CHIP, pinPosition } from '~/engine/v3/chipSpec';
import { GLASS_RINGS } from '~/engine/v3/compassSpec';

/** How many traces there are (one to a pin) and how many points each path has, board or ring alike. */
export const TRACE = { count: 64, points: 48 } as const;

/** How the traces are routed on the board, all in world units except the delay. */
const ROUTE = {
  /** The straight run out from the pin before the outermost trace of a side first leans. */
  run: 0.04,
  /** How much later each trace nearer the middle of its side starts leaning than the one outside it, so the bends nest. */
  stagger: 0.04,
  /** The gap between neighbouring traces once they have fanned out: wider than the pins' own pitch. */
  pitch: 0.035,
  /** Where the traces stop: the radius of the nearest end, and how much farther the farthest runs on (both inside 0.75..0.98). */
  endNear: 0.78,
  endSpan: 0.18
} as const;

/** How the move from board to ring is staged across the traces. */
const STAGGER = {
  /** Traces are held in groups of this many starting times, by `i % 8`. */
  groups: 8,
  /** The last group waits this share of the move before it starts. */
  delay: 0.35
} as const;

/** The ring arc lies this far under its ring's mid-plane: half the glass's 0.018 thickness, so it hugs the underside. */
const BELOW_RING = 0.009;

/** `x` held to [0, 1]; NaN reads as 0. */
function clamp01(x: number): number {
  return x > 0 ? (x < 1 ? x : 1) : 0;
}

/** Perlin's smootherstep: 0 at 0 and 1 at 1, with no slope at either end, so a trace starts and settles softly. */
function smootherstep(x: number): number {
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/**
 * Checks that `i` is a trace's index.
 *
 * @throws RangeError when i is not an integer in 0..63. `pinPosition` has no such guard and answers NaN for a bad index, which would sit in a buffer unseen.
 */
function assertTrace(i: number): void {
  if (!Number.isInteger(i) || i < 0 || i >= TRACE.count) throw new RangeError(`trace index must be an integer in 0..${TRACE.count - 1}, got ${i}`);
}

/**
 * Which way trace `i` leans, along the side's clockwise direction: -1 for the
 * counter-clockwise half of its side's 16 pins (the first eight), +1 for the
 * clockwise half. The board path fans out this way. Its far end still turns
 * the other way round the compass, toward the middle of the side's bearing
 * (a straight run out from a square side converges on the side's normal), so
 * the ring arc unfolds against the lean (see `arc`).
 */
function leanOf(i: number): -1 | 1 {
  return i % CHIP.pinsPerSide < CHIP.pinsPerSide / 2 ? -1 : 1;
}

type Point3 = readonly [x: number, y: number, z: number];

/**
 * Samples a polyline at `TRACE.points` equal steps along its length. The first
 * and last points are the polyline's own ends, copied, not computed. A bend
 * falls between two samples and is cut by that chord, which at 48 points is
 * finer than the line is wide.
 */
function resample(route: readonly Point3[]): Float32Array {
  const cumulative = [0];
  for (let k = 1; k < route.length; k++) {
    cumulative.push(cumulative[k - 1] + Math.hypot(route[k][0] - route[k - 1][0], route[k][1] - route[k - 1][1], route[k][2] - route[k - 1][2]));
  }
  const total = cumulative[cumulative.length - 1];
  const out = new Float32Array(TRACE.points * 3);
  let seg = 0;
  for (let k = 0; k < TRACE.points; k++) {
    if (k === TRACE.points - 1) {
      out.set(route[route.length - 1], k * 3);
      break;
    }
    const d = (total * k) / (TRACE.points - 1);
    while (cumulative[seg + 1] < d) seg++;
    const f = (d - cumulative[seg]) / (cumulative[seg + 1] - cumulative[seg]);
    for (let c = 0; c < 3; c++) out[k * 3 + c] = route[seg][c] + (route[seg + 1][c] - route[seg][c]) * f;
  }
  return out;
}

/**
 * The corners of trace `i` on the board, from the pin's outer end: straight
 * out, a 45 degree lean away from the middle of its side, straight out again
 * to its end. Written along the side (`s` outward from the chip's axis, `u`
 * sideways, clockwise) and turned into x, z at the end.
 *
 * A trace leans for `rank` times the extra gap it is to gain (`ROUTE.pitch`
 * less the pins' own pitch), with rank 0 for the two at the middle of a side
 * (they run straight) up to 7 at its ends, so the 16 traces of a side fan out
 * evenly. The outer ones lean first and the inner ones later, so the 45 degree
 * runs are parallel and never cross, and a lean keeps a trace in the wedge of
 * the board in front of its own side, so two sides never meet at a corner. The
 * end radius differs trace to trace, so no two end together.
 */
function route(i: number): Point3[] {
  const pin = pinPosition(i);
  // The side's outward normal, and the clockwise direction along it (the normal turned a quarter clockwise).
  const nx = pin.side === 'right' ? 1 : pin.side === 'left' ? -1 : 0;
  const nz = pin.side === 'bottom' ? 1 : pin.side === 'top' ? -1 : 0;
  const tx = -nz;
  const tz = nx;
  const push = CHIP.pinLength / 2;
  const startX = pin.x + nx * push;
  const startZ = pin.z + nz * push;
  const s0 = startX * nx + startZ * nz;
  const u0 = startX * tx + startZ * tz;

  const j = i % CHIP.pinsPerSide;
  const half = CHIP.pinsPerSide / 2;
  const rank = j < half ? half - 1 - j : j - half;
  const lean = leanOf(i);
  const pinPitch = CHIP.size / CHIP.pinsPerSide;
  const jog = rank * (ROUTE.pitch - pinPitch);
  const s1 = s0 + ROUTE.run + (half - 1 - rank) * ROUTE.stagger;
  const s2 = s1 + jog;
  const u2 = u0 + lean * jog;
  const end = ROUTE.endNear + (ROUTE.endSpan * ((i * 7) % CHIP.pinsPerSide)) / (CHIP.pinsPerSide - 1);
  const s3 = Math.sqrt(end * end - u2 * u2);

  const corners: [number, number][] = [
    [s0, u0],
    [s1, u0],
    [s2, u2],
    [s3, u2]
  ];
  const points: Point3[] = [];
  for (const [s, u] of corners) {
    const point: Point3 = [s * nx + u * tx, CHIP.board, s * nz + u * tz];
    const last = points[points.length - 1];
    // Rank 0 does not lean, so its second and third corners are one point.
    if (!last || last[0] !== point[0] || last[2] !== point[2]) points.push(point);
  }
  return points;
}

/**
 * The ring arc of trace `i`: `TRACE.points` points at equal angles on the gilt
 * rule `i % 4`, spanning `360 / 16` degrees round the pin's bearing. It runs
 * against the trace's lean, which is the way its board path's far end turns
 * round the compass from its pin (toward the middle of the side), so each
 * point slides to the part of the arc on its own side. (Run with the lean,
 * all 64 arcs swept against their board paths and every trace folded through
 * itself in an X halfway through the circuit, as Task 12a's stills showed.)
 */
function arc(i: number): Float32Array {
  const pin = pinPosition(i);
  const centre = (bearingOf(pin.x, pin.z) * 180) / Math.PI;
  const span = 360 / CHIP.pinsPerSide;
  const ring = i % 4;
  const lean = leanOf(i);
  const out = new Float32Array(TRACE.points * 3);
  // Equal steps of angle on a circle are equal steps of length, so there is nothing to resample.
  for (let k = 0; k < TRACE.points; k++) {
    const [x, z] = onDial(centre - lean * (-span / 2 + (span * k) / (TRACE.points - 1)), DIAL.rules[ring]);
    out.set([x, GLASS_RINGS[ring].y - BELOW_RING, z], k * 3);
  }
  return out;
}

/** The paths are built once, on first use: `tracePoints` runs for 64 traces every frame. */
const boards: (Float32Array | undefined)[] = [];
const arcs: (Float32Array | undefined)[] = [];

function boardOf(i: number): Float32Array {
  return (boards[i] ??= resample(route(i)));
}

function arcOf(i: number): Float32Array {
  return (arcs[i] ??= arc(i));
}

/**
 * Where trace `i` (0..63) runs on the board, 48 points as x, y, z: from the
 * outer end of pin `i` (its centre pushed out by half the pin's length) on the
 * board plane `y = CHIP.board`, outward in straight runs with 45 degree bends,
 * the way a PCB is routed, to an end between radius 0.75 and 0.98. The
 * traces of one side fan out, and each ends at its own radius, so none lies on
 * another. It is routed by index alone, so it is the same every time.
 *
 * Returns a copy, so a caller may write to it.
 *
 * @throws RangeError when i is not an integer in 0..63.
 */
export function boardPath(i: number): Float32Array {
  assertTrace(i);
  return boardOf(i).slice();
}

/**
 * Where trace `i` (0..63) ends up, 48 points as x, y, z: an arc at the radius
 * of gilt rule `i % 4` (`DIAL.rules`) and 0.009 under the height of ring
 * `i % 4`, so it lies on the underside of the glass. It is centred on the
 * bearing of pin `i` and spans 360 / 16 = 22.5 degrees. From its first point
 * to its last it turns round the compass the way the trace's board path does
 * from the pin to its far end (clockwise for a pin in the first half of its
 * side, counter-clockwise in the second), so a trace keeps its handedness
 * while it changes shape instead of folding through itself.
 *
 * Returns a copy, so a caller may write to it.
 *
 * @throws RangeError when i is not an integer in 0..63.
 */
export function ringPath(i: number): Float32Array {
  assertTrace(i);
  return arcOf(i).slice();
}

/**
 * Trace `i` at `t` (0..1, NaN reads as 0) of the opening's move from board to
 * ring, written into `out` (48 x, y, z triples, so at least 144 numbers) and
 * returned. Trace `i` starts after a delay of `(i % 8) / 8 * 0.35`, so the
 * traces peel off the board in waves, and eases with smootherstep over the
 * rest of the move, so it starts and settles softly. At the start and the end
 * of its own move the board path and the ring arc are copied as they are,
 * not computed, so the ends match `boardPath` and `ringPath` bit for bit.
 *
 * @throws RangeError when i is not an integer in 0..63.
 */
export function tracePoints(i: number, t: number, out: Float32Array): Float32Array {
  assertTrace(i);
  const from = boardOf(i);
  const to = arcOf(i);
  const delay = ((i % STAGGER.groups) / STAGGER.groups) * STAGGER.delay;
  const local = clamp01((t - delay) / (1 - delay));
  if (local === 0) {
    out.set(from);
  } else if (local === 1) {
    out.set(to);
  } else {
    const eased = smootherstep(local);
    for (let n = 0; n < from.length; n++) out[n] = from[n] + (to[n] - from[n]) * eased;
  }
  return out;
}
