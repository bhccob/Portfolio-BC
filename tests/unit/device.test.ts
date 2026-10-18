import { describe, expect, it } from 'vitest';
import { buildDevice, CHIP_SLUGS } from '../../src/scripts/three/Device';
import { LAYERS, poseAt } from '../../src/scripts/three/Teardown';
import { palette } from '../../src/scripts/three/palette';

describe('buildDevice', () => {
  const device = buildDevice();
  it('has every layer inside the group', () => {
    LAYERS.forEach((id) => expect(device.layers[id].parent).toBe(device.group));
  });
  it('carries the four chips in order', () => {
    expect(device.chips.map((c) => c.userData.slug)).toEqual([...CHIP_SLUGS]);
    device.chips.forEach((c) => expect(c.parent).not.toBeNull());
  });
  it('uses the yellow ball as the power button', () => {
    const material = device.powerButton.material as { color: { getHex(): number } };
    expect(material.color.getHex()).toBe(palette.yellow);
  });
  it('applies a pose to layer heights', () => {
    const pose = poseAt(0.5);
    device.applyPose(pose);
    LAYERS.forEach((id) => expect(device.layers[id].position.y).toBeCloseTo(pose.offsets[id]));
  });
  it('slides the layers above the focus aside, to the right', () => {
    device.applyPose(poseAt(1));
    expect(device.layers.shell.position.x).toBeCloseTo(4.6);
    expect(device.layers.shell.rotation.z).toBeCloseTo(-0.3);
    expect(device.layers.back.position.x).toBe(0);
    expect(device.layers.back.rotation.z).toBeCloseTo(0);
  });
});
