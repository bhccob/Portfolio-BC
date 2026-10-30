# Round 10: the Q&A as one list, the projects by floor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Bob's rule overrides the recommendation: "DO NOT use subagent". Execute inline (superpowers:executing-plans).

**Goal:** One Q&A stop with all questions in a list beside the close tower (a click turns the ring to its question and opens its answer), and projects that glow at their floor's stop and open their full page without lifting up to the camera.

**Architecture:** Keep the ring and its seven marks (the QA units, `goToQa`, the ring's turn) and drop the five inner marks from the scroll's stops and the keys' steps; the list's buttons call `goToQa(k)`, and the answers' writer opens the item of the mark the ring stands at. A click on a project goes straight to its page (`openBead` without a lift), and the focus never lifts a project, so the camera stays at the floor behind the page. A small pure pulse lifts the light of the projects at the floor's stop.

**Tech Stack:** React Router 8, R3F/three 0.186, zustand, Vitest, the proof harness `tools/proof/needle.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-30-bob-qa-list-floors-design.md`

## Global Constraints

- Branch `bob-stack-10` (worktree `.claude/worktrees/bob-dive`); never merge or push without Bob's word. No subagents. Never edit `.impeccable/config.json`; never run `impeccable hooks ignore-value`; never port 4399.
- The dark gate: a still's mean luma at most 0.11 (home and stops), 0.15 with a project open; under the first fact's line 0.10.
- No new words: the questions, answers, names and buttons are the site's own dictionaries (NL default, EN under /en/).
- Keyboard and touch reach every question and every project, as today.
- Reduced motion: the ring jumps to a mark, the glow stands still.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Proof: `npm run build`, then `BASE=http://localhost:4421 PLAYWRIGHT_CORE=C:/Users/bhcco/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright-core STEPS=<steps> node tools/proof/needle.mjs`.

## Review Focus

1. A phone (390 × 844) with the longest answer open: the list must stay inside the screen and not cover the tower's middle. Pinned in Task 5 (harness: the list's box inside the viewport, under the tower's centre).
2. The keyboard: Tab reaches each question, Enter and Space open it, and focus stays on the button while the ring turns. Pinned in Task 2 (unit) and Task 5 (harness keyboard step).
3. A project's page reached without a click (a link, a direct URL): the floor behind it, nothing lifted. Pinned in Task 3 (focus test with the phase alone).
4. Scrolling back up from a question opened in the list: the story returns to the list's stop, not a hidden inner mark. Pinned in Task 1 (stops) and Task 5 (harness).
5. The glow in the fall or the Q&A (not at a floor): none. Pinned in Task 4.

---

### Task 1: One Q&A stop on the scroll and the keys

**Files:**
- Modify: `src/state/chapters.ts` (`stops`, `keyStops`)
- Test: `tests/unit/state/chapters.test.ts`

**Interfaces:**
- Produces: `stops(c)` and `keyStops(c)` without the ring's inner marks: of the QA marks only mark 0 (the list) and the last (the end) remain. `qaStop(c, k)` and `goToQa(k)` unchanged (the list turns the ring to any mark).

- [ ] **Step 1: Write the failing tests** in `chapters.test.ts`:
  - `'stops once in the Q&A: the list, then the end'`: for `HOME_CHAPTERS`, `stops` and `keyStops` each contain `qaStop(c, 0)` and `qaStop(c, RING_QUESTIONS)` and none of `qaStop(c, k)` for `k` in 1..`RING_QUESTIONS - 1`.
  - `'keeps every other stop'`: `stops` and `keyStops` without the QA marks equal today's (compare against the lists filtered of QA marks).
- [ ] **Step 2: Run** `npx vitest run tests/unit/state/chapters.test.ts`. Expected: FAIL on the first.
- [ ] **Step 3: Implement**: in `stops`, leave out the start of QA units 2..`questions` (their starts are marks 1..`questions - 1`); in `keyStops`, of the QA marks keep the first and the last. Update both doc comments (Bob, 2026-10-30: the Q&A in one stop).
- [ ] **Step 4: Run** the file, then `npx vitest run tests/unit/input tests/unit/state`. Expected: PASS; a test elsewhere that pins the old stop count is updated to the new count, with a one-line comment why.
- [ ] **Step 5: Commit**: `qa: one stop on the scroll and the keys, the list's, then the end (Bob picked the list)`.

### Task 2: The list beside the close tower

**Files:**
- Modify: `src/ui/QaRing.tsx`, `src/ui/qaWriters.ts`, `src/styles/base.css`
- Test: `tests/unit/ui/qa-ring.test.ts`, `tests/unit/ui/qa-list-css.test.ts` (new)

**Interfaces:**
- Consumes: `goToQa(k: number): boolean` (`src/input/useHomeScroll.ts`).
- Produces: the Q&A's markup: `ol.qa-list` of `li.qa-item[data-k]`, each a `button.qa-ask` (`aria-expanded`, `aria-controls`) with its question and a `div.qa-reply` (its answer, `hidden` unless open) under it; the count line `p.qa-count` as the list's title; the end's words as today; no `.qa-mark` buttons.

- [ ] **Step 1: Write the failing tests:**
  - `qa-ring.test.ts`: `'lists every question as a button, its answer under it'` (six `button.qa-ask` in order, each `aria-controls` its reply); `'opens the question of the mark the ring stands at, and only that one'` (`writeQa` with the ring at mark 2: button 2 `aria-expanded="true"`, its reply shown, the others `false` and hidden); `'turns the ring to a question when it is asked'` (a click on button 3 calls `goToQa(3)`; mock the module); `'puts no buttons on the ring\'s marks'` (no `.qa-mark`); Enter and Space on a button call `goToQa` (a `<button>` does this natively: assert the element is a `button`).
  - `qa-list-css.test.ts` (as `tests/unit/ui/contact-page.test.ts` reads `base.css`): `.qa-list` stands right of the middle on a laptop (`right` or `margin-left` puts it in the right half) and, under `@media (max-width: 760px)`, below the tower in the bottom part of the screen.
- [ ] **Step 2: Run** both files. Expected: FAIL.
- [ ] **Step 3: Implement.** `QaRingParts` renders the list (the dictionary's questions and answers as today's answers render them) and the end's words; the writer that showed the answer of the mark at the ring's place now sets `aria-expanded` and `hidden` on the list's items (the mark nearest the ring's place, 0..5), and on the end's mark shows the end as today. Remove `placeMarks` and the marks' buttons. CSS: the list at the right on a laptop (about 420 px wide, vertically from 18 % of the screen), under the tower on a phone; questions as quiet rows with a thin gold rule between; the open one in gold; the answer in reading text. Match the mock-up `.superpowers/r10/qa-a-list.png`.
- [ ] **Step 4: Run** the two files and `npx vitest run tests/unit/ui`. Expected: PASS.
- [ ] **Step 5: Commit**: `qa: all the questions in one list beside the tower; a question asked turns the ring to it`.

