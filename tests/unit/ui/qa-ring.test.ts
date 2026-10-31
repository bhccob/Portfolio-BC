import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { RING_QUESTIONS } from '~/data/qa';
import { en, type Dictionary, type EndQuestions } from '~/i18n/en';
import { nl } from '~/i18n/nl';
import { useScene } from '~/state/store';
import { QaRing, QaRingParts } from '~/ui/QaRing';
import { clearQa, QA_END_ATTRIBUTE, type QaParts, qaWritten, writeQa } from '~/ui/qaWriters';

const LOCALES = [
  ['/', nl],
  ['/en/', en]
] as const;

/** The ring's words as they render on the page at `path`, with `questions` (the dictionary's unless given). */
const parts = (path: string, t: Dictionary, questions: EndQuestions = t.end.questions): string =>
  renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, createElement(QaRingParts, { questions })));
const textOf = (html: string): string =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

/** A fake of the page's parts the writer touches: the list's questions (each its button's attributes and its reply), the end. */
function fakeParts(): QaParts & { attributes: Map<string, string>; vars: Map<string, string>; asked: Map<string, string>[] } {
  const attributes = new Map<string, string>();
  const vars = new Map<string, string>();
  const asked = Array.from({ length: RING_QUESTIONS }, () => new Map<string, string>([['aria-expanded', 'false']]));
  return {
    attributes,
    vars,
    asked,
    root: { setAttribute: (n, v) => attributes.set(n, v), removeAttribute: (n) => attributes.delete(n) },
    section: { inert: true },
    frame: { style: { setProperty: (n, v) => vars.set(n, v), removeProperty: (n) => vars.delete(n) } },
    items: asked.map((a) => ({ ask: { setAttribute: (n: string, v: string) => a.set(n, v) }, reply: { hidden: true } })),
    end: { hidden: true }
  };
}
const openOf = (p: ReturnType<typeof fakeParts>): number[] => p.asked.flatMap((a, k) => (a.get('aria-expanded') === 'true' ? [k] : []));
const shownOf = (p: ReturnType<typeof fakeParts>): number[] => p.items.flatMap((item, k) => (item.reply.hidden ? [] : [k]));

