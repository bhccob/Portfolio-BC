/**
 * The open spot (spec 2026-10-28-bob-quantum-stack-design.md, goal 5; the mock-up Bob approved,
 * .superpowers/holo-world-4-mockup/main.ts, its `spotFor`): a project opened lifts off its socket and rises to one spot
 * in front of the camera, which stays where it is, tipped toward it. Where that spot is, how big the project stands
 * there, the curve it rises along and its pace. Pure: plain numbers, no three.
 */
import type { CameraShot } from '~/engine/bob/shots';
import { sizeFor } from './lightDive';

export type Vec3 = [number, number, number];

/**
 * The spot, by the screen's shape: where on the screen the object's middle stands (NDC), how big it is across (its
 * bounding sphere's diameter, a share of the screen's height on a laptop; on a phone at most a share of the width and of
 * the height), and how far out along the camera's way (a share of the camera's distance to what it looks at); how far it
 * is tipped toward the camera (rad); how long it takes to rise and to sink (s); how far the curve up to it rises over its
 * middle (m); how far it sways round its turn toward the camera (rad).
 */
export const SPOT = {
  desk: { ndc: [0.3, 0.16], across: 0.5, distance: 0.34 },
  phone: { ndc: [0, 0.42], width: 0.66, height: 0.32, distance: 0.3 },
  tilt: 0.42,
  rise: 1.5,
  sink: 1.3,
  lift: 1.6,
  sway: 0.12
} as const;

/** Where a project's object stands: its middle, its turn round the upright (rad), its tip toward the camera (rad), its size. */
export interface SpotPose {
  centre: Vec3;
  yaw: number;
  tilt: number;
  scale: number;
}

/**
 * The spot for a camera at `shot` on a screen of this aspect, for an object whose bounding sphere has this `radius` at
 * scale 1; `clock` (s) sways it slowly round its turn toward the camera.
 */
export function spotFor(shot: CameraShot, aspect: number, radius: number, clock: number): SpotPose {
  const phone = sizeFor(aspect) === 'phone';
  return spotAt(shot, aspect, radius, clock, phone ? SPOT.phone.ndc : SPOT.desk.ndc, phone ? SPOT.phone.distance : SPOT.desk.distance, 0, (height) =>
    phone ? Math.min(height * aspect * SPOT.phone.width, height * SPOT.phone.height) : height * SPOT.desk.across
  );
}

/**
 * The page's spot (spec 2026-10-29-bob-stack-2-design.md, goal 2; the mock-up Bob chose, its `spotFor`): an open project
 * stands in the middle of its page's torn hole at the top (src/ui/ProjectView.tsx), by the screen's shape: its middle on
 * the screen (NDC), how big across (a share of the screen's height on a laptop; on a phone at most a share of the width
 * and of the height), how far out (a share of the camera's distance to what it looks at, never nearer than `near` m).
 */
export const PAGE_SPOT = {
  desk: { ndc: [0, 0.49], across: 0.34, distance: 0.34 },
  phone: { ndc: [0, 0.57], width: 0.62, height: 0.24, distance: 0.3 },
  near: 5
} as const;

/** The page's spot for a camera at `shot` on a screen of this aspect (as `spotFor`). */
export function pageSpotFor(shot: CameraShot, aspect: number, radius: number, clock: number): SpotPose {
  const phone = sizeFor(aspect) === 'phone';
  const p = PAGE_SPOT;
  return spotAt(shot, aspect, radius, clock, phone ? p.phone.ndc : p.desk.ndc, phone ? p.phone.distance : p.desk.distance, p.near, (height) =>
    phone ? Math.min(height * aspect * p.phone.width, height * p.phone.height) : height * p.desk.across
  );
}

/**
 * The spot through the screen's point `ndc`, a share `share` of the camera's reach out (never nearer than `near` m), the
 * object's diameter `across(height)` of the screen's height there.
 */
function spotAt(
  shot: CameraShot,
  aspect: number,
  radius: number,
  clock: number,
  ndc: readonly [number, number],
  share: number,
  near: number,
  across: (height: number) => number
): SpotPose {
  const [px, py, pz] = shot.position;
  const f0: Vec3 = [shot.target[0] - px, shot.target[1] - py, shot.target[2] - pz];
  const reach = Math.hypot(...f0) || 1;
  const f: Vec3 = [f0[0] / reach, f0[1] / reach, f0[2] / reach];
  const [ux0, uy0, uz0] = shot.up ?? [0, 1, 0];
  const r0: Vec3 = [f[1] * uz0 - f[2] * uy0, f[2] * ux0 - f[0] * uz0, f[0] * uy0 - f[1] * ux0];
  const rl = Math.hypot(...r0) || 1;
  const r: Vec3 = [r0[0] / rl, r0[1] / rl, r0[2] / rl];
  const u: Vec3 = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const tanV = Math.tan((shot.fov * Math.PI) / 360);
  const distance = Math.max(near, share * reach);
  // The way through the screen's point, a unit long.
  const w0: Vec3 = [0, 1, 2].map((k) => f[k]! + r[k]! * ndc[0] * tanV * aspect + u[k]! * ndc[1] * tanV) as Vec3;
  const wl = Math.hypot(...w0);
  const centre: Vec3 = [px + (w0[0] / wl) * distance, py + (w0[1] / wl) * distance, pz + (w0[2] / wl) * distance];

  // The screen's height and width at the spot's depth, m: the object's diameter a share of them.
  const depth = distance / wl;
  const height = 2 * depth * tanV;
  return {
    centre,
    yaw: Math.atan2(px - centre[0], pz - centre[2]) + SPOT.sway * Math.sin(0.5 * clock),
    tilt: SPOT.tilt,
    scale: across(height) / (2 * radius)
  };
}

/** The turn from `a` to `b` the short way, in −π..π. */
function shortTurn(a: number, b: number): number {
  const d = b - a;
  return Math.atan2(Math.sin(d), Math.cos(d));
}

/**
 * The object a share `e` (0..1, eased by the caller) of the way from its socket to the spot: up off the socket first,
 * then over, along a curve through the straight way's middle raised by `SPOT.lift`; turning the short way round,
 * tipping and growing evenly.
 */
export function liftAt(socket: SpotPose, spot: SpotPose, e: number): SpotPose {
  const a = 1 - e;
  const centre = [0, 1, 2].map((k) => {
    const middle = (socket.centre[k]! + spot.centre[k]!) / 2 + (k === 1 ? SPOT.lift : 0);
    return socket.centre[k]! * a * a + middle * 2 * a * e + spot.centre[k]! * e * e;
  }) as Vec3;
  return {
    centre,
    yaw: socket.yaw + shortTurn(socket.yaw, spot.yaw) * e,
    tilt: socket.tilt + (spot.tilt - socket.tilt) * e,
    scale: socket.scale + (spot.scale - socket.scale) * e
  };
}

/** Within this of an end, the rise is at it: its frames' sum would otherwise stop a hair short. */
const END = 1e-9;

/** The rise one step of `dt` seconds on: toward 1 over `SPOT.rise` seconds while `up`, toward 0 over `SPOT.sink`, steadily. */
export function riseStep(rise: number, up: boolean, dt: number): number {
  const next = up ? rise + dt / SPOT.rise : rise - dt / SPOT.sink;
  return next >= 1 - END ? 1 : next <= END ? 0 : next;
}
