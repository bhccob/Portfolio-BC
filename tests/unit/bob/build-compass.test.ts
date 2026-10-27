import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it, vi } from 'vitest';
import { bandStrip, COMPASS_LOOK, COMPASS_PARTS, loadCompass, type CompassModel } from '~/engine/bob/build/compass';
import { buildProbe, PROBE_LOOK, PROBE_RENDER_ORDER, type ProbeModel } from '~/engine/bob/build/probe';
import { buildSmoke, SMOKE_LOOK, SMOKE_RENDER_ORDER, type SmokeModel } from '~/engine/bob/build/smoke';
import { BAND_STRIP, type StripContext } from '~/engine/bob/paintBand';
import { palette } from '~/engine/palette';
import { damp } from 'maath/easing';
import { AngleSpring, wrapAngle } from '~/engine/AngleSpring';
import { aimsAt, NEEDLE_SPRING, needleAngleAt } from '~/engine/bob/needleAim';
import { moveTarget } from '~/input/target';
import { BEADS, journeyPoseAt, type NeedleOverride } from '~/scene/bob/journey';
import { needleFor } from '~/scene/bob/voidPose';
import { placeOfFrame } from '~/state/chapters';
import { riseAt, scrollPoseAt } from '~/scene/bob/scrollPose';
import { HOME_CHAPTERS } from '~/state/chapters';

const Y = new THREE.Vector3(0, 1, 0);
const DEG = Math.PI / 180;

/** The object called `name` under `root`, which must exist. */
function objectNamed(root: THREE.Object3D, name: string): THREE.Object3D {
  const found = root.getObjectByName(name);
  expect(found, name).toBeDefined();
  return found as THREE.Object3D;
}

/** The compass's part called `name`. */
function node(c: CompassModel, name: string): THREE.Object3D {
  return objectNamed(c.group, name);
}

/** The compass's mesh called `name`. */
function mesh(c: CompassModel, name: string): THREE.Mesh {
  return node(c, name) as THREE.Mesh;
}

/** Where the needle's tip points in the world, its rest pointing up the screen (+Y). */
function tipDirection(c: CompassModel): THREE.Vector3 {
  c.group.updateMatrixWorld(true);
  return Y.clone().transformDirection(node(c, 'needle').matrixWorld);
}

/** Where band `k`'s own axis (its local Y, round which it lies and turns) and its local X point in the world. */
function bandAxes(c: CompassModel, k: number): { up: THREE.Vector3; across: THREE.Vector3 } {
  c.group.updateMatrixWorld(true);
  const world = node(c, `band_${k}`).matrixWorld;
  return { up: Y.clone().transformDirection(world), across: new THREE.Vector3(1, 0, 0).transformDirection(world) };
}

/** The glass of the first band. */
function bandMaterial(c: CompassModel, k = 1): THREE.MeshPhysicalMaterial {
  return mesh(c, `band_${k}`).material as THREE.MeshPhysicalMaterial;
}

/** The bands' rest tilts, made up but not upright, as the GLB's are. */
const TILTS: [number, number, number][] = [
  [90, 0, 62],
  [90, 0, -35],
  [55, 0, -20],
  [14, -6, 0]
];

/** How long the GLB's rise runs: 52 frames at 24 fps. */
const RISE = 52 / 24;

/** The fake's band radii, band_1..band_4: each a ring that far from its axis, in the middle of its wall. */
const FAKE_RADII = [1.4, 1.44, 1.48, 1.52];

/** The real GLB's band radii, band_1..band_4 (tools/blender/export_compass.py's RINGS, the preview's). */
const GLB_RADII = [1.52, 1.46, 1.4, 1.56];

/** The world's down. */
const DOWN = new THREE.Vector3(0, -1, 0);

/** 3x² - 2x³, the ease the iris and the dip take. */
const smooth = (x: number) => x * x * (3 - 2 * x);

/**
 * A scene graph made to look like the GLB as GLTFLoader hands it over: an
 * `armillary` holding the four tilted bands (each with its rim), the needle,
 * the pivot and the axis, every part a mesh with its own geometry and the
 * loader's one default material, and a `rise` clip on the armillary from 3.25
 * below and 50 degrees round to rest. `omit` leaves one part out, `clip: false`
 * the clip, and `grouped` makes one part a Group holding its mesh, as
 * GLTFLoader hands over a mesh of two primitives.
 */
function fakeGltf(options: { omit?: string; clip?: boolean; grouped?: string } = {}): { scene: THREE.Group; animations: THREE.AnimationClip[] } {
  const scene = new THREE.Group();
  scene.name = 'Scene';
  const fallback = new THREE.MeshStandardMaterial({ name: 'gltf:default' });
  const add = <T extends THREE.Object3D>(name: string, parent: THREE.Object3D, object: T): THREE.Object3D => {
    if (name === options.omit) return parent;
    if (name === options.grouped) {
      const holder = new THREE.Group();
      holder.name = name;
      holder.quaternion.copy(object.quaternion);
      object.name = `${name}_primitive`;
      holder.add(object);
      parent.add(holder);
      return holder;
    }
    object.name = name;
    parent.add(object);
    return object;
  };
  const part = () => new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), fallback);
  const armillary = add('armillary', scene, new THREE.Object3D());
  TILTS.forEach(([x, y, z], i) => {
    // Laid in its local XZ plane, round its local Y, as the GLB's bands are (three's torus lies in XY).
    const band = new THREE.Mesh(new THREE.TorusGeometry(FAKE_RADII[i], 0.02, 4, 32).rotateX(Math.PI / 2), fallback);
    band.rotation.set(x * DEG, y * DEG, z * DEG);
    const parent = add(`band_${i + 1}`, armillary, band);
    add(`rim_${i + 1}`, parent, part());
  });
  add('needle', armillary, part());
  add('pivot', armillary, part());
  add('axis', armillary, part());
  const turned = new THREE.Quaternion().setFromAxisAngle(Y, -50 * DEG);
  const animations =
    options.clip === false
      ? []
      : [
          // Its length worked out from its keys (-1), as GLTFLoader's clips are: the keys are float32, a hair past RISE.
          new THREE.AnimationClip('rise', -1, [
            new THREE.VectorKeyframeTrack('armillary.position', [0, RISE], [0, -3.25, 0, 0, 0, 0]),
            new THREE.QuaternionKeyframeTrack('armillary.quaternion', [0, RISE], [...turned.toArray(), 0, 0, 0, 1])
          ])
        ];
  return { scene, animations };
}

/** A strip as a test hands it over: a plain texture, no canvas, set up the way GLTFLoader sets its own (flipY off). */
function stripStub(band: number): THREE.Texture {
  const texture = new THREE.Texture();
  texture.name = `strip:${band}`;
  texture.flipY = false;
  return texture;
}

/** The angle in radians a quaternion turns through (by atan2, which stays exact near no turn, where acos does not). */
function angleOf(q: THREE.Quaternion): number {
  return 2 * Math.atan2(Math.hypot(q.x, q.y, q.z), Math.abs(q.w));
}

/** The real compass GLB, through three's own GLTFLoader. */
function loadRealGlb(): Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }> {
  const bytes = readFileSync('public/models/bob-compass.glb');
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return new Promise((resolve, reject) => new GLTFLoader().parse(buffer, '', resolve, reject));
}

