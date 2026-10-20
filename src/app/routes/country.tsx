import { Link, type MetaFunction, useLocation } from 'react-router';
import { COUNTRY_IDS, type CountryId } from '~/data/directions';
import { PAGES, type PageId } from '~/data/pages';
import { profile } from '~/data/profile';
import { localeFromPath, routeFromPath } from '~/i18n/locale';
import { translatorFor, useTranslator } from '~/i18n/useTranslator';
import { head } from '~/seo/head';
import { breadcrumbLd } from '~/seo/structured';
import type { RouteHandle } from '../handle';

const pageOf = (id: CountryId): PageId => `about-${id}`;

/** The country a URL path is the page of. The three countries share this module, so the path says which. */
function countryOf(pathname: string): CountryId {
  const route = routeFromPath(pathname);
  const id = COUNTRY_IDS.find((candidate) => PAGES[pageOf(candidate)] === route);
  if (!id) throw new Error(`${pathname} is not a country page`);
  return id;
}

export const meta: MetaFunction = ({ location }) => {
  const locale = localeFromPath(location.pathname);
  const { t } = translatorFor(locale);
  const id = countryOf(location.pathname);
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
  const i18n = useTranslator();
  const { t } = i18n;
  const country = t.needle.countries[countryOf(useLocation().pathname)];

  return (
    <article className="page">
      <Link className="back" to={i18n.path(PAGES.home)}>
        {t.needle.project.back}
      </Link>
      <h1 className="page-title">{country.name}</h1>
      <div className="beats">
        {country.beats.map((beat) => (
          <p key={beat}>{beat}</p>
        ))}
      </div>
    </article>
  );
}
