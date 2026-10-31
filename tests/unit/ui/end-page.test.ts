import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import Home from '~/app/routes/home';
import { profile } from '~/data/profile';
import { en, type Dictionary, type EndQuestions } from '~/i18n/en';
import { nl } from '~/i18n/nl';
import { translatorFor } from '~/i18n/useTranslator';
import { EndPage } from '~/ui/EndPage';
import { stripMarkup } from '~/ui/Markup';

/** Bob's own six questions (2026-10-25), which replaced the spec's placeholders, in order. */
const QUESTIONS = {
  nl: [
    'Wat is je plan na het MBO?',
    'Aan wat voor baan denk je?',
    'Wat zijn je hobby’s?',
    'Waar zie je jezelf wonen en werken?',
    'Waar werk je op dit moment mee?',
    'Waar is deze site mee gemaakt?'
  ],
  en: [
    'What is your plan after MBO?',
    'What kind of job do you have in mind?',
    'What are your hobbies?',
    'Where do you see yourself living and working?',
    'What do you work with at the moment?',
    'What is this site built with?'
  ]
} as const;

/** The end copy with every answer missing, so the placeholder's own behaviour can still be shown. */
const unanswered = (t: Dictionary): EndQuestions => t.end.questions.map((item) => ({ ...item, answer: null })) as EndQuestions;

const LOCALES = [
  ['/', 'nl', nl],
  ['/en/', 'en', en]
] as const;

/** `EndPage` as the server renders it on the page at `path`. */
const render = (path: string): string => renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, createElement(EndPage)));

