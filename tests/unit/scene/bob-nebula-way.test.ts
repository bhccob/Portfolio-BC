import { describe, expect, it } from 'vitest';
import { engravedLevels } from '~/scene/bob/engravedWay';
import { journeyPoseAt } from '~/scene/bob/journey';
import { CORRIDOR, cloudLayout, NEBULA, nebulaLevels } from '~/scene/bob/nebulaWay';
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

describe('the clouds: where they hang, each at its own depth', () => {
  const desk = makeWorldPath(16 / 9);
  const phone = makeWorldPath(390 / 844);

  it('lays as many clouds as the tier allows', () => {
    expect(NEBULA.COUNT).toEqual({ high: 140, medium: 70, low: 35 });
    for (const tier of ['high', 'medium', 'low'] as const) expect(cloudLayout(desk, tier)).toHaveLength(NEBULA.COUNT[tier]);
    // The same world lays the same clouds: nothing random from one load to the next.
    expect(cloudLayout(desk, 'high')).toEqual(cloudLayout(desk, 'high'));
    // About half down the fall's column, the rest round the world.
    const high = cloudLayout(desk, 'high');
    const inFall = high.filter((c) => c.at[1] > -12 && c.at[1] < -1).length;
    expect(inFall).toBeGreaterThan(40);
    expect(inFall).toBeLessThan(100);
    for (const c of high) {
      expect(c.size).toBeGreaterThan(2);
      expect(c.size).toBeLessThan(12);
      expect(c.alpha).toBeGreaterThan(0);
      expect(c.alpha).toBeLessThanOrEqual(0.6);
      expect(Number.isInteger(c.variant) && c.variant >= 0 && c.variant < 4).toBe(true);
    }
  });

  it("keeps the clouds out of the fall's corridor", () => {
    expect(CORRIDOR).toBe(2.8);
    for (const world of [desk, phone]) {
      for (const c of cloudLayout(world, 'high')) {
        if (c.at[1] > -12.5 && c.at[1] < 0) {
          const inFront = c.at[2] > -1 - c.size / 2;
          expect(inFront && Math.abs(c.at[0]) < CORRIDOR + c.size / 2, `a cloud at ${c.at.map((v) => v.toFixed(2))}`).toBe(false);
        }
      }
    }
  });

  it("keeps every cloud off the board and out of every world view's line of sight", () => {
    for (const world of [desk, phone]) {
      const c0 = world.centre;
      // The land's, the whole machine's, a stop per category board and the look back's (a project opens where the camera is).
      expect(world.sights.length).toBe(3 + world.places.length - 1);
      for (const c of cloudLayout(world, 'high')) {
        const over = Math.hypot(c.at[0] - c0[0], c.at[2] - c0[2]) < NEBULA.WORLD.board + c.size / 2 && Math.abs(c.at[1] - c0[1]) < NEBULA.WORLD.height + c.size / 2;
        expect(over, `a cloud over the board at ${c.at.map((v) => v.toFixed(2))}`).toBe(false);
        for (const [a, b] of world.sights) {
          const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
          const ac = [c.at[0] - a[0], c.at[1] - a[1], c.at[2] - a[2]];
          const s = Math.max(0, Math.min(1, (ab[0]! * ac[0]! + ab[1]! * ac[1]! + ab[2]! * ac[2]!) / (ab[0]! ** 2 + ab[1]! ** 2 + ab[2]! ** 2)));
          const d = Math.hypot(ac[0]! - ab[0]! * s, ac[1]! - ab[1]! * s, ac[2]! - ab[2]! * s);
          expect(d, `a cloud at ${c.at.map((v) => v.toFixed(2))} in a view`).toBeGreaterThan(NEBULA.WORLD.sight + c.size / 2);
        }
      }
    }
  });

  it('lays clouds round five projects too (Way 2)', () => {
    const five = makeWorldPath(
      16 / 9,
      buildChapters({
        areas: [
          { category: 'app', projects: ['steady', 'jontai-energy'] },
          { category: 'website', projects: ['cookies-clicker'] },
          { category: 'game', projects: ['steady', 'jontai-energy'] }
        ]
      })
    );
    expect(cloudLayout(five, 'high')).toHaveLength(140);
  });
});
