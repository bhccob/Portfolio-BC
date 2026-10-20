import { describe, expect, it } from 'vitest';
import { VirtualScroll } from '../../../src/input/VirtualScroll';

/** One pixel of a unit is a thousandth of a unit: a viewport 1000 px high. */
const VH = 1000;

interface Setup {
  el: EventTarget;
  win: EventTarget;
  state: { enabled: boolean; reduced: boolean };
  deltas: number[];
  jumps: string[];
  wakes: { count: number };
  listened: { type: string; options: unknown }[];
  scroll: VirtualScroll;
}

function setup(state = { enabled: true, reduced: false }): Setup {
  const el = new EventTarget();
  const win = new EventTarget();
  Object.defineProperty(el, 'ownerDocument', { value: { defaultView: win } });
  const listened: Setup['listened'] = [];
  const add = el.addEventListener.bind(el);
  el.addEventListener = ((type: string, listener: never, options?: unknown) => {
    listened.push({ type, options });
    add(type, listener, options as never);
  }) as typeof el.addEventListener;

  const deltas: number[] = [];
  const jumps: string[] = [];
  const wakes = { count: 0 };
  const scroll = new VirtualScroll(el as unknown as HTMLElement, {
    unitPx: () => VH,
    onDelta: (units) => deltas.push(units),
    onJump: (to) => jumps.push(to),
    enabled: () => state.enabled,
    reducedMotion: () => state.reduced,
    wake: () => wakes.count++,
  });
  return { el, win, state, deltas, jumps, wakes, listened, scroll };
}

/** Dispatches a cancelable event carrying `props`; the returned event says whether it was prevented. */
function fire(target: EventTarget, type: string, props: Record<string, unknown> = {}): Event {
  const event = new Event(type, { cancelable: true, bubbles: true });
  for (const [key, value] of Object.entries(props)) Object.defineProperty(event, key, { value });
  target.dispatchEvent(event);
  return event;
}

const wheel = (s: Setup, deltaY: number, timeStamp = 1000, extra: Record<string, unknown> = {}) =>
  fire(s.el, 'wheel', { deltaY, deltaMode: 0, ctrlKey: false, timeStamp, ...extra });
const key = (s: Setup, k: string, extra: Record<string, unknown> = {}) =>
  fire(s.win, 'keydown', { key: k, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, repeat: false, isComposing: false, target: { tagName: 'BODY' }, ...extra });

const finger = (x: number, y: number) => ({ clientX: x, clientY: y });
const touch = (s: Setup, type: 'touchstart' | 'touchmove' | 'touchend', y: number, timeStamp: number, extra: Record<string, unknown> = {}) =>
  fire(s.el, type, { touches: type === 'touchend' ? [] : [finger(100, y)], timeStamp, ...extra });

describe('VirtualScroll: wheel', () => {
  it('listens with passive: false, so it may prevent the page scroll', () => {
    const s = setup();
    expect(s.listened.find((l) => l.type === 'wheel')?.options).toMatchObject({ passive: false });
    expect(s.listened.find((l) => l.type === 'touchmove')?.options).toMatchObject({ passive: false });
  });

  it('turns a wheel notch into units of the viewport and prevents the scroll', () => {
    const s = setup();
    const event = wheel(s, 100);
    expect(event.defaultPrevented).toBe(true);
    expect(s.deltas).toEqual([0.1]);
  });

  it('goes up for a negative delta', () => {
    const s = setup();
    wheel(s, -100);
    expect(s.deltas).toEqual([-0.1]);
  });

  it('clamps one event, as normalizeWheel does', () => {
    const s = setup();
    wheel(s, 900);
    expect(s.deltas).toEqual([0.24]);
  });

  it('leaves the page to the browser when it is not enabled', () => {
    const s = setup({ enabled: false, reduced: false });
    const event = wheel(s, 100);
    expect(event.defaultPrevented).toBe(false);
    expect(s.deltas).toEqual([]);
  });

  it('leaves a pinch (a wheel with ctrl) to the browser', () => {
    const s = setup();
    const event = wheel(s, 100, 1000, { ctrlKey: true });
    expect(event.defaultPrevented).toBe(false);
    expect(s.deltas).toEqual([]);
  });

  it('asks enabled() at every event', () => {
    const s = setup();
    wheel(s, 100, 1000);
    s.state.enabled = false;
    wheel(s, 100, 1100);
    s.state.enabled = true;
    wheel(s, 100, 1200);
    expect(s.deltas).toHaveLength(2);
  });

  describe('with reduced motion', () => {
    it('gives one step for a whole gesture: events less than 250 ms apart', () => {
      const s = setup({ enabled: true, reduced: true });
      const prevented: boolean[] = [];
      for (let t = 1000; t < 2000; t += 16) prevented.push(wheel(s, 4, t).defaultPrevented);
      expect(s.deltas).toHaveLength(1);
      expect(s.deltas[0]).toBeGreaterThan(0);
      expect(prevented.every(Boolean)).toBe(true); // the rest of the gesture is still the scene's, not the page's
    });

    it('gives another step after 250 ms of quiet, in the new direction', () => {
      const s = setup({ enabled: true, reduced: true });
      wheel(s, 4, 1000);
      wheel(s, 4, 1016);
      wheel(s, -4, 1300);
      wheel(s, -4, 1316);
      expect(s.deltas).toHaveLength(2);
      expect(s.deltas[0]).toBeGreaterThan(0);
      expect(s.deltas[1]).toBeLessThan(0);
    });

    it('gives a step for each notch of a mouse wheel turned slowly', () => {
      const s = setup({ enabled: true, reduced: true });
      wheel(s, 100, 1000);
      wheel(s, 100, 1500);
      wheel(s, 100, 2000);
      expect(s.deltas).toHaveLength(3);
    });
  });
});

