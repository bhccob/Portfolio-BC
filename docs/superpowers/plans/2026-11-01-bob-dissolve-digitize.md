# Dissolve and Digitize (round 15) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. (Bob: inline only, "DO NOT use subagent": superpowers:executing-plans.)

**Goal:** Half a turn to each floor; from the last floor the tower dissolves into stardust, the Q&A scrolls freely through it as plain words, and past question 6 a laser line digitizes the world into LEDs under "Stuur een bericht".

**Architecture:** The way out stays a pure function of the scroll's place (`wayOutAt`, `src/scene/bob/wayOut.ts`), read by the path (camera, closing, the tower's parts), by a new stardust points model in the world, and by the Q&A's scene, which writes the words' column and draws the LEDs on a 2D canvas from the frame grab. The scroll keeps the door → question 1 step as a played turn (the dissolve) and makes the rest of the Q&A free, like a page.

**Tech Stack:** TypeScript, React Router 8 (prerendered), three.js 0.186.1 through R3F, Vitest, the proof harness (`tools/proof/needle.mjs`, Playwright with Edge).

**Spec:** `docs/superpowers/specs/2026-11-01-bob-dissolve-digitize-design.md` (ec7149f). **Reference mock-up:** `git show bob-r15-mock:src/scene/bob/r15Mock.ts` (64bb41c): `dustWorld` (the points' sampling and shader), `scanWorld` (the LED drawing), `makeFlowUi` with `QV === 'a'` and `src/styles/r15mock.css` (the column). Port from it; the spec's numbers win where they differ.

## Global Constraints

- NL is the default and EN under /en/; no new copy in either language; never invent facts about Bob.
- Dark, calm, one focal point; the chbc mark never glows or is recoloured (ink #434842, paper #F4F5F0, white only).
- The Q&A's door stays at the last floor's stop (`qaDoor`); places: −1 the door, k question k + 1, 6 the end (`qaPlaceAt`).
- The dissolve's clock: 7.5 s forward, played back in 2.4 s, input dropped 7.2 s while it plays forward.
- The free Q&A: 520 px of wheel a question; arrows 0.35 of one, Page Down / Space a whole one; a finger 1.4×; the end (place 6) its one stop.
- Stardust: 70 000 points on high, 35 000 medium, 18 000 low. LED cells 6 px, 5 px on a phone (≤ 700 px wide).
- Reduced motion: the dissolve jumps, the stardust still, no sweeping line (LEDs at once from place 5.5), no blur on the end's words.
- Lite and 3D off are untouched; the end page keeps the Q&A for them.
- Files are CRLF: edit with the Edit tool. Never edit `.impeccable/config.json`; never run `impeccable hooks ignore-value`; never port 4399.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; nothing is pushed or merged without Bob's word.

## Review Focus

1. A trackpad's fling up through the Q&A stops at question 1; only a new gesture up from there plays the dissolve back (Task 4 test `a glide up stops at question 1`).
2. A resize mid-Q&A (laptop to phone) keeps the place and re-measures the column, so the question on the line stays on it (Task 8 test `re-measures on a new screen`).
3. Leaving the Q&A any way (a project opened, Home, the route) shows the solid tower again: it hides only on the way out past 3.25 s (Task 6 test `the tower stands off the way out`).
4. No frame to grab (a lost context, a taker's error) leaves the LEDs cleared, never a black screen (Task 7 test `clears when the grab gives nothing`).
5. Reduced motion never shows a half-closed tower or a moving line (Task 2 test `reduced motion jumps`).

---

### Task 1: Half a turn to each floor

**Files:**
- Modify: `src/scene/bob/worldLayout.ts` (`stackPlaces`: each category board's `facing`)
- Modify: `src/scene/bob/worldPath.ts` (`FLOOR_TURN`, `stopShot`, the area moves, the way out's held shot)
- Test: `tests/unit/scene/bob-world-path.test.ts`, `tests/unit/bob/build-plate.test.ts` (only if it pins facings)

**Interfaces:**
- Produces: `FLOOR_TURN = -Math.PI`; `floorTurn(i: number): number` exported from `worldPath.ts` = `FLOOR_TURN * (i + 1)` (the turn the camera and board `i` stand at, `i` 0-based among the category boards; −1 the world's stop, 0); `WorldPath.areaShot(i)` returns the turned stop.
- Consumes: `turnedRound(shot, centre, angle)` (`./around.ts`, angle from +x toward +z).

- [ ] **Step 1: Write the failing tests** (replace `turns the camera once round the tower …`)

```ts
it('turns the camera half round the tower on the way down to each board, the same way each time', () => {
  // for each area i: at its start the camera stands at floorTurn(i - 1) (0 for the first), at its stop at floorTurn(i),
  // measured as the camera's angle round C relative to the unturned stop's (atan2 of x, z about C); between, monotonic.
  expect(FLOOR_TURN).toBe(-Math.PI);
});
it('sees each board at its stop exactly as before: the board and its stop turned alike', () => {
  // for board i: every socket's position relative to areaShot(i).position, in the camera's basis (lookAt target, up y),
  // equals the same for the unturned facing (STACK.first + k * STACK.turn) and the unturned stop, to 1e-9.
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/unit/scene/bob-world-path.test.ts`
Expected: FAIL (`FLOOR_TURN` is −2π; stops unturned).

- [ ] **Step 3: Implement**

In `stackPlaces`, category board k's `facing = STACK.first + k * STACK.turn + Math.PI * (k + 1)` (a socket at facing a sits at (sin a, cos a): turning the board by `turnedRound`'s δ moves its facing by −δ, and δ = −π(k + 1)). In `worldPath.ts` keep the unturned `boardShots` for the moves; `stopShot(i)` returns `turnedRound(boardShots[i], C, floorTurn(i))` (the world's shot for i < 0); an area's move is `turnedRound(aroundShot(unturned(i - 1), unturned(i), C, e), C, floorTurn(i - 1) + FLOOR_TURN * e)` with `floorTurn(-1) = 0`; at and past its stop, `stopShot(i)`. Update the file's header comment and `FLOOR_TURN`'s (Bob, 2026-11-01: "Yes, half per floor").

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/unit/scene tests/unit/bob`
Expected: PASS (fix any test that pinned the old full turn or the old facings, by the same rule).

- [ ] **Step 5: Commit** — `git commit -m "turn: half a turn round the tower to each floor, the board turned with its stop"`

---

### Task 2: The way out's timeline

**Files:**
- Rewrite: `src/scene/bob/wayOut.ts`
- Rewrite: `tests/unit/scene/bob-way-out.test.ts`

**Interfaces:**
- Produces:
```ts
export const WAY_OUT = { dissolve: 7.5, back: 2.4, lock: { dissolve: 7.2 } } as const;
export type WayOutStretch = 'floor' | 'dissolve' | 'qa' | 'digitize' | 'end';
export interface WayOutView {
  stretch: WayOutStretch;
  g: number;        // the dissolve's clock, s: 0 at the door, 7.5 from question 1 on
  close: number;    // the floors closing, eased seg(g, 0, 3.4)
  points: number;   // the points over the tower, seg(g, 2.5, 3.2)
  solid: boolean;   // the solid tower, its projects and the rings stand: g < 3.25
  flight: number;   // the points' flight to the field, eased seg(g, 3.2, 7.2)
  away: number;     // the camera off the closed tower (and the fog's blend), eased seg(g, 2.4, 7.5)
  slide: number;    // the core to the side, eased seg(g, 4.5, 7.5) · (1 − end)
  column: number;   // the words' column: g ≥ 6 → 1, times (1 − end)
  band: number;     // the dark band behind it: eased seg(g, 4.6, 6.0) · (1 − end), 0 once end ≥ 0.5
  q: number;        // the Q&A's way, eased clamp(place / 6)
  line: number;     // the laser line down the screen, eased seg(place, 5.08, 5.88)
  end: number;      // the end's part, eased seg(place, 5.25, 6)
  endOn: boolean;   // end > 0.45
}
export function wayOutAt(place: number | null, reduced?: boolean): WayOutView;
export function easeInOutQuartInverse(y: number): number; // kept as is
```
`ease` is the cubic in-out the file already has. Stretch: null or ≤ −1 'floor'; (−1, 0) 'dissolve' with g = easeInOutQuartInverse(place + 1) · 7.5; [0, 5.08) 'qa'; [5.08, 6) 'digitize'; 6 'end'. Reduced: `line` and `end` are 1 from place 5.5 and 0 before; nothing else changes (the scroll never rests between the door and question 1 with reduced motion).

- [ ] **Step 1: Write the failing tests** — `wayOutAt(null)` and `wayOutAt(-1)` are the floor (close 0, solid, column 0); `wayOutAt(-1 + easeInOutQuart(3 / 7.5))` has g 3 ± 1e-9, close ≈ ease(3 / 3.4), points ≈ 5/7, solid; at g 3.3 not solid; `wayOutAt(0)` has g 7.5, flight 1, away 1, slide 1, column 1, q 0, line 0, end 0; `wayOutAt(3)` q = ease(0.5); `wayOutAt(5.48)` line = ease(0.5) and 0 < end < 0.45; `wayOutAt(6)` stretch 'end', line 1, end 1, endOn, column 0, slide 0; `reduced motion jumps`: `wayOutAt(5.4, true).line === 0`, `wayOutAt(5.5, true)` line 1 and endOn.

- [ ] **Step 2: Run** `npx vitest run tests/unit/scene/bob-way-out.test.ts` — Expected: FAIL (old view).

- [ ] **Step 3: Implement** the view as listed; delete the flight helpers (`flightSpeed`, `flightTravel`, `starDepth`, `aheadAgain`, `circleFor`, `hash01`) and update the header comment to round 15.

- [ ] **Step 4: Run** the same — Expected: PASS. Then `npx tsc --noEmit` and note every caller now broken (worldPath, qaScene, outSky, scrollLoop, needle): the next tasks fix them.

- [ ] **Step 5: Commit** — `git commit -m "way out: the dissolve and the digitize as a pure timeline of the place"`

---

### Task 3: The path through the way out

**Files:**
- Modify: `src/scene/bob/worldPath.ts` (`frameAt`'s qa part and its AREA tail at the last floor; a `closedShot`; an `orbitShot`)
- Test: `tests/unit/scene/bob-world-path.test.ts`

**Interfaces:**
- Consumes: `wayOutAt` (Task 2), `floorTurn` (Task 1), `boardTops(places, 0)`.
- Produces: `QaFrame { place: number; out: WayOutView }` (unchanged shape); `orbitShot(base: CameraShot, about: Vec3, o: { pull: number; rise: number; turn: number; toward: number }): CameraShot` exported (pull × distance, rise rad of elevation, turn rad added to three's Spherical theta = atan2(x, z), target lerped to `about` by `toward`).

- [ ] **Step 1: Write the failing tests**
  - `holds the last floor at the door`: `frameAt` at the door equals the last floor's stop (turned), explode 1.
  - `closes the tower as the dissolve plays`: at g 1.7 explode = 1 − ease(0.5), names/caption/dots 0 from g 0.6 on; at g ≥ 3.4 the camera is `closedShot` = `turnedRound(framed(the closed rims, [C.x, (top0 + bottom)/2 − 0.6, C.z], 0, 24°, [−0.5, 0.5, −0.38, 0.38]), C, floorTurn(last))`, the closed rims being `rimOf({ ...board, top: boardTops(places, 0)[i + 1] }, C)` for every category board (the mock-up's `closedShot`). The tests' old `wayOutAt(place, RING_MARKS)` calls become `wayOutAt(place)`.
  - `moves off the closed tower`: at question 1 the camera is `orbitShot(closedShot, T, { pull: 1.6, rise: 14°, turn: 15°, toward: 1 })` then slid: on a laptop aspect the core's NDC x is +0.34 (17% of the width right of the middle) ± 0.01; on a phone aspect its NDC y is +0.33 (the upper third) ± 0.01.
  - `goes with the Q&A`: at place 3 pull 1.6 + 0.8 · ease(0.5), rise 14 − 8 · ease(0.5) degrees, turn 15 + 40 · ease(0.5) degrees; at place 6 pull 2.55, rise 12°, turn 55°, no slide.
  - `the rings and the tower`: `rings.level` 0 once not solid; fog near/far = lerp(the closed shot's fog, 30 · pull / 170 · pull, away).

- [ ] **Step 2: Run** `npx vitest run tests/unit/scene/bob-world-path.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement.** Last floor at and past its stop and the qa part: `shot = shotToward(stopShot(last), closedShot, out.close)`, then `orbitShot` with pull 1 + 0.6·away + 0.8·q + 0.15·end, rise (14·away − 8·q + 6·end)°, turn (15·away + 40·q)°, toward = away; the slide moves position and target together, along the camera's right (laptop, 0.17·slide of the screen's width, camera to the left) or its up (phone, 0.17·slide of the height, camera down), the screen's world size at the core's distance from the fov and aspect. `explode = 1 − out.close`; board light mixed to all lit by close; names, caption, dots × (1 − seg(g, 0, 0.6)); `rings.level × (out.solid ? 1 : 0)`; fog as tested.

- [ ] **Step 4: Run** `npx vitest run tests/unit/scene` — Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -m "way out: the path closes the tower and moves off it with the Q&A"`

---

### Task 4: The free Q&A in the scroll

**Files:**
- Modify: `src/input/target.ts`, `src/input/scrollLoop.ts`
- Test: `tests/unit/input/target.test.ts`, `tests/unit/input/scroll-loop.test.ts`

**Interfaces:**
- Produces (target.ts):
```ts
export const QA_QUESTION_PX = 520;
export const QA_FINGER = 1.4;
export function inFreeQa(place: number, c: Chapters): boolean; // place ≥ qaStop(c, 0) − ON_STOP
/** Where `units` (a viewport a unit, as VirtualScroll gives them) take the target in the free Q&A, at `unitPx` px a unit;
 *  held to question 1's stop and the end's; null when it is the step back through the door (up from question 1's stop). */
export function freeQaTarget(target: number, units: number, by: 'wheel' | 'finger' | 'glide' | 'key' | 'held', unitPx: number, c: Chapters): number | null;
```
A wheel or a glide moves `units · unitPx / 520` questions (a QA unit is one question), a finger 1.4 times that, a key 0.35 (|units| < 0.5) or 1 question its way. `qaStepTarget` keeps only the door step: down from the door → question 1's stop; up from question 1's stop → the door; null elsewhere.
- Produces (scrollLoop.ts): `export const QA_FOLLOW_TAU = 0.2;` `follow(current, goal, dt, tau = FOLLOW.tau)`; `turnTime` and `qaLockMs` know only the dissolve (door ↔ question 1: `WAY_OUT.dissolve` / `WAY_OUT.back`, lock `WAY_OUT.lock.dissolve`), every other move in the Q&A a glide.

- [ ] **Step 1: Write the failing tests**
  - target: `freeQaTarget(qaStop(0), 1, 'wheel', 1040, c) === qaStop(0) + 2`; `… 'finger' …` → `+ 2.8`; key 0.15 → `+ 0.35`, key 0.9 → `+ 1`; held to `scrollEnd(c)`; `freeQaTarget(qaStop(0), -0.1, 'wheel', 900, c) === null`; from `qaStop(0) + 0.5` up 1 wheel unit at 520 px → `qaStop(0)` (held, not null).
  - scroll loop: one notch at the door plays the dissolve (7.5 s, input dropped 7.2 s) and rests on question 1; wheel notches of 100 px in the Q&A move the target by 100/520 of a question each and the progress follows with τ 0.2 (no snapping to a mark); a long push down rests on the end; `a glide up stops at question 1` (a finger's fling up from place 3 ends at question 1's stop, the story there, no step to the door); a new wheel notch up from question 1 plays the dissolve back to the door in 2.4 s; `goToQa(k)` and the nav's End glide to their places; reduced motion still steps mark by mark.

- [ ] **Step 2: Run** `npx vitest run tests/unit/input` — Expected: FAIL.

- [ ] **Step 3: Implement.** In `startHomeScroll`'s `onDelta` (not reduced motion): when `inFreeQa(base)` (base = the heading or the target) take `freeQaTarget`; null → `qaStep(base, -1)` once per gesture (as the door step does now); a glide that reaches question 1 going up stops (`scroll.stopGlide()`); keys `glideTo` the target. The loop's follow uses `QA_FOLLOW_TAU` while progress and target are both in the free Q&A. Replace the doc comments' round-14 parts.

- [ ] **Step 4: Run** `npx vitest run tests/unit/input` — Expected: PASS, and every older test still passes or is rewritten for the free Q&A (list each rewritten test's name in the ledger).

- [ ] **Step 5: Commit** — `git commit -m "scroll: the dissolve a played step, the Q&A free like a page past question 1"`

---

### Task 5: The stardust model

**Files:**
- Create: `src/engine/bob/build/stardust.ts`
- Test: `tests/unit/bob/build-stardust.test.ts`

**Interfaces:**
- Produces:
```ts
export interface StardustSpec { centre: Vec3; tops: readonly number[]; core: number; radius: number; lid: number }
export function stardustCount(tier: QualityTier): number;            // high 70000, medium 35000, low 18000
export function sampleStardust(spec: StardustSpec, count: number): {  // pure, from a fixed hash (the mock-up's)
  tower: Float32Array; field: Float32Array; rand: Float32Array; colour: Float32Array };
export interface StardustPose { show: number; flight: number; clock: number; scale: number }
export interface StardustModel { points: THREE.Points; pose(p: StardustPose): void; dispose(): void }
export function buildStardust(spec: StardustSpec, tier: QualityTier): StardustModel;
/** What the stardust is posed by from the way out, the world's clock (still with reduced motion) and the screen. */
export function stardustPose(out: WayOutView | null, clock: number, reduced: boolean, pxPerRad: number): StardustPose | null;
```
`spec.tops` are the closed tops (`boardTops(places, 0)`), `core` the power board's radius (`STACK.core`), `radius` a category board's (`STACK.radius`). Sampling as `dustWorld`: a board at random (the power board with `core`), 60% on its top (radius √u), 40% on its rim (down to 0.2 m under its top); the field point at the tower point's angle ± 25°, 9 + 100 · u^0.9 m out, 7 m under the foot (± 0.25); 30% gold (1, 0.66, 0.3), the rest violet (0.45, 0.32, 1). The shader is `dustWorld`'s with the sphere removed: stagger 40%, arc up 5 + 9·r m and 4 m aside, the field turning 0.5 / (d + 12) rad/s and its wave 0.9 m, light 0.2 on the tower and 0.4 in the field (vA brightness × (1 + 3·vA) at 0.2, size × (1 + 0.6·vA)), 1–6 px, twinkle ±25%, additive, no depth write. `stardustPose` is null off the way out and before g 2.5, else `{ show: out.points (1 once flight > 0), flight: out.flight, clock: reduced ? 0 : clock, scale: pxPerRad }`.

- [ ] **Step 1: Write the failing tests** — counts by tier; every tower point on a closed board (|y − top| ≤ 0.2 + 1e-6 below a top, radius ≤ that board's + 1e-6); every field point 9 ≤ r ≤ 109 m, y within 0.25 of the foot − 7; gold share 0.3 ± 0.02 of 70 000; `stardustPose(wayOutAt(-1), …) === null`; at g 3 show ≈ 5/7; reduced clock 0; `buildStardust` gives a `THREE.Points` with those attributes and `dispose` frees its geometry and material.

- [ ] **Step 2: Run** `npx vitest run tests/unit/bob/build-stardust.test.ts` — Expected: FAIL (no module).

- [ ] **Step 3: Implement** as specified.

- [ ] **Step 4: Run** the same — Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -m "stardust: the tower's points and the field they settle in"`

---

### Task 6: The stardust and the tower in the scene

**Files:**
- Modify: `src/scene/bob/Void.tsx` (the world's build step, `WorldParts`, `showWorld`, the frame)
- Test: `tests/unit/scene/bob-void-parts.test.ts` (new, for the pure helper)

**Interfaces:**
- Consumes: `buildStardust`, `stardustPose` (Task 5), `QaFrame.out` (Task 2).
- Produces: `export function towerStands(qa: QaFrame | null): boolean` in `src/scene/bob/worldPath.ts` (true off the way out and while `out.solid`); `WorldParts.dust: StardustModel`.

- [ ] **Step 1: Write the failing test** `the tower stands off the way out`: `towerStands(null)`, `towerStands({ place: -1, out: wayOutAt(-1) })` true; at g 3.3 false; at place 3 false.

- [ ] **Step 2: Run** `npx vitest run tests/unit/scene/bob-void-parts.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement.** Build the stardust in the world's step (with the model, the gyro and the stars: added to the holder for `warm`, disposed on every path the others are), add its points to the scene with the world, hide it in `showWorld(…, false)`. Each frame on the stack: `world.model.group.visible = on && towerStands(path.qa)`, the gyro likewise; `dust.points.visible` and `dust.pose(…)` from `stardustPose(path.qa?.out ?? null, run.clock.time, reducedMotion, size.height · dpr / (2 tan(fov/2)))`, hidden while a project is open or close. Nothing else of the old world is hidden (the storm, the nebula, the gas stay).

- [ ] **Step 4: Run** `npx vitest run tests/unit/scene` and `npx tsc --noEmit` — Expected: PASS for the scene; tsc's remaining errors only in the Q&A files Task 8 rewrites.

- [ ] **Step 5: Commit** — `git commit -m "scene: the tower dissolves into the stardust on the way out"`

---

### Task 7: The LED screen

**Files:**
- Create: `src/ui/ledSky.ts`; Delete: `src/ui/outSky.ts`, `tests/unit/ui/out-sky.test.ts`
- Test: `tests/unit/ui/led-sky.test.ts`

**Interfaces:**
- Produces:
```ts
export const LED = { levels: 12, skip: 2, gain: 1.1, dot: [0.28, 0.6], line: { glow: 40 }, hush: { radius: 420, alpha: 0.82, at: 0.4 }, ripple: { gain: 0.5, width: 60, reach: 1.4 } } as const;
export function ledCell(width: number): number;                   // 6, or 5 at ≤ 700 px
export function ledLevel(luminance: number): number;              // floor(min(1.1 · √l, 0.999) · 12), 0..11
export const LED_TINTS: readonly string[];                        // 12 rgb() strings: (38,26,92) → (118,88,226) at 0.6 → (255,186,88) at 0.82 → (255,238,205)
export interface LedDraw { source: CanvasImageSource | null; line: number; end: number; size: { width: number; height: number }; core: { x: number; y: number } | null }
export interface LedSky { draw(d: LedDraw): void; clear(): void }
export function makeLedSky(canvas: HTMLCanvasElement): LedSky;
```
`draw` (as `scanWorld`'s `draw` with `drive`): sizes the canvas to the screen's CSS px; nothing over the line when `line` is 0; the frame drawn small, a cell a pixel; near-black (#030108) over `line · height`; each cell's level from its luminance plus the ripple (`end > 0`: + 0.5 · exp(−((dist to core − 1.4 · diagonal · end) / 60)²)), levels under 2 left out, batched by level, a dot `cell · (0.28 + 0.6 · level / 11)` centred; the hush (radial, at (width / 2, 0.4 · height), alpha 0.82 · end); the line while `line < 1` (2 px rgba(255,236,196,0.95), a 40 px gold glow above). `clear` empties it.

- [ ] **Step 1: Write the failing tests** with a recording fake 2D context (as the old out-sky test faked one): levels and tints; `ledCell(390) === 5`, `ledCell(1440) === 6`; `draw` with line 0 fills nothing; with line 0.5 fills the dark over the top half only and dots only there; `clears when the grab gives nothing` (source null → the canvas cleared, no dark fill); the hush only with end > 0.

- [ ] **Step 2: Run** `npx vitest run tests/unit/ui/led-sky.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement**; delete `outSky.ts` and its test.

- [ ] **Step 4: Run** the same — Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -m "leds: the digitize's screen from the frame grab, round 14's sky gone"`

---

### Task 8: The Q&A's words with the scroll

**Files:**
- Modify: `src/ui/QaRing.tsx`, `src/ui/qaWriters.ts`, `src/scene/bob/qaScene.ts`, `src/styles/base.css` (the Q&A block, from `/* The Q&A (spec 2026-10-29…` to before `/* ---------- a project's own page ---------- */`)
- Test: `tests/unit/ui/qa-ring.test.ts`, `tests/unit/scene/bob-qa-scene.test.ts`, `tests/unit/ui/end-arrival.test.ts` (ids kept)

**Interfaces:**
- Consumes: `WayOutView` (Task 2), `makeLedSky` (Task 7), `requestGrab` (`../frameGrab`).
- Produces:
  - DOM (`QaRingParts`): `section#qa.qa[inert]` > `canvas.qa-leds` (aria-hidden), `div.qa-band`, `div.qa-column` > `div.qa-track` > `article.qa-block[data-k]` × 6 (`h3.qa-question#qa-ask-{k}` tabIndex −1, then `p.qa-text` or the placeholder with its tag), then `article.qa-end` as now (`#qa-end-title` kept). No buttons per question, no count, no rail.
  - Writer: `QaParts { root, section, column, track, band, end }`; `QaView { on: boolean; column: number; band: number; offset: number; at: number | null; endOn: boolean }`; `writeQa`, `clearQa`, `qaWritten` as now (only what differs); `data-qa` while on, `data-qa-at` the question within 0.18 of the place (the end's mark once `endOn`), `data-qa-end` once `endOn`; `--qa-column`, `--qa-band` on the section; the track's `transform: translate3d(0, {offset}px, 0)`; the end `hidden` but at `endOn`. `QA_MOVING_ATTRIBUTE` and the light's writers go.
  - Pure: `qaOffset(centres: readonly number[], place: number, line: number): number` (line − the centre at `place`: block k's at k, linear between, on past the last and before the first by the last and first gaps); `qaReadingLine(size): number` (0.5 · height, 0.62 · height at ≤ 700 px wide).
  - Scene: `QaScenePose` gains `core: { x: number; y: number } | null` (the light on the screen, CSS px); `QaJourney { place; stretch; g; at; line }`.
- CSS (from `r15mock.css` `.r15-col` …, `.r15-scrim`): column at left max(16px, 7.5vw), top 0, bottom 0, width min(500px, 100vw − 32px), overflow hidden, mask 24% / 76%, opacity `var(--qa-column)`; block padding-bottom 24vh; question clamp(22px, 2vw, 28px) weight 500, the site's question colour; answer clamp(16px, 1.25vw, 18px), line-height 1.75; band left 82% → 55% at 30% → clear at 52%, opacity `var(--qa-band)`; LED canvas inset 0 under the band; end centred at 40% of the height. Phone (≤ 700 px): column 16 px each side, full width; band from the bottom; end centred. Reduced motion: the end's words without blur. The header stays over the Q&A (`html[data-qa] .site-header { z-index: 4 }` kept).

- [ ] **Step 1: Write the failing tests**
  - qa-ring: renders six blocks with the dictionary's questions and answers (NL and EN), the placeholder with its tag for an unsent answer, no `button` inside `.qa-column`, `#qa-ask-0` focusable by script, the end's words and its two buttons as before.
  - writer: `qaOffset([100, 500, 900, 1300, 1700, 2100], 1, 450) === -50`; at 1.5 → −250; at 5.5 → 450 − 2300; at −0.5 → 450 − (−100); writes `data-qa-at="2"` at place 2.1 and none at 2.5; `endOn` writes `data-qa-at="6"` and `data-qa-end`, unhides the end.
  - scene: at place 3 with centres measured from a fake section the track's offset is `qaOffset(centres, 3, line)`; `re-measures on a new screen` (a size change re-reads the centres, the question at the line stays); the LEDs are asked a grab only while `line > 0` and cleared otherwise.

- [ ] **Step 2: Run** `npx vitest run tests/unit/ui tests/unit/scene/bob-qa-scene.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement** the DOM, the writer, the scene (with reduced motion it reads the view as `wayOutAt(place, true)`, so the LEDs and the end come at once from 5.5; the path itself always reads `wayOutAt(place)`), (measure the blocks' word middles, `offsetTop + (offsetHeight − paddingBottom) / 2`, once per screen size; offset from `qaOffset`; column, band, endOn from the view; LEDs: `requestGrab(source → leds.draw({ source, line, end, size, core }))` while `line > 0`, else `clear()`) and the CSS; pass `core` from the Void (`lightPoint` as CSS px).

- [ ] **Step 4: Run** `npm test` and `npx tsc --noEmit` — Expected: all PASS, tsc clean.

- [ ] **Step 5: Commit** — `git commit -m "q&a: plain words in a column that goes with the scroll, the end on the LEDs"`

---

### Task 9: The proof harness

**Files:**
- Modify: `tools/proof/needle.mjs`

**Interfaces:**
- Consumes: `WAY_OUT.dissolve`, `QA_QUESTION_PX`, the DOM and `frame.journey.qa` (`{ place, stretch, g, at, line }`) of Tasks 2, 4, 8.

- [ ] **Step 1: Rewrite `qaRing` and `qaEnd`**, keeping their names and sizes (1440 × 900, 390 × 844 touch, /en/): one notch at the door plays the dissolve (at 2.9 s the stardust's points drawn: the canvas brighter over the tower's box than at the door; at 3.6 s the tower not drawn, `journey.world` explode ≈ 0, `journey.qa.stretch === 'dissolve'`), rests on question 1 within 9 s (`data-qa-at="0"`, the column shown, the core right of the words' box); 520 px of wheel in 100 px notches moves the place by 1 ± 0.05 and the next question onto the line; a fast fling (12 notches at 16 ms) and a slow one both end with the place within the Q&A, never at a step; past question 6 the LED canvas has dots over the line and none under it mid-way (place 5.48), the end's words, title focusable, both buttons working (contact, back to the start); up from the end back through the Q&A and one more gesture up from question 1 plays the dissolve back to the door with the tower whole; a phone's question whole on the screen; reduced motion: no half-closed tower, LEDs at once at the end.
- [ ] **Step 2: Update the other steps' Q&A reads** (`glowBreathes`, `engraved`, `reducedMotion`, `worldStep`, `voidHold`, `lightDive`, `bridge`, `resize`, `keyboard`, `voidFail`, `stills`, `scrollBob`, `poseOnTheFrame`, `stepStop`, `lumaOf`, `expectVoid`, `areasStep`): `blueprintAt` → `dissolveAt(s)` (`WAY_OUT.dissolve`), old stretches → the new ones, `.qa-frame`/`.qa-ask`/`.qa-sky`/`data-qa-moving` → the new parts; `stills` takes the dissolve at 5 s and the digitize at place 5.48 in place of the blueprint. `areasStep` keeps its checks (each board framed from the front, its projects inside the screen) on the turned stops.
- [ ] **Step 3: Build and run it all**

Run: `npm run build`, then serve (`PORT=4421 node tools/serve-pages.mjs`) and `BASE=http://localhost:4421 PLAYWRIGHT_CORE=C:/Users/bhcco/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright-core node tools/proof/needle.mjs`
Expected: every step passes; `npm run audit` passes.

- [ ] **Step 4: Commit** — `git commit -m "proof: the harness walks the half turn, the dissolve, the free Q&A and the digitize"`

---

### Task 10: The whole of it, looked at

**Files:** none new (fixes go where they belong, each with its test).

- [ ] **Step 1:** `npm test`, `npm run typecheck`, `npm run build`, `npm run audit`, the full harness — all green; note the counts.
- [ ] **Step 2:** Stills for Bob at 1440 × 900 and 390 × 844 (the way down a floor, mid dissolve, question 1, question 4, mid digitize, the end) beside the mock-up's sheets (`.superpowers/r15/ways-mix.jpg`), on a review page in `.superpowers/r15-build/` served on 4476; compare look and timing by eye, fix differences against the spec.
- [ ] **Step 3:** Commit the fixes; record the run in the ledger; hand to Bob for his merge word (no push without it). On his go-live word, after the push: the Deploy and CodeQL runs green and `gh api repos/bhccob/Portfolio-BC/code-scanning/alerts?state=open` still empty.
