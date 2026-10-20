import { defaultLocale, locales, type Locale } from './Translator';

/** The locale whose URL prefix (`/en`) starts this path, or null: the default locale has no prefix. */
function prefixed(pathname: string): Locale | null {
  for (const locale of locales) {
    if (locale !== defaultLocale && (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`))) return locale;
  }
  return null;
}

/** The language of a page by its URL path: `/en` and `/en/…` are English, everything else is Dutch. */
export function localeFromPath(pathname: string): Locale {
  return prefixed(pathname) ?? defaultLocale;
}

/**
 * The locale-neutral route of a URL path, the form `PAGES` and `Translator.pathFor`
 * use: `/en/about/china/` and `/about/china/` are both `/about/china/`. It always ends in `/`.
 */
export function routeFromPath(pathname: string): string {
  const locale = prefixed(pathname);
  const route = locale ? pathname.slice(locale.length + 1) || '/' : pathname;
  return route.endsWith('/') ? route : `${route}/`;
}
