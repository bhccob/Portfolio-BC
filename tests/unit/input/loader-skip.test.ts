import { describe, expect, it } from 'vitest';
import { attachLoaderSkip, SKIP_EVENTS, SKIP_SWALLOW_MS, skipSwallows } from '../../../src/input/loaderSkip';

/** Dispatches a cancelable event carrying `props`; the returned event says whether it was prevented. */
function fire(target: EventTarget, type: string, props: Record<string, unknown> = {}, cancelable = true): Event {
  const event = new Event(type, { cancelable, bubbles: true });
  for (const [key, value] of Object.entries(props)) Object.defineProperty(event, key, { value });
  target.dispatchEvent(event);
  return event;
}

const key = (target: EventTarget, k: string, extra: Record<string, unknown> = {}) =>
  fire(target, 'keydown', { key: k, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, ...extra });

describe('skipSwallows', () => {
  it('swallows input through the fast-forward and 400 ms after it', () => {
    expect(skipSwallows(1000, null)).toBe(false);
    expect(skipSwallows(1399, 1000)).toBe(true);
    expect(skipSwallows(1400, 1000)).toBe(false);
  });

  it('holds from the moment the skip is asked for, and for 400 ms by the constant', () => {
    expect(SKIP_SWALLOW_MS).toBe(400);
    expect(skipSwallows(0, 1000)).toBe(true); // the fast-forward is still to come
    expect(skipSwallows(1000, 1000)).toBe(true);
    expect(skipSwallows(1000 + SKIP_SWALLOW_MS - 1, 1000)).toBe(true);
    expect(skipSwallows(1000 + SKIP_SWALLOW_MS, 1000)).toBe(false);
    expect(skipSwallows(1e9, 1000)).toBe(false);
  });

  it('reads a time that is not a number as not swallowing', () => {
    expect(skipSwallows(Number.NaN, 1000)).toBe(false);
    expect(skipSwallows(1000, Number.NaN)).toBe(false);
  });
});

