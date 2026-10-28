import { describe, expect, it } from 'vitest';
import { projects } from '~/data/projects';
import { lightAt } from '~/scene/bob/lightDive';
import { boardCentre, boardTops, LID_TOP, OBJECT_MIDDLE, objectKind, STACK, stackPlaces } from '~/scene/bob/worldLayout';
import { areasOnPath, HAND_F } from '~/state/chapters';

type Vec3 = readonly [number, number, number];
const flat = (p: Vec3, c: Vec3): number => Math.hypot(p[0] - c[0], p[2] - c[2]);
const DEG = Math.PI / 180;
/** The angle round the stack of a point on a board, the mock-up's way: (x, z) = (sin a, cos a) · r. */
const angleOf = (at: readonly [number, number]): number => Math.atan2(at[0], at[1]);

describe("the stack's places: the power board, a board per category below, sockets on each board's ring", () => {
  it('sizes the stack as the mock-up Bob approved did', () => {
    expect(STACK).toEqual({
      core: 3.8,
      radius: 6.2,
      hole: 1.4,
      gap: 5.6,
      thick: 0.2,
      closed: 0.32,
      ring: 4.4,
      apart: 3.4,
      hover: 0.62,
      scale: 1.9,
      first: -40 * DEG,
      turn: 75 * DEG
    });
    expect(LID_TOP).toBe(0.2);
  });

  it('lays the stack straight below the light at the hand-over, 9 m down', () => {
    const centre = boardCentre();
    const hand = lightAt(HAND_F, 16 / 10).position;
    expect(centre[0]).toBe(0);
    expect(centre[2]).toBe(0);
    expect(centre[1]).toBeCloseTo(hand[1] - 9, 9);
    // The light at the hand-over is within a few centimetres of the stack's axis, on every screen.
    for (const aspect of [16 / 10, 390 / 844]) expect(flat(lightAt(HAND_F, aspect).position, centre)).toBeLessThan(0.06);
  });

  it('puts the power board first, at the board centre, with no hole and no sockets', () => {
    const [power] = stackPlaces(areasOnPath());
    expect(power).toEqual({ index: 0, category: null, top: boardCentre()[1], radius: 3.8, hole: 0, facing: 0, sockets: [] });
  });

  it("gives each category on the way a board below, 5.6 apart, in the categories' order", () => {
    const boards = stackPlaces(areasOnPath());
    expect(boards.map((b) => b.category)).toEqual([null, 'app', 'website', 'game']);
    expect(boards.map((b) => b.index)).toEqual([0, 1, 2, 3]);
    const top = boardCentre()[1];
    for (const [k, b] of boards.entries()) {
      expect(b.top).toBeCloseTo(top - k * 5.6, 9);
      if (k > 0) expect([b.radius, b.hole]).toEqual([6.2, 1.4]);
    }
    expect(boards[1]!.sockets.map((s) => s.id)).toEqual(['steady', 'porfael']);
    expect(boards[2]!.sockets.map((s) => s.id)).toEqual(['jontai-energy']);
    expect(boards[3]!.sockets.map((s) => s.id)).toEqual(['cookies-clicker']);
    // A path with a category left out gets no board for it.
    const list = projects.onPath().filter((p) => p.categoryId !== 'website');
    expect(stackPlaces(areasOnPath(list)).map((b) => b.category)).toEqual([null, 'app', 'game']);
  });

  it('turns each category board 75° further round the stack, the first at -40°', () => {
    const boards = stackPlaces(areasOnPath());
    expect(boards[1]!.facing).toBeCloseTo(-40 * DEG, 12);
    expect(boards[2]!.facing).toBeCloseTo(35 * DEG, 12);
    expect(boards[3]!.facing).toBeCloseTo(110 * DEG, 12);
  });

  it("stands a board's projects on the side it faces, 4.4 out and 3.4 apart along the ring", () => {
    const [, one] = stackPlaces([{ category: 'website', projects: ['jontai-energy'] }]);
    const [socket] = one!.sockets;
    expect(Math.hypot(...socket!.at)).toBeCloseTo(4.4, 12);
    expect(angleOf(socket!.at)).toBeCloseTo(one!.facing, 12);
    // `out` is level, a unit long, the way from the spine through the socket.
    expect(socket!.out[1]).toBe(0);
    expect(socket!.out[0]).toBeCloseTo(Math.sin(one!.facing), 12);
    expect(socket!.out[2]).toBeCloseTo(Math.cos(one!.facing), 12);

    const [, three] = stackPlaces([{ category: 'game', projects: ['steady', 'porfael', 'cookies-clicker'] }]);
    const angles = three!.sockets.map((s) => angleOf(s.at));
    for (let k = 1; k < angles.length; k++) expect((angles[k]! - angles[k - 1]!) * 4.4).toBeCloseTo(3.4, 6);
    // The middle one stands on the side the board faces; the three either side of it.
    expect(angles[1]).toBeCloseTo(three!.facing, 12);
  });

  it("keeps every socket clear of the spine's hole and inside its board", () => {
    const busy = stackPlaces([
      { category: 'app', projects: ['steady', 'porfael', 'jontai-energy'] },
      { category: 'website', projects: ['jontai-energy'] },
      { category: 'game', projects: ['cookies-clicker', 'steady'] }
    ]);
    for (const board of busy.slice(1)) {
      for (const socket of board.sockets) {
        const distance = Math.hypot(...socket.at);
        expect(distance - 1.08, socket.id).toBeGreaterThan(board.hole);
        expect(distance + 1.08, socket.id).toBeLessThan(board.radius);
      }
    }
  });

  it('stacks the boards 0.32 apart closed and at their places open', () => {
    const boards = stackPlaces(areasOnPath());
    const top0 = boards[0]!.top;
    const closed = boardTops(boards, 0);
    const open = boardTops(boards, 1);
    const half = boardTops(boards, 0.5);
    for (const [k, b] of boards.entries()) {
      expect(closed[k]).toBeCloseTo(top0 - k * 0.52, 9);
      expect(open[k]).toBeCloseTo(b.top, 9);
      expect(half[k]).toBeLessThanOrEqual(Math.max(closed[k]!, open[k]!));
      expect(half[k]).toBeGreaterThanOrEqual(Math.min(closed[k]!, open[k]!));
    }
    // The power board stays where it is; the boards below it come down.
    expect(half[0]).toBe(top0);
    expect(half[3]).toBeLessThan(closed[3]!);
    expect(half[3]).toBeGreaterThan(open[3]!);
  });

  it('gives Steady, Porfael, Jontai Energy and Cookies Clicker their objects, any other a plain chip', () => {
    expect(objectKind('steady')).toBe('streak');
    expect(objectKind('porfael')).toBe('portfolio');
    expect(objectKind('jontai-energy')).toBe('solar');
    expect(objectKind('cookies-clicker')).toBe('crystal');
    expect(objectKind('some-later-project' as never)).toBe('chip');
    expect(OBJECT_MIDDLE).toMatchObject({ streak: 0.2, portfolio: 0.3 });
    expect(OBJECT_MIDDLE).not.toHaveProperty('lock-chip');
  });
});
