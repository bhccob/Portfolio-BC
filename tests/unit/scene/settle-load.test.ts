import { describe, expect, it, vi } from 'vitest';
import { settleLoad } from '~/scene/settleLoad';

const outcome = (disposed = () => false) => ({ disposed, ready: vi.fn(), fail: vi.fn() });

describe('settleLoad', () => {
  it('says ready once a load has finished', async () => {
    const o = outcome();
    await settleLoad(async () => {}, o);
    expect(o.ready).toHaveBeenCalledOnce();
    expect(o.fail).not.toHaveBeenCalled();
  });

  it('fails a load that throws, with what it threw, and never says ready: no partial scene', async () => {
    const o = outcome();
    const error = new Error('setTextures broke');
    await settleLoad(async () => {
      await Promise.resolve();
      throw error;
    }, o);
    expect(o.fail).toHaveBeenCalledExactlyOnceWith(error);
    expect(o.ready).not.toHaveBeenCalled();
  });

  it('fails a load that throws before its first await too', async () => {
    const o = outcome();
    await settleLoad(() => {
      throw new Error('at once');
    }, o);
    expect(o.fail).toHaveBeenCalledOnce();
    expect(o.ready).not.toHaveBeenCalled();
  });

  it('says nothing for a scene that is gone, whether the load finished or threw', async () => {
    for (const load of [async () => {}, async () => Promise.reject(new Error('late'))]) {
      const o = outcome(() => true);
      await settleLoad(load, o);
      expect(o.ready).not.toHaveBeenCalled();
      expect(o.fail).not.toHaveBeenCalled();
    }
  });

  it('never rejects, even when the outcome itself throws (it is logged)', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const o = { disposed: () => false, ready: () => {}, fail: () => {} };
    o.fail = () => {
      throw new Error('the host broke');
    };
    await expect(settleLoad(async () => Promise.reject(new Error('x')), o)).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalledOnce();
    logged.mockRestore();
  });
});
