import { damp } from 'maath/easing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Inertia } from '../../../src/input/Inertia';
import { SKIP_QUIET_MS, skipSwallower } from '../../../src/input/loaderSkip';
import { DIVE_SMOOTH, GLIDE_SMOOTH, RISE_SMOOTH, type Smooth, smoothTimeAt, startHomeScroll } from '../../../src/input/scrollLoop';
import { buildChapters, type ChapterAt } from '../../../src/state/chapters';

/** A viewport 1000 px high: a unit of scroll is 1000 px. */
const VH = 1000;
const FRAME_MS = 1000 / 60;
const chapters = buildChapters({ categories: ['a', 'b', 'c'] }); // 6 units; stops 0, 1, 2, 3, 4, 5, the last the end

/** A requestAnimationFrame that runs when the test says so, one frame at a time, on a clock the test owns. */
class FakeFrames {
  now = 0;
  private next = 1;
  private readonly pending = new Map<number, (now: number) => void>();

  readonly request = (callback: (now: number) => void): number => {
    const id = this.next++;
    this.pending.set(id, callback);
    return id;
  };

  readonly cancel = (id: number): void => {
    this.pending.delete(id);
  };

  /** How many callbacks are waiting for the next frame. */
  get size(): number {
    return this.pending.size;
  }

  callbacks(): ((now: number) => void)[] {
    return [...this.pending.values()];
  }

