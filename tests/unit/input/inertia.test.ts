import { describe, expect, it } from 'vitest';
import { Inertia } from '../../../src/input/Inertia';

/** A finger that moves `px` every 16 ms for `count` samples; returns the time of the last sample (the lift). */
function drag(inertia: Inertia, px: number, count = 7): number {
  let t = 0;
  for (let i = 0; i < count; i++) {
    inertia.track(t, px);
    t += 16;
  }
  return t - 16;
}

describe('Inertia', () => {
  it('is idle until a release gives it speed', () => {
    const inertia = new Inertia();
    expect(inertia.active).toBe(false);
    expect(inertia.step(1 / 60)).toBe(0);
  });

  it('carries on after a drag: active, with a first step in the drag direction', () => {
    const inertia = new Inertia();
    const end = drag(inertia, 20);
    inertia.release(end);
    expect(inertia.active).toBe(true);
    expect(inertia.step(1 / 60)).toBeGreaterThan(0);
  });

  it('carries on the other way after a drag the other way', () => {
    const inertia = new Inertia();
    const end = drag(inertia, -20);
    inertia.release(end);
    expect(inertia.step(1 / 60)).toBeLessThan(0);
  });

  it('starts at the speed of the last 100 ms (20 px every 16 ms is 1250 px/s)', () => {
    const inertia = new Inertia();
    const end = drag(inertia, 20);
    inertia.release(end);
    expect(inertia.step(1 / 60)).toBeCloseTo(1250 / 60, 5);
  });

  it('slows down by exp(-4 dt) a frame', () => {
    const inertia = new Inertia();
    const end = drag(inertia, 20);
    inertia.release(end);
    const first = inertia.step(1 / 60);
    const second = inertia.step(1 / 60);
    expect(second / first).toBeCloseTo(Math.exp(-4 / 60), 8);
  });

  it('comes to rest: inactive after 3 s of steps, and stops giving pixels', () => {
    const inertia = new Inertia();
    const end = drag(inertia, 20);
    inertia.release(end);
    for (let i = 0; i < 180; i++) inertia.step(1 / 60);
    expect(inertia.active).toBe(false);
    expect(inertia.step(1 / 60)).toBe(0);
  });

  it('stops below 5 px/s', () => {
    const inertia = new Inertia();
    // 4 px in 16 ms is 250 px/s: 5 px/s is reached when exp(-4 t) = 0.02, after about 0.98 s.
    inertia.track(0, 0);
    inertia.track(16, 4);
    inertia.release(16);
    let seconds = 0;
    while (inertia.active && seconds < 5) {
      inertia.step(1 / 60);
      seconds += 1 / 60;
    }
    expect(seconds).toBeGreaterThan(0.9);
    expect(seconds).toBeLessThan(1.1);
  });

  it('does not carry on from a finger that rested: no samples in the last 100 ms', () => {
    const inertia = new Inertia();
    drag(inertia, 20);
    inertia.release(500);
    expect(inertia.active).toBe(false);
  });

  it('ignores samples older than 100 ms when it works out the speed', () => {
    const inertia = new Inertia();
    inertia.track(0, 400); // a fast start, long before the release
    inertia.track(500, 1);
    inertia.track(516, 1);
    inertia.release(520);
    expect(inertia.step(1 / 60)).toBeCloseTo(1 / 60 / 0.016, 5);
  });

  it('caps a wild flick', () => {
    const inertia = new Inertia();
    inertia.track(0, 0);
    inertia.track(1, 900);
    inertia.release(1);
    expect(inertia.step(1)).toBeLessThanOrEqual(6000);
  });

  it('stops dead on stop(), and a release with no drag gives nothing', () => {
    const inertia = new Inertia();
    const end = drag(inertia, 20);
    inertia.release(end);
    inertia.stop();
    expect(inertia.active).toBe(false);
    expect(inertia.step(1 / 60)).toBe(0);
    inertia.release(end + 16);
    expect(inertia.active).toBe(false);
  });

  it('forgets the samples of the last drag after a release', () => {
    const inertia = new Inertia();
    const end = drag(inertia, 20);
    inertia.release(end);
    inertia.stop();
    inertia.release(end + 10);
    expect(inertia.active).toBe(false);
  });
});
