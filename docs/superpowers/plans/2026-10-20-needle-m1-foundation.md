# Needle M1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Astro toolchain on branch `needle` with a React Router 8 + R3F app. It prerenders every NL/EN page, keeps one persistent `<Canvas>`, and has the scene state machine and virtual scroll input. It carries the ported compass engine as a placeholder subject and passes the site auditor and a proof harness.

**Architecture:** React Router framework mode (`ssr: false`, `prerender` of every route) on Vite writes static HTML per route into `dist/client`. Post-build scripts add the 404 fallback, redirect stubs, the sitemap and a hashed CSP meta. The root layout renders `<Shell>`, which holds `<SceneHost/>` (client-only, lazy R3F `Stage`) and `<Outlet/>`, so the canvas never unmounts. Pure logic (state machine, chapters, input, SEO head, redirects) lives in plain TS modules with node Vitest tests. The imperative three.js engine moved from `redesign-bench` is hosted by thin R3F wrappers.

**Tech Stack:**
- react 19.3.1, react-router + @react-router/dev 8.5.0, vite 8.3.4, typescript
- three 0.186.1, @react-three/fiber 9.8.2, @react-three/drei 10.7.9, @react-three/postprocessing 3.2.1, postprocessing 6.39.5
- maath 0.10.8, zustand 5.0.15, gsap 3.15.0
- vitest 5, sharp, opentype.js; Python auditor `tools/site_audit.py` (run through Pyodide locally)

**Spec:**
- `C:\Users\bhcco\Downloads\portfolio-prompt-v2-pack\MASTER-PROMPT-v2.md` (§9–§11, §13 M1)
- The approved roadmap: `C:\Users\bhcco\.claude\plans\i-want-a-redesign-distributed-tarjan.md`

## Global Constraints

