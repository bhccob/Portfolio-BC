import { type JSX, useCallback, useEffect } from 'react';
import { Link, type NavigateFunction, useNavigate } from 'react-router';
import { type ProjectId, projects } from '~/data/projects';
import { useTranslator } from '~/i18n/useTranslator';
import { FLIGHT_MS, FOCUS_FADE_MS, focusPoseAt, moveFocus, restsAt } from '~/scene/bob/focus';
import { INSIDE_STATE, opensOnClick } from '~/scene/bob/inside';
import { BEADS, journeyAt } from '~/scene/bob/journey';
import { wakeScene } from '~/scene/motion';
import { frame } from '~/state/frame';
import { insideInHistory, noteOpenedFrom } from '~/state/routeSync';
import { useScene } from '~/state/store';
import { isPlainClick } from './BackLink';
import { setSkipAlt, skipBox, skipPlace } from './SkipButton';

// ---------------------------------------------------------------- where it stands

/** What the scene says of one bead's label on a frame (src/scene/bob/Void.tsx). */
export interface PathLabelView {
  id: ProjectId;
  /**
   * Where it hangs from, CSS px: the light at rest beside its bead (the label right of it, level with it), or a point
   * under the bead (the label below it, in the middle): on a phone, and in the look back.
   */
  anchor: { x: number; y: number };
  side: 'right' | 'below';
  /** How much of it shows, 0..1: an arrival's label comes in as the light comes to rest and goes as the camera goes in. */
  opacity: number;
  /** The look back's: shown only on hover and focus, and in reach of Tab all the while. */
  quiet: boolean;
  /** The pointer is over its bead (the look back's). */
  hover: boolean;
}

/** The site's header (`--header-height`, src/styles/tokens.css): a label never goes up under it. */
const HEADER = 64;

/** How far a label keeps from the screen's edges, px. */
const EDGE = 16;

/** How far right of the light a label stands, px (the light path mock-up's). */
const LIGHT_GAP = 34;

const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);

/**
 * Where a label of `box` (its size, CSS px) stands on a screen of `size`: right of its anchor by LIGHT_GAP and level
 * with it, or below it and in the middle; held inside the screen, EDGE from its sides and below the header. An anchor
 * that is not a number reads as the middle of the screen.
 */
export function pathLabelPlace(view: Pick<PathLabelView, 'anchor' | 'side'>, box: { w: number; h: number }, size: { width: number; height: number }): { x: number; y: number } {
  const ax = Number.isFinite(view.anchor.x) ? view.anchor.x : size.width / 2;
  const ay = Number.isFinite(view.anchor.y) ? view.anchor.y : size.height / 2;
  const [x, y] = view.side === 'right' ? [ax + LIGHT_GAP, ay - box.h / 2] : [ax - box.w / 2, ay];
  return {
    x: clamp(x, EDGE, Math.max(EDGE, size.width - EDGE - box.w)),
    y: clamp(y, HEADER + EDGE, Math.max(HEADER + EDGE, size.height - EDGE - box.h))
  };
}

/**
 * Whether Tab reaches a label: only where it can be seen and clicked. The look back's always (each shows on its focus);
 * an arrival's once it is half in.
 */
export function labelFocusable(view: Pick<PathLabelView, 'quiet' | 'opacity'>): boolean {
  return view.quiet || view.opacity >= 0.5;
}

// ---------------------------------------------------------------- the scene shows it

/** A label on the page, as React mounts it, and what was last written to it: a frame writes only what has changed. */
interface Written {
  el: HTMLAnchorElement;
  shown: boolean;
  quiet: boolean;
  hover: boolean;
  /** `[data-side]`: which side of its anchor it stands. */
  side: string;
  focusable: boolean;
  /** `[data-rest]`: an arrival's label half in or more, which takes the pointer. */
  rest: boolean;
  /** Its opacity and transform as written; null where nothing is written yet. */
  opacity: string | null;
  transform: string | null;
  /** Its measured size, and the text and screen it was measured for. */
  box: { w: number; h: number } | null;
  text: string;
  width: number;
}

/** The labels on the page, by bead, as React mounts them. */
const labels = new Map<ProjectId, Written>();

/** Puts a label out of reach: out of the Tab order and inert, as every label is while the scene does not show it. */
function putAway(el: HTMLAnchorElement): void {
  el.tabIndex = -1;
  el.setAttribute('inert', '');
}

/**
 * Puts bead `id`'s label element where `showBeadLabels` finds it (the label's ref does), out of reach until the scene
 * shows it: hidden whole, its marks gone, as its record starts with nothing written. A navigation that keeps the home
 * page (a bead's inside pushed or popped) re-renders the link, and React calls its ref again with the same element,
 * which may be shown: the next frame that shows it shows it again. Answers its taking away.
 */
