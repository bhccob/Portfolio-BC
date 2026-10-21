/**
 * The three constellations of the v3 home (spec §2.2, frame 04): China's
 * cloud-wrapped mountains in the east, the Netherlands' sailing ship in the
 * north and Aruba's wind-bent divi-divi tree in the west. Each is a figure of
 * stars joined by lines, like an old star atlas, standing round the compass in
 * 3D, and the needle points into one of them or into the dark between. Pure,
 * and it imports nothing from three, so the tests read exactly the numbers the
 * scene draws and the needle aims at.
 *
 * The frame is the dial's (src/engine/instrument/dialSpec.ts): north -Z,
 * east +X, y up from the compass's plane, a bearing in degrees clockwise from
 * north in the tables and in radians in (-PI, PI] at runtime.
 */
import { COUNTRY_IDS, type CountryId } from '~/data/directions';
import { onDial } from '~/engine/instrument/dialSpec';

/**
 * One constellation's drawing before it is placed: each star is
 * `[u, v, mag]`, with u and v in 0..1 (u to the right as the camera sees the
 * figure, v up) and mag in 0.4..1 its size against the brightest, and each
 * line joins two stars by index. A Placement bends this square round the
 * compass, so the drawing stays a plain table of numbers.
 */
export interface Figure {
  stars: readonly (readonly [u: number, v: number, mag: number])[];
  lines: readonly (readonly [number, number])[];
}

/**
 * The three figures, each to read at a glance from the home camera (Bob judges
 * them in the Task 14 stills), with 10 to 24 stars and every star on a line.
 *
 * China and Aruba are drawn for how the camera, low in the south, sees their
 * shells: almost edge on. Their wide tops stay wide on screen, but lower down
 * the swing (see PLACEMENTS) turns the stars toward the camera and against the
 * shell's outline, so the space a figure can use narrows into a neck and then
 * curls round the front of the rim. So the mountains stand at the top on a
 * band of cloud whose end pours down that neck and curls back on itself, a
 * Chinese cloud scroll; and the tree spreads its crown at the top, its trunk
 * runs down the neck and its roots reach round the front. Their low stars are
 * placed knowing the swing will move them, so the (u, v) square shows them
 * leaning where the screen shows them upright.
 *
 * The tree's crown streams to the right, toward the compass. Aruba's real
 * divi-divi trees lean south-west with the trade wind, which on this shell
 * is to the left, but there the shell's outline folds a crown into a line.
 * The ship's bow points east, to the right.
 */
