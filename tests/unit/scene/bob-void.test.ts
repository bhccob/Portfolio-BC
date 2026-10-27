import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { damp } from 'maath/easing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readGlbJson } from '~/engine/bob/glb';
import { readNeedleDebugState } from '~/debug/useNeedleDebug';
import { startHomeScroll } from '~/input/scrollLoop';
import { connectHomeScroll } from '~/input/useHomeScroll';
import { holdLimit, releaseTarget } from '~/input/target';
import { heldAtLanding, LANDING_HOLD, landingHoldFor, RISE_TOP } from '~/scene/bob/landingHold';
import { BEADS, journeyAt, journeyPoseAt } from '~/scene/bob/journey';
import { F, LIGHT_FRAMES } from '~/scene/bob/lightDive';
import { nearestStop } from '~/scene/bob/stepFade';
import { loadVoid } from '~/scene/bob/voidLoad';
import {
  easeHover,
  hoverEase,
  needleFor,
  needleGlowFor,
  pointerMode,
  selectedBead,
  VOID_FROM,
  voidShownAt,
  voidShownFor,
  wakeFor,
  writeJourney
} from '~/scene/bob/voidPose';
import * as THREE from 'three';
import { WAKE } from '~/engine/bob/beadBuild';
import { applyCameraShot, type CameraShot } from '~/engine/bob/shots';
import { pathFor } from '~/scene/bob/lightPath';
import { NavigationType } from 'react-router';
import { arrivalStop, chapterAt, HOME_CHAPTERS, keyStops, pathStart, placeOfFrame, scrollEnd, stops } from '~/state/chapters';
import { frame } from '~/state/frame';
import { BACK_STATE, resetRouteSync, stopForProject, syncRoute } from '~/state/routeSync';
import { useScene, type VoidState } from '~/state/store';

const LAPTOP = 16 / 9;
const PHONE = 390 / 844;
const SCREENS = [LAPTOP, PHONE] as const;
const KEY_STOPS = keyStops(HOME_CHAPTERS);
/** The end of the scroll: the credits' stop (nothing lies past it). */
const END = scrollEnd(HOME_CHAPTERS);
/** The path's start, the hand-over (way frame 256). */
const L = pathStart(HOME_CHAPTERS);
/** Each bead's stop: its arrival, the light at rest beside it (Funcial's, Jontai Energy's, Cookies Clicker's). */
const A0 = arrivalStop(HOME_CHAPTERS, 'secure-element');
const A1 = arrivalStop(HOME_CHAPTERS, 'front-panel');
const A2 = arrivalStop(HOME_CHAPTERS, 'oscillator');

// ---------------------------------------------------------------- the hold

/** The last fact's place, the light dive's frame 241: reduced motion's hold, the last key stop under the landing hold. */
const F241 = placeOfFrame(241);
/** The landing hold. */
const H = LANDING_HOLD;

describe('landingHoldFor: the most the scroll may reach before the beads are ready', () => {
  it('is LANDING_HOLD, the hand-over just before the first project, until the void is ready, failed included', () => {
    for (const state of ['idle', 'loading', 'failed'] as const) expect(landingHoldFor(state), state).toBe(H);
    expect(H).toBe(L);
    expect(H).toBe(placeOfFrame(256));
    expect(journeyAt(H)).toMatchObject({ stretch: 'travel', local: 0, project: 0 });
    for (const a of SCREENS) expect(journeyPoseAt(H, a).path!.beads.every((bead) => !bead.visible), 'the beads not yet in sight').toBe(true);
  });

  it("is the end of the scroll once the void is ready, the credits' stop: nothing holds", () => {
    expect(landingHoldFor('ready')).toBe(END);
    expect(END).toBeCloseTo(L + 15.55, 9);
  });

  it('answers a hold for every state, never above the end nor below the top of the rise', () => {
    for (const state of ['idle', 'loading', 'ready', 'failed'] as const satisfies readonly VoidState[]) {
      expect(landingHoldFor(state)).toBeGreaterThanOrEqual(RISE_TOP);
      expect(landingHoldFor(state)).toBeLessThanOrEqual(END);
    }
  });
});

describe('holdLimit and releaseTarget: the hold as the scroll input applies it', () => {
  it('is the hold itself without reduced motion, within the story', () => {
    expect(holdLimit(H, HOME_CHAPTERS, false)).toBe(H);
    expect(holdLimit(END, HOME_CHAPTERS, false)).toBe(END);
    expect(holdLimit(99, HOME_CHAPTERS, false)).toBe(END);
    expect(holdLimit(-1, HOME_CHAPTERS, false)).toBe(0);
    expect(holdLimit(Number.NaN, HOME_CHAPTERS, false)).toBe(END);
  });

  it('is the last key stop at or under the hold with reduced motion, which rests on stops alone', () => {
    expect(holdLimit(H, HOME_CHAPTERS, true)).toBe(F241);
    expect(holdLimit(1, HOME_CHAPTERS, true)).toBe(1);
    expect(holdLimit(END, HOME_CHAPTERS, true)).toBe(END);
    for (let hold = 0; hold <= END; hold += 0.125) expect(KEY_STOPS).toContain(holdLimit(hold, HOME_CHAPTERS, true));
  });

  it('goes on to the next key stop once the hold rises, or further where the input asked further, never past the new hold', () => {
    // A wheel that pressed a notch past the hold: on to Funcial's arrival.
    expect(releaseTarget(H, H + 0.1, END, HOME_CHAPTERS)).toBe(A0);
    // End, pressed while held: the end.
    expect(releaseTarget(H, END, END, HOME_CHAPTERS)).toBe(END);
    // A long wheel that asked for a place past Funcial's arrival: there.
    expect(releaseTarget(H, A0 + 0.4, END, HOME_CHAPTERS)).toBe(A0 + 0.4);
    // Reduced motion, held on the last fact and asked for Funcial: Funcial.
    expect(releaseTarget(F241, A0, END, HOME_CHAPTERS)).toBe(A0);
    // Never past the hold it is released to.
    expect(releaseTarget(H, END, L + 2, HOME_CHAPTERS)).toBe(L + 2);
  });
});

/** A viewport 1000 px high: a unit of scroll is 1000 px. */
const VH = 1000;
const FRAME_MS = 1000 / 60;

