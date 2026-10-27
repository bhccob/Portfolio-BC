# The light's path and the credits in the site: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, inline (Bob, 2026-10-26: "DO NOT use subagent"). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved light path mock-up into the site's home scroll, in place of the ring and the end sheet. After the last fact:
- the light leads on to each project in turn;
- it circles the bead and wakes its veins (3A);
- the camera goes into the bead, where the objects build with the scroll, and comes back out;
- after the last project the camera looks back over the whole way (8A);
- the scene fades to black, and the questions roll up as plain end credits to the message form.

**Architecture:**
- **The motion.** The mock-up's pose engine (`.superpowers/light-path-mockup/path.ts`, approved 2026-10-27) is the source of every motion number. It is ported to one pure module, `src/scene/bob/lightPath.ts`. Tests tie the port to the mock-up's own output, dumped to `tests/fixtures/light-path/` before anything in the site changes.
- **The journey.** `journeyPoseAt` stays the one pose of each frame. It is rebuilt on new chapters:
  - HOME 1;
  - LIGHT (the fall, way frames 1 to 256);
  - then, for each project, TRAVEL, ORBIT and INSIDE;
  - LOOK;
  - SHEET 1 (the fade to black and the credits rising);
  - END.
  The Opening, Home, the Void and the DOM layers apply the pose as they do today.
- **The credits.** They are the end page, restyled. It still slides in as the sheet and still rests in the page's flow, where the document scrolls natively. That is the roll.

**Tech Stack:** React Router 8 (prerendered NL at `/`, EN at `/en/`), React Three Fiber 9.8, three 0.186, zustand, Vitest, TypeScript, tsx, and Playwright-core with Edge (the proof harness `tools/proof/needle.mjs`).

**Spec:** `docs/superpowers/specs/2026-10-27-bob-light-path-design.md` (1a85a86), which builds on `2026-10-25-bob-light-dive-design.md`.
- **The approved mock-up:** `.superpowers/light-path-mockup/` in this worktree (git-ignored): `path.ts`, `Mock.tsx`, `main.tsx`, `mockup.css`, `review.html` and the two videos.
- **The approved credits:** `credits-simple.html` on the visual companion (`.superpowers/brainstorm/200-1793084968/content/` in the main checkout).

## Global Constraints

- **Bob's rules:**
  - no subagents: the work is done inline, and the final review is a self-review, said so to Bob;
  - nothing is merged or pushed without his OK;
  - the work stays on branch `bob-dive` (worktree `.claude/worktrees/bob-dive`);
  - never edit `.impeccable/config.json`;
  - never use port 4399. The site preview runs on 4421;
  - commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Everything binding on the light dive still binds** (spec, Constraints):
  - the strict CSP: no inline script or style, `worker-src 'none'`, no new source;
  - the luma gate on every still (mean ≤ 0.11, clipped ≤ 0.4 %);
  - NL as the default, and formal copy;
  - the Cookies Clicker classmate is never named;
  - the pace rules: past the rise the story follows the scroll, τ 0.45 s, floored at 12 way frames a second;
  - the scroll's one shot writer, and one pose per frame;
  - the canvas asleep when nothing moves: nothing in the path runs by a clock;
  - the beads' motion only where it is seen;
  - the harness passing in full, by real input, at 1440×900, 1366×657 and 390×844.
- **Up to the end of the fall, nothing changes:** the home, BOB from above, the way in, the facts and their side moves. The facts stay verbatim, in order, as the light dive's plan lists them.
- **The look:**
  - only gold and violet on the near-black;
  - no flash, burst or strobe, and no glow brighter than the bead;
  - nothing joining the light to a bead;
  - one bead lit and in focus at a time on the way (the look back is the one exception);
  - no needle among the projects: the light stays the light to the end.
- **The words:**
  - the questions, the answers and the facts are Bob's, word for word, in both languages;
  - the credits' heading is "Q&A" in both;
  - the skip button stays "Snel naar vragen ↓" / "Skip to questions ↓";
  - the name in the credits is `profile.name`, shown in capitals.
- **The credits' sizes at 1440×900:**
  - answers 19 px Montserrat, line-height 1.7;
  - questions 13 px Martian Mono, weight 600, letter-spacing 0.22em, gold capitals;
  - "Q&A" and the name 15 px Martian Mono, weight 600, letter-spacing 0.4em;
  - the column `min(580px, 100vw − 48px)`, centred text;
  - "Stuur een bericht." 34 px in the title face.

  At ≤ 600 px wide: answers 16 px, questions 12 px, the title 26 px.
- **Way 2:** at most five projects on the way (`PATH_LIMIT = 5`). The rest are small lights in the look back.

## Review Focus

1. **The last fact cut off at the hand-over.** Fact 05 is still at about 0.98 opacity at way frame 256, where the mock-up's path took over and dropped it. On the site it fades out as it does in the fall. Pinned in Task 5 (`fact 05 fades out across the hand-over`) and Task 14 (harness `light-facts`).
2. **A window resized, or a phone rotated, mid-path.** The beads' places depend on the aspect. The story keeps its place, the same bead stays in view, and the label and touch points stay on their anchors. Pinned in Task 4 (`a new aspect keeps the part, the bead and t`) and Task 14 (harness `resize` mid-orbit).
3. **Back from a project opened inside a bead or from the look back.** The visitor comes back to that same place, not to the bead's arrival. Pinned in Task 3 (`placeForProject`) and Task 14 (harness `bead-open`).
4. **The keyboard in the look back.** Tab reaches each bead's label in path order, then the skip button. Each label shows on focus, and Enter opens it. Pinned in Task 10 (`look back labels are focusable and shown on focus`) and Task 14 (harness `keyboard`).
5. **A project added to the data (Way 2).** With four or five projects the way takes them all and the look back frames every bead. With more than five, the flagged five are on the way and the rest are small lights. Pinned in Task 2 (`onPath`) and Task 4 (`the look back frames every bead`, for 4 and 5).

---

### Task 1: The mock-up's numbers, as fixtures

The mock-up's `path.ts` imports the site's journey and chapters. These change from Task 3 on, so it is dumped first, while it still runs.

**Files:**
- Create, untracked: `.superpowers/light-path-mockup/dump-fixtures.ts`
- Create: `tests/fixtures/light-path/path-desk.json`, `tests/fixtures/light-path/path-phone.json`

**Interfaces:**
- Produces each fixture file, of this shape:
  ```
  { aspect, centres: Vec3[], wayPoints: Vec3[],
    lookShot: { position, target, fov },
    samples: Sample[] }
  ```
- Each `Sample` is `{ q, part, index, t, shot, light, glow, trailLevel, beads, label, points, skip, way, black, fog, sky, band, dust, stream }`:
  - `q = p − 0.45`, the mock-up's place less its fall;
  - `index` is `segment.i`;
  - `way` is `trailLine`;
  - `beads` is `BeadView[]` with `index` (its place in `IDS`) in place of `id`;
  - `band` is `{ y, sigma, strength, distance }`.

- [ ] **Step 1: Write the dump script.**
  - It imports `makePath` from `./path`.
  - For desk (aspect 1440/900) and phone (aspect 390/844), it samples `at(p, 0)` at `p = 0.45 + 0.05 k`, k = 0..302.
  - It writes the JSON with full float precision.
- [ ] **Step 2: Run it from the worktree root.**
  - Command: `npx tsx .superpowers/light-path-mockup/dump-fixtures.ts`. tsx reads the root tsconfig's `~` paths.
  - Expected: two files of 303 samples each. The first sample is `part: 'travel', index: 0, t: 0`, and the last is `part: 'black', t: 1`.
- [ ] **Step 3: Commit the fixtures.** Message: `test: the light path mock-up's poses as fixtures, desk and phone, before the site changes`.

### Task 2: The projects on the way

**Files:**
- Modify: `src/data/projects.ts`
- Test: `tests/unit/projects.test.ts`

**Interfaces:**
- Produces:
  - `ProjectData.onPath?: boolean`;
  - `PATH_LIMIT = 5`;
  - `ProjectCatalog.onPath(): Project[]`, in `order`: all projects when there are `PATH_LIMIT` or fewer, else the flagged ones;
  - `ProjectCatalog.offPath(): Project[]`, the rest, in `order`.

- [ ] **Step 1: Write the failing tests.**

```ts
it('puts every project on the way while there are five or fewer', () => {
  expect(projects.onPath().map((p) => p.id)).toEqual(['funcial', 'jontai-energy', 'cookies-clicker']);
  expect(projects.offPath()).toEqual([]);
});
it('takes the flagged projects onto the way when there are more than five', () => {
  const seven = new ProjectCatalog(sevenStubs({ flagged: [1, 2, 4, 5, 7] }));
  expect(seven.onPath().map((p) => p.order)).toEqual([1, 2, 4, 5, 7]);
  expect(seven.offPath().map((p) => p.order)).toEqual([3, 6]);
});
it('refuses more than five flagged, or none, past five projects', () => {
  expect(() => new ProjectCatalog(sevenStubs({ flagged: [1, 2, 3, 4, 5, 6] })).onPath()).toThrow(/at most 5/);
  expect(() => new ProjectCatalog(sevenStubs({ flagged: [] })).onPath()).toThrow(/at most 5/);
});
```

  `sevenStubs` is a test helper: seven copies of Funcial's data with `order` 1–7 and `onPath` set where it is listed.
