import { useEffect } from 'react';
import { NavigationType, useLocation, useNavigationType } from 'react-router';
import { insideFromHistory } from '~/scene/bob/inside';

/**
 * Whether a client navigation moves the focus to <main>. A push to a page (a link, the back link going to the home
 * page) does, so a keyboard or a screen reader goes on from the new page's content and not from the link it left (which
 * may be gone with the old page). A push to a place in a page (`#career`) does not: the place is scrolled to. Neither do
 * a pop (Back, Forward, the document's first load), which puts the visitor back where they were, nor a replace (the
 * language switch, the contact form dropping `?sent=1`), which is the same page. Nor does the push that opens a bead's
 * inside on the home (its `state`, src/scene/bob/inside.ts): the inside's own buttons take the focus.
 */
export function focusesMain(type: NavigationType, hash: string, state: unknown = null): boolean {
  return type === NavigationType.Push && hash.replace(/^#/, '') === '' && insideFromHistory(state) === null;
}

/**
 * Moves the focus to <main> after a navigation that `focusesMain`, once per navigation (the location's key), after the
 * new page has rendered. <main> has `tabIndex={-1}` (src/app/Shell.tsx) so it can take the focus, and `preventScroll`
 * leaves the scroll to React Router's <ScrollRestoration> (src/app/root.tsx): the top of the page for a push, the place
 * named by a hash, the saved place for Back and Forward, and no change for a replace marked `preventScrollReset`.
 */
export function useNavigationFocus(): void {
  const { key, hash, state } = useLocation();
  const type = useNavigationType();

  useEffect(() => {
    // The entry's state comes with its key (a new state is a new entry), so the key stands for it here.
    if (focusesMain(type, hash, state)) document.getElementById('main')?.focus({ preventScroll: true });
  }, [key, type, hash]);
}
