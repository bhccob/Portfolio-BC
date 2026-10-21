import { describe, expect, it } from 'vitest';
import { advanceClock, LOADER, LOADER_SEEN_KEY, loaderAt, loaderGaveUp, loaderSeen, markLoaderSeen } from '~/engine/v3/loaderTimeline';
import { SafeStorage } from '~/engine/core/SafeStorage';

const base = { quick: false, reduced: false };

/** A working storage held in memory, for the tests that run in node (no window). */
function memoryStorage(): { storage: SafeStorage; items: Map<string, string> } {
  const items = new Map<string, string>();
  const fake = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value)
  } as unknown as Storage;
  return { storage: new SafeStorage(() => fake), items };
}

describe('loaderAt, the full path', () => {
  it('loader-slow: never cuts ahead of the load, however long it takes', () => {
    const c = loaderAt({ ...base, elapsed: 30, shown: 0.4, loadedAt: null });
    expect(c.stage).toBe('engrave');
    expect(c.engraving).toBeCloseTo(0.4, 9);
    expect(c.pins).toBe(25);
  });
  it('never cuts faster than the minimum, however fast the load', () => {
    const c = loaderAt({ ...base, elapsed: 1.1, shown: 1, loadedAt: 0.3 });
    expect(c.stage).toBe('engrave');
    expect(c.engraving).toBeCloseTo(0.5, 9);
  });
  it('runs power, circuit, land, home after the engraving', () => {
    const at = (elapsed: number) => loaderAt({ ...base, elapsed, shown: 1, loadedAt: 1 }).stage;
    const e = LOADER.engraveMin;
    expect(at(e + 0.1)).toBe('power');
    expect(at(e + LOADER.power + 0.1)).toBe('circuit');
    expect(at(e + LOADER.power + LOADER.circuit + 0.1)).toBe('land');
    expect(at(e + LOADER.power + LOADER.circuit + LOADER.land + 0.01)).toBe('home');
  });
  it('starts each stage on its boundary: the stage ends are open, the starts closed', () => {
    const e = LOADER.engraveMin;
    const at = (elapsed: number) => loaderAt({ ...base, elapsed, shown: 1, loadedAt: 1 }).stage;
    expect(at(0)).toBe('engrave');
    expect(at(e - 1e-9)).toBe('engrave');
    expect(at(e)).toBe('power');
    expect(at(e + LOADER.power)).toBe('circuit');
    expect(at(e + LOADER.power + LOADER.circuit)).toBe('land');
    expect(at(e + LOADER.power + LOADER.circuit + LOADER.land)).toBe('home');
  });
  it('waits for a late load: the engraving ends at the load, and the stages follow from there', () => {
    // The load lands at 4 s, well after the 2.2 s minimum; shown has been less than 1 until then.
    const during = loaderAt({ ...base, elapsed: 3.9, shown: 0.97, loadedAt: null });
    expect(during.stage).toBe('engrave');
    expect(during.engraving).toBeCloseTo(0.97, 9);
    expect(loaderAt({ ...base, elapsed: 4.05, shown: 1, loadedAt: 4 }).stage).toBe('power');
    expect(loaderAt({ ...base, elapsed: 4 + LOADER.power + 0.05, shown: 1, loadedAt: 4 }).stage).toBe('circuit');
  });
  it('holds the ON and all 64 pins from power on', () => {
    for (const elapsed of [2.3, 3.5, 5, 6, 20]) {
      expect(loaderAt({ ...base, elapsed, shown: 1, loadedAt: 1 })).toMatchObject({ engraving: 1, pins: 64 });
    }
  });
  it('local runs 0..1 through each stage: one point per stage', () => {
    const e = LOADER.engraveMin;
    const clock = (elapsed: number, shown = 1, loadedAt: number | null = 1) => loaderAt({ ...base, elapsed, shown, loadedAt });
    // engrave: how much of the ON is cut, which is 1 only as the stage ends.
    expect(clock(1.1).local).toBeCloseTo(0.5, 9);
    expect(clock(30, 0.4, null).local).toBeCloseTo(0.4, 9);
    expect(clock(e - 1e-9).local).toBeCloseTo(1, 6);
    // power, circuit and land: elapsed through the stage over its length.
    expect(clock(e + LOADER.power / 2).local).toBeCloseTo(0.5, 9);
    expect(clock(e + LOADER.power + LOADER.circuit / 4).local).toBeCloseTo(0.25, 9);
    expect(clock(e + LOADER.power + LOADER.circuit + LOADER.land * 0.75).local).toBeCloseTo(0.75, 9);
    // home and dark have no progress to report.
    expect(clock(e + LOADER.power + LOADER.circuit + LOADER.land + 1).local).toBe(0);
    expect(loaderAt({ ...base, quick: true, elapsed: 1, shown: 0.3, loadedAt: null }).local).toBe(0);
  });
});

