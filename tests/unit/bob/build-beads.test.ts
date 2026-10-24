import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProjectId } from '~/data/projects';
import { cookiesMotion, funcialMotion, jontaiMotion } from '~/engine/bob/beadMotion';
import { BEAD_PARTS, BEADS_LOOK, type BeadsModel, loadBeads } from '~/engine/bob/build/beads';
import type { QualityTier } from '~/engine/quality';
import { BEADS, CAMERA_PATH } from '~/scene/bob/journey';

const IDS = ['funcial', 'jontai-energy', 'cookies-clicker'] as const satisfies readonly ProjectId[];
const DEG = Math.PI / 180;
const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

// ---------------------------------------------------------------- a fake glTF with the GLB's nodes

/**
 * The materials the GLB carries (tools/blender/export_beads.py and the object scripts), as GLTFLoader makes them: a
 * glTF material with KHR_materials_transmission or KHR_materials_specular is a MeshPhysicalMaterial, any other a
 * MeshStandardMaterial. One of each, shared by every part that wears it, in every bead, as the file shares them.
 */
function fileMaterials() {
  const standard = (name: string, emissive?: [number, number, number]) => {
    const m = new THREE.MeshStandardMaterial({ name });
    if (emissive) m.emissive.setRGB(...emissive);
    return m;
  };
  const glass = new THREE.MeshPhysicalMaterial({ name: 'bead:glass', transmission: 1, roughness: 0.02, metalness: 0, specularIntensity: 0.25 });
  glass.color.setRGB(0.92, 0.88, 1);
  const cell = new THREE.MeshPhysicalMaterial({ name: 'bead:cell', roughness: 0.35, metalness: 0, specularIntensity: 0.5 });
  cell.emissive.setRGB(0, 0.00765, 0.00173);
  const bridge = new THREE.MeshPhysicalMaterial({ name: 'bead:bridge', roughness: 0.6, metalness: 0, specularIntensity: 0.5 });
  const veins = new THREE.Texture();
  veins.name = 'bead-veins';
  const lacquer = standard('bead:lacquer', [0.5, 0.26, 0.08]);
  lacquer.emissiveMap = veins;
  return {
    lacquer,
    gold: standard('bead:gold', [0.2, 0.104, 0.032]),
    display: standard('bead:display'),
    glass,
    abacus: standard('bead:abacus'),
    aluminium: standard('bead:aluminium'),
    track: standard('bead:track', [0.6, 0.312, 0.096]),
    cell,
    silver: standard('bead:silver'),
    satin: standard('bead:satin'),
    backsheet: standard('bead:backsheet'),
    polymer: standard('bead:polymer'),
    bridge,
    caramel: standard('bead:caramel'),
    copper: standard('bead:copper'),
    ruby: standard('bead:ruby', [0.03, 0.0009, 0.0015])
  };
}

type FileMaterials = ReturnType<typeof fileMaterials>;

/**
 * A scene graph made to look like the beads GLB as GLTFLoader hands it over (its nodes as tests/unit/bob/beads-glb.test.ts
 * pins them): per bead a root at the origin with its body, halo, rim and glass meshes, its display (a group of two
 * primitives: the gold casing and the screen in `bead:display`, the screen's UV 0..1 over it), the object slot and the
 * warm point light; under the slot each object's parts with the file's rest poses, a node of more than one primitive
 * being a Group of meshes as GLTFLoader makes it. The meshes share their materials across beads and parts as the file
 * does. `omit` leaves one node out; `swap` puts a plain Object3D where the node named is.
 */
