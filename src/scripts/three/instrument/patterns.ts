import { DIAL, DIAL_ART, type HomeId } from './dialSpec';

/**
 * The pattern ring's four faces, painted as polar strips. A strip's x runs
 * round the ring, u = bearing / 360 from north clockwise; its y runs across
 * the ring with y = 0 at the OUTER edge, because three.js flips a
 * CanvasTexture and the canvas top lands at v = 1, which the ring's polar UVs
 * put outermost. So "up" in a strip is outward. Every motif repeats a whole
 * number of times round the ring, so a strip tiles at u = 0/1 and the seam
 * never shows.
 *
 * Wrapped round the ring, a strip pixel is wider than it is tall (about 1.1
 * times at the inner edge, 1.4 at the outer), so the figures that must keep
 * their shape (the key-fret's squares, the stars, the bridges) are drawn
 * narrower by that factor at their height.
 *
 * The painters take a 2D context and its size only: they never read
 * `ctx.canvas` or a global, so they run in node (the tests) as in a browser.
 */

/** The strip sizes, for a fine and a coarse pointer. */
export const STRIP = { fine: { width: 4096, height: 256 }, coarse: { width: 2048, height: 128 } } as const;

/** How many times each motif repeats round the ring, and the bearings of Aruba's four stars. */
export const REPEATS = { china: 64, arubaWaves: 48, arubaStars: [45, 135, 225, 315], rotterdam: 6 } as const;

const GILT = '#d9a520';
const CREAM = '#f1e8d3';

interface Strip {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
}

/** How much wider than tall one strip pixel is once the strip is wrapped round the ring, at strip height `y`. */
function stretchAt({ w, h }: Strip, y: number): number {
  const [inner, outer] = DIAL.rings.pattern;
  const r = outer - (y / h) * (outer - inner);
  return (2 * Math.PI * r * h) / ((outer - inner) * w);
}

/** A top-to-bottom gradient over the full width, from y `top` to `bottom`. */
function vertical({ ctx, w }: Strip, from: string, to: string, top: number, bottom: number): void {
  const gradient = ctx.createLinearGradient(0, top, 0, bottom);
  gradient.addColorStop(0, from);
  gradient.addColorStop(1, to);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, top, w, bottom - top);
}

/** Nothing yet: the plate's lacquer. */
function plain({ ctx, w, h }: Strip): void {
  ctx.fillStyle = '#1c1030';
  ctx.fillRect(0, 0, w, h);
}

/**
 * The key-fret (回紋) on red lacquer: one gilt line folding into a square
 * hook 64 times round the ring, between two gilt borders, across y 0.22-0.78.
 * One repeat is 4 columns by 7 rows of a grid that is square on the ring, the
 * line half a grid step thick; `path` is its line in (column, row), row 0 and
 * row 7 being the borders, ending where the next repeat starts.
 */
const FRET = {
  top: 0.22,
  bottom: 0.78,
  columns: 4,
  rows: 7,
  path: [[0, 6], [0, 1], [3, 1], [3, 5], [2, 5], [2, 2], [1, 2], [1, 6], [4, 6]]
} as const;

function china(strip: Strip): void {
  const { ctx, w, h } = strip;
  vertical(strip, '#8e1b1f', '#5e1014', 0, h);

  const unit = w / REPEATS.china;
  // Seven steps between the borders' centres, plus the line's own thickness (half a step).
  const stepY = ((FRET.bottom - FRET.top) * h) / (FRET.rows + 0.5);
  const stepX = unit / FRET.columns;
  const halfY = stepY / 4;
  const halfX = halfY / stretchAt(strip, ((FRET.top + FRET.bottom) / 2) * h);
  const top = FRET.top * h + halfY;
  // Each straight run is a rectangle reaching half the line's thickness past its ends, so corners meet square.
  const run = (x0: number, y0: number, x1: number, y1: number) =>
    ctx.rect(Math.min(x0, x1) - halfX, Math.min(y0, y1) - halfY, Math.abs(x1 - x0) + 2 * halfX, Math.abs(y1 - y0) + 2 * halfY);

  ctx.beginPath();
  run(0, top, w, top);
  run(0, top + FRET.rows * stepY, w, top + FRET.rows * stepY);
  // One repeat past each end, so the runs cut by the canvas edge are whole across the seam.
  for (let k = -1; k <= REPEATS.china; k++) {
    for (let i = 1; i < FRET.path.length; i++) {
      const [c0, r0] = FRET.path[i - 1];
      const [c1, r1] = FRET.path[i];
      run(k * unit + c0 * stepX, top + r0 * stepY, k * unit + c1 * stepX, top + r1 * stepY);
    }
  }
  ctx.save();
  // A soft dark edge below the gilt, as if it stood on the lacquer.
  ctx.shadowColor = 'rgba(30, 4, 6, 0.6)';
  ctx.shadowOffsetY = halfY / 2;
  ctx.shadowBlur = halfY / 2;
  ctx.fillStyle = GILT;
  ctx.fill();
  ctx.restore();
}

