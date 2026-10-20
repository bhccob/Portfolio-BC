import type { SceneKind } from '~/app/handle';

export interface StageGate {
  /** The page has hydrated (SceneHost's `useSyncExternalStore` flag): no Stage before. */
  hydrated: boolean;
  /** 3D is on, read live from the store (see HYDRATION GATING in state/store.ts). */
  threeD: boolean;
  /** The scene of the page shown: its route's `handle.scene` (src/app/handle.ts). */
  scene: SceneKind | null;
  /** A Stage is mounted now. */
  up: boolean;
}

/**
 * Whether the page wants the WebGL Stage. The first Stage waits for a page with a scene: a visit that begins on Lite,
 * contact or the not-found page fetches no Stage chunk, no three.js and no texture. Once a Stage is up it stays from
 * page to page, so the one canvas persists (on a page without a scene it sleeps behind the page). 3D off takes it
 * down, and then it waits for a page with a scene again.
 */
export function stageWanted({ hydrated, threeD, scene, up }: StageGate): boolean {
  return hydrated && threeD && (scene !== null || up);
}
