/**
 * The laser probe's place through the loader. It once ported `probe_state` of the Blender preview
 * (tools/blender/bob_animate_o.py): the probe came down onto the circle's start, cut once round it and rose out of frame.
 * Since round 17 (spec 2026-11-01-bob-signal-loader-design.md; Bob: "B · Signal") the signal's line takes the place of
 * the descent and the cut, so the probe never comes down: it stays parked out of the picture, dark, on every path and at
 * every moment. It is still built, as its lamp is one of the scene's lights, whose count must not change mid-show
 * (~/scene/bob/Opening.tsx). It imports nothing from three.
 *
 * Lengths are world units on the glass (see ~/engine/bob/wordmark): `x` and `z` lie in the glass, and `y` is the tip's
 * height above it.
 */
import type { LoaderClock } from '~/engine/bob/loaderTimeline';

/**
 * The probe's heights, in world units: the tip's height while it cut, where it started the descent, and where it is out
 * of frame.
 */
export const PROBE = { cutY: 0.012, startY: 6, outY: 7.5 } as const;

/**
 * Where the probe is: its tip at (`x`, `y`, `z`), whether it is cutting the
 * glass now (the tip's light is on), and whether it is in the picture at all.
 */
export interface ProbeState {
  x: number;
  y: number;
  z: number;
  cutting: boolean;
  shown: boolean;
}

/** The probe out of the picture: high up on the axis, not cutting, not shown. */
function parked(): ProbeState {
  return { x: 0, y: PROBE.outY, z: 0, cutting: false, shown: false };
}

/** Where the probe is at this moment of the show: parked, whatever the clock (round 17: the signal cuts no circle). */
export function probeAt(_clock: LoaderClock): ProbeState {
  return parked();
}