export function registerBeadLabel(id: ProjectId, el: HTMLAnchorElement): () => void {
  const label: Written = { el, shown: false, quiet: false, hover: false, side: '', focusable: false, rest: false, opacity: null, transform: null, box: null, text: '', width: 0 };
  labels.set(id, label);
  hide(label);
  return () => {
    if (labels.get(id)?.el === el) labels.delete(id);
  };
}

/** Hides a label: out of the page's flow, its marks gone, out of reach. */
function hide(label: Written): void {
  const { el } = label;
  for (const name of ['data-shown', 'data-rest', 'data-quiet', 'data-hover', 'data-side']) el.removeAttribute(name);
  el.style.opacity = '';
  putAway(el);
  Object.assign(label, { shown: false, quiet: false, hover: false, side: '', focusable: false, rest: false, opacity: '', transform: null });
}

/**
 * Shows the labels of `views` and every other label not, on a screen of `size` (CSS px). The Void (src/scene/bob/Void.tsx)
 * calls it on each frame it poses the void.
 * - A shown label is `[data-shown]`, out of `inert`, standing where `pathLabelPlace` says by a transform, measured
 *   again when its text or the screen's width changes, with `[data-side]` for its alignment.
 * - An arrival's label shows at its opacity (written to it), takes Tab and the pointer once it is half in
 *   (`labelFocusable`, `[data-rest]`), and keeps the skip button clear: where it would cover the button's own place,
 *   the button takes its alternate place (src/ui/SkipButton.tsx `skipPlace`).
 * - The look back's are `[data-quiet]`: each in reach of Tab, shown by the stylesheet on hover and focus, and on
 *   `[data-hover]` while the pointer is over its bead.
 * - A label not shown is out of the Tab order and `inert`, from its registration on. A label that had the focus and goes
 *   hands it to the first label shown, else to <main>, never to <body>; neither scrolls.
 */
export function showBeadLabels(views: readonly PathLabelView[], size: { width: number; height: number }): void {
  const active = typeof document === 'undefined' ? null : document.activeElement;
  let lost = false;
  let first: HTMLAnchorElement | null = null;
  let arrival: { x: number; y: number; w: number; h: number } | null = null;
  for (const [id, label] of labels) {
    const view = views.find((v) => v.id === id);
    const { el } = label;
    if (!view) {
      if (label.shown) {
        lost ||= el.isConnected && active === el;
        hide(label);
      }
      continue;
    }
    if (!label.shown) {
      el.setAttribute('data-shown', '');
      el.removeAttribute('inert');
      label.shown = true;
    }
    first ??= el;
    if (view.quiet !== label.quiet) {
      el.toggleAttribute('data-quiet', view.quiet);
      label.quiet = view.quiet;
    }
    if (view.side !== label.side) {
      el.setAttribute('data-side', view.side);
      label.side = view.side;
    }
    const hover = view.quiet && view.hover;
    if (hover !== label.hover) {
      el.toggleAttribute('data-hover', hover);
      label.hover = hover;
    }
    const opacity = view.quiet ? '' : String(Math.round(view.opacity * 1000) / 1000);
    if (opacity !== label.opacity) {
      el.style.opacity = opacity;
      label.opacity = opacity;
    }
    const focusable = labelFocusable(view);
    if (focusable !== label.focusable) {
      if (focusable) el.removeAttribute('tabindex');
      else el.tabIndex = -1;
      label.focusable = focusable;
    }
    const rest = focusable && !view.quiet;
    if (rest !== label.rest) {
      el.toggleAttribute('data-rest', rest);
      label.rest = rest;
    }
    const text = el.textContent ?? '';
    if (label.box === null || label.text !== text || label.width !== size.width) {
      label.box = el.offsetWidth > 0 ? { w: el.offsetWidth, h: el.offsetHeight } : null;
      Object.assign(label, { text, width: size.width });
    }
    const box = label.box ?? { w: 300, h: 96 };
    const at = pathLabelPlace(view, box, size);
    const transform = `translate3d(${Math.round(at.x)}px, ${Math.round(at.y)}px, 0)`;
    if (transform !== label.transform) {
      el.style.transform = transform;
      label.transform = transform;
    }
    if (!view.quiet && view.opacity > 0) arrival = { x: at.x, y: at.y, w: box.w, h: box.h };
  }
  if (lost) (first ?? document.getElementById('main'))?.focus({ preventScroll: true });
  const pill = skipBox(size);
  setSkipAlt(pill !== null && skipPlace(arrival, size, pill) === 'alt');
}

