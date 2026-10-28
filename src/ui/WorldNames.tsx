import { type JSX, useCallback } from 'react';
import { Link } from 'react-router';
import type { CategoryId } from '~/data/categories';
import { type ProjectId, projects } from '~/data/projects';
import { useTranslator } from '~/i18n/useTranslator';
import { WORLD_PROJECTS } from '~/scene/bob/journey';
import { isPlainClick } from './BackLink';
import { nameLine, nameOffset } from './nameLine';
import { openAt } from './projectOpen';

// The projects' names on the whole world (spec 2026-10-27-bob-hologram-world-design.md, goal 2; the mock-up's): each a
// link to its project on a thin gold line from its object, and the hint below. Hidden until the scene shows them at the
// world's stop (src/scene/bob/Void.tsx `showWorldNames`); without a scene there are none, and the home's nav is the way.

/** One name's parts: its link and its line. */
export interface WorldNameParts {
  root: HTMLElement;
  line: SVGPolylineElement;
}

/** What the scene says of the names on a frame: how much of them shows, and each one's object's top on the screen. */
export interface WorldNamesView {
  opacity: number;
  names: { id: ProjectId; anchor: { x: number; y: number }; category: CategoryId; hot: boolean }[];
}

const names = new Map<ProjectId, WorldNameParts>();
let hint: HTMLElement | null = null;

export function registerWorldName(id: ProjectId, parts: WorldNameParts): () => void {
  names.set(id, parts);
  hide(parts);
  return () => {
    if (names.get(id) === parts) names.delete(id);
  };
}

export function registerWorldHint(el: HTMLElement): () => void {
  hint = el;
  el.style.opacity = '0';
  return () => {
    if (hint === el) hint = null;
  };
}

/** A name hidden: unseen, out of Tab's reach and the pointer's (`[data-shown]` is what makes it visible). */
function hide(parts: WorldNameParts): void {
  parts.root.style.opacity = '0';
  parts.line.style.opacity = '0';
  parts.root.style.pointerEvents = 'none';
  parts.root.tabIndex = -1;
  parts.root.toggleAttribute('data-shown', false);
}

/**
 * The names as the scene has them (\`view\`, or none): each placed by \`nameLine\` from its object's top, at the view's
 * opacity, lit where the pointer is on its project (\`data-hot\`), in reach of Tab only while shown and of the pointer once
 * half in (the mock-up's); the hint with them.
 */
export function showWorldNames(view: WorldNamesView | null, size: { width: number; height: number }): void {
  const opacity = view === null ? 0 : Math.round(Math.min(Math.max(view.opacity, 0), 1) * 1000) / 1000;
  if (hint) hint.style.opacity = String(opacity);
  for (const [id, parts] of names) {
    const shown = view?.names.find((name) => name.id === id);
    if (!shown || opacity <= 0) {
      hide(parts);
      parts.root.toggleAttribute('data-hot', false);
      continue;
    }
    const line = nameLine(shown.anchor, nameOffset(shown.category, size.width), parts.root.offsetWidth, size);
    parts.line.setAttribute('points', line.points.map(([x, y]) => `${x},${y}`).join(' '));
    const x = line.text.left ?? size.width - (line.text.right ?? 0) - parts.root.offsetWidth;
    parts.root.style.transform = `translate3d(${x}px, ${line.text.top}px, 0) translateY(-100%)`;
    parts.root.style.opacity = String(opacity);
    parts.line.style.opacity = String(opacity);
    parts.root.style.pointerEvents = opacity > 0.5 ? 'auto' : 'none';
    parts.root.tabIndex = 0;
    parts.root.toggleAttribute('data-shown', true);
    parts.root.toggleAttribute('data-hot', shown.hot);
  }
}

function WorldName({ id }: { id: ProjectId }): JSX.Element {
  const i18n = useTranslator();
  const project = projects.byId(id)!;
  const ref = useCallback(
    (el: HTMLAnchorElement | null) => {
      if (!el) return undefined;
      const line = el.ownerDocument.querySelector<SVGPolylineElement>(`.world-lines [data-project="${id}"]`);
      return line ? registerWorldName(id, { root: el, line }) : undefined;
    },
    [id]
  );
  return (
    <Link
      className="world-name"
      data-project={id}
      to={i18n.path(projects.route(project))}
      ref={ref}
      onClick={(event) => {
        if (!isPlainClick(event)) return;
        event.preventDefault();
        openAt(id);
      }}
    >
      {project.title.toUpperCase()}
    </Link>
  );
}

/**
 * The home page's names on the world, one per project on it, their lines (each with a small dot at its object's end, the
 * mock-up's) and the hint, all hidden until shown.
 */
export function WorldNames(): JSX.Element {
  const { t } = useTranslator();
  const hintRef = useCallback((el: HTMLParagraphElement | null) => (el ? registerWorldHint(el) : undefined), []);
  return (
    <>
      <svg className="world-lines" aria-hidden="true">
        <defs>
          <marker id="world-dot" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="6" markerHeight="6" markerUnits="userSpaceOnUse">
            <circle cx="3" cy="3" r="3" />
          </marker>
        </defs>
        {WORLD_PROJECTS.map((id) => (
          <polyline key={id} data-project={id} />
        ))}
      </svg>
      {WORLD_PROJECTS.map((id) => (
        <WorldName key={id} id={id} />
      ))}
      <p className="world-hint" aria-hidden="true" ref={hintRef}>
        <span className="world-hint-fine">{t.needle.world.hint.click}</span>
        <span className="world-hint-touch">{t.needle.world.hint.tap}</span>
      </p>
    </>
  );
}
