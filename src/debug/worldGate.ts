/**
 * The proof harness's gate on the hologram world's build (tools/proof/needle.mjs, the steps `void-hold`, `void-fail` and
 * `end-page`): the world is built in code from nothing fetched, so a slow or a broken one cannot be made by holding or
 * failing a file, as the beads' could. Under `?proof` alone (src/scene/bob/Void.tsx asks only then), the harness sets
 * `window[WORLD_GATE]` before the page loads: `'hold'` keeps the build waiting until the gate is cleared, `'fail'` makes
 * it throw, as a world that could not be built does. With no gate the build goes on at once.
 */

/** The page's own property the harness sets: `'hold'`, `'fail'`, or none. */
export const WORLD_GATE = '__needleWorldGate';

/** How often a held build looks at the gate again, ms. */
const LOOK_MS = 50;

/** Waits while the gate says hold; throws if it says fail. */
export async function proofWorldGate(): Promise<void> {
  const page = globalThis as Record<string, unknown>;
  while (page[WORLD_GATE] === 'hold') await new Promise((resolve) => setTimeout(resolve, LOOK_MS));
  if (page[WORLD_GATE] === 'fail') throw new Error('the proof harness failed the world');
}
