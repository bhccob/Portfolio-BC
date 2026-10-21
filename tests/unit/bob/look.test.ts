import { describe, expect, it } from 'vitest';
import { palette } from '~/engine/palette';
import { BREATHE, breathAt, ENGRAVE_BREATH, engraveGlowAt, IDLE_SECONDS, LOOK } from '~/scene/bob/look';

describe('the BOB look', () => {
  it('stands on the night, its fog a violet haze from 14 to 60, its bloom from 0.7', () => {
    expect(LOOK.background).toBe(palette.night);
    expect(LOOK.fog).toEqual({ color: palette.fog, near: 14, far: 60 });
    expect(LOOK.bloom.threshold).toBe(0.7);
    expect(LOOK.bloom.intensity.high).toBeGreaterThan(LOOK.bloom.intensity.medium);
    expect(LOOK.bloom.radius).toBeGreaterThan(0);
    expect(LOOK.exposure).toBeGreaterThan(0);
  });

  it('takes every colour from the palette', () => {
    const colours = Object.values(palette) as number[];
    for (const colour of [LOOK.background, LOOK.fog.color, LOOK.key.colour, LOOK.rim.colour]) expect(colours).toContain(colour);
  });
});

describe("the home's idle rules (moved from v3's homePose)", () => {
  it('runs the idle motion for 12 s after the last stir', () => {
    expect(IDLE_SECONDS).toBe(12);
  });

  it('breathes 0.9 to 1.1 over 4 s, as v3 did, and reads a bad time as rest', () => {
    expect(BREATHE).toEqual({ depth: 0.1, period: 4 });
    expect(breathAt(0)).toBe(1);
    expect(breathAt(1)).toBeCloseTo(1.1, 12);
    expect(breathAt(3)).toBeCloseTo(0.9, 12);
    expect(breathAt(Number.NaN)).toBe(1);
  });

  it("breathes the engraving's glow by 0.05 either way over the same 4 s, from its rest of 1", () => {
    expect(ENGRAVE_BREATH).toBe(0.05);
    expect(engraveGlowAt(0)).toBe(1);
    expect(engraveGlowAt(1)).toBeCloseTo(1.05, 12);
    expect(engraveGlowAt(3)).toBeCloseTo(0.95, 12);
    expect(engraveGlowAt(4)).toBeCloseTo(1, 12);
    for (let t = 0; t < 20; t += 0.25) expect(Math.abs(engraveGlowAt(t) - 1)).toBeLessThanOrEqual(0.05 + 1e-12);
    expect(engraveGlowAt(Number.NaN)).toBe(1);
  });
});
