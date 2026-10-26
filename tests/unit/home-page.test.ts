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
        expect(html).toMatch(new RegExp(`<p class="hero-cue"><span class="hero-cue-word">${t.needle.hero.scrollCue}</span></p>`));
      });

      it("links no country page, and the three projects: once from the nav and once from each bead's label", () => {
        expect(html).not.toContain('/about/');
        const links = html.match(/href="[^"]*\/projects\/[a-z-]+\/"/g) ?? [];
        expect(links).toHaveLength(6);
        expect(new Set(links).size).toBe(3);
        expect(html.match(/<a class="bead-label"/g)).toHaveLength(3);
      });

      it('puts the bead labels after the hero and before the nav, so Tab reaches a shown label first in the page', () => {
        expect(html.indexOf('class="hero"')).toBeLessThan(html.indexOf('class="bead-label"'));
        expect(html.lastIndexOf('class="bead-label"')).toBeLessThan(html.indexOf('class="home-nav"'));
      });

      it('server-renders the five facts as a list before the nav, the words of the table with "/" as a line break', () => {
        const from = html.indexOf('<ol class="light-facts"');
        expect(from).toBeGreaterThan(-1);
        expect(from).toBeLessThan(html.indexOf('class="home-nav"'));
        const list = html.slice(from, html.indexOf('</ol>', from));
        const items = [...list.matchAll(/<li>(.*?)<\/li>/g)].map((match) => match[1]!.replace(/<br\/>/g, ' / '));
        expect(items).toEqual([...t.lightDive.facts]);
      });

      it("draws the facts beside the light as one layer the screen reader skips: five labels, number, line and words", () => {
        const from = html.indexOf('<div class="light-fact-layer" aria-hidden="true">');
        expect(from).toBeGreaterThan(-1);
        const layer = html.slice(from, html.indexOf('<ol class="light-facts"'));
        expect(layer.match(/class="light-fact"/g)).toHaveLength(5);
        expect(layer.match(/class="light-fact-line"/g)).toHaveLength(5);
        expect(layer).toContain('<span class="light-fact-n">05</span>');
      });

      it("the end page's link is in .home-nav with the copy, NL and EN", () => {
        const from = html.indexOf('<nav class="home-nav"');
        const nav = html.slice(from, html.indexOf('</nav>', from));
        const copy = t.end.failLink.replace(/&/g, '&amp;');
        expect(nav).toContain(`<button type="button" class="end-link">${copy}</button>`);
        expect(html.match(/class="end-link"/g)).toHaveLength(1);
      });
    });
  }

  it("shows the end page's link whenever 3D is on, in the nav (hidden with it, shown on focus), and never with 3D off, where the end page is in the flow", () => {
    expect(rule('.end-link')).toMatch(/display:\s*none/);
    const shown = rule("html[data-3d='on'] .end-link");
    expect(shown).toMatch(/display:\s*[a-z-]+/);
    expect(shown).not.toMatch(/display:\s*none/);
    expect(base.indexOf("html[data-3d='on'] .end-link {")).toBeGreaterThan(base.indexOf('.end-link {'));
    // Not only with the void failed any more: a screen reader needs it with the void ready too.
    expect(base).not.toContain("html[data-void='failed'] .end-link");
  });

  it('hides the facts list visually with 3D on, as the nav is (clipped, for screen readers), and leaves it in the flow with 3D off', () => {
    const css = rule("html[data-3d='on'] .light-facts");
    expect(css).toMatch(/position:\s*absolute/);
    expect(css).toMatch(/clip-path:\s*inset\(50%\)/);
    expect(css).not.toMatch(/display:\s*none/);
    expect(rule('.light-facts')).not.toMatch(/display:\s*none/);
  });

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
