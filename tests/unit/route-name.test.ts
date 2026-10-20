import { describe, expect, it } from 'vitest';
import { routeName } from '../../src/app/routeName';
import { PAGES, type PageId } from '../../src/data/pages';
import { locales } from '../../src/i18n/Translator';

describe('routeName', () => {
  it('names the page of a route id, in either language', () => {
    expect(routeName('home-nl')).toBe('home');
    expect(routeName('home-en')).toBe('home');
    expect(routeName('about-china-nl')).toBe('country');
    expect(routeName('about-netherlands-en')).toBe('country');
    expect(routeName('about-aruba-nl')).toBe('country');
    expect(routeName('project-funcial-en')).toBe('project');
    expect(routeName('project-jontai-energy-nl')).toBe('project');
    expect(routeName('project-cookies-clicker-en')).toBe('project');
    expect(routeName('lite-nl')).toBe('lite');
    expect(routeName('contact-en')).toBe('contact');
  });

  it('gives not-found for the catch-all route, for nothing and for an id it does not know', () => {
    expect(routeName('not-found')).toBe('not-found');
    expect(routeName(undefined)).toBe('not-found');
    expect(routeName('root')).toBe('not-found');
    expect(routeName('home')).toBe('not-found');
    expect(routeName('home-fr')).toBe('not-found');
  });

  it('knows every page the router is given: the ids are `${page}-${locale}`, as src/app/routes.ts builds them', () => {
    for (const locale of locales) {
      for (const page of Object.keys(PAGES) as PageId[]) {
        expect(routeName(`${page}-${locale}`), `${page}-${locale}`).not.toBe('not-found');
      }
    }
  });
});
