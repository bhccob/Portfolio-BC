/**
 * The site's colours, the one place the scene takes them from (the builders in
 * src/engine/bob/build/, src/scene/bob/look.ts): `palette` as three.js hex
 * numbers, and `paletteCss` the same colours as CSS strings (`#rrggbb`), which
 * the hero's colour test (tests/unit/hero-colour.test.ts) holds the page's
 * tokens to (src/styles/tokens.css: --night, --cream, --gold, --dim), so the
 * scene and the page around it agree. Gold, brass and hot amber are the
 * compass's and the loader's metals and heat; glass, violet, nebula, night and
 * fog are the v3 home's air. It imports nothing, so a module that wants only
 * the colours does not pull in three.
 */
export const palette = {
  /** Board purple: nothing in the v3 scene draws it. */
  board: 0x1c1030,
  /** The deepest board purple: the wall of the chip city's case (build/case.ts). */
  boardDeep: 0x140a24,
  /** Signal yellow: nothing in the v3 scene draws it. */
  yellow: 0xffcf33,
  /**
   * Cream: the key light (look.ts), the stars' cores and the sky's fixed stars, the laser's hot point, and the
   * reflection room's two warm cards.
   */
  cream: 0xf1e8d3,
  /**
   * Gold: the needle, the rings' engraving, the lit traces, the constellations' lines, the chip's cooled ON and its
   * lit pins' glow, and the chip city's warm blocks.
   */
  gold: 0xd9a520,
  /** Brass: the chip's pins, the traces at rest, the laser's probe and the lip of the city's case. */
  brass: 0xc9a24a,
  /** Thread red: nothing in the v3 scene draws it. */
  thread: 0xc8102e,
  /**
   * Hot amber: the loader's laser (its beam, its point and its sparks) and the
   * fresh cut it leaves in the chip, which cools from this to gold; it also
   * warms the chip's lit pins a little. One token, so the beam and the cut it
   * makes stay the same heat.
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
   * violet blocks, the mist over the board, the rim light (look.ts) and the
   * reflection room's back card take it.
   */
  violet: 0x6a35b8,
  /** Deep violet: the v3 sky's nebula clouds, which only ever lie faintly over the night. */
  nebula: 0x2a1250,
  /**
   * Night: the v3 scene's background, the sky between the clouds, which the
   * sky builder layers the nebula over. The scene's clear colour
   * (LOOK.background, look.ts) takes it too, so a frame drawn before the sky
   * is up is the same night as one drawn after.
   */
  night: 0x040209,
  /**
   * Fog: the v3 scene's haze in the distance (LOOK.fog, look.ts), a breath
   * of violet over the night, so the far board and the compass's far rim
   * sink into a dark haze rather than cut off against black.
   */
  fog: 0x0d0718,
  /** Lilac (--lilac in tokens.css, the site's quiet words): the reflection room's side card. */
  lilac: 0xb8aad8,
  /** Dim lilac (--dim in tokens.css, the scroll cue's): the laser's smoke. */
  dim: 0x9789bb,
  /** Near-black: the chip's body, the city's blocks, the floor of its case and the reflection room's walls. */
  ink: 0x0b0516
} as const;

export type PaletteColour = keyof typeof palette;

/** A hex number as a CSS colour: `#` and six lower-case digits. */
function css(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

/** The palette as CSS strings, made from the numbers so the two cannot drift apart. */
export const paletteCss = Object.fromEntries(Object.entries(palette).map(([name, hex]) => [name, css(hex)])) as Readonly<Record<PaletteColour, string>>;
