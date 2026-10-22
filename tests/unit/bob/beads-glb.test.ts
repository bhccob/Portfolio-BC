import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { BEADS_GLB_BUDGET, readGlbJson } from '~/engine/bob/glb';
import { CAMERA_PATH } from '~/scene/bob/journey';

/**
 * The beads' GLB (tools/blender/export_beads.py), read from the file itself:
 * its nodes, materials, embedded vein maps and the shapes the code relies on
 * (Task 8 finds every node by these names). Three's frame throughout: the
 * porthole faces +z and up is +y.
 */
const bytes = new Uint8Array(readFileSync('public/models/bob-beads.glb'));

const IDS = ['funcial', 'jontai-energy', 'cookies-clicker'] as const;
type Id = (typeof IDS)[number];
const PARTS = ['body', 'halo', 'rim', 'glass', 'display', 'object', 'inner'] as const;

/** Each bead's real screenshot, whose shape its display's screen takes (src/assets/beads/). */
const SCREENSHOTS: Record<Id, string> = {
  funcial: 'src/assets/beads/funcial.webp',
  'jontai-energy': 'src/assets/beads/jontai-energy.webp',
  'cookies-clicker': 'src/assets/beads/cookies-clicker.webp'
};

/** The body's radius and the porthole's, as a share of it (the brief: about 0.62). */
const RADIUS = 0.95;
const PORTHOLE = 0.62;
/** The hollow behind the porthole: a sphere of this radius about (0, 0, z). */
const CAVITY = { radius: 0.72, z: 0.331 };

/** The shells' four materials (export_beads.py), and those each bead's object adds (bead_<id>.py). */
const SHELL_MATERIALS = ['bead:display', 'bead:glass', 'bead:gold', 'bead:lacquer'];
const OBJECT_MATERIALS = {
  funcial: ['bead:abacus', 'bead:aluminium', 'bead:track'],
  'jontai-energy': ['bead:backsheet', 'bead:cell', 'bead:polymer', 'bead:satin', 'bead:silver']
};

/** The fields of the glTF JSON the reader's own type leaves out and these tests look at. */
interface Gltf {
  extensionsUsed?: string[];
  extensions?: { KHR_lights_punctual?: { lights: { type: string; color?: number[]; intensity?: number }[] } };
  nodes: {
    name?: string;
    mesh?: number;
    children?: number[];
    translation?: number[];
    rotation?: number[];
    scale?: number[];
    matrix?: number[];
    extensions?: { KHR_lights_punctual?: { light: number } };
  }[];
  meshes: { primitives: { attributes: Record<string, number>; material?: number }[] }[];
  materials: {
    name?: string;
    emissiveFactor?: number[];
    emissiveTexture?: { index: number };
    occlusionTexture?: { index: number; strength?: number };
    pbrMetallicRoughness?: {
      baseColorFactor?: number[];
      metallicFactor?: number;
      roughnessFactor?: number;
      metallicRoughnessTexture?: { index: number };
    };
    extensions?: { KHR_materials_specular?: { specularFactor?: number; specularColorFactor?: number[] } };
  }[];
  textures: { source: number }[];
  images: { bufferView?: number; uri?: string; mimeType?: string }[];
  accessors: { bufferView: number; byteOffset?: number; count: number; type: string; componentType: number }[];
  bufferViews: { byteOffset?: number; byteLength: number; byteStride?: number }[];
}

const gltf = readGlbJson(bytes) as unknown as Gltf;
const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
/** Where the binary chunk's data begins: after the file header, the JSON chunk and the binary chunk's own header. */
const binStart = 12 + 8 + view.getUint32(12, true) + 8;
const COMPONENTS: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

