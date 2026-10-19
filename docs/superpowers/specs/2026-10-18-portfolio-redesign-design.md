# bhccob.me redesign: "Teardown" (revision 3)

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
- **Revision 3 (2026-10-19, this document):** Bob asked for the original device boot and pick-and-place loader, transitioning into the realistic "product launch" exploded view he picked from the concept images. **Inside each component** the visitor sees the details; the board holds the projects. **Every scroll step transitions creatively, so it feels fun and interactive.** He approved a six-frame storyboard.

**Inspiration studied:**
- shelbykho.com (step bar)
- the motionsites/Viktor Oddy workflow (AI image → video → scrub)
- aengel.io (a gated entry, scroll-driven worlds, a lite version for phones)
- silviamalavasi.com (one metaphor, a click gate, hotspots that fly the camera in)
- portfolio-zxc.com (an explorable 3D object)
- Junkbranding and look.ai (immersive backgrounds)

## Decided by Bob

| Topic | Decision |
|---|---|
| Hub (2026-10-19) | **The product-launch exploded view:** a dark studio with a glossy reflective floor, purple haze, dust, and one soft yellow volumetric light beam from above. The **realistic handheld** floats apart into its layers, each with a thin gold callout line to a monospace label: SCREEN — ABOUT, BOARD — PROJECTS, BATTERY — OFF DUTY, BACK PLATE — WHAT I WORK WITH. **"BOB CHUNG"** runs vertically in big yellow type along the left edge. |
| The device (2026-10-19) | **Realistic and more complex**: purple anodised aluminium frame with brass screws, a glass screen, a dense purple circuit board with gold contacts and SMD parts and a ribbon cable, a lithium battery pouch with gold tape, a back plate, USB-C, and a glowing yellow round power button. |
| Loading screen (2026-10-19) | **Two parts, in sequence:** (1) a robot arm places a "BC-2006" chip on a purple board while the site loads, with the solder glowing as it reflows; (2) at 100% the device around it boots, and its screen shows the boot. The visitor presses the power button, and the device floats apart into the hub. |
| Storyboard (2026-10-19, approved) | Hub → **screen** (About) → **pulse along a trace** to the **board** (Projects; each chip **opens up**) → **ribbon cable** to the **battery** (Off duty, charging) → **laser** engraves the **back plate** (What I work with) → the layers **snap back together** → Q&A → **Say hello** on the power button. |
| Transitions | Every move between parts is its own creative, fun, interactive transition (above), not a plain camera slide. |
| Categories (2026-10-18) | **Front panel** (web), **Feedback loop** (games), **Secure element** (fintech), **Bare metal** (next: embedded) |
| Kept from the old site (2026-10-18) | **Off duty** only. Terminal, engine room, origin route and clocks are dropped. |
| Funcial links (2026-10-18) | The repo (github.com/bhccob/Funcial) and the download page (https://funcial.vercel.app/get) |
| Higgsfield | GPT Image 2.5 for images and textures, Seedance 2.5 for video. Plus plan, ~686 credits on 2026-10-18; **about 61 credits spent** by 2026-10-19 (concepts and storyboard) |

**Approved reference images** (Higgsfield job IDs in Bob's account; reference only, never shipped as-is):
- the hub, exploded view: `1d7ca904-2d5f-4c11-95d3-c9e39ccf1dd7`
- the device boot loader: `d584c717-4ee6-4e77-a61e-7bfe659ce5c4`
- the pick-and-place loader: `8b637719-316f-4110-a9b6-6fda08a5a765`
- the storyboard:
  - screen/About `e82ae8dc-d10d-40e2-b5cd-387d8dfccfc3`
  - board pulse `6382618b-57e9-4577-a35e-e4c248334e9e`
  - decapped chip `5ca3e9ba-e344-428b-a954-f58296842545`
  - battery `0a67096f-92ec-4628-a585-2da1e5fbf129`
  - laser back plate `f47bb6ab-2c97-4ee2-b489-ebee0e132303`
  - snap together `da989c6b-f486-413a-a1b4-a2c0fa18fd13`

  The snap frame drew a taller, phone-like device. The build follows the hub image's device.

**Standing rules:**
- Purple and yellow are the brand colours.
- Formal first-person copy in NL (default, at `/`) and EN (`/en/`).
- No game on the site.
- The real portrait only, no AI version of it (and no faces in any generated image).
- Never fabricate experience.
- Build, test and audit before any push, and ask before pushing to main.

## My calls (please check)

1. **Type:** unchanged and already built.
   - Unbounded for titles and names (the vertical "BOB CHUNG" too), Geist for body text, Martian Mono for labels and callouts.
   - The old fonts go when the old home is replaced.
2. **Palette:** unchanged.
   - Board purples `#140a24` / `#1c1030`, signal yellow `#ffcf33`, cream `#f1e8d3`, PCB purple `#4b2a8a`, gold `#d9a520`.
   - The studio is near-black purple; the light beam, callouts and pulse are yellow and gold.
3. **Rendering: everything is real-time 3D** (three.js), with no background images.
   - **The studio:**
     - a gradient backdrop
     - a reflective floor (a planar reflector or a screen-space blurred mirror)
     - a soft volumetric beam (an additive cone with noise)
     - drifting dust particles
     - purple haze (fog)
   - **The device:** modelled in code to match the hub image, with GPT Image textures for the circuit board (including the silkscreened chip names and "BC-2006"), the silicon dies, the battery wrap and the brushed-metal grain.
   - **Lighting:** an HDRI or a tuned RoomEnvironment, one warm key light from the beam, and a purple rim light. NeutralToneMapping (as in milestone 1).
   - **The fallback:** the stacked page uses still renders of each state.
4. **The hub interaction:**
   - Visitors can **drag to turn** the exploded device, about ±25°, easing back.
   - Hovering a callout lights its layer and the layer lights its callout; clicking a callout jumps to that section.
   - The vertical name and the callouts are HTML anchored to projected 3D points, so they stay readable and accessible.
5. **The home sequence** (Lenis + GSAP ScrollTrigger scrub, both directions; each transition is a scrubbed timeline, so scrolling back reverses it):
   1. **Hub:** the exploded device, the callouts, the vertical name, the role line.
   2. **About (screen).** The camera pushes through the glass, and the screen's interface becomes the About:
      - the real portrait in its frame
      - one line, plus born in Aruba · Chinese heritage · Rotterdam since eighteen
      - a faint pixel grid visible at that scale
   3. **Projects (board).** A yellow electric pulse leaves the screen connector and races along a gold trace, and the camera rides it down onto the board.
      - The chips are silkscreened FUNCIAL, JONTAI ENERGY and COOKIES CLICKER; the empty socket reads "NEXT · BARE METAL".
      - Scrolling moves the pulse from chip to chip.
      - At each chip, its **lid lifts off (decap)** and its glowing die shows four labelled regions, TP1 to TP4 (the project's parts), next to the project's name, category, one line and "Open project".
      - Clicking a region or the link opens the project page.
   4. **Off duty (battery).** The camera follows the ribbon cable down to the battery.
      - The battery glows and **charges** as you scroll.
      - "What keeps me charged": running, gym and gaming as line icons orbiting it, with table tennis and powerlifting faint, marked "formerly".
   5. **What I work with (back plate).** The plate flips over, and a **laser engraves** "Full-stack foundation" and "Working with AI" into the metal with sparks, each with its one existing line.
   6. **Snap together.** The layers fly back and **snap** together with small sparks at the seams, and the whole device turns to face the visitor.
   7. **Q&A:** the page unpins; the device rests small and dim at the side. Plain `<details>`, with the existing career copy lightly trimmed:
      - What do you do now?
      - What comes after MBO 4?
      - Which roles interest you? (the four roles, plus fintech as one short line)
      - Why these directions?
      - Where does it lead? (a company of my own)
   8. **Say hello:** the power button glows, with a callout "SAY HELLO" linking to `/contact` (the page stays, restyled).
6. **The loader sequence** (first visit to the home page only; repeat visits in a session and direct visits to other pages skip it):
   1. **Pick and place.**
      - A short Seedance clip played as a small frame sequence (about 48 frames at about 960 px, ≤ 1.2 MB), scrubbed by the real loading progress.
      - A small label reads "ASSEMBLING · BOB CHUNG" with a percentage.
      - The clip's last frame matches a render of our device's board close-up.
   2. **Boot.** The camera pulls back to the whole, closed live 3D device. Its screen shows "BC-2006", a boot bar, then "PRESS POWER".
   3. **Power on.** The visitor clicks the yellow button (or a real HTML "Power on" button; Enter works). The device floats apart into the hub.
   4. **Reduced motion** goes straight to a still of the hub.
7. **Project pages** (Shelby's step bar + Silvia's hotspots), at `/projects/<slug>/` and `/en/projects/<slug>/`, with the slugs `funcial`, `jontai-energy` and `cookies-clicker`:
   - **Top:**
     - the name, the category label and a one-line summary
     - facts: year, type ("Personal project" / "School project"), role, stack and links
   - **The scene:** the project's decapped chip, large, in the studio light. Its die regions are the **test points TP1 to TP4**.
     - Scrolling walks TP1 → TP4, with a step bar.
     - Clicking a region flies the camera in and opens a short "datasheet" panel.
     - **Screen features** (Log, Game layer, Pages, Quote, Click…) show a zoomed crop of a real screenshot inside the panel.
     - **Inner features** (Money rules, Vault, Design system, Languages, Producers, Boosts, Save) show a short explanation and, where it helps, a small diagram.
   - **Screenshots:** fresh, properly framed ones captured with headless Edge from the real projects run locally (the current `cookies.png` is a 2267×604 strip).
   - **End:** the next project's chip, and back to the board.
8. **Routes:**
   - The old `/projects/web-development/` and `/projects/game-development/` redirect to Jontai Energy and Cookies Clicker.
   - The stubs that sit on the new paths are deleted, and `lighthouserc.json` is updated.
9. **No sound and no discovery counter.**
10. **Free CC0 assets** (for example a Poly Haven HDRI) may be used. Bob is told each file's name, source and size before it is downloaded.
11. **The device geometry,** taken from the approved hub and boot images:
    - **Shape:** a slim, wide slab, about 1.75 : 1 (width to depth), seen from a high three-quarter angle, with small rounded corners (radius about 8% of the depth). Milestone 1's D-pad and round buttons are **gone**.
    - **Layers, top to bottom.** Each lifts straight up in the explode (milestone 1's vertical explode, now spread more and tilted toward the camera):
      1. **Glass screen**, nearly edge to edge, with rounded corners.
      2. **Aluminium frame:** a purple anodised ring, its own layer, with four brass screws at the corners. The **yellow power button** sits on the right short end face. **USB-C**, a slot and speaker holes sit on the left long side. The frame has no callout; its power button becomes "Say hello" at the end.
      3. **Circuit board:** purple, with gold pads, SMD parts and a gold ribbon cable running down to the battery.
         - The three project chips sit in a row.
         - The empty "Next" socket sits beside them.
         - At the centre is a larger **"BC-2006" processor chip: the device's own brain, not a project.** It is the chip the robot places in the loader.
      4. **Battery:** a silver pouch with gold tape and a printed label, with its wires and connector to the board.
      5. **Back plate:** purple anodised, with four brass screws, where the laser engraving goes.
12. **Home ↔ project navigation: separate pages with a hidden hand-over** (no persistent 3D across pages).
    - **Opening a project:** the home camera flies into the chip, and the screen settles on the studio colour. The project page opens on the same framing of that chip, and Astro's cross-document view transition crossfades between them (the site already uses these).
    - **Back to the board:** returns to `/#<slug>` (`/en/#<slug>`), and the home restores its scroll straight to that chip's step through the immediate first progress. The loader is skipped.
    - A persistent canvas through Astro's ClientRouter was considered and rejected: much riskier for the controller, Lenis/ScrollTrigger teardown, the CSP and the boot failsafe.
13. **Revision 2's spike** (branch `spike-workshop`) is abandoned. Two things carry over: its lessons (contact shadows, projected floating text with leader lines, and a pure choreography function) and its `Choreography`/text-anchoring code, where useful. Deleting the branch needs Bob's OK.

| Project | Chip / die regions (copy honest; Bob approves the final EN/NL wording) |
|---|---|
| **Funcial**: Secure element · personal project 2026 · React 19, TypeScript, Tailwind CSS, Capacitor (Android), SQLCipher, Vercel functions, Upstash Redis. **No AI** (the advisor was removed 2026-10-16, Funcial `ec0fb39`) | TP1 **Log** (a spend in seconds) · TP2 **Game layer** (XP, levels, quests, streaks; coins are cosmetic and have no money value) · TP3 **Money rules** (a pure TypeScript core does all the maths, including the offline "Should I buy it?" check) · TP4 **Vault** (local-first and encrypted on the phone; an account keeps only a locked copy, so a friend can move phones) |
| **Jontai Energy**: Front panel · personal project 2026 | TP1 **Pages** (15+) · TP2 **Design system** (one Tailwind system) · TP3 **Languages** (EN/ES/ZH, PowerShell automation) · TP4 **Quote** (the main action) |
| **Cookies Clicker**: Feedback loop (also Front panel) · school project 2025 | TP1 **Click** · TP2 **Producers** (shared AutoClicker class) · TP3 **Boosts** (timed boosts, random events) · TP4 **Save** (localStorage) |

**Funcial screenshot:** run the app locally (`npm run dev` in `C:\Users\bhcco\Downloads\Funcial`) with demo data, capture it with headless Edge, save it to `src/assets/funcial.png`, and Bob confirms it. If onboarding or the PIN screen blocks a clean capture, ask Bob for a phone screenshot.

## Assets via Higgsfield (connected Higgsfield tools; no CLI installed)

1. **Textures** (GPT Image 2.5, high quality, flat even lighting, top-down, usable as material maps). About 6–8 images, roughly 17–22 credits:
   - the circuit board, with the three chip names silkscreened, "BC-2006", an empty socket, and gold pads where our chips sit
   - three silicon dies (iridescent purple and gold, each split into four regions)
   - the battery wrap (gold tape, a printed label)
   - brushed purple aluminium
2. **The pick-and-place clip** (Seedance 2.5):
   - Frames: the start frame is a macro still in the approved style; the end frame is a render of our board close-up.
   - Format: 5 s, no audio.
   - Process: check the cost, make a **480p draft** for Bob, then the 1080p final.
   - Split into WebP frames in `public/loader/` with `ffmpeg-static` from the scratchpad.
3. **Budget:** about 250 credits in total (about 61 spent). Ask Bob before going past it.

## Architecture (Astro stays; object-oriented Components)

**Reused from milestone 1:**
- `BenchLayout.astro` (head, fonts, boot failsafe) and the bench tokens and base CSS
- Vitest and CI
- `RenderLoop`, `PixelBudget`, `ChipPointer` (generalised picking) and `labels.ts`
- the controller pattern: Lenis, ScrollTrigger, IntersectionObserver, fallback, failsafe, immediate first progress and the resize guard
- `Teardown.ts`'s sections and layer explode/aside ideas, which grow into the new choreography

**Replaced or new:**
- **`three/Choreography.ts`:** a pure function from scroll progress to the state of every transition, per section: explode, camera, pulse position, decap amount, charge level, engrave progress, snap.
- **`three/device/{Frame,Screen,Board,Chip,Battery,BackPlate,Handheld}.ts`:** the realistic device, replacing the toy `Device.ts`.
- **`three/studio/{Studio,Floor,Beam,Dust}.ts`:** the studio.
- **`three/fx/{Pulse,Decap,Charge,Laser,Snap}.ts`:** one module per transition, each driven by the choreography.
- **`ui/BootLoader.ts`**, **`stage/FrameSequence.ts`**, **`ui/Callouts.ts`** (projected HTML labels with leader lines) and **`ui/TestPointPanel.ts`**.
- **`three/ProjectScene.ts`:** the project pages.

**Data:**
- `src/data/projects.ts`: add Funcial, per-locale `testPoints` (each with a region, and either a screen crop or a part), a `kind`, and the chip label
- `src/data/categories.ts`: the four electronics categories
- `src/i18n/*.ts`: rewritten, minimal

**Other:**
- **Review page:** `/lab/device/` is reused for the realistic device during the build (noindex, out of the sitemap). It is removed when the new home ships.
- **Old code:** the old home's components, scripts and fonts are removed when the new home replaces it. The list is in revision 1 (`git show 599fa6b:docs/superpowers/specs/2026-10-18-portfolio-redesign-design.md`, "Architecture → Remove").
- **Fallbacks:**
  - **Phones:** DPR capped at 1.25, a lighter reflection (or none), fewer particles, tap instead of hover, and portrait framing.
  - **Reduced motion or no WebGL:** a stacked page with a still render of each state.
  - **Without JavaScript:** real HTML text.
- **Performance:**
  - a steady 60 fps scroll on an ordinary laptop (PixelBudget steps the pixel ratio down, and the reflection drops first)
  - home JavaScript about 250 KB gzipped (three.js in its own chunk)
  - under 1.5 MB before the loader clip plays
  - textures as compressed WebP/KTX2, within about 4 MB together
  - no full-screen bloom pass: glows are sprites

## Build order (Bob sees each step before the next)

1. **Done:** foundation and the first device spike (milestone 1). Its infrastructure is reused.
2. **Realistic hub spike:**
   - the realistic handheld with the GPT Image textures
   - the studio (floor reflection, beam, dust, haze)
   - the exploded hub with callouts and the vertical name
   - drag to turn and hover the callouts
   - on `/lab/device/`; Bob reviews screenshots and a recording
3. **Transitions:**
   - screen push-in (About)
   - the pulse ride and the chip decaps (Projects)
   - the cable to the battery charge (Off duty)
   - the laser engraving (What I work with)
   - snap together, then Q&A and Say hello
4. **Loader:** the pick-and-place clip (draft, Bob's OK, final) → boot → power on → explode into the hub.
5. **Home replaces the old one:** close the deferred milestone-1 items (the resize "inside" check, PixelBudget restart on resize, the CSP hash for the boot script, the three.js chunk, the shared head partial) and remove the old code.
6. **Project pages:** decapped dies with test points, fresh screenshots, and EN/NL copy (Bob approves the wording).
7. **Hardening:** phones, reduced motion and no-WebGL stills, a11y, SEO, redirects, share images, and `PRODUCT.md`/`DESIGN.md`. Then verify, and ask Bob before pushing.

## Verification

- **Type checks:** `npx -p typescript tsc --noEmit` (`astro check` hangs here), `npm test` and `npm run build`.
- **Auditor:** through Pyodide (`unittest discover tools` and `site_audit.main(['dist','--strict'])`).
- **Headless Edge** (`playwright-core` with Edge, `page.bringToFront()`):
  - the loader sequence, including skips
  - every transition both ways
  - callout hover and click, and dragging the hub
  - chip decap and opening a project
  - stepping TP1 → TP4 on project pages
  - fps logged on the GPU and on SwiftShader
- **Phone:** a 390 px viewport with touch drags.
- **Reduced motion and no WebGL:** check that the page stacks with the stills.
- **Lighthouse:** accessibility, SEO and best practices must hold.
- **Proof for Bob:** screenshots and a recording.
- **Ask before pushing to main.**

## Not in scope / anti-goals

- No AI portrait, and no faces in generated images.
- No game or discovery counter.
- No sound.
- No invented clients, stats or availability claims.
- Transitions must stay readable: one section's text at a time, and nothing that hides what the section is about.
- The career roadmap is never the headline.
