# Follow the Needle, v3: design

Date: 2026-10-20. Owner: Bob Chung. Status: agreed in a visual brainstorm with Bob, revised after his review of the first draft, and **approved by Bob on 2026-10-20**. This document is the build target.

**Supersedes:**
- Bob's earlier brief `C:\Users\bhcco\Downloads\portfolio-prompt-v2-pack\MASTER-PROMPT-v2.md` wherever the two differ. The brief stays useful background.
- The look of milestone 1 on `redesign-bench`.

**Reference frames:** `docs/design/needle-v3/`.
- Concept frames `01`–`15` show the approved look.
- `ui-01`–`ui-07` are screenshots of the clickable prototype Bob approved. They show where text and controls sit. The prototype predates the constellation home, so its backgrounds are out of date but its layout is not.
- The frames are mood and composition targets; the build does not ship them as-is (see "How it gets made").

---

## 1. Intent

Bob's words: a website that is *super cinematic*, needs *very little text*, is *3D and interactive*, where *every detail of the compass matters*, and where *each project has its own uniqueness*.

Milestone 1 was rejected on sight for four reasons:
- The compass "doesn't look like it has any use".
- Nothing was interactive, and scrolling did nothing.
- The compass did not look like his reference.
- There was too much text; it "looks like a simple website".

**Success:** a first-time visitor never sees a hard cut or a page of text. They feel they travel through one continuous world:
1. A chip is switched ON.
2. Its circuits become a compass.
3. The compass opens and they descend into the chip.
4. Inside the chip, Bob's projects float.

They remember Bob, his three homes and his work.

**Anti-goals.** Any of these makes it a failure even if it technically works:
- It looks like Bob is selling a compass: product shots of the whole object, catalogue lighting, an exploded "teardown" view.
- A flat 2D image is pasted onto a 3D object. Bob called it "uncanny" every time.
- Text-heavy pages, or scrolling that just scrolls a document.
- Decorative details with no meaning: random dots, filler particles, generic template elements.
- AI pseudo-characters or typos anywhere. Every letter and every engraved symbol is real.
- Too bright or too busy. Bob wants the whole site dark, mysterious and cinematic, with nothing that distracts: never over-exposed, never several things glowing or moving for attention at once (see §4, Restraint).

---

## 2. The journey, scene by scene

One persistent 3D world. The camera moves between scenes, and pages are places in that world. Everything is reversible: back, scroll up and Esc retrace the move.

### 2.1 Loader: frames 01–03, prototype `ui-01`

One continuous shot of about 4–6 seconds, longer only while the site really is still loading.

**Mood.** Very dark and cloudy: low smoke and mist drift over the board, and most of the frame is near-black. The laser point and the lit pins are the only strong light. Nothing is blown out. *Bob asked for this after the first draft.*

1. **Engraving while it loads.** A slim gold laser probe engraves the word **ON** into a blank black chip, stroke by stroke, with a few sparks and a wisp of smoke (frame 01).
   - The chip carries no other marking. *Bob picked "ON only" over "ON plus a small BC-2006".*
2. **Progress.** There is no number. The chip's 64 gold pins light up one by one around its edge, so the chip itself is the progress ring.
   - The last stroke of the N is cut when loading is done.
3. **Power-on.** The probe lifts and all pins glow. A dim amber current spreads along the traces, soft through the fog rather than in bright streaks (frame 02).
   - Frame 02 still shows "BC-2006" on the chip. The built chip shows ON.
4. **Circuit becomes compass.** The camera rises. The glowing traces bend into the compass rings, ticks and trigrams, half-veiled by drifting violet cloud (frame 03).
5. **Landing.** The camera settles on the home view.

The loader has no text. It plays on the first page load of a visit. Navigating inside the site never shows it again.

**Direct arrival.** A visitor may arrive straight at `/about/china/` or `/projects/funcial/`, from a CV link or a search result. The loader still plays steps 1–4. Its final flight then goes directly to that place instead of the home view, so there is no detour through home. *My call.*

### 2.2 Home: the compass over the chip, frames 04–05, prototype `ui-02`

