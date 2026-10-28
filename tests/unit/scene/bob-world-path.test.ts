import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import type { ProjectId } from '~/data/projects';
import { applyCameraShot, type CameraShot } from '~/engine/bob/shots';
import { lightAt } from '~/scene/bob/lightDive';
import { LAND_HIT, makeWorldPath, POWER, type WorldFrame } from '~/scene/bob/worldPath';
import { BOARD, boardCentre, LID_TOP, OBJECT_MIDDLE, objectKind, worldPlaces } from '~/scene/bob/worldLayout';
import { AREA_STOP, areaStop, areasOnPath, buildChapters, type Chapters, HAND_F, HOME_CHAPTERS, LAND_STOP, pathStart, sheetStart, worldStop } from '~/state/chapters';

type Vec3 = readonly [number, number, number];
const DESK = 16 / 10;
const PHONE = 390 / 844;
const C = boardCentre();

/** Where `p` falls on the screen for `shot`: x and y as shares of the half-width and half-height, and whether it is in front. */
function onScreen(p: Vec3, shot: CameraShot, aspect: number): { x: number; y: number; front: boolean } {
  const camera = new PerspectiveCamera();
  applyCameraShot(camera, shot, aspect);
  camera.updateMatrixWorld();
  const v = new Vector3(...p);
  const front = v.clone().applyMatrix4(camera.matrixWorldInverse).z < 0;
  v.project(camera);
  return { x: v.x, y: v.y, front };
}
const inFrame = (p: Vec3, shot: CameraShot, aspect: number, margin = 0.08): boolean => {
  const s = onScreen(p, shot, aspect);
  return s.front && Math.abs(s.x) <= 1 - margin && Math.abs(s.y) <= 1 - margin;
};

/** A project's object's middle and the top its name's line ends at, in the world. */
function objectPoints(id: ProjectId, pad: Vec3): Vec3[] {
  const y = pad[1] + BOARD.hover;
  return [
    [pad[0], y + OBJECT_MIDDLE[objectKind(id)], pad[2]],
    [pad[0], y + 0.8, pad[2]]
  ];
}

const at = (c: Chapters, aspect: number, place: number): WorldFrame => makeWorldPath(aspect, c).frameAt(place - pathStart(c));
const home = (aspect: number, place: number): WorldFrame => at(HOME_CHAPTERS, aspect, place);
const LAND = HOME_CHAPTERS.units.find((u) => u.id === 'LAND')!;
const landAt = (t: number, aspect = DESK): WorldFrame => home(aspect, LAND.start + t * LAND.length);

