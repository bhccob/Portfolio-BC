/**
 * What the scene writes on the page for the Q&A's ring each frame (spec 2026-10-29-bob-stack-2-design.md, goal 1): only
 * what has changed, as the names and the captions are written (src/ui/WorldNames.tsx). The words themselves are
 * src/ui/QaRing.tsx's; the stylesheet draws them from what is written here (src/styles/base.css, "the Q&A's ring"):
 * - `<html data-qa>` while the Q&A shows, and `data-qa-at="<k>"` while the ring stands at mark `k`;
 * - the answers' frame's `--qa-x`, `--qa-y` (its place, CSS px) and `--qa-show` (how much it shows, 0..1);
 * - each answer's `hidden`, all but the one at the mark; the section's `inert` while the Q&A does not show;
 * - each mark's button's `--x`, `--y` and `hidden` (`placeMarks`).
 */

export const QA_ATTRIBUTE = 'data-qa';
export const QA_AT_ATTRIBUTE = 'data-qa-at';

/** The page's parts the writer touches: <html>, the section, the answers' frame and each answer (the end's last). */
export interface QaParts {
  root: { setAttribute(name: string, value: string): void; removeAttribute(name: string): void };
  section: { inert: boolean } | null;
  frame: { style: { setProperty(name: string, value: string): void; removeProperty(name: string): void } } | null;
  answers: { hidden: boolean }[];
}

/** The Q&A of a frame: whether it shows, the mark the ring stands at (null between), how much its answer shows and where. */
export interface QaView {
  on: boolean;
  at: number | null;
  answer: number;
  place: { x: number; y: number } | null;
}

/** What has been written, so a frame writes only what differs. */
export interface QaWritten {
  on: boolean;
  at: number | null;
  answer: number;
  x: number;
  y: number;
}

/** Nothing written yet: what the scene starts from, and what a clear leaves. */
export function qaWritten(): QaWritten {
  return { on: false, at: null, answer: Number.NaN, x: Number.NaN, y: Number.NaN };
}

const share = (x: number): string => String(Math.round(x * 1000) / 1000);

/** Writes `view` to the page's `parts`, only what differs from `written`, which it updates. */
export function writeQa(parts: QaParts, view: QaView, written: QaWritten): void {
  if (view.on !== written.on) {
    if (view.on) parts.root.setAttribute(QA_ATTRIBUTE, '');
    else parts.root.removeAttribute(QA_ATTRIBUTE);
    if (parts.section) parts.section.inert = !view.on;
    written.on = view.on;
  }
  const at = view.on ? view.at : null;
  if (at !== written.at) {
    if (at === null) parts.root.removeAttribute(QA_AT_ATTRIBUTE);
    else parts.root.setAttribute(QA_AT_ATTRIBUTE, String(at));
    parts.answers.forEach((answer, k) => {
      answer.hidden = k !== at;
    });
    written.at = at;
  }
  const answer = at === null ? 0 : Math.min(Math.max(view.answer, 0), 1);
  if (answer !== written.answer) {
    parts.frame?.style.setProperty('--qa-show', share(answer));
    written.answer = answer;
  }
  if (view.place !== null) {
    const x = Math.round(view.place.x);
    const y = Math.round(view.place.y);
    if (x !== written.x || y !== written.y) {
      parts.frame?.style.setProperty('--qa-x', `${x}px`);
      parts.frame?.style.setProperty('--qa-y', `${y}px`);
      written.x = x;
      written.y = y;
    }
  }
}

/** Clears all the writer wrote: the Q&A gone from the page (the scene let go, or 3D switched off). */
export function clearQa(parts: QaParts, written: QaWritten): void {
  parts.root.removeAttribute(QA_ATTRIBUTE);
  parts.root.removeAttribute(QA_AT_ATTRIBUTE);
  if (parts.section) parts.section.inert = true;
  for (const answer of parts.answers) answer.hidden = true;
  if (parts.frame) for (const name of ['--qa-show', '--qa-x', '--qa-y']) parts.frame.style.removeProperty(name);
  Object.assign(written, qaWritten());
}

/**
 * Where the answer stands on a screen of `size` (CSS px) for its mark at `anchor`, its own box `box` (the mock-up's): on a
 * laptop beside the mark, 70 px of air to its right and a third of its height above, held 56 px in from the sides and
 * between 110 px from the top and 70 px from the bottom; on a phone (a screen narrower than 0.8 of its height) under the
 * ring, 20 px in and 96 px up from the bottom.
 */
export function answerPlace(anchor: { x: number; y: number }, box: { w: number; h: number }, size: { width: number; height: number }): { x: number; y: number } {
  if (size.width / Math.max(size.height, 1) < 0.8) return { x: 20, y: size.height - box.h - 96 };
  return {
    x: Math.min(size.width - box.w - 56, Math.max(56, anchor.x + 70)),
    y: Math.min(size.height - box.h - 70, Math.max(110, anchor.y - box.h * 0.35))
  };
}

/**
 * Puts each mark's button where the ring has its mark on the screen (`points`, CSS px, in the marks' order): `--x` and
 * `--y`; a mark on the ring's far half, or off the screen (null), is hidden, so the near half's are the ones named.
 */
export function placeMarks(
  buttons: readonly { hidden: boolean; style: { setProperty(name: string, value: string): void } }[],
  points: readonly ({ x: number; y: number; front: boolean } | null)[]
): void {
  buttons.forEach((button, k) => {
    const point = points[k] ?? null;
    const shown = point !== null && point.front;
    if (button.hidden === shown) button.hidden = !shown;
    if (!shown) return;
    button.style.setProperty('--x', `${Math.round(point.x)}px`);
    button.style.setProperty('--y', `${Math.round(point.y)}px`);
  });
}
