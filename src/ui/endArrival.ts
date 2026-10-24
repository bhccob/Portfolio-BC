/**
 * Where the focus goes after the failed void's link to the end page (`.end-link`, src/app/routes/home.tsx). The link
 * takes the story to the end page by the step fade (src/input/useHomeScroll.ts `goToEnd`), and once it rests there the
 * end page's title takes the focus, so a keyboard or a screen reader goes on from the page it came to and not from a
 * link the end page hides. Only for a move the link started: the link calls this, nothing else does.
 */
import { END_ATTRIBUTE } from '~/scene/bob/endView';

/** How long the link's move is waited for, ms: it rests in about 200 ms; one that turned back, or 3D off, never does. */
export const END_FOCUS_WAIT_MS = 3_000;

/** The end page's title (src/ui/EndPage.tsx), which has `tabIndex={-1}` so it can take the focus. */
const TITLE_ID = 'end-title';

/**
 * Focuses `#end-title` (without scrolling: the page is at its top) once `<html data-end>` says `rest` (Home's end view,
 * src/scene/bob/endView.ts, which takes the section's `inert` away in the same frame, before the observer's callback
 * runs). It watches that one attribute, and stops on arrival, after `waitMs`, or when the answer is called (the home page
 * unmounts, or the link is pressed again).
 */
export function focusEndOnArrival(doc: Document, waitMs = END_FOCUS_WAIT_MS): () => void {
  const view = doc.defaultView;
  if (!view) return () => {};
  const root = doc.documentElement;
  let watching = true;
  const observer = new view.MutationObserver(() => {
    if (root.getAttribute(END_ATTRIBUTE) !== 'rest') return;
    stop();
    doc.getElementById(TITLE_ID)?.focus({ preventScroll: true });
  });
  const timer = view.setTimeout(() => stop(), waitMs);
  observer.observe(root, { attributes: true, attributeFilter: [END_ATTRIBUTE] });

  function stop(): void {
    if (!watching) return;
    watching = false;
    observer.disconnect();
    view?.clearTimeout(timer);
  }
  return stop;
}
