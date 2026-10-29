/**
 * The falling light's trail as circuit traces, as plain numbers (spec 2026-10-29-bob-stack-2-design.md, goal 4: "the
 * trail like it belongs to the tech domain"; the fall mock-up Bob chose, `circuit`): five lanes beside the light's way,
 * routed as a board's are, straight runs that jog at 45°, a via at each jog's end, and pulses running down them into the
 * light. Pure, as the journey is: the light's model (src/engine/bob/build/light.ts) lays them each frame from the pose's
 * trail, and the tests read the same lanes.
 *
 * The mock-up's light was a frame 1.24 m across (`MOCK_HALF` each way); the site's is the pose's `radius`, a few
 * centimetres, so a lane's place across the way and its width are the mock-up's times `radius / MOCK_HALF`. The routing
 * is laid down the world's height once and for all (`routeOf`, at `ROUTE.unit` site metres a mock-up metre), so a jog
 * stays at its height as the light falls past it and nothing crawls.
 */
import type { TrailPoint } from './lightDive';

type Vec3 = [number, number, number];

/** The mock-up's light's half size, m: the frame's half-width there. */
export const MOCK_HALF = 0.62;

/** The five lanes, the mock-up's: across the way (m), in depth (m) and wide (m), the middle one under the light. */
export const LANES: readonly (readonly [number, number, number])[] = [
  [0, 0, 0.042],
  [-1.6, -0.4, 0.026],
  [1.5, 0.3, 0.026],
  [-3.1, -1.1, 0.02],
  [3, -0.9, 0.02]
];

/** How far up its light carries, the mock-up's m: the middle lane's further. */
export const LANE_FADE: readonly number[] = [22, 16, 16, 16, 16];

/**
 * The routing, in the mock-up's metres: each straight run 3 to 8 long, each jog 0.35 to 0.8 across and as far down (45°),
 * kept within 0.9 of its lane; `unit` site metres a mock-up metre (the light's size at the hand-over, against the
 * mock-up's); laid from `top` down to `bottom` (world m), round the whole of the fall and the column on the CPU.
 */
export const ROUTE = { run: [3, 8] as const, jog: [0.35, 0.8] as const, keep: 0.9, unit: 0.13, top: 80, bottom: -240 } as const;

/** A stretch of a lane's routing down the world's height: a run (`jog` false, `from` = `to`) or a 45° jog. */
export interface RouteStretch {
  top: number;
  bottom: number;
  /** The lane's place across the way at the stretch's top and bottom, mock-up m (its own `dx` included). */
  from: number;
  to: number;
  jog: boolean;
}

/** A lane laid beside the trail: its points (world), how far each is up the way from the light (m), its width and its vias. */
export interface TraceLane {
  points: Vec3[];
  above: number[];
  width: number;
  /** How far up it carries its light, m (`LANE_FADE` at the light's size). */
  fade: number;
  vias: Vec3[];
}

/** A seeded generator, 0..1 (the mock-up's tracePath's). */
function stepper(seed: number): () => number {
  let k = seed;
  return () => {
    k = (k * 9301 + 49297) % 233280;
    return k / 233280;
  };
}

const routes = new Map<string, RouteStretch[]>();

/** Lane `lane`'s routing down the world's height, for `seed`: made once, kept. */
export function routeOf(lane: number, seed: number): RouteStretch[] {
  const key = `${lane}:${seed}`;
  const kept = routes.get(key);
  if (kept) return kept;
  const dx = LANES[lane]![0];
  const rand = stepper(17 + lane * 31 + seed * 101);
  const out: RouteStretch[] = [];
  let y: number = ROUTE.top;
  let off = dx;
  while (y > ROUTE.bottom) {
    const run = (ROUTE.run[0] + rand() * (ROUTE.run[1] - ROUTE.run[0])) * ROUTE.unit;
    out.push({ top: y, bottom: y - run, from: off, to: off, jog: false });
    y -= run;
    const jog = (rand() < 0.5 ? -1 : 1) * (ROUTE.jog[0] + rand() * (ROUTE.jog[1] - ROUTE.jog[0]));
    const next = Math.max(dx - ROUTE.keep, Math.min(dx + ROUTE.keep, off + jog));
    const drop = Math.abs(next - off) * ROUTE.unit;
    if (drop > 0) {
      out.push({ top: y, bottom: y - drop, from: off, to: next, jog: true });
      y -= drop;
    }
    off = next;
  }
  routes.set(key, out);
  return out;
}

