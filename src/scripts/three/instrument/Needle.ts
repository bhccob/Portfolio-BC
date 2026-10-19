import * as THREE from 'three';
import { DIAL } from './dialSpec';
import type { InstrumentMaterials } from './materials';

/**
 * The needle: a slender lozenge, diamond in section, its tip half signal
 * yellow and glowing, its tail half brass, built pointing at −Z (north) and
 * turned about its pin by `rotation.y = −bearing`, which puts the tip at
 * (sin b, −cos b) as the dial frame has it. It rests at y 0.05 on a brass pin
 * standing up from the pool's floor; `lift` raises it by up to 0.05 and fades
 * both halves and the pin to 0.15, uncovering the pool.
 */

/** The needle's centre above the face, how far a full lift raises it, and how faint it is then. */
export const NEEDLE = { y: 0.05, lift: 0.05, faded: 0.15 } as const;

export interface Needle {
  /** Turns with the bearing and lifts; holds the two halves and the hub. */
  group: THREE.Group;
  /** The pin it turns on, from the pool's floor up to the needle at rest; it neither turns nor lifts, but fades with the needle. */
  pin: THREE.Mesh;
  pose(bearing: number, lift: number): void;
}

/**
 * One half of the lozenge: four flat faces from the apex at `z` to the
 * diamond round the pin (half-width w, half-height h), wound to face out.
 */
function half(z: number, w: number, h: number): THREE.BufferGeometry {
  const apex = [0, 0, z];
  const right = [w, 0, 0];
  const up = [0, h, 0];
  const left = [-w, 0, 0];
  const down = [0, -h, 0];
  // Round the diamond; the tail half takes each pair the other way round, so both halves' faces look outward.
  const ring = [up, right, down, left];
  const faces: number[] = [];
  for (let i = 0; i < 4; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % 4];
    faces.push(...apex, ...(z < 0 ? a : b), ...(z < 0 ? b : a));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(faces, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function buildNeedle(m: InstrumentMaterials): Needle {
  const { tip, tail, width, height, pin: pinRadius } = DIAL.needle;
  const group = new THREE.Group();
  group.name = 'compass:needle';

  const tipHalf = new THREE.Mesh(half(-tip, width / 2, height / 2), m.needleTip);
  tipHalf.name = 'compass:needle-tip';
  const tailHalf = new THREE.Mesh(half(tail, width / 2, height / 2), m.needleTail);
  tailHalf.name = 'compass:needle-tail';
  // The hub over the pin, a little proud of the lozenge, in the tail's brass so it fades with the needle.
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(pinRadius, pinRadius, height + 0.004, 32), m.needleTail);
  hub.name = 'compass:needle-hub';
  group.add(tipHalf, tailHalf, hub);

  const pinHeight = NEEDLE.y + DIAL.poolDepth;
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(pinRadius * 0.6, pinRadius * 0.6, pinHeight, 16), m.pin);
  pin.position.y = NEEDLE.y - pinHeight / 2;
  pin.name = 'compass:pin';

  const pose = (bearing: number, lift: number): void => {
    group.rotation.y = -bearing;
    group.position.y = NEEDLE.y + NEEDLE.lift * lift;
    const opacity = 1 + (NEEDLE.faded - 1) * lift;
    m.needleTip.opacity = opacity;
    m.needleTail.opacity = opacity;
    m.pin.opacity = opacity;
  };
  pose(0, 0);

  return { group, pin, pose };
}
