# bhccob.me redesign: "Follow the needle" (revision 4)

## Context

Bob wants his portfolio (Astro + TypeScript, `C:\Users\bhcco\Downloads\Portfolio-bob`, live at bhccob.me) redesigned:
- more interactive, with 3D animation driven by the visitor's scroll
- seamless transitions and a premium, smooth feel
- minimal text
- a software & electrical/electronics theme
- projects as the main thing, each opening a step-by-step page where every part of the project can be clicked and explained
- the roadmap as a Q&A at the bottom
- "What I work with" cut to the full-stack foundation and working with AI
- his new fintech project added: he wrote "Funancial", but the app was renamed **Funcial** on 2026-10-18 (Funcial commit `fee214c`), repo `bhccob/Funcial`

**History:**
- **Revision 1 (2026-10-18):** a workbench dive into a toy-like device that comes apart. Milestone 1 built and verified it on `redesign-bench` (599fa6b..bdeb821, page `/lab/device/`).
- **Revision 2 (2026-10-19):** a calm Rotterdam workshop with a spotlight per section (bc80e14). A free check on the throwaway branch `spike-workshop` (2ac4bba) proved the layered-image room technique, but Bob then chose to go back to the device.
- **Revision 3 (2026-10-19):** a realistic "product launch" exploded handheld (c175a43). Milestone 2 built its hub on `redesign-bench` (up to 051750b).
- **Revision 4 (2026-10-19, this document):** Bob reviewed milestone 2 and rejected the floating device: it has no idea behind it, nothing explains why it comes apart, and he is "not trying to sell a phone". He asked for:
  - one subject used to its full potential, the way kinoria.studio uses every part of a camera
  - an object that turns freely with the cursor
  - a story that moves forward with the scroll wheel
  - transitions where two objects seem to be the same object, with every step making sense
  - a mix of his worlds (Chinese, Aruban and Dutch culture, electronics, data, fintech, security), turning into one another so smoothly that the visitor never notices how many subjects one portfolio holds

  A builder check on this revision (2026-10-19) fixed these points in place:
  - the turning axis
  - how the rings become platters and the needle becomes the arm
  - the abacus layout
  - the loader's code split
  - WebP-only textures
  - several facts

  Its implementation defaults (scroll lengths, spring constants, texture sizes) go into the milestone 3 plan.

**Inspiration studied:**
- revisions 1–3: shelbykho.com (step bar), the motionsites/Viktor Oddy workflow, aengel.io, silviamalavasi.com, portfolio-zxc.com, Junkbranding and look.ai
- revision 4:
  - **kinoria.studio:** one object whose structure is the site; the visitor performs the object's own actions
  - **fixchocolatier.com:** one bar that becomes a carousel, step by step with the scroll
  - **iamaprilrucker.com:** paths you choose, hover colours, a transition into another space
- the Wikipedia articles Bob gave: Embedded system, Electrical engineering, Electronics, Data engineering, Computer security, Financial technology, Chinese culture, China, Aruba, Netherlands

## The idea: one thread, one object

The site is **one instrument**: a Chinese luopan compass that becomes a hard drive. Every step of that change is a real fact, and every section is a part of the object:

1. **The magnetic compass** is one of China's great inventions. The luopan is its geomancer's form; its seafaring descendants guided ships between continents, the way Bob's own route runs from his Chinese heritage to Aruba to Rotterdam.
2. **In 1820, Ørsted** saw a compass needle swing when a wire laid over it carried a current. That moment joined electricity and magnetism, the ground electrical engineering stands on.
3. **The same magnetism** stores data on a hard drive's platters, and the arm that reads them is moved by a coil between magnets: electromagnetism again.
4. **Data written in tracks** is where the projects live: each project is a track, read step by step.
5. **On each project page,** the track straightens into a rod of an abacus, China's calculator, for centuries the tool for counting money in shops and accounts: fintech before the word existed. Its beads are the project's steps.

The visitor's cursor is the **pearl** that the dragon chases in a dragon dance, and the needle chases it.

## Decided by Bob

