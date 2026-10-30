import { type JSX, type ReactNode, useCallback } from 'react';
import { Link } from 'react-router';
import { categories } from '~/data/categories';
import { projects } from '~/data/projects';
import { useTranslator } from '~/i18n/useTranslator';
import { areasOnPath } from '~/state/chapters';
import { isPlainClick } from './BackLink';
import { openAt } from './projectOpen';
import { captionHover, setCaptionHover } from './WorldNames';

// An area's words at the bottom left (spec 2026-10-27-bob-hologram-world-design.md, goal 3; the mock-up's caption): the
// category's heading, its project's name (each a link that opens it), and "Klik om te openen" or, on a touch screen,
// "Tik om te openen". One for each area, all hidden until the scene shows the one in view (`showAreaCaption`), and inert
// from the server on, so no link of one is in reach before the scene has said. Since round 11 they show only while Tab
// is in them (base.css): to the mouse a project's name shows on its object alone (src/ui/WorldNames.tsx).

const captions = new Map<number, HTMLElement>();

export function registerAreaCaption(index: number, el: HTMLElement): () => void {
  captions.set(index, el);
  el.style.opacity = '0';
  el.toggleAttribute('inert', true);
  return () => {
    if (captions.get(index) === el) captions.delete(index);
  };
}

/**
 * The area in view and how much of its words show (the world path's \`caption\`), or none: the rest hidden and inert. A
 * name the mouse was on in words now hidden lets its project's name go (a hidden element sends no pointer leave).
 */
export function showAreaCaption(view: { index: number; opacity: number } | null): void {
  for (const [index, el] of captions) {
    const opacity = view !== null && view.index === index ? Math.round(Math.min(Math.max(view.opacity, 0), 1) * 1000) / 1000 : 0;
    el.style.opacity = String(opacity);
    el.toggleAttribute('inert', opacity < 0.5);
  }
  const on = captionHover();
  const reachable = view !== null && view.opacity >= 0.5 ? (areasOnPath()[view.index]?.projects ?? []) : [];
  if (on !== null && !reachable.includes(on)) setCaptionHover(null);
}

/** The home page's areas' words, one per area of the world, in its order. */
export function AreaCaptions(): JSX.Element {
  const i18n = useTranslator();
  const { t, locale } = i18n;
  return (
    <>
      {areasOnPath().map((area, index) => (
        <AreaCaption key={area.category} index={index}>
          <p className="label area-caption-category">{categories.byId(area.category).heading(locale)}</p>
          {area.projects.map((id) => {
            const project = projects.byId(id)!;
            return (
              <Link
                key={id}
                className="area-caption-title"
                to={i18n.path(projects.route(project))}
                onPointerEnter={() => setCaptionHover(id)}
                onPointerLeave={() => setCaptionHover(null)}
                onClick={(event) => {
                  if (!isPlainClick(event)) return;
                  event.preventDefault();
                  openAt(id);
                }}
              >
                {project.title}
              </Link>
            );
          })}
          <p className="area-caption-hint" aria-hidden="true">
            <span className="world-hint-fine">{t.needle.world.open.click}</span>
            <span className="world-hint-touch">{t.needle.world.open.tap}</span>
          </p>
        </AreaCaption>
      ))}
    </>
  );
}

function AreaCaption({ index, children }: { index: number; children: ReactNode }): JSX.Element {
  const ref = useCallback((el: HTMLDivElement | null) => (el ? registerAreaCaption(index, el) : undefined), [index]);
  return (
    <div className="area-caption" data-area={index} ref={ref} inert>
      {children}
    </div>
  );
}
