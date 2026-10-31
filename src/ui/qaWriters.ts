/**
 * What the scene writes on the page for the Q&A each frame (spec 2026-10-29-bob-stack-2-design.md, goal 1; round 10, spec
 * 2026-10-30-bob-qa-list-floors-design.md: Bob picked "A · One list"): only what has changed, as the names and the
 * captions are written (src/ui/WorldNames.tsx). The words themselves are src/ui/QaRing.tsx's; the stylesheet draws them
 * from what is written here (src/styles/base.css, "the Q&A's ring"):
 * - `<html data-qa>` while the Q&A shows, `data-qa-at="<k>"` while the ring stands at mark `k`, and `data-qa-end` while
 *   it stands at the end's (spec 2026-10-29-bob-stack-3-design.md, goal 4: the dark and the circle);
 * - the frame's `--qa-show` (how much the list, or at the end the end's words, shows, 0..1);
 * - the list's open question: the first as the Q&A comes in, then the one the ring stands at (a question asked in the
 *   list turns the ring to its mark), its button `aria-expanded="true"` and its reply shown, the others closed; none on
 *   the way from one question to another (round 13, Bob picked "C · The light");
 * - the gold light beside the list (round 13): its place down the frame, `--qa-light` (px, at a question's middle at
 *   its mark and between two on the way), and `<html data-qa-moving="down|up">` while it runs;
 * - the end's words shown at the end's mark; the section's `inert` while the Q&A does not show.
 */

export const QA_ATTRIBUTE = 'data-qa';
export const QA_AT_ATTRIBUTE = 'data-qa-at';
export const QA_END_ATTRIBUTE = 'data-qa-end';
export const QA_MOVING_ATTRIBUTE = 'data-qa-moving';

/** The rule over each question in the list, px (src/styles/base.css `.qa-item`'s border-top). */
const ITEM_RULE = 1;

/** The page's parts the writer touches: <html>, the section, the frame, each question (its button and reply), the end. */
export interface QaParts {
  root: { setAttribute(name: string, value: string): void; removeAttribute(name: string): void };
  section: { inert: boolean } | null;
  frame: { style: { setProperty(name: string, value: string): void; removeProperty(name: string): void } } | null;
  items: { ask: { setAttribute(name: string, value: string): void }; reply: { hidden: boolean } }[];
  end: { hidden: boolean } | null;
}

/**
 * The Q&A of a frame: whether it shows, the mark the ring stands at (null between), how much the words show, and whether
 * it is on its way from one question to another (none open then).
 */
export interface QaView {
  on: boolean;
  at: number | null;
  answer: number;
  between?: boolean;
}

/** The light beside the list: its place down the frame, px, and the way it runs (1 down, -1 up, 0 at rest). */
export interface QaLight {
  y: number;
  way: -1 | 0 | 1;
}

/** What has been written, so a frame writes only what differs. */
export interface QaWritten {
  on: boolean;
  at: number | null;
  /** The list's open question, null for none written. */
  open: number | null;
  answer: number;
  /** The light's place written, px (NaN for none), and its way. */
  light: number;
  way: -1 | 0 | 1;
}

/** Nothing written yet: what the scene starts from, and what a clear leaves. */
export function qaWritten(): QaWritten {
  return { on: false, at: null, open: null, answer: Number.NaN, light: Number.NaN, way: 0 };
}

/**
 * Where the light stands at each question, px down the frame: the middle of its button as the list stands with every
 * reply closed (each button under its rule), so the light's way does not jump as a reply closes or opens. `asks` are
 * the buttons, as laid out (`offsetTop` in the frame, `offsetHeight`); none closed but the first's place matters.
 */
export function qaLightAnchors(asks: readonly { offsetTop: number; offsetHeight: number }[]): number[] {
  const anchors: number[] = [];
  asks.forEach((ask, k) => {
    if (k === 0) anchors.push(ask.offsetTop + ask.offsetHeight / 2);
    else anchors.push(anchors[k - 1]! + asks[k - 1]!.offsetHeight / 2 + ITEM_RULE + ask.offsetHeight / 2);
  });
  return anchors;
}

/** The light's place at `place` on the ring, px: at question `k`'s anchor at place `k`, between two on the way; held to the list. */
export function qaLightY(anchors: readonly number[], place: number): number {
  if (anchors.length === 0) return 0;
  const p = Number.isFinite(place) ? Math.min(Math.max(place, 0), anchors.length - 1) : 0;
  const k = Math.min(Math.floor(p), anchors.length - 2);
  if (k < 0) return anchors[0]!;
  return anchors[k]! + (anchors[k + 1]! - anchors[k]!) * (p - k);
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
  // The open question: the one the ring stands at; none on the way from one to another; else the last open, else
  // (coming in) the first.
  const open = !view.on ? written.open : at !== null && at < end ? at : view.between ? null : (written.open ?? 0);
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

/** Writes the light beside the list (`QaLight`), or takes it away (null), only what differs from `written`. */
export function writeQaLight(parts: QaParts, light: QaLight | null, written: QaWritten): void {
  const y = light === null ? Number.NaN : Math.round(light.y * 10) / 10;
  if (!Object.is(y, written.light)) {
    if (Number.isNaN(y)) parts.frame?.style.removeProperty('--qa-light');
    else parts.frame?.style.setProperty('--qa-light', `${y}px`);
    written.light = y;
  }
  const way = light?.way ?? 0;
  if (way !== written.way) {
    if (way === 0) parts.root.removeAttribute(QA_MOVING_ATTRIBUTE);
    else parts.root.setAttribute(QA_MOVING_ATTRIBUTE, way > 0 ? 'down' : 'up');
    written.way = way;
  }
}

/** Clears all the writer wrote: the Q&A gone from the page (the scene let go, or 3D switched off). */
export function clearQa(parts: QaParts, written: QaWritten): void {
  parts.root.removeAttribute(QA_ATTRIBUTE);
  parts.root.removeAttribute(QA_AT_ATTRIBUTE);
  parts.root.removeAttribute(QA_END_ATTRIBUTE);
  parts.root.removeAttribute(QA_MOVING_ATTRIBUTE);
  if (parts.section) parts.section.inert = true;
  openItem(parts, null);
  if (parts.end) parts.end.hidden = true;
  parts.frame?.style.removeProperty('--qa-show');
  parts.frame?.style.removeProperty('--qa-light');
  Object.assign(written, qaWritten());
}
