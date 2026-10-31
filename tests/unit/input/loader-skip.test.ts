import { describe, expect, it } from 'vitest';
import { attachLoaderSkip, SKIP_EVENTS, SKIP_QUIET_MS, SKIP_SWALLOW_CAP_MS, SKIP_SWALLOW_MS, skipSwallower, skipSwallows } from '../../../src/input/loaderSkip';

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
    expect(skipSwallows(Number.NaN, 1000, 900)).toBe(false);
  });

  it('rolls on past the first 400 ms while the input keeps coming, until it has been quiet for 200 ms', () => {
    expect(SKIP_QUIET_MS).toBe(200);
    // The last input swallowed 150 ms ago: still the same stream.
    expect(skipSwallows(1600, 1000, 1450)).toBe(true);
    expect(skipSwallows(1600, 1000, 1401)).toBe(true);
    // 200 ms of quiet ends it.
    expect(skipSwallows(1600, 1000, 1400)).toBe(false);
    expect(skipSwallows(1600, 1000, null)).toBe(false);
  });

  it('stops 3 s after the landing however long the input keeps coming', () => {
    expect(SKIP_SWALLOW_CAP_MS).toBe(3000);
    expect(skipSwallows(1000 + SKIP_SWALLOW_CAP_MS - 1, 1000, 1000 + SKIP_SWALLOW_CAP_MS - 20)).toBe(true);
    expect(skipSwallows(1000 + SKIP_SWALLOW_CAP_MS, 1000, 1000 + SKIP_SWALLOW_CAP_MS - 20)).toBe(false);
    expect(skipSwallows(9000, 1000, 8990)).toBe(false);
  });
});

describe('skipSwallower', () => {
  /** A swallower on a clock the test moves, for a landing the test sets. */
  function make(landing: number | null) {
    const clock = { now: 0, landing };
    const swallow = skipSwallower(
      () => clock.now,
      () => clock.landing,
    );
    return { clock, swallow };
  }

  it('swallows a decaying 2.5 s momentum tail whole: each input it swallows holds it open', () => {
    const { clock, swallow } = make(1000);
    // Events from the landing on, 16 ms apart at first and 190 ms apart by the end, for 2.5 s.
    let gap = 16;
    for (clock.now = 1000; clock.now < 3500; clock.now += gap, gap = Math.min(190, gap * 1.08)) expect(swallow(), `at ${clock.now}`).toBe(true);
    // Then the pad is let go: 200 ms of quiet, and the next input is the visitor's.
    clock.now += SKIP_QUIET_MS;
    expect(swallow()).toBe(false);
  });

  it('ends after the first 400 ms when the input stops at the landing', () => {
    const { clock, swallow } = make(1000);
    clock.now = 1100;
    expect(swallow()).toBe(true);
    clock.now = 1401;
    expect(swallow()).toBe(false);
  });

  it('stops at the cap even with no pause at all', () => {
    const { clock, swallow } = make(1000);
    let last: boolean;
    for (clock.now = 1000; clock.now < 5000; clock.now += 50) {
      last = swallow();
      if (clock.now >= 1000 + SKIP_SWALLOW_CAP_MS) expect(last).toBe(false);
      else expect(last).toBe(true);
    }
  });

  it('swallows nothing while no skip has landed, and forgets the last input when a new landing comes', () => {
    const { clock, swallow } = make(null);
    clock.now = 500;
    expect(swallow()).toBe(false);
    clock.landing = 1000;
    clock.now = 1300;
    expect(swallow()).toBe(true);
    // A second skip lands much later: the stream of the first does not carry over.
    clock.landing = 10_000;
    clock.now = 10_450;
    expect(swallow()).toBe(false);
  });
});

describe('attachLoaderSkip', () => {
  it('listens for a pointer press, the wheel, a key and a touch, its start and its moves', () => {
    expect([...SKIP_EVENTS]).toEqual(['pointerdown', 'wheel', 'keydown', 'touchstart', 'touchmove']);
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

  it('listens with passive: false on the wheel and the touch’s moves, which it may prevent, and passively on the touch’s start', () => {
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
    expect(listened.find((l) => l.type === 'touchmove')?.options).toMatchObject({ passive: false });
    expect(listened.find((l) => l.type === 'touchstart')?.options).toMatchObject({ passive: true });
  });

  it('prevents the wheel that skips, and every one after, as a trackpad keeps sending them', () => {
    const target = new EventTarget();
    let n = 0;
    attachLoaderSkip(target, () => n++);
    expect(fire(target, 'wheel', { deltaY: 100 }).defaultPrevented).toBe(true);
    for (let i = 0; i < 30; i++) expect(fire(target, 'wheel', { deltaY: 4 }).defaultPrevented).toBe(true);
    expect(n).toBe(1);
  });

  it('skips on a touch’s start without preventing it, so a tap still clicks and a pinch still starts', () => {
    const target = new EventTarget();
    let n = 0;
    attachLoaderSkip(target, () => n++);
    expect(fire(target, 'touchstart', { touches: { length: 1 } }).defaultPrevented).toBe(false);
    expect(n).toBe(1);
    expect(fire(target, 'touchstart', { touches: { length: 2 } }).defaultPrevented).toBe(false);
    expect(n).toBe(1);
  });

  it('prevents a one-finger move, the drag that would scroll the page, and every one after', () => {
    const target = new EventTarget();
    let n = 0;
    attachLoaderSkip(target, () => n++);
    fire(target, 'touchstart', { touches: { length: 1 } });
    for (let i = 0; i < 20; i++) expect(fire(target, 'touchmove', { touches: { length: 1 } }).defaultPrevented, `move ${i}`).toBe(true);
    expect(n).toBe(1);
  });

  it('skips on a one-finger move alone too: a drag already under way when it began listening', () => {
    const target = new EventTarget();
    let n = 0;
    attachLoaderSkip(target, () => n++);
    expect(fire(target, 'touchmove', { touches: { length: 1 } }).defaultPrevented).toBe(true);
    expect(n).toBe(1);
  });

  it('leaves a pinch alone: a move of two fingers or more neither skips nor is prevented', () => {
    const target = new EventTarget();
    let n = 0;
    attachLoaderSkip(target, () => n++);
    for (const length of [2, 3]) expect(fire(target, 'touchmove', { touches: { length } }).defaultPrevented, `${length} fingers`).toBe(false);
    expect(n).toBe(0);
    // One finger again (the other lifted): a drag, prevented and skipping.
    expect(fire(target, 'touchmove', { touches: { length: 1 } }).defaultPrevented).toBe(true);
    expect(n).toBe(1);
    expect(fire(target, 'touchmove', { touches: { length: 2 } }).defaultPrevented).toBe(false);
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
