import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Outline } from './shapes';

/**
 * Sizes and fasteners the layers share: the device's outline, where the four
 * corner screws go through it, and the screws themselves (one geometry each,
 * drawn instanced).
 */

/** The device seen from above: 3.2 × 1.83 world units, corners of radius 0.15. */
export const DEVICE: Outline = { width: 3.2, depth: 1.83, radius: 0.15 };

/** How far the frame's opening is inset from the device's outline. */
export const FRAME_INSET = 0.11;

/** A screw head's radius. */
export const SCREW_RADIUS = 0.038;

/** A pan head's height above the face it sits on. */
export const SCREW_HEAD = 0.007;

/**
 * The four corner screws: on each corner's diagonal, halfway across the
 * frame's band (between the opening's corner arc and the outline's), so they
 * clear the glass's rounded corners and go through the frame's solid wall.
 */
export const SCREW_SPOTS: readonly (readonly [number, number])[] = (() => {
  const reach = DEVICE.radius - FRAME_INSET / 2;
  const d = reach / Math.SQRT2;
  const cx = DEVICE.width / 2 - DEVICE.radius;
  const cz = DEVICE.depth / 2 - DEVICE.radius;
  return [
    [cx + d, cz + d],
    [-cx - d, cz + d],
    [-cx - d, -cz - d],
    [cx + d, -cz - d]
  ];
})();

/** A domed pan head standing on y = 0, apex at SCREW_HEAD. */
export function screwHeadGeometry(): THREE.BufferGeometry {
  const R = SCREW_RADIUS;
  const h = SCREW_HEAD;
  const profile: [number, number][] = [
    [0, h],
    [0.35 * R, h - 0.0003],
    [0.65 * R, h - 0.0012],
    [0.85 * R, h - 0.0026],
    [0.95 * R, h - 0.0042],
    [R, h - 0.006],
    [R, 0.0005],
    [R * 0.96, 0]
  ];
  // The lathe wants its profile bottom to top, for outward normals.
  return new THREE.LatheGeometry(
    profile.reverse().map(([r, y]) => new THREE.Vector2(r, y)),
    24
  );
}

/** The head's cross slot: two dark bars sunk into the dome, their tops level with the apex. */
export function screwSlotGeometry(): THREE.BufferGeometry {
  const R = SCREW_RADIUS;
  const depth = 0.004;
  const a = new THREE.BoxGeometry(1.25 * R, depth, 0.2 * R);
  const b = new THREE.BoxGeometry(0.2 * R, depth, 1.25 * R);
  const cross = mergeGeometries([a, b])!;
  a.dispose();
  b.dispose();
  cross.translate(0, SCREW_HEAD - depth / 2 + 0.0001, 0);
  return cross;
}

/** Length of a threaded standoff. */
export const STANDOFF_LENGTH = 0.15;

/**
 * A threaded brass standoff hanging from y = 0 down to −STANDOFF_LENGTH:
 * ridges every 0.007, a chamfered tip.
 */
export function standoffGeometry(): THREE.BufferGeometry {
  const pitch = 0.007;
  const outer = 0.0185;
  const inner = 0.0155;
  const points: THREE.Vector2[] = [new THREE.Vector2(0, 0), new THREE.Vector2(outer, 0)];
  let y = -0.004;
  let ridge = false;
  while (y > -STANDOFF_LENGTH + 0.008) {
    points.push(new THREE.Vector2(ridge ? outer : inner, y));
    y -= pitch / 2;
    ridge = !ridge;
  }
  points.push(new THREE.Vector2(inner, -STANDOFF_LENGTH + 0.003));
  points.push(new THREE.Vector2(inner - 0.004, -STANDOFF_LENGTH));
  points.push(new THREE.Vector2(0, -STANDOFF_LENGTH));
  // The lathe wants its profile bottom to top.
  return new THREE.LatheGeometry(points.reverse(), 14);
}

/** One instanced mesh with an instance at each spot (x, y, z), turned by `yaw`. */
export function instanced(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  spots: readonly (readonly [number, number, number])[],
  name: string,
  yaw: readonly number[] = []
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, spots.length);
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Matrix4();
  spots.forEach(([x, y, z], i) => {
    matrix.makeTranslation(x, y, z);
    if (yaw[i]) matrix.multiply(rotation.makeRotationY(yaw[i]));
    mesh.setMatrixAt(i, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  mesh.name = name;
  return mesh;
}

/** Each screw a slightly different turn, as screws driven by hand are. */
export const SCREW_TURNS = [0.3, 1.1, 0.75, 0.05];
