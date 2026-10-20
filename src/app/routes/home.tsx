import { Link, type MetaFunction } from 'react-router';
import { COUNTRY_IDS } from '~/data/directions';
import { PAGES, type PageId } from '~/data/pages';
import { projects } from '~/data/projects';
import { localeFromPath } from '~/i18n/locale';
import { translatorFor, useTranslator } from '~/i18n/useTranslator';
import { head } from '~/seo/head';
import { personLd, websiteLd } from '~/seo/structured';
import { HANDLES, type RouteHandle } from '../handle';

export const meta: MetaFunction = ({ location }) => {
  const locale = localeFromPath(location.pathname);
  const { t } = translatorFor(locale);
  return head({
    locale,
    route: PAGES.home,
    title: t.meta.homeTitle,
    description: t.meta.homeDescription,
    jsonLd: [personLd(), websiteLd()],
  });
};

export const handle: RouteHandle = HANDLES.home;

export default function Home() {
  const i18n = useTranslator();
  const { t, locale } = i18n;

  return (
    <>
      <section className="hero">
        <h1 className="hero-name">{t.needle.hero.name}</h1>
        <p className="hero-tagline">{t.needle.hero.tagline}</p>
        <p className="hero-cue">{t.needle.hero.scrollCue}</p>
      </section>

      {/* Visible while 3D is off; while it is on the scene is the way in, and this stays for
          crawlers and keyboards: visually hidden, shown again while a link has focus. */}
      <nav className="home-nav" aria-label={`${t.nav.about} · ${t.nav.work}`}>
        <div>
          <h2 className="label">{t.nav.about}</h2>
          <ul>
            {COUNTRY_IDS.map((id) => {
              const page: PageId = `about-${id}`;
              return (
                <li key={id}>
                  <Link to={i18n.path(PAGES[page])}>{t.needle.countries[id].name}</Link>
                </li>
              );
            })}
          </ul>
        </div>
        <div>
          <h2 className="label">{t.nav.work}</h2>
          <ul>
            {projects.all().map((project) => (
              <li key={project.id}>
                <Link to={i18n.path(projects.route(project))}>
                  <span className="label">{project.category.heading(locale)}</span>
                  {' · '}
                  <span className="nav-title">{project.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </>
  );
}
