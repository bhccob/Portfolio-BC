import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { type CameraShot, FRAMES, homeShotFor, lerpCameraShot, MAX_VFOV, shotFor, type ShotFrame, wideShotFor } from '~/engine/bob/shots';

/** `p` seen through the camera a shot places on a screen of this aspect: its NDC x and y (-1..1). */
function project(shot: CameraShot, aspect: number, p: [number, number, number]): [number, number] {
  const camera = new THREE.PerspectiveCamera(shot.fov, aspect, 0.1, 200);
  camera.up.set(0, 1, 0);
  camera.position.set(...shot.position);
  camera.lookAt(...shot.target);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  const v = new THREE.Vector3(...p).project(camera);
  return [v.x, v.y];
}

const PHONE = 390 / 844;

describe('the home shot', () => {
  it('puts the B centres at the screen edges on a laptop (half of each B off screen)', () => {
    for (const aspect of [16 / 9, 16 / 10]) {
      expect(project(homeShotFor(aspect), aspect, [-3.2, 0, 0])[0]).toBeCloseTo(-1, 1);
      expect(project(homeShotFor(aspect), aspect, [3.2, 0, 0])[0]).toBeCloseTo(1, 1);
    }
  });

  it("keeps the compass's top ring inside the frame, under the header's line", () => {
    // about 0.88 by hand (the preview's 65 px of 1080); the header sits above 0.9
    expect(project(homeShotFor(16 / 9), 16 / 9, [0, 0.55 + 1.56, 0])[1]).toBeLessThan(0.92);
  });

  it('keeps the whole compass in the frame on a laptop', () => {
    for (const aspect of [16 / 9, 16 / 10]) {
      const shot = homeShotFor(aspect);
      for (const [x, y, z] of [
        [0, 0.55 + 1.56, 0],
        [1.66, 0, 0],
        [-1.66, 0, 0],
        [0, 0, 1.66],
        [0, 0, -1.66]
      ] as const) {
        const [nx, ny] = project(shot, aspect, [x, y, z]);
        expect(Math.abs(nx)).toBeLessThan(0.7);
        expect(Math.abs(ny)).toBeLessThan(0.95);
      }
    }
  });

  it('fits the whole name across a portrait phone, the field held at 50 degrees', () => {
    const a = PHONE;
    const shot = homeShotFor(a);
    expect(shot.fov).toBeLessThanOrEqual(50);
    for (const x of [-4.25, 4.25]) expect(Math.abs(project(shot, a, [x, 0, 1.7])[0])).toBeLessThanOrEqual(0.95);
  });

  it('keeps the whole name inside the frame across the portrait range (the margin thins toward a square)', () => {
    for (const aspect of [0.25, 0.3, 0.5, 0.75, 0.9, 0.99]) {
      const shot = homeShotFor(aspect);
      expect(shot.fov).toBeLessThanOrEqual(MAX_VFOV + 1e-9);
      for (const x of [-4.25, 4.25]) expect(Math.abs(project(shot, aspect, [x, 0, 1.7])[0])).toBeLessThan(1);
    }
  });

  it('takes the portrait frame below a square and the laptop frame from a square up', () => {
    expect(homeShotFor(0.999)).toEqual(shotFor(FRAMES.homePortrait, 0.999));
    expect(homeShotFor(1)).toEqual(shotFor(FRAMES.home, 1));
    expect(homeShotFor(16 / 9)).toEqual(shotFor(FRAMES.home, 16 / 9));
  });
});

