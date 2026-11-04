import { describe, expect, it } from 'vitest';
import { circuitLanes, LANES, MOCK_HALF, pulseAt, ROUTE, routeOf } from '~/scene/bob/circuit';
import type { TrailPoint } from '~/scene/bob/lightDive';

type Vec3 = [number, number, number];
/** A light of the routing's own size: one mock-up metre is ROUTE.unit of the site's. */
const RADIUS = ROUTE.unit * MOCK_HALF;
const SCALE = RADIUS / MOCK_HALF;
const RIGHT: Vec3 = [1, 0, 0];
/** A straight trail standing `height` m above a light at `y`, `n` points, newest (the light) first. */
const trail = (y: number, height = 3, n = 60): TrailPoint[] => Array.from({ length: n }, (_, k) => ({ point: [0, y + (k / (n - 1)) * height, 0] as Vec3, u: k / (n - 1) }));
/** A lane's point's offset across the trail (along RIGHT), m. */
const across = (p: Vec3): number => p[0];

// The falling light's trail as circuit traces (spec 2026-10-29-bob-stack-2-design.md, goal 4; the fall mock-up's
// `circuit`): five lanes beside the light's way, straight runs jogging at 45°, a via at each jog's end, pulses running
// down into the light.
describe('the circuit', () => {
  /** The lanes as they were laid before the routes were indexed, reading every stretch for each point: what must not change. */
  const laidTheLongWay = (t: TrailPoint[], radius: number, right: Vec3, seed = 7) => {
    const scale = radius / MOCK_HALF;
    const rl = Math.hypot(...right) || 1;
    const r: Vec3 = [right[0] / rl, right[1] / rl, right[2] / rl];
    const depth: Vec3 = [-r[2], 0, r[0]];
    const offsetAt = (route: ReturnType<typeof routeOf>, y: number): number => {
      for (const s of route) {
        if (y > s.top || y < s.bottom) continue;
        return s.jog ? s.from + ((s.to - s.from) * (s.top - y)) / (s.top - s.bottom) : s.from;
      }
      return route.at(-1)?.to ?? 0;
    };
    return LANES.map(([, dz], k) => {
      const route = routeOf(k, seed);
      const points: Vec3[] = [];
      const above: number[] = [];
      const vias: Vec3[] = [];
      const base: { at: Vec3; above: number }[] = [];
      let run = 0;
      for (let i = 0; i < t.length; i++) {
        const p = t[i]!.point as Vec3;
        if (i > 0) {
          const q = t[i - 1]!.point as Vec3;
          const lo = Math.min(p[1], q[1]);
          const hi = Math.max(p[1], q[1]);
          const turns = [...new Set(route.map((s) => s.bottom))].filter((y) => y > lo && y < hi);
          turns.sort((a, b) => (p[1] > q[1] ? a - b : b - a));
          for (const y of turns) {
            const u = (y - q[1]) / (p[1] - q[1]);
            const at: Vec3 = [q[0] + (p[0] - q[0]) * u, q[1] + (p[1] - q[1]) * u, q[2] + (p[2] - q[2]) * u];
            base.push({ at, above: run + Math.hypot(at[0] - q[0], at[1] - q[1], at[2] - q[2]) });
          }
          run += Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
        }
        base.push({ at: p, above: run });
      }
      const jogEnds = new Set(route.filter((s) => s.jog).map((s) => s.bottom));
      for (const { at, above: up } of base) {
        const off = offsetAt(route, at[1]) * scale;
        const point: Vec3 = [at[0] + r[0] * off + depth[0] * dz * scale, at[1] + r[1] * off, at[2] + r[2] * off + depth[2] * dz * scale];
        points.push(point);
        above.push(up);
        if (jogEnds.has(at[1])) vias.push(point);
      }
      return { points, above, vias };
    });
  };

  it("lays the same lanes as reading every stretch would, on a way up, a way down and past the route's ends", () => {
    const trails: TrailPoint[][] = [trail(-3, 6, 24), trail(-120, 14, 24), trail(60, 30, 24), trail(79, 5, 8), trail(-239, 3, 12), trail(-20, 0.001, 24)];
    // A trail running the other way, oldest first: its turns are met from the bottom.
    trails.push([...trail(-40, 9, 24)].reverse());
    for (const t of trails) {
      const fast = circuitLanes(t, RADIUS, [0.8, 0, 0.6]);
      const slow = laidTheLongWay(t, RADIUS, [0.8, 0, 0.6]);
      fast.forEach((lane, k) => {
        expect(lane.points).toEqual(slow[k]!.points);
        expect(lane.above).toEqual(slow[k]!.above);
        expect(lane.vias).toEqual(slow[k]!.vias);
      });
    }
  });

  it("lays a light's lanes in a small share of a frame (it does so every frame the light shows)", () => {
    const t = trail(-30, 8, 24);
    const started = performance.now();
    for (let i = 0; i < 300; i++) circuitLanes(t, RADIUS, RIGHT);
    // 300 frames' worth took about 900 ms on a fast desktop when each point read every stretch.
    expect(performance.now() - started).toBeLessThan(300);
  });

  it('lays five lanes beside the trail', () => {
    expect(LANES).toEqual([
      [0, 0, 0.042],
      [-1.6, -0.4, 0.026],
      [1.5, 0.3, 0.026],
      [-3.1, -1.1, 0.02],
      [3, -0.9, 0.02]
    ]);
    const lanes = circuitLanes(trail(-3), RADIUS, RIGHT);
    expect(lanes).toHaveLength(5);
    // Each about its own way across, the middle under the light, the outer ones furthest out; and as wide as its lane.
    lanes.forEach((lane, k) => {
      const mean = lane.points.reduce((s, p) => s + across(p), 0) / lane.points.length;
      expect(Math.abs(mean - LANES[k]![0] * SCALE), `lane ${k}`).toBeLessThanOrEqual(0.9 * SCALE + 1e-9);
      expect(lane.width).toBeCloseTo(LANES[k]![2] * SCALE, 12);
    });
    expect(lanes[3]!.points.every((p) => across(p) < 0)).toBe(true);
    expect(lanes[4]!.points.every((p) => across(p) > 0)).toBe(true);
  });

  it('jogs at 45 degrees, never more than 0.9 m from its lane', () => {
    for (const [k, lane] of circuitLanes(trail(-3, 6, 120), RADIUS, RIGHT).entries()) {
      for (const p of lane.points) expect(Math.abs(across(p) - LANES[k]![0] * SCALE), `lane ${k}`).toBeLessThanOrEqual(0.9 * SCALE + 1e-9);
      for (let i = 1; i < lane.points.length; i++) {
        const dx = Math.abs(across(lane.points[i]!) - across(lane.points[i - 1]!));
        const dy = Math.abs(lane.points[i]![1] - lane.points[i - 1]![1]);
        // Straight up a run, or across as much as down in a jog: never steeper sideways than 45°.
        if (dx > 1e-9) expect(dx / dy, `lane ${k} at ${i}`).toBeCloseTo(1, 6);
      }
    }
  });

  it('keeps a jog at the same height as the light falls', () => {
    const before = circuitLanes(trail(-3), RADIUS, RIGHT);
    const after = circuitLanes(trail(-3.4), RADIUS, RIGHT);
    for (let k = 0; k < 5; k++) {
      const seen = new Set(before[k]!.vias.map((v) => v[1].toFixed(9)));
      const both = after[k]!.vias.filter((v) => v[1] >= -3 && v[1] <= -0.4);
      expect(both.length, `lane ${k}`).toBeGreaterThan(0);
      for (const v of both) expect(seen.has(v[1].toFixed(9)), `lane ${k} at ${v[1]}`).toBe(true);
    }
  });

  it('puts a via at the end of each jog', () => {
    const lanes = circuitLanes(trail(-3, 6, 120), RADIUS, RIGHT);
    lanes.forEach((lane, k) => {
      const ends = routeOf(k, 7)
        .filter((s) => s.jog && s.bottom >= -3 && s.bottom <= 3)
        .map((s) => s.bottom.toFixed(9));
      expect(lane.vias.map((v) => v[1].toFixed(9)).sort()).toEqual(ends.sort());
    });
  });

  it('draws only above the light', () => {
    for (const lane of circuitLanes(trail(-3), RADIUS, RIGHT)) {
      for (const p of lane.points) expect(p[1]).toBeGreaterThanOrEqual(-3 - 1e-9);
      expect(lane.above[0]).toBe(0);
      for (let i = 1; i < lane.above.length; i++) expect(lane.above[i]!).toBeGreaterThanOrEqual(lane.above[i - 1]!);
    }
    expect(circuitLanes([], RADIUS, RIGHT).every((lane) => lane.points.length === 0)).toBe(true);
  });

  it('runs its pulses down into the light', () => {
    for (const above of [0, 1.3, 7]) {
      const p = pulseAt(above, 2, 0.37);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(1);
    }
    // A pulse's phase a moment later is found nearer the light.
    const phase = pulseAt(5, 1, 0);
    const later = 5 - (0.1 * 0.55) / 0.07;
    expect(pulseAt(later, 1.1, 0)).toBeCloseTo(phase, 9);
  });
});
