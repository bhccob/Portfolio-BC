import { palette } from '~/engine/palette';

/**
 * How the v3 scenes are lit and finished, in one place, so Task 14's luminance gate has one file to turn down (it may
 * lower the exposure, the bloom and the home's levels, never the gate). The Studio reads the background, the fog, the
 * lights and the room's strength; Effects reads the exposure and the post chain's numbers; the Opening reads the levels
 * the home rests at. These are starting values, darker and calmer than the concept frames (spec §4): when in doubt,
 * take light away. Every colour is a palette token.
 *
 * - `background`: the clear colour, the sky's own night (SKY_LOOK.background), so a frame drawn before the sky is the
 *   same night as one drawn after.
 * - `fog`: exponential fog in the palette's dark violet haze; at the home's camera distance (3.4) it takes about 4 % of
 *   the near rim and more of the far board, enough to sink the edges, never a wall of haze.
 * - `exposure`: the shoulder tone mapping's (renderer on the low tier, the post chain's last effect otherwise).
 * - `bloom`: threshold 1 in linear light, so only what is emissive past it blooms (the laser's point, the power-on pins,
 *   a pointed star's core); `high` and `medium` are its intensity on those tiers, at full and half resolution.
 * - `vignette` and `noise`: as milestone 1's chain, darker at the edges; the noise is premultiplied, so it never lifts
 *   the blacks.
 * - `key`: one dim warm light from the upper left of the home's view (west, up, a little toward the camera), for the
 *   gold's sheen; `rim`: a faint violet from behind the compass (north) and a little below its plane, for the edges of
 *   the glass rings, the needle and the city's walls. Below, not above: from above it glinted off the glossy glass as a
 *   clipped violet spot while the camera came down to the home. Both are directional and aim at the compass's centre.
 * - `environment`: the reflection room's strength (scene.environmentIntensity; the room itself is at half milestone 1's
 *   radiance, src/engine/v3/build/room.ts).
 * - `home`: the levels the opening lands on (Ruling 3): `chip`, the chip's own light under the hub (ChipModel.setRest);
 *   `current`, the power left in the pins and the gilt rules the traces became (ChipModel.setPower, their one driver);
 *   `city`, the chip city's glow once it has risen (CityModel.setGlow), a hint of light below.
 */
export const LOOK = {
  background: palette.night,
  fog: { color: palette.fog, density: 0.06 },
  exposure: 0.85,
  bloom: { threshold: 1, smoothing: 0.12, radius: 0.55, high: 0.45, medium: 0.32 },
  vignette: { offset: 0.22, darkness: 0.82 },
  noise: 0.03,
  key: { colour: palette.cream, intensity: 1.1, position: [-3, 4, 2] },
  rim: { colour: palette.violet, intensity: 0.5, position: [1, -0.6, -4] },
  environment: 1,
  home: { chip: 0.45, current: 0.35, city: 1 },
} as const;
