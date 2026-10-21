import { describe, expect, it } from 'vitest';
import { COUNTRY_IDS, countryDirection, type CountryId, type DirId } from '~/data/directions';
import { bearingOf, DIAL } from '~/engine/instrument/dialSpec';
import { bearingRange, FIGURES, PLACEMENTS, pointedAt, starPositions } from '~/engine/v3/constellations';

const deg = (d: number) => (d * Math.PI) / 180;

/** The bearing of every star of a constellation, in radians, as the aim reads it from the positions. */
function starBearings(id: CountryId): number[] {
  const p = starPositions(id);
  const out: number[] = [];
  for (let k = 0; k < p.length; k += 3) out.push(bearingOf(p[k], p[k + 2]));
  return out;
}

/** The difference of two bearings in radians, wrapped into (-PI, PI]. */
function turn(a: number, b: number): number {
  const d = (a - b) % (2 * Math.PI);
  return d > Math.PI ? d - 2 * Math.PI : d <= -Math.PI ? d + 2 * Math.PI : d;
}

describe('the figures', () => {
  it('have 10 to 24 stars, every star on a line, every line between real stars', () => {
    for (const id of COUNTRY_IDS) {
      const f = FIGURES[id];
      expect(f.stars.length).toBeGreaterThanOrEqual(10);
      expect(f.stars.length).toBeLessThanOrEqual(24);
      const used = new Set(f.lines.flat());
      f.lines.flat().forEach((i) => expect(i).toBeLessThan(f.stars.length));
      expect(used.size).toBe(f.stars.length);
    }
  });
  it('keep every star in the unit square and its size in 0.4..1, and draw no line twice or to itself', () => {
    for (const id of COUNTRY_IDS) {
      const f = FIGURES[id];
      for (const [u, v, mag] of f.stars) {
        expect(u).toBeGreaterThanOrEqual(0);
        expect(u).toBeLessThanOrEqual(1);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
        expect(mag).toBeGreaterThanOrEqual(0.4);
        expect(mag).toBeLessThanOrEqual(1);
      }
      const keys = f.lines.map(([a, b]) => (a < b ? `${a}-${b}` : `${b}-${a}`));
      expect(new Set(keys).size).toBe(f.lines.length);
      for (const [a, b] of f.lines) {
        expect(a).not.toBe(b);
        expect(Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= 0).toBe(true);
      }
    }
  });
});

describe('placement', () => {
  it('keeps every star outside the glass', () => {
    for (const id of COUNTRY_IDS) {
      const p = starPositions(id);
      for (let k = 0; k < p.length; k += 3) expect(Math.hypot(p[k], p[k + 2])).toBeGreaterThan(DIAL.rim + 0.15);
    }
  });
  it('wraps China and Aruba round the rim: some low stars in front of it, on the camera side', () => {
    for (const id of ['china', 'aruba'] as const) {
      const p = starPositions(id);
      let front = 0;
      for (let k = 0; k < p.length; k += 3) if (p[k + 2] > 0 && p[k + 1] < 0.3) front++;
      expect(front).toBeGreaterThanOrEqual(2);
    }
  });
  it('puts the ship beyond the far edge and above the dial', () => {
    const p = starPositions('netherlands');
    for (let k = 0; k < p.length; k += 3) {
      expect(p[k + 2]).toBeLessThan(-DIAL.rim);
      expect(p[k + 1]).toBeGreaterThan(0.2);
    }
  });
  it("stands each constellation at its country's compass direction", () => {
    const bearingOfDir: Record<DirId, number> = { north: 0, east: 90, south: 180, west: 270 };
    for (const id of COUNTRY_IDS) expect(PLACEMENTS[id].bearing).toBe(bearingOfDir[countryDirection(id).id]);
  });
  it('puts each star where the placement formula says, the swing turning China clockwise and Aruba counter-clockwise', () => {
    const toSouth = { china: 1, netherlands: 0, aruba: -1 } as const;
    for (const id of COUNTRY_IDS) {
      const P = PLACEMENTS[id];
      const p = starPositions(id);
      FIGURES[id].stars.forEach(([u, v], k) => {
        const bearing = P.bearing + (u - 0.5) * P.span + toSouth[id] * P.swing * (1 - v) ** 2;
        expect(Math.hypot(p[k * 3], p[k * 3 + 2])).toBeCloseTo(P.radius, 5);
        expect(p[k * 3 + 1]).toBeCloseTo(P.base + v * P.height, 6);
        expect(turn(bearingOf(p[k * 3], p[k * 3 + 2]), deg(bearing))).toBeCloseTo(0, 5);
      });
    }
  });
  it('hands out copies: writing to the positions does not change the next call', () => {
    const first = starPositions('china');
    first.fill(9);
    expect(starPositions('china')[0]).not.toBe(9);
  });
});

