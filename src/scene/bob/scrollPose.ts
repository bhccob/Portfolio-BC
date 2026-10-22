/**
 * The scroll's pose as plain numbers: from how far the visitor has scrolled off
 * the home (the rise, 0 to 1) to how the compass and the camera stand. Pure, so
 * the tests read the very pose the scene applies, and a rise sought to a value
 * (the debug bridge) poses the scene as the scroll did at that moment: nothing
 * here remembers the frame before. It imports nothing from React or three.
 *
 * The rise runs the HOME chapter's one unit (`riseAt`). At 0 the camera stands
 * at the home, low at the compass in its round opening in the dark glass; at 1
 * it looks straight down on the name BOB. On the way:
 * - the compass opens like an iris and the needle turns down (shares of the
 *   rise, linear here: `setIris` and `setNeedleDip` ease them),
 * - the light runs out of the O into the two B letters (`setLetters`, the same),
 * - the camera climbs from the home's 13 degrees to the top's 90 along one
 *   smoothstep, its distance, its field and its look-at height moving with it.
 *
 * The spans come from the Blender preview, whose rise is frames 300 to 362: the
 * iris is frames 300-346 and the needle 300-340 (tools/blender/bob_scroll.py,
 * which also rises the camera over the whole 300-362 on an ease_io) and the
 * letters' light 318-358 (tools/blender/bob_reveal_b.py), each as a share of
 * the 62 frames.
 */
import { type CameraShot, FRAMES, homeShotFor, topShotFor } from '~/engine/bob/shots';
import { HOME_CHAPTERS } from '~/state/chapters';

/** A stretch of the rise, as the shares `[from, to]` of it. */
type Span = readonly [from: number, to: number];

/**
 * Where each part of the pose moves, as shares of the rise. The camera has the
 * whole of it. The preview's frames 300-362 are the rise; the iris is frames
 * 300-346 (0 to 0.742), the needle 300-340 (0 to 0.645) and the letters 318-358
 * (0.29 to 0.935).
 */
export const RISE_SPANS = {
  iris: [0, 0.742],
  needle: [0, 0.645],
  letters: [0.29, 0.935],
  camera: [0, 1]
} as const satisfies Record<string, Span>;

/** Above this many degrees of elevation the shot gives its own `up` (below it, the default +Y up is not near the view line). */
const UP_ABOVE = 80;

/** The share of the rise the parallax lasts: it falls from the whole of it at 0 to none at 0.6. */
const SWAY_UNTIL = 0.6;

const RAD = Math.PI / 180;

/** `x` held to [0, 1]; NaN reads as 0. */
function clamp01(x: number): number {
  return x > 0 ? (x < 1 ? x : 1) : 0;
}

/** `a` and `b` mixed: `a` at `t` = 0 and `b` at `t` = 1. */
function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Smoothstep, held to 0..1: leaves 0 and arrives at 1 with no speed. */
function smoothstep(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

/** How far `u` is through `span`, 0 to 1, linear. */
function through(u: number, [from, to]: Span): number {
  return clamp01((u - from) / (to - from));
}

/** How far the camera stands from the point it looks at. */
function distanceOf(shot: CameraShot): number {
  return Math.hypot(shot.position[0] - shot.target[0], shot.position[1] - shot.target[1], shot.position[2] - shot.target[2]);
}

/**
 * Within this much of an end, the rise is on it. The scroll input sums its
 * deltas (src/input/target.ts `moveTarget`), so three wheel notches down and
 * three back leave the target at 5.55e-17, not 0, and the home would never be
 * the home again: no aim at u = 0 (Ruling 8).
 */
const RISE_SNAP = 1e-6;

/**
 * The rise for this scroll progress: the HOME chapter's unit as the rise, held
 * to 0..1 (progress is in the chapters' units, one viewport height of scroll
 * each), and on an end within RISE_SNAP of it. NaN reads as 0.
 */
export function riseAt(progress: number): number {
  const rise = clamp01(progress / HOME_CHAPTERS.units[0]!.length);
  return rise < RISE_SNAP ? 0 : rise > 1 - RISE_SNAP ? 1 : rise;
}

/**
 * Whether the camera is up the rise at all: `u` above 0, and the hero's SCROLL cue is to be gone (spec §3: no text
 * during the scroll). The rise `u` is the pose's, already snapped to exactly 0 at the home, so there is no margin
 * here; NaN, which no pose has, and anything below the home read as the home.
 */
export function risingFor(u: number): boolean {
  return u > 0;
}

/**
 * One moment of the scroll: the rise `u` (held to 0..1), the shares of the
 * iris, the needle's dip and the letters' light (each 0 to 1, linear in the
 * rise through its span; the setters ease them) and where the camera stands.
 */
export interface ScrollPose {
  u: number;
  iris: number;
  needleDip: number;
  letters: number;
  shot: CameraShot;
}

/**
 * The pose at rise `u` on a screen of this aspect (width over height). A bad
 * `u` (NaN, past either end) is held to 0..1, NaN reading as 0.
 *
 * The shot is the home shot itself at `u` = 0 (no `up`, no `sway`) and the top
 * shot itself at `u` = 1, with no mixing at the ends, so the ends are exactly
 * the shots the rest of the page uses. In between, with `e` the smoothstep of
 * `u` through the camera's span:
 * - the elevation is 13 degrees to 90 on `e`, the look-at height 0.55 to 0 on
 *   `e`, and the distance and the field move from the home shot's to the top
 *   shot's on `e` (the shots carry the screen's shape in them, so a phone
 *   stands further off throughout);
 * - the camera stands at `(0, targetY + d sin(el), d cos(el))` looking at
 *   `(0, targetY, 0)`, as `shotFor` places it;
 * - `up` is given only above 80 degrees, as the camera's own up at that
 *   elevation, `(0, cos(el), -sin(el))`: it is what the default +Y up comes to
 *   below the pole, and it stays defined where +Y turns into the view line;
 * - `sway` is `1 - u / 0.6` held to 0..1: the Rig's pointer parallax is gone from
 *   0.6 of the rise, long before the elevation is near the pole, where its
 *   0.01 rad clamp would swing the camera.
 */
export function scrollPoseAt(u: number, aspect: number): ScrollPose {
  const rise = clamp01(u);
  const iris = through(rise, RISE_SPANS.iris);
  const needleDip = through(rise, RISE_SPANS.needle);
  const letters = through(rise, RISE_SPANS.letters);
  if (rise <= 0) return { u: 0, iris, needleDip, letters, shot: homeShotFor(aspect) };
  if (rise >= 1) return { u: 1, iris, needleDip, letters, shot: topShotFor(aspect) };

  const home = homeShotFor(aspect);
  const top = topShotFor(aspect);
  const e = smoothstep(through(rise, RISE_SPANS.camera));
  const elevation = mix(FRAMES.home.elevation, FRAMES.top.elevation, e);
  const el = elevation * RAD;
  const distance = mix(distanceOf(home), distanceOf(top), e);
  const targetY = mix(FRAMES.home.targetY, FRAMES.top.targetY, e);
  const shot: CameraShot = {
    position: [0, targetY + distance * Math.sin(el), distance * Math.cos(el)],
    target: [0, targetY, 0],
    fov: mix(home.fov, top.fov, e),
    ...(elevation > UP_ABOVE ? { up: [0, Math.cos(el), -Math.sin(el)] as const } : {}),
    sway: clamp01(1 - rise / SWAY_UNTIL)
  };
  return { u: rise, iris, needleDip, letters, shot };
}
