import { type JSX, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { type ProjectId, projects } from '~/data/projects';
import { useTranslator } from '~/i18n/useTranslator';
import { type KeyTarget, keyDelta } from '~/input/keyDelta';
import { WORLD_PROJECTS } from '~/scene/bob/journey';
import { useScene } from '~/state/store';
import { isPlainClick } from './BackLink';
import { closeInside, turnInside, viewInside } from './projectOpen';

// An open project, Overworld's way (spec 2026-10-27-bob-hologram-world-design.md, goals 5 and 6; the mock-up's panel):
// beside it (on a phone, below it) its category, its name, the line about it, its role and year and "Bekijk project";
// below, "Terug" at the left and at the right the arrows with "n / N". Grown from the beads' two buttons
// (InsideControls), which it replaces.

/** The attribute on <html> while a project is open (the store's `inside`): the styles show Terug and the arrows. */
export const INSIDE_ATTRIBUTE = 'data-inside';

/** How far a finger must travel up or down the glass on an open project before it takes the visitor out, px. */
export const SWIPE_OUT_PX = 40;

/**
 * Listens on `target` for the ways about an open project other than its buttons: ← and → `turn` to the previous and the
 * next project; Escape and a key that would scroll the story (`keyDelta`: ↑ and ↓, Page Up and Down, Space but not on a
 * button it presses, Home and End) `leave`, with no ctrl, meta or alt held (alt with an arrow is the browser's Back and
 * Forward); a turn of the wheel up or down the page, not the browser's zoom (ctrl) and not a sideways one; and a swipe of
 * one finger SWIPE_OUT_PX up or down the glass, more than across it, once per touch (a tap that wavers is still a tap,
 * and a second finger is a pinch). Answers its taking down.
 */
export function leaveInsideOn(target: EventTarget, leave: () => void, turn: (dir: 1 | -1) => void = () => undefined): () => void {
  let touch: { x: number; y: number } | null = null;
  const key = (event: Event): void => {
    const e = event as KeyboardEvent;
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') turn(e.key === 'ArrowRight' ? 1 : -1);
    else if (e.key === 'Escape' || keyDelta({ key: e.key, shiftKey: e.shiftKey, target: e.target as KeyTarget | null }, 1) !== null) leave();
  };
  const wheel = (event: Event): void => {
    const e = event as WheelEvent;
    if (!e.ctrlKey && e.deltaY !== 0 && Math.abs(e.deltaY) >= Math.abs(e.deltaX)) leave();
  };
  const start = (event: Event): void => {
    const touches = (event as TouchEvent).touches;
    touch = touches.length === 1 ? { x: touches[0]!.clientX, y: touches[0]!.clientY } : null;
  };
  const move = (event: Event): void => {
    const touches = (event as TouchEvent).touches;
    if (touch === null) return;
    if (touches.length !== 1) {
      touch = null;
      return;
    }
    const dx = touches[0]!.clientX - touch.x;
    const dy = touches[0]!.clientY - touch.y;
    if (Math.abs(dy) >= SWIPE_OUT_PX && Math.abs(dy) > Math.abs(dx)) {
      touch = null;
      leave();
    }
  };
  target.addEventListener('keydown', key);
  target.addEventListener('wheel', wheel, { passive: true });
  target.addEventListener('touchstart', start, { passive: true });
  target.addEventListener('touchmove', move, { passive: true });
  return () => {
    target.removeEventListener('keydown', key);
    target.removeEventListener('wheel', wheel);
    target.removeEventListener('touchstart', start);
    target.removeEventListener('touchmove', move);
  };
}

/** Where on its opening (0..1) the open project's words come in, eased: once the camera is all but there. */
const PANEL_IN = [0.7, 1] as const;
/** Where on its closing the words of the project left go, eased: in the flight's first quarter, before the next's come. */
const PANEL_OUT = [0.75, 1] as const;

/** `x` from `a` to `b` as 0 to 1, held there and smoothstepped. */
function eased(x: number, [a, b]: readonly [number, number]): number {
  const t = x > a ? (x < b ? (x - a) / (b - a) : 1) : 0;
  return t * t * (3 - 2 * t);
}

/**
 * How much of each panel shows: the open project's (`id`) as its object opens, and, on the way from one to the next, the
 * one left as its object closes, gone before the next's come (src/scene/bob/focus.ts `focusOpensAt`).
 */
export function panelLevels(
  id: ProjectId | null,
  opens: { open: number; leaving: { id: ProjectId; amount: number } | null }
): Partial<Record<ProjectId, number>> {
  const levels: Partial<Record<ProjectId, number>> = {};
  if (id !== null) levels[id] = eased(opens.open, PANEL_IN);
  if (opens.leaving !== null) levels[opens.leaving.id] = eased(opens.leaving.amount, PANEL_OUT);
  return levels;
}

const panels = new Map<ProjectId, HTMLElement>();

export function registerProjectPanel(id: ProjectId, el: HTMLElement): () => void {
  panels.set(id, el);
  el.style.opacity = '0';
  el.toggleAttribute('inert', true);
  return () => {
    if (panels.get(id) === el) panels.delete(id);
  };
}

/** Terug and the arrows' bar, as React mounts it. */
let controls: HTMLElement | null = null;

export function registerInsideControls(el: HTMLElement): () => void {
  controls = el;
  return () => {
    if (controls === el) controls = null;
  };
}

/**
 * Where an open project's touch points keep clear of its words (src/scene/bob/touchColumns.ts), on a screen of `size`:
 * right of its panel where the panel stands beside it (a laptop's left half), above it where it stands below (a phone),
 * and above Terug and the arrows. Read off the page as laid out.
 */
export function panelKeepOut(id: ProjectId, size: { width: number; height: number }): { left: number; bottom: number } {
  let left = 0;
  let bottom = size.height;
  const box = panels.get(id)?.getBoundingClientRect();
  if (box !== undefined && box.width > 0) {
    if (box.right < size.width / 2) left = box.right;
    else bottom = box.top;
  }
  const bar = controls?.getBoundingClientRect();
  if (bar !== undefined && bar.height > 0) bottom = Math.min(bottom, bar.top);
  return { left, bottom };
}

/** Each panel at its level (`panelLevels`), none for the rest: inert, out of reach, while under half. */
export function showProjectPanels(levels: Partial<Record<ProjectId, number>>): void {
  for (const [id, el] of panels) {
    const level = Math.round(Math.min(Math.max(levels[id] ?? 0, 0), 1) * 1000) / 1000;
    el.style.opacity = String(level);
    el.toggleAttribute('inert', level < 0.5);
  }
}

/** One project's words: inert from the server on, until the scene shows them. */
function Panel({ id }: { id: ProjectId }): JSX.Element {
  const i18n = useTranslator();
  const { t, locale } = i18n;
  const project = projects.byId(id)!;
  const copy = project.copy(locale);
  const ref = useCallback((el: HTMLElement | null) => (el ? registerProjectPanel(id, el) : undefined), [id]);
  return (
    <section className="project-panel" data-project={id} ref={ref} inert>
      <p className="label project-panel-category">{project.category.heading(locale)}</p>
      <h2 className="project-panel-title">{project.title}</h2>
      <p className="project-panel-summary">{copy.summary}</p>
      <p className="project-panel-meta">{`${copy.role} · ${project.year}`}</p>
      <Link
        className="inside-button project-panel-view"
        to={i18n.path(projects.route(project))}
        onClick={(event) => {
          if (!isPlainClick(event)) return;
          event.preventDefault();
          viewInside();
        }}
      >
        {t.needle.inside.view} <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}

/**
 * The open project's panel and its controls. The panels are in the page from the start, one per project on the world,
 * each shown by the scene as its project opens (`showProjectPanels`). Terug and the arrows are hidden (and out of Tab's
 * reach) unless a project is open: while the store's `inside` is set, `<html data-inside>` shows them, Terug takes the
 * focus, and the keys, the wheel and a swipe turn or leave (`leaveInsideOn`). When it closes with the focus on a control,
 * the focus goes to <main>, so the keyboard goes on from the page.
 */
export function ProjectPanel(): JSX.Element {
  const { t } = useTranslator();
  const back = useRef<HTMLButtonElement>(null);
  const inside = useScene((state) => state.inside);
  useEffect(() => {
    const root = document.documentElement;
    let stopLeaving: (() => void) | null = null;
    const apply = (open: ProjectId | null, was: ProjectId | null): void => {
      root.toggleAttribute(INSIDE_ATTRIBUTE, open !== null);
      if (open !== null && stopLeaving === null) stopLeaving = leaveInsideOn(window, closeInside, (dir) => void turnInside(dir));
      if (open === null && stopLeaving !== null) {
        stopLeaving();
        stopLeaving = null;
      }
      if (open !== null && was === null) back.current?.focus({ preventScroll: true });
      const controls = back.current?.parentElement;
      if (open === null && (controls?.contains(document.activeElement) || document.activeElement?.closest('.project-panel'))) {
        document.getElementById('main')?.focus({ preventScroll: true });
      }
    };
    apply(useScene.getState().inside, null);
    const unsubscribe = useScene.subscribe((state, previous) => {
      if (state.inside !== previous.inside) apply(state.inside, previous.inside);
    });
    return () => {
      unsubscribe();
      stopLeaving?.();
      root.removeAttribute(INSIDE_ATTRIBUTE);
    };
  }, []);
  const bar = useCallback((el: HTMLDivElement | null) => (el ? registerInsideControls(el) : undefined), []);
  const count = WORLD_PROJECTS.length;
  const n = inside === null ? 1 : WORLD_PROJECTS.indexOf(inside) + 1;
  return (
    <>
      {WORLD_PROJECTS.map((id) => (
        <Panel key={id} id={id} />
      ))}
      <div className="inside-controls" ref={bar}>
        <button type="button" className="inside-button inside-back" ref={back} onClick={() => closeInside()}>
          <span aria-hidden="true">←</span> {t.needle.inside.back}
        </button>
        {count > 1 && (
          <div className="inside-arrows">
            <button type="button" className="inside-round" aria-label={t.needle.inside.previous} onClick={() => turnInside(-1)}>
              <span aria-hidden="true">←</span>
            </button>
            <span className="inside-count">{`${n} / ${count}`}</span>
            <button type="button" className="inside-round" aria-label={t.needle.inside.next} onClick={() => turnInside(1)}>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
