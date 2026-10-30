import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FLOOR_GLOW, floorGlow } from '~/scene/bob/floorGlow';

// Round 10 (spec 2026-10-30-bob-qa-list-floors-design.md; Bob: "project glows so users know where to hover"): at a floor's
// stop its projects' light breathes softly up and down.

describe("the floor's glow", () => {
  it("pulses the light of a floor's projects between 1 and 1 + pulse over its period", () => {
    expect(FLOOR_GLOW).toEqual({ pulse: 0.35, period: 2.8 });
    let low = Infinity;
    let high = -Infinity;
    for (let t = 0; t < FLOOR_GLOW.period; t += 0.01) {
      const g = floorGlow(t, false);
      low = Math.min(low, g);
      high = Math.max(high, g);
    }
    expect(low).toBeCloseTo(1, 3);
    expect(high).toBeCloseTo(1 + FLOOR_GLOW.pulse, 3);
    expect(floorGlow(1.3, false)).toBeCloseTo(floorGlow(1.3 + FLOOR_GLOW.period, false), 9);
  });

  it('stands still at half with reduced motion', () => {
    for (const t of [0, 0.7, 2, 9]) expect(floorGlow(t, true)).toBe(1 + FLOOR_GLOW.pulse / 2);
  });

  it('is the same at the same time', () => {
    expect(floorGlow(4.2, false)).toBe(floorGlow(4.2, false));
  });

  it("is laid on the area's own projects before the hover's lift, and nowhere else", () => {
    const source = readFileSync(fileURLToPath(new URL('../../../src/scene/bob/Void.tsx', import.meta.url)), 'utf8');
    expect(source.match(/floorGlow\(/g)).toHaveLength(1);
    const glow = source.indexOf('floorGlow(');
    expect(glow).toBeGreaterThan(source.indexOf('const levels = { ...path.levels };'));
    expect(glow).toBeLessThan(source.indexOf('levels[hovered] *= 1 + HOVER_LIFT'));
    expect(source).toMatch(/at\.stretch === 'area'[\s\S]{0,200}areasOnPath\(\)\[at\.project\]/);
  });
});