function fakeGltf(options: { omit?: string; swap?: string } = {}): { scene: THREE.Group; materials: FileMaterials; geometries: THREE.BufferGeometry[] } {
  const m = fileMaterials();
  const geometries: THREE.BufferGeometry[] = [];
  const box = () => {
    const g = new THREE.BoxGeometry(0.02, 0.02, 0.02);
    geometries.push(g);
    return g;
  };
  const scene = new THREE.Group();
  scene.name = 'Scene';
  const add = (parent: THREE.Object3D, name: string, object: THREE.Object3D): THREE.Object3D => {
    if (name === options.omit) return new THREE.Object3D();
    const placed = name === options.swap ? new THREE.Object3D() : object;
    placed.name = name;
    if (placed !== object) placed.position.copy(object.position);
    parent.add(placed);
    return placed;
  };
  const mesh = (material: THREE.Material, geometry: THREE.BufferGeometry = box()) => new THREE.Mesh(geometry, material);
  /** A node of several primitives: a Group of one mesh per material, named `<name>_<i>` as GLTFLoader names them. */
  const group = (name: string, materials: THREE.Material[]) => {
    const g = new THREE.Group();
    materials.forEach((material, i) => {
      const part = mesh(material);
      part.name = `${name}_${i + 1}`;
      g.add(part);
    });
    return g;
  };
  const at = <T extends THREE.Object3D>(object: T, x: number, y: number, z: number, q?: [number, number, number, number]): T => {
    object.position.set(x, y, z);
    // The file's turns, to four places: made unit again, as the file's are.
    if (q) object.quaternion.set(...q).normalize();
    return object;
  };
  const lean: [number, number, number, number] = [0.0872, 0, 0, 0.9962];
  const body = new THREE.SphereGeometry(0.95, 16, 8);
  const screen = new THREE.PlaneGeometry(0.3, 0.2);
  const cellShape = box();
  geometries.push(body, screen);

  for (const id of IDS) {
    const root = add(scene, `bead_${id}`, new THREE.Object3D());
    add(root, `bead_${id}_body`, mesh(m.lacquer, body));
    const display = add(root, `bead_${id}_display`, at(new THREE.Group(), 0.25, -0.02, 0.18));
    const casing = mesh(m.gold);
    casing.name = `bead_${id}_display_1`;
    display.add(casing);
    const glassFront = mesh(m.display, screen);
    glassFront.name = `bead_${id}_display_2`;
    display.add(glassFront);
    add(root, `bead_${id}_glass`, mesh(m.glass));
    add(root, `bead_${id}_halo`, mesh(m.gold));
    add(root, `bead_${id}_inner`, at(new THREE.PointLight(0xffb873, 0.25, 0, 2), 0, 0.3, 0.45));
    const slot = add(root, `bead_${id}_object`, at(new THREE.Object3D(), 0, 0, 0.3));
    add(root, `bead_${id}_rim`, mesh(m.gold));

    if (id === 'funcial') {
      const abacus = add(slot, 'funcial_abacus', at(group('funcial_abacus', [m.lacquer, m.gold]), -0.165, -0.3172, -0.1187, [0, 0.1285, 0.0227, 0.9914]));
      for (let k = 1; k <= 5; k++) add(abacus, `funcial_bead_${k}`, at(group(`funcial_bead_${k}`, [m.abacus, m.gold]), -0.0864 + 0.0432 * (k - 1), 0.085, 0));
      for (let k = 1; k <= 4; k++) add(slot, `funcial_pin_${k}`, at(mesh(m.gold), -0.2 + 0.09 * k, -0.36, 0.2, lean));
      add(slot, 'funcial_platter', at(group('funcial_platter', [m.aluminium, m.gold]), 0, -0.335, 0, lean));
      add(slot, 'funcial_track', at(mesh(m.track), 0, -0.335, 0, lean));
    } else if (id === 'jontai-energy') {
      const cable = add(slot, 'jontai_cable', at(mesh(m.polymer), 0, -0.16, -0.08, lean));
      add(cable, 'jontai_connector', at(group('jontai_connector', [m.polymer, m.silver]), 0.03, 0.0085, 0.24));
      add(slot, 'jontai_floor', at(mesh(m.lacquer), 0, -0.16, -0.08, lean));
      const module = add(slot, 'jontai_module', at(group('jontai_module', [m.satin, m.backsheet, m.silver]), -0.2082, -0.1151, -0.0756, [-0.358, 0.0374, 0.0225, 0.9327]));
      const junction = add(module, 'jontai_box', at(mesh(m.polymer), 0.065, 0, 0));
      for (let k = 1; k <= 3; k++) add(junction, `jontai_lead_${k}`, at(mesh(m.silver), -0.034 + 0.017 * k, 0.017, 0));
      for (let k = 1; k <= 16; k++) {
        const row = Math.floor((k - 1) / 4);
        const col = (k - 1) % 4;
        add(module, `jontai_cell_${k}`, at(mesh(m.cell, cellShape), (col - 1.5) * 0.09, 0.2395 + (1.5 - row) * 0.09, 0.0082));
      }
      add(slot, 'jontai_post', at(mesh(m.satin), -0.248, -0.16, -0.08));
    } else {
      const bridge = add(slot, 'cookies_bridge', at(mesh(m.bridge), -0.235, -0.1472, -0.11, [0, 0.0687, 0.0121, 0.9976]));
      for (const name of ['cookies_balance', 'cookies_barrel', 'cookies_escapement']) add(bridge, name, at(group(name, [m.copper, m.ruby]), 0.1, 0.11, 0.014));
      add(bridge, 'cookies_crown', at(mesh(m.copper), 0.2, 0.1406, 0));
      add(bridge, 'cookies_dial', at(group('cookies_dial', [m.caramel, m.copper, m.ruby]), 0.09, 0.3, 0.0155));
      for (let k = 1; k <= 8; k++) add(bridge, `cookies_wheel_${k}`, at(group(`cookies_wheel_${k}`, [m.copper, m.ruby]), -0.187 + 0.05 * (k - 1), 0.21, 0.014));
      add(slot, 'cookies_floor', at(mesh(m.lacquer), 0, -0.15, -0.08, lean));
    }
  }
  return { scene, materials: m, geometries };
}

/** A screenshot as a test hands it over: a plain texture, no image, set up the way a TextureLoader makes it (flipY on). */
function screenStub(id: ProjectId): THREE.Texture {
  const texture = new THREE.Texture();
  texture.name = `screen:${id}`;
  return texture;
}

function screens(): Record<ProjectId, THREE.Texture> {
  return { funcial: screenStub('funcial'), 'jontai-energy': screenStub('jontai-energy'), 'cookies-clicker': screenStub('cookies-clicker') };
}

function build(tier: QualityTier = 'high', options: Parameters<typeof fakeGltf>[0] = {}) {
  const gltf = fakeGltf(options);
  const shots = screens();
  const model = loadBeads(gltf, tier, shots);
  return { gltf, shots, model };
}

// ---------------------------------------------------------------- reading the model

/** The object called `name` under `root`, which must exist. */
function objectNamed<T extends THREE.Object3D = THREE.Object3D>(root: THREE.Object3D, name: string): T {
  const found = root.getObjectByName(name);
  expect(found, name).toBeDefined();
  return found as T;
}

/** Every mesh under `root`. */
function meshes(root: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) out.push(o as THREE.Mesh);
  });
  return out;
}

/** The one material of a mesh. */
function materialOf(mesh: THREE.Object3D): THREE.MeshStandardMaterial {
  return (mesh as THREE.Mesh).material as THREE.MeshStandardMaterial;
}

/** Every material the model draws with, each once. */
function materials(model: BeadsModel): Set<THREE.MeshStandardMaterial> {
  return new Set(meshes(model.group).map(materialOf));
}

/** The materials of bead `id`. */
function beadMaterials(model: BeadsModel, id: ProjectId): Set<THREE.MeshStandardMaterial> {
  return new Set(meshes(model.beads[id].root).map(materialOf));
}

