/**
 * Hub choreography: maps scroll progress (0..1) to the pose of the device as
 * its five layers lift apart into the hub. Pure and DOM-free so it can be unit
 * tested and read by the renderer on every frame.
 */

export type HubLayerId = 'screen' | 'frame' | 'board' | 'battery' | 'back';
export type Vec3 = readonly [number, number, number];

export interface HubPose {
  /** 0 closed … 1 fully apart. */
  explode: number;
  /** World-space Y of each layer's bottom. */
  offsets: Record<HubLayerId, number>;
  camera: { position: Vec3; target: Vec3 };
  /** 0 hidden … 1 shown: the fade-in of the callouts near the hub. */
  callouts: number;
}

/** Top to bottom. */
export const HUB_LAYERS: readonly HubLayerId[] = ['screen', 'frame', 'board', 'battery', 'back'];

/**
 * World-space Y of the bottom of each layer while the device is closed. The
 * frame ring rises from 0.05 to 0.29 around the board and battery.
 */
const CLOSED_Y: Record<HubLayerId, number> = {
  screen: 0.29,
  frame: 0.05,
  board: 0.19,
  battery: 0.05,
  back: 0
};

/** How many steps above the back plate each layer travels when fully apart. */
const INDEX_FROM_BOTTOM: Record<HubLayerId, number> = {
  screen: 4,
  frame: 3,
  board: 2,
  battery: 1,
  back: 0
};

/** How far each layer travels per step above the back plate when fully apart. */
const GAP = 1.0;

/** The explosion runs between these two progress values. */
const EXPLODE_FROM = 0.1;
const EXPLODE_TO = 0.5;

/** The callouts fade in between these two progress values. */
const CALLOUTS_FROM = 0.42;
const CALLOUTS_TO = 0.55;

/** The camera while the device is closed, and at the hub. Lerped by `explode`. */
const CLOSED_POSITION: Vec3 = [3.4, 2.6, 4.4];
const CLOSED_TARGET: Vec3 = [0, 0.15, 0];
const HUB_POSITION: Vec3 = [5.2, 6.0, 7.4];
const HUB_TARGET: Vec3 = [0.4, 2.0, 0];

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/** Hermite ease from 0 at `a` to 1 at `b`, flat at both ends. */
function smoothstep(a: number, b: number, x: number): number {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a * (1 - t) + b * t;
}

function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/** Out-of-range progress is clamped; NaN counts as the start. */
function normalise(progress: number): number {
  return Number.isNaN(progress) ? 0 : clamp01(progress);
}

export function hubPoseAt(progress: number): HubPose {
  const p = normalise(progress);
  const explode = smoothstep(EXPLODE_FROM, EXPLODE_TO, p);

  const offsets = {} as Record<HubLayerId, number>;
  HUB_LAYERS.forEach((layer) => {
    offsets[layer] = CLOSED_Y[layer] + explode * INDEX_FROM_BOTTOM[layer] * GAP;
  });

  return {
    explode,
    offsets,
    camera: {
      position: lerpVec3(CLOSED_POSITION, HUB_POSITION, explode),
      target: lerpVec3(CLOSED_TARGET, HUB_TARGET, explode)
    },
    callouts: smoothstep(CALLOUTS_FROM, CALLOUTS_TO, p)
  };
}
