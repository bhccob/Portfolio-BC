import { describe, expect, it } from 'vitest';
import { densePath, letterStrip, RINGEN, tickPlaces } from '~/engine/bob/letterBands';
import { type Point2, strokePath, WORDMARK } from '~/engine/bob/wordmark';

/** Vertex `i` of a strip as [x, y, z]. */
const vertex = (position: Float32Array, i: number): [number, number, number] => [position[i * 3]!, position[i * 3 + 1]!, position[i * 3 + 2]!];

// The B letters made like the compass (spec 2026-10-29-bob-stack-2-design.md, goal 5, "2 · Ringen"): each stroke three
// thin bands side by side, of the compass's band glass, gold rims along both edges of each and the band's fine ticks on
// the outer edges, along the letters' paths exactly, the corners kept sharp.
describe('the B letters as Ringen', () => {
  it("keeps each letter's corners sharp", () => {
    const path = strokePath('leftB');
    const dense = densePath(path, RINGEN.dense);
    // Every point of the letter is still there, in order, and none of the steps between is longer than the step.
    let j = 0;
    for (const p of path) {
      while (j < dense.length && (dense[j]![0] !== p[0] || dense[j]![1] !== p[1])) j++;
      expect(j, `${p.join(', ')} kept`).toBeLessThan(dense.length);
    }
    for (let i = 1; i < dense.length; i++) expect(Math.hypot(dense[i]![0] - dense[i - 1]![0], dense[i]![1] - dense[i - 1]![1])).toBeLessThanOrEqual(RINGEN.dense + 1e-9);
    // The back's top (a right angle) and its foot (where the closed outline meets itself, a right angle too): both of a
    // strip's edges pass through the mitre, |d| √2 from the corner, not cut across it.
    const { leftX, nearZ, height } = WORDMARK.b;
    for (const corner of [[leftX, nearZ - height], [leftX, nearZ]] as Point2[]) {
      const at = dense.findIndex((p) => Math.abs(p[0] - corner[0]) < 1e-9 && Math.abs(p[1] - corner[1]) < 1e-9);
      const strip = letterStrip(path, -0.1775, 0.1775, 0);
      for (const side of [0, 1]) {
        const [x, , z] = vertex(strip.position, at * 2 + side);
        expect(Math.hypot(x - corner[0], z - corner[1])).toBeCloseTo(0.1775 * Math.SQRT2, 6);
      }
    }
  });

  it('lays three bands across each stroke', () => {
    expect(RINGEN.bands).toEqual([-0.14, 0, 0.14]);
    expect(RINGEN.width).toBe(0.075);
    expect(RINGEN.rim).toBe(0.018);
    expect(RINGEN.dense).toBe(0.015);
    // The left bar runs straight from the back to the bowls: a strip of it lies at its y, from d0 to d1 across it.
    const bar = strokePath('leftBar');
    const [a, b] = [bar[0]!, bar[bar.length - 1]!];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const strip = letterStrip(bar, 0.14 - 0.0375, 0.14 + 0.0375, 0.012);
    const points = densePath(bar, RINGEN.dense).length;
    expect(strip.position.length).toBe(points * 2 * 3);
    expect(strip.uv.length).toBe(points * 2 * 2);
    expect(strip.index.length).toBe((points - 1) * 6);
    for (let i = 0; i < points * 2; i++) {
      const [x, y, z] = vertex(strip.position, i);
      expect(y).toBe(Math.fround(0.012));
      // Across the bar (its normal is the bar's direction turned a quarter): d0 on the even vertices, d1 on the odd.
      const across = ((x - a[0]) * -(b[1] - a[1]) + (z - a[1]) * (b[0] - a[0])) / length;
      expect(across).toBeCloseTo(i % 2 === 0 ? 0.1025 : 0.1775, 6);
    }
    // The uv runs along it, 0 to 1, and across it, 0 to 1.
    expect([strip.uv[0], strip.uv[1], strip.uv[3]]).toEqual([0, 0, 1]);
    expect(strip.uv[(points - 1) * 4]).toBeCloseTo(1, 9);
    // Facing up: the first triangle's normal points to +y.
    const [i0, i1, i2] = [strip.index[0]!, strip.index[1]!, strip.index[2]!];
    const [p0, p1, p2] = [vertex(strip.position, i0), vertex(strip.position, i1), vertex(strip.position, i2)];
    const u = [p1[0] - p0[0], p1[2] - p0[2]];
    const v = [p2[0] - p0[0], p2[2] - p0[2]];
    // y of (p1 - p0) × (p2 - p0) on the glass: z·x − x·z.
    expect(u[1]! * v[0]! - u[0]! * v[1]!).toBeGreaterThan(0);
  });

  it('ticks the outer edges every 4.5 cm, a long one every sixth', () => {
    expect(RINGEN.ticks).toEqual({ step: 0.045, longEvery: 6, long: 0.62, short: 0.32, reach: 0.8, fineWidth: 0.006, longWidth: 0.011 });
    const bar = strokePath('rightBar');
    const [a, b] = [bar[0]!, bar[bar.length - 1]!];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const [tx, tz] = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
    const inward = RINGEN.ticks.reach * RINGEN.width;
    for (const d of [-0.1775, 0.1775]) {
      const ticks = tickPlaces(bar, d, inward);
      expect(ticks).toHaveLength(Math.floor(length / 0.045));
      ticks.forEach((tick, k) => {
        const long = k % 6 === 0;
        expect(tick.length).toBeCloseTo((long ? 0.62 : 0.32) * inward, 9);
        expect(tick.width).toBe(long ? 0.011 : 0.006);
        // Along the bar at k × 4.5 cm, from the edge at d inward to the bands' middle by half its length.
        const along = (tick.at[0] - a[0]) * tx + (tick.at[1] - a[1]) * tz;
        const across = (tick.at[0] - a[0]) * -tz + (tick.at[1] - a[1]) * tx;
        expect(along).toBeCloseTo(k * 0.045, 6);
        expect(across).toBeCloseTo(d - Math.sign(d) * tick.length / 2, 6);
        // Its angle turns a quad's x onto the bar's direction (three's turn about the up: x goes to (cos, −sin)).
        expect(Math.cos(tick.angle)).toBeCloseTo(tx, 6);
        expect(-Math.sin(tick.angle)).toBeCloseTo(tz, 6);
      });
    }
  });
});
