import { describe, expect, it } from 'vitest';
import { SafeStorage } from '~/engine/core/SafeStorage';
import {
  advanceClock,
  FPS,
  HOLD_AT,
  LOADER,
  LOADER_SEEN_KEY,
  loaderAt,
  loaderGaveUp,
  loaderSeen,
  type LoaderPath,
  markLoaderSeen,
  pathFor,
  QUICK,
  SCRIPT
} from '~/engine/bob/loaderTimeline';
import { STROKE_ORDER } from '~/engine/bob/wordmark';

const full = (elapsed: number, loadedAt: number | null = 0.1, skipAt: number | null = null) => loaderAt({ elapsed, loadedAt, skipAt, path: 'full' });
const quick = (elapsed: number, loadedAt: number | null = 1) => loaderAt({ elapsed, loadedAt, skipAt: null, path: 'quick' });
const reduced = (elapsed: number, loadedAt: number | null = 2) => loaderAt({ elapsed, loadedAt, skipAt: null, path: 'reduced' });

/** A working storage held in memory, for the tests that run in node (no window). */
function memoryStorage(): { storage: SafeStorage; items: Map<string, string> } {
  const items = new Map<string, string>();
  const fake = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value)
  } as unknown as Storage;
  return { storage: new SafeStorage(() => fake), items };
}

/** A skip pressed while the circle is still being cut, before the hold, with room left after it for a full LOADER.skip. */
const EARLY_SKIP = 1.5;

describe('the script', () => {
  it('is the O-only preview (bob_animate_o.py) at 24 fps', () => {
    expect(FPS).toBe(24);
    expect(SCRIPT.descend).toEqual({ start: 1 / 24, end: 26 / 24 });
    expect(SCRIPT.circle).toEqual({ start: 26 / 24, end: 74 / 24 });
    expect(SCRIPT.ticks).toEqual({ start: 72 / 24, end: 86 / 24 });
    expect(SCRIPT.outer).toEqual({ start: 74 / 24, end: 96 / 24 });
    expect(SCRIPT.probeOut).toEqual({ start: 74 / 24, end: 94 / 24 });
    expect(SCRIPT.iris).toEqual({ start: 80 / 24, end: 96 / 24 });
    expect(SCRIPT.glow).toEqual({ start: 78 / 24, end: 106 / 24 });
    expect(SCRIPT.rise).toEqual({ start: 88 / 24, end: 140 / 24 });
    expect(SCRIPT.camera).toEqual({ start: 80 / 24, end: 140 / 24 });
    expect(SCRIPT.settle).toEqual({ start: 100 / 24, end: 150 / 24 });
    expect(SCRIPT.home).toBe(6.25);
    expect('leftB' in SCRIPT).toBe(false);
  });

  it('has the O-only spans and no B spans', () => {
    expect(Object.keys(SCRIPT).sort()).toEqual(['camera', 'circle', 'descend', 'glow', 'home', 'iris', 'outer', 'probeOut', 'rise', 'settle', 'ticks'].sort());
    for (const id of ['leftB', 'leftBar', 'rightB', 'rightBar']) expect(id in SCRIPT, id).toBe(false);
  });

  it('cuts the circle as the descent ends, and the probe leaves as the circle closes', () => {
    expect(SCRIPT.circle.start).toBe(SCRIPT.descend.end);
    expect(SCRIPT.probeOut.start).toBe(SCRIPT.circle.end);
  });

  it('keeps the circle as the fifth of the clock’s five strokes', () => {
    expect(STROKE_ORDER.indexOf('circle')).toBe(4);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(SCRIPT)).toBe(true);
    expect(Object.isFrozen(SCRIPT.circle)).toBe(true);
    expect(Object.isFrozen(QUICK)).toBe(true);
    expect(Object.isFrozen(QUICK.rise)).toBe(true);
  });

  it('holds the circle short of closing at 92 % of its span', () => {
    expect(HOLD_AT).toBe((26 + 0.92 * 48) / 24);
  });
});

