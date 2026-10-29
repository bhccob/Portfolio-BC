import { describe, expect, it } from 'vitest';
import { RING_MARKS } from '~/data/qa';
import { answerShown, clickAt, markAngle, RING, ringLit, ringTurnFor } from '~/scene/bob/qaRing';

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

  it('clicks a little past and back, gone within a second', () => {
    expect(clickAt(0)).toBe(0);
    expect(clickAt(0.03)).toBeGreaterThan(0);
    expect(Math.max(...Array.from({ length: 200 }, (_, i) => Math.abs(clickAt(i / 200))))).toBeLessThan(0.014);
    expect(Math.abs(clickAt(1))).toBeLessThan(1e-5);
    expect(clickAt(-0.1)).toBe(0);
    expect(clickAt(Number.NaN)).toBe(0);
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