/** Aruba's sea: two rows of cream crests, the flag's yellow stripes and its four-pointed stars. */
const ARUBA = {
  waves: [
    { y: 0.17, phase: 0 },
    { y: 0.57, phase: 0.5 }
  ],
  /** Crest height and line width as shares of the strip's height, and how sharp a crest is (0 a sine, toward 1 a cusp). */
  wave: { height: 0.07, line: 0.016, sharp: 0.5 },
  stripes: [
    [0.7, 0.74],
    [0.8, 0.84]
  ],
  /** Each star's centre and height (its white border included), its inner corners' radius as a share of its tips', and its border as a share of its radius. */
  star: { y: 0.36, size: 0.5, inner: 1 / 3, border: 0.08 }
} as const;

function aruba(strip: Strip): void {
  const { ctx, w, h } = strip;
  vertical(strip, '#418fde', '#2b6cb3', 0, h);
  for (const row of ARUBA.waves) crests(strip, row.y * h, row.phase);
  ctx.fillStyle = '#ffcf33';
  for (const [top, bottom] of ARUBA.stripes) ctx.fillRect(0, top * h, w, (bottom - top) * h);
  for (const bearing of REPEATS.arubaStars) star(strip, (bearing / 360) * w);
}

/**
 * One row of wave crests across the strip: a trochoid, sharp at the crests and
 * broad in the troughs, a whole number of waves round the ring, shifted by
 * `phase` of a wave.
 */
function crests({ ctx, w, h }: Strip, y: number, phase: number): void {
  const { height, line, sharp } = ARUBA.wave;
  const wave = w / REPEATS.arubaWaves;
  const steps = 32;
  ctx.beginPath();
  // One wave past each end, so the line runs on across the seam.
  for (let i = -steps; i <= (REPEATS.arubaWaves + 1) * steps; i++) {
    const t = (i / steps + phase) * 2 * Math.PI;
    ctx.lineTo((wave / (2 * Math.PI)) * (t - sharp * Math.sin(t)), y - ((height * h) / 2) * Math.cos(t));
  }
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = CREAM;
  ctx.lineWidth = line * h;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
}

/** A four-pointed star's outline round the origin, tips up, down, left and right. */
function starPath(ctx: CanvasRenderingContext2D, radius: number, inner: number): void {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? radius : radius * inner;
    ctx.lineTo(r * Math.sin((i * Math.PI) / 4), -r * Math.cos((i * Math.PI) / 4));
  }
  ctx.closePath();
}

/**
 * Aruba's star at x: red, inside a white border of even width. Every edge of
 * the star is the same distance from its centre, so the red star is the white
 * one scaled down; a tip's border reaches border / sin(half the tip's angle).
 */
function star(strip: Strip, x: number): void {
  const { ctx, h } = strip;
  const { y, size, inner, border } = ARUBA.star;
  const radius = (size * h) / 2;
  const tipHalfAngle = Math.atan2(inner * Math.SQRT1_2, 1 - inner * Math.SQRT1_2);
  const red = radius - (border * radius) / Math.sin(tipHalfAngle);
  ctx.save();
  ctx.translate(x, y * h);
  ctx.scale(1 / stretchAt(strip, y * h), 1);
  starPath(ctx, radius, inner);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  starPath(ctx, red, inner);
  ctx.fillStyle = '#e4002b';
  ctx.fill();
  ctx.restore();
}

/**
 * Rotterdam at night: the Erasmus bridge six times round the ring, its deck
 * over the river that runs along the inner edge. Heights are shares of the
 * strip's.
 */
