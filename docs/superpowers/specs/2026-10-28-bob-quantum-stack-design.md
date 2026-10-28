# The quantum stack: the projects on boards threaded on a quantum spine, one board per category

**Status:** chosen by Bob on 2026-10-28, step by step:

- **The hologram world's review:** "the camera doesnt zoom specifically to one projects since its gonna be difficult to do when theres more porjects", "the plate thing has to be bigger generally and more detailed and techy", "i want the dimension and cloud to have more 3d effect on it so its more cinematic and realistic".
- **The open, in words:** a project rises to one spot in front of the camera while the camera stays ("yes thats what i meant").
- **The second mock-up:** "solid but they look too compact and close to eachother", names "only when user hover over the item", "maybe something better than a board?".
- **Three rounds of concept pictures:** "none of them really they dont have the techy look"; "im stuck between G and E and also the quantum core can be good just not the current design"; then "K does look the best for me".
- **Concept K's mock-up:** Funcial need not sit by the CPU ("thats the chip to power it"), "cant the board generally be bigger", "maybe also with an exploding", and a look at the city.
- **The choice:** the stack and the city side by side, then "The stack (K)".

Nothing is built until he has read the plan.

**Builds on:** `2026-10-27-bob-hologram-world-design.md`, built on `bob-world` (through ad432ff), not merged. This round replaces that round's round board and its camera flight into a project. It keeps the fall, the facts, the light with its tail, the click-to-open machinery and every way out, the panel, the touch points, the arrows and the end page. It is built on a new branch, `bob-stack`, from `bob-world`, so merging is one decision for Bob, later.

## The reference

- **Concept K** (`.superpowers/holo-world-2-review/concepts/k-quantum-spine.png` in the `bob-dive` worktree): detailed circuit boards threaded on a dark quantum spine, the CPU with the compass on top.
- **The mock-up Bob chose:** K's second version, `.superpowers/holo-world-4-mockup/` (served on 4445). Its review is `.superpowers/holo-world-2-review/compare/` on 4443, beside the city he did not choose. Its look, sizes, camera, timing and words are the reference for this build. Its code is throwaway: the build is written test first into the site's own modules. The mock-up's `plate.ts`, `spine.ts` and `volume.ts` are the closest reference for the new builders.

## Goals

1. **The light powers the stack.**
   - The fall stays as it is, with Bob's five facts.
   - Past the last fact the light falls on, straight down into the CPU, which sits alone on a small power board at the top of the stack.
   - As it hits, a short flash. Then the closed stack explodes open, like an engineering exploded view: the boards slide down apart to their places, the spine stretches out between them, and dashed gold guide lines run from rim to rim.
   - The power runs down the spine, board by board, lighting each board's buses from the middle out.
   - The light stays on the CPU as a still column of light.
2. **The whole machine in one view.**
   - The camera comes down out of the fall and settles on the whole stack, seen from the front and a little above, with dark nebula round it.
   - This is a stop on the scroll (the world). A hint below says how to go on.
3. **A scroll goes board by board.**
   - Each category on the way (`src/data/categories.ts`, in number order) has its own board below the power board.
   - Each scroll takes the camera down to the next board. It is seen from just under the board above it, so no board covers another. The whole board is in view on a laptop; a phone shows the board's middle with its sides running off the screen.
   - At the bottom left: the category, its projects' names (each one opens its project), and "Klik om te openen".
   - The dots on the right show which board is in view and go to a board when pressed.
   - Each board is a stop.
4. **The look back.** After the last board a scroll pulls the camera back and up: the whole machine small in the nebula, the light falling into it. Then the end page, as today.
5. **A click opens a project in place.**
   - What opens it: a click or a tap on a project, or on its name in a caption, at rest.
   - The camera stays where it is. The project lifts off its socket and rises to one spot in front of the camera, tipped toward it. A faint beam rises from the spine at its own board, as if the machine projects it. The rest of the machine dims, and the empty socket glows, waiting.
   - It opens as it does now: Funcial's lid lifts, Jontai Energy's cells light, Cookies Clicker's crystal and gears.
   - Beside it: its touch points in two columns and its panel (on a phone, below it), with Terug and the arrows with "1 / 3".
   - The arrows send the open project back to its socket as the next one rises into the same spot, from whichever board it is on. The camera stays.
