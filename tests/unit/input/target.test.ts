import { describe, expect, it } from 'vitest';
import { changedChapter, jumpTarget, keyTarget, moveTarget, pinnedAtEnd, SETTLE_SLOP_PX, scrollEnabled, settleTarget } from '../../../src/input/target';
import { LINE_PX } from '../../../src/input/normalizeWheel';
import { buildChapters } from '../../../src/state/chapters';
import type { Phase } from '../../../src/state/machine';

// stops(c) = [0, 1, 2, 3, 4, 5]: HOME, DIVE, VOID_ENTRY, then the three projects, a, b and c; the scroll ends on c's stop, 5
const c = buildChapters({ categories: ['a', 'b', 'c'] });

describe('moveTarget', () => {
  describe('with motion', () => {
    it('adds the delta', () => {
      expect(moveTarget(3, 0.5, c, false)).toBeCloseTo(3.5, 12);
      expect(moveTarget(3, -0.5, c, false)).toBeCloseTo(2.5, 12);
    });

    it("stays inside the scroll: 0 to the last stop, the last unit's start, never into the unit that holds it", () => {
      expect(moveTarget(0.2, -1, c, false)).toBe(0);
      expect(moveTarget(4.9, 5, c, false)).toBe(5);
      expect(moveTarget(5, 0.5, c, false)).toBe(5);
    });
  });

  describe('with reduced motion', () => {
    it('snaps to the next stop for a delta down, whatever its size', () => {
      expect(moveTarget(0, 0.01, c, true)).toBe(1);
      expect(moveTarget(0, 7, c, true)).toBe(1);
      expect(moveTarget(1, 0.5, c, true)).toBe(2);
      expect(moveTarget(2.3, 0.01, c, true)).toBe(3);
      expect(moveTarget(4, 1, c, true)).toBe(5);
    });

    it('snaps to the previous stop for a delta up', () => {
      expect(moveTarget(5, -0.01, c, true)).toBe(4);
      expect(moveTarget(3, -3, c, true)).toBe(2);
      expect(moveTarget(2.3, -0.01, c, true)).toBe(2);
      expect(moveTarget(1.5, -0.01, c, true)).toBe(1);
      expect(moveTarget(1, -1, c, true)).toBe(0);
    });

    it('stays at the ends: a step down from the last stop is no step', () => {
      expect(moveTarget(0, -1, c, true)).toBe(0);
      expect(moveTarget(5, 1, c, true)).toBe(5);
    });

    it('does nothing for no delta', () => {
      expect(moveTarget(2.3, 0, c, true)).toBe(2.3);
    });

    it('takes a target a hair short of a stop for being on it', () => {
      expect(moveTarget(1.9999999, 1, c, true)).toBe(3);
      expect(moveTarget(2.0000001, -1, c, true)).toBe(1);
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

  it('steps from the top of the rise on to the next stop down, whatever its distance', () => {
    expect(keyTarget(1, 0.15, c)).toBe(2);
    expect(keyTarget(2, 0.15, c)).toBe(3);
    expect(keyTarget(3, 0.9, c)).toBe(4);
    expect(keyTarget(4, 0.15, c)).toBe(5);
    // A target between stops (a wheel's gesture under way) steps to the next one.
    expect(keyTarget(3.4, 0.15, c)).toBe(4);
  });

  it('steps up to the previous stop past the top of the rise, and back on the rise moves by its distance again', () => {
    expect(keyTarget(5, -0.15, c)).toBe(4);
    expect(keyTarget(3, -0.9, c)).toBe(2);
    expect(keyTarget(2, -0.15, c)).toBe(1);
    expect(keyTarget(1.475, -0.9, c)).toBe(1);
    expect(keyTarget(1, -0.15, c)).toBeCloseTo(0.85, 12);
    expect(keyTarget(0.1, -0.9, c)).toBe(0);
  });

  it('does nothing at the ends, nor for no delta', () => {
    expect(keyTarget(5, 0.15, c)).toBe(5);
    expect(keyTarget(0, -0.15, c)).toBe(0);
    expect(keyTarget(3, 0, c)).toBe(3);
  });

  it('takes a target a hair short of a stop for being on it', () => {
    expect(keyTarget(2.9999999, 0.15, c)).toBe(4);
    expect(keyTarget(1 - 1e-7, 0.15, c)).toBe(2);
  });
});

describe('settleTarget: where a wheel or touch gesture comes to rest past the rise', () => {
  const slop = 0.04;

  it('goes on to the next stop in the direction of travel', () => {
    expect(settleTarget(3, 3.133, c, slop)).toBe(4);
    expect(settleTarget(3, 2.867, c, slop)).toBe(2);
    expect(settleTarget(4, 4.9, c, slop)).toBe(5);
    expect(settleTarget(2, 1.1, c, slop)).toBe(1);
  });

  it('goes back to the stop it started from when it left it by no more than the slop', () => {
    expect(settleTarget(3, 3.03, c, slop)).toBe(3);
    expect(settleTarget(3, 2.97, c, slop)).toBe(3);
    expect(settleTarget(3, 3.039, c, slop)).toBe(3);
    expect(settleTarget(3, 3.05, c, slop)).toBe(4);
  });

  it('passes as many stops as the gesture did, resting on one that it passed by no more than the slop', () => {
    expect(settleTarget(1, 3.4, c, slop)).toBe(4);
    expect(settleTarget(5, 2.6, c, slop)).toBe(2);
    expect(settleTarget(2, 4.02, c, slop)).toBe(4);
    expect(settleTarget(5, 2.98, c, slop)).toBe(3);
  });

  it('leaves a gesture that ends on the rise where it is: nothing settles there', () => {
    expect(settleTarget(1, 0.6, c, slop)).toBe(0.6);
    expect(settleTarget(0.2, 0.9, c, slop)).toBe(0.9);
    expect(settleTarget(3, 0.4, c, slop)).toBe(0.4);
    expect(settleTarget(0.5, 0, c, slop)).toBe(0);
  });

  it('rests one that comes up out of the rise on its top, BOB from above, unless it carried more than a whole unit past it', () => {
    expect(settleTarget(0.5, 1.02, c, slop)).toBe(1);
    expect(settleTarget(0.5, 1.3, c, slop)).toBe(1);
    expect(settleTarget(0, (8 * 120) / 900, c, 40 / 900)).toBe(1); // the 8th notch at 900 px, 1.067
    expect(settleTarget(0.9, 1.99, c, slop)).toBe(1);
    expect(settleTarget(0, 2, c, slop)).toBe(1); // a whole unit past it, and no more
    // More than a whole unit past it is a fling: it settles by the direction rule.
    expect(settleTarget(0, 2.02, c, slop)).toBe(2);
    expect(settleTarget(0, 2.6, c, slop)).toBe(3);
    expect(settleTarget(0.2, 4.4, c, slop)).toBe(5);
  });

  it('moves a gesture from BOB from above on to the overview, and one from the void into the dive by the direction rule', () => {
    expect(settleTarget(1, 1.133, c, slop)).toBe(2);
    expect(settleTarget(1, 1.02, c, slop)).toBe(1); // within the slop
    expect(settleTarget(2, 1.02, c, slop)).toBe(1);
    expect(settleTarget(3, 1.9, c, slop)).toBe(1);
    expect(settleTarget(2, 1.97, c, slop)).toBe(2);
  });

  it('ends on the last stop, 5, and never past it', () => {
    expect(settleTarget(4, 5, c, slop)).toBe(5);
    expect(settleTarget(4, 9, c, slop)).toBe(5);
    expect(settleTarget(5, 4.97, c, slop)).toBe(5);
    expect(settleTarget(5, 4.9, c, slop)).toBe(4);
  });

  it('keeps a gesture that ended on a stop there', () => {
    for (const stop of [1, 2, 3, 4, 5]) {
      expect(settleTarget(stop - 0.5, stop, c, slop)).toBe(stop);
      expect(settleTarget(stop + 0.5, stop, c, slop)).toBe(stop);
    }
    expect(settleTarget(3, 4 - 1e-7, c, slop)).toBe(4);
  });

  it('takes the nearer stop for a gesture that went nowhere off a stop', () => {
    expect(settleTarget(3.3, 3.3, c, slop)).toBe(3);
    expect(settleTarget(3.7, 3.7, c, slop)).toBe(4);
  });

  it('has a slop smaller than any one notch of a wheel, so a single notch moves one stop', () => {
    // Firefox's notch is three lines; Chromium's and Safari's are 100 to 120 px.
    expect(SETTLE_SLOP_PX).toBe(40);
    expect(3 * LINE_PX).toBeGreaterThan(SETTLE_SLOP_PX);
    for (const height of [657, 900, 1440]) {
      const notch = (3 * LINE_PX) / height;
      expect(settleTarget(3, 3 + notch, c, SETTLE_SLOP_PX / height), `${height}`).toBe(4);
      expect(settleTarget(3, 3 - notch, c, SETTLE_SLOP_PX / height), `${height}`).toBe(2);
    }
  });
});

describe('changedChapter', () => {
  it('gives nothing while progress stays in the chapter it was in', () => {
    expect(changedChapter(c, 0.5, 0, false)).toBeNull();
    expect(changedChapter(c, 1.5, 1, true)).toBeNull();
  });

  it('gives the new chapter, with its category, when progress has crossed into one', () => {
    expect(changedChapter(c, 1.5, 0, false)).toMatchObject({ index: 1, id: 'DIVE', category: null });
    expect(changedChapter(c, 4.4, 3, false)).toMatchObject({ index: 4, id: 'PROJECTS', category: 'b' });
  });

  it('holds the chapter within the hysteresis of its edge while the story moves', () => {
    expect(changedChapter(c, 2, 1, false)).toBeNull(); // just reached VOID_ENTRY from below: still DIVE
    expect(changedChapter(c, 2.019, 1, false)).toBeNull();
    expect(changedChapter(c, 2.03, 1, false)).toMatchObject({ index: 2, id: 'VOID_ENTRY' });
    expect(changedChapter(c, 1.99, 2, false)).toBeNull(); // and back the other way
  });

  it('reads a story at rest without the hysteresis: a stop on a boundary belongs to the chapter that starts there', () => {
    expect(changedChapter(c, 2, 1, true)).toMatchObject({ index: 2, id: 'VOID_ENTRY' });
    expect(changedChapter(c, 1, 0, true)).toMatchObject({ index: 1, id: 'DIVE' });
    expect(changedChapter(c, 5, 4, true)).toMatchObject({ index: 5, id: 'PROJECTS', category: 'c' });
  });

  it('reads a story at rest just short of a boundary as the chapter it is in', () => {
    expect(changedChapter(c, 1.995, 2, true)).toMatchObject({ index: 1, id: 'DIVE' });
    expect(changedChapter(c, 1.995, 1, true)).toBeNull();
  });
});

describe('pinnedAtEnd', () => {
  it('is true when a delta up leaves the target at the start, or a delta down at the end', () => {
    expect(pinnedAtEnd(0, -0.04, c)).toBe(true);
    expect(pinnedAtEnd(5, 0.04, c)).toBe(true);
  });

  it('is false anywhere else, and for a delta away from the end it stands at', () => {
    expect(pinnedAtEnd(0.2, -0.04, c)).toBe(false);
    expect(pinnedAtEnd(4.9, 0.04, c)).toBe(false);
    expect(pinnedAtEnd(0, 0.04, c)).toBe(false);
    expect(pinnedAtEnd(5, -0.04, c)).toBe(false);
    expect(pinnedAtEnd(0, 0, c)).toBe(false);
  });
});

describe('jumpTarget', () => {
  it('goes to the start or the end of the scroll: End is the last stop, 5', () => {
    expect(jumpTarget('home', c)).toBe(0);
    expect(jumpTarget('end', c)).toBe(5);
  });
});

describe('scrollEnabled', () => {
  const phase = (kind: Phase['kind']): Phase => ({ kind }) as Phase;

  it('is on for the phases the scroll moves through, with 3D on', () => {
    for (const kind of ['HOME_IDLE', 'DIVE', 'VOID_ENTRY'] as const) {
      expect(scrollEnabled({ threeD: true, phase: phase(kind) })).toBe(true);
    }
    expect(scrollEnabled({ threeD: true, phase: { kind: 'PROJECTS', category: null } })).toBe(true);
  });

  it('is off while 3D is off', () => {
    expect(scrollEnabled({ threeD: false, phase: phase('HOME_IDLE') })).toBe(false);
  });

  it('is off for every other phase', () => {
    expect(scrollEnabled({ threeD: true, phase: phase('LOADING') })).toBe(false);
    expect(scrollEnabled({ threeD: true, phase: { kind: 'PROJECT_FOCUS', id: 'funcial' } })).toBe(false);
  });
});
