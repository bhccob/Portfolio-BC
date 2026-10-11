import { en, type Dictionary } from './en';
import { nl } from './nl';

export const locales = ['en', 'nl'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

const dictionaries: Record<Locale, Dictionary> = { en, nl };
const intlLocales: Record<Locale, string> = { en: 'en-GB', nl: 'nl-NL' };
const ogLocales: Record<Locale, string> = { en: 'en_GB', nl: 'nl_NL' };

/**
 * Resolves copy and URLs for one locale. English lives at the site root,
 * every other locale under its own prefix (`/nl/...`), so each language is a
 * real, crawlable page instead of text swapped in by JavaScript.
 */
export class Translator {
  readonly t: Dictionary;

  constructor(readonly locale: Locale) {
    this.t = dictionaries[locale];
  }

  get intlLocale(): string {
    return intlLocales[this.locale];
  }

  get ogLocale(): string {
    return ogLocales[this.locale];
  }

  get otherLocale(): Locale {
    return this.locale === 'en' ? 'nl' : 'en';
  }

  /** Turns a locale-neutral route such as `/contact/` into this locale's URL. */
  path(route = '/'): string {
    return Translator.pathFor(this.locale, route);
  }

  /** The same route in every locale, used for hreflang and the language switch. */
  alternates(route = '/'): Record<Locale, string> {
    return { en: Translator.pathFor('en', route), nl: Translator.pathFor('nl', route) };
  }

  /** Replaces `{name}` placeholders, e.g. `format('{n} hits', { n: 3 })`. */
  format(template: string, values: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
  }

  static pathFor(locale: Locale, route = '/'): string {
    const normalized = route.startsWith('/') ? route : `/${route}`;
    if (locale === defaultLocale) return normalized;
    return `/${locale}${normalized === '/' ? '/' : normalized}`;
  }
}
