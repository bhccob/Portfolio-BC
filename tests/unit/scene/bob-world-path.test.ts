import { describe, expect, it } from 'vitest';
import type { CameraShot } from '~/engine/bob/shots';
import { project } from '~/scene/bob/fit';
import { lightAt } from '~/scene/bob/lightDive';
import { RING_MARKS } from '~/data/qa';
import { RING, ringTurnFor } from '~/scene/bob/qaRing';
import { EXPLODE, FLASH_GONE, LAND_HIT, LOOK_BOX, makeWorldPath, NAMES_IN, POWER, TOWER_ZOOM, type WorldFrame } from '~/scene/bob/worldPath';
import { boardCentre, boardTops, LID_TOP, STACK, stackPlaces } from '~/scene/bob/worldLayout';
import { AREA_STOP, areaStop, areasOnPath, buildChapters, type Chapters, HAND_F, HOME_CHAPTERS, LAND_STOP, pathStart, placeOfFrame, lookStop, qaStop, scrollEnd, WORLD_LAYOUT, worldStop } from '~/state/chapters';

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
/**
 * The same path with every view of the tower where its fit puts it, before it is brought `TOWER_ZOOM` nearer: the
 * mock-up's framings, which the boxes below hold.
 */
const fits = new Map<string, ReturnType<typeof makeWorldPath>>();
function fitFor(aspect: number, c: Chapters = HOME_CHAPTERS): ReturnType<typeof makeWorldPath> {
  const key = `${aspect}:${c === HOME_CHAPTERS ? 'home' : c.total}`;
  if (!fits.has(key)) fits.set(key, makeWorldPath(aspect, c, { zoom: 1 }));
  return fits.get(key)!;
}
const home = (aspect: number, place: number): WorldFrame => at(HOME_CHAPTERS, aspect, place);
const LAND = HOME_CHAPTERS.units.find((u) => u.id === 'LAND')!;
const landAt = (t: number, aspect = DESK): WorldFrame => home(aspect, LAND.start + t * LAND.length);
/** The place in the land `units` of scroll after the light's hit on the CPU's lid. */
const hit = (units: number): number => LAND_HIT + units / WORLD_LAYOUT.land;
const distance = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// Bob (2026-10-29): "the light drops down too fast to the project make it a bit slower", the drop into the stack (not
// the fall past the facts): twice the scroll, eased into the lid.
describe('the drop into the stack', () => {
  it('drops into the stack over twice the scroll, with 2.2 units after the hit for the power-on', () => {
    expect(LAND_HIT * WORLD_LAYOUT.land).toBeCloseTo(1.26, 9);
    expect(WORLD_LAYOUT.land).toBeCloseTo(3.46, 9);
    expect(LAND.length).toBeCloseTo(3.46, 9);
  });

  it('falls steadily and settles into the lid', () => {
    const n = 60;
    const ys = Array.from({ length: n + 1 }, (_, k) => landAt((LAND_HIT * k) / n).light.position[1]);
    for (let k = 1; k <= n; k++) expect(ys[k]!, `step ${k}`).toBeLessThanOrEqual(ys[k - 1]! + 1e-9);
    const speeds = ys.slice(1).map((y, k) => ys[k]! - y);
    const most = Math.max(...speeds);
    // Its last tenth slow: at most 0.6 of its greatest.
    for (const v of speeds.slice(-n / 10)) expect(v).toBeLessThanOrEqual(0.6 * most + 1e-12);
    // At the hand-over it goes on at the fall's own speed (per unit of scroll), so nothing jolts there.
    const fall = (lightAt(HAND_F - 1, DESK).position[1] - lightAt(HAND_F, DESK).position[1]) / (placeOfFrame(HAND_F) - placeOfFrame(HAND_F - 1));
    const tiny = 1e-5;
    const first = (ys[0]! - landAt(tiny).light.position[1]) / (tiny * LAND.length);
    expect(Math.abs(first - fall) / fall).toBeLessThan(0.05);
  });
});

