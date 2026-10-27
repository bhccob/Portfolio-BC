/**
 * Where the focus goes after the nav's link to the end page (`.end-link`, src/app/routes/home.tsx): a keyboard's and a
 * screen reader's way there, with the void ready or failed. The link takes the story to the end page by End's own path
 * (src/input/useHomeScroll.ts `goToEnd`: the damped move from wherever the story is, the step fade with reduced motion or
 * a failed void, the hold while the void loads and then on), and once it rests there the end page's title takes the
 * focus, so a keyboard or a screen reader goes on from the page it came to and not from a link the end page hides. Only
 * for a move the link started: the link calls this, nothing else does.
 */
import { END_ATTRIBUTE } from '~/scene/bob/endView';

/**
 * The longest the watch waits, ms: a last resort only. A move from the home through the whole void takes several
 * seconds, and a hold while the void loads longer; the watch ends at the rest, or as soon as the story is no longer
 * headed for the end.
 */
export const END_FOCUS_CAP_MS = 15_000;

/** How often the watch asks whether the story is still headed for the end, ms. */
export const END_FOCUS_CHECK_MS = 100;

/** The credits' heading, "Q&A" (src/ui/EndPage.tsx), which has `tabIndex={-1}` so it can take the focus. */
const TITLE_ID = 'end-title';

/**
 * Focuses `#end-title` (without scrolling: the page is at its top) once `<html data-end>` says `rest` (Home's end view,
 * src/scene/bob/endView.ts, which takes the section's `inert` away in the same frame, before the observer's callback
 * runs). It watches that one attribute, and stops:
 * - on arrival, focusing the title;
 * - when the story is no longer headed for the end (`heading`, asked every END_FOCUS_CHECK_MS: its target left the end,
 *   a turn back, or 3D went off), so a later rest by other input takes no focus;
 * - when the answer is called (the home page unmounts, or the link is pressed again);
 * - after `capMs`, as a last resort.
 */
export function focusEndOnArrival(doc: Document, heading: () => boolean, capMs = END_FOCUS_CAP_MS): () => void {
  const view = doc.defaultView;
  if (!view) return () => {};
  const root = doc.documentElement;
  let watching = true;
  const observer = new view.MutationObserver(() => {
    if (root.getAttribute(END_ATTRIBUTE) !== 'rest') return;
    stop();
    doc.getElementById(TITLE_ID)?.focus({ preventScroll: true });
  });
  const check = view.setInterval(() => {
    if (!heading()) stop();
  }, END_FOCUS_CHECK_MS);
  const cap = view.setTimeout(() => stop(), capMs);
  observer.observe(root, { attributes: true, attributeFilter: [END_ATTRIBUTE] });

  function stop(): void {
    if (!watching) return;
    watching = false;
    observer.disconnect();
    view?.clearInterval(check);
    view?.clearTimeout(cap);
  }
  return stop;
}
