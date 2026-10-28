# The Quantum Stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Bob's standing rule for this project: no subagents, so this plan runs inline (executing-plans).

**Goal:** After the fall, the light lands in the CPU on a power board at the top of a stack of detailed circuit boards threaded on a quantum spine. The closed stack explodes open, a scroll goes board by board (one per category), a click lifts a project to a spot in front of the camera while the camera stays, names show only under the mouse, and the nebula becomes a 3D volume. All of this replaces the round board.

**Architecture:**
- **Pure modules** hold the places and the moves:
  - the stack's places (`worldLayout.ts`);
  - a camera framing helper (`fit.ts`);
  - the open spot (`spot.ts`);
  - the path (`worldPath.ts`).
- **Built in code**, after the mock-up Bob chose: the boards (`plate.ts`), the spine (`spine.ts`) and the gas (`volume.ts`). `world.ts` puts the boards, spine, CPU, sockets and objects together.
- **Kept, with new rules:** the focus machinery (history state, every way out). It lifts the object in place instead of flying the camera.

**Tech Stack:** React Router 8 (prerendered), R3F 9.8, three 0.186, zustand, Vitest, tsx; the proof harness in Playwright-core headless Edge.

**Spec:** `docs/superpowers/specs/2026-10-28-bob-quantum-stack-design.md`. Reference (throwaway, read but not copied as is): the mock-up in `.superpowers/holo-world-4-mockup/` (`data.ts`, `plate.ts`, `spine.ts`, `volume.ts`, `world.ts`, `main.ts`), its review in `.superpowers/holo-world-2-review/compare/`.

## Global Constraints

- **Branch and merging:** branch `bob-stack`, from `bob-world` (ad432ff). Nothing merged or pushed without Bob.
- **The sizes (m):**
  - power board radius 3.8;
  - category board radius 6.2, hole 1.4, thickness 0.2;
  - board tops 5.6 apart, 0.32 apart when closed;
  - socket ring 4.4, sockets 3.4 apart;
  - hover 0.62, object scale 1.9;
  - category boards turn 75° apart round the stack, always the same way, the first at −40°.
- **The camera:**
  - World stop: 30° above on a laptop, 26° on a phone.
  - Board stop: 17° above on a laptop, 14° on a phone.
  - Fields of view: 38° on a laptop, 58° on a phone.
- **The open spot:**
  - Laptop: NDC (+0.3, +0.16), half the screen's height across, at 0.34 of the camera's distance to its target.
  - Phone: NDC (0, +0.42), at most 0.66 of the width and 0.32 of the height across, at 0.3 of that distance.
  - Tipped 0.42 rad toward the camera.
  - Rises over 1.5 s and sinks over 1.3 s.
- **Luma:** every stop's still, mean 0.11 at most, on laptop and phone; an open project 0.15 at most.
- **The canvas sleeps:** the float, the pulse, the sockets' rings, the gears and the gas's drift run on the clock only for `IDLE_SECONDS` (12 s) after the last input or arrival.
- **Reduced motion:** stops by the step fade; explode and power as a fade; no float, no ticking, no drift; lift and sink by the step fade.
- **The gas steps down with the tier:**
  - high: half the screen's size, 84 steps;
  - medium: a third, 56 steps;
  - low: none.
- **Projects and categories:** up to `PATH_LIMIT` (5) projects on the way; the categories are `src/data/categories.ts`'s, by kind of work (01 App, 02 Website, 03 Game development), in number order, one board each.
- **Words and facts:** NL first, EN at /en/; only the site's own data about Bob; the Cookies Clicker classmate is never named.
- **Shaders:** every shader `pow` takes a base held to 0 or more.
- **No new 3D files:** canvases are drawn off the frame and warmed before the landing hold lets go.
- **House rules:** no subagents; never edit `.impeccable/config.json`; never use port 4399; commit trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A resize while a project is open** (laptop to phone width): the spot and the panel re-place for the new shape. Pinned in Task 4 (`spotFor` per aspect) and Task 11 (`open`, resize).
2. **The arrows pressed twice quickly:** the project in the spot sinks from where it is and the newest one rises; never two whole in the spot; the camera never moves. Pinned in Task 8.
3. **A project page reached directly with reduced motion:** it stands at its board's stop with the project in the spot, by the step fade. Pinned in Task 8.
4. **The low tier:** no gas, the stars and dust only, nothing else lost. Pinned in Task 10.
5. **Five projects, three in one category:** that board's stop frames all three, and a touch screen's names there never overlap. Pinned in Task 3 and Task 9.

