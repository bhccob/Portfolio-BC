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
  it("builds three rings round the machine's middle, each tipped its own way", () => {
    expect(GYRO_LOOK.rings.map((r) => [r.radius, r.tube, r.speed, r.riders, r.companion])).toEqual([
      [12.5, 0.07, 0.05, 2, 0.4],
      [14.6, 0.06, -0.034, 3, -0.4],
      [16.8, 0.085, 0.018, 4, 0.5]
    ]);
    const gyro = buildGyro(CENTRE);
    gyro.group.updateMatrixWorld(true);
    const turns: THREE.Quaternion[] = [];
    for (let k = 0; k < 3; k++) {
      const pivot = named(gyro, `gyro:ring:${k}`);
      const at = pivot.getWorldPosition(new THREE.Vector3());
      expect(at.toArray().map((v) => Number(v.toFixed(9)))).toEqual(CENTRE);
      turns.push(pivot.getWorldQuaternion(new THREE.Quaternion()));
    }
    expect(turns[0]!.angleTo(turns[1]!)).toBeGreaterThan(0.3);
    expect(turns[1]!.angleTo(turns[2]!)).toBeGreaterThan(0.3);
    // The outermost carries the dial.
    named(gyro, 'gyro:dial:2');
    expect(gyro.group.getObjectByName('gyro:dial:0')).toBeUndefined();
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
    expect(named(gyro, 'gyro:spin:1').rotation.y).toBeCloseTo(-0.34, 12);
    gyro.dispose();
  });

  it('steps back to 42 % at a board, and is a little see-through', () => {
    const gyro = buildGyro(CENTRE);
    gyro.pose({ level: 1, focus: 1, clock: 0 });
    expect(bandOf(gyro, 0).uniforms.uLevel!.value).toBeCloseTo(GYRO_LOOK.level, 12);
    gyro.pose({ level: 1, focus: 0.42, clock: 0 });
    expect(bandOf(gyro, 0).uniforms.uLevel!.value).toBeCloseTo(GYRO_LOOK.level * 0.42, 12);
    expect(bandOf(gyro, 1).uniforms.uAlpha!.value).toBe(0.62);
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
