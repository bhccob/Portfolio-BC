# Signal Loader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On a first visit the loader draws one gold line on the glass that a cursor reads, as a logic analyzer, into the real UART frames of BOB CHUNG with their read-out, and the line curls into the circle, after which today's loader goes on.

**Architecture:** The loader's pure timeline (`src/engine/bob/loaderTimeline.ts`) trades the probe's descent and the circle cut for three spans (`lineIn`, `decode`, `curl`) and reports `decode` and `curl` on its clock; the probe stays parked. A pure module (`src/engine/bob/signalFrames.ts`) lays out the bits; a three.js part (`src/engine/bob/build/signal.ts`) draws the line, the noise, the cursor and the curl from them; the Opening builds and poses it. The read-out is HTML over the canvas, laid out by a pure function and written by the Opening each frame, as the world's words are.

**Tech Stack:** React Router 8 (prerendered), React Three Fiber / three 0.186.1 (`frameloop="demand"`), Vitest, tsc, the Playwright-core proof harness `tools/proof/needle.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-01-bob-signal-loader-design.md`

## Global Constraints

- The full path only (a first visit): the quick and reduced paths keep today's clocks, with `decode` and `curl` at 1 and no line.
- The words: the hero's `name` (`BOB CHUNG`, `t.needle.hero.name`) as bytes, and the label `CH0 · UART`; the same in Dutch and English. Nothing else new.
- Frames at 24 fps: `lineIn` 1-20, `decode` 20-92, `curl` 92-110; `ticks` 108-122, `outer` 110-132, `iris` 116-132, `glow` 114-142, `rise` 124-176, `camera` 116-176, `settle` 136-186; `home` 186 (7.75 s). The hold is at 92 % of `decode`; the crawl (`LOADER.crawl`, `crawlTau`) applies to `decode`.
- The line: on the glass along x, −3.6 m to +3.6 m through the compass's centre; high 0.2 m over the glass; the engraving's stroke gold and width; unlit, fogged.
- The bits: 6 idle bits, then per byte a start bit (0), its eight bits lowest first, a stop bit (1), then 3 idle bits; idle is high.
- Any input still skips (`LOADER.skip`). `.impeccable/config.json` is never edited. No subagents. Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. No push or merge without Bob's word.
- Tests: `npx vitest run <files>`; the whole suite `npx vitest run` and `npx tsc --noEmit -p .`.

## Rulings made while planning

- **The probe stays built and parked** (`probeAt` answers `parked()` on every path): its lamp is one of the scene's lights, whose count must not change mid-show (Opening's comment), so leaving it out would change the lighting. Cost if wrong: an unused model in memory.
- **The circle stroke counts as cut only at the end of `curl`** (`strokes[4]` is 0 before, 1 from there; the crawl floor moves to `decode`), so the curled line and the engraving's tube never draw at once.
- **The line's ribbon faces the wide shot**: each point's width runs along `cross(tangent, toward the camera)` with "toward the camera" fixed at the wide shot's direction (elevation 19°), which the camera holds through the whole signal.

## Review Focus

1. A load still out at the hold: the cursor waits short of the last letter, creeping, and the read-out shows only the letters it has passed (timeline unit test of `decode` at the hold; harness `loaded` reads `loader.signal.decode` while held).
2. A skip during the read: the rest runs in `LOADER.skip`, the curl included, and the home is reached (timeline unit test; harness `loader-skip`).
3. A phone (390 px): every box inside the screen; a box shows its letter alone when its code does not fit (layout unit test at 390 px).
4. A returning visitor (quick path) and reduced motion: no line, no read-out (pose unit test; harness `quick-loader`, `loader-reduced` read `loader.signal.level` 0).
5. The language: on /en/ the read-out is the same bytes and label (harness `signal` step on /en/).

---

### Task 1: The script

