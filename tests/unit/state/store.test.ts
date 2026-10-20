import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readClientPrefs, THREE_D_KEY, useScene } from '../../../src/state/store';

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
  if (options.stored != null) data.set(THREE_D_KEY, options.stored);
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
    dispatch({ type: 'FOCUS_COUNTRY', dir: 'china' });
    expect(useScene.getState().transitionId).toBe(2);
  });

  it('does not count an event the machine ignores, and does not notify', () => {
    const { dispatch } = useScene.getState();
    dispatch({ type: 'LOADED' });
    const phase = useScene.getState().phase;
    const id = useScene.getState().transitionId;
    const listener = vi.fn();
    const unsubscribe = useScene.subscribe(listener);
    dispatch({ type: 'OPEN_COUNTRY' });
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

  it('sets the state and stores the choice', () => {
    const { win, data } = fakeWindow();
    vi.stubGlobal('window', win);
    useScene.getState().setThreeD(false);
    expect(useScene.getState().threeD).toBe(false);
    expect(data.get(THREE_D_KEY)).toBe('off');
    useScene.getState().setThreeD(true);
    expect(useScene.getState().threeD).toBe(true);
    expect(data.get(THREE_D_KEY)).toBe('on');
  });

  it("switches 3D off for the scene's own reasons without touching the visitor's stored choice", () => {
    const { win, data } = fakeWindow({ stored: 'on' });
    vi.stubGlobal('window', win);
    useScene.getState().setThreeD(false, { persist: false });
    expect(useScene.getState().threeD).toBe(false);
    expect(data.get(THREE_D_KEY)).toBe('on');
    const empty = fakeWindow();
    vi.stubGlobal('window', empty.win);
    useScene.getState().setThreeD(false, { persist: false });
    expect(empty.data.has(THREE_D_KEY)).toBe(false);
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

  it('reads the stored 3D choice', () => {
    expect(readClientPrefs(fakeWindow({ stored: 'off' }).win).threeD).toBe(false);
    expect(readClientPrefs(fakeWindow({ stored: 'on' }).win).threeD).toBe(true);
    expect(readClientPrefs(fakeWindow().win).threeD).toBe(true);
    expect(readClientPrefs(fakeWindow({ stored: 'banana' }).win).threeD).toBe(true);
  });

  it('reads the reduced-motion preference', () => {
    expect(readClientPrefs(fakeWindow({ reduce: true }).win).reducedMotion).toBe(true);
    expect(readClientPrefs(fakeWindow({ reduce: false }).win).reducedMotion).toBe(false);
  });

  it('survives storage that throws and a browser with no matchMedia', () => {
    expect(readClientPrefs(fakeWindow({ storageThrows: true, noMatchMedia: true }).win)).toEqual({ threeD: true, reducedMotion: false });
  });
});
