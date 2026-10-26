import { NavigationType } from 'react-router';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyCameraShot, type CameraShot } from '~/engine/bob/shots';
import type { ProjectId } from '~/data/projects';
import {
  FLIGHT_MS,
  FOCUS_AT_REST,
  FOCUS_FADE_MS,
  type FocusMove,
  focusGoalFor,
  focusPoseAt,
  moveFocus,
  restsAt,
  stepFocus
} from '~/scene/bob/focus';
import { BEADS, fieldFor, FOCUS_VIEW, focusShotFor, journeyPoseAt, lensField, shotToward } from '~/scene/bob/journey';
import { ringShot } from '~/scene/bob/lightDive';
import { STEP_FADE_MS } from '~/scene/bob/stepFade';
import { voidShownFor } from '~/scene/bob/voidPose';
import { frame } from '~/state/frame';
import { BACK_STATE, resetRouteSync, stopForProject, syncRoute } from '~/state/routeSync';
import { useScene } from '~/state/store';

type Vec3 = readonly [number, number, number];

const LAPTOP = 16 / 9;
const PHONE = 390 / 844;
const SCREENS = [LAPTOP, PHONE] as const;
const IDS: readonly ProjectId[] = BEADS.map((bead) => bead.id);

const near = (a: Vec3, b: Vec3, digits = 9): void => {
  for (let i = 0; i < 3; i++) expect(a[i]).toBeCloseTo(b[i]!, digits);
};

/** A bead's centre where it stands at its stop: its place on the ring (the beads do not drift there). */
const atStop = (bead: (typeof BEADS)[number]): Vec3 => bead.centre;

/** The unit line from a bead's centre toward the ring's camera at the bead's own stop (its angle, 120° apart). */
const towardStop = (bead: (typeof BEADS)[number], aspect: number): Vec3 => {
  const camera = ringShot(120 * BEADS.indexOf(bead), aspect).position;
  const d: Vec3 = [camera[0] - bead.centre[0], camera[1] - bead.centre[1], camera[2] - bead.centre[2]];
  const length = Math.hypot(...d);
  return [d[0] / length, d[1] / length, d[2] / length];
};

/** Where `point` lands on a screen of this aspect through `shot`, NDC. */
function project(shot: CameraShot, aspect: number, point: Vec3): THREE.Vector3 {
  const camera = new THREE.PerspectiveCamera();
  applyCameraShot(camera, shot, aspect);
  return new THREE.Vector3(...point).project(camera);
}

// ---------------------------------------------------------------- the close view

describe('focusShotFor: a bead seen close', () => {
  it('stands the camera 1.6 in front of the porthole, on the line to its ring stop\'s camera, looking into it, with the 40 mm field', () => {
    expect(FOCUS_VIEW.standOff).toBe(1.6);
    expect(FOCUS_VIEW.lens).toBe(40);
    for (const bead of BEADS) {
      const shot = focusShotFor(bead.id, LAPTOP);
      const centre = atStop(bead);
      const u = towardStop(bead, LAPTOP);
      const d = bead.radius + 1.6;
      near(shot.target, centre);
      // The porthole faces the ring's camera at the bead's stop, the bead's radius out; the camera 1.6 beyond it.
      near(shot.position, [centre[0] + u[0] * d, centre[1] + u[1] * d, centre[2] + u[2] * d]);
      expect(shot.fov).toBeCloseTo(fieldFor(lensField(40), LAPTOP).fov, 9);
      near(shot.up ?? [0, 1, 0], [0, 1, 0]);
    }
  });

  it('stands a phone back along the same line by the width rule (fieldFor), so it sees the same width across', () => {
    for (const bead of BEADS) {
      const shot = focusShotFor(bead.id, PHONE);
      const { fov, back } = fieldFor(lensField(40), PHONE);
      const centre = atStop(bead);
      const u = towardStop(bead, PHONE);
      const d = (bead.radius + 1.6) * back;
      expect(back).toBeGreaterThan(1);
      near(shot.position, [centre[0] + u[0] * d, centre[1] + u[1] * d, centre[2] + u[2] * d]);
      expect(shot.fov).toBeCloseTo(fov, 9);
    }
  });

  it('holds the bead in the middle of the picture, on every screen', () => {
    for (const a of SCREENS) {
      for (const bead of BEADS) {
        const at = project(focusShotFor(bead.id, a), a, atStop(bead));
        expect(at.x).toBeCloseTo(0, 9);
        expect(at.y).toBeCloseTo(0, 9);
      }
    }
  });

  it("is under the glass, so the void and the beads show behind the page", () => {
    for (const a of SCREENS) for (const id of IDS) expect(voidShownFor(focusShotFor(id, a))).toBe(true);
  });

  it("lets the pointer's parallax in, as the home under a page has it, where the void's journey has none", () => {
    for (const id of IDS) expect(focusShotFor(id, LAPTOP).sway).toBe(1);
  });

  it("is nearer than the bead's stop: the flight goes in, toward the porthole", () => {
    for (const a of SCREENS) {
      for (const bead of BEADS) {
        const stop = journeyPoseAt(stopForProject(bead.id), a).shot;
        const close = focusShotFor(bead.id, a);
        const distance = (shot: CameraShot) => Math.hypot(...shot.position.map((v, i) => v - shot.target[i]!));
        expect(distance(close)).toBeLessThan(distance(stop));
      }
    }
  });
});

