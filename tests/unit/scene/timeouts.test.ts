import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type VisibilitySource, visibleTimeout } from '~/scene/timeouts';

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
