# Needle v3, milestone 2: the loader and the home — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace milestone 1's placeholder compass with v3's opening. A dark, misty loader engraves ON into a chip while its 64 pins light up as progress, powers on, and bends its circuit into a glass-ring compass. The home then stands over the glowing chip city, with three constellations orbiting the compass and a needle that follows the cursor and lights the constellation it points at.

**Architecture:** The geometry and the timing that can be stated as numbers live in pure, node-tested modules under `src/engine/v3/`: the ring and hexagram tables, the chip, the ON strokes, the loader timeline, the traces, the constellations, the aim, the shots and the city. Three.js builders under `src/engine/v3/build/` turn them into objects, each with a `dispose()`. R3F components under `src/scene/v3/` host the builders inside milestone 1's persistent `<Canvas>`, which keeps its demand frame loop and its proof bridge. Scroll, routes, Lite and contact stay as milestone 1 left them. The descent into the chip is milestone 4.

**Tech Stack:** React Router 8.5 (prerendered NL/EN), React 19.3, @react-three/fiber 9.8.2, drei 10.7.9, @react-three/postprocessing 3.2.1 (postprocessing 6.39.5), three 0.186.1, maath 0.10.8, zustand 5.0.15, Vitest 5 (node), TypeScript 7, the headless-Edge proof harness `tools/proof/needle.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-20-needle-v3-design.md` (approved by Bob 2026-10-20). Read §2.1, §2.2, §4 and §5 before any task. The concept frames are in `docs/design/needle-v3/`: `01`–`03` for the loader, `04`–`05` for the home.

---

## Where this milestone sits

Bob reviews each milestone from screenshots before the next is planned (spec §5, Process):

| Milestone | What | Plan |
| --- | --- | --- |
| **M2 (this plan)** | loader, home compass, constellations, needle, pointing | here |
| M3 | country click → card → fly-through, the China page (Bob picks its backdrop first) | after Bob's M2 review |
| M4 | scroll: rings open, descent into the chip, the void, the beads; replaces the DISSECT/MORPH/VOID_ENTRY chapters with DESCENT | later |
| M5 | project pages, test points, Look inside | later |
| M6 | the Netherlands and Aruba worlds, the Lite/contact restyle, sound, polish, launch | later |

Until M4, scrolling on the home page changes the phase as milestone 1 does, but the camera stays on the home view. This is known and accepted for M2's review.

## Global Constraints

- **Branch:** work in a worktree on a new branch `needle-v3-m2`, cut from `redesign-bench` at or after `92f21c7`. Never push, and never merge into `main` or `redesign-bench` without Bob's OK.
- **No new dependencies.** Everything needed is in `package.json`. Ask before adding any package, runtime or dev.
- **Banned imports** (`tests/unit/scene/banned-imports.test.ts`): drei `Text`, `Text3D`, `Environment`, `useGLTF`; three's own post-processing; lenis; troika. drei `Html` is allowed.
- **CSP stays as milestone 1 left it.** M2 ships no compressed assets, wasm or workers, and makes no `eval`.
- **Every letter and symbol is real** (spec §1). ON is drawn from the stroke table of Task 2. 北 東 南 西 come from `GLYPHS` (`src/engine/instrument/glyphs.ts`). The trigrams come from `TRIGRAMS` (`src/engine/instrument/dialSpec.ts`) and the 64 hexagrams are computed in Task 1. No other text is drawn in the canvas.
- **Copy:** the loader has no text but the engraved ON. The home shows BOB CHUNG, FOLLOW THE NEEDLE (NL: VOLG DE NAALD) and the scroll cue, all from `t.needle.hero`, plus a constellation's name from `t.needle.countries[id].name`, shown only while the needle points at it.
- **Directions** (spec §2.2): China east, bearing 90°; the Netherlands north, 0°; Aruba west, 270°. The dial convention is `src/engine/instrument/dialSpec.ts`: north −Z, east +X, `onDial` and `bearingOf`.
- **Restraint** (spec §4): one focal point per scene, sparse bloom and particles, unselected constellations dim, and darker and calmer than the concept frames. It is measured by the luminance gate in Task 14:
  - home: mean luma ≤ 0.11
  - loader stills: mean luma ≤ 0.07
  - pixels at luma ≥ 0.98: ≤ 0.4 % of the frame
- **Colour:** `src/engine/palette.ts`. The constellation tints are the country accents in `src/data/directions.ts` (`#a8352a`, `#1d5fa8`, `#2db3a8`).
- **Performance:** 60 fps on the fine-pointer ladder's first rung and ≥ 30 on the coarse one, using the existing quality ladder (`src/engine/quality.ts`) and tiers.
  - The canvas stops drawing once still: idle motion runs for `IDLE_SECONDS = 12` after the last input, then the scene sleeps (`src/scene/Heartbeat.tsx`).
- **Reduced motion:** no laser motion, no spring overshoot, no parallax and no twinkle. The loader becomes a static engraved chip with its pins filling, then a fade.
- **Verification:** each task must pass these:
  - `npm test`
  - `npm run typecheck`
  - `npm run build`
  - the auditor, run through Pyodide with `node C:/Users/bhcco/AppData/Local/Temp/claude/C--Users-bhcco-Downloads-Portfolio-bob/08ba728b-ecc5-49f9-ab55-b47115795366/scratchpad/audit-needle.mjs C:/Users/bhcco/Downloads/Portfolio-bob/.claude/worktrees/needle-v3-m2`, run after `npm run build`. The path argument is required: the runner's default is a deleted worktree. Python is not installed. It must report 0 errors.

  Tasks 12–15 also run the proof harness:
  - Start the server with `node tools/serve-pages.mjs` (port 4399).
  - Run `node tools/proof/needle.mjs` with `PLAYWRIGHT_CORE=C:/Users/bhcco/AppData/Local/Temp/claude/C--Users-bhcco-Downloads-Portfolio-bob/b56617be-0033-4513-b033-50ad14c6b88d/scratchpad/edge-check/node_modules/playwright-core`, in headless Edge.
- **Code style:** match the repo: JSDoc on every export, explaining *why*; `~/` imports in `src` and `tests`; tests in `tests/unit/**` (node environment).

## Review Focus

The five conditions the spec implies but does not spell out, most likely first. Each has its test in the owning task:

1. **A slow or stuck load.** The engraving and the pins never get ahead of the real load: the ON is never complete while the compass is still loading. If the compass has not loaded after `LOADER.giveUp` = 15 s of visible time, the scene fails over to the fallback card. → Task 3, `loader-slow` and `loader-gives-up` tests.
2. **A background tab during the loader.** Time spent hidden is not counted, so a returning visitor sees the sequence continue rather than jump to the end. → Task 3, `advanceClock` tests.
3. **A portrait phone.** At 390 × 844 the whole rim and each constellation's centre are in frame. On touch the needle drifts between the three constellations without a pointer. → Task 6 framing tests, Task 7 `touchDrift` tests.
4. **The pointer in the sky, at the edge or gone.** A cursor above the horizon, in a corner or over the header still gives a finite bearing. A pointer that leaves the window keeps the last one. Neither produces NaN. → Task 7 `pointerBearing` edge tests; Task 12b keeps the last bearing.
5. **A second load in the same visit.** A reload plays the quick path: dark, then a 0.8 s landing, with no engraving. A new session plays it all. Storage that throws (private mode) counts as "not seen" and never crashes. → Task 3 `loaderSeen` tests, Task 14 `quick-loader` step.

---

## File structure

**Create (pure, node-tested):**
- `src/engine/v3/compassSpec.ts`: the glass rings, the hub and the 64 hexagrams.
- `src/engine/v3/chipSpec.ts`: the chip, its 64 pins, the ON strokes and the engraving reveal.
- `src/engine/v3/loaderTimeline.ts`: the loader's stages, its clock, the session's "seen" flag and the give-up.
- `src/engine/v3/traces.ts`: the 64 traces, from board paths to ring arcs.
- `src/engine/v3/constellations.ts`: the three figures, their 3D placement, bearing ranges and pointing.
- `src/engine/v3/aim.ts`: pointer → bearing, the needle spring constants and the touch drift.
- `src/engine/v3/shots.ts`: the camera shots and framing for each aspect.
- `src/engine/v3/chipCity.ts`: the city's block layout under the glass.
- `src/engine/v3/paintRings.ts`: the engraving masks for the rings.

**Create (three.js builders):** `src/engine/v3/build/chip.ts`, `laser.ts`, `traces.ts`, `glassCompass.ts`, `needle.ts`, `city.ts`, `constellations.ts`, `mist.ts`, `sky.ts`, `room.ts`.

**Create (R3F):** `src/scene/v3/Opening.tsx` (the loader and readiness), `src/scene/v3/openingPose.ts` (its pure camera helper), `src/scene/v3/Home.tsx` (needle, pointing, labels, idle), `src/scene/v3/look.ts` (exposure, bloom, vignette and fog constants).

**Modify:**
- `src/scene/Stage.tsx`, `Rig.tsx`, `Studio.tsx`, `Effects.tsx`, `Heartbeat.tsx`, `motion.ts`, `SceneHost.tsx`
- `src/ui/Poster.tsx`
- `src/app/Shell.tsx`, `src/state/frame.ts`
- `src/debug/needleDebug.ts`, `src/debug/useNeedleDebug.ts`
- `src/styles/base.css`
- `tools/proof/needle.mjs`, `tools/proof/README.md`