// ---------------------------------------------------------------- opening a bead

/** How the home page opens a project: its router and the page of each project in its language, while it is up. */
let opener: { navigate: NavigateFunction; path: (id: ProjectId) => string } | null = null;

/** The attribute on <html> from a bead's opening until its page has faded in: the page's text fades in with its scrim. */
const OPENING_ATTRIBUTE = 'data-bead-open';

/** How long the page's text and its scrim take to fade in, ms (src/styles/base.css), and a frame or two more. */
const PAGE_FADE_MS = 1_000;

/** The timer that takes `<html data-bead-open>` away after the last opening's page has faded in, or null. */
let openingClear: ReturnType<typeof setTimeout> | null = null;

/**
 * Lends `openBead` a page's router and the page of each project in its language (the home page's labels do, while
 * they are up). Answers the hand-back, which leaves any later lender alone.
 */
export function lendOpener(ways: { navigate: NavigateFunction; path: (id: ProjectId) => string }): () => void {
  opener = ways;
  return () => {
    if (opener === ways) opener = null;
  };
}

/**
 * Opens bead `id`'s project, the one way for the label's link and a click on the bead (spec §2.4): the camera flies
 * into the porthole over FLIGHT_MS (`frame.focus`, src/scene/bob/focus.ts), and once it is in the router goes to the
 * project's page, which stands over the bead seen close. The flight leaves only from the bead's own stop, at rest
 * (`restsAt`); with reduced motion, or from anywhere else, a fade stands in for it, and the router goes to the page
 * while the scene is dark. The navigation waits for the flight, so the page never comes over a camera still on its way,
 * and the flight's clock is the document's, so nothing of it starts again on the page. Meanwhile the phase is
 * PROJECT_FOCUS (OPEN_PROJECT), so the scroll takes no input, and `<html data-bead-open>` lets the page's text fade in
 * with its scrim when it comes. A Back (or any way off the home page) during the flight lets the bead go
 * (src/state/routeSync.ts), and the router stays. With the visitor inside the bead and the camera in (its inside's
 * "Bekijk project", `viewInside`) nothing moves and the router goes at once. Answers whether it began: not while another bead
 * is opening, nor without the home page's router. A new opening clears the last one's timer for `<html data-bead-open>`,
 * so an opening soon after the last (Escape, then the label again) keeps the attribute until its own page has faded in.
 */
export function openBead(id: ProjectId): boolean {
  const ways = opener;
  if (ways === null || frame.focus.opening !== null) return false;
  const { reducedMotion, dispatch, inside } = useScene.getState();
  const now = performance.now();
  const shown = focusPoseAt(frame.focus.move, now);
  const there = inside === id && shown.id === id && shown.amount === 1 && !shown.moving;
  const fly = !there && !reducedMotion && restsAt(id, frame.progress, frame.target);
  frame.focus.opening = id;
  if (!there) frame.focus.move = moveFocus(frame.focus.move, id, now, fly ? 'fly' : 'fade');
  const root = document.documentElement;
  if (openingClear !== null) clearTimeout(openingClear);
  openingClear = null;
  root.setAttribute(OPENING_ATTRIBUTE, '');
  // Back from its page comes back to this very place: its arrival, its inside or the look back.
  noteOpenedFrom(id, frame.progress);
  dispatch({ type: 'OPEN_PROJECT', id });
  wakeScene();
  const to = ways.path(id);
  setTimeout(
    () => {
      if (frame.focus.opening === id) void ways.navigate(to);
      openingClear = setTimeout(() => {
        openingClear = null;
        root.removeAttribute(OPENING_ATTRIBUTE);
      }, PAGE_FADE_MS);
    },
    there ? 0 : fly ? FLIGHT_MS : FOCUS_FADE_MS
  );
  return true;
}

/**
 * Takes the visitor inside bead `id` (spec 2026-10-27-bob-nebula-space-design.md, goal 6): the camera flies through
 * the porthole over FLIGHT_MS (`frame.focus`, src/scene/bob/focus.ts), from where the bead opens at rest (`restsAt`),
 * and fades in from anywhere else or with reduced motion; the store's `inside` is set at once, so the bead's objects
 * build, its touch points show and its two buttons come (src/ui/InsideControls.tsx); and the home page is pushed again
 * with `{ [INSIDE_STATE]: id }`, so Back comes out (src/state/routeSync.ts). Back from its project page comes back to
 * this very place (`noteOpenedFrom`). Answers whether it began: not while a bead is opening or the visitor is inside one.
 * Without the home page's router the inside opens all the same, with no entry of its own (`closeInside` lets it go).
 */
