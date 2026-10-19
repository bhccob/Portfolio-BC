/**
 * When the compass may stop drawing: the pearl idle (20 s without input),
 * nothing dragging, no hand-over under way, the progress eased all the way,
 * and the pearl, the needle and the turn come to rest. A frame would then
 * draw nothing new, so the scene draws none, and the dust and the haze stand
 * still, until something moves again. Pure and DOM-free; it imports nothing
 * from three.
 */

/** Below these the scene counts as still: CSS px, radians and radians a second. */
export const STILL = { pearl: 0.05, needle: 1e-3, needleSpeed: 1e-2, spin: 1e-4, spinSpeed: 1e-3, tip: 1e-4 } as const;

export interface Stillness {
  /** The pearl has had no input for 20 s (PearlTarget.idle). */
  idle: boolean;
  /** CSS px between the drawn pearl and where it wants to be. */
  pearl: number;
  /** Radians between the needle and its target, and its speed. */
  needle: number;
  needleSpeed: number;
  /** A drag has hold of the dial. */
  dragging: boolean;
  /** Radians off the nearest whole turn, the spin's speed, and the tip. */
  spin: number;
  spinSpeed: number;
  tip: number;
  /** The eased progress has reached its target. */
  progressed: boolean;
  /** The hand-over's matched shot or its intro is on. */
  intro: boolean;
}

/** Whether nothing on the canvas would move. Anything not a number (NaN) counts as moving. */
export function asleep(s: Stillness): boolean {
  return (
    s.idle &&
    !s.dragging &&
    !s.intro &&
    s.progressed &&
    Math.abs(s.pearl) <= STILL.pearl &&
    Math.abs(s.needle) <= STILL.needle &&
    Math.abs(s.needleSpeed) <= STILL.needleSpeed &&
    Math.abs(s.spin) <= STILL.spin &&
    Math.abs(s.spinSpeed) <= STILL.spinSpeed &&
    Math.abs(s.tip) <= STILL.tip
  );
}
