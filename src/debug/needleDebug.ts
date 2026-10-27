// Types only: the bridge is in the entry bundle and needs only these modules' shapes, none of their code. (The loader's
// timeline is in that bundle anyway, through src/scene/timeouts.ts; three.js must stay out of it.)
import type { LoaderStage } from '~/engine/bob/loaderTimeline';
import type { Locale } from '~/i18n/Translator';
import type { Stretch } from '~/scene/bob/journey';
import type { ChapterId } from '~/state/chapters';
import type { Phase, SceneEvent } from '~/state/machine';
import type { BeadOnScreen } from '~/state/frame';
import type { Tier, VoidState } from '~/state/store';

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
  /**
   * Where the opening stands, as it last posed the scene (`frame.loader`): its stage, the loader's visible seconds and
   * how much of each of the five marks is cut, in `STROKE_ORDER` (the left B, its bar, the right B, its bar, the circle;
   * the loader cuts the circle alone, so the first four stay 0; a copy). While `seekLoader` holds the clock, these are
   * the held moment's. The stage is null while no opening is mounted (3D off, no WebGL, a failed scene), so a harness
   * can tell "no loader" from any moment of one.
   */
  loader: { stage: LoaderStage | null; elapsed: number; strokes: number[] };
  /**
   * The compass needle's angle now (`frame.needleAngle`), radians: 0 up the screen, positive clockwise as the camera
   * sees it, so a pointer straight to the right of the pivot pulls it toward pi/2. 0 before any compass is posed.
   */
  needleAngle: number;
  /**
   * The scroll's pose as the home last posed it (`frame.scroll`, a copy): the rise `u`, 0 at the home and 1 looking
   * straight down on BOB, and the shares of the letters' light, the iris and the needle's dip, each 0..1 (linear in the
   * rise; the compass and the engraving ease them). With reduced motion `u` is the stop the step fade shows. All 0 while
   * nothing drives the home (the loader, a held seek, no Stage).
   */
  scroll: { u: number; letters: number; iris: number; needleDip: number };
  /**
   * Where the home's journey stands as the scene last posed it (`frame.journey`, a copy): the stretch (`rise`, `light`,
   * `travel`, `orbit`, `inside`, `look`, `sheet`, `end`), how far through it (0 at its stop), the project's place on the
   * way in a travel, an orbit or an inside (0 Funcial, 1 Jontai Energy, 2 Cookies Clicker; null elsewhere), the void's
   * load (`idle`, `loading`, `ready`, `failed`), which holds the scroll at the hand-over until it is ready, the light
   * dive's way frame (1-256, null elsewhere), how far the sheet over the look back is up (0..1), the light's centre on the
   * screen (NDC, +y up; null where there is no light), each bead on the screen (CSS px, `BEADS` order; null before the
   * path), the bead label beside the light and its opacity, how far each bead's veins have woken (radians; 10 all), and
   * the engraved way's levels (0..1: the shaft's throat and hall, and each trip's line; null where the void is not posed).
   */
  journey: {
    stretch: Stretch;
    local: number;
    project: number | null;
    voidState: VoidState;
    frame: number | null;
    sheet: number;
    light: { x: number; y: number } | null;
    beads: BeadOnScreen[] | null;
    label: { index: number; opacity: number } | null;
    wake: number[];
    engraved: { throat: number; hall: number; trips: number[] } | null;
  };
}

/** What the bridge does to the site, besides reading it. */
export interface NeedleDebugActions {
  /** Puts the story at `progress` (chapter units) at once: progress and target there, the chapter and phase with it. */
  set(p: { progress: number }): void;
  /** Sends a scene event, as the app's own parts do. */
  dispatch(e: SceneEvent): void;
  /**
   * Holds the opening's clock at `seconds` and stops it advancing, for the stills: the opening poses the whole scene at
   * that moment of a load that had landed from the start (src/scene/bob/openingStart.ts `heldLoaderInput`), so the full
   * show stands at that second of its script, every frame, until it is let go. Any negative time (-1) lets go, back to
   * the live clock.
   */
  seekLoader(seconds: number): void;
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
    seekLoader: (seconds: number) => act.seekLoader(seconds),
    scrollRequest: (callback: FrameRequestCallback) => window.requestAnimationFrame(callback),
  });
  window.__needleDebug = bridge;
  installed = bridge;
  return () => {
    if (window.__needleDebug === bridge) delete window.__needleDebug;
    if (installed === bridge) installed = null;
  };
}
