import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { applyCameraShot, type CameraShot, homeShotFor, MAX_VFOV, topShotFor } from '~/engine/bob/shots';
import { restsAt } from '~/scene/bob/focus';
import { BEAD_RADIUS, BEADS, fieldFor, focusShotFor, FOCUS_VIEW, journeyAt, journeyPoseAt, lensField } from '~/scene/bob/journey';
import { factAt, lightAt, voidAt, wayShot } from '~/scene/bob/lightDive';
import { ease, pathFor, TOWARD } from '~/scene/bob/lightPath';
import { riseAt, scrollPoseAt } from '~/scene/bob/scrollPose';
import { selectedBead } from '~/scene/bob/voidPose';
import { HAND_F, HOME_CHAPTERS, pathStart, placeOfFrame, scrollEnd, sheetStart } from '~/state/chapters';

type Vec3 = readonly [number, number, number];

const DEG = 180 / Math.PI;
const LAPTOP = 1440 / 900;
const PHONE = 390 / 844;
const SCREENS = [LAPTOP, PHONE] as const;
/** The path's start, the hand-over (way frame 256). */
const L = pathStart(HOME_CHAPTERS);
const END = scrollEnd(HOME_CHAPTERS);

/** Progress from 0 to the end in steps of 1/1000. */
const STEPS = Array.from({ length: Math.floor(END * 1000) + 1 }, (_, i) => i / 1000);

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
  it('reads the stretches off the chapters', () => {
    expect(journeyAt(0.5)).toMatchObject({ stretch: 'rise', project: null });
    expect(journeyAt(L - 1e-3)).toMatchObject({ stretch: 'light', project: null });
    expect(journeyAt(L)).toMatchObject({ stretch: 'travel', local: 0, project: 0, frame: null });
    expect(journeyAt(L + 2.7)).toMatchObject({ stretch: 'inside', local: 0, project: 0 });
    expect(journeyAt(L + 6.0)).toMatchObject({ stretch: 'orbit', project: 1 });
    expect(journeyAt(L + 12.65)).toMatchObject({ stretch: 'look', project: null });
    expect(journeyAt(L + 14.55)).toMatchObject({ stretch: 'sheet', local: 0, project: null });
    expect(journeyAt(L + 15.55)).toMatchObject({ stretch: 'end' });
  });

  it('runs the light dive frame by frame: BOB from above is frame 1, the hand-over frame 256', () => {
    expect(journeyAt(1 + 1e-9).frame).toBeCloseTo(1, 6);
    expect(journeyAt(placeOfFrame(121)).frame).toBeCloseTo(121, 9);
    expect(journeyAt(L - 2e-6).frame).toBeCloseTo(HAND_F, 3); // within 1e-6 of the stop it is the stop
  });

  it('snaps within 1e-6 of a stop, reads NaN as the home, and holds progress to the scroll', () => {
    expect(journeyAt(L + 2.7 + 5e-7)).toMatchObject({ stretch: 'inside', local: 0 });
    expect(journeyAt(Number.NaN).stretch).toBe('rise');
    expect(journeyAt(99).stretch).toBe('end');
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

  it('keeps the fall as it was, up to the hand-over', () => {
    for (const a of SCREENS) {
      expect(journeyPoseAt(0, a).shot).toEqual(homeShotFor(a));
      expect(journeyPoseAt(1, a).shot).toEqual(topShotFor(a));
      for (const f of [2, 60, 121, 241, 255]) expect(journeyPoseAt(placeOfFrame(f), a).shot).toEqual(wayShot(f, a));
    }
  });

  it('has no seam anywhere: no 1/1000 step moves the camera more than 0.15 m or turns it more than 2 degrees', () => {
    for (const a of SCREENS) {
      let worst = { p: 0, move: 0, turn: 0 };
      for (let i = 1; i < STEPS.length; i++) {
        const s = shotStep(journeyPoseAt(STEPS[i - 1]!, a).shot, journeyPoseAt(STEPS[i]!, a).shot);
        if (s.move > worst.move || s.turn > worst.turn) worst = { p: STEPS[i]!, move: Math.max(worst.move, s.move), turn: Math.max(worst.turn, s.turn) };
      }
      expect(worst.move, `at ${a}, ${worst.p}`).toBeLessThan(0.15);
      expect(worst.turn, `at ${a}, ${worst.p}`).toBeLessThan(2);
    }
  });

  it('has no parallax past the rise', () => {
    for (const p of [1.5, L - 0.1, L + 1, L + 3, L + 13, L + 15]) expect(journeyPoseAt(p, LAPTOP).shot.sway).toBe(0);
  });
});

