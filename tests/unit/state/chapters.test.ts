import { describe, expect, it } from 'vitest';
import {
  ARRIVE_STOP,
  arrivalStop,
  buildChapters,
  chapterAt,
  FACT_PEAKS,
  FALL_PACE,
  frameOfPlace,
  HAND_F,
  HOME_CHAPTERS,
  HYSTERESIS,
  keyStops,
  LIGHT_UNITS,
  lightStart,
  lookStart,
  PATH_LAYOUT,
  pathStart,
  placeOfFrame,
  riseTop,
  scrollEnd,
  sheetStart,
  stops,
} from '../../../src/state/chapters';

/** Where the light dive hands the light over to the path: way frame 256 (1 + 6 · 255 / 299, the fall at its doubled pace). */
const L = 1 + (6 * 255) / 299;
const c = buildChapters({ path: ['a', 'b', 'c'] });

describe('the fall’s pace', () => {
  it('runs the fall over twice the scroll: 6 viewport heights per 299 frames', () => {
    expect(FALL_PACE).toBe(6);
    expect(LIGHT_UNITS).toBeCloseTo((6 * 255) / 299, 12);
    for (const f of [1, 81, 121, 161, 201, 241, 256]) expect(frameOfPlace(placeOfFrame(f))).toBeCloseTo(f, 9);
    // Each fact (40 frames apart) is twice the scroll apart: 0.803 units, 0.401 before.
    expect(placeOfFrame(121) - placeOfFrame(81)).toBeCloseTo((6 * 40) / 299, 12);
    expect(keyStops(HOME_CHAPTERS)).toHaveLength(12); // the top, BOB from above, five facts, three arrivals, the look back, the end
  });
});

describe('buildChapters', () => {
  it("lays out the home: the rise, the fall, each project's travel and arrival (no orbit, no inside), the look back, the sheet, the end", () => {
    expect(HAND_F).toBe(256);
    expect(LIGHT_UNITS).toBeCloseTo((6 * 255) / 299, 12);
    expect(c.units.map((u) => [u.id, u.project, u.category])).toEqual([
      ['HOME', null, null],
      ['LIGHT', null, null],
      ['TRAVEL', 0, 'a'],
      ['ARRIVE', 0, 'a'],
      ['TRAVEL', 1, 'b'],
      ['ARRIVE', 1, 'b'],
      ['TRAVEL', 2, 'c'],
      ['ARRIVE', 2, 'c'],
      ['LOOK', null, null],
      ['SHEET', null, null],
      ['END', null, null],
    ]);
    expect(PATH_LAYOUT).toEqual({ travel: [1.25, 1.45, 1.55], arrive: 0.9, look: 1.9 });
    const starts = [0, 1, L, L + 1.25, L + 2.15, L + 3.6, L + 4.5, L + 6.05, L + 6.95, L + 8.85, L + 9.85];
    c.units.forEach((u, k) => expect(u.start).toBeCloseTo(starts[k]!, 9));
    expect(c.total).toBeCloseTo(L + 10.85, 9);
  });

  it("gives a fourth and fifth travel the third's length", () => {
    const five = buildChapters({ path: ['a', 'b', 'c', 'd', 'e'] });
    expect(five.units.filter((u) => u.id === 'TRAVEL').map((u) => u.length)).toEqual([1.25, 1.45, 1.55, 1.55, 1.55]);
  });

  it('has no project units without projects, and still looks back and ends on END', () => {
    expect(buildChapters({ path: [] }).units.map((u) => u.id)).toEqual(['HOME', 'LIGHT', 'LOOK', 'SHEET', 'END']);
  });
});

