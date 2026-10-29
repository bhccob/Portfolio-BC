import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { COMPASS_LOOK } from '~/engine/bob/build/compass';
import { buildEngraving, ENGRAVING_LOOK } from '~/engine/bob/build/engraving';
import { densePath, RINGEN, tickPlaces } from '~/engine/bob/letterBands';
import { strokePath, type StrokeId, WORDMARK } from '~/engine/bob/wordmark';
import { palette } from '~/engine/palette';

/** The four strokes of the two B letters: everything but the circle. */
const LETTERS: StrokeId[] = ['leftB', 'leftBar', 'rightB', 'rightBar'];

/** The part called `name`, which must exist. */
function part<M extends THREE.Material>(root: THREE.Object3D, name: string): THREE.Mesh<THREE.BufferGeometry, M> {
  const found = root.getObjectByName(name);
  expect(found, name).toBeDefined();
  return found as THREE.Mesh<THREE.BufferGeometry, M>;
}

/** The letters' three parts: the bands' glass, their gold rims and their ticks. */
const PARTS = ['letters:glass', 'letters:rims', 'letters:ticks'] as const;

/** The shader three would start compiling for a material of `material`'s kind, after the material's patch has had its say. */
function compiled(material: THREE.Material) {
  const lib = material instanceof THREE.MeshPhysicalMaterial ? THREE.ShaderLib.physical : material instanceof THREE.MeshStandardMaterial ? THREE.ShaderLib.standard : THREE.ShaderLib.basic;
  const shader = { uniforms: {} as Record<string, THREE.IUniform>, vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader };
  material.onBeforeCompile(shader as never, {} as never);
  return shader;
}

function expectColour(actual: THREE.Color, expected: THREE.Color): void {
  expect(actual.r).toBeCloseTo(expected.r, 6);
  expect(actual.g).toBeCloseTo(expected.g, 6);
  expect(actual.b).toBeCloseTo(expected.b, 6);
}

