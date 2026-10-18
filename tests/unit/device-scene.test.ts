import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { ChipPointer } from '../../src/scripts/three/ChipPointer';
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

describe('ChipPointer', () => {
  const chip = new THREE.Mesh();
  const at = new THREE.Vector2(0.1, -0.2);

  /** A pointer over `chip` wherever it is, recording what it answers. */
  function pointer() {
    const pick = vi.fn((_: THREE.Vector2): THREE.Mesh | null => chip);
    const answers: [THREE.Mesh | null, 'hover' | 'click'][] = [];
    const chips = new ChipPointer(pick, (mesh, kind) => answers.push([mesh, kind]));
    return { chips, pick, answers };
  }

  it('picks every frame under a still pointer and answers hover changes only', () => {
    const { chips, pick, answers } = pointer();
    chips.move(at);
    chips.frame();
    chips.frame();
    expect(pick).toHaveBeenCalledTimes(2);
    expect(chips.hovered).toBe(chip);
    expect(answers).toEqual([[chip, 'hover']]);
    chips.leave();
    expect(chips.hovered).toBeNull();
    expect(answers).toEqual([[chip, 'hover'], [null, 'hover']]);
  });

  it('while not interactive, picks nothing, holds no chip and ignores clicks', () => {
    const { chips, pick, answers } = pointer();
    chips.setInteractive(false);
    chips.move(at);
    chips.frame();
    chips.click(at);
    expect(pick).not.toHaveBeenCalled();
    expect(chips.hovered).toBeNull();
    expect(answers).toEqual([]);
  });

  it('lets go of the hovered chip when it stops being interactive, and picks again when it starts', () => {
    const { chips, answers } = pointer();
    chips.move(at);
    chips.frame();
    chips.setInteractive(false);
    expect(chips.hovered).toBeNull();
    expect(answers).toEqual([[chip, 'hover'], [null, 'hover']]);
    chips.frame();
    expect(answers).toHaveLength(2);
    chips.setInteractive(true);
    chips.frame();
    expect(chips.hovered).toBe(chip);
    expect(answers).toEqual([[chip, 'hover'], [null, 'hover'], [chip, 'hover']]);
  });

  it('answers a click with the chip under it, or null off the chips, while interactive', () => {
    const { chips, pick, answers } = pointer();
    chips.click(at);
    pick.mockReturnValueOnce(null);
    chips.click(at);
    expect(answers).toEqual([[chip, 'click'], [null, 'click']]);
  });
});