describe("shotToward: the flight's straight move between two shots", () => {
  const stop = journeyPoseAt(stopForProject('funcial'), LAPTOP).shot;
  const close = focusShotFor('funcial', LAPTOP);

  it('is the first shot at 0 and the second at 1, exactly', () => {
    expect(shotToward(stop, close, 0)).toEqual(stop);
    expect(shotToward(stop, close, 1)).toEqual(close);
  });

  it('moves the camera, the look-at point and the field in straight lines, and the parallax with them', () => {
    const mid = shotToward(stop, close, 0.5);
    for (let i = 0; i < 3; i++) {
      expect(mid.position[i]).toBeCloseTo((stop.position[i]! + close.position[i]!) / 2, 9);
      expect(mid.target[i]).toBeCloseTo((stop.target[i]! + close.target[i]!) / 2, 9);
    }
    expect(mid.fov).toBeCloseTo((stop.fov + close.fov) / 2, 9);
    expect(mid.sway).toBeCloseTo(((stop.sway ?? 1) + (close.sway ?? 1)) / 2, 9);
    expect(Math.hypot(...(mid.up ?? [0, 0, 0]))).toBeCloseTo(1, 9);
  });

  it("never takes the camera into a bead's shell: from every stop into its porthole, on every screen", () => {
    for (const a of SCREENS) {
      for (const bead of BEADS) {
        const from = journeyPoseAt(stopForProject(bead.id), a).shot;
        const to = focusShotFor(bead.id, a);
        for (let k = 0; k <= 100; k++) {
          const at = shotToward(from, to, k / 100).position;
          for (const other of BEADS) {
            const centre = other.id === bead.id ? atStop(other) : other.centre;
            expect(Math.hypot(at[0] - centre[0], at[1] - centre[1], at[2] - centre[2])).toBeGreaterThan(other.radius + 1);
          }
        }
      }
    }
  });
});

// ---------------------------------------------------------------- the moves

