import { AT_REST, type Stillness } from '~/engine/stillness';
import type { Phase } from '~/state/machine';

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
   * The opening is playing (src/scene/bob/Opening.tsx): its stage is not yet `home`, so every frame moves something (the
   * probe, the cut, the iris, the camera) and the next one is wanted. False until an Opening mounts and from the landing
   * on.
   */
  loader: false,
  /**
   * Something in the void moves on screen (src/scene/bob/Void.tsx): a bead's object whose clock runs (it is selected or
   * hovered) and that the camera sees, a hover still easing in or out, or Funcial's abacus sliding back down once its
   * bead is let go, about 2 s, which can run on over a project page standing over the void. False with reduced motion,
   * on a page with no scene, and while the void is not shown.
   */
  beads: false,
  /**
   * The camera is on its way into a bead's close view or back out (src/scene/bob/focus.ts): a flight eases, or a
   * fade's dark half waits for the frame that jumps the shot. Written by the Opening on each frame it poses the home.
   */
  focus: false,
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
  motion.beads = false;
  motion.focus = false;
}

/**
 * Whether a phase change keeps the canvas drawing for a while (the Heartbeat's TRANSITION_MS): every one but the change
 * into END. The end page comes in by the scroll's own frames, and once the story rests there the scene sleeps behind the
 * page at once (spec 2026-10-24-bob-end-page-design.md: it draws nothing while the page is read).
 */
export function phaseChangeDraws(phase: Phase): boolean {
  return phase.kind !== 'END';
}
