# The hologram world: the projects on a powered board, one area per category

**Status:** approved by Bob on 2026-10-27 in three steps: the direction ("an 'hologram' tech world with the nebula idea
where they can see most of my project and when they scroll project will be in other area 'category' something like the
link website i sent"), the four concept frames ("Yes, this direction fits. Make the moving 3D mock-up."), and the moving
mock-up ("Yes, this is right. Write the plan to build this world into the site in place of the beads' path, and show me
the plan first."). Nothing is built until he has read the plan.

**Builds on:** `2026-10-27-bob-nebula-space-design.md` (the 3D nebula, the fall through it, the way into a project by a
click and every way back out), built on `bob-nebula` (through 487d73e), not merged. This round replaces that round's
beads and their path; it keeps its nebula, its fall and its way in and out. It is built on a new branch, `bob-world`,
from `bob-nebula`, so merging the two is one decision for Bob, later.

## Why

Bob, after the 3D world round: "its better but its hard to find the right fit for the project area". He pointed to
overworldaudio.com: one "static" 3D place where all the work can be seen and clicked, and a project, once clicked, "so
clean and informative and easy to see". His own picture: a CPU on a dark violet board, its gold-edged lid lifted, the
die in four glowing quadrants with touch points, "cpu being the core to power everything in this dimension and compass
maybe?"

## What he approved

- **The concept frames** (the main checkout's `.superpowers/brainstorm/200-1793084968/content/holo-1-overview.png` to
  `holo-4-phone.png`): the round hologram board in the nebula, the CPU at its centre with the compass on its lid, the
  light falling into it; an area per category after a scroll; a project opened like Overworld's; the phone version.
- **The moving mock-up** (`.superpowers/holo-world-mockup/` in the `bob-dive` worktree, served on 4439; its review with
  four videos in `.superpowers/holo-world-review/` on 4440). The mock-up's look, camera, timing and words are the
  reference for this build. Its code is throwaway: the build is written test first into the site's own modules.

## Goals

1. **The light powers the world.** The fall stays as it is, with Bob's five facts. Past the last fact the light falls on,
   straight down into the CPU at the centre of a round hologram board below the fall. As it hits, a short flash; the
   current runs out along the board from the middle, its rings and the projects' pads light, and the projects appear on
   their pads. The light stays: its tail stands above the CPU as a still column of light (the mock-up's beam), the one
   bright thing in the world.
2. **The whole world in one view.** The camera comes down out of the fall and settles on the board seen from above at
   an angle, all of it in view with dark nebula round it: the CPU in the middle, the projects round it, each with its name
   on a thin gold line. This is a stop on the scroll (the world). A hint below says how to go on.
3. **A scroll goes to the next area, one per category.** The site's categories (`src/data/categories.ts`: 01 — Beveiligd
   element, 02 — Frontpaneel, 03 — Oscillator; English: Secure element, Front panel, Oscillator) each have an area on the
   board. Each scroll takes the camera round the board, never across the CPU, to the next area: its project in front, the
   CPU and the light behind it, and at the bottom left the category, the project's name and "Klik om te openen". Dots on
   the right show which area is in view and go to an area when pressed. Each area is a stop.
4. **The look back.** After the last area a scroll pulls the camera back and up: the whole world small in the nebula, the
   light falling into it. Then the end page, as today.
5. **A click opens a project, Overworld's way.** A click or tap on a project, on its name or on its area's words: the
   camera flies to it (round the board when it is on the other side), the rest of the world dims, and the project opens:
   - Funcial: the chip's lid lifts off its die of four glowing quadrants;
   - Jontai Energy: the solar module's 16 cells light one after another;
   - Cookies Clicker: the crystal brightens, the gears tick once a second;
   - its touch points (the site's own, `src/data/projects.ts`) on thin lines, in two neat columns beside it.

   Beside it (on a phone, below it): the category, the name, the line about it (the project's `summary`), the role and
   the year, and one button, **Bekijk project**, to the project page. Below: **Terug** at the left; at the right two arrows
   and "1 / 3", which go to the next or the previous project without going back first.
6. **Getting back is never hard.** Terug, Escape, a scroll, a swipe or the browser's Back return to where the visitor
   was. Back from the project page returns to the open project, and Back again to where it was opened from.
7. **Dark, calm, one focal point.** The board is dark glass with fine light; the CPU and the light are the brightest
   things; an open project is the one bright thing in its view. Every picture stays within the site's darkness limit.

## Non-goals

- The project pages' own look, text and way back: the next round, as Bob asked.
- No change to the home, BOB from above, the fall and its facts, the tail and its sparks, the end page, the menu, 3D off,
  the fallback card or the Lite page.
- The Overworld site's look itself (its sound, its layout): only its idea of one place and a clean opened view.
- No new 3D files: the world is made in code, as the mock-up's is.

## Anti-goals (a failure even if it works)

- **Busy:** a board full of bright lines; more than one bright thing in a view.
- **A camera that cuts across the CPU** or passes through an object between two stops or two open projects.
- **Stuck in an open project,** on any device.
- **Words off the screen or over each other:** a name, a caption, a touch point or the panel's text, on a phone too.
- **Moving at rest for ever:** the canvas sleeps when nothing has happened for a while.
- **Brighter than the site's dark look.**

## Constraints

- The darkness limit: every still at a stop, mean luma 0.11 at most (the mock-up's brightest, the Cookies Clicker area
  on a phone, was 0.110); an open project 0.15 at most.
- Reduced motion: the stops step by the step fade as today; the power comes on as a fade; no float, no ticking, no
  glides; a project opens and closes by the step fade.
- The canvas sleeps: the float, the pads' turning rings, the current's pulse and the gears run on the clock only for
  `IDLE_SECONDS` (12 s) after the last input or arrival, then stand still.
- The landing hold, the skip button, Back to a project's place, the language switch and up to five projects on the way
  (`PATH_LIMIT`) keep working.
- Dutch first, English at /en/; never a fact about Bob that is not in the site's data; the Cookies Clicker classmate is
  never named.
- No subagents; nothing merged or pushed without Bob's word.

## What goes and what stays

- **Goes:** the beads and their file (`public/models/bob-beads.glb`), their float, wake, rings, gold and labels; the
  light's trips between beads and their engraved lines; the look back's line of the way and its far lights.
- **Stays:** the fall, the facts, the light with its tail and sparks, the compass's engraved shaft at the fall's start,
  the 3D nebula (its clouds laid out anew round the world), the click-to-open machinery and every way out (the history
  state, Escape, scroll, swipe, Back), the end page.

## Decided for the builder (my calls, shown to Bob in the mock-up)

- The board: about 4 m across (radius 4), dark glass; the circuit drawn in three layers of light (the three buses from
  the CPU to the areas, where the current runs; fine traces; rings and the compass scale round the rim); a second, fainter
  rim below it.
- Where the world is: the board lies level, its centre straight below the light's place at the fall's hand-over (way
  frame 256), far enough down that the whole fall stays above it (about 9 m); the light falls on along that line.
- The areas' places: Beveiligd element to the left, Frontpaneel to the right, Oscillator behind the CPU, as in the
  mock-up. The scroll visits them in the categories' order (01, 02, 03), and the arrows go through the projects in that
  order too. A category with no project on the way has no stop and its pad stays dark. A second or third project in one
  category stands beside the first on that area (1.3 m apart), and the area's view frames them all. A project that is not
  on the way (past `PATH_LIMIT`) is not on the board; the menu and the Lite page still reach it.
- The skip button shows from the world through the look back's stop, as it showed from the first bead, and goes to the
  end page.
- The objects: Funcial's chip with a lock on its lid, Jontai Energy's solar module, Cookies Clicker's crystal and two
  gears, each turned a little toward where its views stand; any other project gets a plain chip.
- The camera's places, framing and pace: the mock-up's, as functions of the screen's shape.
- The words: the mock-up's, in Dutch, with English beside them ("Scroll of klik op een project" / "Scroll or click a
  project"; "Klik om te openen" / "Click to open", "Tik om te openen" / "Tap to open" on a touch screen; "Terug" / "Back";
  "Bekijk project" / "View project").
- A project opens wherever the scroll rests and the project is in view: the world, any area, the look back. While the
  camera is moving between stops, a click does nothing.

## Left to the builder

The exact numbers of the scroll's lengths, the flash, the pace of the current, the dimming, the clouds' new layout, the
column layout's spacing; the names of the new modules; how the old modules are removed.

## How it gets made

1. A plan (`docs/superpowers/plans/2026-10-27-bob-hologram-world.md`), read by Bob before anything is built.
2. The build on `bob-world`, inline (no subagents), test first, the proof harness updated.
3. A review page with videos at both sizes and stills beside the mock-up's; nothing merged or pushed without his word.