**Delete (Task 15):** milestone 1's placeholder compass, `src/scene/Compass.tsx`, together with the revision-4 engine modules and tests that nothing imports after the swap.

---

### Task 1: Glass rings and hexagrams

**Files:**
- Create: `src/engine/v3/compassSpec.ts`
- Test: `tests/unit/v3/compass-spec.test.ts`

**Interfaces:**
- Consumes: `DIAL`, `TRIGRAMS` from `~/engine/instrument/dialSpec`.
- Produces:
  - `type RingId = 'trigram' | 'direction' | 'degree' | 'hexagram'`
  - `interface GlassRing { id: RingId; inner: number; outer: number; y: number; thickness: number }`
  - `GLASS_RINGS: readonly GlassRing[]`
  - `HUB: { radius: number; y: number }`
  - `type HexLines = readonly [0|1, 0|1, 0|1, 0|1, 0|1, 0|1]`
  - `hexagramLines(k: number): HexLines`
  - `HEXAGRAMS: readonly { k: number; bearing: number; lines: HexLines }[]`

**Values:**
- The rings take `DIAL.rings`' radii: trigram 0.24–0.40, direction 0.42–0.56, degree 0.58–0.70, hexagram 0.72–1.00.
- `y`: trigram 0.036, direction 0.012, degree 0.024, hexagram 0.0. `thickness` is 0.018 for every ring.
- `HUB = { radius: 0.2, y: 0.05 }`.
- Hexagram `k` sits at bearing `k * 360 / 64` degrees, clockwise from north.
- `hexagramLines(k)`: bit `i` of `k` is line `i`, counted from the bottom (innermost); 1 is a whole line.
  - The doc comment says this is the binary (Shao Yong / Fu Xi) sequence placed round the ring. It is *not* a claim of a specific traditional circular diagram.
  - It also says the ring mirrors the chip's 64 pins, the reason it is there.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { GLASS_RINGS, HEXAGRAMS, HUB, hexagramLines } from '~/engine/v3/compassSpec';

describe('GLASS_RINGS', () => {
  it('runs inside out with a gap of at least 0.015 between rings, outside the hub', () => {
    expect(GLASS_RINGS.map((r) => r.id)).toEqual(['trigram', 'direction', 'degree', 'hexagram']);
    expect(GLASS_RINGS[0].inner).toBeGreaterThan(HUB.radius);
    for (let i = 1; i < GLASS_RINGS.length; i++) expect(GLASS_RINGS[i].inner - GLASS_RINGS[i - 1].outer).toBeGreaterThanOrEqual(0.015);
  });
  it('stands the rings at different heights, so they read as separate layers', () => {
    expect(new Set(GLASS_RINGS.map((r) => r.y)).size).toBe(GLASS_RINGS.length);
  });
});

