# The light dive in the site: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, inline (Bob, 2026-10-26: "DO NOT use subagent"). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved light dive (mock-up round 3) into the site's home scroll. From BOB seen from above:
- the needle lights up into a light;
- the light flows away through the void past Bob's five facts;
- it lands as the needle at the centre of a ring of the projects;
- the camera turns round the ring exactly with the scroll;
- after the last project the end page slides up like a sheet.

**Architecture:**
- **The motion.** The previs (`tools/blender/light_dive.py`, 473dead) is the source of every motion number. It is ported to one pure TypeScript module, `src/scene/bob/lightDive.ts`. Tests tie it to the previs's own per-frame data, which is copied into `tests/fixtures/light-dive/`.
- **The journey.** `journeyPoseAt` (src/scene/bob/journey.ts) is rebuilt on new chapters: HOME 1, LIGHT 3, RING one unit per project gap, SHEET 1, END. It stays the one pose of each frame, which the Opening, Home, the Void and the DOM layers apply.
- **The scroll.** Past the rise, the scroll loop follows the scroll as the mock-up did: no settling, a sheet that finishes, and keys and drags as approved.

**Tech Stack:** React Router 8 (prerendered NL at `/`, EN at `/en/`), React Three Fiber 9.8, three 0.186, zustand, Vitest 5, TypeScript, Playwright-core with Edge (the proof harness `tools/proof/needle.mjs`).

**Spec:** `docs/superpowers/specs/2026-10-25-bob-light-dive-design.md`, revised 10e6cea after the second mock-up. The approved mock-up is `.superpowers/light-dive-mockup/` in the main checkout: `index.html`, `mockup.js`, `review.html`, the videos, and the frames and data.

## Global Constraints

- **Bob's rules:**
  - no subagents: the work is done inline;
  - nothing is merged or pushed without his OK;
  - the work stays on branch `bob-dive` (worktree `.claude/worktrees/bob-dive`);
  - never edit `.impeccable/config.json`;
  - commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Everything binding on M2b and the end page still binds:**
  - the strict CSP (no inline script or style, `worker-src 'none'`, no new source);
  - the luma gate for home stills (mean ≤ 0.11, clipped ≤ 0.4 %), which also judges every light-dive still;
  - NL as the default, and formal copy;
  - the Cookies Clicker classmate is never named;
  - the scroll's one shot writer (`src/scene/bob/shotSource.ts`), and one pose per frame;
  - the canvas asleep when nothing moves;
  - the harness passing in full, by real input, at 1440×900, 1366×657 and 390×844.
- **The facts, verbatim.** They are shown in capitals, with "/" as a line break, in this order, and no other fact appears anywhere:

  | | NL | EN |
  | --- | --- | --- |
  | 01 | 20 jaar | 20 years old |
  | 02 | Chinees van afkomst / geboren en getogen op Aruba / woont in Nederland | Chinese by descent / born and raised in Aruba / living in the Netherlands |
  | 03 | Hakka-erfgoed | Hakka heritage |
  | 04 | Oud-nationaal kampioen powerliften van Aruba | Former national powerlifting champion of Aruba |
  | 05 | Oud-nationaal kampioen tafeltennis van Aruba | Former national table tennis champion of Aruba |

- **The look:**
  - only gold and violet on the near-black;
  - no tunnel, streaks, burst, flash or strobe;
  - nothing joining the needle or the light to a bead;
  - the needle at the ring's exact centre;
  - one focal point.
- **The labels:**
  - Martian Mono, weight 300, capitals, letter-spacing 0.22em;
  - the number (01–05) above the words;
  - a fine gold line from the light's side to the words;
  - the glow follows the light's;
  - font size ≥ 13 CSS px at 1440×900 and ≥ 11 CSS px at 390×844;
  - one label at a time.
- **The skip button:** "Snel naar vragen ↓" / "Skip to questions ↓". It shows only in the ring, at the bottom right, never over the front bead's label. It fades straight to the end page by the step fade, and the focus moves to the end page's title.
- **Round 3, approved:**
  - **The landing:** one unbroken move. The light keeps its fall's speed until it reaches the ring's centre, then becomes the needle over 10 frames. The beads rise from way frame 262. The camera swings round into the orbit, arriving at frame 300 turning at the scroll's own orbit rate.
  - **The ring:** it moves exactly with the scroll and never by itself. A drag moves the scroll, within the ring. The front bead's label shows when the ring stands still within 20° of a project.
  - **The sheet:** it follows the scroll. When the scroll stops part-way (80 ms without input, no finger down), it finishes at once in the scroll's last direction, or goes back down when under 3 % up. It carries on at its speed and eases only at its end, taking between 0.35 s and 1.2 s.
- **The pace, from the mock-up:**
  - past the rise, the shown place follows the scroll with a time constant of 0.45 s, held to a floor of 12 way frames a second near its target;
  - the rise keeps M2a's damp (RISE_SMOOTH 0.25);
  - a key's glide that leaves or enters the light dive takes max(0.6 s, 1.2 s × sqrt(d)), d in projects (units), eased in and out from rest.

## Review Focus

1. **Momentum carrying a fling from the ring into the sheet.** A trackpad's inertia keeps sending input. The sheet must not start finishing while input still arrives, and input in the finish's own direction rides along with it. Pinned in Task 4: `sheet finish waits for 80 ms of quiet` and `input during a finish rides along or stops it`.
2. **A phone rotated, or a window resized, mid-fall or mid-ring.** The light, its label and the bead label must stay together on the new aspect, with no jump of the story's place. Pinned in Task 10 (`placeFact` at a changed aspect) and Task 13 (harness `resize` mid-fall).
3. **A visitor who reaches the landing before the beads' file has loaded.** The light and facts play, the story holds just above the ring, and it goes on once the file is ready. There is never a stall with nothing to see. Pinned in Task 4 (`landingHoldFor`) and Task 13 (harness `void-hold`, with the file delayed).
4. **Keyboard use in the ring.** Tab reaches the front bead's label, then the skip button. Enter opens the bead, and Esc comes back to the same bead in front. A key pressed during a drag does nothing. Pinned in Task 9 (`the label is focusable only when shown`) and Task 13 (harness `keyboard`).
5. **Back from a project page.** It lands on that project's ring stop with its bead in front and its label shown. Pinned in Task 1 (`stopForProject`) and Task 13 (harness `bead-open`).

