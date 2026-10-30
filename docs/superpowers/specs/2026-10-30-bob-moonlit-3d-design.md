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
