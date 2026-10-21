import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { COUNTRY_IDS } from '~/data/directions';
import { DIAL, onDial } from '~/engine/instrument/dialSpec';
import { CHIP, ON_STROKES, pinPosition } from '~/engine/v3/chipSpec';
import { starPositions } from '~/engine/v3/constellations';
import { applyCameraShot, type CameraShot, DESIGN_ASPECT, homeShotFor, lerpCameraShot, loaderShotFor, SHOTS } from '~/engine/v3/shots';

function project(aspect: number, shot = homeShotFor(aspect)) {
  const camera = new THREE.PerspectiveCamera();
  applyCameraShot(camera, shot, aspect);
  return (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).project(camera);
}
const rim = () => [...Array(72).keys()].map((k) => onDial(k * 5, DIAL.rim));
const centroid = (p: Float32Array) => {
  let x = 0, y = 0, z = 0; const n = p.length / 3;
  for (let k = 0; k < p.length; k += 3) { x += p[k]; y += p[k + 1]; z += p[k + 2]; }
  return [x / n, y / n, z / n] as const;
};

describe('the home shot', () => {
  for (const [name, aspect] of [['landscape', 1440 / 900], ['portrait', 390 / 844]] as const) {
    it(`${name}: the whole rim is in frame`, () => {
      const at = project(aspect);
      for (const [x, z] of rim()) {
        const p = at(x, 0, z);
        expect(Math.abs(p.x)).toBeLessThanOrEqual(0.98);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(0.98);
      }
    });
    it(`${name}: each constellation's centre is in frame`, () => {
      const at = project(aspect);
      for (const id of COUNTRY_IDS) {
        const p = at(...centroid(starPositions(id)));
        expect(Math.abs(p.x)).toBeLessThanOrEqual(0.95);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(0.95);
      }
    });
  }
  it('landscape: every star is in frame, as in frame 04', () => {
    const at = project(1440 / 900);
    for (const id of COUNTRY_IDS) {
      const s = starPositions(id);
      for (let k = 0; k < s.length; k += 3) {
        const p = at(s[k], s[k + 1], s[k + 2]);
        expect(Math.abs(p.x)).toBeLessThanOrEqual(0.98);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(0.98);
      }
    }
  });
});

describe('the loader shot', () => {
  it('landscape: the chip sits left of centre, the right half left dark', () => {
    const p = project(1440 / 900, SHOTS.loaderMacro)(0, -0.15, 0);
    expect(p.x).toBeGreaterThan(-0.55);
    expect(p.x).toBeLessThan(-0.1);
  });
});

const PHONE = 390 / 844;
const TABLET = 768 / 1024;

/** The chip's four top corners and its 64 pins, on the board, as the loader draws them. */
function chipPoints(): [number, number, number][] {
  const h = CHIP.size / 2;
  const top = CHIP.board + CHIP.height;
  const points: [number, number, number][] = [[-h, top, -h], [h, top, -h], [h, top, h], [-h, top, h]];
  for (let i = 0; i < 64; i++) {
    const { x, z } = pinPosition(i);
    points.push([x, CHIP.board, z]);
  }
  return points;
}

/** The camera's angle above the horizontal, looking from `from` at `to`, in degrees. */
function elevation(from: readonly number[], to: readonly number[]): number {
  return (Math.atan2(from[1] - to[1], Math.hypot(from[0] - to[0], from[2] - to[2])) * 180) / Math.PI;
}

/** The aspect SHOTS.home is tuned for, a 1440 x 900 screen. */
const DESIGN = 1440 / 900;
const FOUR_BY_THREE = 1024 / 768;
const FIVE_BY_FOUR = 1280 / 1024;

