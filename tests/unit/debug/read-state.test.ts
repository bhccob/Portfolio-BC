import { beforeEach, describe, expect, it, vi } from 'vitest';
import { countCanvasMount, registerStageProbe } from '../../../src/debug/stageReport';
import { holdLoader, readNeedleDebugState, setStoryProgress } from '../../../src/debug/useNeedleDebug';
import { onWakeScene } from '../../../src/scene/motion';
import { HOME_CHAPTERS } from '../../../src/state/chapters';
import { frame } from '../../../src/state/frame';
import { useScene } from '../../../src/state/store';

function resetFrame(): void {
  Object.assign(frame, { progress: 0, target: 0, velocity: 0, chapterIndex: 0, contextLost: false, loaderHold: null, needleAngle: 0 });
  Object.assign(frame.loader, { stage: null, elapsed: 0, strokes: [0, 0, 0, 0, 0] });
}

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
    const stop = registerStageProbe(() => ({ dpr: 1.75, fps: 59, camera: { position: [0, 0, 5], fov: 30 } }));
    try {
      const live = readNeedleDebugState({ route: 'lite', locale: 'nl' });
      expect(live).toMatchObject({ dpr: 1.75, fps: 59, camera: { position: [0, 0, 5], fov: 30 } });
    } finally {
      stop();
    }
  });

  it("reports where the opening stands and the needle's angle, from the frame, as copies", () => {
    const before = readNeedleDebugState({ route: 'home', locale: 'nl' });
    expect(before.loader).toEqual({ stage: null, elapsed: 0, strokes: [0, 0, 0, 0, 0] });
    expect(before.needleAngle).toBe(0);
    const strokes = [1, 1, 0.4, 0, 0];
    Object.assign(frame.loader, { stage: 'engrave', elapsed: 4.2, strokes });
    frame.needleAngle = 1.2;
    frame.loaderHold = 4.2;
    const state = readNeedleDebugState({ route: 'home', locale: 'nl' });
    // The three fields of the opening and nothing else of the frame's (the hold is the bridge's own business).
    expect(state.loader).toEqual({ stage: 'engrave', elapsed: 4.2, strokes: [1, 1, 0.4, 0, 0] });
    expect(state.loader).not.toBe(frame.loader);
    // The strokes are a copy too: the Opening's next pose cannot change a state already read.
    expect(state.loader.strokes).not.toBe(strokes);
    expect(state.needleAngle).toBe(1.2);
  });

  it("reports the scroll's pose as the home last posed it, as a copy", () => {
    expect(readNeedleDebugState({ route: 'home', locale: 'nl' }).scroll).toEqual({ u: 0, letters: 0, iris: 0, needleDip: 0 });
    Object.assign(frame.scroll, { u: 0.5, letters: 0.32, iris: 0.67, needleDip: 0.78 });
    const state = readNeedleDebugState({ route: 'home', locale: 'nl' });
    expect(state.scroll).toEqual({ u: 0.5, letters: 0.32, iris: 0.67, needleDip: 0.78 });
    expect(state.scroll).not.toBe(frame.scroll);
    frame.scroll.u = 1;
    expect(state.scroll.u).toBe(0.5);
  });

  it('has no constellation and no pointed country: the frame and the state carry none (the countries are gone)', () => {
    const state = readNeedleDebugState({ route: 'home', locale: 'nl' });
    expect(state).not.toHaveProperty('pointed');
    expect(state).not.toHaveProperty('constellations');
    expect(frame).not.toHaveProperty('pointed');
    expect(frame).not.toHaveProperty('hoverDir');
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
    useScene.getState().dispatch({ type: 'ROUTE', phase: { kind: 'PROJECT_FOCUS', id: 'funcial' } });
    setStoryProgress(5);
    expect(useScene.getState().phase).toEqual({ kind: 'PROJECT_FOCUS', id: 'funcial' });
    expect(frame.chapterIndex).toBe(1); // but the frame is where the story is, for the way back
  });
});