**Files:**
- Modify: `src/engine/bob/loaderTimeline.ts` (`FRAMES`, `SCRIPT`, `HOLD_AT`, `LoaderClock`, `playUncapped`'s floor, `fullClock`, `quickClock`, `reducedClock`)
- Modify: `src/engine/bob/probePath.ts` (`probeAt`)
- Modify: `src/scene/bob/openingPose.ts` (`OpeningPose.signal`, `HOME_POSE`, `openingPoseAt`)
- Test: `tests/unit/bob/loader-timeline.test.ts`, `tests/unit/bob/probe-path.test.ts`, `tests/unit/bob/opening-pose.test.ts`

**Interfaces:**
- Produces: `SCRIPT.lineIn`, `SCRIPT.decode`, `SCRIPT.curl` (Spans, seconds); `SCRIPT.descend`, `SCRIPT.circle` and `SCRIPT.probeOut` are gone. `LoaderClock.decode: number` and `LoaderClock.curl: number` (0..1). `HOLD_AT = (20 + 0.92 * 72) / 24`. `OpeningPose.signal: { decode: number; curl: number; level: number }` (`level` the line's light, `easeOut(clock.fade)` on the full path while `curl < 1`, else 0); `HOME_POSE.signal` is `{ decode: 1, curl: 1, level: 0 }`.

- [ ] **Step 1: Write the failing tests.** In `loader-timeline.test.ts` the script's spans are the Global Constraints' frames over 24 (`SCRIPT.lineIn` `{ start: 1/24, end: 20/24 }`, `decode` `{ 20/24, 92/24 }`, `curl` `{ 92/24, 110/24 }`, `ticks` `{ 108/24, 122/24 }`, … `home` 186/24), each span's start the last one's end where they join (`decode.start === lineIn.end`, `curl.start === decode.end`), `HOLD_AT` `(20 + 0.92*72)/24`; the stages: `dark` before `lineIn.end`, `engrave` from it to `curl.end`, `open` from `curl.end` to `rise.start`; `decode` is `through(script, decode)` and at the hold with the load out it reads `0.92 + 0.06·(1 − e^(−waited/4))`; `curl` is `through(script, curl)`; `strokes` is `[0,0,0,0,0]` before `curl.end` and `[0,0,0,0,1]` from it (also while held); the quick and reduced clocks have `decode` 1 and `curl` 1. Every existing case that used `descend`/`circle`/`probeOut` is rewritten against `lineIn`/`decode`/`curl` with the same intent (the crawl, the skip before and after the load, the home never passed). In `probe-path.test.ts`: on the full path at every script second from 0 to `SCRIPT.home` in steps of 0.05, and on the quick and reduced paths, `probeAt` is the parked state (`shown: false`, `cutting: false`, `y: PROBE.outY`). In `opening-pose.test.ts`: `openingPoseAt` of the full clock half way through `decode` has `signal.decode` 0.5 (to 9 places), `signal.level` 1 and `signal.curl` 0; at `curl.end` `signal.level` 0; the quick and reduced paths' `signal.level` 0 throughout; `HOME_POSE.signal` `{ decode: 1, curl: 1, level: 0 }`; the existing traces/engraveGlow cases against `lineIn` instead of `descend`.
- [ ] **Step 2: Run** `npx vitest run tests/unit/bob/loader-timeline.test.ts tests/unit/bob/probe-path.test.ts tests/unit/bob/opening-pose.test.ts`. Expected: FAIL (no `lineIn`/`decode`/`curl`; the probe still comes down).
- [ ] **Step 3: Implement.** The header of `loaderTimeline.ts` says the signal replaces the descent and the cut (Bob, round 17, "B · Signal"); `circleFloor` becomes `decodeFloor`; `probeAt` parks always, its header saying why (round 17: the signal takes the probe's place; the probe stays built for the light count). `openingPoseAt` adds `signal`.
- [ ] **Step 4: Run** the three files, then `npx vitest run` and `npx tsc --noEmit -p .`. Expected: all pass (fix any other test pinned to the old spans the same way, e.g. `timeouts.test.ts` reads `HOLD_AT`, which stays valid).
- [ ] **Step 5: Commit**: `loader: the signal's script in place of the probe's descent and the circle cut, home at 7.75 s; the probe stays parked`.

### Task 2: The signal on the glass

**Files:**
- Create: `src/engine/bob/signalFrames.ts`; Test: `tests/unit/bob/signal-frames.test.ts`
- Create: `src/engine/bob/build/signal.ts`; Test: `tests/unit/bob/build-signal.test.ts`
- Modify: `src/scene/bob/Opening.tsx` (`LoaderParts`, the build ~:391, `pose()` ~:725, dispose ~:557)
- Modify: `src/debug/needleDebug.ts`, `src/debug/useNeedleDebug.ts`, `src/state/frame.ts` (the loader report gains `signal: { decode: number; curl: number; level: number }`)

**Interfaces:**
- Consumes: `OpeningPose.signal` (Task 1).
- Produces, `signalFrames.ts` (pure): `export const SIGNAL = { lead: 6, gap: 3, half: 3.6, high: 0.2, label: 'CH0 · UART' } as const;` `export function signalBits(word: string): number[]` (each bit's level, 1 high); `export interface SignalByte { char: string; code: number; from: number; to: number }` (`from` its start bit's index, `to` one past its stop bit); `export function signalBytes(word: string): SignalByte[]`; `export function bitX(bit: number, bits: number): number` (the world x of a bit's left edge, `−half + 2·half·bit/bits`). Produces, `build/signal.ts`: `export interface SignalModel { group: THREE.Group; pose(decode: number, curl: number, level: number, time: number): void; dispose(): void }`, `export function buildSignal(word: string): SignalModel`.

- [ ] **Step 1: Write the failing tests.** `signal-frames.test.ts`: `signalBits('B')` is `[1,1,1,1,1,1, 0, 0,1,0,0,0,0,1,0, 1, 1,1,1]` (0x42 lowest bit first); `signalBits('BOB CHUNG').length` is `6 + 9 * 13` (123); `signalBytes('BOB CHUNG')` has the codes `[0x42,0x4f,0x42,0x20,0x43,0x48,0x55,0x4e,0x47]`, the first `from` 6 and `to` 16, the second `from` 19; for each byte the bits `from..to` are `0`, its code's bits lowest first, `1`; `bitX(0, 123)` is −3.6 and `bitX(123, 123)` is 3.6. `build-signal.test.ts` (the test canvas pattern of `build-world.test.ts` is not needed: no canvas): `pose(0, 0, 0, 0)` hides the group; `pose(1, 0, 1, 0)` shows it and every vertex of the line (`signal:line`) has |x| ≤ 3.6 + 0.02 and y between −0.02 and 0.2 + 0.02, z within 0.02 of 0; `pose(1, 1, 1, 0)` puts every line vertex within 0.03 of the circle of radius `WORDMARK.circle` on the glass (√(x²+z²) ≈ 1.66, y ≈ 0); at `decode` 0.5 the vertices with x left of `bitX(61.5, 123)` (the cursor) sit at 0 or 0.2 (± the ribbon's half width) and the cursor (`signal:cursor`) is shown; at `decode` 1 the cursor is hidden; `dispose` frees the geometries and materials.
- [ ] **Step 2: Run** `npx vitest run tests/unit/bob/signal-frames.test.ts tests/unit/bob/build-signal.test.ts`. Expected: FAIL (no modules).
- [ ] **Step 3: Implement `signalFrames.ts`**, then **`build/signal.ts`**: one `BufferGeometry` of a ribbon (`signal:line`) along up to 1200 points, rewritten in place each `pose` (no allocation per frame); left of the cursor the clean levels with their upright edges, right of it a soft noise round `high/2` (about ±0.05 m, moving with `time`); the curl moves each point toward the circle at angle `π/2 + 2π·u` (`u` its share of the line from the left), flattening the levels to the glass, eased; the cursor (`signal:cursor`) a thin faint upright ribbon at the sweep with a small glow sprite at the line; the line's material the engraving's stroke colour (`ENGRAVING_LOOK.colour × gain × share.stroke`) times `level`, basic, fogged; hidden at `level` 0 or `curl` 1. Its header names Bob's pick, "B · Signal".
- [ ] **Step 4: Run** the two test files. Expected: PASS.
- [ ] **Step 5: Wire it.** The Opening builds the signal with the loader's parts for the page's language (`localeFromPath`, `translatorFor(...).t.needle.hero.name`), adds it to the scene, frees it with them, and in `pose()` calls `signal.pose(at.signal.decode, at.signal.curl, at.signal.level, time)`; the proof's loader report carries `signal`.
- [ ] **Step 6: Run** `npx vitest run` and `npx tsc --noEmit -p .`. Expected: all pass.
- [ ] **Step 7: Commit**: `loader: the signal on the glass, read into BOB CHUNG's UART frames and curled into the circle (Bob's "B · Signal")`.

### Task 3: The read-out

**Files:**
- Create: `src/scene/bob/signalReadout.ts` (pure layout and the DOM writer); Test: `tests/unit/scene/bob-signal-readout.test.ts`
- Create: `src/ui/SignalReadout.tsx` (the elements, `aria-hidden`); Modify: `src/app/routes/home.tsx` (mount it beside `<SkipButton />`); Modify: `src/styles/base.css` (its styles)
- Modify: `src/scene/bob/Opening.tsx` (write the read-out each frame it poses the loader; hide it on the home and on the other paths)

**Interfaces:**
- Consumes: `SIGNAL`, `signalBytes`, `bitX` (Task 2); `OpeningPose.signal` (Task 1).
- Produces: `export interface ReadoutBox { char: string; code: string; x: number; width: number; y: number; opacity: number; showCode: boolean }`, `export interface ReadoutLayout { label: { x: number; y: number; opacity: number }; boxes: ReadoutBox[]; name: { x: number; y: number; opacity: number } }`, `export function readoutLayout(word: string, decode: number, curl: number, level: number, toScreen: (x: number) => { x: number; y: number }): ReadoutLayout` (CSS px; `toScreen` maps a world x on the line's low level to the screen), and `export function writeReadout(layout: ReadoutLayout | null, doc: Document): void`.

- [ ] **Step 1: Write the failing test.** With `toScreen = (x) => ({ x: 720 + x * 177.8, y: 480 })` (1440 px, the line ±3.6 m over 80…1360) and the word `BOB CHUNG`: at `decode` 0 no box has opacity above 0 and the name's opacity is 0; at `decode` 1 every box's opacity is 1, the boxes' chars are `B O B ␣ C H U N G` (the space as `␣`), their codes `42 4F 42 20 43 48 55 4E 47`, each box's x the middle of its byte's frame on the screen and its y below the line (`> 480`); the name's opacity is 1 at `decode` 1 and 0 at `decode` 0.9; at `curl` 0.5 every opacity is 0; at `level` 0 every opacity is 0; with a 390 px screen (`toScreen = (x) => ({ x: 195 + x * 48.1, y: 300 })`) each box's `showCode` is false and every box lies inside 0…390; `writeReadout(null, doc)` hides the read-out's root (`hidden`).
- [ ] **Step 2: Run** `npx vitest run tests/unit/scene/bob-signal-readout.test.ts`. Expected: FAIL (no module).
- [ ] **Step 3: Implement.** A box shows once the cursor has passed its stop bit, fading in over 40 px of the sweep; `showCode` when the frame is at least 64 px wide; the label at the line's left end above it; the name under the middle once `decode` is 1; everything times `level` and fades out over the first third of the curl. `SignalReadout.tsx` renders the root (`.signal-readout`, `aria-hidden="true"`, `hidden` until written), the label, one box per byte of the hero's name and the name, in Martian Mono in the site's gold ink, small (12 px; the name 16 px); `writeReadout` positions them by `transform`, never by layout.
- [ ] **Step 4: Run** the test, then `npx vitest run` and `npx tsc --noEmit -p .`. Expected: all pass.
- [ ] **Step 5: Wire it.** The Opening, each frame it poses the loader on the full path, projects the line's low level (world `(x, 0, 0)`) through the camera and writes `readoutLayout(...)`; on the quick and reduced paths and from the home on it writes `null`.
- [ ] **Step 6: Commit**: `loader: the signal's read-out, each letter and its code under its frame, then the name`.

### Task 4: Proof, review page, self-review

**Files:**
- Modify: `tools/proof/needle.mjs` (the loader steps' script times and stage notes: `loader-stills` dark at 0.5 s drawn by the line coming in, engrave half way through `decode`, the rest at their new seconds; `loader-skip`, `loaded`, `quick-loader`, `loader-reduced` read `loader.signal`); a new step `signal`
- Review: `.superpowers/r17-build/` (recordings and page, git-ignored)

- [ ] **Step 1: Harness.** Update the loader steps to `SCRIPT`'s new spans (their stage moments taken from `SCRIPT` rather than fixed seconds where they are fixed now). New step `signal`, on 1440x900, 390x844 and /en/: at `SCRIPT.decode` half way the read-out shows the first half's boxes and none of the rest, the label shown; at `decode`'s end the name `BOB CHUNG` shown; after `curl` the read-out hidden and the circle cut (`strokes[4]` 1); each box inside the screen; a still of the read half way and of the curl.
- [ ] **Step 2: Build** `npm run build` (exit 0) and run the whole harness against it (served on 4421). Expected: every step passes; a failure is debugged and fixed test-first in the task that owns it.
- [ ] **Step 3: Review page** `.superpowers/r17-build/index.html`: the real loader recorded (a fresh profile, first visit) today (bhccob.com) and round 17, side by side, and the two stills.
- [ ] **Step 4: Final review**, a self-review (no subagents, Bob's rule) of `git diff main...bob-r17` against the spec, ledgered as `Final review: self-review (no subagent tool)`; Critical and Important findings fixed test-first.