describe('loaderAt, the full path', () => {
  it('cuts the circle at constant speed: half of it at 2.08 s, all of it at 74/24 s', () => {
    expect(full(50 / 24).strokes[4]).toBeCloseTo(0.5, 6);
    expect(full(74 / 24).strokes[4]).toBe(1);
    expect(full(2).stage).toBe('engrave');
    expect(full(0.5).stage).toBe('dark');
    expect(full(6.24).stage).toBe('rise');
    expect(full(6.25).stage).toBe('home');
  });

  it('never draws a B: the four B strokes are 0 at every second of every path, skipped or held', () => {
    for (const path of ['full', 'quick', 'reduced'] as const)
      for (let t = 0; t <= 30; t += 0.05)
        for (const input of [{ loadedAt: 0 }, { loadedAt: null }, { loadedAt: 20, skipAt: 1 }])
          expect(loaderAt({ elapsed: t, skipAt: null, path, ...input }).strokes.slice(0, 4)).toEqual([0, 0, 0, 0]);
  });

  it('holds the circle short of closing while the load is out, crawling, never back', () => {
    const H = HOLD_AT;
    expect(full(H + 4, null).strokes[4]).toBeCloseTo(0.92 + 0.06 * (1 - Math.exp(-1)), 6);
    expect(full(H + 4, null).stage).toBe('engrave');
    let last = 0;
    for (let t = 0; t < 30; t += 0.05) {
      const s = full(t, 20).strokes[4];
      expect(s).toBeGreaterThanOrEqual(last);
      last = s;
    }
    expect(full(20 + (SCRIPT.home - H), 20).stage).toBe('home');
  });

  it('fast-forwards the rest in 1 s on a skip once loaded', () => {
    expect(full(EARLY_SKIP + LOADER.skip - 0.01, 0.1, EARLY_SKIP).stage).not.toBe('home');
    expect(full(EARLY_SKIP + LOADER.skip, 0.1, EARLY_SKIP).stage).toBe('home');
  });

  it('fast-forwards to the hold on a skip before the load, then finishes 1 s after it loads', () => {
    expect(full(6, null, EARLY_SKIP).strokes[4]).toBeGreaterThanOrEqual(0.92);
    expect(full(10.99, 10, EARLY_SKIP).stage).not.toBe('home');
    expect(full(11.0, 10, EARLY_SKIP).stage).toBe('home');
  });

  it('reads NaN and negative times as 0', () => {
    expect(full(Number.NaN).stage).toBe('dark');
    expect(full(-5).stage).toBe('dark');
    expect(full(1, Number.NaN, Number.NaN).script).toBe(1);
    expect(full(-1, -2, -3).script).toBe(0);
  });

  it('is dark until the descent ends, then engraves until the circle is cut', () => {
    expect(full(SCRIPT.descend.end - 0.01).stage).toBe('dark');
    expect(full(SCRIPT.descend.end).stage).toBe('engrave');
    expect(full(SCRIPT.circle.end - 0.01).stage).toBe('engrave');
  });

  it('opens until the rings start to rise, then rises until home', () => {
    expect(full(SCRIPT.circle.end).stage).toBe('open');
    expect(full(SCRIPT.rise.start - 0.01).stage).toBe('open');
    expect(full(SCRIPT.rise.start).stage).toBe('rise');
    expect(full(SCRIPT.home - 0.01).stage).toBe('rise');
  });

  it('cuts the circle alone, from nothing as the descent ends to whole as the circle closes', () => {
    expect(full(SCRIPT.circle.start - 0.01).strokes).toEqual([0, 0, 0, 0, 0]);
    expect(full(SCRIPT.circle.start).strokes).toEqual([0, 0, 0, 0, 0]);
    const t = (SCRIPT.circle.start + SCRIPT.circle.end) / 2;
    expect(full(t).strokes.slice(0, 4)).toEqual([0, 0, 0, 0]);
    expect(full(t).strokes[4]).toBeCloseTo(0.5, 9);
    expect(full(SCRIPT.circle.end).strokes).toEqual([0, 0, 0, 0, 1]);
  });

  it('reports the script time as the elapsed time on a fast load', () => {
    expect(full(0).script).toBe(0);
    expect(full(5.3).script).toBe(5.3);
  });

  it('reads each span as its progress, 0..1', () => {
    const mid = (s: { start: number; end: number }) => (s.start + s.end) / 2;
    expect(full(mid(SCRIPT.ticks)).ticks).toBeCloseTo(0.5, 9);
    expect(full(mid(SCRIPT.outer)).outer).toBeCloseTo(0.5, 9);
    expect(full(mid(SCRIPT.iris)).iris).toBeCloseTo(0.5, 9);
    expect(full(mid(SCRIPT.glow)).glow).toBeCloseTo(0.5, 9);
    expect(full(mid(SCRIPT.rise)).rise).toBeCloseTo(0.5, 9);
    expect(full(mid(SCRIPT.camera)).camera).toBeCloseTo(0.5, 9);
    expect(full(mid(SCRIPT.settle)).settle).toBeCloseTo(0.5, 9);
    expect(full(0).ticks).toBe(0);
    expect(full(SCRIPT.home).settle).toBe(1);
  });

  it('fades up from black over the descent', () => {
    expect(full(0).fade).toBe(0);
    expect(full(SCRIPT.descend.end).fade).toBe(1);
    expect(full(8).fade).toBe(1);
  });

  it('has every mark done by the time it is home', () => {
    const c = full(SCRIPT.home);
    expect(c.strokes).toEqual([0, 0, 0, 0, 1]);
    expect([c.ticks, c.outer, c.iris, c.glow, c.rise, c.camera, c.settle, c.fade]).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
  });
});

