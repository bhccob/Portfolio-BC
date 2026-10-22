import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { readGlbJson } from '~/engine/bob/glb';

/**
 * The beads' GLB (tools/blender/export_beads.py), read from the file itself:
 * its nodes, materials, embedded vein texture and the shapes the code relies
 * on (Task 8 finds every node by these names). Three's frame throughout: the
 * porthole faces +z and up is +y.
 */
const bytes = new Uint8Array(readFileSync('public/models/bob-beads.glb'));

/** The most bytes the beads' GLB may take, with its baked vein texture inside it (global constraints, asset budgets). */
const BEADS_GLB_BUDGET = 1_500_000;

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
    pbrMetallicRoughness?: { metallicFactor?: number; roughnessFactor?: number; metallicRoughnessTexture?: { index: number } };
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
function attribute(name: string, attributeName: string, material?: string): number[][] {
  const all = primitives(name);
  const primitive = material === undefined ? all[0] : all.find((p) => materialName(p.material) === material);
  expect(primitive, `${name} has a primitive in ${material}`).toBeDefined();
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

/** The bytes of an image embedded in the GLB's binary chunk (not a file beside it). */
function embedded(image: number): Uint8Array {
  const { bufferView, uri } = gltf.images[image];
  expect(uri, `image ${image} embedded, not a file beside it`).toBeUndefined();
  const bv = gltf.bufferViews[bufferView!];
  const at = binStart + (bv.byteOffset ?? 0);
  return bytes.subarray(at, at + bv.byteLength);
}

/**
 * An 8-bit, non-interlaced PNG's pixels (top row first), unfiltered: grey as one channel, RGB and
 * indexed colour (expanded through its palette) as three.
 */
function decodePng(png: Uint8Array): { width: number; height: number; channels: number; data: Uint8Array } {
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

  it('names the four materials, and each part wears its own', () => {
    const names = gltf.materials.map((m) => m.name);
    for (const m of ['bead:lacquer', 'bead:gold', 'bead:glass', 'bead:display']) expect(names).toContain(m);
    for (const id of IDS) {
      const wears = (part: string) => primitives(`bead_${id}_${part}`).map((p) => materialName(p.material));
      expect(wears('body')).toEqual(['bead:lacquer']);
      expect(wears('halo')).toEqual(['bead:gold']);
      expect(wears('rim')).toEqual(['bead:gold']);
      expect(wears('glass')).toEqual(['bead:glass']);
      // The screen is the black glass; the casing round it is gold.
      expect(wears('display').sort()).toEqual(['bead:display', 'bead:gold']);
    }
  });

  it('embeds the baked veins, 1024 square, as the lacquer emissive and metal map', () => {
    const lacquer = gltf.materials.find((m) => m.name === 'bead:lacquer')!;
    expect(lacquer.emissiveTexture).toBeDefined();
    expect(lacquer.pbrMetallicRoughness?.metallicRoughnessTexture).toBeDefined();
    const sources = [lacquer.emissiveTexture!.index, lacquer.pbrMetallicRoughness!.metallicRoughnessTexture!.index].map((t) => gltf.textures[t].source);
    for (const s of sources) expect(gltf.images[s].mimeType).toBe('image/png');
    const [veins, metal] = sources.map((s) => decodePng(embedded(s)));
    for (const png of [veins, metal]) expect([png.width, png.height]).toEqual([1024, 1024]);
    // The emissive map is the vein mask itself, grey; some of the shell is veined, most of it is not.
    expect(veins.channels).toBe(1);
    const veined = veins.data.filter((v) => v > 127).length / veins.data.length;
    expect(veined).toBeGreaterThan(0.005);
    expect(veined).toBeLessThan(0.1);
    // The metal map is the same mask in blue (glTF's metal), its green (roughness) full: the lacquer's roughness is its factor.
    expect(metal.channels).toBe(3);
    let blueOff = 0,
      greenOff = 0;
    for (let i = 0; i < veins.data.length; i++) {
      if (metal.data[3 * i + 2] !== veins.data[i]) blueOff++;
      if (metal.data[3 * i + 1] !== 255) greenOff++;
    }
    expect(blueOff, 'texels whose metal is not the vein mask').toBe(0);
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

  it('makes each body a sphere of radius 0.95 with UVs for the veins', () => {
    for (const id of IDS) {
      const points = attribute(`bead_${id}_body`, 'POSITION');
      const radius = Math.max(...points.map(length));
      expect(Math.abs(radius - RADIUS), `${id} radius ${radius}`).toBeLessThanOrEqual(0.01);
      expect(attribute(`bead_${id}_body`, 'TEXCOORD_0')).toHaveLength(points.length);
    }
  });

  it('opens the body behind the porthole, facing +z, onto a hollow cavity', () => {
    const points = attribute('bead_funcial_body', 'POSITION');
    const normals = attribute('bead_funcial_body', 'NORMAL');
    // The shell faces out, the cavity's wall faces in, toward the hollow.
    const outward = points.map((p, k) => p[0] * normals[k][0] + p[1] * normals[k][1] + p[2] * normals[k][2] > 0);
    const shell = points.filter((_, k) => outward[k]);
    const cavity = points.filter((_, k) => !outward[k]);
    for (const p of shell) expect(length(p)).toBeCloseTo(RADIUS, 3);
    // No shell in front of the porthole: the shell stops at the opening's edge, 0.62 of the radius off the axis.
    const edge = Math.sqrt(1 - PORTHOLE ** 2);
    for (const p of shell) expect(p[2] / length(p)).toBeLessThanOrEqual(edge + 1e-3);
    const front = shell.reduce((a, p) => (p[2] > a[2] ? p : a));
    expect(offAxis(front) / RADIUS).toBeCloseTo(PORTHOLE, 2);
    // The cavity: a hollow inside the shell, open at the porthole's edge and reaching back past the centre.
    expect(cavity.length).toBeGreaterThan(100);
    for (const p of cavity) expect(length(p)).toBeLessThanOrEqual(RADIUS + 1e-4);
    expect(Math.min(...cavity.map((p) => p[2]))).toBeLessThan(0);
    expect(Math.max(...cavity.map((p) => p[2]))).toBeCloseTo(RADIUS * edge, 3);
  });

  it('sets the gold rim and the curved glass on the porthole, facing +z', () => {
    const rim = attribute('bead_funcial_rim', 'POSITION');
    for (const p of rim) {
      expect(p[2]).toBeGreaterThan(0.6);
      expect(offAxis(p)).toBeGreaterThan(0.5);
      expect(offAxis(p)).toBeLessThan(0.7);
    }
    const glass = attribute('bead_funcial_glass', 'POSITION');
    const apex = glass.reduce((a, p) => (p[2] > a[2] ? p : a));
    expect(offAxis(apex), 'the dome bulges out on the axis').toBeLessThan(1e-3);
    for (const p of glass) {
      expect(offAxis(p)).toBeLessThanOrEqual(PORTHOLE * RADIUS);
      expect(p[2]).toBeGreaterThan(0.7);
    }
    const normals = attribute('bead_funcial_glass', 'NORMAL');
    expect(normals.reduce((s, n) => s + n[2], 0) / normals.length).toBeGreaterThan(0.95);
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
      const xs = points.map((p) => p[0]),
        ys = points.map((p) => p[1]),
        zs = points.map((p) => p[2]);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      expect((x1 - x0) / (y1 - y0), `${id} screen ${w}x${h}`).toBeCloseTo(w / h, 2);
      expect(Math.max(...zs) - Math.min(...zs), `${id} screen is flat`).toBeLessThan(1e-4);
      // glTF's v runs down the image: v = 0 at the top edge, so a texture with flipY off shows the screenshot upright.
      points.forEach(([x, y], k) => {
        expect(uvs[k][0]).toBeCloseTo((x - x0) / (x1 - x0), 4);
        expect(uvs[k][1]).toBeCloseTo((y1 - y) / (y1 - y0), 4);
      });
      for (const n of attribute(`bead_${id}_display`, 'NORMAL', 'bead:display')) expect(n[2]).toBeCloseTo(1, 4);
    }
    // A phone for Funcial; landscape for Jontai Energy and Cookies Clicker, as their screenshots are.
    expect(webpSize(SCREENSHOTS.funcial)[0]).toBeLessThan(webpSize(SCREENSHOTS.funcial)[1]);
  });

  it('stands each display beside the object slot, inside the cavity and behind the glass', () => {
    for (const id of IDS) {
      const display = node(`bead_${id}_display`);
      expect(display.translation![0], `${id} display to the right of the slot`).toBeGreaterThan(0.1);
      for (const p of allRows(`bead_${id}_display`, 'POSITION')) {
        const q = place(p, display.rotation, display.translation);
        expect(length(q), `${id} inside the body`).toBeLessThan(RADIUS - 0.1);
        expect(offAxis(q), `${id} framed by the porthole`).toBeLessThan(0.56);
        expect(q[2], `${id} behind the glass`).toBeLessThan(0.7);
      }
    }
  });

  it('lights each cavity with its own dim warm point light, in front of the slot', () => {
    const lights = gltf.extensions!.KHR_lights_punctual!.lights;
    for (const id of IDS) {
      const inner = node(`bead_${id}_inner`);
      const light = lights[inner.extensions!.KHR_lights_punctual!.light];
      expect(light.type).toBe('point');
      const [r, g, b] = light.color ?? [1, 1, 1];
      expect(r).toBeGreaterThanOrEqual(g);
      expect(g).toBeGreaterThan(b);
      // Dim: well below the tunnel's own light (GLASS_LOOK.well.light, 1.7).
      expect(light.intensity).toBeGreaterThan(0);
      expect(light.intensity).toBeLessThan(1.7);
      const t = inner.translation!;
      expect(length(t), `${id} inside the cavity`).toBeLessThan(RADIUS - 0.2);
      expect(t[2]).toBeGreaterThan(node(`bead_${id}_object`).translation![2]);
    }
  });
});
