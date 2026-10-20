import { afterEach, describe, expect, it } from 'vitest';
import { canvasMounts, countCanvasMount, MAX_GAP_MS, readStageProbe, registerStageProbe, ROLLING_FRAMES, RollingFps } from '../../../src/debug/stageReport';

describe('RollingFps', () => {
  it('reads 0 until it has seen two frames', () => {
    const meter = new RollingFps();
    expect(meter.mean()).toBe(0);
    meter.push(1000);
    expect(meter.mean()).toBe(0);
  });

  it('is the frames per second of the intervals between the frames it was given', () => {
    const meter = new RollingFps();
    for (let i = 0; i <= 10; i++) meter.push(i * 20); // 20 ms apart: 50 fps
    expect(meter.mean()).toBeCloseTo(50, 9);
  });

  it('weighs a slow frame by its length: the mean of the intervals, not of the rates', () => {
    const meter = new RollingFps();
    for (const t of [0, 10, 20, 120]) meter.push(t); // intervals 10, 10, 100: mean 40 ms
    expect(meter.mean()).toBeCloseTo(25, 9);
  });

  it('keeps the last 60 intervals only', () => {
    const meter = new RollingFps();
    let t = 0;
    meter.push(t);
    for (let i = 0; i < 100; i++) meter.push((t += 100)); // 10 fps for a long while
    for (let i = 0; i < ROLLING_FRAMES; i++) meter.push((t += 10)); // then 100 fps for 60 frames
    expect(meter.mean()).toBeCloseTo(100, 9);
  });

  it('does not count a sleep: a gap longer than MAX_GAP_MS between two frames is no interval', () => {
    const meter = new RollingFps();
    for (const t of [0, 10, 20]) meter.push(t);
    meter.push(20 + MAX_GAP_MS + 1); // the canvas slept, then something woke it
    meter.push(20 + MAX_GAP_MS + 11);
    expect(meter.mean()).toBeCloseTo(100, 9); // three intervals of 10 ms; the sleep is not one
  });

  it('ignores a time that does not advance', () => {
    const meter = new RollingFps();
    for (const t of [0, 10, 10, 20]) meter.push(t);
    expect(meter.mean()).toBeCloseTo(100, 9);
  });
});

describe('the stage probe', () => {
  let unregister = (): void => {};
  afterEach(() => unregister());

  it('reads zeros while no Stage is mounted', () => {
    expect(readStageProbe()).toEqual({ dpr: 0, fps: 0, camera: { position: [0, 0, 0], fov: 0 } });
  });

  it('reads what the mounted Stage reports, and zeros again once it unregisters', () => {
    const snapshot = { dpr: 1.25, fps: 58.5, camera: { position: [0, 0.1, 5] as [number, number, number], fov: 30 } };
    unregister = registerStageProbe(() => snapshot);
    expect(readStageProbe()).toBe(snapshot);
    unregister();
    expect(readStageProbe().dpr).toBe(0);
  });

  it('does not let an old Stage unregister the one that replaced it', () => {
    const old = registerStageProbe(() => ({ dpr: 1, fps: 1, camera: { position: [0, 0, 1], fov: 1 } }));
    const next = { dpr: 2, fps: 2, camera: { position: [0, 0, 2] as [number, number, number], fov: 2 } };
    unregister = registerStageProbe(() => next);
    old();
    expect(readStageProbe()).toBe(next);
  });
});

describe('canvasMounts', () => {
  it('counts the Stages mounted in this page view', () => {
    const before = canvasMounts();
    countCanvasMount();
    countCanvasMount();
    expect(canvasMounts()).toBe(before + 2);
  });
});
