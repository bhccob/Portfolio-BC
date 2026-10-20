import { NavigationType } from 'react-router';
import { describe, expect, it } from 'vitest';
import { focusesMain } from '../../src/app/navigationFocus';

describe('focusesMain: where the focus goes after a client navigation', () => {
  it('moves it to <main> on a page reached by a link, so the keyboard goes on from the new page', () => {
    expect(focusesMain(NavigationType.Push, '')).toBe(true);
    expect(focusesMain(NavigationType.Push, '#')).toBe(true);
  });

  it('leaves it on a link to a place in a page (#career): the place is scrolled to, and the page is not left from its top', () => {
    expect(focusesMain(NavigationType.Push, '#career')).toBe(false);
  });

  it('leaves it on Back, Forward and the first load, which put the visitor back where they were', () => {
    expect(focusesMain(NavigationType.Pop, '')).toBe(false);
    expect(focusesMain(NavigationType.Pop, '#career')).toBe(false);
  });

  it('leaves it on a replace: the language switch and the contact form are the same page', () => {
    expect(focusesMain(NavigationType.Replace, '')).toBe(false);
  });
});
