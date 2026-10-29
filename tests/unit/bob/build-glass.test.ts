import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { describe, expect, it, vi } from 'vitest';
import { buildEngraving, ENGRAVING_LOOK, revealCount } from '~/engine/bob/build/engraving';
import { buildGlass, GLASS_LOOK, GLASS_RENDER_ORDER, streakDirection, streakTaps } from '~/engine/bob/build/glassFloor';
import { applyCameraShot, type CameraShot, homeShotFor, topShotFor } from '~/engine/bob/shots';
import { buildTraces, TRACES_LOOK } from '~/engine/bob/build/traces';
import { traceLayout, TRACE } from '~/engine/bob/traces';
import { circlePath, strokeLength, strokePath, tickSegments, WORDMARK } from '~/engine/bob/wordmark';
import { palette } from '~/engine/palette';

/** The object called `name` under `root`, which must exist. */
function objectNamed(root: THREE.Object3D, name: string): THREE.Object3D {
  const found = root.getObjectByName(name);
  expect(found, name).toBeDefined();
  return found as THREE.Object3D;
}

/** The mesh called `name` under `root`, which must exist. */
function meshNamed(root: THREE.Object3D, name: string): THREE.Mesh {
  return objectNamed(root, name) as THREE.Mesh;
}

/** Whether anything under `root` is called `name`. */
function hasNamed(root: THREE.Object3D, name: string): boolean {
  return root.getObjectByName(name) !== undefined;
}

/** Every geometry, material and texture the drawn objects under `root` hold, once each. */
function resources(root: THREE.Object3D): Set<{ dispose(): void }> {
  const parts = new Set<{ dispose(): void }>();
  root.traverse((o) => {
    const drawn = o as THREE.Mesh;
    if (!drawn.geometry) return;
    parts.add(drawn.geometry);
    for (const material of [drawn.material].flat() as THREE.MeshPhysicalMaterial[]) {
      parts.add(material);
      for (const texture of [material.map, material.roughnessMap, material.clearcoatRoughnessMap]) if (texture) parts.add(texture);
    }
  });
  return parts;
}

/** The distance of each vertex from the y axis, smallest and largest. */
function radii(geometry: THREE.BufferGeometry): { min: number; max: number } {
  const position = geometry.getAttribute('position');
  let min = Infinity;
  let max = 0;
  for (let i = 0; i < position.count; i++) {
    const r = Math.hypot(position.getX(i), position.getZ(i));
    min = Math.min(min, r);
    max = Math.max(max, r);
  }
  return { min, max };
}

/** The centre of ring `k` of a tube: the mean of its six distinct vertices. */
function ringCentre(geometry: THREE.BufferGeometry, k: number, radial = 6): THREE.Vector3 {
  const position = geometry.getAttribute('position');
  const centre = new THREE.Vector3();
  for (let i = 0; i < radial; i++) centre.add(new THREE.Vector3().fromBufferAttribute(position, k * (radial + 1) + i));
  return centre.divideScalar(radial);
}

/** A colour as a multiple of a palette hex, in linear light, as the builders make it. */
function times(hex: number, scale: number): THREE.Color {
  return new THREE.Color(hex).multiplyScalar(scale);
}

function expectColour(actual: THREE.Color, expected: THREE.Color): void {
  expect(actual.r).toBeCloseTo(expected.r, 6);
  expect(actual.g).toBeCloseTo(expected.g, 6);
  expect(actual.b).toBeCloseTo(expected.b, 6);
}

describe('revealCount', () => {
  it('reveals a stroke by whole tube segments', () => {
    expect(revealCount(0, 400, 6)).toBe(0);
    expect(revealCount(0.5, 400, 6)).toBe(200 * 6 * 6);
    expect(revealCount(1.5, 400, 6)).toBe(400 * 6 * 6);
  });

  it('rounds down to a whole segment, and reads a negative or NaN fraction as nothing', () => {
    expect(revealCount(0.2599, 400, 6)).toBe(103 * 36);
    expect(revealCount(-1, 400, 6)).toBe(0);
    expect(revealCount(Number.NaN, 400, 6)).toBe(0);
    expect(revealCount(1, 100, 4)).toBe(100 * 4 * 6);
  });
});

