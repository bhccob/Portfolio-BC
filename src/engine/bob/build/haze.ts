/**
 * Layered haze as three.js objects: layers of large, soft, flat puffs from the front of a space to its back, drifting
 * too slowly to watch. The low violet smoke over the glass (build/smoke.ts) and the void's mist (build/void.ts) are
 * both this and nothing else; they differ only in the data they hand it: the look, the depth of each layer, which
 * layers a tier keeps, the texture's seed, the draw order, and whether a puff that has faded out is also taken out of
 * the draw. It ports v3's mist (milestone 2's build/mist.ts); its texture is the studio's smoke
 * (~/engine/studio/noise), made on the CPU with no canvas, so the node tests build it. No React.
 *
 * The puffs test depth and write none, and are added to what is behind (additive), so a haze lifts the dark into a
 * mist and never darkens a light. They are kept out of the fog, which would add its colour to an additive puff rather
 * than fade it.
 */
import * as THREE from 'three';
import { lowerTier, type QualityTier } from '~/engine/quality';
import { random, smokeTexture } from '~/engine/studio/noise';

/** `x` held to [0, 1]; NaN reads as 0. */
export function clamp01(x: number): number {
  return x > 0 ? (x < 1 ? x : 1) : 0;
}

/** `a` and `b` mixed: `a` at `t` = 0 and `b` at `t` = 1. */
export function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * How a haze looks and drifts, in metres and seconds (the smoke's and the void's are each documented where they are
 * set, `SMOKE_LOOK` and `VOID_LOOK`).
 * - `colour` and `dim`: the colour of every puff is `colour` times `dim`.
 * - `puffs` to a layer, each somewhere in its own share of the box's width (`box.x`, a half-width) and wholly between
 *   the box's floor and top (`box.y`, floor first). A look may hold more than these: the box's depth, say.
 * - `width` and `height`: each puff's size, ranges. `opacity`: each puff's at level 1, a range.
 * - `sway`: how far a puff wanders along x and z, once round every `period` seconds; `breathe`: the share of its
 *   opacity it loses and regains twice a period. Every motion repeats exactly each `period`.
 * - `seed`: the scatter of the puffs, the same every build.
 */
export interface HazeLook {
  colour: number;
  dim: number;
  puffs: number;
  box: { x: number; y: readonly [floor: number, top: number] };
  width: readonly [number, number];
  height: readonly [number, number];
  opacity: readonly [number, number];
  sway: { x: number; z: number };
  period: number;
  breathe: number;
  seed: number;
}

/**
 * What a haze is made of.
 * - `name`: the group's, and each sprite's and material's is `<name>:<i>` (i counts the sprites a tier keeps).
 * - `depths`: the z of each layer of the full set, front to back; the full set is the layers of the best tier.
 * - `keeps`: whether a tier keeps a layer (of the full set).
 * - `textureSeed`: the seed of the smoke texture the puffs share.
 * - `order`: the group's `renderOrder`, which three sorts ahead of an object's own (its group order).
 * - `level`: how thick it starts, 0..1.
 * - `hideAtZero`: take a puff out of the draw (`visible` off) while the level is 0, rather than draw it at opacity 0.
 *   A puff that is not visible is not compiled either, so a haze that must be warm before it shows leaves it off.
 */
export interface HazeSpec {
  name: string;
  look: HazeLook;
  depths: readonly number[];
  keeps(tier: QualityTier, layer: number): boolean;
  textureSeed: number;
  order: number;
  level: number;
  hideAtZero?: boolean;
}