- **The compass** (frame 05). A large Chinese luopan whose dial is built from **concentric rings of dark smoked glass**: separate layers at slightly different heights with narrow gaps between them. Each ring is engraved in gold with its own luopan band: trigrams, degree ticks and direction characters.
  - **The chip** lies beneath the glass. Its circuitry glows amber and violet through the glass and the gaps, like a city at night seen through water. This is the chip from the loader, now the ground under the compass.
  - **The needle** is long and gold, on an ornate gold pivot at the centre.
  - *Bob picked the glass-over-chip home, then the stacked rings over a single slab or a stone dial with a glass centre.*
  - The two frames each show one part. Frame 04 is the target for the camera, sky and constellations, but its dial is a single slab. Frame 05 is the target for the rings, but its country sculptures were dropped.
- **The camera.** A low angle with the whole compass in view and plenty of sky (frame 04). Bob rejected the tighter half-compass framings as "way too zoomed in".
- **The sky** is a dark violet nebula.
- **The needle** follows the mouse with a slight, heavy delay, like a real needle settling. It is a spring, not instant.
- **The three countries are constellations** (frame 04). Each is drawn by bright stars joined with thin gold lines, like an old star atlas, and tinted in the country's colour.
  - East, on the **right**, **China**: cloud-wrapped mountains, red tint.
  - North, **ahead**, **the Netherlands**: a sailing ship, blue tint. It is a nod to the age when the compass guided ships.
  - West, on the **left**, **Aruba**: a wind-bent divi-divi tree, turquoise tint.
  - **They wrap around the compass in 3D**: they are not flat on the sky. The tree and the mountains swing around the left and right edges of the dial, some of their stars passing in front of the rim and others behind it. The ship floats above and beyond the far edge. Near stars are larger and softer, far ones smaller and sharper, and the glass mirrors them. *Bob picked this "orbiting" version over a flat sky and a curved dome.*
  - The shapes are drawn by the site from real star points and lines, so they are clean and recognisable. The AI frames only show the idea.
  - *Bob chose constellations over:*
    - sculptures standing on the dial or sealed inside the glass
    - shapes drawn in light by the chip
    - country districts of the chip city
- **Parallax.** The camera drifts slightly with the cursor, as the needle does, so the constellations shift against each other and their depth reads. *My call, suggested to Bob in the brainstorm.*
- **Directions are real.** The camera looks north, so the ship is ahead, China (east) is on the right and Aruba (west) is on the left.
- **Dial engraving.** The four main directions are engraved only as 東 南 西 北 at their true bearings, as on a real luopan. No country words are engraved on the dial. This replaces milestone 1's "Noord" and the Papiamento `[FILL]`.
- **Pointing and labels.** When the needle points at a constellation, its stars brighten and its name appears beside it. Nothing else is labelled.
- **Text:** BOB CHUNG, FOLLOW THE NEEDLE (NL: VOLG DE NAALD), a small "scroll" cue, and a minimal header: language, **Lite**, sound (off by default), contact.
  - The Lite link is how a visitor turns 3D off. It is also the way to reach the career, Q&A and portrait. *My call: added to the approved header.*
- **On touch devices** there is no cursor. The needle drifts slowly between the three constellations, and a tap selects one.

### 2.3 Countries: prototypes `ui-03` and `ui-04`, frames 08/09

1. **Click a constellation** (or press Enter while the needle points at it). The camera lifts and turns toward it, and its stars drift closer (about 1.2–1.8 s, with depth of field pulling focus).
2. **The card.** A short card fades in: country name, one line, and "Press Enter ↵" (a button on touch).
3. **Enter.** A 3D fly-through *into* the constellation: its stars rush past and open onto that country's own page, at its own URL (`/about/china/`, `/about/netherlands/`, `/about/aruba/`, and the `/en/` versions). Esc or back reverses the flight.
4. **The country page.** The country's world fills the background. A 3D, extruded, gently floating title sits on the left. At most three short lines appear one by one.