  /** One frame: the callbacks waiting now run at the new time; the ones they ask for wait for the next. */
  frame(ms = FRAME_MS): void {
    this.now += ms;
    for (const id of [...this.pending.keys()]) {
      const callback = this.pending.get(id);
      if (!callback) continue; // cancelled by an earlier callback of this frame
      this.pending.delete(id);
      callback(this.now);
    }
  }
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function fire(target: EventTarget, type: string, props: Record<string, unknown> = {}): Event {
  const event = new Event(type, { cancelable: true, bubbles: true });
  for (const [key, value] of Object.entries(props)) Object.defineProperty(event, key, { value });
  target.dispatchEvent(event);
  return event;
}

interface SetupOptions {
  threeD?: boolean;
  reduced?: boolean;
  swallow?: boolean;
  /** A swallow predicate of the test's own, in place of `state.swallow`. */
  swallowWith?: () => boolean;
  loadSmooth?: () => Promise<Smooth>;
  /** The viewport's height, px: VH unless given. */
  vh?: number;
}

function setup(options: SetupOptions = {}) {
  const frames = new FakeFrames();
  const frame = { progress: 0, target: 0, velocity: 0, chapterIndex: 0 };
  const state = { threeD: options.threeD ?? true, reduced: options.reduced ?? false, swallow: options.swallow ?? false };
  const changes: ChapterAt[] = [];
  const el = new EventTarget();
  const win = new EventTarget();
  Object.defineProperty(el, 'ownerDocument', { value: { defaultView: win } });
  const home = startHomeScroll({
    el: el as unknown as HTMLElement,
    frame,
    chapters,
    unitPx: () => options.vh ?? VH,
    enabled: () => state.threeD,
    reducedMotion: () => state.reduced,
    swallow: options.swallowWith ?? (() => state.swallow),
    threeD: () => state.threeD,
    onChapter: (at) => changes.push(at),
    loadSmooth: options.loadSmooth ?? (() => Promise.resolve(damp)),
    request: frames.request,
    cancel: frames.cancel,
  });
  const key = (k: string) =>
    fire(win, 'keydown', { key: k, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, repeat: false, isComposing: false, target: { tagName: 'BODY' } });

  /** A finger from y `from` that moves `moves` steps of 40 px (up when `dir` is -1), 16 ms apart, a frame after each move; then it lifts. */
  async function swipe(dir: 1 | -1, moves = 10, from = 800): Promise<void> {
    let t = 0;
    fire(el, 'touchstart', { touches: [{ clientX: 100, clientY: from }], timeStamp: t });
    for (let i = 1; i <= moves; i++) {
      t += 16;
      fire(el, 'touchmove', { touches: [{ clientX: 100, clientY: from + dir * 40 * i }], timeStamp: t });
      if (i === 1) await flush(); // the first move fetches damp
      frames.frame();
    }
    fire(el, 'touchend', { touches: [], timeStamp: t + 4 });
    await flush();
  }

  /** Runs frames until the loop sleeps; returns how many ran and how many of them had a glide going. */
  function drain(limit = 3000): { frames: number; gliding: number; mostPending: number } {
    let ran = 0;
    let gliding = 0;
    let mostPending = 0;
    while (frames.size > 0 && ran < limit) {
      mostPending = Math.max(mostPending, frames.size);
      if (home.scroll.busy) gliding++;
      frames.frame();
      ran++;
    }
    return { frames: ran, gliding, mostPending };
  }

  return { frames, frame, state, changes, el, win, home, key, swipe, drain };
}

/** What a glide of the same swipe lasts and carries on its own, from `Inertia` with nothing around it. */
function glideAlone(moves = 10): { frames: number; px: number } {
  const inertia = new Inertia();
  let t = 0;
  for (let i = 1; i <= moves; i++) {
    t += 16;
    inertia.track(t, 40);
  }
  inertia.release(t + 4);
  let frames = 0;
  let px = 0;
  while (inertia.active) {
    px += inertia.step(1 / 60);
    frames++;
  }
  return { frames, px };
}

afterEach(() => {
  vi.restoreAllMocks();
});

/** A swipe of this many moves from the home glides on the rise and stops short of its top, so nothing settles it. */
const RISE_SWIPE = 4;

describe('the scroll loop: one frame pending at a time', () => {
  it('has at most one callback waiting through a whole touch glide', async () => {
    const s = setup();
    await s.swipe(-1, RISE_SWIPE);
    expect(s.frames.size).toBeLessThanOrEqual(1);
    const run = s.drain();
    expect(run.mostPending).toBe(1);
    expect(s.frames.size).toBe(0);
  });

  it('lasts as long as Inertia alone says on the rise, not a handful of frames', async () => {
    const alone = glideAlone(RISE_SWIPE);
    expect(alone.frames).toBeGreaterThan(60); // a flick of this speed glides for over a second
    const s = setup();
    await s.swipe(-1, RISE_SWIPE);
    const run = s.drain();
    expect(Math.abs(run.gliding - alone.frames)).toBeLessThanOrEqual(1);
    // and it carried exactly as far: the drag, then what Inertia alone carries, short of the rise's top
    expect(s.frame.target).toBeCloseTo(0.16 + alone.px / VH, 9);
    expect(s.frame.target).toBeLessThan(1);
  });

  it('has one callback waiting through a long wheel gesture too', async () => {
    const s = setup();
    let most = 0;
    for (let i = 0; i < 30; i++) {
      fire(s.el, 'wheel', { deltaY: 4, deltaMode: 0, ctrlKey: false, timeStamp: 16 * i });
      if (i === 0) await flush();
      s.frames.frame();
      most = Math.max(most, s.frames.size);
    }
    expect(most).toBe(1);
    expect(s.drain().mostPending).toBe(1);
  });
});

describe('the scroll loop: going to sleep', () => {
  it('sleeps when progress is on the target and nothing glides, exactly on it', async () => {
    const s = setup();
    await s.swipe(-1);
    const run = s.drain();
    expect(run.frames).toBeLessThan(600);
    expect(s.frames.size).toBe(0);
    expect(s.frame.progress).toBe(s.frame.target);
    expect(s.frame.velocity).toBe(0);
    expect(s.home.scroll.busy).toBe(false);
    s.home.loop.wake(); // nothing to do: it stays asleep
    expect(s.frames.size).toBe(0);
  });

  it('does not wake for an input that moves nothing', async () => {
    const s = setup();
    s.key('Home'); // already at the start
    await flush();
    expect(s.frames.size).toBe(0);
  });

  it('runs no frame for an input before damp has arrived, then starts one', async () => {
    const s = setup();
    s.key('PageDown');
    expect(s.frame.target).toBeCloseTo(0.9, 12);
    expect(s.frames.size).toBe(0);
    await flush();
    expect(s.frames.size).toBe(1);
  });

  it('reads a story at rest as the chapter that starts where it stopped', async () => {
    const s = setup({ reduced: true });
    s.key('PageDown'); // reduced motion: the next stop, 1
    await flush();
    s.key('PageDown'); // 2
    s.drain();
    expect(s.frame.progress).toBe(2);
    expect(s.frame.chapterIndex).toBe(2);
    expect(s.changes.at(-1)).toMatchObject({ index: 2, id: 'VOID_ENTRY' });
  });

  it('stops the glide when 3D is switched off, and the story stays where it is', async () => {
    const s = setup();
    await s.swipe(-1, RISE_SWIPE);
    s.frames.frame();
    s.state.threeD = false;
    s.frames.frame();
    expect(s.home.scroll.busy).toBe(false);
    expect(s.frame.velocity).toBe(0);
    expect(s.frames.size).toBe(0);
    const at = s.frame.target;
    s.frames.frame();
    expect(s.frame.target).toBe(at);
  });
});

describe('the scroll loop: a glide against the end', () => {
  it('does not start one from a drag that is pinned at the start', async () => {
    const s = setup();
    await s.swipe(1); // the finger goes down: the story goes up, and it is at 0
    expect(s.frame.target).toBe(0);
    expect(s.home.scroll.busy).toBe(false);
    s.drain();
    expect(s.frames.size).toBe(0);
  });

  it('ends a glide on the rise that reaches its top: a glide runs on the rise alone, and stops on BOB from above', async () => {
    // A glide's own steps carry a little further than the lift reckons (Inertia's distance is the smooth decay's): put
    // the swipe where the lift reckons it short of the top and its steps would carry it past.
    const alone = glideAlone(RISE_SWIPE);
    const reckoned = 0.625; // 2500 px/s over Inertia's decay of 4/s, of a 1000 px unit
    expect(alone.px / VH).toBeGreaterThan(reckoned);
    const s = setup();
    s.frame.target = s.frame.progress = 1 - 0.16 - (reckoned + alone.px / VH) / 2;
    await s.swipe(-1, RISE_SWIPE);
    expect(s.home.scroll.busy).toBe(true); // it glides: the lift reckoned it would rest on the rise
    const run = s.drain();
    expect(s.frame.target).toBe(1);
    expect(s.frame.progress).toBe(1);
    expect(run.gliding).toBeLessThan(alone.frames);
    expect(s.home.scroll.busy).toBe(false);
  });

  it('glides nowhere toward the end of the story: a fling past the rise rests on the last stop', async () => {
    const s = setup();
    s.frame.target = s.frame.progress = 3.6;
    s.frame.chapterIndex = 3;
    await s.swipe(-1); // 0.4 of a drag to 4, then a glide that would carry another 0.625, past it
    expect(s.home.scroll.busy).toBe(false);
    s.drain();
    expect(s.frame.target).toBe(5);
    expect(s.frame.progress).toBe(5);
  });
});

describe('the scroll loop: leaving', () => {
  it('runs no tick after dispose, even one that was already asked for', async () => {
    const s = setup();
    await s.swipe(-1);
    s.frames.frame();
    s.frames.frame();
    const stray = s.frames.callbacks();
    expect(stray.length).toBeGreaterThan(0);
    const { progress, target, chapterIndex } = s.frame;
    s.home.dispose();
    expect(s.frames.size).toBe(0); // the one pending frame was cancelled
    for (const callback of stray) callback(s.frames.now + FRAME_MS * 3);
    expect(s.frames.size).toBe(0);
    // (maath's damp keeps its own state on the object, so compare the fields the loop writes)
    expect({ progress: s.frame.progress, target: s.frame.target, velocity: s.frame.velocity, chapterIndex: s.frame.chapterIndex }).toEqual({ progress, target, velocity: 0, chapterIndex });
    s.home.loop.wake();
    expect(s.frames.size).toBe(0);
  });

  it('leaves no velocity behind', async () => {
    const s = setup();
    s.key('End');
    await flush();
    s.frames.frame();
    s.frames.frame();
    expect(s.frame.velocity).toBeGreaterThan(0);
    s.home.dispose();
    expect(s.frame.velocity).toBe(0);
  });

  it('takes the input off', async () => {
    const s = setup();
    s.home.dispose();
    s.key('End');
    await flush();
    expect(s.frame.target).toBe(0);
    expect(s.frames.size).toBe(0);
  });
});

describe('the scroll loop: the input that skipped the loader', () => {
  it('drops the wheel, the keys and a swipe while it swallows, prevents them, and wakes nothing', async () => {
    const s = setup({ swallow: true });
    const wheel = fire(s.el, 'wheel', { deltaY: 100, deltaMode: 0, ctrlKey: false, timeStamp: 1000 });
    const pageDown = s.key('PageDown');
    const end = s.key('End');
    await s.swipe(-1);
    await flush();
    expect(wheel.defaultPrevented).toBe(true);
    expect(pageDown.defaultPrevented).toBe(true);
    expect(end.defaultPrevented).toBe(true);
    expect(s.frame.target).toBe(0);
    expect(s.frame.progress).toBe(0);
    expect(s.frames.size).toBe(0);
    expect(s.home.scroll.busy).toBe(false);
  });

  it('takes the input as before the moment it stops swallowing', async () => {
    const s = setup({ swallow: true });
    s.key('PageDown');
    s.state.swallow = false;
    s.key('PageDown');
    await flush();
    expect(s.frame.target).toBeCloseTo(0.9, 12);
    expect(s.frames.size).toBe(1);
  });

  it("drops a trackpad's decaying 2.5 s momentum tail after a skip whole, then takes a fresh scroll after 200 ms of quiet", async () => {
    const clock = { now: 0 };
    const landed = 1000;
    const s = setup({
      swallowWith: skipSwallower(
        () => clock.now,
        () => landed,
      ),
    });
    // The momentum: from the landing on, events 16 ms apart at first and 190 ms by the end, their deltas dying away.
    let gap = 16;
    let events = 0;
    for (clock.now = landed; clock.now < landed + 2500; clock.now += gap, gap = Math.min(190, gap * 1.08)) {
      const deltaY = Math.max(2, 120 * Math.exp(-(clock.now - landed) / 700));
      const wheel = fire(s.el, 'wheel', { deltaY, deltaMode: 0, ctrlKey: false, timeStamp: clock.now });
      expect(wheel.defaultPrevented).toBe(true);
      events++;
      if (events === 1) await flush();
      if (s.frames.size > 0) s.frames.frame(gap);
    }
    expect(events).toBeGreaterThan(30);
    await flush();
    s.drain();
    expect(s.frame.target).toBe(0);
    expect(s.frame.progress).toBe(0);
    // The pad let go for 200 ms: the next turn of the wheel is the visitor's, and the story moves.
    clock.now += SKIP_QUIET_MS;
    fire(s.el, 'wheel', { deltaY: 100, deltaMode: 0, ctrlKey: false, timeStamp: clock.now });
    expect(s.frame.target).toBeCloseTo(0.1, 12);
    await flush();
    s.drain();
    expect(s.frame.progress).toBeGreaterThan(0);
  });

  it('swallows nothing unless asked to: the option is optional', () => {
    const frame = { progress: 0, target: 0, velocity: 0, chapterIndex: 0 };
    const el = new EventTarget();
    Object.defineProperty(el, 'ownerDocument', { value: { defaultView: new EventTarget() } });
    const home = startHomeScroll({
      el: el as unknown as HTMLElement,
      frame,
      chapters,
      unitPx: () => VH,
      enabled: () => true,
      reducedMotion: () => false,
      threeD: () => true,
      onChapter: () => {},
      loadSmooth: () => Promise.resolve(damp),
      request: () => 1,
      cancel: () => {},
    });
    fire(el, 'wheel', { deltaY: 100, deltaMode: 0, ctrlKey: false, timeStamp: 1000 });
    expect(frame.target).toBeCloseTo(0.1, 12);
    home.dispose();
  });
});

describe('the scroll loop: damp does not load', () => {
  it('snaps progress to the target and keeps the chapter in step, and says nothing', async () => {
    const quiet = [vi.spyOn(console, 'error'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'log')];
    const s = setup({ loadSmooth: () => Promise.reject(new Error('chunk failed')) });
    s.key('End');
    await flush();
    s.drain();
    expect(s.frame.progress).toBe(5);
    expect(s.frame.chapterIndex).toBe(5);
    expect(s.changes.at(-1)).toMatchObject({ index: 5, id: 'PROJECTS', category: 'c' });
    expect(s.frame.velocity).toBe(0);
    expect(s.frames.size).toBe(0);
    for (const spy of quiet) expect(spy).not.toHaveBeenCalled();
  });

  it('goes on snapping for the next move', async () => {
    const s = setup({ loadSmooth: () => Promise.reject(new Error('chunk failed')) });
    s.key('End');
    await flush();
    s.drain();
    s.key('Home');
    s.drain();
    expect(s.frame.progress).toBe(0);
    expect(s.frame.chapterIndex).toBe(0);
  });
});

// ---------------------------------------------------------------- the settle: every input past the rise rests on a stop

/** Puts the story at rest at `at`, as an earlier input would have left it. */
function restAt(s: ReturnType<typeof setup>, at: number): void {
  s.frame.target = s.frame.progress = at;
  s.frame.chapterIndex = Math.min(Math.floor(at), chapters.units.length - 1);
}

/** `notches` wheel events of `px` (negative goes up the story), `gapMs` apart, the frames between them run. */
async function wheelNotches(s: ReturnType<typeof setup>, notches: number, px = 120, gapMs = 16): Promise<void> {
  for (let i = 0; i < notches; i++) {
    fire(s.el, 'wheel', { deltaY: px, deltaMode: 0, ctrlKey: false, timeStamp: s.frames.now });
    if (i === 0) await flush(); // the first fetches damp
    for (let ms = 0; ms < gapMs; ms += FRAME_MS) s.frames.frame();
  }
}

/** A finger that drags `px` (up the screen for a positive one: down the story) in ten moves 16 ms apart, then waits `holdMs` before it lifts. */
async function drag(s: ReturnType<typeof setup>, px: number, holdMs = 0): Promise<void> {
  let t = s.frames.now;
  const from = 600;
  fire(s.el, 'touchstart', { touches: [{ clientX: 100, clientY: from }], timeStamp: t });
  for (let i = 1; i <= 10; i++) {
    t += 16;
    fire(s.el, 'touchmove', { touches: [{ clientX: 100, clientY: from - (px * i) / 10 }], timeStamp: t });
    if (i === 1) await flush();
    s.frames.frame();
  }
  fire(s.el, 'touchend', { touches: [], timeStamp: t + holdMs });
  await flush();
}

/** Runs the frames to rest, noting the progress at each. */
function trail(s: ReturnType<typeof setup>): number[] {
  const seen: number[] = [];
  for (let i = 0; s.frames.size > 0 && i < 3000; i++) {
    s.frames.frame();
    seen.push(s.frame.progress);
  }
  return seen;
}

describe('the settle: a wheel past the rise comes to rest on a stop', () => {
  it('moves one notch by its distance, then, once the wheel is quiet, on to the next stop, damped and exactly on it', async () => {
    const s = setup();
    restAt(s, 3);
    await wheelNotches(s, 1);
    expect(s.frame.target).toBeCloseTo(3.12, 12);
    const seen = trail(s);
    expect(s.frame.target).toBe(4);
    expect(s.frame.progress).toBe(4); // exactly: the bead's label shows only at its stop
    expect(s.frame.velocity).toBe(0);
    expect(s.changes.at(-1)).toMatchObject({ index: 4, category: 'b' });
    // Damped, never a jump: dozens of frames, none moving more than a tenth of the way, and none back.
    expect(seen.length).toBeGreaterThan(40);
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]! - seen[i - 1]!).toBeGreaterThanOrEqual(0);
      expect(seen[i]! - seen[i - 1]!).toBeLessThan(0.1);
    }
  });

  it('moves one stop for a single notch up too', async () => {
    const s = setup();
    restAt(s, 4);
    await wheelNotches(s, 1, -120);
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([3, 3]);
  });

  it('takes each notch turned once the story is at rest for a stop of its own: stop by stop', async () => {
    const s = setup();
    restAt(s, 2);
    for (let i = 0; i < 3; i++) {
      await wheelNotches(s, 1);
      s.drain();
    }
    expect([s.frame.target, s.frame.progress]).toEqual([5, 5]);
  });

  it("steps a wheel nudge of any size, even under the slop, one stop in its direction: the slop is a finger's", async () => {
    const s = setup();
    restAt(s, 3);
    await wheelNotches(s, 1, 30); // 30 px of a 1000 px unit, under the slop's 40
    expect(s.frame.target).toBeCloseTo(3.03, 12);
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([4, 4]);
  });

  it('lets a fling pass several stops and rest on the one past where it ended', async () => {
    const s = setup();
    restAt(s, 1);
    await wheelNotches(s, 20); // 2.4 units, to 3.4
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([4, 4]);
  });

  it('flings from the home to Cookies Clicker and back, resting on the last stop and on the home (Review Focus 1)', async () => {
    const s = setup();
    await wheelNotches(s, 60);
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([5, 5]);
    expect(s.changes.at(-1)).toMatchObject({ index: 5, category: 'c' });
    await wheelNotches(s, 60, -120);
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([0, 0]);
    expect(s.changes.at(-1)).toMatchObject({ index: 0, id: 'HOME' });
  });

  it('leaves a gesture that ends on the rise where it is, as M2a did', async () => {
    const s = setup();
    await wheelNotches(s, 5); // 0.6
    s.drain();
    expect(s.frame.target).toBeCloseTo(0.6, 12);
    expect(s.frame.progress).toBe(s.frame.target);
    restAt(s, 1);
    await wheelNotches(s, 3, -120); // up from BOB from above into the rise: 0.64
    s.drain();
    expect(s.frame.target).toBeCloseTo(0.64, 12);
  });

  it('rests a gesture that comes up out of the rise past its top on BOB from above, the top: the 8th notch at 900 px', async () => {
    const s = setup({ vh: 900 });
    await wheelNotches(s, 7); // 0.933, on the rise
    s.drain();
    expect(s.frame.target).toBeCloseTo(0.933, 3);
    await wheelNotches(s, 1); // the 8th, 1.067: past the top, a whole unit short of a fling
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([1, 1]);
    expect(s.changes.at(-1)).toMatchObject({ index: 1, id: 'DIVE' });
  });

  it('moves the next gesture from BOB from above on to the overview', async () => {
    const s = setup({ vh: 900 });
    await wheelNotches(s, 8);
    s.drain();
    expect(s.frame.target).toBe(1);
    await wheelNotches(s, 1); // from 1, 1.133
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([2, 2]);
  });

  it('lets a fling from the home, more than a whole unit past the top, settle past the overview', async () => {
    const s = setup({ vh: 900 });
    await wheelNotches(s, 20); // 2.667 in one gesture
    s.drain();
    expect(s.frame.target).toBe(3);
    expect(s.frame.progress).toBe(3);
  });

  it('rests one gesture from part way up the rise that ends a little past its top on the top too', async () => {
    const s = setup();
    restAt(s, 0.6);
    await wheelNotches(s, 6); // 1.32
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([1, 1]);
  });

  it('settles the gesture under way at once when 3D is switched off, so the story waits for 3D on a stop', async () => {
    const s = setup();
    restAt(s, 3);
    await wheelNotches(s, 1);
    s.frames.frame();
    s.state.threeD = false;
    s.frames.frame();
    expect(s.frame.target).toBe(4);
    expect(s.frames.size).toBe(0);
    expect(s.frame.progress).toBeLessThan(4);
    s.state.threeD = true;
    s.home.loop.wake();
    s.drain();
    expect(s.frame.progress).toBe(4);
  });
});