describe('pointedAt', () => {
  it('finds the constellation the needle points into, and none between them', () => {
    expect(pointedAt(0)).toBe('netherlands');
    expect(pointedAt(deg(90))).toBe('china');
    expect(pointedAt(deg(-90))).toBe('aruba');
    expect(pointedAt(deg(270))).toBe('aruba');
    expect(pointedAt(deg(359))).toBe('netherlands');
    expect(pointedAt(deg(45))).toBeNull();
    expect(pointedAt(Math.PI)).toBeNull();
  });
  it('has ranges that never overlap', () => {
    const [a, b, c] = COUNTRY_IDS.map(bearingRange);
    const overlaps = (x: readonly number[], y: readonly number[]) => x[0] < y[1] && y[0] < x[1];
    expect(overlaps(a, b) || overlaps(b, c) || overlaps(a, c)).toBe(false);
  });
  it("holds every star's own bearing 10 degrees inside its range, which the aim snaps the needle to", () => {
    for (const id of COUNTRY_IDS) {
      for (const b of starBearings(id)) {
        expect(pointedAt(b)).toBe(id);
        expect(pointedAt(b - deg(9.9))).toBe(id);
        expect(pointedAt(b + deg(9.9))).toBe(id);
      }
    }
  });
  it("makes each range its stars' span widened by 10 degrees each side, as a start in (-PI, PI] and a width", () => {
    for (const id of COUNTRY_IDS) {
      const [from, to] = bearingRange(id);
      expect(from).toBeGreaterThan(-Math.PI);
      expect(from).toBeLessThanOrEqual(Math.PI);
      const offsets = starBearings(id).map((b) => turn(b, deg(PLACEMENTS[id].bearing)));
      expect(turn(from, deg(PLACEMENTS[id].bearing))).toBeCloseTo(Math.min(...offsets) - deg(10), 5);
      expect(to - from).toBeCloseTo(Math.max(...offsets) - Math.min(...offsets) + deg(20), 5);
    }
  });
  it("crosses north with the Netherlands' range: it holds the needle on both sides of 0", () => {
    const [from, to] = bearingRange('netherlands');
    expect(from).toBeLessThan(0);
    expect(to).toBeGreaterThan(0);
    for (const d of [-20, -5, -0.001, 0.001, 5, 20, 340, 355, 365, 380]) expect(pointedAt(deg(d))).toBe('netherlands');
  });
  it('reads a needle on any turn the same, and NaN as pointing at nothing', () => {
    // Away from the ranges' ends, where adding whole turns rounds a needle an ulp either side (the ship's range ends at exactly 25 degrees).
    const ends = COUNTRY_IDS.flatMap(bearingRange);
    for (let d = -180; d <= 180; d += 0.5) {
      const b = deg(d);
      if (ends.some((e) => Math.abs(turn(b, e)) < 1e-9)) continue;
      const here = pointedAt(b);
      for (const k of [-2, -1, 1, 3]) expect(pointedAt(b + k * 2 * Math.PI)).toBe(here);
    }
    expect(pointedAt(Number.NaN)).toBeNull();
  });
  it('leaves the dark between the constellations empty: north-east, south-east, south, south-west and north-west', () => {
    for (const d of [30, 45, 57, 160, 180, -160, -55]) expect(pointedAt(deg(d))).toBeNull();
  });
});
