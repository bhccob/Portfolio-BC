import { useLocation } from 'react-router';
import { localeFromPath } from './locale';
import { Translator, type Locale } from './Translator';

const translators = new Map<Locale, Translator>();

/** The translator for a locale; one per locale, so components can depend on it. */
export function translatorFor(locale: Locale): Translator {
  let translator = translators.get(locale);
  if (!translator) {
    translator = new Translator(locale);
    translators.set(locale, translator);
  }
  return translator;
}

/** The translator for the language of the page being shown, read from its URL. */
export function useTranslator(): Translator {
  return translatorFor(localeFromPath(useLocation().pathname));
}
