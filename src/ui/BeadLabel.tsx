import { type JSX, useCallback, useEffect } from 'react';
import { Link, type NavigateFunction, useNavigate } from 'react-router';
import { type ProjectId, projects } from '~/data/projects';
import { useTranslator } from '~/i18n/useTranslator';
import { FLIGHT_MS, FOCUS_FADE_MS, moveFocus, restsAt } from '~/scene/bob/focus';
import { wakeScene } from '~/scene/motion';
import { frame } from '~/state/frame';
import { useScene } from '~/state/store';
import { isPlainClick } from './BackLink';

// ---------------------------------------------------------------- where it stands

/** Which side of its bead the label stands. */
export type LabelSide = 'right' | 'left' | 'below' | 'above';

/** The label's place: its top-left corner in the viewport's CSS pixels, and the side of the bead it is on. */
export interface LabelPlace {
  x: number;
  y: number;
  side: LabelSide;
}

/** A box's size, CSS px. */
export interface LabelBox {
  width: number;
  height: number;
}

/** Below this width a screen is a phone's (the stylesheet's phone rules start there too). */
const PHONE_WIDTH = 720;

/**
 * The label's box before it is measured, CSS px: as wide and tall as its longest lines set in the stylesheet's sizes
 * ("COOKIES CLICKER" in the heavy title, "02 — FRONTPANEEL" in the label face, its padding), with room to spare.
 */
export const LABEL_BOX = { laptop: { width: 300, height: 96 }, phone: { width: 260, height: 88 } } as const satisfies Record<string, LabelBox>;

/** How far the label keeps from the screen's edges: 16 px, and 24 on a phone. */
export function labelMargin(width: number): number {
  return width < PHONE_WIDTH ? 24 : 16;
}

/** How far the label stands off the bead's edge, px. */
const LABEL_GAP = 20;

/** The site's header (`--header-height`, src/styles/tokens.css): the label never goes up under it. */
const HEADER = 64;

/**
 * A bead's radius on the screen at its stop, CSS px: a third of the picture's half-width. The stop's shot stands
 * 6.33 m off the bead (`CAMERA_PATH.bead.offset`) with the 40 mm field, and a narrow screen stands back by the width
 * rule (`fieldFor`), so the bead's 0.95 m fills the same third of the width on every screen.
 */
export function stopRadius(size: LabelBox): number {
  return size.width / 6;
}

const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);

/**
 * Where the label stands beside a bead whose centre is at `beadNdc` (normalised device coordinates, -1 to 1, up is +1)
 * on a screen of `size` (CSS px): to its right, level with it; else to its left; else below it, in the middle; else
 * above; clear of the bead's edge (`radius`, px, by default its radius at its stop) by LABEL_GAP. However it is placed,
 * the whole box (`box`, measured, or LABEL_BOX) is held inside the screen with `labelMargin` to spare, and below the
 * header. An NDC that is not a number reads as the middle; the bead's centre is held to the screen.
 */
export function labelPlacement(beadNdc: { x: number; y: number }, size: LabelBox, options: { radius?: number; box?: LabelBox } = {}): LabelPlace {
  const { width, height } = size;
  const margin = labelMargin(width);
  const box = options.box ?? (width < PHONE_WIDTH ? LABEL_BOX.phone : LABEL_BOX.laptop);
  const radius = options.radius !== undefined && options.radius >= 0 ? options.radius : stopRadius(size);
  const nx = Number.isFinite(beadNdc.x) ? clamp(beadNdc.x, -1, 1) : 0;
  const ny = Number.isFinite(beadNdc.y) ? clamp(beadNdc.y, -1, 1) : 0;
  const cx = ((nx + 1) / 2) * width;
  const cy = ((1 - ny) / 2) * height;
  const [left, right, top, bottom] = [margin, width - margin, margin + HEADER, height - margin];
  const off = radius + LABEL_GAP;

  let place: LabelPlace;
  if (cx + off + box.width <= right) place = { x: cx + off, y: cy - box.height / 2, side: 'right' };
  else if (cx - off - box.width >= left) place = { x: cx - off - box.width, y: cy - box.height / 2, side: 'left' };
  else if (cy + off + box.height <= bottom || !(cy - off - box.height >= top)) place = { x: cx - box.width / 2, y: cy + off, side: 'below' };
  else place = { x: cx - box.width / 2, y: cy - off - box.height, side: 'above' };

  place.x = clamp(place.x, left, Math.max(left, right - box.width));
  place.y = clamp(place.y, top, Math.max(top, bottom - box.height));
  return place;
}

