import { damp } from 'maath/easing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GESTURE_GAP_MS } from '../../../src/input/gesture';
import { Inertia } from '../../../src/input/Inertia';
import { SKIP_QUIET_MS, skipSwallower } from '../../../src/input/loaderSkip';
import { FINISH_S, FOLLOW, follow, GLIDE_MIN_S, GLIDE_S, RISE_SMOOTH, SHEET_FINISH_MS, type Smooth, smoothTimeAt, startHomeScroll } from '../../../src/input/scrollLoop';
import { connectHomeScroll, goToEnd, goToTop, headedToEnd } from '../../../src/input/useHomeScroll';
import { LANDING_HOLD } from '../../../src/scene/bob/landingHold';
import { nearestStop, STEP_FADE_MS, stepFadeAt, stepFadeFrom } from '../../../src/scene/bob/stepFade';
import { buildChapters, type ChapterAt, chapterAt, HOME_CHAPTERS, LIGHT_UNITS, placeOfFrame, scrollEnd, stops } from '../../../src/state/chapters';
import { frame as storyFrame } from '../../../src/state/frame';
import { useScene, type VoidState } from '../../../src/state/store';

/** A viewport 1000 px high: a unit of scroll is 1000 px. */
const VH = 1000;
const FRAME_MS = 1000 / 60;
// HOME 0-1, LIGHT 1-4 (the light dive's frames 1 to 300), RING a 4-5, RING b 5-6, SHEET c 6-7, END 7: the end page, 7.
const chapters = buildChapters({ categories: ['a', 'b', 'c'] });
const END = scrollEnd(chapters);
/** The first fact's place, the light dive's frame 81: the first key stop past BOB from above. */
const F81 = placeOfFrame(81);
/** The last fact's place, frame 241: the key stop before Funcial's. */
const F241 = placeOfFrame(241);
/** The landing hold: the most the scroll reaches while the beads load, or if they failed. */
const H = LANDING_HOLD;
/** The follow's floor, units a second: 12 of the light dive's 300 frames a second. */
const FLOOR = (FOLLOW.floorFramesPerSecond * LIGHT_UNITS) / 299;

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
type Setup = ReturnType<typeof setup>;

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

/** Puts the story at rest at `at`, as an earlier input would have left it. */
function restAt(s: Setup, at: number): void {
  s.frame.target = s.frame.progress = at;
  s.frame.chapterIndex = chapterAt(chapters, at).index;
}

/** `notches` wheel events of `px` (negative goes up the story), `gapMs` apart, the frames between them run. */
async function wheelNotches(s: Setup, notches: number, px = 120, gapMs = 16): Promise<void> {
  for (let i = 0; i < notches; i++) {
    fire(s.el, 'wheel', { deltaY: px, deltaMode: 0, ctrlKey: false, timeStamp: s.frames.now });
    if (i === 0) await flush(); // the first fetches damp
    for (let ms = 0; ms < gapMs; ms += FRAME_MS) s.frames.frame();
  }
}

