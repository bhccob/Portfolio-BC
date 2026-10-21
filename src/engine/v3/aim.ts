/**
 * How the v3 needle is aimed: from the pointer's place on the screen to a
 * bearing round the compass, how heavily the needle follows it, and the slow
 * drift that stands in for a pointer on a touch screen. It imports three only
 * for the camera maths (a ray through the pointer, a plane, a screen
 * projection) and no scene, so the aim is tested against the exact numbers
 * the scene draws.
 *
 * The frame is the dial's (src/engine/instrument/dialSpec.ts): north is -Z,
 * east is +X, and a bearing is `bearingOf(x, z)`, radians in (-PI, PI].
 */
import * as THREE from 'three';
import { COUNTRY_IDS, type CountryId } from '~/data/directions';
import { wrapAngle } from '~/engine/AngleSpring';
import { bearingOf } from '~/engine/instrument/dialSpec';
import { PLACEMENTS, starPositions } from '~/engine/v3/constellations';

/**
 * How near a star the pointer must be to snap to it, in NDC (the screen is 2
 * tall) with x scaled by the camera's aspect, so the reach is a circle on the
 * screen and not an oval: 0.07 is 3.5% of the screen's height, about 30
 * pixels on a laptop and on a phone.
 */
export const AIM_SNAP = 0.07;

/**
 * The radius of the vertical cylinder the sky rule reads the pointer on: the
 * distance of the side constellations' centres from the compass, so a cursor
 * that looks at China or Aruba above the horizon points at them.
 */
export const AIM_SHELL = PLACEMENTS.china.distance;

/**
 * The needle's spring, for `new AngleSpring(zeta, omega)`. Heavier and slower
 * than milestone 1's 0.4 and 7: it overshoots by about an eighth and settles
 * in about two seconds, so the needle trails the pointer by a slight, readable
 * delay and does not whip.
 */
export const NEEDLE_SPRING = { zeta: 0.55, omega: 3.2 } as const;

/** Every star of the three constellations, flat (x, y, z, ...), and each star's bearing: built once on first use, since the aim reads them on every pointer move. */
let stars: { xyz: Float32Array; bearings: Float64Array } | null = null;

function allStars(): { xyz: Float32Array; bearings: Float64Array } {
  if (!stars) {
    const parts = COUNTRY_IDS.map((id) => starPositions(id));
    const xyz = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of parts) {
      xyz.set(p, at);
      at += p.length;
    }
    const bearings = new Float64Array(xyz.length / 3);
    for (let i = 0; i < bearings.length; i++) bearings[i] = bearingOf(xyz[i * 3], xyz[i * 3 + 2]);
    stars = { xyz, bearings };
  }
  return stars;
}

/** The scratch objects `pointerBearing` reuses, so a pointer move allocates nothing. The module runs on one thread. */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const dialPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();
const probe = new THREE.Vector3();

/**
 * The nearest star within `AIM_SNAP` of `ndc`, as its bearing, or null. Each
 * star is put through the camera's own matrices; one behind the camera is
 * skipped, since the projection of a point behind it lands somewhere
 * unrelated on the screen.
 */
function snapToStar(ndc: { x: number; y: number }, camera: THREE.PerspectiveCamera): number | null {
  const { xyz, bearings } = allStars();
  let best = AIM_SNAP;
  let found: number | null = null;
  for (let i = 0; i < bearings.length; i++) {
    probe.set(xyz[i * 3], xyz[i * 3 + 1], xyz[i * 3 + 2]).applyMatrix4(camera.matrixWorldInverse);
    if (probe.z >= 0) continue;
    probe.applyMatrix4(camera.projectionMatrix);
    const d = Math.hypot((probe.x - ndc.x) * camera.aspect, probe.y - ndc.y);
    if (d <= best) {
      best = d;
      found = bearings[i];
    }
  }
  return found;
}

/**
 * How far along the ray (`origin + direction * t`, the direction a unit
 * vector) the sky rule's point lies, or null when the ray has none. Seen from
 * above the ray is a line and the shell a circle about the compass's axis, so
 * the meeting is the closed-form root of a quadratic in `t`. Of its two roots
 * the one farther along (the exit) is the sky point: the side of the cylinder
 * the cursor looks toward, where the constellations stand. A ray that passes
 * outside the circle (the cursor is beyond the tangent from the camera to the
 * cylinder) has the point on its line nearest the axis instead; at the tangent
 * that is the very point the two roots merge in, so the answer is continuous
 * as the cursor crosses it, and further out it keeps turning toward the
 * cursor's own side. A ray pointing straight up has no direction across the
 * ground and has no point, and neither does a ray that points away from a
 * cylinder it never reaches, or a shell with no radius.
 */
function skyDistance(origin: THREE.Vector3, direction: THREE.Vector3, shell: number): number | null {
  if (!(shell > 0)) return null;
  const a = direction.x * direction.x + direction.z * direction.z;
  if (!(a > 1e-12)) return null;
  const b = origin.x * direction.x + origin.z * direction.z;
  const disc = b * b - a * (origin.x * origin.x + origin.z * origin.z - shell * shell);
  // The exit when the ray crosses the circle, else the point of closest approach.
  const t = disc >= 0 ? (-b + Math.sqrt(disc)) / a : -b / a;
  return t >= 0 ? t : null;
}

