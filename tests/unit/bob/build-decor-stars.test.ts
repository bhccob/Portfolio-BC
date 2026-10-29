import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildDecorStars, type DecorPose } from '~/engine/bob/build/decorStars';

const CENTRE: [number, number, number] = [0, 0, 0];
const MIDDLE = -9;
const SIZE = { width: 1440, height: 900 };

function cameraLookingAt(at: THREE.Vector3): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(38, SIZE.width / SIZE.height, 0.1, 500);
  camera.position.set(0, MIDDLE, 0);
  camera.lookAt(at);
  camera.updateMatrixWorld();
  return camera;
}
const pose = (camera: THREE.Camera, over: Partial<DecorPose> = {}): DecorPose => ({ level: 1, clock: 0, dt: 1 / 60, camera, keepOut: null, size: SIZE, ...over });
const stars = (group: THREE.Group): THREE.Object3D[] => group.children.filter((o) => o.name.startsWith('decor:star:'));
const rings = (group: THREE.Group): THREE.Object3D[] => {
  const found: THREE.Object3D[] = [];
  group.traverse((o) => o.name.startsWith('decor:ring:') && found.push(o));
  return found;
};
/** The opacity of star `k`'s light. */
const lightOf = (star: THREE.Object3D): number => {
  let opacity = -1;
  star.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
    if (m && opacity < 0) opacity = m.opacity;
  });
  return opacity;
};

// The Q&A's solid stars round it all, for decoration alone (spec 2026-10-29-bob-stack-2-design.md, goal 1; the mock-up's).
describe('the decor stars', () => {
  it('makes 30 stars, every third ringed', () => {
    const decor = buildDecorStars('high', CENTRE, MIDDLE);
    expect(stars(decor.group)).toHaveLength(30);
    // Ten stars ringed, two gold gyroscope rings each.
    expect(rings(decor.group)).toHaveLength(20);
    decor.dispose();
  });

  it('halves them on low, with no rings', () => {
    const decor = buildDecorStars('low', CENTRE, MIDDLE);
    expect(stars(decor.group)).toHaveLength(15);
    expect(rings(decor.group)).toHaveLength(0);
    decor.dispose();
  });

  it('keeps them out of the questions\' way and far enough off', () => {
    const decor = buildDecorStars('high', CENTRE, MIDDLE);
    for (const star of stars(decor.group)) {
      const r = Math.hypot(star.position.x, star.position.y - MIDDLE * 0.4, star.position.z);
      expect(r).toBeGreaterThanOrEqual(20 - 1e-9);
      expect(r).toBeLessThanOrEqual(75 + 1e-9);
    }
    decor.dispose();
  });

  it('fades a star behind the answer', () => {
    const decor = buildDecorStars('high', CENTRE, MIDDLE);
    const [first, second] = stars(decor.group) as [THREE.Object3D, THREE.Object3D];
    const camera = cameraLookingAt(first.getWorldPosition(new THREE.Vector3()));
    // The answer's box over the middle of the screen, where the first star stands.
    const keepOut = { x: SIZE.width / 2 - 100, y: SIZE.height / 2 - 100, w: 200, h: 200 };
    decor.pose(pose(camera));
    const before = lightOf(first);
    for (let i = 0; i < 120; i++) decor.pose(pose(camera, { keepOut }));
    expect(lightOf(first)).toBeLessThan(before * 0.2);
    expect(lightOf(second)).toBeGreaterThan(0.2);
    decor.dispose();
  });

  it('stands still with the clock still', () => {
    const decor = buildDecorStars('high', CENTRE, MIDDLE);
    const camera = cameraLookingAt(new THREE.Vector3(0, MIDDLE, -10));
    decor.pose(pose(camera, { clock: 3 }));
    const star = stars(decor.group)[4]!;
    const turned = star.rotation.toArray();
    const light = lightOf(star);
    decor.pose(pose(camera, { clock: 3 }));
    expect(star.rotation.toArray()).toEqual(turned);
    expect(lightOf(star)).toBe(light);
    decor.pose(pose(camera, { clock: 5 }));
    expect(star.rotation.toArray()).not.toEqual(turned);
    decor.dispose();
  });

  it('is dark at level 0', () => {
    const decor = buildDecorStars('high', CENTRE, MIDDLE);
    decor.pose(pose(cameraLookingAt(new THREE.Vector3(0, 0, -1)), { level: 0 }));
    expect(decor.group.visible).toBe(false);
    decor.dispose();
  });
});
