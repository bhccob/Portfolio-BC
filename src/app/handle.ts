// Imported by src/app/routes.ts, which the router's build reads in Node: relative imports only.
import { PAGES, type PageId } from '../data/pages';
import { routeFromPath } from '../i18n/locale';

/**
 * What kind of page the router shows. The styles read it from `<html data-route>`, and each kind's route module is
 * the file named after it (`routes/lite.tsx`).
 */
export type RouteName = 'home' | 'country' | 'project' | 'lite' | 'contact' | 'not-found';

/** What the scene shows for a page: the compass on the home page, a country's arm, a project's object. */
export type SceneKind = 'home' | 'country' | 'project';

/** The `handle` every route module exports; the Shell reads it from the deepest matched route (`useMatches`). */
export interface RouteHandle {
  route: RouteName;
  /**
   * The page's scene, or null for a page of text alone (Lite, contact, not found). SceneHost reads it: a visit that
   * begins on a page without a scene loads no WebGL at all, and a canvas already there sleeps behind it.
   */
  scene: SceneKind | null;
}

/** The one table of the kinds of page and their scenes. Every route module exports its own entry as its `handle`. */
export const HANDLES = {
  home: { route: 'home', scene: 'home' },
  country: { route: 'country', scene: 'country' },
  project: { route: 'project', scene: 'project' },
  lite: { route: 'lite', scene: null },
  contact: { route: 'contact', scene: null },
  'not-found': { route: 'not-found', scene: null },
} as const satisfies { readonly [R in RouteName]: RouteHandle & { route: R } };

/** The kind of every page of the site. `src/app/routes.ts` gives each page the module of its kind, `routes/<kind>.tsx`. */
export const PAGE_KINDS: Readonly<Record<PageId, Exclude<RouteName, 'not-found'>>> = {
  home: 'home',
  'about-china': 'country',
  'about-netherlands': 'country',
  'about-aruba': 'country',
  'project-funcial': 'project',
  'project-jontai-energy': 'project',
  'project-cookies-clicker': 'project',
  lite: 'lite',
  contact: 'contact',
};

const isRouteHandle = (handle: unknown): handle is RouteHandle =>
  typeof handle === 'object' && handle !== null && Object.hasOwn(HANDLES, (handle as { route?: unknown }).route as string);

/** The addresses of the site's pages in either language, as `routeFromPath` gives them: case and all. */
const PAGE_ROUTES: ReadonlySet<string> = new Set(Object.values(PAGES));

/**
 * The handle of the deepest matched route. The root alone (the 404 file, before the router has matched the URL) and a
 * route without a handle of the table are not found: no page, and no scene.
 *
 * So is a page's route matched under another spelling. The host is case-sensitive (GitHub Pages has no /About/China/),
 * and so are the routes, but React Router builds its client routes without `caseSensitive`: in the browser
 * /About/China/ matches the China page's route, whose module then shows the not-found page. Only a page's own
 * address is that page here, so such a URL gets the not-found handle and loads no scene.
 */
export function handleOf(matches: readonly { handle?: unknown; pathname?: string }[]): RouteHandle {
  const match = matches.at(-1);
  const handle = match?.handle;
  if (!isRouteHandle(handle)) return HANDLES['not-found'];
  if (handle.route !== 'not-found' && !PAGE_ROUTES.has(routeFromPath(match?.pathname ?? ''))) return HANDLES['not-found'];
  return handle;
}
