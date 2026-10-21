/**
 * The site's colours, the one place the 3D scenes and the drawings take them
 * from: `palette` as three.js hex numbers, `paletteCss` the same colours as
 * CSS strings (`#rrggbb`) for the canvas painters and the loader's SVG. The
 * purples, yellow, cream and lilacs are the site's own tokens
 * (src/styles/tokens.css), so the model and the page around it agree; gold,
 * brass and thread red are the compass's own, and hot amber is the loader's
 * laser. It imports nothing, so the loader's bundle (dialSvg) can read it
 * without pulling in three.
 */
export const palette = {
  /** Board purple (--board): the base plate's lacquer and the plain pattern ring. */
  board: 0x1c1030,
  /** The deepest board purple (--board-deep): the face's lacquer and the drive's magnets. */
  boardDeep: 0x140a24,
  /** Signal yellow: the needle's tip and the read head, the tracks and the wire's pulses. */
  yellow: 0xffcf33,
  /** Cream: the wire, the loader's pin and the patterns' fine lines. */
  cream: 0xf1e8d3,
  /** Gold: the gilt rules and markings, and the voice coil. */
  gold: 0xd9a520,
  /** Brass: the rim, the plate's edge, the pool's wall and the needle's tail. */
  brass: 0xc9a24a,
  /** Thread red: the red threads across the dial. */
  thread: 0xc8102e,
  /**
   * Hot amber: the loader's laser (its beam, its point and its sparks) and the
   * fresh cut it leaves in the chip, which cools from this to gold. One token,
   * so the beam and the cut it makes stay the same heat.
   */
  amber: 0xff7a1e,
  /** Lilac (--lilac, the site's text). */
  lilac: 0xb8aad8,
  /** Dim lilac (--dim, the site's quiet text). */
  dim: 0x9789bb,
  /** Near-black (--split). */
  ink: 0x0b0516
} as const;

export type PaletteColour = keyof typeof palette;

/** A hex number as a CSS colour: `#` and six lower-case digits. */
function css(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

/** The palette as CSS strings, made from the numbers so the two cannot drift apart. */
export const paletteCss = Object.fromEntries(Object.entries(palette).map(([name, hex]) => [name, css(hex)])) as Readonly<Record<PaletteColour, string>>;
