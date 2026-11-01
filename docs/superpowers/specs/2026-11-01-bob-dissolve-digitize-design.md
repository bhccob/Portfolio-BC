# Dissolve and Digitize (round 15)

Bob, 2026-11-01, after round 14 went live: "can you make the scroll to rotate around the tower less agressive";
"when reach end of project make more creativity to transition to Q&A you can completely redesign Q&A and Stuur een
bericht … such as the tower will close and there will be smooth transition to another dimension like it almost
seamless"; the other side "somewhere unique and exotic like a start of something".

Over four rounds of mock-ups (all in `.superpowers/r15/`, played live in the site's mock build, branch `bob-r15-mock`,
`src/scene/bob/r15Mock.ts`): worlds after a fade, turned down ("it doesnt look seamless, as the tower close i want the
transition already starting", "i want a bit more techy look"); the turn "Yes, half per floor"; a Q&A "just very
simple and blend in to scroll"; then, on `ways.html`, "the idea of dissolve and digitize for stuur een bericht is a
good idea", "i meant dissolve for the tower and digitize for stuur een bericht make everything smooth and blend well
together", and on the joined mock-up (`?proof&r15=mix`): "Yes, write the design".

This replaces the Power-on design (`2026-11-01-bob-power-on-design.md`, never built).

## What it is

1. **Half a turn to each floor.** The camera's move down to each floor goes half way round the tower (now a whole
   turn), always the same way. Each floor still looks exactly as it does now when the camera stops at it.
2. **Dissolve: the tower into stardust.** From the last floor's stop, one scroll plays it: the floors close, and
   while they close the tower lights up as points of light over its own surface. Once the light covers it, the solid
   tower is gone and the points rise and drift out and down into a wide, slowly turning field of stardust under where
   it stood. The core's gold light stays, floating. The camera never stops: it eases back to the closed tower, then
   rises, pulls back and turns a little, and slides so the core's light stands to the right. The first question
   comes in on the left.
3. **The Q&A with the scroll.** The questions and answers are plain words in one column on the left, no box, no
   numbers. The column moves with the scroll like a page, slow or fast, fading out at the top and bottom of the
   screen. The camera moves with the same scroll: a little further back, lower and further round with each question.
4. **Digitize: into "Stuur een bericht".** Scrolling on past question 6, a laser line sweeps down the screen and
   everything it passes turns into a screen of tiny LEDs: the stardust, the core's light and the storm, drawn as
   small square dots of dark violet, violet, gold and warm white. The last answer scrolls away, the core comes back to
   the middle, a soft ripple of brighter LEDs runs out from it, and the end stands on the LED screen: Bob's chbc mark,
   "Einde van de site", "Stuur een bericht.", Bob's line and the two buttons (to the contact page, back to the
   start), the LEDs dark behind the words.

Scrolling up plays it all back: the LEDs un-scan from the bottom up, the column scrolls back, and from question 1 the
dissolve plays backward (the points fly back into the tower, the solid tower returns, the floors open).

## Goals and anti-goals

- Seamless: no cut and no fade to black anywhere from the last floor to the end. The points start while the floors
  still close, the solid tower goes only under its own light, the LEDs come in under a moving line.
- One look from start to end: points of light that become a grid of light dots.
- Simple, calm Q&A that reads like a page; dark; one focal point (the core's light, then the end's words).
- The mock-up's look and timing, numbers for numbers (`mixWorld`, `dustWorld`, `scanWorld` and `makeFlowUi` with
  `qa=a` in `r15Mock.ts`, commit 64bb41c, and the numbers below).
- Anti-goals: words over the core's light or over bright LEDs; a stuck or jumping scroll in the Q&A; the logo glowing
  or recoloured (no effect on the mark); a frame that stalls while the points are made.

## Decisions (mine, from the mock-up and the site)

