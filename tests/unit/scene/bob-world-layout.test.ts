import { describe, expect, it } from 'vitest';
import { projects } from '~/data/projects';
import { lightAt } from '~/scene/bob/lightDive';
import { AREA_ANGLE, AREA_RING, BOARD, boardCentre, objectKind, worldPlaces } from '~/scene/bob/worldLayout';
import { areasOnPath, HAND_F } from '~/state/chapters';

type Vec3 = readonly [number, number, number];
const flat = (p: Vec3, c: Vec3): number => Math.hypot(p[0] - c[0], p[2] - c[2]);

describe("the world's places: the board below the fall, an area per category, a pad per project", () => {
  it('lays the board level, straight below the light at the hand-over, 9 m down', () => {
    expect(BOARD).toEqual({ radius: 4, drop: 9, hover: 0.5, apart: 1.3, turn: 0.5 });
    const centre = boardCentre();
    const hand = lightAt(HAND_F, 16 / 10).position;
    expect(centre[0]).toBe(0);
    expect(centre[2]).toBe(0);
    expect(centre[1]).toBeCloseTo(hand[1] - 9, 9);
    // The light at the hand-over is within a few centimetres of the board's axis, on every screen.
    for (const aspect of [16 / 10, 390 / 844]) expect(flat(lightAt(HAND_F, aspect).position, centre)).toBeLessThan(0.06);
  });

  it('puts each category\'s area where the mock-up did', () => {
    expect(AREA_RING).toBe(2.65);
    expect(AREA_ANGLE['app']).toBeCloseTo(Math.atan2(0.75, -2.55), 12);
    expect(AREA_ANGLE['website']).toBeCloseTo(Math.atan2(0.75, 2.55), 12);
    expect(AREA_ANGLE.game).toBeCloseTo(-Math.PI / 2, 12);
    const centre = boardCentre();
    const [secure, front, oscillator] = worldPlaces(areasOnPath());
    // Seen from the front (+z), the apps' area is left, the websites' right, game development's behind.
    expect(secure!.centre[0]).toBeLessThan(centre[0] - 2);
    expect(front!.centre[0]).toBeGreaterThan(centre[0] + 2);
    expect(oscillator!.centre[2]).toBeLessThan(centre[2] - 2.5);
    for (const area of [secure!, front!, oscillator!]) {
      expect(flat(area.centre, centre)).toBeCloseTo(AREA_RING, 9);
      expect(area.centre[1]).toBe(centre[1]);
    }
  });

  it("groups the projects on the way by category, in the categories' order", () => {
    expect(areasOnPath()).toEqual([
      { category: 'app', projects: ['steady', 'porfael'] },
      { category: 'website', projects: ['jontai-energy'] },
      { category: 'game', projects: ['cookies-clicker'] }
    ]);
    const list = projects.onPath();
    const reversed = [...list].reverse();
    expect(areasOnPath(reversed).map((a) => a.category)).toEqual(['app', 'website', 'game']);
    expect(areasOnPath(list.filter((p) => p.categoryId !== 'website')).map((a) => a.category)).toEqual(['app', 'game']);
  });

  it("stands two projects of one category 1.3 m apart on the area's ring, both facing out", () => {
    const [area] = worldPlaces([{ category: 'game', projects: ['cookies-clicker', 'steady'] }]);
    const centre = boardCentre();
    const [a, b] = area!.projects;
    expect(Math.hypot(a!.pad[0] - b!.pad[0], a!.pad[2] - b!.pad[2])).toBeCloseTo(2 * AREA_RING * Math.sin(BOARD.apart / AREA_RING / 2), 9);
    for (const p of [a!, b!]) {
      expect(flat(p.pad, centre)).toBeCloseTo(AREA_RING, 9);
      expect(p.pad[1]).toBe(centre[1]);
      // `out` is level, a unit long, and points from the board's centre through the pad.
      expect(p.out[1]).toBe(0);
      expect(Math.hypot(...p.out)).toBeCloseTo(1, 12);
      expect(p.out[0] * (p.pad[0] - centre[0]) + p.out[2] * (p.pad[2] - centre[2])).toBeCloseTo(AREA_RING, 9);
    }
    // The two stand either side of the area's middle.
    expect((a!.pad[0] + b!.pad[0]) / 2).toBeCloseTo(area!.centre[0] * Math.cos(BOARD.apart / AREA_RING / 2), 9);
  });

  it('gives Jontai Energy and Cookies Clicker their objects, any other a plain chip (Steady and Porfael until theirs come)', () => {
    expect(objectKind('steady')).toBe('chip');
    expect(objectKind('porfael')).toBe('chip');
    expect(objectKind('jontai-energy')).toBe('solar');
    expect(objectKind('cookies-clicker')).toBe('crystal');
    expect(objectKind('some-later-project' as never)).toBe('chip');
  });
});
