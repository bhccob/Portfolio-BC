import { BlendFunction, Effect } from 'postprocessing';
import { LinearSRGBColorSpace, Uniform } from 'three';
import { SHOULDER } from '~/engine/studio/shoulder';

/**
 * Revision 4's shoulder tone mapping as the post chain's last effect: the very source the renderer's
 * CustomToneMapping runs on the low tier (src/engine/studio/shoulder.ts's SHOULDER), wrapped as a `mainImage`. Its
 * `toneMappingExposure` is this effect's own `exposure` uniform, through a define, so the GLSL stays the
 * shared string and nothing else in the pass is named like three's tone-mapping uniform. (The pass prefixes
 * the effect's functions and uniforms, so `CustomToneMapping` and `exposure` cannot clash with anything.)
 */
const fragmentShader = /* glsl */ `uniform float exposure;
#define toneMappingExposure exposure
${SHOULDER}
#undef toneMappingExposure

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
	outputColor = vec4(CustomToneMapping(inputColor.rgb), inputColor.a);
}`;

export interface ShoulderToneMappingOptions {
  /** Multiplies the light before the shoulder, as the renderer's toneMappingExposure did; 1 (COMPASS_STUDIO.exposure). */
  exposure?: number;
}

/**
 * The tone mapping of the high and medium tiers (Effects). It reads the composer's buffer, which holds linear
 * light at half float (the renderer's own tone mapping is off while the composer runs, and three writes linear
 * into a render target), and writes linear, tone-mapped colour: the pass that draws to the screen converts it to
 * sRGB, as three's colorspace chunk did after the shoulder on the low tier. Same input, same curve, same output.
 */
export class ShoulderToneMappingEffect extends Effect {
  constructor({ exposure = 1 }: ShoulderToneMappingOptions = {}) {
    super('ShoulderToneMappingEffect', fragmentShader, {
      blendFunction: BlendFunction.SRC,
      uniforms: new Map([['exposure', new Uniform(exposure)]]),
    });
    this.inputColorSpace = LinearSRGBColorSpace;
  }

  get exposure(): number {
    return this.uniforms.get('exposure')!.value as number;
  }

  set exposure(value: number) {
    this.uniforms.get('exposure')!.value = value;
  }
}