const ROTTERDAM = {
  river: 0.78,
  deck: 0.72,
  deckLine: 0.02,
  pylonTop: 0.1,
  stayLine: 0.009,
  ripple: 0.008,
  pylon: '#9cc3e6',
  /** The pylon's floodlit haze: its own blue, this strong at the heart. */
  haze: ['rgba(156, 195, 230, 0.16)', 'rgba(156, 195, 230, 0)'],
  /** How strongly the night darkens the pylon's back face and its pier. */
  shade: 0.28
} as const;

type Point = readonly [x: number, y: number];

/**
 * One bridge in its own frame: x along the deck in units of the pylon's
 * height, the main span ahead at negative x and the anchorage behind, y up
 * from the deck in the same units. The pylon leans back from its foot, then
 * at 60% of its height turns forward to stand almost upright (the "swan"
 * neck), and ends in a point cut back from its front edge.
 */
const BRIDGE = {
  /** The pylon's outline: foot front, the kink, the tip, the cut and back down. */
  pylon: [[-0.1, 0], [0.2275, 0.6], [0.25, 1], [0.325, 0.88], [0.3125, 0.6], [0.1, 0]],
  /** The lower leg's back face, from its middle to its back edge. */
  shade: [[0, 0], [0.27, 0.6], [0.3125, 0.6], [0.1, 0]],
  /** The pier under the foot, down into the river. */
  pier: [[-0.12, 0], [0.12, 0], [0.09, -0.16], [-0.09, -0.16]],
  /** The front stays: their heights on the pylon's front edge, lowest first, and where they meet the deck ahead, nearest first. */
  front: { count: 8, from: [0.68, 0.97], to: [-0.45, -2] },
  /** The back stays: [height on the pylon's back edge, where they meet the deck behind]. */
  back: [
    [0.8, 0.6],
    [0.86, 0.68]
  ],
  /** How far the bridge reaches ahead and behind its foot, to centre it in its share of the ring. */
  reach: [-2, 0.7],
  /** The centre of the pylon's haze. */
  haze: [0.25, 0.55],
  /** The pylon's reflection: dashes [depth below the deck, from x, to x], fading as they go down. */
  ripples: [
    [0.17, -0.16, 0.2],
    [0.2, -0.09, 0.14],
    [0.23, -0.12, 0.08],
    [0.26, -0.05, 0.1]
  ]
} as const;

/** The x of the pylon's edge from outline corner `a` to `b` at height y. */
function edgeAt(a: number, b: number, y: number): number {
  const [x0, y0] = BRIDGE.pylon[a];
  const [x1, y1] = BRIDGE.pylon[b];
  return x0 + ((y - y0) / (y1 - y0)) * (x1 - x0);
}

/** The six bridges laid out on a strip. */
interface Bridges {
  /** The x of each bridge's foot. */
  feet: number[];
  /** The pylon's height in pixels: one unit of a bridge's frame. */
  unit: number;
  /** How much a bridge is drawn narrower, to keep its shape on the ring. */
  stretch: number;
  /** A point of the frame of the bridge whose foot is at `foot`, on the strip. */
  at(foot: number, point: Point): [number, number];
}

function layBridges(strip: Strip): Bridges {
  const { w, h } = strip;
  const deck = ROTTERDAM.deck * h;
  const unit = deck - ROTTERDAM.pylonTop * h;
  const stretch = stretchAt(strip, (deck + ROTTERDAM.pylonTop * h) / 2);
  const share = w / REPEATS.rotterdam;
  const middle = (BRIDGE.reach[0] + BRIDGE.reach[1]) / 2;
  const feet = Array.from({ length: REPEATS.rotterdam }, (_, k) => (k + 0.5) * share - (middle * unit) / stretch);
  return { feet, unit, stretch, at: (foot, [x, y]) => [foot + (x * unit) / stretch, deck - y * unit] };
}

/** The haze round each pylon, and its reflection broken by the river's ripples. */
function lights({ ctx, h }: Strip, { feet, unit, stretch, at }: Bridges): void {
  for (const foot of feet) {
    ctx.save();
    ctx.translate(...at(foot, BRIDGE.haze));
    ctx.scale(1 / stretch, 1);
    const haze = ctx.createRadialGradient(0, 0, 0, 0, 0, unit);
    haze.addColorStop(0, ROTTERDAM.haze[0]);
    haze.addColorStop(1, ROTTERDAM.haze[1]);
    ctx.fillStyle = haze;
    ctx.fillRect(-unit, -unit, 2 * unit, 2 * unit);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = ROTTERDAM.pylon;
    BRIDGE.ripples.forEach(([depth, from, to], i) => {
      ctx.globalAlpha = 0.45 * (1 - i / BRIDGE.ripples.length);
      const [x0, y] = at(foot, [from, -depth]);
      const [x1] = at(foot, [to, -depth]);
      ctx.fillRect(x0, y, x1 - x0, ROTTERDAM.ripple * h);
    });
    ctx.restore();
  }
}