/** An accessor's rows of floats, read from the binary chunk. */
function rows(accessor: number): number[][] {
  const a = gltf.accessors[accessor];
  expect(a.componentType, `accessor ${accessor} is float`).toBe(5126);
  const n = COMPONENTS[a.type];
  const bv = gltf.bufferViews[a.bufferView];
  const stride = bv.byteStride ?? n * 4;
  const offset = binStart + (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  return Array.from({ length: a.count }, (_, i) => Array.from({ length: n }, (_, c) => view.getFloat32(offset + i * stride + c * 4, true)));
}

function node(name: string) {
  const found = gltf.nodes.find((n) => n.name === name);
  expect(found, name).toBeDefined();
  return found!;
}

function material(name: string) {
  const found = gltf.materials.find((m) => m.name === name);
  expect(found, name).toBeDefined();
  return found!;
}

function materialName(index: number | undefined): string | undefined {
  return index === undefined ? undefined : gltf.materials[index].name;
}

/** The primitives of the node's mesh. */
function primitives(name: string) {
  const n = node(name);
  expect(n.mesh, `${name} has a mesh`).toBeTypeOf('number');
  return gltf.meshes[n.mesh!].primitives;
}

/** The rows of an attribute of the node's primitive that wears this material (its only one when no material is named). */
function attribute(name: string, attributeName: string, materialNamed?: string): number[][] {
  const all = primitives(name);
  const primitive = materialNamed === undefined ? all[0] : all.find((p) => materialName(p.material) === materialNamed);
  expect(primitive, `${name} has a primitive in ${materialNamed}`).toBeDefined();
  expect(primitive!.attributes[attributeName], `${name} has ${attributeName}`).toBeTypeOf('number');
  return rows(primitive!.attributes[attributeName]);
}

/** Every primitive's rows of an attribute, joined. */
function allRows(name: string, attributeName: string): number[][] {
  return primitives(name).flatMap((p) => rows(p.attributes[attributeName]));
}

/** A point turned by a unit quaternion (x, y, z, w) and moved by a translation, as a node's TRS places its mesh. */
function place(p: number[], rotation = [0, 0, 0, 1], translation = [0, 0, 0]): number[] {
  const [qx, qy, qz, qw] = rotation;
  const [x, y, z] = p;
  // t = 2 q.xyz x p; p' = p + w t + q.xyz x t
  const tx = 2 * (qy * z - qz * y),
    ty = 2 * (qz * x - qx * z),
    tz = 2 * (qx * y - qy * x);
  return [
    x + qw * tx + (qy * tz - qz * ty) + translation[0],
    y + qw * ty + (qz * tx - qx * tz) + translation[1],
    z + qw * tz + (qx * ty - qy * tx) + translation[2]
  ];
}

const length = (p: number[]) => Math.hypot(p[0], p[1], p[2]);
const offAxis = (p: number[]) => Math.hypot(p[0], p[1]);
const fromCavity = (p: number[]) => Math.hypot(p[0], p[1], p[2] - CAVITY.z);

/** The body's vertices, each with its normal and UV, and whether it is on the shell (facing out) or the cavity's wall (facing in). */
function bodyVertices(id: Id = 'funcial') {
  const points = attribute(`bead_${id}_body`, 'POSITION');
  const normals = attribute(`bead_${id}_body`, 'NORMAL');
  const uvs = attribute(`bead_${id}_body`, 'TEXCOORD_0');
  return points.map((p, k) => ({ p, n: normals[k], uv: uvs[k], shell: p[0] * normals[k][0] + p[1] * normals[k][1] + p[2] * normals[k][2] > 0 }));
}

/** The bytes of an image embedded in the GLB's binary chunk (not a file beside it). */
function embedded(image: number): Uint8Array {
  const { bufferView, uri } = gltf.images[image];
  expect(uri, `image ${image} embedded, not a file beside it`).toBeUndefined();
  const bv = gltf.bufferViews[bufferView!];
  const at = binStart + (bv.byteOffset ?? 0);
  return bytes.subarray(at, at + bv.byteLength);
}

interface Png {
  width: number;
  height: number;
  channels: number;
  data: Uint8Array;
}

/**
 * An 8-bit, non-interlaced PNG's pixels (top row first), unfiltered: grey as one channel, RGB and
 * indexed colour (expanded through its palette) as three.
 */
function decodePng(png: Uint8Array): Png {
  expect(Array.from(png.subarray(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let width = 0,
    height = 0,
    type = -1;
  let palette: Uint8Array | undefined;
  const idat: Uint8Array[] = [];
  for (let at = 8; at < png.length; ) {
    const len = dv.getUint32(at);
    const kind = String.fromCharCode(...png.subarray(at + 4, at + 8));
    if (kind === 'IHDR') {
      [width, height, type] = [dv.getUint32(at + 8), dv.getUint32(at + 12), png[at + 17]];
      expect(png[at + 16], 'bit depth').toBe(8);
      expect(png[at + 20], 'interlace').toBe(0);
      expect([0, 2, 3], 'grey, RGB or indexed').toContain(type);
    }
    if (kind === 'PLTE') palette = png.subarray(at + 8, at + 8 + len);
    if (kind === 'IDAT') idat.push(png.subarray(at + 8, at + 8 + len));
    if (kind === 'IEND') break;
    at += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = type === 2 ? 3 : 1;
  const stride = width * bpp;
  const data = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= bpp ? data[y * stride + x - bpp] : 0;
      const b = y > 0 ? data[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? data[(y - 1) * stride + x - bpp] : 0;
      const p = a + b - c;
      const paeth = Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c;
      data[y * stride + x] = (v + [0, a, b, (a + b) >> 1, paeth][filter]) & 0xff;
    }
  }
  if (type !== 3) return { width, height, channels: bpp, data };
  expect(palette, 'an indexed PNG has its palette').toBeDefined();
  const rgb = new Uint8Array(width * height * 3);
  data.forEach((index, i) => rgb.set(palette!.subarray(3 * index, 3 * index + 3), 3 * i));
  return { width, height, channels: 3, data: rgb };
}

/** A channel of the texel a glTF UV falls on (v runs down the image). */
function texel(png: Png, channel: number, [u, v]: number[]): number {
  const x = Math.min(png.width - 1, Math.max(0, Math.floor(u * png.width)));
  const y = Math.min(png.height - 1, Math.max(0, Math.floor(v * png.height)));
  return png.data[(y * png.width + x) * png.channels + channel];
}

/** sRGB's transfer, both ways, on 0..1. */
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
/** The 8-bit tables: a linear byte to its sRGB byte, and back. */
const ENCODE = Array.from({ length: 256 }, (_, i) => Math.round(255 * toSrgb(i / 255)));
const DECODE = Array.from({ length: 256 }, (_, i) => Math.round(255 * toLinear(i / 255)));

/** The lacquer's three maps, decoded once: the emissive vein mask and the ORM image (occlusion, roughness, metal). */
let lacquerMaps: { veins: Png; orm: Png } | undefined;
function maps() {
  if (!lacquerMaps) {
    const lacquer = material('bead:lacquer');
    const source = (index: number) => gltf.textures[index].source;
    lacquerMaps = {
      veins: decodePng(embedded(source(lacquer.emissiveTexture!.index))),
      orm: decodePng(embedded(source(lacquer.pbrMetallicRoughness!.metallicRoughnessTexture!.index)))
    };
  }
  return lacquerMaps;
}

/** A WebP's width and height, from its first chunk (lossy VP8, lossless VP8L or extended VP8X). */
function webpSize(path: string): [number, number] {
  const b = readFileSync(path);
  const chunk = b.toString('latin1', 12, 16);
  if (chunk === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  if (chunk === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
  }
  if (chunk === 'VP8X') return [b.readUIntLE(24, 3) + 1, b.readUIntLE(27, 3) + 1];
  throw new TypeError(`${path}: not a WebP this test reads (${chunk})`);
}

describe('the beads GLB', () => {
  it('stays within its budget, without Draco or meshopt', () => {
    expect(bytes.byteLength).toBeLessThanOrEqual(BEADS_GLB_BUDGET);
    for (const ext of gltf.extensionsUsed ?? []) expect(ext).not.toMatch(/draco|meshopt/i);
  });

  it('holds every part of all three beads', () => {
    const names = gltf.nodes.map((n) => n.name);
    for (const id of IDS) {
      expect(names).toContain(`bead_${id}`);
      for (const part of PARTS) expect(names).toContain(`bead_${id}_${part}`);
    }
  });

  it('hangs each part on its bead, whose root stands at the origin for code to place', () => {
    for (const id of IDS) {
      const root = node(`bead_${id}`);
      expect(root.mesh, 'the root is an empty').toBeUndefined();
      for (const key of ['translation', 'rotation', 'scale', 'matrix'] as const) expect(root[key], `${id} root ${key}`).toBeUndefined();
      const children = (root.children ?? []).map((c) => gltf.nodes[c].name);
      for (const part of PARTS) expect(children, id).toContain(`bead_${id}_${part}`);
    }
  });

  it('leaves the object slot an empty on the porthole axis, behind the glass', () => {
    for (const id of IDS) {
      const slot = node(`bead_${id}_object`);
      expect(slot.mesh, `${id} slot`).toBeUndefined();
      const [x, y, z] = slot.translation ?? [0, 0, 0];
      expect(Math.hypot(x, y), `${id} slot off the axis`).toBeLessThan(1e-4);
      expect(z).toBeGreaterThan(0);
      expect(z).toBeLessThan(0.7);
    }
  });

  it("names the shells' four materials and the objects' own, and each shell part wears its own", () => {
    expect(gltf.materials.map((m) => m.name).sort()).toEqual([...SHELL_MATERIALS, ...Object.values(OBJECT_MATERIALS).flat()].sort());
    for (const id of IDS) {
      const wears = (part: string) => primitives(`bead_${id}_${part}`).map((p) => materialName(p.material));
      expect(wears('body')).toEqual(['bead:lacquer']);
      expect(wears('halo')).toEqual(['bead:gold']);
      expect(wears('rim')).toEqual(['bead:gold']);
      expect(wears('glass')).toEqual(['bead:glass']);
      // The screen and its bezel are the dark glass; a thin edge round them is gold.
      expect(wears('display').sort()).toEqual(['bead:display', 'bead:gold']);
    }
  });

  it('embeds the baked veins, 1024 square: the emissive map sRGB-encoded, the metal map linear', () => {
    const lacquer = material('bead:lacquer');
    for (const t of [lacquer.emissiveTexture!.index, lacquer.pbrMetallicRoughness!.metallicRoughnessTexture!.index])
      expect(gltf.images[gltf.textures[t].source].mimeType).toBe('image/png');
    const { veins, orm } = maps();
    for (const png of [veins, orm]) expect([png.width, png.height]).toEqual([1024, 1024]);
    // The emissive map is the vein mask, grey, written through the 8-bit sRGB table (glTF reads emissive maps as sRGB):
    // every byte is the encoding of a linear byte, and some of the shell is veined, most of it is not.
    expect(veins.channels).toBe(1);
    const encoded = new Set(ENCODE);
    const notEncoded = veins.data.filter((v) => !encoded.has(v)).length;
    expect(notEncoded, 'bytes that are no linear byte sRGB-encoded').toBe(0);
    const veined = veins.data.filter((v) => v > 186).length / veins.data.length; // above half, linear
    expect(veined).toBeGreaterThan(0.005);
    expect(veined).toBeLessThan(0.1);
    // The metal map is the same mask, linear, in blue (glTF's metal), its green (roughness) full: the roughness is the factor.
    expect(orm.channels).toBe(3);
    let blueOff = 0,
      greenOff = 0;
    for (let i = 0; i < veins.data.length; i++) {
      if (Math.abs(orm.data[3 * i + 2] - DECODE[veins.data[i]]) > 1) blueOff++;
      if (orm.data[3 * i + 1] !== 255) greenOff++;
    }
    expect(blueOff, 'texels whose metal is not the decoded vein mask').toBe(0);
    expect(greenOff, 'texels whose roughness is not full').toBe(0);
    expect(lacquer.pbrMetallicRoughness!.metallicFactor ?? 1).toBe(1);
    // Never mirror-glossy: a point light on roughness near 0 is a hard clipped dot.
    expect(lacquer.pbrMetallicRoughness!.roughnessFactor).toBeGreaterThanOrEqual(0.25);
    // The veins glow in the gold light (palette.goldLight, the preview's GOLD_EMIT).
    const [r, g, b] = lacquer.emissiveFactor!;
    expect(r).toBeGreaterThan(0);
    expect(g / r).toBeCloseTo(0.52, 2);
    expect(b / r).toBeCloseTo(0.16, 2);
  });

  it("occludes the cavity in the metal map's red, glTF's ORM packing, and leaves the shell open", () => {
    const lacquer = material('bead:lacquer');
    expect(lacquer.occlusionTexture, 'the lacquer has an occlusion map').toBeDefined();
    const source = (index: number) => gltf.textures[index].source;
    expect(source(lacquer.occlusionTexture!.index), 'occlusion, roughness and metal in one image').toBe(
      source(lacquer.pbrMetallicRoughness!.metallicRoughnessTexture!.index)
    );
    expect(lacquer.occlusionTexture!.strength ?? 1).toBe(1);
    const { orm } = maps();
    const vertices = bodyVertices();
    for (const { uv } of vertices.filter((v) => v.shell)) expect(texel(orm, 0, uv), `shell at ${uv}`).toBeGreaterThanOrEqual(250);
    const cavity = vertices.filter((v) => !v.shell);
    const occlusion = cavity.map(({ uv }) => texel(orm, 0, uv) / 255);
    expect(occlusion.reduce((s, o) => s + o, 0) / occlusion.length, 'the hollow on average').toBeLessThan(0.6);
    // Deep in the hollow, behind the centre, little of the sky reaches.
    for (const { p, uv } of cavity.filter((v) => v.p[2] < 0)) expect(texel(orm, 0, uv) / 255, `deep at ${p}`).toBeLessThan(0.5);
  });

  it("keeps the veins off the cavity's wall", () => {
    const { veins } = maps();
    const uvs = bodyVertices()
      .filter((v) => !v.shell)
      .map((v) => v.uv);
    const [u0, u1] = [Math.min(...uvs.map((t) => t[0])), Math.max(...uvs.map((t) => t[0]))];
    const [v0, v1] = [Math.min(...uvs.map((t) => t[1])), Math.max(...uvs.map((t) => t[1]))];
    let brightest = 0;
    for (let y = Math.floor(v0 * 1024) - 4; y <= Math.ceil(v1 * 1024) + 4; y++)
      for (let x = Math.floor(u0 * 1024) - 4; x <= Math.ceil(u1 * 1024) + 4; x++) brightest = Math.max(brightest, veins.data[y * 1024 + x]);
    expect(brightest, "the brightest vein texel in the cavity's UV square").toBe(0);
  });

  it('makes each body a sphere of radius 0.95 with UVs for the veins', () => {
    for (const id of IDS) {
      const points = attribute(`bead_${id}_body`, 'POSITION');
      const radius = Math.max(...points.map(length));
      expect(Math.abs(radius - RADIUS), `${id} radius ${radius}`).toBeLessThanOrEqual(0.01);
      expect(attribute(`bead_${id}_body`, 'TEXCOORD_0')).toHaveLength(points.length);
    }
  });

  it('opens the body behind the porthole, facing +z, onto a hollow cavity', () => {
    const vertices = bodyVertices();
    const shell = vertices.filter((v) => v.shell).map((v) => v.p);
    const cavity = vertices.filter((v) => !v.shell).map((v) => v.p);
    for (const p of shell) expect(length(p)).toBeCloseTo(RADIUS, 3);
    // No shell in front of the porthole: the shell stops at the opening's edge, 0.62 of the radius off the axis.
    const edge = Math.sqrt(1 - PORTHOLE ** 2);
    for (const p of shell) expect(p[2] / length(p)).toBeLessThanOrEqual(edge + 1e-3);
    const front = shell.reduce((a, p) => (p[2] > a[2] ? p : a));
    expect(offAxis(front) / RADIUS).toBeCloseTo(PORTHOLE, 2);
    // The cavity: a sphere of 0.72 inside the shell, open at the porthole's edge and reaching back past the centre.
    expect(cavity.length).toBeGreaterThan(100);
    for (const p of cavity) {
      expect(length(p)).toBeLessThanOrEqual(RADIUS + 1e-4);
      expect(fromCavity(p)).toBeCloseTo(CAVITY.radius, 3);
    }
    expect(Math.min(...cavity.map((p) => p[2]))).toBeLessThan(0);
    expect(Math.max(...cavity.map((p) => p[2]))).toBeCloseTo(RADIUS * edge, 3);
  });

  it('sinks a flat gold rim along the shell over the opening, standing a little proud', () => {
    const rim = attribute('bead_funcial_rim', 'POSITION');
    const proud = Math.max(...rim.map(length)) - RADIUS;
    expect(proud).toBeGreaterThan(0.01);
    expect(proud).toBeLessThan(0.03);
    expect(Math.min(...rim.map(length))).toBeGreaterThan(RADIUS - 0.04);
    // It covers the opening's edge.
    expect(Math.min(...rim.map(offAxis))).toBeLessThan(PORTHOLE * RADIUS);
    expect(Math.max(...rim.map(offAxis))).toBeGreaterThan(PORTHOLE * RADIUS);
    for (const p of rim) expect(p[2]).toBeGreaterThan(0.6);
  });

  it('seals the porthole with glass: a cap concentric with the shell, its edge under the rim, faintly reflective', () => {
    const glass = attribute('bead_funcial_glass', 'POSITION');
    const normals = attribute('bead_funcial_glass', 'NORMAL');
    const apex = glass.reduce((a, p) => (p[2] > a[2] ? p : a));
    expect(offAxis(apex), 'the crown on the axis').toBeLessThan(1e-3);
    expect(apex[2]).toBeCloseTo(0.935, 2);
    glass.forEach((p, k) => {
      expect(length(p), 'on a sphere about the shell centre').toBeCloseTo(apex[2], 3);
      const n = normals[k];
      expect((p[0] * n[0] + p[1] * n[1] + p[2] * n[2]) / length(p), 'facing out from the centre').toBeGreaterThan(0.999);
    });
    const rim = attribute('bead_funcial_rim', 'POSITION');
    const edge = Math.max(...glass.map(offAxis));
    expect(edge).toBeLessThanOrEqual(PORTHOLE * RADIUS);
    expect(edge, "the glass's edge reaches under the rim").toBeGreaterThan(Math.min(...rim.map(offAxis)));
    // Clear, and a dim mirror: a full-strength specular made a hard disc of the key light.
    const glassMaterial = material('bead:glass');
    const specular = glassMaterial.extensions?.KHR_materials_specular;
    expect(specular, 'KHR_materials_specular').toBeDefined();
    const level = (specular!.specularFactor ?? 1) * Math.max(...(specular!.specularColorFactor ?? [1, 1, 1]));
    expect(level).toBeGreaterThanOrEqual(0.15);
    expect(level).toBeLessThanOrEqual(0.35);
  });

  it('rings the outline with the gold halo', () => {
    for (const p of attribute('bead_funcial_halo', 'POSITION')) {
      expect(offAxis(p)).toBeGreaterThanOrEqual(RADIUS);
      expect(offAxis(p)).toBeLessThan(RADIUS + 0.03);
      expect(Math.abs(p[2])).toBeLessThan(0.05);
    }
  });

  it('shares the shell, halo, rim and glass between the beads', () => {
    for (const part of ['body', 'halo', 'rim', 'glass']) {
      const meshes = new Set(IDS.map((id) => node(`bead_${id}_${part}`).mesh));
      expect(meshes.size, part).toBe(1);
    }
  });

  it("shapes each display's screen as its screenshot, its UV running 0..1 across it from the top left", () => {
    for (const id of IDS) {
      const [w, h] = webpSize(SCREENSHOTS[id]);
      const points = attribute(`bead_${id}_display`, 'POSITION', 'bead:display');
      const uvs = attribute(`bead_${id}_display`, 'TEXCOORD_0', 'bead:display');
      // The screen: the dark glass whose UV lies in 0..1 (the bezel round it runs past those bounds).
      const inside = (uv: number[]) => uv.every((c) => c >= -1e-6 && c <= 1 + 1e-6);
      const screen = points.filter((_, k) => inside(uvs[k]));
      const xs = screen.map((p) => p[0]),
        ys = screen.map((p) => p[1]);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      expect((x1 - x0) / (y1 - y0), `${id} screen ${w}x${h}`).toBeCloseTo(w / h, 2);
      const zs = points.map((p) => p[2]);
      expect(Math.max(...zs) - Math.min(...zs), `${id} screen and bezel are flat`).toBeLessThan(1e-4);
      // glTF's v runs down the image: v = 0 at the top edge, so a texture with flipY off shows the screenshot upright.
      // One affine map over the screen and its bezel alike.
      points.forEach(([x, y], k) => {
        expect(uvs[k][0]).toBeCloseTo((x - x0) / (x1 - x0), 4);
        expect(uvs[k][1]).toBeCloseTo((y1 - y) / (y1 - y0), 4);
      });
      expect(Math.min(...uvs.map((t) => t[0])), `${id} bezel to the left`).toBeLessThan(0);
      expect(Math.max(...uvs.map((t) => t[1])), `${id} bezel below`).toBeGreaterThan(1);
      for (const n of attribute(`bead_${id}_display`, 'NORMAL', 'bead:display')) expect(n[2]).toBeCloseTo(1, 4);
      // Seen from the front, the gold is only a thin edge round the dark glass.
      const gold = attribute(`bead_${id}_display`, 'POSITION', 'bead:gold');
      const span = (ps: number[][], c: number) => Math.max(...ps.map((p) => p[c])) - Math.min(...ps.map((p) => p[c]));
      for (const c of [0, 1]) {
        const edge = (span(gold, c) - span(points, c)) / 2;
        expect(edge, `${id} gold edge`).toBeGreaterThan(0);
        expect(edge, `${id} gold edge`).toBeLessThanOrEqual(0.01);
      }
    }
    // A phone for Funcial; landscape for Jontai Energy and Cookies Clicker, as their screenshots are.
    expect(webpSize(SCREENSHOTS.funcial)[0]).toBeLessThan(webpSize(SCREENSHOTS.funcial)[1]);
  });

  it('stands each display beside the object slot, inside the cavity and behind the glass', () => {
    for (const id of IDS) {
      const display = node(`bead_${id}_display`);
      // A display is sized in its mesh, never by its node (code and these checks place it by rotation and translation).
      expect(display.scale ?? [1, 1, 1], `${id} display unscaled`).toEqual([1, 1, 1]);
      expect(display.matrix, `${id} display by TRS`).toBeUndefined();
      expect(display.translation![0], `${id} display to the right of the slot`).toBeGreaterThan(0.1);
      for (const p of allRows(`bead_${id}_display`, 'POSITION')) {
        const q = place(p, display.rotation, display.translation);
        expect(fromCavity(q), `${id} inside the cavity's sphere`).toBeLessThan(CAVITY.radius - 0.02);
        expect(offAxis(q), `${id} framed by the porthole`).toBeLessThan(0.56);
        expect(q[2], `${id} behind the glass`).toBeLessThan(0.7);
      }
    }
  });

  it('lights each cavity with its own warm point light, in front of the slot', () => {
    const lights = gltf.extensions!.KHR_lights_punctual!.lights;
    for (const id of IDS) {
      const inner = node(`bead_${id}_inner`);
      const light = lights[inner.extensions!.KHR_lights_punctual!.light];
      expect(light.type).toBe('point');
      const [r, g, b] = light.color ?? [1, 1, 1];
      expect(r).toBeGreaterThanOrEqual(g);
      expect(g).toBeGreaterThan(b);
      // Enough for the hollow to show (at 0.06 it read black), not so much it washes the porthole (0.4 did); the
      // tunnel's own light is 1.7 (GLASS_LOOK.well.light).
      expect(light.intensity).toBeGreaterThanOrEqual(0.15);
      expect(light.intensity).toBeLessThanOrEqual(0.35);
      const t = inner.translation!;
      expect(fromCavity(t), `${id} inside the cavity`).toBeLessThan(CAVITY.radius);
      expect(t[2]).toBeGreaterThan(node(`bead_${id}_object`).translation![2]);
    }
  });
});

/**
 * Funcial's object (tools/blender/bead_funcial.py; spec §2.4, concept b01; docs/projects-discovery.md, Funcial's
 * object and its test points): a mirror aluminium platter, the floor of the hollow, that turns about its own axis;
 * its glowing track from TP1 to TP4 with the four test pins on it (the app's four layers: LOG, GAME LAYER, MONEY
 * RULES, VAULT); an upright lacquered abacus whose five beads (the same layers, and RESULT as the fifth) slide up
 * gold rods; and the phone, which is the bead's display (code finds every screen by `bead_<id>_display`), standing on
 * the platter. Code (Task 8) moves
 * them by these names: the platter turns about its node's local +y, a pulse runs along the track's u, and each
 * abacus bead slides along funcial_abacus's local +y.
 */
const PINS = 4;
const ABACUS_BEADS = 5;
/** How far an abacus bead slides up its rod, from resting on the bottom rail to meeting the top one. */
const ABACUS_TRAVEL = 0.3;
/** The room an object has: within this of the porthole's axis (export_beads.py's SLOT_RADIUS), behind the glass. */
const SLOT_RADIUS = 0.5;
/** The front of the vein map, the ring the shell's lit side takes (export_beads.py's UV_IN, UV_OUT): veined. */
const VEINED_RING = [0.17, 0.495];
/** The platter's hub (its spindle clamp) stands within this of its axis; the floor is the rest of its top. */
const HUB = 0.08;

const parentOf = new Map<number, number>();
gltf.nodes.forEach((n, i) => n.children?.forEach((c) => parentOf.set(c, i)));

function indexOf(name: string): number {
  const i = gltf.nodes.findIndex((n) => n.name === name);
  expect(i, name).toBeGreaterThanOrEqual(0);
  return i;
}

/** a ⊗ b for unit quaternions (x, y, z, w): b's turn, then a's. */
function qmul([ax, ay, az, aw]: number[], [bx, by, bz, bw]: number[]): number[] {
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz
  ];
}

interface Frame {
  rotation: number[];
  translation: number[];
}

/** Where a node's mesh lands in its bead's frame: its own TRS and its parents' up to the root (which has none). */
function frameOf(name: string): Frame {
  let rotation = [0, 0, 0, 1],
    translation = [0, 0, 0];
  for (let i: number | undefined = indexOf(name); i !== undefined; i = parentOf.get(i)) {
    const n = gltf.nodes[i];
    expect(n.matrix, `${n.name} by TRS`).toBeUndefined();
    expect(n.scale ?? [1, 1, 1], `${n.name} unscaled`).toEqual([1, 1, 1]);
    const r = n.rotation ?? [0, 0, 0, 1];
    translation = place(translation, r, n.translation);
    rotation = qmul(r, rotation);
  }
  return { rotation, translation };
}

/** A point of the bead's frame in a node's own frame. */
function toLocal(f: Frame, p: number[]): number[] {
  const [x, y, z, w] = f.rotation;
  return place(
    p.map((c, k) => c - f.translation[k]),
    [-x, -y, -z, w]
  );
}

/** Where a node's own axis points in its bead's frame. */
const axisOf = (f: Frame, axis: number[]) => place(axis, f.rotation);
/** A node's mesh points (all its primitives', or one material's), in its bead's frame. */
function placed(name: string, materialNamed?: string): number[][] {
  const f = frameOf(name);
  const points = materialNamed === undefined ? allRows(name, 'POSITION') : attribute(name, 'POSITION', materialNamed);
  return points.map((p) => place(p, f.rotation, f.translation));
}

const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** How far a point is from its node's own +y axis. */
const radial = (p: number[]) => Math.hypot(p[0], p[2]);
const mean = (ps: number[][], c: number) => ps.reduce((s, p) => s + p[c], 0) / ps.length;
/** The angle between two points' directions round a node's +y axis, in degrees. */
const angleBetween = (a: number[], b: number[]) =>
  (Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[2] * b[2]) / (radial(a) * radial(b))))) * 180) / Math.PI;