// Bob (2026-10-30): "when the light falls and reaches the tower make it so when it reach the cpu chip it slowqly powers
// (light on) the tower", then "it then slowly power and lights up the tower whille slowly zooming out" (the mock-up he
// chose, .superpowers/power-on-review): the tower dark until the light is in the CPU, then lit board by board from the
// top down while the camera slowly pulls back to the whole machine, over about twice the scroll it had.
describe('the slow power-on', () => {
  it('places each moment after the hit', () => {
    const want: [number, number][] = [
      [POWER[0], 0.05],
      [POWER[1], 1.65],
      [EXPLODE[0], 0.45],
      [EXPLODE[1], 1.5],
      [FLASH_GONE, 0.4],
      [NAMES_IN, 1.65],
      [LAND_STOP, 1.9]
    ];
    for (const [now, units] of want) expect((now - LAND_HIT) * WORLD_LAYOUT.land, `${units}`).toBeCloseTo(units, 9);
  });

  it('runs the power over 1.6 units of scroll, about twice its 0.72', () => {
    expect((POWER[1] - POWER[0]) * WORLD_LAYOUT.land).toBeCloseTo(1.6, 9);
  });

  it('keeps the whole tower dark until the light is in the CPU', () => {
    for (const t of [0, 0.2, LAND_HIT * 0.9, LAND_HIT, hit(0.05)]) {
      const f = landAt(t);
      expect(f.power, `at ${t}`).toBe(0);
      expect(f.boardPower, `at ${t}`).toEqual([0, 0, 0, 0]);
      expect(f.rings.level, `at ${t}`).toBe(0);
    }
  });

  it('lights the tower board by board from the top down, each as the one above is half lit', () => {
    const n = 800;
    const firstOn: number[] = [];
    let last = [0, 0, 0, 0];
    for (let k = 0; k <= n; k++) {
      const { boardPower } = landAt(hit(0.05 + (1.6 * k) / n));
      boardPower.forEach((p, b) => {
        expect(p, `board ${b} at ${k}`).toBeGreaterThanOrEqual(last[b]!);
        if (p > 0 && firstOn[b] === undefined) {
          firstOn[b] = k;
          if (b > 0) expect(boardPower[b - 1]!, `board ${b - 1} as board ${b} comes on`).toBeGreaterThan(0.48);
        }
      });
      last = boardPower;
    }
    expect(firstOn).toHaveLength(4);
    for (let b = 1; b < 4; b++) expect(firstOn[b]!).toBeGreaterThan(firstOn[b - 1]!);
    expect(landAt(POWER[1]).boardPower).toEqual([1, 1, 1, 1]);
  });

  it('pulls the camera back steadily from the light in the CPU to the whole machine while the power runs', () => {
    const lid: Vec3 = [C[0], C[1] + LID_TOP, C[2]];
    const away = (t: number): number => distance(landAt(t).shot.position, lid);
    let last = away(LAND_HIT);
    for (let k = 1; k <= 60; k++) {
      const d = away(hit((1.9 * k) / 60));
      expect(d, `at ${k}`).toBeGreaterThan(last);
      last = d;
    }
    // Still on its way out while the boards light: neither near nor at rest at the power's middle, nor yet at rest when
    // the last board is lit.
    const start = away(LAND_HIT);
    const end = away(LAND_STOP);
    const middle = away((POWER[0] + POWER[1]) / 2);
    expect(middle).toBeGreaterThan(start + 0.25 * (end - start));
    expect(middle).toBeLessThan(start + 0.75 * (end - start));
    expect(away(POWER[1])).toBeLessThan(end);
  });
});

