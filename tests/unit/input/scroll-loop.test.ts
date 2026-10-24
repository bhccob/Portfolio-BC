import { damp } from 'maath/easing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GESTURE_GAP_MS } from '../../../src/input/gesture';
import { Inertia } from '../../../src/input/Inertia';
import { SKIP_QUIET_MS, skipSwallower } from '../../../src/input/loaderSkip';
import { DIVE_SMOOTH, GLIDE_SMOOTH, RISE_SMOOTH, type Smooth, smoothTimeAt, startHomeScroll } from '../../../src/input/scrollLoop';
import { connectHomeScroll, goToEnd, goToTop } from '../../../src/input/useHomeScroll';
import { nearestStop, STEP_FADE_MS, stepFadeAt, stepFadeFrom } from '../../../src/scene/bob/stepFade';
import { buildChapters, type ChapterAt, chapterAt, HOME_CHAPTERS, scrollEnd, stops } from '../../../src/state/chapters';
import { frame as storyFrame } from '../../../src/state/frame';
import { useScene, type VoidState } from '../../../src/state/store';

/** A viewport 1000 px high: a unit of scroll is 1000 px. */
const VH = 1000;
const FRAME_MS = 1000 / 60;
const chapters = buildChapters({ categories: ['a', 'b', 'c'] }); // 7 units; stops 0, 1, 2, 3, 4, 5, 6, the last (END, the end page) the end

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

  it('glides nowhere toward the end of the story: a fling past the rise rests on a stop, the last one the end page', async () => {
    const s = setup();
    s.frame.target = s.frame.progress = 3.6;
    s.frame.chapterIndex = 3;
    await s.swipe(-1); // 0.4 of a drag to 4, then a glide that would carry another 0.625, past it
    expect(s.home.scroll.busy).toBe(false);
    s.drain();
    expect(s.frame.target).toBe(5);
    expect(s.frame.progress).toBe(5);
    // 2026-10-24: Cookies Clicker's stop, 5, is no longer the last: the same fling from just short of it rests on the end page, 6.
    s.frame.target = s.frame.progress = 4.6;
    s.frame.chapterIndex = 4;
    await s.swipe(-1); // 0.4 of a drag to 5, then a glide that would carry another 0.625, past it
    expect(s.home.scroll.busy).toBe(false);
    s.drain();
    expect(s.frame.target).toBe(6);
    expect(s.frame.progress).toBe(6);
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
    expect(s.frame.progress).toBe(6);
    expect(s.frame.chapterIndex).toBe(6);
    expect(s.changes.at(-1)).toMatchObject({ index: 6, id: 'END', category: null });
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

  it('flings from the home to the end page and back, resting on the last stop and on the home (Review Focus 1)', async () => {
    const s = setup();
    await wheelNotches(s, 60);
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([6, 6]);
    expect(s.changes.at(-1)).toMatchObject({ index: 6, id: 'END' });
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
    s.key('ArrowDown'); // Cookies Clicker's stop is no end now: one more step, into the night, to the end page
    expect(s.frame.target).toBe(6);
    s.key('ArrowDown'); // the end
    expect(s.frame.target).toBe(6);
    s.key('ArrowUp');
    s.key('PageUp');
    expect(s.frame.target).toBe(4);
    s.drain();
    expect(s.frame.progress).toBe(4);
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
    expect(s.frame.target).toBe(6);
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
    s.key('ArrowDown'); // 2026-10-24: Cookies Clicker's stop is not the last; the end page follows
    s.drain();
    expect(s.frame.target).toBe(6);
    s.key('ArrowDown'); // a step down from the last stop is none
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([6, 6]);
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
  it('from the home, 60 notches down then 30 straight back up in one gesture, rests where it came back to, the overview', async () => {
    // The end is 6 now (it was 5, and the same gesture came back to BOB from above, 1): 8 units down pins at 6, 4 up is 2.
    const s = setup({ vh: 900 });
    await wheelNotches(s, 60);
    await wheelNotches(s, 30, -120);
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([2, 2]);
  });

  it('from the home, 55 down then 20 up rests on the stop above where it turned back to, the first bead, never back down', async () => {
    // 55 notches of 120 px over 900 px are 7.33 units: the push overshoots the end, 6, by 1.33 and is pinned there (it was
    // 45 notches, 6.0, which reach 6 with no overshoot, so pinned and unpinned gave the same). 20 up are 2.67: from the
    // pinned 6 the story comes back to 3.33 and rests on 3; unpinned it would come back to 4.67 and rest on 4.
    const s = setup({ vh: 900 });
    await wheelNotches(s, 55);
    await wheelNotches(s, 20, -120); // the story comes back up to 3.33
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([3, 3]);
  });

  it('at the end, 10 notches down then 8 up, rests on the stop the way up reached past, 4, not back on 6', async () => {
    const s = setup({ vh: 900 });
    restAt(s, 6);
    await wheelNotches(s, 10);
    await wheelNotches(s, 8, -120); // 4.93
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([4, 4]);
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

  it('keeps the beads\' pace for the move into the night and at the end page: every move from the overview on is 0.7', () => {
    expect(smoothTimeAt(chapters, 5, 6)).toBe(GLIDE_SMOOTH); // Cookies Clicker to the end page
    expect(smoothTimeAt(chapters, 5.5, 6)).toBe(GLIDE_SMOOTH);
    expect(smoothTimeAt(chapters, 5.5, 5)).toBe(GLIDE_SMOOTH);
    expect(smoothTimeAt(chapters, 6, 5)).toBe(GLIDE_SMOOTH); // and back
    expect(smoothTimeAt(chapters, 6, 6)).toBe(GLIDE_SMOOTH); // at rest on the end page
    expect(smoothTimeAt(chapters, 4, 5)).toBe(GLIDE_SMOOTH);
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

  it('takes about 2.3 s from Cookies Clicker into the night, as from one bead to the next', async () => {
    const s = setup();
    restAt(s, 5);
    s.key('ArrowDown');
    await flush();
    expect(s.frame.target).toBe(6);
    const nearly = secondsToCover(s, 5, 6, 0.99);
    expect(nearly).toBeGreaterThan(2.0);
    expect(nearly).toBeLessThan(2.7);
    s.drain();
    expect(s.frame.progress).toBe(6);
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

  it('keeps quick keys queued on stops while the slow dive is still moving', async () => {
    const s = setup();
    restAt(s, 1);
    s.key('ArrowDown');
    await flush();
    s.frames.frame();
    s.key(' ');
    expect(s.frame.target).toBe(3); // stepped from the queued stop, 2, not from where the story stands
    s.frames.frame();
    fire(s.win, 'keydown', { key: ' ', shiftKey: true, ctrlKey: false, metaKey: false, altKey: false, repeat: false, isComposing: false, target: { tagName: 'BODY' } });
    expect(s.frame.target).toBe(2); // one back from the queue, still ahead of the story: it goes on, no stutter
    expect(s.frame.velocity).toBeGreaterThan(0);
    s.key('PageUp');
    expect(s.frame.target).toBe(1); // behind the story now: it turns back at once
    s.frames.frame();
    expect(s.frame.velocity).toBeLessThanOrEqual(0);
    s.drain();
    expect(s.frame.progress).toBe(1);
  });

  it("keeps the rise at M2a's pace: BOB from above in under a second", async () => {
    const s = setup();
    for (let i = 0; i < 7; i++) s.key('ArrowDown'); // held to the top, 1
    await flush();
    expect(s.frame.target).toBe(1);
    expect(secondsToCover(s, 0, 1, 0.99)).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------- the seam: the end page's own scroll

describe("the seam: at the end page the page's own scroll is the browser's, and its top hands back to the beads", () => {
  /**
   * The story at rest at the end page, as Home's end view leaves the document there (`<html data-end="rest">`,
   * src/scene/bob/endView.ts), with the window's own scroll `scrollY` down the page. `scrollTo` notes where the story's
   * target stood when it was called.
   */
  function atEndPage(s: ReturnType<typeof setup>, scrollY: number) {
    const attributes = new Map<string, string>([['data-end', 'rest']]);
    const scrolls: { to: [number, number]; target: number }[] = [];
    const win = {
      scrollY,
      scrollTo: (x: number, y: number) => {
        scrolls.push({ to: [x, y], target: s.frame.target });
        win.scrollY = y;
      },
    };
    vi.stubGlobal('document', { documentElement: { getAttribute: (name: string) => attributes.get(name) ?? null } });
    vi.stubGlobal('window', win);
    restAt(s, 6);
    return { attributes, win, scrolls };
  }
  type Page = ReturnType<typeof atEndPage>;

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** One wheel event of `px`, then `gapMs` of frames; the browser scrolls the page by it when it is left to it. Answers whether it was prevented. */
  async function notch(s: ReturnType<typeof setup>, page: Page, px: number, gapMs = 16): Promise<boolean> {
    const event = fire(s.el, 'wheel', { deltaY: px, deltaMode: 0, ctrlKey: false, timeStamp: s.frames.now });
    if (!event.defaultPrevented) page.win.scrollY = Math.max(page.win.scrollY + px, 0);
    await flush();
    for (let ms = 0; ms < gapMs; ms += FRAME_MS) s.frames.frame();
    return event.defaultPrevented;
  }

  /** A quiet of more than GESTURE_GAP_MS: the frames run, and the wheel's next event starts a gesture of its own. */
  function pause(s: ReturnType<typeof setup>): void {
    for (let ms = 0; ms <= GESTURE_GAP_MS; ms += FRAME_MS) s.frames.frame();
  }

  /**
   * A finger from y 300 that moves `dy` px (down the glass for a positive one: up the page and the story) in ten moves
   * 16 ms apart, a frame after each, then lifts; the browser scrolls the page by each move it is left. Answers each move's
   * prevention.
   */
  async function swipe(s: ReturnType<typeof setup>, page: Page, dy: number): Promise<boolean[]> {
    const from = 300;
    let t = s.frames.now;
    let lastY = from;
    const prevented: boolean[] = [];
    fire(s.el, 'touchstart', { touches: [{ clientX: 100, clientY: from }], timeStamp: t });
    for (let i = 1; i <= 10; i++) {
      t += 16;
      const y = from + (dy * i) / 10;
      const move = fire(s.el, 'touchmove', { touches: [{ clientX: 100, clientY: y }], timeStamp: t });
      if (!move.defaultPrevented) page.win.scrollY = Math.max(page.win.scrollY - (y - lastY), 0);
      lastY = y;
      prevented.push(move.defaultPrevented);
      if (i === 1) await flush();
      s.frames.frame();
    }
    fire(s.el, 'touchend', { touches: [], timeStamp: t + 4 });
    await flush();
    return prevented;
  }

  const shiftSpace = (s: ReturnType<typeof setup>) =>
    fire(s.win, 'keydown', { key: ' ', shiftKey: true, ctrlKey: false, metaKey: false, altKey: false, repeat: false, isComposing: false, target: { tagName: 'BODY' } });

  it('a story at 6 with the page at its top goes back to 5 on one wheel notch up, and rests on 5', async () => {
    const s = setup();
    const page = atEndPage(s, 0);
    expect(await notch(s, page, -120)).toBe(true);
    expect(s.frame.target).toBeCloseTo(5.88, 12);
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([5, 5]);
    expect(s.changes.at(-1)).toMatchObject({ index: 5, id: 'PROJECTS', category: 'c' });
    expect(page.win.scrollY).toBe(0);
  });

  it('leaves the wheel down at the end page to the browser: the page scrolls, and the story stays at 6 and runs no frame', async () => {
    const s = setup();
    const page = atEndPage(s, 0);
    for (let i = 0; i < 3; i++) expect(await notch(s, page, 120)).toBe(false);
    pause(s);
    expect(await notch(s, page, 120)).toBe(false); // a gesture of its own: down is the page's at every place
    expect(page.win.scrollY).toBe(480);
    expect([s.frame.target, s.frame.progress]).toEqual([6, 6]);
    expect(s.frames.size).toBe(0);
  });

  it('keeps a fast burst up the page with the page past its top, the story at 6, and takes the next notch after a pause back to 5 (Review Focus 1)', async () => {
    const s = setup();
    const page = atEndPage(s, 300);
    const prevented: boolean[] = [];
    for (let i = 0; i < 10; i++) prevented.push(await notch(s, page, -120)); // 16 ms apart: one gesture
    expect(prevented).toEqual(Array(10).fill(false)); // the page reached its top at the third; the rest are its too
    expect(page.win.scrollY).toBe(0);
    expect([s.frame.target, s.frame.progress]).toEqual([6, 6]);
    expect(s.frames.size).toBe(0);
    pause(s);
    expect(await notch(s, page, -120)).toBe(true);
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([5, 5]);
  });

  it('leaves ArrowDown, PageDown, Space and End to the page, and ArrowUp, PageUp and Shift+Space while it is scrolled', () => {
    const s = setup();
    const page = atEndPage(s, 300);
    for (const k of ['ArrowDown', 'PageDown', ' ', 'End', 'ArrowUp', 'PageUp']) expect(s.key(k).defaultPrevented, k).toBe(false);
    expect(shiftSpace(s).defaultPrevented).toBe(false);
    page.win.scrollY = 0;
    for (const k of ['ArrowDown', 'PageDown', ' ', 'End']) expect(s.key(k).defaultPrevented, `${k} at the top`).toBe(false);
    expect([s.frame.target, s.frame.progress]).toEqual([6, 6]);
    expect(s.frames.size).toBe(0);
  });

  it("steps the story back to 5 for ArrowUp, PageUp and Shift+Space at the page's top", async () => {
    type Press = (s: ReturnType<typeof setup>) => Event;
    const presses: Press[] = [(s) => s.key('ArrowUp'), (s) => s.key('PageUp'), shiftSpace];
    for (const press of presses) {
      const s = setup();
      atEndPage(s, 0);
      expect(press(s).defaultPrevented).toBe(true);
      expect(s.frame.target).toBe(5);
      await flush();
      s.drain();
      expect(s.frame.progress).toBe(5);
      vi.unstubAllGlobals();
    }
  });

  it("takes Home from the end page to the story's start, the page back at its top first", async () => {
    const s = setup();
    const page = atEndPage(s, 300);
    expect(s.key('Home').defaultPrevented).toBe(true);
    expect(page.scrolls).toEqual([{ to: [0, 0], target: 6 }]); // before the story moved
    expect(s.frame.target).toBe(0);
    await flush();
    s.drain();
    expect(s.frame.progress).toBe(0);
    expect(page.scrolls).toHaveLength(1);
  });

  it('scrolls nothing for Home when the page is at its top already', () => {
    const s = setup();
    const page = atEndPage(s, 0);
    expect(s.key('Home').defaultPrevented).toBe(true);
    expect(page.scrolls).toEqual([]);
    expect(s.frame.target).toBe(0);
  });

  it('leaves a swipe on the page to the browser, with no glide, and at its top a new swipe down the glass goes back to 5', async () => {
    const s = setup();
    const page = atEndPage(s, 300);
    // Down the glass from part way down: up the page, to its top and on, the page's to the lift.
    expect(await swipe(s, page, 500)).toEqual(Array(10).fill(false));
    expect(page.win.scrollY).toBe(0);
    expect(s.home.scroll.busy).toBe(false);
    expect([s.frame.target, s.frame.progress]).toEqual([6, 6]);
    expect(s.frames.size).toBe(0);
    // Up the glass at the top: down the page, the page's.
    expect(await swipe(s, page, -200)).toEqual(Array(10).fill(false));
    expect(page.win.scrollY).toBe(200);
    expect(s.frame.target).toBe(6);
    // Back at the top, a new swipe down the glass: the story's, back to Cookies Clicker.
    page.win.scrollY = 0;
    expect(await swipe(s, page, 300)).toEqual(Array(10).fill(true));
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([5, 5]);
    expect(page.win.scrollY).toBe(0);
  });

  it("keeps a wheel gesture from Cookies Clicker the story's to its end, though the story comes to rest at the end page under it", async () => {
    const s = setup();
    const page = atEndPage(s, 0);
    page.attributes.delete('data-end'); // at Cookies Clicker there is no end view
    restAt(s, 5);
    // A long trackpad push, an event every 100 ms: the target is pinned at 6 and the story eases there as the wheel turns.
    for (let i = 0; i < 100 && s.frame.progress !== 6; i++) expect(await notch(s, page, 120, 100)).toBe(true);
    expect([s.frame.target, s.frame.progress]).toEqual([6, 6]);
    expect(s.home.scroll.waiting).toBe(true); // the wheel's gesture still under way
    page.attributes.set('data-end', 'rest'); // as Home's end view writes it, the story at rest at the end
    for (let i = 0; i < 10; i++) expect(await notch(s, page, 120, 100)).toBe(true);
    expect(page.win.scrollY).toBe(0); // none of it scrolled the page
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([6, 6]);
    // The next gesture, after the quiet that ended that one, is the page's.
    expect(await notch(s, page, 120)).toBe(false);
    expect(page.win.scrollY).toBe(120);
  });

  it('leaves nothing to the page away from the end page, nor while the story is on its way', async () => {
    const s = setup();
    const page = atEndPage(s, 0);
    page.attributes.set('data-end', 'moving');
    expect(s.key('End').defaultPrevented).toBe(true);
    expect(await notch(s, page, 120)).toBe(true);
    s.drain();
    page.attributes.delete('data-end');
    restAt(s, 4);
    expect(await notch(s, page, 120)).toBe(true);
    expect(s.key('ArrowDown').defaultPrevented).toBe(true);
    expect(page.win.scrollY).toBe(0);
  });

  it("with reduced motion keeps the same seam: the wheel down and a burst up the page are the page's, and at its top a notch up steps to 5", async () => {
    const s = setup({ reduced: true });
    const page = atEndPage(s, 300);
    expect(await notch(s, page, 120)).toBe(false);
    pause(s);
    for (let i = 0; i < 6; i++) expect(await notch(s, page, -120)).toBe(false);
    expect(page.win.scrollY).toBe(0);
    expect(s.frame.target).toBe(6);
    pause(s);
    expect(await notch(s, page, -120)).toBe(true);
    expect(s.frame.target).toBe(5);
    s.drain();
    expect(s.frame.progress).toBe(5);
  });
});

// ---------------------------------------------------------------- a failed void, and reduced motion

describe('a failed void: the end page by its link and the step fade, never through the void', () => {
  const END = scrollEnd(HOME_CHAPTERS);
  const left: (() => void)[] = [];

  afterEach(() => {
    for (const disconnect of left.splice(0)) disconnect();
    vi.unstubAllGlobals();
    useScene.setState(useScene.getInitialState(), true);
    Object.assign(storyFrame, { progress: 0, target: 0, velocity: 0, chapterIndex: 0 });
  });

  /** One frame of the story as a frame callback leaves it: when, where the progress stands, and whether the host is faded down. */
  interface Seen {
    now: number;
    progress: number;
    dark: boolean;
  }

  /**
   * The home's scroll as the page wires it (connectHomeScroll: the store, `frame`, HOME_CHAPTERS), its frames the test's,
   * the store's void `failed` (or `voidState`) and the story at rest at `at`. `<html>` is a fake whose attributes the
   * input reads (`data-end`, which Home's end view writes: `endView` writes it as Home would) and writes
   * (`data-step-fade`); the window's `scrollY` is the end page's own scroll.
   */
  function failedHome(at: number, options: { reduced?: boolean; voidState?: VoidState } = {}) {
    useScene.setState(useScene.getInitialState(), true);
    useScene.setState({ phase: { kind: 'HOME_IDLE' }, threeD: true, voidState: options.voidState ?? 'failed', reducedMotion: options.reduced ?? false });
    const chapter = chapterAt(HOME_CHAPTERS, at);
    useScene.getState().dispatch({ type: 'CHAPTER', chapter: chapter.id, category: chapter.category });
    Object.assign(storyFrame, { progress: at, target: at, velocity: 0, chapterIndex: chapter.index, loaderSkipEndsMs: null });
    const html = new Map<string, string>();
    const win = {
      scrollY: 0,
      scrolls: 0,
      scrollTo: (_x: number, y: number) => {
        win.scrolls++;
        win.scrollY = y;
      },
    };
    vi.stubGlobal('document', {
      documentElement: {
        getAttribute: (name: string) => html.get(name) ?? null,
        hasAttribute: (name: string) => html.has(name),
        toggleAttribute: (name: string, force?: boolean) => {
          const on = force ?? !html.has(name);
          if (on) html.set(name, '');
          else html.delete(name);
          return on;
        },
      },
    });
    vi.stubGlobal('window', win);
    const frames = new FakeFrames();
    const el = new EventTarget();
    const keys = new EventTarget();
    Object.defineProperty(el, 'ownerDocument', { value: { defaultView: keys } });
    const disconnect = connectHomeScroll({ el: el as unknown as HTMLElement, unitPx: () => VH, request: frames.request, cancel: frames.cancel, loadSmooth: () => Promise.resolve(damp) });
    left.push(disconnect);

    const dark = (): boolean => html.has('data-step-fade');
    /** Runs the frames until the loop sleeps, noting each. */
    const run = (limit = 3000): Seen[] => {
      const seen: Seen[] = [];
      for (let i = 0; frames.size > 0 && i < limit; i++) {
        frames.frame();
        seen.push({ now: frames.now, progress: storyFrame.progress, dark: dark() });
      }
      return seen;
    };
    const key = (k: string, shiftKey = false): Event =>
      fire(keys, 'keydown', { key: k, shiftKey, ctrlKey: false, metaKey: false, altKey: false, repeat: false, isComposing: false, target: { tagName: 'BODY' } });
    /** `count` wheel events of `px`, a frame apart (one gesture), a frame after each; answers the frames seen and whether each was prevented. */
    const wheel = async (count: number, px: number): Promise<{ seen: Seen[]; prevented: boolean[] }> => {
      const seen: Seen[] = [];
      const prevented: boolean[] = [];
      for (let i = 0; i < count; i++) {
        prevented.push(fire(el, 'wheel', { deltaY: px, deltaMode: 0, ctrlKey: false, timeStamp: frames.now }).defaultPrevented);
        if (i === 0) await flush(); // the first may fetch damp
        frames.frame();
        seen.push({ now: frames.now, progress: storyFrame.progress, dark: dark() });
      }
      return { seen, prevented };
    };
    /**
     * A finger from y 300 that moves `dy` px (down the glass for a positive one: up the story) in ten moves, a frame after
     * each, then lifts `holdMs` after its last move (held still that long, it leaves no glide).
     */
    const swipe = async (dy: number, holdMs = 4): Promise<{ seen: Seen[]; prevented: boolean[] }> => {
      const seen: Seen[] = [];
      const prevented: boolean[] = [];
      let t = frames.now;
      fire(el, 'touchstart', { touches: [{ clientX: 100, clientY: 300 }], timeStamp: t });
      for (let i = 1; i <= 10; i++) {
        t += 16;
        prevented.push(fire(el, 'touchmove', { touches: [{ clientX: 100, clientY: 300 + (dy * i) / 10 }], timeStamp: t }).defaultPrevented);
        if (i === 1) await flush();
        frames.frame();
        seen.push({ now: frames.now, progress: storyFrame.progress, dark: dark() });
      }
      fire(el, 'touchend', { touches: [], timeStamp: t + holdMs });
      await flush();
      return { seen, prevented };
    };
    /** What Home's end view leaves on <html>: `rest` once the story rests at the end page, `moving` on the way, none elsewhere. */
    const endView = (state: 'rest' | 'moving' | null): void => {
      if (state === null) html.delete('data-end');
      else html.set('data-end', state);
    };
    /** Takes the story from where it rests to the end page by the link, and leaves it at rest there as Home would. */
    const toEndPage = async (): Promise<Seen[]> => {
      goToEnd();
      await flush();
      const seen = run();
      endView('rest');
      return seen;
    };
    return { frames, html, win, dark, run, key, wheel, swipe, endView, toEndPage, disconnect };
  }

  /**
   * Checks a move between `from` and `to` made by the step fade: every frame stands on one or the other, the host is
   * faded down from the first frame, the progress waits on `from` until STEP_FADE_MS have passed and then jumps, that
   * frame drawn under the dark host, and the host fades back the frame after.
   */
  function byFade(seen: Seen[], from: number, to: number): void {
    expect(seen.length).toBeGreaterThan(2);
    expect(
      seen.filter((f) => f.progress !== from && f.progress !== to),
      'a frame between the two',
    ).toEqual([]);
    expect(seen[0]).toMatchObject({ progress: from, dark: true });
    const jump = seen.findIndex((f) => f.progress === to);
    expect(jump).toBeGreaterThan(0);
    expect(seen.slice(0, jump).every((f) => f.dark && f.progress === from)).toBe(true);
    expect(seen[jump - 1]!.now - seen[0]!.now).toBeLessThan(STEP_FADE_MS);
    expect(seen[jump]!.now - seen[0]!.now).toBeGreaterThanOrEqual(STEP_FADE_MS);
    expect(seen[jump]!.dark, 'the frame of the jump is drawn under the dark host').toBe(true);
    expect(seen.slice(jump + 1).length).toBeGreaterThan(0);
    expect(seen.slice(jump + 1).every((f) => !f.dark && f.progress === to)).toBe(true);
    expect([storyFrame.target, storyFrame.progress, storyFrame.velocity]).toEqual([to, to, 0]);
  }

  it('failed: goToEnd places the story at 6 by a fade, and ArrowUp at the top goes back to 1 by a fade: no frame between 1 and 6', async () => {
    const s = failedHome(1);
    goToEnd();
    expect(storyFrame.target).toBe(END);
    await flush(); // the first move fetches damp
    byFade(s.run(), 1, END);
    expect(useScene.getState().phase.kind).toBe('END');
    expect(s.frames.size).toBe(0);

    // At rest at the end page, its page at the top: ArrowUp is the story's, back to BOB from above.
    s.endView('rest');
    expect(s.key('ArrowUp').defaultPrevented).toBe(true);
    expect(storyFrame.target).toBe(1);
    byFade(s.run(), END, 1);
    expect(useScene.getState().phase.kind).toBe('DIVE');
    expect(s.frames.size).toBe(0);
  });

  it('failed: a long wheel down still rests at 1, and a swipe up the glass too, from the home or from BOB from above', async () => {
    for (const at of [0, 1]) {
      const s = failedHome(at);
      const seen = [...(await s.wheel(40, 120)).seen, ...s.run()];
      expect([storyFrame.target, storyFrame.progress], `a wheel from ${at}`).toEqual([1, 1]);
      expect(Math.max(...seen.map((f) => f.progress))).toBeLessThanOrEqual(1);
      expect(seen.some((f) => f.dark)).toBe(false);
      const swiped = [...(await s.swipe(-600)).seen, ...s.run()];
      expect([storyFrame.target, storyFrame.progress], `a swipe from ${at}`).toEqual([1, 1]);
      expect(Math.max(...swiped.map((f) => f.progress))).toBeLessThanOrEqual(1);
      expect(swiped.some((f) => f.dark)).toBe(false);
      s.disconnect();
      vi.unstubAllGlobals();
    }
  });

  it('failed: ArrowDown, PageDown, Space and End from BOB from above go to the end page by the fade; from the home End does too', async () => {
    for (const k of ['ArrowDown', 'PageDown', ' ', 'End']) {
      const s = failedHome(1);
      expect(s.key(k).defaultPrevented, k).toBe(true);
      expect(storyFrame.target, k).toBe(END);
      await flush();
      byFade(s.run(), 1, END);
      s.disconnect();
      vi.unstubAllGlobals();
    }
    const s = failedHome(0);
    s.key('End');
    await flush();
    byFade(s.run(), 0, END);
  });

  it('failed: the rise stays the rise: a key or a wheel from the home moves up it by distance, with no fade', async () => {
    const s = failedHome(0);
    s.key('ArrowDown');
    await flush();
    const keyed = s.run();
    expect(storyFrame.target).toBeGreaterThan(0);
    expect(storyFrame.target).toBeLessThan(1);
    expect(keyed.some((f) => f.progress > 0 && f.progress < storyFrame.target)).toBe(true); // it travelled
    expect(keyed.some((f) => f.dark)).toBe(false);
    const wheeled = [...(await s.wheel(8, 120)).seen, ...s.run()];
    expect(storyFrame.progress).toBe(1); // a gesture up out of the rise rests on its top
    expect(wheeled.some((f) => f.progress > 0.5 && f.progress < 1)).toBe(true);
    expect(wheeled.some((f) => f.dark)).toBe(false);
  });

  it('failed: at the end page a wheel gesture up from the top goes back to 1 by the fade, and the rest of it takes no other step', async () => {
    const s = failedHome(1);
    await s.toEndPage();
    const { seen, prevented } = await s.wheel(12, -120); // one gesture, a notch a frame
    expect(prevented).toEqual(Array(12).fill(true)); // the story's from its first event to its last: none scrolls the page
    expect(storyFrame.target).toBe(1);
    byFade([...seen, ...s.run()], END, 1);
    expect(s.win.scrollY).toBe(0);
    // The gesture's quiet ends it, and nothing settles: the story stays on BOB from above.
    for (let i = 0; i < 30; i++) s.frames.frame();
    expect([storyFrame.target, storyFrame.progress]).toEqual([1, 1]);
  });

  it('failed: at the end page a swipe down the glass from the top goes back to 1 by the fade, with no glide after it', async () => {
    const s = failedHome(1);
    await s.toEndPage();
    const { seen, prevented } = await s.swipe(400);
    expect(prevented).toEqual(Array(10).fill(true));
    expect(storyFrame.target).toBe(1);
    byFade([...seen, ...s.run()], END, 1);
    expect(s.frames.size).toBe(0);
  });

  it("failed: a finger that wavers under the slop at the end page's top leaves the story at the end, with no fade", async () => {
    const s = failedHome(1);
    await s.toEndPage();
    // 30 px down the glass, under SETTLE_SLOP_PX (40), held still before the lift: a waver, or a pull-to-refresh reflex.
    const waver = await s.swipe(30, 300);
    expect(waver.prevented.some(Boolean)).toBe(true); // the story's, past the touch slop, so the page does not scroll
    expect(storyFrame.target).toBe(END);
    const still = [...waver.seen, ...s.run()];
    expect(still.every((f) => f.progress === END && !f.dark)).toBe(true);
    expect([storyFrame.target, storyFrame.progress]).toEqual([END, END]);
    expect(s.win.scrollY).toBe(0);
    // Past the slop the same finger goes back to BOB from above, by one fade.
    const past = await s.swipe(80, 300);
    expect(storyFrame.target).toBe(1);
    const all = [...past.seen, ...s.run()];
    const faded = all.findIndex((f) => f.dark);
    expect(faded).toBeGreaterThan(0); // under the slop first, the story still at the end
    expect(all.slice(0, faded).every((f) => f.progress === END)).toBe(true);
    byFade(all.slice(faded), END, 1);
  });

  it("failed: PageUp and Shift+Space at the top go back to 1 by the fade; down at the end page, and up while it is scrolled, are the page's", async () => {
    type Press = (s: ReturnType<typeof failedHome>) => Event;
    const presses: Press[] = [(s) => s.key('PageUp'), (s) => s.key(' ', true)];
    for (const press of presses) {
      const s = failedHome(1);
      await s.toEndPage();
      s.win.scrollY = 300;
      expect(s.key('ArrowUp').defaultPrevented).toBe(false);
      s.win.scrollY = 0;
      for (const k of ['ArrowDown', 'PageDown', ' ', 'End']) expect(s.key(k).defaultPrevented, k).toBe(false);
      expect(storyFrame.target).toBe(END);
      expect(press(s).defaultPrevented).toBe(true);
      expect(storyFrame.target).toBe(1);
      byFade(s.run(), END, 1);
      s.disconnect();
      vi.unstubAllGlobals();
    }
  });

  it('failed: Home from the end page goes to the home by the fade, the page back at its top first', async () => {
    const s = failedHome(1);
    await s.toEndPage();
    s.win.scrollY = 300;
    expect(s.key('Home').defaultPrevented).toBe(true);
    expect([s.win.scrolls, s.win.scrollY]).toEqual([1, 0]);
    expect(storyFrame.target).toBe(0);
    byFade(s.run(), END, 0);
    expect(useScene.getState().phase.kind).toBe('HOME_IDLE');
  });

  it('failed: a story that turns back before the host is dark lets the fade go, and nothing jumps', async () => {
    const s = failedHome(1);
    goToEnd();
    await flush();
    s.frames.frame();
    s.frames.frame();
    expect([storyFrame.progress, s.dark()]).toEqual([1, true]);
    expect(s.key('ArrowUp').defaultPrevented).toBe(true); // not yet at rest at the end: the story's
    expect(storyFrame.target).toBe(1);
    const seen = s.run();
    expect(seen.every((f) => f.progress === 1)).toBe(true);
    expect(seen.at(-1)?.dark).toBe(false);
    expect(s.frames.size).toBe(0);
  });

  it('failed: a wheel down at the end page while it is on its way keeps it there: a story at the end is not held back to 1', async () => {
    const s = failedHome(1);
    goToEnd();
    await flush();
    s.frames.frame();
    s.endView(null); // on its way: nothing yields to the page
    const { prevented } = await s.wheel(3, 120);
    expect(prevented).toEqual([true, true, true]);
    expect(storyFrame.target).toBe(END);
    s.run();
    expect([storyFrame.target, storyFrame.progress]).toEqual([END, END]);
  });

  it('failed: a story already at the end page when the scroll connects stays there; one at a bead is held at 1', () => {
    failedHome(END);
    expect([storyFrame.target, storyFrame.progress]).toEqual([END, END]);
    for (const disconnect of left.splice(0)) disconnect();
    vi.unstubAllGlobals();
    failedHome(4);
    expect([storyFrame.target, storyFrame.progress]).toEqual([1, 1]);
  });

  it('failed: 3D switched off under a fade lets it go, and leaving the home takes it away: the host is never left dark', async () => {
    const s = failedHome(1);
    goToEnd();
    await flush();
    s.frames.frame();
    expect(s.dark()).toBe(true);
    useScene.setState({ threeD: false });
    s.frames.frame();
    expect(s.dark()).toBe(false);
    expect(s.frames.size).toBe(0);
    s.disconnect();
    vi.unstubAllGlobals();

    const t = failedHome(1);
    goToEnd();
    await flush();
    t.frames.frame();
    expect(t.dark()).toBe(true);
    t.disconnect();
    expect(t.dark()).toBe(false);
    expect(t.frames.size).toBe(0);
    storyFrame.target = storyFrame.progress = 1; // as the route sync might leave it
    goToEnd(); // no home scroll connected: nothing moves
    expect([storyFrame.target, storyFrame.progress]).toEqual([1, 1]);
    expect(t.frames.size).toBe(0);
  });

  it("failed with reduced motion: a wheel step at 1 is held there, and asks for the overview, never the end page: when the void is back after 3D off and on, it goes on to 2", async () => {
    const s = failedHome(1, { reduced: true });
    const held = await s.wheel(1, 120);
    expect(held.prevented).toEqual([true]);
    s.run();
    expect([storyFrame.target, storyFrame.progress]).toEqual([1, 1]);
    // 3D off and on: the Void goes with the Stage (idle), then loads again, and this time it is there.
    useScene.setState({ threeD: false });
    useScene.getState().setVoidState('idle');
    useScene.setState({ threeD: true });
    useScene.getState().setVoidState('loading');
    s.run();
    expect(storyFrame.target).toBe(1);
    useScene.getState().setVoidState('ready');
    expect(storyFrame.target).toBe(2);
    await flush(); // the story's first move fetches damp
    s.run();
    expect([storyFrame.target, storyFrame.progress]).toEqual([2, 2]);
  });

  it('failed with reduced motion: a key steps from 1 to the end page, a notch up steps back, the progress jumping, never between; Home fades the scene (the input sets no fade)', async () => {
    const s = failedHome(1, { reduced: true });
    expect(s.key('ArrowDown').defaultPrevented).toBe(true);
    expect(storyFrame.target).toBe(END);
    // Home's own step fade, as it runs it each frame: the scene shows 1 until the host is dark, then the end page.
    const fade = stepFadeFrom(1);
    stepFadeAt(fade, nearestStop(stops(HOME_CHAPTERS), storyFrame.target), true, 0);
    expect(fade).toEqual({ shown: 1, next: END, darkAt: STEP_FADE_MS });
    await flush();
    const down = s.run();
    expect(down.filter((f) => f.progress !== 1 && f.progress !== END)).toEqual([]);
    expect(down.at(-1)?.progress).toBe(END);
    expect(down.some((f) => f.dark)).toBe(false);
    // At rest at the end page's top, a notch up steps back to BOB from above.
    s.endView('rest');
    const back = await s.wheel(1, -120);
    expect(back.prevented).toEqual([true]);
    expect(storyFrame.target).toBe(1);
    const up = [...back.seen, ...s.run()];
    expect(up.filter((f) => f.progress !== 1 && f.progress !== END)).toEqual([]);
    expect(storyFrame.progress).toBe(1);
    // A notch down at 1 stays at 1: the hold keeps a wheel there with reduced motion too.
    s.endView(null);
    for (let ms = 0; ms <= GESTURE_GAP_MS; ms += FRAME_MS) s.frames.frame();
    await s.wheel(1, 120);
    s.run();
    expect([storyFrame.target, storyFrame.progress]).toEqual([1, 1]);
  });

  it('ready: nothing fades in the input, and every stop is travelled to as before', async () => {
    const s = failedHome(1, { voidState: 'ready' });
    s.key('ArrowDown');
    expect(storyFrame.target).toBe(2);
    await flush();
    const seen = s.run();
    expect(seen.some((f) => f.dark)).toBe(false);
    expect(seen.some((f) => f.progress > 1 && f.progress < 2)).toBe(true);
    s.key('End');
    expect(storyFrame.target).toBe(END);
    expect(s.run().some((f) => f.dark)).toBe(false);
  });

  describe("goToTop, the header's name on the home: the Home key's own path", () => {
    /**
     * The story at rest at the end page, the void `voidState`, the page scrolled `scrollY` down; `order` notes where the
     * story's target stood each time the page was sent to its top.
     */
    const atEnd = (voidState: VoidState, scrollY: number) => {
      delete (storyFrame as { __damp?: unknown }).__damp; // the damping's own speed, kept on the frame by maath: none left over
      const s = failedHome(END, { voidState });
      s.endView('rest');
      s.win.scrollY = scrollY;
      const order: number[] = [];
      const scrollTo = s.win.scrollTo;
      s.win.scrollTo = (x: number, y: number) => {
        order.push(storyFrame.target);
        scrollTo(x, y);
      };
      return { s, order };
    };

    it('takes the story from the end page, scrolled down, to 0 as the Home key does: the page to its top first, then the same move', async () => {
      const byName = atEnd('ready', 300);
      expect(goToTop()).toBe(true);
      expect(byName.order, 'the page went to its top before the story moved').toEqual([END]);
      expect([byName.s.win.scrollY, storyFrame.target]).toEqual([0, 0]);
      await flush();
      const named = byName.s.run();
      expect([storyFrame.target, storyFrame.progress, storyFrame.velocity]).toEqual([0, 0, 0]);
      expect(useScene.getState().phase.kind).toBe('HOME_IDLE');
      expect(named.some((f) => f.dark), 'with the void there it moves, it does not fade').toBe(false);
      byName.s.disconnect();
      vi.unstubAllGlobals();

      const byKey = atEnd('ready', 300);
      expect(byKey.s.key('Home').defaultPrevented).toBe(true);
      expect(byKey.order).toEqual([END]);
      await flush();
      expect(byKey.s.run(), "frame for frame the Home key's own move").toEqual(named);
    });

    it('failed: from the end page it goes to 0 by the fade, as the Home key does, never through the void', async () => {
      const { s } = atEnd('failed', 300);
      expect(goToTop()).toBe(true);
      expect([s.win.scrollY, storyFrame.target]).toEqual([0, 0]);
      await flush();
      byFade(s.run(), END, 0);
      expect(useScene.getState().phase.kind).toBe('HOME_IDLE');
    });

    it('answers false and moves nothing with no home scroll connected, with 3D off, or off the scroll (a bead opening)', () => {
      const { s } = atEnd('ready', 300);
      useScene.setState({ threeD: false });
      expect(goToTop(), '3D off').toBe(false);
      expect([storyFrame.target, s.win.scrollY]).toEqual([END, 300]);
      useScene.setState({ threeD: true, phase: { kind: 'PROJECT_FOCUS', id: 'funcial' } });
      expect(goToTop(), 'a bead opening').toBe(false);
      expect([storyFrame.target, s.win.scrollY]).toEqual([END, 300]);
      s.disconnect();
      expect(goToTop(), 'nothing connected').toBe(false);
      expect([storyFrame.target, s.win.scrollY]).toEqual([END, 300]);
      expect(s.frames.size).toBe(0);
    });
  });
});

describe('reduced motion and the end page', () => {
  it('reduced motion: one wheel step from 5 goes to 6 by a fade, and one up goes back to 5', async () => {
    const s = setup({ reduced: true });
    restAt(s, 5);
    // Home's step fade, as it runs it on each frame it poses (src/scene/bob/Home.tsx): the stop the target is nearest.
    const fade = stepFadeFrom(5);
    const shown = (now: number): number => stepFadeAt(fade, nearestStop(stops(chapters), s.frame.target), true, now).shown;

    await wheelNotches(s, 10, 120, 16); // one gesture: one step
    expect(s.frame.target).toBe(6);
    expect(shown(0)).toBe(5); // the host fades down, the scene still at Cookies Clicker
    expect(fade.darkAt).toBe(STEP_FADE_MS);
    expect(shown(STEP_FADE_MS - 1)).toBe(5);
    expect(shown(STEP_FADE_MS)).toBe(6); // dark: the scene is at the end page, and the host fades back
    expect(fade.darkAt).toBeNull();
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([6, 6]);

    await wheelNotches(s, 10, -120, 16);
    expect(s.frame.target).toBe(5);
    const at = 10_000;
    expect(shown(at)).toBe(6);
    expect(fade.darkAt).toBe(at + STEP_FADE_MS);
    expect(shown(at + STEP_FADE_MS)).toBe(5);
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([5, 5]);
  });
});
