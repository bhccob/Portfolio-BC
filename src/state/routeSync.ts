import { useEffect } from 'react';
import { NavigationType, useLocation, useNavigationType } from 'react-router';
import { PAGES } from '~/data/pages';
import { type ProjectId, projects } from '~/data/projects';
import { routeFromPath } from '~/i18n/locale';
import { type Locale, Translator } from '~/i18n/Translator';
import { chapterAt, HOME_CHAPTERS } from './chapters';
import { frame } from './frame';
import { type Phase, samePhase, transition } from './machine';
import { useScene } from './store';

/**
 * The stop of a project on the home's scroll, where its bead is selected: the start of the PROJECTS unit of its
 * category (~/state/chapters), so 3 for Funcial, 4 for Jontai Energy and 5 for Cookies Clicker.
 */
export function stopForProject(id: ProjectId): number {
  const category = projects.byId(id)?.categoryId;
  const unit = HOME_CHAPTERS.units.find((u) => u.id === 'PROJECTS' && u.category === category);
  if (!unit) throw new TypeError(`no stop on the home's scroll for the project "${id}"`);
  return unit.start;
}

/**
 * The phase a URL stands for: a project page. The home page, and every page without a scene (Lite, contact,
 * not found), have none of their own, so it gives null and the scroll decides.
 * It reads the page the way the router does, so a real page under another spelling (`/Projects/Funcial/`) is not one.
 */
export function phaseForPath(pathname: string): Phase | null {
  const route = routeFromPath(pathname);
  const project = projects.byRoute(route);
  if (project) return { kind: 'PROJECT_FOCUS', id: project.id };
  return null;
}

/** The page of a phase, in a locale, or null for the phases that are not a page (they live on the home page). */
export function pathForPhase(phase: Phase, locale: Locale): string | null {
  switch (phase.kind) {
    case 'PROJECT_FOCUS': {
      const project = projects.byId(phase.id);
      return project ? Translator.pathFor(locale, projects.route(project)) : null;
    }
    default:
      return null;
  }
}

/**
 * Where Back goes: through the history when the visitor came to this page from another page of the
 * site, and to the home page when the page was where the visit began (there is no page before it).
 */
export function backTarget(arrivedDirect: boolean): 'history' | 'home' {
  return arrivedDirect ? 'home' : 'history';
}

/**
 * The navigation state the page's own Back (its Escape, its "Esc · terug" link, ~/ui/BackLink) pushes the home page
 * with, when the page was where the visit began: so the route sync knows it from a link home (Ruling 29).
 */
export const BACK_STATE: Readonly<{ back: true }> = Object.freeze({ back: true });

/** True for the page's own Back's navigation state (`BACK_STATE`), as the history hands it back (a copy). */
export function isBackState(state: unknown): boolean {
  return typeof state === 'object' && state !== null && (state as { back?: unknown }).back === true;
}

// ---------------------------------------------------------------- where the visit began

/** The history entry (its router key) the document was loaded on; set by the first sync. */
let loadedOn: string | null = null;
/** The history entry being shown. */
let shown: string | null = null;

/**
 * True when the page being shown is the one the visit began on: the document was loaded on this history
 * entry, so no client-side navigation came before it. It is true again after navigating away and back to
 * that entry, and after a reload (the document loads on whichever entry was open).
 *
 * A `replace` navigation (the contact form dropping `?sent=1`, the language switch) puts a new page in the
 * same history entry, and the router gives that entry a new key; `syncRoute` follows it, so a visit that
 * began on the replaced entry is still a direct arrival.
 */
export function arrivedDirectly(): boolean {
  return loadedOn === null || loadedOn === shown;
}

/** Forgets where the visit began. For tests: in the browser the module lives as long as the document. */
export function resetRouteSync(): void {
  loadedOn = null;
  shown = null;
}

// ---------------------------------------------------------------- URL to phase

