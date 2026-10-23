import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { projects, type ProjectId } from '~/data/projects';
import { en } from '~/i18n/en';
import { nl } from '~/i18n/nl';
import type { Locale } from '~/i18n/Translator';
import { BEADS, journeyPoseAt } from '~/scene/bob/journey';
import { BeadLabel, BeadLabels, LABEL_BOX, labelMargin, labelPlacement, stopRadius } from '~/ui/BeadLabel';

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

/** NDC from -1 to 1 in steps of 0.05, both ends included. */
const NDC = Array.from({ length: 41 }, (_, i) => -1 + i * 0.05);

describe('labelPlacement: the label beside its bead, inside the screen', () => {
  it('keeps 16 px from the edges on a laptop and 24 px on a phone', () => {
    expect(labelMargin(1440)).toBe(16);
    expect(labelMargin(390)).toBe(24);
  });

  for (const size of SIZES) {
    it(`keeps the whole box inside at ${size.width}x${size.height}, with its margin, for any NDC in -1..1`, () => {
      const m = labelMargin(size.width);
      const box = size.width < 720 ? LABEL_BOX.phone : LABEL_BOX.laptop;
      for (const x of NDC) {
        for (const y of NDC) {
          const at = labelPlacement({ x, y }, size);
          const where = `NDC (${x.toFixed(2)}, ${y.toFixed(2)}): ${JSON.stringify(at)}`;
          expect(at.x, where).toBeGreaterThanOrEqual(m);
          expect(at.y, where).toBeGreaterThanOrEqual(m);
          expect(at.x + box.width, where).toBeLessThanOrEqual(size.width - m);
          expect(at.y + box.height, where).toBeLessThanOrEqual(size.height - m);
        }
      }
    });

    it(`keeps a measured box and the bead's own radius inside too, at ${size.width}x${size.height}`, () => {
      const m = labelMargin(size.width);
      const box = { width: 240, height: 70 };
      for (const radius of [0, 40, 180, 400]) {
        for (const x of NDC) {
          for (const y of NDC) {
            const at = labelPlacement({ x, y }, size, { radius, box });
            expect(at.x).toBeGreaterThanOrEqual(m);
            expect(at.y).toBeGreaterThanOrEqual(m);
            expect(at.x + box.width).toBeLessThanOrEqual(size.width - m);
            expect(at.y + box.height).toBeLessThanOrEqual(size.height - m);
          }
        }
      }
    });
  }

  it("is right of the bead on a laptop at the bead's stop (the bead in the middle), clear of its edge and level with it", () => {
    const size = SIZES[1];
    const at = labelPlacement({ x: 0, y: 0 }, size);
    const radius = stopRadius(size);
    expect(at.side).toBe('right');
    expect(at.x).toBeGreaterThan(size.width / 2 + radius);
    expect(at.y + LABEL_BOX.laptop.height / 2).toBeCloseTo(size.height / 2, 6);
  });

  it('goes below the bead on a phone, where neither side has room, clear of it and in the middle', () => {
    const size = SIZES[0];
    const at = labelPlacement({ x: 0, y: 0 }, size);
    expect(at.side).toBe('below');
    expect(at.y).toBeGreaterThan(size.height / 2 + stopRadius(size));
    expect(at.x + LABEL_BOX.phone.width / 2).toBeCloseTo(size.width / 2, 6);
  });

  it('goes to the left of a bead too far right for the label to fit beside it on the right', () => {
    const at = labelPlacement({ x: 0.6, y: 0 }, SIZES[1]);
    expect(at.side).toBe('left');
    expect(at.x + LABEL_BOX.laptop.width).toBeLessThan(((0.6 + 1) / 2) * 1440 - stopRadius(SIZES[1]));
  });

  it('keeps clear of the header: never above it', () => {
    for (const size of SIZES) for (const x of NDC) expect(labelPlacement({ x, y: 1 }, size).y).toBeGreaterThanOrEqual(64);
  });

  it('reads an NDC that is not a number as the middle of the screen', () => {
    for (const size of SIZES) expect(labelPlacement({ x: Number.NaN, y: Number.NaN }, size)).toEqual(labelPlacement({ x: 0, y: 0 }, size));
  });

  it("takes for the bead's radius, by default, the one it has at its stop: a third of the half-width on every screen", () => {
    for (const size of SIZES) {
      const aspect = size.width / size.height;
      for (let p = 0; p < BEADS.length; p++) {
        const { position, target, fov } = journeyPoseAt(3 + p, aspect).shot;
        const distance = Math.hypot(position[0] - target[0], position[1] - target[1], position[2] - target[2]);
        // The bead's radius over the picture's half-height at its distance, in pixels of the half-height.
        const pixels = (BEADS[p]!.radius / (distance * Math.tan((fov * Math.PI) / 360))) * (size.height / 2);
        expect(stopRadius(size) / pixels).toBeCloseTo(1, 1);
      }
    }
  });
});

/** Every project id: the labels' ids are the projects'. */
const _ids: readonly ProjectId[] = IDS;
void _ids;