**China: Hakka roots.** Bob's ancestors were Hakka Chinese farmers.
- Title: **HAKKA**.
- Card line (seen and liked in the prototype): "My roots are Hakka Chinese: farmers in the hills of southern China."
- Page lines. These are drafts written from Wikipedia and Bob's notes; Bob approves the final wording:
  1. "My ancestors were Hakka: farmers in the hills of southern China."
  2. "Hakka means 'guest families': people who moved, settled and built anew."
  3. "Hakka, a Chinese dialect, is my mother tongue." (Bob's own line, approved.)
- Backdrop: two versions exist, a **red-lacquer world** with gold terraces and a gold tulou (frame 08), and **real misty hills** with terraced farms and a round tulou house at dawn (frame 09). **Bob has not picked one yet.**

**The Netherlands and Aruba** follow the same pattern.
- Their card lines and page lines are the approved copy in `docs/art-direction.md` § Copy budget:
  - Netherlands: moved at eighteen, running, financial independence, studying software engineering (MBO 4) in Rotterdam.
  - Aruba: born and raised there, many languages, the gym.
- Their worlds are not designed yet. They are shown to Bob as concept frames before they are built (see §6).

### 2.4 Scrolling from home: frame 06

Scrolling (wheel, trackpad, touch, arrow keys) never visits the countries. It heads straight for the work, down into the chip:

1. **The rings open.** The camera moves in over the needle's pivot. As you scroll, the glass rings turn and part like a camera shutter, lifting to different heights and leaving a wide opening around the pivot (frame 06). The needle stays above as a silhouette.
2. **The descent.** The camera sinks through the opening, past the layered rings, toward the glowing chip city below.
3. **Arrival** in the void inside the chip, below.

The shot stays close and moving: never the whole object as a product view. Scrolling back up plays all of this in reverse, and the rings close again. With `prefers-reduced-motion`, each step becomes a short fade.

*Bob picked the ring "shutter" over sinking through a single glass slab and diving into a glass centre. This replaces the hard-drive morph of the first draft (needle → read arm, dial → platter, dive along a track).*

### 2.5 The void inside the chip: frames 07 and 10–12, prototype `ui-05`

- **The space** (frame 07). You are inside the chip: a vast dark-violet space between towers and terraces of glowing circuitry, like a city at night seen from inside, with amber and violet lights and light mist.
  - Far above, the underside of the glass compass forms the sky, and the long gold needle is silhouetted against it.
- **The beads.** Each project is one **porthole bead** floating freely, far apart, at different depths, drifting gently. Each is a round deep-purple lacquer bead with a gold band and a gold-rimmed porthole.
  - The beads come in category order. Today:
    - **01 · SECURE ELEMENT**: Funcial
    - **02 · FRONT PANEL**: Jontai Energy
    - **03 · OSCILLATOR**: Cookies Clicker
  - NL labels follow `docs/art-direction.md` (for example "BEVEILIGD ELEMENT").
- **The project's real screen sits inside the porthole** on a curved glass display deep in the bead. The bead's glow lights it and the gold rim reflects in it (frames 10–12), so it reads as part of the bead. *Bob explicitly rejected flat screenshots placed on the bead.* The screens in frame 07 are placeholders.
- **Scrolling** swings the needle overhead from bead to bead. The bead it points at drifts closer and lights up; the others dim.
- **The label** sits in empty space on the left: a small mono category line ("01 — SECURE ELEMENT"), the project title in heavy gold, and a tiny hint. This style comes from ref-04 in Bob's pack.
- **Click** the bead (or press Enter) to fly through its porthole into the project page.
- **Adding a project** later means adding one bead with its screenshots. No new 3D object is needed.
- **One bead per project.** There are no filler beads.
- **Where the void lives.** The void is the end of the home scroll at `/`, not a page of its own.

### 2.6 Project pages: frames 13–15, prototypes `ui-06` and `ui-07`

URL: `/projects/<slug>/`. You arrive by flying through the porthole.

- **The scene.** A dark-violet interior with a mirror floor. On the right, the project's screen stands on a large curved glass display: portrait for a phone app, landscape for a website or a game.
- **The test points.** A glowing gold track runs across the floor with gold pins on it, one pin per test point: a real architectural layer of the project. Inside the chip, the track reads as one of its traces. When the page opens, the labels light up one by one along the track. The data comes from `docs/projects-discovery.md` and `src/data/projects.ts`:
  - Funcial: LOG, GAME LAYER, MONEY RULES, VAULT, RESULT
  - Jontai Energy: 16 PAGES, DESIGN SYSTEM, THREE LANGUAGES, QUOTE PATH
  - Cookies Clicker: CLICK LOOP, 8 PRODUCERS, BOOSTS & EVENTS, SAVE, STATS
- **On the left:** the category line, the title as 3D extruded type, one summary line, and buttons.
  - **Look inside** opens a gallery of the project's real screenshots, with arrows, thumbnails and Esc to close. Today there are 8 for Funcial, 4 for Jontai and 2 for Cookies (`docs/discovery/`).
  - **Download**, for Funcial only: funcial.vercel.app/get.
  - **Code**: the GitHub repo.
- **Esc or back** flies you back out to the same bead in the void.
  - This also applies after a direct arrival. It replaces milestone 1's "Esc goes home on a direct arrival" rule for project pages. *My call.*
  - Country pages still return to the home view.

### 2.7 Lite and contact (kept from milestone 1)

- **Lite** (`/lite/`) carries all of today's copy: about, skills, career and roles, off duty, Q&A, the real portrait, and a contact link. It is where visitors land when they turn 3D off or WebGL fails, with "THE NEEDLE LOST NORTH" shown on failure.
- **Contact** (`/contact/`) keeps the Web3Forms form.
- Both are restyled to the new palette and fonts, but they stay plain, readable pages.

---

## 3. Text budget

| Screen | Text allowed |
| --- | --- |
| Loader | the engraved word ON, nothing else |
| Home | name, tagline, scroll cue, header controls; a country's name only while the needle points at its constellation |
| Country card | country, one line, "Press Enter" |
| Country page | 3D title + at most 3 short lines |
| Void | the selected bead's category line, title and one hint |
| Project page | category line, 3D title, one line, test-point labels, buttons |
| Lite, contact | full copy (by design) |

If a screen needs more words than this, the visual has to say it instead.

---

## 4. Look and feel

`docs/art-direction.md` is the reference for colour, materials, lighting, post-processing and type, with these notes:

- **Colour:** about 60 % near-black, 30 % purple, at most 6 % gold. Gold is the only warm light. The three constellation tints (turquoise, blue, red) are small accents.
- **Exposure:** dark and low-key throughout, with haze and mist rather than glare. Highlights never clip.
- **Restraint** (Bob, on approving this design: not too bright, not too much going on, so the visitor is not distracted; dark, mysterious, very cinematic):
  - One focal point per scene. Everything else sits in shadow or soft focus.
  - At rest, only slow things move: the needle's breathing, drifting mist and a few twinkling stars.
  - The constellations rest dim. Only the one the needle points at brightens; the others stay faint.
  - The chip city under the glass glows faintly. It is a hint of light below, not a light show.
  - Bloom, particles and colour stay sparse. When in doubt, take light away.
  - The concept frames, frame 04 especially, are brighter and busier than the target. The built site is darker and calmer than they are.
- **Fonts:**
  - Montserrat (Bob's pick) for the name, tagline and reading text.
  - Unbounded for heavy titles: the 3D extruded titles and the bead labels.
  - Martian Mono for small labels.
  - All are self-hosted.
- **Motion:** heavy and cinematic. Springs and damped camera moves, and no snapping. The world idles subtly: stars twinkle, mist drifts, beads float, the needle breathes. When nothing moves, nothing is rendered.
- **Lettering:** everything engraved (ON, direction characters, trigrams, degree ticks) is drawn by the site from real fonts and geometry, so it is exact in both languages. The constellations are drawn from real star points and lines in the same way.

---

## 5. Constraints

**Bob's standing rules:**
- NL (default, `/`) and EN (`/en/`), formal first-person copy.
- Never invent facts; use `[FILL: …]` until Bob supplies them.
- The real portrait only, and no faces in generated images.
- "FUNCIAL" is spelled exactly so. No AI is claimed for Funcial.
- Jontai Energy is never "client work". jontaienergy.com is his brother's build, not linked as Bob's, and the uncommitted Rewards work stays out.
- Cookies Clicker was made with a classmate who is never named. Its role line stays neutral until Bob states his part.

**Platform:**
- GitHub Pages at bhccob.me. Every page is prerendered with real DOM text, and the strict CSP from milestone 1 stays.
- Old URLs keep redirecting.
- Nothing is pushed or merged to `main` without Bob's OK.

**Quality:**
- 60 fps on a mid-range laptop and at least 30 on a mid-range phone, with quality tiers.
- The first paint is fast: the loader is light.
- No console errors.
- Full keyboard use (arrows and scroll keys, Enter, Esc, Tab with visible focus) and reduced-motion support.
- The WebGL fallback goes to Lite.

**Budget:** Higgsfield, about 307 of the agreed 400 credits left (about 93 used by the end of the brainstorm). Ask before any single batch over 100.

**Process** (Bob's explicit lesson from milestone 1): every new visual piece is shown to Bob as concept frames or a mockup and approved **before** it is built. Placeholders are never presented as the design.

---

## 6. How it gets made

**Decided:**
- **Real-time 3D in the browser** for everything the visitor interacts with or travels through:
  - the chip, board and laser
  - the glass rings, the chip city beneath them, the needle and the constellations
  - the void, the beads, the curved glass screens, the project interiors and the test points

  This is what makes it interactive and continuous, which images or video alone cannot do.
- **Project screens are the real screenshots,** used as textures on curved glass inside the 3D bead and on the project-page display, lit by the scene. The gallery shows the same screenshots full size.
- **Higgsfield** (GPT Image 2.5, Seedance 2.5, through the connected tools) supplies:
  - textures and material looks (smoked glass, lacquer, brass)
  - backdrops for the country worlds
  - concept frames for Bob's approval

  Each batch is costed first and logged in `assets/manifest.json`.
- **3D models are built in code** (*my call*): chip, pins, laser, glass rings, needle, chip city, constellations, beads, curved screens, track and pins. Every piece is geometric, so no image-to-3D models are needed now that the countries are constellations.
- **The CSP may be loosened** (*my call*): `'wasm-unsafe-eval'` and worker or `blob:` sources are allowed if compressed 3D assets (Draco, KTX2, Meshopt) are used. This allows WebAssembly, not JavaScript `eval`. Everything else in the policy stays strict.
- **The plumbing from milestone 1 is reused:** React Router 8 prerendered pages in NL and EN, Lite, the contact form, CSP, redirects, the sitemap, tests and the proof harness. *My call; Bob did not object.* The milestone-1 placeholder compass and the plain look of its pages are replaced.

**Left to the builder:**
- **Camera paths and timings,** within the ranges above.
- **Technique per scene:** whether a transition (for example the rings opening) is pure 3D or partly a scrubbed video, as long as it stays seamless.
- **Country worlds:** whether a world is full 3D or a layered backdrop with depth and parallax.
- **Small simplifications on phones and low-end devices,** for example fewer glass layers or a simpler chip city.
- **Exact material and lighting values,** within the art direction.

**Not designed yet.** Each gets concept frames for Bob first:
- the Netherlands world
- the Aruba world
- the restyled Lite and contact pages
- the exact sound design: off by default, an opt-in toggle in the header

---

## 7. Open items for Bob (none block starting the build)

1. **China backdrop:** the red-lacquer world (frame 08) or the real hills (frame 09).
2. **China page lines:** approve the two draft lines, and the formal NL versions of the new lines.
3. **Netherlands and Aruba worlds:** pick from concept frames when they are made.
4. **Cookies Clicker:** Bob's own part in the build, if he wants a role line beyond "with a classmate".

**Going live.** Today's site stays on bhccob.me until Bob approves the new one; there is no date.
- The build order puts the main journey first: loader → home → China → scroll → void → projects.
- The Netherlands and Aruba pages get interim versions only if Bob wants to launch before their worlds are approved. *My call.*

---

## 8. What changed from the brief and milestone 1

| Was | Now |
| --- | --- |
| Hero: the whole compass tilted in space, south arm pointing at the name | a low view of a glass-ring compass over a glowing chip; no south-arm portal |
| Countries as engraved and inlaid arms | three constellations wrapping around the compass in 3D |
| Scroll: exploded view of parts, then the whole hard drive | the glass rings open like a shutter and the camera descends into the chip |
| The void: a space inside the compass | the inside of the chip, a city of glowing circuitry under the glass compass |
| A unique physical object per project (abacus, panel, clockwork) | the same porthole bead for every project, holding its real screen on curved glass; uniqueness comes from the project's own screens, test points and category |
| Loader with a % counter and caption | wordless apart from the engraved ON: a pin progress ring, power-on, circuit becomes compass, all dark and misty |
| Milestone 1 pages with paragraphs of text | 3D titles plus at most three lines; full copy only on Lite |
