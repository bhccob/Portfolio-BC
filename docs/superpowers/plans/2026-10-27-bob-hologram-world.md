# The Hologram World Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Bob's standing rule for this project: no subagents, so this plan runs inline (executing-plans).

**Goal:** After the fall, the light powers a round hologram board in the nebula: the whole world at one stop, an area per category at the next stops, a look back, and a click that opens a project Overworld's way, in place of the beads and their path.

**Architecture:** The board's places and the camera's way round its centre are pure modules (`worldLayout.ts`, `around.ts`); the world is built in code (`src/engine/bob/build/world.ts`, after the mock-up's `world.ts`). The scroll's chapters become LAND, an AREA per category and LOOK, and a pure world path (`worldPath.ts`) replaces the beads' path (`lightPath.ts`) in one switch, the beads and their file going with it. The Void then builds and poses the world; the open view is the inside's machinery (history state, focus flight, every way out) with Overworld's panel and arrows.

**Tech Stack:** React Router 8 (prerendered), R3F 9.8, three 0.186, zustand, Vitest, tsx; the proof harness in Playwright-core headless Edge.

**Spec:** `docs/superpowers/specs/2026-10-27-bob-hologram-world-design.md`. Reference (throwaway, read but not copied as is): the mock-up in `.superpowers/holo-world-mockup/` (`data.ts`, `world.ts`, `main.ts`), its review in `.superpowers/holo-world-review/`.

## Global Constraints

- Branch `bob-world`, from `bob-nebula` (487d73e). Nothing merged or pushed without Bob.
- Dark, calm, one focal point: the CPU and the light in the world; the open project in its view.
- Luma: every stop's still, mean 0.11 at most, desk and phone; an open project 0.15 at most.
- The canvas sleeps: the float, the pads' rings, the current's pulse and the gears run on the clock only for `IDLE_SECONDS` (12 s) after the last input or arrival.
- Reduced motion: stops by the step fade; the power as a fade; no float, no ticking; open and close by the step fade.
- No new 3D files; the world's textures are canvases built off the frame and warmed before the landing hold lets go.
- Up to `PATH_LIMIT` (5) projects on the way; the categories are `src/data/categories.ts`'s, in their number order.
- NL first, EN at /en/; only the site's own data about Bob; the Cookies Clicker classmate is never named.
- Every shader `pow` takes a base held to 0 or more (the mock-up's white blob was a `pow` of a negative base).
- No subagents; never edit `.impeccable/config.json`; never use port 4399; commit trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A click while the camera glides between two stops** does nothing; a project opens only at rest. Pinned in Task 6 (`opensOnClick`).
2. **An arrow pressed twice quickly:** the flight turns toward the newest project from where the camera is, with no jump. Pinned in Task 6 (`retargets a flight in progress from where it is`).
3. **A resize while a project is open** (laptop to phone width): the open view and the panel re-place for the new shape. Pinned in Task 3 (`openShot` per aspect) and Task 7 (`open`, resize).
4. **The longest English text on a phone:** Jontai Energy's English summary at 390 × 844 never covers Terug or the arrows. Pinned in Task 7 (`open`, phone, /en/).
5. **Back from a project page** lands in the open project; Back again at the stop it was opened from. Pinned in Task 7 (`open`).

---

### Task 1: The world's places, and the way round its centre

**Files:**
- Create: `src/scene/bob/worldLayout.ts`, `src/scene/bob/around.ts`
- Test: `tests/unit/scene/bob-world-layout.test.ts`, `tests/unit/scene/bob-around.test.ts`

**Interfaces:**
- Produces: `BOARD = { radius: 4, drop: 9, hover: 0.5, apart: 1.3, turn: 0.5 }`; `boardCentre(): Vec3` (the light's place at way frame `HAND_F`, `drop` m straight down); `AREA_ANGLE: Record<CategoryId, number>` (secure-element at the board's left, front-panel at its right, oscillator behind the CPU: the mock-up's `at` places); `areasOnPath(list?)` → `{ category: CategoryId; projects: ProjectId[] }[]` (the projects on the way grouped by category, in the categories' number order); `worldPlaces(areas)` → `{ category; centre: Vec3; projects: { id: ProjectId; pad: Vec3; out: Vec3 }[] }[]` (pads on the area's ring, `apart` along it, `out` the way away from the CPU); `objectKind(id)` → `'lock-chip' | 'solar' | 'crystal' | 'chip'`; `around(a, b, centre, e)` (the point a share `e` of the way from `a` to `b` round `centre`, seen from above: turning the short way, closing in or out and rising evenly; straight where either end is within 0.5 m of the centre's axis); `aroundShot(a, b, centre, e)` (the position and the target each by `around`, the fov evenly).

- [ ] **Step 1: Write the failing tests:** `lays the board level, straight below the light at the hand-over, 9 m down`; `puts each category's area where the mock-up did` (angles by value); `groups the projects on the way by category, in the categories' order`; `stands two projects of one category 1.3 m apart on the area's ring, both facing out`; `gives Funcial, Jontai Energy and Cookies Clicker their objects, any other a plain chip`; around: `keeps its distance from the centre between the two ends' distances`, `turns the short way`, `ends exactly at each end`, `goes straight near the axis`.
- [ ] **Step 2: Run them.** `npx vitest run tests/unit/scene/bob-world-layout.test.ts tests/unit/scene/bob-around.test.ts`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** both as pure modules (no three, no React; tuples).
- [ ] **Step 4: Run them again.** Expected: PASS.
- [ ] **Step 5: Commit.** `world: the board's places below the fall, the areas and their pads, the way round the centre`

### Task 2: The world, built in code

**Files:**
- Create: `src/engine/bob/build/world.ts`
- Test: `tests/unit/bob/build-world.test.ts`

**Interfaces:**
- Consumes: `worldPlaces`, `objectKind`, `BOARD` (Task 1); each project's touch points (`projects.byId(id)`'s).
- Produces: `WORLD_LOOK` (the mock-up's levels: the circuit's three layers, the fill, the pads, the lid's glow; the circuit's canvas 2048 on high, 1024 on medium and low; fine traces 380, 240, 140); `buildWorld(places, tier, canvas?)` → `WorldModel = { group; hits: THREE.Object3D[] (one per project, `userData.id`); anchors(id): THREE.Object3D[] (one per touch point, in the data's order); top(id): THREE.Object3D (its name's anchor); pose(input: { power; flash; clock; levels: Record<ProjectId, number>; open: Record<ProjectId, number>; float: number }): void; dispose(): void }`; parts named `world:board`, `world:cpu`, `world:pad:<id>`, `world:object:<id>`.

- [ ] **Step 1: Write the failing tests:** `names its board, its CPU, and a pad and an object for each project`; `gives each project one anchor per touch point, in the data's order`; `lifts Funcial's lid as it opens and sets it back as it closes`; `lights Jontai Energy's cells in turn as it opens`; `turns the gears only by the clock it is given` (the same clock gives the same angle; no `Date.now` or `performance.now` in the module); `draws the circuit smaller and sparer on the lower tiers`; `holds every shader pow's base at zero or more` (each `pow(` in its shader strings has `max(` or `clamp(` as its first argument); `frees its geometries, materials and textures on dispose`.
- [ ] **Step 2: Run them.** `npx vitest run tests/unit/bob/build-world.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** after the mock-up's `world.ts` (the board, the CPU with the compass lid, the pads, the objects; the lock the right way up seen from outside; objects turned `BOARD.turn` toward their views), as a builder like `nebula.ts`: canvases made when asked, its clock given, never read.
- [ ] **Step 4: Run them again.** Expected: PASS.
- [ ] **Step 5: Commit.** `world: the board, the CPU with the compass, the pads and the projects' objects, built in code`

### Task 3: The world's chapters and path, in place of the beads'

The one switch: the chapters, the path and everything that read the beads' path change together, so no task leaves the site half one, half the other. The world is not drawn yet (Task 4): after this task the light lands where the board will be.

**Files:**
- Create: `src/scene/bob/worldPath.ts`, `src/ui/projectOpen.ts` (the openers moved out of `BeadLabel.tsx`: `lendOpener`, `openBead`, `openInside`, `closeInside`, `viewInside`, `openAt`)
- Modify: `src/state/chapters.ts`, `src/scene/bob/journey.ts` (`Stretch`, `journeyAt`, `journeyPoseAt`, `focusShotFor` = `openShot`; `BEADS` goes), `src/state/machine.ts`, `src/input/target.ts`, `src/scene/bob/stepFade.ts`, `src/scene/bob/landingHold.ts`, `src/state/routeSync.ts` (`placeForProject`), `src/ui/SkipButton.tsx`, `src/scene/bob/voidPose.ts` (`pointerMode`), `src/scene/bob/focus.ts` (`restsAt`), `src/scene/bob/endView.ts`, `src/engine/bob/shots.ts`, `src/scene/bob/nebulaWay.ts` (`cloudLayout(sights, tier)`, `nebulaLevels` by the world's parts), `src/engine/bob/build/nebula.ts` (round the board's centre), `src/scene/bob/engravedWay.ts` and `src/engine/bob/build/engraved.ts` (the trips' lines go, the shaft stays), `src/scene/bob/Void.tsx` (the beads and every part of theirs go), `src/scene/bob/Opening.tsx`, `src/scene/bob/inside.ts` and `src/ui/InsideControls.tsx` (the openers from `projectOpen.ts`), `src/app/routes/home.tsx`, `src/i18n/nl.ts` and `src/i18n/en.ts` (the bead labels' words go), `src/state/frame.ts`, `src/debug/needleDebug.ts`, `src/debug/useNeedleDebug.ts`
- Delete: `src/scene/bob/lightPath.ts`, `src/engine/bob/build/beads.ts`, `src/engine/bob/beadBuild.ts`, `src/engine/bob/beadMotion.ts`, `src/scene/bob/beadFloat.ts`, `src/scene/bob/offPath.ts`, `src/engine/bob/build/wayLine.ts`, `src/ui/BeadLabel.tsx`, `public/models/bob-beads.glb`, `src/assets/beads/`, `tools/blender/export_beads.py`, and their tests and fixtures (`bob-light-path`, `tests/fixtures/light-path/`, `build-beads`, `beads-glb`, `bob-bead-float`, `bob-off-path`, `bead-label`)
- Test: `tests/unit/state/chapters.test.ts`, `tests/unit/scene/bob-world-path.test.ts`, `tests/unit/scene/bob-journey.test.ts`, `tests/unit/scene/bob-nebula-way.test.ts`, `tests/unit/scene/bob-engraved-way.test.ts`, and every test that named TRAVEL, ARRIVE, `arrivalStop` or a bead

**Interfaces:**
- Consumes: Task 1's places and `aroundShot`; `lightAt`, `wayShot`, `voidAt`, `sizeFor` (`lightDive.ts`).
- Produces, chapters: `ChapterId = 'HOME' | 'LIGHT' | 'LAND' | 'AREA' | 'LOOK' | 'SHEET' | 'END'`; `ChapterSpec = { areas: readonly { category: CategoryId; projects: readonly ProjectId[] }[] }` (from `areasOnPath`); an AREA unit's `category` is its category and its `project` the area's place on the way (0 first); `WORLD_LAYOUT = { land: 1.8, area: 1.4, look: 1.6 }`; `LAND_STOP = 0.85`, `AREA_STOP = 0.7`; `worldStop(c)`; `areaStop(c, category)` (throws for a category not on the way); `keyStops(c)` = 0, the rise's top, the five facts, the world, each area, the sheet's start, the end; `Stretch = 'rise' | 'light' | 'land' | 'area' | 'look' | 'sheet' | 'end'`; `placeForProject(id)` = its area's stop.
- Produces, the path: `WorldPart = 'land' | 'area' | 'look' | 'sheet'`; `WorldFrame = { part; index; t; shot; light: LightPose; void: VoidPose; power; flash; levels: Record<ProjectId, number>; names: number; caption: { index: number; opacity: number } | null; dots: number; skip: boolean; black: number; fog; sky: boolean }`; `makeWorldPath(aspect, c?)` → `{ places; worldShot; areaShot(i); lookShot; openShot(id); sights; frameAt(q) }`; `worldPathFor(aspect)` (memoised); `LAND_HIT = 0.35`, `POWER = [0.35, 0.75]`.
- The land: the light from its place at the hand-over straight down to the CPU's lid by `LAND_HIT`, easing in; the flash peaks there and is gone by 0.5; at rest the light sits on the lid and its trail stands as a still column above it (26 m, no sparks); the power from 0 to 1 over `POWER`, each project's level rising over its last third; the camera from `wayShot(HAND_F)` down to the world shot by `LAND_STOP`; the names over 0.75 to `LAND_STOP`. An area: the camera by `aroundShot` from the last stop's shot to the area's by `AREA_STOP`; its caption over 0.55 to `AREA_STOP` and out over the next unit's first 0.2; its projects' levels 1.1, the others' 0.5. The look: by `aroundShot` to the look shot. The sheet as before (black over its first 0.55). The shots: the mock-up's `poseFor` numbers round `boardCentre()`, by the screen's shape. `pointerMode`: 'any' at rest at the world's, an area's or the look back's stop, null elsewhere.

- [ ] **Step 1: Write the failing tests:** chapters: `lays the world out: the land, an area per category on the way in the categories' order, the look back`, `gives a category with two projects one area`, `has no area for a category with no project on the way`, `keeps the key stops: the facts, the world, each area, the look back's own stop and the end`, `puts a project's place at its area's stop`; path: `brings the light down into the CPU by the land's hit and keeps it there`, `powers the board from the middle out after the hit`, `frames the whole world at its stop` (desk 16:10 and phone 390:844: every project's object and its name's anchor inside the frame by 0.08), `frames each area's projects, the CPU behind and beside them` (on desk the CPU's centre right of the area's first object), `never takes the camera across the CPU` (400 steps from the world's stop to the look back's: the camera's level distance from the board's centre at least 3 m, and the CPU's centre never within 1 m of the line from the camera to its target), `shows the names only at the world's stop and an area's caption only at its own`, `shows the skip button from the world's stop through the look back's`, `keeps the sheet's black and the fog`, `five projects: each area frames every project in it`; journey: `poses the land, the areas and the look back from the world path`, `flies a project's focus to its open view, per screen shape`; nebula: `keeps every cloud off the board and out of every world view's line of sight`; engraved: `keeps the fall's shaft and has no trips' lines`.
- [ ] **Step 2: Run them.** `npx vitest run tests/unit/state/chapters.test.ts tests/unit/scene/bob-world-path.test.ts tests/unit/scene/bob-journey.test.ts tests/unit/scene/bob-nebula-way.test.ts tests/unit/scene/bob-engraved-way.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the chapters, `worldPath.ts` and every rename and removal listed; move the openers to `projectOpen.ts` unchanged.
- [ ] **Step 4: Run every unit test, the typecheck and the build.** `npx vitest run && npm run typecheck && npm run build`. Expected: PASS (every test rewritten through the chapters' functions, each rewrite a ledgered ruling), and `dist/client` has no `bob-beads.glb`.
- [ ] **Step 5: Commit.** `path: the world's path in place of the beads': the light lands in the CPU, the world, an area per category, the look back`

### Task 4: The world in the scene

**Files:**
- Modify: `src/scene/bob/Void.tsx`, `src/scene/bob/voidLoad.ts`, `src/scene/bob/warm.ts`, `src/scene/bob/inside.ts` (`worldClockRuns`), `src/scene/bob/nebulaWay.ts` (the open level), `src/state/frame.ts`, `src/debug/needleDebug.ts`
- Test: `tests/unit/scene/bob-void.test.ts`, `tests/unit/scene/bob-idle.test.ts`, `tests/unit/scene/bob-nebula-way.test.ts`

**Interfaces:**
- Consumes: `buildWorld` (Task 2), `WorldFrame` (Task 3), the store's `inside`.
- Produces: `worldClockRuns(stirred, now, reduced)` (true for `IDLE_SECONDS` after the last stir, never with reduced motion); the world's levels 0.25 while a project is open, the clouds 0.8 at the world, 0.55 at an area, 0.4 with a project open; `hover` (the project under the pointer, lit 1.3) in the store for the names.

- [ ] **Step 1: Write the failing tests:** void: `builds the world in its load and draws no bead`, `lights the project under the pointer and opens it on a click`; idle: `runs the world's clock for 12 s after a stir, never with reduced motion`; nebula: `quiets the clouds at an area and more with a project open`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement:** the Void builds the world in its load steps (warmed before the landing hold lets go) and poses it from the frame each frame (power, flash, levels, the open amounts from the store, the clock only while `worldClockRuns`), the light from `frame.light`; the pointer's hover and the click call `onOpen(id)` through `projectOpen.ts`.
- [ ] **Step 4: Run every unit test, the typecheck and the build.** Expected: PASS.
- [ ] **Step 5: Commit.** `scene: the world drawn: built in the void's load, posed by the path, lit under the pointer, asleep at rest`

### Task 5: The names, the area's words and the dots

**Files:**
- Create: `src/ui/nameLine.ts`, `src/ui/WorldNames.tsx`, `src/ui/AreaCaption.tsx`, `src/ui/AreaDots.tsx`
- Modify: `src/app/routes/home.tsx`, `src/scene/bob/Void.tsx` (writes the names' anchors), `src/i18n/nl.ts`, `src/i18n/en.ts`, `src/styles/base.css`
- Test: `tests/unit/ui/name-line.test.ts`, `tests/unit/ui/world-names.test.ts`, `tests/unit/ui/area-caption.test.ts`, `tests/unit/ui/area-dots.test.ts`

**Interfaces:**
- Produces: `nameLine(anchor, offset, textWidth, screen)` → `{ points: [number, number][]; text: { left?: number; right?: number; top: number } }` (the mock-up's line: up and out to an elbow, then level to the words; the end held 12 px inside the screen, the elbow pulled in to fit the words); `NAME_OFFSET: Record<CategoryId, [number, number]>` (px at 1440 wide, scaled by the screen's width, ×1.45 below 700 px); words `needle.world = { hint: { click, tap }, open: { click, tap }, areas }` in nl and en (the spec's).

- [ ] **Step 1: Write the failing tests:** `keeps the name on the screen, pulling its rule in toward the object`; names: `show with the hint only at the world's stop, each a link that opens its project`, `light the project under the pointer`; caption: `shows its area's category heading and project names with "Klik om te openen", "Tik om te openen" on a touch screen`, `opens the project when pressed`; dots: `light the area in view`, `go to an area's stop when pressed`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement** after the mock-up's `place`, caption, dots and hint; reachable by keyboard, named in both languages.
- [ ] **Step 4: Run every unit test and the typecheck.** Expected: PASS.
- [ ] **Step 5: Commit.** `ui: the projects' names on the world, an area's words and the dots`

### Task 6: A project opens, Overworld's way

**Files:**
- Create: `src/ui/ProjectPanel.tsx` (grown from `InsideControls.tsx`, which it replaces; `leaveInsideOn` moves with it), `src/scene/bob/touchColumns.ts`
- Modify: `src/scene/bob/focus.ts` (flights by `aroundShot`), `src/scene/bob/inside.ts` (`opensOnClick`), `src/ui/projectOpen.ts` (`turnInside`), `src/ui/TouchPoints.tsx` (columns, anchors from the world), `src/scene/bob/touchPoints.ts`, `src/state/routeSync.ts`, `src/app/routes/home.tsx`, `src/i18n/nl.ts`, `src/i18n/en.ts`, `src/styles/base.css`
- Test: `tests/unit/scene/bob-focus.test.ts`, `tests/unit/scene/bob-inside.test.ts`, `tests/unit/scene/touch-columns.test.ts`, `tests/unit/ui/project-panel.test.ts`, `tests/unit/ui/touch-points.test.ts`

**Interfaces:**
- Consumes: `openShot` (Task 3), `aroundShot` (Task 1), the openers (Task 3), the world's anchors (Task 2).
- Produces: `opensOnClick(at, rest)` (true at rest at the world's, an area's or the look back's stop, for any project); `turnInside(dir: 1 | -1)` (the next or the previous project on the way, round the end: the history state replaced, the flight on from where the camera is); `touchColumns(marks, centreX, reach, screen, scale)` → each label's line and place (two columns split by side, at least a line apart, each inside the screen); `ProjectPanel` (the category heading, the name, the summary, `role · year`, "Bekijk project", "Terug", the arrows with "n / N"; ← and → turn; words `needle.inside = { view, back, previous, next }`).

- [ ] **Step 1: Write the failing tests:** focus: `flies round the board between two open projects, never across the CPU`, `retargets a flight in progress from where it is`; inside: `opens on a click only at rest at the world, an area or the look back`; columns: `splits the points into two columns by their side`, `keeps a line between two labels`, `keeps every label on the screen`; panel: `shows the project's category, name, summary, role and year`, `goes to the next and the previous project, round the end`, `turns with the arrow keys and leaves with Escape, a scroll or the up and down keys`, `fades its words out before they change to the next project's`, `opens the project's page from "Bekijk project"`; touch points: `follow the open project's anchors in two columns`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement:** the focus flight by `aroundShot`; the panel on the left on a laptop and below the object on a phone (the mock-up's CSS); the object opens by the open amount; with reduced motion all of it by the step fade.
- [ ] **Step 4: Run every unit test and the typecheck.** Expected: PASS.
- [ ] **Step 5: Commit.** `open: a project opens Overworld's way: its object, its touch points, its panel, Terug and the arrows`

### Task 7: The harness proves the world

**Files:**
- Modify: `tools/proof/needle.mjs` (the steps `path`, `look-back` and `bead-open` become `world`, `areas` and `open`; `reduced-motion`, `void-hold`, `end-page`, the stills and the luma checks read the new stops)

- [ ] **Step 1: Write the steps:** `world` (by real scroll: the light reaches the CPU, the board powers, the names and the hint show at the world's stop, each name opens its project; luma); `areas` (each area's stop: the caption, the dots; the camera never across the CPU on the way; a dot goes to its area; luma); `open` (a click and a tap open; the panel's words; the arrows twice quickly; Terug, Escape, a wheel turn, a swipe, Back; "Bekijk project" to the page, Back into the open project, Back to the stop; a resize from laptop to phone while open; on /en/ at 390 × 844 the panel's bottom above Terug's top; luma 0.15; reduced motion by the step fade).
- [ ] **Step 2: Run them on the build.** `npm run build`, then `STEPS=world,areas,open` with `PROOF_DIR` set, `node tools/proof/needle.mjs`. Expected: every check passes.
- [ ] **Step 3: Run the whole harness, in chunks as before.** Expected: every step passes.
- [ ] **Step 4: Commit.** `proof: the world by real input: the land, the areas, a project opened and every way out`

### Task 8: Gates, the recording and Bob's review

- [ ] **Step 1: Gates.** `npx vitest run`, `npm run typecheck`, `npm run build`, the auditor (`tools/site_audit.py dist/client` with Blender's Python, `-I`), the whole harness. Expected: all pass.
- [ ] **Step 2: Record** the site at both sizes, frame-exact with Blender's encoder: from BOB above through the fall, the world, the areas and the look back; and a project opened, the arrows, Terug.
- [ ] **Step 3: The review page** `.superpowers/hologram-world-site-review/`, beside the mock-up's videos and stills, with what differs and Bob's decisions; served, and shown on the companion page.
- [ ] **Step 4: The final review** of the whole branch against this plan and the spec, by me (no subagent reviewer, by Bob's rule; ledgered as such); Critical and Important findings fixed test first.
