/**
 * The low violet smoke over the glass as three.js objects: layers of large,
 * soft, flat puffs from the front of the scene to the back, drifting too
 * slowly to watch (spec §2: "low violet smoke drifts over it"; §6: layered
 * soft textures in place of the preview's volume). It ports v3's mist
 * (milestone 2's build/mist.ts) to the preview's smoke box (`bob_smoke` in
 * tools/blender/bob_build.py: 30 by 26 by 1.7 over the glass). The layers, the
 * drift and the tiers are the shared haze (build/haze.ts), which the void's mist
 * is too; what is the smoke's own is here, its look and its box. No React: the
 * Opening (src/scene/bob/Opening.tsx) owns it and drifts it through the loader,
 * and the Home (Home.tsx there) drifts it with the home's idle motion.
 */
import type * as THREE from 'three';
import { buildHaze, mix } from '~/engine/bob/build/haze';
import { palette } from '~/engine/palette';
import type { QualityTier } from '~/engine/quality';

/**
 * How the smoke looks and drifts, in metres and seconds. Task 12 tuned the
 * numbers against the Blender preview's stills under the luminance gate; each
 * change says why.
 *
 * - `colour` and `dim`: the palette's haze times `dim`, added to what is
 *   behind (additive), so the smoke lifts the dark into a haze and never
 *   darkens a light. Task 12: the lilac at 0.2 read as a grey haze; the
 *   preview's smoke is blue-violet (its volume (0.5, 0.36, 0.9), lit by two
 *   violet lights), which the haze token is.
 * - `layers` of `puffs` each, the layers spread evenly from the front of the
 *   `box` to its back (z), the puffs across it (x); every puff lies wholly
 *   between the glass and the box's top (y). The low tier keeps every other
 *   layer from the front, half of them: its haze thins evenly through the box
 *   and gives up the back layer, the farthest and the most fogged, last in
 *   line. The box lies behind the compass (Task 12): the preview's smoke is lit
 *   from far behind it, so it hangs in the distance, in the upper part of every
 *   shot, and nothing of it lies over the compass or the name, the scene's focal
 *   points; the nearest layer stands 8.4 behind the compass's axis, clear of its
 *   bands (1.56).
 * - `width` and `height`: each puff's size, ranges: a layer, far wider than
 *   tall. `opacity`: each puff's at density 1 (all very low).
 * - `sway`: how far a puff wanders along x and z, once round every `period`
 *   seconds; `breathe`: the share of its opacity it loses and regains twice a
 *   period. Every motion repeats exactly each `period`.
 * - `seed`: the scatter of the puffs, the same every build.
 */
export const SMOKE_LOOK = {
  colour: palette.haze,
  dim: 0.7,
  layers: 6,
  puffs: 3,
  box: { x: 15, y: [0, 2.2], z: [-8, -30] },
  width: [6, 11],
  height: [0.8, 1.6],
  opacity: [0.1, 0.18],
  sway: { x: 1.2, z: 0.4 },
  period: 60,
  breathe: 0.25,
  seed: 1021
} as const;

/**
 * The smoke group's draw order: after the glass (-5), the engraving and the
 * compass (0) and the probe (PROBE_RENDER_ORDER, 1), so the haze lies over
 * them rather than under them: v3's mist order.
 */
export const SMOKE_RENDER_ORDER = 2;

/** The smoke as the scene holds it. */
export interface SmokeModel {
  /** `smoke`: the puffs `smoke:<i>`, sprites facing the camera, each with its layer (of the full set) in `userData.layer`. */
  group: THREE.Group;
  /** How thick the smoke is, 0..1 (NaN reads as 0); it builds at 1. */
  setDensity(level: number): void;
  /** Drifts the puffs to where they are at `time` seconds (NaN reads as 0); the same time is the same picture. */
  setTime(time: number): void;
  /**
   * Steps the smoke down to `tier`'s (the quality ladder's step), as a smoke built for it would be: on
   * the low tier it sheds every other layer from the front, taking those puffs out of the group and freeing their
   * materials; the others keep their places, so the haze thins where it was. A tier above the one it stands at
   * changes nothing: the ladder never climbs back within a page view.
   */
  setTier(tier: QualityTier): void;
  /** Frees the materials and the smoke texture; the sprites' quad is three's own. */
  dispose(): void;
}

/**
 * The depth of each layer of the full set: the layers spread evenly from the front of the box to its back, a layer's
 * sway taken off both ends so a puff never drifts out of the box.
 */
function depths(): number[] {
  const look = SMOKE_LOOK;
  const front = look.box.z[0] - look.sway.z;
  const back = look.box.z[1] + look.sway.z;
  return Array.from({ length: look.layers }, (_, layer) => mix(front, back, layer / (look.layers - 1)));
}

/**
 * Builds the smoke for `tier` at density 1, at time 0: a haze (build/haze.ts) of the preview's smoke box. The puffs
 * test depth and write none: the compass and the probe hide the haze behind them, and the haze in front lies over
 * them; no puff reaches under the glass or into the compass, so none is cut by them into a hard line. They are kept
 * out of the fog, which would add its colour to an additive puff rather than fade it. The low tier keeps every other
 * layer from the front.
 */
export function buildSmoke(tier: QualityTier): SmokeModel {
  const haze = buildHaze(
    {
      name: 'smoke',
      look: SMOKE_LOOK,
      depths: depths(),
      keeps: (on, layer) => on !== 'low' || layer % 2 === 0,
      textureSeed: 27,
      order: SMOKE_RENDER_ORDER,
      level: 1
    },
    tier
  );
  return {
    group: haze.group,
    setDensity: haze.setLevel,
    setTime: haze.setTime,
    setTier(next) {
      haze.setTier(next);
    },
    dispose: haze.dispose
  };
}
