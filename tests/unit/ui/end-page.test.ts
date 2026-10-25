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

/** The line under the title (Bob, 2026-10-25: "i want one"). */
const INTRO = {
  nl: 'Wie ik ben, wat ik doe en waar ik naartoe wil.',
  en: 'Who I am, what I do and where I am heading.'
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
    .replace(/<[^>]*>/g, '')
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

/** The `<details>` start tags and the `<summary>` texts of a page, in order. */
const detailsTags = (html: string): string[] => [...html.matchAll(/<details\b[^>]*>/g)].map((match) => match[0]);
const summaries = (html: string): string[] => [...html.matchAll(/<summary\b[^>]*>(.*?)<\/summary>/g)].map((match) => textOf(match[1]));

describe('the end page', () => {
  afterEach(() => vi.unstubAllEnvs());

  for (const [path, locale, t] of LOCALES) {
    describe(`${locale} (${path})`, () => {
      const html = render(path);

      it('renders the label, the title and six closed questions', () => {
        // The section is the page's end: its id is the anchor the story and the nav's link point at.
        expect(html).toMatch(/^<section class="end-page" id="end" aria-labelledby="end-title">/);
        // The label above the title, in the site's label style.
        // The title takes the focus after the failed void's link brings the story here (src/ui/endArrival.ts): tabindex -1.
        expect(html).toMatch(new RegExp(`<p class="label">${t.end.label}</p><h2 id="end-title" class="page-title" tabindex="-1">`));
        const title = html.match(/<h2 id="end-title" class="page-title" tabindex="-1">(.*?)<\/h2>/)?.[1] ?? '';
        expect(textOf(title)).toBe(stripMarkup(t.end.title));
        expect(title).toContain('<em>');
        // Six <details> in one exclusive group, none open on arrival, the summaries the spec's questions in order.
        const tags = detailsTags(html);
        expect(tags).toHaveLength(6);
        for (const tag of tags) {
          expect(tag).toContain('name="end-qa"');
          expect(tag).toContain('class="end-q"');
          expect(tag).not.toMatch(/\sopen[\s=>]/);
        }
        expect(summaries(html)).toEqual([...QUESTIONS[locale]]);
        expect(t.end.questions.map((item) => item.question)).toEqual([...QUESTIONS[locale]]);
      });

      it('puts the intro line under the title, before the questions', () => {
        expect(t.end.intro).toBe(INTRO[locale]);
        expect(html).toMatch(new RegExp(`</h2><p class="lead end-intro">${t.end.intro}</p><div class="end-qa">`));
      });

      it('shows each of Bob’s answers inside its question, and no placeholder', () => {
        // Every answer is given: none is missing, so no placeholder and no tag shows.
        for (const { answer } of t.end.questions) expect(typeof answer === 'string' && answer.trim().length > 20).toBe(true);
        expect(html).not.toContain('is-placeholder');
        expect(html).not.toContain('end-tag');
        for (const { question, answer } of t.end.questions) expect(html).toContain(`<summary>${textEscape(question)}</summary><p class="end-a">${textEscape(answer)}</p>`);
        // The placeholder stays in the copy, for an answer a later edit leaves out.
        expect(t.end.placeholder).toBe(locale === 'nl' ? 'Antwoord volgt.' : 'Answer to follow.');
        expect(t.end.placeholderTag).toBe('placeholder');
      });

      it('has the message part: its title, the contact intro, then the form and the links', () => {
        const title = html.match(/<h2 class="end-message-title">(.*?)<\/h2>/)?.[1] ?? '';
        expect(textOf(title)).toBe(stripMarkup(t.end.messageTitle));
        expect(title).toContain('<em>');
        expect(html).toContain(`<p class="lead">${t.contact.intro}</p>`);
        const order = ['id="end-title"', 'class="end-message-title"', `<p class="lead">`, '<ul class="links"'].map((marker) => html.indexOf(marker));
        expect(order.every((place) => place >= 0)).toBe(true);
        expect([...order].sort((a, b) => a - b)).toEqual(order);
        // The questions come before the message part.
        expect(html.lastIndexOf('<details')).toBeLessThan(html.indexOf('class="end-message-title"'));
      });

      it('has no word outside the dictionaries (and the profile’s links)', () => {
        const pieces = (value: string): string[] => [stripMarkup(value), ...value.split(/<\/?em>/)].map((piece) => piece.trim());
        const allowed = new Set([
          ...[...leaves(t.end), ...leaves(t.contact)].flatMap(pieces),
          `(${t.contact.optional})`,
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
      expect(html).toContain(`<summary>${first.question}</summary><p class="end-a">X</p>`);
      expect(html.match(/class="end-a is-placeholder"/g)).toHaveLength(5);
      expect(html.match(/class="end-tag"/g)).toHaveLength(5);
      // The answered question reads "X" with no tag in it.
      const firstDetails = html.slice(html.indexOf('<details'), html.indexOf('</details>'));
      expect(firstDetails).not.toContain('end-tag');
      expect(firstDetails).not.toContain('is-placeholder');
      expect(firstDetails.match(/<p class="end-a">(.*?)<\/p>/)?.[1]).toBe('X');
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
        expect(html).toContain(`<summary>${question}</summary><p class="end-a is-placeholder">${original.end.placeholder} <span class="end-tag">${original.end.placeholderTag}</span></p>`);
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
    for (const [path, , t] of LOCALES) {
      const home = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, createElement(Home)));
      expect(home.indexOf('class="home-nav"')).toBeGreaterThan(-1);
      expect(home.indexOf('class="home-nav"')).toBeLessThan(home.indexOf('id="end"'));
      expect(home.match(/id="end"/g)).toHaveLength(1);
      expect(home).toContain(`>${t.end.label}</p>`);
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
    expect([nl.end.label, nl.end.title, nl.end.messageTitle]).toEqual(['Vragen', 'Vragen <em>over mij.</em>', 'Stuur een <em>bericht.</em>']);
    expect([en.end.label, en.end.title, en.end.messageTitle]).toEqual(['Questions', 'Questions <em>about me.</em>', 'Send a <em>message.</em>']);
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

/** The declarations of the first rule of base.css whose selector is exactly `selector`. */
const base = readFileSync(fileURLToPath(new URL('../../../src/styles/base.css', import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
function rule(selector: string): string {
  for (const match of base.matchAll(/([^{}]+)\{([^{}]*)\}/g)) if (match[1].trim() === selector) return match[2];
  throw new Error(`no rule for ${selector}`);
}

describe('the end page’s look (src/styles/base.css)', () => {
  it('keeps its column to 44rem inside the gutters, the width of the site’s other pages', () => {
    expect(rule('.end-page')).toMatch(/max-width:\s*calc\(44rem \+ 2 \* var\(--gutter\)\)/);
  });

  it('puts a hairline between the questions, in the gold of the site at 0.22', () => {
    expect(rule('.end-q')).toMatch(/border-bottom:\s*1px solid rgb\(228 190 127 \/ 0\.22\)/);
    expect(rule('.end-qa')).toMatch(/border-top:\s*1px solid rgb\(228 190 127 \/ 0\.22\)/);
  });

  it('draws a gold + on the summary that turns to − when it is open, and hides the browser’s marker', () => {
    expect(rule('.end-q > summary')).toMatch(/list-style:\s*none/);
    expect(rule('.end-q > summary::-webkit-details-marker')).toMatch(/display:\s*none/);
    expect(rule('.end-q > summary::after')).toMatch(/var\(--gold-ink\)/);
    expect(rule('.end-q > summary::after')).toMatch(/content:\s*''/);
    // Open: the upright stroke is gone, and the + is a −.
    expect(rule('.end-q[open] > summary::after')).toMatch(/background-size:/);
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
