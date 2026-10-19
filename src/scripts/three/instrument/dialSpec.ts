/**
 * The compass dial's measurements: one table that the loader's flat drawing
 * (dialSvg), the painted face and the 3D parts all read, so the three always
 * agree. It imports nothing from three, gsap or lenis.
 *
 * The dial lies in its local XZ plane with its face normal +Y and the face at
 * y = 0. North is -Z and east is +X, so a bearing b (degrees clockwise from
 * north) at radius r sits at (x, z) = (r sin b, -r cos b). The mount group
 * turns the dial to face the camera (rotation.x = +PI/2), which puts north at
 * the top of the screen and east at the right. Tables here hold bearings in
 * degrees; the runtime works in radians.
 */

/** Degrees clockwise from north. */
export type Bearing = number;

/** All lengths are world units, dial-local. */
export const DIAL = {
  /** The dial disc's radius; the brass rim runs from 1.0 out to here. */
  rim: 1.04,
  /** The planar face texture covers r up to here. */
  face: 0.72,
  /** The heaven pool's radius, and how far its floor sits below the face. */
  pool: 0.22,
  poolDepth: 0.025,
  /** Inner and outer radius of each ring, between the raised gilt rules. */
  rings: {
    trigram: [0.24, 0.4],
    direction: [0.42, 0.56],
    degree: [0.58, 0.7],
    pattern: [0.72, 1.0]
  },
  /** The raised gilt rules that divide the rings, and their width. */
  rules: [0.23, 0.41, 0.57, 0.71],
  ruleWidth: 0.016,
  /** The square base plate, its top flush with the face. */
  plate: 2.4,
  plateCorner: 0.08,
  plateDepth: 0.14,
  /** Degree ticks: every 1 degree, longer every 5, longest every 15. */
  ticks: 360,
  /** The needle, from its pin: the tip reaches north, the tail south. */
  needle: { tip: 0.82, tail: 0.6, width: 0.05, height: 0.05, pin: 0.018 },
  /** The red threads, north-south and east-west, plate edge to plate edge. */
  threads: { height: 0.08, radius: 0.004 }
} as const;

/** One trigram of the Later Heaven arrangement. */
export interface Trigram {
  bearing: Bearing;
  name: string;
  /** The three lines from the bottom (innermost) to the top: 1 is whole, 0 is broken. */
  lines: readonly [0 | 1, 0 | 1, 0 | 1];
}

/** The eight trigrams in the Later Heaven arrangement, by bearing. */
export const TRIGRAMS: readonly Trigram[] = [
  { bearing: 0, name: 'Kan', lines: [0, 1, 0] },
  { bearing: 45, name: 'Gen', lines: [0, 0, 1] },
  { bearing: 90, name: 'Zhen', lines: [1, 0, 0] },
  { bearing: 135, name: 'Xun', lines: [0, 1, 1] },
  { bearing: 180, name: 'Li', lines: [1, 0, 1] },
  { bearing: 225, name: 'Kun', lines: [0, 0, 0] },
  { bearing: 270, name: 'Dui', lines: [1, 1, 0] },
  { bearing: 315, name: 'Qian', lines: [1, 1, 1] }
];

/** The four direction characters, north, east, south, west. */
export const DIRECTIONS: readonly { bearing: Bearing; char: '北' | '東' | '南' | '西' }[] = [
  { bearing: 0, char: '北' },
  { bearing: 90, char: '東' },
  { bearing: 180, char: '南' },
  { bearing: 270, char: '西' }
];

/** What the outer ring shows: nothing yet (plain), or one of Bob's three homes. */
export type HomeId = 'plain' | 'china' | 'aruba' | 'rotterdam';

/**
 * Where the needle points at each home, and where its pattern starts to paint
 * round the ring. Rotterdam has no needle bearing (null): the needle is back
 * on the visitor's pearl, and the pattern spreads from the visitor's side, south.
 */
export const HOMES: Readonly<Record<Exclude<HomeId, 'plain'>, { needle: Bearing | null; sweepFrom: Bearing }>> = {
  china: { needle: 90, sweepFrom: 90 },
  aruba: { needle: 270, sweepFrom: 270 },
  rotterdam: { needle: null, sweepFrom: 180 }
};

/** The dial-local point `[x, z]` at a bearing (degrees) and radius. */
export function onDial(bearingDeg: Bearing, r: number): [x: number, z: number] {
  const b = (bearingDeg * Math.PI) / 180;
  return [r * Math.sin(b), -r * Math.cos(b)];
}

/** The bearing of a dial-local point, in radians in (-PI, PI]; the inverse of onDial. */
export function bearingOf(x: number, z: number): number {
  const b = Math.atan2(x, -z);
  // atan2 answers -PI for a point due south on the negative side of zero; the range is (-PI, PI].
  return b === -Math.PI ? Math.PI : b;
}
