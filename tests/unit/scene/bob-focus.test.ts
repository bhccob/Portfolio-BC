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
  focusLiftsAt,
  focusOpensAt,
  focusPoseAt,
  focusShotAt,
  moveFocus,
  restsAt,
  SINK_MS,
  stepFocus,
  underPage
} from '~/scene/bob/focus';
import { focusShotFor, journeyPoseAt, shotToward, WORLD_PROJECTS } from '~/scene/bob/journey';
import { openOf } from '~/scene/bob/inside';
import { worldPathFor } from '~/scene/bob/worldPath';
import { STEP_FADE_MS } from '~/scene/bob/stepFade';
import { voidShownFor } from '~/scene/bob/voidPose';
import { frame } from '~/state/frame';
import { HOME_CHAPTERS, pathStart } from '~/state/chapters';
import { BACK_STATE, resetRouteSync, stopForProject, syncRoute } from '~/state/routeSync';
import { useScene } from '~/state/store';

type Vec3 = readonly [number, number, number];

const LAPTOP = 16 / 9;
const PHONE = 390 / 844;
const SCREENS = [LAPTOP, PHONE] as const;
const IDS: readonly ProjectId[] = WORLD_PROJECTS;

const near = (a: Vec3, b: Vec3, digits = 9): void => {
  for (let i = 0; i < 3; i++) expect(a[i]).toBeCloseTo(b[i]!, digits);
};

/** The path's start, the hand-over: the world is past it. */
const L = pathStart(HOME_CHAPTERS);

/** Where `point` lands on a screen of this aspect through `shot`, NDC. */
function project(shot: CameraShot, aspect: number, point: Vec3): THREE.Vector3 {
  const camera = new THREE.PerspectiveCamera();
  applyCameraShot(camera, shot, aspect);
  return new THREE.Vector3(...point).project(camera);
}

// ---------------------------------------------------------------- the open view

describe("focusShotFor: the view a project opens in, a click's and its project page's", () => {
  it("is the project's board stop: the camera that opens it stays where it stands", () => {
    for (const a of SCREENS) {
      const path = worldPathFor(a);
      for (const id of IDS) {
        const board = path.places.slice(1).findIndex((b) => b.sockets.some((s) => s.id === id));
        expect(board, id).toBeGreaterThanOrEqual(0);
        expect(focusShotFor(id, a)).toEqual(path.areaShot(board));
        // The journey's own shot at the project's stop: a page reached directly stands there.
        const stop = journeyPoseAt(stopForProject(id), a).shot;
        near(focusShotFor(id, a).position, stop.position, 6);
        near(focusShotFor(id, a).target, stop.target, 6);
      }
    }
  });

  it('is under the glass, so the void and the world show behind the page', () => {
    for (const a of SCREENS) for (const id of IDS) expect(voidShownFor(focusShotFor(id, a))).toBe(true);
  });

  it('is the look back for a project not on the stack', () => {
    expect(focusShotFor('nope' as ProjectId, LAPTOP)).toEqual(worldPathFor(LAPTOP).lookShot);
  });
});

describe("shotToward: the straight move between two shots", () => {
  const world = journeyPoseAt(stopForProject('steady') - 1.2, LAPTOP).shot;
  const board = focusShotFor('steady', LAPTOP);

  it('is the first shot at 0 and the second at 1, exactly', () => {
    expect(shotToward(world, board, 0)).toEqual(world);
    expect(shotToward(world, board, 1)).toEqual(board);
  });

  it('moves the camera, the look-at point and the field in straight lines, and the parallax with them', () => {
    const mid = shotToward(world, board, 0.5);
    for (let i = 0; i < 3; i++) {
      expect(mid.position[i]).toBeCloseTo((world.position[i]! + board.position[i]!) / 2, 9);
      expect(mid.target[i]).toBeCloseTo((world.target[i]! + board.target[i]!) / 2, 9);
    }
    expect(mid.fov).toBeCloseTo((world.fov + board.fov) / 2, 9);
    expect(mid.sway).toBeCloseTo(((world.sway ?? 1) + (board.sway ?? 1)) / 2, 9);
    expect(Math.hypot(...(mid.up ?? [0, 0, 0]))).toBeCloseTo(1, 9);
  });
});

