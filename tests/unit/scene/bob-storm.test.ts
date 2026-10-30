import { describe, expect, it } from 'vitest';
import { TOP_FADE } from '~/scene/bob/lightDive';
import { NEBULA } from '~/scene/bob/nebulaWay';
import { LAND_HIT } from '~/scene/bob/worldPath';
import { STORM, stormFade, stormFlash, stormLevels, stormMoves } from '~/scene/bob/storm';

// Bob (2026-10-30): "i want the background dimension too look more 3d and intimidating and cinematic including the
// start screen like so its not a static background"; he picked the storm nebula (B), painted and animated, and, shown
// it on the start screen, "Yes, finish it" (spec 2026-10-30-bob-storm-design.md).

const len = (v: readonly number[]): number => Math.hypot(...v);

describe('the storm: its flats, its flash, its levels and when it moves', () => {
  it("keeps the spike's flats: 34, 14 and 6.5 m out, nearer ones lower, brighter and quicker", () => {
    expect(STORM.flats.map((f) => [f.radius, f.height])).toEqual([
      [34, 26],
      [14, 11],
      [6.5, 6]
    ]);
    for (let k = 1; k < STORM.flats.length; k++) {
      expect(STORM.flats[k]!.speed).toBeGreaterThan(STORM.flats[k - 1]!.speed);
      expect(STORM.flats[k]!.level).toBeGreaterThan(STORM.flats[k - 1]!.level);
    }
    expect(STORM.fps).toBe(30);
    // Round 8: a fifth darker than the spike's, the rendered bank being brighter than the painted wall.
    expect(STORM.flats.map((f) => f.level)).toEqual([0.68, 1.04, 1.36]);
    expect(STORM.fadeIn).toBe(1.5);
  });

  it('flashes once in every period, at a place the clock fixes, gone before the next', () => {
    const P = STORM.flash.period;
    expect(P).toBe(6);
    // Round 8: a faint glow from the flash plates, as in the moonlit storm Bob picked.
    expect(STORM.flash.gain).toBe(0.6);
    for (let k = 3; k < 40; k++) {
      let peak = 0;
      let peakAt = 0;
      for (let t = k * P; t < (k + 1) * P; t += 0.01) {
        const s = stormFlash(t).strength;
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(1);
        if (s > peak) {
          peak = s;
          peakAt = t;
        }
      }
      expect(peak, `period ${k}`).toBeGreaterThan(0.95);
      // The same moment is the same flash.
      expect(stormFlash(peakAt)).toEqual(stormFlash(peakAt));
      // Quiet again before the next period's flash can start.
      expect(stormFlash((k + 1) * P - 1e-3).strength, `period ${k}`).toBeLessThan(0.08);
    }
  });

  it("lights the storm behind the compass: each flash's way out lies behind it and near the horizon", () => {
    for (let t = 0; t < 600; t += 0.5) {
      const { dir } = stormFlash(t);
      expect(len(dir)).toBeCloseTo(1, 9);
      expect(dir[2]).toBeLessThan(0);
      expect(Math.abs(dir[1])).toBeLessThan(0.45);
    }
  });

  it('shows the whole storm at the start screen and lets the flats go over the first half of the rise', () => {
    expect(stormLevels({ stretch: 'rise', local: 0, frame: null }, 0)).toEqual({ sky: STORM.sky.home, flats: 1, sea: 1 });
    // Under the site's dark gate (a home still's mean luma at most 0.11) at the breath's peak.
    expect(STORM.sky.home).toBe(0.85);
    let last = 1;
    for (let k = 0; k <= 40; k++) {
      const { sky, flats } = stormLevels({ stretch: 'rise', local: k / 40, frame: null }, 0);
      expect(sky).toBe(STORM.sky.home);
      expect(flats).toBeLessThanOrEqual(last);
      last = flats;
    }
    expect(stormLevels({ stretch: 'rise', local: STORM.riseOut, frame: null }, 0).flats).toBe(0);
  });

  it('keeps the storm round the fall, from the glass top fading to the clouds coming in, then a backdrop as the light lands', () => {
    const at = (frame: number) => stormLevels({ stretch: 'light', local: 0, frame }, 0);
    expect(at(2)).toEqual({ sky: STORM.sky.home, flats: 0, sea: 1 });
    expect(at(TOP_FADE[0])).toEqual({ sky: STORM.sky.home, flats: 0, sea: 1 });
    const middle = at((TOP_FADE[0] + NEBULA.CLOUDS_IN[1]) / 2).sky;
    expect(middle).toBeLessThan(STORM.sky.home);
    expect(middle).toBeGreaterThan(STORM.sky.fall);
    expect(at(NEBULA.CLOUDS_IN[1]).sky).toBeCloseTo(STORM.sky.fall, 9);
    expect(at(200).sky).toBeCloseTo(STORM.sky.fall, 9);
    expect(STORM.sky.fall).toBe(0.25);
    // Round the tower, looking down on the stack, the storm stands behind the gas: round 8, less of it than in the fall, the
    // rendered sea of storm below being bright and the tower alone near the dark gate.
    expect(STORM.sky.void).toBe(0.08);
    // Over the drop into the stack the storm eases from its fall light to its tower light, there by the light's hit on the lid.
    const land = (local: number) => stormLevels({ stretch: 'land', local, frame: null }, 0).sky;
    expect(land(0)).toBeCloseTo(STORM.sky.fall, 9);
    let last = land(0);
    for (let k = 1; k <= 20; k++) {
      const s = land((LAND_HIT * k) / 20);
      // Monotone toward the tower's light, whichever way it lies.
      expect((s - last) * Math.sign(STORM.sky.void - STORM.sky.fall)).toBeGreaterThanOrEqual(0);
      last = s;
    }
    expect(land(LAND_HIT)).toBeCloseTo(STORM.sky.void, 9);
    expect(land(0.9)).toBeCloseTo(STORM.sky.void, 9);
    for (const stretch of ['area', 'look', 'qa'] as const) {
      expect(stormLevels({ stretch, local: 0.5, frame: null }, 0)).toEqual({ sky: STORM.sky.void, flats: 0, sea: 1 });
      // A project open: quieter, as the rest of the world.
      expect(stormLevels({ stretch, local: 0.5, frame: null }, 1).sky).toBeCloseTo(STORM.sky.void * STORM.sky.open, 9);
    }
    expect(stormLevels({ stretch: 'end', local: 0, frame: null }, 0)).toEqual({ sky: 0, flats: 0, sea: 0 });
  });

  // Bob (2026-10-30): "when the lights fall i dont like that theres such bright clouds under": the sea of storm below
  // the horizon goes dark as the camera comes down under the glass (the glass top fading), and comes back over the drop
  // into the stack.
  it('darkens the clouds under the falling light, and brings them back as the light lands', () => {
    expect(STORM.sea.fall).toBe(0.15);
    const at = (frame: number) => stormLevels({ stretch: 'light', local: 0, frame }, 0).sea;
    expect(at(TOP_FADE[0])).toBe(1);
    let last = 1;
    for (let f = TOP_FADE[0]; f <= TOP_FADE[1]; f++) {
      expect(at(f)).toBeLessThanOrEqual(last);
      last = at(f);
    }
    expect(at(TOP_FADE[1])).toBeCloseTo(STORM.sea.fall, 9);
    expect(at(60)).toBeCloseTo(STORM.sea.fall, 9);
    expect(at(200)).toBeCloseTo(STORM.sea.fall, 9);
    const land = (local: number) => stormLevels({ stretch: 'land', local, frame: null }, 0).sea;
    expect(land(0)).toBeCloseTo(STORM.sea.fall, 9);
    expect(land(LAND_HIT)).toBe(1);
    for (let k = 1; k <= 20; k++) expect(land((LAND_HIT * k) / 20)).toBeGreaterThanOrEqual(land((LAND_HIT * (k - 1)) / 20));
  });

  it('moves only on the home page, with motion allowed, above the low tier, while it shows', () => {
    const base = { page: 'home', reduced: false, tier: 'high', sky: 1 } as const;
    expect(stormMoves(base)).toBe(true);
    expect(stormMoves({ ...base, tier: 'medium' })).toBe(true);
    expect(stormMoves({ ...base, reduced: true })).toBe(false);
    expect(stormMoves({ ...base, tier: 'low' })).toBe(false);
    expect(stormMoves({ ...base, page: 'project' })).toBe(false);
    expect(stormMoves({ ...base, page: null })).toBe(false);
    expect(stormMoves({ ...base, sky: 0 })).toBe(false);
  });

  it('fades in over 1.5 s once its plates are in, at once with reduced motion', () => {
    expect(stormFade(0, false)).toBe(0);
    expect(stormFade(1.5, false)).toBe(1);
    expect(stormFade(9, false)).toBe(1);
    expect(stormFade(Number.NaN, false)).toBe(0);
    let last = 0;
    for (let k = 0; k <= 30; k++) {
      const f = stormFade((1.5 * k) / 30, false);
      expect(f).toBeGreaterThanOrEqual(last);
      last = f;
    }
    expect(stormFade(0, true)).toBe(1);
  });
});
