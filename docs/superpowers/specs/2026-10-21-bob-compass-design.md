# BOB with the compass as the O: design

Date: 2026-10-21. Owner: Bob Chung. Status: **draft for Bob's approval.**
- It was agreed step by step with Bob on 2026-10-21, through concept frames and a Blender preview.
- A builder check read it cold. Its one open question, the loader's timing, was answered by Bob (§2.1).

**Supersedes** `docs/superpowers/specs/2026-10-20-needle-v3-design.md` (v3) wherever the two differ.
- The project pages, Lite, contact and the standing rules are carried over from v3 and restated here, so this document stands on its own.
- The milestone-2 build on branch `needle-v3-m2` (the chip loader, the glass-ring dial over a chip city, the constellations) is superseded as a look. Parts of its code are reused (§6).

**Reference material:**
- **Concept frames**, made with Higgsfield, in `docs/design/bob-compass/`:
  - `01`–`03`: the loader
  - `04`: the home, the approved framing
  - `05`: the same scene with the whole name in view
- **Blender preview stills**, also in `docs/design/bob-compass/`:
  - `p01`–`p04`: the loader
  - `p05`: the home
  - `p06`–`p10`: the scroll into the projects
- **Videos and the Blender file** (local, git-excluded) in `.superpowers/brainstorm/bob-wordmark-2026-10-21/blender/`:
  - `loader-to-home.mp4`: the whole loader into the home, 12.5 s
  - `bob-previs.blend`
- **The scripts that build the preview** are in `tools/blender/`: `bob_build.py`, `bob_animate.py`, `bob_scroll.py`, `bob_encode.py`.
- **v3's frames and prototype screenshots** in `docs/design/needle-v3/` still apply to the project pages (`13`–`15`, `ui-06`, `ui-07`).

The frames show mood and composition. The AI frames are brighter, busier and less exact than the target (see §4).

---

## 1. Intent

Bob's words carry over from v3: *super cinematic*, *very little text*, *3D and interactive*, *every detail of the compass matters*, and *each project has its own uniqueness*.

**Why a new design.** On reviewing milestone 2, Bob found three problems:
- The loader did not fit the compass. Claude's reading: the flat chip loader and the thick 3D dial looked like two different worlds.
- He wanted his name to be the centrepiece, with **the compass as the O of BOB**.
- He wanted the countries scrapped.

**Success:**
1. A first-time visitor watches a laser engrave **B**, then **B**, then a circle into dark glass.
2. The circle opens and a ring compass rises out of it as the **O**.
3. Scrolling opens that O like an iris and dives through it into the chip, where Bob's projects float.

It is one continuous world with no hard cuts. Visitors remember the name and the work.

**Anti-goals** (from v3, still valid). Any of these makes it a failure even if it technically works:
- It looks like Bob is selling a compass: product shots of the whole object, catalogue lighting, an exploded view.
- A flat 2D image is pasted onto a 3D object. Bob calls this "uncanny".
- Text-heavy pages, or scrolling that just scrolls a document.
- Decorative details with no meaning.
- AI pseudo-characters or typos anywhere. Every engraved mark is real: degree ticks, the eight trigrams in a real order, real letters.
- Too bright or too busy (see §4, Restraint).

---

## 2. The journey, scene by scene

One persistent 3D world. The camera moves between places, and every move is reversible: back, scroll up and Esc retrace it.

**The world:**
- A vast slab of near-black smoked glass.
- Faint gold circuit traces run beneath it: they are 45-degree PCB traces with small pads.
- Low violet smoke drifts over it.
- Below the glass is the inside of the chip.

### 2.1 Loader: frames 01–03, preview p01–p04, `loader-to-home.mp4`

One continuous shot. The preview runs 12.5 s from black to home: about 8.5 s of engraving, then about 4 s for the opening, the rise and the push-in.

