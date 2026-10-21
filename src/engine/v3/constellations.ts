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
import { bearingOf, onDial } from '~/engine/instrument/dialSpec';

/**
 * One constellation's drawing before it is placed: each star is
 * `[u, v, mag]`, with u and v in 0..1 (u left to right as the camera sees the
 * figure, v up) and mag in 0.4..1 its size against the brightest, and each
 * line joins two stars by index. A Placement stands this square up round the
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
 * Each stands on a plane facing the camera, so it is seen as drawn, except
 * that its lower stars curve forward round the rim and in toward the compass
 * (see PLACEMENTS). That curve sweeps through the glass on the compass side of
 * China and Aruba, so their lower inner corner stays empty: China keeps its
 * low stars at u >= 0.2, Aruba at u <= 0.8.
 *
 * The tree's crown is swept hard to the left, west, away from the compass, as
 * Aruba's divi-divi trees lean west and south-west with the trade wind; the
 * inward curve of its foot turns the trunk the same way. The ship's bow points
 * east, to the right.
 */
export const FIGURES: Readonly<Record<CountryId, Figure>> = {
  china: {
    stars: [
      [0.26, 0.74, 0.65], // 0 the western peak
      [0.5, 1, 1], // 1 the main peak
      [0.76, 0.84, 0.85], // 2 the eastern peak
      [0.38, 0.48, 0.5], // 3 the saddle west of the main peak
      [0.63, 0.52, 0.5], // 4 the saddle east of it
      [0.2, 0.3, 0.45], // 5 the cloud band, from its west end
      [0.3, 0.38, 0.45], // 6
      [0.41, 0.3, 0.5], // 7
      [0.52, 0.39, 0.5], // 8
      [0.64, 0.3, 0.5], // 9
      [0.76, 0.38, 0.5], // 10
      [0.87, 0.3, 0.55], // 11 its east end, where the scroll begins
      [0.97, 0.2, 0.6], // 12 the scroll, curling down
      [0.92, 0.06, 0.55], // 13
      [0.8, 0.07, 0.5], // 14
      [0.76, 0.17, 0.45], // 15
      [0.83, 0.22, 0.45], // 16
      [0.88, 0.15, 0.4] // 17 its inner end
    ],
    lines: [
      // The ridge: up from the band's west end over the three peaks and down to its east end.
      [5, 0], [0, 3], [3, 1], [1, 4], [4, 2], [2, 11],
      // The cloud band, its crests and troughs under the peaks.
      [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11],
      // The scroll.
      [11, 12], [12, 13], [13, 14], [14, 15], [15, 16], [16, 17]
    ]
  },
  netherlands: {
    stars: [
      [0.02, 0.36, 0.6], // 0 the stern, raised
      [0.14, 0.04, 0.5], // 1 the keel, aft
      [0.82, 0.04, 0.5], // 2 the keel, forward
      [0.96, 0.28, 0.7], // 3 the bow
      [0.27, 0.2, 0.45], // 4 the mainmast's foot, on deck
      [0.69, 0.2, 0.45], // 5 the foremast's foot, on deck
      [0.27, 1, 1], // 6 the mainmast's top
      [0.69, 0.88, 0.85], // 7 the foremast's top
      [0.14, 0.84, 0.6], // 8 the mainsail: yard, aft end
      [0.4, 0.84, 0.6], // 9 yard, forward end
      [0.12, 0.44, 0.55], // 10 foot, aft corner
      [0.42, 0.44, 0.55], // 11 foot, forward corner
      [0.58, 0.74, 0.55], // 12 the foresail: yard, aft end
      [0.8, 0.74, 0.55], // 13 yard, forward end
      [0.56, 0.46, 0.5], // 14 foot, aft corner
      [0.82, 0.46, 0.5], // 15 foot, forward corner
      [0.4, 0.96, 0.45], // 16 the pennant's tail
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
      // The bowsprit and the pennant.
      [3, 17], [6, 16]
    ]
  },
  aruba: {
    stars: [
      [0.66, 0.06, 0.8], // 0 the trunk's foot
      [0.5, 0.02, 0.45], // 1 a root, west
      [0.8, 0.04, 0.45], // 2 a root, east
      [0.63, 0.26, 0.55], // 3 the trunk, leaning west
      [0.56, 0.44, 0.6], // 4
      [0.47, 0.56, 0.75], // 5 where the trunk bends into the crown
      [0.57, 0.66, 0.5], // 6 the crown's short windward end
      [0.48, 0.75, 0.7], // 7 its top
      [0.34, 0.79, 0.85], // 8
      [0.19, 0.77, 0.6], // 9
      [0.07, 0.71, 0.6], // 10
      [0, 0.6, 1], // 11 its tip, streaming downwind
      [0.12, 0.56, 0.5], // 12 its underside
      [0.27, 0.55, 0.5], // 13
      [0.27, 0.67, 0.45] // 14 the main limb through the crown
    ],
    lines: [
      // The roots and the trunk.
      [1, 0], [0, 2], [0, 3], [3, 4], [4, 5],
      // The crown, round from the bend.
      [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 13], [13, 5],
      // The limb from the bend to the tip.
      [5, 14], [14, 11]
    ]
  }
};