/** The mesh of the display `id` that wears the screen. */
function screenOf(model: BeadsModel, id: ProjectId): THREE.Mesh {
  const display = objectNamed(model.beads[id].root, `bead_${id}_display`);
  const screen = meshes(display).find((o) => materialOf(o).emissiveMap);
  expect(screen, `${id}'s screen`).toBeDefined();
  return screen!;
}

/**
 * What three hands `onBeforeCompile`: the physical program's own shaders (MeshStandardMaterial and
 * MeshPhysicalMaterial both draw with it) and its uniforms. The material's patch runs on it as three would run it,
 * so a test reads the shader the material compiles to and the uniforms it adds.
 */
function compiled(material: THREE.Material): { uniforms: Record<string, THREE.IUniform>; vertexShader: string; fragmentShader: string } {
  const shader = {
    uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.physical.uniforms) as Record<string, THREE.IUniform>,
    vertexShader: THREE.ShaderLib.physical.vertexShader,
    fragmentShader: THREE.ShaderLib.physical.fragmentShader
  };
  material.onBeforeCompile(shader as unknown as Parameters<THREE.Material['onBeforeCompile']>[0], {} as THREE.WebGLRenderer);
  return shader;
}

/** The light a material of a bead draws at: its patch's `uBeadLight`. */
function lightOf(material: THREE.Material): number {
  const uniform = compiled(material).uniforms.uBeadLight;
  expect(uniform, material.name).toBeDefined();
  return uniform!.value as number;
}

/** The angle in radians between two directions. */
function angleBetween(a: THREE.Vector3, b: THREE.Vector3): number {
  return a.angleTo(b);
}

/** The turn in radians from one rotation to another, by atan2 (exact near no turn, where three's acos is not). */
function turnBetween(a: THREE.Quaternion, b: THREE.Quaternion): number {
  const d = a.clone().invert().multiply(b).normalize();
  return 2 * Math.atan2(Math.hypot(d.x, d.y, d.z), Math.abs(d.w));
}

/** Where bead `id`'s porthole faces, in the world: its root's +z. */
function facing(model: BeadsModel, id: ProjectId): THREE.Vector3 {
  model.group.updateMatrixWorld(true);
  return Z.clone().applyQuaternion(model.beads[id].root.getWorldQuaternion(new THREE.Quaternion()));
}

/** Everything a program is built from, for each material: a change to any of these after load is a compile. */
function programState(model: BeadsModel): string[] {
  return [...materials(model)].map((m) =>
    JSON.stringify({
      name: m.name,
      version: m.version,
      key: m.customProgramCacheKey(),
      defines: m.defines,
      maps: [m.map, m.emissiveMap, m.aoMap, m.roughnessMap, m.metalnessMap].map((t) => (t ? `${t.uuid}:${t.version}` : null)),
      transmission: (m as THREE.MeshPhysicalMaterial).transmission ?? null,
      transparent: m.transparent
    })
  );
}

const centre = (id: ProjectId) => new THREE.Vector3(...BEADS.find((b) => b.id === id)!.centre);

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------- the tests

describe('loading the beads', () => {
  it('names every missing part, and a part of the wrong kind', () => {
    for (const name of ['bead_jontai-energy_glass', 'bead_funcial_display', 'bead_cookies-clicker_inner', 'funcial_bead_5', 'funcial_track', 'jontai_cell_16', 'jontai_module', 'cookies_wheel_3', 'cookies_balance', 'bead_funcial']) {
      expect(() => build('high', { omit: name }), name).toThrow(TypeError);
      expect(() => build('high', { omit: name }), name).toThrow(new RegExp(`"${name}"`));
    }
    // The light must be a light, a mesh a mesh.
    for (const name of ['bead_funcial_inner', 'bead_jontai-energy_body', 'bead_cookies-clicker_glass', 'funcial_track', 'jontai_cell_4']) {
      expect(() => build('high', { swap: name }), name).toThrow(new RegExp(name));
    }
    expect(BEAD_PARTS).toEqual(['body', 'halo', 'rim', 'glass', 'display', 'object', 'inner']);
  });

  it('holds the three beads in one group, each placed at its journey stop, with its root and body for the pointer', () => {
    const { model } = build();
    expect(model.group.name).toBe('beads');
    expect(model.group.children.map((o) => o.name).sort()).toEqual(IDS.map((id) => `bead_${id}`).sort());
    for (const id of IDS) {
      const { root, body } = model.beads[id];
      expect(root.name).toBe(`bead_${id}`);
      expect(root.parent).toBe(model.group);
      expect(body.name).toBe(`bead_${id}_body`);
      expect(body.isMesh).toBe(true);
      expect(root.position.toArray()).toEqual(centre(id).toArray());
      expect(root.quaternion.toArray()).toEqual([0, 0, 0, 1]);
      // A ray at the porthole finds the bead.
      model.group.updateMatrixWorld(true);
      const ray = new THREE.Raycaster(centre(id).add(new THREE.Vector3(0, 0, 5)), new THREE.Vector3(0, 0, -1));
      expect(ray.intersectObject(body).length).toBeGreaterThan(0);
    }
    model.dispose();
  });

  it("leaves the glTF it was handed as it was: a copy is posed, and the file's materials are never drawn", () => {
    const { gltf, model } = build();
    const fileMaterials = new Set<THREE.Material>(Object.values(gltf.materials));
    expect(gltf.scene.children.map((o) => o.name).sort()).toEqual(IDS.map((id) => `bead_${id}`).sort());
    for (const o of meshes(gltf.scene)) expect(fileMaterials.has(materialOf(o))).toBe(true);
    for (const material of materials(model)) expect(fileMaterials.has(material)).toBe(false);
    expect(gltf.materials.glass.transmission).toBe(1);
    // A second load of the same glTF (drei caches one per URL) builds the same beads.
    const again = loadBeads(gltf, 'high', screens());
    expect(again.group.children).toHaveLength(3);
    again.dispose();
    model.dispose();
  });

  it('places the beads where it is told, and keeps each one\'s drift and turn on top', () => {
    const { model } = build();
    model.place({ funcial: [1, 2, 3], 'jontai-energy': [-4, -5, -6], 'cookies-clicker': [7, 8, 9] });
    expect(model.beads.funcial.root.position.toArray()).toEqual([1, 2, 3]);
    expect(model.beads['cookies-clicker'].root.position.toArray()).toEqual([7, 8, 9]);
    model.setForward('jontai-energy', 1);
    model.place({ funcial: [1, 2, 3], 'jontai-energy': [0, 0, 0], 'cookies-clicker': [7, 8, 9] });
    expect(model.beads['jontai-energy'].root.position.toArray()).toEqual([...CAMERA_PATH.bead.forward]);
    model.dispose();
  });
});