/** requestAnimationFrame on the test's own clock, a frame at a time. */
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
  get size(): number {
    return this.pending.size;
  }
  frame(): void {
    this.now += FRAME_MS;
    for (const id of [...this.pending.keys()]) {
      const callback = this.pending.get(id);
      if (!callback) continue;
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

/**
 * The home's scroll input on the real chapters, held by the void's state as the page's input is. `at` puts the story
 * somewhere before the input starts, as the route sync does on Back from a project page (src/state/routeSync.ts).
 */
function held(voidState: VoidState, options: { reduced?: boolean; at?: number } = {}) {
  const frames = new FakeFrames();
  const at = options.at ?? 0;
  const story = { progress: at, target: at, velocity: 0, chapterIndex: chapterAt(HOME_CHAPTERS, at).index };
  const chapters: string[] = [];
  const state = { voidState, reduced: options.reduced ?? false, threeD: true };
  const el = new EventTarget();
  const win = new EventTarget();
  Object.defineProperty(el, 'ownerDocument', { value: { defaultView: win } });
  const home = startHomeScroll({
    el: el as unknown as HTMLElement,
    frame: story,
    chapters: HOME_CHAPTERS,
    unitPx: () => VH,
    enabled: () => true,
    reducedMotion: () => state.reduced,
    threeD: () => state.threeD,
    hold: () => landingHoldFor(state.voidState),
    holdWaits: () => state.voidState !== 'failed',
    voidState: () => state.voidState,
    onChapter: (chapter) => chapters.push(chapter.id),
    loadSmooth: () => Promise.resolve(damp),
    request: frames.request,
    cancel: frames.cancel
  });
  const key = (k: string) =>
    fire(win, 'keydown', { key: k, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, repeat: false, isComposing: false, target: { tagName: 'BODY' } });
  const wheel = async (notches: number, px = 120): Promise<void> => {
    for (let i = 0; i < notches; i++) {
      fire(el, 'wheel', { deltaY: px, deltaMode: 0, ctrlKey: false, timeStamp: 16 * i });
      if (i === 0) await flush(); // the first fetches damp
      frames.frame();
    }
  };
  /** A finger that drags `moves` steps of `px` up the glass (down the story), 16 ms apart, then lifts at once: a flick. */
  const flick = async (moves: number, px: number): Promise<void> => {
    let t = 0;
    fire(el, 'touchstart', { touches: [{ clientX: 100, clientY: 800 }], timeStamp: t });
    for (let i = 1; i <= moves; i++) {
      t += 16;
      fire(el, 'touchmove', { touches: [{ clientX: 100, clientY: 800 - px * i }], timeStamp: t });
      if (i === 1) await flush();
      frames.frame();
    }
    fire(el, 'touchend', { touches: [], timeStamp: t + 4 });
    await flush();
  };
  const drain = (): void => {
    for (let i = 0; frames.size > 0 && i < 3000; i++) frames.frame();
  };
  /** The void's state changes, as the store tells the page's input. */
  const become = (next: VoidState): void => {
    state.voidState = next;
    home.holdChanged();
  };
  /** The 3D switch, as the store tells the page's input: off, or back on (`resume`). */
  const switch3D = (on: boolean): void => {
    state.threeD = on;
    if (on) home.resume();
  };
  return { story, state, home, key, wheel, flick, drain, become, switch3D, frames, el, chapters };
}

describe("3D off and on keeps the visitor's place", () => {
  it("leaves the target on the bead's stop when 3D goes off: the void's idle does not pull it to the hold", () => {
    const s = held('ready', { at: A1 });
    s.switch3D(false);
    s.become('idle'); // the Void unmounts with the Stage
    expect([s.story.target, s.story.progress]).toEqual([A1, A1]);
    expect(s.frames.size).toBe(0);
  });

  it("holds it at the landing when 3D is back while the beads load, and returns it to the bead's stop once ready", async () => {
    const s = held('ready', { at: A1 });
    s.switch3D(false);
    s.become('idle');
    s.switch3D(true);
    // As a Back to the stop while the beads load: the story waits at the hold, its place kept for the beads' ready.
    expect([s.story.target, s.story.progress]).toEqual([H, H]);
    expect(s.chapters.at(-1)).toBe('TRAVEL'); // the hold is the path's start
    s.become('loading');
    s.drain();
    expect(s.story.target).toBe(H);
    s.become('ready');
    await flush(); // the first move fetches damp
    s.drain();
    expect([s.story.target, s.story.progress]).toEqual([A1, A1]);
    expect(s.chapters.at(-1)).toBe('INSIDE'); // an arrival stop is its inside's start
  });

  it('does the same with reduced motion, held on the last fact, the last key stop under the hold', async () => {
    const s = held('ready', { at: A2, reduced: true });
    s.switch3D(false);
    s.become('idle');
    expect(s.story.target).toBe(A2);
    s.switch3D(true);
    expect([s.story.target, s.story.progress]).toEqual([F241, F241]);
    s.become('loading');
    s.become('ready');
    await flush();
    s.drain();
    expect([s.story.target, s.story.progress]).toEqual([A2, A2]);
  });

  it('keeps the place when the hold comes down with 3D on for a void that loads again, idle, then ready', async () => {
    const s = held('ready', { at: L + 4.6 }); // on the way from Funcial to Jontai Energy
    s.become('idle');
    expect([s.story.target, s.story.progress]).toEqual([H, H]);
    s.become('loading');
    s.become('ready');
    await flush();
    s.drain();
    expect([s.story.target, s.story.progress]).toEqual([L + 4.6, L + 4.6]);
  });

  it('keeps the story at the hold when the void failed, and lets the place go: a later ready leaves it there', async () => {
    const s = held('loading', { at: A1 });
    expect([s.story.target, s.story.progress]).toEqual([H, H]);
    s.become('failed');
    await flush();
    s.drain();
    expect([s.story.target, s.story.progress]).toEqual([H, H]);
    s.become('ready');
    s.drain();
    expect(s.story.target).toBe(H);
  });

  it('leaves a story short of the hold where it is across the switch', () => {
    const s = held('ready', { at: 0.6 });
    s.switch3D(false);
    s.become('idle');
    s.switch3D(true);
    expect([s.story.target, s.story.progress]).toEqual([0.6, 0.6]);
  });

  it('ends a wheel gesture still in its quiet when 3D goes off where it is, and 3D back on returns there once ready', async () => {
    const s = held('ready', { at: A0 });
    await s.wheel(1); // 0.12 on; the wheel's quiet has begun
    s.switch3D(false);
    s.become('idle'); // the Void goes with the Stage before the loop's next frame
    s.frames.frame(); // the loop's 3D-off frame ends the gesture
    expect(s.story.target).toBeCloseTo(A0 + 0.12, 12); // where the wheel put it, not held at the idle void's hold
    s.switch3D(true);
    expect(s.story.target).toBe(H);
    expect(s.story.progress).toBeLessThanOrEqual(H);
    s.become('loading');
    s.become('ready');
    await flush();
    s.drain();
    expect(s.story.target).toBeCloseTo(A0 + 0.12, 12);
    expect(s.story.progress).toBe(s.story.target);
  });

  it('holds a story whose progress is past the hold when 3D is back, even with its target short of it', () => {
    const s = held('ready', { at: A1 });
    s.story.target = 1; // on its way up to BOB from above, still at Jontai Energy, when 3D goes off
    s.switch3D(false);
    s.become('idle');
    s.switch3D(true);
    expect(s.story.target).toBe(1);
    expect(s.story.progress).toBe(H); // the camera never stands on a path whose beads are not there
  });
});

describe('the scroll input holds at the landing while the beads load', () => {
  it('clamps its target to the hold: a wheel past it while loading rests at LANDING_HOLD', async () => {
    const s = held('loading');
    await s.wheel(60); // 7.2 units asked for, past the hold
    s.drain();
    expect(s.story.target).toBe(H);
    expect(s.story.progress).toBe(H);
  });

  it('holds the same while idle, before the load has begun', async () => {
    const s = held('idle');
    await s.wheel(60);
    s.drain();
    expect(s.story.target).toBe(H);
  });

  it('ends a glide that is pressing into the hold, as at the end of the story, so the loop sleeps', async () => {
    const s = held('loading', { at: H - 0.25 });
    await s.flick(10, 40); // 0.4 dragged, to the hold, then a glide pressing into it
    s.drain();
    expect(s.story.target).toBe(H);
    expect(s.home.scroll.busy).toBe(false);
    expect(s.frames.size).toBe(0);
  });

  it('goes End to the hold, and Home all the way back', async () => {
    const s = held('loading');
    s.key('End');
    expect(s.story.target).toBe(H);
    await flush();
    s.drain();
    expect(s.story.progress).toBe(H);
    s.key('Home');
    s.drain();
    expect([s.story.target, s.story.progress]).toEqual([0, 0]);
  });

  it('keeps no excess: scrolling back up from the hold moves the story at once', async () => {
    const s = held('loading');
    await s.wheel(60);
    s.drain();
    s.key('PageUp'); // a key steps: up from the hold to the key stop before it, the last fact
    expect(s.story.target).toBe(F241);
    s.drain();
    expect(s.story.progress).toBe(F241);
    await s.wheel(3, -120); // and a wheel by its distance at once: 3 notches of 120 px
    expect(s.story.target).toBeCloseTo(F241 - 0.36, 12);
  });

  it('goes on once ready: a wheel that pressed against the hold goes on as far as it went', async () => {
    const s = held('loading');
    await s.wheel(80); // 9.6 units asked for: inside Funcial, past its arrival, the next stop past the hold
    s.drain();
    s.become('ready');
    s.drain();
    expect(s.story.target).toBeCloseTo(9.6, 12);
    expect(s.story.progress).toBe(s.story.target);
  });

  it('goes on to the end for End pressed while held', async () => {
    const s = held('loading');
    s.key('End');
    await flush();
    s.drain();
    s.become('ready');
    s.drain();
    expect([s.story.target, s.story.progress]).toEqual([END, END]);
  });

  it('rests a notch short of the hold where it ends, and ready leaves it there', async () => {
    const s = held('loading', { at: 1 });
    await s.wheel(1); // 1.12, short of the hold
    s.drain();
    expect(s.story.target).toBeCloseTo(1.12, 12);
    expect(s.story.progress).toBe(s.story.target);
    s.become('ready');
    s.drain();
    expect(s.story.target).toBeCloseTo(1.12, 12);
  });

  it('asks a flick whose glide presses into the hold for the key stop just past it, no further', async () => {
    const s = held('loading', { at: H - 0.36 });
    await s.flick(3, 60); // 0.18 dragged, short of the hold, and a glide that would carry about 0.94 more
    s.drain();
    expect([s.story.target, s.story.progress]).toEqual([H, H]);
    s.become('ready');
    s.drain();
    expect([s.story.target, s.story.progress]).toEqual([A0, A0]);
  });

  it('leaves a scroll that rested short of the hold where it is when the void is ready', async () => {
    const s = held('loading');
    await s.wheel(5); // 0.6
    s.drain();
    const at = s.story.target;
    expect(at).toBeLessThan(H);
    s.become('ready');
    s.drain();
    expect(s.story.target).toBe(at);
  });

  it('lets the scroll go to the end once ready', async () => {
    const s = held('ready');
    s.key('End');
    await flush();
    s.drain();
    expect(s.story.target).toBe(END);
  });

  it('holds at the landing when the void failed, keeping a story held there', async () => {
    const s = held('loading');
    await s.wheel(60);
    s.drain();
    s.become('failed');
    s.drain();
    expect([s.story.target, s.story.progress]).toEqual([H, H]);
    await s.wheel(10);
    s.drain();
    expect(s.story.target).toBe(H);
  });

  it("holds Back to a bead's stop at the landing while the beads load, then goes on to the stop once they are ready", async () => {
    // Back (or Escape) from Jontai Energy's page while the beads still load: the route sync put the story at its arrival.
    const s = held('loading', { at: A1 });
    expect([s.story.target, s.story.progress]).toEqual([H, H]);
    // The chapter follows the story to the hold: the path's start, Funcial's travel.
    expect(s.story.chapterIndex).toBe(2);
    expect(s.chapters).toEqual(['TRAVEL']);
    s.drain();
    expect(s.story.target).toBe(H);
    s.become('ready');
    await flush();
    s.drain();
    expect([s.story.target, s.story.progress]).toEqual([A1, A1]);
    expect(s.chapters.at(-1)).toBe('INSIDE'); // an arrival stop is its inside's start
  });

  it('holds it the same while the void is idle, before its load has begun', () => {
    const s = held('idle', { at: A2 });
    expect([s.story.target, s.story.progress]).toEqual([H, H]);
  });

  it("rests Back at the landing hold when the void failed, never at the bead's stop", async () => {
    const s = held('failed', { at: A0 });
    expect([s.story.target, s.story.progress]).toEqual([H, H]);
    await flush();
    s.drain();
    expect([s.story.target, s.story.progress]).toEqual([H, H]);
  });

  it('goes straight to the stop when the void is ready: nothing holds', () => {
    const s = held('ready', { at: A1 });
    expect([s.story.target, s.story.progress]).toEqual([A1, A1]);
    expect(s.chapters).toEqual([]);
  });

  it("with reduced motion holds Back on the last key stop under the hold, then goes on to the bead's stop", async () => {
    const s = held('loading', { at: A2, reduced: true });
    expect([s.story.target, s.story.progress]).toEqual([F241, F241]);
    s.become('ready');
    await flush();
    s.drain();
    expect(s.story.target).toBe(A2);
  });

  describe("Back, the page's Escape and the name link from a project page, through the hold", () => {
    /** The route sync's place for the story on leaving Jontai Energy's page for the home page `how`. */
    const leave = (how: 'back' | 'escape' | 'name'): number => {
      resetRouteSync();
      useScene.setState(useScene.getInitialState(), true);
      frame.progress = frame.target = frame.velocity = frame.chapterIndex = 0;
      if (how === 'escape') {
        // A direct arrival: the page's Escape pushes the home page, saying it is the page's own Back.
        syncRoute({ pathname: '/projects/jontai-energy/', key: 'default' }, NavigationType.Pop);
        syncRoute({ pathname: '/', key: 'k1', state: BACK_STATE }, NavigationType.Push);
      } else {
        syncRoute({ pathname: '/', key: 'default' }, NavigationType.Pop);
        useScene.getState().dispatch({ type: 'LOADED' });
        syncRoute({ pathname: '/projects/jontai-energy/', key: 'k1' }, NavigationType.Push);
        if (how === 'back') syncRoute({ pathname: '/', key: 'default' }, NavigationType.Pop);
        else syncRoute({ pathname: '/', key: 'k2' }, NavigationType.Push); // the header's name link
      }
      const at = frame.target;
      // Leave nothing behind for the file's other tests.
      resetRouteSync();
      useScene.setState(useScene.getInitialState(), true);
      frame.progress = frame.target = frame.chapterIndex = 0;
      return at;
    };

    for (const how of ['back', 'escape'] as const) {
      it(`lands ${how} at the bead's stop, held at the landing while the beads load, then there once they are ready`, async () => {
        const at = leave(how);
        expect(at).toBe(stopForProject('jontai-energy'));
        const s = held('loading', { at });
        expect([s.story.target, s.story.progress]).toEqual([H, H]);
        s.become('ready');
        await flush();
        s.drain();
        expect([s.story.target, s.story.progress]).toEqual([A1, A1]);
      });
    }

    it('lands the name link at the home, stop 0, which nothing holds', async () => {
      const at = leave('name');
      expect(at).toBe(0);
      const s = held('loading', { at });
      expect([s.story.target, s.story.progress]).toEqual([0, 0]);
      s.become('ready');
      await flush();
      s.drain();
      expect(s.story.target).toBe(0);
    });
  });

  it('steps by key stops with reduced motion and holds on the last under the hold: the last fact while loading', async () => {
    const s = held('loading', { reduced: true });
    s.key('PageDown');
    await flush();
    s.drain();
    expect(s.story.target).toBe(1);
    for (let i = 0; i < 5; i++) s.key('PageDown'); // the five facts
    s.drain();
    expect(s.story.target).toBe(F241);
    s.key('PageDown'); // Funcial's arrival, past the hold: held
    s.drain();
    expect(s.story.target).toBe(F241);
    s.become('ready');
    s.drain();
    expect(s.story.target).toBe(A0);
  });
});

// ---------------------------------------------------------------- frame.journey

describe('frame.journey: where the journey stands, for the debug bridge', () => {
  it('is filled from the pose the scene is posed at: its stretch, how far through it, its project, way frame and sheet', () => {
    const into = { ...frame.journey, voidState: 'idle' as VoidState, light: null };
    for (const p of [0, 0.5, 1, 2, 3, LANDING_HOLD, L + 1, L + 2, L + 3, L + 6, L + 13, L + 14.55, L + 15, END]) {
      const pose = journeyPoseAt(p, LAPTOP);
      writeJourney(into, pose);
      const at = journeyAt(p);
      expect({ stretch: into.stretch, local: into.local, project: into.project, frame: into.frame }, `at ${p}`).toEqual({
        stretch: at.stretch,
        local: at.local,
        project: at.project,
        frame: at.frame
      });
      expect(into.sheet, `at ${p}`).toBe(pose.sheet);
    }
    expect(into.voidState).toBe('idle'); // the void's own field: the Void writes it
    expect(into.light).toBeNull(); // and the light's point on the screen, which the Void projects
  });

  it('starts at the home, with an idle void', () => {
    expect(frame.journey).toEqual({ stretch: 'rise', local: 0, project: null, voidState: 'idle', frame: null, sheet: 0, light: null, beads: null, label: null, wake: [] });
  });

  it('is on the debug state as a copy, voidState included', () => {
    const before = { ...frame.journey };
    try {
      const beads = [{ x: 10, y: 20, r: 30, visible: true }];
      Object.assign(frame.journey, { stretch: 'orbit', local: 0.5, project: 1, voidState: 'ready', frame: null, sheet: 0, light: null, beads, label: { index: 1, opacity: 1 }, wake: [10, 3.1, 0] });
      const state = readNeedleDebugState({ route: 'home', locale: 'nl' });
      expect(state.journey).toEqual({ stretch: 'orbit', local: 0.5, project: 1, voidState: 'ready', frame: null, sheet: 0, light: null, beads, label: { index: 1, opacity: 1 }, wake: [10, 3.1, 0] });
      expect(state.journey).not.toBe(frame.journey);
      expect(state.journey.beads).not.toBe(beads);
      expect(state.journey.wake).not.toBe(frame.journey.wake);
    } finally {
      Object.assign(frame.journey, before);
    }
  });
});

describe('voidState in the store', () => {
  it('starts idle and is set by setVoidState', () => {
    useScene.setState(useScene.getInitialState(), true);
    expect(useScene.getState().voidState).toBe('idle');
    useScene.getState().setVoidState('loading');
    expect(useScene.getState().voidState).toBe('loading');
    useScene.getState().setVoidState('ready');
    expect(useScene.getState().voidState).toBe('ready');
    useScene.setState(useScene.getInitialState(), true);
  });
});

// ---------------------------------------------------------------- what the void shows

describe('voidShownFor: the void and the beads show only once the camera is under the glass', () => {
  it('hides them all through the rise, at every progress below 1 and on every screen', () => {
    for (const a of [...SCREENS, 1]) {
      for (let p = 0; p < 1; p += 1 / 64) expect(voidShownFor(journeyPoseAt(p, a).shot), `at ${p}, ${a}`).toBe(false);
    }
  });

  it('hides them while the camera is above the glass in the light dive: BOB from above and the way in', () => {
    // On the high tier the floor shows what lies under it, and the void's traces draw with no depth test.
    for (const a of SCREENS) {
      expect(voidShownFor(journeyPoseAt(1, a).shot)).toBe(false);
      expect(voidShownFor(journeyPoseAt(placeOfFrame(30), a).shot)).toBe(false);
      for (let f = 1; f <= LIGHT_FRAMES; f++) {
        const shot = journeyPoseAt(placeOfFrame(f), a).shot;
        if (shot.position[1] >= 0) expect(voidShownFor(shot), `at frame ${f}`).toBe(false);
      }
    }
  });

  it('shows them once the camera is under the glass, through the fall, round the ring and under the sheet', () => {
    for (const a of SCREENS) {
      for (const f of [F.PASS, F.CHASE, 121, F.LAND, F.END]) expect(voidShownFor(journeyPoseAt(placeOfFrame(f), a).shot), `at frame ${f}`).toBe(true);
      for (const p of [4, 4.5, 5, 5.5, 6, 6.5, 7]) expect(voidShownFor(journeyPoseAt(p, a).shot), `at ${p}`).toBe(true);
    }
  });
});

describe('selectedBead: the bead of an orbit or an inside', () => {
  it('is none on the rise, in the light dive and on a travel, and the bead of an orbit or an inside', () => {
    for (const p of [0, 0.5, 1, placeOfFrame(121), L - 0.001, L, L + 1]) expect(selectedBead(journeyAt(p)), `at ${p}`).toBeNull();
    expect(selectedBead(journeyAt(L + 1.25))).toBe(0); // Funcial's orbit begins
    expect(selectedBead(journeyAt(L + 2.7))).toBe(0); // its arrival stop, the inside's start
    expect(selectedBead(journeyAt(L + 4))).toBe(0); // inside it
    expect(selectedBead(journeyAt(L + 6))).toBe(1);
    expect(selectedBead(journeyAt(L + 11.3))).toBe(2);
  });

  it('is none in the look back, where the pointer picks a bead, under the sheet and at the credits', () => {
    for (const p of [L + 12.65, L + 13.5, L + 14.55, L + 15, END]) expect(selectedBead(journeyAt(p)), `at ${p}`).toBeNull();
  });
});

describe('the hover: eased in and out, one bead at a time', () => {
  it('eases a bead in under the pointer, toward 1, and settles there', () => {
    const hover = hoverEase();
    let easing = easeHover(hover, 1, 1 / 60, false);
    expect(hover.id).toBe(1);
    expect(hover.amount).toBeGreaterThan(0);
    expect(hover.amount).toBeLessThan(0.5);
    expect(easing).toBe(true);
    for (let i = 0; i < 120 && easing; i++) easing = easeHover(hover, 1, 1 / 60, false);
    expect(easing).toBe(false);
    expect(hover).toEqual({ id: 1, amount: 1 });
  });

  it('eases the first bead out before the next comes in, never two at once', () => {
    const hover = hoverEase();
    for (let i = 0; i < 120; i++) easeHover(hover, 0, 1 / 60, false);
    expect(hover).toEqual({ id: 0, amount: 1 });
    let previous = 1;
    let switched = false;
    for (let i = 0; i < 240; i++) {
      easeHover(hover, 2, 1 / 60, false);
      if (hover.id === 0) {
        expect(hover.amount).toBeLessThanOrEqual(previous);
        previous = hover.amount;
      } else {
        if (!switched) expect(previous).toBeLessThan(1e-2);
        switched = true;
        expect(hover.id).toBe(2);
      }
    }
    expect(hover).toEqual({ id: 2, amount: 1 });
  });

  it('eases out to none when the pointer leaves', () => {
    const hover = hoverEase();
    for (let i = 0; i < 120; i++) easeHover(hover, 1, 1 / 60, false);
    for (let i = 0; i < 240; i++) easeHover(hover, null, 1 / 60, false);
    expect(hover).toEqual({ id: null, amount: 0 });
    expect(easeHover(hover, null, 1 / 60, false)).toBe(false);
  });

  it('with reduced motion takes the hover at once, in and out', () => {
    const hover = hoverEase();
    expect(easeHover(hover, 2, 1 / 60, true)).toBe(false);
    expect(hover).toEqual({ id: 2, amount: 1 });
    expect(easeHover(hover, null, 1 / 60, true)).toBe(false);
    expect(hover).toEqual({ id: null, amount: 0 });
  });
});

// ---------------------------------------------------------------- the light count

describe("the beads' inner lights and their stand-ins", () => {
  const glb = readGlbJson(readFileSync(fileURLToPath(new URL('../../../public/models/bob-beads.glb', import.meta.url))));
  const lights = (glb as unknown as { extensions?: { KHR_lights_punctual?: { lights: { type: string }[] } } }).extensions?.KHR_lights_punctual?.lights ?? [];

  it('are the three point lights of the GLB, one in each bead', () => {
    expect(lights.map((light) => light.type)).toEqual(['point', 'point', 'point']);
    expect(lights.length).toBe(BEADS.length);
  });

  it('are stood in for from the first frame by as many point lights, dark, where the tier keeps them', async () => {
    const { BEAD_LIGHTS, beadLightStandIns } = await import('~/scene/bob/Void');
    expect(BEAD_LIGHTS).toEqual({ high: true, medium: true, low: false });
    for (const tier of ['high', 'medium'] as const) {
      const standIns = beadLightStandIns(tier);
      // The count three compiles for is the beads' own: point lights, no shadows, as many as the GLB's.
      expect(standIns.length).toBe(lights.length);
      for (const light of standIns) {
        expect(light.isPointLight).toBe(true);
        expect(light.intensity).toBe(0);
        expect(light.castShadow).toBe(false);
        expect(light.visible).toBe(true);
      }
      expect(standIns.map((light) => light.name)).toEqual(BEADS.map(({ id }) => `bead_${id}_inner:stand-in`));
    }
    // On low the beads' own are dropped, and so nothing stands in for them.
    expect(beadLightStandIns('low')).toEqual([]);
  });

  it('hides a bead by what it draws, never by its root, so its light stays in the count', async () => {
    const THREE = await import('three');
    const { drawnParts } = await import('~/scene/bob/Void');
    const root = new THREE.Group();
    const body = new THREE.Mesh();
    const slot = new THREE.Group();
    slot.add(new THREE.Mesh(), new THREE.Mesh());
    const light = new THREE.PointLight(undefined, 0.25);
    // A light held a level down, in a group that also holds a drawn part.
    const holder = new THREE.Group();
    const lamp = new THREE.PointLight(undefined, 0.25);
    const shade = new THREE.Mesh();
    holder.add(lamp, shade);
    root.add(body, slot, light, holder);
    const parts = drawnParts(root);
    expect(new Set(parts)).toEqual(new Set([body, slot, shade]));
    for (const part of parts) part.visible = false;
    const lit: unknown[] = [];
    root.traverseVisible((o) => {
      if ((o as { isLight?: boolean }).isLight) lit.push(o);
    });
    expect(lit).toEqual([light, lamp]);
    const drawn: unknown[] = [];
    root.traverseVisible((o) => {
      if ((o as { isMesh?: boolean }).isMesh) drawn.push(o);
    });
    expect(drawn).toEqual([]);
  });
});

// ---------------------------------------------------------------- reduced motion

describe("the step fade's stops are the journey's chapter starts", () => {
  it('fades between the chapter starts, from the home to the credits, and poses each exactly', () => {
    const STOPS = stops(HOME_CHAPTERS);
    expect(STOPS[0]).toBe(0);
    expect(STOPS.at(-1)).toBe(END);
    for (const stop of STOPS) {
      expect(nearestStop(STOPS, stop)).toBe(stop);
      expect(nearestStop(STOPS, stop + 0.3)).toBe(Math.min(stop, END));
    }
  });
});

// ---------------------------------------------------------------- the wiring

/** `source` without its comments. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

const read = (path: string): string => code(readFileSync(fileURLToPath(new URL(`../../../src/${path}`, import.meta.url)), 'utf8'));

describe('the wiring: one journey pose a frame', () => {
  it('has the Opening compute the pose once and publish it, and Home and the Void read that one', () => {
    const opening = read('scene/bob/Opening.tsx');
    expect(opening.match(/\bjourneyPoseAt\(/g)?.length).toBe(1);
    expect(opening).toMatch(/handover\.pose\s*=/);
    expect(opening).toMatch(/writeJourney\(\s*frame\.journey\b/);
    for (const path of ['scene/bob/Home.tsx', 'scene/bob/Void.tsx']) {
      const source = read(path);
      expect(source, path).not.toMatch(/\bjourneyPoseAt\(/);
      expect(source, path).toMatch(/handover\.pose\b/);
    }
  });

  it('has the Void hand the needle its place every frame it drives it, and give it back', () => {
    const source = read('scene/bob/Void.tsx');
    expect(source).toMatch(/setNeedleWorld\(\s*needleFor\(\s*pose\s*\)\s*\)/);
    expect(source).toMatch(/setNeedleWorld\(\s*null\s*\)/);
  });

  it('uploads textures through one call of initTexture, the one the proof harness\'s load-throw step makes throw', () => {
    const calls = ['scene/bob/Opening.tsx', 'scene/bob/Void.tsx', 'scene/bob/warm.ts', 'scene/bob/Home.tsx', 'engine/bob/build/beads.ts', 'engine/bob/build/void.ts'].flatMap((path) =>
      (read(path).match(/\.initTexture\(/g) ?? []).map(() => path)
    );
    expect(calls).toEqual(['scene/bob/warm.ts']);
    expect(read('scene/bob/Opening.tsx')).toMatch(/uploadTextures\(gl, homeParts\.strips\)/);
    expect(read('scene/bob/Void.tsx')).toMatch(/uploadTextures\(gl, texturesUnder\(holder\)\)/);
  });
});

describe("the home scroll as the page wires it to the store (connectHomeScroll, useHomeScroll's own body)", () => {
  /** The page's scroll on a fake document element, its frames the test's, the store and `frame` the app's own. */
  function wired(voidState: VoidState, at = 0) {
    useScene.setState(useScene.getInitialState(), true);
    useScene.setState({ phase: { kind: 'HOME_IDLE' }, threeD: true, voidState });
    Object.assign(frame, { progress: at, target: at, velocity: 0, chapterIndex: chapterAt(HOME_CHAPTERS, at).index, loaderSkipEndsMs: null });
    const frames = new FakeFrames();
    const el = new EventTarget();
    Object.defineProperty(el, 'ownerDocument', { value: { defaultView: new EventTarget() } });
    const disconnect = connectHomeScroll({ el: el as unknown as HTMLElement, unitPx: () => VH, request: frames.request, cancel: frames.cancel, loadSmooth: () => Promise.resolve(damp) });
    const wheel = async (notches: number): Promise<void> => {
      for (let i = 0; i < notches; i++) {
        fire(el, 'wheel', { deltaY: 120, deltaMode: 0, ctrlKey: false, timeStamp: 16 * i });
        if (i === 0) await flush();
        frames.frame();
      }
    };
    const drain = (): void => {
      for (let i = 0; frames.size > 0 && i < 3000; i++) frames.frame();
    };
    return { frames, wheel, drain, disconnect };
  }

  afterEach(() => {
    useScene.setState(useScene.getInitialState(), true);
    Object.assign(frame, { progress: 0, target: 0, velocity: 0, chapterIndex: 0 });
  });

  it("holds the scroll at the landing while the store's beads load, and lets it go on once the store says ready", async () => {
    const s = wired('loading');
    try {
      await s.wheel(80);
      s.drain();
      expect([frame.target, frame.progress]).toEqual([H, H]);
      // The hold is the path's start, where Funcial's travel begins.
      expect(useScene.getState().phase).toEqual({ kind: 'PROJECTS', category: 'secure-element' });
      useScene.getState().setVoidState('ready');
      s.drain();
      expect(frame.target).toBeCloseTo(9.6, 12); // as far as the wheel went
      expect(frame.progress).toBe(frame.target);
      expect(useScene.getState().phase.kind).toBe('PROJECTS');
    } finally {
      s.disconnect();
    }
  });

  it('keeps a story pressed against it at the hold when the store says the void failed', async () => {
    const s = wired('loading');
    try {
      await s.wheel(60);
      s.drain();
      useScene.getState().setVoidState('failed');
      s.drain();
      expect([frame.target, frame.progress]).toEqual([H, H]);
    } finally {
      s.disconnect();
    }
  });

  it("keeps the visitor's place across the store's 3D switch, off and back on at a bead's stop", async () => {
    const s = wired('ready', A1);
    try {
      useScene.setState({ threeD: false });
      useScene.getState().setVoidState('idle'); // the Void goes with the Stage
      expect([frame.target, frame.progress]).toEqual([A1, A1]);
      useScene.setState({ threeD: true });
      expect([frame.target, frame.progress]).toEqual([H, H]);
      useScene.getState().setVoidState('loading');
      useScene.getState().setVoidState('ready');
      await flush();
      s.drain();
      expect([frame.target, frame.progress]).toEqual([A1, A1]);
      expect(useScene.getState().phase).toEqual({ kind: 'PROJECTS', category: 'front-panel' });
    } finally {
      s.disconnect();
    }
  });

  it("ends a wheel gesture at once when the store's 3D goes off within its quiet, before the void goes, and keeps its place", async () => {
    const s = wired('ready', A0);
    try {
      await s.wheel(1); // 0.12 on, the wheel's quiet begun
      useScene.setState({ threeD: false });
      expect(frame.target).toBeCloseTo(A0 + 0.12, 12); // ended at once where it went, before the Void says idle
      useScene.getState().setVoidState('idle');
      expect(frame.target).toBeCloseTo(A0 + 0.12, 12);
      useScene.setState({ threeD: true });
      useScene.getState().setVoidState('loading');
      useScene.getState().setVoidState('ready');
      s.drain();
      expect(frame.target).toBeCloseTo(A0 + 0.12, 12);
      expect(frame.progress).toBe(frame.target);
    } finally {
      s.disconnect();
    }
  });

  it('takes the input off when it is disconnected: the store no longer moves it', async () => {
    const s = wired('loading');
    s.disconnect();
    await s.wheel(5);
    useScene.getState().setVoidState('ready');
    expect(frame.target).toBe(0);
    expect(s.frames.size).toBe(0);
  });
});