- [ ] **Step 2: Run them.**
  - Command: `npx vitest run tests/unit/projects.test.ts`.
  - Expected: FAIL, because `onPath` is not a function.
- [ ] **Step 3: Implement it.**
  - Add `onPath`, `offPath` and `PATH_LIMIT` as the Interfaces say.
  - Past the limit, throw `TypeError('past 5 projects the way takes the flagged ones: at most 5, at least 1')` when the flags break that rule.
- [ ] **Step 4: Run the tests.**
  - Command: `npx vitest run tests/unit/projects.test.ts`.
  - Expected: PASS.
- [ ] **Step 5: Commit.** Message: `data: the projects on the light's way: all of them up to five, else the five flagged`.

### Task 3: The chapters, the phases, the stops, the hold and the place to come back to

**Files:**
- Modify: `src/state/chapters.ts`, `src/state/machine.ts`, `src/state/routeSync.ts`, `src/scene/bob/landingHold.ts`, `src/ui/BeadLabel.tsx` (`openBead` notes the place)
- Test: `tests/unit/state/chapters.test.ts`, `tests/unit/state/machine.test.ts`, `tests/unit/state/route-sync.test.ts`

**Interfaces:**
- Consumes: `projects.onPath()` (Task 2).
- Produces:
  - `type ChapterId = 'HOME' | 'LIGHT' | 'TRAVEL' | 'ORBIT' | 'INSIDE' | 'LOOK' | 'SHEET' | 'END'`;
  - `ChapterUnit` gains `index: number | null`, the project's place on the way, set on TRAVEL, ORBIT and INSIDE;
  - `ChapterSpec = { path: readonly string[] }`, the on-path categories in order;
  - `HAND_F = 256`;
  - `UNITS_PER_FRAME = 3 / 299`;
  - `LIGHT_UNITS = UNITS_PER_FRAME * (HAND_F - 1)`, which is 765/299;
  - `PATH_LAYOUT = { travel: [1.25, 1.45, 1.55], orbit: 1.45, inside: 1.35, look: 1.9 }`. A travel past the third is 1.55;
  - `pathStart(c)`, `lookStart(c)`, `sheetStart(c)` and `scrollEnd(c)`;
  - `arrivalStop(c, category)`, the end of its ORBIT;
  - `insideStop(c, category)`, the end of its INSIDE;
  - `keyStops(c)`;
  - `placeOfFrame(f)`, as today;
  - `frameOfPlace(p) = 1 + (p − lightStart) / UNITS_PER_FRAME`;
  - `ringStart` and `projectStop` are deleted;
  - `LANDING_HOLD = pathStart(HOME_CHAPTERS)`;
  - `stopForProject(id)`: the arrival stop, or the look back's end (`sheetStart`) for a project not on the way;
  - `noteOpenedFrom(id, place)` and `placeForProject(id)`, in routeSync.

- [ ] **Step 1: Write the failing tests.**

```ts
const L = 1 + 765 / 299;
it('lays out the home: the rise, the fall, each project's travel, orbit and inside, the look back, the sheet, the end', () => {
  const c = buildChapters({ path: ['secure-element', 'front-panel', 'oscillator'] });
  const rows = c.units.map((u) => [u.id, u.index, u.category]);
  expect(rows).toEqual([['HOME', null, null], ['LIGHT', null, null],
    ['TRAVEL', 0, 'secure-element'], ['ORBIT', 0, 'secure-element'], ['INSIDE', 0, 'secure-element'],
    ['TRAVEL', 1, 'front-panel'], ['ORBIT', 1, 'front-panel'], ['INSIDE', 1, 'front-panel'],
    ['TRAVEL', 2, 'oscillator'], ['ORBIT', 2, 'oscillator'], ['INSIDE', 2, 'oscillator'],
    ['LOOK', null, null], ['SHEET', null, null], ['END', null, null]]);
  const starts = [0, 1, L, L + 1.25, L + 2.7, L + 4.05, L + 5.5, L + 6.95, L + 8.3, L + 9.85, L + 11.3, L + 12.65, L + 14.55, L + 15.55];
  c.units.forEach((u, k) => expect(u.start).toBeCloseTo(starts[k]!, 9));
  expect(pathStart(c)).toBeCloseTo(L, 9);
  expect(lookStart(c)).toBeCloseTo(L + 12.65, 9);
  expect(sheetStart(c)).toBeCloseTo(L + 14.55, 9);
  expect(scrollEnd(c)).toBeCloseTo(L + 15.55, 9);
  expect(placeOfFrame(HAND_F)).toBeCloseTo(L, 12);
  expect(frameOfPlace(placeOfFrame(121))).toBeCloseTo(121, 9);
});
it('steps keys through the top, each fact, each arrival, each inside, the look back and the end', () => {
  const expected = [0, 1, ...FACT_PEAKS.map(placeOfFrame), L + 2.7, L + 4.05, L + 6.95, L + 8.3, L + 11.3, L + 12.65, L + 14.55, L + 15.55];
  keyStops(HOME_CHAPTERS).forEach((s, k) => expect(s).toBeCloseTo(expected[k]!, 9));
  expect(arrivalStop(HOME_CHAPTERS, 'front-panel')).toBeCloseTo(L + 6.95, 9);
  expect(insideStop(HOME_CHAPTERS, 'front-panel')).toBeCloseTo(L + 8.3, 9);
});
it('gives a fourth and fifth travel the third's length', () => {
  const c = buildChapters({ path: ['a', 'b', 'c', 'd', 'e'] });
  expect(c.units.filter((u) => u.id === 'TRAVEL').map((u) => u.length)).toEqual([1.25, 1.45, 1.55, 1.55, 1.55]);
});
it('maps the path's chapters to the projects phase', () => {
  expect(transition({ kind: 'LIGHT' }, { type: 'CHAPTER', chapter: 'ORBIT', category: 'front-panel' })).toEqual({ kind: 'PROJECTS', category: 'front-panel' });
  expect(transition({ kind: 'PROJECTS', category: 'oscillator' }, { type: 'CHAPTER', chapter: 'LOOK', category: null })).toEqual({ kind: 'PROJECTS', category: null });
  expect(transition({ kind: 'PROJECTS', category: null }, { type: 'CHAPTER', chapter: 'SHEET', category: null })).toEqual({ kind: 'PROJECTS', category: null });
});
it('comes back to the place a bead was opened from, else to its arrival', () => {
  resetRouteSync();
  expect(placeForProject('jontai-energy')).toBeCloseTo(L + 6.95, 9);
  noteOpenedFrom('jontai-energy', L + 8.3);
  expect(placeForProject('jontai-energy')).toBeCloseTo(L + 8.3, 9);
  expect(placeForProject('funcial')).toBeCloseTo(L + 2.7, 9);
  noteOpenedFrom('funcial', L + 14.55);
  expect(placeForProject('jontai-energy')).toBeCloseTo(L + 6.95, 9);
});
```

  Also: in `route-sync.test.ts`, the existing Back case expects `placeForProject` where it expected `stopForProject`. The landing hold test expects `LANDING_HOLD` to be `pathStart(HOME_CHAPTERS)`.
- [ ] **Step 2: Run them.**
  - Command: `npx vitest run tests/unit/state`.
  - Expected: FAIL. The ids and exports are missing.
- [ ] **Step 3: Implement it.**
  - `buildChapters` lays out the units in the order of the first test: HOME 1, LIGHT `LIGHT_UNITS`, then per project TRAVEL, ORBIT and INSIDE, then LOOK, SHEET 1 and END 1.
  - `HOME_CHAPTERS` is built from `projects.onPath().map((p) => p.categoryId)`.
  - `machine.ts`:
    - TRAVEL, ORBIT and INSIDE map to `PROJECTS{category}`;
    - LOOK and SHEET map to `PROJECTS{category: null}`;
    - END maps to `END`.
  - `routeSync.ts`:
    - one module-level `opened: { id, place } | null`, cleared by `resetRouteSync`;
    - `syncRoute`'s Back puts the story at `placeForProject(project.id)`.
  - `openBead` (BeadLabel.tsx) calls `noteOpenedFrom(id, frame.progress)` before it dispatches `OPEN_PROJECT`.