describe('loaderAt, waiting for a late load', () => {
  const H = HOLD_AT;

  it('stops the script at the hold while the load is out, however long', () => {
    expect(full(H).script).toBeCloseTo(H, 9);
    expect(full(H + 100, null).script).toBeCloseTo(H, 9);
    expect(full(H + 100, null).stage).toBe('engrave');
  });

  it('never closes the circle while waiting: it creeps toward 98 %', () => {
    expect(full(H, null).strokes[4]).toBeCloseTo(0.92, 9);
    expect(full(H + 1000, null).strokes[4]).toBeCloseTo(0.98, 6);
    expect(full(H + 1000, null).strokes[4]).toBeLessThan(1);
  });

  it('resumes the script from the hold when the load lands', () => {
    expect(full(20, 20).script).toBeCloseTo(H, 9);
    expect(full(21, 20).script).toBeCloseTo(H + 1, 9);
    expect(full(20 + (SCRIPT.circle.end - H), 20).strokes[4]).toBe(1);
  });

  it('does not take the circle back when it resumes', () => {
    const crawled = full(20, 20).strokes[4];
    expect(crawled).toBeGreaterThan(0.97);
    expect(full(20.001, 20).strokes[4]).toBeGreaterThanOrEqual(crawled);
  });

  it('does not stall for a load that lands before the hold', () => {
    expect(full(H + 1, H - 0.5).script).toBeCloseTo(H + 1, 9);
    expect(full(H + 1, H).script).toBeCloseTo(H + 1, 9);
  });

  it('keeps every stroke moving forward through a stall, a late load and any skip', () => {
    const cases: [number | null, number | null][] = [
      [0.1, null],
      [null, null],
      [20, null],
      [0.1, EARLY_SKIP],
      [0.1, SCRIPT.home - 0.5],
      [null, EARLY_SKIP],
      [null, 15],
      [20, EARLY_SKIP],
      [20, 15],
      [20, 21],
      [4, 2],
      [4, 5],
      [H, H]
    ];
    const dt = 0.002;
    const faults: string[] = [];
    for (const [loadedAt, skipAt] of cases) {
      let last = full(0, loadedAt, skipAt);
      for (let t = dt; t < 40; t += dt) {
        const c = full(t, loadedAt, skipAt);
        const where = `loadedAt ${loadedAt}, skipAt ${skipAt}, t ${t.toFixed(3)}`;
        if (c.script < last.script) faults.push(`script back at ${where}`);
        // The script never jumps: the fastest it runs is the whole script in the skip's second.
        if (c.script - last.script > (SCRIPT.home / LOADER.skip) * dt * 1.01) faults.push(`script jumps at ${where}`);
        c.strokes.forEach((s, i) => {
          if (s < last.strokes[i] || s > 1) faults.push(`stroke ${i} at ${s} after ${last.strokes[i]} at ${where}`);
        });
        last = c;
      }
    }
    expect(faults).toEqual([]);
  });

  it('always gets home: one second after a late load that was skipped, or at once on a skip after the load', () => {
    for (const [loadedAt, skipAt, homeAt] of [
      [20, EARLY_SKIP, 21],
      [20, 20, 21],
      [20, 22, 23],
      [0.1, 5, 6]
    ] as const) {
      expect(full(homeAt - 0.01, loadedAt, skipAt).stage).not.toBe('home');
      expect(full(homeAt, loadedAt, skipAt).stage).toBe('home');
    }
  });
});

