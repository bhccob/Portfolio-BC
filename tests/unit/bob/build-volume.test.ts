import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { buildVolume, VOLUME_LOOK, volumeTier } from '~/engine/bob/build/volume';

/** A renderer as a test hands it over: it draws nothing, and says where it draws. */
function renderer(): THREE.WebGLRenderer {
  let target: THREE.WebGLRenderTarget | null = null;
  return {
    getRenderTarget: () => target,
    setRenderTarget: (t: THREE.WebGLRenderTarget | null) => {
      target = t;
    },
    render: vi.fn()
  } as unknown as THREE.WebGLRenderer;
}

const camera = (): THREE.PerspectiveCamera => {
  const c = new THREE.PerspectiveCamera(38, 1.6, 0.05, 500);
  c.position.set(-16, -20, 19);
  c.lookAt(0, -25, 0);
  c.updateMatrixWorld();
  return c;
};

const INPUT = { clock: 3, level: 0.8, power: 1, aim: [0, -25, 0] as [number, number, number], middle: -24.1, clear: 'stack' as const, core: [0, -12.5, 0] as [number, number, number] };

describe('the nebula in 3D: a volume of gas each pixel marches through', () => {
  it('keeps the look of the mock-up', () => {
    expect(VOLUME_LOOK.colour).toEqual({ deep: 0x2a1250, wisp: 0x7d4fc4, gold: 0xe2a54a, pale: 0xb7a6e8, rose: 0x9c3f8a });
    expect(VOLUME_LOOK.steps).toEqual({ high: 84, medium: 56 });
  });

  it('draws the gas at half the screen on high and a third on medium, and none on low', () => {
    expect(volumeTier('high')).toEqual({ scale: 2, steps: 84 });
    expect(volumeTier('medium')).toEqual({ scale: 3, steps: 56 });
    expect(volumeTier('low')).toBeNull();
    expect(buildVolume('low')).toBeNull();
    for (const [tier, w, h] of [
      ['high', 720, 450],
      ['medium', 480, 300]
    ] as const) {
      const volume = buildVolume(tier)!;
      volume.resize(1440, 900);
      const image = ((volume.layer.material as THREE.ShaderMaterial).uniforms.uVolume!.value as THREE.Texture).image as { width: number; height: number };
      expect([image.width, image.height], tier).toEqual([w, h]);
      volume.dispose();
    }
  });

  it('marches 84 steps on high and 56 on medium', () => {
    const high = buildVolume('high')!;
    const medium = buildVolume('medium')!;
    expect(high.march.uniforms.uSteps!.value).toBe(84);
    expect(medium.march.uniforms.uSteps!.value).toBe(56);
    // The loop stops at the tier's steps, and a step reaches as far in fewer of them.
    expect(high.march.fragmentShader).toMatch(/if \(i >= uSteps\) break;/);
    expect(high.march.fragmentShader).toMatch(/84\.0 \/ float\(uSteps\)/);
    high.dispose();
    medium.dispose();
  });

  it("keeps the clear space round the stack's middle and along the camera's line", () => {
    const volume = buildVolume('high')!;
    const gl = renderer();
    const cam = camera();
    volume.render(gl, cam, INPUT);
    const u = volume.march.uniforms;
    expect((u.uAim!.value as THREE.Vector3).toArray()).toEqual(INPUT.aim);
    expect((u.uCore!.value as THREE.Vector3).toArray()).toEqual(INPUT.core);
    expect((u.uCam!.value as THREE.Vector3).toArray()).toEqual(cam.position.toArray());
    expect(u.uMiddle!.value).toBe(-24.1);
    expect(u.uClear!.value).toBe(0);
    expect(u.uTime!.value).toBe(3);
    expect(u.uPower!.value).toBe(1);
    expect((volume.layer.material as THREE.ShaderMaterial).uniforms.uLevel!.value).toBe(0.8);
    // Drawn into its own target, the renderer's own put back after.
    expect(gl.render).toHaveBeenCalledTimes(1);
    expect(gl.getRenderTarget()).toBeNull();
    // In the fall the space kept clear is the fall's line.
    volume.render(gl, cam, { ...INPUT, clear: 'fall' });
    expect(u.uClear!.value).toBe(1);
    // The gas stands still while the clock does.
    volume.render(gl, cam, { ...INPUT, clock: 3 });
    expect(u.uTime!.value).toBe(3);
    // At level 0 nothing is marched, and the layer is away.
    volume.render(gl, cam, { ...INPUT, level: 0 });
    expect(gl.render).toHaveBeenCalledTimes(3);
    expect(volume.layer.visible).toBe(false);
    volume.dispose();
  });

  it('lays the gas at the far plane, over the stars and behind the world', () => {
    const volume = buildVolume('high')!;
    const lay = volume.layer.material as THREE.ShaderMaterial;
    const depth = Number(/gl_Position = vec4\(position\.xy, ([0-9.]+), 1\.0\)/.exec(lay.vertexShader)?.[1]);
    expect(depth).toBeGreaterThanOrEqual(0.9999);
    expect(depth).toBeLessThan(1);
    // Premultiplied: the gas's colour added, what is behind it taken by its cover.
    expect(lay.blending).toBe(THREE.CustomBlending);
    expect(lay.blendSrc).toBe(THREE.OneFactor);
    expect(lay.blendDst).toBe(THREE.OneMinusSrcAlphaFactor);
    expect(lay.depthWrite).toBe(false);
    expect(lay.depthTest).toBe(true);
    // After the stars (whose renderOrder is lower), before the world's glows.
    expect(volume.layer.renderOrder).toBe(-5);
    expect(volume.layer.frustumCulled).toBe(false);
    volume.dispose();
  });

  it("holds every shader pow's base at zero or more", () => {
    const source = readFileSync(fileURLToPath(new URL('../../../src/engine/bob/build/volume.ts', import.meta.url)), 'utf8');
    const pows = [...source.matchAll(/pow\(\s*([a-z]+)\(/g)];
    expect(pows.length).toBe(source.match(/pow\(/g)?.length ?? 0);
    for (const m of pows) expect(['max', 'clamp']).toContain(m[1]);
  });

  it('frees its target, its noise, its materials and its geometries', () => {
    const volume = buildVolume('high')!;
    const lay = volume.layer.material as THREE.ShaderMaterial;
    const target = lay.uniforms.uVolume!.value as THREE.Texture;
    const noise = volume.march.uniforms.uNoise!.value as THREE.Texture;
    const spies = [vi.spyOn(lay, 'dispose'), vi.spyOn(volume.march, 'dispose'), vi.spyOn(volume.layer.geometry, 'dispose'), vi.spyOn(target, 'dispose'), vi.spyOn(noise, 'dispose')];
    volume.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalled();
  });
});
