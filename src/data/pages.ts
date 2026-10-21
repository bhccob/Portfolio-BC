import { defaultLocale, locales, Translator } from '../i18n/Translator';

export type PageId =
  | 'home'
  | 'project-funcial'
  | 'project-jontai-energy'
  | 'project-cookies-clicker'
  | 'lite'
  | 'contact';

/**
 * Every page of the site as a locale-neutral route, the form `Translator.pathFor`
 * takes. This list drives the prerender, the sitemap and the redirect checks.
 */
export const PAGES: Record<PageId, string> = {
  home: '/',
  'project-funcial': '/projects/funcial/',
  'project-jontai-energy': '/projects/jontai-energy/',
  'project-cookies-clicker': '/projects/cookies-clicker/',
  lite: '/lite/',
  contact: '/contact/',
};

/** Every page in every locale, Dutch (at the root) first, then English (under /en/). Each path ends in `/`. */
export function pagePaths(): string[] {
  const ordered = [defaultLocale, ...locales.filter((locale) => locale !== defaultLocale)];
  return ordered.flatMap((locale) => Object.values(PAGES).map((route) => Translator.pathFor(locale, route)));
}