describe('the home shot on other screens', () => {
  it('is SHOTS.home itself for the design aspect and anything wider, and for a NaN aspect', () => {
    for (const aspect of [DESIGN, 1920 / 1200, 1.78, 2, 2.4, 3.5, Number.NaN]) expect(homeShotFor(aspect)).toBe(SHOTS.home);
  });
  it('names the design aspect, a 1440 x 900 screen, and keeps the home on the compass\'s axis plane, as the reframing assumes', () => {
    expect(DESIGN_ASPECT).toBe(DESIGN);
    expect(SHOTS.home.position[0]).toBe(0);
    expect(SHOTS.home.target[0]).toBe(0);
    expect(SHOTS.home.target[2]).toBe(0);
    expect(SHOTS.home.position[2]).toBeGreaterThan(0);
  });
  it('is not SHOTS.home for a screen narrower than the design, down to a square and below', () => {
    for (const aspect of [1.59, 1.5, FOUR_BY_THREE, FIVE_BY_FOUR, 1, 0.75, PHONE]) expect(homeShotFor(aspect)).not.toBe(SHOTS.home);
  });
  it('is SHOTS.home to the last digit as the screen narrows past the design aspect, so the camera does not jump', () => {
    const just = homeShotFor(DESIGN - 1e-9);
    SHOTS.home.position.forEach((v, i) => expect(just.position[i]).toBeCloseTo(v, 6));
    SHOTS.home.target.forEach((v, i) => expect(just.target[i]).toBeCloseTo(v, 6));
    expect(just.fov).toBeCloseTo(SHOTS.home.fov, 6);
  });
  for (const [name, width, height] of [['1024 x 768 (4:3)', 1024, 768], ['1280 x 1024 (5:4)', 1280, 1024]] as const) {
    it(`${name}: the whole rim and every star are within 0.98, and the centres within 0.95`, () => {
      const aspect = width / height;
      const at = project(aspect);
      for (const [x, z] of rim()) {
        const p = at(x, 0, z);
        expect(Math.abs(p.x)).toBeLessThanOrEqual(0.98);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(0.98);
      }
      for (const id of COUNTRY_IDS) {
        const s = starPositions(id);
        for (let k = 0; k < s.length; k += 3) {
          const p = at(s[k], s[k + 1], s[k + 2]);
          expect(Math.abs(p.x)).toBeLessThanOrEqual(0.98);
          expect(Math.abs(p.y)).toBeLessThanOrEqual(0.98);
        }
        const c = at(...centroid(s));
        expect(Math.abs(c.x)).toBeLessThanOrEqual(0.95);
        expect(Math.abs(c.y)).toBeLessThanOrEqual(0.95);
      }
    });
  }
  it('fits every aspect from the design down, not just the ones named: a fine sweep', () => {
    for (let aspect = DESIGN - 0.001; aspect >= 0.25; aspect -= 0.01) {
      const at = project(aspect);
      for (const id of COUNTRY_IDS) {
        const s = starPositions(id);
        for (let k = 0; k < s.length; k += 3) {
          const p = at(s[k], s[k + 1], s[k + 2]);
          expect(Math.abs(p.x)).toBeLessThanOrEqual(0.98);
          expect(Math.abs(p.y)).toBeLessThanOrEqual(0.98);
        }
      }
      for (const [x, z] of rim()) {
        const p = at(x, 0, z);
        expect(Math.abs(p.x)).toBeLessThanOrEqual(0.98);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(0.98);
      }
    }
  });
  for (const aspect of [0.25, PHONE, 0.6, TABLET, 0.99, 1, FIVE_BY_FOUR, FOUR_BY_THREE, 1.5, 1.59]) {
    it(`aspect ${aspect.toFixed(2)}: the rim and every star are in frame`, () => {
      const at = project(aspect);
      for (const [x, z] of rim()) {
        const p = at(x, 0, z);
        expect(Math.abs(p.x)).toBeLessThanOrEqual(0.98);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(0.98);
      }
      for (const id of COUNTRY_IDS) {
        const s = starPositions(id);
        for (let k = 0; k < s.length; k += 3) {
          const p = at(s[k], s[k + 1], s[k + 2]);
          expect(Math.abs(p.x)).toBeLessThanOrEqual(0.98);
          expect(Math.abs(p.y)).toBeLessThanOrEqual(0.98);
        }
      }
    });
  }
  it('widescreen: the rim and every star stay in frame', () => {
    for (const aspect of [1.78, 2.4]) {
      const at = project(aspect);
      for (const id of COUNTRY_IDS) {
        const s = starPositions(id);
        for (let k = 0; k < s.length; k += 3) expect(Math.abs(at(s[k], s[k + 1], s[k + 2]).x)).toBeLessThanOrEqual(0.98);
      }
      for (const [x, z] of rim()) expect(Math.abs(at(x, 0, z).x)).toBeLessThanOrEqual(0.98);
    }
  });
  it('a narrower screen pulls back, a portrait one widens too, and the shot is continuous as the screen narrows', () => {
    const distance = (s: CameraShot) => Math.hypot(s.position[0] - s.target[0], s.position[1] - s.target[1], s.position[2] - s.target[2]);
    expect(distance(homeShotFor(PHONE))).toBeGreaterThan(distance(SHOTS.home) * 1.5);
    expect(distance(homeShotFor(FOUR_BY_THREE))).toBeGreaterThan(distance(SHOTS.home));
    expect(homeShotFor(PHONE).fov).toBeGreaterThan(SHOTS.home.fov);
    expect(homeShotFor(FOUR_BY_THREE).fov).toBe(SHOTS.home.fov);
    let previous = distance(SHOTS.home);
    for (let aspect = DESIGN - 0.01; aspect >= 0.3; aspect -= 0.01) {
      const d = distance(homeShotFor(aspect));
      expect(d).toBeGreaterThan(previous);
      expect(d / previous).toBeLessThan(1.04);
      previous = d;
    }
  });
  it('keeps the camera low, looking north over the rim, with the compass centred and a little below the middle', () => {
    for (const aspect of [DESIGN, 1.5, FOUR_BY_THREE, FIVE_BY_FOUR, 1, PHONE]) {
      const shot = homeShotFor(aspect);
      expect(elevation(shot.position, [0, 0, 0])).toBeGreaterThan(8);
      expect(elevation(shot.position, [0, 0, 0])).toBeLessThan(20);
      expect(shot.position[0]).toBe(0);
      expect(shot.position[2]).toBeGreaterThan(0);
      const hub = project(aspect)(0, 0, 0);
      expect(Math.abs(hub.x)).toBeLessThan(1e-6);
      expect(hub.y).toBeLessThan(0);
      expect(hub.y).toBeGreaterThan(-0.4);
    }
  });
  it('frames anything thinner than 1:4 as 1:4, and stays finite for an aspect of zero or below', () => {
    for (const aspect of [0.1, 0, -1]) {
      const shot = homeShotFor(aspect);
      expect([...shot.position, ...shot.target, shot.fov].every(Number.isFinite)).toBe(true);
      expect(shot).toEqual(homeShotFor(0.25));
    }
  });
});

