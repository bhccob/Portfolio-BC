import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildDevice } from '../../src/scripts/three/Device';
import { chipAt } from '../../src/scripts/three/DeviceScene';
import { poseAt } from '../../src/scripts/three/Teardown';

describe('chipAt', () => {
  // The board shot (p = 0.5) at 16:10, as DeviceScene frames it on a wide canvas.
  const device = buildDevice();
  const pose = poseAt(0.5);
  device.applyPose(pose);
  const camera = new THREE.PerspectiveCamera(35, 1.6, 0.1, 100);
  camera.position.set(...pose.camera.position);
  camera.lookAt(...pose.camera.target);
  camera.updateMatrixWorld();
  device.group.updateWorldMatrix(true, true);

  const rest = device.chips.map((chip) => chip.position.y);
  const funcial = device.chips[0];
  funcial.geometry.computeBoundingBox();
  const body = funcial.geometry.boundingBox!;
  // Low on the body's front face at rest: below where the body is once lifted.
  const edge = funcial.localToWorld(new THREE.Vector3(0, body.min.y + 0.02, body.max.z));
  const ndc = edge.clone().project(camera);
  const pointer = new THREE.Vector2(ndc.x, ndc.y);

  it('answers for a lifted chip where it stands at rest, as hover does', () => {
    funcial.position.y = rest[0] + 0.06;
    device.group.updateWorldMatrix(true, true);

    // The lifted body has left this ray: a pick as last drawn misses the chip.
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, camera);
    expect(raycaster.intersectObject(device.group, true)[0]?.object).not.toBe(funcial);

    expect(chipAt(device, rest, camera, pointer)).toBe(funcial);
    expect(funcial.position.y).toBeCloseTo(rest[0] + 0.06);
  });

  it('answers null off the chips', () => {
    expect(chipAt(device, rest, camera, new THREE.Vector2(0.98, 0.98))).toBeNull();
  });
});
