import type { MetaDescriptor } from 'react-router';
import { profile } from '../data/profile';
import { Translator, type Locale } from '../i18n/Translator';

/**
 * The tags of the not-found page: a title, a description and noindex. There is no canonical URL
 * or language alternate, because the page answers whatever URL was asked for. The build serves this
 * page (the SPA fallback) as 404.html for every URL that is no page.
 */
export function notFoundMeta(locale: Locale): MetaDescriptor[] {
  const { t } = new Translator(locale);
  return [
    { title: `${t.meta.notFoundTitle} | ${profile.name}` },
    { name: 'description', content: t.meta.notFoundDescription },
    { name: 'robots', content: 'noindex, follow' },
  ];
}
