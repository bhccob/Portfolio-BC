import type { Pass } from 'postprocessing';
import { useSyncExternalStore } from 'react';

/**
 * The gas's pass (src/engine/bob/build/volume.ts), from the Void that builds it to the post chain that runs it
 * (./Effects.tsx): the Void hands it over once it is built and takes it back when it frees it; the chain lays it in
 * after the scene is drawn and before the bloom, where it reads the scene's depth.
 */
let held: Pass | null = null;
const listeners = new Set<() => void>();

/** The pass the post chain runs, or none. */
export function gasPass(): Pass | null {
  return held;
}

/**
 * Hands `pass` over, or takes the held one back with null. With `only`, it is taken back only while `only` is still the
 * one held, so freeing an old gas never drops a newer one.
 */
export function setGasPass(pass: Pass | null, only?: Pass): void {
  if (only !== undefined && held !== only) return;
  if (held === pass) return;
  held = pass;
  for (const listener of listeners) listener();
}

/** Calls `listener` on each change of the pass; the returned function stops it. */
export function subscribeGasPass(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The pass the post chain runs, as React state. */
export function useGasPass(): Pass | null {
  return useSyncExternalStore(subscribeGasPass, gasPass, () => null);
}
