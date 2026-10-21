/**
 * The chip city of the v3 home: the glowing blocks on the board under the glass
 * compass, round the chip at the centre. It is only a hint of light below the
 * rings, so it is dim, low and sparse, and it is circuitry before it is a city:
 * its blocks stand in the cells of a polar grid (rings of sectors) with a lane
 * left between every two, and a few main streets, ring roads and avenues, cut
 * through it. One table of numbers that the 3D builder and the tests read, so
 * what the scene draws is exactly what the tests check. It imports nothing from
 * three.
 *
 * The frame is the compass's (src/engine/instrument/dialSpec.ts): north is -Z,
 * east is +X, and a block's x and z are dial-local world units from the
 * compass's centre. The board lies at y = CHIP.board and a block stands on it,
 * so its top is CHIP.board + h.
 */
import { bearingOf } from '~/engine/instrument/dialSpec';
import { CHIP } from '~/engine/v3/chipSpec';

/**
 * One block of the city: a box on the board. `x` and `z` are the centre of its
 * footprint, `w` its width along x, `d` its depth along z (so the footprint is
 * always an axis-aligned rectangle, which an instanced box can draw with a
 * scale and no rotation), `h` its height above the board. `glow` is how
 * brightly it shines, 0..1, and `hue` the colour of the light: amber is the
 * chip's gold, violet is the nebula's.
 */
export interface Block {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  glow: number;
  hue: 'amber' | 'violet';
}

/**
 * The ground the city may cover and how tall it may stand, in world units.
 * `inner` is where the chip's neighbourhood ends (the hub's radius, just past
 * the chip's corners); `outer` is the hexagram ring's outer edge, so the glass
 * has light under all of it. `maxHeight` keeps the tallest block's top
 * (CHIP.board + 0.11 = -0.04) well below the glass. `brightShare` is the most
 * blocks that may glow brighter than 0.6: restraint, a hint of light below and
 * not a lit-up town.
 */
export const CITY = { inner: 0.2, outer: 1.0, maxHeight: 0.11, brightShare: 0.12 } as const;

/**
 * How many blocks to build, by pointer. The count is chosen once, at build,
 * as the ring strips' sizes are; the quality ladder's later rungs dim the city
 * instead of building it again.
 */
export const CITY_BLOCKS: Readonly<Record<'fine' | 'coarse', number>> = { fine: 900, coarse: 600 };

/**
 * The city's main streets, which no block stands on, so the grid of cells reads
 * as circuitry under the glass. The ring roads are circles round the chip at
 * these radii, `ringWidth` wide. The avenues run out from the chip along
 * `avenues` evenly spaced bearings, the first due north, so with eight they are
 * the bearings of the trigram ring (every 45 degrees); each is `avenueWidth`
 * wide, and an avenue and the one opposite it make one street across the city.
 */
export const CITY_STREETS = { rings: [0.4, 0.6, 0.8], ringWidth: 0.025, avenues: 8, avenueWidth: 0.03 } as const;

/** The city a build gets unless it asks for another: the year Bob was born. */
const DEFAULT_SEED = 2006;

const TAU = 2 * Math.PI;

/** The gap kept between a block and the edge of its cell, so two neighbours stand a lane apart. */
const LANE = 0.008;

/** The grid has this many times more usable cells than blocks asked, so the rest stay empty and leave plazas. */
const SPARE = 1.25;

/** A first guess at how much bigger than that the grid must be, as cells are lost to the main streets, the chip and the minimum size, so the first grid tried is usually enough. */
const WASTE = 1.5;

/** A cell holds a block whose sides are at least this share of the cell's pitch, or none at all. */
const MIN_FILL = 0.3;

/** A block starts at this share of the pitch, at least and at most, then shrinks until it fits its cell. */
const FILL = [0.55, 1] as const;

/** Each shrink step of a block that does not fit yet. */
const SHRINK = 0.92;

/** A ring never has fewer sectors than this, so a sector is never wider than 60 degrees and stays convex. */
const MIN_SECTORS = 6;

/** Cells near the chip are likelier to be built on: the weight of a cell falls from this at the inner edge to this less one at the outer. */
const INNER_BIAS = 1.6;

/** The outermost blocks stand this much lower than the innermost, as a share of their height. */
const HEIGHT_FALLOFF = 0.35;

/** The share of the blocks that shine brightly: well under CITY.brightShare, so the cap is a bound and not a target. */
const BRIGHT_TARGET = 0.08;

/** A dim block's glow is at most this; a bright block's is at least 0.65. */
const DIM_MAX = 0.5;

/** The share of the blocks lit violet instead of amber. */
const VIOLET_SHARE = 0.3;

