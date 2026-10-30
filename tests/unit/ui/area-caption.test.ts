import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { categories } from '~/data/categories';
import { projects } from '~/data/projects';
import { en } from '~/i18n/en';
import { nl } from '~/i18n/nl';
import { areasOnPath } from '~/state/chapters';
import { AreaCaptions, registerAreaCaption, showAreaCaption } from '~/ui/AreaCaption';

function fake() {
  const style: Record<string, string> = {};
  const attributes = new Map<string, string>();
  return { style, attributes, toggleAttribute: (k: string, on: boolean) => (on ? attributes.set(k, '') : attributes.delete(k)) };
}

const done: (() => void)[] = [];
afterEach(() => {
  for (const undo of done.splice(0)) undo();
});

describe("an area's words at the bottom left", () => {
  it('show its category heading and project names with "Klik om te openen", "Tik om te openen" on a touch screen', () => {
    for (const [path, t, locale] of [
      ['/', nl, 'nl'],
      ['/en/', en, 'en']
    ] as const) {
      const html = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, createElement(AreaCaptions)));
      areasOnPath().forEach((area, i) => {
        expect(html).toContain(`data-area="${i}"`);
        expect(html).toContain(categories.byId(area.category).heading(locale));
        for (const id of area.projects) {
          expect(html).toContain(projects.byId(id)!.title);
          expect(html).toContain(`href="${path === '/' ? '' : '/en'}/projects/${id}/"`);
        }
      });
      expect(html).toContain(t.needle.world.open.click);
      expect(html).toContain(t.needle.world.open.tap);
    }
  });

  it('show only the area in view, at its opacity, and none off it', () => {
    const [a, b, c] = [fake(), fake(), fake()];
    done.push(registerAreaCaption(0, a as never), registerAreaCaption(1, b as never), registerAreaCaption(2, c as never));
    showAreaCaption({ index: 1, opacity: 0.5 });
    expect([a.style.opacity, b.style.opacity, c.style.opacity]).toEqual(['0', '0.5', '0']);
    expect(b.attributes.has('inert')).toBe(false);
    expect(a.attributes.has('inert')).toBe(true);
    showAreaCaption(null);
    expect([a.style.opacity, b.style.opacity, c.style.opacity]).toEqual(['0', '0', '0']);
    expect(b.attributes.has('inert')).toBe(true);
  });
});

/** base.css with its comments removed. */
const base = readFileSync(fileURLToPath(new URL('../../../src/styles/base.css', import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
/** The declarations of the first rule of base.css whose selector is exactly `selector` (white space collapsed). */
function rule(selector: string): string {
  for (const match of base.matchAll(/([^{}]+)\{([^{}]*)\}/g)) if (match[1].trim().replace(/\s+/g, ' ') === selector) return match[2];
  throw new Error(`no rule for ${selector}`);
}

describe("an area's words since round 11 (Bob, 2026-10-30: the project's name only when the mouse is on it)", () => {
  it("stay unseen and out of the pointer's way at a stop, and show only while Tab is in them", () => {
    const hidden = rule('.area-caption:not(:focus-within)');
    expect(hidden).toMatch(/opacity:\s*0\s*!important/);
    expect(hidden).toMatch(/pointer-events:\s*none/);
  });
});
