import { DIAL, DIAL_ART, DIRECTIONS, TRIGRAMS } from '~/engine/instrument/dialSpec';
import { GLYPHS } from '~/engine/instrument/glyphs';
import { HEXAGRAMS, type GlassRing, type RingId } from '~/engine/v3/compassSpec';

/**
 * The engraving of the compass's four glass rings, painted as polar strips:
 * white marks on a transparent canvas, which the builders use as the alpha
 * mask of the gold. A strip's x runs round the ring, u = bearing / 360 from
 * north clockwise, and its y runs across the ring with y = 0 at the OUTER edge,
 * because three.js flips a CanvasTexture and the canvas top lands at v = 1,
 * which the Annulus's polar UVs put outermost (src/engine/instrument/Annulus.ts
 * and milestone 1's patterns.ts, whose painters this followed). So "up" in a
 * strip is outward.
 *
 * Wrapped round a ring, a strip pixel is wider than it is tall, by a different
 * factor at every radius, so every mark is sized in world units, as the
 * milestone-1 face is, and turned into pixels at the radius it stands at: a
 * mark that is a bar across the ring or a character keeps its shape on the
 * glass. A mark that crosses the strip's edge, at north where u = 0 meets
 * u = 1, is drawn once more a turn away, in the same fill, so the strip tiles
 * and north is whole.
 *
 * The painters take a 2D context and its size only: they never read
 * `ctx.canvas`, and the four characters need Path2D and are left out where it
 * is missing (node), as the face leaves them out.
 */

/** The strip sizes (width, height in px), for a fine and a coarse pointer, as the pattern ring's strips are chosen. */
export const RING_STRIP = { fine: [4096, 256], coarse: [2048, 128] } as const;

const TAU = 2 * Math.PI;

/** The marks are white: the gold takes their shape, not their colour. */
const WHITE = '#ffffff';

/**
 * How a hexagram's six lines stand on the hexagram ring. The dial's table
 * (DIAL_ART.bar) is for the trigram ring and has no hexagram bars, so the
 * lines are drawn from shares of the ring: each line is `thick` of the ring's
 * width deep (0.0224 on this ring, the depth of a trigram's bar) and `between`
 * of it from the next, the six centred across the ring; it is `fill` of the
 * ring's inner pitch (the arc one hexagram has at the inner edge) long, so
 * neighbours never touch, and a broken line is cut by `gap` of its own length.
 */
const HEXAGRAM_ART = { fill: 0.7, gap: 0.25, thick: 0.08, between: 0.05 } as const;

/** A strip to paint on: the ring it is wrapped round, its width, and how many pixels deep a world unit across the ring is. */
interface Strip {
  ctx: CanvasRenderingContext2D;
  ring: GlassRing;
  w: number;
  across: number;
}

/**
 * A rectangle on the strip, filled once. One that lies on the strip is one
 * fillRect. One that crosses the strip's left or right edge, where the ring's
 * north joins itself, is filled with its copy a turn of the ring away (`w`
 * pixels over) as one path, so the part cut off at one edge shows at the other
 * and a mark is still one fill, whether or not it crosses the seam.
 */
function rect(s: Strip, x: number, y: number, width: number, height: number): void {
  if (x >= 0 && x + width <= s.w) {
    s.ctx.fillRect(x, y, width, height);
    return;
  }
  s.ctx.beginPath();
  s.ctx.rect(x, y, width, height);
  s.ctx.rect(x < 0 ? x + s.w : x - s.w, y, width, height);
  s.ctx.fill();
}

/**
 * A bar across the ring: its outer edge at radius `top`, `thick` deep (radially),
 * centred on `bearing` and reaching from `from` to `to` world units along the ring
 * from that bearing (clockwise is positive). Its length is turned into pixels at
 * its own middle radius.
 */
function bar(s: Strip, bearing: number, top: number, thick: number, from: number, to: number): void {
  const along = s.w / (TAU * (top - thick / 2));
  rect(s, (bearing / 360) * s.w + from * along, (s.ring.outer - top) * s.across, (to - from) * along, thick * s.across);
}

/**
 * One line of a trigram or hexagram: a whole bar of `length`, or two halves of
 * it with `gap` between them. A broken line is two separate fills.
 */
function line(s: Strip, bearing: number, top: number, thick: number, length: number, whole: boolean, gap: number): void {
  if (whole) {
    bar(s, bearing, top, thick, -length / 2, length / 2);
  } else {
    bar(s, bearing, top, thick, -length / 2, -gap / 2);
    bar(s, bearing, top, thick, gap / 2, length / 2);
  }
}