---

### Task 1: The chapters, the phases and the stops

**Files:**
- Modify: `src/state/chapters.ts`, `src/state/machine.ts`, `src/state/routeSync.ts`
- Test: `tests/unit/state/chapters.test.ts`, `tests/unit/state/machine.test.ts`, `tests/unit/state/route-sync.test.ts`

**Interfaces:**
- Produces:
  - `type ChapterId = 'HOME' | 'LIGHT' | 'RING' | 'SHEET' | 'END'`;
  - `LIGHT_UNITS = 3`;
  - `FACT_PEAKS = [81, 121, 161, 201, 241] as const`, the way frames where each fact is at full strength;
  - `lightStart(c): number`, `ringStart(c): number`, `sheetStart(c): number`;
  - `projectStop(c, category: string): number`;
  - `keyStops(c): number[]`;
  - `placeOfFrame(f: number): number`, which is `lightStart + LIGHT_UNITS·(f − 1)/299`;
  - `Phase` kinds `LOADING | HOME_IDLE | LIGHT | PROJECTS{category} | END | PROJECT_FOCUS{id}`.

- [ ] **Step 1: Write the failing tests.**

```ts
it('lays out the home: the rise, the light dive, the ring, the sheet, the end', () => {
  const c = buildChapters({ categories: ['secure-element', 'front-panel', 'oscillator'] });
  expect(c.units.map((u) => [u.id, u.start, u.length, u.category])).toEqual([
    ['HOME', 0, 1, null], ['LIGHT', 1, 3, null],
    ['RING', 4, 1, 'secure-element'], ['RING', 5, 1, 'front-panel'],
    ['SHEET', 6, 1, 'oscillator'], ['END', 7, 1, null]]);
  expect([riseTop(c), lightStart(c), ringStart(c), sheetStart(c), scrollEnd(c)]).toEqual([1, 1, 4, 6, 7]);
});
it('steps keys through the top, each fact at full strength, each project and the end', () => {
  const c = HOME_CHAPTERS;
  expect(keyStops(c)).toEqual([0, 1, ...FACT_PEAKS.map(placeOfFrame), 4, 5, 6, 7]);
  expect(placeOfFrame(1)).toBe(1);
  expect(placeOfFrame(300)).toBe(4);
});
it('puts each project at its ring stop', () => {
  expect(['funcial', 'jontai-energy', 'cookies-clicker'].map(stopForProject)).toEqual([4, 5, 6]);
});
it('maps chapters to phases', () => {
  expect(transition({ kind: 'HOME_IDLE' }, { type: 'CHAPTER', chapter: 'LIGHT', category: null })).toEqual({ kind: 'LIGHT' });
  expect(transition({ kind: 'LIGHT' }, { type: 'CHAPTER', chapter: 'SHEET', category: 'oscillator' })).toEqual({ kind: 'PROJECTS', category: 'oscillator' });
  expect(SCROLL_PHASES).toEqual(new Set(['HOME_IDLE', 'LIGHT', 'PROJECTS', 'END']));
});
```

- [ ] **Step 2: Run them.**
  - Command: `npx vitest run tests/unit/state`.
  - Expected: FAIL. The old ids (DIVE, VOID_ENTRY, PROJECTS) and the missing exports are why.
- [ ] **Step 3: Implement it.**
  - `buildChapters` lays out HOME 1, LIGHT `LIGHT_UNITS`, RING one unit for each category but the last, SHEET 1 (the last category), and END 1.
  - `stops(c)` still gives the unit starts.
  - `machine.ts`: `phaseOfChapter` maps RING and SHEET to `PROJECTS` with the unit's category.
  - `routeSync.stopForProject` uses `projectStop`.
  - Delete the old ids everywhere `grep -rn "'DIVE'\|'VOID_ENTRY'\|'PROJECTS'" src` finds them as chapter ids. The phase kind `PROJECTS` stays.
- [ ] **Step 4: Run the tests and the typecheck.**
  - Command: `npx vitest run tests/unit/state && npm run typecheck`.
  - Expected: the state tests PASS. The typecheck fails only in modules later tasks rewrite (journey.ts, diveHold.ts). List them in the commit message.
- [ ] **Step 5: Commit.** Message: `state: the home's chapters for the light dive: HOME, LIGHT 3, RING per project gap, SHEET, END; key stops at the facts and the projects`.

### Task 2: The light dive's motion, ported from the previs

**Files:**
- Create: `src/scene/bob/lightDive.ts`, which is pure, as journey.ts is: no React and no three.
- Create: `tests/fixtures/light-dive/way-desk.json`, `way-phone.json`, `ring-desk.json`, `ring-phone.json`. Copy them from the main checkout's `.superpowers/light-dive-mockup/data/`; they were produced by 473dead's `light_dive.py`.
- Test: `tests/unit/scene/bob-light-dive.test.ts`. Three's math may be used in the test only.

**Interfaces:**
- Consumes: `CameraShot`, `topShotFor` (src/engine/bob/shots.ts); `lensField`, `fieldFor` (journey.ts, kept); `NeedleOverride`.
- Produces. All of these are in three's frame: Blender (x, y, z) is three (x, z, −y).
  - **Frame constants, as in the previs:**
    - `LIGHT_FRAMES = 300`;
    - `F = { IGNITE: 8, PASS: 46, TURN: 60, CHASE: 80, SETTLE: 84, FALL: 61, LAND: 261, ARRIVE: 273, NEEDLE: 272, END: 300 }`;
    - `NEEDLE_FRAMES = 10`;
    - `BEADS_IN = 262`.
  - **The ring:**
    - `RING = { centre: [0, -11, 0], radius: 5.5, rise: 6, needleScale: 2, lift: 0.35 }`;
    - `ORBIT_RATE = 120 / (299 / 3)`;
    - `RING_TURN0 = ORBIT_RATE * 40 / 2`.
  - `type DiveSize = 'desk' | 'phone'`; `sizeFor(aspect): DiveSize`, which is `'desk'` when aspect ≥ 1.
  - `wayShot(f: number, aspect: number): CameraShot`, for way frame f (fractional allowed), the landing's swing included. At f = 300 it equals `ringShot(0, aspect)` exactly.
  - `ringShot(angle: number, aspect: number): CameraShot`, the camera `angle` degrees round the ring.
  - `lightAt(f, aspect): { position: Vec3; radius: number; glow: number; stretch: number; yaw: number }`.
  - `trailAt(f, aspect): Vec3[]`, the trail's points, newest first.
  - `filamentsAt(f): Vec3[][]`, light-local, by the frame.
  - `factAt(f): { index: number | null; opacity: number; side: -1 | 1 | null }`.
  - `streamAt(f): number`, in metres.
  - `voidAt(f, aspect): { band: number; bandY: number; bandSigma: number; ringMist: number; dust: number; topFade: number; glassDissolve: number }`.
  - `wayNeedle(f): NeedleOverride | null` and `ringNeedle(angle): NeedleOverride`.
  - `beadsAt(f, aspect)` and `ringBeads(angle, aspect)`, each `{ id, position: Vec3, towards: Vec3, lit: number, shown: boolean }[]`.

