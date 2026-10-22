/**
 * The BOB camera's shots: where the camera stands and what it looks at for the
 * loader's wide view of the whole name and for the home, each framed to fit the
 * screen's shape. A shot is plain numbers, so the loader can blend one into the
 * next (`lerpCameraShot`) and the tests project the scene through exactly the
 * camera the page uses (`applyCameraShot`). It imports no code from three,
 * only the camera's type.
 *
 * The frame is the glass's (see ~/engine/bob/wordmark): the glass is the plane
 * y = 0, x runs to the right, and the camera stands on the +z side, looking
 * toward -z with the top of the screen away from it. Each frame's numbers come
 * from the Blender preview (tools/blender/bob_animate.py, the `WIDE` and `HOME`
 * dicts), tuned against the projection tests, not derived.
 */
import type { PerspectiveCamera } from 'three';

/**
 * One camera placement: where the camera stands, the point it looks at (up is
 * always +Y) and its vertical field of view in degrees. The aspect is not part
 * of a shot: the screen supplies it, and `homeShotFor` and `wideShotFor` adapt
 * a frame to it.
 */
export interface CameraShot {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
  fov: number;
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
 * The two frames:
 * - `wide`: the loader's view, the whole name (both B letters and the circle
 *   between them) with room to spare, looking at the glass a little above the
 *   plane.
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
  wide: { distance: 13.8, elevation: 14, targetY: 0.2, halfWidth: 5.2 },
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

/** The loader's wide shot for a screen of this aspect: the whole name in view. */
export function wideShotFor(aspect: number): CameraShot {
  return shotFor(FRAMES.wide, aspect);
}

/** `a` and `b` mixed: `a` at `t` = 0 and `b` at `t` = 1. */
function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * The shot `t` of the way from `a` to `b` (0 is `a`, 1 is `b`; not clamped, so
 * an eased `t` that overshoots overshoots the camera too). The position, the
 * look-at point and the fov each move in a straight line, which is all the
 * loader needs: its two shots lie roughly along one descent.
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
 * at the shot's target with +Y up, drops any view offset a previous rig left
 * on it (a shot is the whole picture), and updates the projection and world
 * matrices so a projection made straight afterwards is right. It does not
 * touch near or far, which belong to the stage. A shot or aspect that is not
 * finite and positive leaves the camera as it was: there is nothing to frame,
 * and the maths would not be finite.
 *
 * Copied unchanged from v3's shots (Ruling 23): the Rig places the camera
 * through it. It calls only the camera's own methods, so this module needs
 * three's types and none of its code.
 */
export function applyCameraShot(camera: PerspectiveCamera, shot: CameraShot, aspect: number): void {
  const finite = [...shot.position, ...shot.target].every(Number.isFinite);
  if (!(finite && Number.isFinite(shot.fov) && shot.fov > 0 && Number.isFinite(aspect) && aspect > 0)) return;
  camera.fov = shot.fov;
  camera.aspect = aspect;
  camera.up.set(0, 1, 0);
  camera.position.set(shot.position[0], shot.position[1], shot.position[2]);
  camera.lookAt(shot.target[0], shot.target[1], shot.target[2]);
  camera.clearViewOffset();
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}
