/**
 * The v3 camera's shots: where the camera stands and what it looks at for the
 * loader's close view of the chip, the loader's high view of the rings
 * forming, and the home, framed to fit the screen's shape. A shot is plain
 * numbers, so the loader can blend one into the next (`lerpCameraShot`) and
 * the tests project the scene through exactly the camera the page uses. It
 * imports three only to place a camera.
 *
 * The frame is the dial's (src/engine/instrument/dialSpec.ts): north is -Z,
 * east is +X, y is up from the compass's plane, and the home camera stands
 * south (+Z) looking north, so China is on the right and Aruba on the left.
 * Each shot's numbers are tuned against a concept frame in
 * docs/design/needle-v3 and the projection tests, not derived.
 */
import * as THREE from 'three';
import { DIAL } from '~/engine/instrument/dialSpec';
import { CHIP } from '~/engine/v3/chipSpec';

/**
 * One camera placement: where the camera stands, the point it looks at (up is
 * always +Y) and its vertical field of view in degrees. The aspect is not part
 * of a shot: the screen supplies it, and `homeShotFor` and `loaderShotFor`
 * adapt a shot to it.
 */
export interface CameraShot {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
  fov: number;
}

/**
 * The three shots, framed for a landscape screen of about 16:10.
 *
 * - `loaderMacro` (frame 01): the chip from about 50 degrees above and a
 *   little from the west, so its ON reads up and to the right as in the frame.
 *   The look-at point is to the chip's east (right), which pushes the chip to
 *   the left of the picture and leaves the right half dark for the smoke.
 * - `loaderRise` (frame 03): high over the board, about 42 degrees above,
 *   looking down at the compass's rings as they form round the chip, which
 *   sits just left of the centre.
 * - `home` (frame 04, Task 14b): a low camera close to the compass's south
 *   edge, about 14 degrees above its plane, so the glass fills the lower half of
 *   the picture (the rim spans about two thirds of a 16:10 screen and its near
 *   edge lies low, near the foot) and the eye line sits about a third of the
 *   way down. The ship stands in the dark above the far rim, and China and
 *   Aruba wrap the rim's sides, their outermost stars just inside the frame.
 */
export const SHOTS: { loaderMacro: CameraShot; loaderRise: CameraShot; home: CameraShot } = {
  loaderMacro: { position: [-0.3, 0.9, 0.82], target: [0.21, -0.18, 0.14], fov: 32 },
  loaderRise: { position: [-0.42, 1.81, 1.96], target: [0.13, -0.12, 0.14], fov: 40 },
  home: { position: [0, 0.52, 2.1], target: [0, 0.2, 0], fov: 56 }
};

const RAD = Math.PI / 180;

/**
 * The aspect (width over height) the shots are tuned for: a 1440 x 900 screen.
 * `SHOTS.home` is the home for this aspect and any wider one, where it only
 * gains empty sky at the sides; a narrower screen needs the camera to pull back.
 */
export const DESIGN_ASPECT = 1440 / 900;

/** The phone the portrait home is tuned on: a 390 x 844 screen. */
const PHONE_ASPECT = 390 / 844;

/** The narrowest screen the reframing plans for; a thinner one is framed as this, so the camera stays a finite distance away. */
const MIN_ASPECT = 0.25;

/**
 * How a home frame sits, as the reframing mixes it: the half-width, in world
 * units, that fits each side of the look-at point; the vertical fov in
 * degrees; the camera's angle above the line from its look-at point, in
 * radians; and how far below the middle of the picture the compass's centre
 * stands, as a share of the picture's half-height (the look-at point lies on
 * the compass's axis, `dialDrop` of the half-height above its centre).
 */
interface HomeFrame {
  halfWidth: number;
  fov: number;
  pitch: number;
  dialDrop: number;
}

/** The design shot's own frame: what `SHOTS.home` sees at the design aspect. */
const HOME_SEEN: HomeFrame = (() => {
  const { position, target, fov } = SHOTS.home;
  const tanHalf = Math.tan((fov * RAD) / 2);
  const distance = Math.hypot(position[1] - target[1], position[2] - target[2]);
  return {
    halfWidth: distance * tanHalf * DESIGN_ASPECT,
    fov,
    pitch: Math.atan2(position[1] - target[1], position[2] - target[2]),
    dialDrop: target[1] / (distance * tanHalf)
  };
})();

/**
 * The home on a square screen: the design's view pulled back until the side
 * constellations' outermost stars fit the width again (they reach about 1.55
 * out, and their feet curve forward toward the camera, which draws them wider),
 * so every landscape screen shows every star (Ruling 7).
 */
const SQUARE: HomeFrame = { halfWidth: 1.75, fov: SHOTS.home.fov, pitch: HOME_SEEN.pitch, dialDrop: 0.2 };

/**
 * The home on a phone (Task 14b): the compass large, its rim spanning 80 % of
 * the width, which leaves the side constellations' outer stars past the edges
 * but their centres in frame (the set-back of their placement puts each centre
 * behind the rim's widest point, so it draws inside the frame's edge). The
 * wide fov (80 degrees tall, about 42 across) brings the camera close, so the
 * perspective is deep enough for that; farther off and narrower, the side
 * figures would draw as wide as the rim does, and fall off the screen. The
 * compass stands a quarter of the half-height below the middle, so the tall
 * screen's sky holds the hero and the ship over it.
 */
const PORTRAIT: HomeFrame = { halfWidth: 1.3, fov: 80, pitch: 6 * RAD, dialDrop: 0.25 };