---

### Task 1: The projects and their kinds of work

**Files:**
- Modify:
  - `src/data/categories.ts`: the ids, labels and doc comment;
  - `src/data/projects.ts`: each project's `categoryId`. Funcial goes; Steady and Porfael come, with the design's words, touch points and links;
  - `src/data/pages.ts`, `src/app/routes.ts`, `src/app/handle.ts`, `src/i18n/locale.ts`, `src/seo/head.ts`, `src/seo/structured.ts`: Funcial's page and route go, and Steady's and Porfael's come (`/projects/steady/`, `/projects/porfael/`, with `/en/` beside them);
  - `src/ui/nameLine.ts`: its offsets' keys;
  - `src/scene/bob/worldLayout.ts` and `src/scene/bob/journey.ts`: their keys only, until Task 2 replaces them.
- Test: `tests/unit/projects.test.ts`; every test and `tools/proof/needle.mjs` where the old ids appear (find them with `grep -rln "secure-element\|front-panel\|'oscillator'" tests tools`).

**Interfaces:**
- Produces: `CategoryId = 'app' | 'website' | 'game'`:
  - `app`: number 1, `{ nl: 'APP', en: 'APP' }`;
  - `website`: number 2, `{ nl: 'WEBSITE', en: 'WEBSITE' }`;
  - `game`: number 3, `{ nl: 'GAME-ONTWIKKELING', en: 'GAME DEVELOPMENT' }`.
- `ProjectId = 'steady' | 'porfael' | 'jontai-energy' | 'cookies-clicker'`, in that order.
- Steady and Porfael are `app`, Jontai Energy `website`, Cookies Clicker `game`.
- `heading()` stays as it is: "01 — APP", "03 — GAME-ONTWIKKELING".

- [ ] **Step 1: Write the failing tests** in `tests/unit/projects.test.ts`:
  - `'files each project under the kind of work it is'`: Steady and Porfael `app`, Jontai Energy `website`, Cookies Clicker `game`.
  - `'has no Funcial anywhere'`: no project, page or route by that id.
  - `"gives Steady and Porfael their own words, in both languages"`: Steady's summary is its README's line; Porfael says it is in development; both are "Enige ontwikkelaar" / "Sole developer", 2026.
  - In `tests/unit/pages.test.ts` and `tests/unit/routes.test.ts`: `'serves Steady\'s and Porfael\'s pages, in both languages'`.
  - `"heads the categories by number and kind, in both languages"`: "01 — APP", "02 — WEBSITE", "03 — GAME DEVELOPMENT" and "03 — GAME-ONTWIKKELING".
- [ ] **Step 2:** Run `npx vitest run tests/unit/projects.test.ts tests/unit/pages.test.ts tests/unit/routes.test.ts`. Expected: FAIL, on the old ids and the missing projects.
- [ ] **Step 3:** Implement as above. Update the tests and the harness that name the old ids, labels or Funcial to the new ones; they check the same things (a click on Funcial becomes a click on Steady). The old device-part names stay only in `docs/projects-discovery.md`, as its history.
- [ ] **Step 4:** Run `npm test` and `npx tsc --noEmit`. Expected: PASS, with no type errors.
- [ ] **Step 5:** Commit: `data: Steady and Porfael in, Funcial out, the projects filed by kind of work: app, website, game development`.

### Task 2: The stack's places

**Files:**
- Modify: `src/scene/bob/worldLayout.ts`. `worldPlaces`, `AREA_RING`, `AREA_ANGLE` and `BOARD` give way to the stack's.
- Test: `tests/unit/scene/bob-world-layout.test.ts` (rewritten).

