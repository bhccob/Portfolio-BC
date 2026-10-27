import { beforeEach, describe, expect, it, vi } from 'vitest';
import { countCanvasMount, registerStageProbe } from '../../../src/debug/stageReport';
import { holdLoader, readNeedleDebugState, setStoryProgress } from '../../../src/debug/useNeedleDebug';
import { onWakeScene } from '../../../src/scene/motion';
import { chapterAt, HOME_CHAPTERS, pathStart, scrollEnd, sheetStart } from '../../../src/state/chapters';
import { frame } from '../../../src/state/frame';
import { useScene } from '../../../src/state/store';

function resetFrame(): void {
  Object.assign(frame, { progress: 0, target: 0, velocity: 0, chapterIndex: 0, contextLost: false, loaderHold: null, needleAngle: 0 });
  Object.assign(frame.loader, { stage: null, elapsed: 0, strokes: [0, 0, 0, 0, 0] });
  Object.assign(frame.scroll, { u: 0, letters: 0, iris: 0, needleDip: 0 });
}

describe('readNeedleDebugState', () => {
  beforeEach(() => {
    useScene.setState(useScene.getInitialState(), true);
    resetFrame();
  });

  it('puts the store, the frame, the chapter and the shell together', () => {
    useScene.getState().dispatch({ type: 'LOADED' });
    useScene.getState().setTier('medium');
    Object.assign(frame, { progress: 1.5, target: 2, velocity: 0.4, chapterIndex: 1, contextLost: true });
    const state = readNeedleDebugState({ route: 'home', locale: 'en' });
    expect(state.phase).toBe(useScene.getState().phase); // the store's own object, for a harness's identity check
    expect(state).toMatchObject({
      progress: 1.5,
      target: 2,
      velocity: 0.4,
      chapter: { index: 1, id: 'LIGHT', category: null },
      route: 'home',
      locale: 'en',
      tier: 'medium',
      contextLost: true,
      threeD: true,
    });
    expect(state.chapter.local).toBeCloseTo(chapterAt(HOME_CHAPTERS, 1.5).local, 9);
  });

  it('reads the chapter the way the scroll loop does: the one it was in is kept at the edge', () => {
    // Just past the hand-over is inside Funcial's travel (it starts there) but within HYSTERESIS of the light dive's end,
    // and the frame says LIGHT.
    const hand = pathStart(HOME_CHAPTERS);
    Object.assign(frame, { progress: hand + 0.01, target: hand + 0.01, chapterIndex: 1 });
    expect(readNeedleDebugState({ route: 'home', locale: 'nl' }).chapter.index).toBe(1);
    Object.assign(frame, { progress: hand + 0.5, target: hand + 0.5, chapterIndex: 1 });
    expect(readNeedleDebugState({ route: 'home', locale: 'nl' }).chapter).toMatchObject({ index: 2, id: 'TRAVEL' });
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
    const strokes = [0, 0, 0, 0, 0.4];
    Object.assign(frame.loader, { stage: 'engrave', elapsed: 2, strokes });
    frame.needleAngle = 1.2;
    frame.loaderHold = 2;
    const state = readNeedleDebugState({ route: 'home', locale: 'nl' });
    // The three fields of the opening and nothing else of the frame's (the hold is the bridge's own business).
    expect(state.loader).toEqual({ stage: 'engrave', elapsed: 2, strokes: [0, 0, 0, 0, 0.4] });
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

  it("reports where the journey stands, its way frame, its sheet, the light's point and the path on the screen, as a copy", () => {
    const before = { ...frame.journey };
    try {
      const light = { x: 0.2, y: -0.1 };
      const beads = [{ x: 720, y: 600, r: 120, visible: true }];
      const label = { index: 0, opacity: 1 };
      Object.assign(frame.journey, { stretch: 'light', local: 0.4, project: null, voidState: 'ready', frame: 121, sheet: 0, light, beads, label, wake: [10] });
      const state = readNeedleDebugState({ route: 'home', locale: 'nl' });
      expect(state.journey).toEqual({ stretch: 'light', local: 0.4, project: null, voidState: 'ready', frame: 121, sheet: 0, light: { x: 0.2, y: -0.1 }, beads, label, wake: [10], engraved: null, nebula: null });
      expect(state.journey.beads).not.toBe(beads);
      expect(state.journey.label).not.toBe(label);
      expect(state.journey.light).not.toBe(light);
      light.x = 0.9;
      expect(state.journey.light?.x).toBe(0.2);
    } finally {
      Object.assign(frame.journey, before);
    }
  });

  it("reports the engraved way's levels on the journey: a copy, its trips a fresh array, null when unset", () => {
    const before = { ...frame.journey };
    try {
      expect(readNeedleDebugState({ route: 'home', locale: 'nl' }).journey.engraved).toBeNull();
      const engraved = { throat: 0, hall: 0.5, trips: [1, 0, 0] };
      frame.journey.engraved = engraved;
      const state = readNeedleDebugState({ route: 'home', locale: 'nl' });
      expect(state.journey.engraved).toEqual({ throat: 0, hall: 0.5, trips: [1, 0, 0] });
      expect(state.journey.engraved).not.toBe(engraved);
      expect(state.journey.engraved?.trips).not.toBe(engraved.trips);
      engraved.trips[0] = 0.2;
      expect(state.journey.engraved?.trips[0]).toBe(1);
    } finally {
      Object.assign(frame.journey, before);
    }
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
    setStoryProgress(1.5);
    expect(frame).toMatchObject({ progress: 1.5, target: 1.5, velocity: 0, chapterIndex: 1 });
    expect(useScene.getState().phase).toEqual({ kind: 'LIGHT' });
    const onTravel = pathStart(HOME_CHAPTERS) + 0.5; // on the way to Funcial
    setStoryProgress(onTravel);
    expect(frame).toMatchObject({ progress: onTravel, target: onTravel, velocity: 0, chapterIndex: 2 });
    expect(useScene.getState().phase).toEqual({ kind: 'PROJECTS', category: 'secure-element' });
  });

  it('stays inside the scroll, 0 to its last stop, the end page (the scroll ends there)', () => {
    // 2026-10-27: the scroll ends on the credits, past the light's path.
    setStoryProgress(99);
    expect(frame.target).toBe(scrollEnd(HOME_CHAPTERS));
    expect(useScene.getState().phase).toEqual({ kind: 'END' });
    setStoryProgress(sheetStart(HOME_CHAPTERS) + 0.5);
    expect(useScene.getState().phase).toEqual({ kind: 'PROJECTS', category: null });
    setStoryProgress(-4);
    expect(frame.target).toBe(0);
    expect(useScene.getState().phase).toEqual({ kind: 'HOME_IDLE' });
  });

  it("leaves a page's phase alone: the scroll phases are the only ones a chapter moves", () => {
    useScene.getState().dispatch({ type: 'ROUTE', phase: { kind: 'PROJECT_FOCUS', id: 'funcial' } });
    setStoryProgress(1.5);
    expect(useScene.getState().phase).toEqual({ kind: 'PROJECT_FOCUS', id: 'funcial' });
    expect(frame.chapterIndex).toBe(1); // but the frame is where the story is, for the way back
  });
});
