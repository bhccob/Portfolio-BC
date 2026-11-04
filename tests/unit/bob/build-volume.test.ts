import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Pass } from 'postprocessing';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { buildVolume, VOLUME_LOOK, volumeTier } from '~/engine/bob/build/volume';

/** A renderer as a test hands it over: it draws nothing, and says where it draws. */
function renderer(): THREE.WebGLRenderer & { targets: (THREE.WebGLRenderTarget | null)[] } {
  let target: THREE.WebGLRenderTarget | null = null;
  const targets: (THREE.WebGLRenderTarget | null)[] = [];
  return {
    targets,
    getRenderTarget: () => target,
    setRenderTarget: (t: THREE.WebGLRenderTarget | null) => {
      target = t;
      targets.push(t);
    },
    render: vi.fn()
  } as unknown as THREE.WebGLRenderer & { targets: (THREE.WebGLRenderTarget | null)[] };
}

const camera = (): THREE.PerspectiveCamera => {
  const c = new THREE.PerspectiveCamera(38, 1.6, 0.05, 500);
  c.position.set(-16, -20, 19);
  c.lookAt(0, -25, 0);
  c.updateMatrixWorld();
  return c;
};

const INPUT = { clock: 3, level: 0.8, power: 1, aim: [0, -25, 0] as [number, number, number], middle: -24.1, clear: 'stack' as const, core: [0, -12.5, 0] as [number, number, number] };
const SOURCE = readFileSync(fileURLToPath(new URL('../../../src/engine/bob/build/volume.ts', import.meta.url)), 'utf8');

