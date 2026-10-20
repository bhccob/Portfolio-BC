import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { countryFromRoute } from '~/data/directions';
import { PAGES, type PageId } from '~/data/pages';
import { projects } from '~/data/projects';
import { routeFromPath } from '~/i18n/locale';
import { type Locale, Translator } from '~/i18n/Translator';
import { chapterAt, HOME_CHAPTERS } from './chapters';
import { frame } from './frame';
import { type Phase, samePhase, transition } from './machine';
import { useScene } from './store';

/**
 * The phase a URL stands for: a country page or a project page. The home page, and every page without a
 * scene (Lite, contact, not found), have none of their own, so it gives null and the scroll decides.
 * It reads the page the way the router does, so a real page under another spelling (`/About/China/`) is not one.
 */
export function phaseForPath(pathname: string): Phase | null {
  const route = routeFromPath(pathname);
  const dir = countryFromRoute(route);
  if (dir) return { kind: 'COUNTRY_PAGE', dir };
  const project = projects.byRoute(route);
  if (project) return { kind: 'PROJECT_FOCUS', id: project.id };
  return null;
}

/** The page of a phase, in a locale, or null for the phases that are not a page (they live on the home page). */
export function pathForPhase(phase: Phase, locale: Locale): string | null {
  switch (phase.kind) {
    case 'COUNTRY_PAGE': {
      const page: PageId = `about-${phase.dir}`;
      return Translator.pathFor(locale, PAGES[page]);
    }
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

// ---------------------------------------------------------------- where the visit began

/** The history entry (its router key) the document was loaded on; set by the first sync. */
let loadedOn: string | null = null;
/** The history entry being shown. */
let shown: string | null = null;

/**
 * True when the page being shown is the one the visit began on: the document was loaded on this history
 * entry, so no client-side navigation came before it. It is true again after navigating away and back to
 * that entry, and after a reload (the document loads on whichever entry was open).
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

/** The phase the scroll is in, the one the home page shows at the current progress. */
function phaseFromScroll(): Phase {
  const at = chapterAt(HOME_CHAPTERS, frame.progress, { index: frame.chapterIndex });
  return transition({ kind: 'HOME_IDLE' }, { type: 'CHAPTER', chapter: at.id, category: at.category });
}

/**
 * Brings the scene's phase in line with the location the router now shows:
 * - a country or project page gives its phase, unless the scene is already in it (a language switch keeps
 *   the phase and its transition);
 * - any other location leaves a page phase for the phase the scroll is in. A scene that is not on a page
 *   (loading, or already on the scroll) is left alone: the scroll and the scene's own events own those.
 */
export function syncRoute(location: { pathname: string; key: string }): void {
  if (loadedOn === null) loadedOn = location.key;
  shown = location.key;

  const { phase, dispatch } = useScene.getState();
  const own = phaseForPath(location.pathname);
  if (own) {
    if (!samePhase(phase, own)) dispatch({ type: 'ROUTE', phase: own });
  } else if (phase.kind === 'COUNTRY_PAGE' || phase.kind === 'PROJECT_FOCUS') {
    dispatch({ type: 'ROUTE', phase: phaseFromScroll() });
  }
}

/** Syncs the scene's phase to the URL after every navigation, the first load included. */
export function useRouteSync(): void {
  const { pathname, key } = useLocation();
  useEffect(() => {
    syncRoute({ pathname, key });
  }, [pathname, key]);
}
