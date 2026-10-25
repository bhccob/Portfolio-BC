# The light dive: mock-up and video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the standalone mock-up and the video that Bob sees before anything of the light dive goes into the site. They are the gate of the approved design ("A video and a mock-up first").

**Architecture:** The animation is rendered in Blender from the site's own scene, on top of the existing BOB previs scripts (`tools/blender/bob_build.py`, `bob_animate.py`, `bob_scroll.py`). It comes out as two frame sequences with per-frame data:
- **the way:** BOB seen from above, through the O, the fall past the five facts, the landing in the ring;
- **the ring:** a 360° turntable of the ring of projects.

A plain HTML/JS page, outside the site, scrubs those frames by scroll and drag and lays the facts over them as DOM labels. The video is the frames encoded.

**Scope:** This plan ends at Bob's OK on the mock-up and the video. The site build gets its own plan afterwards, written from what the mock-up settles: lengths, timings, the ring's look and the labels' placement. Nothing in this plan changes the site.

**Tech Stack:**
- Blender 5.2 (EEVEE), headless, through Python scripts;
- plain HTML, CSS and JS, with no build step;
- `sharp` from the repo's `node_modules` for the image work;
- playwright-core with headless Edge for the checks;
- Blender's own video encoder for the MP4s.

**Spec:** `docs/superpowers/specs/2026-10-25-bob-light-dive-design.md`

## Global Constraints

- **The site is untouched.** No file under `src/`, `public/`, `tests/`, `tools/proof/` or the build config changes. Bob: "dont immediately build it to website when you do animation show me a video or and a mockup before building it to website".
- **What is committed** (on `bob-dive`): only `tools/blender/light_dive.py` and `tools/blender/run_light_dive.py`.
- **Everything else lives in `.superpowers/light-dive-mockup/` in the main checkout,** which is git-excluded by `.git/info/exclude`: renders, data, the page, the checks and the videos.
- **Blender:** `"/c/Program Files (x86)/Steam/steamapps/common/Blender/blender.exe"` (5.2), EEVEE, run headless with `-b --factory-startup`.
- **The page's server:** port 4430, bound to 127.0.0.1. Never use 4399.
- **The facts, verbatim:**

  | | NL | EN |
  | --- | --- | --- |
  | 01 | 20 jaar | 20 years old |
  | 02 | Chinees van afkomst / geboren en getogen op Aruba / woont in Nederland | Chinese by descent / born and raised in Aruba / living in the Netherlands |
  | 03 | Hakka-erfgoed | Hakka heritage |
  | 04 | Oud-nationaal kampioen powerliften van Aruba | Former national powerlifting champion of Aruba |
  | 05 | Oud-nationaal kampioen tafeltennis van Aruba | Former national table tennis champion of Aruba |

  They are shown as capitals, with "/" as a line break, and in that order. No other fact appears anywhere.
- **The look:**
  - gold and violet on near-black, with no other hue;
  - no tunnel, no streaks, no burst, no flash or strobe;
  - nothing touching a bead: no line, beam or ribbon;
  - the needle at the ring's exact centre;
  - the fall in the projects' own void (violet mist band, drifting gold dust, faint traces on the glass sky).
