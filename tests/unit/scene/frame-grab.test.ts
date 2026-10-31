import { describe, expect, it, vi } from 'vitest';
import { grabNow, grabWanted, requestGrab } from '~/scene/frameGrab';

describe('the frame grab: the frame on the screen, handed once to whoever asked, right after it is drawn', () => {
  it('hands the next drawn frame to the one ask, and nothing after', () => {
    const take = vi.fn();
    const canvas = { width: 1200, height: 750 } as HTMLCanvasElement;
    expect(grabWanted()).toBe(false);
    requestGrab(take);
    expect(grabWanted()).toBe(true);
    grabNow(canvas);
    expect(take).toHaveBeenCalledWith(canvas, 1200, 750);
    grabNow(canvas);
    expect(take).toHaveBeenCalledTimes(1);
    expect(grabWanted()).toBe(false);
  });

  it('keeps only the last ask', () => {
    const first = vi.fn();
    const second = vi.fn();
    requestGrab(first);
    requestGrab(second);
    grabNow({ width: 10, height: 10 } as HTMLCanvasElement);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('never throws into the frame when the taker does', () => {
    requestGrab(() => {
      throw new Error('no');
    });
    expect(() => grabNow({ width: 10, height: 10 } as HTMLCanvasElement)).not.toThrow();
  });
});
