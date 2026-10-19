import { describe, expect, it } from 'vitest';
import { qualityFor, qualitySteps } from '../../src/scripts/three/quality';

describe('qualityFor', () => {
  it('walks the fine-pointer ladder from best to cheapest', () => {
    expect(qualityFor(0, true)).toEqual({ pixelRatio: 1.75, reflection: true, dust: 600 });
    expect(qualityFor(1, true)).toEqual({ pixelRatio: 1.25, reflection: true, dust: 400 });
    expect(qualityFor(2, true)).toEqual({ pixelRatio: 1.25, reflection: false, dust: 400 });
    expect(qualityFor(3, true)).toEqual({ pixelRatio: 1, reflection: false, dust: 200 });
  });

  it('walks the coarse-pointer ladder from best to cheapest', () => {
    expect(qualityFor(0, false)).toEqual({ pixelRatio: 1.25, reflection: false, dust: 300 });
    expect(qualityFor(1, false)).toEqual({ pixelRatio: 1, reflection: false, dust: 200 });
    expect(qualityFor(2, false)).toEqual({ pixelRatio: 1, reflection: false, dust: 120 });
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

  it('drops the reflection from step 2 on a fine pointer, and has none on a coarse one', () => {
    expect(qualityFor(0, true).reflection).toBe(true);
    expect(qualityFor(1, true).reflection).toBe(true);
    for (let step = 2; step < 6; step++) expect(qualityFor(step, true).reflection).toBe(false);
    for (let step = 0; step < 6; step++) expect(qualityFor(step, false).reflection).toBe(false);
  });

  it('never raises the cost from one step to the next', () => {
    for (const fine of [true, false]) {
      for (let step = 1; step < qualitySteps(fine); step++) {
        const before = qualityFor(step - 1, fine);
        const after = qualityFor(step, fine);
        expect(after.pixelRatio).toBeLessThanOrEqual(before.pixelRatio);
        expect(after.dust).toBeLessThanOrEqual(before.dust);
        expect(Number(after.reflection)).toBeLessThanOrEqual(Number(before.reflection));
      }
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
