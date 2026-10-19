import { DIAL, DIAL_ART, DIRECTIONS, TRIGRAMS, onDial } from './dialSpec';
import { GLYPHS } from './glyphs';

/**
 * The loader's drawing of the dial at rest, face-on: flat colours, plain SVG,
 * built from the same measurements (DIAL) and outlines (GLYPHS) as the 3D
 * compass, so the hand-over from this drawing to the live scene is unseen.
 * North is up and east is right. The viewBox is centred on the dial, so the
 * needle group turns about the pin with a plain `rotate(deg)`.
 *
 * Colours are presentation attributes, never `style=`, so the drawing carries
 * no CSS of its own and can be inlined anywhere. It has no `<text>` (the
 * characters are outlines, so no font is needed) and no script.
 */

const COLOR = {
  plate: '#1c1030',
  face: '#140a24',
  brass: '#c9a24a',
  gilt: '#d9a520',
  thread: '#c8102e',
  needleTip: '#ffcf33',
  pin: '#f1e8d3'
} as const;

/** The plate's brass edge: drawn inside the plate's outline so none of it is clipped by the viewBox. */
const PLATE_EDGE = 0.012;

/** The pool's brass wall: a ring this thick that ends at the pool's radius. */
const POOL_WALL = 0.01;

/** The markings' measurements, the same ones the painted face and pattern ring use. */
const { patternRules: PATTERN_RULES, tick: TICK, bar: BAR, glyph: GLYPH } = DIAL_ART;

/** A number written short: at most four decimals, no trailing zeros, no "-0". */
function n(value: number): string {
  return String(Number(value.toFixed(4)) + 0);
}

function circle(r: number, attributes: string): string {
  return `<circle r="${n(r)}" ${attributes}/>`;
}

/** The raised gilt rules between the rings, and the plain pattern ring's own two. */
function rules(): string {
  const [inner, outer] = DIAL.rings.pattern;
  const width = outer - inner;
  const between = DIAL.rules.map((r) => circle(r, `stroke-width="${n(DIAL.ruleWidth)}"`));
  const pattern = PATTERN_RULES.at.map((at) => circle(outer - at * width, `stroke-width="${n(PATTERN_RULES.thick * width)}"`));
  return `<g fill="none" stroke="${COLOR.gilt}">${[...between, ...pattern].join('')}</g>`;
}

/** The 360 degree ticks as one path, each a radial stroke from the ring's outer edge inwards. */
function ticks(): string {
  const outer = DIAL.rings.degree[1];
  let d = '';
  for (let degree = 0; degree < DIAL.ticks; degree++) {
    const length = degree % 15 === 0 ? TICK.every15 : degree % 5 === 0 ? TICK.every5 : TICK.every1;
    const [x0, z0] = onDial(degree, outer);
    const [x1, z1] = onDial(degree, outer - length);
    d += `M${n(x0)} ${n(z0)}L${n(x1)} ${n(z1)}`;
  }
  return `<path d="${d}" fill="none" stroke="${COLOR.gilt}" stroke-width="${TICK.width}"/>`;
}

/**
 * One bar of a trigram, at radius `r` north of the centre: whole, or broken
 * into two halves round a gap. Straight and perpendicular to the radius.
 */
function bar(r: number, whole: boolean): string {
  const y = -r - BAR.thick / 2;
  const piece = (x: number, length: number) => `M${n(x)} ${n(y)}h${n(length)}v${n(BAR.thick)}h${n(-length)}z`;
  if (whole) return `<path d="${piece(-BAR.length / 2, BAR.length)}"/>`;
  const half = (BAR.length - BAR.gap) / 2;
  return `<path d="${piece(-BAR.length / 2, half)}${piece(BAR.gap / 2, half)}"/>`;
}

/** The eight trigrams: each drawn north-up with its bottom line innermost, then turned to its bearing. */
function trigrams(): string {
  return TRIGRAMS.map(
    ({ bearing, name, lines }) =>
      `<g data-trigram="${name}" transform="rotate(${n(bearing)})" fill="${COLOR.gilt}">${lines.map((whole, i) => bar(BAR.at[i], whole === 1)).join('')}</g>`
  ).join('');
}

/**
 * The four direction characters. Each is drawn upright in a local frame (its
 * 1 x 1 em outline centred on the origin and scaled to one em), moved out to
 * the ring along north, then the whole turned to its bearing: tops outward, so
 * 南 at the bottom is upside down to the viewer, as on a real luopan.
 */
function glyphs(): string {
  return DIRECTIONS.map(
    ({ bearing, char }) =>
      `<path data-glyph="${char}" d="${GLYPHS[char]}" fill="${COLOR.gilt}" transform="rotate(${n(bearing)}) translate(0 ${n(-GLYPH.at)}) scale(${GLYPH.em}) translate(-0.5 -0.5)"/>`
  ).join('');
}

/** The needle at rest, pointing north: tip half signal yellow, tail half brass, and the pin. */
function needle(): string {
  const { tip, tail, width, pin } = DIAL.needle;
  const half = width / 2;
  return (
    '<g data-loader-needle>' +
    `<path d="M0 ${n(-tip)}L${n(half)} 0L${n(-half)} 0z" fill="${COLOR.needleTip}"/>` +
    `<path d="M0 ${n(tail)}L${n(half)} 0L${n(-half)} 0z" fill="${COLOR.brass}"/>` +
    circle(pin, `fill="${COLOR.pin}"`) +
    '</g>'
  );
}

/** The red threads, north-south and east-west, plate edge to plate edge. */
function threads(): string {
  const edge = DIAL.plate / 2;
  return (
    `<g stroke="${COLOR.thread}" stroke-width="${n(DIAL.threads.radius * 2)}">` +
    `<path d="M0 ${n(-edge)}V${n(edge)}M${n(-edge)} 0H${n(edge)}"/>` +
    '</g>'
  );
}

/**
 * The dial as one `<svg>` string, from the bottom up: the plate, the brass rim
 * (the one `circle[data-dial-rim]`, drawn at the rim's full radius with the
 * disc over it so only its ring shows), the pattern ring, the face, the gilt
 * rules, the ticks, the trigrams, the characters, the pool, the needle and,
 * above the needle as in the 3D scene, the threads.
 */
export function dialSvg(): string {
  const half = DIAL.plate / 2;
  const inset = half - PLATE_EDGE / 2;
  const [patternInner, patternOuter] = DIAL.rings.pattern;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-half} ${-half} ${DIAL.plate} ${DIAL.plate}" aria-hidden="true" focusable="false">` +
    `<rect x="${n(-inset)}" y="${n(-inset)}" width="${n(inset * 2)}" height="${n(inset * 2)}" rx="${n(DIAL.plateCorner - PLATE_EDGE / 2)}" fill="${COLOR.plate}" stroke="${COLOR.brass}" stroke-width="${PLATE_EDGE}"/>` +
    circle(DIAL.rim, `data-dial-rim fill="${COLOR.brass}"`) +
    circle(patternOuter, `fill="${COLOR.plate}"`) +
    circle(patternInner, `fill="${COLOR.face}"`) +
    rules() +
    ticks() +
    trigrams() +
    glyphs() +
    circle(DIAL.pool - POOL_WALL / 2, `fill="${COLOR.face}" stroke="${COLOR.brass}" stroke-width="${POOL_WALL}"`) +
    needle() +
    threads() +
    '</svg>'
  );
}
