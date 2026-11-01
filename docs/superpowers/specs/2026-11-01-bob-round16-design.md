# Round 16: the projects breathe, the dial, Jontai's new picture, floor 1

Date: 2026-11-01. Branch: `bob-r16`, off `main` at 38cb701 (round 15, live). The mock-up branch `bob-r16-mock` is the
visual reference only and is never merged.

## Why

Bob, after round 15 went live: "update the jontai project image and also make the project glows more in the tower so it
catches the user attention and they will click on the projects / also are there more unique or enhancements
design/idea for my beginning screen ?"

He picked from mock-ups on the real site (review page `.superpowers/r16/index.html`):

- the projects' glow: "Breathe (A) but make it so everytime it breathes regardless if its not on that floor";
- the start screen: "Dial (C)";
- the BOB screen: after three rounds of new looks, "or just keep the original".

Checking the floors for the mock-up turned up a live bug from round 15: at the first floor Portle stands behind the
tower's core.

## Goals

1. **Breathe.** Every project in the tower, and the socket under it, breathes brighter and softer together, on every
   floor and all the time the tower is in view, so a visitor sees there is something to click.
2. **Dial.** On the start screen, Bob's name and his line run slowly round the compass's base on the glass, in gold, like
   an engraving on a dial.
3. **Jontai's picture.** The picture on Jontai's page shows the redesign as it is now (type-led, 2026-10-28), not the
   retired sunrise film.
4. **Floor 1.** Both of the first floor's projects (Steady and Portle) are in view at its stop.

## Not in this round

- BOB from above stays exactly as it is (Bob: "or just keep the original").
- Jontai's words (its overview and build text, the DAY FILM test point, Blender in its stack) stay as they are; they
  still describe the film. Changing them is Bob's call, in a later round if he asks.
- No other copy changes. The start screen's other parts (the compass, the needle that follows the mouse) are unchanged.

## Must not happen

- The tower gets busy or bright: the breathing is slow and soft, all projects in step, no flashing, no ripples (the site
  stays dark, calm, one focal point).
- The dial competes with the compass: it is quiet gold text on the glass, never over the compass or the header.
- The BOB screen or anything after the floors changes look.

## Constraints

- NL is the default and EN is under /en/. The dial uses copy that exists: the header's name and the `badge` line
  (src/i18n/nl.ts, en.ts). The Jontai picture's alt text and caption are rewritten to say what the new picture shows;
  nothing else is new copy.
- Reduced motion: nothing breathes and nothing turns (below).
- `.impeccable/config.json` is never edited. No subagents. Commit trailer:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Pushing or merging only on Bob's word.
- The proof harness (`tools/proof/needle.mjs`) is updated for what changes, and stays green.

## 1 · Breathe

The mock-up's option A (`?r16glow=a`, `src/engine/bob/build/world.ts` and `src/scene/bob/Void.tsx` on `bob-r16-mock`)
is the look Bob approved; these are its numbers.

- One breath for the whole tower: `b(t) = 0.5 − 0.5·cos(2πt / 2.4)` on the world clock (0 to 1 and back every 2.4 s),
  the same `b` for every project, so they all breathe in step.
- Each project's light times `1 + 2.2·b`. Its socket: the glow plane times `1 + 5·b`, the dashed ring times `1 + 3·b`,
  the column times `1 + 6·b` (on top of today's levels, which already include an empty socket's share).
- Every project (`WORLD_PROJECTS`), on every floor, whichever floor is in view: at the world's stop, at each floor's
  stop, and on the moves between them. It goes with the projects wherever they go today (the dissolve takes them as
  now).
- It replaces round 10's floor glow at a floor's stop (`src/scene/bob/floorGlow.ts`). The hover lift stays, on top.
- The world clock keeps running while the tower's projects are drawn. Today it stops 12 s after the last stir
  (`worldClockRuns`); with breathing it does not stop while the tower is in view, so the tower keeps drawing frames
  there. That cost is accepted: Bob asked for it always. Outside the tower the clock behaves as today.
- Reduced motion: no breathing. Every part is held where `b = 0.5` puts it, a steady lift, and the clock rules as today.

## 2 · Dial

The mock-up's option C (`?r16start=c`, `src/ui/R16StartMock.tsx` on `bob-r16-mock`) was a flat sketch over the start
screen; the build puts it in the 3D scene, on the glass.

