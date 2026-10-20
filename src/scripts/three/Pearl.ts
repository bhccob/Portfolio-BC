import * as THREE from 'three';
import { blendBearing, wrapAngle } from './AngleSpring';
import type { DialLayout } from './CameraRig';
import { bearingOf, DIAL } from './instrument/dialSpec';
import { DEAD_ZONE, PEARL_REST, restAt } from './pearlSpec';

/**
 * The pearl: the glowing bead the needle chases, as a dragon chases its pearl
 * in a dragon dance. `PearlTarget` decides where on the canvas it wants to be
 * (pure and DOM-free, in CSS pixels and seconds); the scene damps the pearl
 * toward that and `Pearl` draws it there, on a plane in front of the dial.
 * `pointerBearing` reads the bearing on the dial under a point of the canvas,
 * for the needle.
 *
 * Where the pearl wants to be:
 *   - a fine pointer (mouse, trackpad): at rest below-right of the dial (below-left
 *     of the hard drive, clear of its actuator) until the pointer first moves,
 *     then on the pointer;
 *   - a coarse one (touch): drifting on a slow figure-eight about that rest
 *     spot (narrowed to fit near an edge); a touch holds it where it touched
 *     for 1.5 s, then it eases back to the drift;
 *   - a focused control (the keyboard) holds it there until the next pointer,
 *     touch or focus;
 *   - 20 s after the last input of any kind (wake() counts) it is idle: the
 *     drift pauses where it is, and carries on from there once woken, so the
 *     scene can stop drawing.
 */

/** Seconds without input before the pearl is idle. */
export const IDLE_AFTER = 20;

/** How long a touch holds the pearl, and how long it then takes to ease back to its path. */
const TOUCH = { hold: 1.5, back: 1 } as const;

/** The drift's period in seconds, and its half-extent as a share of the canvas's width and height. */
const DRIFT = { period: 14, x: 0.18, y: 0.12 } as const;

/** The pearl stays this many CSS pixels inside the canvas when resting or drifting (pearlSpec, which the loader shares). */
const MARGIN = PEARL_REST.margin;

function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/** The share of a swing of `reach` either way of `centre` that stays MARGIN inside [0, size]. */
function fit(centre: number, size: number, reach: number): number {
  const room = Math.min(centre - MARGIN, size - MARGIN - centre);
  return reach > 0 ? Math.min(1, Math.max(0, room / reach)) : 0;
}

/**
 * The drift's offset from its centre at `t` seconds on a `width` × `height`
 * canvas: a figure-eight lying on its side (twice round vertically for each
 * swing across), period 14 s, within ±0.18 w × ±0.12 h, at its centre at t = 0.
 */
export function driftAt(t: number, width: number, height: number): [number, number] {
  const a = (2 * Math.PI * (Number.isFinite(t) ? t : 0)) / DRIFT.period;
  return [DRIFT.x * width * Math.sin(a), DRIFT.y * height * Math.sin(2 * a)];
}

/**
 * Where the pearl rests: below-right of the dial, (x + 0.42 D, y + 0.42 D), kept 24 px inside the canvas (pearlSpec's
 * restAt, the loader's too); `turn` (the drive's chassis, 0..1) takes it round under the dial to the lower left, clear of
 * the drive's actuator.
 */
export function restSpot(width: number, height: number, layout: DialLayout, turn = 0): [number, number] {
  return restAt(layout.x, layout.y, layout.diameter, width, height, turn);
}

export class PearlTarget {
  /** The last input's time; the clock starts at 0 when the target is made, which counts as one. */
  private last = 0;
  /** Seconds the drift has stood still (idle) before `last`. */
  private paused = 0;
  /** Where a fine pointer last was, or null before it first moved. */
  private seen: [number, number] | null = null;
  /** A touch or focus holding the pearl: where, and until when (Infinity: until the next input). */
  private hold: { x: number; y: number; until: number } | null = null;

  constructor(private readonly finePointer: boolean) {}

  /** A mouse or pen moved to (x, y): a fine pointer's pearl follows it from now on. */
  pointer(x: number, y: number, t: number): void {
    if (!this.input(t) || !Number.isFinite(x) || !Number.isFinite(y)) return;
    this.seen = [x, y];
    this.hold = null;
  }

  /** A finger came down at (x, y): the pearl goes there for 1.5 s, then back to its drift (or the pointer). */
  touch(x: number, y: number, t: number): void {
    if (!this.input(t) || !Number.isFinite(x) || !Number.isFinite(y)) return;
    this.hold = { x, y, until: t + TOUCH.hold };
  }

  /** A control at (x, y) took the focus: the pearl stays there until the next pointer, touch or focus. */
  focus(x: number, y: number, t: number): void {
    if (!this.input(t) || !Number.isFinite(x) || !Number.isFinite(y)) return;
    this.hold = { x, y, until: Infinity };
  }

