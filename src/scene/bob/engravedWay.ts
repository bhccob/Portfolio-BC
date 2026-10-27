/**
 * The engraved way, as plain numbers (spec 2026-10-27-bob-engraved-way-design.md): the shaft the light falls down and
 * the lines it rides between the projects, and how much of each shows at a pose. Pure, as the journey and the path are:
 * no React, no three, so the tests read the very levels the scene applies (src/engine/bob/build/engraved.ts draws them).
 *
 * It is the engraved-way mock-up Bob approved on 2026-10-27 (branch engraved-mock), with its numbers:
 * - the throat: narrow gold rings round the fall, inside the glass floor's hole, seen from above as the light drops
 *   through the compass; gone before the first fact shows;
 * - the hall: wide rings the camera stands inside once it turns to follow the light from the side, opening out below
 *   `HALL.open` (wider, further apart, a little tilted) and fading over the first trip;
 * - the trips: the light's own line along each travel, out early in the bead's orbit, none inside, all faint in the
 *   look back behind the way's gold line.
 */
import type { JourneyAt } from './journey';
import type { Path, PathFrame, Vec3 } from './lightPath';
import { smoothstep, type Span, through } from './scrollPose';

/** One ring of the shaft: its height, radius and band width (m), its tilt about x and z, and the part it belongs to. */
export interface RingSpec {
  y: number;
  radius: number;
  width: number;
  tilt: [number, number];
  zone: 'throat' | 'hall';
}

/** How much of each part shows, 0..1: the throat, the hall, and each trip's line in the way's order. */
export interface EngravedLevels {
  throat: number;
  hall: number;
  trips: number[];
}

/** The mock-up's numbers: the shaft's shape (m), and the windows (way frames, or a part's t) each part shows over. */
export const ENGRAVED = {
  THROAT: { top: -0.4, bottom: -10.5, radius: 1.45, spacing: 0.46, width: 0.07 },
  HALL: { top: -4.6, open: -8.2, bottom: -13.2, radius: 5.2, openRadius: 12, spacing: 0.34, openSpacing: 1.4 },
  /** The throat lights as the light drops into it, and is gone before the first fact (way frame 61). */
  THROAT_IN: [8, 40],
  THROAT_OUT: [46, 60],
  /** The hall comes in as the camera turns to the side. */
  HALL_IN: [52, 72],
  /** Over the first travel's t, the hall fades out by this. */
  HALL_OUT_T: 0.6,
  /** The first trip's line begins this far into its travel, past the turn out of the fall. */
  FIRST_TRIP_FROM_T: 0.12,
  FIRST_TRIP_IN_T: [0.05, 0.25],
  /** Over an orbit's t, its trip's line fades out by this. */
  ORBIT_OUT_T: 0.35,
  /** The look back: every line, faint, coming in over its t. */
  LOOK: { level: 0.32, in: [0.15, 0.7] }
} as const;

/** Smoothstep over a span. */
function over(span: Span, u: number): number {
  return smoothstep(through(u, span));
}

/** The shaft's rings, top down: the throat's, all alike, then the hall's, opening out below `HALL.open`. */
export function shaftRings(): RingSpec[] {
  const { THROAT, HALL } = ENGRAVED;
  const rings: RingSpec[] = [];
  for (let k = 0; THROAT.top - k * THROAT.spacing > THROAT.bottom; k++) {
    rings.push({ y: THROAT.top - k * THROAT.spacing, radius: THROAT.radius, width: THROAT.width, tilt: [0, 0], zone: 'throat' });
  }
  for (let y: number = HALL.top; y > HALL.bottom; ) {
    const e = y < HALL.open ? smoothstep((HALL.open - y) / (HALL.open - HALL.bottom)) : 0;
    rings.push({
      y,
      radius: HALL.radius + (HALL.openRadius - HALL.radius) * e,
      width: 0.13 + 0.12 * e,
      // The opening rings tilt a little, each its own way, as they float apart.
      tilt: e > 0 ? [e * 0.12 * Math.sin(y * 3.1), e * 0.1 * Math.cos(y * 2.3)] : [0, 0],
      zone: 'hall'
    });
    y -= HALL.spacing + (HALL.openSpacing - HALL.spacing) * e;
  }
  return rings;
}

/**
 * Each part's level at a pose: in the light dive by its way frame (`at.frame`), on the path by its part, project and t
 * (`path`, null off the path); `trips` is how many lines there are, one a project.
 */
export function engravedLevels(
  at: Pick<JourneyAt, 'stretch' | 'frame'>,
  path: Pick<PathFrame, 'part' | 'index' | 't' | 'black'> | null,
  trips: number
): EngravedLevels {
  const levels: number[] = new Array(trips).fill(0);
  if (at.stretch === 'light' && at.frame !== null) {
    const f = at.frame;
    return { throat: over(ENGRAVED.THROAT_IN, f) * (1 - over(ENGRAVED.THROAT_OUT, f)), hall: over(ENGRAVED.HALL_IN, f), trips: levels };
  }
  if (path === null) return { throat: 0, hall: 0, trips: levels };
  const { part, index, t } = path;
  const own = index >= 0 && index < trips;
  if (part === 'travel' && own) levels[index] = index === 0 ? over(ENGRAVED.FIRST_TRIP_IN_T, t) : 1;
  else if (part === 'orbit' && own) levels[index] = 1 - smoothstep(t / ENGRAVED.ORBIT_OUT_T);
  else if (part === 'look') levels.fill(ENGRAVED.LOOK.level * over(ENGRAVED.LOOK.in, t));
  else if (part === 'sheet') levels.fill(ENGRAVED.LOOK.level * (1 - path.black));
  const hall = part === 'travel' && index === 0 ? 1 - smoothstep(t / ENGRAVED.HALL_OUT_T) : 0;
  return { throat: 0, hall, trips: levels };
}

/** The furthest the trips are sampled past the path's start (units): past any way's look back. */
const MAX_Q = 200;

/**
 * The light's places along each travel, every `step` units of the path: one line a project, in the way's order. The
 * first begins past the turn out of the fall (`FIRST_TRIP_FROM_T`), so no line crosses the last fact; the look back ends
 * them.
 */
export function tripPoints(path: Pick<Path, 'frameAt'>, step = 0.02): Vec3[][] {
  const trips: Vec3[][] = [];
  for (let k = 0; k * step <= MAX_Q; k++) {
    const frame = path.frameAt(k * step);
    if (frame.part === 'look' || frame.part === 'sheet') break;
    if (frame.part !== 'travel' || (frame.index === 0 && frame.t < ENGRAVED.FIRST_TRIP_FROM_T)) continue;
    const [x, y, z] = frame.light.position;
    (trips[frame.index] ??= []).push([x, y, z]);
  }
  return trips;
}