- **Round 14's way out goes:** the blueprint, the sky canvas with its stars and closing circle, the flight, the list
  with its gold light, the ring's numbers. What stays: the Q&A's door at the last floor's stop; the door's step played
  as one turn of the scroll (now the dissolve, its own clock), input waiting while it plays forward, playing back at
  2.4 s; the frame grab after the render (`src/scene/frameGrab.ts`, now feeding the LEDs); the skip button and the
  nav's link to the end, with the end's title focused on arrival; the end's words, links and buttons.
- **The questions are no longer stops.** Past the door the scroll is free over the Q&A and the end, eased like a page:
  place 0 is question 1, place k is question k + 1, place 6 is the end (its one stop, where the skip button and the
  nav's link go). A wheel's 520 px is one question; the arrow keys move 0.35 of one, Page Down and Space a whole one;
  a touch drag moves 1.4 times its length. Above place 0 the scroll goes back through the door (the dissolve played
  back), as it does now.
- **The camera is a pure function of the place** (the dissolve's clock in its step), so the same place is the same
  picture up or down; no drift on a clock. The stardust's slow turning and wave run on the world's clock.
- **The stardust is one points object** in the world: each point has its place on the closed tower, its place in the
  field, and its own random numbers; one shader moves it between them from the dissolve's progress. Made with the
  world, apart from the frame (as the nebula is), disposed with it.
- **The LED screen is one 2D canvas over the scene, under the words**, drawn each frame from the frame grab: the
  frame drawn small (one pixel a cell), each cell a square dot by its brightness. Over the line, near-black and the
  dots; under it, the scene as it is.
- **The tower's own parts:** the floors close from the door on; the floor's words (names, caption, dots) go as the
  close starts; the solid tower, its projects and the gold rings go at 3.25 s of the dissolve and come back below it;
  the storm and the nebula stay round the stardust; nothing can be pointed at past the door.
- **The words:** the Q&A section stays one section on the home page with the same copy (the question, the answer or
  the placeholder with its tag, the end's words and buttons); no count, no numbers, no buttons per question; every
  question is in the page for screen readers, the column `inert` while it does not show. No new copy in either
  language.
- **Phone (my call, not mocked):** the column full width with the 16 px gutters, its reading line at 62% of the
  height; the camera aims so the core's light stands in the upper third instead of to the right; the LED cells 5 px;
  the end's words in the middle.
- **Tiers:** the stardust 70 000 points on high, 35 000 on medium, 18 000 on low; the LED cells 6 px (5 px on a
  phone) on every tier.
- **Reduced motion:** the dissolve jumps to the stardust (no points in flight), the stardust still, the laser does not
  sweep (the LED screen is there at once from place 5.5), the words without blur.
- **Lite and 3D off:** unchanged (the end page carries the Q&A).
- **Half turn:** a floor's move turns the camera by -π (now -2π). The stop at floor i and that floor's board are both
  turned by -π · (i + 1) about the spine, so the camera sees each board exactly as it does now; the way out starts
  from the last floor's turned stop.

## Numbers (from the mock-up)

**The dissolve**, its clock g from 0 at the door to 7.5 s at question 1 (the turn's eased place inverted to it):

| g (s) | what happens |
| --- | --- |
| 0 → 3.4 | the floors close (eased); the camera eases from the last floor's stop to the closed tower's shot |
| 2.5 → 3.2 | the points come up over the tower's surface (the boards' tops, 60%, and rims), violet with 30% gold |
| 3.25 | the solid tower, its projects and the gold rings go (they come back below it, played back) |
| 3.2 → 7.2 | each point (staggered by its own number over 40% of the stretch) flies in an arc, up 5–14 m and 4 m aside at the top, to its place in the field |
| 2.4 → 7.5 | about the closed tower's middle, the camera rises 14°, pulls back to 1.6× its distance and turns 15° round; the fog blends to 30 to 170 m times the pull-back |
| 4.5 → 7.5 | the camera slides so the core stands 17% of the screen's width right of the middle |
| 6.0 | the column comes in (the dark band behind it from 4.6 s: from the left edge 82%, 55% at 30% of the width, clear at 52%) |

**The stardust:** a disc 7 m under the closed tower's foot, from 9 to 109 m out (each point at its angle on the tower,
give or take 25°, at a random distance, more of them near the middle), turning round the core at 0.5 / (r + 12) rad/s (r in m), a wave of 0.9 m along its radius
(0.09 rad/m, 0.6 rad/s); each point a soft round dot of 1 to 6 px, its light 0.2 of its colour on the tower and 0.4 in
the field (half its light, twice as big), twinkling ±25%.

**The Q&A**, its place p from 0 (question 1) to 6 (the end), eased toward the scroll's (rate 5/s): the column's
question k middle on the screen's middle at p = k; the column fading over its top and bottom 24%; a question 22–28 px,
its answer 16–18 px with 1.75 line height, 24% of the height between two; the column at max(16 px, 7.5% of the width) from
the left, at most 500 px wide. With q = p / 6 eased (cubic in and out): the camera 1.6 + 0.8q times as far, 14 − 8q
degrees higher, 15 + 40q degrees round.

**The digitize**, over the place from 5.08 to 5.88 (eased): the line from the top of the screen to its foot, 2 px
warm white with a 40 px gold glow above it. Cells 6 px; brightness l = 1.1 · √(luminance); 12 levels, the lowest two
left out; a dot l · 60% + 28% of the cell; colours from dark violet (38, 26, 92) through violet (118, 88, 226) at 60%
and gold (255, 186, 88) at 82% to warm white (255, 238, 205). The end's own part, e from place 5.25 to 6 (eased):
the column fading out, the slide back to the middle, the camera 0.15 further and 6° higher, the words in once e passes
0.45 (each line a little after the one above), behind them a soft dark circle (radius 420 px, 82% at its middle times e, at
40% of the height), and a ripple of +0.5 brightness 60 px wide running out from the core across 1.4 times the screen's
diagonal.

## How it is checked

- Unit tests on the pure parts: the turn's angles and the turned stops and boards; the dissolve's stages at its clock
  (close, points, the tower's hiding, the flight, the camera); the Q&A's place from the scroll (free past the door,
  520 px a question, the end a stop); the column's offset at a place; the LED cell's level and colour from a
  brightness; the line's height and the end's part from the place.
- The proof harness on the built site: each floor's stop shows its projects where they stand now; mid dissolve the
  points over the half-closed tower; after it, no tower and the stardust lit; at each question its words in the middle
  and none over the core; a slow wheel and a fast one both move the column smoothly; mid digitize the line on the
  screen with LEDs over it; the end's words and buttons readable and working; back up to the last floor with the tower
  whole; a phone at 375 × 667; reduced motion; no console errors.
- The code-scanning alerts stay at 0.

## Left to the builder

The file layout, the points' exact sampling of the tower, how the free scroll joins the scroll loop, the phone's exact
framing, and the order of the work.

## Build notes (2026-11-01)

- **The boards stay; only the camera turns.** The design above turned every other board half round with its stop so each
  floor looked as before; the full proof run showed that put Steady's and Portle's names off the top of the whole
  machine's view. Built instead as the half-turn flipbook Bob approved showed it: the camera goes half round to each
  floor and the boards keep their facings, so the first and third floors are seen from behind the stack, and the whole
  machine's view is as it was. On a phone the floor's frame is a little wider (0.94 of the screen, was 1), so a project
  seen from behind, nearer, keeps its whole object on the screen.
- The free Q&A drops input while the dissolve's lock holds (the turn's heading is already question 1).
- A gesture that scrolls up the Q&A to question 1 rests there; only a new gesture begun on question 1 plays the dissolve
  back.
- The stars round the stack keep the power's light on the way out (the rings go with the solid tower).
- The LEDs' dark circle behind the end's words stays over the laser's line (it darkened the scene under it).
- The debug bridge's `journey.world` says whether the solid tower and the stardust are drawn; the harness checks the
  dissolve with it.
