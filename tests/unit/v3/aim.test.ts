import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { COUNTRY_IDS } from '~/data/directions';
import { AngleSpring, wrapAngle } from '~/engine/AngleSpring';
import { AIM_SHELL, AIM_SNAP, NEEDLE_SPRING, pointerBearing, touchDrift } from '~/engine/v3/aim';
import { bearingRange, PLACEMENTS, pointedAt, starPositions } from '~/engine/v3/constellations';
import { applyCameraShot, homeShotFor } from '~/engine/v3/shots';
import { bearingOf } from '~/engine/instrument/dialSpec';

function homeCamera(aspect: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera();
  applyCameraShot(camera, homeShotFor(aspect), aspect);
  return camera;
}

describe('pointerBearing', () => {
  it('points at every China and Aruba star when the cursor is on it, high or low', () => {
    const camera = homeCamera(1440 / 900);
    for (const id of ['china', 'aruba'] as const) {
      const p = starPositions(id);
      for (let k = 0; k < p.length; k += 3) {
        const star = new THREE.Vector3(p[k], p[k + 1], p[k + 2]);
        const ndc = star.clone().project(camera);
        expect(pointerBearing({ x: ndc.x, y: ndc.y }, camera, AIM_SHELL)!).toBeCloseTo(bearingOf(star.x, star.z), 1);
      }
    }
  });
  it('points into the Netherlands range when the cursor is on any ship star', () => {
    const camera = homeCamera(1440 / 900);
    const p = starPositions('netherlands');
    for (let k = 0; k < p.length; k += 3) {
      const ndc = new THREE.Vector3(p[k], p[k + 1], p[k + 2]).project(camera);
      expect(pointedAt(pointerBearing({ x: ndc.x, y: ndc.y }, camera, AIM_SHELL)!)).toBe('netherlands');
    }
  });
  it('stays finite in the sky, in the corners and over the header', () => {
    const camera = homeCamera(1440 / 900);
    for (const ndc of [{ x: 0, y: 1 }, { x: -1, y: 1 }, { x: 1, y: -1 }, { x: 0.3, y: 0.98 }]) {
      const b = pointerBearing(ndc, camera, AIM_SHELL);
      expect(b).not.toBeNull();
      expect(Number.isFinite(b!)).toBe(true);
    }
  });
});

describe('touchDrift', () => {
  it('rests on the Netherlands, then China, the Netherlands, Aruba, every 28 s', () => {
    expect(touchDrift(1)).toBeCloseTo(0, 6);
    expect(touchDrift(8)).toBeCloseTo(Math.PI / 2, 6);
    expect(touchDrift(22)).toBeCloseTo(-Math.PI / 2, 6);
    expect(touchDrift(29)).toBeCloseTo(touchDrift(1), 6);
  });
  it('moves without jumps', () => {
    for (let t = 0; t < 28; t += 0.05) expect(Math.abs(touchDrift(t + 0.05) - touchDrift(t))).toBeLessThan(0.08);
  });
});

/** The smallest on-screen distance (x scaled by the aspect, as the snap measures it) from `ndc` to any star. */
function nearestStar(ndc: { x: number; y: number }, camera: THREE.PerspectiveCamera): number {
  let best = Infinity;
  for (const id of COUNTRY_IDS) {
    const p = starPositions(id);
    for (let k = 0; k < p.length; k += 3) {
      const s = new THREE.Vector3(p[k], p[k + 1], p[k + 2]).project(camera);
      best = Math.min(best, Math.hypot((s.x - ndc.x) * camera.aspect, s.y - ndc.y));
    }
  }
  return best;
}

/** Whether the ray from the camera through `ndc` rises, that is, the cursor is above the horizon. */
function risesAbove(ndc: { x: number; y: number }, camera: THREE.PerspectiveCamera): boolean {
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
  return raycaster.ray.direction.y > 0;
}

/** The difference of two bearings in radians, wrapped into (-PI, PI]. */
const turn = (a: number, b: number) => wrapAngle(a - b);

