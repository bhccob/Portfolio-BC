# BOB M2a: only the O, and the B letters on the scroll — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The loader cuts only the circle (6.25 s), the home shows the compass alone, and the first stretch of scroll opens the iris and raises the camera to look straight down while gold light runs out of the O into the two B letters, so BOB reads from above. Scrolling back reverses all of it. Also: the floor's reflection blurs into gold streaks, and the circuit traces lie under the glass.

**Architecture:**
- The loader stays one pure timeline (`loaderTimeline.ts`) driving a pure pose (`openingPose.ts`); only its script changes.
- The scroll gets a pure pose of its own (`scrollPose.ts`): from the scroll's `frame.progress` to the iris, the needle's dip, the letters' light front and the camera shot. Home and Opening apply it through new setters on the compass and the engraving.
- The chapters, phases and scroll input are not renamed or rebuilt here. The rise uses the HOME chapter's one unit of scroll (progress 0 → 1); past 1 the view holds at BOB from above until M2b builds the dive and the void.

**Tech Stack:** React Router 8 (prerendered NL/EN), React Three Fiber 9.8, three 0.186, zustand, Vitest 5, TypeScript 7, Blender 5.2 (previs scripts only), the Playwright-core proof harness `tools/proof/needle.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-21-bob-compass-design.md`, revised 2026-10-22: §2.1 loader, §2.2 home, §2.3 scroll steps 1–3, §7 preview values, and §8 "Carried into M2".

**Preview it argues from:** `.superpowers/brainstorm/bob-only-o-2026-10-22/`: `bob_animate_o.py` (the loader) and `bob_reveal_b.py` (`REVEAL == 'glow'`, the letters). Frames `docs/design/bob-compass/o01`–`o05`.

## Global Constraints

- NL is the default at `/` and EN is at `/en/`. Copy stays formal. No new copy is needed in this plan.
- The strict CSP stays: no inline scripts or styles, no new script sources. No new dependencies.
- Every page stays prerendered with real DOM text. The canvas sleeps when nothing moves ("When nothing moves, nothing renders").
- Quality: 60 fps on a mid-range laptop and at least 30 on a mid-range phone, with the existing quality tiers; low tier has no reflector and no transmission (Rulings 16, 25, 31).
- Reduced motion: "each step becomes a short fade" (§2.3); the loader's reduced path stays the 1 s fade.
- The luminance gate stays the harness's `LUMA_GATE`: home ≤ 0.11 mean, loader ≤ 0.07, at most 0.4 % clipped, floor mean > 0.002 and some pixel > 0.3. The new BOB-from-above still is gated as a home still.
- "Dark, calm, one focal point": the light front is the only new motion. No sparks, no laser and no sound in the scroll.
- Nothing is pushed, and nothing is merged into `redesign-bench` or `main`, without Bob's OK.
- Gates before every commit:
  - `npx vitest run`
  - `npm run typecheck`
  - `npm run build`
  - the auditor, run with Blender's Python because there is no system Python: `"/c/Program Files (x86)/Steam/steamapps/common/Blender/5.2/python/bin/python.exe" -I tools/site_audit.py dist/client`, which must report 0 errors and 0 warnings
  - from Task 10 on, the harness steps the task names

## Review Focus

1. **A window resized at BOB from above, or partway up.** The camera reframes for the new shape at the same point of the rise, with no jump and no cut name. The test is in Task 6 (`scrollPoseAt` is a pure function of `u` and the aspect, and the whole name fits on every aspect at `u = 1`) and Task 7 (Opening reframes from the scroll pose, not the home shot).
2. **Scrolling back up to the home.** The needle returns to exactly the pose and the aim it had, without snapping. The letters go dark and are not drawn, so the home again shows the compass alone. Tests: Task 5 (`setNeedleDip(0)` restores the `setNeedle` pose exactly), Task 4 (`setLetters(0)` draws no B), Task 10 (`scroll-bob`).
3. **A wheel, key or swipe during the loader.** The B letters never show during the loader, and a skip's input still never moves the story. The first scroll after landing starts the rise from 0. Tests: Task 1 (the clock's B strokes are 0 at every second of every path), Task 10 (`loader-skip` unchanged, and `scroll-bob` starts from `u = 0`).
4. **Reduced motion.** One wheel event moves a whole stop. The pose changes while the canvas is faded down, with no running front and no camera travel. Tests: Task 7 (`stepFadeFor`), Task 10 (`scroll-bob` reduced).
5. **A phone (390×844, coarse pointer, medium tier).** The whole name fits across the width at the top, the letters' light works on every tier, and the parallax is gone by the time the camera is steep. Tests: Task 2 (`topShotFor` at 390/844), Task 4 (the letters material is a basic material on every tier), Task 6 (`sway` is 0 from `u = 0.6`), Task 10 (`scroll-bob` at 390×844).