describe('the hexagram ring', () => {
  it('holds all 64 hexagrams once, 5.625 degrees apart', () => {
    expect(HEXAGRAMS).toHaveLength(64);
    expect(new Set(HEXAGRAMS.map((h) => h.lines.join(''))).size).toBe(64);
    HEXAGRAMS.forEach((h, k) => expect(h.bearing).toBeCloseTo(k * 5.625, 9));
  });
  it('reads line i from bit i, bottom first: 0 is all broken (Kun), 63 all whole (Qian)', () => {
    expect(hexagramLines(0)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(hexagramLines(63)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(hexagramLines(1)).toEqual([1, 0, 0, 0, 0, 0]);
  });
  it('refuses a k outside 0..63', () => {
    expect(() => hexagramLines(64)).toThrow(RangeError);
    expect(() => hexagramLines(-1)).toThrow(RangeError);
    expect(() => hexagramLines(1.5)).toThrow(RangeError);
  });
});
```

- [ ] **Step 2:** Run `npx vitest run tests/unit/v3/compass-spec.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement `src/engine/v3/compassSpec.ts` with the values above. It imports nothing from three.
- [ ] **Step 4:** Run the test again. Expected: PASS.
- [ ] **Step 5:** Commit: `git add src/engine/v3/compassSpec.ts tests/unit/v3/compass-spec.test.ts && git commit -m "v3: the glass rings and the hexagram ring"`

---

### Task 2: Chip, pins and the ON strokes

**Files:**
- Create: `src/engine/v3/chipSpec.ts`
- Test: `tests/unit/v3/chip-spec.test.ts`

**Interfaces:**
- Produces:
  - `CHIP: { size: 0.28; height: 0.035; board: -0.15; pinsPerSide: 16; pinLength: 0.025; pinWidth: 0.008 }` (world units; the chip sits on the board plane `y = CHIP.board` at the compass centre, under the hub)
  - `PIN_COUNT = 64`
  - `pinPosition(i: number): { x: number; z: number; side: 'top' | 'right' | 'bottom' | 'left' }`: clockwise from the top side's left end, 16 per side, evenly spaced along the side with half a pitch at each end.
  - `pinsLit(progress: number): number`: `Math.floor(clamp01(progress) * 64)`, except that it returns 64 only when `progress >= 1`; NaN gives 0.
  - `type Point2 = readonly [x: number, z: number]`; `interface Stroke { points: readonly Point2[] }`
  - `ON_STROKES: readonly Stroke[]`: in the chip's top plane, x right, z toward the viewer, fitting inside `|x| ≤ 0.11, |z| ≤ 0.07`:
    - O: one closed loop, an ellipse centred (−0.055, 0) with rx 0.045 and rz 0.065, 48 points, first point repeated last.
    - N: three strokes, in this order:
      1. left vertical, x 0.02, z +0.065 → −0.065
      2. diagonal (0.02, −0.065) → (0.10, +0.065)
      3. right vertical, x 0.10, z +0.065 → −0.065
  - `strokeLengths(strokes: readonly Stroke[]): number[]`
  - `engraved(strokes: readonly Stroke[], t: number): number[]`: each stroke's revealed fraction (0..1) when `t` of the total length is cut. The strokes are cut in order: a stroke starts only when the one before it is complete.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { CHIP, engraved, ON_STROKES, PIN_COUNT, pinPosition, pinsLit, strokeLengths } from '~/engine/v3/chipSpec';

describe('pins', () => {
  it('has 64 distinct pins, 16 per side, all outside the chip body', () => {
    const seen = new Set<string>();
    const sides: Record<string, number> = {};
    for (let i = 0; i < PIN_COUNT; i++) {
      const p = pinPosition(i);
      seen.add(`${p.x.toFixed(5)},${p.z.toFixed(5)}`);
      sides[p.side] = (sides[p.side] ?? 0) + 1;
      expect(Math.max(Math.abs(p.x), Math.abs(p.z))).toBeGreaterThan(CHIP.size / 2);
    }
    expect(seen.size).toBe(64);
    expect(sides).toEqual({ top: 16, right: 16, bottom: 16, left: 16 });
  });
  it('lights pins with progress and reaches 64 only at 1', () => {
    expect(pinsLit(0)).toBe(0);
    expect(pinsLit(0.5)).toBe(32);
    expect(pinsLit(0.9999)).toBe(63);
    expect(pinsLit(1)).toBe(64);
    expect(pinsLit(Number.NaN)).toBe(0);
    expect(pinsLit(7)).toBe(64);
  });
});

describe('the ON strokes', () => {
  it('are the O (one loop) then the three strokes of the N', () => {
    expect(ON_STROKES).toHaveLength(4);
    const o = ON_STROKES[0].points;
    expect(o[0]).toEqual(o[o.length - 1]);
  });
  it('cut in order: nothing at 0, all at 1, half the length at 0.5', () => {
    const lengths = strokeLengths(ON_STROKES);
    const total = lengths.reduce((a, b) => a + b, 0);
    expect(engraved(ON_STROKES, 0)).toEqual([0, 0, 0, 0]);
    expect(engraved(ON_STROKES, 1)).toEqual([1, 1, 1, 1]);
    const half = engraved(ON_STROKES, 0.5);
    expect(half.reduce((sum, f, i) => sum + f * lengths[i], 0)).toBeCloseTo(total / 2, 9);
    for (let i = 1; i < half.length; i++) if (half[i] > 0) expect(half[i - 1]).toBe(1);
  });
});
```

- [ ] **Step 2:** Run the test. Expected: FAIL.
- [ ] **Step 3:** Implement `chipSpec.ts` to the values above. It does not import three.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit: `v3: the chip, its 64 pins and the ON strokes`

---

### Task 3: The loader's timeline

**Files:**
- Create: `src/engine/v3/loaderTimeline.ts`
- Test: `tests/unit/v3/loader-timeline.test.ts`

**Interfaces:**
- Consumes: `pinsLit` (Task 2); `readout` from `~/engine/loading`; `SafeStorage` from `~/engine/core/SafeStorage`.
- Produces:
  - `type LoaderStage = 'dark' | 'engrave' | 'power' | 'circuit' | 'land' | 'home'`
  - `LOADER = { engraveMin: 2.2, power: 0.9, circuit: 1.6, land: 1.3, quick: 0.8, reducedHold: 1.0, reducedFade: 0.6, giveUp: 15, maxStep: 0.1 }` (seconds)
  - `LOADER_SEEN_KEY = 'needle-loader-seen'`
  - `interface LoaderInput { elapsed: number; shown: number; loadedAt: number | null; quick: boolean; reduced: boolean }`:
    - `elapsed`: visible seconds since the loader began.
    - `shown`: the smoothed load share, 0..1, from `readout`.
    - `loadedAt`: the `elapsed` at which `shown` first reached 1.
  - `interface LoaderClock { stage: LoaderStage; local: number; engraving: number; pins: number }`: `local` is 0..1 through the stage; `engraving` 0..1 is how much of ON is cut; `pins` is 0..64.
  - `loaderAt(input: LoaderInput): LoaderClock`
  - `advanceClock(elapsed: number, dt: number): number`: `elapsed + clamp(dt, 0, LOADER.maxStep)`. A hidden tab draws no frames, and a long first frame after it counts as `maxStep` at most.
  - `loaderGaveUp(elapsed: number, loadedAt: number | null): boolean`: `loadedAt === null && elapsed >= LOADER.giveUp`.
  - `loaderSeen(storage: SafeStorage): boolean` and `markLoaderSeen(storage: SafeStorage): void`, both through `SafeStorage.session()` at runtime.

**Rules:**
- **Full path:**
  - Before the load completes, the stage is `engrave`, with `engraving = min(shown, elapsed / engraveMin)` and `pins = pinsLit(shown)`.
  - Engraving ends at `E = max(engraveMin, loadedAt)`.
  - Then `power` runs over `[E, E + power)`, `circuit` over `[.., + circuit)` and `land` over `[.., + land)`, and the stage is `home` after that.
  - From `power` on, `engraving = 1` and `pins = 64`.
- **Quick path** (`quick`, the loader was seen this session): `dark` until loaded, then `land` for `LOADER.quick` from `loadedAt`, then `home`. Its `engraving` and `pins` are 0.
- **Reduced motion:**
  - The stage is `engrave` with `engraving = 1` (a static ON) and `pins = pinsLit(shown)`.
  - Once loaded and `elapsed ≥ reducedHold`, `land` runs for `reducedFade`, then `home`.
  - There is never `power` or `circuit`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { advanceClock, LOADER, loaderAt, loaderGaveUp, loaderSeen, markLoaderSeen } from '~/engine/v3/loaderTimeline';
import { SafeStorage } from '~/engine/core/SafeStorage';

const base = { quick: false, reduced: false };

describe('loaderAt, the full path', () => {
  it('loader-slow: never cuts ahead of the load, however long it takes', () => {
    const c = loaderAt({ ...base, elapsed: 30, shown: 0.4, loadedAt: null });
    expect(c.stage).toBe('engrave');
    expect(c.engraving).toBeCloseTo(0.4, 9);
    expect(c.pins).toBe(25);
  });
  it('never cuts faster than the minimum, however fast the load', () => {
    const c = loaderAt({ ...base, elapsed: 1.1, shown: 1, loadedAt: 0.3 });
    expect(c.stage).toBe('engrave');
    expect(c.engraving).toBeCloseTo(0.5, 9);
  });
  it('runs power, circuit, land, home after the engraving', () => {
    const at = (elapsed: number) => loaderAt({ ...base, elapsed, shown: 1, loadedAt: 1 }).stage;
    const e = LOADER.engraveMin;
    expect(at(e + 0.1)).toBe('power');
    expect(at(e + LOADER.power + 0.1)).toBe('circuit');
    expect(at(e + LOADER.power + LOADER.circuit + 0.1)).toBe('land');
    expect(at(e + LOADER.power + LOADER.circuit + LOADER.land + 0.01)).toBe('home');
  });
});

describe('the quick and reduced paths', () => {
  it('quick: dark until loaded, then a short landing, no engraving', () => {
    expect(loaderAt({ ...base, quick: true, elapsed: 2, shown: 0.6, loadedAt: null })).toMatchObject({ stage: 'dark', engraving: 0, pins: 0 });
    expect(loaderAt({ ...base, quick: true, elapsed: 2.2, shown: 1, loadedAt: 2 }).stage).toBe('land');
    expect(loaderAt({ ...base, quick: true, elapsed: 2 + LOADER.quick + 0.01, shown: 1, loadedAt: 2 }).stage).toBe('home');
  });
  it('reduced: a static ON, pins with the load, then a fade; never power or circuit', () => {
    expect(loaderAt({ ...base, reduced: true, elapsed: 0.2, shown: 0.5, loadedAt: null })).toMatchObject({ stage: 'engrave', engraving: 1, pins: 32 });
    const stages = [0.5, 1.05, 1.5, 3].map((elapsed) => loaderAt({ ...base, reduced: true, elapsed, shown: 1, loadedAt: 0.4 }).stage);
    expect(stages).toEqual(['engrave', 'land', 'land', 'home']);
  });
});

describe('time and giving up', () => {
  it('advanceClock: a hidden tab does not count, and one long frame counts as 0.1 s at most', () => {
    expect(advanceClock(1, 12)).toBeCloseTo(1.1, 9);
    expect(advanceClock(1, -3)).toBe(1);
  });
  it('loader-gives-up: at 15 visible seconds without the load', () => {
    expect(loaderGaveUp(14.9, null)).toBe(false);
    expect(loaderGaveUp(15, null)).toBe(true);
    expect(loaderGaveUp(40, 3)).toBe(false);
  });
  it('a storage that throws counts as not seen and does not crash', () => {
    const broken = new SafeStorage(() => { throw new Error('private mode'); });
    expect(loaderSeen(broken)).toBe(false);
    expect(() => markLoaderSeen(broken)).not.toThrow();
  });
});
```

- [ ] **Step 2:** Run the test. Expected: FAIL.
- [ ] **Step 3:** Implement `loaderTimeline.ts`. It imports nothing from three; the Stage's chunk and the small entry bundle can both read it.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit: `v3: the loader's timeline, its quick and reduced paths`

---

### Task 4: Traces that become rings

**Files:**
- Create: `src/engine/v3/traces.ts`
- Test: `tests/unit/v3/traces.test.ts`

**Interfaces:**
- Consumes: `pinPosition`, `CHIP` (Task 2); `GLASS_RINGS` (Task 1); `DIAL.rules` from `dialSpec`.
- Produces:
  - `TRACE = { count: 64, points: 48 }`
  - `boardPath(i: number): Float32Array` (48 × xyz): from pin `i` outward on the board plane (`y = CHIP.board`) in straight runs with 45° bends, the way a PCB is routed, ending between radius 0.75 and 0.98.
  - `ringPath(i: number): Float32Array` (48 × xyz): an arc at radius `DIAL.rules[i % 4]` and height `GLASS_RINGS[i % 4].y - 0.009` (just under its ring), centred on the bearing of pin `i` and spanning `360 / 16` degrees.
  - `tracePoints(i: number, t: number, out: Float32Array): Float32Array`: board → ring. Trace `i` starts after a delay of `(i % 8) / 8 * 0.35`, eases with smootherstep over the rest, and writes into `out`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { DIAL } from '~/engine/instrument/dialSpec';
import { boardPath, ringPath, TRACE, tracePoints } from '~/engine/v3/traces';

describe('traces', () => {
  it('are the board paths at 0 and the ring arcs at 1, with the same point count', () => {
    const out = new Float32Array(TRACE.points * 3);
    for (const i of [0, 17, 63]) {
      expect(Array.from(tracePoints(i, 0, out))).toEqual(Array.from(boardPath(i)));
      expect(Array.from(tracePoints(i, 1, out))).toEqual(Array.from(ringPath(i)));
    }
  });
  it('end each ring arc on its gilt rule', () => {
    const p = ringPath(5);
    for (let k = 0; k < TRACE.points; k++) expect(Math.hypot(p[k * 3], p[k * 3 + 2])).toBeCloseTo(DIAL.rules[5 % 4], 6);
  });
  it('do not all move at once: at t = 0.2 some traces are still on the board', () => {
    const out = new Float32Array(TRACE.points * 3);
    const still = [...Array(TRACE.count).keys()].filter((i) => Array.from(tracePoints(i, 0.2, out)).join() === Array.from(boardPath(i)).join());
    expect(still.length).toBeGreaterThan(0);
    expect(still.length).toBeLessThan(TRACE.count);
  });
});
```

- [ ] **Step 2:** Run the test. Expected: FAIL.
- [ ] **Step 3:** Implement `traces.ts`. Resample both paths to exactly 48 points by arc length, so the lerp is even. When a trace's local `t` is 0 or 1, copy that endpoint array as it is, rather than computing `a + (b − a)·t`, so the ends are bit-exact; the tests (and Task 10's) compare them with `toEqual`.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit: `v3: the traces that bend into the rings`

---

### Task 5: The constellations

**Files:**
- Create: `src/engine/v3/constellations.ts`
- Test: `tests/unit/v3/constellations.test.ts`

**Interfaces:**
- Consumes: `CountryId`, `countryDirection` from `~/data/directions`; `DIAL`, `bearingOf` from `dialSpec`.
- Produces:
  - `interface Figure { stars: readonly (readonly [u: number, v: number, mag: number])[]; lines: readonly (readonly [number, number])[] }`: `u` and `v` lie in 0..1 with `v` up, and `mag` (0.4..1) is the star's relative size.
  - `FIGURES: Readonly<Record<CountryId, Figure>>`:
    - china: cloud-wrapped mountains (two or three peaks and a cloud line)
    - netherlands: a sailing ship (hull, two masts, sails)
    - aruba: a divi-divi tree, its crown swept hard to one side by the wind
    - Each figure has 10–24 stars, and every star is on at least one line. The figure must read at a glance; Bob reviews it in the Task 14 stills.
  - `interface Placement { bearing: number; span: number; radius: number; base: number; height: number; swing: number }` (degrees and world units)
  - `PLACEMENTS: Readonly<Record<CountryId, Placement>>`:
    - china `{ bearing: 90, span: 46, radius: 1.42, base: 0.04, height: 0.95, swing: 38 }`
    - netherlands `{ bearing: 0, span: 30, radius: 2.7, base: 0.55, height: 0.9, swing: 0 }`
    - aruba `{ bearing: 270, span: 46, radius: 1.42, base: 0.04, height: 0.95, swing: 38 }`
  - `starPositions(id: CountryId): Float32Array`: xyz per star. The bearing is `P.bearing + (u − 0.5)·P.span`, plus `P.swing·(1 − v)²` turned toward south (180°): + for china, − for aruba. `y = P.base + v·P.height`, and xz comes from `onDial(bearing, P.radius)`.
  - `bearingRange(id: CountryId): readonly [from: number, to: number]`: radians, the span of its stars' bearings widened by 10° each side. The margin absorbs the aim's offset for the ship: the aim reads the ship's stars on the 1.42 shell, not at their 2.7 radius, so a ship star at 15° aims at about 22°.
  - `pointedAt(needle: number): CountryId | null`: the constellation whose range holds `needle` (radians), with wrap at ±π.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { COUNTRY_IDS } from '~/data/directions';
import { DIAL } from '~/engine/instrument/dialSpec';
import { bearingRange, FIGURES, pointedAt, starPositions } from '~/engine/v3/constellations';

const deg = (d: number) => (d * Math.PI) / 180;

describe('the figures', () => {
  it('have 10 to 24 stars, every star on a line, every line between real stars', () => {
    for (const id of COUNTRY_IDS) {
      const f = FIGURES[id];
      expect(f.stars.length).toBeGreaterThanOrEqual(10);
      expect(f.stars.length).toBeLessThanOrEqual(24);
      const used = new Set(f.lines.flat());
      f.lines.flat().forEach((i) => expect(i).toBeLessThan(f.stars.length));
      expect(used.size).toBe(f.stars.length);
    }
  });
});

describe('placement', () => {
  it('keeps every star outside the glass', () => {
    for (const id of COUNTRY_IDS) {
      const p = starPositions(id);
      for (let k = 0; k < p.length; k += 3) expect(Math.hypot(p[k], p[k + 2])).toBeGreaterThan(DIAL.rim + 0.15);
    }
  });
  it('wraps China and Aruba round the rim: some low stars in front of it, on the camera side', () => {
    for (const id of ['china', 'aruba'] as const) {
      const p = starPositions(id);
      let front = 0;
      for (let k = 0; k < p.length; k += 3) if (p[k + 2] > 0 && p[k + 1] < 0.3) front++;
      expect(front).toBeGreaterThanOrEqual(2);
    }
  });
  it('puts the ship beyond the far edge and above the dial', () => {
    const p = starPositions('netherlands');
    for (let k = 0; k < p.length; k += 3) {
      expect(p[k + 2]).toBeLessThan(-DIAL.rim);
      expect(p[k + 1]).toBeGreaterThan(0.2);
    }
  });
});

describe('pointedAt', () => {
  it('finds the constellation the needle points into, and none between them', () => {
    expect(pointedAt(0)).toBe('netherlands');
    expect(pointedAt(deg(90))).toBe('china');
    expect(pointedAt(deg(-90))).toBe('aruba');
    expect(pointedAt(deg(270))).toBe('aruba');
    expect(pointedAt(deg(359))).toBe('netherlands');
    expect(pointedAt(deg(45))).toBeNull();
    expect(pointedAt(Math.PI)).toBeNull();
  });
  it('has ranges that never overlap', () => {
    const [a, b, c] = COUNTRY_IDS.map(bearingRange);
    const overlaps = (x: readonly number[], y: readonly number[]) => x[0] < y[1] && y[0] < x[1];
    expect(overlaps(a, b) || overlaps(b, c) || overlaps(a, c)).toBe(false);
  });
});
```

- [ ] **Step 2:** Run the test. Expected: FAIL.
- [ ] **Step 3:** Implement `constellations.ts`. Ranges must be compared after wrapping (the Netherlands' range crosses 0); state the convention in the JSDoc.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit: `v3: the three constellations, their places round the compass and pointing`

---

### Task 6: The shots

**Files:**
- Create: `src/engine/v3/shots.ts`
- Test: `tests/unit/v3/shots.test.ts`

**Interfaces:**
- Consumes: `DIAL.rim`, `onDial`; `starPositions` (Task 5); `CHIP` (Task 2).
- Produces:
  - `interface CameraShot { position: readonly [number, number, number]; target: readonly [number, number, number]; fov: number }`
  - `SHOTS: { loaderMacro: CameraShot; loaderRise: CameraShot; home: CameraShot }`:
    - `loaderMacro`: frame 01. The chip is seen from about 50° above and slightly from the left; on landscape the chip's centre is left of centre and the right half is dark.
    - `loaderRise`: frame 03. High over the board, looking down at the rings forming.
    - `home`: frame 04. A low camera south of the compass, the whole rim in view, the constellations round it.
  - `homeShotFor(aspect: number): CameraShot`: `SHOTS.home` when `aspect >= 1`. A portrait shot pulls back and widens until the rim fits the width.
  - `lerpCameraShot(a: CameraShot, b: CameraShot, t: number): CameraShot`
  - `applyCameraShot(camera: THREE.PerspectiveCamera, shot: CameraShot, aspect: number): void`: sets fov, aspect, position and lookAt, and updates the matrices.
  - The exact numbers are the implementer's, tuned until the tests pass and the Task 14 stills match frames 01, 03 and 04.

- [ ] **Step 1: Write the failing tests**

```ts
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { COUNTRY_IDS } from '~/data/directions';
import { DIAL, onDial } from '~/engine/instrument/dialSpec';
import { starPositions } from '~/engine/v3/constellations';
import { applyCameraShot, homeShotFor, SHOTS } from '~/engine/v3/shots';

function project(aspect: number, shot = homeShotFor(aspect)) {
  const camera = new THREE.PerspectiveCamera();
  applyCameraShot(camera, shot, aspect);
  return (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).project(camera);
}
const rim = () => [...Array(72).keys()].map((k) => onDial(k * 5, DIAL.rim));
const centroid = (p: Float32Array) => {
  let x = 0, y = 0, z = 0; const n = p.length / 3;
  for (let k = 0; k < p.length; k += 3) { x += p[k]; y += p[k + 1]; z += p[k + 2]; }
  return [x / n, y / n, z / n] as const;
};

describe('the home shot', () => {
  for (const [name, aspect] of [['landscape', 1440 / 900], ['portrait', 390 / 844]] as const) {
    it(`${name}: the whole rim is in frame`, () => {
      const at = project(aspect);
      for (const [x, z] of rim()) {
        const p = at(x, 0, z);
        expect(Math.abs(p.x)).toBeLessThanOrEqual(0.98);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(0.98);
      }
    });
    it(`${name}: each constellation's centre is in frame`, () => {
      const at = project(aspect);
      for (const id of COUNTRY_IDS) {
        const p = at(...centroid(starPositions(id)));
        expect(Math.abs(p.x)).toBeLessThanOrEqual(0.95);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(0.95);
      }
    });
  }
  it('landscape: every star is in frame, as in frame 04', () => {
    const at = project(1440 / 900);
    for (const id of COUNTRY_IDS) {
      const s = starPositions(id);
      for (let k = 0; k < s.length; k += 3) {
        const p = at(s[k], s[k + 1], s[k + 2]);
        expect(Math.abs(p.x)).toBeLessThanOrEqual(0.98);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(0.98);
      }
    }
  });
});

describe('the loader shot', () => {
  it('landscape: the chip sits left of centre, the right half left dark', () => {
    const p = project(1440 / 900, SHOTS.loaderMacro)(0, -0.15, 0);
    expect(p.x).toBeGreaterThan(-0.55);
    expect(p.x).toBeLessThan(-0.1);
  });
});
```

- [ ] **Step 2:** Run the test. Expected: FAIL.
- [ ] **Step 3:** Implement `shots.ts`. It imports three for the camera only.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit: `v3: the loader and home shots, framed for landscape and portrait`

---

### Task 7: Aiming the needle

**Files:**
- Create: `src/engine/v3/aim.ts`
- Test: `tests/unit/v3/aim.test.ts`

**Interfaces:**
- Consumes: `bearingOf` (dialSpec); `PLACEMENTS`, `starPositions` (Task 5); `homeShotFor`, `applyCameraShot` (Task 6).
- Produces:
  - `pointerBearing(ndc: { x: number; y: number }, camera: THREE.PerspectiveCamera, shell: number): number | null`. It tries three rules in order:
    1. **Snap to a star.** If any constellation star (all three countries' `starPositions`) projects within `AIM_SNAP = 0.07` of `ndc`, it returns that nearest star's own bearing. The distance is measured with x scaled by `camera.aspect`, so it is round on screen. This rule comes first because the shell is a cylinder: one pixel can lie on both its near and far side. A side constellation is seen on both sides of the tangent line from the camera (about 119° for China), so geometry alone cannot tell which star the cursor means, and the stars are what the visitor aims at.
    2. **The ground.** Otherwise, if the ray from the camera through `ndc` meets the dial plane `y = 0` ahead of the camera, it returns the bearing of that point.
    3. **The sky.** Otherwise (the cursor above the horizon), it returns the bearing of the ray's far (exit) intersection with the vertical cylinder of radius `shell`, the side the cursor looks toward. It returns null only if none of the three applies.

    All bearings are `bearingOf(x, z)`. This replaces the plan's first two-rule version (Ruling 1 in the ledger).
  - `AIM_SHELL = 1.42`: the inner constellations' radius.
  - `NEEDLE_SPRING = { zeta: 0.55, omega: 3.2 }`: heavier and slower than milestone 1's 0.4/7, for Bob's "slight delay". Passed to `new AngleSpring(zeta, omega)`.
  - `touchDrift(t: number): number`, in radians:
    - It visits Netherlands → China → Netherlands → Aruba, 7 s per leg: 4.5 s resting on a constellation's bearing, then 2.5 s of smootherstep travel.
    - The cycle is 28 s and the motion is continuous.

- [ ] **Step 1: Write the failing tests**

```ts
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { AIM_SHELL, pointerBearing, touchDrift } from '~/engine/v3/aim';
import { pointedAt, starPositions } from '~/engine/v3/constellations';
import { applyCameraShot, homeShotFor } from '~/engine/v3/shots';
import { bearingOf } from '~/engine/instrument/dialSpec';

function homeCamera(aspect: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera();
  applyCameraShot(camera, homeShotFor(aspect), aspect);
  return camera;
}

describe('pointerBearing', () => {
  it('points at every China and Aruba star when the cursor is on it, high or low', () => {
    const camera = homeCamera(1440 / 900);
    for (const id of ['china', 'aruba'] as const) {
      const p = starPositions(id);
      for (let k = 0; k < p.length; k += 3) {
        const star = new THREE.Vector3(p[k], p[k + 1], p[k + 2]);
        const ndc = star.clone().project(camera);
        expect(pointerBearing({ x: ndc.x, y: ndc.y }, camera, AIM_SHELL)!).toBeCloseTo(bearingOf(star.x, star.z), 1);
      }
    }
  });
  it('points into the Netherlands range when the cursor is on any ship star', () => {
    const camera = homeCamera(1440 / 900);
    const p = starPositions('netherlands');
    for (let k = 0; k < p.length; k += 3) {
      const ndc = new THREE.Vector3(p[k], p[k + 1], p[k + 2]).project(camera);
      expect(pointedAt(pointerBearing({ x: ndc.x, y: ndc.y }, camera, AIM_SHELL)!)).toBe('netherlands');
    }
  });
  it('stays finite in the sky, in the corners and over the header', () => {
    const camera = homeCamera(1440 / 900);
    for (const ndc of [{ x: 0, y: 1 }, { x: -1, y: 1 }, { x: 1, y: -1 }, { x: 0.3, y: 0.98 }]) {
      const b = pointerBearing(ndc, camera, AIM_SHELL);
      expect(b).not.toBeNull();
      expect(Number.isFinite(b!)).toBe(true);
    }
  });
});

describe('touchDrift', () => {
  it('rests on the Netherlands, then China, the Netherlands, Aruba, every 28 s', () => {
    expect(touchDrift(1)).toBeCloseTo(0, 6);
    expect(touchDrift(8)).toBeCloseTo(Math.PI / 2, 6);
    expect(touchDrift(22)).toBeCloseTo(-Math.PI / 2, 6);
    expect(touchDrift(29)).toBeCloseTo(touchDrift(1), 6);
  });
  it('moves without jumps', () => {
    for (let t = 0; t < 28; t += 0.05) expect(Math.abs(touchDrift(t + 0.05) - touchDrift(t))).toBeLessThan(0.08);
  });
});
```

- [ ] **Step 2:** Run the test. Expected: FAIL.
- [ ] **Step 3:** Implement `aim.ts` with three's `Raycaster`, `Ray.intersectPlane` and a closed-form ray–cylinder intersection.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit: `v3: aiming the needle at the pointer, and the touch drift`

---

### Task 8: The chip city

**Files:**
- Create: `src/engine/v3/chipCity.ts`
- Test: `tests/unit/v3/chip-city.test.ts`

**Interfaces:**
- Consumes: `CHIP.board` (Task 2); `GLASS_RINGS` (Task 1).
- Produces:
  - `interface Block { x: number; z: number; w: number; d: number; h: number; glow: number; hue: 'amber' | 'violet' }`
  - `CITY = { inner: 0.2, outer: 1.0, maxHeight: 0.11, brightShare: 0.12 }`. `brightShare` is the most blocks whose `glow > 0.6` (restraint: the city is a hint of light below).
  - `CITY_BLOCKS: Readonly<Record<'fine' | 'coarse', number>> = { fine: 900, coarse: 600 }`: chosen once, at build, by the pointer, as the ring strips are. The quality ladder's later rungs dim the city instead of rebuilding it.
  - `cityLayout(count: number, seed?: number): Block[]`: deterministic, with seed default 2006. Blocks are laid along radial and ring "streets", so the city reads as circuitry seen through glass.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { CHIP } from '~/engine/v3/chipSpec';
import { CITY, cityLayout } from '~/engine/v3/chipCity';

describe('cityLayout', () => {
  const blocks = cityLayout(900);
  it('is the same city every time for a seed, and as many blocks as asked', () => {
    expect(cityLayout(900)).toEqual(blocks);
    expect(blocks).toHaveLength(900);
    expect(cityLayout(900, 7)).not.toEqual(blocks);
  });
  it('stays inside the annulus, below the glass', () => {
    for (const b of blocks) {
      const corners = [[b.x - b.w / 2, b.z - b.d / 2], [b.x + b.w / 2, b.z + b.d / 2], [b.x - b.w / 2, b.z + b.d / 2], [b.x + b.w / 2, b.z - b.d / 2]];
      for (const [x, z] of corners) {
        expect(Math.hypot(x, z)).toBeGreaterThanOrEqual(CITY.inner);
        expect(Math.hypot(x, z)).toBeLessThanOrEqual(CITY.outer);
      }
      expect(b.h).toBeLessThanOrEqual(CITY.maxHeight);
      expect(CHIP.board + b.h).toBeLessThan(0);
    }
  });
  it('never overlaps two blocks', () => {
    for (let i = 0; i < blocks.length; i++)
      for (let j = i + 1; j < blocks.length; j++) {
        const a = blocks[i], b = blocks[j];
        const apart = Math.abs(a.x - b.x) >= (a.w + b.w) / 2 || Math.abs(a.z - b.z) >= (a.d + b.d) / 2;
        expect(apart).toBe(true);
      }
  });
  it('keeps the city dim: few bright blocks', () => {
    expect(blocks.filter((b) => b.glow > 0.6).length / blocks.length).toBeLessThanOrEqual(CITY.brightShare);
  });
});
```

- [ ] **Step 2:** Run the test. Expected: FAIL.
- [ ] **Step 3:** Implement `chipCity.ts` with a small seeded PRNG (mulberry32) inside the module.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit: `v3: the chip city's layout under the glass`

---

### Task 9: Engraving masks for the rings

**Files:**
- Create: `src/engine/v3/paintRings.ts`
- Test: `tests/unit/v3/paint-rings.test.ts`

**Interfaces:**
- Consumes: `GlassRing`, `HEXAGRAMS` (Task 1); `TRIGRAMS`, `DIRECTIONS` (the 北東南西 table), `DIAL_ART` from `dialSpec`; `GLYPHS` from `~/engine/instrument/glyphs`.
- Produces:
  - `RING_STRIP: { fine: readonly [4096, 256]; coarse: readonly [2048, 128] }` (width, height in px)
  - `paintRingStrip(ctx: CanvasRenderingContext2D, ring: GlassRing, width: number, height: number): void`:
    - Paints the ring's engraving in white on transparent, in the polar UV layout of `Annulus` (`u = bearing / 360`, canvas `y = 0` at the ring's outer edge).
    - The builders use the strip as an alpha mask for the gold.
    - What each ring carries:
      - trigram: the 8 `TRIGRAMS` as bars, a broken line drawn as two fills
      - direction: 北 東 南 西 at their bearings, from `GLYPHS` via `Path2D`
      - degree: 360 ticks per `DIAL_ART.tick`
      - hexagram: the 64 `HEXAGRAMS`, six bars each

