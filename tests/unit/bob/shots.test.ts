import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { applyCameraShot, type CameraShot, FRAMES, homeShotFor, lerpCameraShot, MAX_VFOV, shotFor, type ShotFrame, swayOf, topShotFor, wideShotFor } from '~/engine/bob/shots';

/** `p` seen through the camera a shot places on a screen of this aspect: its NDC x and y (-1..1), the camera's up being `up` (+Y unless told). */
function project(shot: CameraShot, aspect: number, p: [number, number, number], up: readonly [number, number, number] = [0, 1, 0]): [number, number] {
  const camera = new THREE.PerspectiveCamera(shot.fov, aspect, 0.1, 200);
  camera.up.set(...up);
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

  it('puts the B centres at the screen edges on a phone too (Bob: half of each B), the field held at 50 degrees', () => {
    for (const aspect of [PHONE, 0.5, 0.75, 0.9]) {
      const shot = homeShotFor(aspect);
      expect(shot.fov).toBeLessThanOrEqual(MAX_VFOV + 1e-9);
      expect(project(shot, aspect, [-3.2, 0.55, 0])[0]).toBeCloseTo(-1, 9);
      expect(project(shot, aspect, [3.2, 0.55, 0])[0]).toBeCloseTo(1, 9);
      // The B letters' outer edges are off the screen.
      for (const x of [-4.25, 4.25]) expect(Math.abs(project(shot, aspect, [x, 0, 0])[0])).toBeGreaterThan(1);
    }
    expect(homeShotFor(PHONE).fov).toBe(MAX_VFOV);
  });

  it('keeps the whole compass in the frame on a phone', () => {
    const shot = homeShotFor(PHONE);
    for (const [x, y, z] of [
      [0, 0.55 + 1.56, 0],
      [1.66, 0, 0],
      [-1.66, 0, 0],
      [0, 0, 1.66],
      [0, 0, -1.66]
    ] as const) {
      const [nx, ny] = project(shot, PHONE, [x, y, z]);
      expect(Math.abs(nx)).toBeLessThan(0.7);
      expect(Math.abs(ny)).toBeLessThan(0.5);
    }
  });

  it('takes the one home frame on every screen, so a window resized across square does not jump', () => {
    for (const aspect of [PHONE, 0.999, 1, 16 / 9]) expect(homeShotFor(aspect)).toEqual(shotFor(FRAMES.home, aspect));
    const below = homeShotFor(0.999);
    const above = homeShotFor(1.001);
    expect(Math.abs(below.fov - above.fov)).toBeLessThan(0.1);
    for (let i = 0; i < 3; i++) expect(Math.abs(below.position[i] - above.position[i])).toBeLessThan(0.01);
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
  it("frames only the O in the loader's wide shot: the outer ring (r 1.88) inside the screen with room to spare", () => {
    for (const aspect of [16 / 9, 16 / 10, 21 / 9, PHONE]) {
      const shot = wideShotFor(aspect);
      for (const p of [
        [1.88, 0, 0],
        [-1.88, 0, 0],
        [0, 0, 1.88],
        [0, 0, -1.88]
      ] as const) {
        const [nx, ny] = project(shot, aspect, [...p]);
        expect(Math.abs(nx), `${aspect} ${p}`).toBeLessThan(0.75);
        expect(Math.abs(ny), `${aspect} ${p}`).toBeLessThan(0.9);
      }
    }
  });

  it('is closer than the whole-name frame it replaces: 11.2 away, 19 degrees above, the O in the middle', () => {
    expect(FRAMES.wide).toEqual({ distance: 11.2, elevation: 19, targetY: 0.1, halfWidth: 4.0 });
    const shot = wideShotFor(16 / 9);
    expect(Math.hypot(shot.position[1] - shot.target[1], shot.position[2] - shot.target[2])).toBeCloseTo(11.2, 9);
    const [nx, ny] = project(shot, 16 / 9, [0, 0.1, 0]);
    expect(nx).toBeCloseTo(0, 9);
    expect(ny).toBeCloseTo(0, 9);
  });

  it('is the same view as the frame says', () => {
    expect(wideShotFor(16 / 9)).toEqual(shotFor(FRAMES.wide, 16 / 9));
    expect(wideShotFor(0.5)).toEqual(shotFor(FRAMES.wide, 0.5));
  });

  it('carries no up and no sway: the loader blends it, and the Rig reads +Y and full parallax from a shot that says nothing', () => {
    const shot = wideShotFor(16 / 9);
    expect(shot.up).toBeUndefined();
    expect(shot.sway).toBeUndefined();
  });
});

describe('the top shot', () => {
  it('looks straight down at the top, the far side up, the whole name across every screen', () => {
    for (const aspect of [16 / 9, 21 / 9, 1, PHONE, 0.3]) {
      const shot = topShotFor(aspect);
      expect(shot.up).toEqual([0, 0, -1]);
      expect(shot.sway).toBe(0);
      expect(shot.position[0]).toBe(0);
      expect(shot.position[2]).toBeCloseTo(0, 9);
      for (const x of [-4.25, 4.25]) expect(Math.abs(project(shot, aspect, [x, 0, 0], [0, 0, -1])[0])).toBeLessThan(0.95);
      // The B letters' tops (z -1.7) are up the screen.
      expect(project(shot, aspect, [0, 0, -1.7], [0, 0, -1])[1]).toBeGreaterThan(0);
    }
  });

  it('looks down onto the middle of the glass from straight above, its frame as the brief has it', () => {
    expect(FRAMES.top).toEqual({ distance: 12.6, elevation: 90, targetY: 0, halfWidth: 4.6, minVfov: 18 });
    const shot = topShotFor(16 / 9);
    expect(shot.target).toEqual([0, 0, 0]);
    expect(shot.position[1]).toBeCloseTo(12.6, 9);
    expect(project(shot, 16 / 9, [0, 0, 0], [0, 0, -1])[0]).toBeCloseTo(0, 9);
    expect(project(shot, 16 / 9, [0, 0, 0], [0, 0, -1])[1]).toBeCloseTo(0, 9);
  });

  it('reads like the B letters do from above: the left one on the left, the near edge at the bottom', () => {
    const shot = topShotFor(16 / 9);
    expect(project(shot, 16 / 9, [-3.2, 0, 0], [0, 0, -1])[0]).toBeLessThan(0);
    expect(project(shot, 16 / 9, [3.2, 0, 0], [0, 0, -1])[0]).toBeGreaterThan(0);
    expect(project(shot, 16 / 9, [0, 0, 1.7], [0, 0, -1])[1]).toBeLessThan(0);
  });

  it('is the frame fitted by shotFor, with the up and the sway added', () => {
    for (const aspect of [16 / 9, PHONE]) expect(topShotFor(aspect)).toEqual({ ...shotFor(FRAMES.top, aspect), up: [0, 0, -1], sway: 0 });
  });

  it('puts the half-width of the name, at the glass, on the screen edge on every screen the width fit decides', () => {
    for (const aspect of [0.3, PHONE, 1, 16 / 10, 16 / 9, 2.2]) {
      const shot = topShotFor(aspect);
      expect(project(shot, aspect, [FRAMES.top.halfWidth, 0, 0], [0, 0, -1])[0], `${aspect}`).toBeCloseTo(1, 9);
      expect(project(shot, aspect, [-FRAMES.top.halfWidth, 0, 0], [0, 0, -1])[0], `${aspect}`).toBeCloseTo(-1, 9);
    }
  });

  it('keeps its field at 18 degrees or more, so a screen wider than about 2.3:1 shows more than the half-width each side', () => {
    expect(FRAMES.top).toMatchObject({ minVfov: 18 });
    for (const aspect of [0.3, PHONE, 1, 16 / 9, 2.2, 21 / 9, 3, 32 / 9]) expect(topShotFor(aspect).fov, `${aspect}`).toBeGreaterThanOrEqual(18 - 1e-9);
    // At 16:9 the width fit is 23.2 degrees: the floor does not bind, the shot is as it was.
    expect(topShotFor(16 / 9).fov).toBeCloseTo((2 * Math.atan(4.6 / (12.6 * (16 / 9))) * 180) / Math.PI, 9);
    expect(topShotFor(16 / 9).fov).toBeGreaterThan(23);
    // At 21:9 it binds only a little: the half-width of the name is on the screen at 0.988 of the edge.
    expect(topShotFor(21 / 9).fov).toBe(18);
    expect(Math.abs(project(topShotFor(21 / 9), 21 / 9, [FRAMES.top.halfWidth, 0, 0], [0, 0, -1])[0])).toBeGreaterThan(0.98);
    expect(Math.abs(project(topShotFor(21 / 9), 21 / 9, [FRAMES.top.halfWidth, 0, 0], [0, 0, -1])[0])).toBeLessThan(1);
  });

  it('keeps the B letters whole on a wide screen: tops, feet and outer edges inside the picture, clear of the header', () => {
    // The letters span x +-4.25 and z +-1.7 (the top of the screen is -z). Seen through the real camera, with the shot's up.
    for (const aspect of [16 / 9, 2, 21 / 9, 3, 32 / 9]) {
      const camera = new THREE.PerspectiveCamera();
      applyCameraShot(camera, topShotFor(aspect), aspect);
      for (const x of [-4.25, 4.25]) {
        for (const z of [-1.7, 1.7]) {
          const v = new THREE.Vector3(x, 0, z).project(camera);
          expect(Math.abs(v.x), `x ${x} z ${z} at ${aspect}`).toBeLessThan(1);
          expect(Math.abs(v.y), `x ${x} z ${z} at ${aspect}`).toBeLessThan(0.9);
        }
      }
    }
  });

  it('holds the field at the cap and stands back on a phone, as every shot does', () => {
    const shot = topShotFor(PHONE);
    expect(shot.fov).toBe(MAX_VFOV);
    expect(shot.position[1]).toBeCloseTo(FRAMES.top.halfWidth / (PHONE * Math.tan((MAX_VFOV * Math.PI) / 360)), 9);
    expect(shot.position[1]).toBeGreaterThan(FRAMES.top.distance);
  });
});

describe('swayOf', () => {
  const HOME = homeShotFor(16 / 9);

  it('is the whole parallax for a shot that says nothing, and none for the top shot', () => {
    expect(swayOf(HOME)).toBe(1);
    expect(swayOf(wideShotFor(16 / 9))).toBe(1);
    expect(swayOf(topShotFor(16 / 9))).toBe(0);
  });

  it('is the share a shot gives, held to [0, 1]', () => {
    for (const sway of [0, 0.25, 0.5, 1]) expect(swayOf({ ...HOME, sway })).toBe(sway);
    expect(swayOf({ ...HOME, sway: 1.5 })).toBe(1);
    expect(swayOf({ ...HOME, sway: Number.POSITIVE_INFINITY })).toBe(1);
  });

  it('reads NaN and anything below 0 as none, never as more than the whole', () => {
    for (const sway of [Number.NaN, -0.5, -1, Number.NEGATIVE_INFINITY, -0]) expect(swayOf({ ...HOME, sway }), String(sway)).toBe(0);
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
    const frames: ShotFrame[] = [FRAMES.wide, FRAMES.home];
    for (const frame of frames) {
      for (const aspect of [0.3, PHONE, 1, 16 / 10, 16 / 9]) {
        const shot = shotFor(frame, aspect);
        expect(project(shot, aspect, [frame.halfWidth, frame.targetY, 0])[0]).toBeCloseTo(1, 9);
        expect(project(shot, aspect, [-frame.halfWidth, frame.targetY, 0])[0]).toBeCloseTo(-1, 9);
      }
    }
  });

  it('holds the field at the cap and stands back instead, on a narrow screen', () => {
    const frame = FRAMES.home;
    const shot = shotFor(frame, PHONE);
    expect(MAX_VFOV).toBe(50);
    expect(shot.fov).toBe(MAX_VFOV);
    const distance = Math.hypot(shot.position[1] - frame.targetY, shot.position[2]);
    expect(distance).toBeCloseTo(frame.halfWidth / (PHONE * Math.tan((MAX_VFOV * Math.PI) / 360)), 9);
    expect(distance).toBeGreaterThan(frame.distance);
  });

  it('keeps the elevation when it stands back', () => {
    const frame = FRAMES.home;
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
    for (const frame of [FRAMES.wide, FRAMES.home, FRAMES.top]) {
      expect(shotFor(frame, 0.05)).toEqual(shotFor(frame, 0.25));
      expect(shotFor(frame, 0.001)).toEqual(shotFor(frame, 0.25));
    }
    expect(homeShotFor(0.05)).toEqual(homeShotFor(0.25));
    expect(wideShotFor(0.05)).toEqual(wideShotFor(0.25));
    expect(topShotFor(0.05)).toEqual(topShotFor(0.25));
    expect(shotFor(FRAMES.home, 0.05).position[2]).toBeLessThan(100);
    expect(topShotFor(0.05).position[1]).toBeLessThan(100);
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

describe("applyCameraShot (v3's, with the shot's up)", () => {
  const HOME = homeShotFor(16 / 9);
  const WIDE = wideShotFor(16 / 9);

  it('sets fov, aspect and position, and looks at the target so it lands in the middle of the picture', () => {
    const camera = new THREE.PerspectiveCamera();
    applyCameraShot(camera, HOME, 1.5);
    expect(camera.fov).toBe(HOME.fov);
    expect(camera.aspect).toBe(1.5);
    expect(camera.position.toArray()).toEqual([...HOME.position]);
    const p = new THREE.Vector3(...HOME.target).project(camera);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.y).toBeCloseTo(0, 6);
  });

  it("keeps +Y up: the picture is never rolled, so the camera's right-hand side stays level", () => {
    const camera = new THREE.PerspectiveCamera();
    camera.up.set(1, 0, 0);
    for (const shot of [WIDE, HOME]) {
      applyCameraShot(camera, shot, 1.6);
      expect(new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).y).toBeCloseTo(0, 9);
      expect(new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).y).toBeGreaterThan(0);
    }
  });

  it("puts the camera's up where the shot says, +Y when it says nothing", () => {
    const camera = new THREE.PerspectiveCamera();
    applyCameraShot(camera, topShotFor(16 / 9), 16 / 9);
    expect(camera.up.toArray()).toEqual([0, 0, -1]);
    applyCameraShot(camera, homeShotFor(16 / 9), 16 / 9);
    expect(camera.up.toArray()).toEqual([0, 1, 0]);
  });

  it('turns the picture by the shot\'s up: from the top shot the far side of the glass is up the screen and the left B is on the left', () => {
    const camera = new THREE.PerspectiveCamera();
    applyCameraShot(camera, topShotFor(16 / 9), 16 / 9);
    const far = new THREE.Vector3(0, 0, -1.7).project(camera);
    const left = new THREE.Vector3(-3.2, 0, 0).project(camera);
    expect(far.y).toBeGreaterThan(0);
    expect(left.x).toBeLessThan(0);
  });

  it('drops a view offset left by an earlier rig', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.setViewOffset(1000, 800, 300, 200, 1000, 800);
    applyCameraShot(camera, HOME, 1.25);
    expect(camera.view?.enabled ?? false).toBe(false);
    expect(new THREE.Vector3(...HOME.target).project(camera).x).toBeCloseTo(0, 6);
  });

  it('leaves the camera as it was for an aspect or a shot that is not finite and positive', () => {
    const camera = new THREE.PerspectiveCamera(33, 2, 0.1, 100);
    camera.position.set(1, 2, 3);
    const before = camera.projectionMatrix.clone();
    applyCameraShot(camera, HOME, 0);
    applyCameraShot(camera, HOME, Number.NaN);
    applyCameraShot(camera, { ...HOME, fov: Number.NaN }, 1.6);
    applyCameraShot(camera, { ...HOME, position: [0, Number.POSITIVE_INFINITY, 3] }, 1.6);
    applyCameraShot(camera, { ...HOME, up: [0, Number.NaN, -1] }, 1.6);
    expect(camera.up.toArray()).toEqual([0, 1, 0]);
    expect(camera.fov).toBe(33);
    expect(camera.aspect).toBe(2);
    expect(camera.position.toArray()).toEqual([1, 2, 3]);
    expect(camera.projectionMatrix.equals(before)).toBe(true);
  });

  it('projects a point exactly as the camera the shot tests build does', () => {
    const camera = new THREE.PerspectiveCamera();
    applyCameraShot(camera, HOME, 16 / 9);
    const p = new THREE.Vector3(-2.15, 0, 0).project(camera);
    const [x, y] = project(HOME, 16 / 9, [-2.15, 0, 0]);
    expect(p.x).toBeCloseTo(x, 9);
    expect(p.y).toBeCloseTo(y, 9);
  });
});
