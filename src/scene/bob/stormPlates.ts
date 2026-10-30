/**
 * The storm's plates (spec 2026-10-30-bob-storm-design.md; round 8, spec 2026-10-30-bob-moonlit-3d-design.md: rendered
 * from real moonlit volume clouds by tools/blender/storm_plates.py): the storm wall, the sea of storm, the bank for the
 * flats (with its own alpha) and the lightning's glow in the wall and the bank, as built files (hashed like the site's
 * other pictures). The Void loads them once the home has landed, never holding the loader; if any does not come, the
 * storm is simply not there.
 */
import * as THREE from 'three';
import bankUrl from '~/assets/storm/storm-bank.webp?url';
import bankFlashUrl from '~/assets/storm/storm-bank-flash.webp?url';
import seaUrl from '~/assets/storm/storm-sea.webp?url';
import wallUrl from '~/assets/storm/storm-wall.webp?url';
import wallFlashUrl from '~/assets/storm/storm-wall-flash.webp?url';
import type { StormPlates } from '~/engine/bob/build/storm';

/** The five plates, as colour textures mirrored at their ends (the sky and the flats run past them). */
export async function loadStormPlates(): Promise<StormPlates> {
  const loader = new THREE.TextureLoader();
  const [wall, sea, bank, wallFlash, bankFlash] = await Promise.all([wallUrl, seaUrl, bankUrl, wallFlashUrl, bankFlashUrl].map((url) => loader.loadAsync(url)));
  const plates: StormPlates = { wall: wall!, sea: sea!, bank: bank!, wallFlash: wallFlash!, bankFlash: bankFlash! };
  for (const t of Object.values(plates)) {
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
    t.anisotropy = 4;
    t.needsUpdate = true;
  }
  return plates;
}
