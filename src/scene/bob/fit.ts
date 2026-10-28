/**
 * Framing by fit (spec 2026-10-28-bob-quantum-stack-design.md; the mock-up Bob approved,
 * .superpowers/holo-world-4-mockup/main.ts, its `fit`): where a point falls on the screen for a shot, and how far out a
 * camera must stand to hold a set of points inside a box of the screen. Pure: three's own projection, written out, so
 * the path stays free of three and the tests read the very numbers the scene applies.
 */
import type { CameraShot } from '~/engine/bob/shots';

export type Vec3 = [number, number, number];
type R3 = readonly [number, number, number];

const DEG = Math.PI / 180;

/**
 * Where `point` falls on the screen for `shot` on a screen of this aspect, in NDC (−1..1 across and up), and whether it
 * is in front of the camera. The camera is three's after `lookAt`: its up the shot's (+y if none).
 */
export function project(point: R3, shot: CameraShot, aspect: number): { x: number; y: number; front: boolean } {
  const [px, py, pz] = shot.position;
  const fx0 = shot.target[0] - px;
  const fy0 = shot.target[1] - py;
  const fz0 = shot.target[2] - pz;
  const fl = Math.hypot(fx0, fy0, fz0) || 1;
  const fx = fx0 / fl;
  const fy = fy0 / fl;
  const fz = fz0 / fl;
  const [ux0, uy0, uz0] = shot.up ?? [0, 1, 0];
  // right = forward × up, then the camera's own up = right × forward.
  let rx = fy * uz0 - fz * uy0;
  let ry = fz * ux0 - fx * uz0;
  let rz = fx * uy0 - fy * ux0;
  const rl = Math.hypot(rx, ry, rz) || 1;
  rx /= rl;
  ry /= rl;
  rz /= rl;
  const ux = ry * fz - rz * fy;
  const uy = rz * fx - rx * fz;
  const uz = rx * fy - ry * fx;
  const vx = point[0] - px;
  const vy = point[1] - py;
  const vz = point[2] - pz;
  const depth = vx * fx + vy * fy + vz * fz;
  const tanV = Math.tan((shot.fov * DEG) / 2);
  return {
    x: (vx * rx + vy * ry + vz * rz) / (depth * tanV * aspect),
    y: (vx * ux + vy * uy + vz * uz) / (depth * tanV),
    front: depth > 0
  };
}

/**
 * How far out from `target` a camera at `azimuth` round the upright axis (rad, 0 toward +z, +x at a quarter turn) and
 * `elevation` above the level (rad) must stand, looking at `target`, to hold every point inside `box` ([left, right,
 * bottom, top], NDC): the nearest such distance, found by bisection between 4 and 120 m over 30 rounds.
 */
export function fitDistance(
  points: readonly R3[],
  target: R3,
  azimuth: number,
  elevation: number,
  fov: number,
  aspect: number,
  box: readonly [number, number, number, number]
): number {
  const out: Vec3 = [Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation)];
  let lo = 4;
  let hi = 120;
  for (let n = 0; n < 30; n++) {
    const d = (lo + hi) / 2;
    const shot: CameraShot = { position: [target[0] + out[0] * d, target[1] + out[1] * d, target[2] + out[2] * d], target, fov };
    const inside = points.every((p) => {
      const s = project(p, shot, aspect);
      return s.front && s.x >= box[0] && s.x <= box[1] && s.y >= box[2] && s.y <= box[3];
    });
    if (inside) hi = d;
    else lo = d;
  }
  return hi;
}
