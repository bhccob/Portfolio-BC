import { useEffect } from 'react';
import { useMatches } from 'react-router';
import { handleOf, type RouteHandle, type RouteName } from './handle';

export type { RouteName };

/**
 * The handle of the page the router shows now (src/app/handle.ts): its kind, `route`, and its scene, `scene`. It is the
 * deepest matched route's, so a URL the router does not match, such as a real page under another spelling, is
 * `not-found` here too, with no scene.
 */
export function useRouteHandle(): RouteHandle {
  return handleOf(useMatches());
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
