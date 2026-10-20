import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { en } from '../../src/i18n/en';
import { nl } from '../../src/i18n/nl';
import { Translator } from '../../src/i18n/Translator';
import { BackLink, backTarget, isEditableTarget, splitBackLabel } from '../../src/ui/BackLink';

/** The back link as the server renders it, on a page at `path`. */
const render = (path: string): string => renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, createElement(BackLink)));

describe('backTarget', () => {
  it('is the home page of the language', () => {
    expect(backTarget(new Translator('nl'))).toBe('/');
    expect(backTarget(new Translator('en'))).toBe('/en/');
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
    const html = render('/about/china/');
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
