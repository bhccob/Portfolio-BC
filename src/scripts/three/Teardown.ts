/**
 * Teardown choreography: maps scroll progress (0..1) to the pose of the device
 * as it comes apart layer by layer. Pure and DOM-free so it can be unit tested
 * and read by the renderer on every frame.
 */

export type LayerId = 'shell' | 'screen' | 'board' | 'battery' | 'back';
export type SectionId = 'hello' | 'about' | 'projects' | 'offduty' | 'spec';
export type Vec3 = readonly [number, number, number];

export interface Pose {
  /** 0 closed … 1 fully apart. */
  explode: number;
  /** World-space Y of each layer. */
  offsets: Record<LayerId, number>;
  /** 0 in the stack … 1 moved aside, so a layer above the focus clears the view. */
  aside: Record<LayerId, number>;
  /** Layer the camera is on. */
  focus: LayerId | null;
  section: SectionId;
  camera: { position: Vec3; target: Vec3 };
}

/** Top to bottom. */
export const LAYERS: readonly LayerId[] = ['shell', 'screen', 'board', 'battery', 'back'];

/** Each section starts at `from` and runs to the next one's `from` (the last to 1). */
export const SECTIONS: readonly { id: SectionId; from: number; layer: LayerId | null }[] = [
  { id: 'hello', from: 0, layer: null },
  { id: 'about', from: 0.16, layer: 'screen' },
  { id: 'projects', from: 0.34, layer: 'board' },
  { id: 'offduty', from: 0.66, layer: 'battery' },
  { id: 'spec', from: 0.84, layer: 'back' }
];

/** World-space Y of each layer while the device is closed. */
const CLOSED_Y: Record<LayerId, number> = {
  shell: 0.3,
  screen: 0.24,
  board: 0.12,
  battery: 0.04,
  back: 0
};

/** How far each layer travels per step above the back plate when fully apart. */
const GAP = 0.9;

/** The explosion runs between these two progress values. */
const EXPLODE_FROM = 0.06;
const EXPLODE_TO = 0.2;

/** The opening shot, while the device is still closed. */
const HELLO_POSITION: Vec3 = [3.2, 3.0, 4.2];
const HELLO_TARGET: Vec3 = [0, 0.15, 0];

/** Where the camera sits relative to the layer it looks at. */
const FOCUS_DISTANCE: Vec3 = [0, 2.6, 3.4];

/** Share of a section's span the camera takes to arrive from the previous section. */
const ARRIVAL = 0.4;

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

function sectionIndexAt(progress: number): number {
  let index = 0;
  SECTIONS.forEach((section, i) => {
    if (progress >= section.from) index = i;
  });
  return index;
}

export function sectionAt(progress: number): SectionId {
  return SECTIONS[sectionIndexAt(normalise(progress))].id;
}

/** Where section `index` has finished arriving: ARRIVAL of its span in. */
function arrivalOf(index: number): { from: number; to: number } {
  const from = SECTIONS[index].from;
  const end = SECTIONS[index + 1]?.from ?? 1;
  return { from, to: from + ARRIVAL * (end - from) };
}

/**
 * How far `layer` has moved aside: it leaves while the camera arrives at the
 * first section that looks at a layer below it, and stays gone after. The
 * back plate has nothing below it, so it never leaves.
 */
function asideOf(layer: LayerId, progress: number): number {
  const depth = LAYERS.indexOf(layer);
  const index = SECTIONS.findIndex((section) => section.layer !== null && LAYERS.indexOf(section.layer) > depth);
  if (index < 0) return 0;
  const { from, to } = arrivalOf(index);
  return smoothstep(from, to, progress);
}

/** The camera a section settles on, given where the layers are right now. */
function cameraFor(index: number, offsets: Record<LayerId, number>): Pose['camera'] {
  const { layer } = SECTIONS[index];
  if (layer === null) return { position: [...HELLO_POSITION], target: [...HELLO_TARGET] };
  const target: Vec3 = [0, offsets[layer], 0];
  return {
    position: [
      target[0] + FOCUS_DISTANCE[0],
      target[1] + FOCUS_DISTANCE[1],
      target[2] + FOCUS_DISTANCE[2]
    ],
    target
  };
}

export function poseAt(progress: number): Pose {
  const p = normalise(progress);
  const explode = smoothstep(EXPLODE_FROM, EXPLODE_TO, p);

  const offsets = {} as Record<LayerId, number>;
  const aside = {} as Record<LayerId, number>;
  LAYERS.forEach((layer, i) => {
    const fromBottom = LAYERS.length - 1 - i;
    offsets[layer] = CLOSED_Y[layer] + explode * fromBottom * GAP;
    aside[layer] = asideOf(layer, p);
  });

  const index = sectionIndexAt(p);
  const settled = cameraFor(index, offsets);
  let camera = settled;
  if (index > 0) {
    const { from, to } = arrivalOf(index);
    const t = smoothstep(from, to, p);
    const previous = cameraFor(index - 1, offsets);
    camera = {
      position: lerpVec3(previous.position, settled.position, t),
      target: lerpVec3(previous.target, settled.target, t)
    };
  }

  return { explode, offsets, aside, focus: SECTIONS[index].layer, section: SECTIONS[index].id, camera };
}
