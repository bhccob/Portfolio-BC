import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import Contact from '../../src/app/routes/contact';
import Lite from '../../src/app/routes/lite';
import { profile } from '../../src/data/profile';
import { projects } from '../../src/data/projects';
import { qaEntries } from '../../src/data/qa';
import { en } from '../../src/i18n/en';
import { nl } from '../../src/i18n/nl';
import { ContactForm } from '../../src/ui/ContactForm';
import { stripMarkup } from '../../src/ui/Markup';
import { PORTRAIT_SIZE } from '../../src/ui/lite/LiteAbout';

const dictionaries = [
  ['nl', nl, '/lite/', ''],
  ['en', en, '/en/lite/', '/en'],
] as const;

/** The page as the server renders it at `path`. */
const render = (path: string, component: Parameters<typeof createElement>[0]): string =>
  renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, createElement(component as never)));

/** The text of a page: its markup removed and its entities decoded, spaces collapsed. */
const textOf = (html: string): string =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');

describe('the Lite page', () => {
  for (const [name, t, path, prefix] of dictionaries) {
    const html = render(path, Lite);
    const text = textOf(html);

    describe(name, () => {
      it('has exactly one h1 and no skipped heading level', () => {
        const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map((match) => Number(match[1]));
        expect(levels.filter((level) => level === 1)).toHaveLength(1);
        expect(levels[0]).toBe(1);
        levels.slice(1).forEach((level, index) => expect(level - levels[index], `h${levels[index]} then h${level}`).toBeLessThanOrEqual(1));
      });

      it('has the sections in order: the countries, the work, about, skills, career, off duty, the questions, the contact link', () => {
        const ids = ['world', 'work', 'about', 'skills', 'career', 'off-duty', 'questions', 'contact'];
        const places = ids.map((id) => html.indexOf(`<section id="${id}"`));
        expect(places.every((place) => place >= 0), ids.join()).toBe(true);
        expect([...places].sort((a, b) => a - b)).toEqual(places);
        expect(html).toContain('id="career"');
      });

      it('shows each section\u2019s heading', () => {
        const headings = [t.nav.about, t.nav.work, t.about.title, t.skills.title, t.career.title, t.life.title, t.compass.qa.title, t.cta.title];
        const found = [...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/g)].map((match) => textOf(match[1]));
        expect(found).toEqual(headings.map(stripMarkup));
      });

      it('links the three countries and the three projects to their pages, and the contact link to the form', () => {
        for (const country of ['china', 'netherlands', 'aruba']) expect(html).toContain(`href="${prefix}/about/${country}/"`);
        for (const project of projects.all()) {
          expect(html).toContain(`href="${prefix}/projects/${project.id}/"`);
          expect(text).toContain(`${project.category.label(name)} \u00b7 ${project.year}`);
          expect(text).toContain(project.copy(name).summary);
        }
        expect(html).toContain(`href="${prefix}/contact/"`);
      });

      it('carries the About copy, the skills, the whole career, off duty and the Q&A', () => {
        const a = t.about;
        const copy = [
          a.body, a.quote, a.thoughtLabel, a.thought, a.route.heritage, a.route.born, a.route.now,
          a.facts.bornValue, a.facts.heritageValue, a.facts.basedValue, a.facts.studyingValue,
          t.skills.statementSpoken, ...t.skills.rows.flatMap((row) => [row.status, row.title, row.text]),
          t.career.roadmapNote, t.career.currentStatus, t.career.currentRole, t.career.currentOrg, t.career.currentText,
          t.career.hboStatus, t.career.hboRole, t.career.hboOrg, t.career.hboText,
          t.career.nextStatus, t.career.rolesToggle, t.career.rolesHint,
          ...t.career.roleGroups.flatMap((group) => [group.field, ...group.roles.flatMap((role) => [role.title, role.text])]),
          t.career.sector.label, t.career.sector.title, t.career.sector.text,
          t.career.goalStatus, t.career.goalRole, t.career.goalOrg, t.career.goalText, t.career.whyToggle, ...t.career.why,
          t.life.text, t.life.current, t.life.former, ...Object.values(t.life.hobbies),
          ...t.compass.qa.items,
          t.cta.text, t.cta.button, t.cta.or,
        ];
        for (const string of copy) expect(text, string).toContain(string);
        expect(text).toContain(stripMarkup(a.lead).replace('{age}', String(profile.ageOn())));
        expect(html).toContain(`aria-label="${a.route.label}"`); // the origin route is a list named for assistive technology
      });

      it('has the five questions as <details>, and the roles and the reasons folded the same way', () => {
        expect(html.match(/<details[\s>]/g)?.length).toBe(qaEntries(t).length + 2);
        for (const question of t.compass.qa.items) expect(html).toMatch(new RegExp(`<summary[^>]*>.*${question.replace(/[?]/g, '\\?')}.*</summary>`));
      });

      it('shows the real portrait with its size and a meaningful alt text', () => {
        const image = html.match(/<img[^>]*>/)?.[0] ?? '';
        expect(image).toContain('src="');
        expect(image).toContain('portrait');
        expect(image).toContain(`alt="${t.about.portraitAlt}"`);
        expect(image).toContain(`width="${PORTRAIT_SIZE.width}"`);
        expect(image).toContain(`height="${PORTRAIT_SIZE.height}"`);
        expect(t.about.portraitAlt.length).toBeGreaterThan(10);
      });

      it('leaves out the terminal, the clocks and the engine room', () => {
        for (const string of [t.hood.title, t.hood.intro, t.terminal.welcome, t.about.clock.label, t.footer.terminalHint]) {
          expect(text).not.toContain(stripMarkup(string));
        }
      });

      it('writes no style element, and no style attribute but a country\u2019s accent', () => {
        expect(html).not.toContain('<style');
        const styles = [...html.matchAll(/ style="([^"]*)"/g)].map((match) => match[1]);
        expect(styles).toHaveLength(3);
        for (const style of styles) expect(style).toMatch(/^--accent:#[0-9a-f]{6}$/i);
      });

      it('spells Funcial so, claims no AI for it, and never calls Jontai Energy client work', () => {
        expect(text).toContain('Funcial');
        expect(text).not.toMatch(/Funancial/);
        const funcial = projects.byId('funcial')?.copy(name);
        expect(`${funcial?.summary} ${funcial?.metaDescription}`).not.toMatch(/\bAI\b/);
        expect(text).not.toMatch(/\b(client work|klantwerk)\b/i);
      });
    });
  }

  it('has a portrait file of the size its image tag reserves', async () => {
    const meta = await sharp(fileURLToPath(new URL('../../src/assets/portrait.jpg', import.meta.url))).metadata();
    expect({ width: meta.width, height: meta.height }).toEqual(PORTRAIT_SIZE);
  });
});

