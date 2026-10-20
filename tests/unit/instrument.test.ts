import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { buildInstrument } from '../../src/scripts/three/instrument/Instrument';
import { buildAnnulus } from '../../src/scripts/three/instrument/Annulus';
import { TEXTURE_FILES } from '../../src/scripts/three/instrument/textures';
import { DIAL } from '../../src/scripts/three/instrument/dialSpec';
import { sweepCoverage } from '../../src/scripts/three/instrument/patterns';
import { withoutPointSpecular } from '../../src/scripts/three/instrument/materials';
import { loadInstrumentTextures } from '../../src/scripts/three/instrument/textures';
describe('the instrument', () => {
  const m = buildInstrument();
  it('ships its texture files', () => Object.values(TEXTURE_FILES).forEach((p) => expect(existsSync(`public${p}`)).toBe(true)));
  it('nests root → mount → spin, with the mount turning the face to +Z', () => {
    expect(m.mount.parent).toBe(m.root); expect(m.spin.parent).toBe(m.mount);
    m.root.updateMatrixWorld(true); const n = new THREE.Vector3(0, 1, 0).transformDirection(m.dial.matrixWorld);
    expect(n.z).toBeCloseTo(1); const north = new THREE.Vector3(0, 0, -1).transformDirection(m.dial.matrixWorld); expect(north.y).toBeCloseTo(1);
  });
  it('points the needle along its bearing', () => {
    m.applyPose({ bearing: Math.PI / 2, lift: 0, portrait: 0, threads: 1 }); m.root.updateMatrixWorld(true);
    const tip = new THREE.Vector3(0, 0, -1).transformDirection(m.needle.matrixWorld); expect(tip.x).toBeCloseTo(1);
  });
  it('builds finite geometry with no textures', () => {
    m.root.traverse((o) => { const pos = ((o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined)?.getAttribute?.('position');
      if (pos) for (let i = 0; i < pos.array.length; i++) expect(Number.isFinite(pos.array[i])).toBe(true); });
  });
  it('rebuilds a ring at new radii, with UVs in range', () => {
    const a = buildAnnulus({ inner: 0.72, outer: 1, uv: 'polar' }); a.setRadii(0.1, 1); const g = a.mesh.geometry as THREE.BufferGeometry;
    g.computeBoundingSphere(); expect(g.boundingSphere!.radius).toBeCloseTo(1, 2);
    const uv = g.getAttribute('uv'); for (let i = 0; i < uv.array.length; i++) { expect(uv.array[i]).toBeGreaterThanOrEqual(0); expect(uv.array[i]).toBeLessThanOrEqual(1); }
    expect(() => a.setRadii(1, 0.5)).toThrow();
  });
});

/** The UV of the vertex nearest a dial-local point on the face. */
function uvNear(geometry: THREE.BufferGeometry, x: number, z: number): [number, number] {
  const pos = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < pos.count; i++) {
    const d = (pos.getX(i) - x) ** 2 + (pos.getZ(i) - z) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return [uv.getX(best), uv.getY(best)];
}

describe('an annulus', () => {
  it('faces +Y, flat at y 0, between its radii', () => {
    const { mesh } = buildAnnulus({ inner: 0.42, outer: 0.56, uv: 'planar' });
    const g = mesh.geometry as THREE.BufferGeometry;
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      expect(pos.getY(i)).toBe(0);
      const r = Math.hypot(pos.getX(i), pos.getZ(i));
      expect(r).toBeGreaterThan(0.42 - 1e-6); expect(r).toBeLessThan(0.56 + 1e-6);
    }
    const index = g.getIndex()!;
    for (let t = 0; t < index.count; t += 3) {
      const [a, b, c] = [0, 1, 2].map((k) => new THREE.Vector3().fromBufferAttribute(pos, index.getX(t + k)));
      const normal = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
      expect(normal.y).toBeGreaterThan(0);
    }
  });
  it('lays polar UVs as bearing / 360 round and 0 → 1 outwards', () => {
    const g = buildAnnulus({ inner: 0.72, outer: 1, uv: 'polar' }).mesh.geometry as THREE.BufferGeometry;
    const [uEast, vEastOuter] = uvNear(g, 1, 0);
    expect(uEast).toBeCloseTo(0.25, 3); expect(vEastOuter).toBe(1);
    const [uSouth, vSouthInner] = uvNear(g, 0, 0.72);
    expect(uSouth).toBeCloseTo(0.5, 3); expect(vSouthInner).toBe(0);
    const [uWest] = uvNear(g, -1, 0);
    expect(uWest).toBeCloseTo(0.75, 3);
  });
  it('lays planar UVs over the face: north up, east right', () => {
    const g = buildAnnulus({ inner: 0.58, outer: 0.7, uv: 'planar' }).mesh.geometry as THREE.BufferGeometry;
    const [uNorth, vNorth] = uvNear(g, 0, -0.7);
    expect(uNorth).toBeCloseTo(0.5, 5); expect(vNorth).toBeCloseTo(0.5 + 0.7 / (2 * DIAL.face), 5);
    const [uEast, vEast] = uvNear(g, 0.7, 0);
    expect(uEast).toBeCloseTo(0.5 + 0.7 / (2 * DIAL.face), 5); expect(vEast).toBeCloseTo(0.5, 5);
  });
  it('refuses radii that are not a ring', () => {
    expect(() => buildAnnulus({ inner: 0.5, outer: 0.5, uv: 'polar' })).toThrow();
    expect(() => buildAnnulus({ inner: -0.1, outer: 0.5, uv: 'polar' })).toThrow();
    expect(() => buildAnnulus({ inner: 0.1, outer: Number.NaN, uv: 'planar' })).toThrow();
  });
});

