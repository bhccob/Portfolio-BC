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
import { stripMarkup } from '~/ui/Markup';
import { QaRing, QaRingParts } from '~/ui/QaRing';
import { clearQa, QA_AT_ATTRIBUTE, QA_END_ATTRIBUTE, qaNearest, qaOffset, type QaParts, qaReadingLine, qaWritten, writeQa } from '~/ui/qaWriters';

const LOCALES = [
  ['/', nl],
  ['/en/', en]
] as const;

/** The Q&A's words as they render on the page at `path`, with `questions` (the dictionary's unless given). */
const parts = (path: string, t: Dictionary, questions: EndQuestions = t.end.questions): string =>
  renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, createElement(QaRingParts, { questions })));
const textOf = (html: string): string =>
  stripMarkup(html)
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

/** A fake of the page's parts the writer touches: <html>'s attributes, the section's inert and vars, the track, the end. */
function fakeParts(): QaParts & { attributes: Map<string, string>; vars: Map<string, string> } {
  const attributes = new Map<string, string>();
  const vars = new Map<string, string>();
  return {
    attributes,
    vars,
    root: { setAttribute: (n, v) => attributes.set(n, v), removeAttribute: (n) => attributes.delete(n) },
    section: { inert: true, style: { setProperty: (n, v) => vars.set(n, v), removeProperty: (n) => vars.delete(n) } },
    track: { style: { transform: '' } },
    end: { hidden: true }
  };
}
const VIEW = { on: true, column: 1, band: 1, offset: 0, at: 0, endOn: false };

