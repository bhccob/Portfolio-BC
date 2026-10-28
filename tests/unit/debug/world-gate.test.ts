import { afterEach, describe, expect, it, vi } from 'vitest';
import { proofWorldGate, WORLD_GATE } from '~/debug/worldGate';

const page = globalThis as Record<string, unknown>;
afterEach(() => {
  delete page[WORLD_GATE];
  vi.useRealTimers();
});

describe("the proof harness's gate on the world's build (a slow or a broken world, under ?proof alone)", () => {
  it('lets the build through at once with no gate set', async () => {
    await expect(proofWorldGate()).resolves.toBeUndefined();
  });

  it('holds the build while the gate says hold, and lets it through once it is cleared', async () => {
    vi.useFakeTimers();
    page[WORLD_GATE] = 'hold';
    let through = false;
    const gate = proofWorldGate().then(() => (through = true));
    await vi.advanceTimersByTimeAsync(2_000);
    expect(through).toBe(false);
    delete page[WORLD_GATE];
    await vi.advanceTimersByTimeAsync(100);
    await gate;
    expect(through).toBe(true);
  });

  it('fails the build when the gate says fail, and when a hold turns to fail', async () => {
    page[WORLD_GATE] = 'fail';
    await expect(proofWorldGate()).rejects.toThrow(/proof/);
    vi.useFakeTimers();
    page[WORLD_GATE] = 'hold';
    const gate = proofWorldGate();
    const failed = expect(gate).rejects.toThrow(/proof/);
    page[WORLD_GATE] = 'fail';
    await vi.advanceTimersByTimeAsync(100);
    await failed;
  });
});
