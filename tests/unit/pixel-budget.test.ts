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

  it('does not count a frame of no time (the first after switching on)', () => {
    const budget = new PixelBudget([1.75, 1.25, 1]);
    feed(budget, BUDGET.frames - 1, 0.021);
    expect(budget.sample(0)).toBeNull();
    expect(budget.sample(0.021)).toBe(1.25);
  });
});
