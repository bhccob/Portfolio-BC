import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import opentype, { type Font, type Glyph } from 'opentype.js';
import sharp from 'sharp';

/**
 * Renders the 1200 × 630 share images (Open Graph / social previews) at build
 * time, in the site's own type: every word is converted to vector outlines
 * with opentype.js, because the SVG renderer behind sharp cannot load web
 * fonts. Used by the endpoints in src/pages/og/ and src/pages/og.png.ts.
 */

const W = 1200;
const H = 630;
const root = process.cwd();
const require = createRequire(join(root, 'package.json'));

const COLORS = {
  board: '#1c1030',
  boardDeep: '#140a24',
  yellow: '#ffcf33',
  paper: '#f4ecda',
  cream: '#f1e8d3',
  lilac: '#b8aad8',
  dim: '#9789bb',
  grid: '#b8aad8'
};

type FontName = 'display' | 'script' | 'sans' | 'sansBold' | 'mono';

const FONT_FILES: Record<FontName, string> = {
  display: '@fontsource/bagel-fat-one/files/bagel-fat-one-latin-400-normal.woff',
  script: '@fontsource/yellowtail/files/yellowtail-latin-400-normal.woff',
  sans: '@fontsource/sofia-sans/files/sofia-sans-latin-400-normal.woff',
  sansBold: '@fontsource/sofia-sans/files/sofia-sans-latin-800-normal.woff',
  mono: '@fontsource/martian-mono/files/martian-mono-latin-500-normal.woff'
};

const fonts = new Map<FontName, Font>();

function font(name: FontName): Font {
  let loaded = fonts.get(name);
  if (!loaded) {
    const bytes = readFileSync(require.resolve(FONT_FILES[name]));
    loaded = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    fonts.set(name, loaded);
  }
  return loaded;
}

interface TextOptions {
  font: FontName;
  size: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  /** Tracking in em. */
  spacing?: number;
  upper?: boolean;
}

/**
 * Lays a line out glyph by glyph (cmap lookup, advance widths and pair
 * kerning). opentype.js's own text shaping does not support every lookup
 * these fonts use, and plain Latin text needs none of it.
 */
function layout(content: string, options: TextOptions): { glyph: Glyph; x: number }[] {
  const face = font(options.font);
  const scale = options.size / face.unitsPerEm;
  const tracking = (options.spacing ?? 0) * options.size;
  const value = options.upper ? content.toUpperCase() : content;
  const placed: { glyph: Glyph; x: number }[] = [];
  let cursor = 0;
  let previous: Glyph | null = null;
  for (const char of value) {
    const glyph = face.charToGlyph(char);
    if (previous) {
      // Some pairs have no usable kerning (undefined, or a lookup opentype.js cannot read).
      let kerning = 0;
      try {
        kerning = face.getKerningValue(previous, glyph);
      } catch {
        kerning = 0;
      }
      if (Number.isFinite(kerning)) cursor += kerning * scale;
    }
    placed.push({ glyph, x: cursor });
    cursor += (glyph.advanceWidth ?? 0) * scale + tracking;
    previous = glyph;
  }
  placed.push({ glyph: face.charToGlyph(' '), x: cursor - tracking });
  return placed;
}

const outlines = new Map<string, string>();

/**
 * A glyph's outline in font units, drawn once at the origin and then placed
 * with a transform: opentype.js can emit NaN coordinates for some glyphs
 * (e.g. Sofia Sans "g") when it scales and offsets them itself.
 */
function outline(name: FontName, glyph: Glyph): string {
  const key = `${name}:${glyph.index}`;
  let d = outlines.get(key);
  if (d === undefined) {
    d = glyph.getPath(0, 0, font(name).unitsPerEm).toPathData(1);
    outlines.set(key, d);
  }
  return d;
}

/** One line of text as SVG paths, with its baseline at (x, y). */
function text(content: string, x: number, y: number, options: TextOptions): string {
  const scale = options.size / font(options.font).unitsPerEm;
  const glyphs = layout(content, options)
    .slice(0, -1)
    .map(({ glyph, x: offset }) => {
      const d = outline(options.font, glyph);
      return d ? `<path transform="translate(${(x + offset).toFixed(2)} ${y.toFixed(2)}) scale(${scale.toFixed(5)})" d="${d}"/>` : '';
    })
    .join('');
  // Strokes scale with the glyphs, so the width is given in font units.
  const paint = options.stroke
    ? `fill="none" stroke="${options.stroke}" stroke-width="${((options.strokeWidth ?? 1.5) / scale).toFixed(2)}" stroke-linejoin="round"`
    : `fill="${options.fill ?? COLORS.paper}"`;
  return `<g ${paint}>${glyphs}</g>`;
}

