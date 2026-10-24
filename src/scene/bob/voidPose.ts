/**
 * The void's per-frame decisions as plain rules: when the void and the beads show, which bead is selected, how the
 * beads' motion clocks run and how the hover eases, and what `frame.journey` reports. Pure, so the tests read the very
 * decisions the Void (src/scene/bob/Void.tsx) and the Opening make on each frame; it imports no code from React or three
 * (types only, the journey's beads and the objects' motion numbers).
 */
import type { CameraShot } from '~/engine/bob/shots';
import { BEAD_MOTION } from '~/engine/bob/beadMotion';
import { BEADS, type JourneyAt } from './journey';

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

/** The selected bead: the bead of the project stretch the journey is on (0, 1 or 2, in `BEADS` order), else none. */
export function selectedBead(at: JourneyAt): number | null {
  return at.stretch === 'project' ? at.project : null;
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
