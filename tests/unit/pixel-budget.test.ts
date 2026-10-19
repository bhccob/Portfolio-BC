import { describe, expect, it } from 'vitest';
import { BUDGET, PixelBudget } from '../../src/scripts/three/PixelBudget';

/** Feeds `count` frames of `dt` seconds and returns every new ratio the budget answered with. */
function feed(budget: PixelBudget, count: number, dt: number): number[] {
  const steps: number[] = [];
  for (let i = 0; i < count; i++) {
    const ratio = budget.sample(dt);
    if (ratio !== null) steps.push(ratio);
  }
  return steps;
}

describe('PixelBudget', () => {
  it('steps down once after a window of slow frames', () => {
    const budget = new PixelBudget([1.75, 1.25, 1]);
    expect(budget.ratio).toBe(1.75);
    expect(feed(budget, BUDGET.frames, 0.025)).toEqual([1.25]);
    expect(budget.ratio).toBe(1.25);
  });

  it('never steps at 60 fps', () => {
    const budget = new PixelBudget([1.75, 1.25, 1]);
    expect(feed(budget, 600, 0.016)).toEqual([]);
    expect(budget.ratio).toBe(1.75);
  });

  it('ignores a gap over 100 ms, such as a tab switch', () => {
    const budget = new PixelBudget([1.75, 1.25, 1]);
    // One stall in a window of fast frames would lift the mean over the limit if it counted.
    expect(feed(budget, BUDGET.frames - 1, 0.016)).toEqual([]);
    expect(budget.sample(0.5)).toBeNull();
    expect(feed(budget, 1, 0.016)).toEqual([]);
    // Gaps alone never fill a window.
    expect(feed(budget, 100, 0.25)).toEqual([]);
    expect(budget.ratio).toBe(1.75);
  });

  it('counts a fresh window at each ratio, stops at the last, and never steps back up', () => {
    const budget = new PixelBudget([1.75, 1.25, 1]);
    const slow = BUDGET.frames + BUDGET.warmup;
    expect(feed(budget, slow, 0.025)).toEqual([1.25]);
    expect(feed(budget, slow, 0.025)).toEqual([1]);
    expect(feed(budget, slow * 4, 0.025)).toEqual([]);
    expect(feed(budget, 600, 0.008)).toEqual([]);
    expect(budget.ratio).toBe(1);
  });

  it('a coarse pointer steps from 1.25 to 1', () => {
    const budget = new PixelBudget([1.25, 1]);
    expect(feed(budget, (BUDGET.frames + BUDGET.warmup) * 3, 0.03)).toEqual([1]);
  });

  it('after a restart (the loop coming back on), the first frames are not counted', () => {
    const budget = new PixelBudget([1.75, 1.25, 1]);
    budget.restart();
    // Counted, these slow first frames would hold the mean of the first window over the limit.
    expect(feed(budget, BUDGET.warmup, 0.05)).toEqual([]);
    expect(feed(budget, BUDGET.frames, 0.016)).toEqual([]);
    expect(budget.ratio).toBe(1.75);
  });

  it('forgets the frames before a restart', () => {
    const budget = new PixelBudget([1.75, 1.25, 1]);
    feed(budget, BUDGET.frames - 1, 0.025);
    budget.restart();
    expect(feed(budget, BUDGET.warmup + BUDGET.frames - 1, 0.025)).toEqual([]);
    expect(feed(budget, 1, 0.025)).toEqual([1.25]);
  });

  it('counts its steps, a repeated ratio included', () => {
    const budget = new PixelBudget([1.25, 1.25, 1]);
    expect(budget.step).toBe(0);
    const slow = BUDGET.frames + BUDGET.warmup;
    expect(feed(budget, slow, 0.025)).toEqual([1.25]);
    expect(budget.step).toBe(1);
    expect(feed(budget, slow, 0.025)).toEqual([1]);
    expect(budget.step).toBe(2);
    expect(feed(budget, slow, 0.025)).toEqual([]);
    expect(budget.step).toBe(2);
  });

  describe('with the hub\'s options (a tighter limit, slow runs counted)', () => {
    const HUB = { limit: 1 / 56, slowRun: 3 };

    it('steps down at a sustained 8 fps, where every frame is over the gap', () => {
      const budget = new PixelBudget([1.75, 1.75, 1.25, 1], HUB);
      expect(feed(budget, BUDGET.frames, 0.125)).toEqual([1.75]);
      expect(budget.step).toBe(1);
      // Each next step is judged on its own frames, after the warm-up.
      expect(feed(budget, BUDGET.warmup + BUDGET.frames, 0.125)).toEqual([1.25]);
      expect(budget.step).toBe(2);
    });

    it('steps down at a sustained 18 ms a frame (about 55 fps), which the default limit lets pass', () => {
      const hub = new PixelBudget([1.75, 1.75, 1.25, 1], HUB);
      expect(feed(hub, BUDGET.frames, 0.018)).toEqual([1.75]);
      const plain = new PixelBudget([1.75, 1.25, 1]);
      expect(feed(plain, BUDGET.frames * 4, 0.018)).toEqual([]);
    });

    it('holds at a steady 60 fps, and with an odd dropped frame', () => {
      const budget = new PixelBudget([1.75, 1.75, 1.25, 1], HUB);
      expect(feed(budget, 600, 1 / 60)).toEqual([]);
      for (let i = 0; i < 20; i++) {
        expect(feed(budget, 29, 1 / 60)).toEqual([]);
        expect(feed(budget, 1, 1 / 30)).toEqual([]);
      }
      expect(budget.step).toBe(0);
    });

    it('leaves out one isolated 300 ms frame (a tab switch), and two in a row', () => {
      const budget = new PixelBudget([1.75, 1.75, 1.25, 1], HUB);
      expect(feed(budget, BUDGET.frames - 1, 0.016)).toEqual([]);
      // Counted, it would lift the mean of the window to about 25 ms.
      expect(budget.sample(0.3)).toBeNull();
      expect(feed(budget, BUDGET.frames, 0.016)).toEqual([]);
      expect(feed(budget, 2, 0.3)).toEqual([]);
      expect(feed(budget, BUDGET.frames, 0.016)).toEqual([]);
      expect(budget.step).toBe(0);
    });

    it('counts a run of three or more long frames whole, the first two included', () => {
      const budget = new PixelBudget([1.75, 1.75, 1.25, 1], HUB);
      expect(feed(budget, BUDGET.frames - 3, 0.016)).toEqual([]);
      // Mean of the window: (27 × 16 ms + 3 × 300 ms) / 30, well over the limit.
      expect(feed(budget, 3, 0.3)).toEqual([1.75]);
    });

    it('leaves the warm-up frames out, long ones too, and a restart drops a run in progress', () => {
      const budget = new PixelBudget([1.75, 1.75, 1.25, 1], HUB);
      budget.restart();
      expect(feed(budget, BUDGET.warmup, 0.4)).toEqual([]);
      expect(feed(budget, 2, 0.3)).toEqual([]);
      budget.restart();
      expect(feed(budget, BUDGET.warmup, 0.016)).toEqual([]);
      expect(feed(budget, 1, 0.3)).toEqual([]);
      expect(feed(budget, BUDGET.frames, 0.016)).toEqual([]);
      expect(budget.step).toBe(0);
    });
  });

  it('does not count a frame of no time (the first after switching on)', () => {
    const budget = new PixelBudget([1.75, 1.25, 1]);
    feed(budget, BUDGET.frames - 1, 0.021);
    expect(budget.sample(0)).toBeNull();
    expect(budget.sample(0.021)).toBe(1.25);
  });
});