/**
 * The half-side of the square that holds the chip and its pins, with half a
 * lane of room: no block comes into it, so none touches a pin. The circle of
 * CITY.inner alone would let a block's corner into the gap beside a corner
 * pin, whose outer corner is 0.213 from the centre.
 */
const CHIP_CLEAR = CHIP.size / 2 + CHIP.pinLength + LANE / 2;

/**
 * The unit normals of the avenues' lines: one line for each pair of opposite
 * avenues, the first running north to south. A point's distance from the
 * line is its dot product with the normal.
 */
const AVENUE_NORMALS: readonly (readonly [number, number])[] = Array.from({ length: CITY_STREETS.avenues / 2 }, (_, i) => {
  const bearing = (i * TAU) / CITY_STREETS.avenues;
  return [Math.cos(bearing), Math.sin(bearing)] as const;
});

/**
 * A seeded random number generator (mulberry32): the same seed gives the same
 * numbers on every machine, in 0..1 and never 1. Math.random would build a
 * different city on every load and make the tests unrepeatable.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An angle in radians wrapped into (-PI, PI]. */
function turn(angle: number): number {
  return angle - TAU * Math.round(angle / TAU);
}

/** The cell of the polar grid that a block stands in: an annular sector, `half` being half its angle. */
interface Sector {
  /** Inner and outer radius. */
  r0: number;
  r1: number;
  /** The bearing of its middle, in radians clockwise from north. */
  bearing: number;
  half: number;
}

/**
 * Whether the rectangle `[x0, x1] x [z0, z1]` may stand: wholly inside the
 * sector, a lane's half width short of its edges, clear of the chip and its
 * pins, and off every main street. A rectangle is inside the sector when its
 * nearest point to the centre is far enough out, its corners (the farthest
 * points) are not too far out, and its corners lie within the sector's two
 * sides; the sector is convex (its angle is at most 60 degrees), so the
 * corners alone keep the sides. Every test is one that a smaller rectangle with
 * the same centre also passes, which is what lets a block shrink until it fits.
 */
function fits(sector: Sector, x0: number, x1: number, z0: number, z1: number): boolean {
  if (x1 > -CHIP_CLEAR && x0 < CHIP_CLEAR && z1 > -CHIP_CLEAR && z0 < CHIP_CLEAR) return false;

  const nearest = Math.hypot(x0 > 0 ? x0 : x1 < 0 ? -x1 : 0, z0 > 0 ? z0 : z1 < 0 ? -z1 : 0);
  const farthest = Math.hypot(Math.max(-x0, x1), Math.max(-z0, z1));
  if (nearest < sector.r0 + LANE / 2 || farthest > sector.r1 - LANE / 2) return false;
  // The rectangle's span of radii must not touch a ring road.
  for (const road of CITY_STREETS.rings) {
    if (farthest > road - CITY_STREETS.ringWidth / 2 && nearest < road + CITY_STREETS.ringWidth / 2) return false;
  }
  // Nor may its span across an avenue's line reach into the avenue.
  const [mx, mz, hx, hz] = [(x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) / 2, (z1 - z0) / 2];
  for (const [nx, nz] of AVENUE_NORMALS) {
    if (Math.abs(mx * nx + mz * nz) - (hx * Math.abs(nx) + hz * Math.abs(nz)) < CITY_STREETS.avenueWidth / 2) return false;
  }

  for (const x of [x0, x1]) {
    for (const z of [z0, z1]) {
      // The lane between two sectors is a lane wide at every radius, so the margin in angle shrinks with the radius.
      const margin = LANE / (2 * Math.hypot(x, z));
      if (Math.abs(turn(bearingOf(x, z) - sector.bearing)) > sector.half - margin) return false;
    }
  }
  return true;
}

/** One cell that can hold a block, with the numbers its block is made from. */
interface Cell {
  x: number;
  z: number;
  w: number;
  d: number;
  /** How far out the cell lies, 0 at CITY.inner and 1 at CITY.outer. */
  out: number;
  /** The random numbers that decide the block: whether it is built, how tall, how bright, which colour, and whether it is one of the bright few. */
  draw: { pick: number; tall: number; glow: number; hue: number; spark: number };
}

/**
 * The cells of a polar grid of `rings` rings between CITY.inner and
 * CITY.outer that can hold a block of at least MIN_FILL of their pitch. Every
 * ring has as many sectors as make its cells about as long as they are deep,
 * and is turned by a random part of a sector so the lanes between sectors do
 * not run straight from ring to ring in one line. A cell makes its random
 * numbers in a fixed order whether or not it can hold a block, so the grid and
 * the city are fixed by the seed alone.
 */
