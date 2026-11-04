import { afterEach, describe, expect, it, vi } from 'vitest';
import { drain, nextSlice, paced } from '~/engine/core/pace';

function* counted(log: number[], n: number): Generator<void, string> {
  for (let i = 0; i < n; i++) {
    log.push(i);
    yield;
  }
  return 'done';
}

describe('long work between the frames', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('drains a generator in one go and answers its result', () => {
    const log: number[] = [];
    expect(drain(counted(log, 3))).toBe('done');
    expect(log).toEqual([0, 1, 2]);
  });

  it('runs to the end at once where there is no page to keep', async () => {
    const log: number[] = [];
    await expect(paced(counted(log, 5))).resolves.toBe('done');
    expect(log).toEqual([0, 1, 2, 3, 4]);
  });

  it('rejects when the work throws', async () => {
    function* broken(): Generator<void, void> {
      yield;
      throw new Error('no');
    }
    await expect(paced(broken())).rejects.toThrow('no');
  });

  it('stops for a frame once its slice is used, and only then', async () => {
    vi.stubGlobal('document', { visibilityState: 'visible' });
    let clock = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
    const log: number[] = [];
    function* slow(): Generator<void, string> {
      for (let i = 0; i < 4; i++) {
        log.push(i);
        clock += 4;
        yield;
      }
      return 'done';
    }
    const result = paced(slow(), 6);
    await new Promise((resolve) => setTimeout(resolve, 0));
    // Two steps of 4 ms fill the slice of 6 ms: it waits for a frame there.
    expect(log).toEqual([0, 1]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(log).toEqual([0, 1]);
    frames.shift()!(0);
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(log).toEqual([0, 1, 2, 3]);
    frames.shift()?.(0);
    await expect(result).resolves.toBe('done');
  });

  it('runs one piece of long work at a time, in the order asked', async () => {
    const log: string[] = [];
    function* named(name: string): Generator<void, void> {
      log.push(`${name} starts`);
      yield;
      log.push(`${name} ends`);
    }
    await Promise.all([paced(named('a')), paced(named('b'))]);
    expect(log).toEqual(['a starts', 'a ends', 'b starts', 'b ends']);
  });

  it('can just wait its turn, for a build too small to be written as steps', async () => {
    const log: string[] = [];
    function* first(): Generator<void, void> {
      yield;
      log.push('first');
    }
    const a = paced(first());
    const b = nextSlice().then(() => log.push('turn'));
    await Promise.all([a, b]);
    expect(log).toEqual(['first', 'turn']);
  });

  it('does not wait on a hidden page, which paints no frames', async () => {
    vi.stubGlobal('document', { visibilityState: 'hidden' });
    vi.stubGlobal('requestAnimationFrame', () => {
      throw new Error('no frame should be asked for');
    });
    let clock = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => (clock += 100));
    await expect(paced(counted([], 3), 6)).resolves.toBe('done');
  });
});