describe('the settle: a finger past the rise comes to rest on a stop', () => {
  it('moves a swipe whose finger stopped before it lifted on to the next stop: swipes go stop by stop', async () => {
    const s = setup();
    restAt(s, 3);
    await drag(s, 300, 300);
    expect(s.home.scroll.busy).toBe(false);
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([4, 4]);
    await drag(s, 300, 300);
    s.drain();
    expect(s.frame.target).toBe(5);
    await drag(s, -300, 300);
    s.drain();
    expect(s.frame.target).toBe(4);
  });

  it("takes a flick's glide into its reckoning and ends it: a big one passes several stops, resting on one", async () => {
    const s = setup();
    restAt(s, 2);
    await drag(s, 1000); // 1 unit dragged, a lift at 6000 px/s, whose glide would carry 1.5 more: 4.5
    expect(s.home.scroll.busy).toBe(false); // nothing glides past the rise: the target is on its stop
    expect(s.frame.target).toBe(5);
    s.drain();
    expect(s.frame.progress).toBe(5);
  });

  it('eases a short drag back to the stop it left', async () => {
    const s = setup();
    restAt(s, 4);
    await drag(s, 30, 300);
    s.drain();
    expect(s.frame.target).toBe(4);
  });
});

describe('the settle: the keys step by stops past the rise', () => {
  it('steps an arrow, Page Down and Space to the next stop, and an arrow up to the one before', async () => {
    const s = setup();
    restAt(s, 2);
    s.key('ArrowDown');
    await flush();
    expect(s.frame.target).toBe(3);
    s.key('PageDown');
    expect(s.frame.target).toBe(4);
    s.key(' ');
    expect(s.frame.target).toBe(5);
    s.key('ArrowDown'); // the end
    expect(s.frame.target).toBe(5);
    s.key('ArrowUp');
    s.key('PageUp');
    expect(s.frame.target).toBe(3);
    s.drain();
    expect(s.frame.progress).toBe(3);
  });

  it('moves an arrow on the rise by its distance, as M2a did, stopping on its top, BOB from above', async () => {
    const s = setup();
    for (let i = 0; i < 7; i++) s.key('ArrowDown'); // 1.05 by distance, held to the top
    await flush();
    expect(s.frame.target).toBe(1);
    s.drain();
    expect(s.frame.progress).toBe(1);
    s.key('ArrowUp');
    expect(s.frame.target).toBeCloseTo(0.85, 12);
  });

  it('takes a held key past the rise for the one step its press took', () => {
    const s = setup();
    restAt(s, 3);
    s.key('ArrowDown');
    for (let i = 0; i < 10; i++) fire(s.win, 'keydown', { key: 'ArrowDown', shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, repeat: true, isComposing: false, target: { tagName: 'BODY' } });
    expect(s.frame.target).toBe(4);
  });

  it('jumps End to the last stop and Home to the start', async () => {
    const s = setup();
    restAt(s, 2.4);
    s.key('End');
    await flush();
    expect(s.frame.target).toBe(5);
    s.key('Home');
    expect(s.frame.target).toBe(0);
  });

  it('drops a wheel gesture a key cut short: the key has put the target on its stop', async () => {
    const s = setup();
    restAt(s, 3);
    await wheelNotches(s, 1); // 3.12
    s.key('ArrowDown'); // to 4, before the wheel is quiet
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([4, 4]);
  });
});