describe('the engraving', () => {
  // The B letters are bands now (spec 2026-10-29-bob-stack-2-design.md, goal 5; tests/unit/bob/build-engraving-letters.test.ts):
  // the circle is the one engraved stroke the loader cuts.
  it('builds the circle as a tube and draws none of it at first', () => {
    const e = buildEngraving();
    expect(e.group.name).toBe('engraving');
    expect(meshNamed(e.group, 'stroke:circle').geometry.drawRange.count).toBe(0);
    expect(meshNamed(e.group, 'outer').geometry.drawRange.count).toBe(0);
    e.dispose();
  });

  it('makes the circle a 6-sided tube of the engraving width with about 120 segments a metre', () => {
    const e = buildEngraving();
    for (const id of ['circle'] as const) {
      const geometry = meshNamed(e.group, `stroke:${id}`).geometry as THREE.TubeGeometry;
      expect(geometry).toBeInstanceOf(THREE.TubeGeometry);
      expect(geometry.parameters.radius).toBe(WORDMARK.engrave);
      expect(geometry.parameters.radialSegments).toBe(6);
      expect(Math.abs(geometry.parameters.tubularSegments - strokeLength(id) * 120)).toBeLessThanOrEqual(1);
    }
    e.dispose();
  });

  it('lays the tube along the circle, centred on the glass so that half of it is sunk', () => {
    const e = buildEngraving();
    for (const id of ['circle'] as const) {
      const geometry = meshNamed(e.group, `stroke:${id}`).geometry as THREE.TubeGeometry;
      const path = strokePath(id);
      const first = ringCentre(geometry, 0);
      const last = ringCentre(geometry, geometry.parameters.tubularSegments);
      expect(first.x).toBeCloseTo(path[0][0], 5);
      expect(first.z).toBeCloseTo(path[0][1], 5);
      expect(last.x).toBeCloseTo(path[path.length - 1][0], 5);
      expect(last.z).toBeCloseTo(path[path.length - 1][1], 5);
      // The rings sit on y = 0 and no vertex is farther from it than the tube's radius.
      const position = geometry.getAttribute('position');
      for (let k = 0; k <= geometry.parameters.tubularSegments; k += 97) expect(ringCentre(geometry, k).y).toBeCloseTo(0, 6);
      for (let i = 0; i < position.count; i++) expect(Math.abs(position.getY(i))).toBeLessThanOrEqual(WORDMARK.engrave + 1e-9);
    }
    e.dispose();
  });

  it('draws the tube at constant speed along the circle: the segments are equal in length', () => {
    const e = buildEngraving();
    const geometry = meshNamed(e.group, 'stroke:circle').geometry as THREE.TubeGeometry;
    const step = strokeLength('circle') / geometry.parameters.tubularSegments;
    for (let k = 1; k <= geometry.parameters.tubularSegments; k += 53) {
      // Round the circle, a ring is one step (or a hair less, across a sample of it) from the last.
      expect(ringCentre(geometry, k).distanceTo(ringCentre(geometry, k - 1))).toBeLessThanOrEqual(step + 1e-6);
      expect(ringCentre(geometry, k).distanceTo(ringCentre(geometry, k - 1))).toBeGreaterThan(step * 0.7);
    }
    e.dispose();
  });

  it('sets the circle to its drawn share by whole segments', () => {
    const e = buildEngraving();
    const tube = (id: string) => meshNamed(e.group, `stroke:${id}`).geometry as THREE.TubeGeometry;
    const tubular = tube('circle').parameters.tubularSegments;
    e.setStroke('circle', 0.5);
    expect(tube('circle').drawRange.count).toBe(revealCount(0.5, tubular, 6));
    expect(tube('circle').drawRange.start).toBe(0);
    e.setStroke('circle', 1);
    expect(tube('circle').drawRange.count).toBe(tube('circle').index!.count);
    e.setStroke('circle', 7);
    expect(tube('circle').drawRange.count).toBe(tube('circle').index!.count);
    e.setStroke('circle', -1);
    expect(tube('circle').drawRange.count).toBe(0);
    e.setStroke('circle', 0.5);
    e.setStroke('circle', Number.NaN);
    expect(tube('circle').drawRange.count).toBe(0);
    e.dispose();
  });

  it('draws the outer ring as a 0.0055 tube round the outer radius, revealed like a stroke', () => {
    const e = buildEngraving();
    const ring = meshNamed(e.group, 'outer').geometry as THREE.TubeGeometry;
    expect(ring.parameters.radius).toBe(0.0055);
    expect(ring.parameters.radialSegments).toBe(6);
    expect(Math.abs(ring.parameters.tubularSegments - 2 * Math.PI * WORDMARK.outer * 120)).toBeLessThanOrEqual(1);
    const { min, max } = radii(ring);
    expect(min).toBeGreaterThan(WORDMARK.outer - 0.0056);
    expect(max).toBeLessThan(WORDMARK.outer + 0.0056);
    const start = circlePath(WORDMARK.outer)[0];
    expect(ringCentre(ring, 0).x).toBeCloseTo(start[0], 5);
    expect(ringCentre(ring, 0).z).toBeCloseTo(start[1], 5);
    e.setOuter(0.25);
    expect(ring.drawRange.count).toBe(revealCount(0.25, ring.parameters.tubularSegments, 6));
    e.setOuter(2);
    expect(ring.drawRange.count).toBe(ring.index!.count);
    e.dispose();
  });

  // Task 12: at 0.009 a tick read under a pixel across the sides of the ring at home and everywhere on a phone.
  it('makes each tick 0.013 wide, a pixel or more across the front of the ring on a phone', () => {
    expect(ENGRAVING_LOOK.ticks.width).toBe(0.013);
    const e = buildEngraving();
    const position = meshNamed(e.group, 'ticks').geometry.getAttribute('position');
    for (const k of [0, 36, 77, 143]) {
      const i = k * 4;
      // Corners 0 and 1 are the inner end's two sides.
      const across = Math.hypot(position.getX(i) - position.getX(i + 1), position.getZ(i) - position.getZ(i + 1));
      expect(across).toBeCloseTo(0.013, 6);
    }
    // The phone's home camera stands about 14.9 off at a 50 degree field over 1688 device pixels: 0.0082 a pixel.
    const metresPerPixel = (2 * 14.9 * Math.tan((25 * Math.PI) / 180)) / 1688;
    expect(ENGRAVING_LOOK.ticks.width / metresPerPixel).toBeGreaterThanOrEqual(1);
    e.dispose();
  });

  it('flattens the 144 ticks into quads from the circle outward, cut off where along passes grown', () => {
    const e = buildEngraving();
    const ticks = meshNamed(e.group, 'ticks');
    const material = ticks.material as THREE.ShaderMaterial;
    expect(material).toBeInstanceOf(THREE.ShaderMaterial);
    const position = ticks.geometry.getAttribute('position');
    const along = ticks.geometry.getAttribute('along');
    expect(position.count).toBe(144 * 4);
    expect(ticks.geometry.index!.count).toBe(144 * 6);
    // Each tick's inner pair of corners has along 0 and its outer pair 1.
    const segments = tickSegments();
    for (const k of [0, 6, 12, 77, 143]) {
      const [inner, outer] = segments[k];
      for (let c = 0; c < 4; c++) {
        const i = k * 4 + c;
        const r = Math.hypot(position.getX(i), position.getZ(i));
        const target = along.getX(i) === 0 ? Math.hypot(inner[0], inner[1]) : Math.hypot(outer[0], outer[1]);
        expect(along.getX(i) === 0 || along.getX(i) === 1).toBe(true);
        expect(r).toBeCloseTo(target, 3);
      }
    }
    // Flat: every corner on one plane, a hair above the glass so it cannot z-fight it.
    for (let i = 0; i < position.count; i++) expect(position.getY(i)).toBeCloseTo(ENGRAVING_LOOK.ticks.lift, 7);
    expect(ENGRAVING_LOOK.ticks.lift).toBeGreaterThan(0);
    expect(material.fragmentShader).toMatch(/if\s*\(\s*vAlong\s*>\s*uGrown\s*\)\s*discard/);
    e.dispose();
  });

  it('grows the ticks with setTicks, and shows none until they start', () => {
    const e = buildEngraving();
    const ticks = meshNamed(e.group, 'ticks');
    const material = ticks.material as THREE.ShaderMaterial;
    expect(material.uniforms.uGrown.value).toBe(0);
    expect(ticks.visible).toBe(false);
    e.setTicks(0.4);
    expect(material.uniforms.uGrown.value).toBeCloseTo(0.4, 9);
    expect(ticks.visible).toBe(true);
    e.setTicks(3);
    expect(material.uniforms.uGrown.value).toBe(1);
    e.setTicks(Number.NaN);
    expect(material.uniforms.uGrown.value).toBe(0);
    expect(ticks.visible).toBe(false);
    e.dispose();
  });

  it('is basic, tone-mapped and fogged, in the amber times its glow', () => {
    const e = buildEngraving();
    const stroke = meshNamed(e.group, 'stroke:circle').material as THREE.MeshBasicMaterial;
    expect(stroke).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect(stroke.toneMapped).toBe(true);
    expect(stroke.fog).toBe(true);
    expect(stroke.transparent).toBe(false);
    const ticks = meshNamed(e.group, 'ticks').material as THREE.ShaderMaterial;
    expect(ticks.fog).toBe(true);
    expect(ticks.toneMapped).toBe(true);
    expect(ticks.uniforms.fogColor).toBeDefined();
    expect(ticks.fragmentShader).toContain('#include <fog_fragment>');
    expect(ticks.fragmentShader).toContain('#include <tonemapping_fragment>');
    e.dispose();
  });

  // Task 12: the hot amber read bright orange; the preview's lines glow in its gold light (GOLD_EMIT), pale where strong.
  it('sets every part to the gold light times the glow, the ticks and the outer ring a share of it', () => {
    const e = buildEngraving();
    const colours = () => ({
      stroke: (meshNamed(e.group, 'stroke:circle').material as THREE.MeshBasicMaterial).color.clone(),
      circle: (meshNamed(e.group, 'stroke:circle').material as THREE.MeshBasicMaterial).color.clone(),
      outer: (meshNamed(e.group, 'outer').material as THREE.MeshBasicMaterial).color.clone(),
      ticks: ((meshNamed(e.group, 'ticks').material as THREE.ShaderMaterial).uniforms.uColour.value as THREE.Color).clone()
    });
    e.setGlow(1);
    let c = colours();
    expect(ENGRAVING_LOOK.colour).toBe(palette.goldLight);
    expectColour(c.stroke, times(palette.goldLight, ENGRAVING_LOOK.gain * ENGRAVING_LOOK.share.stroke));
    expectColour(c.circle, c.stroke);
    expectColour(c.outer, times(palette.goldLight, ENGRAVING_LOOK.gain * ENGRAVING_LOOK.share.outer));
    expectColour(c.ticks, times(palette.goldLight, ENGRAVING_LOOK.gain * ENGRAVING_LOOK.share.ticks));
    e.setGlow(0.5);
    const half = colours();
    expectColour(half.stroke, c.stroke.clone().multiplyScalar(0.5));
    expectColour(half.ticks, c.ticks.clone().multiplyScalar(0.5));
    e.setGlow(-3);
    c = colours();
    expect([c.stroke.r, c.stroke.g, c.stroke.b, c.outer.r, c.ticks.r]).toEqual([0, 0, 0, 0, 0]);
    e.setGlow(Number.NaN);
    expect(colours().stroke.r).toBe(0);
    e.dispose();
  });

  it('frees every geometry and material it made', () => {
    const e = buildEngraving();
    const parts = resources(e.group);
    // The circle, the outer ring and the ticks, and the B letters' glass, rims and ticks; the circle's material, the outer
    // ring's and the ticks', and the letters' glass, rims and ticks (their light front).
    expect([...parts].filter((p) => p instanceof THREE.BufferGeometry)).toHaveLength(6);
    expect([...parts].filter((p) => p instanceof THREE.Material)).toHaveLength(6);
    const spies = [...parts].map((part) => vi.spyOn(part, 'dispose'));
    e.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalled();
  });
});

