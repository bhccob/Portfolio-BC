import { describe, expect, it } from 'vitest';
import type { CameraShot } from '~/engine/bob/shots';
import { project } from '~/scene/bob/fit';
import { lightAt } from '~/scene/bob/lightDive';
import { LAND_HIT, makeWorldPath, POWER, type WorldFrame } from '~/scene/bob/worldPath';
import { boardCentre, boardTops, LID_TOP, STACK, stackPlaces } from '~/scene/bob/worldLayout';
import { AREA_STOP, areaStop, areasOnPath, buildChapters, type Chapters, HAND_F, HOME_CHAPTERS, LAND_STOP, pathStart, sheetStart, worldStop } from '~/state/chapters';

type Vec3 = readonly [number, number, number];
type Box = readonly [number, number, number, number];
const DESK = 16 / 10;
const PHONE = 390 / 844;
const C = boardCentre();
const BOARDS = stackPlaces(areasOnPath());
const TOPS = boardTops(BOARDS, 1);

/** The boxes the mock-up framed in: the whole machine's on a laptop and a phone, a board's on a laptop. */
const MACHINE_BOX: Record<'desk' | 'phone', Box> = { desk: [-0.66, 0.66, -0.86, 0.82], phone: [-0.9, 0.9, -0.62, 0.7] };
const BOARD_BOX: Box = [-0.64, 0.64, -0.56, 0.72];
/** The site turns the camera a little where the mock-up shifted its picture, so a box's edge may give this much. */
const GIVE = 0.03;
const inBox = (p: Vec3, shot: CameraShot, aspect: number, box: Box): boolean => {
  const s = project([...p], shot, aspect);
  return s.front && s.x >= box[0] - GIVE && s.x <= box[1] + GIVE && s.y >= box[2] - GIVE && s.y <= box[3] + GIVE;
};

/** A board's rim, top and bottom, and the tops of the projects floating over its sockets. */
function rimOf(board: (typeof BOARDS)[number], top: number): Vec3[] {
  const points: Vec3[] = [];
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2;
    const x = Math.sin(a) * board.radius;
    const z = Math.cos(a) * board.radius;
    points.push([x, top, z], [x, top - STACK.thick, z]);
  }
  for (const s of board.sockets) points.push([s.at[0], top + STACK.hover + 0.9, s.at[1]]);
  return points;
}

/** One path per screen and chapters: each is framed by fit, so made once. */
const paths = new Map<string, ReturnType<typeof makeWorldPath>>();
function pathFor(aspect: number, c: Chapters = HOME_CHAPTERS): ReturnType<typeof makeWorldPath> {
  const key = `${aspect}:${c === HOME_CHAPTERS ? 'home' : c.total}`;
  if (!paths.has(key)) paths.set(key, makeWorldPath(aspect, c));
  return paths.get(key)!;
}
const at = (c: Chapters, aspect: number, place: number): WorldFrame => pathFor(aspect, c).frameAt(place - pathStart(c));
const home = (aspect: number, place: number): WorldFrame => at(HOME_CHAPTERS, aspect, place);
const LAND = HOME_CHAPTERS.units.find((u) => u.id === 'LAND')!;
const landAt = (t: number, aspect = DESK): WorldFrame => home(aspect, LAND.start + t * LAND.length);

