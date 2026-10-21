import { describe, expect, it } from 'vitest';
import { clearOfWordmark, segmentClear, TRACE, traceLayout } from '~/engine/bob/traces';
import { WORDMARK } from '~/engine/bob/wordmark';

describe('traceLayout', () => {
  it('walks 70 traces at multiples of 45 degrees, the same every time', () => {
    const a = traceLayout();
    const b = traceLayout();
    expect(a.traces).toHaveLength(70);
    expect(a).toEqual(b);
    for (const t of a.traces) {
      for (let i = 1; i < t.length; i++) {
        const ang = Math.atan2(t[i][1] - t[i - 1][1], t[i][0] - t[i - 1][0]) / (Math.PI / 4);
        expect(Math.abs(ang - Math.round(ang))).toBeLessThan(1e-9);
      }
    }
  });

  it('keeps every trace clear of the letters and the circle', () => {
    for (const t of traceLayout().traces) for (const p of t) expect(clearOfWordmark(p, 0.25)).toBe(true);
  });

  it('keeps the whole length of every segment clear, not only its ends', () => {
    for (const t of traceLayout().traces) {
      for (let i = 1; i < t.length; i++) expect(segmentClear(t[i - 1], t[i], TRACE.margin)).toBe(true);
    }
  });

  it('runs each trace in 2 to 7 segments of 0.5 to 2.6 and ends each on a pad', () => {
    const { traces, pads } = traceLayout();
    expect(pads).toHaveLength(traces.length * 2);
    traces.forEach((t, k) => {
      expect(t.length).toBeGreaterThanOrEqual(3);
      expect(t.length).toBeLessThanOrEqual(TRACE.steps[1] + 1);
      for (let i = 1; i < t.length; i++) {
        const length = Math.hypot(t[i][0] - t[i - 1][0], t[i][1] - t[i - 1][1]);
        expect(length).toBeGreaterThanOrEqual(TRACE.segment[0] - 1e-9);
        expect(length).toBeLessThanOrEqual(TRACE.segment[1] + 1e-9);
      }
      expect(pads[2 * k]).toEqual(t[0]);
      expect(pads[2 * k + 1]).toEqual(t[t.length - 1]);
    });
  });

  it('starts every trace inside the preview field, on the far side of the glass more than the near', () => {
    const { x, z } = TRACE.field;
    for (const t of traceLayout().traces) {
      expect(t[0][0]).toBeGreaterThanOrEqual(x[0]);
      expect(t[0][0]).toBeLessThanOrEqual(x[1]);
      expect(t[0][1]).toBeGreaterThanOrEqual(z[0]);
      expect(t[0][1]).toBeLessThanOrEqual(z[1]);
    }
    // The preview scatters from y -7 to 22, and its y becomes -z here.
    expect(z).toEqual([-22, 7]);
  });

  it('lays out another seed differently, and still lays out 70 clear traces', () => {
    const base = traceLayout();
    const other = traceLayout(7);
    expect(other).not.toEqual(base);
    expect(other.traces).toHaveLength(70);
    for (const t of other.traces) for (const p of t) expect(clearOfWordmark(p, 0.25)).toBe(true);
    expect(traceLayout(2006)).toEqual(base);
  });
});

describe('clearOfWordmark', () => {
  it('refuses the opening, the circle, the outer ring and its margin', () => {
    expect(clearOfWordmark([0, 0], 0.25)).toBe(false);
    expect(clearOfWordmark([0, -(WORDMARK.outer + 0.2)], 0.25)).toBe(false);
    expect(clearOfWordmark([0, -(WORDMARK.outer + 0.3)], 0.25)).toBe(true);
    expect(clearOfWordmark([WORDMARK.outer + 0.3, 9], 0.25)).toBe(true);
  });

  it('refuses each letter box grown by the margin, and nothing outside it', () => {
    const { leftX, rightX, width, nearZ } = WORDMARK.b;
    for (const ox of [leftX, rightX]) {
      expect(clearOfWordmark([ox + width / 2, 0], 0.25)).toBe(false);
      expect(clearOfWordmark([ox - 0.2, nearZ], 0.25)).toBe(false);
      expect(clearOfWordmark([ox - 0.3, nearZ], 0.25)).toBe(true);
      expect(clearOfWordmark([ox + width + 0.2, nearZ], 0.25)).toBe(false);
      expect(clearOfWordmark([ox + width + 0.3, nearZ], 0.25)).toBe(true);
      expect(clearOfWordmark([ox + width / 2, nearZ + 0.2], 0.25)).toBe(false);
      expect(clearOfWordmark([ox + width / 2, nearZ + 0.3], 0.25)).toBe(true);
      expect(clearOfWordmark([ox + width / 2, -nearZ - 0.3], 0.25)).toBe(true);
    }
  });

  it('grows with the margin it is given', () => {
    expect(clearOfWordmark([0, -(WORDMARK.outer + 0.3)], 0.25)).toBe(true);
    expect(clearOfWordmark([0, -(WORDMARK.outer + 0.3)], 0.5)).toBe(false);
  });
});

describe('segmentClear', () => {
  it('sees a segment that grazes the keep-out between its clear ends', () => {
    // Both ends are clear; the middle runs through the opening.
    expect(clearOfWordmark([0, -3], 0.25) && clearOfWordmark([0, 3], 0.25)).toBe(true);
    expect(segmentClear([0, -3], [0, 3], 0.25)).toBe(false);
    expect(segmentClear([0, -3], [0, -2.5], 0.25)).toBe(true);
  });
});