**Interfaces:**
- Produces:
  - `STACK = { core: 3.8, radius: 6.2, hole: 1.4, gap: 5.6, thick: 0.2, closed: 0.32, ring: 4.4, apart: 3.4, hover: 0.62, scale: 1.9, first: -40 * DEG, turn: 75 * DEG } as const`. Category board `k` faces `first + k · turn`.
  - `interface SocketPlace { id: ProjectId; at: [number, number]; out: Vec3 }`.
  - `interface BoardPlace { index: number; category: CategoryId | null; top: number; radius: number; hole: number; facing: number; sockets: SocketPlace[] }`. Index 0 is the power board; `top` is the open top in world y; `facing` is in rad, 0 toward +z.
  - `stackPlaces(areas: readonly AreaSpec[]): BoardPlace[]`.
  - `boardTops(boards: readonly BoardPlace[], open: number): number[]`.
  - `LID_TOP = 0.2`, for the new CPU.
  - `boardCentre` stays.
  - `ObjectKind` becomes `'streak' | 'portfolio' | 'solar' | 'crystal' | 'chip'`: Steady's streak path, Porfael's ring and relic, Jontai Energy's solar module, Cookies Clicker's crystal, and a plain chip for any other. Funcial's `'lock-chip'` goes. `OBJECT_MIDDLE` gains the new kinds' middles: 0.2 for `streak`, 0.3 for `portfolio`.

- [ ] **Step 1: Write the failing tests:**
  - `'puts the power board first, at the board centre, with no hole and no sockets'`: radius 3.8, top `boardCentre()[1]`.
  - `"gives each category on the way a board below, 5.6 apart, in the categories' order"`.
  - `'turns each category board 75° further round the stack, the first at -40°'`.
  - `"stands a board's projects on the side it faces, 4.4 out and 3.4 apart along the ring"`: one project at `facing`; for three, neighbours 3.4 apart along the arc ±1e-6.
  - `"keeps every socket clear of the spine's hole and inside its board"`: distance − 1.08 > hole, and + 1.08 < radius.
  - `'stacks the boards 0.32 apart closed and at their places open'`: `boardTops(b, 0)[k] = top0 − k·0.52`, `boardTops(b, 1)[k] = b[k].top`, and 0.5 lies between.
- [ ] **Step 2:** Run `npx vitest run tests/unit/scene/bob-world-layout.test.ts`. Expected: FAIL, `stackPlaces` is not exported.
- [ ] **Step 3:** Implement as above. The angle convention is the mock-up's: (x, z) = (sin a, cos a) · r.
- [ ] **Step 4:** Run the same command. Expected: PASS. Then run `npx tsc --noEmit`. It is expected to fail only in the modules Tasks 3 and 7 rewrite (`worldPath.ts`, `world.ts`, `Void.tsx`). List them in the ledger.
- [ ] **Step 5:** Commit: `scene: the stack's places: the power board, a board per category below, sockets on each board's ring`.

### Task 3: Framing and the path down the stack

**Files:**
- Create: `src/scene/bob/fit.ts`.
- Modify: `src/scene/bob/worldPath.ts`, `src/state/chapters.ts` (only the doc comments name the stack).
- Test: `tests/unit/scene/bob-fit.test.ts` (new), `tests/unit/scene/bob-world-path.test.ts` (rewritten).

**Interfaces:**
- Consumes: Task 2's `stackPlaces`, `boardTops`, `STACK`.
- Produces:
  - In `fit.ts`:
    - `project(point: Vec3, shot: CameraShot, aspect: number): { x: number; y: number; front: boolean }`, in NDC.
    - `fitDistance(points: Vec3[], target: Vec3, azimuth: number, elevation: number, fov: number, aspect: number, box: readonly [number, number, number, number]): number`, found by bisection between 4 and 120 over 30 rounds.
  - `WorldFrame` gains:
    - `explode: number`, 0 closed and 1 open;
    - `boardPower: number[]`;
    - `boardLight: number[]`.
    `names` now means "names may show here".
  - `WorldPath`:
    - `places` becomes `BoardPlace[]`;
    - `areaShot(i)` is board `i + 1`'s stop shot;
    - `openShot` is removed;
    - `machine` is added: every point the whole machine's view must hold.

