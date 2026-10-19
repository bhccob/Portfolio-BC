import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PearlTarget, driftAt, pointerBearing, restSpot } from '../../src/scripts/three/Pearl';
import { buildInstrument } from '../../src/scripts/three/instrument/Instrument';
import { placeCamera } from '../../src/scripts/three/CameraRig';
import { handedNeedle, needleTarget } from '../../src/scripts/three/Pearl';
import { wrapAngle } from '../../src/scripts/three/AngleSpring';
describe('the pearl', () => {
  const layout = { x: 700, y: 450, diameter: 500 };
  it('rests below-right of the dial on a fine pointer, then follows it', () => {
    const p = new PearlTarget(true); expect(p.at(0, 1440, 900, layout)).toEqual(restSpot(1440, 900, layout));
    p.pointer(100, 200, 1); expect(p.at(1.1, 1440, 900, layout)).toEqual([100, 200]);
  });
  it('drifts on touch, holds a touch for 1.5 s, and lets focus win until the next input', () => {
    const p = new PearlTarget(false); const a = p.at(0, 390, 844, layout); const b = p.at(3, 390, 844, layout); expect(a).not.toEqual(b);
    p.touch(50, 60, 10); expect(p.at(11, 390, 844, layout)).toEqual([50, 60]); expect(p.at(12, 390, 844, layout)).not.toEqual([50, 60]);
    p.focus(300, 400, 20); expect(p.at(40, 390, 844, layout)).toEqual([300, 400]);
  });
  it('goes idle 20 s after the last input', () => {
    const p = new PearlTarget(true); p.pointer(1, 1, 5); expect(p.idle(24)).toBe(false); expect(p.idle(25.1)).toBe(true); p.wake(26); expect(p.idle(30)).toBe(false);
  });
  it('drifts within its bounds', () => { for (let t = 0; t < 30; t += 0.25) { const [dx, dy] = driftAt(t, 1000, 800); expect(Math.abs(dx)).toBeLessThanOrEqual(180); expect(Math.abs(dy)).toBeLessThanOrEqual(96); } });
  it('reads the bearing under the pointer, and none near the pivot', () => {
    const m = buildInstrument(); const camera = new THREE.PerspectiveCamera(30, 1440 / 900, 0.1, 100);
    placeCamera(camera, { layout: { x: 720, y: 450, diameter: 500 }, tilt: 0, zoom: 1, near: 0.1 }, 1440, 900); camera.updateMatrixWorld(); m.root.updateMatrixWorld(true);
    const east = new THREE.Vector3(0.8, 0, 0).applyMatrix4(m.dial.matrixWorld).project(camera);
    expect(pointerBearing(east.x, east.y, camera, m.dial)).toBeCloseTo(Math.PI / 2, 2);
    const centre = new THREE.Vector3(0, 0, 0).applyMatrix4(m.dial.matrixWorld).project(camera);
    expect(pointerBearing(centre.x, centre.y, camera, m.dial)).toBeNull();
  });
});