/**
 * That a part stands on a floor (a node whose top is its own y = 0, round its +y axis, out to `rim`): its lowest point
 * touches the floor or is sunk a hair into it, both ends of its foot reach the floor (it rests along its length, not on
 * one corner), and its foot is inside the rim.
 */
function standsOn(floor: string, name: string, rim: number) {
  const frame = frameOf(floor);
  const local = placed(name).map((p) => toLocal(frame, p));
  const lowest = Math.min(...local.map((q) => q[1]));
  expect(lowest, `${name}'s foot on the floor`).toBeGreaterThanOrEqual(-0.008);
  expect(lowest, `${name}'s foot on the floor`).toBeLessThanOrEqual(0.001);
  const foot = local.filter((q) => q[1] < lowest + 0.008);
  const [x0, x1] = [Math.min(...foot.map((q) => q[0])), Math.max(...foot.map((q) => q[0]))];
  const third = (x1 - x0) / 3;
  const lowestIn = (from: number, to: number) => Math.min(...foot.filter((q) => q[0] >= from && q[0] <= to).map((q) => q[1]));
  expect(lowestIn(x0, x0 + third) - lowest, `${name}'s left end on the floor`).toBeLessThan(0.002);
  expect(lowestIn(x1 - third, x1) - lowest, `${name}'s right end on the floor`).toBeLessThan(0.002);
  for (const q of foot) expect(radial(q), `${name}'s foot inside the rim`).toBeLessThan(rim);
}

