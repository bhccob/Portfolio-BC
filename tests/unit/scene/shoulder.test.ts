import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SHOULDER } from '~/engine/studio/shoulder';
import { ShoulderToneMappingEffect } from '~/scene/ShoulderToneMapping';

/** The function's body: everything between its first `{` and its last `}`. */
const body = (glsl: string): string => glsl.slice(glsl.indexOf('{') + 1, glsl.lastIndexOf('}'));

describe('ShoulderToneMappingEffect', () => {
  it("runs the revision-4 shoulder, the studio's own GLSL, from its mainImage", () => {
    const effect = new ShoulderToneMappingEffect();
    const fragment = effect.getFragmentShader() ?? '';
    expect(body(SHOULDER).length).toBeGreaterThan(100);
    expect(fragment).toContain(body(SHOULDER));
    expect(fragment).toContain(SHOULDER);
    expect(fragment).toMatch(/void mainImage\s*\(\s*const in vec4 inputColor\s*,\s*const in vec2 uv\s*,\s*out vec4 outputColor\s*\)/);
    expect(fragment).toMatch(/outputColor\s*=\s*vec4\(\s*CustomToneMapping\(\s*inputColor\.rgb\s*\)\s*,\s*inputColor\.a\s*\)/);
    effect.dispose();
  });

  it("reads the shoulder's exposure from its own uniform, 1 unless told otherwise", () => {
    const effect = new ShoulderToneMappingEffect();
    const fragment = effect.getFragmentShader() ?? '';
    expect(fragment).toMatch(/uniform float exposure;/);
    expect(fragment).toMatch(/#define toneMappingExposure exposure/);
    expect(effect.uniforms.get('exposure')?.value).toBe(1);
    effect.exposure = 1.4;
    expect(effect.uniforms.get('exposure')?.value).toBe(1.4);
    expect(effect.exposure).toBe(1.4);
    expect(new ShoulderToneMappingEffect({ exposure: 0.8 }).exposure).toBe(0.8);
    effect.dispose();
  });

  it('takes linear light and replaces the colour, as a tone mapping must', () => {
    const effect = new ShoulderToneMappingEffect();
    expect(effect.inputColorSpace).toBe(THREE.LinearSRGBColorSpace);
    expect(effect.blendMode.blendFunction).toBe(BlendFunction.SRC);
    effect.dispose();
  });
});