- [ ] **Step 4: Run the tests and the typecheck.**
  - Command: `npx vitest run tests/unit/state tests/unit/projects.test.ts && npm run typecheck`.
  - Expected:
    - the state tests PASS;
    - the typecheck fails only in modules later tasks rewrite: journey.ts, focus.ts, voidPose.ts, scrollLoop.ts, target.ts, Void.tsx, Opening.tsx and SkipButton.tsx. List them in the commit message.
- [ ] **Step 5: Commit.** Message: `state: the home's chapters for the light's path: the fall to frame 256, travel, orbit and inside per project, the look back, the sheet; key stops at each arrival and inside; Back to the place a bead was opened from`.

### Task 4: The path's motion, ported from the mock-up

**Files:**
- Create: `src/scene/bob/lightPath.ts`
- Test: `tests/unit/scene/bob-light-path.test.ts`; add `src/scene/bob/lightPath.ts` to the pure modules of `tests/unit/scene/banned-imports.test.ts` (no three, no React)

**Interfaces:**
- Consumes:
  - from Task 3: `HOME_CHAPTERS`, `pathStart`, `frameOfPlace` and `HAND_F`;
  - from `./lightDive`: `lightAt`, `wayShot`, `factAt`, `filamentsAt`, `voidAt`, `streamAt`, `trailLevel` and `sizeFor`;
  - `shotToward`, which moves from journey.ts to `src/engine/bob/shots.ts` so this module does not import the journey. journey.ts re-exports it.
- Produces:

```ts
export type PathPart = 'travel' | 'orbit' | 'inside' | 'look' | 'sheet';
export type Wake = { kind: 'none' } | { kind: 'orbit'; from: number; now: number } | { kind: 'full' };
export interface BeadView { index: number; centre: Vec3; facing: Vec3; visible: boolean; lit: number; fade: number; build: number; wake: Wake }
export interface PathFrame {
  part: PathPart; index: number; t: number; shot: CameraShot; light: LightPose; fact: FactAt | null; void: VoidPose;
  beads: BeadView[]; label: { index: number; opacity: number } | null; points: { index: number; opacity: number } | null;
  skip: boolean; way: number; black: number; fog: { near: number; far: number }; sky: boolean;
}
export interface Path { count: number; centres: readonly Vec3[]; wayPoints: readonly Vec3[]; lookShot: CameraShot;
  orbitAt(index: number, angle: number): Vec3; frameAt(q: number): PathFrame }
export function makePath(aspect: number, c?: Chapters): Path;   // q = progress − pathStart(c)
export function pathFor(aspect: number): Path;                   // HOME_CHAPTERS, kept for the last aspect asked
export function wakeSweep(toView: (angle: number) => readonly [number, number], centre: readonly [number, number], from: number, now: number):
  { start: number; span: number; dir: 1 | -1 };
export function ease(x: number): number;                         // the mock-up's cubic in-out, 0..1
export function lookingBack(frame: PathFrame): boolean;          // part 'look', or 'sheet' at t 0: the look back's own stop
```

  The look back's own stop is SHEET's start, which the chapters read as SHEET at local 0. Everything that belongs to the look back (the skip button, its labels, its picking, `restsAt`) asks `lookingBack`.

  `LightPose` and `VoidPose` move from journey.ts to this module's neighbour, `src/scene/bob/poseTypes.ts` (types only), which journey.ts re-exports.

- [ ] **Step 1: Write the failing tests.**

```ts
for (const size of ['desk', 'phone'] as const) {
  const fx = load(`path-${size}`);
  const path = makePath(fx.aspect);
  it(`matches the mock-up's ${size} path at every sample`, () => {
    path.centres.forEach((c, i) => expectVec(c, fx.centres[i], 9));
    for (const s of fx.samples) {
      const f = path.frameAt(s.q);
      expect([f.part, f.index]).toEqual([s.part === 'black' ? 'sheet' : s.part, s.index]);
      expect(f.t).toBeCloseTo(s.t, 9);
      expectShot(f.shot, s.shot, 9);
      expectVec(f.light.position, s.light, 9);
      expect(f.light.glow).toBeCloseTo(s.glow, 9);
      expect(f.beads.map(strip)).toEqual(s.beads.map(strip)); // strip rounds every number to 9 places
      expect([f.label, f.points]).toEqual([s.label && { index: s.label.i, opacity: s.label.opacity }, s.points && { index: s.points.i, opacity: s.points.opacity }]);
      expect(f.skip).toBe(s.skip || lookBackStop(s)); // the one deliberate change: the skip shows at the look back's own stop
      expect([f.way, f.black, f.fog.near, f.fog.far].map(close9)).toEqual([s.way, s.black, s.fog.near, s.fog.far].map(close9));
      expect(f.sky).toBe(s.sky);
      expect([f.void.bandY, f.void.bandSigma, f.void.band, f.void.bandDistance, f.void.dust, f.void.stream].map(close9)).toEqual([s.band.y, s.band.sigma, s.band.strength, s.band.distance, s.dust, s.stream].map(close9));
    }
  });
}
it('sweeps the wake the way the light goes round, in the view', () => {
  const round = (a: number) => [Math.cos(a), Math.sin(a)] as const;
  expect(wakeSweep(round, [0, 0], 0, Math.PI)).toEqual({ start: 0, span: closeTo(Math.PI), dir: 1 });
  expect(wakeSweep((a) => round(-a), [0, 0], 0, 2.5 * Math.PI)).toMatchObject({ span: closeTo(2.5 * Math.PI), dir: -1 });
});
it('a new aspect keeps the part, the bead and t', () => {
  for (const q of [0.4, 2.0, 5.1, 9.9, 13.0]) {
    const a = makePath(1440 / 900).frameAt(q), b = makePath(900 / 1440).frameAt(q);
    expect([b.part, b.index, b.t, b.beads.map((x) => x.visible)]).toEqual([a.part, a.index, a.t, a.beads.map((x) => x.visible)]);
  }
});
it('the look back frames every bead, with four and five projects', () => {
  for (const n of [4, 5]) for (const aspect of [1440 / 900, 390 / 844]) {
    const path = makePath(aspect, buildChapters({ path: Array.from({ length: n }, (_, k) => `c${k}`) }));
    for (const c of path.centres) {
      const v = project(c, path.lookShot, aspect); // NDC, as the light dive's test projects
      expect(Math.abs(v.x)).toBeLessThanOrEqual(0.85);
      expect(Math.abs(v.y)).toBeLessThanOrEqual(0.85);
      expect(v.z).toBeLessThan(1);
    }
  }
});
it('runs by the scroll alone: the same place is the same frame', () => {
  expect(makePath(1.6).frameAt(3.3)).toEqual(makePath(1.6).frameAt(3.3));
});
```

- [ ] **Step 2: Run them.**
  - Command: `npx vitest run tests/unit/scene/bob-light-path.test.ts`.
  - Expected: FAIL: no module.
- [ ] **Step 3: Implement it.** Port `path.ts`, keeping its names and numbers, with these changes:
  - **The segments come from the chapters.** They are the TRAVEL, ORBIT, INSIDE and LOOK units of `c`, then SHEET, on the axis `q = start − pathStart(c)`. Its `black` segment is the SHEET's first 0.55: `black = ease(seg(q − sheetQ, 0, 0.55))`, which is 1 from there on.
  - **The fall before the path.** It exists only for the trail's look back. `lightPos(q < 0)` is `lightAt(frameOfPlace(pathStart + q))`, at the site's own fall pace.
  - **The bead offsets.** `OFFSETS[i ≥ 3] = OFFSETS[i % 2 === 1 ? 1 : 2]`.
  - **The look back's aim.** Its `mid` is the mean of all centres.
  - **The look back past three projects.** For n > 3 the camera stands back along `position − target` by the least factor (from 1, in steps of 0.05) that puts every centre within 0.85 of the frame.
  - **No clock.** The light's glow is the hand-over's ×(1 − black), as the mock-up has it, with no breath. The filaments are `filamentsAt(70 + |((16 q) mod 360) − 180|)`, so they crawl only as the scroll moves.
  - **The skip's end is inclusive.** It shows from ORBIT 0's start while `lookingBack` or earlier, so it stands at the look back's own stop (q 14.55), where the mock-up's half-open test hid it. `lookBackStop(s)` in the test is `s.part === 'black' && s.t === 0`.
  - **`fact`.** It is null here. The journey adds the fall's fade-out (Task 5).
  - **The void.** It is `voidAt(HAND_F)` with its band ×(1 − 0.35·look), `ringMist` 0 and the stream `streamAt(HAND_F)`.
  - **`wakeSweep`.** It is the mock-up's 64-step unwrapped sweep (`Mock.tsx`, the wake block), taking a projector so it stays pure.
- [ ] **Step 4: Run the tests.**
  - Command: `npx vitest run tests/unit/scene/bob-light-path.test.ts tests/unit/scene/banned-imports.test.ts`.
  - Expected: PASS.
- [ ] **Step 5: Commit.** Message: `scene: the light's path through the projects, ported from the approved mock-up and tied to its poses`.

