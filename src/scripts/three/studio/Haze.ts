import * as THREE from 'three';
import { smokeTexture } from './noise';

/**
 * Purple smoke at the sides of the stage: a few large, soft sprites of
 * billowing noise, drawn additively and very faint, turning and swaying
 * slowly. The scene's FogExp2 does the rest of the haze.
 */

export interface Haze {
  group: THREE.Group;
  setTime(seconds: number): void;
  dispose(): void;
}

export const HAZE = {
  color: 0x5a2f9a,
  /** Each puff: where it hangs, its size, how strong, and its slow turn (radians a second). */
  puffs: [
    { at: [-4.8, 0.6, -0.6], size: 8, opacity: 0.48, spin: 0.012 },
    { at: [5.6, 0.7, -4.2], size: 9, opacity: 0.42, spin: -0.009 },
    { at: [-5.2, 0.4, -7.5], size: 12, opacity: 0.36, spin: 0.006 }
  ]
} as const;

export function buildHaze(): Haze {
  const group = new THREE.Group();
  group.name = 'studio:haze';
  const texture = smokeTexture();
  const sprites = HAZE.puffs.map((puff, i) => {
    const material = new THREE.SpriteMaterial({
      name: `studio:haze-${i}`,
      map: texture,
      color: HAZE.color,
      opacity: puff.opacity,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      rotation: i * 1.9
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.fromArray(puff.at);
    sprite.scale.set(puff.size, puff.size * 0.7, 1);
    sprite.renderOrder = 4;
    sprite.raycast = () => {};
    group.add(sprite);
    return sprite;
  });

  const setTime = (seconds: number): void => {
    sprites.forEach((sprite, i) => {
      const puff = HAZE.puffs[i];
      sprite.material.rotation = i * 1.9 + seconds * puff.spin;
      sprite.position.x = puff.at[0] + Math.sin(seconds * 0.05 + i * 2.1) * 0.4;
      sprite.position.y = puff.at[1] + Math.sin(seconds * 0.037 + i) * 0.15;
    });
  };

  const dispose = (): void => {
    sprites.forEach((sprite) => sprite.material.dispose());
    texture.dispose();
    group.removeFromParent();
  };

  return { group, setTime, dispose };
}