type PatternUniforms = { mapTo: { value: THREE.Texture }; uSweep: { value: number }; uOrigin: { value: number }; uSoft: { value: number } };

describe('the instrument, in detail', () => {
  const patternOf = (model: ReturnType<typeof buildInstrument>) => model.rings.pattern.mesh.material as THREE.MeshPhysicalMaterial;
  const uniformsOf = (model: ReturnType<typeof buildInstrument>) => patternOf(model).userData.uniforms as PatternUniforms;

  it('puts the four rings at their radii on the face', () => {
    const m = buildInstrument();
    for (const id of ['trigram', 'direction', 'degree', 'pattern'] as const) {
      const g = m.rings[id].mesh.geometry as THREE.BufferGeometry;
      const pos = g.getAttribute('position');
      let lo = Infinity; let hi = 0;
      for (let i = 0; i < pos.count; i++) { const r = Math.hypot(pos.getX(i), pos.getZ(i)); lo = Math.min(lo, r); hi = Math.max(hi, r); expect(pos.getY(i)).toBe(0); }
      expect(lo).toBeCloseTo(DIAL.rings[id][0], 4); expect(hi).toBeCloseTo(DIAL.rings[id][1], 4);
    }
  });

  it('starts every ring pattern on a placeholder and swaps in the strips without a recompile', () => {
    const m = buildInstrument();
    const material = patternOf(m);
    const placeholder = material.map;
    expect(placeholder).toBeInstanceOf(THREE.DataTexture);
    expect(uniformsOf(m).mapTo.value).toBe(placeholder);
    const china = new THREE.Texture(); const aruba = new THREE.Texture();
    const version = material.version;
    m.setStrips({ china, aruba });
    m.setPattern('china', 'aruba', 0.4, 450);
    expect(material.map).toBe(china);
    expect(uniformsOf(m).mapTo.value).toBe(aruba);
    expect(uniformsOf(m).uSweep.value).toBeCloseTo(0.4);
    expect(uniformsOf(m).uOrigin.value).toBeCloseTo(0.25);
    expect(uniformsOf(m).uSoft.value).toBe(0.015);
    expect(material.version).toBe(version);
    m.setPattern('rotterdam', 'china', 2, -90);
    expect(material.map).toBe(placeholder);
    expect(uniformsOf(m).mapTo.value).toBe(china);
    expect(uniformsOf(m).uSweep.value).toBe(1);
    expect(uniformsOf(m).uOrigin.value).toBeCloseTo(0.75);
    m.setPattern('plain', 'plain', Number.NaN, Number.NaN);
    expect(uniformsOf(m).uSweep.value).toBe(0);
    expect(uniformsOf(m).uOrigin.value).toBe(0);
  });

  it('shows new strips at once for the pattern already set', () => {
    const m = buildInstrument();
    m.setPattern('china', 'aruba', 0.5, 90);
    const china = new THREE.Texture(); const aruba = new THREE.Texture();
    m.setStrips({ china, aruba });
    expect(patternOf(m).map).toBe(china);
    expect(uniformsOf(m).mapTo.value).toBe(aruba);
  });

  it('patches the physical shader with the coverage of sweepCoverage and a seam at the front', () => {
    const material = patternOf(buildInstrument());
    const shader = {
      uniforms: {} as Record<string, THREE.IUniform>,
      vertexShader: THREE.ShaderLib.physical.vertexShader,
      fragmentShader: THREE.ShaderLib.physical.fragmentShader
    };
    material.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
    const fs = shader.fragmentShader;
    expect(fs).not.toContain('#include <map_fragment>');
    expect(fs).toContain('uniform sampler2D mapTo;');
    expect(fs).toContain('fract( vMapUv.x - uOrigin )');
    expect(fs).toContain('uSweep * ( 0.5 + uSoft )');
    expect(fs).toContain('1.0 - smoothstep( front - uSoft, front, d )');
    expect(fs).toMatch(/totalEmissiveRadiance \+=/);
    expect(fs).toContain('uSweep > 0.0 && uSweep < 1.0');
    for (const name of ['mapTo', 'uSweep', 'uOrigin', 'uSoft']) expect(shader.uniforms[name]).toBe((material.userData.uniforms as Record<string, unknown>)[name]);
    // The formula the shader spells out, run in JS, is sweepCoverage's.
    const smoothstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const shaderCoverage = (u: number, origin: number, sweep: number, soft: number) => {
      const around = u - origin - Math.floor(u - origin); const d = Math.min(around, 1 - around); const front = sweep * (0.5 + soft);
      return 1 - smoothstep(front - soft, front, d);
    };
    for (const [u, origin, sweep] of [[0.1, 0.25, 0.3], [0.9, 0.75, 0.5], [0.5, 0.5, 0], [0.0, 0.5, 1], [0.37, 0.25, 0.25]]) {
      expect(shaderCoverage(u, origin, sweep, 0.015)).toBeCloseTo(sweepCoverage(u, origin, sweep), 10);
    }
  });

  it('lifts and fades the needle, and fades the portrait and the threads', () => {
    const m = buildInstrument();
    const needleMaterials = new Set<THREE.Material>();
    m.needle.traverse((o) => { const mesh = o as THREE.Mesh; if (mesh.isMesh) needleMaterials.add(mesh.material as THREE.Material); });
    expect(needleMaterials.size).toBe(2);
    m.applyPose({ bearing: 0, lift: 0, portrait: 0, threads: 1 });
    expect(m.needle.position.y).toBeCloseTo(0.05);
    needleMaterials.forEach((material) => { expect(material.transparent).toBe(true); expect(material.opacity).toBe(1); });
    m.applyPose({ bearing: 0, lift: 1, portrait: 0.6, threads: 0.25 });
    expect(m.needle.position.y).toBeCloseTo(0.1);
    needleMaterials.forEach((material) => expect(material.opacity).toBeCloseTo(0.15));
    m.applyPose({ bearing: 0, lift: 0.5, portrait: 0.6, threads: 0.25 });
    needleMaterials.forEach((material) => expect(material.opacity).toBeCloseTo(0.575));
    // The pin fades with it, so a lifted needle leaves the portrait's centre clear.
    const pin = (m.root.getObjectByName('compass:pin') as THREE.Mesh).material as THREE.Material;
    expect(pin.transparent).toBe(true); expect(pin.opacity).toBeCloseTo(0.575);
    m.applyPose({ bearing: 0, lift: 1, portrait: 0.6, threads: 0.25 });
    expect(pin.opacity).toBeCloseTo(0.15);
    m.applyPose({ bearing: 0, lift: 0.5, portrait: 0.6, threads: 0.25 });
    const threads = m.root.getObjectByName('compass:threads')!;
    threads.traverse((o) => { const mesh = o as THREE.Mesh; if (mesh.isMesh) expect((mesh.material as THREE.Material).opacity).toBeCloseTo(0.25); });
    // No portrait yet: the pool stays lacquer, whatever the pose asks.
    const portrait = m.root.getObjectByName('compass:portrait') as THREE.Mesh;
    expect(portrait.visible).toBe(false);
    m.setTextures({ portrait: new THREE.Texture() });
    expect(portrait.visible).toBe(true);
    expect((portrait.material as THREE.Material).opacity).toBeCloseTo(0.6);
    m.applyPose({ bearing: 0, lift: 0, portrait: 0, threads: 0 });
    expect(portrait.visible).toBe(false);
    threads.traverse((o) => { if ((o as THREE.Mesh).isMesh) expect(o.visible).toBe(false); });
  });

  it('takes the painted face without a recompile', () => {
    const m = buildInstrument();
    const face = m.rings.trigram.mesh.material as THREE.MeshStandardMaterial;
    expect(m.rings.direction.mesh.material).toBe(face); expect(m.rings.degree.mesh.material).toBe(face);
    expect(face.map).toBeInstanceOf(THREE.DataTexture); expect(face.roughnessMap).toBeInstanceOf(THREE.DataTexture);
    expect(face.metalness).toBe(1); expect(face.roughness).toBe(1);
    const version = face.version;
    const color = new THREE.Texture(); const mr = new THREE.Texture();
    m.setFace(color, mr);
    expect(face.map).toBe(color); expect(face.roughnessMap).toBe(mr); expect(face.metalnessMap).toBe(mr);
    expect(face.version).toBe(version);
  });

  it('wears the image textures tinted to its colours, safely more than once', () => {
    const m = buildInstrument();
    const rim = m.root.getObjectByName('compass:rim') as THREE.Mesh;
    const brass = rim.material as THREE.MeshStandardMaterial;
    // A white placeholder until the image arrives: the plain colour shows true.
    expect(brass.map).toBeInstanceOf(THREE.DataTexture);
    expect(Array.from((brass.map as THREE.DataTexture).image.data as Uint8Array)).toEqual([255, 255, 255, 255]);
    expect(brass.color.getHexString()).toBe('c9a24a');
    const image = new THREE.Texture();
    m.setTextures({ brass: image });
    expect(brass.map).toBe(image);
    expect(image.wrapS).toBe(THREE.RepeatWrapping);
    // The map's mean lands on the brass colour.
    const target = new THREE.Color(0xc9a24a);
    expect(brass.color.r).toBeGreaterThan(target.r);
    m.setTextures({ brass: image });
    m.setTextures({});
    expect(brass.map).toBe(image);
  });

  it('compiles nothing new when the textures, face and strips arrive', () => {
    const m = buildInstrument();
    const versions = new Map(m.materials().map((material) => [material, material.version]));
    const lacquer = (m.root.getObjectByName('compass:pool-floor') as THREE.Mesh).material as THREE.MeshPhysicalMaterial;
    const plate = ((m.root.getObjectByName('compass:plate') as THREE.Mesh).material as THREE.MeshPhysicalMaterial[])[0];
    const brass = (m.root.getObjectByName('compass:rim') as THREE.Mesh).material as THREE.MeshStandardMaterial;
    for (const material of [lacquer, plate, brass]) expect(material.map, material.name).toBeInstanceOf(THREE.DataTexture);
    const images = { brass: new THREE.Texture(), lacquer: new THREE.Texture(), portrait: new THREE.Texture() };
    m.setTextures(images);
    m.setTextures(images);
    m.setFace(new THREE.Texture(), new THREE.Texture());
    m.setStrips({ plain: new THREE.Texture(), china: new THREE.Texture() });
    m.setPattern('plain', 'china', 0.3, 90);
    m.applyPose({ bearing: 1, lift: 1, portrait: 1, threads: 0 });
    expect(brass.map).toBe(images.brass); expect(lacquer.map).toBe(images.lacquer); expect(plate.map).toBe(images.lacquer);
    versions.forEach((version, material) => expect(material.version, material.name).toBe(version));
  });

  it('draws the glass last, without depth, so it never clips the needle or hides the portrait', () => {
    const m = buildInstrument();
    const glass = m.root.getObjectByName('compass:glass') as THREE.Mesh;
    const material = glass.material as THREE.MeshPhysicalMaterial;
    expect(material.depthWrite).toBe(false); expect(material.transparent).toBe(true);
    m.root.traverse((o) => { if ((o as THREE.Mesh).isMesh && o !== glass) expect(o.renderOrder, o.name).toBeLessThan(glass.renderOrder); });
  });

  it('switches the lacquer and pattern clearcoat', () => {
    const m = buildInstrument();
    const plate = m.root.getObjectByName('compass:plate') as THREE.Mesh;
    const lacquer = (plate.material as THREE.Material[])[0] as THREE.MeshPhysicalMaterial;
    expect(lacquer.clearcoat).toBe(1); expect(patternOf(m).clearcoat).toBe(1);
    m.setClearcoat(false);
    expect(lacquer.clearcoat).toBe(0); expect(patternOf(m).clearcoat).toBe(0);
    m.setClearcoat(true);
    expect(lacquer.clearcoat).toBe(1); expect(patternOf(m).clearcoat).toBe(1);
  });

  it('winds every face the way its normals look', () => {
    const m = buildInstrument();
    m.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const g = mesh.geometry as THREE.BufferGeometry;
      const pos = g.getAttribute('position'); const nor = g.getAttribute('normal');
      const index = g.getIndex();
      const count = index ? index.count : pos.count;
      const at = (k: number) => (index ? index.getX(k) : k);
      let wrong = 0;
      for (let t = 0; t < count; t += 3) {
        const [a, b, c] = [0, 1, 2].map((k) => new THREE.Vector3().fromBufferAttribute(pos, at(t + k)));
        const face = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
        if (face.lengthSq() < 1e-14) continue;
        const normal = [0, 1, 2].reduce((sum, k) => sum.add(new THREE.Vector3().fromBufferAttribute(nor, at(t + k))), new THREE.Vector3());
        if (face.dot(normal) <= 0) wrong++;
      }
      expect(wrong, mesh.name).toBe(0);
    });
  });

  it('turns each part the right way out', () => {
    const m = buildInstrument();
    const triangles = (name: string, each: (face: THREE.Vector3, centroid: THREE.Vector3) => void) => {
      const g = (m.root.getObjectByName(name) as THREE.Mesh).geometry as THREE.BufferGeometry;
      const pos = g.getAttribute('position'); const index = g.getIndex();
      const count = index ? index.count : pos.count;
      for (let t = 0; t < count; t += 3) {
        const [a, b, c] = [0, 1, 2].map((k) => new THREE.Vector3().fromBufferAttribute(pos, index ? index.getX(t + k) : t + k));
        const face = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
        if (face.lengthSq() >= 1e-14) each(face, a.add(b).add(c).divideScalar(3));
      }
    };
    // The needle and its hub are convex round their pin: every face looks away from it.
    for (const name of ['compass:needle-tip', 'compass:needle-tail', 'compass:needle-hub']) triangles(name, (face, centroid) => expect(face.dot(centroid), name).toBeGreaterThan(0));
    // The pool's wall looks in, toward the pool.
    triangles('compass:pool-wall', (face, centroid) => expect(face.x * centroid.x + face.z * centroid.z).toBeLessThan(0));
    // The rim's bead, the floor, the glass and the portrait look up; the plate's back looks down.
    triangles('compass:rim', (face) => expect(face.y).toBeGreaterThan(0));
    for (const name of ['compass:pool-floor', 'compass:glass', 'compass:portrait', 'compass:bed']) triangles(name, (face) => expect(face.y, name).toBeGreaterThan(0));
    triangles('compass:plate-back', (face) => expect(face.y).toBeLessThan(0));
    // The plate's top cap looks up.
    triangles('compass:plate', (face, centroid) => { if (Math.abs(centroid.y) < 1e-6) expect(face.y).toBeGreaterThan(0); });
  });

  it('seats the dial in a plate 2.4 wide, its top flush with the face, its hole clear of the rim', () => {
    const m = buildInstrument();
    const plate = m.root.getObjectByName('compass:plate') as THREE.Mesh;
    const g = plate.geometry as THREE.BufferGeometry;
    g.computeBoundingBox();
    expect(g.boundingBox!.max.y).toBeCloseTo(0, 6); expect(g.boundingBox!.min.y).toBeCloseTo(-DIAL.plateDepth, 6);
    expect(g.boundingBox!.max.x).toBeCloseTo(DIAL.plate / 2, 6); expect(g.boundingBox!.min.z).toBeCloseTo(-DIAL.plate / 2, 6);
    const pos = g.getAttribute('position');
    let nearest = Infinity;
    for (let i = 0; i < pos.count; i++) nearest = Math.min(nearest, Math.hypot(pos.getX(i), pos.getZ(i)));
    expect(nearest).toBeGreaterThanOrEqual(DIAL.rim);
    expect(nearest).toBeLessThan(DIAL.rim + 0.002);
    const rim = (m.root.getObjectByName('compass:rim') as THREE.Mesh).geometry as THREE.BufferGeometry;
    rim.computeBoundingBox();
    expect(rim.boundingBox!.max.x).toBeCloseTo(DIAL.rim, 4); expect(rim.boundingBox!.min.y).toBeCloseTo(0, 6);
  });

  it('lists every material once, and frees what it made but not what it was handed', () => {
    const m = buildInstrument();
    const listed = m.materials();
    expect(new Set(listed).size).toBe(listed.length);
    m.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => expect(listed).toContain(material));
    });
    const handed = new THREE.Texture(); let handedFreed = false;
    handed.addEventListener('dispose', () => (handedFreed = true));
    m.setTextures({ brass: handed }); m.setStrips({ china: handed }); m.setPattern('china', 'china', 0, 0);
    const placeholder = (m.rings.trigram.mesh.material as THREE.MeshStandardMaterial).map!;
    let placeholderFreed = false; placeholder.addEventListener('dispose', () => (placeholderFreed = true));
    let geometryFreed = false; m.rings.degree.mesh.geometry.addEventListener('dispose', () => (geometryFreed = true));
    const parent = new THREE.Group(); parent.add(m.root);
    m.dispose(); m.dispose();
    expect(handedFreed).toBe(false); expect(placeholderFreed).toBe(true); expect(geometryFreed).toBe(true);
    expect(m.root.parent).toBeNull();
  });
});

