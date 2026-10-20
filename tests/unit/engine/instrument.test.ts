import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { buildInstrument, type InstrumentPose } from '~/engine/instrument/Instrument';
import { buildAnnulus } from '~/engine/instrument/Annulus';
import { TEXTURE_FILES } from '~/engine/instrument/textures';
import { DIAL, bearingOf } from '~/engine/instrument/dialSpec';
import { DRIVE, TRACKS, armBearing, headPoint } from '~/engine/instrument/drive';
import { armState } from '~/engine/instrument/Needle';
import { MIRROR, RAMP } from '~/engine/instrument/DriveParts';
import { sweepCoverage } from '~/engine/instrument/patterns';
import { withoutPointSpecular } from '~/engine/instrument/materials';
import { loadInstrumentTextures } from '~/engine/instrument/textures';
import { WIRE, coilPath } from '~/engine/instrument/wirePath';

type Drive = InstrumentPose['drive'];
const DRIVE_FIELDS = ['stack', 'mirror', 'grow', 'clamp', 'arm', 'chassis'] as const;
const driveOf = (value: number): Drive => ({ stack: value, mirror: value, grow: value, clamp: value, arm: value, chassis: value });

/** A pose: milestone 3's fields, the drive folded away unless asked for. */
function pose(fields: Partial<Omit<InstrumentPose, 'drive'>> & { drive?: Partial<Drive> } = {}): InstrumentPose {
  const { drive, ...rest } = fields;
  return { bearing: 0, lift: 0, portrait: 0, threads: 1, head: DRIVE.tracks.funcial, park: 0, platter: 0, ...rest, drive: { ...driveOf(0), ...drive } };
}