describe('loaderAt, the skip', () => {
  it('runs the rest of the script in LOADER.skip seconds, linearly', () => {
    const c = full(EARLY_SKIP + LOADER.skip / 2, 0.1, EARLY_SKIP);
    expect(c.script).toBeCloseTo(EARLY_SKIP + (SCRIPT.home - EARLY_SKIP) * 0.5, 9);
  });

  it('does nothing before it is pressed', () => {
    expect(full(EARLY_SKIP - 0.1, 0.1, EARLY_SKIP).script).toBe(EARLY_SKIP - 0.1);
    expect(full(EARLY_SKIP, 0.1, EARLY_SKIP).script).toBe(EARLY_SKIP);
  });

  it('keeps the home once there', () => {
    expect(full(50, 0.1, EARLY_SKIP).stage).toBe('home');
    expect(full(50, 0.1, EARLY_SKIP).script).toBe(SCRIPT.home);
  });

  it('never runs the script past the home, with or without a skip', () => {
    expect(full(50).script).toBe(SCRIPT.home);
    expect(full(50, 20).script).toBe(SCRIPT.home);
    expect(full(50, 10, EARLY_SKIP).script).toBe(SCRIPT.home);
  });

  it('does not run backwards on a skip pressed after the home', () => {
    const after = SCRIPT.home + 0.75;
    expect(full(after + 1, 0.1, after).script).toBe(SCRIPT.home);
    expect(full(after, 0.1, after).script).toBe(SCRIPT.home);
    expect(full(after + 0.5, 0.1, after).stage).toBe('home');
    expect(full(30, 20, 25).script).toBe(SCRIPT.home);
  });

  it('fast-forwards to the hold and waits there for a load that has not landed', () => {
    const c = full(30, null, EARLY_SKIP);
    expect(c.stage).toBe('engrave');
    expect(c.script).toBeCloseTo(HOLD_AT, 9);
    expect(c.strokes[4]).toBeCloseTo(0.98, 3);
  });

  it('crawls from the moment the fast-forward reaches the hold, not from the unskipped one', () => {
    const reached = EARLY_SKIP + ((HOLD_AT - EARLY_SKIP) * LOADER.skip) / (SCRIPT.home - EARLY_SKIP);
    expect(full(reached + 4, null, EARLY_SKIP).strokes[4]).toBeCloseTo(0.92 + 0.06 * (1 - Math.exp(-1)), 6);
  });

  it('keeps waiting when the skip comes during the wait', () => {
    expect(full(HOLD_AT + 4, null, HOLD_AT + 2).strokes[4]).toBeCloseTo(0.92 + 0.06 * (1 - Math.exp(-1)), 6);
    expect(full(30, null, HOLD_AT + 2).stage).toBe('engrave');
    expect(full(30, 12, HOLD_AT + 2).stage).toBe('home');
  });

  it('never ends later than the show would have: a skip at 5.75 s lands by 6.25 s', () => {
    // The load landed early, so the show alone comes home at SCRIPT.home, 6.25 s.
    expect(full(6.24, 0.1, 5.75).stage).not.toBe('home');
    expect(full(SCRIPT.home, 0.1, 5.75).stage).toBe('home');
    expect(full(SCRIPT.home, 0.1, 5.75).script).toBe(SCRIPT.home);
    // Less than LOADER.skip was left, so the rest plays at its own pace: the script is the unskipped one.
    for (const t of [5.75, 5.85, 6.0, 6.2]) expect(full(t, 0.1, 5.75).script, `at ${t}`).toBeCloseTo(full(t).script, 9);
  });

  it('still lands one LOADER.skip after a skip with more than that left: a skip at 1.5 s lands at 2.5 s', () => {
    expect(full(2.49, 0.1, 1.5).stage).not.toBe('home');
    expect(full(2.5, 0.1, 1.5).stage).toBe('home');
    // 5.25 s is exactly one LOADER.skip before the home: either rule lands at 6.25 s.
    expect(full(6.24, 0.1, SCRIPT.home - LOADER.skip).stage).not.toBe('home');
    expect(full(SCRIPT.home, 0.1, SCRIPT.home - LOADER.skip).stage).toBe('home');
  });

  it('lands no later than the unskipped show, whenever the skip comes, for an early load and a late one', () => {
    // A skip before the load runs the rest from the hold in LOADER.skip, which is sooner only while more is left there.
    expect(SCRIPT.home - HOLD_AT).toBeGreaterThan(LOADER.skip);
    const faults: string[] = [];
    for (const loadedAt of [0.1, 4, 20]) {
      const unskipped = (() => {
        for (let t = 0; t < 60; t += 0.01) if (full(t, loadedAt).stage === 'home') return t;
        return Infinity;
      })();
      for (let skipAt = 0; skipAt < unskipped; skipAt += 0.05) {
        let lands = Infinity;
        for (let t = skipAt; t < 60; t += 0.01) {
          if (full(t, loadedAt, skipAt).stage === 'home') {
            lands = t;
            break;
          }
        }
        if (lands > unskipped + 1e-9) faults.push(`loadedAt ${loadedAt}, skip at ${skipAt.toFixed(2)}: home at ${lands.toFixed(2)}, the show at ${unskipped.toFixed(2)}`);
        // A skip once the load is in lands within LOADER.skip of it.
        if (skipAt >= loadedAt && lands > skipAt + LOADER.skip + 0.02) faults.push(`loadedAt ${loadedAt}, skip at ${skipAt.toFixed(2)}: home at ${lands.toFixed(2)}, more than a skip after it`);
      }
    }
    expect(faults).toEqual([]);
  });

  it('ignores a skip that is not there', () => {
    expect(full(5, 0.1, null)).toEqual(full(5, 0.1, Number.NaN));
  });
});

