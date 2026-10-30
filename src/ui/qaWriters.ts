/**
 * What the scene writes on the page for the Q&A each frame (spec 2026-10-29-bob-stack-2-design.md, goal 1; round 10, spec
 * 2026-10-30-bob-qa-list-floors-design.md: Bob picked "A · One list"): only what has changed, as the names and the
 * captions are written (src/ui/WorldNames.tsx). The words themselves are src/ui/QaRing.tsx's; the stylesheet draws them
 * from what is written here (src/styles/base.css, "the Q&A's ring"):
 * - `<html data-qa>` while the Q&A shows, `data-qa-at="<k>"` while the ring stands at mark `k`, and `data-qa-end` while
 *   it stands at the end's (spec 2026-10-29-bob-stack-3-design.md, goal 4: the dark and the circle);
 * - the frame's `--qa-show` (how much the list, or at the end the end's words, shows, 0..1);
 * - the list's open question: the first as the Q&A comes in, then the one the ring last stood at (a question asked in
 *   the list turns the ring to its mark), its button `aria-expanded="true"` and its reply shown, the others closed;
 * - the end's words shown at the end's mark; the section's `inert` while the Q&A does not show.
 */

export const QA_ATTRIBUTE = 'data-qa';
export const QA_AT_ATTRIBUTE = 'data-qa-at';
export const QA_END_ATTRIBUTE = 'data-qa-end';

/** The page's parts the writer touches: <html>, the section, the frame, each question (its button and reply), the end. */
export interface QaParts {
  root: { setAttribute(name: string, value: string): void; removeAttribute(name: string): void };
  section: { inert: boolean } | null;
  frame: { style: { setProperty(name: string, value: string): void; removeProperty(name: string): void } } | null;
  items: { ask: { setAttribute(name: string, value: string): void }; reply: { hidden: boolean } }[];
  end: { hidden: boolean } | null;
}

/** The Q&A of a frame: whether it shows, the mark the ring stands at (null between), how much the words show. */
export interface QaView {
  on: boolean;
  at: number | null;
  answer: number;
}

/** What has been written, so a frame writes only what differs. */
export interface QaWritten {
  on: boolean;
  at: number | null;
  /** The list's open question, null for none written. */
  open: number | null;
  answer: number;
}

/** Nothing written yet: what the scene starts from, and what a clear leaves. */
export function qaWritten(): QaWritten {
  return { on: false, at: null, open: null, answer: Number.NaN };
}

const share = (x: number): string => String(Math.round(x * 1000) / 1000);

/** Opens question `open` of `parts`' list (none for null), closing the others. */
function openItem(parts: QaParts, open: number | null): void {
  parts.items.forEach((item, k) => {
    item.ask.setAttribute('aria-expanded', k === open ? 'true' : 'false');
    item.reply.hidden = k !== open;
  });
}

/** Writes `view` to the page's `parts`, only what differs from `written`, which it updates. */
export function writeQa(parts: QaParts, view: QaView, written: QaWritten): void {
  if (view.on !== written.on) {
    if (view.on) parts.root.setAttribute(QA_ATTRIBUTE, '');
    else parts.root.removeAttribute(QA_ATTRIBUTE);
    if (parts.section) parts.section.inert = !view.on;
    written.on = view.on;
  }
  const at = view.on ? view.at : null;
  const end = parts.items.length;
  if (at !== written.at) {
    if (at === null) parts.root.removeAttribute(QA_AT_ATTRIBUTE);
    else parts.root.setAttribute(QA_AT_ATTRIBUTE, String(at));
    if (at === end) parts.root.setAttribute(QA_END_ATTRIBUTE, '');
    else parts.root.removeAttribute(QA_END_ATTRIBUTE);
    if (parts.end) parts.end.hidden = at !== end;
    written.at = at;
  }
  // The open question: the one the ring stands at, else the last open, else (coming in) the first.
  const open = !view.on ? written.open : at !== null && at < end ? at : (written.open ?? 0);
  if (view.on && open !== written.open) {
    openItem(parts, open);
    written.open = open;
  }
  const answer = view.on ? Math.min(Math.max(view.answer, 0), 1) : 0;
  if (answer !== written.answer) {
    parts.frame?.style.setProperty('--qa-show', share(answer));
    written.answer = answer;
  }
}

/** Clears all the writer wrote: the Q&A gone from the page (the scene let go, or 3D switched off). */
export function clearQa(parts: QaParts, written: QaWritten): void {
  parts.root.removeAttribute(QA_ATTRIBUTE);
  parts.root.removeAttribute(QA_AT_ATTRIBUTE);
  parts.root.removeAttribute(QA_END_ATTRIBUTE);
  if (parts.section) parts.section.inert = true;
  openItem(parts, null);
  if (parts.end) parts.end.hidden = true;
  parts.frame?.style.removeProperty('--qa-show');
  Object.assign(written, qaWritten());
}