describe('the home shot on a wide, short screen', () => {
  const topRing = [0, 0.55 + 1.56, 0] as [number, number, number];

  it("keeps the compass's top ring under the header's line at 2.0 and 21:9", () => {
    for (const aspect of [1.85, 2.0, 21 / 9]) expect(project(homeShotFor(aspect), aspect, topRing)[1]).toBeLessThanOrEqual(0.92);
  });

  it("holds the field at the frame's floor once the width fit would fall below it", () => {
    expect(FRAMES.home.minVfov).toBe(22.5);
    for (const aspect of [1.85, 2.0, 21 / 9]) expect(homeShotFor(aspect).fov).toBe(22.5);
  });

  it('does not bind on a laptop: the field is the width fit', () => {
    for (const aspect of [16 / 10, 16 / 9]) {
      const fit = (2 * Math.atan(FRAMES.home.halfWidth / (FRAMES.home.distance * aspect)) * 180) / Math.PI;
      expect(fit).toBeGreaterThan(22.5);
      expect(homeShotFor(aspect).fov).toBeCloseTo(fit, 9);
    }
  });

  it('still keeps the centre of each B inside the screen, only more of each B shows', () => {
    for (const aspect of [2.0, 21 / 9]) {
      const shot = homeShotFor(aspect);
      expect(project(shot, aspect, [-3.2, 0, 0])[0]).toBeGreaterThan(-1);
      expect(project(shot, aspect, [3.2, 0, 0])[0]).toBeLessThan(1);
    }
  });

  it('puts the half-width inside the screen edge, not on it, while the floor binds', () => {
    const [x] = project(homeShotFor(21 / 9), 21 / 9, [FRAMES.home.halfWidth, FRAMES.home.targetY, 0]);
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(1);
  });
});

describe('the wide shot', () => {
  it('frames the whole name with margin in the wide shot', () => {
    for (const x of [-4.25, 4.25]) expect(Math.abs(project(wideShotFor(16 / 9), 16 / 9, [x, 0, 1.7])[0])).toBeLessThan(0.95);
  });

  it('keeps the name in on the other screens too', () => {
    for (const aspect of [16 / 10, 4 / 3, 1, PHONE]) {
      for (const x of [-4.25, 4.25]) expect(Math.abs(project(wideShotFor(aspect), aspect, [x, 0, 1.7])[0])).toBeLessThanOrEqual(0.95);
    }
  });

  it('is the same view as the frame says', () => {
    expect(wideShotFor(16 / 9)).toEqual(shotFor(FRAMES.wide, 16 / 9));
    expect(wideShotFor(0.5)).toEqual(shotFor(FRAMES.wide, 0.5));
  });
});

