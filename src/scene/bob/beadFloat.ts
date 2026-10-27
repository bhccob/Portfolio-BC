/**
 * The bead at its arrival floats, and turns a little for the visitor (spec 2026-10-27-bob-nebula-space-design.md,
 * goal 5), as plain numbers: its drift up and down and its slight sway at a time of its clock, its turn toward the
 * pointer over it, and how long the float runs. Pure: the Void (./Void.tsx) runs the clock and eases the turn, and the
 * beads take the sum as an offset on top of their place and facing (`BeadsModel.setPose`).
 */
import { IDLE_SECONDS } from './look';

const DEG = Math.PI / 180;
const TAU = 2 * Math.PI;

/**
 * The float, in metres, seconds and radians (my calls, as the spec leaves them to the builder):
 * - `lift`: how far the bead drifts up and down, once every `period` seconds;
 * - `sway`: how far it rolls and pitches as it drifts, each on a slower or quicker beat of its own, so the move never
 *   repeats in step;
 * - `turnMax`: the most it turns toward the pointer (or a finger's drag), at the edge of the bead;
 * - `idle`: how long the float runs after the last input, seconds: the home's idle while (`IDLE_SECONDS`), so the canvas
 *   sleeps at rest.
 */
export const FLOAT = { lift: 0.06, period: 5.5, sway: 1.5 * DEG, turnMax: 12 * DEG, idle: IDLE_SECONDS } as const;

/** How far past its outline (a share of its radius on the screen) the pointer still turns the bead. */
const REACH = 1.1;

/**
 * The float at `t` seconds of its clock for the bead with `phase` (its place on the way: beads drift apart by it): the
 * bead's lift `y` (m) and its `roll` and `pitch` (radians), each a sine on its own beat, all 0 at time 0 for the first
 * bead. A time that is not a number is rest.
 */
export function floatAt(t: number, phase: number): { y: number; roll: number; pitch: number } {
  if (!Number.isFinite(t)) return { y: 0, roll: 0, pitch: 0 };
  const w = (TAU * t) / FLOAT.period;
  return {
    y: FLOAT.lift * Math.sin(w + phase),
    roll: FLOAT.sway * Math.sin(w / 1.37 + phase * 1.7),
    pitch: FLOAT.sway * Math.sin(w / 0.83 + phase * 2.3)
  };
}

/**
 * The turn toward `pointer` (screen px) of a bead drawn at `bead` (its centre and radius, screen px): the pointer's
 * offset from the centre as a share of the radius, held to 1, times `FLOAT.turnMax`, so it turns most at its edge and
 * never past it; `yaw` > 0 turns its porthole to the screen's right, `pitch` > 0 up. None with the pointer past REACH
 * of its radius, nor for a pointer or a bead that is not a number or not there.
 */
export function turnToward(pointer: { x: number; y: number }, bead: { x: number; y: number; r: number }): { yaw: number; pitch: number } {
  if (!(bead.r > 0)) return { yaw: 0, pitch: 0 };
  const dx = (pointer.x - bead.x) / bead.r;
  const dy = (bead.y - pointer.y) / bead.r;
  const d = Math.hypot(dx, dy);
  if (!(d <= REACH)) return { yaw: 0, pitch: 0 };
  const k = d > 1 ? FLOAT.turnMax / d : FLOAT.turnMax;
  return { yaw: dx * k + 0, pitch: dy * k + 0 };
}

/** How quickly the float settles to rest or comes back (a time constant, s): settled within about half a second. */
const SETTLE = 0.12;

/**
 * The share of its float a bead keeps, from `share`, `dt` seconds on: easing toward all of it while it floats (`on`)
 * and toward none when it stops (a click opens it, the story moves on), so the bead settles to rest under the camera
 * flying in and never snaps; within a hundredth of its end it is there (a fraction of a millimetre, of a degree). A step
 * that is not a number changes nothing.
 */
export function floatShare(share: number, on: boolean, dt: number): number {
  if (!Number.isFinite(dt)) return share;
  const goal = on ? 1 : 0;
  const next = share + (goal - share) * (1 - Math.exp(-Math.max(0, dt) / SETTLE));
  return Math.abs(next - goal) < 0.01 ? goal : next;
}

/** Whether the float (and the turn's easing) runs `sinceInput` seconds after the last input: for `FLOAT.idle`, never with reduced motion. */
export function floatRuns(sinceInput: number, reduced: boolean): boolean {
  return !reduced && sinceInput < FLOAT.idle;
}
