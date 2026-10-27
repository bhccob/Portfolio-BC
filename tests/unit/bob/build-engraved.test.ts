import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { buildEngraved, ENGRAVED_LOOK, type EngravedModel } from '~/engine/bob/build/engraved';
import { palette } from '~/engine/palette';
import { type RingSpec, shaftRings } from '~/scene/bob/engravedWay';

type Vec3 = [number, number, number];

/** A canvas as a test hands it over: a 2D context that draws nothing. */
function canvas(): HTMLCanvasElement {
  const noop = () => {};
  const ctx = { fillRect: noop, beginPath: noop, moveTo: noop, lineTo: noop, stroke: noop, arc: noop, closePath: noop } as unknown as CanvasRenderingContext2D;
  return { width: 0, height: 0, getContext: (kind: string) => (kind === '2d' ? ctx : null) } as unknown as HTMLCanvasElement;
}

/** Three trips of 40 points, a metre apart, each its own way. */
const TRIPS: Vec3[][] = [0, 1, 2].map((k) => Array.from({ length: 40 }, (_, i): Vec3 => [k * 6 + i * 0.1, -11 - k, -i]));
const RINGS = shaftRings();
const throatCount = (rings: readonly RingSpec[]) => rings.filter((r) => r.zone === 'throat').length;
const hallCount = (rings: readonly RingSpec[]) => rings.filter((r) => r.zone === 'hall').length;

function meshes(model: EngravedModel, prefix: string): THREE.Mesh[] {
  return model.group.children.filter((o): o is THREE.Mesh => (o as THREE.Mesh).isMesh && o.name.startsWith(prefix));
}

function uniform<T>(mesh: THREE.Mesh, name: string): T {
  return (mesh.material as THREE.ShaderMaterial).uniforms[name]!.value as T;
}

const ZERO = { throat: 0, hall: 0, trips: [0, 0, 0] };
const FOG = { near: 4, far: 20 };