describe('the B letters as Ringen', () => {
  // Spec 2026-10-29-bob-stack-2-design.md, goal 5: three bands to a stroke, the compass's band glass, gold rims along
  // both edges of each, the band's ticks on the outer edges; lit less than the mock-up, for the darkness gate.
  it('builds the B strokes as Ringen: glass, two rims and ticks per band', () => {
    const e = buildEngraving();
    const half = RINGEN.width / 2;
    let points = 0;
    let ticks = 0;
    for (const id of LETTERS) {
      points += densePath(strokePath(id), RINGEN.dense).length;
      // The outer edges of the outer bands, both.
      for (const d of [RINGEN.bands[0] - half, RINGEN.bands[2] + half]) ticks += tickPlaces(strokePath(id), d, RINGEN.ticks.reach * RINGEN.width).length;
    }
    const glass = part<THREE.MeshPhysicalMaterial>(e.group, 'letters:glass');
    const rims = part<THREE.MeshStandardMaterial>(e.group, 'letters:rims');
    const marks = part<THREE.MeshBasicMaterial>(e.group, 'letters:ticks');
    // Three bands to a stroke, two vertices to a point along it; two rims to a band; four corners to a tick.
    expect(glass.geometry.getAttribute('position').count).toBe(points * 2 * 3);
    expect(rims.geometry.getAttribute('position').count).toBe(points * 2 * 3 * 2);
    expect(marks.geometry.getAttribute('position').count).toBe(ticks * 4);
    // Glass under the rims, the ticks over both.
    const ys = (mesh: THREE.Mesh) => new Set(Array.from({ length: mesh.geometry.getAttribute('position').count }, (_, i) => mesh.geometry.getAttribute('position').getY(i)));
    expect([...ys(glass)]).toEqual([Math.fround(RINGEN.lift.glass)]);
    expect([...ys(rims)]).toEqual([Math.fround(RINGEN.lift.rim)]);
    expect([...ys(marks)]).toEqual([Math.fround(RINGEN.lift.ticks)]);
    // The compass's smoked violet band glass, the mock-up's: × 0.32, 0.78 opaque, emissive 0.08.
    expect(glass.material).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    expectColour(glass.material.color, new THREE.Color(COMPASS_LOOK.bandGlass.colour).multiplyScalar(0.32));
    expect(glass.material.transparent).toBe(true);
    expect(glass.material.opacity).toBe(0.78);
    expect([glass.material.roughness, glass.material.metalness, glass.material.transmission]).toEqual([0.32, 0.15, 0]);
    expect(glass.material.emissiveIntensity).toBeCloseTo(0.08, 9);
    expectColour(glass.material.emissive, new THREE.Color(COMPASS_LOOK.bandGlass.emissive));
    // The compass's gold at its own emissive, 0.22; the ticks gold light × 0.75. Lit by the compass's own room (the scene's environment).
    expect(rims.material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expectColour(rims.material.color, new THREE.Color(COMPASS_LOOK.gold.colour));
    expect([rims.material.metalness, rims.material.roughness]).toEqual([1, COMPASS_LOOK.gold.roughness]);
    expect(rims.material.emissiveIntensity).toBeCloseTo(COMPASS_LOOK.gold.emissiveIntensity, 9);
    expect(glass.material.envMap).toBeNull();
    expect(rims.material.envMap).toBeNull();
    expectColour(marks.material.color, new THREE.Color(palette.goldLight).multiplyScalar(0.75));
    e.dispose();
  });

  it('shows nothing of a B before the light reaches it', () => {
    const e = buildEngraving();
    const letters = part(e.group, 'letters:glass').parent!;
    const front = compiled(part(e.group, 'letters:glass').material).uniforms.uFront!;
    // Nothing at 0, before the light has left the O, and again once it has run out and back.
    e.setLetters(0);
    expect(letters.visible).toBe(false);
    e.setLetters(0.5);
    expect(letters.visible).toBe(true);
    expect(front.value).toBeCloseTo(-0.6 + 3.5 * 0.5, 9);
    e.setLetters(0);
    expect(letters.visible).toBe(false);
    // Held to 0..1, NaN as 0.
    e.setLetters(Number.NaN);
    expect(letters.visible).toBe(false);
    expect(front.value).toBeCloseTo(-0.6, 9);
    e.setLetters(7);
    expect(front.value).toBeCloseTo(2.9, 9);
    e.setLetters(-2);
    expect(front.value).toBeCloseTo(-0.6, 9);
    expect(letters.visible).toBe(false);
    // Every part of the bands, the glass, the rims and the ticks, is cut off past the one front: nothing ahead of it.
    for (const name of PARTS) {
      const shader = compiled(part(e.group, name).material);
      expect(shader.uniforms.uFront, name).toBe(front);
      expect(shader.fragmentShader).toMatch(/float k\s*=\s*clamp\(\s*\(\s*uFront\s*-\s*\(\s*abs\(\s*vLetterX\s*\)\s*-\s*uLook\.x\s*\)\s*\)\s*\/\s*uLook\.y\s*,\s*0\.0\s*,\s*1\.0\s*\)\s*;/);
      expect(shader.fragmentShader).toMatch(/if\s*\(\s*k\s*<=\s*0\.0\s*\)\s*discard\s*;/);
      // The glass fades out by the same k, so the feather is light going, not the glass going dark.
      expect(shader.fragmentShader).toMatch(/gl_FragColor\.a\s*\*=\s*k\s*;/);
    }
    e.dispose();
  });

  it('keeps the O, its circle, its ticks and the outer ring', () => {
    const e = buildEngraving();
    for (const id of LETTERS) expect(e.group.getObjectByName(`stroke:${id}`), id).toBeUndefined();
    const circle = part<THREE.MeshBasicMaterial>(e.group, 'stroke:circle');
    expect(circle.geometry).toBeInstanceOf(THREE.TubeGeometry);
    expect(circle.material.name).toBe('engraving:stroke');
    expect(part(e.group, 'ticks').geometry.getAttribute('position').count).toBe(WORDMARK.ticks.count * 4);
    expect(part(e.group, 'outer').geometry).toBeInstanceOf(THREE.TubeGeometry);
    // The loader still cuts the circle; a B stroke there draws nothing, its bands lighting only on the scroll.
    e.setStroke('circle', 0.5);
    expect(circle.geometry.drawRange.count).toBeGreaterThan(0);
    for (const id of LETTERS) e.setStroke(id, 1);
    expect(part(e.group, 'letters:glass').parent!.visible).toBe(false);
    e.setStroke('circle', 0);
    expect(circle.geometry.drawRange.count).toBe(0);
    e.dispose();
  });
});

describe("the letters' light front", () => {
  // The preview's glow branch (tools/blender/bob_reveal_b.py): the front runs -0.6 to 2.9, 0.45 of ramp, emission 3 k + 10 k (1 - k).
  it("holds the preview's numbers: the inner edge at 1.9, the front from -0.6 to 2.9, a ramp of 0.45, the feather's extra brightness 3.3", () => {
    expect(ENGRAVING_LOOK.letters).toEqual({ inner: 1.9, from: -0.6, to: 2.9, ramp: 0.45, edge: 3.3 });
  });

  it("adds the front to three's own shaders: world x in, the discard before the colour is written, the feather after, before tone mapping and fog", () => {
    const e = buildEngraving();
    for (const name of PARTS) {
      const shader = compiled(part(e.group, name).material);
      expect(shader.fragmentShader).toMatch(/uniform float uFront;/);
      expect(shader.fragmentShader).toMatch(/uniform vec3 uLook;/);
      expect(shader.vertexShader.match(/varying float vLetterX;/g)).toHaveLength(1);
      expect(shader.fragmentShader.match(/varying float vLetterX;/g)).toHaveLength(1);
      expect(shader.vertexShader).toMatch(/vLetterX\s*=\s*\(\s*modelMatrix\s*\*\s*vec4\(\s*transformed\s*,\s*1\.0\s*\)\s*\)\.x\s*;/);
      expect(shader.fragmentShader).toMatch(/gl_FragColor\.rgb\s*\*=\s*k\s*\*\s*\(\s*k\s*\+\s*uLook\.z\s*\*\s*k\s*\*\s*\(\s*1\.0\s*-\s*k\s*\)\s*\)\s*;/);
      const at = (text: string) => shader.fragmentShader.indexOf(text);
      expect(at('discard')).toBeLessThan(at('#include <opaque_fragment>'));
      expect(at('#include <opaque_fragment>')).toBeLessThan(at('gl_FragColor.rgb *='));
      expect(at('gl_FragColor.rgb *=')).toBeLessThan(at('#include <tonemapping_fragment>'));
      expect(at('gl_FragColor.rgb *=')).toBeLessThan(at('#include <fog_fragment>'));
      expect(shader.vertexShader).toContain('#include <worldpos_vertex>');
    }
    e.dispose();
  });

  // The preview: visible light = mask * (3 mask + 10 mask (1 - mask)), against 3 when fully lit. The same expression, taken out of the shader.
  it('lights the feather as the preview does: the rest from ramp behind the front, 1.08 times it at most, near k 0.87, and none ahead of it', () => {
    const e = buildEngraving();
    const text = compiled(part(e.group, 'letters:rims').material).fragmentShader;
    const expression = /gl_FragColor\.rgb\s*\*=\s*([^;]+);/.exec(text)?.[1];
    expect(expression).toBeDefined();
    const light = new Function('k', 'uLook', `return ${expression!.replace(/uLook\.z/g, 'uLook[2]')};`) as (k: number, look: number[]) => number;
    const look = [ENGRAVING_LOOK.letters.inner, ENGRAVING_LOOK.letters.ramp, ENGRAVING_LOOK.letters.edge];
    const preview = (k: number) => (k * (3 * k + 10 * k * (1 - k))) / 3;
    let peak = { k: 0, light: 0 };
    for (let i = 0; i <= 1000; i++) {
      const k = i / 1000;
      const here = light(k, look);
      expect(Math.abs(here - preview(k))).toBeLessThan(0.01);
      if (here > peak.light) peak = { k, light: here };
    }
    expect(light(0, look)).toBe(0);
    expect(light(1, look)).toBe(1);
    expect(peak.light).toBeGreaterThan(1.07);
    expect(peak.light).toBeLessThan(1.09);
    expect(peak.k).toBeGreaterThan(0.85);
    expect(peak.k).toBeLessThan(0.89);
    e.dispose();
  });

  it('hands every part the one front and look as uniforms the setter moves, and compiles nothing for a frame of it', () => {
    const e = buildEngraving();
    const first = compiled(part(e.group, 'letters:glass').material).uniforms;
    const look = first.uLook!.value as THREE.Vector3;
    expect([look.x, look.y, look.z]).toEqual([1.9, 0.45, 3.3]);
    for (const name of PARTS) {
      const material = part(e.group, name).material;
      expect(material.customProgramCacheKey()).toBe('bob-letters');
      const again = compiled(material).uniforms;
      expect(again.uFront).toBe(first.uFront);
      expect(again.uLook).toBe(first.uLook);
      const version = material.version;
      for (const share of [0, 0.1, 0.35, 0.5, 0.99, 1, 0, Number.NaN, 0.7]) e.setLetters(share);
      expect(material.version, name).toBe(version);
    }
    e.dispose();
  });

  it("scales the letters' own light with the glow, and the circle by its rule", () => {
    const e = buildEngraving();
    const glass = part<THREE.MeshPhysicalMaterial>(e.group, 'letters:glass').material;
    const rims = part<THREE.MeshStandardMaterial>(e.group, 'letters:rims').material;
    const marks = part<THREE.MeshBasicMaterial>(e.group, 'letters:ticks').material;
    const circle = part<THREE.MeshBasicMaterial>(e.group, 'stroke:circle').material;
    const rest = new THREE.Color(palette.goldLight).multiplyScalar(ENGRAVING_LOOK.gain * ENGRAVING_LOOK.share.stroke);
    e.setGlow(0.5);
    expect(glass.emissiveIntensity).toBeCloseTo(0.08 * 0.5, 9);
    expect(rims.emissiveIntensity).toBeCloseTo(0.22 * 0.5, 9);
    expectColour(marks.color, new THREE.Color(palette.goldLight).multiplyScalar(0.75 * 0.5));
    expectColour(circle.color, rest.clone().multiplyScalar(0.5));
    e.setGlow(Number.NaN);
    expect([glass.emissiveIntensity, rims.emissiveIntensity, marks.color.r, circle.color.r]).toEqual([0, 0, 0, 0]);
    // A glow set before the letters' light, or after it, reads the same.
    e.setLetters(0.4);
    e.setGlow(1);
    expect(rims.emissiveIntensity).toBeCloseTo(0.22, 9);
    e.dispose();
  });

  it("frees the letters' materials and geometries with the rest", () => {
    const e = buildEngraving();
    const spies = PARTS.flatMap((name) => [vi.spyOn(part(e.group, name).material, 'dispose'), vi.spyOn(part(e.group, name).geometry, 'dispose')]);
    e.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
  });
});
