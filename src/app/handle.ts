/** What the scene shows for a page: the compass on the home page, a country's arm, a project's object, or nothing. */
export type SceneKind = 'home' | 'country' | 'project';

/** The `handle` every route module exports; the scene reads it from the matched route (`useMatches`). */
export interface RouteHandle {
  scene: SceneKind | null;
}
