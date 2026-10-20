import { describe, expect, it } from 'vitest';
import { qualityFor, qualitySteps } from '~/engine/quality';

describe('qualityFor', () => {
  it('walks the fine-pointer ladder: dust, then clearcoat, then the pixel ratio with the dust', () => {
    expect(qualityFor(0, true)).toEqual({ pixelRatio: 1.75, clearcoat: true, dust: 400 });
    expect(qualityFor(1, true)).toEqual({ pixelRatio: 1.75, clearcoat: true, dust: 200 });
    expect(qualityFor(2, true)).toEqual({ pixelRatio: 1.75, clearcoat: false, dust: 200 });
    expect(qualityFor(3, true)).toEqual({ pixelRatio: 1.25, clearcoat: false, dust: 150 });
    expect(qualityFor(4, true)).toEqual({ pixelRatio: 1, clearcoat: false, dust: 100 });
  });

  it('walks the coarse-pointer ladder: clearcoat and dust, then the pixel ratio', () => {
    expect(qualityFor(0, false)).toEqual({ pixelRatio: 1.25, clearcoat: true, dust: 150 });
    expect(qualityFor(1, false)).toEqual({ pixelRatio: 1.25, clearcoat: false, dust: 100 });
    expect(qualityFor(2, false)).toEqual({ pixelRatio: 1, clearcoat: false, dust: 80 });
  });

  it('clamps steps past the end to the last entry', () => {
    expect(qualityFor(5, true)).toEqual(qualityFor(4, true));
    expect(qualityFor(99, true)).toEqual(qualityFor(4, true));
    expect(qualityFor(3, false)).toEqual(qualityFor(2, false));
    expect(qualityFor(Infinity, false)).toEqual(qualityFor(2, false));
  });

  it('reads a negative, fractional or NaN step as the nearest step at or below it, never under 0', () => {
    expect(qualityFor(-1, true)).toEqual(qualityFor(0, true));
    expect(qualityFor(Number.NaN, true)).toEqual(qualityFor(0, true));
    expect(qualityFor(Number.NaN, false)).toEqual(qualityFor(0, false));
    expect(qualityFor(1.6, true)).toEqual(qualityFor(1, true));
  });

  it('turns clearcoat off from step 2 on a fine pointer and from step 1 on a coarse one, and never back on', () => {
    expect([0, 1, 2, 3, 4].map((step) => qualityFor(step, true).clearcoat)).toEqual([true, true, false, false, false]);
    expect([0, 1, 2].map((step) => qualityFor(step, false).clearcoat)).toEqual([true, false, false]);
  });

  it('only ever gives something up: no step raises the ratio or the dust', () => {
    for (const fine of [true, false]) {
      for (let step = 1; step < qualitySteps(fine); step++) {
        const before = qualityFor(step - 1, fine);
        const after = qualityFor(step, fine);
        expect(after.pixelRatio).toBeLessThanOrEqual(before.pixelRatio);
        expect(after.dust).toBeLessThanOrEqual(before.dust);
        expect(after).not.toEqual(before);
      }
    }
  });

  it('counts five steps on a fine pointer and three on a coarse one', () => {
    expect(qualitySteps(true)).toBe(5);
    expect(qualitySteps(false)).toBe(3);
  });

  it('answers a fresh object, so a caller cannot change the ladder', () => {
    const quality = qualityFor(0, true);
    quality.dust = 0;
    quality.clearcoat = false;
    expect(qualityFor(0, true)).toEqual({ pixelRatio: 1.75, clearcoat: true, dust: 400 });
  });
});
