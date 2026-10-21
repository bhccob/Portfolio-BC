import { AT_REST, type Stillness } from '~/engine/stillness';

/**
 * What keeps the canvas drawing. The canvas renders on demand (`frameloop="demand"`): the Heartbeat asks for the
 * next frame while anything here still moves, and the scene sleeps, drawing nothing, once all of it is still.
 * Plain mutable values, like `frame`: each part writes its own on every frame it draws, and nothing re-renders.
 */
export const motion = {
  /** The compass's stillness (engine/stillness): its needle and its drift. At rest until it is ready. */
  compass: { ...AT_REST } as Stillness,
  /** The camera's pointer parallax is still damping toward the pointer (Rig). */
  parallax: false,
  /**
   * The opening is playing (src/scene/v3/Opening.tsx): its stage is not yet `home`, so every frame moves something (the
   * laser, the pins, the camera) and the next one is wanted. False until an Opening mounts and from the landing on.
   */
  loader: false,
  /** When the scroll loop last asked for a frame (performance.now() ms), or -Infinity. */
  scrolledAt: Number.NEGATIVE_INFINITY,
};

let waker: (() => void) | null = null;

/**
 * Wakes the canvas from outside its own frame loop. The home page's scroll loop runs on requestAnimationFrame of
 * its own (src/input) and calls this each time it asks for a frame, so the canvas draws the frames in which
 * `frame.progress` moves. Nothing happens while no Stage is mounted.
 */
export function wakeScene(): void {
  motion.scrolledAt = performance.now();
  waker?.();
}

/** Called by the Stage's Heartbeat with R3F's `invalidate`; answers the unsubscribe. */
export function onWakeScene(wake: () => void): () => void {
  waker = wake;
  return () => {
    if (waker === wake) waker = null;
  };
}

/** Puts every part back at rest: the Stage is gone, and a new one starts from nothing moving. */
export function resetMotion(): void {
  Object.assign(motion.compass, AT_REST);
  motion.parallax = false;
  motion.loader = false;
}
