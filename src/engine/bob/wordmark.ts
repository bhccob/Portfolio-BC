/**
 * The geometry of the BOB wordmark that the loader engraves and the home keeps:
 * two B outlines with their bars, the circle the compass hangs in, and the 144
 * ticks round it. It ports `b_paths`, `circle_pts` and the tick loop of the
 * Blender preview (tools/blender/bob_build.py), so the site draws what the
 * approved frames show. It imports nothing from three.
 *
 * Lengths are world units on the glass, the plane y = 0, seen from above: x
 * runs to the right and z toward the viewer, so the top of the screen is -Z.
 * Blender's (x, y) becomes (x, -y) here. A letter stands with its foot nearest
 * the camera (z = +nearZ) and its top away from it (z = -nearZ); its local
 * `v` runs from the foot to the top.
 */

/** A point on the glass: three's `x` and `z` (the glass is y = 0). */
export type Point2 = readonly [x: number, z: number];

/**
 * The wordmark's measurements. Each B is `height` deep (from foot to top) and
 * `width` wide, its back (the vertical) at `leftX` or `rightX`, and its bar
 * `midRatio` of the height up from the foot; `nearZ` is the foot's z, half the
 * height. `hole` is the opening in the glass, `circle` the main engraved
 * circle and `outer` the thin ring outside the letters' reach. The 144 ticks
 * start at `inner` and reach out by `long` (every 12th), `mid` (every 6th) or
 * `short`. `engrave` is the width of an engraved line.
 */
export const WORDMARK = {
  b: { height: 3.4, width: 2.1, midRatio: 0.53, leftX: -4.25, rightX: 2.15, nearZ: 1.7 },
  hole: 1.585,
  circle: 1.66,
  outer: 1.88,
  ticks: { count: 144, inner: 1.69, long: 0.16, mid: 0.1, short: 0.055 },
  engrave: 0.011
} as const;

/** One engraved stroke of the wordmark. */
export type StrokeId = 'leftB' | 'leftBar' | 'rightB' | 'rightBar' | 'circle';

/** The strokes in the order the laser cuts them: the left B and its bar, the right B and its bar, then the circle. */
export const STROKE_ORDER: readonly StrokeId[] = Object.freeze(['leftB', 'leftBar', 'rightB', 'rightBar', 'circle'] as const);

/** How many points an arc of a bowl is sampled with, and how many steps a full circle has. */
const ARC_SAMPLES = 56;
const CIRCLE_SEGMENTS = 240;

/** Where the circle's first point lies, and so where the laser begins it: 45 degrees. */
const CIRCLE_START = Math.PI / 4;

/**
 * A point on the glass, frozen. A path built from these cannot be changed by
 * the code that reads it.
 */
function point(x: number, z: number): Point2 {
  return Object.freeze([x, z] as const);
}

/**
 * A circle of `radius` round the origin as `segments` steps and the first
 * point again to close it (`segments + 1` points). The first point lies at
 * `start` radians, and an increasing angle climbs the screen, as the preview's
 * counter-clockwise circle does once Blender's y becomes -z.
 */
export function circlePath(radius: number, segments: number = CIRCLE_SEGMENTS, start: number = CIRCLE_START): Point2[] {
  const points: Point2[] = [];
  for (let i = 0; i < segments; i++) {
    const a = start + (2 * Math.PI * i) / segments;
    points.push(point(radius * Math.cos(a), -radius * Math.sin(a)));
  }
  // The same point again, not a recomputed one: sin and cos of a full turn leave rounding error.
  points.push(points[0]);
  return points;
}

/**
 * One B as the preview draws it: the outline and the bar, with the letter's
 * back at world `ox`. The outline starts at the foot of the back, climbs to
 * the top, runs across to the upper bowl, rounds it down to the bar, steps
 * across to the lower bowl, rounds that down to the foot and returns along the
 * foot to where it began. The lower bowl is the larger: it reaches the whole
 * width and is `midRatio` of the height deep, while the upper bowl stops 0.1
 * short of the width. The bar runs from the back to the x where the bowls' arcs
 * begin, taking the smaller of the two.
 */
