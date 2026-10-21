import type { JSX } from 'react';
import { Link } from 'react-router';
import { PAGES } from '~/data/pages';
import { useTranslator } from '~/i18n/useTranslator';
import { LangSwitch } from './LangSwitch';
import { ThreeDToggle } from './ThreeDToggle';

/**
 * The bar every page shows, the home page included: the way past the header to the content, the name (a link home;
 * the home's hero only says it to a screen reader), Work and About, the contact page, the language switch, the Lite
 * page and the 3D switch. It lives in the root layout, so it never remounts.
 *
 * Work and About both open Lite, at its work and about sections, until the projects void is built (milestone 2).
 */
export function SiteHeader(): JSX.Element {
  const i18n = useTranslator();
  const { t } = i18n;

  return (
    <>
      <a className="skip-link" href="#main">
        {t.nav.skip}
      </a>
      <header className="site-header">
        <Link className="site-name" to={i18n.path(PAGES.home)} aria-label={t.nav.home}>
          {t.needle.hero.name}
        </Link>
        <nav className="header-nav" aria-label={t.nav.menu}>
          <Link className="header-control" to={i18n.path(`${PAGES.lite}#work`)}>
            {t.nav.work}
          </Link>
          <Link className="header-control" to={i18n.path(`${PAGES.lite}#about`)}>
            {t.nav.about}
          </Link>
          <Link className="header-control" to={i18n.path(PAGES.contact)}>
            {t.nav.contact}
          </Link>
          <LangSwitch />
          <Link className="header-control" to={i18n.path(PAGES.lite)}>
            {t.needle.liteLink}
          </Link>
          <ThreeDToggle />
        </nav>
      </header>
    </>
  );
}
