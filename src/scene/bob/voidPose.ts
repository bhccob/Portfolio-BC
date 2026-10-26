/**
 * The void's per-frame decisions as plain rules: when the void and the beads show, which bead is selected, how the
 * beads' motion clocks run and how the hover eases, and what `frame.journey` reports. Pure, so the tests read the very
 * decisions the Void (src/scene/bob/Void.tsx) and the Opening make on each frame; it imports no code from React or three
 * (types only, the journey's beads, the light dive's needle glow and the objects' motion numbers).
 */
import type { CameraShot } from '~/engine/bob/shots';
import { BEAD_MOTION } from '~/engine/bob/beadMotion';
import { BEADS, type JourneyAt, type JourneyPose, type NeedleOverride } from './journey';
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
 * Whether the void shows at `pose`: from the light dive's frame 20 on, through the ring, the sheet and the end; never on
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
 * (drawn out of the light at the ring from way frame 272, and round the ring); else, once the light ignites (way frames
 * 2-8, `pose.ignite`), the compass's needle held at its pivot, its tip straight down as the rise left it, shrinking to
 * nothing as the light takes its place, and nothing through the fall; and none on the rise, where the compass holds it.
 */
export function needleFor(pose: Pick<JourneyPose, 'needle' | 'ignite'>): NeedleOverride | null {
  if (pose.needle !== null) return pose.needle;
  return pose.ignite > 0 ? { position: PIVOT, scale: 1 - pose.ignite, aim: null } : null;
}

/**
 * The needle's glow (`CompassModel.setNeedleGlow`) where the journey holds it: drawn out of the light from way frame 272
 * (`F.NEEDLE`), 6 at the arrival (the mock-up's near-white flash), down to its rest glow by frame 296 (`needleGlow`),
 * and 1 round the ring, under the sheet and at the end page. Null where the journey does not hold it: on the rise, where
 * the home breathes it, and in the light dive before it is drawn out, where it is hidden.
 */
export function needleGlowFor(at: JourneyAt): number | null {
  if (at.stretch === 'rise') return null;
  if (at.stretch === 'light') return at.frame !== null && at.frame >= F.NEEDLE ? needleGlow(at.frame) : null;
  return 1;
}

/** The selected bead: the project in front of the ring (0, 1 or 2, in `BEADS` order, within `PROJECT_NEAR` of it), else none. */
export function selectedBead(at: JourneyAt): number | null {
  return at.stretch === 'ring' || at.stretch === 'sheet' ? at.project : null;
}

/**
 * Whether the journey stands in the ring: round it, and at Cookies Clicker's stop (6), which `journeyAt` reads as the
 * sheet's start; not once the sheet is up at all.
 */
export function inRing(at: Pick<JourneyAt, 'stretch' | 'local'>): boolean {
  return at.stretch === 'ring' || (at.stretch === 'sheet' && at.local === 0);
}

/** What the front bead's label shows: the project's bead, in `BEADS` order, and whether it shows in full. */
export interface LabelFor {
  project: number;
  rest: boolean;
}

/**
 * The front bead's label in the ring: the project in front (within `PROJECT_NEAR`, 20 degrees, of the ring's front),
 * shown in full while the ring stands still (`still`: the shown place on its target) and clear while it turns; none
 * between projects, in the light dive, under the sheet or at the end page.
 */
export function labelFor(at: JourneyAt, still: boolean): LabelFor | null {
  if (!inRing(at) || at.project === null) return null;
  return { project: at.project, rest: still };
}

/** Funcial's place in `BEADS`: the one bead whose abacus has a clock of its own. */
const FUNCIAL = BEADS.findIndex(({ id }) => id === 'funcial');

/** How long Funcial's abacus takes to slide all the way up (~/engine/bob/beadMotion), seconds: its own clock's reach. */
export const ABACUS_SPAN = BEAD_MOTION.funcial.abacus.span;

/** Under this, a clock counting down is at 0 (a sum of frame steps leaves a few ulps). */
const AT_ZERO = 1e-9;

/**
 * The beads' motion clocks, in `BEADS` order: whether each ran on the last step, its time (seconds of its object's
 * motion), and whether its object moved on the last step (`moving`: its clock ran, or Funcial's abacus slid).
 * `abacus` is Funcial's abacus's own clock, 0..`ABACUS_SPAN`.
 */
export interface BeadClocks {
  running: boolean[];
  time: number[];
  abacus: number;
  moving: boolean[];
}

/** Every clock stopped at 0: each object at its rest pose. */
export function beadClocks(): BeadClocks {
  return { running: BEADS.map(() => false), time: BEADS.map(() => 0), abacus: 0, moving: BEADS.map(() => false) };
}

/**
 * Steps the clocks (in place) by `dt` seconds. A bead's clock runs only while it is the selected bead or the hovered
 * one, and never with reduced motion, where the objects stay still; it goes on from where it stopped, so nothing of an
 * object jumps back as its bead comes forward again (Jontai Energy's light passes and Cookies Clicker's tick repeat on
 * their own; Funcial's platter turns and its pulse runs on).
 *
 * Funcial's abacus reads a clock of its own: `funcialMotion` slides its beads up one after another from time
 * 0 and holds them at the top, so its time counts up, to `ABACUS_SPAN` at most, while the bead is selected or hovered,
 * and back down to 0 while it is not: the beads slide back down as calmly as they came up, and slide up again from
 * wherever they are, never snapping. It too stands still with reduced motion. A step that is not a positive number of
 * seconds moves nothing. Answers whether any object moved.
 */
export function stepBeadClocks(clocks: BeadClocks, selected: number | null, hovered: number | null, dt: number, reduced: boolean): boolean {
  const step = dt > 0 ? dt : 0;
  let any = false;
  for (let i = 0; i < clocks.time.length; i++) {
    const runs = !reduced && (i === selected || i === hovered);
    if (runs) clocks.time[i]! += step;
    clocks.running[i] = runs;
    let moved = runs && step > 0;
    if (i === FUNCIAL && !reduced) {
      const was = clocks.abacus;
      const next = runs ? Math.min(ABACUS_SPAN, was + step) : was - step;
      clocks.abacus = next > AT_ZERO ? next : 0;
      moved ||= clocks.abacus !== was;
    }
    clocks.moving[i] = moved;
    any ||= moved;
  }
  return any;
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
export function writeJourney(into: { stretch: JourneyAt['stretch']; local: number; project: number | null }, at: JourneyAt): void {
  into.stretch = at.stretch;
  into.local = at.local;
  into.project = at.project;
}

/**
 * Whether the pointer is read for the beads with the journey at `pose`: whether it may hover a bead, and whether a click
 * (a tap) may open the selected one (src/scene/bob/Void.tsx). Not once the end page has begun to slide up (`sheet` above
 * 0), either way, nor at the end page: the page covers the scene there, inert while it moves, so a click on it would go
 * through to Cookies Clicker's bead under it; there a pointer neither turns a bead nor wakes the canvas, and a click or a
 * tap opens nothing. Everywhere else, round the ring, as before: `sheet` is 0 there (a sheet that is not a number reads
 * as none, as the end view reads it).
 */
export function hoversAt(pose: Pick<JourneyPose, 'sheet'>): boolean {
  return !(pose.sheet > 0);
}