export function openInside(id: ProjectId): boolean {
  const { reducedMotion, inside, setInside } = useScene.getState();
  if (frame.focus.opening !== null || inside !== null) return false;
  const fly = !reducedMotion && restsAt(id, frame.progress, frame.target);
  frame.focus.move = moveFocus(frame.focus.move, id, performance.now(), fly ? 'fly' : 'fade');
  noteOpenedFrom(id, frame.progress);
  setInside(id);
  const ways = opener;
  const here = typeof window === 'undefined' ? '/' : `${window.location.pathname}${window.location.search}`;
  if (ways !== null) void ways.navigate(here, { state: { [INSIDE_STATE]: id }, preventScrollReset: true });
  wakeScene();
  return true;
}

/**
 * Takes the visitor back out of the bead they are inside: "Terug", Escape, a wheel and a swipe (src/ui/InsideControls.tsx).
 * The store lets the inside go at once, so the camera starts flying out now (src/scene/bob/focus.ts); where the entry
 * shown is the inside's own (`insideInHistory`) the router goes Back too, to the entry before it, so Forward can come
 * back in. A second call before the router has popped finds no inside and goes nowhere further back.
 */
export function closeInside(): void {
  const { inside, setInside } = useScene.getState();
  if (inside === null) return;
  setInside(null);
  const ways = opener;
  if (ways !== null && insideInHistory()) void ways.navigate(-1);
  wakeScene();
}

/** "Bekijk project": opens the page of the bead the visitor is inside (`openBead`, which goes at once from inside). */
export function viewInside(): boolean {
  const id = useScene.getState().inside;
  return id !== null && openBead(id);
}

/**
 * A click on bead `id` or its label, the way into it: inside it where a click opens it (./inside.ts `opensOnClick`:
 * its arrival, or the look back), its page otherwise (a light off the way, a label a click reaches some other way).
 */
export function openAt(id: ProjectId): boolean {
  const index = BEADS.findIndex((bead) => bead.id === id);
  return index !== -1 && opensOnClick(journeyAt(frame.progress), index) ? openInside(id) : openBead(id);
}

// ---------------------------------------------------------------- the labels

/**
 * The label of bead `id` (spec §2.4): real text beside the selected bead at its project stop, in the ref-04 style. It
 * holds the category line ("01 — BEVEILIGD ELEMENT", `Category.heading`, src/data/categories.ts), the title in heavy gold
 * (src/data/projects.ts) and a small hint, "Klik om te openen" or, on a touch screen, "Tik om te openen" (`t.needle.bead`;
 * both are in the page and the stylesheet shows the one for the pointer, `@media (pointer: coarse)`; they are
 * aria-hidden, so its name is the category line and the title). It is one link to the project's page in the page's
 * language, so Tab reaches it; a plain click (or Enter) takes the visitor inside the bead (`openAt`: `openInside`,
 * where its two buttons lead on to the page or back out), and a click that opens it elsewhere (a new tab) is the
 * browser's. It is hidden until the scene shows it (`showBeadLabels`):
 * without a scene there is none, and the home's nav is the way to the projects.
 */
export function BeadLabel({ id }: { id: ProjectId }): JSX.Element {
  const i18n = useTranslator();
  const { t, locale } = i18n;
  const project = projects.byId(id)!;
  const ref = useCallback((el: HTMLAnchorElement | null) => (el ? registerBeadLabel(id, el) : undefined), [id]);
  return (
    <Link
      className="bead-label"
      data-bead={id}
      to={i18n.path(projects.route(project))}
      ref={ref}
      onClick={(event) => {
        if (!isPlainClick(event)) return;
        event.preventDefault();
        openAt(id);
      }}
    >
      <span className="label bead-label-category">{project.category.heading(locale)}</span>
      <span className="bead-label-title">{project.title}</span>
      <span className="bead-label-hint" aria-hidden="true">
        <span className="bead-label-hint-fine">{t.needle.bead.hint}</span>
        <span className="bead-label-hint-touch">{t.needle.bead.hintTouch}</span>
      </span>
    </Link>
  );
}

/**
 * The home page's bead labels, one for each project in the void's order, all hidden until the scene shows one. While
 * they are up they lend `openBead` the page's router and language.
 */
export function BeadLabels(): JSX.Element {
  const navigate = useNavigate();
  const i18n = useTranslator();
  useEffect(() => lendOpener({ navigate, path: (id: ProjectId) => i18n.path(projects.route(projects.byId(id)!)) }), [navigate, i18n]);
  return (
    <>
      {projects.all().map((project) => (
        <BeadLabel key={project.id} id={project.id} />
      ))}
    </>
  );
}
