import { describe, expect, it } from 'vitest';
import { HOLD_AT, type LoaderClock, loaderAt, type LoaderPath, SCRIPT } from '~/engine/bob/loaderTimeline';
import { PROBE, probeAt } from '~/engine/bob/probePath';
import { type Point2, strokeLength, strokePath } from '~/engine/bob/wordmark';

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
  it('cuts the left B at its midpoint halfway through its span', () => {
    const p = probeAt(clockWith({ stage: 'engrave', strokes: [0.5, 0, 0, 0, 0] }, 1.75));
    expect(p.cutting).toBe(true);
    expect(p.y).toBeCloseTo(0.012, 6);
    expect([p.x, p.z]).toEqual(pointAlong(strokePath('leftB'), 0.5));
  });

  it('is at half the outline by length, not by point count', () => {
    const p = probeAt(clockWith({ strokes: [0.5, 0, 0, 0, 0] }, 1.75));
    expect(distanceAlong(strokePath('leftB'), p.x, p.z)).toBeCloseTo(strokeLength('leftB') / 2, 6);
  });

  it('cuts each stroke along its own path, at the stroke fraction the clock gives', () => {
    const cases = [
      ['leftB', 0, 0.25],
      ['leftBar', 1, 0.6],
      ['rightB', 2, 0.9],
      ['rightBar', 3, 0.1],
      ['circle', 4, 0.7]
    ] as const;
    for (const [id, i, u] of cases) {
      const strokes = [0, 0, 0, 0, 0] as [number, number, number, number, number];
      strokes[i] = u;
      const p = probeAt(clockWith({ stage: 'engrave', strokes }, mid(SCRIPT[id].start, SCRIPT[id].end)));
      expect(p.cutting).toBe(true);
      expect(p.shown).toBe(true);
      expect([p.x, p.z]).toEqual(pointAlong(strokePath(id), u));
    }
  });

  it('starts and ends a stroke on its first and last points', () => {
    const start = probeAt(clockWith({ strokes: [0, 0, 0, 0, 0] }, SCRIPT.rightB.start));
    expect(start.cutting).toBe(true);
    expect([start.x, start.z]).toEqual([...strokePath('rightB')[0]]);
    const end = probeAt(clockWith({ strokes: [1, 1, 1, 1, 0] }, SCRIPT.rightBar.end));
    expect(end.cutting).toBe(true);
    expect([end.x, end.z]).toEqual([...strokePath('rightBar')[1]]);
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
  const first = strokePath('leftB')[0];

  it('starts high above the first stroke and is shown', () => {
    const p = probeAt(clockWith({}, 0));
    expect(p).toEqual({ x: first[0], y: PROBE.startY, z: first[1], cutting: false, shown: true });
  });

  it('eases out onto the glass: most of the way down by the middle of the descent', () => {
    const p = probeAt(clockWith({}, mid(SCRIPT.descend.start, SCRIPT.descend.end)));
    expect(p.y).toBeCloseTo(PROBE.startY + (PROBE.cutY - PROBE.startY) * 0.875, 6);
    expect(p.cutting).toBe(false);
    expect([p.x, p.z]).toEqual([...first]);
  });

  it('lands on the first stroke as it begins', () => {
    const before = probeAt(clockWith({}, SCRIPT.leftB.start - 1e-6));
    expect(before.cutting).toBe(false);
    expect(before.y).toBeCloseTo(PROBE.cutY, 6);
    const at = probeAt(clockWith({}, SCRIPT.leftB.start));
    expect(at.cutting).toBe(true);
    expect(at.y).toBe(PROBE.cutY);
  });
});

