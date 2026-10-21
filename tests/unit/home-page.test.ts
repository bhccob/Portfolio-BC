import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import Home from '../../src/app/routes/home';
import { en } from '../../src/i18n/en';
import { nl } from '../../src/i18n/nl';

const render = (path: string): string => renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, createElement(Home)));

/** The declarations of the first rule of base.css whose selector is exactly `selector`. */
const base = readFileSync(fileURLToPath(new URL('../../src/styles/base.css', import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
function rule(selector: string): string {
  for (const match of base.matchAll(/([^{}]+)\{([^{}]*)\}/g)) if (match[1].trim() === selector) return match[2];
  throw new Error(`no rule for ${selector}`);
}

describe('the home page', () => {
  for (const [path, t] of [
    ['/', nl],
    ['/en/', en],
  ] as const) {
    describe(path, () => {
      const html = render(path);

      it('keeps the name as its one h1, visually hidden: the engraving says it, a screen reader and a crawler read it', () => {
        const headings = [...html.matchAll(/<h1\b([^>]*)>(.*?)<\/h1>/g)];
        expect(headings).toHaveLength(1);
        expect(headings[0][2]).toBe(t.needle.hero.name);
        expect(headings[0][1]).toMatch(/class="visually-hidden"/);
      });

      it('has no tagline, and keeps the scroll cue', () => {
        expect(html).not.toContain(t.needle.hero.tagline);
        expect(html).not.toContain('hero-tagline');
        expect(html).toMatch(new RegExp(`<p class="hero-cue">${t.needle.hero.scrollCue}</p>`));
      });

      it('links no country page, and the three projects', () => {
        expect(html).not.toContain('/about/');
        expect(html.match(/href="[^"]*\/projects\/[a-z-]+\/"/g)).toHaveLength(3);
      });
    });
  }

  it('has a visually-hidden utility that leaves the text to assistive technology (clipped, never display:none or visibility:hidden)', () => {
    const css = rule('.visually-hidden');
    expect(css).toMatch(/position:\s*absolute/);
    expect(css).toMatch(/width:\s*1px/);
    expect(css).toMatch(/height:\s*1px/);
    expect(css).toMatch(/overflow:\s*hidden/);
    expect(css).toMatch(/clip-path:\s*inset\(50%\)/);
    expect(css).not.toMatch(/display:\s*none|visibility:\s*hidden/);
  });
});