describe('chapterAt', () => {
  it('starts on HOME', () => {
    expect(chapterAt(c, 0)).toEqual({ index: 0, id: 'HOME', local: 0, category: null, project: null });
  });

  it('puts a position in a unit and says how far into it', () => {
    const at = chapterAt(c, 1 + LIGHT_UNITS / 2);
    expect(at.id).toBe('LIGHT');
    expect(at.index).toBe(1);
    expect(at.local).toBeCloseTo(0.5, 10);
  });

  it("names the project of a travel and an arrival, and none in the look back", () => {
    expect(chapterAt(c, L + 4.0)).toMatchObject({ id: 'ARRIVE', category: 'b', project: 1 });
    expect(chapterAt(c, L + 3.0)).toMatchObject({ id: 'TRAVEL', category: 'b', project: 1 });
    expect(chapterAt(c, L + 7.5)).toMatchObject({ id: 'LOOK', category: null, project: null });
  });

  it('starts a unit exactly on its start', () => {
    expect(chapterAt(c, 1).id).toBe('LIGHT');
    expect(chapterAt(c, L).id).toBe('TRAVEL');
    expect(chapterAt(c, sheetStart(c)).id).toBe('SHEET');
    expect(chapterAt(c, scrollEnd(c)).id).toBe('END');
  });

  it('clamps below zero to HOME and above the total to the last unit, END', () => {
    expect(chapterAt(c, -3).id).toBe('HOME');
    expect(chapterAt(c, -3).local).toBe(0);
    const end = chapterAt(c, 99);
    expect(end.index).toBe(c.units.length - 1);
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
    expect(chapterAt(c, L + 2.15, { index: 0 }).id).toBe('TRAVEL');
  });
});

describe('the places of the scroll', () => {
  it('lists each unit start as a stop; the last, END, is the end of the scroll', () => {
    expect(stops(c)).toHaveLength(c.units.length);
    expect(scrollEnd(c)).toBeCloseTo(L + 9.85, 9);
    expect(scrollEnd(c)).toBeLessThan(c.total);
  });

  it('names the rise, the fall, the path, the look back and the sheet', () => {
    expect([riseTop(c), lightStart(c)]).toEqual([1, 1]);
    expect(pathStart(c)).toBeCloseTo(L, 9);
    expect(lookStart(c)).toBeCloseTo(L + 6.95, 9);
    expect(sheetStart(c)).toBeCloseTo(L + 8.85, 9);
  });

  it("maps the way's frames onto the fall, linearly, and back", () => {
    expect(placeOfFrame(1)).toBe(1);
    expect(placeOfFrame(HAND_F)).toBeCloseTo(L, 12);
    // Half way through the 299 frames: half the fall's six viewport heights past BOB from above.
    expect(placeOfFrame(150.5)).toBeCloseTo(1 + FALL_PACE / 2, 10);
    expect(frameOfPlace(placeOfFrame(121))).toBeCloseTo(121, 9);
  });

  it('steps keys through the top, each fact, each arrival, the look back and the end: no inside on the scroll', () => {
    expect(FACT_PEAKS).toEqual([81, 121, 161, 201, 241]);
    expect(ARRIVE_STOP).toBe(0.65);
    const expected = [0, 1, ...FACT_PEAKS.map(placeOfFrame), L + 1.835, L + 4.185, L + 6.635, L + 8.85, L + 9.85];
    const got = keyStops(HOME_CHAPTERS);
    expect(got).toHaveLength(expected.length);
    got.forEach((s, k) => expect(s).toBeCloseTo(expected[k]!, 9));
  });

  it("puts each project's arrival stop inside its arrival, at ARRIVE_STOP of it: the light at rest, the bead still the one shown", () => {
    expect(arrivalStop(HOME_CHAPTERS, 'front-panel')).toBeCloseTo(L + 4.185, 9);
    expect(chapterAt(HOME_CHAPTERS, arrivalStop(HOME_CHAPTERS, 'front-panel'))).toMatchObject({ id: 'ARRIVE', category: 'front-panel' });
    expect(() => arrivalStop(c, 'none')).toThrow(TypeError);
  });
});

describe('HOME_CHAPTERS', () => {
  it("is the home's: the projects on the way, by their categories, in order", () => {
    expect(HOME_CHAPTERS.units.filter((u) => u.id === 'ARRIVE').map((u) => u.category)).toEqual(['secure-element', 'front-panel', 'oscillator']);
  });
});

describe('the landing hold', () => {
  it("holds the story at the path's start, the hand-over, while the beads load", async () => {
    const { LANDING_HOLD, landingHoldFor } = await import('../../../src/scene/bob/landingHold');
    expect(LANDING_HOLD).toBe(pathStart(HOME_CHAPTERS));
    expect(landingHoldFor('loading')).toBe(LANDING_HOLD);
    expect(landingHoldFor('ready')).toBe(scrollEnd(HOME_CHAPTERS));
  });
});