describe('focusPoseAt: where the camera is between the journey and a close view', () => {
  it('rests on the journey\'s shot before any move: no bead, nothing dark, nothing moving', () => {
    expect(focusPoseAt(FOCUS_AT_REST, 0)).toEqual({ id: null, amount: 0, dark: false, moving: false, engaged: false });
    expect(focusPoseAt(FOCUS_AT_REST, 1e9).amount).toBe(0);
  });

  it('flies into a bead over FLIGHT_MS (1.4 s), eased: it leaves the stop and reaches the porthole with no speed', () => {
    expect(FLIGHT_MS).toBe(1400);
    const move = moveFocus(FOCUS_AT_REST, 'funcial', 1000, 'fly');
    expect(focusPoseAt(move, 1000).amount).toBe(0);
    expect(focusPoseAt(move, 1000 + FLIGHT_MS / 2).amount).toBeCloseTo(0.5, 9);
    expect(focusPoseAt(move, 1000 + FLIGHT_MS)).toEqual({ id: 'funcial', amount: 1, dark: false, moving: false, engaged: true });
    expect(focusPoseAt(move, 1000 + 10).amount).toBeLessThan(0.001);
    expect(1 - focusPoseAt(move, 1000 + FLIGHT_MS - 10).amount).toBeLessThan(0.001);
    // On its way it is moving, not dark, and its bead is the one it flies to.
    expect(focusPoseAt(move, 1300)).toMatchObject({ id: 'funcial', dark: false, moving: true, engaged: true });
    // It never goes back on itself.
    let last = 0;
    for (let t = 1000; t <= 1000 + FLIGHT_MS; t += 8) {
      const { amount } = focusPoseAt(move, t);
      expect(amount).toBeGreaterThanOrEqual(last);
      last = amount;
    }
  });

  it('flies back out to the journey\'s shot over the same time, and then lets the bead go', () => {
    const inside = moveFocus(FOCUS_AT_REST, 'cookies-clicker', 0, 'fly');
    const out = moveFocus(inside, null, 5000, 'fly');
    expect(focusPoseAt(out, 5000)).toMatchObject({ id: 'cookies-clicker', amount: 1, moving: true });
    expect(focusPoseAt(out, 5000 + FLIGHT_MS / 2).amount).toBeCloseTo(0.5, 9);
    expect(focusPoseAt(out, 5000 + FLIGHT_MS)).toEqual({ id: null, amount: 0, dark: false, moving: false, engaged: false });
  });

  it("fades as M2a's step fade does: dark for its 150 ms on the view it leaves, then at once on the one it goes to", () => {
    expect(FOCUS_FADE_MS).toBe(STEP_FADE_MS);
    const move = moveFocus(FOCUS_AT_REST, 'jontai-energy', 2000, 'fade');
    expect(focusPoseAt(move, 2000)).toEqual({ id: null, amount: 0, dark: true, moving: true, engaged: true });
    expect(focusPoseAt(move, 2000 + FOCUS_FADE_MS - 1)).toMatchObject({ id: null, amount: 0, dark: true });
    expect(focusPoseAt(move, 2000 + FOCUS_FADE_MS)).toEqual({ id: 'jontai-energy', amount: 1, dark: false, moving: false, engaged: true });
    const back = moveFocus(move, null, 9000, 'fade');
    expect(focusPoseAt(back, 9000)).toMatchObject({ id: 'jontai-energy', amount: 1, dark: true });
    expect(focusPoseAt(back, 9000 + FOCUS_FADE_MS)).toEqual({ id: null, amount: 0, dark: false, moving: false, engaged: false });
  });

  it("never flies from one bead's close view to another's: that is a fade", () => {
    const funcial = moveFocus(FOCUS_AT_REST, 'funcial', 0, 'fly');
    expect(moveFocus(funcial, 'cookies-clicker', 5000, 'fly').mode).toBe('fade');
    // From the journey's shot any bead may be flown to, and from a bead back out.
    expect(moveFocus(FOCUS_AT_REST, 'cookies-clicker', 5000, 'fly').mode).toBe('fly');
    expect(moveFocus(funcial, null, 5000, 'fly').mode).toBe('fly');
  });

  it('starts a move from wherever the last one stands: a flight turned back half way goes on from there, with no jump', () => {
    const going: FocusMove = moveFocus(FOCUS_AT_REST, 'funcial', 0, 'fly');
    const half = focusPoseAt(going, FLIGHT_MS / 2).amount;
    const turned = moveFocus(going, null, FLIGHT_MS / 2, 'fly');
    expect(focusPoseAt(turned, FLIGHT_MS / 2).amount).toBeCloseTo(half, 12);
    expect(focusPoseAt(turned, FLIGHT_MS / 2 + FLIGHT_MS).amount).toBe(0);
  });
});

