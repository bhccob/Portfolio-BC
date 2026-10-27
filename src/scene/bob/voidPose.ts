/**
 * The void's per-frame decisions as plain rules: when the void and the beads show, which bead is selected, which beads
 * the pointer may take, how the hover eases, the veins' wake each bead is given, and what `frame.journey` reports. Pure,
 * so the tests read the very decisions the Void (src/scene/bob/Void.tsx) and the Opening make on each frame; it imports
 * no code from React or three (types only, the light dive's needle glow, the path's sweep and the veins' levels).
 */
import { WAKE } from '~/engine/bob/beadBuild';
import type { BeadWake } from '~/engine/bob/build/beads';
import type { CameraShot } from '~/engine/bob/shots';
import type { JourneyAt, JourneyPose, NeedleOverride } from './journey';
import { type BeadView, lookingBack, type Path, wakeSweep } from './lightPath';
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

/**
 * The selected bead: the bead of an arrival (its place on the way, in `BEADS` order), the light at rest beside it,
 * whose label shows and which a click or a tap opens; none in a travel, where the light is between beads, nor in the look
 * back, where the pointer picks one.
 */
export function selectedBead(at: JourneyAt): number | null {
  return at.stretch === 'arrive' ? at.project : null;
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
 * The veins' wake bead `bead` is given on this frame (BeadsModel.setWake), in the camera's view (`view`: a world point to
 * its view-space x and y): its centre there, and its path's wake (./lightPath.ts) as the shell reads it. All awake is a
 * sweep past a whole turn (10), none a sweep of nothing; along the orbit, the light's sweep round the bead on the screen
 * so far (`wakeSweep`), with the glow just behind the light. Pure: the view is the caller's.
 */
export function wakeFor(bead: BeadView, path: Path, view: (p: readonly [number, number, number]) => readonly [number, number]): BeadWake {
  const centre = view(bead.centre);
  if (bead.wake.kind === 'full') return { centre, start: 0, span: 10, dir: 1, hot: 0 };
  if (bead.wake.kind === 'none') return { centre, start: 0, span: 0, dir: 1, hot: 0 };
  const sweep = wakeSweep((angle) => view(path.orbitAt(bead.index, angle)), centre, bead.wake.from, bead.wake.now);
  return { centre, ...sweep, hot: WAKE.hot };
}

/**
 * Which beads the pointer may hover and a click may open at `pose`: in an arrival the selected bead alone
 * (`selectedBead`), the one in view; in the look back (its own stop included) any bead on the way, and the small lights
 * of the projects off it; nowhere else (a travel, where the light is between beads, the light dive, under the sheet).
 */
export function pointerMode(pose: Pick<JourneyPose, 'at' | 'path'>): 'selected' | 'any' | null {
  if (pose.at.stretch === 'arrive') return 'selected';
  return pose.path !== null && lookingBack(pose.path) ? 'any' : null;
}
