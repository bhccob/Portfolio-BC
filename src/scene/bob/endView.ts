/**
 * The end page on the screen: the credits (spec 2026-10-27-bob-light-path-design.md, goal 8). As the story moves over
 * the sheet, from the look back's own stop to the credits' stop, the credits rise from below to where they stand at rest
 * from its first scroll, and the dark comes up under them a little behind (Bob, 2026-10-29: one move, no wait on black);
 * at the end the page stands in the normal flow and the document scrolls, which rolls them.
 *
 * Home works out the view of each frame from the frame's one journey pose (`JourneyPose.sheet`) and where the story is
 * (`endViewFor`), and writes it to the DOM (`applyEndView`), only what has changed. The stylesheet draws the move from
 * what it writes (src/styles/base.css, "the credits"):
 * - `--end-black` and `--end-rise` on <html>: how far the black and the rise have come, 0..1, each unset at 0;
 * - `<html data-end>`: `moving` during the move, `rest` once the story rests at the end, unset otherwise;
 * - `#end`'s `inert`: true unless the view is at rest, so Tab never lands in a page that is not shown.
 */
import { sheetBlack } from './worldPath';

/** Where the end page stands: not shown, on its way (in or out), or at rest at the end. */
export type EndState = 'none' | 'moving' | 'rest';

/** A frame's end view: the sheet's share, 0..1, the black's and the rise's shares of it, and the state it stands in. */
export interface EndView {
  share: number;
  black: number;
  rise: number;
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
 * The DOM as `applyEndView` last wrote it, so a frame writes only what changes: the `--end-black` and `--end-rise`
 * written (0 when unset), the `data-end` written (`none` when unset), and the section whose `inert` it last wrote, with
 * that value. The section is kept because the home page renders a new one each time it comes back, and a new one is
 * written afresh.
 */
export interface EndWritten {
  black: number;
  rise: number;
  state: EndState;
  page: EndPageNode | null;
  inert: boolean;
}

/** The custom properties on <html> that carry how far the black and the rise have come. */
export const END_BLACK = '--end-black';
export const END_RISE = '--end-rise';

/** The attribute on <html> that says where the end page stands. */
export const END_ATTRIBUTE = 'data-end';

/**
 * The end view of a frame. `share` is the pose's `sheet` held to 0..1, with NaN read as 0; the rise eased out over the
 * whole of it, 1 - (1 - x)³, and the dark as the path's (`sheetBlack`, src/scene/bob/worldPath.ts), a little behind it:
 * the credits come up from the first scroll into the sheet and settle into place. The scroll lets the move rest at its 99 %
 * (src/input/scrollLoop.ts `END_SETTLED`, Ruling 18), where the page then stands in the flow, so the rise must look
 * arrived there: eased out, what is left of it is a hundredth of a pixel, where a linear rise would leave "Q&A" 9 px
 * short on a laptop and jump. The state is `rest` when the
 * story and its target are both on the end (`end`, `scrollEnd`); else `moving` while any of the sheet is up, on the way
 * in or out; else `none`.
 */
export function endViewFor(sheet: number, progress: number, target: number, end: number): EndView {
  const share = sheet > 0 ? Math.min(sheet, 1) : 0; // NaN fails the test, so it reads as 0
  const state: EndState = progress === end && target === end ? 'rest' : share > 0 ? 'moving' : 'none';
  const black = sheetBlack(share);
  const rise = 1 - (1 - share) ** 3;
  return { share, black, rise, state };
}

/**
 * No end page: what Home writes with the world there, at the end too, where the end of the story is the Q&A's ring
 * (src/scene/bob/qaScene.ts); only a failed void, which has no ring, shows the end page (spec 2026-10-29-bob-stack-2-design.md).
 */
export const NO_END_VIEW: Readonly<EndView> = Object.freeze({ share: 0, black: 0, rise: 0, state: 'none' as const });

/** Nothing written yet: what Home starts from, and what a clear leaves. */
export function endWritten(): EndWritten {
  return { black: 0, rise: 0, state: 'none', page: null, inert: false };
}

/**
 * Writes `view` to <html> (`root`) and the end page's section (`page`, null where the page is not up), only what differs
 * from `written`, which it updates. When the view leaves `rest`, for any reason (the story turned back to the look back, the
 * Home key, the header's name, a step fade), the page is first scrolled back to its top, so the scene never comes back
 * over a page scrolled down, and the page leaves the flow where it stood at the top.
 */
export function applyEndView(view: EndView, root: EndRoot, page: EndPageNode | null, written: EndWritten): void {
  if (written.state === 'rest' && view.state !== 'rest') pageToTop();
  if (view.black !== written.black) {
    if (view.black > 0) root.style.setProperty(END_BLACK, String(view.black));
    else root.style.removeProperty(END_BLACK);
    written.black = view.black;
  }
  if (view.rise !== written.rise) {
    if (view.rise > 0) root.style.setProperty(END_RISE, String(view.rise));
    else root.style.removeProperty(END_RISE);
    written.rise = view.rise;
  }
  if (view.state !== written.state) {
    if (view.state === 'none') root.removeAttribute(END_ATTRIBUTE);
    else root.setAttribute(END_ATTRIBUTE, view.state);
    // Come to rest, the page stands at its top, its title in view: a step fade jumps here from a document a focused nav
    // link may have scrolled, where the sheet's move, fixed and a screen tall, left nothing to scroll. Not with another
    // page up (no section): the document is that page's.
    if (view.state === 'rest' && page !== null) pageToTop();
    written.state = view.state;
  }
  writeInert(page, view.state !== 'rest', written);
}

/**
 * Clears the end view (`why`: Home let go, or gone): no `--end-black` or `--end-rise`, no `data-end`, and the section not inert, so a home
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
  if (written.black !== 0) root.style.removeProperty(END_BLACK);
  if (written.rise !== 0) root.style.removeProperty(END_RISE);
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