describe('the glass', () => {
  it('closes the cap as the iris opens and hides it when open', () => {
    const g = buildGlass('low');
    g.setIris(0.5);
    expect(objectNamed(g.group, 'cap').scale.x).toBeCloseTo(0.5, 6);
    g.setIris(1);
    expect(objectNamed(g.group, 'cap').visible).toBe(false);
    g.dispose();
  });

  it('starts closed, shows the cap again when the iris closes, and holds the iris to 0..1', () => {
    const g = buildGlass('low');
    const cap = objectNamed(g.group, 'cap');
    expect(cap.visible).toBe(true);
    expect(cap.scale.x).toBe(1);
    g.setIris(1);
    g.setIris(0.25);
    expect(cap.visible).toBe(true);
    expect(cap.scale.x).toBeCloseTo(0.75, 6);
    g.setIris(-2);
    expect(cap.scale.x).toBe(1);
    g.setIris(9);
    expect(cap.visible).toBe(false);
    g.setIris(Number.NaN);
    expect(cap.visible).toBe(true);
    expect(cap.scale.x).toBe(1);
    g.dispose();
  });

  it('shuts the opening with a disc of the hole radius on the glass', () => {
    const g = buildGlass('low');
    const cap = meshNamed(g.group, 'cap');
    const { min, max } = radii(cap.geometry);
    expect(min).toBe(0);
    expect(max).toBeCloseTo(WORDMARK.hole, 6);
    const position = cap.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) expect(position.getY(i)).toBeCloseTo(0, 9);
    expect(cap.position.y).toBe(0);
    g.dispose();
  });

  it('lays the floor from the hole to 60 on y = 0 in near-black, glossy, clear-coated glass', () => {
    const g = buildGlass('low');
    const floor = meshNamed(g.group, 'floor');
    const { min, max } = radii(floor.geometry);
    expect(min).toBeCloseTo(WORDMARK.hole, 6);
    expect(max).toBeCloseTo(60, 4);
    const position = floor.geometry.getAttribute('position');
    const normal = floor.geometry.getAttribute('normal');
    for (let i = 0; i < position.count; i += 7) {
      expect(position.getY(i)).toBeCloseTo(0, 9);
      expect(normal.getY(i)).toBeCloseTo(1, 9);
    }
    const material = floor.material as THREE.MeshPhysicalMaterial;
    expect(material).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    // The floor is the preview's black, with the scene's background.
    expect(material.color.getHex()).toBe(palette.black);
    // Task 12: at full specular and coat the glossy glass mirrored the reflection room's violet card over the whole floor.
    // The coat is the high tier's only, so the low tier's floor has none.
    expect(material.clearcoat).toBe(0);
    expect(GLASS_LOOK.floor.clearcoat).toBe(0.1);
    expect(material.specularIntensity).toBe(0.05);
    expect(GLASS_LOOK.floor.specular).toBe(0.05);
    expect(GLASS_LOOK.floor.clearcoatRoughness).toBe(0.025);
    expect(GLASS_LOOK.floor.roughness).toBe(0.08);
    g.dispose();
  });

  it('gives the floor its 0.08 thickness with a wall round the hole and nothing else below', () => {
    const g = buildGlass('low');
    const edge = meshNamed(g.group, 'floor:edge');
    edge.geometry.computeBoundingBox();
    expect(edge.geometry.boundingBox!.min.y).toBeCloseTo(-0.08, 6);
    expect(edge.geometry.boundingBox!.max.y).toBeCloseTo(0, 6);
    const { min, max } = radii(edge.geometry);
    expect(min).toBeCloseTo(WORDMARK.hole, 6);
    expect(max).toBeCloseTo(WORDMARK.hole, 6);
    // The wall is seen from inside the opening.
    expect((edge.material as THREE.Material).side).toBe(THREE.BackSide);
    g.dispose();
  });

  it('streaks the floor with a seeded 512 px roughness map at 28 degrees, rougher in the streaks only', () => {
    const g = buildGlass('low');
    const material = meshNamed(g.group, 'floor').material as THREE.MeshPhysicalMaterial;
    const map = material.roughnessMap as THREE.DataTexture;
    expect(map).toBeInstanceOf(THREE.DataTexture);
    expect(map.image.width).toBe(512);
    expect(map.image.height).toBe(512);
    expect(map.rotation).toBeCloseTo((28 * Math.PI) / 180, 9);
    expect(map.wrapS).toBe(THREE.RepeatWrapping);
    expect(map.wrapT).toBe(THREE.RepeatWrapping);
    expect(map.colorSpace).toBe(THREE.NoColorSpace);
    // Identity checks on textures: `toBe` deep-compares them when it fails, and `not.toBe` always does, which is slow over a 1 MB map.
    expect(material.clearcoatRoughnessMap === map).toBe(true);

    const data = map.image.data as Uint8Array;
    const green = (x: number, y: number) => data[(y * 512 + x) * 4 + 1] / 255;
    let lowest = 1;
    let highest = 0;
    let along = 0;
    let across = 0;
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        lowest = Math.min(lowest, green(x, y));
        highest = Math.max(highest, green(x, y));
        along += Math.abs(green(x, y) - green((x + 1) % 512, y));
        across += Math.abs(green(x, y) - green(x, (y + 1) % 512));
      }
    }
    // The cleanest glass has the look's roughness and the roughest streak `contrast` times it.
    expect(highest).toBeLessThanOrEqual(1);
    expect(highest).toBeGreaterThan(0.6);
    expect(material.roughness * lowest).toBeCloseTo(GLASS_LOOK.floor.roughness, 2);
    expect(material.roughness).toBeCloseTo(GLASS_LOOK.floor.roughness * GLASS_LOOK.scratch.contrast, 9);
    expect(material.clearcoatRoughness * lowest).toBeCloseTo(GLASS_LOOK.floor.clearcoatRoughness, 2);
    // Streaks: the map changes far less along its rows than across them.
    expect(along).toBeLessThan(across / 3);
    expect(highest - lowest).toBeGreaterThan(0.3);

    g.dispose();
  });

  it('reads the scratch map at anisotropy 4, as v3 does for its glass', () => {
    const g = buildGlass('low');
    const map = (meshNamed(g.group, 'floor').material as THREE.MeshPhysicalMaterial).roughnessMap as THREE.DataTexture;
    expect(GLASS_LOOK.scratch.anisotropy).toBe(4);
    expect(map.anisotropy).toBe(4);
    g.dispose();
  });

  it('makes the scratch map once: every build holds the same texels, and each frees only its own texture', () => {
    const textureOf = (model: ReturnType<typeof buildGlass>) => (meshNamed(model.group, 'floor').material as THREE.MeshPhysicalMaterial).roughnessMap as THREE.DataTexture;
    const sum = (data: Uint8Array) => data.reduce((total, v) => total + v, 0);
    const a = buildGlass('low');
    const b = buildGlass('high');
    const first = textureOf(a);
    const second = textureOf(b);
    // Two textures over one array: not copied, and so the same seeded map every time.
    expect(second === first).toBe(false);
    expect(second.image.data === first.image.data).toBe(true);
    const data = first.image.data as Uint8Array;
    const before = sum(data);
    expect(before).toBeGreaterThan(0);
    let freed = 0;
    first.addEventListener('dispose', () => freed++);
    second.addEventListener('dispose', () => freed += 10);
    a.dispose();
    // Only the first build's texture is freed, and the texels the second still reads are untouched.
    expect(freed).toBe(1);
    expect(textureOf(b).image.data === data).toBe(true);
    expect(data).toHaveLength(512 * 512 * 4);
    expect(sum(data)).toBe(before);
    // A build made after the first is gone still has the map.
    const c = buildGlass('medium');
    expect(textureOf(c).image.data === data).toBe(true);
    b.dispose();
    c.dispose();
    expect(freed).toBe(11);
  });

  it('draws the floor, its edge and the cap at render order -5 on every tier, after the sky and before the laser and the mist', () => {
    expect(GLASS_RENDER_ORDER).toBe(-5);
    expect(GLASS_RENDER_ORDER).toBeGreaterThan(-10);
    expect(GLASS_RENDER_ORDER).toBeLessThan(1);
    for (const tier of ['high', 'medium', 'low'] as const) {
      const g = buildGlass(tier);
      for (const name of ['floor', 'floor:edge', 'cap']) expect(objectNamed(g.group, name).renderOrder, `${tier} ${name}`).toBe(GLASS_RENDER_ORDER);
      g.dispose();
    }
  });

  it('coats the floor and its edge on the high tier only: no clearcoat below high', () => {
    for (const tier of ['high', 'medium', 'low'] as const) {
      const g = buildGlass(tier);
      for (const name of ['floor', 'floor:edge', 'cap']) {
        expect((meshNamed(g.group, name).material as THREE.MeshPhysicalMaterial).clearcoat, `${tier} ${name}`).toBe(tier === 'high' ? GLASS_LOOK.floor.clearcoat : 0);
      }
      g.dispose();
    }
  });

  it('adds the reflector on the high tier only', () => {
    expect(hasNamed(buildGlass('high').group, 'floor:reflector')).toBe(true);
    expect(hasNamed(buildGlass('medium').group, 'floor:reflector')).toBe(false);
    expect(hasNamed(buildGlass('low').group, 'floor:reflector')).toBe(false);
  });

  // Task 8: the preview's scratched glass blurs the compass's reflection into a few soft gold streaks, not a sharp copy.
  it('blurs the reflection into a streak of 9 taps, 0.06 along the scratches and 0.006 across (UV units of the mirror)', () => {
    expect(GLASS_LOOK.reflector.blur).toEqual({ taps: 9, along: 0.06, across: 0.006 });
  });

  it('draws the mirror as the average of one read per tap, offset by uAlong and uAcross, where three reads it once', () => {
    const { taps, along, across } = GLASS_LOOK.reflector.blur;
    const high = buildGlass('high');
    const reflector = objectNamed(high.group, 'floor:reflector') as Reflector;
    const material = reflector.material as THREE.ShaderMaterial;
    const fragment = material.fragmentShader;
    expect(fragment.match(/texture2D(Proj)?\s*\(/g) ?? []).toHaveLength(taps);
    expect(fragment.match(/texture2DProj\s*\(\s*tDiffuse\s*,/g) ?? []).toHaveLength(taps);
    // Three's own shader is kept but for its one sharp read: the overlay blend, the tone mapping and the colour space.
    expect(fragment).not.toContain('texture2DProj( tDiffuse, vUv )');
    expect(fragment).toContain('blendOverlay(');
    expect(fragment).toContain('#include <colorspace_fragment>');
    // The offsets are in texture UV: scaled by the projective w, so the divide by w leaves exactly the offset.
    expect(fragment).toContain('vUv.w');
    expect(fragment).toMatch(/uniform float uAlong;/);
    expect(fragment).toMatch(/uniform float uAcross;/);
    expect(fragment).toContain(`/ ${taps}.0`);
    expect(material.uniforms.uAlong.value).toBe(along);
    expect(material.uniforms.uAcross.value).toBe(across);
    // The reflector still feeds three's own uniforms.
    expect(material.uniforms.tDiffuse.value).toBe(reflector.getRenderTarget().texture);
    expect(material.uniforms.color.value).toBeInstanceOf(THREE.Color);
    expect(material.uniforms.textureMatrix.value).toBeInstanceOf(THREE.Matrix4);
    high.dispose();
  });

  it("derives the streak from the scratches' world direction through the mirror's own projection, not from a fixed UV direction", () => {
    const high = buildGlass('high');
    const material = (objectNamed(high.group, 'floor:reflector') as Reflector).material as THREE.ShaderMaterial;
    const { vertexShader, fragmentShader } = material;
    // The vertex stage projects the scratch direction (given in the mirror's own frame) through three's texture matrix, as
    // a direction (w = 0): the homogeneous derivative of the projection along the scratches, constant over the mirror.
    expect(vertexShader).toContain('varying vec3 vStreak;');
    expect(vertexShader).toMatch(/const vec3 STREAK_LOCAL = vec3\(\s*-?[\d.]+\s*,\s*-?[\d.]+\s*,\s*0\.0+\s*\);/);
    expect(vertexShader).toContain('vStreak = ( textureMatrix * vec4( STREAK_LOCAL, 0.0 ) ).xyw;');
    // three's own vertex work stays.
    expect(vertexShader).toContain('vUv = textureMatrix * vec4( position, 1.0 );');
    expect(vertexShader).toContain('gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );');
    // The fragment stage turns it into the direction on the mirror's UV at this pixel (the quotient rule: (X' - u W', Y' - v W')),
    // and the width across it; no constant direction in UV is left, which would run the wrong way and turn with the aspect.
    expect(fragmentShader).toContain('varying vec3 vStreak;');
    expect(fragmentShader).toContain('vec2 uv = vUv.xy / vUv.w;');
    expect(fragmentShader).toContain('normalize( vStreak.xy - uv * vStreak.z )');
    expect(fragmentShader).toMatch(/vec2 acrossDir = vec2\( -alongDir\.y, alongDir\.x \);/);
    expect(fragmentShader).not.toContain('STREAK_ALONG');
    expect(fragmentShader).not.toContain('STREAK_ACROSS');
    high.dispose();
  });

  it("gives the shader the scratches' world direction: the mirror's own frame carries it to the direction the floor's scratch map runs along", () => {
    const high = buildGlass('high');
    const reflector = objectNamed(high.group, 'floor:reflector') as Reflector;
    const floor = meshNamed(high.group, 'floor');
    const a = (GLASS_LOOK.scratch.angle * Math.PI) / 180;
    // The shader's constant, in the mirror's frame.
    const found = /const vec3 STREAK_LOCAL = vec3\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\);/.exec((reflector.material as THREE.ShaderMaterial).vertexShader);
    expect(found).not.toBeNull();
    const local = new THREE.Vector3(Number(found?.[1]), Number(found?.[2]), Number(found?.[3]));
    expect(local.length()).toBeCloseTo(1, 5);
    // In the world it is the direction the scratch map runs along on the floor.
    high.group.updateMatrixWorld(true);
    const world = local.clone().transformDirection(reflector.matrixWorld);
    expect(world.x).toBeCloseTo(Math.cos(a), 5);
    expect(world.y).toBeCloseTo(0, 9);
    expect(world.z).toBeCloseTo(-Math.sin(a), 5);
    // ... which is what the floor's own UV does with the texture's rotation: the floor maps u to +x and v to -z, and the
    // streaks of a map rotated by `angle` run along (cos, sin) in that UV.
    const map = (floor.material as THREE.MeshPhysicalMaterial).roughnessMap as THREE.Texture;
    expect(map.rotation).toBeCloseTo(a, 9);
    const position = floor.geometry.getAttribute('position');
    const uv = floor.geometry.getAttribute('uv');
    for (let i = 0; i < position.count; i += 211) {
      expect(uv.getX(i)).toBeCloseTo((position.getX(i) / GLASS_LOOK.floor.outer + 1) / 2, 6);
      expect(uv.getY(i)).toBeCloseTo((-position.getZ(i) / GLASS_LOOK.floor.outer + 1) / 2, 6);
    }
    const scratches = new THREE.Vector3(Math.cos(map.rotation), 0, -Math.sin(map.rotation));
    expect(world.distanceTo(scratches)).toBeLessThan(1e-5);
    high.dispose();
  });

  describe("the streak on the screen (the mirror's real texture matrix)", () => {
    // What three's Reflector calls on a renderer, answered with nothing: onBeforeRender then places the mirror's camera
    // and sets its texture matrix, which is all these tests read.
    const stubRenderer = {
      getRenderTarget: () => null,
      xr: { enabled: false },
      shadowMap: { autoUpdate: true },
      setRenderTarget() {},
      state: { buffers: { depth: { setMask() {} } }, viewport() {} },
      autoClear: true,
      clear() {},
      render() {}
    };

    /** The angle between two directions as lines (a direction and its opposite are one), in degrees, 0..90. */
    function lineAngleBetween(a: [number, number], b: [number, number]): number {
      const turn = ((((Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0])) * 180) / Math.PI) % 180 + 180 + 90) % 180 - 90;
      return Math.abs(turn);
    }

    /** The home or top camera at this aspect, the mirror placed for it, and the texture matrix it was left with. */
    function placed(shot: CameraShot, width: number, height: number) {
      const high = buildGlass('high');
      const reflector = objectNamed(high.group, 'floor:reflector') as Reflector;
      high.group.updateMatrixWorld(true);
      const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 100);
      applyCameraShot(camera, shot, width / height);
      reflector.onBeforeRender(stubRenderer as unknown as THREE.WebGLRenderer, new THREE.Scene(), camera, reflector.geometry, reflector.material as THREE.Material, null as unknown as THREE.Group);
      const textureMatrix = (reflector.material as THREE.ShaderMaterial).uniforms.textureMatrix.value as THREE.Matrix4;
      const toLocal = reflector.matrixWorld.clone().invert();
      return { high, camera, textureMatrix, toLocal };
    }

    /** The floor points (on the mirror's plane) that the camera sees: a grid of the glass's near field. */
    function seen(camera: THREE.PerspectiveCamera, y: number): THREE.Vector3[] {
      const points: THREE.Vector3[] = [];
      for (let x = -24; x <= 24; x += 1) {
        for (let z = -28; z <= 8; z += 1) {
          const p = new THREE.Vector3(x, y, z);
          const ndc = p.clone().project(camera);
          const inFront = p.clone().applyMatrix4(camera.matrixWorldInverse).z < 0;
          if (inFront && Math.abs(ndc.x) < 0.95 && Math.abs(ndc.y) < 0.95 && Math.hypot(x, z) > WORDMARK.hole + 0.5) points.push(p);
        }
      }
      return points;
    }

    const a = (GLASS_LOOK.scratch.angle * Math.PI) / 180;
    // The scratches run along this in the world, and the streak must run along its picture on the screen.
    const scratches = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));

    const cases = [
      ['the home', homeShotFor, 1440, 900],
      ['the home', homeShotFor, 390, 844],
      ['the top shot', topShotFor, 1440, 900],
      ['the top shot', topShotFor, 390, 844]
    ] as const;

    for (const [name, shotFor, width, height] of cases) {
      it(`runs along the scratches' picture on the screen, within 2 degrees, from ${name} at ${width}x${height}`, () => {
        const { high, camera, textureMatrix, toLocal } = placed(shotFor(width / height), width, height);
        const floorY = -GLASS_LOOK.reflection.depth;
        const points = seen(camera, floorY);
        expect(points.length).toBeGreaterThan(8);
        const pixel = (p: THREE.Vector3): [number, number] => {
          const ndc = p.clone().project(camera);
          return [((ndc.x + 1) / 2) * width, ((ndc.y + 1) / 2) * height];
        };
        let worst = 0;
        let oldWorst = 0;
        for (const p of points) {
          // The scratch direction as the camera sees it: two points a hair apart along it, in pixels (y up).
          const from = pixel(p);
          const to = pixel(p.clone().addScaledVector(scratches, 1e-3));
          const picture: [number, number] = [to[0] - from[0], to[1] - from[1]];
          // The streak the shader smears: its direction on the mirror's UV at this point, where the mirror's UV runs
          // the other way in u (the reflection's camera is the camera mirrored), so it lands on the screen as (-du, dv).
          const local = p.clone().applyMatrix4(toLocal);
          const projected = new THREE.Vector4(local.x, local.y, local.z, 1).applyMatrix4(textureMatrix);
          const [du, dv] = streakDirection(textureMatrix, projected.x / projected.w, projected.y / projected.w);
          expect(Math.hypot(du, dv)).toBeCloseTo(1, 9);
          const streak: [number, number] = [-du * width, dv * height];
          worst = Math.max(worst, lineAngleBetween(streak, picture));
          // The fixed UV direction the first version used, for comparison: it is not this.
          oldWorst = Math.max(oldWorst, lineAngleBetween([-Math.cos(a) * width, Math.sin(a) * height], picture));
        }
        expect(worst).toBeLessThan(2);
        // The test can tell: the fixed direction (cos, sin) in the mirror's UV is far off the scratches' picture somewhere.
        expect(oldWorst).toBeGreaterThan(10);
        high.dispose();
      });
    }

    it('ascends to the right at the home, along the scratches, and not as their mirror image', () => {
      const { high, camera, textureMatrix, toLocal } = placed(homeShotFor(1440 / 900), 1440, 900);
      for (const p of seen(camera, -GLASS_LOOK.reflection.depth)) {
        const local = p.clone().applyMatrix4(toLocal);
        const projected = new THREE.Vector4(local.x, local.y, local.z, 1).applyMatrix4(textureMatrix);
        const [du, dv] = streakDirection(textureMatrix, projected.x / projected.w, projected.y / projected.w);
        // On the screen the streak is (-du, dv) (y up): to the right and up, or its opposite (to the left and down).
        expect(Math.sign(-du * dv), `at ${p.x}, ${p.z}`).toBe(1);
      }
      high.dispose();
    });
  });

  it('spreads the taps evenly over the streak, centred, and a little across it so no two reads coincide', () => {
    const taps = streakTaps(GLASS_LOOK.reflector.blur.taps);
    expect(taps).toHaveLength(9);
    taps.forEach((tap, i) => expect(tap.along).toBeCloseTo(i / 8 - 0.5, 12));
    expect(taps[0].along).toBe(-0.5);
    expect(taps[8].along).toBe(0.5);
    for (const tap of taps) {
      expect(tap.across).toBeGreaterThanOrEqual(-0.5);
      expect(tap.across).toBeLessThanOrEqual(0.5);
    }
    expect(new Set(taps.map((tap) => tap.across)).size).toBe(9);
    // Centred as a whole, so the streak sits on the sharp image and does not drift off it.
    expect(taps.reduce((sum, tap) => sum + tap.along, 0)).toBeCloseTo(0, 12);
    expect(Math.abs(taps.reduce((sum, tap) => sum + tap.across, 0) / 9)).toBeLessThan(0.1);
    // One tap is the sharp read; none is none.
    expect(streakTaps(1)).toEqual([{ along: 0, across: 0 }]);
    expect(streakTaps(0)).toEqual([{ along: 0, across: 0 }]);
  });

  it('frees the streak shader with the reflector, and removes it with setReflector(false)', () => {
    const high = buildGlass('high');
    const reflector = objectNamed(high.group, 'floor:reflector') as Reflector;
    const material = reflector.material as THREE.ShaderMaterial;
    const freed = vi.spyOn(material, 'dispose');
    high.setReflector(false);
    expect(hasNamed(high.group, 'floor:reflector')).toBe(false);
    expect(freed).toHaveBeenCalledOnce();
    high.dispose();
  });

  // Task 12: at 15 % the darker floor showed a crisp second compass; the preview's scratched glass shows a dim echo.
  it('lays the reflector under the floor, facing up over the same ring, and lets 12 % of the glass through', () => {
    const high = buildGlass('high');
    const reflector = objectNamed(high.group, 'floor:reflector') as Reflector;
    expect(reflector.isReflector).toBe(true);
    expect(reflector.position.y).toBeLessThan(0);
    expect(reflector.position.y).toBeGreaterThan(-0.01);
    reflector.updateMatrixWorld(true);
    const up = new THREE.Vector3(0, 0, 1).transformDirection(reflector.matrixWorld);
    expect(up.y).toBeCloseTo(1, 9);
    // The opening stays open: the reflector's ring has the hole in it too, on a plane just under the glass.
    const ring = reflector.geometry.getAttribute('position');
    const world = new THREE.Vector3();
    let near = Infinity;
    let far = 0;
    for (let i = 0; i < ring.count; i++) {
      world.fromBufferAttribute(ring, i).applyMatrix4(reflector.matrixWorld);
      expect(world.y).toBeCloseTo(reflector.position.y, 9);
      near = Math.min(near, Math.hypot(world.x, world.z));
      far = Math.max(far, Math.hypot(world.x, world.z));
    }
    expect(near).toBeCloseTo(WORDMARK.hole, 6);
    expect(far).toBeCloseTo(60, 4);
    const floor = meshNamed(high.group, 'floor').material as THREE.MeshPhysicalMaterial;
    expect(floor.transparent).toBe(true);
    // Bob, 2026-10-22: the reflection "slightly" stronger: 12 % of the mirror shows through, not 8 %.
    expect(floor.opacity).toBe(0.88);
    high.dispose();

    // Without the reflector the glass is solid.
    const low = buildGlass('low');
    const solid = meshNamed(low.group, 'floor').material as THREE.MeshPhysicalMaterial;
    expect(solid.transparent).toBe(false);
    expect(solid.opacity).toBe(1);
    low.dispose();
  });

  it('renders the mirror without multisampling, since it shows only 15 % of itself at half resolution', () => {
    const high = buildGlass('high');
    expect(GLASS_LOOK.reflection.multisample).toBe(0);
    expect((objectNamed(high.group, 'floor:reflector') as Reflector).getRenderTarget().samples).toBe(0);
    high.dispose();
  });

  it('sizes the reflection to half the renderer, and ignores the renderer on a tier without one', () => {
    const renderer = { getDrawingBufferSize: (target: THREE.Vector2) => target.set(1600, 900) };
    const high = buildGlass('high');
    high.setRenderer(renderer);
    const target = (objectNamed(high.group, 'floor:reflector') as Reflector).getRenderTarget();
    expect(target.width).toBe(800);
    expect(target.height).toBe(450);
    renderer.getDrawingBufferSize = (t: THREE.Vector2) => t.set(1001, 601);
    high.setRenderer(renderer);
    expect(target.width).toBe(501);
    expect(target.height).toBe(301);
    high.dispose();
    const low = buildGlass('low');
    expect(() => low.setRenderer(renderer)).not.toThrow();
    low.dispose();
  });

  it('turns the reflection off for good: the mirror out and freed, the glass solid as the other tiers build it', () => {
    const high = buildGlass('high');
    const reflector = objectNamed(high.group, 'floor:reflector') as Reflector;
    const ring = reflector.geometry;
    const freed = vi.spyOn(reflector, 'dispose');
    const ringFreed = vi.spyOn(ring, 'dispose');
    const floor = meshNamed(high.group, 'floor').material as THREE.MeshPhysicalMaterial;
    const edge = meshNamed(high.group, 'floor:edge').material as THREE.MeshPhysicalMaterial;
    const cap = meshNamed(high.group, 'cap').material as THREE.MeshPhysicalMaterial;
    const versions = [floor.version, edge.version];
    high.setReflector(false);
    expect(hasNamed(high.group, 'floor:reflector')).toBe(false);
    expect(freed).toHaveBeenCalledOnce();
    expect(ringFreed).toHaveBeenCalledOnce();
    const solid = meshNamed(buildGlass('medium').group, 'floor').material as THREE.MeshPhysicalMaterial;
    for (const material of [floor, edge, cap]) {
      expect(material.transparent).toBe(solid.transparent);
      expect(material.opacity).toBe(solid.opacity);
      // Stepped down below high, the coat goes too, as the medium tier builds it.
      expect(material.clearcoat).toBe(solid.clearcoat);
      expect(material.clearcoat).toBe(0);
    }
    // Opaque glass is another program: both materials are marked for it.
    expect(floor.version).toBeGreaterThan(versions[0]);
    expect(edge.version).toBeGreaterThan(versions[1]);
    // The renderer no longer sizes anything, and freeing the glass frees the mirror no second time.
    expect(() => high.setRenderer({ getDrawingBufferSize: (t: THREE.Vector2) => t.set(800, 600) })).not.toThrow();
    high.dispose();
    expect(freed).toHaveBeenCalledOnce();
    expect(ringFreed).toHaveBeenCalledOnce();
  });

  it('never brings the reflection back, and turning it off twice or on a tier without one does nothing', () => {
    const high = buildGlass('high');
    high.setReflector(true);
    expect(hasNamed(high.group, 'floor:reflector')).toBe(true);
    high.setReflector(false);
    high.setReflector(false);
    high.setReflector(true);
    expect(hasNamed(high.group, 'floor:reflector')).toBe(false);
    expect((meshNamed(high.group, 'floor').material as THREE.MeshPhysicalMaterial).transparent).toBe(false);
    high.dispose();
    const medium = buildGlass('medium');
    const before = (meshNamed(medium.group, 'floor').material as THREE.MeshPhysicalMaterial).version;
    medium.setReflector(false);
    expect((meshNamed(medium.group, 'floor').material as THREE.MeshPhysicalMaterial).version).toBe(before);
    medium.dispose();
  });

  it('shows and hides the gold lip by setLip, which builds shown, and keeps it in the group under its name', () => {
    const g = buildGlass('low');
    const lip = meshNamed(g.group, 'lip');
    expect(lip.visible).toBe(true);
    g.setLip(false);
    expect(lip.visible).toBe(false);
    expect(g.group.getObjectByName('lip')).toBe(lip);
    g.setLip(true);
    expect(lip.visible).toBe(true);
    g.dispose();
  });

  it('digs the well 1.12 deep from just under the floor, an open cylinder seen from inside', () => {
    const g = buildGlass('low');
    const well = meshNamed(g.group, 'well');
    well.geometry.computeBoundingBox();
    expect(well.geometry.boundingBox!.max.y).toBeCloseTo(-0.08, 6);
    expect(well.geometry.boundingBox!.min.y).toBeCloseTo(-1.2, 6);
    expect(GLASS_LOOK.well.depth).toBeCloseTo(1.12, 9);
    const { min, max } = radii(well.geometry);
    expect(min).toBeCloseTo(WORDMARK.hole, 6);
    expect(max).toBeCloseTo(WORDMARK.hole, 6);
    expect((well.geometry as THREE.CylinderGeometry).parameters.openEnded).toBe(true);
    expect((well.material as THREE.Material).side).toBe(THREE.BackSide);
    g.dispose();
  });

  // Task 12: in the gold light, not the hot amber (an orange pit), and at 0.12, not 1.1 (a flat bright bowl, where the
  // preview's video keeps the tunnel near black through the rise).
  // Bob, 2026-10-22: the opening's glow "slightly" stronger: 0.17, not 0.12, with the light at 1.7, not 1.2.
  it('glows the well warm, 0.17 at the foot and falling as (1 - v) cubed up the wall, its light at 1.7', () => {
    const g = buildGlass('low');
    const material = meshNamed(g.group, 'well').material as THREE.MeshStandardMaterial;
    g.setGlow(1);
    expect(material.emissiveIntensity).toBeCloseTo(0.17, 9);
    expect(GLASS_LOOK.well.light.intensity).toBe(1.7);
    expect(material.emissive.getHex()).toBe(palette.goldLight);
    expect(GLASS_LOOK.well.light.colour).toBe(palette.goldLight);
    // The fade is added to three's own shader.
    const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader };
    material.onBeforeCompile(shader as never, {} as never);
    expect(shader.fragmentShader).toMatch(/totalEmissiveRadiance\s*\*=\s*pow\(\s*1\.0\s*-\s*vWellV\s*,\s*3\.0\s*\)/);
    expect(shader.vertexShader).toMatch(/vWellV\s*=/);
    expect(shader.vertexShader).toContain('-1.2');
    expect(shader.vertexShader).toContain('1.12');
    expect(shader.vertexShader.match(/varying float vWellV/g)).toHaveLength(1);
    expect(shader.fragmentShader.match(/varying float vWellV/g)).toHaveLength(1);
    g.dispose();
  });

  it('scales the well and its warm light at y -0.9 with setGlow, and keeps the light on so no shader recompiles', () => {
    const g = buildGlass('low');
    const material = meshNamed(g.group, 'well').material as THREE.MeshStandardMaterial;
    const light = objectNamed(g.group, 'well:light') as THREE.PointLight;
    expect(light).toBeInstanceOf(THREE.PointLight);
    expect(light.position.y).toBeCloseTo(-0.9, 9);
    expect(light.position.x).toBe(0);
    expect(light.position.z).toBe(0);
    // Dark until the iris has opened.
    expect(material.emissiveIntensity).toBe(0);
    expect(light.intensity).toBe(0);
    g.setGlow(1);
    const full = light.intensity;
    expect(full).toBe(GLASS_LOOK.well.light.intensity);
    expect(full).toBeGreaterThan(0);
    g.setGlow(0.5);
    expect(light.intensity).toBeCloseTo(full / 2, 9);
    expect(material.emissiveIntensity).toBeCloseTo(GLASS_LOOK.well.emissive / 2, 9);
    g.setGlow(5);
    expect(light.intensity).toBeCloseTo(full, 9);
    g.setGlow(-1);
    expect(light.intensity).toBe(0);
    g.setGlow(Number.NaN);
    expect(light.intensity).toBe(0);
    expect(light.visible).toBe(true);
    g.dispose();
  });

  it('rims the opening with a gold lip 0.012 outside the hole, a 0.02 tube lying flat', () => {
    const g = buildGlass('low');
    const lip = meshNamed(g.group, 'lip');
    const geometry = lip.geometry as THREE.TorusGeometry;
    expect(geometry).toBeInstanceOf(THREE.TorusGeometry);
    expect(geometry.parameters.radius).toBeCloseTo(WORDMARK.hole + 0.012, 9);
    expect(geometry.parameters.tube).toBe(0.02);
    expect(GLASS_LOOK.lip.radius).toBeCloseTo(WORDMARK.hole + 0.012, 9);
    geometry.computeBoundingBox();
    // Lying flat: its height is its tube, its width the whole ring.
    expect(geometry.boundingBox!.max.y - geometry.boundingBox!.min.y).toBeCloseTo(0.04, 3);
    expect(geometry.boundingBox!.max.x).toBeCloseTo(WORDMARK.hole + 0.012 + 0.02, 3);
    g.dispose();
  });

  it('names the part, and keeps the wordmark inside the 60 unit floor', () => {
    const g = buildGlass('low');
    expect(g.group.name).toBe('glass-floor');
    expect(GLASS_LOOK.floor.outer).toBe(60);
    g.dispose();
  });

  it('frees every geometry, material, texture and reflector it made', () => {
    for (const tier of ['high', 'low'] as const) {
      const g = buildGlass(tier);
      const parts = resources(g.group);
      const reflector = g.group.getObjectByName('floor:reflector') as Reflector | undefined;
      // The floor, the edge, the cap, the well and the lip each have a geometry, and the reflector its own ring.
      expect([...parts].filter((p) => p instanceof THREE.BufferGeometry)).toHaveLength(tier === 'high' ? 6 : 5);
      expect([...parts].filter((p) => p instanceof THREE.Texture)).toHaveLength(1);
      const spies = [...parts].map((part) => vi.spyOn(part, 'dispose'));
      const reflectorSpy = reflector ? vi.spyOn(reflector, 'dispose') : undefined;
      g.dispose();
      for (const spy of spies) expect(spy).toHaveBeenCalled();
      if (reflector) expect(reflectorSpy).toHaveBeenCalled();
      expect(Boolean(reflector)).toBe(tier === 'high');
    }
  });
});

