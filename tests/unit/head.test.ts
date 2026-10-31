import { describe, expect, it } from 'vitest';
import { head, type HeadInput } from '../../src/seo/head';
import { en } from '../../src/i18n/en';
import { nl } from '../../src/i18n/nl';

type Descriptor = Record<string, unknown>;

const steady: HeadInput = {
  locale: 'en',
  route: '/projects/steady/',
  title: 'Steady · Project',
  description: 'A page description, as the head gives it to search and to social cards.',
};

const find = (list: readonly object[], key: string, value: string): Descriptor | undefined =>
  (list as Descriptor[]).find((entry) => entry[key] === value);
const content = (list: readonly object[], key: string, value: string) => find(list, key, value)?.content;
const link = (list: readonly object[], rel: string) => (list as Descriptor[]).find((entry) => entry.tagName === 'link' && entry.rel === rel);
const alternate = (list: readonly object[], hreflang: string) =>
  (list as Descriptor[]).find((entry) => entry.tagName === 'link' && entry.rel === 'alternate' && entry.hrefLang === hreflang)?.href;

describe('head', () => {
  const tags = head(steady);

  it('puts "| Bob Chung" after the page title', () => {
    expect(find(tags, 'title', 'Steady · Project | Bob Chung')).toBeDefined();
    expect((tags as Descriptor[]).filter((entry) => 'title' in entry)).toHaveLength(1);
    expect(((tags[0] as Descriptor).title as string).endsWith('| Bob Chung')).toBe(true);
  });

  it('gives the home page the dictionary title as it is, without the suffix', () => {
    for (const [locale, dictionary] of [['en', en], ['nl', nl]] as const) {
      const home = head({ locale, route: '/', title: dictionary.meta.homeTitle, description: dictionary.meta.homeDescription });
      expect((home[0] as Descriptor).title).toBe(dictionary.meta.homeTitle);
      expect(content(home, 'property', 'og:title')).toBe(dictionary.meta.homeTitle);
    }
  });

  it('describes the page', () => {
    expect(content(tags, 'name', 'description')).toBe(steady.description);
    expect(content(tags, 'property', 'og:description')).toBe(steady.description);
  });

  it('names the English page as canonical, on bhccob.com', () => {
    expect(link(tags, 'canonical')?.href).toBe('https://bhccob.com/en/projects/steady/');
    expect(content(tags, 'property', 'og:url')).toBe('https://bhccob.com/en/projects/steady/');
  });

  it('names the Dutch page as canonical for a Dutch page', () => {
    expect(link(head({ ...steady, locale: 'nl' }), 'canonical')?.href).toBe('https://bhccob.com/projects/steady/');
  });

  it('links the same page in both languages, and x-default is the Dutch one', () => {
    expect(alternate(tags, 'nl')).toBe('https://bhccob.com/projects/steady/');
    expect(alternate(tags, 'en')).toBe('https://bhccob.com/en/projects/steady/');
    expect(alternate(tags, 'x-default')).toBe(alternate(tags, 'nl'));
    expect(alternate(head({ ...steady, locale: 'nl' }), 'x-default')).toBe('https://bhccob.com/projects/steady/');
  });

  it('links the English home page at /en/ and the Dutch one at the root', () => {
    const home = head({ locale: 'en', route: '/', title: en.meta.homeTitle, description: en.meta.homeDescription });
    expect(alternate(home, 'nl')).toBe('https://bhccob.com/');
    expect(alternate(home, 'en')).toBe('https://bhccob.com/en/');
  });

  it('describes the page for social cards, with the share image on bhccob.com', () => {
    expect(content(tags, 'property', 'og:image')).toBe('https://bhccob.com/og.jpg');
    expect(content(tags, 'property', 'og:type')).toBe('website');
    expect(content(tags, 'property', 'og:locale')).toBe('en_GB');
    expect(content(head({ ...steady, locale: 'nl' }), 'property', 'og:locale')).toBe('nl_NL');
    expect(content(tags, 'name', 'twitter:card')).toBe('summary_large_image');
  });

  it('accepts another share image, as a path or as a full URL', () => {
    expect(content(head({ ...steady, image: '/x.jpg' }), 'property', 'og:image')).toBe('https://bhccob.com/x.jpg');
    expect(content(head({ ...steady, image: 'https://example.org/y.jpg' }), 'property', 'og:image')).toBe('https://example.org/y.jpg');
  });

  it('is indexable unless asked otherwise', () => {
    expect(find(tags, 'name', 'robots')).toBeUndefined();
  });

  it('adds "noindex, follow" for a noindex page', () => {
    expect(content(head({ ...steady, noindex: true }), 'name', 'robots')).toBe('noindex, follow');
  });

  it('writes one JSON-LD script for each item', () => {
    const person = { '@context': 'https://schema.org', '@type': 'Person' };
    const crumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList' };
    const scripts = (head({ ...steady, jsonLd: [person, crumbs] }) as Descriptor[]).filter((entry) => 'script:ld+json' in entry);
    expect(scripts).toEqual([{ 'script:ld+json': person }, { 'script:ld+json': crumbs }]);
    expect((tags as Descriptor[]).filter((entry) => 'script:ld+json' in entry)).toHaveLength(0);
  });
});
