import { describe, expect, it } from 'vitest';
import { GLASS_RINGS, HEXAGRAMS, HUB, hexagramLines } from '~/engine/v3/compassSpec';

describe('GLASS_RINGS', () => {
  it('runs inside out with a gap of at least 0.015 between rings, outside the hub', () => {
    expect(GLASS_RINGS.map((r) => r.id)).toEqual(['trigram', 'direction', 'degree', 'hexagram']);
    expect(GLASS_RINGS[0].inner).toBeGreaterThan(HUB.radius);
    for (let i = 1; i < GLASS_RINGS.length; i++) expect(GLASS_RINGS[i].inner - GLASS_RINGS[i - 1].outer).toBeGreaterThanOrEqual(0.015);
  });
  it('stands the rings at different heights, so they read as separate layers', () => {
    expect(new Set(GLASS_RINGS.map((r) => r.y)).size).toBe(GLASS_RINGS.length);
  });
});

describe('the hexagram ring', () => {
  it('holds all 64 hexagrams once, 5.625 degrees apart', () => {
    expect(HEXAGRAMS).toHaveLength(64);
    expect(new Set(HEXAGRAMS.map((h) => h.lines.join(''))).size).toBe(64);
    HEXAGRAMS.forEach((h, k) => expect(h.bearing).toBeCloseTo(k * 5.625, 9));
  });
  it('reads line i from bit i, bottom first: 0 is all broken (Kun), 63 all whole (Qian)', () => {
    expect(hexagramLines(0)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(hexagramLines(63)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(hexagramLines(1)).toEqual([1, 0, 0, 0, 0, 0]);
  });
  it('refuses a k outside 0..63', () => {
    expect(() => hexagramLines(64)).toThrow(RangeError);
    expect(() => hexagramLines(-1)).toThrow(RangeError);
    expect(() => hexagramLines(1.5)).toThrow(RangeError);
  });
});