describe('pointerBearing rules', () => {
  const aspect = 1440 / 900;

  it('the ground: a cursor on the dial points at the dial point under it, wherever no star is near', () => {
    const camera = homeCamera(aspect);
    // In front of the hub, behind it, to its sides and between the rings.
    for (const [x, z] of [[0, 0.7], [0, -0.6], [-0.5, 0.3], [0.5, -0.4], [0.8, 0.1], [-0.3, -0.8], [0.2, 0.3]]) {
      const ndc = new THREE.Vector3(x, 0, z).project(camera);
      expect(nearestStar(ndc, camera)).toBeGreaterThan(AIM_SNAP);
      expect(risesAbove(ndc, camera)).toBe(false);
      expect(turn(pointerBearing({ x: ndc.x, y: ndc.y }, camera, AIM_SHELL)!, bearingOf(x, z))).toBeCloseTo(0, 6);
    }
  });
  it('the ground: a cursor in front of the hub points south, to the visitor', () => {
    const camera = homeCamera(aspect);
    const ndc = new THREE.Vector3(0, 0, 0.7).project(camera);
    expect(Math.abs(turn(pointerBearing({ x: ndc.x, y: ndc.y }, camera, AIM_SHELL)!, Math.PI))).toBeLessThan(0.01);
  });
  it('the sky: a cursor above the horizon between the ship and China, far from any star, points into the dark between them', () => {
    const camera = homeCamera(aspect);
    const [, shipEnd] = bearingRange('netherlands');
    const [chinaStart] = bearingRange('china');
    for (const ndc of [{ x: 0.3, y: 0.55 }, { x: 0.4, y: 0.6 }, { x: 0.45, y: 0.5 }]) {
      expect(risesAbove(ndc, camera)).toBe(true);
      expect(nearestStar(ndc, camera)).toBeGreaterThan(2 * AIM_SNAP);
      const b = pointerBearing(ndc, camera, AIM_SHELL)!;
      expect(b).toBeGreaterThan(shipEnd);
      expect(b).toBeLessThan(chinaStart);
      expect(pointedAt(b)).toBeNull();
    }
  });
  it('the sky: the bearing follows the cursor across, from the ship through the dark to China', () => {
    const camera = homeCamera(aspect);
    let previous = -Infinity;
    for (let x = 0; x <= 0.9; x += 0.05) {
      const ndc = { x, y: 0.55 };
      if (nearestStar(ndc, camera) <= AIM_SNAP) continue;
      const b = pointerBearing(ndc, camera, AIM_SHELL)!;
      expect(b).toBeGreaterThan(previous);
      previous = b;
    }
  });
  it('the sky: past the tangent from the camera to the shell, which no ray crosses, the cursor still points to its own side', () => {
    const camera = homeCamera(aspect);
    const left = pointerBearing({ x: -1, y: 1 }, camera, AIM_SHELL)!;
    const right = pointerBearing({ x: 1, y: 1 }, camera, AIM_SHELL)!;
    expect(pointedAt(left)).toBe('aruba');
    expect(pointedAt(right)).toBe('china');
    expect(right).toBeCloseTo(-left, 6);
  });
  it('is finite at the horizon and a hair either side of it, where the ground rule meets the plane at the end of the world', () => {
    const camera = homeCamera(aspect);
    const horizon = new THREE.Vector3(0.4, 0, -1).add(camera.position).project(camera);
    for (const dy of [1e-3, 1e-6, 1e-9, 1e-12, 1e-15, 0, -1e-15, -1e-12, -1e-9, -1e-6, -1e-3]) {
      const b = pointerBearing({ x: horizon.x, y: horizon.y + dy }, camera, AIM_SHELL);
      expect(b).not.toBeNull();
      expect(Number.isFinite(b!)).toBe(true);
    }
  });
  it('the sky: straight up the middle of the screen points north', () => {
    const camera = homeCamera(aspect);
    expect(pointerBearing({ x: 0, y: 1 }, camera, AIM_SHELL)!).toBeCloseTo(0, 6);
  });
  it('the sky: the shell is the radius the far side of the ray is read at', () => {
    const camera = homeCamera(aspect);
    const ndc = { x: 0.45, y: 0.5 };
    const near = pointerBearing(ndc, camera, 1.2)!;
    const far = pointerBearing(ndc, camera, 2.2)!;
    expect(near).not.toBeCloseTo(far, 2);
  });
  it('snaps to the nearest star and not the first one in reach', () => {
    const camera = homeCamera(aspect);
    const p = starPositions('china');
    // Two stars of the scroll's end stand close together on screen: a cursor between them is in reach of both, and takes the nearer, whichever comes first in the figure.
    const a = new THREE.Vector3(p[13 * 3], p[13 * 3 + 1], p[13 * 3 + 2]);
    const b = new THREE.Vector3(p[14 * 3], p[14 * 3 + 1], p[14 * 3 + 2]);
    const pa = a.clone().project(camera);
    const pb = b.clone().project(camera);
    const between = (t: number) => ({ x: pa.x + (pb.x - pa.x) * t, y: pa.y + (pb.y - pa.y) * t });
    const reach = (s: THREE.Vector3, ndc: { x: number; y: number }) => Math.hypot((s.x - ndc.x) * aspect, s.y - ndc.y);
    for (const t of [0.4, 0.6]) {
      expect(reach(pa, between(t))).toBeLessThan(AIM_SNAP);
      expect(reach(pb, between(t))).toBeLessThan(AIM_SNAP);
    }
    expect(pointerBearing(between(0.4), camera, AIM_SHELL)!).toBeCloseTo(bearingOf(a.x, a.z), 6);
    expect(pointerBearing(between(0.6), camera, AIM_SHELL)!).toBeCloseTo(bearingOf(b.x, b.z), 6);
  });
  it('the snap is round on screen: x is scaled by the aspect', () => {
    const camera = homeCamera(aspect);
    const p = starPositions('china');
    const star = new THREE.Vector3(p[1 * 3], p[1 * 3 + 1], p[1 * 3 + 2]);
    const s = star.clone().project(camera);
    const bearing = bearingOf(star.x, star.z);
    // Inside the circle sideways and up, just outside it either way.
    expect(pointerBearing({ x: s.x + (0.95 * AIM_SNAP) / aspect, y: s.y }, camera, AIM_SHELL)!).toBeCloseTo(bearing, 6);
    expect(pointerBearing({ x: s.x, y: s.y + 0.95 * AIM_SNAP }, camera, AIM_SHELL)!).toBeCloseTo(bearing, 6);
    expect(pointerBearing({ x: s.x + (1.1 * AIM_SNAP) / aspect, y: s.y }, camera, AIM_SHELL)!).not.toBeCloseTo(bearing, 3);
    expect(pointerBearing({ x: s.x, y: s.y + 1.1 * AIM_SNAP }, camera, AIM_SHELL)!).not.toBeCloseTo(bearing, 3);
    // A cursor 0.95 of the radius off sideways in plain NDC would be 1.5 radii away once x is scaled.
    expect(pointerBearing({ x: s.x + 0.95 * AIM_SNAP, y: s.y }, camera, AIM_SHELL)!).not.toBeCloseTo(bearing, 3);
  });
  it('works on a portrait screen too: every star is aimed at, the ship points into its range, a corner is finite', () => {
    const portrait = 390 / 844;
    const camera = homeCamera(portrait);
    for (const id of COUNTRY_IDS) {
      const p = starPositions(id);
      for (let k = 0; k < p.length; k += 3) {
        const ndc = new THREE.Vector3(p[k], p[k + 1], p[k + 2]).project(camera);
        const b = pointerBearing({ x: ndc.x, y: ndc.y }, camera, AIM_SHELL)!;
        expect(b).not.toBeNull();
        if (id === 'netherlands') expect(pointedAt(b)).toBe('netherlands');
        else expect(b).toBeCloseTo(bearingOf(p[k], p[k + 2]), 1);
      }
    }
    expect(Number.isFinite(pointerBearing({ x: -1, y: 1 }, camera, AIM_SHELL)!)).toBe(true);
  });
  it('is null for a cursor that is not a number, and for a shell with no radius when the cursor is in the sky', () => {
    const camera = homeCamera(aspect);
    expect(pointerBearing({ x: Number.NaN, y: 0 }, camera, AIM_SHELL)).toBeNull();
    expect(pointerBearing({ x: 0, y: Number.POSITIVE_INFINITY }, camera, AIM_SHELL)).toBeNull();
    expect(pointerBearing({ x: 0.2, y: 0.6 }, camera, 0)).toBeNull();
    // The ground still answers without a shell.
    expect(pointerBearing({ x: 0, y: -0.2 }, camera, 0)).not.toBeNull();
  });
  it('does not change the camera, and reads a camera that moved since its last render', () => {
    const camera = homeCamera(aspect);
    const before = camera.matrixWorld.clone();
    pointerBearing({ x: 0.1, y: 0.1 }, camera, AIM_SHELL);
    expect(camera.matrixWorld.equals(before)).toBe(true);
    // The camera's position is changed without a render: the answer follows the position.
    const ndc = new THREE.Vector3(0, 0, 0.7).project(camera);
    camera.position.x = 1;
    camera.lookAt(0, 0.25, 0);
    const b = pointerBearing({ x: ndc.x, y: ndc.y }, camera, AIM_SHELL)!;
    expect(Math.abs(turn(b, Math.PI))).toBeGreaterThan(0.02);
  });
});