// The Q&A's words beside the gold ring (spec 2026-10-29-bob-stack-2-design.md, goal 1; the mock-up's "mix"); round 10
// (Bob, 2026-10-30: "more simple to just go through it"; he picked A, one list): every question in one list beside the
// tower, the one the ring stands at open, a question asked turning the ring to it.
describe("the ring's words", () => {
  afterEach(() => useScene.setState({ threeD: true }));

  it('renders nothing in the prerendered HTML, or with 3D off', () => {
    useScene.setState({ threeD: true });
    expect(renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ['/'] }, createElement(QaRing)))).toBe('');
    useScene.setState({ threeD: false });
    expect(renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ['/'] }, createElement(QaRing)))).toBe('');
  });

  it('lists every question as a button, its answer under it, in both languages', () => {
    for (const [path, t] of LOCALES) {
      const html = parts(path, t);
      expect(html).toContain('<ol class="qa-list"');
      const asks = [...html.matchAll(/<button type="button" class="qa-ask" id="qa-ask-(\d)" aria-expanded="false" aria-controls="qa-reply-(\d)">([^<]*)<\/button>/g)];
      expect(asks.map((m) => [m[1], m[2]])).toEqual(t.end.questions.map((_, k) => [String(k), String(k)]));
      expect(asks.map((m) => m[3]!.replace(/&#x27;/g, "'"))).toEqual(t.end.questions.map((q) => q.question));
      t.end.questions.forEach(({ answer }, k) => {
        const reply = html.slice(html.indexOf(`id="qa-reply-${k}"`));
        expect(textOf(reply)).toContain(answer!);
        expect(textOf(reply)).toContain(t.end.ring.count.replace('{n}', String(k + 1).padStart(2, '0')).replace('{total}', '06'));
      });
      // Each reply hidden until the scene opens it, and the end's words too.
      expect((html.match(/class="qa-reply" id="qa-reply-\d" hidden=""/g) ?? []).length).toBe(RING_QUESTIONS);
      expect(html).toMatch(new RegExp(`class="qa-answer qa-end" data-k="${RING_QUESTIONS}" hidden=""`));
    }
  });

  it('shows the placeholder with its tag for an answer left out', () => {
    const questions = en.end.questions.map((item, k) => (k === 2 ? { ...item, answer: null } : item)) as EndQuestions;
    const html = parts('/en/', en, questions);
    expect(textOf(html)).toContain(`${en.end.placeholder} ${en.end.placeholderTag}`);
  });

  it('renders the end with its line, word for word, in both languages', () => {
    expect(nl.end.ring.endLine).toBe('Dit is het einde van de site. Staat je vraag er niet tussen, of wil je iets anders vragen? Stuur me een bericht.');
    expect(en.end.ring.endLine).toBe('This is the end of the site. Is your question not among them, or would you like to ask something else? Send me a message.');
    for (const [path, t] of LOCALES) {
      const html = parts(path, t);
      const end = html.slice(html.indexOf(`data-k="${RING_QUESTIONS}"`));
      expect(textOf(end)).toContain(t.end.ring.endKicker);
      expect(textOf(end)).toContain(t.end.ring.endLine);
      expect(end).toContain('id="qa-end-title"');
      expect(end).toContain(`href="${path === '/' ? '/contact/' : '/en/contact/'}"`);
      expect(textOf(end)).toContain(t.end.ring.toContact);
      expect(textOf(end)).toContain(t.end.ring.toStart);
    }
  });

  it("puts no buttons on the ring's marks: the list is the way to choose", () => {
    for (const [path, t] of LOCALES) expect(parts(path, t)).not.toContain('qa-mark');
  });

  it('opens the first question as the Q&A comes in, and the one the ring stands at after, only that one', () => {
    const p = fakeParts();
    const written = qaWritten();
    // Coming in from the look back, between marks: the first.
    writeQa(p, { on: true, at: null, answer: 0.3 }, written);
    expect([openOf(p), shownOf(p)]).toEqual([[0], [0]]);
    expect(p.attributes.get('data-qa')).toBe('');
    expect(p.section!.inert).toBe(false);
    writeQa(p, { on: true, at: 2, answer: 1 }, written);
    expect([openOf(p), shownOf(p), p.attributes.get('data-qa-at')]).toEqual([[2], [2], '2']);
    // Turning on to another question: the open one stays open until the ring is there.
    writeQa(p, { on: true, at: null, answer: 1 }, written);
    expect(openOf(p)).toEqual([2]);
    writeQa(p, { on: true, at: 4, answer: 1 }, written);
    expect([openOf(p), shownOf(p)]).toEqual([[4], [4]]);
    expect(p.end!.hidden).toBe(true);
  });

  it('writes only what changed', () => {
    const p = fakeParts();
    const written = qaWritten();
    writeQa(p, { on: true, at: 2, answer: 1 }, written);
    expect(p.vars.get('--qa-show')).toBe('1');
    p.attributes.clear();
    p.vars.clear();
    for (const a of p.asked) a.clear();
    writeQa(p, { on: true, at: 2, answer: 1 }, written);
    expect(p.attributes.size).toBe(0);
    expect(p.vars.size).toBe(0);
    expect(p.asked.every((a) => a.size === 0)).toBe(true);
  });

  it('clears every attribute it wrote', () => {
    const p = fakeParts();
    const written = qaWritten();
    writeQa(p, { on: true, at: 3, answer: 0.5 }, written);
    writeQa(p, { on: true, at: RING_QUESTIONS, answer: 0.5 }, written);
    clearQa(p, written);
    expect(p.attributes.size).toBe(0);
    expect(p.vars.size).toBe(0);
    expect(p.section!.inert).toBe(true);
    expect(shownOf(p)).toEqual([]);
    expect(openOf(p)).toEqual([]);
    expect(p.end!.hidden).toBe(true);
  });
});

// The end, unmistakable (Bob, 2026-10-29: "more obvious that it ends"; he picked "2 · Circle"; spec
// 2026-10-29-bob-stack-3-design.md, goal 4): the dark comes up and one gold circle draws itself round, the words inside it.
describe("the ring's end", () => {
  it('marks the end', () => {
    expect(QA_END_ATTRIBUTE).toBe('data-qa-end');
    const p = fakeParts();
    const written = qaWritten();
    writeQa(p, { on: true, at: RING_QUESTIONS, answer: 1 }, written);
    expect(p.attributes.get('data-qa-end')).toBe('');
    expect(p.end!.hidden).toBe(false);
    writeQa(p, { on: true, at: RING_QUESTIONS - 1, answer: 1 }, written);
    expect(p.attributes.has('data-qa-end')).toBe(false);
    expect(p.end!.hidden).toBe(true);
    writeQa(p, { on: true, at: RING_QUESTIONS, answer: 1 }, written);
    clearQa(p, written);
    expect(p.attributes.has('data-qa-end')).toBe(false);
  });

  it('leaves the end with nothing of it left', () => {
    const p = fakeParts();
    const written = qaWritten();
    writeQa(p, { on: true, at: RING_QUESTIONS, answer: 1 }, written);
    // Between the marks, on the way back to the list: the end is gone in the same write.
    writeQa(p, { on: true, at: null, answer: 0 }, written);
    expect(p.attributes.has('data-qa-end')).toBe(false);
    expect(p.end!.hidden).toBe(true);
    writeQa(p, { on: true, at: 0, answer: 1 }, written);
    expect([p.attributes.has('data-qa-end'), p.attributes.get('data-qa-at')]).toEqual([false, '0']);
    // The Q&A gone (up past the list to the look back): nothing either.
    writeQa(p, { on: false, at: null, answer: 0 }, written);
    expect(p.attributes.has('data-qa-end')).toBe(false);
  });

  it('holds the dark and the circle in its markup, unread by screen readers', () => {
    for (const [path, t] of LOCALES) {
      const html = parts(path, t);
      expect(html).toContain('<span class="qa-veil" aria-hidden="true"></span>');
      expect(html).toContain('<span class="qa-seal" aria-hidden="true"></span>');
    }
  });

  /** base.css's rules: the at-rules each sits in, its selectors and its declarations (no nesting in the file). */
  const base = readFileSync(fileURLToPath(new URL('../../../src/styles/base.css', import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: { groups: string[]; selectors: string[]; body: string }[] = [];
  {
    const groups: string[] = [];
    let mark = 0;
    for (let i = 0; i < base.length; i++) {
      const ch = base[i];
      if (ch === '{') {
        const prelude = base.slice(mark, i).trim().replace(/\s+/g, ' ');
        if (prelude.startsWith('@media') || prelude.startsWith('@supports')) {
          groups.push(prelude);
          mark = i + 1;
          continue;
        }
        const end = base.indexOf('}', i);
        if (!prelude.startsWith('@')) rules.push({ groups: [...groups], selectors: prelude.split(',').map((s) => s.trim()), body: base.slice(i + 1, end) });
        // An at-rule with a body of declarations (@property, @keyframes' steps) is skipped whole.
        let depth = 1;
        let j = i + 1;
        if (prelude.startsWith('@keyframes')) {
          for (; j < base.length && depth > 0; j++) depth += base[j] === '{' ? 1 : base[j] === '}' ? -1 : 0;
          i = j - 1;
        } else i = end;
        mark = i + 1;
      } else if (ch === '}') {
        groups.pop();
        mark = i + 1;
      }
    }
  }
  const body = (selector: string, groups: string[] = []): string =>
    rules.filter((r) => r.selectors.includes(selector) && JSON.stringify(r.groups) === JSON.stringify(groups)).map((r) => r.body).join(';');
  const PHONE = ['@media (max-width: 700px)'];
  const REDUCED = ['@media (prefers-reduced-motion: reduce)'];

  it('draws the circle at the end', () => {
    expect(body('.qa-veil')).toMatch(/background:\s*rgb\(4 2 9 \/ 0\.9\)/);
    expect(body('.qa-veil')).toMatch(/opacity:\s*0\b/);
    expect(body('.qa-veil')).toMatch(/transition:\s*opacity 1\.4s/);
    expect(body('html[data-qa-end] .qa-veil')).toMatch(/opacity:\s*1\b/);
    expect(body('.qa-seal')).toMatch(/width:\s*min\(88vmin, 720px\)/);
    expect(body('.qa-seal')).toMatch(/border:\s*2px solid/);
    expect(body('.qa-seal')).toMatch(/border-radius:\s*50%/);
    expect(body('.qa-seal')).toMatch(/mask:\s*conic-gradient\(#000 var\(--qa-draw\), transparent 0\)/);
    expect(body('html[data-qa-end] .qa-seal')).toMatch(/animation:\s*qa-draw 2\.2s [^;]* 0\.4s both/);
    expect(base).toMatch(/@property --qa-draw\s*\{[^}]*syntax:\s*'<angle>'/);
    expect(base).toMatch(/@keyframes qa-draw\s*\{\s*from\s*\{\s*--qa-draw:\s*0deg;?\s*\}\s*to\s*\{\s*--qa-draw:\s*360deg;?\s*\}/);
    // The words in the middle, inside the circle; the marks' numbers gone; the buttons centred.
    expect(body('html[data-qa-end] .qa-frame')).toMatch(/width:\s*min\(440px, calc\(100vw - 40px\)\)/);
    expect(body('html[data-qa-end] .qa-frame')).toMatch(/transform:\s*translate\(calc\(50vw - 50%\), calc\(50dvh - 50%\)\)/);
    expect(body('html[data-qa-end] .qa-list')).toMatch(/opacity:\s*0\b/);
    expect(body('html[data-qa-end] .qa-buttons')).toMatch(/justify-content:\s*center/);
    // On a phone the circle above the words, the words at the foot.
    expect(body('html[data-qa-end] .qa-seal', PHONE)).toMatch(/top:\s*31%/);
    expect(body('html[data-qa-end] .qa-seal', PHONE)).toMatch(/width:\s*64vw/);
    // On the screen a phone shows, never under its browser's toolbar (100vh is the screen with the toolbar gone).
    expect(body('html[data-qa-end] .qa-frame', PHONE)).toMatch(/transform:\s*translate\(calc\(50vw - 50%\), calc\(100dvh - 100% - 8dvh\)\)/);
  });

  // A mark's button takes the pointer whatever its list does (pointer-events: auto), so at the end the numbers go out of
  // reach as well as out of sight: no invisible button for Tab or a click (visibility, after their fade).
  it('takes the list out of reach at the end, not only out of sight', () => {
    expect(body('html[data-qa-end] .qa-list')).toMatch(/visibility:\s*hidden/);
    expect(body('html[data-qa-end] .qa-list')).toMatch(/transition:\s*opacity 0\.6s ease,\s*visibility 0s linear 0\.6s/);
  });

  // Round 10: the list stands at the right of a laptop's screen, under the tower on a phone, wherever the ring's marks are.
  it('stands the list at the right on a laptop and under the tower on a phone', () => {
    expect(body('.qa-frame')).toMatch(/transform:\s*translate\(calc\(100vw - 100% - [^)]+\)/);
    expect(body('.qa-frame')).not.toMatch(/--qa-x|--qa-y/);
    expect(body('.qa-frame', PHONE)).toMatch(/transform:\s*translate\(20px,\s*calc\(100dvh - 100% - [^)]+\)/);
  });

  // Round 11 (Bob, 2026-10-30: "maybe Q&A text bigger and more apparent", then "Even bigger"): the questions and the open
  // reply sizes up on every screen, the reply's count in gold, the rules between them stronger.
  it('sets the list big and clear', () => {
    const SHORT = ['@media (max-height: 760px) and (min-width: 701px)'];
    const px = (selector: string, groups: string[] = []): number => Number(body(selector, groups).match(/font-size:\s*(\d+)px/)?.[1]);
    expect(body('.qa-frame')).toMatch(/width:\s*min\(600px, calc\(100vw - 40px\)\)/);
    expect([px('.qa-ask'), px('.qa-reply .qa-text')]).toEqual([24, 21]);
    expect([px('.qa-ask', SHORT), px('.qa-reply .qa-text', SHORT)]).toEqual([20, 18]);
    expect([px('.qa-ask', PHONE), px('.qa-reply .qa-text', PHONE)]).toEqual([18, 16]);
    expect(body('.qa-reply .qa-count')).toMatch(/color:\s*var\(--gold-ink\)/);
    expect(body('.qa-item')).toMatch(/border-top:\s*1px solid rgb\(226 165 74 \/ 0\.4\)/);
  });

  // The longest reply open runs the list 731px tall on a laptop: under 18dvh it would leave a 1536x864 screen, so up to
  // 940px tall the list stands at 10dvh.
  it('keeps the list on a laptop screen up to 940px tall with the longest reply open', () => {
    const LAPTOP = ['@media (max-height: 940px) and (min-width: 701px)'];
    expect(body('.qa-frame', LAPTOP)).toMatch(/transform:\s*translate\(calc\(100vw - 100% - max\(56px, 7vw\)\), calc\(10dvh \+/);
    expect(body('.qa-frame', ['@media (max-height: 760px) and (min-width: 701px)'])).not.toMatch(/transform/);
  });

  // Round 12 (Bob, 2026-10-31: "add a background style to the Q&A"; shown two, he picked "B · dark panel, gold corners").
  it('sets the list on a dark panel with gold corners, the scene blurred under it', () => {
    expect(body('.qa-frame::before')).toMatch(/background:\s*linear-gradient\(180deg, rgb\(8 5 16 \/ [\d.]+\), rgb\(8 5 16 \/ [\d.]+\)\)/);
    expect(body('.qa-frame::before')).toMatch(/(^|[;\s])backdrop-filter:\s*blur\(\d+px\)/);
    expect(body('.qa-frame::before')).toMatch(/-webkit-backdrop-filter:\s*blur\(\d+px\)/);
    expect(body('.qa-frame::before')).toMatch(/border:\s*1px solid rgb\(226 165 74 \/ 0\.16\)/);
    expect(body('.qa-frame::before')).not.toMatch(/radial-gradient/);
    // Four gold corners, each two short strokes.
    const corners = body('.qa-frame::after');
    expect(corners).toMatch(/content:\s*''/);
    for (const corner of ['top left', 'top right', 'bottom left', 'bottom right']) {
      expect(corners).toContain(`${corner} / 28px 2px no-repeat`);
      expect(corners).toContain(`${corner} / 2px 28px no-repeat`);
    }
    // The panel and its corners stand round the list, inside a phone's screen (the list is 20px from each side there).
    expect(body('.qa-frame::before')).toMatch(/inset:\s*-30px -36px/);
    expect(body('.qa-frame::after')).toMatch(/inset:\s*-30px -36px/);
    expect(body('.qa-frame::before', PHONE)).toMatch(/inset:\s*-16px -12px/);
    expect(body('.qa-frame::after', PHONE)).toMatch(/inset:\s*-16px -12px/);
    // At the end the circle stands alone: no panel, no corners.
    expect(body('html[data-qa-end] .qa-frame::before')).toMatch(/display:\s*none/);
    expect(body('html[data-qa-end] .qa-frame::after')).toMatch(/display:\s*none/);
  });

  // Reduced motion only stills the list's slide: it stays where its screen puts it (a phone's at the foot).
  it('stills the slide with reduced motion and leaves the list where its screen has it', () => {
    expect(body('.qa-frame', REDUCED)).toMatch(/--qa-slide:\s*0px/);
    expect(body('.qa-frame', REDUCED)).not.toMatch(/transform/);
    for (const groups of [[], PHONE, ['@media (max-height: 940px) and (min-width: 701px)']]) expect(body('.qa-frame', groups)).toMatch(/var\(--qa-slide, 12px\)/);
  });

  it('draws nothing with reduced motion', () => {
    expect(body('html[data-qa-end] .qa-seal', REDUCED)).toMatch(/animation:\s*none/);
    expect(body('html[data-qa-end] .qa-seal', REDUCED)).toMatch(/--qa-draw:\s*360deg/);
    expect(body('.qa-veil', REDUCED)).toMatch(/transition:\s*none/);
  });

  // The Q&A stands over the header (z-index 3 against its 2), so the dark lies over it too; a link of the header that has
  // the keyboard must not be hidden under it (WCAG 2.4.11), as on a project's page (html[data-inside]).
  it('lifts the header over the dark while the keyboard is in it', () => {
    expect(body('.qa')).toMatch(/z-index:\s*3\b/);
    expect(body('html[data-qa-end] .site-header:focus-within')).toMatch(/z-index:\s*4\b/);
  });
});
