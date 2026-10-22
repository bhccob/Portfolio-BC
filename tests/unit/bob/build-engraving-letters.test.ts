import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { buildEngraving, ENGRAVING_LOOK } from '~/engine/bob/build/engraving';
import { STROKE_ORDER, type StrokeId } from '~/engine/bob/wordmark';
import { palette } from '~/engine/palette';

/** The four strokes of the two B letters: everything but the circle. */
const LETTERS: StrokeId[] = ['leftB', 'leftBar', 'rightB', 'rightBar'];

/** The stroke called `id`, which must exist. */
function stroke(root: THREE.Object3D, id: StrokeId): THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial> {
  const found = root.getObjectByName(`stroke:${id}`);
  expect(found, id).toBeDefined();
  return found as THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial>;
}

/** The shader three would start compiling for a copy of the basic material, after the material's patch has had its say. */
function compiled(material: THREE.Material) {
  const shader = { uniforms: {} as Record<string, THREE.IUniform>, vertexShader: THREE.ShaderLib.basic.vertexShader, fragmentShader: THREE.ShaderLib.basic.fragmentShader };
  material.onBeforeCompile(shader as never, {} as never);
  return shader;
}

function expectColour(actual: THREE.Color, expected: THREE.Color): void {
  expect(actual.r).toBeCloseTo(expected.r, 6);
  expect(actual.g).toBeCloseTo(expected.g, 6);
  expect(actual.b).toBeCloseTo(expected.b, 6);
}

