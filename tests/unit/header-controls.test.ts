import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { PAGES } from '../../src/data/pages';
import { en } from '../../src/i18n/en';
import { routeFromPath } from '../../src/i18n/locale';
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

/** The links and buttons of the markup, in the order of the page, each with its attributes and its visible text. */
const controlsOf = (html: string): { tag: string; attrs: Record<string, string>; text: string }[] =>
  [...html.matchAll(/<(a|button)\b[^>]*>.*?<\/\1>/gs)].map(([markup, tag]) => ({ tag, attrs: attributes(markup), text: visibleText(markup) }));

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

describe('the header', () => {
  // The same bar on every page, the home page included, since the home's hero says the name only to a screen reader:
  // the name, Work and About (both point at Lite until the projects void exists), Contact, the language switch, the Lite
  // link and the 3D switch (sound is milestone 6).
  const initial = useScene.getInitialState();
  afterEach(() => {
    initial.threeD = true;
  });

  it.each([
    ['/', nl, 'nl' as const],
    ['/en/', en, 'en' as const],
    ['/lite/', nl, 'nl' as const],
    ['/en/contact/', en, 'en' as const],
    ['/projects/funcial/', nl, 'nl' as const],
  ])('on %s it lists the name, Work, About, Contact, the language switch, Lite and the 3D switch, in that order', (path, t, locale) => {
    initial.threeD = true;
    const controls = controlsOf(render(path, SiteHeader));
    const other = locale === 'en' ? 'nl' : 'en';
    const at = (route: string): string => Translator.pathFor(locale, route);

    // The order by the links' addresses and the switch's role ...
    expect(controls.map((control) => (control.tag === 'button' ? control.attrs.role : control.attrs.href))).toEqual([
      '#main',
      at(PAGES.home),
      at(`${PAGES.lite}#work`),
      at(`${PAGES.lite}#about`),
      at(PAGES.contact),
      Translator.pathFor(other, routeFromPath(path)),
      at(PAGES.lite),
      'switch',
    ]);
    // ... and by the labels the components render.
    expect(controls.map((control) => control.text)).toEqual([
      t.nav.skip,
      t.needle.hero.name,
      t.nav.work,
      t.nav.about,
      t.nav.contact,
      other.toUpperCase(),
      t.needle.liteLink,
      t.needle.toggle.on,
    ]);

    // The name is a link home that says so, on the home page as on any other; the nav holds five links and the switch.
    expect(controls[1].attrs.class).toBe('site-name');
    expect(controls[1].attrs['aria-label']).toBe(t.nav.home);
    expect(controls.filter((control) => control.attrs.class === 'header-control')).toHaveLength(6);
    expect(controls[5].attrs['aria-label']?.startsWith(`${other.toUpperCase()} `)).toBe(true);
    expect(controls[7].attrs['aria-label']).toBe(t.needle.toggle.label);
  });
});
