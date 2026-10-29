import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readClientPrefs, useScene } from '../../../src/state/store';

type Prefs = Parameters<typeof readClientPrefs>[0];

interface FakeOptions {
  stored?: string | null;
  reduce?: boolean;
  storageThrows?: boolean;
  noMatchMedia?: boolean;
}

/** A window with just the storage and the media query the store reads. */
function fakeWindow(options: FakeOptions = {}): { win: NonNullable<Prefs>; data: Map<string, string> } {
  const data = new Map<string, string>();
  // The key the switch kept its choice under, before this round.
  if (options.stored != null) data.set('needle-3d', options.stored);
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
  const win = {
    get localStorage() {
      if (options.storageThrows) throw new Error('SecurityError');
      return storage;
    },
    matchMedia: options.noMatchMedia ? undefined : (query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)' && !!options.reduce }),
  } as unknown as NonNullable<Prefs>;
  return { win, data };
}

describe('useScene', () => {
  beforeEach(() => {
    useScene.setState(useScene.getInitialState(), true);
  });

  it('starts loading, with 3D on, at the high tier and with no transition behind it', () => {
    const state = useScene.getInitialState();
    expect(state.phase).toEqual({ kind: 'LOADING' });
    expect(state.tier).toBe('high');
    expect(state.threeD).toBe(true);
    expect(state.reducedMotion).toBe(false);
    expect(state.transitionId).toBe(0);
  });

  it('moves the phase through the machine and counts the transition', () => {
    const { dispatch } = useScene.getState();
    dispatch({ type: 'LOADED' });
    expect(useScene.getState().phase).toEqual({ kind: 'HOME_IDLE' });
    expect(useScene.getState().transitionId).toBe(1);
    dispatch({ type: 'CHAPTER', chapter: 'LIGHT', category: null });
    expect(useScene.getState().transitionId).toBe(2);
  });

  it('does not count an event the machine ignores, and does not notify', () => {
    const { dispatch } = useScene.getState();
    dispatch({ type: 'LOADED' });
    const phase = useScene.getState().phase;
    const id = useScene.getState().transitionId;
    const listener = vi.fn();
    const unsubscribe = useScene.subscribe(listener);
    dispatch({ type: 'OPEN_PROJECT', id: 'steady' });
    dispatch({ type: 'LOADED' });
    dispatch({ type: 'BACK' });
    unsubscribe();
    expect(useScene.getState().phase).toBe(phase);
    expect(useScene.getState().transitionId).toBe(id);
    expect(listener).not.toHaveBeenCalled();
  });

  it('sets the tier', () => {
    useScene.getState().setTier('low');
    expect(useScene.getState().tier).toBe('low');
  });

  it('holds the scene of the page shown, none until the host says, and notifies only on a change', () => {
    expect(useScene.getInitialState().scene).toBeNull();
    const listener = vi.fn();
    const unsubscribe = useScene.subscribe(listener);
    useScene.getState().setScene('home');
    useScene.getState().setScene('home');
    useScene.getState().setScene(null);
    unsubscribe();
    expect(useScene.getState().scene).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('setThreeD', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    useScene.setState(useScene.getInitialState(), true);
  });

  // Bob (2026-10-29): the header's 3D switch is gone (spec 2026-10-29-bob-stack-3-design.md, goal 2); 3D goes off only
  // for the scene's own reasons (no WebGL, a context lost for good), for the visit.
  it('never stores the choice', () => {
    const { win, data } = fakeWindow();
    vi.stubGlobal('window', win);
    useScene.getState().setThreeD(false);
    expect(useScene.getState().threeD).toBe(false);
    useScene.getState().setThreeD(true);
    expect(useScene.getState().threeD).toBe(true);
    expect(data.size).toBe(0);
  });

  it('works where storage is unavailable', () => {
    vi.stubGlobal('window', fakeWindow({ storageThrows: true }).win);
    expect(() => useScene.getState().setThreeD(false)).not.toThrow();
    expect(useScene.getState().threeD).toBe(false);
  });

  it('works with no window at all (the prerender)', () => {
    expect(() => useScene.getState().setThreeD(false)).not.toThrow();
    expect(useScene.getState().threeD).toBe(false);
  });
});

describe('readClientPrefs', () => {
  it('keeps the defaults on the server, where there is no window', () => {
    expect(readClientPrefs(undefined)).toEqual({ threeD: true, reducedMotion: false });
  });

  it('ignores a stored choice from before: 3D is on', () => {
    for (const stored of ['off', 'on', 'banana', null]) expect(readClientPrefs(fakeWindow({ stored }).win).threeD, String(stored)).toBe(true);
  });

  it('reads the reduced-motion preference', () => {
    expect(readClientPrefs(fakeWindow({ reduce: true }).win).reducedMotion).toBe(true);
    expect(readClientPrefs(fakeWindow({ reduce: false }).win).reducedMotion).toBe(false);
  });

  it('survives storage that throws and a browser with no matchMedia', () => {
    expect(readClientPrefs(fakeWindow({ storageThrows: true, noMatchMedia: true }).win)).toEqual({ threeD: true, reducedMotion: false });
  });
});
