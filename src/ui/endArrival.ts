/**
 * Where the focus goes after the nav's link to the end page (`.end-link`, src/app/routes/home.tsx): a keyboard's and a
 * screen reader's way there, with the void ready or failed. The link takes the story to the end page by End's own path
 * (src/input/useHomeScroll.ts `goToEnd`: the damped move from wherever the story is, the step fade with reduced motion or
 * a failed void, the hold while the void loads and then on), and once it rests there the end page's title takes the
 * focus, so a keyboard or a screen reader goes on from the page it came to and not from a link the end page hides. Only
 * for a move the link started: the link calls this, nothing else does.
 */
import { RING_QUESTIONS } from '~/data/qa';
import { END_ATTRIBUTE } from '~/scene/bob/endView';
import { QA_AT_ATTRIBUTE } from './qaWriters';

/**
 * The longest the watch waits, ms: a last resort only. A move from the home through the whole void takes several
 * seconds, and a hold while the void loads longer; the watch ends at the rest, or as soon as the story is no longer
 * headed for the end.
 */
export const END_FOCUS_CAP_MS = 15_000;

/** How often the watch asks whether the story is still headed for the end, ms. */
export const END_FOCUS_CHECK_MS = 100;

/** The end page's heading, "Q&A" (src/ui/EndPage.tsx), which has `tabIndex={-1}` so it can take the focus. */
const TITLE_ID = 'end-title';

/** The ring's end's title, "Stuur een bericht." (src/ui/QaRing.tsx), focusable by script the same way. */
const RING_END_ID = 'qa-end-title';

/** The first question's mark's button on the ring (src/ui/QaRing.tsx). */
const FIRST_MARK_ID = 'qa-mark-0';

/**
 * Focuses the end's title once the story rests at the end (without scrolling): with the world there the ring's end,
 * `#qa-end-title`, once `<html data-qa-at>` names the end's mark (src/ui/qaWriters.ts, which takes the ring's section's
 * `inert` away first); with a failed void the end page's, `#end-title`, once `<html data-end>` says `rest` (Home's end
 * view, src/scene/bob/endView.ts, which takes the section's `inert` away in the same frame, before the observer's
 * callback runs). It watches those two attributes, and stops:
 * - on arrival, focusing the title;
 * - when the story is no longer headed for the end (`heading`, asked every END_FOCUS_CHECK_MS: its target left the end,
 *   a turn back, or 3D went off), so a later rest by other input takes no focus;
 * - when the answer is called (the home page unmounts, or the link is pressed again);
 * - after `capMs`, as a last resort.
 */
export function focusEndOnArrival(doc: Document, heading: () => boolean, capMs = END_FOCUS_CAP_MS): () => void {
  return watchArrival(doc, heading, capMs, [END_ATTRIBUTE, QA_AT_ATTRIBUTE], (root) => {
    if (root.getAttribute(END_ATTRIBUTE) === 'rest') return TITLE_ID;
    if (root.getAttribute(QA_AT_ATTRIBUTE) === String(RING_QUESTIONS)) return RING_END_ID;
    return null;
  });
}

/**
 * The skip button's watch (src/ui/SkipButton.tsx): once the story rests at the first question (`<html data-qa-at="0">`),
 * its mark's button takes the focus, so a keyboard goes on round the ring from there. It stops as `focusEndOnArrival`.
 */
export function focusQuestionsOnArrival(doc: Document, heading: () => boolean, capMs = END_FOCUS_CAP_MS): () => void {
  return watchArrival(doc, heading, capMs, [QA_AT_ATTRIBUTE], (root) => (root.getAttribute(QA_AT_ATTRIBUTE) === '0' ? FIRST_MARK_ID : null));
}

/**
 * Watches `attributes` on <html> until `arrived` names the element to focus (by id), focuses it without scrolling and
 * stops; stops too when the story is no longer `heading` there, when told, and after `capMs`.
 */
function watchArrival(doc: Document, heading: () => boolean, capMs: number, attributes: string[], arrived: (root: Element) => string | null): () => void {
  const view = doc.defaultView;
  if (!view) return () => {};
  const root = doc.documentElement;
  let watching = true;
  const observer = new view.MutationObserver(() => {
    const id = arrived(root);
    if (id === null) return;
    stop();
    doc.getElementById(id)?.focus({ preventScroll: true });
  });
  const check = view.setInterval(() => {
    if (!heading()) stop();
  }, END_FOCUS_CHECK_MS);
  const cap = view.setTimeout(() => stop(), capMs);
  observer.observe(root, { attributes: true, attributeFilter: attributes });

  function stop(): void {
    if (!watching) return;
    watching = false;
    observer.disconnect();
    view?.clearInterval(check);
    view?.clearTimeout(cap);
  }
  return stop;
}
