import { describe, expect, it } from 'vitest';
import { HOLD_AT, type LoaderClock, loaderAt, type LoaderPath, SCRIPT } from '~/engine/bob/loaderTimeline';
import { PROBE, probeAt } from '~/engine/bob/probePath';
import { circlePath, type Point2, strokeLength, strokePath, WORDMARK } from '~/engine/bob/wordmark';

/** A clock with every field at 0 (the dark stage) except those given, at this script second. */
function clockWith(partial: Partial<LoaderClock>, script: number): LoaderClock {
  return {
    stage: 'dark',
    script,
    strokes: [0, 0, 0, 0, 0],
    ticks: 0,
    outer: 0,
    iris: 0,
    glow: 0,
    rise: 0,
    camera: 0,
    settle: 0,
    fade: 0,
    ...partial
  };
}

/** The test's own arc-length walk: the point `u` (0..1) of the way along a polyline. */
function pointAlong(points: readonly Point2[], u: number): [number, number] {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  let d = u * total;
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1];
    const [bx, bz] = points[i];
    const length = Math.hypot(bx - ax, bz - az);
    if (d <= length || length === 0) {
      const k = length === 0 ? 0 : d / length;
      return [ax + (bx - ax) * k, az + (bz - az) * k];
    }
    d -= length;
  }
  const last = points[points.length - 1];
  return [last[0], last[1]];
}

/** How far along a polyline the nearest point to (x, z) lies, in world units. */
function distanceAlong(points: readonly Point2[], x: number, z: number): number {
  let best = { gap: Infinity, along: 0 };
  let walked = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1];
    const [bx, bz] = points[i];
    const length = Math.hypot(bx - ax, bz - az);
    const k = length === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / (length * length)));
    const gap = Math.hypot(ax + (bx - ax) * k - x, az + (bz - az) * k - z);
    if (gap < best.gap) best = { gap, along: walked + k * length };
    walked += length;
  }
  return best.along;
}

const mid = (a: number, b: number) => (a + b) / 2;

describe('the probe, cutting', () => {
  it('cuts the circle at its midpoint halfway through its span', () => {
    const p = probeAt(clockWith({ stage: 'engrave', strokes: [0, 0, 0, 0, 0.5] }, mid(SCRIPT.circle.start, SCRIPT.circle.end)));
    expect(p.cutting).toBe(true);
    expect(p.shown).toBe(true);
    expect(p.y).toBeCloseTo(PROBE.cutY, 6);
    expect([p.x, p.z]).toEqual(pointAlong(strokePath('circle'), 0.5));
  });

  it('is on the circle halfway through its span, on the real clock', () => {
    const halfway = loaderAt({ elapsed: mid(SCRIPT.circle.start, SCRIPT.circle.end), loadedAt: 0.1, skipAt: null, path: 'full' });
    const p = probeAt(halfway);
    expect(p.cutting).toBe(true);
    expect(Math.abs(Math.hypot(p.x, p.z) - WORDMARK.circle)).toBeLessThan(1e-6);
    expect(Math.hypot(p.x, p.z)).toBeCloseTo(1.66, 6);
  });

  it('is at half the circle by length, not by point count', () => {
    const p = probeAt(clockWith({ strokes: [0, 0, 0, 0, 0.5] }, mid(SCRIPT.circle.start, SCRIPT.circle.end)));
    expect(distanceAlong(strokePath('circle'), p.x, p.z)).toBeCloseTo(strokeLength('circle') / 2, 6);
  });

  it('cuts the circle along its own path, at the stroke fraction the clock gives', () => {
    for (const u of [0.1, 0.25, 0.7, 0.9]) {
      const p = probeAt(clockWith({ stage: 'engrave', strokes: [0, 0, 0, 0, u] }, mid(SCRIPT.circle.start, SCRIPT.circle.end)));
      expect(p.cutting, `at ${u}`).toBe(true);
      expect(p.shown, `at ${u}`).toBe(true);
      expect([p.x, p.z], `at ${u}`).toEqual(pointAlong(strokePath('circle'), u));
    }
  });

  it('starts and ends the circle on its first and last points', () => {
    const path = strokePath('circle');
    const start = probeAt(clockWith({ strokes: [0, 0, 0, 0, 0] }, SCRIPT.circle.start));
    expect(start.cutting).toBe(true);
    expect([start.x, start.z]).toEqual([...path[0]]);
    const end = probeAt(clockWith({ strokes: [0, 0, 0, 0, 1] }, SCRIPT.circle.end));
    expect(end.cutting).toBe(true);
    // The walk sums 240 chords, so the last point is the closing one to rounding, not bit for bit.
    expect(end.x).toBeCloseTo(path[path.length - 1][0], 9);
    expect(end.z).toBeCloseTo(path[path.length - 1][1], 9);
  });

  it('follows the circle as it creeps while the load is out, not the stalled script', () => {
    const waiting = loaderAt({ elapsed: HOLD_AT + 4, loadedAt: null, skipAt: null, path: 'full' });
    const p = probeAt(waiting);
    expect(p.cutting).toBe(true);
    expect([p.x, p.z]).toEqual(pointAlong(strokePath('circle'), waiting.strokes[4]));
    expect(waiting.strokes[4]).toBeGreaterThan(0.92);
  });
});