describe('VirtualScroll: keys', () => {
  it('moves by the key and prevents its default', () => {
    const s = setup();
    expect(key(s, 'PageDown').defaultPrevented).toBe(true);
    expect(key(s, 'ArrowUp').defaultPrevented).toBe(true);
    expect(s.deltas).toEqual([0.9, -0.15]);
  });

  it('jumps for Home and End', () => {
    const s = setup();
    expect(key(s, 'Home').defaultPrevented).toBe(true);
    key(s, 'End');
    expect(s.jumps).toEqual(['home', 'end']);
    expect(s.deltas).toEqual([]);
  });

  it('leaves a text field its keys', () => {
    const s = setup();
    const event = key(s, ' ', { target: { tagName: 'INPUT' } });
    expect(event.defaultPrevented).toBe(false);
    expect(s.deltas).toEqual([]);
    expect(key(s, 'End', { target: { tagName: 'TEXTAREA' } }).defaultPrevented).toBe(false);
    expect(s.jumps).toEqual([]);
  });

  it('leaves a shortcut alone: ctrl, meta and alt', () => {
    const s = setup();
    for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) expect(key(s, 'ArrowDown', { [modifier]: true }).defaultPrevented).toBe(false);
    expect(s.deltas).toEqual([]);
  });

  it('leaves a key something else already handled, and one typed into an IME', () => {
    const s = setup();
    const handled = new Event('keydown', { cancelable: true });
    Object.defineProperties(handled, {
      key: { value: 'PageDown' },
      shiftKey: { value: false },
      ctrlKey: { value: false },
      metaKey: { value: false },
      altKey: { value: false },
      target: { value: { tagName: 'BODY' } },
    });
    handled.preventDefault();
    s.win.dispatchEvent(handled);
    key(s, 'PageDown', { isComposing: true });
    expect(s.deltas).toEqual([]);
  });

  it('leaves the keys to the browser when it is not enabled', () => {
    const s = setup({ enabled: false, reduced: false });
    expect(key(s, 'PageDown').defaultPrevented).toBe(false);
    expect(key(s, 'Home').defaultPrevented).toBe(false);
    expect(s.deltas).toEqual([]);
    expect(s.jumps).toEqual([]);
  });

  it('gives one step a key press with reduced motion, and none for a held key', () => {
    const s = setup({ enabled: true, reduced: true });
    key(s, 'PageDown');
    key(s, 'PageDown', { repeat: true });
    key(s, 'PageDown', { repeat: true });
    expect(s.deltas).toEqual([0.9]);
  });
});