// ---------------------------------------------------------------- the scene shows it

/** The labels on the page, by bead, as React mounts them. */
const labels = new Map<ProjectId, HTMLAnchorElement>();

/** What the label shows now, as last written to the DOM: nothing is written that has not changed. */
const shown = {
  el: null as HTMLAnchorElement | null,
  rest: false,
  x: Number.NaN,
  y: Number.NaN,
  side: '',
  box: null as LabelBox | null,
  text: '',
  width: 0,
  height: 0
};

/** What the scene says of the label on a frame. */
export interface LabelView {
  /** The bead whose label shows: the bead of the project stretch the journey is on. */
  id: ProjectId;
  /** Its centre on the screen, NDC. */
  ndc: { x: number; y: number };
  /** Its radius on the screen, CSS px. */
  radius: number;
  /** The journey rests at the bead's stop: the label shows in full and takes the pointer. */
  rest: boolean;
}

/**
 * Shows the label of `view`'s bead beside it on a screen of `size` (CSS px), and every other label not; null shows
 * none. The Void (src/scene/bob/Void.tsx) calls it on each frame it poses the void. A shown label is
 * `[data-shown]` (in the page, so the keyboard reaches it) and, at its bead's stop, `[data-rest]` (in full; between
 * stops it is clear, src/styles/base.css). It stands where `labelPlacement` says, by a transform, with `[data-side]`
 * for its alignment, measured again when its text or the screen changes. A label that had the focus hands it to the
 * next one shown, so stepping from bead to bead with the keys keeps the keyboard on the label.
 */
export function showBeadLabel(view: LabelView | null, size: LabelBox): void {
  const el = view ? (labels.get(view.id) ?? null) : null;
  if (el !== shown.el) {
    const was = shown.el;
    const focused = was !== null && was.isConnected && document.activeElement === was;
    if (was) {
      was.removeAttribute('data-shown');
      was.removeAttribute('data-rest');
    }
    el?.setAttribute('data-shown', '');
    if (focused) el?.focus({ preventScroll: true });
    Object.assign(shown, { el, rest: false, x: Number.NaN, y: Number.NaN, side: '', box: null });
  }
  if (el === null || view === null) return;
  if (shown.rest !== view.rest) {
    el.toggleAttribute('data-rest', view.rest);
    shown.rest = view.rest;
  }
  const text = el.textContent ?? '';
  if (shown.box === null || shown.text !== text || shown.width !== size.width || shown.height !== size.height) {
    shown.box = el.offsetWidth > 0 ? { width: el.offsetWidth, height: el.offsetHeight } : null;
    Object.assign(shown, { text, width: size.width, height: size.height });
  }
  const at = labelPlacement(view.ndc, size, { radius: view.radius, box: shown.box ?? undefined });
  const x = Math.round(at.x);
  const y = Math.round(at.y);
  if (x !== shown.x || y !== shown.y) {
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    shown.x = x;
    shown.y = y;
  }
  if (at.side !== shown.side) {
    el.dataset.side = at.side;
    shown.side = at.side;
  }
}

// ---------------------------------------------------------------- opening a bead

/** How the home page opens a project: its router and the page of each project in its language, while it is up. */
let opener: { navigate: NavigateFunction; path: (id: ProjectId) => string } | null = null;

/** The attribute on <html> from a bead's opening until its page has faded in: the page's text fades in with its scrim. */
const OPENING_ATTRIBUTE = 'data-bead-open';

/** How long the page's text and its scrim take to fade in, ms (src/styles/base.css), and a frame or two more. */
const PAGE_FADE_MS = 1_000;

