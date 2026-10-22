import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { COMPASS_LOOK } from '~/engine/bob/build/compass';
import { GLASS_LOOK } from '~/engine/bob/build/glassFloor';
import { applyCameraShot, type CameraShot, homeShotFor, MAX_VFOV, topShotFor } from '~/engine/bob/shots';
import { categories } from '~/data/categories';
import { projects } from '~/data/projects';
import {
  BEADS,
  CAMERA_PATH,
  fieldFor,
  journeyAt,
  journeyPoseAt,
  lensField,
  NEEDLE_PATH,
  TUNNEL_HOLD,
  VOID_CEILING,
  VOID_ROOF
} from '~/scene/bob/journey';
import { riseAt, scrollPoseAt } from '~/scene/bob/scrollPose';
import { HOME_CHAPTERS, stops } from '~/state/chapters';

type Vec3 = readonly [number, number, number];

const DEG = 180 / Math.PI;
const LAPTOP = 16 / 9;
const PHONE = 390 / 844;
const SCREENS = [LAPTOP, PHONE] as const;

/** Progress from 0 to 6 in steps of 1/400 (each stop is hit exactly: 400 k / 400 is k). */
const STEPS = Array.from({ length: 6 * 400 + 1 }, (_, i) => i / 400);

/** Blender (x, y, z) in three's frame: (x, z, -y). */
const fromBlender = (x: number, y: number, z: number): Vec3 => [x, z, -y];

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
const unit = (a: Vec3): Vec3 => {
  const l = length(a);
  return [a[0] / l, a[1] / l, a[2] / l];
};
const angleBetween = (a: Vec3, b: Vec3): number => {
  const c = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (length(a) * length(b));
  return Math.acos(Math.min(1, Math.max(-1, c))) * DEG;
};

/** Bead `i`'s centre once it has come all the way forward. */
const forwardCentre = (i: number): Vec3 => add(BEADS[i]!.centre, CAMERA_PATH.bead.forward);

/** A camera placed by `shot` on a screen of this aspect, as the Rig places it. */
function cameraFor(shot: CameraShot, aspect: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 200);
  applyCameraShot(camera, shot, aspect);
  return camera;
}

/** Where `p` lands on the screen through `shot`: NDC x, y (-1..1 on screen) and z (below 1 in front of the camera). */
function project(shot: CameraShot, aspect: number, p: Vec3): [number, number, number] {
  const v = new THREE.Vector3(...p).project(cameraFor(shot, aspect));
  return [v.x, v.y, v.z];
}

/** The way the needle's tip points: at its aim, or straight down when it has none. */
function tipOf(needle: { position: Vec3; aim: Vec3 | null }): Vec3 {
  return needle.aim ? unit(sub(needle.aim, needle.position)) : [0, -1, 0];
}

