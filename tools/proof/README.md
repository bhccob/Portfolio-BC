# Proof harness

`needle.mjs` is the proof harness of the Needle site (React Router and React
Three Fiber, `npm run build`). It drives a real headless Edge through the built
site, served the way GitHub Pages serves it, and checks what the site promises:
every page, the persistent canvas, the scene's state machine, the virtual
scroll, the keyboard, the fallbacks, the frame rate, and the BOB opening (the
loader's moments, the skip, the quick and reduced paths, the give-up), the home's
rise from the compass to BOB seen from above, the dive and the void under the glass (its journey stop by
stop, opening a bead, the hold while its file loads and the failure when it does not), the end page after the
last bead (its own scroll, its questions and form, 3D off and a failed void), the dark look's luminance
gate, the needle's aim, sleep and the hero. It prints one `PASS` or
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
STEPS=loader-stills,loader-skip,loader-lite,loader-skip-touch,quick-loader,loader-reduced,give-up,home-look,aim,scroll-bob,sleep,hero-failsafe,load-throw,stills node tools/proof/needle.mjs
```

and the void's (the seven stops, by `.set` and by real input, the labels, the hold, the failure, the paths across
them and the end page):

```
STEPS=bridge,scroll,scroll-bob,void-journey,bead-open,void-hold,void-fail,void-stops,void-paths,end-page,keyboard,reduced-motion node tools/proof/needle.mjs
```

The whole harness takes about half an hour (29 minutes on Bob's machine with the end page, `void-stops` and `void-paths`
the longest at about 6 and 4 minutes). A shell that limits a command to ten minutes can run it in parts with
`STEPS`, with the same `PROOF_DIR` so the stills stay together (each run writes its own `results.json`, so keep a copy
of each).

The harness reads `src/data/pages.ts`, `src/app/handle.ts` (which pages have a
scene) and `src/state/chapters.ts` (through `tsx`) and the build in
`dist/client` to know which pages, scenes and scroll stops to expect. A page of
`pagePaths()` the build did not produce is listed when the run starts and
skipped. The void's steps also read the journey (`src/scene/bob/journey.ts`: the
beads, `TUNNEL_HOLD`, the pure poses), `src/scene/bob/diveHold.ts`,
`src/data/categories.ts` and the Dutch dictionary (`src/i18n/Translator.ts`); the
project titles are read from the text of `src/data/projects.ts`, which cannot be
imported (it globs the screenshots with Vite's `import.meta.glob`).

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
| `loader` | `{ stage, elapsed, strokes }`: where the opening stands (`dark`, `engrave`, `open`, `rise`, `home`; null while no opening is mounted), its visible seconds, and how much of each of the five engraved marks is cut (the left B, its bar, the right B, its bar, the circle; 0 to 1 each). The loader cuts the circle alone, so the four B marks are always 0 and only the circle, the last, runs to 1 |
| `needleAngle` | the compass needle's angle now, radians: 0 up the screen, clockwise positive, so a pointer straight to the right of the pivot pulls it toward pi/2 |
| `journey` | `{ stretch, local, project, voidState }`: where the home's journey stands as the scene last posed it (`rise`, `dive`, `overview`, `project`, `end`, the end page at 6; how far through the stretch, 0 at its stop; the bead of a project stretch, 0 Funcial, 1 Jontai Energy, 2 Cookies Clicker, else null) and the void's load (`idle`, `loading`, `ready`, `failed`), which holds the scroll over the dive's tunnel (`TUNNEL_HOLD`, 1.475: Bob's frame d01, the camera 3.1 above the opening) until it is `ready`, and at BOB from above if it `failed` |
| `scroll` | `{ u, letters, iris, needleDip }`: the home's pose on the first unit of scroll, as the home last posed it: the rise `u` (0 at the home, 1 looking straight down on BOB) and the shares of the B letters' light, the compass's iris and the needle's dip, each 0 to 1 and linear in the rise; with reduced motion `u` is the stop the step fade shows. All 0 while nothing drives the home (the loader, a held `seekLoader`) |

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
| `bridge` | the debug bridge: absent, and nothing touched, without `?proof` (through a load, the opening's landing and a wheel gesture once landed); with it the state has exactly its fields, with the opening at home (the circle cut whole and no B mark cut, a needle angle, the scroll's pose at 0, the journey on the rise), `.set` (2.5 is half way through VOID_ENTRY and the journey says the overview, half way; past the end it stops at 6, the end page's stop, where the scroll ends: chapter and phase END, the journey's `end` stretch), `.dispatch` (a project opened from the last bead's stop, and back) and `.scrollRequest` act, `.seekLoader` is there, the old hooks are gone |
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
| `scroll` | the home page does not scroll natively with 3D on; wheel, keys and touch move the story; the loop sleeps at rest and asks for one frame at a time; text fields, pinch and 3D off are the browser's; Back from a project page puts the story at the bead's stop; a wheel gesture ended past the rise settles on a stop once the wheel is quiet (ten notches, come up out of the rise less than a whole unit past its top: BOB from above, 1); on the rise the keys move by their distance up to its top, past it each key is a stop; touch drag, a slow flick gliding on the rise, flicks past it resting on stops; the keys go past the dive's hold once the void is ready (the step waits for it) |
| `scroll-bob` | the home's first unit of scroll, the rise from the compass to BOB seen from above (the bridge's `scroll`), at 1440x900 with the wheel and at 390x844 with a finger (touch, coarse pointer), landed with `bob-loader-seen` set: at rest `u`, `letters`, `iris` and `needleDip` are 0 and no B mark is cut; moved the whole unit down (ten wheel notches of 120 px, since one is only 0.133 of the unit; swipes until the pose arrives) and at rest all four are 1; the gesture ends past the unit and settles on a stop past the rise, so the story is then put on stop 1 through `.set({ progress: 1 })` and there the camera stands on `topShotFor`, the whole name across the picture (`m2/bob-from-above-<size>.png`, gated as a home still); put at `u` 0.6 through `.set({ progress })` the iris, needle and letters are those of the pure pose (`scrollPoseAt`) and each is between 0 and 1 (`m2/bob-rising-<size>.png`, gated as a home still); put back where the ten notches summed to (the swipes: where they left it) and moved the whole unit up, `u` and `letters` are exactly 0 (the wheel's float residue is snapped away), the phase is `HOME_IDLE` (`m2/bob-back-home-<size>.png`, gated as a home still) and at 1440 the needle aims at a pointer to the right of the pivot within 1.5 s and rests on it 1.5 s later, eight real wheel notches (1.067, past the rise's top by more than the settle's slop and less than a whole unit) rest on BOB from above, 1, with the camera on the top shot, one more notch goes on to the overview, 2, and seven real arrow presses from the home stop on the rise's top, 1, with the camera on the top shot; the hero's SCROLL cue (`.hero-cue`) leaves with the rise (no text during the scroll): shown at the home (`<html data-rising>` unset, computed opacity 1, a 0.4 s opacity transition of its own, its pulse on the word inside it), gone at `u` 1 and at `u` 0.6 (`data-rising` set, opacity 0 once the transition has run, still in the page with its text, displayed and visible, so hidden by opacity alone) and back at the home; with reduced motion (1440) one wheel event down sets `<html data-step-fade>` with the pose still at the home, the scene host fades down, the rise is only ever 0 or 1 (no travel) and lands on `u` 1 with the attribute gone and the host shown again, the cue has no transition and no pulse and is gone on that stop, and one event up fades back to 0 with the cue back |
| `void-journey` | the void's journey at 1440x900 and 390x844 (touch, the medium tier), landed with `bob-loader-seen` set and the void `ready`: the camera of the first frame that poses the journey (its stretch, `local` and bead the pure journey's) is on that frame's shot (`journeyPoseAt`: the story put at 0.6, 1.5, 2.5, 3.5 and 4.5, each from a camera that was elsewhere, the same-frame check of Task 10's single writer); the story put through every stop down (1, the dive mid-way at 1.5, 2, 3, 4, 5, 6) and back (5 to 0), each waited for at rest: `journey.stretch`, `project` and `local` are the stop's (rise, dive, overview, then the beads 0, 1, 2 at 3, 4 and 5, Cookies Clicker's, and 6, the end, the end page's, `end` with no bead), `voidState` is `ready`, the camera stands on the journey's shot, and at a bead's stop its label shows whole inside the screen; going down, the dive mid-way, the overview and each bead are stilled (`m2/void-<stretch>[-<id>]-<size>.png`: `void-dive`, `void-overview`, `void-project-<id>`; at 1440 each bead again with the pointer on it, `void-project-<id>-hover-`) and gated as home stills, each bead after its object has had 2.2 s to move; then a fling by hand through every stop (60 wheel notches; 14 flicks on the phone, more until the end) rests at 6, the end, with the journey on the end page, past the dive's hold, and the stepped return to 0 and the fling back both rest at the home, which is M2a's exactly: the rise 0 in every share, `HOME_IDLE`, the SCROLL cue back, the journey on the rise at 0, the void still ready, and at 1440 the needle aiming at a pointer to the right of the pivot again |
| `bead-open` | opening a bead at 1440x900 and 390x844 (touch), landed with the seen flag set: at each project stop (3, 4, 5, put there through `.set`) the label (`.bead-label`) shows whole (`data-shown`, `data-rest`, opacity 1) inside the screen with the site's margin (16 px, 24 px on a phone) and under the 64 px header, its lines are the Dutch dictionary's (the category line from `categories`, the title read from `src/data/projects.ts`, the hint and the touch hint from `t.needle.bead`, the one for the pointer shown) and it links to `/projects/<slug>/`; Tab from the skip link reaches it (within 14 presses) with a focus ring of 2 px or more; Enter starts the flight: 120 ms on the page is still `/`, `<html data-bead-open>` is set and the phase is `PROJECT_FOCUS` on that bead, the router goes to the page 700 ms or more after the press (the 0.8 s flight), the heading is the project's title; Esc brings the story back to that bead's stop, at rest, PROJECTS in its category, and the label shows again; all three beads. A click (a tap on the phone) on Jontai Energy's label and on Cookies Clicker's bead itself (the middle of the picture at its stop) open too. None of it loads a document. A direct load of `/projects/cookies-clicker/`, then Esc once the opening has landed (the void may still be loading), lands at stop 5 with its label (up to 25 s are waited for it). The bridge has no field for a bead being opened, so the step reads the label's DOM, the URL and the phase |
| `void-hold` | at 1440x900 and 390x844 with `bob-beads.glb` held back by a route (the void stays `loading`): a long wheel (40 notches; 8 flicks on the phone) rests at `TUNNEL_HOLD`, 1.475 (Bob's frame d01), progress and target on it, the journey on the dive with `voidState` `loading`, the camera on the journey's shot for it (`journeyPoseAt(TUNNEL_HOLD)`, d01's pose) and above the glass (y above 0), nothing creeping a second later; a still of it (`m2/void-hold-<size>.png`) gated as a home still; scrolling back moves the story at once (3 notches go back exactly 3 x 120 px, then the gesture settles on BOB from above, 1; on the phone a flick's glide carries it on up the rise) and down again it rests on the hold again; the file let through, the void is `ready` and the scroll goes on to the overview, stop 2, the camera on its shot; and a direct load of `/projects/cookies-clicker/` with the file held again puts the scene on `PROJECT_FOCUS` on Cookies Clicker, the void still `loading`, and Esc: the story waits at the hold (the camera never comes out into an empty void) and, let through, reaches Cookies Clicker's stop, 5 |
| `void-fail` | at 1440x900 and 390x844 with `bob-beads.glb` answering 404: `voidState` becomes `failed` (`<html data-void>`); at the home `.home-nav` stays hidden (the SCROLL cue keeps the foot of the screen); a long push rests the scroll at 1.0 (`RISE_TOP`, BOB from above, the phase DIVE) and there `.home-nav` shows (fixed, `clip-path: none`, opacity 1, over 100 px high) with its three links on screen and each the element at its own middle; a still of it (`m2/void-fail-<size>.png`) gated as a home still; a link opens Funcial's page and Esc brings the story back to 1.0 and not to Funcial's stop; scrolled back to the home the nav is hidden again and the cue is back; the console has exactly one error for it, the browser's report of the 404 (kept in `expected`, once a size), and the Void's own line, `[needle] the void could not be loaded`, is a warning |
| `void-stops` | the void's stops by real input alone, never `.set`, at 1440x900, at 1366x657 (an odd height: a 1366x768 screen's window) and at 390x844 (touch), landed with the seen flag set and the void `ready`: real wheel notches of 120 px (deliberate 300 px swipes on the phone, the finger still before it lifts), one at a time, each left to come to rest: on the rise each rests where it ends, the one that comes up out of it on its top, BOB from above, 1, and past it each rests on a stop exactly, the next one each time (stop by stop), up to the end page's, 6, where one more stays (the walk ends `... 5 6 6`: at the end page the gesture is the page's own scroll); at each bead's stop its label shows whole inside the screen (`data-shown`, `data-rest`, opacity 1, no `tabindex`) and Tab from the skip link reaches it, ringed, the story staying on the stop; at both laptop sizes real arrow presses from the home too (0.15 of a viewport a press on the rise, stopping exactly on its top, 1, then a stop a press to 6, where one more stays, each bead's label whole and taking Tab), arrows up from the end page come back to Cookies Clicker's stop, 5, once the page is at its top, and with the focus on Cookies Clicker's label arrows up hand it to Jontai Energy's label, then Funcial's, and at the overview, where no label shows, to `<main>`, not `<body>`; at 1440x900 a push against an end that turns back within one gesture, real notches with no pause, rests where the story came back to: 60 down and 30 up from the home on 2 (pinned at 6, exactly 4 units back), 10 down against the end from Cookies Clicker's stop and 8 up on 4 (pinned at 6, it turns back from there and passes 5), 10 up and 10 down at the home on 1 (not part way into the dive); at both laptop sizes small notches one at a time each step one stop (a line-mode notch, `deltaMode` 1, sent as a `WheelEvent` on the root; real 10 px notches): 3 → 4 → 5 → 4 → 3 |
| `void-paths` | the paths across the tasks, at 1440x900: the 3D switch at a bead's stop (Jontai Energy's, 4, reached by real arrows): off, the story keeps its place (progress and target 4, not pulled to the dive's hold, the void `idle`), on again, once the void is `ready` again, it is back on 4 with its label shown whole, and one real notch from Funcial's stop with the switch clicked 40 ms later (within the wheel's quiet) is finished on 4 at once and comes back on 4, not on the overview; under reduced motion Funcial's stop reached by real arrows (a stop a press: 1, 2, 3), Tab and Enter open its page by a fade (`<html data-focus-fade>` set, the page there well under the 0.8 s a flight takes) and Esc fades back to 3 with its label; at `/en/` each bead's label, reached by real arrows, has the English dictionary's text ("01 — SECURE ELEMENT" and the others, the title, "Click to open" / "Tap to open") and links to its `/en/projects/<slug>/` page, and Tab and Enter on Funcial's fly into `/en/projects/funcial/` and Esc comes back to `/en/` at its stop |
| `keyboard` | Tab reaches the skip link, then the header in its order (the name, Work, About, Contact, the language switch, Lite, the 3D toggle), the language switch and the toggle ringed and on screen; the language switch's name begins with the "EN" it shows; End goes to the last chapter (the end, 6, the end page's stop, chapter and phase END; the step waits for the void so that nothing holds the dive), Home returns |
| `reduced-motion` | with reduced motion (emulated), one wheel event moves `target` to exactly the next stop, down through every stop (0 to 6: home, BOB from above, the overview, Funcial, Jontai Energy, Cookies Clicker, the end page) and back; one more at the end is no step (`<html data-step-fade>` never set, the host never faded): it scrolls the end page itself, and one up takes the page back to its top before the walk back up |
| `end-page` | the end page, the seventh stop, at 1440x900, 1366x657 and 390x844 (touch), landed with the seen flag set and the void `ready`, the story put on Cookies Clicker's stop through `.set` and the pointer parked in the bottom corner (off the beads and the header): reached from there by real input only, one wheel notch and ArrowDown on a laptop, one swipe on the phone; `<html data-end="rest">` within 3 s of the input (`REST_WITHIN_S`; on the phone from the swipe's lift, as the swipe's own length is the visitor's: the move covers 99 % of its way and rests there, Ruling 18; the arrival within 1e-4 took about 4.3 s), recorded in the summary, and the page's top moving at most 0.5 px (`SEAM_PX`) between the last frame `moving` and the first at rest (`#end`'s box read by a MutationObserver on `data-end` and the style); at rest `#end-title` seen whole in the viewport, `.end-page` not inert, no `requestAnimationFrame` at all in 600 ms (counted from the page's start, the canvas's included; the move there must have asked for frames, the count's positive control); a still `m2/end-<size>.png` gated as a home still with the page's text masked as the void's stills mask it (`textMask`); the page's own scroll: three notches down (three swipes) scroll it, the wheel not prevented, the story still at 6; End reaches its bottom (a laptop); the wheel up, one gesture with notches to spare (swipes down), back to `scrollY` 0, the story still at 6; one more notch (swipe), a new gesture after a pause of more than `GESTURE_GAP_MS`, back to 5 with Cookies Clicker's label whole at rest; a gesture begun in the page stays the page's: from `scrollY` 300, 12 notches up with no pause (one 600 px drag, lifted while moving) end at `scrollY` 0 with the story at 6; the questions are the dictionary's six, none open on arrival, a click (tap) opens the first, one on the second opens it and closes the first, and its answer is the Dutch dictionary's own, with no placeholder or tag; an empty send shows the form's errors as on `/contact/` (`#contact-name-error` shown, the three errors, the focus on the name, no `mailto:`; the build has no Web3Forms key, so the form is there once the page has hydrated); Tab from the header's last control (the 3D switch; Menu on the phone) reaches the six questions, then the name, email, subject and message fields; at 1440 a resize to 1000x700 and back keeps the story at 6, `data-end` at rest, the title in view and `scrollY` 0; a reload at the end, scrolled 300 px (checked), lands on the home (story 0, `scrollY` 0, no `data-end`, the page not shown, `display: none` with 3D on, and inert); the header's name at the end, scrolled 300 px, goes to the home (story 0, `scrollY` 0, no `data-end`); at 1440 and on the phone a click (a tap) on the rising page over Cookies Clicker's place, the middle of the picture, once `data-end` is `moving` on the way in (the tap past half way: a finger set down on a settle halts it and settles on the nearer stop), opens nothing: the URL stays `/` and the story rests at the end page, `data-end` at rest; at 1440 the pointer stands on the bead from its stop on, its hover lit as the move begins, and at rest the page still asks for no frame in 600 ms (the hover eased out on the way), and the same click on the way out, 6 to 5, leaves the story on Cookies Clicker's stop at `/`. Once, at 1440x900: `/en/` (the title and the first question in English); End from the home just after a pointer move there (the needle turned more than 0.05 rad, so its spring still swings), the move asking for frames, then at rest no `requestAnimationFrame` at all in 600 ms (the needle stands on its target at the end page, Ruling 19); the nav's `.end-link` with the void ready (Tab from the skip link reaches it, shown on screen while it has the focus as the nav's links are, the element at its own middle, the dictionary's words; Enter takes the story from the home to the end page by the move, progress samples between 1 and 6 and no step fade, the focus on `#end-title` at rest, in view at `scrollY` 0, the next Tab the first question), then 3D switched off there by the header's switch (`#end-title` inside the viewport at a `scrollY` past 0: the end page brought into view in the 3D-off home's flow, not the hero); 3D off (`#end` in the flow after `.home-nav`, below it, shown and not inert, reached by real wheel notches, none prevented); the void failed (`bob-beads.glb` answering 404: the scroll held at 1, the nav's `.end-link` button shows with the dictionary's words and goes to the end page by the step fade, `<html data-step-fade>` seen through a MutationObserver installed before the click, no progress sample strictly between 1 and 6, the focus on `#end-title`, and ArrowUp at the page's top back to 1 by a fade, again with no progress between, progress samples seen both ways); reduced motion (one notch from 5 to 6 and one up back to 5, each with `data-step-fade` seen, the rest read once the story's progress is there too); in both, the end page's computed opacity, sampled every 5 ms, is seen strictly between 0 and 1 on the way in and on the way out (it fades with the host, never cut in or out) |
| `loaded` | a direct load goes from `LOADING` to `HOME_IDLE` once the opening has landed, the whole show (6.25 s, never shortened on a fast load) after a start within the load timeout; the canvas draws on demand and sleeps when idle; over a project page a mouse wiggle wakes only the parallax; 3D stored off mounts no WebGL |
| `no-scene` | a direct load of Lite or contact (NL and EN) asks for none of the scene's files (Stage chunk, three.js, maath, textures), mounts no canvas, shows no card and leaves `LOADING`; home → Lite by client navigation keeps the one canvas, asleep (no `requestAnimationFrame` through 1.5 s of mouse moves, nor through scrolling, nor the window's `resize` and the fonts' `loadingdone` sent with no change of size; a real resize redraws it once and it sleeps again), and home wakes it |
| `no-webgl` | WebGL off, and software-only: the poster (the CSS panel of the night with its faint glow, over the whole viewport, no image) and the fallback card, no canvas; on the GPU, a context lost for good and a scene never ready fall back to the card, a restored context draws again |
| `fps` | the frame rate on `/` (120 frames, reported, not gated) with the scene's own rolling `fps`, tier and pixel ratio; the canvas holds the scene (something bright, and the compass on its axis, the picture's middle column) |
| `background` | a page opened in a background tab is not given up on past the load timeout; in front, the scene loads |
| `title-ij` | Dutch text in Unbounded with an IJ is shaped without the font's IJ digraph; a crop of the NL card title into `m2/` |
| `stills` | every built page at 1440x900 and 390x844 once its opening has landed, and the fallback at both (its hero shown whole), into `m2/`; on a project page the page scrim is over the scene, and before the scene shows only the poster's own (the Stage chunk is held while that is measured); on Lite and contact no scene loads and the poster carries the page scrim |
| `loader-stills` | at both sizes, once landed (`HOME_IDLE`, the real load done): the opening's clock held by `seekLoader` at five moments of the show, which cuts the circle alone and runs 6.25 s: 0.5 s (`dark`: black, the probe coming down), 50/24 s (`engrave`: half the circle), 3.6 s (`open`: the iris), 4.6 s (`rise`) and 6.25 s (`home`), each moment's `loader.stage` checked, no B mark cut, and a still taken into `m2/loader-<n>-<size>.png`; the phase stays `HOME_IDLE`, and let go the opening is back at home |
| `loader-skip` | a first visit's full show: a click 1.5 s in (inside the circle's cut: it closes at 3.08 s) lands on `HOME_IDLE` within 1.6 s, with the circle cut whole and no B mark cut; reloaded with `bob-loader-seen` cleared, 40 wheel events over 1 s from 1.5 s in (the burst's real length checked, 0.9 to 1.4 s) land on the home too, and after the burst the story's progress and target stay 0 for 1.5 s (six samples), the page unscrolled; reloaded once more, a real key press (Space) 1.5 s in lands on `HOME_IDLE` within 1.6 s and moves neither the story nor the page |
| `loader-lite` | the skip listens only while a scene is shown, so a page of text reached mid-show scrolls: a first visit to `/projects/funcial/` with the compass's file held back (its load still out, as on a slow connection), the header's Lite link clicked 1.5 s into the loader; on Lite five wheel turns, then Space, then PageDown (each from the top) scroll the page, `scrollY` above 0, none of them prevented; the file let through and history back, the skip lands the show on the project page within 6 s |
| `loader-skip-touch` | on a touch phone (390x844, touch, coarse pointer): the loader never draws at the high tier, so without the floor's reflection (a coarse pointer starts on medium); a tap 1.5 s into a first visit's full show lands on `HOME_IDLE` within 1.6 s, its `touchstart` not prevented; a tap on Menu, then on its Contact link, 1.5 s into a project page's full show still navigates to `/contact/` |
| `quick-loader` | a first visit engraves and marks the loader seen (`bob-loader-seen` in localStorage); with the flag set, a load never engraves, shows the circle whole with no B mark cut from its first frame, and reaches `HOME_IDLE` within `QUICK.home + 0.5` s (3 s) of the load (the first moment past `dark`) |
| `loader-reduced` | with reduced motion the opening never engraves (`dark`, the fade, `home`), the circle is whole (and no B mark cut) whenever it shows, the camera shot is identical in three samples once the canvas shows (early, half way, landed), and nothing is marked seen |
| `give-up` | `/models/bob-compass.glb` routed to never answer: on `/en/` the fallback card ("THE NEEDLE LOST NORTH") with its Lite link shows between 25 and 27 s after the page started (the loader gives up 25 s into its own clock); the time from the scene's `data-ready` is reported beside it |
| `home-look` | the home once landed at both sizes (`m2/home-<size>.png`, and three more samples a quarter of the engraving's 4 s breath apart in `m2/samples/`), and the dark look's gate on every home and loader still, measured in a page: mean Rec. 709 luma at most 0.11 (home, every sample, so the breath's peak, and the held home `loader-5`) and 0.07 (loader), at most 0.4 % of the pixels at luma 0.98 or more, and its floor, dark but drawn: mean above 0.002 and some pixel of the scene's middle (15-85 % across, 48-85 % down, where no page text stands) at luma 0.3 or more; the one still that is black on purpose, the loader's first moment (`loader-1`, 0.5 s, the probe coming down), keeps the loader ceiling and the clipped share and has its own floor in place of the middle's: the brightest pixel of the whole still, the probe, at luma 0.2 or more (0.26 and 0.30 measured); the numbers are printed and kept in `results.json` (`luma`) |
| `aim` | at 1440x900, once landed: the mouse to the right of the pivot (the middle of the screen, where the home shot looks) turns the needle to within 0.1 of pi/2 within 1.5 s, swinging there with a delay (`m2/aim-right-1440x900.png`, gated as a home still); on a touch phone (390x844) the needle drifts on its own: `needleAngle` changes over 3 s |
| `sleep` | landed and left alone, with no input at all (so the needle drifts): the idle motion runs and the drift goes on to its next rest (`DRIFT_RUN`, `nextDriftRest(IDLE_SECONDS)`, 14 s), then the canvas asks for no frame for a whole second, within `DRIFT_RUN + SLEEP_WITHIN_MS` of the landing and not before `DRIFT_RUN - 2` s |
| `hero-failsafe` | with JavaScript on but the entry chunk aborted (the page never hydrates), the hero (the hidden name, the scroll cue) and the header are hidden, then shown by the CSS fail-safe about 8 s in; with the page working, both are hidden from the first paint until `HOME_IDLE` (the loader has no text but the engraving) and show once landed; the hero is sampled every 50 ms from the moment the page can paint, once the document's own stylesheets (those there at DOMContentLoaded; a lazily inserted one blocks no paint) have loaded (before then nothing is drawn, and the computed style is the browser's default) |
| `load-throw` | the real Stage chunk patched so one call in the opening's load throws: the fallback card well inside the load timeout, 3D off and not stored, one reported error |
| `csp-enforced` | the policy is in force: on `/` and `/lite/` an injected inline `<script>` and an inline handler do not run, and each is reported as a `securitypolicyviolation` |

The stills of the milestone review go into `PROOF_DIR/m2/`. `stills` names
them after the page: `nl-home-1440x900.png`, `nl-projects-funcial-1440x900.png`,
`en-projects-funcial-390x844.png`, and `fallback-1440x900.png`,
`fallback-390x844.png`. `loader-stills`, `home-look` and `aim` add
`loader-1-1440x900.png` to `loader-5-390x844.png` (the five held moments, the
last the home), `home-1440x900.png`, `home-390x844.png` and
`aim-right-1440x900.png`, and `home-look` its breath samples in `m2/samples/`
(`home-<size>-1.png` to `-3.png`). `scroll-bob` adds `bob-from-above-<size>.png`
(the rise at 1, gated as a home still), `bob-rising-<size>.png` (at 0.6, gated as
a home still too) and `bob-back-home-<size>.png` (the home again after the whole unit back, gated as a
home still). `void-journey` adds `void-dive-<size>.png`, `void-overview-<size>.png`,
`void-project-<id>-<size>.png` for each bead and, at 1440, `void-project-<id>-hover-1440x900.png`; `void-hold` adds
`void-hold-<size>.png` and `void-fail` `void-fail-<size>.png`; `end-page` adds `end-1440x900.png`,
`end-1366x657.png` and `end-390x844.png`, the end page at rest; every one is gated as a home still. (The step that took stills of four pages
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
- `void-fail` expects the one console error of the file it makes answer 404 (the browser's "Failed to load resource" for
  `bob-beads.glb`), once a size, and checks that it is the only one and that the Void's own line is a warning.
- The luminance gate's floor takes the brightest pixel of the scene's middle, where the page is meant to have no text of
  its own; at a bead's stop the label's title stands there, and in `void-fail` the nav's text, so every still of the
  void's steps (`void-journey`, `void-hold`, `void-fail`) is measured with the page's text masked (`textMask`: the shown label, the
  nav where it shows, the header and the hero, each grown by 4 px; `lumaOf` takes the boxes): the floor's mean and peak are then
  the scene's, while the ceiling and the clipped share still count the whole picture as the visitor sees it. `LUMA_GATE`'s
  numbers are untouched. The floor has a negative control in the steps: the same bead stops and `void-fail` with the
  canvas hidden (`void-control-<id>-<size>.png`, `void-control-fail-<size>.png`; the canvas is put back), where the masked
  floor must FAIL, or it could not tell a scene from the page's text and its night.
- `end-page`'s stills are masked the same way (`textMask`), which at the end page covers the header alone: the end page
  is a page of text over a scene put to sleep under the night (about 14 % of it over the top third), so its floor is met
  by the page's own text in the middle, and the ceiling and the clipped share are what judge it, as a page still. It has
  no negative control: there the canvas is meant not to show.
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
- `load-throw` finds the call to make throw (`.initTexture(`, the scene's one
  upload, `uploadTextures` in `src/scene/bob/warm.ts`, which the Opening first
  calls for the band strips once the compass is built, in
  `src/scene/bob/Opening.tsx`; the void's textures go through it later)
  in the built Stage chunk (`assets/Stage-<hash>.js`); the step fails if that is not there
  exactly once.