### Task 5: The journey on the new chapters

**Files:**
- Modify: `src/scene/bob/journey.ts`, `src/scene/bob/focus.ts`, `src/scene/bob/voidPose.ts`, `src/state/frame.ts`, `src/scene/bob/Opening.tsx` (`placeForProject`)
- Test: `tests/unit/scene/bob-journey.test.ts`, `tests/unit/scene/bob-focus.test.ts`, `tests/unit/scene/bob-void.test.ts`

**Interfaces:**
- Consumes: `pathFor` and the types from Task 4; `placeForProject` from Task 3.
- Produces:

```ts
export type Stretch = 'rise' | 'light' | 'travel' | 'orbit' | 'inside' | 'look' | 'sheet' | 'end';
export interface JourneyAt { stretch: Stretch; local: number; frame: number | null; project: number | null } // project: the way's index on travel/orbit/inside
export interface JourneyPose { at: JourneyAt; rise: ScrollPose; shot: CameraShot; ignite: number; light: LightPose | null;
  fact: FactAt | null; needle: NeedleOverride | null; void: VoidPose | null; path: PathFrame | null; sheet: number }
export function focusShotFor(id: ProjectId, aspect: number): CameraShot; // centre + TOWARD·(0.95 + 1.6)·back, 40 mm
export function restsAt(id: ProjectId | null, progress: number, target: number): boolean; // in focus.ts
export function selectedBead(at: JourneyAt): number | null;            // in voidPose.ts: orbit and inside
```

  - `BEADS`, `PROJECT_NEAR` and `angle` are deleted.
  - `frame.journey` loses `angle` and `ring`, and gains `beads: { x: number; y: number; r: number; visible: boolean }[] | null`, `label: { index: number; opacity: number } | null` and `wake: number[]`.
  - `lightDive.ts` stays as the previs's port, unchanged. Its ring exports stay with their tests, and the journey no longer imports them.

- [ ] **Step 1: Write the failing tests.**

```ts
const L = pathStart(HOME_CHAPTERS);
it('reads the stretches off the chapters', () => {
  expect(journeyAt(L - 1e-3)).toMatchObject({ stretch: 'light', project: null });
  expect(journeyAt(L)).toMatchObject({ stretch: 'travel', local: 0, project: 0, frame: null });
  expect(journeyAt(L + 2.7)).toMatchObject({ stretch: 'inside', local: 0, project: 0 });
  expect(journeyAt(L + 12.65)).toMatchObject({ stretch: 'look', project: null });
  expect(journeyAt(L + 15.55)).toMatchObject({ stretch: 'end' });
});
it('keeps the fall as it was, up to the hand-over', () => {
  for (const f of [2, 60, 121, 241, 255]) expect(journeyPoseAt(placeOfFrame(f), 1.6).shot).toEqual(wayShot(f, 1.6));
});
it('poses the path from the hand-over on', () => {
  for (const q of [0, 1.0, 2.7, 6.0, 13.5]) {
    const pose = journeyPoseAt(L + q, 1.6), frame = pathFor(1.6).frameAt(q);
    expect([pose.shot, pose.light, pose.path, pose.void]).toEqual([frame.shot, frame.light, frame, frame.void]);
    expect(pose.needle).toBeNull();
  }
});
it('fact 05 fades out across the hand-over', () => {
  const at = (p: number) => journeyPoseAt(p, 1.6).fact?.opacity ?? 0;
  expect(at(L)).toBeCloseTo(factAt(HAND_F).opacity, 9);
  expect(at(placeOfFrame(260) + 1e-6)).toBe(0);
  for (let p = L - 0.02; p < L + 0.06; p += 0.001) expect(Math.abs(at(p + 0.001) - at(p))).toBeLessThan(0.1);
});
it('fades to black and raises the sheet over SHEET', () => {
  const s = sheetStart(HOME_CHAPTERS);
  expect(journeyPoseAt(s + 0.5, 1.6).sheet).toBeCloseTo(0.5, 9);
  expect(journeyPoseAt(s + 0.5, 1.6).path!.black).toBeCloseTo(ease(0.5 / 0.55), 9);
});
it('flies back only from a rest where the bead is in view', () => {
  expect(restsAt('jontai-energy', L + 6.95, L + 6.95)).toBe(true);   // its arrival
  expect(restsAt('jontai-energy', L + 8.3 - 1e-3, L + 8.3 - 1e-3)).toBe(true); // its inside
  expect(restsAt('jontai-energy', L + 14.55, L + 14.55)).toBe(true);  // the look back's own stop (SHEET at local 0)
  expect(restsAt('jontai-energy', L + 2.7, L + 2.7)).toBe(false);     // Funcial's arrival
  expect(restsAt('jontai-energy', L + 6.95, L + 7)).toBe(false);      // moving
});
it('selects the bead of an orbit or inside, nowhere else', () => {
  // INSIDE 0, ORBIT 1, TRAVEL 0, LOOK
  expect([L + 3, L + 6.0, L + 1.0, L + 13].map((p) => selectedBead(journeyAt(p)))).toEqual([0, 1, null, null]);
});
```

- [ ] **Step 2: Run them.**
  - Command: `npx vitest run tests/unit/scene/bob-journey.test.ts tests/unit/scene/bob-focus.test.ts tests/unit/scene/bob-void.test.ts`.
  - Expected: FAIL.
- [ ] **Step 3: Implement it.**
  - **`journeyPoseAt`:**
    - the rise as today;
    - LIGHT as today, from frame 1 to `HAND_F`;
    - from `pathStart` on, `pathFor(aspect).frameAt(progress − pathStart)`, with `shot`, `light` and `void` taken from it, `ignite` 1 and `needle` null;
    - `sheet` is `progress − sheetStart` over SHEET, and 1 at END.
  - **The fact across the hand-over.** In TRAVEL 0, while `frameOfPlace(progress) ≤ 260`, `fact` is `factAt(frameOfPlace(progress))`. The fact runs on at the fall's own pace until it is out.
  - **`focusShotFor`** stands on the path's `TOWARD` from the bead's centre at this aspect (`pathFor(aspect).centres`).
  - **`restsAt`** is true when the story rests (`progress === target`) on the bead's orbit, its inside, or the look back (`lookingBack`).
  - **The beads that are not on the way** have no close view of their own here. Their page stands over the look back's end: `placeForProject` already says so.
  - **`writeJourney`** writes the new fields.
  - **Delete the ring's helpers** from voidPose.ts: `inRing`, `ringStill`, `labelFor`, the bead clocks and `ABACUS_SPAN`.
  - **Opening.tsx** poses a close view's backdrop at `placeForProject(close)`.
- [ ] **Step 4: Run the scene and state tests.**
  - Command: `npx vitest run tests/unit/scene tests/unit/state`.
  - Expected: PASS.
- [ ] **Step 5: Commit.** Message: `scene: the journey on the light's path: the fall to the hand-over, the path's pose after it, fact 05 fading out across it, the flight back from any rest with the bead in view`.

### Task 6: The scroll on the path

**Files:**
- Modify: `src/input/scrollLoop.ts`, `src/input/target.ts`, `src/input/VirtualScroll.ts`, `src/input/useHomeScroll.ts`
- Test: `tests/unit/input/scroll-loop.test.ts`, `tests/unit/input/target.test.ts`, `tests/unit/input/virtual-scroll.test.ts`

**Interfaces:**
- Consumes: the chapters' exports from Task 3.
- Produces:
  - the same `startHomeScroll` and `HomeScroll`, without the drag;
  - `ringStart` is replaced by `pathStart` wherever "past the light dive" is meant;
  - the sheet's finish runs between `sheetStart`, which is the look back's end, and `scrollEnd`.

- [ ] **Step 1: Update and add the tests.**
  - Every existing case that names the ring (`grep -n "ring\|RING\|drag" tests/unit/input`) keeps its assertion with the path's stops in place of the ring's.
  - The drag's own cases are deleted.
  - Add:

```ts
it('steps a key from an arrival to its inside, and on to the next arrival', () => {
  expect(keyTarget(L + 2.7, 1, HOME_CHAPTERS)).toBeCloseTo(L + 4.05, 9);
  expect(keyTarget(L + 4.05, 1, HOME_CHAPTERS)).toBeCloseTo(L + 6.95, 9);
  expect(keyTarget(L + 12.65, 1, HOME_CHAPTERS)).toBeCloseTo(L + 14.55, 9);
});
it('finishes the sheet back onto the look back when the scroll stops part-way up going up', () => {
  expect(finishTarget(L + 14.8, -1, HOME_CHAPTERS)).toBeCloseTo(L + 14.55, 9);
  expect(finishTarget(L + 14.8, 1, HOME_CHAPTERS)).toBeCloseTo(L + 15.55, 9);
});
it('glides a key move that starts or ends past the light dive', () => { /* the existing glide case, from L + 2.7 to L + 4.05 */ });
it('holds the target at the hand-over while the beads load', () => { /* the existing hold case, with LANDING_HOLD === L */ });
```

