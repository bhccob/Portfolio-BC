import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import * as THREE from 'three';
import { FOOTPRINTS, loadDeviceTextures, TEXTURE_FILES } from '../../src/scripts/three/device/textures';

describe('device textures', () => {
  it('ships every texture file', () => {
    Object.values(TEXTURE_FILES).forEach((path) => expect(existsSync(`public${path}`)).toBe(true));
  });
  it('keeps footprints inside the board and apart from each other', () => {
    const rects = Object.values(FOOTPRINTS);
    rects.forEach((r) => {
      expect(r.u0).toBeGreaterThanOrEqual(0); expect(r.v0).toBeGreaterThanOrEqual(0);
      expect(r.u1).toBeLessThanOrEqual(1); expect(r.v1).toBeLessThanOrEqual(1);
      expect(r.u1).toBeGreaterThan(r.u0); expect(r.v1).toBeGreaterThan(r.v0);
    });
    rects.forEach((a, i) => rects.slice(i + 1).forEach((b) => {
      const overlap = a.u0 < b.u1 && b.u0 < a.u1 && a.v0 < b.v1 && b.v0 < a.v1;
      expect(overlap).toBe(false);
    }));
  });
  it('puts the three project footprints in a left column, top to bottom', () => {
    const { funcial, 'jontai-energy': je, 'cookies-clicker': ck, 'bc-2006': cpu } = FOOTPRINTS;
    expect(funcial.v0).toBeLessThan(je.v0); expect(je.v0).toBeLessThan(ck.v0);
    [funcial, je, ck].forEach((r) => expect(r.u1).toBeLessThan(cpu.u0));
  });
  it('loads what it can, in sRGB, and never rejects', async () => {
    const loader = {
      loadAsync: async (url: string) => {
        if (url !== TEXTURE_FILES.pcb) throw new Error('missing');
        return new THREE.Texture();
      }
    } as unknown as THREE.TextureLoader;
    const textures = await loadDeviceTextures(loader);
    expect(textures.pcb?.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(textures.battery).toBeUndefined();
    expect(textures.aluminium).toBeUndefined();
  });
});
