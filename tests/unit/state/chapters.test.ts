import { describe, expect, it } from 'vitest';
import { PART_IDS } from '../../../src/data/parts';
import { buildChapters, chapterAt, HOME_CHAPTERS, HYSTERESIS, stops } from '../../../src/state/chapters';

const c = buildChapters({ parts: 11, categories: ['a', 'b', 'c'] });

describe('buildChapters', () => {
  it('lays out HOME 1, DISSECT parts, MORPH 2, VOID_ENTRY 1 and one unit per category', () => {
    expect(c.total).toBe(18);
    expect(c.units.map((u) => [u.id, u.start, u.length, u.category])).toEqual([
      ['HOME', 0, 1, null],
      ['DISSECT', 1, 11, null],
      ['MORPH', 12, 2, null],
      ['VOID_ENTRY', 14, 1, null],
      ['PROJECTS', 15, 1, 'a'],
      ['PROJECTS', 16, 1, 'b'],
      ['PROJECTS', 17, 1, 'c'],
    ]);
  });

  it('follows the number of parts and categories it is given', () => {
    expect(buildChapters({ parts: 4, categories: ['x'] }).total).toBe(1 + 4 + 2 + 1 + 1);
  });

  it('has no project units without categories', () => {
    expect(buildChapters({ parts: 11, categories: [] }).units.map((u) => u.id)).toEqual(['HOME', 'DISSECT', 'MORPH', 'VOID_ENTRY']);
  });
});

describe('chapterAt', () => {
  it('starts on HOME', () => {
    expect(chapterAt(c, 0)).toEqual({ index: 0, id: 'HOME', local: 0, category: null });
  });

  it('puts a position in a unit and says how far into it', () => {
    const at = chapterAt(c, 1.5);
    expect(at.id).toBe('DISSECT');
    expect(at.index).toBe(1);
    expect(at.local).toBeCloseTo(0.5 / 11, 10);
  });

  it('names the category of a projects unit', () => {
    expect(chapterAt(c, 16.2).category).toBe('b');
    expect(chapterAt(c, 16.2).id).toBe('PROJECTS');
  });

  it('starts a unit exactly on its start', () => {
    expect(chapterAt(c, 12).id).toBe('MORPH');
    expect(chapterAt(c, 15).category).toBe('a');
  });

  it('clamps below zero to HOME and above the total to the last unit', () => {
    expect(chapterAt(c, -3).id).toBe('HOME');
    expect(chapterAt(c, -3).local).toBe(0);
    const end = chapterAt(c, 99);
    expect(end.index).toBe(6);
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
    expect(chapterAt(c, 13, { index: 0 }).id).toBe('MORPH');
  });
});

describe('stops', () => {
  it('lists each unit start, then the total', () => {
    expect(stops(c)).toEqual([0, 1, 12, 14, 15, 16, 17, 18]);
  });
});

describe('HOME_CHAPTERS', () => {
  it('is the home scroll: the eleven parts and the three project categories', () => {
    expect(PART_IDS).toHaveLength(11);
    expect(HOME_CHAPTERS.total).toBe(18);
    expect(HOME_CHAPTERS.units.filter((u) => u.id === 'PROJECTS').map((u) => u.category)).toEqual(['secure-element', 'front-panel', 'oscillator']);
  });
});
