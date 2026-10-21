/**
 * The BOB camera's shots: where the camera stands and what it looks at for the
 * loader's wide view of the whole name and for the home, each framed to fit the
 * screen's shape. A shot is plain numbers, so the loader can blend one into the
 * next (`lerpCameraShot`) and the tests project the scene through exactly the
 * camera the page uses. It imports nothing from three.
 *
 * The frame is the glass's (see ~/engine/bob/wordmark): the glass is the plane
 * y = 0, x runs to the right, and the camera stands on the +z side, looking
 * toward -z with the top of the screen away from it. Each frame's numbers come
 * from the Blender preview (tools/blender/bob_animate.py, the `WIDE` and `HOME`
 * dicts), tuned against the projection tests, not derived.
 */

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
 */
export interface ShotFrame {
  distance: number;
  elevation: number;
  targetY: number;
  halfWidth: number;
}

/**
 * The three frames:
 * - `wide`: the loader's view, the whole name (both B letters and the circle
 *   between them) with room to spare, looking at the glass a little above the
 *   plane.
 * - `home`: a laptop's home, close in on the compass, at 8.8 m and 13 degrees
 *   above, looking at the compass's centre. Its half-width of 3.2 puts the
 *   centre of each B at the edge of the screen: half of each B is off it.
 * - `homePortrait`: the same view on a screen taller than wide, where half a B
 *   each side would leave only the compass, so it holds the whole name across
 *   the width instead (with the near corners' margin).
 */
export const FRAMES = {
  wide: { distance: 13.8, elevation: 14, targetY: 0.2, halfWidth: 5.2 },
  home: { distance: 8.8, elevation: 13, targetY: 0.55, halfWidth: 3.2 },
  homePortrait: { distance: 8.8, elevation: 13, targetY: 0.55, halfWidth: 5.0 }
} as const;

/**
 * The widest vertical field of view a shot may open to, in degrees. A narrow
 * screen would need a wider field to fit a frame's half-width; past this the
 * perspective bends the glass too much, so the camera stands back instead.
 */
export const MAX_VFOV = 50;

/** The aspect a bad one (NaN, zero, negative, infinite) reads as: a 16:9 laptop. */
const FALLBACK_ASPECT = 16 / 9;

const RAD = Math.PI / 180;

/**
 * The shot that fits `frame` on a screen of this aspect (width over height).
 * The camera stands at `(0, targetY + d sin e, d cos e)` for `d` and `e` the
 * frame's distance and elevation, looking at `(0, targetY, 0)`. Its vertical
 * field is `2 atan(halfWidth / (distance aspect))` in degrees, which puts the
 * half-width, at the target's depth, on the screen's edge. If that field
 * exceeds `MAX_VFOV` the field is held at `MAX_VFOV` and the camera stands back
 * to `halfWidth / (aspect tan(MAX_VFOV / 2))`, which puts it on the edge again.
 * A bad aspect reads as 16:9.
 */
export function shotFor(frame: ShotFrame, aspect: number): CameraShot {
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : FALLBACK_ASPECT;
  let distance = frame.distance;
  let fov = 2 * Math.atan(frame.halfWidth / (distance * a)) / RAD;
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
 * The home shot for a screen of this aspect: the laptop frame from a square
 * up, the portrait frame (the whole name across the width) below it.
 */
export function homeShotFor(aspect: number): CameraShot {
  return shotFor(aspect < 1 ? FRAMES.homePortrait : FRAMES.home, aspect);
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