- [ ] **Step 1: Write the failing tests.** Use a recording context, as `tests/unit/engine/paint.test.ts` does: a Proxy whose `fillRect`, `fill` and `stroke` calls are counted. Stub `globalThis.Path2D` with a class that records the path string.

```ts
import { describe, expect, it } from 'vitest';
import { GLASS_RINGS } from '~/engine/v3/compassSpec';
import { paintRingStrip } from '~/engine/v3/paintRings';

function recorder() {
  const calls: Record<string, number> = {};
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (t, k) => (k in t ? t[k as string] : (..._: unknown[]) => { calls[k as string] = (calls[k as string] ?? 0) + 1; }),
    set: (t, k, v) => { t[k as string] = v; return true; },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}
globalThis.Path2D ??= class { constructor(public d?: string) {} } as unknown as typeof Path2D;
const ring = (id: string) => GLASS_RINGS.find((r) => r.id === id)!;
const marks = (c: Record<string, number>) => (c.fillRect ?? 0) + (c.fill ?? 0);

describe('paintRingStrip', () => {
  it('trigram ring: one fill per whole line, two per broken line (24 lines, 12 broken)', () => {
    const { ctx, calls } = recorder();
    paintRingStrip(ctx, ring('trigram'), 2048, 128);
    expect(marks(calls)).toBe(12 + 12 * 2);
  });
  it('direction ring: the four characters', () => {
    const { ctx, calls } = recorder();
    paintRingStrip(ctx, ring('direction'), 2048, 128);
    expect(calls.fill).toBe(4);
  });
  it('degree ring: 360 ticks', () => {
    const { ctx, calls } = recorder();
    paintRingStrip(ctx, ring('degree'), 2048, 128);
    expect(marks(calls)).toBe(360);
  });
  it('hexagram ring: 384 lines, half of them broken', () => {
    const { ctx, calls } = recorder();
    paintRingStrip(ctx, ring('hexagram'), 4096, 256);
    expect(marks(calls)).toBe(192 + 192 * 2);
  });
});
```