describe('AIM constants', () => {
  it('the shell is the side constellations\' centre distance, and the snap is 0.07 of the screen height', () => {
    expect(AIM_SHELL).toBe(PLACEMENTS.china.distance);
    expect(AIM_SHELL).toBe(PLACEMENTS.aruba.distance);
    expect(AIM_SHELL).toBe(1.65);
    expect(AIM_SNAP).toBe(0.07);
  });
});

describe('NEEDLE_SPRING', () => {
  /** A step of 90 degrees from rest, at 60 fps: the peak as a share of the step, and the seconds to come within 2% for good. */
  function step(zeta: number, omega: number) {
    const spring = new AngleSpring(zeta, omega);
    const target = Math.PI / 2;
    let peak = 0;
    let settled = 0;
    for (let i = 1; i <= 60 * 8; i++) {
      const v = spring.step(target, 1 / 60);
      peak = Math.max(peak, v / target);
      if (Math.abs(v - target) > 0.02 * target) settled = i / 60;
    }
    return { overshoot: peak - 1, settled };
  }
  it('is the heavier, slower pair: 0.55 and 3.2', () => {
    expect(NEEDLE_SPRING).toEqual({ zeta: 0.55, omega: 3.2 });
  });
  it('lags the pointer and overshoots only a little, and settles within a few seconds', () => {
    const slow = step(NEEDLE_SPRING.zeta, NEEDLE_SPRING.omega);
    const old = step(0.4, 7);
    expect(slow.overshoot).toBeGreaterThan(0.05);
    expect(slow.overshoot).toBeLessThan(0.15);
    expect(slow.settled).toBeGreaterThan(old.settled);
    expect(slow.settled).toBeLessThan(3.5);
  });
  it('takes the short way round when the target crosses south', () => {
    const spring = new AngleSpring(NEEDLE_SPRING.zeta, NEEDLE_SPRING.omega);
    spring.set(Math.PI - 0.1);
    for (let i = 0; i < 30; i++) spring.step(-Math.PI + 0.1, 1 / 60);
    // It went through south, so its value is still near the seam and not near north.
    expect(Math.abs(spring.value)).toBeGreaterThan(2.5);
  });
});