describe('focusGoalFor: the close view the page asks for', () => {
  it('is the project of a project page', () => {
    expect(focusGoalFor({ kind: 'PROJECT_FOCUS', id: 'funcial' }, 'project', null)).toBe('funcial');
    expect(focusGoalFor({ kind: 'PROJECT_FOCUS', id: 'cookies-clicker' }, 'project', null)).toBe('cookies-clicker');
  });

  it('is the bead being opened while its flight runs on the home page, before the router has gone to the page', () => {
    expect(focusGoalFor({ kind: 'PROJECTS', category: 'oscillator' }, 'home', 'cookies-clicker')).toBe('cookies-clicker');
    expect(focusGoalFor({ kind: 'PROJECT_FOCUS', id: 'jontai-energy' }, 'home', 'jontai-energy')).toBe('jontai-energy');
  });

  it('holds the close view it stands at while a page left for the home is not yet synced (PROJECT_FOCUS, scene home)', () => {
    expect(focusGoalFor({ kind: 'PROJECT_FOCUS', id: 'funcial' }, 'home', null, 'funcial')).toBe('funcial');
    expect(focusGoalFor({ kind: 'PROJECT_FOCUS', id: 'funcial' }, 'home', null, null)).toBeNull();
    // Once synced the phase is the scroll's, and the close view is let go.
    expect(focusGoalFor({ kind: 'PROJECTS', category: 'secure-element' }, 'home', null, 'funcial')).toBeNull();
  });

  it('is none on the home page otherwise, even in PROJECT_FOCUS (the proof bridge\'s OPEN_PROJECT on the home)', () => {
    expect(focusGoalFor({ kind: 'PROJECT_FOCUS', id: 'funcial' }, 'home', null)).toBeNull();
    expect(focusGoalFor({ kind: 'PROJECTS', category: 'secure-element' }, 'home', null)).toBeNull();
    expect(focusGoalFor({ kind: 'HOME_IDLE' }, 'home', null)).toBeNull();
    expect(focusGoalFor({ kind: 'LOADING' }, null, null)).toBeNull();
  });

  it('is none for a project that has no bead', () => {
    expect(focusGoalFor({ kind: 'PROJECT_FOCUS', id: 'nope' }, 'project', null)).toBeNull();
  });
});

describe("restsAt: a flight leaves only from its bead's own stop, at rest", () => {
  it("is true at the bead's ring stop with the story resting there", () => {
    expect(restsAt('funcial', 4, 4)).toBe(true);
    expect(restsAt('jontai-energy', 5, 5)).toBe(true);
    expect(restsAt('cookies-clicker', 6, 6)).toBe(true);
  });

  it("is false for the last bead once the story has left its stop: on the sheet (6 to 7) and at the end page (7)", () => {
    expect(restsAt('cookies-clicker', 6.5, 6.5)).toBe(false);
    expect(restsAt('cookies-clicker', 7, 7)).toBe(false);
    expect(restsAt('cookies-clicker', 6, 6.5)).toBe(false);
  });

  it("is false on the way round the ring, at another bead's stop, in the light dive, or for no bead", () => {
    expect(restsAt('funcial', 4, 4.4)).toBe(false);
    expect(restsAt('funcial', 4.1, 4.1)).toBe(false);
    expect(restsAt('funcial', 4.5, 4.5)).toBe(false);
    expect(restsAt('jontai-energy', 4, 4)).toBe(false);
    expect(restsAt('funcial', 2.5, 2.5)).toBe(false);
    expect(restsAt('funcial', 1, 1)).toBe(false);
    expect(restsAt(null, 4, 4)).toBe(false);
  });
});

// ---------------------------------------------------------------- the move out, in the order the effects run

