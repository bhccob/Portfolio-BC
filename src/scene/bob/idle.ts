/**
 * The home's idle clock (src/scene/bob/Home.tsx): for IDLE_SECONDS after the last stir, and for a drifting needle on to the
 * drift's next rest, the bands turn, the smoke drifts and the needle breathes; then it stops, and the canvas may sleep.
 * Pure, so the tests read the very decisions Home makes on each frame.
 *
 * It runs only while the compass is in view: on the rise, and in the light dive until the glass top starts to fade (way
 * frame 14, TOP_FADE), past which the compass dims and is gone and the light is all there is. Anywhere else (the fall,
 * the ring, the sheet, the end page) no stir starts it and a while still running from before stops at once, so the
 * canvas sleeps as soon as the scroll rests there (spec 2026-10-25-bob-light-dive-design.md: nothing moves by itself).
 */
import { nextDriftRest } from '~/engine/bob/needleAim';
import type { JourneyAt } from './journey';
import { TOP_FADE } from './lightDive';
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

/** Where the idle is asked about: the journey's stretch, and its way frame in the light dive (`JourneyAt`). */
export type IdleAt = Pick<JourneyAt, 'stretch' | 'frame'>;

/** Whether the idle motion may run with the journey at `at` (the frame's pose): while the compass is in view. */
export function idlesAt(at: IdleAt): boolean {
  // A hair short of the frame counts as on it: a place read back from the scroll carries a rounding.
  return at.stretch === 'rise' || (at.stretch === 'light' && at.frame !== null && at.frame < TOP_FADE[0] - 1e-6);
}

/**
 * A stir (the hand-over, a phase change, a pointer move at home, a move of the rise): starts the idle while, IDLE_SECONDS
 * from `now`, and a drifting needle's run on to the drift's next rest after it, where the journey idles (`idlesAt`).
 * Answers whether it started one; where the compass is out of view it starts nothing and leaves the clock as it was.
 */
export function stirIdle(clock: IdleClock, at: IdleAt, now: number): boolean {
  if (!idlesAt(at)) return false;
  clock.idleUntil = now + IDLE_SECONDS * 1000;
  clock.driftUntil = nextDriftRest(clock.idleTime + IDLE_SECONDS);
  return true;
}

/**
 * Whether the needle's spring is set straight onto its target this frame, with no swing: with reduced motion (no
 * animation), and wherever the compass is out of view (Ruling 19: the end page, and now the fall and the ring too). A swing
 * still under way there from the home (a pointer moved at the home just before End, which reaches the end page in about
 * 1.4 s while the spring takes about 3.5 s to settle) would keep the canvas drawing for seconds after the rest. Leaving
 * the end page the spring goes on from its target, still.
 */
export function needleRests(at: IdleAt, reduced: boolean): boolean {
  return reduced || !idlesAt(at);
}

/**
 * Whether the idle motion runs this frame: never with reduced motion nor where the compass is out of view; else within its while, or for a
 * drifting needle until the drift's rest.
 */
export function idleRuns(clock: IdleClock, at: IdleAt, now: number, reduced: boolean, drifting: boolean): boolean {
  return idlesAt(at) && !reduced && (now < clock.idleUntil || (drifting && clock.idleTime < clock.driftUntil));
}
