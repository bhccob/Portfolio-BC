# BOB M2b: the dive, the void and the beads — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Past BOB from above, the scroll goes on:
- The camera dives through the O and comes out under the glass sky.
- All three project beads come into view. Each holds its own object sealed behind the porthole glass, beside its real screen.
- One stop per project, the large needle points at that bead, which comes forward and moves.
- A label in real text opens the project page. Esc or back returns to the same bead.

**Architecture:**
- The scroll's chapters become BOB's: HOME (the rise), DIVE, VOID_ENTRY (the overview) and one PROJECTS stop per project, six stops in all.
- One pure journey pose maps `frame.progress` to the camera shot, the needle's place, which bead is forward, and the void's light. The M2a rise pose is its first stretch.
- The beads and their objects are one Blender-authored GLB. Code builds the void (ceiling, mist, dust, beam), puts the real screenshots on the beads' displays, runs each object's motion, and aims the needle.
- The shot is written once per frame, before the Rig.

**Tech Stack:** React Router 8 (prerendered NL/EN), React Three Fiber 9.8, three 0.186, zustand, Vitest 5, TypeScript 7, Blender 5.2 headless (`blender -b --factory-startup --python`), and the Playwright-core harness `tools/proof/needle.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-21-bob-compass-design.md`, revised 2026-10-22 (M2b). The relevant sections are §2.3 step 4 and "The scroll's stretches", §2.4, §3, §4, §6, §7 ("The void's camera", "The needle in the void", "Beads"), and §8 "Milestones from here".

**Preview it argues from:**
- `.superpowers/brainstorm/bob-only-o-2026-10-22/bob-o-glow.blend`, frames 362–480, built by `tools/blender/run_o.py` with `tools/blender/bob_scroll.py`
- frames `docs/design/bob-compass/d01`–`d03` and `b01`–`b03`
- the object meanings in `docs/projects-discovery.md`

## Global Constraints

- **Language:** NL is the default at `/`, EN is at `/en/`, and the copy is formal. New copy: the bead label's hint "Klik om te openen" / "Click to open", and on a touch screen "Tik om te openen" / "Tap to open" (spec §2.4).
- **Truth:**
  - Never invent facts.
  - The bead screens are the real screenshots from `docs/discovery/`: Funcial `funcial-app-home.webp`, Jontai Energy `je-home.webp`, Cookies Clicker `cookies-playing.webp`.
  - The project titles and category lines come from `src/data/projects.ts` and `src/data/categories.ts`.
  - Cookies Clicker was made with a classmate who is never named.
- **Platform:**
  - The strict CSP stays. No new script sources and no new dependencies; Draco is not used.
  - Every page stays prerendered with real DOM text.
  - The canvas sleeps when nothing moves.
- **Quality:** 60 fps on a mid-range laptop and at least 30 on a mid-range phone, through the existing tiers (`src/engine/quality.ts`). The low tier sheds the mist's layers and most of the dust.
- **Brightness:** `LUMA_GATE` stays: home ≤ 0.11 mean, loader ≤ 0.07, at most 0.4 % clipped. Every void still is gated as a home still.
- **Look:** dark, calm, one focal point: the selected bead. The unselected beads stay dim, and each object moves only while its bead is selected or hovered (spec §2.4, §4).
- **Motion:**
  - Reduced motion steps by stops with M2a's step fade (`src/scene/bob/stepFade.ts`).
  - Under reduced motion the objects do not move, and the flight into a porthole is a fade.
- **Asset budgets:** `public/models/bob-beads.glb` ≤ 1 500 000 bytes, with its baked vein texture inside it. The three screenshots are each ≤ 150 KB as WebP, under `src/assets/beads/`.
- **Gates before every commit:**
  - `npx vitest run`
  - `npm run typecheck`
  - `npm run build`
  - the auditor, run with Blender's Python because there is no system Python: `"/c/Program Files (x86)/Steam/steamapps/common/Blender/5.2/python/bin/python.exe" -I tools/site_audit.py dist/client`, with 0 errors and 0 warnings
  - from Task 13 on, the harness steps it names (preview on `PORT=4421`; port 4399 may belong to another session)
- **Branch:** nothing is pushed, and nothing is merged into `redesign-bench` or `main` without Bob's OK.

## Review Focus

