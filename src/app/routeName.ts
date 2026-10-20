import { useEffect } from 'react';
import { useMatches } from 'react-router';
import type { PageId } from '~/data/pages';
import { locales } from '~/i18n/Translator';

/** What kind of page the router is showing; the styles read it from `<html data-route>`. */
export type RouteName = 'home' | 'country' | 'project' | 'lite' | 'contact' | 'not-found';

const NAME_OF_PAGE: Record<PageId, RouteName> = {
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

/** The page and the language of every route id `src/app/routes.ts` makes: `${page}-${locale}`. */
const BY_ROUTE_ID = new Map<string, RouteName>(
  (Object.keys(NAME_OF_PAGE) as PageId[]).flatMap((page) => locales.map((locale): [string, RouteName] => [`${page}-${locale}`, NAME_OF_PAGE[page]])),
);

/**
 * The kind of page of a route id (the router's own id for the matched route, so a URL the router does not
 * match, such as a real page under another spelling, is `not-found` here too). An id it does not know,
 * the catch-all's `not-found` among them, and no id at all give `not-found`.
 */
export function routeName(routeId: string | undefined): RouteName {
  return (routeId !== undefined && BY_ROUTE_ID.get(routeId)) || 'not-found';
}

/** The kind of page the router shows now, read from the deepest matched route. */
export function useRouteName(): RouteName {
  const matches = useMatches();
  return routeName(matches[matches.length - 1]?.id);
}

/**
 * Keeps `data-route` on <html> in step with the page, for the styles. It is set in an effect, after hydration
 * (React owns <html> until then), like `data-3d`: the 404 page is one file for every unknown URL, so a value
 * written into the prerendered HTML could not be right for all of them.
 */
export function useRouteAttribute(route: RouteName): void {
  useEffect(() => {
    document.documentElement.setAttribute('data-route', route);
  }, [route]);
}