/** A haze as the scene holds it. */
export interface HazeModel {
  /** `spec.name`: the puffs `<name>:<i>`, sprites facing the camera, each with its layer (of the full set) in `userData.layer`. */
  group: THREE.Group;
  /** How thick the haze is, 0..1 (NaN reads as 0). */
  setLevel(level: number): void;
  /** Drifts the puffs to where they are at `time` seconds (NaN reads as 0); the same time is the same picture. */
  setTime(time: number): void;
  /**
   * Steps the haze down to `tier`'s (the quality ladder's step, Ruling 25), as a haze built for it would be: the layers
   * the tier does not keep are taken out of the group, their materials freed (and the texture, with the last puff);
   * the others keep their places. A tier above the one it stands at changes nothing: the ladder never climbs back
   * within a page view. Answers the tier it now stands at.
   */
  setTier(tier: QualityTier): QualityTier;
  /** Frees the materials and the texture; the sprites' quad is three's own. */
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

/**
 * Every puff of the full set, seeded. Each layer's depth is fixed and its puffs share out the width between them,
 * each somewhere in its own share, so the haze covers the box without lumps or gaps; a puff's sway is taken off the
 * box's edge first, so it never drifts out.
 */
function puffs(look: HazeLook, depths: readonly number[]): Puff[] {
  const next = random(look.seed);
  const reach = look.box.x - look.sway.x;
  const top = look.box.y[1] - look.box.y[0];
  const out: Puff[] = [];
  for (let layer = 0; layer < depths.length; layer++) {
    for (let j = 0; j < look.puffs; j++) {
      const height = mix(look.height[0], look.height[1], next());
      out.push({
        layer,
        x: -reach + ((j + 0.2 + 0.6 * next()) / look.puffs) * 2 * reach,
        y: look.box.y[0] + height / 2 + next() * (top - height),
        z: depths[layer]!,
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

/** Builds the haze `spec` describes for `tier`, at its start level and at time 0. */
export function buildHaze(spec: HazeSpec, tier: QualityTier): HazeModel {
  const { look } = spec;
  const group = new THREE.Group();
  group.name = spec.name;
  group.renderOrder = spec.order;
  let standing: QualityTier = tier;
  let kept = puffs(look, spec.depths).filter((puff) => spec.keeps(tier, puff.layer));
  // A haze that keeps no layer has no texture to make or free.
  let texture: THREE.DataTexture | undefined = kept.length > 0 ? smokeTexture(128, spec.textureSeed) : undefined;
  const colour = new THREE.Color(look.colour).multiplyScalar(look.dim);
  const omega = (2 * Math.PI) / look.period;

  let sprites = kept.map((puff, i) => {
    const material = new THREE.SpriteMaterial({
      name: `${spec.name}:${i}`,
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
    sprite.name = `${spec.name}:${i}`;
    sprite.scale.set(puff.width, puff.height, 1);
    sprite.userData.layer = puff.layer;
    sprite.raycast = () => {};
    group.add(sprite);
    return sprite;
  });

  let level = clamp01(spec.level);
  let seconds = 0;

  // Run on every frame the scene draws: an indexed loop and indexed reads, so it makes no iterator.
  const pose = (): void => {
    const turn = omega * seconds;
    for (let i = 0; i < sprites.length; i++) {
      const puff = kept[i]!;
      const phase = puff.phase;
      sprites[i]!.position.set(puff.x + Math.sin(turn + phase[0]) * look.sway.x, puff.y, puff.z + Math.sin(turn + phase[1]) * look.sway.z);
      // Down by at most `breathe` of the puff's opacity and back, twice round the period.
      const breath = 1 - look.breathe * 0.5 * (1 - Math.sin(2 * turn + phase[2]));
      sprites[i]!.material.opacity = puff.opacity * breath * level;
      if (spec.hideAtZero) sprites[i]!.visible = level > 0;
    }
  };
  pose();

  return {
    group,
    setLevel(next) {
      level = clamp01(next);
      pose();
    },
    setTime(time) {
      seconds = Number.isFinite(time) ? time : 0;
      pose();
    },
    setTier(next) {
      const to = lowerTier(standing, next);
      if (to === standing) return standing;
      standing = to;
      const stay = kept.map((puff) => spec.keeps(to, puff.layer));
      for (let i = 0; i < sprites.length; i++) {
        if (stay[i]) continue;
        group.remove(sprites[i]!);
        sprites[i]!.material.dispose();
      }
      sprites = sprites.filter((_, i) => stay[i]);
      kept = kept.filter((_, i) => stay[i]);
      if (sprites.length === 0) {
        texture?.dispose();
        texture = undefined;
      }
      pose();
      return standing;
    },
    dispose() {
      for (const sprite of sprites) sprite.material.dispose();
      texture?.dispose();
    }
  };
}
