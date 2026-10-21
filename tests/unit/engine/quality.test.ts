import { describe, expect, it } from 'vitest';
import { lowerTier, qualityFor, qualitySteps, type QualityTier, tierFor } from '~/engine/quality';

describe('tierFor', () => {
  it('cuts the fine-pointer ladder into high (steps 0-1), medium (2-3) and low (4)', () => {
    expect([0, 1, 2, 3, 4].map((step) => tierFor(step, true))).toEqual(['high', 'high', 'medium', 'medium', 'low']);
  });

  it('cuts the coarse-pointer ladder into high (0), medium (1) and low (2)', () => {
    expect([0, 1, 2].map((step) => tierFor(step, false))).toEqual(['high', 'medium', 'low']);
  });

  it('gives the last rung, and only the last, the low tier: the one without a composer', () => {
    for (const fine of [true, false]) {
      const last = qualitySteps(fine) - 1;
      expect(tierFor(last, fine)).toBe('low');
      for (let step = 0; step < last; step++) expect(tierFor(step, fine)).not.toBe('low');
    }
  });

  it('reads a step as qualityFor does: past the end is the last, NaN or negative the first', () => {
    expect(tierFor(99, true)).toBe('low');
    expect(tierFor(-1, true)).toBe('high');
    expect(tierFor(Number.NaN, false)).toBe('high');
    expect(tierFor(1.6, true)).toBe('high');
  });

  it('never climbs back: a later step is never a better tier', () => {
    const rank = { high: 0, medium: 1, low: 2 } as const;
    for (const fine of [true, false]) {
      for (let step = 1; step < qualitySteps(fine); step++) expect(rank[tierFor(step, fine)]).toBeGreaterThanOrEqual(rank[tierFor(step - 1, fine)]);
    }
  });
});

describe('qualityFor', () => {
  it('walks the fine-pointer ladder: dust, then the reflection, then the pixel ratio with the dust', () => {
    expect(qualityFor(0, true)).toEqual({ pixelRatio: 1.75, reflector: true, dust: 400 });
    expect(qualityFor(1, true)).toEqual({ pixelRatio: 1.75, reflector: true, dust: 200 });
    expect(qualityFor(2, true)).toEqual({ pixelRatio: 1.75, reflector: false, dust: 200 });
    expect(qualityFor(3, true)).toEqual({ pixelRatio: 1.25, reflector: false, dust: 150 });
    expect(qualityFor(4, true)).toEqual({ pixelRatio: 1, reflector: false, dust: 100 });
  });

  it('walks the coarse-pointer ladder: the reflection and dust, then the pixel ratio', () => {
    expect(qualityFor(0, false)).toEqual({ pixelRatio: 1.25, reflector: true, dust: 150 });
    expect(qualityFor(1, false)).toEqual({ pixelRatio: 1.25, reflector: false, dust: 100 });
    expect(qualityFor(2, false)).toEqual({ pixelRatio: 1, reflector: false, dust: 80 });
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

  it('turns the reflection off from step 2 on a fine pointer and from step 1 on a coarse one, and never back on', () => {
    expect([0, 1, 2, 3, 4].map((step) => qualityFor(step, true).reflector)).toEqual([true, true, false, false, false]);
    expect([0, 1, 2].map((step) => qualityFor(step, false).reflector)).toEqual([true, false, false]);
  });

  it('keeps the reflection exactly on the high tier: the rung that turns it off is the one that leaves high', () => {
    for (const fine of [true, false]) {
      for (let step = 0; step < qualitySteps(fine); step++) expect(qualityFor(step, fine).reflector, `${fine} ${step}`).toBe(tierFor(step, fine) === 'high');
    }
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
    quality.reflector = false;
    expect(qualityFor(0, true)).toEqual({ pixelRatio: 1.75, reflector: true, dust: 400 });
  });
});

describe('lowerTier', () => {
  const TIERS: QualityTier[] = ['high', 'medium', 'low'];

  it('steps down to the lower of the two', () => {
    expect(lowerTier('high', 'medium')).toBe('medium');
    expect(lowerTier('high', 'low')).toBe('low');
    expect(lowerTier('medium', 'low')).toBe('low');
  });

  it('never steps up: parts cannot grow back what they shed', () => {
    expect(lowerTier('low', 'high')).toBe('low');
    expect(lowerTier('medium', 'high')).toBe('medium');
    expect(lowerTier('low', 'medium')).toBe('low');
    for (const tier of TIERS) expect(lowerTier(tier, tier)).toBe(tier);
  });
});