/**
 * How a screen thinner than the phone keeps the side constellations' centres
 * in frame: its half-width grows as the aspect falls past the phone's, by this
 * power of the ratio, so the camera stands back as far as it must and no
 * farther.
 */
const THIN = 0.15;

/** `a` and `b` mixed field by field: `a` at `t` = 0 and `b` at `t` = 1. */
function mixFrame(a: HomeFrame, b: HomeFrame, t: number): HomeFrame {
  return {
    halfWidth: mix(a.halfWidth, b.halfWidth, t),
    fov: mix(a.fov, b.fov, t),
    pitch: mix(a.pitch, b.pitch, t),
    dialDrop: mix(a.dialDrop, b.dialDrop, t)
  };
}

/**
 * The home shot for a screen of this aspect (width over height). The design
 * aspect and anything wider get `SHOTS.home` itself. Down to a square, the
 * same view pulls back (`HOME_SEEN` easing to `SQUARE`), so every landscape
 * screen holds the whole rim and every star of the three constellations.
 * Below a square it eases on to `PORTRAIT`, reached at a phone: the compass
 * large and each constellation's centre in frame; thinner still, it stands
 * back by `THIN` so the centres stay in. Each frame sets the camera
 * `halfWidth / (tan(fov / 2) * aspect)` from its look-at point, raised
 * `pitch` above it, with the compass's centre `dialDrop` below the middle of
 * the picture. The answer is continuous in the aspect, equal to `SHOTS.home`
 * as the screen reaches the design aspect, so a window being resized or a
 * phone turned does not jump the camera between sizes; a NaN aspect reads as
 * the design's.
 */
export function homeShotFor(aspect: number): CameraShot {
  if (!(aspect < DESIGN_ASPECT)) return SHOTS.home;
  const a = Math.max(aspect, MIN_ASPECT);
  let frame: HomeFrame;
  if (a >= 1) frame = mixFrame(HOME_SEEN, SQUARE, (DESIGN_ASPECT - a) / (DESIGN_ASPECT - 1));
  else if (a >= PHONE_ASPECT) frame = mixFrame(SQUARE, PORTRAIT, (1 - a) / (1 - PHONE_ASPECT));
  else frame = { ...PORTRAIT, halfWidth: PORTRAIT.halfWidth * (PHONE_ASPECT / a) ** THIN };
  const tanHalf = Math.tan((frame.fov * RAD) / 2);
  // The half-width the camera sees at its look-at point is distance * tanHalf * aspect.
  const distance = frame.halfWidth / (tanHalf * a);
  const lift = frame.dialDrop * distance * tanHalf;
  return {
    position: [0, lift + distance * Math.sin(frame.pitch), distance * Math.cos(frame.pitch)],
    target: [0, lift, 0],
    fov: frame.fov
  };
}

/** The two loader shots, by their name in `SHOTS`. */
export type LoaderShotId = 'loaderMacro' | 'loaderRise';

/**
 * What each loader shot keeps in view on a tall screen: the point it centres on
 * and the half-width, in world units, that must fit each side of it. The
 * macro centres on the chip's top and fits the chip and the pins that ring it
 * (the landscape frame's off-centre chip has no room to lean left on a phone);
 * the rise centres on the compass and fits its rim with a little glass to spare.
 */
const LOADER_FOCUS: Readonly<Record<LoaderShotId, { aim: readonly [number, number, number]; halfWidth: number }>> = {
  loaderMacro: { aim: [0, CHIP.board + CHIP.height, 0], halfWidth: CHIP.size * 1.2 },
  loaderRise: { aim: [0, 0, 0], halfWidth: DIAL.rim * 1.3 }
};

/**
 * A loader shot for a screen of this aspect (width over height). The Stage
 * (Task 12a) uses it for the loader's two shots, in place of reading
 * `SHOTS.loaderMacro` and `SHOTS.loaderRise` directly, as it uses
 * `homeShotFor` for the home. A screen at least as wide as tall gets the shot
 * as it is in `SHOTS`. A portrait screen gets the same view direction (the
 * angle above the board and the lean from the west) centred on the shot's
 * subject and pulled back until the subject fits the width, as `LOADER_FOCUS`
 * says; without it the chip would be cut by the sides of a phone. It is
 * continuous across the portrait range and a NaN aspect reads as landscape.
 */
export function loaderShotFor(id: LoaderShotId, aspect: number): CameraShot {
  const shot = SHOTS[id];
  if (!(aspect < 1)) return shot;
  const { aim, halfWidth } = LOADER_FOCUS[id];
  const a = Math.max(aspect, MIN_ASPECT);
  const distance = halfWidth / (Math.tan((shot.fov * RAD) / 2) * a);
  const away = [shot.position[0] - aim[0], shot.position[1] - aim[1], shot.position[2] - aim[2]] as const;
  const length = Math.hypot(...away);
  return {
    position: [aim[0] + (away[0] / length) * distance, aim[1] + (away[1] / length) * distance, aim[2] + (away[2] / length) * distance],
    target: aim,
    fov: shot.fov
  };
}

/** `a` and `b` mixed: `a` at `t` = 0 and `b` at `t` = 1. */
function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * The shot `t` of the way from `a` to `b` (0 is `a`, 1 is `b`; not clamped, so
 * an eased `t` that overshoots overshoots the camera too). The position, the
 * look-at point and the fov each move in a straight line, which is all the
 * loader needs: its three shots lie roughly along one descent.
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
 */
export function applyCameraShot(camera: THREE.PerspectiveCamera, shot: CameraShot, aspect: number): void {
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
