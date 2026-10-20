/**
 * The compass choreography: maps scroll progress (0..1) to the pose of the
 * whole scene, which section is on, how the camera frames the dial, how much of
 * the needle the page scripts, where the ring pattern has swept to, how much of
 * the portrait and the red threads show, Ørsted's wire, how far the compass has
 * turned into a hard drive and where its head and tracks stand, and how opaque
 * each section's text is. Pure and DOM-free (it imports nothing from three,
 * gsap or lenis), so it can be unit tested and read by the renderer and the
 * page on every frame.
 *
 * Every animated value moves as `a + (b - a) * smoothstep(start, end, local)`
 * inside its section, where `local` runs 0..1 over the section, and holds its
 * end value after the ramp. Each section starts where the one before it ended,
 * so the pose is continuous from the top of the page to the bottom. Bearings
 * and tilts are degrees here; the consumers convert. A bearing is never
 * wrapped here and may be negative.
 *
 * A section's share of the scroll is its `Span`, the nominal one from SECTIONS'
 * lengths (the Q&A takes as many svh as its content, so the nominal spans
 * guess it) or one the page measured (`spansFromOffsets`). The pose at a
 * position is `poseAt(id, local)` of the span it falls in.
 */

import { HOMES, type HomeId } from './instrument/dialSpec';
import { DRIVE, TRACKS, type TrackId } from './instrument/drive';

export type SectionId =
  | 'hero'
  | 'about'
  | 'china'
  | 'aruba'
  | 'rotterdam'
  | 'current'
  | 'stack'
  | 'ai'
  | 'change'
  | TrackId
  | 'offduty'
  | 'qa'
  | 'hello';

/** The sections top to bottom, and how many svh of scroll each one takes; null is as tall as its content (the Q&A). */
export const SECTIONS: readonly { id: SectionId; length: number | null }[] = [
  { id: 'hero', length: 100 },
  { id: 'about', length: 100 },
  { id: 'china', length: 100 },
  { id: 'aruba', length: 100 },
  { id: 'rotterdam', length: 150 },
  { id: 'current', length: 100 },
  { id: 'stack', length: 100 },
  { id: 'ai', length: 100 },
  { id: 'change', length: 200 },
  { id: 'funcial', length: 150 },
  { id: 'jontai-energy', length: 150 },
  { id: 'cookies-clicker', length: 150 },
  { id: 'next', length: 100 },
  { id: 'offduty', length: 150 },
  { id: 'qa', length: null },
  { id: 'hello', length: 150 }
];

/** A section's place in the scroll, in shares of the whole of it (0..1). */
export interface Span {
  id: SectionId;
  start: number;
  length: number;
}

/** The Q&A's height, svh, where the page has not measured it. */
const NOMINAL_QA = 100;
/** The least length a measured section keeps, so no span has none and nothing divides by zero. */
const TINY = 1e-6;

/** `x` where it is a positive finite number, else `fallback`. */
function positive(x: number, fallback: number): number {
  return Number.isFinite(x) && x > 0 ? x : fallback;
}

/** The spans from SECTIONS' lengths, the Q&A `qaLength` svh tall. */
export function nominalSpans(qaLength: number = NOMINAL_QA): Span[] {
  const qa = positive(qaLength, NOMINAL_QA);
  const lengths = SECTIONS.map((s) => s.length ?? qa);
  const total = lengths.reduce((sum, length) => sum + length, 0);
  let at = 0;
  return SECTIONS.map(({ id }, k) => {
    const span = { id, start: at / total, length: lengths[k] / total };
    at += lengths[k];
    return span;
  });
}

/**
 * The spans the page measured: `tops` are each section's top in px from the top
 * of the scroll track, in the order given, and the last section runs to
 * `scrollRange` (the track's scrollable px). A length is the next top less this
 * one's, and everything is divided by `scrollRange`. A scroll range that is not
 * positive, or a length that is not, is replaced by a tiny positive one.
 */
export function spansFromOffsets(tops: readonly { id: SectionId; top: number }[], scrollRange: number): Span[] {
  const range = positive(scrollRange, TINY);
  return tops.map(({ id, top }, k) => {
    const next = k + 1 < tops.length ? tops[k + 1].top : scrollRange;
    return { id, start: Number.isFinite(top) ? top / range : 0, length: positive((next - top) / range, TINY) };
  });
}

/** The nominal spans, computed once: the default for everything that reads a position. */
const NOMINAL_SPANS: readonly Span[] = nominalSpans();

