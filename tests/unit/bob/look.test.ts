import { describe, expect, it } from 'vitest';
import { GLASS_LOOK } from '~/engine/bob/build/glassFloor';
import { FRAMES, homeShotFor, topShotFor, wideShotFor } from '~/engine/bob/shots';
import { palette } from '~/engine/palette';
import { BREATHE, breathAt, fogFor, IDLE_SECONDS, LOOK, NEEDLE_BREATH, needleGlowAt } from '~/scene/bob/look';

describe('the BOB look', () => {
  it('stands on the night, its fog from 14 to 50 (5 clear of what the camera looks at), its bloom from 0.7', () => {
    // Ruling 29: the preview's world is black; with the night (an indigo) the loader read 1.4-2.1x the preview.
    expect(LOOK.background).toBe(palette.black);
    expect(LOOK.fog).toEqual({ color: palette.black, near: 14, far: 50, clear: 5 });
    expect(LOOK.bloom.threshold).toBe(0.7);
    expect(LOOK.bloom.intensity.high).toBeGreaterThan(LOOK.bloom.intensity.medium);
    expect(LOOK.bloom.radius).toBeGreaterThan(0);
    expect(LOOK.exposure).toBeGreaterThan(0);
  });

  it("fades the far glass into the background's own black before its edge, so no horizon line shows (Ruling 26)", () => {
    expect(LOOK.fog.color).toBe(LOOK.background);
    expect(LOOK.fog.far).toBeLessThan(GLASS_LOOK.floor.outer);
    // Every shot stands closer to the compass than the fog begins (the phone's home aside, which stands back ~15).
    // The loader's wide shot of the O alone is 11.2 off, the top shot 12.6 straight above.
    for (const aspect of [16 / 9, 21 / 9, 4 / 3]) {
      for (const shot of [homeShotFor(aspect), wideShotFor(aspect), topShotFor(aspect)]) expect(Math.hypot(...shot.position)).toBeLessThan(LOOK.fog.near);
    }
    // Every camera but the top shot's stands on the +z side looking toward -z, so each point of the slab's far half, all
    // the glass it looks across, is at least the slab's radius away: past the fog's end, so the edge is the same night as
    // the sky. (The top shot looks straight down; it never sees the edge, and its own fog test is below.)
    for (const aspect of [16 / 9, 21 / 9, 390 / 844]) {
      for (const shot of [homeShotFor(aspect), wideShotFor(aspect)]) {
        expect(shot.position[2], `${aspect}`).toBeGreaterThan(0);
        expect(shot.target[2], `${aspect}`).toBe(0);
      }
    }
    expect(GLASS_LOOK.floor.outer).toBeGreaterThan(LOOK.fog.far);
  });

  describe('fogFor: the fog follows the shot (Task 12, the phone home was a quarter into the fog)', () => {
    const distance = (shot: ReturnType<typeof homeShotFor>) =>
      Math.hypot(shot.position[0] - shot.target[0], shot.position[1] - shot.target[1], shot.position[2] - shot.target[2]);

    it("keeps the laptop home's 14 to 50 exactly", () => {
      for (const aspect of [16 / 9, 16 / 10, 21 / 9, 4 / 3]) expect(fogFor(distance(homeShotFor(aspect)))).toEqual({ near: 14, far: 50 });
    });

    it('starts clear of what every shot looks at, phone or laptop, and keeps its depth', () => {
      for (const aspect of [390 / 844, 0.6, 0.99, 1, 4 / 3, 16 / 9, 21 / 9]) {
        for (const shot of [homeShotFor(aspect), wideShotFor(aspect), topShotFor(aspect)]) {
          const fog = fogFor(distance(shot));
          expect(fog.near, `${aspect}`).toBeGreaterThanOrEqual(distance(shot) + LOOK.fog.clear - 1e-9);
          expect(fog.far - fog.near, `${aspect}`).toBeCloseTo(LOOK.fog.far - LOOK.fog.near, 9);
        }
      }
      // The phone's home stands about 14.9 back (the laptop's crop at the 50-degree cap): its compass is out of the fog.
      const phone = homeShotFor(390 / 844);
      expect(distance(phone)).toBeGreaterThan(14);
      expect(fogFor(distance(phone)).near).toBeGreaterThan(distance(phone) + LOOK.fog.clear - 1e-9);
    });

    it("is all night before the slab's far edge from every camera, so no horizon line shows (Ruling 26)", () => {
      for (const aspect of [390 / 844, 0.6, 0.99, 1, 4 / 3, 16 / 9, 21 / 9]) {
        for (const shot of [homeShotFor(aspect), wideShotFor(aspect)]) {
          // The camera stands on +z looking toward -z: the nearest edge it looks across is the far one, at z = -outer.
          expect(fogFor(distance(shot)).far, `${aspect}`).toBeLessThan(GLASS_LOOK.floor.outer + shot.position[2]);
        }
      }
    });

    it('leaves the whole top picture clear of the fog: its farthest corner of the glass is nearer than the fog begins', () => {
      // Straight above, the picture is the glass from x = -w to w (w the top frame's half-width, on the edge on every
      // screen) and z = -w / aspect to w / aspect; its corner is the farthest point of it from the camera.
      for (const aspect of [390 / 844, 0.6, 1, 4 / 3, 16 / 9, 21 / 9, 0.3]) {
        const shot = topShotFor(aspect);
        const w = FRAMES.top.halfWidth;
        const corner = Math.hypot(shot.position[1], w, w / aspect);
        expect(corner, `${aspect}`).toBeLessThan(fogFor(distance(shot)).near);
      }
    });

    it('reads a distance that is not a finite, positive number as LOOK.fog', () => {
      for (const bad of [Number.NaN, -3, 0, Number.POSITIVE_INFINITY]) expect(fogFor(bad)).toEqual({ near: 14, far: 50 });
    });
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

  it("starts the needle's breath at its resting glow, 1, so its brightness does not step at the hand-over", () => {
    expect(needleGlowAt(0)).toBe(1);
  });

  it("breathes the needle's glow up to 1.4 and back over the same 4 s, never below its rest", () => {
    expect(NEEDLE_BREATH).toBe(0.4);
    expect(needleGlowAt(1)).toBeCloseTo(1.2, 12);
    expect(needleGlowAt(2)).toBeCloseTo(1.4, 12);
    expect(needleGlowAt(3)).toBeCloseTo(1.2, 12);
    expect(needleGlowAt(4)).toBeCloseTo(1, 12);
    for (let t = 0; t < 20; t += 0.25) {
      expect(needleGlowAt(t)).toBeGreaterThanOrEqual(1 - 1e-12);
      expect(needleGlowAt(t)).toBeLessThanOrEqual(1.4 + 1e-12);
    }
    expect(needleGlowAt(Number.NaN)).toBe(1);
    expect(needleGlowAt(Infinity)).toBe(1);
  });
});