describe('the compass', () => {
  it('names a missing part', () => {
    expect(() => loadCompass(fakeGltf({ omit: 'needle' }), 'high', stripStub)).toThrow(/needle/);
    expect(() => loadCompass(fakeGltf({ omit: 'needle' }), 'high', stripStub)).toThrow(TypeError);
    expect(() => loadCompass(fakeGltf({ omit: 'rim_3' }), 'high', stripStub)).toThrow(/rim_3/);
    expect(() => loadCompass(fakeGltf({ omit: 'armillary' }), 'high', stripStub)).toThrow(/armillary/);
    expect(() => loadCompass(fakeGltf({ clip: false }), 'high', stripStub)).toThrow(/rise/);
    expect(COMPASS_PARTS).toEqual(['armillary', 'band_1', 'band_2', 'band_3', 'band_4', 'rim_1', 'rim_2', 'rim_3', 'rim_4', 'needle', 'pivot', 'axis']);
  });

  it('names a part that is not one mesh, as a re-export with two primitives would hand over', () => {
    expect(() => loadCompass(fakeGltf({ grouped: 'band_2' }), 'high', stripStub)).toThrow(TypeError);
    expect(() => loadCompass(fakeGltf({ grouped: 'band_2' }), 'high', stripStub)).toThrow(/band_2/);
    expect(() => loadCompass(fakeGltf({ grouped: 'needle' }), 'high', stripStub)).toThrow(/needle/);
    expect(() => loadCompass(fakeGltf({ grouped: 'rim_4' }), 'high', stripStub)).toThrow(/rim_4/);
    // The armillary is an empty in the file: it need not be a mesh.
    expect(() => loadCompass(fakeGltf(), 'high', stripStub).dispose()).not.toThrow();
  });

  it('rises from the clip and rests at the home height', () => {
    const c = loadCompass(fakeGltf(), 'high', stripStub);
    c.setRise(0);
    expect(node(c, 'armillary').position.y).toBeCloseTo(-3.25 + 0.55, 3);
    c.setRise(1);
    expect(node(c, 'armillary').position.y).toBeCloseTo(0.55, 3);
    c.dispose();
  });

  it('samples the rise at t times its length, turning with it, the same pose for the same t however it is reached', () => {
    expect(COMPASS_LOOK.homeY).toBe(0.55);
    const c = loadCompass(fakeGltf(), 'high', stripStub);
    const armillary = node(c, 'armillary');
    c.setRise(0);
    expect(angleOf(armillary.quaternion)).toBeCloseTo(50 * DEG, 5);
    expect(new THREE.Vector3(0, 0, 1).applyQuaternion(armillary.quaternion).x).toBeCloseTo(-Math.sin(50 * DEG), 5);
    c.setRise(0.5);
    expect(armillary.position.y).toBeCloseTo(-3.25 / 2 + 0.55, 5);
    expect(angleOf(armillary.quaternion)).toBeCloseTo(25 * DEG, 5);
    // The home height is added once, however often the same moment is asked for.
    c.setRise(1);
    c.setRise(1);
    expect(armillary.position.y).toBeCloseTo(0.55, 9);
    expect(angleOf(armillary.quaternion)).toBeCloseTo(0, 6);
    // Back down after reaching the top: the clip is sampled, not played to its end and held.
    c.setRise(0.5);
    expect(armillary.position.y).toBeCloseTo(-3.25 / 2 + 0.55, 5);
    c.setRise(0.25);
    c.setRise(0.25);
    expect(armillary.position.y).toBeCloseTo(-3.25 * 0.75 + 0.55, 5);
    // Held to 0..1, and NaN reads as 0.
    c.setRise(4);
    expect(armillary.position.y).toBeCloseTo(0.55, 9);
    c.setRise(-1);
    expect(armillary.position.y).toBeCloseTo(-2.7, 5);
    c.setRise(1);
    c.setRise(Number.NaN);
    expect(armillary.position.y).toBeCloseTo(-2.7, 5);
    c.dispose();
  });

  it('turns the needle clockwise as the camera sees it', () => {
    const c = loadCompass(fakeGltf(), 'high', stripStub);
    c.setNeedle(Math.PI / 2);
    expect(tipDirection(c)).toEqual(expect.objectContaining({ x: expect.closeTo(1, 3), y: expect.closeTo(0, 3) }));
    c.dispose();
  });

  it('turns the needle about the view axis only: up at 0, left at minus a quarter, and NaN reads as up', () => {
    const c = loadCompass(fakeGltf(), 'high', stripStub);
    c.setNeedle(0);
    expect(tipDirection(c)).toEqual(expect.objectContaining({ x: expect.closeTo(0, 6), y: expect.closeTo(1, 6), z: expect.closeTo(0, 6) }));
    c.setNeedle(-Math.PI / 2);
    expect(tipDirection(c)).toEqual(expect.objectContaining({ x: expect.closeTo(-1, 6), y: expect.closeTo(0, 6) }));
    c.setNeedle((38 * Math.PI) / 180);
    const tip = tipDirection(c);
    expect(tip.z).toBeCloseTo(0, 9);
    expect(Math.atan2(tip.x, tip.y)).toBeCloseTo((38 * Math.PI) / 180, 9);
    c.setNeedle(Number.NaN);
    expect(tipDirection(c).y).toBeCloseTo(1, 9);
    c.dispose();
  });

  it('turns the needle about the world Z while the rise has the armillary turned, set before or after the rise', () => {
    const c = loadCompass(fakeGltf(), 'high', stripStub);
    c.setRise(0.25);
    // The armillary is turned well away from its rest here (37.5 degrees about Y).
    expect(angleOf(node(c, 'armillary').quaternion)).toBeCloseTo(37.5 * DEG, 5);
    c.setNeedle(Math.PI / 2);
    expect(tipDirection(c)).toEqual(expect.objectContaining({ x: expect.closeTo(1, 6), y: expect.closeTo(0, 6), z: expect.closeTo(0, 6) }));
    // The rise moves on under a set needle, and the needle holds its bearing on screen.
    c.setRise(0);
    expect(tipDirection(c)).toEqual(expect.objectContaining({ x: expect.closeTo(1, 6), y: expect.closeTo(0, 6), z: expect.closeTo(0, 6) }));
    c.setNeedle(-Math.PI / 4);
    expect(tipDirection(c)).toEqual(expect.objectContaining({ x: expect.closeTo(-Math.SQRT1_2, 6), y: expect.closeTo(Math.SQRT1_2, 6), z: expect.closeTo(0, 6) }));
    c.setRise(1);
    expect(tipDirection(c)).toEqual(expect.objectContaining({ x: expect.closeTo(-Math.SQRT1_2, 6), y: expect.closeTo(Math.SQRT1_2, 6), z: expect.closeTo(0, 6) }));
    c.dispose();
  });

  it('uses a cheaper glass below the high tier', () => {
    expect(bandMaterial(loadCompass(fakeGltf(), 'medium', stripStub)).transmission).toBe(0.6);
    expect(bandMaterial(loadCompass(fakeGltf(), 'high', stripStub)).transmission).toBe(1);
  });

  it('gives the low tier plain see-through glass of the same tint, so no transmission pass runs', () => {
    const tiers = (['high', 'medium', 'low'] as const).map((tier) => [tier, loadCompass(fakeGltf(), tier, stripStub)] as const);
    for (const [tier, c] of tiers) {
      for (const k of [1, 2, 3, 4]) {
        const glass = bandMaterial(c, k);
        expect(glass.transparent, tier).toBe(true);
        expect(glass.color.getHex(), tier).toBe(palette.lilac);
        expect(glass.transmission, tier).toBe({ high: 1, medium: 0.6, low: 0 }[tier]);
        expect(glass.opacity, tier).toBe({ high: 1, medium: 1, low: 0.35 }[tier]);
        // Four bands round one centre cannot be sorted: thin glass that wrote depth would hide the bands behind it.
        expect(glass.depthWrite, tier).toBe(tier !== 'low');
      }
      c.dispose();
    }
    expect(COMPASS_LOOK.bandGlass.transmission).toEqual({ high: 1, medium: 0.6, low: 0 });
    expect(COMPASS_LOOK.bandGlass.opacity).toEqual({ high: 1, medium: 1, low: 0.35 });
  });

  // Task 12: the preview's glass is a pale lavender (lilac, the nearest token) glowing blue-violet (the haze); the
  // palette's violet tinted the bands a deep magenta purple.
  it('makes each band smoked lavender glass: transmissive, glossy, iridescent, a faint blue-violet light of its own', () => {
    const c = loadCompass(fakeGltf(), 'high', stripStub);
    for (const k of [1, 2, 3, 4]) {
      const glass = bandMaterial(c, k);
      expect(glass).toBeInstanceOf(THREE.MeshPhysicalMaterial);
      expect(glass.color.getHex()).toBe(palette.lilac);
      expect(glass.roughness).toBe(0.04);
      expect(glass.metalness).toBe(0);
      expect(glass.ior).toBe(1.5);
      expect(glass.thickness).toBe(0.045);
      expect(glass.iridescence).toBe(0.35);
      expect(glass.emissive.getHex()).toBe(palette.haze);
      expect(glass.emissiveIntensity).toBe(0.06);
      // A closed solid: its front faces are enough, and three skips the back-face transmission pass.
      expect(glass.side).toBe(THREE.FrontSide);
      expect(glass.depthWrite).toBe(true);
    }
    // Four bands, four materials (each carries its own strip), one program.
    const materials = new Set([1, 2, 3, 4].map((k) => bandMaterial(c, k)));
    expect(materials.size).toBe(4);
    expect(new Set([...materials].map((m) => m.customProgramCacheKey())).size).toBe(1);
    c.dispose();
  });

  it("engraves each band with its own strip, kept flipY so the band's bottom edge reads the painter's bottom", () => {
    const asked: number[] = [];
    const made: THREE.Texture[] = [];
    const c = loadCompass(fakeGltf(), 'high', (band) => {
      asked.push(band);
      const texture = stripStub(band);
      made.push(texture);
      return texture;
    });
    // paintBandStrip numbers the bands 0..3: band_1 is strip 0.
    expect(asked).toEqual([0, 1, 2, 3]);
    for (const k of [1, 2, 3, 4]) {
      const map = bandMaterial(c, k).emissiveMap!;
      expect(map).toBe(made[k - 1]);
      // The GLB's v is 0 at a band's bottom edge, and the painter puts v = 0 at the canvas's last row. A flipped
      // upload puts that row at v = 0; GLTFLoader's own textures turn the flip off, so the strip must keep it.
      expect(map.flipY).toBe(true);
      expect(map.wrapS).toBe(THREE.RepeatWrapping);
      expect(map.wrapT).toBe(THREE.ClampToEdgeWrapping);
      expect(map.colorSpace).toBe(THREE.NoColorSpace);
      expect(map.anisotropy).toBe(4);
      // Set up after it was made, so it is uploaded again with the flip.
      expect(map.version).toBeGreaterThan(0);
    }
    expect(COMPASS_LOOK.bandMarks.anisotropy).toBe(4);
    c.dispose();
  });

  // Task 12: the hot amber at 1.6 read as bright orange marks; the preview's marks are gold, a quarter of the letters.
  it("lights the marks in the gold light at 0.6 by the strip's coverage, on top of the glass's own glow", () => {
    const c = loadCompass(fakeGltf(), 'high', stripStub);
    const glass = bandMaterial(c);
    expect(COMPASS_LOOK.bandMarks.colour).toBe(palette.goldLight);
    expect(COMPASS_LOOK.bandMarks.intensity).toBe(0.6);
    const shader = { uniforms: {} as Record<string, THREE.IUniform>, vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader };
    glass.onBeforeCompile(shader as never, {} as never);
    const marks = shader.uniforms.uMarks.value as THREE.Color;
    const expected = new THREE.Color(palette.goldLight).multiplyScalar(0.6);
    expect(marks.r).toBeCloseTo(expected.r, 9);
    expect(marks.g).toBeCloseTo(expected.g, 9);
    expect(marks.b).toBeCloseTo(expected.b, 9);
    expect(shader.fragmentShader).toMatch(/uniform vec3 uMarks;/);
    expect(shader.fragmentShader).toMatch(/uniform float uReveal;/);
    // The marks are added where the strip covers (its alpha), not multiplied into the glass's glow.
    expect(shader.fragmentShader).toMatch(/float markCover\s*=\s*texture2D\(\s*emissiveMap\s*,\s*vEmissiveMapUv\s*\)\.a;/);
    expect(shader.fragmentShader).toMatch(/totalEmissiveRadiance\s*\+=\s*uMarks\s*\*\s*markCover;/);
    // And a mark is as solid as the reveal, whatever the glass's own opacity.
    expect(shader.fragmentShader).toMatch(/diffuseColor\.a\s*=\s*mix\(\s*diffuseColor\.a\s*,\s*uReveal\s*,\s*markCover\s*\);/);
    expect(shader.fragmentShader).not.toContain('#include <emissivemap_fragment>');
    expect(shader.fragmentShader).not.toMatch(/totalEmissiveRadiance\s*\*=\s*emissiveColor\.rgb/);
    // The raise sits before the alpha is written out.
    expect(shader.fragmentShader.indexOf('markCover')).toBeLessThan(shader.fragmentShader.indexOf('#include <opaque_fragment>'));
    c.dispose();
  });

  it('gilds the rims, the pivot and the axis with one brass, and the needle with its own copy of it, opaque so the glass shows it through', () => {
    const c = loadCompass(fakeGltf(), 'high', stripStub);
    const gold = mesh(c, 'pivot').material as THREE.MeshStandardMaterial;
    for (const name of ['rim_1', 'rim_2', 'rim_3', 'rim_4', 'pivot', 'axis']) expect(mesh(c, name).material, name).toBe(gold);
    const needle = mesh(c, 'needle').material as THREE.MeshStandardMaterial;
    expect(needle).not.toBe(gold);
    for (const key of ['color', 'emissive'] as const) expect(needle[key].getHex(), key).toBe(gold[key].getHex());
    for (const key of ['metalness', 'roughness', 'emissiveIntensity', 'transparent', 'alphaHash'] as const) expect(needle[key], key).toBe(gold[key]);
    expect(gold).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(gold).not.toBeInstanceOf(THREE.MeshPhysicalMaterial);
    expect(gold.color.getHex()).toBe(palette.brass);
    expect(gold.metalness).toBe(1);
    expect(gold.roughness).toBe(0.22);
    // Task 12: a faint gold light of its own (the preview's needle 0.15, rims 0.25), or the needle reads black.
    expect(gold.emissive.getHex()).toBe(palette.goldLight);
    expect(gold.emissiveIntensity).toBe(0.22);
    // Transmission sees only opaque objects: a see-through needle would vanish behind every band.
    expect(gold.transparent).toBe(false);
    expect(gold.alphaHash).toBe(true);
    c.dispose();
  });

  it("breathes the needle's glow alone (setNeedleGlow): a share of its 0.22, a bad value read as rest, the rest of the gold still", () => {
    const c = loadCompass(fakeGltf(), 'high', stripStub);
    const gold = mesh(c, 'pivot').material as THREE.MeshStandardMaterial;
    const needle = mesh(c, 'needle').material as THREE.MeshStandardMaterial;
    const version = needle.version;
    c.setNeedleGlow(1.4);
    expect(needle.emissiveIntensity).toBeCloseTo(0.22 * 1.4, 12);
    expect(gold.emissiveIntensity).toBe(0.22);
    for (const bad of [Number.NaN, -1, Infinity]) {
      c.setNeedleGlow(bad);
      expect(needle.emissiveIntensity, String(bad)).toBe(0.22);
    }
    c.setNeedleGlow(0);
    expect(needle.emissiveIntensity).toBe(0);
    // A uniform, not a new program: the breath compiles nothing.
    expect(needle.version).toBe(version);
    c.dispose();
  });

  it('turns each band on its own axis from its rest, at (1.5 + 0.6k) degrees a second, one way and then the other', () => {
    expect(COMPASS_LOOK.spin).toEqual({ base: 1.5, step: 0.6 });
    const gltf = fakeGltf();
    const rests = [1, 2, 3, 4].map((k) => (gltf.scene.getObjectByName(`band_${k}`) as THREE.Object3D).quaternion.clone());
    const c = loadCompass(gltf, 'high', stripStub);
    const seconds = 40;
    c.setSpin(seconds);
    const signs: number[] = [];
    [1, 2, 3, 4].forEach((k, i) => {
      const band = node(c, `band_${k}`);
      // The turn since rest, in the band's own frame: about its local Y, which therefore stays where it was.
      const turn = rests[i].clone().invert().multiply(band.quaternion);
      expect(angleOf(turn)).toBeCloseTo((1.5 + 0.6 * i) * seconds * DEG, 9);
      expect(Y.clone().applyQuaternion(band.quaternion).distanceTo(Y.clone().applyQuaternion(rests[i]))).toBeLessThan(1e-9);
      expect(Math.abs(turn.x) + Math.abs(turn.z)).toBeLessThan(1e-9);
      signs.push(Math.sign(turn.y * turn.w));
      // The rim rides on its band.
      expect(node(c, `rim_${k}`).parent).toBe(band);
    });
    expect(signs[0]).toBe(-signs[1]);
    expect(signs[1]).toBe(-signs[2]);
    expect(signs[2]).toBe(-signs[3]);
    c.setSpin(0);
    [1, 2, 3, 4].forEach((k, i) => expect(angleOf(rests[i].clone().invert().multiply(node(c, `band_${k}`).quaternion))).toBeCloseTo(0, 9));
    c.setSpin(seconds);
    c.setSpin(Number.NaN);
    expect(angleOf(rests[0].clone().invert().multiply(node(c, 'band_1').quaternion))).toBeCloseTo(0, 9);
    c.dispose();
  });

  it('leaves the bands and the armillary exactly as they were at setIris(0), and reads NaN as 0', () => {
    const c = loadCompass(fakeGltf(), 'high', stripStub);
    c.setSpin(40);
    c.setNeedle(0.3);
    const pose = () => [
      ...[1, 2, 3, 4].flatMap((k) => [...node(c, `band_${k}`).quaternion.toArray(), ...node(c, `band_${k}`).scale.toArray()]),
      node(c, 'armillary').position.y
    ];
    const before = pose();
    const same = (label: string) => pose().forEach((v, i) => expect(Math.abs(v - before[i]), `${label} ${i}`).toBeLessThan(1e-12));
    c.setIris(0);
    same('at 0');
    c.setIris(1);
    c.setIris(0);
    same('back to 0');
    c.setIris(0.7);
    c.setIris(Number.NaN);
    same('NaN');
    c.setIris(0.7);
    c.setIris(-3);
    same('below 0');
    c.dispose();
  });

  it("lays every band flat at setIris(1): its own Y on the world's up, turned k × 0.4 about it, widened to the preview's radius, the armillary 0.09 above the glass", () => {
    expect(COMPASS_LOOK.iris).toEqual({ radii: [1.66, 1.74, 1.82, 1.9], turn: 0.4, flatY: 0.09 });
    const c = loadCompass(fakeGltf(), 'high', stripStub);
    c.setIris(1);
    [1, 2, 3, 4].forEach((k, i) => {
      const { up, across } = bandAxes(c, k);
      expect(up.distanceTo(Y), `band_${k} flat`).toBeLessThan(1e-6);
      expect(Math.atan2(-across.z, across.x), `band_${k} turn`).toBeCloseTo(0.4 * i, 6);
      // Its radius measured from its geometry at load: the middle of its wall ends up at the preview's radius.
      const scale = node(c, `band_${k}`).scale;
      expect(scale.x, `band_${k} x`).toBeCloseTo(COMPASS_LOOK.iris.radii[i] / FAKE_RADII[i], 6);
      expect(scale.z, `band_${k} z`).toBeCloseTo(COMPASS_LOOK.iris.radii[i] / FAKE_RADII[i], 6);
      expect(scale.y, `band_${k} y`).toBe(1);
    });
    expect(node(c, 'armillary').getWorldPosition(new THREE.Vector3()).y).toBeCloseTo(0.09, 12);
    // Held to 1.
    c.setIris(5);
    expect(node(c, 'armillary').position.y).toBeCloseTo(0.09, 12);
    c.dispose();
  });

  it('keeps the bands flat as they spin, the spin turning each in its own plane on top of the iris, in either order', () => {
    const c = loadCompass(fakeGltf(), 'high', stripStub);
    c.setIris(1);
    const flat = [1, 2, 3, 4].map((k) => node(c, `band_${k}`).quaternion.clone());
    c.setSpin(40);
    [1, 2, 3, 4].forEach((k, i) => {
      expect(bandAxes(c, k).up.distanceTo(Y), `band_${k}`).toBeLessThan(1e-6);
      const turn = flat[i].clone().invert().multiply(node(c, `band_${k}`).quaternion);
      expect(angleOf(turn)).toBeCloseTo((1.5 + 0.6 * i) * 40 * DEG, 9);
      expect(Math.abs(turn.x) + Math.abs(turn.z)).toBeLessThan(1e-9);
    });
    // The iris set after the spin keeps the spin: the same pose either way round.
    const other = loadCompass(fakeGltf(), 'high', stripStub);
    other.setSpin(40);
    other.setIris(1);
    for (const k of [1, 2, 3, 4]) {
      const between = node(other, `band_${k}`).quaternion.clone().invert().multiply(node(c, `band_${k}`).quaternion);
      expect(angleOf(between), `band_${k}`).toBeLessThan(1e-9);
    }
    c.dispose();
    other.dispose();
  });

  it('eases the iris by smoothstep: halfway at 0.5, every band turning steadily away from its rest', () => {
    const gltf = fakeGltf();
    const rests = [1, 2, 3, 4].map((k) => (gltf.scene.getObjectByName(`band_${k}`) as THREE.Object3D).quaternion.clone());
    const c = loadCompass(gltf, 'high', stripStub);
    const band = (i: number) => node(c, `band_${i + 1}`);
    const fromRest = (i: number) => angleOf(rests[i].clone().invert().multiply(band(i).quaternion));
    c.setIris(1);
    const flats = [0, 1, 2, 3].map((i) => band(i).quaternion.clone());
    const full = [0, 1, 2, 3].map(fromRest);
    for (const angle of full) expect(angle).toBeGreaterThan(10 * DEG);
    c.setIris(0.5);
    [0, 1, 2, 3].forEach((i) => {
      expect(fromRest(i), `band_${i + 1} from rest`).toBeCloseTo(full[i] / 2, 9);
      expect(angleOf(flats[i].clone().invert().multiply(band(i).quaternion)), `band_${i + 1} to flat`).toBeCloseTo(full[i] / 2, 9);
      expect(band(i).scale.x, `band_${i + 1} scale`).toBeCloseTo((1 + COMPASS_LOOK.iris.radii[i] / FAKE_RADII[i]) / 2, 6);
    });
    expect(node(c, 'armillary').position.y).toBeCloseTo((0.55 + 0.09) / 2, 12);
    c.setIris(0.25);
    expect(node(c, 'armillary').position.y).toBeCloseTo(0.55 + (0.09 - 0.55) * smooth(0.25), 12);
    expect(fromRest(0)).toBeCloseTo(full[0] * smooth(0.25), 9);
    const last = [0, 0, 0, 0];
    for (let step = 0; step <= 40; step++) {
      c.setIris(step / 40);
      [0, 1, 2, 3].forEach((i) => {
        const angle = fromRest(i);
        expect(angle, `band_${i + 1} at ${step / 40}`).toBeGreaterThanOrEqual(last[i] - 1e-12);
        last[i] = angle;
      });
    }
    last.forEach((angle, i) => expect(angle).toBeCloseTo(full[i], 9));
    c.dispose();
  });

  it('sinks the armillary from wherever the rise has it, the rise and the iris composing in either order', () => {
    const c = loadCompass(fakeGltf(), 'high', stripStub);
    const y = () => node(c, 'armillary').position.y;
    c.setIris(0.5);
    c.setRise(1);
    expect(y()).toBeCloseTo((0.55 + 0.09) / 2, 12);
    // The fake's rise at its half: 3.25 / 2 below the home height.
    c.setRise(0.5);
    expect(y()).toBeCloseTo((-3.25 / 2 + 0.55 + 0.09) / 2, 5);
    c.setIris(1);
    expect(y()).toBeCloseTo(0.09, 12);
    c.setRise(1);
    c.setIris(0);
    expect(y()).toBeCloseTo(0.55, 12);
    // Flat in the armillary is flat in the world while the rise turns it, since the rise turns it about the up alone.
    c.setIris(1);
    c.setRise(0.25);
    for (const k of [1, 2, 3, 4]) expect(bandAxes(c, k).up.distanceTo(Y), `band_${k}`).toBeLessThan(1e-6);
    c.dispose();
  });

  it("turns the needle down into the tunnel at setNeedleDip(1), its tip on the world's down from any angle", () => {
    const c = loadCompass(fakeGltf(), 'high', stripStub);
    for (const a of [0, 0.3, -0.3, Math.PI / 2, -Math.PI / 2, 38 * DEG, Math.PI, -Math.PI, 2.5, -2.9, 7, -13]) {
      c.setNeedle(a);
      c.setNeedleDip(1);
      expect(tipDirection(c).distanceTo(DOWN), `from ${a}`).toBeLessThan(1e-6);
    }
    // Held to 1.
    c.setNeedleDip(3);
    expect(tipDirection(c).distanceTo(DOWN)).toBeLessThan(1e-6);
    c.dispose();
  });

  it("gives back exactly the needle's own pose at setNeedleDip(0), and reads NaN as 0", () => {
    for (const a of [0, 0.7, -2, Math.PI]) {
      for (const rise of [1, 0.25]) {
        const c = loadCompass(fakeGltf(), 'high', stripStub);
        const alone = loadCompass(fakeGltf(), 'high', stripStub);
        c.setRise(rise);
        alone.setRise(rise);
        alone.setNeedle(a);
        c.setNeedleDip(0.6);
        c.setNeedle(a);
        c.setNeedleDip(0);
        expect(node(c, 'needle').quaternion.toArray(), `${a} at rise ${rise}`).toEqual(node(alone, 'needle').quaternion.toArray());
        c.setNeedleDip(1);
        c.setNeedleDip(Number.NaN);
        expect(node(c, 'needle').quaternion.toArray(), `${a} at rise ${rise}, NaN`).toEqual(node(alone, 'needle').quaternion.toArray());
        c.dispose();
        alone.dispose();
      }
    }
  });

  it('keeps the dip through setNeedle and setRise', () => {
    const c = loadCompass(fakeGltf(), 'high', stripStub);
    c.setNeedleDip(1);
    for (const b of [0.4, -1.2, 3]) {
      c.setNeedle(b);
      expect(tipDirection(c).distanceTo(DOWN), `to ${b}`).toBeLessThan(1e-6);
    }
    c.setRise(0.25);
    expect(tipDirection(c).distanceTo(DOWN)).toBeLessThan(1e-6);
    c.setRise(1);
    expect(tipDirection(c).distanceTo(DOWN)).toBeLessThan(1e-6);
    // Partway down, the rise turning the armillary under it leaves the tip where it points in the world.
    c.setNeedleDip(0.4);
    const before = tipDirection(c);
    c.setRise(0.6);
    expect(tipDirection(c).distanceTo(before)).toBeLessThan(1e-6);
    c.dispose();
  });

  it("tips the needle toward the camera on its way down, as the preview's does, the same way either side of up", () => {
    const c = loadCompass(fakeGltf(), 'high', stripStub);
    c.setNeedle(0);
    c.setNeedleDip(0.5);
    expect(tipDirection(c).distanceTo(new THREE.Vector3(0, 0, 1))).toBeLessThan(1e-9);
    // Eased by smoothstep: a quarter of the way along, the tip has turned π × smoothstep(0.25) from up.
    c.setNeedleDip(0.25);
    expect(tipDirection(c).angleTo(Y)).toBeCloseTo(Math.PI * smooth(0.25), 9);
    for (const a of [-3, -2, -1, -0.2, 0, 0.2, 1, 2, 3]) {
      c.setNeedle(a);
      for (const dip of [0.2, 0.5, 0.8]) {
        c.setNeedleDip(dip);
        expect(tipDirection(c).z, `${a} at ${dip}`).toBeGreaterThan(0);
      }
    }
    // No snap where the aim crosses up: either side of it, the needle stands in one place on its way down.
    c.setNeedleDip(0.5);
    c.setNeedle(1e-4);
    const right = tipDirection(c);
    c.setNeedle(-1e-4);
    expect(tipDirection(c).distanceTo(right)).toBeLessThan(1e-3);
    // An angle a whole turn on is the same bearing, and the same pose on the way down.
    c.setNeedle(0.7);
    const once = node(c, 'needle').quaternion.clone();
    c.setNeedle(0.7 + 2 * Math.PI);
    expect(angleOf(once.invert().multiply(node(c, 'needle').quaternion))).toBeLessThan(1e-9);
    c.dispose();
  });

  it('ends the dip in one pose whatever the aim: the up pose turned half about the world X', () => {
    const c = loadCompass(fakeGltf(), 'high', stripStub);
    c.setNeedle(0);
    const end = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI).multiply(node(c, 'needle').quaternion);
    c.setNeedleDip(1);
    for (const a of [0, 1, -2.5, Math.PI, 9]) {
      c.setNeedle(a);
      expect(angleOf(end.clone().invert().multiply(node(c, 'needle').quaternion)), `from ${a}`).toBeLessThan(1e-6);
    }
    c.dispose();
  });

  it('fades the whole compass in by uniforms only, and draws nothing at 0', () => {
    const c = loadCompass(fakeGltf(), 'medium', stripStub);
    const gold = mesh(c, 'axis').material as THREE.MeshStandardMaterial;
    const glass = [1, 2, 3, 4].map((k) => bandMaterial(c, k));
    const versions = () => [gold, ...glass].map((m) => m.version);
    const before = versions();
    c.setReveal(0.5);
    expect(gold.opacity).toBeCloseTo(0.5, 9);
    for (const g of glass) expect(g.opacity).toBeCloseTo(0.5, 9);
    expect(node(c, 'armillary').visible).toBe(true);
    c.setReveal(0);
    expect(node(c, 'armillary').visible).toBe(false);
    c.setReveal(1);
    expect(node(c, 'armillary').visible).toBe(true);
    expect(gold.opacity).toBe(1);
    for (const g of glass) expect(g.opacity).toBe(1);
    c.setReveal(7);
    expect(gold.opacity).toBe(1);
    c.setReveal(Number.NaN);
    expect(gold.opacity).toBe(0);
    expect(node(c, 'armillary').visible).toBe(false);
    // Nothing a program depends on changes: the glass is see-through at every level (alpha 1 at full), the gold hashed.
    expect(versions()).toEqual(before);
    for (const g of glass) expect(g.transparent).toBe(true);
    expect(gold.transparent).toBe(false);
    c.dispose();
  });

  it("fades the low tier's thin glass from its own opacity, its marks with the reveal", () => {
    const c = loadCompass(fakeGltf(), 'low', stripStub);
    const glass = bandMaterial(c);
    const shader = { uniforms: {} as Record<string, THREE.IUniform>, vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader };
    glass.onBeforeCompile(shader as never, {} as never);
    const version = glass.version;
    expect(shader.uniforms.uReveal.value).toBe(1);
    c.setReveal(0.5);
    expect(glass.opacity).toBeCloseTo(0.35 * 0.5, 9);
    expect(shader.uniforms.uReveal.value).toBeCloseTo(0.5, 9);
    expect((mesh(c, 'needle').material as THREE.Material).opacity).toBeCloseTo(0.5, 9);
    c.setReveal(1);
    expect(glass.opacity).toBeCloseTo(0.35, 9);
    expect(shader.uniforms.uReveal.value).toBe(1);
    expect(glass.version).toBe(version);
    c.dispose();
  });

  it('steps its glass down to a lower tier as a compass built for it would have it', () => {
    const glassOf = (c: CompassModel) => [1, 2, 3, 4].map((k) => bandMaterial(c, k));
    const looks = (c: CompassModel) => glassOf(c).map((g) => ({ transmission: g.transmission, opacity: g.opacity, depthWrite: g.depthWrite, transparent: g.transparent }));
    for (const [from, to] of [['high', 'medium'], ['high', 'low'], ['medium', 'low']] as const) {
      const c = loadCompass(fakeGltf(), from, stripStub);
      const built = loadCompass(fakeGltf(), to, stripStub);
      c.setTier(to);
      expect(looks(c), `${from} to ${to}`).toEqual(looks(built));
      c.dispose();
      built.dispose();
    }
  });

  it('compiles the bands once more only when transmission goes off, and keeps the reveal through the step', () => {
    const c = loadCompass(fakeGltf(), 'high', stripStub);
    const glass = bandMaterial(c);
    const version = glass.version;
    c.setTier('medium');
    // A lower transmission is a uniform: the same program.
    expect(glass.version).toBe(version);
    c.setReveal(0.5);
    c.setTier('low');
    expect(glass.version).toBeGreaterThan(version);
    expect(glass.transmission).toBe(0);
    expect(glass.opacity).toBeCloseTo(0.35 * 0.5, 9);
    c.setReveal(1);
    expect(glass.opacity).toBeCloseTo(0.35, 9);
    c.dispose();
  });

  it('never steps back up: the ladder only goes down within a page view', () => {
    const c = loadCompass(fakeGltf(), 'medium', stripStub);
    c.setTier('high');
    expect(bandMaterial(c).transmission).toBe(0.6);
    c.setTier('low');
    c.setTier('medium');
    c.setTier('high');
    expect(bandMaterial(c).transmission).toBe(0);
    expect(bandMaterial(c).depthWrite).toBe(false);
    c.dispose();
  });

  it("hands over its pivot, the GLB's 'pivot', where the home aims the needle from", () => {
    const c = loadCompass(fakeGltf(), 'high', stripStub);
    expect(c.pivot).toBe(mesh(c, 'pivot'));
    expect(c.pivot.name).toBe('pivot');
    c.dispose();
  });

  it('builds at home: risen, shown, the needle up and the bands at rest', () => {
    const gltf = fakeGltf();
    const rest = (gltf.scene.getObjectByName('band_2') as THREE.Object3D).quaternion.clone();
    const c = loadCompass(gltf, 'low', stripStub);
    expect(c.group.name).toBe('compass');
    expect(c.group.isGroup).toBe(true);
    expect(node(c, 'armillary').parent).toBe(c.group);
    expect(node(c, 'armillary').position.y).toBeCloseTo(0.55, 6);
    expect(angleOf(node(c, 'armillary').quaternion)).toBeCloseTo(0, 6);
    expect(node(c, 'armillary').visible).toBe(true);
    expect(tipDirection(c).y).toBeCloseTo(1, 9);
    expect(angleOf(rest.clone().invert().multiply(node(c, 'band_2').quaternion))).toBeCloseTo(0, 9);
    c.dispose();
  });

  it('leaves the glTF it was given as it was, so a cached model builds the same compass again', () => {
    const gltf = fakeGltf();
    const original = gltf.scene.getObjectByName('band_3') as THREE.Mesh;
    const rest = original.quaternion.clone();
    const material = original.material;
    const a = loadCompass(gltf, 'high', stripStub);
    a.setSpin(300);
    a.setNeedle(1);
    a.setRise(0.2);
    expect(original.quaternion.equals(rest)).toBe(true);
    expect(original.material).toBe(material);
    expect(gltf.scene.getObjectByName('armillary')!.position.y).toBe(0);
    expect(node(a, 'band_3')).not.toBe(original);
    // The copy shares the glTF's geometry rather than copying it.
    expect(mesh(a, 'band_3').geometry).toBe(original.geometry);
    a.dispose();
    const b = loadCompass(gltf, 'high', stripStub);
    expect(angleOf(rest.clone().invert().multiply(node(b, 'band_3').quaternion))).toBeCloseTo(0, 9);
    expect(node(b, 'armillary').position.y).toBeCloseTo(0.55, 6);
    b.dispose();
  });

  it('frees the materials and the strips it made, and leaves the glTF its geometries', () => {
    const made: THREE.Texture[] = [];
    const c = loadCompass(fakeGltf(), 'high', (band) => {
      const texture = stripStub(band);
      made.push(texture);
      return texture;
    });
    const gold = [mesh(c, 'pivot').material, mesh(c, 'needle').material] as THREE.Material[];
    const glass = [1, 2, 3, 4].map((k) => bandMaterial(c, k));
    const spies = [...gold, ...glass, ...made].map((part) => vi.spyOn(part, 'dispose'));
    const geometries = COMPASS_PARTS.filter((name) => name !== 'armillary').map((name) => vi.spyOn(mesh(c, name).geometry, 'dispose'));
    c.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
    for (const spy of geometries) expect(spy).not.toHaveBeenCalled();
  });

  it('loads the real GLB: every part found, the rise from 2.7 below to 0.55 above, the needle turned about the view axis', async () => {
    const gltf = await loadRealGlb();
    const c = loadCompass(gltf, 'high', stripStub);
    const armillary = node(c, 'armillary');
    c.setRise(0);
    expect(armillary.position.y).toBeCloseTo(-2.7, 3);
    expect(angleOf(armillary.quaternion)).toBeCloseTo(50 * DEG, 3);
    // The file's ease-out, 1 - (1 - x)^3: seven eighths of the way up at the half.
    c.setRise(0.5);
    expect(armillary.position.y).toBeCloseTo(-3.25 * 0.125 + 0.55, 3);
    c.setRise(1);
    expect(armillary.position.y).toBeCloseTo(0.55, 4);
    expect(angleOf(armillary.quaternion)).toBeCloseTo(0, 4);
    for (const k of [1, 2, 3, 4]) expect(bandMaterial(c, k).emissiveMap?.flipY).toBe(true);
    // The tip vertex, as the file has it at +1.15 up, ends up 1.15 to the right a quarter turn on.
    c.setNeedle(Math.PI / 2);
    c.group.updateMatrixWorld(true);
    const needle = mesh(c, 'needle');
    const position = needle.geometry.getAttribute('position');
    let tip = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) {
      const p = new THREE.Vector3().fromBufferAttribute(position, i);
      if (p.y > tip.y) tip = p;
    }
    const world = tip.clone().applyMatrix4(needle.matrixWorld).sub(new THREE.Vector3().setFromMatrixPosition(needle.matrixWorld));
    expect(world.x).toBeCloseTo(1.15, 3);
    expect(world.y).toBeCloseTo(0, 3);
    c.dispose();
  });

  it("finds the real GLB's pivot by its name, at the armillary's origin: 0.55 above the glass at home", async () => {
    const c = loadCompass(await loadRealGlb(), 'high', stripStub);
    expect(c.pivot.name).toBe('pivot');
    c.group.updateMatrixWorld(true);
    const at = c.pivot.getWorldPosition(new THREE.Vector3());
    expect(at.x).toBeCloseTo(0, 6);
    expect(at.y).toBeCloseTo(COMPASS_LOOK.homeY, 6);
    expect(at.z).toBeCloseTo(0, 6);
    c.dispose();
  });

  it("holds the premises the strip's flip and the spin stand on: each band thin in its local Y, its v rising with +Y", async () => {
    const gltf = await loadRealGlb();
    for (const k of [1, 2, 3, 4]) {
      const band = gltf.scene.getObjectByName(`band_${k}`) as THREE.Mesh;
      expect(band.isMesh, `band_${k}`).toBe(true);
      // Round local Y: the spin turns the band in its own plane only if Y is the axis it lies round.
      band.geometry.computeBoundingBox();
      const size = band.geometry.boundingBox!.getSize(new THREE.Vector3());
      expect(size.y, `band_${k} height`).toBeLessThan(0.2);
      expect(size.y, `band_${k} height against its width`).toBeLessThan(0.1 * Math.min(size.x, size.z));
      // v climbs with local +Y, from the bottom edge (0) to the top (1): the flipY choice rests on it.
      const position = band.geometry.getAttribute('position');
      const uv = band.geometry.getAttribute('uv');
      let below = 0;
      let above = 0;
      let nBelow = 0;
      let nAbove = 0;
      let lowest = { y: Infinity, v: 0 };
      let highest = { y: -Infinity, v: 0 };
      for (let i = 0; i < position.count; i++) {
        const y = position.getY(i);
        const v = uv.getY(i);
        if (y < 0) {
          below += v;
          nBelow++;
        } else if (y > 0) {
          above += v;
          nAbove++;
        }
        if (y < lowest.y) lowest = { y, v };
        if (y > highest.y) highest = { y, v };
      }
      expect(above / nAbove - below / nBelow, `band_${k} v by side`).toBeGreaterThan(0.5);
      expect(lowest.v, `band_${k} v at the bottom edge`).toBeLessThan(0.05);
      expect(highest.v, `band_${k} v at the top edge`).toBeGreaterThan(0.95);
    }
  });

  it("opens the real GLB's bands to the preview's radii, each measured in the middle of its wall, flat 0.09 above the glass", async () => {
    const gltf = await loadRealGlb();
    for (const k of [1, 2, 3, 4]) expect((gltf.scene.getObjectByName(`band_${k}`) as THREE.Object3D).scale.toArray(), `band_${k}`).toEqual([1, 1, 1]);
    const c = loadCompass(gltf, 'high', stripStub);
    // The rise turns the armillary about the up alone, so a band laid flat in the armillary is flat in the world.
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      c.setRise(t);
      expect(Y.clone().applyQuaternion(node(c, 'armillary').quaternion).distanceTo(Y), `rise ${t}`).toBeLessThan(1e-6);
    }
    c.setIris(1);
    c.group.updateMatrixWorld(true);
    [1, 2, 3, 4].forEach((k, i) => {
      const band = mesh(c, `band_${k}`);
      expect(band.scale.x, `band_${k} scale`).toBeCloseTo(COMPASS_LOOK.iris.radii[i] / GLB_RADII[i], 6);
      expect(bandAxes(c, k).up.distanceTo(Y), `band_${k} flat`).toBeLessThan(1e-6);
      // In the world: the middle of the wall at the preview's radius round the armillary, the band standing on its own
      // height (0.14 to 0.18) about a plane 0.09 above the glass.
      const centre = band.getWorldPosition(new THREE.Vector3());
      expect(centre.y, `band_${k} centre`).toBeCloseTo(0.09, 6);
      const position = band.geometry.getAttribute('position');
      const p = new THREE.Vector3();
      let outer = 0;
      let inner = Infinity;
      let low = Infinity;
      let high = -Infinity;
      for (let v = 0; v < position.count; v++) {
        p.fromBufferAttribute(position, v).applyMatrix4(band.matrixWorld);
        const r = Math.hypot(p.x - centre.x, p.z - centre.z);
        outer = Math.max(outer, r);
        inner = Math.min(inner, r);
        low = Math.min(low, p.y);
        high = Math.max(high, p.y);
      }
      expect((outer + inner) / 2, `band_${k} radius`).toBeCloseTo(COMPASS_LOOK.iris.radii[i], 5);
      expect(high - low, `band_${k} height`).toBeLessThan(0.19);
      expect((high + low) / 2, `band_${k} plane`).toBeCloseTo(0.09, 5);
    });
    c.dispose();
  });
});

