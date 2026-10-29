/**
 * The void's per-frame decisions as plain rules: when the void and the beads show, which bead is selected, which beads
 * the pointer may take, how the hover eases, the veins' wake each bead is given, and what `frame.journey` reports. Pure,
 * so the tests read the very decisions the Void (src/scene/bob/Void.tsx) and the Opening make on each frame; it imports
 * no code from React or three (types only, the light dive's needle glow, the path's sweep and the veins' levels).
 */
import type { CameraShot } from '~/engine/bob/shots';
import { LAND_STOP } from '~/state/chapters';
import type { JourneyAt, JourneyPose, NeedleOverride } from './journey';
import { F, needleGlow } from './lightDive';

type Vec3 = readonly [number, number, number];

/** The glass, the plane y = 0 (~/engine/bob/wordmark): above it is the home, under it the tunnel and the void. */
const GLASS_Y = 0;

/**
 * Whether the void and the beads show for a camera on `shot`: only once it is under the glass, in the tunnel or below.
 * Hidden through the rise, at BOB from above and on the descent to the opening, where the camera sees the glass floor:
 * on the high tier the floor lets what lies under it through and its reflector draws the scene again, and the void's
 * traces draw with no depth test, so a void shown there would lie as a second set of traces under the home's, and cost
 * the reflector's render. Over the opening the camera sees only down the tunnel, to the dark below.
 */
export function voidShownFor(shot: CameraShot): boolean {
  return shot.position[1] < GLASS_Y;
}

/** The light dive's frame from which the void shows (the previs's VOID_IN): its band fades in from here. */
export const VOID_FROM = 20;

/**
 * Whether the void shows at `pose`: from the light dive's frame 20 on, through the light's path, the sheet and the end; never on
 * the rise. Above the glass, where the void would show under the home's, the glass dissolves over frames 16-28
 * (`GlassModel.setDissolve`) and the void's own glass sky is out (`VoidModel.setSky`) while the camera is above it.
 */
export function voidShownAt(pose: Pick<JourneyPose, 'at' | 'void'>): boolean {
  if (pose.void === null) return false;
  return pose.at.frame === null || pose.at.frame >= VOID_FROM;
}

/** The compass's pivot at BOB from above, where the light ignites (M2a's last frame: the needle there at scale 1). */
const PIVOT: Vec3 = [0, 0.09, 0];

/**
 * The needle the Void hands the compass (`CompassModel.setNeedleWorld`) at `pose`: the journey's own where it has one
 * (none now: the light stays the light to the end); else, once the light ignites (way frames 2-8, `pose.ignite`), the
 * compass's needle held at its pivot, its tip straight down as the rise left it, shrinking to nothing as the light takes
 * its place, and nothing through the fall and the path; and none on the rise, where the compass holds it.
 */
export function needleFor(pose: Pick<JourneyPose, 'needle' | 'ignite'>): NeedleOverride | null {
  if (pose.needle !== null) return pose.needle;
  return pose.ignite > 0 ? { position: PIVOT, scale: 1 - pose.ignite, aim: null } : null;
}

/**
 * The needle's glow (`CompassModel.setNeedleGlow`) where the journey holds it: drawn out of the light from way frame 272
 * (`F.NEEDLE`), 6 at the arrival, down to its rest glow by frame 296 (`needleGlow`). Null where the journey does not
 * hold it: on the rise, where the home breathes it, in the light dive before it would be drawn out, where it is hidden,
 * and on the light's path, where the light stays the light to the end.
 */
export function needleGlowFor(at: JourneyAt): number | null {
  if (at.stretch === 'rise') return null;
  if (at.stretch === 'light') return at.frame !== null && at.frame >= F.NEEDLE ? needleGlow(at.frame) : null;
  return null;
}

/** The hover as the beads show it: the bead whose hover is in (`BeadsModel.setHover`) and how far, 0..1. */
export interface HoverEase {
  id: number | null;
  amount: number;
}

/** No hover. */
export function hoverEase(): HoverEase {
  return { id: null, amount: 0 };
}

/**
 * The hover's time constant, seconds: it is most of the way in after about three of them (a quarter second), as the
 * spec's "turns slightly toward you and brightens a little" asks, with no snapping.
 */
export const HOVER_SMOOTH = 0.08;

/** Within this of its goal the hover is there. */
const HOVER_SETTLED = 1e-3;