**How long it runs** (Bob's pick, 2026-10-21):
- **First visit:** the full show at the preview's pace, **never shortened on a fast load**, so every first-time visitor sees the whole name cut.
  - **Slow load:** if the home's assets are still loading when the circle is due to close, the probe keeps working slowly along the circle and closes it once they are ready.
- **Skip without words:** any click, tap, scroll or key fast-forwards the rest of the loader to the home in about 1 s. There is no button and no text.
  - The input that skips is used up by the skip: it does not also scroll the page. *My call.*
- **Later visits:** a short version of 2–3 s. BOB is already engraved and glows in, the O opens, the rings rise and the camera settles on the home.
  - A "later visit" is any visit after the full show has played once in this browser, kept in `localStorage`.
  - Moving around inside the site never replays the loader.
  - If storage is unavailable, the visit counts as a first visit. *My call.*
- **What the loader waits for:** the home only: the glass, the engravings, the compass and the smoke. The void, the beads and the screenshots stream in while the visitor is on the home. If someone scrolls before they are ready, the dive holds in the glowing tunnel until they are. *My call.*
- **Giving up:** if the home's assets are not ready after 25 s, the site's existing fallback takes over: the dark poster with "THE NEEDLE LOST NORTH" and Lite one link away. *My call.*
- **Reduced motion:** the engraved name and the compass fade in within about 1 s.

The shot:

1. **Black.** Smoke and the faint traces fade in. A slim gold laser probe comes down from above.
2. **Engraving is the progress.** There is no number and no other text.
   - The probe cuts the first **B** as a thin glowing gold outline, then its middle bar.
   - It lifts, travels and cuts the second **B** and its bar.
   - Last, it cuts the circle between them.
   - Each stroke is drawn at constant speed. A bright point and a little light mark the tip; sparks are allowed but stay small.
   - The engraved word was "ON" in v3. Now the laser writes the name.
3. **The circle completes** at 100 %. Its tick marks grow outward and a thin outer ring draws itself. The probe pulls up out of frame.
4. **The opening.** The glass inside the circle closes to nothing like a camera iris, and warm light rises from the tunnel below.
5. **The compass rises** out of the opening, the rings turning slowly. Meanwhile the camera pushes in from the wide framing (the whole name, frame 05) to the home framing (frame 04).
6. **The needle** swings in and settles with a damped wobble.

**Direct arrival** (kept from v3). A visitor may arrive straight at `/projects/funcial/`, for example. The loader plays, in its full or short form by the rules above and still skippable, and its final move goes straight to that place instead of the home.

### 2.2 Home: frame 04, preview p05

- **Framing** (Bob's pick, refined twice): a low camera, close in on the compass. **About half of each B is off screen**: the left B shows its two bowls, the right B its straight back.
  - The whole compass stays in frame, with room above it for the header.
  - *Bob first liked the "surfacing" composition, then asked for it closer, then "half of each B not visible on both sides".*
- **The compass is the O.** It is an armillary compass:
  - **Four bands** of smoked violet glass, tilted at different angles like a gyroscope, around a slim double-pointed gold needle on a gold pivot. A thin gold axis runs through the centre.
  - **Each band** has:
    - rounded edges and a gold rim on both edges
    - fine degree ticks along one edge, with longer ticks every 10°
    - the eight trigrams engraved between the long ticks
  - **It stands in a round opening in the glass** and rises out of it: its lower half is below the glass, lit by the warm glow of the tunnel. The opening has a gold lip, the main engraved circle, a ring of 144 ticks and a thin outer ring.
  - *Bob picked B's overall scene (engraved gold lines in dark glass) with D's compass (the tilted glass rings).*
- **The needle** follows the cursor with a slight, heavy delay, like a real needle settling. It is a spring, not instant.
- **Idle:** the rings turn very slowly, the smoke drifts and the needle breathes.
- **Text:** none in the scene. A minimal header:
  - "Bob Chung" small on the left
  - on the right: Work, About, Contact, the language switch, and Lite
  - a small "scroll" cue at the bottom

  These are frame `2d-screen` in `.superpowers/brainstorm/bob-wordmark-2026-10-21/` and the overlay on the review page. Sound stays out until it is designed (§6).
  - **Work** scrolls to the projects. **About** opens Lite at its about section. *Both are my call.*
- **Portrait phones.** Half a B on each side of a narrow screen would leave only the compass, so the camera holds the wider framing of frame 05: the whole name across the width, the compass smaller. *My call.*
- **Touch devices** have no cursor. The needle drifts slowly on its own.

### 2.3 Scrolling from home: preview p06–p08

Scrolling (wheel, trackpad, touch, arrow keys) scrubs one continuous camera move. Scrolling back up plays it in reverse. With `prefers-reduced-motion`, each step becomes a short fade.

1. **The iris** (p06). The rings swing down flat and slide outward to the edge of the opening, like an iris opening.
   - The needle turns to point straight down.
   - The camera rises and tilts down.
   - Through the opening you already glimpse a project bead far below.
2. **BOB from above** (p07). The camera looks straight down. The whole name reads cleanly: two engraved B letters with the flattened rings as the O, which is now a doorway onto the dark below.
3. **The dive** (p08). The camera drops through the O, past the short tunnel whose walls glow warm (brightest at the bottom). The needle leads the way down. *The preview's dive is short; the build may let it linger, with light streaks.*

### 2.4 Inside the chip: preview p09–p10

- **The space.** You come out under the glass, which is now the sky: its underside carries the circuit traces, faintly lit, and the round opening glows where you came in.
  - Below and ahead is a deep dark-violet void with light mist and slowly drifting gold dust.
  - The build adds depth layers of mist and a soft beam of light falling from the opening.
- **An overview** (p09): all projects float far apart at different depths.
- **The beads.** Each project is one bead:
  - round deep-purple lacquer with fine gold veins
  - a gold halo band around its outline
  - a gold-rimmed porthole
  - behind the porthole, the project's **real screen on curved glass**, lit as part of the bead (never a flat paste)

  In category order:
  - **01 — SECURE ELEMENT**: Funcial
  - **02 — FRONT PANEL**: Jontai Energy
  - **03 — OSCILLATOR**: Cookies Clicker

  NL labels follow `docs/art-direction.md` (for example "BEVEILIGD ELEMENT").
- **Each bead also carries its project's own object** from the discovery Bob approved on 2026-10-20 (`docs/projects-discovery.md`):
  - Funcial: a platter with an abacus and a phone, with the buy-meter verdict as RESULT
  - Jontai Energy: a 16-cell solar module
  - Cookies Clicker: a clockwork movement

  The objects are small, finely made and sealed inside the bead behind the screen glass, or engraved into its gold work. Concept frames come first.
  - *Claude proposed this on 2026-10-21 and Bob said he likes the idea. It reverses v3's "the same bead for every project", so Bob confirms it when approving this document.*
  - Other bead detail planned: the category line engraved in the gold band, and test-point pins around the porthole.
- **The needle as pointer** (p10). The needle comes down with you, grown large, and swings to point at a bead.
  - The bead it points at drifts closer, turns slightly toward you and lights up. The others stay dim.
  - Scrolling further swings the needle to the next bead.
- **The label** for the selected bead is real text next to it, in the ref-04 style: a small mono category line, the title in heavy gold, and a tiny "click to open" hint.
- **Hover** (pointer devices): a bead turns slightly toward you and brightens a little.
- **Click** or Enter flies through the porthole into the project page.
- **Adding a project** later means one bead, its screenshots and its object. **One bead per project**, never filler.
- **The void is the end of the home scroll** at `/`, not a page of its own.

### 2.5 Project pages (kept from v3 §2.6): v3 frames 13–15, `ui-06`, `ui-07`

URL: `/projects/<slug>/`. You arrive by flying through the porthole.

- **The scene.** A dark-violet interior with a mirror floor. On the right, the project's screen stands on a large curved glass display: portrait for a phone app, landscape for a website or a game.
- **The test points.** A glowing gold track runs across the floor with one pin per test point, which is a real layer of the project. The labels light up one by one when the page opens. Data comes from `docs/projects-discovery.md` and `src/data/projects.ts`:
  - Funcial: LOG, GAME LAYER, MONEY RULES, VAULT, RESULT
  - Jontai Energy: 16 PAGES, DESIGN SYSTEM, THREE LANGUAGES, QUOTE PATH
  - Cookies Clicker: CLICK LOOP, 8 PRODUCERS, BOOSTS & EVENTS, SAVE, STATS
- **On the left:** the category line, the title as 3D extruded type, one summary line, and buttons.
  - **Look inside:** a gallery of the real screenshots in `docs/discovery/`, with arrows, thumbnails and Esc.
  - **Download** (Funcial only): funcial.vercel.app/get.
  - **Code:** the GitHub repo.
- **Esc or back** flies you back out to the same bead in the void, also after a direct arrival.

### 2.6 Lite and contact (kept)

- **Lite** (`/lite/`) carries all of today's copy:
  - about, skills, career and roles, off duty, Q&A, the real portrait, and contact
  - "THE NEEDLE LOST NORTH" when WebGL fails
- **Contact** (`/contact/`) keeps the Web3Forms form.
- Both are restyled to the new palette but stay plain, readable pages.
- **With the countries gone,** Lite's about section is where Aruba, the Netherlands and Bob's Hakka roots are told. v3's approved Hakka line ("Hakka, a Chinese dialect, is my mother tongue") moves there. *My call; Bob may drop it.*

### 2.7 Removed

The three countries, everywhere:
- the constellations
- the country cards and fly-throughs
- the country pages: `/about/china/`, `/about/netherlands/`, `/about/aruba/` and their `/en/` versions
- the China backdrop choice

These routes existed only on unmerged branches and were never live, so no redirects are needed.

---

## 3. Text budget

| Screen | Text allowed |
| --- | --- |
| Loader | none; the engraved B, B and circle are the only marks |
| Home | the header and the scroll cue |
| Scroll | none |
| Void | the selected bead's category line, title and one hint |
| Project page | category line, 3D title, one line, test-point labels, buttons |
| Lite, contact | full copy (by design) |

---

## 4. Look and feel

`docs/art-direction.md` stays the reference for colour, materials, lighting and type, with these notes:

- **Colour:** about 60 % near-black, 30 % violet, at most 6 % gold. Gold is the only warm light.
- **Restraint** (Bob, 2026-10-20: dark, mysterious, very cinematic, nothing that distracts):
  - One focal point per scene: the laser tip, then the compass, then the selected bead.
  - Everything else sits in shadow or soft focus.
  - At rest only slow things move: the needle breathing, the rings turning, the smoke drifting.
  - Unselected beads stay dim.
  - Bloom, particles and colour stay sparse.
  - The concept frames are brighter and busier than the target. The Blender preview is closer to the target brightness.
- **The B letters** are clean geometric monoline outlines: a straight back, two bowls (the lower one slightly larger) and the middle bar, as in the approved frames. They are drawn from geometry, not traced from a font glyph, because a glyph outline would double every line. In the preview they are 3.4 m tall and 2.1 m wide on the glass.
- **Engraving** is a thin, softly glowing gold line, half sunk into the glass.
- **Every mark is real** (anti-goal):
  - The AI frames show invented glyphs on the rings. The build uses degree ticks and the eight trigrams in the Later Heaven order.
  - The preview's trigram bar patterns are placeholders.
- **Fonts** (from v3):
  - Montserrat for the header and reading text
  - Unbounded for heavy titles (3D titles, bead labels)
  - Martian Mono for small labels

  All are self-hosted.
- **Motion:** heavy and cinematic: springs and damped camera moves, no snapping. When nothing moves, nothing renders.

---

## 5. Constraints

**Bob's standing rules** (from v3):
- NL (default, `/`) and EN (`/en/`), formal first-person copy.
- Never invent facts; use `[FILL: …]` until Bob supplies them.
- The real portrait only, and no faces in generated images.
- "FUNCIAL" is spelled exactly so. No AI is claimed for Funcial.
- Jontai Energy is never "client work". jontaienergy.com is his brother's build and is not linked as Bob's. The uncommitted Rewards work stays out.
- Cookies Clicker was made with a classmate who is never named. Its role line stays neutral until Bob states his part.

**Platform:**
- GitHub Pages at bhccob.me, every page prerendered with real DOM text, and the strict CSP stays.
- Old URLs keep redirecting.
- Nothing is pushed or merged to `main` without Bob's OK.

**Quality:**
- 60 fps on a mid-range laptop and at least 30 on a mid-range phone, with quality tiers.
- A fast first paint.
- No console errors.
- Full keyboard use and reduced-motion support.
- The WebGL fallback goes to Lite.

**Budget:** Higgsfield, about 137 of the agreed 400 credits used by the end of 2026-10-21 (balance about 556). Ask before any single batch over 100.

**Process** (Bob's standing lesson): every new visual piece, the bead objects for example, is shown to Bob as concept frames or a preview and approved **before** it is built. Placeholders are never presented as the design.

---

## 6. How it gets made

**Decided:**
- **Real-time 3D in the browser** (React Router 8 + React Three Fiber, as in v3) for everything the visitor travels through or touches.
- **Blender is now part of the pipeline** (Bob added the Blender connection on 2026-10-21 so that 3D and animation are easier). Blender authors:
  - the models: rings, needle, pivot, beads, bead objects, the probe, the opening with its lip and ticks
  - baked animation where it is fixed: the rings rising, the iris, the needle's settle
  - the scroll camera path, exported as an animation that the site scrubs by scroll position

  They are exported as compressed glTF (`.glb`).
- **In code** live everything that reacts to the visitor or the network:
  - the engraving reveal, paced by real loading progress
  - the needle's spring toward the cursor
  - scroll scrubbing, hover and selection
  - quality tiers
- **Engravings** (B letters, circle, ticks, traces) are curve geometry revealed by a draw-progress value, as `bevel_factor_end` does in the preview.
- **Effects that do not carry over from Blender** are rebuilt in the browser:
  - volumetric smoke: layered soft textures and a light shader
  - glass: physical transmission on the desktop tier, a cheaper look on phones
  - the floor's reflections: a reflector
  - bloom: post-processing
- **Project screens** are the real screenshots, as textures on curved glass, lit by the scene.
- **Higgsfield** (through the connected tools) makes concept frames and textures. Each batch is costed first.
- **The CSP** may allow `'wasm-unsafe-eval'` and worker or `blob:` sources for compressed assets (from v3).
- **Reused from milestone 1:** the plumbing (prerendered NL/EN pages, Lite, contact, CSP, redirects, sitemap, tests, the proof harness).
- **Reused from milestone 2** (branch `needle-v3-m2`, unmerged) wherever it fits:
  - the laser probe and engraving effect
  - the scroll system, the state machine and the tests

  Its chip city, dial and constellations are dropped.
- **Starting point:** the preview scripts in `tools/blender/` build a working scene and its animation. Their dimensions and timings (§7) are the starting values for the real asset file.

**Left to the builder:**
- exact camera paths and timings, within the shape above
- technique per transition, as long as it stays seamless
- simplifications on phones and low-end devices: fewer glass bands, no smoke layers, simpler glass
- exact material and lighting values, within the art direction

**Not designed yet** (concept frames or a preview first, then Bob's OK):
- the three bead objects, and how they sit in the bead
- the restyled Lite and contact pages
- sound (off by default, an opt-in toggle in the header)

---

## 7. Preview values (starting points, from `tools/blender/`)

- **Scale and placement** (metres):
  - B letters: 3.4 tall, 2.1 wide; left B at x −4.25, right B at x 2.15.
  - Opening: radius 1.585. Engraved circle: radius 1.66. Outer ring: radius 1.88.
  - Compass: four bands of radius 1.40–1.56; centre 0.55 above the glass at home.
- **Home camera:** 50 mm lens, 8.8 m from the compass, 13° above.
- **Loader camera:** starts 13.8 m away, 14° above.
- **Loader timing** at 24 fps:
  - left B: frames 18–66; its bar: 74–84
  - right B: 96–144; its bar: 152–162
  - circle: 174–222
  - ticks and outer ring: 220–244
  - iris: 228–244
  - rings rise: 236–288
  - camera push-in: 228–292
- **Scroll** (frames 301–480 of the preview):
  - iris: 300–346
  - BOB from above: 362–372
  - dive: 372–420
  - overview: 442
  - first project: 478
- **Beads** (in the void): radius 0.95.
  - Funcial at (1.2, 3.6, −6.9)
  - Jontai at (−5.0, 9.5, −5.7)
  - Cookies at (5.4, 13.0, −8.7)

---

## 8. Open items for Bob (none block planning)

1. **Bead objects:** confirm the abacus, solar module and clockwork come back inside the beads (§2.4).
2. **About on Lite:** the countries and the Hakka line live in Lite's about text (§2.6), or are dropped.
3. **Cookies Clicker:** Bob's own part, if he wants a role line beyond "with a classmate".
4. **Branch `needle-v3-m2`:** kept unmerged as a parts source, or deleted once its reusable parts are carried over.

**Going live.** Today's site stays on bhccob.me until Bob approves the new one; there is no date.

---

## 9. What changed from v3

| v3 | Now |
| --- | --- |
| The loader engraves ON on a black chip; 64 pins are the progress ring | the laser engraves B, B and the circle on dark glass; the engraving is the progress |
| A loader of about 4–6 s, paced by the download | the full show (about 12 s) on a first visit, skippable with any input; 2–3 s on later visits |
| Circuit becomes compass, then a glass-ring dial over a glowing chip city | the circle opens and an armillary compass rises out of it as the O of BOB |
| Home: the whole compass in a low wide view, the constellations around it | home: close on the compass, half of each B off screen |
| Three country constellations, cards, fly-throughs, country pages | removed; the country story lives on Lite |
| Scroll: the dial's rings part like a shutter, descent toward the chip city | scroll: the rings open like an iris, BOB seen from above, a dive through the O |
| The void: between towers of glowing circuitry, the needle overhead | the void: a deep violet space under the glass sky, the needle comes down as a pointer |
| The same bead for every project | the same bead, plus each project's own small object inside (to confirm) |
| 3D models built in code only | models and fixed animation authored in Blender and exported as glTF; interaction in code |
