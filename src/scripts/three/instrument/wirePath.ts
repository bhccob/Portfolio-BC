import { DIAL, onDial } from './dialSpec';

/**
 * The wire's path in the dial's frame (dialSpec): the face at y = 0, north -Z,
 * east +X. Ørsted's 1820 wire is one of the Rotterdam ring's painted bridge
 * cables lifting off the ring and pulling straight across the dial above the
 * needle; in the change it winds itself into the voice coil at the arm's
 * tail. Three paths of WIRE.points points each, and the one function that
 * blends them: lying on the ring, pulled straight, wound into the coil. It
 * imports nothing from three, gsap or lenis (only the dial's own tables), so
 * the choreography's tests and the node tests can read it.
 */

export const WIRE = {
  /** Every path has this many points, so a path can be blended with another point by point. */
  points: 96,
  /** The tube's radius. */
  radius: 0.006,
  /** Ørsted's wire runs this far above the face, over the needle (which is 0.05 up). */
  height: 0.11,
  /** The cable as painted: the chord from (bearing, radius) to (bearing, radius) on the Rotterdam ring. */
  lying: { from: [190, 0.78], to: [205, 0.97] },
  /** The voice coil: a helix of `turns` turns of `radius`, `length` long along the arm. */
  coil: { radius: 0.03, turns: 8, length: 0.12 },
  /** How wide a pulse of current is, as a fraction of the wire's length. */
  pulseWidth: 0.08
} as const;

/** A point `[x, y, z]`, dial-local. */
export type Point = readonly [x: number, y: number, z: number];

/** The cable lies this far above the face, so it does not fight the painted ring. */
const LYING_HEIGHT = 0.002;

/** How far a point is raised as the cable pulls up, per unit of its distance from the chord's middle (see wirePath). */
const ARC = 0.25;

/** `x` held to [0, 1]; NaN reads as 0. */
export function clamp01(x: number): number {
  return x > 0 ? (x < 1 ? x : 1) : 0;
}

/** `n` points along the straight line from `a` to `b`, the first at `a` and the last at `b`. */
function line(a: Point, b: Point, n: number): Point[] {
  return Array.from({ length: n }, (_, i): Point => {
    const t = i / (n - 1);
    return [a[0] * (1 - t) + b[0] * t, a[1] * (1 - t) + b[1] * t, a[2] * (1 - t) + b[2] * t];
  });
}

const [LYING_FROM_X, LYING_FROM_Z] = onDial(WIRE.lying.from[0], WIRE.lying.from[1]);
const [LYING_TO_X, LYING_TO_Z] = onDial(WIRE.lying.to[0], WIRE.lying.to[1]);
const LYING: readonly Point[] = line([LYING_FROM_X, LYING_HEIGHT, LYING_FROM_Z], [LYING_TO_X, LYING_HEIGHT, LYING_TO_Z], WIRE.points);
const STRAIGHT: readonly Point[] = line([0, WIRE.height, -DIAL.rim], [0, WIRE.height, DIAL.rim], WIRE.points);
/** The middle of the cable as it lies: the arc of a lifting wire grows with the distance from here. */
const MIDDLE: Point = [(LYING_FROM_X + LYING_TO_X) / 2, LYING_HEIGHT, (LYING_FROM_Z + LYING_TO_Z) / 2];

/** A straight chord lying on the Rotterdam ring, at y 0.002. A fresh array on every call. */
export function lyingPath(): Point[] {
  return LYING.slice();
}

/** Ørsted's wire: the north rim to the south rim along x = 0, at y WIRE.height. A fresh array on every call. */
export function straightPath(): Point[] {
  return STRAIGHT.slice();
}

/** A point with each non-finite component read as 0. */
function finite(p: Point): Point {
  return [Number.isFinite(p[0]) ? p[0] : 0, Number.isFinite(p[1]) ? p[1] : 0, Number.isFinite(p[2]) ? p[2] : 0];
}

function cross(a: Point, b: Point): Point {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/** `p` scaled to length 1, or null where it has no direction. */
function normalised(p: Point): Point | null {
  const length = Math.hypot(p[0], p[1], p[2]);
  return length > 1e-9 && Number.isFinite(length) ? [p[0] / length, p[1] / length, p[2] / length] : null;
}

/**
 * A helix of WIRE.coil.turns turns and radius WIRE.coil.radius round the line
 * through `anchor` along `axis` (the arm's tail point and direction), WIRE.coil.length
 * long and centred on the anchor. The axis is normalised; a zero or non-finite
 * one reads as +X. The first point is at the axis's back end, the last at its front.
 */
export function coilPath(anchor: Point, axis: Point): Point[] {
  const centre = finite(anchor);
  const a = normalised(finite(axis)) ?? [1, 0, 0];
  // Any basis ⟂ the axis will do, but it must not jump: from axis × up, or axis × east where the axis is up or down.
  const u = normalised(cross(a, [0, 1, 0])) ?? normalised(cross(a, [1, 0, 0]))!;
  const v = cross(a, u);
  const { radius, turns, length } = WIRE.coil;
  return Array.from({ length: WIRE.points }, (_, i): Point => {
    const t = i / (WIRE.points - 1);
    const along = (t - 0.5) * length;
    const angle = t * turns * 2 * Math.PI;
    const c = radius * Math.cos(angle);
    const s = radius * Math.sin(angle);
    return [
      centre[0] + a[0] * along + u[0] * c + v[0] * s,
      centre[1] + a[1] * along + u[1] * c + v[1] * s,
      centre[2] + a[2] * along + u[2] * c + v[2] * s
    ];
  });
}

/**
 * The wire for a pose: `lift` (0 to 1) moves it from lying on the ring to
 * straight across the dial, each point rising by
 * ARC * sin(PI t) * sin(PI lift) * (its distance from the cable's middle), t
 * being its place along the wire, so the cable arcs as it pulls up and is flat
 * again at both ends of the lift; then `wind` (0 to 1) moves it, point by
 * point, eased by smoothstep(wind), from where the lift has put it (the
 * straight path, at lift 1) to the coil at `anchor` along `axis`. Both are
 * held to [0, 1] and NaN reads as 0; `anchor` and `axis` are only read while
 * the wire winds (wind above 0).
 */
export function wirePath(lift: number, wind: number, anchor: Point, axis: Point): Point[] {
  const l = clamp01(lift);
  const w = clamp01(wind);
  // sin(PI l) is 0 at both ends of the lift; leave it exactly 0 there so the paths below are exactly the lying and the straight one.
  const arc = l > 0 && l < 1 ? ARC * Math.sin(Math.PI * l) : 0;
  const lifted: Point[] = LYING.map((from, i): Point => {
    const to = STRAIGHT[i];
    const x = from[0] * (1 - l) + to[0] * l;
    const y = from[1] * (1 - l) + to[1] * l;
    const z = from[2] * (1 - l) + to[2] * l;
    if (arc === 0) return [x, y, z];
    const raise = arc * Math.sin((Math.PI * i) / (WIRE.points - 1)) * Math.hypot(x - MIDDLE[0], y - MIDDLE[1], z - MIDDLE[2]);
    return [x, y + raise, z];
  });
  if (w === 0) return lifted;
  const eased = w * w * (3 - 2 * w);
  const coil = coilPath(anchor, axis);
  return lifted.map((from, i): Point => {
    const to = coil[i];
    return [from[0] * (1 - eased) + to[0] * eased, from[1] * (1 - eased) + to[1] * eased, from[2] * (1 - eased) + to[2] * eased];
  });
}