/** The text of markup: its tags removed and its entities decoded, spaces collapsed. */
const textOf = (html: string): string =>
  html
    .replace(/<[^>]*>/g, '').replace(/[<>]/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

/** Text as React's server markup escapes it. */
const textEscape = (text: string | null): string =>
  (text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

/** Every string in a piece of the dictionary. */
const leaves = (value: unknown): string[] => {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(leaves);
  if (value && typeof value === 'object') return Object.values(value).flatMap(leaves);
  return [];
};

/** The texts of a page's questions and of its answers, in order. */
const questionsOf = (html: string): string[] => [...html.matchAll(/<h3 class="end-q">(.*?)<\/h3>/g)].map((match) => textOf(match[1]));
const answersOf = (html: string): string[] => [...html.matchAll(/<p class="end-a[^"]*">(.*?)<\/p>/g)].map((match) => textOf(match[1]));

describe('the end page: the credits', () => {
  afterEach(() => vi.unstubAllEnvs());

  for (const [path, locale, t] of LOCALES) {
    describe(`${locale} (${path})`, () => {
      const html = render(path);

      it('is the credits: Q&A, six questions with their answers, the name, the message part', () => {
        // The section is the page's end: its id is the anchor the story and the nav's link point at. One column in it.
        // "Q&A" takes the focus after the skip button or the failed void's link brings the story here: tabindex -1.
        expect(html).toMatch(/^<section class="end-page" id="end" aria-labelledby="end-title"><div class="end-roll"><h2 id="end-title" class="end-head" tabindex="-1">Q&amp;A<\/h2>/);
        expect(t.end.head).toBe('Q&A');
        expect(questionsOf(html)).toEqual([...QUESTIONS[locale]]);
        expect(t.end.questions.map((item) => item.question)).toEqual([...QUESTIONS[locale]]);
        expect(answersOf(html)).toEqual(t.end.questions.map((item) => item.answer ?? `${t.end.placeholder} ${t.end.placeholderTag}`));
        expect(html).toContain(`<div class="end-sign"><span class="end-line" aria-hidden="true"></span><p class="end-name">${profile.name}</p></div>`);
        // Nothing opens or closes, and the old page's label, title and intro line are gone.
        expect(html).not.toMatch(/<details|<summary|end-intro|page-title|class="label"/);
        // The form itself waits for hydration without the deploy's key, as on /contact/: the title and the links are prerendered.
        const final = html.slice(html.indexOf('<div class="end-final">'));
        expect(final).toMatch(/^<div class="end-final"><h2 class="end-message-title">/);
        expect(textOf(final.match(/<h2 class="end-message-title">(.*?)<\/h2>/)?.[1] ?? '')).toBe(stripMarkup(t.end.messageTitle));
        expect(final).toContain('<ul class="links"');
        expect(html).not.toContain(t.contact.intro);
        // In the credits' order: the heading, the six blocks, the name, the message part, its links.
        const order = ['id="end-title"', 'class="end-block"', 'class="end-sign"', 'class="end-final"', '<ul class="links"'].map((marker) => html.indexOf(marker));
        expect(order.every((place) => place >= 0)).toBe(true);
        expect([...order].sort((a, b) => a - b)).toEqual(order);
        expect(html.match(/class="end-block"/g)).toHaveLength(6);
      });

      it('shows each of Bob’s answers under its question, and no placeholder', () => {
        // Every answer is given: none is missing, so no placeholder and no tag shows.
        for (const { answer } of t.end.questions) expect(typeof answer === 'string' && answer.trim().length > 20).toBe(true);
        expect(html).not.toContain('is-placeholder');
        expect(html).not.toContain('end-tag');
        for (const { question, answer } of t.end.questions) {
          expect(html).toContain(`<div class="end-block"><h3 class="end-q">${textEscape(question)}</h3><p class="end-a">${textEscape(answer)}</p></div>`);
        }
        // The placeholder stays in the copy, for an answer a later edit leaves out.
        expect(t.end.placeholder).toBe(locale === 'nl' ? 'Antwoord volgt.' : 'Answer to follow.');
        expect(t.end.placeholderTag).toBe('placeholder');
      });

      it('has no word outside the dictionaries (and the profile’s name and links)', () => {
        const pieces = (value: string): string[] => [stripMarkup(value), ...value.split(/<\/?em>/)].map((piece) => piece.trim());
        const allowed = new Set([
          ...[...leaves(t.end), ...leaves(t.contact)].flatMap(pieces),
          `(${t.contact.optional})`,
          profile.name,
          ...profile.socials.map((social) => `${social.label} · ${social.handle}`)
        ]);
        // With an access key, so the form's own words are on the page too.
        vi.stubEnv('PUBLIC_WEB3FORMS_KEY', 'abc');
        const text = render(path)
          .replace(/<[^>]*>/g, '\n')
          .split('\n')
          .map((node) => textOf(node))
          .filter((node) => node.length > 0);
        expect(text.length).toBeGreaterThan(20);
        for (const node of text) expect(allowed.has(node), `"${node}"`).toBe(true);
      });
    });
  }

  it('shows the answer when there is one, and the placeholder for the rest', () => {
    const translator = translatorFor('en');
    const original = translator.t;
    const [first, ...rest] = unanswered(original);
    const withAnswer: Dictionary = { ...original, end: { ...original.end, questions: [{ ...first, answer: 'X' }, ...rest] } };
    (translator as { t: Dictionary }).t = withAnswer;
    try {
      const html = render('/en/');
      expect(html).toContain(`<h3 class="end-q">${first.question}</h3><p class="end-a">X</p>`);
      expect(html.match(/class="end-a is-placeholder"/g)).toHaveLength(5);
      expect(html.match(/class="end-tag"/g)).toHaveLength(5);
      // The answered question reads "X" with no tag in it.
      const firstBlock = html.slice(html.indexOf('<div class="end-block">'), html.indexOf('</div>', html.indexOf('<div class="end-block">')));
      expect(firstBlock).not.toContain('end-tag');
      expect(firstBlock).not.toContain('is-placeholder');
      expect(firstBlock.match(/<p class="end-a">(.*?)<\/p>/)?.[1]).toBe('X');
    } finally {
      (translator as { t: Dictionary }).t = original;
    }
  });

  it('shows the placeholder and its tag for any missing answer: one left out of a translation, or empty, never a blank', () => {
    const translator = translatorFor('en');
    const original = translator.t;
    const [first, second, ...rest] = unanswered(original);
    // A translation that leaves an answer out (no key at all, past its type) and one that gives it as an empty string.
    const absent = { question: first.question } as unknown as (typeof original.end.questions)[number];
    const empty = { ...second, answer: '' };
    const withGaps: Dictionary = { ...original, end: { ...original.end, questions: [absent, empty, ...rest] as unknown as EndQuestions } };
    (translator as { t: Dictionary }).t = withGaps;
    try {
      const html = render('/en/');
      expect(html.match(/class="end-a is-placeholder"/g)).toHaveLength(6);
      expect(html.match(/class="end-tag"/g)).toHaveLength(6);
      for (const question of [first.question, second.question]) {
        expect(html).toContain(`<h3 class="end-q">${question}</h3><p class="end-a is-placeholder">${original.end.placeholder} <span class="end-tag">${original.end.placeholderTag}</span></p>`);
      }
      expect(html).not.toContain('<p class="end-a"></p>');
    } finally {
      (translator as { t: Dictionary }).t = original;
    }
  });

  for (const [path, locale, t] of LOCALES) {
    it(`renders the contact form once, with its own ids, and the links of the profile, in ${locale}`, () => {
      vi.stubEnv('PUBLIC_WEB3FORMS_KEY', 'abc');
      const html = render(path);
      expect(html.match(/<form\b/g)).toHaveLength(1);
      for (const id of ['contact-name', 'contact-email', 'contact-subject', 'contact-message', 'contact-form-title']) {
        expect(html.match(new RegExp(`\\sid="${id}"`, 'g')), id).toHaveLength(1);
      }
      // The form's title one level under the message part's own (an h2), so the outline does not set two h2 in a row.
      expect(html).toContain(`<h3 id="contact-form-title" class="form-title">${t.contact.formTitle}</h3>`);
      expect(html).not.toContain('<h2 id="contact-form-title"');
      const outline = [...html.matchAll(/<(h[1-6])\b[^>]*>(.*?)<\/\1>/g)].map((match) => `${match[1]} ${textOf(match[2])}`);
      expect(outline.slice(-2)).toEqual([`h2 ${stripMarkup(t.end.messageTitle)}`, `h3 ${t.contact.formTitle}`]);
      // The three links, in the profile's order, the mailto one not opening a tab.
      const links = [...html.matchAll(/<ul class="links"[^>]*>(.*?)<\/ul>/g)];
      expect(links).toHaveLength(1);
      const anchors = [...links[0][1].matchAll(/<a\b([^>]*)>(.*?)<\/a>/g)];
      expect(anchors.map((anchor) => textOf(anchor[2]))).toEqual(profile.socials.map((social) => `${social.label} · ${social.handle}`));
      anchors.forEach((anchor, index) => {
        expect(anchor[1]).toContain(`href="${profile.socials[index].url}"`);
        expect(anchor[1].includes('target="_blank"')).toBe(!profile.socials[index].url.startsWith('mailto:'));
      });
    });
  }

  for (const [path, locale, t] of [
    ['/contact/', 'nl', nl],
    ['/en/contact/', 'en', en],
  ] as const) {
    it(`keeps the form's title an h2 on the contact page, under its h1, in ${locale}: the level's default`, async () => {
      // The contact page reads its key as it is imported: with one, the form is in its HTML, so the page is imported
      // afresh under the key, with the React and the router it renders with.
      vi.stubEnv('PUBLIC_WEB3FORMS_KEY', 'abc');
      vi.resetModules();
      const [{ default: ContactPage }, react, server, router] = await Promise.all([
        import('~/app/routes/contact'),
        import('react'),
        import('react-dom/server'),
        import('react-router'),
      ]);
      const html = server.renderToStaticMarkup(react.createElement(router.MemoryRouter, { initialEntries: [path] }, react.createElement(ContactPage)));
      expect(html).toContain(`<h2 id="contact-form-title" class="form-title">${t.contact.formTitle}</h2>`);
      expect(html).not.toContain('<h3 id="contact-form-title"');
      expect(html.indexOf('<h1')).toBeLessThan(html.indexOf('id="contact-form-title"'));
    });
  }

  it('leaves the form out of the HTML without an access key, as the contact page does (the links stay)', () => {
    vi.stubEnv('PUBLIC_WEB3FORMS_KEY', '');
    const html = render('/');
    expect(html).not.toContain('<form');
    expect(html).toContain('<ul class="links"');
  });

  it('is on the home page, after the project links of the nav, in both languages', () => {
    for (const [path] of LOCALES) {
      const home = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, createElement(Home)));
      expect(home.indexOf('class="home-nav"')).toBeGreaterThan(-1);
      expect(home.indexOf('class="home-nav"')).toBeLessThan(home.indexOf('id="end"'));
      expect(home.match(/id="end"/g)).toHaveLength(1);
      expect(home).toContain('class="end-head" tabindex="-1">Q&amp;A</h2>');
    }
  });

  it('types the questions as a six-tuple, so a translation with another count fails type-checking (tsc)', () => {
    type Items = Dictionary['end']['questions'];
    expectTypeOf<Items>().toEqualTypeOf<EndQuestions>();
    expectTypeOf<Items['length']>().toEqualTypeOf<6>();
    expectTypeOf<Items[number]>().toEqualTypeOf<{ question: string; answer: string | null }>();
    const item = { question: 'q', answer: null };
    // Each of these must not compile: the directive itself fails tsc where the line does compile.
    // @ts-expect-error a seventh question is no translation's
    const seventh: Items = [item, item, item, item, item, item, item];
    // @ts-expect-error a translation missing its sixth question
    const missing: Items = [item, item, item, item, item];
    // @ts-expect-error an answer is a string or null, never a number
    const wrong: Items = [{ ...item, answer: 1 }, item, item, item, item, item];
    expect([seventh, missing, wrong]).toHaveLength(3);
  });

  it('puts the same keys in the Dutch end copy as in the English', () => {
    expect(Object.keys(nl.end)).toEqual(Object.keys(en.end));
    expect(nl.end.questions).toHaveLength(6);
    expect(nl.end.failLink).toBe('Vragen & contact');
    expect(en.end.failLink).toBe('Questions & contact');
    expect([nl.end.head, nl.end.messageTitle]).toEqual(['Q&A', 'Stuur een <em>bericht.</em>']);
    expect([en.end.head, en.end.messageTitle]).toEqual(['Q&A', 'Send a <em>message.</em>']);
    expect(Object.keys(nl.end)).not.toEqual(expect.arrayContaining(['label']));
    for (const gone of ['label', 'title', 'intro']) expect(Object.keys(en.end)).not.toContain(gone);
  });

  it('never names the classmate of Cookies Clicker, and keeps what Bob asked the answers to say', () => {
    for (const t of [en, nl]) {
      const copy = leaves(t.end).join(' ');
      expect(copy).not.toMatch(/classmate|klasgenoot|klasgenote/i);
    }
    // Bob's own answers (2026-10-25): Mechatronics at Fontys after MBO, and his own company in the job answer.
    expect(nl.end.questions[0].answer).toMatch(/Mechatronica.*Fontys/);
    expect(en.end.questions[0].answer).toMatch(/Mechatronics.*Fontys/);
    expect(nl.end.questions[1].answer).toMatch(/eigen bedrijf/);
    expect(en.end.questions[1].answer).toMatch(/own company/);
  });
});

/** base.css with its comments removed. */
const base = readFileSync(fileURLToPath(new URL('../../../src/styles/base.css', import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
/** The declarations of the first rule of base.css whose selector is exactly `selector` (white space collapsed). */
function rule(selector: string): string {
  for (const match of base.matchAll(/([^{}]+)\{([^{}]*)\}/g)) if (match[1].trim().replace(/\s+/g, ' ') === selector) return match[2];
  throw new Error(`no rule for ${selector}`);
}

const AT_END = "html[data-route='home'][data-3d='on'][data-end]";
const MOVE = "html[data-route='home'][data-3d='on'][data-end='moving']";

describe('the credits’ look (src/styles/base.css)', () => {
  it('is a normal centred page in the flow with 3D off, no WebGL or the fallback card: every move, hold and fade names 3D on', () => {
    const LAYOUT = /(?:^|;)\s*(?:(?:position|transform|padding-top|min-height|height|opacity|background)\s*:|display\s*:\s*none)/;
    for (const match of base.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selectors = match[1].trim().replace(/\s+/g, ' ').split(', ');
      for (const selector of selectors) {
        if (!/\.end-(page|roll|final)(::before|::after)?$/.test(selector) || !LAYOUT.test(match[2])) continue;
        // A step fade is Home's, and Home runs only with 3D on.
        if (selector.includes('[data-step-fade]')) continue;
        expect(selector, selector).toMatch(/\[data-3d='on'\]/);
      }
    }
    // Its own rules: a column in the middle of the page, under the page's own padding.
    expect(rule('.end-page')).toMatch(/padding:\s*48px var\(--gutter\) 96px/);
    expect(rule('.end-roll')).toMatch(/margin:\s*0 auto/);
  });

  it('sets one column of 580 px in the middle, its text centred', () => {
    const roll = rule('.end-roll');
    expect(roll).toMatch(/width:\s*min\(580px, 100%\)/);
    expect(roll).toMatch(/margin:\s*0 auto/);
    expect(roll).toMatch(/text-align:\s*center/);
  });

  it('sizes the credits as the mock-up: "Q&A" and the name 15 px, questions 13 px gold capitals, answers 19 px', () => {
    const head = rule('.end-head, .end-name');
    expect(head).toMatch(/font-family:\s*var\(--font-label\)/);
    expect(head).toMatch(/font-size:\s*15px/);
    expect(head).toMatch(/letter-spacing:\s*0\.4em/);
    expect(head).toMatch(/color:\s*var\(--gold-ink\)/);
    const question = rule('.end-q');
    expect(question).toMatch(/font-size:\s*13px/);
    expect(question).toMatch(/letter-spacing:\s*0\.22em/);
    expect(question).toMatch(/text-transform:\s*uppercase/);
    expect(question).toMatch(/color:\s*var\(--gold-ink\)/);
    const answer = rule('.end-a');
    expect(answer).toMatch(/font-size:\s*19px/);
    expect(answer).toMatch(/line-height:\s*1\.7/);
    expect(answer).toMatch(/color:\s*var\(--ink\)/);
    expect(rule('.end-message-title')).toMatch(/font-size:\s*34px/);
  });

  it('spaces them as the mock-up: 140 px between blocks, 150 after "Q&A", 170 before the name, 220 before the message', () => {
    expect(rule('.end-block')).toMatch(/margin-top:\s*140px/);
    expect(rule('.end-head + .end-block')).toMatch(/margin-top:\s*150px/);
    expect(rule('.end-sign')).toMatch(/margin-top:\s*170px/);
    expect(rule('.end-final')).toMatch(/margin-top:\s*220px/);
    expect(rule('.end-line')).toMatch(/width:\s*56px/);
  });

  it('is a step smaller on a phone: answers 16 px, questions 12 px, blocks 110 px apart, the title 26 px', () => {
    const phone = base.match(/@media \(max-width: 600px\) \{\s*\.end-a \{([^}]*)\}\s*\.end-q \{([^}]*)\}\s*\.end-block \{([^}]*)\}\s*\.end-message-title \{([^}]*)\}\s*\}/);
    expect(phone).not.toBeNull();
    const [, answer, question, block, title] = phone!;
    expect(answer).toMatch(/font-size:\s*16px/);
    expect(question).toMatch(/font-size:\s*12px/);
    expect(block).toMatch(/margin-top:\s*110px/);
    expect(title).toMatch(/font-size:\s*26px/);
  });

  it('stands "Q&A" at 55 % of the screen at rest and at the rise’s end: in the flow under the header, or fixed a screen tall', () => {
    expect(rule(`${AT_END} .end-page`)).toMatch(/padding-top:\s*calc\(55dvh - var\(--header-height\)\)/);
    const moving = rule(`${MOVE} .end-page`);
    expect(moving).toMatch(/position:\s*fixed/);
    expect(moving).toMatch(/height:\s*100dvh/);
    expect(moving).toMatch(/padding-top:\s*55dvh/);
    expect(moving).toMatch(/overflow:\s*hidden/);
    // Its night is the black's share of the night; its column slides up from the screen's foot with the rise.
    expect(moving).toMatch(/background:\s*rgb\(4 2 9 \/ var\(--end-black, 0\)\)/);
    expect(rule(`${MOVE} .end-roll`)).toMatch(/transform:\s*translateY\(calc\(\(1 - var\(--end-rise, 0\)\) \* 45dvh\)\)/);
    expect(base).not.toMatch(/var\(--end\)/);
  });

  it('rests the message part a screen tall less the header, its contents in the middle', () => {
    const final = rule(`${AT_END} .end-final`);
    expect(final).toMatch(/min-height:\s*calc\(100dvh - var\(--header-height\)\)/);
    expect(final).toMatch(/justify-content:\s*center/);
    expect(rule('.end-final')).toMatch(/flex-direction:\s*column/);
  });

  it('fades the text at the screen’s top and foot, fixed and 20 % tall, and not with reduced motion', () => {
    const edges = rule(`${AT_END} .end-page::before, ${AT_END} .end-page::after`);
    expect(edges).toMatch(/position:\s*fixed/);
    expect(edges).toMatch(/height:\s*20dvh/);
    expect(edges).toMatch(/pointer-events:\s*none/);
    // From the screen's very top: at rest the header scrolls away with the page.
    expect(rule(`${AT_END} .end-page::before`)).toMatch(/top:\s*0;/);
    expect(rule(`${AT_END} .end-page::after`)).toMatch(/bottom:\s*0/);
    // On the way in, only once the rise has begun, when the black is whole.
    expect(rule(`${MOVE} .end-page::before, ${MOVE} .end-page::after`)).toMatch(/opacity:\s*calc\(var\(--end-rise, 0\) \* 1000\)/);
    expect(base).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\s*html\[data-route='home'\]\[data-3d='on'\]\[data-end\] \.end-page::before,\s*html\[data-route='home'\]\[data-3d='on'\]\[data-end\] \.end-page::after \{\s*display:\s*none;\s*\}\s*\}/
    );
  });

  it('lifts the edge fades once the message part is up (data-final), easing at rest only', () => {
    expect(rule(`${AT_END} .end-page[data-final]::before, ${AT_END} .end-page[data-final]::after`)).toMatch(/opacity:\s*0/);
    const REST = "html[data-route='home'][data-3d='on'][data-end='rest']";
    expect(rule(`${REST} .end-page::before, ${REST} .end-page::after`)).toMatch(/transition:\s*opacity 0\.4s ease/);
  });

  it('sets the form’s part in a 400 px column, its fields left-aligned, its own title for a screen reader alone', () => {
    const form = rule('.end-final > section');
    expect(form).toMatch(/width:\s*min\(400px, 100%\)/);
    expect(form).toMatch(/margin-top:\s*32px/);
    expect(form).toMatch(/text-align:\s*left/);
    // The approved mock-up shows only the message title over the fields; the form keeps its label for a screen reader.
    const title = rule('.end-final #contact-form-title');
    expect(title).toMatch(/position:\s*absolute/);
    expect(title).toMatch(/clip-path:\s*inset\(50%\)/);
    expect(title).not.toMatch(/display:\s*none/);
  });

  it('sets the placeholder in the dim colour, in italics, and the tag as a small pill in the label font', () => {
    const placeholder = rule('.end-a.is-placeholder');
    expect(placeholder).toMatch(/color:\s*var\(--ink-dim\)/);
    expect(placeholder).toMatch(/font-style:\s*italic/);
    const tag = rule('.end-tag');
    expect(tag).toMatch(/font-family:\s*var\(--font-label\)/);
    expect(tag).toMatch(/border-radius:\s*999px/);
    expect(tag).toMatch(/font-style:\s*normal/);
  });

  it('sets the message title in the title font with its features (the Dutch IJ), as the other titles', () => {
    const title = rule('.end-message-title');
    expect(title).toMatch(/font-family:\s*var\(--font-title\)/);
    expect(title).toMatch(/font-feature-settings:\s*var\(--font-title-features\)/);
    expect(title).toMatch(/color:\s*var\(--gold-title\)/);
  });
});
