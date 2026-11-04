import { describe, expect, it } from 'vitest';
import { BENCH_REFERENCE_MS, FrameJudge, lowerTier, qualityFor, qualitySteps, type QualityTier, SLOW_MS, startStep, tierFor, VERY_SLOW_MS } from '~/engine/quality';

describe('tierFor', () => {
  it('cuts the fine-pointer ladder into high (steps 0-1), medium (2-3) and low (4)', () => {
    expect([0, 1, 2, 3, 4].map((step) => tierFor(step, true))).toEqual(['high', 'high', 'medium', 'medium', 'low']);
  });

  it('cuts the coarse-pointer ladder into medium (steps 0-1) and low (2): a phone never starts high', () => {
    expect([0, 1, 2].map((step) => tierFor(step, false))).toEqual(['medium', 'medium', 'low']);
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
    expect(tierFor(Number.NaN, false)).toBe('medium');
    expect(tierFor(Number.NaN, true)).toBe('high');
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
  it('walks the fine-pointer ladder: the gas and the MSAA first, then the reflection, then the pixel ratio, then the gas altogether', () => {
    const steps = [0, 1, 2, 3, 4].map((step) => qualityFor(step, true));
    expect(steps.map((q) => q.reflector)).toEqual([true, true, false, false, false]);
    expect(steps.map((q) => q.pixelRatio)).toEqual([1.75, 1.5, 1.25, 1, 1]);
    expect(steps.map((q) => q.samples)).toEqual([4, 2, 2, 0, 0]);
    expect(steps.map((q) => q.gas)).toEqual([{ scale: 1.5, steps: 84 }, { scale: 2, steps: 56 }, { scale: 2.5, steps: 40 }, { scale: 3, steps: 28 }, null]);
  });

  it('walks the coarse-pointer ladder without the reflection', () => {
    const steps = [0, 1, 2].map((step) => qualityFor(step, false));
    expect(steps.map((q) => q.reflector)).toEqual([false, false, false]);
    expect(steps.map((q) => q.pixelRatio)).toEqual([1.25, 1, 1]);
    expect(steps.map((q) => q.gas)).toEqual([{ scale: 2.5, steps: 40 }, { scale: 3, steps: 28 }, null]);
  });

  it('costs less on every step down', () => {
    for (const fine of [true, false]) {
      for (let step = 1; step < qualitySteps(fine); step++) expect(qualityFor(step, fine).cost).toBeLessThan(qualityFor(step - 1, fine).cost);
    }
  });

  it('starts a coarse pointer without the reflection: its first rung reads as medium', () => {
    expect(qualityFor(0, false).reflector).toBe(false);
    expect(tierFor(0, false)).toBe('medium');
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

  it('turns the reflection off from step 2 on a fine pointer, never back on, and never draws it on a coarse one', () => {
    expect([0, 1, 2, 3, 4].map((step) => qualityFor(step, true).reflector)).toEqual([true, true, false, false, false]);
    expect([0, 1, 2].map((step) => qualityFor(step, false).reflector)).toEqual([false, false, false]);
  });

  it('has the reflection on only on the fine pointer’s high tier, on every rung of both ladders', () => {
    for (const fine of [true, false]) {
      for (let step = 0; step < qualitySteps(fine); step++) {
        expect(qualityFor(step, fine).reflector, `${fine ? 'fine' : 'coarse'} ${step}`).toBe(fine && tierFor(step, fine) === 'high');
      }
    }
  });

  it('keeps the reflection exactly on the high tier: the rung that turns it off is the one that leaves high', () => {
    for (const fine of [true, false]) {
      for (let step = 0; step < qualitySteps(fine); step++) expect(qualityFor(step, fine).reflector, `${fine} ${step}`).toBe(tierFor(step, fine) === 'high');
    }
  });

  it('only ever gives something up: no step raises the ratio, the MSAA or the gas', () => {
    for (const fine of [true, false]) {
      for (let step = 1; step < qualitySteps(fine); step++) {
        const before = qualityFor(step - 1, fine);
        const after = qualityFor(step, fine);
        expect(after.pixelRatio).toBeLessThanOrEqual(before.pixelRatio);
        expect(after.samples).toBeLessThanOrEqual(before.samples);
        expect(after.gas?.steps ?? 0).toBeLessThanOrEqual(before.gas?.steps ?? 0);
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
    quality.samples = 0;
    quality.reflector = false;
    expect(qualityFor(0, true)).toMatchObject({ pixelRatio: 1.75, reflector: true, samples: 4 });
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

describe('startStep: the first rung this GPU can hold', () => {
  const DESK = { width: 1920, height: 1080 };

  it('starts at the best with no timing, or a timing that makes no sense', () => {
    expect(startStep(null, true, DESK, 1)).toBe(0);
    expect(startStep(Number.NaN, true, DESK, 1)).toBe(0);
    expect(startStep(-1, true, DESK, 1)).toBe(0);
  });

  it('starts a strong desktop GPU at the best, on a 1440p screen too', () => {
    // An RTX 4080 Super timed about 0.6 ms.
    expect(startStep(0.6, true, { width: 2560, height: 1440 }, 1)).toBe(0);
    expect(startStep(0.6, true, DESK, 1)).toBe(0);
  });

  it('starts the weak GPU the costs were measured on near the bottom, and a slower one at the bottom', () => {
    expect(startStep(BENCH_REFERENCE_MS, true, { width: 1536, height: 864 }, 1.25)).toBeGreaterThanOrEqual(3);
    expect(startStep(BENCH_REFERENCE_MS * 4, true, DESK, 1)).toBe(qualitySteps(true) - 1);
  });

  it('starts lower on more pixels', () => {
    const small = startStep(3, true, { width: 1280, height: 720 }, 1);
    const big = startStep(3, true, { width: 3840, height: 2160 }, 1);
    expect(big).toBeGreaterThan(small);
  });

  it('stays on the coarse ladder for a phone', () => {
    expect(startStep(0.5, false, { width: 390, height: 844 }, 3)).toBe(0);
    expect(tierFor(startStep(0.5, false, { width: 390, height: 844 }, 3), false)).toBe('medium');
    expect(startStep(100, false, { width: 390, height: 844 }, 3)).toBe(qualitySteps(false) - 1);
  });
});

describe('FrameJudge', () => {
  /** `count` frames of `ms`, the steps down they asked for. */
  const run = (judge: FrameJudge, ms: number, count: number): number[] => Array.from({ length: count }, () => judge.frame(ms)).filter((d) => d > 0);

  it('asks for nothing while frames hold their time', () => {
    expect(run(new FrameJudge(), 16.7, 500)).toEqual([]);
    expect(run(new FrameJudge(), 5.5, 2000)).toEqual([]);
  });

  it('asks for a step down once it has seen enough slow frames, within a second', () => {
    const judge = new FrameJudge();
    const ms = SLOW_MS + 6;
    expect(run(judge, ms, Math.floor(700 / ms) - 1)).toEqual([]);
    expect(run(judge, ms, 4)).toEqual([1]);
  });

  it('asks for two when they are very slow', () => {
    expect(run(new FrameJudge(), VERY_SLOW_MS + 10, 20)[0]).toBe(2);
  });

  it('does not take a stall for the frame rate', () => {
    const judge = new FrameJudge();
    const asked: number[] = [];
    for (let i = 0; i < 100; i++) asked.push(judge.frame(i % 20 === 0 ? 120 : 16.7));
    expect(asked.filter((d) => d > 0)).toEqual([]);
  });

  it('does not count a sleep as a frame', () => {
    expect(new FrameJudge().frame(5000)).toBe(0);
    expect(run(new FrameJudge(), 1000, 50)).toEqual([]);
  });

  it('starts its count over after a rest', () => {
    const judge = new FrameJudge();
    run(judge, 40, 16);
    judge.rest();
    expect(run(judge, 40, 16)).toEqual([]);
  });

  it('gives up after two steps that did not help: frames held at 30 a second are not the GPU', () => {
    const judge = new FrameJudge();
    expect(run(judge, 33.4, 400).length).toBe(2);
  });

  it('keeps going while the steps do help', () => {
    const judge = new FrameJudge();
    const asked = [...run(judge, 42, 40), ...run(judge, 34, 40), ...run(judge, 28, 60)];
    expect(asked.length).toBeGreaterThanOrEqual(3);
  });
});