describe('VirtualScroll: touch', () => {
  /** A swipe up: the finger goes from y 500 to y 100 in steps of 40 px, 16 ms apart; returns the time of the lift. */
  function swipeUp(s: Setup): number {
    let t = 0;
    touch(s, 'touchstart', 500, t);
    for (let y = 460; y >= 100; y -= 40) {
      t += 16;
      touch(s, 'touchmove', y, t);
    }
    touch(s, 'touchend', 100, t + 4);
    return t + 4;
  }

  it('moves the scene with the finger, up being down the story', () => {
    const s = setup();
    touch(s, 'touchstart', 500, 0);
    const moved = touch(s, 'touchmove', 400, 16);
    expect(moved.defaultPrevented).toBe(true);
    expect(s.deltas.reduce((a, b) => a + b, 0)).toBeCloseTo(0.1, 12);
    touch(s, 'touchmove', 380, 32);
    expect(s.deltas.reduce((a, b) => a + b, 0)).toBeCloseTo(0.12, 12);
    touch(s, 'touchmove', 400, 48);
    expect(s.deltas.reduce((a, b) => a + b, 0)).toBeCloseTo(0.1, 12);
  });

  it('leaves a tap alone: no prevention, no movement', () => {
    const s = setup();
    expect(touch(s, 'touchstart', 500, 0).defaultPrevented).toBe(false);
    expect(touch(s, 'touchmove', 497, 16).defaultPrevented).toBe(false); // finger jitter, inside the slop
    expect(touch(s, 'touchend', 497, 40).defaultPrevented).toBe(false);
    expect(s.deltas).toEqual([]);
    expect(s.scroll.busy).toBe(false);
  });

  it('ignores a swipe that goes sideways', () => {
    const s = setup();
    touch(s, 'touchstart', 500, 0);
    const moved = fire(s.el, 'touchmove', { touches: [finger(300, 490)], timeStamp: 16 });
    expect(moved.defaultPrevented).toBe(false);
    touch(s, 'touchmove', 300, 32); // and the rest of it, even when it turns downward
    expect(s.deltas).toEqual([]);
  });

  it('leaves a pinch (two fingers) to the browser', () => {
    const s = setup();
    touch(s, 'touchstart', 500, 0);
    const pinch = fire(s.el, 'touchmove', { touches: [finger(100, 400), finger(200, 400)], timeStamp: 16 });
    expect(pinch.defaultPrevented).toBe(false);
    touch(s, 'touchmove', 300, 32);
    expect(s.deltas).toEqual([]);
  });

  it('leaves the page to the browser when it is not enabled', () => {
    const s = setup({ enabled: false, reduced: false });
    touch(s, 'touchstart', 500, 0);
    expect(touch(s, 'touchmove', 300, 16).defaultPrevented).toBe(false);
    expect(s.deltas).toEqual([]);
  });

  it('carries on after the finger lifts: wakes the frame loop and steps in the swipe direction', () => {
    const s = setup();
    swipeUp(s);
    const dragged = s.deltas.reduce((a, b) => a + b, 0);
    expect(dragged).toBeCloseTo(0.4, 12);
    expect(s.scroll.busy).toBe(true);
    expect(s.wakes.count).toBe(1);
    s.deltas.length = 0;
    s.scroll.step(1 / 60);
    expect(s.deltas).toHaveLength(1);
    expect(s.deltas[0]).toBeGreaterThan(0);
  });

  it('comes to rest', () => {
    const s = setup();
    swipeUp(s);
    for (let i = 0; i < 300; i++) s.scroll.step(1 / 60);
    expect(s.scroll.busy).toBe(false);
  });

  it('stops carrying on when a finger lands, and when the wheel turns', () => {
    const s = setup();
    swipeUp(s);
    touch(s, 'touchstart', 500, 1000);
    expect(s.scroll.busy).toBe(false);
    swipeUp(s);
    expect(s.scroll.busy).toBe(true);
    wheel(s, 100, 2000);
    expect(s.scroll.busy).toBe(false);
  });

  it('stops carrying on when the scroll stops being enabled', () => {
    const s = setup();
    swipeUp(s);
    s.state.enabled = false;
    s.deltas.length = 0;
    s.scroll.step(1 / 60);
    expect(s.deltas).toEqual([]);
    expect(s.scroll.busy).toBe(false);
  });

  describe('with reduced motion', () => {
    it('gives one step for a swipe, when the finger lifts, and no carrying on', () => {
      const s = setup({ enabled: true, reduced: true });
      swipeUp(s);
      expect(s.deltas).toHaveLength(1);
      expect(s.deltas[0]).toBeGreaterThan(0);
      expect(s.scroll.busy).toBe(false);
      expect(s.wakes.count).toBe(0);
    });

    it('steps back for a swipe down', () => {
      const s = setup({ enabled: true, reduced: true });
      touch(s, 'touchstart', 100, 0);
      touch(s, 'touchmove', 300, 16);
      touch(s, 'touchmove', 500, 32);
      touch(s, 'touchend', 500, 40);
      expect(s.deltas).toHaveLength(1);
      expect(s.deltas[0]).toBeLessThan(0);
    });

    it('takes a short drag for no swipe', () => {
      const s = setup({ enabled: true, reduced: true });
      touch(s, 'touchstart', 500, 0);
      touch(s, 'touchmove', 480, 16);
      touch(s, 'touchend', 480, 32);
      expect(s.deltas).toEqual([]);
    });
  });
});

describe('VirtualScroll: dispose', () => {
  it('takes every listener off', () => {
    const s = setup();
    s.scroll.dispose();
    expect(wheel(s, 100).defaultPrevented).toBe(false);
    expect(key(s, 'PageDown').defaultPrevented).toBe(false);
    touch(s, 'touchstart', 500, 0);
    touch(s, 'touchmove', 300, 16);
    expect(s.deltas).toEqual([]);
  });

  it('stops the carrying on, and may be called twice', () => {
    const s = setup();
    touch(s, 'touchstart', 500, 0);
    for (let y = 460, t = 16; y >= 100; y -= 40, t += 16) touch(s, 'touchmove', y, t);
    touch(s, 'touchend', 100, 200);
    s.scroll.dispose();
    expect(s.scroll.busy).toBe(false);
    expect(() => s.scroll.dispose()).not.toThrow();
  });
});
