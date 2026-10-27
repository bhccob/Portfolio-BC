# The 3D world: a nebula you fly through, and beads that float and open

**Status:** revision 2, after Bob saw the first mock-up (2026-10-27); approved with everything after it: "just continue
i give you all permission ill be afk, i approve everything". Revision 1 (the nebula as a far backdrop, the beads' gold)
was approved and mocked up on `nebula-mock`; this revision keeps its picks and adds what he asked for after seeing it.
With his blanket approval the second mock-up is folded into the build (my call): the build's own stills and videos are
his review, as the mock-up's would have been, and nothing is merged or pushed without him.

**Builds on:** `2026-10-27-bob-light-path-design.md` (the light's path through the projects; this revision removes its
circling and its scrolled inside) and `2026-10-27-bob-engraved-way-design.md` (the fall's shaft, the trips' engraved
lines, the tail and its sparks), all merged locally into `redesign-bench` (e750b03). This round is on `bob-nebula`.

## Why

Bob, on his own Higgsfield frames: the space around the beads looked "much cooler and more detailed"; he wants "a
dimension like the higgsfield pic i send" and "the beads to be detailed 3D and the gold structures". After the first
mock-up:

- "the dimension still doesnt look like the picture i provided (the nebula) since the cloud like thing is only in the
  background 2D instead of 3D";
- "the background of the light should also change to a better background dimension" (the fall);
- "the beads looks like 2d only and not interactive"; asked what a bead should do: "that it can move a bit and also see
  the whole bead floating";
- "the light doesnt need to flow around the bead since it takes too much time and that it doesnt force the user to look
  inside the bead"; asked what a click on a bead should do: "take them inside first".

He agreed (in chat) to each part as played back below, and to my calls marked as mine.

## What he picked

The pictures are in the main checkout's `.superpowers/project-space/` (not tracked):

- **The dimension:** his nebula frame (`refs/ref-3.webp`), over the gold city (`refs/ref-4.webp`).
- **How much of it: "quiet"** (`concepts-1/1-circling-quiet.png`): dark violet nebula, fine stars, a little gold dust, a
  few engraved gold bands far behind; the bead clearly the brightest thing. Over the rich version.
- **The beads' gold** as in `concepts-1/4-bead-close.png` and `5-arrival.png`: a thick polished gold frame round the
  porthole with engraved scale marks, an engraved gold band round the middle.
- **The look back** as in `concepts-1/3-look-back.png`: a thin engraved ring round each bead.
- The first mock-up (`nebula-mock`, its review at `review/review.html`): kept as the starting point for brightness (0.04
  to 0.07 where the site's limit is 0.11), the bands, the gold and the dim waiting bead.

## Goals

1. **The nebula is 3D, all around.** Clouds stand in the space as shapes of their own, near and far, round the beads
   and between them, not painted on a far shell. On every trip the light and the camera fly through them: near clouds
   slide past fast, far ones slowly, and now and then one drifts in front of a bead and clears. Fine stars and gold dust
   at many depths, and a few engraved gold bands far behind (they come in once the light has left the fall, turn slowly
   with the scroll, and stand still at rest). Quiet: the bead the light is at stays the brightest thing.
2. **The fall goes through the same nebula.** As the light drops, clouds rush up past it, so the fall reads as a fall
   through a dimension, not through the dark. The compass's shaft (its throat of engraved rings) stays round the light at
   the fall's start, as approved; the hall's wide rings and the violet band give way to the clouds (my call). The five
   facts, the tail and its sparks do not change, and the picture behind each fact's words stays dark enough to read.
3. **No circling.** On each trip the light flies straight to the project's bead and comes to rest beside it: the arrival.
   The next scroll goes on to the next project. There is no orbit and no scrolled inside: the way from project to project
   is about 2.5 screen heights of scrolling shorter for each one. The bead's gold veins light up as the light comes to
   rest beside it (my call: from the side the light arrives on).
4. **The beads are detailed 3D,** real shapes in the beads' own file (`public/models/bob-beads.glb`, made by
   `tools/blender/export_beads.py` with `bead_kit.py`): the thick gold frame round the porthole with engraved scale
   marks, the engraved gold band round the middle, the lacquer, veins and porthole glass as today, the warm glow inside
   from the bead's own light (no new lights).
5. **The bead floats, and moves a bit for you.**
   - At its arrival the camera stands back enough to show the whole bead, floating with space round it, its label
     beside it.
   - It floats: a gentle drift up and down and a slight sway.
   - On a laptop, with the mouse over it, it turns a little toward the pointer (my call: up to about 12 degrees), so its
     side, the band curving round and the light sliding over the glass and gold show; it eases back when the pointer
     leaves.
   - On a phone, a finger dragged on the bead turns it a little the same way, and it eases back when the finger lifts.
   - My call: the floating runs for a while after the light arrives and whenever the mouse moves or the screen is
     touched, and settles after some seconds of nothing, as the home's needle does (`IDLE_SECONDS`, 12 s), so the canvas
     still sleeps at rest.
6. **A click (or a tap) on a bead or its label takes the visitor inside it.** The camera flies through the porthole; the
   project's objects build and its touch points show, as the scrolled inside does today. Inside, two clear buttons: one
   opens the project's page, one goes back out (my call: big and obvious, usable with one thumb). Esc, a scroll, or the
   browser's Back also go back out; the camera flies back to the arrival. Getting out must never be hard.
7. **The bead ahead waits dimly lit, not black** (from the first mock-up): on the nebula a black bead reads as a hole.
8. **The look back** shows the whole way in the nebula, each bead with its thin engraved ring.

## Non-goals

- The project page's own look and text, and its way back: the next round (Bob's own order: "Start with the 3D world").
- No change to the home, BOB from above, the facts' words, the tail and sparks, the trips' engraved lines, the labels'
  words, the credits, 3D off and the fallback card.
- Not the gold city, not the rich version, no beads in the distance on the way.

## Anti-goals (a failure even if it works)

- **Busy.** One place for the eye: the light, and the bead it is at. Clouds in front of a bead are thin and pass.
- **Brighter than the home's dark look:** every still on the way keeps the luma gate (0.11); the build aims at the
  first mock-up's 0.04 to 0.07.
- **A fact or a label harder to read.**
- **Stuck inside a bead,** on any device.
- **Moving at rest for ever:** the canvas sleeps once nothing has happened for a while.
- **A phone that stutters:** on the medium tier the clouds thin out before the frame rate drops.

## Constraints

- Dark, calm, one focal point (Bob's standing rule).
- Reduced motion: no floating and no turning; the inside opens and closes by the step fade; the stops are the facts,
  each arrival, the look back and the credits.
- The skip button, Back to a project's arrival, the landing hold while the beads load, and Way 2 (up to five projects)
  keep working with the new path.
- No large new downloads (my call): the clouds come from shaders, sprites and points; the beads' file stays under about
  1.6 MB.
- The proof harness is updated for the new path (no orbit, no scrolled inside, the click-to-inside and both ways out).

## Left to the builder

How the clouds are made and how many; the fall's clouds' speed; the float's size and pace and the turn's limit; the
camera's distance at an arrival; the inside's two buttons' place and words (my proposal: "Bekijk project" and "Terug",
"View project" and "Back"); the window over which the hall's rings and the band give way to the clouds; the engraving's
pattern on the frame and band; whether the thin gold halo round each bead's outline stays; the medium tier's thinning.

## How it gets made

1. A build plan, and the build on `bob-nebula`, inline (no subagents), test first, the proof harness updated.
2. A review page for Bob with videos at both sizes and stills beside the concepts and the first mock-up; nothing merged
   or pushed without his word.
