import { describe, expect, it } from 'vitest';
import {
  changedChapter,
  holdLimit,
  inQa,
  jumpTarget,
  keyTarget,
  moveTarget,
  pinnedAtEnd,
  qaStepTarget,
  releaseTarget,
  restsAtTop,
  scrollEnabled,
  stopsFor
} from '../../../src/input/target';
import { LANDING_HOLD } from '../../../src/scene/bob/landingHold';
import { areaStop, buildChapters, HOME_CHAPTERS, keyStops, pathStart, placeOfFrame, qaStop, riseTop, scrollEnd, lookStop, worldStop } from '../../../src/state/chapters';
import type { Phase } from '../../../src/state/machine';

// The home's layout: HOME 0-1, LIGHT to the hand-over (frame 256), the land, an area per category, LOOK, SHEET, END.
// keyStops(c) = [0, 1, the five facts' places (frames 81, 121, 161, 201, 241), the world, each area, the look back's
// own stop (the sheet's start), the end].
const c = buildChapters({ areas: (['a', 'b', 'c'] as const).map((category) => ({ category: category as never, projects: [] })) });
const [F81, F121, , , F241] = [81, 121, 161, 201, 241].map(placeOfFrame) as [number, number, number, number, number];
/** The hand-over: the path's start, and the landing hold. */
const L = pathStart(c);
/** The world's stop, and the first two areas'. */
const W = worldStop(c);
const A0 = areaStop(c, 'a');
const A1 = areaStop(c, 'b');
/** The look back's own stop; the first question's; and the end, the end's mark on the ring. */
const S = lookStop(c);
const Q0 = qaStop(c, 0);
const E = scrollEnd(c);

describe('moveTarget', () => {
  describe('with motion', () => {
    it('adds the delta', () => {
      expect(moveTarget(3, 0.5, c, false)).toBeCloseTo(3.5, 12);
      expect(moveTarget(3, -0.5, c, false)).toBeCloseTo(2.5, 12);
    });

    it('stays inside the scroll: 0 to the end', () => {
      expect(moveTarget(0.2, -1, c, false)).toBe(0);
      expect(moveTarget(E - 0.1, 5, c, false)).toBe(E);
      expect(moveTarget(E, 0.5, c, false)).toBe(E);
      expect(moveTarget(S, 0.5, c, false)).toBeCloseTo(S + 0.5, 12);
    });
  });

  describe('with reduced motion: a step among the key stops', () => {
    it('steps to the next key stop for a delta down, whatever its size: the facts in the light dive, then the projects', () => {
      expect(moveTarget(0, 0.01, c, true)).toBe(1);
      expect(moveTarget(0, 7, c, true)).toBe(1);
      expect(moveTarget(1, 0.5, c, true)).toBe(F81);
      expect(moveTarget(F81, 0.01, c, true)).toBe(F121);
      expect(moveTarget(F241 + 0.1, 0.01, c, true)).toBe(W);
      expect(moveTarget(A0, 1, c, true)).toBe(A1);
      expect(moveTarget(S, 0.01, c, true)).toBe(Q0);
      // A question opened in the list (Bob, 2026-10-30) steps on to the end.
      expect(moveTarget(qaStop(c, 5), 0.01, c, true)).toBe(E);
    });

    it('steps to the previous key stop for a delta up', () => {
      // Up from the end, the Q&A's list (its inner marks are no stops).
      expect(moveTarget(E, -0.01, c, true)).toBe(Q0);
      expect(moveTarget(Q0, -0.01, c, true)).toBe(S);
      expect(moveTarget(A0, -0.01, c, true)).toBe(W);
      expect(moveTarget((F81 + F121) / 2, -0.01, c, true)).toBe(F81);
      expect(moveTarget(F81, -3, c, true)).toBe(1);
      expect(moveTarget(1, -1, c, true)).toBe(0);
    });

    it('stays at the ends, does nothing for no delta, and takes a target a hair short of a stop for being on it', () => {
      expect(moveTarget(0, -1, c, true)).toBe(0);
      expect(moveTarget(E, 1, c, true)).toBe(E);
      expect(moveTarget(2.3, 0, c, true)).toBe(2.3);
      expect(moveTarget(F81 - 1e-7, 1, c, true)).toBe(F121);
      expect(moveTarget(A0 + 1e-7, -1, c, true)).toBe(W);
    });
  });
});