describe('the traces', () => {
  const layout = traceLayout();

  it('draws the traces and their pads as line segments in dim gold at TRACES_LOOK.level', () => {
    const t = buildTraces(layout);
    expect(t.group.name).toBe('traces');
    const lines = objectNamed(t.group, 'traces:lines') as THREE.LineSegments;
    expect(lines).toBeInstanceOf(THREE.LineSegments);
    const segments = layout.traces.reduce((sum, trace) => sum + trace.length - 1, 0) + layout.pads.length * TRACE.pad.segments;
    expect(lines.geometry.getAttribute('position').count).toBe(segments * 2);
    const material = lines.material as THREE.LineBasicMaterial;
    expectColour(material.color, times(palette.gold, TRACES_LOOK.level));
    expect(material.fog).toBe(true);
    expect(material.toneMapped).toBe(true);
    t.dispose();
  });

  it('runs the segments along the traces and rings each pad with a 16-gon of 0.045', () => {
    const t = buildTraces(layout);
    const lines = objectNamed(t.group, 'traces:lines') as THREE.LineSegments;
    const position = lines.geometry.getAttribute('position');
    const first = layout.traces[0];
    // The first trace's first segment, in the object's own frame (the depth is the object's position).
    expect(position.getX(0)).toBeCloseTo(first[0][0], 5);
    expect(position.getZ(0)).toBeCloseTo(first[0][1], 5);
    expect(position.getX(1)).toBeCloseTo(first[1][0], 5);
    expect(position.getZ(1)).toBeCloseTo(first[1][1], 5);
    const body = layout.traces.reduce((sum, trace) => sum + trace.length - 1, 0) * 2;
    for (let p = 0; p < layout.pads.length; p += 41) {
      for (let s = 0; s < TRACE.pad.segments; s++) {
        for (const end of [0, 1]) {
          const i = body + (p * TRACE.pad.segments + s) * 2 + end;
          expect(Math.hypot(position.getX(i) - layout.pads[p][0], position.getZ(i) - layout.pads[p][1])).toBeCloseTo(TRACE.pad.radius, 5);
        }
      }
    }
    // Each segment of a pad ends where the next begins.
    const i = body + 1;
    expect(position.getX(i)).toBeCloseTo(position.getX(i + 1), 9);
    expect(position.getZ(i)).toBeCloseTo(position.getZ(i + 1), 9);
    t.dispose();
  });

  it('sets the level as a multiple of the gold, held to zero or more', () => {
    const t = buildTraces(layout);
    const material = (objectNamed(t.group, 'traces:lines') as THREE.LineSegments).material as THREE.LineBasicMaterial;
    t.setLevel(0.045);
    expectColour(material.color, times(palette.gold, 0.045));
    t.setLevel(0);
    expect(material.color.r + material.color.g + material.color.b).toBe(0);
    t.setLevel(-1);
    expect(material.color.r).toBe(0);
    t.setLevel(Number.NaN);
    expect(material.color.r).toBe(0);
    t.setLevel(TRACES_LOOK.level);
    expectColour(material.color, times(palette.gold, TRACES_LOOK.level));
    t.dispose();
  });

  it('frees its geometry and its material', () => {
    const t = buildTraces(layout);
    const parts = resources(t.group);
    expect(parts.size).toBe(2);
    const spies = [...parts].map((part) => vi.spyOn(part, 'dispose'));
    t.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalled();
  });
});

