import { describe, expect, it } from 'vitest';
import { GESTURE_GAP_MS } from '../../../src/input/gesture';
import { type DeltaSource, VirtualScroll } from '../../../src/input/VirtualScroll';

/** One pixel of a unit is a thousandth of a unit: a viewport 1000 px high. */
const VH = 1000;

interface Setup {
  el: EventTarget;
  win: EventTarget;
  state: { enabled: boolean; reduced: boolean; swallow?: boolean };
  deltas: number[];
  /** Where each delta came from, in step with `deltas`. */
  bys: DeltaSource[];
  /** Each gesture's end, as the glide it leaves (units). */
  ends: number[];
  jumps: string[];
  wakes: { count: number };
  listened: { type: string; options: unknown }[];
  scroll: VirtualScroll;
}

function setup(state: Setup['state'] = { enabled: true, reduced: false }): Setup {
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
  const bys: DeltaSource[] = [];
  const ends: number[] = [];
  const jumps: string[] = [];
  const wakes = { count: 0 };
  const scroll = new VirtualScroll(el as unknown as HTMLElement, {
    unitPx: () => VH,
    onDelta: (units, by) => {
      deltas.push(units);
      bys.push(by);
    },
    onJump: (to) => jumps.push(to),
    onGestureEnd: (glide) => ends.push(glide),
    enabled: () => state.enabled,
    reducedMotion: () => state.reduced,
    swallow: () => state.swallow === true,
    wake: () => wakes.count++,
  });
  return { el, win, state, deltas, bys, ends, jumps, wakes, listened, scroll };
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

describe('VirtualScroll: stopGlide', () => {
  it('ends a glide that is going', () => {
    const s = setup();
    touch(s, 'touchstart', 500, 0);
    for (let y = 460, t = 16; y >= 100; y -= 40, t += 16) touch(s, 'touchmove', y, t);
    touch(s, 'touchend', 100, 164);
    expect(s.scroll.busy).toBe(true);
    s.scroll.stopGlide();
    expect(s.scroll.busy).toBe(false);
  });

  it('keeps the touch in progress: the finger is still the scroll\'s, and a drag that is pinned gives no glide', () => {
    const s = setup();
    touch(s, 'touchstart', 500, 0);
    touch(s, 'touchmove', 400, 16);
    s.scroll.stopGlide();
    s.deltas.length = 0;
    expect(touch(s, 'touchmove', 380, 32).defaultPrevented).toBe(true);
    expect(s.deltas).toEqual([0.02]);
    s.scroll.stopGlide(); // what a caller whose target is pinned does at each delta
    touch(s, 'touchend', 380, 40);
    expect(s.scroll.busy).toBe(false);
  });
});

describe('VirtualScroll: swallowing (the input that skipped the loader)', () => {
  const swallowing = () => setup({ enabled: true, reduced: false, swallow: true });

  it('prevents a wheel it swallows, and moves nothing', () => {
    const s = swallowing();
    for (let t = 1000; t < 1500; t += 16) expect(wheel(s, 100, t).defaultPrevented).toBe(true);
    expect(s.deltas).toEqual([]);
  });

  it('takes the wheel again the moment it stops swallowing', () => {
    const s = swallowing();
    wheel(s, 100, 1000);
    s.state.swallow = false;
    expect(wheel(s, 100, 1016).defaultPrevented).toBe(true);
    expect(s.deltas).toEqual([0.1]);
  });

  it('asks swallow() at every event', () => {
    const s = setup();
    wheel(s, 100, 1000);
    s.state.swallow = true;
    wheel(s, 100, 1100);
    s.state.swallow = false;
    wheel(s, 100, 1200);
    expect(s.deltas).toEqual([0.1, 0.1]);
  });

  it('stops a glide that is going when a swallowed wheel turns: the swallow does not return before it', () => {
    const s = setup();
    touch(s, 'touchstart', 500, 0);
    for (let y = 460, t = 16; y >= 100; y -= 40, t += 16) touch(s, 'touchmove', y, t);
    touch(s, 'touchend', 100, 200);
    expect(s.scroll.busy).toBe(true);
    s.state.swallow = true;
    wheel(s, 100, 1000);
    expect(s.scroll.busy).toBe(false);
  });

  it('ends a glide at its next step, rather than carrying the story on', () => {
    const s = setup();
    touch(s, 'touchstart', 500, 0);
    for (let y = 460, t = 16; y >= 100; y -= 40, t += 16) touch(s, 'touchmove', y, t);
    touch(s, 'touchend', 100, 200);
    expect(s.scroll.busy).toBe(true);
    s.state.swallow = true;
    s.deltas.length = 0;
    s.scroll.step(1 / 60);
    expect(s.deltas).toEqual([]);
    expect(s.scroll.busy).toBe(false);
  });

  it('prevents the keys that scroll, and moves nothing and jumps nowhere', () => {
    const s = swallowing();
    for (const k of ['PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', ' ', 'Home', 'End']) expect(key(s, k).defaultPrevented, k).toBe(true);
    expect(s.deltas).toEqual([]);
    expect(s.jumps).toEqual([]);
  });

  it('still leaves the other keys, a text field and a shortcut to the browser', () => {
    const s = swallowing();
    expect(key(s, 'Tab').defaultPrevented).toBe(false);
    expect(key(s, ' ', { target: { tagName: 'INPUT' } }).defaultPrevented).toBe(false);
    expect(key(s, 'PageDown', { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(key(s, ' ', { target: { tagName: 'BUTTON' } }).defaultPrevented).toBe(false);
  });

  it('prevents a swipe it swallows and moves nothing, with no glide when the finger lifts', () => {
    const s = swallowing();
    touch(s, 'touchstart', 500, 0);
    let t = 0;
    for (let y = 460; y >= 100; y -= 40) {
      t += 16;
      expect(touch(s, 'touchmove', y, t).defaultPrevented).toBe(true);
    }
    touch(s, 'touchend', 100, t + 4);
    expect(s.deltas).toEqual([]);
    expect(s.scroll.busy).toBe(false);
    expect(s.wakes.count).toBe(0);
  });

  it('gives no step for a swallowed swipe with reduced motion', () => {
    const s = setup({ enabled: true, reduced: true, swallow: true });
    touch(s, 'touchstart', 100, 0);
    touch(s, 'touchmove', 300, 16);
    touch(s, 'touchmove', 500, 32);
    touch(s, 'touchend', 500, 40);
    expect(s.deltas).toEqual([]);
  });

  it('carries on from where a finger is when the swallowing ends under it', () => {
    const s = swallowing();
    touch(s, 'touchstart', 500, 0);
    touch(s, 'touchmove', 400, 16); // swallowed
    s.state.swallow = false;
    touch(s, 'touchmove', 380, 32);
    expect(s.deltas).toHaveLength(1);
    expect(s.deltas[0]).toBeCloseTo(0.02, 12); // 20 px from where the last move left it, not 120 from where it began
  });

  it('lets a swipe that was under way go without a glide when the swallowing begins under it', () => {
    const s = setup();
    touch(s, 'touchstart', 500, 0);
    let t = 0;
    for (let y = 460; y >= 300; y -= 40) {
      t += 16;
      touch(s, 'touchmove', y, t);
    }
    s.state.swallow = true;
    s.deltas.length = 0;
    t += 16;
    touch(s, 'touchmove', 260, t);
    touch(s, 'touchend', 260, t + 4);
    expect(s.deltas).toEqual([]);
    expect(s.scroll.busy).toBe(false);
    expect(s.wakes.count).toBe(0);
  });

  it('leaves a tap alone while it swallows', () => {
    const s = swallowing();
    expect(touch(s, 'touchstart', 500, 0).defaultPrevented).toBe(false);
    expect(touch(s, 'touchmove', 497, 16).defaultPrevented).toBe(false);
    expect(touch(s, 'touchend', 497, 40).defaultPrevented).toBe(false);
  });

  it('keeps a trackpad burst one gesture with reduced motion, so its tail after the swallowing is no step', () => {
    const s = setup({ enabled: true, reduced: true, swallow: true });
    for (let t = 1000; t < 1300; t += 16) wheel(s, 4, t); // swallowed
    s.state.swallow = false;
    for (let t = 1300; t < 1600; t += 16) wheel(s, 4, t); // the same burst, still turning
    expect(s.deltas).toEqual([]);
    wheel(s, 4, 2000); // after a quiet, a new gesture
    expect(s.deltas).toHaveLength(1);
  });

  it('leaves the page to the browser when the scroll is not enabled, swallowing or not', () => {
    const s = setup({ enabled: false, reduced: false, swallow: true });
    expect(wheel(s, 100).defaultPrevented).toBe(false);
    expect(key(s, 'PageDown').defaultPrevented).toBe(false);
    touch(s, 'touchstart', 500, 0);
    expect(touch(s, 'touchmove', 300, 16).defaultPrevented).toBe(false);
    expect(s.deltas).toEqual([]);
  });

  it('swallows nothing when the option is not given', () => {
    const el = new EventTarget();
    Object.defineProperty(el, 'ownerDocument', { value: { defaultView: new EventTarget() } });
    const deltas: number[] = [];
    new VirtualScroll(el as unknown as HTMLElement, {
      unitPx: () => VH,
      onDelta: (units) => deltas.push(units),
      onJump: () => {},
      enabled: () => true,
      reducedMotion: () => false,
    });
    fire(el, 'wheel', { deltaY: 100, deltaMode: 0, ctrlKey: false, timeStamp: 1000 });
    expect(deltas).toEqual([0.1]);
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

describe('VirtualScroll: where each delta comes from', () => {
  it('names the wheel, a finger, its glide, a key and a held key', () => {
    const s = setup();
    wheel(s, 100);
    touch(s, 'touchstart', 500, 2000);
    for (let y = 460, t = 2016; y >= 100; y -= 40, t += 16) touch(s, 'touchmove', y, t);
    touch(s, 'touchend', 100, 2164);
    s.scroll.step(1 / 60);
    key(s, 'ArrowDown');
    key(s, 'ArrowDown', { repeat: true });
    expect([...new Set(s.bys)]).toEqual(['wheel', 'finger', 'glide', 'key', 'held']);
  });
});

describe('VirtualScroll: the end of a gesture (Ruling 32), when the scroll settles on a stop', () => {
  it('ends a wheel gesture after GESTURE_GAP_MS of quiet, counted by the frames that step it, once', () => {
    const s = setup();
    expect(GESTURE_GAP_MS).toBe(250);
    wheel(s, 100, 1000);
    expect(s.scroll.waiting).toBe(true);
    expect(s.scroll.busy).toBe(false); // no glide: it is the wheel's quiet the caller's frames count
    for (let ms = 0; ms < GESTURE_GAP_MS - 20; ms += 16) s.scroll.step(0.016);
    expect(s.ends).toEqual([]);
    s.scroll.step(0.03);
    expect(s.ends).toEqual([0]);
    expect(s.scroll.waiting).toBe(false);
    for (let i = 0; i < 30; i++) s.scroll.step(0.016);
    expect(s.ends).toEqual([0]);
  });

  it('keeps one gesture going while the wheel keeps turning: each event starts the quiet again', () => {
    const s = setup();
    for (let i = 0; i < 20; i++) {
      wheel(s, 4, 1000 + 100 * i);
      for (let f = 0; f < 6; f++) s.scroll.step(0.016); // 96 ms of frames between two events
    }
    expect(s.ends).toEqual([]);
    for (let f = 0; f < 20; f++) s.scroll.step(0.016);
    expect(s.ends).toEqual([0]);
  });

  it("ends a finger's gesture when it lifts, with the glide the lift leaves, in units", () => {
    const s = setup();
    touch(s, 'touchstart', 500, 0);
    for (let y = 460, t = 16; y >= 100; y -= 40, t += 16) touch(s, 'touchmove', y, t);
    expect(s.ends).toEqual([]);
    touch(s, 'touchend', 100, 164);
    expect(s.ends).toHaveLength(1);
    // 40 px every 16 ms is 2500 px/s, which the glide carries 625 px (a quarter of a second at that speed), 0.625 of a unit
    expect(s.ends[0]).toBeCloseTo(0.625, 6);
    expect(s.scroll.busy).toBe(true); // the glide is the caller's to end
  });

  it('ends a finger that had stopped before it lifted with no glide', () => {
    const s = setup();
    touch(s, 'touchstart', 500, 0);
    touch(s, 'touchmove', 400, 16);
    touch(s, 'touchmove', 300, 32);
    touch(s, 'touchend', 300, 400); // still for a third of a second
    expect(s.ends).toEqual([0]);
    expect(s.scroll.busy).toBe(false);
  });

  it('ends one on a touchcancel, a second finger and the scroll switched off under it, with no glide', () => {
    for (const end of ['cancel', 'pinch', 'off'] as const) {
      const s = setup();
      touch(s, 'touchstart', 500, 0);
      touch(s, 'touchmove', 400, 16);
      if (end === 'cancel') fire(s.el, 'touchcancel', { touches: [], timeStamp: 20 });
      if (end === 'pinch') fire(s.el, 'touchmove', { touches: [finger(100, 380), finger(200, 380)], timeStamp: 32 });
      if (end === 'off') {
        s.state.enabled = false;
        touch(s, 'touchmove', 380, 32);
      }
      expect(s.ends, end).toEqual([0]);
      expect(s.scroll.busy, end).toBe(false);
    }
  });

  it('ends no gesture for a tap, nor for a sideways swipe', () => {
    const s = setup();
    touch(s, 'touchstart', 500, 0);
    touch(s, 'touchend', 500, 40);
    touch(s, 'touchstart', 500, 100);
    fire(s.el, 'touchmove', { touches: [finger(300, 490)], timeStamp: 116 });
    touch(s, 'touchend', 490, 140);
    expect(s.ends).toEqual([]);
  });

  it('ends the gesture under way when the caller stops it (3D switched off), and drops it on dispose', () => {
    const s = setup();
    wheel(s, 100, 1000);
    s.scroll.stop();
    expect(s.ends).toEqual([0]);
    const t = setup();
    wheel(t, 100, 1000);
    t.scroll.dispose();
    expect(t.ends).toEqual([]);
    expect(t.scroll.waiting).toBe(false);
  });

  it('ends nothing with reduced motion: there each gesture is already a step to a stop', () => {
    const s = setup({ enabled: true, reduced: true });
    wheel(s, 100, 1000);
    for (let i = 0; i < 30; i++) s.scroll.step(0.016);
    touch(s, 'touchstart', 500, 2000);
    touch(s, 'touchmove', 300, 2016);
    touch(s, 'touchend', 300, 2032);
    expect(s.deltas).toHaveLength(2);
    expect(s.ends).toEqual([]);
    expect(s.scroll.waiting).toBe(false);
  });

  it('ends nothing for a wheel it swallows', () => {
    const s = setup({ enabled: true, reduced: false, swallow: true });
    wheel(s, 100, 1000);
    for (let i = 0; i < 30; i++) s.scroll.step(0.016);
    expect(s.ends).toEqual([]);
  });
});
