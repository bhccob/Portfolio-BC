/**
 * The compass choreography: maps scroll progress (0..1) to the pose of the
 * whole scene, which section is on, how the camera frames the dial, how much of
 * the needle the page scripts, where the ring pattern has swept to, how much of
 * the portrait and the red threads show, and how opaque each section's text is.
 * Pure and DOM-free, so it can be unit tested and read by the renderer and the
 * page on every frame.
 *
 * Every animated value moves as `a + (b - a) * smoothstep(start, end, local)`
 * inside its section, where `local` runs 0..1 over the section, and holds its
 * end value after the ramp. Each section starts where the one before it ended,
 * so the pose is continuous from the top of the page to the bottom. Bearings
 * and tilts are degrees here; the consumers convert.
 */

import { HOMES, type HomeId } from './instrument/dialSpec';

export type SectionId = 'hero' | 'about' | 'china' | 'aruba' | 'rotterdam';

/** The sections top to bottom, and how many svh of scroll each one takes. */
export const SECTIONS: readonly { id: SectionId; length: number }[] = [
  { id: 'hero', length: 100 },
  { id: 'about', length: 100 },
  { id: 'china', length: 100 },
  { id: 'aruba', length: 100 },
  { id: 'rotterdam', length: 150 }
];

/** How the camera sees the dial. */
export interface Framing {
  /** Degrees the camera sits off the dial's axis. */
  tilt: number;
  /** 1 fits the dial to its layout; larger comes closer. */
  zoom: number;
  /** The near plane, in world units. */
  near: number;
}

export interface CompassPose {
  section: SectionId;
  /** 0 at the top of the section, 1 at its bottom. */
  local: number;
  framing: Framing;
  needle: {
    /** 0 the visitor's pearl steers the needle … 1 the page scripts it. */
    weight: number;
    /** The scripted bearing, degrees clockwise from north. */
    bearing: number;
    /** 0 lying on the pin … 1 lifted clear of the face. */
    lift: number;
  };
  pattern: {
    from: HomeId;
    to: HomeId;
    /** 0 all `from` … 1 all `to`. */
    sweep: number;
    /** The bearing, degrees, the new pattern starts to paint from. */
    origin: number;
  };
  /** 0 hidden … 1 shown in the heaven pool. */
  portrait: number;
  /** 0 hidden … 1 the red threads at full strength. */
  threads: number;
  /** Each section's own text; only the current section's can be above 0. */
  text: Record<SectionId, number>;
}

/**
 * How far the dial may lean off the camera's axis, in degrees: the camera's
 * tilt, a fixed lean for the pearl, and the visitor's tip together stay inside
 * `max`.
 */
export const OFF_AXIS = { max: 35, lean: 5 } as const;

/** The most the visitor may tip the dial at a camera `tiltDeg` off the axis, in radians. */
export function tipLimit(tiltDeg: number): number {
  if (!Number.isFinite(tiltDeg)) return 0;
  return (Math.max(0, OFF_AXIS.max - tiltDeg - OFF_AXIS.lean) * Math.PI) / 180;
}

const TOTAL = SECTIONS.reduce((sum, s) => sum + s.length, 0);

/** The needle's bearings at the two homes it points at, degrees (read off HOMES). */
const CHINA_BEARING = HOMES.china.needle ?? HOMES.china.sweepFrom;
const ARUBA_BEARING = HOMES.aruba.needle ?? HOMES.aruba.sweepFrom;