describe('the screens', () => {
  it("land on each bead's display as its emissive map, in white, so the screenshot shows its own colours", () => {
    const { model, shots } = build();
    for (const id of IDS) {
      const screen = screenOf(model, id);
      const material = materialOf(screen);
      expect(material.emissiveMap).toBe(shots[id]);
      expect(material.emissive.toArray()).toEqual([1, 1, 1]);
      expect(material.emissiveIntensity).toBe(BEADS_LOOK.screen.level);
      // The screen's UV has v = 0 at the top: the texture is not flipped, and it is colour.
      expect(shots[id].flipY).toBe(false);
      expect(shots[id].colorSpace).toBe(THREE.SRGBColorSpace);
      expect(shots[id].wrapS).toBe(THREE.ClampToEdgeWrapping);
      expect(shots[id].wrapT).toBe(THREE.ClampToEdgeWrapping);
      // Only the dark glass front wears it: the gold casing has none.
      const casing = objectNamed(model.beads[id].root, `bead_${id}_display_1`);
      expect(materialOf(casing).emissiveMap).toBeNull();
    }
    // Each display its own material: the file's one `bead:display` is shared by all three.
    expect(new Set(IDS.map((id) => materialOf(screenOf(model, id)))).size).toBe(3);
    model.dispose();
  });

  it("keeps the screenshot off the bezel: the emission is masked outside the screen's UV 0..1", () => {
    const { model } = build();
    const { fragmentShader } = compiled(materialOf(screenOf(model, 'funcial')));
    expect(fragmentShader).not.toContain('#include <emissivemap_fragment>');
    expect(fragmentShader).toMatch(/1\.0 - vEmissiveMapUv/);
    expect(fragmentShader).toContain('totalEmissiveRadiance *= emissiveColor.rgb * screenInside');
    model.dispose();
  });
});

describe('the materials', () => {
  it('gives every bead its own copy of every material it wears, so each is lit alone', () => {
    const { model } = build();
    const sets = IDS.map((id) => beadMaterials(model, id));
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) for (const m of sets[i]!) expect(sets[j]!.has(m)).toBe(false);
    model.dispose();
  });

  it("gives each of Jontai's 16 cells and Funcial's fifth abacus bead a material of its own; the first four share theirs", () => {
    const { model } = build();
    const jontai = model.beads['jontai-energy'].root;
    const cells = Array.from({ length: 16 }, (_, k) => materialOf(objectNamed(jontai, `jontai_cell_${k + 1}`)));
    expect(new Set(cells).size).toBe(16);
    for (const cell of cells) expect(cell.name).toBe('bead:cell');
    const funcial = model.beads.funcial.root;
    const abacusOf = (k: number) => meshes(objectNamed(funcial, `funcial_bead_${k}`)).map(materialOf).find((m) => m.name === 'bead:abacus')!;
    expect(new Set([1, 2, 3, 4].map(abacusOf)).size).toBe(1);
    expect(abacusOf(5)).not.toBe(abacusOf(1));
    model.dispose();
  });

  it('draws nothing before the haze: every part at render order 0 or after', () => {
    const { model } = build();
    model.group.traverse((o) => expect(o.renderOrder, o.name).toBeGreaterThanOrEqual(0));
    model.dispose();
  });
});

describe('the light', () => {
  it('builds every bead dim, at 0.15 of its light', () => {
    const { model } = build();
    for (const id of IDS) for (const m of beadMaterials(model, id)) expect(lightOf(m), `${id} ${m.name}`).toBeCloseTo(BEADS_LOOK.dim, 12);
    expect(BEADS_LOOK.dim).toBe(0.15);
    model.dispose();
  });

  it("setLit(id, t) lights the whole bead, linearly from 0.15 of its light at 0 to all of it at 1, and no other bead", () => {
    const { model } = build();
    model.setLit('jontai-energy', 1);
    for (const m of beadMaterials(model, 'jontai-energy')) expect(lightOf(m)).toBeCloseTo(1, 12);
    for (const m of beadMaterials(model, 'funcial')) expect(lightOf(m)).toBeCloseTo(0.15, 12);
    model.setLit('jontai-energy', 0.5);
    for (const m of beadMaterials(model, 'jontai-energy')) expect(lightOf(m)).toBeCloseTo(0.575, 12);
    model.setLit('jontai-energy', 0);
    for (const m of beadMaterials(model, 'jontai-energy')) expect(lightOf(m)).toBeCloseTo(0.15, 12);
    // Held to 0..1, NaN as 0.
    model.setLit('cookies-clicker', 3);
    for (const m of beadMaterials(model, 'cookies-clicker')) expect(lightOf(m)).toBeCloseTo(1, 12);
    model.setLit('cookies-clicker', Number.NaN);
    for (const m of beadMaterials(model, 'cookies-clicker')) expect(lightOf(m)).toBeCloseTo(0.15, 12);
    model.dispose();
  });

  it('scales all the light a surface sends, its emission included, just before it is written', () => {
    const { model } = build();
    for (const id of IDS) {
      for (const m of beadMaterials(model, id)) {
        const { fragmentShader } = compiled(m);
        expect(fragmentShader, m.name).toContain('uniform float uBeadLight;');
        // The glass writes its own (below, by tier); every other surface scales the light it has summed.
        if (m.name !== 'bead:glass') expect(fragmentShader, m.name).toContain('outgoingLight *= uBeadLight;\n#include <opaque_fragment>');
      }
    }
    model.dispose();
  });

  it('keeps the inner light: the bead dims by its surfaces, so the hollow is not dimmed twice', () => {
    const { model } = build();
    model.setLit('funcial', 0);
    const inner = objectNamed<THREE.PointLight>(model.beads.funcial.root, 'bead_funcial_inner');
    expect(inner.isPointLight).toBe(true);
    expect(inner.intensity).toBe(0.25);
    model.dispose();
  });
});

