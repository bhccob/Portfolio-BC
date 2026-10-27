import { describe, expect, it } from 'vitest';
import { engravedLevels } from '~/scene/bob/engravedWay';
import { journeyPoseAt } from '~/scene/bob/journey';
import { makePath, type PathPart } from '~/scene/bob/lightPath';
import { CORRIDOR, cloudLayout, NEBULA, nebulaLevels } from '~/scene/bob/nebulaWay';
import { buildChapters, HOME_CHAPTERS, pathStart } from '~/state/chapters';

const L = pathStart(HOME_CHAPTERS);
const fall = (frame: number) => nebulaLevels({ stretch: 'light', frame }, null);
const on = (part: PathPart, index: number, t: number, black = 0) => nebulaLevels({ stretch: part, frame: null }, { part, index, t, black });

describe('the levels: the nebula, its far bands and the look back rings, at a pose', () => {
  it('brings the clouds in over the fall, frames 50 to 95, whole from there on', () => {
    expect(NEBULA.CLOUDS_IN).toEqual([50, 95]);
    expect(fall(30)).toEqual({ clouds: 0, bands: 0, rings: 0 });
    expect(fall(50).clouds).toBe(0);
    expect(fall(72.5).clouds).toBeCloseTo(0.5, 9);
    expect(fall(95)).toEqual({ clouds: 1, bands: 0, rings: 0 });
    expect(fall(121)).toEqual({ clouds: 1, bands: 0, rings: 0 });
    let last = 0;
    for (let f = 1; f <= 256; f += 0.5) {
      const { clouds } = fall(f);
      expect(clouds).toBeGreaterThanOrEqual(last);
      last = clouds;
    }
  });

  it('keeps the clouds whole on the path, the bands in over the first trip, and the rings in the look back alone', () => {
    expect(on('travel', 0, 0.1)).toEqual({ clouds: 1, bands: 0, rings: 0 });
    expect(on('travel', 0, 0.45).bands).toBeCloseTo(0.5, 9);
    expect(on('travel', 0, 0.7)).toEqual({ clouds: 1, bands: 1, rings: 0 });
    expect(on('arrive', 0, 0.5)).toEqual({ clouds: 1, bands: 1, rings: 0 });
    expect(on('travel', 2, 0)).toEqual({ clouds: 1, bands: 1, rings: 0 });
    expect(on('look', -1, 0.1).rings).toBe(0);
    expect(on('look', -1, 0.425).rings).toBeCloseTo(0.3, 9);
    expect(on('look', -1, 1).rings).toBeCloseTo(0.6, 9);
    // Under the sheet everything goes out with its black; the rise and the end page have none.
    expect(on('sheet', -1, 0.5, 0.5)).toEqual({ clouds: 0.5, bands: 0.5, rings: 0.3 });
    expect(on('sheet', -1, 1, 1)).toEqual({ clouds: 0, bands: 0, rings: 0 });
    expect(nebulaLevels({ stretch: 'rise', frame: null }, null)).toEqual({ clouds: 0, bands: 0, rings: 0 });
    expect(nebulaLevels({ stretch: 'end', frame: null }, null)).toEqual({ clouds: 0, bands: 0, rings: 0 });
  });

  it("joins the fall's end to the path's start with no jump", () => {
    const end = journeyPoseAt(L - 1e-9, 16 / 9);
    const start = journeyPoseAt(L, 16 / 9);
    expect(nebulaLevels(end.at, end.path)).toEqual(nebulaLevels(start.at, start.path));
  });

  it("lets the hall's wide rings give way to the clouds, frames 70 to 110, and keeps them away on the path", () => {
    const hall = (frame: number) => engravedLevels({ stretch: 'light', frame }, null, 3).hall;
    expect(hall(60)).toBeGreaterThan(0); // it comes in as the camera turns, as before
    expect(hall(90)).toBeCloseTo(0.5, 6);
    expect(hall(110)).toBe(0);
    expect(hall(121)).toBe(0);
    for (const t of [0, 0.3, 0.6]) expect(engravedLevels({ stretch: 'travel', frame: null }, { part: 'travel', index: 0, t, black: 0 }, 3).hall).toBe(0);
  });
});