  /** Something else happened (a scroll, a key): no longer idle. Moves nothing. */
  wake(t: number): void {
    this.input(t);
  }

  /**
   * Where the pearl wants to be at `t` on a `width` × `height` canvas with the dial at `layout`, in CSS pixels; `turn`
   * moves its rest spot round under the dial (restSpot).
   */
  at(t: number, width: number, height: number, layout: DialLayout, turn = 0): [number, number] {
    const now = Number.isFinite(t) ? t : this.last;
    const base = this.base(now, width, height, layout, turn);
    const hold = this.hold;
    if (!hold) return base;
    if (now < hold.until) return [hold.x, hold.y];
    const k = smoothstep((now - hold.until) / TOUCH.back);
    if (k >= 1) return base;
    return [hold.x + (base[0] - hold.x) * k, hold.y + (base[1] - hold.y) * k];
  }

  /** True from 20 s after the last input until the next. */
  idle(t: number): boolean {
    return t - this.last > IDLE_AFTER;
  }

  /** Where the pearl goes with nothing holding it: the pointer, the rest spot, or the drift about it. */
  private base(t: number, width: number, height: number, layout: DialLayout, turn: number): [number, number] {
    if (this.finePointer) return this.seen ? [this.seen[0], this.seen[1]] : restSpot(width, height, layout, turn);
    const [x, y] = restSpot(width, height, layout, turn);
    const [dx, dy] = driftAt(this.clock(t), width, height);
    // Near an edge the eight is made narrower (or shorter) to fit, rather than flattened against it.
    return [x + dx * fit(x, width, DRIFT.x * width), y + dy * fit(y, height, DRIFT.y * height)];
  }

  /** The drift's own clock: `t` less every idle stretch, so it stops while idle and carries on after. */
  private clock(t: number): number {
    return Math.min(t, this.last + IDLE_AFTER) - this.paused;
  }

  /** Counts an input at `t`; false (and nothing counted) for a time that is not finite. */
  private input(t: number): boolean {
    if (!Number.isFinite(t)) return false;
    const idleFrom = this.last + IDLE_AFTER;
    if (t > idleFrom) this.paused += t - idleFrom;
    this.last = Math.max(this.last, t);
    return true;
  }
}

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const plane = new THREE.Plane();
const hit = new THREE.Vector3();
const normal = new THREE.Vector3();
const origin = new THREE.Vector3();

/**
 * The bearing (radians, clockwise from north, in (−π, π]) of the point on
 * `dial`'s face under the canvas point `ndcX`, `ndcY` (normalised device
 * coordinates, view offset included), seen through `camera`: the face is the
 * dial frame's y = 0 plane, so the answer is in that frame, turned with it.
 * Null within 0.15 · DIAL.rim of the pivot, where the bearing is
 * meaningless, or when the ray does not meet the face ahead of the camera.
 * The camera's and the dial's world matrices are read as they stand (the
 * dial's is brought up to date with its parents').
 */
export function pointerBearing(ndcX: number, ndcY: number, camera: THREE.Camera, dial: THREE.Object3D): number | null {
  if (!Number.isFinite(ndcX) || !Number.isFinite(ndcY)) return null;
  dial.updateWorldMatrix(true, false);
  raycaster.setFromCamera(ndc.set(ndcX, ndcY), camera);
  normal.set(0, 1, 0).transformDirection(dial.matrixWorld);
  origin.setFromMatrixPosition(dial.matrixWorld);
  plane.setFromNormalAndCoplanarPoint(normal, origin);
  if (!raycaster.ray.intersectPlane(plane, hit)) return null;
  dial.worldToLocal(hit);
  if (!(Math.hypot(hit.x, hit.z) >= DEAD_ZONE * DIAL.rim)) return null;
  return bearingOf(hit.x, hit.z);
}

/**
 * Where the needle heads, radians in the mount's frame (the dial's frame
 * before the free turn): the pearl's bearing there (pointerBearing on the
 * mount), blended by `weight` toward the scripted bearing, which is on the
 * dial and so turns with its `spin`. On the pearl, the needle holds still in
 * the world while the dial turns under it, as a real compass needle does;
 * scripted, it turns with the dial. At rest (spin a whole turn) the two
 * frames agree. The needle on the dial is then the spring's angle plus `spin`.
 */
export function needleTarget(pearl: number, scripted: number, weight: number, spin: number): number {
  return blendBearing(pearl, wrapAngle(scripted - spin), weight);
}

/**
 * The needle the loader hands over (matchDial): its bearing and velocity
 * (radians, rad/s) where they are finite numbers, the spring's own where not,
 * so a broken hand-over can neither throw the needle to north nor poison the
 * spring.
 */
export function handedNeedle(
  spring: { value: number; velocity: number },
  given: { bearing: number; velocity: number }
): { value: number; velocity: number } {
  return {
    value: Number.isFinite(given.bearing) ? given.bearing : spring.value,
    velocity: Number.isFinite(given.velocity) ? given.velocity : spring.velocity
  };
}