- [ ] **Step 1: Write the failing oracle tests.** Each checks the port against the previs's own data. Use three's `PerspectiveCamera` built from the shot, and the frame size of each data set (desk 1440×900, phone 585×1266).

```ts
it.each(['desk', 'phone'])('puts the light where the previs drew it on every way frame (%s)', (size) => {
  const data = load(`way-${size}`); const [w, h] = FRAME[size];
  for (const e of data) {
    const at = project(lightAt(e.f, w / h).position, wayShot(e.f, w / h), w / h);
    expect(Math.hypot((at.x - e.light.x) * w, (at.y - e.light.y) * h)).toBeLessThan(1);
  }
});
it.each(['desk', 'phone'])('puts the beads and the needle where the previs drew them round the ring (%s)', (size) => {
  for (const e of load(`ring-${size}`)) {
    const shot = ringShot(e.angle, w / h);
    ringBeads(e.angle, w / h).forEach((b, i) => expect(px(project(b.position, shot), e.proj.beads[i])).toBeLessThan(1));
    expect(px(project(tipOf(ringNeedle(e.angle), 'front'), shot), e.proj.needle.front)).toBeLessThan(1.5);
  }
});
it('hands the way to the ring with no seam, turning at the orbit rate', () => {
  for (const a of [1440 / 900, 1366 / 657, 585 / 1266]) {
    expect(wayShot(300, a)).toEqual(ringShot(0, a));
    expect(azimuthOf(wayShot(300, a)) - azimuthOf(wayShot(299, a))).toBeCloseTo(ORBIT_RATE, 2);
  }
});
it('keeps the fall speed to the arrival: no slowing before the ring', () => {
  const v = (f: number) => lightAt(f, 1.6).position[1] - lightAt(f + 1, 1.6).position[1];
  for (let f = 100; f < F.ARRIVE - 1; f++) expect(v(f)).toBeCloseTo(v(100), 6);
});
it('shows each fact once, in order, beside a side move of a tenth of the width', () => {
  expect([81, 121, 161, 201, 241].map((f) => factAt(f))).toEqual([0, 1, 2, 3, 4].map((i) => ({ index: i, opacity: 1, side: [-1, 1, -1, 1, -1][i] })));
});
it('starts from the site\'s own top shot', () => {
  expect(wayShot(1, 1440 / 900)).toEqual(topShotFor(1440 / 900));
});
```

- [ ] **Step 2: Run them.**
  - Command: `npx vitest run tests/unit/scene/bob-light-dive.test.ts`.
  - Expected: FAIL, because the module is missing.
- [ ] **Step 3: Port light_dive.py's motion functions.** Port them faithfully, with their constants:
  - `speed_table` and its bisection, which gives `V_FALL` landing at `F.ARRIVE`;
  - `chase_angle`, `stream_at`, `swing`, `track_pose`, `cam_pose`;
  - `side_x`, `light_path`, `trail_point`, `light_radius`, `glow_at`, `fact_at`;
  - `ring_camera_pose`, `ring_bead_position`, `rel_to`, `lift_from`, `ring_closeness`;
  - `filament_shape` and `filament_at`;
  - the `void_state` fields above.

  These rules apply:
  - **Screens other than the previs's two.** Take the size by `sizeFor`. Keep that size's horizontal field (`lensField` of its lens), with the vertical field from the aspect.
  - **The phone ring needs 79°** (47 mm on 585×1266). Shots of the ring and the landing may exceed `MAX_VFOV` up to 80°. The way's shots keep the top shot's field.
  - **The way-in's start.** It begins at `topShotFor(aspect)`. The previs's desk top (12.6 m, 50 mm) and phone top (21.35 m, 83.5 mm) are the site's own on those screens, as the last test pins.
  - **The light's position** is the previs's `LIGHT_POS`: the axis, sunk by the speed table, and moved across by `side_x` through the camera's horizontal field.
  - **The filaments and the light's breath** follow the frame, not a clock, so the canvas sleeps when the scroll rests.
- [ ] **Step 4: Run them.**
  - Command: `npx vitest run tests/unit/scene/bob-light-dive.test.ts`.
  - Expected: PASS, every frame of both sizes.
- [ ] **Step 5: Commit.** Message: `scene: the light dive's motion, ported from the previs and tied to its data`.

### Task 3: The journey on the new chapters

**Files:**
- Modify: `src/scene/bob/journey.ts`, rewritten past the rise: delete `BEADS`' void layout, `CAMERA_PATH`, `NEEDLE_PATH`, the bends, the overview, the old dive and the night. Keep `lensField`, `fieldFor`, `shotToward` and `focusShotFor`, adapted.
- Modify: `src/scene/bob/voidPose.ts`: `selectedBead` reads the front bead.
- Delete: the old `diveHold.ts` export `TUNNEL_HOLD`; Task 4 replaces it.
- Test: `tests/unit/scene/bob-journey.test.ts`, rewritten.

**Interfaces:**
- Consumes: Task 1's chapters, and Task 2's functions.
- Produces:
  - `type Stretch = 'rise' | 'light' | 'ring' | 'sheet' | 'end'`.
  - `interface JourneyAt { stretch; local: number; frame: number | null; angle: number | null; project: number | null }`:
    - `frame` is the way frame in LIGHT;
    - `angle` is the ring's degrees in RING and SHEET (240 in SHEET);
    - `project` is the front bead's index when `angle` is within 20° of a project's, else null.
  - `interface JourneyPose { at; rise; shot; needle: NeedleOverride | null; light: LightPose | null; fact: FactPose | null; beads: readonly BeadPose[] | null; void: VoidPose; sheet: number }`, where `sheet` runs 0..1.
  - `BEADS`, the ids and categories in ring order: index 0 is Funcial at 0°, 1 Jontai Energy at 120°, 2 Cookies Clicker at 240°.
  - `focusShotFor(id, aspect)`: the close view in front of the bead's porthole, `FOCUS_VIEW.standOff` 1.6 from the porthole along the line to the camera at the bead's ring stop.

