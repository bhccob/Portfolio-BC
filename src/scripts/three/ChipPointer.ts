import type * as THREE from 'three';

/**
 * The pointer over the device's parts, apart from the renderer so its
 * decisions can be tested without WebGL. It keeps where the pointer is and
 * the part it is on (a chip by default; the hub picks whole layers), picks
 * again every frame (the device moves under a still pointer), and answers
 * hover changes and clicks. While it is not interactive it picks nothing: no
 * hover, no click, and a part it held is let go, so the scene clears its
 * highlight and the cursor.
 */
export class ChipPointer<T = THREE.Mesh> {
  /** The pointer in normalised device coordinates, or null while it is off the canvas. */
  private pointer: THREE.Vector2 | null = null;
  private held: T | null = null;
  private interactive = true;

  constructor(
    /** The part under a pointer position, or null (a raycast). */
    private readonly pick: (pointer: THREE.Vector2) => T | null,
    /** Told when the hovered part changes, and on every click that counts (null: not on one). */
    private readonly answer: (part: T | null, kind: 'hover' | 'click') => void
  ) {}

  /** The part under the pointer now, or null. */
  get hovered(): T | null {
    return this.held;
  }

  /** Lets the parts answer the pointer, or not; switching off lets go of the hovered one. */
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

  /** Once a frame: picks under the pointer again, while there is one and the parts are interactive. */
  frame(): void {
    if (this.interactive && this.pointer) this.hover(this.pick(this.pointer));
  }

  /** A click at `pointer`: answered with the part there (or null), unless the parts are not interactive. */
  click(pointer: THREE.Vector2): void {
    if (this.interactive) this.answer(this.pick(pointer), 'click');
  }

  private hover(part: T | null): void {
    if (part === this.held) return;
    this.held = part;
    this.answer(part, 'hover');
  }
}
