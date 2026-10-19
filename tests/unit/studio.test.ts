import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BACKDROP, buildBackdrop } from '../../src/scripts/three/studio/Backdrop';
import { buildDust } from '../../src/scripts/three/studio/Dust';
import { shoulder } from '../../src/scripts/three/studio/CompassStudio';

describe('the backdrop', () => {
  const direction = (backdrop: ReturnType<typeof buildBackdrop>): THREE.Vector3 =>
    (backdrop.mesh.material as THREE.ShaderMaterial).uniforms.uDirection.value as THREE.Vector3;

  it("keeps the hub's glow by default and centres it where it is asked to, normalised", () => {
    const hub = buildBackdrop();
    expect(direction(hub).toArray()).toEqual(new THREE.Vector3(...BACKDROP.direction).normalize().toArray());
    const compass = buildBackdrop({ direction: [0, -0.15, -1] });
    const expected = new THREE.Vector3(0, -0.15, -1).normalize();
    expect(direction(compass).distanceTo(expected)).toBeLessThan(1e-9);
    hub.dispose();
    compass.dispose();
  });
});

describe('the dust', () => {
  const positions = (dust: ReturnType<typeof buildDust>): Float32Array => dust.points.geometry.getAttribute('position').array as Float32Array;

  it('fills a volume evenly and lights it alike', () => {
    const min = [-4, -3, -4] as const;
    const max = [4, 3, 2] as const;
    const dust = buildDust({ max: 2000, volume: { min, max } });
    const p = positions(dust);
    const halves = [0, 0];
    for (let i = 0; i < p.length; i += 3) {
      for (let axis = 0; axis < 3; axis++) {
        expect(p[i + axis]).toBeGreaterThanOrEqual(min[axis]);
        expect(p[i + axis]).toBeLessThanOrEqual(max[axis]);
      }
      halves[p[i] < 0 ? 0 : 1]++;
    }
    // Even: about as many motes either side of the middle, not crowded into a cone.
    expect(Math.abs(halves[0] - halves[1])).toBeLessThan(200);
    const material = dust.points.material as THREE.ShaderMaterial;
    expect(material.defines).toHaveProperty('DUST_VOLUME');
    expect(material.uniforms.uFloor.value).toBe(-3);
    expect(material.uniforms.uSpan.value).toBe(6);
    // Every mote, swaying, stays inside the bounds three culls by.
    const bounds = dust.points.geometry.boundingSphere!;
    for (const corner of [min, max, [min[0], max[1], max[2]], [max[0], min[1], min[2]]] as const) {
      expect(bounds.distanceToPoint(new THREE.Vector3(...corner))).toBeLessThanOrEqual(0);
    }
    dust.dispose();
  });

  it("leaves the hub's beam as it was", () => {
    const dust = buildDust({ apex: [0, 9, -0.25], top: 0.3, radius: 2.2, floor: -0.55, max: 50 });
    const material = dust.points.material as THREE.ShaderMaterial;
    expect(material.defines).not.toHaveProperty('DUST_VOLUME');
    expect(material.uniforms.uFloor.value).toBe(-0.55);
    expect(material.uniforms.uApex.value.toArray()).toEqual([0, 9, -0.25]);
    dust.setCount(20);
    expect(dust.points.geometry.drawRange.count).toBe(20);
    dust.dispose();
  });
});

describe("the compass studio's tone mapping", () => {
  it("puts PBR Neutral's shoulder, without its toe, in three's custom tone mapping, once", () => {
    const plain = 'vec3 CustomToneMapping( vec3 color ) { return color; }';
    expect(THREE.ShaderChunk.tonemapping_pars_fragment).toContain(plain);
    shoulder();
    shoulder();
    const chunk = THREE.ShaderChunk.tonemapping_pars_fragment;
    expect(chunk).not.toContain(plain);
    const custom = chunk.slice(chunk.indexOf('vec3 CustomToneMapping'));
    expect(chunk.split('vec3 CustomToneMapping').length).toBe(2);
    expect(custom).toContain('const float StartCompression = 0.8;');
    // No toe: nothing takes an offset off the darkest channel.
    expect(custom).not.toContain('offset');
    // Neutral itself is left as it was.
    expect(chunk).toContain('float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;');
  });
});
