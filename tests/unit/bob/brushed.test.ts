import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { patchBrushed, roundTangents } from '~/engine/bob/build/brushed';

// Round 8 (spec 2026-10-30-bob-moonlit-3d-design.md): Bob found the compass and the tower "doesnt look polished"; their
// metal is brushed, its highlight streaked and broken up.

const physical = () => ({ uniforms: {}, vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader });

describe('brushed metal', () => {
  it("lays fine rings of roughness round the part's own axis, within its range", () => {
    const shader = physical();
    patchBrushed([0.16, 0.3])(shader);
    expect(shader.vertexShader).toContain('varying vec3 vBrushPos;');
    expect(shader.vertexShader.indexOf('vBrushPos = position;')).toBeGreaterThan(shader.vertexShader.indexOf('#include <begin_vertex>'));
    expect(shader.fragmentShader).toContain('varying vec3 vBrushPos;');
    // Rings: the same along the way round the axis, so the roughness depends on the distance from it and the height alone.
    expect(shader.fragmentShader).toMatch(/length\( vBrushPos\.xz \)/);
    expect(shader.fragmentShader).toMatch(/roughnessFactor = mix\( 0\.160, 0\.300, /);
    expect(shader.fragmentShader.indexOf('roughnessFactor = mix(')).toBeGreaterThan(shader.fragmentShader.indexOf('#include <roughnessmap_fragment>'));
  });

  it("runs each tangent round the part's Y axis, so three's anisotropy streaks the highlight that way", () => {
    const g = new THREE.TorusGeometry(1.5, 0.02, 8, 48).rotateX(Math.PI / 2);
    roundTangents(g);
    const t = g.getAttribute('tangent');
    const p = g.getAttribute('position');
    expect(t.itemSize).toBe(4);
    expect(t.count).toBe(p.count);
    for (let i = 0; i < p.count; i++) {
      const [tx, ty, tz, tw] = [t.getX(i), t.getY(i), t.getZ(i), t.getW(i)];
      expect(Math.hypot(tx, ty, tz)).toBeCloseTo(1, 6);
      expect(ty).toBe(0);
      expect(tx * p.getX(i) + tz * p.getZ(i)).toBeCloseTo(0, 6);
      expect(tw).toBe(1);
    }
  });

  it('gives a point on the axis a tangent all the same', () => {
    const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 1, 0, 0, -1, 0], 3));
    roundTangents(g);
    const t = g.getAttribute('tangent');
    expect(Math.hypot(t.getX(0), t.getY(0), t.getZ(0))).toBeCloseTo(1, 9);
  });
});
