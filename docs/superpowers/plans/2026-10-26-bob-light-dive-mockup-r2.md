# The light dive: mock-up revision 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revise the first mock-up and its videos to Bob's four notes of 2026-10-26:
1. the light flows away from the screen into depth;
2. the light makes a gentle side move at each fact;
3. the camera glides round the ring with the scroll and settles on the nearest project;
4. the end page slides up from below after the last project.

Then show him again. Nothing goes into the site.

**Architecture:** This revision uses the same pipeline as the first mock-up (plan `2026-10-25-bob-light-dive-mockup.md`): Blender renders of the way and the ring with per-frame data, a plain page that scrubs them, and videos captured from the page.
- **The way** (frames 61–300) is re-rendered with a chase camera behind the light and the side moves.
- **The ring** is re-rendered as a camera orbit round fixed beads.
- **The page** drives the ring and the end sheet continuously by scroll.

Frames 1–60 (the way in) and the ring's layout, glow and needle stand.

**Tech Stack:** As in the first mock-up:
- Blender 5.2 (EEVEE, headless);
- plain HTML, CSS and JS;
- sharp;
- playwright-core with msedge;
- `bob_encode_w.py` (now in the mock-up folder).

**Spec:** `docs/superpowers/specs/2026-10-25-bob-light-dive-design.md` (revised 2026-10-26: goals 2, 4 and 4b, and "My calls")

## Global Constraints

- **Everything binding on the first mock-up still binds.** Copy that plan's Global Constraints section in full: the site untouched, the facts verbatim, gold and violet, no tunnel, streaks or burst, the darkness gate, the labels' style, the ports, and the commit trailer. These lines are added:
- **The light flows away into depth.** In the fall the camera follows close behind the light, and the light stays near the middle of the screen (`0.36 ≤ x ≤ 0.64`, `0.38 ≤ y ≤ 0.62`). The void opens ahead. Dust drifts past round, with no motion blur, slowly, never as speed lines.
- **One side move per fact.**
  - For fact i (window frames 61 + 40i … 100 + 40i), the light's screen x eases from 0.5 to `0.5 + s·0.10` at the window's centre, frame 81 + 40i, and back to 0.5 at its end.
  - `s` = −1 for facts 01, 03 and 05 (left) and +1 for 02 and 04 (right).
  - The eased curve has no corners: `x = 0.5 + s·0.10·sin²(π·(f − (61 + 40i)) / 40)`.
  - On the phone, use the same curve at `0.08`.
- **The label rides on the side the light moves away from.** On desk: fact 01's label to the light's right, fact 02's to its left, and so on. On the phone it hangs below the light, as now.
- **The ring's camera orbits round fixed beads.**
  - The beads stay at Task 1's `ring_bead_position` angles (0°, 120° and 240°).
  - The camera keeps `ring_camera_pose(size)`'s distance, height, pitch and lens, and moves in azimuth only.
  - The needle turns to point at the bead the camera faces.
  - The front glow and the back-bead lift follow each bead's angle relative to the camera.
  - The void's mist band and wisps are made world-fixed so they shift as the camera orbits. The dust and the glass sky are already world-fixed.
- **The end sheet** is the end page's still. It slides up from below over the ring at Cookies Clicker, following the scroll.

## Review Focus

1. **The fall still reads as 2D or as a warp.** Either nothing seems to move toward the camera, or the dust streaks into speed lines. Pinned by Task 1's round-dust and parallax checks.
2. **The side moves.** They are too strong, too sharp, or out of step with the facts. Pinned by Task 1's curve check.
3. **The ring's scroll fights the visitor.** It settles while the visitor is still scrolling, overshoots, or traps the scroll between the ring and the end sheet. Pinned by Task 3's glide, settle and handover checks.
4. **The orbit shows no 3D.** The background stays fixed while the camera moves. Pinned by Task 2's background-shift check.
5. **The end sheet.** It jumps rather than slides, or does not come back down. Pinned by Task 3's sheet checks.

---

### Task 1: The way, revised: away into depth, with a side move per fact

**Files:**
- Modify: `tools/blender/light_dive.py` (the way part: frames 61–300; 1–60 unchanged)
- Modify, untracked: `.superpowers/light-dive-mockup/check-frames.mjs` (the way part); re-render `frames/way-desk/`, `frames/way-phone/`, `data/way-*.json`

**Interfaces:**
- Produces: `data/way-<size>.json` with the existing keys, plus `side: -1 | 1 | null`, the side the light moves to for the current fact (null outside facts).

