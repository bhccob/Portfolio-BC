import { NavigationType } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { projects } from '~/data/projects';
import { INSIDE_BUILD, INSIDE_POINTS, INSIDE_STATE, insideBuild, insideClockRuns, insideFromHistory, insidePoints, OPEN_LOOK, openLevels, openWorld, opensOnClick, worldClockRuns } from '~/scene/bob/inside';
import { journeyAt, WORLD_PROJECTS } from '~/scene/bob/journey';
import { IDLE_SECONDS } from '~/scene/bob/look';
import { frame } from '~/state/frame';
import { RING_MARKS } from '~/data/qa';
import { areaStop, HOME_CHAPTERS, LAND_STOP, pathStart, lookStop, qaStop, worldStop } from '~/state/chapters';
import { insideInHistory, noteOpenedFrom, resetRouteSync, stopForProject, syncRoute } from '~/state/routeSync';
import { useScene } from '~/state/store';

/** The path's start, the hand-over: the world is past it. */
const L = pathStart(HOME_CHAPTERS);

describe('opensOnClick: where a click opens a project on the world', () => {
  it('opens at rest at the world, at every area and in the look back; nowhere while moving, nor before the world', () => {
    expect(LAND_STOP).toBeCloseTo((1.26 + 0.9) / 2.43, 12);
    const rests = [worldStop(HOME_CHAPTERS), areaStop(HOME_CHAPTERS, 'app'), areaStop(HOME_CHAPTERS, 'game'), L + 7.13, lookStop(HOME_CHAPTERS)];
    for (const p of rests) {
      expect(opensOnClick(journeyAt(p), true), `at rest at ${p}`).toBe(true);
      expect(opensOnClick(journeyAt(p), false), `moving at ${p}`).toBe(false);
    }
    // The rise, the light dive, the light still coming down, the stack closing into the Q&A and the questions: none.
    for (const p of [0, 0.5, 1, 3, L + 0.5, lookStop(HOME_CHAPTERS) + 0.3, lookStop(HOME_CHAPTERS) + 1]) {
      expect(opensOnClick(journeyAt(p), true), `at ${p}`).toBe(false);
    }
    // A project's own place is a stop where it opens.
    for (const id of WORLD_PROJECTS) expect(opensOnClick(journeyAt(stopForProject(id)), true), id).toBe(true);
  });

  it('opens nothing in the Q&A', () => {
    for (let k = 0; k < RING_MARKS; k++) expect(opensOnClick(journeyAt(qaStop(HOME_CHAPTERS, k)), true), `mark ${k}`).toBe(false);
  });
});

describe('inside the bead: its objects build, its touch points show and its clock runs', () => {
  it('builds the objects as the camera goes in, whole before it is in, and shows the touch points once it is in', () => {
    expect(INSIDE_BUILD).toEqual([0.35, 0.95]);
    expect(INSIDE_POINTS).toEqual([0.8, 1]);
    expect(insideBuild(0)).toBe(0);
    expect(insideBuild(0.35)).toBe(0);
    expect(insideBuild(0.65)).toBeCloseTo(0.5, 9);
    expect(insideBuild(0.95)).toBe(1);
    expect(insideBuild(1)).toBe(1);
    expect(insidePoints(0.8)).toBe(0);
    expect(insidePoints(0.9)).toBeCloseTo(0.5, 9);
    expect(insidePoints(1)).toBe(1);
    // Out again they go the same way back: touch points first, then the objects.
    for (let a = 0; a <= 1; a += 0.05) expect(insidePoints(a)).toBeLessThanOrEqual(insideBuild(a));
    expect(insideBuild(Number.NaN)).toBe(0);
    expect(insidePoints(Number.NaN)).toBe(0);
  });

  it('runs the objects\' clock for IDLE_SECONDS after the inside opened or the pointer last moved, and never with reduced motion', () => {
    expect(IDLE_SECONDS).toBe(12);
    expect(insideClockRuns(1000, 1000, false)).toBe(true);
    expect(insideClockRuns(1000, 1000 + 11_900, false)).toBe(true);
    expect(insideClockRuns(1000, 1000 + 12_000, false)).toBe(false); // the canvas sleeps
    expect(insideClockRuns(1000, 1000, true)).toBe(false);
    expect(insideClockRuns(Number.NEGATIVE_INFINITY, 1000, false)).toBe(false);
  });
});

describe("insideFromHistory: the inside a history entry carries", () => {
  it('reads the inside only from a state this session pushed', () => {
    expect(INSIDE_STATE).toBe('bob-inside');
    expect(insideFromHistory({ 'bob-inside': 'steady' })).toBe('steady');
    for (const id of WORLD_PROJECTS) expect(insideFromHistory({ [INSIDE_STATE]: id })).toBe(id);
    const offPath = projects.offPath()[0]?.id ?? 'nope';
    for (const state of [null, undefined, 'steady', 3, {}, { 'bob-inside': 'nope' }, { 'bob-inside': 7 }, { 'bob-inside': offPath }, { back: true }]) {
      expect(insideFromHistory(state), JSON.stringify(state)).toBeNull();
    }
  });
});