The trigram count is from `TRIGRAMS` (Later Heaven): 24 lines, 12 whole and 12 broken, so 12 + 24 = 36 marks. The hexagram count is 64 × 6 = 384 lines, of which 192 are whole (half of all bits across 0..63), so 192 + 384 = 576 marks.

- [ ] **Step 2:** Run the test. Expected: FAIL.
- [ ] **Step 3:** Implement `paintRings.ts`. A glyph is placed by its centre (the outlines are centred in their em box) and turned so its top faces outward, as `face.ts` does for the milestone-1 face.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit: `v3: the engraving masks of the four rings`

---

### Task 10: The loader's objects

**Files:**
- Create: `src/engine/v3/build/chip.ts`, `src/engine/v3/build/laser.ts`, `src/engine/v3/build/traces.ts`
- Test: `tests/unit/v3/build-loader.test.ts`

**Interfaces:**
- Consumes: Tasks 2 and 4; `palette`.
- Produces:
  - `buildChip(): ChipModel` with `{ group: THREE.Group; setPins(lit: number): void; setEngraving(fractions: readonly number[], time: number): void; setPower(t: number): void; dispose(): void }`:
    - The body is near-black and matte.
    - The 64 pins are one `InstancedMesh`; lit pins are amber (`palette.gold`) at low intensity, through `instanceColor`.
    - The engraving is a ribbon mesh per stroke with a per-vertex `along` attribute (0..1 along its stroke). A `ShaderMaterial` shows the ribbon where `along ≤ fraction`. The newest part glows hot amber and cools to gold over 0.6 s (`time`).
    - `setPower(t)` brightens the pins and the board's trace glow from 0 to their power-on level: dim, a soft glow and no streaks (spec §2.1).
  - `buildLaser(): LaserModel` with `{ group; setTip(x: number, z: number): void; setOn(on: boolean): void; setSparks(intensity: number, time: number): void; dispose(): void }`:
    - A slim gold probe and a thin beam.
    - At most 24 spark points, which live for 0.3 s.
    - A single soft smoke sprite at the tip.
  - `buildTraces(): TracesModel` with `{ lines: THREE.LineSegments; setT(t: number): void; setGlow(level: number): void; dispose(): void }`: all 64 traces in one buffer, written through `tracePoints`.