describe('keyTarget: an arrow, Page Up or Down, or Space, without reduced motion', () => {
  it('moves by its distance on the rise, as M2a did, never past its top, BOB from above', () => {
    expect(keyTarget(0, 0.15, c)).toBeCloseTo(0.15, 12);
    expect(keyTarget(0.6, 0.15, c)).toBeCloseTo(0.75, 12);
    expect(keyTarget(0.9, 0.15, c)).toBe(1);
    expect(keyTarget(0.2, 0.9, c)).toBe(1);
  });

  it('steps from the top of the rise through the facts and the projects to the end, whatever its distance', () => {
    expect(keyTarget(1, 0.15, c)).toBe(F81);
    expect(keyTarget(F81, 0.9, c)).toBe(F121);
    expect(keyTarget(F241, 0.15, c)).toBe(W);
    expect(keyTarget(W, 0.15, c)).toBe(A0);
    expect(keyTarget(A0, 0.15, c)).toBe(A1);
    expect(keyTarget(S, 0.15, c)).toBe(Q0);
    expect(keyTarget(qaStop(c, 5), 0.15, c)).toBe(E);
    // A target between stops (a wheel under way, or one left on a travel) steps to the next one.
    expect(keyTarget(F241 + 0.1, 0.15, c)).toBe(W);
    expect(keyTarget(L + 4.66, 0.15, c)).toBe(A1);
  });

  it('steps up to the previous key stop past the top of the rise, and back on the rise moves by its distance again', () => {
    expect(keyTarget(E, -0.15, c)).toBe(Q0);
    expect(keyTarget(Q0, -0.15, c)).toBe(S);
    expect(keyTarget(W, -0.15, c)).toBe(F241);
    expect(keyTarget(F81, -0.9, c)).toBe(1);
    expect(keyTarget(1, -0.15, c)).toBeCloseTo(0.85, 12);
    expect(keyTarget(0.1, -0.9, c)).toBe(0);
  });

  it('does nothing at the ends, nor for no delta', () => {
    expect(keyTarget(E, 0.15, c)).toBe(E);
    expect(keyTarget(0, -0.15, c)).toBe(0);
    expect(keyTarget(3, 0, c)).toBe(3);
  });
});

describe("restsAtTop: the rise's rest at its top, BOB from above", () => {
  it('rests a gesture that comes up out of the rise on its top, unless it carried more than a whole unit past it', () => {
    expect(restsAtTop(0.5, 1.02, c)).toBe(true);
    expect(restsAtTop(0.5, 1.3, c)).toBe(true);
    expect(restsAtTop(0, (8 * 120) / 900, c)).toBe(true); // the 8th notch at 900 px, 1.067
    expect(restsAtTop(0, 2, c)).toBe(true); // a whole unit past it, and no more
    expect(restsAtTop(0, 2.02, c)).toBe(false); // more is a fling: it rests where it ends
  });

  it('leaves every other gesture where it ends: one that ends on the rise, one that began past it, one going up', () => {
    expect(restsAtTop(0.5, 0.9, c)).toBe(false);
    expect(restsAtTop(1, 1.3, c)).toBe(false);
    expect(restsAtTop(2, 1.5, c)).toBe(false);
    expect(restsAtTop(0.5, 1.3, c, -1)).toBe(false);
  });
});

describe("stopsFor: the stops the story rests on, by the void's state", () => {
  it('is the key stops while the void is there or still to come', () => {
    for (const state of ['idle', 'loading', 'ready'] as const) expect(stopsFor(HOME_CHAPTERS, state), state).toEqual(keyStops(HOME_CHAPTERS));
  });

  it('is the home, BOB from above, the facts, the landing hold and the end page when the void failed: the fall still plays', () => {
    const facts = [81, 121, 161, 201, 241].map(placeOfFrame);
    expect(stopsFor(c, 'failed')).toEqual([0, riseTop(c), ...facts, LANDING_HOLD, scrollEnd(c)]);
    expect(stopsFor(HOME_CHAPTERS, 'failed')).toEqual([0, 1, ...facts, LANDING_HOLD, scrollEnd(HOME_CHAPTERS)]);
  });
});

