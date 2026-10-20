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
 *   - the compass is not asleep (engine/stillness: its needle drifting or still swinging);
 *   - the pointer parallax is still damping;
 *   - the story is moving: `frame.progress` is not on `frame.target`, or `frame.velocity` is not 0, while the
 *     scroll loop runs;
 *   - a phase change is under way (TRANSITION_MS).
 * When all are still it asks for none, and the canvas draws nothing until something wakes it: the scroll loop
 * (`wakeScene`), a phase change (subscribed here), the pointer (Rig), a resize or a texture arriving.
 * While the context is lost nothing is asked for.
 */
export function Heartbeat(): null {
  const invalidate = useThree((state) => state.invalidate);
  const transitionUntil = useRef(0);

  useEffect(() => onWakeScene(() => invalidate()), [invalidate]);

  useEffect(
    () =>
      useScene.subscribe((state, previous) => {
        if (state.transitionId === previous.transitionId) return;
        transitionUntil.current = performance.now() + TRANSITION_MS;
        invalidate();
      }),
    [invalidate],
  );

  useFrame(() => {
    if (frame.contextLost) return;
    const now = performance.now();
    const scrolling = now - motion.scrolledAt < SCROLL_GRACE_MS && (frame.progress !== frame.target || Math.abs(frame.velocity) > 0);
    if (!asleep(motion.compass) || motion.parallax || scrolling || now < transitionUntil.current) invalidate();
  });

  return null;
}
