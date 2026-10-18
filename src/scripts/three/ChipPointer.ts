import type * as THREE from 'three';

/**
 * The pointer over the device's chips, apart from the renderer so its
 * decisions can be tested without WebGL. It keeps where the pointer is and
 * the chip it is on, picks again every frame (the device moves under a still
 * pointer), and answers hover changes and clicks. While the chips are not
 * interactive it picks nothing: no hover, no click, and a chip it held is
 * let go, so DeviceScene lowers it and clears the cursor.
 */
export class ChipPointer {
  /** The pointer in normalised device coordinates, or null while it is off the canvas. */
  private pointer: THREE.Vector2 | null = null;
  private held: THREE.Mesh | null = null;
  private interactive = true;

  constructor(
    /** The chip under a pointer position, or null (a raycast; see chipAt). */
    private readonly pick: (pointer: THREE.Vector2) => THREE.Mesh | null,
    /** Told when the hovered chip changes, and on every click that counts (null: not on a chip). */
    private readonly answer: (chip: THREE.Mesh | null, kind: 'hover' | 'click') => void
  ) {}

  /** The chip under the pointer now, or null. */
  get hovered(): THREE.Mesh | null {
    return this.held;
  }

  /** Lets the chips answer the pointer, or not; switching off lets go of the hovered chip. */
  setInteractive(on: boolean): void {
    this.interactive = on;
    if (!on) this.hover(null);
  }

  move(pointer: THREE.Vector2): void {
    this.pointer = pointer;
  }

  leave(): void {
    this.pointer = null;
    this.hover(null);
  }

  /** Once a frame: picks under the pointer again, while there is one and the chips are interactive. */
  frame(): void {
    if (this.interactive && this.pointer) this.hover(this.pick(this.pointer));
  }

  /** A click at `pointer`: answered with the chip there (or null), unless the chips are not interactive. */
  click(pointer: THREE.Vector2): void {
    if (this.interactive) this.answer(this.pick(pointer), 'click');
  }

  private hover(chip: THREE.Mesh | null): void {
    if (chip === this.held) return;
    this.held = chip;
    this.answer(chip, 'hover');
  }
}
