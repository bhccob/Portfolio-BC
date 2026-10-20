import type { MetaFunction } from 'react-router';
import { PAGES } from '~/data/pages';
import { localeFromPath } from '~/i18n/locale';
import { translatorFor, useTranslator } from '~/i18n/useTranslator';
import { head } from '~/seo/head';
import { BackLink } from '~/ui/BackLink';
import type { RouteHandle } from '../handle';

export const meta: MetaFunction = ({ location }) => {
  const locale = localeFromPath(location.pathname);
  const { t } = translatorFor(locale);
  return head({ locale, route: PAGES.lite, title: t.needle.liteLink, description: t.meta.liteDescription });
};

export const handle: RouteHandle = { scene: null };

// A placeholder until Task 4b builds the Lite page with the site's full copy. It already has the
// `#career` section the old /career/*.html addresses redirect to, so those redirects resolve.
export default function Lite() {
  const { t } = useTranslator();

  return (
    <article className="page">
      <BackLink />
      <h1 className="page-title">{t.needle.liteLink}</h1>
      <p className="lead">{t.meta.liteDescription}</p>

      <section id="career" className="case">
        <h2 className="case-title">{t.nav.career}</h2>
        <p>
          {t.career.currentRole} · {t.career.currentOrg}
        </p>
        <p>{t.career.currentText}</p>
      </section>
    </article>
  );
}
