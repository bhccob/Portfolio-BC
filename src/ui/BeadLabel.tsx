import { type JSX, useCallback, useEffect } from 'react';
import { Link, type NavigateFunction, useNavigate } from 'react-router';
import { type ProjectId, projects } from '~/data/projects';
import { useTranslator } from '~/i18n/useTranslator';
import { FLIGHT_MS, FOCUS_FADE_MS, moveFocus, restsAt } from '~/scene/bob/focus';
import { BEADS } from '~/scene/bob/journey';
import { ringShot } from '~/scene/bob/lightDive';
import { wakeScene } from '~/scene/motion';
import { frame } from '~/state/frame';
import { useScene } from '~/state/store';
import { isPlainClick } from './BackLink';
import { type Box, overlaps, setSkipAlt, skipAlt, skipBox, skipHome, skipIsAlt } from './SkipButton';

// ---------------------------------------------------------------- where it stands

/** Which side of its bead the label stands. */
export type LabelSide = 'right' | 'left' | 'below' | 'above';

/**
 * The label's place: its top-left corner in the viewport's CSS pixels, and the side of the bead it is on; and, when the
 * placement was asked to keep clear of a box, whether it does.
 */
export interface LabelPlace {
  x: number;
  y: number;
  side: LabelSide;
  clear?: boolean;
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
 * A bead's radius on the screen at its ring stop, CSS px: the front bead's, seen from the ring's shot on a screen of
 * this shape (`ringShot`, src/scene/bob/lightDive.ts). The camera stands as far from each bead at its stop, so it is the
 * same for every project: about a twelfth of the width on a laptop, a seventh on a phone.
 */
export function stopRadius(size: LabelBox): number {
  const aspect = size.width > 0 && size.height > 0 ? size.width / size.height : 16 / 9;
  const { position, fov } = ringShot(0, aspect);
  const { centre, radius } = BEADS[0]!;
  const distance = Math.hypot(position[0] - centre[0], position[1] - centre[1], position[2] - centre[2]);
  return (radius / (distance * Math.tan((fov * Math.PI) / 360))) * (size.height / 2);
}

const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);

/**
 * Where the label stands beside a bead whose centre is at `beadNdc` (normalised device coordinates, -1 to 1, up is +1)
 * on a screen of `size` (CSS px): to its right, level with it; else to its left; else below it, in the middle; else
 * above; clear of the bead's edge (`radius`, px, by default its radius at its stop) by LABEL_GAP. However it is placed,
 * the whole box (`box`, measured, or LABEL_BOX) is held inside the screen with `labelMargin` to spare, and below the
 * header. An NDC that is not a number reads as the middle; the bead's centre is held to the screen. Given a box to keep
 * clear of (`avoid`: the skip button), the first of those sides, held, that keeps 8 px clear of it wins, as the mock-up
 * places it, and `clear` says whether one did (if none does, the first side stands, not clear).
 */
export function labelPlacement(beadNdc: { x: number; y: number }, size: LabelBox, options: { radius?: number; box?: LabelBox; avoid?: Box } = {}): LabelPlace {
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

  // The sides that fit, in order: right, left, below, above; below if none does.
  const sides: LabelPlace[] = [];
  if (cx + off + box.width <= right) sides.push({ x: cx + off, y: cy - box.height / 2, side: 'right' });
  if (cx - off - box.width >= left) sides.push({ x: cx - off - box.width, y: cy - box.height / 2, side: 'left' });
  if (cy + off + box.height <= bottom) sides.push({ x: cx - box.width / 2, y: cy + off, side: 'below' });
  if (cy - off - box.height >= top) sides.push({ x: cx - box.width / 2, y: cy - off - box.height, side: 'above' });
  if (sides.length === 0) sides.push({ x: cx - box.width / 2, y: cy + off, side: 'below' });
  const held = (place: LabelPlace): LabelPlace => ({
    x: clamp(place.x, left, Math.max(left, right - box.width)),
    y: clamp(place.y, top, Math.max(top, bottom - box.height)),
    side: place.side
  });
  const avoid = options.avoid;
  if (avoid === undefined) return held(sides[0]!);
  for (const side of sides) {
    const place = held(side);
    if (!overlaps({ x: place.x, y: place.y, w: box.width, h: box.height }, avoid)) return { ...place, clear: true };
  }
  return { ...held(sides[0]!), clear: false };
}

// ---------------------------------------------------------------- the scene shows it

/** The labels on the page, by bead, as React mounts them. */
const labels = new Map<ProjectId, HTMLAnchorElement>();

/** Puts a label out of reach: out of the Tab order and inert, as every label is while the scene does not show it. */
function putAway(el: HTMLAnchorElement): void {
  el.tabIndex = -1;
  el.setAttribute('inert', '');
}