- [ ] **Step 1: Write the failing tests** (node; three builds geometry without a GL context):

```ts
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { buildChip } from '~/engine/v3/build/chip';
import { buildTraces } from '~/engine/v3/build/traces';
import { boardPath, ringPath, TRACE } from '~/engine/v3/traces';

describe('buildChip', () => {
  it('lights exactly as many pins as asked', () => {
    const chip = buildChip();
    const pins = chip.group.getObjectByName('chip:pins') as THREE.InstancedMesh;
    expect(pins.count).toBe(64);
    chip.setPins(10);
    const lit = [...Array(64).keys()].filter((i) => { const c = new THREE.Color(); pins.getColorAt(i, c); return c.r > 0.05; });
    expect(lit).toHaveLength(10);
    chip.dispose();
  });
  it('frees its geometries and materials', () => {
    const chip = buildChip();
    const spies: unknown[] = [];
    chip.group.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) spies.push(vi.spyOn(m.geometry, 'dispose')); });
    chip.dispose();
    for (const s of spies) expect(s).toHaveBeenCalled();
  });
});

describe('buildTraces', () => {
  it('draws the board at 0 and the rings at 1', () => {
    const traces = buildTraces();
    const pos = () => traces.lines.geometry.getAttribute('position').array as Float32Array;
    traces.setT(0);
    expect(pos().slice(0, 3)).toEqual(boardPath(0).slice(0, 3));
    traces.setT(1);
    expect(pos().slice(0, 3)).toEqual(ringPath(0).slice(0, 3));
    expect(pos().length).toBe(TRACE.count * (TRACE.points - 1) * 2 * 3);
    traces.dispose();
  });
});
```

- [ ] **Step 2:** Run the test. Expected: FAIL.
- [ ] **Step 3:** Implement the three builders. Every object gets a `name` (`chip:pins`, `chip:engraving`, `laser:beam`, `traces:lines`), so the harness and tests can find it.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit: `v3: the chip, the laser and the traces as three.js objects`

---

### Task 11: The home's objects