- [ ] **Step 1: Update `check-frames.mjs way <size>`.** Replace the fall's `0.45 ≤ x ≤ 0.55` band with these checks:
  - the side-move curve: every fall frame within ±0.015 of `0.5 + s·A·sin²(π·(f − (61 + 40i))/40)` (A = 0.10 desk, 0.08 phone), with `s` alternating −, +, −, +, −, and `side` matching `s`;
  - the light in the middle box (Global Constraints);
  - **round dust:** in fall frames 70, 110, 150, 190 and 230, no lit speck's long axis is more than 2.8 × its short axis (the same measure the first mock-up's passage check used);
  - **parallax:** between fall frames 100 and 110, the median displacement of the tracked dust specks is at least 2 px and points away from the light's position. That shows the void opening ahead, not standing still.

  Keep every other way check: the counts, the extras, the phases, the centre band 8–60, the jumps, the facts' windows and hold, the darkness gate and floor, and the pixel-to-data tie.
- [ ] **Step 2: Run it against the current frames.** Expected: FAIL on the curve, `side` and parallax checks.
- [ ] **Step 3: Change the way part in `light_dive.py`.**
  - **The chase.** From frame 60 the camera turns smoothly, over about 20 frames, from looking straight down into a chase behind and slightly above the light, which travels away into the void. The mist band's horizon sits ahead, in the upper third.
  - **The side moves.** The light's path is solved so its projection follows the side-move curve. The trail streams back toward the camera.
  - **The landing (261–300)** eases from the chase into the ring camera of frame 300. The light becomes the needle as before, and frame 300's pose is unchanged.
  - **Data.** Write `side` per frame, and keep `light` measured through the camera projection.
- [ ] **Step 4: Render both sizes and run** `check-frames.mjs way desk && … way phone`. Expected: every line PASS. Look at frames 60, 70, 81, 100, 121, 160, 201, 241, 280 and 300 of each size.
- [ ] **Step 5: Commit** `tools/blender/light_dive.py` with the subject `previs: the way, revision 2: the light flows away into depth, with a side move at each fact`.

### Task 2: The ring, revised: the camera orbits round fixed beads