### Task 3: A project opens its page in place

**Files:**
- Modify: `src/ui/projectOpen.tsx` (`openAt`, `clickOnWorld`, `openBead`), `src/scene/bob/focus.ts` (`focusGoalFor`)
- Test: `tests/unit/ui/project-open.test.ts`, `tests/unit/scene/bob-focus.test.ts`

**Interfaces:**
- Produces: `openAt(id)` and `clickOnWorld(id)` go to the project's page (`openBead`), never `openInside`; `openBead` navigates without lifting (no flight, `frame.focus.opening` stays null); `focusGoalFor` returns null for the home and project scenes (nothing lifts), so `focusShotAt` stands on the journey's shot (the floor).

- [ ] **Step 1: Write the failing tests:**
  - `project-open.test.ts`: `'a click on a project at its floor goes to its page at once, lifting nothing'` (`openAt` and `clickOnWorld` at an area's stop: the router's `navigate` called with the project's path; `openInside` not called; `frame.focus.opening` null); `'a click while the camera glides does nothing'` (as today for `clickOnWorld`).
  - `bob-focus.test.ts`: `'never lifts a project: with its page open the camera stays at the floor'` (phase PROJECT_FOCUS, scene `'project'`: `focusGoalFor` null; after `stepFocus`, `focusLiftsAt` empty and `focusShotAt(move, now, goal, centre)` equals `goal`); the same for a page reached with no click (phase alone).
- [ ] **Step 2: Run** both files. Expected: FAIL.
- [ ] **Step 3: Implement** the behaviour above; update the doc comments of `focus.ts` and `projectOpen.tsx` (Bob, 2026-10-30: "the camera doesnt go to the project"). `openInside`, `turnInside`, `closeInside` and `viewInside` stay but nothing on the home calls them; ledger it.
- [ ] **Step 4: Run** the two files and `npx vitest run tests/unit/ui tests/unit/scene`; fix the tests that pinned the lift (update them to "nothing lifts", each with a comment).
- [ ] **Step 5: Commit**: `projects: a click opens the page in place; nothing lifts to the camera`.

### Task 4: The floor's projects glow

**Files:**
- Create: `src/scene/bob/floorGlow.ts`
- Modify: `src/scene/bob/Void.tsx` (where `path.levels` are lifted for the hover), `src/ui/WorldNames.tsx` (the hover label's number and hint, if missing)
- Test: `tests/unit/scene/bob-floor-glow.test.ts`, `tests/unit/scene/bob-void.test.ts`, `tests/unit/ui/world-names.test.ts`

**Interfaces:**
- Produces: `FLOOR_GLOW = { pulse: number; period: number }` (start 0.35, 2.8 s); `floorGlow(clock: number, reduced: boolean): number`, a multiplier from 1 to `1 + pulse` over `period`, `1 + pulse / 2` with reduced motion.

- [ ] **Step 1: Write the failing tests:**
  - `bob-floor-glow.test.ts`: `'pulses the light of a floor\'s projects between 1 and 1 + pulse over its period'`; `'stands still at half with reduced motion'`; `'is the same at the same clock'`.
  - `bob-void.test.ts` (source, as its other tests read `Void.tsx`): the levels of the projects of the area at rest (`journeyAt(...).stretch === 'area'`) are multiplied by `floorGlow(clock.time, reducedMotion)` before the hover's lift, and nowhere else.
  - `world-names.test.ts`: `'a name on hover shows its project\'s number over it and "Klik om te openen" under it'` (the site's own words: the area caption's number line and hint, from the dictionary); skip this test and its code if the names already show both (check first, ledger which).
- [ ] **Step 2: Run** both files. Expected: FAIL.
- [ ] **Step 3: Implement**: `floorGlow` (a smooth sine); in `Void.tsx` apply it to the area's projects' levels at an area's stop (the area's projects from the chapters' AREA unit). The hover's lift and the world's names on hover stay as they are.
- [ ] **Step 4: Run** the files, `npx vitest run`, `npx tsc --noEmit`; then `npm run build` and the harness `STEPS=stills,storm` (the area stills within the gate; lower `pulse` if not).
- [ ] **Step 5: Commit**: `projects: the floor's projects glow softly at its stop, so it shows where to point`.

### Task 5: Proof and review

**Files:**
- Modify: `tools/proof/needle.mjs` (the steps `qa-ring`, `qa-end`, `keyboard`, the project-page steps, and a glow check), `docs/superpowers/specs/2026-10-30-bob-qa-list-floors-design.md` (build notes)
- Create: `.superpowers/r10-site-review/` (git-ignored, port 4475)

- [ ] **Step 1: Rewrite the Q&A steps**: one wheel or key from the look back lands on the list (its first question open); a click on each question turns the ring to its mark and opens it (the others closed); one more step reaches the end; scrolling back up from an opened question lands on the list's stop; on a phone the list's box stays inside the screen and below the tower's centre with the longest answer open; Tab and Enter open a question with the focus kept on it.
- [ ] **Step 2: Rewrite the project-page steps**: a click on a project at its floor brings its page with nothing lifted (the debug bridge's lifts all 0) and the floor behind; Back returns to the same floor's stop; add to `stills` a pair at a floor's stop 1.4 s apart that differ around the projects (the glow moves) and a pair with reduced motion that does not.
- [ ] **Step 3: Run** the changed steps, then the full harness in the background and the suite. Expected: every step PASS (a step failing only in the full run is rerun alone and named).
- [ ] **Step 4: Write the build notes** in the spec and make the review page (the site's stills of the Q&A list, a question opened, a floor glowing, a project's page over its floor, on a laptop and a phone, beside the mock-ups).
- [ ] **Step 5: Commit** the harness and the notes: `proof: the Q&A list, the projects in place; round 10 build notes`. Stop: Bob looks before anything is merged.