/** A finger that drags `px` (up the screen for a positive one: down the story) in ten moves 16 ms apart, then waits `holdMs` before it lifts. */
async function drag(s: Setup, px: number, holdMs = 0): Promise<void> {
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

/** One frame of the story: its progress and velocity, and the loop's tween. */
interface Step {
  progress: number;
  velocity: number;
  tween: 'finish' | 'glide' | null;
  heading: number | null;
}

/** Runs `count` frames (or to rest), noting each. */
function frames(s: Setup, count = 3000): Step[] {
  const seen: Step[] = [];
  for (let i = 0; i < count && s.frames.size > 0; i++) {
    s.frames.frame();
    seen.push({ progress: s.frame.progress, velocity: s.frame.velocity, tween: s.home.loop.tweening, heading: s.home.loop.heading });
  }
  return seen;
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
    restAt(s, F241);
    s.key('PageDown'); // reduced motion: the next key stop, Funcial's, 4
    await flush();
    s.drain();
    expect(s.frame.progress).toBe(4);
    expect(s.frame.chapterIndex).toBe(2);
    expect(s.changes.at(-1)).toMatchObject({ index: 2, id: 'RING', category: 'a' });
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

describe('the scroll loop: a glide', () => {
  it('does not start one from a drag that is pinned at the start', async () => {
    const s = setup();
    await s.swipe(1); // the finger goes down: the story goes up, and it is at 0
    expect(s.frame.target).toBe(0);
    expect(s.home.scroll.busy).toBe(false);
    s.drain();
    expect(s.frames.size).toBe(0);
  });

  it('ends a glide on the rise that reaches its top: a glide begun on the rise stays on it, and stops on BOB from above', async () => {
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

  it('glides on past the rise as a page would, resting where it ends, and ends one that reaches the end page', async () => {
    const alone = glideAlone();
    const s = setup();
    restAt(s, 4.2);
    await s.swipe(-1); // 0.4 dragged, to 4.6, then the glide
    expect(s.home.scroll.busy).toBe(true);
    s.drain();
    expect(s.frame.target).toBeCloseTo(4.6 + alone.px / VH, 6); // in the ring, between two projects: no stop
    expect(s.frame.progress).toBe(s.frame.target);
    restAt(s, 6.8);
    await s.swipe(-1);
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([END, END]);
    expect(s.home.scroll.busy).toBe(false);
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

  it('leaves no velocity behind, and no tween', async () => {
    const s = setup();
    restAt(s, 4);
    s.key('ArrowDown');
    await flush();
    s.frames.frame();
    s.frames.frame();
    expect(s.frame.velocity).toBeGreaterThan(0);
    expect(s.home.loop.tweening).toBe('glide');
    s.home.dispose();
    expect(s.frame.velocity).toBe(0);
    expect(s.home.loop.tweening).toBeNull();
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
  it('still arrives: End fades to the end page, the chapter in step, and says nothing', async () => {
    const quiet = [vi.spyOn(console, 'error'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'log')];
    const s = setup({ loadSmooth: () => Promise.reject(new Error('chunk failed')) });
    s.key('End');
    await flush();
    s.drain();
    expect(s.frame.progress).toBe(END);
    expect(s.frame.chapterIndex).toBe(5);
    expect(s.changes.at(-1)).toMatchObject({ index: 5, id: 'END', category: null });
    expect(s.frame.velocity).toBe(0);
    expect(s.frames.size).toBe(0);
    for (const spy of quiet) expect(spy).not.toHaveBeenCalled();
  });

  it('snaps the rise, and still follows past it', async () => {
    const s = setup({ loadSmooth: () => Promise.reject(new Error('chunk failed')) });
    s.key('PageDown'); // 0.9, on the rise
    await flush();
    s.frames.frame();
    expect(s.frame.progress).toBeCloseTo(0.9, 12); // snapped
    s.drain();
    restAt(s, 2);
    await wheelNotches(s, 1, 500);
    s.frames.frame();
    expect(s.frame.progress).toBeGreaterThan(2);
    expect(s.frame.progress).toBeLessThan(2.5); // followed, not snapped
  });
});

// ---------------------------------------------------------------- the follow

describe('the follow: past the rise the story follows the scroll, with no stops of its own', () => {
  it('follows past the rise with tau 0.45: after 1 s it has covered 1 - e^(-1/0.45) of a step, within 1 %', async () => {
    const s = setup();
    restAt(s, 2);
    s.frame.target = 2.5; // a step of half a unit, as a long wheel turn would make it
    s.home.loop.wake();
    await flush();
    const seen = frames(s, 60); // one second of frames
    const covered = (seen.at(-1)!.progress - 2) / 0.5;
    expect(Math.abs(covered - (1 - Math.exp(-1 / FOLLOW.tau)))).toBeLessThan(0.01);
  });

  it('moves no slower than the floor near its target, 12 of the light dive\'s frames a second, and lands on it exactly', async () => {
    expect(FOLLOW).toEqual({ tau: 0.45, floorFramesPerSecond: 12 });
    const s = setup();
    restAt(s, 2);
    fire(s.el, 'wheel', { deltaY: 100, deltaMode: 0, ctrlKey: false, timeStamp: 0 });
    await flush();
    const seen = frames(s);
    expect(s.frame.progress).toBe(s.frame.target);
    const last = seen.length - 1;
    for (let i = 1; i < last; i++) expect(seen[i]!.velocity, `frame ${i}`).toBeGreaterThanOrEqual(FLOOR * (1 - 1e-9));
    expect(seen.length / 60).toBeLessThan(2); // about 1.3 s for a tenth of a unit
  });

  it('is a pure step toward the goal: the share of the time constant, never past it, the floor near it', () => {
    expect(follow(2, 2.5, 1 / 60)).toBeCloseTo(2 + 0.5 * (1 - Math.exp(-1 / 60 / 0.45)), 12);
    expect(follow(2, 2.001, 1 / 60)).toBe(2.001); // within a floor step: on it
    expect(follow(2, 2.03, 1 / 60)).toBeCloseTo(2 + FLOOR / 60, 12);
    expect(follow(2, 1.5, 1 / 60)).toBeLessThan(2);
    expect(follow(2, 2, 1 / 60)).toBe(2);
  });

  it("keeps the rise's damp: the rise moves at M2a's pace, past it the follow", () => {
    expect(smoothTimeAt(chapters, 0.5, 0.8)).toBe(RISE_SMOOTH);
    expect(smoothTimeAt(chapters, 1, 0.5)).toBe(RISE_SMOOTH); // leaving BOB from above upward is the rise
    expect(smoothTimeAt(chapters, 1, 1.5)).toBeNull(); // and downward the light dive
    expect(smoothTimeAt(chapters, 2, 2.5)).toBeNull();
    expect(smoothTimeAt(chapters, 5, 4.5)).toBeNull();
  });

  it('rests where a wheel stops, in the light dive and in the ring: no settle on a stop', async () => {
    const s = setup();
    restAt(s, 1);
    await wheelNotches(s, 13, 100);
    s.drain();
    expect(s.frame.target).toBeCloseTo(2.3, 12);
    expect(s.frame.progress).toBe(s.frame.target);
    await wheelNotches(s, 23, 100);
    s.drain();
    expect(s.frame.target).toBeCloseTo(4.6, 12);
    expect(s.frame.progress).toBe(s.frame.target);
    expect(s.changes.at(-1)).toMatchObject({ id: 'RING', category: 'a' });
  });

  it('rests a finger where it lifts past the rise, and a short drag stays where it went', async () => {
    const s = setup();
    restAt(s, 4);
    await drag(s, 300, 300); // held still before the lift: no glide
    s.drain();
    expect(s.frame.target).toBeCloseTo(4.3, 12);
    expect(s.frame.progress).toBe(s.frame.target);
    await drag(s, 30, 300);
    s.drain();
    expect(s.frame.target).toBeCloseTo(4.33, 12);
  });

  it('turns back at once when a wheel goes the other way', async () => {
    const s = setup();
    restAt(s, 2);
    await wheelNotches(s, 5, 100); // to 2.5
    const at = s.frame.progress;
    await wheelNotches(s, 10, -100); // to 1.5
    const after = frames(s, 3);
    expect(after.every((f) => f.progress < at)).toBe(true);
  });
});

// ---------------------------------------------------------------- the sheet's finish

describe("the sheet's finish: follow, then finish", () => {
  /** Wheel events into the sheet from Cookies Clicker, 16 ms apart, the frames between them run; each frame noted. */
  async function wheelInto(s: Setup, to: number, ms: number): Promise<Step[]> {
    const count = Math.round(ms / 16);
    const px = ((to - s.frame.target) * VH) / count;
    const seen: Step[] = [];
    for (let i = 0; i < count; i++) {
      fire(s.el, 'wheel', { deltaY: px, deltaMode: 0, ctrlKey: false, timeStamp: s.frames.now });
      if (i === 0) await flush();
      seen.push(...frames(s, 1));
    }
    return seen;
  }

  it('waits for 80 ms of quiet: none while the wheel turns, then on to the end page in under 1.3 s, never slowing below half its speed short of 0.9', async () => {
    expect([SHEET_FINISH_MS, FINISH_S]).toEqual([80, [0.35, 1.2]]);
    const s = setup();
    restAt(s, 6);
    const turning = await wheelInto(s, 6.2, 300);
    expect(s.frame.target).toBeCloseTo(6.2, 9);
    expect(turning.every((f) => f.tween === null)).toBe(true);
    const after = frames(s);
    const start = after.findIndex((f) => f.tween === 'finish');
    expect(start).toBeGreaterThan(0);
    // The first frame at least SHEET_FINISH_MS after the last input (one frame ran in `wheelInto` after it).
    expect((start + 2) * FRAME_MS).toBeGreaterThanOrEqual(SHEET_FINISH_MS);
    expect((start + 1) * FRAME_MS).toBeLessThan(SHEET_FINISH_MS);
    expect(after[start]!.heading).toBe(END);
    const landed = after.findIndex((f) => f.progress === END);
    expect((landed - start) * FRAME_MS).toBeLessThan(1300);
    expect([s.frame.target, s.frame.progress, s.frame.velocity]).toEqual([END, END, 0]);
    const speed = after[start]!.velocity;
    expect(speed).toBeGreaterThan(0);
    for (const f of after.slice(start + 1, landed)) if (f.progress < 6.9) expect(f.velocity).toBeGreaterThanOrEqual(speed / 2);
    expect(s.changes.at(-1)).toMatchObject({ id: 'END' });
  });

  it('finishes back down onto Cookies Clicker under 3 % of the sheet, or when the last move went up', async () => {
    const s = setup();
    restAt(s, 6);
    await wheelInto(s, 6.02, 16);
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([6, 6]);
    await wheelInto(s, 6.8, 160);
    await wheelInto(s, 6.5, 48); // and up again, before the quiet
    const after = frames(s);
    expect(after.find((f) => f.tween === 'finish')?.heading).toBe(6);
    expect([s.frame.target, s.frame.progress]).toEqual([6, 6]);
  });

  it('rides along with input in its own way, and stops for input against it, where the scroll put it', async () => {
    const s = setup();
    restAt(s, 6);
    await wheelInto(s, 6.3, 160);
    const before = frames(s, 20);
    expect(before.at(-1)!.tween).toBe('finish');
    fire(s.el, 'wheel', { deltaY: 30, deltaMode: 0, ctrlKey: false, timeStamp: s.frames.now });
    expect([s.home.loop.tweening, s.home.loop.heading, s.frame.target]).toEqual(['finish', END, END]);
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([END, END]);

    restAt(s, 6);
    for (let ms = 0; ms <= GESTURE_GAP_MS; ms += FRAME_MS) s.frames.frame();
    await wheelInto(s, 6.3, 160);
    frames(s, 20);
    expect(s.home.loop.tweening).toBe('finish');
    const at = s.frame.progress;
    fire(s.el, 'wheel', { deltaY: -30, deltaMode: 0, ctrlKey: false, timeStamp: s.frames.now });
    expect(s.home.loop.tweening).toBeNull();
    expect(s.frame.target).toBeCloseTo(at - 0.03, 12);
    s.drain(); // the quiet again, then the finish down: the last move went up
    expect([s.frame.target, s.frame.progress]).toEqual([6, 6]);
  });

  it('waits while a finger is down, and finishes from its lift', async () => {
    const s = setup();
    restAt(s, 6);
    let t = s.frames.now;
    fire(s.el, 'touchstart', { touches: [{ clientX: 100, clientY: 600 }], timeStamp: t });
    for (let i = 1; i <= 10; i++) {
      t += 16;
      fire(s.el, 'touchmove', { touches: [{ clientX: 100, clientY: 600 - 40 * i }], timeStamp: t });
      if (i === 1) await flush();
      s.frames.frame();
    }
    const held = frames(s, 30); // the finger still down, 0.5 s
    expect(held.every((f) => f.tween === null)).toBe(true);
    fire(s.el, 'touchend', { touches: [], timeStamp: t + 500 });
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([END, END]);
  });

  it('never moves the ring by itself: a wheel stopped between two projects stays there', async () => {
    const s = setup();
    restAt(s, 4);
    await wheelInto(s, 4.5, 160);
    const after = frames(s);
    expect(after.every((f) => f.tween === null)).toBe(true);
    expect(s.frame.progress).toBeCloseTo(4.5, 9);
  });
});

// ---------------------------------------------------------------- the keys

describe('the keys: the facts in the light dive, then the projects, gliding past it', () => {
  it('steps the target to the next fact in the light dive, and the follow eases after it', async () => {
    const s = setup();
    restAt(s, 1);
    s.key('ArrowDown');
    expect(s.frame.target).toBe(F81);
    await flush();
    const seen = frames(s);
    expect(seen.every((f) => f.tween === null)).toBe(true);
    expect(s.frame.progress).toBe(F81);
    s.key('PageDown');
    expect(s.frame.target).toBe(placeOfFrame(121));
  });

  it('glides a key past the light dive: from Funcial to Jontai Energy in 1.2 s, eased from rest, no faster than 1.6 a second', async () => {
    expect([GLIDE_S, GLIDE_MIN_S]).toEqual([1.2, 0.6]);
    const s = setup();
    restAt(s, 4);
    s.key('ArrowDown');
    expect([s.frame.target, s.home.loop.tweening, s.home.loop.heading]).toEqual([5, 'glide', 5]);
    await flush();
    const seen = frames(s);
    expect([s.frame.target, s.frame.progress, s.frame.velocity]).toEqual([5, 5, 0]);
    expect(Math.abs(seen.length * FRAME_MS - 1200)).toBeLessThanOrEqual(2 * FRAME_MS);
    expect(seen[0]!.velocity).toBeLessThan(0.1);
    expect(Math.max(...seen.map((f) => f.velocity))).toBeLessThanOrEqual(1.6);
  });

  it('counts a second press from where the glide is going: two presses 300 ms apart rest on Cookies Clicker', async () => {
    const s = setup();
    restAt(s, 4);
    s.key('ArrowDown');
    await flush();
    frames(s, 18);
    s.key('ArrowDown');
    expect([s.frame.target, s.home.loop.heading]).toEqual([6, 6]);
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([6, 6]);
  });

  it('glides into the ring from the last fact, and back out of it to the last fact', async () => {
    const s = setup();
    restAt(s, F241);
    s.key('ArrowDown');
    expect([s.frame.target, s.home.loop.tweening]).toEqual([4, 'glide']);
    await flush();
    s.drain();
    s.key('ArrowUp');
    expect([s.frame.target, s.home.loop.tweening]).toEqual([F241, 'glide']);
    s.drain();
    expect(s.frame.progress).toBe(F241);
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
    restAt(s, 4);
    s.key('ArrowDown');
    for (let i = 0; i < 10; i++) fire(s.win, 'keydown', { key: 'ArrowDown', shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, repeat: true, isComposing: false, target: { tagName: 'BODY' } });
    expect(s.frame.target).toBe(5);
  });

  it('steps a key from a wheel stopped between two projects to the next project', async () => {
    const s = setup();
    restAt(s, 4.6);
    s.key('ArrowDown');
    expect(s.frame.target).toBe(5);
    s.key('ArrowUp');
    expect(s.frame.target).toBe(4); // counted from where the glide is going, 5
  });
});

// ---------------------------------------------------------------- Home and End

describe('Home and End keep their meaning: the start and the end page', () => {
  /** The frames of a move by the step fade: the progress waits, then jumps, nothing between. */
  function fadedFrom(seen: Step[], from: number, to: number): void {
    expect(seen.filter((f) => f.progress !== from && f.progress !== to)).toEqual([]);
    expect(seen[0]!.progress).toBe(from);
    expect(seen.at(-1)!.progress).toBe(to);
  }

  it('fades End to the end page from anywhere short of it: the rise, the light dive, the ring', async () => {
    for (const from of [0, 2.5, 4.5]) {
      const s = setup();
      restAt(s, from);
      s.key('End');
      expect(s.frame.target).toBe(END);
      await flush();
      fadedFrom(frames(s), from, END);
      expect(s.frame.velocity).toBe(0);
    }
  });

  it('fades Home to the start from the ring, the sheet and the end page, and follows back up from the light dive', async () => {
    for (const from of [4, 6.5, END]) {
      const s = setup();
      restAt(s, from);
      s.key('Home');
      expect(s.frame.target).toBe(0);
      await flush();
      fadedFrom(frames(s), from, 0);
    }
    const s = setup();
    restAt(s, 2.5);
    s.key('Home');
    await flush();
    const seen = frames(s);
    expect(seen.some((f) => f.progress > 0 && f.progress < 2.5)).toBe(true);
    expect(s.frame.progress).toBe(0);
  });

  it('lets a fade go when a key turns back before it is dark: the story stays; a key its own way leaves it to jump', async () => {
    const s = setup();
    restAt(s, 4);
    s.key('End');
    await flush();
    frames(s, 2);
    s.key('ArrowUp');
    expect(s.frame.target).toBe(4);
    const stayed = frames(s);
    expect(stayed.every((f) => f.progress === 4)).toBe(true);
    s.key('End');
    frames(s, 2);
    s.key('ArrowDown');
    expect(s.frame.target).toBe(END);
    s.drain();
    expect(s.frame.progress).toBe(END);
  });

  it('lets a fade go for a wheel turned back before it is dark, from where the story stands', async () => {
    const s = setup();
    restAt(s, 4.5);
    s.key('End');
    await flush();
    frames(s, 2);
    await wheelNotches(s, 1, -100);
    expect(s.frame.target).toBeCloseTo(4.4, 12);
    s.drain();
    expect(s.frame.progress).toBeCloseTo(4.4, 12);
  });
});

// ---------------------------------------------------------------- the rise

describe("the rise: M2a's own, resting at its top", () => {
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
    expect(s.changes.at(-1)).toMatchObject({ index: 1, id: 'LIGHT' });
  });

  it('moves the next gesture from BOB from above on into the light dive, where it rests as it ends', async () => {
    const s = setup({ vh: 900 });
    await wheelNotches(s, 8);
    s.drain();
    expect(s.frame.target).toBe(1);
    await wheelNotches(s, 1); // from 1, 1.133
    s.drain();
    expect(s.frame.target).toBeCloseTo(1 + 120 / 900, 12);
    expect(s.frame.progress).toBe(s.frame.target);
  });

  it('lets a fling from the home, more than a whole unit past the top, rest where it ends', async () => {
    const s = setup({ vh: 900 });
    await wheelNotches(s, 20); // 2.667 in one gesture
    s.drain();
    expect(s.frame.target).toBeCloseTo(20 * (120 / 900), 12);
    expect(s.frame.progress).toBe(s.frame.target);
  });

  it('rests one gesture from part way up the rise that ends a little past its top on the top too', async () => {
    const s = setup();
    restAt(s, 0.6);
    await wheelNotches(s, 6); // 1.32
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([1, 1]);
  });

  it('at the home, 10 notches up then 10 down, rests on BOB from above, not part way into the light dive', async () => {
    const s = setup({ vh: 900 });
    await wheelNotches(s, 10, -120);
    await wheelNotches(s, 10); // 1.33
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([1, 1]);
  });

  it("keeps the rise at M2a's pace: 99 % of the way to BOB from above in under a second", async () => {
    const s = setup();
    s.key('PageDown');
    s.key('PageDown');
    await flush();
    const seen = frames(s);
    expect(s.frame.progress).toBe(1);
    expect(seen.findIndex((f) => f.progress >= 0.99) / 60).toBeLessThan(1);
  });

  it('carries the speed across the top: no frame of the move up through BOB from above stops the story', async () => {
    const s = setup();
    restAt(s, 2);
    await wheelNotches(s, 15, -100); // to 0.5
    const seen = frames(s);
    expect(s.frame.progress).toBeCloseTo(0.5, 9);
    const through = seen.filter((f) => f.progress > 0.6 && f.progress < 1.4);
    expect(through.every((f) => f.velocity < -0.2)).toBe(true);
  });
});

// ---------------------------------------------------------------- reduced motion

describe('reduced motion steps among the key stops', () => {
  it('steps a wheel notch, a swipe and a key one key stop, with no travel of the target between', async () => {
    const s = setup({ reduced: true });
    restAt(s, 1);
    await wheelNotches(s, 1);
    expect(s.frame.target).toBe(F81);
    s.drain();
    expect(s.frame.progress).toBe(F81);
    await drag(s, 300);
    expect(s.frame.target).toBe(placeOfFrame(121));
    restAt(s, 4);
    s.key('ArrowDown');
    expect(s.frame.target).toBe(5);
    expect(s.home.loop.tweening).toBeNull(); // no glide with reduced motion
    s.key('ArrowDown');
    s.key('ArrowDown');
    expect(s.frame.target).toBe(END);
    s.key('ArrowDown'); // a step down from the end is none
    expect(s.frame.target).toBe(END);
  });

  it('never finishes the sheet by itself: its steps rest on Cookies Clicker and the end page', async () => {
    const s = setup({ reduced: true });
    restAt(s, 6);
    await wheelNotches(s, 1);
    expect(s.frame.target).toBe(END);
    s.drain();
    expect(s.home.loop.tweening).toBeNull();
  });
});

// ---------------------------------------------------------------- the seam at the end page

describe("the seam: at the end page the page's own scroll is the browser's, and its top hands back to the ring", () => {
  /**
   * The story at rest at the end page, as Home's end view leaves the document there (`<html data-end="rest">`,
   * src/scene/bob/endView.ts), with the window's own scroll `scrollY` down the page. `scrollTo` notes where the story's
   * target stood when it was called.
   */
  function atEndPage(s: Setup, scrollY: number) {
    const attributes = new Map<string, string>([['data-end', 'rest']]);
    const scrolls: { to: [number, number]; target: number }[] = [];
    const win = {
      scrollY,
      scrollTo: (x: number, y: number) => {
        scrolls.push({ to: [x, y], target: s.frame.target });
        win.scrollY = y;
      },
    };
    vi.stubGlobal('document', {
      documentElement: {
        getAttribute: (name: string) => attributes.get(name) ?? null,
        toggleAttribute: (name: string, force?: boolean) => {
          if (force ?? !attributes.has(name)) attributes.set(name, '');
          else attributes.delete(name);
        },
      },
    });
    vi.stubGlobal('window', win);
    restAt(s, END);
    return { attributes, win, scrolls };
  }
  type Page = ReturnType<typeof atEndPage>;

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** One wheel event of `px`, then `gapMs` of frames; the browser scrolls the page by it when it is left to it. Answers whether it was prevented. */
  async function notch(s: Setup, page: Page, px: number, gapMs = 16): Promise<boolean> {
    const event = fire(s.el, 'wheel', { deltaY: px, deltaMode: 0, ctrlKey: false, timeStamp: s.frames.now });
    if (!event.defaultPrevented) page.win.scrollY = Math.max(page.win.scrollY + px, 0);
    await flush();
    for (let ms = 0; ms < gapMs; ms += FRAME_MS) s.frames.frame();
    return event.defaultPrevented;
  }

  /** A quiet of more than GESTURE_GAP_MS: the frames run, and the wheel's next event starts a gesture of its own. */
  function pause(s: Setup): void {
    for (let ms = 0; ms <= GESTURE_GAP_MS; ms += FRAME_MS) s.frames.frame();
  }

  /**
   * A finger from y 300 that moves `dy` px (down the glass for a positive one: up the page and the story) in ten moves
   * 16 ms apart, a frame after each, then lifts; the browser scrolls the page by each move it is left. Answers each move's
   * prevention.
   */
  async function swipe(s: Setup, page: Page, dy: number): Promise<boolean[]> {
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

  const shiftSpace = (s: Setup) =>
    fire(s.win, 'keydown', { key: ' ', shiftKey: true, ctrlKey: false, metaKey: false, altKey: false, repeat: false, isComposing: false, target: { tagName: 'BODY' } });

  it('a story at 7 with the page at its top slides the sheet back onto Cookies Clicker for one wheel notch up', async () => {
    const s = setup();
    const page = atEndPage(s, 0);
    expect(await notch(s, page, -120)).toBe(true);
    expect(s.frame.target).toBeCloseTo(6.88, 12);
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([6, 6]);
    expect(s.changes.at(-1)).toMatchObject({ index: 4, id: 'SHEET', category: 'c' });
    expect(page.win.scrollY).toBe(0);
  });

  it('leaves the wheel down at the end page to the browser: the page scrolls, and the story stays at 7 and runs no frame', async () => {
    const s = setup();
    const page = atEndPage(s, 0);
    for (let i = 0; i < 3; i++) expect(await notch(s, page, 120)).toBe(false);
    pause(s);
    expect(await notch(s, page, 120)).toBe(false); // a gesture of its own: down is the page's at every place
    expect(page.win.scrollY).toBe(480);
    expect([s.frame.target, s.frame.progress]).toEqual([END, END]);
    expect(s.frames.size).toBe(0);
  });

  it('keeps a fast burst up the page with the page past its top, the story at 7, and takes the next notch after a pause back to 6', async () => {
    const s = setup();
    const page = atEndPage(s, 300);
    const prevented: boolean[] = [];
    for (let i = 0; i < 10; i++) prevented.push(await notch(s, page, -120)); // 16 ms apart: one gesture
    expect(prevented).toEqual(Array(10).fill(false)); // the page reached its top at the third; the rest are its too
    expect(page.win.scrollY).toBe(0);
    expect([s.frame.target, s.frame.progress]).toEqual([END, END]);
    expect(s.frames.size).toBe(0);
    pause(s);
    expect(await notch(s, page, -120)).toBe(true);
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([6, 6]);
  });

  it('leaves ArrowDown, PageDown, Space and End to the page, and ArrowUp, PageUp and Shift+Space while it is scrolled', () => {
    const s = setup();
    const page = atEndPage(s, 300);
    for (const k of ['ArrowDown', 'PageDown', ' ', 'End', 'ArrowUp', 'PageUp']) expect(s.key(k).defaultPrevented, k).toBe(false);
    expect(shiftSpace(s).defaultPrevented).toBe(false);
    page.win.scrollY = 0;
    for (const k of ['ArrowDown', 'PageDown', ' ', 'End']) expect(s.key(k).defaultPrevented, `${k} at the top`).toBe(false);
    expect([s.frame.target, s.frame.progress]).toEqual([END, END]);
    expect(s.frames.size).toBe(0);
  });

  it("glides the story back to 6 for ArrowUp, PageUp and Shift+Space at the page's top", async () => {
    type Press = (s: Setup) => Event;
    const presses: Press[] = [(s) => s.key('ArrowUp'), (s) => s.key('PageUp'), shiftSpace];
    for (const press of presses) {
      const s = setup();
      atEndPage(s, 0);
      expect(press(s).defaultPrevented).toBe(true);
      expect([s.frame.target, s.home.loop.tweening]).toEqual([6, 'glide']);
      await flush();
      s.drain();
      expect(s.frame.progress).toBe(6);
      vi.unstubAllGlobals();
    }
  });

  it("takes Home from the end page to the story's start by the fade, the page back at its top first", async () => {
    const s = setup();
    const page = atEndPage(s, 300);
    expect(s.key('Home').defaultPrevented).toBe(true);
    expect(page.scrolls).toEqual([{ to: [0, 0], target: END }]); // before the story moved
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

  it('leaves a swipe on the page to the browser, with no glide, and at its top a new swipe down the glass slides the sheet back to 6', async () => {
    const s = setup();
    const page = atEndPage(s, 300);
    // Down the glass from part way down: up the page, to its top and on, the page's to the lift.
    expect(await swipe(s, page, 500)).toEqual(Array(10).fill(false));
    expect(page.win.scrollY).toBe(0);
    expect(s.home.scroll.busy).toBe(false);
    expect([s.frame.target, s.frame.progress]).toEqual([END, END]);
    expect(s.frames.size).toBe(0);
    // Up the glass at the top: down the page, the page's.
    expect(await swipe(s, page, -200)).toEqual(Array(10).fill(false));
    expect(page.win.scrollY).toBe(200);
    expect(s.frame.target).toBe(END);
    // Back at the top, a new swipe down the glass: the story's, back to Cookies Clicker.
    page.win.scrollY = 0;
    expect(await swipe(s, page, 300)).toEqual(Array(10).fill(true));
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([6, 6]);
    expect(page.win.scrollY).toBe(0);
  });

  it("keeps a wheel gesture from Cookies Clicker the story's to its end, though the story comes to rest at the end page under it", async () => {
    const s = setup();
    const page = atEndPage(s, 0);
    page.attributes.delete('data-end'); // at Cookies Clicker there is no end view
    restAt(s, 6);
    // A long trackpad push, an event every 100 ms: the sheet finishes between them, each riding along with it.
    for (let i = 0; i < 100 && s.frame.progress !== END; i++) expect(await notch(s, page, 120, 100)).toBe(true);
    expect([s.frame.target, s.frame.progress]).toEqual([END, END]);
    expect(s.home.scroll.waiting).toBe(true); // the wheel's gesture still under way
    page.attributes.set('data-end', 'rest'); // as Home's end view writes it, the story at rest at the end
    for (let i = 0; i < 10; i++) expect(await notch(s, page, 120, 100)).toBe(true);
    expect(page.win.scrollY).toBe(0); // none of it scrolled the page
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([END, END]);
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

  it("with reduced motion keeps the same seam: the wheel down and a burst up the page are the page's, and at its top a notch up steps to 6", async () => {
    const s = setup({ reduced: true });
    const page = atEndPage(s, 300);
    expect(await notch(s, page, 120)).toBe(false);
    pause(s);
    for (let i = 0; i < 6; i++) expect(await notch(s, page, -120)).toBe(false);
    expect(page.win.scrollY).toBe(0);
    expect(s.frame.target).toBe(END);
    pause(s);
    expect(await notch(s, page, -120)).toBe(true);
    expect(s.frame.target).toBe(6);
    s.drain();
    expect(s.frame.progress).toBe(6);
  });
});

// ---------------------------------------------------------------- the home as the page wires it: the hold and a failed void

describe("the home as the page wires it: the landing hold, a failed void, the header's name and the nav's link", () => {
  const STORY_END = scrollEnd(HOME_CHAPTERS);
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
   * the store's void `failed` (or `voidState`) and the story at rest at `at` (or, with `target`, at `at` on its way
   * there, as a home that comes back to a story left mid-move finds it). `<html>` is a fake whose attributes the input
   * reads (`data-end`, which Home's end view writes: `endView` writes it as Home would) and writes (`data-step-fade`);
   * the window's `scrollY` is the end page's own scroll.
   */
  function wiredHome(at: number, options: { reduced?: boolean; voidState?: VoidState; target?: number } = {}) {
    useScene.setState(useScene.getInitialState(), true);
    useScene.setState({ phase: { kind: 'HOME_IDLE' }, threeD: true, voidState: options.voidState ?? 'failed', reducedMotion: options.reduced ?? false });
    const chapter = chapterAt(HOME_CHAPTERS, at);
    useScene.getState().dispatch({ type: 'CHAPTER', chapter: chapter.id, category: chapter.category });
    Object.assign(storyFrame, { progress: at, target: options.target ?? at, velocity: 0, chapterIndex: chapter.index, loaderSkipEndsMs: null });
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

  describe('the landing hold: the story waits just above the ring while the beads load', () => {
    it("holds a wheel past it at LANDING_HOLD while loading, and the beads' ready takes it on to where the wheel went", async () => {
      expect(H).toBe(placeOfFrame(258));
      const s = wiredHome(1, { voidState: 'loading' });
      await s.wheel(40, 100); // to 5
      const held = s.run();
      expect([storyFrame.target, storyFrame.progress]).toEqual([H, H]);
      expect(Math.max(...held.map((f) => f.progress))).toBeLessThanOrEqual(H);
      useScene.getState().setVoidState('ready');
      expect(storyFrame.target).toBeCloseTo(5, 9);
      s.run();
      expect(storyFrame.progress).toBeCloseTo(5, 9);
      expect(useScene.getState().phase.kind).toBe('PROJECTS');
    });

    it('holds a key there too, and lets it on to Funcial once ready', async () => {
      const s = wiredHome(placeOfFrame(241), { voidState: 'loading' });
      s.key('ArrowDown');
      expect(storyFrame.target).toBe(H);
      await flush();
      s.run();
      useScene.getState().setVoidState('ready');
      expect(storyFrame.target).toBe(4);
      s.run();
      expect(storyFrame.progress).toBe(4);
    });

    it('moves the story at once back up from the hold: nothing past it is kept as a debt', async () => {
      const s = wiredHome(1, { voidState: 'loading' });
      await s.wheel(40, 100);
      s.run();
      for (let ms = 0; ms <= GESTURE_GAP_MS; ms += FRAME_MS) s.frames.frame();
      await s.wheel(3, -100);
      expect(storyFrame.target).toBeCloseTo(H - 0.3, 9);
    });

    it("holds Back to a bead's stop at the hold while loading, then goes on to the stop once ready", async () => {
      wiredHome(5, { voidState: 'loading' });
      expect([storyFrame.target, storyFrame.progress]).toEqual([H, H]);
      useScene.getState().setVoidState('ready');
      expect(storyFrame.target).toBe(5);
    });
  });

  describe('a failed void: the hold stands, and the end page is reached and left by the step fade', () => {
    it('failed: goToEnd places the story at 7 by a fade, and ArrowUp at the top goes back to the hold by a fade', async () => {
      const s = wiredHome(H);
      goToEnd();
      expect(storyFrame.target).toBe(STORY_END);
      await flush(); // the first move fetches damp
      byFade(s.run(), H, STORY_END);
      expect(useScene.getState().phase.kind).toBe('END');
      expect(s.frames.size).toBe(0);

      s.endView('rest');
      expect(s.key('ArrowUp').defaultPrevented).toBe(true);
      expect(storyFrame.target).toBe(H);
      byFade(s.run(), STORY_END, H);
      expect(useScene.getState().phase.kind).toBe('LIGHT');
      expect(s.frames.size).toBe(0);
    });

    it('failed: a long wheel down rests at the hold, and a swipe up the glass too, from the home or from BOB from above', async () => {
      for (const at of [0, 1]) {
        const s = wiredHome(at);
        const seen = [...(await s.wheel(40, 120)).seen, ...s.run()];
        expect([storyFrame.target, storyFrame.progress], `a wheel from ${at}`).toEqual([H, H]);
        expect(Math.max(...seen.map((f) => f.progress))).toBeLessThanOrEqual(H);
        expect(seen.some((f) => f.dark)).toBe(false);
        const swiped = [...(await s.swipe(-600)).seen, ...s.run()];
        expect([storyFrame.target, storyFrame.progress], `a swipe from ${at}`).toEqual([H, H]);
        expect(swiped.some((f) => f.dark)).toBe(false);
        s.disconnect();
        vi.unstubAllGlobals();
      }
    });

    it('failed: ArrowDown, PageDown, Space and End from the hold go to the end page by the fade; from the home End does too', async () => {
      for (const k of ['ArrowDown', 'PageDown', ' ', 'End']) {
        const s = wiredHome(H);
        expect(s.key(k).defaultPrevented, k).toBe(true);
        expect(storyFrame.target, k).toBe(STORY_END);
        await flush();
        byFade(s.run(), H, STORY_END);
        s.disconnect();
        vi.unstubAllGlobals();
      }
      const s = wiredHome(0);
      s.key('End');
      await flush();
      byFade(s.run(), 0, STORY_END);
    });

    it('failed: a key from BOB from above steps to fact 01, travelled, with no fade; the fall still plays', async () => {
      const s = wiredHome(1);
      s.key('ArrowDown');
      expect(storyFrame.target).toBe(F81);
      await flush();
      const seen = s.run();
      expect(seen.some((f) => f.dark)).toBe(false);
      expect(seen.some((f) => f.progress > 1 && f.progress < F81)).toBe(true);
    });

    it('failed: a key from the last fact steps to the hold, travelled, with no fade', async () => {
      const s = wiredHome(F241);
      s.key('ArrowDown');
      expect(storyFrame.target).toBe(H);
      await flush();
      const seen = s.run();
      expect(seen.some((f) => f.dark)).toBe(false);
      expect(seen.some((f) => f.progress > F241 && f.progress < H)).toBe(true);
    });

    it('failed: the rise stays the rise: a key or a wheel from the home moves up it by distance, with no fade', async () => {
      const s = wiredHome(0);
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

    it('failed: at the end page a wheel gesture up from the top goes back to the hold by the fade, and the rest of it takes no other step', async () => {
      const s = wiredHome(H);
      await s.toEndPage();
      const { seen, prevented } = await s.wheel(12, -120); // one gesture, a notch a frame
      expect(prevented).toEqual(Array(12).fill(true)); // the story's from its first event to its last: none scrolls the page
      expect(storyFrame.target).toBe(H);
      byFade([...seen, ...s.run()], STORY_END, H);
      expect(s.win.scrollY).toBe(0);
      for (let i = 0; i < 30; i++) s.frames.frame();
      expect([storyFrame.target, storyFrame.progress]).toEqual([H, H]);
    });

    it('failed: at the end page a swipe down the glass from the top goes back to the hold by the fade, with no glide after it', async () => {
      const s = wiredHome(H);
      await s.toEndPage();
      const { seen, prevented } = await s.swipe(400);
      expect(prevented).toEqual(Array(10).fill(true));
      expect(storyFrame.target).toBe(H);
      byFade([...seen, ...s.run()], STORY_END, H);
      expect(s.frames.size).toBe(0);
    });

    it("failed: a finger that wavers under the slop at the end page's top leaves the story at the end, with no fade", async () => {
      const s = wiredHome(H);
      await s.toEndPage();
      // 30 px down the glass, under SETTLE_SLOP_PX (40), held still before the lift: a waver, or a pull-to-refresh reflex.
      const waver = await s.swipe(30, 300);
      expect(waver.prevented.some(Boolean)).toBe(true);
      expect(storyFrame.target).toBe(STORY_END);
      const still = [...waver.seen, ...s.run()];
      expect(still.every((f) => f.progress === STORY_END && !f.dark)).toBe(true);
      expect(s.win.scrollY).toBe(0);
      const past = await s.swipe(80, 300);
      expect(storyFrame.target).toBe(H);
      const all = [...past.seen, ...s.run()];
      const faded = all.findIndex((f) => f.dark);
      expect(faded).toBeGreaterThan(0);
      expect(all.slice(0, faded).every((f) => f.progress === STORY_END)).toBe(true);
      byFade(all.slice(faded), STORY_END, H);
    });

    it("failed: PageUp and Shift+Space at the top go back to the hold by the fade; down at the end page, and up while it is scrolled, are the page's", async () => {
      type Press = (s: ReturnType<typeof wiredHome>) => Event;
      const presses: Press[] = [(s) => s.key('PageUp'), (s) => s.key(' ', true)];
      for (const press of presses) {
        const s = wiredHome(H);
        await s.toEndPage();
        s.win.scrollY = 300;
        expect(s.key('ArrowUp').defaultPrevented).toBe(false);
        s.win.scrollY = 0;
        for (const k of ['ArrowDown', 'PageDown', ' ', 'End']) expect(s.key(k).defaultPrevented, k).toBe(false);
        expect(storyFrame.target).toBe(STORY_END);
        expect(press(s).defaultPrevented).toBe(true);
        expect(storyFrame.target).toBe(H);
        byFade(s.run(), STORY_END, H);
        s.disconnect();
        vi.unstubAllGlobals();
      }
    });

    it('failed: Home from the end page goes to the home by the fade, the page back at its top first', async () => {
      const s = wiredHome(H);
      await s.toEndPage();
      s.win.scrollY = 300;
      expect(s.key('Home').defaultPrevented).toBe(true);
      expect([s.win.scrolls, s.win.scrollY]).toEqual([1, 0]);
      expect(storyFrame.target).toBe(0);
      byFade(s.run(), STORY_END, 0);
      expect(useScene.getState().phase.kind).toBe('HOME_IDLE');
    });

    it('failed: a story that turns back before the host is dark lets the fade go, and nothing jumps', async () => {
      const s = wiredHome(H);
      goToEnd();
      await flush();
      s.frames.frame();
      s.frames.frame();
      expect([storyFrame.progress, s.dark()]).toEqual([H, true]);
      expect(s.key('ArrowUp').defaultPrevented).toBe(true); // not yet at rest at the end: the story's
      expect(storyFrame.target).toBe(H);
      const seen = s.run();
      expect(seen.every((f) => f.progress === H)).toBe(true);
      expect(seen.at(-1)?.dark).toBe(false);
      expect(s.frames.size).toBe(0);
    });

    it('failed: a wheel down at the end page while it is on its way keeps it there: a story at the end is not held back', async () => {
      const s = wiredHome(H);
      goToEnd();
      await flush();
      s.frames.frame();
      s.endView(null); // on its way: nothing yields to the page
      const { prevented } = await s.wheel(3, 120);
      expect(prevented).toEqual([true, true, true]);
      expect(storyFrame.target).toBe(STORY_END);
      s.run();
      expect([storyFrame.target, storyFrame.progress]).toEqual([STORY_END, STORY_END]);
    });

    it('failed: a story already at the end page when the scroll connects stays there; one at a bead is held at the hold', () => {
      wiredHome(STORY_END);
      expect([storyFrame.target, storyFrame.progress]).toEqual([STORY_END, STORY_END]);
      for (const disconnect of left.splice(0)) disconnect();
      vi.unstubAllGlobals();
      wiredHome(4);
      expect([storyFrame.target, storyFrame.progress]).toEqual([H, H]);
    });

    it('failed: 3D switched off under a fade lets it go, and leaving the home takes it away: the host is never left dark', async () => {
      const s = wiredHome(H);
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

      const t = wiredHome(H);
      goToEnd();
      await flush();
      t.frames.frame();
      expect(t.dark()).toBe(true);
      t.disconnect();
      expect(t.dark()).toBe(false);
      expect(t.frames.size).toBe(0);
      storyFrame.target = storyFrame.progress = H; // as the route sync might leave it
      goToEnd(); // no home scroll connected: nothing moves
      expect([storyFrame.target, storyFrame.progress]).toEqual([H, H]);
      expect(t.frames.size).toBe(0);
    });

    it('failed with reduced motion: a wheel step at the hold is held there, asking for Funcial, never the end page; when the void is back after 3D off and on, it goes on to 4', async () => {
      const s = wiredHome(H, { reduced: true });
      const held = await s.wheel(1, 120);
      expect(held.prevented).toEqual([true]);
      s.run();
      expect([storyFrame.target, storyFrame.progress]).toEqual([H, H]);
      useScene.setState({ threeD: false });
      useScene.getState().setVoidState('idle');
      useScene.setState({ threeD: true });
      useScene.getState().setVoidState('loading');
      s.run();
      expect(storyFrame.target).toBe(placeOfFrame(241)); // reduced motion's hold: the last key stop under it
      useScene.getState().setVoidState('ready');
      expect(storyFrame.target).toBe(4);
      await flush();
      s.run();
      expect([storyFrame.target, storyFrame.progress]).toEqual([4, 4]);
    });

    it('failed with reduced motion: a key steps from the hold to the end page, a notch up steps back, never between; Home fades the scene (the input sets no fade)', async () => {
      const s = wiredHome(H, { reduced: true });
      expect(s.key('ArrowDown').defaultPrevented).toBe(true);
      expect(storyFrame.target).toBe(STORY_END);
      const fade = stepFadeFrom(H);
      stepFadeAt(fade, nearestStop(stops(HOME_CHAPTERS), storyFrame.target), true, 0);
      expect(fade).toEqual({ shown: H, next: STORY_END, darkAt: STEP_FADE_MS });
      await flush();
      const down = s.run();
      expect(down.filter((f) => f.progress !== H && f.progress !== STORY_END)).toEqual([]);
      expect(down.at(-1)?.progress).toBe(STORY_END);
      expect(down.some((f) => f.dark)).toBe(false);
      s.endView('rest');
      const back = await s.wheel(1, -120);
      expect(back.prevented).toEqual([true]);
      expect(storyFrame.target).toBe(H);
      const up = [...back.seen, ...s.run()];
      expect(up.filter((f) => f.progress !== H && f.progress !== STORY_END)).toEqual([]);
      expect(storyFrame.progress).toBe(H);
    });

    it('ready: a key travels to the next fact with no fade, and End fades to the end page', async () => {
      const s = wiredHome(1, { voidState: 'ready' });
      s.key('ArrowDown');
      expect(storyFrame.target).toBe(placeOfFrame(81));
      await flush();
      const seen = s.run();
      expect(seen.some((f) => f.dark)).toBe(false);
      expect(seen.some((f) => f.progress > 1 && f.progress < placeOfFrame(81))).toBe(true);
      s.key('End');
      expect(storyFrame.target).toBe(STORY_END);
      byFade(s.run(), placeOfFrame(81), STORY_END);
    });
  });

  describe("goToTop, the header's name on the home: the Home key's own path", () => {
    /**
     * The story at rest at the end page, the void `voidState`, the page scrolled `scrollY` down; `order` notes where the
     * story's target stood each time the page was sent to its top.
     */
    const atEnd = (voidState: VoidState, scrollY: number) => {
      delete (storyFrame as { __damp?: unknown }).__damp;
      const s = wiredHome(STORY_END, { voidState });
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

    it('takes the story from the end page, scrolled down, to 0 as the Home key does: the page to its top first, then the fade', async () => {
      const byName = atEnd('ready', 300);
      expect(goToTop()).toBe(true);
      expect(byName.order, 'the page went to its top before the story moved').toEqual([STORY_END]);
      expect([byName.s.win.scrollY, storyFrame.target]).toEqual([0, 0]);
      await flush();
      const named = byName.s.run();
      byFade(named, STORY_END, 0);
      expect(useScene.getState().phase.kind).toBe('HOME_IDLE');
      byName.s.disconnect();
      vi.unstubAllGlobals();

      const byKey = atEnd('ready', 300);
      expect(byKey.s.key('Home').defaultPrevented).toBe(true);
      expect(byKey.order).toEqual([STORY_END]);
      await flush();
      expect(byKey.s.run(), "frame for frame the Home key's own move").toEqual(named);
    });

    it('failed: from the end page it goes to 0 by the fade, as the Home key does', async () => {
      const { s } = atEnd('failed', 300);
      expect(goToTop()).toBe(true);
      expect([s.win.scrollY, storyFrame.target]).toEqual([0, 0]);
      await flush();
      byFade(s.run(), STORY_END, 0);
      expect(useScene.getState().phase.kind).toBe('HOME_IDLE');
    });

    it('answers false and moves nothing with no home scroll connected, with 3D off, or off the scroll (a bead opening)', () => {
      const { s } = atEnd('ready', 300);
      useScene.setState({ threeD: false });
      expect(goToTop(), '3D off').toBe(false);
      expect([storyFrame.target, s.win.scrollY]).toEqual([STORY_END, 300]);
      useScene.setState({ threeD: true, phase: { kind: 'PROJECT_FOCUS', id: 'funcial' } });
      expect(goToTop(), 'a bead opening').toBe(false);
      expect([storyFrame.target, s.win.scrollY]).toEqual([STORY_END, 300]);
      s.disconnect();
      expect(goToTop(), 'nothing connected').toBe(false);
      expect([storyFrame.target, s.win.scrollY]).toEqual([STORY_END, 300]);
      expect(s.frames.size).toBe(0);
    });

    it("answers false while a skipped loader's tail is dropped, moving nothing, so the name is left to navigate as a link", () => {
      const { s } = atEnd('ready', 300);
      storyFrame.loaderSkipEndsMs = performance.now();
      expect(goToTop()).toBe(false);
      expect([storyFrame.target, s.win.scrollY]).toEqual([STORY_END, 300]);
      expect(s.frames.size).toBe(0);
    });
  });

  describe("goToEnd, the nav's link: End's own path, whatever the void's state", () => {
    it('ready: from the home it fades the story to 7, frame for frame as End does, headed there until it rests', async () => {
      delete (storyFrame as { __damp?: unknown }).__damp;
      const s = wiredHome(0, { voidState: 'ready' });
      expect(goToEnd()).toBe(true);
      expect(storyFrame.target).toBe(STORY_END);
      expect(headedToEnd()).toBe(true);
      await flush();
      const linked = s.run();
      byFade(linked, 0, STORY_END);
      expect(useScene.getState().phase.kind).toBe('END');
      s.disconnect();
      vi.unstubAllGlobals();

      delete (storyFrame as { __damp?: unknown }).__damp;
      const t = wiredHome(0, { voidState: 'ready' });
      expect(t.key('End').defaultPrevented).toBe(true);
      await flush();
      expect(t.run(), "frame for frame the End key's own move").toEqual(linked);
    });

    it("is no longer headed for the end once the story's target leaves it: Home before the fade is dark", async () => {
      const s = wiredHome(2, { voidState: 'ready' });
      goToEnd();
      await flush();
      s.frames.frame();
      expect(headedToEnd()).toBe(true);
      s.key('Home');
      expect(storyFrame.target).toBe(0);
      expect(headedToEnd()).toBe(false);
    });

    it('loading: the hold keeps it short of the landing, headed for the end all the while, and the beads ready take it on to 7 by the fade', async () => {
      const s = wiredHome(1, { voidState: 'loading' });
      expect(goToEnd()).toBe(true);
      expect(storyFrame.target).toBe(H);
      expect(headedToEnd()).toBe(true);
      await flush();
      s.run();
      expect([storyFrame.target, storyFrame.progress]).toEqual([H, H]);
      expect(headedToEnd(), 'held, still asked for').toBe(true);
      useScene.getState().setVoidState('ready');
      expect(storyFrame.target).toBe(STORY_END);
      byFade(s.run(), H, STORY_END);
    });

    it('loading, then failed: the hold stays and lets the end go, so it is headed there no more', async () => {
      const s = wiredHome(1, { voidState: 'loading' });
      goToEnd();
      await flush();
      s.run();
      useScene.getState().setVoidState('failed');
      expect(storyFrame.target).toBe(H);
      expect(headedToEnd()).toBe(false);
    });

    it('reduced motion: the target is on 7 at once and the input sets no fade of its own (Home fades the scene there)', async () => {
      const s = wiredHome(0, { voidState: 'ready', reduced: true });
      expect(goToEnd()).toBe(true);
      expect(storyFrame.target).toBe(STORY_END);
      expect(headedToEnd()).toBe(true);
      await flush();
      expect(s.run().some((f) => f.dark)).toBe(false);
    });

    it("answers false and moves nothing with 3D off, off the scroll, while a skipped loader's tail is dropped, or with nothing connected", () => {
      const s = wiredHome(1, { voidState: 'ready' });
      useScene.setState({ threeD: false });
      expect(goToEnd(), '3D off').toBe(false);
      expect(headedToEnd(), '3D off').toBe(false);
      useScene.setState({ threeD: true, phase: { kind: 'PROJECT_FOCUS', id: 'funcial' } });
      expect(goToEnd(), 'a bead opening').toBe(false);
      useScene.setState({ phase: { kind: 'LIGHT' } });
      storyFrame.loaderSkipEndsMs = performance.now();
      expect(goToEnd(), 'a skipped loader').toBe(false);
      expect([storyFrame.target, storyFrame.progress]).toEqual([1, 1]);
      expect(headedToEnd()).toBe(false);
      s.disconnect();
      storyFrame.loaderSkipEndsMs = null;
      expect(goToEnd(), 'nothing connected').toBe(false);
      expect(headedToEnd(), 'nothing connected').toBe(false);
      expect(s.frames.size).toBe(0);
    });
  });

  describe('the arrival at the end page: on it exactly, and at rest', () => {
    it('from 6, ArrowDown glides to 7 and rests on it: progress exactly 7, no velocity, END, no frame asked for after', async () => {
      const s = wiredHome(6, { voidState: 'ready' });
      expect(s.key('ArrowDown').defaultPrevented).toBe(true);
      expect(storyFrame.target).toBe(STORY_END);
      await flush();
      const seen = s.run();
      expect(s.frames.size, 'the loop sleeps').toBe(0);
      expect([storyFrame.target, storyFrame.progress, storyFrame.velocity]).toEqual([STORY_END, STORY_END, 0]);
      expect(useScene.getState().phase.kind).toBe('END');
      expect(seen.length / 60).toBeLessThan(1.3);
    });

    it('lands a story left within 0.01 of the end, still headed there, on its first frame: a home that comes back to it does not leave it short', async () => {
      const s = wiredHome(6.995, { voidState: 'ready', target: STORY_END });
      await flush();
      expect(s.frames.size, 'the loop has asked for a frame').toBe(1);
      const seen = s.run();
      expect(seen.map((f) => f.progress)).toEqual([STORY_END]);
      expect([storyFrame.target, storyFrame.progress, storyFrame.velocity]).toEqual([STORY_END, STORY_END, 0]);
      expect(useScene.getState().phase.kind).toBe('END');
    });

    it('does not snap a turn back short of the end: ArrowUp at 6.98 on the way in glides back to 6, never at 7', async () => {
      const s = wiredHome(6, { voidState: 'ready' });
      s.key('ArrowDown');
      await flush();
      for (let i = 0; i < 600 && storyFrame.progress < 6.98; i++) s.frames.frame();
      expect(storyFrame.progress).toBeGreaterThanOrEqual(6.98);
      expect(storyFrame.progress).toBeLessThan(STORY_END);
      s.key('ArrowUp');
      expect(storyFrame.target).toBe(6);
      const seen = s.run();
      expect(seen.some((f) => f.progress === STORY_END), 'a frame on the end page').toBe(false);
      expect([storyFrame.target, storyFrame.progress, storyFrame.velocity]).toEqual([6, 6, 0]);
    });
  });
});

describe('reduced motion and the end page', () => {
  it('reduced motion: one wheel step from 6 goes to 7 by a fade, and one up goes back to 6', async () => {
    const s = setup({ reduced: true });
    restAt(s, 6);
    // Home's step fade, as it runs it on each frame it poses (src/scene/bob/Home.tsx): the stop the target is nearest.
    const fade = stepFadeFrom(6);
    const shown = (now: number): number => stepFadeAt(fade, nearestStop(stops(chapters), s.frame.target), true, now).shown;

    await wheelNotches(s, 10, 120, 16); // one gesture: one step
    expect(s.frame.target).toBe(END);
    expect(shown(0)).toBe(6); // the host fades down, the scene still at Cookies Clicker
    expect(fade.darkAt).toBe(STEP_FADE_MS);
    expect(shown(STEP_FADE_MS - 1)).toBe(6);
    expect(shown(STEP_FADE_MS)).toBe(END); // dark: the scene is at the end page, and the host fades back
    expect(fade.darkAt).toBeNull();
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([END, END]);

    await wheelNotches(s, 10, -120, 16);
    expect(s.frame.target).toBe(6);
    const at = 10_000;
    expect(shown(at)).toBe(END);
    expect(fade.darkAt).toBe(at + STEP_FADE_MS);
    expect(shown(at + STEP_FADE_MS)).toBe(6);
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([6, 6]);
  });
});

// ---------------------------------------------------------------- the ring's drag

describe("the ring's drag: a sideways drag turns the ring as a scroll would", () => {
  /** A mouse pressed at x 100 and moved `dx` to the side in ten steps, a frame after each; let go unless `hold`. */
  async function mouseDrag(s: Setup, dx: number, hold = false): Promise<void> {
    const at = (type: string, x: number) => fire(s.el, type, { pointerType: 'mouse', pointerId: 1, button: 0, clientX: x, clientY: 400, target: { closest: () => null } });
    at('pointerdown', 100);
    for (let i = 1; i <= 10; i++) {
      at('pointermove', 100 + (dx * i) / 10);
      if (i === 1) await flush();
      s.frames.frame();
    }
    if (!hold) at('pointerup', 100 + dx);
  }

  it('moves the target 0.25 degrees a px of a mouse drag in the ring: 300 px right is 0.625 of a unit', async () => {
    const s = setup();
    restAt(s, 4);
    await mouseDrag(s, 300);
    expect(s.frame.target).toBeCloseTo(4.625, 12);
    s.drain();
    expect(s.frame.progress).toBe(s.frame.target);
  });

  it('stops a drag at Cookies Clicker and at Funcial', async () => {
    const s = setup();
    restAt(s, 6);
    await mouseDrag(s, 300);
    expect(s.frame.target).toBe(6);
    restAt(s, 4);
    await mouseDrag(s, -300);
    expect(s.frame.target).toBe(4);
  });

  it('settles nothing on release: the target is where the drag left it 2 s on', async () => {
    const s = setup();
    restAt(s, 4);
    await mouseDrag(s, 200);
    const at = s.frame.target;
    for (let i = 0; i < 120; i++) s.frames.frame();
    expect(s.frame.target).toBe(at);
    expect(s.frame.progress).toBe(at);
  });

  it('does nothing for a key pressed during a drag', async () => {
    const s = setup();
    restAt(s, 4);
    await mouseDrag(s, 120, true);
    const at = s.frame.target;
    s.key('ArrowDown');
    expect(s.frame.target).toBe(at);
    expect(s.home.loop.tweening).toBeNull();
  });

  it('takes no drag in the light dive, nor with reduced motion', async () => {
    const s = setup();
    restAt(s, 2);
    await mouseDrag(s, 300);
    expect(s.frame.target).toBe(2);
    const r = setup({ reduced: true });
    restAt(r, 4);
    await mouseDrag(r, 300);
    expect(r.frame.target).toBe(4);
  });

  it('takes the story from a glide where it stands: the hand has it', async () => {
    const s = setup();
    restAt(s, 4);
    s.key('ArrowDown'); // a glide to 5
    await flush();
    frames(s, 20);
    const at = s.frame.progress;
    const press = (type: string, x: number) => fire(s.el, type, { pointerType: 'mouse', pointerId: 1, button: 0, clientX: x, clientY: 400, target: { closest: () => null } });
    press('pointerdown', 100);
    press('pointermove', 148); // past the lock at once: 0.1 of a unit
    expect(s.home.loop.tweening).toBeNull();
    expect(s.frame.target).toBeCloseTo(at + 0.1, 12);
    press('pointerup', 148);
  });
});
