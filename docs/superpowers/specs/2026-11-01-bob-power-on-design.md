# Power-on (round 15)

Bob, 2026-11-01, after round 14 went live: "can you make the scroll to rotate around the tower less agressive";
"when reach end of project make more creativity to transition to Q&A you can completely redesign Q&A and Stuur een
bericht … such as the tower will close and there will be smooth transition to another dimension like it almost
seamless"; the other side "somewhere unique and exotic like a start of something".

The first mock-ups (`.superpowers/r15/index-v1.html`: three worlds after the tower) he turned down: "it doesnt look
seamless, as the tower close i want the transition already starting", then "i want a bit more techy look". On the
second (`.superpowers/r15/index.html`, the three ways out played live in the site's mock build, `?proof&r15=board`)
he picked the turn "Yes, half per floor" and the way out "A · Power-on".

## What it is

1. **Half a turn to each floor.** The camera's move down to each floor goes half way round the tower (now a whole
   turn), always the same way. Each floor still looks exactly as it does now when the camera stops at it.
2. **The tower closes and the board powers on.** From the last floor's stop, one scroll: the floors come together
   into the closed tower, and while they are still closing, a dark circuit board appears under it and powers up from
   its base: gold traces run out from the tower's rim with a bright front. The camera never stops: it eases back to
   the whole closed tower, then rises and pulls back over the board. The tower slides to the right of the screen and
   question 1 comes in on the left.
3. **The Q&A, one question at a time.** Each scroll goes to the next question: the words change in place (out with
   a short blur, in), the power front runs further out over the board, and the camera rises and pulls back a little
   more and turns a little round the tower. Under the answer, the numbers 01 to 06 mark where you are and take you to
   a question when clicked.
4. **The end.** From question 6, one scroll: the tower comes back to the middle, the camera goes higher and further,
   the power runs out to the board's horizon, and over the tower: Bob's chbc mark, "Einde van de site", "Stuur een
   bericht.", Bob's line and the two buttons (to the contact page, back to the start).

Scrolling up plays each step back (faster): the end to question 6, question 1 back to the last floor with the tower
opening and the board going dark and away.

## Goals and anti-goals

- Seamless: nothing cuts or fades to black between the floors and the Q&A; the board starts while the floors are
  still closing and the camera moves on without a stop.
- Techy, dark, calm, one focal point: the tower stays the one bright thing; the lit board is dim gold, only its
  moving front is bright.
- The mock-up's look and timing, numbers for numbers (`src/scene/bob/r15Mock.ts` on branch `bob-r15-mock` and the
  numbers below).
- Anti-goals: the words over the tower or over a bright part of the board; a stuck step; the logo glowing or
  recoloured; the phone's Q&A taller than the screen (it is now; one question at a time fixes it).

## Decisions (mine, from the mock-up and the site)

- **Round 14's way out goes:** the blueprint, the sky canvas with its stars and closing circle, the flight, the
  frame grab, the list with its gold light. What stays: the Q&A's door at the last floor's stop, its places and
  marks (`qaDoor`, `qaPlaceAt`: -1 at the door, k at question k + 1, 6 the end's), the steps played as turns of the
  scroll with input waiting while one plays forward, playing back at 2.4 s, the skip button and the nav's link to
  the end with the end's title focused on arrival, the words and links of the end.
- **The two played steps** take the mock-up's clock: the power-on 7.5 s (door to question 1), the end 3.4 s
  (question 6 to the end), the turn's eased place inverted to that clock as round 14 does.
- **The camera is a pure function of the place**, so the same place is the same picture up or down; no drift on a
  clock (the mock-up's slow drift goes).
- **The board is a new part of the world**: one large plane under the closed tower with a round hole the tower's
  size, one shader, a circuit tile drawn once on a canvas (repeated; chips with pins, traces with a 45° turn now and
  then, pads) and twelve buses straight out from the rim. The power front's radius comes from the place. It writes
  depth, so the gas stays above it. Made and disposed with the world.
- **The tower's own parts:** the floors close from the door on (the stack's explode to 0), the floor's words (names,
  caption, dots) go as the close starts, the gold rings dim to 15% of their light, nothing in the scene can be
  pointed at past the door (as now).
