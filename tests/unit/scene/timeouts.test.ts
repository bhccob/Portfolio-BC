import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HOLD_AT, LOADER, QUICK, SCRIPT } from '~/engine/bob/loaderTimeline';
import {
  LANDING_TIMEOUT_MS,
  type LandingWatch,
  landingBackstop,
  LOAD_TIMEOUT_MS,
  type SceneShown,
  type VisibilitySource,
  visibleTimeout,
  whileShown,
} from '~/scene/timeouts';

/** A document whose visibility the test sets, counting its listeners. */
function fakeDocument(state: DocumentVisibilityState) {
  const listeners = new Set<() => void>();
  const doc = {
    visibilityState: state,
    addEventListener: (_type: 'visibilitychange', listener: () => void) => void listeners.add(listener),
    removeEventListener: (_type: 'visibilitychange', listener: () => void) => void listeners.delete(listener),
  };
  const set = (next: DocumentVisibilityState): void => {
    doc.visibilityState = next;
    for (const listener of [...listeners]) listener();
  };
  return { doc: doc as VisibilitySource, set, listeners };
}

describe('visibleTimeout', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires after the time on a visible page, once, and lets go of its listener', () => {
    const { doc, listeners } = fakeDocument('visible');
    const expire = vi.fn();
    visibleTimeout(12_000, expire, doc);
    vi.advanceTimersByTime(11_999);
    expect(expire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(expire).toHaveBeenCalledOnce();
    expect(listeners.size).toBe(0);
    vi.advanceTimersByTime(60_000);
    expect(expire).toHaveBeenCalledOnce();
  });

  it('does not count time while the page is hidden from the start (a background tab)', () => {
    const { doc, set } = fakeDocument('hidden');
    const expire = vi.fn();
    visibleTimeout(12_000, expire, doc);
    vi.advanceTimersByTime(600_000);
    expect(expire).not.toHaveBeenCalled();
    set('visible');
    vi.advanceTimersByTime(11_999);
    expect(expire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(expire).toHaveBeenCalledOnce();
  });

  it('stops the clock while hidden and goes on with what was left', () => {
    const { doc, set } = fakeDocument('visible');
    const expire = vi.fn();
    visibleTimeout(12_000, expire, doc);
    vi.advanceTimersByTime(5_000);
    set('hidden');
    vi.advanceTimersByTime(60_000);
    expect(expire).not.toHaveBeenCalled();
    set('visible');
    vi.advanceTimersByTime(6_999);
    expect(expire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(expire).toHaveBeenCalledOnce();
  });

  it('takes a repeated "visible" as no news', () => {
    const { doc, set } = fakeDocument('visible');
    const expire = vi.fn();
    visibleTimeout(1_000, expire, doc);
    vi.advanceTimersByTime(600);
    set('visible');
    vi.advanceTimersByTime(400);
    expect(expire).toHaveBeenCalledOnce();
  });

  it('never fires once cancelled, and lets go of its listener', () => {
    const { doc, set, listeners } = fakeDocument('visible');
    const expire = vi.fn();
    const cancel = visibleTimeout(1_000, expire, doc);
    vi.advanceTimersByTime(500);
    cancel();
    expect(listeners.size).toBe(0);
    set('hidden');
    set('visible');
    vi.advanceTimersByTime(10_000);
    expect(expire).not.toHaveBeenCalled();
  });
});

describe('the landing backstop (Ruling 9b)', () => {
  it("waits for the loader's give-up, then the whole of the full show, then a margin", () => {
    expect(LANDING_TIMEOUT_MS).toBe(Math.round((LOADER.giveUp + SCRIPT.home + 5) * 1000));
    expect(LANDING_TIMEOUT_MS).toBe(36_250);
    // Longer than any opening that works: the latest a load may land (the give-up) plus the longest show after it. A
    // full show runs its whole script at most (a load that lands late holds it at the circle and goes on from there,
    // SCRIPT.home - HOLD_AT after the load); the quick and reduced paths run theirs from the load.
    expect(LANDING_TIMEOUT_MS).toBeGreaterThan((LOADER.giveUp + SCRIPT.home - HOLD_AT) * 1000);
    expect(LANDING_TIMEOUT_MS).toBeGreaterThan(SCRIPT.home * 1000);
    expect(LANDING_TIMEOUT_MS).toBeGreaterThan((LOADER.giveUp + QUICK.home) * 1000);
    expect(LANDING_TIMEOUT_MS).toBeGreaterThan((LOADER.giveUp + LOADER.reducedFade) * 1000);
    expect(LANDING_TIMEOUT_MS).toBeGreaterThan(LOAD_TIMEOUT_MS);
  });
});