- **The darkness gate for every tenth frame** (the site's gate for home stills): mean luma ≤ 0.11 and clipped pixels (any channel ≥ 0.99) ≤ 0.4 %. The light is smaller and softer than in the concept frame `lightdive-v1.webp`.
- **The labels:**
  - Martian Mono, weight 300, capitals, letter-spacing 0.22em, with a small number above each (01 to 05);
  - a fine gold line from the light's side to the words;
  - a glow that follows the light's brightness;
  - a font size of at least 11 CSS px at 390×844 and at least 13 CSS px at 1440×900.
- **The skip button:** "Snel naar vragen ↓" / "Skip to questions ↓", shown only in the ring, at the bottom right, never over the front bead.
- **The two sizes:**
  - desktop: 1440×900 frames;
  - phone: 585×1266 frames (390×844 at 1.5×), framed so that BOB fits the width, as the site does on a portrait phone.
- **Commits** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never edit `.impeccable/config.json`.
- **No Higgsfield generation is needed.** If any seems needed, ask Bob before a batch over 100 credits.

## Review Focus

1. **The way in must not make the eye move.** The light jumps across the screen, or the compass frames it. Bob: "it has to flow with the viewers eyes". Pinned by Task 1's centre and jump checks.
2. **The labels.** Two facts on screen at once, or a fact unreadable or off screen on the phone. Pinned by Task 3's label checks at both sizes.
3. **The drag.** It ends between two projects, overshoots, or spins the ring away from its labels. Pinned by Task 3's settle check.
4. **Scrolling back.** Up does not reverse cleanly, or sticks at the seam between the fall and the ring. Pinned by Task 3's reverse checks.
5. **The seam between the way and the ring.** A pop where the way's last frame meets the ring's first. Pinned by Task 2's seam check.

---

## File Structure

| Path | Tracked | Responsibility |
| --- | --- | --- |
| `tools/blender/run_light_dive.py` | yes | Runner. Executes `bob_build.py`, `bob_animate.py` and `bob_scroll.py` from `tools/blender/` in one namespace, the way `.superpowers/brainstorm/bob-only-o-2026-10-22/run_o.py` does, with their output folder patched to the `--out` folder. Then executes `light_dive.py`. |
| `tools/blender/light_dive.py` | yes | Builds the light dive on top of the previs scene (the light, the void's fall, the ring, the needle, the cameras). Renders the part asked for and writes its per-frame JSON. |
| `.superpowers/light-dive-mockup/frames/{way,ring}-{desk,phone}/NNNN.webp` | no | Rendered frames, converted to webp quality 82. |
| `.superpowers/light-dive-mockup/data/{way,ring}-{desk,phone}.json` | no | Per-frame data (schemas in Tasks 1 and 2). |
| `.superpowers/light-dive-mockup/check-frames.mjs` | no | Frame and data checks (Tasks 1 and 2). |
| `.superpowers/light-dive-mockup/index.html`, `mockup.js`, `mockup.css` | no | The mock-up page (Task 3). |
| `.superpowers/light-dive-mockup/check-page.mjs` | no | Headless Edge checks of the page (Task 3). |
| `.superpowers/light-dive-mockup/review.html`, `video/light-dive-{desk,phone}.mp4` | no | The video and the page Bob opens first (Task 4). |

Command shape for the renders, from the worktree root:

```
"/c/Program Files (x86)/Steam/steamapps/common/Blender/blender.exe" -b --factory-startup --python tools/blender/run_light_dive.py -- --part way|ring --size desk|phone --out <png folder>
```

---

### Task 1: The way: BOB seen from above to the ring, rendered with its data

**Files:**
- Create: `tools/blender/run_light_dive.py`, `tools/blender/light_dive.py`
- Create, untracked: `.superpowers/light-dive-mockup/check-frames.mjs`, then `frames/way-desk/`, `frames/way-phone/`, `data/way-desk.json` and `data/way-phone.json`

**Interfaces:**
- Produces: `data/way-<size>.json`, an array of 300 objects, one per frame:

  ```
  { "f": 1..300,
    "light": { "x": 0..1, "y": 0..1 },
    "glow": 0..1,
    "fact": 0..4 | null,
    "factOpacity": 0..1,
    "phase": "way-in" | "fall" | "landing" }
  ```

  - `light` is the light's projected centre on the frame, from the top left.
  - `glow` is its brightness that frame, filaments included.
  - `fact` is the index of the fact riding beside it, or null.

- [ ] **Step 1: Write `check-frames.mjs way <size>` first.** For `data/way-<size>.json` and `frames/way-<size>/`, it asserts:
  - 300 frames and 300 JSON entries;
  - the phases: frames 1–60 `way-in`, 61–260 `fall`, 261–300 `landing`;
  - the light holds the centre: from frame 8 to 60, `|x − 0.5| ≤ 0.03` and `|y − 0.5| ≤ 0.03`; in the fall, `0.45 ≤ x ≤ 0.55`;
  - no frame-to-frame jump: `hypot(Δx·W, Δy·H) ≤ 0.015·W` between consecutive frames from 1 to 260;
  - the facts:
    - `fact` is null outside the fall;
    - fact i's frames lie within 61 + 40i … 100 + 40i;
    - the facts appear in order 0, 1, 2, 3, 4, each reaching `factOpacity` 1 for at least 20 frames;
    - no frame is null in the middle of the fall for more than 8 frames;
  - the darkness gate on every tenth frame (sharp: mean luma ≤ 0.11, clipped ≤ 0.4 %).

  It prints PASS or FAIL lines and exits 1 on any FAIL.
- [ ] **Step 2: Run it before anything is rendered.**
  `node .superpowers/light-dive-mockup/check-frames.mjs way desk`
  Expected: FAIL (no data).
- [ ] **Step 3: Write `run_light_dive.py` and `light_dive.py`.** The shape of the way:
  - **Frames 1–60, the way in.**
    - Start on the previs camera's BOB-from-above pose, as at the end of `bob_scroll.py`'s rise.
    - The needle's pivot at the O's centre lights up over frames 1–8 into the light: an emissive sphere with a soft halo and a few thin emissive filament curves that change shape slowly, about once every 6 frames, never flickering.
    - From frame 8 the camera follows the light straight down through the O, keeping it projected at the frame centre.
    - The B letters and the rings leave past the frame edges, with motion blur or depth-of-field softness, and are gone by frame 40. They never frame the picture.
    - The void (the violet mist band, the drifting gold dust and the traces on the glass sky above, from `bob_scroll.py`'s void) fades in around the light from frame 20.
  - **Frames 61–260, the fall.**
    - The light falls through the void; the camera tracks it closely, slightly to the side.
    - It sways as `x = 0.5 + 0.04·sin(2π(f − 61)/80)` in screen terms.
    - Its trail is a tapered emissive curve streaming up above it, following its past positions (so it curves in a soft S).
    - Fact i rides with it over frames 61 + 40i to 100 + 40i: fading in over 6 frames, held, fading out over 6 frames. `fact` keeps the index i through its fades, so the stream has no null frames.
    - The beads are out of view below.
  - **Frames 261–300, the landing.**
    - The ring's three beads (`bob_scroll.py`'s beads) rise into view.
    - The camera eases back and levels into the ring camera of Task 2's frame 0.
    - The light slows over the ring's centre and stretches into the needle over frames 285–300, pointing at Funcial in front.
    - Frame 300 equals the ring's frame 0 pose.
  - Write the JSON from the light's world position projected through the camera (`bpy_extras.object_utils.world_to_camera_view`).
  - **The phone size** uses a 585×1266 frame, with the camera's lens chosen so the whole of BOB fits the width at frame 1, as the site's portrait framing does.
  - Write PNGs to the `--out` folder, then convert them to `frames/way-<size>/NNNN.webp` (quality 82) with sharp from the repo's `node_modules`.
- [ ] **Step 4: Render and check both sizes.**
  `node .superpowers/light-dive-mockup/check-frames.mjs way desk && node .superpowers/light-dive-mockup/check-frames.mjs way phone`
  Expected: PASS on every line.
- [ ] **Step 5: Look at frames 1, 20, 40, 60, 120 and 300 of each size.** Compare them with `lightdive-t1.webp`, `t2b`, `v1` and `ring2` on the companion: the same mood and placement, with the light smaller and softer than `v1`. Note anything off in the report.
- [ ] **Step 6: Commit** `tools/blender/run_light_dive.py` and `tools/blender/light_dive.py`, with the subject `previs: the light dive's way, from BOB seen from above through the O and the fall to the ring`.

### Task 2: The ring: a 360° turntable that meets the way without a seam

**Files:**
- Modify: `tools/blender/light_dive.py` (the `ring` part)
- Create, untracked: `frames/ring-desk/`, `frames/ring-phone/`, `data/ring-desk.json`, `data/ring-phone.json`; extend `check-frames.mjs`

**Interfaces:**
- Consumes: Task 1's frame 300 pose, which must equal ring frame 0.
- Produces: `data/ring-<size>.json`, an array of 240 objects:

  ```
  { "f": 0..239, "angle": 0..358.5, "front": 0 | 1 | 2 }
  ```

  - `angle` is the ring's turn in degrees, 1.5° per frame.
  - `front` is the index (0 Funcial, 1 Jontai Energy, 2 Cookies Clicker) of the bead nearest the front.
  - The resting frames are 0, 80 and 160.

- [ ] **Step 1: Extend `check-frames.mjs` with `ring <size>`.** It asserts:
  - 240 frames and 240 entries;
  - `angle = 1.5·f`;
  - `front` is 0 on frames 0–39 and 200–239, 1 on 40–119, and 2 on 120–199;
  - the darkness gate on every tenth frame;
  - the seam: the mean absolute pixel difference between `way-<size>/0300.webp` and `ring-<size>/0000.webp` is ≤ 2/255.
- [ ] **Step 2: Run it.** `node .superpowers/light-dive-mockup/check-frames.mjs ring desk`. Expected: FAIL (no data).
- [ ] **Step 3: Write the ring part in `light_dive.py`.**
  - The three beads stand in a ring 120° apart around the needle's pivot.
  - The camera is outside the ring and slightly above it, looking at the centre, as in `lightdive-ring2.webp`: the front bead near and large, the other two behind to the left and right.
  - The ring turns about its axis through 360° over 240 frames.
  - The needle stays at the exact centre and points at the front direction, so it always points at the bead nearest the front.
  - The front bead's halo band and porthole glow more, eased by its closeness to the front. The others stay dim.
  - Nothing joins the needle to a bead.
  - The objects inside the beads stay still, as the site keeps unselected objects still.
- [ ] **Step 4: Render and check both sizes.**
  `node .superpowers/light-dive-mockup/check-frames.mjs ring desk && node .superpowers/light-dive-mockup/check-frames.mjs ring phone`
  Expected: PASS.
- [ ] **Step 5: Commit** `tools/blender/light_dive.py`, with the subject `previs: the ring of projects turning 360 degrees about the needle, from the way's last frame`.

### Task 3: The mock-up page

**Files (all untracked, in `.superpowers/light-dive-mockup/`):**
- Create: `index.html`, `mockup.js`, `mockup.css`, `check-page.mjs`

**Interfaces:**
- Consumes: the frames and JSON from Tasks 1 and 2.
- Produces: a page served by
  `"/c/Program Files (x86)/Steam/steamapps/common/Blender/5.2/python/bin/python.exe" -m http.server 4430 --bind 127.0.0.1 --directory C:/Users/bhcco/Downloads/Portfolio-bob/.superpowers/light-dive-mockup`
  at `http://localhost:4430/`. It exposes `window.__mockup()`, which returns:

  ```
  { mode: "way" | "ring" | "end", frame, target, ringPos, ringAngle, labels: [{ index, opacity, rect }], size: "desk" | "phone" }
  ```

- [ ] **Step 1: Write `check-page.mjs` first.** It drives headless Edge (playwright-core at `C:/Users/bhcco/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright-core`) by real wheel, key, mouse and touch input at 1440×900 and at 390×844 with touch. It asserts:
  - it opens in `way` mode at frame 1;
  - wheel notches move `frame` toward `target`, eased: frame reaches within 1 of target within 1.5 s of the last notch;
  - **labels:**
    - sampled every 50 ms through a slow scroll down the whole way, at most one label has opacity > 0.5 at any time;
    - indexes appear in order 0 to 4;
    - each label's rect lies inside the viewport;
    - the computed font size is ≥ 13 px on desktop and ≥ 11 px on the phone;
  - at the way's end, `mode` is `ring` and `ringPos` is 0;
  - **turning:**
    - a wheel notch down turns to `ringPos` 1, then 2;
    - ArrowRight and ArrowLeft turn too;
    - from `ringPos` 2, a notch down goes to `end`;
  - **drag:** a 300 px mouse drag (or a 300 px horizontal swipe on the phone) spins `ringAngle`, and within 1 s of release `ringAngle` rests on 0, 120 or 240 with `ringPos` matching;
  - **reverse:**
    - a notch up at `ringPos` 0 returns to `way` mode and plays the landing backwards;
    - a scroll to the top shows frame 1;
  - **the skip button:**
    - it is visible only in `ring` mode;
    - a click shows `end` mode by a fade (the end page still);
    - "Terug" returns to the ring;
  - the NL/EN toggle switches the labels' text to the table's EN;
  - with `?reduced`, a notch moves one step (a fact, a ring position) by a fade, with no in-between frames;
  - there are no console errors.
- [ ] **Step 2: Run it** against an empty folder. Expected: FAIL.
- [ ] **Step 3: Build the page.**
  - **Frames:** a full-viewport `<canvas>` draws the current frame from preloaded `ImageBitmap`s. Use the phone set when the viewport is portrait, and the desktop set otherwise.
  - **The way:** the page is 4 viewport heights tall. The scroll position maps linearly to a target frame 1–300. The shown frame eases to it with a time constant of 0.45 s.
  - **The labels:** DOM elements in the site's label style (see Global Constraints). Each is anchored to the JSON's `light` point plus an offset: to the right on desktop, below on the phone. Its opacity is `factOpacity`, and its text-shadow strength follows `glow`.
  - **The ring:** at the way's end the scroll stops being the way's.
    - A wheel notch or a key turns to the next or previous rest frame (0, 80, 160), animated through the turntable frames over about 1.2 s, with a turn back taking over at once.
    - A drag spins at 0.25° per CSS px and settles on the nearest rest within 1 s.
    - A notch down at rest 160 goes to `end`. A notch up at rest 0 goes back into the way.
  - **The skip pill:** shown only in the ring.
  - **End mode:** shows the end page still, `end-review-1440-nl-rest.webp` or `end-review-390-nl-rest.webp` from `.superpowers/brainstorm/2211-1792824374/content/`, copied in, with a "Terug" link.
  - **The NL/EN toggle:** a small control at the top left.
  - **Reduced motion:** `?reduced` or `prefers-reduced-motion` turns steps into 150 ms fades.
- [ ] **Step 4: Start the server in the background and run the checks.**
  `node .superpowers/light-dive-mockup/check-page.mjs`
  Expected: PASS on every line at both sizes.
- [ ] **Step 5: Leave the server running** for Bob, and note its PID in the report.

### Task 4: The video and the page Bob opens first

**Files (all untracked):**
- Create: `.superpowers/light-dive-mockup/video/light-dive-desk.mp4`, `light-dive-phone.mp4`, `review.html`

**Interfaces:**
- Consumes: the frames (Tasks 1 and 2) and the page (Task 3).
- Produces: `http://localhost:4430/review.html`.

- [ ] **Step 1: Write the video check** in `check-frames.mjs video`. It asserts:
  - both MP4s exist and are 1280×800 (desktop) and 540×1168 (phone);
  - each lasts between 25 and 40 s at 24 fps;
  - each is under 12 MB.

  Run it. Expected: FAIL.
- [ ] **Step 2: Build each video's frame list.**
  - way frames 1–300;
  - a 1 s hold on ring frame 0;
  - the ring turning 0 → 80 (hold 1 s), 80 → 160 (hold 1 s), then 160 → 239 and on to frame 0, back to Funcial (hold 1 s);
  - with the facts' labels burned in.

  For the labels, render each frame of the page by headless Edge at the target size, with `__mockup` driven to that frame, or composite the label PNGs onto the frames with sharp. The labels must look exactly as on the page.
- [ ] **Step 3: Encode** with Blender's encoder, as `tools/blender/bob_encode.py` does. The variant `C:/Users/bhcco/AppData/Local/Temp/claude/C--Users-bhcco-Downloads-Portfolio-bob/4809bb71-e3a9-4a6e-be83-6d41b040b54a/scratchpad/pace-rec/bob_encode_w.py` takes the size and the quality as arguments. Use LOW quality, 24 fps.
- [ ] **Step 4: Write `review.html`,** in the style of the earlier companion pages. It holds:
  - the two videos side by side;
  - a big link to the mock-up, "Scroll it yourself", with how to use it (scroll, drag the ring, the arrows, the skip button, the NL/EN toggle);
  - what to look at:
    - the way in with the light held still;
    - the sway;
    - the facts one by one;
    - the landing and the needle at the ring's centre;
    - the ring's turn;
  - the numbers to tune, from the design's "My calls": about 4 screens long, the 0.45 s lag, the sway's size, the ring's camera.
- [ ] **Step 5: Run the video check.** Expected: PASS. Open `review.html` at 4430 in headless Edge, confirm both videos load (readyState 4), and confirm there are no console errors.
- [ ] **Step 6: Stop.** Report the links to Bob and wait for his OK. Nothing goes into the site in this plan. After his OK, or his changes, the site build gets its own plan.
