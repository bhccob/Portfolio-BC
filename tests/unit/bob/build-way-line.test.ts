import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildOffPathLights, buildWayLine, WAY_LINE } from '~/engine/bob/build/wayLine';
import { palette } from '~/engine/palette';

type Vec3 = [number, number, number];

/** A straight way of `n` points a metre apart, down -z from the origin. */
const straight = (n: number): Vec3[] => Array.from({ length: n }, (_, k): Vec3 => [0, 0, -k]);

/** The colour of the tube's first vertex at ring `k` of its length. */
function colourAt(mesh: THREE.Mesh, k: number): [number, number, number] {
  const colour = mesh.geometry.getAttribute('color');
  const at = k * (WAY_LINE.radial + 1);
  return [colour.getX(at), colour.getY(at), colour.getZ(at)];
}

describe("the look back's line of the whole way", () => {
  it('is a fine tube along the way: 700 segments, 0.022 m round, 6 sides', () => {
    expect(WAY_LINE).toMatchObject({ segments: 700, radius: 0.022, radial: 6 });
    const line = buildWayLine(straight(40));
    const params = (line.mesh.geometry as THREE.TubeGeometry).parameters;
    expect([params.tubularSegments, params.radius, params.radialSegments, params.closed]).toEqual([700, 0.022, 6, false]);
    line.dispose();
  });

  it('draws the way as a gold line out of nothing, brightest at its end', () => {
    const line = buildWayLine(straight(40));
    expect(colourAt(line.mesh, 0)).toEqual([0, 0, 0]);
    const gold = new THREE.Color(palette.goldLight);
    const end = colourAt(line.mesh, 700);
    for (let i = 0; i < 3; i++) expect(end[i]).toBeCloseTo([gold.r, gold.g, gold.b][i]!, 6);
    // Brighter toward its end, all the way along.
    let last = -1;
    for (let k = 0; k <= 700; k += 50) {
      const now = colourAt(line.mesh, k)[0];
      expect(now).toBeGreaterThanOrEqual(last);
      last = now;
    }
    line.dispose();
  });

  it('adds its light, writes no depth and takes no fog, and shows only with a level above nothing', () => {
    const line = buildWayLine(straight(40));
    const material = line.mesh.material as THREE.MeshBasicMaterial;
    expect([material.blending, material.depthWrite, material.fog, material.transparent, material.vertexColors]).toEqual([THREE.AdditiveBlending, false, false, true, true]);
    expect(line.mesh.visible).toBe(false);
    line.setLevel(1);
    expect(line.mesh.visible).toBe(true);
    expect(material.opacity).toBeCloseTo(0.85, 9);
    line.setLevel(0.5);
    expect(material.opacity).toBeCloseTo(0.425, 9);
    line.setLevel(0);
    expect(line.mesh.visible).toBe(false);
    line.dispose();
  });
});

describe('the lights of the projects off the way', () => {
  it('draws a small gold light at each place, shown only with a level above nothing', () => {
    const lights = buildOffPathLights([
      [1, 2, 3],
      [4, 5, 6]
    ]);
    expect(lights.points.geometry.getAttribute('position').count).toBe(2);
    const material = lights.points.material as THREE.PointsMaterial;
    expect([material.size, material.sizeAttenuation, material.blending]).toEqual([0.12, true, THREE.AdditiveBlending]);
    expect(material.color.getHex()).toBe(palette.goldLight);
    expect(lights.points.visible).toBe(false);
    lights.setLevel(1);
    expect([lights.points.visible, material.opacity]).toEqual([true, 0.9]);
    lights.setLevel(0);
    expect(lights.points.visible).toBe(false);
    lights.dispose();
  });

  it('draws nothing for no places', () => {
    const lights = buildOffPathLights([]);
    lights.setLevel(1);
    expect(lights.points.visible).toBe(false);
    lights.dispose();
  });
});
