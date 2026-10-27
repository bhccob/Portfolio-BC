/**
 * The BOB camera's shots: where the camera stands and what it looks at for the
 * loader's wide view of the O alone, for the home and for the top shot, which
 * looks straight down on the name, each framed to fit the screen's shape. A
 * shot is plain numbers, so the loader can blend one into the next
 * (`lerpCameraShot`) and the tests project the scene through exactly the
 * camera the page uses (`applyCameraShot`). It imports no code from three,
 * only the camera's type.
 *
 * The frame is the glass's (see ~/engine/bob/wordmark): the glass is the plane
 * y = 0, x runs to the right, and the camera stands on the +z side, looking
 * toward -z with the top of the screen away from it. The top shot is the one
 * that turns this round: straight above the glass, with the far side (-z) up
 * the screen, so the B letters (x -4.25..-2.15 and 2.15..4.25, 3.4 m tall, z
 * -1.7 to +1.7) read upright. The wide and home frames' numbers come from the
 * Blender preview (tools/blender/bob_animate_o.py, the `WIDE` and `HOME`
 * dicts; the top shot's 12.6 is `TOP_D` in tools/blender/bob_scroll.py), tuned
 * against the projection tests, not derived.
 */
import type { PerspectiveCamera } from 'three';

/**
 * One camera placement: where the camera stands, the point it looks at, its
 * vertical field of view in degrees, which way is up on the screen (`up`) and
 * how much of the pointer parallax the Rig may add (`sway`). The aspect is not
 * part of a shot: the screen supplies it, and `homeShotFor`, `wideShotFor` and
 * `topShotFor` adapt a frame to it.
 *
 * - `up`: the camera's up vector, which `applyCameraShot` sets before it looks
 *   at the target. Absent means +Y, as the wide and home shots have it. A shot
 *   that looks straight down (the top shot) must say it, since +Y is then the
 *   direction it looks along.
 * - `sway`: how much parallax the Rig adds, 0..1. Absent means 1, the whole of
 *   it; 0 means none, the camera stays exactly where the shot puts it.
 */
export interface CameraShot {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
  fov: number;
  up?: readonly [number, number, number];
  sway?: number;
}

/**
 * A framing, before the screen's shape is known: how far the camera stands
 * from its target (`distance`, world units), how far above the glass it looks
 * down at it (`elevation`, degrees), the target's height above the glass
 * (`targetY`), and how much of the picture's width must fit each side of the
 * target (`halfWidth`, world units). The half-width is measured at the target's
 * depth, so a point nearer the camera than that (the letters' near corners, at
 * z = 1.7) is drawn wider than it, and a frame that must hold them carries the
 * margin.
 *
 * The width alone would size the field, which on a wide, short screen is so
 * narrow that the top of the picture cuts the compass. `minVfov` (degrees) is
 * the narrowest the field may be; where the width would call for less, the
 * field stays at it and more than the half-width shows each side.
 */
export interface ShotFrame {
  distance: number;
  elevation: number;
  targetY: number;
  halfWidth: number;
  minVfov?: number;
}

/**
 * The three frames:
 * - `wide`: the loader's view, the O alone (Bob, 2026-10-22: the loader cuts
 *   only the circle, no B letters yet), at 11.2 m and 19 degrees above,
 *   looking at the glass a little above the plane. Its half-width of 4.0 puts
 *   the outer ring (radius 1.88) well inside the picture, so the compass is the
 *   only thing in it.
 * - `top`: the shot the scroll ends on, straight above the glass (elevation 90)
 *   at 12.6 m, looking down at its middle. Its half-width of 4.6 holds the
 *   whole name across the picture: the B letters' outer edges, at x = +-4.25,
 *   sit at 0.92 of the screen's half-width. `topShotFor` adds the up that makes
 *   the far side of the glass the top of the screen. Its `minVfov` of 18 keeps
 *   the letters' tops and feet (z +-1.7) inside NDC y 0.85, clear of the
 *   header, on a screen wider than about 2.3:1, where the width fit alone
 *   would fall below it (tan(vfov / 2) = 1.7 / (0.85 x 12.6)); at 16:9 the
 *   width fit is 23.2 degrees and nothing changes.
 * - `home`: the home on every screen, close in on the compass, at 8.8 m and 13
 *   degrees above, looking at the compass's centre. Its half-width of 3.2 puts
 *   the centre of each B at the edge of the screen: half of each B is off it.
 *   A phone keeps the same crop (Bob, 2026-10-22: "for phone the 2 B should
 *   also only show half"); its field reaches the cap, so the camera stands
 *   back instead. M1 held the whole name across a portrait screen.
 *
 * The home's `minVfov` of 22.5 keeps the compass's top ring under the header
 * on a wide, short screen: the width fit alone is about 23.1 degrees at 16:9
 * and falls to 20.6 at 2:1, where the ring would reach the top of the picture
 * (NDC y 0.99, against 0.88 at 16:9). With the floor it stays at about 0.90.
 */
