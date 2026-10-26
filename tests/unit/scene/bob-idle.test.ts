import { describe, expect, it } from 'vitest';
import { type IdleClock, idleRuns, idlesAt, needleRests, stirIdle } from '~/scene/bob/idle';
import { journeyAt } from '~/scene/bob/journey';
import { TOP_FADE } from '~/scene/bob/lightDive';
import { IDLE_SECONDS } from '~/scene/bob/look';
import { placeOfFrame } from '~/state/chapters';

/** Places where the compass is in view: the home, up the rise, BOB from above, and the light dive before the top fades. */
const IN_VIEW = [0, 0.5, 1, placeOfFrame(5), placeOfFrame(13.9)];
/** Places where it is not: the top fading and gone, the fall, the ring, the sheet and the end page. */
const OUT_OF_VIEW = [placeOfFrame(14), placeOfFrame(28), placeOfFrame(121), 4, 4.5, 5, 6, 6.5, 7];

describe("the home's idle runs only while the compass is in view", () => {
  it('lets the idle run on the rise and at BOB from above, until the glass top starts to fade at frame 14', () => {
    expect(TOP_FADE).toEqual([14, 28]);
    for (const p of IN_VIEW) expect(idlesAt(journeyAt(p)), `at ${p}`).toBe(true);
  });

  it('runs none past it, so the canvas sleeps once the scroll rests in the fall, the ring, the sheet or the end page', () => {
    for (const p of OUT_OF_VIEW) expect(idlesAt(journeyAt(p)), `at ${p}`).toBe(false);
  });

  it('starts no idle where it does not run, and stops a while still running from before at once', () => {
    const quiet: IdleClock = { idleUntil: 0, idleTime: 3, driftUntil: 0 };
    expect(stirIdle(quiet, journeyAt(placeOfFrame(121)), 10_000)).toBe(false);
    expect(quiet).toEqual({ idleUntil: 0, idleTime: 3, driftUntil: 0 });
    const clock: IdleClock = { idleUntil: 0, idleTime: 0, driftUntil: 0 };
    expect(stirIdle(clock, journeyAt(0.5), 9_000)).toBe(true);
    expect(clock.idleUntil).toBe(9_000 + IDLE_SECONDS * 1000);
    expect(idleRuns(clock, journeyAt(0.5), 10_000, false, false)).toBe(true);
    for (const p of OUT_OF_VIEW) expect(idleRuns(clock, journeyAt(p), 10_000, false, false), `at ${p}`).toBe(false);
    // Not even for a drifting needle with its run not over.
    expect(idleRuns({ idleUntil: 0, idleTime: 1, driftUntil: 4 }, journeyAt(7), 10_000, false, true)).toBe(false);
  });

  it('keeps the idle as it was on the rise: within its while, a drift on to its rest, none with reduced motion', () => {
    const rise = journeyAt(0.3);
    const clock: IdleClock = { idleUntil: 0, idleTime: 0, driftUntil: 0 };
    stirIdle(clock, rise, 0);
    expect(idleRuns(clock, rise, IDLE_SECONDS * 1000 - 1, false, false)).toBe(true);
    expect(idleRuns(clock, rise, IDLE_SECONDS * 1000, false, false)).toBe(false);
    expect(idleRuns({ idleUntil: 0, idleTime: 1, driftUntil: 4 }, rise, 10_000, false, true)).toBe(true);
    expect(idleRuns(clock, rise, 1, true, false)).toBe(false);
  });

  it('sets the needle straight onto its target where the idle does not run, and with reduced motion', () => {
    for (const p of OUT_OF_VIEW) expect(needleRests(journeyAt(p), false), `at ${p}`).toBe(true);
    for (const p of IN_VIEW) {
      expect(needleRests(journeyAt(p), false), `at ${p}`).toBe(false);
      expect(needleRests(journeyAt(p), true), `at ${p}, reduced motion`).toBe(true);
    }
  });
});