describe('the drift forward', () => {
  it('moves a bead along (-0.4, 0.4, 1.4) from its place, the journey\'s own drift, and no other', () => {
    const { model } = build();
    expect([...CAMERA_PATH.bead.forward]).toEqual([-0.4, 0.4, 1.4]);
    model.setForward('funcial', 1);
    const drift = new THREE.Vector3(...CAMERA_PATH.bead.forward);
    expect(model.beads.funcial.root.position.distanceTo(centre('funcial').add(drift))).toBeLessThan(1e-12);
    model.setForward('funcial', 0.25);
    expect(model.beads.funcial.root.position.distanceTo(centre('funcial').addScaledVector(drift, 0.25))).toBeLessThan(1e-12);
    expect(model.beads['jontai-energy'].root.position.toArray()).toEqual(centre('jontai-energy').toArray());
    model.setForward('funcial', Number.NaN);
    expect(model.beads.funcial.root.position.toArray()).toEqual(centre('funcial').toArray());
    model.dispose();
  });
});

describe('the hover', () => {
  it('brightens the bead a little and turns it toward the camera, at most 8 degrees', () => {
    const { model } = build();
    model.setLit('funcial', 1);
    const camera = centre('funcial').add(new THREE.Vector3(6, 2, 3));
    const toCamera = camera.clone().sub(centre('funcial')).normalize();
    const before = angleBetween(facing(model, 'funcial'), toCamera);
    model.setHover('funcial', 1, camera);
    for (const m of beadMaterials(model, 'funcial')) expect(lightOf(m)).toBeCloseTo(1 + BEADS_LOOK.hover.brighten, 12);
    expect(BEADS_LOOK.hover.brighten).toBeGreaterThan(0);
    expect(BEADS_LOOK.hover.brighten).toBeLessThanOrEqual(0.2);
    const after = angleBetween(facing(model, 'funcial'), toCamera);
    expect(before - after).toBeCloseTo(8 * DEG, 9);
    expect(angleBetween(facing(model, 'funcial'), Z)).toBeCloseTo(8 * DEG, 9);
    expect(BEADS_LOOK.hover.turn).toBeCloseTo(8 * DEG, 12);
    // The others stay as they were.
    for (const m of beadMaterials(model, 'jontai-energy')) expect(lightOf(m)).toBeCloseTo(0.15, 12);
    expect(angleBetween(facing(model, 'jontai-energy'), Z)).toBeLessThan(1e-9);
    model.dispose();
  });

  it('turns only as far as the camera is off its axis, and by default toward the bead shot\'s camera', () => {
    const { model } = build();
    // A camera 3 degrees off the axis: the bead turns 3 degrees and faces it.
    const near = centre('cookies-clicker').add(new THREE.Vector3(Math.sin(3 * DEG) * 6, 0, Math.cos(3 * DEG) * 6));
    model.setHover('cookies-clicker', 1, near);
    expect(angleBetween(facing(model, 'cookies-clicker'), near.clone().sub(centre('cookies-clicker')).normalize())).toBeLessThan(1e-9);
    // No camera: toward where the bead's own stop stands the camera, at CAMERA_PATH.bead.offset.
    model.setHover('cookies-clicker');
    const offset = new THREE.Vector3(...CAMERA_PATH.bead.offset).normalize();
    const face = facing(model, 'cookies-clicker');
    expect(angleBetween(face, Z)).toBeCloseTo(Math.min(8 * DEG, angleBetween(offset, Z)), 9);
    expect(angleBetween(face, offset)).toBeLessThan(angleBetween(Z, offset));
    model.dispose();
  });

  it('takes a null point as no point at all, as it takes none given: toward the bead shot\'s camera', () => {
    const { model } = build();
    model.setHover('cookies-clicker');
    const byDefault = facing(model, 'cookies-clicker').clone();
    const near = centre('cookies-clicker').add(new THREE.Vector3(Math.sin(3 * DEG) * 6, 0, Math.cos(3 * DEG) * 6));
    model.setHover('cookies-clicker', 1, near);
    model.setHover('cookies-clicker', 1, null as unknown as undefined);
    expect(angleBetween(facing(model, 'cookies-clicker'), byDefault)).toBeLessThan(1e-9);
    model.dispose();
  });

  it('eases with the amount it is given, and lets go of every bead on null', () => {
    const { model } = build();
    const camera = centre('jontai-energy').add(new THREE.Vector3(-5, 0, 2));
    model.setHover('jontai-energy', 0.5, camera);
    expect(angleBetween(facing(model, 'jontai-energy'), Z)).toBeCloseTo(4 * DEG, 9);
    for (const m of beadMaterials(model, 'jontai-energy')) expect(lightOf(m)).toBeCloseTo(0.15 * (1 + 0.5 * BEADS_LOOK.hover.brighten), 12);
    // One bead at a time: hovering another lets the first go.
    model.setHover('funcial', 1, camera);
    expect(angleBetween(facing(model, 'jontai-energy'), Z)).toBeLessThan(1e-9);
    model.setHover(null);
    for (const id of IDS) {
      expect(angleBetween(facing(model, id), Z)).toBeLessThan(1e-9);
      for (const m of beadMaterials(model, id)) expect(lightOf(m)).toBeCloseTo(0.15, 12);
    }
    // NaN as no hover.
    model.setHover('funcial', Number.NaN, camera);
    expect(angleBetween(facing(model, 'funcial'), Z)).toBeLessThan(1e-9);
    model.dispose();
  });

  it('keeps the turn toward the camera as the bead drifts forward', () => {
    const { model } = build();
    const camera = centre('funcial').add(new THREE.Vector3(...CAMERA_PATH.bead.forward)).add(new THREE.Vector3(0.3, 0, 6));
    model.setHover('funcial', 1, camera);
    model.setForward('funcial', 1);
    const toCamera = camera.clone().sub(model.beads.funcial.root.position).normalize();
    expect(angleBetween(facing(model, 'funcial'), toCamera)).toBeLessThan(1e-9);
    model.dispose();
  });
});

