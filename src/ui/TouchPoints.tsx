import { type JSX, useCallback } from 'react';
import { type ProjectId, projects } from '~/data/projects';
import { useTranslator } from '~/i18n/useTranslator';
import { TOUCH_POINTS, touchBox } from '~/scene/bob/touchPoints';

/** Each project's touch points on the page, as React mounts them: their layer and their words, in test point order. */
const layers = new Map<ProjectId, { el: HTMLElement; words: HTMLElement[] }>();

/** The bead whose touch points show now, and what was last written, so a frame writes only what changed. */
const shown = { id: null as ProjectId | null, opacity: Number.NaN, at: [] as string[] };

/** What the scene says of the touch points on a frame: the bead, how much of them shows, and each anchor on the screen. */
export interface TouchPointsView {
  id: ProjectId;
  opacity: number;
  /** Each touch point's anchor on the screen, CSS px, in test point order. */
  at: readonly { x: number; y: number }[];
}

/**
 * Shows the touch points of `view`'s bead, each beside the part it names (src/scene/bob/touchPoints.ts `touchBox`), at
 * its opacity, on a screen `width` wide; null shows none. The Void (src/scene/bob/Void.tsx) calls it on each frame it
 * poses the void. A layer not shown is `display: none` (no `[data-shown]`), so it costs no layout.
 */
export function showTouchPoints(view: TouchPointsView | null, width: number): void {
  const id = view && view.opacity > 0.001 ? view.id : null;
  if (id !== shown.id) {
    if (shown.id !== null) layers.get(shown.id)?.el.removeAttribute('data-shown');
    if (id !== null) layers.get(id)?.el.setAttribute('data-shown', '');
    Object.assign(shown, { id, opacity: Number.NaN, at: [] });
  }
  if (id === null || view === null) return;
  const layer = layers.get(id);
  if (!layer) return;
  if (view.opacity !== shown.opacity) {
    layer.el.style.opacity = String(view.opacity);
    shown.opacity = view.opacity;
  }
  const places = TOUCH_POINTS[id];
  for (let k = 0; k < layer.words.length && k < view.at.length; k++) {
    const word = layer.words[k]!;
    const box = touchBox(view.at[k]!, places[k]!.place, { w: word.offsetWidth, h: word.offsetHeight }, width);
    const transform = `translate3d(${Math.round(box.x)}px, ${Math.round(box.y)}px, 0)`;
    if (shown.at[k] !== transform) {
      word.style.transform = transform;
      shown.at[k] = transform;
    }
  }
}

/** Puts project `id`'s touch point layer where `showTouchPoints` finds it (its ref does). Answers its taking away. */
function registerTouchPoints(id: ProjectId, el: HTMLElement): () => void {
  layers.set(id, { el, words: [...el.querySelectorAll<HTMLElement>('.touch-point')] });
  return () => {
    if (layers.get(id)?.el === el) layers.delete(id);
    if (shown.id === id) Object.assign(shown, { id: null, opacity: Number.NaN, at: [] });
  };
}

/** One project's touch points: its test points in the page's words, each a small gold dot and its word. */
function TouchPointLayer({ id }: { id: ProjectId }): JSX.Element {
  const { locale } = useTranslator();
  const project = projects.byId(id)!;
  const ref = useCallback((el: HTMLDivElement | null) => (el ? registerTouchPoints(id, el) : undefined), [id]);
  return (
    <div className="touch-points" data-bead={id} aria-hidden="true" ref={ref}>
      {project.testPointLabels(locale).map((label) => (
        <span key={label} className="touch-point">
          {label}
        </span>
      ))}
    </div>
  );
}

/**
 * The home page's touch points (spec 2026-10-27-bob-light-path-design.md, "Into the bead"): one layer for each project,
 * hidden until the scene goes into its bead. They are aria-hidden: a screen reader has them on the project's own page,
 * where they are the page's text.
 */
export function TouchPoints(): JSX.Element {
  return (
    <>
      {projects.all().map((project) => (
        <TouchPointLayer key={project.id} id={project.id} />
      ))}
    </>
  );
}
