import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { COUNTRY_IDS, countryDirection } from '~/data/directions';
import { DIAL } from '~/engine/instrument/dialSpec';
import { palette } from '~/engine/palette';
import { buildCity, CITY_LOOK } from '~/engine/v3/build/city';
import { buildConstellations, STARS_LOOK } from '~/engine/v3/build/constellations';
import { buildGlassCompass, GLASS_LOOK } from '~/engine/v3/build/glassCompass';
import { LASER_LOOK, LASER_RENDER_ORDER } from '~/engine/v3/build/laser';
import { buildMist, MIST_LOOK, MIST_RENDER_ORDER } from '~/engine/v3/build/mist';
import { buildNeedle, NEEDLE_LOOK } from '~/engine/v3/build/needle';
import { buildRoom, ROOM_LOOK, roomScene } from '~/engine/v3/build/room';
import { buildSky, SKY_LOOK } from '~/engine/v3/build/sky';
import { cityLayout } from '~/engine/v3/chipCity';
import { CHIP } from '~/engine/v3/chipSpec';
import { GLASS_RINGS, HUB, type RingId } from '~/engine/v3/compassSpec';
import { FIGURES, starPositions } from '~/engine/v3/constellations';

/** Rec. 709 luminance in linear light: what the scene's bloom thresholds at 1. */
function luminance(c: THREE.Color): number {
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

type Drawn = THREE.Mesh | THREE.Points | THREE.Line | THREE.Sprite;

/** Every mesh, line, points and sprite object under `root`. */
function drawn(root: THREE.Object3D): Drawn[] {
  const out: Drawn[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh || (o as THREE.Points).isPoints || (o as THREE.Line).isLine || (o as THREE.Sprite).isSprite) out.push(o as Drawn);
  });
  return out;
}

/** The object called `name` under `root`, which must exist. */
function named<T extends THREE.Object3D>(root: THREE.Object3D, name: string): T {
  const found = root.getObjectByName(name);
  expect(found, name).toBeDefined();
  return found as T;
}

/** Runs a material's onBeforeCompile on a copy of a built-in shader and hands back what it made of it. */
function compiled(material: THREE.Material, kind: 'standard' | 'physical' = 'standard') {
  const source = THREE.ShaderLib[kind];
  const shader = { uniforms: {} as Record<string, THREE.IUniform>, vertexShader: source.vertexShader, fragmentShader: source.fragmentShader };
  material.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
  return shader;
}

/** A world-space box round a mesh's own geometry (not its children). */
function worldBox(mesh: THREE.Mesh): THREE.Box3 {
  mesh.updateWorldMatrix(true, false);
  mesh.geometry.computeBoundingBox();
  return mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
}

const RING_IDS: readonly RingId[] = ['trigram', 'direction', 'degree', 'hexagram'];

/** Masks as the Stage hands them: textures made elsewhere, here without a canvas. */
function fakeMasks(): Record<RingId, THREE.Texture> {
  return { trigram: new THREE.Texture(), direction: new THREE.Texture(), degree: new THREE.Texture(), hexagram: new THREE.Texture() };
}