describe('shotFor', () => {
  it('stands the camera at the distance and elevation, looking at the target on the axis', () => {
    const frame = FRAMES.home;
    const shot = shotFor(frame, 16 / 9);
    const e = (frame.elevation * Math.PI) / 180;
    expect(shot.target).toEqual([0, frame.targetY, 0]);
    expect(shot.position[0]).toBe(0);
    expect(shot.position[1]).toBeCloseTo(frame.targetY + frame.distance * Math.sin(e), 9);
    expect(shot.position[2]).toBeCloseTo(frame.distance * Math.cos(e), 9);
  });

  it('opens the field to fit the half-width at the target, in degrees', () => {
    const frame = FRAMES.wide;
    const shot = shotFor(frame, 16 / 9);
    expect(shot.fov).toBeCloseTo((2 * Math.atan(frame.halfWidth / (frame.distance * (16 / 9))) * 180) / Math.PI, 9);
    expect(shot.fov).toBeLessThan(MAX_VFOV);
  });

  it('puts the half-width, measured at the target, on the screen edge', () => {
    // Wherever the width fit is not below the frame's floor on its field (see the wide, short screens below).
    const frames: ShotFrame[] = [FRAMES.wide, FRAMES.home, FRAMES.homePortrait];
    for (const frame of frames) {
      for (const aspect of [0.3, PHONE, 1, 16 / 10, 16 / 9]) {
        const shot = shotFor(frame, aspect);
        expect(project(shot, aspect, [frame.halfWidth, frame.targetY, 0])[0]).toBeCloseTo(1, 9);
        expect(project(shot, aspect, [-frame.halfWidth, frame.targetY, 0])[0]).toBeCloseTo(-1, 9);
      }
    }
  });

  it('holds the field at the cap and stands back instead, on a narrow screen', () => {
    const frame = FRAMES.homePortrait;
    const shot = shotFor(frame, PHONE);
    expect(MAX_VFOV).toBe(50);
    expect(shot.fov).toBe(MAX_VFOV);
    const distance = Math.hypot(shot.position[1] - frame.targetY, shot.position[2]);
    expect(distance).toBeCloseTo(frame.halfWidth / (PHONE * Math.tan((MAX_VFOV * Math.PI) / 360)), 9);
    expect(distance).toBeGreaterThan(frame.distance);
  });

  it('keeps the elevation when it stands back', () => {
    const frame = FRAMES.homePortrait;
    const shot = shotFor(frame, PHONE);
    const rise = Math.atan2(shot.position[1] - frame.targetY, shot.position[2]);
    expect(rise).toBeCloseTo((frame.elevation * Math.PI) / 180, 9);
  });

  it("applies the cap after the floor: a floor above the cap is held at the cap, at the distance the cap gives", () => {
    const frame: ShotFrame = { distance: 10, elevation: 10, targetY: 0, halfWidth: 4, minVfov: 80 };
    const shot = shotFor(frame, 2);
    expect(shot.fov).toBe(MAX_VFOV);
    expect(Math.hypot(shot.position[1], shot.position[2])).toBeCloseTo(4 / (2 * Math.tan((MAX_VFOV * Math.PI) / 360)), 9);
  });

  it('has no floor unless the frame sets one', () => {
    const frame: ShotFrame = { distance: 10, elevation: 10, targetY: 0, halfWidth: 1 };
    expect(shotFor(frame, 3).fov).toBeCloseTo((2 * Math.atan(1 / 30) * 180) / Math.PI, 9);
  });

  it('does not stand back for a screen that fits', () => {
    const shot = shotFor(FRAMES.home, 16 / 9);
    expect(Math.hypot(shot.position[1] - FRAMES.home.targetY, shot.position[2])).toBeCloseTo(FRAMES.home.distance, 9);
  });

  it('reads an aspect thinner than 0.25 as 0.25, so the camera stays a finite way off', () => {
    for (const frame of [FRAMES.wide, FRAMES.home, FRAMES.homePortrait]) {
      expect(shotFor(frame, 0.05)).toEqual(shotFor(frame, 0.25));
      expect(shotFor(frame, 0.001)).toEqual(shotFor(frame, 0.25));
    }
    expect(homeShotFor(0.05)).toEqual(homeShotFor(0.25));
    expect(wideShotFor(0.05)).toEqual(wideShotFor(0.25));
    expect(shotFor(FRAMES.homePortrait, 0.05).position[2]).toBeLessThan(100);
  });

  it('gives finite numbers for a bad aspect', () => {
    for (const aspect of [Number.NaN, 0, -2, Infinity]) {
      const shot = shotFor(FRAMES.home, aspect);
      expect([...shot.position, ...shot.target, shot.fov].every(Number.isFinite)).toBe(true);
      expect(shot.fov).toBeGreaterThan(0);
    }
  });
});

describe('lerpCameraShot', () => {
  const a: CameraShot = { position: [0, 4, 10], target: [0, 0, 0], fov: 20 };
  const b: CameraShot = { position: [2, 2, 4], target: [0, 1, 0], fov: 40 };

  it('is a at 0 and b at 1', () => {
    expect(lerpCameraShot(a, b, 0)).toEqual(a);
    expect(lerpCameraShot(a, b, 1)).toEqual(b);
  });

  it('moves the position, the target and the field in straight lines', () => {
    expect(lerpCameraShot(a, b, 0.5)).toEqual({ position: [1, 3, 7], target: [0, 0.5, 0], fov: 30 });
  });

  it('does not clamp, so an eased overshoot overshoots the camera too', () => {
    expect(lerpCameraShot(a, b, 1.5).fov).toBe(50);
    expect(lerpCameraShot(a, b, -0.5).position[0]).toBe(-1);
  });
});
