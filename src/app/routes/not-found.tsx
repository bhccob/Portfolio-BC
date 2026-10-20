import { Link, type MetaFunction } from 'react-router';
import { PAGES } from '~/data/pages';
import { profile } from '~/data/profile';
import { localeFromPath } from '~/i18n/locale';
import { translatorFor, useTranslator } from '~/i18n/useTranslator';
import type { RouteHandle } from '../handle';

// Any path no other route matches. The build serves this route's page (the SPA fallback) as
// 404.html for every unknown URL, so it is never indexed.
export const meta: MetaFunction = ({ location }) => {
  const { t } = translatorFor(localeFromPath(location.pathname));
  return [
    { title: `${t.meta.notFoundTitle} | ${profile.name}` },
    { name: 'description', content: t.meta.notFoundDescription },
    { name: 'robots', content: 'noindex, follow' },
  ];
};

export const handle: RouteHandle = { scene: null };

export default function NotFound() {
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
