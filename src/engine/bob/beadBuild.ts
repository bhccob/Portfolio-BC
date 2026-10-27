/**
 * A bead's object built with the scroll, as plain numbers (spec 2026-10-27-bob-light-path-design.md, "Into the bead"):
 * from how far the camera has gone into the bead, `b` 0..1, to what the beads (./build/beads.ts) write to its parts. The
 * objects move with the scroll and never by themselves, so the canvas sleeps when the scroll rests. The numbers are the
 * light path mock-up Bob approved (.superpowers/light-path-mockup/Mock.tsx, `insideOf`). Pure: it imports nothing of
 * three, keeps no state, and reads a `b` outside 0..1, or not a number, as held to it.
 *
 * - Funcial: the abacus rises from the platter as one piece (its height `abacus`, a share of its own), then its beads
 *   slide up one after another (`slide`, seconds of their clock); the platter turns and the track's pulse runs by `time`.
 * - Jontai Energy: the light crosses the cells, charging them one by one, and the module tilts after it (`time`).
 * - Cookies Clicker: the wheels come in from apart (`apart`, 1 apart, 0 home) and meet half way, then the train ticks
 *   (`time`).
 * - Every bead: its screen lights (`screen`, a share of its level).
 */
import type { ProjectId } from '~/data/projects';

/** What a bead's object is built to: its motion's time and, where the object has them, the abacus, its slide, the wheels. */
export interface BuildPose {
  /** Seconds of the object's motion (./beadMotion.ts). */
  time: number;
  /** Funcial's abacus: seconds of its beads' slide up their rods. */
  slide?: number;
  /** Funcial's abacus: its height, a share of its own (never quite nothing, so it never collapses to a plane). */
  abacus?: number;
  /** Cookies Clicker's wheels: how far apart they still are, 1 apart to 0 home. */
  apart?: number;
  /** The screen's light, a share of its level. */
  screen: number;
}

/**
 * The veins on a bead's shell (its lacquer's emissive map), times: `rest` before the light has passed, `lit` once it has,
 * and `hot` added just behind the light as it passes (spec, "Where the light passes, the bead's gold veins wake up").
 */
export const WAKE = { rest: 0.12, lit: 1.4, hot: 2.6 } as const;

const clamp01 = (x: number): number => (x > 0 ? (x < 1 ? x : 1) : 0);
/** How far `x` is from `a` to `b`, held to 0..1. */
const seg = (x: number, a: number, b: number): number => clamp01((x - a) / (b - a));
/** Smoothstep, held to 0..1. */
const smooth = (x: number): number => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

/** Bead `id`'s object built `b` of the way, 0..1. */
export function buildPose(id: ProjectId, b: number): BuildPose {
  const k = clamp01(b);
  const screen = smooth(seg(k, 0.04, 0.4));
  if (id === 'funcial') return { time: 3 * k, slide: 2.3 * seg(k, 0.36, 0.96), abacus: Math.max(0.02, smooth(k / 0.42)), screen };
  if (id === 'jontai-energy') return { time: 4.6 * seg(k, 0.12, 1), screen };
  return { time: 7 * seg(k, 0.48, 1), apart: 1 - smooth(seg(k, 0, 0.5)), screen };
}
