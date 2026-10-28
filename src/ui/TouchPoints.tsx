import { type JSX, useCallback } from 'react';
import { type ProjectId, projects } from '~/data/projects';
import { useTranslator } from '~/i18n/useTranslator';
import { WORLD_PROJECTS } from '~/scene/bob/journey';
import { touchColumns } from '~/scene/bob/touchColumns';

/** One project's touch points on the page: its layer, its words and their lines, in test point order. */
export interface TouchPointParts {
  el: HTMLElement;
  words: HTMLElement[];
  lines: SVGPolylineElement[];
}

/** Each project's touch points on the page, as React mounts them. */
const layers = new Map<ProjectId, TouchPointParts>();

/** The project whose touch points show now, and the opacity last written, so a frame writes only what changed. */
const shown = { id: null as ProjectId | null, opacity: Number.NaN };

/** What the scene says of the touch points on a frame: the open project, how much of them shows, and where it stands. */
export interface TouchPointsView {
  id: ProjectId;
  opacity: number;
  /** Each touch point's anchor on the object, on the screen, CSS px, in test point order. */
  at: readonly { x: number; y: number }[];
  /** The object's middle across the screen and its half width there, CSS px: the columns stand out past it. */
  centreX: number;
  reach: number;
  /** Where the labels keep clear of the open project's words (src/ui/ProjectPanel.tsx `panelKeepOut`); the screen's own edges without. */
  keep?: { left: number; bottom: number };
}

/**
 * Shows the touch points of `view`'s project in two columns beside it (src/scene/bob/touchColumns.ts), each on a thin
 * line from its point on the object, at its opacity, on `size`, the mock-up's px scaled by `scale`; null shows none. The
 * Void (src/scene/bob/Void.tsx) calls it on each frame it poses the world. A layer not shown is `display: none` (no
 * `[data-shown]`), so it costs no layout.
 */
export function showTouchPoints(view: TouchPointsView | null, size: { width: number; height: number }, scale: number): void {
  const id = view && view.opacity > 0.001 ? view.id : null;
  if (id !== shown.id) {
    if (shown.id !== null) layers.get(shown.id)?.el.toggleAttribute('data-shown', false);
    if (id !== null) layers.get(id)?.el.toggleAttribute('data-shown', true);
    Object.assign(shown, { id, opacity: Number.NaN });
  }
  if (id === null || view === null) return;
  const layer = layers.get(id);
  if (!layer) return;
  if (view.opacity !== shown.opacity) {
    layer.el.style.opacity = String(view.opacity);
    shown.opacity = view.opacity;
  }
  const count = Math.min(layer.words.length, layer.lines.length, view.at.length);
  const marks = view.at.slice(0, count).map((p, k) => ({ x: p.x, y: p.y, w: layer.words[k]!.offsetWidth }));
  touchColumns(marks, view.centreX, view.reach, size, scale, view.keep).forEach((place, k) => {
    layer.words[k]!.style.transform = `translate3d(${place.left}px, ${place.top}px, 0) translateY(-100%)`;
    layer.lines[k]!.setAttribute('points', place.points.map((p) => p.join(',')).join(' '));
  });
}

/** Puts project `id`'s touch points where `showTouchPoints` finds them (its layer's ref does). Answers their taking away. */
export function registerTouchPoints(id: ProjectId, parts: TouchPointParts): () => void {
  layers.set(id, parts);
  return () => {
    if (layers.get(id) === parts) layers.delete(id);
    if (shown.id === id) Object.assign(shown, { id: null, opacity: Number.NaN });
  };
}

/** One project's touch points: its test points in the page's words, each on a thin gold line from a small dot. */
function TouchPointLayer({ id }: { id: ProjectId }): JSX.Element {
  const { locale } = useTranslator();
  const labels = projects.byId(id)!.testPointLabels(locale);
  const ref = useCallback(
    (el: HTMLDivElement | null) =>
      el
        ? registerTouchPoints(id, {
            el,
            words: [...el.querySelectorAll<HTMLElement>('.touch-point')],
            lines: [...el.querySelectorAll<SVGPolylineElement>('polyline')]
          })
        : undefined,
    [id]
  );
  return (
    <div className="touch-points" data-project={id} aria-hidden="true" ref={ref}>
      <svg className="touch-lines">
        {labels.map((label) => (
          <polyline key={label} />
        ))}
      </svg>
      {labels.map((label) => (
        <span key={label} className="touch-point">
          {label}
        </span>
      ))}
    </div>
  );
}

/**
 * The home page's touch points (spec 2026-10-27-bob-hologram-world-design.md, goal 5): one layer for each project on the
 * world, hidden until it opens. They are aria-hidden: a screen reader has them on the project's own page, where they are
 * the page's text.
 */
export function TouchPoints(): JSX.Element {
  return (
    <>
      {WORLD_PROJECTS.map((id) => (
        <TouchPointLayer key={id} id={id} />
      ))}
    </>
  );
}
