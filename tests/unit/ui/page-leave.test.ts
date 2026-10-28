import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FLIGHT_MS } from '~/scene/bob/focus';
import { dropGhosts, fadeOutPage, leavesForHome, PAGE_OUT_MS, pageFadeEffect } from '~/ui/pageLeave';

// ---------------------------------------------------------------- when

describe('leavesForHome: a project page fades out only when it is left for the home page', () => {
  it('is true for the home page in either language', () => {
    for (const path of ['/', '/en/', '/en']) expect(leavesForHome(path), path).toBe(true);
  });

  it('is false for any other page: the language switch, Lite, contact, another project', () => {
    for (const path of ['/en/projects/steady/', '/projects/steady/', '/lite/', '/en/contact/', '/projects/cookies-clicker/']) expect(leavesForHome(path), path).toBe(false);
  });
});

// ---------------------------------------------------------------- how

/** A fake of the little of the DOM the ghost uses: one element kind, a body and timers on its own clock. */
function fakeDom() {
  const timers: { at: number; run: () => void }[] = [];
  let now = 0;
  const appended: FakeEl[] = [];
  class FakeEl {
    className = '';
    attributes = new Map<string, string>();
    inert = false;
    style: Record<string, string> = {};
    children: unknown[] = [];
    removed = false;
    listeners = new Map<string, () => void>();
    setAttribute(name: string, value: string) {
      this.attributes.set(name, value);
    }
    append(child: unknown) {
      this.children.push(child);
    }
    addEventListener(type: string, listener: () => void) {
      this.listeners.set(type, listener);
    }
    remove() {
      this.removed = true;
    }
  }
  const doc = {
    createElement: () => new FakeEl(),
    body: { append: (el: FakeEl) => appended.push(el) },
    defaultView: {
      setTimeout: (run: () => void, ms: number) => {
        timers.push({ at: now + ms, run });
        return timers.length;
      }
    }
  };
  const clone = { cloned: true };
  const page = {
    isConnected: true,
    ownerDocument: doc,
    getBoundingClientRect: () => ({ top: -120, left: 64, width: 832, height: 2400 }),
    cloneNode: (deep: boolean) => (deep ? clone : null)
  };
  const advance = (ms: number) => {
    now += ms;
    for (const timer of timers.splice(0)) if (timer.at <= now) timer.run();
      else timers.push(timer);
  };
  return { page: page as unknown as HTMLElement, appended, clone, advance };
}

describe('fadeOutPage: the page left for the home stays a moment, fading, over the flight out', () => {
  it('puts a still copy of the page where it stood, over the scene, hidden from assistive technology and inert', () => {
    const dom = fakeDom();
    fadeOutPage(dom.page);
    expect(dom.appended).toHaveLength(1);
    const ghost = dom.appended[0] as unknown as { className: string; attributes: Map<string, string>; inert: boolean; style: Record<string, string>; children: unknown[] };
    expect(ghost.className).toBe('page-ghost');
    expect(ghost.attributes.get('aria-hidden')).toBe('true');
    expect(ghost.inert).toBe(true);
    expect(ghost.style).toMatchObject({ top: '-120px', left: '64px', width: '832px' });
    expect(ghost.children).toEqual([dom.clone]);
  });

  it('takes the copy away once its fade has run, or at the latest a moment after PAGE_OUT_MS', () => {
    const dom = fakeDom();
    fadeOutPage(dom.page);
    const ghost = dom.appended[0] as unknown as { removed: boolean; listeners: Map<string, () => void> };
    expect(ghost.removed).toBe(false);
    ghost.listeners.get('animationend')?.();
    expect(ghost.removed).toBe(true);

    const late = fakeDom();
    fadeOutPage(late.page);
    const other = late.appended[0] as unknown as { removed: boolean };
    late.advance(PAGE_OUT_MS - 1);
    expect(other.removed).toBe(false);
    late.advance(200);
    expect(other.removed).toBe(true);
  });

  it('does nothing for a page no longer in the document', () => {
    const dom = fakeDom();
    fadeOutPage({ ...dom.page, isConnected: false } as unknown as HTMLElement);
    expect(dom.appended).toHaveLength(0);
  });
});

describe('dropGhosts: a project page that comes back at once stands alone (fix round 1, Minor 2)', () => {
  it('takes every copy still fading away', () => {
    const removed: number[] = [];
    const ghosts = [0, 1].map((n) => ({ remove: () => removed.push(n) }));
    dropGhosts({ querySelectorAll: ((selector: string) => (selector === '.page-ghost' ? ghosts : [])) as unknown as Document['querySelectorAll'] });
    expect(removed).toEqual([0, 1]);
  });

  it('keeps the scrim fade to a page with no page of its own up', () => {
    expect(declarationsOf('body:has(.page-ghost) .scene-host[data-ready]::after')).toEqual([]);
  });
});

