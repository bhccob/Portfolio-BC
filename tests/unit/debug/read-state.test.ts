import { beforeEach, describe, expect, it, vi } from 'vitest';
import { countCanvasMount, registerStageProbe, type StageSnapshot } from '../../../src/debug/stageReport';
import { holdLoader, readNeedleDebugState, setStoryProgress } from '../../../src/debug/useNeedleDebug';
import { onWakeScene } from '../../../src/scene/motion';
import { HOME_CHAPTERS } from '../../../src/state/chapters';
import { frame } from '../../../src/state/frame';
import { useScene } from '../../../src/state/store';

function resetFrame(): void {
  Object.assign(frame, { progress: 0, target: 0, velocity: 0, chapterIndex: 0, contextLost: false, pointed: null, loaderHold: null });
  Object.assign(frame.loader, { stage: null, elapsed: 0, pins: 0 });
}

const NO_PLACES = { china: [0, 0], netherlands: [0, 0], aruba: [0, 0] };

describe('readNeedleDebugState', () => {
  beforeEach(() => {
    useScene.setState(useScene.getInitialState(), true);
    resetFrame();
  });

  it('puts the store, the frame, the chapter and the shell together', () => {
    useScene.getState().dispatch({ type: 'LOADED' });
    useScene.getState().setTier('medium');
    Object.assign(frame, { progress: 2.5, target: 3, velocity: 0.4, chapterIndex: 1, contextLost: true });
    const state = readNeedleDebugState({ route: 'home', locale: 'en' });
    expect(state.phase).toBe(useScene.getState().phase); // the store's own object, for a harness's identity check
    expect(state).toMatchObject({
      progress: 2.5,
      target: 3,
      velocity: 0.4,
      chapter: { index: 1, id: 'DISSECT', category: null },
      route: 'home',
      locale: 'en',
      tier: 'medium',
      contextLost: true,
      threeD: true,
    });
    expect(state.chapter.local).toBeCloseTo((2.5 - 1) / 11, 9);
  });

  it('reads the chapter the way the scroll loop does: the one it was in is kept at the edge', () => {
    // 12.01 is inside MORPH (starts at 12) but within HYSTERESIS of DISSECT's end, and the frame says DISSECT.
    Object.assign(frame, { progress: 12.01, target: 12.01, chapterIndex: 1 });
    expect(readNeedleDebugState({ route: 'home', locale: 'nl' }).chapter.index).toBe(1);
    Object.assign(frame, { progress: 12.5, target: 12.5, chapterIndex: 1 });
    expect(readNeedleDebugState({ route: 'home', locale: 'nl' }).chapter).toMatchObject({ index: 2, id: 'MORPH' });
  });

  it('counts the Stages mounted and takes dpr, fps and the camera from the Stage while one reports', () => {
    countCanvasMount();
    const none = readNeedleDebugState({ route: 'lite', locale: 'nl' });
    expect(none.canvasMounts).toBeGreaterThanOrEqual(1);
    expect(none.dpr).toBe(0);
    expect(none.constellations).toEqual(NO_PLACES);
    const places: StageSnapshot['constellations'] = { china: [1238, 423], netherlands: [721, 250], aruba: [206, 382] };
    const stop = registerStageProbe(() => ({ dpr: 1.75, fps: 59, camera: { position: [0, 0, 5], fov: 30 }, constellations: places }));
    try {
      const live = readNeedleDebugState({ route: 'lite', locale: 'nl' });
      expect(live).toMatchObject({ dpr: 1.75, fps: 59, camera: { position: [0, 0, 5], fov: 30 } });
      expect(live.constellations).toEqual(places);
    } finally {
      stop();
    }
  });

  it("reports where the opening stands and the constellation pointed at, from the frame, as a copy of the opening's fields", () => {
    const before = readNeedleDebugState({ route: 'home', locale: 'nl' });
    expect(before.loader).toEqual({ stage: null, elapsed: 0, pins: 0 });
    expect(before.pointed).toBeNull();
    Object.assign(frame.loader, { stage: 'engrave', elapsed: 0.6, pins: 17 });
    frame.pointed = 'aruba';
    frame.loaderHold = 0.6;
    const state = readNeedleDebugState({ route: 'home', locale: 'nl' });
    // The three fields the brief names and nothing else of the frame's (the hold is the bridge's own business).
    expect(state.loader).toEqual({ stage: 'engrave', elapsed: 0.6, pins: 17 });
    expect(state.loader).not.toBe(frame.loader);
    expect(state.pointed).toBe('aruba');
  });
});

describe('holdLoader', () => {
  beforeEach(() => resetFrame());

  it("holds the opening's clock at a time, and wakes the canvas to draw it", () => {
    const wake = vi.fn();
    const stop = onWakeScene(wake);
    try {
      holdLoader(1.6);
      expect(frame.loaderHold).toBe(1.6);
      expect(wake).toHaveBeenCalledOnce();
      holdLoader(0);
      expect(frame.loaderHold).toBe(0);
    } finally {
      stop();
    }
  });

  it('lets go for -1, any negative time or a time that is not a number, and wakes the canvas for that too', () => {
    const wake = vi.fn();
    const stop = onWakeScene(wake);
    try {
      for (const seconds of [-1, -0.001, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        frame.loaderHold = 2;
        holdLoader(seconds);
        expect(frame.loaderHold, `seconds ${seconds}`).toBeNull();
      }
      expect(wake).toHaveBeenCalledTimes(5);
    } finally {
      stop();
    }
  });
});

describe('setStoryProgress', () => {
  beforeEach(() => {
    useScene.setState(useScene.getInitialState(), true);
    useScene.getState().dispatch({ type: 'LOADED' });
    resetFrame();
  });

  it('puts the story at a place: progress and target there, nothing moving, the chapter and the phase with it', () => {
    setStoryProgress(13);
    expect(frame).toMatchObject({ progress: 13, target: 13, velocity: 0, chapterIndex: 2 });
    expect(useScene.getState().phase).toEqual({ kind: 'MORPH' });
  });

  it('stays inside the story', () => {
    setStoryProgress(99);
    expect(frame.target).toBe(HOME_CHAPTERS.total);
    expect(useScene.getState().phase).toEqual({ kind: 'PROJECTS', category: HOME_CHAPTERS.units.at(-1)!.category });
    setStoryProgress(-4);
    expect(frame.target).toBe(0);
    expect(useScene.getState().phase).toEqual({ kind: 'HOME_IDLE' });
  });

  it("leaves a page's phase alone: the scroll phases are the only ones a chapter moves", () => {
    useScene.getState().dispatch({ type: 'ROUTE', phase: { kind: 'COUNTRY_PAGE', dir: 'china' } });
    setStoryProgress(5);
    expect(useScene.getState().phase).toEqual({ kind: 'COUNTRY_PAGE', dir: 'china' });
    expect(frame.chapterIndex).toBe(1); // but the frame is where the story is, for the way back
  });
});