describe('the nebula in 3D: a volume of gas each pixel marches through, drawn into the scene by its depth', () => {
  it('keeps the look of the mock-up', () => {
    expect(VOLUME_LOOK.colour).toEqual({ deep: 0x2a1250, wisp: 0x7d4fc4, gold: 0xe2a54a, pale: 0xb7a6e8, rose: 0x9c3f8a });
    expect(VOLUME_LOOK.steps).toEqual({ high: 84, medium: 56 });
  });

  it('draws the gas at two thirds of the screen on high and half on medium, and none on low (sharper, Bob 2026-10-29)', () => {
    expect(volumeTier('high')).toEqual({ scale: 1.5, steps: 84 });
    expect(volumeTier('medium')).toEqual({ scale: 2, steps: 56 });
    expect(volumeTier('low')).toBeNull();
    expect(buildVolume('low')).toBeNull();
    for (const [tier, w, h] of [
      ['high', 960, 600],
      ['medium', 720, 450]
    ] as const) {
      const volume = buildVolume(tier)!;
      volume.pass.setSize(1440, 900);
      const image = (volume.composite.uniforms.uGas!.value as THREE.Texture).image as { width: number; height: number };
      expect([image.width, image.height], tier).toEqual([w, h]);
      volume.dispose();
    }
  });

  it('changes how it is marched in place: a uniform and a target, no new program', () => {
    const volume = buildVolume('high')!;
    const program = volume.march.fragmentShader;
    const version = volume.march.version;
    volume.pass.setSize(1440, 900);
    (volume.pass as unknown as { setQuality(q: { scale: number; steps: number }): void }).setQuality({ scale: 3, steps: 28 });
    expect(volume.march.uniforms.uSteps!.value).toBe(28);
    const image = (volume.composite.uniforms.uGas!.value as THREE.Texture).image as { width: number; height: number };
    expect([image.width, image.height]).toEqual([480, 300]);
    expect(volume.march.fragmentShader).toBe(program);
    expect(volume.march.version).toBe(version);
    volume.dispose();
  });

  it('never marches more steps than its loop has', () => {
    const volume = buildVolume('high')!;
    (volume.pass as unknown as { setQuality(q: { scale: number; steps: number }): void }).setQuality({ scale: 1, steps: 500 });
    expect(volume.march.uniforms.uSteps!.value).toBe(VOLUME_LOOK.steps.high);
    volume.dispose();
  });

  it('takes the lean march below the high tier, and the whole one on it', () => {
    const high = buildVolume('high')!;
    const medium = buildVolume('medium')!;
    expect(high.march.defines).not.toHaveProperty('GAS_LEAN');
    expect(medium.march.defines).toHaveProperty('GAS_LEAN');
    high.dispose();
    medium.dispose();
  });

  it('reads the noise only where the place allows gas at all', () => {
    expect(SOURCE).toMatch(/if \(placed <= 0\.0\) return 0\.0;\s+float big = smoothstep/);
  });

  it('marches 84 steps on high and 56 on medium', () => {
    const high = buildVolume('high')!;
    const medium = buildVolume('medium')!;
    expect(high.march.uniforms.uSteps!.value).toBe(84);
    expect(medium.march.uniforms.uSteps!.value).toBe(56);
    expect(high.march.fragmentShader).toMatch(/if \(i >= uSteps\) break;/);
    expect(high.march.fragmentShader).toMatch(/84\.0 \/ float\(uSteps\)/);
    high.dispose();
    medium.dispose();
  });

  it("keeps a clear space round the stack's spine and along the camera's line, and leaves the pass off at level 0", () => {
    const volume = buildVolume('high')!;
    const cam = camera();
    volume.update(cam, INPUT);
    const u = volume.march.uniforms;
    expect((u.uAim!.value as THREE.Vector3).toArray()).toEqual(INPUT.aim);
    expect((u.uCore!.value as THREE.Vector3).toArray()).toEqual(INPUT.core);
    expect((u.uCam!.value as THREE.Vector3).toArray()).toEqual(cam.position.toArray());
    expect([u.uNear!.value, u.uFar!.value]).toEqual([0.05, 500]);
    expect(u.uMiddle!.value).toBe(-24.1);
    expect(u.uClear!.value).toBe(0);
    expect(u.uTime!.value).toBe(3);
    expect(u.uPower!.value).toBe(1);
    expect(volume.composite.uniforms.uLevel!.value).toBe(0.8);
    expect(volume.pass.enabled).toBe(true);
    volume.update(cam, { ...INPUT, clear: 'fall' });
    expect(u.uClear!.value).toBe(1);
    volume.update(cam, { ...INPUT, level: 0 });
    expect(volume.pass.enabled).toBe(false);
    // On the stack the space kept clear is a column round the spine, so the gas drifts between the boards' rims.
    expect(SOURCE).toMatch(/float column = smoothstep\(4\.0, 9\.0, length\(p\.xz\)\);/);
    volume.dispose();
  });

  it('stops each ray at what the scene drew, so the gas stands in front of and between the boards', () => {
    const volume = buildVolume('high')!;
    expect(volume.pass).toBeInstanceOf(Pass);
    expect(volume.pass.needsDepthTexture).toBe(true);
    const depth = new THREE.DepthTexture(1, 1);
    volume.pass.setDepthTexture(depth);
    expect(volume.march.uniforms.uDepth!.value).toBe(depth);
    expect(volume.march.fragmentShader).toMatch(/perspectiveDepthToViewZ/);
    expect(volume.march.fragmentShader).toMatch(/if \(t > surface\) break;/);
    volume.dispose();
  });

  it('lays the gas over the scene by its own cover, then hands on to the rest of the chain', () => {
    const volume = buildVolume('high')!;
    volume.pass.setSize(1440, 900);
    const gl = renderer();
    const input = new THREE.WebGLRenderTarget(4, 4);
    const output = new THREE.WebGLRenderTarget(4, 4);
    volume.update(camera(), INPUT);
    volume.pass.render(gl, input, output, 0.016, false);
    // The march into its own target, then the scene with the gas over it into the chain's output.
    expect(gl.render).toHaveBeenCalledTimes(2);
    expect(gl.targets[0]!.texture).toBe(volume.composite.uniforms.uGas!.value);
    expect(gl.targets.at(-1)).toBe(output);
    expect(volume.composite.uniforms.inputBuffer!.value).toBe(input.texture);
    expect(volume.composite.fragmentShader).toMatch(/scene\.rgb \* \(1\.0 - gas\.a\) \+ gas\.rgb/);
    // Sharper than the old 3 × 3 tent: the gas read five times at most.
    expect((volume.composite.fragmentShader.match(/texture2D\(uGas/g) ?? []).length).toBeLessThanOrEqual(5);
    volume.dispose();
  });

  it('cuts the wisps steep and shades each by its own gas, so they have an edge and a form (Bob, 2026-10-29: "less blurry")', () => {
    expect(SOURCE).toMatch(/return max\(0\.0, \(body - 0\.5\) \* 5\.5 - /);
    expect(SOURCE).toMatch(/float shade = exp\(-densityAt\(p \+ uKey \* 3\.5\) \* 3\.0\);/);
    expect(SOURCE).toMatch(/\* \(0\.3 \+ 0\.7 \* shade\)/);
  });

  it("holds every shader pow's base at zero or more", () => {
    const pows = [...SOURCE.matchAll(/pow\(\s*([a-z]+)\(/g)];
    expect(pows.length).toBe(SOURCE.match(/pow\(/g)?.length ?? 0);
    for (const m of pows) expect(['max', 'clamp']).toContain(m[1]);
  });

  it('frees its target, its noise, its materials and its geometries', () => {
    const volume = buildVolume('high')!;
    const target = volume.composite.uniforms.uGas!.value as THREE.Texture;
    const noise = volume.march.uniforms.uNoise!.value as THREE.Texture;
    const spies = [vi.spyOn(volume.composite, 'dispose'), vi.spyOn(volume.march, 'dispose'), vi.spyOn(target, 'dispose'), vi.spyOn(noise, 'dispose')];
    volume.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalled();
  });
});
