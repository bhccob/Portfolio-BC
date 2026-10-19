import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { ChipPointer } from '../../src/scripts/three/ChipPointer';

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