/**
 * Where the bead's inner light mirrors in a flat glossy front, seen from far along `view`: the point of the front's
 * plane (through `on`, facing `n`) at which a viewer along `view` sees the light's mirror image.
 */
function mirroredLight(light: number[], on: number[], n: number[], view: number[]): number[] {
  const c = view.map((v) => v / length(view));
  const d = dot(
    light.map((l, k) => l - on[k]),
    n
  );
  return light.map((l, k) => l - 2 * d * n[k] + (d / dot(c, n)) * c[k]);
}

describe("Funcial's object", () => {
  const PIN_NAMES = Array.from({ length: PINS }, (_, k) => `funcial_pin_${k + 1}`);
  const BEAD_NAMES = Array.from({ length: ABACUS_BEADS }, (_, k) => `funcial_bead_${k + 1}`);
  const UNDER_SLOT = ['funcial_platter', 'funcial_track', ...PIN_NAMES, 'funcial_abacus'];
  const childrenOf = (name: string) => (node(name).children ?? []).map((c) => gltf.nodes[c].name);
  /** The platter's rim: how far its aluminium reaches from its axis. */
  const rim = () => Math.max(...attribute('funcial_platter', 'POSITION', 'bead:aluminium').map(radial));

  /** That a part placed on the platter stands on its floor (`standsOn`). */
  const standsOnThePlatter = (name: string) => standsOn('funcial_platter', name, rim());

  it('names its parts for code: the platter, its track and four pins, and the abacus with five beads', () => {
    expect(childrenOf('bead_funcial_object').sort()).toEqual([...UNDER_SLOT].sort());
    expect(childrenOf('funcial_abacus').sort()).toEqual([...BEAD_NAMES].sort());
    const names = gltf.nodes.map((n) => n.name ?? '');
    // Exactly four pins, TP1–TP4, and five beads: the four layers and RESULT, the fifth.
    expect(names.filter((n) => n.startsWith('funcial_pin_'))).toHaveLength(PINS);
    expect(names.filter((n) => n.startsWith('funcial_bead_'))).toHaveLength(ABACUS_BEADS);
    // The phone is the bead's display, with no node of its own: code finds every bead's screen by its display's name.
    expect(names).not.toContain('funcial_phone');
    for (const name of [...UNDER_SLOT, ...BEAD_NAMES]) expect(frameOf(name).rotation).toHaveLength(4);
  });

  it('keeps the object in its room: within 0.5 of the axis, inside the cavity and behind the glass', () => {
    const inRoom = (name: string, points: number[][]) => {
      for (const q of points) {
        expect(offAxis(q), `${name} off the axis`).toBeLessThanOrEqual(SLOT_RADIUS);
        expect(fromCavity(q), `${name} inside the cavity's sphere`).toBeLessThan(CAVITY.radius - 0.02);
        expect(q[2], `${name} behind the glass`).toBeLessThan(0.7);
      }
    };
    for (const name of [...UNDER_SLOT, ...BEAD_NAMES]) inRoom(name, placed(name));
    // The beads slid all the way up their rods, too.
    const up = axisOf(frameOf('funcial_abacus'), [0, 1, 0]);
    for (const name of BEAD_NAMES)
      inRoom(
        name,
        placed(name).map((p) => p.map((c, k) => c + ABACUS_TRAVEL * up[k]))
      );
  });

  it('wears its own three materials beside the bead gold and lacquer', () => {
    const wears = (name: string) => primitives(name).map((p) => materialName(p.material)).sort();
    expect(wears('funcial_platter')).toEqual(['bead:aluminium', 'bead:gold']);
    expect(wears('funcial_track')).toEqual(['bead:track']);
    for (const pin of PIN_NAMES) expect(wears(pin)).toEqual(['bead:gold']);
    expect(wears('funcial_abacus')).toEqual(['bead:gold', 'bead:lacquer']);
    for (const bead of BEAD_NAMES) expect(wears(bead)).toEqual(['bead:abacus', 'bead:gold']);
    // Mirror aluminium: near-neutral silver, metal, nearly smooth.
    const aluminium = material('bead:aluminium').pbrMetallicRoughness!;
    expect(aluminium.metallicFactor ?? 1).toBe(1);
    expect(aluminium.roughnessFactor).toBeLessThanOrEqual(0.15);
    const silver = aluminium.baseColorFactor!.slice(0, 3);
    expect(Math.min(...silver)).toBeGreaterThan(0.4);
    expect(Math.max(...silver) / Math.min(...silver)).toBeLessThan(1.3);
    // The track glows in the gold light (palette.goldLight), dim at rest: code runs the pulse along it.
    const track = material('bead:track');
    const [r, g, b] = track.emissiveFactor!;
    expect(r).toBeGreaterThan(0.3);
    expect(r).toBeLessThanOrEqual(1);
    expect(g / r).toBeCloseTo(0.52, 2);
    expect(b / r).toBeCloseTo(0.16, 2);
    expect(Math.max(...(track.pbrMetallicRoughness?.baseColorFactor ?? [1, 1, 1]).slice(0, 3))).toBeLessThan(0.1);
    // The abacus beads: purple lacquer, glossy, not metal.
    const lacquer = material('bead:abacus').pbrMetallicRoughness!;
    const [lr, lg, lb] = lacquer.baseColorFactor!;
    expect(lb).toBeGreaterThan(lr);
    expect(lr).toBeGreaterThan(lg);
    expect(lacquer.metallicFactor).toBe(0);
    expect(lacquer.roughnessFactor).toBeLessThanOrEqual(0.35);
    // The abacus's frame is the bead's own lacquer, its UVs on the veined front of the vein map: gold leaf.
    const uvs = attribute('funcial_abacus', 'TEXCOORD_0', 'bead:lacquer');
    for (const [u, v] of uvs) {
      expect(Math.hypot(u - 0.5, v - 0.5)).toBeGreaterThan(VEINED_RING[0]);
      expect(Math.hypot(u - 0.5, v - 0.5)).toBeLessThan(VEINED_RING[1]);
    }
    const { veins } = maps();
    const [u0, u1] = [Math.min(...uvs.map((t) => t[0])), Math.max(...uvs.map((t) => t[0]))];
    const [v0, v1] = [Math.min(...uvs.map((t) => t[1])), Math.max(...uvs.map((t) => t[1]))];
    let veined = 0;
    for (let y = Math.floor(v0 * 1024); y < Math.ceil(v1 * 1024); y++)
      for (let x = Math.floor(u0 * 1024); x < Math.ceil(u1 * 1024); x++) if (veins.data[y * 1024 + x] > 186) veined++;
    expect(veined, 'veined texels under the frame').toBeGreaterThan(50);
  });

  it('lays the platter low in the hollow as a floor: a disc that turns onto itself about its own axis', () => {
    const f = frameOf('funcial_platter');
    expect(Math.abs(f.translation[0]), 'centred under the axis').toBeLessThan(1e-4);
    expect(f.translation[1], 'low in the hollow').toBeLessThan(-0.25);
    // Its axis is up, leaning toward the porthole, so the floor shows from the front (b01 sees it from above).
    const axis = axisOf(f, [0, 1, 0]);
    expect(Math.abs(axis[0])).toBeLessThan(1e-4);
    const lean = (Math.atan2(axis[2], axis[1]) * 180) / Math.PI;
    expect(lean).toBeGreaterThan(5);
    expect(lean).toBeLessThan(20);
    // A disc round its local +y: turning it about that axis lays it on itself.
    const aluminium = attribute('funcial_platter', 'POSITION', 'bead:aluminium');
    expect(Math.abs(mean(aluminium, 0))).toBeLessThan(1e-3);
    expect(Math.abs(mean(aluminium, 2))).toBeLessThan(1e-3);
    expect(rim()).toBeGreaterThan(0.3);
    expect(rim()).toBeLessThan(0.4);
    // Its top, the floor, is the node's y = 0; only the hub stands above it.
    const floor = aluminium.filter((p) => radial(p) > HUB);
    expect(Math.max(...floor.map((p) => p[1]))).toBeCloseTo(0, 5);
    // A mirror: every normal on the floor is its own up (the rim's rounding is in the normals past its edge).
    const normals = attribute('funcial_platter', 'NORMAL', 'bead:aluminium');
    aluminium.forEach((p, k) => {
      if (radial(p) > HUB && Math.abs(p[1]) < 1e-6) expect(normals[k][1], `the floor's normal at ${p}`).toBeCloseTo(1, 5);
    });
    // The platter's gold is off its axis, so the turn shows: the hub's screws, and the index mark on the margin.
    const gold = attribute('funcial_platter', 'POSITION', 'bead:gold');
    for (const p of gold.filter((q) => radial(q) < HUB)) {
      expect(radial(p), 'a screw').toBeGreaterThan(0.01);
      expect(p[1], 'a screw').toBeGreaterThan(0);
    }
    const index = gold.filter((q) => radial(q) >= HUB);
    expect(index.length, 'an index mark on the margin').toBeGreaterThan(0);
    // A fine band over the margin: from inside the rim, over its edge and down it, a hair above the aluminium.
    for (const p of index) {
      expect(radial(p)).toBeGreaterThan(0.3);
      expect(radial(p)).toBeLessThan(rim() + 0.002);
      expect(p[1]).toBeGreaterThan(-0.013);
      expect(p[1]).toBeLessThan(0.002);
    }
    expect(Math.max(...index.map(radial)), 'down the rim, seen from the front').toBeGreaterThan(rim());
    expect(Math.min(...index.map((p) => p[1])), 'down the rim').toBeLessThan(-0.006);
    const width = rim() - Math.min(...index.map(radial));
    expect(width, 'fine across the floor').toBeLessThan(0.02);
    // An arc of the margin, long enough to read as it runs round, all to one side: the turn moves it.
    const centre = [mean(index, 0), 0, mean(index, 2)];
    const span = Math.max(...index.map((p) => angleBetween(p, centre))) * 2;
    expect(span).toBeGreaterThan(20);
    expect(span).toBeLessThan(60);
    expect(radial(centre), 'off the axis').toBeGreaterThan(0.25);
  });

  it('turns its index mark clear of the track, the pins and every foot on the floor', () => {
    const platter = frameOf('funcial_platter');
    const inner = Math.min(...attribute('funcial_platter', 'POSITION', 'bead:gold').filter((q) => radial(q) >= HUB).map(radial));
    expect(inner, "the index mark's inner edge, on the platter").toBeLessThan(rim());
    // The track and the pins stand inside the circle the mark runs round.
    const trackOut = Math.max(...attribute('funcial_track', 'POSITION').map(radial));
    const pinOut = Math.max(...attribute('funcial_pin_1', 'POSITION').map(radial));
    for (const pin of ['funcial_pin_1', 'funcial_pin_2', 'funcial_pin_3', 'funcial_pin_4'])
      expect(radial(toLocal(platter, frameOf(pin).translation)) + pinOut, pin).toBeLessThan(inner);
    expect(trackOut).toBeLessThan(inner);
    // Every point of the abacus and the phone at or under the floor (their feet) is inside it too.
    for (const name of ['funcial_abacus', 'bead_funcial_display']) {
      const feet = placed(name)
        .map((p) => toLocal(platter, p))
        .filter((q) => q[1] < 0.001);
      expect(feet.length, `${name}'s foot`).toBeGreaterThan(0);
      expect(Math.max(...feet.map(radial)), `${name}'s foot inside the mark's circle`).toBeLessThan(inner);
    }
  });

  it('runs the glowing track along the platter from TP1 to TP4, its u running 0..1 for the pulse', () => {
    const platter = frameOf('funcial_platter');
    const track = frameOf('funcial_track');
    // Concentric with the platter and in its plane: the same frame (the platter turns under it, the track stays).
    for (let k = 0; k < 3; k++) expect(track.translation[k]).toBeCloseTo(platter.translation[k], 5);
    for (let k = 0; k < 4; k++) expect(track.rotation[k]).toBeCloseTo(platter.rotation[k], 5);
    const points = attribute('funcial_track', 'POSITION');
    const uvs = attribute('funcial_track', 'TEXCOORD_0');
    const radii = points.map(radial);
    expect(Math.max(...radii) - Math.min(...radii), 'a narrow band').toBeLessThan(0.025);
    expect(Math.max(...radii)).toBeLessThan(rim());
    for (const p of points) {
      expect(p[1], 'on the floor').toBeGreaterThanOrEqual(-1e-5);
      expect(p[1]).toBeLessThan(0.008);
    }
    // u follows the arc, 0 at TP1 and 1 at TP4; v runs across it.
    const us = uvs.map((t) => t[0]);
    expect(Math.min(...us)).toBeCloseTo(0, 5);
    expect(Math.max(...us)).toBeCloseTo(1, 5);
    for (const t of uvs) {
      expect(t[1]).toBeGreaterThanOrEqual(-1e-5);
      expect(t[1]).toBeLessThanOrEqual(1 + 1e-5);
    }
    const start = points[us.indexOf(Math.min(...us))];
    const end = points[us.indexOf(Math.max(...us))];
    const span = angleBetween(start, end);
    expect(span).toBeGreaterThan(30);
    points.forEach((p, k) => expect(angleBetween(start, p) / span, `u at ${p}`).toBeCloseTo(us[k], 2));
    // The pins stand on its centre line, evenly from TP1 at u = 0 to TP4 at u = 1.
    const middle = (Math.min(...radii) + Math.max(...radii)) / 2;
    PIN_NAMES.forEach((pin, k) => {
      const base = toLocal(platter, frameOf(pin).translation);
      expect(base[1], `${pin} on the floor`).toBeCloseTo(0, 4);
      expect(radial(base), `${pin} on the track`).toBeCloseTo(middle, 3);
      expect(angleBetween(start, base) / span, `${pin} at u`).toBeCloseTo(k / (PINS - 1), 2);
    });
  });

  it('stands the four test pins square on the platter: one small shape, its foot on its node', () => {
    expect(new Set(PIN_NAMES.map((pin) => node(pin).mesh)).size).toBe(1);
    const up = axisOf(frameOf('funcial_platter'), [0, 1, 0]);
    for (const pin of PIN_NAMES) expect(dot(axisOf(frameOf(pin), [0, 1, 0]), up), `${pin} square to the floor`).toBeGreaterThan(0.9999);
    const shape = attribute(PIN_NAMES[0], 'POSITION');
    const ys = shape.map((p) => p[1]);
    expect(Math.min(...ys)).toBeCloseTo(0, 4);
    expect(Math.max(...ys)).toBeGreaterThan(0.06);
    expect(Math.max(...ys)).toBeLessThan(0.12);
    expect(Math.max(...shape.map(radial))).toBeLessThan(0.02);
    // As the porthole sees them, TP1 to TP4 read left to right, each clear of the next.
    const xs = PIN_NAMES.map((pin) => frameOf(pin).translation[0]);
    for (let k = 1; k < PINS; k++) expect(xs[k] - xs[k - 1], `TP${k} to TP${k + 1}`).toBeGreaterThan(2 * Math.max(...shape.map(radial)));
  });

  it('stands the abacus upright on the platter, to the left, turned toward the axis', () => {
    const f = frameOf('funcial_abacus');
    const points = placed('funcial_abacus');
    expect(Math.max(...points.map((p) => p[0])), 'left of the axis').toBeLessThan(0);
    expect(axisOf(f, [0, 1, 0])[1], 'upright').toBeGreaterThan(Math.cos((5 * Math.PI) / 180));
    const face = axisOf(f, [0, 0, 1]);
    expect(face[2], 'facing the porthole').toBeGreaterThan(0.9);
    expect(face[0], 'turned toward the axis').toBeGreaterThan(0.05);
    standsOnThePlatter('funcial_abacus');
  });

  it("threads five lacquered beads on the abacus's gold rods, left to right, each sliding up its own", () => {
    expect(new Set(BEAD_NAMES.map((bead) => node(bead).mesh)).size).toBe(1);
    // A translation in the abacus's frame and no turn of their own: code slides them along its +y.
    for (const bead of BEAD_NAMES) expect(node(bead).rotation ?? [0, 0, 0, 1], bead).toEqual([0, 0, 0, 1]);
    const at = BEAD_NAMES.map((bead) => node(bead).translation!);
    for (const t of at) {
      expect(t[1]).toBeCloseTo(at[0][1], 5);
      expect(t[2]).toBeCloseTo(at[0][2], 5);
    }
    const xs = at.map((t) => t[0]);
    const step = xs[1] - xs[0];
    expect(step, 'bead 1 (TP1) at the left, bead 5 (RESULT) at the right').toBeGreaterThan(0);
    for (let k = 1; k < xs.length; k++) expect(xs[k] - xs[k - 1]).toBeCloseTo(step, 4);
    // Each on a gold rod that runs the whole slide.
    const gold = attribute('funcial_abacus', 'POSITION', 'bead:gold');
    for (const x of xs) {
      const rod = gold.filter((p) => Math.abs(p[0] - x) < step / 3 && Math.abs(p[2] - at[0][2]) < step / 3);
      expect(rod.length, `a rod at ${x}`).toBeGreaterThan(0);
      expect(mean(rod, 0)).toBeCloseTo(x, 3);
      expect(Math.max(...rod.map((p) => p[1])) - Math.min(...rod.map((p) => p[1]))).toBeGreaterThan(ABACUS_TRAVEL);
    }
    // They rest on the bottom rail and, slid ABACUS_TRAVEL up, meet the top one.
    const frame = attribute('funcial_abacus', 'POSITION', 'bead:lacquer');
    const levels = [...new Set(frame.map((p) => Number(p[1].toFixed(4))))].sort((a, b) => a - b);
    expect(levels, "the frame's foot, its bottom rail's top, its top rail's underside and its top").toHaveLength(4);
    const shape = allRows(BEAD_NAMES[0], 'POSITION');
    const [low, high] = [Math.min(...shape.map((p) => p[1])), Math.max(...shape.map((p) => p[1]))];
    // Purple lacquer with gold leaf (the discovery's abacus): a fine gold band round each bead's middle.
    const band = attribute(BEAD_NAMES[0], 'POSITION', 'bead:gold');
    for (const p of band) expect(Math.abs(p[1]), 'round the middle').toBeLessThan(0.3 * (high - low));
    const bandTall = Math.max(...band.map((p) => p[1])) - Math.min(...band.map((p) => p[1]));
    expect(bandTall, 'fine').toBeGreaterThan(0.1 * (high - low));
    expect(bandTall, 'fine').toBeLessThan(0.3 * (high - low));
    expect(Math.max(...band.map(radial)), 'at the widest').toBeCloseTo(Math.max(...shape.map(radial)), 4);
    expect(at[0][1] + low - levels[1]).toBeGreaterThanOrEqual(-1e-4);
    expect(at[0][1] + low - levels[1]).toBeLessThan(0.002);
    expect(levels[2] - (at[0][1] + ABACUS_TRAVEL + high)).toBeGreaterThanOrEqual(-1e-4);
    expect(levels[2] - (at[0][1] + ABACUS_TRAVEL + high)).toBeLessThan(0.002);
    // They pass each other: a bead is narrower than the rods' spacing.
    expect(Math.max(...shape.map((p) => p[0])) - Math.min(...shape.map((p) => p[0]))).toBeLessThan(step);
  });

  it('stands the phone on the platter to the right of the abacus, 0.40 of the bead tall', () => {
    const points = placed('bead_funcial_display');
    const ys = points.map((p) => p[1]);
    const tall = (Math.max(...ys) - Math.min(...ys)) / (2 * RADIUS);
    expect(tall, 'its height, as a share of the bead').toBeGreaterThan(0.39);
    expect(tall).toBeLessThan(0.42);
    standsOnThePlatter('bead_funcial_display');
    // Beside the abacus, never in front of it, as the porthole sees them.
    expect(Math.min(...points.map((p) => p[0]))).toBeGreaterThan(Math.max(...placed('funcial_abacus').map((p) => p[0])));
  });

  it("keeps the bead's inner light from mirroring in the phone's glossy front", () => {
    // On the axis above the slot, the light's mirror image in the phone's front fell on its top-left edge, a hot spot.
    // Seen along the porthole's axis and from the bead shot's camera (CAMERA_PATH.bead.offset), the point of the
    // front's plane that mirrors the light must lie clear of the phone.
    const glass = placed('bead_funcial_display', 'bead:display');
    const f = frameOf('bead_funcial_display');
    const n = axisOf(f, [0, 0, 1]);
    const light = node('bead_funcial_inner').translation!;
    const xs = glass.map((p) => p[0]);
    for (const view of [[0, 0, 1], [...CAMERA_PATH.bead.offset]]) {
      const spot = mirroredLight(light, glass[0], n, view);
      const outside = Math.max(Math.min(...xs) - spot[0], spot[0] - Math.max(...xs));
      expect(outside, `the mirrored light at ${spot}, seen along ${view}`).toBeGreaterThan(0.08);
    }
  });
});

