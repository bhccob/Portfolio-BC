/**
 * The site's colours, the one place the scene takes them from (the builders in
 * src/engine/bob/build/, src/scene/bob/look.ts): `palette` as three.js hex
 * numbers, and `paletteCss` the same colours as CSS strings (`#rrggbb`), which
 * the hero's colour test (tests/unit/hero-colour.test.ts) holds the page's
 * tokens to (src/styles/tokens.css: --night, --cream, --gold, --dim), so the
 * scene and the page around it agree. Gold, brass, gold light and hot amber are
 * the compass's and the loader's metals and heat; black is the BOB scene's
 * world, haze its smoke, violet and lilac its cool light, and night the page's
 * own dark. A few colours are v3's and nothing in the BOB scene draws them
 * (board, board deep, yellow, thread, glass, nebula, fog); each says so. It
 * imports nothing, so a module that wants only the colours does not pull in
 * three.
 */
export const palette = {
  /** Board purple: v3's; nothing in the BOB scene draws it. */
  board: 0x1c1030,
  /** The deepest board purple: v3's chip city's case wall; nothing in the BOB scene draws it. */
  boardDeep: 0x140a24,
  /** Signal yellow: v3's; nothing in the BOB scene draws it. */
  yellow: 0xffcf33,
  /**
   * Cream: the key light (look.ts), the probe's hot point (build/probe.ts) and the reflection room's two warm cards
   * (build/room.ts); the page's --cream.
   */
  cream: 0xf1e8d3,
  /** Gold: the traces on the glass (build/traces.ts); the page's --gold. */
  gold: 0xd9a520,
  /** Brass: the compass's gold (its rims, needle, pivot and axis, build/compass.ts), the lip round the opening and the probe's body. */
  brass: 0xc9a24a,
  /**
   * Gold light: the colour the Blender preview's gold glows in (tools/blender/bob_build.py, GOLD_EMIT, linear
   * (1.0, 0.52, 0.16)): the engraving, the band marks, the tunnel's glow and its light, and the gold's own faint light.
   * Where it glows strongly the shoulder tone mapping rolls it off to a pale warm gold, as the preview's letters read;
   * the hot amber below stays the laser's own.
   */
  goldLight: 0xffbf6f,
  /** Thread red: v3's; nothing in the BOB scene draws it. */
  thread: 0xc8102e,
  /**
   * Hot amber: the loader's laser (build/probe.ts: its beam, its point, its
   * sparks and its light, whitened toward cream at the point). One token, so
   * the beam and its light stay the same heat; the cut itself glows in the gold
   * light, as the preview's letters do.
   */
  amber: 0xff7a1e,
  /**
   * Smoked glass: the near-black violet of v3's compass rings; nothing in the
   * BOB scene draws it (its bands are lilac glass with a haze glow,
   * build/compass.ts).
   */
  glass: 0x120a1c,
  /**
   * Violet: the cool counterpart of gold. The rim light (look.ts) and the
   * reflection room's back card (build/room.ts) take it.
   */
  violet: 0x6a35b8,
  /**
   * Haze: the violet of the smoke over the glass, a little bluer and lighter than `violet`: the Blender preview's
   * smoke (its volume (0.5, 0.36, 0.9) lit by two violet lights (0.55, 0.36, 1.0), tools/blender/bob_build.py),
   * which reads blue-violet against the black glass where `violet` read purple.
   */
  haze: 0x8a6cf2,
  /** Deep violet: v3's sky's nebula clouds; nothing in the BOB scene draws it (the page's --night-glow is its colour, faint). */
  nebula: 0x2a1250,
  /**
   * Night: the page's own dark (--night in tokens.css: the poster behind the
   * canvas, the page chrome). It was the 3D scene's background too, until
   * the scene took the preview's black (below).
   */
  night: 0x040209,
  /**
   * Black: the Blender preview's world as its frames show it (about (0.6, 0.3, 0.7) of 255 on its floor and sky,
   * measured from p01-p05 and loader-to-home.mp4), a hair of violet in true black. The 3D scene's clear colour, its
   * background and its fog (LOOK.background, LOOK.fog, src/scene/bob/look.ts; the two stay one colour, so the far glass fades
   * into the black it ends against) and the glass floor take it: with the night there, an indigo, the loader's frames came out 1.4 to 2.1
   * times as bright as the preview's and the floor read violet. The page around the scene keeps the night.
   */
  black: 0x010001,
  /**
   * Fog: v3's haze in the distance; nothing in the BOB scene draws it, as its
   * fog is the scene's black (LOOK.fog, look.ts).
   */
  fog: 0x0d0718,
  /** Lilac (--lilac in tokens.css, the site's quiet words): the compass's band glass and the reflection room's side card. */
  lilac: 0xb8aad8,
  /** Dim lilac (--dim in tokens.css, the scroll cue's): the probe's wisp of smoke. */
  dim: 0x9789bb,
  /** Near-black: the well's wall under the opening (build/glassFloor.ts) and the reflection room's walls. */
  ink: 0x0b0516
} as const;

export type PaletteColour = keyof typeof palette;

/** A hex number as a CSS colour: `#` and six lower-case digits. */
function css(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

/** The palette as CSS strings, made from the numbers so the two cannot drift apart. */
export const paletteCss = Object.fromEntries(Object.entries(palette).map(([name, hex]) => [name, css(hex)])) as Readonly<Record<PaletteColour, string>>;