- [ ] **Step 2: Run them.**
  - Command: `npx vitest run tests/unit/input`.
  - Expected: FAIL in the new cases.
- [ ] **Step 3: Implement it.**
  - Replace the ring's names with the path's.
  - Delete the ring's drag: the `dragging` option, VirtualScroll's `'drag'` input, and the `by === 'drag'` branch of `startHomeScroll`.
  - Nothing else in the loop changes: the follow, the glide, the sheet's finish, the hold and the end page's own scroll.
- [ ] **Step 4: Run the tests and the typecheck.**
  - Command: `npx vitest run tests/unit/input && npm run typecheck`.
  - Expected:
    - the tests PASS;
    - the typecheck fails only in Void.tsx, SkipButton.tsx and BeadLabel.tsx, which Tasks 9–11 rewrite.
- [ ] **Step 5: Commit.** Message: `input: the scroll on the light's path: keys step arrivals and insides, the sheet finishes onto the look back, the ring's drag gone`.

### Task 7: The beads: fading, the veins waking, the insides building

**Files:**
- Create: `src/engine/bob/beadBuild.ts`
- Modify: `src/engine/bob/build/beads.ts`
- Test: `tests/unit/bob/bead-build.test.ts`, `tests/unit/bob/build-beads.test.ts`

**Interfaces:**
- Produces:

```ts
// beadBuild.ts (pure)
export interface BuildPose { time: number; slide?: number; abacus?: number; apart?: number; screen: number }
export function buildPose(id: ProjectId, b: number): BuildPose;
// BeadsModel gains
setFade(id: ProjectId, fade: number): void;     // its light uniform × fade, its inner light × fade, its parts hidden at 0
setWake(id: ProjectId, wake: { centre: readonly [number, number]; start: number; span: number; dir: 1 | -1; hot: number }): void;
setBuild(id: ProjectId, b: number): void;       // buildPose applied: setMotion, the abacus's scale, the wheels apart, the screens
export const WAKE = { rest: 0.12, lit: 1.4, hot: 2.6 } as const;
```

- [ ] **Step 1: Write the failing tests.**

```ts
it('builds Funcial: the abacus rises, its beads slide, the screen lights', () => {
  expect(buildPose('funcial', 0)).toEqual({ time: 0, slide: 0, abacus: 0.02, screen: 0 });
  expect(buildPose('funcial', 0.5)).toMatchObject({ time: 1.5, slide: closeTo(2.3 * 0.14 / 0.6), abacus: 1, screen: 1 });
  expect(buildPose('funcial', 1)).toEqual({ time: 3, slide: 2.3, abacus: 1, screen: 1 });
});
it('builds Jontai Energy: the cells light one by one', () => {
  expect(buildPose('jontai-energy', 0.5)).toMatchObject({ time: closeTo(4.6 * 0.38 / 0.88), screen: 1 });
});
it('builds Cookies Clicker: the wheels meet, then the train ticks', () => {
  expect(buildPose('cookies-clicker', 0)).toMatchObject({ time: 0, apart: 1 });
  expect(buildPose('cookies-clicker', 0.5)).toMatchObject({ time: closeTo(7 * 0.02 / 0.52), apart: 0 });
});
// build-beads.test.ts, on the loaded fixture GLB as the file's other cases load it
it('dresses the shell with the wake and writes it', () => {
  const body = model.beads.funcial.body.material as THREE.MeshStandardMaterial;
  expect(body.customProgramCacheKey()).toBe('bob-bead:shell');
  const shader = compileFake(body); // the file's helper: runs onBeforeCompile on ShaderLib.physical's sources
  expect(shader.fragmentShader).toContain('uWakeA');
  expect(shader.vertexShader).toContain('vWakeView = mvPosition.xyz;');
  model.setWake('funcial', { centre: [1, 2], start: 0.5, span: 3, dir: -1, hot: 2.6 });
  expect(shader.uniforms.uWakeA.value.toArray()).toEqual([1, 2, 0.5, 3]);
  expect(shader.uniforms.uWakeB.value.toArray()).toEqual([0.12, 1.4, 2.6, -1]);
});
it('fades a bead into the dark and hides it at nothing', () => {
  model.setLit('funcial', 1); model.setFade('funcial', 0.5);
  expect(lightUniform(model, 'funcial')).toBeCloseTo(0.5 * litLevel, 9);
  model.setFade('funcial', 0);
  expect(drawnParts(model.beads.funcial.root).every((p) => !p.visible)).toBe(true);
});
it('builds the abacus from its scale at rest', () => {
  model.setBuild('funcial', 0);
  expect(abacus(model).scale.y).toBeCloseTo(0.02 * restScaleY, 9);
});
```

- [ ] **Step 2: Run them.**
  - Command: `npx vitest run tests/unit/bob/bead-build.test.ts tests/unit/bob/build-beads.test.ts`.
  - Expected: FAIL.
- [ ] **Step 3: Implement it.**
  - **`buildPose`.** `smooth` is the clamped smoothstep, and `seg(x, a, b)` is the clamped `(x − a)/(b − a)`.
    - funcial: time `3b`, slide `2.3·seg(b, .36, .96)`, abacus `max(.02, smooth(b/.42))`;
    - jontai-energy: time `4.6·seg(b, .12, 1)`;
    - cookies-clicker: time `7·seg(b, .48, 1)`, apart `1 − smooth(seg(b, 0, .5))`;
    - every bead: screen `smooth(seg(b, .04, .4))`.
  - **The body's dress.** It becomes `'shell'`: the surface dress, plus the mock-up's `WAKE_VERTEX` and `WAKE_FRAGMENT` (Mock.tsx, verbatim) after `#include <emissivemap_fragment>`. Use `swap` so a three upgrade that moves the anchor fails loudly.
  - **`light(b)`** multiplies in `b.fade`.
  - **Each Cookies wheel's apart vector:**
    - start from its rest position minus the wheels' mean, with z set to 0;
    - normalise it and scale it to 0.16;
    - add z `0.1 + 0.04·(k mod 3)`;
    - a wheel at the mean gets `(±1, 0.3, 0)`.
- [ ] **Step 4: Run the tests.**
  - Command: `npx vitest run tests/unit/bob`.
  - Expected: PASS.
- [ ] **Step 5: Commit.** Message: `beads: a bead fades into the dark, its veins wake where the light has passed, and its object builds with the scroll`.

### Task 8: The look back's way line, and the lights of projects off the way

**Files:**
- Create: `src/engine/bob/build/wayLine.ts`, `src/scene/bob/offPath.ts` (pure)
- Test: `tests/unit/bob/build-way-line.test.ts`, `tests/unit/scene/bob-off-path.test.ts`

**Interfaces:**
- Produces:

```ts
export function buildWayLine(points: readonly Vec3[]): { mesh: THREE.Mesh; setLevel(level: number): void; dispose(): void };
export function offPathPlaces(wayPoints: readonly Vec3[], count: number): Vec3[];
export function buildOffPathLights(places: readonly Vec3[]): { points: THREE.Points; setLevel(level: number): void; dispose(): void };
```

- [ ] **Step 1: Write the failing tests.**

```ts
it('draws the way as a gold line out of nothing, brightest at its end', () => {
  const line = buildWayLine(straight(40));
  const colour = line.mesh.geometry.getAttribute('color');
  expect(colour.getX(0)).toBe(0);
  expect(colourAt(line, 700)).toEqual(goldLight);
  line.setLevel(0); expect(line.mesh.visible).toBe(false);
  line.setLevel(1); expect((line.mesh.material as THREE.MeshBasicMaterial).opacity).toBeCloseTo(0.85, 9);
});
it('places the lights off the way at even steps beside it', () => {
  const way = straight(40); // 0..39 m along -z
  const places = offPathPlaces(way, 3);
  expect(places).toHaveLength(3);
  expect(places.map((p) => -p[2])).toEqual([9.75, 19.5, 29.25].map(closeTo));
  expect(places.map((p) => Math.abs(p[0]))).toEqual([0.9, 0.9, 0.9].map(closeTo));
  expect(Math.sign(places[0]![0])).toBe(-Math.sign(places[1]![0]));
});
```

- [ ] **Step 2: Run them.**
  - Command: `npx vitest run tests/unit/bob/build-way-line.test.ts tests/unit/scene/bob-off-path.test.ts`.
  - Expected: FAIL.
