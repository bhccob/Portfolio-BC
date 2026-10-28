import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AngleSpring, wrapAngle } from '~/engine/AngleSpring';
import { NEEDLE_SPRING } from '~/engine/bob/needleAim';
import { AT_REST, asleep } from '~/engine/stillness';
import { END_SETTLED, follow } from '~/input/scrollLoop';
import { applyEndView, BLACK, clearEndView, type EndPageNode, type EndRoot, endViewFor, endWritten } from '~/scene/bob/endView';
import { idleRuns, needleRests } from '~/scene/bob/idle';
import { journeyAt, journeyPoseAt, WORLD_PROJECTS } from '~/scene/bob/journey';
import { ease } from '~/scene/bob/worldPath';
import { easeHover, hoversAt, pointerMode } from '~/scene/bob/voidPose';
import { phaseChangeDraws } from '~/scene/motion';
import { HOME_CHAPTERS, scrollEnd, sheetStart } from '~/state/chapters';
import type { Phase } from '~/state/machine';

/** The credits' stop, the scroll's end. */
const END = scrollEnd(HOME_CHAPTERS);

/** The look back's own stop, where the sheet begins: one unit short of the end. */
const S = sheetStart(HOME_CHAPTERS);

/** Half way over the sheet: the black nearly whole, the credits not yet rising. */
const MID = S + 0.5;

/** Cookies Clicker's place on the world: the last project. */
const COOKIES = WORLD_PROJECTS.indexOf('cookies-clicker');

describe('endViewFor: the end view of a frame, from its sheet and where the story is', () => {
  it('is nothing before the sheet', () => {
    expect(endViewFor(0, 5, 5, 6)).toEqual({ share: 0, black: 0, rise: 0, state: 'none' });
  });

  it('is moving as the sheet comes up', () => {
    expect(endViewFor(0.5, 5.5, 6, 6)).toEqual({ share: 0.5, black: ease(0.5 / BLACK), rise: 0, state: 'moving' });
  });

  it('rests at the end once the story and its target are both on it', () => {
    expect(endViewFor(1, 6, 6, 6)).toEqual({ share: 1, black: 1, rise: 1, state: 'rest' });
  });

  it('reads a sheet that is not a number as none', () => {
    expect(endViewFor(Number.NaN, 6, 5, 6)).toEqual({ share: 0, black: 0, rise: 0, state: 'none' });
  });

  it('holds the share to 0..1', () => {
    expect(endViewFor(1.5, 5.9, 6, 6)).toEqual({ share: 1, black: 1, rise: 1, state: 'moving' });
    expect(endViewFor(-0.25, 5, 5, 6)).toEqual({ share: 0, black: 0, rise: 0, state: 'none' });
  });

  it('is moving, not at rest, while the story is still on its way to the end or on its way back from it', () => {
    expect(endViewFor(0.99, 5.99, 6, 6).state).toBe('moving');
    expect(endViewFor(1, 6, 5, 6).state).toBe('moving');
  });

  it('fades to black over the sheet’s first 0.55, then raises the credits', () => {
    expect(BLACK).toBe(0.55);
    expect(endViewFor(0.3, 1, 1, 2)).toMatchObject({ black: expect.closeTo(ease(0.3 / 0.55), 12), rise: 0, state: 'moving' });
    expect(endViewFor(0.55, 1, 1, 2)).toMatchObject({ black: 1, rise: 0 });
    // Half way through the rise it has come seven eighths of the way: it eases out, 1 - (1 - x)³.
    expect(endViewFor(0.775, 1, 1, 2)).toMatchObject({ black: 1, rise: expect.closeTo(0.875, 12) });
    expect(endViewFor(1, 2, 2, 2)).toMatchObject({ black: 1, rise: 1, state: 'rest' });
    const rises = [0.56, 0.6, 0.7, 0.8, 0.9, 0.99].map((share) => endViewFor(share, 1, 1, 2).rise);
    for (let k = 1; k < rises.length; k++) expect(rises[k]).toBeGreaterThan(rises[k - 1]);
  });

  it('looks arrived at the move’s 99 %, where the scroll lets it rest: "Q&A" within half a pixel of its place at rest', () => {
    // The scroll rests the move into the credits once it is within END_SETTLED of the end (Ruling 18); the credits then
    // stand in the flow. Their column slides 45 % of the screen over the rise: on a screen 1000 px tall, what is left of
    // the rise there must be under half a pixel, or "Q&A" jumps as the move comes to rest.
    expect(END_SETTLED).toBe(0.01);
    const left = 1 - endViewFor(1 - END_SETTLED, 1, 1, 2).rise;
    expect(left * 0.45 * 1000).toBeLessThan(0.5);
  });
});

