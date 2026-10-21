import { describe, expect, it } from 'vitest';
import { circlePath, STROKE_ORDER, strokeLength, strokePath, tickSegments, WORDMARK, type Point2 } from '~/engine/bob/wordmark';

describe('wordmark', () => {
  it('cuts the strokes in the preview order', () => {
    expect(STROKE_ORDER).toEqual(['leftB', 'leftBar', 'rightB', 'rightBar', 'circle']);
  });

  it('draws each B 2.1 wide and 3.4 deep on the glass, its back nearest the left', () => {
    for (const [id, x0] of [
      ['leftB', -4.25],
      ['rightB', 2.15]
    ] as const) {
      const xs = strokePath(id).map((p) => p[0]);
      const zs = strokePath(id).map((p) => p[1]);
      expect(Math.min(...xs)).toBeCloseTo(x0, 6);
      expect(Math.max(...xs)).toBeCloseTo(x0 + 2.1, 3);
      expect(Math.max(...zs)).toBeCloseTo(1.7, 6); // the foot, nearest the camera
      expect(Math.min(...zs)).toBeCloseTo(-1.7, 6); // the top, away from it
    }
  });

  it('closes each outline and puts the bar at 53 % of the height from the foot', () => {
    const p = strokePath('leftB');
    expect(p[0]).toEqual(p[p.length - 1]);
    const bar = strokePath('leftBar');
    expect(bar[0][1]).toBeCloseTo(1.7 - 3.4 * 0.53, 6);
    expect(bar[0][0]).toBeCloseTo(-4.25, 6);
  });

  it('makes the lower bowl the larger: full width and taller, the upper bowl 0.1 narrower', () => {
    const outline = strokePath('leftB');
    const barZ = strokePath('leftBar')[0][1];
    const lower = outline.filter((p) => p[1] > barZ + 1e-6);
    const upper = outline.filter((p) => p[1] < barZ - 1e-6);
    const x0 = -4.25;
    expect(Math.max(...lower.map((p) => p[0]))).toBeCloseTo(x0 + 2.1, 3);
    expect(Math.max(...upper.map((p) => p[0]))).toBeCloseTo(x0 + 2.0, 3);
    const lowerHeight = Math.max(...lower.map((p) => p[1])) - barZ; // bar to foot
    const upperHeight = barZ - Math.min(...upper.map((p) => p[1])); // top to bar
    expect(lowerHeight).toBeCloseTo(3.4 * 0.53, 6);
    expect(lowerHeight).toBeGreaterThan(upperHeight);
  });

  it('starts the circle at 45 degrees and closes it', () => {
    const c = strokePath('circle');
    expect(c[0][0]).toBeCloseTo(1.66 * Math.cos(Math.PI / 4), 6);
    expect(c[0]).toEqual(c[c.length - 1]);
    expect(strokeLength('circle')).toBeCloseTo(2 * Math.PI * 1.66, 2);
  });

  it('rings the circle with 144 ticks, long every 12th and mid every 6th', () => {
    const t = tickSegments();
    expect(t).toHaveLength(144);
    const len = (s: readonly [Point2, Point2]) => Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]);
    expect(len(t[0])).toBeCloseTo(0.16, 6);
    expect(len(t[6])).toBeCloseTo(0.1, 6);
    expect(len(t[1])).toBeCloseTo(0.055, 6);
  });

  it('keeps the letters clear of the outer ring', () => {
    for (const id of ['leftB', 'rightB'] as const) for (const [x, z] of strokePath(id)) expect(Math.hypot(x, z)).toBeGreaterThan(1.88);
  });
});

describe('circlePath', () => {
  it('walks a closed ring of the radius, 240 steps by default, anticlockwise on the screen from the start angle', () => {
    const c = circlePath(1.66);
    expect(c).toHaveLength(241);
    expect(c[0]).toEqual(c[240]);
    for (const [x, z] of c) expect(Math.hypot(x, z)).toBeCloseTo(1.66, 9);
    // Blender y becomes three -z, so an increasing angle climbs the screen (z falls) from the start.
    expect(c[1][1]).toBeLessThan(c[0][1]);
  });

  it('takes the segment count and the start angle', () => {
    const c = circlePath(2, 4, 0);
    expect(c).toHaveLength(5);
    expect(c[0][0]).toBeCloseTo(2, 9);
    expect(c[0][1]).toBeCloseTo(0, 9);
    expect(c[1][0]).toBeCloseTo(0, 9);
    expect(c[1][1]).toBeCloseTo(-2, 9);
  });
});

describe('WORDMARK', () => {
  it('keeps the circle between the hole and the outer ring, and the ticks just outside the circle', () => {
    expect(WORDMARK.hole).toBeLessThan(WORDMARK.circle);
    expect(WORDMARK.circle).toBeLessThan(WORDMARK.outer);
    expect(WORDMARK.ticks.inner).toBeCloseTo(WORDMARK.circle + 0.03, 9);
  });
});
