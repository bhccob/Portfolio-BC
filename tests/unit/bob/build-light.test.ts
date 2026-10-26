import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { buildLight, LIGHT_LOOK, TRAIL_SIDES, type LightModel } from '~/engine/bob/build/light';
import { applyCameraShot } from '~/engine/bob/shots';
import { palette } from '~/engine/palette';
import type { LightPose } from '~/scene/bob/journey';
import { F, filamentsAt, lightAt, trailAt, trailLevel, wayShot } from '~/scene/bob/lightDive';

const DESK = 1440 / 900;

/** The light's pose at way frame f, as the journey gives it. */
const poseAt = (f: number, aspect = DESK): LightPose => ({ ...lightAt(f, aspect), trail: trailAt(f, aspect), trailLevel: trailLevel(f), filaments: filamentsAt(f) });

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

describe('the light', () => {
  it('holds its parts: the body (core, shell, halo, filaments), the trail and the lamp', () => {
    const light = buildLight('high');
    expect(light.group.name).toBe('light');
    expect(light.group.children.map((o) => o.name)).toEqual(['light:body', 'light:trail', 'light:lamp']);
    expect(named(light, 'light:body').children.map((o) => o.name)).toEqual(['light:core', 'light:shell', 'light:halo', 'light:filaments']);
    expect(TRAIL_SIDES).toBe(10);
    light.dispose();
  });

  it('is gold only: every colour it draws or lights with is a gold of the palette, none violet nor whiter than gold light', () => {
    const light = buildLight('high');
    light.setPose(poseAt(121), cameraAt(121));
    for (const m of materials(light)) {
      const colour = (m as THREE.MeshBasicMaterial).color;
      expect(isGold(colour), `${m.name}: ${colour.getHexString()}`).toBe(true);
      for (const uniform of Object.values((m.userData.uniforms ?? {}) as Record<string, THREE.IUniform>)) {
        if ((uniform.value as THREE.Color)?.isColor) expect(isGold(uniform.value as THREE.Color), `${m.name}'s uniform`).toBe(true);
      }
    }
    expect(isGold(named<THREE.PointLight>(light, 'light:lamp').color)).toBe(true);
    // The filaments' per-vertex colours are grey, a strength on the material's gold.
    const fil = named<THREE.LineSegments>(light, 'light:filaments').geometry.getAttribute('color');
    for (let i = 0; i < fil.count; i++) expect(fil.getX(i)).toBe(fil.getY(i));
    light.dispose();
  });

  it('places it, sizes it, turns it with the camera and dims it with its glow (setPose)', () => {
    const light = buildLight('high');
    const pose = poseAt(121);
    light.setPose(pose, cameraAt(121));
    const body = named(light, 'light:body');
    expect(body.position.toArray()).toEqual([...pose.position]);
    expect(body.scale.toArray()).toEqual([pose.radius, pose.radius, pose.radius]);
    expect(body.rotation.y).toBeCloseTo(pose.yaw, 12);
    expect(body.visible).toBe(true);
    const core = named<THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>(light, 'light:core');
    const coreColour = new THREE.Color(LIGHT_LOOK.core.colour).multiplyScalar(LIGHT_LOOK.core.level * pose.glow);
    expect(core.material.color.r).toBeCloseTo(coreColour.r, 9);
    const lamp = named<THREE.PointLight>(light, 'light:lamp');
    expect(lamp.intensity).toBeCloseTo(LIGHT_LOOK.lamp.level * pose.glow, 9);
    expect(lamp.position.toArray()).toEqual([...pose.position]);
    light.dispose();
  });

  it('stretches it along the needle as it becomes the needle: 1 + 3 s along, 1 - 0.65 s across', () => {
    const light = buildLight('high');
    const f = F.NEEDLE + 5;
    const pose = poseAt(f);
    expect(pose.stretch).toBeGreaterThan(0);
    light.setPose(pose, cameraAt(f));
    const body = named(light, 'light:body');
    expect(body.scale.z).toBeCloseTo(pose.radius * (1 + 3 * pose.stretch), 12);
    expect(body.scale.x).toBeCloseTo(pose.radius * (1 - 0.65 * pose.stretch), 12);
    expect(body.scale.y).toBeCloseTo(pose.radius * (1 - 0.65 * pose.stretch), 12);
    light.dispose();
  });

  it('hides the body and the trail at glow 0, and keeps the lamp in the scene at intensity 0, so the light count stays', () => {
    const light = buildLight('high');
    light.setPose(poseAt(1), cameraAt(1));
    expect(poseAt(1).glow).toBe(0);
    expect(named(light, 'light:body').visible).toBe(false);
    expect(named(light, 'light:trail').visible).toBe(false);
    const lamp = named<THREE.PointLight>(light, 'light:lamp');
    expect([lamp.visible, lamp.intensity]).toEqual([true, 0]);
    light.dispose();
  });

  it('rebuilds the trail in place each frame: the same geometry and attributes, a tapering tube of 10 sides', () => {
    const light = buildLight('high');
    const trail = named<THREE.Mesh>(light, 'light:trail');
    const geometry = trail.geometry;
    const position = geometry.getAttribute('position');
    const points = Array.from({ length: 110 }, (_, i) => ({ point: [0, -i * 0.05, -i * 0.01] as const, u: i / 109 }));
    const base = poseAt(150);
    light.setPose({ ...base, trail: points, trailLevel: 1 }, cameraAt(150));
    expect(geometry.drawRange.count).toBe(109 * TRAIL_SIDES * 6);
    light.setPose({ ...base, trail: points.map((p) => ({ ...p, point: [p.point[0] + 0.1, p.point[1], p.point[2]] as const })), trailLevel: 1 }, cameraAt(150));
    expect(trail.geometry).toBe(geometry);
    expect(geometry.getAttribute('position')).toBe(position);
    // The first ring is the trail's width at the head, the last a hair at the tail.
    const ring = (i: number) => {
      const c = new THREE.Vector3(points[i]!.point[0] + 0.1, points[i]!.point[1], points[i]!.point[2]);
      return new THREE.Vector3().fromBufferAttribute(position, i * TRAIL_SIDES).distanceTo(c);
    };
    expect(ring(0)).toBeCloseTo(base.radius * LIGHT_LOOK.trail.width, 4);
    expect(ring(108)).toBeLessThan(ring(0) / 50);
    // Too short a trail draws nothing.
    light.setPose({ ...base, trail: points.slice(0, 1), trailLevel: 1 }, cameraAt(150));
    expect(geometry.drawRange.count).toBe(0);
    light.dispose();
  });

  it("lays the filaments from the pose, in the light's own units, their strength the filament's brightness", () => {
    const light = buildLight('high');
    const pose = poseAt(121);
    light.setPose(pose, cameraAt(121));
    const geometry = named<THREE.LineSegments>(light, 'light:filaments').geometry;
    const position = geometry.getAttribute('position');
    const colour = geometry.getAttribute('color');
    const first = pose.filaments[0]!;
    expect([position.getX(0), position.getY(0), position.getZ(0)]).toEqual(first.points[0]!.map((v) => Math.fround(v)));
    expect([position.getX(1), position.getY(1), position.getZ(1)]).toEqual(first.points[1]!.map((v) => Math.fround(v)));
    expect(colour.getX(0)).toBeCloseTo(first.brightness, 6);
    light.dispose();
  });

  it('writes no depth anywhere, and takes no ray', () => {
    const light = buildLight('high');
    light.setPose(poseAt(121), cameraAt(121));
    for (const m of materials(light)) {
      expect(m.depthWrite, m.name).toBe(false);
      expect(m.blending, m.name).toBe(THREE.AdditiveBlending);
    }
    light.group.updateMatrixWorld(true);
    const camera = cameraAt(121);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    raycaster.camera = camera;
    expect(raycaster.intersectObject(light.group, true)).toHaveLength(0);
    light.dispose();
  });

  it('drops its filaments on the low tier, and never takes them back', () => {
    const light = buildLight('high');
    light.setTier('low');
    light.setPose(poseAt(121), cameraAt(121));
    expect(named(light, 'light:filaments').visible).toBe(false);
    light.setTier('high');
    light.setPose(poseAt(121), cameraAt(121));
    expect(named(light, 'light:filaments').visible).toBe(false);
    light.dispose();
  });

  it('frees every geometry, material and texture it made', () => {
    const light = buildLight('high');
    const parts = new Set<{ dispose(): void }>();
    light.group.traverse((o) => {
      const drawn = o as THREE.Mesh;
      if (drawn.geometry && !(o as THREE.Sprite).isSprite) parts.add(drawn.geometry);
      for (const m of [drawn.material].flat() as (THREE.Material & { map?: THREE.Texture | null })[]) {
        if (!m) continue;
        parts.add(m);
        if (m.map) parts.add(m.map);
      }
    });
    // Core, shell, trail and filaments: a geometry and a material each; the halo's material and texture.
    expect(parts.size).toBe(4 * 2 + 2);
    const spies = [...parts].map((part) => vi.spyOn(part, 'dispose'));
    light.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalled();
  });
});

