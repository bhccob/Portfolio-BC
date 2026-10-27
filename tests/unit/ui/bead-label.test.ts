import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, type NavigateFunction } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { projects, type ProjectId } from '~/data/projects';
import { en } from '~/i18n/en';
import { nl } from '~/i18n/nl';
import type { Locale } from '~/i18n/Translator';
import { FLIGHT_MS } from '~/scene/bob/focus';
import { BEADS } from '~/scene/bob/journey';
import { frame } from '~/state/frame';
import { stopForProject } from '~/state/routeSync';
import { useScene } from '~/state/store';
import { BeadLabel, BeadLabels, labelFocusable, lendOpener, openBead, type PathLabelView, pathLabelPlace, registerBeadLabel, showBeadLabels } from '~/ui/BeadLabel';

/** `element` as the server renders it, on a page at `path`. */
const render = (path: string, element: ReactElement): string => renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, element));

const LOCALES = [
  ['/', 'nl', nl],
  ['/en/', 'en', en]
] as const satisfies readonly (readonly [string, Locale, typeof nl])[];

const IDS = projects.all().map((project) => project.id);

describe("the bead label's copy", () => {
  it("is spec §2.4's hint, for a pointer and for a touch screen, in both languages", () => {
    expect(nl.needle.bead).toEqual({ hint: 'Klik om te openen', hintTouch: 'Tik om te openen' });
    expect(en.needle.bead).toEqual({ hint: 'Click to open', hintTouch: 'Tap to open' });
  });
});

describe('BeadLabel, as the server renders it', () => {
  for (const [path, locale, t] of LOCALES) {
    for (const id of IDS) {
      it(`renders ${id}'s category line, its title and both hints in ${locale}, from the data`, () => {
        const project = projects.byId(id)!;
        const html = render(path, createElement(BeadLabel, { id }));
        expect(html).toContain(`>${project.category.heading(locale)}</span>`);
        expect(html).toContain(`<span class="bead-label-title">${project.title}</span>`);
        expect(html).toContain(`<span class="bead-label-hint-fine">${t.needle.bead.hint}</span>`);
        expect(html).toContain(`<span class="bead-label-hint-touch">${t.needle.bead.hintTouch}</span>`);
      });
    }
  }

  it('says "01 — BEVEILIGD ELEMENT" over Funcial in Dutch and "01 — SECURE ELEMENT" in English, the form categories.ts names', () => {
    expect(render('/', createElement(BeadLabel, { id: 'funcial' }))).toContain('>01 — BEVEILIGD ELEMENT<');
    expect(render('/en/', createElement(BeadLabel, { id: 'funcial' }))).toContain('>01 — SECURE ELEMENT<');
    expect(render('/', createElement(BeadLabel, { id: 'jontai-energy' }))).toContain('>02 — FRONTPANEEL<');
    const cookies = render('/en/', createElement(BeadLabel, { id: 'cookies-clicker' }));
    expect(cookies).toContain('>03 — OSCILLATOR<');
    expect(cookies).toContain('>Cookies Clicker<');
  });

  it('sets the category line in the site\'s mono label and the title in its heavy gold', () => {
    const html = render('/', createElement(BeadLabel, { id: 'funcial' }));
    expect(html).toMatch(/<span class="label bead-label-category">01 — BEVEILIGD ELEMENT<\/span>/);
    const css = valueOf('.bead-label-title', 'color');
    expect(css).toBe('var(--gold-title)');
    expect(valueOf('.bead-label-title', 'font-weight')).toBe('800');
  });

  for (const [path, , ] of LOCALES) {
    for (const id of IDS) {
      it(`is one link, to ${id}'s page in the language of ${path}`, () => {
        const project = projects.byId(id)!;
        const html = render(path, createElement(BeadLabel, { id }));
        const href = path === '/' ? projects.route(project) : `/en${projects.route(project)}`;
        expect(html.startsWith('<a ')).toBe(true);
        expect(html.endsWith('</a>')).toBe(true);
        expect(html.match(/<a\b/g)).toHaveLength(1);
        expect(html).toContain(`href="${href}"`);
        expect(html).not.toMatch(/<(?:button|input|select|textarea)\b/);
        expect(html).toContain(`data-bead="${id}"`);
      });
    }
  }

  it('keeps the hints out of the link\'s name: a screen reader reads the category line and the title', () => {
    const html = render('/', createElement(BeadLabel, { id: 'funcial' }));
    expect(html).toMatch(/<span class="bead-label-hint" aria-hidden="true"><span class="bead-label-hint-fine">/);
  });

  it('is never shown by the server: the scene shows it beside its bead, so without a scene there is none', () => {
    const html = render('/', createElement(BeadLabel, { id: 'funcial' }));
    expect(html).not.toContain('data-shown');
    expect(html).not.toContain('data-rest');
    expect(valueOf('.bead-label', 'display')).toBe('none');
    expect(valueOf('.bead-label[data-shown]', 'display')).not.toBe('none');
  });
});

