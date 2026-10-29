import { describe, expect, it } from 'vitest';
import {
  AREA_STOP,
  areaStop,
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
  LAND_STOP,
  lookStart,
  lookStop,
  pathStart,
  placeOfFrame,
  riseTop,
  qaPlaceAt,
  qaStop,
  scrollEnd,
  stops,
  WORLD_LAYOUT,
  worldStop,
} from '../../../src/state/chapters';
import { RING_QUESTIONS } from '../../../src/data/qa';

/** Where the light dive hands the light over to the path: way frame 256 (1 + 6 · 255 / 299, the fall at its doubled pace). */
const L = 1 + (6 * 255) / 299;
const c = buildChapters({
  areas: [
    { category: 'app', projects: ['steady'] },
    { category: 'website', projects: ['jontai-energy'] },
    { category: 'game', projects: ['cookies-clicker'] }
  ]
});

describe('the fall’s pace', () => {
  it('runs the fall over twice the scroll: 6 viewport heights per 299 frames', () => {
    expect(FALL_PACE).toBe(6);
    expect(LIGHT_UNITS).toBeCloseTo((6 * 255) / 299, 12);
    for (const f of [1, 81, 121, 161, 201, 241, 256]) expect(frameOfPlace(placeOfFrame(f))).toBeCloseTo(f, 9);
    // Each fact (40 frames apart) is twice the scroll apart: 0.803 units, 0.401 before.
    expect(placeOfFrame(121) - placeOfFrame(81)).toBeCloseTo((6 * 40) / 299, 12);
    // the top, BOB from above, five facts, the world, three areas, the look back, six questions and the end
    expect(keyStops(HOME_CHAPTERS)).toHaveLength(19);
  });
});

