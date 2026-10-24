import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { END_FOCUS_WAIT_MS, focusEndOnArrival } from '../../../src/ui/endArrival';

/** A MutationObserver the test triggers by hand, noting what it observes and whether it is still connected. */
class FakeObserver {
  static made: FakeObserver[] = [];
  observed: { target: unknown; options: MutationObserverInit } | null = null;
  connected = false;

  constructor(private readonly callback: () => void) {
    FakeObserver.made.push(this);
  }

  observe(target: unknown, options: MutationObserverInit): void {
    this.observed = { target, options };
    this.connected = true;
  }

  disconnect(): void {
    this.connected = false;
  }

  /** A mutation of what it observes: the callback runs only while it is connected, as a real one's would. */
  trigger(): void {
    if (this.connected) this.callback();
  }
}

/** A document with <html data-end>, the end page's title (a focus spy) and a window with the fake observer and the timers. */
function page() {
  const attributes = new Map<string, string>();
  const title = { focus: vi.fn() };
  const root = { getAttribute: (name: string) => attributes.get(name) ?? null };
  const doc = {
    documentElement: root,
    getElementById: (id: string) => (id === 'end-title' ? title : null),
    defaultView: {
      MutationObserver: FakeObserver,
      setTimeout: (callback: () => void, ms: number) => setTimeout(callback, ms),
      clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    },
  };
  /** Home's end view writes `data-end`, and the observer hears it. */
  const endView = (state: string | null): void => {
    if (state === null) attributes.delete('data-end');
    else attributes.set('data-end', state);
    for (const observer of FakeObserver.made) observer.trigger();
  };
  return { doc: doc as unknown as Document, root, title, endView };
}

describe("focusEndOnArrival: the end page's title takes the focus once the link's move rests there", () => {
  beforeEach(() => {
    FakeObserver.made = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('watches <html data-end> alone, and focuses #end-title without scrolling once it says rest, then stops watching', () => {
    const p = page();
    focusEndOnArrival(p.doc);
    expect(FakeObserver.made).toHaveLength(1);
    expect(FakeObserver.made[0]!.observed).toEqual({ target: p.root, options: { attributes: true, attributeFilter: ['data-end'] } });
    p.endView('moving');
    expect(p.title.focus).not.toHaveBeenCalled();
    p.endView('rest');
    expect(p.title.focus).toHaveBeenCalledTimes(1);
    expect(p.title.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(FakeObserver.made[0]!.connected).toBe(false);
    // A later rest (the story left and came back by other input) is not the link's: no focus again.
    p.endView(null);
    p.endView('rest');
    expect(p.title.focus).toHaveBeenCalledTimes(1);
  });

  it('gives up after END_FOCUS_WAIT_MS: a move that turned back, or 3D switched off, leaves the focus where it is', () => {
    const p = page();
    focusEndOnArrival(p.doc);
    vi.advanceTimersByTime(END_FOCUS_WAIT_MS - 1);
    expect(FakeObserver.made[0]!.connected).toBe(true);
    vi.advanceTimersByTime(1);
    expect(FakeObserver.made[0]!.connected).toBe(false);
    p.endView('rest');
    expect(p.title.focus).not.toHaveBeenCalled();
    expect(END_FOCUS_WAIT_MS).toBe(3_000);
  });

  it('stops at once when told (the home page unmounts, or the link is pressed again), its timer with it', () => {
    const p = page();
    const stop = focusEndOnArrival(p.doc);
    expect(vi.getTimerCount()).toBe(1);
    stop();
    expect(FakeObserver.made[0]!.connected).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    p.endView('rest');
    expect(p.title.focus).not.toHaveBeenCalled();
    stop(); // twice is harmless
  });

  it('takes away its timer on arrival too', () => {
    const p = page();
    focusEndOnArrival(p.doc);
    p.endView('rest');
    expect(vi.getTimerCount()).toBe(0);
  });
});