describe('the home\'s links when the void failed, in the stylesheet', () => {
  const css = readFileSync(fileURLToPath(new URL('../../../src/styles/base.css', import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('shows .home-nav over the scene at the landing hold once the void failed, undoing the hidden-while-3D-is-on rule', () => {
    const at = css.indexOf("html[data-3d='on'][data-void='failed'][data-held] .home-nav {");
    expect(at).toBeGreaterThan(-1);
    const body = css.slice(at, css.indexOf('}', at));
    expect(body).toMatch(/position:\s*fixed/);
    expect(body).toMatch(/clip-path:\s*none/);
    expect(body).toMatch(/width:\s*auto/);
    expect(body).toMatch(/height:\s*auto/);
    expect(body).toMatch(/overflow:\s*visible/);
    // It comes after the rule it undoes, which it outweighs anyway (two attributes more).
    expect(at).toBeGreaterThan(css.indexOf("html[data-3d='on'] .home-nav:not(:focus-within)"));
  });
});

// ---------------------------------------------------------------- the load: the void at the hand-over, the beads after

describe('loadVoid: the void is built at the hand-over, the beads once their file is in', () => {
  /** A load whose steps the test owns: the beads' file arrives when `release` is called (or fails with `fail`). */
  function steps(options: { voidFails?: boolean } = {}) {
    const said: VoidState[] = [];
    const scene: string[] = [];
    const freed: string[] = [];
    let gone = false;
    let release!: (beads: string) => void;
    let fail!: (error: Error) => void;
    const file = new Promise<string>((resolve, reject) => {
      release = resolve;
      fail = reject;
    });
    const run = loadVoid<string, string>({
      buildVoid: async () => {
        if (options.voidFails) throw new Error('no void');
        return 'void';
      },
      freeVoid: (space) => freed.push(space),
      buildBeads: () => file,
      say: (state) => said.push(state),
      gone: () => gone,
      onVoid: (space) => scene.push(space),
      onBeads: (beads) => scene.push(beads)
    });
    return { said, scene, freed, run, release, fail, leave: () => (gone = true) };
  }

  it("puts the void in the scene before the beads' file is in, saying loading, then ready with the beads", async () => {
    const s = steps();
    await flush();
    expect(s.said).toEqual(['loading']);
    expect(s.scene).toEqual(['void']);
    s.release('beads');
    await s.run;
    expect(s.said).toEqual(['loading', 'ready']);
    expect(s.scene).toEqual(['void', 'beads']);
  });

  it('keeps the void in the scene when the beads fail, saying failed', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = steps();
    await flush();
    s.fail(new Error('404'));
    await s.run;
    expect(s.said).toEqual(['loading', 'failed']);
    expect(s.scene).toEqual(['void']);
    expect(s.freed).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('says failed with nothing in the scene when the void itself cannot be built', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = steps({ voidFails: true });
    await s.run;
    expect(s.said).toEqual(['loading', 'failed']);
    expect(s.scene).toEqual([]);
    warn.mockRestore();
  });

  it('frees a void built after the Void has gone, and says nothing more', async () => {
    const s = steps();
    s.leave();
    await s.run;
    expect(s.freed).toEqual(['void']);
    expect(s.scene).toEqual([]);
    expect(s.said).toEqual(['loading']);
  });

  it('is what the Void runs: the void posed from the journey, no beam and no setLight', () => {
    const source = read('scene/bob/Void.tsx');
    expect(source).toMatch(/\bloadVoid\(/);
    for (const call of ['setBand', 'setRingMist', 'setDust', 'setStream']) expect(source, call).toContain(`.${call}(`);
    expect(source).not.toMatch(/\.setLight\(/);
  });
});

// ---------------------------------------------------------------- the way in: the needle becomes the light, the void opens

describe('needleFor: the needle the Void hands the compass', () => {
  it("is the compass's own on the rise and at BOB from above: none", () => {
    for (const p of [0, 0.5, 1, placeOfFrame(2)]) expect(needleFor(journeyPoseAt(p, LAPTOP)), `at ${p}`).toBeNull();
  });

  it('gives the needle to the light over way frames 2-8: at the pivot, shrinking to nothing, its tip straight down', () => {
    let last = 1;
    for (const f of [2.5, 3, 4, 5, 6, 7, 7.9]) {
      const o = needleFor(journeyPoseAt(placeOfFrame(f), LAPTOP));
      expect(o, `frame ${f}`).not.toBeNull();
      expect(o!.position).toEqual([0, 0.09, 0]);
      expect(o!.aim).toBeNull();
      expect(o!.scale).toBeLessThan(last);
      last = o!.scale;
    }
    expect(needleFor(journeyPoseAt(placeOfFrame(8), LAPTOP))!.scale).toBe(0);
  });

  it('keeps it in the light through the fall and the whole path: the light stays the light to the end', () => {
    for (const f of [9, 61, 121, 241, 255]) expect(needleFor(journeyPoseAt(placeOfFrame(f), LAPTOP))!.scale, `frame ${f}`).toBe(0);
    for (const p of [L, L + 2, L + 7, L + 13, END]) expect(needleFor(journeyPoseAt(p, LAPTOP))!.scale, `at ${p}`).toBe(0);
  });
});

describe('voidShownAt: the void shows from the light dive\'s frame 20, its band fading in from there', () => {
  it('hides it on the rise and in the way in before frame 20, and shows it from 20 through the path and the sheet', () => {
    expect(VOID_FROM).toBe(20);
    for (const p of [0, 0.5, 1, placeOfFrame(10), placeOfFrame(19.9)]) expect(voidShownAt(journeyPoseAt(p, LAPTOP)), `at ${p}`).toBe(false);
    for (const p of [placeOfFrame(20), placeOfFrame(30), placeOfFrame(121), L + 1, L + 6, L + 13, END]) expect(voidShownAt(journeyPoseAt(p, PHONE)), `at ${p}`).toBe(true);
  });
});

describe('needleGlowFor: the needle the light never becomes again', () => {
  it('leaves the needle to the home on the rise, and to the light through the fall and the path', () => {
    expect(needleGlowFor(journeyAt(0.5))).toBeNull();
    expect(needleGlowFor(journeyAt(placeOfFrame(200)))).toBeNull();
    for (const p of [L, L + 4, L + 13, L + 15, END]) expect(needleGlowFor(journeyAt(p)), `at ${p}`).toBeNull();
  });
});

describe('a failed void: the fall plays, the story holds at the landing, and the nav shows there', () => {
  const css = readFileSync(fileURLToPath(new URL('../../../src/styles/base.css', import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const ruleFor = (selector: string): string | undefined => {
    for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) if (match[1]!.trim() === selector) return match[2];
    return undefined;
  };

  it('holds at LANDING_HOLD, and counts as held only there, with the void failed, short of the credits', () => {
    expect(landingHoldFor('failed')).toBe(LANDING_HOLD);
    expect(heldAtLanding(LANDING_HOLD, 'failed')).toBe(true);
    expect(heldAtLanding(LANDING_HOLD - 0.01, 'failed')).toBe(false);
    expect(heldAtLanding(placeOfFrame(121), 'failed')).toBe(false);
    expect(heldAtLanding(LANDING_HOLD, 'loading')).toBe(false);
    expect(heldAtLanding(END, 'failed')).toBe(false);
  });

  it('shows the home nav, its "Vragen & contact" link with it, over the scene at the hold only, never over the facts', () => {
    expect(ruleFor("html[data-3d='on'][data-void='failed'][data-held] .home-nav")).toMatch(/position:\s*fixed/);
    expect(ruleFor("html[data-3d='on'][data-void='failed'][data-rising] .home-nav")).toBeUndefined();
  });

  it('never shows the skip button with the void failed: there are no projects', () => {
    expect(ruleFor("html[data-void='failed'] .skip-button")).toMatch(/display:\s*none/);
  });
});

describe("wakeFor: the veins' wake a bead's shell is given each frame", () => {
  /** A camera's view through `shot` on a screen of this aspect: a world point to its view-space x and y. */
  const viewFrom = (shot: CameraShot, aspect: number) => {
    const camera = new THREE.PerspectiveCamera(50, aspect, 0.05, 400);
    applyCameraShot(camera, shot, aspect);
    const v = new THREE.Vector3();
    return (p: readonly [number, number, number]): readonly [number, number] => {
      v.set(p[0], p[1], p[2]).applyMatrix4(camera.matrixWorldInverse);
      return [v.x, v.y];
    };
  };

  it('wakes a bead fully, not at all, or by the light\'s sweep round it', () => {
    const path = pathFor(LAPTOP);
    const frame0 = path.frameAt(2.0); // Funcial's orbit
    const bead0 = frame0.beads[0]!;
    const view = viewFrom(frame0.shot, LAPTOP);
    const centre = view(bead0.centre);
    expect(wakeFor({ ...bead0, wake: { kind: 'full' } }, path, view)).toEqual({ centre, start: 0, span: 10, dir: 1, hot: 0 });
    expect(wakeFor({ ...bead0, wake: { kind: 'none' } }, path, view)).toEqual({ centre, start: 0, span: 0, dir: 1, hot: 0 });
    const quarter = wakeFor({ ...bead0, wake: { kind: 'orbit', from: -Math.PI / 2, now: 0 } }, path, view);
    expect(quarter.hot).toBe(WAKE.hot);
    expect(quarter.span).toBeGreaterThan(0.5); // from behind the bead to its right, seen a little from above
    expect(quarter.span).toBeLessThan(Math.PI);
    expect(quarter.centre).toEqual(centre);
  });
});

describe('pointerMode: which beads the pointer may hover and open', () => {
  it('is the selected bead alone in an orbit or an inside, any bead in the look back, and none elsewhere', () => {
    const at = (p: number) => pointerMode(journeyPoseAt(p, LAPTOP));
    expect([at(0.5), at(placeOfFrame(121)), at(L + 0.5)]).toEqual([null, null, null]);
    expect([at(L + 2), at(L + 3), at(L + 6)]).toEqual(['selected', 'selected', 'selected']);
    expect([at(L + 13), at(L + 14.55)]).toEqual(['any', 'any']);
    expect([at(L + 15), at(END)]).toEqual([null, null]);
  });
});
