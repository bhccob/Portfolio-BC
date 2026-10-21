import { describe, expect, it } from 'vitest';
import { CHIP, engraved, ON_STROKES, PIN_COUNT, pinPosition, pinsLit, strokeLengths } from '~/engine/v3/chipSpec';

describe('pins', () => {
  it('has 64 distinct pins, 16 per side, all outside the chip body', () => {
    const seen = new Set<string>();
    const sides: Record<string, number> = {};
    for (let i = 0; i < PIN_COUNT; i++) {
      const p = pinPosition(i);
      seen.add(`${p.x.toFixed(5)},${p.z.toFixed(5)}`);
      sides[p.side] = (sides[p.side] ?? 0) + 1;
      expect(Math.max(Math.abs(p.x), Math.abs(p.z))).toBeGreaterThan(CHIP.size / 2);
    }
    expect(seen.size).toBe(64);
    expect(sides).toEqual({ top: 16, right: 16, bottom: 16, left: 16 });
  });
  it('lights pins with progress and reaches 64 only at 1', () => {
    expect(pinsLit(0)).toBe(0);
    expect(pinsLit(0.5)).toBe(32);
    expect(pinsLit(0.9999)).toBe(63);
    expect(pinsLit(1)).toBe(64);
    expect(pinsLit(Number.NaN)).toBe(0);
    expect(pinsLit(7)).toBe(64);
  });
});

describe('the ON strokes', () => {
  it('are the O (one loop) then the three strokes of the N', () => {
    expect(ON_STROKES).toHaveLength(4);
    const o = ON_STROKES[0].points;
    expect(o[0]).toEqual(o[o.length - 1]);
  });
  it('cut in order: nothing at 0, all at 1, half the length at 0.5', () => {
    const lengths = strokeLengths(ON_STROKES);
    const total = lengths.reduce((a, b) => a + b, 0);
    expect(engraved(ON_STROKES, 0)).toEqual([0, 0, 0, 0]);
    expect(engraved(ON_STROKES, 1)).toEqual([1, 1, 1, 1]);
    const half = engraved(ON_STROKES, 0.5);
    expect(half.reduce((sum, f, i) => sum + f * lengths[i], 0)).toBeCloseTo(total / 2, 9);
    for (let i = 1; i < half.length; i++) if (half[i] > 0) expect(half[i - 1]).toBe(1);
  });
});