describe('loaderAt, the quick path', () => {
  it('plays the quick path in 2.5 s from the load, every mark already cut', () => {
    expect(quick(0.9).stage).toBe('dark');
    expect(quick(1.0).strokes).toEqual([0, 0, 0, 0, 1]);
    expect(quick(3.49).stage).not.toBe('home');
    expect(quick(3.5).stage).toBe('home');
  });

  it('is dark until the load, with the marks already cut and nothing shown', () => {
    for (const c of [quick(0, null), quick(0.5)]) {
      expect(c.stage).toBe('dark');
      expect(c.strokes).toEqual([0, 0, 0, 0, 1]);
      expect([c.fade, c.iris, c.glow, c.rise, c.camera, c.settle]).toEqual([0, 0, 0, 0, 0, 0]);
    }
  });

  it('keeps the circle, the ticks and the outer ring whole, and the B strokes uncut', () => {
    for (const t of [0, 1, 1.5, 2.2, 3.5, 9]) {
      const c = quick(t);
      expect([...c.strokes, c.ticks, c.outer]).toEqual([0, 0, 0, 0, 1, 1, 1]);
    }
  });

  it('reads each span from the load', () => {
    expect(quick(1 + 0.4).fade).toBeCloseTo(0.5, 9);
    expect(quick(1 + 0.7).iris).toBeCloseTo(0.5, 9);
    expect(quick(1 + 0.8).glow).toBeCloseTo(0.5, 9);
    expect(quick(1 + 1.45).rise).toBeCloseTo(0.5, 9);
    expect(quick(1 + 1.2).camera).toBeCloseTo(0.5, 9);
    expect(quick(1 + 1.95).settle).toBeCloseTo(0.5, 9);
    expect(quick(1 + 2.5).fade).toBe(1);
  });

  it('opens, then rises, then is home', () => {
    expect(quick(1 + 0.69).stage).toBe('open');
    expect(quick(1 + 0.7).stage).toBe('rise');
    expect(quick(1 + 2.49).stage).toBe('rise');
  });

  it('waits in the dark for a load that is out', () => {
    expect(quick(50, null).stage).toBe('dark');
  });

  it('has no skip: it is short already', () => {
    expect(loaderAt({ elapsed: 1.5, loadedAt: 1, skipAt: 1.2, path: 'quick' })).toEqual(quick(1.5));
  });

  it('puts the probe past its end: the full script has played', () => {
    expect(quick(2).script).toBe(SCRIPT.home);
    expect(quick(0, null).script).toBe(SCRIPT.home);
  });
});