describe("the objects' motion", () => {
  it("is each object's rest pose at time 0, as the file has it", () => {
    const { gltf, model } = build();
    for (const name of ['funcial_platter', 'jontai_module', 'cookies_wheel_1', 'cookies_balance', 'funcial_bead_3']) {
      const file = objectNamed(gltf.scene, name);
      const posed = objectNamed(model.group, name);
      expect(turnBetween(posed.quaternion, file.quaternion), name).toBeLessThan(1e-12);
      expect(posed.position.distanceTo(file.position), name).toBeLessThan(1e-12);
    }
    model.dispose();
  });

  it("turns Funcial's platter about its own up, runs the pulse along the track and slides the abacus beads up their rods", () => {
    const { gltf, model } = build();
    const t = 1.3;
    const motion = funcialMotion(t);
    model.setMotion('funcial', t);
    const platter = objectNamed(model.group, 'funcial_platter');
    const rest = objectNamed(gltf.scene, 'funcial_platter').quaternion;
    expect(turnBetween(platter.quaternion, rest.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Y, motion.platter)))).toBeLessThan(1e-12);
    // three's XYZ order: rotation.y is the turn and x keeps the lean.
    expect(platter.rotation.y).toBeCloseTo(motion.platter, 9);
    const track = materialOf(objectNamed(model.group, 'funcial_track'));
    const { uniforms, vertexShader, fragmentShader } = compiled(track);
    expect(uniforms.uBeadPulse!.value.x).toBeCloseTo(motion.pulse, 12);
    expect(vertexShader).toContain('vBeadTrackU = uv.x;');
    expect(fragmentShader).toContain('uBeadPulse');
    for (let k = 1; k <= 5; k++) {
      const bead = objectNamed(model.group, `funcial_bead_${k}`);
      expect(bead.position.y, `bead ${k}`).toBeCloseTo(0.085 + motion.abacus[k - 1]! * BEADS_LOOK.funcial.travel, 12);
    }
    expect(BEADS_LOOK.funcial.travel).toBe(0.3);
    model.dispose();
  });

  it("slides Funcial's abacus, and lights its fifth bead, by a clock of its own where one is given, the platter and the pulse by the time", () => {
    const { gltf, model } = build();
    const time = 7.3;
    const slide = 0.9;
    model.setMotion('funcial', time, slide);
    const byTime = funcialMotion(time);
    const bySlide = funcialMotion(slide);
    const platter = objectNamed(model.group, 'funcial_platter');
    const rest = objectNamed(gltf.scene, 'funcial_platter').quaternion;
    expect(turnBetween(platter.quaternion, rest.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Y, byTime.platter)))).toBeLessThan(1e-12);
    expect(compiled(materialOf(objectNamed(model.group, 'funcial_track'))).uniforms.uBeadPulse!.value.x).toBeCloseTo(byTime.pulse, 12);
    for (let k = 1; k <= 5; k++) {
      expect(objectNamed(model.group, `funcial_bead_${k}`).position.y, `bead ${k}`).toBeCloseTo(0.085 + bySlide.abacus[k - 1]! * BEADS_LOOK.funcial.travel, 12);
    }
    const fifth = meshes(objectNamed(model.group, 'funcial_bead_5')).map(materialOf).find((m) => m.name === 'bead:abacus')!;
    expect(fifth.emissiveIntensity).toBeCloseTo(BEADS_LOOK.funcial.result.glow * bySlide.abacus[4]!, 12);
    // The other beads have no such clock: it changes nothing of theirs.
    model.setMotion('cookies-clicker', 2.05, 0);
    expect(objectNamed(model.group, 'cookies_wheel_1').rotation.z).toBeCloseTo(cookiesMotion(2.05).wheels[0]!, 9);
    model.dispose();
  });

  it('lights the fifth abacus bead, RESULT, as it arrives, and only it', () => {
    const { model } = build();
    const fifth = () => meshes(objectNamed(model.group, 'funcial_bead_5')).map(materialOf).find((m) => m.name === 'bead:abacus')!;
    const first = () => meshes(objectNamed(model.group, 'funcial_bead_1')).map(materialOf).find((m) => m.name === 'bead:abacus')!;
    model.setMotion('funcial', 0);
    expect(fifth().emissiveIntensity).toBe(0);
    model.setMotion('funcial', 1.0);
    expect(fifth().emissiveIntensity).toBe(0);
    model.setMotion('funcial', 2.0);
    expect(fifth().emissiveIntensity).toBeCloseTo(BEADS_LOOK.funcial.result.glow, 12);
    expect(fifth().emissive.getHex()).not.toBe(0);
    expect(first().emissive.getHex()).toBe(0);
    model.dispose();
  });

  it("charges Jontai's cells in page order and tilts the module about its own x, from its rest", () => {
    const { gltf, model } = build();
    const t = 3.1;
    const motion = jontaiMotion(t);
    model.setMotion('jontai-energy', t);
    const module = objectNamed(model.group, 'jontai_module');
    const rest = objectNamed(gltf.scene, 'jontai_module').quaternion;
    expect(turnBetween(module.quaternion, rest.clone().multiply(new THREE.Quaternion().setFromAxisAngle(X, motion.tilt)))).toBeLessThan(1e-12);
    expect(Math.abs(motion.tilt)).toBeGreaterThan(1 * DEG);
    for (let k = 0; k < 16; k++) {
      const cell = materialOf(objectNamed(model.group, `jontai_cell_${k + 1}`));
      expect(cell.emissiveIntensity, `cell ${k + 1}`).toBeCloseTo(1 + (BEADS_LOOK.jontai.charged - 1) * motion.cells[k]!, 12);
    }
    expect(motion.cells[0]).toBe(1);
    expect(motion.cells[15]).toBeLessThan(1);
    model.dispose();
  });

  it("turns Cookies' eight wheels and swings its balance, each about its own z", () => {
    const { model } = build();
    const t = 4.05;
    const motion = cookiesMotion(t);
    model.setMotion('cookies-clicker', t);
    for (let k = 0; k < 8; k++) {
      const wheel = objectNamed(model.group, `cookies_wheel_${k + 1}`);
      expect(turnBetween(wheel.quaternion, new THREE.Quaternion().setFromAxisAngle(Z, motion.wheels[k]!))).toBeLessThan(1e-12);
    }
    const balance = objectNamed(model.group, 'cookies_balance');
    expect(balance.rotation.z).toBeCloseTo(motion.balance, 9);
    // The escapement, the barrel and the crown hold still: the brief's motion does not drive them.
    expect(objectNamed(model.group, 'cookies_escapement').quaternion.toArray()).toEqual([0, 0, 0, 1]);
    expect(objectNamed(model.group, 'cookies_crown').position.x).toBe(0.2);
    model.dispose();
  });

  it('moves only the bead it is asked to', () => {
    const { gltf, model } = build();
    model.setMotion('cookies-clicker', 2.05);
    expect(objectNamed(model.group, 'funcial_platter').rotation.y).toBe(0);
    expect(objectNamed(model.group, 'jontai_module').quaternion.toArray()).toEqual(objectNamed(gltf.scene, 'jontai_module').quaternion.toArray());
    expect(objectNamed(model.group, 'cookies_wheel_2').rotation.z).not.toBe(0);
    model.dispose();
  });

  it('compiles nothing: every per-frame setter leaves each program as it was', () => {
    const { model } = build();
    const before = programState(model);
    const camera = new THREE.Vector3(3, -4, 6);
    for (let i = 0; i < 30; i++) {
      const t = i * 0.37;
      for (const id of IDS) {
        model.setMotion(id, t);
        model.setLit(id, (i % 7) / 6);
        model.setForward(id, (i % 5) / 4);
      }
      model.setHover(IDS[i % 3]!, (i % 4) / 3, camera);
      model.setHover(null);
    }
    expect(programState(model)).toEqual(before);
    model.dispose();
  });
});

