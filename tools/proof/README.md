# Compass proof harness

`compass.mjs` drives a real headless Edge through the compass review page
(`/lab/compass/`, `/en/lab/compass/`) and checks what the page promises: the
loader and its hand-over, the scrub through the sections, the pearl and the
needle, the drag, the phone, a reload part-way down, the failure paths, the
stacked page, the frame rate and the idle stop, and the hard drive's story:
every boundary both ways, a link to a track, the tracks under the pointer, the
Q&A's answers, the Tab order and the phone in the Q&A. It prints one PASS or FAIL line
per step, writes screenshots and `scrub.webm` to a folder, and exits 1 if a
step failed. Frame rates and the quality step are reported, never gated.

It is not part of the site or its tests, and it adds no dependency to the repo:
Playwright lives outside it.

## Set up once

Install `playwright-core` in a folder of your own (it needs no browser download;
the harness launches the Edge that is already on the machine, which
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

Build the site and serve the build on port 4399 (4321 is left to `astro dev`):

```
npm run build
npx astro preview --port 4399
```

then, from the repo root, in another terminal:

```
node tools/proof/compass.mjs
```

| variable | what | default |
| --- | --- | --- |
| `BASE` | the site to test | `http://localhost:4399` |
| `COMPASS_PATH` | the page; `/en/lab/compass/` for English | `/lab/compass/` |
| `PROOF_DIR` | where screenshots, `scrub.webm` and `results.json` go | `./proof-out` (ignored by git) |
| `STEPS` | comma list of steps to run (`1` to `16`, and `stills`); an unknown step, or none, exits 1 | `1` to `16` |
| `EDGE` | path of a browser executable, to use instead of the installed Edge | the installed Edge (`msedge` channel) |
| `PLAYWRIGHT_CORE` | path of the `playwright-core` package | normal resolution |

The page is opened with `?proof`, which makes the page expose
`window.__compassDebug()`: the section and how far through it, the quality step,
the spin, the tip, the needle's bearing, the pearl, the dial's drawn rim, the
count of frames drawn and the image maps the scene holds; and, for the drive,
the pose's drive values, head, park, platter, test point, how lit each track is,
interactivity, dimming, the Q&A's lit sector and the programs compiled. The
checks read their numbers from it. The sections' places are measured off the
page as the controller measures them (the Q&A is as tall as its content), so
`goTo(id, local)` lands where the scene says it is.

## The steps

| step | what it does |
| --- | --- |
| 1 | A fresh context (a first visit): the loader hunts, settles on the pearl and hands over, the intro lands on the hero; no console errors. Reads both needles, the drawing's and the scene's, in the same animation frame at the first 3D frame after the hand-over (the difference should be 0). Checks the swap is hidden: the page's sections have a computed opacity of 0 at the moment `2-handover.png` is taken (the drawing half faded) and on every frame the drawing is up, its fade included. `1-loader.png`, `2-handover.png`, `3-hero.png`. |
| 2 | Scrubs down and back up through about, china, aruba (mid-sweep and painted) and rotterdam. `4-pool.png` to `8-sweep.png`. |
| 3 | The mouse to four points round the dial: the needle follows within 0.1 rad. Tab to the page's focusable controls: the pearl goes to each. `9-focus.png`, `9-pearl-west.png`. |
| 4 | A 400 px drag spins the dial clockwise, it coasts, and settles on a whole turn within 5 s; a vertical drag tips it, held to `tipLimit`, and it springs back. `10-spin.png`, `10-tip.png`. |
| 5 | A phone (390x844 and 844x390, touch): a vertical swipe scrolls, a horizontal one spins, a touch never tips, the pearl drifts and goes to a tap. `11-phone-*.png`. |
| 6 | Reloads at aruba in the same session: no loader, aruba's ring and needle from the first frame. `12-reload.png`. |
| 7 | Refuses the textures and the portrait (a plain scene), and then the three.js chunk (the stacked page at once). Then holds the chunk on a later visit (no loader): the stacked page at 10 s, and the chunk let through after that starts nothing. Then holds the textures and the portrait on a first visit: the scene stops waiting at 7 s and the loader hands over to it in plain materials; the brass let through afterwards is taken in. `13-*.png`, `14-no-chunk.png`, `14-hung-chunk-seen.png`. |
| 8 | Reduced motion, and a browser started with `--disable-3d-apis`: the stacked page with the six stills, the real portrait, no loader. `15-reduced-motion.png`, `15-no-3d-apis.png`. |
| 9 | The frame rate over a full scrub on the GPU and on SwiftShader, the quality step reached, and the idle stop (no frames drawn after 25 s untouched). If SwiftShader gets the stacked page, `9-swiftshader-stacked.png` shows it. |
| 10 | Records `scrub.webm` at 1440x900 (run last): the first visit through the loader, then the whole story down with a pause in every section (three in the change), one hover on a track (Jontai Energy, its name beside the pointer), one answer opened and closed (the third question, its sector lit), Say hello under the pointer; back up with pauses at the drive and the homes, and a drag spin at the hero. |
| 11 | The whole story down and back up: at every one of the 15 boundaries, 2 px either side, the scene is in the right section and nothing jumps (the drive's six values, the head, the park, the dimming, the platter and the drawn rim); a screenshot at each boundary both ways and mid-change (`11-*.jpg`). Then a wheel scrub down and back up, every animation frame read: the sections pass in order and no drive value, head, park or dimming jumps from one frame to the next. The programs compiled after the load and after it all are the same (no compile on the way). |
| 12 | A later visit to `/#cookies-clicker`: from the first frame drawn the scene is at cookies-clicker, the head on its track (0.64) and the track lit, landing at its reading place with no motion replayed; its words and the head's label show. `12-anchor.png`. |
| 13 | Before the change (hero, current, mid-change) a sweep across the dial's rings shows no track's name and no pointer cursor; in jontai-energy the pointer on the track under the head shows its name and the pointer cursor (`13-hover.png`); a click there opens the project, as its link does. |
| 14 | The Q&A's questions: under Off duty's words (offduty 0.85) they are faded and the pointer goes through them; in the Q&A they take it. Each of the five answers opened and closed at qa 0.2: its sector lights and goes out (`__compassDebug().sector`), the scene stays in the Q&A, the page holds its scroll, and the scene's local matches the page's own (an open answer lengthens the Q&A, so the local reads lower while it is open and returns when it closes). `14-qa-open-*.png`. |
| 15 | Tab from the top at 1440x900 and at 390x844: it reaches the skip link, the three track links, the five questions and Say hello in document order, each with its focus ring, on screen with its words shown (on the narrow screen the questions below the drive's band). On the narrow screen a question focused while under the band comes down below it. `15-narrow-tab-qa.png`, `15-narrow-focus-under-band.png`. |
| 16 | A phone at 390x844 and 844x390 (touch) in the Q&A: the small drive is at its side place, none of the Q&A's words shown lies over it, and a vertical swipe that starts on a question scrolls the page and opens nothing. `16-phone-*.png`. |
| stills | Not in the default run (`STEPS=stills`): captures the six stills as PNG at 1600x900 into `PROOF_DIR/stills`, with the loader skipped and the page's words and labels hidden (through the style API; the page's CSP blocks an injected `<style>`), at hero local 0.5, at the end of china, aruba and rotterdam, the drive at funcial 0.3 and the spindle at offduty 0.6. |

Two things the harness does so a screenshot can show a moment that lasts a few
frames: it freezes `requestAnimationFrame` for the loader's hunt and the
hand-over's fade (`1-loader.png`, `2-handover.png`). Only steps 1, 7 and 8 and
the recording run a first visit, so the loader plays; every other step skips it
by setting `bob-compass-seen` in the session before the page loads.

## Notes

- The GPU flags are the Windows ANGLE/D3D11 ones. On another system set `EDGE`
  to a Chromium and read the GPU numbers as that machine's. A headless browser
  does not wait for a display's refresh, so frames can be drawn faster than a
  screen would show them.
- The page asks for a GPU (a WebGL2 context with `failIfMajorPerformanceCaveat`).
  Step 9 reports what the page does under SwiftShader (software WebGL) rather
  than forcing an outcome: the renderer's name, whether the page's own support
  test passes, and then either the stacked page (fps n/a) or the live scene drawn
  in software, measured like the GPU. On this machine's Edge the test passes and
  the live scene runs in software, at about 9.5 fps and the last quality step.
- Step 7's refused chunk is found by a route on `/_astro/live.<hash>.js`, the
  chunk that `src/scripts/compass-main.ts` imports as `./compass/live`
  (`src/scripts/compass/live.ts`). If that module is renamed or bundled into
  another chunk, the route no longer matches and the step fails with it.
- The numbers the harness repeats from the product (`OFF_AXIS`, the hero's and
  the settled tilt, the dial's layout and its side layout for the Q&A, the
  sections in order, the tracks' radii, the stills, the Q&A's 34% band on a
  narrow screen) are at the top of `compass.mjs`; a drift shows as a failing
  check.
- Steps 11 to 16 and the recording need the drive's fields in
  `__compassDebug()` (`drive`, `head`, `lit`, `sector`, `programs`, ...); the
  milestone 3 steps need only the compass's.

## Making the stills

`STEPS=stills` writes PNGs. The site's stills are WebP, 1600x900, quality 82; the
repo's `sharp` (a dependency of Astro) converts them:

```js
import { createRequire } from 'node:module';
const sharp = createRequire('<repo>/package.json')('sharp');
for (const name of ['hero', 'china', 'aruba', 'rotterdam', 'drive', 'offduty']) {
  await sharp(`proof-out/stills/compass-${name}.png`).resize(1600, 900).webp({ quality: 82 }).toFile(`<repo>/src/assets/renders/compass-${name}.webp`);
}
```
