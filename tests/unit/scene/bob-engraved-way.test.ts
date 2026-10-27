import { describe, expect, it } from 'vitest';
import { engravedLevels, ENGRAVED, shaftRings } from '../../../src/scene/bob/engravedWay';
import { F, factAt } from '../../../src/scene/bob/lightDive';

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
  it('shows the throat from above at the fall’s start and the hall from the turn on, till the nebula’s clouds take its place', () => {
    const at = (frame: number) => engravedLevels({ stretch: 'light', frame });
    expect(at(1)).toMatchObject({ throat: 0, hall: 0 });
    expect(at(40).throat).toBe(1);
    expect(at(72).hall).toBeGreaterThan(0.9);
    expect(at(121)).toMatchObject({ throat: 0, hall: 0 });
  });

  it('the throat is gone whenever a fact shows', () => {
    expect(ENGRAVED.THROAT_OUT[1]).toBeLessThan(F.FALL);
    for (let f = 1; f <= 256; f += 0.25) if (factAt(f).opacity > 0) expect(engravedLevels({ stretch: 'light', frame: f }).throat, `at ${f}`).toBe(0);
  });

  it("keeps the fall's shaft and has no trips' lines: nothing past the fall, on the world", () => {
    for (const stretch of ['rise', 'land', 'area', 'look', 'sheet', 'end'] as const) {
      expect(engravedLevels({ stretch, frame: null }), stretch).toEqual({ throat: 0, hall: 0, trips: [] });
    }
    expect(engravedLevels({ stretch: 'light', frame: 72 }).trips).toEqual([]);
  });
});