- [ ] **Step 1: Write the failing tests for `fit.ts`:**
  - `'projects the target to the middle and a point to its right to the right'`;
  - `'finds the nearest distance that holds every point inside the box'`: at the result every point is inside, and at 0.98 of it one is not.
- [ ] **Step 2: Write the failing tests for the path:**
  - `"brings the light down into the CPU by the land's hit and keeps it there"`: the lid at `LID_TOP` 0.2.
  - `"keeps the stack closed until 0.4 of the land and opens it by the world's stop"`.
  - `'powers the boards from the top down'`: `boardPower[k] >= boardPower[k+1]` all through the land, and all 1 at the world's stop.
  - `"frames the whole machine at the world's stop"`: every `machine` point inside the box, on a laptop and a phone.
  - `'frames each board from below the board above it'`: at board stop `i`, camera y < `tops[i] − STACK.thick` and > `tops[i+1]`. On a laptop every rim point of board `i+1` is inside the box.
  - `'never takes the camera through a board or the spine'`: 200 frames from the world to the look back. Within a board's slab height the camera stands outside its radius; it is always more than 2.2 from the axis.
  - `"lights the board in view and steps the others back"`: at board stop `i`, board `i+1` 1, the power board 0.7, the others 0.45.
  - The skip, black and fog tests are kept.
  - `'five projects: the board with three frames all three'`.
- [ ] **Step 3:** Run `npx vitest run tests/unit/scene/bob-fit.test.ts tests/unit/scene/bob-world-path.test.ts`. Expected: FAIL.
- [ ] **Step 4: Implement:**
  - The world's shot: azimuth 0, `fitDistance(machine, …)`. Box on a laptop [−0.66, 0.66, −0.86, 0.82], on a phone [−0.9, 0.9, −0.62, 0.7].
  - A board's shot: azimuth `facing`, target the board's centre + facing·0.6 + (0, 0.2 laptop / 0.6 phone, 0). Box on a laptop [−0.64, 0.64, −0.56, 0.72], on a phone [−1.25, 1.25, −0.14, 0.66].
  - The box's centre (cx, cy) becomes the existing `aside(position, target, fov, [cx/2, cy/2], aspect)`.
  - The look back: elevation 16°, distance 42 on a laptop and 66 on a phone, at the machine's middle.
  - The explode: `ease(seg(t, 0.4, 0.7))`.
  - The power: `ease(seg(t, POWER[0], POWER[1]))`, and `boardPower[k] = clamp01(power·1.9 − k·0.32)`.
  - The camera between stops: `aroundShot` round the stack's axis.
- [ ] **Step 5:** Run the same command. Expected: PASS.
- [ ] **Step 6:** Commit: `scene: the path down the stack: the explode, the power board by board, a stop per board, framed by fit`.

### Task 4: The open spot

**Files:**
- Create: `src/scene/bob/spot.ts`.
- Test: `tests/unit/scene/bob-spot.test.ts`.

**Interfaces:**
- Consumes: `project` from Task 3's `fit.ts`.
- Produces:
  - `SPOT` (the Global Constraints' values, plus `lift: 1.6`, the curve's rise over its middle, and `sway: 0.12` rad);
  - `interface SpotPose { centre: Vec3; yaw: number; tilt: number; scale: number }`;
  - `spotFor(shot: CameraShot, aspect: number, radius: number, clock: number): SpotPose`;
  - `liftAt(socket: SpotPose, spot: SpotPose, e: number): SpotPose`;
  - `riseStep(rise: number, up: boolean, dt: number): number`.

- [ ] **Step 1: Write the failing tests:**
  - `"stands the object's middle at +0.3, +0.16 on a laptop and the top middle on a phone"`: `project(centre)` within 1e-3.
  - `"sizes it to half the screen's height on a laptop, and to fit a phone's width"`: the projected diameter 0.5 of the height ±1e-3; on a phone min(0.66 w, 0.32 h).
  - `'faces the camera, tipped 0.42 toward it'`.
  - `'curves up off the socket and over to the spot'`: e=0 is the socket, e=1 the spot, and at e=0.5 the centre stands at least 0.8 above the straight midpoint.
  - `'rises in 1.5 s and sinks in 1.3 s at a steady pace'`.
  - `'re-places for a new screen shape'` (Review Focus 1): `spotFor` at aspect 1.6 and at 0.46 projects to each one's own spot.