describe('the pearl, further', () => {
  const layout = { x: 700, y: 450, diameter: 500 };

  it('rests at (x + 0.42D, y + 0.42D), kept 24 px inside the canvas', () => {
    expect(restSpot(1440, 900, layout)).toEqual([910, 660]);
    // A dial low and right on a small canvas: the spot is pulled back inside.
    expect(restSpot(800, 600, { x: 700, y: 500, diameter: 400 })).toEqual([776, 576]);
    expect(restSpot(390, 844, { x: 195, y: 253, diameter: 312 })).toEqual([195 + 0.42 * 312, 253 + 0.42 * 312]);
  });

  it('drifts on a figure-eight with a 14 s period that starts on its centre', () => {
    expect(driftAt(0, 1000, 800)).toEqual([0, 0]);
    const [x, y] = driftAt(14, 1000, 800);
    expect(x).toBeCloseTo(0, 9);
    expect(y).toBeCloseTo(0, 9);
    // A quarter period out the horizontal swing is at its widest and the vertical back on the centre line.
    const [qx, qy] = driftAt(3.5, 1000, 800);
    expect(qx).toBeCloseTo(180, 6);
    expect(qy).toBeCloseTo(0, 6);
    // Twice round vertically for each horizontal swing: the two lobes of the eight.
    expect(driftAt(1.75, 1000, 800)[1]).toBeCloseTo(96, 6);
    expect(driftAt(5.25, 1000, 800)[1]).toBeCloseTo(-96, 6);
  });

  it('drifts about its rest spot on a coarse pointer, staying 24 px inside the canvas', () => {
    const p = new PearlTarget(false);
    const rest = restSpot(390, 844, { x: 195, y: 253, diameter: 312 });
    expect(p.at(0, 390, 844, { x: 195, y: 253, diameter: 312 })).toEqual(rest);
    const xs: number[] = [];
    for (let t = 0; t < 14; t += 0.25) {
      const [x, y] = p.at(t, 390, 844, { x: 195, y: 253, diameter: 312 });
      expect(x).toBeGreaterThanOrEqual(24);
      expect(x).toBeLessThanOrEqual(390 - 24 + 1e-9);
      expect(y).toBeGreaterThanOrEqual(24);
      expect(y).toBeLessThanOrEqual(844 - 24);
      xs.push(x);
    }
    // The rest spot is 40 px from the margin: the eight is narrowed to swing as far either way, not pressed flat on it.
    expect(Math.max(...xs) - rest[0]).toBeCloseTo(rest[0] - Math.min(...xs), 6);
    expect(Math.max(...xs)).toBeCloseTo(390 - 24, 6);
    expect(xs.filter((x) => Math.abs(x - (390 - 24)) < 1e-6).length).toBeLessThanOrEqual(1);
  });

  it('pauses the drift while idle and carries on from the same place when woken', () => {
    // A dial whose rest spot leaves the whole eight inside the canvas.
    const open = { x: 720, y: 300, diameter: 400 };
    const [rx, ry] = restSpot(1440, 900, open);
    const onPath = (clock: number): [number, number] => {
      const [dx, dy] = driftAt(clock, 1440, 900);
      return [rx + dx, ry + dy];
    };
    const close = ([x, y]: [number, number], [ex, ey]: [number, number]): void => {
      expect(x).toBeCloseTo(ex, 9);
      expect(y).toBeCloseTo(ey, 9);
    };
    const p = new PearlTarget(false);
    close(p.at(5, 1440, 900, open), onPath(5));
    // Idle from 20 s: the drift stops where it was then.
    expect(p.idle(21)).toBe(true);
    close(p.at(21, 1440, 900, open), onPath(20));
    close(p.at(60, 1440, 900, open), onPath(20));
    // Woken at 60 s, it carries on from there: the 40 s asleep never happened.
    p.wake(60);
    close(p.at(60, 1440, 900, open), onPath(20));
    close(p.at(61, 1440, 900, open), onPath(21));
  });

  it('eases back from a touch to the drift instead of jumping', () => {
    const p = new PearlTarget(false);
    p.touch(50, 60, 10);
    const drift = new PearlTarget(false);
    // Half-way through the return the pearl is between the touch and the drift's path.
    const [x] = p.at(12, 390, 844, layout);
    const [dx] = drift.at(12, 390, 844, layout);
    expect(x).toBeGreaterThan(50);
    expect(x).toBeLessThan(dx);
    // Once returned it is back on the path.
    expect(p.at(13, 390, 844, layout)).toEqual(drift.at(13, 390, 844, layout));
  });

  it('returns a fine pointer to the pointer after a touch, and a focus holds through idle until the pointer moves', () => {
    const p = new PearlTarget(true);
    p.pointer(400, 300, 1);
    p.touch(10, 20, 2);
    expect(p.at(3, 1440, 900, layout)).toEqual([10, 20]);
    expect(p.at(10, 1440, 900, layout)).toEqual([400, 300]);
    p.focus(600, 700, 11);
    p.wake(12);
    expect(p.at(50, 1440, 900, layout)).toEqual([600, 700]);
    p.pointer(5, 6, 51);
    expect(p.at(51, 1440, 900, layout)).toEqual([5, 6]);
  });

  it('wakes on every kind of input, and is not idle at the start', () => {
    const p = new PearlTarget(false);
    expect(p.idle(0)).toBe(false);
    expect(p.idle(19)).toBe(false);
    expect(p.idle(20.5)).toBe(true);
    p.touch(1, 1, 30);
    expect(p.idle(49)).toBe(false);
    p.focus(1, 1, 60);
    expect(p.idle(79)).toBe(false);
    expect(p.idle(81)).toBe(true);
  });

  it('reads bearings in the dial frame: south below the pivot, west to its left, none when the ray misses', () => {
    const m = buildInstrument();
    const camera = new THREE.PerspectiveCamera(30, 1440 / 900, 0.1, 100);
    placeCamera(camera, { layout: { x: 720, y: 450, diameter: 500 }, tilt: 18, zoom: 1, near: 0.1 }, 1440, 900);
    m.root.updateMatrixWorld(true);
    const at = (x: number, z: number): THREE.Vector3 => new THREE.Vector3(x, 0, z).applyMatrix4(m.dial.matrixWorld).project(camera);
    const south = at(0, 0.6);
    expect(pointerBearing(south.x, south.y, camera, m.dial)).toBeCloseTo(Math.PI, 2);
    const west = at(-0.6, 0);
    expect(pointerBearing(west.x, west.y, camera, m.dial)).toBeCloseTo(-Math.PI / 2, 2);
    // Just outside the dead zone round the pivot still reads.
    const near = at(0.16 * 1.04, 0);
    expect(pointerBearing(near.x, near.y, camera, m.dial)).toBeCloseTo(Math.PI / 2, 2);
    const inside = at(0.14 * 1.04, 0);
    expect(pointerBearing(inside.x, inside.y, camera, m.dial)).toBeNull();
    // The dial behind the camera: the rays never meet its face ahead of them.
    m.root.position.z = 100;
    m.root.updateMatrixWorld(true);
    expect(pointerBearing(0, 0, camera, m.dial)).toBeNull();
    expect(pointerBearing(Number.NaN, 0, camera, m.dial)).toBeNull();
  });

  it('reads the bearing in a turned frame as the bearing on that frame', () => {
    const m = buildInstrument();
    const camera = new THREE.PerspectiveCamera(30, 1440 / 900, 0.1, 100);
    placeCamera(camera, { layout: { x: 720, y: 450, diameter: 500 }, tilt: 0, zoom: 1, near: 0.1 }, 1440, 900);
    m.spin.rotation.y = -Math.PI / 2;
    m.root.updateMatrixWorld(true);
    // A quarter turn clockwise: the screen's east is the dial's north, while the mount (unturned) still reads east.
    const east = new THREE.Vector3(0.8, 0, 0).applyMatrix4(m.mount.matrixWorld).project(camera);
    expect(pointerBearing(east.x, east.y, camera, m.mount)).toBeCloseTo(Math.PI / 2, 2);
    expect(pointerBearing(east.x, east.y, camera, m.dial)).toBeCloseTo(0, 2);
  });
});

