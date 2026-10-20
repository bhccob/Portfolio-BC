# Follow the Needle, v3: design

Date: 2026-10-20. Owner: Bob Chung. Status: agreed in a visual brainstorm with Bob. This document is the build target.

**Supersedes:**
- Bob's earlier brief `C:\Users\bhcco\Downloads\portfolio-prompt-v2-pack\MASTER-PROMPT-v2.md` wherever the two differ. The brief stays useful background.
- The look of milestone 1 on `redesign-bench`.

**Reference frames:** `docs/design/needle-v3/`. Numbered concept frames `01`–`17` show the approved look. `ui-01`–`ui-07` are screenshots of the clickable prototype Bob approved, showing where text and controls sit. The frames are mood and composition targets; the build does not ship them as-is (see "How it gets made").

---

## 1. Intent

Bob's words: a website that is *super cinematic*, needs *very little text*, is *3D and interactive*, where *every detail of the compass matters*, and where *each project has its own uniqueness*.

Milestone 1 was rejected on sight for four reasons:
- The compass "doesn't look like it has any use".
- Nothing was interactive, and scrolling did nothing.
- The compass did not look like his reference.
- There was too much text; it "looks like a simple website".

**Success:** a first-time visitor never sees a hard cut or a page of text. They feel they travel through one continuous world:
1. A chip is engraved.
2. It powers a compass.
3. The compass becomes a machine.
4. Inside it, Bob's projects float.

They remember Bob, his three homes and his work.

**Anti-goals.** Any of these makes it a failure even if it technically works:
- It looks like Bob is selling a compass: product shots of the whole object, catalogue lighting, an exploded "teardown" view.
- A flat 2D image is pasted onto a 3D object. Bob called it "uncanny" every time.
- Text-heavy pages, or scrolling that just scrolls a document.
- Decorative details with no meaning: random dots, filler particles, generic template elements.
- AI pseudo-characters or typos anywhere. Every letter and every engraved symbol is real.

---

## 2. The journey, scene by scene

One persistent 3D world. The camera moves between scenes, and pages are places in that world. Everything is reversible: back, scroll up and Esc retrace the move.

### 2.1 Loader: frames 01–04, prototype `ui-01`

One continuous shot of about 4–6 seconds, longer only while the site really is still loading. It is very dark and low-key; Bob wants it moody, not bright.

1. **Engraving while it loads.** A slim gold laser probe engraves **BC-2006** (Bob Chung + birth year, his personal mark) into a black chip, stroke by stroke, with sparks and a thin wisp of smoke (frame 02).
2. **Progress.** There is no number. The chip's 64 gold pins light up one by one around its edge, so the chip itself is the progress ring. *Bob chose this (option B).*
3. **Power-on at 100%.** The last stroke finishes and the probe lifts. Amber current races out along every trace of the dark purple board (frame 03).
4. **Circuit becomes compass.** The camera rises. The glowing traces bend into the dial's rings, ticks and trigrams, so the board becomes the luopan dial, and the probe standing on the chip becomes the compass needle (frame 04).
5. **Landing.** The camera sweeps down and settles low across the dial: the home view.

The loader has no text. It plays on the first page load of a visit. Navigating inside the site never shows it again.

**Direct arrival.** A visitor may arrive straight at `/about/china/` or `/projects/funcial/`, from a CV link or a search result. The loader still plays steps 1–4. Its final flight then goes directly to that place instead of the home view, so there is no detour through home. *My call.*

### 2.2 Home: "standing on the dial", frame 05, prototype `ui-02`