- [ ] **Step 3: Implement it.**
  - **The way line:**
    - the mock-up's tube: CatmullRom, 700 segments, radius 0.022, 6 sides;
    - vertex colours `palette.goldLight × min(1, k/126)·(0.3 + 0.7(k/700)^1.3)`;
    - additive, `depthWrite` false, `fog` false;
    - `setLevel(l)` sets `visible = l > 0` and the opacity to `0.85·l`.
  - **`offPathPlaces`:** arc length along the polyline at `(k + 1)/(count + 1)`, offset 0.9 m along `tangent × +y`, alternating sides.
  - **`buildOffPathLights`:** `THREE.Points`, size 0.12 with attenuation, `palette.goldLight`, additive, opacity `0.9·level`.
- [ ] **Step 4: Run the tests.**
  - Command: as Step 2.
  - Expected: PASS.
- [ ] **Step 5: Commit.** Message: `scene: the look back's line of the whole way, and small lights beside it for projects off the way`.

### Task 9: The void on the path

**Files:**
- Modify: `src/scene/bob/Void.tsx`, `src/scene/bob/voidPose.ts`
- Test: `tests/unit/scene/bob-void.test.ts`

**Interfaces:**
- Consumes:
  - `JourneyPose.path` (Task 5);
  - `setFade`, `setWake`, `setBuild` and `WAKE` (Task 7);
  - `buildWayLine`, `offPathPlaces` and `buildOffPathLights` (Task 8);
  - `wakeSweep` and `pathFor` (Task 4).
- Produces:
  - `wakeFor(bead: BeadView, path: Path, view: (p: Vec3) => readonly [number, number]): { centre; start; span; dir; hot }`. It returns:
    - for `full`, span 10 and hot 0;
    - for `none`, span 0 and hot 0;
    - for `orbit`, the sweep, with hot `WAKE.hot`.
  - `pickAt(pose, pointer)`, which says which bead or off-path light a click opens:
    - in an orbit or inside, the selected bead under the pointer;
    - in the look back, the bead or light under the pointer (a light within 18 px of it);
    - else null.

- [ ] **Step 1: Write the failing tests.**

```ts
it('wakes a bead fully, not at all, or by the light's sweep', () => {
  const path = pathFor(1.6), frame = path.frameAt(2.0), bead0 = frame.beads[0]!;
  const view = viewFrom(frame.shot, 1.6); // a PerspectiveCamera through applyCameraShot; a world point to its view-space x, y
  expect(wakeFor({ ...bead0, wake: { kind: 'full' } }, path, view)).toMatchObject({ span: 10, hot: 0 });
  expect(wakeFor({ ...bead0, wake: { kind: 'none' } }, path, view)).toMatchObject({ span: 0, hot: 0 });
  const quarter = wakeFor({ ...bead0, wake: { kind: 'orbit', from: -Math.PI / 2, now: 0 } }, path, view);
  expect(quarter.hot).toBe(2.6);
  expect(quarter.span).toBeGreaterThan(0.5); // from behind the bead to its right, seen a little from above
  expect(quarter.span).toBeLessThan(Math.PI);
});
it('shows the void all along the path', () => {
  expect(voidShownAt(journeyPoseAt(pathStart(HOME_CHAPTERS) + 5, 1.6))).toBe(true);
});
```

- [ ] **Step 2: Run them.**
  - Command: `npx vitest run tests/unit/scene/bob-void.test.ts`.
  - Expected: FAIL.
- [ ] **Step 3: Implement it.** Void's frame, from `pose.path` while it is there:
  - **The beads:**
    - `place` at the path's centres;
    - `setFacing` toward each view's `facing`;
    - `setLit`;
    - `setFade(visible ? fade : 0)`;
    - `setWake(wakeFor(...))`, in the camera's view space;
    - `setBuild` only for the bead whose `build` is between 0 and 1 and which is visible, so motion runs only where it is seen.
  - **The fog:**
    - from `path.fog` onto `scene.fog`'s near and far;
    - Studio's `LOOK.fog` back whenever there is no path.
  - **The sky:** `setSky(path.sky && under the sky)`.
  - **The way line:**
    - built from `path.wayPoints`;
    - rebuilt when `pathFor`'s object changes (a new aspect);
    - level `path.way × (1 − path.black)`.
  - **The off-path lights:**
    - built from `offPathPlaces(path.wayPoints, projects.offPath().length)`;
    - shown with the way line's level.
  - **The light** `setPose(pose.light)`. Its glow already carries the black (Task 4).
  - **The hover:**
    - only in an orbit, an inside or the look back (`pickAt`);
    - in the look back the hovered bead's label shows (Task 10).
  - **A click** opens what `pickAt` gives.
  - **The labels, the touch points and the skip button** are wired in Tasks 10 and 11. Until then Void shows none of them.
  - **Delete** the ring view, the clocks and `motion.beads`. The canvas wakes only for the hover's ease.
- [ ] **Step 4: Run the tests, then look at it.**
  - Commands: `npx vitest run tests/unit/scene` and `npm run typecheck`, then `npm run build` and `PORT=4421 npm run preview` (in the background).
  - Expected:
    - the tests PASS;
    - the typecheck fails only in the modules Tasks 10 and 11 rewrite (BeadLabel.tsx, SkipButton.tsx);
    - in the browser pane at 1440×900, scrolled to Funcial's arrival stop, the frame matches the mock-up's still at the same place: the bead's veins awake on its left, the light at rest on its right.
- [ ] **Step 5: Commit.** Message: `scene: the void on the light's path: beads fading in and out, veins waking, insides building, the fog and the look back's way line`.

### Task 10: The labels: the bead's beside the light, the look back's on hover and focus, the touch points

**Files:**
- Modify: `src/ui/BeadLabel.tsx`, `src/styles/base.css`
- Create: `src/scene/bob/touchPoints.ts` (pure), `src/ui/TouchPoints.tsx`; render `<TouchPoints />` beside `<BeadLabels />` in the home route
- Test: `tests/unit/ui/bead-label.test.ts`, `tests/unit/ui/touch-points.test.ts`

**Interfaces:**
- Consumes: `path.label` and `path.points` (Task 5).
- Produces:

```ts
export interface PathLabelView { id: ProjectId; anchor: { x: number; y: number }; side: 'right' | 'below'; opacity: number; quiet: boolean }
export function pathLabelPlace(view: PathLabelView, box: { w: number; h: number }, size: { width: number; height: number }): { x: number; y: number };
export function showBeadLabels(views: readonly PathLabelView[], size: { width: number; height: number }): void;
export function labelFocusable(view: PathLabelView): boolean;          // quiet, or opacity ≥ 0.5
export type TouchAnchor = { node: string } | { corner: 'tl' | 'tr' | 'bl' | 'br' };
export const TOUCH_POINTS: Readonly<Record<ProjectId, readonly { anchor: TouchAnchor; place: 'left' | 'right' | 'above' | 'below' | 'below2' }[]>>;
export function touchBox(at: { x: number; y: number }, place: 'left' | 'right' | 'above' | 'below' | 'below2', el: { w: number; h: number }, width: number): { x: number; y: number };
export function showTouchPoints(view: { id: ProjectId; opacity: number; at: readonly { x: number; y: number }[] } | null): void;
```

- [ ] **Step 1: Write the failing tests.**

```ts
it('stands the label right of the light on a laptop, under the bead on a phone, inside the screen', () => {
  expect(pathLabelPlace({ id: 'funcial', anchor: { x: 900, y: 450 }, side: 'right', opacity: 1, quiet: false }, { w: 300, h: 96 }, { width: 1440, height: 900 })).toEqual({ x: 934, y: 402 });
  expect(pathLabelPlace({ id: 'funcial', anchor: { x: 195, y: 600 }, side: 'below', opacity: 1, quiet: false }, { w: 260, h: 88 }, { width: 390, height: 844 })).toEqual({ x: 65, y: 600 });
  expect(pathLabelPlace({ id: 'funcial', anchor: { x: 1300, y: 450 }, side: 'right', opacity: 1, quiet: false }, { w: 300, h: 96 }, { width: 1440, height: 900 }).x).toBe(1124);
});
it('look back labels are focusable and shown on focus; a fading label is not', () => {
  expect(labelFocusable({ ...view, quiet: true, opacity: 0 })).toBe(true);
  expect(labelFocusable({ ...view, quiet: false, opacity: 0.3 })).toBe(false);
  expect(labelFocusable({ ...view, quiet: false, opacity: 0.9 })).toBe(true);
});
it('names a touch point for every test point of each project', () => {
  for (const p of projects.all()) expect(TOUCH_POINTS[p.id]).toHaveLength(p.testPoints.length);
});
it('places a touch point by its side, inside the screen', () => {
  expect(touchBox({ x: 500, y: 300 }, 'below2', { w: 80, h: 16 }, 1440)).toEqual({ x: 460, y: 340 });
  expect(touchBox({ x: 500, y: 300 }, 'left', { w: 80, h: 16 }, 1440)).toEqual({ x: 408, y: 292 });
  expect(touchBox({ x: 5, y: 300 }, 'below', { w: 80, h: 16 }, 1440).x).toBe(10);
});
```

