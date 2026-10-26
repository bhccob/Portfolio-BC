import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCRIPT } from '../../../src/engine/bob/loaderTimeline';
import { debugBridge, installNeedleDebug as install, type NeedleDebugState, proofRequested } from '../../../src/debug/needleDebug';

/** A state to hand back; the bridge never looks inside it. */
function state(over: Partial<NeedleDebugState> = {}): NeedleDebugState {
  return {
    phase: { kind: 'HOME_IDLE' },
    progress: 0,
    target: 0,
    velocity: 0,
    chapter: { index: 0, id: 'HOME', local: 0, category: null },
    route: 'home',
    locale: 'nl',
    tier: 'high',
    dpr: 1.75,
    fps: 60,
    camera: { position: [0, 0, 5], fov: 30 },
    canvasMounts: 1,
    contextLost: false,
    threeD: true,
    loader: { stage: 'home', elapsed: SCRIPT.home, strokes: [0, 0, 0, 0, 1] },
    needleAngle: 0.66,
    scroll: { u: 0, letters: 0, iris: 0, needleDip: 0 },
    journey: { stretch: 'rise', local: 0, project: null, voidState: 'ready', frame: null, angle: null, sheet: 0, light: null, ring: null },
    ...over,
  };
}

/** The part of a window the bridge touches: a bag for `__needleDebug` and a requestAnimationFrame. */
type FakeWindow = { __needleDebug?: unknown; requestAnimationFrame: (callback: FrameRequestCallback) => number };

