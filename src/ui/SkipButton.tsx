import { type JSX, useCallback, useEffect } from 'react';
import { useTranslator } from '~/i18n/useTranslator';
import { goToQuestions, headedToQuestions } from '~/input/useHomeScroll';
import type { JourneyPose } from '~/scene/bob/journey';
import { focusQuestionsOnArrival } from './endArrival';

// ---------------------------------------------------------------- when it shows

/**
 * Whether the skip button shows (spec 2026-10-27-bob-light-path-design.md, goal 9): from the first project's arrival
 * through the look back, its own stop included (the path's `skip`, src/scene/bob/worldPath.ts); not in the fall, under
 * the sheet nor at the credits.
 */
export function showsSkip(pose: Pick<JourneyPose, 'path'>): boolean {
  return pose.path?.skip === true;
}

/** The attribute on <html> that shows the skip button: the Void writes it (src/scene/bob/Void.tsx). */
export const SKIP_ATTRIBUTE = 'data-skip';

/** What `writeSkip` writes to: <html>. */
export interface SkipRoot {
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

/** Writes `<html data-skip>` when `shown` changes from what `written` says it last wrote. */
export function writeSkip(root: SkipRoot, shown: boolean, written: { shown: boolean }): void {
  if (shown === written.shown) return;
  if (shown) root.setAttribute(SKIP_ATTRIBUTE, '');
  else root.removeAttribute(SKIP_ATTRIBUTE);
  written.shown = shown;
}

// ---------------------------------------------------------------- where it stands

/** A box on the screen, CSS px: its top-left corner and its size. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The site's header (`--header-height`, src/styles/tokens.css): the alternate place stands under it. */
const HEADER = 64;

/** How near the label may come to the button before it counts as covering it, px (the mock-up's). */
const PAD = 8;

/**
 * The button's own place on a screen of `size` (CSS px), as the stylesheet puts it: the bottom right, `max(16px, 3.4vw)`
 * from the right and `max(24px, 3.2vw)` from the foot (a phone's safe area at the foot not counted).
 */
export function skipHome(size: { width: number; height: number }, pill: { w: number; h: number }): Box {
  const right = size.width - Math.max(16, 0.034 * size.width);
  const bottom = size.height - Math.max(24, 0.032 * size.width);
  return { x: right - pill.w, y: bottom - pill.h, w: pill.w, h: pill.h };
}

/** Its alternate place, where the label would cover its own: at the right, under the header, `max(16px, 2vw)` below it. */
export function skipAlt(size: { width: number; height: number }, pill: { w: number; h: number }): Box {
  return { ...skipHome(size, pill), y: HEADER + Math.max(16, 0.02 * size.width) };
}

/** Whether two boxes come within `pad` px of each other. */
export function overlaps(a: Box, b: Box, pad = PAD): boolean {
  return a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
}

/** Where the button stands with the front bead's label at `label` (none: no label shown): its own place, unless covered. */
export function skipPlace(label: Box | null, size: { width: number; height: number }, pill: { w: number; h: number }): 'home' | 'alt' {
  return label !== null && overlaps(label, skipHome(size, pill)) ? 'alt' : 'home';
}

/** The button on the page, as React mounts it, its measured size and whether it stands in its alternate place. */
const button = { el: null as HTMLButtonElement | null, w: 0, h: 0, width: 0, text: '', alt: false };

/** Puts the button where the label's placement finds it (its ref does). Answers its taking away. */
export function registerSkip(el: HTMLButtonElement): () => void {
  Object.assign(button, { el, w: 0, h: 0, width: 0, text: '', alt: false });
  return () => {
    if (button.el === el) button.el = null;
  };
}

/** The button's size on a screen of `size`, measured again when the screen or its text changes; null with no button. */
export function skipBox(size: { width: number }): { w: number; h: number } | null {
  const el = button.el;
  if (el === null || !el.isConnected) return null;
  const text = el.textContent ?? '';
  if (button.width !== size.width || button.text !== text) Object.assign(button, { w: el.offsetWidth, h: el.offsetHeight, width: size.width, text });
  return button.w > 0 ? { w: button.w, h: button.h } : null;
}

/** Whether the button stands in its alternate place now. */
export function skipIsAlt(): boolean {
  return button.alt;
}

/** Stands the button in its alternate place (`[data-alt]`, src/styles/base.css) or its own, written only on change. */
export function setSkipAlt(alt: boolean): void {
  if (alt === button.alt || button.el === null) return;
  button.el.toggleAttribute('data-alt', alt);
  button.alt = alt;
}

// ---------------------------------------------------------------- what it does

/** The watch for the end page's arrival the last press started, so a second press starts it afresh. */
let stopFocus: (() => void) | null = null;

/**
 * The button pressed: the story goes to the Q&A's first question by the step fade (`goToQuestions`; spec
 * 2026-10-29-bob-stack-2-design.md, goal 1), and once it rests there that question's mark takes the focus
 * (`focusQuestionsOnArrival`). Nothing is watched when the scroll takes no input (a project opening).
 */
export function skipToQuestions(doc: Document): void {
  stopFocus?.();
  stopFocus = goToQuestions() ? focusQuestionsOnArrival(doc, headedToQuestions) : null;
}

/**
 * "Snel naar vragen ↓" / "Skip to questions ↓": a pill at the bottom right that shows from the first project through
 * the look back (`<html data-skip>`), never over a bead's label (src/ui/BeadLabel.tsx places the label clear of it, and
 * where no side is, stands the button in its alternate place), and fades the story straight to the credits.
 */
export function SkipButton(): JSX.Element {
  const { t } = useTranslator();
  const ref = useCallback((el: HTMLButtonElement | null) => (el ? registerSkip(el) : undefined), []);
  useEffect(() => () => stopFocus?.(), []);
  return (
    <button type="button" className="skip-button" ref={ref} onClick={() => skipToQuestions(document)}>
      {t.lightDive.skip}
    </button>
  );
}