describe('the settle: reduced motion keeps its steps', () => {
  it('steps one stop for a wheel gesture, a swipe and a key, and settles nothing after', async () => {
    const s = setup({ reduced: true });
    restAt(s, 2);
    await wheelNotches(s, 10, 120, 16);
    s.drain();
    expect(s.frame.target).toBe(3);
    await drag(s, 300);
    s.drain();
    expect(s.frame.target).toBe(4);
    s.key('ArrowDown');
    s.drain();
    expect(s.frame.target).toBe(5);
    s.key('ArrowDown'); // a step down from the last stop is none
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([5, 5]);
  });
});

// ---------------------------------------------------------------- Ruling 36: the settle's residual fixes

/** One wheel event of `deltaY` in `deltaMode` (0 pixels, 1 lines), then the frames of `gapMs`. */
async function wheelOnce(s: ReturnType<typeof setup>, deltaY: number, deltaMode: number, gapMs = 16): Promise<void> {
  fire(s.el, 'wheel', { deltaY, deltaMode, ctrlKey: false, timeStamp: s.frames.now });
  await flush();
  for (let ms = 0; ms < gapMs; ms += FRAME_MS) s.frames.frame();
}

describe('the settle: a gesture that pushes against an end and turns back settles from where the story is', () => {
  it('from the home, 60 notches down then 30 straight back up in one gesture, rests where it came back to, BOB from above', async () => {
    const s = setup({ vh: 900 });
    await wheelNotches(s, 60);
    await wheelNotches(s, 30, -120);
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([1, 1]);
  });

  it('from the home, 45 down then 20 up rests on the stop above where it turned back to, the overview, never back down', async () => {
    const s = setup({ vh: 900 });
    await wheelNotches(s, 45);
    await wheelNotches(s, 20, -120); // the story comes back up to 2.33
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([2, 2]);
  });

  it('at the end, 10 notches down then 8 up, rests on the stop the way up reached past, 3, not back on 5', async () => {
    const s = setup({ vh: 900 });
    restAt(s, 5);
    await wheelNotches(s, 10);
    await wheelNotches(s, 8, -120); // 3.93
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([3, 3]);
  });

  it('at the home, 10 notches up then 10 down, rests on a stop, BOB from above, not part way into the dive', async () => {
    const s = setup({ vh: 900 });
    await wheelNotches(s, 10, -120);
    await wheelNotches(s, 10); // 1.33
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([1, 1]);
  });
});

