import { describe, expect, it } from 'vitest';
import { easeInOutQuart } from '~/input/scrollLoop';
import { easeInOutQuartInverse, WAY_OUT, wayOutAt } from '~/scene/bob/wayOut';

/** The mock-up's ease, a cubic in and out. */
const ease = (x: number): number => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
/** The place in the Q&A at `g` seconds into the dissolve (from the door, -1), as the scroll's turn plays it. */
const inDissolve = (g: number): number => -1 + easeInOutQuart(g / WAY_OUT.dissolve);

describe('easeInOutQuartInverse: the turn eased in and out, turned back to its time', () => {
  it('gives back the share of time for each share of the way', () => {
    for (const x of [0, 0.05, 0.2, 0.37, 0.5, 0.61, 0.8, 0.97, 1]) expect(easeInOutQuartInverse(easeInOutQuart(x))).toBeCloseTo(x, 9);
    expect(easeInOutQuartInverse(-1)).toBe(0);
    expect(easeInOutQuartInverse(2)).toBe(1);
  });
});

describe('wayOutAt: the dissolve, the Q&A and the digitize, from the place in the Q&A (round 15)', () => {
  it("keeps the mock-up's clock: 7.5 s of dissolve, played back in 2.4, input dropped for 7.2", () => {
    expect(WAY_OUT).toEqual({ dissolve: 7.5, back: 2.4, lock: { dissolve: 7.2 } });
  });

  it('is the floor before the door and at it: the tower open and whole, nothing of the way out', () => {
    for (const p of [null, -1, -2]) {
      const v = wayOutAt(p);
      expect(v.stretch).toBe('floor');
      expect(v.g).toBe(0);
      expect(v.solid).toBe(true);
      expect([v.close, v.points, v.flight, v.away, v.slide, v.column, v.band, v.q, v.line, v.end]).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
      expect(v.endOn).toBe(false);
    }
  });

  it("plays the dissolve on the mock-up's own clock, whatever the turn's ease", () => {
    const v = wayOutAt(inDissolve(3));
    expect(v.stretch).toBe('dissolve');
    expect(v.g).toBeCloseTo(3, 9);
    expect(v.close).toBeCloseTo(ease(3 / 3.4), 9);
    expect(v.points).toBeCloseTo(5 / 7, 9);
    expect(v.solid).toBe(true);
    expect(v.flight).toBe(0);
    expect(v.away).toBeCloseTo(ease(0.6 / 5.1), 9);
    expect(v.column).toBe(0);
    expect(v.q).toBe(0);
  });

  it('lets the solid tower go at 3.25 s, under its own light', () => {
    expect(wayOutAt(inDissolve(3.24)).solid).toBe(true);
    expect(wayOutAt(inDissolve(3.3)).solid).toBe(false);
    expect(wayOutAt(inDissolve(3.3)).points).toBe(1);
  });

  it('flies the points out, slides the core aside and brings the words in as the dissolve ends', () => {
    const v = wayOutAt(inDissolve(5.2));
    expect(v.flight).toBeCloseTo(ease(2 / 4), 9);
    expect(v.slide).toBeCloseTo(ease(0.7 / 3), 9);
    expect(v.band).toBeCloseTo(ease(0.6 / 1.4), 9);
    expect(v.column).toBe(0);
    expect(wayOutAt(inDissolve(6.1)).column).toBe(1);
  });

  it('rests at question 1 with all of it done and the words in', () => {
    const v = wayOutAt(0);
    expect(v.stretch).toBe('qa');
    expect(v.g).toBe(7.5);
    expect([v.close, v.points, v.flight, v.away, v.slide, v.column, v.band]).toEqual([1, 1, 1, 1, 1, 1, 1]);
    expect(v.solid).toBe(false);
    expect([v.q, v.line, v.end]).toEqual([0, 0, 0]);
  });

  it('goes through the questions with the place, eased', () => {
    expect(wayOutAt(3).q).toBeCloseTo(ease(0.5), 9);
    expect(wayOutAt(1.2).q).toBeCloseTo(ease(0.2), 9);
    expect(wayOutAt(3).stretch).toBe('qa');
  });

  it('digitizes past question 6: the line down the screen, then the end', () => {
    const mid = wayOutAt(5.48);
    expect(mid.stretch).toBe('digitize');
    expect(mid.line).toBeCloseTo(ease(0.5), 9);
    expect(mid.end).toBeGreaterThan(0);
    expect(mid.end).toBeLessThan(0.45);
    expect(mid.endOn).toBe(false);
    expect(mid.column).toBeCloseTo(1 - mid.end, 9);
    expect(wayOutAt(5.07).stretch).toBe('qa');
    expect(wayOutAt(5.07).line).toBe(0);
    const end = wayOutAt(6);
    expect(end.stretch).toBe('end');
    expect([end.line, end.end, end.q]).toEqual([1, 1, 1]);
    expect(end.endOn).toBe(true);
    expect([end.column, end.slide, end.band]).toEqual([0, 0, 0]);
  });

  it('reduced motion jumps: no moving line, the LEDs and the end at once from 5.5', () => {
    expect(wayOutAt(5.4, true).line).toBe(0);
    expect(wayOutAt(5.4, true).end).toBe(0);
    const v = wayOutAt(5.5, true);
    expect(v.line).toBe(1);
    expect(v.end).toBe(1);
    expect(v.endOn).toBe(true);
  });
});
