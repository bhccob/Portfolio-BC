import { type JSX, useCallback } from 'react';
import { Link } from 'react-router';
import type { CategoryId } from '~/data/categories';
import { type ProjectId, projects } from '~/data/projects';
import { useTranslator } from '~/i18n/useTranslator';
import { WORLD_PROJECTS } from '~/scene/bob/journey';
import { isPlainClick } from './BackLink';
import { nameLine, nameOffset } from './nameLine';
import { openAt } from './projectOpen';

// The projects' names on the stack (spec 2026-10-28-bob-quantum-stack-design.md, goal 6; the mock-up's): each a link to
// its project on a thin gold line from its object, shown only while the mouse is on its project or on its name in a
// board's words; a touch screen, which has no hover, shows a board's names at its stop. The hint below stays with the
// stops. All hidden until the scene shows them (src/scene/bob/Void.tsx `showWorldNames`); without a scene there are none,
// and the home's nav is the way.

/** One name's parts: its link and its line. */
export interface WorldNameParts {
  root: HTMLElement;
  line: SVGPolylineElement;
}

/**
 * What the scene says of the names on a frame: how much of them may show (`opacity`, the stops'), and for each its
 * object's top on the screen, whether the pointer is on it (`hot`) and its own share of that opacity (`level`, `nameLevel`).
 */
export interface WorldNamesView {
  opacity: number;
  names: { id: ProjectId; anchor: { x: number; y: number }; category: CategoryId; hot: boolean; level: number }[];
}

const names = new Map<ProjectId, WorldNameParts>();
let hint: HTMLElement | null = null;

/** The project whose name in a board's words the mouse is on, or none. */
let captionOn: ProjectId | null = null;

/** The mouse comes on a project's name in a board's words (its id), or off it (null). */
export function setCaptionHover(id: ProjectId | null): void {
  captionOn = id;
}

/** The project whose name in a board's words the mouse is on, or none. */
export function captionHover(): ProjectId | null {
  return captionOn;
}

/**
 * How much of project `id`'s name shows, of the stops' opacity: under a mouse, as far as the pointer's hover on its
 * project has eased in (`hover`), or whole while the mouse is on its name in a board's words (`caption`); on a touch
 * screen, whole for the projects of the board in view at its stop (`board`), none elsewhere, the world's stop included.
 */
export function nameLevel(
  id: ProjectId,
  { touch, hover, caption, board }: { touch: boolean; hover: { id: ProjectId | null; amount: number }; caption: ProjectId | null; board: readonly ProjectId[] | null }
): number {
  if (touch) return board?.includes(id) ? 1 : 0;
  return Math.max(hover.id === id ? Math.min(Math.max(hover.amount, 0), 1) : 0, caption === id ? 1 : 0);
}

/** A name's box on the screen, CSS px: the words standing on their line's level run. */
export interface NameBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** How far apart two names stand when one is raised over the other, px. */
const APART = 6;

const overlap = (a: NameBox, b: NameBox): boolean => a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;

/**
 * Where each name stands: by `nameLine` from its object's top, out by its category's reach; one that would cover a name
 * lower on the screen raised above it (a touch screen shows a board's names all at once, three of them perhaps, which
 * the screen's edge would otherwise stack).
 */
export function placeNames(
  items: readonly { id: ProjectId; anchor: { x: number; y: number }; category: CategoryId; width: number; height: number }[],
  size: { width: number; height: number }
): Map<ProjectId, { line: ReturnType<typeof nameLine>; box: NameBox }> {
  const placed = new Map<ProjectId, { line: ReturnType<typeof nameLine>; box: NameBox }>();
  const boxes: NameBox[] = [];
  for (const item of [...items].sort((a, b) => b.anchor.y - a.anchor.y)) {
    const [ox, oy] = nameOffset(item.category, size.width);
    let raise = 0;
    let line = nameLine(item.anchor, [ox, oy], item.width, size);
    let box: NameBox = { left: 0, top: 0, width: item.width, height: item.height };
    for (let tries = 0; tries < 8; tries++) {
      line = nameLine(item.anchor, [ox, oy - raise], item.width, size);
      box = { left: line.text.left ?? size.width - (line.text.right ?? 0) - item.width, top: line.text.top - item.height, width: item.width, height: item.height };
      const covered = boxes.find((other) => overlap(other, box));
      if (!covered) break;
      raise += box.top + box.height - covered.top + APART;
    }
    boxes.push(box);
    placed.set(item.id, { line, box });
  }
  return placed;
}

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

/** A name's height when the page has not laid it out, px. */
const NAME_HEIGHT = 18;

/**
 * The names as the scene has them (\`view\`, or none): each at the view's opacity times its own level, so a name shows only
 * where its level says (`nameLevel`); each placed by `placeNames` from its object's top, lit where the pointer is on its
 * project (\`data-hot\`), in reach of Tab only while shown and of the pointer once half in (the mock-up's). The hint keeps
 * the view's opacity.
 */
export function showWorldNames(view: WorldNamesView | null, size: { width: number; height: number }): void {
  const opacity = view === null ? 0 : Math.min(Math.max(view.opacity, 0), 1);
  if (hint) hint.style.opacity = String(Math.round(opacity * 1000) / 1000);
  const shown = new Map<ProjectId, { view: WorldNamesView['names'][number]; parts: WorldNameParts; opacity: number }>();
  for (const [id, parts] of names) {
    const name = view?.names.find((n) => n.id === id);
    const own = name ? Math.round(opacity * Math.min(Math.max(name.level, 0), 1) * 1000) / 1000 : 0;
    if (!name || own <= 0) {
      hide(parts);
      parts.root.toggleAttribute('data-hot', false);
      continue;
    }
    shown.set(id, { view: name, parts, opacity: own });
  }
  const places = placeNames(
    [...shown.values()].map(({ view: n, parts }) => ({ id: n.id, anchor: n.anchor, category: n.category, width: parts.root.offsetWidth, height: parts.root.offsetHeight || NAME_HEIGHT })),
    size
  );
  for (const [id, { view: name, parts, opacity: own }] of shown) {
    const { line, box } = places.get(id)!;
    parts.line.setAttribute('points', line.points.map(([x, y]) => `${x},${y}`).join(' '));
    parts.root.style.transform = `translate3d(${box.left}px, ${line.text.top}px, 0) translateY(-100%)`;
    parts.root.style.opacity = String(own);
    parts.line.style.opacity = String(own);
    parts.root.style.pointerEvents = own > 0.5 ? 'auto' : 'none';
    parts.root.tabIndex = 0;
    parts.root.toggleAttribute('data-shown', true);
    parts.root.toggleAttribute('data-hot', name.hot);
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
