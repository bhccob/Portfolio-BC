import { describe, expect, it } from 'vitest';
import { qualityFor, qualitySteps } from '../../src/scripts/three/quality';

describe('qualityFor', () => {
  it('walks the fine-pointer ladder: dust first, then the pixel ratio', () => {
    expect(qualityFor(0, true)).toEqual({ pixelRatio: 1.75, dust: 600 });
    expect(qualityFor(1, true)).toEqual({ pixelRatio: 1.75, dust: 300 });
    expect(qualityFor(2, true)).toEqual({ pixelRatio: 1.25, dust: 200 });
    expect(qualityFor(3, true)).toEqual({ pixelRatio: 1, dust: 150 });
  });

  it('walks the coarse-pointer ladder: dust first, then the pixel ratio', () => {
    expect(qualityFor(0, false)).toEqual({ pixelRatio: 1.25, dust: 300 });
    expect(qualityFor(1, false)).toEqual({ pixelRatio: 1.25, dust: 150 });
    expect(qualityFor(2, false)).toEqual({ pixelRatio: 1, dust: 120 });
  });

  it('clamps steps past the end to the last entry', () => {
    expect(qualityFor(4, true)).toEqual(qualityFor(3, true));
    expect(qualityFor(99, true)).toEqual(qualityFor(3, true));
    expect(qualityFor(3, false)).toEqual(qualityFor(2, false));
    expect(qualityFor(Infinity, false)).toEqual(qualityFor(2, false));
  });

  it('reads a negative, fractional or NaN step as the nearest step at or below it, never under 0', () => {
    expect(qualityFor(-1, true)).toEqual(qualityFor(0, true));
    expect(qualityFor(Number.NaN, true)).toEqual(qualityFor(0, true));
    expect(qualityFor(1.6, true)).toEqual(qualityFor(1, true));
  });

  it('gives up dust before pixels: the ratio holds while the dust falls, and never rises', () => {
    for (const fine of [true, false]) {
      for (let step = 1; step < qualitySteps(fine); step++) {
        const before = qualityFor(step - 1, fine);
        const after = qualityFor(step, fine);
        expect(after.pixelRatio).toBeLessThanOrEqual(before.pixelRatio);
        expect(after.dust).toBeLessThan(before.dust);
      }
      // The first step down keeps the pixel ratio and halves the dust.
      expect(qualityFor(1, fine).pixelRatio).toBe(qualityFor(0, fine).pixelRatio);
      expect(qualityFor(1, fine).dust).toBe(qualityFor(0, fine).dust / 2);
    }
  });

  it('counts four steps on a fine pointer and three on a coarse one', () => {
    expect(qualitySteps(true)).toBe(4);
    expect(qualitySteps(false)).toBe(3);
  });

  it('answers a fresh object, so a caller cannot change the ladder', () => {
    const quality = qualityFor(0, true);
    quality.dust = 0;
    expect(qualityFor(0, true).dust).toBe(600);
  });
});
