import type { CountryId, DirId } from '~/data/directions';
// Types only: this module is in the entry bundle, which must not pull in three.js (shots.ts places a camera with it).
import type { LoaderStage } from '~/engine/v3/loaderTimeline';
import type { CameraShot } from '~/engine/v3/shots';

/**
 * The values that change every frame. This is a plain mutable object, never React state and never in
 * the zustand store: the scroll input writes it, the scene's frame loop reads it, and nothing re-renders.
 * Discrete changes (a chapter, a phase) go through `useScene.dispatch` instead.
 */
export const frame = {
  /** Where the scene is on the scroll axis, in chapter units, damped toward `target`. */
  progress: 0,
  /** Where the scroll input has asked it to be. */
  target: 0,
  /** How fast `progress` is moving, in units per second. */
  velocity: 0,
  /** The pointer in normalised device coordinates, -1 to 1. */
  pointer: { x: 0, y: 0 },
  /**
   * When a mouse or pen last moved over the page (`performance.now()` ms; the Rig writes it with `pointer`), or
   * -Infinity before the first move. The home's needle follows the pointer only once it has moved (a pointer still at
   * its starting {0, 0} has said nothing), and a move at home starts its idle while again.
   */
  pointerAt: Number.NEGATIVE_INFINITY,
  /** The compass arm under the pointer, or null. */
  hoverDir: null as DirId | null,
  /**
   * The constellation the home's needle points at (src/scene/v3/Home.tsx, by `pointedAt`), or null: the needle points
   * into the dark between them, or there is no home to point in (no Stage, the loader still playing, or held by a seek).
   */
  pointed: null as CountryId | null,
  /** The index of the chapter `progress` is in (`chapterAt(...).index`). */
  chapterIndex: 0,
  /** True while the WebGL context is lost. */
  contextLost: false,
  /**
   * Where the camera should be: the shot the Opening (src/scene/v3/Opening.tsx) poses on every frame it draws, which the
   * Rig puts the camera on (adding the pointer's parallax at home). Null until an Opening has posed its first frame; the
   * Rig then leaves the camera as it is.
   */
  shot: null as CameraShot | null,
  /**
   * Where the opening stands, as the Opening last posed it: its stage (null while no Opening is mounted), the loader's
   * visible seconds and the pins lit. The Rig reads the stage (the parallax is the home's alone); the debug bridge
   * reports all three.
   */
  loader: { stage: null as LoaderStage | null, elapsed: 0, pins: 0 },
  /**
   * The loader time the proof bridge holds the opening at (`seekLoader`, behind `?proof` only), seconds, or null for
   * the live clock. While it is set the Opening poses the whole scene at that moment on every frame and the home's
   * needle waits (Ruling 2). Nothing but the bridge sets it.
   */
  loaderHold: null as number | null,
  /**
   * When the fast-forward of a skipped loader ends, in the clock of `performance.now()` (ms), or null while no skip has
   * been asked for. The Opening writes it when the visitor skips; the home's scroll input (src/input/useHomeScroll.ts)
   * reads it and, until `SKIP_SWALLOW_MS` after it (`skipSwallows`), drops the wheel, touch and keys it hears, still
   * preventing them, so the tail of the gesture that skipped does not scroll the home or the page.
   */
  loaderSkipEndsMs: null as number | null,
};