describe('whileShown', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /** A store's say on whether a scene is on the page, which the test sets, counting its listeners. */
  function fakeScene(on: boolean) {
    const listeners = new Set<() => void>();
    let shown = on;
    const scene: SceneShown = {
      shown: () => shown,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => void listeners.delete(listener);
      },
    };
    const set = (next: boolean): void => {
      shown = next;
      for (const listener of [...listeners]) listener();
    };
    return { scene, set, listeners };
  }

  it('reads hidden while the page is hidden or shows no scene, visible only with both', () => {
    const page = fakeDocument('visible');
    const host = fakeScene(true);
    const source = whileShown(page.doc, host.scene);
    expect(source.visibilityState).toBe('visible');
    host.set(false);
    expect(source.visibilityState).toBe('hidden');
    page.set('hidden');
    expect(source.visibilityState).toBe('hidden');
    host.set(true);
    expect(source.visibilityState).toBe('hidden');
    page.set('visible');
    expect(source.visibilityState).toBe('visible');
  });

  it("counts only the time a scene is on a visible page: a visitor reading Lite mid-opening is not the opening's to answer for", () => {
    const page = fakeDocument('visible');
    const host = fakeScene(true);
    const expire = vi.fn();
    visibleTimeout(10_000, expire, whileShown(page.doc, host.scene));
    vi.advanceTimersByTime(4_000);
    host.set(false); // off to Lite: the canvas sleeps there and the opening's clock with it
    vi.advanceTimersByTime(120_000);
    expect(expire).not.toHaveBeenCalled();
    host.set(true);
    page.set('hidden'); // back, but in a background tab
    vi.advanceTimersByTime(120_000);
    expect(expire).not.toHaveBeenCalled();
    page.set('visible');
    vi.advanceTimersByTime(5_999);
    expect(expire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(expire).toHaveBeenCalledOnce();
  });

  it('lets go of both its listeners when the timer fires, and when it is cancelled', () => {
    const page = fakeDocument('visible');
    const host = fakeScene(true);
    visibleTimeout(1_000, () => {}, whileShown(page.doc, host.scene));
    expect(page.listeners.size).toBe(1);
    expect(host.listeners.size).toBe(1);
    vi.advanceTimersByTime(1_000);
    expect(page.listeners.size).toBe(0);
    expect(host.listeners.size).toBe(0);

    const cancel = visibleTimeout(1_000, () => {}, whileShown(page.doc, host.scene));
    cancel();
    expect(page.listeners.size).toBe(0);
    expect(host.listeners.size).toBe(0);
  });
});

describe('landingBackstop', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /** A store's phase and page, which the test sets, telling its listeners of every change, as zustand does. */
  function fakeStore(loading: boolean, shown = true) {
    const listeners = new Set<() => void>();
    const now = { loading, shown, held: false };
    const store: LandingWatch = {
      loading: () => now.loading,
      shown: () => now.shown,
      held: () => now.held,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => void listeners.delete(listener);
      },
    };
    const set = (next: Partial<typeof now>): void => {
      Object.assign(now, next);
      for (const listener of [...listeners]) listener();
    };
    return { store, set, listeners };
  }

  it('fails an opening still loading LANDING_TIMEOUT_MS after the loader showed, once, and lets go of everything', () => {
    const page = fakeDocument('visible');
    const { store, listeners } = fakeStore(true);
    const fail = vi.fn();
    landingBackstop(store, fail, page.doc);
    vi.advanceTimersByTime(LANDING_TIMEOUT_MS - 1);
    expect(fail).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fail).toHaveBeenCalledOnce();
    expect(listeners.size).toBe(0);
    expect(page.listeners.size).toBe(0);
    vi.advanceTimersByTime(10 * LANDING_TIMEOUT_MS);
    expect(fail).toHaveBeenCalledOnce();
  });

  it('stands down for good as soon as the phase leaves LOADING: the opening landed', () => {
    const page = fakeDocument('visible');
    const { store, set, listeners } = fakeStore(true);
    const fail = vi.fn();
    landingBackstop(store, fail, page.doc);
    vi.advanceTimersByTime(LANDING_TIMEOUT_MS / 2);
    set({ loading: false });
    expect(listeners.size).toBe(0);
    expect(page.listeners.size).toBe(0);
    vi.advanceTimersByTime(10 * LANDING_TIMEOUT_MS);
    expect(fail).not.toHaveBeenCalled();
  });

  it('starts nothing for an opening that has nothing to land: the phase has already left LOADING', () => {
    const page = fakeDocument('visible');
    const { store, listeners } = fakeStore(false);
    const fail = vi.fn();
    const stop = landingBackstop(store, fail, page.doc);
    expect(listeners.size).toBe(0);
    expect(page.listeners.size).toBe(0);
    vi.advanceTimersByTime(10 * LANDING_TIMEOUT_MS);
    expect(fail).not.toHaveBeenCalled();
    stop();
  });

  it("does not fail an opening whose clock a seek holds (?proof): it waits a whole budget again from there", () => {
    const page = fakeDocument('visible');
    const { store, set, listeners } = fakeStore(true);
    const fail = vi.fn();
    landingBackstop(store, fail, page.doc);
    set({ held: true });
    vi.advanceTimersByTime(LANDING_TIMEOUT_MS);
    expect(fail).not.toHaveBeenCalled();
    expect(listeners.size).toBe(2); // still watching: the phase, and the re-armed timer's scene
    set({ held: false });
    vi.advanceTimersByTime(LANDING_TIMEOUT_MS - 1);
    expect(fail).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fail).toHaveBeenCalledOnce();
    expect(listeners.size).toBe(0);
    expect(page.listeners.size).toBe(0);
  });

  it('counts only the time a scene is on a visible page, and can be stopped by its owner', () => {
    const page = fakeDocument('visible');
    const { store, set, listeners } = fakeStore(true);
    const fail = vi.fn();
    const stop = landingBackstop(store, fail, page.doc);
    vi.advanceTimersByTime(LANDING_TIMEOUT_MS - 1_000);
    set({ shown: false }); // reading Lite mid-opening
    vi.advanceTimersByTime(10 * LANDING_TIMEOUT_MS);
    expect(fail).not.toHaveBeenCalled();
    set({ shown: true });
    vi.advanceTimersByTime(999);
    expect(fail).not.toHaveBeenCalled();
    stop(); // the Stage went away
    expect(listeners.size).toBe(0);
    expect(page.listeners.size).toBe(0);
    vi.advanceTimersByTime(10 * LANDING_TIMEOUT_MS);
    expect(fail).not.toHaveBeenCalled();
  });
});
