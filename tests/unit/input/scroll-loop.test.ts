import { damp } from 'maath/easing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GESTURE_GAP_MS } from '../../../src/input/gesture';
import { Inertia } from '../../../src/input/Inertia';
import { SKIP_QUIET_MS, skipSwallower } from '../../../src/input/loaderSkip';
import { easeInOutQuart, FOLLOW, follow, GLIDE_MIN_S, GLIDE_S, QA_GLIDE_S, QA_LOCK_MS, RISE_SMOOTH, type Smooth, smoothTimeAt, startHomeScroll, type TweenKind, turnTime } from '../../../src/input/scrollLoop';
import { connectHomeScroll, goToEnd, goToTop, headedToEnd } from '../../../src/input/useHomeScroll';
import { LANDING_HOLD } from '../../../src/scene/bob/landingHold';
import { nearestStop, STEP_FADE_MS, stepFadeAt, stepFadeFrom } from '../../../src/scene/bob/stepFade';
import { areaStop, buildChapters, type ChapterAt, chapterAt, FALL_PACE, HOME_CHAPTERS, pathStart, placeOfFrame, qaStop, scrollEnd, lookStop, stops, worldStop } from '../../../src/state/chapters';
import { frame as storyFrame } from '../../../src/state/frame';
import { useScene, type VoidState } from '../../../src/state/store';

