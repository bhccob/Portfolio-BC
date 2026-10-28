import { useEffect } from 'react';
import { type NavigateFunction, useNavigate } from 'react-router';
import { type ProjectId, projects } from '~/data/projects';
import { useTranslator } from '~/i18n/useTranslator';
import { FLIGHT_MS, FOCUS_FADE_MS, focusPoseAt, moveFocus, restsAt } from '~/scene/bob/focus';
import { INSIDE_STATE, opensOnClick } from '~/scene/bob/inside';
import { journeyAt, WORLD_PROJECTS } from '~/scene/bob/journey';
import { wakeScene } from '~/scene/motion';
import { frame } from '~/state/frame';
import { insideInHistory, noteOpenedFrom, stopForProject } from '~/state/routeSync';
import { useScene } from '~/state/store';

// The ways a project on the hologram world opens (spec 2026-10-27-bob-hologram-world-design.md, goals 5 and 6): a click
// on it, its name or its area's words opens it on the world (`openInside`), "Bekijk project" goes on to its page
// (`viewInside`, `openBead`), and every way back closes it (`closeInside`). Moved here from the beads' labels, which the
// world's names replace; the names are the world's (./WorldNames.tsx).

/** How the home page opens a project: its router and the page of each project in its language, while it is up. */
let opener: { navigate: NavigateFunction; path: (id: ProjectId) => string } | null = null;

/** The attribute on <html> from a project's opening until its page has faded in: the page's text fades in with its scrim. */
const OPENING_ATTRIBUTE = 'data-bead-open';

/** How long the page's text and its scrim take to fade in, ms (src/styles/base.css), and a frame or two more. */
const PAGE_FADE_MS = 1_000;

/** The timer that takes `<html data-bead-open>` away after the last opening's page has faded in, or null. */
let openingClear: ReturnType<typeof setTimeout> | null = null;

/**
 * Lends `openBead` a page's router and the page of each project in its language (the home page does, while it is up).
 * Answers the hand-back, which leaves any later lender alone.
 */
export function lendOpener(ways: { navigate: NavigateFunction; path: (id: ProjectId) => string }): () => void {
  opener = ways;
  return () => {
    if (opener === ways) opener = null;
  };
}

/**
 * Opens project `id`'s page: the camera flies to the project's open view over FLIGHT_MS (`frame.focus`,
 * src/scene/bob/focus.ts), and once it is there the router goes to the project's page, which stands over it. The flight
 * leaves only from a stop at rest where the project is in view (`restsAt`); with reduced motion, or from anywhere else, a
 * fade stands in for it, and the router goes to the page while the scene is dark. The navigation waits for the flight,
 * so the page never comes over a camera still on its way, and the flight's clock is the document's, so nothing of it
 * starts again on the page. Meanwhile the phase is PROJECT_FOCUS (OPEN_PROJECT), so the scroll takes no input, and
 * `<html data-bead-open>` lets the page's text fade in with its scrim when it comes. A Back (or any way off the home page)
 * during the flight lets the project go (src/state/routeSync.ts), and the router stays. With the project open and the
 * camera there ("Bekijk project", `viewInside`) nothing moves and the router goes at once. Answers whether it began: not
 * while another project is opening, nor without the home page's router. A new opening clears the last one's timer for
 * `<html data-bead-open>`, so an opening soon after the last keeps the attribute until its own page has faded in.
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
  if (!there) frame.focus.move = moveFocus(frame.focus.move, id, now, fly ? 'fly' : 'fade', frame.shot);
  const root = document.documentElement;
  if (openingClear !== null) clearTimeout(openingClear);
  openingClear = null;
  root.setAttribute(OPENING_ATTRIBUTE, '');
  // Back from its page comes back to this very place: the world, an area, the open project or the look back.
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
 * Opens project `id` on the world (spec goal 5): the camera flies to its open view over FLIGHT_MS (`frame.focus`), from a
 * stop at rest where it is in view (`restsAt`), and fades in from anywhere else or with reduced motion; the store's
 * `inside` is set at once, so the object opens, its touch points show and its panel comes; and the home page is pushed
 * again with `{ [INSIDE_STATE]: id }`, so Back closes it (src/state/routeSync.ts). Back from its project page comes back
 * to this very place (`noteOpenedFrom`). Answers whether it began: not while a project is opening or one is open.
 * Without the home page's router it opens all the same, with no entry of its own (`closeInside` lets it go).
 */
