import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { warmScene, warmUp } from '../../src/scripts/three/TextureWarmup';

/** Just enough of a renderer: uploads are counted, and compiles answer as `compile` says. */
function fakeRenderer(compile: () => Promise<unknown>): THREE.WebGLRenderer & { uploads: number } {
  const renderer = {
    uploads: 0,
    initTexture() {
      renderer.uploads++;
    },
    compileAsync: compile
  };
  return renderer as unknown as THREE.WebGLRenderer & { uploads: number };
}

function standIns(count: number): { materials: THREE.Material[]; disposed: () => number } {
  let disposed = 0;
  const materials = Array.from({ length: count }, () => {
    const material = new THREE.MeshBasicMaterial();
    material.addEventListener('dispose', () => disposed++);
    return material;
  });
  return { materials, disposed: () => disposed };
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera();

afterEach(() => {
  vi.restoreAllMocks();
});

describe('warmUp', () => {
  it('uploads every texture and holds the compiled stand-ins until released', async () => {
    const renderer = fakeRenderer(() => Promise.resolve());
    const { materials, disposed } = standIns(3);
    const release = await warmUp(renderer, scene, camera, [new THREE.Texture(), new THREE.Texture()], materials);
    expect(renderer.uploads).toBe(2);
    expect(disposed()).toBe(0);
    release();
    release();
    expect(disposed()).toBe(3);
  });

  it('logs a failed compile and lets its stand-ins go itself, never rejecting', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const renderer = fakeRenderer(() => Promise.reject(new Error('link failed')));
    const { materials, disposed } = standIns(2);
    const release = await warmUp(renderer, scene, camera, [], materials);
    expect(disposed()).toBe(2);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/^\[portfolio\] /);
    release();
    expect(disposed()).toBe(2);
  });

  it('stops when cancelled, compiling nothing and letting the stand-ins go', async () => {
    const compile = vi.fn(() => Promise.resolve());
    const renderer = fakeRenderer(compile);
    const { materials, disposed } = standIns(2);
    await warmUp(renderer, scene, camera, [new THREE.Texture()], materials, () => true);
    expect(renderer.uploads).toBe(0);
    expect(compile).not.toHaveBeenCalled();
    expect(disposed()).toBe(2);
  });
});

describe('warmScene', () => {
  it('survives a compile that throws at once: logged, both halves reported, the clearcoat stand-ins let go', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const renderer = fakeRenderer(() => {
      throw new Error('no context');
    });
    const shares: number[] = [];
    const release = await warmScene(renderer, scene, camera, [], true, () => false, (share) => shares.push(share));
    expect(shares).toEqual([0.5, 1]);
    // The scene's compile and the stand-ins' compile each failed and were logged.
    expect(warn).toHaveBeenCalledTimes(2);
    expect(() => release()).not.toThrow();
  });

  it('keeps going when its progress listener throws', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const renderer = fakeRenderer(() => Promise.resolve());
    const release = await warmScene(renderer, scene, camera, [], false, () => false, () => {
      throw new Error('listener');
    });
    expect(error).toHaveBeenCalledTimes(2);
    expect(typeof release).toBe('function');
  });
});
