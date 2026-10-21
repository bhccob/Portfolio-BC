import { afterEach, describe, expect, it, vi } from 'vitest';
import { asleep } from '~/engine/stillness';
import { motion, onWakeScene, resetMotion, wakeScene } from '~/scene/motion';

describe('the scene waker', () => {
  afterEach(() => resetMotion());

  it('does nothing while no Stage listens, but notes when the scroll asked', () => {
    const before = motion.scrolledAt;
    expect(() => wakeScene()).not.toThrow();
    expect(motion.scrolledAt).toBeGreaterThan(before);
  });

  it('wakes the Stage that listens, until it stops listening', () => {
    const wake = vi.fn();
    const stop = onWakeScene(wake);
    wakeScene();
    wakeScene();
    expect(wake).toHaveBeenCalledTimes(2);
    stop();
    wakeScene();
    expect(wake).toHaveBeenCalledTimes(2);
  });

  it("lets a Stage's late unsubscribe leave the next Stage's waker in place", () => {
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = onWakeScene(first);
    const stopSecond = onWakeScene(second);
    stopFirst();
    wakeScene();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
    stopSecond();
  });

  it('puts every part back at rest', () => {
    motion.compass.needle = 0.4;
    motion.compass.idle = false;
    motion.parallax = true;
    motion.loader = true;
    expect(asleep(motion.compass)).toBe(false);
    resetMotion();
    expect(asleep(motion.compass)).toBe(true);
    expect(motion.parallax).toBe(false);
    expect(motion.loader).toBe(false);
  });
});