describe("a failed void's stops: the keys and reduced motion's steps among them", () => {
  const failed = stopsFor(c, 'failed');

  it('steps a key from BOB from above through the facts to the hold, on to the end page, and back; the rise stays the rise', () => {
    expect(keyTarget(1, 0.15, c, failed)).toBe(F81);
    expect(keyTarget(F241, 0.15, c, failed)).toBe(LANDING_HOLD);
    expect(keyTarget(LANDING_HOLD, 0.15, c, failed)).toBe(E);
    expect(keyTarget(E, -0.15, c, failed)).toBe(LANDING_HOLD);
    expect(keyTarget(LANDING_HOLD, -0.9, c, failed)).toBe(F241);
    expect(keyTarget(F81, -0.9, c, failed)).toBe(1);
    expect(keyTarget(0, 0.15, c, failed)).toBeCloseTo(0.15, 12);
    expect(keyTarget(1, -0.15, c, failed)).toBeCloseTo(0.85, 12);
  });

  it("steps reduced motion's move the same way, and leaves a move with motion its distance", () => {
    expect(moveTarget(1, 0.01, c, true, failed)).toBe(F81);
    expect(moveTarget(F241, 0.01, c, true, failed)).toBe(LANDING_HOLD);
    expect(moveTarget(E, -0.01, c, true, failed)).toBe(LANDING_HOLD);
    expect(moveTarget(0.5, 0.25, c, false, failed)).toBeCloseTo(0.75, 12);
  });
});

describe('holdLimit and releaseTarget: the landing hold', () => {
  it('holds the target at the hold, and with reduced motion at the last key stop at or under it', () => {
    expect(holdLimit(LANDING_HOLD, c, false)).toBe(LANDING_HOLD);
    expect(holdLimit(LANDING_HOLD, c, true)).toBe(F241);
    expect(holdLimit(LANDING_HOLD, c, true, stopsFor(c, 'failed'))).toBe(LANDING_HOLD);
    expect(holdLimit(Number.NaN, c, false)).toBe(E);
  });

  it('lets a held target go on once the hold rises: to the next key stop at least, as far as it asked at most', () => {
    expect(releaseTarget(LANDING_HOLD, L + 6.66, E, c)).toBe(L + 6.66);
    expect(releaseTarget(LANDING_HOLD, LANDING_HOLD + 0.1, E, c)).toBe(W);
    expect(releaseTarget(LANDING_HOLD, E, L + 3.66, c)).toBe(L + 3.66);
  });
});

describe('changedChapter', () => {
  it('gives nothing while progress stays in the chapter it was in', () => {
    expect(changedChapter(c, 0.5, 0, false)).toBeNull();
    expect(changedChapter(c, 2.5, 1, true)).toBeNull();
  });

  it('gives the new chapter, with its category, when progress has crossed into one', () => {
    expect(changedChapter(c, 1.5, 0, false)).toMatchObject({ index: 1, id: 'LIGHT', category: null });
    expect(changedChapter(c, L + 0.4, 1, false)).toMatchObject({ index: 2, id: 'LAND', category: null });
    expect(changedChapter(c, L + 3.66, 2, false)).toMatchObject({ index: 3, id: 'AREA', category: 'a' });
    expect(changedChapter(c, S + 0.4, 6, false)).toMatchObject({ index: 7, id: 'QA', category: null, project: 0 });
  });

  it('holds the chapter within the hysteresis of its edge while the story moves', () => {
    expect(changedChapter(c, L, 1, false)).toBeNull();
    expect(changedChapter(c, L + 0.019, 1, false)).toBeNull();
    expect(changedChapter(c, L + 0.03, 1, false)).toMatchObject({ index: 2, id: 'LAND' });
    expect(changedChapter(c, L - 0.01, 2, false)).toBeNull();
  });

  it('reads a story at rest without the hysteresis: a stop on a boundary belongs to the chapter that starts there', () => {
    expect(changedChapter(c, L, 1, true)).toMatchObject({ index: 2, id: 'LAND', category: null });
    expect(changedChapter(c, 1, 0, true)).toMatchObject({ index: 1, id: 'LIGHT' });
    expect(changedChapter(c, S, 6, true)).toMatchObject({ index: 7, id: 'QA', category: null, project: 0 });
    expect(changedChapter(c, E, 13, true)).toMatchObject({ index: 14, id: 'END', category: null });
    expect(changedChapter(c, L - 0.005, 2, true)).toMatchObject({ index: 1, id: 'LIGHT' });
  });
});