describe('the glass compass', () => {
  const glassOf = (compass: ReturnType<typeof buildGlassCompass>) =>
    named<THREE.Mesh>(compass.group, 'glass:ring:trigram').material as THREE.MeshPhysicalMaterial;
  const goldOf = (compass: ReturnType<typeof buildGlassCompass>, id: RingId) =>
    named<THREE.Mesh>(compass.group, `gold:ring:${id}`).material as THREE.MeshStandardMaterial;

  it('builds four glass rings, each with a gold engraving layer', () => {
    const compass = buildGlassCompass();
    expect(compass.group.children.filter((o) => o.name.startsWith('glass:ring:'))).toHaveLength(4);
    expect(compass.group.children.filter((o) => o.name.startsWith('gold:ring:'))).toHaveLength(4);
    compass.dispose();
  });

  it('makes each ring a solid: walls turned from its rectangle, and a polar top that carries the gold', () => {
    const compass = buildGlassCompass();
    for (const ring of GLASS_RINGS) {
      const walls = named<THREE.Mesh>(compass.group, `glass:ring:${ring.id}`);
      expect(walls.geometry).toBeInstanceOf(THREE.LatheGeometry);
      const box = worldBox(walls);
      expect(box.min.y).toBeCloseTo(ring.y - ring.thickness / 2, 6);
      expect(box.max.y).toBeCloseTo(ring.y + ring.thickness / 2, 6);
      // Every vertex of the walls is on the ring's inner or outer edge.
      const position = walls.geometry.getAttribute('position');
      for (let v = 0; v < position.count; v++) {
        const r = Math.hypot(position.getX(v), position.getZ(v));
        expect(Math.min(Math.abs(r - ring.inner), Math.abs(r - ring.outer)), `${ring.id} vertex ${v}`).toBeLessThan(1e-6);
      }

      const top = named<THREE.Mesh>(walls, `glass:top:${ring.id}`);
      expect(top.material).toBe(walls.material);
      const topBox = worldBox(top);
      expect(topBox.min.y).toBeCloseTo(ring.y + ring.thickness / 2, 6);
      expect(topBox.max.y).toBeCloseTo(ring.y + ring.thickness / 2, 6);
      // The Annulus's polar UVs: v is 0 on the inner edge and 1 on the outer, u runs round from north.
      const uv = top.geometry.getAttribute('uv');
      const topPosition = top.geometry.getAttribute('position');
      for (let v = 0; v < uv.count; v++) {
        const r = Math.hypot(topPosition.getX(v), topPosition.getZ(v));
        expect(r).toBeCloseTo(uv.getY(v) === 0 ? ring.inner : ring.outer, 6);
      }
      expect(Math.max(...Array.from(uv.array as Float32Array).filter((_, i) => i % 2 === 0))).toBe(1);

      const gold = named<THREE.Mesh>(compass.group, `gold:ring:${ring.id}`);
      expect(gold.geometry).toBe(top.geometry);
      const goldBox = worldBox(gold);
      expect(goldBox.min.y - topBox.min.y).toBeCloseTo(GLASS_LOOK.gold.lift, 9);
      expect(GLASS_LOOK.gold.lift).toBeGreaterThan(0);
      expect(GLASS_LOOK.gold.lift).toBeLessThan(0.001);
    }
    compass.dispose();
  });

  it('faces every wall out of the solid, with sharp edges where the walls meet the bottom', () => {
    const compass = buildGlassCompass();
    const ring = GLASS_RINGS[2];
    const walls = named<THREE.Mesh>(compass.group, `glass:ring:${ring.id}`);
    const position = walls.geometry.getAttribute('position');
    const normal = walls.geometry.getAttribute('normal');
    const index = walls.geometry.getIndex()!;
    const [a, b, c, face, n] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    let faces = 0;
    for (let t = 0; t < index.count; t += 3) {
      const corners = [index.getX(t), index.getX(t + 1), index.getX(t + 2)];
      a.fromBufferAttribute(position, corners[0]);
      b.fromBufferAttribute(position, corners[1]);
      c.fromBufferAttribute(position, corners[2]);
      const triangle = new THREE.Triangle(a, b, c);
      // The repeated corners of the profile leave zero-area strips: they draw nothing.
      if (triangle.getArea() < 1e-12) continue;
      triangle.getNormal(face);
      // Out of the solid: toward the axis on the inner wall, away from it on the outer, down on the bottom.
      const middle = triangle.getMidpoint(new THREE.Vector3());
      const r = Math.hypot(middle.x, middle.z);
      const radial = new THREE.Vector3(middle.x / r, 0, middle.z / r);
      if (Math.abs(face.y) > 0.99) expect(face.y).toBeCloseTo(-1, 6);
      else expect(face.dot(radial) * (Math.abs(r - ring.inner) < Math.abs(r - ring.outer) ? -1 : 1)).toBeGreaterThan(0.99);
      // Each corner's normal is the face's own: no rounding over the edges.
      for (const corner of corners) expect(n.fromBufferAttribute(normal, corner).dot(face)).toBeGreaterThan(0.999);
      faces++;
    }
    expect(faces).toBeGreaterThan(3 * 256);
    compass.dispose();
  });

  it('makes the glass near-black violet smoked glass, with no transmission and no depth written', () => {
    const compass = buildGlassCompass();
    const glass = glassOf(compass);
    expect(glass).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    expect(palette.glass).toBe(0x120a1c);
    expect(glass.color.getHex()).toBe(palette.glass);
    expect(glass.roughness).toBe(0.08);
    expect(glass.metalness).toBe(0);
    expect(glass.transparent).toBe(true);
    expect(glass.opacity).toBe(0.55);
    expect(glass.envMapIntensity).toBe(0.6);
    expect(glass.transmission).toBe(0);
    expect(glass.clearcoat).toBe(GLASS_LOOK.glass.clearcoat);
    expect(glass.depthWrite).toBe(false);
    // One glass for every ring's walls and top.
    for (const id of RING_IDS) {
      const walls = named<THREE.Mesh>(compass.group, `glass:ring:${id}`);
      expect(walls.material).toBe(glass);
      expect(named<THREE.Mesh>(walls, `glass:top:${id}`).material).toBe(glass);
    }
    compass.dispose();
  });

  it("engraves in palette gold, metal and barely emissive, its alpha read from the mask's alpha channel", () => {
    const compass = buildGlassCompass();
    const programs = new Set<string>();
    for (const id of RING_IDS) {
      const gold = goldOf(compass, id);
      expect(gold.color.getHex()).toBe(palette.gold);
      expect(gold.metalness).toBe(1);
      expect(gold.emissive.getHex()).toBe(palette.gold);
      expect(gold.emissiveIntensity).toBeLessThanOrEqual(0.15);
      expect(gold.transparent).toBe(true);
      expect(gold.depthWrite).toBe(false);
      // three's alphaMap reads green, which an anti-aliased white mark uploads as 255 at any alpha; the patch reads alpha.
      expect(THREE.ShaderLib.standard.fragmentShader).toContain('#include <alphamap_fragment>');
      expect(THREE.ShaderChunk.alphamap_fragment).toContain('texture2D( alphaMap, vAlphaMapUv ).g');
      const shader = compiled(gold);
      expect(shader.fragmentShader).not.toContain('#include <alphamap_fragment>');
      expect(shader.fragmentShader).toContain('diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).a;');
      programs.add(gold.customProgramCacheKey());
    }
    // The four rings share one program.
    expect(programs.size).toBe(1);
    compass.dispose();
  });

  it('shows no gold before the masks come, and takes each mask as its ring alpha, wrapped round north, as data', () => {
    const compass = buildGlassCompass();
    const placeholder = goldOf(compass, 'degree').alphaMap as THREE.DataTexture;
    expect(placeholder).toBeInstanceOf(THREE.DataTexture);
    expect(placeholder.image.data![3]).toBe(0);
    const masks = fakeMasks();
    const versions = RING_IDS.map((id) => masks[id].version);
    const programs = RING_IDS.map((id) => goldOf(compass, id).version);
    compass.setRingMasks(masks);
    RING_IDS.forEach((id, k) => {
      const gold = goldOf(compass, id);
      expect(gold.alphaMap).toBe(masks[id]);
      expect(masks[id].wrapS).toBe(THREE.RepeatWrapping);
      expect(masks[id].wrapT).toBe(THREE.ClampToEdgeWrapping);
      expect(masks[id].colorSpace).toBe(THREE.NoColorSpace);
      expect(masks[id].version).toBeGreaterThan(versions[k]);
      // The mask is only a uniform: the program the placeholder compiled stays.
      expect(gold.version).toBe(programs[k]);
    });
    compass.dispose();
  });

  it('fades the glass, the gold and the hub in as it forms, and draws nothing unformed', () => {
    const compass = buildGlassCompass();
    const glass = glassOf(compass);
    const golds = RING_IDS.map((id) => goldOf(compass, id));
    const hub = named<THREE.Mesh>(compass.group, 'hub').material as THREE.MeshStandardMaterial;
    const versions = [glass, hub, ...golds].map((m) => m.version);
    compass.setFormed(0.5);
    expect(glass.opacity).toBeCloseTo(0.275, 9);
    for (const gold of golds) expect(gold.opacity).toBeCloseTo(0.5, 9);
    expect(hub.opacity).toBeCloseTo(0.5, 9);
    expect(compass.group.children.every((o) => o.visible)).toBe(true);
    compass.setFormed(0);
    expect(compass.group.children.every((o) => !o.visible)).toBe(true);
    compass.setFormed(1);
    expect(glass.opacity).toBe(0.55);
    for (const gold of golds) expect(gold.opacity).toBe(1);
    expect(compass.group.children.every((o) => o.visible)).toBe(true);
    compass.setFormed(4);
    expect(glass.opacity).toBe(0.55);
    compass.setFormed(Number.NaN);
    expect(glass.opacity).toBe(0);
    // A fade is uniforms only: no material asks for a new program.
    expect([glass, hub, ...golds].map((m) => m.version)).toEqual(versions);
    compass.dispose();
  });

  it('turns the clearcoat off and on for the quality ladder', () => {
    const compass = buildGlassCompass();
    const glass = glassOf(compass);
    compass.setClearcoat(false);
    expect(glass.clearcoat).toBe(0);
    compass.setClearcoat(true);
    expect(glass.clearcoat).toBe(GLASS_LOOK.glass.clearcoat);
    expect(GLASS_LOOK.glass.clearcoat).toBeGreaterThan(0);
    compass.dispose();
  });

  it("stands a small gold boss on the chip, on the axis, its top at the hub's height", () => {
    const compass = buildGlassCompass();
    const hub = named<THREE.Mesh>(compass.group, 'hub');
    const box = worldBox(hub);
    expect(box.max.y).toBeCloseTo(HUB.y, 6);
    expect(box.min.y).toBeCloseTo(CHIP.board + CHIP.height, 6);
    expect(Math.max(box.max.x, -box.min.x, box.max.z, -box.min.z)).toBeLessThan(HUB.radius / 2);
    expect(box.getCenter(new THREE.Vector3()).x).toBeCloseTo(0, 6);
    const material = hub.material as THREE.MeshStandardMaterial;
    expect(material.color.getHex()).toBe(palette.gold);
    expect(material.metalness).toBe(1);
    expect(material.emissiveIntensity).toBeLessThanOrEqual(0.15);
    // Solid: it hides what is behind it.
    expect(material.depthWrite).toBe(true);
    compass.dispose();
  });

  it('draws the hub first, then the rings from the outermost in: walls, then top, then gold', () => {
    const compass = buildGlassCompass();
    const sequence = ['hub', ...[...GLASS_RINGS].reverse().flatMap((ring) => [`glass:ring:${ring.id}`, `glass:top:${ring.id}`, `gold:ring:${ring.id}`])];
    const orders = sequence.map((name) => named(compass.group, name).renderOrder);
    for (let i = 1; i < orders.length; i++) expect(orders[i], sequence[i]).toBeGreaterThan(orders[i - 1]);
    // No group stands between the compass and its parts, so the compass's own order sorts them all as one.
    compass.group.traverse((o) => {
      if (o !== compass.group) expect((o as THREE.Group).isGroup, o.name).not.toBe(true);
    });
    compass.dispose();
  });

  it('frees every geometry, material and texture it made, and not the masks it was handed', () => {
    const compass = buildGlassCompass();
    const placeholders = new Set(RING_IDS.map((id) => goldOf(compass, id).alphaMap!));
    const masks = fakeMasks();
    compass.setRingMasks(masks);
    const parts = drawn(compass.group);
    const geometries = new Set(parts.map((o) => o.geometry));
    const materials = new Set(parts.map((o) => o.material as THREE.Material));
    // Walls and tops for four rings (each top shared with its gold) and the hub; the glass, four golds and the hub's.
    expect(geometries.size).toBe(9);
    expect(materials.size).toBe(6);
    const spies = [...geometries, ...materials, ...placeholders].map((part) => vi.spyOn(part, 'dispose'));
    const handed = RING_IDS.map((id) => vi.spyOn(masks[id], 'dispose'));
    compass.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalled();
    for (const spy of handed) expect(spy).not.toHaveBeenCalled();
  });
});