---

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `tools/blender/bob_animate_o.py`, `bob_reveal_b.py`, `run_o.py` | create (copied from the preview folder) | the O-only previs, rebuildable headless |
| `src/engine/bob/loaderTimeline.ts` | modify | the O-only script; the B strokes stay 0 |
| `src/engine/bob/probePath.ts` | modify | the probe cuts the circle only |
| `src/engine/bob/shots.ts` | modify | the closer wide frame, the top frame, `up` and `sway` on a shot |
| `src/scene/Rig.tsx` | modify | applies `up`, scales the parallax by `sway` |
| `src/scene/bob/openingPose.ts` | modify | `HOME_POSE` has no B letters |
| `src/engine/bob/build/engraving.ts` | modify | the letters' own material with a light front; `setLetters` |
| `src/engine/bob/build/compass.ts` | modify | `setIris`, `setNeedleDip` |
| `src/scene/bob/scrollPose.ts` | create | pure: scroll progress to the rise's pose |
| `src/scene/bob/Home.tsx`, `src/scene/bob/Opening.tsx`, `src/state/frame.ts`, the debug bridge, `src/styles/base.css` | modify | apply the scroll pose; reduced-motion step fade; debug fields |
| `src/engine/bob/build/glassFloor.ts` | modify | the reflection blurred into streaks |
| `src/engine/bob/build/traces.ts` | modify | the traces under the glass |
| `tools/proof/needle.mjs`, `tools/proof/README.md` | modify | loader steps retimed; new `scroll-bob` step |

---

### Task 0: Branch, ledger, the previs scripts

**Files:**
- Create: `tools/blender/bob_animate_o.py`, `tools/blender/bob_reveal_b.py`, `tools/blender/run_o.py`

- [ ] **Step 1:** Create the worktree branch `bob-m2a` from `bob-polish` at `.claude/worktrees/bob-m2a`. Run `npm ci` there.
- [ ] **Step 2:** Copy the three scripts from `.superpowers/brainstorm/bob-only-o-2026-10-22/`, and change `run_o.py` as follows:
  - It takes `-- <laser|glow> <out_dir>`.
  - `TOOLS` is the script's own folder.
  - `OUT_DIR` is patched to `<out_dir>`, never to `tools/blender/`.
  - Its header names the command: `blender -b --factory-startup --python tools/blender/run_o.py -- glow <out_dir>`.
- [ ] **Step 3:** Verify that `blender -b --factory-startup --python tools/blender/run_o.py -- glow <scratch dir>` prints `saved glow` and writes `bob-o-glow.blend` into `<scratch dir>`.
- [ ] **Step 4:** Commit: `tools: the O-only previs scripts (loader, the B letters' light)`.

### Task 1: The O-only loader script

**Files:**
- Modify: `src/engine/bob/loaderTimeline.ts` (the `FRAMES` table, `SCRIPT`, `fullClock`, the header)
- Test: `tests/unit/bob/loader-timeline.test.ts`

**Interfaces:**
- Produces:
  - `SCRIPT` with the same fields minus the B spans: `descend`, `circle`, `ticks`, `outer`, `probeOut`, `iris`, `glow`, `rise`, `camera`, `settle` and `home`. `leftB`, `leftBar`, `rightB` and `rightBar` are removed.
  - `LoaderClock.strokes` keeps its five-entry shape in `STROKE_ORDER`. The four B entries are always 0.
  - `HOLD_AT` stays `circle.start + LOADER.hold × (circle span)`.
  - `QUICK`, `LOADER` and the skip and hold logic are unchanged.

- [ ] **Step 1: Write the failing tests** (replace those that pin the old timings; keep every monotonic, hold, crawl, skip and continuity test, and re-express its literal seconds through `SCRIPT`):