describe('the contact page', () => {
  const form = (path: string, key?: string): string =>
    renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, createElement(ContactForm, { accessKey: key })));

  /** The start tag of the field called `field`, whatever the order of its attributes (React writes `name` last). */
  const tagOf = (html: string, tag: string, field: string): string => html.match(new RegExp(`<${tag}[^>]*\\sname="${field}"[^>]*>`))?.[0] ?? '';

  for (const [name, t, , prefix] of dictionaries) {
    const path = `${prefix}/contact/`;

    it(`${name}: one h1, the intro, and the direct links (the email address is a mailto: link), whatever the key`, () => {
      const html = render(path, Contact);
      const text = textOf(html);
      expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
      expect(text).toContain(t.contact.intro);
      expect(text).toContain(t.contact.direct);
      for (const social of profile.socials) expect(html).toContain(`href="${social.url}"`);
      expect(html).toContain('href="mailto:bhccob@gmail.com"');
    });

    it(`${name}: the form shows the dictionary's labels, placeholders and privacy line`, () => {
      const html = form(path, 'abc');
      const text = textOf(html);
      for (const string of [t.contact.formTitle, t.contact.name, t.contact.email, t.contact.subject, t.contact.optional, t.contact.message, t.contact.send, t.contact.privacy]) {
        expect(text, string).toContain(string);
      }
      for (const string of [t.contact.namePlaceholder, t.contact.emailPlaceholder, t.contact.subjectPlaceholder, t.contact.messagePlaceholder]) {
        expect(html, string).toContain(`placeholder="${string}"`);
      }
    });
  }

  it('is a form that works without JavaScript when there is a key: native checks, and no script-only novalidate', () => {
    const html = form('/contact/', 'abc');
    expect(tagOf(html, 'input', 'name')).toContain('required=""');
    expect(tagOf(html, 'input', 'email')).toContain('type="email"');
    expect(tagOf(html, 'input', 'email')).toContain('required=""');
    expect(tagOf(html, 'textarea', 'message')).toContain('required=""');
    expect(html).not.toContain('novalidate');
  });

  it('hides the honeypot from people and from screen readers', () => {
    const honey = tagOf(form('/contact/', 'abc'), 'input', 'botcheck');
    expect(honey).toContain('aria-hidden="true"');
    expect(honey).toContain('tabindex="-1"');
  });

  it('with a key posts to Web3Forms and comes back to the contact page of its language', () => {
    const dutch = form('/contact/', 'abc');
    expect(dutch).toMatch(/<form[^>]*action="https:\/\/api\.web3forms\.com\/submit"/);
    expect(tagOf(dutch, 'input', 'access_key')).toContain('value="abc"');
    expect(dutch).toContain('value="https://bhccob.me/contact/?sent=1"');
    expect(form('/en/contact/', 'abc')).toContain('value="https://bhccob.me/en/contact/?sent=1"');
  });

  it('treats a blank key as no key', () => {
    expect(form('/contact/', '   ')).toBe('');
  });

  it('without a key leaves the form out of the prerender: it cannot work without script, so it appears once the page has hydrated', () => {
    // The page\u2019s policy refuses a mailto: form action, and a form posting to its own address ends in an error page.
    const html = form('/contact/');
    expect(html).toBe('');
    expect(html).not.toContain('access_key');
  });
});