1. **A fling through every stop and back.** A trackpad fling from home to Cookies and back to the home must not stick in the dive's hold once the assets are in. Back at the home it is exactly M2a's home: rise 0, the needle aiming, the cue back. Tests: Task 2 (`journeyAt` is continuous and exact at every stop) and Task 13 (`void-journey`).
2. **A direct arrival at a project page, then Esc.**
   - `/projects/cookies-clicker/` loads, plays the loader and lands on Cookies' bead seen close.
   - Esc flies out to the Cookies stop in the void, including when the void's assets were still loading on arrival.
   - Tests: Task 12 (`stopForProject`, back target) and Task 13 (`bead-open`).
3. **The void's files fail or are slow.**
   - The scroll holds in the tunnel without an error card, and the home stays usable.
   - On failure the home's project links (`.home-nav`) show, as with 3D off.
   - On success the hold releases.
   - Tests: Task 11 (`diveHoldFor`) and Task 13 (`void-hold`, `void-fail`).
4. **A phone (390×844, touch, medium tier).**
   - Swipes move stop by stop.
   - A tap on the selected bead or its label opens the project.
   - The label never leaves the screen.
   - The fps holds at the medium tier.
   - Tests: Task 12 (`labelPlacement` clamps) and Task 13 (`void-journey` at 390×844).
5. **The keyboard.**
   - At a project stop, Tab reaches that bead's label link, and Enter opens it.
   - Esc returns.
   - Arrow keys, Page Up/Down and Home/End step the six stops.
   - Tests: Task 1 (`stops` count) and Task 13 (`keyboard`, `bead-open`).

---

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `src/state/chapters.ts`, `src/state/machine.ts`, `src/state/routeSync.ts` | modify | BOB's chapters (HOME, DIVE, VOID_ENTRY, PROJECTS ×3) and phases; back to a project's stop |
| `src/scene/bob/journey.ts` | create | pure: progress → stretch, the shot, the needle, the selected bead, the void's light |
| `src/engine/bob/build/void.ts` | create | the void: ceiling and its traces, the ring, mist, dust, the beam; tiers |
| `tools/blender/export_beads.py` and `tools/blender/bead_funcial.py`, `bead_jontai.py`, `bead_cookies.py` | create | the beads and their objects, exported to `public/models/bob-beads.glb` |
| `src/engine/bob/build/beads.ts` | create | loads the beads GLB; screens, materials, selection, hover, motion |
| `src/engine/bob/beadMotion.ts` | create | pure: each object's motion from time |
| `src/engine/bob/build/compass.ts` | modify | `setNeedleWorld`: the needle leaves the armillary to lead the dive and point |
| `src/scene/bob/Void.tsx`, `Home.tsx`, `Opening.tsx` | create/modify | load and mount the void; apply the journey; one shot writer before the Rig |
| `src/ui/BeadLabel.tsx`, `src/i18n/en.ts`, `src/i18n/nl.ts` | create/modify | the selected bead's label: a real link |
| `src/assets/beads/*.webp` | create | the three screenshots |
| `tools/proof/needle.mjs`, `tools/proof/README.md` | modify | steps for six stops; `void-journey`, `bead-open`, `void-hold`, `void-fail` |

---

### Task 0: Branch, ledger, the screenshots

**Files:**
- Create: `src/assets/beads/funcial.webp`, `jontai-energy.webp`, `cookies-clicker.webp`

- [ ] **Step 1:** Create worktree branch `bob-m2b` from `redesign-bench` at `.claude/worktrees/bob-m2b`, and run `npm ci`.
- [ ] **Step 2:** Copy `docs/discovery/funcial-app-home.webp`, `je-home.webp` and `cookies-playing.webp` to `src/assets/beads/` under the names above. Re-encode any over 150 KB with Blender's WebP writer at quality 82.
- [ ] **Step 3:** Commit: `assets: the beads' real screenshots`.

### Task 1: BOB's chapters and phases

**Files:**
- Modify: `src/state/chapters.ts`, `src/state/machine.ts`, `src/state/routeSync.ts`, and every reader the grep below finds
- Test: `tests/unit/state/` (the chapters, machine and route-sync tests)

