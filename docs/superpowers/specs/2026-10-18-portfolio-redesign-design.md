# bhccob.me redesign: "The Workshop" (revision 2)

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
- **Revision 1 (2026-10-18):** a mix of a cinematic workbench dive and a toy-like 3D device that comes apart. Milestone 1 built and verified it on `redesign-bench` (599fa6b..bdeb821; review page `/lab/device/`).
- **Revision 2 (2026-10-19):** after seeing milestone 1, Bob asked for four things:
  - a **more complex device**
  - a **much more immersive** site, with a real background environment, more realistic and premium scrolling, and text **placed more creatively**
  - an **eye-catching** first impression
  - a **unique loading screen**

  His references: Junkbranding's floating browser windows over misty water, and look.ai's billboards on a grey city. From Higgsfield concept images he picked a calm Rotterdam workshop with a spotlight per section, and a two-part loader.

**Inspiration studied:**
- shelbykho.com: the desk to notebook dive, and the step bar
- the motionsites/Viktor Oddy workflow: AI image → Seedance video → scrub
- aengel.io: a gated entry, scroll-driven worlds, a lite version for phones
- silviamalavasi.com: one metaphor, a click gate, hotspots that fly the camera in
- portfolio-zxc.com: an explorable 3D desk, and project fields

## Decided by Bob