describe('the probe, travelling between strokes', () => {
  it('lifts 0.35 at the middle of a travel and cuts nothing', () => {
    const middle = (66 + 74) / 2 / 24;
    const p = probeAt(clockWith({ stage: 'engrave', strokes: [1, 0, 0, 0, 0] }, middle));
    expect(p.cutting).toBe(false);
    expect(p.y).toBeCloseTo(0.012 + 0.35, 3);
  });

  it('crosses from the end of one stroke to the start of the next, halfway at the middle', () => {
    const a = strokePath('leftB')[strokePath('leftB').length - 1];
    const b = strokePath('leftBar')[0];
    const p = probeAt(clockWith({ strokes: [1, 0, 0, 0, 0] }, mid(SCRIPT.leftB.end, SCRIPT.leftBar.start)));
    expect(p.x).toBeCloseTo((a[0] + b[0]) / 2, 9);
    expect(p.z).toBeCloseTo((a[1] + b[1]) / 2, 9);
    expect(p.shown).toBe(true);
  });

  it('leaves and arrives on the glass', () => {
    const near = (script: number) => probeAt(clockWith({ strokes: [1, 1, 1, 0, 0] }, script));
    expect(near(SCRIPT.rightB.end + 1e-6).y).toBeCloseTo(PROBE.cutY, 3);
    expect(near(SCRIPT.rightBar.start - 1e-6).y).toBeCloseTo(PROBE.cutY, 3);
  });

  it('travels between every pair of strokes', () => {
    for (const [from, to] of [
      ['leftB', 'leftBar'],
      ['leftBar', 'rightB'],
      ['rightB', 'rightBar'],
      ['rightBar', 'circle']
    ] as const) {
      const p = probeAt(clockWith({ strokes: [1, 1, 1, 1, 0] }, mid(SCRIPT[from].end, SCRIPT[to].start)));
      expect(p.cutting).toBe(false);
      expect(p.y).toBeCloseTo(PROBE.cutY + PROBE.lift, 6);
    }
  });
});

describe('the probe, going out', () => {
  const end = strokePath('circle')[strokePath('circle').length - 1];

  it('rises from where the circle closed, easing in', () => {
    const p = probeAt(clockWith({ strokes: [1, 1, 1, 1, 1] }, mid(SCRIPT.probeOut.start, SCRIPT.probeOut.end)));
    expect(p.cutting).toBe(false);
    expect(p.shown).toBe(true);
    expect([p.x, p.z]).toEqual([...end]);
    expect(p.y).toBeCloseTo(PROBE.cutY + (PROBE.outY - PROBE.cutY) * 0.125, 6);
  });

  it('is gone once it has risen out', () => {
    expect(probeAt(clockWith({ stage: 'rise' }, 246 / 24)).shown).toBe(false);
  });

  it('is parked out of the picture once it is gone, the same state every time', () => {
    const parked = { x: 0, y: PROBE.outY, z: 0, cutting: false, shown: false };
    expect(probeAt(clockWith({}, SCRIPT.probeOut.end))).toEqual(parked);
    expect(probeAt(clockWith({ strokes: [1, 1, 1, 1, 1] }, SCRIPT.home))).toEqual(parked);
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
    const home = loaderAt({ elapsed: 12.5, loadedAt: 0.1, skipAt: null, path: 'full' });
    expect(probeAt(home)).toEqual(parked);
    expect(probeAt(loaderAt({ elapsed: 3.5, loadedAt: 1, skipAt: null, path: 'quick' }))).toEqual(probeAt(home));
    expect(probeAt(loaderAt({ elapsed: 3, loadedAt: 2, skipAt: null, path: 'reduced' }))).toEqual(probeAt(home));
  });

  it('is shown through the whole full show up to the end of its rise', () => {
    expect(probeAt(loaderAt({ elapsed: 0, loadedAt: 0.1, skipAt: null, path: 'full' })).shown).toBe(true);
    expect(probeAt(loaderAt({ elapsed: SCRIPT.probeOut.end - 0.01, loadedAt: 0.1, skipAt: null, path: 'full' })).shown).toBe(true);
    expect(probeAt(loaderAt({ elapsed: SCRIPT.probeOut.end, loadedAt: 0.1, skipAt: null, path: 'full' })).shown).toBe(false);
  });

  it('never jumps while it is shown, through the whole show', () => {
    const dt = 0.002;
    const faults: string[] = [];
    for (const [loadedAt, skipAt] of [
      [0.1, null],
      [null, null],
      [20, null],
      [0.1, 3],
      [null, 3],
      [20, 3]
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