/**
 * Eases the hover (in place) toward the bead under the pointer, `target` (null: none), by `dt` seconds, one bead at a
 * time: a hover moving to another bead eases the first out to 0 before the next comes in, as `setHover` lets only one
 * bead be hovered. With reduced motion it is taken at once. Answers whether it is still easing.
 */
export function easeHover(hover: HoverEase, target: number | null, dt: number, reduced: boolean): boolean {
  if (reduced) {
    hover.id = target;
    hover.amount = target === null ? 0 : 1;
    return false;
  }
  if (hover.id !== target && hover.amount <= 0) {
    hover.id = target;
    hover.amount = 0;
  }
  const goal = hover.id !== null && hover.id === target ? 1 : 0;
  const k = dt > 0 ? 1 - Math.exp(-dt / HOVER_SMOOTH) : 0;
  hover.amount += (goal - hover.amount) * k;
  if (Math.abs(goal - hover.amount) < HOVER_SETTLED) hover.amount = goal;
  // Eased out: the next bead's turn, or none.
  if (hover.amount === 0 && hover.id !== target) hover.id = target;
  return !(hover.id === target && hover.amount === (target === null ? 0 : 1));
}

/** Writes where the journey stands into `frame.journey` (its stretch, local and project), leaving its `voidState`. */
export function writeJourney(
  into: { stretch: JourneyAt['stretch']; local: number; project: number | null; frame: number | null; sheet: number },
  pose: Pick<JourneyPose, 'at' | 'sheet'>
): void {
  const { at } = pose;
  into.stretch = at.stretch;
  into.local = at.local;
  into.project = at.project;
  into.frame = at.frame;
  into.sheet = pose.sheet;
}

/**
 * Whether the pointer is read for the beads with the journey at `pose`: whether it may hover a bead, and whether a click
 * (a tap) may open the selected one (src/scene/bob/Void.tsx). Not once the sheet over the look back has begun to come up
 * (`sheet` above 0), either way, nor at the credits: the page covers the scene there, inert while it moves, so a click
 * on it would go through to a bead under it; there a pointer neither turns a bead nor wakes the canvas, and a click or a
 * tap opens nothing. Everywhere else on the path, as before: `sheet` is 0 there (a sheet that is not a number reads
 * as none, as the end view reads it).
 */
export function hoversAt(pose: Pick<JourneyPose, 'sheet'>): boolean {
  return !(pose.sheet > 0);
}

/**
 * Which projects the pointer may hover and a click may open at `pose` (spec 2026-10-27-bob-hologram-world-design.md):
 * any project on the world once the world is in (its stop, and on), every area, the look back (its own stop included);
 * none in the light dive, while the light is still coming down, and under the sheet. A click opens only at rest
 * (./inside.ts `opensOnClick`); the hover lights a project wherever the pointer may take it.
 */
export function pointerMode(pose: Pick<JourneyPose, 'at' | 'path'>): 'any' | null {
  const { at } = pose;
  if (at.stretch === 'land') return at.local >= LAND_STOP - 1e-6 ? 'any' : null;
  return at.stretch === 'area' || at.stretch === 'look' || (at.stretch === 'sheet' && at.local === 0) ? 'any' : null;
}

/**
 * Which of `spheres` the pointer is on, by its ray from `origin` along `dir` (a unit long): of those the ray passes
 * through in front of it, the one whose middle it passes nearest, as a share of that sphere's radius; or none. So a
 * small project seen behind a big one's edge is the one the pointer is on when it is on the small one's middle.
 */
export function nearestSphere(origin: Vec3, dir: Vec3, spheres: readonly { centre: Vec3; radius: number }[]): number | null {
  let best: number | null = null;
  let bestShare = Infinity;
  spheres.forEach(({ centre, radius }, k) => {
    const v = [centre[0] - origin[0], centre[1] - origin[1], centre[2] - origin[2]] as const;
    const along = v[0] * dir[0] + v[1] * dir[1] + v[2] * dir[2];
    if (along <= 0 || !(radius > 0)) return;
    const off = Math.hypot(v[0] - dir[0] * along, v[1] - dir[1] * along, v[2] - dir[2] * along);
    const share = off / radius;
    if (share <= 1 && share < bestShare) {
      bestShare = share;
      best = k;
    }
  });
  return best;
}