// ---------------------------------------------------------------- the camera stays

describe('focusShotAt: the camera stays while a project opens, and turns to its board when it closes', () => {
  it('opens in place: the camera stays on the shot it was opened from, all the way', () => {
    for (const a of SCREENS) {
      const C = worldPathFor(a).centre;
      for (const id of IDS) {
        // Opened from wherever it is seen: its own board's stop, or the whole machine's.
        for (const from of [journeyPoseAt(stopForProject(id), a).shot, worldPathFor(a).worldShot]) {
          const open = moveFocus(FOCUS_AT_REST, id, 0, 'fly', from);
          for (let k = 0; k <= 30; k++) expect(focusShotAt(open, (2 * FLIGHT_MS * k) / 30, focusShotFor(id, a), C)).toBe(from);
        }
      }
    }
  });

  it('the arrows never move the camera: from one open project to the next the shot is unchanged', () => {
    const C = worldPathFor(LAPTOP).centre;
    const at = focusShotFor('steady', LAPTOP);
    const open = moveFocus(FOCUS_AT_REST, 'steady', 0, 'fly', at);
    let move = open;
    // On through every project, Jontai Energy's and Cookies Clicker's on other boards, and round again.
    for (const [k, id] of [...IDS.slice(1), ...IDS].entries()) {
      move = moveFocus(move, id, 5000 + k * 3000, 'fly', at);
      for (const dt of [0, 400, FLIGHT_MS, 2 * FLIGHT_MS]) expect(focusShotAt(move, 5000 + k * 3000 + dt, focusShotFor(id, LAPTOP), C)).toBe(at);
    }
  });

  it("closing after the arrows turns the camera round to the shown project's board", () => {
    for (const a of SCREENS) {
      const path = worldPathFor(a);
      const C = path.centre;
      const at = focusShotFor('steady', a);
      const turn = moveFocus(moveFocus(FOCUS_AT_REST, 'steady', 0, 'fly', at), 'cookies-clicker', 5000, 'fly', at);
      const close = moveFocus(turn, null, 9000, 'fly', at);
      const goal = journeyPoseAt(stopForProject('cookies-clicker'), a).shot;
      expect(focusShotAt(close, 9000, goal, C)).toEqual(at);
      expect(focusShotAt(close, 9000 + SINK_MS, goal, C)).toEqual(goal);
      // Round the stack's axis on the way, never through it.
      for (let k = 0; k <= 50; k++) {
        const p = focusShotAt(close, 9000 + (SINK_MS * k) / 50, goal, C).position;
        expect(Math.hypot(p[0] - C[0], p[2] - C[2]), `at ${k}`).toBeGreaterThan(2.2);
      }
    }
  });

  it('stands a move with no shot to begin from on its goal, and a fade on its start while dark', () => {
    const C = worldPathFor(LAPTOP).centre;
    const goal = focusShotFor('cookies-clicker', LAPTOP);
    const world = worldPathFor(LAPTOP).worldShot;
    expect(focusShotAt(moveFocus(FOCUS_AT_REST, 'cookies-clicker', 0, 'fly'), 100, goal, C)).toEqual(goal);
    const fade = moveFocus(FOCUS_AT_REST, 'cookies-clicker', 0, 'fade', world);
    expect(focusShotAt(fade, FOCUS_FADE_MS - 1, goal, C)).toEqual(world);
    expect(focusShotAt(fade, FOCUS_FADE_MS, goal, C)).toEqual(goal);
  });
});

// ---------------------------------------------------------------- the lift