export const FIGURES: Readonly<Record<CountryId, Figure>> = {
  china: {
    stars: [
      [0.19, 0.82, 0.65], // 0 the western peak, the farthest and smallest
      [0.41, 1, 1], // 1 the main peak
      [0.66, 0.87, 0.85], // 2 the eastern peak
      [0, 0.58, 0.45], // 3 the cloud band, from its west end
      [0.12, 0.64, 0.4], // 4
      [0.2, 0.59, 0.5], // 5
      [0.34, 0.66, 0.45], // 6
      [0.46, 0.63, 0.5], // 7
      [0.63, 0.69, 0.45], // 8
      [0.77, 0.64, 0.55], // 9 its east end, where the scroll begins
      [0.98, 0.56, 0.5], // 10 the scroll pouring down the near side
      [0.87, 0.42, 0.6], // 11
      [0.63, 0.27, 0.5], // 12 round the front of the rim
      [0.19, 0.17, 0.55], // 13
      [0.18, 0.25, 0.45], // 14 curling back up
      [0.38, 0.35, 0.4] // 15 the scroll's inner end
    ],
    lines: [
      // The three peaks, each standing on the band.
      [3, 0], [0, 5], [5, 1], [1, 7], [7, 2], [2, 9],
      // The cloud band, its crests between the peaks' feet.
      [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9],
      // The scroll.
      [9, 10], [10, 11], [11, 12], [12, 13], [13, 14], [14, 15]
    ]
  },
  netherlands: {
    stars: [
      [0.03, 0.42, 0.6], // 0 the stern, raised
      [0.17, 0.06, 0.5], // 1 the keel, aft
      [0.76, 0.06, 0.5], // 2 the keel, forward
      [0.93, 0.3, 0.7], // 3 the bow
      [0.32, 0.22, 0.45], // 4 the mainmast's foot, on deck
      [0.68, 0.22, 0.45], // 5 the foremast's foot, on deck
      [0.32, 1, 1], // 6 the mainmast's top
      [0.68, 0.86, 0.85], // 7 the foremast's top
      [0.18, 0.86, 0.6], // 8 the mainsail: yard, aft end
      [0.46, 0.86, 0.6], // 9 yard, forward end
      [0.16, 0.44, 0.55], // 10 foot, aft corner
      [0.48, 0.44, 0.55], // 11 foot, forward corner
      [0.58, 0.72, 0.55], // 12 the foresail: yard, aft end
      [0.78, 0.72, 0.55], // 13 yard, forward end
      [0.56, 0.44, 0.5], // 14 foot, aft corner
      [0.8, 0.44, 0.5], // 15 foot, forward corner
      [0.44, 0.97, 0.45], // 16 the pennant's tail
      [1, 0.4, 0.5] // 17 the bowsprit's tip
    ],
    lines: [
      // The hull: stern, keel, bow, and the deck back past both masts.
      [0, 1], [1, 2], [2, 3], [3, 5], [5, 4], [4, 0],
      // The masts.
      [4, 6], [5, 7],
      // The mainsail and the foresail.
      [8, 9], [9, 11], [11, 10], [10, 8],
      [12, 13], [13, 15], [15, 14], [14, 12],
      // The bowsprit and the stay up to the foremast, and the pennant.
      [3, 17], [17, 7], [6, 16]
    ]
  },
  aruba: {
    stars: [
      [0.33, 0.24, 0.8], // 0 the trunk's foot
      [0.37, 0.11, 0.45], // 1 a root reaching round the front of the rim
      [0.9, 0.08, 0.45], // 2 a root reaching back
      [0.31, 0.38, 0.55], // 3 the trunk
      [0.36, 0.51, 0.6], // 4
      [0.5, 0.63, 0.75], // 5 where the trunk bends into the crown
      [0.27, 0.74, 0.5], // 6 the crown's short windward end
      [0.38, 0.82, 0.7], // 7 its flat top
      [0.62, 0.83, 0.85], // 8
      [0.83, 0.81, 0.6], // 9
      [1, 0.73, 1], // 10 its tip, streaming downwind
      [0.86, 0.69, 0.5], // 11 its underside
      [0.67, 0.67, 0.5], // 12
      [0.71, 0.75, 0.45] // 13 the main limb through the crown
    ],
    lines: [
      // The roots and the trunk.
      [1, 0], [0, 2], [0, 3], [3, 4], [4, 5],
      // The crown, round from the bend.
      [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 5],
      // The limb from the bend to the tip.
      [5, 13], [13, 10]
    ]
  }
};

/**
 * Where a figure stands round the compass, in degrees and world units: its
 * centre `bearing`, the `span` of bearings its width covers, the `radius` of
 * the upright cylinder it is drawn on, the height of its foot (`base`), how
 * tall it stands (`height`), and `swing`, how far its lowest stars turn round
 * toward the camera's side (south). The swing is what wraps China and Aruba
 * round the rim instead of hanging them flat beside it.
 */
export interface Placement {
  bearing: number;
  span: number;
  radius: number;
  base: number;
  height: number;
  swing: number;
}

/**
 * The three placements. China and Aruba stand close (1.42, just outside the
 * glass) in the east and the west and swing their low stars round the front
 * of the rim; the ship stands farther off (2.7) and higher, beyond the far
 * edge, straight ahead in the north, and does not swing.
 */
export const PLACEMENTS: Readonly<Record<CountryId, Placement>> = {
  china: { bearing: 90, span: 46, radius: 1.42, base: 0.04, height: 0.95, swing: 38 },
  netherlands: { bearing: 0, span: 30, radius: 2.7, base: 0.55, height: 0.9, swing: 0 },
  aruba: { bearing: 270, span: 46, radius: 1.42, base: 0.04, height: 0.95, swing: 38 }
};

/** How far a range reaches past its outermost stars, in degrees, so a needle that lands just off the figure still points into it. */
const MARGIN_DEG = 10;

const TAU = Math.PI * 2;
const RAD = Math.PI / 180;

/** An angle in radians wrapped into (-PI, PI], the interval bearingOf answers in. */
function wrapPi(a: number): number {
  return a - TAU * Math.ceil((a - Math.PI) / TAU);
}