/** Where each section stands in SECTIONS, to tell the ones before the current from the ones after. */
const ORDER = Object.fromEntries(SECTIONS.map(({ id }, k) => [id, k])) as Record<SectionId, number>;

/** How the camera sees the dial. */
export interface Framing {
  /** Degrees the camera sits off the dial's axis. */
  tilt: number;
  /** 1 fits the dial to its layout; larger comes closer. */
  zoom: number;
  /** The near plane, in world units. */
  near: number;
  /** 0 the dial's own layout … 1 the side layout, small at the right beside the Q&A. */
  side: number;
}

export interface CompassPose {
  section: SectionId;
  /** 0 at the top of the section, 1 at its bottom. */
  local: number;
  framing: Framing;
  needle: {
    /** 0 the visitor's pearl steers the needle … 1 the page scripts it. */
    weight: number;
    /** The scripted bearing, degrees clockwise from north; never wrapped, so it may be negative. */
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
  /** Ørsted's wire laid over the needle. */
  wire: {
    /** 0 hidden … 1 shown, as one of the bridge's cables. */
    show: number;
    /** 0 lying on the ring … 1 lifted across the dial above the needle. */
    lift: number;
    /** 0 straight … 1 wound into the voice coil. */
    wind: number;
    /** -1 no pulse of current, else 0..1 along the wire. */
    pulse: number;
  };
  /** How far each part of the compass has turned into the hard drive's: 0 compass … 1 drive. */
  drive: { stack: number; mirror: number; grow: number; clamp: number; arm: number; chassis: number };
  /** The read head's radius from the centre. */
  head: number;
  /** 0 the head on its track … 1 parked on the ramp. */
  park: number;
  /** The platter's turn, degrees, counter-clockwise as seen. */
  platter: number;
  tracks: {
    /** How lit each track is. */
    lit: Record<TrackId, number>;
    /** The test point under the head, or null between test points. */
    tp: 0 | 1 | 2 | 3 | null;
    /** The track under the head, or null where none is. */
    current: TrackId | null;
  };
  /** 0 the drive at full brightness … 1 dimmed for the Q&A. */
  dim: number;
  /** Whether the tracks answer the pointer. */
  interactive: boolean;
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

/** The needle's bearings at the two homes it points at, degrees (read off HOMES). */
const CHINA_BEARING = HOMES.china.needle ?? HOMES.china.sweepFrom;
const ARUBA_BEARING = HOMES.aruba.needle ?? HOMES.aruba.sweepFrom;

/** The framings a section opens and closes at. */
const WIDE: Framing = { tilt: 22, zoom: 1, near: 0.1, side: 0 };
const CLOSE: Framing = { tilt: 6, zoom: 3.8, near: 0.05, side: 0 };
const SETTLED: Framing = { tilt: 18, zoom: 1, near: 0.1, side: 0 };
const CURRENT: Framing = { tilt: 24, zoom: 1.1, near: 0.1, side: 0 };
const DRIVE_VIEW: Framing = { tilt: 28, zoom: 0.92, near: 0.1, side: 0 };
const TRACK: Framing = { tilt: 26, zoom: 1.15, near: 0.1, side: 0 };
const SPINDLE: Framing = { tilt: 30, zoom: 2.6, near: 0.05, side: 0 };
const SIDE: Framing = { tilt: 22, zoom: 1, near: 0.1, side: 1 };

/** How lit a track is when it is not the one under the head. */
const DIM_LIT = 0.3;

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/** Hermite ease from 0 at `a` to 1 at `b`, flat at both ends. */
function smoothstep(a: number, b: number, x: number): number {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/** `a` at 0 and `b` at 1 exactly, so a held end value is the value itself and not one within rounding of it. */
function lerp(a: number, b: number, t: number): number {
  if (t <= 0) return a;
  if (t >= 1) return b;
  return a + (b - a) * t;
}

function lerpFraming(a: Framing, b: Framing, t: number): Framing {
  return { tilt: lerp(a.tilt, b.tilt, t), zoom: lerp(a.zoom, b.zoom, t), near: lerp(a.near, b.near, t), side: lerp(a.side, b.side, t) };
}

/** A value for each track. */
function perTrack(value: number): Record<TrackId, number> {
  return { funcial: value, 'jontai-energy': value, 'cookies-clicker': value, next: value };
}

/**
 * Which section `progress` falls in, among `spans`, and how far through it.
 * Out-of-range progress is clamped and NaN counts as the top; progress 1 is the
 * bottom of the last section.
 */
export function locate(progress: number, spans: readonly Span[] = NOMINAL_SPANS): { id: SectionId; local: number } {
  if (spans.length === 0) return { id: 'hero', local: 0 };
  const at = Number.isNaN(progress) ? 0 : clamp01(progress);
  let k = spans.length - 1;
  while (k > 0 && at < spans[k].start) k--;
  const { id, start, length } = spans[k];
  const bottom = (k === spans.length - 1 && at >= 1) || at >= start + length;
  return { id, local: bottom ? 1 : clamp01((at - start) / length) };
}

/** A section's text: in over `fadeIn`, then out over `fadeOut` (or held when `fadeOut` is omitted). */
function textOpacity(local: number, fadeIn: [number, number], fadeOut?: [number, number]): number {
  const shown = smoothstep(fadeIn[0], fadeIn[1], local);
  return fadeOut ? shown * (1 - smoothstep(fadeOut[0], fadeOut[1], local)) : shown;
}

/** The test point under the head at `local` in a track section: the platter holds still for one, then turns a quarter to the next. */
function testPointAt(local: number): 0 | 1 | 2 | 3 | null {
  if (local >= 0.25 && local < 0.33) return 0;
  if (local >= 0.4 && local < 0.48) return 1;
  if (local >= 0.55 && local < 0.63) return 2;
  if (local >= 0.7 && local < 0.8) return 3;
  return null;
}

/**
 * The pose in section `id`, `local` of the way through it (0..1; anything else
 * is clamped, NaN counts as the top). A pure function of its two arguments.
 */
export function poseAt(id: SectionId, local: number): CompassPose {
  const l = Number.isNaN(local) ? 0 : clamp01(local);
  const s = (from: number, to: number): number => smoothstep(from, to, l);

  const text = Object.fromEntries(SECTIONS.map((section) => [section.id, 0])) as Record<SectionId, number>;
  const pose: CompassPose = {
    section: id,
    local: l,
    framing: { ...WIDE },
    needle: {
      weight: 0,
      // While the page does not script the needle (weight 0) its bearing is unused; it waits at China's so it never jumps.
      bearing: CHINA_BEARING,
      lift: 0
    },
    // Plain until China paints in; the origin waits at China's too, for the same reason as the bearing.
    pattern: { from: 'plain', to: 'plain', sweep: 0, origin: HOMES.china.sweepFrom },
    portrait: 0,
    threads: 1,
    wire: { show: 0, lift: 0, wind: 0, pulse: -1 },
    drive: { stack: 0, mirror: 0, grow: 0, clamp: 0, arm: 0, chassis: 0 },
    head: DRIVE.tracks.funcial,
    park: 0,
    platter: 0,
    tracks: { lit: perTrack(0), tp: null, current: null },
    dim: 0,
    interactive: false,
    text
  };

  // From the current on, the ring holds Rotterdam's pattern whole.
  if (ORDER[id] >= ORDER.current) pose.pattern = { from: 'rotterdam', to: 'rotterdam', sweep: 1, origin: HOMES.rotterdam.sweepFrom };

  /** The drive formed and the needle its arm, with no portrait or threads: how every section from the first track to the Q&A starts. */
  const formed = (head: number): void => {
    pose.needle = { weight: 1, bearing: 0, lift: 0 };
    pose.portrait = 0;
    pose.threads = 0;
    pose.wire = { show: 1, lift: 1, wind: 1, pulse: -1 };
    pose.drive = { stack: 1, mirror: 1, grow: 1, clamp: 1, arm: 1, chassis: 1 };
    pose.head = head;
  };

  switch (id) {
    case 'hero':
      // The dial lies wide in the studio with the red threads across it, the pearl steering the needle.
      text.hero = 1 - s(0.6, 0.85);
      break;

    case 'about':
      // The camera dives to the heaven pool; the needle lifts away, the threads fade and the portrait shows.
      pose.framing = lerpFraming(WIDE, CLOSE, s(0, 0.45));
      pose.needle.lift = lerp(0, 1, s(0.1, 0.4));
      pose.threads = lerp(1, 0.15, s(0.1, 0.4));
      pose.portrait = s(0.3, 0.55);
      text.about = textOpacity(l, [0.35, 0.55], [0.85, 1]);
      break;

    case 'china':
      // Back out to the settled view; the needle lowers, the page takes it over and China paints in from the east.
      pose.framing = lerpFraming(CLOSE, SETTLED, s(0, 0.3));
      pose.needle.lift = lerp(1, 0, s(0.05, 0.3));
      pose.threads = lerp(0.15, 1, s(0.05, 0.3));
      pose.needle.weight = s(0.2, 0.45);
      pose.portrait = 1;
      pose.pattern = { from: 'plain', to: 'china', sweep: s(0.35, 0.85), origin: HOMES.china.sweepFrom };
      text.china = textOpacity(l, [0.4, 0.55], [0.85, 1]);
      break;

    case 'aruba':
      // The needle swings from east to west the long way round, through south, and Aruba paints in from the west.
      pose.framing = { ...SETTLED };
      pose.needle.weight = 1;
      pose.needle.bearing = lerp(CHINA_BEARING, ARUBA_BEARING, s(0, 0.4));
      pose.portrait = 1;
      pose.pattern = { from: 'china', to: 'aruba', sweep: s(0.3, 0.85), origin: HOMES.aruba.sweepFrom };
      text.aruba = textOpacity(l, [0.35, 0.5], [0.85, 1]);
      break;

    case 'rotterdam':
      // The needle is handed back to the pearl and Rotterdam paints in from the visitor's side; the view holds.
      pose.framing = { ...SETTLED };
      pose.needle.weight = lerp(1, 0, s(0, 0.3));
      pose.needle.bearing = ARUBA_BEARING;
      pose.portrait = 1;
      pose.pattern = { from: 'aruba', to: 'rotterdam', sweep: s(0.2, 0.7), origin: HOMES.rotterdam.sweepFrom };
      text.rotterdam = textOpacity(l, [0.3, 0.45]);
      break;

    case 'current':
      // One of the bridge's cables lifts off the ring and lies across the dial over the needle, as Ørsted laid his wire,
      // and the page takes the needle over.
      pose.framing = lerpFraming(SETTLED, CURRENT, s(0, 0.4));
      pose.needle.weight = s(0.05, 0.3);
      pose.needle.bearing = 0;
      pose.portrait = 1;
      pose.wire = { show: s(0, 0.1), lift: s(0.1, 0.6), wind: 0, pulse: -1 };
      text.current = textOpacity(l, [0.45, 0.6], [0.85, 1]);
      break;

    case 'stack':
    case 'ai': {
      // A pulse of current runs along the wire and the needle swings across (east of north for the stack, west for the ai),
      // then tugs back toward the pearl.
      const swing = s(0.15, 0.35) - s(0.6, 0.85);
      const back = s(0.6, 0.85);
      pose.framing = { ...CURRENT };
      pose.portrait = 1;
      pose.wire = { show: 1, lift: 1, wind: 0, pulse: l >= 0.1 && l <= 0.6 ? (l - 0.1) / 0.5 : -1 };
      if (id === 'stack') {
        pose.needle.weight = lerp(1, 0.6, back);
        pose.needle.bearing = lerp(0, 72, swing);
      } else {
        pose.needle.weight = lerp(lerp(0.6, 1, s(0, 0.1)), 0.6, back);
        pose.needle.bearing = lerp(0, -72, swing);
      }
      text[id] = textOpacity(l, [0.25, 0.4], [0.85, 1]);
      break;
    }

    case 'change':
      // The wire winds into the voice coil at the needle's tail, the three outer rings grow into platters that slide apart
      // and wipe to mirror, the trigram ring closes into the clamp, the needle becomes the arm and the plate the chassis.
      pose.framing = lerpFraming(CURRENT, DRIVE_VIEW, s(0, 0.6));
      pose.threads = lerp(1, 0, s(0, 0.2));
      pose.portrait = lerp(1, 0, s(0, 0.25));
      pose.wire = { show: 1, lift: 1, wind: s(0, 0.35), pulse: -1 };
      pose.needle.weight = lerp(0.6, 1, s(0, 0.1));
      pose.needle.bearing = 0;
      pose.drive = { stack: s(0.05, 0.3), mirror: s(0.15, 0.5), grow: s(0.45, 0.75), clamp: s(0.4, 0.7), arm: s(0.3, 0.8), chassis: s(0.55, 0.9) };
      pose.tracks.lit = perTrack(lerp(0, DIM_LIT, s(0.8, 1)));
      text.change = textOpacity(l, [0.35, 0.5], [0.85, 1]);
      break;

    case 'funcial':
    case 'jontai-energy':
    case 'cookies-clicker':
    case 'next': {
      // The arm steps in to this track and the platter turns its four test points under the head one by one; the track
      // is lit and the one the head left dims. The empty track at the end (next) has no test points and takes longer.
      const i = TRACKS.indexOf(id);
      const empty = id === 'next';
      const previous = TRACKS[Math.max(0, i - 1)];
      const arrive = empty ? s(0, 0.3) : s(0, 0.25);
      formed(lerp(DRIVE.tracks[previous], DRIVE.tracks[id], arrive));
      pose.framing = id === 'funcial' ? lerpFraming(DRIVE_VIEW, TRACK, s(0, 0.25)) : { ...TRACK };
      pose.platter = empty ? 1080 + 360 * s(0.3, 1) : 360 * i + 90 * (s(0.33, 0.4) + s(0.48, 0.55) + s(0.63, 0.7) + s(0.8, 1));
      pose.tracks.lit = perTrack(DIM_LIT);
      pose.tracks.lit[id] = lerp(DIM_LIT, 1, empty ? s(0.1, 0.3) : s(0.1, 0.25));
      if (i > 0) pose.tracks.lit[previous] = lerp(1, DIM_LIT, s(0, 0.15));
      pose.tracks.tp = empty ? null : testPointAt(l);
      pose.tracks.current = id;
      pose.interactive = true;
      text[id] = empty ? textOpacity(l, [0.3, 0.45], [0.85, 1]) : textOpacity(l, [0.25, 0.4], [0.85, 1]);
      break;
    }

    case 'offduty':
      // The head parks on its ramp and the camera pushes in to the spindle while the platter spins down, three turns so the
      // spin follows the scroll's speed; then the drive pulls back to the side and dims.
      formed(DRIVE.tracks.next);
      pose.framing = lerpFraming(lerpFraming(TRACK, SPINDLE, s(0.1, 0.45)), SIDE, s(0.85, 1));
      pose.park = s(0, 0.3);
      pose.platter = 1440 + 1080 * l;
      pose.tracks.lit = perTrack(DIM_LIT);
      pose.tracks.lit.next = lerp(1, DIM_LIT, s(0, 0.2));
      pose.dim = s(0.85, 1);
      text.offduty = textOpacity(l, [0.4, 0.55], [0.8, 0.9]);
      break;

    case 'qa':
      // The drive sits small and dim at the side with the Q&A flowing beside it.
      formed(DRIVE.tracks.next);
      pose.framing = { ...SIDE };
      pose.park = 1;
      pose.platter = 2520;
      pose.tracks.lit = perTrack(DIM_LIT);
      pose.dim = 1;
      text.qa = 1;
      break;

    case 'hello':
      // The drive folds back into the compass in the reverse of the order it formed, the camera returns to the wide view
      // and the needle, the portrait and the threads come back.
      formed(DRIVE.tracks.next);
      pose.framing = lerpFraming(SIDE, WIDE, s(0, 0.35));
      pose.dim = lerp(1, 0, s(0, 0.35));
      pose.wire = { show: lerp(1, 0, s(0, 0.25)), lift: 1, wind: 1, pulse: -1 };
      pose.park = lerp(1, 0, s(0, 0.15));
      pose.drive = {
        stack: lerp(1, 0, s(0.55, 0.8)),
        mirror: lerp(1, 0, s(0.35, 0.7)),
        grow: lerp(1, 0, s(0.15, 0.45)),
        clamp: lerp(1, 0, s(0.2, 0.5)),
        arm: lerp(1, 0, s(0.1, 0.55)),
        chassis: lerp(1, 0, s(0.05, 0.35))
      };
      pose.tracks.lit = perTrack(lerp(DIM_LIT, 0, s(0, 0.3)));
      pose.needle.weight = lerp(1, 0, s(0.5, 0.8));
      pose.portrait = s(0.6, 0.85);
      pose.threads = s(0.6, 0.85);
      pose.platter = 2520;
      text.hello = textOpacity(l, [0.55, 0.7]);
      break;
  }

  return pose;
}

/** The pose for scroll `progress`, 0 at the top of the page and 1 at the bottom, with each section at its place in `spans`. */
export function compassPoseAt(progress: number, spans: readonly Span[] = NOMINAL_SPANS): CompassPose {
  const { id, local } = locate(progress, spans);
  return poseAt(id, local);
}

/** The home whose pattern the ring shows whole, or 'mixed' while one is sweeping over another. */
export function visibleHome(pose: CompassPose): HomeId | 'mixed' {
  if (pose.pattern.sweep >= 1) return pose.pattern.to;
  if (pose.pattern.sweep <= 0) return pose.pattern.from;
  return 'mixed';
}
