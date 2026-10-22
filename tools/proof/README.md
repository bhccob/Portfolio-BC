# Proof harness

`needle.mjs` is the proof harness of the Needle site (React Router and React
Three Fiber, `npm run build`). It drives a real headless Edge through the built
site, served the way GitHub Pages serves it, and checks what the site promises:
every page, the persistent canvas, the scene's state machine, the virtual
scroll, the keyboard, the fallbacks, the frame rate, and the BOB opening (the
loader's moments, the skip, the quick and reduced paths, the give-up), the dark
look's luminance gate, the needle's aim, sleep and the hero. It prints one `PASS` or
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

Any `playwright-core` will do, wherever it is installed: on a machine with the
Playwright MCP, for example, the copy in npm's `_npx` cache
(`%LOCALAPPDATA%\npm-cache\_npx\<hash>\node_modules\playwright-core`).

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

and the BOB milestone's (the opening, the look, the aim):

```
STEPS=loader-stills,loader-skip,loader-lite,loader-skip-touch,quick-loader,loader-reduced,give-up,home-look,aim,sleep,hero-failsafe,load-throw,stills node tools/proof/needle.mjs
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
| `route`, `locale` | the kind of page the router shows (`home`, `project`, `lite`, `contact`, `not-found`) and its language |
| `tier`, `dpr` | the quality tier and the canvas's pixel ratio (0 while no Stage is mounted) |
| `fps` | the rolling mean over the last 60 frames the canvas drew (0 without a Stage) |
| `camera` | `{ position, fov }` |
| `canvasMounts` | how many Stages have mounted in this page view; the proof expects 1 across navigation |
| `contextLost`, `threeD` | the WebGL context is lost; the visitor's 3D switch |
| `loader` | `{ stage, elapsed, strokes }`: where the opening stands (`dark`, `engrave`, `open`, `rise`, `home`; null while no opening is mounted), its visible seconds, and how much of each of the five engraved marks is cut (the left B, its bar, the right B, its bar, the circle; 0 to 1 each) |
| `needleAngle` | the compass needle's angle now, radians: 0 up the screen, clockwise positive, so a pointer straight to the right of the pivot pulls it toward pi/2 |

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
| `slash` | `/projects/funcial` answers 301 to `/projects/funcial/`; a browser opening it loads it once, with no reload |
| `bridge` | the debug bridge: absent, and nothing touched, without `?proof` (through a load, the opening's landing and a wheel gesture once landed); with it the state has exactly its fields, with the opening at home (the five marks cut whole, a needle angle), `.set`, `.dispatch` (a project opened from the projects chapter, and back) and `.scrollRequest` act, `.seekLoader` is there, the old hooks are gone |
| `persist` | client navigation `/` to a project page to its English page, back and forward: one Stage, the same `<canvas>`, no document load, the phase right at each place |
| `lang-keeps-phase` | on `/projects/funcial/` the phase is `PROJECT_FOCUS funcial`; after a client-side switch to `/en/projects/funcial/` (and back) it is still that very state, `canvasMounts` is 1; the same on `/projects/cookies-clicker/` |
| `not-found` | unknown URLs answer 404 with the build's `404.html` and show the not-found `<h1>` once the router has taken over, with no reload loop; no scene file is asked for and no Stage mounts |
| `case-variant` | a project page under another spelling (`/Projects/Funcial/`, `/en/projects/FUNCIAL/`) is a 404 and shows the not-found page, with no scene |
| `home-nav` | the home page's three project links: hidden but focusable with 3D on, shown with 3D off, the choice stored across a reload, no WebGL mounted with 3D off; the 3D switch is named "3D" in both states |
| `mobile` | every page at 390 px wide has no horizontal scroll |
| `phone-menu` | on a touch phone (390x844) the header is one row, the name and Menu, the nav hidden; Menu opens the nav as a sheet from under the header to the bottom, Work, About and Contact each at least 44 px high, the button saying close; the 3D switch leaves it open, a link follows and closes it; on a project page Escape closes the open menu and stays, the next Escape goes home; with script off Menu still opens it; at 1440 px there is no Menu button and the nav is one row (option A, 2026-10-22) |
| `esc` | the back link: Escape and a click go home or back by client navigation, also after a replace; not in a text field; a modified click is left alone |
| `nav-focus` | a link opens the new page at its top with the focus moved to `<main>` (on `/lite/` scrolled down, a project's `<h1>` in view at scrollY 0); Back returns to the place left; the language switch keeps the place; a push to `/en/lite/#career` (through React Router's own `window.__reactRouterDataRouter`) scrolls to it |
| `lite` | `/lite/` and `/en/lite/` complete without script (headings, portrait, details, `#career`); `/contact/` and its form (mailto fallback; with a key in the build: the honeypot, the pause, a form sent at once waiting out three seconds and then posting, the 15 s timeout) |
| `scroll` | the home page does not scroll natively with 3D on; wheel, keys and touch move the story; the loop sleeps at rest and asks for one frame at a time; text fields, pinch and 3D off are the browser's; coming back from a page keeps the story; touch drag and glide |
| `keyboard` | Tab reaches the skip link, then the header in its order (the name, Work, About, Contact, the language switch, Lite, the 3D toggle), the language switch and the toggle ringed and on screen; the language switch's name begins with the "EN" it shows; End goes to the last chapter, Home returns |
| `reduced-motion` | with reduced motion (emulated), one wheel event moves `target` to exactly the next stop, down through every stop and back |
| `loaded` | a direct load goes from `LOADING` to `HOME_IDLE` once the opening has landed, the whole show (12.5 s, never shortened on a fast load) after a start within the load timeout; the canvas draws on demand and sleeps when idle; over a project page a mouse wiggle wakes only the parallax; 3D stored off mounts no WebGL |
| `no-scene` | a direct load of Lite or contact (NL and EN) asks for none of the scene's files (Stage chunk, three.js, maath, textures), mounts no canvas, shows no card and leaves `LOADING`; home → Lite by client navigation keeps the one canvas, asleep (no `requestAnimationFrame` through 1.5 s of mouse moves, nor through scrolling, nor the window's `resize` and the fonts' `loadingdone` sent with no change of size; a real resize redraws it once and it sleeps again), and home wakes it |
| `no-webgl` | WebGL off, and software-only: the poster (the CSS panel of the night with its faint glow, over the whole viewport, no image) and the fallback card, no canvas; on the GPU, a context lost for good and a scene never ready fall back to the card, a restored context draws again |
| `fps` | the frame rate on `/` (120 frames, reported, not gated) with the scene's own rolling `fps`, tier and pixel ratio; the canvas holds the scene (something bright, and the compass on its axis, the picture's middle column) |
| `background` | a page opened in a background tab is not given up on past the load timeout; in front, the scene loads |
| `title-ij` | Dutch text in Unbounded with an IJ is shaped without the font's IJ digraph; a crop of the NL card title into `m2/` |
| `stills` | every built page at 1440x900 and 390x844 once its opening has landed, and the fallback at both (its hero shown whole), into `m2/`; on a project page the page scrim is over the scene, and before the scene shows only the poster's own (the Stage chunk is held while that is measured); on Lite and contact no scene loads and the poster carries the page scrim |
| `loader-stills` | at both sizes, once landed (`HOME_IDLE`, the real load done): the opening's clock held by `seekLoader` at 1.75, 5.0 and 8.25 s (`engrave`: the first B, the second B, the circle), 9.75 s (`open`: the iris), 11.0 s (`rise`) and 12.5 s (`home`), each moment's `loader.stage` checked and a still taken into `m2/loader-<n>-<size>.png`; the phase stays `HOME_IDLE`, and let go the opening is back at home |
| `loader-skip` | a first visit's full show: a click 3 s in lands on `HOME_IDLE` within 1.6 s; reloaded with `bob-loader-seen` cleared, 40 wheel events over 1 s from 3 s in (the burst's real length checked, 0.9 to 1.4 s) land on the home too, and after the burst the story's progress and target stay 0 for 1.5 s (six samples), the page unscrolled; reloaded once more, a real key press (Space) 3 s in lands on `HOME_IDLE` within 1.6 s and moves neither the story nor the page |
| `loader-lite` | the skip listens only while a scene is shown (Ruling 30): a first visit to `/projects/funcial/` with the compass's file held back (its load still out, as on a slow connection), the header's Lite link clicked 3 s into the loader; on Lite five wheel turns, then Space, then PageDown (each from the top) scroll the page, `scrollY` above 0, none of them prevented; the file let through and history back, the skip lands the show on the project page within 6 s |
| `loader-skip-touch` | on a touch phone (390x844, touch, coarse pointer): the loader never draws at the high tier, so without the floor's reflection (Ruling 31); a tap 3 s into a first visit's full show lands on `HOME_IDLE` within 1.6 s, its `touchstart` not prevented; a tap on Menu, then on its Contact link, 3 s into a project page's full show still navigates to `/contact/` |
| `quick-loader` | a first visit engraves and marks the loader seen (`bob-loader-seen` in localStorage); with the flag set, a load never engraves and reaches `HOME_IDLE` within `QUICK.home + 0.5` s (3 s) of the load (the first moment past `dark`) |
| `loader-reduced` | with reduced motion the opening never engraves (`dark`, the fade, `home`), the name is whole whenever it shows, the camera shot is identical in three samples once the canvas shows (early, half way, landed), and nothing is marked seen |
| `give-up` | `/models/bob-compass.glb` routed to never answer: on `/en/` the fallback card ("THE NEEDLE LOST NORTH") with its Lite link shows between 25 and 27 s after the page started (the loader gives up 25 s into its own clock); the time from the scene's `data-ready` is reported beside it |
| `home-look` | the home once landed at both sizes (`m2/home-<size>.png`, and three more samples a quarter of the engraving's 4 s breath apart in `m2/samples/`), and the dark look's gate on every home and loader still, measured in a page: mean Rec. 709 luma at most 0.11 (home, every sample, so the breath's peak, and the held home `loader-6`) and 0.07 (loader), at most 0.4 % of the pixels at luma 0.98 or more, and its floor, dark but drawn: mean above 0.002 and some pixel of the scene's middle (15-85 % across, 48-85 % down, where no page text stands) at luma 0.3 or more; the numbers are printed and kept in `results.json` (`luma`) |
| `aim` | at 1440x900, once landed: the mouse to the right of the pivot (the middle of the screen, where the home shot looks) turns the needle to within 0.1 of pi/2 within 1.5 s, swinging there with a delay (`m2/aim-right-1440x900.png`, gated as a home still); on a touch phone (390x844) the needle drifts on its own: `needleAngle` changes over 3 s |
| `sleep` | landed and left alone, with no input at all (so the needle drifts): the idle motion runs and the drift goes on to its next rest (`DRIFT_RUN`, `nextDriftRest(IDLE_SECONDS)`, 14 s), then the canvas asks for no frame for a whole second, within `DRIFT_RUN + SLEEP_WITHIN_MS` of the landing and not before `DRIFT_RUN - 2` s |
| `hero-failsafe` | with JavaScript on but the entry chunk aborted (the page never hydrates), the hero (the hidden name, the scroll cue) and the header are hidden, then shown by the CSS fail-safe about 8 s in; with the page working, both are hidden from the first paint until `HOME_IDLE` (the loader has no text but the engraving) and show once landed |
| `load-throw` | the real Stage chunk patched so one call in the opening's load throws: the fallback card well inside the load timeout, 3D off and not stored, one reported error |
| `csp-enforced` | the policy is in force: on `/` and `/lite/` an injected inline `<script>` and an inline handler do not run, and each is reported as a `securitypolicyviolation` |

The stills of the milestone review go into `PROOF_DIR/m2/`. `stills` names
them after the page: `nl-home-1440x900.png`, `nl-projects-funcial-1440x900.png`,
`en-projects-funcial-390x844.png`, and `fallback-1440x900.png`,
`fallback-390x844.png`. `loader-stills`, `home-look` and `aim` add
`loader-1-1440x900.png` to `loader-6-390x844.png` (the six held moments, the
last the home), `home-1440x900.png`, `home-390x844.png` and
`aim-right-1440x900.png`, and `home-look` its breath samples in `m2/samples/`
(`home-<size>-1.png` to `-3.png`). (The step that took stills of four pages
before it, `scene-stills`, is folded into `stills`.)

The loader stills are of the opening as a visitor sees it: while the clock is
held the phase stays `HOME_IDLE`, which would show the hero and the header over
the loader, so the harness sets `<html data-loading>` (the page's own mark of a
playing opening, which hides them both) for the held moments, checks the header
is gone, and takes it off again for the last moment, the home, which is taken
as the visitor sees it land.
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
  list. `give-up`'s report of the give-up is a warning, which fails nothing.
- The luminance gate (`home-look`, and `aim` for its still) is the spec's
  restraint, measured: if it fails, turn the look down (`LOOK` in
  `src/scene/bob/look.ts`: the exposure, the bloom, the lights; `GLASS_LOOK`,
  `COMPASS_LOOK`, `ENGRAVING_LOOK` and `SMOKE_LOOK` in `src/engine/bob/build/`),
  never the gate's numbers (`LUMA_GATE`). Its floor (mean above 0.002, some pixel
  of the scene's middle at 0.3) is there so a canvas that drew nothing cannot
  pass for a dark one; a still under it is a scene that failed, not a look to
  brighten.
- Console warnings are not errors and fail no step. On the D3D11 backend three's
  own `PMREMGGXConvolution` shader (the reflection room's PMREM) logs an HLSL
  warning `X4122 ... cannot be represented accurately in double precision` when
  the room is built: the compiler folding constants in its unrolled 256-sample GGX loop
  (the Hammersley sample 255/256 = 0.996094). It is three's shader, not the
  site's.
- The keyed contact checks (`lite`) run only on a build with
  `PUBLIC_WEB3FORMS_KEY` set; Web3Forms is answered by the harness, so a dummy
  key is enough and nothing is sent.
- `load-throw` finds the call to make throw (`.initTexture(`, the band strips
  uploaded to the GPU in `src/scene/bob/Opening.tsx` once the compass is built)
  in the built Stage chunk (`assets/Stage-<hash>.js`); the step fails if that is not there
  exactly once.
