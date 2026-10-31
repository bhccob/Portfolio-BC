import { describe, expect, it } from 'vitest';
import { PAGES, pagePaths } from '../../src/data/pages';
import { sitemapIndexXml, sitemapXml } from '../../tools/build/sitemap.mjs';

const ORIGIN = 'https://bhccob.com';

describe('sitemap', () => {
  const xml = sitemapXml();
  const urls = [...xml.matchAll(/<url><loc>([^<]+)<\/loc>(.*?)<\/url>/g)];

  it('lists every page path once', () => {
    expect(urls.map(([, loc]) => loc)).toEqual(pagePaths().map((path) => ORIGIN + path));
  });

  it('lists the seven pages in both languages, and no country page', () => {
    expect(urls).toHaveLength(2 * 7);
    expect(urls.filter(([, loc]) => loc.includes('/about/'))).toEqual([]);
  });

  it('gives every page its Dutch, English and x-default alternates', () => {
    expect(urls).toHaveLength(Object.keys(PAGES).length * 2);
    for (const [, loc, links] of urls) {
      const hrefs = Object.fromEntries([...links.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map(([, lang, href]) => [lang, href]));
      expect(Object.keys(hrefs).sort(), loc).toEqual(['en', 'nl', 'x-default']);
      expect(hrefs['x-default'], loc).toBe(hrefs.nl);
      expect([hrefs.nl, hrefs.en], loc).toContain(loc);
    }
  });

  it('puts English under /en/ and Dutch at the root', () => {
    const contact = urls.find(([, loc]) => loc === `${ORIGIN}/contact/`);
    expect(contact?.[2]).toContain(`hreflang="en" href="${ORIGIN}/en/contact/"`);
    expect(contact?.[2]).toContain(`hreflang="nl" href="${ORIGIN}/contact/"`);
  });

  it('is named by the index', () => {
    expect(sitemapIndexXml()).toContain(`<loc>${ORIGIN}/sitemap-0.xml</loc>`);
  });
});