describe('the band strip', () => {
  it("paints a band on a canvas of the strip's size and hands it over as a texture, left flipped", () => {
    const fills: number[][] = [];
    let cleared = 0;
    const ctx: StripContext = {
      fillStyle: '',
      clearRect: () => void cleared++,
      fillRect: (x, y, w, h) => void fills.push([x, y, w, h])
    };
    const canvas = { width: 0, height: 0, getContext: (kind: string) => (kind === '2d' ? ctx : null) } as unknown as HTMLCanvasElement;
    const texture = bandStrip(2, canvas);
    expect(texture).toBeInstanceOf(THREE.CanvasTexture);
    expect(texture.image).toBe(canvas);
    expect(canvas.width).toBe(BAND_STRIP.width);
    expect(canvas.height).toBe(BAND_STRIP.height);
    expect(cleared).toBe(1);
    expect(fills.length).toBeGreaterThan(180);
    expect(texture.flipY).toBe(true);
    texture.dispose();
  });

  it('names a canvas that gives no 2D context', () => {
    const canvas = { width: 0, height: 0, getContext: () => null } as unknown as HTMLCanvasElement;
    expect(() => bandStrip(0, canvas)).toThrow(TypeError);
  });
});

describe('the probe', () => {
  const named = <T extends THREE.Object3D>(probe: ProbeModel, name: string): T => objectNamed(probe.group, name) as T;
  const sparkPositions = (probe: ProbeModel) => Array.from(named<THREE.Points>(probe, 'probe:sparks').geometry.getAttribute('position').array as Float32Array);
  const sparkColours = (probe: ProbeModel) => Array.from(named<THREE.Points>(probe, 'probe:sparks').geometry.getAttribute('color').array as Float32Array);
  const worldPosition = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());

  it('lights the probe only while it cuts, by intensity: the light never leaves the scene, so the number of lights never changes', () => {
    const p = buildProbe();
    const light = named<THREE.PointLight>(p, 'probe:light');
    p.setOn(false);
    expect(light.visible).toBe(true);
    expect(light.intensity).toBe(0);
    p.setOn(true);
    expect(light.visible).toBe(true);
    expect(light.intensity).toBeGreaterThan(0);
    p.setOn(false);
    expect(light.visible).toBe(true);
    expect(light.intensity).toBe(0);
    p.dispose();
  });

  it('warms the tip with a point light just above it while on, from the palette amber toward cream', () => {
    const p = buildProbe();
    const light = named<THREE.PointLight>(p, 'probe:light');
    expect(light).toBeInstanceOf(THREE.PointLight);
    expect(light.parent).toBe(p.group);
    expect(light.position.toArray()).toEqual([0, PROBE_LOOK.light.y, 0]);
    expect(PROBE_LOOK.light.y).toBeGreaterThan(0);
    expect(PROBE_LOOK.light.y).toBeLessThan(0.1);
    p.setOn(true);
    expect(light.visible).toBe(true);
    expect(light.intensity).toBe(PROBE_LOOK.light.intensity);
    expect(light.intensity).toBeGreaterThan(0);
    const warm = new THREE.Color(palette.amber).lerp(new THREE.Color(palette.cream), PROBE_LOOK.light.whiten);
    expect(light.color.equals(warm)).toBe(true);
    expect(light.color.r).toBeGreaterThan(light.color.g);
    expect(light.color.g).toBeGreaterThan(light.color.b);
    p.setOn(false);
    expect(light.intensity).toBe(0);
    p.dispose();
  });

  it('stands its tip at setTip, the 9 m shaft rising from a 0.22 taper, 0.018 round', () => {
    const p = buildProbe();
    p.setTip(-4.25, 0.012, 1.7);
    expect(p.group.position.toArray()).toEqual([-4.25, 0.012, 1.7]);
    const body = named<THREE.Mesh>(p, 'probe:body');
    expect(body.parent).toBe(p.group);
    body.geometry.computeBoundingBox();
    const box = body.geometry.boundingBox!;
    expect(box.min.y).toBeCloseTo(0, 9);
    expect(box.max.y).toBeCloseTo(9.22, 6);
    expect(box.max.x).toBeCloseTo(0.018, 4);
    const position = body.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      const r = Math.hypot(position.getX(i), position.getZ(i));
      const y = position.getY(i);
      expect(r).toBeLessThanOrEqual(0.018 + 1e-9);
      // The taper: narrow at the tip, the full radius from 0.22 up.
      if (y < 1e-9) expect(r).toBeLessThanOrEqual(0.003 + 1e-9);
      if (y > 0.22 + 1e-9 && y < 9.22 - 1e-9) expect(r).toBeCloseTo(0.018, 9);
    }
    const material = body.material as THREE.MeshStandardMaterial;
    expect(material.color.getHex()).toBe(palette.brass);
    expect(material.emissive.getHex()).toBe(palette.brass);
    expect(material.emissiveIntensity).toBeGreaterThan(0);
    expect(material.emissiveIntensity).toBeLessThanOrEqual(0.3);
    // A coordinate that is not finite is ignored.
    p.setTip(Number.NaN, Infinity, 2);
    expect(p.group.position.toArray()).toEqual([-4.25, 0.012, 2]);
    p.dispose();
  });

  it('cuts on the glass under the tip: the beam spans the gap, the point, the sparks and the wisp stand on the glass', () => {
    const p = buildProbe();
    for (const [x, y, z] of [
      [0.5, 0.012, -0.3],
      [-2, 0.35, 1]
    ]) {
      p.setTip(x, y, z);
      p.group.updateMatrixWorld(true);
      const beam = named<THREE.Mesh>(p, 'probe:beam');
      beam.geometry.computeBoundingBox();
      const box = beam.geometry.boundingBox!.clone().applyMatrix4(beam.matrixWorld);
      expect(box.min.y).toBeCloseTo(0, 6);
      expect(box.max.y).toBeCloseTo(y, 6);
      expect(box.getCenter(new THREE.Vector3()).x).toBeCloseTo(x, 6);
      expect(box.getCenter(new THREE.Vector3()).z).toBeCloseTo(z, 6);
      expect(box.max.x - box.min.x).toBeLessThan(0.003);
      expect(worldPosition(named(p, 'probe:point')).toArray()).toEqual([x, expect.closeTo(PROBE_LOOK.point.lift, 9), z]);
      expect(worldPosition(named(p, 'probe:sparks')).y).toBeCloseTo(0, 9);
      expect(worldPosition(named(p, 'probe:smoke')).y).toBeCloseTo(PROBE_LOOK.smoke.rise, 9);
      // The nozzle's glow is at the tip itself.
      expect(worldPosition(named(p, 'probe:nozzle')).toArray()).toEqual([x, expect.closeTo(y, 9), z]);
    }
    // A tip on or under the glass leaves no gap and no beam to speak of.
    p.setTip(0, -1, 0);
    p.group.updateMatrixWorld(true);
    expect(worldPosition(named(p, 'probe:sparks')).y).toBeCloseTo(-1, 9);
    expect(named(p, 'probe:beam').scale.y).toBeLessThan(1e-3);
    p.dispose();
  });

  it("scales v3's point, sparks and smoke four times for the metre world", () => {
    expect(PROBE_LOOK.point).toEqual({ size: 0.14, lift: 0.032, glow: 4, core: palette.cream, whiten: 0.35 });
    expect(PROBE_LOOK.sparks).toEqual({ max: 24, life: 0.3, out: [1, 2.4], up: [0.6, 1.8], gravity: 8.8, floor: 0.008, size: 0.056, glow: 3 });
    expect(PROBE_LOOK.smoke).toEqual({ size: 0.4, rise: 0.14, opacity: 0.22, colour: palette.dim, shade: 0.45, turn: 0.4 });
    const p = buildProbe();
    const point = named<THREE.Sprite>(p, 'probe:point');
    expect(point.scale.x).toBeCloseTo(0.14, 9);
    expect((named<THREE.Points>(p, 'probe:sparks').material as THREE.PointsMaterial).size).toBeCloseTo(0.056, 9);
    expect(named<THREE.Sprite>(p, 'probe:smoke').scale.x).toBeCloseTo(0.4, 9);
    p.dispose();
  });

  it("turns off the beam, the nozzle's glow, the point, the sparks and the wisp, puts the light out, and leaves the body", () => {
    const p = buildProbe();
    const parts = ['probe:beam', 'probe:nozzle', 'probe:point', 'probe:sparks', 'probe:smoke'].map((name) => named(p, name));
    const light = named<THREE.PointLight>(p, 'probe:light');
    p.setOn(false);
    expect(parts.map((part) => part.visible)).toEqual([false, false, false, false, false]);
    expect([light.visible, light.intensity]).toEqual([true, 0]);
    expect(named(p, 'probe:body').visible).toBe(true);
    p.setOn(true);
    expect(parts.map((part) => part.visible)).toEqual([true, true, true, true, true]);
    expect([light.visible, light.intensity]).toEqual([true, PROBE_LOOK.light.intensity]);
    p.dispose();
  });

  it('flies at most 24 sparks, as many as the intensity asks, and thickens the wisp with it', () => {
    const p = buildProbe();
    const sparks = named<THREE.Points>(p, 'probe:sparks');
    const smoke = named<THREE.Sprite>(p, 'probe:smoke');
    expect(sparks.geometry.getAttribute('position').count).toBe(24);
    expect(sparks.geometry.drawRange.count).toBe(0);
    p.setSparks(0.5, 1);
    expect(sparks.geometry.drawRange.count).toBe(12);
    expect(smoke.material.opacity).toBeCloseTo(PROBE_LOOK.smoke.opacity / 2, 9);
    p.setSparks(3, 1);
    expect(sparks.geometry.drawRange.count).toBe(24);
    p.setSparks(Number.NaN, 1);
    expect(sparks.geometry.drawRange.count).toBe(0);
    expect(smoke.material.opacity).toBe(0);
    p.dispose();
  });

  it('flies the sparks from the time alone, inside their bounds and over the glass', () => {
    const a = buildProbe();
    const b = buildProbe();
    const random = vi.spyOn(Math, 'random');
    a.setSparks(1, 2.345);
    b.setSparks(1, 7);
    b.setSparks(1, 2.345);
    expect(sparkPositions(a)).toEqual(sparkPositions(b));
    expect(sparkColours(a)).toEqual(sparkColours(b));
    b.setSparks(1, 2.4);
    expect(sparkPositions(b)).not.toEqual(sparkPositions(a));
    expect(random).not.toHaveBeenCalled();
    random.mockRestore();
    const sphere = named<THREE.Points>(a, 'probe:sparks').geometry.boundingSphere!;
    expect(sphere.radius).toBeCloseTo(Math.hypot(2.4, 1.8) * 0.3, 9);
    const point = new THREE.Vector3();
    let farthest = 0;
    for (const time of [0, 0.05, 0.13, 0.29, 1.7, 40.2]) {
      a.setSparks(1, time);
      const positions = sparkPositions(a);
      for (let v = 0; v < positions.length; v += 3) {
        point.fromArray(positions, v);
        expect(sphere.containsPoint(point)).toBe(true);
        expect(positions[v + 1]).toBeGreaterThanOrEqual(PROBE_LOOK.sparks.floor - 1e-7);
        farthest = Math.max(farthest, Math.hypot(point.x, point.z));
      }
    }
    // Four times v3's reach: some fly further than v3's whole sphere (0.23).
    expect(farthest).toBeGreaterThan(0.23);
    a.dispose();
    b.dispose();
  });

  it("hides and shows its shaft by setShown, which builds shown, and keeps the light the group's own, never the shaft's", () => {
    const p = buildProbe();
    const body = named<THREE.Mesh>(p, 'probe:body');
    const light = named<THREE.PointLight>(p, 'probe:light');
    // The Opening hides the shaft once the probe is parked: its light must not go with it, or the light count would
    // change and every lit program with it (three gathers lights with traverseVisible).
    expect(light.parent).toBe(p.group);
    let under = light.parent;
    while (under) {
      expect(under).not.toBe(body);
      under = under.parent;
    }
    expect(body.visible).toBe(true);
    p.setShown(false);
    expect(body.visible).toBe(false);
    const lights: THREE.Light[] = [];
    p.group.traverseVisible((o) => {
      if ((o as THREE.Light).isLight) lights.push(o as THREE.Light);
    });
    expect(lights).toEqual([light]);
    p.setShown(true);
    expect(body.visible).toBe(true);
    p.dispose();
  });

  it('draws after the glass and before the smoke, as one group', () => {
    const p = buildProbe();
    expect(PROBE_RENDER_ORDER).toBe(1);
    expect(p.group.isGroup).toBe(true);
    expect(p.group.renderOrder).toBe(1);
    // three sorts by the nearest Group on the way down: nothing inside may be a Group of its own.
    p.group.traverse((o) => {
      if (o !== p.group) expect((o as THREE.Group).isGroup, o.name).not.toBe(true);
    });
    p.dispose();
  });

  it("frees every geometry, material, texture and the light it made, and not the sprites' shared quad", () => {
    const p = buildProbe();
    const drawn: (THREE.Mesh | THREE.Points | THREE.Sprite)[] = [];
    p.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh || (o as THREE.Points).isPoints || (o as THREE.Sprite).isSprite) drawn.push(o as THREE.Mesh);
    });
    const geometries = drawn.filter((o) => !(o as THREE.Sprite).isSprite).map((o) => vi.spyOn(o.geometry, 'dispose'));
    const materials = drawn.map((o) => vi.spyOn(o.material as THREE.Material, 'dispose'));
    const textures = new Set<THREE.Texture>();
    for (const o of drawn) {
      const map = (o.material as THREE.SpriteMaterial).map;
      if (map) textures.add(map);
    }
    const textureSpies = [...textures].map((texture) => vi.spyOn(texture, 'dispose'));
    const light = vi.spyOn(named<THREE.PointLight>(p, 'probe:light'), 'dispose');
    const shared = vi.spyOn(named<THREE.Sprite>(p, 'probe:smoke').geometry, 'dispose');
    expect(geometries).toHaveLength(3);
    expect(materials).toHaveLength(6);
    expect(textureSpies).toHaveLength(2);
    p.dispose();
    for (const spy of [...geometries, ...materials, ...textureSpies, light]) expect(spy).toHaveBeenCalled();
    expect(shared).not.toHaveBeenCalled();
  });
});

