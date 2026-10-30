# Round 6: the storm behind everything

Bob, 2026-10-30, after round 5 went live (8ac4429):

> good now i want the background dimension too look more 3d and intimidating and cinematic including the start screen
> like so its not a static background

He picked, from three concept stills (A deep space, B storm nebula, C colossal ring; `.superpowers/bg-review/`),
"B · Storm nebula": towering dark clouds lit from within by gold. Shown a code-built cloud try beside the concept, he
picked "Painted storm, animated": painted plates made to match B, in depth layers that drift and shift, with gold
flashes. Shown that running on the start screen (a throwaway spike, `.superpowers/bg-review/storm-spike-b.png`) he
said "Yes, finish it": carry it through the whole site, the start screen, the fall and the tower.

## The plates

Two paintings made with GPT Image 2.5 (Higgsfield) from concept B, 2688 × 1152, as WebP in `src/assets/storm/`:
`storm-wall` (colossal violet and black clouds towering from a low horizon, gold light inside, near-black space with a
few stars above) and `storm-sea` (a sea of the same storm seen from above). No text, no objects.

## What is built

1. **The sky** (`src/engine/bob/build/storm.ts`): a great sphere round the camera, drawn first and behind everything
   (no depth written), so it stands at infinity wherever the camera goes: the wall above the horizon, the sea below,
   each stirred in place by the noise the gas uses, panning very slowly, a second larger copy drifting over each for
   depth; a slow breath. Real geometry, so the start screen's glass mirrors it. At the start screen what lies below the
   horizon past the glass's edge is kept near black (`horizon`), so the glass's far edge draws no line.
2. **The flats** (the same module): at the start screen, three painted flats curved round behind the compass and
   standing on the glass, 34, 14 and 6.5 m out, each showing a part of the wall plate, the black between the clouds let
   through; each drifts at its own pace, so when the camera sways with the pointer they shift against each other. The
   glass mirrors them. They go as the camera rises to look down on the name, and are not there in the void.
3. **The flash** (`src/scene/bob/storm.ts`, pure): every 6 s or so, at a place fixed by the clock, a gold flash lights
   the warm parts of the storm round it, sometimes twice.
4. **The levels** (the same pure module): the start screen whole; the flats out over the first half of the rise; the
   sky dimmed to a backdrop in the fall and round the tower (the gas, the stars and the tower in front of it), quieter
   with a project open.
5. **Motion and the loop**: the storm's clock runs while the home page shows it, at 30 frames a second when nothing else
   moves (the canvas otherwise drawing on demand); with reduced motion, on the low tier, behind a page of text, in a
   hidden tab it stands still and the canvas sleeps as before.
6. **Loading**: the plates load once the home has landed, never holding the loader; the storm fades in over 1.5 s once
   both are in.

## The proof harness

The checks that an idle home draws nothing become: an idle home draws the storm at a gentle cadence (no more than 35
frames a second) and the picture changes; with reduced motion it draws nothing. A new step reads the storm on the
start screen, in the fall and at the tower (its debug levels, a still that changes over 3 s, the luma gates).

## Calls of mine

The sky's level in the void (0.35), the flats' radii and plates, the flash's period, the 30 fps cadence, and the low
tier standing still.

## Build notes (2026-10-30)

- The sky is a skybox (drawn at the far plane: the camera sees only 100 m), not a great sphere; the flats stand after
  the glass in the draw order so the glass in front hides their feet.
- The plates' middles stand on the horizon, mirrored past their ends: the fall looks level, and saw only their dark
  foot and far edge.
- The levels, measured against the dark gate (a still's mean luma at most 0.11): the start screen 0.85 with the flats
  at 0.85 / 1.3 / 1.7 (its stills 0.108 at most); the fall 0.25 (way frame 60 at 0.106, looking level into the storm's
  middle); round the tower 0.45 (at 0.25 it barely showed behind the gas; its stills 0.094 at most), eased up from the
  fall's over the drop. The design's single 0.35 backdrop did not hold both.
- The storm alone draws about 22 frames a second in the headless proof browser (STORM.fps 30 asked for).
- The proof harness counts drawn frames from the storm (`journey.storm.frames`): R3F asks for more than one animation
  frame as it starts and stops, so window.__allRaf no longer measures how often the canvas draws.
