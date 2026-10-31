import { describe, expect, it } from 'vitest';
import { RING_MARKS } from '~/data/qa';
import { answerShown, markAngle, RING, RING_DRIFT, ringDriftAt, ringLit, ringTurnFor } from '~/scene/bob/qaRing';

const DEG = Math.PI / 180;
/** An angle held to (-π, π]. */
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

// The Q&A's gold ring round the stack, as plain numbers (spec 2026-10-29-bob-stack-2-design.md, goal 1; the mock-up Bob
// chose, .superpowers/qa-mockup, "mix").
describe("the Q&A's ring", () => {
  it('has the mock-up\'s measures', () => {
    expect(RING).toEqual({ radius: 11.5, closedRadius: 9.6, lift: 0.8, below: 0.1, tilt: 7 * DEG, azimuth: 0.5 });
  });

  it('faces mark k to the camera at place k', () => {
    for (let k = 0; k < RING_MARKS; k++) {
      expect(wrap(markAngle(k, RING_MARKS) + ringTurnFor(k, RING_MARKS) - RING.azimuth), `mark ${k}`).toBeCloseTo(0, 12);
    }
    // Half way between two marks neither faces it; at the look back (-1) the first is a step short of it.
    expect(Math.abs(wrap(markAngle(2, RING_MARKS) + ringTurnFor(2.5, RING_MARKS) - RING.azimuth))).toBeCloseTo(Math.PI / RING_MARKS, 12);
    expect(wrap(markAngle(0, RING_MARKS) + ringTurnFor(-1, RING_MARKS) - RING.azimuth)).toBeCloseTo((2 * Math.PI) / RING_MARKS, 12);
  });

  // Round 13 (Bob, 2026-10-31: "can you also make the background ring also move around a bit when theyre on the Q&A").
  it('drifts a little round and back and sways its tip, slowly, never far', () => {
    const seconds = Array.from({ length: 6001 }, (_, i) => i / 10);
    const drift = seconds.map(ringDriftAt);
    const most = (pick: (d: { turn: number; tip: number }) => number): number => Math.max(...drift.map((d) => Math.abs(pick(d))));
    expect(most((d) => d.turn)).toBeLessThanOrEqual(RING_DRIFT.turn + 1e-12);
    expect(most((d) => d.turn)).toBeGreaterThan(0.6 * RING_DRIFT.turn);
    expect(most((d) => d.tip)).toBeLessThanOrEqual(RING_DRIFT.tip + 1e-12);
    expect(most((d) => d.tip)).toBeGreaterThan(0.6 * RING_DRIFT.tip);
    // Slow: never more than half a degree round in a tenth of a second (about 4.4° a second at its quickest).
    for (let i = 1; i < drift.length; i++) expect(Math.abs(drift[i]!.turn - drift[i - 1]!.turn)).toBeLessThan(DEG / 2);
    expect(RING_DRIFT.turn).toBeCloseTo(14 * DEG, 12);
    expect(RING_DRIFT.tip).toBeCloseTo(2.5 * DEG, 12);
    expect(ringDriftAt(Number.NaN)).toEqual({ turn: 0, tip: 0 });
  });

  it('shows the answer only near a mark', () => {
    expect(answerShown(2)).toBe(1);
    expect(answerShown(2.03)).toBe(1);
    expect(answerShown(2.5)).toBe(0);
    expect(answerShown(1.9)).toBeGreaterThan(0);
    expect(answerShown(1.9)).toBeLessThan(1);
    // None at the look back, nor on the way from it to the first question.
    expect(answerShown(-1)).toBe(0);
    expect(answerShown(-0.6)).toBe(0);
  });

  it('lights the whole ring at the end', () => {
    const end = RING_MARKS - 1;
    expect(ringLit(end, RING_MARKS)).toBe(1);
    expect(ringLit(end - 1, RING_MARKS)).toBe(0);
    expect(ringLit(end - 0.15, RING_MARKS)).toBeGreaterThan(0);
    expect(ringLit(end - 0.15, RING_MARKS)).toBeLessThan(1);
  });
});