describe('the needle', () => {
  const PROBE_LENGTH = LASER_LOOK.probe.profile[LASER_LOOK.probe.profile.length - 1][1];
  const PROBE_WIDTH = 2 * Math.max(...LASER_LOOK.probe.profile.map(([r]) => r));
  const point = (needle: ReturnType<typeof buildNeedle>, part: 'tip' | 'tail'): THREE.Vector3 => {
    needle.group.updateMatrixWorld(true);
    const mesh = named<THREE.Mesh>(needle.group, `needle:${part}`);
    return mesh.localToWorld(new THREE.Vector3(0, 0, part === 'tip' ? -DIAL.needle.tip : DIAL.needle.tail));
  };

  it('reaches its tip 0.82 north and its tail 0.6 south, on its pivot over the hub', () => {
    const needle = buildNeedle();
    expect(needle.group.name).toBe('needle');
    const tip = point(needle, 'tip');
    expect(tip.x).toBeCloseTo(0, 9);
    expect(tip.y).toBeCloseTo(NEEDLE_LOOK.pivot, 9);
    expect(tip.z).toBeCloseTo(-0.82, 9);
    const tail = point(needle, 'tail');
    expect(tail.z).toBeCloseTo(0.6, 9);
    expect(tail.y).toBeCloseTo(NEEDLE_LOOK.pivot, 9);
    // Clear of the hub's top and of the rings' glass.
    const box = new THREE.Box3().setFromObject(needle.group);
    expect(box.min.y).toBeGreaterThanOrEqual(HUB.y);
    expect(box.min.y).toBeGreaterThan(Math.max(...GLASS_RINGS.map((ring) => ring.y + ring.thickness / 2)));
    // An ornate pivot: a turned cap wider than the blade.
    const pivot = named<THREE.Mesh>(needle.group, 'needle:pivot');
    expect(pivot.geometry).toBeInstanceOf(THREE.LatheGeometry);
    const cap = worldBox(pivot);
    expect(cap.max.x).toBeGreaterThan(DIAL.needle.width / 2);
    needle.dispose();
  });

  it('turns the tip to a bearing, clockwise from north', () => {
    const needle = buildNeedle();
    needle.setBearing(Math.PI / 2);
    const east = point(needle, 'tip');
    expect(east.x).toBeCloseTo(0.82, 9);
    expect(east.z).toBeCloseTo(0, 9);
    needle.setBearing(Math.PI);
    expect(point(needle, 'tip').z).toBeCloseTo(0.82, 9);
    needle.setBearing(-Math.PI / 2);
    expect(point(needle, 'tip').x).toBeCloseTo(-0.82, 9);
    needle.setBearing(Number.NaN);
    expect(point(needle, 'tip').x).toBeCloseTo(-0.82, 9);
    needle.dispose();
  });

  it("grows from the loader's probe, standing on its nozzle over the chip, into the needle", () => {
    const needle = buildNeedle();
    const tail = named<THREE.Mesh>(needle.group, 'needle:tail');
    const tipMesh = named<THREE.Mesh>(needle.group, 'needle:tip');
    needle.setForm(0);
    const probeTip = point(needle, 'tip');
    expect(probeTip.x).toBeCloseTo(0, 9);
    expect(probeTip.z).toBeCloseTo(0, 9);
    expect(probeTip.y).toBeCloseTo(CHIP.board + CHIP.height + LASER_LOOK.probe.gap, 9);
    // As long and as slim as the probe, its top on the pivot, and no tail yet.
    expect(needle.group.position.y - probeTip.y).toBeCloseTo(PROBE_LENGTH, 9);
    expect(tipMesh.scale.x * DIAL.needle.width).toBeCloseTo(PROBE_WIDTH, 9);
    expect(tail.visible).toBe(false);

    needle.setForm(0.5);
    const half = point(needle, 'tip');
    expect(half.y).toBeGreaterThan(probeTip.y);
    expect(half.z).toBeLessThan(-0.1);
    expect(tail.visible).toBe(true);

    needle.setForm(1);
    const home = point(needle, 'tip');
    expect(home.x).toBeCloseTo(0, 9);
    expect(home.y).toBeCloseTo(NEEDLE_LOOK.pivot, 9);
    expect(home.z).toBeCloseTo(-0.82, 9);
    expect(needle.group.position.y).toBe(NEEDLE_LOOK.pivot);
    needle.setForm(3);
    expect(point(needle, 'tip').z).toBeCloseTo(-0.82, 9);
    needle.setForm(Number.NaN);
    expect(point(needle, 'tip').y).toBeCloseTo(probeTip.y, 9);
    needle.dispose();
  });

  it('never cuts into the chip as it grows: the tip stays at or over the nozzle, the tail over the hub', () => {
    const needle = buildNeedle();
    const nozzle = CHIP.board + CHIP.height + LASER_LOOK.probe.gap;
    for (let k = 0; k <= 40; k++) {
      needle.setForm(k / 40);
      expect(point(needle, 'tip').y, `form ${k / 40}`).toBeGreaterThanOrEqual(nozzle - 1e-9);
      expect(point(needle, 'tail').y, `form ${k / 40}`).toBeGreaterThan(HUB.y);
    }
    needle.dispose();
  });

  it('glows faintly at the tip, more toward the point, and not as the probe', () => {
    const needle = buildNeedle();
    const material = named<THREE.Mesh>(needle.group, 'needle:tip').material as THREE.MeshStandardMaterial;
    expect(material.color.getHex()).toBe(palette.gold);
    expect(material.metalness).toBe(1);
    // As the compass's gold: a little light of its own, so a dark room still shows it gold.
    expect(material.emissive.getHex()).toBe(palette.gold);
    expect(material.emissiveIntensity).toBeGreaterThan(0);
    expect(material.emissiveIntensity).toBeLessThanOrEqual(0.15);
    // The tail and the pivot wear the same gold: one program for the needle.
    expect(named<THREE.Mesh>(needle.group, 'needle:tail').material).toBe(material);
    expect(named<THREE.Mesh>(needle.group, 'needle:pivot').material).toBe(material);
    const shader = compiled(material);
    expect(shader.vertexShader).toContain('vNeedleAlong');
    expect(shader.fragmentShader).toContain('totalEmissiveRadiance += diffuseColor.rgb * uTipGlow * smoothstep( uTipFrom, 1.0, vNeedleAlong );');
    expect(material.customProgramCacheKey()).toBe('needle');
    const glow = shader.uniforms.uTipGlow;
    expect(glow.value).toBe(NEEDLE_LOOK.tip.glow);
    needle.setForm(0);
    expect(glow.value).toBe(0);
    needle.setForm(1);
    // At the point: a faint glow, under the bloom's threshold even before the light on the metal.
    const atPoint = luminance(new THREE.Color(palette.gold).multiplyScalar(glow.value as number));
    expect(atPoint).toBeGreaterThan(0.3);
    expect(atPoint).toBeLessThan(0.8);
    expect(shader.uniforms.uTipFrom.value).toBeGreaterThan(0.5);
    needle.dispose();
  });

  it('frees its geometries and its material', () => {
    const needle = buildNeedle();
    const parts = drawn(needle.group);
    expect(parts).toHaveLength(3);
    const spies = [...new Set([...parts.map((o) => o.geometry), ...parts.map((o) => o.material as THREE.Material)])].map((part) => vi.spyOn(part, 'dispose'));
    expect(spies).toHaveLength(4);
    needle.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalled();
  });
});