function usableCells(rings: number, seed: number): Cell[] {
  const rand = mulberry32(seed);
  const pitch = (CITY.outer - CITY.inner) / rings;
  const smallest = MIN_FILL * pitch;
  const cells: Cell[] = [];
  for (let k = 0; k < rings; k++) {
    const r0 = CITY.inner + k * pitch;
    const mid = r0 + pitch / 2;
    const sectors = Math.max(MIN_SECTORS, Math.round((TAU * mid) / pitch));
    const step = TAU / sectors;
    const turned = rand() * step;
    for (let j = 0; j < sectors; j++) {
      const wide = rand();
      const deep = rand();
      const draw = { pick: rand(), tall: rand(), glow: rand(), hue: rand(), spark: rand() };
      const sector: Sector = { r0, r1: r0 + pitch, bearing: turned + (j + 0.5) * step, half: step / 2 };
      const x = mid * Math.sin(sector.bearing);
      const z = -mid * Math.cos(sector.bearing);
      // Start from a random block of the cell's size and shrink it, about its centre, until it fits.
      let w = pitch * (FILL[0] + (FILL[1] - FILL[0]) * wide);
      let d = pitch * (FILL[0] + (FILL[1] - FILL[0]) * deep);
      while (Math.min(w, d) >= smallest && !fits(sector, x - w / 2, x + w / 2, z - d / 2, z + d / 2)) {
        w *= SHRINK;
        d *= SHRINK;
      }
      if (Math.min(w, d) >= smallest) cells.push({ x, z, w, d, out: (mid - CITY.inner) / (CITY.outer - CITY.inner), draw });
    }
  }
  return cells;
}

/**
 * The city, `count` blocks of it, the same for a seed every time. A polar
 * grid is laid out, fine enough to hold a quarter more blocks than asked, and
 * the blocks are the cells it keeps: a random choice that favours the inner
 * rings, so the city is closest-packed round the chip and thins out to the rim,
 * leaving empty cells as plazas. Each block stands in its cell, an
 * axis-aligned rectangle a lane away from the cell's edges, so no two blocks
 * touch and all of a block, not only its corners, stands on the annulus between
 * CITY.inner and CITY.outer, clear of the chip and its pins and off the main
 * streets (CITY_STREETS). The tall ones stand toward the chip, none above
 * CITY.maxHeight.
 *
 * Most blocks glow dimly (at most 0.5); a few (8%, and never more than
 * CITY.brightShare of them) glow brightly (0.65 to 1), so the city is a hint of
 * light below the glass and not a lit-up town. A block is amber or violet.
 *
 * Blocks come in the grid's order, ring by ring from the chip outwards.
 *
 * @param count how many blocks, a whole number of 0 or more.
 * @param seed any integer; the default builds the site's own city.
 * @throws RangeError when count is not a whole number of 0 or more.
 */
export function cityLayout(count: number, seed: number = DEFAULT_SEED): Block[] {
  if (!Number.isInteger(count) || count < 0) throw new RangeError(`A city needs a whole number of blocks, not ${count}`);
  if (count === 0) return [];

  // Finer grids until there are cells enough: a quarter more than the blocks asked.
  const wanted = Math.ceil(count * SPARE);
  const area = Math.PI * (CITY.outer ** 2 - CITY.inner ** 2);
  let rings = Math.max(1, Math.round((CITY.outer - CITY.inner) / Math.sqrt(area / Math.ceil(wanted * WASTE))));
  let cells = usableCells(rings, seed);
  while (cells.length < wanted) cells = usableCells(++rings, seed);

  // Choose the cells to build on: sorted by a random number divided by the cell's weight, so heavier (inner) cells tend to come first.
  const order = cells
    .map((cell, index) => ({ index, rank: -Math.log(1 - cell.draw.pick) / (INNER_BIAS - cell.out) }))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, count);
  const chosen = order.map(({ index }) => index).sort((a, b) => a - b);

  // The few that shine brightly are those with the highest spark numbers among the chosen.
  const brightCount = Math.min(Math.floor(count * CITY.brightShare), Math.round(count * BRIGHT_TARGET));
  const bright = new Set(
    chosen
      .slice()
      .sort((a, b) => cells[b].draw.spark - cells[a].draw.spark)
      .slice(0, brightCount)
  );

  return chosen.map((index) => {
    const { x, z, w, d, out, draw } = cells[index];
    return {
      x,
      z,
      w,
      d,
      h: CITY.maxHeight * (1 - HEIGHT_FALLOFF * out) * (0.12 + 0.88 * draw.tall ** 2),
      glow: bright.has(index) ? 0.65 + 0.35 * draw.glow : 0.04 + (DIM_MAX - 0.04) * draw.glow ** 2,
      hue: draw.hue < VIOLET_SHARE ? 'violet' : 'amber'
    };
  });
}