/**
 * The eight trigrams, each at its bearing with its bottom line innermost, as
 * DIAL_ART.bar gives them: `at[i]` is the radius of line i's centre, as the
 * painted face and the loader's drawing placed it (milestone 1's face.ts and
 * dialSvg.ts), so the bar's outer edge is half its thickness farther out.
 */
function trigrams(s: Strip): void {
  const { length, thick, gap, at } = DIAL_ART.bar;
  for (const { bearing, lines } of TRIGRAMS) {
    lines.forEach((whole, i) => line(s, bearing, at[i] + thick / 2, thick, length, whole === 1, gap));
  }
}

/**
 * The four characters, each at its bearing with its top outward: the glyph is
 * placed by its centre (the outlines are centred in their em box), sized in
 * world units as a square em across and along the ring, and drawn y down, so
 * the top of the character lies toward the strip's top, the outer edge. One
 * that stands across the seam (north) takes its copy a turn away into the same
 * path.
 */
function characters(s: Strip): void {
  if (typeof Path2D === 'undefined') return;
  const { at, em } = DIAL_ART.glyph;
  const wide = (em * s.w) / (TAU * at);
  // One turn of the ring, measured in the em box's own units.
  const turn = (TAU * at) / em;
  for (const { bearing, char } of DIRECTIONS) {
    const x = (bearing / 360) * s.w;
    const outline = GLYPHS[char];
    const d = x - wide / 2 < 0 ? outline + shifted(outline, turn) : x + wide / 2 > s.w ? outline + shifted(outline, -turn) : outline;
    s.ctx.save();
    s.ctx.translate(x, (s.ring.outer - at) * s.across);
    s.ctx.scale(wide, em * s.across);
    s.ctx.translate(-0.5, -0.5);
    s.ctx.fill(new Path2D(d));
    s.ctx.restore();
  }
}

/**
 * The outline `d` moved `dx` along x. The glyph table's outlines use only M, L
 * and Q with absolute coordinates, in pairs of x then y, so every second number
 * after a command letter, starting with the first, is an x.
 */
function shifted(d: string, dx: number): string {
  let index = 0;
  return d.replace(/[A-Za-z]|-?\d*\.?\d+/g, (token) => {
    if (/[A-Za-z]/.test(token)) {
      index = 0;
      return token;
    }
    return index++ % 2 === 0 ? (Number(token) + dx).toFixed(4) : token;
  });
}

/** The 360 degree ticks, each a radial bar hanging from the ring's outer edge, longer every 5 and every 15 degrees. */
function ticks(s: Strip): void {
  const { every1, every5, every15, width } = DIAL_ART.tick;
  for (let degree = 0; degree < DIAL.ticks; degree++) {
    const length = degree % 15 === 0 ? every15 : degree % 5 === 0 ? every5 : every1;
    bar(s, degree, s.ring.outer, length, -width / 2, width / 2);
  }
}

/**
 * The 64 hexagrams, hexagram k at bearing k * 360 / 64, its six lines stacked
 * across the ring with the bottom line innermost, so a hexagram reads from the
 * centre outwards as a trigram does.
 */
function hexagrams(s: Strip): void {
  const { ring } = s;
  const width = ring.outer - ring.inner;
  const { fill, gap, thick, between } = HEXAGRAM_ART;
  const length = fill * ((TAU * ring.inner) / HEXAGRAMS.length);
  // Six lines and five gaps between them, centred across the ring.
  const margin = (1 - (6 * thick + 5 * between)) / 2;
  for (const { bearing, lines } of HEXAGRAMS) {
    lines.forEach((whole, i) => {
      // The i-th line from the inner edge: its outer edge is this far in from the ring's inner edge.
      const top = ring.inner + (margin + (i + 1) * thick + i * between) * width;
      line(s, bearing, top, thick * width, length, whole === 1, gap * length);
    });
  }
}

const PAINTERS: Readonly<Record<RingId, (strip: Strip) => void>> = { trigram: trigrams, direction: characters, degree: ticks, hexagram: hexagrams };

/**
 * Paints a ring's engraving over the whole `width` x `height` strip, in white
 * on what is already there (a new canvas is transparent, and nothing here fills
 * a background): the trigram ring's eight trigrams, the direction ring's four
 * characters, the degree ring's 360 ticks or the hexagram ring's 64 hexagrams.
 * The strip is in the polar layout of the Annulus, u = bearing / 360 and y = 0
 * at the ring's outer edge, and the builders use it as the alpha mask of the
 * gold.
 */
export function paintRingStrip(ctx: CanvasRenderingContext2D, ring: GlassRing, width: number, height: number): void {
  const strip: Strip = { ctx, ring, w: width, across: height / (ring.outer - ring.inner) };
  ctx.save();
  ctx.fillStyle = WHITE;
  PAINTERS[ring.id](strip);
  ctx.restore();
}
