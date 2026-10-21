# BOB M1: the loader and the home. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the first milestone of "BOB with the compass as the O".
- A first visit plays the loader: a laser engraves B, B and a circle into dark glass, the glass opens, and an armillary compass rises as the O. It is skippable.
- Later visits play a short version.
- The loader lands on the home: close on the compass, half of each B off screen, the needle following the cursor.
- The countries are removed.

**Architecture:**
- A new `bob` namespace replaces v3's scene modules, keeping v3's architecture:
  - pure modules in `src/engine/bob/` (geometry, timeline, shots, probe path), each unit-tested
  - imperative three.js builders in `src/engine/bob/build/` that return a model with setters
  - a pure pose module in `src/scene/bob/openingPose.ts`
  - thin R3F components (`src/scene/bob/Opening.tsx`, `Home.tsx`) that read the clock each frame and pose the builders
- The compass (bands, rims, needle, pivot, axis) and its `rise` animation are made in Blender and loaded as one GLB. Everything else is built in code.
- World units are the preview's metres. Blender `(x, y, z)` is three `(x, z, −y)` (the glTF exporter's +Y up): the glass is the plane y = 0, and the home camera sits at +z looking toward −z.

**Tech Stack:**
- React Router 8.5 (prerendered NL/EN)
- React Three Fiber 9.8, three 0.186, drei 10.7, @react-three/postprocessing 3.2
- zustand 5, Vitest 5, TypeScript 7
- Blender 5.2 LTS (headless export) at `C:\Program Files (x86)\Steam\steamapps\common\Blender\blender.exe`
- The Playwright proof harness (`tools/proof/needle.mjs`)

**Spec:** `docs/superpowers/specs/2026-10-21-bob-compass-design.md` (approved by Bob 2026-10-21). Its frames are in `docs/design/bob-compass/`, and the preview scripts it cites are in `tools/blender/`.

**Base:** branch `bob-m1` in worktree `.claude/worktrees/bob-m1`, from `needle-v3-m2` (ac0a067, 881 tests), with `redesign-bench`'s design commit merged in (Task 0).
- v3's plumbing is reused as it stands: SceneHost, Stage, Rig, Effects, the quality ladder, the state store, the loading readout, SafeStorage, AngleSpring, the input stack and the proof harness.
- Nothing is pushed or merged to `main` or `redesign-bench` without Bob's OK.

**Milestones after this one** each get their own plan, in this order:
1. M2: the scroll (iris, BOB from above, the dive) and the void with the beads.
2. M3: the project pages.
3. M4: the bead objects, after concept frames.
4. M5: the Lite and contact restyle.
5. Sound.

## Global Constraints

- NL is the default (`/`) and EN is at `/en/`. Copy is formal and first person. Never invent facts: use `[FILL: …]` until Bob supplies them.
- Every engraved mark is real: degree ticks and the eight trigrams in the Later Heaven order. No AI pseudo-characters anywhere.
- The B letters are geometric monoline outlines (a straight back, two bowls with the lower one larger, and the middle bar), 3.4 m tall and 2.1 m wide, drawn from geometry and never from a font glyph.
- Dark and calm: one focal point per moment, nothing clipped. The proof harness's `LUMA_GATE` is used as it stands:
  - home mean ≤ 0.11 and loader mean ≤ 0.07
  - at most 0.4 % of pixels at luma ≥ 0.98
  - the floor: mean > 0.002 and some pixel above 0.3

  It is only ever passed by tuning the look, never by moving the numbers.