- [ ] **Step 2: Run them.**
  - Command: `npx vitest run tests/unit/ui/bead-label.test.ts tests/unit/ui/touch-points.test.ts`.
  - Expected: FAIL.
- [ ] **Step 3: Implement it.**
  - **`pathLabelPlace`:**
    - `right`: `x = anchor.x + 34`, with y centred on the anchor;
    - `below`: x centred, `y = anchor.y`;
    - x is held to `[16, width − 16 − w]`.
  - **What Void hands it:**
    - at an arrival on a laptop, the light's px as the anchor;
    - on a phone, the bead's centre px plus `radius_px·1.25 + 18`;
    - in the look back, one quiet view per bead, anchored at its centre plus `radius_px + 18` (right) or under it (phone).
  - **The skip button.** It still never covers a label: keep `skipPlace` on the shown label's box.
  - **CSS.** A quiet label shows at opacity 1 on `:focus-visible` and on hover. Void writes `data-hover` for the picked bead, since the canvas takes the pointer. Its `tabindex` comes from `labelFocusable`.
  - **`TOUCH_POINTS`.** The mock-up's anchors, verbatim:
    - funcial: `funcial_pin_1..4` (below, below2, below, below2) and `funcial_bead_5` (above);
    - jontai-energy: `tl` left, `bl` left, `tr` right, `br` right;
    - cookies-clicker: `cookies_balance` above, `cookies_wheel_4` below, `cookies_wheel_8` below2, `bl` below, `tr` right.
  - **`touchBox`:**
    - left: `[x − w − 12, y − h/2]`;
    - right: `[x + 12, y − h/2]`;
    - above: `[x − w/2, y − h − 16]`;
    - below: `[x − w/2, y + 16]`;
    - below2: `[x − w/2, y + 40]`;
    - x is held to `[10, width − w − 10]`.
  - **A corner's anchor.** Void takes it from the display's box on the screen: its 8 corners projected, then the box's left or right x, and its top y + 14 or its bottom y − 14.
  - **`showBeadLabels`** replaces `showBeadLabel` and `labelPlacement`. The look back's views are the ones where `lookingBack(path)`.
  - **`TouchPoints.tsx`** renders each project's test point labels (`project.testPointLabels(locale)`) in an `aria-hidden` layer. They are the project pages' words, already in the HTML there.
  - **The style.** It follows the mock-up's `.point`: a 5 px gold dot and Martian Mono at 11 px, letter-spacing 0.2em.
- [ ] **Step 4: Run the tests and the typecheck.**
  - Command: `npx vitest run tests/unit/ui && npm run typecheck`.
  - Expected: the tests PASS, and the typecheck fails only in SkipButton.tsx.
- [ ] **Step 5: Commit.** Message: `ui: the bead's label beside the light, the look back's labels on hover and focus, and the touch points on the parts they name`.

### Task 11: The skip button on the path

**Files:**
- Modify: `src/ui/SkipButton.tsx`, `src/scene/bob/Void.tsx`, `src/styles/base.css`
- Test: `tests/unit/ui/skip-button.test.ts`

**Interfaces:**
- Produces:
  - `showsSkip(pose: Pick<JourneyPose, 'path'>): boolean`, which is `pose.path?.skip === true`. That is from the first orbit's start through the look back's end;
  - `SKIP_ATTRIBUTE = 'data-skip'` and `writeSkip(root, shown, written)`, in place of `data-ring` and `writeRing`.

- [ ] **Step 1: Write the failing tests.**

```ts
it('shows from the first arrival through the look back, nowhere else', () => {
  const at = (p: number) => showsSkip(journeyPoseAt(p, 1.6));
  // TRAVEL 0, ORBIT 0's start, INSIDE 1, the look back's own stop, part-way up the sheet, the credits
  expect([L + 1.0, L + 1.25, L + 7, L + 14.55, L + 14.6, L + 15.55].map(at)).toEqual([false, true, true, true, false, false]);
});
it('writes data-skip', () => { /* the old writeRing case, renamed */ });
```

- [ ] **Step 2: Run them.**
  - Command: `npx vitest run tests/unit/ui/skip-button.test.ts`.
  - Expected: FAIL.
- [ ] **Step 3: Implement it.**
  - Void writes `data-skip` from `showsSkip(pose)`, on the home page and not during a focus flight.
  - The CSS selector moves to `data-skip`.
  - The press is unchanged: `goToEnd`, then `focusEndOnArrival` focuses `#end-title`, which Task 12 puts on "Q&A".
- [ ] **Step 4: Run the tests and the typecheck.**
  - Command: `npx vitest run tests/unit/ui && npm run typecheck`.
  - Expected: PASS, and the typecheck is clean.
- [ ] **Step 5: Commit.** Message: `ui: the skip button from the first arrival through the look back`.

### Task 12: The credits

**Files:**
- Modify: `src/ui/EndPage.tsx`, `src/scene/bob/endView.ts`, `src/scene/bob/Home.tsx`, `src/styles/base.css`, `src/i18n/nl.ts`, `src/i18n/en.ts` (and their type)
- Test: `tests/unit/ui/end-page.test.ts`, `tests/unit/scene/bob-end-view.test.ts`, `tests/unit/qa.test.ts`

**Interfaces:**
- Produces:
  - `EndView = { share; black; rise; state }`:
    - `black = ease(seg(share, 0, 0.55))`;
    - `rise = seg(share, 0.55, 1)`;
  - `applyEndView` writes `--end-black` and `--end-rise`, each unset at 0. `--end` goes;
  - `t.end.head` is `'Q&A'` in both languages;
  - `t.end.label`, `t.end.title` and `t.end.intro` are removed where `grep -rn "end\.\(label\|title\|intro\)" src` finds no other use;
  - `#end-title` is the "Q&A" heading.

- [ ] **Step 1: Write the failing tests.**

```ts
it('is the credits: Q&A, six questions with their answers, the name, the message part', () => {
  const html = renderToString(<EndPage />); // NL, as the file's other cases render it
  const doc = parse(html);
  expect(doc.querySelector('#end-title')!.textContent).toBe('Q&A');
  expect([...doc.querySelectorAll('.end-q')].map((q) => q.textContent)).toEqual(nl.end.questions.map((q) => q.question));
  expect([...doc.querySelectorAll('.end-a')].map((a) => a.textContent)).toEqual(nl.end.questions.map((q) => q.answer ?? `${nl.end.placeholder} ${nl.end.placeholderTag}`));
  expect(doc.querySelector('.end-name')!.textContent).toBe(profile.name);
  expect(doc.querySelectorAll('details, summary, .end-intro, .page-title')).toHaveLength(0);
  // The form itself waits for hydration without the deploy's key, as on /contact/: the title and the links are prerendered.
  expect(doc.querySelector('.end-final > h2')!.textContent).toBe('Stuur een bericht.');
  expect(doc.querySelector('.end-final .links')).not.toBeNull();
  expect(html).not.toContain(nl.contact.intro);
});
it('fades to black over the sheet's first 0.55, then raises the credits', () => {
  expect(endViewFor(0.3, 1, 1, 2)).toMatchObject({ black: closeTo(ease(0.3 / 0.55)), rise: 0, state: 'moving' });
  expect(endViewFor(0.775, 1, 1, 2)).toMatchObject({ black: 1, rise: closeTo(0.5) });
  expect(endViewFor(1, 2, 2, 2)).toMatchObject({ black: 1, rise: 1, state: 'rest' });
});
```

- [ ] **Step 2: Run them.**
  - Command: `npx vitest run tests/unit/ui/end-page.test.ts tests/unit/scene/bob-end-view.test.ts tests/unit/qa.test.ts`.
  - Expected: FAIL.
- [ ] **Step 3: Implement it.**
  - **The markup.** It is all inside `<section className="end-page" id="end" aria-labelledby="end-title">` and `<div className="end-roll">`:
    - `<h2 id="end-title" className="end-head" tabIndex={-1}>{end.head}</h2>`;
    - per question, `<div className="end-block"><h3 className="end-q">…</h3><p className="end-a">…</p></div>`. The placeholder and its tag stay as today;
    - `<div className="end-sign"><span className="end-line" /><p className="end-name">{profile.name}</p></div>`;
    - `<div className="end-final">`, holding the message title h2, `ContactForm` at level 3 and the direct links.
  - **The CSS (base.css).** It replaces the end page's rules and keeps the parts on the step fade, the `@starting-style` and the header over the page.
    - The sizes are the Global Constraints'. The spacing follows `mockup.css`'s `.cr-*`: blocks 140 px apart, 150 px after "Q&A", 170 px before the name and 220 px before the final part; at ≤ 600 px, blocks 110 px apart.
    - The colours are the site's tokens.
    - The two layouts (3D on, the story at the end):
      - **at rest:** the page in the flow under the header, with `padding-top: calc(55dvh − var(--header-height))` so "Q&A" stands at 55 % of the screen;
      - **moving:** fixed and a screen tall, with `padding-top: 55dvh`, its night `rgb(4 2 9 / var(--end-black))`, and `.end-roll` at `translateY(calc((1 − var(--end-rise)) * 45dvh))`;
      - so "Q&A" stands on the same pixel at rise 1 and at rest.
    - `.end-final` is `min-height: calc(100dvh − var(--header-height))`, a centred flex column, so at the end of the document's scroll the form rests in the middle.
    - **The fade at the edges.** `.end-page::before` (top, under the header) and `::after` (the foot), both fixed, 20dvh tall, night to clear, `pointer-events: none`. Not with `prefers-reduced-motion: reduce`.
    - **3D off, no WebGL, the fallback card:** none of these layouts. The credits are a normal centred page in the flow.
  - **Home** passes the end view as today. `endViewFor` computes `black` and `rise` from the share.