/** A fake <html>: its attributes and its style's custom properties, and every write to either, in order. */
function fakeRoot() {
  const attributes = new Map<string, string>();
  const properties = new Map<string, string>();
  const writes: string[] = [];
  const root = {
    style: {
      setProperty(name: string, value: string): void {
        writes.push(`set ${name} ${value}`);
        properties.set(name, value);
      },
      removeProperty(name: string): string {
        writes.push(`remove ${name}`);
        const value = properties.get(name) ?? '';
        properties.delete(name);
        return value;
      },
    },
    setAttribute(name: string, value: string): void {
      writes.push(`attr ${name}=${value}`);
      attributes.set(name, value);
    },
    removeAttribute(name: string): void {
      writes.push(`attr ${name} removed`);
      attributes.delete(name);
    },
  } satisfies EndRoot;
  return {
    root,
    writes,
    /** `<html data-end>`, or null. */
    end: (): string | null => attributes.get('data-end') ?? null,
    /** The `--end-black` and `--end-rise` properties as written, each '' where it is unset. */
    black: (): string => properties.get('--end-black') ?? '',
    rise: (): string => properties.get('--end-rise') ?? '',
  };
}

/** A fake `#end`: its `inert`, how many times it was written, and each time it was brought into view (with what). */
function fakePage() {
  let inert = false;
  let writes = 0;
  const intoView: ScrollIntoViewOptions[] = [];
  const page = {
    get inert(): boolean {
      return inert;
    },
    set inert(value: boolean) {
      writes++;
      inert = value;
    },
    scrollIntoView(options: ScrollIntoViewOptions): void {
      intoView.push(options);
    },
  } satisfies EndPageNode;
  return { page, writes: (): number => writes, intoView };
}