describe('the probe, coming down', () => {
  const first = circlePath(WORDMARK.circle)[0];

  it("starts high above the circle's first point and is shown", () => {
    const p = probeAt(clockWith({}, 0));
    expect(p).toEqual({ x: first[0], y: PROBE.startY, z: first[1], cutting: false, shown: true });
    expect([first[0], first[1]]).toEqual([...strokePath('circle')[0]]);
  });

  it('eases out onto the glass: most of the way down by the middle of the descent', () => {
    const p = probeAt(clockWith({}, mid(SCRIPT.descend.start, SCRIPT.descend.end)));
    expect(p.y).toBeCloseTo(PROBE.startY + (PROBE.cutY - PROBE.startY) * 0.875, 6);
    expect(p.cutting).toBe(false);
    expect([p.x, p.z]).toEqual([...first]);
  });

  it("lands on the circle's first point as the descent ends, cutting", () => {
    const p = probeAt(clockWith({}, SCRIPT.descend.end));
    expect([p.x, p.z]).toEqual([...first]);
    expect(p.y).toBe(PROBE.cutY);
    expect(p.cutting).toBe(true);
    expect(p.shown).toBe(true);
  });

  it('lands on the circle as it begins', () => {
    const before = probeAt(clockWith({}, SCRIPT.circle.start - 1e-6));
    expect(before.cutting).toBe(false);
    expect(before.y).toBeCloseTo(PROBE.cutY, 6);
    const at = probeAt(clockWith({}, SCRIPT.circle.start));
    expect(at.cutting).toBe(true);
    expect(at.y).toBe(PROBE.cutY);
  });
});

describe('the probe, going out', () => {
  const end = strokePath('circle')[strokePath('circle').length - 1];

  it('rises from where the circle closed, easing in', () => {
    const p = probeAt(clockWith({ strokes: [0, 0, 0, 0, 1] }, mid(SCRIPT.probeOut.start, SCRIPT.probeOut.end)));
    expect(p.cutting).toBe(false);
    expect(p.shown).toBe(true);
    expect([p.x, p.z]).toEqual([...end]);
    expect(p.y).toBeCloseTo(PROBE.cutY + (PROBE.outY - PROBE.cutY) * 0.125, 6);
  });

  it('is gone once it has risen out', () => {
    expect(probeAt(clockWith({ stage: 'rise' }, SCRIPT.probeOut.end)).shown).toBe(false);
    expect(probeAt(clockWith({ stage: 'rise' }, SCRIPT.probeOut.end - 1e-6)).shown).toBe(true);
  });

  it('is parked out of the picture once it is gone, the same state every time', () => {
    const parked = { x: 0, y: PROBE.outY, z: 0, cutting: false, shown: false };
    expect(probeAt(clockWith({}, SCRIPT.probeOut.end))).toEqual(parked);
    expect(probeAt(clockWith({}, SCRIPT.probeOut.end + 0.5))).toEqual(parked);
    expect(probeAt(clockWith({ strokes: [0, 0, 0, 0, 1] }, SCRIPT.home))).toEqual(parked);
    expect(probeAt(clockWith({}, 100))).toEqual(parked);
  });

  it('is parked from a clock that is not a time', () => {
    expect(probeAt(clockWith({}, Number.NaN)).shown).toBe(false);
  });
});

