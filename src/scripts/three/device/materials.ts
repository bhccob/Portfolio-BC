import * as THREE from 'three';
import { palette } from '../palette';
import type { DeviceTextures } from './textures';
import { EPOXY } from './print';

/**
 * The handheld's finishes, made once per model and shared by every part that
 * wears them (four screws, two layers of anodised metal, five chips: one
 * material each). With no textures every finish is a plain colour; the image
 * maps are swapped in by `applyTextures` when they arrive.
 */

/** Anodised purple, as the reference's frame. */
const ANODISED = 0x5b2d8e;

/**
 * The aluminium texture's mean colour, linear (measured on aluminium.webp).
 * The anodised colour is divided by it, so the tiled map keeps the grain
 * while the average lands on ANODISED.
 */
const ALUMINIUM_MEAN = [0.0784, 0.0179, 0.152] as const;

/** World units per tile of the brushed aluminium. */
export const ALUMINIUM_TILE = 1.6;

export interface DeviceMaterials {
  /** Brushed anodised aluminium: the frame and back plate. */
  anodised: THREE.MeshPhysicalMaterial;
  /** The same metal where the chamfer is cut and polished: brighter, glossier. */
  chamfer: THREE.MeshPhysicalMaterial;
  brass: THREE.MeshPhysicalMaterial;
  gold: THREE.MeshPhysicalMaterial;
  /** Tin-plated leads and the USB-C shell. */
  steel: THREE.MeshStandardMaterial;
  /** Black epoxy: the chips' bodies. */
  epoxy: THREE.MeshStandardMaterial;
  /** Near-black recesses: holes, ports, screw slots, the button bezel. */
  recess: THREE.MeshStandardMaterial;
  /** Dark plastic: the socket frame and connector housings. */
  plastic: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  /** The board's top, printed (pcb.webp). */
  pcb: THREE.MeshStandardMaterial;
  /** The board's edges and underside: solder mask over the FR-4. */
  pcbEdge: THREE.MeshStandardMaterial;
  /** The battery pouch (battery.webp). */
  pouch: THREE.MeshPhysicalMaterial;
  /** Amber Kapton tape round the battery's ends. */
  tape: THREE.MeshPhysicalMaterial;
  /** The flex cable: amber polyimide over gold traces. */
  flex: THREE.MeshPhysicalMaterial;
  wireRed: THREE.MeshStandardMaterial;
  wireBlack: THREE.MeshStandardMaterial;
  /** The battery's white JST connector. */
  nylon: THREE.MeshStandardMaterial;
  /** The lit display under the glass. */
  display: THREE.MeshStandardMaterial;
  /** The power button's lit face. */
  power: THREE.MeshStandardMaterial;
  /** The highlight rim round a layer: additive gold. */
  rim: THREE.MeshBasicMaterial;
  /** A face that is never drawn but still answers rays (the empty socket's floor). */
  pickOnly: THREE.MeshBasicMaterial;
}

