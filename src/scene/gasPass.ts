import { Pass } from 'postprocessing';
import type * as THREE from 'three';
import type { DepthPackingStrategies } from 'three';

/**
 * The gas's pass (src/engine/bob/build/volume.ts), from the Void that builds it to the post chain that runs it
 * (./Effects.tsx). The chain holds one slot for it from its start, after the scene is drawn and before the bloom, and the
 * Void hands the gas into that slot once it is built and takes it back when it frees it. So the gas coming and going
 * never changes the chain's passes: the chain adds a pass only as it is made, never while the context is lost (adding
 * one reads the context's attributes, which are null then).
 */
let held: Pass | null = null;
let depth: THREE.Texture | null = null;
let depthPacking: DepthPackingStrategies | undefined;
let size: [number, number] | null = null;

/** How the gas is marched, as the quality ladder has it now (src/engine/quality.ts): null, none. */
export type GasQuality = { scale: number; steps: number } | null;
let quality: GasQuality = null;
let asked = false;

/** A pass that can change how it is marched in place: the gas's. */
type Tunable = Pass & { setQuality?(next: { scale: number; steps: number }): void };

/** Sets how the gas is marched from now on, in place, on the one held and whichever comes after it. Null stands it down. */
export function setGasQuality(next: GasQuality): void {
  quality = next;
  asked = true;
  if (held !== null && next !== null) (held as Tunable).setQuality?.(next);
}

/** The slot: it needs the chain's depth, hands it and the chain's size to the gas held, and runs it; off without one. */
class GasSlot extends Pass {
  constructor() {
    super('GasSlot');
    this.needsDepthTexture = true;
    // On only while it holds a gas that is on (the gas is off at level 0): the chain skips it otherwise.
    Object.defineProperty(this, 'enabled', { get: () => (held?.enabled ?? false) && (!asked || quality !== null), set: () => {}, configurable: true });
  }

  override getDepthTexture(): THREE.Texture {
    return depth as THREE.Texture;
  }

  override setDepthTexture(texture: THREE.Texture, packing?: DepthPackingStrategies): void {
    depth = texture;
    depthPacking = packing;
    held?.setDepthTexture(texture, packing);
  }

  override setSize(width: number, height: number): void {
    size = [width, height];
    held?.setSize(width, height);
  }

  override render(gl: THREE.WebGLRenderer, input: THREE.WebGLRenderTarget | null, output: THREE.WebGLRenderTarget | null, deltaTime?: number, stencilTest?: boolean): void {
    if (held === null) return;
    held.renderToScreen = this.renderToScreen;
    held.render(gl, input, output, deltaTime, stencilTest);
  }
}

/** The gas's slot in the post chain. */
export const GAS_SLOT: Pass = new GasSlot();

/** The gas the slot holds, or none. */
export function gasPass(): Pass | null {
  return held;
}

/**
 * Hands `pass` to the slot, with the chain's depth and size, or takes the held one back with null. With `only`, it is
 * taken back only while `only` is still the one held, so freeing an old gas never drops a newer one.
 */
export function setGasPass(pass: Pass | null, only?: Pass): void {
  if (only !== undefined && held !== only) return;
  held = pass;
  if (pass === null) return;
  if (depth !== null) pass.setDepthTexture(depth, depthPacking);
  if (size !== null) pass.setSize(size[0], size[1]);
  if (quality !== null) (pass as Tunable).setQuality?.(quality);
}