- **The words** (the count keeps the site's "Q&A · 01 / 06" where the mock-up had "Vraag 01 / 06"): the Q&A section stays one section on the home page with the same parts and copy (the count
  "Q&A · 01 / 06", the question, the answer or the placeholder, the end's words and buttons); only the open
  question shows; the numbers 01–06 are buttons (`goToQa`); a dark band from the left edge behind the Q&A for
  reading. No new copy in either language except the numbers' label (NL "De vragen", EN "The questions").
- **Phone (my call, not mocked):** the tower in the upper half of the screen, the question under it at the bottom
  over a dark band from below; at the end the words in the middle and the tower under them, smaller.
- **Reduced motion:** steps jump as they do now, the board shown at its stage with no moving front.
- **Lite and 3D off:** unchanged (the end page carries the Q&A).
- **Half turn:** a floor's move turns the camera by -π (now -2π). The stop at floor i and that floor's board are both
  turned by -π · (i + 1) about the spine, so the camera sees each board exactly as it does now; the way out starts
  from the last floor's turned stop.

## Numbers (from the mock-up)

The power-on's clock g, 0 to 7.5 s (the door to question 1):

| g (s) | what happens |
| --- | --- |
| 0 → 3.4 | the floors close (eased); the camera eases from the last floor's stop to the closed tower's shot |
| 0.6 → 1.6 | the board fades in round the tower's rim (it lies at the closed tower's foot; the dark board shows 24 m ahead of the front, nothing beyond) |
| 1.0 → 7.5 | the power front runs from the rim (6.2 m) to 36 m |
| 2.4 → 7.5 | about the closed tower's middle, the camera rises 9°, pulls back to 1.35× its distance and turns 12° round; the scene's fog blends to 30 to 160 m times the pull-back |
| 4.5 → 7.5 | the camera slides so the tower stands 17% of the screen's width right of the middle |
| 6.0 | question 1's words come in (the band behind them from 4.6 s: from the left edge 82% dark, 55% at 30% of the width, clear at 52%) |

Over the questions, q = k / 6 at question k + 1, eased between: the front at 36 + 260 · q^1.6 m; the camera
1.35 + 1.2 · q times as far, 9 + 9 · q degrees higher, 12 + 28 · q degrees round. The end (its clock 0 to 3.4 s):
the camera to 3.15× as far, 24° higher, 40° round, back to the middle; the front out to 900 m; the words from 1.4 s,
each line a little after the one above. A question's words go out in 0.45 s (a 10 px drop, a 3 px blur) and the
next come in the same way back; in the numbers, the ones passed are gold, the open one bright with a thicker line.

The board's look: dark violet surface, unlit copper at 0.16 violet, lit copper at 0.16 gold, the front 1.7 gold
(2.2 m wide); the tile 24 m, 48 traces and 4 chips to a tile; the board fading out 50 to 260 m from the camera (times
the camera's pull-back).

## How it is checked

- Unit tests on the pure parts: the turn's angles and the turned stops and boards; the way out's stages at its
  places (closing, front, camera, words); the board's front; the Q&A writer showing exactly one question or the end.
- The proof harness on the built site: each floor's stop shows its projects where they stand now; mid power-on the
  tower half closed with the board lit round it; at each question one answer shown, the tower right of the words;
  the end's words and buttons, the tower under them; back up to the last floor; a phone at 375 × 667 with the
  question on the screen whole; no console errors.
- The code-scanning alerts stay at 0.

## Left to the builder

The file layout, how the board's tile is drawn exactly, the phone's exact framing, the low tier's board (a smaller
tile texture is fine), and the order of the work.
