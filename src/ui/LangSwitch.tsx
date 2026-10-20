import type { JSX } from 'react';
import { Link, useLocation } from 'react-router';
import { routeFromPath } from '~/i18n/locale';
import { Translator } from '~/i18n/Translator';
import { useTranslator } from '~/i18n/useTranslator';

/**
 * A link to the same page in the other language. Its label is the dictionary's
 * `nav.switchTo`, which is written in that other language, so the link carries its `lang`.
 *
 * It replaces the history entry instead of adding one: the same page in another language is not a step
 * in the story, so Back and Escape must not undo it (see `arrivedDirectly` in state/routeSync.ts), and it
 * keeps the visitor's place in the page (`preventScrollReset`). The link keeps its address, which is what
 * crawlers and a visit without script use.
 */
export function LangSwitch(): JSX.Element {
  const { otherLocale, t } = useTranslator();
  const { pathname } = useLocation();

  return (
    <Link
      to={Translator.pathFor(otherLocale, routeFromPath(pathname))}
      replace
      preventScrollReset
      lang={otherLocale}
      hrefLang={otherLocale}
      aria-label={t.nav.switchTo}
      className="header-control"
    >
      {otherLocale.toUpperCase()}
    </Link>
  );
}
