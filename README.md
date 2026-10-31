# bhccob.com: Bob Chung's portfolio

Personal portfolio of Bob Chung, a student software engineer in Rotterdam, in Dutch (at `/`) and English (at `/en/`).

The home page is a scroll-driven 3D story around a compass, drawn with WebGL. Every other page is plain text over a
still poster, and `/lite/` carries all of the site's content without any 3D. Pages without a scene (Lite, contact,
not found) load no WebGL at all; a visitor can also switch 3D off in the header, and a browser without usable WebGL
gets the poster and a link to Lite.

| Part | Built with | Where |
| --- | --- | --- |
| The site | **TypeScript**, [React Router](https://reactrouter.com) 8 in framework mode (static: `ssr: false`, every page prerendered), React 19, Vite | `src/` |
| The 3D scene | [three.js](https://threejs.org) through [React Three Fiber](https://r3f.docs.pmnd.rs), drei and `@react-three/postprocessing`; one persistent canvas, drawn on demand | `src/scene/`, `src/engine/` |
| The deploy guard | **Python** (standard library only): audits every built page before release | `tools/site_audit.py` |

## Getting started

Requirements: Node.js 22.12 or newer; Python 3.10 or newer for the auditor. The auditor uses the standard library
only, so on a machine with no system Python, Blender's bundled Python runs it as well (from the repository root, after
a build; the path is the Steam install's):

```bash
"/c/Program Files (x86)/Steam/steamapps/common/Blender/5.2/python/bin/python.exe" -I tools/site_audit.py dist/client
```

```bash
npm install
npm run dev
```

The dev server runs at `http://localhost:5173`.

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the dev server on port 5173 |
| `npm run build` | `react-router build` (prerenders every page of `src/data/pages.ts` in both languages), then the post-build steps below; the site is `dist/client/` |
| `npm run preview` | Serves `dist/client/` at `http://localhost:4399/` the way GitHub Pages does (`/x` redirects to `/x/`, paths are case-sensitive, unknown URLs get `404.html`) |
| `npm test` | Runs the unit tests (Vitest) |
| `npm run typecheck` | Generates React Router's route types, then type-checks everything (`tsc --noEmit`) |
| `npm run audit` | Runs the Python site auditor on `dist/client/` |
| `npm run build:icons -- --force` | Re-renders the app icons from `public/favicon.svg` |

To run the auditor's own tests: `python -m unittest discover tools`.

### What the build does after the prerender

`tools/build/postbuild.mjs` (run with `tsx`, as it reads `src/data/*.ts`) finishes `dist/client/`, in this order:

1. renames React Router's `__spa-fallback.html` to `404.html` and marks it `noindex`
2. writes a redirect page for every old URL in `src/data/redirects.ts` (they are generated, never kept in `public/`)
3. writes `sitemap-index.xml` and `sitemap-0.xml`, with Dutch, English and `x-default` alternates for every path of
   `pagePaths()` (`src/data/pages.ts`)
4. renders `og.jpg` (1200 × 630) from `src/assets/renders/compass-hero.webp`
5. writes the Content-Security-Policy into every `.html` file (see Security)
6. copies `CNAME`

A page is built, routed and listed in the sitemap by having an entry in `PAGES` (`src/data/pages.ts`) and a kind in
`PAGE_KINDS` (`src/app/handle.ts`), and its words in both languages. `tests/unit/routes.test.ts` and
`tests/unit/route-handle.test.ts` fail if a page has no route or its route module does not match its kind.

## Project structure

```
src/
  app/        root layout (Shell, CSP and analytics tags), routes, route handles, entry points
    routes/   one module per kind of page: home, project, lite, contact, not-found
  scene/      the React Three Fiber stage: its host and fallback, the studio and camera rig, the BOB opening (the
              loader) and home (scene/bob, with their poses and look), post effects, quality governor and the
              on-demand frame loop
  engine/     the scene's engine: the BOB wordmark, loader timeline, probe path, shots, band strips and needle
              (engine/bob) and its builders (engine/bob/build: the glass, the engraving, the traces, the probe, the
              smoke, and the compass from its GLB), the shoulder tone mapping and noise textures (studio), the
              quality ladder, stillness
  state/      the scene's discrete state (zustand store, phase machine, chapters, route sync) and per-frame values
  input/      the home page's virtual scroll: wheel, touch and keys
  ui/         header and switches, poster, back link, Lite sections, contact form
  seo/        <head> tags, structured data, the not-found page's tags, the analytics beacon
  debug/      the proof harness's bridge (only under ?proof)
  data/       profile, projects, categories, the compass's parts, pages, Q&A and old-URL redirects
  i18n/       Dutch and English copy (nl.ts is type-checked against en.ts)
  styles/     design tokens and base styles
  assets/     screenshots, the portrait and the share image's source (renders/compass-hero.webp)
tools/
  build/      the post-build steps (404, redirects, sitemap, share image, CSP)
  proof/      the proof harness (see tools/proof/README.md)
  blender/    the approved Blender preview of the BOB loader (bob_build.py, bob_animate.py, bob_scroll.py,
              bob_encode.py) and export_compass.py, which writes the compass's GLB (public/models/bob-compass.glb)
  serve-pages.mjs, site_audit.py (+ tests), icons.mjs
public/       CNAME, icons, web manifest, robots.txt, .well-known/security.txt, models/bob-compass.glb (the compass:
              geometry, UVs and its rise, no materials; re-export it with
              `blender -b --factory-startup --python tools/blender/export_compass.py -- public/models/bob-compass.glb`)
tests/unit/   Vitest unit tests
docs/         the art direction, the project discovery notes and docs/audit.md (what the rebuild kept and why)
```

`opentype.js` is a dev dependency that nothing in `src/` imports: it stays because
`docs/art-direction/tools/type.mjs` (the art direction's swatch and font-sample renders) imports it.

### Editing content

- **Text** (both languages): `src/i18n/en.ts` and `src/i18n/nl.ts`.
- **Projects**: `src/data/projects.ts`: for each project its category, test points (labelled in both languages),
  palette, links and the words of its page in both languages. A screenshot, if it has one, goes in `src/assets/` and is
  named in `image`. A new project also needs a `project-<id>` entry in `PAGES` (`src/data/pages.ts`) and in
  `PAGE_KINDS` (`src/app/handle.ts`).
- **Categories**: `src/data/categories.ts` (a number and a label in each language).
- **The scene's words** (hero, loader and its failure card, compass parts, the 3D switch, the Lite link, the project
  page's words): the `needle` block of the dictionaries. They are copied from `docs/art-direction.md` § Copy budget, and `tests/unit/needle-copy.test.ts`
  checks that they match it.
- **Links, email, birthday**: `src/data/profile.ts` (the age on the site is calculated from the birthday).

## Environment variables

Both are read at build time and are optional. Locally, copy `.env.example` to `.env`; on GitHub, add them under
**Settings → Secrets and variables → Actions → Variables** (the deploy workflow passes them to the build).

| Variable | What it does |
| --- | --- |
| `PUBLIC_WEB3FORMS_KEY` | The [Web3Forms](https://web3forms.com) access key the contact form posts with. Without it the form opens the visitor's email app with the message filled in. |
| `PUBLIC_CF_ANALYTICS_TOKEN` | The site token of [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/) (free, no cookies, so no consent banner is needed). With it every page loads Cloudflare's beacon; without it no analytics script is loaded. |

## Contact form

The form sends messages through Web3Forms (create an access key with your email address and set
`PUBLIC_WEB3FORMS_KEY`). Without JavaScript and with a key it is a plain HTML form that posts to Web3Forms; without a
key the page shows the direct links instead. A hidden honeypot field (a filled one is told the message went, and
nothing is sent), a minimum of three seconds between opening the page and sending (a message sent sooner shows that it
is sending and waits out the rest) and a one-minute pause after a message has gone out keep spam bots out.

## Security

- **Content-Security-Policy**: GitHub Pages cannot send response headers, so the build writes the policy into a
  `<meta>` tag on every page (`tools/build/csp.mjs`: the prerendered root layout carries the tag with a `__CSP__`
  placeholder, and `applyCsp` fills it with the sha256 of every inline script and style the page holds). No
  `'unsafe-inline'` or `'unsafe-eval'` for scripts, no workers. `applyCsp` fails the build if a script comes before the
  tag or the page has an inline event handler or a `javascript:` URL. Only same-origin resources load, plus Web3Forms and
  the Cloudflare beacon.
- **What a meta tag cannot do**: `frame-ancestors` (clickjacking protection) and HSTS only work as headers. If the
  site ever moves behind a host or proxy that can set headers (for example Cloudflare), add them there.
- `public/.well-known/security.txt` tells people how to report a problem.
- The Python auditor checks every built page (language, title, description, one `<h1>`, alt text, canonical and
  hreflang links, Open Graph, structured data, internal links) and fails the build if a page loses its CSP, links to a
  new tab without `rel="noopener"`, loads anything over plain `http://`, or if a redirect page is indexable.
- GitHub runs CodeQL on the TypeScript and Python code, and Dependabot opens weekly update pull requests.

## Deployment

Every push to `main` runs `.github/workflows/deploy.yml`: it installs, type-checks, runs the unit tests, checks
dependencies with `npm audit`, builds (with the two variables above), runs the auditor's tests, audits `dist/client/`
in strict mode, runs Lighthouse (`lighthouserc.json`: accessibility and SEO must score 95+, best practices 90+;
performance is reported) and publishes `dist/client/` to GitHub Pages. Pull requests run the same checks without
publishing. One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**, and tick
**Enforce HTTPS**.

## Proof harness

`tools/proof/needle.mjs` drives a headless Microsoft Edge through the built site, served by `npm run preview`, and
checks what the site promises: every page and its language, the persistent canvas across navigation, the scene's
state machine, the virtual scroll, the keyboard, focus and scroll after a navigation, the pages that load no WebGL,
the fallbacks, the BOB opening (its moments, its skip by click, wheel, key and tap, the quick and reduced paths, the
give-up), the dark look's luminance gate, the policy being in force and the frame rate. It writes `results.json` and
screenshots of every page.
It adds no dependency to the repository: `playwright-core` is installed outside it. See `tools/proof/README.md`.