- [ ] **Step 2:** Run `npx vitest run tests/unit/scene/bob-spot.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement:**
  - The spot is at distance `SPOT.distance · |target − position|` along the ray through the NDC point.
  - The scale makes the bounding sphere's diameter the share of the screen.
  - The yaw faces the camera, plus `sway · sin(0.5·clock)`.
  - The curve is quadratic through the straight midpoint raised by `SPOT.lift`.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit: `scene: the open spot in front of the camera, and the curve up to it`.

### Task 5: The boards in code

**Files:**
- Create: `src/engine/bob/build/plate.ts`, after the mock-up's `plate.ts`.
- Test: `tests/unit/bob/build-plate.test.ts`.

**Interfaces:**
- Produces:
  - `interface PlateSpec { radius: number; hole: number; cpu: boolean; sockets: [number, number][]; firstSocket: number; label: string; facing: number; seed: number }`;
  - `PLATE_LOOK = { size: { high: 2048, medium: 1024, low: 1024 }, parts: { high: 1, medium: 0.6, low: 0.35 }, thick: 0.2 }`;
  - `plateLayout(spec, tier): { parts: { kind: string; x: number; z: number; yaw: number }[]; buses: [number, number][][][] }`, pure, with no three;
  - `buildPlate(spec, tier, room: THREE.Texture | null, canvas = () => document.createElement('canvas')): { group: THREE.Group; set(clock: number, power: number, level: number): void; turn(azimuth: number): void; dispose(): void }`.
- Group parts: `plate:top`, `plate:light`, `plate:edge`, `plate:parts`.

- [ ] **Step 1: Write the failing tests.** They use the fake canvas of `build-world.test.ts`.
  - `"lays a bus to every socket and to every heat-sunk processor"`.
  - `"keeps every part out of the spine's hole, off the sockets and inside the rim"`.
  - `"gives the power board the CPU's power stage and a category board the spine's connector ring"`.
  - `'lays fewer small parts on the lower tiers'`: the counts' ratio roughly matches `PLATE_LOOK.parts`.
  - `"names its parts, and turns its reflections with the camera"`: `envMapRotation.y` set by `turn`.
  - `"holds every shader pow's base at zero or more"`.
  - `'frees its geometries, materials and textures on dispose'`.
- [ ] **Step 2:** Run `npx vitest run tests/unit/bob/build-plate.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Port the mock-up's `plate.ts`:
  - Its layout goes into `plateLayout`, scaled by tier.
  - Canvases come from `canvas()`; the font is `"Martian Mono Variable"`, which the Void loads before building (Task 7).
  - The dimmed materials carry `room` as their `envMap`.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit: `engine: the stack's boards in code: mask, copper, gold, print, parts and their buses`.

### Task 6: The spine in code

**Files:**
- Create: `src/engine/bob/build/spine.ts`, after the mock-up's.
- Test: `tests/unit/bob/build-spine.test.ts`.

**Interfaces:**
- Produces:
  - `interface SpineSpec { tops: number[]; radii: number[]; hole: number; thick: number }`;
  - `SPINE_LOOK = { bundles: { high: 24, medium: 16, low: 10 }, guides: 8, tip: 3.4, lamp: 3.6 }`;
  - `buildSpine(spec, tier, room): { group: THREE.Group; pose(tops: number[]): void; set(clock: number, power: number, level: number): void; turn(azimuth: number): void; dispose(): void }`.

- [ ] **Step 1: Write the failing tests:**
  - `'makes a span under every board, the last one with the tip'`: `spine:span0` and onward.
  - `'squeezes each span to the gap between the boards it is posed with'`: `scale.y` = gap / height; each span's top sits under its board.
  - `'draws eight guide lines between each pair of boards'`.
  - `'lights its spans from the top down as the power runs'`: the lamps don't increase down the spine at power 0.5.
  - `'uses fewer bundles on the lower tiers'`.
  - The `pow` base test and the dispose test.
