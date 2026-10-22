// Types only: this module is in the entry bundle, which must not pull in three.js.
import type { LoaderStage } from '~/engine/bob/loaderTimeline';
import type { CameraShot } from '~/engine/bob/shots';

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
  /**
   * The compass needle's angle as last posed, radians: 0 up the screen, positive clockwise as the camera sees it
   * (`CompassModel.setNeedle`'s). The Opening (src/scene/bob/Opening.tsx) writes it as the needle swings in, and the
   * Home (src/scene/bob/Home.tsx) as it follows the pointer or drifts; 0 before any compass is posed. The debug bridge
   * reports it.
   */
  needleAngle: 0,
  /**
   * The scroll's pose as the Home (src/scene/bob/Home.tsx) last posed it, on each frame it drives the home: the rise `u`
   * (0 at the home, 1 looking straight down on BOB; src/scene/bob/scrollPose.ts) and the shares of the letters' light,
   * the iris and the needle's dip, each 0..1 before the setters ease them. With reduced motion the rise is the stop the
   * step fade shows, not the damped progress. All 0 while no Home drives the home. The debug bridge reports it.
   */
  scroll: { u: 0, letters: 0, iris: 0, needleDip: 0 },
  /** The index of the chapter `progress` is in (`chapterAt(...).index`). */
  chapterIndex: 0,
  /** True while the WebGL context is lost. */
  contextLost: false,
  /**
   * Where the camera should be: the shot the Opening (src/scene/bob/Opening.tsx) poses on every frame it draws, which the
   * Rig puts the camera on (adding the pointer's parallax at home). Null until an Opening has posed its first frame; the
   * Rig then leaves the camera as it is.
   */
  shot: null as CameraShot | null,
  /**
   * Where the opening stands, as the Opening last posed it: its stage (null while no Opening is mounted), the loader's
   * visible seconds, and how much of each of the five marks is cut (`STROKE_ORDER`: the left B, its bar, the right B,
   * its bar, the circle; the loader cuts the circle alone, so the first four stay 0). The Rig reads the stage (the
   * parallax is the home's alone); the debug bridge reports all three.
   */
  loader: { stage: null as LoaderStage | null, elapsed: 0, strokes: [0, 0, 0, 0, 0] as readonly number[] },
  /**
   * The loader time the proof bridge holds the opening at (`seekLoader`, behind `?proof` only), seconds, or null for
   * the live clock. While it is set the Opening poses the whole scene at that moment on every frame and the home's
   * needle waits. Nothing but the bridge sets it.
   */
  loaderHold: null as number | null,
  /**
   * When the fast-forward of a skipped loader ended, in the clock of `performance.now()` (ms), or null while no skip has
   * landed. The Opening writes it on the frame a skipped loader reaches the home (the skip's own listener prevents the
   * input until then), and sets it back to null when it mounts; the home's scroll input (src/input/useHomeScroll.ts)
   * reads it and, for `SKIP_SWALLOW_MS` after it and on while the input keeps coming (`skipSwallower`, Ruling 24),
   * drops the wheel, touch and keys it hears, still preventing them, so the tail of the gesture that skipped does not
   * scroll the home or the page.
   */
  loaderSkipEndsMs: null as number | null,
};
