# The engraved way: a slower fall, and new backgrounds for the fall and the trips

**Status:** approved by Bob in chat on 2026-10-27 (his picks below), as pictures; this document awaits his OK. A 3D
mock-up and video come before any build, as for the light path.

**Builds on:** `2026-10-27-bob-light-path-design.md` (the light's path through the projects, built on `bob-dive`) and
`2026-10-25-bob-light-dive-design.md` (the fall with Bob's five facts).

## Why

Bob, after seeing his own earlier Higgsfield frames again: the space around the beads in those frames looked "much
cooler and more detailed" and "alive" than the site's. He wants the light's trip to each project to cross a world of its
own, not the same space the beads stand in. And the five facts beside the falling light "just go by too fast" to read.

## What he picked

The pictures are in the main checkout's `.superpowers/travel-concepts/` (not tracked):

- **The trips between projects: B, "the engraved orbits"** (`B-engraved-orbits.png`). Fine engraved gold orbit lines,
  with small tick marks like the scales of an astrolabe, curve through the violet nebula; the light rides along one of
  them, its trail following the curve, and the line leads it to the next bead.
- **The fall: F2 opening into F1** (`F6-fall-start-shaft.png`, `F6-fall-end-rings.png`). The fall starts inside the
  compass: the light drops down a deep round shaft whose walls are tightly stacked engraved gold rings, each catching the
  light as it passes, the compass's glow above. Lower down the shaft opens out, its rings spreading apart until they float
  as separate orbit rings in open nebula; the last ring's curve becomes the orbit line that leads to Funcial, where the
  trips (B) begin.
- **Slower, without pauses.** The fall takes more scroll, so each fact stays on screen longer for the same scroll. The
  light does not stop at the facts.

He declined, for now: the circuit city (A), the board (C), the ring tunnel (D), the nebula fall (F3), and facts engraved
on the rings (F4); the facts stay as text beside the light.

## Goals

1. **The fall runs twice as long in scroll** (my call: twice; one constant to tune after the mock-up). The fall's frames,
   the light's places, the facts and their sides stay as they are: only the scroll each frame takes grows, so every fact
   is on screen for twice the scroll.
2. **The fall's background: the compass shaft opening into orbit rings,** built around the light's own fall, in 3D: the
   camera moves through it as it moves today, and the rings catch the light as it passes. Seen from the camera's place in
   the fall, the shaft frames the light; it opens out over the fall's last part, before the hand-over to the path.
3. **The trips' background: the engraved orbit lines,** in 3D along each travel: the line the light rides, from the
   last bead (or the fall's last ring) to the next bead, and a few more faint orbit arcs around it for depth.
4. **At a bead** (its orbit and its inside) the engraved lines fade back into the dark, so the bead's own space is as
   approved: the circling, the label, the touch points, the inside.
5. **The look back** shows the lines faintly, so the visitor sees the orbits the light rode (my call; the way's own gold
   line stays the brightest).

## Non-goals

- No change to the home, BOB from above, the facts' words and their place beside the light, the beads, their insides,
  the labels, the touch points, the look back's framing, the skip button or the credits.
- No pause or stop at a fact; no new stops for reduced motion beyond today's (each fact's peak is already one).
- No new files to download for the backgrounds: rings and lines are geometry and shaders, as the beads' veins are.

## Anti-goals (a failure even if it works)

- **Busy.** The light must stay the one thing the eye follows: the engravings sit well under its brightness, fall into
  the dark and the fog with distance, and never flicker.
- **Brighter than the home's dark look.** The fall and the trips keep the home's luma gate (mean 0.11 at most).
- **Facts harder to read.** Nothing engraved crosses the facts' words; the shaft's rings are behind and around them.
- **A phone that stutters.** On the medium tier the shaft and the lines thin out (fewer rings, fewer arcs) before the
  frame rate drops.

## Constraints

- Dark, calm, one focal point (Bob's standing rule).
- Reduced motion: the fall is still shown at its stops (each fact's peak) by the step fade; the shaft and the lines show
  as stills there.
- 3D off, no WebGL, the fallback card: unchanged.
- The proof harness's checks of the fall (the light within 6 px of the previs data at its frames) still hold: the frames
  do not change, only their places in the scroll.
- Way 2 (more than three projects): every trip gets its own line; the look back's faint lines include every one.

## Left to the builder

The number and spacing of the shaft's rings and where it opens; the engraving pattern (scales, tick marks, small
glyphs) and how much of it each ring carries; the orbit arcs around each trip; the fade timings at the beads; how
the shaft follows the light's sideways moves toward each fact's side; the medium tier's thinning.

## How it gets made

1. A 3D mock-up in the light-path mock-up (`.superpowers/light-path-mockup`, served on 4432), with a video at both sizes
   and stills beside the approved pictures. Bob approves it before any build.
2. Then a build plan, and the build on `bob-dive`, inline, as before.

## Added after the build: the light's tail (Bob, 2026-10-27)

Seeing the built fall, Bob: "the light doesnt look like its falling since the tail sits below not above". From the
camera's turn to the side on, the previs carried the tail's points back toward the camera, which from the camera's
height drew the tail below the light. He then asked for it "bigger and longer and look more mature", and "maybe add a
few electricity sparks". He approved a mock-up of each in the engraved-mock copy ("that works"; "Yes, the tail with the
sparks is right. Build it into the site.").

- **The tail stands above the light** all the way down the fall: its points keep the height of the light's path, and
  its sideways moves toward each fact draw in toward the light over about 14 way frames, so it leans toward where the
  light came from instead of snaking.
- **Bigger and longer:** it rises about 1.6 m (it was 1.1 m), 1.5 times the light's radius wide at the light (it was
  0.5), its light gathered to its core and fading along its length. The path's tail is as long, as it already followed
  the fall's.
- **A few sparks:** three thin gold sparks, like the light's filaments, jump off the tail near the light; each flashes
  over five way frames and then jumps from another place, a third of a life apart, so one or two show at a time. They
  move by the frame alone: they crackle while the scroll moves and hold still when it rests. None on the low tier.