describe('the instrument', () => {
  const m = buildInstrument();
  it('ships its texture files', () => Object.values(TEXTURE_FILES).forEach((p) => expect(existsSync(`public${p}`)).toBe(true)));
  it('nests root → mount → spin, with the mount turning the face to +Z', () => {
    expect(m.mount.parent).toBe(m.root); expect(m.spin.parent).toBe(m.mount);
    m.root.updateMatrixWorld(true); const n = new THREE.Vector3(0, 1, 0).transformDirection(m.dial.matrixWorld);
    expect(n.z).toBeCloseTo(1); const north = new THREE.Vector3(0, 0, -1).transformDirection(m.dial.matrixWorld); expect(north.y).toBeCloseTo(1);
  });
  it('points the needle along its bearing', () => {
    m.applyPose(pose({ bearing: Math.PI / 2 })); m.root.updateMatrixWorld(true);
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
    m.applyPose(pose({ bearing: 0, lift: 0, portrait: 0, threads: 1 }));
    expect(m.needle.position.y).toBeCloseTo(0.05);
    needleMaterials.forEach((material) => { expect(material.transparent).toBe(true); expect(material.opacity).toBe(1); });
    m.applyPose(pose({ bearing: 0, lift: 1, portrait: 0.6, threads: 0.25 }));
    expect(m.needle.position.y).toBeCloseTo(0.1);
    needleMaterials.forEach((material) => expect(material.opacity).toBeCloseTo(0.15));
    m.applyPose(pose({ bearing: 0, lift: 0.5, portrait: 0.6, threads: 0.25 }));
    needleMaterials.forEach((material) => expect(material.opacity).toBeCloseTo(0.575));
    // The pin fades with it, so a lifted needle leaves the portrait's centre clear.
    const pin = (m.root.getObjectByName('compass:pin') as THREE.Mesh).material as THREE.Material;
    expect(pin.transparent).toBe(true); expect(pin.opacity).toBeCloseTo(0.575);
    m.applyPose(pose({ bearing: 0, lift: 1, portrait: 0.6, threads: 0.25 }));
    expect(pin.opacity).toBeCloseTo(0.15);
    m.applyPose(pose({ bearing: 0, lift: 0.5, portrait: 0.6, threads: 0.25 }));
    const threads = m.root.getObjectByName('compass:threads')!;
    threads.traverse((o) => { const mesh = o as THREE.Mesh; if (mesh.isMesh) expect((mesh.material as THREE.Material).opacity).toBeCloseTo(0.25); });
    // No portrait yet: the pool stays lacquer, whatever the pose asks.
    const portrait = m.root.getObjectByName('compass:portrait') as THREE.Mesh;
    expect(portrait.visible).toBe(false);
    m.setTextures({ portrait: new THREE.Texture() });
    expect(portrait.visible).toBe(true);
    expect((portrait.material as THREE.Material).opacity).toBeCloseTo(0.6);
    m.applyPose(pose({ bearing: 0, lift: 0, portrait: 0, threads: 0 }));
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
    m.applyPose(pose({ bearing: 1, lift: 1, portrait: 1, threads: 0 }));
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

describe('the drive inside the instrument', () => {
  type Model = ReturnType<typeof buildInstrument>;
  /** A point of `object`'s frame in the dial's frame. */
  const inDial = (m: Model, object: THREE.Object3D, x: number, y: number, z: number): THREE.Vector3 => {
    m.root.updateMatrixWorld(true);
    return m.dial.worldToLocal(object.localToWorld(new THREE.Vector3(x, y, z)));
  };
  const named = (m: Model, name: string) => m.root.getObjectByName(name) as THREE.Mesh;
  const materialOf = (m: Model, name: string) => named(m, name).material as THREE.MeshStandardMaterial;
  /** The largest and smallest distance from the dial's axis of a ring's vertices. */
  const radii = (mesh: THREE.Mesh): [number, number] => {
    const pos = (mesh.geometry as THREE.BufferGeometry).getAttribute('position');
    let lo = Infinity; let hi = 0;
    for (let i = 0; i < pos.count; i++) { const r = Math.hypot(pos.getX(i), pos.getZ(i)); lo = Math.min(lo, r); hi = Math.max(hi, r); }
    return [lo, hi];
  };
  /** The tilted, turned instrument a scene would show. */
  const leaning = (): Model => {
    const m = buildInstrument();
    m.root.rotation.set(0.3, -0.2, 0.1); m.spin.rotation.y = 0.7; m.root.position.set(0.4, -0.1, 0.2);
    return m;
  };

  it('poses every drive value on a 0.1 grid with finite geometry and no recompile', () => {
    const m = leaning();
    m.applyPose(pose());
    const before = new Map(m.materials().map((material) => [material, [material.version, material.transparent, material.depthWrite]]));
    let bad = 0;
    const check = (): void => {
      m.root.updateMatrixWorld(true);
      m.root.traverse((o) => {
        if (!o.matrixWorld.elements.every(Number.isFinite)) bad++;
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const array = (mesh.geometry as THREE.BufferGeometry).getAttribute('position').array;
        for (let i = 0; i < array.length; i++) if (!Number.isFinite(array[i])) bad++;
      });
      for (const material of m.materials()) if (!(material.opacity >= 0 && material.opacity <= 1)) bad++;
    };
    for (const others of [0, 1]) {
      for (const field of DRIVE_FIELDS) {
        for (let k = 0; k <= 10; k++) {
          const drive = driveOf(others);
          drive[field] = k / 10;
          for (const park of [0, 1]) {
            m.applyPose(pose({ drive, park, head: DRIVE.tracks.next, platter: 37 * k, bearing: 0.4 * k - 2 }));
            check();
          }
        }
      }
    }
    // Out-of-range and missing values read as their nearest sound ones.
    m.applyPose(pose({ drive: { stack: Number.NaN, mirror: -1, grow: 2, clamp: Infinity, arm: 0.5, chassis: Number.NaN }, head: Number.NaN, park: Number.NaN, platter: Number.NaN, bearing: Number.NaN }));
    check();
    m.applyPose(pose({ drive: driveOf(1), head: 0 }));
    check();
    expect(bad).toBe(0);
    before.forEach((was, material) => expect([material.version, material.transparent, material.depthWrite], material.name).toEqual(was));
  });

  it('puts the read head on its track, and on the ramp when parked', () => {
    const m = leaning();
    const head = new THREE.Vector3();
    for (const radius of [DRIVE.tracks['jontai-energy'], DRIVE.tracks.funcial, DRIVE.tracks.next]) {
      m.applyPose(pose({ drive: driveOf(1), head: radius, park: 0, bearing: 1.3 }));
      m.root.updateMatrixWorld(true);
      const p = m.dial.worldToLocal(m.headWorld(head).clone());
      expect(Math.abs(Math.hypot(p.x, p.z) - radius)).toBeLessThan(1e-3);
      expect(p.y).toBeCloseTo(DRIVE.armHeight, 6);
    }
    m.applyPose(pose({ drive: driveOf(1), head: 0.76, park: 1 }));
    const parked = m.dial.worldToLocal(m.headWorld(head).clone());
    expect(Math.abs(Math.hypot(parked.x, parked.z) - DRIVE.parkRadius)).toBeLessThan(1e-3);
    // The ramp sits under the parked head, and the head's slider just clears it.
    const ramp = inDial(m, named(m, 'compass:ramp'), 0, 0, 0);
    expect(Math.hypot(ramp.x - parked.x, ramp.z - parked.z)).toBeLessThan(1e-6);
    expect(ramp.y).toBeCloseTo(0, 9);
    const lowest = (mesh: THREE.Mesh): number => {
      const box = (mesh.geometry as THREE.BufferGeometry).boundingBox ?? (mesh.geometry.computeBoundingBox(), mesh.geometry.boundingBox!);
      let low = Infinity;
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) low = Math.min(low, inDial(m, mesh, x, y, z).y);
      return low;
    };
    const slider = named(m, 'compass:read-head');
    expect(slider.visible).toBe(true);
    expect(lowest(slider)).toBeGreaterThan(inDial(m, named(m, 'compass:ramp'), 0, RAMP.size[1], 0).y);
    // Over the platter it flies just above the top one; as the needle it is not there at all.
    m.applyPose(pose({ drive: driveOf(1), head: 0.64 }));
    expect(lowest(slider)).toBeGreaterThan(DRIVE.platter.rise);
    m.applyPose(pose());
    expect(slider.visible).toBe(false);
  });

  it('leaves the needle exactly as milestone 3 had it while the arm is 0', () => {
    for (const others of [0, 1]) {
      const m = leaning();
      for (const [bearing, lift] of [[0, 0], [1.2, 0], [-2.9, 0.5], [Math.PI / 2, 1]]) {
        m.applyPose(pose({ drive: { ...driveOf(others), arm: 0 }, bearing, lift, head: 0.64, park: 1 }));
        m.root.updateMatrixWorld(true);
        // Milestone 3: the needle at the dial's centre, NEEDLE.y up plus its lift, turned by -bearing, its halves unscaled.
        const expected = new THREE.Object3D();
        expected.position.y = 0.05 + 0.05 * lift;
        expected.rotation.y = -bearing;
        expected.updateMatrix();
        const world = m.dial.matrixWorld.clone().multiply(expected.matrix);
        expect(m.needle.matrixWorld.elements).toEqual(world.elements);
        for (const name of ['compass:needle-tip', 'compass:needle-tail', 'compass:needle-hub']) expect(named(m, name).matrixWorld.elements, name).toEqual(world.elements);
      }
    }
  });

  it('grows the rings into full platters and stacks them apart in depth', () => {
    const m = buildInstrument();
    m.applyPose(pose({ drive: { grow: 1 } }));
    for (const id of ['degree', 'direction', 'pattern'] as const) {
      const [inner, outer] = radii(m.rings[id].mesh);
      expect(Math.abs(outer - DRIVE.platter.outer), id).toBeLessThan(1e-3);
      expect(Math.abs(inner - DRIVE.platter.inner), id).toBeLessThan(1e-3);
    }
    m.applyPose(pose({ drive: { stack: 1 } }));
    const height = (id: 'degree' | 'direction' | 'pattern') => inDial(m, m.rings[id].mesh, 0.5, 0, 0).y;
    expect(height('pattern')).toBeGreaterThan(height('direction'));
    expect(height('direction')).toBeGreaterThan(height('degree'));
    expect(height('pattern')).toBeCloseTo(DRIVE.platter.rise, 9);
    expect(height('direction')).toBeCloseTo(-DRIVE.platter.gap, 9);
    expect(height('degree')).toBeCloseTo(-2 * DRIVE.platter.gap, 9);
    expect(inDial(m, named(m, 'compass:bed'), 0.5, 0, 0).y).toBeCloseTo(-3 * DRIVE.platter.gap - 0.01, 9);
    // Folded again, every ring is back on the face at its own radii.
    m.applyPose(pose());
    for (const id of ['degree', 'direction', 'pattern'] as const) {
      expect(inDial(m, m.rings[id].mesh, 0.5, 0, 0).y, id).toBeCloseTo(0, 9);
      const [inner, outer] = radii(m.rings[id].mesh);
      expect(inner).toBeCloseTo(DIAL.rings[id][0], 4); expect(outer).toBeCloseTo(DIAL.rings[id][1], 4);
    }
  });

  it('closes the trigram ring into the clamp above the top platter, and the pool into the hub', () => {
    const m = buildInstrument();
    m.applyPose(pose({ drive: { stack: 1, clamp: 1 } }));
    const [inner, outer] = radii(m.rings.trigram.mesh);
    expect(inner).toBeCloseTo(DRIVE.clamp[0], 4); expect(outer).toBeCloseTo(DRIVE.clamp[1], 4);
    expect(inDial(m, m.rings.trigram.mesh, 0.15, 0, 0).y).toBeCloseTo(DRIVE.platter.rise + 0.015, 9);
    const floorEdge = inDial(m, named(m, 'compass:pool-floor'), DIAL.pool, 0, 0);
    expect(Math.hypot(floorEdge.x, floorEdge.z)).toBeCloseTo(DRIVE.hub, 6);
    expect(named(m, 'compass:glass').visible).toBe(false);
    expect(named(m, 'compass:hub').visible).toBe(true);
    m.applyPose(pose());
    expect(named(m, 'compass:hub').visible).toBe(false);
    expect(named(m, 'compass:glass').visible).toBe(true);
    expect((named(m, 'compass:glass').material as THREE.Material).opacity).toBeCloseTo(0.12);
  });

  it('turns the platters counter-clockwise with `platter`, and a whole turn shows unchanged', () => {
    const m = buildInstrument();
    expect(m.platter.parent).toBe(m.dial);
    let top: THREE.Object3D | null = m.topPlatter();
    while (top && top !== m.platter) top = top.parent;
    expect(top).toBe(m.platter);
    for (const id of ['degree', 'direction', 'pattern'] as const) {
      let up: THREE.Object3D | null = m.rings[id].mesh;
      while (up && up !== m.platter) up = up.parent;
      expect(up, id).toBe(m.platter);
    }
    m.applyPose(pose({ drive: driveOf(1), platter: 90 }));
    const p = inDial(m, m.topPlatter(), 0, 0, -0.5);
    expect((bearingOf(p.x, p.z) * 180) / Math.PI).toBeCloseTo(-90, 6);
    expect(p.y).toBeCloseTo(DRIVE.platter.rise, 9);
    m.applyPose(pose({ platter: 0 }));
    const still = inDial(m, m.rings.pattern.mesh, 0.3, 0, -0.8);
    m.applyPose(pose({ platter: 720 }));
    const turned = inDial(m, m.rings.pattern.mesh, 0.3, 0, -0.8);
    expect(turned.distanceTo(still)).toBeLessThan(1e-9);
  });

  it('anchors the coil at the arm\'s tail, along the arm', () => {
    const m = buildInstrument();
    m.applyPose(pose({ drive: driveOf(1), head: DRIVE.tracks.funcial }));
    const { anchor, axis } = m.coilAnchor();
    // Its middle half its length in from the tail's end, so it is wound wholly on the tail.
    expect(Math.hypot(anchor[0] - DRIVE.pivot[0], anchor[2] - DRIVE.pivot[1])).toBeCloseTo(DRIVE.yoke - WIRE.coil.length / 2, 9);
    expect(anchor[1]).toBeCloseTo(DRIVE.armHeight, 9);
    expect(Math.hypot(...axis)).toBeCloseTo(1, 9);
    // The axis runs from the tail through the pivot to the head.
    const head = m.dial.worldToLocal(m.headWorld(new THREE.Vector3()));
    const toHead = new THREE.Vector3(head.x - anchor[0], head.y - anchor[1], head.z - anchor[2]).normalize();
    expect(toHead.dot(new THREE.Vector3(...axis))).toBeCloseTo(1, 9);
    const a = (armBearing(DRIVE.tracks.funcial)! * Math.PI) / 180;
    expect(axis[0]).toBeCloseTo(Math.sin(a), 9); expect(axis[2]).toBeCloseTo(-Math.cos(a), 9);
    // As the compass, on the needle's tail, as far in from its end.
    m.applyPose(pose({ bearing: 0 }));
    const rest = m.coilAnchor();
    expect(rest.anchor[0]).toBeCloseTo(0, 9); expect(rest.anchor[1]).toBeCloseTo(0.05, 9); expect(rest.anchor[2]).toBeCloseTo(DIAL.needle.tail - WIRE.coil.length / 2, 9);
    expect(rest.axis[2]).toBeCloseTo(-1, 9);
  });

  it('keeps the arm and its coil clear of the magnets on every track and on the ramp', () => {
    const m = buildInstrument();
    /** Points over every face of a mesh, in world space: each triangle's corners and a grid inside it. */
    const over = (mesh: THREE.Mesh): THREE.Vector3[] => {
      const pos = (mesh.geometry as THREE.BufferGeometry).getAttribute('position');
      const index = (mesh.geometry as THREE.BufferGeometry).getIndex();
      const count = index ? index.count : pos.count;
      const at = (k: number) => new THREE.Vector3().fromBufferAttribute(pos, index ? index.getX(k) : k);
      const points: THREE.Vector3[] = [];
      for (let t = 0; t < count; t += 3) {
        const [a, b, c] = [at(t), at(t + 1), at(t + 2)];
        for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8 - i; j++) {
          const p = a.clone().multiplyScalar(1 - (i + j) / 8).addScaledVector(b, i / 8).addScaledVector(c, j / 8);
          points.push(p.applyMatrix4(mesh.matrixWorld));
        }
      }
      return points;
    };
    const stops: [string, number, number][] = [...TRACKS.map((id): [string, number, number] => [id, DRIVE.tracks[id], 0]), ['the ramp', DRIVE.tracks.next, 1]];
    for (const [label, head, park] of stops) {
      m.applyPose(pose({ drive: driveOf(1), head, park }));
      m.root.updateMatrixWorld(true);
      const boxes = ['compass:magnet-west', 'compass:magnet-east', 'compass:magnet-plate'].map((name) => [name, new THREE.Box3().setFromObject(named(m, name))] as const);
      // The blade (its broad root most of all), its tail and the pivot's hub.
      for (const name of ['compass:needle-tip', 'compass:needle-tail', 'compass:needle-hub']) {
        const inside = over(named(m, name)).filter((p) => boxes.some(([, box]) => box.containsPoint(p)));
        expect(inside.length, `${label}: ${name} inside a magnet`).toBe(0);
      }
      // The coil: the wire's tube round its helix.
      const { anchor, axis } = m.coilAnchor();
      const coil = coilPath(anchor, axis).map((q) => m.dial.localToWorld(new THREE.Vector3(...q)));
      for (const [name, box] of boxes) {
        const tube = box.clone().expandByScalar(WIRE.radius);
        expect(coil.filter((p) => tube.containsPoint(p)).length, `${label}: the coil inside ${name}`).toBe(0);
      }
    }
  });

  it('moves the arm in three phases: the blade slides, the pivot hops to the corner, the blade turns and settles', () => {
    const rest = armState(0.3, 0, 0, 0.76, 0);
    expect(rest).toMatchObject({ x: 0, y: 0.05, z: 0, bearing: 0.3, tip: DIAL.needle.tip, tail: DIAL.needle.tail, travel: 0 });
    // The blade slides on its pivot until the pivot sets off; it has the arm's length by 0.4, and turns only from 0.7.
    expect(armState(0.3, 0, 0.3, 0.76, 0)).toMatchObject({ x: 0, z: 0, travel: 0 });
    const slid = armState(0.3, 0, 0.4, 0.76, 0);
    expect(slid.tip).toBeCloseTo(DRIVE.armLength, 12); expect(slid.tail).toBeCloseTo(DRIVE.yoke, 12);
    expect(armState(0.3, 0, 0.7, 0.76, 0).bearing).toBe(0.3);
    // Mid-travel the pivot is at its highest, at DRIVE.travelLift.
    expect(armState(0.3, 0, 0.55, 0.76, 0).y).toBeCloseTo(DRIVE.travelLift, 12);
    const landed = armState(0.3, 0, 1, 0.76, 0);
    expect(landed.x).toBe(DRIVE.pivot[0]); expect(landed.z).toBe(DRIVE.pivot[1]); expect(landed.y).toBeCloseTo(DRIVE.armHeight, 12);
    expect(landed.bearing).toBeCloseTo((armBearing(0.76)! * Math.PI) / 180, 12);
    expect(Math.hypot(...headPoint((landed.bearing * 180) / Math.PI))).toBeCloseTo(0.76, 9);
    const parked = armState(0.3, 0, 1, 0.76, 1);
    expect(parked.bearing).toBeCloseTo((armBearing(DRIVE.parkRadius)! * Math.PI) / 180, 12);
    // Past the top of its hop the pivot only comes down, and lands at the arm's height: it never dips under it and rises again.
    let height = armState(0.3, 0, 0.55, 0.76, 0).y;
    for (let k = 551; k <= 1000; k++) {
      const y = armState(0.3, 0, k / 1000, 0.76, 0).y;
      expect(y, `arm ${k / 1000}`).toBeLessThanOrEqual(height + 1e-12);
      expect(y, `arm ${k / 1000}`).toBeGreaterThanOrEqual(DRIVE.armHeight - 1e-12);
      height = y;
    }
    // It never jumps: small steps of `arm` move every value a little.
    let last = armState(2.5, 0, 0, 0.88, 0.3);
    for (let k = 1; k <= 1000; k++) {
      const next = armState(2.5, 0, k / 1000, 0.88, 0.3);
      for (const key of ['x', 'y', 'z', 'bearing', 'tip', 'tail'] as const) expect(Math.abs(next[key] - last[key]), key).toBeLessThan(0.02);
      last = next;
    }
    // Unsound input reads as sound.
    for (const value of Object.values(armState(Number.NaN, Number.NaN, Number.NaN, Number.NaN, Number.NaN))) expect(Number.isFinite(value)).toBe(true);
    for (const value of Object.values(armState(0, 0, 1, 0, 0))) expect(Number.isFinite(value)).toBe(true);
  });

  it('wipes the face and the pattern ring to mirror, and fades the rules, rim and threads with it', () => {
    const m = buildInstrument();
    const face = m.rings.direction.mesh.material as THREE.MeshStandardMaterial;
    const pattern = m.rings.pattern.mesh.material as THREE.MeshPhysicalMaterial;
    const faceUniforms = face.userData.uniforms as Record<string, THREE.IUniform<number>>;
    const patternUniforms = pattern.userData.uniforms as Record<string, THREE.IUniform<number>>;
    expect(faceUniforms.uMirror).toBe(patternUniforms.uMirror);
    expect(faceUniforms.uMirrorOrigin.value).toBeCloseTo(DRIVE.mirrorFrom / 360, 12);
    m.applyPose(pose({ drive: { mirror: 0.4 }, threads: 0.5 }));
    expect(faceUniforms.uMirror.value).toBeCloseTo(0.4);
    const rule = named(m, `compass:rule-${DIAL.rules[0]}`);
    const rim = named(m, 'compass:rim');
    const thread = named(m, 'compass:thread-ns');
    expect((rule.material as THREE.Material).opacity).toBeCloseTo(0.6);
    expect((rim.material as THREE.Material).opacity).toBeCloseTo(0.6);
    expect((thread.material as THREE.Material).opacity).toBeCloseTo(0.3);
    m.applyPose(pose({ drive: { mirror: 1 } }));
    for (const mesh of [rule, rim, thread]) expect(mesh.visible, mesh.name).toBe(false);
    // The rim's brass is its own, so the plate's brass edge and the pool's wall stay.
    expect(rim.material).not.toBe(materialOf(m, 'compass:pool-wall'));
    expect(materialOf(m, 'compass:pool-wall').opacity).toBe(1);
    m.applyPose(pose());
    for (const mesh of [rule, rim, thread]) expect(mesh.visible, mesh.name).toBe(true);
    expect(faceUniforms.uMirror.value).toBe(0);
  });

  it('patches the face and the pattern ring with the mirror wipe of sweepCoverage, from the local position', () => {
    const m = buildInstrument();
    const compiled = (material: THREE.Material) => {
      const lib = (material as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial ? THREE.ShaderLib.physical : THREE.ShaderLib.standard;
      const shader = { uniforms: {} as Record<string, THREE.IUniform>, vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader };
      material.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
      return shader;
    };
    for (const material of [m.rings.degree.mesh.material, m.rings.pattern.mesh.material] as THREE.Material[]) {
      const shader = compiled(material);
      expect(shader.vertexShader, material.name).toContain('vDialPos = position;');
      expect(shader.fragmentShader, material.name).toContain('uniform float uMirror;');
      expect(shader.fragmentShader).toContain('atan( vDialPos.x, -vDialPos.z )');
      expect(shader.fragmentShader).toContain('uMirror * ( 0.5 + ');
      expect(shader.fragmentShader).toContain(`float grainRing = length( vDialPos.xz ) * ${MIRROR.grainRings.toFixed(1)};`);
      // Faded out where a ring is finer than the screen draws, so it never shimmers.
      expect(shader.fragmentShader).toContain('fwidth( grainRing )');
      expect(shader.fragmentShader).toContain('metalnessFactor = mix( metalnessFactor, 1.0, mirrorCover );');
      for (const name of ['uMirror', 'uMirrorOrigin']) expect(shader.uniforms[name]).toBe((material.userData.uniforms as Record<string, unknown>)[name]);
      // Still the pearl's patch, and (the pattern) still its sweep.
      expect(shader.fragmentShader).not.toContain('#include <lights_fragment_begin>');
      expect(material.customProgramCacheKey()).toBe(material.name);
    }
    expect(compiled(m.rings.pattern.mesh.material as THREE.Material).fragmentShader).toContain('fract( vMapUv.x - uOrigin )');
    // The wipe's formula, run in JS on a bearing, is sweepCoverage's at u = bearing / 360.
    const smoothstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const shaderCover = (x: number, z: number, origin: number, mirror: number) => {
      const turn = Math.atan2(x, -z) / (2 * Math.PI) - origin;
      const around = turn - Math.floor(turn); const d = Math.min(around, 1 - around); const front = mirror * (0.5 + 0.015);
      return 1 - smoothstep(front - 0.015, front, d);
    };
    for (const [bearing, mirror] of [[135, 0.1], [200, 0.3], [10, 0.9], [300, 0], [315, 1]]) {
      const b = (bearing * Math.PI) / 180;
      expect(shaderCover(0.6 * Math.sin(b), -0.6 * Math.cos(b), DRIVE.mirrorFrom / 360, mirror)).toBeCloseTo(sweepCoverage(bearing / 360, DRIVE.mirrorFrom / 360, mirror), 9);
    }
  });

  it('turns the needle\'s glow into the read head and its brass to steel as the arm forms', () => {
    const m = buildInstrument();
    const tip = materialOf(m, 'compass:needle-tip');
    const tail = materialOf(m, 'compass:needle-tail');
    const uniforms = tip.userData.uniforms as Record<string, THREE.IUniform<number>>;
    m.applyPose(pose());
    expect(uniforms.uSteel.value).toBe(0);
    expect(tail.color.getHexString()).toBe('c9a24a');
    m.applyPose(pose({ drive: driveOf(1) }));
    expect(uniforms.uSteel.value).toBe(1);
    expect(uniforms.uHeadFrom.value).toBeGreaterThan(0.9); expect(uniforms.uHeadFrom.value).toBeLessThan(1);
    expect(tail.color.getHexString()).not.toBe('c9a24a');
    expect(tail.metalness).toBe(1);
    m.applyPose(pose());
    expect(tail.color.getHexString()).toBe('c9a24a');
    expect(tail.metalness).toBeCloseTo(0.5, 12);
  });

  it('crossfades the plate into the aluminium chassis, with its magnets and ramp', () => {
    const m = buildInstrument();
    const plate = named(m, 'compass:plate');
    const chassis = named(m, 'compass:chassis');
    const aluminium = chassis.material as THREE.MeshStandardMaterial;
    expect(chassis.geometry).toBe(plate.geometry);
    expect(chassis.visible).toBe(false);
    m.applyPose(pose({ drive: { chassis: 0.5 } }));
    expect(chassis.visible).toBe(true); expect(plate.visible).toBe(true);
    expect(aluminium.opacity).toBeCloseTo(0.5);
    const magnets = m.root.getObjectByName('compass:magnets')!;
    // Each block grows in its own place, about its own foot, so none passes through the coil on its way.
    expect(magnets.visible).toBe(true);
    for (const block of magnets.children) expect(block.scale.x, block.name).toBeCloseTo(0.5);
    m.applyPose(pose({ drive: { chassis: 1 } }));
    expect(aluminium.opacity).toBe(1); expect(plate.visible).toBe(false);
    // The magnets stand round the pivot, on the chassis.
    const centre = inDial(m, magnets, 0, 0, 0);
    expect(centre.x).toBeCloseTo(DRIVE.pivot[0], 9); expect(centre.z).toBeCloseTo(DRIVE.pivot[1], 9); expect(centre.y).toBeCloseTo(0, 9);
    let blocks = 0;
    magnets.traverse((o) => { if ((o as THREE.Mesh).isMesh) blocks++; });
    // Two blocks either side of the coil, on the plate under it.
    expect(blocks).toBe(3);
    m.applyPose(pose());
    expect(chassis.visible).toBe(false); expect(plate.visible).toBe(true); expect(magnets.visible).toBe(false);
    expect(named(m, 'compass:ramp').visible).toBe(false);
    // The brushed aluminium arrives as a texture swap, tinted to its colour.
    const version = aluminium.version;
    const image = new THREE.Texture();
    m.setTextures({ aluminium: image });
    expect(aluminium.map).toBe(image);
    expect(aluminium.version).toBe(version);
  });

  it('lists the drive\'s materials for the warm-up, made transparent where they fade', () => {
    const m = buildInstrument();
    const listed = new Set(m.materials());
    for (const name of ['compass:chassis', 'compass:hub', 'compass:ramp', 'compass:rim']) expect(listed.has(materialOf(m, name)), name).toBe(true);
    for (const name of ['compass:chassis', 'compass:rim', `compass:rule-${DIAL.rules[0]}`, 'compass:glass', 'compass:thread-ns']) expect(materialOf(m, name).transparent, name).toBe(true);
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
    expect(textures.aluminium?.colorSpace).toBe(THREE.SRGBColorSpace);
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
    expect(all).toBeNull();
    pending.get(TEXTURE_FILES.aluminium)!(new THREE.Texture());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(arrived.map(([key]) => key).sort()).toEqual(['aluminium', 'brass', 'lacquer', 'portrait']);
    expect(Object.keys(all as object).sort()).toEqual(['aluminium', 'brass', 'lacquer', 'portrait']);
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