/**
 * Jontai Energy's object (tools/blender/bead_jontai.py; spec §2.4, concept b02; docs/projects-discovery.md, 02 · JONTAI
 * ENERGY, its Proposal): a solar module of 16 cells, 4 × 4, one cell per page of the site, with silver busbars across
 * every cell (the one shared design system), in a satin frame with a white backsheet at its edge; a junction box on the
 * frame with three leads (EN · ES · 中, the three languages); and one output cable ending in a connector (the quote
 * path). They stand on a floor of the bead's own lacquer, the module on a post, with the website on the bead's display
 * beside them. Code (Task 8) moves them by these names: the module tilts about its node's local +x, up to 4° either
 * way, and each cell's material charges, one by one in page order.
 */
const CELLS = 16;
const LEADS = 3;
/** How far code tilts the module about its own x, either way (Task 8's jontaiMotion). */
const MAX_TILT = (4 * Math.PI) / 180;
/** The site's glow, its --accent-green #00d16a, linear: the cells charge in it. */
const GLOW_GREEN = [0, 0.638, 0.144];

/** A point turned by `angle` (radians) about the line through `origin` along the unit `axis`. */
function turnAbout(p: number[], origin: number[], axis: number[], angle: number): number[] {
  const v = p.map((c, k) => c - origin[k]);
  const [c, s] = [Math.cos(angle), Math.sin(angle)];
  const cross = [axis[1] * v[2] - axis[2] * v[1], axis[2] * v[0] - axis[0] * v[2], axis[0] * v[1] - axis[1] * v[0]];
  const along = dot(axis, v) * (1 - c);
  return v.map((x, k) => origin[k] + x * c + cross[k] * s + axis[k] * along);
}

