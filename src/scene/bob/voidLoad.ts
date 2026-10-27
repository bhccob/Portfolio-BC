/**
 * The Void's load as plain steps (src/scene/bob/Void.tsx runs it with the scene's own), so the tests run the very order
 * it keeps without R3F or a GPU: the void first, at the hand-over, so the light dive has its band, its ring of mist and
 * its dust from its first frame; the hologram world after, as the light falls. Pure; it imports only a type from the store.
 */
import type { VoidState } from '~/state/store';

/** What the load does at each step, the Void's own: build and warm, put in the scene, free, say. */
export interface VoidLoadSteps<V, B> {
  /** Builds the void and warms it, beside the scene; answers it. A throw is the void's failure. */
  buildVoid(): Promise<V>;
  /** Frees a void that was built but is not wanted (the Void went meanwhile). */
  freeVoid(space: V): void;
  /** Puts the void in the scene. */
  onVoid(space: V): void;
  /**
   * Builds the hologram world and warms it, beside the scene; answers it, or null when the Void went meanwhile (it freed
   * it itself). A throw is the world's failure.
   */
  buildWorld(): Promise<B | null>;
  /** Puts the world in the scene. */
  onWorld(world: B): void;
  /** Says where the load stands: the store (the scroll's hold reads it), the debug bridge's journey and `<html data-void>`. */
  say(state: VoidState): void;
  /** Whether the Void has gone (unmounted) since the load began. */
  gone(): boolean;
}

/**
 * Loads the void, then the world: says `loading`; builds the void and puts it in the scene at once; builds the world
 * and puts it in too, saying `ready`. A failure of either is logged as a warning and says `failed`; a void already in
 * the scene stays there, so
 * the light dive keeps its band and its dust, and the scroll holds at the landing (src/scene/bob/landingHold.ts). Once
 * the Void has gone nothing more is said or put in, and a void built after it went is freed.
 */
export async function loadVoid<V, B>(steps: VoidLoadSteps<V, B>): Promise<void> {
  steps.say('loading');
  let space: V;
  try {
    space = await steps.buildVoid();
  } catch (error) {
    if (steps.gone()) return;
    console.warn('[needle] the void could not be built: the scroll holds at the landing', error);
    steps.say('failed');
    return;
  }
  if (steps.gone()) {
    steps.freeVoid(space);
    return;
  }
  steps.onVoid(space);
  try {
    const world = await steps.buildWorld();
    if (world === null || steps.gone()) return;
    steps.onWorld(world);
    steps.say('ready');
  } catch (error) {
    if (steps.gone()) return;
    console.warn('[needle] the world could not be built: the scroll holds at the landing, where the home links show', error);
    steps.say('failed');
  }
}