- [ ] **Step 4: Run every unit test and the typecheck.**
  - Command: `npx vitest run && npm run typecheck`.
  - Expected: PASS.
- [ ] **Step 5: Commit.** Message: `ui: the questions as the end credits: black, a small Q&A, Bob's six answers, his name, then the message form resting in the middle`.

### Task 13: Reduced motion, 3D off and a failed void

**Files:**
- Modify: `src/scene/bob/stepFade.ts`, `src/scene/bob/landingHold.ts`, `src/styles/base.css`
- Test: `tests/unit/scene/bob-step-fade.test.ts`, the landing hold's cases in `tests/unit/state/route-sync.test.ts` or its own file

**Interfaces:**
- Consumes: `keyStops` (Task 3) and `LANDING_HOLD` (Task 3).

- [ ] **Step 1: Write the failing tests.**

```ts
it('steps reduced motion through the arrivals, the insides and the look back', () => {
  expect(stepStopFor(L + 3.0, 'ready')).toBeCloseTo(L + 2.7, 9);
  expect(stepStopFor(L + 13.6, 'ready')).toBeCloseTo(L + 12.65, 9);
  expect(stepStopFor(L + 14.6, 'ready')).toBeCloseTo(L + 14.55, 9);
});
it('holds a failed void at the hand-over, with no projects after it', () => {
  expect(heldAtLanding(L, 'failed')).toBe(true);
  expect(stepStopFor(L + 5, 'failed')).toBeCloseTo(L, 9);
});
```

- [ ] **Step 2: Run them.**
  - Command: `npx vitest run tests/unit/scene/bob-step-fade.test.ts tests/unit/state`.
  - Expected: FAIL where the old stops are named.
- [ ] **Step 3: Implement it.**
  - `stepStopFor` reads the new key stops.
  - The arrival stop poses the label at full opacity (the orbit's t = 1), and the inside stop the objects built (`build` 1). Both come from the pose, so nothing is added for reduced motion beyond the stops.
  - The CSS is checked: the credits' edge fades are off with reduced motion, and the 3D-off page is a normal centred page (Task 12).
  - The failed void's "Vragen & contact" link focuses `#end-title` as today.
- [ ] **Step 4: Run every unit test.**
  - Command: `npx vitest run`.
  - Expected: PASS.
- [ ] **Step 5: Commit.** Message: `scene: reduced motion steps through each arrival, inside and the look back; a failed void holds at the hand-over`.

### Task 14: The harness proves it by real input

**Files:**
- Modify: `src/debug/needleDebug.ts`, `tools/proof/needle.mjs`

**Interfaces:**
- The bridge's `journey` gains `beads` (px centre and radius, visible), `label` and `wake` (each bead's swept span). It loses `angle` and `ring`.
- Each step runs at 1440×900 and 390×844 (touch), and the steps that say so at 1366×657 too.

- [ ] **Step 1: Write the steps.**
  - **Retire** `ring`, `ring-drag` and `sheet`.
  - **Add `path`:**
    - From the fall's end, wheel notches run the story into TRAVEL 0 with no stop.
    - At every sample on the way (not the look back), at most one bead is visible with fade ≥ 0.5.
    - In ORBIT 0 the wake's span grows monotonically, and scrolling back up runs it back.
    - At Funcial's arrival stop the label shows within 1 s of rest, right of the light (desk) or under the bead (phone).
    - In INSIDE 0 the label is gone and five touch points show, each within the screen.
    - Then Jontai Energy (four points) and Cookies Clicker (five), in order.
    - Stopping anywhere rests there, and the canvas sleeps within 1 s.
  - **Add `look-back`:**
    - At the look's end all three beads are visible and inside the frame, and the way line shows.
    - Hovering each bead's px shows its label.
    - Tab goes Funcial, Jontai Energy, Cookies Clicker, then the skip button, each label shown on focus.
    - Enter on one opens its page.
  - **Add `credits`** (three sizes):
    - From the look back, a wheel down fades to black and raises the credits.
    - At rest, "Q&A"'s top is at 55 % ± 2 px of the viewport's height: the same pixel at rise 1 moving and at rest.
    - The wheel then scrolls the document natively.
    - At the maximum scroll the form's centre is within 5 % of the space under the header's middle.
    - The computed sizes at 1440×900: answers 19 px, questions 13 px, "Q&A" and the name 15 px, the column 580 px. At 390×844 the answers are ≥ 16 px.
    - The edge fades are present, and absent with reduced motion.
    - At the document's top, a wheel up takes the story back to the look back.
  - **In English too.** `path`, `look-back` and `credits` also run at `/en/`, with the English labels, questions and answers.
  - **Update:**
    - `bridge`, `persist`: Back to `/` puts the story at Funcial's arrival stop.
    - `light-dive`: frames 1 to 256, with the light within 6 px of the fixture at 20, 60, 121 and 241.
    - `light-facts`: fact 05 fades out and is never cut.
    - `bead-open`: open Jontai Energy from its arrival, from its inside and from the look back. Back returns to each place.
    - `void-hold`: it holds at the hand-over with the file delayed, then goes on.
    - `void-fail`: the hold, the home nav, no skip button, and the link focuses "Q&A".
    - `end-page`, `keyboard`, `reduced-motion`: the steps at the arrivals, the insides and the look back, by fades.
    - `stills`: the luma gate on each arrival, each inside, the look back and the credits.
    - `resize`: a portrait resize mid-orbit keeps the place, and the label stays on the light.
    - `no-webgl`, `fps` and `sleep`.
- [ ] **Step 2: Run them against the build.**
  - Commands: `npm run build`, `PORT=4421 npm run preview` (in the background), then `PLAYWRIGHT_CORE=C:/Users/bhcco/Downloads/Funcial/node_modules/playwright-core BASE=http://localhost:4421 node tools/proof/needle.mjs`.
  - Expected: every step PASS. A step that fails on `ERR_NO_BUFFER_SPACE` is re-run alone (`STEPS=<id>`).
- [ ] **Step 3: Commit.** Message: `proof: the light's path, the look back and the credits, by real input at three sizes`.

### Task 15: The gates, the recording and Bob's review

**Files:**
- Create, untracked: `.superpowers/light-path-site-review/review.html`, with its videos and stills, in this worktree.

- [ ] **Step 1: Run every gate.**
  - Commands:
    - `npx vitest run`;
    - `npm run typecheck`;
    - `npm run build`;
    - the auditor: `"/c/Program Files (x86)/Steam/steamapps/common/Blender/5.2/python/bin/python.exe" -I tools/site_audit.py dist/client`;
    - the full harness.
  - Expected: all PASS.
- [ ] **Step 2: Record the site.**
  - Under `?proof`, the bridge's `.set({ progress })` poses the story frame by frame at 24 fps, along the mock-up's own timeline (`make-video.mjs`: its PACE, holds and stops, mapped through `q = p − 0.45`).
  - Capture it at 1440×900 and 390×844 in the harness's headless Edge.
  - Encode it with the mock-up's Blender script (`bob_encode_w.py`).
  - Put stills beside the mock-up's at the same places.
- [ ] **Step 3: Write `review.html` for Bob**, formal and plain:
  - what is built;
  - where it differs from the mock-up, if anywhere. Name the abacus: it rises as one piece, as in the approved mock-up, because a rod-by-rod rise needs the beads' file rigged in Blender;
  - how to see it (`npm run preview`, port 4421);
  - the open questions: merging `bob-dive`, and Way 2.

  Serve it with `npx vite .superpowers/light-path-site-review --port 4433 --strictPort`.
- [ ] **Step 4: Stop for Bob.**
  - Commit any remaining tracked changes with message `docs: the light's path in the site, for Bob's review`.
  - Write `Final review: self-review (no subagent tool)` in the ledger, and say so to Bob.
  - Nothing is merged or pushed without his OK.