describe('pinnedAtEnd', () => {
  it('is true when a delta up leaves the target at the start, or a delta down at the end or the hold', () => {
    expect(pinnedAtEnd(0, -0.04, c)).toBe(true);
    expect(pinnedAtEnd(E, 0.04, c)).toBe(true);
    expect(pinnedAtEnd(LANDING_HOLD, 0.04, c, LANDING_HOLD)).toBe(true);
  });

  it('is false anywhere else, and for a delta away from the end it stands at', () => {
    expect(pinnedAtEnd(0.2, -0.04, c)).toBe(false);
    expect(pinnedAtEnd(S, 0.04, c)).toBe(false);
    expect(pinnedAtEnd(0, 0.04, c)).toBe(false);
    expect(pinnedAtEnd(E, -0.04, c)).toBe(false);
    expect(pinnedAtEnd(0, 0, c)).toBe(false);
  });
});

describe('jumpTarget', () => {
  it('goes to the start or the end of the scroll: End is the credits', () => {
    expect(jumpTarget('home', c)).toBe(0);
    expect(jumpTarget('end', c)).toBe(E);
  });
});

describe('scrollEnabled', () => {
  const phase = (kind: Phase['kind']): Phase => ({ kind }) as Phase;

  it('is on for the phases the scroll moves through, with 3D on', () => {
    for (const kind of ['HOME_IDLE', 'LIGHT', 'END'] as const) expect(scrollEnabled({ threeD: true, phase: phase(kind) })).toBe(true);
    expect(scrollEnabled({ threeD: true, phase: { kind: 'PROJECTS', category: null } })).toBe(true);
  });

  it('is off while 3D is off, and for every other phase', () => {
    expect(scrollEnabled({ threeD: false, phase: phase('HOME_IDLE') })).toBe(false);
    expect(scrollEnabled({ threeD: true, phase: phase('LOADING') })).toBe(false);
    expect(scrollEnabled({ threeD: true, phase: { kind: 'PROJECT_FOCUS', id: 'steady' } })).toBe(false);
  });
});

// The Q&A on the gold ring (spec 2026-10-29-bob-stack-2-design.md, goal 1): from the look back's stop on, every input is
// a step, whatever its size; up from the look back the scroll is continuous again. Round 10 (Bob, 2026-10-30: "more
// simple to just go through it"): the steps are the list (mark 0) and the end; a question is opened from the list.
describe('the Q&A, the list and the end a step each', () => {
  const look = lookStop(c);
  const q = (k: number) => qaStop(c, k);

  it('steps one stop per input in the Q&A, whatever its size', () => {
    expect(qaStepTarget(look, 1, c)).toBe(q(0));
    expect(qaStepTarget(q(0), 1, c)).toBe(scrollEnd(c));
    // From a question opened in the list: on to the end, or back to the list's stop.
    expect(qaStepTarget(q(3), 1, c)).toBe(scrollEnd(c));
    expect(qaStepTarget(q(3), -1, c)).toBe(q(0));
    expect(qaStepTarget(scrollEnd(c), -1, c)).toBe(q(0));
    expect(qaStepTarget(q(0), -1, c)).toBe(look);
    expect(qaStepTarget(scrollEnd(c), 1, c)).toBe(scrollEnd(c));
    expect(inQa(look, c)).toBe(true);
    expect(inQa(q(4), c)).toBe(true);
  });

  it('goes back to the continuous scroll up from the look back', () => {
    expect(qaStepTarget(look, -1, c)).toBeNull();
    expect(inQa(look - 0.1, c)).toBe(false);
    expect(moveTarget(look, -0.3, c, false)).toBeCloseTo(look - 0.3, 12);
  });

  it('catches a continuous scroll at the look back', () => {
    expect(moveTarget(look - 2, 5, c, false)).toBe(look);
    expect(moveTarget(look - 2, 1, c, false)).toBeCloseTo(look - 1, 12);
  });
});