describe('loaderAt, the reduced path', () => {
  it('fades the reduced path in 1 s with the camera at home', () => {
    expect(reduced(2.5).camera).toBe(1);
    expect(reduced(2.5).fade).toBeCloseTo(0.5, 6);
    expect(reduced(3).stage).toBe('home');
  });

  it('is dark until the load, then fades in over a second', () => {
    expect(reduced(1.9).stage).toBe('dark');
    expect(reduced(1.9).fade).toBe(0);
    expect(reduced(50, null).stage).toBe('dark');
    expect(reduced(2).fade).toBe(0);
    expect(reduced(2.999).stage).not.toBe('home');
    expect(reduced(3).fade).toBe(1);
  });

  it('has every value at 1 but the fade and the B strokes, and the camera at home throughout', () => {
    for (const t of [0, 2, 2.5, 3, 20]) {
      const c = reduced(t);
      expect([...c.strokes, c.ticks, c.outer, c.iris, c.glow, c.rise, c.camera, c.settle]).toEqual([0, 0, 0, 0, ...Array(8).fill(1)]);
    }
    expect(reduced(0, null).camera).toBe(1);
  });

  it('has no skip: it is a fade', () => {
    expect(loaderAt({ elapsed: 2.5, loadedAt: 2, skipAt: 2.2, path: 'reduced' })).toEqual(reduced(2.5));
  });
});

describe('the clock', () => {
  it('advances by the step, held to 0..maxStep', () => {
    expect(advanceClock(1, -3)).toBe(1);
    expect(advanceClock(1, 5)).toBeCloseTo(1.1, 9);
    expect(advanceClock(1, 0.05)).toBeCloseTo(1.05, 9);
    expect(advanceClock(1, Number.NaN)).toBe(1);
  });

  it('reads a NaN elapsed as 0', () => {
    expect(advanceClock(Number.NaN, 0.05)).toBeCloseTo(0.05, 9);
    expect(advanceClock(Number.NaN, Number.NaN)).toBe(0);
    expect(advanceClock(-2, 0.05)).toBeCloseTo(0.05, 9);
  });

  it('gives up only on a load still out after 25 s', () => {
    expect(loaderGaveUp(24.9, null)).toBe(false);
    expect(loaderGaveUp(25, null)).toBe(true);
    expect(loaderGaveUp(99, 3)).toBe(false);
  });

  it('reads a load time that is not a number as not loaded, so it still gives up', () => {
    expect(loaderGaveUp(24.9, Number.NaN)).toBe(false);
    expect(loaderGaveUp(25, Number.NaN)).toBe(true);
    expect(loaderGaveUp(25, Infinity)).toBe(true);
  });
});

describe('the path and the visit', () => {
  it('takes reduced over quick, quick over full', () => {
    expect(pathFor(true, true)).toBe('reduced');
    expect(pathFor(true, false)).toBe('quick');
    expect(pathFor(false, false)).toBe('full');
    expect(pathFor(false, true)).toBe('reduced' satisfies LoaderPath);
  });

  it('reads a throwing storage as a first visit', () => {
    const broken = new SafeStorage(() => {
      throw new Error('blocked');
    });
    expect(loaderSeen(broken)).toBe(false);
    expect(() => markLoaderSeen(broken)).not.toThrow();
  });

  it('remembers the loader under its key, and nothing else reads as seen', () => {
    const { storage, items } = memoryStorage();
    expect(LOADER_SEEN_KEY).toBe('bob-loader-seen');
    expect(loaderSeen(storage)).toBe(false);
    markLoaderSeen(storage);
    expect(items.get('bob-loader-seen')).toBe('1');
    expect(loaderSeen(storage)).toBe(true);
    items.set('bob-loader-seen', '0');
    expect(loaderSeen(storage)).toBe(false);
  });
});