describe("pageFadeEffect: usePageFadeOut's effect, as a project page comes and goes", () => {
  /** The fake DOM with `querySelectorAll` over the copies still standing, as `dropGhosts` asks. */
  function withGhosts() {
    const dom = fakeDom();
    const doc = (dom.page as unknown as { ownerDocument: Record<string, unknown> }).ownerDocument;
    doc.querySelectorAll = (selector: string) =>
      selector === '.page-ghost' ? (dom.appended as unknown as { className: string; removed: boolean }[]).filter((el) => el.className === 'page-ghost' && !el.removed) : [];
    return dom;
  }
  const ghostsOf = (dom: ReturnType<typeof fakeDom>) => dom.appended as unknown as { removed: boolean }[];

  it('has a page that comes in take away every copy still fading', () => {
    const dom = withGhosts();
    fadeOutPage(dom.page); // the page left a moment ago, still fading
    expect(ghostsOf(dom).map((ghost) => ghost.removed)).toEqual([false]);
    pageFadeEffect(dom.page, () => '/projects/steady/');
    expect(ghostsOf(dom).map((ghost) => ghost.removed)).toEqual([true]);
  });

  it('fades the page out when it goes for the home page, in either language, and not for another page', () => {
    for (const [to, fades] of [['/', 1], ['/en/', 1], ['/lite/', 0], ['/en/projects/steady/', 0], ['/contact/', 0]] as const) {
      const dom = withGhosts();
      const leave = pageFadeEffect(dom.page, () => to);
      expect(dom.appended, to).toHaveLength(0);
      leave();
      expect(dom.appended, to).toHaveLength(fades);
    }
  });

  it('reads where the visit goes when the page goes, not when it came', () => {
    const dom = withGhosts();
    let path = '/projects/steady/';
    const leave = pageFadeEffect(dom.page, () => path);
    path = '/';
    leave();
    expect(dom.appended).toHaveLength(1);
  });

  it('does nothing without a page', () => {
    expect(() => pageFadeEffect(null, () => '/')()).not.toThrow();
  });
});

describe('the project page fades out by its route module', () => {
  it('has the project page hand its article to usePageFadeOut', () => {
    const source = readFileSync(fileURLToPath(new URL('../../../src/app/routes/project.tsx', import.meta.url)), 'utf8');
    expect(source).toMatch(/usePageFadeOut\(\s*article\s*\)/);
    expect(source).toMatch(/<article className="page" ref=\{article\}>/);
  });
});

// ---------------------------------------------------------------- the stylesheet

const base = readFileSync(fileURLToPath(new URL('../../../src/styles/base.css', import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** The declarations of every rule whose selector list includes `selector`, outside any at-rule but @keyframes' own. */
function declarationsOf(selector: string): string[] {
  const found: string[] = [];
  for (const match of base.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (match[1].split(',').map((s) => s.trim().replace(/\s+/g, ' ')).includes(selector)) found.push(match[2]);
  }
  return found;
}

/** The seconds of an `animation` shorthand's duration. */
const seconds = (animation: string): number => Number(/(\d*\.?\d+)s\b/.exec(animation)?.[1] ?? Number.NaN);

describe('the fades in the stylesheet', () => {
  const out = declarationsOf('.page-ghost').join(';');
  const scrimOut = declarationsOf('body:has(.page-ghost):not(:has(main > .page)) .scene-host[data-ready]::after').join(';');

  it('fades the page out, and its scrim with it, on the site\'s reveal curve', () => {
    const page = /animation:\s*([^;]+)/.exec(out)?.[1] ?? '';
    const scrim = /animation:\s*([^;]+)/.exec(scrimOut)?.[1] ?? '';
    expect(page).toMatch(/^bead-page-out .*var\(--ease-reveal\) both$/);
    expect(scrim).toBe(page);
    expect(base).toMatch(/@keyframes bead-page-out\s*\{\s*to\s*\{\s*opacity:\s*0;?\s*\}\s*\}/);
  });

  it('keeps the fade out short, over well within the flight out', () => {
    const page = /animation:\s*([^;]+)/.exec(out)?.[1] ?? '';
    expect(seconds(page) * 1000).toBe(PAGE_OUT_MS);
    expect(PAGE_OUT_MS).toBeLessThan(FLIGHT_MS);
  });

  it('stands the copy over the scene (the host\'s layer, 1, after it) and under the header and <main> (2), and lets the pointer through', () => {
    expect(out).toMatch(/position:\s*fixed/);
    expect(out).toMatch(/z-index:\s*1\b/);
    expect(declarationsOf('.scene-host').join(';')).toMatch(/z-index:\s*1\b/);
    expect(declarationsOf('main').join(';')).toMatch(/z-index:\s*2\b/);
    expect(declarationsOf('.site-header').join(';')).toMatch(/z-index:\s*2\b/);
    expect(out).toMatch(/pointer-events:\s*none/);
  });

  it('still fades the page and its scrim in on the way in, for the page in <main> alone (never the copy)', () => {
    expect(declarationsOf('html[data-bead-open] main > .page').join(';')).toMatch(/animation:\s*bead-page-in 0\.9s var\(--ease-reveal\) both/);
    expect(declarationsOf('html[data-bead-open] body:has(main > .page) .scene-host[data-ready]::after').join(';')).toMatch(/animation:\s*bead-page-in/);
  });
});
