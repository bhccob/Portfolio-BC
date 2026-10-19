import { describe, expect, it } from 'vitest';
import { asleep, STILL, type Stillness } from '../../src/scripts/three/stillness';

const still: Stillness = {
  idle: true,
  pearl: 0,
  needle: 0,
  needleSpeed: 0,
  dragging: false,
  spin: 0,
  spinSpeed: 0,
  tip: 0,
  progressed: true,
  intro: false
};

describe('the sleep rule', () => {
  it('sleeps only when the pearl is idle and everything else has come to rest', () => {
    expect(asleep(still)).toBe(true);
    // Just inside every threshold, either way.
    expect(
      asleep({ ...still, pearl: STILL.pearl, needle: -STILL.needle, needleSpeed: STILL.needleSpeed, spin: -STILL.spin, spinSpeed: STILL.spinSpeed, tip: -STILL.tip })
    ).toBe(true);
  });

  it('stays awake while the pearl has had input in the last 20 s, however still the rest is', () => {
    expect(asleep({ ...still, idle: false })).toBe(false);
  });

  it('stays awake for each thing still moving', () => {
    const moving: Partial<Stillness>[] = [
      { pearl: STILL.pearl * 2 },
      { needle: STILL.needle * 2 },
      { needle: -STILL.needle * 2 },
      { needleSpeed: -STILL.needleSpeed * 2 },
      { dragging: true },
      { spin: STILL.spin * 2 },
      { spinSpeed: STILL.spinSpeed * 2 },
      { tip: -STILL.tip * 2 },
      { progressed: false },
      { intro: true }
    ];
    for (const change of moving) expect(asleep({ ...still, ...change }), JSON.stringify(change)).toBe(false);
  });

  it('counts a value that is not a number as moving', () => {
    expect(asleep({ ...still, needle: Number.NaN })).toBe(false);
    expect(asleep({ ...still, spinSpeed: Number.POSITIVE_INFINITY })).toBe(false);
  });
});
