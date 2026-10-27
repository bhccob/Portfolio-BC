# The Engraved Way Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (Bob's rule: no subagents, the work is done inline) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The fall runs twice as long in scroll, the light falls down the compass's engraved shaft that opens into floating rings, and every trip between projects rides an engraved gold orbit line, as in the approved mock-up.

**Architecture:** The pace is one constant in the chapters. What shows where is a pure module (`src/scene/bob/engravedWay.ts`): the shaft's ring specs, the trips' points from the path, and each part's level for a journey pose, so every rule is unit-tested without three. A three.js builder (`src/engine/bob/build/engraved.ts`) turns the specs into meshes with one additive shader that glows near the light; the Void builds it per path (as it builds the look back's line) and writes the levels each frame, and the debug bridge reports them for the proof harness.

**Tech Stack:** React Router 8 (prerendered), React Three Fiber 9.8, three 0.186, Vitest, tsx, the proof harness (`tools/proof/needle.mjs`, playwright-core with headless Edge).

**Spec:** `docs/superpowers/specs/2026-10-27-bob-engraved-way-design.md`. The approved mock-up is the throwaway branch `engraved-mock` (worktree `.claude/worktrees/engraved-mock`, served on 4434): `src/engine/bob/build/engraved.ts`, the hook in `src/scene/bob/Void.tsx` (`shaftLevel`, `tripLevels`, `engravedFor`) and `FALL_PACE` in `src/state/chapters.ts`. Its numbers are the build's starting values; its code is not copied unreviewed.

## Global Constraints

- Dark, calm, one focal point; the light stays the brightest thing the eye follows.
- The fall and the trips keep the home's luma gate: mean luma 0.11 at most (the insides keep their own 0.15).
- The fall is twice as long: the way's frames 1 to 256 over `FALL_PACE = 6` viewport heights per 299 frames (3 before). Frames, the light's places, the facts and their sides do not change.
- No pause or stop at a fact; the key stops are the same fifteen.
- Nothing engraved crosses a fact's words: the narrow shaft (the throat) is gone before the first fact shows (way frame `F.FALL`, 61).
- At a bead (its orbit and inside) the lines fade away; the circling, label, touch points and inside are as approved.
- The look back shows the trips' lines faintly (level 0.32 at most), the way's own gold line the brightest.
- No new files to download: rings and lines are geometry and a canvas texture.
- 3D off, no WebGL and the fallback card are unchanged. Reduced motion shows the engravings as stills at the stops.
- Way 2: every trip on the way gets its line.
- Ports: the site preview on 4421, the review page on 4433. Never 4399.
- Nothing is merged or pushed without Bob's OK. Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A window resized, or a phone turned, mid-trip.** The path changes with the aspect: the trips' lines are rebuilt for it, the old ones freed, and the trip's level stays whole. Pinned in Task 4 (`engravedFor` rebuilds per path) and Task 5 (harness `resize`, the bridge's trip level after the turn).
2. **A slow phone.** On the medium tier the shaft keeps every other ring and each trip two arcs; on the low tier every other ring and no arcs. Pinned in Task 3 (`ring and arc counts by tier`).
3. **A fact under an engraving.** The throat's level is 0 at every way frame where a fact shows; the hall's rings sit above the light in the side view. Pinned in Task 2 (`the throat is gone whenever a fact shows`).
4. **More than three projects (Way 2).** `tripPoints` gives one line per travel of the path, and `tripLevels` an entry for each. Pinned in Task 2 (with a five-project path).
5. **Leaving and coming back.** Back from a project's page, the story at an arrival or inside: the levels follow the pose alone (no state carried), so the lines are as they should be at once. Pinned in Task 2 (`tripLevels` is a function of the pose) and Task 5 (harness `bead-open` unchanged and passing).

---

### Task 1: The slower fall