describe('focusPoseAt: a project rising to the spot and sinking back', () => {
  it("rests before any move: no project, nothing dark, nothing moving", () => {
    expect(focusPoseAt(FOCUS_AT_REST, 0)).toEqual({ id: null, amount: 0, dark: false, moving: false, engaged: false });
    expect(focusPoseAt(FOCUS_AT_REST, 1e9).amount).toBe(0);
  });

  it('lifts a project over FLIGHT_MS (1.5 s) at a steady pace: the world eases it', () => {
    expect(FLIGHT_MS).toBe(1500);
    const move = moveFocus(FOCUS_AT_REST, 'steady', 1000, 'fly');
    expect(focusPoseAt(move, 1000).amount).toBe(0);
    expect(focusPoseAt(move, 1000 + FLIGHT_MS / 2).amount).toBeCloseTo(0.5, 9);
    expect(focusPoseAt(move, 1000 + FLIGHT_MS)).toEqual({ id: 'steady', amount: 1, dark: false, moving: false, engaged: true });
    expect(focusPoseAt(move, 1300)).toMatchObject({ id: 'steady', dark: false, moving: true, engaged: true });
    expect(focusLiftsAt(move, 1000 + FLIGHT_MS / 4)).toEqual({ steady: expect.closeTo(0.25, 9) });
  });

  it('sinks it over SINK_MS (1.3 s) from wherever it is, then lets it go', () => {
    expect(SINK_MS).toBe(1300);
    const up = moveFocus(FOCUS_AT_REST, 'cookies-clicker', 0, 'fly');
    const out = moveFocus(up, null, 5000, 'fly');
    expect(focusPoseAt(out, 5000)).toMatchObject({ id: 'cookies-clicker', amount: 1, moving: true });
    expect(focusPoseAt(out, 5000 + SINK_MS / 2).amount).toBeCloseTo(0.5, 9);
    expect(focusPoseAt(out, 5000 + SINK_MS)).toEqual({ id: null, amount: 0, dark: false, moving: false, engaged: false });
    // Turned back half way up, it sinks from there, with no jump.
    const going = moveFocus(FOCUS_AT_REST, 'steady', 0, 'fly');
    const half = focusPoseAt(going, FLIGHT_MS / 2).amount;
    const turned = moveFocus(going, null, FLIGHT_MS / 2, 'fly');
    expect(focusPoseAt(turned, FLIGHT_MS / 2).amount).toBeCloseTo(half, 12);
    expect(focusPoseAt(turned, FLIGHT_MS / 2 + half * SINK_MS).amount).toBe(0);
  });

  it("fades as M2a's step fade does: dark for its 150 ms on the view it leaves, then at once on the one it goes to", () => {
    expect(FOCUS_FADE_MS).toBe(STEP_FADE_MS);
    const move = moveFocus(FOCUS_AT_REST, 'jontai-energy', 2000, 'fade');
    expect(focusPoseAt(move, 2000)).toEqual({ id: null, amount: 0, dark: true, moving: true, engaged: true });
    expect(focusPoseAt(move, 2000 + FOCUS_FADE_MS - 1)).toMatchObject({ id: null, amount: 0, dark: true });
    expect(focusPoseAt(move, 2000 + FOCUS_FADE_MS)).toEqual({ id: 'jontai-energy', amount: 1, dark: false, moving: false, engaged: true });
    expect(focusLiftsAt(move, 2000 + FOCUS_FADE_MS)).toEqual({ 'jontai-energy': 1 });
    const back = moveFocus(move, null, 9000, 'fade');
    expect(focusPoseAt(back, 9000)).toMatchObject({ id: 'jontai-energy', amount: 1, dark: true });
    expect(focusPoseAt(back, 9000 + FOCUS_FADE_MS)).toEqual({ id: null, amount: 0, dark: false, moving: false, engaged: false });
  });

  it('the arrows sink the one in the spot as the next rises, the world kept in its open look on the way', () => {
    const steady = moveFocus(FOCUS_AT_REST, 'steady', 0, 'fly');
    const turn = moveFocus(steady, 'cookies-clicker', 5000, 'fly');
    expect(focusLiftsAt(turn, 5000)).toEqual({ steady: 1, 'cookies-clicker': 0 });
    const half = focusLiftsAt(turn, 5000 + 650);
    expect(half.steady).toBeCloseTo(0.5, 9);
    expect(half['cookies-clicker']).toBeCloseTo(650 / FLIGHT_MS, 9);
    expect(focusLiftsAt(turn, 5000 + FLIGHT_MS)).toEqual({ 'cookies-clicker': 1 });
    // The shown project is the one rising; the open look holds while either is up.
    for (const t of [5000, 5000 + 650, 5000 + FLIGHT_MS]) expect(focusPoseAt(turn, t)).toMatchObject({ id: 'cookies-clicker', engaged: true });
    for (const t of [5000, 5000 + 650]) expect(focusPoseAt(turn, t).amount).toBeGreaterThanOrEqual(0.5 - 1e-9);
    expect(focusPoseAt(turn, 5000 + FLIGHT_MS)).toMatchObject({ amount: 1, moving: false });
    // The panel: the one rising, and the one sinking.
    expect(focusOpensAt(turn, 5000 + 650)).toEqual({ open: expect.closeTo(650 / FLIGHT_MS, 9), leaving: { id: 'steady', amount: expect.closeTo(0.5, 9) } });
    expect(focusOpensAt(turn, 5000 + FLIGHT_MS)).toEqual({ open: 1, leaving: null });
  });

  it('pressing the arrows twice quickly sinks the first from where it is and lifts the newest; never two whole in the spot', () => {
    const steady = moveFocus(FOCUS_AT_REST, 'steady', 0, 'fly');
    const once = moveFocus(steady, 'porfael', 5000, 'fly');
    const twice = moveFocus(once, 'jontai-energy', 5300, 'fly');
    // Steady goes on sinking from where it was when the second press came, at its own pace: no jump.
    const before = focusLiftsAt(once, 5300);
    const after = focusLiftsAt(twice, 5300);
    expect(after.steady).toBeCloseTo(before.steady!, 12);
    expect(after['jontai-energy']).toBe(0);
    for (let t = 5300; t <= 5300 + 2 * FLIGHT_MS; t += 25) {
      const lifts = Object.values(focusLiftsAt(twice, t));
      // Never two near the spot at once.
      expect(lifts.filter((v) => v > 0.6).length, `at ${t}`).toBeLessThanOrEqual(1);
      const now = focusLiftsAt(twice, t);
      if (now.steady !== undefined) expect(now.steady).toBeCloseTo(Math.max(0, before.steady! - (t - 5300) / SINK_MS), 9);
    }
    expect(focusLiftsAt(twice, 5300 + FLIGHT_MS)).toEqual({ 'jontai-energy': 1 });
    expect(focusPoseAt(twice, 5300 + FLIGHT_MS)).toMatchObject({ id: 'jontai-energy', amount: 1, moving: false });
  });
});

