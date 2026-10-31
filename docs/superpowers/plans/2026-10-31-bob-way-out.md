# The Way Out Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (Bob: "DO NOT use subagent"). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `.superpowers/r14/all.html` into the site: blueprint → Q&A in the stars with the closing circle → through the ring → the new end.

**Architecture:** The look back goes; the Q&A's door is the last floor's stop. A pure timeline (`src/scene/bob/wayOut.ts`) turns the Q&A's place (-1 at the door, k at question k + 1, 6 at the end) into the mock-up's clock and every stage value; `src/ui/outSky.ts` draws the sky on one 2D canvas from it; the Q&A scene (`src/scene/bob/qaScene.ts`) writes the page and drives the sky, the 3D ring and its stars removed.

**Tech Stack:** React Router 8, R3F/three, canvas 2D, Vitest, the proof harness `tools/proof/needle.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-31-bob-way-out-design.md`

## Global Constraints

- Mock-up numbers verbatim (all.html): BLUEPRINT_S 6.4, FLIGHT_S 4.8, the stage times in its `draw`/`flight`, 1300 stars and 2400 sparks (1100 to the sky) at 1440x900, R 360 at 1440x900, gold `239, 181, 61`, circle `226, 165, 74`.
- The mark: Bob's chbc mark, white, 52 px; no glow, effect or recolouring on it.
- NL default, EN under /en/; copy from the dictionary, none invented.
- Never edit `.impeccable/config.json`; never push or merge without Bob's word; commit trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- A resize while in the Q&A: the stars, the circle and the sparks' targets follow the new screen.
- Scrolling up from question 1 without ever having passed the floor (skip, nav): the edges are grabbed then.
- A phone: the circle and the panel do not cover each other's words; the end fits.
- Reduced motion: no tween, the end reached by a jump shows its words at once.
- Input while the blueprint or flight plays is dropped, never queued into a skip past question 1 or the end.

---

### Task 1: The door (chapters, input, journey)

**Files:** `src/state/chapters.ts`, `src/input/target.ts`, `src/input/scrollLoop.ts`, `src/input/useHomeScroll.ts`, `src/scene/bob/journey.ts`, `src/scene/bob/voidPose.ts`, `src/state/routeSync.ts`, `src/scene/bob/Void.tsx` (drag), delete `src/input/ringDrag.ts`; tests in `tests/unit/{state,input,scene}`.

**Produces:** `qaDoor(c)` (the last area's stop; replaces `lookStop`), `qaPlaceAt(c, p)` = -1 at the door, k at `qaStop(c, k)`; no LOOK unit; `keyStops` without a look stop; `turnTime` = `BLUEPRINT_S` door→Q1, `FLIGHT_S` Q6→end, `BACK_S` 2.4 for either back, questions as now; the lock lasts a long step's whole time.

- [ ] Tests first: chapters without LOOK, `qaDoor` = last `areaStop`, `qaPlaceAt` at the door/mid-way/Q1; `moveTarget` caught at the door; `qaStepTarget` door→Q1 and Q1→door; `turnTime` four cases; `pointerMode` null past the door; watch them fail, implement, green; commit.

### Task 2: The timeline (`src/scene/bob/wayOut.ts`)

**Produces:** `invEaseInOutQuart(y)`, `wayOutAt(place, marks)` → `{ stretch: 'floor'|'blueprint'|'qa'|'flight'|'end', s, dark, lines, sweep, fly, skyRest, frameFade, skyIn, circleIn, share, panel, past, lightFly, round, speed, travel, ringZ, markRing, endOn }`; `flightTravel(s)` (∫ SPEED, closed form).

- [ ] Tests first: the mock-up's moments (dark 0 before 1.6 s, 0.8 at 2.4 s, 1 at 3.6 s; lines/sweep; panel from 4.9 s; share (k+1)/7; past; end on after 2.8 s of the flight; travel monotonic, ringZ ≥ 0.02); fail, implement, green; commit.

### Task 3: The world path holds the floor

**Files:** `src/scene/bob/worldPath.ts`, `src/scene/bob/Void.tsx`, `src/scene/bob/qaRing.ts` (deleted or cut), tests.

- [ ] Tests first: no 'look' part; at any Q&A place the shot is the last floor's stop shot; `qa.place` from the chapters; the floor's caption/dots/names fade with `dark`; no ring frame. Fail, implement (ring/decor out of the Void), green; commit.

### Task 4: The sky (`src/ui/outSky.ts`, `src/scene/FrameGrab`)

**Produces:** `edgesOf(rgba, w, h)` (Sobel, the mock-up's threshold), `skyStars(size, tier)`, `sparkTargets(boxes)`, `makeOutSky(canvas)` with `draw(view)`; a frame grab after the render (`requestGrab`, `takeGrab`) in `src/scene/Effects.tsx`.

- [ ] Tests first for the pure parts (edges of a square, star count by area and tier, targets on the box's edges); fail, implement, green; commit.

### Task 5: The Q&A scene and the page

**Files:** `src/scene/bob/qaScene.ts`, `src/ui/qaWriters.ts`, `src/ui/QaRing.tsx`, `src/styles/base.css`, `src/assets` (the mark), tests.

- [ ] Tests first: the writer's `--qa-show`/`--qa-past`, `data-qa-end` on from the flight's 2.8 s, the light gone in the flight; the end's parts (mark, kicker, title, line, two buttons) outside the frame. Fail, implement, green; commit.

### Task 6: The harness and every check

- [ ] Update `qa-ring`, `qa-end`, `keyboard`, `reduced-motion`, the stills (look-back → blueprint, qa, flight, end); `npm test`, `tsc`, the strict audit, the harness all green; commit.

### Task 7: The review page

- [ ] `.superpowers/way-out-review/` with stills of each moment on laptop and phone beside the mock-up's; shown to Bob.
