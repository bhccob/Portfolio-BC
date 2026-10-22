import { palette } from '~/engine/palette';

/**
 * How the BOB scene is lit and finished, in one place, so Task 12's luminance
 * gate has one file to turn down (it may lower the exposure, the bloom and the
 * lights, never the gate). The Studio reads the background, the fog, the
 * lights and the room's strength; Effects reads the exposure and the post
 * chain's numbers. These are starting values, darker and calmer than the
 * concept frames (spec section 4): when in doubt, take light away. Every
 * colour is a palette token.
 *
 * - `background`: the clear colour and the scene's background, the night.
 * - `fog`: linear fog in the background's own night (Ruling 26), none nearer
 *   than `near` and all of it at `far`: the home camera stands 8.8 from the
 *   compass and the loader's 13.8, so the name and the compass stay clear, and
 *   the far glass fades into the very black the sky is. `far` lies inside the
 *   slab (GLASS_LOOK.floor.outer, 60), so the glass is all night well before
 *   its edge: the nearest edge any shot sees is about 67 away. A fog of any
 *   other colour left the edge as a line where the fogged glass met the night,
 *   worst on a phone, whose camera stands back far enough to see it. These are
 *   the laptop's numbers; the fog moves with the shot (`fogFor`), so a camera
 *   that stands further back (a phone's, 23 m off) sees its compass as clear.
 * - `exposure`: the shoulder tone mapping's (the renderer's on the low tier,
 *   the post chain's last effect otherwise).
 * - `bloom`: from 0.7 in linear light, so the engraving's softly glowing lines
 *   and the laser's point bloom, never a gold specular; `intensity.high` and
 *   `.medium` are its strength on those tiers, at full and half resolution.
 * - `vignette` and `noise`: as v3's chain, darker at the edges; the noise is
 *   premultiplied, so it never lifts the blacks.
 * - `key`: one dim warm light from the upper left of the view, for the gold's
 *   sheen; `rim`: a faint violet from behind the compass and a little below
 *   the glass, for the edges of the bands. Both directional, v3's. Task 12:
 *   the rim at 0.05, not 0.5: its highlight on the glossy band glass (a
 *   directional light on roughness 0.04 clips at almost any strength) was a
 *   hard, blooming violet star on the right of the compass that the preview
 *   does not have (its violet lights cast no specular), a second focal point;
 *   at 0.05 it is a small fleck on the band's edge.
 * - `environment`: the reflection room's strength (scene.environmentIntensity;
 *   the room itself is ~/engine/bob/build/room).
 */
export const LOOK = {
  background: palette.night,
  fog: { color: palette.night, near: 14, far: 50, clear: 5 },
  exposure: 0.85,
  bloom: { threshold: 0.7, smoothing: 0.12, radius: 0.55, intensity: { high: 0.45, medium: 0.32 } },
  vignette: { offset: 0.22, darkness: 0.82 },
  noise: 0.03,
  key: { colour: palette.cream, intensity: 1.1, position: [-3, 4, 2] },
  rim: { colour: palette.violet, intensity: 0.05, position: [1, -0.6, -4] },
  environment: 1
} as const;

/**
 * The fog for a camera that stands `distance` from the point it looks at (the
 * shot's camera to its target): no nearer than LOOK.fog's `near`, and at least
 * `clear` beyond what the camera looks at, so the compass and the name are
 * never in it; all of it `far - near` further on. On a laptop (the home 8.8
 * off, the loader's wide shot 13.8) the home keeps LOOK.fog's 14 to 50 exactly.
 * On a phone the home stands 23.2 off: with the fixed 14 it was a quarter of
 * the way into the fog (Task 12, "the phone home is murky"), and here its fog
 * runs 28.2 to 64.2, still short of the slab's far edge, 82 from that camera
 * (Ruling 26). A distance that is not a finite, positive number reads as 0:
 * LOOK.fog's own numbers.
 */
export function fogFor(distance: number): { near: number; far: number } {
  const d = Number.isFinite(distance) && distance > 0 ? distance : 0;
  const near = Math.max(LOOK.fog.near, d + LOOK.fog.clear);
  return { near, far: near + (LOOK.fog.far - LOOK.fog.near) };
}

/**
 * How long the home's idle motion runs after the last thing that stirred it
 * (a pointer move at home, a phase change, the hand-over from the opening),
 * seconds: the bands' turn, the smoke's drift and the engraving's breathing. A
 * needle on the touch drift runs on to the drift's next rest
 * (~/engine/bob/needleAim `nextDriftRest`). Then the needle settles, the scene
 * draws nothing more and the canvas sleeps (spec section 4: when nothing
 * moves, nothing is rendered). Moved unchanged from v3's homePose.
 */
export const IDLE_SECONDS = 12;

/** A breathing glow: ±`depth` of itself, once every `period` seconds. Slow, like a held breath. Moved unchanged from v3's homePose. */
export const BREATHE = { depth: 0.1, period: 4 } as const;

/** `1 + depth * sin(2 PI t / period)`; a time that is not finite reads as rest, 1. */
function wave(t: number, { depth, period }: { depth: number; period: number }): number {
  if (!Number.isFinite(t)) return 1;
  return 1 + depth * Math.sin((2 * Math.PI * t) / period);
}

/** The breath at `t` seconds of idle motion, as a share of the glow at rest: 0.9 to 1.1 over 4 s. Moved unchanged from v3's homePose. */
export function breathAt(t: number): number {
  return wave(t, BREATHE);
}

/**
 * How deep the engraving breathes at home, either way, as a share of its glow
 * at rest: half v3's needle tip's `BREATHE.depth`, as the engraving is the
 * whole name and the compass's opening, and a deeper breath would read as a
 * flicker.
 */
export const ENGRAVE_BREATH = 0.05;

/**
 * The engraving's glow at `t` seconds of the home's idle motion
 * (`EngravingModel.setGlow`): `breathAt`'s wave at `ENGRAVE_BREATH`'s depth,
 * 0.95 to 1.05 over `BREATHE.period`, and exactly 1 at 0, where the loader
 * left it. A time that is not finite reads as rest.
 */
export function engraveGlowAt(t: number): number {
  return 1 + (breathAt(t) - 1) * (ENGRAVE_BREATH / BREATHE.depth);
}
