/**
 * The camera's way round the hologram world's board (spec 2026-10-27-bob-hologram-world-design.md, anti-goal: "a camera
 * that cuts across the CPU"; the mock-up's last fix): from one place to another it turns round the board's centre the
 * short way, closing in or out and rising evenly, instead of a straight line that would cross the CPU between two areas
 * on opposite sides. Pure.
 */
import type { CameraShot } from '~/engine/bob/shots';

type R3 = readonly [number, number, number];
export type Vec3 = [number, number, number];

/** Nearer the centre's upright axis than this, m, a place has no clear angle round it: the way there is straight. */
const AXIS = 0.5;

/** The turn from angle `a` to angle `b` the short way, in −π..π. */
function shortTurn(a: number, b: number): number {
  const d = b - a;
  return Math.atan2(Math.sin(d), Math.cos(d));
}

/** The point a share `e` (0..1) of the way from `a` to `b` round `centre`'s upright axis. */
export function around(a: R3, b: R3, centre: R3, e: number): Vec3 {
  const ax = a[0] - centre[0];
  const az = a[2] - centre[2];
  const bx = b[0] - centre[0];
  const bz = b[2] - centre[2];
  const ra = Math.hypot(ax, az);
  const rb = Math.hypot(bx, bz);
  const y = a[1] + (b[1] - a[1]) * e;
  if (ra < AXIS || rb < AXIS) return [a[0] + (b[0] - a[0]) * e, y, a[2] + (b[2] - a[2]) * e];
  const from = Math.atan2(az, ax);
  const angle = from + shortTurn(from, Math.atan2(bz, bx)) * e;
  const r = ra + (rb - ra) * e;
  return [centre[0] + Math.cos(angle) * r, y, centre[2] + Math.sin(angle) * r];
}

/** A shot a share `e` of the way from `a` to `b`: its position and its target each round `centre`, its field evenly. */
export function aroundShot(a: CameraShot, b: CameraShot, centre: R3, e: number): CameraShot {
  const shot: CameraShot = {
    position: around(a.position, b.position, centre, e),
    target: around(a.target, b.target, centre, e),
    fov: a.fov + (b.fov - a.fov) * e
  };
  const up = e < 0.5 ? (a.up ?? b.up) : (b.up ?? a.up);
  if (up) shot.up = up;
  if (a.sway !== undefined || b.sway !== undefined) shot.sway = (a.sway ?? 0) + ((b.sway ?? 0) - (a.sway ?? 0)) * e;
  return shot;
}