```ts
it('is the O-only preview (bob_animate_o.py) at 24 fps', () => {
  expect(SCRIPT.descend).toEqual({ start: 1 / 24, end: 26 / 24 });
  expect(SCRIPT.circle).toEqual({ start: 26 / 24, end: 74 / 24 });
  expect(SCRIPT.ticks).toEqual({ start: 72 / 24, end: 86 / 24 });
  expect(SCRIPT.outer).toEqual({ start: 74 / 24, end: 96 / 24 });
  expect(SCRIPT.probeOut).toEqual({ start: 74 / 24, end: 94 / 24 });
  expect(SCRIPT.iris).toEqual({ start: 80 / 24, end: 96 / 24 });
  expect(SCRIPT.glow).toEqual({ start: 78 / 24, end: 106 / 24 });
  expect(SCRIPT.rise).toEqual({ start: 88 / 24, end: 140 / 24 });
  expect(SCRIPT.camera).toEqual({ start: 80 / 24, end: 140 / 24 });
  expect(SCRIPT.settle).toEqual({ start: 100 / 24, end: 150 / 24 });
  expect(SCRIPT.home).toBe(6.25);
  expect('leftB' in SCRIPT).toBe(false);
});

it('never draws a B: the four B strokes are 0 at every second of every path, skipped or held', () => {
  for (const path of ['full', 'quick', 'reduced'] as const)
    for (let t = 0; t <= 30; t += 0.05)
      for (const input of [{ loadedAt: 0 }, { loadedAt: null }, { loadedAt: 20, skipAt: 1 }])
        expect(loaderAt({ elapsed: t, skipAt: null, path, ...input }).strokes.slice(0, 4)).toEqual([0, 0, 0, 0]);
});

it('cuts the circle at constant speed: half of it at 2.08 s, all of it at 74/24 s', () => {
  expect(full(50 / 24).strokes[4]).toBeCloseTo(0.5, 6);
  expect(full(74 / 24).strokes[4]).toBe(1);
  expect(full(2).stage).toBe('engrave');
  expect(full(0.5).stage).toBe('dark');
  expect(full(6.24).stage).toBe('rise');
  expect(full(6.25).stage).toBe('home');
});
```

  Rewrite the Ruling 32 test as "a skip at 5.75 s lands by 6.25 s". The test "a skip at 3 s lands at 4.0 s" becomes "a skip at 1.5 s lands at 2.5 s".

- [ ] **Step 2:** Run `npx vitest run tests/unit/bob/loader-timeline.test.ts`. Expected: FAIL on the new timings.
- [ ] **Step 3:** Implement the `FRAMES` table from `bob_animate_o.py`: descend 1–26, circle 26–74, ticks 72–86, outer 74–96, probeOut 74–94, iris 80–96, glow 78–106, rise 88–140, camera 80–140, settle 100–150, home 150.
  - `fullClock` writes `[0, 0, 0, 0, max(circleFloor, through(script, SCRIPT.circle))]`.
  - The stage boundaries keep their rule: `dark` until `descend.end`, `engrave` until `circle.end`, `open` until `rise.start`, `rise` until `home`.
  - Rewrite the header's first paragraph for the O-only show (6.25 s, "every first-time visitor sees the O cut").
- [ ] **Step 4:** Run `npx vitest run tests/unit/bob/`. Expected: loader-timeline passes. Other files that pinned B strokes fail until Task 3; list them in the report.
- [ ] **Step 5:** Commit: `bob: the loader cuts only the O (6.25 s)`.

### Task 2: The shots: a closer wide shot, the top shot, `up` and `sway`

