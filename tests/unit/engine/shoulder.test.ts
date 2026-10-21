import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { shoulder } from '~/engine/studio/shoulder';

describe("the studio's tone mapping", () => {
  it("puts PBR Neutral's shoulder, without its toe, in three's custom tone mapping, once", () => {
    const plain = 'vec3 CustomToneMapping( vec3 color ) { return color; }';
    expect(THREE.ShaderChunk.tonemapping_pars_fragment).toContain(plain);
    shoulder();
    shoulder();
    const chunk = THREE.ShaderChunk.tonemapping_pars_fragment;
    expect(chunk).not.toContain(plain);
    const custom = chunk.slice(chunk.indexOf('vec3 CustomToneMapping'));
    expect(chunk.split('vec3 CustomToneMapping').length).toBe(2);
    expect(custom).toContain('const float StartCompression = 0.8;');
    // No toe: nothing takes an offset off the darkest channel.
    expect(custom).not.toContain('offset');
    // Neutral itself is left as it was.
    expect(chunk).toContain('float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;');
  });
});
