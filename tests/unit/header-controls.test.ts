import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { en } from '../../src/i18n/en';
import { nl } from '../../src/i18n/nl';
import { useScene } from '../../src/state/store';
import { LangSwitch } from '../../src/ui/LangSwitch';
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