describe('the settle: a wheel gesture of any size steps a stop; the slop is a finger\'s', () => {
  it('steps one stop for each single line-mode notch, one at a time', async () => {
    const s = setup({ vh: 900 });
    restAt(s, 3);
    await wheelOnce(s, 1, 1); // one line, 16 px
    s.drain();
    expect(s.frame.target).toBe(4);
    await wheelOnce(s, 1, 1);
    s.drain();
    expect(s.frame.target).toBe(5);
    await wheelOnce(s, -1, 1);
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([4, 4]);
  });

  it('steps one stop for each small pixel-mode notch, one at a time', async () => {
    const s = setup({ vh: 900 });
    restAt(s, 3);
    for (const [deltaY, stop] of [[10, 4], [33, 5], [-10, 4], [-33, 3]] as const) {
      await wheelOnce(s, deltaY, 0);
      s.drain();
      expect(s.frame.target, `${deltaY} px`).toBe(stop);
    }
  });
});

describe('the settle: a new input during a settle takes over at once', () => {
  /** At 3, a notch down whose settle eases toward 4; answers once the story is part way there. */
  async function easing(s: ReturnType<typeof setup>): Promise<number> {
    restAt(s, 3);
    await wheelNotches(s, 1);
    for (let i = 0; i < 40 && s.frame.progress < 3.4; i++) s.frames.frame(); // the quiet, then the ease toward 4
    expect(s.frame.target).toBe(4);
    expect(s.frame.progress).toBeGreaterThan(3.3);
    expect(s.frame.progress).toBeLessThan(3.9);
    return s.frame.progress;
  }

  it('starts a wheel notch during the ease from where the story stands: a reversal turns the story back at once', async () => {
    const s = setup();
    const at = await easing(s);
    fire(s.el, 'wheel', { deltaY: -120, deltaMode: 0, ctrlKey: false, timeStamp: s.frames.now });
    expect(s.frame.target).toBeCloseTo(at - 0.12, 9); // from the story's place, not from the stop it eased to
    const seen: number[] = [];
    for (let i = 0; i < 12; i++) {
      s.frames.frame();
      seen.push(s.frame.progress);
    }
    // It turns back within a few frames, long before the wheel's own quiet is over.
    const peak = seen.indexOf(Math.max(...seen));
    expect(peak).toBeLessThan(6);
    expect(seen.at(-1)!).toBeLessThan(seen[peak]!);
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([3, 3]);
  });

  it('steps a key during the ease from where the story stands', async () => {
    const s = setup();
    await easing(s);
    s.key('ArrowUp');
    expect(s.frame.target).toBe(3);
    s.drain();
    expect(s.frame.progress).toBe(3);
  });

  it('halts the ease where it stands when a finger comes down, and the finger lifted rests it on the nearer stop', async () => {
    const s = setup();
    const at = await easing(s);
    fire(s.el, 'touchstart', { touches: [{ clientX: 100, clientY: 400 }], timeStamp: s.frames.now });
    expect(s.frame.target).toBe(at);
    for (let i = 0; i < 10; i++) s.frames.frame();
    expect(s.frame.progress).toBe(at); // halted: it does not run on
    fire(s.el, 'touchend', { touches: [], timeStamp: s.frames.now + 200 });
    await flush();
    s.drain();
    const nearer = at - 3 <= 4 - at ? 3 : 4;
    expect([s.frame.target, s.frame.progress]).toEqual([nearer, nearer]);
  });

  it('lets two quick key presses still step two stops: a key does not settle', async () => {
    const s = setup();
    restAt(s, 2);
    s.key('ArrowDown');
    await flush();
    s.frames.frame();
    s.key('ArrowDown');
    expect(s.frame.target).toBe(4);
  });
});