describe('the chip city', () => {
  const blocks = cityLayout(60);
  const colourAt = (mesh: THREE.InstancedMesh, i: number) => {
    const c = new THREE.Color();
    mesh.getColorAt(i, c);
    return c;
  };

  it("stands one box per block on the board, with the block's footprint and height", () => {
    const city = buildCity(blocks);
    expect(city.mesh.name).toBe('city');
    expect(city.mesh.count).toBe(blocks.length);
    city.mesh.geometry.computeBoundingBox();
    const matrix = new THREE.Matrix4();
    for (const i of [0, 17, 41, blocks.length - 1]) {
      const block = blocks[i];
      city.mesh.getMatrixAt(i, matrix);
      const box = city.mesh.geometry.boundingBox!.clone().applyMatrix4(matrix);
      expect(box.min.y).toBeCloseTo(CHIP.board, 6);
      expect(box.max.y).toBeCloseTo(CHIP.board + block.h, 6);
      const centre = box.getCenter(new THREE.Vector3());
      expect(centre.x).toBeCloseTo(block.x, 6);
      expect(centre.z).toBeCloseTo(block.z, 6);
      const size = box.getSize(new THREE.Vector3());
      expect(size.x).toBeCloseTo(block.w, 6);
      expect(size.z).toBeCloseTo(block.d, 6);
    }
    city.dispose();
  });

  it('lights each block from its glow and hue, amber in gold and violet in the violet, all dim', () => {
    const city = buildCity(blocks);
    expect(palette.violet).toBe(0x6a35b8);
    expect(CITY_LOOK.hues).toEqual({ amber: palette.gold, violet: palette.violet });
    blocks.forEach((block, i) => {
      const expected = new THREE.Color(CITY_LOOK.hues[block.hue]).multiplyScalar(block.glow * CITY_LOOK.emissive);
      const actual = colourAt(city.mesh, i);
      expect(actual.r).toBeCloseTo(expected.r, 6);
      expect(actual.g).toBeCloseTo(expected.g, 6);
      expect(actual.b).toBeCloseTo(expected.b, 6);
      // Even the brightest block glows well under the bloom's threshold: a hint of light below the glass.
      expect(luminance(actual)).toBeLessThan(0.35);
    });
    expect(new Set(blocks.map((b) => b.hue))).toEqual(new Set(['amber', 'violet']));
    const body = city.mesh.material as THREE.MeshStandardMaterial;
    expect(body.color.getHex()).toBe(palette.ink);
    city.dispose();
  });

  it("scales the whole city's light with setGlow, held to 0..1, without touching a block", () => {
    const city = buildCity(blocks);
    const shader = compiled(city.mesh.material as THREE.Material);
    const glow = shader.uniforms.uCityGlow;
    expect(glow.value).toBe(1);
    const version = city.mesh.instanceColor!.version;
    city.setGlow(0.4);
    expect(glow.value).toBe(0.4);
    city.setGlow(2);
    expect(glow.value).toBe(1);
    city.setGlow(Number.NaN);
    expect(glow.value).toBe(0);
    expect(city.mesh.instanceColor!.version).toBe(version);
    city.dispose();
  });

  it("moves a block's colour from its paint to its glow, brighter on its roof than on its walls", () => {
    const city = buildCity(blocks);
    const material = city.mesh.material as THREE.MeshStandardMaterial;
    const shader = compiled(material);
    expect(shader.fragmentShader).not.toContain('#include <color_fragment>');
    expect(shader.fragmentShader).toContain('totalEmissiveRadiance += vColor.rgb * uCityGlow * mix( uCitySide, 1.0, vCityRoof );');
    expect(shader.vertexShader).toContain('vCityRoof = max( normal.y, 0.0 );');
    expect(shader.uniforms.uCitySide.value).toBe(CITY_LOOK.side);
    expect(CITY_LOOK.side).toBeLessThan(1);
    expect(material.customProgramCacheKey()).toBe('city');
    city.dispose();
  });

  it('builds an empty city without a fault', () => {
    const city = buildCity([]);
    expect(city.mesh.count).toBe(0);
    city.setGlow(0.5);
    city.dispose();
  });

  it('frees its box, its material and its instance buffers', () => {
    const city = buildCity(blocks);
    const spies = [city.mesh.geometry, city.mesh.material as THREE.Material, city.mesh].map((part) => vi.spyOn(part, 'dispose'));
    city.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalled();
  });
});

