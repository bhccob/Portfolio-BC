import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { damp } from 'maath/easing';
import { describe, expect, it } from 'vitest';
import { readGlbJson } from '~/engine/bob/glb';
import { readNeedleDebugState } from '~/debug/useNeedleDebug';
import { startHomeScroll } from '~/input/scrollLoop';
import { holdLimit, releaseTarget } from '~/input/target';
import { diveHoldFor, RISE_TOP } from '~/scene/bob/diveHold';
import { BEADS, journeyAt, journeyPoseAt, TUNNEL_HOLD } from '~/scene/bob/journey';
import { nearestStop } from '~/scene/bob/stepFade';
import {
  BEAD_CLOCK_RESETS,
  beadClocks,
  easeHover,
  hoverEase,
  selectedBead,
  stepBeadClocks,
  voidShownFor,
  writeJourney
} from '~/scene/bob/voidPose';
import { HOME_CHAPTERS, stops } from '~/state/chapters';
import { frame } from '~/state/frame';
import { useScene, type VoidState } from '~/state/store';

const LAPTOP = 16 / 9;
const PHONE = 390 / 844;
const SCREENS = [LAPTOP, PHONE] as const;
const STOPS = stops(HOME_CHAPTERS);
const END = HOME_CHAPTERS.total;

// ---------------------------------------------------------------- the hold

describe('diveHoldFor: the most the scroll may reach before the void is ready', () => {
  it('is TUNNEL_HOLD while the void is idle or loading: the dive holds halfway down the tunnel', () => {
    expect(diveHoldFor('idle')).toBe(TUNNEL_HOLD);
    expect(diveHoldFor('loading')).toBe(TUNNEL_HOLD);
    expect(journeyAt(diveHoldFor('loading')).stretch).toBe('dive');
    for (const a of SCREENS) expect(journeyPoseAt(diveHoldFor('loading'), a).shot.position[1]).toBeCloseTo(-0.6, 2);
  });

  it('is the end of the story once the void is ready: nothing holds', () => {
    expect(diveHoldFor('ready')).toBe(END);
    expect(END).toBe(6);
  });

  it('is BOB from above, the top of the rise, when the void failed: the dive never starts, as with 3D off', () => {
    expect(diveHoldFor('failed')).toBe(1);
    expect(RISE_TOP).toBe(1);
    expect(journeyPoseAt(RISE_TOP, LAPTOP).rise.u).toBe(1);
    expect(STOPS).toContain(diveHoldFor('failed'));
  });

  it('answers a hold for every state, never above the end nor below the top of the rise', () => {
    for (const state of ['idle', 'loading', 'ready', 'failed'] as const satisfies readonly VoidState[]) {
      expect(diveHoldFor(state)).toBeGreaterThanOrEqual(RISE_TOP);
      expect(diveHoldFor(state)).toBeLessThanOrEqual(END);
    }
  });
});

