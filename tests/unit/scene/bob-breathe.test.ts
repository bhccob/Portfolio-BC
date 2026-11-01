import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TOWER_BREATH, towerBreath } from '~/scene/bob/breathe';

// Round 16 (spec 2026-11-01-bob-round16-design.md; Bob: "Breathe (A) but make it so everytime it breathes regardless if its
// not on that floor"): every project in the tower and its socket breathe together, on every floor, all the time.

describe("the tower's breath", () => {
  it('runs from 0 up to 1 and back over 2.4 s', () => {
    expect(TOWER_BREATH).toEqual({ period: 2.4 });
    expect(towerBreath(0, false)).toBe(0);
    expect(towerBreath(1.2, false)).toBeCloseTo(1, 12);
    for (const t of [0.3, 1.7, 5]) expect(towerBreath(t, false)).toBeCloseTo(towerBreath(t + 2.4, false), 9);
    for (let t = 0; t <= 10; t += 0.05) {
      const b = towerBreath(t, false);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(1);
    }
  });

  it('holds half way with reduced motion', () => {
    for (const t of [0, 0.6, 1.2, 9]) expect(towerBreath(t, true)).toBe(0.5);
  });

  it('reads a time that is not a number as the start', () => {
    expect(towerBreath(Number.NaN, false)).toBe(0);
    expect(towerBreath(Number.POSITIVE_INFINITY, false)).toBe(0);
  });

  it("is the Void's, on the page's time, for the whole tower, and the floor glow is gone", () => {
    const source = readFileSync(fileURLToPath(new URL('../../../src/scene/bob/Void.tsx', import.meta.url)), 'utf8');
    expect(source.match(/towerBreath\(/g)).toHaveLength(1);
    expect(source).toContain('towerBreath(now / 1000, reducedMotion)');
    expect(source).not.toMatch(/floorGlow/);
    // Handed to the world's pose, where every project and socket takes it.
    const pose = source.indexOf('world.model.pose({');
    expect(source.indexOf('breath', pose)).toBeLessThan(source.indexOf('});', pose));
  });
});