describe('focusGoalFor: the close view the page asks for', () => {
  it('is the project of a project page', () => {
    expect(focusGoalFor({ kind: 'PROJECT_FOCUS', id: 'steady' }, 'project', null)).toBe('steady');
    expect(focusGoalFor({ kind: 'PROJECT_FOCUS', id: 'cookies-clicker' }, 'project', null)).toBe('cookies-clicker');
  });

  it('is the bead being opened while its flight runs on the home page, before the router has gone to the page', () => {
    expect(focusGoalFor({ kind: 'PROJECTS', category: 'game' }, 'home', 'cookies-clicker')).toBe('cookies-clicker');
    expect(focusGoalFor({ kind: 'PROJECT_FOCUS', id: 'jontai-energy' }, 'home', 'jontai-energy')).toBe('jontai-energy');
  });

  it('holds the close view it stands at while a page left for the home is not yet synced (PROJECT_FOCUS, scene home)', () => {
    expect(focusGoalFor({ kind: 'PROJECT_FOCUS', id: 'steady' }, 'home', null, 'steady')).toBe('steady');
    expect(focusGoalFor({ kind: 'PROJECT_FOCUS', id: 'steady' }, 'home', null, null)).toBeNull();
    // Once synced the phase is the scroll's, and the close view is let go.
    expect(focusGoalFor({ kind: 'PROJECTS', category: 'app' }, 'home', null, 'steady')).toBeNull();
  });

  it('is none on the home page otherwise, even in PROJECT_FOCUS (the proof bridge\'s OPEN_PROJECT on the home)', () => {
    expect(focusGoalFor({ kind: 'PROJECT_FOCUS', id: 'steady' }, 'home', null)).toBeNull();
    expect(focusGoalFor({ kind: 'PROJECTS', category: 'app' }, 'home', null)).toBeNull();
    expect(focusGoalFor({ kind: 'HOME_IDLE' }, 'home', null)).toBeNull();
    expect(focusGoalFor({ kind: 'LOADING' }, null, null)).toBeNull();
  });

  it('is none for a project that has no bead', () => {
    expect(focusGoalFor({ kind: 'PROJECT_FOCUS', id: 'nope' }, 'project', null)).toBeNull();
  });
});