describe('installNeedleDebug', () => {
  let win: FakeWindow;
  let uninstalls: (() => void)[] = [];
  const act = { set: vi.fn(), dispatch: vi.fn(), seekLoader: vi.fn() };
  /** installNeedleDebug, with its uninstall kept so no test leaves a bridge behind for the next. */
  const installNeedleDebug: typeof install = (...args) => {
    const uninstall = install(...args);
    uninstalls.push(uninstall);
    return uninstall;
  };

  beforeEach(() => {
    win = { requestAnimationFrame: vi.fn(() => 7) };
    vi.stubGlobal('window', win);
    act.set.mockClear();
    act.dispatch.mockClear();
    act.seekLoader.mockClear();
  });
  afterEach(() => {
    for (const uninstall of uninstalls) uninstall();
    uninstalls = [];
    vi.unstubAllGlobals();
  });

  it('installs nothing without ?proof', () => {
    const read = vi.fn(state);
    for (const search of ['', '?', '?other=1', '?proofing', '?x=proof']) {
      const uninstall = installNeedleDebug(search, read, act);
      expect('__needleDebug' in win, `search ${JSON.stringify(search)}`).toBe(false);
      expect(typeof uninstall).toBe('function');
      uninstall(); // harmless
    }
    expect(debugBridge()).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });

  it('installs window.__needleDebug under ?proof, however the query is written', () => {
    for (const search of ['?proof', '?proof=1', '?a=1&proof', '?proof&a=1']) {
      const uninstall = installNeedleDebug(search, () => state(), act);
      expect(typeof (win.__needleDebug as unknown), `search ${search}`).toBe('function');
      uninstall();
      expect('__needleDebug' in win).toBe(false);
    }
  });

  it('answers read() when called, afresh each time, and does not read it until then', () => {
    let progress = 0;
    const read = vi.fn(() => state({ progress }));
    installNeedleDebug('?proof', read, act);
    expect(read).not.toHaveBeenCalled();
    const debug = win.__needleDebug as () => NeedleDebugState;
    const first = debug();
    expect(first.progress).toBe(0);
    progress = 2.5;
    expect(debug().progress).toBe(2.5);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('returns the very object read() made, so a harness can compare phases by identity', () => {
    const phase = { kind: 'PROJECT_FOCUS', id: 'funcial' } as const;
    const made = state({ phase });
    installNeedleDebug('?proof', () => made, act);
    const debug = win.__needleDebug as () => NeedleDebugState;
    expect(debug()).toBe(made);
    expect(debug().phase).toBe(phase);
  });

  it('forwards .set and .dispatch to the actions, arguments and all', () => {
    installNeedleDebug('?proof', () => state(), act);
    const debug = win.__needleDebug as { set(p: { progress: number }): void; dispatch(e: unknown): void };
    debug.set({ progress: 3.5 });
    expect(act.set).toHaveBeenCalledExactlyOnceWith({ progress: 3.5 });
    debug.dispatch({ type: 'OPEN_PROJECT', id: 'funcial' });
    expect(act.dispatch).toHaveBeenCalledExactlyOnceWith({ type: 'OPEN_PROJECT', id: 'funcial' });
  });

  it('forwards .seekLoader to the act it was given, the seconds as they came: a time to hold, or -1 to let go', () => {
    installNeedleDebug('?proof', () => state(), act);
    const debug = win.__needleDebug as { seekLoader(seconds: number): void };
    expect(typeof debug.seekLoader).toBe('function');
    debug.seekLoader(1.6);
    expect(act.seekLoader).toHaveBeenCalledExactlyOnceWith(1.6);
    debug.seekLoader(-1);
    expect(act.seekLoader).toHaveBeenLastCalledWith(-1);
    expect(act.set).not.toHaveBeenCalled();
    expect(act.dispatch).not.toHaveBeenCalled();
  });

  it("hands the opening's clock and the needle's angle through", () => {
    const made = state({ loader: { stage: 'engrave', elapsed: 2, strokes: [0, 0, 0, 0, 0.4] }, needleAngle: 1.5 });
    installNeedleDebug('?proof', () => made, act);
    const at = (win.__needleDebug as () => NeedleDebugState)();
    expect(at.loader).toEqual({ stage: 'engrave', elapsed: 2, strokes: [0, 0, 0, 0, 0.4] });
    expect(at.needleAngle).toBe(1.5);
  });

  it("has a scrollRequest the scroll loop asks its frames through, the window's requestAnimationFrame until replaced", () => {
    installNeedleDebug('?proof', () => state(), act);
    const debug = win.__needleDebug as { scrollRequest(callback: FrameRequestCallback): number };
    const callback = vi.fn();
    expect(debug.scrollRequest(callback)).toBe(7);
    expect(win.requestAnimationFrame).toHaveBeenCalledWith(callback);
    // The harness wraps it by assignment, and the next frame goes through the wrapper.
    const wrapped = vi.fn(() => 9);
    debug.scrollRequest = wrapped;
    expect(debugBridge()?.scrollRequest(callback)).toBe(9);
    expect(wrapped).toHaveBeenCalledWith(callback);
  });

  it('names the installed bridge through debugBridge() until it is uninstalled', () => {
    expect(debugBridge()).toBeNull();
    const uninstall = installNeedleDebug('?proof', () => state(), act);
    expect(debugBridge()).toBe(win.__needleDebug);
    uninstall();
    expect(debugBridge()).toBeNull();
  });

  it('uninstalls itself and nothing else: a bridge installed since stays', () => {
    const first = installNeedleDebug('?proof', () => state(), act);
    const second = installNeedleDebug('?proof', () => state({ progress: 9 }), act);
    const current = win.__needleDebug;
    first(); // the older one's uninstall finds another bridge in place
    expect(win.__needleDebug).toBe(current);
    expect(debugBridge()).toBe(current);
    second();
    expect('__needleDebug' in win).toBe(false);
    expect(debugBridge()).toBeNull();
  });

  it('does nothing where there is no window (the prerender)', () => {
    vi.unstubAllGlobals();
    expect(typeof window).toBe('undefined');
    const uninstall = installNeedleDebug('?proof', () => state(), act);
    expect(debugBridge()).toBeNull();
    uninstall();
  });
});

describe('proofRequested', () => {
  it('is true only for a query that has a proof key', () => {
    expect(proofRequested('?proof')).toBe(true);
    expect(proofRequested('?a=1&proof=')).toBe(true);
    expect(proofRequested('')).toBe(false);
    expect(proofRequested('?proofs')).toBe(false);
    expect(proofRequested('?x=proof')).toBe(false);
  });
});