/**
 * Which way a figure's low stars turn to reach south: clockwise (+1) from the
 * east half, counter-clockwise (-1) from the west half, and not at all from
 * due north or due south, where neither way is the nearer.
 */
function towardSouth(bearingDeg: number): -1 | 0 | 1 {
  const b = ((bearingDeg % 360) + 360) % 360;
  if (b === 0 || b === 180) return 0;
  return b < 180 ? 1 : -1;
}

/** Each star's bearing as degrees off its placement's own, swing included. Not wrapped: a figure stays well within a half turn of its centre. */
function offsetsOf(id: CountryId): number[] {
  const p = PLACEMENTS[id];
  const turn = towardSouth(p.bearing) * p.swing;
  return FIGURES[id].stars.map(([u, v]) => (u - 0.5) * p.span + turn * (1 - v) ** 2);
}

/** The positions and ranges are built once, on first use: the aim reads them on every pointer move. */
const positions = new Map<CountryId, Float32Array>();
const ranges = new Map<CountryId, readonly [from: number, to: number]>();

/**
 * Where each star of a constellation stands, as x, y, z triples in the
 * figure's order. A star at `[u, v]` stands at the bearing
 * `P.bearing + (u - 0.5) * P.span`, turned a further `P.swing * (1 - v)^2`
 * toward south (clockwise for China, counter-clockwise for Aruba, not at all
 * for the ship), on the cylinder of radius `P.radius` (`onDial`), at the
 * height `P.base + v * P.height`. The square keeps a figure's top where it was
 * drawn and swings its foot round in front of the rim.
 *
 * Returns a copy, so a caller may write to it.
 */
export function starPositions(id: CountryId): Float32Array {
  let out = positions.get(id);
  if (!out) {
    const p = PLACEMENTS[id];
    const offsets = offsetsOf(id);
    const stars = FIGURES[id].stars;
    out = new Float32Array(stars.length * 3);
    for (let k = 0; k < stars.length; k++) {
      const [x, z] = onDial(p.bearing + offsets[k], p.radius);
      out[k * 3] = x;
      out[k * 3 + 1] = p.base + stars[k][1] * p.height;
      out[k * 3 + 2] = z;
    }
    positions.set(id, out);
  }
  return out.slice();
}

/**
 * The bearings the needle counts as pointing into a constellation, in
 * radians: the span of its stars' bearings, widened by 10 degrees each side.
 * The aim snaps the needle to a star's own bearing, which is always inside;
 * the margin catches a needle still settling just off the figure, and a ship
 * star read on the nearer 1.42 shell (a star at 15 degrees aims at about 22).
 *
 * The convention is a start and a width. `from` is the range's
 * counter-clockwise end, wrapped into (-PI, PI] as bearingOf answers, and
 * `to` is `from` plus the width, not wrapped, so `to` passes PI when a range
 * crosses due south. A bearing is in the range when its clockwise turn from
 * `from`, wrapped into [0, 2 PI), is no more than `to - from`; compare that
 * way, as pointedAt does, not with a plain `from <= b <= to`, which misses a
 * bearing given on another turn (359 degrees for -1) or past the seam. The
 * Netherlands' range crosses north, which is 0 and inside (-PI, PI]; none of
 * the three crosses south, so here `to` stays within PI and two ranges can be
 * compared end to end.
 */
export function bearingRange(id: CountryId): readonly [from: number, to: number] {
  let range = ranges.get(id);
  if (!range) {
    const offsets = offsetsOf(id);
    const lo = Math.min(...offsets) - MARGIN_DEG;
    const hi = Math.max(...offsets) + MARGIN_DEG;
    const from = wrapPi((PLACEMENTS[id].bearing + lo) * RAD);
    range = [from, from + (hi - lo) * RAD] as const;
    ranges.set(id, range);
  }
  return range;
}

/**
 * The constellation the needle points into, or null when it points into the
 * dark between them. `needle` is a bearing in radians on any turn (270
 * degrees and -90 are both west), compared with each range after wrapping as
 * bearingRange describes, so the Netherlands' range holds the needle on both
 * sides of north. The ranges never overlap, so at most one holds it. NaN
 * points at nothing.
 */
export function pointedAt(needle: number): CountryId | null {
  for (const id of COUNTRY_IDS) {
    const [from, to] = bearingRange(id);
    const turn = needle - from;
    if (turn - TAU * Math.floor(turn / TAU) <= to - from) return id;
  }
  return null;
}