describe('the engraved way in three.js', () => {
  it('builds one mesh a ring, one line and three arcs a trip on the high tier', () => {
    const model = buildEngraved(RINGS, TRIPS, 'high', canvas());
    expect(meshes(model, 'engraved:throat')).toHaveLength(throatCount(RINGS));
    expect(meshes(model, 'engraved:hall')).toHaveLength(hallCount(RINGS));
    for (let k = 0; k < 3; k++) {
      expect(meshes(model, `engraved:line:${k}`)).toHaveLength(1);
      expect(meshes(model, `engraved:arc:${k}`)).toHaveLength(ENGRAVED_LOOK.arc.count);
    }
    // Each ring at its height and tilt, its band as wide as its spec.
    const hall = meshes(model, 'engraved:hall');
    const specs = RINGS.filter((r) => r.zone === 'hall');
    hall.forEach((mesh, i) => {
      expect(mesh.position.toArray()).toEqual([0, specs[i]!.y, 0]);
      expect([mesh.rotation.x, mesh.rotation.z]).toEqual(specs[i]!.tilt);
      mesh.geometry.computeBoundingBox();
      expect(mesh.geometry.boundingBox!.max.x).toBeCloseTo(specs[i]!.radius + specs[i]!.width / 2, 5);
    });
    model.dispose();
  });

  it('thins out on the medium tier (every other ring, two arcs) and the low (every other ring, no arcs)', () => {
    const medium = buildEngraved(RINGS, TRIPS, 'medium', canvas());
    expect(meshes(medium, 'engraved:throat')).toHaveLength(Math.ceil(throatCount(RINGS) / 2));
    expect(meshes(medium, 'engraved:hall')).toHaveLength(Math.ceil(hallCount(RINGS) / 2));
    expect(meshes(medium, 'engraved:arc:0')).toHaveLength(2);
    expect(meshes(medium, 'engraved:line:2')).toHaveLength(1);
    const low = buildEngraved(RINGS, TRIPS, 'low', canvas());
    expect(meshes(low, 'engraved:throat')).toHaveLength(Math.ceil(throatCount(RINGS) / 2));
    expect(meshes(low, 'engraved:arc:')).toHaveLength(0);
    expect(meshes(low, 'engraved:line:')).toHaveLength(3);
    // The arcs a medium tier keeps are the high tier's own first two.
    const high = buildEngraved(RINGS, TRIPS, 'high', canvas());
    const first = (m: EngravedModel, k: number) => Array.from(meshes(m, 'engraved:arc:0')[k]!.geometry.getAttribute('position').array.slice(0, 6));
    expect(first(medium, 1)).toEqual(first(high, 1));
    for (const m of [medium, low, high]) m.dispose();
  });

  it('draws additively, writes no depth, and hides the group while every level is 0', () => {
    const model = buildEngraved(RINGS, TRIPS, 'high', canvas());
    for (const mesh of meshes(model, 'engraved:')) {
      const material = mesh.material as THREE.ShaderMaterial;
      expect([material.blending, material.depthWrite, material.transparent, material.side]).toEqual([THREE.AdditiveBlending, false, true, THREE.DoubleSide]);
      expect(uniform<THREE.Color>(mesh, 'uColour').getHex()).toBe(new THREE.Color(palette.goldLight).getHex());
    }
    expect(model.group.visible).toBe(false);
    model.update(ZERO, null, FOG);
    expect(model.group.visible).toBe(false);
    model.update({ throat: 0, hall: 0, trips: [0, 0.2, 0] }, null, FOG);
    expect(model.group.visible).toBe(true);
    model.update(ZERO, null, FOG);
    expect(model.group.visible).toBe(false);
    model.dispose();
  });

  it("update sets each material's level and the light's place; the throat keeps its own fog", () => {
    const model = buildEngraved(RINGS, TRIPS, 'high', canvas());
    model.update({ throat: 0.25, hall: 0.5, trips: [1, 0.32, 0] }, [1, -6, 2], FOG);
    const [throat] = meshes(model, 'engraved:throat');
    const [hall] = meshes(model, 'engraved:hall');
    expect(uniform<number>(throat!, 'uLevel')).toBe(0.25);
    expect(uniform<number>(hall!, 'uLevel')).toBe(0.5);
    expect([0, 1, 2].map((k) => uniform<number>(meshes(model, `engraved:line:${k}`)[0]!, 'uLevel'))).toEqual([1, 0.32, 0]);
    expect([0, 1, 2].map((k) => uniform<number>(meshes(model, `engraved:arc:${k}`)[0]!, 'uLevel'))).toEqual([1, 0.32, 0]);
    for (const mesh of meshes(model, 'engraved:')) expect(uniform<THREE.Vector3>(mesh, 'uLight').toArray()).toEqual([1, -6, 2]);
    expect(uniform<THREE.Vector2>(throat!, 'uFog').toArray()).toEqual(ENGRAVED_LOOK.throat.fog);
    expect(uniform<THREE.Vector2>(hall!, 'uFog').toArray()).toEqual([Math.max(2, FOG.near * 0.6), Math.max(10, FOG.far)]);
    // The look's numbers: the glow's base, height and reach, each kind its own.
    expect([uniform(throat!, 'uBase'), uniform(throat!, 'uGlow'), uniform(throat!, 'uReach')]).toEqual([0.12, 1.2, 1.1]);
    expect([uniform(hall!, 'uBase'), uniform(hall!, 'uGlow'), uniform(hall!, 'uReach')]).toEqual([0.14, 0.95, 1.4]);
    const line = meshes(model, 'engraved:line:0')[0]!;
    expect([uniform(line, 'uBase'), uniform(line, 'uGlow'), uniform(line, 'uReach')]).toEqual([0.34, 1.4, 1.1]);
    const arc = meshes(model, 'engraved:arc:0')[0]!;
    expect([uniform(arc, 'uBase'), uniform(arc, 'uGlow'), uniform(arc, 'uReach')]).toEqual([0.14, 0.3, 3]);
    // No light: the last place stands.
    model.update({ throat: 0, hall: 0, trips: [0, 0, 1] }, null, FOG);
    expect(uniform<THREE.Vector3>(line, 'uLight').toArray()).toEqual([1, -6, 2]);
    model.dispose();
  });

  it('lays a line across its way, falling back to x where the way runs straight down', () => {
    const down: Vec3[] = Array.from({ length: 5 }, (_, i): Vec3 => [0, -i, 0]);
    const model = buildEngraved([], [down], 'high', canvas());
    const position = meshes(model, 'engraved:line:0')[0]!.geometry.getAttribute('position');
    expect([position.getX(0), position.getX(1)]).toEqual([-ENGRAVED_LOOK.line.width / 2, ENGRAVED_LOOK.line.width / 2].map((x) => Math.fround(x)));
    expect([position.getZ(0), position.getZ(1)]).toEqual([0, 0]);
    model.dispose();
  });

  it('dispose frees every geometry, material and the texture', () => {
    const model = buildEngraved(RINGS, TRIPS, 'high', canvas());
    const drawn = meshes(model, 'engraved:');
    const geometries = drawn.map((m) => vi.spyOn(m.geometry, 'dispose'));
    const materials = [...new Set(drawn.map((m) => m.material as THREE.ShaderMaterial))];
    const materialSpies = materials.map((m) => vi.spyOn(m, 'dispose'));
    const texture = vi.spyOn(materials[0]!.uniforms.uMap!.value as THREE.Texture, 'dispose');
    model.dispose();
    for (const spy of [...geometries, ...materialSpies, texture]) expect(spy).toHaveBeenCalledOnce();
  });

  it('names a canvas that gives no 2D context', () => {
    const blank = { width: 0, height: 0, getContext: () => null } as unknown as HTMLCanvasElement;
    expect(() => buildEngraved(RINGS, TRIPS, 'high', blank)).toThrow(TypeError);
  });
});