describe('the smoke', () => {
  const sprites = (s: SmokeModel) => s.group.children.filter((o): o is THREE.Sprite => (o as THREE.Sprite).isSprite);

  it('lays its puffs in layers, half of them on the low tier', () => {
    const high = buildSmoke('high');
    const medium = buildSmoke('medium');
    const low = buildSmoke('low');
    expect(high.group.name).toBe('smoke');
    expect(sprites(high)).toHaveLength(SMOKE_LOOK.layers * SMOKE_LOOK.puffs);
    expect(sprites(medium)).toHaveLength(SMOKE_LOOK.layers * SMOKE_LOOK.puffs);
    expect(sprites(low)).toHaveLength((SMOKE_LOOK.layers / 2) * SMOKE_LOOK.puffs);
    expect(SMOKE_LOOK.layers % 2).toBe(0);
    // The low tier keeps every other layer from the front (0, 2, 4 of 6): spread through the box, the back layer dropped.
    const depths = (s: SmokeModel) => [...new Set(sprites(s).map((o) => Math.round(o.userData.layer as number)))];
    expect(depths(high)).toHaveLength(SMOKE_LOOK.layers);
    expect(depths(low)).toEqual(depths(high).filter((_, i) => i % 2 === 0));
    expect(depths(low)).not.toContain(SMOKE_LOOK.layers - 1);
    // And it is the high tier's smoke, thinned: the same puffs where it keeps them.
    const lowPuffs = sprites(low).map((o) => o.position.toArray());
    const highPuffs = sprites(high).filter((o) => (o.userData.layer as number) % 2 === 0).map((o) => o.position.toArray());
    expect(lowPuffs).toEqual(highPuffs);
    for (const s of [high, medium, low]) s.dispose();
  });

  // Task 12: the box lies behind the compass, as the preview's smoke hangs in the distance, lit from far behind.
  it('keeps every puff in the box at every moment: x within 15, z from -8 to -30, wholly between the glass and 2.2', () => {
    expect(SMOKE_LOOK.box).toEqual({ x: 15, y: [0, 2.2], z: [-8, -30] });
    const s = buildSmoke('high');
    let left = 0;
    let right = 0;
    let front = -Infinity;
    let back = Infinity;
    for (let t = 0; t <= 120; t += 2.5) {
      s.setTime(t);
      for (const o of sprites(s)) {
        expect(Math.abs(o.position.x)).toBeLessThanOrEqual(15);
        expect(o.position.z).toBeLessThanOrEqual(-8);
        expect(o.position.z).toBeGreaterThanOrEqual(-30);
        expect(o.position.y - o.scale.y / 2).toBeGreaterThanOrEqual(-1e-9);
        expect(o.position.y + o.scale.y / 2).toBeLessThanOrEqual(2.2 + 1e-9);
        left = Math.min(left, o.position.x);
        right = Math.max(right, o.position.x);
        front = Math.max(front, o.position.z);
        back = Math.min(back, o.position.z);
      }
    }
    // It fills the box, not a corner of it.
    expect(left).toBeLessThan(-8);
    expect(right).toBeGreaterThan(8);
    expect(front).toBeGreaterThan(-11);
    expect(back).toBeLessThan(-27);
    // Layers, not balls: every puff far wider than it is tall.
    for (const o of sprites(s)) expect(o.scale.x).toBeGreaterThan(3 * o.scale.y);
    s.dispose();
  });

  it('stays clear of the compass: no layer passes through its bands', () => {
    const s = buildSmoke('high');
    for (let t = 0; t <= 60; t += 1.5) {
      s.setTime(t);
      for (const o of sprites(s)) expect(Math.abs(o.position.z)).toBeGreaterThan(1.6);
    }
    s.dispose();
  });

  it('drifts on a 60 s period: the same picture a minute on, a different one in between, from the time alone', () => {
    expect(SMOKE_LOOK.period).toBe(60);
    const s = buildSmoke('high');
    const picture = () => sprites(s).flatMap((o) => [o.position.x, o.position.y, o.position.z, o.material.opacity, o.material.rotation]);
    const random = vi.spyOn(Math, 'random');
    s.setTime(17);
    const first = picture();
    s.setTime(32);
    const between = picture();
    s.setTime(77);
    const later = picture();
    expect(random).not.toHaveBeenCalled();
    random.mockRestore();
    later.forEach((v, i) => expect(v).toBeCloseTo(first[i], 6));
    expect(between).not.toEqual(first);
    // Slow: a puff moves at most a few centimetres a frame.
    s.setTime(17 + 1 / 60);
    const next = picture();
    for (let i = 0; i < first.length; i += 5) expect(Math.abs(next[i] - first[i])).toBeLessThan(0.01);
    // Two builds are the same smoke; NaN reads as 0.
    const other = buildSmoke('high');
    other.setTime(17);
    s.setTime(17);
    expect(sprites(other).map((o) => o.position.toArray())).toEqual(sprites(s).map((o) => o.position.toArray()));
    s.setTime(0);
    const zero = picture();
    s.setTime(Number.NaN);
    expect(picture()).toEqual(zero);
    s.dispose();
    other.dispose();
  });

  it("sheds the low tier's layers when it steps down to it: the same smoke as one built low, the rest freed", () => {
    for (const from of ['high', 'medium'] as const) {
      const s = buildSmoke(from);
      const shed = sprites(s).filter((o) => (o.userData.layer as number) % 2 === 1);
      const freed = shed.map((o) => vi.spyOn(o.material, 'dispose'));
      s.setTier('low');
      for (const spy of freed) expect(spy).toHaveBeenCalledOnce();
      for (const o of shed) expect(o.parent).toBeNull();
      const low = buildSmoke('low');
      for (const smoke of [s, low]) {
        smoke.setDensity(0.6);
        smoke.setTime(23);
      }
      const picture = (smoke: SmokeModel) => sprites(smoke).map((o) => [o.userData.layer, ...o.position.toArray(), o.material.opacity, o.scale.x]);
      expect(picture(s), from).toEqual(picture(low));
      s.dispose();
      low.dispose();
    }
  });

  it('keeps every puff on a step to medium, and never takes a layer back: the ladder only goes down', () => {
    const s = buildSmoke('high');
    const all = sprites(s).length;
    s.setTier('medium');
    expect(sprites(s)).toHaveLength(all);
    s.setTier('low');
    s.setTier('high');
    s.setTier('medium');
    expect(sprites(s)).toHaveLength(all / 2);
    // Freeing the smoke frees the puffs it still holds, and the ones it shed no second time.
    const kept = sprites(s).map((o) => vi.spyOn(o.material, 'dispose'));
    s.dispose();
    for (const spy of kept) expect(spy).toHaveBeenCalledOnce();
  });

  it('thickens with setDensity, held to 0..1, and keeps its density through the drift', () => {
    const s = buildSmoke('medium');
    const opacities = () => sprites(s).map((o) => o.material.opacity);
    s.setTime(9);
    s.setDensity(1);
    const full = opacities();
    for (const o of full) {
      expect(o).toBeGreaterThan(0);
      expect(o).toBeLessThanOrEqual(SMOKE_LOOK.opacity[1]);
    }
    s.setDensity(0.5);
    opacities().forEach((o, i) => expect(o).toBeCloseTo(full[i] / 2, 9));
    s.setTime(9);
    opacities().forEach((o, i) => expect(o).toBeCloseTo(full[i] / 2, 9));
    s.setDensity(4);
    opacities().forEach((o, i) => expect(o).toBeCloseTo(full[i], 9));
    s.setDensity(Number.NaN);
    expect(opacities().every((o) => o === 0)).toBe(true);
    s.setDensity(-1);
    expect(opacities().every((o) => o === 0)).toBe(true);
    s.dispose();
  });

  // Task 12: the lilac at 0.2 read as a grey haze; the preview's smoke is blue-violet, the haze token, and fainter
  // per unit (its luma) than the lilac, so it is dimmed less.
  it('is the haze dimmed, added to what is behind, testing depth but writing none, out of the fog', () => {
    const s = buildSmoke('high');
    const expected = new THREE.Color(palette.haze).multiplyScalar(SMOKE_LOOK.dim);
    expect(SMOKE_LOOK.colour).toBe(palette.haze);
    expect(SMOKE_LOOK.dim).toBeGreaterThan(0);
    expect(SMOKE_LOOK.dim).toBeLessThan(1);
    const textures = new Set<THREE.Texture | null>();
    for (const o of sprites(s)) {
      const m = o.material;
      expect(m.color.equals(expected)).toBe(true);
      expect(m.blending).toBe(THREE.AdditiveBlending);
      expect(m.transparent).toBe(true);
      expect(m.depthWrite).toBe(false);
      expect(m.depthTest).toBe(true);
      expect(m.fog).toBe(false);
      textures.add(m.map);
    }
    expect(textures.size).toBe(1);
    expect([...textures][0]).toBeInstanceOf(THREE.DataTexture);
    s.dispose();
  });

  it('draws after the probe as one group, and ignores the pointer', () => {
    const s = buildSmoke('low');
    expect(SMOKE_RENDER_ORDER).toBe(2);
    expect(SMOKE_RENDER_ORDER).toBeGreaterThan(PROBE_RENDER_ORDER);
    expect(s.group.isGroup).toBe(true);
    expect(s.group.renderOrder).toBe(2);
    const hits: THREE.Intersection[] = [];
    const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 0.8, 30), new THREE.Vector3(0, 0, -1));
    raycaster.camera = new THREE.PerspectiveCamera();
    for (const o of sprites(s)) o.raycast(raycaster, hits);
    expect(hits).toHaveLength(0);
    s.dispose();
  });

  it("frees its materials and its texture, and not the sprites' shared quad", () => {
    const s = buildSmoke('high');
    const materials = sprites(s).map((o) => vi.spyOn(o.material, 'dispose'));
    const texture = vi.spyOn(sprites(s)[0].material.map!, 'dispose');
    const shared = vi.spyOn(sprites(s)[0].geometry, 'dispose');
    s.dispose();
    for (const spy of [...materials, texture]) expect(spy).toHaveBeenCalled();
    expect(shared).not.toHaveBeenCalled();
  });
});

