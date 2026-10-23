import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { asleep } from '~/engine/stillness';
import { frame } from '~/state/frame';
import { useScene } from '~/state/store';
import { motion, onWakeScene } from './motion';

/**
 * How long a phase change keeps the canvas drawing, ms. M1 animates no transition yet (M2 and M3 bring the camera
 * moves, 1.4 s in docs/art-direction.md § 5); until then a phase change is given that long to show.
 */
export const TRANSITION_MS = 1_400;

/**
 * How recently the scroll loop must have asked for a frame for a moving story to keep the canvas drawing, ms. The
 * loop asks every frame while it runs; one disposed mid-move (the visitor left the home page) can leave
 * `frame.progress` short of `frame.target`, and the page it left for must not draw forever.
 */
const SCROLL_GRACE_MS = 250;

/**
 * The demand frame loop's pulse. On each frame drawn it asks for the next one while anything moves:
 *   - the opening is playing (`motion.loader`: its stage is not yet `home`), so the loader's clock runs on every frame
 *     until the landing, whatever the input does;
 *   - the compass is not asleep (engine/stillness: its needle drifting or still swinging);
 *   - something in the void moves on screen (`motion.beads`: a selected or hovered bead's object, a hover easing);
 *   - the pointer parallax is still damping;
 *   - the story is moving: `frame.progress` is not on `frame.target`, or `frame.velocity` is not 0, while the
 *     scroll loop runs;
 *   - a phase change is under way (TRANSITION_MS).
 * When all are still it asks for none, and the canvas draws nothing until something wakes it: the scroll loop
 * (`wakeScene`), a phase change (subscribed here), the pointer (Rig), a resize or a texture arriving.
 * While the context is lost nothing is asked for.
 *
 * On a page without a scene (the store's `scene` is null: Lite, contact, not found) the canvas sleeps behind the page:
 * nothing here asks for a frame, neither the scroll loop's wake nor a phase change, whatever still moves (an opening
 * left for Lite halfway holds its clock there). Back on a page with a scene it draws again from where it was.
 */
export function Heartbeat(): null {
  const invalidate = useThree((state) => state.invalidate);
  const transitionUntil = useRef(0);

  useEffect(
    () =>
      onWakeScene(() => {
        if (useScene.getState().scene !== null) invalidate();
      }),
    [invalidate],
  );

  useEffect(
    () =>
      useScene.subscribe((state, previous) => {
        const transition = state.transitionId !== previous.transitionId;
        if (transition) transitionUntil.current = performance.now() + TRANSITION_MS;
        if (state.scene !== null && (transition || previous.scene === null)) invalidate();
      }),
    [invalidate],
  );

  useFrame(() => {
    if (frame.contextLost || useScene.getState().scene === null) return;
    const now = performance.now();
    const scrolling = now - motion.scrolledAt < SCROLL_GRACE_MS && (frame.progress !== frame.target || Math.abs(frame.velocity) > 0);
    if (motion.loader || !asleep(motion.compass) || motion.beads || motion.parallax || scrolling || now < transitionUntil.current) invalidate();
  });

  return null;
}