**Files:**
- Create: `src/engine/v3/build/glassCompass.ts`, `needle.ts`, `city.ts`, `constellations.ts`, `mist.ts`, `sky.ts`, `room.ts`
- Test: `tests/unit/v3/build-home.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 5, 8 and 9; `buildAnnulus` (`~/engine/instrument/Annulus`); `DIAL.needle`; `countryDirection(id).accent`; `palette`; `smokeTexture` (`~/engine/studio/noise`).
- Produces:
  - `buildGlassCompass(): GlassCompassModel` with `{ group; setRingMasks(masks: Readonly<Record<RingId, THREE.Texture>>): void; setFormed(t: number): void; setClearcoat(on: boolean): void; dispose(): void }`:
    - Each ring is a solid: a `LatheGeometry` of its rectangle profile for the walls, plus an `Annulus` (`uv: 'polar'`) top that carries a gold engraving layer with the mask as `alphaMap`.
    - Glass: `MeshPhysicalMaterial` in near-black violet (`0x120a1c`), roughness 0.08, transparent, opacity 0.55, `envMapIntensity` 0.6, clearcoat per tier, and **no** `transmission` (too costly, and it brightens).
    - Gold: `palette.gold`, metalness 1, emissive at most 0.15.
    - `setFormed(t)` fades the glass and the gold in from 0 (the end of the loader's circuit stage) to 1.
    - The hub is a small gold boss at `HUB`.
  - `buildNeedle(): NeedleModel` with `{ group; setBearing(rad: number): void; setForm(t: number): void; dispose(): void }`:
    - A long gold lozenge needle on an ornate pivot, lengths from `DIAL.needle` (tip 0.82, tail 0.6).
    - The tip glows faintly.
    - `setForm(t)` grows it from the loader's probe pose (`t` 0) to the needle (`t` 1).
  - `buildCity(blocks: readonly Block[]): CityModel` with `{ mesh: THREE.InstancedMesh; setGlow(level: number): void; dispose(): void }`: boxes on `CHIP.board`, their emissive set from `glow` and `hue` (amber `palette.gold`, violet `0x6a35b8`), scaled by `level` (0..1).
  - `buildConstellations(): ConstellationsModel` with `{ group; setGlow(id: CountryId, level: number): void; setTwinkle(time: number, on: boolean): void; anchor(id: CountryId): THREE.Vector3; dispose(): void }`:
    - Per country: a `THREE.Points` with a soft round sprite shader, size by `mag`, attenuated by depth (so near stars are bigger and softer).
    - A `LineSegments` of thin gold lines.
    - A mirrored copy below the dial plane at 0.25 of the opacity: the glass's reflection.
    - Resting glow 0.3 and pointed 1.0, set by `setGlow`.
    - `anchor` is the constellation's centroid, where its label goes.
  - `buildMist(): MistModel` with `{ group; setTime(seconds: number): void; setDensity(level: number): void; dispose(): void }`: 3–5 large, soft, additive smoke sprites (`smokeTexture`), very low opacity. Used thicker in the loader (`setDensity(1)`) and thin at home (`0.35`).
  - `buildSky(): SkyModel` with `{ mesh: THREE.Mesh; setTime(seconds: number): void; dispose(): void }`: the violet nebula, a large back-facing sphere (radius 30) with a shader that layers `smokeTexture` in deep violet (`0x2a1250`) at most 0.18 brightness over `LOOK.background`. It gets a handful of faint fixed stars and drifts imperceptibly (one turn per 20 minutes).
  - `buildRoom(renderer: THREE.WebGLRenderer): { environment: THREE.Texture; dispose(): void }`: the glass's and the gold's reflections, as a PMREM. Port milestone 1's light-card room from `src/engine/studio/CompassStudio.ts` (its `room` cards and PMREM build) at half the radiance. Task 15 can then delete `CompassStudio`.

- [ ] **Step 1: Write the failing tests.** For each builder: its object counts, a `setGlow` or `setFormed` that changes the uniform or opacity it owns, and a `dispose` that frees every geometry and material (as in Task 10). Also these two:

```ts
it('builds four glass rings, each with a gold engraving layer', () => {
  const compass = buildGlassCompass();
  expect(compass.group.children.filter((o) => o.name.startsWith('glass:ring:'))).toHaveLength(4);
  expect(compass.group.children.filter((o) => o.name.startsWith('gold:ring:'))).toHaveLength(4);
  compass.dispose();
});
it('rests every constellation dim and lights only the one asked', () => {
  const sky = buildConstellations();
  sky.setGlow('china', 1);
  const level = (id: string) => ((sky.group.getObjectByName(`stars:${id}`) as THREE.Points).material as THREE.ShaderMaterial).uniforms.uGlow.value;
  expect(level('china')).toBe(1);
  expect(level('netherlands')).toBeCloseTo(0.3, 9);
  expect(level('aruba')).toBeCloseTo(0.3, 9);
  sky.dispose();
});
```

- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement the five builders. Object names: `glass:ring:<id>`, `gold:ring:<id>`, `needle`, `city`, `stars:<id>`, `lines:<id>`, `mirror:<id>`, `mist`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit: `v3: the glass compass, needle, city, constellations and mist as three.js objects`

---

### Task 12a: The opening in the canvas

**Files:**
- Create: `src/scene/v3/Opening.tsx`, `src/scene/v3/openingPose.ts`, `src/scene/v3/look.ts`
- Modify: `src/scene/Stage.tsx`, `src/scene/Rig.tsx`, `src/scene/Studio.tsx`, `src/scene/Effects.tsx`, `src/scene/Heartbeat.tsx`, `src/scene/motion.ts`, `src/scene/SceneHost.tsx`, `src/ui/Poster.tsx`, `src/app/Shell.tsx`, `src/styles/base.css`
- Test: `tests/unit/scene/opening.test.ts` (pure helpers only), plus the harness in Task 14.

**Interfaces:**
- Consumes: Tasks 2–4, 6, 9–11; `readout` (`~/engine/loading`); `useScene`; `frame`; `motion`.
- Produces:
  - `look.ts`: `LOOK = { background: 0x040209, fog: { color: 0x0d0718, density: 0.06 }, exposure: 0.85, bloom: { threshold: 1, smoothing: 0.12, radius: 0.55, high: 0.45, medium: 0.32 }, vignette: { offset: 0.22, darkness: 0.82 }, noise: 0.03 }`. These are starting values; Task 14's gate decides. Effects and Studio read them, in place of `COMPASS_STUDIO`.
  - `Opening` (R3F), mounted by `Stage` in place of milestone 1's `<Compass>`:
    - **Build.** On mount it builds the chip, laser, traces and mist (the Opening owns the mist and advances its time on every frame drawn), and calls the Stage's `onReady` as soon as they are compiled. The canvas then shows the loader and the poster gives way.
    - **Load.** It then builds the home objects (Task 11) and paints the four ring masks (Task 9; the fine strip on a fine pointer). After each step it reports load shares: `paint` 0.6 when the masks are painted, `warm` 0.4 when `renderer.compileAsync` of the home scene has settled.
    - **Clock.** It runs the clock: `elapsed = advanceClock(elapsed, delta)` each frame, `shown = readout(shown, share, delta)`, then `loaderAt` (Task 3). It poses everything from the result:
      - camera: `loaderMacro` during `engrave` and `power`; `loaderMacro → loaderRise` over `circuit`; `loaderRise → home` over `land`
      - engraving and pins on the chip; the laser tip follows the stroke being cut
      - traces through `setT` during `circuit`; the glass compass through `setFormed`, from the second half of `circuit`
      - the needle through `setForm` during `land`
      - mist density from 1 down to 0.35
    - **Landing.** At `home` it dispatches `LOADED`. That is the only place `LOADED` is sent while a Stage is up. It also:
      - calls `markLoaderSeen(SafeStorage.session())`
      - hides the laser
      - dims the chip and leaves it under the hub, the ground of the compass
      - leaves the traces at `t = 1` as the dim gilt rules between the rings
      - hands the view to `Home` (Task 12b)
    - **Direct arrival** (spec §2.1). On a country or project page the loader plays and lands on the home view, under that page's scrim, as milestone 1 does. M3 and M5 add the flights to their own places.
    - **Give-up.** If `loaderGaveUp(elapsed, loadedAt)`, it calls the Stage's `onFail('the compass did not load within 15 s of the page being visible')`.
    - **Quick path.** `quick` is `loaderSeen(SafeStorage.session())`, read once at mount.
  - `SceneHost`: `onReady` now means "the loader can show". It stops dispatching `LOADED` itself while a Stage is up; it still does with no Stage (3D off, no WebGL, a failed scene).
  - `Rig`: the camera follows the shot the Opening sets: a `frame.shot: CameraShot` field, added to `frame.ts`. Milestone 1's `PARALLAX` turn is added on top, only in the `home` stage and not with reduced motion. The milestone-1 `HERO_POSE` import goes.
  - `Studio`: rebuilt from v3's parts:
    - `LOOK.background` and fog
    - `buildSky`
    - `buildRoom`'s PMREM as `scene.environment`
    - one dim warm key light from the upper left for the gold, and a faint violet rim from behind
    - no dust (restraint). The quality ladder's `dust` field goes unused; the ladder's tests stay as they are.
    - It still rebuilds the PMREM on `webglcontextrestored`, as milestone 1's did.
  - `Effects`: the same chain and tiers as milestone 1, with the numbers from `LOOK`. The shoulder tone mapping stays.
  - `Poster`: no image. A dark CSS panel (`background: #040209` with a faint violet radial glow), so the first paint matches the loader's darkness. The scrim rules of milestone 1 stay.
  - `Shell` and `base.css`: `<html data-loading>` is set while the phase is `LOADING`, through a `useLoadingAttribute()` hook built like `useThreeDAttribute`. The hero (`.hero`) is hidden while it is set, then fades in over 0.9 s (none with reduced motion).
  - Pure helper, exported from `Opening.tsx`'s companion `src/scene/v3/openingPose.ts`: `cameraShotAt(clock: LoaderClock, aspect: number): CameraShot`. Its test checks that `engrave` gives `loaderMacro`, `home` gives `homeShotFor(aspect)`, and `circuit` at local 0.5 lies between `loaderMacro` and `loaderRise`.

- [ ] **Step 1:** Write `tests/unit/scene/opening.test.ts` for `cameraShotAt`, as above. Run it. Expected: FAIL.
- [ ] **Step 2:** Implement `look.ts`, `openingPose.ts` and `Opening.tsx`, and wire `Stage`, `SceneHost`, `Rig`, `Studio`, `Effects`, `Heartbeat`, `motion`, `Poster`, `Shell` and `base.css` as above.
  - `Heartbeat` keeps drawing while the loader runs (`motion.loader = stage !== 'home'`).
- [ ] **Step 3:** Run `npm test`, `npm run typecheck` and `npm run build`. Expected: all pass. Fix tests that asserted milestone 1's `LOADED`-on-ready timing (`tests/unit/scene/settle-load.test.ts` and its neighbours) to the new rule, and say so in the report.
- [ ] **Step 4:** Run the harness's existing steps `loaded`, `no-webgl`, `no-scene`, `routes`, `bridge` and `stills` (with `STEPS=...`). Expected: PASS, apart from checks that measured milestone 1's compass specifically. List those in the report; Task 14 rewrites them.
- [ ] **Step 5:** Commit: `v3: the opening: ON engraved, pins as progress, power-on, circuit into compass`

---

### Task 12b: The home: needle, pointing, labels, idle

**Files:**
- Create: `src/scene/v3/Home.tsx`
- Modify: `src/state/frame.ts`, `src/debug/needleDebug.ts`, `src/debug/useNeedleDebug.ts`
- Test: `tests/unit/debug/needle-debug.test.ts` (extend)