// Bob (2026-10-30): "can the tower be a bit zoomed in in general?", and, shown 12% and 25% nearer, "25% closer": every
// view of the tower, on every screen, a quarter nearer than its fit.
describe('the tower 25% nearer', () => {
  /** Every view of the tower: the world's stop, each board's, the look back's and the ring's. */
  const shotsOf = (path: ReturnType<typeof makeWorldPath>): CameraShot[] => [path.worldShot, ...areasOnPath().map((_, i) => path.areaShot(i)), path.lookShot, path.ringShot];

  it('stands every view of the tower 1/1.25 as far as its fit, looking the same way through the same field', () => {
    expect(TOWER_ZOOM).toBe(1.25);
    for (const aspect of [DESK, PHONE, 16 / 9, 4 / 3]) {
      const near = shotsOf(pathFor(aspect));
      const fit = shotsOf(fitFor(aspect));
      near.forEach((shot, k) => {
        const a = [0, 1, 2].map((j) => shot.position[j]! - shot.target[j]!) as [number, number, number];
        const b = [0, 1, 2].map((j) => fit[k]!.position[j]! - fit[k]!.target[j]!) as [number, number, number];
        const la = Math.hypot(...a);
        const lb = Math.hypot(...b);
        expect(la, `shot ${k} at ${aspect.toFixed(2)}`).toBeCloseTo(lb / 1.25, 6);
        for (let j = 0; j < 3; j++) expect(a[j]! / la, `shot ${k} at ${aspect.toFixed(2)}`).toBeCloseTo(b[j]! / lb, 9);
        expect(shot.fov).toBe(fit[k]!.fov);
      });
    }
  });

  it("shows the machine bigger at the world's stop and the look back", () => {
    for (const aspect of [DESK, PHONE]) {
      const path = pathFor(aspect);
      const span = (shot: CameraShot): number => {
        const ys = path.machine.map((p) => project([...p], shot, aspect).y);
        return Math.max(...ys) - Math.min(...ys);
      };
      expect(span(path.worldShot)).toBeGreaterThan(1.2 * span(fitFor(aspect).worldShot));
      expect(span(path.lookShot)).toBeGreaterThan(1.2 * span(fitFor(aspect).lookShot));
    }
  });

  it("keeps the light in the CPU on the screen at the world's stop", () => {
    for (const aspect of [DESK, PHONE]) {
      const lid = project([C[0], C[1] + LID_TOP, C[2]], pathFor(aspect).worldShot, aspect);
      expect(lid.front).toBe(true);
      expect(Math.abs(lid.x)).toBeLessThan(1);
      expect(Math.abs(lid.y)).toBeLessThan(1);
    }
  });
});

