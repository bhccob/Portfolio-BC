import { useEffect } from 'react';
import { NavigationType, useLocation, useNavigationType } from 'react-router';

/**
 * Whether a client navigation moves the focus to <main>. A push to a page (a link, the back link going to the home
 * page) does, so a keyboard or a screen reader goes on from the new page's content and not from the link it left (which
 * may be gone with the old page). A push to a place in a page (`#career`) does not: the place is scrolled to. Neither do
 * a pop (Back, Forward, the document's first load), which puts the visitor back where they were, nor a replace (the
 * language switch, the contact form dropping `?sent=1`), which is the same page.
 */
export function focusesMain(type: NavigationType, hash: string): boolean {
  return type === NavigationType.Push && hash.replace(/^#/, '') === '';
}

/**
 * Moves the focus to <main> after a navigation that `focusesMain`, once per navigation (the location's key), after the
 * new page has rendered. <main> has `tabIndex={-1}` (src/app/Shell.tsx) so it can take the focus, and `preventScroll`
 * leaves the scroll to React Router's <ScrollRestoration> (src/app/root.tsx): the top of the page for a push, the place
 * named by a hash, the saved place for Back and Forward, and no change for a replace marked `preventScrollReset`.
 */
export function useNavigationFocus(): void {
  const { key, hash } = useLocation();
  const type = useNavigationType();

  useEffect(() => {
    if (focusesMain(type, hash)) document.getElementById('main')?.focus({ preventScroll: true });
  }, [key, type, hash]);
}
