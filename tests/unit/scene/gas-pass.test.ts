import { Pass } from 'postprocessing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { gasPass, setGasPass, subscribeGasPass } from '~/scene/gasPass';

class Stub extends Pass {
  override render(): void {}
}

afterEach(() => setGasPass(null));

describe("the gas's pass, from the Void to the post chain", () => {
  it('holds none until the Void hands one over, and none again once it takes it back', () => {
    expect(gasPass()).toBeNull();
    const pass = new Stub();
    setGasPass(pass);
    expect(gasPass()).toBe(pass);
    setGasPass(null);
    expect(gasPass()).toBeNull();
  });

  it('tells the post chain of each change once, and not of the same pass handed over again', () => {
    const heard = vi.fn();
    const stop = subscribeGasPass(heard);
    const pass = new Stub();
    setGasPass(pass);
    setGasPass(pass);
    expect(heard).toHaveBeenCalledTimes(1);
    const next = new Stub();
    setGasPass(next);
    expect(heard).toHaveBeenCalledTimes(2);
    stop();
    setGasPass(null);
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it('takes a pass back only if it is still the one held: a newer one stays', () => {
    const old = new Stub();
    const next = new Stub();
    setGasPass(next);
    setGasPass(null, old);
    expect(gasPass()).toBe(next);
    setGasPass(null, next);
    expect(gasPass()).toBeNull();
  });
});
