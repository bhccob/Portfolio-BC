import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { dialLayout, fitDistance, lerpShot, placeCamera } from '../../src/scripts/three/CameraRig';
const project = (camera: THREE.PerspectiveCamera, p: THREE.Vector3, w: number, h: number) => { const v = p.clone().project(camera); return [(v.x + 1) / 2 * w, (1 - v.y) / 2 * h]; };
describe('CameraRig', () => {
  it('lays the dial out wide and narrow', () => {
    expect(dialLayout(1440, 900)).toEqual({ x: 1440 * 0.62, y: 450, diameter: Math.min(576, 1440 * 0.52) });
    expect(dialLayout(390, 844)).toEqual({ x: 195, y: 844 * 0.3, diameter: Math.min(312, 844 * 0.46) });
  });
  it('puts the face centre and rim exactly where the layout asks, face-on', () => {
    for (const [w, h] of [[1440, 900], [390, 844], [844, 390]]) {
      const camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 100);
      const layout = { x: w * 0.4, y: h * 0.55, diameter: 300 };
      placeCamera(camera, { layout, tilt: 0, zoom: 1, near: 0.1 }, w, h); camera.updateMatrixWorld();
      const [cx, cy] = project(camera, new THREE.Vector3(0, 0, 0), w, h);
      expect(cx).toBeCloseTo(layout.x, 0); expect(cy).toBeCloseTo(layout.y, 0);
      const [rx] = project(camera, new THREE.Vector3(1.04, 0, 0), w, h); expect(rx - cx).toBeCloseTo(150, 0);
    }
  });
  it('solves the distance from the diameter', () => {
    expect(fitDistance(576, 900, 30)).toBeCloseTo((1.04 * 900) / (576 * Math.tan(Math.PI / 12)), 6);
  });
});

describe('CameraRig, tilted and blended', () => {
  const [w, h] = [1440, 900];
  const layout = { x: w * 0.62, y: h * 0.5, diameter: 576 };
  it('keeps the face centre on the layout at any tilt and zoom, looking at the origin', () => {
    for (const [tilt, zoom] of [[22, 1], [6, 3.8], [18, 1.7]]) {
      const camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 100);
      placeCamera(camera, { layout, tilt, zoom, near: 0.05 }, w, h);
      const [cx, cy] = project(camera, new THREE.Vector3(0, 0, 0), w, h);
      expect(cx).toBeCloseTo(layout.x, 0); expect(cy).toBeCloseTo(layout.y, 0);
      expect(camera.near).toBe(0.05); expect(camera.fov).toBe(30); expect(camera.aspect).toBeCloseTo(w / h, 9);
      expect(camera.position.x).toBe(0); expect(camera.position.y).toBeGreaterThan(0);
      expect(Math.atan2(camera.position.y, camera.position.z)).toBeCloseTo((tilt * Math.PI) / 180, 9);
      expect(camera.position.length()).toBeCloseTo(fitDistance(576 * zoom, h, 30), 9);
    }
  });
  it('draws the rim zoom times wider when the camera comes closer', () => {
    const camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 100);
    placeCamera(camera, { layout, tilt: 0, zoom: 2, near: 0.1 }, w, h);
    const [cx] = project(camera, new THREE.Vector3(0, 0, 0), w, h); const [rx] = project(camera, new THREE.Vector3(1.04, 0, 0), w, h);
    expect(rx - cx).toBeCloseTo(576, 0);
  });
  it('blends shots linearly', () => {
    const a = { layout: { x: 0, y: 10, diameter: 100 }, tilt: 22, zoom: 1, near: 0.1 };
    const b = { layout: { x: 100, y: 30, diameter: 300 }, tilt: 6, zoom: 3, near: 0.05 };
    expect(lerpShot(a, b, 0)).toEqual(a); expect(lerpShot(a, b, 1)).toEqual(b);
    const mid = lerpShot(a, b, 0.5);
    expect(mid.layout).toEqual({ x: 50, y: 20, diameter: 200 }); expect(mid.tilt).toBe(14); expect(mid.zoom).toBe(2); expect(mid.near).toBeCloseTo(0.075, 9);
  });
});

describe('CameraRig, degenerate sizes', () => {
  const finite = (camera: THREE.PerspectiveCamera) => [camera.projectionMatrix, camera.matrixWorld, camera.matrixWorldInverse, camera.position].every((m) => ('elements' in m ? m.elements : m.toArray()).every(Number.isFinite));
  it('leaves the camera as it was for a canvas with no area or a shot with no size', () => {
    const layout = { x: 100, y: 100, diameter: 300 };
    const camera = new THREE.PerspectiveCamera(30, 1.6, 0.1, 100);
    placeCamera(camera, { layout, tilt: 22, zoom: 1, near: 0.1 }, 1440, 900);
    const before = [...camera.projectionMatrix.elements, ...camera.matrixWorld.elements, camera.near, camera.aspect];
    for (const [shot, w, h] of [
      [{ layout, tilt: 22, zoom: 1, near: 0.05 }, 0, 0], [{ layout, tilt: 22, zoom: 1, near: 0.05 }, 1440, 0], [{ layout, tilt: 22, zoom: 1, near: 0.05 }, 0, 900],
      [{ layout: { ...layout, diameter: 0 }, tilt: 22, zoom: 1, near: 0.05 }, 1440, 900], [{ layout, tilt: 22, zoom: 0, near: 0.05 }, 1440, 900],
      [{ layout, tilt: 22, zoom: 1, near: 0.05 }, Number.NaN, 900]
    ] as const) {
      placeCamera(camera, shot, w, h);
      expect(finite(camera)).toBe(true);
      expect([...camera.projectionMatrix.elements, ...camera.matrixWorld.elements, camera.near, camera.aspect]).toEqual(before);
    }
  });
  it('keeps a fresh camera finite when the first call has no area', () => {
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    placeCamera(camera, { layout: { x: 0, y: 0, diameter: 0 }, tilt: 0, zoom: 1, near: 0.1 }, 0, 0);
    expect(finite(camera)).toBe(true);
  });
});
