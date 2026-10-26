/**
 * The end page on the screen (spec 2026-10-25-bob-light-dive-design.md, the sheet): as the story moves from Cookies
 * Clicker (6) to the end page (7) the page slides up from below over the ring; at the end the page stands in the normal
 * flow and the document scrolls.
 *
 * Home works out the view of each frame from the frame's one journey pose (`JourneyPose.sheet`) and where the story is
 * (`endViewFor`), and writes it to the DOM (`applyEndView`), only what has changed. The stylesheet draws way A from what
 * it writes (src/styles/base.css, "the end page over the scene: the sheet"):
 * - `--end` on <html>: the sheet's share, 0..1, unset at 0;
 * - `<html data-end>`: `moving` during the move, `rest` once the story rests at the end, unset otherwise;
 * - `#end`'s `inert`: true unless the view is at rest, so Tab never lands in a page that is not shown.
 */

/** Where the end page stands: not shown, on its way (in or out), or at rest at the end. */
export type EndState = 'none' | 'moving' | 'rest';

/** A frame's end view: the sheet's share, 0..1, and the state it stands in. */
export interface EndView {
  share: number;
  state: EndState;
}

/** What the view writes to <html>: its style's `--end` and its `data-end` (the document element). */
export interface EndRoot {
  style: { setProperty(name: string, value: string): void; removeProperty(name: string): string };
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

/**
 * What the view writes to the end page's section (`#end`, src/ui/EndPage.tsx): its `inert`; and, when Home goes at rest,
 * it brings the section into view (`clearEndView`).
 */
export interface EndPageNode {
  inert: boolean;
  scrollIntoView(options: ScrollIntoViewOptions): void;
}

/**
 * Why the end view is cleared: Home lets go while its scene stays (`let-go`: a seek holds the loader's clock), or Home
 * is gone (`gone`: it unmounts, as 3D is switched off or the scene fails).
 */
export type EndClear = 'let-go' | 'gone';

/**
 * The DOM as `applyEndView` last wrote it, so a frame writes only what changes: the `--end` written (0 when unset), the
 * `data-end` written (`none` when unset), and the section whose `inert` it last wrote, with that value. The section is
 * kept because the home page renders a new one each time it comes back, and a new one is written afresh.
 */
export interface EndWritten {
  share: number;
  state: EndState;
  page: EndPageNode | null;
  inert: boolean;
}

/** The custom property on <html> that carries the sheet's share. */
export const END_PROPERTY = '--end';

/** The attribute on <html> that says where the end page stands. */
export const END_ATTRIBUTE = 'data-end';

/**
 * The end view of a frame. `share` is the pose's `sheet` held to 0..1, with NaN read as 0. The state is `rest` when the
 * story and its target are both on the end (`end`, `scrollEnd`); else `moving` while any of the sheet is up, on the way
 * in or out; else `none`.
 */
export function endViewFor(sheet: number, progress: number, target: number, end: number): EndView {
  const share = sheet > 0 ? Math.min(sheet, 1) : 0; // NaN fails the test, so it reads as 0
  const state: EndState = progress === end && target === end ? 'rest' : share > 0 ? 'moving' : 'none';
  return { share, state };
}

/** Nothing written yet: what Home starts from, and what a clear leaves. */
export function endWritten(): EndWritten {
  return { share: 0, state: 'none', page: null, inert: false };
}

/**
 * Writes `view` to <html> (`root`) and the end page's section (`page`, null where the page is not up), only what differs
 * from `written`, which it updates. When the view leaves `rest`, for any reason (the story turned back to Cookies, the
 * Home key, the header's name, a step fade), the page is first scrolled back to its top, so the scene never comes back
 * over a page scrolled down, and the page leaves the flow where it stood at the top.
 */
export function applyEndView(view: EndView, root: EndRoot, page: EndPageNode | null, written: EndWritten): void {
  if (written.state === 'rest' && view.state !== 'rest') pageToTop();
  if (view.share !== written.share) {
    if (view.share > 0) root.style.setProperty(END_PROPERTY, String(view.share));
    else root.style.removeProperty(END_PROPERTY);
    written.share = view.share;
  }
  if (view.state !== written.state) {
    if (view.state === 'none') root.removeAttribute(END_ATTRIBUTE);
    else root.setAttribute(END_ATTRIBUTE, view.state);
    written.state = view.state;
  }
  writeInert(page, view.state !== 'rest', written);
}

/**
 * Clears the end view (`why`: Home let go, or gone): no `--end`, no `data-end`, and the section not inert, so a home
 * without the scene (3D off) finds the page in its flow and usable. Afterwards nothing is noted as written, so the next
 * view is written whole. A clear from `rest` leaves the document:
 * - on a let-go, at its top, the page scrolled there first, as any leaving of the rest does: the scene stays, and the
 *   page leaves the flow where it stood at the top;
 * - when Home is gone (3D switched off at the end page, or the scene failed there), on the end page, brought into view
 *   (its top under the header, at once) once the view is cleared: it now stands in the 3D-off home's flow, after the
 *   hero and the project links, and the document's top is the hero's. With no section in the document (another page is
 *   up over a story left at the end) the document is that page's, and is left where it is.
 */
export function clearEndView(root: EndRoot, page: EndPageNode | null, written: EndWritten, why: EndClear = 'let-go'): void {
  const rested = written.state === 'rest';
  if (rested && why === 'let-go') pageToTop();
  if (written.share !== 0) root.style.removeProperty(END_PROPERTY);
  if (written.state !== 'none') root.removeAttribute(END_ATTRIBUTE);
  if (page !== null && page.inert) page.inert = false;
  Object.assign(written, endWritten());
  if (rested && why === 'gone' && page !== null) page.scrollIntoView({ block: 'start', behavior: 'instant' });
}

/** Writes the section's `inert` when it, or the section, has changed. */
function writeInert(page: EndPageNode | null, inert: boolean, written: EndWritten): void {
  if (page === written.page && inert === written.inert) return;
  if (page !== null) page.inert = inert;
  written.page = page;
  written.inert = inert;
}

/**
 * The document back at its top, if it is not there already: the end view's when the end's rest is left, and the scroll
 * input's when Home goes to the story's start from the end page (src/input/scrollLoop.ts).
 */
export function pageToTop(): void {
  if (typeof window !== 'undefined' && window.scrollY > 0) window.scrollTo(0, 0);
}
