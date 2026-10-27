import { NavigationType } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { projects } from '~/data/projects';
import { INSIDE_BUILD, INSIDE_POINTS, INSIDE_STATE, insideBuild, insideClockRuns, insideFromHistory, insidePoints, opensOnClick } from '~/scene/bob/inside';
import { BEADS, journeyAt } from '~/scene/bob/journey';
import { IDLE_SECONDS } from '~/scene/bob/look';
import { frame } from '~/state/frame';
import { HOME_CHAPTERS, pathStart } from '~/state/chapters';
import { insideInHistory, noteOpenedFrom, resetRouteSync, stopForProject, syncRoute } from '~/state/routeSync';
import { useScene } from '~/state/store';

/** The path's start, the hand-over: each bead's arrival stop is past it. */
const L = pathStart(HOME_CHAPTERS);

describe('opensOnClick: where a click on a bead takes the visitor inside it', () => {
  it('opens the bead the light rests beside, and any bead in the look back, and none on the way', () => {
    // Each arrival: its own bead, and no other.
    for (const [k, bead] of BEADS.entries()) {
      const here = journeyAt(stopForProject(bead.id));
      for (const j of BEADS.keys()) expect(opensOnClick(here, j), `${bead.id}'s arrival, bead ${j}`).toBe(j === k);
    }
    // The look back, its own stop (the sheet's start) included: every bead on the way.
    for (const p of [L + 7.5, L + 8.85]) for (const j of BEADS.keys()) expect(opensOnClick(journeyAt(p), j), `at ${p}`).toBe(true);
    // The rise, the light dive, a travel, the sheet on its way up and the end page: none.
    for (const p of [0, 0.5, 1, 3, L + 0.5, L + 3, L + 9.3, L + 9.85]) {
      for (const j of BEADS.keys()) expect(opensOnClick(journeyAt(p), j), `at ${p}`).toBe(false);
    }
    // No bead past the way's own.
    expect(opensOnClick(journeyAt(L + 7.5), BEADS.length)).toBe(false);
    expect(opensOnClick(journeyAt(L + 7.5), -1)).toBe(false);
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
    expect(insideFromHistory({ 'bob-inside': 'funcial' })).toBe('funcial');
    for (const bead of BEADS) expect(insideFromHistory({ [INSIDE_STATE]: bead.id })).toBe(bead.id);
    const offPath = projects.offPath()[0]?.id ?? 'nope';
    for (const state of [null, undefined, 'funcial', 3, {}, { 'bob-inside': 'nope' }, { 'bob-inside': 7 }, { 'bob-inside': offPath }, { back: true }]) {
      expect(insideFromHistory(state), JSON.stringify(state)).toBeNull();
    }
  });
});

describe('the inside in the history (syncRoute)', () => {
  const A0 = stopForProject('funcial');
  const inside = { [INSIDE_STATE]: 'funcial' };
  const reset = (): void => {
    resetRouteSync();
    useScene.setState(useScene.getInitialState(), true);
    frame.progress = frame.target = frame.velocity = frame.chapterIndex = 0;
  };
  beforeEach(() => {
    reset();
    useScene.setState({ phase: { kind: 'PROJECTS', category: 'secure-element' } });
    frame.progress = frame.target = A0;
  });
  afterEach(reset);

  it('opens the inside of a home entry that carries it, and never of the entry the visit was loaded on', () => {
    syncRoute({ pathname: '/', key: 'default', state: inside }, NavigationType.Pop); // a reload while inside
    expect(useScene.getState().inside).toBeNull();
    expect(insideInHistory()).toBe(false);
    noteOpenedFrom('funcial', A0);
    syncRoute({ pathname: '/', key: 'k1', state: inside }, NavigationType.Push); // a click on the bead
    expect(useScene.getState().inside).toBe('funcial');
    expect(insideInHistory()).toBe(true);
    syncRoute({ pathname: '/', key: 'default' }, NavigationType.Pop); // Back
    expect(useScene.getState().inside).toBeNull();
    expect(insideInHistory()).toBe(false);
    expect([frame.progress, frame.target]).toEqual([A0, A0]); // the story stays at the arrival
  });

  it("puts the story at the bead's arrival when the history brings back an inside the story is not at", () => {
    syncRoute({ pathname: '/', key: 'default' }, NavigationType.Pop);
    noteOpenedFrom('funcial', A0);
    syncRoute({ pathname: '/', key: 'k1', state: inside }, NavigationType.Push);
    syncRoute({ pathname: '/', key: 'default' }, NavigationType.Pop);
    // Scrolled on to Jontai Energy's arrival, then Forward.
    const A1 = stopForProject('jontai-energy');
    frame.progress = frame.target = A1;
    useScene.setState({ phase: { kind: 'PROJECTS', category: 'front-panel' } });
    syncRoute({ pathname: '/', key: 'k1', state: inside }, NavigationType.Pop);
    expect(useScene.getState().inside).toBe('funcial');
    expect([frame.progress, frame.target]).toEqual([A0, A0]);
    expect(useScene.getState().phase).toEqual({ kind: 'PROJECTS', category: 'secure-element' });
  });

  it('lets the inside go on any other page, and has it again on Back from its project page', () => {
    syncRoute({ pathname: '/', key: 'default' }, NavigationType.Pop);
    noteOpenedFrom('funcial', A0);
    syncRoute({ pathname: '/', key: 'k1', state: inside }, NavigationType.Push);
    useScene.getState().dispatch({ type: 'OPEN_PROJECT', id: 'funcial' }); // Bekijk project
    syncRoute({ pathname: '/projects/funcial/', key: 'k2' }, NavigationType.Push);
    expect(useScene.getState().inside).toBeNull();
    expect(useScene.getState().phase).toEqual({ kind: 'PROJECT_FOCUS', id: 'funcial' });
    syncRoute({ pathname: '/', key: 'k1', state: inside }, NavigationType.Pop); // Back
    expect(useScene.getState().inside).toBe('funcial');
    expect(useScene.getState().phase).toEqual({ kind: 'PROJECTS', category: 'secure-element' });
    expect([frame.progress, frame.target]).toEqual([A0, A0]);
  });

  it("reads the English home's entries the same way", () => {
    syncRoute({ pathname: '/en/', key: 'default' }, NavigationType.Pop);
    noteOpenedFrom('funcial', A0);
    syncRoute({ pathname: '/en/', key: 'k1', state: inside }, NavigationType.Push);
    expect(useScene.getState().inside).toBe('funcial');
  });
});
