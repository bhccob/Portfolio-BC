import { describe, expect, it } from 'vitest';
import { changedChapter, jumpTarget, moveTarget, scrollEnabled } from '../../../src/input/target';
import { buildChapters } from '../../../src/state/chapters';
import type { Phase } from '../../../src/state/machine';

// stops(c) = [0, 1, 12, 14, 15, 16, 17, 18]
const c = buildChapters({ parts: 11, categories: ['a', 'b', 'c'] });

describe('moveTarget', () => {
  describe('with motion', () => {
    it('adds the delta', () => {
      expect(moveTarget(3, 0.5, c, false)).toBeCloseTo(3.5, 12);
      expect(moveTarget(3, -0.5, c, false)).toBeCloseTo(2.5, 12);
    });

    it('stays inside the scroll: 0 to the total', () => {
      expect(moveTarget(0.2, -1, c, false)).toBe(0);
      expect(moveTarget(17.9, 5, c, false)).toBe(18);
    });
  });

  describe('with reduced motion', () => {
    it('snaps to the next stop for a delta down, whatever its size', () => {
      expect(moveTarget(0, 0.01, c, true)).toBe(1);
      expect(moveTarget(0, 7, c, true)).toBe(1);
      expect(moveTarget(1, 0.5, c, true)).toBe(12);
      expect(moveTarget(5.3, 0.01, c, true)).toBe(12);
      expect(moveTarget(17, 1, c, true)).toBe(18);
    });

    it('snaps to the previous stop for a delta up', () => {
      expect(moveTarget(18, -0.01, c, true)).toBe(17);
      expect(moveTarget(12, -3, c, true)).toBe(1);
      expect(moveTarget(5.3, -0.01, c, true)).toBe(1);
      expect(moveTarget(1, -1, c, true)).toBe(0);
    });

    it('stays at the ends', () => {
      expect(moveTarget(0, -1, c, true)).toBe(0);
      expect(moveTarget(18, 1, c, true)).toBe(18);
    });

    it('does nothing for no delta', () => {
      expect(moveTarget(5.3, 0, c, true)).toBe(5.3);
    });

    it('takes a target a hair short of a stop for being on it', () => {
      expect(moveTarget(11.9999999, 1, c, true)).toBe(14);
      expect(moveTarget(12.0000001, -1, c, true)).toBe(1);
    });
  });
});

describe('changedChapter', () => {
  it('gives nothing while progress stays in the chapter it was in', () => {
    expect(changedChapter(c, 0.5, 0, false)).toBeNull();
    expect(changedChapter(c, 5, 1, true)).toBeNull();
  });

  it('gives the new chapter, with its category, when progress has crossed into one', () => {
    expect(changedChapter(c, 1.5, 0, false)).toMatchObject({ index: 1, id: 'DISSECT', category: null });
    expect(changedChapter(c, 16.4, 4, false)).toMatchObject({ index: 5, id: 'PROJECTS', category: 'b' });
  });

  it('holds the chapter within the hysteresis of its edge while the story moves', () => {
    expect(changedChapter(c, 12, 1, false)).toBeNull(); // just reached MORPH from below: still DISSECT
    expect(changedChapter(c, 12.019, 1, false)).toBeNull();
    expect(changedChapter(c, 12.03, 1, false)).toMatchObject({ index: 2, id: 'MORPH' });
    expect(changedChapter(c, 11.99, 2, false)).toBeNull(); // and back the other way
  });

  it('reads a story at rest without the hysteresis: a stop on a boundary belongs to the chapter that starts there', () => {
    expect(changedChapter(c, 12, 1, true)).toMatchObject({ index: 2, id: 'MORPH' });
    expect(changedChapter(c, 1, 0, true)).toMatchObject({ index: 1, id: 'DISSECT' });
    expect(changedChapter(c, 18, 5, true)).toMatchObject({ index: 6, id: 'PROJECTS', category: 'c' });
  });

  it('reads a story at rest just short of a boundary as the chapter it is in', () => {
    expect(changedChapter(c, 11.995, 2, true)).toMatchObject({ index: 1, id: 'DISSECT' });
    expect(changedChapter(c, 11.995, 1, true)).toBeNull();
  });
});

describe('jumpTarget', () => {
  it('goes to the start or the end of the scroll', () => {
    expect(jumpTarget('home', c)).toBe(0);
    expect(jumpTarget('end', c)).toBe(18);
  });
});

describe('scrollEnabled', () => {
  const phase = (kind: Phase['kind']): Phase => ({ kind }) as Phase;

  it('is on for the phases the scroll moves through, with 3D on', () => {
    for (const kind of ['HOME_IDLE', 'DISSECT', 'MORPH', 'VOID_ENTRY'] as const) {
      expect(scrollEnabled({ threeD: true, phase: phase(kind) })).toBe(true);
    }
    expect(scrollEnabled({ threeD: true, phase: { kind: 'PROJECTS', category: null } })).toBe(true);
  });

  it('is off while 3D is off', () => {
    expect(scrollEnabled({ threeD: false, phase: phase('HOME_IDLE') })).toBe(false);
  });

  it('is off for every other phase', () => {
    expect(scrollEnabled({ threeD: true, phase: phase('LOADING') })).toBe(false);
    expect(scrollEnabled({ threeD: true, phase: { kind: 'FOCUS_COUNTRY', dir: 'china' } })).toBe(false);
    expect(scrollEnabled({ threeD: true, phase: { kind: 'COUNTRY_PAGE', dir: 'china' } })).toBe(false);
    expect(scrollEnabled({ threeD: true, phase: { kind: 'PROJECT_FOCUS', id: 'funcial' } })).toBe(false);
  });
});