/**
 * The phase the scroll is in: the one the home page shows at the current progress.
 *
 * It relies on two things outside this module. `frame.progress` survives a visit to a page (the canvas and
 * the frame object live as long as the document, so scrolling resumes where it stopped), and the scroll
 * input (Task 6) keeps `frame.chapterIndex` in step with `chapterAt`, since it is the hysteresis's `previous`.
 */
function phaseFromScroll(): Phase {
  const at = chapterAt(HOME_CHAPTERS, frame.progress, { index: frame.chapterIndex });
  return transition({ kind: 'HOME_IDLE' }, { type: 'CHAPTER', chapter: at.id, category: at.category });
}

/**
 * Puts the story at `place` at once, at rest: progress and target there, its chapter in step. The home's scroll input,
 * which mounts with the home page right after this sync, holds the target to the void's hold as it holds any input's
 * (src/input/scrollLoop.ts `startHomeScroll`).
 */
function placeStory(place: number): void {
  frame.progress = frame.target = place;
  frame.velocity = 0;
  frame.chapterIndex = chapterAt(HOME_CHAPTERS, place).index;
}

/**
 * Brings the scene's phase in line with the location the router now shows:
 * - a project page gives its phase, unless the scene is already in it (a language switch keeps
 *   the phase and its transition; a bead opened from the home is in it from its flight on);
 * - the home page, left a project page for by Back (a history pop) or by the page's own Back (its Escape and its
 *   "Esc · terug" link, which push the home page with `BACK_STATE` when the visit began on the page), puts the story at
 *   that project's stop (`stopForProject`, spec §2.4: "Esc or back flies out again to the same bead in the void, at its
 *   stop of the scroll"), wherever the scroll was before the page and however the visit began; by any other way (the
 *   header's name, any link to the home) it puts the story at the home, 0, a deliberate "to the top" (Ruling 29); the
 *   phase follows it;
 * - any other location leaves a page phase for the phase the scroll is in. A scene that is not on a page
 *   (loading, or already on the scroll) is left alone: the scroll and the scene's own events own those.
 * Every navigation lets go of a bead being opened (`frame.focus.opening`): its flight has brought the router to its
 * page, or the visit went elsewhere meanwhile, and its page asks for the close view from here on.
 *
 * A direct load of a page takes LOADING straight to that page's phase, and the scene's `LOADED` is then ignored
 * (it applies from LOADING only): leaving LOADING does not mean the scene's assets are ready.
 *
 * `navigationType` is the router's (`useNavigationType`). A `REPLACE` that replaces the entry the document
 * loaded on moves `loadedOn` to the entry's new key, so `arrivedDirectly()` stays true. Without a type the
 * navigation counts as a push.
 */
export function syncRoute(location: { pathname: string; key: string; state?: unknown }, navigationType?: NavigationType): void {
  if (loadedOn === null || (navigationType === NavigationType.Replace && shown === loadedOn)) loadedOn = location.key;
  shown = location.key;
  frame.focus.opening = null;

  const { phase, dispatch } = useScene.getState();
  const own = phaseForPath(location.pathname);
  if (own) {
    if (!samePhase(phase, own)) dispatch({ type: 'ROUTE', phase: own });
  } else if (phase.kind === 'PROJECT_FOCUS') {
    const project = projects.byId(phase.id);
    if (project && routeFromPath(location.pathname) === PAGES.home) {
      const back = navigationType === NavigationType.Pop || isBackState(location.state);
      placeStory(back ? stopForProject(project.id) : 0);
    }
    dispatch({ type: 'ROUTE', phase: phaseFromScroll() });
  }
}

/** Syncs the scene's phase to the URL after every navigation, the first load included. */
export function useRouteSync(): void {
  const { pathname, key, state } = useLocation();
  const navigationType = useNavigationType();
  useEffect(() => {
    // The entry's state comes with its key (a new state is a new entry), so the key stands for it here.
    syncRoute({ pathname, key, state }, navigationType);
  }, [pathname, key, navigationType]);
}