describe('holdLimit and releaseTarget: the hold as the scroll input applies it', () => {
  it('is the hold itself without reduced motion, within the story', () => {
    expect(holdLimit(TUNNEL_HOLD, HOME_CHAPTERS, false)).toBe(TUNNEL_HOLD);
    expect(holdLimit(END, HOME_CHAPTERS, false)).toBe(END);
    expect(holdLimit(99, HOME_CHAPTERS, false)).toBe(END);
    expect(holdLimit(-1, HOME_CHAPTERS, false)).toBe(0);
    expect(holdLimit(Number.NaN, HOME_CHAPTERS, false)).toBe(END);
  });

  it('is the last stop at or under the hold with reduced motion, which rests on stops alone', () => {
    expect(holdLimit(TUNNEL_HOLD, HOME_CHAPTERS, true)).toBe(1);
    expect(holdLimit(1, HOME_CHAPTERS, true)).toBe(1);
    expect(holdLimit(END, HOME_CHAPTERS, true)).toBe(END);
    for (let hold = 0; hold <= END; hold += 0.125) expect(STOPS).toContain(holdLimit(hold, HOME_CHAPTERS, true));
  });

  it('goes on to the next stop once the hold rises, or further where the input asked further, never past the new hold', () => {
    // A wheel that pressed a notch past the tunnel's hold: the dive goes on to the overview.
    expect(releaseTarget(TUNNEL_HOLD, TUNNEL_HOLD + 0.133, END, HOME_CHAPTERS)).toBe(2);
    // End, pressed while held: the end.
    expect(releaseTarget(TUNNEL_HOLD, END, END, HOME_CHAPTERS)).toBe(END);
    // A long wheel that asked for 3.4: there.
    expect(releaseTarget(TUNNEL_HOLD, 3.4, END, HOME_CHAPTERS)).toBe(3.4);
    // Reduced motion, held on stop 1 and asked for stop 2: stop 2.
    expect(releaseTarget(1, 2, END, HOME_CHAPTERS)).toBe(2);
    // Never past the hold it is released to.
    expect(releaseTarget(TUNNEL_HOLD, END, 4.5, HOME_CHAPTERS)).toBe(4.5);
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

/** The home's scroll input on the real chapters, held by the void's state as the page's input is. */
function held(voidState: VoidState, options: { reduced?: boolean } = {}) {
  const frames = new FakeFrames();
  const story = { progress: 0, target: 0, velocity: 0, chapterIndex: 0 };
  const state = { voidState, reduced: options.reduced ?? false };
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
    threeD: () => true,
    hold: () => diveHoldFor(state.voidState),
    onChapter: () => {},
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
  const drain = (): void => {
    for (let i = 0; frames.size > 0 && i < 3000; i++) frames.frame();
  };
  /** The void's state changes, as the store tells the page's input. */
  const become = (next: VoidState): void => {
    state.voidState = next;
    home.holdChanged();
  };
  return { story, state, home, key, wheel, drain, become, frames, el };
}

describe('the scroll input holds at the dive while the void loads', () => {
  it('clamps its target to the hold: a wheel past it while loading rests at TUNNEL_HOLD', async () => {
    const s = held('loading');
    await s.wheel(40); // 4.8 units asked for
    s.drain();
    expect(s.story.target).toBe(TUNNEL_HOLD);
    expect(s.story.progress).toBe(TUNNEL_HOLD);
  });

  it('holds the same while idle, before the load has begun', async () => {
    const s = held('idle');
    await s.wheel(40);
    s.drain();
    expect(s.story.target).toBe(TUNNEL_HOLD);
  });

  it('ends a glide that is pressing into the hold, as at the end of the story, so the loop sleeps', async () => {
    const s = held('loading');
    s.story.target = s.story.progress = 1.5;
    s.story.chapterIndex = 1;
    let t = 0;
    fire(s.el, 'touchstart', { touches: [{ clientX: 100, clientY: 800 }], timeStamp: t });
    for (let i = 1; i <= 10; i++) {
      t += 16;
      fire(s.el, 'touchmove', { touches: [{ clientX: 100, clientY: 800 - 40 * i }], timeStamp: t });
      if (i === 1) await flush();
      s.frames.frame();
    }
    fire(s.el, 'touchend', { touches: [], timeStamp: t + 4 });
    await flush();
    expect(s.home.scroll.busy).toBe(false);
    s.drain();
    expect(s.story.target).toBe(TUNNEL_HOLD);
    expect(s.frames.size).toBe(0);
  });

  it('jumps End to the hold, and Home all the way back', async () => {
    const s = held('loading');
    s.key('End');
    await flush();
    s.drain();
    expect(s.story.target).toBe(TUNNEL_HOLD);
    s.key('Home');
    s.drain();
    expect(s.story.target).toBe(0);
  });

  it('keeps no excess: scrolling back up from the hold moves the story at once', async () => {
    const s = held('loading');
    await s.wheel(40);
    s.drain();
    s.key('PageUp'); // 0.9 up
    s.drain();
    expect(s.story.target).toBeCloseTo(TUNNEL_HOLD - 0.9, 12);
  });

  it('goes on once the void is ready: a scroll that pressed against the hold goes on to the overview', async () => {
    const s = held('loading');
    await s.wheel(40);
    s.drain();
    s.become('ready');
    s.drain();
    expect(s.story.target).toBe(2);
    expect(s.story.progress).toBe(2);
  });

  it('goes on to the end for End pressed while held', async () => {
    const s = held('loading');
    s.key('End');
    await flush();
    s.drain();
    s.become('ready');
    s.drain();
    expect(s.story.target).toBe(END);
  });

  it('leaves a scroll that rested short of the hold where it is when the void is ready', async () => {
    const s = held('loading');
    await s.wheel(5); // 0.6
    s.drain();
    const at = s.story.target;
    expect(at).toBeLessThan(TUNNEL_HOLD);
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

  it('holds at BOB from above when the void failed, bringing a story held in the tunnel back there', async () => {
    const s = held('loading');
    await s.wheel(40);
    s.drain();
    s.become('failed');
    s.drain();
    expect(s.story.target).toBe(1);
    expect(s.story.progress).toBe(1);
    await s.wheel(10);
    s.drain();
    expect(s.story.target).toBe(1);
  });

  it('steps by stops with reduced motion and holds on the last stop under the hold: BOB from above while loading', async () => {
    const s = held('loading', { reduced: true });
    s.key('PageDown');
    await flush();
    s.drain();
    expect(s.story.target).toBe(1);
    s.key('PageDown');
    s.drain();
    expect(s.story.target).toBe(1);
    s.become('ready');
    s.drain();
    expect(s.story.target).toBe(2);
  });
});

// ---------------------------------------------------------------- frame.journey

describe('frame.journey: where the journey stands, for the debug bridge', () => {
  it('is filled from the pose the scene is posed at: its stretch, how far through it and its project', () => {
    const into = { stretch: 'rise' as const, local: 0, project: null as number | null, voidState: 'idle' as VoidState };
    for (const p of [0, 0.5, 1, TUNNEL_HOLD, 2, 2.5, 3, 3.5, 4, 5, 5.5, 6]) {
      const pose = journeyPoseAt(p, LAPTOP);
      writeJourney(into, pose.at);
      expect({ stretch: into.stretch, local: into.local, project: into.project }, `at ${p}`).toEqual(journeyAt(p));
    }
    expect(into.voidState).toBe('idle'); // the void's own field: the Void writes it
  });

  it('starts at the home, with an idle void', () => {
    expect(frame.journey).toEqual({ stretch: 'rise', local: 0, project: null, voidState: 'idle' });
  });

  it('is on the debug state as a copy, voidState included', () => {
    const before = { ...frame.journey };
    try {
      Object.assign(frame.journey, { stretch: 'project', local: 0, project: 1, voidState: 'ready' });
      const state = readNeedleDebugState({ route: 'home', locale: 'nl' });
      expect(state.journey).toEqual({ stretch: 'project', local: 0, project: 1, voidState: 'ready' });
      expect(state.journey).not.toBe(frame.journey);
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

  it('hides them while the camera is above the glass in the dive: BOB from above and the descent to the opening', () => {
    // On the high tier the floor shows what lies under it, and the void's traces draw with no depth test.
    for (const a of SCREENS) {
      expect(voidShownFor(journeyPoseAt(1, a).shot)).toBe(false);
      for (let p = 1; p < 2; p += 1 / 128) {
        const shot = journeyPoseAt(p, a).shot;
        if (shot.position[1] >= 0) expect(voidShownFor(shot), `at ${p}`).toBe(false);
      }
    }
  });

  it('shows them from inside the tunnel on: the hold, the overview and every bead', () => {
    for (const a of SCREENS) {
      expect(voidShownFor(journeyPoseAt(TUNNEL_HOLD, a).shot)).toBe(true);
      for (const p of [2, 2.5, 3, 3.5, 4, 4.5, 5, 6]) expect(voidShownFor(journeyPoseAt(p, a).shot), `at ${p}`).toBe(true);
    }
  });
});

describe('selectedBead: the bead of the current project stop', () => {
  it('is none on the rise, the dive and the overview, and the project stretch\'s bead from Funcial\'s stop on', () => {
    for (const p of [0, 0.5, 1, 1.5, 2, 2.5, 2.999]) expect(selectedBead(journeyAt(p))).toBeNull();
    expect(selectedBead(journeyAt(3))).toBe(0);
    expect(selectedBead(journeyAt(3.5))).toBe(0);
    expect(selectedBead(journeyAt(4))).toBe(1);
    expect(selectedBead(journeyAt(5))).toBe(2);
    expect(selectedBead(journeyAt(6))).toBe(2);
  });
});

describe("the beads' motion clocks", () => {
  it('runs the selected bead\'s clock, and only while it is selected or hovered', () => {
    const clocks = beadClocks();
    expect(stepBeadClocks(clocks, null, null, 0.1, false)).toBe(false);
    expect(clocks.time).toEqual([0, 0, 0]);
    expect(stepBeadClocks(clocks, 1, null, 0.5, false)).toBe(true);
    expect(clocks.time).toEqual([0, 0.5, 0]);
    expect(clocks.running).toEqual([false, true, false]);
    stepBeadClocks(clocks, 1, null, 0.25, false);
    expect(clocks.time).toEqual([0, 0.75, 0]);
    // Let go: it holds where it was.
    stepBeadClocks(clocks, null, null, 1, false);
    expect(clocks.time).toEqual([0, 0.75, 0]);
    // A hovered bead runs too, beside the selected one.
    stepBeadClocks(clocks, 1, 2, 0.5, false);
    expect(clocks.time[2]).toBe(0.5);
    expect(clocks.running).toEqual([false, true, true]);
  });

  it('starts Funcial\'s clock again from 0 at each select or hover, so its abacus slides up each time', () => {
    expect(BEAD_CLOCK_RESETS).toEqual([true, false, false]);
    expect(BEADS[0].id).toBe('funcial');
    const clocks = beadClocks();
    stepBeadClocks(clocks, 0, null, 3, false);
    expect(clocks.time[0]).toBe(3);
    stepBeadClocks(clocks, null, null, 1, false);
    expect(clocks.time[0]).toBe(3);
    stepBeadClocks(clocks, null, 0, 0.25, false); // hovered: a new run
    expect(clocks.time[0]).toBe(0.25);
  });

  it('lets Jontai Energy and Cookies Clicker go on from where they stopped: their motions repeat, with nothing to slide back', () => {
    const clocks = beadClocks();
    stepBeadClocks(clocks, 2, null, 2.5, false);
    stepBeadClocks(clocks, null, null, 1, false);
    stepBeadClocks(clocks, 2, null, 0.5, false);
    expect(clocks.time[2]).toBe(3);
  });

  it('runs no clock with reduced motion: the objects stay still', () => {
    const clocks = beadClocks();
    expect(stepBeadClocks(clocks, 0, 1, 1, true)).toBe(false);
    expect(clocks.time).toEqual([0, 0, 0]);
    expect(clocks.running).toEqual([false, false, false]);
  });

  it('takes no step that is not a positive number of seconds', () => {
    const clocks = beadClocks();
    stepBeadClocks(clocks, 0, null, Number.NaN, false);
    stepBeadClocks(clocks, 0, null, -1, false);
    expect(clocks.time[0]).toBe(0);
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

describe("the step fade's stops are the journey's seven", () => {
  it('fades between 0 and 6, every stop of the dive and the void, and poses each exactly', () => {
    expect(STOPS).toEqual([0, 1, 2, 3, 4, 5, 6]);
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
    expect(source).toMatch(/setNeedleWorld\(\s*pose\.needle\s*\)/);
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

  it('gives the hold to the home scroll input from the void\'s state', () => {
    const source = read('input/useHomeScroll.ts');
    expect(source).toMatch(/hold:\s*\(\)\s*=>\s*diveHoldFor\(\s*useScene\.getState\(\)\.voidState\s*\)/);
    expect(source).toMatch(/holdChanged\(\)/);
  });
});

describe('the home\'s links when the void failed, in the stylesheet', () => {
  const css = readFileSync(fileURLToPath(new URL('../../../src/styles/base.css', import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('shows .home-nav over the scene at BOB from above once the void failed, undoing the hidden-while-3D-is-on rule', () => {
    const at = css.indexOf("html[data-3d='on'][data-void='failed'][data-rising] .home-nav {");
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
