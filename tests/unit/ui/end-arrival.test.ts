import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { END_FOCUS_CAP_MS, END_FOCUS_CHECK_MS, focusEndOnArrival } from '../../../src/ui/endArrival';

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

/**
 * A document with <html data-end>, the end page's title (a focus spy) and a window with the fake observer and the timers;
 * `story.heading` is what the watch is told of the story (headed for the end, or not: a turn back).
 */
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
      setInterval: (callback: () => void, ms: number) => setInterval(callback, ms),
      clearInterval: (id: ReturnType<typeof setInterval>) => clearInterval(id),
    },
  };
  /** Home's end view writes `data-end`, and the observer hears it. */
  const endView = (state: string | null): void => {
    if (state === null) attributes.delete('data-end');
    else attributes.set('data-end', state);
    for (const observer of FakeObserver.made) observer.trigger();
  };
  const story = { heading: true };
  const heading = vi.fn(() => story.heading);
  return { doc: doc as unknown as Document, root, title, endView, story, heading };
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
    focusEndOnArrival(p.doc, p.heading);
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

  it('survives a long move from the home, through the whole void and a hold while it loads: no fixed timeout stops it', () => {
    const p = page();
    focusEndOnArrival(p.doc, p.heading);
    // Ten seconds on the way, the story headed for the end all along (a damped move from the home, or the hold).
    vi.advanceTimersByTime(10_000);
    expect(FakeObserver.made[0]!.connected).toBe(true);
    expect(p.heading).toHaveBeenCalled();
    p.endView('moving');
    p.endView('rest');
    expect(p.title.focus).toHaveBeenCalledTimes(1);
  });

  it("stops when the story's target leaves the end (a turn back): a later rest gives no focus", () => {
    const p = page();
    focusEndOnArrival(p.doc, p.heading);
    vi.advanceTimersByTime(2 * END_FOCUS_CHECK_MS);
    expect(FakeObserver.made[0]!.connected).toBe(true);
    p.story.heading = false; // an arrow up, Home, a wheel back: the story is going elsewhere
    vi.advanceTimersByTime(END_FOCUS_CHECK_MS);
    expect(FakeObserver.made[0]!.connected).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    // Back down to the end by other input: that rest is not the link's.
    p.story.heading = true;
    p.endView('rest');
    expect(p.title.focus).not.toHaveBeenCalled();
  });

  it('gives up after END_FOCUS_CAP_MS, about 15 s, only as a last resort', () => {
    const p = page();
    focusEndOnArrival(p.doc, p.heading);
    vi.advanceTimersByTime(END_FOCUS_CAP_MS - 1);
    expect(FakeObserver.made[0]!.connected).toBe(true);
    vi.advanceTimersByTime(1);
    expect(FakeObserver.made[0]!.connected).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    p.endView('rest');
    expect(p.title.focus).not.toHaveBeenCalled();
    expect(END_FOCUS_CAP_MS).toBe(15_000);
  });

  it('stops at once when told (the home page unmounts, or the link is pressed again), its timers with it', () => {
    const p = page();
    const stop = focusEndOnArrival(p.doc, p.heading);
    expect(vi.getTimerCount()).toBe(2); // the check of the story, and the cap
    stop();
    expect(FakeObserver.made[0]!.connected).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    p.endView('rest');
    expect(p.title.focus).not.toHaveBeenCalled();
    stop(); // twice is harmless
  });

  it('takes away its timers on arrival too', () => {
    const p = page();
    focusEndOnArrival(p.doc, p.heading);
    p.endView('rest');
    expect(vi.getTimerCount()).toBe(0);
  });
});
