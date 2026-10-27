# The nebula dimension: the space around the projects, and detailed beads

**Status:** Bob's picks in chat on 2026-10-27 (below), as concept pictures; this document awaits his OK. A 3D mock-up and
a video come before any build, as for the light path and the engraved way.

**Builds on:** `2026-10-27-bob-light-path-design.md` (the light's path through the projects) and
`2026-10-27-bob-engraved-way-design.md` (the fall's shaft, the trips' engraved lines, the tail), all merged locally into
`redesign-bench` (e750b03). This round is on the branch `bob-nebula`, cut from there.

## Why

Bob, looking back at his own Higgsfield frames: the space around the beads in them looked "much cooler and more
detailed" than the site's, which is dark with one violet mist band and gold dust. Asked what he wants a visitor to see
around a project: "just that theres a dimension like the higgsfield pic i send and the i want the beads to be detailed
3D and the gold structures".

## What he picked

The pictures are in the main checkout's `.superpowers/project-space/` (not tracked):

- **The dimension: "the nebula"** (`refs/ref-3.webp`, his own Higgsfield frame): beads floating in a deep violet nebula,
  stars and gold dust, engraved gold orbit lines sweeping through the space. He chose it over his other frame, the gold
  city (`refs/ref-4.webp`).
- **How much of it: "quiet"** (`concepts-1/1-circling-quiet.png`): a dim nebula with depth and darker gaps, fine stars, a
  little gold dust, and a few engraved gold orbit bands far behind the bead; the bead clearly the brightest thing. He
  chose it over the rich version (`2-circling-rich.png`: brighter, many large rings round the bead).
- **The beads** as in `concepts-1/4-bead-close.png` and `concepts-1/5-arrival.png` (pictures 3 and 4 on the companion
  screen he saw): a thick polished gold frame round the porthole with engraved scale marks, an engraved gold band round
  the bead's middle, the violet marbled glass with gold veins as today, and a warm glow inside.
- **The look back** as in `concepts-1/3-look-back.png` (picture 5 there): all three beads in the nebula, each with a thin
  engraved orbit ring, joined by the gold line of the way.

He approved this summary ("ok"), including the calls marked below as mine.

## Goals

1. **The space around the projects is the quiet nebula,** on every trip, in every orbit, at every arrival and in the
   look back (and under the sheet as it fades to black): layered violet clouds with depth and darker gaps, fine stars,
   a little gold dust, and a few engraved gold orbit bands far behind the beads. The bands carry the engraving the
   trips' lines already have (`src/engine/bob/build/engraved.ts`: edge lines, scale ticks, small glyphs), larger and
   fainter.
2. **It has depth** (my call): the clouds, the stars and the bands stand at different distances, so as the camera moves
   the near ones pass faster than the far ones. The bands turn slowly with the scroll (by the place, never by a clock), so
   nothing moves while the scroll rests and the canvas still sleeps.
3. **The fall stays as approved** (my call): the shaft, its rings, the five facts, the tail and the sparks do not
   change. Today's violet band shows through the fall as it does now and gives way to the nebula toward the hand-over
   (way frame 256), so the nebula is whole as the light turns toward Funcial. No seam: nothing jumps at any place.
4. **The beads are detailed 3D,** real shapes in the beads' own file (`public/models/bob-beads.glb`, made by
   `tools/blender/export_beads.py` with `bead_kit.py`), so they catch the light as it circles them:
   - the porthole's frame becomes a thick polished gold frame with engraved scale marks round it (today a flat rim);
   - an engraved gold band runs round the bead's middle, meeting the frame at its sides;
   - the lacquer, its gold veins and the porthole's glass stay as today;
   - the warm glow inside stays the bead's own inner light (my call: no new lights, so the scene's light count holds).
   Every bead gets the same detail, the three of today and any added later (Way 2).
5. **In the look back** each bead wears a thin engraved orbit ring round it, faint, as the trips' lines are there; the
   way's gold line stays the brightest line.

## Non-goals

- No change to the light's path, the camera's moves, the stops, the labels, the touch points, the bead insides (each
  project's objects), the skip button, the credits, reduced motion's stops, 3D off and the fallback card.
- No change to the fall (goal 3) or to the engraved lines the light rides between projects.
- Not the gold city, not the rich version, and no beads in the distance: only the project the light is at is in view, as
  approved for the light path.

## Anti-goals (a failure even if it works)

- **Busy.** The bead the light is at, and the light, stay the one place the eye goes. The nebula and the bands sit well
  under the bead's brightness and fall away with distance; nothing flickers.
- **Brighter than the home's dark look.** Every still on the path keeps the home's luma gate (mean 0.11 at most); the
  quiet concept measured 0.070, and the build aims near that. The insides keep their own gate (0.15).
- **A label or a touch point harder to read.** Behind a label's words the picture stays dark, as behind the facts.
- **Moving at rest.** The canvas sleeps when the scroll rests, as today.
- **A phone that stutters.** On the medium tier the nebula thins (fewer layers, fewer bands) before the frame rate drops.

## Constraints

- Dark, calm, one focal point (Bob's standing rule).
- No large new downloads (my call): the nebula is drawn from noise in shaders or soft sprites, as the haze already is
  (`src/engine/bob/build/haze.ts`); any texture it needs is small. The beads' file grows by the new gold parts only,
  their engraving baked into a small map rather than modelled groove by groove (my call); today it is 1.1 MB, and it stays
  under about 1.6 MB.
- The proof harness's checks still hold: at most one bead shown at a time on the way, every label and its side, the touch
  points, the luma gates, the canvas asleep at rest, the frame rate.
- Way 2 (up to five projects on the way): every bead and every trip gets the same look.

## Left to the builder

The nebula's technique and layers; how many bands (my guess: three to five), their sizes, tilts and distances; the
window over which the fall's band gives way to the nebula; the engraving's pattern on the frame and the band and how
the band meets the frame; whether today's thin gold halo round each bead's outline stays beside the new band (the
concepts show none); the look-back rings' size; the medium tier's thinning; whether today's ring of mist and the
mist band are folded into the nebula or kept under it on the path.

## How it gets made

1. A 3D mock-up in a throwaway copy of the site (as the engraved way's was, `engraved-mock`), with a video at both sizes
   and stills beside the concepts. Bob approves it before any build.
2. Then a build plan, and the build on `bob-nebula`, inline (no subagents), test first, the proof harness updated.
