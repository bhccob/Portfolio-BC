import type { MetaDescriptor } from 'react-router';
import { profile } from '../data/profile';
import { defaultLocale, locales, Translator, type Locale } from '../i18n/Translator';

/** The share image of every page (tools/build/og.mjs writes it). */
const OG_IMAGE = '/og.jpg';

export interface HeadInput {
  locale: Locale;
  /** The locale-neutral route of the page, e.g. `/projects/funcial/` (see `PAGES`). */
  route: string;
  /** The page's own title; " | Bob Chung" follows it. The home page ('/') gives its complete title, which is used as it is. */
  title: string;
  description: string;
  /** The share image, a path on the site or a full URL; defaults to `/og.jpg`. */
  image?: string;
  noindex?: boolean;
  /** Structured data, one `<script type="application/ld+json">` for each item. */
  jsonLd?: Record<string, unknown>[];
}

const absolute = (path: string): string => (/^https?:\/\//.test(path) ? path : `${profile.site}${path}`);

/**
 * The tags a page puts in its head: title, description, the canonical URL, the
 * language alternates, Open Graph and Twitter card tags, and any JSON-LD.
 * A route module's `meta` returns this.
 */
export function head({ locale, route, title, description, image = OG_IMAGE, noindex = false, jsonLd = [] }: HeadInput): MetaDescriptor[] {
  const translator = new Translator(locale);
  const fullTitle = route === '/' ? title : `${title} | ${profile.name}`;
  const url = absolute(translator.path(route));
  const alternates = translator.alternates(route);
  const shareImage = absolute(image);

  return [
    { title: fullTitle },
    { name: 'description', content: description },
    ...(noindex ? [{ name: 'robots', content: 'noindex, follow' }] : []),
    { tagName: 'link', rel: 'canonical', href: url },
    ...locales.map((hrefLang) => ({ tagName: 'link', rel: 'alternate', hrefLang, href: absolute(alternates[hrefLang]) })),
    { tagName: 'link', rel: 'alternate', hrefLang: 'x-default', href: absolute(alternates[defaultLocale]) },
    { property: 'og:title', content: fullTitle },
    { property: 'og:description', content: description },
    { property: 'og:url', content: url },
    { property: 'og:image', content: shareImage },
    { property: 'og:locale', content: translator.ogLocale },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:image', content: shareImage },
    ...jsonLd.map((item) => ({ 'script:ld+json': item })),
  ];
}