/** The lane's place across the way at world height `y`, mock-up m. */
function offsetAt(route: RouteStretch[], y: number): number {
  for (const s of route) {
    if (y > s.top || y < s.bottom) continue;
    if (!s.jog) return s.from;
    return s.from + ((s.to - s.from) * (s.top - y)) / (s.top - s.bottom);
  }
  return route.at(-1)?.to ?? 0;
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/**
 * The five lanes beside `trail` (the light's past places, newest first, ./lightDive.ts), for a light of `radius` seen
 * with the camera's `right` (world, unit): each lane `dx` across the way along `right` and `dz` in depth, at the light's
 * size, routed by `routeOf(lane, seed)`; a point added at each of the routing's turns within the trail, so a jog is sharp
 * however far apart the trail's points are; a via at each jog's end within it. Empty for a trail of fewer than two points.
 */
export function circuitLanes(trail: readonly TrailPoint[], radius: number, right: readonly [number, number, number], seed = 7): TraceLane[] {
  const scale = radius / MOCK_HALF;
  const r: Vec3 = [right[0], right[1], right[2]];
  const rl = len(r) || 1;
  r[0] /= rl;
  r[1] /= rl;
  r[2] /= rl;
  // In depth: across the way the other side, level (right x up).
  const depth: Vec3 = [-r[2], 0, r[0]];
  return LANES.map(([, dz, width], k) => {
    const lane: TraceLane = { points: [], above: [], width: width * scale, fade: LANE_FADE[k]! * scale, vias: [] };
    if (trail.length < 2) return lane;
    const route = routeOf(k, seed);
    // The trail with a point at each of the routing's turns between two of its points.
    const base: { at: Vec3; above: number }[] = [];
    let run = 0;
    for (let i = 0; i < trail.length; i++) {
      const p = trail[i]!.point as Vec3;
      if (i > 0) {
        const q = trail[i - 1]!.point as Vec3;
        const lo = Math.min(p[1], q[1]);
        const hi = Math.max(p[1], q[1]);
        // Each turn once: a stretch's bottom is the next one's top.
        const turns = [...new Set(route.map((s) => s.bottom))].filter((y) => y > lo && y < hi);
        turns.sort((a, b) => (p[1] > q[1] ? a - b : b - a));
        for (const y of turns) {
          const at = lerp3(q, p, (y - q[1]) / (p[1] - q[1]));
          base.push({ at, above: run + len(sub(at, q)) });
        }
        run += len(sub(p, q));
      }
      base.push({ at: p, above: run });
    }
    const jogEnds = new Set(route.filter((s) => s.jog).map((s) => s.bottom));
    for (const { at, above } of base) {
      const off = offsetAt(route, at[1]) * scale;
      const point: Vec3 = [at[0] + r[0] * off + depth[0] * dz * scale, at[1] + r[1] * off, at[2] + r[2] * off + depth[2] * dz * scale];
      lane.points.push(point);
      lane.above.push(above);
      if (jogEnds.has(at[1])) lane.vias.push(point);
    }
    return lane;
  });
}

/** A pulse's place on a trace `above` m up from the light at `clock` s, 0..1: its phase runs down toward the light. */
export function pulseAt(above: number, clock: number, phase: number): number {
  const x = above * 0.07 + clock * 0.55 + phase;
  return x - Math.floor(x);
}
