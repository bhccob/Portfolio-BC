/**
 * The home's idle clock (src/scene/bob/Home.tsx): for IDLE_SECONDS after the last stir, and for a drifting needle on to the
 * drift's next rest, the bands turn, the smoke drifts and the needle breathes; then it stops, and the canvas may sleep.
 * Pure, so the tests read the very decisions Home makes on each frame.
 *
 * The end page is the exception (spec 2026-10-24-bob-end-page-design.md: the scene "draws nothing while the page is
 * read"): there the compass is out of view behind the page, so no stir starts the idle (the phase change into END is one)
 * and a while still running from before stops at once. The canvas sleeps as soon as the story rests at the end.
 */
import { nextDriftRest } from '~/engine/bob/needleAim';
import type { Stretch } from './journey';
import { IDLE_SECONDS } from './look';

/** The idle clock as Home keeps it (`HomeState`). */
export interface IdleClock {
  /** When the idle motion's while ends (performance.now() ms): IDLE_SECONDS after the last stir. */
  idleUntil: number;
  /** Seconds of idle motion since the hand-over: the clock of the drift and the breath, and of the turn and the smoke. */
  idleTime: number;
  /** Where a drifting needle's run ends on that clock: the drift's first rest at or after the idle while's end. */
  driftUntil: number;
}

/** Whether the idle motion may run with the journey on `stretch` (the frame's pose): everywhere but the end page. */
export function idlesAt(stretch: Stretch): boolean {
  return stretch !== 'end';
}

/**
 * A stir (the hand-over, a phase change, a pointer move at home, a move of the rise): starts the idle while, IDLE_SECONDS
 * from `now`, and a drifting needle's run on to the drift's next rest after it, where the journey idles (`idlesAt`).
 * Answers whether it started one; at the end page it starts nothing and leaves the clock as it was.
 */
export function stirIdle(clock: IdleClock, stretch: Stretch, now: number): boolean {
  if (!idlesAt(stretch)) return false;
  clock.idleUntil = now + IDLE_SECONDS * 1000;
  clock.driftUntil = nextDriftRest(clock.idleTime + IDLE_SECONDS);
  return true;
}

/**
 * Whether the idle motion runs this frame: never with reduced motion nor at the end page; else within its while, or for a
 * drifting needle until the drift's rest.
 */
export function idleRuns(clock: IdleClock, stretch: Stretch, now: number, reduced: boolean, drifting: boolean): boolean {
  return idlesAt(stretch) && !reduced && (now < clock.idleUntil || (drifting && clock.idleTime < clock.driftUntil));
}