**Files:**
- Modify: `src/state/chapters.ts` (the pace in `LIGHT_UNITS`, `frameOfPlace`, `placeOfFrame`)
- Modify: `tools/proof/needle.mjs` (the two literal paces: the `bridge` step's `1 + (3 * (121 - 1)) / 299`, `light-facts`'s `1 + (3 * (f - 1)) / 299`; both become `placeOfFrame`)
- Test: `tests/unit/state/chapters.test.ts`

**Interfaces:**
- Produces: `export const FALL_PACE = 6;` in `src/state/chapters.ts` (viewport heights per 299 way frames); `LIGHT_UNITS = (FALL_PACE * (HAND_F - 1)) / (WAY_FRAMES - 1)`.

- [ ] **Step 1: Write the failing test** in `tests/unit/state/chapters.test.ts`, replacing the `765 / 299` constants with the doubled pace:

```ts
it('runs the fall over twice the scroll: 6 viewport heights per 299 frames', () => {
  expect(FALL_PACE).toBe(6);
  expect(LIGHT_UNITS).toBeCloseTo((6 * 255) / 299, 12);
  for (const f of [1, 81, 121, 161, 201, 241, 256]) expect(frameOfPlace(placeOfFrame(f))).toBeCloseTo(f, 9);
  // Each fact (40 frames apart) is twice the scroll apart: 0.803 units, 0.401 before.
  expect(placeOfFrame(121) - placeOfFrame(81)).toBeCloseTo((6 * 40) / 299, 12);
  expect(keyStops(HOME_CHAPTERS)).toHaveLength(15);
});
```

