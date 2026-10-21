import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { COUNTRY_IDS } from '~/data/directions';
import { constellationsOnScreen } from '~/debug/constellationAnchors';
import { AIM_SHELL, pointerBearing } from '~/engine/v3/aim';
import { buildConstellations } from '~/engine/v3/build/constellations';
import { pointedAt } from '~/engine/v3/constellations';
import { applyCameraShot, homeShotFor } from '~/engine/v3/shots';

/** The home camera for a screen of this size, as the Rig places it (no parallax). */
function homeCamera(width: number, height: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  applyCameraShot(camera, homeShotFor(width / height), width / height);
  return camera;
}

describe('constellationsOnScreen', () => {
  it("puts each constellation's label anchor (its stars' centroid) on the screen, in CSS px", () => {
    const camera = homeCamera(1440, 900);
    const sky = buildConstellations();
    const places = constellationsOnScreen(camera, { left: 0, top: 0, width: 1440, height: 900 });
    expect(Object.keys(places).sort()).toEqual(['aruba', 'china', 'netherlands']);
    for (const id of COUNTRY_IDS) {
      const ndc = sky.anchor(id).project(camera);
      expect(places[id][0]).toBeCloseTo(((ndc.x + 1) / 2) * 1440, 6);
      expect(places[id][1]).toBeCloseTo(((1 - ndc.y) / 2) * 900, 6);
    }
    // China on the right, Aruba on the left, the ship above the middle.
    expect(places.china[0]).toBeGreaterThan(1100);
    expect(places.aruba[0]).toBeLessThan(340);
    expect(Math.abs(places.netherlands[0] - 720)).toBeLessThan(2);
    expect(places.netherlands[1]).toBeLessThan(places.china[1]);
    sky.dispose();
  });

  it('measures from the viewport: a canvas that does not start at its corner moves every place with it', () => {
    const camera = homeCamera(1440, 900);
    const at = constellationsOnScreen(camera, { left: 0, top: 0, width: 1440, height: 900 });
    const moved = constellationsOnScreen(camera, { left: 10, top: 64, width: 1440, height: 900 });
    for (const id of COUNTRY_IDS) expect(moved[id]).toEqual([at[id][0] + 10, at[id][1] + 64]);
  });

  for (const [width, height] of [[1440, 900], [1280, 1024], [390, 844]] as const) {
    it(`${width} x ${height}: a mouse on each place points the needle into that constellation`, () => {
      const camera = homeCamera(width, height);
      const places = constellationsOnScreen(camera, { left: 0, top: 0, width, height });
      for (const id of COUNTRY_IDS) {
        const [x, y] = places[id];
        expect(x).toBeGreaterThan(0);
        expect(x).toBeLessThan(width);
        expect(y).toBeGreaterThan(0);
        expect(y).toBeLessThan(height);
        const bearing = pointerBearing({ x: (x / width) * 2 - 1, y: 1 - (y / height) * 2 }, camera, AIM_SHELL);
        expect(bearing, id).not.toBeNull();
        expect(pointedAt(bearing!), id).toBe(id);
      }
    });
  }
});
