/**
 * The Q&A's writer (round 15, spec 2026-11-01-bob-dissolve-digitize-design.md; Bob: "i want the Q&A also the be just
 * very simple and blend in to scroll"): the page's words written from the way out's stage at the scroll's place
 * (src/scene/bob/qaScene.ts), only what has changed. `<html data-qa>` while the Q&A shows, `data-qa-at` the question on
 * the reading line (the end's mark once its words are on) and `data-qa-end` at the end; on the section `--qa-column` and
 * `--qa-band` (how much the column and the dark band behind it show) and `inert` while the Q&A does not; the column's
 * track moved so the question at the place stands on the reading line; the end `hidden` but at the end. Pure but for the
 * parts it is given.
 */

export const QA_ATTRIBUTE = 'data-qa';
export const QA_AT_ATTRIBUTE = 'data-qa-at';
export const QA_END_ATTRIBUTE = 'data-qa-end';

/** Within this of its place a question stands on the reading line (`qaNearest`). */
const NEAR = 0.18;
/** The track's move is written again only past this, px. */
const OFFSET_STEP = 0.05;

/** The page's parts the writer touches: <html>, the section (its `inert` and its vars), the column's track, the end. */
export interface QaParts {
  root: { setAttribute(name: string, value: string): void; removeAttribute(name: string): void };
  section: { inert: boolean; style: { setProperty(name: string, value: string): void; removeProperty(name: string): void } } | null;
  track: { style: { transform: string } } | null;
  end: { hidden: boolean } | null;
}

/** What the page shows at one place. */
export interface QaView {
  /** The Q&A shows: past its door. */
  on: boolean;
  /** How much the column and the band behind it show, 0..1. */
  column: number;
  band: number;
  /** The track's move, px: the question at the place on the reading line (`qaOffset`). */
  offset: number;
  /** The question on the reading line, the end's mark at the end, or none. */
  at: number | null;
  /** The end's words on. */
  endOn: boolean;
}

/** What has been written, so a frame writes only what differs. */
export interface QaWritten {
  on: boolean;
  column: string;
  band: string;
  offset: number;
  at: number | null;
  endOn: boolean;
}

/** Nothing written yet: what the scene starts from, and what a clear leaves. */
export function qaWritten(): QaWritten {
  return { on: false, column: '', band: '', offset: Number.NaN, at: null, endOn: false };
}

/**
 * The track's move at `place` that stands the middle of question k's words on the reading line `line` at place k:
 * linear between two, and on before the first and past the last by the first and the last gaps. Each centre is a
 * block's words' middle down the track, px. None measured: 0.
 */
export function qaOffset(centres: readonly number[], place: number, line: number): number {
  const c = centres;
  if (c.length === 0) return 0;
  if (c.length === 1) return line - c[0]!;
  const last = c.length - 1;
  let at: number;
  if (place <= 0) at = c[0]! + place * (c[1]! - c[0]!);
  else if (place >= last) at = c[last]! + (place - last) * (c[last]! - c[last - 1]!);
  else {
    const i = Math.floor(place);
    at = c[i]! + (place - i) * (c[i + 1]! - c[i]!);
  }
  return line - at;
}

/** The reading line on a screen, px from its top: its middle on a laptop, a little under it on a phone (≤ 700 px wide). */
export function qaReadingLine(size: { width: number; height: number }): number {
  return (size.width <= 700 ? 0.62 : 0.5) * size.height;
}

/** The question whose place `place` is within NEAR of, of `questions`; none between two or off them. */
export function qaNearest(place: number, questions: number): number | null {
  const k = Math.round(place);
  return k >= 0 && k < questions && Math.abs(place - k) <= NEAR ? k : null;
}

const share = (x: number): string => Math.min(Math.max(x, 0), 1).toFixed(3);

/** Writes `view` to the page's `parts`, only what differs from `written`, which it updates. */
export function writeQa(parts: QaParts, view: QaView, written: QaWritten): void {
  const { root, section, track, end } = parts;
  if (view.on !== written.on) {
    written.on = view.on;
    if (view.on) root.setAttribute(QA_ATTRIBUTE, '');
    else root.removeAttribute(QA_ATTRIBUTE);
    if (section) section.inert = !view.on;
  }
  const column = share(view.column);
  if (column !== written.column) {
    written.column = column;
    section?.style.setProperty('--qa-column', column);
  }
  const band = share(view.band);
  if (band !== written.band) {
    written.band = band;
    section?.style.setProperty('--qa-band', band);
  }
  if (track && !(Math.abs(view.offset - written.offset) < OFFSET_STEP)) {
    written.offset = view.offset;
    track.style.transform = `translate3d(0, ${view.offset.toFixed(1)}px, 0)`;
  }
  const at = view.on ? view.at : null;
  if (at !== written.at) {
    written.at = at;
    if (at === null) root.removeAttribute(QA_AT_ATTRIBUTE);
    else root.setAttribute(QA_AT_ATTRIBUTE, String(at));
  }
  const endOn = view.on && view.endOn;
  if (endOn !== written.endOn) {
    written.endOn = endOn;
    if (endOn) root.setAttribute(QA_END_ATTRIBUTE, '');
    else root.removeAttribute(QA_END_ATTRIBUTE);
    if (end) end.hidden = !endOn;
  }
}

/** Clears all the writer wrote: the Q&A gone from the page (the scene let go, or 3D switched off). */
export function clearQa(parts: QaParts, written: QaWritten): void {
  const { root, section, end } = parts;
  root.removeAttribute(QA_ATTRIBUTE);
  root.removeAttribute(QA_AT_ATTRIBUTE);
  root.removeAttribute(QA_END_ATTRIBUTE);
  if (section) {
    section.inert = true;
    section.style.removeProperty('--qa-column');
    section.style.removeProperty('--qa-band');
  }
  if (end) end.hidden = true;
  Object.assign(written, qaWritten());
}
