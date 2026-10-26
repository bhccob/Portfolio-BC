import { describe, expect, it } from 'vitest';
import {
  changedChapter,
  finishTarget,
  holdLimit,
  jumpTarget,
  keyTarget,
  moveTarget,
  pinnedAtEnd,
  releaseTarget,
  restsAtTop,
  scrollEnabled,
  SHEET_BACK,
  stopsFor
} from '../../../src/input/target';
import { LANDING_HOLD } from '../../../src/scene/bob/landingHold';
import { buildChapters, HOME_CHAPTERS, keyStops, placeOfFrame, riseTop, scrollEnd, sheetStart } from '../../../src/state/chapters';
import type { Phase } from '../../../src/state/machine';

// HOME 0-1, LIGHT 1-4 (the light dive's 300 frames), RING a 4-5, RING b 5-6, SHEET c 6-7, END 7: the scroll ends on 7.
// keyStops(c) = [0, 1, the five facts' places (frames 81, 121, 161, 201, 241), 4, 5, 6, 7].
const c = buildChapters({ categories: ['a', 'b', 'c'] });
const [F81, F121, , , F241] = [81, 121, 161, 201, 241].map(placeOfFrame) as [number, number, number, number, number];

describe('moveTarget', () => {
  describe('with motion', () => {
    it('adds the delta', () => {
      expect(moveTarget(3, 0.5, c, false)).toBeCloseTo(3.5, 12);
      expect(moveTarget(3, -0.5, c, false)).toBeCloseTo(2.5, 12);
    });

    it('stays inside the scroll: 0 to the end page, 7', () => {
      expect(moveTarget(0.2, -1, c, false)).toBe(0);
      expect(moveTarget(4.9, 5, c, false)).toBe(7);
      expect(moveTarget(7, 0.5, c, false)).toBe(7);
      expect(moveTarget(6, 0.5, c, false)).toBeCloseTo(6.5, 12);
    });
  });

  describe('with reduced motion: a step among the key stops', () => {
    it('steps to the next key stop for a delta down, whatever its size: the facts in the light dive, then the projects', () => {
      expect(moveTarget(0, 0.01, c, true)).toBe(1);
      expect(moveTarget(0, 7, c, true)).toBe(1);
      expect(moveTarget(1, 0.5, c, true)).toBe(F81);
      expect(moveTarget(F81, 0.01, c, true)).toBe(F121);
      expect(moveTarget(3.5, 0.01, c, true)).toBe(4);
      expect(moveTarget(4, 1, c, true)).toBe(5);
      expect(moveTarget(6, 0.01, c, true)).toBe(7);
    });

    it('steps to the previous key stop for a delta up', () => {
      expect(moveTarget(7, -0.01, c, true)).toBe(6);
      expect(moveTarget(4, -0.01, c, true)).toBe(F241);
      expect(moveTarget(2, -0.01, c, true)).toBe(F81);
      expect(moveTarget(F81, -3, c, true)).toBe(1);
      expect(moveTarget(1, -1, c, true)).toBe(0);
    });

    it('stays at the ends, does nothing for no delta, and takes a target a hair short of a stop for being on it', () => {
      expect(moveTarget(0, -1, c, true)).toBe(0);
      expect(moveTarget(7, 1, c, true)).toBe(7);
      expect(moveTarget(2.3, 0, c, true)).toBe(2.3);
      expect(moveTarget(F81 - 1e-7, 1, c, true)).toBe(F121);
      expect(moveTarget(4 + 1e-7, -1, c, true)).toBe(F241);
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
    expect(keyTarget(F241, 0.15, c)).toBe(4);
    expect(keyTarget(4, 0.15, c)).toBe(5);
    expect(keyTarget(6, 0.15, c)).toBe(7);
    // A target between stops (a wheel under way, or the ring left between two projects) steps to the next one.
    expect(keyTarget(3.5, 0.15, c)).toBe(4);
    expect(keyTarget(4.6, 0.15, c)).toBe(5);
  });

  it('steps up to the previous key stop past the top of the rise, and back on the rise moves by its distance again', () => {
    expect(keyTarget(7, -0.15, c)).toBe(6);
    expect(keyTarget(4, -0.15, c)).toBe(F241);
    expect(keyTarget(F81, -0.9, c)).toBe(1);
    expect(keyTarget(1, -0.15, c)).toBeCloseTo(0.85, 12);
    expect(keyTarget(0.1, -0.9, c)).toBe(0);
  });

  it('does nothing at the ends, nor for no delta', () => {
    expect(keyTarget(7, 0.15, c)).toBe(7);
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

describe("finishTarget: where the sheet finishes once the scroll stops part-way up it ('Follow, then finish')", () => {
  it('goes on up to the end page if the last move went down, and the sheet is at least SHEET_BACK up', () => {
    expect(SHEET_BACK).toBe(0.03);
    expect(finishTarget(6.2, 1, c)).toBe(7);
    expect(finishTarget(6.031, 1, c)).toBe(7);
    expect(finishTarget(6.99, 1, c)).toBe(7);
  });

  it('goes back down onto Cookies Clicker if the last move went up, or the sheet is barely up', () => {
    expect(finishTarget(6.2, -1, c)).toBe(6);
    expect(finishTarget(6.99, -1, c)).toBe(6);
    expect(finishTarget(6.02, 1, c)).toBe(6);
    expect(finishTarget(6.5, 0, c)).toBe(6);
  });

  it('has nothing to finish off the sheet: at its two ends, in the ring or the light dive', () => {
    expect(finishTarget(sheetStart(c), 1, c)).toBeNull();
    expect(finishTarget(scrollEnd(c), -1, c)).toBeNull();
    expect(finishTarget(5.5, 1, c)).toBeNull();
    expect(finishTarget(2, 1, c)).toBeNull();
  });
});

describe("stopsFor: the stops the story rests on, by the void's state", () => {
  it('is the key stops while the void is there or still to come', () => {
    for (const state of ['idle', 'loading', 'ready'] as const) expect(stopsFor(HOME_CHAPTERS, state), state).toEqual(keyStops(HOME_CHAPTERS));
  });

  it('is the home, BOB from above, the facts, the landing hold and the end page when the void failed: the fall still plays', () => {
    const facts = [81, 121, 161, 201, 241].map(placeOfFrame);
    expect(stopsFor(c, 'failed')).toEqual([0, riseTop(c), ...facts, LANDING_HOLD, scrollEnd(c)]);
    expect(stopsFor(HOME_CHAPTERS, 'failed')).toEqual([0, 1, ...facts, LANDING_HOLD, 7]);
  });
});

describe("a failed void's stops: the keys and reduced motion's steps among them", () => {
  const failed = stopsFor(c, 'failed');

  it('steps a key from BOB from above through the facts to the hold, on to the end page, and back; the rise stays the rise', () => {
    expect(keyTarget(1, 0.15, c, failed)).toBe(F81);
    expect(keyTarget(F241, 0.15, c, failed)).toBe(LANDING_HOLD);
    expect(keyTarget(LANDING_HOLD, 0.15, c, failed)).toBe(7);
    expect(keyTarget(7, -0.15, c, failed)).toBe(LANDING_HOLD);
    expect(keyTarget(LANDING_HOLD, -0.9, c, failed)).toBe(F241);
    expect(keyTarget(F81, -0.9, c, failed)).toBe(1);
    expect(keyTarget(0, 0.15, c, failed)).toBeCloseTo(0.15, 12);
    expect(keyTarget(1, -0.15, c, failed)).toBeCloseTo(0.85, 12);
  });

  it("steps reduced motion's move the same way, and leaves a move with motion its distance", () => {
    expect(moveTarget(1, 0.01, c, true, failed)).toBe(F81);
    expect(moveTarget(F241, 0.01, c, true, failed)).toBe(LANDING_HOLD);
    expect(moveTarget(7, -0.01, c, true, failed)).toBe(LANDING_HOLD);
    expect(moveTarget(0.5, 0.25, c, false, failed)).toBeCloseTo(0.75, 12);
  });
});

describe('holdLimit and releaseTarget: the landing hold', () => {
  it('holds the target at the hold, and with reduced motion at the last key stop at or under it', () => {
    expect(holdLimit(LANDING_HOLD, c, false)).toBe(LANDING_HOLD);
    expect(holdLimit(LANDING_HOLD, c, true)).toBe(F241);
    expect(holdLimit(LANDING_HOLD, c, true, stopsFor(c, 'failed'))).toBe(LANDING_HOLD);
    expect(holdLimit(Number.NaN, c, false)).toBe(7);
  });

  it('lets a held target go on once the hold rises: to the next key stop at least, as far as it asked at most', () => {
    expect(releaseTarget(LANDING_HOLD, 5, 7, c)).toBe(5);
    expect(releaseTarget(LANDING_HOLD, LANDING_HOLD + 0.1, 7, c)).toBe(4);
    expect(releaseTarget(LANDING_HOLD, 7, 4.5, c)).toBe(4.5);
  });
});

describe('changedChapter', () => {
  it('gives nothing while progress stays in the chapter it was in', () => {
    expect(changedChapter(c, 0.5, 0, false)).toBeNull();
    expect(changedChapter(c, 2.5, 1, true)).toBeNull();
  });

  it('gives the new chapter, with its category, when progress has crossed into one', () => {
    expect(changedChapter(c, 1.5, 0, false)).toMatchObject({ index: 1, id: 'LIGHT', category: null });
    expect(changedChapter(c, 4.4, 1, false)).toMatchObject({ index: 2, id: 'RING', category: 'a' });
    expect(changedChapter(c, 6.4, 3, false)).toMatchObject({ index: 4, id: 'SHEET', category: 'c' });
  });

  it('holds the chapter within the hysteresis of its edge while the story moves', () => {
    expect(changedChapter(c, 4, 1, false)).toBeNull();
    expect(changedChapter(c, 4.019, 1, false)).toBeNull();
    expect(changedChapter(c, 4.03, 1, false)).toMatchObject({ index: 2, id: 'RING' });
    expect(changedChapter(c, 3.99, 2, false)).toBeNull();
  });

  it('reads a story at rest without the hysteresis: a stop on a boundary belongs to the chapter that starts there', () => {
    expect(changedChapter(c, 4, 1, true)).toMatchObject({ index: 2, id: 'RING', category: 'a' });
    expect(changedChapter(c, 1, 0, true)).toMatchObject({ index: 1, id: 'LIGHT' });
    expect(changedChapter(c, 6, 3, true)).toMatchObject({ index: 4, id: 'SHEET', category: 'c' });
    expect(changedChapter(c, 7, 4, true)).toMatchObject({ index: 5, id: 'END', category: null });
    expect(changedChapter(c, 3.995, 2, true)).toMatchObject({ index: 1, id: 'LIGHT' });
  });
});

describe('pinnedAtEnd', () => {
  it('is true when a delta up leaves the target at the start, or a delta down at the end or the hold', () => {
    expect(pinnedAtEnd(0, -0.04, c)).toBe(true);
    expect(pinnedAtEnd(7, 0.04, c)).toBe(true);
    expect(pinnedAtEnd(LANDING_HOLD, 0.04, c, LANDING_HOLD)).toBe(true);
  });

  it('is false anywhere else, and for a delta away from the end it stands at', () => {
    expect(pinnedAtEnd(0.2, -0.04, c)).toBe(false);
    expect(pinnedAtEnd(6, 0.04, c)).toBe(false);
    expect(pinnedAtEnd(0, 0.04, c)).toBe(false);
    expect(pinnedAtEnd(7, -0.04, c)).toBe(false);
    expect(pinnedAtEnd(0, 0, c)).toBe(false);
  });
});

describe('jumpTarget', () => {
  it('goes to the start or the end of the scroll: End is the end page, 7', () => {
    expect(jumpTarget('home', c)).toBe(0);
    expect(jumpTarget('end', c)).toBe(7);
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
    expect(scrollEnabled({ threeD: true, phase: { kind: 'PROJECT_FOCUS', id: 'funcial' } })).toBe(false);
  });
});
