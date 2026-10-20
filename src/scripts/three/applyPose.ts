import { locate, type CompassPose, type Span } from './Choreography';
import type { TrackId } from './instrument/drive';
import type { InstrumentModel } from './instrument/Instrument';
import type { TracksModel } from './instrument/Tracks';
import type { WireModel } from './instrument/Wire';

/**
 * The compass scene's per-frame glue between the choreography's pose and the
 * parts it poses (CompassScene calls it once a step): the instrument with the
 * needle at `needleAngle` (radians on the dial, as the scene steers it; once
 * the arm has formed the instrument steers it itself) and the drive's values
 * as they are, the platter's turn included, never added to (the mirror's wipe
 * is platter-local and needs the pose's whole turns while it runs); the ring
 * pattern; the wire from the arm's tail (coilAnchor), read after the arm is
 * posed; and the tracks, lit as the pose says, the test point under the head
 * aglow, `hover` brighter while the pose answers the pointer, and the whole
 * group shown only once the platters have grown or a track is lit (the pins
 * ignore the light). Nothing here recompiles a program: every part only
 * changes values a program is not built from. It imports nothing from three.
 */
export function applyPose(model: InstrumentModel, wire: WireModel, tracks: TracksModel, pose: CompassPose, needleAngle: number, hover: TrackId | null): void {
  const { drive, head, park, platter } = pose;
  model.applyPose({ bearing: needleAngle, lift: pose.needle.lift, portrait: pose.portrait, threads: pose.threads, drive, head, park, platter });
  model.setPattern(pose.pattern.from, pose.pattern.to, pose.pattern.sweep, pose.pattern.origin);
  const coil = model.coilAnchor();
  wire.set(pose.wire, coil.anchor, coil.axis);
  tracks.group.visible = tracksShown(pose);
  tracks.set(pose.tracks.lit, { track: pose.tracks.current, index: pose.tracks.tp }, pose.interactive ? hover : null);
}

/** Whether the tracks' group shows: the platters fully grown, or a track lit. */
export function tracksShown(pose: Pick<CompassPose, 'drive' | 'tracks'>): boolean {
  return pose.drive.grow >= 1 || Object.values(pose.tracks.lit).some((lit) => lit > 0);
}

/**
 * Whether the free turn is held: while the needle is becoming the arm (or the
 * arm the needle), strictly between 0 and 1. The arm turns from the needle's
 * live bearing the short way (armState), so a spin then could flip it; the
 * scene lets a drag go and takes no new one, and a spin already under way
 * eases on as it would.
 */
export function freeTurnLocked(arm: number): boolean {
  return arm > 0 && arm < 1;
}

/**
 * `progress` among the spans `from`, carried to the same section and as far
 * through it among the spans `to` (the page measured them again: a question
 * opened, a resize), so the scene's eased progress does not jump to another
 * pose meanwhile. Unchanged where `to` lacks that section.
 */
export function carryProgress(progress: number, from: readonly Span[], to: readonly Span[]): number {
  const { id, local } = locate(progress, from);
  const span = to.find((s) => s.id === id);
  return span ? Math.min(1, Math.max(0, span.start + local * span.length)) : progress;
}