/** The framing a section opens and closes at. */
const WIDE: Framing = { tilt: 22, zoom: 1, near: 0.1 };
const CLOSE: Framing = { tilt: 6, zoom: 3.8, near: 0.05 };
const SETTLED: Framing = { tilt: 18, zoom: 1, near: 0.1 };

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/** Hermite ease from 0 at `a` to 1 at `b`, flat at both ends. */
function smoothstep(a: number, b: number, x: number): number {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpFraming(a: Framing, b: Framing, t: number): Framing {
  return { tilt: lerp(a.tilt, b.tilt, t), zoom: lerp(a.zoom, b.zoom, t), near: lerp(a.near, b.near, t) };
}

/**
 * Which section `progress` falls in and how far through it. Out-of-range
 * progress is clamped and NaN counts as the top; progress 1 is the bottom of
 * the last section.
 */
export function locate(progress: number): { id: SectionId; local: number } {
  const at = Number.isNaN(progress) ? 0 : clamp01(progress) * TOTAL;
  let start = 0;
  for (let i = 0; i < SECTIONS.length - 1; i++) {
    const { id, length } = SECTIONS[i];
    if (at < start + length) return { id, local: (at - start) / length };
    start += length;
  }
  const last = SECTIONS[SECTIONS.length - 1];
  return { id: last.id, local: clamp01((at - start) / last.length) };
}

/** A section's text: in over `fadeIn`, then out over `fadeOut` (or held when `fadeOut` is omitted). */
function textOpacity(local: number, fadeIn: [number, number], fadeOut?: [number, number]): number {
  const shown = smoothstep(fadeIn[0], fadeIn[1], local);
  return fadeOut ? shown * (1 - smoothstep(fadeOut[0], fadeOut[1], local)) : shown;
}

/** The pose for scroll `progress`, 0 at the top of the page and 1 at the bottom. */
export function compassPoseAt(progress: number): CompassPose {
  const { id, local } = locate(progress);
  const text: Record<SectionId, number> = { hero: 0, about: 0, china: 0, aruba: 0, rotterdam: 0 };

  let framing: Framing = WIDE;
  let weight = 0;
  // While the page does not script the needle (weight 0) its bearing is unused; it waits at China's so it never jumps.
  let bearing = CHINA_BEARING;
  let lift = 0;
  let threads = 1;
  let portrait = 0;
  // Plain until China paints in; the origin waits at China's too, for the same reason as the bearing.
  let pattern: CompassPose['pattern'] = { from: 'plain', to: 'plain', sweep: 0, origin: HOMES.china.sweepFrom };

  switch (id) {
    case 'hero':
      // The dial lies wide in the studio with the red threads across it, the pearl steering the needle.
      text.hero = 1 - smoothstep(0.6, 0.85, local);
      break;

    case 'about':
      // The camera dives to the heaven pool; the needle lifts away, the threads fade and the portrait shows.
      framing = lerpFraming(WIDE, CLOSE, smoothstep(0, 0.45, local));
      lift = lerp(0, 1, smoothstep(0.1, 0.4, local));
      threads = lerp(1, 0.15, smoothstep(0.1, 0.4, local));
      portrait = smoothstep(0.3, 0.55, local);
      text.about = textOpacity(local, [0.35, 0.55], [0.85, 1]);
      break;

    case 'china':
      // Back out to the settled view; the needle lowers, the page takes it over and China paints in from the east.
      framing = lerpFraming(CLOSE, SETTLED, smoothstep(0, 0.3, local));
      lift = lerp(1, 0, smoothstep(0.05, 0.3, local));
      threads = lerp(0.15, 1, smoothstep(0.05, 0.3, local));
      weight = smoothstep(0.2, 0.45, local);
      portrait = 1;
      pattern = { from: 'plain', to: 'china', sweep: smoothstep(0.35, 0.85, local), origin: HOMES.china.sweepFrom };
      text.china = textOpacity(local, [0.4, 0.55], [0.85, 1]);
      break;

    case 'aruba':
      // The needle swings from east to west the long way round, through south, and Aruba paints in from the west.
      framing = SETTLED;
      weight = 1;
      bearing = lerp(CHINA_BEARING, ARUBA_BEARING, smoothstep(0, 0.4, local));
      portrait = 1;
      pattern = { from: 'china', to: 'aruba', sweep: smoothstep(0.3, 0.85, local), origin: HOMES.aruba.sweepFrom };
      text.aruba = textOpacity(local, [0.35, 0.5], [0.85, 1]);
      break;

    case 'rotterdam':
      // The needle is handed back to the pearl and Rotterdam paints in from the visitor's side; the view holds.
      framing = SETTLED;
      weight = lerp(1, 0, smoothstep(0, 0.3, local));
      bearing = ARUBA_BEARING;
      portrait = 1;
      pattern = { from: 'aruba', to: 'rotterdam', sweep: smoothstep(0.2, 0.7, local), origin: HOMES.rotterdam.sweepFrom };
      text.rotterdam = textOpacity(local, [0.3, 0.45]);
      break;
  }

  return {
    section: id,
    local,
    framing: { ...framing },
    needle: { weight, bearing, lift },
    pattern,
    portrait,
    threads,
    text
  };
}

/** The home whose pattern the ring shows whole, or 'mixed' while one is sweeping over another. */
export function visibleHome(pose: CompassPose): HomeId | 'mixed' {
  if (pose.pattern.sweep >= 1) return pose.pattern.to;
  if (pose.pattern.sweep <= 0) return pose.pattern.from;
  return 'mixed';
}
