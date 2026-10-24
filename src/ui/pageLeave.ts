import { type RefObject, useLayoutEffect } from 'react';
import { PAGES } from '~/data/pages';
import { routeFromPath } from '~/i18n/locale';

/**
 * How long a project page left for the home page takes to fade out, with its scrim, ms: the stylesheet's `.page-ghost`
 * (src/styles/base.css; 0.4 s on the reveal curve, as the hero's cue fades), so the page is gone well within the 0.8 s
 * flight out of the porthole (src/scene/bob/focus.ts `FLIGHT_MS`).
 */
export const PAGE_OUT_MS = 400;

/** A moment more than the fade, ms, after which the copy goes even if no `animationend` came (a page in the background). */
const PAGE_OUT_SLACK_MS = 100;

/** True when a page now at `pathname` is the home page, in either language: the one leave that fades the page out. */
export function leavesForHome(pathname: string): boolean {
  return routeFromPath(pathname) === PAGES.home;
}

/**
 * Fades out a project page that is being left for the home page, rather than cut away while the camera flies out: the
 * router takes the page's article away at once, so a still copy of it (`cloneNode`) stands where it stood, fixed over
 * the scene in `.page-ghost`, inert and hidden from assistive technology, while it fades out over PAGE_OUT_MS. The copy keeps `body:has(.page)` true, so the
 * page's scrim stays over the scene and fades out with it (`body:has(.page-ghost) .scene-host::after`). It is taken away
 * once its fade has run, or a moment after PAGE_OUT_MS at the latest. With reduced motion the stylesheet's rule cuts the
 * fade to nothing, and the scene's own fade (`<html data-focus-fade>`) is the step. A page no longer in the document
 * leaves nothing.
 */
export function fadeOutPage(page: HTMLElement): void {
  if (!page.isConnected) return;
  const doc = page.ownerDocument;
  const box = page.getBoundingClientRect();
  const ghost = doc.createElement('div');
  ghost.className = 'page-ghost';
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  ghost.style.top = `${box.top}px`;
  ghost.style.left = `${box.left}px`;
  ghost.style.width = `${box.width}px`;
  ghost.append(page.cloneNode(true));
  doc.body.append(ghost);
  const done = (): void => ghost.remove();
  ghost.addEventListener('animationend', done, { once: true });
  doc.defaultView?.setTimeout(done, PAGE_OUT_MS + PAGE_OUT_SLACK_MS);
}

/**
 * Takes away every copy of a page still fading in `doc`: a project page that comes back while one fades (Back, then
 * Forward at once) stands alone, with nothing of the page it replaces over it.
 */
export function dropGhosts(doc: Pick<Document, 'querySelectorAll'>): void {
  for (const ghost of doc.querySelectorAll('.page-ghost')) ghost.remove();
}

/**
 * `usePageFadeOut`'s effect for the project page `page` as it comes in: it takes away every copy of a page still fading
 * (`dropGhosts`), and answers what it does as the page goes, which is to fade it out (`fadeOutPage`) when the visit
 * goes to the home page (`where`, the new address, read as the page goes) and nothing else. Without a page, nothing.
 */
export function pageFadeEffect(page: HTMLElement | null, where: () => string): () => void {
  if (page) dropGhosts(page.ownerDocument);
  return () => {
    if (page && leavesForHome(where())) fadeOutPage(page);
  };
}

/**
 * Lets the project page in `ref` fade out when it is left for the home page (Back, its Escape, the header's name),
 * not for anything else (the language switch, Lite, contact), by `pageFadeEffect`. React takes a page's layout effects
 * down before it takes its elements out of the document, so the article is still there, where it stood, when this
 * runs; and the router has already put the new address in the history, so `location` says where the visit goes. A
 * project page that comes in while an earlier one's copy still fades takes that copy away.
 */
export function usePageFadeOut(ref: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => pageFadeEffect(ref.current, () => window.location.pathname), [ref]);
}