- The loader is wordless; the header is hidden while it plays (it shows on `:focus-within`, Ruling 16).
- Every page stays prerendered with real DOM text, and the strict CSP stays as `tools/build/csp.mjs` has it.
- 60 fps on a mid-range laptop and at least 30 on a mid-range phone, on the existing quality ladder (`src/engine/quality.ts`).
- Every task leaves these green: `npm test`, `npm run typecheck`, `npm run build` and `npm run audit`, run from the worktree.
- Commits end with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A visitor who scrolls a trackpad to skip the loader.** The burst of wheel events keeps arriving for about a second. The page must land on the home with scroll progress 0, never part-way into the next chapter (Task 9 tests `skipSwallows`; Task 12's `loader-skip` step proves it in the browser).
2. **A load that finishes after the circle should have closed.** The circle must never draw backwards or jump. It crawls, then completes, and the rise follows (Task 3's hold tests: `strokes[4]` never decreases).
3. **A portrait phone.** The whole name fits across the width; the compass is smaller, never cropped (Task 4's portrait tests at 390 × 844).
4. **A returning visitor under reduced motion.** No camera flight: a 1 s fade straight onto the home (Task 3: reduced beats quick; Task 8's pose test: the camera is the home shot throughout).
5. **Storage blocked** (private window). The visitor counts as a first visit, and nothing throws (Task 3: `loaderSeen` over a throwing `SafeStorage`).

---

### Task 0: Branch and baseline

**Files:**
- Commit on `redesign-bench` (main checkout):
  - `docs/superpowers/specs/2026-10-21-bob-compass-design.md`
  - `docs/design/bob-compass/*.webp`
  - `tools/blender/*.py`
  - this plan
- Create the worktree `.claude/worktrees/bob-m1` on branch `bob-m1` from `needle-v3-m2`.

- [ ] **Step 1: Commit the design on `redesign-bench`** (main checkout; leave the unrelated `.impeccable/config.json` change unstaged)

```bash
git add docs/superpowers/specs/2026-10-21-bob-compass-design.md docs/design/bob-compass tools/blender docs/superpowers/plans/2026-10-21-bob-m1-loader-home.md
git commit -m "BOB: the approved design (compass as the O), its frames, the Blender preview scripts and the M1 plan"
```

- [ ] **Step 2: Create the worktree and merge the design in**

```bash
git worktree add .claude/worktrees/bob-m1 -b bob-m1 needle-v3-m2
cd .claude/worktrees/bob-m1 && git merge --no-edit redesign-bench && npm ci
```

Expected: the merge is clean (redesign-bench only added docs and `tools/blender/`).

- [ ] **Step 3: Baseline**

Run: `npm test && npm run typecheck && npm run build && npm run audit`
Expected: 881 tests pass, typecheck is clean, the build succeeds, and the auditor reports 0 issues. Record the count in the ledger.

---

### Task 1: The wordmark's geometry

**Files:**
- Create: `src/engine/bob/wordmark.ts`
- Test: `tests/unit/bob/wordmark.test.ts`

**Interfaces:**
- Produces:
  - `type Point2 = readonly [number, number]` (three `x`, `z`; the glass is y = 0)
  - `WORDMARK = { b: { height: 3.4, width: 2.1, midRatio: 0.53, leftX: -4.25, rightX: 2.15, nearZ: 1.7 }, hole: 1.585, circle: 1.66, outer: 1.88, ticks: { count: 144, inner: 1.69, long: 0.16, mid: 0.1, short: 0.055 }, engrave: 0.011 } as const`
  - `type StrokeId = 'leftB' | 'leftBar' | 'rightB' | 'rightBar' | 'circle'`
  - `STROKE_ORDER: readonly StrokeId[]`, in cutting order
  - `strokePath(id: StrokeId): readonly Point2[]` (a closed outline repeats its first point last)
  - `strokeLength(id: StrokeId): number`
  - `tickSegments(): readonly [Point2, Point2][]` (144 entries)
  - `circlePath(radius: number, segments?: number, start?: number): Point2[]`

- [ ] **Step 1: Write the failing tests**

```ts
describe('wordmark', () => {
  it('cuts the strokes in the preview order', () => {
    expect(STROKE_ORDER).toEqual(['leftB', 'leftBar', 'rightB', 'rightBar', 'circle']);
  });
  it('draws each B 2.1 wide and 3.4 deep on the glass, its back nearest the left', () => {
    for (const [id, x0] of [['leftB', -4.25], ['rightB', 2.15]] as const) {
      const xs = strokePath(id).map((p) => p[0]), zs = strokePath(id).map((p) => p[1]);
      expect(Math.min(...xs)).toBeCloseTo(x0, 6);
      expect(Math.max(...xs)).toBeCloseTo(x0 + 2.1, 3);
      expect(Math.max(...zs)).toBeCloseTo(1.7, 6);   // the foot, nearest the camera
      expect(Math.min(...zs)).toBeCloseTo(-1.7, 6);  // the top, away from it
    }
  });
  it('closes each outline and puts the bar at 53 % of the height from the foot', () => {
    const p = strokePath('leftB');
    expect(p[0]).toEqual(p[p.length - 1]);
    const bar = strokePath('leftBar');
    expect(bar[0][1]).toBeCloseTo(1.7 - 3.4 * 0.53, 6);
    expect(bar[0][0]).toBeCloseTo(-4.25, 6);
  });
  it('makes the lower bowl larger than the upper', () => {
    const mid = 3.4 * 0.53;
    expect(mid / 2).toBeGreaterThan((3.4 - mid) / 2);
  });
  it('starts the circle at 45 degrees and closes it', () => {
    const c = strokePath('circle');
    expect(c[0][0]).toBeCloseTo(1.66 * Math.cos(Math.PI / 4), 6);
    expect(c[0]).toEqual(c[c.length - 1]);
    expect(strokeLength('circle')).toBeCloseTo(2 * Math.PI * 1.66, 2);
  });
  it('rings the circle with 144 ticks, long every 12th and mid every 6th', () => {
    const t = tickSegments();
    expect(t).toHaveLength(144);
    const len = (s: readonly [Point2, Point2]) => Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]);
    expect(len(t[0])).toBeCloseTo(0.16, 6);
    expect(len(t[6])).toBeCloseTo(0.1, 6);
    expect(len(t[1])).toBeCloseTo(0.055, 6);
  });
  it('keeps the letters clear of the outer ring', () => {
    for (const id of ['leftB', 'rightB'] as const) for (const [x, z] of strokePath(id)) expect(Math.hypot(x, z)).toBeGreaterThan(1.88);
  });
});
```

- [ ] **Step 2: Run the tests to make sure they fail**

Run: `npx vitest run tests/unit/bob/wordmark.test.ts`
Expected: FAIL, the module cannot be resolved.

- [ ] **Step 3: Implement `src/engine/bob/wordmark.ts`**

Port `b_paths`, `circle_pts` and the tick loop from `tools/blender/bob_build.py`, mapping Blender `(x, y)` to three `(x, −y)`. The letter's local `v` runs from the foot (z = +1.7) to the top (z = −1.7). Arcs get 56 samples each and circles 240. Freeze the results and compute them once.

- [ ] **Step 4: Run the tests to make sure they pass**

Run: `npx vitest run tests/unit/bob/wordmark.test.ts`
Expected: PASS

- [ ] **Step 5: Commit** `git commit -m "bob: the wordmark's geometry (two B outlines, the circle, 144 ticks)"`

---

### Task 2: The trigrams and the band strip

**Files:**
- Create:
  - `src/engine/bob/trigrams.ts`
  - `src/engine/bob/paintBand.ts`
- Test: `tests/unit/bob/trigrams.test.ts`, `tests/unit/bob/paint-band.test.ts`

**Interfaces:**
- Produces:
  - `interface Trigram { name: string; char: string; lines: readonly [0 | 1, 0 | 1, 0 | 1] }`, lines from the bottom, 1 = solid (yang)
  - `LATER_HEAVEN: readonly Trigram[]`, starting at south and going clockwise:

    | Name | Char | Lines (bottom to top) |
    | --- | --- | --- |
    | Li | ☲ | 1,0,1 |
    | Kun | ☷ | 0,0,0 |
    | Dui | ☱ | 1,1,0 |
    | Qian | ☰ | 1,1,1 |
    | Kan | ☵ | 0,1,0 |
    | Gen | ☶ | 0,0,1 |
    | Zhen | ☳ | 1,0,0 |
    | Xun | ☴ | 0,1,1 |
  - `BAND_STRIP = { width: 4096, height: 96 } as const`
  - `interface StripContext { fillStyle: string; clearRect(x: number, y: number, w: number, h: number): void; fillRect(x: number, y: number, w: number, h: number): void }`
  - `paintBandStrip(ctx: StripContext, band: number): void`
    - Paints white marks on transparent, with u running around the band (0 → 1 = 0° → 360°) and v across it (0 = bottom edge, 1 = top edge).
    - Fine ticks every 2° in v 0.8–1.0; long ticks every 10° in v 0.62–1.0.
    - The eight trigrams centred at 22.5° + 45°·k, each 3° wide, with bars at v 0.18, 0.36 and 0.54, each 0.12 tall. A broken bar has a gap of 0.8°.
    - The trigram sequence starts at index `band % 8`, so the four bands do not line up.

- [ ] **Step 1: Write the failing tests**

```ts
it('lists the eight trigrams once each, Later Heaven order from the south', () => {
  expect(LATER_HEAVEN.map((t) => t.name)).toEqual(['Li', 'Kun', 'Dui', 'Qian', 'Kan', 'Gen', 'Zhen', 'Xun']);
  expect(new Set(LATER_HEAVEN.map((t) => t.lines.join(''))).size).toBe(8);
  expect(LATER_HEAVEN.find((t) => t.name === 'Qian')!.char).toBe('\u2630');
});
// paint-band.test.ts uses a recording StripContext (an array of fillRect calls)
it('paints 180 fine ticks, 36 long ticks and 8 trigrams of 3 bars', () => {
  const calls = record((ctx) => paintBandStrip(ctx, 0));
  expect(calls.filter(isFineTick)).toHaveLength(180 - 36);
  expect(calls.filter(isLongTick)).toHaveLength(36);
  expect(trigramBars(calls)).toHaveLength(8);
});
it('breaks a yin bar in two and leaves a yang bar whole', () => {
  const kun = barsAt(record((ctx) => paintBandStrip(ctx, 0)), 1); // index 1 = Kun, all yin
  expect(kun.every((bar) => bar.pieces === 2)).toBe(true);
});
it('starts band k at trigram k', () => {
  expect(firstTrigram(record((ctx) => paintBandStrip(ctx, 3)))).toBe('Qian');
});
```

The helpers `record`, `isFineTick`, `isLongTick`, `trigramBars`, `barsAt` and `firstTrigram` live in the test file and classify `fillRect` calls by their x and y against `BAND_STRIP`.

- [ ] **Step 2: Run the tests to make sure they fail** (`npx vitest run tests/unit/bob/trigrams.test.ts tests/unit/bob/paint-band.test.ts`): FAIL, module missing.
- [ ] **Step 3: Implement** `trigrams.ts` (data only) and `paintBand.ts`. Canvas y = (1 − v) · height. A long tick replaces the fine tick at the same angle.
- [ ] **Step 4: Run the tests to make sure they pass**: PASS.
- [ ] **Step 5: Commit** `git commit -m "bob: the eight trigrams (Later Heaven) and the band strip painter"`

---

### Task 3: The loader's timeline

**Files:**
- Create: `src/engine/bob/loaderTimeline.ts`
- Test: `tests/unit/bob/loader-timeline.test.ts`

**Interfaces:**
- Consumes: `SafeStorage` (`src/engine/core/SafeStorage.ts`).
- Produces:
  - `FPS = 24`.
  - `SCRIPT`: frames → seconds over FPS, as `{ start, end }` pairs. The values are the spec's §7 preview timings.

    | Span | Frames |
    | --- | --- |
    | `descend` | 1–18 |
    | `leftB` | 18–66 |
    | `leftBar` | 74–84 |
    | `rightB` | 96–144 |
    | `rightBar` | 152–162 |
    | `circle` | 174–222 |
    | `ticks` | 220–234 |
    | `outer` | 222–244 |
    | `probeOut` | 222–246 |
    | `iris` | 228–244 |
    | `glow` | 226–256 |
    | `rise` | 236–288 |
    | `camera` | 228–292 |
    | `settle` | 250–300 |
    | `home` | 300 |
  - `QUICK` (seconds): `glowIn` 0–0.8, `iris` 0.4–1.0, `glow` 0.4–1.2, `rise` 0.7–2.2, `camera` 0–2.4, `settle` 1.4–2.5, `home` 2.5.
  - `LOADER = { hold: 0.92, crawl: 0.06, crawlTau: 4, skip: 1.0, reducedFade: 1.0, giveUp: 25, maxStep: 0.1 } as const`
  - `LOADER_SEEN_KEY = 'bob-loader-seen'` (localStorage)
  - `type LoaderPath = 'full' | 'quick' | 'reduced'`
  - `interface LoaderInput { elapsed: number; loadedAt: number | null; skipAt: number | null; path: LoaderPath }`
  - `type LoaderStage = 'dark' | 'engrave' | 'open' | 'rise' | 'home'`
  - `interface LoaderClock`:
    - `stage: LoaderStage`
    - `script: number`: script seconds
    - `strokes: readonly [number, number, number, number, number]`, in `STROKE_ORDER`
    - `ticks, outer, iris, glow, rise, camera, settle, fade: number`, each 0..1
  - `loaderAt(input: LoaderInput): LoaderClock`
  - `advanceClock(elapsed: number, dt: number): number`, which clamps `dt` to 0..`maxStep` as v3's does
  - `loaderGaveUp(elapsed: number, loadedAt: number | null): boolean`
  - `loaderSeen(storage: SafeStorage): boolean`, `markLoaderSeen(storage: SafeStorage): void`
  - `pathFor(seen: boolean, reduced: boolean): LoaderPath`: reduced beats quick, and quick beats full

**Rules** (the spec's §2.1, Bob's pick A):
- **full path:**
  - The script time is `elapsed`. A fast load never shortens it.
  - **Waiting for the load:** while `loadedAt` is null (or later than the hold moment `H` = time of `circle` at `hold`), the script stops at `H`. The circle crawls: `hold + crawl·(1 − e^(−(elapsed − H)/crawlTau))`.
  - **After a late load at `L`:** the script resumes at `H + (elapsed − L)`. `strokes[4]` is the larger of the crawl reached at `L` and the scripted value, so it never goes backwards.
- **skip** (`skipAt` set and ≥ the moment the load is known):
  - The rest of the script is compressed linearly into `LOADER.skip` seconds of elapsed time.
  - A skip before the load fast-forwards to `H`, waits there, and runs the rest in `LOADER.skip` once loaded.
- **quick path:** `dark` until loaded, then the `QUICK` spans from `loadedAt`. The strokes, ticks and outer ring are all 1, and `fade` rises over `glowIn`.
- **reduced path:** `dark` until loaded, then a fade over `reducedFade` with every value at 1. The camera is at home throughout.
- **stages:**

  | Stage | Script time |
  | --- | --- |
  | `dark` | before `descend.end` (full), or before load (quick, reduced) |
  | `engrave` | until `circle.end` |
  | `open` | until `rise.start` |
  | `rise` | until `home` |
  | `home` | `home` onward |

- [ ] **Step 1: Write the failing tests**

```ts
const full = (elapsed: number, loadedAt: number | null = 0.1, skipAt: number | null = null) => loaderAt({ elapsed, loadedAt, skipAt, path: 'full' });
it('plays the preview: half the left B at 1.75 s, home at 12.5 s, even on a fast load', () => {
  expect(full(1.75).strokes[0]).toBeCloseTo(0.5, 6);
  expect(full(1.75).stage).toBe('engrave');
  expect(full(12.49).stage).toBe('rise');
  expect(full(12.5).stage).toBe('home');
});
it('holds the circle short of closing while the load is out, crawling, never back', () => {
  const H = (174 + 0.92 * 48) / 24;
  expect(full(H + 4, null).strokes[4]).toBeCloseTo(0.92 + 0.06 * (1 - Math.exp(-1)), 6);
  expect(full(H + 4, null).stage).toBe('engrave');
  let last = 0;
  for (let t = 0; t < 30; t += 0.05) { const s = full(t, 20).strokes[4]; expect(s).toBeGreaterThanOrEqual(last); last = s; }
  expect(full(20 + (12.5 - H), 20).stage).toBe('home');
});
it('fast-forwards the rest in 1 s on a skip once loaded', () => {
  expect(full(3.99, 0.1, 3).stage).not.toBe('home');
  expect(full(4.0, 0.1, 3).stage).toBe('home');
});
it('fast-forwards to the hold on a skip before the load, then finishes 1 s after it loads', () => {
  expect(full(6, null, 3).strokes[4]).toBeGreaterThanOrEqual(0.92);
  expect(full(10.99, 10, 3).stage).not.toBe('home');
  expect(full(11.0, 10, 3).stage).toBe('home');
});
it('plays the quick path in 2.5 s from the load, every mark already cut', () => {
  const q = (e: number) => loaderAt({ elapsed: e, loadedAt: 1, skipAt: null, path: 'quick' });
  expect(q(0.9).stage).toBe('dark');
  expect(q(1.0).strokes).toEqual([1, 1, 1, 1, 1]);
  expect(q(3.49).stage).not.toBe('home');
  expect(q(3.5).stage).toBe('home');
});
it('fades the reduced path in 1 s with the camera at home', () => {
  const r = (e: number) => loaderAt({ elapsed: e, loadedAt: 2, skipAt: null, path: 'reduced' });
  expect(r(2.5).camera).toBe(1);
  expect(r(2.5).fade).toBeCloseTo(0.5, 6);
  expect(r(3).stage).toBe('home');
});
it('gives up only on a load still out after 25 s', () => {
  expect(loaderGaveUp(24.9, null)).toBe(false);
  expect(loaderGaveUp(25, null)).toBe(true);
  expect(loaderGaveUp(99, 3)).toBe(false);
});
it('takes reduced over quick, quick over full', () => {
  expect(pathFor(true, true)).toBe('reduced');
  expect(pathFor(true, false)).toBe('quick');
  expect(pathFor(false, false)).toBe('full');
});
it('reads a throwing storage as a first visit', () => {
  const broken = new SafeStorage(() => { throw new Error('blocked'); });
  expect(loaderSeen(broken)).toBe(false);
  expect(() => markLoaderSeen(broken)).not.toThrow();
});
it('reads NaN and negative times as 0', () => {
  expect(full(Number.NaN).stage).toBe('dark');
  expect(advanceClock(1, -3)).toBe(1);
  expect(advanceClock(1, 5)).toBeCloseTo(1.1, 9);
});
```

- [ ] **Step 2: Run the tests to make sure they fail.** Run `npx vitest run tests/unit/bob/loader-timeline.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `loaderAt`.** Compute the script time per path and skip state, then read every span's progress with one `through(script, span)` (clamped to 0..1). `strokes[i]` is the progress of the i-th stroke span, except the circle's hold or crawl rule.
- [ ] **Step 4: Run the tests to make sure they pass**: PASS.
- [ ] **Step 5: Commit** `git commit -m "bob: the loader's timeline (full at preview pace, skip, hold, quick, reduced, give-up)"`

---

### Task 4: The probe's path and the camera shots

**Files:**
- Create:
  - `src/engine/bob/probePath.ts`
  - `src/engine/bob/shots.ts`
- Test: `tests/unit/bob/probe-path.test.ts`, `tests/unit/bob/shots.test.ts`

**Interfaces:**
- Consumes: `strokePath`, `STROKE_ORDER` (Task 1); `LoaderClock`, `SCRIPT` (Task 3).
- Produces:
  - `PROBE = { cutY: 0.012, lift: 0.35, startY: 6, outY: 7.5 } as const`
  - `interface ProbeState { x: number; y: number; z: number; cutting: boolean; shown: boolean }`
  - `probeAt(clock: LoaderClock): ProbeState`, a port of `probe_state` in `tools/blender/bob_animate.py`:
    - It descends over `descend` (ease-out) to the first stroke's start.
    - It cuts at `cutY` along the active stroke at that stroke's fraction.
    - Between strokes it travels with a lift of `lift·sin(πt)` (smoothstep in x and z).
    - It rises to `outY` over `probeOut` (ease-in).
    - `shown` is false from `probeOut.end`, and on the quick and reduced paths.
  - `type CameraShot` (moved from `src/engine/v3/shots.ts`, unchanged: `{ position, target, fov }`, where fov is vertical, in degrees)
  - `interface ShotFrame { distance: number; elevation: number; targetY: number; halfWidth: number }`
  - `FRAMES = { wide: { distance: 13.8, elevation: 14, targetY: 0.2, halfWidth: 5.2 }, home: { distance: 8.8, elevation: 13, targetY: 0.55, halfWidth: 3.2 }, homePortrait: { distance: 8.8, elevation: 13, targetY: 0.55, halfWidth: 5.0 } } as const`. A half-width is measured at the target's depth. The letters' near corners (z = 1.7) are closer, so the wide and portrait frames carry the margin that keeps them in (worked out against the tests below).
  - `MAX_VFOV = 50`
  - `shotFor(frame: ShotFrame, aspect: number): CameraShot`
    - The camera sits at `(0, targetY + d·sin e, d·cos e)` and looks at `(0, targetY, 0)`.
    - `vfov = 2·atan(halfWidth / (distance·aspect))` in degrees.
    - If that exceeds `MAX_VFOV`, the vfov is clamped to `MAX_VFOV` and the distance becomes `halfWidth / (aspect · tan(MAX_VFOV/2))`.
  - `homeShotFor(aspect)` is `shotFor(aspect < 1 ? FRAMES.homePortrait : FRAMES.home, aspect)`.
  - `wideShotFor(aspect)` is the same with `FRAMES.wide`.
  - `lerpCameraShot(a, b, t)` is moved from v3, unchanged.

- [ ] **Step 1: Write the failing tests**

```ts
// probe-path.test.ts
it('cuts the left B at its midpoint halfway through its span', () => {
  const p = probeAt(clockWith({ stage: 'engrave', strokes: [0.5, 0, 0, 0, 0] }, 1.75));
  expect(p.cutting).toBe(true);
  expect(p.y).toBeCloseTo(0.012, 6);
  expect([p.x, p.z]).toEqual(pointAlong(strokePath('leftB'), 0.5));
});
it('lifts 0.35 at the middle of a travel and cuts nothing', () => {
  const mid = (66 + 74) / 2 / 24;
  const p = probeAt(clockWith({ stage: 'engrave', strokes: [1, 0, 0, 0, 0] }, mid));
  expect(p.cutting).toBe(false);
  expect(p.y).toBeCloseTo(0.012 + 0.35, 3);
});
it('is gone once it has risen out', () => {
  expect(probeAt(clockWith({ stage: 'rise' }, 246 / 24)).shown).toBe(false);
});
// shots.test.ts
const project = (shot: CameraShot, aspect: number, p: [number, number, number]) => { /* build a THREE.PerspectiveCamera, return NDC */ };
it('puts the B centres at the screen edges on a laptop (half of each B off screen)', () => {
  for (const aspect of [16 / 9, 16 / 10]) {
    expect(project(homeShotFor(aspect), aspect, [-3.2, 0, 0])[0]).toBeCloseTo(-1, 1);
    expect(project(homeShotFor(aspect), aspect, [3.2, 0, 0])[0]).toBeCloseTo(1, 1);
  }
});
it('keeps the compass's top ring inside the frame, under the header's line', () => {
  // about 0.88 by hand (the preview's 65 px of 1080); the header sits above 0.9
  expect(project(homeShotFor(16 / 9), 16 / 9, [0, 0.55 + 1.56, 0])[1]).toBeLessThan(0.92);
});
it('fits the whole name across a portrait phone, the field held at 50 degrees', () => {
  const a = 390 / 844, shot = homeShotFor(a);
  expect(shot.fov).toBeLessThanOrEqual(50);
  for (const x of [-4.25, 4.25]) expect(Math.abs(project(shot, a, [x, 0, 1.7])[0])).toBeLessThanOrEqual(0.95);
});
it('frames the whole name with margin in the wide shot', () => {
  for (const x of [-4.25, 4.25]) expect(Math.abs(project(wideShotFor(16 / 9), 16 / 9, [x, 0, 1.7])[0])).toBeLessThan(0.95);
});
```

`clockWith(partial, script)` builds a `LoaderClock` with every field at 0 except the given ones. `pointAlong` is the test's own arc-length walk.

- [ ] **Step 2: Run the tests to make sure they fail**: FAIL.
- [ ] **Step 3: Implement** both modules. The probe's active stroke comes from `clock.script` against the `SCRIPT` spans, so the travel between strokes reads the same clock.
- [ ] **Step 4: Run the tests to make sure they pass**: PASS.
- [ ] **Step 5: Commit** `git commit -m "bob: the probe's path and the camera shots (half a B off screen; whole name on portrait)"`

---

### Task 5: The compass GLB from Blender

**Files:**
- Create:
  - `tools/blender/export_compass.py`
  - `public/models/bob-compass.glb`
  - `src/engine/bob/glb.ts`
- Test: `tests/unit/bob/compass-glb.test.ts`

**Interfaces:**
- Produces:
  - `public/models/bob-compass.glb`. Node names, exactly:
    - `armillary` (an empty, at the origin in the file)
    - `band_1` … `band_4` (children of `armillary`), each with `TEXCOORD_0`: u around the band 0..1 from local +X, and v across it 0 → 1 from bottom edge to top edge
    - `rim_1` … `rim_4` (children of their bands)
    - `needle` (long axis local +Y, tip up, at rest straight up)
    - `pivot`
    - `axis`
  - One animation, `rise`: 52 frames at 24 fps (2.167 s). Its channels:
    - `armillary` translation y from −3.25 to 0, an ease-out Bezier. The GLB's armillary rests at y 0, and code adds the home height 0.55.
    - `armillary` rotation about Y from −50° to 0°.
  - `interface GlbJson { nodes: { name?: string; mesh?: number; children?: number[] }[]; meshes: { primitives: { attributes: Record<string, number> }[] }[]; animations?: { name?: string; channels: { target: { node: number; path: string } }[] }[] }`
  - `readGlbJson(bytes: Uint8Array): GlbJson`. It checks the magic `0x46546c67`, version 2, and that the first chunk is `JSON`, and throws a `TypeError` naming what failed.
  - `COMPASS_GLB_BUDGET = 700_000` (bytes)

- [ ] **Step 1: Write the failing tests**

```ts
const bytes = new Uint8Array(readFileSync('public/models/bob-compass.glb'));
it('stays within its budget', () => expect(bytes.byteLength).toBeLessThanOrEqual(COMPASS_GLB_BUDGET));
it('holds the named parts', () => {
  const names = readGlbJson(bytes).nodes.map((n) => n.name);
  for (const n of ['armillary', 'band_1', 'band_2', 'band_3', 'band_4', 'rim_1', 'rim_4', 'needle', 'pivot', 'axis']) expect(names).toContain(n);
});
it('gives every band a UV channel', () => {
  const j = readGlbJson(bytes);
  for (const k of [1, 2, 3, 4]) {
    const node = j.nodes.find((n) => n.name === `band_${k}`)!;
    expect(j.meshes[node.mesh!].primitives[0].attributes.TEXCOORD_0).toBeTypeOf('number');
  }
});
it('carries the rise on the armillary, translation and rotation', () => {
  const j = readGlbJson(bytes), arm = j.nodes.findIndex((n) => n.name === 'armillary');
  const rise = j.animations!.find((a) => a.name === 'rise')!;
  expect(rise.channels.filter((c) => c.target.node === arm).map((c) => c.target.path).sort()).toEqual(['rotation', 'translation']);
});
it('rejects a file that is not a GLB', () => {
  expect(() => readGlbJson(new Uint8Array(12))).toThrow(TypeError);
});
```

- [ ] **Step 2: Run the tests to make sure they fail**: FAIL, no GLB and no module.
- [ ] **Step 3: Write `tools/blender/export_compass.py`.**
  - It works in a fresh scene and reuses `band_mesh`, `RINGS`, the rim curves, the needle, the pivot and the axis from `tools/blender/bob_build.py`, after the detail pass: bands 0.045 thick, a bevel of 0.007 in 3 segments, rims 0.016.
  - It adds a UV layer to the bands: u = i/seg, v = (z + h/2)/h on the outer and inner faces.
  - The needle stands at rest along +Z: Blender's +Z is three's +Y, and code sets its angle.
  - It names the objects as listed above.
  - It keys the `rise` action on `armillary` (frames 0–52), and exports through `bpy.ops.export_scene.gltf(filepath=..., export_format='GLB', export_yup=True, export_apply=True, export_animations=True, export_materials='NONE')`. Materials are applied in code.

  Run:

  ```bash
  "/c/Program Files (x86)/Steam/steamapps/common/Blender/blender.exe" -b --factory-startup --python tools/blender/export_compass.py -- public/models/bob-compass.glb
  ```

- [ ] **Step 4: Implement `readGlbJson`** in `src/engine/bob/glb.ts`, with `DataView` little-endian reads and `TextDecoder`.
- [ ] **Step 5: Run the tests to make sure they pass**: PASS. Record the GLB's size in the ledger.
- [ ] **Step 6: Commit** `git commit -m "bob: the compass GLB from Blender (bands with UVs, rims, needle, the rise)"`

---

### Task 6: Builders for the glass, the engraving and the traces

**Files:**
- Create:
  - `src/engine/bob/traces.ts`
  - `src/engine/bob/build/glassFloor.ts`
  - `src/engine/bob/build/engraving.ts`
  - `src/engine/bob/build/traces.ts`
- Test: `tests/unit/bob/traces.test.ts`, `tests/unit/bob/build-glass.test.ts`

**Interfaces:**
- Consumes: `WORDMARK`, `strokePath`, `tickSegments`, `circlePath`, `STROKE_ORDER` (Task 1); `palette` (`src/engine/palette.ts`); `QualityTier`.
- Produces:
  - `traceLayout(seed?: number): { traces: readonly Point2[][]; pads: readonly Point2[] }`
    - It is a port of the preview's walks: seed 2006, 70 traces, and directions in multiples of 45°.
    - Every point stays outside `outer + 0.25` and outside each letter's box grown by 0.25.
  - `GLASS_LOOK`:
    - `floor`: colour `palette.night`, roughness 0.08, clearcoat 1, clearcoat roughness 0.025
    - `scratch`: a 512 px canvas noise roughness map, 28° streaks
    - `reflection`: a `Reflector` at 0.5 resolution on the `high` tier only, under the floor at opacity 0.85
    - `well`: depth 1.12, emissive 1.1 at the foot falling as (1 − v)³
    - `lip`: radius `hole + 0.012`, tube 0.02
  - `interface GlassModel { group: THREE.Group; setIris(open: number): void; setGlow(level: number): void; dispose(): void }`. In it:
    - the floor: an annulus from `hole` to 60, at y 0, 0.08 thick
    - the cap: a disc that scales by 1 − open; hidden at 1
    - the well: an open cylinder from y −0.08 to −1.2, back side
    - the lip, and a warm point light at y −0.9 scaled by `setGlow`
  - `buildGlass(tier: QualityTier): GlassModel`
  - `interface EngravingModel { group: THREE.Group; setStroke(id: StrokeId, drawn: number): void; setTicks(grown: number): void; setOuter(drawn: number): void; setGlow(level: number): void; dispose(): void }`. In it:
    - each stroke is a `TubeGeometry` (radius `WORDMARK.engrave`, 6 radial segments, about 120 segments per metre), half sunk at y 0
    - `setStroke` sets `drawRange.count = revealCount(drawn, tubular, 6)`
    - the ticks are flat emissive quads whose fragment discards where `along > uGrown`
    - the outer ring is a 0.0055 tube revealed like a stroke
  - `revealCount(fraction: number, tubular: number, radial: number): number`, which is `floor(clamp01(fraction)·tubular)·radial·6`
  - `buildEngraving(): EngravingModel` (material: `MeshBasicMaterial` in `palette.amber` times glow, tone-mapped, fog-aware)
  - `interface TracesModel { group: THREE.Group; setLevel(level: number): void; dispose(): void }`
  - `buildTraces(layout: ReturnType<typeof traceLayout>): TracesModel` (`LineSegments`, dim gold at level 0.09)

- [ ] **Step 1: Write the failing tests**

```ts
// traces.test.ts
it('walks 70 traces at multiples of 45 degrees, the same every time', () => {
  const a = traceLayout(), b = traceLayout();
  expect(a.traces).toHaveLength(70);
  expect(a).toEqual(b);
  for (const t of a.traces) for (let i = 1; i < t.length; i++) {
    const ang = Math.atan2(t[i][1] - t[i - 1][1], t[i][0] - t[i - 1][0]) / (Math.PI / 4);
    expect(Math.abs(ang - Math.round(ang))).toBeLessThan(1e-9);
  }
});
it('keeps every trace clear of the letters and the circle', () => {
  for (const t of traceLayout().traces) for (const p of t) expect(clearOfWordmark(p, 0.25)).toBe(true);
});
// build-glass.test.ts
it('reveals a stroke by whole tube segments', () => {
  expect(revealCount(0, 400, 6)).toBe(0);
  expect(revealCount(0.5, 400, 6)).toBe(200 * 6 * 6);
  expect(revealCount(1.5, 400, 6)).toBe(400 * 6 * 6);
});
it('builds one tube per stroke and draws none at first', () => {
  const e = buildEngraving();
  for (const id of STROKE_ORDER) expect(meshNamed(e.group, `stroke:${id}`).geometry.drawRange.count).toBe(0);
  e.dispose();
});
it('closes the cap as the iris opens and hides it when open', () => {
  const g = buildGlass('low');
  g.setIris(0.5); expect(objectNamed(g.group, 'cap').scale.x).toBeCloseTo(0.5, 6);
  g.setIris(1); expect(objectNamed(g.group, 'cap').visible).toBe(false);
  g.dispose();
});
it('adds the reflector on the high tier only', () => {
  expect(hasNamed(buildGlass('high').group, 'floor:reflector')).toBe(true);
  expect(hasNamed(buildGlass('medium').group, 'floor:reflector')).toBe(false);
});
```

`clearOfWordmark` is exported from `src/engine/bob/traces.ts`. `meshNamed`, `objectNamed` and `hasNamed` are test helpers. If `Reflector` needs a WebGL renderer at build time, construct it lazily in `setRenderer(renderer)` and test for the placeholder node `floor:reflector`.

- [ ] **Step 2: Run the tests to make sure they fail**: FAIL.
- [ ] **Step 3: Implement the four modules.** Follow v3's builder shape: a group named for the part, `name` on each node the tests read, and `dispose` freeing every geometry, material and texture made.
- [ ] **Step 4: Run the tests to make sure they pass**: PASS.
- [ ] **Step 5: Commit** `git commit -m "bob: the glass floor, the opening and well, the engraving and the traces as three.js objects"`

---

### Task 7: Builders for the compass, the probe and the smoke

**Files:**
- Create:
  - `src/engine/bob/build/compass.ts`
  - `src/engine/bob/build/probe.ts`
  - `src/engine/bob/build/smoke.ts`
- Test: `tests/unit/bob/build-compass.test.ts`

**Interfaces:**
- Consumes: `GlbJson` (Task 5); `paintBandStrip`, `BAND_STRIP` (Task 2); `palette`; `QualityTier`. `buildProbe` ports `src/engine/v3/build/laser.ts`, and `buildSmoke` ports `src/engine/v3/build/mist.ts`.
- Produces:
  - `COMPASS_LOOK`:
    - `bandGlass`: `MeshPhysicalMaterial`, colour `palette.violet`, transmission 1 on `high` and 0.6 below it, roughness 0.04, ior 1.5, thickness 0.045, iridescence 0.35, emissive `palette.violet` at 0.06
    - `bandMarks`: emissive `palette.amber` at 1.6 through the painted strip as `emissiveMap`
    - `gold`: `MeshStandardMaterial`, colour `palette.brass`, metalness 1, roughness 0.22
    - `homeY: 0.55`
    - `spin`: band k turns at (0.25 + 0.1k)°/s on its own axis, alternating direction
  - `interface CompassModel { group: THREE.Group; setRise(t: number): void; setSpin(time: number): void; setNeedle(angle: number): void; setReveal(level: number): void; dispose(): void }`
    - `setRise(t)` samples the GLB's `rise` clip at `t·duration` through an `AnimationMixer`, then adds `homeY`.
    - `setNeedle(angle)` turns the needle about the camera's view axis (world Z): radians, 0 = up the screen, positive = clockwise as seen from the camera.
    - `setReveal` fades the whole compass in (opacity 0..1) for the quick and reduced paths.
  - `loadCompass(gltf: { scene: THREE.Object3D; animations: THREE.AnimationClip[] }, tier: QualityTier, strip: (band: number) => THREE.Texture): CompassModel`. It throws a `TypeError` naming any missing node.
  - `interface ProbeModel { group: THREE.Group; setTip(x: number, y: number, z: number): void; setOn(on: boolean): void; setSparks(intensity: number, time: number): void; dispose(): void }`. The probe is about 9 m tall, with a 0.018 radius, a 0.22 tapered tip and a point light at the tip on while it cuts. `LASER_LOOK`'s point, sparks and smoke are scaled ×4 for the metre world.
  - `buildProbe(): ProbeModel`
  - `interface SmokeModel { group: THREE.Group; setDensity(level: number): void; setTime(time: number): void; dispose(): void }`. Layered soft violet sprites over y 0–1.6, x ±15, z +8…−18, `palette.lilac` dimmed, with a drift period of about 60 s.
  - `buildSmoke(tier: QualityTier): SmokeModel`. The `low` tier gets half the layers.

- [ ] **Step 1: Write the failing tests** (on a scene graph made to look like the GLB: an `armillary` group with `band_1`…`band_4`, `rim_k`, `needle`, `pivot` and `axis` meshes, plus a hand-made `rise` clip)

```ts
it('names a missing part', () => {
  expect(() => loadCompass(fakeGltf({ omit: 'needle' }), 'high', stripStub)).toThrow(/needle/);
});
it('rises from the clip and rests at the home height', () => {
  const c = loadCompass(fakeGltf(), 'high', stripStub);
  c.setRise(0); expect(node(c, 'armillary').position.y).toBeCloseTo(-3.25 + 0.55, 3);
  c.setRise(1); expect(node(c, 'armillary').position.y).toBeCloseTo(0.55, 3);
});
it('turns the needle clockwise as the camera sees it', () => {
  const c = loadCompass(fakeGltf(), 'high', stripStub);
  c.setNeedle(Math.PI / 2);
  expect(tipDirection(c)).toEqual(expect.objectContaining({ x: expect.closeTo(1, 3), y: expect.closeTo(0, 3) }));
});
it('uses a cheaper glass below the high tier', () => {
  expect(bandMaterial(loadCompass(fakeGltf(), 'medium', stripStub)).transmission).toBe(0.6);
});
it('lights the probe only while it cuts', () => {
  const p = buildProbe(); p.setOn(false);
  expect(objectNamed(p.group, 'probe:light').visible).toBe(false);
  p.dispose();
});
```

- [ ] **Step 2: Run the tests to make sure they fail**: FAIL.
- [ ] **Step 3: Implement the three builders.** Each band gets its own `CanvasTexture` from `strip(k)`: in the browser a canvas painted by `paintBandStrip`, in tests a stub. Set `wrapS = RepeatWrapping`. The rims, the needle, the pivot and the axis share `COMPASS_LOOK.gold`.
- [ ] **Step 4: Run the tests to make sure they pass**: PASS.
- [ ] **Step 5: Commit** `git commit -m "bob: the compass from its GLB, the probe and the smoke"`

---

### Task 8: The opening's pose

**Files:**
- Create:
  - `src/scene/bob/openingPose.ts`
  - `src/engine/bob/needle.ts`
- Test: `tests/unit/bob/opening-pose.test.ts`

**Interfaces:**
- Consumes: `LoaderClock`, `LoaderPath` (Task 3); `probeAt`, `homeShotFor`, `wideShotFor`, `lerpCameraShot` (Task 4).
- Produces:
  - `interface OpeningPose { strokes: readonly number[]; ticks: number; outer: number; engraveGlow: number; traces: number; probe: ProbeState; iris: number; wellGlow: number; rise: number; reveal: number; needleSettle: number; smoke: number }`
  - `openingPoseAt(clock: LoaderClock, path: LoaderPath): OpeningPose`:
    - `traces` fades in to 0.09 over `descend`.
    - `smoke` rises 0 → 1 over the first 2.5 s.
    - `reveal` is 1 on the full path and `clock.fade` on the quick and reduced paths.
    - `needleSettle` is `clock.settle`.
  - `cameraShotAt(clock: LoaderClock, path: LoaderPath, aspect: number): CameraShot`:
    - full: the wide shot until `camera` starts, then `lerpCameraShot(wide, home, ease(clock.camera))`
    - quick: from 1.08 × the home distance to home over `camera`
    - reduced: the home shot throughout
  - `ease(t)` (moved from v3: smootherstep).
  - `LOAD_SHARES` and `loadShare(done: { paint: boolean; warm: boolean })`, moved unchanged from `src/scene/v3/openingPose.ts`, which Task 11 deletes.
  - `HOME_POSE: Readonly<OpeningPose>`: everything cut, open and risen.
  - In `src/engine/bob/needle.ts`, so both the pose and Task 10's aim import it without an engine-to-scene import:
    - `NEEDLE_REST = (38 * Math.PI) / 180`
    - `settleAngle(t: number): number`: `NEEDLE_REST + 1.92·e^(−4t)·cos(9t)` radians. This is the preview's swing of 110° in, damped.

- [ ] **Step 1: Write the failing tests**

```ts
it('frames the whole name until the push-in, then lands on the home shot', () => {
  expect(cameraShotAt(clockAt(5), 'full', 16 / 9)).toEqual(wideShotFor(16 / 9));
  expect(cameraShotAt(clockAt(12.5), 'full', 16 / 9)).toEqual(homeShotFor(16 / 9));
});
it('never flies the camera on the reduced path', () => {
  for (const t of [0, 0.5, 1]) expect(cameraShotAt(reducedClock(t), 'reduced', 16 / 9)).toEqual(homeShotFor(16 / 9));
});
it('settles the needle on its rest', () => {
  expect(settleAngle(1)).toBeCloseTo(NEEDLE_REST + 1.92 * Math.exp(-4) * Math.cos(9), 9);
  expect(Math.abs(settleAngle(1) - NEEDLE_REST)).toBeLessThan(0.04);
});
it('poses the home as every path lands on it', () => {
  expect(openingPoseAt(clockAt(12.5), 'full')).toEqual(HOME_POSE);
  expect(openingPoseAt(quickClock(2.5), 'quick')).toEqual(HOME_POSE);
});
```

The helpers are built from Task 3's `loaderAt`.

- [ ] **Step 2: Run the tests to make sure they fail**: FAIL.
- [ ] **Step 3: Implement.** The module is pure and imports nothing from React.
- [ ] **Step 4: Run the tests to make sure they pass**: PASS.
- [ ] **Step 5: Commit** `git commit -m "bob: the opening's pose and camera (wide to home, no flight when reduced)"`

---

### Task 9: The skip input

**Files:**
- Create: `src/input/loaderSkip.ts`
- Modify: `src/input/useHomeScroll.ts` (gate wheel, touch and keys through `skipSwallows`)
- Test: `tests/unit/input/loader-skip.test.ts`

**Interfaces:**
- Produces:
  - `SKIP_SWALLOW_MS = 400`
  - `SKIP_EVENTS = ['pointerdown', 'wheel', 'keydown', 'touchstart'] as const`
  - `skipSwallows(nowMs: number, skipEndsMs: number | null): boolean`: true while `skipEndsMs !== null && nowMs < skipEndsMs + SKIP_SWALLOW_MS`
  - `useLoaderSkip(active: boolean, onSkip: () => void): void`: while `active`, it listens on `window` for `SKIP_EVENTS` (passive: false for wheel and touch, which call `preventDefault`) and calls `onSkip` once
  - `frame.loaderSkipEndsMs: number | null`, a new field in `src/state/frame.ts` that the Opening writes and `useHomeScroll` reads

- [ ] **Step 1: Write the failing tests**

```ts
it('swallows input through the fast-forward and 400 ms after it', () => {
  expect(skipSwallows(1000, null)).toBe(false);
  expect(skipSwallows(1399, 1000)).toBe(true);
  expect(skipSwallows(1400, 1000)).toBe(false);
});
it('calls onSkip once however many events arrive', () => {
  const target = new EventTarget(); let n = 0;
  attachLoaderSkip(target, () => n++);
  for (const type of SKIP_EVENTS) target.dispatchEvent(new Event(type));
  expect(n).toBe(1);
});
```

`attachLoaderSkip(target, onSkip): () => void` is the testable core `useLoaderSkip` wraps.

- [ ] **Step 2: Run the tests to make sure they fail**: FAIL.
- [ ] **Step 3: Implement `loaderSkip.ts`, and gate `useHomeScroll`.** While `skipSwallows(performance.now(), frame.loaderSkipEndsMs)` holds, it drops input before the `VirtualScroll` sees it.
- [ ] **Step 4: Run the tests to make sure they pass**: PASS. Run `npm test`: the input tests still pass.
- [ ] **Step 5: Commit** `git commit -m "bob: any click, scroll or key skips the loader; the skip's input never scrolls"`

---

### Task 10: The Opening and the Home in the Stage

**Files:**
- Create:
  - `src/scene/bob/Opening.tsx`
  - `src/scene/bob/Home.tsx`
  - `src/scene/bob/look.ts`
  - `src/engine/bob/needleAim.ts`
- Modify:
  - `src/scene/Stage.tsx`: mount `bob/Opening` instead of `v3/Opening`
  - `src/state/frame.ts`: add `needleAngle` (Task 9 added `loaderSkipEndsMs`)
  - `src/debug/needleDebug.ts`, `src/debug/useNeedleDebug.ts`: report `needleAngle` and the strokes; `seekLoader(seconds)` holds the bob clock
  - `src/scene/Effects.tsx`: read the bloom from `bob/look.ts`
- Test: `tests/unit/bob/needle-aim.test.ts`, `tests/unit/scene/bob-opening.test.ts`

**Interfaces:**
- Consumes: everything above. From v3's plumbing: `readout` and `loadedShare` (`src/engine/loading.ts`), `motion`, `settleLoad`, `visibleTimeout`, `AngleSpring` and `NEEDLE_SPRING = { zeta: 0.55, omega: 3.2 }` (move it from `v3/aim.ts` to `needleAim.ts`), `SafeStorage.local()`, and `useScene().dispatch({ type: 'LOADED' })`.
- Produces:
  - `needleAngleFor(pointer: { x: number; y: number }, pivot: { x: number; y: number }): number`: screen pixels with y down; 0 when the pointer is straight above, π/2 straight right.
  - `driftAngle(t: number): number`: `NEEDLE_REST + 0.6·sin(2πt/14)`, for touch devices. `NEEDLE_REST` comes from `src/engine/bob/needle.ts` (Task 8).
  - `IDLE_SECONDS`, `BREATHE` and `breathAt(t)`, moved unchanged from `src/scene/v3/homePose.ts` into `src/scene/bob/look.ts`, since Task 11 deletes v3.
  - `LOOK`:
    - `background: palette.night`
    - `exposure`
    - `bloom: { threshold: 0.7, intensity: { high, medium }, radius }`
    - `fog`: violet, near 14, far 60
    - Tuned in Task 12's stills under the luminance gate.
  - **Opening's behaviour**, kept from v3's Opening (keep its comments' contracts):
    - It builds the glass, the engraving, the traces, the probe and the smoke at once (the loader's parts), and says `onReady`.
    - It loads the GLB (`/models/bob-compass.glb`, through drei's `useGLTF.preload` and three's `GLTFLoader`) as the home's part.
    - The load share is `loadShare({ paint, warm })` as in v3, with warm meaning the GLB has loaded and its programs have compiled.
    - Each frame it advances the clock, reads `loaderAt` and `openingPoseAt`, poses every builder, and writes `frame.shot = cameraShotAt(...)`.
    - It runs `useLoaderSkip(stage !== 'home', () => skipAt = elapsed)` and writes `frame.loaderSkipEndsMs` when the fast-forward will end.
    - At `home` it calls `markLoaderSeen(SafeStorage.local())`, dispatches `LOADED` and hands over to `Home`.
    - `loaderGaveUp` leads to `onFail(...)`, which ends in SceneHost's existing fallback card.
    - The quick and reduced paths come from `pathFor(loaderSeen(SafeStorage.local()), reducedMotion)`, read once at mount.
    - Ruling 9c stands: a mount after the phase has left `LOADING` goes straight to the home.
  - **Home:**
    - On a fine pointer, the needle follows `needleAngleFor(pointer, pivotOnScreen)` through an `AngleSpring(NEEDLE_SPRING)`. Without one it follows `driftAngle`.
    - Idle: `setSpin(time)`, the smoke's drift, and a breathing of ±0.05 on the engraving's glow over 4 s.
    - It sleeps after `IDLE_SECONDS` as v3's Home does.

- [ ] **Step 1: Write the failing tests**

```ts
it('points the needle at the pointer, clockwise from up', () => {
  expect(needleAngleFor({ x: 100, y: 0 }, { x: 100, y: 100 })).toBeCloseTo(0, 9);
  expect(needleAngleFor({ x: 200, y: 100 }, { x: 100, y: 100 })).toBeCloseTo(Math.PI / 2, 9);
  expect(needleAngleFor({ x: 0, y: 100 }, { x: 100, y: 100 })).toBeCloseTo(-Math.PI / 2, 9);
});
it('drifts around the rest within 0.6 rad', () => {
  for (let t = 0; t < 30; t += 0.5) expect(Math.abs(driftAngle(t) - NEEDLE_REST)).toBeLessThanOrEqual(0.6 + 1e-9);
});
```

`tests/unit/scene/bob-opening.test.ts` covers the pure wiring exported from `Opening.tsx`:
- `openingStartFor(phase, seen, reduced)` returns `{ skip, path }`.
- `skipAtFor(elapsed, current)` keeps the first skip.

- [ ] **Step 2: Run the tests to make sure they fail**: FAIL.
- [ ] **Step 3: Implement** `needleAim.ts`, `look.ts`, `Opening.tsx` and `Home.tsx`, and switch `Stage.tsx`. The v3 modules stay in the tree until Task 11.
- [ ] **Step 4: Run** `npm test`, `npm run typecheck` and `npm run build`. Expected: all pass. Then `npm run preview` and open `http://localhost:4399/?proof`: the loader plays and lands on the home. Save one screenshot for the ledger.
- [ ] **Step 5: Commit** `git commit -m "bob: the opening plays the BOB loader and lands on the compass; the needle follows the cursor"`

---

### Task 11: The header, the home's copy, and the countries removed

**Files:**
- Modify:
  - `src/ui/SiteHeader.tsx`: the name on every page, home included; Work → `/lite/#work`, About → `/lite/#about`, then Contact, `LangSwitch`, the Lite link and `ThreeDToggle`. Work points at Lite until M2's void exists.
  - `src/app/routes/home.tsx`: the hero's `h1` "Bob Chung" visually hidden; the tagline removed; the scroll cue kept.
  - `src/i18n/nl.ts`, `src/i18n/en.ts`:
    - `nav.work` is "Werk" / "Work" and `nav.about` is "Over mij" / "About".
    - The Lite about gets the Hakka line: EN "Hakka, a Chinese dialect, is my mother tongue." (Bob's approved line); NL "Hakka, een Chinees dialect, is mijn moedertaal." (to confirm in the milestone review).
    - The country strings are dropped.
  - `src/ui/lite/LiteAbout.tsx`: render the Hakka line.
  - `src/data/pages.ts`: drop `about-china`, `about-netherlands` and `about-aruba`.
  - `src/state/machine.ts`: drop `FOCUS_COUNTRY`, `COUNTRY_PAGE`, and the events `FOCUS_COUNTRY` and `OPEN_COUNTRY`.
  - `src/state/routeSync.ts`
  - `src/app/handle.ts`
- Delete:
  - `src/app/routes/country.tsx`
  - `src/data/directions.ts`
  - `src/debug/constellationAnchors.ts`
  - `src/engine/v3/`
  - `src/scene/v3/`
  - `src/engine/instrument/`, once nothing imports it
  - `tests/unit/v3/`
  - `tests/unit/directions.test.ts`
  - `tests/unit/debug/constellation-anchors.test.ts`
- Test: update `tests/unit/header-controls.test.ts`, `pages.test.ts`, `routes.test.ts`, `sitemap.test.ts`, `state/machine.test.ts` and `state/route-sync.test.ts`, as below.

- [ ] **Step 1: Write the failing test changes**

```ts
// header-controls.test.ts
it('lists Work, About, Contact, the language, Lite and 3D, in that order', () => {
  expect(headerLabels('en')).toEqual(['Work', 'About', 'Contact', 'NL', 'Lite', '3D']);
});
// pages.test.ts
it('has no country pages', () => {
  expect(Object.keys(PAGES)).not.toContain('about-china');
  expect(pagePaths()).toHaveLength(2 * 6);
});
// state/machine.test.ts
it('has no country phases', () => {
  expect(transition({ kind: 'HOME_IDLE' }, { type: 'BACK' })).toEqual({ kind: 'HOME_IDLE' });
});
```

`headerLabels` is the test's own render helper: the existing test file already renders the header.

- [ ] **Step 2: Run the changed tests to make sure they fail**: FAIL.
- [ ] **Step 3: Make the changes and delete the files.** Delete a module only once `grep -r` finds no importer.
- [ ] **Step 4: Run** `npm test`, `npm run typecheck`, `npm run build` and `npm run audit`. Expected: all pass, and the auditor reports 0 issues with 12 pages.
- [ ] **Step 5: Commit** `git commit -m "bob: the header (Work, About, Contact), the hero's text hidden, the countries and v3's scene removed"`

---

### Task 12: Proof harness, stills and Bob's review page

**Files:**
- Modify:
  - `tools/proof/needle.mjs`
  - `tools/proof/README.md`
- Create:
  - `.superpowers/brainstorm/<session>/content/bob-m1-review.html` (git-excluded; served by the brainstorm companion)

**Changes to the steps:**
- Remove `point`, and any constellation or country checks in `routes`, `bridge` and `stills`.
- `loader-stills`: hold the clock (`seekLoader`) at 1.75, 5.0, 8.25, 9.75, 11.0 and 12.5 s. Capture each at 1440 × 900 and 390 × 844.
- `loader-skip`:
  1. Click at 3 s: `HOME_IDLE` within 1.6 s.
  2. Reload with the seen flag cleared, then send 40 wheel events over 1 s from 3 s: home reached, and scroll progress stays 0.
- `quick-loader`: with `bob-loader-seen` set, home within 2.5 s of the load (plus 0.5 s margin).
- `loader-reduced`: under `prefers-reduced-motion`, the camera shot is identical across three samples.
- `give-up`: route `/models/bob-compass.glb` to never answer. The fallback card ("THE NEEDLE LOST NORTH") appears between 25 and 27 s.
- `aim`:
  1. Move the mouse to the right of the pivot: within 1.5 s, `needleAngle` is within 0.1 of π/2.
  2. On a touch emulation: `needleAngle` changes over 3 s.
- `home-look`: the luminance gate at both sizes, unchanged numbers.

- [ ] **Step 1: Make the step changes**, keeping the harness's patterns: `STEPS`, `PASS`/`FAIL` lines, `results.json`, and fail on console or CSP errors.
- [ ] **Step 2: Run** `npm run build`, then `npm run preview`, then `node tools/proof/needle.mjs`. Expected: every step passes, `errors: []` and `csp: []`.
- [ ] **Step 3: Tune the look only through `bob/look.ts`, `GLASS_LOOK`, `COMPASS_LOOK` and the smoke**, until:
  - the stills read like frames `01`–`04` and preview stills `p01`–`p05`, darker rather than brighter
  - the gate passes

  Record each change and its reason in the ledger.
- [ ] **Step 4: Write the review page.** Each still sits next to its frame (`docs/design/bob-compass/01`–`05`, `p01`–`p05`), at laptop and phone sizes, with the honest differences listed:
  - what is still rough
  - where the build differs from the frames
  - the NL Hakka line to confirm
  - Work pointing at Lite until M2
- [ ] **Step 5: Commit** `git commit -m "proof: the BOB loader's stills, skip, quick, reduced, give-up and aim; the dark look's gate"`

---

## Hand-off at the end of M1

Bob reviews the review page. Then:
1. He chooses merge, PR or keep (superpowers:finishing-a-development-branch). Nothing is pushed or merged without his OK.
2. M2's plan follows: the scroll and the void.
