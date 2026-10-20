import type { JSX } from 'react';
import { Link, useLocation } from 'react-router';
import { PAGES } from '~/data/pages';
import { routeFromPath } from '~/i18n/locale';
import { useTranslator } from '~/i18n/useTranslator';
import { LangSwitch } from './LangSwitch';
import { ThreeDToggle } from './ThreeDToggle';

/**
 * The bar every page shows: the way past the header to the content, the name (a link home,
 * except on the home page where the hero says it), the Lite and contact pages, the
 * language switch and the 3D switch. It lives in the root layout, so it never remounts.
 */
export function SiteHeader(): JSX.Element {
  const i18n = useTranslator();
  const { t } = i18n;
  const { pathname } = useLocation();
  const onHome = routeFromPath(pathname) === PAGES.home;

  return (
    <>
      <a className="skip-link" href="#main">
        {t.nav.skip}
      </a>
      <header className="site-header">
        {!onHome && (
          <Link className="site-name" to={i18n.path(PAGES.home)} aria-label={t.nav.home}>
            {t.needle.hero.name}
          </Link>
        )}
        <nav className="header-nav" aria-label={t.nav.menu}>
          <Link className="header-control" to={i18n.path(PAGES.lite)}>
            {t.needle.liteLink}
          </Link>
          <Link className="header-control" to={i18n.path(PAGES.contact)}>
            {t.nav.contact}
          </Link>
          <LangSwitch />
          <ThreeDToggle />
        </nav>
      </header>
    </>
  );
}