describe('the instrument textures', () => {
  it('loads what it can, in sRGB, and never rejects', async () => {
    const loader = {
      loadAsync: async (url: string) => {
        if (url === TEXTURE_FILES.brass) throw new Error('missing');
        return new THREE.Texture();
      }
    } as unknown as THREE.TextureLoader;
    const textures = await loadInstrumentTextures('/portrait.webp', loader);
    expect(textures.brass).toBeUndefined();
    expect(textures.lacquer?.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(textures.portrait?.colorSpace).toBe(THREE.SRGBColorSpace);
    const none = await loadInstrumentTextures(undefined, loader);
    expect(none.portrait).toBeUndefined();
    const broken = { loadAsync: () => { throw new Error('no'); } } as unknown as THREE.TextureLoader;
    await expect(loadInstrumentTextures('/p.webp', broken)).resolves.toEqual({});
  });

  it('hands over each map as it arrives, before the rest have settled', async () => {
    const pending = new Map<string, (texture: THREE.Texture) => void>();
    const loader = {
      loadAsync: (url: string) => new Promise<THREE.Texture>((resolve) => pending.set(url, resolve))
    } as unknown as THREE.TextureLoader;
    const arrived: [string, THREE.Texture][] = [];
    let all: unknown = null;
    void loadInstrumentTextures('/portrait.webp', loader, (key, texture) => arrived.push([key, texture])).then((textures) => (all = textures));
    const lacquer = new THREE.Texture();
    pending.get(TEXTURE_FILES.lacquer)!(lacquer);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(arrived).toEqual([['lacquer', lacquer]]);
    expect(lacquer.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(all).toBeNull();
    pending.get(TEXTURE_FILES.brass)!(new THREE.Texture());
    pending.get('/portrait.webp')!(new THREE.Texture());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(arrived.map(([key]) => key).sort()).toEqual(['brass', 'lacquer', 'portrait']);
    expect(Object.keys(all as object).sort()).toEqual(['brass', 'lacquer', 'portrait']);
  });
});

describe('the pearl in the lacquer', () => {
  const compile = (material: THREE.Material) => {
    const lib = (material as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial ? THREE.ShaderLib.physical : THREE.ShaderLib.standard;
    const shader = { uniforms: {} as Record<string, THREE.IUniform>, vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader };
    material.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
    return shader.fragmentShader;
  };

  it('lights the glossy finishes but keeps it out of their highlights', () => {
    const byName = new Map(buildInstrument().materials().map((material) => [material.name, material]));
    for (const name of ['compass:lacquer', 'compass:plate', 'compass:face', 'compass:glass', 'compass:pattern']) {
      const fs = compile(byName.get(name)!);
      expect(fs, name).not.toContain('#include <lights_fragment_begin>');
      // The specular is kept before the point lights and put back after them, before the other lights.
      const keep = fs.indexOf('vec3 pearlSpecular = reflectedLight.directSpecular;');
      const point = fs.indexOf('#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )');
      const back = fs.indexOf('reflectedLight.directSpecular = pearlSpecular;');
      const spot = fs.indexOf('#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )');
      const sun = fs.indexOf('#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )');
      expect(keep, name).toBeGreaterThan(-1);
      expect(keep < point && point < back && back < spot && spot < sun, name).toBe(true);
      expect(fs.slice(point, back)).toContain('RE_Direct( directLight');
      expect(fs).toContain('clearcoatSpecularDirect = pearlCoat;');
    }
    // The brass, the gilt rules and the needle still catch it.
    for (const name of ['compass:brass', 'compass:gilt', 'compass:needle-tip', 'compass:needle-tail']) expect(compile(byName.get(name)!), name).toContain('#include <lights_fragment_begin>');
  });

  it('leaves a lights chunk without point lights as it is', () => {
    expect(withoutPointSpecular('vec3 a = b;')).toBe('vec3 a = b;');
    expect(withoutPointSpecular(THREE.ShaderChunk.lights_fragment_begin).length).toBeGreaterThan(THREE.ShaderChunk.lights_fragment_begin.length);
  });
});
