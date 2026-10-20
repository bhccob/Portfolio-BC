/**
 * How long the scene may take, from the moment SceneHost decides to mount it (its chunk to download, the compass to
 * build, its textures to settle or be waited for, its canvases to paint and its programs to compile) before the page
 * gives up on it and falls back to the poster, ms. The textures wait 7 s at most (Compass); painting and compiling
 * take a second or two on a slow machine: 12 s is a scene that is not coming.
 */
export const LOAD_TIMEOUT_MS = 12_000;

/** How long a lost WebGL context may stay lost before the page falls back to the poster, ms. */
export const RESTORE_TIMEOUT_MS = 4_000;
