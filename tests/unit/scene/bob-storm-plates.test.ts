import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadStormPlates } from '~/scene/bob/stormPlates';

// The storm's two plates (src/assets/storm), loaded once the home has landed (spec 2026-10-30-bob-storm-design.md).

describe('loadStormPlates', () => {
  afterEach(() => vi.restoreAllMocks());

  it('loads the wall and the sea from their built files, as colour, mirrored at their ends', async () => {
    const asked: string[] = [];
    vi.spyOn(THREE.TextureLoader.prototype, 'loadAsync').mockImplementation(async (url: string) => {
      asked.push(url);
      return new THREE.Texture();
    });
    const { wall, sea } = await loadStormPlates();
    expect(asked).toHaveLength(2);
    expect(asked[0]).toMatch(/storm-wall.*\.webp$/);
    expect(asked[1]).toMatch(/storm-sea.*\.webp$/);
    for (const t of [wall, sea]) {
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
