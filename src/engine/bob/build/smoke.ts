/**
 * The low violet smoke over the glass as three.js objects: layers of large,
 * soft, flat puffs from the front of the scene to the back, drifting too
 * slowly to watch (spec §2: "low violet smoke drifts over it"; §6: layered
 * soft textures in place of the preview's volume). It ports v3's mist
 * (milestone 2's build/mist.ts) to the preview's smoke box (`bob_smoke` in
 * tools/blender/bob_build.py: 30 by 26 by 1.7 over the glass). Its texture is
 * the studio's smoke (~/engine/studio/noise), made on the CPU with no canvas,
 * so the node tests build it. No React: the Opening (src/scene/bob/Opening.tsx)
 * owns it and drifts it through the loader, and the Home (Home.tsx there)
 * drifts it with the home's idle motion.
 */
import * as THREE from 'three';
import { random, smokeTexture } from '~/engine/studio/noise';
import { palette } from '~/engine/palette';
import { lowerTier, type QualityTier } from '~/engine/quality';

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
   * Steps the smoke down to `tier`'s (the quality ladder's step, Ruling 25), as a smoke built for it would be: on
   * the low tier it sheds every other layer from the front, taking those puffs out of the group and freeing their
   * materials; the others keep their places, so the haze thins where it was. A tier above the one it stands at
   * changes nothing: the ladder never climbs back within a page view.
   */
  setTier(tier: QualityTier): void;
  /** Frees the materials and the smoke texture; the sprites' quad is three's own. */
  dispose(): void;
}

/** One puff: where it rests, its size and opacity, and its phases round the period. */
interface Puff {
  layer: number;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  opacity: number;
  /** 0 or a half turn, so neighbours do not show the same billow the same way up; never more, so a layer stays level. */
  rotation: number;
  phase: [x: number, z: number, breathe: number];
}

/** `x` held to [0, 1]; NaN reads as 0. */
function clamp01(x: number): number {
  return x > 0 ? (x < 1 ? x : 1) : 0;
}

/** `a` and `b` mixed: `a` at `t` = 0 and `b` at `t` = 1. */
function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Every puff of the full set, seeded. Each layer's depth is fixed and its
 * puffs share out the width between them, each somewhere in its own share, so
 * the smoke covers the box without lumps or gaps; a puff's sway is taken off
 * the box's edges first, so it never drifts out.
 */
function puffs(): Puff[] {
  const look = SMOKE_LOOK;
  const next = random(look.seed);
  const front = look.box.z[0] - look.sway.z;
  const back = look.box.z[1] + look.sway.z;
  const reach = look.box.x - look.sway.x;
  const top = look.box.y[1] - look.box.y[0];
  const out: Puff[] = [];
  for (let layer = 0; layer < look.layers; layer++) {
    const z = mix(front, back, layer / (look.layers - 1));
    for (let j = 0; j < look.puffs; j++) {
      const height = mix(look.height[0], look.height[1], next());
      out.push({
        layer,
        x: -reach + ((j + 0.2 + 0.6 * next()) / look.puffs) * 2 * reach,
        y: look.box.y[0] + height / 2 + next() * (top - height),
        z,
        width: mix(look.width[0], look.width[1], next()),
        height,
        opacity: mix(look.opacity[0], look.opacity[1], next()),
        rotation: next() < 0.5 ? 0 : Math.PI,
        phase: [next() * 2 * Math.PI, next() * 2 * Math.PI, next() * 2 * Math.PI]
      });
    }
  }
  return out;
}

/**
 * Builds the smoke for `tier` at density 1, at time 0. The puffs test depth
 * and write none: the compass and the probe hide the haze behind them, and
 * the haze in front lies over them; no puff reaches under the glass or into
 * the compass, so none is cut by them into a hard line. They are kept out of
 * the fog, which would add its colour to an additive puff rather than fade it.
 */
export function buildSmoke(tier: QualityTier): SmokeModel {
  const look = SMOKE_LOOK;
  const group = new THREE.Group();
  group.name = 'smoke';
  group.renderOrder = SMOKE_RENDER_ORDER;
  const texture = smokeTexture(128, 27);
  const colour = new THREE.Color(look.colour).multiplyScalar(look.dim);
  /** Whether a tier keeps a puff: the low tier, every other layer from the front. */
  const keeps = (on: QualityTier, puff: Puff): boolean => on !== 'low' || puff.layer % 2 === 0;
  let standing: QualityTier = tier;
  let kept = puffs().filter((puff) => keeps(tier, puff));
  const omega = (2 * Math.PI) / look.period;

  let sprites = kept.map((puff, i) => {
    const material = new THREE.SpriteMaterial({
      name: `smoke:${i}`,
      map: texture,
      color: colour,
      opacity: puff.opacity,
      rotation: puff.rotation,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      fog: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.name = `smoke:${i}`;
    sprite.scale.set(puff.width, puff.height, 1);
    sprite.userData.layer = puff.layer;
    sprite.raycast = () => {};
    group.add(sprite);
    return sprite;
  });

  let density = 1;
  let seconds = 0;

  // Run on every frame the scene draws: an indexed loop and indexed reads, so it makes no iterator.
  const pose = (): void => {
    const turn = omega * seconds;
    for (let i = 0; i < sprites.length; i++) {
      const puff = kept[i];
      const phase = puff.phase;
      sprites[i].position.set(puff.x + Math.sin(turn + phase[0]) * look.sway.x, puff.y, puff.z + Math.sin(turn + phase[1]) * look.sway.z);
      // Down by at most `breathe` of the puff's opacity and back, twice round the period.
      const breath = 1 - look.breathe * 0.5 * (1 - Math.sin(2 * turn + phase[2]));
      sprites[i].material.opacity = puff.opacity * breath * density;
    }
  };
  pose();

  return {
    group,
    setDensity(level) {
      density = clamp01(level);
      pose();
    },
    setTime(time) {
      seconds = Number.isFinite(time) ? time : 0;
      pose();
    },
    setTier(next) {
      const to = lowerTier(standing, next);
      if (to === standing) return;
      standing = to;
      const stay = kept.map((puff) => keeps(to, puff));
      for (let i = 0; i < sprites.length; i++) {
        if (stay[i]) continue;
        group.remove(sprites[i]);
        sprites[i].material.dispose();
      }
      sprites = sprites.filter((_, i) => stay[i]);
      kept = kept.filter((_, i) => stay[i]);
      pose();
    },
    dispose() {
      for (const sprite of sprites) sprite.material.dispose();
      texture.dispose();
    }
  };
}