function bPaths(ox: number): { outline: readonly Point2[]; bar: readonly Point2[] } {
  const { height: H, width: W, midRatio, nearZ } = WORDMARK.b;
  const mid = H * midRatio;
  const rLower = mid / 2;
  const aLower = W - rLower;
  const rUpper = (H - mid) / 2;
  const aUpper = W - 0.1 - rUpper;
  // (u, v) is the letter's own frame, u across from the back and v up from the foot; the glass takes (ox + u, nearZ - v).
  const at = (u: number, v: number): Point2 => point(ox + u, nearZ - v);
  const outline: Point2[] = [at(0, 0), at(0, H), at(aUpper, H)];
  for (let i = 1; i <= ARC_SAMPLES; i++) {
    const t = Math.PI / 2 - (Math.PI * i) / ARC_SAMPLES;
    outline.push(at(aUpper + rUpper * Math.cos(t), H - rUpper + rUpper * Math.sin(t)));
  }
  // The bowls' centres differ by a hair; the step across is kept only when it is a real step.
  if (Math.abs(aLower - aUpper) > 1e-4) outline.push(at(aLower, mid));
  for (let i = 1; i <= ARC_SAMPLES; i++) {
    const t = Math.PI / 2 - (Math.PI * i) / ARC_SAMPLES;
    outline.push(at(aLower + rLower * Math.cos(t), mid - rLower + rLower * Math.sin(t)));
  }
  outline.push(outline[0]);
  const bar = [at(0, mid), at(Math.min(aUpper, aLower), mid)];
  return { outline: Object.freeze(outline), bar: Object.freeze(bar) };
}

/** The length of a polyline. */
function polylineLength(points: readonly Point2[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  return length;
}

const LEFT = bPaths(WORDMARK.b.leftX);
const RIGHT = bPaths(WORDMARK.b.rightX);

/** Every stroke's points, built once. */
const PATHS: Readonly<Record<StrokeId, readonly Point2[]>> = Object.freeze({
  leftB: LEFT.outline,
  leftBar: LEFT.bar,
  rightB: RIGHT.outline,
  rightBar: RIGHT.bar,
  circle: Object.freeze(circlePath(WORDMARK.circle))
});

/** Every stroke's length, measured once. */
const LENGTHS: Readonly<Record<StrokeId, number>> = Object.freeze({
  leftB: polylineLength(PATHS.leftB),
  leftBar: polylineLength(PATHS.leftBar),
  rightB: polylineLength(PATHS.rightB),
  rightBar: polylineLength(PATHS.rightBar),
  circle: polylineLength(PATHS.circle)
});

/**
 * The points of a stroke on the glass. A closed outline (a B or the circle)
 * repeats its first point last, so the laser ends where it began; a bar is two
 * points. The array is built once and frozen.
 */
export function strokePath(id: StrokeId): readonly Point2[] {
  return PATHS[id];
}

/** The length of a stroke's polyline, in world units. */
export function strokeLength(id: StrokeId): number {
  return LENGTHS[id];
}

/**
 * The 144 ticks round the circle, one every 2.5 degrees from the circle's
 * east, each as its inner and outer end. The inner end is `ticks.inner` from
 * the centre and the length is `long` every 12th tick, `mid` every 6th and
 * `short` otherwise. Built once and frozen.
 */
function buildTicks(): [Point2, Point2][] {
  const { count, inner, long, mid, short } = WORDMARK.ticks;
  const ticks: [Point2, Point2][] = [];
  for (let k = 0; k < count; k++) {
    const a = (2 * Math.PI * k) / count;
    const outer = inner + (k % 12 === 0 ? long : k % 6 === 0 ? mid : short);
    ticks.push(Object.freeze([point(inner * Math.cos(a), -inner * Math.sin(a)), point(outer * Math.cos(a), -outer * Math.sin(a))] as const) as [Point2, Point2]);
  }
  return ticks;
}

const TICKS: readonly [Point2, Point2][] = Object.freeze(buildTicks());

/** The 144 tick segments, inner end then outer end, in order round the circle from its east. */
export function tickSegments(): readonly [Point2, Point2][] {
  return TICKS;
}