describe('attachLoaderSkip', () => {
  it('listens for a pointer press, the wheel, a key and a touch', () => {
    expect([...SKIP_EVENTS]).toEqual(['pointerdown', 'wheel', 'keydown', 'touchstart']);
  });

  it('calls onSkip once however many events arrive', () => {
    const target = new EventTarget();
    let n = 0;
    attachLoaderSkip(target, () => n++);
    for (const type of SKIP_EVENTS) target.dispatchEvent(new Event(type));
    expect(n).toBe(1);
  });

  it('is skipped by any one of them alone', () => {
    for (const type of SKIP_EVENTS) {
      const target = new EventTarget();
      let n = 0;
      attachLoaderSkip(target, () => n++);
      target.dispatchEvent(new Event(type));
      expect(n, type).toBe(1);
    }
  });

  it('listens with passive: false on the wheel and the touch, which it may prevent', () => {
    const target = new EventTarget();
    const listened: { type: string; options: unknown }[] = [];
    const add = target.addEventListener.bind(target);
    target.addEventListener = ((type: string, listener: never, options?: unknown) => {
      listened.push({ type, options });
      add(type, listener, options as never);
    }) as typeof target.addEventListener;
    attachLoaderSkip(target, () => {});
    expect(listened.map((l) => l.type).sort()).toEqual([...SKIP_EVENTS].sort());
    expect(listened.find((l) => l.type === 'wheel')?.options).toMatchObject({ passive: false });
    expect(listened.find((l) => l.type === 'touchstart')?.options).toMatchObject({ passive: false });
  });

  it('prevents the wheel and the touch that skip, and every one after, as a trackpad keeps sending them', () => {
    const target = new EventTarget();
    let n = 0;
    attachLoaderSkip(target, () => n++);
    expect(fire(target, 'wheel', { deltaY: 100 }).defaultPrevented).toBe(true);
    for (let i = 0; i < 30; i++) expect(fire(target, 'wheel', { deltaY: 4 }).defaultPrevented).toBe(true);
    expect(fire(target, 'touchstart').defaultPrevented).toBe(true);
    expect(n).toBe(1);
  });

  it('does not prevent a pointer press, which scrolls nothing', () => {
    const target = new EventTarget();
    attachLoaderSkip(target, () => {});
    expect(fire(target, 'pointerdown').defaultPrevented).toBe(false);
  });

  it('prevents the keys that scroll the page, and leaves every other key its own', () => {
    const target = new EventTarget();
    let n = 0;
    attachLoaderSkip(target, () => n++);
    for (const scrolling of [' ', 'PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'Home', 'End']) {
      expect(key(target, scrolling).defaultPrevented, scrolling).toBe(true);
    }
    for (const other of ['Tab', 'Enter', 'Escape', 'a']) expect(key(target, other).defaultPrevented, other).toBe(false);
    expect(n).toBe(1);
  });

  it('does not skip on a shortcut, and leaves it alone: ctrl, meta and alt with a key', () => {
    for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) {
      const target = new EventTarget();
      let n = 0;
      attachLoaderSkip(target, () => n++);
      expect(key(target, 'ArrowDown', { [modifier]: true }).defaultPrevented, modifier).toBe(false);
      expect(key(target, 't', { [modifier]: true }).defaultPrevented, modifier).toBe(false);
      expect(n, modifier).toBe(0);
    }
  });

  it('does not skip on a key that is only a modifier, so Alt+Tab or Cmd+T never skip the show', () => {
    for (const modifier of ['Shift', 'Control', 'Alt', 'AltGraph', 'Meta']) {
      const target = new EventTarget();
      let n = 0;
      attachLoaderSkip(target, () => n++);
      expect(key(target, modifier).defaultPrevented, modifier).toBe(false);
      expect(n, modifier).toBe(0);
      key(target, 'a'); // a real key still does
      expect(n, modifier).toBe(1);
    }
  });

  it('skips on a key with Shift held: Shift is no shortcut', () => {
    const target = new EventTarget();
    let n = 0;
    attachLoaderSkip(target, () => n++);
    expect(key(target, ' ', { shiftKey: true }).defaultPrevented).toBe(true);
    expect(n).toBe(1);
  });

  it('does not skip on a wheel with ctrl held, which is the browser zoom, and does not prevent it', () => {
    const target = new EventTarget();
    let n = 0;
    attachLoaderSkip(target, () => n++);
    expect(fire(target, 'wheel', { deltaY: -100, ctrlKey: true }).defaultPrevented).toBe(false);
    expect(n).toBe(0);
    expect(fire(target, 'wheel', { deltaY: 100, ctrlKey: false }).defaultPrevented).toBe(true);
    expect(n).toBe(1);
  });

  it('leaves the zoom its wheel after the skip too', () => {
    const target = new EventTarget();
    attachLoaderSkip(target, () => {});
    fire(target, 'wheel', { deltaY: 100 });
    expect(fire(target, 'wheel', { deltaY: -100, ctrlKey: true }).defaultPrevented).toBe(false);
  });

  it('leaves a key typed into a field its own', () => {
    const target = new EventTarget();
    attachLoaderSkip(target, () => {});
    expect(key(target, ' ', { target: { tagName: 'INPUT' } }).defaultPrevented).toBe(false);
  });

  it('copes with an event that cannot be prevented', () => {
    const target = new EventTarget();
    let n = 0;
    attachLoaderSkip(target, () => n++);
    expect(() => fire(target, 'wheel', {}, false)).not.toThrow();
    expect(n).toBe(1);
  });

  it('stops listening when detached: no skip, and nothing prevented', () => {
    const target = new EventTarget();
    let n = 0;
    const detach = attachLoaderSkip(target, () => n++);
    detach();
    for (const type of SKIP_EVENTS) expect(fire(target, type).defaultPrevented, type).toBe(false);
    expect(n).toBe(0);
  });

  it('can be detached before any event, and again after one, harmlessly', () => {
    const target = new EventTarget();
    let n = 0;
    const detach = attachLoaderSkip(target, () => n++);
    target.dispatchEvent(new Event('wheel'));
    detach();
    expect(() => detach()).not.toThrow();
    expect(n).toBe(1);
  });

  it('skips once for each time it is attached', () => {
    const target = new EventTarget();
    let n = 0;
    attachLoaderSkip(target, () => n++)();
    expect(n).toBe(0);
    attachLoaderSkip(target, () => n++);
    target.dispatchEvent(new Event('keydown'));
    target.dispatchEvent(new Event('keydown'));
    expect(n).toBe(1);
  });
});
