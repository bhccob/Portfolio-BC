import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Pass } from 'postprocessing';
import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GAS_SLOT, gasPass, setGasPass } from '~/scene/gasPass';

class Stub extends Pass {
  depth: THREE.Texture | null = null;
  size: [number, number] = [0, 0];
  override setDepthTexture(depth: THREE.Texture): void {
    this.depth = depth;
  }
  override setSize(width: number, height: number): void {
    this.size = [width, height];
  }
  override render = vi.fn();
}

afterEach(() => {
  setGasPass(null);
  GAS_SLOT.setDepthTexture(null as unknown as THREE.Texture);
});

describe("the gas's slot in the post chain", () => {
  it('holds no gas until the Void hands one over, and is off meanwhile', () => {
    expect(gasPass()).toBeNull();
    expect(GAS_SLOT.enabled).toBe(false);
    expect(GAS_SLOT.needsDepthTexture).toBe(true);
    const pass = new Stub();
    setGasPass(pass);
    expect(gasPass()).toBe(pass);
    expect(GAS_SLOT.enabled).toBe(true);
    setGasPass(null);
    expect(GAS_SLOT.enabled).toBe(false);
  });

  it("is on and off with the gas's own pass: off at level 0", () => {
    const pass = new Stub();
    setGasPass(pass);
    pass.enabled = false;
    expect(GAS_SLOT.enabled).toBe(false);
    pass.enabled = true;
    expect(GAS_SLOT.enabled).toBe(true);
  });

  it('hands the chain\'s depth and size to a gas built after the chain was', () => {
    const depth = new THREE.DepthTexture(1, 1);
    GAS_SLOT.setDepthTexture(depth);
    GAS_SLOT.setSize(1440, 900);
    const pass = new Stub();
    setGasPass(pass);
    expect(pass.depth).toBe(depth);
    expect(pass.size).toEqual([1440, 900]);
    GAS_SLOT.setSize(800, 600);
    expect(pass.size).toEqual([800, 600]);
  });

  it('runs the gas held, into what the chain gives it', () => {
    const pass = new Stub();
    setGasPass(pass);
    const gl = {} as THREE.WebGLRenderer;
    const input = new THREE.WebGLRenderTarget(1, 1);
    const output = new THREE.WebGLRenderTarget(1, 1);
    GAS_SLOT.render(gl, input, output, 0.016, false);
    expect(pass.render).toHaveBeenCalledWith(gl, input, output, 0.016, false);
  });

  it('takes a gas back only if it is still the one held: a newer one stays', () => {
    const old = new Stub();
    const next = new Stub();
    setGasPass(next);
    setGasPass(null, old);
    expect(gasPass()).toBe(next);
    setGasPass(null, next);
    expect(gasPass()).toBeNull();
  });

  it("stands in the chain from its start, so the gas coming and going never changes the chain's passes (a lost context cannot add one)", () => {
    const effects = readFileSync(fileURLToPath(new URL('../../../src/scene/Effects.tsx', import.meta.url)), 'utf8');
    expect(effects).toMatch(/<primitive object=\{GAS_SLOT\} \/>\r?\n\s*<Bloom/);
    expect(effects).not.toMatch(/useGasPass|gas &&/);
  });
});