| Topic | Decision |
|---|---|
| Concept (2026-10-19) | **A mix of three concepts:** "Follow the needle" is the spine (the compass becomes a hard drive; projects are tracks). From "The dragon dance": the cursor is the dragon's glowing yellow pearl, and the needle chases it. From the same concept: the compass's pattern ring changes through Bob's homes. From "Every bead is a bit": each project's steps are abacus beads, pushed up one by one. |
| The Netherlands (2026-10-19) | **The Erasmus bridge's stay cables** fill the ring for Rotterdam, in place of the Delft blue that was proposed first. |
| Interaction (2026-10-19) | The object turns freely with the cursor; the scroll wheel moves the story; transitions make two objects seem the same; every step has a reason. |
| Categories (2026-10-18) | **Front panel** (web), **Feedback loop** (games), **Secure element** (fintech), **Bare metal** (next: embedded) |
| Kept from the old site (2026-10-18) | **Off duty** only. Terminal, engine room, origin route and clocks are dropped. |
| Funcial links (2026-10-18) | The repo (github.com/bhccob/Funcial) and the download page (https://funcial.vercel.app/get) |
| Higgsfield | GPT Image 2.5 for images and textures, Seedance 2.5 for video. Plus plan; **598 credits left on 2026-10-19, about 88 spent** on this redesign |

**Approved concept frames** (Higgsfield job IDs in Bob's account; reference only, never shipped, and their baked text is not copy):
- the compass hero: `98297482-0e52-46db-aa9a-5bc484737282`
- compass becoming a hard drive: `8ede1697-eeed-48ca-9bd2-f401b50e8bb7`
- the Funcial track with TP1–TP4: `129b2051-7767-4371-b72c-44e490861df5`
- the dragon and its pearl (for the pearl only): `aa6b9455-6ecf-4feb-9752-80f58127f169`
- the abacus rod with step beads (for the project pages): `33027210-df6e-425c-b136-42c7e432adb0`

**Standing rules:**
- Purple and yellow are the brand colours.
- Formal first-person copy in NL (default, at `/`) and EN (`/en/`).
- No game on the site.
- The real portrait only, no AI version of it (and no faces in any generated image).
- Never fabricate experience.
- Build, test and audit before any push, and ask before pushing to main.

## My calls (please check)

1. **The homes come in the order of Bob's route:** China → Aruba → Rotterdam. The mix as approved read "China → Delft blue → Aruba". This order ends in Rotterdam, so the bridge's cable can become Ørsted's wire in the very next step.
2. **Type:** unchanged and already built.
   - Unbounded for titles and names, Geist for body text, Martian Mono for labels and callouts.
   - **The compass's four direction characters** come from an open-licensed font (Noto Serif TC, SIL OFL).
     - A `tools/` script extracts their outlines with opentype.js (already a dev dependency, used by `src/og/ShareImage.ts`).
     - It writes them as path data, about 3 KB, with the font's licence notice beside it.
     - No webfont ships, and the CSP is unchanged.
     - Bob is told the font file's name, source and size before it is downloaded.
   - The old fonts go when the old home is replaced.
3. **Palette:** unchanged.
   - Board purples `#140a24` / `#1c1030`, signal yellow `#ffcf33`, cream `#f1e8d3`, PCB purple `#4b2a8a`, gold `#d9a520`.
   - The compass is purple lacquer with gilt brass, and the needle and pearl are signal yellow.
   - Other colours appear only inside their ring pattern: the Chinese lacquer red, and Aruba's sea blue, flag yellow and red star.
4. **Rendering: everything is real-time 3D** (three.js) in a dark purple void, with no background images.
   - **The space:** milestone 2's gradient backdrop, purple haze and drifting dust. There is no floor; the instrument floats.
   - **Light:** a tuned RoomEnvironment, a warm key light and a purple rim light, plus the pearl, which is itself a small warm light that moves across the brass. NeutralToneMapping.
   - **The fallback:** the stacked page uses still renders of each state.
5. **The instrument's parts.** Each part has a compass pose and a drive pose, so the change is one object, not two:

   | Part | As the compass | As the hard drive |
   |---|---|---|
   | Degree, direction and pattern rings | three concentric lacquer and brass rings | three platters: each ring's inner and outer edges grow until it is a full disc from the hub to the rim, the three slide apart in depth, and their faces wipe to mirror |
   | Trigram ring | the ring around the heaven pool | the clamp that holds the platters on the spindle |
   | Heaven pool | the round centre under the needle (where the portrait shows) | the spindle motor |
   | Needle | the magnetic needle, pivoting at its middle | the read/write arm: its tail half shortens into the coil's yoke while the pivot moves to the tail end, then the pivot lifts clear of the dial and lands at the drive's corner, so it never sweeps through the rings |
   | Wire | Ørsted's wire, laid over the needle | the voice coil at the arm's tail, between the actuator's magnets |
   | Base plate | the square base plate a luopan sits on | the drive's chassis |

   So the rings are built as **parametric rings whose radii can animate**, not as fixed geometry.

   **The dial is north-up** (a real luopan is south-up, but north-up matches maps and "Finding north"), so 東 sits on the right and 西 on the left.

   **The compass rings, centre outwards:**
   1. **The heaven pool** with the needle, under glass.
   2. **The trigram ring:** the eight trigrams in the Later Heaven arrangement, found on many luopans: ☲ south, ☵ north, ☳ east, ☱ west, ☰ northwest, ☷ southwest, ☶ northeast, ☴ southeast. Each is drawn as three lines, broken or whole, with its bottom line innermost.
   3. **The direction ring:** the four characters 北 (north), 東 (east), 南 (south), 西 (west). This is a readable simplification: a real luopan names these points 子, 午, 卯 and 酉 on its ring of 24 mountains.
   4. **The degree ring:** fine gilt ticks.
   5. **The pattern ring** (the outer one). In the hero and the loader it is plain purple lacquer with gilt rules; then it changes through the homes:
      - **China:** red lacquer with a gold key-fret (回紋) border
      - **Aruba:** sea waves with the flag's two yellow stripes and its red four-pointed star, bordered in white
      - **Rotterdam:** the Erasmus bridge's stay cables fanning from its pylon over the river. They are stylised, but the pylon and stays are checked against a photo.

   The luopan's two red crosshair threads run across the dial. There is no other text on the compass: no invented characters and no fake inscriptions.

   **The patterns are vector art drawn in code** (not generated images), so they stay crisp and exact and can morph.
   - The cable that lifts away is always its own 3D mesh lying on the ring, never part of the painted pattern.
   - One `dialSpec.ts` holds the dial's radii, ticks, bearings, glyph paths and needle shape. It feeds both the loader's SVG (rendered at build time) and the 3D geometry, so the two always match.
6. **The pearl (the cursor):**
   - A small glowing yellow sphere with a soft halo and a short trail. It follows the pointer with a slight lag, on a plane in front of the instrument.
   - **The needle always turns toward the pearl,** on a damped spring that overshoots a little and settles, like a real compass needle. The story borrows the needle at three moments: the homes, the current and the drive.
   - **The instrument leans** a few degrees toward the pearl at all times.
   - **Dragging turns it freely.** A horizontal drag spins the instrument about its own axis (the dial's centre line), a full turn or more, with inertia. The needle keeps pointing at the pearl while the dial turns under it, as a real compass does.
     - The instrument turns; the camera does not orbit.
     - A vertical mouse drag tips it, but the view never comes more than about 35° off the dial's axis, counting the section's tilt, the lean and the drag together, so it never shows a flat edge.
     - On release it eases back to the section's framing, at the nearest whole turn.
   - **The native cursor stays visible;** the pearl is an addition.
   - **Touch:**
     - The pearl drifts on a slow figure-eight, as a dancer moves a dragon's pearl. It goes to where the finger touches, then drifts again.
     - Horizontal drags spin the instrument; vertical drags scroll; touch never tips it.
     - The drift pauses after about 20 s without input, so the render loop can sleep.
   - **Keyboard:** the pearl flies to the focused link or control, so the needle points at whatever has focus.
7. **The home sequence** (Lenis + GSAP ScrollTrigger scrub, both directions, so scrolling back reverses every step).
   - **The stage:** one fixed canvas behind real page sections. Each section is a heading with its text, and has its own ScrollTrigger feeding the pure choreography, which is the only source of every 3D pose. GSAP only reports progress.
   - **Text placement:**
     - Text never sits on the dial and stays still while the 3D moves.
     - On wide screens it sits in a left column, with the instrument offset to the right; on phones the instrument sits at the top and the text below.
     - One section's text shows at a time.

   Each step names the object that carries over, so no step is a plain cut:
   1. **Hero:** the compass, the needle chasing the pearl, **BOB CHUNG** and the role line ("Student software engineer"), and two small hints, "Scroll" and "Drag to turn". The drag hint is hidden from screen readers, because turning is decoration with no keyboard equivalent.
   2. **About: the three homes.**
      - The camera pushes in to the heaven pool, the needle lifts a little off its pin and fades to a faint gold line, and the real portrait appears under the glass, with the existing About line (age included).
      - Then the needle leaves the pearl and swings through the homes. At each one, the new pattern paints itself around the ring, spreading both ways from the needle's bearing (for Rotterdam, from the visitor's side, since the needle is back on the pearl):
        - to **東 (east)**: the ring turns Chinese red and gold, labelled **Chinese heritage**
        - to **西 (west)**: Aruba's sea and star wash around it, labelled **Born and raised in Aruba**
        - **back to the pearl** ("here"): the bridge cables fan across the ring, labelled **Rotterdam since eighteen** (the current copy's own words)
      - Seen from Rotterdam, China lies roughly east and Aruba roughly west.
   3. **What I work with: the current.** *(Carries over: a bridge cable.)*
      - One stay cable lifts off the Rotterdam ring and pulls straight across the dial, just above the needle and along it, as Ørsted laid his wire.
      - A pulse of current runs along it, and the needle swings across, taken from the visitor's pearl. Between the pulses it tugs back toward the pearl.
      - A caption: "1820: a current moved a compass needle."
      - Two pulses, two lines: **Full-stack foundation**, then **Working with AI**, each with its existing one line. Each line appears in the text column as its pulse runs.
   4. **The change: compass → hard drive.** *(Carries over: every part, as in the table in call 5.)*
      - The wire winds itself into a coil at the needle's tail.
      - The three outer rings grow into full discs, slide apart in depth and wipe to mirror platters; the trigram ring closes into the clamp.
      - The needle's pivot moves to its tail, lifts clear and lands at the corner; the needle is now the read/write arm, with its coil between the actuator's magnets.
      - The base plate becomes the chassis.
      - A caption: "The same force that guided ships now stores data."
   5. **Projects: the tracks.** *(Carries over: the needle, now the arm.)*
      - The platter spins, and each project is one glowing track:
        1. **Funcial**
        2. **Jontai Energy**
        3. **Cookies Clicker**
        4. an empty, dashed track: **Bare metal · next**
      - The tracks run from the outer edge inwards, as a drive counts its tracks.
      - Scrolling steps the arm from track to track. On each track, the platter turns the project's four test points (TP1–TP4) under the head one by one, the way a drive reads.
      - In the text column, for the track under the head only: the name, the category, one line and "Open project".
      - Hovering a track lights it and shows only its name, as a small label; clicking a track or the link opens the project.
      - Each track has a real anchor at its scroll position, so `/#<slug>` lands on it.
   6. **Off duty: the spindle.** *(Carries over: the heaven pool, now the spindle motor.)*
      - The head parks on its ramp off the platter's edge, as a drive's does, and the camera sinks to the spindle at the centre, the spot where the portrait was.
      - **"What keeps me spinning"** ("Wat mij draaiende houdt"): running, gym and gaming as line icons orbiting with the spin, with table tennis and powerlifting faint, marked "formerly".
      - The spin speed follows the scroll speed.
   7. **Q&A:** the page unpins, and the drive rests small and dim at the side. Plain `<details>`, with the existing career copy lightly trimmed. Opening a question lights one sector of the platter (decoration only):
      - What do you do now?
      - What comes after MBO 4?
      - Which roles interest you? (the four roles, plus fintech as one short line)
      - Why these directions?
      - Where does it lead? (a company of my own)
   8. **Say hello.** *(Carries over: the whole instrument, in reverse.)* The platters stack back into the dial, the chassis back into the base plate, and the needle returns to the centre and points at the visitor's pearl. **SAY HELLO** links to `/contact` (the page stays, restyled). The ring still shows Rotterdam.
8. **The loader** (first visit to the home page only; repeat visits in a session and direct visits to other pages skip it):
   - **The drawing:** a flat SVG of the dial, face-on, made from the same `dialSpec.ts` as the 3D compass. It weighs only a few kilobytes.
   - **The code:** a small loader module of its own draws it before three.js arrives; the 3D scene loads behind it as a separate chunk. So the three.js chunk split happens in milestone 3, not later.
   - **While the site loads:** the needle spins, searching, with "FINDING NORTH · 64%" ("ZOEKT HET NOORDEN · 64%"). The textures, the ring patterns and the shader warm-up happen in this time, spread across frames.
   - **At 100%:** the needle settles on the pearl (on touch, on its resting spot). The live 3D compass takes over at exactly the same size and position, carrying on the needle's angle, so the swap is hidden. It then tilts into the hero pose.
   - **Timing:**
     - There is no click gate.
     - The loader shows for at least about 1.2 s, so the settle can be seen.
     - If the scene has not arrived after about 10 s, the loader gives up and shows the stacked page.
   - **Reduced motion** goes straight to a still of the hero, decided before the first paint.
9. **Project pages: one abacus** (Shelby's step bar + Silvia's hotspots, now beads), at `/projects/<slug>/` and `/en/projects/<slug>/`, with the slugs `funcial`, `jontai-energy` and `cookies-clicker`:
   - **Top:**
     - the name, the category label and a one-line summary
     - facts: year, type ("Personal project" / "School project"), role, stack and links
   - **The scene:** a Chinese abacus (suanpan) in purple lacquer with brass corners: two upper beads and five lower beads on each rod, one rod per project. The current project's rod is lit; the others are dim; the last, Bare metal, has no lit beads yet.
     - **The beads:** the lit rod's five lower beads are the steps: TP1 to TP4, then **Result** (the links and the finished screens), as in the approved frame. The upper beads stay at rest.
     - **Scrolling** pushes the lower beads up to the beam, one at a time. Each bead opens a short "datasheet" panel in the text column:
       - **Screen features** (Log, Game layer, Pages, Quote, Click…) show a zoomed crop of a real screenshot.
       - **Inner features** (Money rules, Vault, Design system, Languages, Producers, Boosts, Save) show a short explanation and, where it helps, a small diagram.
     - **Jumping:** clicking or dragging a bead goes to its step. The beads glint toward the pearl. A small readout shows "02 / 05".
     - **The end:** after Result, the rod's beads drop back and the light moves to the neighbouring rod: **Next project**.
   - **Screenshots:** fresh, properly framed ones captured with headless Edge from the real projects run locally (the current `cookies.png` is a 2267×604 strip).
10. **Home ↔ project navigation: separate pages with a hidden hand-over** (no persistent 3D across pages).
    - **Opening a project:** on the home, the head lands on the track, and the track uncurls into a straight glowing rod whose four test points become beads, with a fifth for the result. The screen settles on that framing.
    - **The project page** opens on the same rod, and Astro's cross-document view transition crossfades between them. Browsers without cross-document view transitions get a plain page change.
    - **Back to the drive:** the rod curls back into its track at `/#<slug>` (`/en/#<slug>`), and the home restores its scroll straight to that track through the immediate first progress. The loader is skipped.
    - A persistent canvas through Astro's ClientRouter was considered and rejected: much riskier for the controller, Lenis/ScrollTrigger teardown, the CSP and the boot failsafe.
11. **Routes:**
    - The old `/projects/web-development/` and `/projects/game-development/` redirect to Jontai Energy and Cookies Clicker.
    - The stubs that sit on the new paths are deleted, and `lighthouserc.json` is updated.
12. **No sound and no discovery counter.**
13. **Free CC0 assets** (for example a Poly Haven HDRI) may be used. Bob is told each file's name, source and size before it is downloaded.
14. **Milestone 2's device** (`three/device/*`, the studio floor and beam, the device textures except the brushed aluminium, and the `hub.webp` still) is replaced and removed once the compass lab page takes over. It stays in git history.
15. **Revision 2's spike** (branch `spike-workshop`) stays abandoned. Deleting the branch needs Bob's OK.

| Project | Track and beads (copy honest; Bob approves the final EN/NL wording) |
|---|---|
| **Funcial**: Secure element · personal project 2026 · React 19, TypeScript, Tailwind CSS, Capacitor (Android), SQLCipher, Vercel functions, Upstash Redis. **No AI** (the advisor was removed 2026-10-16, Funcial `ec0fb39`) | TP1 **Log** (a spend in seconds) · TP2 **Game layer** (XP, levels, quests, streaks; coins are cosmetic and have no money value) · TP3 **Money rules** (a pure TypeScript core does all the maths, including the offline "Should I buy it?" check) · TP4 **Vault** (local-first and encrypted on the phone; an account keeps only a locked copy, so a friend can move phones) |
| **Jontai Energy**: Front panel · personal project 2026 | TP1 **Pages** (15+) · TP2 **Design system** (one Tailwind system) · TP3 **Languages** (EN/ES/ZH, PowerShell automation) · TP4 **Quote** (the main action) |
| **Cookies Clicker**: Feedback loop (also Front panel) · school project 2025 | TP1 **Click** · TP2 **Producers** (shared AutoClicker class) · TP3 **Boosts** (timed boosts, random events) · TP4 **Save** (localStorage) |

**Funcial screenshot:** run the app locally (`npm run dev` in `C:\Users\bhcco\Downloads\Funcial`) with demo data, capture it with headless Edge, save it to `src/assets/funcial.png`, and Bob confirms it. If onboarding or the PIN screen blocks a clean capture, ask Bob for a phone screenshot.

## Assets via Higgsfield (connected Higgsfield tools; no CLI installed)

1. **Material maps** (GPT Image 2.5, high quality, 2k, flat even lighting, top-down, usable as textures). About 3–4 images, roughly 8–11 credits:
   - aged gilt brass with fine engraving grain
   - deep purple lacquer with soft wear
   - the platters' fine radial brushing
   - the chassis reuses milestone 2's brushed aluminium
2. **Everything with meaning is drawn in code:**
   - the ring patterns, the trigrams and the direction characters
   - the loader's SVG dial
   - the abacus
   Generated images never carry text or symbols.
3. **No video clip is needed;** the loader is our own drawing. Seedance stays available if a later step calls for it.
4. **Textures ship as WebP only.** KTX2 needs a WASM transcoder in blob workers, which the CSP does not allow.
5. **Budget:** about 250 credits in total (about 88 spent). Ask Bob before going past it.

## Architecture (Astro stays; object-oriented Components)

**Reused from milestones 1 and 2:**
- `BenchLayout.astro` (head, fonts, boot failsafe), the bench tokens and base CSS, Vitest and CI
- `RenderLoop`, `PixelBudget` with the quality ladder (vsync-measured limit), compileAsync warm-up
- `ChipPointer` (picking)
- the studio's `Backdrop`, `Haze` and `noise`; `Dust` gains a free-floating volume (it is built around milestone 2's beam and floor)
- the controller pattern: Lenis → ScrollTrigger, IntersectionObserver, fallback, failsafe, immediate first progress and the resize guard. `CompassStage`/`CompassStageController` are built fresh on it as one fixed canvas with a ScrollTrigger per section, not as a copy of the hub's single pinned track.
- `DragTurn`'s rule that a drag engages only after a few pixels of mostly horizontal movement. Its ±25° spring is replaced by a new `FreeTurn` (free spin with inertia).
- `Callouts` is typed to the hub's layers, so it is removed with the hub in milestone 3. It comes back, generalised, for the tracks in milestone 4 (from `051750b`).
- **Re-tuned:** milestone 2's environment light is almost black. Gilt brass and mirror platters need bright reflections, so it is re-tuned in milestone 3.

**Replaced or new** (following milestone 2's final review):
- **`three/Choreography.ts`:** a pure function from scroll progress to the state of every part and transition, per section. Each section carries its own framing (camera position, target, up vector, near plane), so close pushes stay sharp.
- **`three/instrument/{Rings,Needle,Wire,BasePlate,HeavenPool,Tracks}.ts`:** each part takes its pose from the choreography, between its compass state and its drive state.
- **`three/instrument/dialSpec.ts`:** the one source of the dial's measurements, shared with the loader's SVG.
- **`three/instrument/patterns.ts`:** the vector ring patterns, painted once during the loader into ring-shaped textures, with a shader mask that sweeps one home into the next as the scroll moves.
- **`three/Pearl.ts`:** maps the pointer, touch and focus to the pearl, plus a pure, tested angle spring for the needle (the shortest way round, with a small overshoot).
- **`three/CameraRig.ts`** and **`three/TextureWarmup.ts`:** split out of the scene, as the review advised for `HubScene`.
- **`three/AbacusScene.ts`:** the project pages.
- **`ui/CompassLoader.ts`** (the SVG loader and its hand-over) and **`ui/TestPointPanel.ts`**.

**Data:**
- `src/data/projects.ts`: add Funcial, per-locale `testPoints` (each with either a screen crop or a part), a `kind`, and the track label
- `src/data/categories.ts`: the four electronics categories
- `src/i18n/*.ts`: rewritten, minimal

**Other:**
- **Review page:** `/lab/compass/` and `/en/lab/compass/` (noindex, out of the sitemap) replace `/lab/device/` during the build, and are removed when the new home ships.
- **Milestone 2's hub** is removed at the end of milestone 3:
  - `three/device/*`, `Floor`, `Beam`, `HubScene`, `HubChoreography` and `HubStage*`
  - `hub.webp`
  - both `/lab/device/` pages
  - the brushed aluminium texture is kept and moved
- **Accessibility:**
  - Every section is a real heading, so the long scroll can be skipped through.
  - Text has its own column off the brass and lacquer, so its contrast holds.
- **Old code:** the old home's components, scripts and fonts are removed when the new home replaces it. The list is in revision 1 (`git show 599fa6b:docs/superpowers/specs/2026-10-18-portfolio-redesign-design.md`, "Architecture → Remove").
- **The Edge proof harness** moves from the scratchpad into the repo (`tools/proof/`), so every milestone's screenshots and recordings can be made again.
- **Fallbacks:**
  - **Phones:** DPR capped at 1.25, fewer particles, the drifting pearl, tap instead of hover, and portrait framing.
  - **Reduced motion or no WebGL:** a stacked page with a still render of each state.
  - **Without JavaScript:** real HTML text.
- **Performance:**
  - a steady 60 fps scroll on an ordinary laptop. The quality ladder gains a "clearcoat off" rung for the lacquer, measured on an integrated GPU.
  - home JavaScript about 250 KB gzipped, with three.js in its own chunk behind the loader
  - under 1.5 MB before the hero
  - textures as WebP, within about 4 MB together
  - no full-screen bloom pass: glows (the pearl, the current, the tracks) are sprites or additive meshes
  - if shadows are used, the shadow map updates only when a part moves

## Build order (Bob sees each step before the next)

1. **Done:** milestone 1 (foundation and the first device) and milestone 2 (the realistic hub). Their infrastructure is reused.
2. **Milestone 3, the compass:**
   - the luopan with all its rings and materials
   - the pearl and the needle's chase
   - free drag rotation and the lean
   - the three homes painting the ring, with the portrait and the About line
   - the SVG loader, its hand-over and the three.js chunk split
   - on `/lab/compass/`; Bob reviews screenshots and a recording
3. **Milestone 4, the change:** Ørsted's wire (What I work with) → the morph into the drive → the tracks (Projects) → the spindle (Off duty) → Q&A → Say hello, every step both ways.
4. **Milestone 5, home replaces the old one:**
   - close the deferred milestone-1 items: the resize "inside" check, PixelBudget restart on resize, the CSP hash for the boot script, the shared head partial
   - remove the old code
5. **Milestone 6, project pages:** the abacus with its beads, fresh screenshots, and EN/NL copy (Bob approves the wording).
6. **Milestone 7, hardening:** phones, reduced motion and no-WebGL stills, a11y, SEO, redirects, share images, and `PRODUCT.md`/`DESIGN.md`. Then verify, and ask Bob before pushing.

## Verification

- **Type checks:** `npx -p typescript tsc --noEmit` (`astro check` hangs here), `npm test` and `npm run build`.
- **Auditor:** through Pyodide (`unittest discover tools` and `site_audit.main(['dist','--strict'])`).
- **Headless Edge** (`playwright-core` with Edge, `page.bringToFront()`):
  - the loader, its hand-over and its skips
  - the needle following the pointer, focus moving the pearl, and the free drag
  - every transition both ways
  - track hover and click, and opening a project through the uncurl
  - pushing beads TP1 → Result and moving on to the next rod
  - fps logged on the GPU and on SwiftShader
- **Phone:** a 390 px viewport with touch drags and the drifting pearl.
- **Reduced motion and no WebGL:** check that the page stacks with the stills.
- **Lighthouse:** accessibility, SEO and best practices must hold.
- **Proof for Bob:** screenshots and a recording.
- **Ask before pushing to main.**

## Not in scope / anti-goals

- No AI portrait, and no faces in generated images.
- No game or discovery counter.
- No sound.
- No invented clients, stats or availability claims.
- No invented Chinese text: only the four direction characters and the eight trigrams, drawn correctly.
- The cultural patterns are references to Bob's homes, drawn with care; nothing implies a region or family history he has not stated.
- Transitions must stay readable: one section's text at a time, and nothing that hides what the section is about.
- The career roadmap is never the headline.