describe('BeadLabels: the home page\'s three', () => {
  it('renders one label for each project, in the order of the void', () => {
    const html = render('/', createElement(BeadLabels));
    expect([...html.matchAll(/data-bead="([a-z-]+)"/g)].map((match) => match[1])).toEqual(BEADS.map((bead) => bead.id));
    expect(html.match(/<a\b/g)).toHaveLength(BEADS.length);
  });
});

// ---------------------------------------------------------------- the stylesheet

const base = readFileSync(fileURLToPath(new URL('../../../src/styles/base.css', import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

interface Rule {
  groups: string[];
  selectors: string[];
  declarations: Map<string, string>;
}

/** The style rules of a stylesheet with no nesting, read as tests/unit/header-loading.test.ts reads them. */
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
const COARSE = ['@media (pointer: coarse)'];

/** The value `property` takes for `selector` inside exactly `groups`, from the last rule that sets it. */
function valueOf(selector: string, property: string, groups: string[] = []): string | undefined {
  return RULES.filter((rule) => rule.selectors.includes(selector) && JSON.stringify(rule.groups) === JSON.stringify(groups))
    .map((rule) => rule.declarations.get(property))
    .filter((value) => value !== undefined)
    .at(-1);
}

describe("the look back's quiet labels", () => {
  it('take no pointer until shown, so an unseen label over another bead never takes its click or tap', () => {
    // Under each bead, a label can stand over the next one (on a phone Funcial's lies over Cookies Clicker's bead): a tap
    // there must reach the bead, not open Funcial. Shown (its bead under the pointer, or the label focused) it is a link.
    expect(valueOf('.bead-label[data-quiet]', 'pointer-events')).toBe('none');
    expect(valueOf('.bead-label[data-quiet][data-hover]', 'pointer-events')).toBe('auto');
    expect(valueOf('.bead-label[data-quiet]:focus-visible', 'pointer-events')).toBe('auto');
    expect(valueOf('.bead-label[data-quiet][data-hover]', 'opacity')).toBe('1');
    expect(valueOf('.bead-label[data-quiet]:focus-visible', 'opacity')).toBe('1');
  });

  it('stays shown while a mouse moves from its bead onto it, and only where a pointer can hover', () => {
    // Shown by its bead, it takes the pointer, so its own :hover holds it as the pointer leaves the bead for its words.
    // Unseen it takes none, so a pointer passing over it never lights it. No :hover where a finger's would stick.
    const HOVER = ['@media (hover: hover)'];
    expect(valueOf('.bead-label[data-quiet]:hover', 'opacity', HOVER)).toBe('1');
    expect(valueOf('.bead-label[data-quiet]:hover', 'pointer-events', HOVER)).toBe('auto');
    const elsewhere = RULES.filter((rule) => rule.selectors.some((s) => s.includes('[data-quiet]') && s.includes(':hover')) && JSON.stringify(rule.groups) !== JSON.stringify(HOVER));
    expect(elsewhere).toEqual([]);
  });
});

describe('the touch hint', () => {
  it('shows the pointer\'s hint ("Klik om te openen") and hides the touch one by default', () => {
    expect(valueOf('.bead-label-hint-touch', 'display')).toBe('none');
    expect(valueOf('.bead-label-hint-fine', 'display')).toBeUndefined();
  });

  it('shows the touch hint ("Tik om te openen") on a coarse pointer, and hides the pointer\'s', () => {
    expect(valueOf('.bead-label-hint-fine', 'display', COARSE)).toBe('none');
    expect(valueOf('.bead-label-hint-touch', 'display', COARSE)).toBe('inline');
  });
});

// ---------------------------------------------------------------- the placement

const SIZES = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 }
] as const;

describe('pathLabelPlace: the label beside the light at rest, or under the bead on a phone, inside the screen', () => {
  const laptop = { width: 1440, height: 900 };
  const phone = { width: 390, height: 844 };
  const view = (anchor: { x: number; y: number }, side: 'right' | 'below'): PathLabelView => ({ id: 'funcial', anchor, side, opacity: 1, quiet: false, hover: false });

  it('stands right of the light on a laptop, level with it', () => {
    expect(pathLabelPlace(view({ x: 900, y: 450 }, 'right'), { w: 300, h: 96 }, laptop)).toEqual({ x: 934, y: 402 });
  });

  it('stands under the bead on a phone, in the middle', () => {
    expect(pathLabelPlace(view({ x: 195, y: 600 }, 'below'), { w: 260, h: 88 }, phone)).toEqual({ x: 65, y: 600 });
  });

  it('holds the whole label inside the screen, 16 px from its sides, and below the header', () => {
    expect(pathLabelPlace(view({ x: 1300, y: 450 }, 'right'), { w: 300, h: 96 }, laptop).x).toBe(1124);
    expect(pathLabelPlace(view({ x: 20, y: 600 }, 'below'), { w: 260, h: 88 }, phone).x).toBe(16);
    expect(pathLabelPlace(view({ x: 900, y: 10 }, 'right'), { w: 300, h: 96 }, laptop).y).toBe(64 + 16);
    expect(pathLabelPlace(view({ x: 195, y: 840 }, 'below'), { w: 260, h: 88 }, phone).y).toBe(844 - 16 - 88);
  });

  it('reads an anchor that is not a number as the middle of the screen', () => {
    const at = pathLabelPlace(view({ x: Number.NaN, y: Number.NaN }, 'below'), { w: 260, h: 88 }, phone);
    expect(at).toEqual({ x: 65, y: 422 });
  });
});

describe('labelFocusable: Tab reaches a label only where it can be seen and clicked', () => {
  const view = (opacity: number, quiet: boolean): PathLabelView => ({ id: 'funcial', anchor: { x: 0, y: 0 }, side: 'right', opacity, quiet, hover: false });

  it('takes the look back\'s labels, which show on focus, and a fading label only once it is half in', () => {
    expect(labelFocusable(view(0, true))).toBe(true);
    expect(labelFocusable(view(0.3, false))).toBe(false);
    expect(labelFocusable(view(0.5, false))).toBe(true);
    expect(labelFocusable(view(0.9, false))).toBe(true);
  });
});

function fakeLabel() {
  const attributes = new Map<string, string>();
  return {
    attributes,
    isConnected: true,
    textContent: '01 — BEVEILIGD ELEMENT FUNCIAL',
    offsetWidth: 227,
    offsetHeight: 82,
    style: {} as Record<string, string>,
    dataset: {} as Record<string, string>,
    set tabIndex(value: number) {
      attributes.set('tabindex', String(value));
    },
    setAttribute: (name: string, value: string) => void attributes.set(name, value),
    removeAttribute: (name: string) => void attributes.delete(name),
    toggleAttribute: (name: string, on: boolean) => (on ? attributes.set(name, '') : attributes.delete(name), on),
    focus: () => {}
  };
}


describe('showBeadLabels: the labels the path shows', () => {
  const size = { width: 1440, height: 900 };
  const releases: (() => void)[] = [];
  const doc = (globalThis as { document?: unknown }).document;
  /** <main id="main" tabIndex={-1}>, as src/app/Shell.tsx renders it: the focus calls it is given. */
  const main = {
    focused: [] as unknown[],
    focus(options?: unknown) {
      this.focused.push(options);
      page.activeElement = main;
    }
  };
  const page = { activeElement: null as unknown, getElementById: (id: string) => (id === 'main' ? main : null) };
  /** A label that notes its own focus calls and takes the page's focus. */
  const focusable = () => {
    const el = fakeLabel() as ReturnType<typeof fakeLabel> & { focused: unknown[] };
    el.focused = [];
    el.focus = ((options?: unknown) => {
      el.focused.push(options);
      page.activeElement = el;
    }) as typeof el.focus;
    return el;
  };
  const arrival = (id: ProjectId, opacity: number): PathLabelView => ({ id, anchor: { x: 900, y: 450 }, side: 'right', opacity, quiet: false, hover: false });
  const quiet = (id: ProjectId, hover = false): PathLabelView => ({ id, anchor: { x: 500, y: 400 }, side: 'right', opacity: 0, quiet: true, hover });
  beforeEach(() => {
    main.focused = [];
    page.activeElement = null;
    (globalThis as { document?: unknown }).document = page;
  });
  afterEach(() => {
    showBeadLabels([], size);
    for (const release of releases.splice(0)) release();
    (globalThis as { document?: unknown }).document = doc;
  });

  it('shows the arrival\'s label at its opacity, and lets Tab and the pointer in once it is half in', () => {
    const el = focusable();
    releases.push(registerBeadLabel('funcial', el as unknown as HTMLAnchorElement));
    expect([el.attributes.get('tabindex'), el.attributes.has('inert')]).toEqual(['-1', true]);
    showBeadLabels([arrival('funcial', 0.3)], size);
    expect(el.attributes.has('data-shown')).toBe(true);
    expect(el.attributes.has('inert')).toBe(false);
    expect([el.attributes.get('tabindex'), el.attributes.has('data-rest'), el.style.opacity]).toEqual(['-1', false, '0.3']);
    showBeadLabels([arrival('funcial', 1)], size);
    expect([el.attributes.has('tabindex'), el.attributes.has('data-rest'), el.style.opacity]).toEqual([false, true, '1']);
    expect(el.style.transform).toBe('translate3d(934px, 409px, 0)'); // right of the light, level with it (82 px tall)
    showBeadLabels([], size);
    expect([...el.attributes.keys()].sort()).toEqual(['inert', 'tabindex']);
  });

  it('puts a label registered again (its link re-rendered on a navigation of the home, as an inside opens) away whole, so a hide still hides it', () => {
    const el = focusable();
    releases.push(registerBeadLabel('funcial', el as unknown as HTMLAnchorElement));
    showBeadLabels([arrival('funcial', 1)], size);
    expect(el.attributes.has('data-shown')).toBe(true);
    // React calls the link's ref again: the last registration is taken away, and the same element registered anew.
    releases.pop()!();
    releases.push(registerBeadLabel('funcial', el as unknown as HTMLAnchorElement));
    expect([...el.attributes.keys()].sort()).toEqual(['inert', 'tabindex']);
    expect(el.style.opacity).toBe('');
    showBeadLabels([], size);
    expect(el.attributes.has('data-shown')).toBe(false);
    // The next frame that shows it shows it whole again.
    showBeadLabels([arrival('funcial', 1)], size);
    expect([el.attributes.has('data-shown'), el.style.opacity, el.style.transform]).toEqual([true, '1', 'translate3d(934px, 409px, 0)']);
  });

  it("shows the look back's labels quiet: each in reach of Tab, shown on focus, and the one under the pointer", () => {
    const funcial = focusable();
    const jontai = focusable();
    releases.push(registerBeadLabel('funcial', funcial as unknown as HTMLAnchorElement), registerBeadLabel('jontai-energy', jontai as unknown as HTMLAnchorElement));
    showBeadLabels([quiet('funcial'), quiet('jontai-energy', true)], size);
    for (const el of [funcial, jontai]) {
      expect(el.attributes.has('data-shown') && el.attributes.has('data-quiet')).toBe(true);
      expect(el.attributes.has('tabindex')).toBe(false);
      expect(el.style.opacity).toBe('');
    }
    expect([funcial.attributes.has('data-hover'), jontai.attributes.has('data-hover')]).toEqual([false, true]);
    showBeadLabels([arrival('funcial', 1)], size);
    expect([funcial.attributes.has('data-quiet'), jontai.attributes.has('data-shown')]).toEqual([false, false]);
  });

  it('moves the focus to <main>, without scrolling, when a focused label hides and no label is shown after it', () => {
    const el = focusable();
    releases.push(registerBeadLabel('funcial', el as unknown as HTMLAnchorElement));
    showBeadLabels([arrival('funcial', 1)], size);
    page.activeElement = el; // Tab has reached it
    showBeadLabels([], size); // into the bead: the label goes
    expect(main.focused).toEqual([{ preventScroll: true }]);
    expect(page.activeElement).toBe(main);
  });

  it('hands it to the next label shown instead, and leaves <main> alone', () => {
    const funcial = focusable();
    const jontai = focusable();
    releases.push(registerBeadLabel('funcial', funcial as unknown as HTMLAnchorElement), registerBeadLabel('jontai-energy', jontai as unknown as HTMLAnchorElement));
    showBeadLabels([arrival('funcial', 1)], size);
    page.activeElement = funcial;
    showBeadLabels([arrival('jontai-energy', 1)], size);
    expect(jontai.focused).toEqual([{ preventScroll: true }]);
    expect(main.focused).toEqual([]);
  });

  it('moves nothing when the label that hides did not have the focus', () => {
    const el = focusable();
    releases.push(registerBeadLabel('cookies-clicker', el as unknown as HTMLAnchorElement));
    showBeadLabels([arrival('cookies-clicker', 1)], size);
    showBeadLabels([], size);
    expect(main.focused).toEqual([]);
  });
});

describe("openBead: a new opening is never cut short by the last one's timer (fix round 1, Minor 3)", () => {
  const doc = (globalThis as { document?: unknown }).document;
  const root = (() => {
    const attributes = new Set<string>();
    return {
      attributes,
      setAttribute: (name: string) => void attributes.add(name),
      removeAttribute: (name: string) => void attributes.delete(name),
      toggleAttribute: (name: string, on: boolean) => (on ? attributes.add(name) : attributes.delete(name), on)
    };
  })();
  beforeEach(() => {
    vi.useFakeTimers();
    (globalThis as { document?: unknown }).document = { documentElement: root };
    useScene.setState(useScene.getInitialState(), true);
    useScene.setState({ phase: { kind: 'PROJECTS', category: 'secure-element' } });
    frame.progress = frame.target = stopForProject('funcial'); // its arrival: a flight leaves from there
    frame.focus.opening = null;
  });
  afterEach(() => {
    vi.useRealTimers();
    (globalThis as { document?: unknown }).document = doc;
    useScene.setState(useScene.getInitialState(), true);
    frame.progress = frame.target = 0;
    frame.focus.opening = null;
    frame.focus.move = { from: { id: null, amount: 0 }, to: null, at: Number.NEGATIVE_INFINITY, mode: 'fade' };
  });

  it('keeps <html data-bead-open> until the second page has faded in, when it opens soon after the first', () => {
    const went: unknown[] = [];
    const release = lendOpener({ navigate: ((to: unknown) => void went.push(to)) as NavigateFunction, path: (id) => `/projects/${id}/` });
    try {
      expect(openBead('funcial')).toBe(true);
      expect(root.attributes.has('data-bead-open')).toBe(true);
      vi.advanceTimersByTime(FLIGHT_MS); // the flight is in: the router goes to the page
      expect(went).toEqual(['/projects/funcial/']);
      frame.focus.opening = null; // the route sync lets the bead go
      vi.advanceTimersByTime(300); // Escape back to the stop, and the label again before the first fade's timer is up
      useScene.setState({ phase: { kind: 'PROJECTS', category: 'secure-element' } });
      expect(openBead('funcial')).toBe(true);
      vi.advanceTimersByTime(FLIGHT_MS);
      expect(went).toHaveLength(2);
      vi.advanceTimersByTime(700); // past where the first opening's timer would have taken it away
      expect(root.attributes.has('data-bead-open')).toBe(true);
      vi.advanceTimersByTime(400); // the second page has faded in
      expect(root.attributes.has('data-bead-open')).toBe(false);
    } finally {
      release();
    }
  });
});