- [ ] **Step 2: Run it.** `npx vitest run tests/unit/state/chapters.test.ts`. Expected: FAIL (`FALL_PACE` is not exported).
- [ ] **Step 3: Implement** `FALL_PACE` and use it in the three places that read 3 today. Update the file's other cases that name `L = 1 + 765 / 299` to `pathStart(HOME_CHAPTERS)`.
- [ ] **Step 4: Run every unit test and the typecheck.** `npx vitest run && npm run typecheck`. Expected: PASS (tests that name places through the chapters' functions follow; fix any literal pace the run turns up the same way and ledger it).
- [ ] **Step 5: Commit.** `feat: the fall runs twice as long, so each fact stays on screen twice the scroll`

### Task 2: The engraved way's rules, pure

**Files:**
- Create: `src/scene/bob/engravedWay.ts`
- Test: `tests/unit/scene/bob-engraved-way.test.ts`

**Interfaces:**
- Consumes: `JourneyAt` (`stretch`, `frame`), `PathFrame` (`part`, `index`, `t`, `black`), `Path.frameAt(q)`, `F.FALL` and `factAt(f)` from `./lightDive`.
- Produces:
  - `export interface RingSpec { y: number; radius: number; width: number; tilt: [number, number]; zone: 'throat' | 'hall' }`
  - `export const ENGRAVED` with the mock-up's values: `THROAT = { top: -0.4, bottom: -10.5, radius: 1.45, spacing: 0.46, width: 0.07 }`, `HALL = { top: -4.6, open: -8.2, bottom: -13.2, radius: 5.2, openRadius: 12, spacing: 0.34, openSpacing: 1.4 }`, `THROAT_IN = [8, 40]`, `THROAT_OUT = [46, 60]`, `HALL_IN = [52, 72]`, `HALL_OUT_T = 0.6` (of the first travel), `FIRST_TRIP_FROM_T = 0.12`, `FIRST_TRIP_IN_T = [0.05, 0.25]`, `ORBIT_OUT_T = 0.35`, `LOOK = { level: 0.32, in: [0.15, 0.7] }`.
  - `export function shaftRings(): RingSpec[]` — the throat's rings (constant radius) and the hall's (opening below `HALL.open` by smoothstep: radius to `openRadius`, spacing to `openSpacing`, width 0.13 to 0.25, a small tilt).
  - `export interface EngravedLevels { throat: number; hall: number; trips: number[] }`
  - `export function engravedLevels(at: Pick<JourneyAt, 'stretch' | 'frame'>, path: Pick<PathFrame, 'part' | 'index' | 't' | 'black'> | null, trips: number): EngravedLevels`
  - `export function tripPoints(path: Pick<Path, 'frameAt'>, step = 0.02): [number, number, number][][]` — the light's places along each travel, the first trip from `t >= FIRST_TRIP_FROM_T`, stopping at the look back.

- [ ] **Step 1: Write the failing tests** in `tests/unit/scene/bob-engraved-way.test.ts`:

```ts
it('builds the throat round the fall and the hall that opens out toward the hand-over', () => {
  const rings = shaftRings();
  const throat = rings.filter((r) => r.zone === 'throat');
  const hall = rings.filter((r) => r.zone === 'hall');
  expect(throat.every((r) => r.radius === 1.45)).toBe(true);
  expect(Math.min(...hall.map((r) => r.radius))).toBe(5.2);
  expect(Math.max(...hall.map((r) => r.radius))).toBeGreaterThan(10);
  // Opening: the gaps grow below HALL.open.
  const ys = hall.map((r) => r.y);
  expect(ys[1]! - ys[0]!).toBeCloseTo(-0.34, 9);
  expect(ys.at(-2)! - ys.at(-1)!).toBeGreaterThan(1);
});
it('shows the throat from above at the fall's start and the hall from the turn on', () => {
  const at = (frame: number) => engravedLevels({ stretch: 'light', frame }, null, 3);
  expect(at(1)).toMatchObject({ throat: 0, hall: 0 });
  expect(at(40).throat).toBe(1);
  expect(at(121)).toMatchObject({ throat: 0, hall: 1 });
});
it('the throat is gone whenever a fact shows', () => {
  for (let f = 1; f <= 256; f += 0.25) if (factAt(f).opacity > 0) expect(engravedLevels({ stretch: 'light', frame: f }, null, 3).throat, `at ${f}`).toBe(0);
});
it('rides each trip on its own line, out early in the orbit, none inside, all faint in the look back', () => {
  const lv = (part: PathPart, index: number, t: number, black = 0) => engravedLevels({ stretch: part, frame: null }, { part, index, t, black }, 3);
  expect(lv('travel', 1, 0.5).trips).toEqual([0, 1, 0]);
  expect(lv('travel', 0, 0.02).trips[0]).toBe(0); // the first line comes in after the turn
  expect(lv('travel', 0, 0.5).hall).toBeGreaterThan(0); // the hall fades out over the first trip
  expect(lv('orbit', 1, 0.5).trips[1]).toBe(0);
  expect(lv('inside', 1, 0.5).trips).toEqual([0, 0, 0]);
  expect(Math.max(...lv('look', -1, 1).trips)).toBeCloseTo(0.32, 9);
  expect(lv('sheet', -1, 0.5, 1).trips).toEqual([0, 0, 0]);
});
it('gives every travel its line, five projects too (Way 2)', () => {
  expect(tripPoints(makePath(16 / 9))).toHaveLength(3);
  expect(tripPoints(makePath(16 / 9, buildChapters({ path: FIVE_CATEGORIES })))).toHaveLength(5);
  // The first trip's line begins after the turn out of the fall: none of its points at the hand-over.
  const first = tripPoints(makePath(16 / 9))[0]!;
  const hand = makePath(16 / 9).frameAt(0).light.position;
  expect(Math.hypot(first[0]![0] - hand[0], first[0]![1] - hand[1], first[0]![2] - hand[2])).toBeGreaterThan(0.3);
});
```

(`FIVE_CATEGORIES` is five category ids from `src/data/categories.ts`, as `bob-light-path.test.ts` builds its five-project chapters.)

- [ ] **Step 2: Run them.** `npx vitest run tests/unit/scene/bob-engraved-way.test.ts`. Expected: FAIL (no module).
- [ ] **Step 3: Implement** `src/scene/bob/engravedWay.ts`: pure, no three. The levels are smoothsteps over the windows in `ENGRAVED`, as in the mock-up's `shaftLevel` and `tripLevels`, with the throat out by `THROAT_OUT[1]` (60, before `F.FALL`).
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit.** `scene: the engraved way's rules: the shaft's rings, the trips' points and each part's level for a pose`

### Task 3: The engravings in three.js

**Files:**
- Create: `src/engine/bob/build/engraved.ts`
- Test: `tests/unit/bob/build-engraved.test.ts`

**Interfaces:**
- Consumes: `RingSpec`, `EngravedLevels` (Task 2); `QualityTier` (`src/engine/quality.ts`); `palette.goldLight`.
- Produces:
  - `export interface EngravedModel { group: THREE.Group; update(levels: EngravedLevels, light: readonly [number, number, number] | null, fog: { near: number; far: number }): void; dispose(): void }`
  - `export function buildEngraved(rings: readonly RingSpec[], trips: readonly (readonly [number, number, number])[][], tier: QualityTier): EngravedModel`
  - `export const ENGRAVED_LOOK` with the mock-up's shader values: throat `{ base: 0.12, glow: 1.2, reach: 1.1, axes: [0, 1, 0], fog: [14, 40] }`, hall `{ base: 0.14, glow: 0.95, reach: 1.4, axes: [0, 1, 0] }`, line `{ base: 0.34, glow: 1.4, reach: 1.1, width: 0.07 }`, arc `{ base: 0.14, glow: 0.3, reach: 3, width: 0.05, count: 3 }`.

- [ ] **Step 1: Write the failing tests** (`tests/unit/bob/build-engraved.test.ts`, three in node with a canvas stub as the other builders' tests use):
  - `builds one mesh a ring, one line and three arcs a trip on the high tier`;
  - `thins out on the medium tier (every other ring, two arcs) and the low (every other ring, no arcs)`;
  - `draws additively, writes no depth, and hides the group while every level is 0`;
  - `update sets each material's level and the light's place; the throat keeps its own fog`;
  - `dispose frees every geometry, material and the texture`.
- [ ] **Step 2: Run them.** `npx vitest run tests/unit/bob/build-engraved.test.ts`. Expected: FAIL (no module).
- [ ] **Step 3: Implement** from the mock-up's `engraved.ts`: the canvas engraving (edge lines, ticks, longer ticks every fifth, a glyph every 230 px), the ring and ribbon geometries (u along the length), one `ShaderMaterial` per part kind (additive, `depthWrite: false`, the glow `exp(-|((p - light) * axes)|² / reach²)`, a linear fog by view depth), the arcs from a seeded generator round each trip's middle. Ribbons laid across `cross(tangent, up)`, falling back to x where the way runs straight up or down.
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit.** `engine: the engraved way's meshes: the shaft's rings and the trips' lines and arcs, glowing near the light`

### Task 4: Into the void, and onto the bridge

**Files:**
- Modify: `src/scene/bob/Void.tsx` (an `engravedFor(path)` beside `wayFor`, the update each frame, cleared where the void is not posed)
- Modify: `src/state/frame.ts` (`journey.engraved: EngravedLevels | null`), `src/debug/needleDebug.ts` and `src/debug/useNeedleDebug.ts` (the field on the bridge)
- Test: `tests/unit/scene/bob-void.test.ts`, `tests/unit/debug/needle-debug.test.ts`

**Interfaces:**
- Consumes: `shaftRings`, `tripPoints`, `engravedLevels` (Task 2); `buildEngraved` (Task 3).
- Produces: `window.__needleDebug().journey.engraved: { throat: number; hall: number; trips: number[] } | null` (null where the void is not posed).

- [ ] **Step 1: Write the failing tests:**
  - in `needle-debug.test.ts`: `reports the engraved way's levels on the journey` (the field is copied, a fresh array, null when unset);
  - in `bob-void.test.ts`, reading the Void's source as its other cases do: `builds the engraved way per path, frees the last on a new aspect, and writes its levels each frame from engravedLevels`.
- [ ] **Step 2: Run them.** `npx vitest run tests/unit/debug tests/unit/scene/bob-void.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** In the Void: `engravedFor(path)` builds `buildEngraved(shaftRings(), tripPoints(path), tier)` once per path (a new aspect frees the old: `scene.remove`, `dispose`), and each posed frame calls `update(engravedLevels(pose.at, pose.path, trips), pose.light?.position ?? null, scene fog)` and writes `frame.journey.engraved`; unposed, levels 0 and the field null. Under `?proof` only, as the other journey fields.
- [ ] **Step 4: Run every unit test, the typecheck and the build.** `npx vitest run && npm run typecheck && npm run build`. Expected: PASS.
- [ ] **Step 5: Look at it.** Stills on 4421 beside the mock-up's on 4434 at way frames 32, 121, 245 and the trips' middles, laptop and phone (the scratchpad's still script). Expected: the same engravings; record any difference as a ruling.
- [ ] **Step 6: Commit.** `scene: the engraved way in the void: the compass shaft through the fall and an engraved line on every trip`

### Task 5: The harness proves it

**Files:**
- Modify: `tools/proof/needle.mjs`

- [ ] **Step 1: Write the steps.**
  - **Add `engraved`** (1440x900 and 390x844 touch): from BOB from above, wheel notches (swipes) through the fall: the bridge's `journey.engraved.throat` is above 0.9 at way frame 32 and 0 at every sample where a fact shows; `hall` above 0.9 at fact 02's peak; each trip's level 1 at its travel's middle and 0 inside its bead; in the look back every trip 0.32 at most; the scroll from fact 01's peak to fact 05's is twice what it was (`placeOfFrame(241) - placeOfFrame(81)` = 3.21 units); stills at way frame 32, 121 and the second trip's middle gated at the home's luma (0.11).
  - **Update** `resize`: turned mid-trip, `journey.engraved.trips[k]` is still 1 for the trip in view and no console error.
  - **Update** `stills`: add way frames 32 and 121 to the gated places.
- [ ] **Step 2: Run the whole harness against the build.** `npm run build`, the preview on 4421, then `PLAYWRIGHT_CORE=C:/Users/bhcco/Downloads/Funcial/node_modules/playwright-core BASE=http://127.0.0.1:4421 node tools/proof/needle.mjs`. Expected: every step PASS (a step that fails on `ERR_NO_BUFFER_SPACE` is re-run alone).
- [ ] **Step 3: Commit.** `proof: the engraved way by real input: the throat, the hall, the trips' lines and the slower fall`

### Task 6: The gates, the recording and Bob's review

**Files:**
- Create, untracked: `.superpowers/light-path-site-review/review.html` (it replaces the light path's unshown review page: one page for the whole build), with its videos and stills.

- [ ] **Step 1: Run every gate.** `npx vitest run`; `npm run typecheck`; `npm run build`; the auditor (`"/c/Program Files (x86)/Steam/steamapps/common/Blender/5.2/python/bin/python.exe" -I tools/site_audit.py dist/client`); the whole harness. Expected: all PASS.
- [ ] **Step 2: Record the site** at 1440x900 and 390x844 from BOB from above through the fall at an even pace, along the path and into the credits (the scratchpad's video script, as the mock-up's video was made), encoded with `bob_encode_w.py`; stills beside the engraved mock-up's at the same places.
- [ ] **Step 3: Write `review.html` for Bob**, formal and plain: what is built (the light path and the engraved way), where it differs from the mock-ups (the abacus as one piece; the label's 18 px; the contact form's height; the phone's lighter glass; anything Task 4 ruled), how to see it (`PORT=4421 npm run preview`), and his decisions (merging `bob-dive`, Way 2, the label's size, removing the throwaway `engraved-mock` branch). Serve it with `npx vite .superpowers/light-path-site-review --port 4433 --strictPort`.
- [ ] **Step 4: The final review**, of the whole branch since the light path's plan (`f4cb338..HEAD`), as a self-review (no subagent): `Final review: self-review (no subagent tool)` in both plans' ledgers, and said to Bob.
- [ ] **Step 5: Stop for Bob.** Commit any tracked changes: `docs: the light path and the engraved way in the site, for Bob's review`. Nothing is merged or pushed without his OK.
