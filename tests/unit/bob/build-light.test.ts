import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { buildLight, LIGHT_LOOK, type LightModel } from '~/engine/bob/build/light';
import { applyCameraShot } from '~/engine/bob/shots';
import { palette } from '~/engine/palette';
import { LANES } from '~/scene/bob/circuit';
import type { LightPose } from '~/scene/bob/journey';
import { lightAt, trailAt, trailLevel, wayShot } from '~/scene/bob/lightDive';

const DESK = 1440 / 900;

/** The light's pose at way frame f, as the journey gives it. */
const poseAt = (f: number, aspect = DESK): LightPose => ({ ...lightAt(f, aspect), trail: trailAt(f, aspect), trailLevel: trailLevel(f) });

/** The camera at way frame f. */
function cameraAt(f: number, aspect = DESK): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 400);
  applyCameraShot(camera, wayShot(f, aspect), aspect);
  camera.updateMatrixWorld(true);
  return camera;
}

function named<T extends THREE.Object3D>(light: LightModel, name: string): T {
  const found = light.group.getObjectByName(name);
  expect(found, name).toBeDefined();
  return found as T;
}

/** A colour's hue and whiteness as its channels over its brightest one: the same for a colour at any strength. */
const tint = (c: THREE.Color): number[] => {
  const top = Math.max(c.r, c.g, c.b);
  return [c.r / top, c.g / top, c.b / top];
};
const GOLDS = [palette.gold, palette.goldLight].map((hex) => tint(new THREE.Color(hex)));
const isGold = (c: THREE.Color): boolean => GOLDS.some((g) => g.every((v, i) => Math.abs(v - tint(c)[i]!) < 1e-6));

/** Every material under the light. */
function materials(light: LightModel): THREE.Material[] {
  const out = new Set<THREE.Material>();
  light.group.traverse((o) => {
    for (const m of [(o as THREE.Mesh).material].flat()) if (m) out.add(m as THREE.Material);
  });
  return [...out];
}

