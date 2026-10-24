import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AT_REST, asleep } from '~/engine/stillness';
import { applyEndView, clearEndView, type EndPageNode, type EndRoot, endViewFor, endWritten } from '~/scene/bob/endView';
import { type IdleClock, idleRuns, idlesAt, stirIdle } from '~/scene/bob/idle';
import { journeyAt, journeyPoseAt } from '~/scene/bob/journey';
import { IDLE_SECONDS } from '~/scene/bob/look';
import { hoversAt, selectedBead } from '~/scene/bob/voidPose';
import { phaseChangeDraws } from '~/scene/motion';
import { HOME_CHAPTERS, scrollEnd } from '~/state/chapters';
import type { Phase } from '~/state/machine';

/** The end page's stop, the scroll's end (6). */
const END = scrollEnd(HOME_CHAPTERS);

describe('endViewFor: the end view of a frame, from its night and where the story is', () => {
  it('is nothing before the night', () => {
    expect(endViewFor(0, 5, 5, 6)).toEqual({ share: 0, state: 'none' });
  });

  it('is moving on the way into the night', () => {
    expect(endViewFor(0.5, 5.5, 6, 6)).toEqual({ share: 0.5, state: 'moving' });
  });

  it('rests at the end once the story and its target are both on it', () => {
    expect(endViewFor(1, 6, 6, 6)).toEqual({ share: 1, state: 'rest' });
  });

  it('reads a night that is not a number as none', () => {
    expect(endViewFor(Number.NaN, 6, 5, 6)).toEqual({ share: 0, state: 'none' });
  });

  it('holds the share to 0..1', () => {
    expect(endViewFor(1.5, 5.9, 6, 6)).toEqual({ share: 1, state: 'moving' });
    expect(endViewFor(-0.25, 5, 5, 6)).toEqual({ share: 0, state: 'none' });
  });

  it('is moving, not at rest, while the story is still on its way to the end or on its way back from it', () => {
    expect(endViewFor(0.99, 5.99, 6, 6).state).toBe('moving');
    expect(endViewFor(1, 6, 5, 6).state).toBe('moving');
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
    /** The `--end` property as written, or '' where it is unset. */
    share: (): string => properties.get('--end') ?? '',
  };
}

/** A fake `#end`: its `inert`, and how many times it was written. */
function fakePage() {
  let inert = false;
  let writes = 0;
  const page = {
    get inert(): boolean {
      return inert;
    },
    set inert(value: boolean) {
      writes++;
      inert = value;
    },
  } satisfies EndPageNode;
  return { page, writes: (): number => writes };
}

describe('applyEndView: Home writes the end view each frame, only on change', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** One of Home's frames: the frame's journey pose at `progress`, its end view, written. */
  function frameAt(dom: ReturnType<typeof fakeRoot>, page: EndPageNode | null, written: ReturnType<typeof endWritten>, progress: number, target: number): void {
    applyEndView(endViewFor(journeyPoseAt(progress, 16 / 9).night, progress, target, END), dom.root, page, written);
  }

  it('keeps the end page inert until the story rests at it', () => {
    const dom = fakeRoot();
    const { page } = fakePage();
    const written = endWritten();

    frameAt(dom, page, written, 5, 5);
    expect([dom.end(), dom.share(), page.inert]).toEqual([null, '', true]);

    frameAt(dom, page, written, 5.5, 6);
    expect([dom.end(), dom.share(), page.inert]).toEqual(['moving', '0.5', true]);

    frameAt(dom, page, written, 6, 6);
    expect([dom.end(), dom.share(), page.inert]).toEqual(['rest', '1', false]);

    frameAt(dom, page, written, 5, 5);
    expect([dom.end(), dom.share(), page.inert]).toEqual([null, '', true]);
  });

  it('writes nothing again while the view stays the same', () => {
    const dom = fakeRoot();
    const page = fakePage();
    const written = endWritten();
    for (const [progress, target] of [
      [5, 5],
      [5.5, 6],
      [6, 6],
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
    frameAt(dom, first.page, written, 5, 5);
    expect(first.page.inert).toBe(true);
    // The home page left and came back: a new section, not inert, under a view that has not changed.
    const second = fakePage();
    frameAt(dom, second.page, written, 5, 5);
    expect(second.page.inert).toBe(true);
    // No section at all (another page is up): nothing to write, and none written to.
    frameAt(dom, null, written, 6, 6);
    expect(dom.end()).toBe('rest');
  });

  it('scrolls the page back to its top when the story leaves the end', () => {
    const dom = fakeRoot();
    const { page } = fakePage();
    const written = endWritten();
    const order: string[] = [];
    const scrollTo = vi.fn(() => order.push(`scrollTo at data-end=${dom.end()}`));
    vi.stubGlobal('window', { scrollY: 300, scrollTo });

    frameAt(dom, page, written, 6, 6);
    expect(scrollTo).not.toHaveBeenCalled();

    frameAt(dom, page, written, 5.5, 5);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    // First: the page is at its top before it leaves the flow.
    expect(order).toEqual(['scrollTo at data-end=rest']);
    expect(dom.end()).toBe('moving');

    frameAt(dom, page, written, 5.4, 5);
    frameAt(dom, page, written, 5, 5);
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('leaves the scroll alone when the page is already at its top, or the story never rested at the end', () => {
    const scrollTo = vi.fn();
    vi.stubGlobal('window', { scrollY: 0, scrollTo });
    const dom = fakeRoot();
    const { page } = fakePage();
    const written = endWritten();
    frameAt(dom, page, written, 6, 6);
    frameAt(dom, page, written, 5.5, 5);
    expect(scrollTo).not.toHaveBeenCalled();

    vi.stubGlobal('window', { scrollY: 300, scrollTo });
    frameAt(dom, page, written, 5.5, 6);
    frameAt(dom, page, written, 5, 5);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('clears the end view on let-go and unmount', () => {
    for (const [progress, target] of [
      [5.5, 6],
      [6, 6],
    ] as const) {
      const dom = fakeRoot();
      const { page } = fakePage();
      const written = endWritten();
      frameAt(dom, page, written, progress, target);
      clearEndView(dom.root, page, written);
      expect([dom.end(), dom.share(), page.inert], `from ${progress}`).toEqual([null, '', false]);
      // Cleared, the next frame writes its view again.
      frameAt(dom, page, written, 6, 6);
      expect([dom.end(), dom.share(), page.inert], `from ${progress}`).toEqual(['rest', '1', false]);
    }
  });

  it('scrolls the page back to its top when it clears a rest, and clears with no section at all', () => {
    const scrollTo = vi.fn();
    vi.stubGlobal('window', { scrollY: 300, scrollTo });
    const dom = fakeRoot();
    const { page } = fakePage();
    const written = endWritten();
    frameAt(dom, page, written, 6, 6);
    clearEndView(dom.root, null, written);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect([dom.end(), dom.share()]).toEqual([null, '']);
  });

  it('selects no bead at the end, so nothing keeps drawing', () => {
    expect(selectedBead(journeyAt(6))).toBeNull();
    expect(selectedBead(journeyAt(END))).toBeNull();
  });
});

describe('the scene sleeps as soon as the story rests at the end', () => {
  const AT_END = journeyAt(END).stretch;

  /** What Home writes into `motion.compass` with the needle settled: its idle is over unless the idle motion runs. */
  const stillness = (runs: boolean) => ({ ...AT_REST, idle: !runs, needle: 0, needleSpeed: 0 });

  it('lets the idle run everywhere but the end page', () => {
    for (const p of [0, 0.5, 1, 1.5, 2, 3, 4, 5, 5.5, 5.99]) expect(idlesAt(journeyAt(p).stretch), `at ${p}`).toBe(true);
    expect(idlesAt(AT_END)).toBe(false);
    expect(idlesAt(journeyAt(7).stretch)).toBe(false);
  });

  it('starts no idle while on a change into END, so motion.compass is at rest', () => {
    const clock: IdleClock = { idleUntil: 0, idleTime: 3, driftUntil: 0 };
    expect(stirIdle(clock, AT_END, 10_000)).toBe(false);
    expect(clock).toEqual({ idleUntil: 0, idleTime: 3, driftUntil: 0 });
    const runs = idleRuns(clock, AT_END, 10_000, false, false);
    expect(runs).toBe(false);
    expect(asleep(stillness(runs))).toBe(true);
  });

  it('stops a while still running from before at once when the story rests at 6', () => {
    const clock: IdleClock = { idleUntil: 0, idleTime: 0, driftUntil: 0 };
    // A stir at Cookies Clicker (a phase change, the move into the night) a second before.
    expect(stirIdle(clock, journeyAt(5.5).stretch, 9_000)).toBe(true);
    expect(clock.idleUntil).toBe(9_000 + IDLE_SECONDS * 1000);
    expect(idleRuns(clock, journeyAt(5.5).stretch, 10_000, false, false)).toBe(true);
    // At rest at the end, inside that while: no idle, and nothing of the compass asks for a frame.
    const runs = idleRuns(clock, AT_END, 10_000, false, false);
    expect(runs).toBe(false);
    expect(asleep(stillness(runs))).toBe(true);
    // Not even for a drifting needle with its run not over.
    expect(idleRuns({ idleUntil: 0, idleTime: 1, driftUntil: 4 }, AT_END, 10_000, false, true)).toBe(false);
  });

  it('keeps the idle as it was everywhere else: within its while, a drift on to its rest, none with reduced motion', () => {
    const clock: IdleClock = { idleUntil: 0, idleTime: 0, driftUntil: 0 };
    stirIdle(clock, 'rise', 0);
    expect(idleRuns(clock, 'rise', IDLE_SECONDS * 1000 - 1, false, false)).toBe(true);
    expect(idleRuns(clock, 'rise', IDLE_SECONDS * 1000, false, false)).toBe(false);
    expect(idleRuns({ idleUntil: 0, idleTime: 1, driftUntil: 4 }, 'rise', 10_000, false, true)).toBe(true);
    expect(idleRuns(clock, 'rise', 1, true, false)).toBe(false);
  });

  it('gives a change into END no frames of its own: the canvas is not kept drawing for the phase change', () => {
    expect(phaseChangeDraws({ kind: 'END' })).toBe(false);
    const others: Phase[] = [
      { kind: 'LOADING' },
      { kind: 'HOME_IDLE' },
      { kind: 'DIVE' },
      { kind: 'VOID_ENTRY' },
      { kind: 'PROJECTS', category: 'oscillator' },
      { kind: 'PROJECT_FOCUS', id: 'cookies-clicker' },
    ];
    for (const phase of others) expect(phaseChangeDraws(phase), phase.kind).toBe(true);
  });

  it('reads no hover at the end page, so a pointer behind the page turns no bead; everywhere else as before', () => {
    for (const p of [0, 0.5, 1, 1.5, 2, 2.5, 2.999, 3, 3.5, 4, 4.5, 5, 5.5, 5.99]) expect(hoversAt(journeyAt(p)), `at ${p}`).toBe(true);
    for (const p of [6, 7]) expect(hoversAt(journeyAt(p)), `at ${p}`).toBe(false);
    expect(hoversAt({ stretch: 'end', local: 0, project: null })).toBe(false);
  });
});

describe('way A in the stylesheet (src/styles/base.css)', () => {
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

  const MOVING = "html[data-end='moving']";
  const REST = "html[data-route='home'][data-3d='on'][data-end='rest']";
  const HOST_MOVING = "html[data-route='home'][data-end='moving'] .scene-host";
  const HOST_REST = "html[data-route='home'][data-end='rest'] .scene-host";

  it('hides the end page with 3D on while the story is not at the end, taking no room in the flow, and keeps it in the HTML', () => {
    // Out of the flow, so the 3D home is one viewport tall: no scroll can stand below its top (a reload's restored
    // place, a smooth scroll still running as 3D comes back on). With 3D off no rule hides it: it is in the home's flow.
    expect(valueOf("html[data-3d='on']:not([data-end]) .end-page", 'display')).toBe('none');
    expect(RULES.filter((rule) => rule.selectors.some((selector) => /\.end-page$/.test(selector) && !selector.includes("[data-3d='on']")) && rule.declarations.get('display') === 'none')).toEqual([]);
  });

  it('raises the page from below during the move, fixed at its place in the flow, as the night comes in', () => {
    expect(valueOf(`${MOVING} .end-page`, 'position')).toBe('fixed');
    expect(valueOf(`${MOVING} .end-page`, 'top')).toBeUndefined(); // its static place: where it stands in the flow
    expect(valueOf(`${MOVING} .end-page`, 'left')).toBe('0');
    expect(valueOf(`${MOVING} .end-page`, 'right')).toBe('0');
    expect(valueOf(`${MOVING} .end-page`, 'transform')).toBe('translateY(calc((1 - var(--end)) * 40vh))');
    expect(valueOf(`${MOVING} .end-page`, 'opacity')).toBe('var(--end)');
  });

  it('takes the hero out of the way while the end is shown, so the page stands under the header', () => {
    const hero = "html[data-route='home'][data-3d='on'][data-end] .hero";
    expect(valueOf(hero, 'min-height')).toBe('0');
    expect(valueOf(hero, 'padding')).toBe('0');
    expect(valueOf("html[data-route='home'][data-3d='on'][data-end] .hero-cue", 'pointer-events')).toBe('none');
    expect(valueOf("html[data-3d='on'][data-end] .home-nav", 'visibility')).toBe('hidden');
  });

  it('sinks the scene under the night during the move, leaving it faintly at the top', () => {
    expect(valueOf(`${HOST_MOVING}::after`, 'opacity')).toBe('calc(var(--end) * 0.86)');
    expect(valueOf(`${HOST_MOVING}`, 'mask-image')).toBe('linear-gradient(to bottom, #000 0%, rgb(0 0 0 / calc(1 - var(--end))) 33%)');
    const overlay = "html[data-route='home'][data-end] .scene-host::after";
    expect(valueOf(overlay, 'content')).toBe("''");
    expect(valueOf(overlay, 'position')).toBe('absolute');
    expect(valueOf(overlay, 'inset')).toBe('0');
    expect(valueOf(overlay, 'background')).toBe('var(--night)');
    expect(valueOf(overlay, 'pointer-events')).toBe('none');
  });

  it('holds the night at its end strength at rest, whatever --end says', () => {
    expect(valueOf(`${HOST_REST}::after`, 'opacity')).toBe('0.86');
    expect(valueOf(`${HOST_REST}`, 'mask-image')).toBe('linear-gradient(to bottom, #000 0%, transparent 33%)');
  });

  it('lets the document scroll at rest, and hides the bead labels', () => {
    expect(valueOf(REST, 'overflow-y')).toBe('auto');
    expect(valueOf(REST, 'touch-action')).toBe('auto');
    expect(valueOf("html[data-end='rest'] .bead-label", 'display')).toBe('none');
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