describe('the glass dissolving as the light dive comes through it (setDissolve)', () => {
  const floorOf = (glass: ReturnType<typeof buildGlass>) => meshNamed(glass.group, 'floor') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>;
  const wellOf = (glass: ReturnType<typeof buildGlass>) => meshNamed(glass.group, 'well') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  const lipOf = (glass: ReturnType<typeof buildGlass>) => meshNamed(glass.group, 'lip') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;

  it('fades the see-through floor of the high tier, darkens the tunnel and the lip with it, and takes the mirror out by the middle', () => {
    const glass = buildGlass('high');
    glass.setGlow(1);
    const floor = floorOf(glass);
    const rest = floor.material.opacity;
    const wellRest = wellOf(glass).material.emissiveIntensity;
    const lipRest = lipOf(glass).material.emissiveIntensity;
    glass.setDissolve(0.4);
    expect(floor.material.opacity).toBeCloseTo(rest * 0.6, 12);
    expect(objectNamed(glass.group, 'floor:reflector').visible).toBe(true);
    expect(wellOf(glass).material.emissiveIntensity).toBeCloseTo(wellRest * 0.6, 12);
    expect(lipOf(glass).material.emissiveIntensity).toBeCloseTo(lipRest * 0.6, 12);
    // Lit metal: its colour darkens with it, so the room's light goes off it too.
    expect(lipOf(glass).material.color.r).toBeCloseTo(new THREE.Color(GLASS_LOOK.lip.colour).r * 0.6, 12);
    glass.setDissolve(0.5);
    expect(objectNamed(glass.group, 'floor:reflector').visible).toBe(false);
    glass.setDissolve(1);
    for (const name of ['floor', 'floor:edge', 'cap', 'well', 'lip']) expect(objectNamed(glass.group, name).visible, name).toBe(false);
    // The tunnel's light stays in the scene at 0, so the light count never changes.
    const light = objectNamed(glass.group, 'well:light') as THREE.PointLight;
    expect([light.visible, light.intensity]).toEqual([true, 0]);
    glass.dispose();
  });

  it('gives the glass back exactly at 0: the floor, the mirror, the tunnel and the lip as they were', () => {
    const glass = buildGlass('high');
    glass.setGlow(1);
    glass.setIris(1);
    const before = [floorOf(glass).material.opacity, wellOf(glass).material.emissiveIntensity, lipOf(glass).material.emissiveIntensity];
    glass.setDissolve(1);
    glass.setDissolve(0);
    expect([floorOf(glass).material.opacity, wellOf(glass).material.emissiveIntensity, lipOf(glass).material.emissiveIntensity]).toEqual(before);
    for (const name of ['floor', 'floor:edge', 'floor:reflector', 'well', 'lip']) expect(objectNamed(glass.group, name).visible, name).toBe(true);
    expect(objectNamed(glass.group, 'cap').visible).toBe(false); // the iris is open: the cap stays as the iris left it
    glass.setDissolve(Number.NaN);
    expect(floorOf(glass).material.opacity).toBe(before[0]);
    glass.dispose();
  });

  it('cuts the opaque floor below high at the middle, compiling nothing: no material changes its program', () => {
    for (const tier of ['medium', 'low'] as const) {
      const glass = buildGlass(tier);
      const floor = floorOf(glass);
      const version = floor.material.version;
      glass.setDissolve(0.49);
      expect(floor.visible).toBe(true);
      glass.setDissolve(0.5);
      expect(floor.visible).toBe(false);
      expect(objectNamed(glass.group, 'floor:edge').visible).toBe(false);
      expect(floor.material.version).toBe(version);
      expect(floor.material.transparent).toBe(false);
      glass.dispose();
    }
  });
});