**Interfaces:**
- Consumes: Tasks 5, 7, 11 and 12a; `AngleSpring`; `t.needle.countries[id].name`; drei `Html`.
- Produces:
  - `Home` (R3F), shown once `Opening` lands:
    - **Aim.**
      - Fine pointer: `pointerBearing(frame.pointer, camera, AIM_SHELL)`, stepped through `new AngleSpring(NEEDLE_SPRING.zeta, NEEDLE_SPRING.omega)`.
      - Coarse pointer, or no pointer move yet: `touchDrift(time)`.
      - A null bearing or a pointer that left the window keeps the last target.
      - Reduced motion: the spring's value is set straight to the target, with no animation.
    - **Pointing.**
      - `pointedAt(needle)` sets the pointed constellation's glow to 1 (damped over 0.4 s) and the others to 0.3.
      - It writes `frame.pointed: CountryId | null`.
      - It shows that constellation's name with drei `<Html>` at `anchor(id)`, offset to its outer side: `aria-hidden`, `pointer-events: none`, Montserrat in small caps, lilac at 0.85 opacity, fading over 0.3 s. Nothing else is labelled.
    - **Idle.**
      - Twinkle on the stars, a slow breathe on the needle tip (±10 % glow, 4 s) and the city's glow very slowly pulsing (±5 %, 9 s). The mist keeps drifting through the Opening's clock.
      - All of it only for `IDLE_SECONDS = 12` after the last pointer move or phase change.
      - It writes `motion.compass` (`idle`, `needle`, `needleSpeed`) every frame, as milestone 1's Compass did. The Heartbeat's `asleep(motion.compass)` then lets the scene sleep once the idle time is over and the needle has settled.
      - With reduced motion: no twinkle, breathe or pulse at all.
  - `frame.ts` gains `pointed: CountryId | null` and `shot: CameraShot` (from 12a).
  - The debug bridge's state gains three fields:
    - `loader: { stage: LoaderStage; elapsed: number; pins: number }`
    - `pointed: CountryId | null`
    - `constellations: Record<CountryId, [x: number, y: number]>`: each anchor in CSS pixels, so the harness can move the mouse onto a constellation.
  - It gains the action `seekLoader(seconds: number): void`, which holds the loader's clock at `seconds` and stops it advancing, for the stills. It is only under `?proof`, like the rest of the bridge.
    - The held clock uses a synthetic load, `shown = min(1, seconds / LOADER.engraveMin)` and `loadedAt = LOADER.engraveMin`, so a still shows the pins filling in step with the engraving, whatever the real load did.
    - The Opening poses everything from the held clock every frame, so seeking back from the home to an engraving moment shows the chip, the laser and the traces again. The phase stays `HOME_IDLE`.
    - `seekLoader(-1)` releases the hold and goes back to the live clock, which is already at `home`.
    - (Ruling 2 in the ledger.)

- [ ] **Step 1:** Extend `tests/unit/debug/needle-debug.test.ts`: the state has `loader`, `pointed` and `constellations`, and `seekLoader` reaches the act it was given. Run it. Expected: FAIL.
- [ ] **Step 2:** Implement `Home.tsx` and the frame and debug changes.
- [ ] **Step 3:** Run `npm test`, `npm run typecheck` and `npm run build`. Expected: PASS.
- [ ] **Step 4:** Smoke-test with the preview server: after landing, the needle follows the mouse with a lag, and the name shows only over a constellation. Write what you saw in the report; Task 14 proves it.
- [ ] **Step 5:** Commit: `v3: the home: the needle follows the cursor and lights the constellation it points at`

---

### Task 13: Hero copy and header at landing

**Files:**
- Modify: `src/app/routes/home.tsx`, `src/styles/base.css`
- Test: `tests/unit/header-controls.test.ts` (extend)

**Interfaces:**
- Consumes: `data-loading` (12a).
- Produces:
  - The hero sits as in prototype `ui-02`: BOB CHUNG in Montserrat, wide-tracked, at the upper left; FOLLOW THE NEEDLE under it in Martian Mono, small and lilac; the scroll cue bottom centre, small, with a 2.4 s slow pulse (none with reduced motion).
  - All three use `--lilac` / `--dim` on the dark scene. Contrast stays at least 4.5 : 1 against `#040209`.
  - The header shows these, unchanged from milestone 1: language, Lite, 3D switch and contact. Sound is milestone 6.

- [ ] **Step 1:** Extend `tests/unit/header-controls.test.ts` to assert that the header still renders the Lite link, the contact link, the language switch and the 3D switch, in both languages. Run it. Expected: PASS (a guard, not new behaviour).
- [ ] **Step 2:** Restyle `.hero`, `.hero-name`, `.hero-tagline` and `.hero-cue` in `base.css`. Keep Ruling 23's `font-feature-settings: 'locl' 0` wherever Unbounded is used.
- [ ] **Step 3:** Run `npm test`, `npm run build` and the auditor. Expected: PASS, auditor 0.
- [ ] **Step 4:** Commit: `v3: the hero's three lines over the dark scene`

---

### Task 14: Proof: the loader, the look and pointing

**Files:**
- Modify: `tools/proof/needle.mjs`, `tools/proof/README.md`

**New and changed steps:**
- `loader-stills`:
  - For each of 1440 × 900 and 390 × 844, open `/?proof` in a fresh context and wait for `HOME_IDLE`, so the real load is done.
  - Call `seekLoader` at 0.6 s, 1.6 s (engraving), `engraveMin + 0.4` (power), `engraveMin + power + 0.8` (circuit) and `engraveMin + power + circuit + 0.7` (land), and take a still at each into `PROOF_DIR/m2/loader-<n>-<size>.png`.
  - Check each still's `loader.stage`.
- `home-look`:
  - Take stills of the home after landing at both sizes (`m2/home-<size>.png`).
  - Compute the luminance of each still and each loader still **in the page**: load the PNG as a data URL into an `<img>`, draw it on a canvas, and use `getImageData` (no new dependency). Mean luma uses Rec. 709 on sRGB values, 0..1.
  - Gate: home mean ≤ 0.11, loader mean ≤ 0.07, clipped (luma ≥ 0.98) ≤ 0.4 %. Print the numbers.
- `point`:
  - At 1440 × 900, after landing, move the mouse to each `constellations[id]`.
  - Wait 1.5 s, then check that `pointed === id` and that a label with `t.needle.countries[id].name` is visible.
  - Take a still per country (`m2/point-<id>.png`).
  - Move the mouse to the empty sky between two constellations; check that `pointed === null`.
- `quick-loader`:
  - Load `/?proof` and wait for `HOME_IDLE`, then reload the same tab.
  - Check that `loader.stage` is never `engrave` after the reload and that `HOME_IDLE` arrives within `LOADER.quick + 2` s of the scene being ready.
  - A new context plays `engrave` again.
- `loader-reduced`: with `reducedMotion: 'reduce'`, sample `loader.stage` every 100 ms until `HOME_IDLE`. The stages seen must be only `engrave`, `land` and `home`, and `loader.pins` must never decrease.
- `sleep`: within `IDLE_SECONDS + SLEEP_WITHIN_MS` after landing with no input, the scene stops drawing (reuse `sleepWithin`).
- `load-throw`: `LOAD_THROW_AT` becomes `'.setRingMasks('`, the property call that runs once in the Stage chunk after the masks are painted. The step checks that a throw there shows the fallback card.
- Update `STATE_KEYS` (adds `constellations`, `loader`, `pointed`), `stills` (into `m2/`) and every check that read milestone 1's compass, listed in Task 12a's report.

- [ ] **Step 1:** Implement the steps.
- [ ] **Step 2:** Build, serve and run the whole harness. Expected: every step PASS, `errors: []` and `csp: []`.
- [ ] **Step 3:** If `home-look` fails, lower `LOOK.exposure`, the bloom and the city glow (Task 12a's `look.ts`, Task 11's `setGlow` level), never the gate. Record the final numbers in the report.
- [ ] **Step 4:** Commit: `proof: the loader's stills, the dark look's gate, pointing, the quick and reduced loaders`

---

### Task 15: Remove milestone 1's placeholder compass

**Files:**
- Delete:
  - `src/scene/Compass.tsx`
  - whichever of these nothing imports any more once 12a–12b are in:
    - `src/engine/Choreography.ts`, `applyPose.ts`, `FreeTurn.ts`, `TextureWarmup.ts`, `overlay.ts`
    - in `src/engine/instrument/`: `Instrument.ts`, `Tracks.ts`, `Wire.ts`, `wirePath.ts`, `Pool.ts`, `BasePlate.ts`, `DriveParts.ts`, `drive.ts`, `face.ts`, `paint.ts`, `patterns.ts`, `textures.ts`, `materials.ts`, `Needle.ts`, `dialSvg.ts`
    - `src/engine/studio/CompassStudio.ts`, `Backdrop.ts`, `Dust.ts`
    - `public/textures/instrument/`
    - `src/assets/renders/`
  - and their tests under `tests/unit/engine/`
- Keep: `dialSpec.ts`, `glyphs.ts`, `Annulus.ts`, `AngleSpring.ts`, `CameraRig.ts` (if still imported), `palette.ts`, `quality.ts`, `stillness.ts`, `loading.ts`, `core/*`, `studio/noise.ts`, `studio/Haze.ts` (if imported).

- [ ] **Step 1:** For each candidate, confirm it has no importer: `npx tsc --noEmit` after deleting it, plus a grep for its path. Delete only what passes. List what stayed and why.
- [ ] **Step 2:** Check that `src/data/parts.ts` and the `needle.parts` copy are still used by the scroll chapters (`HOME_CHAPTERS`). They are, until M4; keep them.
- [ ] **Step 3:** Run `npm test`, `npm run typecheck`, `npm run build`, the auditor and the full harness. Expected: all pass. The Stage chunk is smaller than before; record both sizes.
- [ ] **Step 4:** Commit: `v3: remove milestone 1's placeholder compass and the revision-4 engine it needed`

---

## Milestone exit (not a task)

1. The final whole-branch review (the execution skill's last step).
2. Gather Task 14's stills for Bob: the loader sequence, the home at both sizes, and the three pointing stills. Put them on one screen in the visual companion, next to concept frames `01`–`04` for comparison.
3. Ask Bob for his review. His notes are the input to the M3 plan, and nothing merges into `redesign-bench` without his OK.
