/**
 * The way out (round 14, spec 2026-10-31-bob-way-out-design.md; Bob's picks on the mock-up .superpowers/r14/all.html):
 * from the last floor the tower turns into a blueprint whose sparks build the Q&A in the stars, a circle closes a
 * little with each question, and the last scroll flies through it to the end. Pure, as the path is (./worldPath.ts):
 * from the place in the Q&A (src/state/chapters.ts `qaPlaceAt`: -1 at the door, `k` at question `k + 1`, the last mark
 * the end's) to the mock-up's clock and every stage of it, so the same place is the same picture, either way. The sky is
 * drawn from it (src/ui/outSky.ts), and the Q&A's page is written from it (./qaScene.ts).
 */

/**
 * The mock-up's clock, s: the blueprint from the last floor to the first question, and the flight from the last question
 * to the end, each played as one step of the scroll (src/input/scrollLoop.ts `turnTime`); either played back in `back`;
 * and how long input waits while each plays forward (the mock-up's own locks).
 */
export const WAY_OUT = { blueprint: 6.4, flight: 4.8, back: 2.4, lock: { blueprint: 6.2, flight: 4.2 } } as const;

const clamp01 = (x: number): number => (x > 0 ? (x < 1 ? x : 1) : 0);
/** How far `x` is from `a` to `b`, held to 0..1. */
const seg = (x: number, a: number, b: number): number => clamp01((x - a) / (b - a));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** The mock-up's ease, a cubic in and out; and its ease out. */
const ease = (x: number): number => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
const easeOut = (x: number): number => 1 - (1 - x) ** 3;

