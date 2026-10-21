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
 * - `home` (frame 04): a low camera south of the compass, about 13 degrees
 *   above its plane, with its eye line a third of the way down from the top of
 *   the picture, so the ship stands in the dark above the far rim and China
 *   and Aruba reach the sides. The fov is wide enough that the outermost stars
 *   (x = 2.075) land inside the frame, which fixes the distance.
 */
export const SHOTS: { loaderMacro: CameraShot; loaderRise: CameraShot; home: CameraShot } = {
  loaderMacro: { position: [-0.3, 0.9, 0.82], target: [0.21, -0.18, 0.14], fov: 32 },
  loaderRise: { position: [-0.42, 1.81, 1.96], target: [0.13, -0.12, 0.14], fov: 40 },
  home: { position: [0, 0.8, 3.4], target: [0, 0.25, 0], fov: 48 }
};

const RAD = Math.PI / 180;

/** The narrowest screen the portrait framing plans for (aspect = width over height); a thinner one is framed as this, so the camera stays a finite distance away. */
const MIN_ASPECT = 0.25;

/**
 * How the home is reframed on a screen taller than it is wide. The scene is
 * wide (the side constellations reach 2.075 out), so on a tall screen the
 * camera pulls back until `halfWidth` world units each side of the look-at
 * point fit the width, and widens the fov by `widen` degrees at most so the
 * perspective stays as dramatic as the landscape frame's. It holds the
 * compass's centre about `dialDrop` below the middle of the picture (in NDC;
 * the landscape frame has it a little lower, at 0.25), and keeps the camera's
 * pitch above the look-at line as the landscape shot has it.
 *
 * `halfWidth` is the rim's radius times 2.1, so the rim spans under half the
 * width and the side constellations' outermost stars stand just inside the
 * frame (they reach 2.075 out, and the curve of their feet brings some nearer
 * the camera than the look-at point, which draws them wider).
 */
const PORTRAIT = { halfWidth: DIAL.rim * 2.1, widen: 8, dialDrop: 0.2 } as const;

/** The angle in radians the home camera stands above the line from its look-at point, which the portrait framing keeps. */
const HOME_PITCH = Math.atan2(SHOTS.home.position[1] - SHOTS.home.target[1], SHOTS.home.position[2] - SHOTS.home.target[2]);

/**
 * The home shot for a screen of this aspect (width over height). A screen at
 * least as wide as tall gets `SHOTS.home` as it is. A portrait screen gets
 * the same view pulled back and widened until the rim fits the width and the
 * side constellations' centres stay in frame, as `PORTRAIT` describes.
 * It is continuous across the portrait range, so a phone turning or a window
 * resizing does not jump the camera between sizes; a NaN aspect reads as
 * landscape.
 */
export function homeShotFor(aspect: number): CameraShot {
  if (!(aspect < 1)) return SHOTS.home;
  const a = Math.max(aspect, MIN_ASPECT);
  const fov = SHOTS.home.fov + PORTRAIT.widen * (1 - a);
  const tanHalf = Math.tan((fov * RAD) / 2);
  // The half-width the camera sees at its look-at point is distance * tanHalf * aspect.
  const distance = PORTRAIT.halfWidth / (tanHalf * a);
  const lift = PORTRAIT.dialDrop * distance * tanHalf;
  return {
    position: [0, lift + distance * Math.sin(HOME_PITCH), distance * Math.cos(HOME_PITCH)],
    target: [0, lift, 0],
    fov
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
 * A loader shot for a screen of this aspect (width over height). A screen at
 * least as wide as tall gets the shot as it is in `SHOTS`. A portrait screen
 * gets the same view direction (the angle above the board and the lean from
 * the west) centred on the shot's subject and pulled back until the subject
 * fits the width, as `LOADER_FOCUS` says; without it the chip would be cut by
 * the sides of a phone. Like `homeShotFor` it is continuous across the
 * portrait range and a NaN aspect reads as landscape.
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
