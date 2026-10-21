/**
 * The site's colours, the one place the 3D scenes and the drawings take them
 * from: `palette` as three.js hex numbers, `paletteCss` the same colours as
 * CSS strings (`#rrggbb`) for the canvas painters and the loader's SVG. The
 * purples, yellow, cream and lilacs are the site's own tokens
 * (src/styles/tokens.css), so the model and the page around it agree; gold,
 * brass and thread red are the compass's own, hot amber is the loader's
 * laser, and glass, violet, nebula, night and fog are the v3 home's. It imports
 * nothing, so a bundle that wants only the colours (the page's CSS, the
 * loader's) can read it without pulling in three.
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
  /**
   * Smoked glass: the near-black violet of the v3 compass's glass rings. It is
   * dark so that the room's reflections and the gold engraving draw the rings,
   * and the chip city's light reads as seen through them.
   */
  glass: 0x120a1c,
  /**
   * Violet: the nebula's light, the cool counterpart of gold. The chip city's
   * violet blocks, the mist over the board and the reflection room's back card
   * take it; milestone 1's haze was this colour too.
   */
  violet: 0x6a35b8,
  /** Deep violet: the v3 sky's nebula clouds, which only ever lie faintly over the night. */
  nebula: 0x2a1250,
  /**
   * Night: the v3 scene's background, the sky between the clouds, which the
   * sky builder layers the nebula over. The scene's clear colour (Task 12a's
   * LOOK.background) should take it too, so a frame drawn before the sky is
   * up is the same night as one drawn after.
   */
  night: 0x040209,
  /**
   * Fog: the v3 scene's haze in the distance (Task 12a's LOOK.fog), a breath
   * of violet over the night, so the far board and the compass's far rim
   * sink into a dark haze rather than cut off against black.
   */
  fog: 0x0d0718,
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