- [ ] **Step 1: Write the failing tests.**

```ts
it('poses the rise as M2a did', () => expect(journeyPoseAt(0.5, 1.6).shot).toEqual(scrollPoseAt(riseAt(0.5), 1.6).shot));
it('runs the light dive frame by frame', () => {
  expect(journeyAt(placeOfFrame(121))).toMatchObject({ stretch: 'light', frame: 121 });
  expect(journeyPoseAt(placeOfFrame(121), 1.6).shot).toEqual(wayShot(121, 1.6));
});
it('turns the ring exactly with the scroll', () => {
  expect(journeyAt(4.5)).toMatchObject({ stretch: 'ring', angle: 60, project: null });
  expect(journeyAt(4 + 0.15)).toMatchObject({ angle: 18, project: 0 });
  expect(journeyPoseAt(5.25, 1.6).shot).toEqual(ringShot(150, 1.6));
});
it('has no seam anywhere: neighbouring places pose neighbouring shots', () => {
  for (let p = 0; p < 7; p += 0.001) expect(shotDistance(journeyPoseAt(p, 1.6).shot, journeyPoseAt(p + 0.001, 1.6).shot)).toBeLessThan(0.15);
});
it('raises the sheet over Cookies Clicker', () => {
  expect(journeyPoseAt(6.25, 1.6)).toMatchObject({ sheet: 0.25, at: { stretch: 'sheet', angle: 240 } });
  expect(journeyPoseAt(7, 1.6).at.stretch).toBe('end');
});
it('stands the close view in front of each bead\'s porthole, toward its stop\'s camera', () => { /* the camera within 0.01 of centre + 2.55 * unit(toward the ring camera at the bead's angle) */ });
```

- [ ] **Step 2: Run them.**
  - Command: `npx vitest run tests/unit/scene/bob-journey.test.ts`.
  - Expected: FAIL.
- [ ] **Step 3: Rewrite `journeyAt` and `journeyPoseAt`.** On top of Task 2:
  - in LIGHT, `frame = 1 + 299·local·…`, which is `(place − lightStart)/LIGHT_UNITS·299 + 1`;
  - in RING, the angle is `120·(place − ringStart)`;
  - SHEET holds angle 240, with `sheet = place − sheetStart`;
  - END is the sheet at 1.

  Within 1e-6 of a stop, the place is the stop, as now.
- [ ] **Step 4: Run them.**
  - Command: `npx vitest run tests/unit/scene`.
  - Expected: PASS for the journey. Update `bob-focus` and `voidPose`'s tests to the ring. Other scene tests fail only where later tasks change their module; name them in the commit.
- [ ] **Step 5: Commit.** Message: `scene: the journey on the light dive, the ring and the sheet`.

### Task 4: The scroll: follow, no settle, the sheet's finish, the hold, keys

**Files:**
- Modify: `src/input/scrollLoop.ts`, `src/input/target.ts`, `src/scene/bob/diveHold.ts`.
- Rename: `diveHold.ts` to `landingHold.ts`, exporting `landingHoldFor` and `LANDING_HOLD`.
- Test: `tests/unit/input/scroll-loop.test.ts` and `tests/unit/input/target.test.ts`, rewritten past the rise.

**Interfaces:**
- **Constants:**
  - `FOLLOW = { tau: 0.45, floorFramesPerSecond: 12 }`;
  - `SHEET_FINISH_MS = 80`, `SHEET_BACK = 0.03`, `FINISH_S = [0.35, 1.2]`;
  - `GLIDE_S = 1.2`, `GLIDE_MIN_S = 0.6`;
  - `LANDING_HOLD = placeOfFrame(258)`;
  - `landingHoldFor(state)`, which gives `scrollEnd` for `'ready'` and `LANDING_HOLD` for every other state, `failed` included (spec: the story holds where the ring would be);
  - `stopsFor(c, 'failed')`, which is `[0, 1, LANDING_HOLD, scrollEnd]`.
- **Removed:** `settleTarget` past the rise, `SETTLE_SLOP_PX`'s settle, `END_WHEEL_SLOP_PX`, `DIVE_SMOOTH` and `GLIDE_SMOOTH`.
- **New:** `finishTarget(place: number, direction: number, c): number | null`. Past `sheetStart` and short of `scrollEnd`: `scrollEnd` if `direction > 0` and the place is at least `SHEET_BACK` past `sheetStart`, else `sheetStart`. Elsewhere it is null.

- [ ] **Step 1: Write the failing tests.** Drive the loop with the injected `request`, as the existing tests do:
  - `follows past the rise with tau 0.45`:
    - 1 s after a 0.5-unit step at progress 2, the progress has covered `1 − e^(−1/0.45)` of it, within 1 %;
    - near the target it moves no slower than the floor, `12·3/299` units a second.
  - `keeps the rise's damp`: smoothTimeAt on the rise is RISE_SMOOTH.
  - `rests where a wheel stops in the light dive and in the ring`: wheel deltas to 2.3 and 4.6, then 2 s idle; the target and the progress are exactly 2.3 and 4.6.
  - `sheet finish waits for 80 ms of quiet`:
    - wheel deltas into 6.2, each 16 ms apart, for 300 ms: no finish while they come;
    - 80 ms after the last, a finish to 7 starts;
    - it lands within 1.3 s;
    - the progress's speed never falls below half its speed at the finish's start until 0.9.
  - `finishes back down under 3 % or when scrolling up`: from 6.02 it goes down; after a wheel up to 6.5 it goes down to 6.
  - `input during a finish rides along or stops it`:
    - a wheel delta in the finish's direction keeps the finish's destination;
    - one against it stops the finish where the scroll put it.
  - `keys step through keyStops`:
    - from 1, ArrowDown targets placeOfFrame(81);
    - from 4, ArrowDown glides to 5, eased from rest in 1.2 s, its peak speed at most 1.6 units/s;
    - two presses 300 ms apart rest on 6.
  - `holds just above the ring while the beads load`:
    - with `voidState` 'loading', a wheel to 5 holds at LANDING_HOLD;
    - 'ready' goes on to 5.
    - With 'failed' it holds at LANDING_HOLD. End there goes to 7 by the step fade, and back up from 7 goes to LANDING_HOLD by the step fade.
  - `reduced motion steps among keyStops`: a wheel notch from 1 steps to placeOfFrame(81), with no travel between.