/**
 * World units spanning `px` CSS pixels at `depth` (along the view) in front
 * of a perspective camera `fovDeg` tall, drawing on a canvas `heightPx` tall.
 * Zero for a canvas with no height or a point not in front of the camera.
 */
export function worldAcross(px: number, depth: number, fovDeg: number, heightPx: number): number {
  if (!(heightPx > 0 && depth > 0) || !Number.isFinite(px) || !Number.isFinite(fovDeg)) return 0;
  return (px * 2 * depth * Math.tan((fovDeg * Math.PI) / 360)) / heightPx;
}

/**
 * The pearl's look: signal yellow, a soft halo, a hot core and a small warm
 * light that moves across the brass. The core and the halo are sized in CSS
 * pixels, so the pearl looks the same size at every zoom (the about push
 * comes ever closer to its plane).
 */
export const PEARL = {
  color: 0xffcf33,
  /** The halo sprite's width, CSS px (its soft falloff shows about half of it). */
  halo: 72,
  /** The core's width, CSS px, and how far over its colour it is driven (tone mapping rolls it to a white-hot cream). */
  core: 15,
  coreGain: 6,
  light: { color: 0xffd27a, intensity: 0.5, distance: 3, decay: 2 },
  /** The camera-facing plane it moves on passes this many rims in front of the face centre. */
  plane: 0.6
} as const;

const view = new THREE.Vector3();

/**
 * The pearl drawn: a halo sprite, an emissive core and a point light, always
 * in the scene (so adding it never recompiles anything), moved on a plane
 * facing the camera through a point in front of the dial's face.
 */
export class Pearl {
  readonly object = new THREE.Group();
  private readonly halo: THREE.Sprite;
  private readonly core: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  private readonly light: THREE.PointLight;
  private readonly anchor = new THREE.Vector3(0, 0, PEARL.plane * DIAL.rim);
  private readonly facing = new THREE.Plane();
  private readonly ray = new THREE.Raycaster();
  private readonly point = new THREE.Vector3();

  /** `glow` stays the caller's: the halo's soft round texture (studio/noise glowTexture). */
  constructor(glow: THREE.Texture) {
    this.object.name = 'pearl';
    this.halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        name: 'pearl:halo',
        map: glow,
        color: PEARL.color,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false
      })
    );
    this.halo.name = 'pearl:halo';
    this.halo.renderOrder = 5;
    // A sphere one unit across, scaled to its pixels by place().
    this.core = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 24, 16),
      new THREE.MeshBasicMaterial({ name: 'pearl:core', color: new THREE.Color(PEARL.color).multiplyScalar(PEARL.coreGain), fog: false })
    );
    this.core.name = 'pearl:core';
    // About its size at the hero's distance until the first place() measures it.
    this.core.scale.setScalar(0.044);
    this.halo.scale.setScalar(0.17);
    const { color, intensity, distance, decay } = PEARL.light;
    this.light = new THREE.PointLight(color, intensity, distance, decay);
    this.light.name = 'pearl:light';
    for (const part of [this.halo, this.core]) part.raycast = () => {};
    this.object.add(this.light, this.core, this.halo);
  }

  /**
   * Puts the pearl under the canvas point (x, y), in CSS pixels on a
   * `width` × `height` canvas, on the plane facing `camera` through `anchor`
   * (world; by default 0.6 · rim in front of the face centre at the origin).
   * A canvas with no size, or a ray that misses the plane, leaves it where it was.
   */
  place(x: number, y: number, camera: THREE.PerspectiveCamera, width: number, height: number, anchor?: THREE.Vector3): void {
    if (!(width > 0 && height > 0) || !Number.isFinite(x) || !Number.isFinite(y)) return;
    if (anchor) this.anchor.copy(anchor);
    camera.getWorldDirection(view);
    this.facing.setFromNormalAndCoplanarPoint(view, this.anchor);
    this.ray.setFromCamera(ndc.set((x / width) * 2 - 1, 1 - (y / height) * 2), camera);
    if (!this.ray.ray.intersectPlane(this.facing, this.point)) return;
    this.object.position.copy(this.point);
    // The same pixels at any depth: the core and the halo are scaled to the world units their widths span there.
    const unit = worldAcross(1, this.point.sub(camera.position).dot(view), camera.fov, height) / (camera.zoom || 1);
    this.core.scale.setScalar(PEARL.core * unit);
    this.halo.scale.setScalar(PEARL.halo * unit);
  }

  /** Frees the core and the halo's material and lets the light go; the glow texture stays the caller's. */
  dispose(): void {
    this.core.geometry.dispose();
    this.core.material.dispose();
    this.halo.material.dispose();
    this.light.dispose();
    this.object.removeFromParent();
  }
}