describe('the glass by tier', () => {
  const glassOf = (model: BeadsModel, id: ProjectId) => materialOf(objectNamed(model.beads[id].root, `bead_${id}_glass`)) as unknown as THREE.MeshPhysicalMaterial;

  it('never runs three\'s transmission pass: no tier\'s glass is transmissive', () => {
    for (const tier of ['high', 'medium', 'low'] as const) {
      const { model } = build(tier);
      for (const m of materials(model)) expect((m as THREE.MeshPhysicalMaterial).transmission ?? 0, `${tier} ${m.name}`).toBe(0);
      model.dispose();
    }
  });

  it('on high, a cheap transmissive look: the reflection whole over the hollow, which the glass hides only a little', () => {
    const { model } = build('high');
    for (const id of IDS) {
      const glass = glassOf(model, id);
      expect(glass.transparent).toBe(true);
      expect(glass.depthWrite).toBe(false);
      expect(glass.blending).toBe(THREE.CustomBlending);
      expect(glass.blendSrc).toBe(THREE.OneFactor);
      expect(glass.blendDst).toBe(THREE.OneMinusSrcAlphaFactor);
      expect(glass.opacity).toBe(BEADS_LOOK.glass.high.opacity);
      expect(glass.specularIntensity).toBe(0.25);
      const { fragmentShader } = compiled(glass);
      // Its own reflection, not multiplied by its alpha; no mirror of the key light (the hot fleck), only the room's.
      expect(fragmentShader).toContain('vec3 totalSpecular = reflectedLight.indirectSpecular;');
      expect(fragmentShader).toMatch(/gl_FragColor = vec4\( \( totalSpecular \+ totalEmissiveRadiance \) \* uBeadLight, glassAlpha \)/);
    }
    model.dispose();
  });

  it('below high, plain transparent glass', () => {
    for (const tier of ['medium', 'low'] as const) {
      const { model } = build(tier);
      for (const id of IDS) {
        const glass = glassOf(model, id);
        expect(glass.transparent).toBe(true);
        expect(glass.depthWrite).toBe(false);
        expect(glass.blending).toBe(THREE.NormalBlending);
        expect(glass.opacity).toBe(BEADS_LOOK.glass.plain.opacity);
        const { fragmentShader } = compiled(glass);
        expect(fragmentShader).toContain('vec3 totalSpecular = reflectedLight.indirectSpecular;');
        expect(fragmentShader).not.toContain('glassAlpha');
      }
      model.dispose();
    }
  });

  it('steps down once, to the glass a model built for that tier has, compiling the glass alone, and never climbs back', () => {
    const { model } = build('high');
    const others = [...materials(model)].filter((m) => m.name !== 'bead:glass');
    const versions = others.map((m) => m.version);
    const glassVersions = IDS.map((id) => glassOf(model, id).version);
    model.setTier('high');
    expect(IDS.map((id) => glassOf(model, id).version)).toEqual(glassVersions);
    model.setTier('medium');
    const medium = build('medium').model;
    for (const id of IDS) {
      const stepped = glassOf(model, id);
      const built = glassOf(medium, id);
      expect(stepped.version).toBeGreaterThan(glassVersions[IDS.indexOf(id)]!);
      for (const key of ['blending', 'opacity', 'transparent', 'depthWrite'] as const) expect(stepped[key], key).toBe(built[key]);
      expect(stepped.customProgramCacheKey()).toBe(built.customProgramCacheKey());
      expect(compiled(stepped).fragmentShader).toBe(compiled(built).fragmentShader);
    }
    expect(others.map((m) => m.version)).toEqual(versions);
    const stepped = IDS.map((id) => glassOf(model, id).version);
    model.setTier('low');
    model.setTier('high');
    expect(IDS.map((id) => glassOf(model, id).version)).toEqual(stepped);
    expect(glassOf(model, 'funcial').blending).toBe(THREE.NormalBlending);
    medium.dispose();
    model.dispose();
  });
});