- Work only in the worktree `C:\Users\bhcco\Downloads\Portfolio-bob\.claude\worktrees\needle`, branch `needle`. Never touch the main checkout, never use port 4321 (Bob's `astro dev`), never push.
- Two other sessions may write `docs/art-direction.md`, `docs/art-direction/**`, `assets/manifest.json`, `assets/raw/**`, `docs/projects-discovery.md` and `docs/discovery/**` in this worktree. Never edit, stage or delete those paths, and never `git add -A`; stage by explicit path.
- NL is the default locale at `/`; EN lives at `/en/`. Every page exists in both, and every route path ends in `/`.
- Copy: formal, first person.
  - Use `[FILL: …]` for any biography not already in `src/i18n/{en,nl}.ts`.
  - "FUNCIAL"/"Funcial" is spelled exactly so.
  - Never list AI in Funcial's stack.
  - Never call Jontai Energy client work.
- CSP is a `<meta http-equiv="Content-Security-Policy">` with sha256 hashes, no `'unsafe-inline'` scripts, no `'unsafe-eval'`, no `'wasm-unsafe-eval'`, `worker-src 'none'`.
- Banned imports in `src/`: drei `Text`, `Text3D`, `Environment`, `useGLTF`; `three/addons/postprocessing/*`; `lenis`; anything troika.
- Keep the CI variable names `PUBLIC_WEB3FORMS_KEY` and `PUBLIC_CF_ANALYTICS_TOKEN` (`envPrefix: ['VITE_','PUBLIC_']`).
- Build output: `dist/client`. Preview/proof server: `node tools/serve-pages.mjs` on port 4399.
- Checks after every task:
  - `npx tsc --noEmit` (typescript becomes a devDependency)
  - `npm test`
  - `npm run build`
- Commit message style: `Needle: <what changed>`, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- playwright-core is already installed at `C:\Users\bhcco\AppData\Local\Temp\claude\C--Users-bhcco-Downloads-Portfolio-bob\b56617be-0033-4513-b033-50ad14c6b88d\scratchpad\edge-check\node_modules\playwright-core`. Pass it as `PLAYWRIGHT_CORE`. Use headless Edge, never Chrome.

## Review Focus

1. **A URL typed without its trailing slash** (`/about/china`): the Pages-like server answers 301 → `/about/china/`, and the page hydrates once with no reload loop. Test: Task 1 proof step `slash`.
2. **No WebGL, or a lost context** (Lighthouse's headless run, old phones): the poster and a link to Lite show, with "THE NEEDLE LOST NORTH" and zero console errors. Test: Task 7 proof step `no-webgl`.
3. **Switching language or route mid-scene** keeps the one canvas (`canvasMounts === 1`) and the scene's phase. Test: Task 1 proof step `persist`, extended in Task 8.
4. **A trackpad's stream of tiny pixel deltas against a mouse notch in line mode** (`deltaMode 1`): both move progress by the same order of amount per gesture, and no single event jumps more than one chapter. Test: Task 6 `normalizeWheel` tests.
5. **Typing in the contact form or any input:** Space, arrows and PgDn type or scroll the field and never move the scene. Test: Task 6 `keyDelta` form-field tests.

---

### Task 1: Toolchain swap and persistent-canvas spike

**Files:**
- Delete: `astro.config.mjs`; all of `src/pages/**`, `src/layouts/**`, `src/views/**`, `src/components/**`, `src/og/**`, `src/env.d.ts`; `src/scripts/{main.ts,compass-main.ts}`; `src/scripts/{ui,fun,hero,contact}/**`; `src/scripts/core/{App,Component,dom,Motion,Signal}.ts`; `src/scripts/compass/{CompassStageController,live,reading}.ts`; `src/styles/{base,tokens}.css`.
  - Keep `src/styles/bench-*.css` for Task 4 to mine.
  - `src/scripts/three/**` stays for Task 2.
- Delete tests: `tests/unit/reading.test.ts`, `tests/unit/pearl-spec.test.ts` (it reads the deleted loader). If any other test fails on a missing import, it belongs to a deleted module: delete it and name it in the commit.
- Create:
  - `docs/audit.md`: one page on what exists, what is kept, moved or dropped and why. Use the approved roadmap's "Facts found while planning" and "Reuse" sections; no new research.
  - `react-router.config.ts`, `vite.config.ts`
  - `src/app/root.tsx`, `src/app/routes.ts`, `src/app/entry.server.tsx`, `src/app/entry.client.tsx`
  - `src/app/routes/home.tsx`, `src/app/routes/probe.tsx` (a temporary second page, removed in Task 4), `src/app/routes/not-found.tsx`
  - `src/app/Shell.tsx`, `src/scene/SceneHost.tsx`, `src/scene/Stage.tsx`
  - `tools/serve-pages.mjs`, `tools/proof/needle.mjs`
- Modify:
  - `package.json`: scripts and dependencies.
  - `tsconfig.json`
  - `.gitignore`: add `.react-router/` (`assets/raw/` is already ignored).
  - `vitest.config.ts`: add the `~` alias for `src`.
  - `src/data/projects.ts`: replace Astro's `ImageMetadata` with URL strings from `import.meta.glob('../assets/*.{png,jpg,jpeg,webp}', { query: '?url', import: 'default', eager: true })`. The `image` getter returns `string`.
  - `src/data/categories.ts`: drop the `icon` field and the `IconName` import.
  - `.claude/launch.json`: add `needle-dev` (`npm run dev`, 5173) and `needle-pages` (`npm run preview`, 4399); keep the astro entries.

**Interfaces:**
- Produces:
  - `src/app/routes.ts`: NL routes `''`, `probe/`, and the same under `prefix('en')`, plus a `*` splat. Each route has a unique `id` (e.g. `home-nl`, `home-en`).
  - `src/scene/SceneHost.tsx` `export function SceneHost(): JSX.Element`:
    - Renders `<div class="scene-host" aria-hidden="true">`, with no canvas, on the server and before hydration.
    - After hydration (`useSyncExternalStore` with a `false` server snapshot) it renders `React.lazy(() => import('./Stage'))` inside `<Suspense fallback={null}>`.
  - `src/scene/Stage.tsx`: default export, a `<Canvas>` with `dpr={[1, 2]}`, `frameloop="demand"`, `gl={{ antialias: true, powerPreference: 'high-performance' }}`, and only a clear colour `#0b0614` in M1.
    - Its mount effect does `window.__needleMounts = (window.__needleMounts ?? 0) + 1`.
  - `src/app/Shell.tsx` `Shell({children})`: renders `<SceneHost/>` then `<main>{children}</main>`. The root `App` renders `<Shell><Outlet/></Shell>`.
  - `package.json` scripts:
    - `dev`: `react-router dev --port 5173`
    - `build`: `react-router build`. Task 3 appends `&& node tools/build/postbuild.mjs`.
    - `preview`: `node tools/serve-pages.mjs`
    - `test`: `vitest run`
    - `typecheck`: `react-router typegen && tsc --noEmit`
    - `audit`, `build:icons`: unchanged
  - `tools/serve-pages.mjs`: a static server for `dist/client` on `PORT ?? 4399` that mimics GitHub Pages:
    - `/x` → 301 `/x/` when `x/index.html` exists
    - serves `x/index.html` for `/x/`
    - unknown path → `404.html` with status 404
    - correct MIME types for `.js` `.css` `.webp` `.woff2` `.mp4` `.webm` `.json` `.xml` `.svg` `.png` `.jpg`
  - `tools/proof/needle.mjs`: steps selected by `STEPS` (comma list).
    - Env: `BASE` (default `http://localhost:4399`), `PROOF_DIR` (default `./proof-out`), `PLAYWRIGHT_CORE`.
    - Prints `PASS|FAIL <step> <detail>` per step, writes `results.json`, exits 1 on any FAIL.
    - Launches `msedge` headless with `--use-angle=d3d11 --enable-gpu`.
    - Records `console` errors, `pageerror` and `securitypolicyviolation`, the last through an init script that pushes to `window.__cspViolations`.
- Consumes: nothing.

- [ ] **Step 1: Swap dependencies.**
  - Remove `astro`, `@astrojs/sitemap`, `lenis`, `@fontsource/bagel-fat-one`, `@fontsource/yellowtail`, `@fontsource-variable/sofia-sans`, `@fontsource-variable/sofia-sans-extra-condensed`, and the devDependencies `@fontsource/martian-mono` and `@fontsource/sofia-sans`.
  - Add the exact Tech Stack versions above, plus `@types/react`, `@types/react-dom`, `typescript` and `sharp` (dev).
  - Add `@fontsource-variable/montserrat` 5.3.0, Bob's pick for the name, tagline and reading text.
  - Remove `@fontsource-variable/geist`; Montserrat replaces it.
  - Run `npm install`. Expected: no peer-dependency errors. If `@react-three/postprocessing` and `three` conflict, pin the newest `postprocessing` 6.x that accepts three 0.186, and note it in the commit message.
- [ ] **Step 2: Write the framework config.**
  - `react-router.config.ts`: `appDirectory: 'src/app'`, `buildDirectory: 'dist'`, `ssr: false`, `prerender: ['/', '/probe/', '/en/', '/en/probe/']`. Task 3 replaces this with `pagePaths()`.
  - `vite.config.ts`: `reactRouter()`, `envPrefix: ['VITE_','PUBLIC_']`, `resolve.alias['~'] = '/src'`, `build.assetsInlineLimit: 0`.
  - `entry.server.tsx`: renders with `renderToPipeableStream` and resolves on `onAllReady` only (no streamed suspense scripts).
  - `root.tsx` `Layout`:
    - `<html lang>` from `useLocation()`, giving `en` for paths under `/en/`, else `nl`
    - `<meta charSet>`, then `<meta httpEquiv="Content-Security-Policy" content="__CSP__">` (production only), then `<Meta/><Links/>`
    - `<Scripts/>` and no `<ScrollRestoration/>`
- [ ] **Step 3: Write `tools/serve-pages.mjs` and proof steps `routes`, `slash` and `persist` in `tools/proof/needle.mjs`.**
  - `routes`: every prerendered path returns 200, has one `<h1>`, and shows zero console errors.
  - `slash`: `GET /probe` returns 301 to `/probe/`. After `page.goto('/probe')`, the main frame logs exactly one load of `/probe/` with no reload.
  - `persist`: on `/`, click a client `<Link>` to `/probe/`, then to `/en/probe/`, then `history.back()`. `window.__needleMounts === 1` throughout, and the `<canvas>` element is the same node (tag it with a `data-id` on first sight and check it).
- [ ] **Step 4: Run it.**
  - `npm run build && npm run preview` (background), then `PLAYWRIGHT_CORE=… STEPS=routes,slash,persist node tools/proof/needle.mjs`.
  - Expected: 3 × PASS.
  - `dist/client/probe/index.html` contains the probe page's `<h1>` text (proof that the page was prerendered).
- [ ] **Step 5: Run `npx tsc --noEmit` and `npm test`.** Expected: tsc clean. Vitest's surviving tests pass; tests importing deleted modules were already removed in this task's Files, so none fail on imports.
- [ ] **Step 6: Commit** (stage explicit paths and deletions; `git add -u` plus the new files by name): `Needle: React Router + R3F scaffold with a persistent canvas`.

### Task 2: Move the engine and its tests

**Files:**
- Move with `git mv`:
  - `src/scripts/three/{AngleSpring,CameraRig,Choreography,FreeTurn,TextureWarmup,applyPose,overlay,palette,quality,stillness}.ts` → `src/engine/`
  - `src/scripts/three/instrument/*` → `src/engine/instrument/`
  - `src/scripts/three/studio/*` → `src/engine/studio/`
  - `src/scripts/core/{Handlers,deadline,SafeStorage}.ts` → `src/engine/core/`
  - `src/scripts/compass/loading.ts` → `src/engine/loading.ts`
- Delete: `src/scripts/three/{CompassScene,RenderLoop,PixelBudget,Pearl,pearlSpec,ChipPointer,TrackPointer}.ts`, then the empty `src/scripts/`.
- Tests:
  - `git mv tests/unit/*.test.ts tests/unit/engine/` for every test whose subject moved.
  - Delete `tests/unit/{chip-pointer,pearl,pearl-spec,pixel-budget,render-loop,track-pointer}.test.ts`.
  - `tests/unit/{qa,tracks-data}.test.ts` stay in `tests/unit/`.
- Modify: `tools/glyphs.mjs`, so its output path is `src/engine/instrument/glyphs.ts`.

**Interfaces:**
- Produces: `~/engine/**` with unchanged exports. Later tasks import from:
  - `~/engine/instrument/Instrument` (`buildInstrument`, `InstrumentModel`)
  - `~/engine/instrument/paint` (`paintInstrument`, `paintedMaps`)
  - `~/engine/instrument/textures` (`loadInstrumentTextures`, `TEXTURE_FILES`)
  - `~/engine/instrument/Tracks` (`buildTracks`), `~/engine/instrument/Wire` (`buildWire`)
  - `~/engine/studio/CompassStudio` (`buildCompassStudio`, `shoulder`)
  - `~/engine/Choreography` (`compassPoseAt`, `nominalSpans`)
  - `~/engine/applyPose` (`applyPose`)
  - `~/engine/CameraRig` (`layoutFor`, `placeCamera`, `Shot`)
  - `~/engine/quality` (`qualityFor`, `qualitySteps`, `Quality`)
  - `~/engine/stillness` (`asleep`, `Stillness`)
  - `~/engine/TextureWarmup` (`warmScene`)
  - `~/engine/AngleSpring` (`AngleSpring`)
  - Choreography, applyPose, overlay, Pool and Wire are kept only to pose the M1 placeholder. M2 replaces them; do not refactor them now.

- [ ] **Step 1: Move the files.** Fix relative imports only where a moved file imported a deleted one: `CompassStudio`, `TextureWarmup` and `instrument/*` must import nothing from deleted modules. Run `grep -rn "scripts/" src tests` and expect no hits.
- [ ] **Step 2: Run `npm test`.** Expected: every moved test passes; the count is about 210, reported in the commit message.
- [ ] **Step 3: Run `npx tsc --noEmit` and `npm run build`.** Expected: clean.
- [ ] **Step 4: Commit:** `Needle: move the compass engine and its tests to src/engine`.

### Task 3: Page list, redirects and post-build pipeline

**Files:**
- Create:
  - `src/data/pages.ts`, `src/data/redirects.ts`
  - `tools/build/postbuild.mjs`, `tools/build/csp.mjs`, `tools/build/redirects.mjs`, `tools/build/sitemap.mjs`, `tools/build/og.mjs`
  - `tests/unit/pages.test.ts`, `tests/unit/redirects.test.ts`, `tests/unit/csp.test.ts`
- Delete: every redirect stub in `public/`: `public/{career,nl,projects,en}/**` and `public/{cookies-clicker,jontai-energy}.html`. They are generated from now on.
- Modify:
  - `react-router.config.ts` (`prerender: pagePaths()`)
  - `package.json`: `build` gains `&& node tools/build/postbuild.mjs`
  - `.github/workflows/deploy.yml`: audit `dist/client`, upload `dist/client`
  - `lighthouserc.json`: `staticDistDir: ./dist/client`; URLs `/`, `/en/`, `/about/china/`, `/projects/funcial/`, `/lite/`, `/contact/`
  - `README.md`: the build/preview/deploy section

**Interfaces:**
- Produces:
  - `src/data/pages.ts`:
    - `export type PageId = 'home' | 'about-china' | 'about-netherlands' | 'about-aruba' | 'project-funcial' | 'project-jontai-energy' | 'project-cookies-clicker' | 'lite' | 'contact'`
    - `export const PAGES: Record<PageId, string>` = `/`, `/about/china/`, `/about/netherlands/`, `/about/aruba/`, `/projects/funcial/`, `/projects/jontai-energy/`, `/projects/cookies-clicker/`, `/lite/`, `/contact/`. These are locale-neutral routes for `Translator.pathFor`.
    - `export function pagePaths(): string[]`: every page in NL and EN; 18 paths, each ending `/`.
  - `src/data/redirects.ts` `export const redirects: readonly { from: string; to: string; locale: Locale }[]`, containing:
    - `/projects/web-development/` → `/projects/jontai-energy/`
    - `/projects/web-development/jontai-energy/` → `/projects/jontai-energy/`
    - `/projects/web-development/cookies-clicker/` → `/projects/cookies-clicker/`
    - `/projects/game-development/` → `/projects/cookies-clicker/`
    - `/projects/game-development/cookies-clicker/` → `/projects/cookies-clicker/`
    - each of the five above also under `/en/`
    - `/lab/compass/` → `/`; `/en/lab/compass/` → `/en/`
    - `/career/{cybersecurity,game-development,ui-ux-design,web-development}.html` → `/lite/#career`
    - `/jontai-energy.html` → `/projects/jontai-energy/`; `/cookies-clicker.html` → `/projects/cookies-clicker/`
    - `/nl/` → `/`; `/nl/contact/` → `/contact/`
    - `/nl/projects/{jontai-energy,cookies-clicker}/` → `/projects/{…}/`
    - **Note:** the old stubs `/projects/{jontai-energy,cookies-clicker}/` and `/en/projects/{…}/` are now real pages and must not appear here.
  - `tools/build/csp.mjs` `export function cspFor(html: string): string` and `export function applyCsp(html: string): string`.
    - Policy, with hashes of every inline `<script>` that is not `type="application/ld+json"`: `default-src 'self'; script-src 'self' https://static.cloudflareinsights.com <sha256 hashes>; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self' data:; font-src 'self'; media-src 'self'; connect-src 'self' https://api.web3forms.com https://cloudflareinsights.com; form-action 'self' https://api.web3forms.com; worker-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'self'; upgrade-insecure-requests`
    - `applyCsp` throws if a `<script` appears before the `__CSP__` meta, or if `/\son[a-z]+=/i` or `javascript:` appears in the HTML.
    - If inline `<style>` blocks exist, hash them into `style-src`.
  - `tools/build/postbuild.mjs` runs, in order:
    1. Rename `dist/client/__spa-fallback.html` to `dist/client/404.html` (with `noindex`).
    2. Write the redirect stubs. Same markup as today's stubs, but `<html lang>` follows `locale`, and the canonical and refresh point at `to`.
    3. Write `sitemap-index.xml` + `sitemap-0.xml` with hreflang `nl`/`en`/`x-default` alternates for every page path.
    4. `og.mjs`: `dist/client/og.jpg` at 1200×630, cropped from `src/assets/renders/compass-hero.webp` with sharp.
    5. `applyCsp` on every `.html` in `dist/client`, stubs included.
    6. Copy `CNAME`.
    - It prints a one-line summary.

- [ ] **Step 1: Write the failing tests.**
  - `pages.test.ts`: `pagePaths()` has 18 entries, all unique, all ending `/`, half starting `/en/`.
  - `redirects.test.ts`:
    - no `from` is in `pagePaths()`
    - every `to` (hash stripped) is in `pagePaths()`
    - no `to` is another redirect's `from` (no chains)
  - `csp.test.ts`:
    - `cspFor` hashes `<script>a()</script>` to `'sha256-` + base64(sha256('a()')) + `'`
    - it ignores `ld+json`
    - `applyCsp` throws on `<script>x</script><meta http-equiv="Content-Security-Policy" content="__CSP__">`
    - it throws on `<a onclick="x">`
    - it replaces `__CSP__` exactly once
- [ ] **Step 2: Run `npm test`.** Expected: the 3 new files FAIL (modules missing).
- [ ] **Step 3: Implement the modules.** `tools/build/*.mjs` import `src/data/*.ts` through `vite-node` or a tiny `tsx` loader: add `tsx` as a devDependency and run `postbuild.mjs` with `tsx`. Make the `build` script `react-router build && tsx tools/build/postbuild.mjs`.
- [ ] **Step 4: Run `npm test`.** Expected: PASS.
- [ ] **Step 5: Build and audit.**
  - `npm run build`.
  - Run the auditor through Pyodide, as `tools/proof/README.md` and the memory note describe:
    - mount `dist/client` and `tools`
    - run `unittest discover tools` and `site_audit.main(['dist/client','--strict'])`
  - Expected: 0 issues, apart from content checks on pages that Task 4 creates; those pages do not exist yet, so the auditor sees only home, probe and stubs.
  - If the auditor's rules need the new layout (e.g. `og.jpg` instead of a per-page PNG), change `tools/site_audit.py` and its test minimally, and say why in the commit.
- [ ] **Step 6: Commit:** `Needle: page list, generated redirects, sitemap and hashed CSP`.

### Task 4a: SEO head, pages and copy (except Lite and contact)

**Files:**
- Create:
  - `src/i18n/locale.ts`, `src/seo/head.ts`
  - `src/app/routes/{home,country,project,lite,contact,not-found}.tsx`; `lite` and `contact` are placeholders until Task 4b
  - `src/ui/{SiteHeader,LangSwitch,ThreeDToggle,Poster}.tsx`
  - `src/styles/{tokens,base}.css`
  - `src/data/directions.ts`
  - `tests/unit/head.test.ts`, `tests/unit/locale.test.ts`, `tests/unit/directions.test.ts`
- Modify:
  - `src/i18n/{en,nl}.ts`: add a `needle` block, typed in `en.ts`
  - `src/data/categories.ts`: replace the old web/game shelves with the approved void categories from `docs/projects-discovery.md` ("Proposed `src/data/projects.ts` block"):
    - `secure-element` (1, `SECURE ELEMENT`), `front-panel` (2, `FRONT PANEL`), `oscillator` (3, `OSCILLATOR`)
    - Labels stay English in NL too, until Bob answers the open label question.
  - `src/data/projects.ts`: adopt the approved block's fields on each entry: `categoryId`, `order`, `object.fallbackGeometry`, `testPoints` (labels and placeholder positions exactly as approved), `palette`, `motion` and `links { live?, repo? }`.
    - Keep the existing per-locale copy (`type`, `role`, `summary`, …) for the pages and Lite.
    - Add Funcial:
      - stack and summary from the approved block
      - EN/NL copy from `tracks.ts` and the `compass` i18n block
      - no screenshot: make `image` optional
    - Cookies Clicker:
      - add `Bootstrap 5` to its stack
      - never name the classmate (Bob has not decided)
      - the school subject is Web Game Development
    - Jontai Energy:
      - no `live` link (jontaienergy.com is not Bob's build)
      - nothing from the uncommitted Rewards work
    - Order: funcial, jontai-energy, cookies-clicker.
    - The glow values marked "art-direction" in the doc take the art-direction track gold `#efb53d`. Cookies' glow takes `#ff8a3d`, marked provisional in a comment.
  - Delete `src/data/tracks.ts` and `tests/unit/tracks-data.test.ts` once their copy is merged into `projects.ts`. Add `tests/unit/projects.test.ts`:
    - three projects
    - unique ids
    - each `categoryId` exists in `categories`
    - 4–5 test points each
    - Funcial's labels are exactly `LOG, GAME LAYER, MONEY RULES, VAULT, RESULT`
    - no stack contains `AI` or `Claude`
  - `src/app/routes.ts`: replace the probe routes with the real pages
  - `PRODUCT.md`: one line saying hidden-interaction easter eggs (a `0/N` counter) are allowed and are not a game
- Delete: `src/app/routes/probe.tsx` and the probe steps' paths in `tools/proof/needle.mjs` (point them at `/about/china/`).

**Interfaces:**
- Consumes: `PAGES` and `pagePaths()` (Task 3), `Translator` (`src/i18n/Translator.ts`, unchanged), `profile` (`src/data/profile.ts`).
- Produces:
  - `src/i18n/locale.ts`: `export function localeFromPath(pathname: string): Locale` returns `'en'` for `/en` or `/en/…`, else `'nl'`.
  - `src/seo/head.ts`:
    - `export interface HeadInput { locale: Locale; route: string; title: string; description: string; image?: string; noindex?: boolean; jsonLd?: Record<string, unknown>[] }`
    - `export function head(input: HeadInput): MetaDescriptor[]` returns:
      - title `"<title> | Bob Chung"`, except home, which uses `t.meta.title`
      - description and canonical `https://bhccob.me<path>`
      - `link rel=alternate hreflang` for `nl`, `en` and `x-default` (= the NL path)
      - `og:title`, `og:description`, `og:url`, `og:image` (`https://bhccob.me/og.jpg`), `og:locale`, `og:type`
      - `twitter:card=summary_large_image`
      - one `script:ld+json` per `jsonLd` item
  - `src/data/directions.ts`:
    - `export type DirId = 'east' | 'north' | 'west' | 'south'`
    - `export type CountryId = 'china' | 'netherlands' | 'aruba'`
    - `export interface Direction { id: DirId; kind: 'country' | 'portal'; country?: CountryId; engraving: string; accent: string }`
    - `export const DIRECTIONS: readonly Direction[]`:
      - east: China, `東`, `#a8352a`
      - north: Netherlands, `Noord`, `#1d5fa8`
      - west: Aruba, `[FILL: Papiamento word for west]`, `#2db3a8`
      - south: `kind: 'portal'`, `南`, `#efb53d`
      - Accents come from `docs/art-direction.md`.
    - `export function countryDirection(id: CountryId): Direction`
  - `needle` dictionary block (EN shown; NL formal equivalents):
    - `hero: { name: 'BOB CHUNG', tagline: 'FOLLOW THE NEEDLE', scrollCue }`
    - `loader: { caption }`
    - `fallback: { title: 'THE NEEDLE LOST NORTH', body, lite }`
    - `toggle: { on, off }`
    - `countries: Record<CountryId, { name: string; teaser: string; beats: [string, string, string]; metaDescription: string }>`
      - Real facts only: China = Chinese heritage; Aruba = born and raised; Netherlands = moved at eighteen, Rotterdam, MBO 4, HBO next.
      - Everything else is `[FILL: …]`.
    - `project: { open, repo, live, back }`
  - Each route module exports `meta` built with `head()`, and `handle = { scene: 'home' | 'country' | 'project' | null }`.
  - The home page renders:
    - `h1` "BOB CHUNG", the tagline and the scroll cue
    - a `<nav aria-label>` listing the three countries and three projects as links
    - The nav is visible when 3D is off, and visually hidden but focusable when 3D is on, so the page stays crawlable and keyboard-reachable.
  - Country and project pages render all their text as DOM:
    - country: `h1` = the country name, three beats
    - project: `h1` = the title, the category label, summary, stack tags, links, and the test-point labels from `projects.ts`
  - `ThreeDToggle` persists `needle-3d` = `on|off` through `SafeStorage` (`~/engine/core/SafeStorage`). The store wiring comes in Task 5; here it only reads and writes storage and sets `data-3d` on `<html>`.
  - `Poster` renders `src/assets/renders/compass-hero.webp` as `<img>` behind the canvas; it is the first paint.

- [ ] **Step 1: Write the failing tests.**
  - `locale.test.ts`: `/` → `nl`, `/en/` → `en`, `/en` → `en`, `/english/` → `nl`, `/about/china/` → `nl`.
  - `head.test.ts`: for `{locale:'en', route:'/about/china/'}`:
    - canonical is `https://bhccob.me/en/about/china/`
    - hreflang `nl` is `https://bhccob.me/about/china/`
    - `x-default` equals the `nl` URL
    - the title ends with `| Bob Chung`
    - `noindex: true` adds `robots: noindex, follow`
  - `directions.test.ts`:
    - exactly one `portal`, and it is `south`
    - the three countries appear once each
    - every engraving is non-empty
- [ ] **Step 2: Run them and see FAIL.**
- [ ] **Step 3: Implement the modules and the pages.** Styles: tokens are taken from `docs/art-direction.md` and `docs/art-direction/palette.json` (void `#0a0510`, nebula `#331846`, brass `#936233`, name gold `#e4be7f`, title gold `#f9dc87`, track gold `#efb53d`), and follow its ratio rule of about 60 % near-black, 30 % purple and at most 6 % gold. Fonts are Montserrat (name, tagline, reading text), Unbounded (heavy titles) and Martian Mono (labels), via fontsource imports in `root.tsx`. Delete `src/styles/bench-*.css`.
- [ ] **Step 4: Run `npm test`, `npx tsc --noEmit`, `npm run build`, then the Pyodide auditor `--strict` on `dist/client`.** Expected: all PASS, 0 issues.
- [ ] **Step 5: Run proof `STEPS=routes,slash,persist`.** Expected: PASS. The persist step navigates home → `/about/china/` → `/en/about/china/` → back.
- [ ] **Step 6: Commit:** `Needle: every page in NL and EN with real DOM copy and SEO`.

### Task 4b: Lite page and contact form

**Files:**
- Create:
  - `src/app/routes/lite.tsx`
  - `src/ui/lite/{LiteAbout,LiteSkills,LiteCareer,LiteOffDuty,LiteQa,LiteWorld,LiteWork}.tsx`
  - `src/ui/ContactForm.tsx`, `src/ui/contactSubmit.ts`
  - `tests/unit/contact-submit.test.ts`
- Modify: `src/app/routes/contact.tsx`

**Interfaces:**
- Consumes: the `t.about`, `t.skills`, `t.career`, `t.life`, `t.contact` and `t.compass.qa` copy; `qaEntries(t)` (`src/data/qa.ts`); `projects`; `DIRECTIONS`; `profile`; `src/assets/portrait.jpg`.
- Produces:
  - `/lite/` shows today's full copy in this order:
    1. world: the three countries linking to their pages
    2. work: the projects linking to their pages, with category label + year
    3. about, with the real portrait
    4. skills
    5. career, with `id="career"` (redirect target)
    6. off duty
    7. Q&A, as `<details>`
    8. a contact link
  - It has exactly one `h1`. It is fully usable with JS off.
  - `src/ui/contactSubmit.ts`:
    - `export function contactPayload(fields: { name: string; email: string; message: string }, key: string | undefined): { mode: 'web3forms'; body: Record<string,string> } | { mode: 'mailto'; href: string }`
    - Logic as in the deleted `src/scripts/contact/ContactForm.ts` (read it with `git show redesign-bench:src/scripts/contact/ContactForm.ts`): endpoint `https://api.web3forms.com/submit`; mailto to `profile.email` with an encoded subject and body.
  - `ContactForm.tsx` posts with `fetch` when `mode === 'web3forms'`, else sets `location.href`. Labels, errors and success copy come from `t.contact`.

- [ ] **Step 1: Write `contact-submit.test.ts`.**
  - With key `'k'` it returns mode `web3forms`, and the body has `access_key: 'k'` and the three fields.
  - Without a key it returns mode `mailto`, with an href that starts `mailto:bhccob@gmail.com?subject=` and contains the encoded message.
- [ ] **Step 2: Run it and see FAIL. Implement. Run it and see PASS.**
- [ ] **Step 3: Build the Lite sections and the contact route.** No new copy is invented. The terminal, the clocks and the engine-room copy are not used.
- [ ] **Step 4: Run `npm run build` + the auditor `--strict`.** Expected: 0 issues. The `/career/*.html` stubs' `/lite/#career` fragment resolves.
- [ ] **Step 5: Commit:** `Needle: Lite page with the full copy, and the contact form`.

### Task 5: Scene state machine, chapters, store and route sync

**Files:**
- Create: `src/state/{machine,chapters,store,frame,routeSync}.ts`; `tests/unit/state/{machine,chapters,route-sync}.test.ts`

**Interfaces:**
- Consumes: `CountryId` (`directions.ts`), `PAGES`, `localeFromPath`.
- Produces:
  - `machine.ts`:
    - `export type Phase = { kind: 'LOADING' } | { kind: 'HOME_IDLE' } | { kind: 'FOCUS_COUNTRY'; dir: CountryId } | { kind: 'COUNTRY_PAGE'; dir: CountryId } | { kind: 'DISSECT' } | { kind: 'MORPH' } | { kind: 'VOID_ENTRY' } | { kind: 'PROJECTS'; category: string | null } | { kind: 'PROJECT_FOCUS'; id: string }`
    - `export type SceneEvent = { type: 'LOADED' } | { type: 'CHAPTER'; chapter: ChapterId; category: string | null } | { type: 'FOCUS_COUNTRY'; dir: CountryId } | { type: 'OPEN_COUNTRY' } | { type: 'OPEN_PROJECT'; id: string } | { type: 'BACK' } | { type: 'ROUTE'; phase: Phase }`
    - `export function transition(phase: Phase, event: SceneEvent): Phase` returns the same object when the event does not apply.
    - Rules:
      - `LOADED` only from LOADING → HOME_IDLE.
      - `CHAPTER` applies from HOME_IDLE, DISSECT, MORPH, VOID_ENTRY and PROJECTS. HOME → HOME_IDLE; DISSECT/MORPH/VOID_ENTRY map to their kinds; PROJECTS carries the category.
      - `FOCUS_COUNTRY` applies from HOME_IDLE or FOCUS_COUNTRY.
      - `OPEN_COUNTRY` applies only from FOCUS_COUNTRY and gives COUNTRY_PAGE with the same dir.
      - `OPEN_PROJECT` applies from PROJECTS (or `ROUTE`).
      - `BACK`: FOCUS_COUNTRY → HOME_IDLE; COUNTRY_PAGE → FOCUS_COUNTRY (same dir); PROJECT_FOCUS → PROJECTS with category `null`.
      - `ROUTE` always gives its phase.
      - Progress is not in `Phase`.
  - `chapters.ts`:
    - `export type ChapterId = 'HOME' | 'DISSECT' | 'MORPH' | 'VOID_ENTRY' | 'PROJECTS'`
    - `export interface Chapters { units: { id: ChapterId; start: number; length: number; category: string | null }[]; total: number }`
    - `export function buildChapters(spec: { parts: number; categories: readonly string[] }): Chapters`: lengths are HOME 1, DISSECT `parts`, MORPH 2, VOID_ENTRY 1, then one PROJECTS unit per category, in that order.
    - `export function chapterAt(c: Chapters, p: number, previous?: { index: number }): { index: number; id: ChapterId; local: number; category: string | null }` clamps p to `[0, total]`.
    - **Hysteresis:** keep `previous.index` while p is within `HYSTERESIS = 0.02` units outside its span.
    - `export function stops(c: Chapters): number[]` returns each unit's start, plus `total`.
  - `store.ts`: zustand `useScene` with `{ phase: Phase; tier: 'high' | 'medium' | 'low'; threeD: boolean; reducedMotion: boolean; transitionId: number; dispatch(e: SceneEvent): void; setTier(t): void; setThreeD(on: boolean): void }`.
    - `dispatch` bumps `transitionId` only when `transition` returns a new object.
    - `threeD` is initialised from `SafeStorage` key `needle-3d`, and `reducedMotion` from `matchMedia('(prefers-reduced-motion: reduce)')`; both are guarded for SSR.
  - `frame.ts`: `export const frame = { progress: 0, target: 0, velocity: 0, pointer: { x: 0, y: 0 }, hoverDir: null as DirId | null, chapterIndex: 0, contextLost: false }`. It is mutated per frame and is never React state.
  - `routeSync.ts`:
    - `export function phaseForPath(pathname: string): Phase | null`: `/about/<country>/` → COUNTRY_PAGE; `/projects/<id>/` → PROJECT_FOCUS; `/` → null (scroll decides). Works with or without `/en`.
    - `export function pathForPhase(phase: Phase, locale: Locale): string | null`
    - `export function backTarget(arrivedDirect: boolean): 'history' | 'home'`
    - `export function useRouteSync(): void` (a hook in the same file): dispatches `ROUTE` on location change.

- [ ] **Step 1: Write the failing tests.**
  - `machine.test.ts`: one case per rule above, plus 'ignored event returns the identical object' (`toBe`).
  - `chapters.test.ts`:
    - `buildChapters({parts: 11, categories: ['a','b','c']}).total === 18`
    - `chapterAt(c, 0).id === 'HOME'`
    - `chapterAt(c, 1.5).id === 'DISSECT'` with local `0.5/11`
    - `chapterAt(c, 16.2).category === 'b'`
    - p = −3 clamps to HOME; p = 99 clamps to the last unit
    - hysteresis: with `previous.index = 0`, `chapterAt(c, 1.01, previous).index === 0`, and `1.03` moves to index 1
    - `stops(c)` begins `[0, 1, 12, 14, 15, 16, 17, 18]`
  - `route-sync.test.ts`:
    - `/en/about/aruba/` → COUNTRY_PAGE aruba
    - `/projects/funcial/` → PROJECT_FOCUS funcial
    - `/lite/` → null
    - `pathForPhase({kind:'COUNTRY_PAGE',dir:'china'},'en') === '/en/about/china/'`
    - `backTarget(true) === 'home'`
- [ ] **Step 2: Run them and see FAIL. Implement. Run them and see PASS.**
- [ ] **Step 3: Wire it up.** Call `useRouteSync()` in `Shell`, and make `ThreeDToggle` use `setThreeD`. Run tsc, test and build.
- [ ] **Step 4: Commit:** `Needle: scene state machine, chapters and route sync`.

### Task 6: Virtual scroll input

**Files:**
- Create: `src/input/{normalizeWheel,Inertia,keyDelta,VirtualScroll}.ts`; `tests/unit/input/{normalize-wheel,inertia,key-delta}.test.ts`
- Modify: `src/app/Shell.tsx` (mount VirtualScroll on the home route only); `src/styles/base.css` (`html[data-route="home"][data-3d="on"]` gets `overflow: hidden; overscroll-behavior: none`, and `.scene-host` gets `touch-action: none`. With 3D off, home scrolls natively.)

**Interfaces:**
- Consumes: `frame`, `useScene` (`phase`, `reducedMotion`), `buildChapters`, `stops`, `chapterAt`, `transition` events (Task 5).
- Produces:
  - `export const LINE_PX = 16`, `export const MAX_EVENT_PX = 240`
  - `export function normalizeWheel(e: { deltaY: number; deltaMode: number }, viewportH: number): { px: number; device: 'mouse' | 'trackpad' }`
    - deltaMode 1 → `deltaY * LINE_PX`; deltaMode 2 → `deltaY * viewportH`.
    - `device` is `'mouse'` when deltaMode ≠ 0 or `|deltaY| ≥ 50` with an integer value, else `'trackpad'`.
    - `px` is clamped to `±MAX_EVENT_PX`.
  - `export class Inertia`: `track(timeMs: number, px: number): void`, `release(timeMs: number): void`, `step(dtSec: number): number` (the px to apply this frame), `get active(): boolean`, `stop(): void`.
    - Release velocity comes from samples in the last 100 ms. Decay is `v *= exp(-4 * dt)`; it stops below 5 px/s.
  - `export function keyDelta(e: { key: string; shiftKey: boolean; target: { tagName?: string; isContentEditable?: boolean } | null }, viewportH: number): number | 'home' | 'end' | null`
    - Returns null when the target is `INPUT`, `TEXTAREA`, `SELECT` or contentEditable.
    - ArrowDown 0.15·vh, ArrowUp −0.15·vh, PageDown/Space 0.9·vh, PageUp/Shift+Space −0.9·vh, Home `'home'`, End `'end'`; else null.
  - `export class VirtualScroll`:
    - `constructor(el: HTMLElement, opts: { unitPx: () => number; onDelta: (units: number) => void; onJump: (to: 'home' | 'end') => void; enabled: () => boolean; reducedMotion: () => boolean })`
    - `dispose(): void`
    - Listens to `wheel` (passive: false, `preventDefault` only when enabled), `touchstart`/`touchmove`/`touchend` (Inertia on release unless reduced motion) and `keydown` on `window`.
    - Converts px to units with `unitPx()`, which equals `window.innerHeight`.
  - In Shell, `onDelta` adds to `frame.target`, clamped to `[0, chapters.total]`.
    - **Reduced motion:** the delta snaps `frame.target` to the next or previous `stops()` value.
    - A `useFrame`-free rAF in Shell damps `frame.progress` toward `frame.target` with maath `damp(frame, 'progress', frame.target, 0.25, dt)`.
    - When `chapterAt` changes index, it dispatches `CHAPTER`.
    - `enabled()` is true only when `threeD` is on and the phase is HOME_IDLE, DISSECT, MORPH, VOID_ENTRY or PROJECTS.
    - The chapter spec for M1 is `{ parts: 11, categories: categories.map((c) => c.id) }`, which gives `secure-element`, `front-panel` and `oscillator`.

- [ ] **Step 1: Write the failing tests.**
  - `normalize-wheel.test.ts`:
    - `{deltaY:3, deltaMode:1}` → px 48, mouse
    - `{deltaY:100, deltaMode:0}` → mouse
    - `{deltaY:4.5, deltaMode:0}` → trackpad
    - `{deltaY:1, deltaMode:2}` with vh 800 → px 240 (clamped)
    - 30 trackpad events of 4 px sum to 120 px, and one mouse notch is 100 px: same order of magnitude
  - `inertia.test.ts`:
    - tracks of +20 px every 16 ms then a release give `active === true` and a first `step(1/60) > 0`
    - after 3 s of steps, `active === false`
    - a release with no samples newer than 100 ms gives `active === false`
  - `key-delta.test.ts`:
    - Space on an `INPUT` target → null
    - Space on a `TEXTAREA` → null
    - PageDown on `BODY` with vh 1000 → 900
    - Shift+Space → −900
    - End → `'end'`
    - 'a' → null
- [ ] **Step 2: Run them and see FAIL. Implement. Run them and see PASS.**
- [ ] **Step 3: Extend the proof harness.**
  - Step `scroll`: on `/`, 10 wheel events of 120 px raise `__needleDebug().progress` (Task 8 adds the bridge; until then read `window.__needleFrame`, which Shell exposes behind `?proof`).
  - The phase leaves HOME_IDLE, and Home returns the phase to HOME_IDLE.
- [ ] **Step 4: Commit:** `Needle: virtual scroll for wheel, touch and keys`.

### Task 7: Scene: studio, placeholder compass, effects, quality tiers and fallback

**Files:**
- Create:
  - `src/scene/{Studio,Compass,Rig,Effects,QualityGovernor,Heartbeat}.tsx`
  - `src/scene/ShoulderToneMapping.ts`, `src/scene/webgl.ts`
  - `tests/unit/scene/{shoulder,webgl,banned-imports}.test.ts`
- Modify:
  - `src/scene/Stage.tsx`, `src/scene/SceneHost.tsx`
  - `src/engine/studio/CompassStudio.ts`: export its `SHOULDER` GLSL string; no behaviour change

**Interfaces:**
- Consumes: `buildCompassStudio`, `buildInstrument`, `paintInstrument`, `loadInstrumentTextures`, `compassPoseAt`, `nominalSpans`, `applyPose`, `buildTracks`, `buildWire`, `layoutFor`, `placeCamera`, `qualityFor`, `qualitySteps`, `asleep`, `warmScene` (Task 2); `useScene`, `frame` (Task 5).
- Produces:
  - `webgl.ts` `export function webglSupport(create: () => HTMLCanvasElement = () => document.createElement('canvas')): 'ok' | 'none' | 'software'`
    - `'software'` when `WEBGL_debug_renderer_info` reports SwiftShader or llvmpipe.
    - `SceneHost` loads `Stage` only for `'ok'` and when `threeD` is on.
    - Otherwise it shows `Poster` plus the fallback card (`t.needle.fallback`, with a link to `/lite/`). The card shows only for `'none'` and `'software'`, not when 3D was simply switched off.
  - `ShoulderToneMapping.ts`: `export class ShoulderToneMappingEffect extends Effect`, which uses the same `SHOULDER` source (wrapped as `mainImage`) and an `exposure` uniform.
  - `Stage.tsx` mounts `<Studio/>`, `<Compass/>`, `<Rig/>`, `<Effects/>`, `<QualityGovernor/>` and `<Heartbeat/>`, and listens for `webglcontextlost`/`webglcontextrestored` (it sets `frame.contextLost`).
  - `Compass.tsx`:
    - On mount: build the instrument, tracks and wire; paint; load the textures; `warmScene`; then dispose everything on unmount.
    - It poses with `applyPose` from `compassPoseAt(spans, 0)` (the M1 hero pose; M2 replaces it).
    - It adds a slow idle needle drift through `AngleSpring`.
  - `Rig.tsx`: `placeCamera` from `layoutFor` on resize; pointer parallax damped with maath `damp3`, at most 0.04 rad.
  - `Effects.tsx`:
    - For the `high` and `medium` tiers: `<EffectComposer>` with Bloom (luminanceThreshold 0.85, intensity 0.6), Vignette, Noise (opacity 0.03), then `<primitive object={shoulderEffect}/>` last.
    - The renderer's `toneMapping` is `NoToneMapping` while the composer is on.
    - For the `low` tier: no composer, and the renderer uses `shoulder()` + `CustomToneMapping` (today's path). DoF is added in M2.
  - `QualityGovernor.tsx`: `<PerformanceMonitor onDecline>` steps `qualitySteps` down only (never up), sets dpr from `qualityFor(step).pixelRatio` with `setDpr`, and maps the step to `tier` through `setTier`.
  - `Heartbeat.tsx`: calls `invalidate()` every frame while `!asleep(...)`, the phase is changing, or `frame.progress !== frame.target`.

- [ ] **Step 1: Write the failing tests.**
  - `shoulder.test.ts`: `ShoulderToneMappingEffect`'s fragment source contains `CompassStudio`'s exported `SHOULDER` body.
  - `webgl.test.ts`: a fake canvas returning null → `'none'`; a fake context whose renderer string is `'Google SwiftShader'` → `'software'`; `'ANGLE (NVIDIA…)'` → `'ok'`.
  - `banned-imports.test.ts`: scan `src/**/*.{ts,tsx}` and fail on `from '@react-three/drei'` imports naming `Text`, `Text3D`, `Environment` or `useGLTF`, on `three/addons/postprocessing`, on `'lenis'` and on `'troika`.
- [ ] **Step 2: Run them and see FAIL. Implement. Run them and see PASS.**
- [ ] **Step 3: Extend the proof harness.**
  - Step `no-webgl`: launch with `--disable-webgl --disable-3d-apis`, open `/` and expect the fallback title text, zero console errors and no `<canvas>`.
  - Step `fps`: on `/` after 3 s, sample 120 rAF frames. Report the mean fps; it PASSes when the scene renders (canvas non-blank: read 1 pixel through `toDataURL` sampling) and reports the number without gating it.
- [ ] **Step 4: Look at the result.** Screenshot `/` at 1440×900 in the harness and check by eye that the compass renders with tone mapping, not washed out. Compare it with `src/assets/renders/compass-hero.webp`. If the composer path looks clearly different from the old shoulder look, fix `exposure` or the colour space in `ShoulderToneMappingEffect` (the effect must work on linear input). Record the screenshot path in the commit message.
- [ ] **Step 5: Run tsc, test, build, the auditor `--strict` and proof `STEPS=routes,slash,persist,scroll,no-webgl,fps`.** Expected: all PASS.
- [ ] **Step 6: Commit:** `Needle: R3F stage with the ported compass, effects and quality tiers`.

### Task 8: Debug bridge and the M1 proof run

**Files:**
- Create: `src/debug/needleDebug.ts`; `tests/unit/debug/needle-debug.test.ts`
- Modify: `src/scene/Stage.tsx`, `src/app/Shell.tsx` (install the bridge; remove the temporary `window.__needleFrame`); `tools/proof/needle.mjs`; `tools/proof/README.md` (document needle.mjs beside compass.mjs and mark compass.mjs as the old revision-4 harness)

**Interfaces:**
- Consumes: `useScene`, `frame`, `chapterAt`, R3F `useThree` (`gl`, `camera`, `viewport.dpr`).
- Produces:
  - `export interface NeedleDebugState { phase: Phase; progress: number; target: number; chapter: { index: number; id: ChapterId; local: number; category: string | null }; route: string; locale: Locale; tier: 'high' | 'medium' | 'low'; dpr: number; fps: number; camera: { position: [number, number, number]; fov: number }; canvasMounts: number; contextLost: boolean; threeD: boolean }`
  - `export function installNeedleDebug(search: string, read: () => NeedleDebugState, act: { set(p: { progress: number }): void; dispatch(e: SceneEvent): void }): () => void`
    - It installs `window.__needleDebug` (a function returning `read()`, with `.set` and `.dispatch` properties) only when `search` contains `proof`.
    - It returns an uninstall function.
  - `fps` is a rolling mean over the last 60 frames, computed in Stage.

- [ ] **Step 1: Write the failing test.**
  - With `search = ''`, nothing is installed on a fake `window`.
  - With `'?proof'`, `__needleDebug()` returns `read()`'s object and `.set` forwards to `act.set`.
  - The returned uninstall removes it.
- [ ] **Step 2: Run it and see FAIL. Implement. Run it and see PASS.**
- [ ] **Step 3: Finish `needle.mjs` for M1.** All the steps above read `__needleDebug` now. Add:
  - `keyboard`: Tab reaches the 3D toggle and the language switch; End jumps to the last chapter; Home returns.
  - `lang-keeps-phase`: on `/about/china/` the phase is `COUNTRY_PAGE china`. After a client-side switch to `/en/about/china/` it is still `COUNTRY_PAGE china`, and `canvasMounts === 1`.
  - `reduced-motion`: `emulateMedia({reducedMotion:'reduce'})`; one wheel event moves `target` to exactly the next stop.
  - `stills`: screenshots of every page at 1440×900 and 390×844 into `PROOF_DIR/m1/`.
- [ ] **Step 4: Full run.**
  - `npm run build`
  - `npm run preview` (background)
  - `STEPS=routes,slash,persist,scroll,no-webgl,fps,keyboard,reduced-motion,stills node tools/proof/needle.mjs`
  - Expected: every step PASSes, with zero CSP violations and zero console errors reported in `results.json`.
- [ ] **Step 5: Run tsc, test and the auditor `--strict` once more.** Commit: `Needle: debug bridge and the M1 proof harness`.

---

## After the tasks (main session, not a subagent)

- Commit the side sessions' docs once they report done. Stage by explicit path:
  - `docs/art-direction.md`, `docs/art-direction/**`, `assets/manifest.json`
  - `docs/projects-discovery.md`, `docs/discovery/**`
- Show Bob the M1 review:
  - the `stills` screenshots
  - the proof results
  - fps
  - the discovery proposal status
- Wait for his OK before writing the M2 plan.
