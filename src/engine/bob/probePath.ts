/**
 * The laser probe's path through the loader: where its tip is, and whether it
 * is cutting, at each moment of the full show. It ports `probe_state` of the
 * Blender preview (tools/blender/bob_animate_o.py), so the site's probe moves
 * as the approved frames do. It imports nothing from three.
 *
 * The loader cuts the circle alone (the B letters come in on the scroll, and
 * the probe never visits them): the probe descends onto the circle's start,
 * goes once round it, and rises out of frame once the circle is closed. The
 * moments come from the loader's script (`SCRIPT`), and how much of the circle
 * is cut from the clock's own share of it (`LoaderClock.strokes`), so the
 * probe keeps pace with the circle as it creeps while the load is out.
 *
 * Lengths are world units on the glass (see ~/engine/bob/wordmark): `x` and `z`
 * lie in the glass, and `y` is the tip's height above it.
 */
import { type LoaderClock, SCRIPT, type Span } from '~/engine/bob/loaderTimeline';
import { type Point2, STROKE_ORDER, strokeLength, strokePath } from '~/engine/bob/wordmark';

/**
 * The probe's heights, in world units: the tip's height while it cuts, where
 * it starts the descent, and where it is out of frame.
 */
export const PROBE = { cutY: 0.012, startY: 6, outY: 7.5 } as const;

/** Where the circle's share stands in `LoaderClock.strokes`: the one stroke the loader cuts. */
const CIRCLE_AT = STROKE_ORDER.indexOf('circle');

/**
 * Where the probe is: its tip at (`x`, `y`, `z`), whether it is cutting the
 * glass now (the tip's light is on), and whether it is in the picture at all.
 */
export interface ProbeState {
  x: number;
  y: number;
  z: number;
  cutting: boolean;
  shown: boolean;
}

/** `x` held to [0, 1]; NaN reads as 0. */
function clamp01(x: number): number {
  return x > 0 ? (x < 1 ? x : 1) : 0;
}

/** `a` and `b` mixed: `a` at `t` = 0 and `b` at `t` = 1. */
function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** How far `time` is through a span, 0..1. */
function through(time: number, span: Span): number {
  return clamp01((time - span.start) / (span.end - span.start));
}

/** The preview's `ease_out`: fast at first, then slowing to a stop. */
function easeOut(x: number): number {
  return 1 - (1 - x) ** 3;
}

/** The preview's `ease_in`: slow at first, then quickening. */
function easeIn(x: number): number {
  return x ** 3;
}

/** The point `u` (0..1) of the way round the circle by arc length, at constant speed. */
function pointAlong(u: number): Point2 {
  const points = strokePath('circle');
  let d = clamp01(u) * strokeLength('circle');
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1];
    const [bx, bz] = points[i];
    const length = Math.hypot(bx - ax, bz - az);
    if (d <= length || length === 0) {
      const k = length === 0 ? 0 : d / length;
      return [mix(ax, bx, k), mix(az, bz, k)];
    }
    d -= length;
  }
  return points[points.length - 1];
}

/** Where the circle begins. */
function startOf(): Point2 {
  return strokePath('circle')[0];
}

/** Where the circle ends. */
function endOf(): Point2 {
  const points = strokePath('circle');
  return points[points.length - 1];
}

/**
 * The probe once it is out of the picture: high up on the axis, not cutting.
 * Every moment the probe is not shown has this one state, so a path that
 * never shows the probe and one that has finished with it end on the same pose.
 */
function parked(): ProbeState {
  return { x: 0, y: PROBE.outY, z: 0, cutting: false, shown: false };
}

/**
 * Where the probe is at this moment of the show:
 * - **Descending**, until the circle begins: above the circle's start, easing
 *   out from `startY` down to `cutY`.
 * - **Cutting**, while the circle's span runs: at the clock's share of the
 *   circle, `cutY` above the glass, with the tip's light on.
 * - **Rising**, after the circle, until `probeOut` ends: over the circle's end,
 *   easing in from `cutY` up to `outY`.
 * - **Parked**, after that: out of the picture (`shown` false). On the quick and
 *   reduced paths the loader's script stands at its end from the first frame,
 *   so the probe is parked there throughout.
 */
export function probeAt(clock: LoaderClock): ProbeState {
  const script = clock.script;
  if (!(script < SCRIPT.probeOut.end)) return parked();

  if (script < SCRIPT.circle.start) {
    const [x, z] = startOf();
    return { x, y: mix(PROBE.startY, PROBE.cutY, easeOut(through(script, SCRIPT.descend))), z, cutting: false, shown: true };
  }

  if (script <= SCRIPT.circle.end) {
    const [x, z] = pointAlong(clock.strokes[CIRCLE_AT]);
    return { x, y: PROBE.cutY, z, cutting: true, shown: true };
  }

  const [x, z] = endOf();
  return { x, y: mix(PROBE.cutY, PROBE.outY, easeIn(through(script, SCRIPT.probeOut))), z, cutting: false, shown: true };
}