**Files:**
- Modify: `src/engine/bob/shots.ts`, `src/scene/Rig.tsx`
- Test: `tests/unit/bob/shots.test.ts`, `tests/unit/bob/look.test.ts` (the fog test's wide numbers)

**Interfaces:**
- Produces:
  - `CameraShot` gains two optional fields:
    - `up?: readonly [number, number, number]`: the camera's up vector. Absent means +Y.
    - `sway?: number`: how much parallax the Rig may add, 0..1. Absent means 1.
  - `FRAMES.wide = { distance: 11.2, elevation: 19, targetY: 0.1, halfWidth: 4.0 }`.
  - `FRAMES.top = { distance: 12.6, elevation: 90, targetY: 0, halfWidth: 4.6 }`.
  - `topShotFor(aspect: number): CameraShot`: straight down onto (0, 0, 0), with `up: [0, 0, -1]` (the far side of the glass at the top of the screen) and `sway: 0`. The field and distance follow `shotFor`'s rule: width fit, at most `MAX_VFOV`, standing back past it.
  - `applyCameraShot` sets `camera.up` from `shot.up ?? [0, 1, 0]`.
  - `lerpCameraShot` is unchanged. It is the loader's, and its shots carry no `up`.

- [ ] **Step 1: Write the failing tests:**

```ts
it("frames only the O in the loader's wide shot: the outer ring (r 1.88) inside the screen with room to spare", () => {
  for (const aspect of [16 / 9, 16 / 10, 21 / 9, PHONE]) {
    const shot = wideShotFor(aspect);
    for (const p of [[1.88, 0, 0], [-1.88, 0, 0], [0, 0, 1.88], [0, 0, -1.88]] as const) {
      const [nx, ny] = project(shot, aspect, [...p]);
      expect(Math.abs(nx)).toBeLessThan(0.75);
      expect(Math.abs(ny)).toBeLessThan(0.9);
    }
  }
});

it('looks straight down at the top, the far side up, the whole name across every screen', () => {
  for (const aspect of [16 / 9, 21 / 9, 1, PHONE, 0.3]) {
    const shot = topShotFor(aspect);
    expect(shot.up).toEqual([0, 0, -1]);
    expect(shot.sway).toBe(0);
    expect(shot.position[0]).toBe(0);
    expect(shot.position[2]).toBeCloseTo(0, 9);
    for (const x of [-4.25, 4.25]) expect(Math.abs(project(shot, aspect, [x, 0, 0], [0, 0, -1])[0])).toBeLessThan(0.95);
    // The B letters' tops (z -1.7) are up the screen.
    expect(project(shot, aspect, [0, 0, -1.7], [0, 0, -1])[1]).toBeGreaterThan(0);
  }
});

it("puts the camera's up where the shot says, +Y when it says nothing", () => {
  const camera = new THREE.PerspectiveCamera();
  applyCameraShot(camera, topShotFor(16 / 9), 16 / 9);
  expect(camera.up.toArray()).toEqual([0, 0, -1]);
  applyCameraShot(camera, homeShotFor(16 / 9), 16 / 9);
  expect(camera.up.toArray()).toEqual([0, 1, 0]);
});
```

  `project` gains an optional `up` argument for the camera it builds. Update `wideShotFor`'s other tests and the fog test's distances to the new frame.

- [ ] **Step 2:** Run `npx vitest run tests/unit/bob/shots.test.ts tests/unit/bob/look.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the shots changes. Then change the Rig:
  - The Rig's parallax is multiplied by `shot.sway ?? 1`, so at 0 it adds nothing.
  - Its `lookAt` after the orbit keeps the camera's `up` as `applyCameraShot` set it.
- [ ] **Step 4:** Run the same tests and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit: `bob: a wide shot of the O alone, the top shot of BOB, a shot's up and sway`.

### Task 3: The pose and the probe without the B letters

**Files:**
- Modify: `src/scene/bob/openingPose.ts` (`HOME_POSE`, the header), `src/engine/bob/probePath.ts` (only the circle)
- Test: `tests/unit/bob/opening-pose.test.ts`, `tests/unit/bob/probe-path.test.ts`

**Interfaces:**
- Consumes: Task 1's `SCRIPT` (no B spans), and `wideShotFor`/`homeShotFor` from Task 2.
- Produces:
  - `HOME_POSE.strokes = [0, 0, 0, 0, 1]`.
  - `probeAt(clock)` follows: down onto the circle's start over `descend`, round the circle over `circle`, up and away over `probeOut`, then parked at `{ x: 0, y: PROBE.outY, z: 0, cutting: false, shown: false }`, as Ruling 2 does.

- [ ] **Step 1: Write the failing tests:**
  - `HOME_POSE.strokes` equals `[0, 0, 0, 0, 1]`, and every path's end pose equals `HOME_POSE` exactly (the existing equality test, kept).
  - `probeAt` at `SCRIPT.descend.end` is at `circlePath(WORDMARK.circle)[0]` at `PROBE.cutY`, cutting.
  - Halfway through `circle`, it is on the circle (distance to the centre within 1e-6 of 1.66), cutting.
  - At `SCRIPT.probeOut.end` and after, it is parked.
  - It is never at an x beyond ±1.7 on any second of the full path, because it never visits a B.
- [ ] **Step 2:** Run the two test files. Expected: FAIL.
- [ ] **Step 3:** Implement. Drop the probe's stroke-to-stroke travel, since there is one stroke.
- [ ] **Step 4:** Run `npx vitest run`. Expected: everything passes, including the files Task 1 listed.
- [ ] **Step 5:** Commit: `bob: the home has no B letters and the probe cuts only the circle`.

### Task 4: The letters' light front (`setLetters`)

**Files:**
- Modify: `src/engine/bob/build/engraving.ts`
- Test: `tests/unit/bob/` (the engraving builder's test file, or a new `build-engraving-letters.test.ts`)

**Interfaces:**
- Produces:
  - `EngravingModel.setLetters(share: number): void`, with `share` 0..1 (NaN reads as 0):
    - At 0, the four B strokes are not drawn (draw range 0).
    - Above 0, they are drawn whole, and the light front stands at `mix(LETTERS.from, LETTERS.to, share)` metres past `|x| = LETTERS.inner`.
  - `ENGRAVING_LOOK.letters = { inner: 1.9, from: -0.6, to: 2.9, ramp: 0.45, edge: 3.3 }`. These are the preview's `bob_reveal_b.py` glow values. `edge` is the leading edge's extra brightness (the preview's `mask × (1 − mask) × 10` over its emission 3).
  - The B strokes get their own material `engraving:letters`. It is a `MeshBasicMaterial` whose `onBeforeCompile` adds uniforms `uFront` and `uLook` (`vec3(inner, ramp, edge)`) and a world-x varying. The fragment shader:
    - `k = clamp((uFront - (abs(worldX) - inner)) / ramp, 0., 1.)`
    - discard where `k <= 0.`
    - `gl_FragColor.rgb *= k + edge * k * (1. - k)`
  - `customProgramCacheKey` returns `'bob-letters'`.
  - The circle keeps `engraving:stroke`. `setGlow` sets both colours.
  - `setStroke` on a B id still sets its draw range, which the loader uses at 0.

- [ ] **Step 1: Write the failing tests:**
  - `setLetters(0)` leaves the four B meshes at draw count 0 and the circle untouched.
  - `setLetters(0.5)` draws each B whole, and `uFront` is `-0.6 + 3.5 × 0.5`.
  - The B meshes' material is `engraving:letters`, which is not the circle's material.
  - The compiled fragment shader (use `onBeforeCompile` on a physical/basic `ShaderLib` copy, as `build-compass.test.ts` does for the bands) contains the `discard` and the `k` expression.
  - `setGlow(0.5)` scales both materials' colours the same way.
  - `setLetters(NaN)` is `setLetters(0)`.
  - Repeated `setLetters` calls do not change the material's `version`, because a frame of the front compiles nothing.
  - `dispose` frees the letters material.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npx vitest run tests/unit/bob/`. Expected: PASS.
- [ ] **Step 5:** Commit: `bob: the B letters' light runs out of the O (setLetters)`.

### Task 5: The iris and the needle's dip on the compass

**Files:**
- Modify: `src/engine/bob/build/compass.ts`
- Test: `tests/unit/bob/build-compass.test.ts`

**Interfaces:**
- Produces:
  - `COMPASS_LOOK.iris = { radii: [1.66, 1.74, 1.82, 1.9], turn: 0.4, flatY: 0.09 }`. These are the preview's `IRIS_R`, the per-band turn `k × 0.4` rad about the world's up, and `ARM_FLAT_Z`.
  - `CompassModel.setIris(t: number): void`, with `t` 0..1 (NaN reads as 0). Eased by smoothstep, each band's base orientation slerps from its rest to lying flat:
    - Lying flat means its own Y, round which it lies and turns, is on the world's +Y, turned `k × turn` about it.
    - Its scale in its own plane goes from 1 to `radii[k] / R_k`, where `R_k` is the band's radius measured from its geometry's bounding sphere at load.
    - The armillary goes down from `homeY` to `flatY`.
    - `setSpin`'s turn composes after the base: `quaternion = base × turn(Y, spin)`.
    - `setIris(0)` is exactly the rest pose.
  - `CompassModel.setNeedleDip(t: number): void`, with `t` 0..1 (NaN reads as 0):
    - On smoothstep, the needle's world orientation slerps from the pose `setNeedle` gives to the one with its tip (+Y) on the world's −Y.
    - `setNeedleDip(0)` is exactly the `setNeedle` pose.
    - Calls to `setNeedle` and `setRise` keep the dip.

- [ ] **Step 1: Write the failing tests:**
  - `setIris(0)` leaves every band's quaternion and scale, and the armillary's y, as they were (within 1e-12).
  - `setIris(1)` puts each band's local Y on world +Y within 1e-6, its in-plane scale on `radii[k] / R_k`, and the armillary at y 0.09 above the glass.
  - `setSpin(t)` after `setIris(1)` keeps the band flat.
  - `setIris(0.5)` is between the two, and its angle to the rest is monotonic over 0..1.
  - `setNeedleDip(1)` puts the tip direction (`needleTip` helper, as the existing tests use) within 1e-6 of (0, −1, 0), from any `setNeedle` angle.
  - `setNeedleDip(0)` after `setNeedle(a)` equals `setNeedle(a)` alone.
  - `setNeedle(b)` while dipped 1 keeps the tip down.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement. Use scratch quaternions only: these run every frame of a scroll.
- [ ] **Step 4:** Run it. Expected: PASS.
- [ ] **Step 5:** Commit: `bob: the compass opens like an iris and the needle turns down (setIris, setNeedleDip)`.

### Task 6: The scroll's pose (pure)

**Files:**
- Create: `src/scene/bob/scrollPose.ts`
- Test: `tests/unit/scene/bob-scroll-pose.test.ts`

**Interfaces:**
- Consumes: `homeShotFor` and `topShotFor` (Task 2), `HOME_CHAPTERS` (`src/state/chapters.ts`).
- Produces:
  - `RISE_SPANS = { iris: [0, 0.742], needle: [0, 0.645], letters: [0.29, 0.935], camera: [0, 1] }`, shares of the rise, from the preview's frames 300–362: iris 300–346, needle 300–340, letters 318–358.
  - `riseAt(progress: number): number`: the HOME chapter's unit as the rise, `clamp01(progress / HOME_CHAPTERS.units[0].length)`, with NaN read as 0.
  - `interface ScrollPose { u: number; iris: number; needleDip: number; letters: number; shot: CameraShot }`
  - `scrollPoseAt(u: number, aspect: number): ScrollPose`:
    - `iris`, `needleDip` and `letters` are `u` through their spans, linear (the setters ease them).
    - `shot` is the home shot at `u = 0`, exactly `homeShotFor(aspect)` with no `up` and no `sway`.
    - In between, with `e = smoothstep(u through camera)`:
      - elevation `mix(13, 90, e)` degrees
      - distance and fov mixed from the home shot's to the top shot's
      - target y `mix(0.55, 0, e)`
      - `up` given only above 80° of elevation, as `(0, cos el, −sin el)`
      - `sway = clamp01(1 − u / 0.6)`
    - It is the top shot exactly at `u = 1`.

- [ ] **Step 1: Write the failing tests:**

```ts
it('is the home at 0 and BOB from above at 1, on every screen', () => {
  for (const a of [16 / 9, 1, 390 / 844]) {
    expect(scrollPoseAt(0, a)).toEqual({ u: 0, iris: 0, needleDip: 0, letters: 0, shot: homeShotFor(a) });
    const top = scrollPoseAt(1, a);
    expect([top.iris, top.needleDip, top.letters]).toEqual([1, 1, 1]);
    expect(top.shot).toEqual(topShotFor(a));
  }
});

it("lights the letters over the preview's frames 318-358 of the 300-362 rise", () => {
  expect(scrollPoseAt(0.29, 16 / 9).letters).toBe(0);
  expect(scrollPoseAt(0.935, 16 / 9).letters).toBe(1);
  expect(scrollPoseAt((0.29 + 0.935) / 2, 16 / 9).letters).toBeCloseTo(0.5, 9);
});

it('rises monotonically and continuously: elevation never drops, no step over 1.5 degrees per 1/200 of the rise', () => { /* sample u in 0..1 step 0.005 at 16:9 and 390/844 */ });
it('has no parallax from 0.6 of the rise, and an up only above 80 degrees', () => { /* sway 0 at u >= 0.6; up undefined where elevation <= 80 */ });
it('reads a bad u as 0, and progress past the HOME unit as the top', () => {
  expect(riseAt(Number.NaN)).toBe(0);
  expect(riseAt(-1)).toBe(0);
  expect(riseAt(0.5)).toBe(0.5);
  expect(riseAt(7)).toBe(1);
});
```

- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run it. Expected: PASS.
- [ ] **Step 5:** Commit: `bob: the scroll's pose, from the home to BOB from above`.

### Task 7: The scene follows the scroll

**Files:**
- Modify: `src/scene/bob/Home.tsx`, `src/scene/bob/Opening.tsx` (the home's camera write), `src/state/frame.ts`, the debug bridge that serves `window.__needleDebug`, `src/styles/base.css`
- Create: `src/scene/bob/stepFade.ts` (pure)
- Test: `tests/unit/scene/bob-step-fade.test.ts`, plus a pure-helper test for the aim's hand-off if one is extracted

**Interfaces:**
- Consumes: Tasks 4–6.
- Produces:
  - `frame.scroll = { u: number; letters: number; iris: number; needleDip: number }`, written each frame the home poses and exposed on `__needleDebug().scroll`.
  - `stepFadeFor(prevStop: number, stop: number, reduced: boolean): boolean`: true when a reduced-motion visitor moved to another stop.
  - `STEP_FADE_MS = 150`, each way.
  - With reduced motion, a stop change sets `html[data-step-fade]`. CSS fades `.scene-host` to opacity 0 over 150 ms; the pose jumps while it is dark; the attribute is removed and the host fades back over 150 ms.
  - Without reduced motion, `transition: none` never applies.
  - Reduced motion is the only case where the attribute is set.

- [ ] **Step 1: Write the failing tests:**
  - `stepFadeFor(0, 1, true)` is true. `stepFadeFor(1, 1, true)` is false. `stepFadeFor(0, 1, false)` is false.
  - The CSS rule exists, scoped to `html[data-step-fade] .scene-host` with `opacity: 0`, and the `.scene-host` transition is `opacity 150ms`. Use a stylesheet scan like `header-loading.test.ts`.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement the wiring:
  - **Home's frame,** while live:
    - `u = riseAt(frame.progress)`, then `p = scrollPoseAt(u, aspect)`
    - `compass.setIris(p.iris)`, `compass.setNeedleDip(p.needleDip)`, `engraving.setLetters(p.letters)`
    - `frame.shot = p.shot` when `u` or the aspect changed since the last write
    - `frame.scroll` filled in
  - **The aim:** it runs only at `u === 0`. With `u > 0` the spring holds its target, and the dip carries the needle.
  - **Idle:** a change of `u` counts as a stir.
  - **The canvas:** it keeps drawing while `frame.progress !== frame.target` (the scroll loop already wakes it), and sleeps again at rest.
  - **Opening at home:** the resize branch writes `scrollPoseAt(riseAt(frame.progress), aspect).shot` instead of `cameraShotAt`, so a resize mid-rise reframes in place.
  - **The step fade:** wire it in Home, driven by `stops(HOME_CHAPTERS)` and the nearest stop to `frame.target`.
- [ ] **Step 4:** Run `npx vitest run`, `npm run typecheck` and `npm run build`. Expected: PASS. Then check in the browser by hand:
  - `npm run preview`, then wheel once on `/`: the camera rises and the letters light. Wheel back: the home.
  - Note what you saw in the report. Task 10 automates it.
- [ ] **Step 5:** Commit: `bob: scrolling opens the iris, lights the B letters and looks down on BOB`.

### Task 8: The floor's reflection, blurred into streaks (§8, carried into M2)

**Files:**
- Modify: `src/engine/bob/build/glassFloor.ts`
- Test: `tests/unit/bob/build-glass.test.ts`

**Interfaces:**
- Produces:
  - `GLASS_LOOK.reflector.blur = { taps: 9, along: 0.06, across: 0.006 }`: the reflection is sampled in a short streak along the scratches' angle (`GLASS_LOOK.scratch.angle`), `along` and `across` in UV units of the reflector's texture.
  - The reflector's shader is three's `Reflector` default shader with its texture read replaced by a `taps`-tap average along the streak.
  - It stays a high-tier-only part, so the tiers are unchanged.

- [ ] **Step 1: Write the failing test:**
  - The reflector's fragment shader has a loop or unrolled sum of `GLASS_LOOK.reflector.blur.taps` `texture2DProj`/`texture2D` reads, with uniforms `uAlong` and `uAcross` equal to the look's values.
  - `setReflector(false)` still removes it.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the test. Build, serve the build with `npm run preview`, and take a 1440×900 home still: `STEPS=home-look`, or a still by hand. Expected:
  - the compass's reflection reads as soft gold streaks, not a sharp copy
  - the home luma stays under the gate
  - Put the still in the report.
- [ ] **Step 5:** Commit: `bob: the floor's reflection blurs into gold streaks along the scratches`.

### Task 9: The traces under the glass (§8, carried into M2)

**Files:**
- Modify: `src/engine/bob/build/traces.ts`, and `glassFloor.ts` only if the floor's draw order needs it
- Test: `tests/unit/bob/traces.test.ts`

**Interfaces:**
- Produces:
  - `TRACES_LOOK.depth = 0.015`: the traces lie that far under the glass (`lines.position.y = −depth`; `lift` is removed).
  - They draw before the glass (`renderOrder` below `GLASS_RENDER_ORDER`), so the floor's tint dims them.
  - `TRACES_LOOK.level` is retuned so their mean brightness at rest in the 1440×900 home still is within ±20 % of M1's. Measure both and put the numbers in the report.

- [ ] **Step 1: Write the failing test:**
  - The traces' group is at y −0.015.
  - Their `renderOrder` is less than `GLASS_RENDER_ORDER`.
  - `setLevel` still scales them.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement, and measure as above.
- [ ] **Step 4:** Run `npx vitest run`, then build. Check stills at the home and at BOB from above, where the traces show most. Expected: the traces read under the glass, with no z-fighting and no shimmer.
- [ ] **Step 5:** Commit: `bob: the circuit traces lie under the glass`.

### Task 10: The proof harness

**Files:**
- Modify: `tools/proof/needle.mjs`, `tools/proof/README.md`

**Interfaces:**
- Consumes: `frame.scroll` through `__needleDebug().scroll` (Task 7), and `SCRIPT` (Task 1).

- [ ] **Step 1:** Change `LOADER_MOMENTS` to:

  | seconds | stage | moment |
  | --- | --- | --- |
  | 0.5 | dark | black, the probe coming down |
  | `50/24` | engrave | half the circle |
  | 3.6 | open | the iris |
  | 4.6 | rise | the rise |
  | `SCRIPT.home` | home | home |

  Every step that acts "3 s in" (`loaderAtLeast(page, 3)` and its checks, such as `at.elapsed >= 3 && < 3.5` and "engraves") acts 1.5 s in instead: inside the circle's cut. Update the header comments and the README's rows.
- [ ] **Step 2:** Add a step `scroll-bob` at 1440×900 and at 390×844 (touch, coarse):
  1. Land with the seen flag set.
  2. Sample `scroll` at rest: `u === 0` and `letters === 0`. No B is drawn: the debug engraving reports B draw counts of 0, or check `scroll.letters`.
  3. Move one stop down: a 120 px wheel at 1440, a swipe up at 390. Then wait for rest.
  4. Check `u === 1`, `letters === 1`, `iris === 1` and `needleDip === 1`.
  5. Take a still `m2/bob-from-above-<size>.png` and gate it with the home gate. Expected: the whole name in view, which the unit test pins.
  6. Take one mid-rise still at `u ≈ 0.6` through the bridge's `.set` of `target`: `m2/bob-rising-<size>.png`.
  7. Move one stop up. Check `u === 0` and `letters === 0`. At 1440, the needle aims at the pointer again within 1.5 s.
  8. With reduced motion: one wheel event, then `html[data-step-fade]` was set during the step, and the step lands on `u === 1`.
  9. `errors: []` and `csp: []`.

  Register the step and add its README row.
- [ ] **Step 3:** Run the full harness. Expected: every step passes (37 steps). Report each step's line.
- [ ] **Step 4:** Commit: `proof: the loader steps at the O-only pace, and scroll-bob`.

### Task 11: The proof for Bob

**Files:** none in the repo. The review page is git-excluded, in `.superpowers/brainstorm/<companion session>/content/bob-m2a-review.html`.

- [ ] **Step 1:** Record the real loader into the home and one scroll down and back up at 1440×900, as M1's Task 12 did (Ruling 28): `bob-m2a-1440x900.webm`.
- [ ] **Step 2:** Write the review page:
  - the recording next to the preview videos `o-loader.mp4` and `o-scroll-glow.mp4`
  - the loader moments and the scroll stills at both sizes beside `o01`–`o05`
  - the home before and after for the reflection and the traces
  - honest notes on what is rough
  - the checks in plain numbers
- [ ] **Step 3:** Report the page's path. No commit.

---

## Not in this plan (M2b)

- **The dive** through the O and its tunnel.
- **The void** under the glass sky, the beads, the needle as pointer, the labels, hover and click.
- **The bead glimpsed through the opening** during the iris (§2.3 step 1). It needs the void, so until M2b the opening shows the tunnel's glow and the dark below.
- **The chapters and phases** renamed for BOB: HOME, IRIS, DIVE, VOID, PROJECTS in place of DISSECT and MORPH.

Until M2b, scrolling past the first stop holds at BOB from above.
