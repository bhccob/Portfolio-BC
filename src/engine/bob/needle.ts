/**
 * The needle's angles that the opening and the home share: where it rests and
 * how it swings in at the end of the loader. They live in the engine, not in
 * the scene, so the opening's pose (~/scene/bob/openingPose) and the home's
 * aim (~/engine/bob/needleAim) both import them without an engine-to-scene
 * import. Pure, and it imports nothing from three.
 *
 * Angles are radians about the view axis, as `CompassModel.setNeedle` takes
 * them: 0 is up the screen, and positive turns clockwise as the camera sees it.
 */

/** Where the needle rests, 38 degrees clockwise from up: the preview's `38` of `needle.rotation_euler`. */
export const NEEDLE_REST = (38 * Math.PI) / 180;

/**
 * The needle's angle at `t`, how far its settle has come (the loader clock's
 * `settle` share, 0..1): `NEEDLE_REST + 1.92 e^(-4t) cos(9t)`. It starts 1.92
 * radians (110 degrees, the preview's swing in) past the rest, swings through
 * it and back with each swing smaller than the last, and is within 0.04
 * radians of the rest at `t` = 1. This is the preview's `110 exp(-4t) cos(9t)`
 * degrees, in radians.
 *
 * A `t` before the swing, or NaN, reads as 0: the swing starts, it is not
 * wound back. A `t` past 1 goes on damping.
 */
export function settleAngle(t: number): number {
  const s = t > 0 ? t : 0;
  return NEEDLE_REST + 1.92 * Math.exp(-4 * s) * Math.cos(9 * s);
}
