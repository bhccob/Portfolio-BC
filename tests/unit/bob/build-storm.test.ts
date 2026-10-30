import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildStorm, STORM_SKY } from '~/engine/bob/build/storm';
import { STORM } from '~/scene/bob/storm';

// The storm behind everything (spec 2026-10-30-bob-storm-design.md): the painted sky round the camera, and the
// painted flats behind the compass at the start screen.

const plates = () => ({ wall: new THREE.Texture(), sea: new THREE.Texture() });
const camera = (y: number): THREE.PerspectiveCamera => {
  const c = new THREE.PerspectiveCamera(30, 1.6, 0.1, 100);
  c.position.set(0, y, 8.6);
  c.updateMatrixWorld();
  return c;
};
const material = (o: THREE.Object3D): THREE.ShaderMaterial => (o as THREE.Mesh).material as THREE.ShaderMaterial;
const pose = { clock: 12, sky: 1, flats: 1, flash: { strength: 0.5, dir: [0, 0, -1] as [number, number, number] } };

describe('the storm in code: the painted sky and the flats', () => {
  it('draws the sky first and behind everything, at the far plane, writing no depth', () => {
    const storm = buildStorm(plates());
    const sky = storm.group.getObjectByName('storm:sky') as THREE.Mesh;
    expect(sky).toBeTruthy();
    const m = material(sky);
    expect(m.side).toBe(THREE.BackSide);
    expect(m.depthWrite).toBe(false);
    expect(m.fog).toBe(false);
    expect(sky.frustumCulled).toBe(false);
    expect(sky.renderOrder).toBeLessThan(0);
    // At the far plane wherever the camera is: no translation, depth 1 (the skybox's .xyww).
    expect(m.vertexShader).toMatch(/mat3\(viewMatrix\)/);
    expect(m.vertexShader).toMatch(/\.xyww/);
    // Its plates: the wall above the horizon, the sea below.
    expect(m.uniforms.uWall!.value).toBeInstanceOf(THREE.Texture);
    expect(m.uniforms.uSea!.value).toBeInstanceOf(THREE.Texture);
  });

  it("stands the three flats on the glass behind the compass at the spike's radii, nearest last", () => {
    const storm = buildStorm(plates());
    const flats = STORM.flats.map((_, k) => storm.group.getObjectByName(`storm:flat:${k}`) as THREE.Mesh);
    flats.forEach((flat, k) => {
      expect(flat, `flat ${k}`).toBeTruthy();
      const g = (flat.geometry as THREE.CylinderGeometry).parameters;
      expect(g.radiusTop).toBe(STORM.flats[k]!.radius);
      expect(g.height).toBe(STORM.flats[k]!.height);
      expect(g.openEnded).toBe(true);
      // An arc centred on -z, behind the compass, seen from inside.
      expect(g.thetaStart + g.thetaLength / 2).toBeCloseTo(Math.PI, 9);
      expect(g.thetaLength).toBeLessThan(2 * Math.PI);
      const box = new THREE.Box3().setFromObject(flat);
      expect(box.min.y).toBeCloseTo(-0.3, 6);
      expect(box.max.z).toBeLessThan(STORM.flats[k]!.radius * 0.35);
      const m = material(flat);
      expect(m.transparent).toBe(true);
      expect(m.depthWrite).toBe(false);
      expect(m.side).toBe(THREE.BackSide);
      if (k > 0) expect(flat.renderOrder).toBeGreaterThan(flats[k - 1]!.renderOrder);
    });
  });

  it('poses the sky, the flats and the flash on the clock, and hides the flats when they are out', () => {
    const storm = buildStorm(plates());
    const sky = material(storm.group.getObjectByName('storm:sky')!);
    storm.pose({ ...pose, camera: camera(2.5) });
    expect(sky.uniforms.uTime!.value).toBe(12);
    expect(sky.uniforms.uLevel!.value).toBeCloseTo(STORM_SKY.light, 9);
    expect(sky.uniforms.uFlash!.value).toBe(0.5);
    expect((sky.uniforms.uFlashDir!.value as THREE.Vector3).toArray()).toEqual([0, 0, -1]);
    // Above the glass the sky below the horizon past its edge is kept dark; under it (the void), not.
    expect(sky.uniforms.uAbove!.value).toBe(1);
    STORM.flats.forEach((f, k) => {
      const flat = storm.group.getObjectByName(`storm:flat:${k}`)!;
      expect(flat.visible).toBe(true);
      expect(material(flat).uniforms.uLevel!.value).toBeCloseTo(f.level, 9);
      expect(material(flat).uniforms.uTime!.value).toBe(12);
      // Straight behind: the middle of the flat.
      expect(material(flat).uniforms.uFlashU!.value).toBeCloseTo(0.5, 9);
    });
    storm.pose({ ...pose, sky: 0.35, flats: 0, camera: camera(-80) });
    expect(sky.uniforms.uLevel!.value).toBeCloseTo(STORM_SKY.light * 0.35, 9);
    expect(sky.uniforms.uAbove!.value).toBe(0);
    for (let k = 0; k < STORM.flats.length; k++) expect(storm.group.getObjectByName(`storm:flat:${k}`)!.visible).toBe(false);
    storm.pose({ ...pose, sky: 0, flats: 0, camera: camera(2.5) });
    expect(storm.group.visible).toBe(false);
  });

  it("holds every shader pow's base at zero or more", () => {
    const source = readFileSync(fileURLToPath(new URL('../../../src/engine/bob/build/storm.ts', import.meta.url)), 'utf8');
    const pows = [...source.matchAll(/pow\(\s*([a-z]+)\(/g)];
    expect(pows.length).toBe(source.match(/pow\(/g)?.length ?? 0);
    for (const m of pows) expect(['max', 'clamp']).toContain(m[1]);
  });

  it('frees its geometries, materials and plates on dispose', () => {
    const p = plates();
    const storm = buildStorm(p);
    let freed = 0;
    for (const t of [p.wall, p.sea]) t.addEventListener('dispose', () => freed++);
    storm.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.geometry) return;
      mesh.geometry.addEventListener('dispose', () => freed++);
      (mesh.material as THREE.Material).addEventListener('dispose', () => freed++);
    });
    storm.dispose();
    expect(freed).toBe(2 + 2 * (1 + STORM.flats.length));
  });
});
