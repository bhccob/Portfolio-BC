import * as THREE from 'three';
import { Handlers } from '../core/Handlers';
import { ChipPointer } from './ChipPointer';
import type { TrackId } from './instrument/drive';

/** Told of the track under the pointer (null: none) as it changes, and of a click on one. */
export type TrackHandler = (track: TrackId | null, kind: 'hover' | 'click') => void;

/**
 * The pointer over the drive's tracks (CompassScene.onTrack): a ChipPointer
 * cast through the scene's camera onto the tracks' pick rings alone, not
 * their children. three 0.186 raycasts a mesh whether it is shown or not, so
 * nothing is picked unless the caller says the tracks answer (step). A hover
 * is told as it changes, null included; a click only over a track, and none
 * for the click that ends a press that turned the dial. Positions are CSS px
 * on a canvas of the size given; each handler is called on its own, so one
 * that throws is logged and the others still hear.
 */
export class TrackPointer {
  private readonly handlers = new Handlers<TrackHandler>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly chips: ChipPointer<TrackId>;
  /** The press that ended last turned the dial: the click that follows it is not a pick. */
  private turned = false;

  constructor(
    hits: readonly THREE.Mesh[],
    camera: THREE.Camera,
    /** Told as the hovered track changes, before the handlers (the scene's cursor and its next frame). */
    hovered: (track: TrackId | null) => void = () => {}
  ) {
    const rings = [...hits];
    this.chips = new ChipPointer<TrackId>(
      (ndc) => {
        this.raycaster.setFromCamera(ndc, camera);
        const [hit] = this.raycaster.intersectObjects(rings, false);
        return (hit?.object.userData.track as TrackId | undefined) ?? null;
      },
      (track, kind) => {
        if (kind === 'click' && track === null) return;
        if (kind === 'hover') hovered(track);
        this.handlers.each((handler) => {
          try {
            handler(track, kind);
          } catch (error) {
            console.error('[portfolio] a compass track handler failed', error);
          }
        });
      }
    );
  }

  /** The track under the pointer now, or null. */
  get hovered(): TrackId | null {
    return this.chips.hovered;
  }

  /** Calls `handler` as TrackPointer tells; answers its unsubscribe. */
  on(handler: TrackHandler): () => void {
    return this.handlers.add(handler);
  }

  /** A mouse or pen at (x, y) on a `width` × `height` canvas; off it, the tracks lose the pointer. */
  move(x: number, y: number, width: number, height: number): void {
    if (width > 0 && height > 0 && x >= 0 && y >= 0 && x <= width && y <= height) this.chips.move(this.toNdc(x, y, width, height, this.ndc));
    else this.chips.leave();
  }

  /** The pointer has left: no track is under it. */
  leave(): void {
    this.chips.leave();
  }

  /** Once a step, with the tracks where they stand: picks again while `interactive` (they move under a still pointer), else lets go. */
  step(interactive: boolean): void {
    this.chips.setInteractive(interactive);
    this.chips.frame();
  }

  /** A press begins: whatever came before, its click will count. */
  pressed(): void {
    this.turned = false;
  }

  /** The press ends, having `turned` the dial or not. */
  released(turned: boolean): void {
    this.turned = turned;
  }

  /** A click at (x, y): the track there, while the tracks answer, unless the press it ends turned the dial. */
  click(x: number, y: number, width: number, height: number): void {
    if (this.turned) {
      this.turned = false;
      return;
    }
    if (width > 0 && height > 0) this.chips.click(this.toNdc(x, y, width, height, new THREE.Vector2()));
  }

  /** Lets every handler go. */
  clear(): void {
    this.handlers.clear();
  }

  private toNdc(x: number, y: number, width: number, height: number, target: THREE.Vector2): THREE.Vector2 {
    return target.set((x / width) * 2 - 1, 1 - (y / height) * 2);
  }
}
