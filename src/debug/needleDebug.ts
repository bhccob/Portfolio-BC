import type { Locale } from '~/i18n/Translator';
import type { ChapterId } from '~/state/chapters';
import type { Phase, SceneEvent } from '~/state/machine';
import type { Tier } from '~/state/store';

/**
 * What the proof harness (tools/proof/needle.mjs) reads of the site, all in one place: the scene's discrete state, the
 * per-frame values and what the Stage reports. `window.__needleDebug()` answers it, under `?proof` only.
 */
export interface NeedleDebugState {
  /** The store's own phase object, not a copy: two reads give the same object while no transition happened. */
  phase: Phase;
  /** `frame.progress`, in chapter units. */
  progress: number;
  /** `frame.target`: where the scroll input has asked the story to be. */
  target: number;
  /** `frame.velocity`, units per second; exactly 0 once the story is at rest. */
  velocity: number;
  /** The chapter `progress` is in, as the scroll loop reads it (its hysteresis included). */
  chapter: { index: number; id: ChapterId; local: number; category: string | null };
  /** The kind of page the router shows (`RouteName`). */
  route: string;
  locale: Locale;
  tier: Tier;
  /** The canvas's device pixel ratio now (R3F's `viewport.dpr`); 0 while no Stage is mounted. */
  dpr: number;
  /**
   * Frames per second over the last 60 frames the canvas drew (computed in Stage, behind `?proof`). The canvas draws on
   * demand, so this is the rate it last drew at, not an average over time; 0 while there is no Stage or too few frames.
   */
  fps: number;
  /** The scene camera; position [0, 0, 0] and fov 0 while no Stage is mounted. */
  camera: { position: [number, number, number]; fov: number };
  /** How many Stages have mounted in this page view; the proof expects 1 across navigation (the canvas persists). */
  canvasMounts: number;
  /** True while the WebGL context is lost. */
  contextLost: boolean;
  threeD: boolean;
}

/** What the bridge does to the site, besides reading it. */
export interface NeedleDebugActions {
  /** Puts the story at `progress` (chapter units) at once: progress and target there, the chapter and phase with it. */
  set(p: { progress: number }): void;
  /** Sends a scene event, as the app's own parts do. */
  dispatch(e: SceneEvent): void;
}

/** `window.__needleDebug`: a function that reads the state, with the actions as properties. */
export interface NeedleDebug extends NeedleDebugActions {
  (): NeedleDebugState;
  /**
   * The scroll loop's requestAnimationFrame while the bridge is installed. The harness wraps it by assignment to count
   * the loop's own frames apart from the canvas's, which renders through R3F's. The loop calls it through the bridge it
   * found at mount, so it costs nothing where there is no bridge.
   */
  scrollRequest: (callback: FrameRequestCallback) => number;
}

declare global {
  interface Window {
    /** The proof harness's one hook; present only when the first URL of the page has `?proof`. */
    __needleDebug?: NeedleDebug;
  }
}

/** True for a query string with a `proof` key (`?proof`, `?a=1&proof`). */
export function proofRequested(search: string): boolean {
  return new URLSearchParams(search).has('proof');
}

let installed: NeedleDebug | null = null;

/**
 * The bridge now installed, or null. The parts that behave differently under `?proof` (the scroll loop's request, the
 * Stage's probe) ask once, when they mount, and never read the window per frame.
 */
export function debugBridge(): NeedleDebug | null {
  return installed;
}

/**
 * Installs `window.__needleDebug` when `search` has `proof`, and nowhere else: a visitor's page has no bridge, and no
 * part of the site then does anything on its account. `read` is called each time the bridge is. Answers the uninstall,
 * which removes this bridge and leaves any later one alone. Without a window (the prerender) it installs nothing.
 */
export function installNeedleDebug(search: string, read: () => NeedleDebugState, act: NeedleDebugActions): () => void {
  if (typeof window === 'undefined' || !proofRequested(search)) return () => {};
  const bridge: NeedleDebug = Object.assign(() => read(), {
    set: (p: { progress: number }) => act.set(p),
    dispatch: (e: SceneEvent) => act.dispatch(e),
    scrollRequest: (callback: FrameRequestCallback) => window.requestAnimationFrame(callback),
  });
  window.__needleDebug = bridge;
  installed = bridge;
  return () => {
    if (window.__needleDebug === bridge) delete window.__needleDebug;
    if (installed === bridge) installed = null;
  };
}