/** A viewport 1000 px high: a unit of scroll is 1000 px. */
const VH = 1000;
const FRAME_MS = 1000 / 60;
// The home's own layout: HOME 0-1, LIGHT to the hand-over (frame 256), the land, an area per category, LOOK, SHEET, END.
const chapters = buildChapters({ areas: (['a', 'b', 'c'] as const).map((category) => ({ category: category as never, projects: [] })) });
const END = scrollEnd(chapters);
/** The hand-over (way frame 256): the path's start, and the landing hold. */
const L = pathStart(chapters);
/** The first three stops past the fall: the world's, then the first two areas'. */
const A0 = worldStop(chapters);
const A1 = areaStop(chapters, 'a');
const A2 = areaStop(chapters, 'b');
/** The look back's own stop: the sheet's start, where the credits begin to rise. */
const S = lookStop(chapters);
/** The chapters' indices of the land (the world's stop is inside it), the first QA unit's and the end's. */
const INDEX = { land: 2, qa: 7, end: 14 } as const;
/** The first question's stop on the ring, the end of the first QA unit. */
const Q0 = qaStop(chapters, 0);
/** The first fact's place, the light dive's frame 81: the first key stop past BOB from above. */
const F81 = placeOfFrame(81);
/** The last fact's place, frame 241: the key stop before Steady's. */
const F241 = placeOfFrame(241);
/** The landing hold: the most the scroll reaches while the beads load, or if they failed. */
const H = LANDING_HOLD;
/** The follow's floor, units a second: 12 of the light dive's 300 frames a second, at the fall's pace. */
const FLOOR = (FOLLOW.floorFramesPerSecond * FALL_PACE) / 299;

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
    now: () => frames.now,
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
  tween: TweenKind | null;
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

  it('reads a story at rest as the chapter it stopped in', async () => {
    const s = setup({ reduced: true });
    restAt(s, F241);
    s.key('PageDown'); // reduced motion: the next key stop, the world's
    await flush();
    s.drain();
    expect(s.frame.progress).toBe(A0);
    expect(s.frame.chapterIndex).toBe(INDEX.land);
    expect(s.changes.at(-1)).toMatchObject({ index: INDEX.land, id: 'LAND', category: null });
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

  it("glides on past the rise as a page would, resting where it ends, and ends one that reaches the look back's stop", async () => {
    const alone = glideAlone();
    const s = setup();
    restAt(s, L + 5.26);
    await s.swipe(-1); // 0.4 dragged, to L + 5.66, then the glide
    expect(s.home.scroll.busy).toBe(true);
    s.drain();
    expect(s.frame.target).toBeCloseTo(L + 5.66 + alone.px / VH, 6); // on the world, between two stops: no stop
    expect(s.frame.progress).toBe(s.frame.target);
    // Caught at the look back's stop: past it the Q&A goes a question a step.
    restAt(s, S - 0.8);
    await s.swipe(-1);
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([S, S]);
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
    restAt(s, L + 0.44); // on the way down to the world
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
  it("still arrives: End fades to the end's mark, the chapter in step, and says nothing", async () => {
    const quiet = [vi.spyOn(console, 'error'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'log')];
    const s = setup({ loadSmooth: () => Promise.reject(new Error('chunk failed')) });
    s.key('End');
    await flush();
    s.drain();
    expect(s.frame.progress).toBe(END);
    expect(s.frame.chapterIndex).toBe(INDEX.end);
    expect(s.changes.at(-1)).toMatchObject({ index: INDEX.end, id: 'END', category: null });
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
    s.frame.target = 3; // a step of a unit, as a long wheel turn would make it (60 of the fall's frames)
    s.home.loop.wake();
    await flush();
    const seen = frames(s, 60); // one second of frames
    const covered = (seen.at(-1)!.progress - 2) / 1;
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

  it('rests where a wheel stops, in the light dive and on the path: no settle on a stop', async () => {
    const s = setup();
    restAt(s, 1);
    await wheelNotches(s, 13, 100);
    s.drain();
    expect(s.frame.target).toBeCloseTo(2.3, 12);
    expect(s.frame.progress).toBe(s.frame.target);
    await wheelNotches(s, 49, 100);
    s.drain();
    expect(s.frame.target).toBeCloseTo(7.2, 12);
    expect(s.frame.progress).toBe(s.frame.target);
    expect(s.changes.at(-1)).toMatchObject({ id: 'LAND', category: null });
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

  it("glides a key past the light dive: from Steady's arrival to Jontai Energy's in 1.2 s × √d, eased from rest, its peak 1.25 √d a second", async () => {
    expect([GLIDE_S, GLIDE_MIN_S]).toEqual([1.2, 0.6]);
    const s = setup();
    restAt(s, A0);
    s.key('ArrowDown');
    expect([s.frame.target, s.home.loop.tweening, s.home.loop.heading]).toEqual([A1, 'glide', A1]);
    await flush();
    const seen = frames(s);
    expect([s.frame.target, s.frame.progress, s.frame.velocity]).toEqual([A1, A1, 0]);
    expect(Math.abs(seen.length * FRAME_MS - 1000 * GLIDE_S * Math.sqrt(A1 - A0))).toBeLessThanOrEqual(2 * FRAME_MS);
    expect(seen[0]!.velocity).toBeLessThan(0.1);
    // The glide's law sets its peak: about 1.5 times its mean, √d / 1.2 (1.9 a second across the 2.35 from one arrival to the next).
    expect(Math.max(...seen.map((f) => f.velocity))).toBeLessThanOrEqual(1.25 * Math.sqrt(A1 - A0) * 1.01);
  });

  it("counts a second press from where the glide is going: two presses 300 ms apart rest on Cookies Clicker's arrival", async () => {
    const s = setup();
    restAt(s, A0);
    s.key('ArrowDown');
    await flush();
    frames(s, 18);
    s.key('ArrowDown');
    expect([s.frame.target, s.home.loop.heading]).toEqual([A2, A2]);
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([A2, A2]);
  });

  it("glides onto the path from the last fact, to Steady's arrival, and back off it to the last fact", async () => {
    const s = setup();
    restAt(s, F241);
    s.key('ArrowDown');
    expect([s.frame.target, s.home.loop.tweening]).toEqual([A0, 'glide']);
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
    restAt(s, A0);
    s.key('ArrowDown');
    for (let i = 0; i < 10; i++) fire(s.win, 'keydown', { key: 'ArrowDown', shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, repeat: true, isComposing: false, target: { tagName: 'BODY' } });
    expect(s.frame.target).toBe(A1);
  });

  it("steps a key from a wheel stopped past an area's stop to the next area's", async () => {
    const s = setup();
    restAt(s, L + 4.66); // past the first area's stop, short of the second
    s.key('ArrowDown');
    expect(s.frame.target).toBe(A2);
    s.key('ArrowUp');
    expect(s.frame.target).toBe(A1); // counted from where the glide is going, the second area's stop
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

  it("goes to a place by a key's glide (the areas' dots), and steps there with reduced motion; nothing with 3D off", async () => {
    const s = setup();
    restAt(s, A0);
    expect(s.home.toPlace(A2)).toBe(true);
    expect(s.frame.target).toBe(A2);
    await flush();
    s.frames.frame();
    expect(s.home.loop.tweening).toBe('glide');
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([A2, A2]);
    const reduced = setup({ reduced: true });
    restAt(reduced, A2);
    expect(reduced.home.toPlace(A0)).toBe(true);
    await flush(); // the first move fetches damp
    reduced.drain();
    expect([reduced.frame.target, reduced.frame.progress]).toEqual([A0, A0]);
    const off = setup({ threeD: false });
    restAt(off, A0);
    expect(off.home.toPlace(A2)).toBe(false);
    expect(off.frame.target).toBe(A0);
  });

  it('fades End to the end page from anywhere short of it: the rise, the light dive, the ring', async () => {
    for (const from of [0, 2.5, L + 1.57]) {
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
    for (const from of [L + 0.44, L + 4.60, END]) {
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
    restAt(s, areaStop(chapters, 'c'));
    s.key('ArrowDown'); // the look back
    expect(s.frame.target).toBe(S);
    expect(s.home.loop.tweening).toBeNull(); // no glide with reduced motion
    s.key('ArrowDown');
    expect(s.frame.target).toBe(Q0);
    restAt(s, END);
    s.key('ArrowDown'); // a step down from the end is none
    expect(s.frame.target).toBe(END);
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
    const disconnect = connectHomeScroll({ el: el as unknown as HTMLElement, unitPx: () => VH, request: frames.request, cancel: frames.cancel, loadSmooth: () => Promise.resolve(damp), now: () => frames.now });
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

  // A project's own page over the stack (spec 2026-10-29-bob-stack-2-design.md, goal 2): it scrolls on its own, and the
  // wheel, the keys and a swipe never take the visitor out (Escape, its way back and Back do).
  describe("a project's own page open: its scroll is the page's, and the story's comes back when it closes", () => {
    it('leaves every wheel, key and swipe to the open page, preventing none, and the story stays', async () => {
      const s = wiredHome(A0, { voidState: 'ready' });
      useScene.getState().setInside('steady');
      const wheeled = await s.wheel(5, 100);
      expect(wheeled.prevented.some(Boolean)).toBe(false);
      expect(s.key('ArrowDown').defaultPrevented).toBe(false);
      const swiped = await s.swipe(-200);
      expect(swiped.prevented.some(Boolean)).toBe(false);
      s.run();
      expect([storyFrame.target, storyFrame.progress]).toEqual([A0, A0]);
    });

    it("takes the story's scroll again once the page closes, by its way back", async () => {
      let now = 10_000;
      const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
      try {
        const s = wiredHome(A0, { voidState: 'ready' });
        useScene.getState().setInside('steady');
        useScene.getState().setInside(null); // Terug
        now += 2000;
        await s.wheel(3, 100);
        expect(storyFrame.target).toBeGreaterThan(A0);
      } finally {
        clock.mockRestore();
      }
    });
  });

  describe('the landing hold: the story waits at the hand-over, before the first project, while the beads load', () => {
    it("holds a wheel past it at LANDING_HOLD while loading, and the beads' ready takes it on to where the wheel went", async () => {
      expect(H).toBe(placeOfFrame(256)); // the hand-over
      const s = wiredHome(1, { voidState: 'loading' });
      await s.wheel(86, 100); // to 9.6, inside Steady: past its arrival, the next stop past the hold
      const held = s.run();
      expect([storyFrame.target, storyFrame.progress]).toEqual([H, H]);
      expect(Math.max(...held.map((f) => f.progress))).toBeLessThanOrEqual(H);
      useScene.getState().setVoidState('ready');
      expect(storyFrame.target).toBeCloseTo(9.6, 9);
      s.run();
      expect(storyFrame.progress).toBeCloseTo(9.6, 9);
      expect(useScene.getState().phase.kind).toBe('PROJECTS');
    });

    it("holds a key there too, and lets it on to Steady's arrival once ready", async () => {
      const s = wiredHome(placeOfFrame(241), { voidState: 'loading' });
      s.key('ArrowDown');
      expect(storyFrame.target).toBe(H);
      await flush();
      s.run();
      useScene.getState().setVoidState('ready');
      expect(storyFrame.target).toBe(A0);
      s.run();
      expect(storyFrame.progress).toBe(A0);
    });

    it('moves the story at once back up from the hold: nothing past it is kept as a debt', async () => {
      const s = wiredHome(1, { voidState: 'loading' });
      await s.wheel(60, 100);
      s.run();
      for (let ms = 0; ms <= GESTURE_GAP_MS; ms += FRAME_MS) s.frames.frame();
      await s.wheel(3, -100);
      expect(storyFrame.target).toBeCloseTo(H - 0.3, 9);
    });

    it("holds Back to a bead's stop at the hold while loading, then goes on to the stop once ready", async () => {
      wiredHome(A1, { voidState: 'loading' });
      expect([storyFrame.target, storyFrame.progress]).toEqual([H, H]);
      useScene.getState().setVoidState('ready');
      expect(storyFrame.target).toBe(A1);
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
      // The hold is the path's start, where the land begins: the projects' phase, no one project.
      expect(useScene.getState().phase).toEqual({ kind: 'PROJECTS', category: null });
      expect(s.frames.size).toBe(0);
    });

    it('failed: a long wheel down rests at the hold, and a swipe up the glass too, from the home or from BOB from above', async () => {
      for (const at of [0, 1]) {
        const s = wiredHome(at);
        const seen = [...(await s.wheel(60, 120)).seen, ...s.run()];
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
      const { seen, prevented } = await s.swipe(440); // each move past the 40 px slop, the first too
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
      wiredHome(A0);
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

    it("failed with reduced motion: a wheel step at the hold is held there, asking for Steady, never the end page; when the void is back after 3D off and on, it goes on to Steady's arrival", async () => {
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
      expect(storyFrame.target).toBe(A0);
      await flush();
      s.run();
      expect([storyFrame.target, storyFrame.progress]).toEqual([A0, A0]);
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
      useScene.setState({ threeD: true, phase: { kind: 'PROJECT_FOCUS', id: 'steady' } });
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
      useScene.setState({ threeD: true, phase: { kind: 'PROJECT_FOCUS', id: 'steady' } });
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

  describe('the arrival at the first question: on it exactly, and at rest', () => {
    it('from the look back, ArrowDown turns into the first question and rests on it: progress exactly on it, no velocity, no frame asked for after', async () => {
      const first = qaStop(HOME_CHAPTERS, 0);
      const s = wiredHome(S, { voidState: 'ready' });
      expect(s.key('ArrowDown').defaultPrevented).toBe(true);
      expect(storyFrame.target).toBe(first);
      await flush();
      const seen = s.run();
      expect(s.frames.size, 'the loop sleeps').toBe(0);
      expect([storyFrame.target, storyFrame.progress, storyFrame.velocity]).toEqual([first, first, 0]);
      expect(seen.length / 60).toBeLessThan(2.9);
    });

    it('does not snap a turn back short of the first question: ArrowUp at 0.98 of the way in turns back to the look back, never there', async () => {
      const first = qaStop(HOME_CHAPTERS, 0);
      const s = wiredHome(S, { voidState: 'ready' });
      s.key('ArrowDown');
      await flush();
      for (let i = 0; i < 600 && storyFrame.progress < S + 0.98; i++) s.frames.frame();
      expect(storyFrame.progress).toBeGreaterThanOrEqual(S + 0.98);
      expect(storyFrame.progress).toBeLessThan(first);
      s.key('ArrowUp');
      expect(storyFrame.target).toBe(S);
      const seen = s.run();
      expect(seen.some((f) => f.progress === first), 'a frame on the first question').toBe(false);
      expect([storyFrame.target, storyFrame.progress, storyFrame.velocity]).toEqual([S, S, 0]);
    });
  });
});

describe('reduced motion and the Q&A', () => {
  it('reduced motion: one wheel step from the look back goes to the first question by a fade, and one up goes back', async () => {
    const s = setup({ reduced: true });
    restAt(s, S);
    // Home's step fade, as it runs it on each frame it poses (src/scene/bob/Home.tsx): the stop the target is nearest.
    const fade = stepFadeFrom(S);
    const shown = (now: number): number => stepFadeAt(fade, nearestStop(stops(chapters), s.frame.target), true, now).shown;

    await wheelNotches(s, 10, 120, 16); // one gesture: one step
    expect(s.frame.target).toBe(Q0);
    expect(shown(0)).toBe(S); // the host fades down, the scene still at the look back
    expect(fade.darkAt).toBe(STEP_FADE_MS);
    expect(shown(STEP_FADE_MS - 1)).toBe(S);
    expect(shown(STEP_FADE_MS)).toBe(Q0); // dark: the scene is at the first question, and the host fades back
    expect(fade.darkAt).toBeNull();
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([Q0, Q0]);

    await wheelNotches(s, 10, -120, 16);
    expect(s.frame.target).toBe(S);
    const at = 10_000;
    expect(shown(at)).toBe(Q0);
    expect(fade.darkAt).toBe(at + STEP_FADE_MS);
    expect(shown(at + STEP_FADE_MS)).toBe(S);
    s.drain();
    expect([s.frame.target, s.frame.progress]).toEqual([S, S]);
  });
});

// ---------------------------------------------------------------- the Q&A on the ring

// The Q&A on the gold ring (spec 2026-10-29-bob-stack-2-design.md, goal 1): "rotating snaps and is slower". From the look
// back's stop every input is one step, turned slowly; input while a turn's lock holds is dropped. Round 10 (Bob,
// 2026-10-30): the steps are the list (mark 0) and the end; a question is opened from the list (`goToQa`).
describe('the Q&A, the list and the end a step each', () => {
  const q = (k: number) => qaStop(chapters, k);

  it('eases a turn in and out', () => {
    expect(easeInOutQuart(0)).toBe(0);
    expect(easeInOutQuart(0.25)).toBeCloseTo(0.03125, 12);
    expect(easeInOutQuart(0.5)).toBeCloseTo(0.5, 12);
    expect(easeInOutQuart(1)).toBe(1);
  });

  it('turns a question in about 1.9 s, and from the list to the end in one step of 2.6 s, eased in and out', async () => {
    expect(turnTime(q(0), q(1), chapters)).toBeCloseTo(1.1 + (0.9 * 2 * Math.PI) / 7, 9);
    expect(Math.abs(turnTime(q(0), q(1), chapters) - 1.906)).toBeLessThan(0.05);
    expect(turnTime(q(0), q(6), chapters)).toBe(2.6);
    const s = setup();
    restAt(s, q(0));
    await wheelNotches(s, 1);
    expect(s.frame.target).toBe(q(6));
    expect(s.home.loop.tweening).toBe('turn');
    const start = s.frames.now;
    const T = turnTime(q(0), q(6), chapters) * 1000;
    while (s.frames.now - start < T / 2) s.frames.frame();
    expect(s.frame.progress).toBeGreaterThan(q(0) + 0.35 * 6);
    expect(s.frame.progress).toBeLessThan(q(0) + 0.65 * 6);
    s.drain();
    expect(s.frame.progress).toBe(q(6));
  });

  it('glides into the Q&A in 2.8 s', () => {
    expect(QA_GLIDE_S).toBe(2.8);
    expect(turnTime(S, q(0), chapters)).toBe(2.8);
    expect(turnTime(q(0), S, chapters)).toBe(2.8);
  });

  it('takes one step for a burst of notches', async () => {
    const s = setup();
    restAt(s, S);
    await wheelNotches(s, 10, 120, 20);
    expect(s.frame.target).toBe(q(0));
  });

  it('drops input inside the lock', async () => {
    expect(QA_LOCK_MS).toBe(1500);
    const s = setup();
    restAt(s, q(0));
    await wheelNotches(s, 1);
    const start = s.frames.now;
    expect(s.frame.target).toBe(q(6));
    while (s.frames.now - start < 1000) s.frames.frame();
    await wheelNotches(s, 1, -120);
    expect(s.frame.target).toBe(q(6));
    while (s.frames.now - start < 1600) s.frames.frame();
    await wheelNotches(s, 1, -120);
    expect(s.frame.target).toBe(q(0));
  });

  it('steps a key from a question opened in the list on to the end, or back to the list', async () => {
    const s = setup();
    restAt(s, q(2));
    s.key('ArrowDown');
    await flush();
    expect(s.frame.target).toBe(q(6));
    expect(s.home.loop.tweening).toBe('turn');
    const t = setup();
    restAt(t, q(2));
    t.key('ArrowUp');
    await flush();
    expect(t.frame.target).toBe(q(0));
  });

  it('jumps with reduced motion', async () => {
    const s = setup({ reduced: true });
    restAt(s, q(0));
    await wheelNotches(s, 1);
    expect(s.frame.target).toBe(q(6));
    expect(s.home.loop.tweening).toBeNull();
  });

  it('turns by a drag and lets go onto the nearest stop, the list or the end', async () => {
    const s = setup();
    restAt(s, q(1));
    s.home.dragRing(0.7);
    expect(s.frame.target).toBeCloseTo(q(1) + 0.7, 12);
    expect(s.frame.progress).toBeCloseTo(q(1) + 0.7, 12);
    s.home.dragRing(-5);
    expect(s.frame.target).toBe(q(0)); // a drag never takes the ring off its questions, back into the look back
    s.home.dragRing(1.4);
    s.home.releaseRing();
    expect(s.frame.target).toBe(q(0));
    s.home.dragRing(4);
    s.home.releaseRing();
    expect(s.frame.target).toBe(q(6));
    expect(s.home.loop.tweening).toBe('turn');
  });
});