describe('restsAt: a flight leaves only from a rest where the project is in view', () => {
  it('is true at the world, at every area and in the areas between, with the story resting there', () => {
    expect(restsAt('steady', stopForProject('steady'), stopForProject('steady'))).toBe(true);
    expect(restsAt('jontai-energy', L + 1.53, L + 1.53)).toBe(true);
    expect(restsAt('cookies-clicker', L + 4.0, L + 4.0)).toBe(true);
  });

  it("is true for every project in the look back, its own stop (the sheet's start) included, and false once the sheet is up", () => {
    for (const id of IDS) expect(restsAt(id, L + 6.5, L + 6.5)).toBe(true);
    for (const id of IDS) expect(restsAt(id, L + 7.6, L + 7.6)).toBe(true);
    expect(restsAt('cookies-clicker', L + 8.0, L + 8.0)).toBe(false);
    expect(restsAt('cookies-clicker', L + 8.6, L + 8.6)).toBe(false);
  });

  it("is false while the story moves, while the light comes down, in the light dive, or for no project", () => {
    expect(restsAt('steady', L + 1.53, L + 2.0)).toBe(false);
    expect(restsAt('jontai-energy', L + 1.0, L + 1.0)).toBe(false);
    expect(restsAt('steady', L + 0.5, L + 0.5)).toBe(false);
    expect(restsAt('steady', 2.5, 2.5)).toBe(false);
    expect(restsAt('steady', 1, 1)).toBe(false);
    expect(restsAt(null, L + 2.7, L + 2.7)).toBe(false);
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

  /** The visit begins at the home at 0 and reaches Steady's page by the home's nav, a link: the page fades in. */
  const toSteadyByTheNav = (): void => {
    useScene.getState().setScene('home');
    syncRoute({ pathname: '/', key: 'default' }, NavigationType.Pop);
    useScene.getState().dispatch({ type: 'LOADED' });
    navigate('project', { pathname: '/projects/steady/', key: 'k1' }, NavigationType.Push, 0, true);
    expect(stepFocus(frame.focus, input(), 1000)).toMatchObject({ id: 'steady', amount: 1, moving: false });
  };

  for (const between of [true, false]) {
    it(`flies out on Back ${between ? 'with' : 'without'} a canvas frame between the scene's change and the route sync`, () => {
      toSteadyByTheNav();
      const { mid, midTo, after } = navigate('home', { pathname: '/', key: 'default' }, NavigationType.Pop, 2000, between);
      if (mid) {
        // The frame between holds the close view: nothing is decided before the story is at the bead's stop.
        expect(mid).toMatchObject({ id: 'steady', amount: 1, dark: false });
        expect(midTo).toBe('steady');
      }
      expect(frame.target).toBeCloseTo(stopForProject('steady'), 9);
      expect(frame.progress).toBe(frame.target);
      expect(frame.focus.move.mode).toBe('fly');
      expect(frame.focus.move.to).toBeNull();
      expect(after).toMatchObject({ id: 'steady', dark: false, moving: true });
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
      expect([frame.target, frame.focus.move.mode, frame.focus.move.to]).toEqual([stopForProject('cookies-clicker'), 'fly', null]);
    }
  });

  it("fades out for the header's name, which lands at the home, 0, far from the bead's stop", () => {
    toSteadyByTheNav();
    navigate('home', { pathname: '/', key: 'k2' }, NavigationType.Push, 2000, true);
    expect([frame.target, frame.focus.move.mode, frame.focus.move.to]).toEqual([0, 'fade', null]);
  });

  it("still asks for no close view for the proof bridge's OPEN_PROJECT on the home, with no page behind it", () => {
    useScene.getState().setScene('home');
    useScene.setState({ phase: { kind: 'PROJECT_FOCUS', id: 'steady' } });
    expect(stepFocus(frame.focus, input(), 0)).toMatchObject({ id: null, amount: 0, engaged: false });
    expect(frame.focus.move.to).toBeNull();
  });
});

// ---------------------------------------------------------------- the inside, by a click

describe('a project opened: a click lifts it, and every way back sinks it at its board', () => {
  /** The frame's input as the Opening reads it: the real store and the real story, the inside with them. */
  const input = () => {
    const { phase, scene, reducedMotion, inside } = useScene.getState();
    return { phase, scene, reducedMotion, inside, progress: frame.progress, target: frame.target, shot: frame.shot };
  };
  const reset = (): void => {
    resetRouteSync();
    useScene.setState(useScene.getInitialState(), true);
    frame.progress = frame.target = frame.velocity = frame.chapterIndex = 0;
    frame.focus.move = { ...FOCUS_AT_REST, from: { ...FOCUS_AT_REST.from } };
    frame.focus.opening = null;
    frame.shot = null;
  };
  beforeEach(() => {
    reset();
    useScene.setState({ phase: { kind: 'PROJECTS', category: 'app' }, scene: 'home' });
    frame.progress = frame.target = stopForProject('steady');
  });
  afterEach(reset);

  it('lifts the open project, and sinks it when it closes, the camera on its board all the while', () => {
    const projectsAt = { kind: 'PROJECTS', category: 'app' } as const;
    expect(focusGoalFor(projectsAt, 'home', null, null, 'steady')).toBe('steady');
    expect(focusGoalFor(projectsAt, 'home', null, 'steady', null)).toBeNull();
    expect(focusGoalFor(projectsAt, 'home', null, null, 'nope' as ProjectId)).toBeNull();
    // A project page asks for its own project, and the one being opened comes first.
    expect(focusGoalFor({ kind: 'PROJECT_FOCUS', id: 'jontai-energy' }, 'project', null, null, 'steady')).toBe('jontai-energy');
    expect(focusGoalFor(projectsAt, 'home', 'cookies-clicker', null, 'steady')).toBe('cookies-clicker');
    // An inside the history brings back (Forward) fades in; out again, the story at rest at its board, it sinks.
    useScene.getState().setInside('steady');
    expect(stepFocus(frame.focus, input(), 0)).toMatchObject({ dark: true, engaged: true });
    expect(stepFocus(frame.focus, input(), 1000)).toMatchObject({ id: 'steady', amount: 1, moving: false });
    useScene.getState().setInside(null);
    frame.shot = focusShotFor('steady', LAPTOP); // where the camera stands as the way out begins
    expect(stepFocus(frame.focus, input(), 2000)).toMatchObject({ id: 'steady', amount: 1, dark: false, moving: true });
    expect(frame.focus.move).toMatchObject({ to: null, mode: 'fly' });
    expect(frame.focus.move.shot).toEqual(frame.shot);
    expect(focusPoseAt(frame.focus.move, 2000 + SINK_MS / 2).amount).toBeCloseTo(0.5, 9);
    expect(focusPoseAt(frame.focus.move, 2000 + SINK_MS)).toEqual({ id: null, amount: 0, dark: false, moving: false, engaged: false });
  });

  it('turns a lift back from where it is', () => {
    // The click's lift (openInside) and the inside with it.
    frame.focus.move = moveFocus(frame.focus.move, 'steady', 0, 'fly');
    useScene.getState().setInside('steady');
    const mid = stepFocus(frame.focus, input(), FLIGHT_MS * 0.3);
    expect(frame.focus.move.at).toBe(0); // the click's own lift goes on: no new move
    expect(mid.amount).toBeCloseTo(0.3, 9);
    // Escape part way up: it sinks from where it is, with no jump.
    useScene.getState().setInside(null);
    const turned = stepFocus(frame.focus, input(), FLIGHT_MS * 0.3);
    expect(turned.amount).toBeCloseTo(mid.amount, 12);
    expect(frame.focus.move).toMatchObject({ to: null, mode: 'fly' });
    expect(stepFocus(frame.focus, input(), FLIGHT_MS * 0.3 + SINK_MS)).toMatchObject({ id: null, amount: 0, moving: false });
  });

  it('fades in and out with reduced motion', () => {
    useScene.setState({ reducedMotion: true });
    useScene.getState().setInside('steady');
    expect(stepFocus(frame.focus, input(), 0)).toMatchObject({ dark: true });
    stepFocus(frame.focus, input(), 1000);
    useScene.getState().setInside(null);
    expect(stepFocus(frame.focus, input(), 2000)).toMatchObject({ dark: true });
    expect(frame.focus.move.mode).toBe('fade');
  });

  it("a page reached directly stands at the project's board stop, by the step fade, with reduced motion too", () => {
    for (const reducedMotion of [false, true]) {
      reset();
      useScene.setState({ reducedMotion });
      // Somewhere else on the home: the whole machine's stop.
      frame.shot = worldPathFor(LAPTOP).worldShot;
      useScene.getState().setScene('project');
      syncRoute({ pathname: '/projects/cookies-clicker/', key: 'default' }, NavigationType.Pop);
      expect(stepFocus(frame.focus, input(), 0)).toMatchObject({ dark: true });
      expect(frame.focus.move.mode).toBe('fade');
      const C = worldPathFor(LAPTOP).centre;
      const goal = focusShotFor('cookies-clicker', LAPTOP);
      // Dark on the shot it was at, then at once on the project's board stop, the project in the spot.
      expect(focusShotAt(frame.focus.move, FOCUS_FADE_MS - 1, goal, C)).toEqual(worldPathFor(LAPTOP).worldShot);
      expect(focusShotAt(frame.focus.move, FOCUS_FADE_MS, goal, C)).toEqual(goal);
      expect(stepFocus(frame.focus, input(), FOCUS_FADE_MS)).toMatchObject({ id: 'cookies-clicker', amount: 1, dark: false });
      expect(focusLiftsAt(frame.focus.move, FOCUS_FADE_MS)).toEqual({ 'cookies-clicker': 1 });
    }
  });
});

describe('opening as the object nears the spot', () => {
  it('opens the object once it is nearly in the spot', () => {
    expect(openOf(0)).toBe(0);
    expect(openOf(0.7)).toBe(0);
    expect(openOf(0.75)).toBe(0);
    expect(openOf(0.875)).toBeCloseTo(0.5, 9);
    expect(openOf(1)).toBe(1);
    let last = 0;
    for (let x = 0; x <= 1; x += 0.01) {
      expect(openOf(x)).toBeGreaterThanOrEqual(last);
      last = openOf(x);
    }
  });
});

describe('the pointer under a project page', () => {
  it("lets the pointer's parallax in under a project page, as the home under a page has it, and none while open on the home", () => {
    const shot = focusShotFor('steady', LAPTOP);
    expect(shot.sway).toBe(0);
    expect(underPage(shot, 'project')).toEqual({ ...shot, sway: 1 });
    expect(underPage(shot, 'home')).toBe(shot);
    expect(underPage(shot, null)).toBe(shot);
  });
});
