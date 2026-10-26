import { describe, expect, it } from 'vitest';
import {
  buildChapters,
  chapterAt,
  FACT_PEAKS,
  HOME_CHAPTERS,
  HYSTERESIS,
  keyStops,
  LIGHT_UNITS,
  lightStart,
  placeOfFrame,
  projectStop,
  ringStart,
  riseTop,
  scrollEnd,
  sheetStart,
  stops,
} from '../../../src/state/chapters';

const c = buildChapters({ categories: ['a', 'b', 'c'] });

describe('buildChapters', () => {
  it('lays out the rise, the light dive, the ring, the sheet and the end (spec 2026-10-25, the light dive)', () => {
    expect(LIGHT_UNITS).toBe(3);
    expect(c.total).toBe(8);
    expect(c.units.map((u) => [u.id, u.start, u.length, u.category])).toEqual([
      ['HOME', 0, 1, null],
      ['LIGHT', 1, 3, null],
      ['RING', 4, 1, 'a'],
      ['RING', 5, 1, 'b'],
      ['SHEET', 6, 1, 'c'],
      ['END', 7, 1, null],
    ]);
  });

  it('gives the ring one unit for each gap between projects, and the sheet the last project', () => {
    expect(buildChapters({ categories: ['x'] }).units.map((u) => [u.id, u.category])).toEqual([
      ['HOME', null],
      ['LIGHT', null],
      ['SHEET', 'x'],
      ['END', null],
    ]);
    expect(buildChapters({ categories: ['x', 'y', 'z', 'w'] }).total).toBe(1 + 3 + 3 + 1 + 1);
  });

  it('has neither ring nor sheet without categories, and still ends on END', () => {
    expect(buildChapters({ categories: [] }).units.map((u) => u.id)).toEqual(['HOME', 'LIGHT', 'END']);
  });
});

describe('chapterAt', () => {
  it('starts on HOME', () => {
    expect(chapterAt(c, 0)).toEqual({ index: 0, id: 'HOME', local: 0, category: null });
  });

  it('puts a position in a unit and says how far into it: the light dive is three units long', () => {
    const at = chapterAt(c, 2.5);
    expect(at.id).toBe('LIGHT');
    expect(at.index).toBe(1);
    expect(at.local).toBeCloseTo(0.5, 10);
  });

  it('names the project at the start of a ring unit, and the last project on the sheet', () => {
    expect(chapterAt(c, 5.2)).toMatchObject({ id: 'RING', category: 'b' });
    expect(chapterAt(c, 6.5)).toMatchObject({ id: 'SHEET', category: 'c' });
  });

  it('starts a unit exactly on its start', () => {
    expect(chapterAt(c, 1).id).toBe('LIGHT');
    expect(chapterAt(c, 4).id).toBe('RING');
    expect(chapterAt(c, 6).id).toBe('SHEET');
    expect(chapterAt(c, 7).id).toBe('END');
  });

  it('clamps below zero to HOME and above the total to the last unit, END', () => {
    expect(chapterAt(c, -3).id).toBe('HOME');
    expect(chapterAt(c, -3).local).toBe(0);
    const end = chapterAt(c, 99);
    expect(end.index).toBe(5);
    expect(end.id).toBe('END');
    expect(end.category).toBeNull();
    expect(end.local).toBe(1);
  });

  it('keeps the previous unit while the position is within the hysteresis outside it', () => {
    expect(HYSTERESIS).toBe(0.02);
    expect(chapterAt(c, 1.01, { index: 0 }).index).toBe(0);
    expect(chapterAt(c, 1.03, { index: 0 }).index).toBe(1);
    expect(chapterAt(c, 0.99, { index: 1 }).index).toBe(1);
    expect(chapterAt(c, 0.97, { index: 1 }).index).toBe(0);
  });

  it('ignores a previous index that is not a unit, and holds none that is not next to the position', () => {
    expect(chapterAt(c, 2.5, { index: 40 }).index).toBe(1);
    expect(chapterAt(c, 4, { index: 0 }).id).toBe('RING');
  });
});

describe('the places of the scroll', () => {
  it('lists each unit start as a stop; the last, END, is the end of the scroll', () => {
    expect(stops(c)).toEqual([0, 1, 4, 5, 6, 7]);
    expect(scrollEnd(c)).toBe(7);
    expect(scrollEnd(c)).toBeLessThan(c.total);
  });

  it('names the rise, the light dive, the ring and the sheet', () => {
    expect([riseTop(c), lightStart(c), ringStart(c), sheetStart(c), scrollEnd(c)]).toEqual([1, 1, 4, 6, 7]);
  });

  it("maps the way's frames 1 to 300 onto the light dive, linearly", () => {
    expect(placeOfFrame(1)).toBe(1);
    expect(placeOfFrame(300)).toBe(4);
    expect(placeOfFrame(150.5)).toBeCloseTo(2.5, 10);
  });

  it('steps keys through the top, each fact at full strength, each project and the end', () => {
    expect(FACT_PEAKS).toEqual([81, 121, 161, 201, 241]);
    expect(keyStops(HOME_CHAPTERS)).toEqual([0, 1, ...FACT_PEAKS.map(placeOfFrame), 4, 5, 6, 7]);
  });

  it("puts each project at its ring stop: a ring unit's start, and the sheet's for the last", () => {
    expect(['a', 'b', 'c'].map((category) => projectStop(c, category))).toEqual([4, 5, 6]);
    expect(() => projectStop(c, 'none')).toThrow(TypeError);
  });
});

describe('HOME_CHAPTERS', () => {
  it("is the home's: the three project categories in order", () => {
    expect(HOME_CHAPTERS.units.map((u) => [u.id, u.start, u.length, u.category])).toEqual([
      ['HOME', 0, 1, null],
      ['LIGHT', 1, 3, null],
      ['RING', 4, 1, 'secure-element'],
      ['RING', 5, 1, 'front-panel'],
      ['SHEET', 6, 1, 'oscillator'],
      ['END', 7, 1, null],
    ]);
    expect(stops(HOME_CHAPTERS)).toEqual([0, 1, 4, 5, 6, 7]);
  });
});