describe('touchDrift in full', () => {
  it('rests for 4.5 s on each constellation\'s bearing, in the Netherlands, China, Netherlands, Aruba order', () => {
    const rests: [number, number, ReturnType<typeof pointedAt>][] = [
      [0, 4.5, 'netherlands'],
      [7, 11.5, 'china'],
      [14, 18.5, 'netherlands'],
      [21, 25.5, 'aruba']
    ];
    for (const [from, to, country] of rests) {
      for (let t = from; t <= to; t += 0.25) {
        expect(touchDrift(t)).toBeCloseTo(touchDrift(from), 9);
        expect(pointedAt(touchDrift(t))).toBe(country);
      }
    }
    expect(touchDrift(0)).toBeCloseTo((PLACEMENTS.netherlands.bearing * Math.PI) / 180, 9);
    expect(touchDrift(7)).toBeCloseTo((PLACEMENTS.china.bearing * Math.PI) / 180, 9);
    expect(touchDrift(21)).toBeCloseTo(wrapAngle((PLACEMENTS.aruba.bearing * Math.PI) / 180), 9);
  });
  it('travels for 2.5 s between them, by the short arc, and only there', () => {
    const legs: [number, number, number][] = [[4.5, 0, Math.PI / 2], [11.5, Math.PI / 2, 0], [18.5, 0, -Math.PI / 2], [25.5, -Math.PI / 2, 0]];
    for (const [from, a, b] of legs) {
      expect(touchDrift(from)).toBeCloseTo(a, 9);
      expect(touchDrift(from + 2.5)).toBeCloseTo(b, 9);
      // Smootherstep: halfway through the time is halfway through the arc, and it is monotonic.
      expect(touchDrift(from + 1.25)).toBeCloseTo((a + b) / 2, 9);
      let last = a;
      for (let t = from; t <= from + 2.5; t += 0.1) {
        const v = touchDrift(t);
        if (b > a) expect(v).toBeGreaterThanOrEqual(last - 1e-12);
        else expect(v).toBeLessThanOrEqual(last + 1e-12);
        last = v;
      }
    }
  });
  it('eases at both ends of a leg: it starts and arrives slowly', () => {
    const slowest = Math.abs(touchDrift(4.55) - touchDrift(4.5));
    const fastest = Math.abs(touchDrift(5.775) - touchDrift(5.725));
    expect(slowest).toBeLessThan(fastest / 20);
  });
  it('never leaves the arc between west and east, so it never sweeps through south', () => {
    for (let t = 0; t < 28; t += 0.05) expect(Math.abs(touchDrift(t))).toBeLessThanOrEqual(Math.PI / 2 + 1e-12);
  });
  it('repeats exactly every 28 s, before zero as well, and reads a NaN time as the start', () => {
    for (const t of [0.3, 5.1, 12.7, 20.2, 27.9]) {
      expect(touchDrift(t + 28)).toBeCloseTo(touchDrift(t), 9);
      expect(touchDrift(t - 28)).toBeCloseTo(touchDrift(t), 9);
      expect(touchDrift(t + 280)).toBeCloseTo(touchDrift(t), 6);
    }
    expect(touchDrift(Number.NaN)).toBe(touchDrift(0));
    expect(Number.isFinite(touchDrift(Number.POSITIVE_INFINITY))).toBe(true);
  });
  it('is continuous across the seam of the cycle', () => {
    expect(Math.abs(touchDrift(27.999) - touchDrift(28.001))).toBeLessThan(1e-3);
  });
});
