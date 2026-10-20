import { beforeEach, describe, expect, it } from 'vitest';
import { countCanvasMount, registerStageProbe } from '../../../src/debug/stageReport';
import { readNeedleDebugState, setStoryProgress } from '../../../src/debug/useNeedleDebug';
import { HOME_CHAPTERS } from '../../../src/state/chapters';
import { frame } from '../../../src/state/frame';
import { useScene } from '../../../src/state/store';

function resetFrame(): void {
  Object.assign(frame, { progress: 0, target: 0, velocity: 0, chapterIndex: 0, contextLost: false });
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