describe('the loader shots on other screens', () => {
  it('macro, landscape: from about 50 degrees above and the west, the whole chip in the left half, about a third of the width', () => {
    const shot = SHOTS.loaderMacro;
    const chipTop = [0, CHIP.board + CHIP.height, 0];
    expect(elevation(shot.position, chipTop)).toBeGreaterThan(45);
    expect(elevation(shot.position, chipTop)).toBeLessThan(55);
    expect(shot.position[0]).toBeLessThan(0);
    const at = project(1440 / 900, shot);
    const xs = chipPoints().map(([x, y, z]) => at(x, y, z).x);
    expect(Math.max(...xs)).toBeLessThan(0);
    expect(Math.min(...xs)).toBeGreaterThan(-0.98);
    const width = Math.max(...xs) - Math.min(...xs);
    expect(width).toBeGreaterThan(0.45);
    expect(width).toBeLessThan(0.8);
  });
  it('macro, landscape: the engraved ON is in frame', () => {
    const at = project(1440 / 900, SHOTS.loaderMacro);
    for (const stroke of ON_STROKES) {
      for (const [x, z] of stroke.points) {
        const p = at(x, CHIP.board + CHIP.height, z);
        expect(Math.abs(p.x)).toBeLessThan(0.98);
        expect(Math.abs(p.y)).toBeLessThan(0.98);
      }
    }
  });
  it('rise, landscape: high over the board, the compass in frame with the chip near the middle', () => {
    expect(elevation(SHOTS.loaderRise.position, [0, 0, 0])).toBeGreaterThan(35);
    const at = project(1440 / 900, SHOTS.loaderRise);
    for (const [x, z] of rim()) {
      const p = at(x, 0, z);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(0.98);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(0.98);
    }
    const chip = at(0, CHIP.board, 0);
    expect(Math.abs(chip.x)).toBeLessThan(0.3);
    expect(Math.abs(chip.y)).toBeLessThan(0.3);
  });
  it('loaderShotFor is the shot itself on a landscape screen', () => {
    for (const id of ['loaderMacro', 'loaderRise'] as const) {
      expect(loaderShotFor(id, 1440 / 900)).toBe(SHOTS[id]);
      expect(loaderShotFor(id, Number.NaN)).toBe(SHOTS[id]);
    }
  });
  for (const aspect of [0.25, PHONE, TABLET]) {
    it(`aspect ${aspect.toFixed(2)}: the chip, its pins and the ON fit the width, and the rim fits too`, () => {
      const macro = project(aspect, loaderShotFor('loaderMacro', aspect));
      for (const [x, y, z] of chipPoints()) {
        const p = macro(x, y, z);
        expect(Math.abs(p.x)).toBeLessThanOrEqual(0.98);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(0.98);
      }
      const rise = project(aspect, loaderShotFor('loaderRise', aspect));
      for (const [x, z] of rim()) {
        const p = rise(x, 0, z);
        expect(Math.abs(p.x)).toBeLessThanOrEqual(0.98);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(0.98);
      }
    });
  }
  it('a portrait loader shot keeps its angle above the board and looks at its subject', () => {
    const portrait = loaderShotFor('loaderMacro', PHONE);
    const chipTop = [0, CHIP.board + CHIP.height, 0] as const;
    expect(elevation(portrait.position, chipTop)).toBeCloseTo(elevation(SHOTS.loaderMacro.position, chipTop), 6);
    expect(portrait.target).toEqual(chipTop);
    expect(portrait.fov).toBe(SHOTS.loaderMacro.fov);
  });
});

