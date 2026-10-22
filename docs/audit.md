# Audit: from revision 4 to Needle

Branch `needle` (from `redesign-bench`), 2026-10-20. This page records what the
rebuild started from, and what was kept, moved, adapted or dropped, and why. It
draws on the approved roadmap ("Follow the Needle"), its "Facts found while
planning" and "Reuse" sections. The Astro site stays intact on `main` and
`redesign-bench`.

## What existed

- **Revision 4** on `redesign-bench`: Astro + TypeScript with a vanilla three.js
  compass (M3) that turns into a hard drive (M4), Lenis scrolling, 329 unit
  tests, the Python auditor `tools/site_audit.py`, and the proof harness
  `tools/proof/compass.mjs` (playwright-core outside the repo, headless Edge).
- **Tools:** no Higgsfield CLI, ffmpeg or Blender. The Higgsfield tools are
  connected and replace the brief's CLI steps with the same models
  (`gpt_image_2_5`, `seedance_2_5`).
- **Projects:** Funcial (verified layers: LOG, GAME LAYER, MONEY RULES, VAULT;
  RESULT only partly real), Jontai Energy (committed state only; the live site
  is his brother's build and is not linked as Bob's), Cookies Clicker (the
  GitHub repo; the local clone is stale).
- **Bio facts:** born and raised in Aruba, Chinese heritage, moved to the
  Netherlands at 18, Rotterdam, MBO 4, HBO next. Everything else is `[FILL]`.
- **Old URLs that must keep working:** `/contact/`, `/projects/web-development/`,
  `/projects/game-development/`, `/projects/web-development/cookies-clicker/`,
  `/career/*.html`, `/nl/**`, `/jontai-energy.html`, `/cookies-clicker.html`.
  Task 3 generates their redirect stubs from `src/data/redirects.ts`.
- Bob's `astro dev` runs on :4321 from the main checkout, so all work happens
  in the `needle` worktree and never touches that port.

## Kept in place

| What | Why |
| --- | --- |
| `src/i18n/{en,nl,Translator}.ts` | today's copy and the locale URLs; a `needle` block was added in Task 4a |
| `src/data/{profile,projects,categories,qa}.ts` | the content; `projects` and `categories` lost their Astro types in Task 1 and were reshaped in Task 4a, which also merged `tracks.ts` (and its test) into `projects.ts` |
| `src/assets/**`, `public/**` | screenshots, the real portrait, the renders and icons; `public/textures/instrument/*.webp` was removed with the revision-4 engine (80fcdeb), and `public/models/bob-compass.glb` is the BOB compass, exported by `tools/blender/export_compass.py` |
| `src/styles/bench-*.css` | mined for tokens in Task 4a, then deleted |
| `tools/site_audit.py` + its tests, `tools/icons.mjs` | the auditor, the raster icons |
| `tools/glyphs.mjs` (deleted 2026-10-21) | kept here for the real CJK glyph outlines; deleted on branch `bob-m1` (Task 11, Ruling 27): its only output, `src/engine/instrument/glyphs.ts`, went with `src/engine/instrument/`, and the BOB design (`docs/superpowers/specs/2026-10-21-bob-compass-design.md`) engraves no CJK glyphs. It is in the git history if a later design needs it |
| `tools/proof/compass.mjs` | the model for `tools/proof/needle.mjs`; it remains as the revision-4 harness |

## Moved unchanged (Task 2, `git mv`)

`src/scripts/three/**` → `src/engine/**`, tests → `tests/unit/engine/**`:

- all of `instrument/*`: dialSpec, glyphs, dialSvg, face, patterns, paint,
  textures, Annulus, Instrument, Needle + armState, BasePlate, drive,
  DriveParts, Tracks, materials, Pool, Wire, wirePath
- `studio/{Backdrop,Dust,Haze,noise,CompassStudio}`
- AngleSpring (needle settle), FreeTurn, CameraRig, palette, quality,
  stillness, TextureWarmup
- `core/{Handlers,deadline,SafeStorage}` and `compass/loading.ts`

Choreography, applyPose, overlay, Pool and Wire move only to pose the M1
placeholder compass; M2 replaces them.

## Adapted

Done in milestone 1:

- The data files moved into the new Project type (Task 4a).
- The tone shoulder of `CompassStudio` also became a postprocessing effect,
  `src/scene/ShoulderToneMapping.ts`, which the post chain applies last (Task 7).
  The studio itself is hosted as it was by `src/scene/Studio.tsx`.

Still to come, after milestone 1:

- A new `engine/pose.ts` is cut out of Choreography.
- `patterns.ts` gains `china`, `delft` and `aruba` arm and bezel inlays;
  `rotterdam` is dropped.

## Dropped

| What | Why |
| --- | --- |
| Astro, `@astrojs/sitemap`, `astro.config.mjs` | React Router 8 framework mode prerenders every page instead; the sitemap becomes a post-build script |
| every `.astro` file: `src/pages`, `layouts`, `views`, `components`; `src/og` | pages become React routes; the share image becomes a post-build crop |
| `src/scripts/{main,compass-main}.ts`, `src/scripts/{ui,fun,hero,contact}/**` | the old DOM components; the contact logic returns as `src/ui/contactSubmit.ts` (Task 4b) |
| `core/{App,Component,dom,Motion,Signal}` | the vanilla component layer, replaced by React |
| `compass/{CompassStageController,live,reading}` | the Lenis-driven controller and reading model; replaced by the state machine, chapters and virtual scroll (Tasks 5 and 6) |
| CompassScene, RenderLoop, PixelBudget (Task 2) | R3F's Canvas, demand frameloop and quality governor take over |
| Choreography's 16 sections | the brief's phases and chapters replace them |
| Pearl, pearlSpec, ChipPointer, TrackPointer (Task 2) | the pearl cursor and track pointers are not in the brief |
| Lenis | banned; scrolling is virtual on home |
| `src/styles/{base,tokens}.css` | rewritten from the art-direction palette in Task 4a |
| Bagel Fat One, Yellowtail, Sofia Sans (+ Extra Condensed), Geist, the static Martian Mono and Sofia Sans | Montserrat (name, tagline, reading text), Unbounded (heavy titles) and Martian Mono (labels) replace them |
| tests `reading`, `pearl-spec`, and the `loading` case that read `BenchLayout.astro` | their subjects were deleted |

The brief also drops the Ørsted wire, the heaven-pool portrait, and the Q&A and
Off duty on the drive (both now on the Lite page). At the end of milestone 1 the
unit suite has 711 tests (Vitest), and `tools/proof/needle.mjs` replaces
`compass.mjs` as the harness that runs.

## The toolchain now

React Router + `@react-router/dev` 8.5.0 (`ssr: false`, prerendered), Vite
8.3.4, React 19.3.1, TypeScript 7.0.2, three 0.186.1, `@react-three/fiber`
9.8.2 (needs React below 19.4), drei 10.7.9, `@react-three/postprocessing`
3.2.1 with postprocessing 6.39.5, maath and zustand. gsap is still a
dependency, but nothing in `src/` imports it yet. The build writes
`dist/client`; `tools/serve-pages.mjs` serves it on :4399 as GitHub Pages
would.
