import type { DirId } from '~/data/directions';
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
  /** The compass arm under the pointer, or null. */
  hoverDir: null as DirId | null,
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
   * visible seconds and the pins lit. The Rig reads the stage (the parallax is the home's alone); Task 12b's debug
   * bridge reports all three.
   */
  loader: { stage: null as LoaderStage | null, elapsed: 0, pins: 0 },
};
