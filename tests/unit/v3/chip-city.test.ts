import { describe, expect, it } from 'vitest';
import { CHIP } from '~/engine/v3/chipSpec';
import { GLASS_RINGS } from '~/engine/v3/compassSpec';
import { CITY, CITY_BLOCKS, CITY_STREETS, cityLayout } from '~/engine/v3/chipCity';

describe('cityLayout', () => {
  const blocks = cityLayout(900);
  it('is the same city every time for a seed, and as many blocks as asked', () => {
    expect(cityLayout(900)).toEqual(blocks);
    expect(blocks).toHaveLength(900);
    expect(cityLayout(900, 7)).not.toEqual(blocks);
  });
  it('stays inside the annulus, below the glass', () => {
    for (const b of blocks) {
      const corners = [[b.x - b.w / 2, b.z - b.d / 2], [b.x + b.w / 2, b.z + b.d / 2], [b.x - b.w / 2, b.z + b.d / 2], [b.x + b.w / 2, b.z - b.d / 2]];
      for (const [x, z] of corners) {
        expect(Math.hypot(x, z)).toBeGreaterThanOrEqual(CITY.inner);
        expect(Math.hypot(x, z)).toBeLessThanOrEqual(CITY.outer);
      }
      expect(b.h).toBeLessThanOrEqual(CITY.maxHeight);
      expect(CHIP.board + b.h).toBeLessThan(0);
    }
  });
  it('never overlaps two blocks', () => {
    for (let i = 0; i < blocks.length; i++)
      for (let j = i + 1; j < blocks.length; j++) {
        const a = blocks[i], b = blocks[j];
        const apart = Math.abs(a.x - b.x) >= (a.w + b.w) / 2 || Math.abs(a.z - b.z) >= (a.d + b.d) / 2;
        expect(apart).toBe(true);
      }
  });
  it('keeps the city dim: few bright blocks', () => {
    expect(blocks.filter((b) => b.glow > 0.6).length / blocks.length).toBeLessThanOrEqual(CITY.brightShare);
  });
});

/** The nearest distance from the origin to a block's footprint (zero when it holds the origin). */
function nearest(b: { x: number; z: number; w: number; d: number }): number {
  const gap = (centre: number, size: number) => Math.max(0, Math.abs(centre) - size / 2);
  return Math.hypot(gap(b.x, b.w), gap(b.z, b.d));
}

describe('the city as a whole', () => {
  it('keeps every footprint, not only its corners, outside the inner radius and clear of the chip with its pins', () => {
    const clear = CHIP.size / 2 + CHIP.pinLength;
    for (const seed of [2006, 7]) {
      for (const b of cityLayout(CITY_BLOCKS.fine, seed)) {
        expect(nearest(b)).toBeGreaterThanOrEqual(CITY.inner);
        const apartFromChip = Math.abs(b.x) - b.w / 2 >= clear || Math.abs(b.z) - b.d / 2 >= clear;
        expect(apartFromChip).toBe(true);
      }
    }
  });
  it('holds both build sizes to the same promises: coarse and fine, no overlaps, nothing too tall or too bright', () => {
    for (const count of [CITY_BLOCKS.coarse, CITY_BLOCKS.fine]) {
      const city = cityLayout(count);
      expect(city).toHaveLength(count);
      expect(city.filter((b) => b.glow > 0.6).length / count).toBeLessThanOrEqual(CITY.brightShare);
      for (const b of city) {
        expect(b.w).toBeGreaterThan(0);
        expect(b.d).toBeGreaterThan(0);
        expect(b.h).toBeGreaterThan(0);
        expect(b.h).toBeLessThanOrEqual(CITY.maxHeight);
        expect(b.glow).toBeGreaterThanOrEqual(0);
        expect(b.glow).toBeLessThanOrEqual(1);
        expect(Math.hypot(Math.abs(b.x) + b.w / 2, Math.abs(b.z) + b.d / 2)).toBeLessThanOrEqual(CITY.outer);
      }
    }
  });
  it('keeps the share of bright blocks under the cap for any seed and size', () => {
    for (const seed of [1, 2, 3, 99, 4242]) {
      for (const count of [1, 5, 40, 250]) {
        const city = cityLayout(count, seed);
        expect(city).toHaveLength(count);
        expect(city.filter((b) => b.glow > 0.6).length).toBeLessThanOrEqual(Math.floor(count * CITY.brightShare));
      }
    }
  });
  it('lights some blocks amber and some violet, and most of them dimly', () => {
    const city = cityLayout(CITY_BLOCKS.fine);
    const violet = city.filter((b) => b.hue === 'violet').length;
    expect(violet).toBeGreaterThan(city.length * 0.1);
    expect(violet).toBeLessThan(city.length * 0.5);
    expect(city.filter((b) => b.glow <= 0.5).length / city.length).toBeGreaterThan(0.85);
  });
  it('reads as a city, not a scatter: it fills the annulus from the inside out, with streets left between the blocks', () => {
    const city = cityLayout(CITY_BLOCKS.fine);
    const radii = city.map((b) => Math.hypot(b.x, b.z));
    expect(Math.min(...radii)).toBeLessThan(CITY.inner + 0.1);
    expect(Math.max(...radii)).toBeGreaterThan(CITY.outer - 0.1);
    // The footprints cover well under all of the ground: the rest is the streets.
    const covered = city.reduce((sum, b) => sum + b.w * b.d, 0);
    const ground = Math.PI * (CITY.outer ** 2 - CITY.inner ** 2);
    expect(covered / ground).toBeGreaterThan(0.1);
    expect(covered / ground).toBeLessThan(0.5);
  });
  it('leaves the main streets bare: no block stands on a ring road or on an avenue', () => {
    const { rings, ringWidth, avenues, avenueWidth } = CITY_STREETS;
    for (const seed of [2006, 7]) {
      for (const b of cityLayout(CITY_BLOCKS.fine, seed)) {
        // A footprint's span of radii: the nearest and farthest points from the centre.
        const near = Math.hypot(Math.max(0, Math.abs(b.x) - b.w / 2), Math.max(0, Math.abs(b.z) - b.d / 2));
        const far = Math.hypot(Math.abs(b.x) + b.w / 2, Math.abs(b.z) + b.d / 2);
        for (const road of rings) expect(far <= road - ringWidth / 2 || near >= road + ringWidth / 2).toBe(true);
        // Its span across each avenue's line, which runs through the centre at a bearing of a multiple of 360 / avenues degrees.
        for (let i = 0; i < avenues / 2; i++) {
          const bearing = (i * 2 * Math.PI) / avenues;
          const [nx, nz] = [Math.cos(bearing), Math.sin(bearing)];
          const across = Math.abs(b.x * nx + b.z * nz) - ((b.w / 2) * Math.abs(nx) + (b.d / 2) * Math.abs(nz));
          expect(across).toBeGreaterThanOrEqual(avenueWidth / 2 - 1e-12);
        }
      }
    }
  });
  it('is built to the glass: the city ends where the outermost ring ends and begins where the hub does', () => {
    expect(CITY.outer).toBeLessThanOrEqual(Math.max(...GLASS_RINGS.map((r) => r.outer)));
    expect(CITY.inner).toBeGreaterThanOrEqual(CHIP.size / 2);
  });
  it('has two build sizes, the coarse one the smaller', () => {
    expect(CITY_BLOCKS).toEqual({ fine: 900, coarse: 600 });
  });
  it('lays out an empty city for 0 and refuses a count that is not a whole number', () => {
    expect(cityLayout(0)).toEqual([]);
    for (const bad of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) expect(() => cityLayout(bad)).toThrow(RangeError);
  });
});
