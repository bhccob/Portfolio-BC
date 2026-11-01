/**
 * The way out (round 15, spec 2026-11-01-bob-dissolve-digitize-design.md; Bob's mix of the mock-ups in
 * .superpowers/r15/ways.html: "dissolve for the tower and digitize for stuur een bericht make everything smooth and blend
 * well together"): from the last floor one scroll plays the dissolve, the floors closing while the tower turns to points
 * of light that drift out into a field of stardust; past it the Q&A goes with the scroll like a page; past question 6 a
 * laser line digitizes the world into LEDs, and the end stands on them. Pure, as the path is (./worldPath.ts): from the
 * place in the Q&A (src/state/chapters.ts `qaPlaceAt`: -1 at the door, `k` at question `k + 1`, 6 the end's) to every
 * stage of it, so the same place is the same picture, either way. The path reads it (the camera, the closing, the
 * tower's parts), the stardust (../../engine/bob/build/stardust.ts), and the Q&A's page (./qaScene.ts).
 */

/**
 * The mock-up's clock, s: the dissolve from the last floor to the first question, played as one step of the scroll
 * (src/input/scrollLoop.ts `turnTime`), played back in `back`, input waiting `lock.dissolve` while it plays forward.
 */
export const WAY_OUT = { dissolve: 7.5, back: 2.4, lock: { dissolve: 7.2 } } as const;

const clamp01 = (x: number): number => (x > 0 ? (x < 1 ? x : 1) : 0);
/** How far `x` is from `a` to `b`, held to 0..1. */
const seg = (x: number, a: number, b: number): number => clamp01((x - a) / (b - a));
/** The mock-up's ease, a cubic in and out. */
const ease = (x: number): number => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);

/**
 * The scroll's turn eased in and out (src/input/scrollLoop.ts `easeInOutQuart`) turned back: the share of its time at
 * which it has come `y` of its way. The dissolve is a step of that turn, so this gives back the mock-up's clock from the
 * place the turn has reached.
 */
export function easeInOutQuartInverse(y: number): number {
  const v = clamp01(y);
  return v < 0.5 ? (v / 8) ** 0.25 : 1 - (2 * (1 - v)) ** 0.25 / 2;
}

/** The dissolve's moments, s on its clock: the floors closed; the points over the tower; the solid tower gone. */
const CLOSED = 3.4;
const POINTS: readonly [number, number] = [2.5, 3.2];
const SOLID_UNTIL = 3.25;
/** The points' flight; the camera's move off the closed tower; the slide of the core aside; the band and the words. */
const FLIGHT: readonly [number, number] = [3.2, 7.2];
const AWAY: readonly [number, number] = [2.4, 7.5];
const SLIDE: readonly [number, number] = [4.5, 7.5];
const BAND: readonly [number, number] = [4.6, 6.0];
const WORDS_AT = 6.0;
/** The Q&A's marks: six questions, and the end's at 6. */
const END_MARK = 6;
/** The digitize, on the place: the laser line's stretch; the end's own part; where reduced motion has it all at once. */
const LINE: readonly [number, number] = [5.08, 5.88];
const END: readonly [number, number] = [5.25, 6];
const REDUCED_AT = 5.5;
/** Within this of a mark the place is on it (src/state/chapters.ts `qaPlaceAt` snaps to its marks). */
const ON_MARK = 1e-9;

/** A stretch of the way out: the floor before it, the dissolve, the questions, the digitize, the end. */
export type WayOutStretch = 'floor' | 'dissolve' | 'qa' | 'digitize' | 'end';

/** Every stage of the way out at one place, each 0..1 unless said (the mock-up's `mixWorld`, `dustWorld`, `scanWorld`). */
export interface WayOutView {
  stretch: WayOutStretch;
  /** The dissolve's clock, s: 0 at the door, `WAY_OUT.dissolve` from the first question on. */
  g: number;
  /** The floors closing, eased. */
  close: number;
  /** The points over the tower's surface. */
  points: number;
  /** Whether the solid tower, its projects and the gold rings stand. */
  solid: boolean;
  /** The points' flight out to the field, eased. */
  flight: number;
  /** The camera's move off the closed tower, and the fog's blend to the stardust's, eased. */
  away: number;
  /** The slide that puts the core to the side of the words, eased, undone as the end comes. */
  slide: number;
  /** The words' column, gone as the end comes. */
  column: number;
  /** The dark band behind the column, eased; gone once the end is half way in. */
  band: number;
  /** The way through the questions, eased: 0 at the first, 1 at the end. */
  q: number;
  /** The laser line's place down the screen: 0 none, 1 past its foot. */
  line: number;
  /** The end's own part, eased. */
  end: number;
  /** The end's words on. */
  endOn: boolean;
}

/**
 * The way out at `place` in the Q&A (null before its door): the floor up to the door; the dissolve to the first
 * question on the mock-up's clock (its 7.5 s, the turn's ease taken back out); the questions; the digitize from 5.08
 * and the end. With `reduced` motion the line and the end come at once from 5.5, never moving.
 */
export function wayOutAt(place: number | null, reduced = false): WayOutView {
  const p = place === null || !(place > -1) ? -1 : place;
  const g = p < 0 ? easeInOutQuartInverse(p + 1) * WAY_OUT.dissolve : WAY_OUT.dissolve;
  const after = Math.max(p, 0);
  const line = reduced ? (after >= REDUCED_AT ? 1 : 0) : ease(seg(after, LINE[0], LINE[1]));
  const end = reduced ? (after >= REDUCED_AT ? 1 : 0) : ease(seg(after, END[0], END[1]));
  const stretch: WayOutStretch = p <= -1 ? 'floor' : p < 0 ? 'dissolve' : p >= END_MARK - ON_MARK ? 'end' : p >= LINE[0] ? 'digitize' : 'qa';
  return {
    stretch,
    g,
    close: ease(seg(g, 0, CLOSED)),
    points: seg(g, POINTS[0], POINTS[1]),
    solid: g < SOLID_UNTIL,
    flight: ease(seg(g, FLIGHT[0], FLIGHT[1])),
    away: ease(seg(g, AWAY[0], AWAY[1])),
    slide: ease(seg(g, SLIDE[0], SLIDE[1])) * (1 - end),
    column: (g >= WORDS_AT ? 1 : 0) * (1 - end),
    band: end >= 0.5 ? 0 : ease(seg(g, BAND[0], BAND[1])) * (1 - end),
    q: ease(clamp01(after / END_MARK)),
    line,
    end,
    endOn: end > 0.45
  };
}
