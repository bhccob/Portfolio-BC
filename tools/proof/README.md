# Proof harness

`needle.mjs` is the proof harness of the Needle site (React Router and React
Three Fiber, `npm run build`). It drives a real headless Edge through the built
site, served the way GitHub Pages serves it, and checks what the site promises:
every page, the persistent canvas, the scene's state machine, the virtual
scroll, the keyboard, the fallbacks, the frame rate, and milestone 2's opening
(the loader's moments, the quick and reduced paths), the dark look's luminance
gate, pointing at the constellations, sleep and the hero. It prints one `PASS` or
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
| `PROOF_DIR` | where `results.json` and the stills (`m2/`) go | `./proof-out` (ignored by git) |
| `STEPS` | comma list of steps to run; an unknown step, or none, exits 1 | all |
| `PLAYWRIGHT_CORE` | path of the `playwright-core` package | normal resolution |

For example, the milestone 1 review's run:

```
STEPS=routes,slash,persist,scroll,no-webgl,fps,keyboard,reduced-motion,stills node tools/proof/needle.mjs
```

and milestone 2's (the opening, the look, pointing):

```
STEPS=loader-stills,home-look,point,quick-loader,loader-reduced,sleep,hero-failsafe,load-throw,stills node tools/proof/needle.mjs
```

The harness reads `src/data/pages.ts`, `src/app/handle.ts` (which pages have a
scene) and `src/state/chapters.ts` (through `tsx`) and the build in
`dist/client` to know which pages, scenes and scroll stops to expect. A page of
`pagePaths()` the build did not produce is listed when the run starts and
skipped.

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
| `loader` | `{ stage, elapsed, pins }`: where the opening stands (`dark`, `engrave`, `power`, `circuit`, `land`, `home`; null while no opening is mounted), its visible seconds and the pins lit |
| `pointed` | the constellation the needle points at (`china`, `netherlands`, `aruba`), or null |
| `constellations` | each constellation's anchor on the screen now, `[x, y]` in CSS pixels from the viewport's top left |

and has `.set({ progress })` (puts the story at a place at once, the chapter and
phase with it), `.dispatch(event)` (sends a scene event), `.seekLoader(seconds)`
(holds the opening's clock at that moment of a load that filled in step with the
engraving, posing the whole scene from it, until `.seekLoader(-1)` lets go; the
phase stays as it is, so seek only once the page is on `HOME_IDLE`) and
`.scrollRequest`, the scroll loop's `requestAnimationFrame`, which the harness
wraps by assignment to count the loop's own frames apart from the canvas's.

## The steps

| step | what it checks |
| --- | --- |
| `routes` | every page the build produced answers 200 with one `<h1>`, in its HTML and after hydration, and the right `<html lang>`; a page without a scene has no `<canvas>` |
| `slash` | `/about/china` answers 301 to `/about/china/`; a browser opening it loads it once, with no reload |
| `bridge` | the debug bridge: absent, and nothing touched, without `?proof` (through a load, the opening's landing and a wheel gesture once landed); with it the state has exactly its fields, with the opening at home, `.set`, `.dispatch` and `.scrollRequest` act, `.seekLoader` is there, the old hooks are gone |
| `persist` | client navigation `/` to a country to its English page, back and forward: one Stage, the same `<canvas>`, no document load, the phase right at each place |
| `lang-keeps-phase` | on `/about/china/` the phase is `COUNTRY_PAGE china`; after a client-side switch to `/en/about/china/` (and back) it is still that very state, `canvasMounts` is 1; the same on a project page |
| `not-found` | unknown URLs answer 404 with the build's `404.html` and show the not-found `<h1>` once the router has taken over, with no reload loop; no scene file is asked for and no Stage mounts |
| `case-variant` | a real page under another spelling (`/About/China/`) is a 404 and shows the not-found page, with no scene |
| `home-nav` | the home page's six links: hidden but focusable with 3D on, shown with 3D off, the choice stored across a reload, no WebGL mounted with 3D off; the 3D switch is named "3D" in both states |
| `mobile` | every page at 390 px wide has no horizontal scroll |
| `esc` | the back link: Escape and a click go home or back by client navigation, also after a replace; not in a text field; a modified click is left alone |
| `nav-focus` | a link opens the new page at its top with the focus moved to `<main>` (on `/lite/` scrolled down, a project's `<h1>` in view at scrollY 0); Back returns to the place left; the language switch keeps the place; a push to `/en/lite/#career` (through React Router's own `window.__reactRouterDataRouter`) scrolls to it |
| `lite` | `/lite/` and `/en/lite/` complete without script (headings, portrait, details, `#career`); `/contact/` and its form (mailto fallback; with a key in the build: the honeypot, the pause, a form sent at once waiting out three seconds and then posting, the 15 s timeout) |
| `scroll` | the home page does not scroll natively with 3D on; wheel, keys and touch move the story; the loop sleeps at rest and asks for one frame at a time; text fields, pinch and 3D off are the browser's; coming back from a page keeps the story; touch drag and glide |
| `keyboard` | Tab reaches the skip link, the language switch and the 3D toggle in order, each ringed and on screen; the language switch's name begins with the "EN" it shows; End goes to the last chapter, Home returns |
| `reduced-motion` | with reduced motion (emulated), one wheel event moves `target` to exactly the next stop, down through every stop and back |
| `loaded` | a direct load goes from `LOADING` to `HOME_IDLE` once the opening has landed; the canvas draws on demand and sleeps when idle; 3D stored off mounts no WebGL |
| `no-scene` | a direct load of Lite or contact (NL and EN) asks for none of the scene's files (Stage chunk, three.js, maath, textures), mounts no canvas, shows no card and leaves `LOADING`; home → Lite by client navigation keeps the one canvas, asleep (no `requestAnimationFrame` through 1.5 s of mouse moves, nor through scrolling, nor the window's `resize` and the fonts' `loadingdone` sent with no change of size; a real resize redraws it once and it sleeps again), and home wakes it |
| `no-webgl` | WebGL off, and software-only: the poster (the CSS panel of the night with its faint glow, over the whole viewport, no image) and the fallback card, no canvas; on the GPU, a context lost for good and a scene never ready fall back to the card, a restored context draws again |
| `fps` | the frame rate on `/` (120 frames, reported, not gated) with the scene's own rolling `fps`, tier and pixel ratio; the canvas holds the scene (something bright, and the compass on its axis, the picture's middle column) |
| `background` | a page opened in a background tab is not given up on past the load timeout; in front, the scene loads |
| `title-ij` | Dutch text in Unbounded with an IJ is shaped without the font's IJ digraph; a crop of the NL card title into `m2/` |
| `stills` | every built page at 1440x900 and 390x844 once its opening has landed, and the fallback at both (its hero shown whole), into `m2/`; on a country or project page the page scrim is over the scene, and before the scene shows only the poster's own (the Stage chunk is held while that is measured); on Lite and contact no scene loads and the poster carries the page scrim |
| `loader-stills` | at both sizes, once landed (`HOME_IDLE`, the real load done): the opening's clock held by `seekLoader` at 0.6 s and 1.6 s (`engrave`), `engraveMin + 0.4` (`power`), `engraveMin + power + 0.8` (`circuit`) and `engraveMin + power + circuit + 0.7` (`land`), each moment's `loader.stage` checked and a still taken into `m2/loader-<n>-<size>.png`; the phase stays `HOME_IDLE`, and let go the opening is back at home |
| `home-look` | the home once landed at both sizes (`m2/home-<size>.png`, and three more samples a quarter of the city's 9 s pulse apart in `m2/samples/`), and the dark look's gate on every home and loader still, measured in a page: mean Rec. 709 luma at most 0.11 (home, every sample, so the pulse's peak) and 0.07 (loader), at most 0.4 % of the pixels at luma 0.98 or more, and its floor, dark but drawn: mean above 0.002 and some pixel of the scene's middle (15-85 % across, 48-85 % down, where no page text stands) at luma 0.3 or more; the numbers are printed and kept in `results.json` (`luma`) |
| `point` | at 1440x900, once landed: the mouse on each constellation's place (`constellations[id]`) points the needle at it within 1.5 s and shows its name alone, on screen (`m2/point-<id>.png`); the mouse in the empty sky between the ship and China points at nothing and shows no name (`m2/point-none.png`); the four stills gated as home stills, floor and all (`luma`) |
| `quick-loader` | a landed `/` reloaded in the same tab (the loader was seen this session) never engraves and reaches `HOME_IDLE` within `LOADER.quick + 2` s of the scene being ready; a new context engraves again |
| `loader-reduced` | with reduced motion, sampled every 100 ms until `HOME_IDLE`: the opening shows only `engrave`, `land` and `home`, in that order, and its lit pins never decrease |
| `sleep` | landed and left alone, with no input at all: the idle motion runs, then the canvas asks for no frame for a whole second, within `IDLE_SECONDS + SLEEP_WITHIN_MS` of the landing |
| `hero-failsafe` | with JavaScript on but the entry chunk aborted (the page never hydrates), the hero is hidden, then shown by the CSS fail-safe about 8 s in; with the page working, it is hidden from the first paint until `HOME_IDLE` and shows once landed |
| `load-throw` | the real Stage chunk patched so one call in the opening's load throws: the fallback card well inside the load timeout, 3D off and not stored, one reported error |
| `csp-enforced` | the policy is in force: on `/` and `/lite/` an injected inline `<script>` and an inline handler do not run, and each is reported as a `securitypolicyviolation` |

The stills of the milestone review go into `PROOF_DIR/m2/`. `stills` names
them after the page: `nl-home-1440x900.png`, `nl-about-china-1440x900.png`,
`en-projects-funcial-390x844.png`, and `fallback-1440x900.png`,
`fallback-390x844.png`. `loader-stills`, `home-look` and `point` add
`loader-1-1440x900.png` to `loader-5-390x844.png`, `home-1440x900.png`,
`home-390x844.png`, `point-china.png`, `point-netherlands.png`,
`point-aruba.png` and `point-none.png`, and `home-look` its pulse samples in
`m2/samples/` (`home-<size>-1.png` to `-3.png`). (The step that took stills of
four pages before it, `scene-stills`, is folded into `stills`.)

The loader stills are of the opening as a visitor sees it: while the clock is
held the phase stays `HOME_IDLE`, which would show the hero over the loader, so
the harness sets `<html data-loading>` (the page's own mark of a playing
opening, which hides the hero) for the held moments and takes it off again.
`home-look` gates the loader stills `loader-stills` took in the same run; run
without it, it takes them first.

## Notes

- The frame rate and the quality tier are reported (`results.json` keeps them
  in the `fps` step), never gated: they are the machine's.
- `not-found`, `load-throw`, `csp-enforced` and `hero-failsafe` each expect
  console errors that are the designed outcome (the browser's "Failed to load
  resource" for a 404 document, the host's report of a failed scene, the
  browser's refusal of an injected script, and for the aborted entry chunk its
  "Failed to load resource" and the failed dynamic import). They are counted
  and kept apart in `expected`; every other console message is an error.
  `csp-enforced` reads its own violations, so they never reach the step's `csp`
  list.
- The luminance gate (`home-look`, and `point` for its stills) is the spec's
  restraint, measured: if it fails, turn the look down (`LOOK.exposure`, the
  bloom, the city's glow in `src/scene/v3/look.ts`), never the gate's numbers
  (`LUMA_GATE`). Its floor (mean above 0.002, some pixel of the scene's middle at
  0.3) is there so a
  canvas that drew nothing cannot pass for a dark one; a still under it is a
  scene that failed, not a look to brighten.
- Console warnings are not errors and fail no step. On the D3D11 backend three's
  own `PMREMGGXConvolution` shader (the reflection room's PMREM) logs an HLSL
  warning `X4122 ... cannot be represented accurately in double precision` when
  the room is built: the compiler folding constants in its unrolled 256-sample GGX loop
  (the Hammersley sample 255/256 = 0.996094). It is three's shader, not the
  site's.
- The keyed contact checks (`lite`) run only on a build with
  `PUBLIC_WEB3FORMS_KEY` set; Web3Forms is answered by the harness, so a dummy
  key is enough and nothing is sent.
- `load-throw` finds the call to make throw (`.setRingMasks(`, the painted ring
  masks handed to the glass compass in `src/scene/v3/Opening.tsx`) in the built
  Stage chunk (`assets/Stage-<hash>.js`); the step fails if that is not there
  exactly once.