export function openInside(id: ProjectId): boolean {
  const { reducedMotion, inside, setInside } = useScene.getState();
  if (frame.focus.opening !== null || inside !== null) return false;
  const fly = !reducedMotion && restsAt(id, frame.progress, frame.target);
  frame.focus.move = moveFocus(frame.focus.move, id, performance.now(), fly ? 'fly' : 'fade', frame.shot);
  noteOpenedFrom(id, frame.progress);
  setInside(id);
  const ways = opener;
  if (ways !== null) void ways.navigate(hereNow(), { state: { [INSIDE_STATE]: id }, preventScrollReset: true });
  wakeScene();
  return true;
}

/** The home page's own address, as the history entry of an open project stands on it. */
function hereNow(): string {
  return typeof window === 'undefined' ? '/' : `${window.location.pathname}${window.location.search}`;
}

/**
 * The arrows of an open project (spec goal 5): the next (`dir` 1) or the previous (−1) project on the world, round the
 * end, without going back first. The camera flies on from where it stands, round the board (src/scene/bob/focus.ts), or
 * fades with reduced motion; the store's `inside` turns at once; and the open project's history entry is replaced, so
 * Back still comes out to where the first was opened from: from an area, the new project's area (the mock-up's way, so
 * the camera comes out beside it), from the world or the look back, there (`noteOpenedFrom`). Answers whether it turned:
 * not with none open, nor while a project's page is opening.
 */
export function turnInside(dir: 1 | -1): boolean {
  const { reducedMotion, inside, setInside } = useScene.getState();
  if (inside === null || frame.focus.opening !== null) return false;
  const at = WORLD_PROJECTS.indexOf(inside);
  const next = WORLD_PROJECTS[(at + dir + WORLD_PROJECTS.length) % WORLD_PROJECTS.length]!;
  if (next === inside) return false;
  frame.focus.move = moveFocus(frame.focus.move, next, performance.now(), reducedMotion ? 'fade' : 'fly', frame.shot);
  noteOpenedFrom(next, journeyAt(frame.progress).stretch === 'area' ? stopForProject(next) : frame.progress);
  setInside(next);
  const ways = opener;
  if (ways !== null && insideInHistory()) void ways.navigate(hereNow(), { state: { [INSIDE_STATE]: next }, preventScrollReset: true, replace: true });
  wakeScene();
  return true;
}

/**
 * Closes the open project: "Terug", Escape, a wheel and a swipe (src/ui/ProjectPanel.tsx). The store lets it go at
 * once, so the camera starts flying back now (src/scene/bob/focus.ts); where the entry shown is its own
 * (`insideInHistory`) the router goes Back too, to the entry before it, so Forward can open it again. A second call before
 * the router has popped finds none open and goes nowhere further back.
 */
export function closeInside(): void {
  const { inside, setInside } = useScene.getState();
  if (inside === null) return;
  setInside(null);
  const ways = opener;
  if (ways !== null && insideInHistory()) void ways.navigate(-1);
  wakeScene();
}

/** "Bekijk project": opens the page of the open project (`openBead`, which goes at once from there). */
export function viewInside(): boolean {
  const id = useScene.getState().inside;
  return id !== null && openBead(id);
}

/**
 * A click on project `id`, its name or its area's words: open on the world where a click opens it (./inside.ts
 * `opensOnClick`: the story at rest at the world, an area or the look back), its page otherwise.
 */
export function openAt(id: ProjectId): boolean {
  return opensOnClick(journeyAt(frame.progress), frame.progress === frame.target) ? openInside(id) : openBead(id);
}

/**
 * A click (a tap) on project `id`'s object on the world (src/scene/bob/Void.tsx): it opens there where a click opens it, at
 * rest (./inside.ts `opensOnClick`), and does nothing while the camera glides between two stops (spec: "while the camera
 * is moving between stops, a click does nothing"). Answers whether it opened.
 */
export function clickOnWorld(id: ProjectId): boolean {
  return opensOnClick(journeyAt(frame.progress), frame.progress === frame.target) && openInside(id);
}

/** The home page's opener: while it is up it lends `openBead` the page's router and language. */
export function ProjectOpener(): null {
  const navigate = useNavigate();
  const i18n = useTranslator();
  useEffect(() => lendOpener({ navigate, path: (id: ProjectId) => i18n.path(projects.route(projects.byId(id)!)) }), [navigate, i18n]);
  return null;
}
