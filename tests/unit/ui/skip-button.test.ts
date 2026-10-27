import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('~/input/useHomeScroll', () => ({ goToEnd: vi.fn(() => true), headedToEnd: vi.fn(() => true) }));
vi.mock('~/ui/endArrival', () => ({ focusEndOnArrival: vi.fn(() => () => {}) }));

import { en } from '~/i18n/en';
import { nl } from '~/i18n/nl';
import { goToEnd, headedToEnd } from '~/input/useHomeScroll';
import { journeyPoseAt } from '~/scene/bob/journey';
import { HOME_CHAPTERS, pathStart } from '~/state/chapters';
import { focusEndOnArrival } from '~/ui/endArrival';
import { SKIP_ATTRIBUTE, SkipButton, showsSkip, skipAlt, skipHome, skipPlace, skipToEnd, writeSkip } from '~/ui/SkipButton';

const base = readFileSync(fileURLToPath(new URL('../../../src/styles/base.css', import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
function rule(selector: string): string {
  for (const match of base.matchAll(/([^{}]+)\{([^{}]*)\}/g)) if (match[1]!.trim() === selector) return match[2]!;
  throw new Error(`no rule for ${selector}`);
}

describe('the skip button shows from the first project through the look back', () => {
  it("shows from the world's stop through the look back, nowhere else", () => {
    const L = pathStart(HOME_CHAPTERS);
    const at = (p: number) => showsSkip(journeyPoseAt(p, 1440 / 900));
    // the land, the world's stop, an area, the look back's own stop, part-way up the sheet, the credits
    expect([L + 1.0, L + 1.53, L + 4.0, L + 7.6, L + 7.65, L + 8.6].map(at)).toEqual([false, true, true, true, false, false]);
    for (const p of [0, 0.5, 1, 2.5, L - 0.01]) expect(at(p), `at ${p}`).toBe(false);
  });

  it('is shown by <html data-skip>, written only on change, and hidden without it', () => {
    const attributes = new Map<string, string>();
    const writes: string[] = [];
    const root = {
      setAttribute: (k: string, v: string) => (writes.push(`set ${k}`), attributes.set(k, v)),
      removeAttribute: (k: string) => (writes.push(`remove ${k}`), attributes.delete(k))
    };
    const written = { shown: false };
    expect(SKIP_ATTRIBUTE).toBe('data-skip');
    writeSkip(root, true, written);
    writeSkip(root, true, written);
    expect(attributes.has('data-skip')).toBe(true);
    writeSkip(root, false, written);
    writeSkip(root, false, written);
    expect(attributes.has('data-skip')).toBe(false);
    expect(writes).toEqual(['set data-skip', 'remove data-skip']);
    expect(rule('.skip-button')).toMatch(/visibility:\s*hidden/);
    expect(rule("html[data-route='home'][data-3d='on'][data-skip] .skip-button")).toMatch(/visibility:\s*visible/);
  });
});

describe('the skip button', () => {
  beforeEach(() => vi.clearAllMocks());

  it('says "Snel naar vragen ↓" in Dutch and "Skip to questions ↓" in English', () => {
    for (const [path, t] of [
      ['/', nl],
      ['/en/', en]
    ] as const) {
      const html = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, createElement(SkipButton)));
      expect(html).toBe(`<button type="button" class="skip-button">${t.lightDive.skip}</button>`);
    }
  });

  it("fades to the end by End's own path and gives the end page's title the focus once it rests there", () => {
    const doc = {} as Document;
    skipToEnd(doc);
    expect(goToEnd).toHaveBeenCalledTimes(1);
    expect(focusEndOnArrival).toHaveBeenCalledWith(doc, headedToEnd);
  });

  it('watches for no arrival when the scroll takes no input (a bead opening)', () => {
    vi.mocked(goToEnd).mockReturnValueOnce(false);
    skipToEnd({} as Document);
    expect(focusEndOnArrival).not.toHaveBeenCalled();
  });
});

describe('the skip button never covers the label', () => {
  const size = { width: 1366, height: 657 };
  const pill = { w: 220, h: 40 };

  it('stands at the bottom right by default, and under the header at the right in its alternate place', () => {
    const home = skipHome(size, pill);
    expect(home.x + home.w).toBeCloseTo(1366 - Math.max(16, 0.034 * 1366), 9);
    expect(home.y + home.h).toBeCloseTo(657 - Math.max(24, 0.032 * 1366), 9);
    const alt = skipAlt(size, pill);
    expect(alt.x).toBe(home.x);
    expect(alt.y).toBeCloseTo(64 + Math.max(16, 0.02 * 1366), 9);
  });

  it('takes its alternate place when the label would overlap its own, by 8 px or less, and stays home otherwise', () => {
    const home = skipHome(size, pill);
    expect(skipPlace({ x: home.x - 40, y: home.y - 30, w: 200, h: 60 }, size, pill)).toBe('alt');
    expect(skipPlace({ x: home.x - 200 - 7, y: home.y, w: 200, h: 60 }, size, pill)).toBe('alt');
    expect(skipPlace({ x: home.x - 200 - 9, y: home.y, w: 200, h: 60 }, size, pill)).toBe('home');
    expect(skipPlace(null, size, pill)).toBe('home');
  });

});
