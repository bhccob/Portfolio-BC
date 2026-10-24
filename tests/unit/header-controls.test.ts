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
import { closeMenuOnLink, MENU_ID, nameToTop, SiteHeader } from '../../src/ui/SiteHeader';
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
    expect(controls.map((control) => (control.tag === 'button' ? (control.attrs.role ?? control.attrs.class) : control.attrs.href))).toEqual([
      '#main',
      at(PAGES.home),
      'menu-toggle',
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
      t.nav.menu + t.nav.close,
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
    expect(controls[6].attrs['aria-label']?.startsWith(`${other.toUpperCase()} `)).toBe(true);
    expect(controls[8].attrs['aria-label']).toBe(t.needle.toggle.label);
  });
});

describe("the header's name on the home: the story to its start, as the Home key takes it (goToTop)", () => {
  /** A click on the name as the link's handler receives it: a plain left click unless `overrides` say otherwise. */
  const click = (overrides: Partial<{ button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; defaultPrevented: boolean }> = {}) => {
    const event = {
      button: 0,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      defaultPrevented: false,
      ...overrides,
      preventDefault() {
        event.defaultPrevented = true;
      },
    };
    return event;
  };

  it.each(['/', '/en/'])('on %s a plain click takes the story to its start by goToTop, and the link does not navigate', (path) => {
    let asked = 0;
    const event = click();
    nameToTop(event, path, () => {
      asked++;
      return true;
    });
    expect([asked, event.defaultPrevented]).toEqual([1, true]);
  });

  it("leaves the link to navigate where the home's scroll does not take it (3D off, a bead opening, none connected)", () => {
    const refused = click();
    nameToTop(refused, '/', () => false);
    expect(refused.defaultPrevented).toBe(false);
    const unconnected = click(); // the real goToTop, with no home scroll connected in this test
    nameToTop(unconnected, '/');
    expect(unconnected.defaultPrevented).toBe(false);
  });

  it.each(['/lite/', '/en/contact/', '/projects/funcial/', '/en/projects/cookies-clicker/'])('on %s, not the home, the link navigates as ever', (path) => {
    let asked = 0;
    const event = click();
    nameToTop(event, path, () => {
      asked++;
      return true;
    });
    expect([asked, event.defaultPrevented]).toEqual([0, false]);
  });

  it.each([
    ['ctrl', { ctrlKey: true }],
    ['meta (cmd)', { metaKey: true }],
    ['shift', { shiftKey: true }],
    ['alt', { altKey: true }],
    ['the middle button', { button: 1 }],
    ['one already handled', { defaultPrevented: true }],
  ])('leaves a click with %s to the browser', (_, overrides) => {
    let asked = 0;
    const event = click(overrides);
    nameToTop(event, '/', () => {
      asked++;
      return true;
    });
    expect(asked).toBe(0);
    expect(event.defaultPrevented, 'prevented only if it already was').toBe('defaultPrevented' in overrides);
  });
});

describe('the phone menu (option A, 2026-10-22)', () => {
  it.each([
    ['/', nl],
    ['/en/projects/funcial/', en],
  ])('on %s the Menu button opens the nav as a popover, by the browser alone (no script needed)', (path, t) => {
    const html = render(path, SiteHeader);
    const toggle = /<button[^>]*class="menu-toggle"[^>]*>/.exec(html)?.[0] ?? '';
    // HTML attribute names ignore case: React writes `popoverTarget`, which the browser reads as `popovertarget`.
    const toggleAttrs = Object.fromEntries(Object.entries(attributes(toggle)).map(([name, value]) => [name.toLowerCase(), value]));
    expect(toggleAttrs.popovertarget).toBe(MENU_ID);
    expect(attributes(toggle).type).toBe('button');
    const nav = /<nav[^>]*>/.exec(html)?.[0] ?? '';
    expect(attributes(nav).id).toBe(MENU_ID);
    expect(attributes(nav).popover).toBe('auto');
    expect(attributes(nav)['aria-label']).toBe(t.nav.menu);
    // The button says Menu, or close while the menu is open (the stylesheet shows one of the two); its bars are decoration.
    expect(toggle.length).toBeGreaterThan(0);
    expect(html).toContain(`<span class="menu-label-open">${t.nav.menu}</span>`);
    expect(html).toContain(`<span class="menu-label-close">${t.nav.close}</span>`);
    expect(html).toContain('<span class="menu-bars" aria-hidden="true"></span>');
  });

  it('closes the open menu when a link in it is followed, and stays open for the 3D switch', () => {
    const calls: string[] = [];
    const menu = { hidePopover: () => calls.push('hide'), matches: (selector: string) => selector === ':popover-open' };
    const link = { closest: (selector: string) => (selector === 'a' ? {} : null) };
    const button = { closest: () => null };
    closeMenuOnLink({ currentTarget: menu, target: button } as never);
    expect(calls).toEqual([]);
    closeMenuOnLink({ currentTarget: menu, target: link } as never);
    expect(calls).toEqual(['hide']);
    // A laptop's nav is never an open popover: nothing to close; nor is a target that is not an element.
    closeMenuOnLink({ currentTarget: { ...menu, matches: () => false }, target: link } as never);
    closeMenuOnLink({ currentTarget: menu, target: null } as never);
    expect(calls).toEqual(['hide']);
  });
});