/** The mock-up's hash, a number 0..1 for `k` and `salt` (no lattice): the stars and the sparks are drawn from it. */
export function hash01(k: number, salt: number): number {
  const x = Math.sin(k * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * The scroll's turn eased in and out (src/input/scrollLoop.ts `easeInOutQuart`) turned back: the share of its time at
 * which it has come `y` of its way. The blueprint and the flight are steps of that turn, so this gives back the mock-up's
 * clock from the place the turn has reached.
 */
export function easeInOutQuartInverse(y: number): number {
  const v = clamp01(y);
  return v < 0.5 ? (v / 8) ** 0.25 : 1 - (2 * (1 - v)) ** 0.25 / 2;
}

/** The flight's speed at `s` s (the mock-up's SPEED): still while the circle closes, fastest from 2.6 s, a drift by 4.8 s. */
export function flightSpeed(s: number): number {
  if (s < 1.6) return 0;
  if (s < 2.6) return 1.6 * easeOut(seg(s, 1.6, 2.6)) ** 2;
  if (s < 3) return 1.6;
  return lerp(1.6, 0.03, easeOut(seg(s, 3, 4.8)));
}

/** How far the flight has come by `s` s: its speed added up (closed, each stretch's integral). */
export function flightTravel(s: number): number {
  if (s <= 1.6) return 0;
  // 1.6 · ∫ (1 − (1 − w)³)² dw over the first second; with r = 1 − w, ∫ (1 − 2r³ + r⁶) dr.
  const rise = (u: number): number => {
    const prim = (r: number): number => r - r ** 4 / 2 + r ** 7 / 7;
    return 1.6 * (prim(1) - prim(1 - u));
  };
  if (s < 2.6) return rise(s - 1.6);
  const top = rise(1);
  if (s < 3) return top + 1.6 * (s - 2.6);
  const cruise = top + 1.6 * 0.4;
  // 1.8 · ∫ (1.6 − 1.57 · easeOut(w)) dw over the slowing, w its share; past it the drift.
  const u = Math.min((s - 3) / 1.8, 1);
  const slowing = 1.8 * (1.6 * u - 1.57 * (u - (1 - (1 - u) ** 4) / 4));
  return cruise + slowing + (s > 4.8 ? 0.03 * (s - 4.8) : 0);
}

/**
 * A star of the flight `z0` ahead (1 the Q&A's own sky), once the flight has come `travel`: nearer by as much; once past
 * the camera's plane (0.08) it comes round again between 1.8 and 3.2 ahead (by `k`, the star's number) and goes on from
 * there, so the sky never empties (`again`: its place on the screen is a new one).
 */
export function starDepth(z0: number, travel: number, k: number): { z: number; again: boolean } {
  const z = z0 - travel;
  if (z >= 0.08) return { z, again: false };
  return { z: 1.8 + hash01(k, 31) * 1.4 - (0.08 - z), again: true };
}

/** The circle on a screen of `size` (CSS px): round its middle on a laptop (360 px at 1440x900); higher and smaller on a phone. */
export function circleFor(size: { width: number; height: number }): { x: number; y: number; r: number } {
  const { width: w, height: h } = size;
  if (w <= 700) {
    const r = 0.36 * w;
    return { x: w / 2, y: Math.max(0.27 * h, r + 72), r };
  }
  return { x: w / 2, y: h / 2, r: 0.4 * Math.min(w, h) };
}

/** A stretch of the way out: the floor before it, the blueprint, the questions, the flight through the circle, the end. */
export type WayOutStretch = 'floor' | 'blueprint' | 'qa' | 'flight' | 'end';

/** Every stage of the way out at one place, each 0..1 unless said (the mock-up's `draw`, `qaCircle` and `flight`). */
export interface WayOutView {
  stretch: WayOutStretch;
  /** The clock in the blueprint or the flight, s; 0 on the floor and at a question, the flight's whole at the end. */
  s: number;
  /** The dark come over the scene. */
  dark: number;
  /** The drawing's strength, and how far down the screen it has been drawn. */
  lines: number;
  sweep: number;
  /** The sparks' flight; the ones that are stars at rest as stars; the ones on the panel still there. */
  fly: number;
  skyRest: number;
  frameFade: number;
  /** The rest of the sky, and the circle. */
  skyIn: number;
  circleIn: number;
  /** How much of the circle is drawn, from its top counter-clockwise. */
  share: number;
  /** How much the list shows; how far it has drifted toward the camera, blurred. */
  panel: number;
  past: number;
  /** The list's light on its way to the circle's head; then running round the rest. */
  lightFly: number;
  round: number;
  /** The flight: its speed, how far it has come, the circle's depth (1 where it stood, nearer as it comes). */
  speed: number;
  travel: number;
  ringZ: number;
  /** The stars further ahead, come in; the thin ring round Bob's mark; the end's words on. */
  extraIn: number;
  markRing: number;
  endOn: boolean;
}

const NONE: WayOutView = {
  stretch: 'floor',
  s: 0,
  dark: 0,
  lines: 0,
  sweep: 0,
  fly: 0,
  skyRest: 0,
  frameFade: 0,
  skyIn: 0,
  circleIn: 0,
  share: 0,
  panel: 0,
  past: 0,
  lightFly: 0,
  round: 0,
  speed: 0,
  travel: 0,
  ringZ: 1,
  extraIn: 0,
  markRing: 0,
  endOn: false
};

/** The flight `s` s in, its last stretch the end's (`end`). */
function flightAt(s: number, marks: number, end: boolean): WayOutView {
  const round = ease(seg(s, 0.9, 1.6));
  const travel = flightTravel(s);
  return {
    ...NONE,
    stretch: end ? 'end' : 'flight',
    s,
    dark: 1,
    fly: 1,
    skyRest: 1,
    skyIn: 1,
    circleIn: 1,
    sweep: 1,
    share: lerp((marks - 1) / marks, 1, round),
    panel: 1 - ease(seg(s, 0, 0.8)),
    past: ease(seg(s, 0, 1.1)),
    lightFly: ease(seg(s, 0.2, 0.9)),
    round,
    speed: flightSpeed(s),
    travel,
    ringZ: Math.max(0.02, 1 - travel),
    extraIn: seg(s, 1.5, 2.3),
    markRing: easeOut(seg(s, 3, 4.8)),
    endOn: s > 2.8
  };
}

/**
 * The way out at `place` in the Q&A (null before its door) of `marks` marks (the questions and the end's): the floor
 * up to the door; the blueprint to the first question, on the mock-up's clock (its 6.4 s, the turn's ease taken back
 * out); each question, the circle a share closed; the flight from the last question, on its clock (4.8 s); the end.
 */
export function wayOutAt(place: number | null, marks: number): WayOutView {
  if (place === null || !(place > -1)) return NONE;
  if (place < 0) {
    const s = easeInOutQuartInverse(place + 1) * WAY_OUT.blueprint;
    return {
      ...NONE,
      stretch: 'blueprint',
      s,
      dark: 0.8 * seg(s, 1.6, 2.4) + 0.2 * seg(s, 2.9, 3.6),
      lines: 0.55 * seg(s, 0.8, 1.2) * (1 - seg(s, 2.9, 3.6)),
      sweep: ease(seg(s, 0.8, 2.2)),
      fly: seg(s, 2.8, 5),
      skyRest: seg(s, 4.6, 5.6),
      frameFade: 1 - seg(s, 5.4, 6.2),
      skyIn: seg(s, 4.8, 6),
      circleIn: seg(s, 5, 6.2),
      share: 1 / marks,
      panel: ease(seg(s, 4.9, 5.7))
    };
  }
  const last = marks - 2;
  if (place <= last) return { ...NONE, stretch: 'qa', dark: 1, sweep: 1, fly: 1, skyRest: 1, skyIn: 1, circleIn: 1, share: (place + 1) / marks, panel: 1 };
  if (place < marks - 1) return flightAt(easeInOutQuartInverse(place - last) * WAY_OUT.flight, marks, false);
  return flightAt(WAY_OUT.flight, marks, true);
}