**Interfaces:**
- Produces:
  - `ChapterId = 'HOME' | 'DIVE' | 'VOID_ENTRY' | 'PROJECTS'`
  - `buildChapters(spec: { categories: readonly string[] })` returns HOME (length 1), DIVE (1), VOID_ENTRY (1), then one PROJECTS unit per category
  - `HOME_CHAPTERS.total === 6` and `stops(HOME_CHAPTERS)` = `[0, 1, 2, 3, 4, 5, 6]`
  - `Phase` loses `DISSECT` and `MORPH` and gains `{ kind: 'DIVE' }`
  - `SCROLL_PHASES` = HOME_IDLE, DIVE, VOID_ENTRY, PROJECTS
  - `src/data/parts.ts` and `PART_IDS` are deleted if nothing else reads them

- [ ] **Step 1: Write the failing tests**
  - `buildChapters` gives the units and starts above.
  - `chapterAt(HOME_CHAPTERS, 3.5)` is `{ id: 'PROJECTS', category: 'secure-element' }`.
  - `chapterAt(…, 5.9).category` is `'oscillator'`.
  - `transition` maps DIVE.
  - The machine has no DISSECT or MORPH.
  - `phaseFromScroll` at 1.5 is DIVE.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. `grep -rn "DISSECT\|MORPH\|PART_IDS" src tests` must come back empty, except in comments that explain the history, and fix those comments.
- [ ] **Step 4:** Run `npx vitest run`, `npm run typecheck` and `npm run build`. Expected: PASS. The harness's chapter-bound steps (`scroll`, `keyboard`, `reduced-motion`, `bridge`) are retimed in Task 13. List in the report what they will meet.
- [ ] **Step 5:** Commit: `bob: the scroll's chapters are BOB's — rise, dive, overview, three projects`.

### Task 2: The journey pose (pure)

