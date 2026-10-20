# Compass proof harness

`compass.mjs` drives a real headless Edge through the compass review page
(`/lab/compass/`, `/en/lab/compass/`) and checks what the page promises: the
loader and its hand-over, the scrub through the sections, the pearl and the
needle, the drag, the phone, a reload part-way down, the failure paths, the
stacked page, the frame rate and the idle stop. It prints one PASS or FAIL line
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
| `STEPS` | comma list of steps to run (`1` to `10`, and `stills`); an unknown step, or none, exits 1 | `1,2,3,4,5,6,7,8,9,10` |
| `EDGE` | path of a browser executable, to use instead of the installed Edge | the installed Edge (`msedge` channel) |
| `PLAYWRIGHT_CORE` | path of the `playwright-core` package | normal resolution |

The page is opened with `?proof`, which makes the page expose
`window.__compassDebug()`: the section and how far through it, the quality step,
the spin, the tip, the needle's bearing, the pearl, the dial's drawn rim and the
count of frames drawn. The checks read their numbers from it.

## The steps

| step | what it does |
| --- | --- |
| 1 | A fresh context (a first visit): the loader hunts, settles on the pearl and hands over, the intro lands on the hero; no console errors. Reads both needles, the drawing's and the scene's, in the same animation frame at the first 3D frame after the hand-over (the difference should be 0). Checks the swap is hidden: the page's sections have a computed opacity of 0 at the moment `2-handover.png` is taken (the drawing half faded) and on every frame the drawing is up, its fade included. `1-loader.png`, `2-handover.png`, `3-hero.png`. |
| 2 | Scrubs down and back up through about, china, aruba (mid-sweep and painted) and rotterdam. `4-pool.png` to `8-sweep.png`. |
| 3 | The mouse to four points round the dial: the needle follows within 0.1 rad. Tab to the page's focusable controls: the pearl goes to each. `9-focus.png`, `9-pearl-west.png`. |
| 4 | A 400 px drag spins the dial clockwise, it coasts, and settles on a whole turn within 5 s; a vertical drag tips it, held to `tipLimit`, and it springs back. `10-spin.png`, `10-tip.png`. |
| 5 | A phone (390x844 and 844x390, touch): a vertical swipe scrolls, a horizontal one spins, a touch never tips, the pearl drifts and goes to a tap. `11-phone-*.png`. |
| 6 | Reloads at aruba in the same session: no loader, aruba's ring and needle from the first frame. `12-reload.png`. |
| 7 | Refuses the textures and the portrait (a plain scene), and then the three.js chunk (the stacked page at once). `13-*.png`, `14-no-chunk.png`. |
| 8 | Reduced motion, and a browser started with `--disable-3d-apis`: the stacked page with the four stills, the real portrait, no loader. `15-*.png`. |
| 9 | The frame rate over a full scrub on the GPU and on SwiftShader, the quality step reached, and the idle stop (no frames drawn after 25 s untouched). If SwiftShader gets the stacked page, `9-swiftshader-stacked.png` shows it. |
| 10 | Records `scrub.webm` at 1440x900: the first visit through the loader, a slow scroll down and back up, a drag spin at the hero, and a tip drag. |
| stills | Not in the default run (`STEPS=stills`): captures the four stills as PNG at 1600x900 into `PROOF_DIR/stills`, with the loader skipped and the page's words hidden (through the style API; the page's CSP blocks an injected `<style>`), at hero local 0.5 and at the end of china, aruba and rotterdam. |

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
  the settled tilt, the dial's layout) are at the top of `compass.mjs`; a drift
  shows as a failing check.

## Making the stills

`STEPS=stills` writes PNGs. The site's stills are WebP, 1600x900, quality 82; the
repo's `sharp` (a dependency of Astro) converts them:

```js
import { createRequire } from 'node:module';
const sharp = createRequire('<repo>/package.json')('sharp');
for (const name of ['hero', 'china', 'aruba', 'rotterdam']) {
  await sharp(`proof-out/stills/compass-${name}.png`).resize(1600, 900).webp({ quality: 82 }).toFile(`<repo>/src/assets/renders/compass-${name}.webp`);
}
```