describe("the builders' colours", () => {
  it('are named in no builder: no hex colour and no colour made from bare numbers', () => {
    for (const file of ['compass', 'probe', 'smoke']) {
      const source = readFileSync(fileURLToPath(new URL(`../../../src/engine/bob/build/${file}.ts`, import.meta.url)), 'utf8');
      expect(source, file).not.toMatch(/\b0x[0-9a-f]{6}\b/i);
      expect(source, file).not.toMatch(/Color\(\s*[\d.]+\s*,/);
    }
  });
});

describe('the needle through a scroll off the home, as Home drives it', () => {
  /**
   * The hover-the-cue flow: the needle settled at 2.2, the pointer moves to the SCROLL cue straight below the pivot
   * (pi - 0.01), and 0.3 s later the wheel turns, a 120 px notch on a 900 px window every 0.3 s until the story is past
   * the HOME unit. Each frame is Home's: the story damped as the scroll loop damps it, the rise and the pose from it, the
   * target moved only where the needle aims, the spring stepped toward it, and the compass handed needleAngleAt, the dip
   * and the iris. Answers the most the needle's world pose turned in one frame, how often the wrapped spring crossed
   * straight down while the dip was partway, and the compass at the end.
   */
  function hoverCueThenScroll(handed: (value: number, target: number, u: number) => number) {
    const c = loadCompass(fakeGltf(), 'high', stripStub);
    c.setRise(1);
    const spring = new AngleSpring(NEEDLE_SPRING.zeta, NEEDLE_SPRING.omega);
    spring.set(2.2, 0);
    let target = 2.2;
    const pointer = Math.PI - 0.01;
    const story = { progress: 0 };
    let goal = 0;
    const dt = 1 / 60;
    const needle = node(c, 'needle');
    const before = new THREE.Quaternion();
    const now = new THREE.Quaternion();
    let worst = 0;
    let crossings = 0;
    let previous = spring.value;
    const frames = Math.round((0.3 + 3) * 60);
    /** The frames a notch turns on: 0.3 s in, then every 0.3 s. */
    const notches = new Set(Array.from({ length: 10 }, (_, k) => Math.round((0.3 + 0.3 * k) * 60)));
    for (let i = 0; i < frames; i++) {
      if (notches.has(i) && goal < 1) goal = moveTarget(goal, 120 / 900, HOME_CHAPTERS, false);
      damp(story, 'progress', goal, 0.25, dt, Number.POSITIVE_INFINITY, undefined, 1e-4);
      const u = riseAt(story.progress);
      const pose = scrollPoseAt(u, 16 / 9);
      if (aimsAt('HOME_IDLE', 'home', u)) target = pointer;
      const value = spring.step(target, dt);
      c.setNeedle(handed(value, target, u));
      c.setNeedleDip(pose.needleDip);
      c.setIris(pose.iris);
      if (pose.needleDip > 0 && pose.needleDip < 1 && Math.abs(value) > Math.PI / 2 && Math.sign(value) !== Math.sign(previous)) crossings++;
      previous = value;
      c.group.updateMatrixWorld(true);
      needle.getWorldQuaternion(now);
      if (i > 0) worst = Math.max(worst, angleOf(before.clone().invert().multiply(now)));
      before.copy(now);
    }
    return { c, worst, crossings, story };
  }

  it('turns down from a pointer straight below the pivot with no roll flip, and ends straight down', () => {
    const { c, worst, crossings, story } = hoverCueThenScroll(needleAngleAt);
    // The flow is the one that flipped: the spring crosses straight down while the needle is partway down.
    expect(crossings).toBeGreaterThanOrEqual(1);
    // No frame turns the needle more than the dip and the spring move it: a flip is a roll of 2 pi times the eased dip.
    expect(worst).toBeLessThan(0.15);
    expect(story.progress).toBeGreaterThanOrEqual(1);
    expect(tipDirection(c).distanceTo(DOWN)).toBeLessThan(1e-6);
    c.dispose();
  });

  it("keeps the dip's side while it dips even when handed the spring's wrapped angle: the compass's own guard", () => {
    // Before the guard, the wrap in poseNeedle turned this flow's needle 1.29 rad in one frame, Home's unwrapping or not.
    const { c, worst, crossings } = hoverCueThenScroll((value) => wrapAngle(value));
    expect(crossings).toBeGreaterThanOrEqual(1);
    expect(worst).toBeLessThan(0.15);
    expect(tipDirection(c).distanceTo(DOWN)).toBeLessThan(1e-6);
    c.dispose();
  });

  it('starts each dip from the angle wrapped to [-pi, pi] again, so a dip after the home has the side the angle gives', () => {
    const fresh = loadCompass(fakeGltf(), 'high', stripStub);
    fresh.setNeedle(-3);
    fresh.setNeedleDip(0.4);
    const expected = node(fresh, 'needle').quaternion.clone();
    // A dip that went on round past straight down, then back out of it at the home, then down again from -3.
    const c = loadCompass(fakeGltf(), 'high', stripStub);
    c.setNeedle(3);
    c.setNeedleDip(0.4);
    c.setNeedle(3.3);
    c.setNeedleDip(0);
    c.setNeedle(-3);
    c.setNeedleDip(0.4);
    expect(angleOf(expected.invert().multiply(node(c, 'needle').quaternion))).toBeLessThan(1e-9);
    fresh.dispose();
    c.dispose();
  });
});

describe('the needle leaves the compass (setNeedleWorld, Task 9)', () => {
  const ASPECT = 16 / 9;
  const ANGLES = [0, 0.3, 1, -2.5, Math.PI, -Math.PI, 7];

  /** A part's world matrix, as sixteen numbers. */
  function worldMatrix(c: CompassModel, name: string): number[] {
    c.group.updateMatrixWorld(true);
    return node(c, name).matrixWorld.toArray();
  }

  /** The most two matrices differ by in any element. */
  function matrixGap(a: number[], b: number[]): number {
    let gap = 0;
    for (let i = 0; i < 16; i++) gap = Math.max(gap, Math.abs(a[i]! - b[i]!));
    return gap;
  }

  /** A part's local pose, as numbers: position, quaternion and scale. */
  function localPose(c: CompassModel, name: string): number[] {
    const o = node(c, name);
    return [...o.position.toArray(), ...o.quaternion.toArray(), ...o.scale.toArray()];
  }

  /** A part's world position, quaternion and scale. */
  function worldPose(c: CompassModel, name: string) {
    c.group.updateMatrixWorld(true);
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    node(c, name).matrixWorld.decompose(position, quaternion, scale);
    return { position, quaternion, scale };
  }

  /** The compass posed as Home poses it at scroll `progress` (the rise, the iris and the dip), the needle at `angle`. */
  function poseAsHome(c: CompassModel, progress: number, angle: number): void {
    const pose = scrollPoseAt(riseAt(progress), ASPECT);
    c.setRise(pose.u);
    c.setNeedle(angle);
    c.setNeedleDip(pose.needleDip);
    c.setIris(pose.iris);
  }


  it("is the armillary's needle exactly with null, at any setNeedle, setNeedleDip, setIris and setRise, whenever null is handed in", () => {
    for (const rise of [1, 0.25]) {
      for (const angle of ANGLES) {
        for (const dip of [0, 0.4, 1]) {
          for (const iris of [0, 0.6, 1]) {
            const c = loadCompass(fakeGltf(), 'high', stripStub);
            const today = loadCompass(fakeGltf(), 'high', stripStub);
            c.setNeedleWorld(null);
            for (const m of [c, today]) {
              m.setRise(rise);
              m.setNeedle(angle);
              m.setNeedleDip(dip);
              m.setIris(iris);
            }
            c.setNeedleWorld(null);
            const label = `rise ${rise}, angle ${angle}, dip ${dip}, iris ${iris}`;
            for (const name of ['needle', 'pivot']) {
              expect(localPose(c, name), `${name} local, ${label}`).toEqual(localPose(today, name));
              expect(worldMatrix(c, name), `${name} world, ${label}`).toEqual(worldMatrix(today, name));
            }
            c.dispose();
            today.dispose();
          }
        }
      }
    }
  });

  it("puts the needle at the override's world position and scale, its tip on the aim, and takes the pivot along", async () => {
    const at = new THREE.Vector3(1, -3, 2);
    for (const gltf of [fakeGltf(), await loadRealGlb()]) {
      for (const [rise, iris, moved] of [
        [1, 1, false],
        [1, 0, false],
        [0.25, 0.3, false],
        [1, 1, true]
      ] as const) {
        const c = loadCompass(gltf, 'high', stripStub);
        if (moved) {
          // The host's own transform on the group: the override is in the world, not in the group.
          c.group.position.set(0.5, -1, 2.5);
          c.group.rotation.set(0.3, 0.5, -0.2);
          c.group.scale.setScalar(1.3);
        }
        c.setRise(rise);
        c.setIris(iris);
        c.setNeedle(1.1);
        c.setNeedleDip(0.5);
        for (const aim of [[4, 1, -5], [0.5, 4, -3], [-4, -3, 2.5], [1, -9, 2], [1.0000001, -2, 2]] as const) {
          c.setNeedleWorld({ position: [at.x, at.y, at.z], scale: 1.9, aim });
          const label = `aim ${aim} at rise ${rise}, iris ${iris}${moved ? ', moved' : ''}`;
          const wanted = new THREE.Vector3(...aim).sub(at).normalize();
          expect(tipDirection(c).distanceTo(wanted), label).toBeLessThan(1e-6);
          for (const name of ['needle', 'pivot']) {
            const { position, scale } = worldPose(c, name);
            expect(position.distanceTo(at), `${name} position, ${label}`).toBeLessThan(1e-6);
            expect(scale.distanceTo(new THREE.Vector3(1.9, 1.9, 1.9)), `${name} scale, ${label}`).toBeLessThan(1e-6);
          }
        }
        // No aim: straight down, in the world, whatever the group does.
        c.setNeedleWorld({ position: [at.x, at.y, at.z], scale: 1.9, aim: null });
        expect(tipDirection(c).distanceTo(DOWN), `down at rise ${rise}`).toBeLessThan(1e-6);
        // An aim on the pivot itself has no direction to give: it reads as straight down, and nothing is NaN.
        c.setNeedleWorld({ position: [at.x, at.y, at.z], scale: 1.9, aim: [at.x, at.y, at.z] });
        expect(tipDirection(c).distanceTo(DOWN), `aim on the pivot at rise ${rise}`).toBeLessThan(1e-6);
        expect(worldMatrix(c, 'needle').every(Number.isFinite)).toBe(true);
        c.dispose();
      }
    }
  });

  it('poses the override in the world, not the group: the same needle however the host moves the group', () => {
    const plain = loadCompass(fakeGltf(), 'high', stripStub);
    const moved = loadCompass(fakeGltf(), 'high', stripStub);
    moved.group.position.set(2, 3, -4);
    moved.group.rotation.set(1, -0.4, 0.8);
    const override: NeedleOverride = { position: [1, -3, 2], scale: 1.9, aim: [4, 1, -5] };
    plain.setNeedleWorld(override);
    moved.setNeedleWorld(override);
    expect(matrixGap(worldMatrix(plain, 'needle'), worldMatrix(moved, 'needle'))).toBeLessThan(1e-6);
    plain.dispose();
    moved.dispose();
  });

  it('gives back the armillary pose exactly on null: the needle and the pivot as setNeedle and setNeedleDip left them', () => {
    for (const rise of [1, 0.25]) {
      for (const angle of [0, 1.7, -2.5, Math.PI]) {
        for (const dip of [0, 0.4, 1]) {
          const c = loadCompass(fakeGltf(), 'high', stripStub);
          c.setRise(rise);
          c.setIris(0.8);
          c.setNeedle(angle);
          c.setNeedleDip(dip);
          const needle = localPose(c, 'needle');
          const pivot = localPose(c, 'pivot');
          const needleWorld = worldMatrix(c, 'needle');
          for (const aim of [null, [5, 2, -3] as const]) {
            c.setNeedleWorld({ position: [1, -3, 2], scale: 1.9, aim });
            c.setNeedleWorld(null);
            const label = `rise ${rise}, angle ${angle}, dip ${dip}, aim ${aim}`;
            expect(localPose(c, 'needle'), `needle, ${label}`).toEqual(needle);
            expect(localPose(c, 'pivot'), `pivot, ${label}`).toEqual(pivot);
            expect(worldMatrix(c, 'needle'), `world, ${label}`).toEqual(needleWorld);
          }
          c.dispose();
        }
      }
    }
  });

  it('lets the override win while it is set, and setNeedle, setNeedleDip, setRise and setIris keep their values for null', () => {
    const c = loadCompass(fakeGltf(), 'high', stripStub);
    const twin = loadCompass(fakeGltf(), 'high', stripStub);
    c.setRise(1);
    c.setIris(1);
    c.setNeedle(0.4);
    c.setNeedleDip(1);
    c.setNeedleWorld({ position: [1, -3, 2], scale: 1.9, aim: [4, 1, -5] });
    const needle = worldMatrix(c, 'needle');
    const pivot = worldMatrix(c, 'pivot');
    // Everything the home's frame says while the override is held leaves it where it stands, the armillary moving under it.
    for (const call of [
      () => c.setRise(0.5),
      () => c.setIris(0.2),
      () => c.setNeedle(-2.2),
      () => c.setNeedleDip(0.3),
      () => c.setRise(0.9),
      () => c.setIris(0.7),
      () => c.setNeedle(3.1),
      () => c.setNeedleDip(0)
    ]) {
      call();
      expect(matrixGap(worldMatrix(c, 'needle'), needle)).toBeLessThan(1e-7);
      expect(matrixGap(worldMatrix(c, 'pivot'), pivot)).toBeLessThan(1e-7);
    }
    // And cleared, the compass is the one those calls alone would have made.
    c.setNeedleWorld(null);
    twin.setRise(0.9);
    twin.setIris(0.7);
    twin.setNeedle(3.1);
    twin.setNeedleDip(0);
    for (const name of ['needle', 'pivot']) {
      expect(localPose(c, name), name).toEqual(localPose(twin, name));
      expect(worldMatrix(c, name), name).toEqual(worldMatrix(twin, name));
    }
    c.dispose();
    twin.dispose();
  });

  it('moves the needle and the pivot only: the bands, rims and axis stay in the armillary', () => {
    const c = loadCompass(fakeGltf(), 'high', stripStub);
    c.setIris(1);
    const names = COMPASS_PARTS.filter((name) => name !== 'needle' && name !== 'pivot');
    const before = names.map((name) => worldMatrix(c, name));
    c.setNeedleWorld({ position: [1, -3, 2], scale: 1.9, aim: [4, 1, -5] });
    names.forEach((name, i) => expect(worldMatrix(c, name), name).toEqual(before[i]));
    c.dispose();
  });

  describe('in the light dive: the needle gives itself to the light over way frames 2-8', () => {
    /** The needle the Void hands the compass at way frame f. */
    const atFrame = (f: number) => needleFor(journeyPoseAt(placeOfFrame(f), ASPECT));

    it("keeps the armillary's needle up to frame 2, and from there holds it at the pivot, (0, 0.09, 0), its tip straight down", () => {
      expect(atFrame(1)).toBeNull();
      expect(atFrame(2)).toBeNull();
      const o = atFrame(2.01)!;
      expect(o.position).toEqual([0, 0.09, 0]);
      expect(o.scale).toBeCloseTo(1, 3);
      expect(o.aim).toBeNull();
    });

    it('is the fully dipped needle, in position, scale and roll, from any angle: no jump when null becomes the override', async () => {
      const handed = { ...atFrame(2.01)!, scale: 1 };
      for (const gltf of [fakeGltf(), await loadRealGlb()]) {
        for (const angle of ANGLES) {
          const c = loadCompass(gltf, 'high', stripStub);
          poseAsHome(c, 1, angle);
          const needle = worldMatrix(c, 'needle');
          const pivot = worldMatrix(c, 'pivot');
          c.setNeedleWorld(handed);
          expect(matrixGap(worldMatrix(c, 'needle'), needle), `needle from ${angle}`).toBeLessThan(1e-6);
          expect(matrixGap(worldMatrix(c, 'pivot'), pivot), `pivot from ${angle}`).toBeLessThan(1e-6);
          poseAsHome(c, 1, angle);
          expect(matrixGap(worldMatrix(c, 'needle'), needle), `needle again from ${angle}`).toBeLessThan(1e-6);
          c.dispose();
        }
      }
    });

    it('shrinks it at the pivot to nothing by frame 8, holding its roll, and keeps it so through the fall', async () => {
      const c = loadCompass(await loadRealGlb(), 'high', stripStub);
      poseAsHome(c, 1, 0.8);
      const start = worldPose(c, 'needle').quaternion.clone();
      for (let f = 2.05; f <= 8; f += 0.05) {
        const o = atFrame(f)!;
        c.setNeedleWorld(o);
        if (o.scale === 0) {
          // Nothing left of it: a matrix of no size has no turn to read, only its size.
          expect(node(c, 'needle').scale.length(), `scale at ${f}`).toBe(0);
          continue;
        }
        const { position, quaternion, scale } = worldPose(c, 'needle');
        if (o.scale > 1e-3) expect(angleOf(start.clone().invert().multiply(quaternion)), `roll at ${f}`).toBeLessThan(1e-5);
        expect(position.distanceTo(new THREE.Vector3(...o.position)), `position at ${f}`).toBeLessThan(1e-6);
        expect(scale.x, `scale at ${f}`).toBeCloseTo(o.scale, 6);
      }
      for (const f of [8, 61, 200, 271]) expect(atFrame(f)!.scale, `frame ${f}`).toBe(0);
      c.dispose();
    });
  });

  describe('a needle held in the world, turning', () => {
    /** The most the needle's world orientation turns between neighbouring poses handed in, in degrees. */
    function sweep(c: CompassModel, poses: Iterable<NeedleOverride>): number {
      const before = new THREE.Quaternion();
      const now = new THREE.Quaternion();
      let first = true;
      let worst = 0;
      for (const o of poses) {
        c.setNeedleWorld(o);
        c.group.updateMatrixWorld(true);
        node(c, 'needle').getWorldQuaternion(now);
        if (!first) worst = Math.max(worst, angleOf(before.clone().invert().multiply(now)) / DEG);
        first = false;
        before.copy(now);
      }
      return worst;
    }

    it('turns without a flip along a great circle through straight down, from either side of it', () => {
      const c = loadCompass(fakeGltf(), 'high', stripStub);
      const at: [number, number, number] = [-1.4, -7.8, -0.8];
      for (const plane of [0, 0.7, 2.1]) {
        const poses = function* (): Generator<NeedleOverride> {
          for (let tenths = -800; tenths <= 800; tenths++) {
            const t = (tenths / 10) * DEG;
            yield {
              position: at,
              scale: 1.9,
              aim: [at[0] + 3 * Math.sin(t) * Math.cos(plane), at[1] - 3 * Math.cos(t), at[2] + 3 * Math.sin(t) * Math.sin(plane)]
            };
          }
        };
        expect(sweep(c, poses()), `plane ${plane}`).toBeLessThan(0.11);
      }
      c.dispose();
    });

  });

  it('allocates nothing in a call: scratch only, whichever way it goes', async () => {
    // Every math object the compass makes goes through three's Vector3, Quaternion, Matrix4 and Euler; a counting copy
    // of them stands in for three's own while the compass is loaded fresh, and the calls must not construct one.
    const made = { count: 0 };
    vi.resetModules();
    vi.doMock('three', () => {
      // This file's own three, not a second copy of it: the fake glTF it builds is made of the same classes.
      const actual = THREE;
      const counted = <C extends new (...args: never[]) => object>(Base: C): C =>
        class extends (Base as unknown as new (...args: unknown[]) => object) {
          constructor(...args: unknown[]) {
            super(...args);
            made.count++;
          }
        } as unknown as C;
      return {
        ...actual,
        Vector3: counted(actual.Vector3),
        Quaternion: counted(actual.Quaternion),
        Matrix4: counted(actual.Matrix4),
        Euler: counted(actual.Euler)
      };
    });
    try {
      const counting = await import('three');
      const probe = made.count;
      void new counting.Vector3();
      expect(made.count, 'the counting stands in for three').toBe(probe + 1);
      const { loadCompass: load } = await import('~/engine/bob/build/compass');
      const c = load(fakeGltf(), 'high', stripStub);
      const calls: NeedleOverride[] = [
        { position: [0, 0.09, 0], scale: 1, aim: null },
        { position: [1, -3, 2], scale: 1.9, aim: [4, 1, -5] },
        { position: [-1.4, -7.8, -0.8], scale: 1.9, aim: [0.8, -6.5, -2.2] },
        { position: [1, -3, 2], scale: 1.9, aim: [1, -3, 2] }
      ];
      // Warm: the first call of each may build lazily.
      for (const o of calls) c.setNeedleWorld(o);
      c.setNeedleWorld(null);
      const before = made.count;
      for (let i = 0; i < 200; i++) {
        for (const o of calls) {
          c.setNeedleWorld(o);
          c.setNeedle(i * 0.1);
          c.setNeedleDip((i % 5) / 4);
          c.setIris((i % 7) / 6);
          c.setRise((i % 3) / 2);
        }
        c.setNeedleWorld(null);
      }
      expect(made.count - before).toBe(0);
      c.dispose();
    } finally {
      vi.doUnmock('three');
      vi.resetModules();
    }
  });
});

describe('the glass top fading as the light dive comes down (setTopFade)', () => {
  const bandGlass = (c: CompassModel, k: number) => (node(c, `band_${k}`) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>).material;
  const gold = (c: CompassModel) => (node(c, 'rim_1') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>).material;
  const needleGold = (c: CompassModel) => (node(c, 'needle') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>).material;

  it("dims the bands' and the rims' glow with it, and leaves the needle's own", () => {
    const c = loadCompass(fakeGltf(), 'high', stripStub);
    const bands = [1, 2, 3, 4].map((k) => bandGlass(c, k).emissiveIntensity);
    const rims = gold(c).emissiveIntensity;
    const needle = needleGold(c).emissiveIntensity;
    c.setTopFade(0.25);
    [1, 2, 3, 4].forEach((k, i) => expect(bandGlass(c, k).emissiveIntensity).toBeCloseTo(bands[i]! * 0.75, 12));
    expect(gold(c).emissiveIntensity).toBeCloseTo(rims * 0.75, 12);
    expect(needleGold(c).emissiveIntensity).toBe(needle);
    c.dispose();
  });

  it('darkens the gold itself with it, so the rims, lit metal, go dark as the previs\'s top lights do', () => {
    const c = loadCompass(fakeGltf(), 'high', stripStub);
    const rest = gold(c).color.clone();
    c.setTopFade(0.75);
    expect(gold(c).color.r).toBeCloseTo(rest.r * 0.25, 12);
    expect(gold(c).color.g).toBeCloseTo(rest.g * 0.25, 12);
    expect(needleGold(c).color.r).toBeCloseTo(rest.r, 12); // the needle's own brass is the light's
    c.setTopFade(0);
    expect(gold(c).color.equals(rest)).toBe(true);
    c.dispose();
  });

  it("lets the void through the fading bands: their glass writes no depth while the top fades, and does again at home", () => {
    const c = loadCompass(fakeGltf(), 'high', stripStub);
    expect(bandGlass(c, 1).depthWrite).toBe(true); // the high tier's transmission writes depth
    c.setTopFade(0.1);
    for (const k of [1, 2, 3, 4]) expect(bandGlass(c, k).depthWrite, `band_${k}`).toBe(false);
    c.setTier('medium');
    expect(bandGlass(c, 1).depthWrite).toBe(false);
    c.setTopFade(0);
    expect(bandGlass(c, 1).depthWrite).toBe(true);
    c.dispose();
  });

  it("fades the bands' glass with it, lit as it is by the room, and keeps that through the reveal and a tier's step", () => {
    const c = loadCompass(fakeGltf(), 'high', stripStub);
    const rest = bandGlass(c, 1).opacity;
    c.setTopFade(0.5);
    expect(bandGlass(c, 1).opacity).toBeCloseTo(rest * 0.5, 12);
    c.setReveal(1);
    expect(bandGlass(c, 1).opacity).toBeCloseTo(rest * 0.5, 12);
    c.setTier('medium');
    expect(bandGlass(c, 1).opacity).toBeCloseTo(COMPASS_LOOK.bandGlass.opacity.medium * 0.5, 12);
    c.setTopFade(0);
    expect(bandGlass(c, 1).opacity).toBeCloseTo(COMPASS_LOOK.bandGlass.opacity.medium, 12);
    c.dispose();
  });

  it("dresses the pivot in the needle's brass while the journey holds the needle, so it glows with it and the top's dark never reaches it", () => {
    const c = loadCompass(fakeGltf(), 'high', stripStub);
    const pivot = () => (node(c, 'pivot') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>).material;
    expect(pivot()).toBe(gold(c)); // at home it holds still with the rims
    c.setTopFade(1);
    c.setNeedleWorld({ position: [0, -11, 0], scale: 2, aim: [0, -11, 5.5] });
    expect(pivot()).toBe(needleGold(c));
    c.setNeedleGlow(2.5);
    expect(pivot().emissiveIntensity).toBeCloseTo(COMPASS_LOOK.gold.emissiveIntensity * 2.5, 12);
    expect(pivot().color.r).toBeGreaterThan(0);
    c.setNeedleWorld(null);
    expect(pivot()).toBe(gold(c));
    c.dispose();
  });

  it('takes the bands, their rims and the axis out at 1, and leaves the needle and the pivot where the light needs them', () => {
    const c = loadCompass(fakeGltf(), 'high', stripStub);
    c.setTopFade(1);
    for (const k of [1, 2, 3, 4]) expect(node(c, `band_${k}`).visible, `band_${k}`).toBe(false);
    expect(node(c, 'axis').visible).toBe(false);
    for (const name of ['needle', 'pivot']) expect(node(c, name).visible, name).toBe(true);
    c.setTopFade(0);
    for (const k of [1, 2, 3, 4]) expect(node(c, `band_${k}`).visible).toBe(true);
    expect(node(c, 'axis').visible).toBe(true);
    c.setTopFade(Number.NaN);
    expect(node(c, 'band_1').visible).toBe(true);
    c.dispose();
  });
});