- A ring of text lying on the glass, centred on the compass, at about 2.05 m from its axis: just outside the outer ring
  (1.88 m) and inside where the B letters' backs stand (2.15 m). Letters about 0.06 m tall (what the mock reads at
  1440 × 900), Martian Mono weight 500, upper case, letter-spaced, in the engraving's gold (as the ticks), unlit by
  the scene so it reads as light in the glass.
- The words, in the page's language: the hero's `name` (`BOB CHUNG`) and the `badge` line, upper case, joined by ` • `:
  NL `BOB CHUNG • STUDENT SOFTWARE ENGINEER • GEBOREN OP ARUBA • WOONT IN ROTTERDAM • `,
  EN `BOB CHUNG • STUDENT SOFTWARE ENGINEER • BORN IN ARUBA • BASED IN ROTTERDAM • `.
  The words repeat a whole number of times round the ring, so the join never cuts a word.
- It turns slowly, 0.035 rad/s (once round in about three minutes). The far side of the ring is dimmer (about 30 % of
  the near side), so it reads as a dial lying in depth.
- It shows at the home, once the loader has landed; it fades out as the scroll begins the rise, gone before the B
  letters start to light, and comes back at the home. It is never in the BOB from above.
- Reduced motion: it stands still.
- On a phone the ring is the same; like the B letters, part of it may fall off the screen.
- Only in the 3D scene: the Lite page and 3D off are unchanged.

## 3 · Jontai's picture

- The picture: Jontai-Energy (`github.com/bhccob/Jontai-Energy`) at c8c9c62, run from a scratch copy, its first screen
  at 1440 × 900, the clock set to a Wednesday 11:00 in Aruba so it reads "Open now, until 7:00 PM". The review page's
  `.superpowers/r16/jontai-new.png` is that picture.
- The PNG is git-ignored scratch; it is copied as `jontai-home.png` into the folder `tools/pictures.mjs` reads from.
- Made through `tools/pictures.mjs` as `src/assets/projects/jontai-home.webp` (1440 × 900 at most, quality 82): the tool's
  entry `jontai-dawn` becomes `jontai-home`, and `jontai-dawn.webp` is removed.
- Alt text (it says what is in the picture):
  EN `Jontai Energy redesign: JONTAI in large green letters above “Aruba sunlight, made useful.”, with Explore solar and Visit the store`
  NL `Herontwerp van Jontai Energy: JONTAI in grote groene letters boven “Aruba sunlight, made useful.”, met Explore solar en Visit the store`
- Caption: EN `The redesign's first screen`, NL `Het eerste scherm van het herontwerp` (no "at dawn").
- The note above Jontai's `pictures` in `src/data/projects.ts` names c8c9c62; `tests/unit/jontai.test.ts` follows.

## 4 · Floor 1

- The bug: since round 15's half turn, the first floor (Apps) is seen from behind at its stop, and Portle stands
  behind the core (its screen x 811 of 1440, inside the spine).
- The fix: the first floor's turn goes 40° further, `floorTurn(0) = FLOOR_TURN − 40°` (−220°); the second and third
  floors stay at −360° and −540°. The move from one stop to the next turns from the one's turn to the other's
  (`floorTurn(i−1) + (floorTurn(i) − floorTurn(i−1))·e`) rather than a fixed half turn, so the first move turns 220° and
  the second 140°. In the mock-up (`?r16shift=-40`) Steady and Portle are both clear of the core.
- A unit test that would have caught it: at every floor's stop, on a laptop and a phone, the line from the camera to
  each of that floor's projects passes no nearer the spine's axis than the spine's radius plus a margin. The existing
  `floorTurn` test takes the new value, and any test that pins every move to a half turn takes the new turns. The harness checks at floor 1 that both projects are on screen and clear of the
  core.

## Proof

- Unit tests for each part (the breath and its reduced-motion hold, the clock running in the tower, the dial's words
  per language and their whole repeats, the Jontai picture data, the floor-1 sight lines), `tsc`, the full suite.
- The harness: floor 1 as above; at rest in the tower a project's light changes over a breath; the dial at the home.
- A review page with today and round 16 side by side (the tower at rest, the start screen, Jontai's page, floor 1)
  before Bob is asked to merge.

## Left to the builder

- How the dial's text is made (a canvas texture on a flat ring, or other text rendering), as long as it reads as above.
- The dial's fade curve on the rise, and the spine margin in the floor-1 test.
- Whether the floor glow's module is removed or left unused.
