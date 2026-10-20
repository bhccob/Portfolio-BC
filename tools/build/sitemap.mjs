// sitemap-index.xml and sitemap-0.xml (the names the old Astro build used, so
// robots.txt keeps pointing at the right file). Every path in pagePaths() is
// listed once, with its hreflang alternates: Dutch, English and x-default (Dutch).
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PAGES, pagePaths } from '../../src/data/pages.ts';
import { defaultLocale, locales, Translator } from '../../src/i18n/Translator.ts';

const ORIGIN = 'https://bhccob.me';
const SITEMAP = 'sitemap-0.xml';

/** @param {string} text */
const escapeXml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The locale-neutral route behind each page path. */
const routeOf = new Map(
  locales.flatMap((locale) => Object.values(PAGES).map((route) => [Translator.pathFor(locale, route), route])),
);

/** @param {string} path */
function entry(path) {
  const route = routeOf.get(path);
  if (route === undefined) throw new Error(`sitemap: ${path} is not a route of PAGES`);
  const alternates = [...locales.map((locale) => [locale, Translator.pathFor(locale, route)]), ['x-default', Translator.pathFor(defaultLocale, route)]];
  const links = alternates
    .map(([hreflang, href]) => `<xhtml:link rel="alternate" hreflang="${hreflang}" href="${escapeXml(ORIGIN + href)}"/>`)
    .join('');
  return `<url><loc>${escapeXml(ORIGIN + path)}</loc>${links}</url>`;
}

/** @returns {string} sitemap-0.xml: one <url> per page path */
export function sitemapXml() {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">' +
    pagePaths().map(entry).join('') +
    '</urlset>\n'
  );
}

/** @returns {string} sitemap-index.xml, naming sitemap-0.xml */
export function sitemapIndexXml() {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    `<sitemap><loc>${ORIGIN}/${SITEMAP}</loc></sitemap>` +
    '</sitemapindex>\n'
  );
}

/**
 * @param {string} dist
 * @returns {Promise<number>} how many pages it lists
 */
export async function writeSitemap(dist) {
  await writeFile(join(dist, SITEMAP), sitemapXml(), 'utf8');
  await writeFile(join(dist, 'sitemap-index.xml'), sitemapIndexXml(), 'utf8');
  return pagePaths().length;
}