/** How far a point is from the line through `origin` along the unit `axis`. */
function fromLine(p: number[], origin: number[], axis: number[]): number {
  const v = p.map((c, k) => c - origin[k]);
  const along = dot(v, axis);
  return length(v.map((x, k) => x - along * axis[k]));
}

/** The points once each (a seam's vertices come twice, with their two UVs). */
function unique(ps: number[][]): number[][] {
  const seen = new Map<string, number[]>();
  for (const p of ps) seen.set(p.map((c) => c.toFixed(6)).join(','), p);
  return [...seen.values()];
}

const centroid = (ps: number[][]) => [mean(ps, 0), mean(ps, 1), mean(ps, 2)];
const span = (ps: number[][], c: number) => [Math.min(...ps.map((p) => p[c])), Math.max(...ps.map((p) => p[c]))];

describe("Jontai Energy's object", () => {
  const CELL_NAMES = Array.from({ length: CELLS }, (_, k) => `jontai_cell_${k + 1}`);
  const LEAD_NAMES = Array.from({ length: LEADS }, (_, k) => `jontai_lead_${k + 1}`);
  const UNDER_SLOT = ['jontai_floor', 'jontai_post', 'jontai_module', 'jontai_cable'];
  /** The parts that tilt with the module. */
  const TILTING = ['jontai_module', ...CELL_NAMES, 'jontai_box', ...LEAD_NAMES];
  const ALL = [...UNDER_SLOT, ...CELL_NAMES, 'jontai_box', ...LEAD_NAMES, 'jontai_connector'];
  const DISPLAY = 'bead_jontai-energy_display';
  const childrenOf = (name: string) => (node(name).children ?? []).map((c) => gltf.nodes[c].name);
  const wears = (name: string) => primitives(name).map((p) => materialName(p.material)).sort();
  /** The floor's rim: how far its lacquer reaches from its axis. */
  const floorRim = () => Math.max(...attribute('jontai_floor', 'POSITION').map(radial));
  const floorUp = () => axisOf(frameOf('jontai_floor'), [0, 1, 0]);
  /** The module's tilt axis in the bead frame: through its node's origin, along its local +x. */
  const tiltAxis = () => {
    const f = frameOf('jontai_module');
    return { origin: f.translation, axis: axisOf(f, [1, 0, 0]) };
  };
  /** A node's mesh points in the module's own frame. */
  const inModule = (name: string, materialNamed?: string) => {
    const f = frameOf('jontai_module');
    return placed(name, materialNamed).map((p) => toLocal(f, p));
  };
  /** The frame's lower edge in the module's frame: its satin's lowest point out at the sides, clear of the hinge and box. */
  const frameBottom = () =>
    Math.min(
      ...attribute('jontai_module', 'POSITION', 'bead:satin')
        .filter((p) => Math.abs(p[0]) > 0.15)
        .map((p) => p[1])
    );
  /** The cable's rings, in order along it: each ring's u, its centre (bead frame) and its radius. */
  const cableRings = () => {
    const points = placed('jontai_cable');
    const us = attribute('jontai_cable', 'TEXCOORD_0').map((t) => t[0]);
    const levels = [...new Set(us.map((u) => u.toFixed(6)))].map(Number).sort((a, b) => a - b);
    return levels.map((u) => {
      const ring = unique(points.filter((_, k) => Math.abs(us[k] - u) < 1e-6));
      const c = centroid(ring);
      return { u, c, radius: ring.reduce((s, p) => s + length(p.map((x, k) => x - c[k])), 0) / ring.length };
    });
  };

  it('names its parts for code: the floor, the post, the module with 16 cells and the box with three leads, the cable and its connector', () => {
    expect(childrenOf('bead_jontai-energy_object').sort()).toEqual([...UNDER_SLOT].sort());
    expect(childrenOf('jontai_module').sort()).toEqual([...CELL_NAMES, 'jontai_box'].sort());
    expect(childrenOf('jontai_box').sort()).toEqual([...LEAD_NAMES].sort());
    expect(childrenOf('jontai_cable')).toEqual(['jontai_connector']);
    const names = gltf.nodes.map((n) => n.name ?? '');
    // Exactly sixteen cells, one per page of the site, and three leads, one per language.
    expect(names.filter((n) => n.startsWith('jontai_cell_'))).toHaveLength(CELLS);
    expect(names.filter((n) => n.startsWith('jontai_lead_'))).toHaveLength(LEADS);
    for (const name of ALL) expect(frameOf(name).rotation).toHaveLength(4);
  });

  it('keeps the object in its room: within 0.5 of the axis, inside the cavity and behind the glass, at rest and tilted', () => {
    const inRoom = (name: string, points: number[][]) => {
      for (const q of points) {
        expect(offAxis(q), `${name} off the axis`).toBeLessThanOrEqual(SLOT_RADIUS);
        expect(fromCavity(q), `${name} inside the cavity's sphere`).toBeLessThan(CAVITY.radius - 0.02);
        expect(q[2], `${name} behind the glass`).toBeLessThan(0.7);
      }
    };
    for (const name of ALL) inRoom(name, placed(name));
    // Tilted all the way either way about its own x, with the cells, the box and the leads it carries.
    const { origin, axis } = tiltAxis();
    for (const angle of [-MAX_TILT, MAX_TILT])
      for (const name of TILTING)
        inRoom(
          `${name} tilted ${angle}`,
          placed(name).map((p) => turnAbout(p, origin, axis, angle))
        );
  });

  it('wears its own five materials beside the bead lacquer, each part the one the discovery gives it', () => {
    expect(wears('jontai_module')).toEqual(['bead:backsheet', 'bead:satin', 'bead:silver']);
    for (const cell of CELL_NAMES) expect(wears(cell)).toEqual(['bead:cell']);
    expect(wears('jontai_box')).toEqual(['bead:polymer']);
    for (const lead of LEAD_NAMES) expect(wears(lead)).toEqual(['bead:silver']);
    expect(wears('jontai_cable')).toEqual(['bead:polymer']);
    expect(wears('jontai_connector')).toEqual(['bead:polymer', 'bead:silver']);
    expect(wears('jontai_post')).toEqual(['bead:satin']);
    expect(wears('jontai_floor')).toEqual(['bead:lacquer']);
    const pbr = (name: string) => material(name).pbrMetallicRoughness!;
    const rgb = (name: string) => pbr(name).baseColorFactor!.slice(0, 3);
    // Blue-black monocrystalline cells under anti-reflective glass: dark, blue, not metal, never mirror-glossy, with a
    // dim reflection (the glass's anti-reflection), so the bead's inner light makes no hard spot on them.
    const [cr, cg, cb] = rgb('bead:cell');
    expect(cb).toBeGreaterThan(cg);
    expect(cg).toBeGreaterThan(cr);
    expect(cb).toBeLessThan(0.08);
    expect(pbr('bead:cell').metallicFactor).toBe(0);
    expect(pbr('bead:cell').roughnessFactor).toBeGreaterThanOrEqual(0.3);
    const specular = material('bead:cell').extensions?.KHR_materials_specular;
    expect(specular, 'KHR_materials_specular').toBeDefined();
    expect(specular!.specularFactor ?? 1).toBeLessThanOrEqual(0.6);
    // They charge in the site's own glow green, dim at rest: code brightens each cell's charge.
    const [er, eg, eb] = material('bead:cell').emissiveFactor!;
    expect(er).toBe(0);
    expect(eg).toBeGreaterThan(0);
    expect(eg).toBeLessThan(0.1);
    expect(eb / eg).toBeCloseTo(GLOW_GREEN[2] / GLOW_GREEN[1], 2);
    // Silver busbars and leads, a satin anodised aluminium frame and post: neutral metals, the frame the rougher.
    for (const name of ['bead:silver', 'bead:satin']) {
      expect(pbr(name).metallicFactor ?? 1, name).toBe(1);
      expect(Math.min(...rgb(name)), name).toBeGreaterThan(0.4);
      expect(Math.max(...rgb(name)) / Math.min(...rgb(name)), name).toBeLessThan(1.1);
    }
    expect(pbr('bead:silver').roughnessFactor).toBeGreaterThanOrEqual(0.3);
    expect(pbr('bead:satin').roughnessFactor!).toBeGreaterThan(pbr('bead:silver').roughnessFactor! + 0.03);
    // A white backsheet, matte and never bright; the box, the cable and the connector in black polymer.
    const white = rgb('bead:backsheet');
    expect(Math.min(...white)).toBeGreaterThan(0.4);
    expect(Math.max(...white)).toBeLessThanOrEqual(0.75);
    expect(Math.max(...white) / Math.min(...white)).toBeLessThan(1.15);
    expect(pbr('bead:backsheet').metallicFactor).toBe(0);
    expect(pbr('bead:backsheet').roughnessFactor).toBeGreaterThanOrEqual(0.5);
    expect(Math.max(...rgb('bead:polymer'))).toBeLessThan(0.05);
    expect(pbr('bead:polymer').metallicFactor).toBe(0);
    // The floor is the bead's own lacquer, every UV on one point of the cavity's square of the vein map: no veins and no
    // metal there, and the hollow's occlusion, so it is the hollow's own dark floor.
    const uvs = attribute('jontai_floor', 'TEXCOORD_0');
    for (const t of uvs) expect(t).toEqual(uvs[0]);
    const cavity = bodyVertices()
      .filter((v) => !v.shell)
      .map((v) => v.uv);
    const [[u0, u1], [v0, v1]] = [span(cavity, 0), span(cavity, 1)];
    const [u, v] = uvs[0];
    expect(u).toBeGreaterThan(u0 + 0.01);
    expect(u).toBeLessThan(u1 - 0.01);
    expect(v).toBeGreaterThan(v0 + 0.01);
    expect(v).toBeLessThan(v1 - 0.01);
    const { veins, orm } = maps();
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const at = [u + dx / 1024, v + dy / 1024];
        expect(texel(veins, 0, at), 'no vein under the floor').toBe(0);
        expect(texel(orm, 2, at), 'no metal under the floor').toBe(0);
      }
  });

  it('holds the sixteen cells in a 4 × 4 grid, in page order: left to right, then top to bottom, as the porthole sees them', () => {
    expect(new Set(CELL_NAMES.map((cell) => node(cell).mesh)).size).toBe(1);
    // A translation in the module's frame and no turn of their own: each cell's material charges in place.
    for (const cell of CELL_NAMES) expect(node(cell).rotation ?? [0, 0, 0, 1], cell).toEqual([0, 0, 0, 1]);
    const at = CELL_NAMES.map((cell) => node(cell).translation!);
    for (const t of at) expect(t[2], 'one plane').toBeCloseTo(at[0][2], 6);
    const step = at[1][0] - at[0][0];
    expect(step).toBeGreaterThan(0);
    at.forEach((t, k) => {
      const [row, col] = [Math.floor(k / 4), k % 4];
      expect(t[0] - at[0][0], `cell ${k + 1}'s column`).toBeCloseTo(col * step, 5);
      expect(at[0][1] - t[1], `cell ${k + 1}'s row`).toBeCloseTo(row * step, 5);
    });
    // As the porthole sees them, in the bead frame: along each row to the right, and down from row to row.
    const seen = CELL_NAMES.map((cell) => frameOf(cell).translation);
    for (let k = 0; k < CELLS; k++) {
      if (k % 4) expect(seen[k][0], `cell ${k + 1} right of cell ${k}`).toBeGreaterThan(seen[k - 1][0]);
      if (k >= 4) expect(seen[k][1], `cell ${k + 1} below cell ${k - 3}`).toBeLessThan(seen[k - 4][1]);
    }
    // One pseudo-square cell (a monocrystalline cell's cut corners), flat, facing the module's front, centred on its node
    // (its pivot), a fine gap from the next.
    const shape = attribute(CELL_NAMES[0], 'POSITION');
    const [[x0, x1], [y0, y1]] = [span(shape, 0), span(shape, 1)];
    expect(x1 - x0).toBeCloseTo(y1 - y0, 5);
    expect(x1 - x0).toBeLessThan(step);
    expect(step - (x1 - x0), 'the gap between cells').toBeLessThan(0.01);
    expect(Math.abs(x0 + x1)).toBeLessThan(1e-6);
    expect(Math.abs(y0 + y1)).toBeLessThan(1e-6);
    for (const p of shape) expect(p[2]).toBeCloseTo(0, 6);
    for (const n of attribute(CELL_NAMES[0], 'NORMAL')) expect(n[2]).toBeCloseTo(1, 5);
    for (const [x, y] of shape) expect(Math.hypot(x1 - Math.abs(x), y1 - Math.abs(y)), 'the corners cut').toBeGreaterThan(0.003);
  });

  it('stands the module left of the axis, facing the porthole and tilted back as a tracker holds it, turned toward the axis', () => {
    const f = frameOf('jontai_module');
    expect(Math.max(...placed('jontai_module').map((p) => p[0])), 'left of the axis').toBeLessThan(0);
    const face = axisOf(f, [0, 0, 1]);
    expect(face[2], 'facing the porthole').toBeGreaterThan(0.6);
    expect(face[1], 'tilted back, facing up').toBeGreaterThan(0.3);
    expect(face[0], 'turned toward the axis').toBeGreaterThan(0.05);
    const axis = axisOf(f, [1, 0, 0]);
    expect(axis[0], 'its tilt axis runs left to right').toBeGreaterThan(0.95);
    expect(Math.abs(axis[1]), 'nearly level').toBeLessThan(0.1);
  });

  it('runs silver busbars across every cell, in a satin frame with the white backsheet showing at its edge', () => {
    const cells = CELL_NAMES.map((cell) => node(cell).translation!);
    const shape = attribute(CELL_NAMES[0], 'POSITION');
    const half = (span(shape, 0)[1] - span(shape, 0)[0]) / 2;
    const cellZ = cells[0][2];
    // The busbars: fine strips laid a hair over the cells, each running its whole column, the top cell to the bottom one.
    const silver = attribute('jontai_module', 'POSITION', 'bead:silver');
    for (const p of silver) {
      expect(p[2] - cellZ, 'a hair over the cells').toBeGreaterThan(0);
      expect(p[2] - cellZ).toBeLessThan(0.002);
    }
    const xs = [...new Set(silver.map((p) => Number(p[0].toFixed(5))))].sort((a, b) => a - b);
    expect(xs.length % 2, 'two edges to a strip').toBe(0);
    const strips = Array.from({ length: xs.length / 2 }, (_, k) => {
      const on = silver.filter((p) => p[0] >= xs[2 * k] - 1e-5 && p[0] <= xs[2 * k + 1] + 1e-5);
      return { x0: xs[2 * k], x1: xs[2 * k + 1], y0: Math.min(...on.map((p) => p[1])), y1: Math.max(...on.map((p) => p[1])) };
    });
    for (const s of strips) expect(s.x1 - s.x0, 'a fine busbar').toBeLessThan(0.004);
    cells.forEach(([cx, cy], k) => {
      const across = strips.filter((s) => s.x0 > cx - half && s.x1 < cx + half && s.y0 <= cy - half + 1e-5 && s.y1 >= cy + half - 1e-5);
      expect(across.length, `busbars across cell ${k + 1}`).toBeGreaterThanOrEqual(2);
    });
    // The backsheet: behind the cells, showing between them and round them at the edge.
    const grid = [
      [Math.min(...cells.map((c) => c[0])) - half, Math.max(...cells.map((c) => c[0])) + half],
      [Math.min(...cells.map((c) => c[1])) - half, Math.max(...cells.map((c) => c[1])) + half]
    ];
    const sheet = attribute('jontai_module', 'POSITION', 'bead:backsheet').filter((p) => p[2] > cellZ - 0.002);
    expect(sheet.length, "the backsheet's face").toBeGreaterThan(0);
    for (const p of sheet) expect(p[2], 'behind the cells').toBeLessThan(cellZ);
    for (const c of [0, 1]) {
      const [s0, s1] = span(sheet, c);
      expect(grid[c][0] - s0, 'the white edge round the cells').toBeGreaterThan(0.005);
      expect(s1 - grid[c][1], 'the white edge round the cells').toBeGreaterThan(0.005);
    }
    // The satin frame round it all, its lip a little proud of the cells.
    const satin = attribute('jontai_module', 'POSITION', 'bead:satin');
    expect(span(satin, 0)[0]).toBeLessThan(span(sheet, 0)[0]);
    expect(span(satin, 0)[1]).toBeGreaterThan(span(sheet, 0)[1]);
    expect(span(satin, 1)[1]).toBeGreaterThan(span(sheet, 1)[1]);
    expect(frameBottom()).toBeLessThan(span(sheet, 1)[0]);
    expect(span(satin, 2)[1], "the frame's lip").toBeGreaterThan(cellZ);
  });

  it("tilts the module about its own x through its node's origin, where the post holds it and the cable leaves the box", () => {
    const { origin, axis } = tiltAxis();
    // The post: square to the floor, its foot on it, its own axis meeting the tilt axis, its top the hinge round it.
    const post = frameOf('jontai_post');
    const up = axisOf(post, [0, 1, 0]);
    expect(dot(up, floorUp()), 'square to the floor').toBeGreaterThan(0.9999);
    const floor = frameOf('jontai_floor');
    const points = placed('jontai_post');
    expect(Math.min(...points.map((p) => toLocal(floor, p)[1])), "the post's foot on the floor").toBeCloseTo(0, 4);
    const height = dot(
      origin.map((c, k) => c - post.translation[k]),
      up
    );
    const hinge = post.translation.map((c, k) => c + height * up[k]);
    expect(fromLine(hinge, origin, axis), "the tilt axis through the post's own").toBeLessThan(1e-4);
    const top = points.filter((p) => dot(p.map((c, k) => c - post.translation[k]), up) > height - 0.002);
    expect(top.length, "the post's hinge").toBeGreaterThan(0);
    for (const p of top) expect(fromLine(p, origin, axis), 'round the tilt axis').toBeLessThan(0.015);
    // The cable leaves the box's gland on the tilt axis, so a tilt turns the box about the cable's end and opens no gap.
    const start = cableRings()[0].c;
    expect(fromLine(start, origin, axis), 'the cable leaves on the tilt axis').toBeLessThan(1e-4);
    const inBox = toLocal(frameOf('jontai_box'), start);
    expect(Math.hypot(inBox[1], inBox[2]), "on the box's own x").toBeLessThan(1e-4);
    expect(Math.abs(inBox[0] - Math.max(...attribute('jontai_box', 'POSITION').map((p) => p[0]))), 'at its gland').toBeLessThan(0.003);
  });

  it('hangs the junction box under the frame on three silver leads: EN, ES and 中, left to right', () => {
    const box = inModule('jontai_box');
    const [[bx0, bx1], [, by1]] = [span(box, 0), span(box, 1)];
    const bottom = frameBottom();
    // Under the module's lower edge, so the porthole sees it, with a gap the leads cross.
    expect(bottom - by1, 'the gap the leads cross').toBeGreaterThan(0.02);
    const xs = LEAD_NAMES.map((lead) => {
      const pts = inModule(lead);
      const [[x0, x1], [y0, y1]] = [span(pts, 0), span(pts, 1)];
      expect(y0, `${lead} into the box`).toBeLessThan(by1);
      expect(y0, `${lead} into the box`).toBeGreaterThan(by1 - 0.004);
      expect(y1, `${lead} into the frame`).toBeGreaterThan(bottom);
      expect(y1, `${lead} into the frame`).toBeLessThan(bottom + 0.006);
      expect(x0, `${lead} over the box`).toBeGreaterThan(bx0);
      expect(x1, `${lead} over the box`).toBeLessThan(bx1);
      return mean(pts, 0);
    });
    expect(xs[1] - xs[0], 'EN, then ES').toBeGreaterThan(0.008);
    expect(xs[2] - xs[1], 'ES, then 中').toBeCloseTo(xs[1] - xs[0], 4);
    expect(new Set(LEAD_NAMES.map((lead) => node(lead).mesh)).size).toBe(1);
    for (const lead of LEAD_NAMES) expect(node(lead).rotation ?? [0, 0, 0, 1], lead).toEqual([0, 0, 0, 1]);
  });

  it('lays the cable from the box down to the floor and along it to the connector, its u running 0..1 by length', () => {
    const floor = frameOf('jontai_floor');
    for (const p of placed('jontai_cable')) expect(toLocal(floor, p)[1], 'never into the floor').toBeGreaterThanOrEqual(-1e-4);
    const rings = cableRings();
    expect(rings[0].u).toBeCloseTo(0, 6);
    expect(rings[rings.length - 1].u).toBeCloseTo(1, 6);
    const lengths = [0];
    for (let k = 1; k < rings.length; k++) lengths.push(lengths[k - 1] + length(rings[k].c.map((c, j) => c - rings[k - 1].c[j])));
    rings.forEach((r, k) => expect(lengths[k] / lengths[lengths.length - 1], `u at ring ${k}`).toBeCloseTo(r.u, 2));
    // It falls from the box to the floor, then lies along it for much of its length.
    const radius = rings[0].radius;
    expect(toLocal(floor, rings[0].c)[1], 'from the box, above the floor').toBeGreaterThan(0.05);
    const lying = rings.filter((r) => Math.abs(toLocal(floor, r.c)[1] - radius) < 2e-4).map((r) => r.u);
    expect(Math.max(...lying) - Math.min(...lying), 'lying along the floor').toBeGreaterThan(0.4);
    // And ends inside the connector's strain relief, on its axis.
    const end = toLocal(frameOf('jontai_connector'), rings[rings.length - 1].c);
    expect(end[1], "inside the connector's back").toBeGreaterThan(0);
    expect(end[1]).toBeLessThan(0.012);
    expect(Math.hypot(end[0], end[2])).toBeLessThan(1e-4);
  });

  it('ends the cable in a connector lying on the floor in front, near the axis, its open end toward the porthole', () => {
    const floor = frameOf('jontai_floor');
    const pts = placed('jontai_connector').map((p) => toLocal(floor, p));
    const lowest = Math.min(...pts.map((q) => q[1]));
    expect(lowest, 'lying on the floor').toBeGreaterThanOrEqual(-1e-4);
    expect(lowest).toBeLessThan(1e-3);
    const f = frameOf('jontai_connector');
    const along = axisOf(f, [0, 1, 0]);
    expect(Math.abs(dot(along, floorUp())), 'its axis level with the floor').toBeLessThan(1e-4);
    expect(along[2], 'its open end toward the porthole').toBeGreaterThan(0.5);
    expect(Math.abs(f.translation[0]), 'near the axis').toBeLessThan(0.15);
    expect(f.translation[2], 'in front of the display').toBeGreaterThan(frameOf(DISPLAY).translation[2]);
    expect(f.translation[2], 'in front of the module').toBeGreaterThan(Math.max(...placed('jontai_module').map((p) => p[2])));
    // The silver contact in its open end.
    const contact = attribute('jontai_connector', 'POSITION', 'bead:silver');
    const body = attribute('jontai_connector', 'POSITION', 'bead:polymer');
    expect(Math.max(...contact.map(radial))).toBeLessThan(Math.max(...body.map(radial)) / 2);
    expect(Math.max(...contact.map((p) => p[1]))).toBeGreaterThan(0.8 * Math.max(...body.map((p) => p[1])));
  });

  it("lays a floor of the bead's lacquer low in the hollow, leaning toward the porthole, for the parts to stand on", () => {
    const f = frameOf('jontai_floor');
    expect(Math.abs(f.translation[0]), 'centred under the axis').toBeLessThan(1e-4);
    expect(f.translation[1], 'low in the hollow').toBeLessThan(-0.2);
    const up = floorUp();
    expect(Math.abs(up[0])).toBeLessThan(1e-4);
    const lean = (Math.atan2(up[2], up[1]) * 180) / Math.PI;
    expect(lean).toBeGreaterThan(5);
    expect(lean).toBeLessThan(20);
    const floor = attribute('jontai_floor', 'POSITION');
    expect(Math.abs(mean(floor, 0))).toBeLessThan(1e-3);
    expect(Math.abs(mean(floor, 2))).toBeLessThan(1e-3);
    expect(Math.max(...floor.map((p) => p[1]))).toBeCloseTo(0, 6);
    const normals = attribute('jontai_floor', 'NORMAL');
    floor.forEach((p, k) => {
      if (Math.abs(p[1]) < 1e-6 && radial(p) < floorRim() - 0.01) expect(normals[k][1], `the floor's normal at ${p}`).toBeCloseTo(1, 5);
    });
    expect(floorRim()).toBeGreaterThan(0.3);
    expect(floorRim()).toBeLessThan(0.45);
  });

  it("stands the website's landscape display on the floor beside the module, right of the axis, 0.20 of the bead wide", () => {
    const points = placed(DISPLAY);
    const x0 = Math.min(...points.map((p) => p[0]));
    expect(x0, 'right of the axis').toBeGreaterThan(0.02);
    expect(x0, 'beside the module, never in front of it').toBeGreaterThan(Math.max(...placed('jontai_module').map((p) => p[0])));
    const [w0, w1] = span(allRows(DISPLAY, 'POSITION'), 0);
    expect((w1 - w0) / (2 * RADIUS), 'its width, as a share of the bead').toBeGreaterThan(0.19);
    expect((w1 - w0) / (2 * RADIUS)).toBeLessThan(0.21);
    standsOn('jontai_floor', DISPLAY, floorRim());
    const f = frameOf(DISPLAY);
    expect(axisOf(f, [0, 1, 0])[1], 'upright').toBeGreaterThan(Math.cos((5 * Math.PI) / 180));
    const face = axisOf(f, [0, 0, 1]);
    expect(face[2], 'facing the porthole').toBeGreaterThan(0.95);
    expect(face[0], 'turned a little toward the axis').toBeLessThan(0);
  });

  it("keeps the bead's inner light from mirroring in the display's glossy front or on the module", () => {
    // Seen along the porthole's axis and from the bead shot's camera, the point of a front's plane that mirrors the
    // light must lie clear of it: the display's glass, and the module's face with the box and leads under it (on the
    // axis above the slot, the light mirrored on the module's lower edge and the leads as a hot spot).
    const light = node('bead_jontai-energy_inner').translation!;
    const clear = (frame: string, plane: number[][], outline: number[][]) => {
      const f = frameOf(frame);
      const n = axisOf(f, [0, 0, 1]);
      const local = outline.map((p) => toLocal(f, p));
      const [[x0, x1], [y0, y1]] = [span(local, 0), span(local, 1)];
      for (const view of [[0, 0, 1], [...CAMERA_PATH.bead.offset]]) {
        const spot = toLocal(f, mirroredLight(light, plane[0], n, view));
        const outside = Math.max(x0 - spot[0], spot[0] - x1, y0 - spot[1], spot[1] - y1);
        expect(outside, `${frame}: the mirrored light at ${spot}, seen along ${view}`).toBeGreaterThan(0.08);
      }
    };
    const glass = placed(DISPLAY, 'bead:display');
    clear(DISPLAY, glass, glass);
    clear(
      'jontai_module',
      placed(CELL_NAMES[0]),
      ['jontai_module', 'jontai_box', ...LEAD_NAMES].flatMap((name) => placed(name))
    );
  });
});
