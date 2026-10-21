import { useEffect } from 'react';
import { create } from 'zustand';
import type { SceneKind } from '~/app/handle';
import { SafeStorage } from '~/engine/core/SafeStorage';
import { type Phase, type SceneEvent, transition } from './machine';

/** The storage key of the visitor's 3D choice: "on" or "off". */
export const THREE_D_KEY = 'needle-3d';

export type Tier = 'high' | 'medium' | 'low';

export interface SceneState {
  phase: Phase;
  tier: Tier;
  /** The visitor's 3D switch. Off shows the poster and the plain page. */
  threeD: boolean;
  reducedMotion: boolean;
  /** Counts the phase changes, so the scene can tell a new transition from the same phase asked for again. */
  transitionId: number;
  /**
   * The scene of the page shown: its route's `handle.scene` (src/app/handle.ts), which SceneHost puts here for the
   * parts inside the canvas. Null on a page of text alone (and until SceneHost says): nothing wakes the canvas then.
   */
  scene: SceneKind | null;
  dispatch(event: SceneEvent): void;
  setTier(tier: Tier): void;
  setScene(scene: SceneKind | null): void;
  /**
   * Switches 3D on or off. The visitor's switch stores the choice (`needle-3d`); the scene's own reasons (no WebGL,
   * a scene that failed or never got ready) pass `{ persist: false }`, so the page falls back for this visit and the
   * visitor's stored choice stays as it was.
   */
  setThreeD(on: boolean, options?: { persist?: boolean }): void;
}

/** What the store reads from the browser; a `Window` has all of it. */
export type PrefsSource = Pick<Window, 'localStorage'> & { matchMedia?: Window['matchMedia'] };

/**
 * The visitor's settings as the browser holds them: the stored 3D choice (anything but "off" is on)
 * and the reduced-motion preference. Without a window, as in the prerender, it gives the defaults.
 * Neither a storage that throws nor a missing `matchMedia` fails it.
 */
export function readClientPrefs(win: PrefsSource | undefined): { threeD: boolean; reducedMotion: boolean } {
  if (!win) return { threeD: true, reducedMotion: false };
  let reducedMotion = false;
  try {
    reducedMotion = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    /* no media queries here: motion stays on */
  }
  return { threeD: new SafeStorage(() => win.localStorage).get(THREE_D_KEY) !== 'off', reducedMotion };
}

/**
 * The scene's discrete state. Anything that changes every frame lives in `frame.ts` instead, so that
 * nothing here is set per frame.
 *
 * The state is created with the defaults, which are also what the prerender writes, and the browser's
 * own settings are put in at the bottom of this module, when it loads on the client and before any canvas
 * mounts. React reads `getInitialState()` (the defaults) while it hydrates and the real state right after,
 * so a switch that says "3D off" for a visitor who turned it off hydrates without a mismatch.
 *
 * HYDRATION GATING (read this before gating anything on `threeD`): `useScene((s) => s.threeD)` sees the
 * default, `true`, during the hydration commit and the stored value only on the render after it. Whatever
 * mounts the WebGL Stage must therefore not gate on the hook's value in the first commit: a visitor who
 * switched 3D off would get a Stage mounted and torn down. Gate on `useScene.getState().threeD` read in an
 * effect after hydration, or on a hydrated flag (SceneHost's `useSyncExternalStore` one) combined with the
 * hook, never on the hook value alone.
 */
export const useScene = create<SceneState>()((set) => ({
  phase: { kind: 'LOADING' },
  tier: 'high',
  threeD: true,
  reducedMotion: false,
  transitionId: 0,
  scene: null,

  dispatch: (event) =>
    set((state) => {
      const phase = transition(state.phase, event);
      // The same object means nothing happened: no new transition, and returning the state notifies nobody.
      return phase === state.phase ? state : { phase, transitionId: state.transitionId + 1 };
    }),

  setTier: (tier) => set({ tier }),

  // The same scene again is no change: returning the state notifies nobody.
  setScene: (scene) => set((state) => (state.scene === scene ? state : { scene })),

  setThreeD: (on, { persist = true } = {}) => {
    if (persist) SafeStorage.local().set(THREE_D_KEY, on ? 'on' : 'off');
    set({ threeD: on });
  },
}));

if (typeof window !== 'undefined') useScene.setState(readClientPrefs(window));

/**
 * Keeps `data-3d` on <html> in step with the store: the styles read it to hide the canvas and to show
 * the home page's links. It is set after hydration (React owns <html> until then) from the store's real
 * value, not from the value React hydrated with.
 */
export function useThreeDAttribute(): void {
  useEffect(() => {
    const apply = (on: boolean): void => document.documentElement.setAttribute('data-3d', on ? 'on' : 'off');
    apply(useScene.getState().threeD);
    return useScene.subscribe((state, previous) => {
      if (state.threeD !== previous.threeD) apply(state.threeD);
    });
  }, []);
}

/**
 * Keeps `data-loading` on <html> while the phase is LOADING, and off from the moment it leaves it: the styles hide the
 * home's hero and the header while the opening plays and fade them in as the loader lands (src/styles/base.css). Built like
 * `useThreeDAttribute`: set after hydration from the store's real phase (a visit with no scene has already left
 * LOADING by then), then kept in step with every phase change.
 */
export function useLoadingAttribute(): void {
  useEffect(() => {
    const apply = (loading: boolean): void => {
      document.documentElement.toggleAttribute('data-loading', loading);
    };
    apply(useScene.getState().phase.kind === 'LOADING');
    return useScene.subscribe((state, previous) => {
      if (state.phase !== previous.phase) apply(state.phase.kind === 'LOADING');
    });
  }, []);
}