describe('the probe on each path', () => {
  const parked = { x: 0, y: PROBE.outY, z: 0, cutting: false, shown: false };

  it('is never shown on the quick path or the reduced path', () => {
    for (const path of ['quick', 'reduced'] as LoaderPath[]) {
      for (const t of [0, 0.5, 1, 1.5, 2, 2.5, 3, 10]) {
        expect(probeAt(loaderAt({ elapsed: t, loadedAt: 1, skipAt: null, path }))).toEqual(parked);
        expect(probeAt(loaderAt({ elapsed: t, loadedAt: null, skipAt: null, path }))).toEqual(parked);
      }
    }
  });

  it('is parked at home on every path, so every home pose is the same', () => {
    const home = loaderAt({ elapsed: SCRIPT.home, loadedAt: 0.1, skipAt: null, path: 'full' });
    expect(probeAt(home)).toEqual(parked);
    expect(probeAt(loaderAt({ elapsed: 3.5, loadedAt: 1, skipAt: null, path: 'quick' }))).toEqual(probeAt(home));
    expect(probeAt(loaderAt({ elapsed: 3, loadedAt: 2, skipAt: null, path: 'reduced' }))).toEqual(probeAt(home));
  });

  it('is shown through the whole full show up to the end of its rise', () => {
    expect(probeAt(loaderAt({ elapsed: 0, loadedAt: 0.1, skipAt: null, path: 'full' })).shown).toBe(true);
    expect(probeAt(loaderAt({ elapsed: SCRIPT.probeOut.end - 0.01, loadedAt: 0.1, skipAt: null, path: 'full' })).shown).toBe(true);
    expect(probeAt(loaderAt({ elapsed: SCRIPT.probeOut.end, loadedAt: 0.1, skipAt: null, path: 'full' })).shown).toBe(false);
  });

  it("never visits a B: x and z stay within the circle's reach (1.7) at every second of the full path, skipped or held", () => {
    for (const [loadedAt, skipAt] of [
      [0.1, null],
      [null, null],
      [20, null],
      [0.1, 0.5],
      [0.1, 1.5],
      [null, 1.5],
      [20, 1.5]
    ] as const) {
      for (let t = 0; t <= 40; t += 0.01) {
        const p = probeAt(loaderAt({ elapsed: t, loadedAt, skipAt, path: 'full' }));
        expect(Math.abs(p.x), `x at ${t.toFixed(2)}, loadedAt ${loadedAt}, skipAt ${skipAt}`).toBeLessThanOrEqual(1.7);
        expect(Math.abs(p.z), `z at ${t.toFixed(2)}, loadedAt ${loadedAt}, skipAt ${skipAt}`).toBeLessThanOrEqual(1.7);
      }
    }
  });

  it('never jumps while it is shown, through the whole show', () => {
    const dt = 0.002;
    const faults: string[] = [];
    for (const [loadedAt, skipAt] of [
      [0.1, null],
      [null, null],
      [20, null],
      [0.1, 0.5],
      [0.1, 1.5],
      [null, 1.5],
      [20, 1.5]
    ] as const) {
      let last = probeAt(loaderAt({ elapsed: 0, loadedAt, skipAt, path: 'full' }));
      for (let t = dt; t < 40; t += dt) {
        const p = probeAt(loaderAt({ elapsed: t, loadedAt, skipAt, path: 'full' }));
        // The fastest it moves is the dive of a skip, the whole show in a second: well under half a metre a frame.
        if (last.shown && p.shown && Math.hypot(p.x - last.x, p.y - last.y, p.z - last.z) > 0.5) faults.push(`jump at loadedAt ${loadedAt}, skipAt ${skipAt}, t ${t.toFixed(3)}`);
        last = p;
      }
    }
    expect(faults).toEqual([]);
  });
});