/**
 * Puts bead `id`'s label element where `showBeadLabel` finds it (the label's ref does), out of reach until the scene
 * shows it. Answers its taking away.
 */
export function registerBeadLabel(id: ProjectId, el: HTMLAnchorElement): () => void {
  labels.set(id, el);
  if (el !== shown.el) putAway(el);
  return () => {
    if (labels.get(id) === el) labels.delete(id);
  };
}

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
 * stops it is clear, src/styles/base.css). Between stops it is out of the Tab order too (`tabindex="-1"`), so the
 * keyboard reaches a label only where it can be seen and clicked; at its stop it takes Tab again. A label not shown is
 * out of the Tab order and `inert`, from its registration on. It keeps clear of the skip button (src/ui/SkipButton.tsx):
 * at rest it takes the first side clear of the button's own place, and where none is, the button takes its alternate
 * place and the label keeps clear of that; while the ring turns the button stays where it stands. It stands where
 * `labelPlacement` says, by a transform, with `[data-side]` for its alignment, measured again when its text or the
 * screen changes. A label that had the focus hands it to the next one shown, so stepping from bead to bead with the
 * keys keeps the keyboard on the label (a focused label keeps the focus while it is clear between stops); with none
 * shown after it (up to the overview, a bead opened, 3D off) the focus goes to <main>, never to <body>.
 */
export function showBeadLabel(view: LabelView | null, size: LabelBox): void {
  const el = view ? (labels.get(view.id) ?? null) : null;
  if (el !== shown.el) {
    const was = shown.el;
    const focused = was !== null && was.isConnected && document.activeElement === was;
    if (was) {
      was.removeAttribute('data-shown');
      was.removeAttribute('data-rest');
      putAway(was);
    }
    if (el) {
      el.setAttribute('data-shown', '');
      el.removeAttribute('inert');
      el.tabIndex = -1;
    }
    // A focused label hands the focus on: to the next label shown, else to <main> (src/app/Shell.tsx, tabIndex -1), so the
    // keyboard is not left on <body> once the label it was on has gone out of the page. Neither scrolls.
    if (focused) (el ?? document.getElementById('main'))?.focus({ preventScroll: true });
    Object.assign(shown, { el, rest: false, x: Number.NaN, y: Number.NaN, side: '', box: null });
  }
  if (el === null || view === null) {
    setSkipAlt(false);
    return;
  }
  if (shown.rest !== view.rest) {
    el.toggleAttribute('data-rest', view.rest);
    if (view.rest) el.removeAttribute('tabindex');
    else el.tabIndex = -1;
    shown.rest = view.rest;
  }
  const text = el.textContent ?? '';
  if (shown.box === null || shown.text !== text || shown.width !== size.width || shown.height !== size.height) {
    shown.box = el.offsetWidth > 0 ? { width: el.offsetWidth, height: el.offsetHeight } : null;
    Object.assign(shown, { text, width: size.width, height: size.height });
  }
  const box = shown.box ?? undefined;
  const pill = skipBox(size);
  let at: LabelPlace;
  if (pill === null) {
    at = labelPlacement(view.ndc, size, { radius: view.radius, box });
  } else if (view.rest) {
    at = labelPlacement(view.ndc, size, { radius: view.radius, box, avoid: skipHome(size, pill) });
    setSkipAlt(at.clear === false);
    if (at.clear === false) at = labelPlacement(view.ndc, size, { radius: view.radius, box, avoid: skipAlt(size, pill) });
  } else {
    at = labelPlacement(view.ndc, size, { radius: view.radius, box, avoid: skipIsAlt() ? skipAlt(size, pill) : skipHome(size, pill) });
  }
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
 * (src/state/routeSync.ts), and the router stays. Answers whether it began: not while another bead is opening, nor
 * without the home page's router. A new opening clears the last one's timer for `<html data-bead-open>`, so an opening
 * soon after the last (Escape, then the label again) keeps the attribute until its own page has faded in.
 */
export function openBead(id: ProjectId): boolean {
  const ways = opener;
  if (ways === null || frame.focus.opening !== null) return false;
  const { reducedMotion, dispatch } = useScene.getState();
  const fly = !reducedMotion && restsAt(id, frame.progress, frame.target);
  frame.focus.opening = id;
  frame.focus.move = moveFocus(frame.focus.move, id, performance.now(), fly ? 'fly' : 'fade');
  const root = document.documentElement;
  if (openingClear !== null) clearTimeout(openingClear);
  openingClear = null;
  root.setAttribute(OPENING_ATTRIBUTE, '');
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
  useEffect(() => lendOpener({ navigate, path: (id: ProjectId) => i18n.path(projects.route(projects.byId(id)!)) }), [navigate, i18n]);
  return (
    <>
      {projects.all().map((project) => (
        <BeadLabel key={project.id} id={project.id} />
      ))}
    </>
  );
}
