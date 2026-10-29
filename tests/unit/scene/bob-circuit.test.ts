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
