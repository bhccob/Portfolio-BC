import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { PAGES } from '../../src/data/pages';
import { en } from '../../src/i18n/en';
import { nl } from '../../src/i18n/nl';
import { Translator } from '../../src/i18n/Translator';
import { useScene } from '../../src/state/store';
import { LangSwitch } from '../../src/ui/LangSwitch';
import { SiteHeader } from '../../src/ui/SiteHeader';
import { ThreeDToggle } from '../../src/ui/ThreeDToggle';

const render = (path: string, component: FunctionComponent): string =>
  renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, createElement(component)));

/** The attributes of the first element of the markup, decoded. */
const attributes = (html: string): Record<string, string> =>
  Object.fromEntries(
    [...(/^<\w+([^>]*)>/.exec(html)?.[1] ?? '').matchAll(/([\w-]+)="([^"]*)"/g)].map(([, name, value]) => [name, value.replace(/&quot;/g, '"').replace(/&amp;/g, '&')]),
  );

/** The text a sighted visitor reads: the markup without its tags. */
const visibleText = (html: string): string => html.replace(/<[^>]*>/g, '');

/** Every `<tag>…</tag>` of the markup, each with its attributes and its visible text. */
const elementsOf = (html: string, tag: string): { attrs: Record<string, string>; text: string }[] =>
  [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>.*?</${tag}>`, 'gs'))].map(([markup]) => ({ attrs: attributes(markup), text: visibleText(markup) }));

describe('the language switch', () => {
  it.each([
    ['/lite/', 'EN', nl.nav.switchTo],
    ['/en/lite/', 'NL', en.nav.switchTo],
  ])('on %s its name starts with the visible "%s", then says what it does (WCAG 2.5.3, label in name)', (path, code, says) => {
    const html = render(path, LangSwitch);
    const label = attributes(html)['aria-label'] ?? '';
    expect(visibleText(html)).toBe(code);
    expect(label.startsWith(`${code} `)).toBe(true);
    expect(label).toContain(says);
  });
});

describe('the 3D switch', () => {
  // A server render reads the store's initial state (the snapshot React hydrates with), so the state rendered is set there.
  const initial = useScene.getInitialState();
  afterEach(() => {
    initial.threeD = true;
  });

  it.each([true, false])('with 3D %s it is named "3D" whatever its state; the state is role=switch and aria-checked', (on) => {
    initial.threeD = on;
    for (const [path, t] of [['/', nl], ['/en/', en]] as const) {
      const html = render(path, ThreeDToggle);
      const attrs = attributes(html);
      expect(attrs['aria-label'], path).toBe(t.needle.toggle.label);
      expect(attrs.role).toBe('switch');
      expect(attrs['aria-checked']).toBe(String(on));
      expect(visibleText(html), path).toBe(on ? t.needle.toggle.on : t.needle.toggle.off);
      expect(visibleText(html).startsWith(t.needle.toggle.label), 'the visible words begin with the name').toBe(true);
    }
  });
});

describe('the header on the home page', () => {
  // The hero's three lines are the page's own; the header around them is milestone 1's, unchanged: the Lite link, the
  // contact link, the language switch and the 3D switch (sound is milestone 6, and the name is the hero's on the home page).
  const initial = useScene.getInitialState();
  afterEach(() => {
    initial.threeD = true;
  });

  it.each([
    ['/', nl, 'nl' as const],
    ['/en/', en, 'en' as const],
  ])('on %s it shows the Lite link, the contact link, the language switch and the 3D switch, and nothing else', (path, t, locale) => {
    initial.threeD = true;
    const html = render(path, SiteHeader);
    const links = elementsOf(html, 'a');
    const link = (href: string) => links.find((candidate) => candidate.attrs.href === href);
    const other = locale === 'en' ? 'nl' : 'en';

    expect(link(Translator.pathFor(locale, PAGES.lite))?.text, 'Lite').toBe(t.needle.liteLink);
    expect(link(Translator.pathFor(locale, PAGES.contact))?.text, 'contact').toBe(t.nav.contact);
    const lang = link(Translator.pathFor(other, PAGES.home));
    expect(lang?.text, 'language switch').toBe(other.toUpperCase());
    expect(lang?.attrs['aria-label']?.startsWith(`${other.toUpperCase()} `)).toBe(true);
    const switches = elementsOf(html, 'button');
    expect(switches).toHaveLength(1);
    expect(switches[0].attrs.role, '3D switch').toBe('switch');
    expect(switches[0].attrs['aria-label']).toBe(t.needle.toggle.label);

    // Four controls in the header's nav (three links and the switch); the only other link is the skip link, and the
    // home page's header has no name link, as the hero says the name there.
    expect(links.filter((a) => a.attrs.class === 'header-control')).toHaveLength(3);
    expect(links.filter((a) => a.attrs.class === 'skip-link')).toHaveLength(1);
    expect(links).toHaveLength(4);
    expect(html).not.toContain('site-name');
  });
});
