import { DIAL, DIAL_ART, DIRECTIONS, TRIGRAMS, onDial } from './dialSpec';
import { GLYPHS } from './glyphs';

/**
 * The dial's face, painted flat: a square with the dial's centre in the
 * middle, north up and east right, reaching r = DIAL.face at its edges, so
 * one world unit is size / (2 * DIAL.face) pixels. It carries the markings of
 * the loader's drawing (dialSvg), from the same table (DIAL_ART): the gilt
 * rules, the degree ticks, the trigrams and the four characters, in gilt on
 * lacquer.
 *
 * A second canvas, `mr`, holds the same shapes as three.js reads a combined
 * roughness/metalness map: green is roughness and blue is metalness.
 *
 * The painters take 2D contexts only and never read `ctx.canvas`; the
 * characters need Path2D and are left out where it is missing (node).
 */

const GILT = '#d9a520';
const LACQUER = '#140a24';

/** A colour holding roughness in green and metalness in blue. */
function roughMetal(roughness: number, metalness: number): string {
  return `rgb(0, ${Math.round(roughness * 255)}, ${Math.round(metalness * 255)})`;
}

/**
 * The gilt is gold paint, a little rough and not metal: it reads as gold by
 * the key's light (polished metal on a flat face would mirror the dark room
 * and read brown), and face-on it renders as its own colour, which the
 * loader's drawing crossfades from (CompassStudio's key). The lacquer is
 * glossy and not metal, its highlights crisp (the pearl's light is kept out
 * of them: materials.ts, withoutPointSpecular).
 */
const ROUGH_METAL = { gilt: roughMetal(0.4, 0), lacquer: roughMetal(0.08, 0) } as const;

/** The lacquer image is laid over the face as 2 x 2 tiles, this strong. */
const LACQUER_IMAGE = { tiles: 2, alpha: 0.35 } as const;

/** The raised gilt rules between the rings. */
function rules(ctx: CanvasRenderingContext2D): void {
  ctx.lineWidth = DIAL.ruleWidth;
  for (const r of DIAL.rules) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, 2 * Math.PI);
    ctx.stroke();
  }
}

/** The 360 degree ticks as one path, each a radial stroke from the degree ring's outer edge inwards. */
function ticks(ctx: CanvasRenderingContext2D): void {
  const { every1, every5, every15, width } = DIAL_ART.tick;
  const outer = DIAL.rings.degree[1];
  ctx.beginPath();
  for (let degree = 0; degree < DIAL.ticks; degree++) {
    const length = degree % 15 === 0 ? every15 : degree % 5 === 0 ? every5 : every1;
    ctx.moveTo(...onDial(degree, outer));
    ctx.lineTo(...onDial(degree, outer - length));
  }
  ctx.lineWidth = width;
  ctx.lineCap = 'butt';
  ctx.stroke();
}

/** The eight trigrams: each drawn north-up with its bottom line innermost, then turned to its bearing. */
function trigrams(ctx: CanvasRenderingContext2D): void {
  const { length, thick, gap, at } = DIAL_ART.bar;
  const half = (length - gap) / 2;
  for (const { bearing, lines } of TRIGRAMS) {
    ctx.save();
    ctx.rotate((bearing * Math.PI) / 180);
    lines.forEach((whole, i) => {
      const y = -at[i] - thick / 2;
      if (whole === 1) {
        ctx.fillRect(-length / 2, y, length, thick);
      } else {
        ctx.fillRect(-length / 2, y, half, thick);
        ctx.fillRect(gap / 2, y, half, thick);
      }
    });
    ctx.restore();
  }
}

/** The four characters, each turned to its bearing with its top outward, as dialSvg places them. */
function characters(ctx: CanvasRenderingContext2D): void {
  if (typeof Path2D === 'undefined') return;
  const { at, em } = DIAL_ART.glyph;
  for (const { bearing, char } of DIRECTIONS) {
    ctx.save();
    ctx.rotate((bearing * Math.PI) / 180);
    ctx.translate(0, -at);
    ctx.scale(em, em);
    ctx.translate(-0.5, -0.5);
    ctx.fill(new Path2D(GLYPHS[char]));
    ctx.restore();
  }
}

/** Every gilt marking, in `style`, on a `size` square canvas. */
function markings(ctx: CanvasRenderingContext2D, style: string, size: number): void {
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.scale(size / (2 * DIAL.face), size / (2 * DIAL.face));
  ctx.fillStyle = style;
  ctx.strokeStyle = style;
  rules(ctx);
  ticks(ctx);
  trigrams(ctx);
  characters(ctx);
  ctx.restore();
}

/**
 * Paints the face on `color` and its roughness/metalness map on `mr`, both
 * `size` square: lacquer, with the lacquer image (when given) tiled over it,
 * and the gilt markings.
 */
export function paintFace(color: CanvasRenderingContext2D, mr: CanvasRenderingContext2D, size: number, lacquer?: CanvasImageSource): void {
  color.save();
  color.fillStyle = LACQUER;
  color.fillRect(0, 0, size, size);
  if (lacquer) {
    const tile = size / LACQUER_IMAGE.tiles;
    color.globalAlpha = LACQUER_IMAGE.alpha;
    for (let row = 0; row < LACQUER_IMAGE.tiles; row++) {
      for (let column = 0; column < LACQUER_IMAGE.tiles; column++) color.drawImage(lacquer, column * tile, row * tile, tile, tile);
    }
  }
  color.restore();
  markings(color, GILT, size);

  mr.save();
  mr.fillStyle = ROUGH_METAL.lacquer;
  mr.fillRect(0, 0, size, size);
  mr.restore();
  markings(mr, ROUGH_METAL.gilt, size);
}
