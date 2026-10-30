/**
 * The storm's two plates (spec 2026-10-30-bob-storm-design.md): the storm wall and the sea of storm, painted to match the
 * storm nebula Bob picked, as built files (hashed like the site's other pictures). The Void loads them once the home has
 * landed, never holding the loader; if either does not come, the storm is simply not there.
 */
import * as THREE from 'three';
import seaUrl from '~/assets/storm/storm-sea.webp?url';
import wallUrl from '~/assets/storm/storm-wall.webp?url';

/** Both plates, as colour textures mirrored at their ends (the sky and the flats run past them). */
export async function loadStormPlates(): Promise<{ wall: THREE.Texture; sea: THREE.Texture }> {
  const loader = new THREE.TextureLoader();
  const [wall, sea] = await Promise.all([loader.loadAsync(wallUrl), loader.loadAsync(seaUrl)]);
  for (const t of [wall, sea]) {
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
    t.anisotropy = 4;
    t.needsUpdate = true;
  }
  return { wall, sea };
}