function width(content: string, options: TextOptions): number {
  const placed = layout(content, options);
  return placed[placed.length - 1].x;
}

/** Breaks words into lines no wider than `max`. */
function wrap(content: string, max: number, options: TextOptions): string[] {
  const lines: string[] = [];
  for (const word of content.split(' ')) {
    const last = lines[lines.length - 1];
    if (last !== undefined && width(`${last} ${word}`, options) <= max) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

/** The ping-pong ball mascot, centred at (cx, cy). */
function ball(cx: number, cy: number, size: number): string {
  const s = size / 100;
  return `<g transform="translate(${cx - size / 2} ${cy - size / 2}) scale(${s})">
    <circle cx="50" cy="50" r="46" fill="${COLORS.yellow}"/>
    <path d="M24 30a30 30 0 0 1 22-14" fill="none" stroke="#fff" stroke-opacity="0.55" stroke-width="5" stroke-linecap="round"/>
    <ellipse cx="37" cy="52" rx="10" ry="17" fill="${COLORS.paper}" stroke="${COLORS.board}" stroke-width="3.5"/>
    <ellipse cx="63" cy="52" rx="10" ry="17" fill="${COLORS.paper}" stroke="${COLORS.board}" stroke-width="3.5"/>
    <circle cx="39" cy="46" r="5.5" fill="${COLORS.board}"/>
    <circle cx="65" cy="46" r="5.5" fill="${COLORS.board}"/>
  </g>`;
}

/** The drawing-paper grid and the site mark, shared by every card. */
function board(content: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <pattern id="minor" width="56" height="56" patternUnits="userSpaceOnUse"><path d="M56 0H0V56" fill="none" stroke="${COLORS.grid}" stroke-opacity="0.05"/></pattern>
      <pattern id="major" width="224" height="224" patternUnits="userSpaceOnUse"><path d="M224 0H0V224" fill="none" stroke="${COLORS.grid}" stroke-opacity="0.1"/></pattern>
    </defs>
    <rect width="${W}" height="${H}" fill="${COLORS.board}"/>
    <rect width="${W}" height="${H}" fill="url(#minor)"/>
    <rect width="${W}" height="${H}" fill="url(#major)"/>
    ${content}
  </svg>`;
}

function mark(x: number, y: number): string {
  return `${ball(x + 22, y + 22, 44)}${text('bhccob.me', x + 58, y + 29, { font: 'mono', size: 17, fill: COLORS.dim, spacing: 0.06 })}`;
}

/**
 * A picture as a cream print: rounded, padded, slightly turned and lifted by
 * a long soft shadow, like the prints on the site.
 */
async function print(file: string, boxWidth: number, boxHeight: number, angle: number, position = 'centre'): Promise<{ input: Buffer; width: number; height: number }> {
  const pad = 14;
  const innerW = boxWidth - pad * 2;
  const innerH = boxHeight - pad * 2;
  const picture = await sharp(join(root, file))
    .resize(innerW, innerH, { fit: 'cover', position: position as 'centre' })
    .composite([{ input: Buffer.from(`<svg width="${innerW}" height="${innerH}"><rect width="${innerW}" height="${innerH}" rx="5" fill="#fff"/></svg>`), blend: 'dest-in' }])
    .png()
    .toBuffer();
  const card = await sharp(Buffer.from(`<svg width="${boxWidth}" height="${boxHeight}"><rect width="${boxWidth}" height="${boxHeight}" rx="12" fill="${COLORS.cream}"/></svg>`))
    .composite([{ input: picture, left: pad, top: pad }])
    .png()
    .toBuffer();
  const margin = 60;
  const shadow = await sharp(Buffer.from(`<svg width="${boxWidth + margin * 2}" height="${boxHeight + margin * 2}"><rect x="${margin + 16}" y="${margin + 38}" width="${boxWidth - 32}" height="${boxHeight - 20}" rx="12" fill="#000" fill-opacity="0.7"/></svg>`))
    .blur(22)
    .png()
    .toBuffer();
  const lifted = await sharp(shadow).composite([{ input: card, left: margin, top: margin }]).png().toBuffer();
  const turned = await sharp(lifted).rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const meta = await sharp(turned).metadata();
  return { input: turned, width: meta.width ?? boxWidth, height: meta.height ?? boxHeight };
}

async function render(svg: string, layers: sharp.OverlayOptions[] = []): Promise<Buffer> {
  return sharp(Buffer.from(svg)).composite(layers).png({ compressionLevel: 9 }).toBuffer();
}

export interface ProjectCard {
  title: string;
  /** e.g. "Web development · #02" */
  label: string;
  /** e.g. "Company website · Personal project" */
  type: string;
  screenshot: string;
  /** Focal point of the screenshot as CSS object-position, e.g. "50% 58%". */
  focus?: string;
}

/** A project's share image: its title in the display face beside its screenshot as a print. */
export async function projectImage(card: ProjectCard): Promise<Buffer> {
  const left = 64;
  const maxWidth = 560;
  let size = 112;
  let lines = wrap(card.title, maxWidth, { font: 'display', size, upper: true });
  while ((lines.length > 2 || lines.some((line) => width(line, { font: 'display', size, upper: true }) > maxWidth)) && size > 56) {
    size -= 4;
    lines = wrap(card.title, maxWidth, { font: 'display', size, upper: true });
  }
  const lineHeight = size * 0.92;
  const titleTop = 230;
  const title = lines.map((line, index) => text(line, left, titleTop + size * 0.74 + index * lineHeight, { font: 'display', size, upper: true, fill: COLORS.paper })).join('');
  const below = titleTop + size * 0.74 + (lines.length - 1) * lineHeight;

  const svg = board(`
    ${mark(left, 52)}
    ${text(card.label, left, 186, { font: 'mono', size: 18, fill: COLORS.yellow, spacing: 0.12, upper: true })}
    ${title}
    ${text(card.type, left, below + 64, { font: 'sans', size: 28, fill: COLORS.lilac })}
    ${text('Bob Chung', left, 572, { font: 'script', size: 46, fill: COLORS.yellow })}
    ${text('Student software engineer · Rotterdam', left + 212, 566, { font: 'sansBold', size: 17, fill: COLORS.lilac, spacing: 0.08, upper: true })}
  `);

  const focus = card.focus ? card.focus.split(' ').map((value) => Number.parseFloat(value)) : [50, 50];
  const position = focus[0] < 33 ? 'west' : focus[0] > 66 ? 'east' : focus[1] < 33 ? 'north' : focus[1] > 66 ? 'south' : 'centre';
  const shot = await print(card.screenshot, 500, 380, -3, position);
  return render(svg, [{ input: shot.input, left: Math.round(W - 36 - shot.width + 40), top: Math.round((H - shot.height) / 2) }]);
}

export interface SiteCard {
  role: string;
  portrait: string;
}

/** The site-wide share image: the outlined name with its yellow lens, as in the hero, beside the portrait. */
export async function siteImage(card: SiteCard): Promise<Buffer> {
  const left = 64;
  const size = 176;
  const display = { font: 'display' as const, size, upper: true };
  const ballSize = size * 0.74;
  const b = width('B', display);
  const top = 200;
  const firstBase = top + size * 0.74;
  const secondBase = firstBase + size * 0.88;

  // Outline layer, and the same letters filled yellow inside the lens circle.
  const words = (paint: Partial<TextOptions>) =>
    text('B', left, firstBase, { ...display, ...paint }) +
    text('B', left + b + ballSize + size * 0.03, firstBase, { ...display, ...paint }) +
    text('CHUNG', left, secondBase, { ...display, ...paint });
  const lens = { cx: left + width('CHU', display) + 10, cy: secondBase - size * 0.45, r: size * 0.62 };

  const svg = board(`
    <defs><clipPath id="lens"><circle cx="${lens.cx}" cy="${lens.cy}" r="${lens.r}"/></clipPath></defs>
    ${mark(left, 52)}
    ${words({ stroke: 'rgba(244, 236, 218, 0.7)', strokeWidth: 2.4 })}
    <g clip-path="url(#lens)">${words({ fill: COLORS.yellow })}</g>
    ${ball(left + b + size * 0.015 + ballSize / 2, firstBase - size * 0.37, ballSize)}
    ${text(card.role, left, secondBase + 70, { font: 'sansBold', size: 22, fill: COLORS.lilac, spacing: 0.08, upper: true })}
  `);

  const portrait = await print(card.portrait, 340, 430, 3, 'north');
  return render(svg, [{ input: portrait.input, left: Math.round(W - 60 - portrait.width + 40), top: Math.round((H - portrait.height) / 2) }]);
}