describe('the quick and reduced paths', () => {
  it('quick: dark until loaded, then a short landing, no engraving', () => {
    expect(loaderAt({ ...base, quick: true, elapsed: 2, shown: 0.6, loadedAt: null })).toMatchObject({ stage: 'dark', engraving: 0, pins: 0 });
    expect(loaderAt({ ...base, quick: true, elapsed: 2.2, shown: 1, loadedAt: 2 }).stage).toBe('land');
    expect(loaderAt({ ...base, quick: true, elapsed: 2 + LOADER.quick + 0.01, shown: 1, loadedAt: 2 }).stage).toBe('home');
  });
  it('quick: land runs from the load for LOADER.quick, local through it, engraving and pins stay 0', () => {
    const c = loaderAt({ ...base, quick: true, elapsed: 2 + LOADER.quick / 2, shown: 1, loadedAt: 2 });
    expect(c).toMatchObject({ stage: 'land', engraving: 0, pins: 0 });
    expect(c.local).toBeCloseTo(0.5, 9);
    expect(loaderAt({ ...base, quick: true, elapsed: 9, shown: 1, loadedAt: 2 })).toMatchObject({ stage: 'home', local: 0, engraving: 0, pins: 0 });
  });
  it('reduced: a static ON, pins with the load, then a fade; never power or circuit', () => {
    expect(loaderAt({ ...base, reduced: true, elapsed: 0.2, shown: 0.5, loadedAt: null })).toMatchObject({ stage: 'engrave', engraving: 1, pins: 32 });
    const stages = [0.5, 1.05, 1.5, 3].map((elapsed) => loaderAt({ ...base, reduced: true, elapsed, shown: 1, loadedAt: 0.4 }).stage);
    expect(stages).toEqual(['engrave', 'land', 'land', 'home']);
  });
  it('reduced: holds the ON, fills the pins, fades for reducedFade from the later of the hold and the load', () => {
    // Loaded at 0.4, held to 1.0: land runs 1.0 .. 1.6.
    const fade = loaderAt({ ...base, reduced: true, elapsed: 1 + LOADER.reducedFade / 2, shown: 1, loadedAt: 0.4 });
    expect(fade).toMatchObject({ stage: 'land', engraving: 1, pins: 64 });
    expect(fade.local).toBeCloseTo(0.5, 9);
    expect(loaderAt({ ...base, reduced: true, elapsed: 1 + LOADER.reducedFade + 0.01, shown: 1, loadedAt: 0.4 }).stage).toBe('home');
    // A slow load: the ON waits, however long, and the fade starts at the load.
    expect(loaderAt({ ...base, reduced: true, elapsed: 6, shown: 0.8, loadedAt: null }).stage).toBe('engrave');
    expect(loaderAt({ ...base, reduced: true, elapsed: 7.1, shown: 1, loadedAt: 7 }).stage).toBe('land');
  });
  it('reduced: local is the load share held back by the hold, 1 only as the stage ends', () => {
    expect(loaderAt({ ...base, reduced: true, elapsed: 0.5, shown: 1, loadedAt: 0.4 }).local).toBeCloseTo(0.5, 9);
    expect(loaderAt({ ...base, reduced: true, elapsed: 5, shown: 0.3, loadedAt: null }).local).toBeCloseTo(0.3, 9);
  });
  it('quick wins over reduced: a seen loader does not play the static ON again', () => {
    expect(loaderAt({ quick: true, reduced: true, elapsed: 0.5, shown: 0.5, loadedAt: null }).stage).toBe('dark');
    expect(loaderAt({ quick: true, reduced: true, elapsed: 2.2, shown: 1, loadedAt: 2 }).stage).toBe('land');
  });
});

describe('odd input', () => {
  it('reads a share outside 0..1 or NaN as held to 0..1, and a negative or NaN time as 0', () => {
    expect(loaderAt({ ...base, elapsed: 10, shown: 7, loadedAt: null })).toMatchObject({ stage: 'engrave', engraving: 1, pins: 64 });
    expect(loaderAt({ ...base, elapsed: 10, shown: Number.NaN, loadedAt: null })).toMatchObject({ stage: 'engrave', engraving: 0, pins: 0 });
    expect(loaderAt({ ...base, elapsed: -1, shown: 0, loadedAt: null })).toMatchObject({ stage: 'engrave', engraving: 0, local: 0 });
    expect(loaderAt({ ...base, elapsed: Number.NaN, shown: 0, loadedAt: null }).stage).toBe('engrave');
  });
});

describe('time and giving up', () => {
  it('advanceClock: a hidden tab does not count, and one long frame counts as 0.1 s at most', () => {
    expect(advanceClock(1, 12)).toBeCloseTo(1.1, 9);
    expect(advanceClock(1, -3)).toBe(1);
  });
  it('advanceClock: an ordinary frame counts in full, NaN counts as nothing', () => {
    expect(advanceClock(1, 0.016)).toBeCloseTo(1.016, 9);
    expect(advanceClock(1, Number.NaN)).toBe(1);
  });
  it('loader-gives-up: at 15 visible seconds without the load', () => {
    expect(loaderGaveUp(14.9, null)).toBe(false);
    expect(loaderGaveUp(15, null)).toBe(true);
    expect(loaderGaveUp(40, 3)).toBe(false);
  });
  it('a storage that throws counts as not seen and does not crash', () => {
    const broken = new SafeStorage(() => { throw new Error('private mode'); });
    expect(loaderSeen(broken)).toBe(false);
    expect(() => markLoaderSeen(broken)).not.toThrow();
  });
});

describe('the seen flag', () => {
  it('is not seen until marked, then seen, under the loader key', () => {
    const { storage, items } = memoryStorage();
    expect(loaderSeen(storage)).toBe(false);
    markLoaderSeen(storage);
    expect(loaderSeen(storage)).toBe(true);
    expect(items.get(LOADER_SEEN_KEY)).toBe('1');
    expect(LOADER_SEEN_KEY).toBe('needle-loader-seen');
  });
  it('counts anything but "1" as not seen', () => {
    const { storage, items } = memoryStorage();
    for (const value of ['0', 'true', '', 'yes']) {
      items.set(LOADER_SEEN_KEY, value);
      expect(loaderSeen(storage)).toBe(false);
    }
  });
});
