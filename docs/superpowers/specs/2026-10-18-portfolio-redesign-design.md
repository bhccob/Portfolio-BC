# bhccob.me redesign: "The Bench" (bench dive + teardown)

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

Inspiration he asked to be studied:
- shelbykho.com: the desk that zooms into a notebook of projects, and the case-study step bar
- the motionsites/Viktor Oddy workflow: AI image → Seedance video → scrubbed by scroll
- aengel.io: a gated entry, scroll-driven worlds, projects as 3D objects, a lite version for phones
- silviamalavasi.com: one metaphor ("dissection"), a click gate, numbered hotspots on a 3D model that fly the camera in and open a panel
- portfolio-zxc.com: an explorable 3D desk and keyboard, with project fields "Inspiration / Main skills / Index"

Three concept demos were shown (A Teardown, B The bench, C Signal); Bob chose a **mix of A and B**.

## Decided by Bob (2026-10-18)

| Topic | Decision |
|---|---|
| Direction | Mix: cinematic bench dive (B) handing off to a 3D device that comes apart (A) |
| 3D look | **Solid and stylised**: clean, smooth, toy-like shapes in purple and yellow, built in code |
| Categories | Electronics names: **Front panel** (web), **Feedback loop** (games), **Secure element** (fintech), **Bare metal** (next: embedded) |
| Kept from the old site | **Off duty** (hobbies) only. Terminal, engine room ("this site is a project too"), origin route and clocks are dropped |
| Typography | Left to me (see my calls) |
| Higgsfield | Use it; Seedance 2.5 for video, GPT Image 2.5 for images. Account is on **Plus with ~686 credits** (checked 2026-10-18) |
| Funcial links | The project page links both the repo (github.com/bhccob/Funcial) and the download page (https://funcial.vercel.app/get), so any visitor can install the Android app |

Standing rules that still apply:
- Purple and yellow are the brand colours.
- Formal first-person copy in NL (default, at `/`) and EN (`/en/`).
- No game on the site.
- The real portrait only, no AI version of it.
- Never fabricate experience.
- Build, test and audit before any push, and ask before pushing to main.

## My calls (please check)

1. **Type:**
   - **Unbounded** (wide, rounded) for titles and names.
   - **Geist** for body text (fall back to Inter if the fontsource package is unsuitable).
   - **Martian Mono** (already installed) for the small HUD labels.
   - Bagel Fat One, Yellowtail and the condensed tile font are removed.
2. **Palette kept:**
   - board purples `#140a24` / `#1c1030`
   - signal yellow `#ffcf33`
   - cream `#f1e8d3`
   - PCB purple `#4b2a8a` with gold `#d9a520` contacts (purple boards with gold pads are a real thing)
3. **The device** is a stylised handheld dev kit, a purple rounded handheld; its yellow power button is the ping-pong ball mark, which stays as the favicon. Its layers, top to bottom, map to sections:
   - **Screen = About:** the real portrait shows on the screen.
   - **Board = Projects.**
   - **Battery = Off duty**, as "what keeps me charged".
   - **Back plate = What I work with:** a spec label like the one on the back of a real device.
4. **Order of the home page:** power-on → bench → About (one beat) → Projects (longest dwell) → Off duty → What I work with → Q&A → Contact. About comes first only because the screen lifts off first; it is one short line.
5. **Routes:**
   - Each project gets its own page: `/projects/<slug>/` (NL) and `/en/projects/<slug>/`, with the slugs `funcial`, `jontai-energy` and `cookies-clicker`.
   - Today `/projects/web-development/` is Jontai Energy's canonical page and `/projects/game-development/` is Cookies Clicker's, so links Bob has shared point at specific projects.
     - Each old address redirects to **its own project's** new page (NL and EN), not to the board.
   - The old redirect stubs that sit exactly on the new paths are deleted, because real pages replace them:
     - `public/projects/{cookies-clicker,jontai-energy}/index.html`
     - `public/en/projects/{cookies-clicker,jontai-energy}/index.html`
     - the `public/nl/projects/...` stubs
   - `lighthouserc.json` URLs are updated to the new pages.
6. **No sound and no discovery counter** (keeps clear of "game on the site").
7. **The power-on gate** replaces the split-flap loader. It shows a boot counter while the bench frames load, and an ID card with the name, role, "MBO 4 · Rotterdam" and a "BC-2006" model code. It is skipped on repeat visits in the same session, like `bob-booted` today.

## The experience

### Home (one pinned stage, Lenis + GSAP ScrollTrigger scrub, both scroll directions)
1. **Power on.** The gate: counter, ID card and a **Power on** button. Keyboard accessible, can be skipped.
2. **Bench (cinematic).** A Higgsfield-made stylised workbench (laptop with code, multimeter, soldering iron, breadboard, the device in the middle).
   - The camera dives toward the device as you scroll: a Seedance video played as an image sequence on a canvas.
   - Overlay: the name **BOB CHUNG**, one subtitle line typed in (aengel-style), and a small HUD readout that changes with scroll.
3. **Handoff.** The video's last frame is the same view as the live Three.js camera, because Seedance gets our device render as its end frame. A thin yellow scan line sweeps across as the canvas crossfades to live 3D, so the swap can't be seen.
4. **Teardown.** The screen lifts off: About in one line plus age, Aruba-born, Chinese heritage and Rotterdam, with the portrait on the lifted screen.
5. **The board (projects).** The camera settles over the purple board.
   - **Chips:** Funcial, Jontai Energy and Cookies Clicker, plus an empty **Next socket** (Bare metal).
   - Scrolling moves focus chip to chip, "01 / 03" style. The chip in focus rises and lights, and shows its name, electronics category and one line.
   - Clicking a chip (or "Open project") flies the camera into it, then navigates to the project page (cross-document view transition).
6. **Battery = Off duty.** Running, gym and gaming now; powerlifting and table tennis formerly. Existing copy, shortened.
7. **Back plate = What I work with.** Two lines only: Full-stack foundation, and Working with AI (existing text, trimmed).
8. **Unpin into Q&A.** Plain `<details>` questions, answered with the existing career copy, lightly trimmed:
   - What do you do now?
   - What comes after MBO 4?
   - Which roles interest you? (the four roles, plus fintech as one short line)
   - Why these directions?
   - Where does it lead? (a company of my own)
9. **Contact.** The final call plus a link to `/contact` (the page stays, restyled).

### Project pages (Shelby's step bar + Silvia's hotspots)
- **Top:**
  - the name, the electronics category label and a one-line summary
  - facts: year, type ("Personal project" / "School project"), role, stack and repo link
- **Pinned 3D model of that project,** in the same solid style. Numbered **test points TP1 to TP4** are pinned on its parts.
  - Scrolling walks TP1 → TP4, with a step bar at the bottom.
  - Clicking any test point flies the camera there and opens a short "datasheet" panel: what this part does.
  - The real screenshot shows on the model's screen and also as a normal image, for accessibility.
- **End:** the next project (fly to its chip) and back to the board.

**Models and test points** (copy is honest; Bob approves the final EN/NL wording):

| Project | Model | Test points |
|---|---|---|
| **Funcial**: Secure element · personal project 2026 · React 19, TypeScript, Tailwind CSS, Capacitor (Android), SQLCipher, Vercel functions, Upstash Redis. **No AI**: the advisor was removed on 2026-10-16, Funcial `ec0fb39` | Phone in a dock; exploded layers: screen, game chip, core chip, vault block, small cloud (the account's locked copy) | TP1 **Log** (a spend in seconds) · TP2 **Game layer** (XP, levels, quests, streaks; coins are cosmetic and have no money value) · TP3 **Money rules** (a pure TypeScript core does all the maths, including the offline "Should I buy it?" check) · TP4 **Vault** (local-first and encrypted on the phone; an account keeps only a locked copy, so a friend can move phones) |
| **Jontai Energy**: Front panel · personal project 2026 | Solar panel beside a monitor showing the site; pages fan out as glass sheets | TP1 **Pages** (15+) · TP2 **Design system** (one Tailwind system) · TP3 **Languages** (EN/ES/ZH, PowerShell automation) · TP4 **Quote** (the main action) |
| **Cookies Clicker**: Feedback loop (also Front panel) · school project 2025 | A big press button with a cookie, small gear "producers", a boost cell, a memory chip | TP1 **Click** · TP2 **Producers** (shared AutoClicker class) · TP3 **Boosts** (timed boosts, random events) · TP4 **Save** (localStorage) |

**Funcial screenshot:** run the app locally (`npm run dev` in `C:\Users\bhcco\Downloads\Funcial`) with demo data, capture it with headless Edge, save it to `src/assets/funcial.png`, and Bob confirms it. If onboarding or the PIN screen blocks a clean capture, ask Bob for a phone screenshot instead.

## Assets via Higgsfield (connected Higgsfield tools, same account; no CLI is installed)

1. **Render the 3D device** from our Three.js scene (headless Edge), at 16:9 and 9:16, at the exact handoff camera.
2. **GPT Image 2.5** (quality high, 2k):
   - the stylised bench key art, with the device render as an `image_references` input so the style and object match
   - 2–3 options for Bob to pick
   - then a clean version with no text
3. **Seedance 2.5** (`omni_reference`, start frame = wide bench, end frame = the device close-up render, 8 s, no audio):
   - a **480p draft first** (`draft: true`), so Bob can approve the motion
   - then finalize at 1080p, plus a 9:16 version for phones
4. **Frames:** split each video with `ffmpeg-static`, run from the scratchpad. WebP frames:
   - about 120 at 1600 px wide for desktop (≤ 8 MB)
   - about 120 at 900 px for phones (≤ 3.5 MB)
   - stored in `public/bench/{desktop,phone}/`
   - loaded progressively: every 4th frame first, then the rest
5. **Budget:** about 250 credits. Read the cost of the first generation from `transactions`, and ask Bob before going past the budget.

## Architecture (Astro stays; object-oriented Components, as today)

**Add:**
- `three` and `@types/three`
- `@fontsource-variable/unbounded`
- a Geist (or Inter) package

**Remove:**
- fonts: Bagel Fat One, Yellowtail, Sofia Sans Extra Condensed (and Sofia Sans if Geist replaces it)

**New code (`src/scripts/`):**
- `stage/Stage.ts`: owns the fixed stage (2D frame canvas + WebGL canvas + HTML text layer), the master ScrollTrigger timeline with labels, resize, and pausing when hidden
- `stage/FrameSequence.ts`: loads and draws the bench frames
- `three/DeviceScene.ts`: the home device, its layers, camera rig and chip raycasting
- `three/ProjectScene.ts`: a data-driven project model with test points
- `three/parts/*.ts`: stylised part builders (rounded chip, board, screen, battery, phone, solar panel, button, gear)
- `ui/PowerOnGate.ts` (replaces `ui/LoadingScreen.ts`) and `ui/TestPointPanel.ts`

**Keep and reuse:**
- `core/App.ts`, `core/Component.ts`, `core/Motion.ts` (reduced motion, fine pointer), `core/SafeStorage.ts`
- `ui/SiteHeader.ts` (restyled), `ui/AgeUpdater.ts`, `contact/ContactForm.ts`

**Remove:**
- scripts: `FlapBoard`, `BlueprintGrid`, `HeroMascot`, `NameReveal`, `CursorTrail`, `ScrollScenes`, `ScrollEffects`, `TiltCards`, `ProjectSwitcher`, `fun/Terminal`, `fun/StationClock`
- components: `LineObjects`, `ScrollTapes`, `FlapText`, `EngineRoom`, `Hero`, `Career` (becomes the Q&A), `Skills` (becomes the back plate)

**Data:**
- `src/data/projects.ts`: add Funcial, per-locale `testPoints`, a `model` key and a `kind` ("Personal project" / "School project")
- `src/data/categories.ts`: the four electronics categories, used as labels
- `src/i18n/en.ts` and `src/i18n/nl.ts`: rewritten, minimal

**Other:**
- `src/styles/tokens.css` and `src/styles/base.css`: rewritten
- `src/og/ShareImage.ts`: switched to the new fonts
- `src/pages/projects/[slug].astro` and `src/pages/en/projects/[slug].astro` replace the `[category]` routes
- CSP in `astro.config.mjs`: no change needed (everything is self-hosted; Three.js needs no eval)
- the Python auditor (`tools/`) stays and must pass

**Fallbacks:**
- **Phones (lite, like aengel):** the 9:16 frames, 3D capped at DPR 1.25, fewer lights, tap instead of hover.
- **Reduced motion or no WebGL:** no scrubbing. The page stacks normally, with pre-rendered stills of the bench, device and project models (rendered once with headless Edge into `src/assets/renders/`).
- **Without JavaScript:** all text is real HTML, so the page reads and indexes fine.

**Performance target:**
- a steady 60 fps scroll on an ordinary laptop
- home JavaScript about 250 KB gzipped
- under 1.5 MB before "Power on", including a **first frame pass** (every 8th frame at about 800 px, about 0.5 MB); the boot counter counts that pass
- the full-size frames stream in behind it while the visitor reads the first beat
- WebGL sleeps when off-screen

## Build order (Bob sees each step before the next)

0. **Hand-off docs:**
   - save this design to `docs/superpowers/specs/2026-10-18-portfolio-redesign-design.md`
   - write the implementation plan (superpowers:writing-plans)
   - work on a branch, not main
1. **Device spike:** the stylised handheld in Three.js with the new type and colours, its teardown scrubbed by scroll, running in the site. Bob reviews screenshots and a short screen capture.
2. **Higgsfield assets:** device renders → bench options (Bob picks) → Seedance draft (Bob approves the motion) → finals → frames.
3. **Home end to end:** gate, bench dive, handoff, About, the board with chips, Off duty, What I work with, Q&A, contact.
4. **Project pages:** the three models with test points, the Funcial screenshot, EN/NL copy (Bob approves the wording).
5. **Hardening:** phones/lite, reduced motion, no-WebGL stills, a11y, SEO, redirects, share images, and `PRODUCT.md`/`DESIGN.md` updated. Then verify, and ask Bob before pushing.

## Verification

- **Type checks:** `npx -p typescript tsc --noEmit` (`astro check` hangs here) and `npm run build`.
- **Auditor:** run it through Pyodide (the `unittest discover tools` tests, and `site_audit.main(['dist','--strict'])`), as in CI.
- **Scroll checks in headless Edge** (`playwright-core` from the scratchpad, `executablePath` = Edge, `page.bringToFront()`, `sessionStorage` set to skip the gate):
  - scrub the whole home page both ways
  - check frame loading, the handoff crossfade, chip focus and clicks, and the fly-in navigation
  - on project pages, step TP1 → TP4 and click a test point
  - log fps while scrolling
- **Phone:** a 390 px viewport with touch drags (`Input.dispatchTouchEvent`).
- **Reduced motion:** emulated; check that the page stacks with the stills.
- **Lighthouse:** accessibility, SEO and best practices must hold; performance is reported only.
- **Proof for Bob:** screenshots and a short recording.
- **Ask before pushing to main.**

## Not in scope / anti-goals

- No AI portrait.
- No game or discovery counter.
- No sound.
- No invented clients, stats or availability claims.
- No heavy bordered boxes.
- The career roadmap is never the headline.
