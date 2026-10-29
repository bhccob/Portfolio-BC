/**
 * The light's and the void's pose as the journey hands them to the scene (src/scene/bob/journey.ts), shared by the
 * light dive and the light's path (./worldPath.ts) without either importing the journey. Types only.
 */
import type { LightAt, TrailPoint, VoidAt } from './lightDive';

/** The light with what is drawn of it: its trail's points and level (laid as circuit traces, ./circuit.ts). */
export interface LightPose extends LightAt {
  trail: TrailPoint[];
  trailLevel: number;
}

/** The void's state, with how far it has streamed toward the camera (m). */
export interface VoidPose extends VoidAt {
  stream: number;
}
