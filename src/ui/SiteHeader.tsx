import type { JSX, MouseEvent } from 'react';
import { Link } from 'react-router';
import { PAGES } from '~/data/pages';
import { useTranslator } from '~/i18n/useTranslator';
import { LangSwitch } from './LangSwitch';
import { ThreeDToggle } from './ThreeDToggle';

/** The id of the header's nav, which on a phone is the menu the Menu button opens (a popover). */
export const MENU_ID = 'site-menu';

/**
 * A click in the open menu that follows a link closes it: a link the router handles changes the page under the
 * menu without reloading, so the popover would stay open over the new page. A click that is not on a link (the 3D
 * switch) leaves it open, and a nav that is not an open popover (a laptop's row) is left alone.
 */
export function closeMenuOnLink(event: MouseEvent<HTMLElement>): void {
  const menu = event.currentTarget;
  const target = event.target as Partial<Pick<Element, 'closest'>> | null;
  if (typeof target?.closest !== 'function' || !target.closest('a')) return;
  if (typeof menu.hidePopover === 'function' && menu.matches(':popover-open')) menu.hidePopover();
}

/**
 * The bar every page shows, the home page included: the way past the header to the content, the name (a link home;
 * the home's hero only says it to a screen reader), Work and About, the contact page, the language switch, the Lite
 * page and the 3D switch. It lives in the root layout, so it never remounts.
 *
 * On a laptop the nav is one row beside the name. On a phone (720 px wide or less) the header is one row, the name and
 * a Menu button, and the nav is a popover the button opens: a dark sheet under the header with Work, About and Contact
 * large, and the language, Lite and the 3D switch small at its foot (Bob picked option A of the phone header mock-up,
 * 2026-10-22). The popover is the browser's own, so it opens and closes without script, Escape and a tap outside
 * close it, and the button tells assistive technology whether it is open.
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
        <button type="button" className="menu-toggle" popoverTarget={MENU_ID}>
          <span className="menu-label-open">{t.nav.menu}</span>
          <span className="menu-label-close">{t.nav.close}</span>
          <span className="menu-bars" aria-hidden="true" />
        </button>
        <nav id={MENU_ID} className="header-nav" aria-label={t.nav.menu} popover="auto" onClick={closeMenuOnLink}>
          <div className="menu-links">
            <Link className="header-control" to={i18n.path(`${PAGES.lite}#work`)}>
              {t.nav.work}
            </Link>
            <Link className="header-control" to={i18n.path(`${PAGES.lite}#about`)}>
              {t.nav.about}
            </Link>
            <Link className="header-control" to={i18n.path(PAGES.contact)}>
              {t.nav.contact}
            </Link>
          </div>
          <div className="menu-extras">
            <LangSwitch />
            <Link className="header-control" to={i18n.path(PAGES.lite)}>
              {t.needle.liteLink}
            </Link>
            <ThreeDToggle />
          </div>
        </nav>
      </header>
    </>
  );
}
