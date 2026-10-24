import { describe, expect, it } from 'vitest';
import { buildChapters, chapterAt, HOME_CHAPTERS, HYSTERESIS, riseTop, scrollEnd, stops } from '../../../src/state/chapters';

const c = buildChapters({ categories: ['a', 'b', 'c'] });

describe('buildChapters', () => {
  it('lays out HOME 1, DIVE 1, VOID_ENTRY 1 and one unit per category', () => {
    expect(c.total).toBe(6);
    expect(c.units.map((u) => [u.id, u.start, u.length, u.category])).toEqual([
      ['HOME', 0, 1, null],
      ['DIVE', 1, 1, null],
      ['VOID_ENTRY', 2, 1, null],
      ['PROJECTS', 3, 1, 'a'],
      ['PROJECTS', 4, 1, 'b'],
      ['PROJECTS', 5, 1, 'c'],
    ]);
  });

  it('follows the number of categories it is given', () => {
    expect(buildChapters({ categories: ['x'] }).total).toBe(1 + 1 + 1 + 1);
    expect(buildChapters({ categories: ['x', 'y', 'z', 'w'] }).total).toBe(3 + 4);
  });

  it('has no project units without categories', () => {
    expect(buildChapters({ categories: [] }).units.map((u) => u.id)).toEqual(['HOME', 'DIVE', 'VOID_ENTRY']);
  });
});

describe('chapterAt', () => {
  it('starts on HOME', () => {
    expect(chapterAt(c, 0)).toEqual({ index: 0, id: 'HOME', local: 0, category: null });
  });

  it('puts a position in a unit and says how far into it', () => {
    const at = chapterAt(c, 1.5);
    expect(at.id).toBe('DIVE');
    expect(at.index).toBe(1);
    expect(at.local).toBeCloseTo(0.5, 10);
  });

  it('names the category of a projects unit', () => {
    expect(chapterAt(c, 4.2).category).toBe('b');
    expect(chapterAt(c, 4.2).id).toBe('PROJECTS');
  });

  it('starts a unit exactly on its start', () => {
    expect(chapterAt(c, 1).id).toBe('DIVE');
    expect(chapterAt(c, 2).id).toBe('VOID_ENTRY');
    expect(chapterAt(c, 3).category).toBe('a');
  });

  it('clamps below zero to HOME and above the total to the last unit', () => {
    expect(chapterAt(c, -3).id).toBe('HOME');
    expect(chapterAt(c, -3).local).toBe(0);
    const end = chapterAt(c, 99);
    expect(end.index).toBe(5);
    expect(end.id).toBe('PROJECTS');
    expect(end.category).toBe('c');
    expect(end.local).toBe(1);
  });

  it('keeps the previous unit while the position is within the hysteresis outside it', () => {
    expect(HYSTERESIS).toBe(0.02);
    const previous = { index: 0 };
    expect(chapterAt(c, 1.01, previous).index).toBe(0);
    expect(chapterAt(c, 1.03, previous).index).toBe(1);
  });

  it('keeps it on the way back down as well', () => {
    expect(chapterAt(c, 0.99, { index: 1 }).index).toBe(1);
    expect(chapterAt(c, 0.97, { index: 1 }).index).toBe(0);
  });

  it('keeps the local position of a held unit inside zero to one', () => {
    expect(chapterAt(c, 1.01, { index: 0 }).local).toBe(1);
    expect(chapterAt(c, 0.99, { index: 1 }).local).toBe(0);
  });

  it('ignores a previous index that is not a unit', () => {
    expect(chapterAt(c, 1.5, { index: 40 }).index).toBe(1);
    expect(chapterAt(c, 1.5, { index: -1 }).index).toBe(1);
  });

  it('does not hold a unit that is not next to the position', () => {
    expect(chapterAt(c, 3, { index: 0 }).id).toBe('PROJECTS');
    expect(chapterAt(c, 2, { index: 0 }).id).toBe('VOID_ENTRY');
  });
});

describe('stops', () => {
  it('lists each unit start: the last unit is its own stop and the end of the scroll, so nothing lies past it', () => {
    expect(stops(c)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(stops(buildChapters({ categories: ['x'] }))).toEqual([0, 1, 2, 3]);
  });
});

describe('scrollEnd and riseTop', () => {
  it('ends the scroll on the last stop, the start of the last unit, short of the total', () => {
    expect(scrollEnd(c)).toBe(5);
    expect(scrollEnd(c)).toBe(stops(c).at(-1));
    expect(scrollEnd(c)).toBeLessThan(c.total);
    expect(scrollEnd(buildChapters({ categories: ['x', 'y', 'z', 'w'] }))).toBe(6);
  });

  it('puts the top of the rise at the end of the first unit, which is a stop', () => {
    expect(riseTop(c)).toBe(1);
    expect(stops(c)).toContain(riseTop(c));
  });
});

describe('HOME_CHAPTERS', () => {
  it('is the home scroll in BOB’s stretches: the rise, the dive, the overview and one unit per project category', () => {
    expect(HOME_CHAPTERS.total).toBe(6);
    expect(HOME_CHAPTERS.units.map((u) => [u.id, u.start, u.length])).toEqual([
      ['HOME', 0, 1],
      ['DIVE', 1, 1],
      ['VOID_ENTRY', 2, 1],
      ['PROJECTS', 3, 1],
      ['PROJECTS', 4, 1],
      ['PROJECTS', 5, 1],
    ]);
    expect(HOME_CHAPTERS.units.filter((u) => u.id === 'PROJECTS').map((u) => u.category)).toEqual(['secure-element', 'front-panel', 'oscillator']);
  });

  it('has six stops, 0 to 5, and ends on the last, Cookies Clicker: the keyboard, the swipe and the reduced-motion steps all go by these', () => {
    // Spec §2.3: "That makes six stops in all". The last unit holds Cookies Clicker, so a stop at its end (6) would be a
    // whole unit of scroll that changes nothing.
    expect(stops(HOME_CHAPTERS)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(scrollEnd(HOME_CHAPTERS)).toBe(5);
    expect(HOME_CHAPTERS.units.at(-1)).toMatchObject({ start: 5, category: 'oscillator' });
  });

  it('puts a position in the right project: 3.5 in the first, 5.9 in the last', () => {
    expect(chapterAt(HOME_CHAPTERS, 3.5)).toMatchObject({ id: 'PROJECTS', category: 'secure-element' });
    expect(chapterAt(HOME_CHAPTERS, 5.9).category).toBe('oscillator');
    expect(chapterAt(HOME_CHAPTERS, 1.5).id).toBe('DIVE');
    expect(chapterAt(HOME_CHAPTERS, 2.5).id).toBe('VOID_ENTRY');
  });
});