describe("the path down the stack: the light lands in the CPU, the stack opens, a stop per board, the look back", () => {
  it("brings the light down into the CPU by the land's hit and keeps it there", () => {
    expect(LAND_HIT).toBe(0.35);
    expect(LID_TOP).toBe(0.2);
    const lid: Vec3 = [C[0], C[1] + 0.2, C[2]];
    const start = landAt(0).light.position;
    const hand = lightAt(HAND_F, DESK).position;
    for (let k = 0; k < 3; k++) expect(start[k]).toBeCloseTo(hand[k]!, 6);
    let last = start[1];
    for (let k = 1; k <= 20; k++) {
      const y = landAt((LAND_HIT * k) / 20).light.position[1];
      expect(y).toBeLessThanOrEqual(last + 1e-9);
      last = y;
    }
    for (const t of [LAND_HIT, 0.5, 0.8, 1]) landAt(t).light.position.forEach((v, k) => expect(v).toBeCloseTo(lid[k]!, 6));
    for (const place of [worldStop(HOME_CHAPTERS), areaStop(HOME_CHAPTERS, 'game'), sheetStart(HOME_CHAPTERS)]) {
      home(DESK, place).light.position.forEach((v, k) => expect(v).toBeCloseTo(lid[k]!, 6));
    }
    // At rest the light's trail stands straight up above it, still.
    const trail = home(DESK, worldStop(HOME_CHAPTERS)).light.trail;
    expect(trail.length).toBeGreaterThan(8);
    for (const point of trail) {
      expect(point.point[0]).toBeCloseTo(lid[0], 6);
      expect(point.point[2]).toBeCloseTo(lid[2], 6);
    }
    expect(trail.at(-1)!.point[1] - lid[1]).toBeGreaterThan(20);
    expect(home(DESK, worldStop(HOME_CHAPTERS)).light.sparks).toEqual([]);
  });

  it("keeps the stack closed until 0.4 of the land and opens it by the world's stop", () => {
    for (const t of [0, 0.2, LAND_HIT, 0.4]) expect(landAt(t).explode, `at ${t}`).toBe(0);
    const middle = landAt(0.55).explode;
    expect(middle).toBeGreaterThan(0);
    expect(middle).toBeLessThan(1);
    let last = 0;
    for (let k = 0; k <= 30; k++) {
      const e = landAt(0.4 + (0.3 * k) / 30).explode;
      expect(e).toBeGreaterThanOrEqual(last);
      last = e;
    }
    expect(landAt(0.7).explode).toBe(1);
    for (const place of [worldStop(HOME_CHAPTERS), areaStop(HOME_CHAPTERS, 'app'), areaStop(HOME_CHAPTERS, 'game'), sheetStart(HOME_CHAPTERS)]) {
      expect(home(DESK, place).explode).toBe(1);
    }
  });

  it('powers the boards from the top down', () => {
    expect(POWER).toEqual([0.35, 0.75]);
    expect(landAt(0.2).power).toBe(0);
    expect(landAt(LAND_HIT).boardPower).toEqual([0, 0, 0, 0]);
    for (let k = 0; k <= 50; k++) {
      const { boardPower } = landAt(k / 50);
      expect(boardPower).toHaveLength(BOARDS.length);
      for (let b = 0; b + 1 < boardPower.length; b++) expect(boardPower[b], `board ${b} at ${k / 50}`).toBeGreaterThanOrEqual(boardPower[b + 1]!);
    }
    // The power board comes on before the last board does.
    const partway = landAt(0.5).boardPower;
    expect(partway[0]).toBeGreaterThan(partway[3]!);
    expect(landAt(0.75).boardPower).toEqual([1, 1, 1, 1]);
    expect(home(DESK, worldStop(HOME_CHAPTERS)).boardPower).toEqual([1, 1, 1, 1]);
    expect(home(DESK, worldStop(HOME_CHAPTERS)).power).toBe(1);
    // The flash: none before the hit, at its peak on it, gone by 0.5.
    expect(landAt(0.3).flash).toBe(0);
    expect(landAt(LAND_HIT + 1e-6).flash).toBeCloseTo(1, 4); // a hair past it: the place sums round the hit itself
    expect(landAt(0.5).flash).toBe(0);
  });

  it("frames the whole machine at the world's stop", () => {
    for (const [aspect, box] of [
      [DESK, MACHINE_BOX.desk],
      [PHONE, MACHINE_BOX.phone]
    ] as const) {
      const path = pathFor(aspect);
      const f = home(aspect, worldStop(HOME_CHAPTERS));
      expect(f.part).toBe('land');
      expect(path.machine.length).toBeGreaterThan(3 * 96);
      for (const p of path.machine) expect(inBox(p, f.shot, aspect, box), `${p.map((v) => v.toFixed(1))} at ${aspect.toFixed(2)}`).toBe(true);
      // From the front and above the machine's middle: 30° on a laptop, 26° on a phone.
      const middle = [C[0], C[1] + (TOPS.at(-1)! - C[1] - 3.4) / 2, C[2]];
      const [dx, dy, dz] = [0, 1, 2].map((k) => f.shot.position[k]! - middle[k]!) as [number, number, number];
      expect(Math.atan2(dy, Math.hypot(dx, dz)) / (Math.PI / 180)).toBeCloseTo(aspect === DESK ? 30 : 26, 0);
      expect(Math.abs(dx)).toBeLessThan(0.5);
      expect(dz).toBeGreaterThan(0);
    }
  });

  it('frames each board from below the board above it', () => {
    areasOnPath().forEach((area, i) => {
      // Under the board above on every screen's shape, the squarer ones too, whose fit stands the camera further out.
      for (const aspect of [DESK, PHONE, 16 / 9, 4 / 3, 1, 3 / 4]) {
        const f = home(aspect, areaStop(HOME_CHAPTERS, area.category));
        expect(f.part).toBe('area');
        expect(f.index).toBe(i);
        const y = f.shot.position[1];
        expect(y, `${area.category} at ${aspect.toFixed(2)}`).toBeLessThan(TOPS[i]! - STACK.thick);
        expect(y, `${area.category} at ${aspect.toFixed(2)}`).toBeGreaterThan(TOPS[i + 1]!);
      }
      const desk = home(DESK, areaStop(HOME_CHAPTERS, area.category));
      for (const p of rimOf(BOARDS[i + 1]!, TOPS[i + 1]!)) expect(inBox(p, desk.shot, DESK, BOARD_BOX), `${area.category} ${p.map((v) => v.toFixed(1))}`).toBe(true);
      // The camera looks at the board from the side its projects face.
      const facing = BOARDS[i + 1]!.facing;
      const angle = Math.atan2(desk.shot.position[0] - C[0], desk.shot.position[2] - C[2]);
      expect(Math.cos(angle - facing)).toBeGreaterThan(0.99);
    });
  });

  it('never takes the camera through a board or the spine', () => {
    for (const aspect of [DESK, PHONE]) {
      const from = worldStop(HOME_CHAPTERS);
      const to = sheetStart(HOME_CHAPTERS);
      for (let k = 0; k <= 200; k++) {
        const [x, y, z] = home(aspect, from + ((to - from) * k) / 200).shot.position;
        const r = Math.hypot(x - C[0], z - C[2]);
        expect(r).toBeGreaterThan(2.2);
        BOARDS.forEach((board, b) => {
          if (y <= TOPS[b]! && y >= TOPS[b]! - STACK.thick) expect(r, `board ${b} at ${k}`).toBeGreaterThan(board.radius);
        });
      }
    }
  });

  it('lights the board in view and steps the others back', () => {
    expect(home(DESK, worldStop(HOME_CHAPTERS)).boardLight).toEqual([1, 1, 1, 1]);
    areasOnPath().forEach((area, i) => {
      const { boardLight, levels } = home(DESK, areaStop(HOME_CHAPTERS, area.category));
      BOARDS.forEach((board, b) => {
        const expected = b === i + 1 ? 1 : b === 0 ? 0.7 : 0.45;
        expect(boardLight[b], `board ${b} at ${area.category}`).toBeCloseTo(expected, 12);
        // A board's projects light as their board does.
        for (const s of board.sockets) expect(levels[s.id], s.id).toBeCloseTo(b === i + 1 ? 1.1 : 0.45, 12);
      });
    });
    expect(home(DESK, sheetStart(HOME_CHAPTERS)).boardLight).toEqual([1, 1, 1, 1]);
  });

  it("lets the names show at the world's stop and at each board's, and a board's caption only at its own", () => {
    expect(landAt(0.5).names).toBe(0);
    expect(home(DESK, worldStop(HOME_CHAPTERS)).names).toBe(1);
    expect(home(DESK, worldStop(HOME_CHAPTERS)).caption).toBeNull();
    areasOnPath().forEach((area, i) => {
      const f = home(DESK, areaStop(HOME_CHAPTERS, area.category));
      expect(f.names).toBe(1);
      expect(f.caption).toEqual({ index: i, opacity: 1 });
      expect(f.dots).toBe(1);
      // Between two stops the camera is on its way: no names.
      const unit = HOME_CHAPTERS.units.find((u) => u.id === 'AREA' && u.category === area.category)!;
      expect(home(DESK, unit.start + 0.35 * unit.length).names).toBe(0);
    });
    expect(home(DESK, sheetStart(HOME_CHAPTERS)).names).toBe(0);
    expect(home(DESK, sheetStart(HOME_CHAPTERS)).caption).toBeNull();
    expect(home(DESK, sheetStart(HOME_CHAPTERS)).dots).toBe(0);
    expect(AREA_STOP).toBe(0.7);
  });

  it("shows the skip button from the world's stop through the look back's", () => {
    const world = worldStop(HOME_CHAPTERS);
    expect(home(DESK, world - 0.05).skip).toBe(false);
    expect(home(DESK, world).skip).toBe(true);
    expect(home(DESK, sheetStart(HOME_CHAPTERS)).skip).toBe(true);
    expect(home(DESK, sheetStart(HOME_CHAPTERS) + 0.1).skip).toBe(false);
  });

  it("keeps the sheet's black and the fog", () => {
    const sheet = sheetStart(HOME_CHAPTERS);
    expect(home(DESK, sheet).black).toBe(0);
    expect(home(DESK, sheet + 0.55).black).toBe(1);
    expect(home(DESK, sheet).part).toBe('sheet');
    for (const place of [worldStop(HOME_CHAPTERS), sheet]) {
      const { near, far } = home(DESK, place).fog;
      expect(near).toBeGreaterThan(10);
      expect(far).toBeGreaterThan(near);
    }
    expect(LAND_STOP).toBe(0.85);
  });

  it('looks back from far and up at the middle of the machine', () => {
    for (const aspect of [DESK, PHONE]) {
      const path = pathFor(aspect);
      const f = home(aspect, sheetStart(HOME_CHAPTERS));
      expect(f.part).toBe('sheet');
      const d = Math.hypot(...([0, 1, 2].map((k) => f.shot.position[k]! - f.shot.target[k]!) as [number, number, number]));
      expect(d).toBeCloseTo(aspect === DESK ? 42 : 66, 6);
      expect((f.shot.position[1] - f.shot.target[1]) / d).toBeCloseTo(Math.sin((16 * Math.PI) / 180), 6);
      for (const p of path.machine) expect(project([...p], f.shot, aspect).front).toBe(true);
    }
  });

  it('five projects: the board with three frames all three', () => {
    const areas = [
      { category: 'app', projects: ['steady', 'porfael', 'jontai-energy'] },
      { category: 'website', projects: ['cookies-clicker'] },
      { category: 'game', projects: ['steady'] }
    ] as never;
    const five = buildChapters({ areas });
    const boards = stackPlaces(areas);
    const tops = boardTops(boards, 1);
    const three = boards[1]!;
    expect(three.sockets).toHaveLength(3);
    const desk = at(five, DESK, areaStop(five, 'app'));
    for (const p of rimOf(three, tops[1]!)) expect(inBox(p, desk.shot, DESK, BOARD_BOX)).toBe(true);
    // On a phone the board's sides run off the screen, but its three projects stand on it.
    const phone = at(five, PHONE, areaStop(five, 'app'));
    for (const s of three.sockets) {
      const middle = project([s.at[0], tops[1]! + STACK.hover + 0.3, s.at[1]], phone.shot, PHONE);
      expect(middle.front).toBe(true);
      expect(Math.abs(middle.x), s.id).toBeLessThanOrEqual(1);
      expect(Math.abs(middle.y), s.id).toBeLessThanOrEqual(1);
    }
  });
});
