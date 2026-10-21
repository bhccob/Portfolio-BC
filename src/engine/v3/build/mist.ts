/**
 * The low mist of the v3 scenes as three.js objects: a few large, soft puffs
 * of violet smoke drifting over the board, thick in the loader ("very dark
 * and cloudy", spec §2.1) and thin at home, where only slow things move. Its
 * texture is the studio's smoke (src/engine/studio/noise.ts), made on the CPU
 * with no canvas, so the node tests build it. No React: the Opening (Task
 * 12a) owns it and advances its time on every frame drawn.
 */
import * as THREE from 'three';
import { smokeTexture } from '~/engine/studio/noise';
import { palette } from '~/engine/palette';

/**
 * How the mist looks and drifts, in the dial's frame and world units.
 *
 * - `colour`: the palette's violet, added to what is behind (additive), so
 *   the mist lifts the dark into a haze and never darkens a light.
 * - `puffs`: each sprite's resting place round the chip and the compass (low,
 *   over the board, so the loader's close shot looks through them and the
 *   home's low one along them), its width (`size`; its height is `flatten` of
 *   that, a layer more than a ball), its opacity at density 1 (all very low)
 *   and its slow turn in radians a second.
 * - `sway`: how far a puff wanders along x and z, at `pace` radians a second,
 *   about a minute and a half a sway: too slow to watch, enough to be alive.
 * - `home`: the density the home shows; the loader shows 1.
 */
export const MIST_LOOK = {
  colour: palette.violet,
  puffs: [
    { at: [-0.55, 0.12, 0.25], size: 1.6, opacity: 0.2, spin: 0.012 },
    { at: [0.6, 0.2, -0.15], size: 1.9, opacity: 0.18, spin: -0.009 },
    { at: [-0.1, 0.32, -0.75], size: 2.6, opacity: 0.16, spin: 0.007 },
    { at: [0.3, 0.06, 0.7], size: 1.4, opacity: 0.14, spin: -0.011 }
  ],
  flatten: 0.6,
  sway: [0.12, 0.08],
  pace: 0.07,
  home: 0.35
} as const;

/**
 * The mist group's draw order: after the laser's (LASER_RENDER_ORDER, 1) and
 * everything at the default, so the haze lies over the probe, the beam and
 * the glass rather than under them.
 */
export const MIST_RENDER_ORDER = 2;

/** The mist as the scene holds it. */
export interface MistModel {
  /** `mist`: the puffs, sprites facing the camera, in the dial's frame. */
  group: THREE.Group;
  /** Drifts and turns the puffs to where they are at `seconds` (NaN reads as 0); the same time is the same picture. */
  setTime(seconds: number): void;
  /** How thick the mist is, 0..1 (NaN reads as 0): 1 in the loader, MIST_LOOK.home at home. */
  setDensity(level: number): void;
  /** Frees the materials and the smoke texture; the sprites' quad is three's own. */
  dispose(): void;
}

/** `x` held to [0, 1]; NaN reads as 0. */
function clamp01(x: number): number {
  return x > 0 ? (x < 1 ? x : 1) : 0;
}

/**
 * Builds the mist at density 1, as the loader opens, at time 0. The sprites
 * test no depth: a puff is large and lies across the board and the chip, and
 * cut by them it would show their edges as hard lines through the haze.
 */
export function buildMist(): MistModel {
  const look = MIST_LOOK;
  const group = new THREE.Group();
  group.name = 'mist';
  group.renderOrder = MIST_RENDER_ORDER;
  const texture = smokeTexture(128, 27);

  const sprites = look.puffs.map((puff, i) => {
    const material = new THREE.SpriteMaterial({
      name: `mist:${i}`,
      map: texture,
      color: look.colour,
      opacity: puff.opacity,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      fog: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.name = `mist:${i}`;
    sprite.scale.set(puff.size, puff.size * look.flatten, 1);
    sprite.raycast = () => {};
    group.add(sprite);
    return sprite;
  });

  // Both run every frame the scene draws: indexed loops, so they make no closure.
  const setTime = (seconds: number): void => {
    const t = Number.isFinite(seconds) ? seconds : 0;
    for (let i = 0; i < sprites.length; i++) {
      const puff = look.puffs[i];
      sprites[i].material.rotation = i * 1.9 + t * puff.spin;
      sprites[i].position.set(
        puff.at[0] + Math.sin(t * look.pace + i * 2.1) * look.sway[0],
        puff.at[1],
        puff.at[2] + Math.cos(t * look.pace * 0.8 + i * 1.3) * look.sway[1]
      );
    }
  };
  setTime(0);

  return {
    group,
    setTime,
    setDensity(level) {
      const density = clamp01(level);
      for (let i = 0; i < sprites.length; i++) sprites[i].material.opacity = look.puffs[i].opacity * density;
    },
    dispose() {
      for (const sprite of sprites) sprite.material.dispose();
      texture.dispose();
    }
  };
}
