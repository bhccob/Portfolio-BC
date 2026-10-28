import { describe, expect, it } from 'vitest';
import { engravedLevels } from '~/scene/bob/engravedWay';
import { journeyPoseAt } from '~/scene/bob/journey';
import { NEBULA, nebulaLevels } from '~/scene/bob/nebulaWay';
import { makeWorldPath, type WorldPart } from '~/scene/bob/worldPath';
import { buildChapters, HOME_CHAPTERS, pathStart } from '~/state/chapters';

const L = pathStart(HOME_CHAPTERS);
const fall = (frame: number) => nebulaLevels({ stretch: 'light', frame }, null);
const on = (part: WorldPart, t: number, black = 0) => nebulaLevels({ stretch: part, frame: null }, { part, t, black, index: part === 'area' ? 1 : -1 });

describe('the levels: the nebula, its far bands and the look back rings, at a pose', () => {
  it('brings the clouds in over the fall, frames 50 to 95, at the fall\'s quieter level behind Bob\'s facts', () => {
    expect(NEBULA.CLOUDS_IN).toEqual([50, 95]);
    expect(NEBULA.FALL_LEVEL).toBe(0.6);
    expect(fall(30)).toEqual({ clouds: 0, bands: 0, rings: 0 });
    expect(fall(50).clouds).toBe(0);
    expect(fall(72.5).clouds).toBeCloseTo(0.3, 9);
    expect(fall(95)).toEqual({ clouds: 0.6, bands: 0, rings: 0 });
    expect(fall(121)).toEqual({ clouds: 0.6, bands: 0, rings: 0 });
    let last = 0;
    for (let f = 1; f <= 256; f += 0.5) {
      const { clouds } = fall(f);
      expect(clouds).toBeGreaterThanOrEqual(last);
      last = clouds;
    }
  });

  it("brings the clouds up to the world's level over the land, as the light leaves the facts behind", () => {
    expect(NEBULA.WHOLE_BY_T).toBe(0.5);
    expect(on('land', 0).clouds).toBeCloseTo(0.6, 12);
    expect(on('land', 0.25).clouds).toBeCloseTo(0.7, 9);
    expect(on('land', 0.5).clouds).toBeCloseTo(0.8, 12);
    let last = 0.6;
    for (let t = 0; t <= 1; t += 0.01) {
      const { clouds } = on('land', t);
      expect(clouds).toBeGreaterThanOrEqual(last - 1e-12);
      last = clouds;
    }
  });

  it('keeps the clouds at their level on the world, the bands in over the land, and no rings: they were the beads\'', () => {
    expect(on('land', 0.1)).toMatchObject({ bands: 0, rings: 0 });
    expect(on('land', 0.45).bands).toBeCloseTo(0.5, 9);
    expect(on('land', 0.7)).toEqual({ clouds: expect.closeTo(0.8, 12), bands: 1, rings: 0 });
    expect(on('area', 0.1)).toEqual({ clouds: expect.closeTo(0.55, 12), bands: 1, rings: 0 });
    expect(on('look', 1)).toEqual({ clouds: expect.closeTo(0.8, 12), bands: 1, rings: 0 });
    // Under the sheet everything goes out with its black; the rise and the end page have none.
    expect(on('sheet', 0.5, 0.5)).toEqual({ clouds: expect.closeTo(0.4, 12), bands: 0.5, rings: 0 });
    expect(on('sheet', 1, 1)).toEqual({ clouds: 0, bands: 0, rings: 0 });
    expect(nebulaLevels({ stretch: 'rise', frame: null }, null)).toEqual({ clouds: 0, bands: 0, rings: 0 });
    expect(nebulaLevels({ stretch: 'end', frame: null }, null)).toEqual({ clouds: 0, bands: 0, rings: 0 });
  });

  it('quiets the clouds at an area and more with a project open', () => {
    expect(NEBULA.WORLD_LEVEL).toEqual({ world: 0.8, area: 0.55 });
    expect(on('land', 1).clouds).toBeCloseTo(0.8, 12);
    expect(nebulaLevels({ stretch: 'area', frame: null }, { part: 'area', t: 0.7, black: 0, index: 0 }).clouds).toBeCloseTo(0.55, 12);
    expect(nebulaLevels({ stretch: 'area', frame: null }, { part: 'area', t: 0, black: 0, index: 0 }).clouds).toBeCloseTo(0.8, 12);
    expect(nebulaLevels({ stretch: 'area', frame: null }, { part: 'area', t: 0, black: 0, index: 1 }).clouds).toBeCloseTo(0.55, 12);
    expect(nebulaLevels({ stretch: 'look', frame: null }, { part: 'look', t: 1, black: 0, index: -1 }).clouds).toBeCloseTo(0.8, 12);
    // With a project open, half of it.
    expect(nebulaLevels({ stretch: 'area', frame: null }, { part: 'area', t: 0.7, black: 0, index: 0 }, 1).clouds).toBeCloseTo(0.275, 12);
    expect(nebulaLevels({ stretch: 'area', frame: null }, { part: 'area', t: 0.7, black: 0, index: 0 }, 0.5).clouds).toBeCloseTo(0.4125, 12);
  });

  it("joins the fall's end to the path's start with no jump", () => {
    const end = journeyPoseAt(L - 1e-9, 16 / 9);
    const start = journeyPoseAt(L, 16 / 9);
    expect(nebulaLevels(end.at, end.path)).toEqual(nebulaLevels(start.at, start.path));
  });

  it("lets the hall's wide rings give way to the clouds, frames 70 to 110, and keeps them away on the world", () => {
    const hall = (frame: number) => engravedLevels({ stretch: 'light', frame }).hall;
    expect(hall(60)).toBeGreaterThan(0); // it comes in as the camera turns, as before
    expect(hall(90)).toBeCloseTo(0.5, 6);
    expect(hall(110)).toBe(0);
    expect(hall(121)).toBe(0);
    expect(engravedLevels({ stretch: 'land', frame: null }).hall).toBe(0);
  });
});

describe('the gas: no clouds laid out any more', () => {
  it('has no cloud layout: the volume (src/engine/bob/build/volume.ts) is the clouds now', async () => {
    const way = await import('~/scene/bob/nebulaWay');
    expect(way).not.toHaveProperty('cloudLayout');
    expect(NEBULA).not.toHaveProperty('COUNT');
  });
});