describe('lerpCameraShot', () => {
  const a: CameraShot = { position: [0, 2, 4], target: [1, 0, 0], fov: 30 };
  const b: CameraShot = { position: [2, 0, 0], target: [3, 2, 2], fov: 50 };
  it('is a at 0, b at 1 and the straight-line middle at a half', () => {
    expect(lerpCameraShot(a, b, 0)).toEqual(a);
    expect(lerpCameraShot(a, b, 1)).toEqual(b);
    expect(lerpCameraShot(a, b, 0.5)).toEqual({ position: [1, 1, 2], target: [2, 1, 1], fov: 40 });
  });
  it('is not clamped, so an overshooting ease overshoots the camera', () => {
    expect(lerpCameraShot(a, b, 2).fov).toBe(70);
    expect(lerpCameraShot(a, b, -1).position).toEqual([-2, 4, 8]);
  });
  it('does not change either shot', () => {
    lerpCameraShot(a, b, 0.3);
    expect(a).toEqual({ position: [0, 2, 4], target: [1, 0, 0], fov: 30 });
    expect(b).toEqual({ position: [2, 0, 0], target: [3, 2, 2], fov: 50 });
  });
});

describe('applyCameraShot', () => {
  it('sets fov, aspect and position, and looks at the target so it lands in the middle of the picture', () => {
    const camera = new THREE.PerspectiveCamera();
    applyCameraShot(camera, SHOTS.home, 1.5);
    expect(camera.fov).toBe(SHOTS.home.fov);
    expect(camera.aspect).toBe(1.5);
    expect(camera.position.toArray()).toEqual([...SHOTS.home.position]);
    const p = new THREE.Vector3(...SHOTS.home.target).project(camera);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.y).toBeCloseTo(0, 6);
  });
  it('keeps +Y up: the picture is never rolled, so the camera\'s right-hand side stays level', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.up.set(1, 0, 0);
    for (const shot of [SHOTS.loaderMacro, SHOTS.loaderRise, SHOTS.home]) {
      applyCameraShot(camera, shot, 1.6);
      expect(new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).y).toBeCloseTo(0, 9);
      expect(new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).y).toBeGreaterThan(0);
    }
  });
  it('drops a view offset left by an earlier rig', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.setViewOffset(1000, 800, 300, 200, 1000, 800);
    applyCameraShot(camera, SHOTS.home, 1.25);
    expect(camera.view?.enabled ?? false).toBe(false);
    expect(new THREE.Vector3(...SHOTS.home.target).project(camera).x).toBeCloseTo(0, 6);
  });
  it('leaves the camera as it was for an aspect or a shot that is not finite and positive', () => {
    const camera = new THREE.PerspectiveCamera(33, 2, 0.1, 100);
    camera.position.set(1, 2, 3);
    const before = camera.projectionMatrix.clone();
    applyCameraShot(camera, SHOTS.home, 0);
    applyCameraShot(camera, SHOTS.home, Number.NaN);
    applyCameraShot(camera, { ...SHOTS.home, fov: Number.NaN }, 1.6);
    applyCameraShot(camera, { ...SHOTS.home, position: [0, Number.POSITIVE_INFINITY, 3] }, 1.6);
    expect(camera.fov).toBe(33);
    expect(camera.aspect).toBe(2);
    expect(camera.position.toArray()).toEqual([1, 2, 3]);
    expect(camera.projectionMatrix.equals(before)).toBe(true);
  });
});