describe('the constellations', () => {
  const starsOf = (sky: ReturnType<typeof buildConstellations>, id: string) => named<THREE.Points>(sky.group, `stars:${id}`);
  const uniformsOf = (o: THREE.Object3D) => ((o as THREE.Points).material as THREE.ShaderMaterial).uniforms;

  it('rests every constellation dim and lights only the one asked', () => {
    const sky = buildConstellations();
    sky.setGlow('china', 1);
    const level = (id: string) => ((sky.group.getObjectByName(`stars:${id}`) as THREE.Points).material as THREE.ShaderMaterial).uniforms.uGlow.value;
    expect(level('china')).toBe(1);
    expect(level('netherlands')).toBeCloseTo(0.3, 9);
    expect(level('aruba')).toBeCloseTo(0.3, 9);
    sky.dispose();
  });

  it('draws every star of each figure where starPositions puts it, sized by its mag', () => {
    const sky = buildConstellations();
    expect(sky.group.name).toBe('constellations');
    for (const id of COUNTRY_IDS) {
      const stars = starsOf(sky, id);
      expect(stars).toBeInstanceOf(THREE.Points);
      expect(Array.from(stars.geometry.getAttribute('position').array)).toEqual(Array.from(starPositions(id)));
      expect(Array.from(stars.geometry.getAttribute('aMag').array)).toEqual(FIGURES[id].stars.map(([, , mag]) => Math.fround(mag)));
      expect(stars.geometry.getAttribute('aSeed').count).toBe(FIGURES[id].stars.length);
      const material = stars.material as THREE.ShaderMaterial;
      expect(material.blending).toBe(THREE.AdditiveBlending);
      expect(material.depthWrite).toBe(false);
      // Sized by depth in the shader: near stars bigger, and softer.
      expect(material.vertexShader).toContain('/ depth');
      expect(material.vertexShader).toContain('vSoft');
    }
    sky.dispose();
  });

  it('joins the stars with thin gold lines, one segment per line of the figure', () => {
    const sky = buildConstellations();
    for (const id of COUNTRY_IDS) {
      const lines = named<THREE.LineSegments>(sky.group, `lines:${id}`);
      expect(lines).toBeInstanceOf(THREE.LineSegments);
      const position = lines.geometry.getAttribute('position');
      const figure = FIGURES[id];
      expect(position.count).toBe(figure.lines.length * 2);
      const stars = starPositions(id);
      figure.lines.forEach(([a, b], k) => {
        expect([position.getX(2 * k), position.getY(2 * k), position.getZ(2 * k)]).toEqual(Array.from(stars.slice(a * 3, a * 3 + 3)));
        expect([position.getX(2 * k + 1), position.getY(2 * k + 1), position.getZ(2 * k + 1)]).toEqual(Array.from(stars.slice(b * 3, b * 3 + 3)));
      });
      const line = uniformsOf(lines).uLine.value as THREE.Color;
      expect(line.equals(new THREE.Color(palette.gold).multiplyScalar(STARS_LOOK.line.level))).toBe(true);
    }
    sky.dispose();
  });

  it("tints each constellation in its country's accent, round a cream core", () => {
    const sky = buildConstellations();
    for (const id of COUNTRY_IDS) {
      const uniforms = uniformsOf(starsOf(sky, id));
      expect((uniforms.uTint.value as THREE.Color).equals(new THREE.Color(countryDirection(id).accent))).toBe(true);
      expect((uniforms.uCore.value as THREE.Color).getHex()).toBe(palette.cream);
    }
    sky.dispose();
  });

  it('brightens the lines and the reflection with the stars, and holds a glow to 0..1', () => {
    const sky = buildConstellations();
    sky.setGlow('aruba', 0.8);
    const glow = uniformsOf(starsOf(sky, 'aruba')).uGlow;
    expect(glow.value).toBe(0.8);
    expect(uniformsOf(named(sky.group, 'lines:aruba')).uGlow).toBe(glow);
    expect(uniformsOf(named(sky.group, 'mirror:stars:aruba')).uGlow).toBe(glow);
    expect(uniformsOf(named(sky.group, 'mirror:lines:aruba')).uGlow).toBe(glow);
    expect(uniformsOf(starsOf(sky, 'china')).uGlow).not.toBe(glow);
    sky.setGlow('aruba', 5);
    expect(glow.value).toBe(1);
    sky.setGlow('aruba', -1);
    expect(glow.value).toBe(0);
    sky.setGlow('aruba', Number.NaN);
    expect(glow.value).toBe(STARS_LOOK.rest);
    sky.dispose();
  });

  it('mirrors each constellation below the dial plane at a quarter of its light, onto the glass, before the glass', () => {
    const sky = buildConstellations();
    sky.group.updateMatrixWorld(true);
    for (const id of COUNTRY_IDS) {
      const mirror = named<THREE.Group>(sky.group, `mirror:${id}`);
      expect(mirror.isGroup).toBe(true);
      // Drawn ahead of everything at the default order, the glass among it, so the glass lies over the reflection.
      expect(mirror.renderOrder).toBeLessThan(0);
      const stars = named<THREE.Points>(mirror, `mirror:stars:${id}`);
      const lines = named<THREE.LineSegments>(mirror, `mirror:lines:${id}`);
      // The same buffers as the constellation's own, turned upside down about y = 0.
      expect(stars.geometry).toBe(starsOf(sky, id).geometry);
      expect(lines.geometry).toBe(named<THREE.LineSegments>(sky.group, `lines:${id}`).geometry);
      const original = starPositions(id);
      const world = new THREE.Vector3();
      for (let v = 0; v < original.length / 3; v++) {
        world.fromArray(original, v * 3).applyMatrix4(stars.matrixWorld);
        expect(world.y).toBeCloseTo(-original[v * 3 + 1], 6);
        expect(world.y).toBeLessThan(0);
      }
      for (const part of [stars, lines]) {
        const material = part.material as THREE.ShaderMaterial;
        expect(material.uniforms.uOpacity.value).toBe(0.25);
        expect(material.defines.MIRROR).toBeDefined();
        // Seen in the glass only: faded in from over the hub to the inner ring's edge, and out by the outer ring's.
        const edge = material.uniforms.uGlassEdge.value as THREE.Vector4;
        expect(edge.y).toBe(GLASS_RINGS[0].inner);
        expect(edge.w).toBe(GLASS_RINGS[GLASS_RINGS.length - 1].outer);
        expect(edge.x).toBeLessThan(edge.y);
        expect(edge.y).toBeLessThan(edge.z);
        expect(edge.z).toBeLessThan(edge.w);
        expect(material.vertexShader).toContain('smoothstep(uGlassEdge.x, uGlassEdge.y, r) * (1.0 - smoothstep(uGlassEdge.z, uGlassEdge.w, r))');
      }
      expect(uniformsOf(starsOf(sky, id)).uOpacity.value).toBe(1);
      expect((starsOf(sky, id).material as THREE.ShaderMaterial).defines.MIRROR).toBeUndefined();
    }
    sky.dispose();
  });

  it('twinkles a few stars, only when asked, from the time alone', () => {
    const sky = buildConstellations();
    const uniforms = uniformsOf(starsOf(sky, 'china'));
    sky.setTwinkle(12.5, true);
    expect(uniforms.uTime.value).toBe(12.5);
    expect(uniforms.uTwinkle.value).toBe(1);
    sky.setTwinkle(3, false);
    expect(uniforms.uTime.value).toBe(3);
    expect(uniforms.uTwinkle.value).toBe(0);
    sky.setTwinkle(Number.NaN, true);
    expect(uniforms.uTime.value).toBe(0);
    // One clock for every star, the reflection's too.
    expect(uniformsOf(starsOf(sky, 'aruba')).uTime).toBe(uniforms.uTime);
    expect(uniformsOf(named(sky.group, 'mirror:stars:netherlands')).uTwinkle).toBe(uniforms.uTwinkle);
    expect(STARS_LOOK.twinkle.share).toBeLessThanOrEqual(0.5);
    sky.dispose();
  });

  it("puts each anchor at its constellation's centroid", () => {
    const sky = buildConstellations();
    for (const id of COUNTRY_IDS) {
      const stars = starPositions(id);
      const n = stars.length / 3;
      const centroid = [0, 1, 2].map((axis) => Array.from(stars).filter((_, i) => i % 3 === axis).reduce((a, b) => a + b, 0) / n);
      const anchor = sky.anchor(id);
      expect(anchor.x).toBeCloseTo(centroid[0], 6);
      expect(anchor.y).toBeCloseTo(centroid[1], 6);
      expect(anchor.z).toBeCloseTo(centroid[2], 6);
      // Into a target, as three's getters do, so a label can follow it every frame without a new vector.
      const target = new THREE.Vector3();
      expect(sky.anchor(id, target)).toBe(target);
      expect(target.equals(anchor)).toBe(true);
      // A caller may move what it was given.
      anchor.set(9, 9, 9);
      expect(sky.anchor(id).x).toBeCloseTo(centroid[0], 6);
    }
    sky.dispose();
  });

  it('sizes the stars by the picture they are drawn into', () => {
    const sky = buildConstellations();
    const renderer = { getCurrentViewport: (target: THREE.Vector4) => target.set(0, 0, 1600, 900) } as unknown as THREE.WebGLRenderer;
    for (const name of ['stars:china', 'mirror:stars:aruba']) {
      const stars = named<THREE.Points>(sky.group, name);
      const material = stars.material as THREE.ShaderMaterial;
      stars.onBeforeRender(renderer, new THREE.Scene(), new THREE.PerspectiveCamera(), stars.geometry, material, new THREE.Group());
      expect(material.uniforms.uScale.value).toBe(450);
    }
    sky.dispose();
  });

  it("keeps a resting constellation far under the bloom, and a pointed one's brightest star just under it", () => {
    const core = luminance(new THREE.Color(STARS_LOOK.core));
    // A star's centre: its core plus the nearest star's halo, at the most a star's light reaches.
    const peak = core * (1 + STARS_LOOK.halo[1]) * STARS_LOOK.intensity;
    expect(peak * STARS_LOOK.rest).toBeLessThan(0.35);
    expect(peak * STARS_LOOK.pointed).toBeGreaterThan(0.7);
    expect(peak * STARS_LOOK.pointed).toBeLessThan(1);
    expect(STARS_LOOK.rest).toBe(0.3);
    expect(STARS_LOOK.pointed).toBe(1);
    expect(luminance(new THREE.Color(palette.gold).multiplyScalar(STARS_LOOK.line.level))).toBeLessThan(0.3);
  });

  it('frees its geometries and its materials', () => {
    const sky = buildConstellations();
    const parts = drawn(sky.group);
    const geometries = new Set(parts.map((o) => o.geometry));
    const materials = new Set(parts.map((o) => o.material as THREE.Material));
    // Per country: the stars and the lines (shared with the reflection), and four materials.
    expect(geometries.size).toBe(2 * COUNTRY_IDS.length);
    expect(materials.size).toBe(4 * COUNTRY_IDS.length);
    const spies = [...geometries, ...materials].map((part) => vi.spyOn(part, 'dispose'));
    sky.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalled();
  });
});

