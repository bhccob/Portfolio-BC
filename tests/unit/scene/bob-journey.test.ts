import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { categories } from '~/data/categories';
import { applyCameraShot, type CameraShot, homeShotFor, MAX_VFOV, topShotFor } from '~/engine/bob/shots';
import { BEADS, fieldFor, focusShotFor, FOCUS_VIEW, journeyAt, journeyPoseAt, lensField } from '~/scene/bob/journey';
import { BEADS_IN, beadsAt, F, factAt, lightAt, ringBeads, ringNeedle, ringShot, voidAt, wayNeedle, wayShot } from '~/scene/bob/lightDive';
import { riseAt, scrollPoseAt } from '~/scene/bob/scrollPose';
import { HOME_CHAPTERS, placeOfFrame, scrollEnd, stops } from '~/state/chapters';

type Vec3 = readonly [number, number, number];

const DEG = 180 / Math.PI;
const LAPTOP = 1440 / 900;
const PHONE = 390 / 844;
const SCREENS = [LAPTOP, PHONE] as const;

/** Progress from 0 to 7 in steps of 1/1000 (each integer stop is hit exactly). */
const STEPS = Array.from({ length: 7 * 1000 + 1 }, (_, i) => i / 1000);

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);

/** How far one shot is from another: the camera's move, in metres, and its turn (the look's), in degrees. */
function shotStep(a: CameraShot, b: CameraShot): { move: number; turn: number } {
  const da = sub(a.target, a.position);
  const db = sub(b.target, b.position);
  const c = (da[0] * db[0] + da[1] * db[1] + da[2] * db[2]) / (length(da) * length(db));
  return { move: length(sub(a.position, b.position)), turn: Math.acos(Math.min(1, Math.max(-1, c))) * DEG };
}

/** Where `p` lands on the screen through `shot`: NDC x, y. */
function project(shot: CameraShot, aspect: number, p: Vec3): [number, number] {
  const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 200);
  applyCameraShot(camera, shot, aspect);
  const v = new THREE.Vector3(...p).project(camera);
  return [v.x, v.y];
}