describe('applyEndView: Home writes the end view each frame, only on change', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** One of Home's frames: the frame's journey pose at `progress`, its end view, written. */
  function frameAt(dom: ReturnType<typeof fakeRoot>, page: EndPageNode | null, written: ReturnType<typeof endWritten>, progress: number, target: number): void {
    applyEndView(endViewFor(journeyPoseAt(progress, 16 / 9).sheet, progress, target, END), dom.root, page, written);
  }

  it('keeps the end page inert until the story rests at it', () => {
    const dom = fakeRoot();
    const { page } = fakePage();
    const written = endWritten();

    frameAt(dom, page, written, S, S);
    expect([dom.end(), dom.black(), dom.rise(), page.inert]).toEqual([null, '', '', true]);

    // Half way over the sheet: nearly black, nothing risen yet.
    frameAt(dom, page, written, MID, END);
    expect([dom.end(), dom.rise(), page.inert]).toEqual(['moving', '', true]);
    expect(Number(dom.black())).toBeCloseTo(ease(0.5 / BLACK), 9);

    frameAt(dom, page, written, END, END);
    expect([dom.end(), dom.black(), dom.rise(), page.inert]).toEqual(['rest', '1', '1', false]);

    frameAt(dom, page, written, S, S);
    expect([dom.end(), dom.black(), dom.rise(), page.inert]).toEqual([null, '', '', true]);
  });

  it('writes the rise once the black is whole: three quarters over the sheet, the credits seven eighths risen', () => {
    const dom = fakeRoot();
    const { page } = fakePage();
    frameAt(dom, page, endWritten(), S + 0.775, END);
    expect(dom.black()).toBe('1');
    expect(Number(dom.rise())).toBeCloseTo(0.875, 9);
  });

  it('writes nothing again while the view stays the same', () => {
    const dom = fakeRoot();
    const page = fakePage();
    const written = endWritten();
    for (const [progress, target] of [
      [S, S],
      [MID, END],
      [END, END],
    ] as const) {
      frameAt(dom, page.page, written, progress, target);
      const writes = dom.writes.length;
      const inertWrites = page.writes();
      frameAt(dom, page.page, written, progress, target);
      frameAt(dom, page.page, written, progress, target);
      expect(dom.writes.length, `at ${progress}`).toBe(writes);
      expect(page.writes(), `at ${progress}`).toBe(inertWrites);
    }
  });

  it('writes the inert of a new #end afresh, as the home page renders a new one each time it comes back', () => {
    const dom = fakeRoot();
    const first = fakePage();
    const written = endWritten();
    frameAt(dom, first.page, written, S, S);
    expect(first.page.inert).toBe(true);
    // The home page left and came back: a new section, not inert, under a view that has not changed.
    const second = fakePage();
    frameAt(dom, second.page, written, S, S);
    expect(second.page.inert).toBe(true);
    // No section at all (another page is up): nothing to write, and none written to.
    frameAt(dom, null, written, END, END);
    expect(dom.end()).toBe('rest');
  });

  it('scrolls the page back to its top when the story leaves the end', () => {
    const dom = fakeRoot();
    const { page } = fakePage();
    const written = endWritten();
    const order: string[] = [];
    const scrollTo = vi.fn(() => order.push(`scrollTo at data-end=${dom.end()}`));
    const win = { scrollY: 0, scrollTo };
    vi.stubGlobal('window', win);

    frameAt(dom, page, written, END, END);
    expect(scrollTo).not.toHaveBeenCalled();
    win.scrollY = 300; // the visitor scrolls the page down

    frameAt(dom, page, written, MID, S);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    // First: the page is at its top before it leaves the flow.
    expect(order).toEqual(['scrollTo at data-end=rest']);
    expect(dom.end()).toBe('moving');

    frameAt(dom, page, written, S + 0.4, S);
    frameAt(dom, page, written, S, S);
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('brings the page to its top as the view comes to rest, so a jump straight there (a step fade) shows its title, as the move did', () => {
    // A keyboard visitor Tabbed through the nav's links (focused, the nav shows in the flow and the document scrolls to
    // them), then End's step fade jumps from the home straight to the rest: the page must stand at its top, not at 257.
    const dom = fakeRoot();
    const order: string[] = [];
    const scrollTo = vi.fn(() => order.push(`scrollTo at data-end=${dom.end()}`));
    vi.stubGlobal('window', { scrollY: 257, scrollTo });
    const { page } = fakePage();
    const written = endWritten();
    frameAt(dom, page, written, 0, 0);
    frameAt(dom, page, written, END, END);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    expect(order).toEqual(['scrollTo at data-end=rest']);
    frameAt(dom, page, written, END, END);
    expect(scrollTo).toHaveBeenCalledTimes(1); // only on the way in
  });

  it('leaves the scroll alone when the page is already at its top, or the story never rested at the end', () => {
    const scrollTo = vi.fn();
    vi.stubGlobal('window', { scrollY: 0, scrollTo });
    const dom = fakeRoot();
    const { page } = fakePage();
    const written = endWritten();
    frameAt(dom, page, written, END, END);
    frameAt(dom, page, written, MID, S);
    expect(scrollTo).not.toHaveBeenCalled();

    vi.stubGlobal('window', { scrollY: 300, scrollTo });
    frameAt(dom, page, written, MID, END);
    frameAt(dom, page, written, S, S);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('clears the end view on let-go and unmount', () => {
    for (const [progress, target] of [
      [MID, END],
      [S + 0.775, END],
      [END, END],
    ] as const) {
      const dom = fakeRoot();
      const { page } = fakePage();
      const written = endWritten();
      frameAt(dom, page, written, progress, target);
      clearEndView(dom.root, page, written);
      expect([dom.end(), dom.black(), dom.rise(), page.inert], `from ${progress}`).toEqual([null, '', '', false]);
      // Cleared, the next frame writes its view again.
      frameAt(dom, page, written, END, END);
      expect([dom.end(), dom.black(), dom.rise(), page.inert], `from ${progress}`).toEqual(['rest', '1', '1', false]);
    }
  });

  it('scrolls the page back to its top when it clears a rest, and clears with no section at all', () => {
    const scrollTo = vi.fn();
    const win = { scrollY: 0, scrollTo };
    vi.stubGlobal('window', win);
    const dom = fakeRoot();
    const { page } = fakePage();
    const written = endWritten();
    frameAt(dom, page, written, END, END);
    win.scrollY = 300; // the visitor scrolls the page down
    clearEndView(dom.root, null, written);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect([dom.end(), dom.black(), dom.rise()]).toEqual([null, '', '']);
  });

  it('keeps the scroll to the top for a let-go at rest, the section there: the scene stays and the end leaves the flow', () => {
    const scrollTo = vi.fn();
    const win = { scrollY: 0, scrollTo };
    vi.stubGlobal('window', win);
    const dom = fakeRoot();
    const { page, intoView } = fakePage();
    const written = endWritten();
    frameAt(dom, page, written, END, END);
    win.scrollY = 300; // the visitor scrolls the page down
    clearEndView(dom.root, page, written, 'let-go');
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    expect(intoView).toEqual([]);
  });

  it('brings the end page into view when Home goes at rest (3D switched off at the end), not the top: the hero is in the flow again', () => {
    const order: string[] = [];
    const scrollTo = vi.fn();
    vi.stubGlobal('window', { scrollY: 0, scrollTo });
    const dom = fakeRoot();
    const fake = fakePage();
    const page = {
      get inert(): boolean {
        return fake.page.inert;
      },
      set inert(value: boolean) {
        fake.page.inert = value;
      },
      scrollIntoView(options: ScrollIntoViewOptions): void {
        // Into view once the end view is gone: the 3D-off home's flow is the one measured, the page not inert.
        order.push(`into view at data-end=${dom.end()}, --end-black '${dom.black()}', --end-rise '${dom.rise()}', inert ${fake.page.inert}`);
        fake.page.scrollIntoView(options);
      },
    } satisfies EndPageNode;
    const written = endWritten();
    frameAt(dom, page, written, END, END);
    clearEndView(dom.root, page, written, 'gone');
    expect(scrollTo).not.toHaveBeenCalled();
    expect(fake.intoView).toEqual([{ block: 'start', behavior: 'instant' }]);
    expect(order).toEqual(["into view at data-end=null, --end-black '', --end-rise '', inert false"]);
    expect(written).toEqual(endWritten());
  });

  it('scrolls nothing when Home goes with no section in the document (another page is up), nor when the view was not at rest', () => {
    const scrollTo = vi.fn();
    vi.stubGlobal('window', { scrollY: 300, scrollTo });
    // At rest, but the home page is not up: the document is that page's, and is left where it is.
    const dom = fakeRoot();
    const written = endWritten();
    frameAt(dom, null, written, END, END);
    clearEndView(dom.root, null, written, 'gone');
    expect(scrollTo).not.toHaveBeenCalled();
    expect([dom.end(), dom.black(), dom.rise()]).toEqual([null, '', '']);
    // On the move, or before the black: the page was never in the flow to keep.
    for (const [progress, target] of [
      [MID, END],
      [S, S],
    ] as const) {
      const moving = fakeRoot();
      const { page, intoView } = fakePage();
      const at = endWritten();
      frameAt(moving, page, at, progress, target);
      clearEndView(moving.root, page, at, 'gone');
      expect(intoView, `from ${progress}`).toEqual([]);
    }
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('lets the pointer take no project at the end, so nothing keeps drawing', () => {
    expect(END - S).toBeCloseTo(1, 12);
    expect(pointerMode(journeyPoseAt(END, 16 / 9))).toBeNull();
  });
});

describe('the scene sleeps as soon as the story rests at the end', () => {
  /** What Home writes into `motion.compass` with the needle settled: its idle is over unless the idle motion runs. */
  const stillness = (runs: boolean) => ({ ...AT_REST, idle: !runs, needle: 0, needleSpeed: 0 });

  it('puts a needle still swinging from the home at rest on the first frame at the end, so the compass asks for no frame (Ruling 19)', () => {
    // A pointer moved at the home just before End: the needle swings from 0 toward 1.2 rad (NEEDLE_SPRING settles in
    // about 3.5 s), and the move to the end page takes about 1.4 s. Each frame as Home runs it: the rule, then the step.
    const spring = new AngleSpring(NEEDLE_SPRING.zeta, NEEDLE_SPRING.omega);
    const target = 1.2;
    const dt = 1 / 60;
    const frameAt = (p: number) => {
      const at = journeyAt(p);
      if (needleRests(at, false)) spring.set(target, 0);
      spring.step(target, dt);
      const runs = idleRuns({ idleUntil: 0, idleTime: 0, driftUntil: 0 }, at, 0, false, false);
      return asleep({ ...AT_REST, idle: !runs, needle: wrapAngle(target - spring.value), needleSpeed: spring.velocity });
    };
    for (let i = 0; i < 84; i++) frameAt(0.5); // 1.4 s up the rise (the needle in view, still swinging)
    expect(asleep({ ...AT_REST, needle: wrapAngle(target - spring.value), needleSpeed: spring.velocity }), 'still swinging on the way').toBe(false);
    expect(frameAt(END), 'the first frame at rest at the end').toBe(true);
    expect([spring.value, spring.velocity]).toEqual([wrapAngle(target), 0]);
    // Leaving the end page it goes on from there, still: nothing swings back.
    expect(frameAt(END - 0.01)).toBe(true);
    expect(spring.velocity).toBe(0);
  });

  it('gives a change into END no frames of its own: the canvas is not kept drawing for the phase change', () => {
    expect(phaseChangeDraws({ kind: 'END' })).toBe(false);
    const others: Phase[] = [
      { kind: 'LOADING' },
      { kind: 'HOME_IDLE' },
      { kind: 'LIGHT' },
      { kind: 'PROJECTS', category: 'game' },
      { kind: 'PROJECT_FOCUS', id: 'cookies-clicker' },
    ];
    for (const phase of others) expect(phaseChangeDraws(phase), phase.kind).toBe(true);
  });

  it('reads the pointer (hover and click) at the look back\'s own stop, and not once the sheet has begun', () => {
    const at = (p: number) => hoversAt(journeyPoseAt(p, 16 / 9));
    // At the look back's own stop a click on any bead opens it.
    expect(at(S)).toBe(true);
    expect(pointerMode(journeyPoseAt(S, 16 / 9))).toBe('any');
    // The sheet, either way, and the credits: the black comes over the look back, so nothing is read.
    for (const p of [S + 0.01, MID, S + 0.775, END - 0.01, END]) expect(at(p), `at ${p}`).toBe(false);
    // Everywhere before the sheet as before: the rise, the light dive, the path and the look back.
    for (const p of [0, 0.5, 1, 2, 3, 4, 6, 8, 10, 12, 13, S - 0.001, S]) expect(at(p), `at ${p}`).toBe(true);
    expect(hoversAt({ sheet: 0 })).toBe(true);
    expect(hoversAt({ sheet: 1e-6 })).toBe(false);
    expect(hoversAt({ sheet: Number.NaN }), 'NaN reads as no sheet, as the end view reads it').toBe(true);
  });

  it('lets a hover lit at the look back ease out as the black comes up, so at rest at the end nothing of the beads asks for a frame', () => {
    // The move from the look back's stop to the end as the scroll loop's follow makes it (landed exactly on the end), a
    // frame at a time, with the pointer on Cookies Clicker's bead throughout and its hover lit as the move begins; each
    // frame the Void reads the pointer only where `hoversAt` lets it.
    const story = { progress: S };
    const hover = { id: COOKIES as number | null, amount: 1 };
    const dt = 1 / 60;
    let t = 0;
    let lastEased = -1;
    let easing = true;
    while (story.progress !== END) {
      t += dt;
      story.progress = follow(story.progress, END, dt);
      const pose = journeyPoseAt(story.progress, 16 / 9);
      const pointed = hoversAt(pose) ? COOKIES : null;
      easing = easeHover(hover, pointed, dt, false);
      if (easing) lastEased = t;
    }
    // At rest: the hover is out and still, and no bead is selected at the end.
    expect([hover.id, hover.amount, easing, pointerMode(journeyPoseAt(END, 16 / 9))]).toEqual([null, 0, false, null]);
    // It went out early in the move, its ease-out (about 0.55 s) done well before the rest: none of it after.
    expect(lastEased).toBeGreaterThan(0);
    expect(t - lastEased).toBeGreaterThan(0.6);
  });
});

describe('the credits over the scene in the stylesheet (src/styles/base.css)', () => {
  const base = readFileSync(fileURLToPath(new URL('../../../src/styles/base.css', import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  /** A style rule of base.css: the at-rules it sits in (outermost first), its selectors and its declarations. */
  interface Rule {
    groups: string[];
    selectors: string[];
    declarations: Map<string, string>;
  }

  /** The style rules of a stylesheet with no nesting, read as tests/unit/scene/bob-rising.test.ts reads them. */
  function rulesOf(css: string): Rule[] {
    const rules: Rule[] = [];
    const groups: string[] = [];
    let mark = 0;
    for (let i = 0; i < css.length; i++) {
      const ch = css[i];
      if (ch === '{') {
        const prelude = css.slice(mark, i).trim().replace(/\s+/g, ' ');
        if (prelude.startsWith('@')) {
          groups.push(prelude);
          mark = i + 1;
          continue;
        }
        const end = css.indexOf('}', i);
        const declarations = new Map<string, string>();
        for (const part of css.slice(i + 1, end).split(';')) {
          const colon = part.indexOf(':');
          if (colon > 0) declarations.set(part.slice(0, colon).trim(), part.slice(colon + 1).trim().replace(/\s+/g, ' '));
        }
        rules.push({ groups: [...groups], selectors: prelude.split(',').map((s) => s.trim()), declarations });
        i = end;
        mark = end + 1;
      } else if (ch === '}') {
        groups.pop();
        mark = i + 1;
      } else if (ch === ';') {
        mark = i + 1;
      }
    }
    return rules;
  }

  const RULES = rulesOf(base);

  /** The value `property` takes for `selector` outside any at-rule, from the last rule that sets it. */
  function valueOf(selector: string, property: string): string | undefined {
    return RULES.filter((rule) => rule.selectors.includes(selector) && rule.groups.length === 0)
      .map((rule) => rule.declarations.get(property))
      .filter((value) => value !== undefined)
      .at(-1);
  }

  const MOVING = "html[data-route='home'][data-3d='on'][data-end='moving']";
  const AT_END = "html[data-route='home'][data-3d='on'][data-end]";
  const REST = "html[data-route='home'][data-3d='on'][data-end='rest']";
  const HOST_MOVING = "html[data-route='home'][data-end='moving'] .scene-host";
  const HOST_REST = "html[data-route='home'][data-end='rest'] .scene-host";

  it('hides the end page with 3D on while the story is not at the end, taking no room in the flow, and keeps it in the HTML', () => {
    // Out of the flow, so the 3D home is one viewport tall: no scroll can stand below its top (a reload's restored
    // place, a smooth scroll still running as 3D comes back on). With 3D off no rule hides it: it is in the home's flow.
    expect(valueOf("html[data-3d='on']:not([data-end]) .end-page", 'display')).toBe('none');
    expect(RULES.filter((rule) => rule.selectors.some((selector) => /\.end-page$/.test(selector) && !selector.includes("[data-3d='on']")) && rule.declarations.get('display') === 'none')).toEqual([]);
  });

  it('fades the look back to black and raises the credits during the move: a screen tall, fixed, "Q&A" where it stands at rest', () => {
    expect(valueOf(`${MOVING} .end-page`, 'position')).toBe('fixed');
    expect(valueOf(`${MOVING} .end-page`, 'top')).toBe('0');
    expect(valueOf(`${MOVING} .end-page`, 'left')).toBe('0');
    expect(valueOf(`${MOVING} .end-page`, 'right')).toBe('0');
    expect(valueOf(`${MOVING} .end-page`, 'height')).toBe('100dvh');
    expect(valueOf(`${MOVING} .end-page`, 'overflow')).toBe('hidden');
    expect(valueOf("html[data-route='home'][data-3d='on'][data-end] .site-header", 'z-index')).toBe('3');
    // "Q&A" at 55 % of the screen: moving, the page's own padding from the screen's top; at rest, under the header in the
    // flow. The moving rule names the whole state, so it outweighs the one at the end.
    expect(valueOf(`${MOVING} .end-page`, 'padding-top')).toBe('55dvh');
    expect(valueOf(`${AT_END} .end-page`, 'padding-top')).toBe('calc(55dvh - var(--header-height))');
    // Its night is the black's share of the night; the page itself neither slides nor fades.
    expect(valueOf(`${MOVING} .end-page`, 'background')).toBe('rgb(4 2 9 / var(--end-black, 0))');
    expect(valueOf(`${MOVING} .end-page`, 'transform')).toBeUndefined();
    expect(valueOf(`${MOVING} .end-page`, 'opacity')).toBeUndefined();
    // The column slides up with the rise: at 0 its "Q&A" stands at the screen's foot (55 + 45 = 100 %), at 1 on its pixel at rest.
    const transform = valueOf(`${MOVING} .end-roll`, 'transform');
    expect(transform).toBe('translateY(calc((1 - var(--end-rise, 0)) * 45dvh))');
    expect(55 + Number(/\* (\d+)dvh\)\)$/.exec(transform ?? '')?.[1])).toBe(100);
  });

  it("makes the nav's end link one of the nav's ways in whenever 3D is on, whatever the void's state, and none with 3D off", () => {
    // With 3D on (the void ready, loading or failed) it is shown in the nav: hidden with the nav, and shown with it while
    // it has the focus (`html[data-3d='on'] .home-nav:not(:focus-within)`), or over the scene where a failed void holds.
    expect(valueOf("html[data-3d='on'] .end-link", 'display')).toBe('inline-flex');
    expect(RULES.filter((rule) => rule.selectors.some((s) => s.includes('.end-link') && s.includes("[data-void='failed']")) && rule.declarations.has('display'))).toEqual([]);
    // With 3D off the end page is in the home's flow right after the nav: no link to it.
    expect(valueOf('.end-link', 'display')).toBe('none');
    expect(RULES.filter((rule) => rule.selectors.some((s) => s.includes('.end-link') && !s.includes("[data-3d='on']")) && rule.declarations.get('display') !== undefined && rule.declarations.get('display') !== 'none')).toEqual([]);
    // The nav hides it with its links while 3D is on and nothing in it has the focus.
    expect(valueOf("html[data-3d='on'] .home-nav:not(:focus-within)", 'clip-path')).toBe('inset(50%)');
  });

  it('takes the hero out of the way while the end is shown, so the page stands under the header', () => {
    const hero = "html[data-route='home'][data-3d='on'][data-end] .hero";
    expect(valueOf(hero, 'min-height')).toBe('0');
    expect(valueOf(hero, 'padding')).toBe('0');
    expect(valueOf("html[data-route='home'][data-3d='on'][data-end] .hero-cue", 'pointer-events')).toBe('none');
    expect(valueOf("html[data-3d='on'][data-end] .home-nav", 'visibility')).toBe('hidden');
    // And out of the flow, focus or not: its end link, pressed, may hold the focus as the page rises under the header.
    expect(valueOf("html[data-3d='on'][data-end] .home-nav", 'position')).toBe('absolute');
    expect(valueOf("html[data-3d='on'][data-end] .home-nav", 'height')).toBe('1px');
    expect(valueOf("html[data-3d='on'][data-end] .home-nav", 'clip-path')).toBe('inset(50%)');
  });

  it('lays the page over the look back opaque at rest, full width and up behind the header: no mask over the scene', () => {
    const sheet = "html[data-route='home'][data-3d='on'][data-end='rest'] .end-page";
    expect(valueOf(sheet, 'border-image')).toBe('linear-gradient(var(--night) 0 0) fill 0 / 0 / var(--header-height) 100vmax 0');
    expect(valueOf(sheet, 'min-height')).toBe('calc(100dvh - var(--header-height))');
    // The scene is not dimmed or masked: the sheet itself covers it.
    for (const rule of RULES) {
      if (!rule.selectors.some((selector) => selector.includes('data-end') && selector.includes('.scene-host'))) continue;
      expect(rule.declarations.has('mask-image'), rule.selectors.join(', ')).toBe(false);
      expect(rule.declarations.has('opacity'), rule.selectors.join(', ')).toBe(false);
      expect(rule.selectors.some((selector) => selector.endsWith('::after')), rule.selectors.join(', ')).toBe(false);
    }
    expect(valueOf(`${HOST_MOVING}`, 'mask-image')).toBeUndefined();
    expect(valueOf(`${HOST_REST}`, 'mask-image')).toBeUndefined();
  });

  it('keeps the end page at rest in the flow, scrolling natively, as before', () => {
    const rest = RULES.filter((rule) => rule.selectors.some((selector) => selector.includes("[data-end='rest']") && selector.endsWith('.end-page')));
    for (const rule of rest) expect(rule.declarations.get('position'), rule.selectors.join(', ')).not.toBe('fixed');
    expect(valueOf(REST, 'overflow-y')).toBe('auto');
  });

  it("lets the document scroll at rest, and hides the world's names, an area's words and the dots", () => {
    expect(valueOf(REST, 'overflow-y')).toBe('auto');
    expect(valueOf(REST, 'touch-action')).toBe('auto');
    for (const part of ['.world-lines', '.world-name', '.world-hint', '.area-caption', '.area-dots', '.touch-points']) {
      expect(valueOf(`html[data-end='rest'] ${part}`, 'display'), part).toBe('none');
    }
    // The home's lock stays as it was everywhere else.
    expect(valueOf("html[data-route='home'][data-3d='on']", 'overflow')).toBe('hidden');
    expect(valueOf("html[data-route='home'][data-3d='on']", 'touch-action')).toBe('pinch-zoom');
  });

  it('keeps the header, the page, the scene and the poster as wide as the viewport while the end shows, so a scrollbar coming in at rest overlays them and moves nothing', () => {
    const END_SHOWN = "html[data-route='home'][data-3d='on'][data-end]";
    expect(valueOf(`${END_SHOWN} .site-header`, 'width')).toBe('100vw');
    expect(valueOf(`${END_SHOWN} .end-page`, 'width')).toBe('100vw');
    for (const layer of ['.scene-host', '.poster']) {
      expect(valueOf(`${END_SHOWN} ${layer}`, 'right'), layer).toBe('auto');
      expect(valueOf(`${END_SHOWN} ${layer}`, 'width'), layer).toBe('100vw');
    }
    // No gutter kept for it: the home shows no strip at its edge anywhere else.
    for (const rule of RULES) expect(rule.declarations.has('scrollbar-gutter'), rule.selectors.join(', ')).toBe(false);
  });

  it('draws nothing of the end over a page of text, as data-end may outlive the home page', () => {
    for (const rule of RULES) {
      if (!rule.selectors.some((s) => s.includes('data-end') && s.includes('.scene-host'))) continue;
      for (const selector of rule.selectors) expect(selector).toContain("[data-route='home']");
    }
  });
});
