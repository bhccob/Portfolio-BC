import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { settlesWithin } from '~/engine/core/deadline';

describe('a wait with a deadline', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('answers true for work that resolves in time, and lets go of its timer', async () => {
    let done!: () => void;
    const work = new Promise<void>((resolve) => (done = resolve));
    const waited = settlesWithin(work, 7000);
    await vi.advanceTimersByTimeAsync(6999);
    done();
    await expect(waited).resolves.toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('answers true for work that fails in time, without rejecting', async () => {
    const work = Promise.reject(new Error('refused'));
    await expect(settlesWithin(work, 7000)).resolves.toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('answers false at the deadline, and the work settling later changes nothing', async () => {
    let done!: () => void;
    const work = new Promise<void>((resolve) => (done = resolve));
    let answer: boolean | null = null;
    void settlesWithin(work, 7000).then((value) => (answer = value));
    await vi.advanceTimersByTimeAsync(6999);
    expect(answer).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(answer).toBe(false);
    done();
    await vi.advanceTimersByTimeAsync(0);
    expect(answer).toBe(false);
  });

  it('answers false for work that never settles', async () => {
    const waited = settlesWithin(new Promise<never>(() => {}), 10000);
    await vi.advanceTimersByTimeAsync(10000);
    await expect(waited).resolves.toBe(false);
  });
});
