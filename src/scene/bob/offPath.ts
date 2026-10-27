/**
 * Where the projects that are not on the light's way stand in the look back (spec 2026-10-27-bob-light-path-design.md,
 * goal 7, Way 2): small lights beside the trail, at even steps along it, so they never crowd a bead or each other.
 * Pure: it imports nothing of three or React.
 */

type Vec3 = [number, number, number];
type R3 = readonly [number, number, number];

/** How far beside the way each light stands, m. */
export const OFF_PATH_SIDE = 0.9;

/**
 * The places of `count` lights along the way's polyline (`wayPoints`, the look back's line): light k at
 * (k + 1)/(count + 1) of its length, `OFF_PATH_SIDE` to the side of the way there (across it, level), on alternate sides.
 * None for no lights, or a way of fewer than two points.
 */
export function offPathPlaces(wayPoints: readonly R3[], count: number): Vec3[] {
  if (count <= 0 || wayPoints.length < 2) return [];
  const lengths = wayPoints.slice(1).map((p, i) => Math.hypot(p[0] - wayPoints[i]![0], p[1] - wayPoints[i]![1], p[2] - wayPoints[i]![2]));
  const total = lengths.reduce((sum, l) => sum + l, 0);
  if (!(total > 0)) return [];
  const places: Vec3[] = [];
  for (let k = 0; k < count; k++) {
    let left = ((k + 1) / (count + 1)) * total;
    let i = 0;
    while (i < lengths.length - 1 && left > lengths[i]!) left -= lengths[i++]!;
    const a = wayPoints[i]!;
    const b = wayPoints[i + 1]!;
    const l = lengths[i]! || 1;
    const along: Vec3 = [(b[0] - a[0]) / l, (b[1] - a[1]) / l, (b[2] - a[2]) / l];
    const at: Vec3 = [a[0] + along[0] * left, a[1] + along[1] * left, a[2] + along[2] * left];
    // Across the way and level: its direction crossed with up (a way straight up or down goes across +x).
    let side: Vec3 = [-along[2], 0, along[0]];
    const across = Math.hypot(side[0], side[2]);
    side = across > 1e-9 ? [side[0] / across, 0, side[2] / across] : [1, 0, 0];
    const sign = k % 2 === 0 ? 1 : -1;
    places.push([at[0] + side[0] * OFF_PATH_SIDE * sign, at[1], at[2] + side[2] * OFF_PATH_SIDE * sign]);
  }
  return places;
}
