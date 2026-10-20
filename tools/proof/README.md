# Proof harness

`needle.mjs` is the proof harness of the Needle site (React Router and React
Three Fiber, `npm run build`). It drives a real headless Edge through the built
site, served the way GitHub Pages serves it, and checks what the site promises:
every page, the persistent canvas, the scene's state machine, the virtual
scroll, the keyboard, the fallbacks and the frame rate. It prints one `PASS` or
`FAIL` line per step, writes `results.json` (and the stills) to a folder, and
exits 1 if a step failed. Every step also fails on a console error, a page error
or a CSP violation, so a clean `results.json` has `errors: []` and `csp: []` in
every step.

It is not part of the site or its tests, and it adds no dependency to the repo:
Playwright lives outside it.

`compass.mjs` in the same folder is the **old revision-4 harness**, for the
compass review page (`/lab/compass/`) of the Astro site. It does not run
against this build (that page and the `__compassDebug()` it reads are gone) and
nothing calls it. It is kept for reference, not deleted: `needle.mjs` took its
shape from it (a step runner, one `PASS` or `FAIL` line per step, a
`results.json`, the `msedge` channel, the `STEPS` and `PROOF_DIR` variables),
and `docs/audit.md` points at it as the revision-4 harness. Its own header
lists what it checks.

## Set up once

Install `playwright-core` in a folder of your own (it needs no browser
download; the harness launches the Edge that is already on the machine, which
`playwright-core` finds by its `msedge` channel):

```
npm i --prefix C:/tools/playwright-check playwright-core
```

