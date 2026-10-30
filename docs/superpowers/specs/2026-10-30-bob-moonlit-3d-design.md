# Round 8: the moonlit storm, and a polished compass and tower

Bob, 2026-10-30, round 7:

> the clouds look 2d i want it to be 3d and give a realistic and cinematic effect, you can use blender for the models
> and all the models like compass and t he tower doesnt look polished i want them to have more 3D looks and realistic

He was shown Blender test renders of the site's own compass and tower (exported from the site), with real volume
clouds and polished materials (`.superpowers/r7-review/`, port 4471): the home now, **A · gold-lit storm** and
**B · moonlit storm**, and the tower now beside the tower polished. He picked **B · moonlit storm**, with the polish as
shown. The renders are the target: `home-moon.png` for the start screen, `world-new.png` for the tower.

The round 7 changes (header, dark clouds under the falling light, centred contact page) are live (4d3bb21) and stay.

## Goals

1. **The storm is real 3D clouds, moonlit.** Violet storm clouds with lit tops and shadowed undersides, a pale violet
   moon behind them giving them bright rims, deep dark between them; now and then one faint gold flash glowing *inside*
   a cloud. It replaces the painted plates everywhere the storm shows: the start screen (the sky, the three flats, the
   glass's mirror of them), the fall (still dark under the light) and behind the tower.
2. **The compass looks machined and real.** Round, smooth gold rims (not faceted), a needle with a ridge and bevelled
   edges, smoked violet glass bands that darken where light runs through more glass, the band marks as gold inlay in the
   glass, a soft highlight of the light sliding over the glass and the gold.
3. **The tower looks machined and real.** Boards under a glossy lacquer, a polished gold lip round the top edge of each
   plate and a steel lip round the bottom, small parts with rounded edges, metal that is brushed rather than flat.

## Non-goals

- No change to the journey: the same scroll, stops, camera, timings, words, pages, projects and loader.
- No new objects or scenery beyond the lips on the plates.
- The fall's clouds stay dark under the light (round 7), the end page stays without a storm.
- No live (per-frame) cloud simulation; see "How the clouds are made".

## Anti-goals (a failure even if it works)

- Brighter or busier than now: the site stays dark, calm, one focal point per scene; the dark gate holds (a still's
  mean luma at most 0.11 at home and the stops, 0.15 with a project open).
- Clouds that read as a flat picture: they must keep depth between their layers as the camera sways and moves.
- Glare: white blocks of reflected light on the glass bands (seen in the first renders, a soft-box reflection too
  strong), or a needle and rims that read as plastic.
- A slower site: the storm still loads after the home has landed and never holds the loader; phones keep their frame
  rate; the low tier keeps today's simpler look.

## How the clouds are made (my call)

The clouds are rendered in Blender as real volumes (the test render's way: noise-carved volume, a moon sun behind and
one to the side, lightning as glow inside the cloud), from where the compass stands, into the same plates the storm
already draws from, plus new ones:

- `storm-wall` (the sky above the horizon) and `storm-sea` (below it), opaque, in the sky's mapping (`u` round 225
  degrees behind, `v` from el = -0.32 to 0.48 rad for the wall, -0.48 to 0.32 for the sea; `src/engine/bob/build/storm.ts`);
- `storm-bank`: one bank of storm with its own transparency, for the three flats, so they let the sky through between
  clouds by real coverage instead of by darkness;
- `storm-wall-flash` and `storm-bank-flash`: the gold glow of lightning inside the clouds, at some seven places spread
  across the arc, lit alone; the shader adds the one near the flash's way, at the flash's strength. The sea has no
  flash plate: it is dim under the glass at home and dark in the fall.

A headless script, `tools/blender/storm_plates.py`, renders them reproducibly (Cycles, an equirectangular camera with
the sky's longitude and latitude ranges; the volume, moons and glow as the B render's,
`.superpowers/r7/blender/concept_home.py` run with `moon`) and a small script turns them into WebP in `src/assets/storm/`. Why not
live: a phone cannot march clouds this detailed at a steady frame rate, and the plates match the render Bob picked.
Depth comes from what the storm already has: the sky at infinity, three flats at 34, 14 and 6.5 m that drift at their
own pace and shift against each other as the camera sways, and the glass's mirror. If Bob wants live clouds later,
that is its own round.

The motion stays: the slow stir and pan, the breath, the flash every 6 s or so at a place the clock fixes
(`STORM.flash`), but fainter, as in B (about a fifth of the gold storm's), and taken from the flash plates rather than
by brightening warm pixels. The storm's levels (`STORM.sky`, the flats' `level`, `STORM_SKY.light`) are tuned again for
the new plates against the dark gate.

## The compass

- **The file** (`tools/blender/export_compass.py` → `public/models/bob-compass.glb`): rims and axis as round tubes
  (enough sides to read smooth at the home's size, today 8), smooth-shaded; the needle with a diamond section (a ridge
  down its middle) and bevelled edges; the pivot as now. Node names, UVs, the `rise` clip and what
  `tests/unit/bob/compass-glb.test.ts` pins stay; the file's budget (`COMPASS_GLB_BUDGET`, 700 kB) may rise to 900 kB
  if the round rims need it.
- **The glass** (`src/engine/bob/build/compass.ts`, high and medium tiers): smoked: its transmission keeps its
  thickness and gains a violet attenuation, so a band seen edge on goes dark violet. The marks are gold inlay: where the
  band's strip has a mark, the band is gold metal and not see-through (the strip as the metalness and transmission
  mask), with a faint glow of their own as now so they read in the dark.