/** A fine stripe texture for the flex: gold traces along its length. DOM-free. */
function flexTraces(): THREE.DataTexture {
  const width = 128;
  const data = new Uint8Array(width * 4);
  for (let x = 0; x < width; x++) {
    const trace = x % 5 === 2;
    const edge = x < 5 || x >= width - 5;
    const [r, g, b] = edge ? [92, 50, 12] : trace ? [196, 132, 52] : [120, 66, 16];
    data.set([r, g, b, 255], x * 4);
  }
  const texture = new THREE.DataTexture(data, width, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export function createMaterials(): DeviceMaterials {
  const anodised = new THREE.MeshPhysicalMaterial({
    name: 'anodised',
    color: ANODISED,
    metalness: 0.75,
    roughness: 0.32,
    clearcoat: 0.4,
    clearcoatRoughness: 0.22
  });
  const chamfer = new THREE.MeshPhysicalMaterial({
    name: 'chamfer',
    color: 0x7a45b8,
    metalness: 0.9,
    roughness: 0.16,
    clearcoat: 0.6,
    clearcoatRoughness: 0.08
  });
  return {
    anodised,
    chamfer,
    brass: new THREE.MeshPhysicalMaterial({ name: 'brass', color: 0xc9a24a, metalness: 1, roughness: 0.3 }),
    gold: new THREE.MeshPhysicalMaterial({ name: 'gold', color: palette.gold, metalness: 1, roughness: 0.25 }),
    steel: new THREE.MeshStandardMaterial({ name: 'steel', color: 0xc4c2c8, metalness: 1, roughness: 0.28 }),
    epoxy: new THREE.MeshStandardMaterial({ name: 'epoxy', color: EPOXY, metalness: 0, roughness: 0.55 }),
    recess: new THREE.MeshStandardMaterial({ name: 'recess', color: 0x050307, metalness: 0, roughness: 0.75 }),
    plastic: new THREE.MeshStandardMaterial({ name: 'plastic', color: 0x1a171e, metalness: 0, roughness: 0.5 }),
    glass: new THREE.MeshPhysicalMaterial({
      name: 'glass',
      color: 0x0c0a12,
      metalness: 0,
      roughness: 0.04,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      transparent: true,
      opacity: 0.32,
      envMapIntensity: 1.6
    }),
    pcb: new THREE.MeshStandardMaterial({ name: 'pcb', color: palette.pcb, metalness: 0.15, roughness: 0.42 }),
    pcbEdge: new THREE.MeshStandardMaterial({ name: 'pcb-edge', color: 0x2c1a48, metalness: 0.05, roughness: 0.6 }),
    pouch: new THREE.MeshPhysicalMaterial({ name: 'pouch', color: 0xc9c9cd, metalness: 0.55, roughness: 0.38, clearcoat: 0.3 }),
    tape: new THREE.MeshPhysicalMaterial({
      name: 'tape',
      color: 0xd99a22,
      metalness: 0.25,
      roughness: 0.3,
      clearcoat: 0.7,
      clearcoatRoughness: 0.15
    }),
    flex: new THREE.MeshPhysicalMaterial({
      name: 'flex',
      color: 0xffffff,
      map: flexTraces(),
      metalness: 0.3,
      roughness: 0.38,
      clearcoat: 0.8,
      clearcoatRoughness: 0.12,
      side: THREE.DoubleSide
    }),
    wireRed: new THREE.MeshStandardMaterial({ name: 'wire-red', color: 0xb3261e, roughness: 0.4 }),
    wireBlack: new THREE.MeshStandardMaterial({ name: 'wire-black', color: 0x141216, roughness: 0.4 }),
    nylon: new THREE.MeshStandardMaterial({ name: 'nylon', color: 0xeeeae0, roughness: 0.55 }),
    display: new THREE.MeshStandardMaterial({
      name: 'display',
      color: 0x050308,
      metalness: 0,
      roughness: 0.5,
      emissive: 0x150a24,
      emissiveIntensity: 1
    }),
    power: new THREE.MeshStandardMaterial({
      name: 'power',
      color: 0x3a2a06,
      metalness: 0.2,
      roughness: 0.35,
      emissive: palette.yellow,
      emissiveIntensity: 1.1
    }),
    rim: new THREE.MeshBasicMaterial({
      name: 'rim',
      color: palette.yellow,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    }),
    pickOnly: new THREE.MeshBasicMaterial({ name: 'pick-only', visible: false })
  };
}

/**
 * Swaps in the image maps that have arrived. A map turns its material's plain
 * colour to white (or, for the anodised metal, to the factor that keeps its
 * colour), so the picture shows true. Safe to call more than once; a texture
 * left out keeps whatever is there.
 */
export function applyTextures(m: DeviceMaterials, textures: DeviceTextures): void {
  const { pcb, battery, aluminium } = textures;
  if (pcb) {
    m.pcb.map = pcb;
    m.pcb.bumpMap = pcb;
    m.pcb.bumpScale = 1.2;
    m.pcb.color.set(0xffffff);
    m.pcb.needsUpdate = true;
  }
  if (battery) {
    for (const material of [m.pouch, m.tape]) {
      material.map = battery;
      material.color.set(0xffffff);
      material.needsUpdate = true;
    }
  }
  if (aluminium) {
    // Mirrored, so the tiles meet without a seam (the image is not seamless).
    if (aluminium.wrapS !== THREE.MirroredRepeatWrapping || aluminium.wrapT !== THREE.MirroredRepeatWrapping) {
      aluminium.wrapS = THREE.MirroredRepeatWrapping;
      aluminium.wrapT = THREE.MirroredRepeatWrapping;
      aluminium.needsUpdate = true;
    }
    const target = new THREE.Color(ANODISED);
    m.anodised.color.setRGB(target.r / ALUMINIUM_MEAN[0], target.g / ALUMINIUM_MEAN[1], target.b / ALUMINIUM_MEAN[2], THREE.LinearSRGBColorSpace);
    const polished = new THREE.Color(0x7a45b8);
    m.chamfer.color.setRGB(polished.r / ALUMINIUM_MEAN[0], polished.g / ALUMINIUM_MEAN[1], polished.b / ALUMINIUM_MEAN[2], THREE.LinearSRGBColorSpace);
    for (const material of [m.anodised, m.chamfer]) {
      material.map = aluminium;
      material.bumpMap = aluminium;
      material.bumpScale = material === m.anodised ? 0.35 : 0.12;
      material.needsUpdate = true;
    }
  }
}
