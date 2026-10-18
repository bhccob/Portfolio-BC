import { describe, expect, it, vi } from 'vitest';
import { RenderLoop } from '../../src/scripts/three/RenderLoop';

describe('RenderLoop', () => {
  it('runs one loop however often it is activated, and stops when inactive', () => {
    const queue: FrameRequestCallback[] = [];
    const raf = vi.fn((cb: FrameRequestCallback) => queue.push(cb));
    const caf = vi.fn();
    const tick = vi.fn();
    const loop = new RenderLoop(tick, raf, caf);
    loop.setActive(true);
    loop.setActive(true);
    expect(raf).toHaveBeenCalledTimes(1);
    queue.shift()!(16);
    expect(tick).toHaveBeenCalledTimes(1);
    loop.setActive(false);
    expect(loop.running).toBe(false);
    expect(caf).toHaveBeenCalled();
  });
});