describe('the needle heading', () => {
  it('is the blend of the pearl and the scripted bearing when the dial is at rest', () => {
    expect(needleTarget(0.3, 1.2, 0, 0)).toBeCloseTo(0.3, 12);
    expect(needleTarget(0.3, 1.2, 1, 0)).toBeCloseTo(1.2, 12);
    expect(needleTarget(0.3, 1.2, 0.5, 0)).toBeCloseTo(0.75, 12);
    // A whole turn is at rest too.
    expect(needleTarget(0.3, 1.2, 1, 2 * Math.PI)).toBeCloseTo(1.2, 9);
  });

  it('holds the pearl still in the world while the dial turns, and turns the scripted bearing with it', () => {
    // On the pearl (weight 0) the heading is the pearl's, in the mount's frame, whatever the spin.
    expect(needleTarget(0.3, 1.2, 0, -1)).toBeCloseTo(0.3, 12);
    // Scripted east on a dial turned a quarter clockwise (spin −π/2) points at the screen's south: the mount's π.
    const heading = needleTarget(0, Math.PI / 2, 1, -Math.PI / 2);
    expect(Math.abs(wrapAngle(heading - Math.PI))).toBeLessThan(1e-12);
    // And on the dial (heading + spin) it is still east.
    expect(wrapAngle(heading + -Math.PI / 2)).toBeCloseTo(Math.PI / 2, 12);
  });
});

describe('the needle handed over', () => {
  it("takes the loader's bearing and velocity", () => {
    expect(handedNeedle({ value: 0.2, velocity: 3 }, { bearing: 1.1, velocity: -0.5 })).toEqual({ value: 1.1, velocity: -0.5 });
  });

  it("keeps the spring's own value for anything that is not a finite number", () => {
    expect(handedNeedle({ value: 0.2, velocity: 3 }, { bearing: Number.NaN, velocity: -0.5 })).toEqual({ value: 0.2, velocity: -0.5 });
    expect(handedNeedle({ value: 0.2, velocity: 3 }, { bearing: 1.1, velocity: Infinity })).toEqual({ value: 1.1, velocity: 3 });
    expect(handedNeedle({ value: 0.2, velocity: 3 }, { bearing: -Infinity, velocity: Number.NaN })).toEqual({ value: 0.2, velocity: 3 });
  });
});