describe("the light's shaders", () => {
  /** Runs a material's patch on three's basic shader, as three's renderer would. */
  const patched = (m: THREE.Material) => {
    const shader = { uniforms: {} as Record<string, THREE.IUniform>, vertexShader: THREE.ShaderLib.basic.vertexShader, fragmentShader: THREE.ShaderLib.basic.fragmentShader };
    m.onBeforeCompile(shader as never, {} as never);
    return shader;
  };

  it("patch the shell's rim and the trail's fade into three's own shader, every power's base held to 0..1, each a program of its own", () => {
    const light = buildLight('high');
    const shell = patched(named<THREE.Mesh<THREE.BufferGeometry, THREE.Material>>(light, 'light:shell').material);
    const trailMaterial = named<THREE.Mesh<THREE.BufferGeometry, THREE.Material>>(light, 'light:trail').material;
    const trail = patched(trailMaterial);
    for (const shader of [shell, trail]) {
      expect(shader.fragmentShader).toContain('diffuseColor.a *=');
      for (const chunk of ['#include <tonemapping_fragment>', '#include <colorspace_fragment>']) expect(shader.fragmentShader).toContain(chunk);
      const patch = shader.fragmentShader.slice(shader.fragmentShader.indexOf('#include <color_fragment>'));
      for (const base of patch.matchAll(/pow\(\s*(\w+)/g)) expect(['clamp', 'trailFacing'], base[0]).toContain(base[1]);
    }
    expect(trail.vertexShader).toContain('attribute float aAge;');
    expect(trail.fragmentShader).toContain('uniform vec3 uHead;');
    expect(trail.uniforms.uHead).toBe((trailMaterial.userData.uniforms as Record<string, THREE.IUniform>).uHead);
    expect(named<THREE.Mesh<THREE.BufferGeometry, THREE.Material>>(light, 'light:shell').material.customProgramCacheKey()).toBe('bob-light-shell');
    expect(trailMaterial.customProgramCacheKey()).toBe('bob-light-trail');
    light.dispose();
  });
});
