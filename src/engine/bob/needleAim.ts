/**
 * How the home's needle is aimed (spec section 2.2): at the pointer, with a
 * slight, heavy delay, on a mouse or a pen; on its own slow drift round the
 * rest on a touch screen, which has no cursor to follow. Pure, and it imports
 * nothing from three or React (types only), so the tests read the very
 * numbers the Home applies.
 *
 * Angles are radians as `CompassModel.setNeedle` takes them and as
 * ~/engine/bob/needle has them: 0 is up the screen, and positive turns
 * clockwise as the camera sees it. The home camera looks at the compass
 * almost straight on (13 degrees above it), so the screen's up is the
 * needle's up, and an angle read on the screen is the angle to turn it to.
 */
import type { SceneKind } from '~/app/handle';
import type { Phase } from '~/state/machine';
import { NEEDLE_REST } from './needle';

/**
 * The needle's spring, for `new AngleSpring(zeta, omega)` (moved from v3's
 * aim): it overshoots by about an eighth and settles in about two seconds, so
 * the needle trails the pointer by a slight, readable delay and does not whip.
 */
export const NEEDLE_SPRING = { zeta: 0.55, omega: 3.2 } as const;

/**
 * The angle from `pivot` to `pointer`, both in screen pixels with y down: 0
 * when the pointer is straight above the pivot, pi/2 straight to its right,
 * -pi/2 to its left, and +-pi below. Only the direction counts, never the
 * distance. A pointer on the pivot itself has no direction, and a point that
 * is not finite has none either: both answer NaN, and the needle keeps the
 * target it had.
 */
export function needleAngleFor(pointer: { x: number; y: number }, pivot: { x: number; y: number }): number {
  const dx = pointer.x - pivot.x;
  const dy = pointer.y - pivot.y;
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return Number.NaN;
  return Math.atan2(dx, -dy);
}

/** The touch drift: `depth` radians either side of the rest, once round every `period` seconds. */
export const DRIFT = { depth: 0.6, period: 14 } as const;

/**
 * Where a needle with no pointer to follow (a touch screen) is pulled at `t`
 * seconds of the home's idle motion: `NEEDLE_REST + 0.6 sin(2 pi t / 14)`, a
 * slow swing of about 34 degrees either way round its rest, starting at the
 * rest, so it sets off from where the loader left it. A time that is not
 * finite reads as rest.
 */
export function driftAngle(t: number): number {
  if (!Number.isFinite(t)) return NEEDLE_REST;
  return NEEDLE_REST + DRIFT.depth * Math.sin((2 * Math.PI * t) / DRIFT.period);
}

/**
 * The first idle time at or after `t` (seconds) where the drift is back at its
 * rest: the next whole `DRIFT.period`. A drifting needle runs on to it once
 * its idle while is over, so the scene falls asleep with the needle at rest
 * rather than stopped part-way through a swing, as v3's drift ran on until it
 * rested on a constellation. A time before 0, or not a number, reads as 0.
 */
export function nextDriftRest(t: number): number {
  const s = t > 0 ? t : 0;
  return Math.ceil(s / DRIFT.period) * DRIFT.period;
}

/**
 * Whether the needle aims (at the pointer, or by the drift): on the home page
 * at rest, HOME_IDLE with the home scene shown. Anywhere else (a page over the
 * scene, a scroll chapter, the loader) the needle holds where it points, the
 * camera's parallax rests, and a pointer moving there stirs nothing.
 */
export function isAiming(phase: Phase['kind'], scene: SceneKind | null): boolean {
  return phase === 'HOME_IDLE' && scene === 'home';
}

/**
 * Whether the home's needle aims at this point of the scroll: as `isAiming`, and only at the home itself, the rise `u`
 * (src/scene/bob/scrollPose.ts `riseAt`) at exactly 0. Anywhere up the rise the needle's spring holds the target it had
 * and the dip carries the needle down; a pointer or the drift moves nothing. Back at 0 the aim takes up again, and the
 * spring follows the new target from where it is, so nothing snaps. A rise that is not a number is not the home.
 */
export function aimsAt(phase: Phase['kind'], scene: SceneKind | null, u: number): boolean {
  return u === 0 && isAiming(phase, scene);
}
