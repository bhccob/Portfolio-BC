import * as THREE from 'three';
import { HUB_LAYERS, hubPoseAt, type HubLayerId, type HubPose } from '../HubChoreography';
import { applyTextures, createMaterials, type DeviceMaterials } from './materials';
import { canPaint, mono, paintDisplay, paintPowerIcon } from './print';
import { band, type Outline } from './shapes';
import { DEVICE } from './hardware';
import { buildFrame, FRAME_HEIGHT } from './Frame';
import { buildScreen, DISPLAY, GLASS, GLASS_THICKNESS } from './Screen';
import { BOARD, BOARD_THICKNESS, buildBoard } from './Board';
import { buildBattery, FLEX_LANDING, POUCH, POUCH_TOP } from './Battery';
import { BACK_THICKNESS, buildBackPlate } from './BackPlate';
import type { DeviceTextures } from './textures';

export { PROJECT_CHIPS } from './Board';

/**
 * The realistic handheld: five layers (screen, frame, board, battery, back)
 * in one group, each layer's origin on its own floor so a pose only moves
 * `position.y`. Built DOM-free (the unit tests run it in node); where a
 * document exists the printed and lit surfaces are painted on canvases, and
 * the image textures are swapped in by `setTextures` when they arrive.
 */
export interface HandheldModel {
  group: THREE.Group;
  layers: Record<HubLayerId, THREE.Object3D>;
  /** PROJECT_CHIPS order, `userData.slug` set, children of layers.board, raycastable. */
  chips: THREE.Mesh[];
  /** `userData.slug` = 'bc-2006', not among the chips. */
  processor: THREE.Mesh;
  /** On the frame's +X end face. */
  powerButton: THREE.Mesh;
  /** Each layer to its height; the flex between board and battery and the frame's standoffs follow. */
  applyPose(pose: HubPose): void;
  /** A gold rim round that layer, none round the rest. */
  setHighlight(layer: HubLayerId | null): void;
  /** Swaps in the image maps that have arrived; safe to call more than once. */
  setTextures(textures: DeviceTextures): void;
  /** Frees every geometry, material and texture the model holds, the image textures handed to it included. */
  dispose(): void;
}

/** The highlight rim: a fine band just outside each layer's outline, at its top. */
const RIM_INNER = 0.004;
const RIM_OUTER = 0.014;

const RIMS: Record<HubLayerId, { outline: Outline; y: number }> = {
  screen: { outline: GLASS, y: GLASS_THICKNESS },
  frame: { outline: DEVICE, y: FRAME_HEIGHT },
  board: { outline: BOARD, y: BOARD_THICKNESS },
  battery: { outline: POUCH, y: POUCH_TOP + 0.003 },
  back: { outline: DEVICE, y: BACK_THICKNESS }
};

export function buildHandheld(textures?: DeviceTextures, labels?: Readonly<Record<string, string>>): HandheldModel {
  const materials: DeviceMaterials = createMaterials();
  const group = new THREE.Group();
  group.name = 'handheld';

  const screen = buildScreen(materials);
  const frame = buildFrame(materials);
  const board = buildBoard(materials, labels ?? {});
  const battery = buildBattery(materials);
  const back = buildBackPlate(materials);
  const layers: Record<HubLayerId, THREE.Object3D> = {
    screen: screen.object,
    frame: frame.object,
    board: board.object,
    battery: battery.object,
    back: back.object
  };
  HUB_LAYERS.forEach((id) => group.add(layers[id]));

  // The lit surfaces, where a canvas can be painted.
  const owned = new Set<THREE.Texture>();
  const redraws: (() => void)[] = [board.redraw, back.redraw];
  if (canPaint()) {
    const display = paintDisplay(DISPLAY.width / DISPLAY.depth, 0.055, DISPLAY.radius / DISPLAY.depth);
    materials.display.emissiveMap = display.texture;
    materials.display.emissive.set(0xffffff);
    materials.display.emissiveIntensity = 1;
    redraws.push(display.draw);
    const icon = paintPowerIcon();
    materials.power.emissiveMap = icon;
    materials.power.emissive.set(0xffffff);
    materials.power.emissiveIntensity = 1.25;
  }

  let disposed = false;
  // Paint the type again once Martian Mono has loaded (canvas text does not wait for it).
  if (canPaint() && typeof document.fonts?.load === 'function') {
    document.fonts
      .load(mono(64))
      .then(() => {
        if (!disposed) redraws.forEach((draw) => draw());
      })
      .catch(() => {});
  }

  // A rim per layer, hidden until highlighted.
  const rims = {} as Record<HubLayerId, THREE.Mesh>;
  HUB_LAYERS.forEach((id) => {
    const rim = new THREE.Mesh(band(RIMS[id].outline, RIM_INNER, RIM_OUTER), materials.rim);
    rim.position.y = RIMS[id].y + 0.0005;
    rim.visible = false;
    rim.renderOrder = 2;
    rim.raycast = () => {};
    rim.name = `${id}:rim`;
    layers[id].add(rim);
    rims[id] = rim;
  });

  const applyPose = (pose: HubPose): void => {
    HUB_LAYERS.forEach((id) => (layers[id].position.y = pose.offsets[id]));
    frame.setStandoffs(pose.offsets.frame - (pose.offsets.back + BACK_THICKNESS));
    board.setFlex(pose.offsets.battery + FLEX_LANDING.y - pose.offsets.board, FLEX_LANDING.z);
  };

  const setHighlight = (layer: HubLayerId | null): void => {
    HUB_LAYERS.forEach((id) => (rims[id].visible = id === layer));
  };

  const setTextures = (next: DeviceTextures): void => {
    if (disposed) return;
    for (const texture of [next.pcb, next.battery, next.aluminium]) if (texture) owned.add(texture);
    applyTextures(materials, next);
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    const geometries = new Set<THREE.BufferGeometry>();
    const used = new Set<THREE.Material>(Object.values(materials));
    group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) geometries.add(mesh.geometry);
      if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => used.add(material));
      if ((object as THREE.InstancedMesh).isInstancedMesh) (object as THREE.InstancedMesh).dispose();
    });
    geometries.forEach((geometry) => geometry.dispose());
    used.forEach((material) => {
      for (const value of Object.values(material)) if ((value as THREE.Texture | null)?.isTexture) owned.add(value as THREE.Texture);
      material.dispose();
    });
    owned.forEach((texture) => texture.dispose());
    group.removeFromParent();
  };

  if (textures) setTextures(textures);
  applyPose(hubPoseAt(0));

  return {
    group,
    layers,
    chips: board.chips,
    processor: board.processor,
    powerButton: frame.powerButton,
    applyPose,
    setHighlight,
    setTextures,
    dispose
  };
}
