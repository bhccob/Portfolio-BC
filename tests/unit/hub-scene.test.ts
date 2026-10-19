import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildHandheld } from '../../src/scripts/three/device/Handheld';
import { HUB_LAYERS } from '../../src/scripts/three/HubChoreography';
import { layerOf, onCanvas } from '../../src/scripts/three/HubScene';

describe('onCanvas', () => {
  it('counts nothing as on a canvas that has no size yet, not even its {0, 0} corner', () => {
    expect(onCanvas(0, 0, 0, 0, 0)).toBe(false);
    expect(onCanvas(0, 0, 0, 640, 0)).toBe(false);
    expect(onCanvas(0, 0, 0, 0, 480)).toBe(false);
  });

  it('counts a point in front of the camera and inside the canvas, edges included', () => {
    expect(onCanvas(320, 240, 0.5, 640, 480)).toBe(true);
    expect(onCanvas(0, 0, 0, 640, 480)).toBe(true);
    expect(onCanvas(640, 480, 0, 640, 480)).toBe(true);
  });

  it('leaves out points off the canvas, behind the camera or past the far plane', () => {
    expect(onCanvas(-1, 240, 0, 640, 480)).toBe(false);
    expect(onCanvas(641, 240, 0, 640, 480)).toBe(false);
    expect(onCanvas(320, -1, 0, 640, 480)).toBe(false);
    expect(onCanvas(320, 481, 0, 640, 480)).toBe(false);
    expect(onCanvas(320, 240, -1.2, 640, 480)).toBe(false);
    expect(onCanvas(320, 240, 1.2, 640, 480)).toBe(false);
  });
});

describe('layerOf', () => {
  const model = buildHandheld();

  it('answers each layer for the layer itself and for any part inside it', () => {
    for (const id of HUB_LAYERS) {
      expect(layerOf(model, model.layers[id])).toBe(id);
      model.layers[id].traverse((part) => expect(layerOf(model, part)).toBe(id));
    }
  });

  it('walks up from parts without a slug, such as a chip\'s instanced leads', () => {
    const leads = model.chips[0].children.find((child) => (child as THREE.InstancedMesh).isInstancedMesh && !child.userData.slug);
    expect(leads).toBeDefined();
    expect(layerOf(model, leads!)).toBe('board');
    expect(layerOf(model, model.powerButton)).toBe('frame');
    expect(layerOf(model, model.processor)).toBe('board');
  });

  it('answers null for anything outside the device, and for nothing', () => {
    expect(layerOf(model, new THREE.Mesh())).toBeNull();
    expect(layerOf(model, model.group)).toBeNull();
    expect(layerOf(model, null)).toBeNull();
  });
});