describe('the mist', () => {
  const sprites = (mist: ReturnType<typeof buildMist>) => mist.group.children as THREE.Sprite[];

  it('hangs 3 to 5 large, soft, additive smoke sprites, faint, drawn after the laser', () => {
    const mist = buildMist();
    expect(mist.group.name).toBe('mist');
    const puffs = sprites(mist);
    expect(puffs.length).toBeGreaterThanOrEqual(3);
    expect(puffs.length).toBeLessThanOrEqual(5);
    const maps = new Set<THREE.Texture | null>();
    for (const puff of puffs) {
      expect(puff.isSprite).toBe(true);
      expect(puff.material.blending).toBe(THREE.AdditiveBlending);
      expect(puff.material.depthWrite).toBe(false);
      expect(puff.material.opacity).toBeLessThanOrEqual(0.25);
      expect(puff.scale.x).toBeGreaterThanOrEqual(1);
      expect(puff.material.color.getHex()).toBe(palette.violet);
      maps.add(puff.material.map);
    }
    // One smoke texture for all, from the studio's noise.
    expect(maps.size).toBe(1);
    expect([...maps][0]).toBeInstanceOf(THREE.DataTexture);
    expect([...maps][0]!.name).toBe('studio:smoke');
    expect(mist.group.isGroup).toBe(true);
    expect(mist.group.renderOrder).toBe(MIST_RENDER_ORDER);
    expect(MIST_RENDER_ORDER).toBeGreaterThan(LASER_RENDER_ORDER);
    mist.dispose();
  });

  it('thickens and thins with setDensity: the loader at 1, the home at 0.35', () => {
    const mist = buildMist();
    mist.setDensity(1);
    sprites(mist).forEach((puff, i) => expect(puff.material.opacity).toBeCloseTo(MIST_LOOK.puffs[i].opacity, 9));
    mist.setDensity(MIST_LOOK.home);
    expect(MIST_LOOK.home).toBe(0.35);
    sprites(mist).forEach((puff, i) => expect(puff.material.opacity).toBeCloseTo(MIST_LOOK.puffs[i].opacity * 0.35, 9));
    mist.setDensity(3);
    sprites(mist).forEach((puff, i) => expect(puff.material.opacity).toBeCloseTo(MIST_LOOK.puffs[i].opacity, 9));
    mist.setDensity(Number.NaN);
    for (const puff of sprites(mist)) expect(puff.material.opacity).toBe(0);
    mist.dispose();
  });

  it('drifts slowly, from the time alone', () => {
    const a = buildMist();
    const b = buildMist();
    const pose = (mist: ReturnType<typeof buildMist>) => sprites(mist).flatMap((puff) => [...puff.position.toArray(), puff.material.rotation]);
    a.setTime(30);
    b.setTime(5);
    b.setTime(30);
    expect(pose(b)).toEqual(pose(a));
    const before = sprites(a).map((puff) => puff.position.clone());
    a.setTime(31);
    expect(pose(a)).not.toEqual(pose(b));
    sprites(a).forEach((puff, i) => expect(puff.position.distanceTo(before[i])).toBeLessThan(0.05));
    a.setTime(Number.NaN);
    for (const value of pose(a)) expect(Number.isFinite(value)).toBe(true);
    a.dispose();
    b.dispose();
  });

  it("frees its materials and its texture, and not the sprites' shared quad", () => {
    const mist = buildMist();
    const puffs = sprites(mist);
    const spies = [...puffs.map((puff) => puff.material), puffs[0].material.map!].map((part) => vi.spyOn(part, 'dispose'));
    const shared = vi.spyOn(puffs[0].geometry, 'dispose');
    mist.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalled();
    expect(shared).not.toHaveBeenCalled();
  });
});

