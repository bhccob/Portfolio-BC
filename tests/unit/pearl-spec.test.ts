import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEAD_ZONE, easePearl, PEARL_EASE, PEARL_REST, restAt } from '../../src/scripts/three/pearlSpec';
import { restSpot } from '../../src/scripts/three/Pearl';

const source = (path: string) => readFileSync(new URL(`../../src/scripts/${path}`, import.meta.url), 'utf8');

describe("the pearl's shared numbers", () => {
  it('rests the pearl below-right of the rim, inside the screen', () => {
    expect(restAt(720, 450, 576, 1440, 900)).toEqual([720 + 0.42 * 576, 450 + 0.42 * 576]);
    // Near the right edge the rest spot would fall off it, so it is kept 24 px inside.
    expect(restAt(250, 422, 312, 390, 844)).toEqual([366, 422 + 0.42 * 312]);
    expect(restAt(10, 10, 10, 40, 40)).toEqual([20, 20]);
    expect(PEARL_REST).toEqual({ offset: 0.42, margin: 24 });
  });

  it("is the scene's rest spot, and its ease is MathUtils.damp's", () => {
    for (const layout of [{ x: 700, y: 450, diameter: 500 }, { x: 195, y: 253, diameter: 312 }, { x: 700, y: 500, diameter: 400 }]) {
      expect(restSpot(800, 600, layout)).toEqual(restAt(layout.x, layout.y, layout.diameter, 800, 600));
    }
    for (const [from, to, dt] of [[0, 100, 1 / 60], [300, -20, 0.1], [5, 5, 0.5], [0, 1, 0]]) {
      expect(easePearl(from, to, dt)).toBeCloseTo(THREE.MathUtils.damp(from, to, PEARL_EASE, dt), 12);
    }
    expect(DEAD_ZONE).toBe(0.15);
  });

  it('is the one copy: the loader, the pearl and the scene read it, and it imports nothing', () => {
    expect(source('three/pearlSpec.ts')).not.toMatch(/^\s*import\s/m);
    expect(source('ui/CompassLoader.ts')).toMatch(/import \{[^}]*\bDEAD_ZONE\b[^}]*\beasePearl\b[^}]*\brestAt\b[^}]*\} from '..\/three\/pearlSpec'/);
    expect(source('three/Pearl.ts')).toMatch(/from '.\/pearlSpec'/);
    expect(source('three/CompassScene.ts')).toMatch(/import \{ easePearl \} from '.\/pearlSpec'/);
    // No copy of the numbers left behind in code (a comment may still name them).
    for (const file of ['ui/CompassLoader.ts', 'three/Pearl.ts', 'three/CompassScene.ts', 'compass/loading.ts']) {
      expect(source(file), file).not.toMatch(/\b(PEARL_DAMP|REST|DEAD_ZONE|MARGIN)\s*=\s*[\d{]|0\.42\s*\*/);
    }
  });

  it('keeps the loader bundle three-free', () => {
    for (const file of ['three/pearlSpec.ts', 'compass/loading.ts', 'three/AngleSpring.ts', 'core/Handlers.ts', 'ui/CompassLoader.ts', 'compass-main.ts']) {
      expect(source(file), file).not.toMatch(/from '(three|gsap|lenis)[^']*'|from '[^']*(CompassScene|CompassStageController)'/);
    }
  });
});
