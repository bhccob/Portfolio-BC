/** Central place for the user's motion and input preferences. */
export class Motion {
  static get reduced(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /** A mouse or trackpad: precise pointer that can hover. */
  static get finePointer(): boolean {
    return window.matchMedia('(pointer: fine) and (hover: hover)').matches;
  }
}