| Topic | Decision |
|---|---|
| World (2026-10-19) | **A calm, minimal workshop in Rotterdam at night:** one long bench in front of a large window with the Rotterdam skyline and the Erasmus bridge. **Room + spotlight:** visitors arrive in the lit room; each scroll step dims it and spotlights one object, with that section's text floating beside it in the scene. Bob found the full workshop "a bit too much going on"; calm is a requirement. |
| 3D look (2026-10-19) | **Realistic and premium.** Replaces revision 1's "solid and stylised". The device is **more complex**: purple anodised aluminium, brass screws, a smoked window over a dense circuit board, USB-C, a glowing yellow power button. |
| Loading screen (2026-10-19) | **Two parts, in sequence:** (1) a robot arm places a "BC-2006" chip on a purple board while the site loads, with the solder glowing as it reflows; (2) at 100% the device around the chip boots up and its screen shows the boot. The visitor presses its power button, and the camera moves out into the workshop. |
| Text (2026-10-19) | Placed creatively **in the scene**: floating beside the spotlit object, layered in depth. Not plain stacked sections. |
| Categories (2026-10-18) | Electronics names: **Front panel** (web), **Feedback loop** (games), **Secure element** (fintech), **Bare metal** (next: embedded) |
| Kept from the old site (2026-10-18) | **Off duty** (hobbies) only. Terminal, engine room, origin route and clocks are dropped. |
| Funcial links (2026-10-18) | Its project page links both the repo (github.com/bhccob/Funcial) and the download page (https://funcial.vercel.app/get) |
| Higgsfield | Use it: GPT Image 2.5 for images, Seedance 2.5 for video. Account: Plus, ~686 credits (2026-10-18); about **44 credits spent** on concept images by 2026-10-19 |

**Approved mood images** (Higgsfield job IDs, in Bob's account; reference only, never shipped as-is):
- calm room: `53a8dbe7-d7b4-47cd-987d-3e55a702bfd9`
- spotlight state: `b1e35a13-23c9-40b9-bc0a-d0ac4c52c8cc`
- pick-and-place loader: `8b637719-316f-4110-a9b6-6fda08a5a765`
- device boot loader: `d584c717-4ee6-4e77-a61e-7bfe659ce5c4`

**Standing rules:**
- Purple and yellow are the brand colours.
- Formal first-person copy in NL (default, at `/`) and EN (`/en/`).
- No game on the site.
- The real portrait only, no AI version of it (and no faces in any generated image).
- Never fabricate experience.
- Build, test and audit before any push, and ask before pushing to main.

## My calls (please check)

1. **Type:** unchanged from revision 1 and already built.
   - Unbounded for titles and names, Geist for body text, Martian Mono for HUD labels.
   - Bagel Fat One, Yellowtail and the condensed tile font go when the old home is replaced.
2. **Palette:** unchanged.
   - Board purples `#140a24` / `#1c1030`, signal yellow `#ffcf33`, cream `#f1e8d3`, PCB purple `#4b2a8a`, gold `#d9a520`.
   - The room's night light is deep purple; warm yellow is the lamp and the spotlight.
3. **Rendering: a "2.5D room with real 3D objects".**
   - **The room:**
     - Built from Higgsfield GPT Image plates generated in the approved room's style.
     - Split into a far layer (the window view: skyline and bridge) and a room layer (walls, window frame, bench surface), each in a lit and a dark version.
     - Shown as textured planes in the Three.js scene with gentle parallax.
     - The camera moves only modestly (dolly along the bench, small push-ins), so the plates stay believable.
   - **The objects:** real 3D with realistic materials, so they can be lit, hovered and clicked: the device, the projects' objects, the Off duty still life and the whiteboard. Their screens show the real screenshots.
   - **The spotlight:**
     - The room plate crossfades from lit to dark as a section starts.
     - One warm spot light targets the object in focus, and the other objects fall into shadow.
4. **The device:**
   - **Model:** a realistic handheld dev kit modelled in code to match the approved loader image. The circuit board's detail (with a "BC-2006" silkscreen) and the brushed-metal grain are GPT Image textures.
   - **Screen:** shows the boot, then the real portrait (About).
   - **What I work with:** the device turns over to show a spec label on its back.
   - **Ball mark:** the ping-pong ball stays as the favicon only.
5. **Loader sequence:**
   1. **Pick and place.** A short Seedance clip played as a small frame sequence (about 48 frames at about 960 px, ≤ 1.2 MB), scrubbed by the real loading progress of the room assets. A small label reads "ASSEMBLING · BOB CHUNG" with a percentage.
   2. **Boot.** At 100% the clip's last frame matches a render of our device's board close-up, so it hands off to the live 3D device seamlessly. The camera pulls back from the chip to the whole device, whose screen shows "BC-2006", a boot bar, then "PRESS POWER".
   3. **Power on.** The visitor clicks the yellow button (or a real HTML "Power on" button; Enter works). The screen lights, and the camera pulls out to reveal the device on the bench as the lit room fades in.
   4. **Repeat visits** in the same session skip to the room. **Reduced motion** shows the room still directly.
6. **Home, as a spotlight sequence** (Lenis + GSAP ScrollTrigger scrub, both directions). Each step dims the room, spotlights one object and floats its text beside it. The text is HTML anchored to the object's projected position.
   1. **Arrival:** the room lit. "BOB CHUNG" is a 3D text plane set between the window view and the room for depth, with a real `<h1>` in the HTML. The role line sits below it.
   2. **About:** the device, with the real portrait on its screen. One line, plus born in Aruba · Chinese heritage · Rotterdam since eighteen.
   3. **Projects (longest dwell):**
      - 01 Funcial: a phone on a dock.
      - 02 Jontai Energy: a monitor with a miniature solar panel.
      - 03 Cookies Clicker: a small arcade cabinet.
      - Next: an empty dock spot labelled "Bare metal: next".
      - Each step shows "0X — CATEGORY", the name large, one line, and "Open project". Clicking the object or the link flies the camera in, then navigates to the project page (cross-document view transition).
   4. **Off duty:** a small still life at the end of the bench (running shoes, a dumbbell, a table tennis paddle). Title "What keeps me charged", with the existing copy shortened.
   5. **What I work with:** the device turns over and its back label reads "Full-stack foundation / Working with AI", with the existing text trimmed to one line each.
   6. **Q&A:** a small whiteboard is spotlit. The questions are plain HTML `<details>`, answered with the existing career copy, lightly trimmed:
      - What do you do now?
      - What comes after MBO 4?
      - Which roles interest you? (the four roles, plus fintech as one short line)
      - Why these directions?
      - Where does it lead? (a company of my own)
   7. **Contact:** the room lights up again. The final call, plus a link to `/contact` (the page stays, restyled).
7. **Routes:** unchanged from revision 1.
   - Project pages live at `/projects/<slug>/` and `/en/projects/<slug>/`, with the slugs `funcial`, `jontai-energy` and `cookies-clicker`.
   - The old `/projects/web-development/` and `/projects/game-development/` redirect to Jontai Energy and Cookies Clicker. The stubs that sit on the new paths are deleted, and `lighthouserc.json` is updated.
8. **No sound and no discovery counter.**
9. **Calm is enforced:**
   - At most one spotlit object and one text block on screen at a time.
   - Unlit objects sit in shadow.
   - No clutter props beyond the ones listed here.
10. **Test points attach to an opened object.**
    - On a project page, the object opens up the way the approved product-launch image did: the phone's back, the monitor's housing and the cabinet's side panel lift away, and their layers separate.
    - **Screen features:** test points about something on screen (Log, Game layer, Pages, Quote, Click…) point at a zoomed crop of a real screenshot, shown on the object's screen.
    - **Inner features:** test points about the inner workings (Money rules, Vault, Design system, Languages, Producers, Boosts, Save) sit on labelled inner parts: a chip, a storage block, a small board.
    - **Data:** `testPoints` in `projects.ts` name either a screen crop or a part.
    - **Screenshots:** each project gets fresh, properly framed screenshots, captured with headless Edge from the real projects run locally. The current `cookies.png` is a 2267×604 strip and cannot fill an arcade screen.
11. **The loader runs on the home page only**, on the first visit of a session.
    - Visitors who land directly on a project page or `/contact` get a short fade-in, not the chip/boot/power sequence.
    - "Back to the workshop" returns to that project's step on the home without the loader.
12. **Free CC0 3D models and lighting maps may be used** for props that are hard to model convincingly in code (the running shoes, the dumbbell, the paddle), and for an HDRI lighting map.
    - **Source:** for example Poly Haven.
    - **Format:** glTF, compressed (meshopt), within a 2 MB budget for all props together.
    - **Before downloading:** Bob is told each file's name, source and size.
    - **Fallback:** Higgsfield's 3D generator still needs his OK.
13. **The workshop spike starts with a check that costs no credits.** The approved room image is used as a temporary background on `/lab/workshop/`, with the real 3D device and phone in front of it, to prove the layered-image room works before any new images are generated.

## Project pages (Shelby's step bar + Silvia's hotspots)

- **Top:**
  - the name, the electronics category label and a one-line summary
  - facts: year, type ("Personal project" / "School project"), role, stack and links
- **The scene:** the project's object stands on the bench in the dark room under the spotlight, as a pinned close-up 3D model. Numbered **test points TP1 to TP4** are pinned to its parts.
  - Scrolling walks TP1 → TP4, with a step bar at the bottom.
  - Clicking a test point flies the camera there and opens a short "datasheet" panel.
  - The real screenshot shows on the object's screen and also as a normal image, for accessibility.
- **End:** the next project, and back to the workshop.

| Project | Object | Test points (copy honest; Bob approves the final EN/NL wording) |
|---|---|---|
| **Funcial**: Secure element · personal project 2026 · React 19, TypeScript, Tailwind CSS, Capacitor (Android), SQLCipher, Vercel functions, Upstash Redis. **No AI** (the advisor was removed 2026-10-16, Funcial `ec0fb39`) | Phone on a dock | TP1 **Log** (a spend in seconds) · TP2 **Game layer** (XP, levels, quests, streaks; coins are cosmetic and have no money value) · TP3 **Money rules** (a pure TypeScript core does all the maths, including the offline "Should I buy it?" check) · TP4 **Vault** (local-first and encrypted on the phone; an account keeps only a locked copy, so a friend can move phones) |
| **Jontai Energy**: Front panel · personal project 2026 | Monitor with a miniature solar panel | TP1 **Pages** (15+) · TP2 **Design system** (one Tailwind system) · TP3 **Languages** (EN/ES/ZH, PowerShell automation) · TP4 **Quote** (the main action) |
| **Cookies Clicker**: Feedback loop (also Front panel) · school project 2025 | Small arcade cabinet | TP1 **Click** · TP2 **Producers** (shared AutoClicker class) · TP3 **Boosts** (timed boosts, random events) · TP4 **Save** (localStorage) |

**Funcial screenshot:** run the app locally (`npm run dev` in `C:\Users\bhcco\Downloads\Funcial`) with demo data, capture it with headless Edge, save it to `src/assets/funcial.png`, and Bob confirms it. If onboarding or the PIN screen blocks a clean capture, ask Bob for a phone screenshot.

## Assets via Higgsfield (connected Higgsfield tools; no CLI installed)

1. **Room plates** (GPT Image 2.5, high quality, 2k):
   - Generated with the approved room image as an `image_references` input.
   - Plates:
     - the window view alone
     - the room without objects, lit
     - the room without objects, dark
   - Each at 16:9 for desktop and 9:16 for phones.
   - About 12–16 images, roughly 35–45 credits.
2. **Textures** (GPT Image 2.5): a top-down purple circuit board with a "BC-2006" silkscreen, brushed purple aluminium, and dark wood for the bench. Generated with flat, even lighting so they work as material maps. About 4–6 images, roughly 11–17 credits.
3. **Pick-and-place clip** (Seedance 2.5):
   - Frames: the start frame is a macro still in the approved loader's style; the end frame is a render of our device's board close-up.
   - Format: 5 s, no audio.
   - Process: check the cost first, make a **480p draft** for Bob to approve, then finalize at 1080p.
4. **Frames:** split the clip with `ffmpeg-static` from the scratchpad into WebP frames in `public/loader/`. They are loaded first, and the clip plays while the room loads.
5. **3D objects** are modelled in code. Higgsfield's 3D generator is tried only if a coded object looks weak, and only with Bob's OK.
6. **Budget:** about 250 credits in total (about 44 spent). Ask Bob before going past it.

## Architecture (Astro stays; object-oriented Components)

**Reused from milestone 1:**
- `BenchLayout.astro` (head, fonts, boot failsafe) and `bench-tokens.css` / `bench-base.css`
- Vitest and the CI step
- `RenderLoop`, `PixelBudget` (adaptive pixel ratio), `ChipPointer` (generalised to any pickable object) and `labels.ts` (canvas textures)
- the controller pattern: Lenis + ScrollTrigger + IntersectionObserver + fallback + failsafe + immediate first progress

**Replaced:**
- `Teardown.ts` becomes `Choreography.ts`, a pure function from scroll progress to a pose: the section, the camera, the spotlight target, the room light level and the text anchor.
- The toy `Device.ts` gives way to realistic object builders.
- `DeviceScene.ts` becomes `WorkshopScene.ts` (plates + objects + spotlight).

**New:**
- `three/RoomPlates.ts`
- `three/objects/{Handheld,PhoneDock,MonitorPanel,ArcadeCabinet,OffDutyStill,Whiteboard}.ts`
- `stage/FrameSequence.ts` (the loader clip)
- `ui/BootLoader.ts` (pick and place → boot → power on)
- `ui/TestPointPanel.ts`
- `three/ProjectScene.ts`

**Data:**
- `src/data/projects.ts`: add Funcial, per-locale `testPoints`, a `model` key and a `kind`
- `src/data/categories.ts`: the four electronics categories
- `src/i18n/*.ts`: rewritten, minimal

**Other:**
- **Review page:** `/lab/workshop/` replaces `/lab/device/` during the build (noindex, out of the sitemap). It is removed when the new home ships.
- **Old code:** the old home's components, scripts and fonts are removed when the new home replaces it. The list is in revision 1 of this spec (`git show 599fa6b:docs/superpowers/specs/2026-10-18-portfolio-redesign-design.md`, section "Architecture → Remove").
- **Fallbacks:**
  - **Phones:** the 9:16 plates, DPR capped at 1.25, tap instead of hover.
  - **Reduced motion or no WebGL:** a stacked page with stills of the room and of each spotlight state, rendered once with headless Edge.
  - **Without JavaScript:** real HTML text.
- **Performance:**
  - a steady 60 fps scroll on an ordinary laptop (PixelBudget steps the pixel ratio down)
  - home JavaScript about 250 KB gzipped (three.js in its own chunk)
  - under 1.5 MB before the loader clip plays
  - plates as compressed WebP, about 300–500 KB each
  - no heavy post-processing: glows are sprites, not a bloom pass

## Build order (Bob sees each step before the next)

1. **Done:** foundation and the first device spike (milestone 1, 2026-10-19). Its infrastructure is reused.
2. **Workshop look spike:**
   - first a check that costs no credits (call 13), then the room plates and textures from Higgsfield
   - the realistic handheld and one project object (the Funcial phone) in the room
   - the spotlight moving between them with floating text, scrubbed by scroll on `/lab/workshop/`
   - Bob reviews screenshots and a recording. This answers "more complex device" and "immersive" before anything else is built on them.
3. **Loader:** the pick-and-place clip (draft, Bob's OK, final) → device boot → power on → room reveal.
4. **Home end to end:** every spotlight section, the floating text, the Q&A and contact. The old home is replaced, and the deferred milestone-1 items are closed: the resize "inside" check, PixelBudget restart on resize, the CSP hash for the boot script, the three.js chunk and the shared head partial.
5. **Project pages:** the three objects with test points, the Funcial screenshot, and EN/NL copy (Bob approves the wording).
6. **Hardening:** phones, reduced motion, the no-WebGL stills, a11y, SEO, redirects, share images, and `PRODUCT.md`/`DESIGN.md` updated. Then verify, and ask Bob before pushing.

## Verification

- **Type checks:** `npx -p typescript tsc --noEmit` (`astro check` hangs here), `npm test` and `npm run build`.
- **Auditor:** through Pyodide (`unittest discover tools` and `site_audit.main(['dist','--strict'])`).
- **Headless Edge** (`playwright-core` with Edge, `page.bringToFront()`):
  - the loader sequence, including skip on repeat visits
  - the spotlight sequence both ways
  - the floating text staying beside its object on resize
  - object hover and click, and the fly-in navigation
  - stepping TP1 → TP4 on project pages
  - fps logged on the GPU and on SwiftShader
- **Phone:** a 390 px viewport with touch drags.
- **Reduced motion and no WebGL:** check that the page stacks with the stills.
- **Lighthouse:** accessibility, SEO and best practices must hold.
- **Proof for Bob:** screenshots and a short recording.
- **Ask before pushing to main.**

## Not in scope / anti-goals

- No AI portrait, and no faces in generated images.
- No game or discovery counter.
- No sound.
- No invented clients, stats or availability claims.
- No clutter: the calm room is a requirement, not a style preference.
- The career roadmap is never the headline.
