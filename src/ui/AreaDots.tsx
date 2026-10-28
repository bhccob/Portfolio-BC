import { type JSX, useCallback } from 'react';
import { type CategoryId, categories } from '~/data/categories';
import { projects } from '~/data/projects';
import { useTranslator } from '~/i18n/useTranslator';
import { goToPlace } from '~/input/useHomeScroll';
import { areaStop, areasOnPath, HOME_CHAPTERS } from '~/state/chapters';

// The areas' dots on the right (spec 2026-10-27-bob-hologram-world-design.md, goal 3; the mock-up's): one button per
// area, lit for the area in view, each taking the story to its area's stop. Shown over the areas (\`showAreaDots\`).

let nav: HTMLElement | null = null;
let dots: HTMLElement[] = [];

export function registerAreaDots(el: HTMLElement, buttons: HTMLElement[]): () => void {
  nav = el;
  dots = buttons;
  el.style.opacity = '0';
  el.toggleAttribute('inert', true);
  return () => {
    if (nav === el) {
      nav = null;
      dots = [];
    }
  };
}

/** How much of the dots shows and which area is lit (the world path's \`dots\` and its area), inert while hidden. */
export function showAreaDots(view: { opacity: number; lit: number | null }): void {
  if (nav === null) return;
  const opacity = Math.round(Math.min(Math.max(view.opacity, 0), 1) * 1000) / 1000;
  nav.style.opacity = String(opacity);
  nav.toggleAttribute('inert', opacity < 0.5);
  dots.forEach((dot, k) => {
    if (opacity > 0 && view.lit === k) dot.setAttribute('aria-current', 'true');
    else dot.removeAttribute('aria-current');
  });
}

/** A dot pressed: the story to \`category\`'s area by a key's glide. Answers whether the home's scroll took it. */
export function goToArea(category: CategoryId): boolean {
  return goToPlace(areaStop(HOME_CHAPTERS, category));
}

export function AreaDots(): JSX.Element {
  const { t, locale } = useTranslator();
  const areas = areasOnPath();
  const ref = useCallback((el: HTMLElement | null) => (el ? registerAreaDots(el, [...el.querySelectorAll<HTMLElement>('button')]) : undefined), []);
  return (
    <nav className="area-dots" aria-label={t.needle.world.areas} ref={ref} inert>
      {areas.map((area) => (
        <button
          key={area.category}
          type="button"
          className="area-dot"
          aria-label={`${categories.byId(area.category).heading(locale)}: ${area.projects.map((id) => projects.byId(id)!.title).join(', ')}`}
          onClick={() => goToArea(area.category)}
        />
      ))}
    </nav>
  );
}