- **The world.** A very low camera grazes across a gigantic Chinese luopan dial that reads as a landscape: engraved gold rings, degree ticks, the eight trigrams and real engraved direction characters. The needle passes overhead like a bridge. Above it is a violet nebula with one small gold sun.
- **The dial must be a real luopan** (ref-02 in Bob's pack): every ring and symbol has a reason to be there.
- **The needle** follows the mouse with a slight, heavy delay, like a real needle settling. It is a spring, not instant.
- **The three countries** are small, jewellery-like sculptures standing on the dial in their real compass directions. *Bob chose these over inlays, light pillars and medallions.*
  - East, **China**: cloud-wrapped mountains in red lacquer and gold.
  - North, **the Netherlands**: a sailing ship in Delft-blue porcelain. It is a nod to the age when the compass guided ships.
  - West, **Aruba**: a wind-bent divi-divi tree in sea-turquoise enamel on a small gold island.
- **Directions are real; frame 05 is mirrored.** The camera looks north, so the ship stands far ahead, China (east) is on the **right** and Aruba (west) is on the **left**. Frame 05 shows them the other way round. *My call: real directions win, and the approved look is otherwise unchanged.*
- **Dial engraving.** The four main directions are engraved only as 東 南 西 北 at their true bearings, as on a real luopan. The sculptures carry each country's identity, so no country words are engraved on the dial. This replaces milestone 1's "Noord" and the Papiamento `[FILL]`.
- **Pointing and labels.** When the needle points at a sculpture, that sculpture lights up and its name rises above it. Nothing else is labelled.
- **Text:** BOB CHUNG, FOLLOW THE NEEDLE (NL: VOLG DE NAALD), a small "scroll" cue, and a minimal header: language, **Lite**, sound (off by default), contact.
  - The Lite link is how a visitor turns 3D off. It is also the way to reach the career, Q&A and portrait. *My call: added to the approved header.*
- **On touch devices** there is no cursor. The needle drifts slowly between the three countries, and a tap selects one.

### 2.3 Countries: frame 06, prototypes `ui-03` and `ui-04`, frames 07/08

1. **Click a sculpture.** The camera glides across the dial to it (about 1.2–1.8 s, with depth of field pulling focus).
   - Frame 06 shows only the intended close-up framing and focus. The lacquer inlay in it is the rejected arm design; the camera lands on the sculpture.
2. **The card.** A short card fades in: country name, one line, and "Press Enter ↵" (a button on touch).
3. **Enter.** A 3D fly-through *into* the sculpture leads into that country's own page, at its own URL (`/about/china/`, `/about/netherlands/`, `/about/aruba/`, and the `/en/` versions). Esc or back reverses the flight.
4. **The country page.** The country's world fills the background. A 3D, extruded, gently floating title sits on the left. At most three short lines appear one by one.

**China: Hakka roots.** Bob's ancestors were Hakka Chinese farmers.
- Title: **HAKKA**.
- Card line (seen and liked in the prototype): "My roots are Hakka Chinese: farmers in the hills of southern China."
- Page lines. These are drafts written from Wikipedia and Bob's notes; Bob approves the final wording:
  1. "My ancestors were Hakka: farmers in the hills of southern China."
  2. "Hakka means 'guest families': people who moved, settled and built anew."
  3. "Hakka, a Chinese dialect, is my mother tongue." (Bob's own line, approved.)
- Backdrop: two versions exist, a **red-lacquer world** (frame 07: the mountain sculpture's own material, with gold terraces and a gold tulou) and **real misty hills** with terraced farms and a round tulou house at dawn (frame 08). **Bob has not picked one yet.**

**The Netherlands and Aruba** follow the same pattern.
- Their card lines and page lines are the approved copy in `docs/art-direction.md` § Copy budget:
  - Netherlands: moved at eighteen, running, financial independence, studying software engineering (MBO 4) in Rotterdam.
  - Aruba: born and raised there, many languages, the gym.
- Their worlds are not designed yet. They are shown to Bob as concept frames before they are built (see §6).

### 2.4 Scrolling from home: frames 09–10

Scrolling (wheel, trackpad, touch, arrow keys) never visits the countries. It heads straight for the work:

1. **The needle becomes the arm.** The camera drops close and rides behind the needle. As you scroll, the needle stretches into a hard-drive read arm, and the engraved dial melts into a mirror-polished platter, with purple magnetic field lines rising (frame 09). The shot stays close-up: never the whole object, never a product view.
2. **The dive.** The camera skims the platter and follows a glowing gold track into the centre of the instrument (frame 10).
3. **Arrival** in the void, below.

Scrolling back up plays all of this in reverse. With `prefers-reduced-motion`, each step becomes a short fade.

### 2.5 The void: your projects as beads, frames 11–14, prototype `ui-05`

- **The space.** You are inside the compass: a vast dark-violet space, giant faint dial rings curving across the horizon, and gold dust. A colossal golden needle floats in the middle.
- **The beads.** Each project is one **porthole bead** floating freely, far apart, at different depths, drifting gently. Each is a round deep-purple lacquer bead with a gold band and a gold-rimmed porthole.
  - The beads come in category order. Today:
    - **01 · SECURE ELEMENT**: Funcial
    - **02 · FRONT PANEL**: Jontai Energy
    - **03 · OSCILLATOR**: Cookies Clicker
  - NL labels follow `docs/art-direction.md` (for example "BEVEILIGD ELEMENT").
- **The project's real screen sits inside the porthole** on a curved glass display deep in the bead. The bead's glow lights it and the gold rim reflects in it (frames 12–14), so it reads as part of the bead. *Bob explicitly rejected flat screenshots placed on the bead.*
- **Scrolling** swings the giant needle from bead to bead. The bead it points at drifts closer and lights up; the others dim.
- **The label** sits in empty space on the left: a small mono category line ("01 — SECURE ELEMENT"), the project title in heavy gold, and a tiny hint. This style comes from ref-04 in Bob's pack.
- **Click** the bead (or press Enter) to fly through its porthole into the project page.
- **Adding a project** later means adding one bead with its screenshots. No new 3D object is needed.
- **One bead per project.** Frame 11 shows extra empty beads; there are no filler beads.
- **Where the void lives.** The void is the end of the home scroll at `/`, not a page of its own.

### 2.6 Project pages: frames 15–17, prototypes `ui-06` and `ui-07`

URL: `/projects/<slug>/`. You arrive by flying through the porthole.

- **The scene.** A dark-violet interior with a mirror floor. On the right, the project's screen stands on a large curved glass display: portrait for a phone app, landscape for a website or a game.
- **The test points.** A glowing gold track runs across the floor with gold pins on it, one pin per test point: a real architectural layer of the project. When the page opens, the labels light up one by one along the track. The data comes from `docs/projects-discovery.md` and `src/data/projects.ts`:
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
| Loader | none |
| Home | name, tagline, scroll cue, header controls; a country's name only while the needle points at it |
| Country card | country, one line, "Press Enter" |
| Country page | 3D title + at most 3 short lines |
| Void | the selected bead's category line, title and one hint |
| Project page | category line, 3D title, one line, test-point labels, buttons |
| Lite, contact | full copy (by design) |

If a screen needs more words than this, the visual has to say it instead.

---

## 4. Look and feel

`docs/art-direction.md` is the reference for colour, materials, lighting, post-processing and type, with these notes:

- **Colour:** about 60 % near-black, 30 % purple, at most 6 % gold. Gold is the only warm light.
- **Fonts:**
  - Montserrat (Bob's pick) for the name, tagline and reading text.
  - Unbounded for heavy titles: the 3D extruded titles and the bead labels.
  - Martian Mono for small labels.
  - All are self-hosted.
- **Motion:** heavy and cinematic. Springs and damped camera moves, and no snapping. The world idles subtly: dust drifts, beads float, the needle breathes. When nothing moves, nothing is rendered.
- **Lettering:** everything engraved (BC-2006, direction characters, trigrams, degree ticks) is drawn by the site from real fonts and geometry, so it is exact in both languages.

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

**Budget:** Higgsfield, about 381 of the agreed 400 credits left. Ask before any single batch over 100.

**Process** (Bob's explicit lesson from milestone 1): every new visual piece is shown to Bob as concept frames or a mockup and approved **before** it is built. Placeholders are never presented as the design.

---

## 6. How it gets made

**Decided:**
- **Real-time 3D in the browser** for everything the visitor interacts with or travels through:
  - the chip, board and laser
  - the dial, needle and sculptures
  - the platter and track
  - the void, the beads, the curved glass screens, the project interiors and the test points
  
  This is what makes it interactive and continuous, which images or video alone cannot do.
- **Project screens are the real screenshots,** used as textures on curved glass inside the 3D bead and on the project-page display, lit by the scene. The gallery shows the same screenshots full size.
- **Higgsfield** (GPT Image 2.5, Seedance 2.5, through the connected tools) supplies:
  - textures and material looks (lacquer, enamel, porcelain, brass)
  - backdrops for the country worlds
  - concept frames for Bob's approval
  
  Each batch is costed first and logged in `assets/manifest.json`.
- **3D models** (*my call*):
  - **Built in code:** the geometric pieces: chip, board, pins, laser, dial, needle, read arm, platter, beads, curved screens, track and pins.
  - **The three sculptures** (cloud mountains, porcelain ship, divi-divi tree) start from Higgsfield image-to-3D. They are made from the approved frames, costed first and paid from the remaining credits, then cleaned up.
  - If a sculpture looks wrong, Bob sees it next to a stylised, code-built alternative before anything is built on top of it.
- **The CSP may be loosened** (*my call*): `'wasm-unsafe-eval'` and worker or `blob:` sources are allowed if compressed 3D assets (Draco, KTX2, Meshopt) are used. This allows WebAssembly, not JavaScript `eval`. Everything else in the policy stays strict.
- **The plumbing from milestone 1 is reused:** React Router 8 prerendered pages in NL and EN, Lite, the contact form, CSP, redirects, the sitemap, tests and the proof harness. *My call; Bob did not object.* The milestone-1 placeholder compass and the plain look of its pages are replaced.

**Left to the builder:**
- **Camera paths and timings,** within the ranges above.
- **Technique per scene:** whether a transition (for example the needle-to-arm morph) is pure 3D or partly a scrubbed video, as long as it stays seamless.
- **Country worlds:** whether a world is full 3D or a layered backdrop with depth and parallax.
- **Small simplifications on phones and low-end devices.**
- **Exact material and lighting values,** within the art direction.

**Not designed yet.** Each gets concept frames for Bob first:
- the Netherlands world
- the Aruba world
- the restyled Lite and contact pages
- the exact sound design: off by default, an opt-in toggle in the header

---

## 7. Open items for Bob (none block starting the build)

1. **China backdrop:** the red-lacquer world (frame 07) or the real hills (frame 08).
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
| Hero: the whole compass tilted in space, south arm pointing at the name | low camera "standing on the dial"; no south-arm portal |
| Countries as engraved and inlaid arms | three small sculptures on the dial |
| Scroll: exploded view of parts, then the whole hard drive | close-up morph (needle → arm, dial → platter), then the dive |
| A unique physical object per project (abacus, panel, clockwork) | the same porthole bead for every project, holding its real screen on curved glass; uniqueness comes from the project's own screens, test points and category |
| Loader with a % counter and caption | wordless: engraving plus a pin progress ring, power-on, circuit becomes compass |
| Milestone 1 pages with paragraphs of text | 3D titles plus at most three lines; full copy only on Lite |
