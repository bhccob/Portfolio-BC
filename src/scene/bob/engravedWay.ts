/**
 * The engraved way, as plain numbers (spec 2026-10-27-bob-engraved-way-design.md): the shaft the light falls down, and
 * how much of it shows at a pose. Pure, as the journey and the path are:
 * no React, no three, so the tests read the very levels the scene applies (src/engine/bob/build/engraved.ts draws them).
 *
 * It is the engraved-way mock-up Bob approved on 2026-10-27 (branch engraved-mock), with its numbers:
 * - the throat: narrow gold rings round the fall, inside the glass floor's hole, seen from above as the light drops
 *   through the compass; gone before the first fact shows;
 * - the hall: wide rings the camera stands inside once it turns to follow the light from the side, opening out below
 *   `HALL.open` (wider, further apart, a little tilted), giving way to the nebula's clouds as they come in (./nebulaWay.ts
 *   `NEBULA.HALL_GIVES`, the 3D world's spec): none on the path.
 * The trips' lines between the beads went with the beads (spec 2026-10-27-bob-hologram-world-design.md): the light falls
 * straight on into the world's CPU, and there is no trip to draw. The builder is handed none.
 */
import type { JourneyAt } from './journey';
import { NEBULA } from './nebulaWay';
import { smoothstep, type Span, through } from './scrollPose';

/** One ring of the shaft: its height, radius and band width (m), its tilt about x and z, and the part it belongs to. */
export interface RingSpec {
  y: number;
  radius: number;
  width: number;
  tilt: [number, number];
  zone: 'throat' | 'hall';
}

/** How much of each part shows, 0..1: the throat and the hall; `trips` is the builder's, and always empty now. */
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
  HALL_IN: [52, 72]
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

/** Each part's level at a pose: in the light dive by its way frame (`at.frame`); nothing past it, on the world. */
export function engravedLevels(at: Pick<JourneyAt, 'stretch' | 'frame'>): EngravedLevels {
  if (at.stretch === 'light' && at.frame !== null) {
    const f = at.frame;
    return { throat: over(ENGRAVED.THROAT_IN, f) * (1 - over(ENGRAVED.THROAT_OUT, f)), hall: over(ENGRAVED.HALL_IN, f) * (1 - over(NEBULA.HALL_GIVES, f)), trips: [] };
  }
  return { throat: 0, hall: 0, trips: [] };
}
