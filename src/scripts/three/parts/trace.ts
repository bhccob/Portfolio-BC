import * as THREE from 'three';
import { gold } from './slab';

/**
 * Board traces: flat gold ribbons along a path of XZ points, mitred at every
 * bend, with a round via at each end. Flat and facing up, so they read as
 * printed on the board they lie on.
 */

type Point = readonly [number, number];

/** Width of a trace, and the radius of the via at each end. */
const TRACE_WIDTH = 0.026;
const VIA_RADIUS = 0.03;
const VIA_SEGMENTS = 16;

/** The longest a mitre may grow, as a multiple of half the width, so a sharp bend cannot spike. */
const MAX_MITRE = 4;

/** The unit normal to the left of the segment a → b. */
function side(a: Point, b: Point): Point {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const length = Math.hypot(dx, dz) || 1;
  return [-dz / length, dx / length];
}

/** The step from a point to the ribbon's edge there: along the mitre of the segments that meet at it. */
function mitre(before: Point | undefined, point: Point, after: Point | undefined): Point {
  const a = before ? side(before, point) : undefined;
  const b = after ? side(point, after) : undefined;
  if (!a || !b) return a ?? b ?? [0, 0];
  const mx = a[0] + b[0];
  const mz = a[1] + b[1];
  const length = Math.hypot(mx, mz);
  if (length < 1e-9) return b;
  const ux = mx / length;
  const uz = mz / length;
  const scale = Math.min(MAX_MITRE, 1 / (ux * b[0] + uz * b[1]));
  return [ux * scale, uz * scale];
}

/** A flat gold trace through `points` (x, z) at height `y`. */
export function trace(points: readonly Point[], y: number): THREE.Mesh {
  const positions: number[] = [];
  const indices: number[] = [];

  const vertex = (x: number, z: number): number => {
    positions.push(x, y, z);
    return positions.length / 3 - 1;
  };
  // Keeps every triangle facing up, whichever way the path runs.
  const triangle = (a: number, b: number, c: number): void => {
    const ux = positions[b * 3] - positions[a * 3];
    const uz = positions[b * 3 + 2] - positions[a * 3 + 2];
    const vx = positions[c * 3] - positions[a * 3];
    const vz = positions[c * 3 + 2] - positions[a * 3 + 2];
    const up = uz * vx - ux * vz;
    if (Math.abs(up) < 1e-12) return;
    if (up > 0) indices.push(a, b, c);
    else indices.push(a, c, b);
  };

  const half = TRACE_WIDTH / 2;
  const edges = points.map((point, i) => {
    const [mx, mz] = mitre(i > 0 ? points[i - 1] : undefined, point, i + 1 < points.length ? points[i + 1] : undefined);
    return [vertex(point[0] + mx * half, point[1] + mz * half), vertex(point[0] - mx * half, point[1] - mz * half)] as const;
  });
  for (let i = 0; i + 1 < edges.length; i++) {
    const [left, right] = edges[i];
    const [nextLeft, nextRight] = edges[i + 1];
    triangle(left, right, nextRight);
    triangle(left, nextRight, nextLeft);
  }

  const ends = points.length > 1 ? [points[0], points[points.length - 1]] : points;
  for (const [x, z] of ends) {
    const middle = vertex(x, z);
    const first = positions.length / 3;
    for (let step = 0; step < VIA_SEGMENTS; step++) {
      const angle = (step / VIA_SEGMENTS) * Math.PI * 2;
      vertex(x + Math.cos(angle) * VIA_RADIUS, z + Math.sin(angle) * VIA_RADIUS);
    }
    for (let step = 0; step < VIA_SEGMENTS; step++) {
      triangle(middle, first + step, first + ((step + 1) % VIA_SEGMENTS));
    }
  }

  const normals = new Float32Array(positions.length);
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  const mesh = new THREE.Mesh(geometry, gold());
  mesh.name = 'trace';
  return mesh;
}