describe('the clouds: where they hang, each at its own depth', () => {
  const desk = makePath(16 / 9);
  const phone = makePath(390 / 844);

  it('lays as many clouds as the tier allows', () => {
    expect(NEBULA.COUNT).toEqual({ high: 140, medium: 70, low: 35 });
    for (const tier of ['high', 'medium', 'low'] as const) expect(cloudLayout(desk, tier)).toHaveLength(NEBULA.COUNT[tier]);
    // The same path lays the same clouds: nothing random from one load to the next.
    expect(cloudLayout(desk, 'high')).toEqual(cloudLayout(desk, 'high'));
    // About half down the fall's column, the rest round the way.
    const high = cloudLayout(desk, 'high');
    const inFall = high.filter((c) => c.at[1] > -12 && c.at[1] < -1).length;
    expect(inFall).toBeGreaterThan(40);
    expect(inFall).toBeLessThan(100);
    for (const c of high) {
      expect(c.size).toBeGreaterThan(2);
      expect(c.size).toBeLessThan(12);
      expect(c.alpha).toBeGreaterThan(0);
      expect(c.alpha).toBeLessThanOrEqual(0.6);
      expect(c.tint).toBeGreaterThanOrEqual(0);
      expect(c.tint).toBeLessThanOrEqual(1);
      expect(Number.isInteger(c.variant) && c.variant >= 0 && c.variant < 4).toBe(true);
    }
  });

  it("keeps the clouds out of the fall's corridor", () => {
    expect(CORRIDOR).toBe(2.8);
    // The fall runs down x 0, z 0, the camera on its +z side: no cloud, its whole width, between the camera and the light.
    for (const path of [desk, phone]) {
      for (const c of cloudLayout(path, 'high')) {
        if (c.at[1] > -12.5 && c.at[1] < 0) {
          const inFront = c.at[2] > -1 - c.size / 2;
          expect(inFront && Math.abs(c.at[0]) < CORRIDOR + c.size / 2, `a cloud at ${c.at.map((v) => v.toFixed(2))}`).toBe(false);
        }
      }
    }
  });

  it('keeps every cloud clear of the beads, and off the line from each arrival\'s camera to its bead', () => {
    const chapters = HOME_CHAPTERS;
    for (const [path, aspect] of [[desk, 16 / 9], [phone, 390 / 844]] as const) {
      const clouds = cloudLayout(path, 'high');
      const arrivals = chapters.units.filter((u) => u.id === 'ARRIVE').map((u) => journeyPoseAt(u.start + 0.65 * u.length, aspect).shot);
      expect(arrivals).toHaveLength(path.centres.length);
      for (const c of clouds) {
        for (const centre of path.centres) {
          expect(Math.hypot(c.at[0] - centre[0], c.at[1] - centre[1], c.at[2] - centre[2])).toBeGreaterThan(2 + c.size / 2);
        }
        for (const [k, shot] of arrivals.entries()) {
          const a = shot.position;
          const b = path.centres[k]!;
          // The distance from the cloud to the segment from the camera to the bead.
          const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
          const ac = [c.at[0] - a[0], c.at[1] - a[1], c.at[2] - a[2]];
          const s = Math.max(0, Math.min(1, (ab[0]! * ac[0]! + ab[1]! * ac[1]! + ab[2]! * ac[2]!) / (ab[0]! ** 2 + ab[1]! ** 2 + ab[2]! ** 2)));
          const d = Math.hypot(ac[0]! - ab[0]! * s, ac[1]! - ab[1]! * s, ac[2]! - ab[2]! * s);
          expect(d, `a cloud at ${c.at.map((v) => v.toFixed(2))} before bead ${k}`).toBeGreaterThan(1.2 + c.size / 2);
        }
      }
    }
  });

  it('lays clouds round five projects too (Way 2)', () => {
    const five = makePath(16 / 9, buildChapters({ path: ['c0', 'c1', 'c2', 'c3', 'c4'] }));
    expect(cloudLayout(five, 'high')).toHaveLength(140);
  });
});
