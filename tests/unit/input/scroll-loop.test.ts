import { damp } from 'maath/easing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Inertia } from '../../../src/input/Inertia';
import { type Smooth, startHomeScroll } from '../../../src/input/scrollLoop';
import { buildChapters, type ChapterAt } from '../../../src/state/chapters';

/** A viewport 1000 px high: a unit of scroll is 1000 px. */
const VH = 1000;
const FRAME_MS = 1000 / 60;
const chapters = buildChapters({ parts: 11, categories: ['a', 'b', 'c'] }); // 18 units; stops 0, 1, 12, 14, 15, 16, 17, 18

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
  loadSmooth?: () => Promise<Smooth>;
}

function setup(options: SetupOptions = {}) {
  const frames = new FakeFrames();
  const frame = { progress: 0, target: 0, velocity: 0, chapterIndex: 0 };
  const state = { threeD: options.threeD ?? true, reduced: options.reduced ?? false };
  const changes: ChapterAt[] = [];
  const el = new EventTarget();
  const win = new EventTarget();
  Object.defineProperty(el, 'ownerDocument', { value: { defaultView: win } });
  const home = startHomeScroll({
    el: el as unknown as HTMLElement,
    frame,
    chapters,
    unitPx: () => VH,
    enabled: () => state.threeD,
    reducedMotion: () => state.reduced,
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

describe('the scroll loop: one frame pending at a time', () => {
  it('has at most one callback waiting through a whole touch glide', async () => {
    const s = setup();
    await s.swipe(-1);
    expect(s.frames.size).toBeLessThanOrEqual(1);
    const run = s.drain();
    expect(run.mostPending).toBe(1);
    expect(s.frames.size).toBe(0);
  });

  it('lasts as long as Inertia alone says, not a handful of frames', async () => {
    const alone = glideAlone();
    expect(alone.frames).toBeGreaterThan(60); // a flick of this speed glides for over a second
    const s = setup();
    await s.swipe(-1);
    const run = s.drain();
    expect(Math.abs(run.gliding - alone.frames)).toBeLessThanOrEqual(1);
    // and it carried exactly as far: the drag, then what Inertia alone carries
    expect(s.frame.target).toBeCloseTo(0.4 + alone.px / VH, 9);
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
    s.key('PageDown'); // 12
    s.drain();
    expect(s.frame.progress).toBe(12);
    expect(s.frame.chapterIndex).toBe(2);
    expect(s.changes.at(-1)).toMatchObject({ index: 2, id: 'MORPH' });
  });

  it('stops the glide when 3D is switched off, and the story stays where it is', async () => {
    const s = setup();
    await s.swipe(-1);
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

  it('ends the glide that reaches the end of the story', async () => {
    const s = setup();
    s.frame.target = 17.5;
    s.frame.progress = 17.5;
    s.frame.chapterIndex = 6;
    await s.swipe(-1); // 0.4 of a drag, then a glide that would carry another 0.4 or so
    const run = s.drain();
    expect(s.frame.target).toBe(18);
    expect(run.gliding).toBeLessThan(glideAlone().frames / 2);
    expect(s.home.scroll.busy).toBe(false);
    expect(s.frame.progress).toBe(18);
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

describe('the scroll loop: damp does not load', () => {
  it('snaps progress to the target and keeps the chapter in step, and says nothing', async () => {
    const quiet = [vi.spyOn(console, 'error'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'log')];
    const s = setup({ loadSmooth: () => Promise.reject(new Error('chunk failed')) });
    s.key('End');
    await flush();
    s.drain();
    expect(s.frame.progress).toBe(18);
    expect(s.frame.chapterIndex).toBe(6);
    expect(s.changes.at(-1)).toMatchObject({ index: 6, id: 'PROJECTS', category: 'c' });
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