describe('the inside in the history (syncRoute)', () => {
  const A0 = stopForProject('steady');
  const inside = { [INSIDE_STATE]: 'steady' };
  const reset = (): void => {
    resetRouteSync();
    useScene.setState(useScene.getInitialState(), true);
    frame.progress = frame.target = frame.velocity = frame.chapterIndex = 0;
  };
  beforeEach(() => {
    reset();
    useScene.setState({ phase: { kind: 'PROJECTS', category: 'app' } });
    frame.progress = frame.target = A0;
  });
  afterEach(reset);

  it('opens the inside of a home entry that carries it, and never of the entry the visit was loaded on', () => {
    syncRoute({ pathname: '/', key: 'default', state: inside }, NavigationType.Pop); // a reload while inside
    expect(useScene.getState().inside).toBeNull();
    expect(insideInHistory()).toBe(false);
    noteOpenedFrom('steady', A0);
    syncRoute({ pathname: '/', key: 'k1', state: inside }, NavigationType.Push); // a click on the bead
    expect(useScene.getState().inside).toBe('steady');
    expect(insideInHistory()).toBe(true);
    syncRoute({ pathname: '/', key: 'default' }, NavigationType.Pop); // Back
    expect(useScene.getState().inside).toBeNull();
    expect(insideInHistory()).toBe(false);
    expect([frame.progress, frame.target]).toEqual([A0, A0]); // the story stays at the arrival
  });

  it("puts the story at the bead's arrival when the history brings back an inside the story is not at", () => {
    syncRoute({ pathname: '/', key: 'default' }, NavigationType.Pop);
    noteOpenedFrom('steady', A0);
    syncRoute({ pathname: '/', key: 'k1', state: inside }, NavigationType.Push);
    syncRoute({ pathname: '/', key: 'default' }, NavigationType.Pop);
    // Scrolled on to Jontai Energy's arrival, then Forward.
    const A1 = stopForProject('jontai-energy');
    frame.progress = frame.target = A1;
    useScene.setState({ phase: { kind: 'PROJECTS', category: 'website' } });
    syncRoute({ pathname: '/', key: 'k1', state: inside }, NavigationType.Pop);
    expect(useScene.getState().inside).toBe('steady');
    expect([frame.progress, frame.target]).toEqual([A0, A0]);
    expect(useScene.getState().phase).toEqual({ kind: 'PROJECTS', category: 'app' });
  });

  it('lets the inside go on any other page, and has it again on Back from its project page', () => {
    syncRoute({ pathname: '/', key: 'default' }, NavigationType.Pop);
    noteOpenedFrom('steady', A0);
    syncRoute({ pathname: '/', key: 'k1', state: inside }, NavigationType.Push);
    useScene.getState().dispatch({ type: 'OPEN_PROJECT', id: 'steady' }); // Bekijk project
    syncRoute({ pathname: '/projects/steady/', key: 'k2' }, NavigationType.Push);
    expect(useScene.getState().inside).toBeNull();
    expect(useScene.getState().phase).toEqual({ kind: 'PROJECT_FOCUS', id: 'steady' });
    syncRoute({ pathname: '/', key: 'k1', state: inside }, NavigationType.Pop); // Back
    expect(useScene.getState().inside).toBe('steady');
    expect(useScene.getState().phase).toEqual({ kind: 'PROJECTS', category: 'app' });
    expect([frame.progress, frame.target]).toEqual([A0, A0]);
  });

  it("reads the English home's entries the same way", () => {
    syncRoute({ pathname: '/en/', key: 'default' }, NavigationType.Pop);
    noteOpenedFrom('steady', A0);
    syncRoute({ pathname: '/en/', key: 'k1', state: inside }, NavigationType.Push);
    expect(useScene.getState().inside).toBe('steady');
  });
});

describe("the world's clock and its look with a project open", () => {
  it("runs the world's clock for 12 s after a stir, never with reduced motion", () => {
    expect(worldClockRuns(1000, 1000, false)).toBe(true);
    expect(worldClockRuns(1000, 1000 + 11_900, false)).toBe(true);
    expect(worldClockRuns(1000, 1000 + 12_000, false)).toBe(false); // the canvas sleeps
    expect(worldClockRuns(1000, 1000, true)).toBe(false);
    expect(worldClockRuns(Number.NEGATIVE_INFINITY, 1000, false)).toBe(false);
  });

  it('dims the world, lights the open project and quiets the others as it opens', () => {
    expect(OPEN_LOOK).toEqual({ world: 0.25, focus: 1.25, others: 0.3, light: 0.34, clouds: 0.5 });
    const levels = { steady: 1, 'jontai-energy': 1.1, 'cookies-clicker': 0.5 } as const;
    expect(openLevels(levels, {}, 0)).toEqual(levels);
    expect(openLevels(levels, { steady: 0 }, 0)).toEqual(levels);
    expect(openLevels(levels, { steady: 1 }, 1)).toEqual({ steady: expect.closeTo(1.25, 12), 'jontai-energy': expect.closeTo(0.3, 12), 'cookies-clicker': expect.closeTo(0.3, 12) });
    const half = openLevels(levels, { 'jontai-energy': 0.5 }, 0.5);
    expect(half['jontai-energy']).toBeCloseTo(1.175, 12);
    expect(half.steady).toBeCloseTo(0.65, 12);
    // From one open project to the next, the world held open: the one left goes quiet as the next lights.
    const turning = openLevels(levels, { steady: 0.75, 'cookies-clicker': 0.25 }, 1);
    expect(turning.steady).toBeCloseTo(0.3 + (1.25 - 0.3) * 0.75, 12);
    expect(turning['cookies-clicker']).toBeCloseTo(0.3 + (1.25 - 0.3) * 0.25, 12);
    expect(turning['jontai-energy']).toBeCloseTo(0.3, 12);
    expect(openWorld(0)).toBe(1);
    expect(openWorld(1)).toBe(0.25);
    expect(openWorld(0.5)).toBeCloseTo(0.625, 12);
  });
});
