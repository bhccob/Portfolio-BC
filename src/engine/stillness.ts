/**
 * When the v3 home may stop drawing. Home (src/scene/v3/Home.tsx) writes its
 * state into `motion.compass` (src/scene/motion.ts) every frame it drives the
 * needle: `idle` (its idle motion is over and the glows have arrived),
 * `needle` and `needleSpeed`; the Heartbeat (src/scene/Heartbeat.tsx) lets the
 * canvas sleep once `asleep` says nothing would move, until something stirs
 * it again. The other fields (the pearl, the drag, the spin, the tip, the
 * progress, the intro) have no writer since revision 4's compass went: they
 * stay at AT_REST's values and always read as still. Pure and DOM-free; it
 * imports nothing from three.
 */

/** Below these the scene counts as still: CSS px, radians and radians a second. */
export const STILL = { pearl: 0.05, needle: 1e-3, needleSpeed: 1e-2, spin: 1e-4, spinSpeed: 1e-3, tip: 1e-4 } as const;

export interface Stillness {
  /** Nothing has stirred the scene for a while: the v3 home's idle motion is over and its glows have arrived (src/scene/v3/Home.tsx). */
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

/**
 * Everything at rest: what `motion.compass` holds before Home first drives the needle, and again once Home has gone
 * (src/scene/motion.ts, src/scene/v3/Home.tsx). Home writes only `idle`, `needle` and `needleSpeed` over it; the
 * rest stays as here.
 */
export const AT_REST: Readonly<Stillness> = Object.freeze({
  idle: true,
  pearl: 0,
  needle: 0,
  needleSpeed: 0,
  dragging: false,
  spin: 0,
  spinSpeed: 0,
  tip: 0,
  progressed: true,
  intro: false
});

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
