import type { JSX } from 'react';
import { Link } from 'react-router';
import { PAGES } from '~/data/pages';
import { useTranslator } from '~/i18n/useTranslator';

/**
 * The page for a URL that is no page. The not-found route shows it, and so do the country and
 * project routes when their URL names none of their pages (a real page under another spelling).
 */
export function NotFoundPage(): JSX.Element {
  const i18n = useTranslator();
  const { t } = i18n;

  return (
    <article className="page">
      <h1 className="page-title">{t.meta.notFoundTitle}</h1>
      <p className="lead">{t.notFound.text}</p>
      <p>
        <Link className="back" to={i18n.path(PAGES.home)}>
          {t.nav.home}
        </Link>
      </p>
    </article>
  );
}