**Files:**
- Create: `src/scene/bob/journey.ts`
- Modify: `src/scene/bob/scrollPose.ts` (its `scrollPoseAt` becomes the journey's rise stretch, unchanged)
- Test: `tests/unit/scene/bob-journey.test.ts`

**Interfaces:**
- Consumes: `scrollPoseAt`, `riseAt`, `topShotFor` and `CameraShot` (with `up` and `sway`), and `HOME_CHAPTERS`.
- Produces:
  - `type Stretch = 'rise' | 'dive' | 'overview' | 'project'`
  - `interface JourneyAt { stretch: Stretch; local: number; project: number | null }`. `project` is 0, 1 or 2 at a project stretch, else null.
  - `journeyAt(progress: number): JourneyAt`:
    - 0–1 is rise, 1–2 dive, 2–3 overview, and 3–6 projects 0–2. The scroll rests at chapter starts (`stops`), so the rests are: 0 the home, 1 BOB from above, 2 the overview (all three beads in view), 3 Funcial, 4 Jontai Energy, 5 Cookies Clicker. 6, the end of the last unit, is still Cookies.
    - So the dive stretch (1–2) ends in the overview pose, and the overview stretch (2–3) is the glide from the overview to Funcial. A project stretch p (3 + p to 4 + p) is the glide from bead p to bead p + 1. The last one holds Cookies.
    - The snap is 1e-6 at every stop, as `riseAt`'s is.
    - NaN reads as 0.
  - `interface JourneyPose { at: JourneyAt; rise: ScrollPose; shot: CameraShot; needle: NeedleOverride | null; forward: readonly [number, number, number]; lit: readonly [number, number, number]; beam: number; mist: number }`:
    - `forward[i]` (0..1) is how far bead i has drifted toward the camera.
    - `lit[i]` (0..1) is its light.
  - `interface NeedleOverride { position: readonly [number, number, number]; scale: number; aim: readonly [number, number, number] | null }`. These are three's world coordinates; `aim` is a world point the tip points at.
  - `journeyPoseAt(progress: number, aspect: number): JourneyPose`
  - `BEADS` = the spec §7 site positions: Funcial (1.2, −6.9, −3.6), Jontai (−5.0, −5.7, −9.5), Cookies (5.4, −8.7, −13.0), radius 0.95, in category order.
  - `CAMERA_PATH` = spec §7's "void's camera", converted to three coordinates, Blender (x, y, z) → three (x, z, −y):
    - **The dive stretch, 1–2,** keeps the preview's proportions: frames 362–442, with the camera's own times inside it.
      - BOB from above holds from progress 1 to 1.125 (frames 362–372).
      - The dive runs to 1.725 (frames 372–420): the camera at (0, h, 0) with h from 12.6 to −2.6, looking straight down, `up: [0, 0, −1]`. The horizontal field goes from the 50 mm lens (39.6°) to 32 mm (58.7°).
      - Coming out runs to 2 (frames 420–442): from looking down at (0, −2.6, 0) to standing at (0, −4.4, 5.5) looking at (0, −7.2, −9.0), with a 30 mm horizontal field (61.9°). That is the overview pose, at rest at progress 2.
    - **The overview stretch, 2–3,** glides from the overview pose to Funcial's shot (frames 446–472).
    - **Each project** p stands at `BEADS[p] + forward + (−0.8, 1.0, 6.2)` looking at `BEADS[p] + forward`, with a 40 mm horizontal field (48.5°). `forward` is `(−0.4, 0.4, 1.4) × forward[p]`.
    - Between project stops the camera eases from one bead's shot to the next.
  - Horizontal fields become a vertical `fov` for the aspect, capped at `MAX_VFOV` with the stand-back rule of `shotFor`, so a phone sees the same width.

- [ ] **Step 1: Write the failing tests**
  - The rise stretch at progress ≤ 1 equals `scrollPoseAt(riseAt(progress), aspect).shot` exactly.
  - `journeyAt` names every stretch at the stops' midpoints and snaps within 1e-6.
  - The shot is continuous: sampled at 1/400 steps over 0..6 at 16:9 and 390/844, no step moves the camera more than 0.25 m or turns it more than 3°. It is exact at every stop.
  - At progress 3, 4 and 5, the bead p = progress − 3 has `forward[p] === 1` and `lit[p] === 1`, and the others have `forward` 0 and `lit` 0. `BeadsModel.setLit` maps 0 to 0.15 of a bead's light.
  - At the overview's rest (progress 2), every bead has `lit` 0.5 and `forward` 0, so all three read equally. All three bead centres project inside the screen there, at 16:9 and at 390/844.
  - At each project stop on 16:9 and on 390/844, the selected bead's centre projects inside |ndc| < 0.5.
  - The needle override:
    - null on the rise
    - from the dive's start, it follows spec §7 "The needle in the void" (sinks, leads, grows to 1.9, aims), in three coordinates
    - at each project stop its `aim` is that bead's centre
  - `beam` and `mist` rise from 0 during the dive to 1 at the overview.
  - NaN progress reads as the home.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement it as eased key poses (smoothstep within each stretch), exact at the stops. Rulings 2 and 8 of M2a apply: the exact shots at the ends, and the snap.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit: `bob: the journey from the home to the beads (pure)`.

### Task 3: The void (code)

**Files:**
- Create: `src/engine/bob/build/void.ts`
- Test: `tests/unit/bob/build-void.test.ts`

**Interfaces:**
- Produces: `buildVoid(tier: QualityTier): VoidModel`, where `VoidModel` has:
  - `group`
  - `setLight(beam: number, mist: number)`
  - `setTime(t: number)` (the dust's and the mist's drift)
  - `setTier(tier)`
  - `dispose()`
- The parts, from `bob_scroll.py` lines ~16–75, in three coordinates:
  - the **ceiling**: the glass's underside, an annulus from the hole (1.585) out to 60, at y −1.2, facing down, near-black glass
  - its **traces**: the `traceLayout()` lines mirrored under it, glowing about 0.35
  - a **gold ring** at the hole's rim
  - **mist**: layered soft sprites in a violet haze, 3 layers on high, 2 on medium, 0 on low
  - **dust**: gold points, 400 on high, 200 on medium, 60 on low, drifting slowly
  - the **beam**: a soft cone of light from the opening, additive and dim, whose strength is `beam`
- No part writes depth through the beads.

- [ ] **Step 1: Write the failing tests**
  - The group holds the named parts.
  - The ceiling's inner radius is 1.585 at y −1.2, and it faces down.
  - The per-tier counts of mist layers and dust points match the interface.
  - `setLight(0, 0)` hides the beam and mist (opacity 0), and `setLight(1, 1)` shows them at the look's levels.
  - `setTier` only steps down.
  - `dispose` frees every geometry, material and texture it made.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit: `bob: the void under the glass — ceiling, traces, mist, dust, beam`.

### Task 4: The beads in Blender

**Files:**
- Create: `tools/blender/export_beads.py`
- Create: `public/models/bob-beads.glb`
- Test: `tests/unit/bob/beads-glb.test.ts`, which reads the GLB's JSON with `readGlbJson` (`src/engine/bob/glb.ts`)

**Interfaces:**
- Produces the GLB's nodes, per bead `<id>` in `funcial`, `jontai-energy`, `cookies-clicker`:
  - `bead_<id>`: the root, at the origin. Code places it.
  - `bead_<id>_body`: the sphere, radius 0.95, UV-mapped for the baked veins.
  - `bead_<id>_halo`: a gold band round the outline.
  - `bead_<id>_rim`: the porthole's gold rim. The porthole is about 0.62 of the radius, facing +z.
  - `bead_<id>_glass`: the porthole's curved glass.
  - `bead_<id>_display`: the small black glass display beside the object slot, with its screen area UV 0..1. Its landscape or portrait shape follows §2.4: a phone for Funcial, landscape for Jontai, phone-sized for Cookies.
  - `bead_<id>_object`: an empty, filled by Tasks 5–7.
- Materials, named: `bead:lacquer` (with the baked vein texture as its emissive and metal map, 1024², embedded), `bead:gold`, `bead:glass`, `bead:display`.
- The body is open behind the porthole so the inside shows: a hollow cavity, lit by its own dim warm light (`bead_<id>_inner`, a point light).

- [ ] **Step 1: Write the failing test**
  - The GLB exists and is ≤ 1 500 000 bytes.
  - Every node above is present for all three beads.
  - The four materials are present, and the lacquer has an embedded image.
  - The body's bounding radius is 0.95 ± 0.01.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Write `export_beads.py`.
  - It runs as `blender -b --factory-startup --python tools/blender/export_beads.py -- public/models/bob-beads.glb`.
  - It models the beads from `bob_scroll.py`'s bead section (lines ~81–176), bakes the procedural veins to the 1024² image, adds the cavity, the inner light and the display, and imports the object scripts (empty until Tasks 5–7).
  - It exports glTF binary with `export_yup`.
  - Its header says how to run it and what each node is.
- [ ] **Step 4:** Run the export, then the test. Expected: PASS. Also render one bead still (EEVEE, the preview's lighting) to the scratchpad and put it in the report.
- [ ] **Step 5:** Commit: `blender: the beads — lacquer and gold, the porthole and its cavity, a display for the screen`.

### Tasks 5–7: The three objects (one task each, in this order: Funcial, Jontai Energy, Cookies Clicker)

**Files:**
- Create: `tools/blender/bead_<id>.py` (called by `export_beads.py`)
- Modify: `public/models/bob-beads.glb` (re-exported)
- Test: `tests/unit/bob/beads-glb.test.ts`

**Interfaces:**
- Each object is modelled inside `bead_<id>_object`, fitting the cavity (within a 0.5 radius of the porthole's axis, behind the glass). Its parts are named so code can move them:
  - **Funcial** (spec §2.4, discovery row 72):
    - `funcial_platter`: a mirror aluminium disc. It turns about its axis.
    - `funcial_track`: its glowing track, UV running 0..1 from TP1 to TP4 for the pulse.
    - `funcial_pin_1` … `funcial_pin_4`
    - `funcial_abacus`, with rods and beads `funcial_bead_1` … `funcial_bead_n` that slide up their rods
    - `funcial_phone`: the display, which is `bead_funcial_display`
  - **Jontai Energy** (discovery row 131):
    - `jontai_module`, holding `jontai_cell_1` … `jontai_cell_16` in a 4 × 4 grid, in page order left to right, top to bottom, with silver busbars, a satin frame and a white backsheet at the edge
    - `jontai_box`: the junction box, with three leads `jontai_lead_1` … `3`
    - `jontai_cable`, ending in `jontai_connector`
    - The module tilts about its own x.
  - **Cookies Clicker** (discovery row 175):
    - `cookies_bridge`
    - `cookies_crown`
    - `cookies_wheel_1` … `cookies_wheel_8`, growing in size
    - `cookies_escapement` and `cookies_balance`
    - `cookies_barrel`
    - `cookies_dial`, with sub-dials
    - The materials are copper and caramel, with ruby jewels.
- Budget: the GLB stays ≤ 1 500 000 bytes after all three. Keep the geometry low (bevels as normals, not as polygons).

- [ ] **Step 1: Write the failing test.** The object's named parts are present under `bead_<id>_object`, the cell and wheel counts are exactly 16 and 8, and the GLB is within budget.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Model it in `bead_<id>.py`, re-export, and render a still of the bead with its object beside the concept frame `b01`/`b02`/`b03` for the report.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit: `blender: <title>'s object in its bead`.

### Task 8: The beads in code

**Files:**
- Create: `src/engine/bob/build/beads.ts`, `src/engine/bob/beadMotion.ts`
- Test: `tests/unit/bob/build-beads.test.ts`, `tests/unit/bob/bead-motion.test.ts`

**Interfaces:**
- Consumes: the GLB (Tasks 4–7) and the screenshots (Task 0).
- Produces: `loadBeads(gltf: GLTF, tier: QualityTier, screens: Record<ProjectId, THREE.Texture>): BeadsModel`, where `BeadsModel` has:
  - `group`
  - `beads`: per id, `{ root, body }`, for raycasting
  - `place(positions)`
  - `setForward(id, t)`, `setLit(id, t)`, `setHover(id | null)`
  - `setMotion(id, time)`
  - `setTier(tier)`
  - `dispose()`
- The screens are drawn on the displays as an emissive map, so they are lit as part of the bead. The glass is a cheap transmissive look on high and plain transparent below it.
- `beadMotion.ts` is pure, and every function reads a time that is not finite as 0:
  - `funcialMotion(t)` → `{ platter: number /* rad */, pulse: number /* 0..1 along the track */, abacus: number[] /* each bead's slide, 0..1 */ }`. The platter turns once every 40 s, the pulse runs TP1 → TP4 every 3 s, and the abacus beads slide up one after another over 2 s when selected.
  - `jontaiMotion(t)` → `{ sweep: number /* 0..1 */, cells: number[] /* 16 charges */, tilt: number /* rad */ }`. The light sweeps every 6 s, the cells charge in page order behind the sweep, and the tilt follows the sweep, up to 4°, 0.5 s behind.
  - `cookiesMotion(t)` → `{ beat: number /* whole beats */, wheels: number[] /* 8 angles */, balance: number /* rad */ }`. It ticks at 1 Hz with a stop-start step (`floor(t)` plus a 0.12 s ease), and wheel k turns 360°/(12·(k+1)) per beat.

- [ ] **Step 1: Write the failing tests**
  - **Motion:** `funcialMotion(0).platter === 0`, and `funcialMotion(40).platter` is 2π. The pulse wraps. `cookiesMotion(0.5).beat === 0` and `cookiesMotion(1.2).beat === 1`, and the wheels move only within 0.12 s of a beat. Jontai's cells charge in order 0..15 at any t.
  - **Beads:** `loadBeads` on a fake glTF with the Task 4 nodes:
    - The screens land on the displays.
    - `setLit(id, 0)` dims a bead to 0.15 of its light.
    - `setForward` moves it along (−0.4, 0.4, 1.4).
    - `setHover` brightens and turns it a little: at most 8° toward the camera.
    - `setMotion` writes the named parts and compiles nothing.
    - `dispose` frees what it made.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5:** Commit: `bob: the beads in code — their screens, light and the objects' motion`.

### Task 9: The needle leaves the armillary

**Files:**
- Modify: `src/engine/bob/build/compass.ts`
- Test: `tests/unit/bob/build-compass.test.ts`

**Interfaces:**
- Produces: `CompassModel.setNeedleWorld(override: NeedleOverride | null): void` (the type is from Task 2):
  - `null` is the armillary pose exactly as today, with `setNeedle` and `setNeedleDip` intact.
  - An override places the needle's world position and scale and turns its tip (+Y) toward `aim`, or straight down when `aim` is null.
  - The pivot follows it, as in the preview.

- [ ] **Step 1: Write the failing tests**
  - With `null` the needle's world matrix equals today's at any `setNeedle` and `setNeedleDip`.
  - An override at (1, −3, 2), scale 1.9, aimed at a point puts the tip's world direction on the point within 1e-6.
  - Going from the override back to `null` restores the pose exactly.
  - Every call is scratch-only, with no allocation.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit: `bob: the needle can leave the compass to lead the dive and point`.

### Task 10: The shot has one writer

**Files:**
- Modify: `src/scene/bob/Opening.tsx`, `src/scene/bob/Home.tsx`, `src/state/frame.ts`
- Test: `tests/unit/scene/` (a pure helper, if one is extracted)

The M2a final review's recommendation: at home, `frame.shot` is computed from `journeyPoseAt(frame.progress, aspect)` once per frame, in a frame callback that runs before the Rig.
- The Opening's home branch is the one that does this.
- Home no longer writes the shot.
- The loader and a held seek keep the Opening's own shots.
- The M2a one-frame lag goes.
- The `frame.ts` doc says who writes `shot` and when.

- [ ] **Step 1:** Write a failing test for the helper that decides the writer: loader, then held seek, then home, then journey. This is `shotSourceFor(stage, held, live)`.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement. Home's M2a rise wiring now reads `journeyPoseAt(...).rise`.
- [ ] **Step 4:** Run the full suite and build. Expected: PASS. Run `STEPS=scroll-bob` against the build (`PORT=4421 npm run preview`, `BASE=http://localhost:4421`). Expected: PASS, since the rise is unchanged.
- [ ] **Step 5:** Commit: `bob: one writer for the camera's shot, before the Rig`.

### Task 11: The void in the scene

**Files:**
- Create: `src/scene/bob/Void.tsx`
- Modify: `src/scene/bob/Home.tsx`, `src/input/useHomeScroll.ts` (the hold), `src/state/store.ts` (`voidState`), the debug bridge
- Test: `tests/unit/scene/bob-void.test.ts`

**Interfaces:**
- Produces:
  - `voidState: 'idle' | 'loading' | 'ready' | 'failed'` in the store.
  - `frame.journey = { stretch, local, project, voidState }` on `__needleDebug().journey`.
  - `TUNNEL_HOLD` (exported from `journey.ts`): the progress at which the dive's camera is halfway down the tunnel, at y −0.6 (about 1.6, inside the dive's 1.125–1.725), solved from the journey's own easing, not written as a literal. Task 2 adds its test: the shot at `TUNNEL_HOLD` stands at y −0.6 ± 0.01.
  - `diveHoldFor(voidState): number`, the most the scroll's target may reach before the void is ready: `TUNNEL_HOLD` while idle or loading, 6 when ready, and 1.0 when failed, so the scroll holds at BOB from above and `.home-nav` shows, as with 3D off.
- Behaviour:
  - **Loading:** once the home has landed, `Void` loads `bob-beads.glb` and the three screenshots, and builds `buildVoid` and `loadBeads`.
  - **Applying the pose:** each frame it applies `journeyPoseAt`: the void's light, the beads' forward, lit and motion (time runs only for the selected or hovered bead), and `setNeedleWorld`.
  - **Hover:** a raycast of the pointer against the beads' bodies, on pointer devices.
  - **Clicking:** a click on the selected bead opens its project (Task 12).
  - **Sleeping:** the canvas sleeps once the scroll rests and the selected object's motion is off screen or reduced. An object in motion keeps it drawing.
  - **Reduced motion:** M2a's step fade covers the new stops, and the objects stay still.

- [ ] **Step 1: Write the failing tests**
  - `diveHoldFor` returns `TUNNEL_HOLD` for idle and loading, 6 for ready, and 1.0 for failed.
  - The scroll input clamps its target to it, so a wheel past it while loading rests at `TUNNEL_HOLD`.
  - `frame.journey` is filled.
  - The selected bead's motion clock runs only when selected or hovered.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the suite and build. Then by hand: scroll the built site through every stop and back, with stills in the scratchpad, and name them in the report.
- [ ] **Step 5:** Commit: `bob: the dive, the void and the beads, on the scroll`.

### Task 12: The label, opening a bead, and the way back

**Files:**
- Create: `src/ui/BeadLabel.tsx`
- Modify: `src/i18n/en.ts`, `src/i18n/nl.ts`, `src/state/routeSync.ts`, `src/scene/bob/Void.tsx`, `src/styles/base.css`
- Test: `tests/unit/ui/bead-label.test.ts`, `tests/unit/state/route-sync.test.ts`

**Interfaces:**
- Copy: `t.needle.bead = { hint: 'Klik om te openen' | 'Click to open', hintTouch: 'Tik om te openen' | 'Tap to open' }`.
- `BeadLabel`: shown at a project stop. It holds three things:
  - the category line, `{number padded to 2} — {category label}`, for example "01 — BEVEILIGD ELEMENT"
  - the title, in heavy gold
  - the hint
  
  It is one `<a>` to the project page. Its place comes from `labelPlacement(beadNdc, size): { x, y, side }`, beside the bead, clamped inside the screen with a 16 px margin (24 px on a phone).
- `stopForProject(id): number` gives the project's stop: 3, 4 or 5.
- **Opening:**
  - Following the link, or clicking the bead, flies into the porthole over 0.8 s. Under reduced motion it is a fade. Then the router navigates.
  - The `PROJECT_FOCUS` pose is the bead's close view: the camera 1.6 in front of the porthole.
- **Back:** on Back or Esc from a project page, `routeSync` sets `frame.target` and `frame.progress` to `stopForProject(id)`, and the camera flies out to that stop.
- **A direct arrival:** the loader's final move goes to the close view.

- [ ] **Step 1: Write the failing tests**
  - The label server-renders the NL and EN category line, title and hint. The touch hint shows on a coarse pointer.
  - It is a link to `/projects/<slug>/` (or `/en/…`).
  - `labelPlacement` keeps the box inside at 390×844 and 1440×900 for any NDC in −1..1.
  - `stopForProject` gives 3, 4 and 5.
  - Back from a project page whose visit began elsewhere puts the target at that project's stop.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the suite and build. Then by hand: open each bead and come back, on a laptop and a phone. Name the stills in the report.
- [ ] **Step 5:** Commit: `bob: the bead's label opens the project, and Esc brings you back to it`.

### Task 13: The proof harness

**Files:**
- Modify: `tools/proof/needle.mjs`, `tools/proof/README.md`

- [ ] **Step 1:** Retime the steps bound to the old chapters for six stops: `scroll` (it reaches DIVE, not DISSECT), `keyboard` (End goes to 6), `reduced-motion` (its stops are 0..6) and `bridge`. Each keeps its intent.
- [ ] **Step 2:** Add four steps, each at 1440×900 and 390×844 (touch):
  1. **`void-journey`:**
     - Step through every stop down and back, waiting for rest.
     - Check `journey.stretch`, `project` and `voidState === 'ready'`.
     - Take stills `m2/void-<stretch>[-<id>]-<size>.png` (the dive mid-way, the overview, each bead) and gate them as home stills.
     - Back at 0 it is the M2a home, with rise 0 and the cue back.
  2. **`bead-open`:**
     - At each project stop, the label shows inside the screen, with the NL text from the dictionary.
     - Tab reaches the label, and Enter goes to `/projects/<slug>/`.
     - Esc returns to that stop.
     - Also a direct load of `/projects/cookies-clicker/`, then Esc, which lands at stop 5.
  3. **`void-hold`:** with `bob-beads.glb` held back, a long wheel rests at `TUNNEL_HOLD` (about 1.6) with `voidState` `loading`. On release, the scroll goes on to the overview.
  4. **`void-fail`:** with the GLB answering 404, the scroll holds at 1.0, `.home-nav` shows, and there is exactly one reported console error.

  Every step ends with `errors: []` (beyond the designed one) and `csp: []`.
- [ ] **Step 3:** Run the full harness on `PORT=4421`. Expected: every step passes. Report each line.
- [ ] **Step 4:** Commit: `proof: six stops, the void's journey, opening a bead, the hold and the failure`.

### Task 14: The proof for Bob

**Files:** none in the repo. Write the review page `.superpowers/brainstorm/36444-1792638642/content/bob-m2b-review.html` (git-excluded).

- [ ] **Step 1: Record** at 1440×900, as M2a's Task 11 did: CDP screencast, then encoded through `tools/blender/bob_encode.py`. The recording covers:
  1. the home
  2. a slow scroll through the rise, the dive and the overview
  3. each bead's stop
  4. opening Funcial
  5. Esc back
  6. the scroll back home
- [ ] **Step 2: Write the page.** It holds:
  - the recording, beside the preview video `m2b-dive.mp4`
  - the stills at both sizes, beside `d01`–`d03` and `b01`–`b03`
  - each object's motion, as a short clip or three stills
  - honest notes, measured against the frames
  - the checks in plain numbers, every one from the run's `results.json`
- [ ] **Step 3:** Report the page path. No commit.

---

## Not in this plan

- **The project pages' 3D interiors** (spec §2.5: the mirror floor, the curved display, the test-point track): M3. Until then a project page stands over its bead seen close.
- **The bead details** "the category line engraved in the gold band" and "test-point pins round the porthole" (§2.4).
- **Sound.**