Point `PLAYWRIGHT_CORE` at the package (a path). Without it the harness uses
normal resolution, which finds `playwright-core` only if it is installed where
Node looks (a parent folder's `node_modules`, say).

```
set PLAYWRIGHT_CORE=C:\tools\playwright-check\node_modules\playwright-core
```

## Run

Build the site and serve the build on port 4399 (the preview server,
`tools/serve-pages.mjs`, is case-sensitive and answers 404 with `404.html`, as
GitHub Pages does):

```
npm run build
npm run preview
```

then, from the repo root, in another terminal:

```
node tools/proof/needle.mjs
```

| variable | what | default |
| --- | --- | --- |
| `BASE` | the site to test | `http://localhost:4399` |
| `PROOF_DIR` | where `results.json` and the stills (`m1/`) go | `./proof-out` (ignored by git) |
| `STEPS` | comma list of steps to run; an unknown step, or none, exits 1 | all |
| `PLAYWRIGHT_CORE` | path of the `playwright-core` package | normal resolution |

For example, the milestone 1 review's run:

```
STEPS=routes,slash,persist,scroll,no-webgl,fps,keyboard,reduced-motion,stills node tools/proof/needle.mjs
```

The harness reads `src/data/pages.ts` and `src/state/chapters.ts` (through
`tsx`) and the build in `dist/client` to know which pages and which scroll stops
to expect. A page of `pagePaths()` the build did not produce is listed when the
run starts and skipped.

A run that cannot begin (nothing built, the preview server not answering, Edge
not starting) prints `FAIL setup <reason>`, writes a `results.json` that holds
that one failure, and exits 1.

The GPU flags are the Windows ANGLE/D3D11 ones. On another system change
`GPU` at the top of `needle.mjs` and read the frame rate as that machine's. A
headless browser does not wait for a display's refresh, so frames can be drawn
faster than a screen would show them. The `no-webgl` step starts two more
Edges of its own, one with WebGL off and one with only SwiftShader.

## `?proof` and `window.__needleDebug`

The site has one proof hook, `window.__needleDebug`, and it exists only when
the first URL of the page has `?proof` (`src/debug/needleDebug.ts`). Without
`?proof` there is no bridge, and nothing of the site reads or writes one: the
`bridge` step traps every hook name the site has ever had and runs a wheel
gesture to prove it. The steps open their pages with `?proof` (the query
survives the server's 301 and a `reload`; a client-side navigation drops it, but
the bridge is installed from the first URL and stays).

`window.__needleDebug()` answers the state:

| field | what |
| --- | --- |
| `phase` | the scene's phase (`{ kind, dir?, category?, id? }`): the store's own object, so two reads are the same object while nothing changed |
| `progress`, `target`, `velocity` | the story's place, where the input has asked it to be, and its speed (exactly 0 at rest) |
| `chapter` | `{ index, id, local, category }`: the chapter `progress` is in |
| `route`, `locale` | the kind of page the router shows (`home`, `country`, `project`, `lite`, `contact`, `not-found`) and its language |
| `tier`, `dpr` | the quality tier and the canvas's pixel ratio (0 while no Stage is mounted) |
| `fps` | the rolling mean over the last 60 frames the canvas drew (0 without a Stage) |
| `camera` | `{ position, fov }` |
| `canvasMounts` | how many Stages have mounted in this page view; the proof expects 1 across navigation |
| `contextLost`, `threeD` | the WebGL context is lost; the visitor's 3D switch |

and has `.set({ progress })` (puts the story at a place at once, the chapter and
phase with it), `.dispatch(event)` (sends a scene event) and `.scrollRequest`,
the scroll loop's `requestAnimationFrame`, which the harness wraps by
assignment to count the loop's own frames apart from the canvas's.

## The steps

| step | what it checks |
| --- | --- |
| `routes` | every page the build produced answers 200 with one `<h1>`, in its HTML and after hydration, and the right `<html lang>` |
| `slash` | `/about/china` answers 301 to `/about/china/`; a browser opening it loads it once, with no reload |
| `bridge` | the debug bridge: absent, and nothing touched, without `?proof`; with it the state has exactly its fields, `.set`, `.dispatch` and `.scrollRequest` act, the old hooks are gone |
| `persist` | client navigation `/` to a country to its English page, back and forward: one Stage, the same `<canvas>`, no document load, the phase right at each place |
| `lang-keeps-phase` | on `/about/china/` the phase is `COUNTRY_PAGE china`; after a client-side switch to `/en/about/china/` (and back) it is still that very state, `canvasMounts` is 1; the same on a project page |
| `not-found` | unknown URLs answer 404 with the build's `404.html` and show the not-found `<h1>` once the router has taken over, with no reload loop |
| `case-variant` | a real page under another spelling (`/About/China/`) is a 404 and shows the not-found page |
| `home-nav` | the home page's six links: hidden but focusable with 3D on, shown with 3D off, the choice stored across a reload, no WebGL mounted with 3D off |
| `mobile` | every page at 390 px wide has no horizontal scroll |
| `esc` | the back link: Escape and a click go home or back by client navigation, also after a replace; not in a text field; a modified click is left alone |
| `lite` | `/lite/` and `/en/lite/` complete without script (headings, portrait, details, `#career`); `/contact/` and its form (mailto fallback, a key, the guards, the 15 s timeout) |
| `scroll` | the home page does not scroll natively with 3D on; wheel, keys and touch move the story; the loop sleeps at rest and asks for one frame at a time; text fields, pinch and 3D off are the browser's; coming back from a page keeps the story; touch drag and glide |
| `keyboard` | Tab reaches the skip link, the language switch and the 3D toggle in order, each ringed and on screen; End goes to the last chapter, Home returns |
| `reduced-motion` | with reduced motion (emulated), one wheel event moves `target` to exactly the next stop, down through every stop and back |
| `loaded` | a direct load goes from `LOADING` to `HOME_IDLE` once the scene is ready; the canvas draws on demand and sleeps when idle; 3D stored off mounts no WebGL |
| `no-webgl` | WebGL off, and software-only: the poster and the fallback card, no canvas; on the GPU, a context lost for good and a scene never ready fall back to the card, a restored context draws again |
| `fps` | the frame rate on `/` (120 frames, reported, not gated) with the scene's own rolling `fps`, tier and pixel ratio; the canvas is not blank |
| `background` | a page opened in a background tab is not given up on past the load timeout; in front, the scene loads |
| `title-ij` | Dutch text in Unbounded with an IJ is shaped without the font's IJ digraph; a crop of the NL card title into `m1/` |
| `stills` | every built page at 1440x900 and 390x844, and the fallback at both, into `m1/`; on a page of text the page scrim is over the scene, and before the scene shows only the poster's own (the Stage chunk is held while that is measured) |
| `load-throw` | the real Stage chunk patched so one call in the compass's load throws: the fallback card well inside the load timeout, 3D off and not stored, one reported error |

`stills` writes the screenshots of the milestone review into `PROOF_DIR/m1/`,
named after the page: `nl-home-1440x900.png`, `nl-about-china-1440x900.png`,
`en-projects-funcial-390x844.png`, and `fallback-1440x900.png`,
`fallback-390x844.png`. (The step that took stills of four pages before it,
`scene-stills`, is folded into it.)

## Notes

- The frame rate and the quality tier are reported (`results.json` keeps them
  in the `fps` step), never gated: they are the machine's.
- `not-found` and `load-throw` each expect console errors that are the designed
  outcome (the browser's "Failed to load resource" for a 404 document, the
  host's report of a failed scene). They are counted and kept apart in
  `expected`; every other console message is an error.
- `load-throw` finds the call to make throw (`.instrument.setStrips(`) in the
  built Stage chunk (`assets/Stage-<hash>.js`); the step fails if that is not
  there exactly once.