describe('buildChapters', () => {
  it("lays the world out: the land, an area per category on the way in the categories' order, the look back", () => {
    expect(HAND_F).toBe(256);
    // The land 2.43: the drop to the lid twice its old 0.63 (spec 2026-10-29-bob-stack-3-design.md, goal 1), 1.17 after it.
    expect(WORLD_LAYOUT).toEqual({ land: expect.closeTo(2.43, 12), area: 1.4, look: 1.6, qa: 1 });
    expect(c.units.map((u) => [u.id, u.project, u.category])).toEqual([
      ['HOME', null, null],
      ['LIGHT', null, null],
      ['LAND', null, null],
      ['AREA', 0, 'app'],
      ['AREA', 1, 'website'],
      ['AREA', 2, 'game'],
      ['LOOK', null, null],
      ...[0, 1, 2, 3, 4, 5, 6].map((k) => ['QA', k, null]),
      ['END', null, null],
    ]);
    const starts = [0, 1, L, L + 2.43, L + 3.83, L + 5.23, L + 6.63, ...[0, 1, 2, 3, 4, 5, 6].map((k) => L + 8.23 + k), L + 15.23];
    c.units.forEach((u, k) => expect(u.start).toBeCloseTo(starts[k]!, 9));
    expect(c.total).toBeCloseTo(L + 16.23, 9);
  });

  it('gives a category with two projects one area', () => {
    const four = buildChapters({
      areas: [
        { category: 'app', projects: ['steady'] },
        { category: 'game', projects: ['cookies-clicker', 'jontai-energy'] }
      ]
    });
    expect(four.units.filter((u) => u.id === 'AREA').map((u) => [u.category, u.project])).toEqual([
      ['app', 0],
      ['game', 1],
    ]);
  });

  it('has no area for a category with no project on the way, and still looks back and ends on END', () => {
    expect(buildChapters({ areas: [] }).units.map((u) => u.id)).toEqual(['HOME', 'LIGHT', 'LAND', 'LOOK', ...Array(7).fill('QA'), 'END']);
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

  it("names an area's category and place, and none in the land or the look back", () => {
    expect(chapterAt(c, L + 4.63)).toMatchObject({ id: 'AREA', category: 'website', project: 1 });
    expect(chapterAt(c, L + 1.63)).toMatchObject({ id: 'LAND', category: null, project: null });
    expect(chapterAt(c, L + 7.63)).toMatchObject({ id: 'LOOK', category: null, project: null });
  });

  it('starts a unit exactly on its start', () => {
    expect(chapterAt(c, 1).id).toBe('LIGHT');
    expect(chapterAt(c, L).id).toBe('LAND');
    expect(chapterAt(c, lookStop(c))).toMatchObject({ id: 'QA', project: 0 });
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
    expect(chapterAt(c, L + 2.78, { index: 0 }).id).toBe('AREA');
  });
});

describe('the places of the scroll', () => {
  it('lists each unit start as a stop; the last, END, is the end of the scroll', () => {
    expect(stops(c)).toHaveLength(c.units.length);
    expect(scrollEnd(c)).toBeCloseTo(L + 15.23, 9);
    expect(scrollEnd(c)).toBeLessThan(c.total);
  });

  it("names the rise, the fall, the path and the look back's stop", () => {
    expect([riseTop(c), lightStart(c)]).toEqual([1, 1]);
    expect(pathStart(c)).toBeCloseTo(L, 9);
    expect(lookStart(c)).toBeCloseTo(L + 6.63, 9);
    expect(lookStop(c)).toBeCloseTo(L + 8.23, 9);
  });

  it("maps the way's frames onto the fall, linearly, and back", () => {
    expect(placeOfFrame(1)).toBe(1);
    expect(placeOfFrame(HAND_F)).toBeCloseTo(L, 12);
    // Half way through the 299 frames: half the fall's six viewport heights past BOB from above.
    expect(placeOfFrame(150.5)).toBeCloseTo(1 + FALL_PACE / 2, 10);
    expect(frameOfPlace(placeOfFrame(121))).toBeCloseTo(121, 9);
  });

  it("keeps the key stops: the facts, the world, each area, the look back's own stop, each question and the end", () => {
    expect(FACT_PEAKS).toEqual([81, 121, 161, 201, 241]);
    expect([LAND_STOP, AREA_STOP]).toEqual([expect.closeTo((1.26 + 0.9) / 2.43, 12), 0.7]);
    const expected = [0, 1, ...FACT_PEAKS.map(placeOfFrame), L + 2.16, L + 3.41, L + 4.81, L + 6.21, L + 8.23, ...[0, 1, 2, 3, 4, 5, 6].map((k) => L + 9.23 + k)];
    const got = keyStops(HOME_CHAPTERS);
    expect(got).toHaveLength(expected.length);
    got.forEach((s, k) => expect(s).toBeCloseTo(expected[k]!, 9));
    expect(worldStop(HOME_CHAPTERS)).toBeCloseTo(L + 2.16, 9);
  });

  it("puts each area's stop inside its area, at AREA_STOP of it", () => {
    expect(areaStop(HOME_CHAPTERS, 'website')).toBeCloseTo(L + 4.81, 9);
    expect(chapterAt(HOME_CHAPTERS, areaStop(HOME_CHAPTERS, 'website'))).toMatchObject({ id: 'AREA', category: 'website' });
    expect(() => areaStop(buildChapters({ areas: [] }), 'game')).toThrow(TypeError);
  });
});

describe('HOME_CHAPTERS', () => {
  it("is the home's: an area per category of the projects on the way, in the categories' order", () => {
    expect(HOME_CHAPTERS.units.filter((u) => u.id === 'AREA').map((u) => u.category)).toEqual(['app', 'website', 'game']);
  });

  it("puts a project's place at its area's stop", async () => {
    const { placeForProject } = await import('../../../src/state/routeSync');
    expect(placeForProject('jontai-energy')).toBeCloseTo(areaStop(HOME_CHAPTERS, 'website'), 12);
    expect(placeForProject('cookies-clicker')).toBeCloseTo(areaStop(HOME_CHAPTERS, 'game'), 12);
  });
});

describe('the landing hold', () => {
  it("holds the story at the path's start, the hand-over, while the world builds", async () => {
    const { LANDING_HOLD, landingHoldFor } = await import('../../../src/scene/bob/landingHold');
    expect(LANDING_HOLD).toBe(pathStart(HOME_CHAPTERS));
    expect(landingHoldFor('loading')).toBe(LANDING_HOLD);
    expect(landingHoldFor('ready')).toBe(scrollEnd(HOME_CHAPTERS));
  });
});

// The Q&A as a gold ring round the closing stack (spec 2026-10-29-bob-stack-2-design.md, goal 1): a stop for each
// question, and the end, after the look back.
describe('the Q&A on the ring', () => {
  it('lays a QA unit for each mark after the look back', () => {
    const qa = c.units.filter((u) => u.id === 'QA');
    expect(qa).toHaveLength(RING_QUESTIONS + 1);
    expect(qa.map((u) => u.length)).toEqual(Array(RING_QUESTIONS + 1).fill(1));
    expect(qa.map((u) => u.project)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(c.units.at(-1)!.id).toBe('END');
    expect(c.units.map((u) => u.id)).not.toContain('SHEET');
  });

  it('stops at the look back, at each question and at the end', () => {
    const qaStops = [0, 1, 2, 3, 4, 5, 6].map((k) => qaStop(c, k));
    const key = keyStops(c);
    for (const stop of [lookStop(c), ...qaStops]) expect(key.some((s) => Math.abs(s - stop) < 1e-9)).toBe(true);
    for (let k = 1; k < qaStops.length; k++) expect(qaStops[k]!).toBeGreaterThan(qaStops[k - 1]!);
    expect(qaStop(c, RING_QUESTIONS)).toBe(scrollEnd(c));
    expect(key.at(-1)).toBe(scrollEnd(c));
  });

  it('reads the place on the ring', () => {
    expect(qaPlaceAt(c, lookStop(c))).toBeCloseTo(-1, 12);
    expect(qaPlaceAt(c, qaStop(c, 0))).toBeCloseTo(0, 12);
    expect(qaPlaceAt(c, (qaStop(c, 2) + qaStop(c, 3)) / 2)).toBeCloseTo(2.5, 12);
    expect(qaPlaceAt(c, scrollEnd(c))).toBeCloseTo(6, 12);
    expect(qaPlaceAt(c, lookStop(c) - 1)).toBeNull();
  });
});