- [ ] **Step 2:** Run `npx vitest run tests/unit/bob/build-spine.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement: port the mock-up's `spine.ts`, with tiers and `dispose`.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit: `engine: the quantum spine in code: flanges, cable bundles, the glass core, the guide lines`.

### Task 7: The world: the stack, its CPU, sockets and objects

**Files:**
- Modify:
  - `src/engine/bob/build/world.ts`: the round board, its circuit and its pads go. The CPU is the mock-up's, socketed. The objects are kept.
  - `src/scene/bob/Void.tsx`: the build step awaits `document.fonts.load('500 40px "Martian Mono Variable"')`, builds with `stackPlaces`, and poses with the new `WorldPose`.
- Test: `tests/unit/bob/build-world.test.ts` (updated).

**Interfaces:**
- Consumes: Tasks 1, 2, 4 and 5; Task 4's `liftAt` and `SpotPose`.
- Produces:
  - `WorldPose` gains `tops: number[]`, `boardPower: number[]`, `boardLight: number[]`, `lift: Record<ProjectId, number>` and `spot: SpotPose | null`.
  - `buildWorld(boards: readonly BoardPlace[], tier, room: THREE.Texture | null, canvas)` builds the parts:
    - `world:board:k`;
    - `world:spine`;
    - `world:cpu`;
    - `world:socket:<id>`;
    - `world:object:<id>`;
    - `world:beam`, from the spine's core at the lifted project's board to it;
    - `world:showLight`, the open project's lamp.
  - `WorldModel` gains `turn(azimuth)`.

- [ ] **Step 1: Write the failing tests** (the anchors, cells, gears, `pow` and dispose tests are kept; Funcial's lid test goes):
  - `"marks Steady's streak blocks one after another and lights its trophy as it opens"`: three blocks marked at rest, all seven once open.
  - `"parts Porfael's arcs and lights its relic as it opens"`.
  - `'names a board per category below the power board, the spine and the CPU'`.
  - `'places each board at the tops it is posed with'`: closed tops, then open ones.
  - `"stands each object on its socket on its board, and in the spot when lifted"`: lift 1 puts the object's middle at `spot.centre` ±1e-6.
  - `"moves a project's click sphere with its object"`.
  - `"aims the beam from the spine at the project's board to the lifted object, and lights it with the lift"`.
  - `"dims the boards, the spine, the CPU and the sockets with the world's level"`.
- [ ] **Step 2:** Run `npx vitest run tests/unit/bob/build-world.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Steady's and Porfael's objects are new, after the mock-up's `steady()` and `porfael()` (`.superpowers/holo-world-4-mockup/world.ts`); Funcial's lock chip goes. The objects are posed by `liftAt(socketPose, spot, ease(lift))`. The socket pose is: board top + `STACK.hover` + float, facing out, at `STACK.scale`. The Void hands `room` (its PMREM'd room) and `turn(azimuth)` each frame, the camera's azimuth round the axis.
- [ ] **Step 4:** Run `npx vitest run tests/unit/bob/build-world.test.ts tests/unit/scene/bob-void.test.ts`, then `npx tsc --noEmit`. Expected: PASS, with no type errors left from Task 2.
- [ ] **Step 5:** Commit: `engine: the world becomes the stack: boards, spine, the socketed CPU, sockets and the objects`.

### Task 8: A click opens a project in place

**Files:**
- Modify:
  - `src/scene/bob/focus.ts`: an open keeps the camera on the shot it began from. The amount becomes the lift, over 1.5 s up and 1.3 s down.
  - `src/scene/bob/journey.ts`: `focusShotFor(id, aspect)` becomes the project's board stop shot.
  - `src/scene/bob/inside.ts`: `openOf(lift)`, the object opening as it nears the spot: smooth over lift 0.75 to 1.
  - `src/scene/bob/Opening.tsx`.
  - `src/scene/bob/Void.tsx`: it computes `spotFor(frame.shot, aspect, radius, clock)` each frame and poses `lift`/`open` from `handover.close`.
- Test: `tests/unit/scene/bob-focus.test.ts` (flight cases rewritten), `tests/unit/scene/bob-inside.test.ts`.

**Interfaces:**
- Consumes: Task 4's `spotFor`; Task 7's `WorldPose.lift`/`spot`.
- Produces:
  - `focusShotAt(move, now, goal, centre)`:
    - with a project to open and a shot to start from, it returns that shot at every moment;
    - closing, it goes `aroundShot` from that shot to `goal`.
  - `FLIGHT_MS` is 1500 into a project and 1300 out (`SINK_MS`).
  - `openOf(lift)`.

- [ ] **Step 1: Write the failing tests:**
  - `'opens in place: the camera stays on the shot it was opened from, all the way'`.
  - `'the arrows never move the camera: from one open project to the next the shot is unchanged'`.
  - `'pressing the arrows twice quickly sinks the first from where it is and lifts the newest; never two whole in the spot'` (Review Focus 2).
  - `"a page reached directly stands at the project's board stop, by the step fade, with reduced motion too"` (Review Focus 3).
  - `"closing after the arrows turns the camera round to the shown project's board"`.
  - `'opens the object once it is nearly in the spot'`: `openOf` is 0 at 0.7 and 1 at 1.
- [ ] **Step 2:** Run `npx vitest run tests/unit/scene/bob-focus.test.ts tests/unit/scene/bob-inside.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** The Void poses:
  - `lift[close.id] = close.amount` and `lift[leaving.id] = leaving.amount`;
  - `open = openOf(lift)`;
  - `spot` from the camera.

  `showOpenWords` keeps working from the hit sphere, which now rides with the lifted object.
- [ ] **Step 4:** Run the same command, then `npm test`. Expected: PASS, with the whole suite green.
- [ ] **Step 5:** Commit: `open: a project lifts to the spot in front of the camera, which stays; the arrows swap them in place`.

### Task 9: Names only under the mouse; a board's words

**Files:**
- Modify:
  - `src/ui/WorldNames.tsx`: `WorldNamesView.names[]` gains `level: number`, each name's own share of the view's opacity.
  - `src/ui/AreaCaption.tsx`: a project's name in a caption sets the hovered name (`setCaptionHover(id | null)`, new, in `src/ui/WorldNames.tsx`) on pointer enter and leave.
  - `src/scene/bob/Void.tsx`: `showWorldWords`.
- Test: `tests/unit/ui/world-names.test.ts`, `tests/unit/ui/area-caption.test.ts` (updated or new).

**Interfaces:**
- Consumes: `pointerMode` (`voidPose.ts`); `frame.index`.
- Produces: `setCaptionHover`; each name's level is set as follows:
  - mouse screens: the eased hover of its project (the ray's `hot`, else the caption's);
  - touch screens: 1 for the board in view's projects at its stop, else 0.

- [ ] **Step 1: Write the failing tests:**
  - `'show only the name whose project the pointer is on'`: the others at opacity 0 and out of Tab's reach.
  - `"show a board's names at its stop on a touch screen, and none at the world's stop"`.
  - `'light a name from its caption as from its object'`.
  - `"a touch screen's names at a board with three projects stand apart"` (Review Focus 5): their boxes do not overlap at 390 × 844.
- [ ] **Step 2:** Run `npx vitest run tests/unit/ui/world-names.test.ts tests/unit/ui/area-caption.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement as above. The hint keeps the view's opacity.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit: `ui: a project's name shows only under the mouse; a touch screen's at its board`.

### Task 10: The 3D nebula

**Files:**
- Create: `src/engine/bob/build/volume.ts`, after the mock-up's `volume.ts`.
- Modify:
  - `src/engine/bob/build/nebula.ts`: the cloud cards, their atlas and `cloudLayout`'s input go; the stars, dust and shell stay.
  - `src/scene/bob/nebulaWay.ts`: `cloudLayout` goes, and `nebulaLevels.clouds` becomes the gas's level.
  - `src/scene/bob/Void.tsx`: builds the volume with the nebula at the tier and renders its target in a `useFrame` before the scene's render. Its aim is the shot's target. Its middle is the machine's middle, or the light's place in the fall.
- Test: `tests/unit/bob/build-volume.test.ts` (new), `tests/unit/bob/build-nebula.test.ts` and `tests/unit/scene/bob-nebula-way.test.ts` (cloud cases removed).

**Interfaces:**
- Produces:
  - `VOLUME_LOOK`, the mock-up's colours and steps;
  - `volumeTier(tier): { scale: 2 | 3; steps: 84 | 56 } | null`, null on low;
  - `buildVolume(tier): { layer: THREE.Mesh; render(gl: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera, input: { clock: number; level: number; power: number; aim: Vec3; middle: number; clear: 'stack' | 'fall' }): void; resize(width: number, height: number): void; dispose(): void } | null`.

- [ ] **Step 1: Write the failing tests:**
  - `'draws the gas at half the screen on high and a third on medium, and none on low'` (Review Focus 4);
  - `'marches 84 steps on high and 56 on medium'`;
  - `"keeps the clear space round the stack's middle and along the camera's line"`: the uniforms are set from the input;
  - `"lays the gas at the far plane, over the stars and behind the world"`: the layer's depth is ≥ 0.9999 and its blending is premultiplied;
  - `"holds every shader pow's base at zero or more"`; dispose;
  - in the nebula tests: `'builds no cloud cards; the stars, dust and shell stay'`.
- [ ] **Step 2:** Run `npx vitest run tests/unit/bob/build-volume.test.ts tests/unit/bob/build-nebula.test.ts tests/unit/scene/bob-nebula-way.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement: port the mock-up's `volume.ts`. The march uses the `steps` uniform. The clear space switches on `clear`. The gas's drift reads the world's clock (`input.clock`), so it stands still when the canvas sleeps and with reduced motion.
- [ ] **Step 4:** Run the same command, then `npm test` and `npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5:** Commit: `engine: the nebula in 3D: a volume of gas in place of the cloud cards, stepping down with the tier`.

### Task 11: The proof harness

**Files:**
- Modify:
  - `tools/proof/needle.mjs`: the `world`, `areas` and `open` steps;
  - `src/debug/needleDebug.ts`: the bridge reports `explode`, `tops`, `camera`, and each project's `lift`.
- Test: the harness itself.

- [ ] **Step 1: Rewrite the steps:**
  - **world:**
    - the light lands;
    - `explode` goes from 0 to 1;
    - the whole machine is on screen;
    - no name shows until the mouse is on a project, then that one alone.
  - **areas:**
    - each board's stop shows its caption and its dot;
    - the camera stands below the board above;
    - its projects are on screen and not covered (a ray from the camera hits the project's sphere first);
    - the canvas sleeps when left alone.
  - **open:**
    - a click and a tap: the camera is unchanged within 0.05 m, and the object's middle is at the spot within 0.03 NDC;
    - the panel and touch points;
    - the arrows twice quickly, with the camera unchanged;
    - Terug, Escape, the wheel, a swipe, Back, "Bekijk project" and back, a resize (Review Focus 1);
    - every English panel on a phone stays above Terug.
  - The luma limits are kept.
- [ ] **Step 2:** Build, serve on 4421, and run `STEPS=world,areas,open node tools/proof/needle.mjs`. Then run all steps. Expected: every step passes, with luma within the limits.
- [ ] **Step 3:** Commit: `proof: the stack by real input: the explode, the boards, a project opened in place, names under the mouse`.

### Task 12: The review

**Files:**
- Create: `.superpowers/quantum-stack-site-review/index.html`, with `stills/` and `video/` (untracked).

- [ ] **Step 1:** Record the world and open videos at both sizes. Take the stills at every stop and with a project open, beside the mock-up's.
- [ ] **Step 2:** Write the review page:
  - what was asked;
  - where the build differs from the mock-up;
  - how it was checked;
  - his decisions.
- [ ] **Step 3:** Serve the page on its own port (not 4399) and check every image and video loads.
- [ ] **Step 4:** Run the final review (a self-review: no subagents), then the gates: `npm test`, `npx tsc --noEmit`, `npm run build`, the auditor and the harness.