describe('the light, the facts and the void', () => {
  it("carries the light dive's own light, fact and void through it, and none on the rise", () => {
    const p = placeOfFrame(121);
    const pose = journeyPoseAt(p, LAPTOP);
    expect(pose.light).toMatchObject(lightAt(121, LAPTOP));
    expect(pose.fact).toEqual(factAt(121));
    expect(pose.void).toMatchObject(voidAt(121, LAPTOP));
    expect(journeyPoseAt(0.5, LAPTOP)).toMatchObject({ light: null, fact: null, void: null, path: null });
  });

  it('gives the light up to the compass as it ignites: the needle hidden over way frames 2-8', () => {
    expect(journeyPoseAt(1, LAPTOP).ignite).toBe(0);
    expect(journeyPoseAt(placeOfFrame(8), LAPTOP).ignite).toBe(1);
    expect(journeyPoseAt(0.5, LAPTOP).ignite).toBe(0);
  });

  it('poses the path from the hand-over on', () => {
    for (const q of [0, 1.0, 3.1, 6.0, 13.5]) { // places that are not stops, which the journey snaps to the chapters' own sums
      const pose = journeyPoseAt(L + q, LAPTOP);
      const frame = pathFor(LAPTOP).frameAt(L + q - L); // the place past the path's start, as the journey sums it
      expect([pose.shot, pose.light, pose.path, pose.void]).toEqual([frame.shot, frame.light, frame, frame.void]);
      expect(pose.needle).toBeNull();
      expect(pose.ignite).toBe(1);
    }
  });

  it('fact 05 fades out across the hand-over', () => {
    const at = (p: number) => journeyPoseAt(p, LAPTOP).fact?.opacity ?? 0;
    expect(at(L)).toBeCloseTo(factAt(HAND_F).opacity, 9);
    expect(at(L)).toBeGreaterThan(0.9);
    expect(at(placeOfFrame(260) + 1e-6)).toBe(0);
    for (let p = L - 0.02; p < L + 0.06; p += 0.001) expect(Math.abs(at(p + 0.001) - at(p)), `at ${p}`).toBeLessThan(0.1);
  });

  it('fades to black and raises the sheet over SHEET, and holds it up at the end', () => {
    const s = sheetStart(HOME_CHAPTERS);
    expect(journeyPoseAt(s, LAPTOP).sheet).toBe(0);
    expect(journeyPoseAt(s + 0.5, LAPTOP).sheet).toBeCloseTo(0.5, 9);
    expect(journeyPoseAt(s + 0.5, LAPTOP).path!.black).toBeCloseTo(ease(0.5 / 0.55), 9);
    expect(journeyPoseAt(END, LAPTOP).sheet).toBe(1);
  });
});

describe('the beads on the way', () => {
  it('are the projects on the way, in order, each the size of its shell', () => {
    expect(BEADS.map((b) => [b.id, b.category, b.radius])).toEqual([
      ['funcial', 'secure-element', BEAD_RADIUS],
      ['jontai-energy', 'front-panel', BEAD_RADIUS],
      ['cookies-clicker', 'oscillator', BEAD_RADIUS],
    ]);
  });

  it('selects the bead of an orbit or inside, nowhere else', () => {
    // INSIDE 0, ORBIT 1, TRAVEL 0, LOOK
    expect([L + 3, L + 6.0, L + 1.0, L + 13].map((p) => selectedBead(journeyAt(p)))).toEqual([0, 1, null, null]);
  });

  it('flies back only from a rest where the bead is in view', () => {
    expect(restsAt('jontai-energy', L + 6.95, L + 6.95)).toBe(true); // its arrival
    expect(restsAt('jontai-energy', L + 8.3 - 1e-3, L + 8.3 - 1e-3)).toBe(true); // its inside
    expect(restsAt('jontai-energy', L + 14.55, L + 14.55)).toBe(true); // the look back's own stop (SHEET at local 0)
    expect(restsAt('jontai-energy', L + 2.7, L + 2.7)).toBe(false); // Funcial's arrival
    expect(restsAt('jontai-energy', L + 6.95, L + 7)).toBe(false); // moving
  });
});

describe('the close view of a bead', () => {
  it("stands in front of the bead's porthole, on the path's line toward it, 1.6 off the porthole", () => {
    for (const a of [LAPTOP, 1]) {
      const centres = pathFor(a).centres;
      for (const [i, b] of BEADS.entries()) {
        const shot = focusShotFor(b.id, a);
        const centre = centres[i]!;
        const toClose = sub(shot.position, centre);
        const cos = (TOWARD[0] * toClose[0] + TOWARD[1] * toClose[1] + TOWARD[2] * toClose[2]) / length(toClose);
        expect(cos, `${b.id} at ${a}`).toBeGreaterThan(0.9999);
        expect(length(toClose)).toBeCloseTo(b.radius + FOCUS_VIEW.standOff, 9);
        expect(shot.target).toEqual(centre);
        expect(project(shot, a, centre)).toEqual([expect.closeTo(0, 6), expect.closeTo(0, 6)]);
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