/** Seconds of frames until progress has covered `share` of the way from `from` to `to`; the loop runs until it sleeps. */
function secondsToCover(s: ReturnType<typeof setup>, from: number, to: number, share: number): number {
  let frames = 0;
  while (s.frames.size > 0 && frames < 3000) {
    s.frames.frame();
    frames++;
    if (Math.abs(s.frame.progress - from) >= share * Math.abs(to - from)) return frames / 60;
  }
  return Infinity;
}

describe("the pace: the dive and the moves between beads take their time, the rise keeps M2a's", () => {
  it('reads the rise, the dive and the beads apart, by the stretch the story is moving through', () => {
    expect([RISE_SMOOTH, DIVE_SMOOTH, GLIDE_SMOOTH]).toEqual([0.25, 1.1, 0.7]);
    expect(smoothTimeAt(chapters, 0.5, 1)).toBe(RISE_SMOOTH);
    expect(smoothTimeAt(chapters, 1, 0)).toBe(RISE_SMOOTH); // leaving BOB from above upward is the rise
    expect(smoothTimeAt(chapters, 1, 2)).toBe(DIVE_SMOOTH); // leaving it downward is the dive
    expect(smoothTimeAt(chapters, 1.5, 2)).toBe(DIVE_SMOOTH);
    expect(smoothTimeAt(chapters, 2, 1)).toBe(DIVE_SMOOTH); // back up through the dive
    expect(smoothTimeAt(chapters, 2, 3)).toBe(GLIDE_SMOOTH);
    expect(smoothTimeAt(chapters, 4, 3)).toBe(GLIDE_SMOOTH);
    expect(smoothTimeAt(chapters, 3, 3)).toBe(GLIDE_SMOOTH); // at rest on a bead
    expect(smoothTimeAt(chapters, Number.NaN, 2)).toBe(RISE_SMOOTH); // a story that is not a number reads as the start
  });

  it('takes about 3.7 s down the dive, most of it in the first 2 s', async () => {
    const s = setup();
    restAt(s, 1);
    s.key('ArrowDown');
    await flush();
    expect(s.frame.target).toBe(2);
    const most = secondsToCover(s, 1, 2, 0.9);
    const nearly = secondsToCover(s, 1, 2, 0.99) + most;
    expect(most).toBeGreaterThan(1.9);
    expect(most).toBeLessThan(2.4);
    expect(nearly).toBeGreaterThan(3.3);
    expect(nearly).toBeLessThan(4.1);
    s.drain();
    expect(s.frame.progress).toBe(2);
  });

  it('takes about 2.3 s from one bead to the next', async () => {
    const s = setup();
    restAt(s, 3);
    s.key('ArrowDown');
    await flush();
    const nearly = secondsToCover(s, 3, 4, 0.99);
    expect(nearly).toBeGreaterThan(2.0);
    expect(nearly).toBeLessThan(2.7);
  });

  it('turns a slow dive back at once when a key or a wheel goes the other way', async () => {
    for (const reverse of ['key', 'wheel'] as const) {
      const s = setup();
      restAt(s, 1);
      s.key('ArrowDown');
      await flush();
      for (let i = 0; i < 30; i++) s.frames.frame(); // half a second down the dive, still moving
      expect(s.frame.velocity).toBeGreaterThan(0);
      if (reverse === 'key') s.key('ArrowUp');
      else fire(s.el, 'wheel', { deltaY: -120, deltaMode: 0, ctrlKey: false, timeStamp: s.frames.now });
      const turnedAt = s.frame.progress;
      s.frames.frame();
      s.frames.frame();
      expect(s.frame.progress).toBeLessThanOrEqual(turnedAt); // no run-on past where the reversal came
    }
  });

  it("keeps the rise at M2a's pace: BOB from above in under a second", async () => {
    const s = setup();
    for (let i = 0; i < 7; i++) s.key('ArrowDown'); // held to the top, 1
    await flush();
    expect(s.frame.target).toBe(1);
    expect(secondsToCover(s, 0, 1, 0.99)).toBeLessThan(1);
  });
});