- [ ] **Step 2: Run them.**
  - Command: `npx vitest run tests/unit/input`.
  - Expected: FAIL.
- [ ] **Step 3: Implement it.**
  - `ScrollLoop.tick` smooths with damp on the rise, and with `follow` (the mock-up's `easePlace`) past it.
  - `startHomeScroll` drops the settle past the rise, keeps the rise's rest-at-top, and tracks the last input's time and direction.
  - A tick with the target inside SHEET, ≥ `SHEET_FINISH_MS` after the last input, and no finger down starts a finish tween. It is a cubic Hermite from the shown place and speed to `finishTarget`, with T = clamp(1.5·d/|v|, 0.35, 1.2), or 1.2 if the speed points away. The page's target follows it.
  - Keys use `keyStops`. A key move that starts or ends past the light dive glides (the Hermite from rest, T = max(0.6, 1.2·sqrt(d))). Within the light dive, a key moves the target and `follow` eases after it.
  - The step fade and the end page's yielding stay.
- [ ] **Step 4: Run them.**
  - Command: `npx vitest run tests/unit/input && npx vitest run`.
  - Expected: the input tests PASS. Anything still failing belongs to Tasks 5–12; list it.
- [ ] **Step 5: Commit.** Message: `input: the scroll follows past the rise, the sheet finishes, keys step facts and projects, the hold before the landing`.

### Task 5: The ring's drag

**Files:**
- Modify: `src/input/VirtualScroll.ts`, adding `DeltaSource` `'drag'`.
- Modify: `src/input/scrollLoop.ts`. A `'drag'` delta is held to `[ringStart, sheetStart]`.
- Test: `tests/unit/input/virtual-scroll.test.ts`, `tests/unit/input/scroll-loop.test.ts`.

**Interfaces:**
- `VirtualScrollOptions.dragging?: () => boolean` says whether a sideways drag may take the ring now: the story's shown place is in RING.
- `DRAG_DEG = 0.25` degrees per CSS px, so one project is 480 px.
- `DRAG_LOCK_PX = 6`.

- [ ] **Step 1: Write the failing tests.**
  - `a mouse drag sideways in the ring moves the target 0.25° a px`: a pointer down, then 300 px right, gives +0.625 units.
  - `a drag stops at Cookies Clicker and at Funcial`: from 6, a further 300 px leaves the target at 6.
  - `a sideways swipe is a drag, an upright one a scroll`:
    - touch moves of (60, 5) give a 'drag' delta;
    - (5, 60) gives a 'finger' delta.
  - `nothing settles on release`: the target is unchanged 2 s after pointerup.
  - `a key during a drag does nothing`.
- [ ] **Step 2: Run them.**
  - Command: `npx vitest run tests/unit/input`.
  - Expected: FAIL.
- [ ] **Step 3: Implement the drag in VirtualScroll.**
  - Pointer events for mouse and pen.
  - On touch, the first `DRAG_LOCK_PX` of a gesture decide its axis.
  - It reports `onDelta(units, 'drag')`, where `units = dx·DRAG_DEG/120`.
  - A drag is ignored outside the ring. A press on a link or button is the control's.
  - `touch-action: pan-y` on the canvas host is unchanged; the sideways swipe is read from touch events.
- [ ] **Step 4: Run them.**
  - Command: `npx vitest run tests/unit/input`.
  - Expected: PASS.
- [ ] **Step 5: Commit.** Message: `input: a sideways drag turns the ring as a scroll would, from Funcial to Cookies Clicker`.

### Task 6: The void for the light dive

**Files:**
- Modify: `src/engine/bob/build/void.ts`.
- Modify: `src/scene/bob/Void.tsx`, splitting the build: the void at the hand-over, the beads' file loaded after.
- Test: `tests/unit/bob/build-void.test.ts`, `tests/unit/scene/bob-void.test.ts`.

**Interfaces:**
- `VoidModel` gains:
  - `setStream(metres: number)`: the dust moved toward the camera, the previs's `stream_at`;
  - `setBand({ shown, y, sigma, strength }, camera)`: the mist band held to the camera, the previs's `mist` plane;
  - `setRingMist(share)`: the world-fixed ring of mist, `MIST_RING_R` 20 m round the axis, dissolved in over way frames 272–296;
  - `setDust(level)`: the dust's glow, 0 to 1 over frames 28–60.
- `setLight(beam, mist)` is removed, and the beam with it: the light dive has no beam.
- The dust keeps clear of the camera's path, the light's path, the ring camera's orbit circle (1.7 m) and the beads' rise (1.3 m). That is the previs's `clear_trees`, computed from Task 2's functions for both sizes.

- [ ] **Step 1: Write the failing tests.**
  - `dust keeps clear of the dive's paths and the orbit`: every dust point in its own moving frame stays at least `CLEAR` from the sampled camera path (both sizes), the light's path and the orbit circle.
  - `the band follows the camera`: setBand y 0.30 puts the band's middle at 0.30 of the frame for a camera at the chase pose.
  - `stream moves the dust, not the ring`: setStream(2) moves the dust's group by (0, 0, +2) and leaves the ring of mist where it is.
  - `the void is built without the beads' file`: the Void reports `voidState` 'loading' while the file loads, and its void group is in the scene from the hand-over.
- [ ] **Step 2: Run them.**
  - Command: `npx vitest run tests/unit/bob/build-void.test.ts tests/unit/scene/bob-void.test.ts`.
  - Expected: FAIL.
- [ ] **Step 3: Implement it.**
  - The band is the haze's sprites in one camera-held layer. The ring of mist is the haze's sprites laid on a cylinder of radius 20 at the band's height.
  - The look is matched by eye to the mock-up frames at the same way frame: the band in the upper third in the chase, and violet only.
  - Tune with `npm run build` and the harness `stills` step's luma gate (Task 13).
- [ ] **Step 4: Run them.**
  - Command: `npx vitest run tests/unit/bob tests/unit/scene`.
  - Expected: PASS.
- [ ] **Step 5: Commit.** Message: `void: the band, the stream and the ring of mist; built at the hand-over, the beads after`.

### Task 7: The light

**Files:**
- Create: `src/engine/bob/build/light.ts`.
- Test: `tests/unit/bob/build-light.test.ts`.

**Interfaces:**
- `buildLight(tier: QualityTier): LightModel`.
- `LightModel { group: THREE.Group; setPose(pose: LightPose, camera: THREE.Camera): void; setTier(tier): void; dispose(): void }`.
- `LightPose` comes from Task 2's `lightAt`, plus `trail: Vec3[]` and `filaments: Vec3[][]`.
- The parts are the previs's:
  - a white-gold core;
  - a gold shell;
  - a camera-facing halo;
  - `FIL_N` 10 filament curves;
  - a tapered trail tube of `TRAIL_SIDES` 10, rebuilt in place each frame from `trail`;
  - a warm point light.

  Gold only: `palette.gold` and `palette.goldLight`. No part writes depth.

- [ ] **Step 1: Write the failing tests.**
  - `the light is gold only`: every material's colour is within the palette's golds; none is violet or white past `goldLight`.
  - `setPose places, sizes, stretches and dims it`: the group at `position`, scaled `radius`, stretched along the needle's axis by `1 + 3·stretch`, and its emissive levels times `glow`. At glow 0 the group is hidden.
  - `the trail updates in place`: setPose twice with 110 points allocates no new geometry (the same BufferAttribute).
  - `no part writes depth` and `dispose frees every geometry and material`.
- [ ] **Step 2: Run them.**
  - Command: `npx vitest run tests/unit/bob/build-light.test.ts`.
  - Expected: FAIL.
- [ ] **Step 3: Build it.** Shaders go in material `onBeforeCompile` or `ShaderMaterial`, in the CSP-safe style the void's haze uses, with no worker. The size is the previs's `LIGHT_ALPHA` share of the frame's width (desk 0.025, phone 0.05 from F.SETTLE on).
- [ ] **Step 4: Run them.**
  - Command: `npx vitest run tests/unit/bob/build-light.test.ts`.
  - Expected: PASS.
- [ ] **Step 5: Commit.** Message: `light: the falling light, its filaments and its trail`.

### Task 8: The way in and the fall on screen

**Files:**
- Modify: `src/scene/bob/Opening.tsx` (its pose and shot), `src/scene/bob/Home.tsx` and `src/scene/bob/Void.tsx`.
- Modify, adding the dims below: `src/engine/bob/build/glassFloor.ts` and `src/engine/bob/build/compass.ts`.
- Test: `tests/unit/scene/bob-opening.test.ts`, plus the harness in Task 13.

**Interfaces:**
- `GlassFloorModel.setDissolve(share)`: the floor's glass and the well's glow fade to transparent, the previs's `DISSOLVE`.
- `CompassModel.setTopFade(share)`: the engraving's, the rings' and the letters' glow dim, the previs's `TOP_EMIT`. Already-existing setters do this where they can: `engraving.setGlow`, `glassFloor.setGlow` and `smoke.setDensity`.
- Each frame in the light dive, from the journey pose:
  - the camera's shot (`pose.shot`);
  - the compass's needle hidden over way frames 2–8 (`setNeedleWorld` at scale → 0), as the light ignites at the pivot;
  - `topFade` over 14–28 and `glassDissolve` over 16–28 (`voidAt`);
  - the light (`LightModel.setPose`);
  - the void's band, stream, dust and ring mist;
  - the void shown from frame 20.

- [ ] **Step 1: Write the failing test.** `the Opening's shot is the journey's in the light dive`: for progress placeOfFrame(f), f ∈ {1, 30, 61, 121, 261, 300}, the shot written equals `wayShot(f, aspect)`.
- [ ] **Step 2: Run it.**
  - Command: `npx vitest run tests/unit/scene/bob-opening.test.ts`.
  - Expected: FAIL.
- [ ] **Step 3: Wire it.** Mount the light with the void (Task 6) and pose both from `handover.pose`. With the scroll at rest, nothing animates by clock, so the canvas sleeps (`motion` stays false).
- [ ] **Step 4: Run it, build, and look.**
  - Command: `npx vitest run && npm run build && PORT=4421 npm run preview`.
  - In the in-app browser (3D off there) and in the harness's headless Edge (Task 13 `light-dive`), compare desk stills at way frames 20, 60, 121, 241 and 280 with the mock-up's `frames/way-desk/` at the same frames. Expected: the same composition. The light is within 6 px of the data's `light`.
- [ ] **Step 5: Commit.** Message: `scene: the way in and the fall: the needle becomes the light, the void opens round it`.

### Task 9: The ring on screen, and opening a project from it

**Files:**
- Modify: `src/scene/bob/Void.tsx`, `src/engine/bob/build/beads.ts`, `src/ui/BeadLabel.tsx`, `src/scene/bob/focus.ts`.
- Test: `tests/unit/bob/build-beads.test.ts`, `tests/unit/ui/bead-label.test.ts`, `tests/unit/scene/bob-focus.test.ts`.

**Interfaces:**
- `BeadsModel.setFacing(id, towards: THREE.Vector3Like)`: the porthole (+z) turned to the point. The hover's 8° turn stays on top.
- Each frame in the landing and the ring:
  - `beads.place(position by id)`, from `beadsAt` and `ringBeads`, which include the lift and the rise;
  - `setFacing(id, the camera)`;
  - `setLit(id, lit)`, the closeness: front 1, the others the beads' dim;
  - `compass.setNeedleWorld(ringNeedle(angle))`, or `wayNeedle(f)` in the landing;
  - `compass.setNeedleGlow`, from 2.5 at the arrival down to the rest glow by frame 296.
- `showBeadLabel({ id, ndc, radius, rest })`, with `rest` true while the ring stands still (the shown place on its target) and `pose.at.project !== null`.
- A click or Enter on the label opens that bead (`onOpen`). The flight goes into `focusShotFor(id)` (Task 3). Back returns to the bead's ring stop.

- [ ] **Step 1: Write the failing tests.**
  - `setFacing turns the porthole to the camera`: the root's +z points at the given point within 0.5°.
  - `the label shows only when the ring stands still within 20° of a project`: `showBeadLabel` is given null at angle 60, and the bead at 18° and 222°.
  - `the label is focusable only when shown`: the label link has `tabindex="-1"` and `inert` while hidden.
  - `the flight from the ring ends at the bead's close view`: `focusPoseAt` at the move's end equals `focusShotFor(id)`.
- [ ] **Step 2: Run them.**
  - Command: `npx vitest run tests/unit/bob tests/unit/ui tests/unit/scene`.
  - Expected: FAIL.
- [ ] **Step 3: Implement it.** Keep the hover, the objects' clocks for the front or hovered bead, and the inner lights' stand-ins as they are.
- [ ] **Step 4: Run them.** Command: `npx vitest run`. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `scene: the ring: the beads round the needle, the camera round them, the front bead's label and its door`.

### Task 10: The facts beside the light

**Files:**
- Create: `src/ui/LightFacts.tsx`, which is the DOM layer (as BeadLabel is), and its pure placement `src/ui/factPlace.ts`.
- Modify: `src/i18n/nl.ts`, `src/i18n/en.ts` (`lightDive.facts`, `lightDive.skip`).
- Modify: `src/app/routes/home.tsx` (the server-rendered list) and `src/styles/base.css`.
- Test: `tests/unit/ui/light-facts.test.ts`, `tests/unit/home-page.test.ts`, `tests/unit/needle-copy.test.ts`.

**Interfaces:**
- `placeFact(light: { x: number; y: number }, index: number, side: -1 | 1, viewport: { w: number; h: number }): { line: Rect; words: { x: number; y: number; align: 'left' | 'right' | 'center' } }`, all in CSS px:
  - **desk** (aspect ≥ 1): level with the light, on the side away from `side`. `off`, `len` and `gap` are 65, 72 and 14 frame px of a 1440-wide frame, scaled by `w/1440`.
  - **phone** (aspect < 1): below the light. `off`, `len`, `gap` and `aside` are 100, 88, 14 and 24 of a 585-wide frame, scaled by `w/585`. The line steps `aside` away from the move, and the words are centred under it, held inside the 16 px margins.
- `showLightFacts(view: { index: number | null; opacity: number; glow: number; light: NDC } | null)`, written each frame by the Void from the pose.
- Copy: `t.lightDive.facts: readonly [string, string, string, string, string]`, the table's NL and EN, with "/" as a line break; `t.lightDive.skip`.
- SSR:
  - `<ol class="light-facts">` in the home page before `.home-nav`, one `<li>` per fact;
  - visually hidden with 3D on, as `.home-nav` is;
  - in the flow with 3D off, no WebGL, or the fallback card.

- [ ] **Step 1: Write the failing tests.**
  - `the facts are the table's, verbatim, NL and EN`.
  - `placeFact desk puts the words on the side away from the move` (0.40 / 0.60 at 1440×900, as the mock-up's 81 and 121).
  - `placeFact phone steps the line aside and centres the words below the tail's end` at 390×844.
  - `placeFact at a changed aspect keeps the label on the light` (1366×657, then 844×390).
  - `the home page server-renders the five facts as a list`, and it is visually hidden with 3D on.
- [ ] **Step 2: Run them.**
  - Command: `npx vitest run tests/unit/ui tests/unit/home-page.test.ts tests/unit/needle-copy.test.ts`.
  - Expected: FAIL.
- [ ] **Step 3: Implement it.**
  - The labels' CSS is the mock-up's `.fact` styles (`mockup.css`), carried into base.css under `.light-fact`: Martian Mono 300, caps, 0.22em, the number above, the gold line, and the glow as `--glow`.
  - No inline style attributes, because of the CSP: the transform is set through the CSSOM, as BeadLabel does.
- [ ] **Step 4: Run them.** Command: `npx vitest run`. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `ui: Bob's five facts beside the light, and as a list for readers and 3D off`.

### Task 11: The skip button and the end sheet

**Files:**
- Create: `src/ui/SkipButton.tsx`.
- Modify: `src/scene/bob/endView.ts` (the share is the pose's `sheet`), `src/styles/base.css`, `src/app/routes/home.tsx`, `src/input/useHomeScroll.ts`.
- Test: `tests/unit/scene/bob-end-view.test.ts`, `tests/unit/ui/end-page.test.ts`, `tests/unit/ui/skip-button.test.ts`.

**Interfaces:**
- `endViewFor(sheet, progress, target, end)`. Its fields are unchanged; `--end` is the sheet's share.
- The CSS: `html[data-end='moving'] .end-page { transform: translateY(calc((1 - var(--end)) * 100%)); }`.
  - The page is opaque over the scene, so the night overlay (`.scene-host::after`) is removed.
  - At `data-end='rest'` it is the ordinary page in the flow, as now.
- `SkipButton`: a `<button>` whose text is `t.lightDive.skip`.
  - It shows only while `pose.at.stretch === 'ring'`. Its visibility comes from `<html data-ring>`, which the Void writes.
  - It sits at the bottom right above the safe area. When it would overlap the front bead's label, it takes the alternate place, as `mockup.js`'s `placement` does.
  - Its click calls `goToEnd()`, which is the step fade to the end, and the focus goes to the end page's title (`focusEndOnArrival`).

- [ ] **Step 1: Write the failing tests.**
  - `the sheet slides from below`: `--end` 0.25 gives a transform of 75 % (computed in jsdom from the rule).
  - `the end page at rest is in the flow, scrolling natively`, unchanged.
  - `the skip button shows only in the ring` (`data-ring` set and unset), `its text is NL and EN`, and `it fades to the end and focuses the title`.
  - `the skip button never covers the label`: with the label's rect overlapping the pill's place, the pill takes its alternate place.
- [ ] **Step 2: Run them.**
  - Command: `npx vitest run tests/unit/ui tests/unit/scene/bob-end-view.test.ts`.
  - Expected: FAIL.
- [ ] **Step 3: Implement it.** Remove the "into the night" rules (`base.css` 1609–1725's night overlay and the 40vh rise). Keep `data-end`, the yields and `endArrival`.
- [ ] **Step 4: Run them.** Command: `npx vitest run`. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `ui: the end page slides up from below as a sheet; the skip button in the ring`.

### Task 12: Reduced motion, 3D off and a failed void

**Files:**
- Modify: `src/scene/bob/stepFade.ts`, `src/scene/bob/Home.tsx`, `src/scene/bob/Void.tsx`, `src/styles/base.css`.
- Test: `tests/unit/scene/bob-step-fade.test.ts`, `tests/unit/scene/bob-void.test.ts`.

**Interfaces:**
- **Reduced motion.**
  - The story stands only on `keyStops`: BOB from above, each fact at its peak with the light still, each project, the end. It moves between them by the step fade.
  - The light is shown still at each fact's frame; it does not fall.
  - The sheet appears by the fade.
- **3D off.** The facts list and the project links show in the flow (Task 10's CSS).
- **A failed void (the beads' file).**
  - The way in and the fall still play, and the story holds at `LANDING_HOLD`.
  - The home nav shows there with its "Vragen & contact" link (`html[data-void='failed']`).
  - The skip button never shows.

- [ ] **Step 1: Write the failing tests.**
  - `reduced motion stands on keyStops with no frame between`.
  - `a failed void holds at LANDING_HOLD and shows the home nav`.
  - `the skip button is hidden with the void failed`.
- [ ] **Step 2: Run them.**
  - Command: `npx vitest run tests/unit/scene`.
  - Expected: FAIL.
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Run them.** Command: `npx vitest run`. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `scene: reduced motion steps through the facts and the ring; a failed void holds before the landing`.

### Task 13: The harness proves it by real input

**Files:**
- Modify: `src/debug/needleDebug.ts`: the bridge reports the journey's `frame`, `angle` and `sheet` and the light's projected point.
- Modify: `tools/proof/needle.mjs`.
  - Retire `scroll-bob`'s dive, `void-journey`, `void-stops` and `void-paths`.
  - Add `light-dive`, `light-facts`, `ring`, `ring-drag` and `sheet`.
  - Update `void-hold`, `void-fail`, `end-page`, `keyboard`, `reduced-motion`, `bead-open`, `stills`, `no-webgl`, `resize`, `fps` and `sleep`.

**Interfaces.** The steps read `window.__needleDebug()` (the debug bridge under `?proof`: `frame.journey`, progress and target) as the existing steps do. The bridge gains the journey's `frame`, `angle` and `sheet` and the light's projected point. Each step runs at 1440×900 and 390×844 (touch), and the three-size steps at 1366×657 too.

- [ ] **Step 1: Write the steps.**
  - **`light-dive`:**
    - from BOB from above, wheel notches run frames 1→300, monotone;
    - the light's screen position (the pose projected) is within 6 px of `tests/fixtures/light-dive/way-<size>.json` at frames 20, 60, 121, 241 and 280;
    - the camera's azimuth turns on at the orbit rate across 300 (no stop at Funcial);
    - scrolling up runs it back;
    - stopping mid-fall rests there, and the canvas sleeps within 1 s.
  - **`light-facts`:**
    - one label at a time, in order 01–05, NL then EN;
    - font sizes ≥ 13 and ≥ 11 px;
    - the label on the side away from the move on desk;
    - on the phone below, the line aside, and the frame under the line dark (mean luma ≤ 0.05, the mock-up's check).
  - **`ring`:**
    - a slow wheel turns the ring continuously and rests where the input stops (60° stays 60° for 2 s, with no label);
    - the needle points at the front bead at 0, 120 and 240;
    - nothing touches a bead (needle tips ≥ 8 px clear of every bead's outline);
    - the label shows within 20° when still.
  - **`ring-drag`:**
    - a 300 px mouse drag and a sideways swipe move the ring 75°;
    - it stops at Cookies Clicker;
    - nothing settles on release.
  - **`sheet`:**
    - a notch past Cookies finishes up within 1.5 s, never slower than half its start speed before 0.9;
    - a notch back from part-way finishes down;
    - at rest the page scrolls natively;
    - at its top, an input up takes it back down.
  - **`void-hold`:** with the beads' file delayed by a route, the story holds at LANDING_HOLD, the light still, and goes on once ready.
  - **`void-fail`:** with the file failed, the hold and the home nav; no skip button.
  - **`keyboard`:**
    - arrows step facts and projects; End and Home fade;
    - Tab reaches the front bead's label, then the skip button;
    - Enter on the skip button moves the focus to the end title.
  - **`reduced-motion`:** steps only at keyStops, by fades.
  - **`bead-open`:** opening Jontai Energy from the ring and coming Back lands at 5 with Jontai in front and its label shown.
  - **`stills`:** the luma gate on the light dive's and the ring's stills (way frames 60, 121, 241, 280; ring 0, 80, 160).
  - **`resize`:** a portrait resize mid-fall keeps the frame and the label on the light.
- [ ] **Step 2: Run them against the build.**
  - Commands: `npm run build`, `PORT=4421 npm run preview` (background), then `PLAYWRIGHT_CORE=… BASE=http://localhost:4421 node tools/proof/needle.mjs`.
  - Expected: every step PASS. A step that fails on `ERR_NO_BUFFER_SPACE` is re-run alone.
- [ ] **Step 3: Commit.** Message: `proof: the light dive, the facts, the ring, its drag and the sheet, by real input at three sizes`.

### Task 14: The gates, and Bob's review

**Files:**
- Create, untracked: `.superpowers/light-dive-site-review/review.html` in the main checkout, with stills and recordings from the build.

- [ ] **Step 1: Run every gate.**
  - Commands: `npx vitest run`, `npm run typecheck`, `npm run build`, the auditor (`"/c/Program Files (x86)/Steam/steamapps/common/Blender/5.2/python/bin/python.exe" -I tools/site_audit.py dist/client`), and the full harness.
  - Expected: all PASS.
- [ ] **Step 2: Record the site.** Use the harness's headless Edge at 1440×900 and 390×844: one continuous scroll from BOB from above through the ring to the end page, as the mock-up's video did. Put stills beside the mock-up's at the same frames.
- [ ] **Step 3: Write `review.html` for Bob**, formal and plain:
  - what is built;
  - how it differs from the mock-up, if anywhere;
  - the open calls carried over from the mock-up's review page;
  - how to see it (`npm run preview`, port 4421).
- [ ] **Step 4: Commit any remaining tracked changes** with message `docs: the light dive in the site, for Bob's review`, then stop for Bob's OK. Nothing is merged or pushed without it.
