import { type MetaFunction, useLocation } from 'react-router';
import { countryFromRoute, type CountryId } from '~/data/directions';
import { PAGES, type PageId } from '~/data/pages';
import { profile } from '~/data/profile';
import { localeFromPath, routeFromPath } from '~/i18n/locale';
import { translatorFor, useTranslator } from '~/i18n/useTranslator';
import { head } from '~/seo/head';
import { notFoundMeta } from '~/seo/notFound';
import { breadcrumbLd } from '~/seo/structured';
import { BackLink } from '~/ui/BackLink';
import { NotFoundPage } from '~/ui/NotFoundPage';
import type { RouteHandle } from '../handle';

const pageOf = (id: CountryId): PageId => `about-${id}`;

export const meta: MetaFunction = ({ location }) => {
  const locale = localeFromPath(location.pathname);
  const { t } = translatorFor(locale);
  // The three countries share this module, so the path says which. A path that names none of them
  // (a real page under another spelling) gets the not-found page, never an error.
  const id = countryFromRoute(routeFromPath(location.pathname));
  if (!id) return notFoundMeta(locale);
  const country = t.needle.countries[id];
  const route = PAGES[pageOf(id)];
  return head({
    locale,
    route,
    // "China · About": the same country page in both languages needs a title of its own in each.
    title: `${country.name} · ${t.nav.about}`,
    description: country.metaDescription,
    jsonLd: [
      breadcrumbLd(locale, [
        { name: profile.name, route: PAGES.home },
        { name: country.name, route },
      ]),
    ],
  });
};

export const handle: RouteHandle = { scene: 'country' };

export default function Country() {
  const { t } = useTranslator();
  const id = countryFromRoute(routeFromPath(useLocation().pathname));
  if (!id) return <NotFoundPage />;
  const country = t.needle.countries[id];

  return (
    <article className="page">
      <BackLink />
      <h1 className="page-title">{country.name}</h1>
      <div className="beats">
        {country.beats.map((beat) => (
          <p key={beat}>{beat}</p>
        ))}
      </div>
    </article>
  );
}