// Round 15 (spec 2026-11-01-bob-dissolve-digitize-design.md; Bob: "i want the Q&A also the be just very simple and blend in
// to scroll"): every question and its answer, plain words in one column that goes with the scroll like a page.
describe("the Q&A's words", () => {
  afterEach(() => useScene.setState({ threeD: true }));

  it('renders nothing in the prerendered HTML, or with 3D off', () => {
    useScene.setState({ threeD: true });
    expect(renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ['/'] }, createElement(QaRing)))).toBe('');
    useScene.setState({ threeD: false });
    expect(renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ['/'] }, createElement(QaRing)))).toBe('');
  });

  it('sets every question and its answer in one column, plain words, in both languages', () => {
    for (const [path, t] of LOCALES) {
      const html = parts(path, t);
      expect(html).toContain('<div class="qa-column"><div class="qa-track">');
      const asks = [...html.matchAll(/<article class="qa-block" data-k="(\d)"><h3 class="qa-question" id="qa-ask-(\d)" tabindex="-1">([^<]*)<\/h3>/g)];
      expect(asks.map((m) => [m[1], m[2]])).toEqual(t.end.questions.map((_, k) => [String(k), String(k)]));
      expect(asks.map((m) => m[3]!.replace(/&#x27;/g, "'"))).toEqual(t.end.questions.map((q) => q.question));
      t.end.questions.forEach(({ answer }) => expect(textOf(html)).toContain(answer!));
      // No buttons, no count, no list: just the words.
      const column = html.slice(html.indexOf('qa-column'), html.indexOf('qa-end'));
      expect(column).not.toMatch(/<button|qa-count|<ol|<li/);
      expect(html).toMatch(new RegExp(`class="qa-answer qa-end" data-k="${RING_QUESTIONS}" hidden=""`));
    }
  });

  it('shows the placeholder with its tag for an answer left out', () => {
    const questions = en.end.questions.map((item, k) => (k === 2 ? { ...item, answer: null } : item)) as EndQuestions;
    expect(textOf(parts('/en/', en, questions))).toContain(`${en.end.placeholder} ${en.end.placeholderTag}`);
  });

  it('draws the LEDs on one canvas and the band behind the words, both unread by screen readers, under the column', () => {
    for (const [path, t] of LOCALES) {
      const html = parts(path, t);
      expect(html).toContain('<canvas class="qa-leds" aria-hidden="true"></canvas>');
      expect(html).toContain('<div class="qa-band" aria-hidden="true"></div>');
      expect(html.indexOf('qa-leds')).toBeLessThan(html.indexOf('qa-band'));
      expect(html.indexOf('qa-band')).toBeLessThan(html.indexOf('qa-column'));
      expect(html).not.toMatch(/qa-sky|qa-rail|qa-light|qa-frame/);
    }
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

  it("puts Bob's chbc mark over the end's words, in white, unread by screen readers", () => {
    for (const [path, t] of LOCALES) {
      const html = parts(path, t);
      const end = html.slice(html.indexOf('class="qa-answer qa-end"'));
      expect(end).toMatch(/^class="qa-answer qa-end" data-k="\d+" hidden=""><span class="qa-end-mark" aria-hidden="true"><svg/);
      expect(end).toContain('fill="#fff"');
      expect(end).toContain('d="M44 184C45.68 183.93');
    }
  });
});

describe('the writer: the column with the scroll, the end', () => {
  it("puts question k's middle on the reading line at place k, linear between, on past either end", () => {
    const centres = [100, 500, 900, 1300, 1700, 2100];
    expect(qaOffset(centres, 1, 450)).toBe(-50);
    expect(qaOffset(centres, 1.5, 450)).toBe(-250);
    expect(qaOffset(centres, 5.5, 450)).toBe(450 - 2300);
    expect(qaOffset(centres, -0.5, 450)).toBe(450 + 100);
    expect(qaOffset([], 2, 450)).toBe(0);
  });

  it('reads at the middle of a laptop, a little under it on a phone', () => {
    expect(qaReadingLine({ width: 1440, height: 900 })).toBe(450);
    expect(qaReadingLine({ width: 390, height: 844 })).toBeCloseTo(0.62 * 844, 9);
  });

  it('names the question on the line, within 0.18 of its place', () => {
    expect(qaNearest(2.1, RING_QUESTIONS)).toBe(2);
    expect(qaNearest(2.5, RING_QUESTIONS)).toBeNull();
    expect(qaNearest(-0.5, RING_QUESTIONS)).toBeNull();
    expect(qaNearest(5.1, RING_QUESTIONS)).toBe(5);
  });

  it('writes the Q&A on, the column and its band, the track at its offset and the question on the line, only what changed', () => {
    const p = fakeParts();
    const written = qaWritten();
    writeQa(p, { ...VIEW, column: 0.5, band: 0.25, offset: -120.04, at: 2 }, written);
    expect(p.attributes.get('data-qa')).toBe('');
    expect(p.attributes.get(QA_AT_ATTRIBUTE)).toBe('2');
    expect(p.section!.inert).toBe(false);
    expect(p.vars.get('--qa-column')).toBe('0.500');
    expect(p.vars.get('--qa-band')).toBe('0.250');
    expect(p.track!.style.transform).toBe('translate3d(0, -120.0px, 0)');
    p.track!.style.transform = 'untouched';
    writeQa(p, { ...VIEW, column: 0.5, band: 0.25, offset: -120.04, at: 2 }, written);
    expect(p.track!.style.transform).toBe('untouched');
    writeQa(p, { ...VIEW, at: null }, written);
    expect(p.attributes.has(QA_AT_ATTRIBUTE)).toBe(false);
  });

  it('marks the end, and leaves it with nothing of it left', () => {
    expect(QA_END_ATTRIBUTE).toBe('data-qa-end');
    const p = fakeParts();
    const written = qaWritten();
    writeQa(p, { ...VIEW, at: RING_QUESTIONS, endOn: true }, written);
    expect(p.attributes.get(QA_END_ATTRIBUTE)).toBe('');
    expect(p.attributes.get(QA_AT_ATTRIBUTE)).toBe(String(RING_QUESTIONS));
    expect(p.end!.hidden).toBe(false);
    writeQa(p, { ...VIEW, at: 5 }, written);
    expect(p.attributes.has(QA_END_ATTRIBUTE)).toBe(false);
    expect(p.end!.hidden).toBe(true);
  });

  it('clears every attribute it wrote, and takes the words out of reach', () => {
    const p = fakeParts();
    const written = qaWritten();
    writeQa(p, { ...VIEW, at: RING_QUESTIONS, endOn: true }, written);
    clearQa(p, written);
    expect([...p.attributes.keys()]).toEqual([]);
    expect([...p.vars.keys()]).toEqual([]);
    expect(p.section!.inert).toBe(true);
    expect(p.end!.hidden).toBe(true);
    writeQa(p, { ...VIEW, on: false, at: null }, qaWritten());
    expect(p.section!.inert).toBe(true);
  });
});

describe("the Q&A's styles", () => {
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

  it('sets the column at the left, fading out at its top and bottom quarters, shown by the scene', () => {
    const column = body('.qa-column');
    expect(column).toMatch(/position:\s*absolute/);
    expect(column).toMatch(/left:\s*max\(16px, 7\.5vw\)/);
    expect(column).toMatch(/top:\s*0/);
    expect(column).toMatch(/bottom:\s*0/);
    expect(column).toMatch(/width:\s*min\(500px, calc\(100vw - 32px\)\)/);
    expect(column).toMatch(/overflow:\s*hidden/);
    expect(column).toMatch(/mask-image:\s*linear-gradient\(transparent 0, #000 24%, #000 76%, transparent 100%\)/);
    expect(column).toMatch(/opacity:\s*var\(--qa-column, 0\)/);
    expect(body('.qa-track')).toMatch(/will-change:\s*transform/);
    expect(body('.qa-block')).toMatch(/padding:\s*0 0 24vh/);
  });

  it('sets the words plain: the question 22 to 28 px, its answer 16 to 18 px', () => {
    const q = body('.qa-block .qa-question');
    expect(q).toMatch(/font-family:\s*var\(--font-name\)/);
    expect(q).toMatch(/font-size:\s*clamp\(22px, 2vw, 28px\)/);
    expect(q).toMatch(/font-weight:\s*500/);
    expect(q).toMatch(/text-transform:\s*none/);
    expect(q).toMatch(/letter-spacing:\s*normal/);
    const a = body('.qa-block .qa-text');
    expect(a).toMatch(/font-size:\s*clamp\(16px, 1\.25vw, 18px\)/);
    expect(a).toMatch(/line-height:\s*1\.75/);
  });

  it('darkens from the left behind the column, and lays the LEDs over the whole screen', () => {
    const band = body('.qa-band');
    expect(band).toMatch(/background:\s*linear-gradient\(90deg, rgb\(4 2 9 \/ 0\.82\), rgb\(4 2 9 \/ 0\.55\) 30%, rgb\(4 2 9 \/ 0\) 52%\)/);
    expect(band).toMatch(/opacity:\s*var\(--qa-band, 0\)/);
    expect(body('.qa-leds')).toMatch(/inset:\s*0/);
    expect(body('.qa-leds')).toMatch(/position:\s*absolute/);
  });

  it('fills a phone with the column, the band from the bottom', () => {
    const column = body('.qa-column', PHONE);
    expect(column).toMatch(/left:\s*16px/);
    expect(column).toMatch(/right:\s*16px/);
    expect(column).toMatch(/width:\s*auto/);
    expect(body('.qa-band', PHONE)).toMatch(/linear-gradient\(0deg,/);
  });

  it('stands the end over the LEDs at 40% of the height, its parts coming in one after another', () => {
    const end = body('.qa-end');
    expect(end).toMatch(/position:\s*fixed/);
    expect(end).toMatch(/left:\s*50%/);
    expect(end).toMatch(/top:\s*40%/);
    expect(end).toMatch(/translate:\s*-50% -50%/);
    expect([2, 3, 4, 5].map((n) => body(`.qa-end > :nth-child(${n})`).trim())).toEqual([0.18, 0.36, 0.58, 0.85].map((d) => `transition-delay: ${d}s;`));
    expect(body('.qa-end-mark')).toMatch(/width:\s*52px/);
    expect(body('.qa-end-mark')).not.toMatch(/filter|shadow|opacity/);
  });

  it('brings the end in at once with reduced motion', () => {
    expect(body('.qa-end > *', REDUCED)).toMatch(/transition:\s*none/);
  });

  it("keeps none of round 14's list, rail, light or sky", () => {
    expect(base).not.toMatch(/qa-frame|qa-rail|qa-light|qa-sky|qa-ask|qa-reply|qa-list|data-qa-moving/);
  });

  it('stands the header over the Q&A while it shows', () => {
    expect(body('.qa')).toMatch(/z-index:\s*3\b/);
    expect(body('html[data-qa] .site-header')).toMatch(/z-index:\s*4\b/);
  });
});