**Files:**
- Modify: `tools/blender/light_dive.py` (the ring part, and the void's band and wisps made world-fixed for the ring)
- Modify, untracked: `check-frames.mjs` (the ring part); re-render `frames/ring-*`, `data/ring-*.json`

**Interfaces:**
- Consumes: frame 300 of Task 1, which equals ring frame 0.
- Produces: `data/ring-<size>.json` with the existing keys, plus `cam: azimuth in degrees`. `angle` keeps meaning the turn relative to the front, so `angle = cam`, and `front` is unchanged in meaning.

- [ ] **Step 1: Update the ring checks.** Keep:
  - the counts;
  - `angle = 1.5·f`;
  - the `front` ranges;
  - the darkness gate and floor;
  - the seam, at most 2/255, against way 0300;
  - the wrap;
  - the turning median;
  - both needle tips at least 8 px clear;
  - the front glow at rests.

  Add **background shift**: between ring frames 20 and 30, the void's mist band and the glass-sky traces move on screen by at least 6 px, measured on a horizontal band crop, so the orbit shows the world moving. The beads' screen positions must still match the data's `proj`.
- [ ] **Step 2: Run against the current frames.** Expected: FAIL on background shift.
- [ ] **Step 3: Change the ring part.**
  - The beads stay fixed.
  - The camera's azimuth runs 0° → 360° over 240 frames, about the ring's axis, with `ring_camera_pose`'s distance, height, pitch and lens.
  - The needle's yaw follows the camera's azimuth, pointing at the faced bead.
  - The glow and the lift are computed from each bead's angle relative to the camera.
  - Make the mist band and wisps world-fixed for the ring, as a ring of mist round the void at the band's height. At frame 0 the picture must still match way frame 300 within the seam.
- [ ] **Step 4: Render both sizes and run the ring checks.** Expected: PASS. Look at frames 0, 20, 40, 80, 120, 160, 200 and 239 of each.
- [ ] **Step 5: Commit** `tools/blender/light_dive.py` with the subject `previs: the ring, revision 2: the camera glides round fixed beads`.

### Task 3: The page, revised: the ring and the end sheet follow the scroll

**Files (untracked, in `.superpowers/light-dive-mockup/`):**
- Modify: `index.html`, `mockup.js`, `mockup.css`, `check-page.mjs`

**Interfaces:**
- Consumes: Tasks 1 and 2's frames and data (`side`, `cam`).
- Produces: the same `window.__mockup()`, with `mode` in `"way" | "ring" | "sheet" | "end"`, and `sheet` (0 at rest, 1 covering the screen) added.

- [ ] **Step 1: Update `check-page.mjs` first.** These checks change or are added, at 1440×900 and at 390×844 with touch:
  - **way labels:** fact i's label sits on the side away from `side` on desk (left of the light when `side` = +1, right when −1), with its line still leading to the words;
  - **ring glide:**
    - a slow scroll through the ring section moves `ringAngle` continuously (sampled every 50 ms, there are values strictly between the rests);
    - during the scroll it never settles, and no settle starts while scroll input keeps arriving;
    - after the input stops, `ringAngle` settles within 1 s on 0, 120 or 240, whichever is nearest;
  - **drag:** a drag glides the ring the same way and settles on the nearest project. The page's scroll position follows the settled project, so a scroll after a drag continues from there;
  - **the end sheet:**
    - scrolling on past Cookies Clicker raises `sheet` continuously from 0 to 1 (values strictly between seen);
    - at 1 the mode is `end`;
    - scrolling back up from the end lowers it to 0 and shows the ring at 240;
    - the sheet never jumps by more than 0.08 between frames at a normal scroll;
  - **the skip pill:** it still fades straight to the end, as before;
  - **reduced motion:** the ring moves by fades between projects, and the sheet appears by a fade;
  - all the first mock-up's other checks stay: the facts verbatim, one label at a time, font sizes, keys, NL/EN, focus, the failed-frame line, and no console errors.
- [ ] **Step 2: Run against the current page.** Expected: FAIL on the new lines.
- [ ] **Step 3: Change the page.**
  - **The scroll's length:**
    - the way: 4 viewport heights;
    - the ring: 2 viewport heights, Funcial → Jontai Energy → Cookies Clicker, mapping linearly to `cam` 0° → 240°;
    - the end sheet: 1 viewport height.
  - **The glide.** The shown ring frame eases to the scroll's target with τ 0.45 s, as the way does. When no scroll input has arrived for 150 ms and the eased value is still, scroll the page smoothly to the nearest project's position over about 0.6 s.
  - **Drag** changes the target angle freely through 360° (0.25° per CSS px). On release it settles on the nearest project, and the page's scroll position moves to that project's place. From Cookies Clicker, dragging on to 360° comes round to Funcial, and the scroll position moves to the ring's start.
  - **The end sheet:** the end page's still, as a full-viewport layer translated up from 100 % to 0 % by the eased scroll through the end section. At 0 % the mode is `end`.
  - **Labels:** fact labels go on the side away from `side`, and the bead labels show at rest as now.
  - **Reduced motion:** steps by 150 ms fades, as before, for the ring's projects and the sheet.
- [ ] **Step 4: Run** `check-page.mjs`. Expected: every line PASS. Take and look at screenshots: the way at frames 81, 121 and 161, mid-glide, a settled project, the sheet half up, and the end, at both sizes. Leave the server on 4430 running.

### Task 4: The videos and the review page, revised

**Files (untracked):**
- Re-make: `video/light-dive-desk.mp4`, `video/light-dive-phone.mp4`
- Modify: `review.html`, and `check-frames.mjs video` if the durations change.

- [ ] **Step 1: Set the video check's duration range to 25–45 s.** Run it. Expected: PASS on the old files, which is fine. The new files must pass too.
- [ ] **Step 2: Capture the videos from the page,** as the first videos were, with the same hook approach:
  - way frames 1–300;
  - a 1 s hold on Funcial;
  - an eased glide to Jontai Energy over 1.5 s, then a 1.5 s hold;
  - an eased glide to Cookies Clicker over 1.5 s, then a 1.5 s hold;
  - the end sheet sliding up over 1.5 s;
  - a 2 s hold on the end page.

  This uses the page's own easing, so the video's pace matches the page's.
- [ ] **Step 3: Encode** with `bob_encode_w.py` (1280×800 and 540×1168, LOW, 24 fps). Run `check-frames.mjs video`. Expected: PASS.
- [ ] **Step 4: Update `review.html`.**
  - **A short "What changed" list:** Bob's four notes and what was done for each.
  - **The how-to:** scroll through the ring, drag, and the end sheet.
  - **The calls, still open from the first round:**
    - the straight trail (now behind the light; reword or drop it if the chase removed it);
    - the mist's hue;
    - the phone ring mid-glide;
    - the needle's back half and the lift;
    - a click does nothing;
    - the needle's look.
  - **Dropped:**
    - the call about the way in's dissolve, which stays as approved;
    - the note that the video's ring is slowed (it now matches the page).
  - Keep the notes on what the mock-up leaves out, the design size, the phone version, and the restart command. Add the PowerShell form: `& "…python.exe" …`.
- [ ] **Step 5: Load `review.html` in headless Edge at both sizes.** Expected: both videos at readyState 4, no console errors, no overflow. Stop for Bob's OK.
