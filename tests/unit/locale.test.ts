import { describe, expect, it } from 'vitest';
import { localeFromPath, routeFromPath } from '../../src/i18n/locale';

describe('localeFromPath', () => {
  it('reads Dutch at the root', () => {
    expect(localeFromPath('/')).toBe('nl');
    expect(localeFromPath('/about/china/')).toBe('nl');
    expect(localeFromPath('/projects/funcial/')).toBe('nl');
  });

  it('reads English under /en', () => {
    expect(localeFromPath('/en/')).toBe('en');
    expect(localeFromPath('/en')).toBe('en');
    expect(localeFromPath('/en/about/china/')).toBe('en');
  });

  it('does not take a longer first segment for English', () => {
    expect(localeFromPath('/english/')).toBe('nl');
    expect(localeFromPath('/enigma/')).toBe('nl');
  });
});

describe('routeFromPath', () => {
  it('drops the /en prefix, so both languages share one route', () => {
    expect(routeFromPath('/en/about/china/')).toBe('/about/china/');
    expect(routeFromPath('/about/china/')).toBe('/about/china/');
    expect(routeFromPath('/en/')).toBe('/');
    expect(routeFromPath('/en')).toBe('/');
    expect(routeFromPath('/')).toBe('/');
  });

  it('keeps a first segment that only starts with "en"', () => {
    expect(routeFromPath('/english/')).toBe('/english/');
  });

  it('ends the route in a slash', () => {
    expect(routeFromPath('/about/china')).toBe('/about/china/');
    expect(routeFromPath('/en/about/china')).toBe('/about/china/');
  });
});