describe('stepFocus: Back flies out of a page reached any way, whatever frame falls between the effects (fix round 1)', () => {
  /** The frame's input as the Opening reads it: the real store and the real story. */
  const input = () => {
    const { phase, scene, reducedMotion } = useScene.getState();
    return { phase, scene, reducedMotion, progress: frame.progress, target: frame.target };
  };

  beforeEach(() => {
    resetRouteSync();
    useScene.setState(useScene.getInitialState(), true);
    frame.progress = frame.target = frame.velocity = frame.chapterIndex = 0;
    frame.focus.move = { ...FOCUS_AT_REST, from: { ...FOCUS_AT_REST.from } };
    frame.focus.opening = null;
  });
  afterEach(() => {
    resetRouteSync();
    useScene.setState(useScene.getInitialState(), true);
    frame.progress = frame.target = frame.chapterIndex = 0;
    frame.focus.move = { ...FOCUS_AT_REST, from: { ...FOCUS_AT_REST.from } };
  });

  /**
   * A navigation as the app runs it: SceneHost's layout effect puts the page's scene in the store, a canvas frame may
   * fall there (`between`), then the route sync, a passive effect, syncs the route, and the next frame is drawn.
   */
  const navigate = (scene: 'home' | 'project', to: { pathname: string; key: string; state?: unknown }, type: NavigationType, now: number, between: boolean) => {
    useScene.getState().setScene(scene);
    const mid = between ? stepFocus(frame.focus, input(), now) : null;
    const midTo = frame.focus.move.to;
    syncRoute(to, type);
    return { mid, midTo, after: stepFocus(frame.focus, input(), now + 16) };
  };

  /** The visit begins at the home at 0 and reaches Funcial's page by the home's nav, a link: the page fades in. */
  const toFuncialByTheNav = (): void => {
    useScene.getState().setScene('home');
    syncRoute({ pathname: '/', key: 'default' }, NavigationType.Pop);
    useScene.getState().dispatch({ type: 'LOADED' });
    navigate('project', { pathname: '/projects/funcial/', key: 'k1' }, NavigationType.Push, 0, true);
    expect(stepFocus(frame.focus, input(), 1000)).toMatchObject({ id: 'funcial', amount: 1, moving: false });
  };

  for (const between of [true, false]) {
    it(`flies out on Back ${between ? 'with' : 'without'} a canvas frame between the scene's change and the route sync`, () => {
      toFuncialByTheNav();
      const { mid, midTo, after } = navigate('home', { pathname: '/', key: 'default' }, NavigationType.Pop, 2000, between);
      if (mid) {
        // The frame between holds the close view: nothing is decided before the story is at the bead's stop.
        expect(mid).toMatchObject({ id: 'funcial', amount: 1, dark: false });
        expect(midTo).toBe('funcial');
      }
      expect([frame.progress, frame.target]).toEqual([4, 4]);
      expect(frame.focus.move.mode).toBe('fly');
      expect(frame.focus.move.to).toBeNull();
      expect(after).toMatchObject({ id: 'funcial', dark: false, moving: true });
      expect(focusPoseAt(frame.focus.move, 2016 + FLIGHT_MS / 2)).toMatchObject({ dark: false, moving: true });
    });
  }

  it("flies out on the page's own Escape after a direct arrival (a push with BACK_STATE), a frame between or not", () => {
    for (const between of [true, false]) {
      resetRouteSync();
      useScene.setState(useScene.getInitialState(), true);
      frame.progress = frame.target = 0;
      frame.focus.move = { ...FOCUS_AT_REST, from: { ...FOCUS_AT_REST.from } };
      navigate('project', { pathname: '/projects/cookies-clicker/', key: 'default' }, NavigationType.Pop, 0, false);
      stepFocus(frame.focus, input(), 1000);
      navigate('home', { pathname: '/', key: 'k1', state: BACK_STATE }, NavigationType.Push, 2000, between);
      expect([frame.target, frame.focus.move.mode, frame.focus.move.to]).toEqual([6, 'fly', null]);
    }
  });

  it("fades out for the header's name, which lands at the home, 0, far from the bead's stop", () => {
    toFuncialByTheNav();
    navigate('home', { pathname: '/', key: 'k2' }, NavigationType.Push, 2000, true);
    expect([frame.target, frame.focus.move.mode, frame.focus.move.to]).toEqual([0, 'fade', null]);
  });

  it("still asks for no close view for the proof bridge's OPEN_PROJECT on the home, with no page behind it", () => {
    useScene.getState().setScene('home');
    useScene.setState({ phase: { kind: 'PROJECT_FOCUS', id: 'funcial' } });
    expect(stepFocus(frame.focus, input(), 0)).toMatchObject({ id: null, amount: 0, engaged: false });
    expect(frame.focus.move.to).toBeNull();
  });
});