- **The gold**: brushed: a slight anisotropy and a fine variation in roughness, so its highlight streaks and breaks up.
- **The light on it**: the room (`src/engine/bob/build/room.ts`) gives the soft highlight seen in the render, never
  white on the glass; a pale violet card behind for the moon's rim.

## The tower

- **The boards** (`src/engine/bob/build/plate.ts`): a glossy lacquer (a full clear coat, nearly smooth) over the print,
  the print still glowing a little as now.
- **The lips**: round each plate's top edge a polished gold lip and round its bottom edge a brushed steel one (thin
  tori hugging the edge, as in `world-new.png`).
- **The parts**: box-shaped parts get rounded edges on the high tier (rounded boxes), as the render's bevels.
- **The metal**: gold and steel brushed as the compass's; plate edges metallic, a little rougher than the lips.
- **Behind it**: the moonlit storm at its tower level and the gas as now.
- **Its light**: the room as now and, if the boards and lips do not read without it, one soft key from the front left
  above, as the render's, under the dark gate.

## Tiers

High: all of the above. Medium: all but the rounded parts. Low: today's look (no transmission, plain parts), with the
new plates (they cost no more to draw than the old ones).

## Proof

- Unit tests for every number and choice above that code holds (plates present and loaded with their alpha, the flash
  taken from the flash plates, the compass glass's attenuation and inlay mask by tier, the lips per plate, rounded parts
  by tier, the GLB's rims smooth within budget).
- The proof harness's storm, stills and luma steps pass with the new plates; the full harness and the suite are green.
- A review page with the site's own stills beside the renders Bob picked (home, the fall, the tower, a project open,
  on a laptop and a phone), and a short live link, before anything is merged.

## Left to the builder

The plates' resolutions and WebP quality within about 1.2 MB for all five; the number of tube sides and the needle's
exact section within the budget; the attenuation's distance and colour, the anisotropy, the lacquer's roughness, the
lips' size, the rounding radius; the new storm levels and the flats' `foot` on the bank plate; the tower's key light
if any; all against the render and the dark gate.

## Build notes (2026-10-30)

- **The plates** (`tools/blender/storm_plates.py`, `tools/storm_webp.mjs`): Cycles, 128 samples, OptiX denoised, about
  1 to 5 minutes each on the RTX 4080. Rendered at exposure +1.2 (the flash plates at -0.4): the moonlit clouds were so
  dark that 8-bit WebP would have banded them; the site's levels bring them down. Lit from behind alone, the clouds
  round the panorama showed their dark sides, so a soft third moon comes from behind the compass; a broad noise breaks
  the storm into separate towers with sky between. Sizes: wall 50 kB, sea 50 kB, bank 1008 kB (its alpha is most of
  it), wall flash 14 kB, bank flash 21 kB: 1143 kB of the 1.2 MB.
- **The levels**: the sky's light 1.5 (was 2), the sea of storm at 0.55 of it (the brightest plate); the start screen
  0.85 as before; the fall 0.18 (was 0.25); round the tower 0.08
  (was 0.45): looking down on the stack the camera sees the rendered sea of storm, brighter than the painted one, and the
  tower alone already reads 0.091 of the 0.11 gate; so the storm now dims over the drop rather than rising. The flats a
  fifth darker (0.68, 1.04, 1.36), their feet as before. The flash's gain 0.6: a faint gold glow inside one cloud
  (`.superpowers/stack-8/flash-pair.png`). The first full proof found the start screen with the pointer moved (0.116),
  its look to the right (0.115), the fall under the first fact on a phone (0.112 of 0.10) and a Q&A still on a phone
  (0.120) over their gates; with these levels and the moon card below they read 0.105, 0.104, within, within. The
  second full proof found the phone's first fact still at 0.107 (its strip under the line, as the light begins to fall,
  looks down through the glass onto the sea at full level); the sea's own factor brought it within. The storm
  draws about 22 frames a second alone in the proof browser.
- **The compass file**: Blender's curve bevel gives 4 + 2 × resolution sides, so the old rims were six-sided, not
  eight; they are 16-sided now (`RIM_RES` 6). The needle's diamond section has each corner rounded by two facets (a
  bevel modifier cut its slim tip short). The pivot is a little coarser (40 × 20). The file is 890 kB; its budget rose
  from 700 to 900 kB.
- **The compass's materials**: the glass's light goes violet over 0.08 m where it sees through (high, medium); the marks
  are gold metal, rougher (0.3) and let no light through; the gold is brushed on high and medium: anisotropy 0.5 along
  tangents round each part's own axis, its roughness in fine rings between 0.16 and 0.3 (`src/engine/bob/build/brushed.ts`,
  a shader patch, since the tubes carry no UVs and the file has no room for them). The room's back card is the moon's,
  lilac, at 0.36 (the violet one it replaced was 0.6; lilac is paler). No white patch shows on the glass: the proof's
  glare guard reads 0% of the compass's box near white.
- **The tower**: a full clear coat at 0.05 on the boards; gold and steel lips (tube 0.022 m) round each plate's top and
  bottom edge, brushed on high and medium; the box parts rounded (0.006 m, 2 segments) on high. No key light was needed:
  the boards and the lips read under the room's light.