describe('the letters\' light front', () => {
  // The preview's glow branch (tools/blender/bob_reveal_b.py): the front runs -0.6 to 2.9, 0.45 of ramp, emission 3 + 10 k (1 - k).
  it('holds the preview\'s numbers: the inner edge at 1.9, the front from -0.6 to 2.9, a ramp of 0.45, the edge 3.3 brighter', () => {
    expect(ENGRAVING_LOOK.letters).toEqual({ inner: 1.9, from: -0.6, to: 2.9, ramp: 0.45, edge: 3.3 });
  });

  it('gives the four B strokes a material of their own and the circle the one it had', () => {
    const e = buildEngraving();
    const letters = stroke(e.group, 'leftB').material;
    expect(letters).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect(letters.name).toBe('engraving:letters');
    for (const id of LETTERS) expect(stroke(e.group, id).material).toBe(letters);
    const circle = stroke(e.group, 'circle').material;
    expect(circle.name).toBe('engraving:stroke');
    expect(circle).not.toBe(letters);
    // Opaque, tone-mapped and fogged, as every stroke is.
    expect(letters.toneMapped).toBe(true);
    expect(letters.fog).toBe(true);
    expect(letters.transparent).toBe(false);
    e.dispose();
  });

  it('draws none of the B strokes at 0 and leaves the circle alone', () => {
    const e = buildEngraving();
    e.setStroke('circle', 0.5);
    const circle = stroke(e.group, 'circle').geometry.drawRange.count;
    expect(circle).toBeGreaterThan(0);
    e.setLetters(0);
    for (const id of LETTERS) expect(stroke(e.group, id).geometry.drawRange.count).toBe(0);
    expect(stroke(e.group, 'circle').geometry.drawRange.count).toBe(circle);
    // And at 0 after it has run out and back.
    e.setLetters(1);
    e.setLetters(0);
    for (const id of LETTERS) expect(stroke(e.group, id).geometry.drawRange.count).toBe(0);
    e.dispose();
  });

  it('draws each B whole above 0, with the front at mix(-0.6, 2.9, share)', () => {
    const e = buildEngraving();
    const uniforms = compiled(stroke(e.group, 'leftB').material).uniforms;
    e.setLetters(0.5);
    for (const id of LETTERS) {
      const geometry = stroke(e.group, id).geometry;
      expect(geometry.drawRange.start).toBe(0);
      expect(geometry.drawRange.count).toBe(geometry.index!.count);
    }
    expect(stroke(e.group, 'circle').geometry.drawRange.count).toBe(0);
    expect(uniforms.uFront.value).toBeCloseTo(-0.6 + 3.5 * 0.5, 9);
    e.setLetters(1);
    expect(uniforms.uFront.value).toBeCloseTo(2.9, 9);
    e.setLetters(0.001);
    expect(uniforms.uFront.value).toBeCloseTo(-0.6 + 3.5 * 0.001, 9);
    for (const id of LETTERS) expect(stroke(e.group, id).geometry.drawRange.count).toBe(stroke(e.group, id).geometry.index!.count);
    e.dispose();
  });

  it('holds a share to 0..1 and reads NaN as 0', () => {
    const e = buildEngraving();
    const uniforms = compiled(stroke(e.group, 'rightB').material).uniforms;
    e.setLetters(0.5);
    e.setLetters(Number.NaN);
    for (const id of LETTERS) expect(stroke(e.group, id).geometry.drawRange.count).toBe(0);
    expect(uniforms.uFront.value).toBeCloseTo(-0.6, 9);
    e.setLetters(7);
    expect(uniforms.uFront.value).toBeCloseTo(2.9, 9);
    for (const id of LETTERS) expect(stroke(e.group, id).geometry.drawRange.count).toBeGreaterThan(0);
    e.setLetters(-2);
    expect(uniforms.uFront.value).toBeCloseTo(-0.6, 9);
    for (const id of LETTERS) expect(stroke(e.group, id).geometry.drawRange.count).toBe(0);
    e.dispose();
  });

  it('still sets any stroke\'s draw range with setStroke, the B strokes included', () => {
    const e = buildEngraving();
    for (const id of STROKE_ORDER) {
      e.setStroke(id, 1);
      expect(stroke(e.group, id).geometry.drawRange.count).toBe(stroke(e.group, id).geometry.index!.count);
      e.setStroke(id, 0);
      expect(stroke(e.group, id).geometry.drawRange.count).toBe(0);
    }
    e.dispose();
  });

  it('adds the front to three\'s own basic shader: world x in, k from the front and the ramp, a discard where k is 0, the light boosted at the edge', () => {
    const e = buildEngraving();
    const material = stroke(e.group, 'leftBar').material;
    const shader = compiled(material);
    expect(shader.fragmentShader).toMatch(/uniform float uFront;/);
    expect(shader.fragmentShader).toMatch(/uniform vec3 uLook;/);
    // World x rides a varying from the vertex shader, worked out from the model matrix (worldpos_vertex defines no world position here).
    expect(shader.vertexShader.match(/varying float vLetterX;/g)).toHaveLength(1);
    expect(shader.fragmentShader.match(/varying float vLetterX;/g)).toHaveLength(1);
    expect(shader.vertexShader).toMatch(/vLetterX\s*=\s*\(\s*modelMatrix\s*\*\s*vec4\(\s*transformed\s*,\s*1\.0\s*\)\s*\)\.x\s*;/);
    // The front stands past the inner edge by uFront, and the light ramps up over uLook.y behind it.
    expect(shader.fragmentShader).toMatch(/float k\s*=\s*clamp\(\s*\(\s*uFront\s*-\s*\(\s*abs\(\s*vLetterX\s*\)\s*-\s*uLook\.x\s*\)\s*\)\s*\/\s*uLook\.y\s*,\s*0\.0\s*,\s*1\.0\s*\)\s*;/);
    expect(shader.fragmentShader).toMatch(/if\s*\(\s*k\s*<=\s*0\.0\s*\)\s*discard\s*;/);
    expect(shader.fragmentShader).toMatch(/gl_FragColor\.rgb\s*\*=\s*k\s*\+\s*uLook\.z\s*\*\s*k\s*\*\s*\(\s*1\.0\s*-\s*k\s*\)\s*;/);
    // Before the colour is tone-mapped and fogged, and after it is written.
    const at = (text: string) => shader.fragmentShader.indexOf(text);
    expect(at('discard')).toBeLessThan(at('#include <opaque_fragment>'));
    expect(at('#include <opaque_fragment>')).toBeLessThan(at('gl_FragColor.rgb *='));
    expect(at('gl_FragColor.rgb *=')).toBeLessThan(at('#include <tonemapping_fragment>'));
    expect(at('gl_FragColor.rgb *=')).toBeLessThan(at('#include <fog_fragment>'));
    // The vertex shader keeps three's own world position, and the fragment shader its own includes.
    expect(shader.vertexShader).toContain('#include <worldpos_vertex>');
    e.dispose();
  });

  it('hands the shader the front and the look as uniforms the setter moves, one program for every frame of the front', () => {
    const e = buildEngraving();
    const material = stroke(e.group, 'leftB').material;
    expect(material.customProgramCacheKey()).toBe('bob-letters');
    const { uniforms } = compiled(material);
    const look = uniforms.uLook.value as THREE.Vector3;
    expect(look.x).toBe(1.9);
    expect(look.y).toBe(0.45);
    expect(look.z).toBe(3.3);
    // A second compile (another program, say) shares the same uniform objects, so the setter still moves them.
    const again = compiled(material).uniforms;
    expect(again.uFront).toBe(uniforms.uFront);
    expect(again.uLook).toBe(uniforms.uLook);
    e.dispose();
  });

  it('compiles nothing for a frame of the front: the material keeps its version', () => {
    const e = buildEngraving();
    const material = stroke(e.group, 'leftB').material;
    const version = material.version;
    for (const share of [0, 0.1, 0.35, 0.5, 0.99, 1, 0, Number.NaN, 0.7]) e.setLetters(share);
    expect(material.version).toBe(version);
    e.dispose();
  });

  it('scales the letters and the circle with the glow by the same rule', () => {
    const e = buildEngraving();
    const colours = () => ({
      letters: stroke(e.group, 'rightBar').material.color.clone(),
      circle: stroke(e.group, 'circle').material.color.clone()
    });
    const rest = new THREE.Color(palette.goldLight).multiplyScalar(ENGRAVING_LOOK.gain * ENGRAVING_LOOK.share.stroke);
    e.setGlow(1);
    expectColour(colours().letters, rest);
    expectColour(colours().circle, rest);
    e.setGlow(0.5);
    const half = colours();
    expectColour(half.letters, rest.clone().multiplyScalar(0.5));
    expectColour(half.circle, rest.clone().multiplyScalar(0.5));
    e.setGlow(-3);
    expect([colours().letters.r, colours().circle.r]).toEqual([0, 0]);
    e.setGlow(Number.NaN);
    expect([colours().letters.g, colours().circle.g]).toEqual([0, 0]);
    // A glow set before the letters' light, or after it, reads the same.
    e.setLetters(0.4);
    e.setGlow(2);
    expectColour(colours().letters, rest.clone().multiplyScalar(2));
    e.dispose();
  });

  it('frees the letters\' material with the rest', () => {
    const e = buildEngraving();
    const letters = stroke(e.group, 'leftB').material;
    const spy = vi.spyOn(letters, 'dispose');
    e.dispose();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