describe("the journey's stretches", () => {
  it('names every stretch at the midpoints of the stops', () => {
    expect(journeyAt(0.5)).toEqual({ stretch: 'rise', local: 0.5, project: null });
    expect(journeyAt(1.5)).toEqual({ stretch: 'dive', local: 0.5, project: null });
    expect(journeyAt(2.5)).toEqual({ stretch: 'overview', local: 0.5, project: null });
    expect(journeyAt(3.5)).toEqual({ stretch: 'project', local: 0.5, project: 0 });
    expect(journeyAt(4.5)).toEqual({ stretch: 'project', local: 0.5, project: 1 });
    // The last unit holds Cookies: nothing moves through it.
    expect(journeyAt(5.5)).toEqual({ stretch: 'project', local: 0, project: 2 });
  });

  it('rests at the start of each stretch, and at 6 on Cookies, as at 5', () => {
    expect(stops(HOME_CHAPTERS)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(journeyAt(0)).toEqual({ stretch: 'rise', local: 0, project: null });
    expect(journeyAt(1)).toEqual({ stretch: 'dive', local: 0, project: null });
    expect(journeyAt(2)).toEqual({ stretch: 'overview', local: 0, project: null });
    expect(journeyAt(3)).toEqual({ stretch: 'project', local: 0, project: 0 });
    expect(journeyAt(4)).toEqual({ stretch: 'project', local: 0, project: 1 });
    expect(journeyAt(5)).toEqual({ stretch: 'project', local: 0, project: 2 });
    expect(journeyAt(6)).toEqual(journeyAt(5));
    for (const a of SCREENS) expect(journeyPoseAt(6, a)).toEqual(journeyPoseAt(5, a));
  });

  it('snaps within 1e-6 of every stop, as riseAt does, and not beyond it', () => {
    for (const stop of stops(HOME_CHAPTERS)) {
      for (const off of [-9.99e-7, -1e-9, 1e-9, 9.99e-7]) {
        const p = stop + off;
        if (p < 0 || p > 6) continue;
        expect(journeyAt(p), `${stop} ${off}`).toEqual(journeyAt(stop));
        for (const a of SCREENS) expect(journeyPoseAt(p, a), `${stop} ${off} at ${a}`).toEqual(journeyPoseAt(stop, a));
      }
    }
    // Just past the snap it is the stretch itself.
    expect(journeyAt(3 + 2e-6).local).toBeCloseTo(2e-6, 12);
    expect(journeyAt(3 - 2e-6)).toMatchObject({ stretch: 'overview', project: null });
    expect(journeyAt(3 - 2e-6).local).toBeCloseTo(1 - 2e-6, 12);
  });

  it('reads NaN as the home, and holds progress to 0..6', () => {
    expect(journeyAt(Number.NaN)).toEqual(journeyAt(0));
    expect(journeyAt(-1)).toEqual(journeyAt(0));
    expect(journeyAt(Number.NEGATIVE_INFINITY)).toEqual(journeyAt(0));
    expect(journeyAt(7)).toEqual(journeyAt(6));
    expect(journeyAt(Number.POSITIVE_INFINITY)).toEqual(journeyAt(6));
    for (const a of SCREENS) {
      expect(journeyPoseAt(Number.NaN, a)).toEqual(journeyPoseAt(0, a));
      expect(journeyPoseAt(Number.NaN, a).shot).toEqual(homeShotFor(a));
    }
  });

  it("takes the stretches from the home's chapters: one bead for each project unit, in category order", () => {
    const units = HOME_CHAPTERS.units.filter((unit) => unit.id === 'PROJECTS');
    expect(units.map((unit) => unit.category)).toEqual(categories.all().map((category) => category.id));
    expect(BEADS.map((bead) => bead.category)).toEqual(units.map((unit) => unit.category));
    expect(BEADS.map((bead) => bead.id)).toEqual(projects.all().map((project) => project.id));
    for (const bead of BEADS) expect(projects.byId(bead.id)?.categoryId).toBe(bead.category);
  });
});

describe('the preview, in three coordinates', () => {
  it("puts the beads at spec §7's site positions, radius 0.95, in category order", () => {
    expect(BEADS.map((bead) => bead.id)).toEqual(['funcial', 'jontai-energy', 'cookies-clicker']);
    expect(BEADS[0]!.centre).toEqual(fromBlender(1.2, 3.6, -6.9));
    expect(BEADS[1]!.centre).toEqual(fromBlender(-5.0, 9.5, -5.7));
    expect(BEADS[2]!.centre).toEqual(fromBlender(5.4, 13.0, -8.7));
    expect(BEADS.map((bead) => bead.centre)).toEqual([
      [1.2, -6.9, -3.6],
      [-5.0, -5.7, -9.5],
      [5.4, -8.7, -13.0]
    ]);
    for (const bead of BEADS) expect(bead.radius).toBe(0.95);
  });

  it("takes the void's camera from bob_scroll.py: OVER_LOC, OVER_TGT, FINAL_CAM and the first bead's drift", () => {
    expect(CAMERA_PATH.out.position).toEqual(fromBlender(0, -5.5, -4.4));
    expect(CAMERA_PATH.out.target).toEqual(fromBlender(0, 9.0, -7.2));
    expect(CAMERA_PATH.bead.forward).toEqual(fromBlender(-0.4, -1.4, 0.4));
    // FINAL_CAM (0, -4, -5.5) looks at Funcial come forward: the offset of every bead's shot.
    const finalCam = fromBlender(0, -4.0, -5.5);
    const offset = sub(finalCam, forwardCentre(0));
    CAMERA_PATH.bead.offset.forEach((value, i) => expect(offset[i]).toBeCloseTo(value, 12));
    expect(CAMERA_PATH.bead.offset).toEqual([-0.8, 1.0, 6.2]);
    expect(CAMERA_PATH.descent.bottom).toEqual([0, -2.6, 0]);
    expect([CAMERA_PATH.descent.lens, CAMERA_PATH.out.lens, CAMERA_PATH.bead.lens]).toEqual([32, 30, 40]);
  });

  it("keeps the preview's frames 362-442 as shares of the dive: hold 362-372, dive 372-420, out 420-442", () => {
    expect(CAMERA_PATH.hold).toEqual([0, 0.125]);
    expect(CAMERA_PATH.descent.span[0]).toBeCloseTo((372 - 362) / 80, 12);
    expect(CAMERA_PATH.descent.span[1]).toBeCloseTo((420 - 362) / 80, 12);
    expect(CAMERA_PATH.out.span[0]).toBeCloseTo((420 - 362) / 80, 12);
    expect(CAMERA_PATH.out.span[1]).toBe(1);
    expect(NEEDLE_PATH.sink.span[1]).toBeCloseTo((376 - 362) / 80, 12);
    expect(NEEDLE_PATH.lead.span).toEqual([NEEDLE_PATH.sink.span[1], expect.closeTo((424 - 362) / 80, 12)]);
    expect(NEEDLE_PATH.grow.span[0]).toBeCloseTo((400 - 362) / 80, 12);
    expect(NEEDLE_PATH.grow.scale).toBe(1.9);
  });

  it('starts the needle where the open compass holds it, and the void under the tunnel the glass has', () => {
    expect(NEEDLE_PATH.pivot).toEqual([0, COMPASS_LOOK.iris.flatY, 0]);
    expect(VOID_CEILING).toBe(GLASS_LOOK.well.bottom);
    expect(VOID_ROOF).toBe(VOID_CEILING - 1);
  });

  it("converts a lens to the preview's horizontal field (a 36 mm wide sensor)", () => {
    expect(lensField(50)).toBeCloseTo(39.6, 1);
    expect(lensField(32)).toBeCloseTo(58.7, 1);
    expect(lensField(30)).toBeCloseTo(61.9, 1);
    expect(lensField(40)).toBeCloseTo(48.5, 1);
  });
});

describe('the horizontal field, on a screen', () => {
  it('is the vertical field for the aspect, at 1 times the distance, where that fits under MAX_VFOV', () => {
    const h = lensField(30);
    const { fov, back } = fieldFor(h, LAPTOP);
    expect(fov).toBeCloseTo(2 * Math.atan(Math.tan(h / 2 / DEG) / LAPTOP) * DEG, 12);
    expect(fov).toBeLessThan(MAX_VFOV);
    expect(back).toBe(1);
  });

  it('caps at MAX_VFOV past it and stands back, so a phone sees the same width', () => {
    for (const h of [lensField(30), lensField(32), lensField(40)]) {
      const { fov, back } = fieldFor(h, PHONE);
      expect(fov).toBe(MAX_VFOV);
      expect(back).toBeGreaterThan(1);
      // The width seen at `back` times the distance is the width the field sees at 1.
      expect(PHONE * Math.tan(fov / 2 / DEG) * back).toBeCloseTo(Math.tan(h / 2 / DEG), 12);
    }
  });

  it('reads a bad aspect as 16:9, as shotFor does', () => {
    for (const bad of [Number.NaN, 0, -1, Number.POSITIVE_INFINITY]) expect(fieldFor(40, bad)).toEqual(fieldFor(40, LAPTOP));
  });
});

describe("the journey's camera", () => {
  it("is M2a's rise exactly up to 1: the scroll pose at riseAt(progress)", () => {
    for (const a of [...SCREENS, 1]) {
      for (const p of STEPS.filter((p) => p <= 1)) {
        const pose = journeyPoseAt(p, a);
        const rise = scrollPoseAt(riseAt(p), a);
        expect(pose.shot, `${p} at ${a}`).toEqual(rise.shot);
        expect(pose.rise, `${p} at ${a}`).toEqual(rise);
      }
    }
  });

  it('is exact at every stop: the home, BOB from above, the overview and each bead seen close', () => {
    for (const a of SCREENS) {
      expect(journeyPoseAt(0, a).shot).toEqual(homeShotFor(a));
      expect(journeyPoseAt(1, a).shot).toEqual(topShotFor(a));
      // BOB from above holds until 1.125.
      expect(journeyPoseAt(1.1, a).shot).toEqual(topShotFor(a));
      expect(journeyPoseAt(1.125, a).shot).toEqual(topShotFor(a));
    }
    // On a laptop the void's stops are the preview's own poses.
    const over = journeyPoseAt(2, LAPTOP).shot;
    expect(over.position).toEqual(CAMERA_PATH.out.position);
    expect(over.target).toEqual(CAMERA_PATH.out.target);
    expect(over.fov).toBeCloseTo(fieldFor(lensField(30), LAPTOP).fov, 12);
    for (const p of [0, 1, 2]) {
      const shot = journeyPoseAt(3 + p, LAPTOP).shot;
      expect(shot.target).toEqual(forwardCentre(p));
      shot.position.forEach((value, i) => expect(value).toBeCloseTo(forwardCentre(p)[i]! + CAMERA_PATH.bead.offset[i]!, 12));
      expect(shot.fov).toBeCloseTo(fieldFor(lensField(40), LAPTOP).fov, 12);
    }
  });

  it('looks straight down on the way down, from the top shot to (0, -2.6, 0), with -z up the screen', () => {
    for (const a of SCREENS) {
      const top = topShotFor(a);
      let previous = top.position[1];
      for (const p of STEPS.filter((p) => p > 1.125 && p <= 1.725)) {
        const { shot } = journeyPoseAt(p, a);
        [0, 0, -1].forEach((value, i) => expect(shot.up![i], `up at ${p} on ${a}`).toBeCloseTo(value, 12));
        expect(shot.sway).toBe(0);
        expect(Math.hypot(shot.position[0], shot.position[2])).toBeLessThan(1e-12);
        expect(Math.hypot(shot.target[0], shot.target[2])).toBeLessThan(1e-12);
        expect(shot.target[1]).toBeLessThan(shot.position[1]);
        expect(shot.position[1], `${p} at ${a}`).toBeLessThan(previous);
        previous = shot.position[1];
      }
      expect(previous).toBeCloseTo(-2.6, 12);
      // The horizontal field opens from the top shot's to the 32 mm lens's.
      expect(journeyPoseAt(1.725, a).shot.fov).toBeCloseTo(fieldFor(lensField(32), a).fov, 12);
    }
    // On a laptop the field is the preview's 32 mm one at the bottom of the dive.
    const bottom = journeyPoseAt(1.725, LAPTOP).shot;
    expect(2 * Math.atan(LAPTOP * Math.tan(bottom.fov / 2 / DEG)) * DEG).toBeCloseTo(58.7, 1);
  });

  it('is continuous: no 1/400 step moves the camera more than 0.25 m, turns it more than 3 degrees, or opens it more than 0.5', () => {
    for (const a of SCREENS) {
      let previous = journeyPoseAt(0, a).shot;
      let turn = cameraFor(previous, a).quaternion.clone();
      for (const p of STEPS.slice(1)) {
        const shot = journeyPoseAt(p, a).shot;
        const q = cameraFor(shot, a).quaternion.clone();
        expect(length(sub(shot.position, previous.position)), `move at ${p} on ${a}`).toBeLessThanOrEqual(0.25);
        expect(turn.angleTo(q) * DEG, `turn at ${p} on ${a}`).toBeLessThanOrEqual(3);
        expect(Math.abs(shot.fov - previous.fov), `fov at ${p} on ${a}`).toBeLessThanOrEqual(0.5);
        previous = shot;
        turn = q;
      }
    }
  });

  it('has no parallax anywhere past the rise, and gives its own up there', () => {
    for (const a of SCREENS) {
      for (const p of STEPS.filter((p) => p >= 1)) {
        const { shot } = journeyPoseAt(p, a);
        expect(shot.sway, `${p} at ${a}`).toBe(0);
        expect(shot.up, `${p} at ${a}`).toBeDefined();
        expect(length(shot.up!)).toBeCloseTo(1, 9);
      }
    }
  });

  it('shows all three beads at the overview, on a laptop and on a phone', () => {
    for (const a of SCREENS) {
      const { shot } = journeyPoseAt(2, a);
      for (const bead of BEADS) {
        const [x, y, z] = project(shot, a, bead.centre);
        expect(Math.abs(x), `${bead.id} x at ${a}`).toBeLessThan(1);
        expect(Math.abs(y), `${bead.id} y at ${a}`).toBeLessThan(1);
        expect(z, `${bead.id} in front at ${a}`).toBeLessThan(1);
      }
    }
  });

  it("stands a phone back along the overview's own view line, at least 1 m under the void's ceiling", () => {
    const laptop = journeyPoseAt(2, LAPTOP).shot;
    const phone = journeyPoseAt(2, PHONE).shot;
    expect(phone.target).toEqual(laptop.target);
    expect(angleBetween(sub(phone.target, phone.position), sub(laptop.target, laptop.position))).toBeLessThan(1e-6);
    expect(length(sub(phone.position, phone.target))).toBeGreaterThan(length(sub(laptop.position, laptop.target)));
    expect(phone.position[1]).toBeLessThanOrEqual(VOID_ROOF + 1e-12);
    expect(phone.fov).toBe(MAX_VFOV);
  });

  it('centres the selected bead at each project stop, on a laptop and on a phone', () => {
    for (const a of SCREENS) {
      for (const p of [0, 1, 2]) {
        const { shot } = journeyPoseAt(3 + p, a);
        const [x, y, z] = project(shot, a, forwardCentre(p));
        expect(Math.abs(x), `bead ${p} x at ${a}`).toBeLessThan(0.5);
        expect(Math.abs(y), `bead ${p} y at ${a}`).toBeLessThan(0.5);
        expect(z).toBeLessThan(1);
      }
    }
  });

  it('bends up and away over Funcial from Jontai to Cookies on a laptop, where the straight line runs through it', () => {
    /** How far the camera is off the straight line between two stops, halfway between them. */
    const offLine = (stop: number, a: number) => {
      const middle = add(journeyPoseAt(stop, a).shot.position, journeyPoseAt(stop + 1, a).shot.position).map((v) => v / 2) as unknown as Vec3;
      return sub(journeyPoseAt(stop + 0.5, a).shot.position, middle);
    };
    // The straight line from Jontai's shot to Cookies' passes 0.9 m from Funcial's centre, inside its shell.
    const [jontai, cookies] = [journeyPoseAt(4, LAPTOP).shot.position, journeyPoseAt(5, LAPTOP).shot.position];
    const funcial = BEADS[0]!.centre;
    const nearest = Math.min(...Array.from({ length: 101 }, (_, i) => length(sub(add(jontai, sub(cookies, jontai).map((v) => (v * i) / 100) as unknown as Vec3), funcial))));
    expect(nearest).toBeLessThan(BEADS[0]!.radius);
    const bend = offLine(4, LAPTOP);
    expect(length(bend)).toBeGreaterThan(1);
    expect(length(bend)).toBeLessThan(3);
    expect(bend[1]).toBeGreaterThan(0);
    // A phone stands further back and passes it straight; from Funcial to Jontai nothing is in the way.
    expect(length(offLine(4, PHONE))).toBeLessThan(1e-9);
    for (const a of SCREENS) expect(length(offLine(3, a))).toBeLessThan(1e-9);
  });

  it('gives the same pose whatever screen was asked for before', () => {
    const first = journeyPoseAt(4.5, LAPTOP);
    journeyPoseAt(4.5, PHONE);
    journeyPoseAt(3.5, 1);
    expect(journeyPoseAt(4.5, LAPTOP)).toEqual(first);
  });

  it("stays clear of every bead, and under the void's roof once it has come out under the glass", () => {
    for (const a of SCREENS) {
      for (const p of STEPS) {
        const pose = journeyPoseAt(p, a);
        BEADS.forEach((bead, i) => {
          const centre = add(bead.centre, CAMERA_PATH.bead.forward.map((v) => v * pose.forward[i]!) as unknown as Vec3);
          expect(length(sub(pose.shot.position, centre)), `${bead.id} at ${p} on ${a}`).toBeGreaterThan(2.4);
          if (pose.needle) expect(length(sub(pose.needle.position, centre)), `needle by ${bead.id} at ${p} on ${a}`).toBeGreaterThan(2.4);
        });
        if (p >= 1.725) expect(pose.shot.position[1], `roof at ${p} on ${a}`).toBeLessThanOrEqual(VOID_ROOF + 1e-9);
      }
    }
  });
});

describe('the tunnel hold', () => {
  it("is the progress at which the dive's camera is halfway down the tunnel, at y -0.6", () => {
    expect(TUNNEL_HOLD).toBeGreaterThan(1.125);
    expect(TUNNEL_HOLD).toBeLessThan(1.725);
    expect(TUNNEL_HOLD).toBeCloseTo(1.6, 1);
    expect(journeyAt(TUNNEL_HOLD).stretch).toBe('dive');
    for (const a of [...SCREENS, 1]) expect(journeyPoseAt(TUNNEL_HOLD, a).shot.position[1], `at ${a}`).toBeCloseTo(-0.6, 2);
    expect(Math.abs(journeyPoseAt(TUNNEL_HOLD, LAPTOP).shot.position[1] + 0.6)).toBeLessThan(0.01);
    expect(VOID_CEILING / 2).toBe(-0.6);
  });
});

describe('the beads', () => {
  it('brings bead p = progress - 3 forward and lights it at each project stop, the others back and dim', () => {
    for (const a of SCREENS) {
      for (const stop of [3, 4, 5, 6]) {
        const p = Math.min(stop - 3, 2);
        const pose = journeyPoseAt(stop, a);
        for (let i = 0; i < 3; i++) {
          expect(pose.forward[i], `forward ${i} at ${stop}`).toBe(i === p ? 1 : 0);
          expect(pose.lit[i], `lit ${i} at ${stop}`).toBe(i === p ? 1 : 0);
        }
      }
    }
  });

  it('reads all three equally at the overview: half lit, none forward', () => {
    const pose = journeyPoseAt(2, LAPTOP);
    expect(pose.lit).toEqual([0.5, 0.5, 0.5]);
    expect(pose.forward).toEqual([0, 0, 0]);
  });

  it('keeps them back and dim on the rise, and moves their light and drift continuously', () => {
    for (const p of STEPS.filter((p) => p <= 1)) {
      const pose = journeyPoseAt(p, LAPTOP);
      expect(pose.forward).toEqual([0, 0, 0]);
      expect(pose.lit).toEqual([0, 0, 0]);
    }
    let previous = journeyPoseAt(0, LAPTOP);
    for (const p of STEPS.slice(1)) {
      const pose = journeyPoseAt(p, LAPTOP);
      for (let i = 0; i < 3; i++) {
        expect(pose.forward[i]).toBeGreaterThanOrEqual(0);
        expect(pose.forward[i]).toBeLessThanOrEqual(1);
        expect(pose.lit[i]).toBeGreaterThanOrEqual(0);
        expect(pose.lit[i]).toBeLessThanOrEqual(1);
        expect(Math.abs(pose.forward[i]! - previous.forward[i]!), `forward ${i} at ${p}`).toBeLessThan(0.01);
        expect(Math.abs(pose.lit[i]! - previous.lit[i]!), `lit ${i} at ${p}`).toBeLessThan(0.01);
      }
      previous = pose;
    }
  });
});

describe("the void's light", () => {
  it('is out on the rise and at BOB from above, rises through the dive, and is full from the overview on', () => {
    for (const p of STEPS.filter((p) => p <= 1)) expect([journeyPoseAt(p, LAPTOP).beam, journeyPoseAt(p, LAPTOP).mist]).toEqual([0, 0]);
    let previous = 0;
    for (const p of STEPS.filter((p) => p > 1 && p < 2)) {
      const { beam, mist } = journeyPoseAt(p, LAPTOP);
      expect(beam).toBeGreaterThanOrEqual(previous);
      expect(mist).toBe(beam);
      expect(beam).toBeLessThan(1);
      previous = beam;
    }
    expect(previous).toBeGreaterThan(0.99);
    for (const p of STEPS.filter((p) => p >= 2)) expect([journeyPoseAt(p, LAPTOP).beam, journeyPoseAt(p, LAPTOP).mist]).toEqual([1, 1]);
  });
});

describe('the needle in the void', () => {
  it('leaves it to the compass on the rise', () => {
    for (const a of SCREENS) for (const p of STEPS.filter((p) => p < 1)) expect(journeyPoseAt(p, a).needle).toBeNull();
  });

  it('takes over at the start of the dive where the open compass holds it: on the pivot, scale 1, tip down', () => {
    expect(journeyPoseAt(1, LAPTOP).needle).toEqual({ position: [0, 0.09, 0], scale: 1, aim: null });
  });

  it('sinks into the tunnel, leads the dive to 9.5 under the compass, and grows to 1.9 by the overview', () => {
    const at = (p: number) => journeyPoseAt(p, LAPTOP).needle!;
    // Frames 362-376 sink it 1.0, 376-424 lead it to 9.5 under the armillary's 0.09.
    expect(at(1 + (376 - 362) / 80).position[1]).toBeCloseTo(0.09 - 1, 12);
    expect(at(1 + (424 - 362) / 80).position[1]).toBeCloseTo(0.09 - 9.5, 12);
    expect(at(2).position).toEqual([0, 0.09 - 9.5, 0]);
    // It grows over frames 400-442, to 1.9 at the overview.
    expect(at(1 + (400 - 362) / 80).scale).toBe(1);
    expect(at(1.3).scale).toBe(1);
    expect(at(1.8).scale).toBeGreaterThan(1);
    expect(at(2).scale).toBe(1.9);
    // Straight down below the camera all through the dive, and always sinking.
    let previous = Number.POSITIVE_INFINITY;
    for (const p of STEPS.filter((p) => p >= 1 && p <= 2)) {
      const needle = at(p);
      expect(needle.aim).toBeNull();
      expect([needle.position[0], needle.position[2]]).toEqual([0, 0]);
      expect(needle.position[1]).toBeLessThanOrEqual(previous);
      previous = needle.position[1];
    }
  });

  it("points at the selected bead's centre at each project stop, from the preview's place beside it", () => {
    for (const a of SCREENS) {
      for (const p of [0, 1, 2]) {
        const needle = journeyPoseAt(3 + p, a).needle!;
        expect(needle.aim).toEqual(forwardCentre(p));
        expect(needle.scale).toBe(1.9);
        sub(needle.position, forwardCentre(p)).forEach((value, i) => expect(value).toBeCloseTo(NEEDLE_PATH.offset[i]!, 12));
      }
    }
    // By Funcial it stands where the preview's needle ends: (-1.4, 0.8, -7.9) under the armillary at 0.09.
    const funcial = journeyPoseAt(3, LAPTOP).needle!.position;
    add(fromBlender(-1.4, 0.8, -7.9), [0, 0.09, 0]).forEach((value, i) => expect(funcial[i]).toBeCloseTo(value, 12));
    expect(journeyPoseAt(6, LAPTOP).needle).toEqual(journeyPoseAt(5, LAPTOP).needle);
  });

  it('never goes deeper into a bead than at a stop, where its tip touches the lacquer', () => {
    // The needle as the GLB has it (tools/blender/export_compass.py L_N): the tip 1.15 up its axis, the tail 0.85 of
    // that down it, both at the needle's scale.
    const stopTip = length(NEEDLE_PATH.offset) - 1.15 * NEEDLE_PATH.grow.scale;
    expect(stopTip).toBeGreaterThan(0.7);
    for (const a of SCREENS) {
      for (const p of STEPS.filter((p) => p >= 1)) {
        const pose = journeyPoseAt(p, a);
        const needle = pose.needle!;
        const tip = add(needle.position, tipOf(needle).map((v) => v * 1.15 * needle.scale) as unknown as Vec3);
        const tail = sub(needle.position, tipOf(needle).map((v) => v * 1.15 * 0.85 * needle.scale) as unknown as Vec3);
        BEADS.forEach((bead, i) => {
          const centre = add(bead.centre, CAMERA_PATH.bead.forward.map((v) => v * pose.forward[i]!) as unknown as Vec3);
          expect(length(sub(tip, centre)), `tip in ${bead.id} at ${p} on ${a}`).toBeGreaterThan(stopTip - 0.005);
          expect(length(sub(tail, centre)), `tail in ${bead.id} at ${p} on ${a}`).toBeGreaterThan(bead.radius);
        });
      }
    }
  });

  it('moves and swings continuously, and swings to the next bead before it gets there', () => {
    for (const a of SCREENS) {
      let previous = journeyPoseAt(1, a).needle!;
      for (const p of STEPS.filter((p) => p > 1)) {
        const needle = journeyPoseAt(p, a).needle!;
        expect(length(sub(needle.position, previous.position)), `move at ${p} on ${a}`).toBeLessThanOrEqual(0.25);
        expect(angleBetween(tipOf(needle), tipOf(previous)), `swing at ${p} on ${a}`).toBeLessThanOrEqual(3);
        expect(Math.abs(needle.scale - previous.scale)).toBeLessThan(0.02);
        previous = needle;
      }
    }
    // Two thirds of the way from Funcial to Jontai the tip already points at Jontai, where it is now.
    const pose = journeyPoseAt(3 + 2 / 3, LAPTOP);
    const jontai = add(BEADS[1]!.centre, CAMERA_PATH.bead.forward.map((v) => v * pose.forward[1]!) as unknown as Vec3);
    expect(pose.needle!.aim).not.toBeNull();
    pose.needle!.aim!.forEach((value, i) => expect(value).toBeCloseTo(jontai[i]!, 12));
  });
});