describe('the sky', () => {
  const uniformsOf = (sky: ReturnType<typeof buildSky>) => (sky.mesh.material as THREE.ShaderMaterial).uniforms;

  it('is a sphere of radius 30 seen from inside, drawn behind everything', () => {
    const sky = buildSky();
    expect(sky.mesh.name).toBe('sky');
    expect(sky.mesh.geometry).toBeInstanceOf(THREE.SphereGeometry);
    expect((sky.mesh.geometry as THREE.SphereGeometry).parameters.radius).toBe(30);
    const material = sky.mesh.material as THREE.ShaderMaterial;
    expect(material.side).toBe(THREE.BackSide);
    expect(material.depthWrite).toBe(false);
    expect(material.fog).toBe(false);
    expect(material.transparent).toBe(false);
    expect(sky.mesh.renderOrder).toBeLessThan(0);
    sky.dispose();
  });

  it('layers the smoke in deep violet over the night, the densest cloud at most 0.18 of the violet', () => {
    const sky = buildSky();
    const uniforms = uniformsOf(sky);
    expect(palette.nebula).toBe(0x2a1250);
    expect(palette.night).toBe(0x040209);
    expect((uniforms.uBackground.value as THREE.Color).getHex()).toBe(palette.night);
    expect(SKY_LOOK.nebula.peak).toBeLessThanOrEqual(0.18);
    expect((uniforms.uNebula.value as THREE.Color).equals(new THREE.Color(palette.nebula).multiplyScalar(SKY_LOOK.nebula.peak))).toBe(true);
    expect(uniforms.uSmoke.value).toBeInstanceOf(THREE.DataTexture);
    // The brightest the sky gets is far below anything else in the scene.
    const brightest = (uniforms.uBackground.value as THREE.Color).clone().add(uniforms.uNebula.value as THREE.Color);
    expect(Math.max(brightest.r, brightest.g, brightest.b)).toBeLessThan(0.03);
    expect(SKY_LOOK.nebula.layers.length).toBeGreaterThanOrEqual(2);
    expect((sky.mesh.material as THREE.ShaderMaterial).defines.LAYERS).toBe(SKY_LOOK.nebula.layers.length);
    sky.dispose();
  });

  it('carries a handful of faint fixed stars inside it', () => {
    const sky = buildSky();
    const stars = named<THREE.Points>(sky.mesh, 'sky:stars');
    const position = stars.geometry.getAttribute('position');
    const colour = stars.geometry.getAttribute('color');
    expect(position.count).toBe(SKY_LOOK.stars.count);
    expect(position.count).toBeLessThanOrEqual(100);
    const c = new THREE.Color();
    for (let v = 0; v < position.count; v++) {
      expect(Math.hypot(position.getX(v), position.getY(v), position.getZ(v))).toBeLessThan(30);
      c.fromBufferAttribute(colour, v);
      expect(luminance(c)).toBeLessThan(0.3);
      expect(luminance(c)).toBeGreaterThan(0);
    }
    expect(stars.renderOrder).toBeGreaterThan(sky.mesh.renderOrder);
    // The same stars on every visit.
    const again = buildSky();
    expect(Array.from(named<THREE.Points>(again.mesh, 'sky:stars').geometry.getAttribute('position').array)).toEqual(Array.from(position.array));
    sky.dispose();
    again.dispose();
  });

  it('turns once in 20 minutes', () => {
    const sky = buildSky();
    sky.setTime(300);
    expect(sky.mesh.rotation.y).toBeCloseTo(Math.PI / 2, 9);
    sky.setTime(1200);
    expect(sky.mesh.rotation.y).toBeCloseTo(0, 9);
    sky.setTime(1500);
    expect(sky.mesh.rotation.y).toBeCloseTo(Math.PI / 2, 9);
    sky.setTime(Number.NaN);
    expect(sky.mesh.rotation.y).toBe(0);
    sky.dispose();
  });

  it('frees its geometries, its materials and its textures', () => {
    const sky = buildSky();
    const parts = drawn(sky.mesh);
    const materials = parts.map((o) => o.material as THREE.Material);
    const textures = [uniformsOf(sky).uSmoke.value as THREE.Texture, (materials[1] as THREE.PointsMaterial).map!];
    expect(parts).toHaveLength(2);
    const spies = [...parts.map((o) => o.geometry), ...materials, ...textures].map((part) => vi.spyOn(part, 'dispose'));
    sky.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalled();
  });
});

