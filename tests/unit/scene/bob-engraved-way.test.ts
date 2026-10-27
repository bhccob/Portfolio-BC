import { describe, expect, it } from 'vitest';
import { engravedLevels, ENGRAVED, shaftRings, tripPoints } from '../../../src/scene/bob/engravedWay';
import { F, factAt } from '../../../src/scene/bob/lightDive';
import { makePath, type PathPart } from '../../../src/scene/bob/lightPath';
import { buildChapters } from '../../../src/state/chapters';

/** Five projects on the way (Way 2), as the light path's own tests build them. */
const FIVE_CATEGORIES = Array.from({ length: 5 }, (_, k) => `c${k}`);

describe('the shaft: the throat round the fall, and the hall that opens out', () => {
  it('builds the throat round the fall and the hall that opens out toward the hand-over', () => {
    const rings = shaftRings();
    const throat = rings.filter((r) => r.zone === 'throat');
    const hall = rings.filter((r) => r.zone === 'hall');
    expect(throat.every((r) => r.radius === 1.45)).toBe(true);
    expect(Math.min(...hall.map((r) => r.radius))).toBe(5.2);
    expect(Math.max(...hall.map((r) => r.radius))).toBeGreaterThan(10);
    // Opening: the gaps grow below HALL.open.
    const ys = hall.map((r) => r.y);
    expect(ys[1]! - ys[0]!).toBeCloseTo(-0.34, 9);
    expect(ys.at(-2)! - ys.at(-1)!).toBeGreaterThan(1);
  });

  it('keeps the throat inside the glass floor’s hole and its rings level, the hall’s tilting only as they open', () => {
    const rings = shaftRings();
    const throat = rings.filter((r) => r.zone === 'throat');
    expect(throat[0]!.y).toBe(ENGRAVED.THROAT.top);
    expect(Math.min(...throat.map((r) => r.y))).toBeGreaterThan(ENGRAVED.THROAT.bottom);
    expect(throat.every((r) => r.tilt[0] === 0 && r.tilt[1] === 0 && r.width === 0.07)).toBe(true);
    for (const r of rings.filter((ring) => ring.zone === 'hall' && ring.y >= ENGRAVED.HALL.open)) {
      expect(r).toMatchObject({ radius: 5.2, width: 0.13, tilt: [0, 0] });
    }
  });
});

describe('the levels: each part of the engraved way, at a pose', () => {
  it('shows the throat from above at the fall’s start and the hall from the turn on', () => {
    const at = (frame: number) => engravedLevels({ stretch: 'light', frame }, null, 3);
    expect(at(1)).toMatchObject({ throat: 0, hall: 0 });
    expect(at(40).throat).toBe(1);
    expect(at(121)).toMatchObject({ throat: 0, hall: 1 });
  });

  it('the throat is gone whenever a fact shows', () => {
    expect(ENGRAVED.THROAT_OUT[1]).toBeLessThan(F.FALL);
    for (let f = 1; f <= 256; f += 0.25) if (factAt(f).opacity > 0) expect(engravedLevels({ stretch: 'light', frame: f }, null, 3).throat, `at ${f}`).toBe(0);
  });

  it('rides each trip on its own line, out early in the orbit, none inside, all faint in the look back', () => {
    const lv = (part: PathPart, index: number, t: number, black = 0) => engravedLevels({ stretch: part, frame: null }, { part, index, t, black }, 3);
    expect(lv('travel', 1, 0.5).trips).toEqual([0, 1, 0]);
    expect(lv('travel', 0, 0.02).trips[0]).toBe(0); // the first line comes in after the turn
    expect(lv('travel', 0, 0.5).hall).toBeGreaterThan(0); // the hall fades out over the first trip
    expect(lv('orbit', 1, 0.5).trips[1]).toBe(0);
    expect(lv('inside', 1, 0.5).trips).toEqual([0, 0, 0]);
    expect(Math.max(...lv('look', -1, 1).trips)).toBeCloseTo(0.32, 9);
    expect(lv('sheet', -1, 0.5, 1).trips).toEqual([0, 0, 0]);
  });

  it('keeps every trip’s line out where its travel begins, the bead’s inside stop, and brings it in as the light leaves', () => {
    const lv = (index: number, t: number) => engravedLevels({ stretch: 'travel', frame: null }, { part: 'travel', index, t, black: 0 }, 3).trips[index];
    for (const index of [0, 1, 2]) {
      expect(lv(index, 0), `trip ${index}`).toBe(0);
      expect(lv(index, ENGRAVED.TRIP_IN_T[0]), `trip ${index}`).toBe(0);
      expect(lv(index, ENGRAVED.TRIP_IN_T[1]), `trip ${index}`).toBe(1);
    }
  });

  it('shows nothing on the rise and on the end page, and the hall goes out as the first trip goes on', () => {
    expect(engravedLevels({ stretch: 'rise', frame: null }, null, 3)).toEqual({ throat: 0, hall: 0, trips: [0, 0, 0] });
    expect(engravedLevels({ stretch: 'end', frame: null }, null, 3)).toEqual({ throat: 0, hall: 0, trips: [0, 0, 0] });
    const first = (t: number) => engravedLevels({ stretch: 'travel', frame: null }, { part: 'travel', index: 0, t, black: 0 }, 3);
    expect(first(0)).toMatchObject({ throat: 0, hall: 1 });
    expect(first(ENGRAVED.HALL_OUT_T).hall).toBe(0);
    expect(first(0.25).trips[0]).toBe(1);
    expect(engravedLevels({ stretch: 'travel', frame: null }, { part: 'travel', index: 1, t: 0, black: 0 }, 3).hall).toBe(0);
  });
});

describe('the trips: the light’s own line from one bead to the next', () => {
  it('gives every travel its line, five projects too (Way 2)', () => {
    expect(tripPoints(makePath(16 / 9))).toHaveLength(3);
    expect(tripPoints(makePath(16 / 9, buildChapters({ path: FIVE_CATEGORIES })))).toHaveLength(5);
    // The first trip's line begins after the turn out of the fall: none of its points at the hand-over.
    const first = tripPoints(makePath(16 / 9))[0]!;
    const hand = makePath(16 / 9).frameAt(0).light.position;
    expect(Math.hypot(first[0]![0] - hand[0], first[0]![1] - hand[1], first[0]![2] - hand[2])).toBeGreaterThan(0.3);
  });

  it('follows the light along each travel, ending where the light meets its bead’s orbit', () => {
    const path = makePath(16 / 9);
    const trips = tripPoints(path);
    for (const [k, points] of trips.entries()) {
      expect(points.length, `trip ${k}`).toBeGreaterThan(10);
      const last = points.at(-1)!;
      const centre = path.centres[k]!;
      // Within a couple of orbit radii of its bead, never past it into the next.
      expect(Math.hypot(last[0] - centre[0], last[1] - centre[1], last[2] - centre[2]), `trip ${k}`).toBeLessThan(4);
    }
  });
});