/**
 * Opens bead `id`'s project, the one way for the label's link and a click on the bead (spec §2.4): the camera flies
 * into the porthole over FLIGHT_MS (`frame.focus`, src/scene/bob/focus.ts), and once it is in the router goes to the
 * project's page, which stands over the bead seen close. The flight leaves only from the bead's own stop, at rest
 * (`restsAt`); with reduced motion, or from anywhere else, a fade stands in for it, and the router goes to the page
 * while the scene is dark. The navigation waits for the flight, so the page never comes over a camera still on its way,
 * and the flight's clock is the document's, so nothing of it starts again on the page. Meanwhile the phase is
 * PROJECT_FOCUS (OPEN_PROJECT), so the scroll takes no input, and `<html data-bead-open>` lets the page's text fade in
 * with its scrim when it comes. A Back (or any way off the home page) during the flight lets the bead go
 * (src/state/routeSync.ts), and the router stays. Answers whether it began: not while another bead is opening, nor
 * without the home page's router.
 */
export function openBead(id: ProjectId): boolean {
  const ways = opener;
  if (ways === null || frame.focus.opening !== null) return false;
  const { reducedMotion, dispatch } = useScene.getState();
  const fly = !reducedMotion && restsAt(id, frame.progress, frame.target);
  frame.focus.opening = id;
  frame.focus.move = moveFocus(frame.focus.move, id, performance.now(), fly ? 'fly' : 'fade');
  const root = document.documentElement;
  root.setAttribute(OPENING_ATTRIBUTE, '');
  dispatch({ type: 'OPEN_PROJECT', id });
  wakeScene();
  const to = ways.path(id);
  window.setTimeout(
    () => {
      if (frame.focus.opening === id) void ways.navigate(to);
      window.setTimeout(() => root.removeAttribute(OPENING_ATTRIBUTE), PAGE_FADE_MS);
    },
    fly ? FLIGHT_MS : FOCUS_FADE_MS
  );
  return true;
}

// ---------------------------------------------------------------- the labels

/**
 * The label of bead `id` (spec §2.4): real text beside the selected bead at its project stop, in the ref-04 style. It
 * holds the category line ("01 — BEVEILIGD ELEMENT", `Category.heading`, src/data/categories.ts), the title in heavy gold
 * (src/data/projects.ts) and a small hint, "Klik om te openen" or, on a touch screen, "Tik om te openen" (`t.needle.bead`;
 * both are in the page and the stylesheet shows the one for the pointer, `@media (pointer: coarse)`; they are
 * aria-hidden, so its name is the category line and the title). It is one link to the project's page in the page's
 * language, so Tab reaches it and Enter opens it; a plain click (or Enter) flies into the bead first (`openBead`), and a
 * click that opens it elsewhere (a new tab) is the browser's. It is hidden until the scene shows it (`showBeadLabel`):
 * without a scene there is none, and the home's nav is the way to the projects.
 */
export function BeadLabel({ id }: { id: ProjectId }): JSX.Element {
  const i18n = useTranslator();
  const { t, locale } = i18n;
  const project = projects.byId(id)!;
  const ref = useCallback(
    (el: HTMLAnchorElement | null) => {
      if (!el) return;
      labels.set(id, el);
      return () => {
        if (labels.get(id) === el) labels.delete(id);
      };
    },
    [id]
  );
  return (
    <Link
      className="bead-label"
      data-bead={id}
      to={i18n.path(projects.route(project))}
      ref={ref}
      onClick={(event) => {
        if (!isPlainClick(event)) return;
        event.preventDefault();
        openBead(id);
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
  useEffect(() => {
    const ways = { navigate, path: (id: ProjectId) => i18n.path(projects.route(projects.byId(id)!)) };
    opener = ways;
    return () => {
      if (opener === ways) opener = null;
    };
  }, [navigate, i18n]);
  return (
    <>
      {projects.all().map((project) => (
        <BeadLabel key={project.id} id={project.id} />
      ))}
    </>
  );
}
