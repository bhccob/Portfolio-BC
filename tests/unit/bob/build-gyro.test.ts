import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildGyro, GYRO_LOOK, type GyroModel } from '~/engine/bob/build/gyro';

const CENTRE: [number, number, number] = [1, -9, 2];
const named = (model: GyroModel, name: string): THREE.Object3D => {
  const found = model.group.getObjectByName(name);
  if (!found) throw new Error(`no part named ${name}`);
  return found;
};
const bandOf = (model: GyroModel, k: number): THREE.ShaderMaterial => (named(model, `gyro:band:${k}`) as THREE.Mesh).material as THREE.ShaderMaterial;

// Three gold gyroscope rings round the stack (spec 2026-10-29-bob-stack-2-design.md, goal 3: "just go with the gyroscope",
// its outer ring "automatically slow rotates"; the rings mock-up's `gyro`).
describe('the gyroscope', () => {
  // Bob (2026-10-30): "make the strings on the tower less since it looks too busy ... where the strings are thick and go
  // past the screen"; shown two mock-ups he picked B: two thick, bright rings, no dashed lines (.superpowers/strings/).
  // At the world's stop the frame is some 17 m across either side of the stack, so rings of 19 and 23 m run past it.
  it("builds two thick rings round the machine's middle that run past the screen, each tipped its own way", () => {
    expect(GYRO_LOOK.rings.map((r) => [r.radius, r.tube, r.speed, r.riders])).toEqual([
      [19, 0.26, 0.05, 2],
      [23, 0.34, 0.018, 4]
    ]);
    const gyro = buildGyro(CENTRE);
    gyro.group.updateMatrixWorld(true);
    const turns: THREE.Quaternion[] = [];
    for (let k = 0; k < 2; k++) {
      const pivot = named(gyro, `gyro:ring:${k}`);
      const at = pivot.getWorldPosition(new THREE.Vector3());
      expect(at.toArray().map((v) => Number(v.toFixed(9)))).toEqual(CENTRE);
      turns.push(pivot.getWorldQuaternion(new THREE.Quaternion()));
    }
    expect(turns[0]!.angleTo(turns[1]!)).toBeGreaterThan(0.3);
    expect(gyro.group.getObjectByName('gyro:ring:2')).toBeUndefined();
    // The outermost carries the dial.
    named(gyro, 'gyro:dial:1');
    expect(gyro.group.getObjectByName('gyro:dial:0')).toBeUndefined();
    gyro.dispose();
  });

  it('draws no dashed rings beside them', () => {
    const gyro = buildGyro(CENTRE);
    const lines: THREE.Object3D[] = [];
    gyro.group.traverse((o) => {
      if ((o as THREE.Line).isLine) lines.push(o);
    });
    expect(lines).toEqual([]);
    gyro.dispose();
  });

  it('swings the outer ring round the stack, about a turn every two minutes', () => {
    expect(Math.abs((2 * Math.PI) / GYRO_LOOK.swing - 125.7)).toBeLessThan(1);
    const gyro = buildGyro(CENTRE);
    gyro.pose({ level: 1, focus: 1, clock: 0 });
    const turner = named(gyro, 'gyro:turner');
    expect(turner.rotation.y).toBe(0);
    gyro.pose({ level: 1, focus: 1, clock: 10 });
    expect(turner.rotation.y).toBeCloseTo(0.5, 12);
    // Each ring turns on its own axis at its own pace.
    expect(named(gyro, 'gyro:spin:0').rotation.y).toBeCloseTo(0.5, 12);
    expect(named(gyro, 'gyro:spin:1').rotation.y).toBeCloseTo(0.18, 12);
    gyro.dispose();
  });

  it('steps back to 42 % at a board, and is a little see-through', () => {
    // Bob's B: brighter than before (0.8, 0.62).
    expect([GYRO_LOOK.level, GYRO_LOOK.alpha]).toEqual([1.1, 0.9]);
    const gyro = buildGyro(CENTRE);
    gyro.pose({ level: 1, focus: 1, clock: 0 });
    expect(bandOf(gyro, 0).uniforms.uLevel!.value).toBeCloseTo(GYRO_LOOK.level, 12);
    gyro.pose({ level: 1, focus: 0.42, clock: 0 });
    expect(bandOf(gyro, 0).uniforms.uLevel!.value).toBeCloseTo(GYRO_LOOK.level * 0.42, 12);
    expect(bandOf(gyro, 1).uniforms.uAlpha!.value).toBe(0.9);
    expect(bandOf(gyro, 1).uniforms.uSpec!.value).toBe(0.6);
    gyro.dispose();
  });

  it('fades where it nears the camera', () => {
    const gyro = buildGyro(CENTRE);
    expect(bandOf(gyro, 0).fragmentShader).toMatch(/smoothstep\(12\.0, 30\.0, distance\(cameraPosition, vWorld\)\)/);
    gyro.dispose();
  });

  it('is dark until the power comes', () => {
    const gyro = buildGyro(CENTRE);
    gyro.pose({ level: 0, focus: 1, clock: 0 });
    expect(gyro.group.visible).toBe(false);
    gyro.pose({ level: 0.5, focus: 1, clock: 0 });
    expect(gyro.group.visible).toBe(true);
    gyro.dispose();
  });
});