// The falling light as a signal on a chip (spec 2026-10-29-bob-stack-2-design.md, goal 4; the fall mock-up Bob chose,
// `circuit`): a hot point in a square frame with pins, turning slowly, a fine dial round it; its trail five circuit
// traces with vias, pulses running down them into the light.
describe('the light', () => {
  it('builds a hot point in a square frame with pins, and a dial', () => {
    const light = buildLight('high');
    expect(named(light, 'light:body').children.map((o) => o.name)).toEqual(['light:halo', 'light:dial', 'light:frame', 'light:core']);
    // The frame: four corner brackets (two strokes each) and five pins a side.
    const frame = named<THREE.Group>(light, 'light:frame');
    const strokes = frame.children.find((o) => o.name === 'light:frame:lines') as THREE.LineSegments;
    expect(strokes.geometry.getAttribute('position').count / 2).toBe(4 * 2 + 5 * 4);
    // The dial: 72 ticks and 72 dashes (9 of every 12 of 96).
    const dial = named<THREE.Group>(light, 'light:dial').children[0] as THREE.LineSegments;
    expect(dial.geometry.getAttribute('position').count / 2).toBe(72 + 72);
    // Its sizes in its own units, the frame's half-width 1: the mock-up's metres over its 0.62.
    expect(LIGHT_LOOK.dial.radius).toBeCloseTo(1.05 / 0.62, 12);
    expect(LIGHT_LOOK.core.size).toBeCloseTo(2.6 / 0.62, 12);
    for (let k = 0; k < 5; k++) named(light, `light:trace:${k}`);
    named(light, 'light:lamp');
    light.dispose();
  });

  it('is gold only: every colour it draws or lights with is a gold of the palette, none violet nor whiter than gold light', () => {
    const light = buildLight('high');
    light.setPose(poseAt(121), cameraAt(121), 1);
    for (const m of materials(light)) {
      const colour = (m as THREE.MeshBasicMaterial).color;
      if (colour) expect(isGold(colour), `${m.name}: ${colour.getHexString()}`).toBe(true);
      for (const uniform of Object.values(((m as THREE.ShaderMaterial).uniforms ?? {}) as Record<string, THREE.IUniform>)) {
        if ((uniform.value as THREE.Color)?.isColor) expect(isGold(uniform.value as THREE.Color), `${m.name}'s uniform`).toBe(true);
      }
    }
    light.dispose();
  });

  it('places it, sizes it, faces the camera and dims it with its glow (setPose)', () => {
    const light = buildLight('high');
    const pose = poseAt(121);
    const camera = cameraAt(121);
    light.setPose(pose, camera, 0);
    const body = named(light, 'light:body');
    expect(body.position.toArray()).toEqual([...pose.position]);
    expect(body.scale.x).toBeCloseTo(pose.radius, 12);
    expect(body.quaternion.angleTo(camera.quaternion)).toBeLessThan(1e-6);
    expect(body.visible).toBe(true);
    const core = (named<THREE.Sprite>(light, 'light:core').material as THREE.SpriteMaterial).opacity;
    light.setPose({ ...pose, glow: pose.glow * 0.5 }, camera, 0);
    expect((named<THREE.Sprite>(light, 'light:core').material as THREE.SpriteMaterial).opacity).toBeCloseTo(core * 0.5, 9);
    light.dispose();
  });

  it('lays the traces from the pose\'s trail', () => {
    const light = buildLight('high');
    const pose = poseAt(121);
    light.setPose(pose, cameraAt(121), 0);
    for (let k = 0; k < LANES.length; k++) {
      const trace = named<THREE.Mesh>(light, `light:trace:${k}`);
      expect(trace.visible, `trace ${k}`).toBe(true);
      // Laid up the light's upright line, 24 points and a point at each turn of its routing: two triangles a step.
      expect(trace.geometry.drawRange.count, `trace ${k}`).toBeGreaterThanOrEqual(23 * 6);
      expect(trace.geometry.drawRange.count % 6).toBe(0);
    }
    // The middle trace starts at the light: by its frame, within its routing's room across (0.9 of the mock-up's metres).
    const first = named<THREE.Mesh>(light, 'light:trace:0').geometry.getAttribute('position');
    const at = new THREE.Vector3((first.getX(0) + first.getX(1)) / 2, (first.getY(0) + first.getY(1)) / 2, (first.getZ(0) + first.getZ(1)) / 2);
    expect(at.distanceTo(new THREE.Vector3(...pose.position))).toBeLessThan(pose.radius + (0.9 * pose.radius) / 0.62);
    // None with no trail.
    light.setPose({ ...pose, trail: [] }, cameraAt(121), 0);
    expect(named(light, 'light:trace:0').visible).toBe(false);
    light.dispose();
  });

  it('stands its traces straight up from the light, however its tail leans', () => {
    const light = buildLight('high');
    const pose = poseAt(121);
    // A tail leaning far to one side as it rises.
    const leaning = { ...pose, trail: pose.trail.map((p, k) => ({ ...p, point: [p.point[0] + k * 0.05, p.point[1], p.point[2]] as [number, number, number] })) };
    const camera = new THREE.PerspectiveCamera(50, DESK, 0.1, 400);
    camera.position.set(pose.position[0], pose.position[1], pose.position[2] + 5);
    camera.lookAt(pose.position[0], pose.position[1], pose.position[2]);
    camera.updateMatrixWorld(true);
    light.setPose(leaning, camera, 0);
    const trace = named<THREE.Mesh>(light, 'light:trace:0');
    const at = trace.geometry.getAttribute('position');
    const room = pose.radius + (0.9 * pose.radius) / 0.62;
    for (let v = 0; v < trace.geometry.drawRange.count / 3; v++) expect(Math.abs(at.getX(v) - pose.position[0]), `vertex ${v}`).toBeLessThan(room);
    // As tall as the tail.
    const top = Math.max(...pose.trail.map((p) => p.point[1]));
    let highest = -Infinity;
    for (let v = 0; v < at.count; v++) if (v < (trace.geometry.drawRange.count / 6 + 1) * 2) highest = Math.max(highest, at.getY(v));
    expect(highest).toBeCloseTo(top, 1);
    light.dispose();
  });

  it('turns the frame and the dial on the clock', () => {
    const light = buildLight('high');
    light.setPose(poseAt(121), cameraAt(121), 0);
    expect(named(light, 'light:frame').rotation.z).toBe(0);
    light.setPose(poseAt(121), cameraAt(121), 2);
    expect(named(light, 'light:frame').rotation.z).toBeCloseTo(2 * LIGHT_LOOK.frame.turn, 12);
    expect(named(light, 'light:dial').rotation.z).toBeCloseTo(2 * LIGHT_LOOK.dial.turn, 12);
    expect([LIGHT_LOOK.frame.turn, LIGHT_LOOK.dial.turn]).toEqual([0.35, -0.12]);
    light.dispose();
  });

  it('hides at glow 0, and keeps the lamp in the scene at intensity 0, so the light count stays', () => {
    const light = buildLight('high');
    light.setPose({ ...poseAt(121), glow: 0 }, cameraAt(121), 0);
    expect(named(light, 'light:body').visible).toBe(false);
    for (let k = 0; k < LANES.length; k++) expect(named(light, `light:trace:${k}`).visible).toBe(false);
    const lamp = named<THREE.PointLight>(light, 'light:lamp');
    expect(lamp.parent).toBe(light.group);
    expect(lamp.intensity).toBe(0);
    light.dispose();
  });

  it('writes no depth anywhere, and takes no ray', () => {
    const light = buildLight('high');
    for (const m of materials(light)) expect(m.depthWrite, m.name).toBe(false);
    const hits: THREE.Intersection[] = [];
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 0, 10), new THREE.Vector3(0, 0, -1));
    light.setPose(poseAt(121), cameraAt(121), 0);
    light.group.traverse((o) => o.raycast(ray, hits));
    expect(hits).toEqual([]);
    light.dispose();
  });

  it('drops the vias on the low tier, and never takes them back', () => {
    const light = buildLight('high');
    light.setPose(poseAt(121), cameraAt(121), 0);
    const vias = named(light, 'light:vias');
    light.setTier('low');
    light.setPose(poseAt(121), cameraAt(121), 0);
    expect(vias.visible).toBe(false);
    light.setTier('high');
    light.setPose(poseAt(121), cameraAt(121), 0);
    expect(vias.visible).toBe(false);
    light.dispose();
  });

  it('frees every geometry, material and texture it made', () => {
    const light = buildLight('high');
    const spies: ReturnType<typeof vi.fn>[] = [];
    light.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) spies.push(vi.spyOn(mesh.geometry, 'dispose') as unknown as ReturnType<typeof vi.fn>);
    });
    for (const m of materials(light)) spies.push(vi.spyOn(m, 'dispose') as unknown as ReturnType<typeof vi.fn>);
    light.dispose();
    expect(spies.length).toBeGreaterThan(10);
    for (const spy of spies) expect(spy).toHaveBeenCalled();
  });
});

describe("the light's shaders", () => {
  it("fade the traces up from the light and run their pulses with no power that could be NaN", () => {
    const light = buildLight('high');
    const trace = named<THREE.Mesh>(light, 'light:trace:0').material as THREE.ShaderMaterial;
    expect(trace.fragmentShader).toMatch(/exp\(-vAbove \/ uLen\)/);
    expect(trace.fragmentShader).toMatch(/fract\(/);
    expect(trace.fragmentShader).not.toMatch(/pow\(/);
    light.dispose();
  });
});