describe("the world's path: the light lands in the CPU, the world, an area per category, the look back", () => {
  it("brings the light down into the CPU by the land's hit and keeps it there", () => {
    expect(LAND_HIT).toBe(0.35);
    const lid: Vec3 = [C[0], C[1] + LID_TOP, C[2]];
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

  it('powers the board from the middle out after the hit', () => {
    expect(POWER).toEqual([0.35, 0.75]);
    expect(landAt(0.2).power).toBe(0);
    expect(landAt(LAND_HIT).power).toBe(0);
    let last = 0;
    for (let k = 0; k <= 20; k++) {
      const p = landAt(LAND_HIT + ((0.75 - LAND_HIT) * k) / 20).power;
      expect(p).toBeGreaterThanOrEqual(last);
      last = p;
    }
    expect(landAt(0.75).power).toBe(1);
    expect(home(DESK, worldStop(HOME_CHAPTERS)).power).toBe(1);
    // The flash: none before the hit, at its peak on it, gone by 0.5.
    expect(landAt(0.3).flash).toBe(0);
    expect(landAt(LAND_HIT + 1e-6).flash).toBeCloseTo(1, 4); // a hair past it: the place sums round the hit itself
    expect(landAt(0.5).flash).toBe(0);
    // Each project comes in over the power's last third.
    expect(landAt(0.6).levels.steady).toBe(0);
    expect(landAt(0.75).levels.steady).toBe(1);
  });

  it('frames the whole world at its stop', () => {
    for (const aspect of [DESK, PHONE]) {
      const f = home(aspect, worldStop(HOME_CHAPTERS));
      expect(f.part).toBe('land');
      for (const area of worldPlaces(areasOnPath())) {
        for (const { id, pad } of area.projects) {
          for (const p of objectPoints(id, pad)) expect(inFrame(p, f.shot, aspect), `${id} at ${aspect.toFixed(2)}`).toBe(true);
        }
      }
      expect(inFrame([C[0], C[1] + LID_TOP, C[2]], f.shot, aspect)).toBe(true);
    }
  });

  it("frames each area's projects, the CPU behind and beside them", () => {
    for (const area of worldPlaces(areasOnPath())) {
      for (const aspect of [DESK, PHONE]) {
        const f = home(aspect, areaStop(HOME_CHAPTERS, area.category));
        expect(f.part).toBe('area');
        for (const { id, pad } of area.projects) for (const p of objectPoints(id, pad)) expect(inFrame(p, f.shot, aspect), `${id} at ${aspect.toFixed(2)}`).toBe(true);
      }
      const desk = home(DESK, areaStop(HOME_CHAPTERS, area.category));
      const first = area.projects[0]!;
      const object = onScreen(objectPoints(first.id, first.pad)[0]!, desk.shot, DESK);
      const cpu = onScreen([C[0], C[1] + LID_TOP, C[2]], desk.shot, DESK);
      expect(cpu.front).toBe(true);
      expect(cpu.x, area.category).toBeGreaterThan(object.x);
    }
  });

  it('never takes the camera across the CPU', () => {
    for (const aspect of [DESK, PHONE]) {
      const from = worldStop(HOME_CHAPTERS);
      const to = sheetStart(HOME_CHAPTERS);
      for (let k = 0; k <= 400; k++) {
        const shot = home(aspect, from + ((to - from) * k) / 400).shot;
        expect(Math.hypot(shot.position[0] - C[0], shot.position[2] - C[2])).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("shows the names only at the world's stop and an area's caption only at its own", () => {
    expect(landAt(0.5).names).toBe(0);
    expect(home(DESK, worldStop(HOME_CHAPTERS)).names).toBe(1);
    expect(home(DESK, worldStop(HOME_CHAPTERS)).caption).toBeNull();
    areasOnPath().forEach((area, i) => {
      const f = home(DESK, areaStop(HOME_CHAPTERS, area.category));
      expect(f.names).toBe(0);
      expect(f.caption).toEqual({ index: i, opacity: 1 });
      expect(f.index).toBe(i);
      expect(f.dots).toBe(1);
    });
    expect(home(DESK, sheetStart(HOME_CHAPTERS)).caption).toBeNull();
    expect(home(DESK, sheetStart(HOME_CHAPTERS)).dots).toBe(0);
    // An area's projects in focus, the others quieter.
    const front = home(DESK, areaStop(HOME_CHAPTERS, 'website'));
    expect(front.levels['jontai-energy']).toBeCloseTo(1.1, 12);
    expect(front.levels.steady).toBeCloseTo(0.5, 12);
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

  it('five projects: each area frames every project in it', () => {
    const five = buildChapters({
      areas: [
        { category: 'app', projects: ['steady', 'jontai-energy'] },
        { category: 'website', projects: ['cookies-clicker'] },
        { category: 'game', projects: ['steady', 'jontai-energy'] }
      ] as never
    });
    const places = worldPlaces(five.units.filter((u) => u.id === 'AREA').map((u) => ({ category: u.category as never, projects: [...(u.projects ?? [])] })));
    for (const aspect of [DESK, PHONE]) {
      for (const area of places) {
        const f = at(five, aspect, areaStop(five, area.category));
        for (const { id, pad } of area.projects) for (const p of objectPoints(id, pad)) expect(inFrame(p, f.shot, aspect), `${area.category} ${id}`).toBe(true);
      }
      const world = at(five, aspect, worldStop(five));
      for (const area of places) for (const { id, pad } of area.projects) for (const p of objectPoints(id, pad)) expect(inFrame(p, world.shot, aspect)).toBe(true);
    }
  });
});