describe("the journey's stretches", () => {
  it('names the rise, the light dive, the ring, the sheet and the end', () => {
    expect(journeyAt(0.5)).toMatchObject({ stretch: 'rise', frame: null, angle: null, project: null });
    expect(journeyAt(placeOfFrame(121))).toMatchObject({ stretch: 'light', frame: 121, angle: null, project: null });
    expect(journeyAt(4.5)).toMatchObject({ stretch: 'ring', frame: null, angle: 60, project: null });
    expect(journeyAt(6.25)).toMatchObject({ stretch: 'sheet', angle: 240, project: 2 });
    expect(journeyAt(7)).toEqual({ stretch: 'end', local: 0, frame: null, angle: 240, project: null });
  });

  it('turns the ring exactly with the scroll, and names the project in front within 20 degrees of it', () => {
    expect(journeyAt(4)).toMatchObject({ angle: 0, project: 0 });
    expect(journeyAt(4.15).angle).toBeCloseTo(18, 9);
    expect(journeyAt(4.15).project).toBe(0);
    expect(journeyAt(4.2).project).toBeNull();
    expect(journeyAt(5)).toMatchObject({ angle: 120, project: 1 });
    expect(journeyAt(5.85)).toMatchObject({ project: 2 });
  });

  it('runs the light dive frame by frame: BOB from above is frame 1, the ring is frame 300', () => {
    expect(journeyAt(1)).toMatchObject({ stretch: 'light', frame: 1 });
    expect(journeyAt(placeOfFrame(260.5)).frame).toBeCloseTo(260.5, 9);
    expect(journeyAt(4)).toMatchObject({ stretch: 'ring', angle: 0 });
  });

  it('snaps within 1e-6 of a stop, reads NaN as the home, and holds progress to 0..7', () => {
    expect(journeyAt(4 + 5e-7)).toMatchObject({ stretch: 'ring', angle: 0 });
    expect(journeyAt(Number.NaN).stretch).toBe('rise');
    expect(journeyAt(-2).stretch).toBe('rise');
    expect(journeyAt(99).stretch).toBe('end');
    expect(scrollEnd(HOME_CHAPTERS)).toBe(7);
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

  it('is exact at the home, BOB from above, every way frame and every ring angle', () => {
    for (const a of SCREENS) {
      expect(journeyPoseAt(0, a).shot).toEqual(homeShotFor(a));
      expect(journeyPoseAt(1, a).shot).toEqual(topShotFor(a));
      for (const f of [30, 121, 261, 290]) expect(journeyPoseAt(placeOfFrame(f), a).shot).toEqual(wayShot(f, a));
      expect(journeyPoseAt(5.25, a).shot).toEqual(ringShot(150, a));
      expect(journeyPoseAt(6.5, a).shot).toEqual(ringShot(240, a));
      expect(journeyPoseAt(7, a).shot).toEqual(ringShot(240, a));
    }
  });

  it('has no seam anywhere: no 1/1000 step moves the camera more than 0.15 m or turns it more than 2 degrees', () => {
    for (const a of SCREENS) {
      let worst = { p: 0, move: 0, turn: 0 };
      for (let i = 1; i < STEPS.length; i++) {
        const s = shotStep(journeyPoseAt(STEPS[i - 1]!, a).shot, journeyPoseAt(STEPS[i]!, a).shot);
        if (s.move > worst.move || s.turn > worst.turn) worst = { p: STEPS[i]!, move: Math.max(worst.move, s.move), turn: Math.max(worst.turn, s.turn) };
      }
      expect(worst.move, `at ${a}`).toBeLessThan(0.15);
      expect(worst.turn, `at ${a}`).toBeLessThan(2);
    }
  });

  it('has no parallax past the rise', () => {
    for (const p of [1.5, 3.9, 4.5, 6.5, 7]) expect(journeyPoseAt(p, LAPTOP).shot.sway).toBe(0);
  });
});

describe('the light, the facts and the void', () => {
  it("carries the light dive's own light, fact and void through it, and none on the rise or past the landing", () => {
    const p = placeOfFrame(121);
    const pose = journeyPoseAt(p, LAPTOP);
    expect(pose.light).toMatchObject(lightAt(121, LAPTOP));
    expect(pose.fact).toEqual(factAt(121));
    expect(pose.void).toMatchObject(voidAt(121, LAPTOP));
    expect(journeyPoseAt(0.5, LAPTOP)).toMatchObject({ light: null, fact: null, void: null });
    expect(journeyPoseAt(4.5, LAPTOP)).toMatchObject({ light: null, fact: null });
    expect(journeyPoseAt(4.5, LAPTOP).void).not.toBeNull();
  });

  it('gives the light up to the compass as it ignites: the needle hidden over way frames 2-8', () => {
    expect(journeyPoseAt(1, LAPTOP).ignite).toBe(0);
    expect(journeyPoseAt(placeOfFrame(8), LAPTOP).ignite).toBe(1);
    expect(journeyPoseAt(0.5, LAPTOP).ignite).toBe(0);
  });
});

describe('the needle and the beads', () => {
  it('leaves the needle to the compass on the rise and in the fall, and draws it out of the light on arrival', () => {
    expect(journeyPoseAt(0.5, LAPTOP).needle).toBeNull();
    expect(journeyPoseAt(placeOfFrame(200), LAPTOP).needle).toBeNull();
    expect(journeyPoseAt(placeOfFrame(280), LAPTOP).needle).toEqual(wayNeedle(280));
    expect(journeyPoseAt(5.25, LAPTOP).needle).toEqual(ringNeedle(150));
  });

  it('raises the beads into view from their frame on, and keeps them round the ring after', () => {
    expect(journeyPoseAt(placeOfFrame(BEADS_IN - 1), LAPTOP).beads).toBeNull();
    expect(journeyPoseAt(placeOfFrame(280), LAPTOP).beads).toEqual(beadsAt(280, LAPTOP));
    expect(journeyPoseAt(5.25, LAPTOP).beads).toEqual(ringBeads(150, LAPTOP));
    expect(journeyPoseAt(6.5, LAPTOP).beads).toEqual(ringBeads(240, LAPTOP));
  });

  it('keeps the projects in category order, round the ring at their rest places', () => {
    expect(BEADS.map((b) => b.category)).toEqual(categories.all().map((c) => c.id));
    expect(BEADS.map((b) => b.id)).toEqual(['funcial', 'jontai-energy', 'cookies-clicker']);
    for (const [i, b] of BEADS.entries()) expect(b.centre).toEqual(ringBeads(120 * i, LAPTOP)[i]!.position);
  });
});

describe('the sheet', () => {
  it('raises the sheet over Cookies Clicker, linearly with the scroll, and holds it at the end', () => {
    expect(journeyPoseAt(6, LAPTOP).sheet).toBe(0);
    expect(journeyPoseAt(6.25, LAPTOP).sheet).toBeCloseTo(0.25, 12);
    expect(journeyPoseAt(7, LAPTOP).sheet).toBe(1);
    expect(journeyPoseAt(5.9, LAPTOP).sheet).toBe(0);
  });
});

describe('the close view of a bead', () => {
  it("stands in front of the bead's porthole, toward its stop's camera, 1.6 off the porthole", () => {
    for (const a of [LAPTOP, 1]) {
      for (const [i, b] of BEADS.entries()) {
        const shot = focusShotFor(b.id, a);
        const toCamera = sub(ringShot(120 * i, a).position, b.centre);
        const toClose = sub(shot.position, b.centre);
        const cos = (toCamera[0] * toClose[0] + toCamera[1] * toClose[1] + toCamera[2] * toClose[2]) / (length(toCamera) * length(toClose));
        expect(cos, `${b.id} at ${a}`).toBeGreaterThan(0.9999);
        expect(length(toClose)).toBeCloseTo(b.radius + FOCUS_VIEW.standOff, 9);
        expect(shot.target).toEqual(b.centre);
        expect(project(shot, a, b.centre)).toEqual([expect.closeTo(0, 6), expect.closeTo(0, 6)]);
      }
    }
  });
});

describe('the horizontal field, on a screen', () => {
  it("converts a lens to the preview's horizontal field (a 36 mm wide sensor)", () => {
    expect(lensField(50)).toBeCloseTo(39.6, 1);
    expect(lensField(40)).toBeCloseTo(48.5, 1);
  });

  it('caps at MAX_VFOV and stands back, so a phone sees the same width', () => {
    const { fov, back } = fieldFor(lensField(40), PHONE);
    expect(fov).toBe(MAX_VFOV);
    expect(PHONE * Math.tan(fov / 2 / DEG) * back).toBeCloseTo(Math.tan(lensField(40) / 2 / DEG), 12);
  });
});

describe('the stops', () => {
  it('poses every stop exactly: the light dive lands on the ring at Funcial', () => {
    expect(stops(HOME_CHAPTERS)).toEqual([0, 1, 4, 5, 6, 7]);
    expect(journeyPoseAt(4, LAPTOP).shot).toEqual(wayShot(F.END, LAPTOP));
  });
});
