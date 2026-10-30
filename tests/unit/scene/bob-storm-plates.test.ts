import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadStormPlates } from '~/scene/bob/stormPlates';

// The storm's plates (src/assets/storm), loaded once the home has landed (spec 2026-10-30-bob-storm-design.md); since
// round 8 (spec 2026-10-30-bob-moonlit-3d-design.md) five, rendered from real moonlit clouds.

describe('loadStormPlates', () => {
  afterEach(() => vi.restoreAllMocks());

  it('loads the wall, the sea, the bank and the two flash plates from their built files, as colour, mirrored at their ends', async () => {
    const asked: string[] = [];
    vi.spyOn(THREE.TextureLoader.prototype, 'loadAsync').mockImplementation(async (url: string) => {
      asked.push(url);
      return new THREE.Texture();
    });
    const plates = await loadStormPlates();
    expect(asked).toHaveLength(5);
    expect(asked[0]).toMatch(/storm-wall-[^f].*\.webp$|storm-wall\.webp$/);
    expect(asked[1]).toMatch(/storm-sea.*\.webp$/);
    expect(asked[2]).toMatch(/storm-bank-[^f].*\.webp$|storm-bank\.webp$/);
    expect(asked[3]).toMatch(/storm-wall-flash.*\.webp$/);
    expect(asked[4]).toMatch(/storm-bank-flash.*\.webp$/);
    for (const t of Object.values(plates)) {
      expect(t.colorSpace).toBe(THREE.SRGBColorSpace);
      expect(t.wrapS).toBe(THREE.MirroredRepeatWrapping);
      expect(t.wrapT).toBe(THREE.MirroredRepeatWrapping);
    }
  });

  it('fails as a whole when a plate does not come, so the storm is simply not there', async () => {
    vi.spyOn(THREE.TextureLoader.prototype, 'loadAsync').mockImplementation(async (url: string) => {
      if (url.includes('storm-sea')) throw new Error('404');
      return new THREE.Texture();
    });
    await expect(loadStormPlates()).rejects.toThrow('404');
  });
});
