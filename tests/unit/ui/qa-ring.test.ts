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
import { answerPlace, clearQa, placeMarks, QA_END_ATTRIBUTE, type QaParts, qaWritten, writeQa } from '~/ui/qaWriters';

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

/** A fake of the page's parts the writer touches. */
function fakeParts(): QaParts & { attributes: Map<string, string>; vars: Map<string, string> } {
  const attributes = new Map<string, string>();
  const vars = new Map<string, string>();
  return {
    attributes,
    vars,
    root: { setAttribute: (n, v) => attributes.set(n, v), removeAttribute: (n) => attributes.delete(n) },
    section: { inert: true },
    frame: { style: { setProperty: (n, v) => vars.set(n, v), removeProperty: (n) => vars.delete(n) } },
    answers: Array.from({ length: RING_QUESTIONS + 1 }, () => ({ hidden: true }))
  };
}
const SIZE = { width: 1440, height: 900 };

// The Q&A's words beside the gold ring (spec 2026-10-29-bob-stack-2-design.md, goal 1; the mock-up's "mix").
describe("the ring's words", () => {
  afterEach(() => useScene.setState({ threeD: true }));

  it('renders nothing in the prerendered HTML, or with 3D off', () => {
    useScene.setState({ threeD: true });
    expect(renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ['/'] }, createElement(QaRing)))).toBe('');
    useScene.setState({ threeD: false });
    expect(renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ['/'] }, createElement(QaRing)))).toBe('');
  });

  it('renders every question and its answer, in both languages', () => {
    for (const [path, t] of LOCALES) {
      const html = parts(path, t);
      t.end.questions.forEach(({ question, answer }, k) => {
        expect(html).toContain(`data-k="${k}"`);
        expect(textOf(html)).toContain(question);
        expect(textOf(html)).toContain(answer!);
        expect(textOf(html)).toContain(t.end.ring.count.replace('{n}', String(k + 1).padStart(2, '0')).replace('{total}', '06'));
      });
      // Each answer hidden until the scene shows it, and the whole out of reach until then.
      expect((html.match(/class="qa-answer[^"]*" data-k="\d" hidden=""/g) ?? []).length).toBe(RING_QUESTIONS + 1);
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

  it('names each mark by its question', () => {
    for (const [path, t] of LOCALES) {
      const html = parts(path, t);
      const names = [...html.matchAll(/<button[^>]*class="qa-mark"[^>]*aria-label="([^"]*)"/g)].map((m) => m[1]);
      expect(names).toHaveLength(RING_QUESTIONS + 1);
      expect(names.slice(0, RING_QUESTIONS).map((n) => n!.replace(/&#x27;/g, "'"))).toEqual(t.end.questions.map((q) => q.question));
      expect(names.at(-1)).toBe(t.end.ring.endKicker);
      expect(html).toContain(`aria-label="${t.end.ring.marks}"`);
    }
  });

  it('writes only what changed', () => {
    const p = fakeParts();
    const written = qaWritten();
    writeQa(p, { on: true, at: 2, answer: 1, place: { x: 600, y: 400 } }, written);
    expect(p.attributes.get('data-qa')).toBe('');
    expect(p.attributes.get('data-qa-at')).toBe('2');
    expect(p.section!.inert).toBe(false);
    expect(p.answers.map((a) => a.hidden)).toEqual([true, true, false, true, true, true, true]);
    expect(p.vars.get('--qa-show')).toBe('1');
    expect(p.vars.get('--qa-x')).toBe('600px');
    // The same again writes nothing.
    p.attributes.clear();
    p.vars.clear();
    writeQa(p, { on: true, at: 2, answer: 1, place: { x: 600, y: 400 } }, written);
    expect(p.attributes.size).toBe(0);
    expect(p.vars.size).toBe(0);
    // Off a mark: no answer shown, no mark named.
    writeQa(p, { on: true, at: null, answer: 0, place: null }, written);
    expect(p.answers.every((a) => a.hidden)).toBe(true);
  });

  it('clears every attribute it wrote', () => {
    const p = fakeParts();
    const written = qaWritten();
    writeQa(p, { on: true, at: 6, answer: 0.5, place: { x: 10, y: 20 } }, written);
    clearQa(p, written);
    expect(p.attributes.size).toBe(0);
    expect(p.vars.size).toBe(0);
    expect(p.section!.inert).toBe(true);
    expect(p.answers.every((a) => a.hidden)).toBe(true);
  });

  it('places the answer beside its mark on a laptop and under the ring on a phone', () => {
    const box = { w: 540, h: 260 };
    const desk = answerPlace({ x: 500, y: 450 }, box, SIZE);
    expect(desk.x).toBe(570); // the mark's x and 70 px of air
    expect(desk.y).toBeCloseTo(450 - 260 * 0.35, 9);
    // Held on the screen, clear of its edges.
    const right = answerPlace({ x: 1400, y: 450 }, box, SIZE);
    expect(right.x).toBe(SIZE.width - box.w - 56);
    const phone = answerPlace({ x: 200, y: 300 }, { w: 350, h: 300 }, { width: 390, height: 844 });
    expect(phone).toEqual({ x: 20, y: 844 - 300 - 96 });
  });

  it("places each mark's button where the ring has it, the far half's hidden", () => {
    const buttons = Array.from({ length: 3 }, () => ({ hidden: false, style: { props: new Map<string, string>(), setProperty(n: string, v: string) { this.props.set(n, v); } } }));
    placeMarks(buttons, [{ x: 100, y: 200, front: true }, { x: 5, y: 6, front: false }, null]);
    expect(buttons[0]!.hidden).toBe(false);
    expect(buttons[0]!.style.props.get('--x')).toBe('100px');
    expect(buttons[0]!.style.props.get('--y')).toBe('200px');
    expect(buttons[1]!.hidden).toBe(true);
    expect(buttons[2]!.hidden).toBe(true);
  });
});

// The end, unmistakable (Bob, 2026-10-29: "more obvious that it ends"; he picked "2 · Circle"; spec
// 2026-10-29-bob-stack-3-design.md, goal 4): the dark comes up and one gold circle draws itself round, the words inside it.
describe("the ring's end", () => {
  it('marks the end', () => {
    expect(QA_END_ATTRIBUTE).toBe('data-qa-end');
    const p = fakeParts();
    const written = qaWritten();
    writeQa(p, { on: true, at: RING_QUESTIONS, answer: 1, place: { x: 10, y: 20 } }, written);
    expect(p.attributes.get('data-qa-end')).toBe('');
    writeQa(p, { on: true, at: RING_QUESTIONS - 1, answer: 1, place: { x: 10, y: 20 } }, written);
    expect(p.attributes.has('data-qa-end')).toBe(false);
    writeQa(p, { on: true, at: RING_QUESTIONS, answer: 1, place: { x: 10, y: 20 } }, written);
    clearQa(p, written);
    expect(p.attributes.has('data-qa-end')).toBe(false);
  });

  it('leaves the end with nothing of it left', () => {
    const p = fakeParts();
    const written = qaWritten();
    writeQa(p, { on: true, at: RING_QUESTIONS, answer: 1, place: { x: 10, y: 20 } }, written);
    // Between the marks, on the way back to question 6: the end is gone in the same write.
    writeQa(p, { on: true, at: null, answer: 0, place: null }, written);
    expect(p.attributes.has('data-qa-end')).toBe(false);
    writeQa(p, { on: true, at: RING_QUESTIONS - 1, answer: 1, place: { x: 10, y: 20 } }, written);
    expect([p.attributes.has('data-qa-end'), p.attributes.get('data-qa-at')]).toEqual([false, String(RING_QUESTIONS - 1)]);
    // The Q&A gone (up past question 1 to the look back): nothing either.
    writeQa(p, { on: false, at: null, answer: 0, place: null }, written);
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
    expect(body('html[data-qa-end] .qa-frame')).toMatch(/transform:\s*translate\(calc\(50vw - 50%\), calc\(50vh - 50%\)\)/);
    expect(body('html[data-qa-end] .qa-marks')).toMatch(/opacity:\s*0\b/);
    expect(body('html[data-qa-end] .qa-buttons')).toMatch(/justify-content:\s*center/);
    // On a phone the circle above the words, the words at the foot.
    expect(body('html[data-qa-end] .qa-seal', PHONE)).toMatch(/top:\s*31%/);
    expect(body('html[data-qa-end] .qa-seal', PHONE)).toMatch(/width:\s*64vw/);
    expect(body('html[data-qa-end] .qa-frame', PHONE)).toMatch(/transform:\s*translate\(calc\(50vw - 50%\), calc\(100vh - 100% - 8vh\)\)/);
  });

  it('draws nothing with reduced motion', () => {
    expect(body('html[data-qa-end] .qa-seal', REDUCED)).toMatch(/animation:\s*none/);
    expect(body('html[data-qa-end] .qa-seal', REDUCED)).toMatch(/--qa-draw:\s*360deg/);
    expect(body('.qa-veil', REDUCED)).toMatch(/transition:\s*none/);
  });
});
