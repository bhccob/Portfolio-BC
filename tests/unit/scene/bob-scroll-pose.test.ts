import { describe, expect, it } from 'vitest';
import { type CameraShot, homeShotFor, topShotFor } from '~/engine/bob/shots';
import { RISE_SPANS, riseAt, scrollPoseAt } from '~/scene/bob/scrollPose';
import { moveTarget } from '~/input/target';
import { HOME_CHAPTERS } from '~/state/chapters';

const DEG = 180 / Math.PI;
const ASPECTS = [16 / 9, 1, 390 / 844] as const;

/** How high above the glass the shot looks down from, in degrees, read off its position and target. */
function elevationOf(shot: CameraShot): number {
  const [px, py, pz] = shot.position;
  const [tx, ty, tz] = shot.target;
  return Math.atan2(py - ty, Math.hypot(px - tx, pz - tz)) * DEG;
}

/** How far the camera stands from its target. */
function distanceOf(shot: CameraShot): number {
  return Math.hypot(shot.position[0] - shot.target[0], shot.position[1] - shot.target[1], shot.position[2] - shot.target[2]);
}

/** `u` from 0 to 1 in steps of 1/200 (the last one is exactly 1). */
const STEPS = Array.from({ length: 201 }, (_, i) => i / 200);

describe("the scroll's pose", () => {
  it('is the home at 0 and BOB from above at 1, on every screen', () => {
    for (const a of ASPECTS) {
      expect(scrollPoseAt(0, a)).toEqual({ u: 0, iris: 0, needleDip: 0, letters: 0, shot: homeShotFor(a) });
      const top = scrollPoseAt(1, a);
      expect([top.iris, top.needleDip, top.letters]).toEqual([1, 1, 1]);
      expect(top.shot).toEqual(topShotFor(a));
    }
  });

  it('has no up and no sway key at 0: that is the home shot as it is', () => {
    for (const a of ASPECTS) {
      const { shot } = scrollPoseAt(0, a);
      expect(Object.keys(shot).sort()).toEqual(['fov', 'position', 'target']);
    }
  });

  it("takes the preview's spans of the rise: iris 300-346, needle 300-340, letters 318-358 of the 300-362 frames", () => {
    expect(RISE_SPANS).toEqual({ iris: [0, 0.742], needle: [0, 0.645], letters: [0.29, 0.935], camera: [0, 1] });
    // Each is the rise through its span, linear: the setters ease them.
    const at = (u: number) => scrollPoseAt(u, 16 / 9);
    expect(at(0.371).iris).toBeCloseTo(0.5, 9);
    expect(at(0.742).iris).toBe(1);
    expect(at(0.3225).needleDip).toBeCloseTo(0.5, 9);
    expect(at(0.645).needleDip).toBe(1);
    expect(at(0.1855).iris).toBeCloseTo(0.25, 9);
    expect(at(0.9).iris).toBe(1);
    expect(at(0.9).needleDip).toBe(1);
  });

  it("lights the letters over the preview's frames 318-358 of the 300-362 rise", () => {
    expect(scrollPoseAt(0.29, 16 / 9).letters).toBe(0);
    expect(scrollPoseAt(0.935, 16 / 9).letters).toBe(1);
    expect(scrollPoseAt((0.29 + 0.935) / 2, 16 / 9).letters).toBeCloseTo(0.5, 9);
    // Nothing before the span, everything after it.
    expect(scrollPoseAt(0.1, 16 / 9).letters).toBe(0);
    expect(scrollPoseAt(0.97, 16 / 9).letters).toBe(1);
  });

  it('rises monotonically and continuously: elevation never drops, no step over 1.5 degrees per 1/200 of the rise', () => {
    for (const a of [16 / 9, 390 / 844]) {
      let previous = elevationOf(scrollPoseAt(0, a).shot);
      expect(previous).toBeCloseTo(13, 9);
      for (const u of STEPS.slice(1)) {
        const elevation = elevationOf(scrollPoseAt(u, a).shot);
        expect(elevation, `u ${u} at ${a}`).toBeGreaterThanOrEqual(previous - 1e-9);
        expect(elevation - previous, `u ${u} at ${a}`).toBeLessThanOrEqual(1.5);
        previous = elevation;
      }
      expect(previous).toBeCloseTo(90, 9);
    }
  });

  it('meets the home and the top without a jump: just inside either end it is already there', () => {
    for (const a of ASPECTS) {
      for (const [u, end] of [
        [1e-9, homeShotFor(a)],
        [1 - 1e-9, topShotFor(a)]
      ] as const) {
        const { shot } = scrollPoseAt(u, a);
        end.position.forEach((value, i) => expect(shot.position[i]).toBeCloseTo(value, 6));
        end.target.forEach((value, i) => expect(shot.target[i]).toBeCloseTo(value, 6));
        expect(shot.fov).toBeCloseTo(end.fov, 6);
      }
    }
  });

  it('moves the distance, the fov and the look-at height with the eased rise, from the home shot to the top shot', () => {
    for (const a of ASPECTS) {
      const home = homeShotFor(a);
      const top = topShotFor(a);
      // smoothstep(0.5) is 0.5, so halfway through the rise is halfway between the shots.
      const { shot } = scrollPoseAt(0.5, a);
      expect(distanceOf(shot)).toBeCloseTo((distanceOf(home) + distanceOf(top)) / 2, 9);
      expect(shot.fov).toBeCloseTo((home.fov + top.fov) / 2, 9);
      expect(shot.target[1]).toBeCloseTo(0.275, 9);
      expect([shot.target[0], shot.target[2]]).toEqual([0, 0]);
      expect(elevationOf(shot)).toBeCloseTo(51.5, 9);
      expect(shot.position[0]).toBe(0);
      // The look-at height and the fov are between the shots' on the way, never beyond.
      for (const u of STEPS) {
        const s = scrollPoseAt(u, a).shot;
        expect(s.target[1]).toBeLessThanOrEqual(0.55 + 1e-12);
        expect(s.target[1]).toBeGreaterThanOrEqual(-1e-12);
        expect(s.fov).toBeGreaterThanOrEqual(Math.min(home.fov, top.fov) - 1e-9);
        expect(s.fov).toBeLessThanOrEqual(Math.max(home.fov, top.fov) + 1e-9);
      }
    }
  });

  it('has no parallax from 0.6 of the rise, and an up only above 80 degrees', () => {
    for (const a of ASPECTS) {
      for (const u of STEPS) {
        const { shot } = scrollPoseAt(u, a);
        const elevation = elevationOf(shot);
        if (u >= 0.6) expect(shot.sway, `u ${u} at ${a}`).toBe(0);
        else if (u > 0) expect(shot.sway, `u ${u} at ${a}`).toBeCloseTo(1 - u / 0.6, 12);
        // An up is given above 80 degrees and never at or below it (give the boundary a hair of room).
        if (elevation > 80 + 1e-6) {
          const el = elevation / DEG;
          expect(shot.up, `u ${u} at ${a}`).toBeDefined();
          expect(shot.up![0]).toBe(0);
          expect(shot.up![1]).toBeCloseTo(Math.cos(el), 9);
          expect(shot.up![2]).toBeCloseTo(-Math.sin(el), 9);
        } else if (elevation < 80 - 1e-6) {
          expect(shot.up, `u ${u} at ${a}`).toBeUndefined();
        }
      }
    }
  });

  it("gives the camera its own up where it has one: the way the shot's top is the far side of the glass", () => {
    // At u 0.8 the eased rise is 0.896 and the camera 82 degrees up; its up leans toward -z.
    const { shot } = scrollPoseAt(0.8, 16 / 9);
    const el = (13 + 77 * (0.64 * (3 - 1.6))) / DEG;
    expect(elevationOf(shot)).toBeCloseTo(el * DEG, 9);
    expect(shot.up![1]).toBeCloseTo(Math.cos(el), 9);
    expect(shot.up![2]).toBeCloseTo(-Math.sin(el), 9);
    expect(Math.hypot(...shot.up!)).toBeCloseTo(1, 12);
  });

  it('has no parallax at all where the camera is above 85 degrees (the Rig clamps 0.01 rad off the pole)', () => {
    for (const a of ASPECTS) {
      let checked = 0;
      for (const u of STEPS) {
        const { shot } = scrollPoseAt(u, a);
        if (elevationOf(shot) > 85) {
          expect(shot.sway, `u ${u} at ${a}`).toBe(0);
          checked += 1;
        }
      }
      expect(checked).toBeGreaterThan(0);
    }
  });

  it('reads a bad u as 0, and progress past the HOME unit as the top', () => {
    expect(riseAt(Number.NaN)).toBe(0);
    expect(riseAt(-1)).toBe(0);
    expect(riseAt(0.5)).toBe(0.5);
    expect(riseAt(7)).toBe(1);
  });

  it("takes the rise from the HOME chapter's unit", () => {
    const home = HOME_CHAPTERS.units[0]!;
    expect(home.id).toBe('HOME');
    expect(riseAt(home.length)).toBe(1);
    expect(riseAt(home.length / 4)).toBe(0.25);
    expect(riseAt(Number.POSITIVE_INFINITY)).toBe(1);
    expect(riseAt(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it('snaps to its ends within 1e-6: a summed residue is the home, a hair short of the top is the top', () => {
    expect(riseAt(5.55e-17)).toBe(0);
    expect(riseAt(-5.55e-17)).toBe(0);
    expect(riseAt(9.99e-7)).toBe(0);
    expect(riseAt(1 - 1e-9)).toBe(1);
    expect(riseAt(1 - 9.99e-7)).toBe(1);
    // Just past the snap it is the rise itself.
    expect(riseAt(2e-6)).toBe(2e-6);
    expect(riseAt(1 - 2e-6)).toBe(1 - 2e-6);
  });

  it('comes back to exactly the home after n wheel notches down and n back, as the scroll input sums them', () => {
    // One 120 px notch on a 900 px tall window, through the input's own sum (src/input/target.ts moveTarget).
    const notch = 120 / 900;
    const residues: number[] = [];
    for (let n = 1; n <= 12; n++) {
      let target = 0;
      for (let i = 0; i < n; i++) target = moveTarget(target, notch, HOME_CHAPTERS, false);
      for (let i = 0; i < n; i++) target = moveTarget(target, -notch, HOME_CHAPTERS, false);
      residues.push(target);
      expect(riseAt(target), `n ${n}: target ${target}`).toBe(0);
    }
    // The sums do leave a residue (3 notches leave 5.55e-17), so the snap is what makes them the home.
    expect(residues.some((target) => target !== 0)).toBe(true);
  });

  it('holds u to 0..1, and a NaN u is the home shot', () => {
    for (const a of ASPECTS) {
      expect(scrollPoseAt(Number.NaN, a)).toEqual(scrollPoseAt(0, a));
      expect(scrollPoseAt(Number.NEGATIVE_INFINITY, a)).toEqual(scrollPoseAt(0, a));
      expect(scrollPoseAt(-0.5, a)).toEqual(scrollPoseAt(0, a));
      expect(scrollPoseAt(1.5, a)).toEqual(scrollPoseAt(1, a));
      expect(scrollPoseAt(Number.POSITIVE_INFINITY, a)).toEqual(scrollPoseAt(1, a));
      expect(scrollPoseAt(Number.NaN, a).shot).toEqual(homeShotFor(a));
      expect(scrollPoseAt(1.5, a).shot).toEqual(topShotFor(a));
    }
  });

  it('is finite in every number, for any u, and a bad aspect reads as the shots read it', () => {
    const numbers = (shot: CameraShot) => [...shot.position, ...shot.target, shot.fov, ...(shot.up ?? []), ...(shot.sway === undefined ? [] : [shot.sway])];
    for (const u of [Number.NaN, -1, 0, 1e-9, 0.3, 0.6, 0.99, 1, 3, Number.POSITIVE_INFINITY]) {
      for (const a of [16 / 9, Number.NaN, 0, -2]) {
        const pose = scrollPoseAt(u, a);
        expect([pose.u, pose.iris, pose.needleDip, pose.letters, ...numbers(pose.shot)].every(Number.isFinite), `u ${u} at ${a}`).toBe(true);
      }
    }
    expect(scrollPoseAt(0, Number.NaN).shot).toEqual(homeShotFor(16 / 9));
  });
});
