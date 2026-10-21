import * as THREE from 'three';
import { COUNTRY_IDS, type CountryId } from '~/data/directions';
import { starPositions } from '~/engine/v3/constellations';

/** Each constellation's centroid, as the builder's `anchor` reckons it (the mean of `starPositions`), built on first use. */
let anchors: ReadonlyMap<CountryId, THREE.Vector3> | null = null;

function anchorsOf(): ReadonlyMap<CountryId, THREE.Vector3> {
  if (!anchors) {
    anchors = new Map(
      COUNTRY_IDS.map((id) => {
        const stars = starPositions(id);
        const centroid = new THREE.Vector3();
        for (let k = 0; k < stars.length; k += 3) centroid.add(new THREE.Vector3(stars[k], stars[k + 1], stars[k + 2]));
        return [id, centroid.divideScalar(stars.length / 3)];
      }),
    );
  }
  return anchors;
}

const probe = new THREE.Vector3();

/**
 * Where each constellation's anchor (its stars' centroid, the point its label hangs from: `ConstellationsModel.anchor`)
 * is on the screen through `camera`, in CSS pixels from the viewport's top left, for a canvas at `rect` (its
 * `getBoundingClientRect()`). The debug bridge reports it (`constellations`) so the proof harness can move the mouse
 * onto a constellation; the needle's aim reads the same camera, so a mouse there points the needle into it. The
 * camera's matrices are read as the last frame left them. Debug only: the Stage's probe calls it under `?proof`, on a
 * read of the bridge, never per frame.
 */
export function constellationsOnScreen(
  camera: THREE.Camera,
  rect: { left: number; top: number; width: number; height: number },
): Record<CountryId, [x: number, y: number]> {
  const out = {} as Record<CountryId, [number, number]>;
  for (const [id, anchor] of anchorsOf()) {
    probe.copy(anchor).project(camera);
    out[id] = [rect.left + ((probe.x + 1) / 2) * rect.width, rect.top + ((1 - probe.y) / 2) * rect.height];
  }
  return out;
}
