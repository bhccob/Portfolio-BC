/**
 * The Q&A's gold ring round the stack, as plain numbers (spec 2026-10-29-bob-stack-2-design.md, goal 1; after the mock-up
 * Bob chose, .superpowers/qa-mockup, "mix"): its measures, its turn for a place on the ring, the small click as it lands
 * on a mark, when an answer shows and when the whole ring lights at the end. Pure, as the path is (./worldPath.ts): the
 * path poses the ring from these, and the scene and its tests read the same numbers.
 *
 * A place on the ring is the chapters' (`qaPlaceAt`, src/state/chapters.ts): -1 at the look back's stop, `k` at mark
 * `k` (question `k + 1`; the last mark the end's).
 */

const DEG = Math.PI / 180;

/**
 * The ring's measures (m, rad), the mock-up's: its radius round the open stack, `closedRadius` round the closed one; its
 * middle `lift` above the machine's middle while the stack is open, `below` under the closed stack's middle once it is
 * shut; tipped `tilt` toward the camera; and the way round the stack its front faces, `azimuth` (0 toward +z), the look
 * back's and the ring view's own.
 */
export const RING = { radius: 11.5, closedRadius: 9.6, lift: 0.8, below: 0.1, tilt: 7 * DEG, azimuth: 0.5 } as const;

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/** Where mark `k` of `marks` stands on the ring, rad round it before it turns: the first at the front. */
export function markAngle(k: number, marks: number): number {
  return RING.azimuth + (k * 2 * Math.PI) / marks;
}

/** The ring's turn at `place` on it, rad: mark `k` comes round to the front (`RING.azimuth`) at place `k`. */
export function ringTurnFor(place: number, marks: number): number {
  return (-place * 2 * Math.PI) / marks;
}

/**
 * The ring's click as it lands on a mark, rad, `after` seconds after it landed (the mock-up's): a little past and back,
 * gone within a second. Nothing before the landing, nor for a time that is not a number.
 */
export function clickAt(after: number): number {
  if (!(after >= 0)) return 0;
  return 0.014 * Math.exp(-after * 11) * Math.sin(after * 28);
}

/**
 * How much the answer beside the ring shows at `place`, 0..1: whole at a mark and a little either side of it, gone half
 * way between two; none on the way from the look back to the first question.
 */
export function answerShown(place: number): number {
  const nearest = Math.round(place);
  if (nearest < 0) return 0;
  return 1 - smoothstep(0.04, 0.18, Math.abs(place - nearest));
}

/** How much the whole ring lights round, 0..1: as it comes onto the end's mark, the last of `marks`. */
export function ringLit(place: number, marks: number): number {
  return smoothstep(marks - 1.3, marks - 1, place);
}