/** Every bridge's eight front stays, fanning from the pylon's upper third to the deck ahead, and its two back stays. */
function stays({ ctx, h }: Strip, { feet, at }: Bridges): void {
  const { count, from, to } = BRIDGE.front;
  ctx.beginPath();
  for (const foot of feet) {
    for (let i = 0; i < count; i++) {
      const share = i / (count - 1);
      const y = from[0] + (from[1] - from[0]) * share;
      ctx.moveTo(...at(foot, [edgeAt(1, 2, y), y]));
      ctx.lineTo(...at(foot, [to[0] + (to[1] - to[0]) * share, 0]));
    }
    for (const [y, x] of BRIDGE.back) {
      ctx.moveTo(...at(foot, [edgeAt(4, 3, y), y]));
      ctx.lineTo(...at(foot, [x, 0]));
    }
  }
  ctx.strokeStyle = CREAM;
  ctx.lineWidth = ROTTERDAM.stayLine * h;
  ctx.stroke();
}

/** Every pier and pylon, their back faces in the night's shade. */
function pylons({ ctx }: Strip, { feet, at }: Bridges): void {
  const shape = (foot: number, points: readonly Point[]) => {
    ctx.beginPath();
    for (const point of points) ctx.lineTo(...at(foot, point));
    ctx.closePath();
    ctx.fill();
  };
  for (const foot of feet) {
    ctx.fillStyle = ROTTERDAM.pylon;
    shape(foot, BRIDGE.pier);
    shape(foot, BRIDGE.pylon);
    ctx.save();
    ctx.globalAlpha = ROTTERDAM.shade;
    ctx.fillStyle = '#140a24';
    shape(foot, BRIDGE.shade);
    shape(foot, BRIDGE.pier);
    ctx.restore();
  }
}

function rotterdam(strip: Strip): void {
  const { ctx, w, h } = strip;
  const river = ROTTERDAM.river * h;
  vertical(strip, '#140a24', '#1c1030', 0, river);
  ctx.fillStyle = '#1f2650';
  ctx.fillRect(0, river, w, h - river);
  // Back to front: the lights, the stays, the deck over the stays' ends, then the piers and pylons over the deck.
  const bridges = layBridges(strip);
  lights(strip, bridges);
  stays(strip, bridges);
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, (ROTTERDAM.deck - ROTTERDAM.deckLine / 2) * h, w, ROTTERDAM.deckLine * h);
  pylons(strip, bridges);
}

const PAINTERS: Readonly<Record<HomeId, (strip: Strip) => void>> = { plain, china, aruba, rotterdam };

/** Paints a home's strip over the whole `width` x `height`, then the two gilt rules every home keeps. */
export function paintHome(ctx: CanvasRenderingContext2D, home: HomeId, width: number, height: number): void {
  const strip = { ctx, w: width, h: height };
  ctx.save();
  PAINTERS[home](strip);
  const { thick, at } = DIAL_ART.patternRules;
  ctx.fillStyle = GILT;
  for (const y of at) ctx.fillRect(0, (y - thick / 2) * height, width, thick * height);
  ctx.restore();
}

/** A number, or 0 for NaN or an infinity. */
function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/**
 * How much of the ring the new home covers at angle u (0..1): it spreads both
 * ways from `origin` (0..1) and covers all of it at sweep 1. The front stands
 * `sweep * (0.5 + soft)` round the ring from the origin, the cover fading out
 * over the `soft` before it, so at sweep 1 the fade has passed the far side.
 * A NaN or infinite input reads as 0. The pattern shader mirrors this exactly.
 */
export function sweepCoverage(u: number, origin: number, sweep: number, soft = 0.015): number {
  const s = Math.max(0, finite(soft));
  const around = (((finite(u) - finite(origin)) % 1) + 1) % 1;
  const d = Math.min(around, 1 - around);
  const front = finite(sweep) * (0.5 + s);
  if (s === 0) return d < front ? 1 : 0;
  const t = Math.min(1, Math.max(0, (d - (front - s)) / s));
  return 1 - t * t * (3 - 2 * t);
}
