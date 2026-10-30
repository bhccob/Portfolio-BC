import type { JSX, MouseEvent } from 'react';
import { Link, useLocation } from 'react-router';
import { PAGES } from '~/data/pages';
import { routeFromPath } from '~/i18n/locale';
import { useTranslator } from '~/i18n/useTranslator';
import { goToTop } from '~/input/useHomeScroll';
import { isPlainClick } from './BackLink';
import { LangSwitch } from './LangSwitch';

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

/** What `nameToTop` reads of a click and does to it. */
type NameClick = Pick<MouseEvent, 'button' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'defaultPrevented' | 'preventDefault'>;

/**
 * The header's name clicked on the home page, at `pathname` (the home of the page's language, which is where the name
 * links): the story goes to its start by the Home key's own path (`toTop`, `goToTop` of src/input/useHomeScroll.ts: the
 * page to its top, then the move, or the step fade where the void failed), and the link does not navigate. Only a plain
 * left click that nothing has handled, and only when the home's scroll takes it; a click with a modifier or another
 * button, a click on any other page, and one the scroll does not take (3D off, a bead opening) are the link's, as ever.
 */
export function nameToTop(event: NameClick, pathname: string, toTop: () => boolean = goToTop): void {
  if (routeFromPath(pathname) !== PAGES.home || event.defaultPrevented || !isPlainClick(event)) return;
  if (toTop()) event.preventDefault();
}

/**
 * The bar every page shows, the home page included: the way past the header to the content, the name (a link home;
 * the home's hero only says it to a screen reader; on the home itself it takes the story to its start, `nameToTop`), Work
 * and About, the contact page, the language switch, the Lite page and the 3D switch. It lives in the root layout, so it
 * never remounts.
 *
 * On a laptop the nav is one row beside the name. On a phone (720 px wide or less) the header is one row, the name and
 * a Menu button, and the nav is a popover the button opens: a dark sheet under the header with Work, About and Contact
 * large, and the language, Lite and the 3D switch small at its foot (Bob picked option A of the phone header mock-up,
 * 2026-10-22). The popover is the browser's own, so it opens and closes without script, Escape and a tap outside
 * close it, and the button tells assistive technology whether it is open.
 *
 * Work and About both open Lite, at its work and about sections. Work opens Lite for now; where it goes now that the
 * home's void holds the projects is Bob's choice.
 */
export function SiteHeader(): JSX.Element {
  const i18n = useTranslator();
  const { t } = i18n;
  const { pathname } = useLocation();

  return (
    <>
      <a className="skip-link" href="#main">
        {t.nav.skip}
      </a>
      <header className="site-header">
        <Link className="site-name" to={i18n.path(PAGES.home)} aria-label={t.nav.home} onClick={(event) => nameToTop(event, pathname)}>
          {t.needle.hero.name}
        </Link>
        <button type="button" className="menu-toggle" popoverTarget={MENU_ID}>
          <span className="menu-label-open">{t.nav.menu}</span>
          <span className="menu-label-close">{t.nav.close}</span>
          <span className="menu-bars" aria-hidden="true" />
        </button>
        <nav id={MENU_ID} className="header-nav" aria-label={t.nav.menu} popover="auto" onClick={closeMenuOnLink}>
          {/* Bob (2026-10-30): "remove the Over mij and Werk in the header": Contact alone, and the language. */}
          <div className="menu-links">
            <Link className="header-control" to={i18n.path(PAGES.contact)}>
              {t.nav.contact}
            </Link>
          </div>
          <div className="menu-extras">
            <LangSwitch />
          </div>
        </nav>
      </header>
    </>
  );
}