describe("the path down the stack: the light lands in the CPU, the stack opens, a stop per board, the look back", () => {
  it("brings the light down into the CPU by the land's hit and keeps it there", () => {
    expect(LAND_HIT).toBeCloseTo(1.26 / 3.46, 12);
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
    for (const t of [LAND_HIT, hit(0.5), hit(1.2), 1]) landAt(t).light.position.forEach((v, k) => expect(v).toBeCloseTo(lid[k]!, 6));
    for (const place of [worldStop(HOME_CHAPTERS), areaStop(HOME_CHAPTERS, 'game'), lookStop(HOME_CHAPTERS)]) {
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
  });

  it("keeps the stack closed until 0.45 units after the hit and opens it by the world's stop", () => {
    // The stack starts opening on hit(0.45) itself: a float a hair over it there.
    for (const t of [0, 0.2, LAND_HIT, hit(0.45)]) expect(landAt(t).explode, `at ${t}`).toBeCloseTo(0, 12);
    const middle = landAt(hit(0.95)).explode;
    expect(middle).toBeGreaterThan(0);
    expect(middle).toBeLessThan(1);
    let last = 0;
    for (let k = 0; k <= 30; k++) {
      const e = landAt(hit(0.45 + (1.05 * k) / 30)).explode;
      expect(e).toBeGreaterThanOrEqual(last);
      last = e;
    }
    expect(landAt(hit(1.5)).explode).toBe(1);
    for (const place of [worldStop(HOME_CHAPTERS), areaStop(HOME_CHAPTERS, 'app'), areaStop(HOME_CHAPTERS, 'game'), lookStop(HOME_CHAPTERS)]) {
      expect(home(DESK, place).explode).toBe(1);
    }
  });

  it('powers the boards from the top down', () => {
    expect(POWER).toEqual([expect.closeTo(hit(0.05), 12), expect.closeTo(hit(1.65), 12)]);
    expect(landAt(0.2).power).toBe(0);
    expect(landAt(LAND_HIT).boardPower).toEqual([0, 0, 0, 0]);
    for (let k = 0; k <= 50; k++) {
      const { boardPower } = landAt(k / 50);
      expect(boardPower).toHaveLength(BOARDS.length);
      for (let b = 0; b + 1 < boardPower.length; b++) expect(boardPower[b], `board ${b} at ${k / 50}`).toBeGreaterThanOrEqual(boardPower[b + 1]!);
    }
    // The power board comes on before the last board does.
    const partway = landAt(hit(0.6)).boardPower;
    expect(partway[0]).toBeGreaterThan(partway[3]!);
    expect(landAt(hit(1.65)).boardPower).toEqual([1, 1, 1, 1]);
    expect(home(DESK, worldStop(HOME_CHAPTERS)).boardPower).toEqual([1, 1, 1, 1]);
    expect(home(DESK, worldStop(HOME_CHAPTERS)).power).toBe(1);
    // The flash: none before the hit, at its peak on it, gone 0.4 units after it.
    expect(landAt(LAND_HIT - 0.01).flash).toBe(0);
    expect(landAt(LAND_HIT + 1e-6).flash).toBeCloseTo(1, 4); // a hair past it: the place sums round the hit itself
    expect(landAt(hit(0.4)).flash).toBe(0);
  });

  it("frames the whole machine at the world's stop", () => {
    for (const [aspect, box] of [
      [DESK, MACHINE_BOX.desk],
      [PHONE, MACHINE_BOX.phone]
    ] as const) {
      const path = pathFor(aspect);
      const f = home(aspect, worldStop(HOME_CHAPTERS));
      expect(f.part).toBe('land');
      expect(f.shot).toEqual(path.worldShot);
      expect(path.machine.length).toBeGreaterThan(3 * 96);
      const fit = fitFor(aspect).worldShot;
      for (const p of path.machine) expect(inBox(p, fit, aspect, box), `${p.map((v) => v.toFixed(1))} at ${aspect.toFixed(2)}`).toBe(true);
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
      for (const p of rimOf(BOARDS[i + 1]!, TOPS[i + 1]!)) expect(inBox(p, fitFor(DESK).areaShot(i), DESK, BOARD_BOX), `${area.category} ${p.map((v) => v.toFixed(1))}`).toBe(true);
      // The camera looks at the board from the side its projects face.
      const facing = BOARDS[i + 1]!.facing;
      const angle = Math.atan2(desk.shot.position[0] - C[0], desk.shot.position[2] - C[2]);
      expect(Math.cos(angle - facing)).toBeGreaterThan(0.99);
    });
  });

  it('never takes the camera through a board or the spine', () => {
    for (const aspect of [DESK, PHONE]) {
      const from = worldStop(HOME_CHAPTERS);
      const to = lookStop(HOME_CHAPTERS);
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
    expect(home(DESK, lookStop(HOME_CHAPTERS)).boardLight).toEqual([1, 1, 1, 1]);
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
    expect(home(DESK, lookStop(HOME_CHAPTERS)).names).toBe(0);
    expect(home(DESK, lookStop(HOME_CHAPTERS)).caption).toBeNull();
    expect(home(DESK, lookStop(HOME_CHAPTERS)).dots).toBe(0);
    expect(AREA_STOP).toBe(0.7);
  });

  it("shows the skip button from the world's stop through the look back's", () => {
    const world = worldStop(HOME_CHAPTERS);
    expect(home(DESK, world - 0.05).skip).toBe(false);
    expect(home(DESK, world).skip).toBe(true);
    expect(home(DESK, lookStop(HOME_CHAPTERS)).skip).toBe(true);
    expect(home(DESK, lookStop(HOME_CHAPTERS) + 0.1).skip).toBe(false);
  });

  it('closes the stack over the way into the Q&A, with no dark, and keeps the fog', () => {
    const look = lookStop(HOME_CHAPTERS);
    const first = qaStop(HOME_CHAPTERS, 0);
    const start = home(DESK, look);
    expect(start.part).toBe('qa');
    expect([start.explode, start.qa!.close, start.qa!.place]).toEqual([1, 0, -1]);
    const half = home(DESK, look + 0.5);
    expect(half.explode).toBeGreaterThan(0);
    expect(half.explode).toBeLessThan(1);
    expect(half.explode).toBeCloseTo(1 - half.qa!.close, 12);
    const closed = home(DESK, first);
    expect([closed.explode, closed.qa!.close, closed.qa!.place]).toEqual([0, 1, 0]);
    for (const level of Object.values(closed.levels)) expect(level).toBe(0);
    for (let k = 0; k <= 20; k++) {
      const f = home(DESK, look + (k / 20) * (scrollEnd(HOME_CHAPTERS) - look));
      expect(f.black, `at ${k}`).toBe(0);
      expect([f.names, f.caption, f.dots, f.sky], `at ${k}`).toEqual([0, null, 0, false]);
      if (k > 0) expect(f.skip, `at ${k}`).toBe(false);
    }
    for (const place of [worldStop(HOME_CHAPTERS), look, first]) {
      const { near, far } = home(DESK, place).fog;
      expect(near).toBeGreaterThan(10);
      expect(far).toBeGreaterThan(near);
    }
    expect(LAND_STOP).toBeCloseTo((1.26 + 1.9) / 3.46, 12);
  });

  it('looks back up at the whole machine framed, not far out (Bob, 2026-10-29: "it zooms out too much")', () => {
    for (const aspect of [DESK, PHONE]) {
      const path = pathFor(aspect);
      const f = home(aspect, lookStop(HOME_CHAPTERS));
      expect(f.part).toBe('qa');
      const d = Math.hypot(...([0, 1, 2].map((k) => f.shot.position[k]! - f.shot.target[k]!) as [number, number, number]));
      expect((f.shot.position[1] - f.shot.target[1]) / d).toBeCloseTo(Math.sin((16 * Math.PI) / 180), 6);
      // The fit: the whole machine inside the look back's box, and filling it, the camera no further out than it needs.
      expect(f.shot).toEqual(path.lookShot);
      const box = LOOK_BOX[aspect === DESK ? 'desk' : 'phone'];
      const seen = path.machine.map((p) => project([...p], fitFor(aspect).lookShot, aspect));
      for (const p of seen) {
        expect(p.front).toBe(true);
        expect(Math.abs(p.x)).toBeLessThanOrEqual(box + 1e-6);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(box + 1e-6);
      }
      expect(Math.max(...seen.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y))))).toBeGreaterThan(box - 0.02);
      // Nearer than the old 42 m (66 m on a phone).
      expect(d).toBeLessThan(aspect === DESK ? 42 : 66);
    }
  });

  it("holds the ring's view through the questions", () => {
    for (const aspect of [DESK, PHONE]) {
      const path = pathFor(aspect);
      for (let k = 0; k < RING_MARKS; k++) expect(home(aspect, qaStop(HOME_CHAPTERS, k)).shot, `mark ${k}`).toEqual(path.ringShot);
      // From the look back's view to the ring's over the way in, eased: half way it is between them.
      const half = home(aspect, lookStop(HOME_CHAPTERS) + 0.5).shot;
      expect(half.position).not.toEqual(path.lookShot.position);
      expect(half.position).not.toEqual(path.ringShot.position);
    }
  });

  it('frames the ring per screen shape', () => {
    for (const aspect of [DESK, PHONE]) {
      const path = pathFor(aspect);
      const f = home(aspect, qaStop(HOME_CHAPTERS, 2));
      const shot = path.ringShot;
      // The mock-up's place: out from its aim (under the closed ring) at its elevation and distance (the fit's; the
      // site's `TOWER_ZOOM` nearer); the shot looks a little aside of that aim, so the ring stands where the mock-up has it.
      const aim: Vec3 = [C[0], f.ring.centre[1] - (aspect === DESK ? 1.6 : 0.6), C[2]];
      const fit = fitFor(aspect).ringShot;
      const off = [0, 1, 2].map((k) => fit.position[k]! - aim[k]!) as [number, number, number];
      const d = Math.hypot(...off);
      expect(d).toBeCloseTo(aspect === DESK ? 23 : 31, 9);
      expect(off[1] / d).toBeCloseTo(Math.sin(((aspect === DESK ? 15 : 20) * Math.PI) / 180), 9);
      expect(shot.fov).toBe(aspect === DESK ? 38 : 58);
      // The mark that faces the camera is on the screen, and so is the closed stack's lid.
      const r = RING.closedRadius;
      const front: Vec3 = [C[0] + Math.sin(RING.azimuth) * r, f.ring.centre[1], C[2] + Math.cos(RING.azimuth) * r];
      for (const p of [front, [C[0], TOPS[0]! + LID_TOP, C[2]] as Vec3]) {
        const s = project([...p], shot, aspect);
        expect(s.front).toBe(true);
        expect(Math.abs(s.x)).toBeLessThan(1);
        expect(Math.abs(s.y)).toBeLessThan(1);
      }
    }
  });

  it('brings the ring in over the look back, and draws it in and up round the closing stack', () => {
    const lastArea = HOME_CHAPTERS.units.filter((u) => u.id === 'AREA').at(-1)!;
    expect(home(DESK, lastArea.start + AREA_STOP * lastArea.length).ring.level).toBe(0);
    const look = lookStop(HOME_CHAPTERS);
    const open = home(DESK, look).ring;
    expect([open.level, open.scale]).toEqual([1, 1]);
    expect(open.turn).toBeCloseTo(ringTurnFor(-1, RING_MARKS), 12);
    const closed = home(DESK, qaStop(HOME_CHAPTERS, 0)).ring;
    expect(closed.scale).toBeCloseTo(RING.closedRadius / RING.radius, 12);
    const shut = boardTops(BOARDS, 0);
    expect(closed.centre[1]).toBeCloseTo((shut[0]! + shut.at(-1)!) / 2 - RING.below, 9);
    expect([closed.centre[0], closed.centre[2]]).toEqual([C[0], C[2]]);
    for (let k = 0; k < RING_MARKS; k++) {
      const f = home(DESK, qaStop(HOME_CHAPTERS, k));
      expect(f.ring.level).toBe(1);
      expect(f.ring.turn, `mark ${k}`).toBeCloseTo(ringTurnFor(k, RING_MARKS), 12);
      expect(f.qa!.place).toBeCloseTo(k, 12);
    }
    expect(home(DESK, scrollEnd(HOME_CHAPTERS)).qa!.lit).toBe(1);
    expect(home(DESK, qaStop(HOME_CHAPTERS, 2)).qa!.lit).toBe(0);
  });

  it('steps the gyroscope back at a board and in the Q&A', () => {
    expect(home(DESK, worldStop(HOME_CHAPTERS)).rings).toEqual({ level: 1, focus: 1 });
    expect(home(DESK, areaStop(HOME_CHAPTERS, 'app')).rings.focus).toBeCloseTo(0.42, 9);
    expect(home(DESK, lookStop(HOME_CHAPTERS)).rings.focus).toBeCloseTo(1, 9);
    expect(home(DESK, qaStop(HOME_CHAPTERS, 2)).rings.focus).toBeCloseTo(0.42, 9);
    // Dark until the power comes: before the land's power the rings are not lit.
    expect(landAt(0.2).rings.level).toBe(0);
  });

  it('five projects: the board with three frames all three', () => {
    const areas = [
      { category: 'app', projects: ['steady', 'portle', 'jontai-energy'] },
      { category: 'website', projects: ['cookies-clicker'] },
      { category: 'game', projects: ['steady'] }
    ] as never;
    const five = buildChapters({ areas });
    const boards = stackPlaces(areas);
    const tops = boardTops(boards, 1);
    const three = boards[1]!;
    expect(three.sockets).toHaveLength(3);
    for (const p of rimOf(three, tops[1]!)) expect(inBox(p, fitFor(DESK, five).areaShot(0), DESK, BOARD_BOX)).toBe(true);
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
