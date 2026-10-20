/**
 * The hard drive's measurements: the one table the compass's drive pose, the
 * tracks and the choreography all read, so they cannot drift apart, and the
 * arm's geometry that turns a head radius into the arm's bearing. It imports
 * nothing from three, gsap or lenis (only the dial's own frame, dialSpec), so
 * the page and the node tests can read it.
 *
 * Everything is in the dial's frame (dialSpec): the face at y = 0, north -Z,
 * east +X, a bearing b (degrees clockwise from north) at radius r at
 * (r sin b, -r cos b). Lengths are world units; degrees in tables.
 */

import { bearingOf } from './dialSpec';

/** The four tracks, one per project; `next` is the empty one. */
export type TrackId = 'funcial' | 'jontai-energy' | 'cookies-clicker' | 'next';

/** The tracks from the outer edge inwards, as a drive counts them. */
export const TRACKS: readonly TrackId[] = ['funcial', 'jontai-energy', 'cookies-clicker', 'next'];

export const DRIVE = {
  /** The platters are full discs; `gap` is the depth between them and the top one sits `rise` above the face. */
  platter: { inner: 0.2, outer: 1.0, gap: 0.05, rise: 0.02 },
  /** The trigram ring becomes the clamp (its inner and outer radius); the pool becomes the hub. */
  clamp: [0.12, 0.2],
  hub: 0.12,
  /** The arm's pivot, dial-local (x, z): the south-east corner, outside the platters. */
  pivot: [1.0, 1.0],
  /** Pivot to head, and the tail left behind the pivot (0.82 + 0.6 - 0.15 = the needle's length less the yoke). */
  armLength: 1.27,
  yoke: 0.15,
  /** The pivot's height mid-travel, and the arm's height once landed. */
  travelLift: 0.12,
  armHeight: 0.06,
  /** The head's radius on the park ramp, and the bearing the mirror wipe spreads from. */
  parkRadius: 1.1,
  mirrorFrom: 135,
  /** Each track's radius, outer to inner. */
  tracks: { funcial: 0.88, 'jontai-energy': 0.76, 'cookies-clicker': 0.64, next: 0.52 },
  /** A track's drawn width, the wider ring that answers the pointer, and the sectors a track divides into. */
  trackWidth: 0.012,
  hitWidth: 0.07,
  sectors: 5
} as const;

const DEG = Math.PI / 180;

/**
 * The sign of the cross product (pivot x head) on the half of the dial the arm
 * swings in on: -1 the north-east half, 1 the south-west half.
 */
const SWING_SIDE: -1 | 1 = -1;

/** `degrees` wrapped into [-180, 180). */
function wrapDegrees(degrees: number): number {
  return ((((degrees + 180) % 360) + 360) % 360) - 180;
}

/** The head, dial-local `[x, z]`, with the arm pointing along `armBearingDeg` (degrees clockwise from north) from the pivot. */
export function headPoint(armBearingDeg: number): [x: number, z: number] {
  const a = armBearingDeg * DEG;
  return [DRIVE.pivot[0] + DRIVE.armLength * Math.sin(a), DRIVE.pivot[1] - DRIVE.armLength * Math.cos(a)];
}

/**
 * The arm's direction from the pivot, in degrees in [-180, 180), that puts the
 * head on `radius` (from the dial's centre), or null where the arm cannot
 * reach it.
 *
 * With the pivot P, the head is P + armLength (sin a, -cos a), and
 * |head| = radius gives P.x sin a - P.z cos a = k, which has two solutions
 * mirrored about the line from the centre to the pivot. The arm swings over the
 * platter from its corner on the one whose head lies on the north-east half of
 * that line (the arm comes up the platter's east edge and turns least from the
 * needle's north). The line runs north-west to south-east for the south-east
 * pivot, so "the north-west side" is a tie between the two halves; this reading
 * is the one place to flip should the other half be wanted (SWING_SIDE).
 */
export function armBearing(radius: number): number | null {
  if (!(radius >= 0 && Number.isFinite(radius))) return null;
  const [px, pz] = DRIVE.pivot;
  const reach = DRIVE.armLength;
  const dist = Math.hypot(px, pz);
  const sine = (radius * radius - dist * dist - reach * reach) / (2 * reach * dist);
  if (!(Math.abs(sine) <= 1)) return null;
  // px sin a - pz cos a = dist sin(a - phi), so a = phi + asin(sine), or the supplement's.
  const phi = Math.atan2(pz, px);
  const lift = Math.asin(sine);
  const candidates = [phi + lift, phi + Math.PI - lift].map((a) => wrapDegrees(a / DEG));
  const cross = (a: number): number => {
    const [hx, hz] = headPoint(a);
    return px * hz - pz * hx;
  };
  return SWING_SIDE * cross(candidates[0]) >= SWING_SIDE * cross(candidates[1]) ? candidates[0] : candidates[1];
}

/**
 * The head's bearing on the dial (degrees clockwise from north, in (-180, 180])
 * with the head on `radius` at the platter's rest; NaN where the arm cannot
 * reach it.
 */
export function headBearing(radius: number): number {
  const a = armBearing(radius);
  if (a === null) return Number.NaN;
  const [x, z] = headPoint(a);
  return bearingOf(x, z) / DEG;
}
