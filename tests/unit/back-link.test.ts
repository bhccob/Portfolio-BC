import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, type NavigateFunction, NavigationType } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { en } from '../../src/i18n/en';
import { localeFromPath } from '../../src/i18n/locale';
import { nl } from '../../src/i18n/nl';
import { Translator } from '../../src/i18n/Translator';
import { translatorFor } from '../../src/i18n/useTranslator';
import { resetRouteSync, syncRoute } from '../../src/state/routeSync';
import { BackLink, goBack, homeTarget, isEditableTarget, isPlainClick, splitBackLabel } from '../../src/ui/BackLink';

/** The back link as the server renders it, on a page at `path`. */
const render = (path: string): string => renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, createElement(BackLink)));

describe('homeTarget', () => {
  it('is the home page of the language', () => {
    expect(homeTarget(new Translator('nl'))).toBe('/');
    expect(homeTarget(new Translator('en'))).toBe('/en/');
  });
});

describe('goBack', () => {
  const calls: unknown[] = [];
  const navigate = ((to: unknown) => void calls.push(to)) as NavigateFunction;

  beforeEach(() => {
    calls.length = 0;
    resetRouteSync();
  });
  afterEach(resetRouteSync);

  it('goes home when the visit began on this page', () => {
    syncRoute({ pathname: '/projects/funcial/', key: 'default' });
    goBack(navigate, '/');
    expect(calls).toEqual(['/']);
  });

  it.each([
    ['/projects/funcial/', '/'],
    ['/en/projects/funcial/', '/en/'],
  ])('goes home in the language of the page at %s, as the link does (%s)', (pathname, home) => {
    syncRoute({ pathname, key: 'default' });
    goBack(navigate, homeTarget(translatorFor(localeFromPath(pathname))));
    expect(calls).toEqual([home]);
  });

  it('goes home in the current language after a language switch on the page the visit began on', () => {
    syncRoute({ pathname: '/projects/funcial/', key: 'default' }, NavigationType.Pop);
    // The switch replaces the entry (LangSwitch): the page in the other language, still the first page of the visit.
    syncRoute({ pathname: '/en/projects/funcial/', key: 'r1' }, NavigationType.Replace);
    goBack(navigate, homeTarget(translatorFor(localeFromPath('/en/projects/funcial/'))));
    expect(calls).toEqual(['/en/']);
  });

  it('goes home after the contact form replaces ?sent=1 on a direct load', () => {
    syncRoute({ pathname: '/contact/', key: 'default' }, NavigationType.Pop);
    syncRoute({ pathname: '/contact/', key: 'r1' }, NavigationType.Replace);
    goBack(navigate, '/');
    expect(calls).toEqual(['/']);
  });

  it('goes back through the history when the visitor came from another page', () => {
    syncRoute({ pathname: '/', key: 'default' });
    syncRoute({ pathname: '/projects/funcial/', key: 'k1' });
    goBack(navigate, '/');
    expect(calls).toEqual([-1]);
  });

  it('goes home again on the page the document loaded on, after a round trip', () => {
    syncRoute({ pathname: '/projects/funcial/', key: 'default' });
    syncRoute({ pathname: '/', key: 'k1' });
    syncRoute({ pathname: '/projects/funcial/', key: 'default' });
    goBack(navigate, '/');
    expect(calls).toEqual(['/']);
  });
});

describe('isPlainClick', () => {
  const click = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };

  it('is true for a left click with no modifier key', () => {
    expect(isPlainClick(click)).toBe(true);
  });

  it('is false for a click that opens the link elsewhere', () => {
    expect(isPlainClick({ ...click, button: 1 })).toBe(false);
    expect(isPlainClick({ ...click, metaKey: true })).toBe(false);
    expect(isPlainClick({ ...click, ctrlKey: true })).toBe(false);
    expect(isPlainClick({ ...click, shiftKey: true })).toBe(false);
    expect(isPlainClick({ ...click, altKey: true })).toBe(false);
  });
});

describe('splitBackLabel', () => {
  it('splits the approved copy into its key hint and its label, without changing the copy', () => {
    expect(nl.needle.project.back).toBe('Esc · terug');
    expect(en.needle.project.back).toBe('Esc · back');
    expect(splitBackLabel(nl.needle.project.back)).toEqual({ hint: 'Esc', label: 'terug' });
    expect(splitBackLabel(en.needle.project.back)).toEqual({ hint: 'Esc', label: 'back' });
  });

  it('takes a string without a separator for a label alone', () => {
    expect(splitBackLabel('back')).toEqual({ hint: null, label: 'back' });
  });
});

describe('isEditableTarget', () => {
  it('is true for a text field, a text area, a select and editable content', () => {
    expect(isEditableTarget({ tagName: 'INPUT' } as unknown as EventTarget)).toBe(true);
    expect(isEditableTarget({ tagName: 'TEXTAREA' } as unknown as EventTarget)).toBe(true);
    expect(isEditableTarget({ tagName: 'SELECT' } as unknown as EventTarget)).toBe(true);
    expect(isEditableTarget({ tagName: 'DIV', isContentEditable: true } as unknown as EventTarget)).toBe(true);
  });

  it('is false for a link, a button, the page and nothing', () => {
    expect(isEditableTarget({ tagName: 'A' } as unknown as EventTarget)).toBe(false);
    expect(isEditableTarget({ tagName: 'BUTTON' } as unknown as EventTarget)).toBe(false);
    expect(isEditableTarget({ tagName: 'BODY', isContentEditable: false } as unknown as EventTarget)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe('BackLink', () => {
  it('links to the Dutch home page, names the shortcut and keeps the hint out of the name', () => {
    const html = render('/projects/funcial/');
    expect(html).toContain('href="/"');
    expect(html).toContain('aria-keyshortcuts="Escape"');
    expect(html).toContain('<span class="back-hint" aria-hidden="true">Esc ·</span>terug');
  });

  it('links to the English home page on an English page', () => {
    const html = render('/en/projects/funcial/');
    expect(html).toContain('href="/en/"');
    expect(html).toContain('<span class="back-hint" aria-hidden="true">Esc ·</span>back');
  });
});