/**
 * The bearing the needle should aim at for a pointer at `ndc` (normalised
 * device coordinates: x and y each -1 to 1, y up) as `camera` sees the scene,
 * or null if no rule applies. Three rules, in order:
 *
 * 1. Snap to a star. If any constellation star projects within `AIM_SNAP` of
 *    the pointer, the answer is the nearest one's own bearing. This comes
 *    first because the shell is a cylinder, and one pixel can lie on both its
 *    near and its far side: a side constellation is seen on both sides of the
 *    tangent line from the camera (about 119 degrees for China), so geometry
 *    alone cannot tell which star the cursor means, and the stars are what the
 *    visitor aims at. The distance is measured with x scaled by the camera's
 *    aspect.
 * 2. The ground. Otherwise, if the ray from the camera through the pointer
 *    meets the dial's plane (y = 0) ahead of the camera, and meets it before
 *    the ray reaches its sky point (rule 3), the answer is the bearing of that
 *    point, so the needle points at the part of the dial or the board under
 *    the cursor. For a ray that crosses the shell this is the ground inside
 *    it (`hypot(x, z) <= shell`) and the ground in front of it, between the
 *    camera and the shell; the ground beyond the shell, on the far side, is
 *    the sky's, so that the needle is continuous as the cursor rises through
 *    the horizon. (Ruling 6: the ground point counts only inside the shell.
 *    Read as the plain radius test it would also send the board in front of
 *    the shell, the bottom fifth of the home picture, to the far side of the
 *    cylinder, a half-turn from the point under the cursor.)
 * 3. The sky. Otherwise (the cursor is above the horizon, or the ground is
 *    beyond the sky point) the answer is the bearing of the ray's far (exit)
 *    intersection with the vertical cylinder of radius `shell`, the side the
 *    cursor looks toward; see `skyDistance` for a ray that misses the
 *    cylinder.
 *
 * Because the ground and the sky meet at the same point where the ground
 * reaches the sky point, and a ray at the horizon has the same sky point as
 * the ray just above it, the answer is continuous everywhere except where it
 * snaps to a star.
 *
 * It reads the camera's matrices after bringing its world matrix up to date,
 * so a camera moved since the last render is read where it stands now, and it
 * leaves the camera as it found it. A pointer that is not finite finds
 * nothing.
 */
export function pointerBearing(ndc: { x: number; y: number }, camera: THREE.PerspectiveCamera, shell: number): number | null {
  if (!(Number.isFinite(ndc.x) && Number.isFinite(ndc.y))) return null;
  camera.updateMatrixWorld();

  const snapped = snapToStar(ndc, camera);
  if (snapped !== null) return snapped;

  pointer.set(ndc.x, ndc.y);
  raycaster.setFromCamera(pointer, camera);
  const { origin, direction } = raycaster.ray;
  const sky = skyDistance(origin, direction, shell);
  // The distance along the ray to the dial's plane; null when it is behind the camera or parallel to it.
  const ground = raycaster.ray.distanceToPlane(dialPlane);
  if (ground !== null && (sky === null || ground <= sky)) {
    raycaster.ray.at(ground, hit);
    const bearing = bearingOf(hit.x, hit.z);
    // A ray a hair below the horizon meets the plane unimaginably far away; if that overflows, it is the sky's.
    if (Number.isFinite(bearing)) return bearing;
  }
  return sky === null ? null : bearingOf(origin.x + direction.x * sky, origin.z + direction.z * sky);
}

/** The smootherstep of `x`, 0 to 1: zero slope at both ends, so a leg of the drift starts and arrives without a jerk. */
function smootherstep(x: number): number {
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/**
 * The drift's legs, in order. Each rests on the constellation it starts from
 * for `DRIFT.rest` seconds, then travels to the next stop for `DRIFT.travel`:
 * Netherlands to China, China back to the Netherlands, the Netherlands to
 * Aruba, Aruba back to the Netherlands. The bearings are the placements' own,
 * Aruba's wrapped to -90 degrees, so every leg is the short arc and the needle
 * never sweeps through south.
 */
const DRIFT = {
  rest: 4.5,
  travel: 2.5,
  legs: [
    { from: 'netherlands', to: 'china' },
    { from: 'china', to: 'netherlands' },
    { from: 'netherlands', to: 'aruba' },
    { from: 'aruba', to: 'netherlands' }
  ]
} as const;

const DRIFT_LEG = DRIFT.rest + DRIFT.travel;
const DRIFT_CYCLE = DRIFT_LEG * DRIFT.legs.length;

/** A constellation's own bearing in radians, in (-PI, PI]. */
function placementBearing(id: CountryId): number {
  return wrapAngle((PLACEMENTS[id].bearing * Math.PI) / 180);
}

/**
 * Where the needle aims `t` seconds in, with no pointer to follow, as a
 * bearing in radians: on a touch screen the page plays this instead of a
 * pointer so the needle visits all three constellations. It visits the
 * Netherlands, China, the Netherlands, Aruba, 7 seconds each: 4.5 s resting
 * on a constellation's bearing, then 2.5 s of smootherstep travel to the next.
 * The cycle is 28 s and the motion is continuous, so the needle (which
 * follows it through its spring) never jumps. A time before zero wraps into
 * the cycle, and a NaN time reads as the start.
 */
export function touchDrift(t: number): number {
  if (!Number.isFinite(t)) return placementBearing('netherlands');
  const inCycle = ((t % DRIFT_CYCLE) + DRIFT_CYCLE) % DRIFT_CYCLE;
  const leg = Math.min(DRIFT.legs.length - 1, Math.floor(inCycle / DRIFT_LEG));
  const into = inCycle - leg * DRIFT_LEG;
  const from = placementBearing(DRIFT.legs[leg].from);
  if (into <= DRIFT.rest) return from;
  const to = placementBearing(DRIFT.legs[leg].to);
  return from + (to - from) * smootherstep((into - DRIFT.rest) / DRIFT.travel);
}