6. **Names only under the mouse.**
   - A project's name, on its thin gold line, shows only while the mouse is over the project or over its name in a caption.
   - A touch screen has no hover, so there a board's names show at its stop.
7. **Room for more projects.**
   - A board takes its category's projects round the spine, 4.4 m out and 3.4 m apart along that ring.
   - The stack takes a board per category on the way.
8. **Techy, solid boards.** Each board is a thick round circuit board:
   - its layers show at the edge;
   - a glossy dark solder mask over raised copper, bare gold pads and white print, with its category's name along its rim and a compass scale;
   - several hundred 3D parts;
   - big parts that read from afar: processors under finned heat sinks on their own buses, rows of standing memory modules, big capacitors;
   - a bus from the spine to each project's socket.

   The power board carries the CPU, its socket frame, and its ring of capacitors and chokes.
9. **The dimension in 3D.** The flat cloud cards are replaced, everywhere the nebula shows (the fall included), by a volume of gas the picture looks into:
   - dark dust lanes that hide what is behind them;
   - edges lit faintly by a far light and, near the machine, by the CPU's gold;
   - a slow drift;
   - near clouds that pass in front of far ones as the camera moves;
   - a clear space round the machine and along the camera's line to what it looks at.
10. **Getting back is never hard.** Terug, Escape, a scroll, a swipe or the browser's Back close the project, as today. Back from a project page returns to the open project, and Back again to where it was opened.
11. **Dark, calm, one focal point.** The CPU and the light are the brightest things at rest; an open project is the one bright thing in its view.

## Non-goals

- The project pages' own look, text and way back: the next round.
- No change to the home, BOB from above, the fall and its facts, the tail and its sparks, the end page, the menu, 3D off, the fallback card or the Lite page.
- The chip city (Bob chose the stack); the mock-ups' stand-in projects (`?more`).
- No new 3D files: the stack is made in code, as the mock-up's is.

## Anti-goals (a failure even if it works)

- **A board covering the board in view** at its stop, or the camera passing through a board's slab or the spine.
- **The camera moving when a project opens** or when the arrows swap projects.
- **A name on the screen with no pointer on its project** (on a mouse screen).
- **Busy or bright:** more than one bright thing in a view; any still past the darkness limit.
- **Stuck in an open project,** on any device.
- **Words off the screen or over each other**, on a phone too.
- **Moving at rest for ever:** the canvas sleeps when nothing has happened for a while.
- **A stuttering picture:** the 3D nebula too heavy for the device it runs on.

## Constraints

- **The darkness limit:** every still at a stop, mean luma 0.11 at most; an open project 0.15 at most. The mock-up measured at most 0.079 at a board and 0.077 on a phone.
- **Reduced motion:**
  - the stops step by the step fade, as today;
  - the explode and the power come on as a fade;
  - no float, no ticking, no drift of the gas;
  - a project lifts and opens, and sinks and closes, by the step fade.
- **The canvas sleeps:** the float, the pulse, the sockets' rings, the gears and the gas's drift run on the clock only for `IDLE_SECONDS` (12 s) after the last input or arrival.
- **The 3D nebula's cost** steps down with the quality ladder (`src/engine/quality.ts`):
  - high: drawn at half the screen's size;
  - medium: at a third, with fewer steps;
  - low: no gas, the stars and the dust only.
  - It never steps up again, as the void does.
- **Kept working:** the landing hold, the skip button, Back to a project's place, the language switch, and up to five projects on the way (`PATH_LIMIT`).
- **Words and facts:** Dutch first, English at /en/; never a fact about Bob that is not in the site's data; the Cookies Clicker classmate is never named.
- **How it is built:** no subagents; nothing merged or pushed without Bob's word.

## What goes and what stays

