/**
 * The Q&A's gold ring round the stack, as plain numbers (spec 2026-10-29-bob-stack-2-design.md, goal 1; after the mock-up
 * Bob chose, .superpowers/qa-mockup, "mix"): its measures, its turn for a place on the ring, its slow drift in the Q&A
 * (round 13), when an answer shows and when the whole ring lights at the end. Pure, as the path is (./worldPath.ts): the
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
 * The ring's drift in the Q&A (Bob, 2026-10-31: "can you also make the background ring also move around a bit when theyre
 * on the Q&A"), the scroll no longer turning it: up to `turn` round and back about its own axis and up to `tip` more or
 * less tipped, each two slow waves of uneven periods (s), so it never reads as a loop.
 */
export const RING_DRIFT = { turn: 14 * DEG, turnPeriods: [17, 29], tip: 2.5 * DEG, tipPeriods: [11, 19] } as const;

/** The ring's drift `seconds` into the Q&A on its own clock, rad: its turn and its tip; none for a time that is not a number. */
export function ringDriftAt(seconds: number): { turn: number; tip: number } {
  if (!Number.isFinite(seconds)) return { turn: 0, tip: 0 };
  const wave = (period: number, phase: number): number => Math.sin((2 * Math.PI * seconds) / period + phase);
  const [t1, t2] = RING_DRIFT.turnPeriods;
  const [p1, p2] = RING_DRIFT.tipPeriods;
  return {
    turn: RING_DRIFT.turn * (0.65 * wave(t1, 0) + 0.35 * wave(t2, 1.3)),
    tip: RING_DRIFT.tip * (0.6 * wave(p1, 0.4) + 0.4 * wave(p2, 2.1))
  };
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
