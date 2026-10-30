import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COMPASS_GLB_BUDGET, readGlbJson } from '~/engine/bob/glb';

const bytes = new Uint8Array(readFileSync('public/models/bob-compass.glb'));

/** The fields of the glTF JSON the reader's own type leaves out and these tests look at. */
interface GltfExtras {
  nodes: { name?: string; translation?: number[]; rotation?: number[]; scale?: number[]; matrix?: number[]; children?: number[] }[];
  accessors: { bufferView: number; byteOffset?: number; count: number; type: string; componentType: number }[];
  bufferViews: { byteOffset?: number; byteStride?: number }[];
  animations: { name?: string; samplers: { input: number; output: number }[]; channels: { sampler: number; target: { node: number; path: string } }[] }[];
}

const extras = readGlbJson(bytes) as unknown as GltfExtras;
const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
/** Where the binary chunk's data begins: after the file header, the JSON chunk and the binary chunk's own header. */
const binStart = 12 + 8 + view.getUint32(12, true) + 8;
const COMPONENTS: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

/** An accessor's rows of floats, read from the binary chunk. */
function rows(accessor: number): number[][] {
  const a = extras.accessors[accessor];
  expect(a.componentType, `accessor ${accessor} is float`).toBe(5126);
  const n = COMPONENTS[a.type];
  const bv = extras.bufferViews[a.bufferView];
  const stride = bv.byteStride ?? n * 4;
  const offset = binStart + (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  return Array.from({ length: a.count }, (_, i) => Array.from({ length: n }, (_, c) => view.getFloat32(offset + i * stride + c * 4, true)));
}

/** The node called this, and the rows of the attribute of its mesh. */
function attribute(name: string, attributeName: string): number[][] {
  const j = readGlbJson(bytes);
  const node = j.nodes.find((n) => n.name === name)!;
  return rows(j.meshes[node.mesh!].primitives[0].attributes[attributeName]);
}

/** A GLB with this JSON text in its first chunk, padded to four bytes with spaces as the format asks. */
function glbOf(json: string, version = 2, chunkType = 0x4e4f534a): Uint8Array {
  const text = new TextEncoder().encode(json);
  const padded = new Uint8Array(Math.ceil(text.length / 4) * 4).fill(0x20);
  padded.set(text);
  const out = new Uint8Array(20 + padded.length);
  const head = new DataView(out.buffer);
  head.setUint32(0, 0x46546c67, true);
  head.setUint32(4, version, true);
  head.setUint32(8, out.length, true);
  head.setUint32(12, padded.length, true);
  head.setUint32(16, chunkType, true);
  out.set(padded, 20);
  return out;
}

describe('the compass GLB', () => {
  it('stays within its budget', () => expect(bytes.byteLength).toBeLessThanOrEqual(COMPASS_GLB_BUDGET));

  it('holds the named parts', () => {
    const names = readGlbJson(bytes).nodes.map((n) => n.name);
    for (const n of ['armillary', 'band_1', 'band_2', 'band_3', 'band_4', 'rim_1', 'rim_4', 'needle', 'pivot', 'axis']) expect(names).toContain(n);
  });

  // Round 8 (spec 2026-10-30-bob-moonlit-3d-design.md): Bob found the compass "doesnt look polished"; its rims were
  // eight-sided tubes and its needle six points.
  it('makes each rim a round tube: at least 16 sides round it', () => {
    for (const k of [1, 2, 3, 4]) {
      // The tube round the band's upper edge (the file's +y), a circle in the band's plane: each of its points lies off the
      // tube's middle line in one of its sides' directions, and those directions, counted in 5 degree bins, are its sides.
      const upper = attribute(`rim_${k}`, 'POSITION').filter(([, y]) => y! > 0);
      const r = upper.map(([x, , z]) => Math.hypot(x!, z!));
      const rc = r.reduce((a, b) => a + b, 0) / r.length;
      const yc = upper.reduce((a, [, y]) => a + y!, 0) / upper.length;
      const sides = new Set(upper.map(([, y], i) => Math.round((Math.atan2(y! - yc, r[i]! - rc) * 180) / Math.PI / 5)));
      expect(sides.size, `rim_${k}`).toBeGreaterThanOrEqual(16);
    }
  });

  it('bevels the needle: its edges rounded, not six points', () => {
    expect(attribute('needle', 'POSITION').length).toBeGreaterThanOrEqual(60);
  });

  it('gives every band a UV channel', () => {
    const j = readGlbJson(bytes);
    for (const k of [1, 2, 3, 4]) {
      const node = j.nodes.find((n) => n.name === `band_${k}`)!;
      expect(j.meshes[node.mesh!].primitives[0].attributes.TEXCOORD_0).toBeTypeOf('number');
    }
  });

  it('carries the rise on the armillary, translation and rotation', () => {
    const j = readGlbJson(bytes),
      arm = j.nodes.findIndex((n) => n.name === 'armillary');
    const rise = j.animations!.find((a) => a.name === 'rise')!;
    expect(rise.channels.filter((c) => c.target.node === arm).map((c) => c.target.path).sort()).toEqual(['rotation', 'translation']);
  });

  it('has the rise as its one animation, 52 frames at 24 fps long', () => {
    expect(extras.animations.map((a) => a.name)).toEqual(['rise']);
    const times = extras.animations[0].samplers.map((s) => rows(s.input));
    for (const t of times) {
      expect(t).toHaveLength(53);
      expect(t[0][0]).toBe(0);
      expect(t[52][0]).toBeCloseTo(52 / 24, 5);
    }
  });

  it('rises from 3.25 below and 50 degrees round, easing out to rest', () => {
    const [translation, rotation] = ['translation', 'rotation'].map((path) => {
      const channel = extras.animations[0].channels.find((c) => c.target.path === path)!;
      return rows(extras.animations[0].samplers[channel.sampler].output);
    });
    const first = translation[0],
      last = translation[52];
    expect(first[0]).toBeCloseTo(0, 5);
    expect(first[1]).toBeCloseTo(-3.25, 4);
    expect(first[2]).toBeCloseTo(0, 5);
    expect(last[1]).toBeCloseTo(0, 5);
    // The preview's ease-out, 1 - (1 - x)^3: seven eighths of the way up at the half.
    expect(translation[26][1]).toBeCloseTo(-3.25 * (1 - 0.875), 3);
    // A turn about the up axis (three's Y) as a quaternion: from -50 degrees to none.
    const degrees = (q: number[]) => (2 * Math.atan2(q[1], q[3]) * 180) / Math.PI;
    for (const q of rotation) {
      expect(q[0]).toBeCloseTo(0, 5);
      expect(q[2]).toBeCloseTo(0, 5);
    }
    expect(degrees(rotation[0])).toBeCloseTo(-50, 3);
    expect(degrees(rotation[26])).toBeCloseTo(-50 * (1 - 0.875), 2);
    expect(degrees(rotation[52])).toBeCloseTo(0, 5);
  });

  it('leaves the armillary at rest in the file, at the origin', () => {
    const arm = extras.nodes.find((n) => n.name === 'armillary')!;
    for (const key of ['translation', 'rotation', 'scale', 'matrix'] as const) expect(arm[key], key).toBeUndefined();
  });

  it('stands the needle straight up, its tip at +Y', () => {
    const needle = extras.nodes.find((n) => n.name === 'needle')!;
    expect(needle.rotation).toBeUndefined();
    const points = attribute('needle', 'POSITION');
    const ys = points.map((p) => p[1]);
    expect(Math.max(...ys)).toBeCloseTo(1.15, 5);
    expect(Math.min(...ys)).toBeCloseTo(-1.15 * 0.85, 5);
    for (const p of points) expect(Math.hypot(p[0], p[2])).toBeLessThan(0.0701);
  });

  it('runs u round each band from local +X and v from its bottom edge to its top', () => {
    const heights = [0.18, 0.16, 0.15, 0.14]; // the bands' heights, as the export script has them
    heights.forEach((h, i) => {
      const name = `band_${i + 1}`;
      const positions = attribute(name, 'POSITION');
      const uvs = attribute(name, 'TEXCOORD_0');
      expect(uvs).toHaveLength(positions.length);
      let worstU = 0,
        worstV = 0;
      positions.forEach(([x, y, z], k) => {
        const [u, v] = uvs[k];
        // The band lies round local Y here (Blender's Z), and +X is where u starts; a turn from +X toward -Z is increasing u.
        let du = u - Math.atan2(-z, x) / (2 * Math.PI);
        du -= Math.round(du);
        worstU = Math.max(worstU, Math.abs(du));
        // The bevel moves a vertex a hair along the band's height, so v follows its height to within a few hundredths.
        worstV = Math.max(worstV, Math.abs(v - (y + h / 2) / h));
      });
      expect(worstU, `${name} u`).toBeLessThan(1e-3);
      expect(worstV, `${name} v`).toBeLessThan(0.03);
      for (const k of [0, 1]) {
        const us = uvs.map((uv) => uv[k]);
        expect(Math.min(...us), `${name} min ${'uv'[k]}`).toBeCloseTo(0, 5);
        expect(Math.max(...us), `${name} max ${'uv'[k]}`).toBeCloseTo(1, 5);
      }
    });
  });

  it('hangs the bands on the armillary and each rim on its band', () => {
    const j = readGlbJson(bytes);
    const index = (name: string) => j.nodes.findIndex((n) => n.name === name);
    const children = (name: string) => (j.nodes[index(name)].children ?? []).map((c) => j.nodes[c].name);
    for (const k of [1, 2, 3, 4]) {
      expect(children('armillary')).toContain(`band_${k}`);
      expect(children(`band_${k}`)).toContain(`rim_${k}`);
    }
    for (const part of ['needle', 'pivot', 'axis']) expect(children('armillary')).toContain(part);
  });

  it('makes every part a mesh', () => {
    const j = readGlbJson(bytes);
    for (const name of ['band_1', 'band_2', 'band_3', 'band_4', 'rim_1', 'rim_2', 'rim_3', 'rim_4', 'needle', 'pivot', 'axis']) {
      const node = j.nodes.find((n) => n.name === name)!;
      expect(node.mesh, name).toBeTypeOf('number');
      expect(j.meshes[node.mesh!].primitives[0].attributes.POSITION, name).toBeTypeOf('number');
    }
  });
});

describe('readGlbJson', () => {
  it('rejects a file that is not a GLB', () => {
    expect(() => readGlbJson(new Uint8Array(12))).toThrow(TypeError);
  });

  it('names the magic when it is wrong', () => {
    expect(() => readGlbJson(new Uint8Array(32))).toThrow(/magic/);
  });

  it('names the version when it is not 2', () => {
    expect(() => readGlbJson(glbOf('{}', 1))).toThrow(/version/);
  });

  it('names the chunk when the first is not JSON', () => {
    expect(() => readGlbJson(glbOf('{}', 2, 0x004e4942))).toThrow(/chunk/);
  });

  it('names a file that ends before its JSON chunk does', () => {
    expect(() => readGlbJson(glbOf('{"nodes":[]}').subarray(0, 24))).toThrow(/JSON chunk/);
  });

  it('names a file that is only a header', () => {
    expect(() => readGlbJson(glbOf('{}').subarray(0, 12))).toThrow(/chunk/);
  });

  it('names a JSON chunk that lacks its node or mesh list', () => {
    expect(() => readGlbJson(glbOf('{"meshes":[]}'))).toThrow(/"nodes"/);
    expect(() => readGlbJson(glbOf('{"nodes":[]}'))).toThrow(/"meshes"/);
    expect(() => readGlbJson(glbOf('[]'))).toThrow(TypeError);
  });

  it('names JSON that does not parse', () => {
    expect(() => readGlbJson(glbOf('{nodes'))).toThrow(TypeError);
  });

  it('reads the JSON of a minimal GLB', () => {
    expect(readGlbJson(glbOf('{"nodes":[{"name":"a"}],"meshes":[]}'))).toEqual({ nodes: [{ name: 'a' }], meshes: [] });
  });

  it('reads a GLB held at an offset in a larger buffer', () => {
    const glb = glbOf('{"nodes":[],"meshes":[]}');
    const host = new Uint8Array(glb.length + 7);
    host.set(glb, 7);
    expect(readGlbJson(host.subarray(7))).toEqual({ nodes: [], meshes: [] });
  });
});
