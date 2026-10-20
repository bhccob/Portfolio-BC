/**
 * How long the scene may take, from the moment SceneHost decides to mount it (its chunk to download, the compass to
 * build, its textures to settle or be waited for, its canvases to paint and its programs to compile) before the page
 * gives up on it and falls back to the poster, ms of the page being visible (visibleTimeout). The textures wait 7 s at
 * most (Compass); painting and compiling take a second or two on a slow machine: 12 s is a scene that is not coming.
 */
export const LOAD_TIMEOUT_MS = 12_000;

/** How long a lost WebGL context may stay lost before the page falls back to the poster, ms of the page being visible. */
export const RESTORE_TIMEOUT_MS = 4_000;

/** As much of `document` as a visible-time timer reads. */
export interface VisibilitySource {
  readonly visibilityState: DocumentVisibilityState;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

/**
 * Calls `expire` once the page has been visible for `ms`, all told. The clock stops while the page is hidden and goes
 * on with what was left when it shows again: a tab opened in the background (a middle click) runs no animation frames,
 * so the scene cannot paint or draw there, and the time it waits is not the scene's to answer for. Answers its cancel;
 * either way it lets go of its listener.
 */
export function visibleTimeout(ms: number, expire: () => void, doc: VisibilitySource = document): () => void {
  let left = ms;
  let since = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let over = false;

  const pause = (): void => {
    if (timer === undefined) return;
    clearTimeout(timer);
    timer = undefined;
    left -= Date.now() - since;
  };
  const run = (): void => {
    if (over || timer !== undefined) return;
    since = Date.now();
    timer = setTimeout(() => {
      timer = undefined;
      end();
      expire();
    }, Math.max(0, left));
  };
  const changed = (): void => (doc.visibilityState === 'hidden' ? pause() : run());
  const end = (): void => {
    over = true;
    doc.removeEventListener('visibilitychange', changed);
  };

  doc.addEventListener('visibilitychange', changed);
  changed();
  return () => {
    pause();
    end();
  };
}