export const FRAMES = {
  wide: { distance: 11.2, elevation: 19, targetY: 0.1, halfWidth: 4.0 },
  top: { distance: 12.6, elevation: 90, targetY: 0, halfWidth: 4.6, minVfov: 18 },
  home: { distance: 8.8, elevation: 13, targetY: 0.55, halfWidth: 3.2, minVfov: 22.5 }
} as const;

/**
 * The widest vertical field of view a shot may open to, in degrees. A narrow
 * screen would need a wider field to fit a frame's half-width; past this the
 * perspective bends the glass too much, so the camera stands back instead.
 */
export const MAX_VFOV = 50;

/** The aspect a bad one (NaN, zero, negative, infinite) reads as: a 16:9 laptop. */
const FALLBACK_ASPECT = 16 / 9;

/** The narrowest screen the shots plan for; a thinner one is framed as this, so the camera stays a finite way off. */
const MIN_ASPECT = 0.25;

const RAD = Math.PI / 180;

/**
 * The shot that fits `frame` on a screen of this aspect (width over height).
 * The camera stands at `(0, targetY + d sin e, d cos e)` for `d` and `e` the
 * frame's distance and elevation, looking at `(0, targetY, 0)`. Its vertical
 * field is `2 atan(halfWidth / (distance aspect))` in degrees, which puts the
 * half-width, at the target's depth, on the screen's edge, but never less than
 * the frame's `minVfov` (then more than the half-width shows each side). If
 * that field exceeds `MAX_VFOV` the field is held at `MAX_VFOV` and the camera
 * stands back to `halfWidth / (aspect tan(MAX_VFOV / 2))`, which puts the
 * half-width on the edge again. A bad aspect reads as 16:9, and one thinner
 * than 0.25 as 0.25.
 */
export function shotFor(frame: ShotFrame, aspect: number): CameraShot {
  const a = Number.isFinite(aspect) && aspect > 0 ? Math.max(aspect, MIN_ASPECT) : FALLBACK_ASPECT;
  let distance = frame.distance;
  let fov = Math.max((2 * Math.atan(frame.halfWidth / (distance * a))) / RAD, frame.minVfov ?? 0);
  if (fov > MAX_VFOV) {
    fov = MAX_VFOV;
    distance = frame.halfWidth / (a * Math.tan((MAX_VFOV * RAD) / 2));
  }
  const e = frame.elevation * RAD;
  return {
    position: [0, frame.targetY + distance * Math.sin(e), distance * Math.cos(e)],
    target: [0, frame.targetY, 0],
    fov
  };
}

/**
 * The home shot for a screen of this aspect: the one home frame, half of each
 * B off the screen, on a laptop and a phone alike, so a window resized across
 * square changes the picture smoothly.
 */
export function homeShotFor(aspect: number): CameraShot {
  return shotFor(FRAMES.home, aspect);
}

/** The loader's wide shot for a screen of this aspect: the O alone in view, with room around it. */
export function wideShotFor(aspect: number): CameraShot {
  return shotFor(FRAMES.wide, aspect);
}

/**
 * The top shot for a screen of this aspect: straight down onto the middle of
 * the glass, (0, 0, 0), the whole name across the picture. It is `shotFor` of
 * the `top` frame (the width fit, at least its `minVfov` of 18 and at most `MAX_VFOV`, the camera standing back
 * past it, so a phone stands further off than a laptop) with two things added:
 * - `up: [0, 0, -1]`: the far side of the glass (-z) is the top of the screen,
 *   so the B letters read upright and the left one is on the left. Looking
 *   straight down the default +Y up would be the direction of sight itself.
 * - `sway: 0`: no pointer parallax. The Rig's orbit about the target holds the
 *   camera 0.01 radians off the pole, so it would swing a camera that looks
 *   straight down off the vertical.
 * The camera stands at `(0, d, d cos 90)`: its z is about 1e-15, not exactly 0,
 * which is no matter to a camera that looks along -Y.
 */