- **Goes:**
  - the round board and its circuit, and its ring of areas round the CPU;
  - the camera's flight into a project's close view;
  - the names shown at the world's stop without the pointer on them;
  - the cloud cards (`cloudLayout` and the clouds' atlas in `nebula.ts`).
- **Stays:**
  - the fall, the facts, the light with its tail and sparks, the CPU with the compass, the projects' objects;
  - the click-to-open machinery and every way out (the history state, Escape, scroll, swipe, Back);
  - the panel, the touch points' columns, the arrows, the caption and the dots;
  - the nebula's stars and dust, and the end page.

## Decided for the builder (my calls, in the mock-up Bob chose)

- **The stack's sizes, m.**
  - The power board: radius 3.8, the CPU at its middle.
  - Each category board: radius 6.2, a hole of 1.4 for the spine, 0.2 thick.
  - The boards' tops lie 5.6 apart, below the power board.
  - Each project floats 0.62 above its socket at 1.9 times its object's own size.
- **Where the stack is:** the power board's centre is where the round board's was (`boardCentre()`, straight below the light's place at the fall's hand-over), so the light falls on along the same line.
- **Which way each board faces:**
  - The category boards face the camera alternately 32° to the left and to the right, so the way down zig-zags a little.
  - A board's projects stand on the side it faces.
  - One project stands in the middle of that side; more stand 3.4 m apart along the ring.
- **The explode:**
  - Closed, the boards lie 0.32 m apart under the power board.
  - They open over the land, after the hit and before the world's stop, easing to their places. The spine's spans stretch with them.
  - Eight dashed guide lines run between each pair of boards.
  - The power reaches each board a little after the one above it.
- **The camera:**
  - At the world's stop: from the front, 30° above on a laptop and 26° on a phone, the whole machine framed.
  - At a board: from where its projects face, 17° above on a laptop and 14° on a phone, looking at the board's middle, the whole board framed on a laptop and its middle on a phone.
  - At the look back: far back and up.
  - Between stops the camera goes round the stack's axis, as it went round the board.
- **At a board's stop**, the other category boards step back to 45% of their light and the power board to 70%; a board's projects light as their board does.
- **The open spot:**
  - On a laptop: right of the middle (screen x +0.3, y +0.16 in the screen's -1..1), half the screen's height across, at a third of the camera's distance to what it looks at.
  - On a phone: at the top middle (y +0.42), at most two thirds of the width and a third of the height across.
  - Tipped 0.42 rad toward the camera, turning a little to and fro.
  - It rises over 1.5 s on a curve up off its socket first; it opens once it is nearly there; it sinks back over 1.3 s.
  - The panel and the touch points are placed from the object where it stands.
- **The boards' detail:** the mock-up's (`plate.ts`), drawn on canvases at 2048 px (1024 on the lower tiers), with fewer small parts on the lower tiers.
- **The spine:** the mock-up's (`spine.ts`):
  - dark flanges with gold lips;
  - 24 cable bundles of four, bowing out between boards;
  - gold connectors round the flanges;
  - a glass core with violet light and the gold light down its middle;
  - a violet lamp in each span, lit as the power reaches it;
  - a tapered tip under the last board.
- **The reflections:** the metal and the gloss reflect a soft room turned with the camera round the stack's axis, so no side of the machine flares.
- **The 3D nebula:** the mock-up's (`volume.ts`):
  - a 64³ tiling noise;
  - a march of up to 84 steps;
  - a fixed, even scatter of each ray's samples;
  - a soft blur;
  - laid at the far plane over the stars and behind the machine.

  The clear space is a tall egg round the machine's middle, plus the camera's line to what it looks at. In the fall, the clear space follows the light.
- **The words:** the mock-up's, in Dutch with English beside them:
  - "Scroll of klik op een project" / "Scroll or click a project";
  - "Klik om te openen" / "Click to open";
  - "Tik om te openen" / "Tap to open" on a touch screen;
  - "Terug" / "Back";
  - "Bekijk project" / "View project".
- **A project page reached directly** (a link, the menu, Back): the camera stands at the project's board stop and the project stands open in the spot, reached by the step fade.

## Left to the builder

- The scroll's lengths and the explode's exact stretch in the land.
- The clear space's sizes in the fall.
- The names of new modules, and how the old ones are removed.
- The proof harness's new checks.

## How it gets made

1. A plan (`docs/superpowers/plans/2026-10-28-bob-quantum-stack.md`), read by Bob before anything is built.
2. The build on `bob-stack`, inline (no subagents), test first, with the proof harness updated.
3. A review page with videos at both sizes and stills beside the mock-up's. Nothing is merged or pushed without his word.