describe('dispose', () => {
  it('frees every material it made, once, and nothing it was handed: the glTF and the screens stay the caller\'s', () => {
    const { gltf, shots, model } = build();
    const made = [...materials(model)];
    const spies = made.map((m) => vi.spyOn(m, 'dispose'));
    const fileSpies = Object.values(gltf.materials).map((m) => vi.spyOn(m, 'dispose'));
    const shotSpies = Object.values(shots).map((t) => vi.spyOn(t, 'dispose'));
    const geometrySpies = gltf.geometries.map((g) => vi.spyOn(g, 'dispose'));
    const veinSpy = vi.spyOn(gltf.materials.lacquer.emissiveMap!, 'dispose');
    model.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalledOnce();
    for (const spy of [...fileSpies, ...shotSpies, ...geometrySpies, veinSpy]) expect(spy).not.toHaveBeenCalled();
    // Each bead's own copies with the fifth bead's and the cells': Funcial 7 + 1, Jontai 8 + 16, Cookies 8.
    expect(made).toHaveLength(40);
  });

  it('frees the glass it stepped down from too', () => {
    const { model } = build('high');
    const glass = IDS.map((id) => materialOf(objectNamed(model.beads[id].root, `bead_${id}_glass`)));
    const spies = glass.map((m) => vi.spyOn(m, 'dispose'));
    model.setTier('low');
    model.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalledOnce();
  });
});

describe('the real GLB', () => {
  /** The beads GLB through three's own GLTFLoader, its two embedded PNGs decoded by a stand-in (Node has no image decoder). */
  async function loadRealGlb() {
    vi.stubGlobal('self', globalThis);
    vi.stubGlobal('createImageBitmap', async () => ({ width: 1, height: 1, close() {} }));
    const bytes = readFileSync('public/models/bob-beads.glb');
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    return new Promise<{ scene: THREE.Group }>((resolve, reject) => new GLTFLoader().parse(buffer, '', resolve, reject));
  }

  it('finds every node and material it names in the file, and poses the file\'s parts', async () => {
    const gltf = await loadRealGlb();
    const model = loadBeads(gltf, 'high', screens());
    for (const id of IDS) {
      expect(materialOf(screenOf(model, id)).emissiveMap?.name).toBe(`screen:${id}`);
      const inner = objectNamed<THREE.PointLight>(model.beads[id].root, `bead_${id}_inner`);
      expect(inner.isPointLight).toBe(true);
      // The root's own child, with no children: the Void hides a bead by its other children and keeps the light lit.
      expect(inner.parent).toBe(model.beads[id].root);
      expect(inner.children).toEqual([]);
      expect(inner.castShadow).toBe(false);
    }
    // funcial_bead_k is the abacus's own child (GLTFLoader also names a bead's gold band "funcial_bead_1").
    const funcial = model.beads.funcial.root;
    for (let k = 1; k <= 5; k++) {
      const bead = objectNamed(funcial, `funcial_bead_${k}`);
      expect(bead.parent?.name).toBe('funcial_abacus');
      expect(bead.position.y).toBeCloseTo(0.085, 6);
    }
    expect(new Set([1, 2, 3, 4, 5].map((k) => meshes(objectNamed(funcial, `funcial_bead_${k}`)).map(materialOf).find((m) => m.name === 'bead:abacus'))).size).toBe(2);
    model.setLit('funcial', 1);
    for (const id of IDS) model.setMotion(id, 2.03);
    expect(objectNamed(model.group, 'funcial_bead_5').position.y).toBeCloseTo(0.085 + BEADS_LOOK.funcial.travel, 6);
    expect(objectNamed(model.group, 'cookies_wheel_1').rotation.z).toBeCloseTo(cookiesMotion(2.03).wheels[0]!, 9);
    // The file's glass is transmissive; none of the model's is.
    for (const m of materials(model)) expect((m as THREE.MeshPhysicalMaterial).transmission ?? 0).toBe(0);
    model.dispose();
  });
});

describe("the builder's colours", () => {
  it('names no colour by bare numbers: the palette gives the fifth bead its gold', () => {
    const source = readFileSync(fileURLToPath(new URL('../../../src/engine/bob/build/beads.ts', import.meta.url)), 'utf8');
    expect(source).not.toMatch(/\b0x[0-9a-f]{6}\b/i);
    expect(source).not.toMatch(/Color\(\s*[\d.]+\s*,/);
  });
});
