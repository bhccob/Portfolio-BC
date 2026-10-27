import { describe, expect, it } from 'vitest';
import { OFF_PATH_SIDE, offPathPlaces } from '~/scene/bob/offPath';

type Vec3 = [number, number, number];

/** A straight way of `n` points a metre apart, down -z from the origin. */
const straight = (n: number): Vec3[] => Array.from({ length: n }, (_, k): Vec3 => [0, 0, -k]);

describe("offPathPlaces: the projects off the way, as small lights beside the look back's trail", () => {
  it('places them at even steps along the way, 0.9 m to its side, alternating sides', () => {
    expect(OFF_PATH_SIDE).toBe(0.9);
    const places = offPathPlaces(straight(40), 3); // 39 m of way
    expect(places).toHaveLength(3);
    expect(places.map((p) => -p[2])).toEqual([9.75, 19.5, 29.25].map((x) => expect.closeTo(x, 9)));
    expect(places.map((p) => Math.abs(p[0]))).toEqual([0.9, 0.9, 0.9].map((x) => expect.closeTo(x, 9)));
    expect(places.map((p) => p[1])).toEqual([0, 0, 0]);
    expect(Math.sign(places[0]![0])).toBe(-Math.sign(places[1]![0]));
    expect(Math.sign(places[1]![0])).toBe(-Math.sign(places[2]![0]));
  });

  it('places none for no projects, or with no way to place them on', () => {
    expect(offPathPlaces(straight(40), 0)).toEqual([]);
    expect(offPathPlaces([], 2)).toEqual([]);
    expect(offPathPlaces([[0, 0, 0]], 2)).toEqual([]);
  });

  it('follows a way that bends', () => {
    const bent: Vec3[] = [
      [0, 0, 0],
      [0, 0, -10],
      [10, 0, -10]
    ];
    const [one] = offPathPlaces(bent, 1); // half way, 10 m along: the corner
    expect(Math.hypot(one![0] - 0, one![2] + 10)).toBeCloseTo(0.9, 9);
  });
});