describe('the reflection room', () => {
  it("is milestone 1's room of light cards at half its radiance, in the palette's colours", () => {
    const room = roomScene();
    const cards = room.scene.children.filter((o) => o.name.startsWith('room:card:')) as THREE.Mesh[];
    expect(cards).toHaveLength(ROOM_LOOK.cards.length);
    expect(ROOM_LOOK.radiance).toBe(0.5);
    // Milestone 1's radiances, halved.
    expect(ROOM_LOOK.cards.map((card) => card.radiance * ROOM_LOOK.radiance)).toEqual([1.2, 0.4, 0.6, 0.3]);
    cards.forEach((card, k) => {
      const spec = ROOM_LOOK.cards[k];
      const colour = (card.material as THREE.MeshBasicMaterial).color;
      expect(colour.equals(new THREE.Color(spec.colour).multiplyScalar(spec.radiance * ROOM_LOOK.radiance))).toBe(true);
      expect(Object.values(palette)).toContain(spec.colour);
      // Ten out, facing the middle.
      expect(card.position.length()).toBeCloseTo(10, 6);
      const facing = card.getWorldDirection(new THREE.Vector3());
      expect(facing.dot(card.position.clone().normalize())).toBeCloseTo(-1, 6);
    });
    const walls = named<THREE.Mesh>(room.scene, 'room:walls');
    expect((walls.material as THREE.MeshBasicMaterial).side).toBe(THREE.BackSide);
    expect((walls.material as THREE.MeshBasicMaterial).color.getHex()).toBe(palette.ink);
    const parts = drawn(room.scene);
    const spies = [...new Set([...parts.map((o) => o.geometry), ...parts.map((o) => o.material as THREE.Material)])].map((part) => vi.spyOn(part, 'dispose'));
    room.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalled();
  });

  it('prefilters the room through PMREM once, frees the room and the generator straight away, and its result on dispose', () => {
    const target = new THREE.WebGLRenderTarget(1, 1);
    const fromScene = vi.fn((_scene: THREE.Scene, _sigma?: number) => target);
    const generatorDispose = vi.fn();
    const generator = vi.fn(() => ({ fromScene, dispose: generatorDispose }));
    const renderer = {} as THREE.WebGLRenderer;
    const freed = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
    const room = buildRoom(renderer, generator);
    expect(generator).toHaveBeenCalledWith(renderer);
    expect(fromScene).toHaveBeenCalledTimes(1);
    expect(fromScene.mock.calls[0][0]).toBeInstanceOf(THREE.Scene);
    expect(fromScene.mock.calls[0][1]).toBe(ROOM_LOOK.blur);
    expect(room.environment).toBe(target.texture);
    expect(generatorDispose).toHaveBeenCalled();
    // The shell and the cards' plane.
    expect(freed.mock.calls.length).toBeGreaterThanOrEqual(2);
    freed.mockRestore();
    const released = vi.spyOn(target, 'dispose');
    room.dispose();
    expect(released).toHaveBeenCalled();
  });
});

describe("the home's colours", () => {
  it('add the glass, the violet, the nebula and the night to the palette', () => {
    expect(palette.glass).toBe(0x120a1c);
    expect(palette.violet).toBe(0x6a35b8);
    expect(palette.nebula).toBe(0x2a1250);
    expect(palette.night).toBe(0x040209);
  });

  it('are named in no builder: no hex colour, no CSS colour and no colour made from bare numbers', () => {
    for (const file of ['glassCompass', 'needle', 'city', 'constellations', 'mist', 'sky', 'room']) {
      const source = readFileSync(fileURLToPath(new URL(`../../../src/engine/v3/build/${file}.ts`, import.meta.url)), 'utf8');
      expect(source, file).not.toMatch(/\b0x[0-9a-f]{6}\b/i);
      expect(source, file).not.toMatch(/['"`]#[0-9a-f]{3,8}['"`]/i);
      expect(source, file).not.toMatch(/Color\(\s*[\d.]+\s*,/);
    }
  });
});
