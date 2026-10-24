import { useEffect, useRef } from 'react';
import { Link, type MetaFunction } from 'react-router';
import { PAGES } from '~/data/pages';
import { projects } from '~/data/projects';
import { localeFromPath } from '~/i18n/locale';
import { translatorFor, useTranslator } from '~/i18n/useTranslator';
import { goToEnd } from '~/input/useHomeScroll';
import { head } from '~/seo/head';
import { personLd, websiteLd } from '~/seo/structured';
import { BeadLabels } from '~/ui/BeadLabel';
import { focusEndOnArrival } from '~/ui/endArrival';
import { EndPage } from '~/ui/EndPage';
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
  // The end page's link: the story to the end page by the step fade, and the focus to its title once it rests there.
  const stopFocus = useRef<(() => void) | null>(null);
  useEffect(() => () => stopFocus.current?.(), []);
  const toEndPage = (): void => {
    stopFocus.current?.();
    stopFocus.current = focusEndOnArrival(document);
    goToEnd();
  };

  return (
    <>
      {/* The name is the engraving now: the h1 stays for crawlers and screen readers, and only the scroll cue shows. */}
      <section className="hero">
        <h1 className="visually-hidden">{t.needle.hero.name}</h1>
        <p className="hero-cue">
          <span className="hero-cue-word">{t.needle.hero.scrollCue}</span>
        </p>
      </section>

      {/* The selected bead's label in the void, one per project: hidden until the scene shows one beside its bead, at
          its stop (src/ui/BeadLabel.tsx). Before the nav, so Tab reaches a shown label first in the page. */}
      <BeadLabels />

      {/* Visible while 3D is off; while it is on the scene is the way in, and this stays for
          crawlers and keyboards: visually hidden, shown again while a link has focus. The way to About is the header's. */}
      <nav className="home-nav" aria-label={t.nav.work}>
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
        {/* The end page's way in when the void failed (shown only then, src/styles/base.css): the scroll holds at BOB from
            above, so this takes the story there by the step fade (goToEnd), and the focus follows (focusEndOnArrival). */}
        <button type="button" className="end-link" onClick={toEndPage}>
          {t.end.failLink}
        </button>
      </nav>

      {/* The end of the scroll: an ordinary page of questions and a message, after the last bead (src/ui/EndPage.tsx).
          In the flow here, so with 3D off the home scrolls on to it, below the project links. */}
      <EndPage />
    </>
  );
}