export function topShotFor(aspect: number): CameraShot {
  return { ...shotFor(FRAMES.top, aspect), up: [0, 0, -1], sway: 0 };
}

/**
 * How much of the pointer parallax `shot` allows, as the Rig reads it: its `sway` held to [0, 1], absent read as 1 (the
 * whole of it). NaN and anything below 0 read as 0, none, so a bad shot never swings the camera, and nothing reads as
 * more than the whole.
 */
export function swayOf(shot: CameraShot): number {
  const sway = shot.sway ?? 1;
  return sway > 0 ? (sway < 1 ? sway : 1) : 0;
}

/** `a` and `b` mixed: `a` at `t` = 0 and `b` at `t` = 1. */
function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * The shot `t` of the way from `a` to `b` (0 is `a`, 1 is `b`; not clamped, so
 * an eased `t` that overshoots overshoots the camera too). The position, the
 * look-at point and the fov each move in a straight line, which is all the
 * loader needs: its two shots lie roughly along one descent. It is the
 * loader's, so it carries no `up` and no `sway`: the shots it blends say
 * neither (+Y up, the whole parallax).
 */
export function lerpCameraShot(a: CameraShot, b: CameraShot, t: number): CameraShot {
  return {
    position: [mix(a.position[0], b.position[0], t), mix(a.position[1], b.position[1], t), mix(a.position[2], b.position[2], t)],
    target: [mix(a.target[0], b.target[0], t), mix(a.target[1], b.target[1], t), mix(a.target[2], b.target[2], t)],
    fov: mix(a.fov, b.fov, t)
  };
}

/**
 * Puts `camera` where `shot` says on a screen of this `aspect` (width over
 * height): sets its fov and aspect, stands it at the shot's position looking
 * at the shot's target with the shot's `up` up (+Y when it has none; the
 * camera's up is set on every placement, so a shot with an up does not leave it
 * behind for the next one), drops any view offset a previous rig left
 * on it (a shot is the whole picture), and updates the projection and world
 * matrices so a projection made straight afterwards is right. It does not
 * touch near or far, which belong to the stage. A shot or aspect that is not
 * finite and positive leaves the camera as it was: there is nothing to frame,
 * and the maths would not be finite.
 *
 * Copied from v3's shots, with the shot's `up` added: the Rig
 * places the camera through it. It calls only the camera's own methods, so this
 * module needs three's types and none of its code.
 */
export function applyCameraShot(camera: PerspectiveCamera, shot: CameraShot, aspect: number): void {
  const finite = [...shot.position, ...shot.target, ...(shot.up ?? [])].every(Number.isFinite);
  if (!(finite && Number.isFinite(shot.fov) && shot.fov > 0 && Number.isFinite(aspect) && aspect > 0)) return;
  camera.fov = shot.fov;
  camera.aspect = aspect;
  const [ux, uy, uz] = shot.up ?? [0, 1, 0];
  camera.up.set(ux, uy, uz);
  camera.position.set(shot.position[0], shot.position[1], shot.position[2]);
  camera.lookAt(shot.target[0], shot.target[1], shot.target[2]);
  camera.clearViewOffset();
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}

/**
 * The shot `e` of the way from `a` to `b` (0 is `a` and 1 is `b`, exactly): the camera, the look-at point and the field
 * in straight lines, the up between theirs (absent read as +Y) and the parallax between (absent read as the whole of
 * it). The flight into a porthole is this from the journey's shot to the bead's close view, eased (src/scene/bob/focus.ts),
 * and the light's path moves its camera by it from one of its shots to the next (src/scene/bob/lightPath.ts).
 */
export function shotToward(a: CameraShot, b: CameraShot, e: number): CameraShot {
  if (!(e > 0)) return a;
  if (e >= 1) return b;
  const ua = a.up ?? [0, 1, 0];
  const ub = b.up ?? [0, 1, 0];
  const u: [number, number, number] = [mix(ua[0], ub[0], e), mix(ua[1], ub[1], e), mix(ua[2], ub[2], e)];
  const n = Math.hypot(u[0], u[1], u[2]);
  return {
    position: [mix(a.position[0], b.position[0], e), mix(a.position[1], b.position[1], e), mix(a.position[2], b.position[2], e)],
    target: [mix(a.target[0], b.target[0], e), mix(a.target[1], b.target[1], e), mix(a.target[2], b.target[2], e)],
    fov: mix(a.fov, b.fov, e),
    up: [u[0] / n, u[1] / n, u[2] / n],
    sway: mix(a.sway ?? 1, b.sway ?? 1, e)
  };
}