/**
 * Where a figure stands, in degrees and world units (Ruling 5). It stands on a
 * vertical plane facing the camera (normal +Z, south), centred on the point
 * `onDial(bearing, distance)`, `width` wide and `height` tall from `base` up.
 * Its lower stars curve toward the camera by up to `bend` and in toward the
 * compass by up to `inward`, which wraps China and Aruba round the rim. A
 * plane along the bearing's circle would turn the side figures nearly edge on
 * to a camera in the south; facing the camera, each is seen as drawn.
 */
export interface Placement {
  bearing: number;
  distance: number;
  width: number;
  height: number;
  base: number;
  bend: number;
  inward: number;
}

/**
 * The three placements. China and Aruba stand 1.65 out in the east and the
 * west, their feet curving round the front of the rim; the ship stands farther
 * off (2.7) and higher, beyond the far edge, straight ahead in the north, flat.
 */
export const PLACEMENTS: Readonly<Record<CountryId, Placement>> = {
  china: { bearing: 90, distance: 1.65, width: 0.85, height: 0.95, base: 0.04, bend: 0.95, inward: 0.5 },
  netherlands: { bearing: 0, distance: 2.7, width: 0.75, height: 0.9, base: 0.55, bend: 0, inward: 0 },
  aruba: { bearing: 270, distance: 1.65, width: 0.85, height: 0.95, base: 0.04, bend: 0.95, inward: 0.5 }
};

/** How far a range reaches past its outermost stars, in degrees, so a needle that lands just off the figure still points into it. */
const MARGIN_DEG = 10;

const TAU = Math.PI * 2;
const RAD = Math.PI / 180;

/** An angle in radians wrapped into (-PI, PI], the interval bearingOf answers in. */
function wrapPi(a: number): number {
  return a - TAU * Math.ceil((a - Math.PI) / TAU);
}

/** Each star's x, y, z in double precision, as the placement puts it: the one place the formula lives. */
function placeStars(id: CountryId): [x: number, y: number, z: number][] {
  const p = PLACEMENTS[id];
  const [cx, cz] = onDial(p.bearing, p.distance);
  const inward = Math.sign(cx) * p.inward;
  return FIGURES[id].stars.map(([u, v]) => {
    const w = (1 - v) ** 2;
    return [cx + (u - 0.5) * p.width - inward * w, p.base + v * p.height, cz + p.bend * w];
  });
}

/** The positions and ranges are built once, on first use: the aim reads them on every pointer move. */
const positions = new Map<CountryId, Float32Array>();
const ranges = new Map<CountryId, readonly [from: number, to: number]>();

/**
 * Where each star of a constellation stands, as x, y, z triples in the
 * figure's order. With `[cx, cz] = onDial(P.bearing, P.distance)` and
 * `w = (1 - v)^2`, a star at `[u, v]` stands at
 * `x = cx + (u - 0.5) * P.width - sign(cx) * P.inward * w`,
 * `y = P.base + v * P.height` and `z = cz + P.bend * w`. The square keeps a
 * figure's top flat on its plane and curves its foot forward and inward round
 * the rim; the ship, centred due north (cx = 0, bend 0), stays flat.
 *
 * Returns a copy, so a caller may write to it.
 */
export function starPositions(id: CountryId): Float32Array {
  let out = positions.get(id);
  if (!out) {
    out = new Float32Array(placeStars(id).flat());
    positions.set(id, out);
  }
  return out.slice();
}

/**
 * The bearings the needle counts as pointing into a constellation, in
 * radians: the span of its stars' bearings, widened by 10 degrees each side.
 * Task 7's aim snaps the needle to a star's own bearing, which is always
 * inside; the margin covers its ground and sky rules between the stars.
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
    // Each star's bearing as a turn off the placement's own, so a figure across the seam still has one span.
    const centre = PLACEMENTS[id].bearing * RAD;
    const offsets = placeStars(id).map(([x, , z]) => wrapPi(bearingOf(x, z) - centre));
    const lo = Math.min(...offsets) - MARGIN_DEG * RAD;
    const hi = Math.max(...offsets) + MARGIN_DEG * RAD;
    const from = wrapPi(centre + lo);
    range = [from, from + (hi - lo)] as const;
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
