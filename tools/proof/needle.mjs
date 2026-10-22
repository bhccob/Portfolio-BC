#!/usr/bin/env node
/**
 * Proof harness for the Needle site (React Router + React Three Fiber).
 *
 * Drives a headless Edge through the built site, served the way GitHub Pages
 * serves it (npm run build, then npm run preview). It prints one
 * `PASS|FAIL <step> <detail>` line per step, writes results.json to PROOF_DIR,
 * and exits 1 if a step failed. Every step also fails on a console error, a
 * page error or a CSP violation.
 *
 * Nothing is ignored: the build writes the real policy into every page
 * (tools/build/postbuild.mjs), so a page that still holds the `__CSP__`
 * placeholder fails on Edge's parse error like any other console error. The
 * one console message a step may expect is named in the step itself and counted
 * (not-found: the browser's own "Failed to load resource" for each 404 document).
 *
 * A run that cannot begin (nothing built, the preview server not answering, Edge not starting) prints
 * `FAIL setup <reason>`, writes a results.json that holds that failure, and exits 1.
 *
 * THE DEBUG BRIDGE. The page's one proof hook is `window.__needleDebug()` (src/debug/needleDebug.ts), which the site
 * installs only when the first URL of the page has `?proof`. Every step that reads the site opens its page with
 * `?proof`. It answers the scene's phase, `progress`, `target`, `velocity`, the chapter (`index`, `id`, `local`,
 * `category`), the route and locale, the quality `tier`, the canvas's `dpr`, a rolling `fps`, the `camera`,
 * `canvasMounts`, `contextLost`, `threeD`, the opening's `loader` (`stage`, `elapsed`, and `strokes`: how much of each of
 * the five engraved marks is cut) and the compass's `needleAngle` (radians, 0 up the screen, clockwise positive);
 * `.set({ progress })` puts the story somewhere, `.dispatch(event)` sends a scene event, `.seekLoader(seconds)` holds
 * the opening's clock at a moment (-1 lets go), and `.scrollRequest` is the scroll loop's requestAnimationFrame, which
 * `watchFrames` wraps. Without `?proof` there is no bridge and nothing of the site reads or writes a hook (step bridge).
 *
 *   routes     every page of pagePaths() that the build produced, each answers 200 with one <h1>
 *              (in its HTML and after hydration) and the right <html lang>, and a page without a scene
 *              (its route's handle.scene is null: Lite, contact) has no <canvas>; a page the build did
 *              not produce is listed and skipped
 *   slash      GET /projects/funcial answers 301 to /projects/funcial/; a browser opening /projects/funcial loads
 *              /projects/funcial/ once, with no reload
 *   bridge     the debug bridge: absent without ?proof, and with no proof hook of the site read or written through
 *              a load, the opening's landing and a wheel gesture's frames (every hook name is trapped on the window);
 *              with ?proof the old hooks are gone, the state has exactly its fields and sensible values (landed: the
 *              five marks cut whole, a needle angle), `.set` puts the story in a chapter (and stops at the end),
 *              `.dispatch` sends an event, a wheel's frames go through `.scrollRequest`, and the language switch shows
 *              in the state
 *   persist    client navigation / → /projects/funcial/ → /en/projects/funcial/ (the language switch replaces the
 *              history entry), then history.back() to / and history.forward(): the Stage mounted once and
 *              the same <canvas> node throughout, with no document load after the first; the scene's phase
 *              is PROJECT_FOCUS funcial on the project page, the language switch keeps that very phase (no new
 *              transition), going back to / puts it on the scroll's phase and going forward restores it
 *   lang-keeps-phase  on /projects/funcial/ the phase is PROJECT_FOCUS funcial; after a client-side switch to
 *              /en/projects/funcial/ (and back) it is still PROJECT_FOCUS funcial, the very same state, with locale and
 *              route right, canvasMounts 1 and the same <canvas>; the same on /projects/cookies-clicker/
 *   not-found  an unknown URL (/does-not-exist/, /en/does-not-exist/) answers 404 with the build's
 *              404.html; after hydration it shows the not-found route's <h1> and the right <html lang>,
 *              and the browser loads one document, with no reload loop; the page has no scene, so it
 *              asks for none of the scene's files, mounts no Stage and still leaves LOADING
 *   home-nav   the home page's links to the three projects: visually hidden but
 *              reachable by keyboard while 3D is on (and shown while one has focus), visible once the
 *              3D switch is turned off, and the choice persists in localStorage across a reload, where
 *              the page with 3D off mounts no WebGL at all and still leaves LOADING; the 3D switch is named
 *              "3D" on and off (role=switch and aria-checked carry the state, WCAG 2.5.3)
 *   mobile     every page at 390 px wide has no horizontal scroll
 *   case-variant  a real page under another spelling (/Projects/Funcial/, /en/projects/FUNCIAL/) is a 404 on
 *              GitHub Pages and shows the not-found page, not an error screen (the server here is
 *              case-sensitive too, so the fallback is what answers), with no scene, like any not-found page
 *              (the client router matches it to the page's route, ignoring case; the handle does not)
 *   esc        the back link on a project page: Escape goes by client navigation, unless focus is
 *              in a text field or the key was already handled. On a page the visit began on (a direct load)
 *              it goes to the home page of that language; on a page reached from the home page it steps back
 *              through the history (the page forward is still there). A replace navigation keeps a page the
 *              visit began on its place: after the language switch, or the contact form's ?sent=1 replaced by
 *              /contact/, Escape still goes home (in the current language). Clicking the link does what Escape
 *              does, in both cases, but a ctrl-, meta- or shift-click is left to the browser (its default is
 *              not prevented). The scene's phase follows: the page's on the page, the scroll's (HOME_IDLE) on
 *              the home page. The "Esc" hint is aria-hidden and hidden on a touch screen
 *   nav-focus  a link (a push) opens the new page at its top with the focus moved to <main>: on /lite/ scrolled down to
 *              the projects, a click on one shows its <h1> at scrollY 0, and Tab goes on inside the new page; Back (a
 *              pop) returns near the place left; the language switch (a replace) keeps the place, the project on screen
 *              where it was; a push to a place in a page (/en/lite/#career, through React Router's own
 *              window.__reactRouterDataRouter) scrolls to it
 *   lite       /lite/ and /en/lite/: one <h1>, every section's heading (from the dictionary) in order and
 *              no skipped level, the real portrait loaded with its alt text and size, at least five
 *              <details> that open by keyboard with a visible focus ring, #career where the old /career/
 *              addresses land, the work section's own copy (intro, next slot linking to #career, the
 *              held-back note) around the projects in the old order, no terminal or engine-room copy,
 *              and the page complete with JavaScript off.
 *              /contact/ and /en/contact/: the one <h1> is the contact copy's title; an empty submit
 *              names the first bad field and moves focus to it; with no access key in the build, a filled
 *              form navigates to a mailto: link to Bob (the navigation is cancelled in the page, so no mail
 *              client opens) and shows the "almost there" panel; with a key (a CI build) the form carries
 *              it and, with Web3Forms answered by this harness (nothing is sent), posts once, shows
 *              success, holds the honeypot (success shown, nothing posted) and the pause, sends a form sent
 *              at once after the rest of three seconds (saying it is sending meanwhile; never dropped), shows
 *              the error of a failed post and moves focus to it, and, for a post nobody answers, sends one
 *              post for two submits and fails it after the 15 s timeout (Playwright's clock moved forward) so
 *              it can be retried
 *   scroll     the home page with 3D on does not scroll natively: <html data-route="home"> locks the root
 *              (overflow hidden, no overscroll, pinch-zoom only) and the wheel, the keys and a finger move
 *              `target` in viewport heights instead (window.__needleDebug). A direct load of / reaches HOME_IDLE
 *              once the scene is ready. 10
 *              wheel events of 120 px raise it by 1200 px, the damped
 *              `progress` catches up, the phase leaves HOME_IDLE for DISSECT and the scroll loop goes back to
 *              sleep (no frame asked for at rest, and only one at a time while it runs: through a wheel gesture
 *              and through a touch glide, which lasts over a second; the loop's own requests are counted through
 *              window.__needleDebug.scrollRequest, apart from the canvas's, which renders on demand through R3F's own
 *              requestAnimationFrame); Home, End, Page Down and the arrows move it; a text
 *              field keeps its keys, a pinch (ctrl+wheel) is the browser's, and with 3D off nothing is
 *              prevented and the page scrolls natively; `chapter.index` stays in step, so coming back
 *              from a project page puts the scene on the scroll's phase, not HOME_IDLE. With reduced motion a
 *              whole wheel gesture is one stop (1, 12, 14, ...) and so is a key press. On a touch screen
 *              (CDP touch events) a drag moves it, a flick glides on after the finger lifts, a tap and a
 *              sideways swipe do not move it, and the 3D switch still takes a tap
 *   keyboard   Tab from the top of the home page reaches the skip link, then the language switch and the 3D toggle in
 *              that order, each with a focus ring (outline 2 px or more) and on screen, and Shift+Tab goes back; the
 *              language switch shows "EN" and its name begins with it (WCAG 2.5.3, label in name); End
 *              jumps to the last chapter (the end of the story, the last project category) and Home returns to the
 *              start, both with the focus on the toggle
 *   reduced-motion  with prefers-reduced-motion: reduce (page.emulateMedia, before the load) one wheel event moves
 *              `target` to exactly the next stop, through every stop of the story to its end and back, and the
 *              story arrives at each, in the right chapter
 *   loaded     a direct load of / goes from LOADING to HOME_IDLE once the opening has landed, within the load
 *              timeout and with no navigation on the way; the canvas is shown then, and the wheel moves
 *              `frame.progress` straight away. The canvas renders on demand: after the home's idle motion it
 *              asks for no frame at all, and the pointer wakes it; over a project page a mouse wiggle wakes only the
 *              parallax. With 3D stored off, a direct load mounts no WebGL and leaves LOADING all the same
 *   no-scene   Lite is the light version: a direct load of a page without a scene (/lite/, /contact/, /en/lite/,
 *              /en/contact/) asks for none of the scene's files (the Stage chunk, three.js, maath, the textures),
 *              mounts no <canvas>, probes no WebGL, shows no fallback card and leaves LOADING with 3D still on; from
 *              the home page to Lite by client navigation the one canvas stays (canvasMounts 1, the same node) and
 *              sleeps: no requestAnimationFrame at all through 1.5 s of mouse moves, nor through scrolling (wheel and
 *              scrollTo) or the window's resize and the fonts' loadingdone events sent with no change of size; a real
 *              resize redraws it once at its new size and it sleeps again; back home the pointer wakes it
 *   no-webgl   Edge with WebGL switched off (--disable-webgl --disable-3d-apis): / and /en/ show the poster (the
 *              CSS panel of the night, no image, over the whole viewport) and
 *              the fallback card (THE NEEDLE LOST NORTH, in the page's language) with its link to Lite, no
 *              <canvas>, 3D off for the visit without touching the stored choice, the home page's links shown
 *              and the page scrolling natively, the phase out of LOADING; and with only a software rasteriser
 *              (SwiftShader) the same card. On the GPU the scene's own failures fall back to the same card: a
 *              context lost for good (after the restore timeout) and a scene never ready (its chunk never
 *              answers, after the load timeout); switching 3D back on tries again, and a context that comes
 *              back draws again with no card. Zero console errors throughout
 *   load-throw the real Stage chunk served with one call inside the opening's load (the band strips uploaded to the
 *              GPU, once the compass is built) made to throw: the fallback card well inside the load timeout, 3D off
 *              and not stored, HOME_IDLE, no data-ready and no canvas, and exactly one console error, the host's report
 *              of the failure
 *   background a direct load of / waiting in a background tab past the load timeout (visibility and frames
 *              emulated, as headless Edge never hides a page): no fallback; in front, the scene loads
 *   title-ij   every Dutch text set in Unbounded with an IJ is shaped with the font's Dutch locl off (no IJ digraph
 *              reading as a U); a crop of the NL card title into PROOF_DIR/m2/
 *   stills     every page of pagePaths() that the build produced, with 3D on, at 1440x900 and 390x844, once the
 *              opening has landed, and the fallback at both, into PROOF_DIR/m2/ (`nl-projects-funcial-1440x900.png`,
 *              `en-home-390x844.png`, `fallback-390x844.png`); on a project page the poster's scrim is
 *              over the scene once it shows, and before then only the poster's own (the Stage chunk is held while
 *              that is measured, so it cannot race); on Lite and contact no scene loads and the poster carries the
 *              page scrim
 *   loader-stills  at 1440x900 and 390x844, in a fresh context, once the real load has landed (HOME_IDLE): the
 *              opening's clock held (`seekLoader`) at six moments of the BOB loader, 1.75, 5.0 and 8.25 s (engrave:
 *              the first B, the second B, the circle), 9.75 s (open), 11.0 s (rise) and 12.5 s (home), each moment's
 *              `loader.stage` checked and a still taken (`m2/loader-<n>-<size>.png`); the phase stays HOME_IDLE
 *              throughout, and let go the opening is back at home
 *   loader-skip  a first visit's full show: a click 3 s in lands on HOME_IDLE within 1.6 s; reloaded with the seen
 *              flag cleared, 40 wheel events over 1 s from 3 s in land on the home too, and the story's progress
 *              (and target) stays 0, the page unscrolled: the input that skips never scrolls
 *   quick-loader  a first visit plays the full show and marks the loader seen (`bob-loader-seen` in localStorage);
 *              with the flag set, a load never engraves and reaches HOME_IDLE within QUICK.home + 0.5 s of the load
 *              (the first moment past `dark`)
 *   loader-reduced  with reduced motion the opening never engraves (dark, the fade, home), the camera is the home
 *              shot throughout (three samples identical: early, half way, landed), and nothing is marked seen
 *   give-up    the compass's file (/models/bob-compass.glb) never answers: the fallback card ("THE NEEDLE LOST
 *              NORTH", on /en/) shows between 25 and 27 s after the page started (the loader gives up 25 s in)
 *   home-look  the home once landed at both sizes (`m2/home-<size>.png`, and three more samples a quarter of the
 *              engraving's 4 s breath apart in `m2/samples/`), and the luminance of every home and loader still,
 *              measured in a page (the PNG as a data URL in an <img>, drawn on a canvas, read with getImageData):
 *              mean Rec. 709 luma of the sRGB values (0..1) at most 0.11 on the home (every sample, so the breath's
 *              peak) and 0.07 on the loader, at most 0.4 % of the pixels at luma 0.98 or more (the dark look's gate),
 *              and dark but drawn: mean above 0.002 and some pixel of the scene's middle (where no page text stands)
 *              at luma 0.3 or more (its floor, Ruling 13)
 *   aim        at 1440x900, once landed: the mouse to the right of the compass's pivot (the screen's middle, where the
 *              home shot looks) turns the needle to within 0.1 of pi/2 within 1.5 s (`needleAngle`; a still,
 *              `m2/aim-right-1440x900.png`, gated as a home still); on a touch phone (390x844), with no cursor, the
 *              needle drifts on its own: `needleAngle` changes over 3 s
 *   sleep      landed and left alone (no input at all, so the needle drifts), the canvas runs its idle motion and the
 *              drift on to its next rest and then draws nothing: no requestAnimationFrame for a whole second within
 *              DRIFT_RUN + SLEEP_WITHIN_MS of the landing, and not before DRIFT_RUN - 2 s (DRIFT_RUN is the drift's
 *              first rest after the idle while, nextDriftRest(IDLE_SECONDS))
 *   hero-failsafe  with JavaScript on but the entry chunk aborted (the page never hydrates), the hero (the hidden name
 *              and the scroll cue) and the header are hidden and then shown by the CSS fail-safe about 8 s in; with
 *              the page working, both stay hidden until the phase is HOME_IDLE and then show
 *   csp-enforced  the policy is in force, not only unbroken: on / and /lite/ after hydration, an injected inline
 *              <script> and an inline handler (<img onerror>) do not run, and the page reports a
 *              securitypolicyviolation for each (script-src-elem, script-src-attr); the browser's console refusal of
 *              each is expected and counted
 *   fps        on / (the GPU), 3 s after the scene is ready: 120 requestAnimationFrame frames while the scene
 *              draws, and their mean frame rate is reported, not gated, with the scene's own rolling fps, tier and
 *              pixel ratio from the bridge; it passes when the canvas holds the scene: read back through toDataURL
 *              right after a drawn frame, it has something bright, and the compass on its axis (the middle column)
 *
 * The harness reads src/data/pages.ts, src/app/handle.ts (which pages have a scene) and src/state/chapters.ts (through
 * tsx) and the build in dist/client to know which pages, scenes and stops to expect.
 *
 * Environment:
 *   BASE             site to test, default http://localhost:4399
 *   PROOF_DIR        where results.json and the stills (m2/) go, default ./proof-out
 *   STEPS            comma list of steps to run, default all; an unknown step, or none, exits 1
 *   PLAYWRIGHT_CORE  path to a playwright-core package outside the repo (else normal resolution)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsImport } from 'tsx/esm/api';

const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_CORE ? require(resolve(process.env.PLAYWRIGHT_CORE)) : require('playwright-core');

const BASE = (process.env.BASE ?? 'http://localhost:4399').replace(/\/$/, '');
const OUT = resolve(process.env.PROOF_DIR ?? './proof-out');
const GPU = ['--use-angle=d3d11', '--enable-gpu'];
/** Edge with no WebGL at all, as Lighthouse's headless run or a locked-down machine has it. */
const NO_WEBGL = ['--disable-webgl', '--disable-3d-apis'];
/** Edge drawing WebGL in software only (SwiftShader), as a machine without a usable GPU does. */
const SOFTWARE_GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

const langOf = (path) => (path === '/en/' || path.startsWith('/en/') ? 'en' : 'nl');

// The site's pages come from src/data/pages.ts. A page the build has not produced
// is skipped, and listed when the harness starts. The build is read from disk, so a
// page the build made but the server fails to answer still fails; BASE only changes
// who is asked, not what is expected.
const DIST = resolve(fileURLToPath(new URL('../../dist/client', import.meta.url)));
const { PAGES: SITE_PAGES, pagePaths } = await tsImport('../../src/data/pages.ts', import.meta.url);
const { Translator, locales } = await tsImport('../../src/i18n/Translator.ts', import.meta.url);
const { HANDLES, PAGE_KINDS } = await tsImport('../../src/app/handle.ts', import.meta.url);
const { MIN_FILL_MS, SEND_TIMEOUT_MS } = await tsImport('../../src/ui/contactSubmit.ts', import.meta.url);
const { LOAD_TIMEOUT_MS, RESTORE_TIMEOUT_MS } = await tsImport('../../src/scene/timeouts.ts', import.meta.url);
const { HOME_CHAPTERS, chapterAt, stops } = await tsImport('../../src/state/chapters.ts', import.meta.url);
const { LOADER, LOADER_SEEN_KEY, QUICK, SCRIPT } = await tsImport('../../src/engine/bob/loaderTimeline.ts', import.meta.url);
const { IDLE_SECONDS, BREATHE } = await tsImport('../../src/scene/bob/look.ts', import.meta.url);
const { nextDriftRest } = await tsImport('../../src/engine/bob/needleAim.ts', import.meta.url);
/**
 * How long the canvas may keep drawing after the last thing that stirred it, ms: the home's idle motion
 * (src/scene/bob/look.ts, IDLE_SECONDS: 12 s) and the needle's spring settling, with room to spare. Counted from the
 * stir, or from the landing for a home left alone (step sleep counts it from DRIFT_RUN instead).
 */
const SLEEP_WITHIN_MS = 20_000;
/**
 * How long a home left alone, with no pointer ever moved, keeps its idle motion going, s: the needle drifts on its own,
 * and once the idle while is over it runs on to the drift's next rest (src/engine/bob/needleAim.ts, nextDriftRest), so
 * it falls asleep at rest. 14 s with today's numbers.
 */
const DRIFT_RUN = nextDriftRest(IDLE_SECONDS);
/** The milestone's stills: PROOF_DIR/m2/. */
const STILLS = join(OUT, 'm2');
/** The two sizes of the stills: a laptop, and a phone (touch, coarse pointer, two device pixels). */
const STILL_SIZES = [
  { width: 1440, height: 900, options: {} },
  { width: 390, height: 844, options: { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
];
const sizeName = ({ width, height }) => `${width}x${height}`;
const built = (path) => existsSync(join(DIST, path, 'index.html'));
/**
 * The scene of every page path: its route's `handle.scene`, from the site's one table (src/app/handle.ts). Null for a
 * page of text alone (Lite, contact), which loads no WebGL; an unknown URL (the not-found page) has none either.
 */
const SCENE_OF = new Map(
  locales.flatMap((locale) => Object.keys(SITE_PAGES).map((page) => [Translator.pathFor(locale, SITE_PAGES[page]), HANDLES[PAGE_KINDS[page]].scene])),
);
const hasScene = (path) => (SCENE_OF.get(path) ?? null) !== null;
const SKIPPED = pagePaths().filter((path) => !built(path));
const PAGES = pagePaths()
  .filter(built)
  .map((path) => ({ path, lang: langOf(path), scene: hasScene(path) }));
/** The h1 of the home page (visually hidden: the engraving is the name), and of the project page used to move between pages and languages. */
const HOME_H1 = 'BOB CHUNG';
const FUNCIAL_H1 = 'Funcial';
/** The h1 of the not-found route (src/app/routes/not-found.tsx, in each language), as opposed to the root's HydrateFallback. */
const NOT_FOUND_H1 = { nl: 'Pagina niet gevonden', en: 'Page not found' };
/** Two URLs no page answers, one per language. */
const UNKNOWN = ['/does-not-exist/', '/en/does-not-exist/'];
/**
 * Real pages under another spelling. GitHub Pages is case-sensitive, so each is a 404 served the
 * fallback, but the router used to match them case-insensitively and a route module threw on them.
 */
const CASE_VARIANTS = ['/Projects/Funcial/', '/en/projects/FUNCIAL/', '/Projects/Jontai-Energy/', '/en/Projects/cookies-clicker/'];
/** The links the home page lists: the three projects (the way to About is the header's). */
const HOME_LINKS = ['/projects/funcial/', '/projects/jontai-energy/', '/projects/cookies-clicker/'];

// ---------------------------------------------------------------- the step runner

class Step {
  constructor(id) {
    this.id = id;
    this.checks = [];
    this.errors = [];
    this.expected = [];
    this.csp = [];
  }
  check(ok, message) {
    this.checks.push({ ok: !!ok, message });
    return !!ok;
  }
  get pass() {
    return this.checks.length > 0 && this.checks.every((c) => c.ok);
  }
}

/**
 * A fresh context and page that record console errors, page errors and CSP violations into the step.
 * `expected(message)` names a console error that is the designed outcome of the step, not a failure;
 * it is kept apart in step.expected, and the step must check that it happened as often as it should.
 */
async function openPage(browser, step, expected = () => false, viewport = { width: 1440, height: 900 }, contextOptions = {}) {
  const context = await browser.newContext({ viewport, ...contextOptions });
  await context.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__cspViolations.push({ directive: e.violatedDirective, blocked: e.blockedURI, sample: e.sample });
    });
  });
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    (expected(message) ? step.expected : step.errors).push(message.text());
  });
  page.on('pageerror', (error) => step.errors.push(error.message));
  return { context, page };
}

/** Moves the page's CSP violations into the step; call it before a document load replaces the window. */
async function takeCsp(page, step) {
  step.csp.push(...(await page.evaluate(() => window.__cspViolations.splice(0))));
}

/** Waits until the lazy Stage has mounted its <canvas>, then a moment for late errors. */
async function stageReady(page) {
  await page.waitForFunction(() => document.querySelector('.scene-host canvas'), null, { timeout: 15_000 });
  await page.waitForTimeout(500);
}

/**
 * Waits until the page at `path` has settled: on a page with a scene, until its Stage has mounted (stageReady); on a
 * page without one (Lite, contact, not found), which never mounts a Stage on a direct load, until it has hydrated
 * (`data-route` is set after hydration), then a moment for late errors.
 */
async function pageReady(page, path) {
  if (hasScene(path)) return stageReady(page);
  await page.waitForFunction(() => document.documentElement.hasAttribute('data-route'), null, { timeout: 15_000 });
  await page.waitForTimeout(500);
}

/** The files only the scene loads: the Stage chunk, three.js (its own chunk), maath (the scroll's easing) and the textures. */
const SCENE_FILE = /\/assets\/(?:Stage|three|maath[^/]*)-[^/]+\.js$|\/textures\//;

/** Records the URLs of the scene's files (SCENE_FILE) the page asks for, from now on; answers the list, which grows. */
const sceneRequests = (page) => {
  const asked = [];
  page.on('request', (request) => {
    if (SCENE_FILE.test(new URL(request.url()).pathname)) asked.push(new URL(request.url()).pathname);
  });
  return asked;
};

/**
 * The debug state of the page (window.__needleDebug(), present only when the page's first URL has `?proof`) as plain
 * data, or null where there is no bridge. The bridge's state is the site's one proof hook: see src/debug/needleDebug.ts.
 */
const debugOf = (page) => page.evaluate(() => (typeof window.__needleDebug === 'function' ? JSON.parse(JSON.stringify(window.__needleDebug())) : null));

/** The Stage chunk the site loads after hydration (a route on it holds, patches or refuses the scene). */
const STAGE_CHUNK = /\/assets\/Stage-[^/]+\.js$/;

const count = (text, pattern) => (text.match(pattern) ?? []).length;

// ---------------------------------------------------------------- the steps

async function routes(browser, step) {
  const { context, page } = await openPage(browser, step);
  for (const { path, lang, scene } of PAGES) {
    const response = await page.goto(BASE + path, { waitUntil: 'load' });
    step.check(response?.status() === 200, `${path} answers 200 (got ${response?.status()})`);
    const html = (await response?.text()) ?? '';
    const prerendered = count(html, /<h1[\s>]/g);
    step.check(prerendered === 1, `${path} has one <h1> in its HTML (got ${prerendered})`);
    await pageReady(page, path);
    const hydrated = await page.locator('h1').count();
    step.check(hydrated === 1, `${path} has one <h1> after hydration (got ${hydrated})`);
    const htmlLang = await page.getAttribute('html', 'lang');
    step.check(htmlLang === lang, `${path} has <html lang="${lang}"> (got ${htmlLang})`);
    if (!scene) {
      const canvases = await page.locator('canvas').count();
      step.check(canvases === 0, `${path} shows no scene: no <canvas> (got ${canvases})`);
    }
    await takeCsp(page, step);
  }
  await context.close();
  return `${PAGES.length} pages: 200, one <h1>, <html lang>; no canvas on ${PAGES.filter((p) => !p.scene).length} pages of text alone`;
}

async function slash(browser, step) {
  const bare = await fetch(`${BASE}/projects/funcial`, { redirect: 'manual' });
  const location = bare.headers.get('location');
  const target = location ? new URL(location, BASE).href : null;
  step.check(bare.status === 301 && target === `${BASE}/projects/funcial/`, `GET /projects/funcial answers 301 to /projects/funcial/ (got ${bare.status} ${location})`);

  const { context, page } = await openPage(browser, step);
  const documents = [];
  let loads = 0;
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url());
  });
  page.on('load', () => loads++);

  // `?proof` rides along: the server keeps the query through its 301, and the page can then answer for its Stage's mounts.
  await page.goto(`${BASE}/projects/funcial?proof`, { waitUntil: 'load' });
  await stageReady(page);
  await page.waitForTimeout(1_500); // a reload loop would show by now
  const landed = documents.filter((url) => url === `${BASE}/projects/funcial/?proof`).length;
  const { type, mounts } = await page.evaluate(() => ({
    type: performance.getEntriesByType('navigation')[0]?.type,
    mounts: window.__needleDebug?.().canvasMounts,
  }));
  step.check(page.url() === `${BASE}/projects/funcial/?proof`, `the browser ends at /projects/funcial/ (got ${page.url()})`);
  step.check(landed === 1 && documents.length === 2, `one document load of /projects/funcial/, after the 301 (got ${documents.join(' → ')})`);
  step.check(loads === 1 && type === 'navigate', `one load event, not a reload (got ${loads}, ${type})`);
  step.check(mounts === 1, `the Stage mounted once (got ${mounts})`);
  await takeCsp(page, step);
  await context.close();
  return `/projects/funcial → 301 /projects/funcial/, loaded once (${documents.join(' → ')})`;
}

/** The scene's phase as `{ kind, dir }`, once it is `kind` (window.__needleDebug().phase: `?proof` in the page's first URL). */
const waitForPhase = async (page, kind) => {
  await page.waitForFunction((kind) => window.__needleDebug?.().phase.kind === kind, kind, { timeout: 5_000 });
  return page.evaluate(() => {
    const { kind, id, category } = window.__needleDebug().phase;
    return { kind, id, category };
  });
};

/** The scene's phase once it is PROJECT_FOCUS on project `id` (a project page), as `{ kind, id }`. */
const waitForProject = async (page, id) => {
  await page
    .waitForFunction((id) => window.__needleDebug?.().phase.kind === 'PROJECT_FOCUS' && window.__needleDebug().phase.id === id, id, { timeout: 5_000 })
    .catch(() => {});
  return page.evaluate(() => {
    const { kind, id } = window.__needleDebug().phase;
    return { kind, id };
  });
};

async function persist(browser, step) {
  const { context, page } = await openPage(browser, step);
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await stageReady(page);
  await page.evaluate(() => {
    document.querySelector('.scene-host canvas').dataset.id = 'needle-canvas';
  });

  const documents = [];
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url());
  });
  const visited = [];
  const expectSame = async (where, lang, h1) => {
    await page.waitForFunction(
      ([lang, h1]) => document.documentElement.lang === lang && document.querySelector('h1')?.textContent === h1,
      [lang, h1],
      { timeout: 5_000 },
    );
    const state = await page.evaluate(() => ({
      path: location.pathname,
      mounts: window.__needleDebug().canvasMounts,
      canvases: document.querySelectorAll('canvas').length,
      tag: document.querySelector('.scene-host canvas')?.dataset.id ?? null,
    }));
    visited.push(state.path);
    step.check(
      state.mounts === 1 && state.canvases === 1 && state.tag === 'needle-canvas',
      `${where}: the Stage mounted once and the same <canvas> (got mounts ${state.mounts}, ${state.canvases} canvas, tag ${state.tag})`,
    );
  };

  await expectSame('/', 'nl', HOME_H1);
  // The home page lists its pages in a nav that is visually hidden while 3D is on, so the way
  // to the project page is the keyboard's: focus its link and press Enter.
  await page.focus('.home-nav a[href="/projects/funcial/"]');
  await page.keyboard.press('Enter');
  await page.waitForURL(`${BASE}/projects/funcial/`);
  await expectSame('link to /projects/funcial/', 'nl', FUNCIAL_H1);
  const phase = await waitForProject(page, 'funcial');
  step.check(phase.id === 'funcial', `on /projects/funcial/ the scene's phase is PROJECT_FOCUS funcial (got ${JSON.stringify(phase)})`);
  await page.evaluate(() => {
    window.__keptPhase = window.__needleDebug().phase;
  });
  // The scene keeps its phase, the very same state, while the language or the history changes under it.
  const keptPhase = async (where) => {
    await page.waitForTimeout(250); // a sync that wrongly moved the phase would have by now
    step.check(await page.evaluate(() => window.__needleDebug().phase === window.__keptPhase), `${where}: the scene keeps its phase, with no new transition`);
  };
  await page.click('.header-nav a[href="/en/projects/funcial/"]'); // the header's language switch
  await page.waitForURL(`${BASE}/en/projects/funcial/`);
  await expectSame('link to /en/projects/funcial/', 'en', FUNCIAL_H1);
  await keptPhase('switching to English');
  // The switch replaces the history entry (it is not a step in the story), so Back from the English
  // page is the home page, not the Dutch page; Forward is the English page again.
  await page.evaluate(() => history.back());
  await page.waitForURL((url) => url.pathname === '/'); // the first URL was /?proof
  await expectSame('history.back() past the replaced entry to /', 'nl', HOME_H1);
  const afterBack = await waitForPhase(page, 'HOME_IDLE');
  step.check(afterBack.kind === 'HOME_IDLE', `going back to / puts the scene on the scroll's phase (got ${JSON.stringify(afterBack)})`);
  await page.evaluate(() => history.forward());
  await page.waitForURL(`${BASE}/en/projects/funcial/`);
  await expectSame('history.forward() to /en/projects/funcial/', 'en', FUNCIAL_H1);
  const afterForward = await waitForProject(page, 'funcial');
  step.check(afterForward.id === 'funcial', `going forward puts the scene back on PROJECT_FOCUS funcial (got ${JSON.stringify(afterForward)})`);

  step.check(documents.length === 0, `client navigation only, no document load (got ${documents.join(', ') || 'none'})`);
  await takeCsp(page, step);
  await context.close();
  return `${visited.join(' → ')}: one mount, one <canvas>`;
}

/** Each URL answers 404 with the fallback, and the not-found page shows once the router has taken over. */
async function expectNotFound(browser, step, urls) {
  // The one console error this check expects: Edge reports a document that answers 404 as
  // "Failed to load resource", for the page being loaded and for nothing else.
  let asking = null;
  const documentNotFound = (message) => /status of 404/.test(message.text()) && message.location().url === BASE + asking + '?proof';
  const { context, page } = await openPage(browser, step, documentNotFound);
  let documents = [];
  let loads = 0;
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url());
  });
  page.on('load', () => loads++);
  const scenery = sceneRequests(page);

  for (const path of urls) {
    documents = [];
    loads = 0;
    scenery.length = 0;
    const lang = langOf(path);
    asking = path;
    const response = await page.goto(`${BASE}${path}?proof`, { waitUntil: 'load' });
    step.check(response?.status() === 404, `${path} answers 404 (got ${response?.status()})`);
    const html = (await response?.text()) ?? '';
    step.check(html.includes('name="robots" content="noindex"'), `${path} is served noindex`);
    step.check(count(html, /<title>[^<]+<\/title>/g) === 1, `${path} has one <title> in its HTML`);
    step.check(!html.includes('__CSP__'), `${path} carries its real policy`);

    await pageReady(page, path);
    await page.waitForTimeout(1_500); // a reload loop would show by now
    const state = await page.evaluate(() => ({
      titles: document.querySelectorAll('title').length,
      h1: [...document.querySelectorAll('h1')].map((h1) => h1.textContent),
      lang: document.documentElement.lang,
      type: performance.getEntriesByType('navigation')[0]?.type,
      mounts: window.__needleDebug?.().canvasMounts,
      canvases: document.querySelectorAll('canvas').length,
      phase: window.__needleDebug?.().phase.kind,
      url: location.pathname,
    }));
    step.check(state.h1.length === 1 && state.h1[0] === NOT_FOUND_H1[lang], `${path} shows the not-found route's <h1> "${NOT_FOUND_H1[lang]}" after hydration (got ${JSON.stringify(state.h1)})`);
    step.check(state.titles <= 1, `${path} has at most one <title> after hydration (got ${state.titles})`);
    step.check(state.lang === lang, `${path} has <html lang="${lang}"> after hydration (got ${state.lang})`);
    step.check(state.url === path, `the browser stays at ${path} (got ${state.url})`);
    step.check(documents.length === 1 && loads === 1 && state.type === 'navigate', `${path} loads one document, no reload (got ${documents.length} requests, ${loads} loads, ${state.type})`);
    // The not-found page has no scene: a visit that begins there loads no WebGL, and still leaves LOADING.
    step.check(state.mounts === 0 && state.canvases === 0, `${path}: no Stage and no <canvas> (got ${state.mounts} mounts, ${state.canvases} canvas)`);
    step.check(scenery.length === 0, `${path}: none of the scene's files asked for (got ${scenery.join(' ') || 'none'})`);
    step.check(state.phase === 'HOME_IDLE', `${path}: the phase leaves LOADING all the same (got ${state.phase})`);
    await takeCsp(page, step);
  }
  step.check(step.expected.length === urls.length, `the browser reported the 404 of each URL once, and only those (got ${step.expected.length} for ${urls.length} URLs)`);
  await context.close();
  return `${urls.join(', ')}: 404, the not-found <h1>, one document load`;
}

const notFound = (browser, step) => expectNotFound(browser, step, UNKNOWN);
const caseVariant = (browser, step) => expectNotFound(browser, step, CASE_VARIANTS);

async function esc(browser, step) {
  const { context, page } = await openPage(browser, step);
  const documents = [];
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url());
  });
  const pathname = () => new URL(page.url()).pathname;
  const pressEscape = async () => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400); // a navigation would have happened by now
  };

  // On a project page the back link says what Escape does, and Escape does it through the router.
  await page.goto(`${BASE}/projects/funcial/?proof`, { waitUntil: 'load' });
  await stageReady(page);
  documents.length = 0;
  const onProject = await waitForProject(page, 'funcial');
  step.check(onProject.id === 'funcial', `a direct load of /projects/funcial/ puts the scene on PROJECT_FOCUS funcial (got ${JSON.stringify(onProject)})`);
  step.check((await page.getByRole('link', { name: 'terug', exact: true }).count()) === 1, 'the back link is named "terug": the "Esc" hint is not part of its name');
  step.check((await page.getAttribute('a.back', 'aria-keyshortcuts')) === 'Escape', 'the back link names its shortcut, aria-keyshortcuts="Escape"');
  step.check((await page.getAttribute('a.back .back-hint', 'aria-hidden')) === 'true', 'the visible "Esc" hint is aria-hidden');

  // Not while someone is typing...
  await page.evaluate(() => {
    const input = document.createElement('input');
    input.id = 'esc-probe';
    document.body.append(input);
    input.focus();
  });
  await pressEscape();
  step.check(pathname() === '/projects/funcial/', `Escape in a text field stays on the page (got ${pathname()})`);
  await page.evaluate(() => document.getElementById('esc-probe')?.remove());

  // ... nor when something else has already handled the key.
  await page.evaluate(() => {
    window.__eatEscape = (event) => event.preventDefault();
    window.addEventListener('keydown', window.__eatEscape, true);
  });
  await pressEscape();
  step.check(pathname() === '/projects/funcial/', `Escape that was already handled stays on the page (got ${pathname()})`);
  await page.evaluate(() => window.removeEventListener('keydown', window.__eatEscape, true));

  // A direct load has no page before it in the visit, so Escape goes to the home page.
  await page.keyboard.press('Escape');
  await page.waitForURL(`${BASE}/`, { timeout: 5_000 });
  step.check((await page.textContent('h1')) === HOME_H1, 'a direct load of /projects/funcial/ + Escape lands on the home page');
  step.check(documents.length === 0, `by client navigation, no document load (got ${documents.join(', ') || 'none'})`);
  const afterDirect = await waitForPhase(page, 'HOME_IDLE');
  step.check(afterDirect.kind === 'HOME_IDLE', `leaving the page for the home page puts the scene back on the scroll's phase (got ${JSON.stringify(afterDirect)})`);
  await takeCsp(page, step);

  // A page reached from the home page has one before it: Escape steps back, it does not push the home page.
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await stageReady(page);
  documents.length = 0;
  await page.focus('.home-nav a[href="/projects/funcial/"]'); // the home page's links are hidden while 3D is on, but take focus
  await page.keyboard.press('Enter');
  await page.waitForURL(`${BASE}/projects/funcial/`, { timeout: 5_000 });
  await waitForProject(page, 'funcial');
  await pressEscape();
  step.check(pathname() === '/', `a project page reached from the home page + Escape steps back to the home page (got ${pathname()})`);
  step.check(documents.length === 0, `by client navigation, no document load (got ${documents.join(', ') || 'none'})`);
  await waitForPhase(page, 'HOME_IDLE');
  await page.evaluate(() => history.forward());
  const forwarded = await page.waitForURL(`${BASE}/projects/funcial/`, { timeout: 5_000 }).then(() => true, () => false);
  step.check(forwarded, 'the page forward is still in the history, so Escape went back and did not add the home page');
  if (forwarded) {
    const forward = await waitForProject(page, 'funcial');
    step.check(forward.id === 'funcial', `going forward again puts the scene back on PROJECT_FOCUS funcial (got ${JSON.stringify(forward)})`);
  }
  await takeCsp(page, step);

  // A replace navigation keeps a page the visit began on "the first page of the visit". The language switch
  // is one (it is not a step in the story), so Escape after it goes home in the current language and does
  // not undo the switch.
  await page.goto(`${BASE}/projects/funcial/?proof`, { waitUntil: 'load' });
  await stageReady(page);
  documents.length = 0;
  await waitForProject(page, 'funcial');
  await page.click('a[href="/en/projects/funcial/"]');
  await page.waitForFunction(() => location.pathname === '/en/projects/funcial/' && document.documentElement.lang === 'en', null, { timeout: 5_000 });
  await pressEscape();
  step.check(pathname() === '/en/', `a direct load + the language switch + Escape lands on /en/, not back on the Dutch page (got ${pathname()})`);
  step.check(documents.length === 0, `by client navigation, no document load (got ${documents.join(', ') || 'none'})`);
  await takeCsp(page, step);

  // The contact form is the other one: a visitor who posted without script comes back to /contact/?sent=1,
  // and the page replaces that with /contact/.
  await page.goto(`${BASE}/contact/?sent=1&proof`, { waitUntil: 'load' });
  await pageReady(page, '/contact/');
  await page.waitForFunction(() => location.pathname === '/contact/' && location.search === '', null, { timeout: 5_000 });
  documents.length = 0;
  await pressEscape();
  step.check(pathname() === '/', `a direct load of /contact/?sent=1, replaced by /contact/, + Escape lands on the home page (got ${pathname()})`);
  step.check(documents.length === 0, `by client navigation, no document load (got ${documents.join(', ') || 'none'})`);
  await takeCsp(page, step);

  // The link is Escape for the mouse: it goes where Escape goes. A click that opens it elsewhere (ctrl, meta,
  // shift) is the browser's: the page must not prevent its default. A listener on window sees every click after
  // the page's own handlers; it records whether the click was already handled and then cancels it, so no tab opens.
  const watchClicks = () =>
    page.evaluate(() => {
      window.__clicks = [];
      window.addEventListener('click', (event) => {
        window.__clicks.push(event.defaultPrevented);
        event.preventDefault();
      });
    });
  await page.goto(`${BASE}/projects/funcial/?proof`, { waitUntil: 'load' });
  await stageReady(page);
  await watchClicks();
  for (const modifier of ['Control', 'Meta', 'Shift']) await page.click('a.back', { modifiers: [modifier] });
  step.check(
    JSON.stringify(await page.evaluate(() => window.__clicks)) === JSON.stringify([false, false, false]),
    'a ctrl-, meta- or shift-click on the back link is not prevented: the page does not intercept it',
  );
  step.check(pathname() === '/projects/funcial/', `and the click does not navigate in the page (got ${pathname()})`);
  documents.length = 0;
  await page.evaluate(() => (window.__clicks.length = 0));
  await page.click('a.back');
  await page.waitForURL(`${BASE}/`, { timeout: 5_000 });
  step.check((await page.evaluate(() => window.__clicks)).join() === 'true', 'a plain click on the back link is handled by the page (default prevented)');
  step.check((await page.textContent('h1')) === HOME_H1, 'a direct load of /projects/funcial/ + a click on the back link lands on the home page');
  step.check(documents.length === 0, `by client navigation, no document load (got ${documents.join(', ') || 'none'})`);
  await takeCsp(page, step);

  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await stageReady(page);
  documents.length = 0;
  await page.focus('.home-nav a[href="/projects/funcial/"]');
  await page.keyboard.press('Enter');
  await page.waitForURL(`${BASE}/projects/funcial/`, { timeout: 5_000 });
  await page.click('a.back');
  await page.waitForURL((url) => url.pathname === '/', { timeout: 5_000 }); // back to /?proof
  step.check(documents.length === 0, `by client navigation, no document load (got ${documents.join(', ') || 'none'})`);
  await page.evaluate(() => history.forward());
  step.check(
    await page.waitForURL(`${BASE}/projects/funcial/`, { timeout: 5_000 }).then(() => true, () => false),
    'a click on the back link of a page reached from the home page steps back, like Escape (the page forward is still there)',
  );
  await takeCsp(page, step);

  // The English pages go to the English home page.
  await page.goto(`${BASE}/en/projects/funcial/`, { waitUntil: 'load' });
  await stageReady(page);
  step.check((await page.getByRole('link', { name: 'back', exact: true }).count()) === 1, 'the English back link is named "back"');
  await page.keyboard.press('Escape');
  await page.waitForURL(`${BASE}/en/`, { timeout: 5_000 });
  step.check((await page.textContent('h1')) === HOME_H1 && (await page.getAttribute('html', 'lang')) === 'en', 'Escape on /en/projects/funcial/ lands on /en/');
  await takeCsp(page, step);
  await context.close();

  // A touch screen has no Escape key: the hint is hidden there, the link stays.
  const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const phone = await touch.newPage();
  phone.on('console', (message) => message.type() === 'error' && step.errors.push(message.text()));
  phone.on('pageerror', (error) => step.errors.push(error.message));
  await phone.goto(`${BASE}/projects/funcial/`, { waitUntil: 'load' });
  await stageReady(phone);
  const hint = await phone.evaluate(() => getComputedStyle(document.querySelector('.back-hint')).display);
  step.check(hint === 'none', `on a coarse pointer the Esc hint is hidden (display ${hint})`);
  step.check((await phone.locator('a.back').isVisible()) === true, 'the back link itself stays visible on a phone');
  await touch.close();
  return 'Escape and a click go home (/ and /en/) or back by client navigation, also after a replace; not in a field, not once handled; a modified click is left alone; the hint is hidden on touch';
}

/** Where the page is: its scroll, whether its <h1> is in view, and where the focus is (in <main>, or on <main> itself). */
const placeOf = (page) =>
  page.evaluate(() => {
    const main = document.querySelector('main');
    const h1 = document.querySelector('h1');
    const box = h1?.getBoundingClientRect();
    return {
      path: location.pathname,
      y: Math.round(window.scrollY),
      h1InView: !!box && box.top >= 0 && box.bottom <= window.innerHeight,
      inMain: !!main && main.contains(document.activeElement),
      focus: document.activeElement === main ? 'main' : (document.activeElement?.tagName ?? null),
    };
  });

/**
 * A client navigation and the visitor's place. A link (a push) opens the new page at its top with the focus moved into
 * <main>: on /lite/ scrolled down to the projects, a click on one shows the project's <h1>, at scrollY 0, and Tab goes on
 * inside the new page. Back (a pop) is the browser's and returns near the place left; the language switch (a replace)
 * keeps the place; a push to a place in a page (/en/lite/#career, through the router) scrolls to it.
 */
async function navFocus(browser, step) {
  const { context, page } = await openPage(browser, step);
  const documents = [];
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url());
  });
  const project = '#work a[href="/projects/jontai-energy/"]';
  await page.goto(`${BASE}/lite/?proof`, { waitUntil: 'load' });
  await pageReady(page, '/lite/');
  await page.evaluate((selector) => document.querySelector(selector).scrollIntoView({ block: 'center' }), project);
  await page.waitForTimeout(200);
  const left = await placeOf(page);
  step.check(left.y > 300, `on /lite/ the visitor has scrolled down to the projects (scrollY ${left.y})`);

  // A link: the project page from its top, the focus in it.
  documents.length = 0;
  await page.click(project);
  await page.waitForFunction(() => location.pathname === '/projects/jontai-energy/' && document.documentElement.dataset.route === 'project', null, { timeout: 5_000 });
  await page.waitForTimeout(150);
  const opened = await placeOf(page);
  step.check(opened.y === 0 && opened.h1InView, `a click on a project opens its page at the top, its <h1> in view (got scrollY ${opened.y}, h1 in view ${opened.h1InView})`);
  step.check(opened.inMain && opened.focus === 'main', `and the focus is moved to <main>, not left on <body> (got ${opened.focus})`);
  await page.keyboard.press('Tab');
  const tabbed = await placeOf(page);
  step.check(tabbed.inMain, `Tab from there goes on inside the new page (got ${tabbed.focus}, in <main> ${tabbed.inMain})`);
  step.check(documents.length === 0, `by client navigation, no document load (got ${documents.join(', ') || 'none'})`);

  // Back: the browser puts the visitor where they were.
  await page.evaluate(() => history.back());
  await page.waitForFunction(() => location.pathname === '/lite/' && document.documentElement.dataset.route === 'lite', null, { timeout: 5_000 });
  await page.waitForTimeout(500);
  const back = await placeOf(page);
  step.check(Math.abs(back.y - left.y) <= 50, `Back returns near the place left (scrollY ${back.y}, left at ${left.y})`);

  // The language switch replaces the page with itself in the other language: the place stays, the project the visitor
  // was at still in view where it was (the English copy above it is a little shorter, and the browser's scroll anchoring
  // keeps what is on screen in place). Clicked in the page, as Playwright's own click would first scroll the header
  // (which scrolls with the page) back into view.
  const topOf = (href) => page.evaluate((href) => Math.round(document.querySelector(`#work a[href="${href}"]`).getBoundingClientRect().top), href);
  const wasAt = await topOf('/projects/jontai-energy/');
  await page.evaluate(() => document.querySelector('.header-nav a[hreflang="en"]').click());
  await page.waitForFunction(() => location.pathname === '/en/lite/' && document.documentElement.lang === 'en', null, { timeout: 5_000 });
  await page.waitForTimeout(200);
  const switched = await placeOf(page);
  const nowAt = await topOf('/en/projects/jontai-energy/');
  step.check(
    switched.y > 300 && Math.abs(nowAt - wasAt) <= 40,
    `the language switch keeps the place: not reset to the top (scrollY ${switched.y}, was ${back.y}), the project still where it was on screen (top ${nowAt} px, was ${wasAt} px)`,
  );

  // A push to a place in a page goes to that place, not to the top.
  await page.click('#work a[href="/en/projects/funcial/"]');
  await page.waitForFunction(() => location.pathname === '/en/projects/funcial/', null, { timeout: 5_000 });
  const routed = await page.evaluate(() => typeof window.__reactRouterDataRouter?.navigate === 'function');
  step.check(routed, "the router is there to push a place in a page (React Router's window.__reactRouterDataRouter)");
  if (routed) {
    await page.evaluate(() => window.__reactRouterDataRouter.navigate('/en/lite/#career'));
    await page.waitForFunction(() => location.pathname === '/en/lite/' && location.hash === '#career', null, { timeout: 5_000 });
    await page.waitForTimeout(200);
    const career = await page.evaluate(() => ({ top: Math.round(document.querySelector('#career').getBoundingClientRect().top), y: Math.round(window.scrollY) }));
    step.check(career.y > 0 && career.top > -5 && career.top < 450, `a push to /en/lite/#career scrolls #career into view (top ${career.top} px, scrollY ${career.y})`);
  }
  step.check(documents.length === 0, `all of it by client navigation, no document load (got ${documents.join(', ') || 'none'})`);
  await takeCsp(page, step);
  await context.close();
  return `a link opens the page at its top with the focus in <main> (from scrollY ${left.y}); Back returns to ${back.y}; the language switch keeps it; a push to #career scrolls there`;
}

/** The size of the first element matching `selector`, in CSS pixels; null if there is none. */
const boxOf = (page, selector) =>
  page.evaluate((selector) => {
    const element = document.querySelector(selector);
    if (!element) return null;
    const { width, height } = element.getBoundingClientRect();
    return { width, height };
  }, selector);
const visuallyHidden = (box) => box !== null && box.width <= 1 && box.height <= 1;

async function homeNav(browser, step) {
  const { context, page } = await openPage(browser, step);
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await stageReady(page);

  // 3D on (the default): the three links are in the HTML and reachable by keyboard, but not shown.
  const hrefs = await page.$$eval('.home-nav a', (links) => links.map((link) => link.getAttribute('href')));
  step.check(JSON.stringify(hrefs) === JSON.stringify(HOME_LINKS), `the home nav links the three projects (got ${hrefs.join(' ')})`);
  step.check((await page.getAttribute('html', 'data-3d')) === 'on', 'the page says data-3d="on" after hydration');
  step.check(visuallyHidden(await boxOf(page, '.home-nav')), 'with 3D on, the home nav is visually hidden');
  await page.focus('.home-nav a');
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('href'));
  step.check(focused === HOME_LINKS[0], `a hidden link can take focus (got ${focused})`);
  const shown = await boxOf(page, '.home-nav');
  step.check(shown !== null && shown.height > 100, `the nav is shown while a link has focus (got ${JSON.stringify(shown)})`);
  await page.evaluate(() => document.activeElement?.blur());

  // The switch is named "3D" whatever its state (WCAG 2.5.3): role=switch and aria-checked say whether it is on.
  const named = async (state) => {
    const control = page.getByRole('switch', { name: '3D', exact: true });
    return (await control.count()) === 1 && (await control.getAttribute('aria-checked')) === state;
  };
  step.check(await named('true'), 'the 3D switch is named "3D", aria-checked="true" (its visible words are not its name)');

  // 3D off: the nav is shown, and the choice survives a reload.
  await page.click('button[role="switch"]');
  step.check((await page.getAttribute('html', 'data-3d')) === 'off', 'the switch sets data-3d="off"');
  step.check(await named('false'), 'switched off it is still named "3D", now aria-checked="false"');
  step.check((await page.evaluate(() => localStorage.getItem('needle-3d'))) === 'off', 'the switch stores needle-3d = off');
  const open = await boxOf(page, '.home-nav');
  step.check(open !== null && open.height > 100, `with 3D off, the home nav is shown (got ${JSON.stringify(open)})`);
  await takeCsp(page, step);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.getAttribute('data-3d') === 'off', null, { timeout: 5_000 });
  step.check((await page.textContent('button[role="switch"]')) === '3D uit', 'after a reload, the switch still says "3D uit"');
  // A visitor who switched 3D off never mounts WebGL, not even during hydration, and the page still leaves LOADING.
  await page.waitForTimeout(1_000); // a Stage mounted by mistake would have its canvas by now
  const off = await page.evaluate(() => ({ mounts: window.__needleDebug?.().canvasMounts ?? 0, canvases: document.querySelectorAll('canvas').length }));
  step.check(off.mounts === 0 && off.canvases === 0, `with 3D stored off, no Stage and no <canvas> (got ${off.mounts} mounts, ${off.canvases} canvas)`);
  const offPhase = await waitForPhase(page, 'HOME_IDLE').then((phase) => phase.kind, () => null);
  step.check(offPhase === 'HOME_IDLE', `with 3D stored off, the phase still leaves LOADING for HOME_IDLE (got ${JSON.stringify(await page.evaluate(() => window.__needleDebug?.().phase))})`);

  // And back on: the Stage mounts now.
  await page.click('button[role="switch"]');
  step.check((await page.evaluate(() => localStorage.getItem('needle-3d'))) === 'on', 'switching back stores needle-3d = on');
  step.check(visuallyHidden(await boxOf(page, '.home-nav')), 'with 3D on again, the home nav is hidden again');
  await stageReady(page);
  step.check((await page.evaluate(() => window.__needleDebug?.().canvasMounts)) === 1, 'switched on, the Stage mounts');
  await takeCsp(page, step);
  await context.close();
  return 'three links; hidden but focusable with 3D on, shown with 3D off, the choice stored';
}

async function mobile(browser, step) {
  const { context, page } = await openPage(browser, step, () => false, { width: 390, height: 844 });
  for (const { path } of PAGES) {
    await page.goto(BASE + path, { waitUntil: 'load' });
    await pageReady(page, path);
    // The page clips sideways overflow (body { overflow-x: clip }), so scrollWidth alone proves nothing:
    // look for content that reaches past the right edge as well.
    const { scroll, client, wide } = await page.evaluate(() => {
      const client = document.documentElement.clientWidth;
      const wide = [...document.querySelectorAll('header *, main *')]
        .filter((element) => {
          const { width, right } = element.getBoundingClientRect();
          return width > 1 && right > client + 0.5;
        })
        .map((element) => `${element.tagName.toLowerCase()}.${element.className}`);
      return { scroll: document.documentElement.scrollWidth, client, wide };
    });
    step.check(scroll <= client && wide.length === 0, `${path} has no horizontal overflow at 390 px (scrollWidth ${scroll}, clientWidth ${client}, past the edge: ${wide.join(' ') || 'none'})`);
    await takeCsp(page, step);
  }
  await context.close();
  return `${PAGES.length} pages at 390 px: no horizontal scroll`;
}

/** The copy of a heading as text: the dictionaries' only markup is <em>. */
const plain = (copy) => copy.replace(/<[^>]*>/g, '');
const LITE = { nl: '/lite/', en: '/en/lite/' };
const CONTACT = { nl: '/contact/', en: '/en/contact/' };

/** Lite: all the copy, in order, as plain HTML that needs no script and no 3D. */
async function liteOne(browser, step, lang) {
  const { t } = new Translator(lang);
  const path = LITE[lang];
  const { context, page } = await openPage(browser, step);
  await page.goto(BASE + path, { waitUntil: 'load' });
  await pageReady(page, path);

  // The sections, by their headings (the dictionary's own words), in the order of the page.
  const headings = [t.work.title, t.about.title, t.skills.title, t.career.title, t.life.title, t.compass.qa.title, t.cta.title].map(plain);
  const h1 = await page.$$eval('h1', (els) => els.map((el) => el.textContent));
  step.check(h1.length === 1 && h1[0] === t.needle.liteLink, `${path} has one <h1> "${t.needle.liteLink}" (got ${JSON.stringify(h1)})`);
  const h2 = await page.$$eval('main h2', (els) => els.map((el) => el.textContent));
  step.check(JSON.stringify(h2) === JSON.stringify(headings), `${path} has the section headings in order (got ${JSON.stringify(h2)})`);
  const levels = await page.$$eval('main h1, main h2, main h3, main h4, main h5, main h6', (els) => els.map((el) => Number(el.tagName[1])));
  const skipped = levels.filter((level, index) => index > 0 && level - levels[index - 1] > 1);
  step.check(levels[0] === 1 && skipped.length === 0, `${path} skips no heading level (levels ${levels.join('')})`);

  // The real portrait, loaded, with its alt text and the size it reserves.
  await page.locator('figure.portrait img').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const image = document.querySelector('figure.portrait img');
    return Boolean(image && image.complete && image.naturalWidth > 0);
  }, null, { timeout: 10_000 }).catch(() => {});
  const portrait = await page.$eval('figure.portrait img', (image) => ({
    natural: image.naturalWidth,
    alt: image.alt,
    width: image.getAttribute('width'),
    height: image.getAttribute('height'),
    src: image.currentSrc,
  }));
  step.check(portrait.natural > 0, `${path}: the portrait loaded (naturalWidth ${portrait.natural}, ${portrait.src})`);
  step.check(portrait.alt === t.about.portraitAlt, `${path}: the portrait's alt text is the dictionary's "${t.about.portraitAlt}" (got "${portrait.alt}")`);
  step.check(portrait.width === '572' && portrait.height === '1024', `${path}: the portrait has width and height attributes (got ${portrait.width}x${portrait.height})`);
  step.check(/portrait/.test(portrait.src) && !/pool/.test(portrait.src), `${path}: it is the real portrait file, not the pool image (${portrait.src})`);

  // The Q&A and the folded rows are <details>; the five questions are among them.
  const summaries = await page.$$eval('main details > summary', (els) => els.map((el) => el.textContent));
  step.check(summaries.length >= 5, `${path} has at least five <details> (got ${summaries.length})`);
  for (const question of t.compass.qa.items) step.check(summaries.some((text) => text.includes(question)), `${path}: "${question}" is a <summary>`);

  // Counted by the keyboard: Tab reaches a summary with a visible focus ring, and Enter opens it.
  let reached = null;
  for (let press = 0; press < 80 && !reached; press++) {
    await page.keyboard.press('Tab');
    reached = await page.evaluate(() => {
      const active = document.activeElement;
      if (active?.tagName !== 'SUMMARY') return null;
      const style = getComputedStyle(active);
      return { outline: style.outlineStyle, width: parseFloat(style.outlineWidth), open: active.parentElement.open };
    });
  }
  step.check(reached !== null, `${path}: Tab reaches a <summary>`);
  if (reached) {
    step.check(reached.outline !== 'none' && reached.width >= 2, `${path}: the focused <summary> has a visible ring (${reached.outline} ${reached.width}px)`);
    await page.keyboard.press('Enter');
    const opened = await page.evaluate(() => document.activeElement.parentElement.open);
    step.check(opened === !reached.open, `${path}: Enter toggles the focused <details> (open ${reached.open} -> ${opened})`);
  }

  // #career: the section the old /career/ addresses redirect to.
  const career = await page.$eval('#career', (el) => ({ tag: el.tagName, heading: el.querySelector('h2')?.textContent })).catch(() => null);
  step.check(career?.tag === 'SECTION' && career.heading === plain(t.career.title), `${path} has #career, a section headed "${plain(t.career.title)}" (got ${JSON.stringify(career)})`);
  await page.goto(`${BASE}${path}#career`, { waitUntil: 'load' });
  await pageReady(page, path);
  const top = await page.$eval('#career', (el) => el.getBoundingClientRect().top);
  step.check(top > -5 && top < 450, `${path}#career scrolls the section into view (top ${Math.round(top)} px)`);

  // The work section carries the old Projects section's own copy: the intro, the next slot (pointing on to the
  // career) and what is held back, with the three projects between them.
  // textContent, not innerText: the titles and labels are set in capitals by CSS, which innerText would apply.
  const work = await page.$eval('#work', (el) => el.textContent);
  const workOrder = [t.work.intro, ...['Funcial', 'Jontai Energy', 'Cookies Clicker'], plain(t.work.nextTitle), t.work.nextText, t.work.nextLink, t.work.heldTitle, t.work.heldText].map((string) => work.indexOf(string));
  step.check(workOrder.every((place) => place >= 0) && workOrder.every((place, index) => index === 0 || place > workOrder[index - 1]), `${path}: #work has the intro, the projects, the next slot and the held-back note, in that order (${workOrder.join(' ')})`);
  step.check((await page.getAttribute('#work a.lite-more', 'href')) === '#career', `${path}: the next slot's link goes to #career`);
  await page.click('#work a.lite-more');
  await page.waitForFunction(() => location.hash === '#career', null, { timeout: 3_000 }).catch(() => {});
  const jumped = await page.$eval('#career', (el) => el.getBoundingClientRect().top);
  step.check(new URL(page.url()).hash === '#career' && jumped > -5 && jumped < 450, `${path}: following it lands on #career (${page.url()}, top ${Math.round(jumped)} px)`);

  // The words of the engine room and the terminal are not here.
  const body = await page.$eval('main', (el) => el.textContent);
  for (const string of [t.hood.title, t.hood.intro, t.terminal.welcome, t.about.clock.label].map(plain)) {
    step.check(!body.includes(string), `${path} does not carry "${string}"`);
  }

  // Every link in the page's own lists goes to a page of the site.
  const internal = await page.$$eval('main a[href^="/"]', (links) => links.map((link) => link.getAttribute('href')));
  const prefix = lang === 'en' ? '/en' : '';
  for (const href of [`${prefix}/projects/funcial/`, `${prefix}/projects/jontai-energy/`, `${prefix}/projects/cookies-clicker/`, `${prefix}/contact/`]) {
    step.check(internal.includes(href), `${path} links to ${href}`);
  }
  await takeCsp(page, step);
  await context.close();
}

/** With no script at all the page is the same: the HTML the build wrote carries every section. */
async function liteWithoutScript(browser, step) {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  for (const lang of ['nl', 'en']) {
    const path = LITE[lang];
    const response = await page.goto(BASE + path, { waitUntil: 'load' });
    step.check(response?.status() === 200, `${path} answers 200 with JavaScript off`);
    step.check((await page.locator('h1').count()) === 1, `${path} has one <h1> with JavaScript off`);
    step.check((await page.locator('main h2').count()) === 7, `${path} has all seven sections with JavaScript off (got ${await page.locator('main h2').count()})`);
    step.check((await page.locator('main details').count()) >= 5, `${path} has its <details> with JavaScript off`);
    step.check((await page.locator('#career').count()) === 1, `${path} has #career with JavaScript off`);
    step.check((await page.locator('figure.portrait img').count()) === 1, `${path} has the portrait with JavaScript off`);
    // A <details> opens without script: that is the element's own behaviour.
    await page.locator('main details > summary').first().click();
    step.check(await page.$eval('main details', (el) => el.open), `${path}: a <summary> opens its <details> with JavaScript off`);
    const contact = await page.goto(BASE + CONTACT[lang], { waitUntil: 'load' });
    step.check(contact?.status() === 200, `${CONTACT[lang]} answers 200 with JavaScript off`);
    step.check((await page.locator('a[href="mailto:bhccob@gmail.com"]').count()) === 1, `${CONTACT[lang]} carries the direct mailto: link with JavaScript off`);
    const keyed = (await page.locator('input[name="access_key"]').count()) > 0;
    // With a key the form is plain HTML that posts to Web3Forms; without one there is no form until the page hydrates.
    step.check(
      keyed ? (await page.getAttribute('form.form', 'action')) === 'https://api.web3forms.com/submit' : (await page.locator('form').count()) === 0,
      `${CONTACT[lang]} with JavaScript off: ${keyed ? 'the form posts to Web3Forms' : 'no dead form without a key'}`,
    );
  }
  await context.close();
}

/** The contact form, with the Web3Forms key the build has (none on a local build) in a language. */
async function contactOne(browser, step, lang) {
  const { t } = new Translator(lang);
  const path = CONTACT[lang];
  const c = t.contact;
  const { context, page } = await openPage(browser, step);
  // The Navigation API sees every navigation before it happens, including one to mailto:, and a script can cancel it:
  // the link is recorded and no mail client opens.
  await context.addInitScript(() => {
    window.__mailto = [];
    navigation.addEventListener('navigate', (event) => {
      if (!event.destination.url.startsWith('mailto:')) return;
      window.__mailto.push(event.destination.url);
      event.preventDefault();
    });
  });
  await page.goto(BASE + path, { waitUntil: 'load' });
  await pageReady(page, path);
  // The form is there, and the page has hydrated: from then on the page validates, not the browser (noValidate).
  await page.waitForFunction(() => document.querySelector('form.form')?.noValidate === true, null, { timeout: 10_000 });
  const h1 = await page.$$eval('h1', (els) => els.map((el) => el.textContent));
  step.check(h1.length === 1 && h1[0] === plain(c.title), `${path} has one <h1>, the contact copy's title "${plain(c.title)}" (got ${JSON.stringify(h1)})`);
  step.check((await page.title()) === `${t.meta.contactTitle} | Bob Chung`, `${path}: the <title> stays "${t.meta.contactTitle} | Bob Chung" (got "${await page.title()}")`);
  const keyed = (await page.locator('input[name="access_key"]').count()) > 0;

  // An empty submit names the first bad field, in the dictionary's words, and moves focus to it.
  await page.click('button[type="submit"]');
  await page.waitForTimeout(200);
  const empty = await page.evaluate(() => ({
    focus: document.activeElement?.id,
    invalid: [...document.querySelectorAll('[aria-invalid="true"]')].map((el) => el.id),
    errors: [...document.querySelectorAll('.field-error')].map((el) => el.textContent),
    mailto: window.__mailto.length,
  }));
  step.check(empty.focus === 'contact-name', `${path}: an empty submit focuses the name field (got ${empty.focus})`);
  step.check(JSON.stringify(empty.invalid) === JSON.stringify(['contact-name', 'contact-email', 'contact-message']), `${path}: name, email and message are marked invalid (got ${empty.invalid.join(' ')})`);
  step.check(empty.errors[0] === c.errors.name && empty.errors[1] === c.errors.email && empty.errors[2] === c.errors.message, `${path}: the errors are the dictionary's (got ${JSON.stringify(empty.errors)})`);
  step.check(empty.mailto === 0, `${path}: an empty submit navigates nowhere`);
  const described = await page.getAttribute('#contact-name', 'aria-describedby');
  step.check(described === 'contact-name-error', `${path}: the name field points at its error with aria-describedby (got ${described})`);

  // An error goes as soon as its field is good enough.
  await page.fill('#contact-name', 'Ada Lovelace');
  step.check((await page.getAttribute('#contact-name', 'aria-invalid')) === null, `${path}: the name's error clears once the name is valid`);

  if (keyed) {
    const hidden = await page.$$eval('form.form input[type="hidden"]', (els) => Object.fromEntries(els.map((el) => [el.name, el.value])));
    step.check(Boolean(hidden.access_key) && hidden.redirect?.endsWith(`${path}?sent=1`), `${path}: the build's key is in the form, with the way back to ${path}?sent=1`);
    await takeCsp(page, step);
    await context.close();
    await contactKeyed(browser, step, lang);
    return `${path}: key present, posts to a mocked Web3Forms (success, guards, cooldown, failure)`;
  }

  // No key: a valid form hands the message to the email app. The mailto: navigation is cancelled above.
  await page.fill('#contact-email', 'ada@example.com');
  await page.fill('#contact-subject', 'A question');
  await page.fill('#contact-message', 'Hello Bob, I would like to talk about a project.');
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => window.__mailto.length > 0, null, { timeout: 5_000 }).catch(() => {});
  const mailto = await page.evaluate(() => window.__mailto);
  step.check(mailto.length === 1, `${path}: submitting a filled form navigates to a mailto: link once (got ${mailto.length})`);
  if (mailto.length > 0) {
    const url = new URL(mailto[0]);
    step.check(url.protocol === 'mailto:' && url.pathname === 'bhccob@gmail.com', `${path}: the link is to bhccob@gmail.com (got ${url.protocol}${url.pathname})`);
    step.check(url.searchParams.get('subject') === 'Portfolio: A question', `${path}: the subject is "Portfolio: A question" (got ${url.searchParams.get('subject')})`);
    const body = url.searchParams.get('body') ?? '';
    step.check(body.startsWith('Hello Bob, I would like to talk about a project.') && body.includes('Ada Lovelace') && body.includes('ada@example.com'), `${path}: the body has the message, the name and the address (got ${JSON.stringify(body)})`);
  }
  const done = await page.evaluate(() => ({ title: document.querySelector('.form-done h2')?.textContent, focused: document.activeElement?.classList.contains('form-done') }));
  step.check(done.title === c.mailtoTitle && done.focused === true, `${path}: the "${c.mailtoTitle}" panel is shown and focused (got ${JSON.stringify(done)})`);
  await page.click('.form-done button');
  step.check((await page.evaluate(() => document.activeElement?.id)) === 'contact-name', `${path}: "${c.again}" puts focus back in the name field`);
  await takeCsp(page, step);
  await context.close();
  return `${path}: no key, mailto: navigation recorded and cancelled`;
}

/**
 * A build with a Web3Forms key: the form posts in the background. Web3Forms is answered by this harness (the
 * request never leaves the machine), so nothing is sent: a post that works, the two guards against scripts
 * (a form filled in at once, a ticked honeypot), the pause after a sent message, an answer that fails, and
 * a post nobody answers (one post for two submits, the timeout, a retry).
 */
async function contactKeyed(browser, step, lang) {
  const { t } = new Translator(lang);
  const c = t.contact;
  const path = CONTACT[lang];
  const posts = [];
  let answer = { status: 200, body: { success: true } };
  // The console errors these posts are meant to end in: the page logs a failed post, and the browser logs the 500 or the abort.
  const failing = (message) => /Web3Forms answered 500|status of 500|abort|ERR_ABORTED/i.test(message.text());
  const { context, page } = await openPage(browser, step, failing);
  await context.route('https://api.web3forms.com/**', async (route) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    posts.push(JSON.parse(route.request().postData() ?? '{}'));
    return route.fulfill({ status: answer.status, headers: cors, contentType: 'application/json', body: JSON.stringify(answer.body) });
  });
  const open = async () => {
    await page.goto(BASE + path, { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelector('form.form')?.noValidate === true, null, { timeout: 10_000 });
  };
  const fill = async () => {
    await page.fill('#contact-name', 'Ada Lovelace');
    await page.fill('#contact-email', 'ada@example.com');
    await page.fill('#contact-subject', 'A question');
    await page.fill('#contact-message', 'Hello Bob, I would like to talk about a project.');
  };
  const title = () => page.evaluate(() => document.querySelector('.form-done h2')?.textContent ?? null);

  // A ticked honeypot is a script: it is told it worked, and nothing is posted, however long it took.
  await open();
  await fill();
  await page.evaluate(() => document.querySelector('input[name="botcheck"]').click());
  await page.click('button[type="submit"]');
  step.check((await title()) === c.successTitle && posts.length === 0, `${path}: a ticked honeypot shows success and posts nothing (posted ${posts.length})`);

  // A person: after three seconds, the post goes out with the key and the fields.
  await open();
  await page.waitForTimeout(3_200);
  await fill();
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => document.querySelector('.form-done'), null, { timeout: 5_000 }).catch(() => {});
  step.check(posts.length === 1, `${path}: a filled form posts once (posted ${posts.length})`);
  const sent = posts[0] ?? {};
  step.check(Boolean(sent.access_key) && sent.name === 'Ada Lovelace' && sent.email === 'ada@example.com' && sent.message?.startsWith('Hello Bob'), `${path}: the post carries the key and the three fields (got ${JSON.stringify(Object.keys(sent))})`);
  step.check(sent.subject === 'Portfolio: A question' && sent.from_name === 'bhccob.me portfolio', `${path}: the post has the site's subject and sender (got ${sent.subject}, ${sent.from_name})`);
  step.check((await title()) === c.successTitle, `${path}: the "${c.successTitle}" panel is shown`);

  // The next message waits a minute.
  await page.click('.form-done button');
  await page.waitForTimeout(3_200);
  await fill();
  await page.click('button[type="submit"]');
  await page.waitForTimeout(300);
  step.check(posts.length === 1 && (await page.textContent('.form-status')) === c.errors.cooldown, `${path}: a second message within a minute gets the pause notice and is not posted (posted ${posts.length})`);
  step.check(await page.evaluate(() => document.activeElement?.classList.contains('form-status')), `${path}: the pause notice takes focus`);
  await takeCsp(page, step);
  await context.close();

  // A form sent at once (a quick writer, the browser's autofill) is not dropped: it shows that it is sending, waits out
  // the rest of MIN_FILL_MS from the page opening, then posts. A tab of its own: the pause above is this tab's.
  const quick = await openPage(browser, step, failing);
  const quickPosts = [];
  await quick.context.route('https://api.web3forms.com/**', async (route) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    quickPosts.push(Date.now());
    return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });
  const fast = quick.page;
  await fast.goto(BASE + path, { waitUntil: 'load' });
  await fast.waitForFunction(() => document.querySelector('form.form')?.noValidate === true, null, { timeout: 10_000 });
  const readyAt = Date.now();
  await fast.fill('#contact-name', 'Ada Lovelace');
  await fast.fill('#contact-email', 'ada@example.com');
  await fast.fill('#contact-message', 'Hello Bob, I would like to talk about a project.');
  await fast.click('button[type="submit"]');
  const waiting = await fast.evaluate(() => {
    const button = document.querySelector('form.form button[type="submit"]');
    return { text: button?.textContent ?? null, disabled: button?.disabled ?? null, done: document.querySelector('.form-done') !== null };
  });
  step.check(
    waiting.text === c.sending && waiting.disabled === true && !waiting.done && quickPosts.length === 0,
    `${path}: a form sent at once says "${c.sending}" and waits, nothing posted yet (got ${JSON.stringify(waiting)}, posted ${quickPosts.length})`,
  );
  await fast.waitForFunction(() => document.querySelector('.form-done'), null, { timeout: MIN_FILL_MS + 5_000 }).catch(() => {});
  const quickTitle = await fast.evaluate(() => document.querySelector('.form-done h2')?.textContent ?? null);
  const after = quickPosts.length === 1 ? quickPosts[0] - readyAt : null;
  step.check(
    quickPosts.length === 1 && quickTitle === c.successTitle && after !== null && after >= MIN_FILL_MS - 200,
    `${path}: then it posts once, ${after} ms after the form was ready (no sooner than ${MIN_FILL_MS} ms after the page opened), and shows "${c.successTitle}" (posted ${quickPosts.length}, got "${quickTitle}")`,
  );
  await takeCsp(fast, step);
  await quick.context.close();

  // An answer that fails: the visitor is told, the form keeps what they wrote, and they can try again.
  answer = { status: 500, body: { success: false } };
  const failed = await openPage(browser, step, failing);
  await failed.context.route('https://api.web3forms.com/**', async (route) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    return route.fulfill({ status: answer.status, headers: cors, contentType: 'application/json', body: JSON.stringify(answer.body) });
  });
  const retry = failed.page;
  await retry.goto(BASE + path, { waitUntil: 'load' });
  await retry.waitForFunction(() => document.querySelector('form.form')?.noValidate === true, null, { timeout: 10_000 });
  await retry.waitForTimeout(3_200);
  await retry.fill('#contact-name', 'Ada Lovelace');
  await retry.fill('#contact-email', 'ada@example.com');
  await retry.fill('#contact-message', 'Hello Bob, I would like to talk about a project.');
  await retry.click('button[type="submit"]');
  await retry.waitForFunction(() => document.querySelector('.form-status')?.textContent, null, { timeout: 5_000 }).catch(() => {});
  step.check((await retry.textContent('.form-status')) === c.errors.generic, `${path}: a failing post shows the generic error (got "${await retry.textContent('.form-status')}")`);
  step.check((await retry.inputValue('#contact-name')) === 'Ada Lovelace' && (await retry.locator('button[type="submit"]').isEnabled()), `${path}: the form keeps what was written and can send again`);
  const failFocus = await retry.evaluate(() => ({ alert: document.activeElement?.classList.contains('form-status'), role: document.activeElement?.getAttribute('role') }));
  step.check(failFocus.alert === true && failFocus.role === 'alert', `${path}: after a failed post focus is on the alert, not lost to <body> (got ${JSON.stringify(failFocus)})`);
  await takeCsp(retry, step);
  await failed.context.close();

  // A post that is never answered: one goes out however often the form is submitted, and after fifteen seconds
  // (the page's clock is Playwright's, moved forward past the timeout) it fails like any other and can be retried.
  const hung = await openPage(browser, step, failing);
  const hangs = [];
  await hung.context.route('https://api.web3forms.com/**', async (route) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    hangs.push(route.request().postData());
    await new Promise(() => {}); // no answer, ever: the page's own timeout has to end it
  });
  const stuck = hung.page;
  await stuck.clock.install();
  await stuck.goto(BASE + path, { waitUntil: 'load' });
  await stuck.waitForFunction(() => document.querySelector('form.form')?.noValidate === true, null, { timeout: 10_000 });
  await stuck.waitForTimeout(3_200);
  await stuck.fill('#contact-name', 'Ada Lovelace');
  await stuck.fill('#contact-email', 'ada@example.com');
  await stuck.fill('#contact-message', 'Hello Bob, I would like to talk about a project.');
  // Two submit events in one go, as Enter pressed twice or a script would send them: the button cannot stop the second.
  await stuck.evaluate(() => {
    const form = document.querySelector('form.form');
    form.requestSubmit();
    form.requestSubmit();
  });
  await stuck.waitForFunction(() => document.querySelector('form.form button[type="submit"]')?.disabled, null, { timeout: 3_000 }).catch(() => {});
  await stuck.waitForTimeout(400);
  step.check(hangs.length === 1, `${path}: two submits at once post once (posted ${hangs.length})`);
  step.check((await stuck.textContent('form.form button[type="submit"]')) === c.sending, `${path}: while the post is out the button says "${c.sending}" and is off`);
  await stuck.clock.fastForward(SEND_TIMEOUT_MS + 1_000);
  await stuck.waitForFunction(() => document.querySelector('.form-status')?.textContent, null, { timeout: 5_000 }).catch(() => {});
  step.check((await stuck.textContent('.form-status')) === c.errors.generic, `${path}: a post nobody answers fails after fifteen seconds with the generic error (got "${await stuck.textContent('.form-status')}")`);
  step.check((await stuck.inputValue('#contact-message')).startsWith('Hello Bob') && (await stuck.locator('button[type="submit"]').isEnabled()), `${path}: after the timeout the form keeps the message and the button is on again`);
  step.check(await stuck.evaluate(() => document.activeElement?.classList.contains('form-status')), `${path}: after the timeout focus is on the alert`);
  await stuck.evaluate(() => document.querySelector('form.form').requestSubmit());
  await stuck.waitForTimeout(400);
  step.check(hangs.length === 2, `${path}: after a failure the form can send again (posted ${hangs.length})`);
  await hung.context.close();
}

async function lite(browser, step) {
  for (const lang of ['nl', 'en']) await liteOne(browser, step, lang);
  await liteWithoutScript(browser, step);
  const summaries = [];
  for (const lang of ['nl', 'en']) summaries.push(await contactOne(browser, step, lang));
  return `/lite/ and /en/lite/: seven sections, portrait, details, #career, no script needed; ${summaries.join('; ')}`;
}

// ---------------------------------------------------------------- scroll

/** The per-frame values of the scroll, from window.__needleDebug(): `chapterIndex` is its `chapter.index`. */
const frameOf = (page) =>
  page.evaluate(() => {
    const { progress, target, velocity, chapter } = window.__needleDebug();
    return { progress, target, velocity, chapterIndex: chapter.index };
  });
/** The scene's whole phase, as `{ kind, dir?, category?, id? }`. */
const phaseOf = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__needleDebug().phase)));

/** Waits until the story is at rest: progress on its target and the target no longer moving (a glide is over). */
async function restAt(page) {
  let previous = null;
  for (let i = 0; i < 80; i++) {
    const f = await frameOf(page);
    if (previous !== null && f.target === previous && Math.abs(f.target - f.progress) < 1e-4) return f;
    previous = f.target;
    await page.waitForTimeout(100);
  }
  throw new Error(`the story did not come to rest (${JSON.stringify(await frameOf(page))})`);
}

/**
 * Waits until a direct load of / is on HOME_IDLE, the phase the scroll moves from: the opening says LOADED once it has
 * landed on the home (or the host once it settles on no scene). Answers how long it took, in ms from the document's
 * start. A first visit plays the whole show (SCRIPT.home, 12.5 s, never shortened on a fast load) once the scene has
 * started, which it must within LOAD_TIMEOUT_MS: LANDED_WITHIN_MS.
 */
async function reachHomeIdle(page) {
  await page.waitForFunction(() => window.__needleDebug?.().phase.kind === 'HOME_IDLE', null, { timeout: LANDED_WITHIN_MS });
  return page.evaluate(() => Math.round(performance.now()));
}

/** How long a first visit may take from the document's start to HOME_IDLE, ms: the scene's start, the full show, and slack. */
const LANDED_WITHIN_MS = LOAD_TIMEOUT_MS + SCRIPT.home * 1000 + 3_000;

/** Waits for the scene to be in a phase of `kind` and says so as a check. */
async function expectPhase(page, step, kind, message) {
  const reached = await waitForPhase(page, kind).then(() => true, () => false);
  step.check(reached, `${message} (phase ${JSON.stringify(await phaseOf(page))})`);
}

/**
 * Counts the scroll loop's frame requests from now on in window.__raf, how many of its callbacks run at each frame
 * time in window.__rafRuns (two callbacks at one time are two frames asked for in the same frame), and records
 * whether each wheel was prevented in window.__wheels. Only the scroll loop's own requests are counted: it asks
 * through window.__needleDebug.scrollRequest (the bridge behind ?proof), which is wrapped here, while the canvas renders
 * on demand through R3F's own requestAnimationFrame, which may land in the same frame and is no business of the scroll's.
 */
const watchFrames = (page) =>
  page.evaluate(() => {
    window.__raf = 0;
    window.__rafRuns = {};
    const bridge = window.__needleDebug;
    if (!bridge) throw new Error('window.__needleDebug is missing: open the page with ?proof');
    const request = bridge.scrollRequest;
    bridge.scrollRequest = (callback) => {
      window.__raf++;
      return request((now) => {
        window.__rafRuns[now] = (window.__rafRuns[now] ?? 0) + 1;
        callback(now);
      });
    };
    window.__wheels = [];
    // A listener on window runs after the input's on the document element, so it sees the final defaultPrevented.
    window.addEventListener('wheel', (event) => window.__wheels.push(event.defaultPrevented), { passive: true });
  });

/** What watchFrames saw since it was started or last read: calls asked for, frames that ran, and the most callbacks in one frame. */
const takeFrames = (page) =>
  page.evaluate(() => {
    const runs = Object.values(window.__rafRuns);
    const report = { requests: window.__raf, frames: runs.length, most: Math.max(0, ...runs) };
    window.__raf = 0;
    window.__rafRuns = {};
    return report;
  });

const near = (a, b, tolerance = 1e-6) => Math.abs(a - b) <= tolerance;

async function scrollDesktop(browser, step) {
  const { context, page } = await openPage(browser, step);
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await stageReady(page);
  await reachHomeIdle(page);
  await watchFrames(page);
  const vh = await page.evaluate(() => window.innerHeight);

  // The root is the scroll surface, and it is locked.
  const style = await page.evaluate(() => {
    const css = getComputedStyle(document.documentElement);
    return { route: document.documentElement.dataset.route, overflow: css.overflow, overscroll: css.overscrollBehaviorY, touchAction: css.touchAction };
  });
  step.check(style.route === 'home', `the home page says data-route="home" (got ${style.route})`);
  step.check(style.overflow === 'hidden' && style.overscroll === 'none', `with 3D on the root does not scroll and does not overscroll (got ${style.overflow}, ${style.overscroll})`);
  step.check(style.touchAction === 'pinch-zoom', `with 3D on a finger does not pan the page, a pinch still zooms it (touch-action ${style.touchAction})`);
  const start = await frameOf(page);
  step.check(start.progress === 0 && start.target === 0 && start.chapterIndex === 0, `the story starts at 0 (got ${JSON.stringify(start)})`);

  // 10 wheel events of 120 px: 1200 px of scroll, in viewport heights.
  await page.mouse.move(720, 450);
  for (let i = 0; i < 10; i++) {
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(16);
  }
  const pushed = await frameOf(page);
  step.check(near(pushed.target, 1200 / vh, 1e-9), `10 wheel events of 120 px move the target by 1200 px = ${1200 / vh} units (got ${pushed.target})`);
  step.check((await page.evaluate(() => window.__wheels)).length === 10 && (await page.evaluate(() => window.__wheels.every(Boolean))), 'every wheel event is prevented while the scroll is enabled');
  step.check((await page.evaluate(() => window.__raf)) > 0, 'the wheel woke the scroll loop');
  const rested = await restAt(page);
  step.check(near(rested.progress, rested.target, 1e-4) && rested.progress > 1, `progress catches up with the target and passes the first unit (got ${rested.progress})`);
  step.check(rested.chapterIndex === 1, `frame.chapterIndex is in step with the chapter: DISSECT is 1 (got ${rested.chapterIndex})`);
  const left = await phaseOf(page);
  step.check(left.kind === 'DISSECT', `the phase leaves HOME_IDLE for DISSECT (got ${JSON.stringify(left)})`);
  step.check((await page.evaluate(() => window.scrollY)) === 0, 'the page itself did not scroll');
  await page.waitForTimeout(150);
  const ran = await takeFrames(page);
  step.check(ran.most === 1 && ran.requests === ran.frames, `one frame asked for at a time through the wheel gesture: ${ran.requests} asked for, ${ran.frames} frames, at most ${ran.most} callback in one`);

  // Asleep at rest: the scroll loop asks for no frame at all while nothing moves (the canvas has its own sleep: step loaded).
  await page.waitForTimeout(600);
  step.check((await page.evaluate(() => window.__raf)) === 0, `the scroll loop sleeps at rest: no frame asked for in 600 ms (got ${await page.evaluate(() => window.__raf)})`);
  step.check((await frameOf(page)).velocity === 0, 'and the velocity is 0');

  // Keys. Home goes back to the start of the story and the phase with it.
  await page.keyboard.press('Home');
  const home = await restAt(page);
  step.check(home.progress === 0 && home.target === 0 && home.chapterIndex === 0, `Home goes to the start (got ${JSON.stringify(home)})`);
  await expectPhase(page, step, 'HOME_IDLE', 'and the phase is HOME_IDLE again');
  await page.keyboard.press('PageDown');
  step.check(near((await frameOf(page)).target, 0.9), 'Page Down moves 0.9 of a viewport');
  await page.keyboard.press('ArrowDown');
  step.check(near((await frameOf(page)).target, 1.05), 'an arrow moves 0.15 of a viewport');
  await page.keyboard.press('Space');
  step.check(near((await frameOf(page)).target, 1.95), 'Space moves a page');
  await page.keyboard.press('Shift+Space');
  step.check(near((await frameOf(page)).target, 1.05), 'Shift+Space moves a page back');
  await page.keyboard.press('PageUp');
  step.check(near((await frameOf(page)).target, 0.15), 'Page Up moves a page back');
  await page.keyboard.press('ArrowUp');
  step.check(near((await frameOf(page)).target, 0), 'and the target stops at 0');
  await page.keyboard.press('End');
  const end = await restAt(page);
  step.check(end.target === 18 && end.progress === 18, `End goes to the end of the story (got ${JSON.stringify(end)})`);
  const last = await waitForPhase(page, 'PROJECTS').then(() => phaseOf(page));
  step.check(last.category === 'oscillator', `the story ends in the last project category (got ${JSON.stringify(last)})`);
  await page.mouse.wheel(0, 240);
  step.check((await frameOf(page)).target === 18, 'and the target stops at the end');
  await page.keyboard.press('Home');
  await restAt(page);
  await waitForPhase(page, 'HOME_IDLE');
  await page.mouse.wheel(0, -120);
  step.check((await frameOf(page)).target === 0, 'a wheel up at the start stays at 0');

  // A visit to a page and back: the scene returns to the phase the scroll is in, and the scroll goes on from there.
  for (const key of ['PageDown', 'PageDown', 'ArrowDown', 'ArrowDown']) await page.keyboard.press(key);
  const mid = await restAt(page);
  step.check(near(mid.progress, 2.1) && mid.chapterIndex === 1, `the story rests part way through DISSECT (got ${JSON.stringify(mid)})`);
  await page.focus('.home-nav a[href="/projects/funcial/"]');
  await page.keyboard.press('Enter');
  await page.waitForURL((url) => url.pathname === '/projects/funcial/', { timeout: 5_000 });
  await waitForProject(page, 'funcial');
  const onPage = await frameOf(page);
  await page.keyboard.press('PageDown'); // on the project page the keys are the page's
  step.check((await frameOf(page)).target === onPage.target, 'on a project page the keys do not move the story');
  await page.click('a.back');
  await page.waitForURL((url) => url.pathname === '/', { timeout: 5_000 });
  await expectPhase(page, step, 'DISSECT', "coming back to / puts the scene on the scroll's phase, DISSECT, and not on HOME_IDLE");
  const back = await frameOf(page);
  step.check(near(back.progress, mid.progress) && back.chapterIndex === 1, `the story is where it was left (got ${JSON.stringify(back)})`);
  await page.keyboard.press('PageDown');
  const resumed = await restAt(page);
  step.check(near(resumed.target, 3), `and the scroll goes on from there (got ${resumed.target})`);
  await page.keyboard.press('Home');
  await restAt(page);

  // A text field keeps its keys.
  await page.evaluate(() => {
    const input = document.createElement('input');
    input.id = 'scroll-probe';
    document.body.append(input);
    input.focus();
  });
  const before = await frameOf(page);
  await page.keyboard.press('PageDown');
  await page.keyboard.press('Space');
  await page.keyboard.press('End');
  step.check((await frameOf(page)).target === before.target, 'Page Down, Space and End typed into a text field do not move the story');
  step.check((await page.inputValue('#scroll-probe')) === ' ', 'and Space is typed into it');
  await page.evaluate(() => document.getElementById('scroll-probe')?.remove());

  // A pinch is the browser's.
  await page.evaluate(() => (window.__wheels.length = 0));
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, 100);
  await page.keyboard.up('Control');
  step.check(JSON.stringify(await page.evaluate(() => window.__wheels)) === '[false]', 'a wheel with ctrl held (a pinch) is not prevented');
  step.check((await frameOf(page)).target === 0, 'and it does not move the story');

  // The 3D switch takes Space (a button press), and with 3D off nothing is prevented: the page scrolls natively.
  await page.focus('button[role="switch"]');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.documentElement.dataset['3d'] === 'off', null, { timeout: 5_000 });
  step.check((await frameOf(page)).target === 0, 'Space on the 3D switch presses it and does not move the story');
  await page.evaluate(() => {
    window.__wheels.length = 0;
    document.activeElement?.blur();
  });
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(300);
  step.check(JSON.stringify(await page.evaluate(() => window.__wheels)) === '[false]', 'with 3D off a wheel is not prevented');
  const natural = await page.evaluate(() => ({ y: window.scrollY, overflow: getComputedStyle(document.documentElement).overflow }));
  step.check(natural.y > 0 && natural.overflow === 'visible', `with 3D off the home page scrolls natively (scrollY ${natural.y}, overflow ${natural.overflow})`);
  await page.keyboard.press('PageDown');
  step.check((await frameOf(page)).target === 0, 'and the keys do not move the story');

  // Switched back on, the root is locked again and the wheel is the scene's.
  await page.focus('button[role="switch"]');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.documentElement.dataset['3d'] === 'on', null, { timeout: 5_000 });
  await page.evaluate(() => {
    window.__wheels.length = 0;
    document.activeElement?.blur();
  });
  step.check((await page.evaluate(() => window.scrollY)) === 0, 'with 3D on again the page is back at the top');
  await page.mouse.wheel(0, 120);
  step.check((await frameOf(page)).target > 0 && JSON.stringify(await page.evaluate(() => window.__wheels)) === '[true]', 'and the wheel moves the story again');
  await takeCsp(page, step);
  await context.close();
}

/** With reduced motion every wheel gesture, swipe and key press is one stop: the start of the next chapter. */
async function scrollReduced(browser, step) {
  const { context, page } = await openPage(browser, step, () => false, { width: 1440, height: 900 }, { reducedMotion: 'reduce' });
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await stageReady(page);
  step.check(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), 'the page asks for reduced motion');
  await reachHomeIdle(page);
  await page.mouse.move(720, 450);

  // A gesture: ten events 16 ms apart. Then 300 ms of quiet, then another.
  for (let i = 0; i < 10; i++) {
    await page.mouse.wheel(0, 40);
    await page.waitForTimeout(16);
  }
  step.check((await frameOf(page)).target === 1, `a whole wheel gesture is one stop: the start of DISSECT (got ${(await frameOf(page)).target})`);
  await page.waitForTimeout(300);
  for (let i = 0; i < 10; i++) {
    await page.mouse.wheel(0, 40);
    await page.waitForTimeout(16);
  }
  step.check((await frameOf(page)).target === 12, `the next gesture, after a quiet gap, is the next stop: MORPH (got ${(await frameOf(page)).target})`);
  const rested = await restAt(page);
  step.check(rested.progress === 12 && rested.chapterIndex === 2, `the story arrives at the stop (got ${JSON.stringify(rested)})`);
  await expectPhase(page, step, 'MORPH', 'and the phase is MORPH');

  // Keys: one stop a press, and a held key is one press.
  const stops = [];
  for (const key of ['PageDown', 'PageDown', 'PageDown']) {
    await page.keyboard.press(key);
    stops.push((await frameOf(page)).target);
  }
  step.check(JSON.stringify(stops) === '[14,15,16]', `Page Down is a stop a press (got ${JSON.stringify(stops)})`);
  await page.keyboard.press('ArrowUp');
  step.check((await frameOf(page)).target === 15, 'an arrow up is the previous stop');
  await page.keyboard.down('PageDown');
  await page.keyboard.down('PageDown'); // auto-repeat: keydown with repeat = true
  await page.keyboard.down('PageDown');
  await page.keyboard.up('PageDown');
  step.check((await frameOf(page)).target === 16, `a held key is one step (got ${(await frameOf(page)).target})`);
  await page.keyboard.press('Home');
  step.check((await frameOf(page)).target === 0, 'Home still goes to the start');
  await restAt(page);
  await expectPhase(page, step, 'HOME_IDLE', 'and the phase is HOME_IDLE again');
  await takeCsp(page, step);
  await context.close();
}

/** A finger on a touch screen (Chrome DevTools Protocol touch events). */
async function scrollTouch(browser, step) {
  const { context, page } = await openPage(browser, step, () => false, { width: 390, height: 844 }, { hasTouch: true, isMobile: true });
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await stageReady(page);
  await reachHomeIdle(page);
  await watchFrames(page);
  const cdp = await context.newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const vh = await page.evaluate(() => window.innerHeight);
  // What the page sees of each touchmove: was it cancelable, and did the input prevent it?
  await page.evaluate(() => {
    window.__moves = [];
    window.addEventListener('touchmove', (event) => window.__moves.push({ cancelable: event.cancelable, prevented: event.defaultPrevented }), { passive: true });
  });
  const style = await page.evaluate(() => getComputedStyle(document.documentElement).touchAction);
  step.check(style === 'pinch-zoom', `on a touch screen the root takes no one-finger pan (touch-action ${style})`);

  // A drag of 400 px up moves the story 400 / vh, and a finger that lets go while moving glides on.
  const drag = async (from, to, x = 195, stepPx = 40) => {
    await touch('touchStart', x, from);
    const sign = Math.sign(to - from);
    for (let y = from + sign * stepPx; sign > 0 ? y <= to : y >= to; y += sign * stepPx) {
      await touch('touchMove', x, y);
      await page.waitForTimeout(12);
    }
    await page.evaluate(() => {
      window.__raf = 0; // from the lift on: what the glide asks for
      window.__rafRuns = {};
    });
    await touch('touchEnd');
  };
  await drag(700, 300);
  const lifted = await frameOf(page);
  const moves = await page.evaluate(() => window.__moves);
  step.check(moves.length > 0 && moves.every((m) => m.cancelable && m.prevented), `every touchmove of the drag is cancelable and the input prevents it (${JSON.stringify(moves.slice(0, 2))} ...)`);
  step.check(lifted.target >= 400 / vh - 1e-6, `the drag moved the story at least its length, ${400 / vh} units (got ${lifted.target})`);
  const rested = await restAt(page);
  step.check(rested.target > lifted.target + 0.05, `the flick glides on after the finger lifts: ${lifted.target} then ${rested.target}`);
  await page.waitForTimeout(150);
  const glide = await takeFrames(page);
  // (the counters were reset at the lift, when one frame was already waiting: it runs without having been counted as asked for)
  step.check(glide.most === 1 && Math.abs(glide.requests - glide.frames) <= 1, `one frame asked for at a time through the glide: ${glide.requests} asked for, ${glide.frames} frames, at most ${glide.most} callback in one`);
  step.check(glide.frames >= 40, `and the glide goes on for dozens of frames, not the handful a re-entrant wake left it (${glide.frames} frames from the lift to rest)`);
  step.check((await frameOf(page)).velocity === 0, 'and the velocity is 0 at rest');
  await drag(700, 300);
  await restAt(page);
  await drag(700, 300);
  const far = await restAt(page);
  await expectPhase(page, step, 'DISSECT', 'the phase leaves HOME_IDLE for DISSECT');
  step.check(far.target > 1 && far.chapterIndex >= 1, `flicks take the story out of HOME_IDLE into DISSECT (got ${JSON.stringify(far)})`);
  step.check((await page.evaluate(() => window.scrollY)) === 0, 'the page itself did not scroll');

  // A drag down goes back.
  await drag(200, 700);
  const returned = await restAt(page);
  step.check(returned.target < far.target, `a drag down goes back (${far.target} then ${returned.target})`);

  // A sideways swipe is not the scroll's, and a tap is nobody's but the page's.
  const before = await frameOf(page);
  await touch('touchStart', 300, 400);
  for (const x of [270, 230, 190, 150, 110]) {
    await touch('touchMove', x, 395);
    await page.waitForTimeout(40);
  }
  await touch('touchEnd');
  await page.waitForTimeout(600); // a tap straight after a swipe is taken by the browser for the one that stops a fling
  step.check((await frameOf(page)).target === before.target, 'a swipe sideways does not move the story');
  await page.tap('button[role="switch"]');
  await page.waitForFunction(() => document.documentElement.dataset['3d'] === 'off', null, { timeout: 5_000 });
  step.check((await page.getAttribute('html', 'data-3d')) === 'off', 'a tap on the 3D switch still presses it');
  await page.tap('button[role="switch"]');
  await page.waitForFunction(() => document.documentElement.dataset['3d'] === 'on', null, { timeout: 5_000 });
  await takeCsp(page, step);
  await context.close();
}

async function scroll(browser, step) {
  await scrollDesktop(browser, step);
  await scrollReduced(browser, step);
  await scrollTouch(browser, step);
  return 'locked root; 10 wheel events of 120 px reach DISSECT; the loop sleeps at rest; keys, Home and End; text fields, pinch and 3D off left to the browser; reduced motion steps by stops; touch drag, glide, tap';
}

// ---------------------------------------------------------------- the scene: loaded, no-webgl, fps

/** Counts every requestAnimationFrame call of the page from its start in window.__allRaf: the canvas's (R3F's) included. */
const countAllFrames = (context) =>
  context.addInitScript(() => {
    window.__allRaf = 0;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => {
      window.__allRaf++;
      return raf(callback);
    };
  });

/**
 * Waits until the page asks for no frame at all for a whole second; answers how long that took to begin (ms from
 * the call), or null if it did not within `limit` ms. Only page.evaluate and timers here: no requestAnimationFrame
 * polling of the harness's own.
 */
async function sleepWithin(page, limit) {
  const start = Date.now();
  let last = await page.evaluate(() => window.__allRaf);
  let quietSince = Date.now();
  while (Date.now() - start < limit) {
    await page.waitForTimeout(200);
    const now = await page.evaluate(() => window.__allRaf);
    if (now !== last) {
      last = now;
      quietSince = Date.now();
    } else if (Date.now() - quietSince >= 1_000) {
      return quietSince - start;
    }
  }
  return null;
}

async function loaded(browser, step) {
  const { context, page } = await openPage(browser, step);
  await countAllFrames(context);
  const documents = [];
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url());
  });
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await page.bringToFront();
  await page.waitForFunction(() => typeof window.__needleDebug === 'function', null, { timeout: 5_000 });
  const first = await page.evaluate(() => window.__needleDebug().phase.kind);
  step.check(first === 'LOADING', `a direct load of / starts in LOADING (got ${first})`);
  const at = await reachHomeIdle(page);
  const fullShow = SCRIPT.home * 1000;
  step.check(
    at >= fullShow && at <= LOAD_TIMEOUT_MS + fullShow,
    `and reaches HOME_IDLE once the opening has landed, ${at} ms after the document started: the whole show (${fullShow} ms, never shortened on a fast load) after a start within the ${LOAD_TIMEOUT_MS} ms load timeout`,
  );
  step.check(documents.length === 1 && new URL(page.url()).pathname === '/', `with no detour: one document, still on / (got ${documents.join(' → ')}, ${page.url()})`);
  const shown = await page.evaluate(() => ({
    ready: document.querySelector('.scene-host')?.hasAttribute('data-ready'),
    webgl: document.querySelector('.scene-host')?.getAttribute('data-webgl'),
    canvases: document.querySelectorAll('.scene-host canvas').length,
    mounts: window.__needleDebug().canvasMounts,
    card: document.querySelector('.scene-fallback') !== null,
  }));
  step.check(shown.ready && shown.webgl === 'ok' && shown.canvases === 1 && shown.mounts === 1 && !shown.card, `the scene is ready and shown, on WebGL 'ok', with no fallback card (got ${JSON.stringify(shown)})`);

  // The wheel moves the story straight away.
  await page.mouse.move(720, 450);
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(16);
  }
  const moved = await restAt(page);
  step.check(moved.target > 0 && near(moved.progress, moved.target, 1e-4), `wheel events on the freshly loaded / move frame.progress (target ${moved.target}, progress ${moved.progress})`);
  await page.keyboard.press('Home');
  await restAt(page);

  // The canvas renders on demand: once the home's idle motion is over, nothing asks for a frame; the pointer wakes it.
  const slept = await sleepWithin(page, SLEEP_WITHIN_MS);
  step.check(slept !== null, `an idle page draws nothing: no requestAnimationFrame at all for 1 s, from ${slept} ms after the last input (limit ${SLEEP_WITHIN_MS} ms)`);
  const before = await page.evaluate(() => window.__allRaf);
  await page.mouse.move(980, 320, { steps: 4 });
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => window.__allRaf);
  step.check(after > before, `a pointer move wakes the canvas (${after - before} frames asked for in 300 ms)`);

  // Over a page of text a mouse idling about wakes only the parallax, about a second, never the home's 12 s idle.
  await page.focus('.home-nav a[href="/projects/funcial/"]');
  await page.keyboard.press('Enter');
  await page.waitForURL((url) => url.pathname === '/projects/funcial/', { timeout: 5_000 });
  const settled = await sleepWithin(page, SLEEP_WITHIN_MS); // the phase change's own while first
  const wiggleFrom = await page.evaluate(() => window.__allRaf);
  for (const [x, y] of [[400, 300], [460, 340], [520, 300], [480, 360]]) await page.mouse.move(x, y, { steps: 3 });
  const woke = (await page.evaluate(() => window.__allRaf)) > wiggleFrom;
  // sleepWithin asks for a whole quiet second, so a limit of RESETTLE_MS + 1 s means quiet from at most RESETTLE_MS on.
  const RESETTLE_MS = 3_000;
  const resettled = await sleepWithin(page, RESETTLE_MS + 1_000);
  step.check(
    settled !== null && woke && resettled !== null,
    `on /projects/funcial/ a mouse wiggle wakes the parallax only: the canvas falls quiet ${resettled} ms after it and stays so for 1 s (it must fall quiet within ${RESETTLE_MS} ms; the home's idle is ${IDLE_SECONDS} s)`,
  );
  await takeCsp(page, step);
  await context.close();

  // 3D stored off: no WebGL, and the phase still leaves LOADING.
  const off = await openPage(browser, step);
  await off.context.addInitScript(() => localStorage.setItem('needle-3d', 'off'));
  await off.page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  const offAt = await reachHomeIdle(off.page);
  await off.page.waitForTimeout(500);
  const none = await off.page.evaluate(() => ({ mounts: window.__needleDebug?.().canvasMounts ?? 0, canvases: document.querySelectorAll('canvas').length, card: document.querySelector('.scene-fallback') !== null }));
  step.check(none.mounts === 0 && none.canvases === 0 && !none.card, `with 3D stored off: HOME_IDLE after ${offAt} ms, no Stage, no <canvas>, no card (got ${JSON.stringify(none)})`);
  await takeCsp(off.page, step);
  await off.context.close();
  return `LOADING → HOME_IDLE in ${at} ms on a direct load, the wheel moves the story, the canvas sleeps ${slept} ms after the last input and wakes on the pointer; 3D off: HOME_IDLE in ${offAt} ms, no WebGL`;
}

/**
 * The policy is in force, not only unbroken: every other step proves no violation happens, this one that a violation
 * is caught. On a page with a scene and one without, after hydration, an inline <script> is injected and an inline
 * event handler (an <img onerror>, on an image that cannot decode) is added: neither runs, and the page reports a
 * `securitypolicyviolation` for each (script-src-elem, script-src-attr). The browser's console refusal for each is the
 * expected outcome, counted, not an error.
 */
async function cspEnforced(browser, step) {
  const refused = (message) => /Content Security Policy/i.test(message.text());
  const summary = [];
  for (const path of ['/', '/lite/']) {
    const { context, page } = await openPage(browser, step, refused);
    await page.goto(`${BASE}${path}?proof`, { waitUntil: 'load' });
    await pageReady(page, path);
    await takeCsp(page, step); // the page's own load: no violation
    const before = step.expected.length;
    await page.evaluate(() => {
      const script = document.createElement('script');
      script.textContent = 'window.__injectedRan = true;';
      document.body.append(script);
      document.body.insertAdjacentHTML('beforeend', '<img alt="" src="data:image/png;base64,AAAA" onerror="window.__handlerRan = true">');
    });
    await page.waitForFunction(() => window.__cspViolations.length >= 2, null, { timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(300);
    const caught = await page.evaluate(() => ({
      ran: { script: window.__injectedRan === true, handler: window.__handlerRan === true },
      violations: window.__cspViolations.splice(0).map((v) => `${v.directive} ${v.blocked}`),
    }));
    step.check(!caught.ran.script && !caught.ran.handler, `${path}: an injected inline script and an inline handler do not run (got ${JSON.stringify(caught.ran)})`);
    step.check(
      caught.violations.some((v) => v.startsWith('script-src-elem inline')) && caught.violations.some((v) => v.startsWith('script-src-attr inline')),
      `${path}: the page reports both as policy violations (got ${caught.violations.join(', ') || 'none'})`,
    );
    step.check(step.expected.length - before === caught.violations.length, `${path}: the browser's console refused each once (got ${step.expected.length - before} for ${caught.violations.length} violations)`);
    summary.push(`${path} ${caught.violations.join(', ')}`);
    await context.close();
  }
  return `the policy refuses what it should: ${summary.join('; ')}`;
}

/** The pages of text alone a visit can begin on, in both languages: Lite and contact. */
const SCENELESS = PAGES.filter((p) => !p.scene).map((p) => p.path);

/**
 * Lite is the light version, and every page without a scene with it (Ruling 27). A visit that begins on one fetches
 * none of the scene's files (the Stage chunk, three.js, maath, the textures), mounts no <canvas>, probes no WebGL and
 * shows no fallback card, and still leaves LOADING, with 3D left on. A canvas that came from the home page by client
 * navigation stays (one Stage, the same <canvas>) and sleeps behind the page: no requestAnimationFrame at all while the
 * mouse moves over it for 1.5 s. Back on the home page, the pointer wakes it again.
 */
async function noScene(browser, step) {
  for (const path of SCENELESS) {
    const { context, page } = await openPage(browser, step);
    const scenery = sceneRequests(page);
    await page.goto(`${BASE}${path}?proof`, { waitUntil: 'load' });
    const left = await page.waitForFunction(() => window.__needleDebug?.().phase.kind === 'HOME_IDLE', null, { timeout: 5_000 }).then(() => true, () => false);
    await page.mouse.move(400, 300);
    await page.mouse.move(700, 500, { steps: 5 });
    await page.waitForTimeout(1_500); // a Stage on its way would have asked for its chunk by now
    const state = await page.evaluate(() => ({
      canvases: document.querySelectorAll('canvas').length,
      mounts: window.__needleDebug?.().canvasMounts ?? null,
      webgl: document.querySelector('.scene-host')?.getAttribute('data-webgl') ?? null,
      card: document.querySelector('.scene-fallback') !== null,
      threeD: document.documentElement.dataset['3d'],
      phase: window.__needleDebug?.().phase.kind ?? null,
    }));
    step.check(scenery.length === 0, `${path}: a direct load asks for none of the scene's files (got ${scenery.join(' ') || 'none'})`);
    step.check(state.canvases === 0 && state.mounts === 0 && state.webgl === null, `${path}: no <canvas>, no Stage, no WebGL probe (got ${JSON.stringify(state)})`);
    step.check(left && state.phase === 'HOME_IDLE' && !state.card && state.threeD === 'on', `${path}: out of LOADING, no fallback card, 3D still on (got ${JSON.stringify(state)})`);
    await takeCsp(page, step);
    await context.close();
  }

  // From the home page to Lite by client navigation: the canvas stays, and sleeps there.
  const { context, page } = await openPage(browser, step);
  await countAllFrames(context);
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await page.bringToFront();
  await reachHomeIdle(page);
  await page.waitForFunction(() => document.querySelector('.scene-host')?.hasAttribute('data-ready'), null, { timeout: LOAD_TIMEOUT_MS + 3_000 });
  await page.evaluate(() => {
    document.querySelector('.scene-host canvas').dataset.id = 'home-canvas';
  });
  await page.mouse.move(700, 400, { steps: 4 }); // the parallax and the needle are moving as the visitor leaves
  await page.click('.site-header a[href="/lite/"]');
  await page.waitForURL(`${BASE}/lite/`, { timeout: 5_000 });
  await page.waitForTimeout(300); // the frame already asked for when the page changed runs
  const from = await page.evaluate(() => window.__allRaf);
  for (let i = 0; i < 15; i++) {
    await page.mouse.move(300 + ((i * 53) % 700), 200 + ((i * 37) % 500), { steps: 3 });
    await page.waitForTimeout(100);
  }
  const slept = (await page.evaluate(() => window.__allRaf)) - from;
  const kept = await page.evaluate(() => ({
    mounts: window.__needleDebug().canvasMounts,
    canvases: document.querySelectorAll('canvas').length,
    tag: document.querySelector('.scene-host canvas')?.dataset.id ?? null,
    route: window.__needleDebug().route,
  }));
  step.check(kept.route === 'lite' && kept.mounts === 1 && kept.canvases === 1 && kept.tag === 'home-canvas', `home → Lite by client navigation: one Stage, the same <canvas> (got ${JSON.stringify(kept)})`);
  step.check(slept === 0, `on Lite the canvas sleeps: no requestAnimationFrame in 1.5 s of the mouse moving over the page (got ${slept})`);

  // Scrolling, resizing and a font arriving on Lite wake nothing either (Task 14b, fix 1): Home stays mounted behind a
  // page without a scene, and its layout listeners must not ask for frames there. The page scrolled for real, by wheel
  // and by script; then the window's `resize` and the fonts' `loadingdone` sent as the browser sends them but with no
  // change of size, so only the page's own listeners can answer; then a real resize, which redraws the canvas once at
  // its new size (R3F's store and the Rig frame a new size: a wake the Heartbeat's contract names) and sleeps again.
  const frames = () => page.evaluate(() => window.__allRaf);
  let at = await frames();
  for (let i = 0; i < 10; i++) {
    await page.mouse.wheel(0, 240);
    await page.waitForTimeout(100);
  }
  for (let i = 0; i < 5; i++) {
    await page.evaluate((y) => window.scrollTo(0, y), 300 * i);
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(300);
  const scrolled = { frames: (await frames()) - at, moved: await page.evaluate(() => window.scrollY > 0) };
  at = await frames();
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => {
      window.dispatchEvent(new Event('resize'));
      document.fonts.dispatchEvent(new Event('loadingdone'));
    });
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(300);
  const nudged = (await frames()) - at;
  const viewport = page.viewportSize();
  at = await frames();
  await page.setViewportSize({ width: viewport.width - 160, height: viewport.height - 100 });
  await page.waitForTimeout(500);
  const resized = (await frames()) - at;
  at = await frames();
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel(0, -240);
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(500);
  const after = (await frames()) - at;
  step.check(scrolled.moved && scrolled.frames === 0, `on Lite scrolling (10 wheel turns, 5 scrollTo) asks for no frame (got ${scrolled.frames}, scrolled ${scrolled.moved})`);
  step.check(nudged === 0, `on Lite the window's resize event and the fonts' loadingdone, with no change of size, ask for no frame (got ${nudged})`);
  step.check(resized <= 2 && after === 0, `on Lite a real resize redraws the canvas once at its new size and it sleeps again: no frame in the scrolling after (got ${resized}, then ${after})`);
  await page.setViewportSize(viewport);
  await page.waitForTimeout(500);

  // Back on the home page the scene is shown again, and the pointer wakes it.
  await page.click('.site-header a.site-name');
  await page.waitForURL(`${BASE}/`, { timeout: 5_000 });
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => window.__allRaf);
  await page.mouse.move(900, 300, { steps: 4 });
  await page.waitForTimeout(300);
  const woke = (await page.evaluate(() => window.__allRaf)) - before;
  step.check(woke > 0, `back on the home page the pointer wakes the canvas again (${woke} frames asked for in 300 ms)`);
  await takeCsp(page, step);
  await context.close();
  return `${SCENELESS.join(', ')}: no scene file, no canvas, out of LOADING; home → Lite keeps the one canvas asleep (0 frames through mouse moves, scrolling, resize and font events; one redraw for a real resize), and home wakes it`;
}

/** A token's `#rrggbb` as the computed style writes the colour (`rgb(r, g, b)`); anything else as it is. */
const rgbOf = (hex) => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex ?? '');
  return m ? `rgb(${m.slice(1).map((h) => parseInt(h, 16)).join(', ')})` : hex;
};

async function noWebglOne(browser, step, label, expected) {
  const summary = [];
  for (const lang of ['nl', 'en']) {
    const { context, page } = await openPage(browser, step);
    const path = lang === 'nl' ? '/' : '/en/';
    const { t } = new Translator(lang);
    await page.goto(`${BASE}${path}?proof`, { waitUntil: 'load' });
    const card = await page.waitForSelector('.scene-fallback', { timeout: 10_000 }).then(() => true, () => false);
    step.check(card, `${label}, ${path}: the fallback card shows`);
    await page.waitForTimeout(1_000); // a Stage mounted by mistake would have its canvas by now
    const state = await page.evaluate(() => ({
      title: document.querySelector('.scene-fallback-title')?.textContent ?? null,
      link: document.querySelector('.scene-fallback a')?.getAttribute('href') ?? null,
      linkText: document.querySelector('.scene-fallback a')?.textContent ?? null,
      role: document.querySelector('.scene-fallback')?.getAttribute('role') ?? null,
      canvases: document.querySelectorAll('canvas').length,
      mounts: window.__needleDebug?.().canvasMounts ?? 0,
      webgl: document.querySelector('.scene-host')?.getAttribute('data-webgl') ?? null,
      threeD: document.documentElement.dataset['3d'],
      stored: localStorage.getItem('needle-3d'),
      overflow: getComputedStyle(document.documentElement).overflow,
      nav: document.querySelector('.home-nav')?.getBoundingClientRect().height ?? 0,
      poster: (() => {
        const poster = document.querySelector('.poster');
        if (!poster) return null;
        const css = getComputedStyle(poster);
        const box = poster.getBoundingClientRect();
        const { clientWidth, clientHeight } = document.documentElement;
        return {
          images: poster.querySelectorAll('img, picture, video').length,
          colour: css.backgroundColor,
          image: css.backgroundImage,
          night: getComputedStyle(document.documentElement).getPropertyValue('--night').trim(),
          covers: box.left === 0 && box.top === 0 && box.width === clientWidth && box.height === clientHeight,
          shown: css.display !== 'none' && css.visibility === 'visible' && css.opacity === '1',
        };
      })(),
      phase: window.__needleDebug?.().phase.kind ?? null,
    }));
    const lite = lang === 'nl' ? '/lite/' : '/en/lite/';
    step.check(state.title === t.needle.fallback.title, `${label}, ${path}: the card says "${t.needle.fallback.title}" (got ${state.title})`);
    step.check(state.link === lite && state.linkText === t.needle.fallback.lite && state.role === 'status', `${label}, ${path}: with a link to ${lite}, "${t.needle.fallback.lite}", as a status (got ${state.link}, ${state.linkText}, role ${state.role})`);
    step.check(state.canvases === 0 && state.mounts === 0, `${label}, ${path}: no <canvas> and no Stage (got ${state.canvases} canvas, ${state.mounts} mounts)`);
    step.check(state.webgl === expected, `${label}, ${path}: the probe found '${expected}' (got ${state.webgl})`);
    step.check(state.threeD === 'off' && state.stored === null, `${label}, ${path}: 3D off for the visit, the stored choice untouched (data-3d ${state.threeD}, needle-3d ${state.stored})`);
    step.check(state.overflow === 'visible' && state.nav > 100, `${label}, ${path}: the page scrolls natively and the home page's links show (overflow ${state.overflow}, nav ${Math.round(state.nav)} px)`);
    const poster = state.poster;
    step.check(
      poster !== null && poster.images === 0 && poster.colour === rgbOf(poster.night) && /radial-gradient/.test(poster.image) && poster.covers && poster.shown,
      `${label}, ${path}: the poster is there, the CSS panel of the night (${poster?.night}) with its faint glow over the whole viewport, no image (got ${JSON.stringify(poster)})`,
    );
    step.check(state.phase === 'HOME_IDLE', `${label}, ${path}: the phase leaves LOADING (got ${state.phase})`);
    summary.push(`${path} "${state.title}"`);
    await takeCsp(page, step);
    await context.close();
  }
  return `${label}: ${summary.join(', ')}`;
}

/**
 * The scene's canvas read back through toDataURL in a frame callback right after the canvas drew (its drawing buffer is
 * not kept past the frame), at 96x54: its brightest channel (`max`) and the brightest channel on the compass's axis
 * (`axis`). The home camera stands on the compass's north-south line and looks at its centre (src/engine/bob/shots.ts),
 * so the axis is the picture's middle column; the pivot, the axis, the bands and the lit well lie on it between half way
 * and four fifths down. The pointer is moved first, so the scene is drawing; tried a few times. Answers null without a canvas.
 */
async function readCanvas(page) {
  let pixel = null;
  for (let attempt = 0; attempt < 5 && !(pixel && pixel.max > 60); attempt++) {
    await page.mouse.move(760 + attempt * 7, 440, { steps: 2 }); // keep it drawing
    pixel = await page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          requestAnimationFrame(() => {
            const canvas = document.querySelector('.scene-host canvas');
            if (!canvas) return resolve(null);
            const url = canvas.toDataURL('image/png');
            const image = new Image();
            image.onload = () => {
              const w = 96;
              const h = 54;
              const scratch = document.createElement('canvas');
              scratch.width = w;
              scratch.height = h;
              const ctx = scratch.getContext('2d');
              ctx.drawImage(image, 0, 0, w, h);
              const data = ctx.getImageData(0, 0, w, h).data;
              let max = 0;
              for (let i = 0; i < data.length; i += 4) max = Math.max(max, data[i], data[i + 1], data[i + 2]);
              let axis = 0;
              for (let row = Math.round(0.5 * h); row <= Math.round(0.8 * h); row++) {
                const k = (row * w + w / 2) * 4;
                axis = Math.max(axis, data[k], data[k + 1], data[k + 2]);
              }
              resolve({ max, axis });
            };
            image.onerror = () => reject(new Error('the data URL did not load'));
            image.src = url;
          });
        }),
    );
    if (pixel === null) return null;
  }
  return pixel;
}

/**
 * The canvas read back holds the scene: something bright (the engraving, the gilt) and the compass on its axis, well above
 * the night's own channels (palette.night, #040209: at most 9).
 */
const drawn = (pixel) => pixel !== null && pixel.max > 60 && pixel.axis > 30;

/** Loses the live canvas's WebGL context (WEBGL_lose_context); `restore` brings it back half a second later. */
const loseContext = (page, restore) =>
  page.evaluate(async (restore) => {
    const lose = document.querySelector('.scene-host canvas').getContext('webgl2').getExtension('WEBGL_lose_context');
    lose.loseContext();
    if (!restore) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
    lose.restoreContext();
  }, restore);

/** The scene's own failures, on the GPU: a context lost for good, a context that comes back, a scene that never loads. */
async function sceneFailures(browser, step) {
  const fellBack = async (page, what, within) => {
    const shown = await page.waitForSelector('.scene-fallback', { timeout: within }).then(() => true, () => false);
    const state = await page.evaluate(() => ({
      canvases: document.querySelectorAll('canvas').length,
      threeD: document.documentElement.dataset['3d'],
      stored: localStorage.getItem('needle-3d'),
      phase: window.__needleDebug?.().phase.kind ?? null,
    }));
    step.check(
      shown && state.canvases === 0 && state.threeD === 'off' && state.stored === null && state.phase === 'HOME_IDLE',
      `${what}: the fallback card within ${within} ms, no <canvas>, 3D off for the visit and not stored, out of LOADING (got ${JSON.stringify({ shown, ...state })})`,
    );
  };

  // A context lost for good: the card after RESTORE_TIMEOUT_MS. Switching 3D back on tries again, with a new Stage.
  {
    const { context, page } = await openPage(browser, step);
    await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
    await reachHomeIdle(page);
    await loseContext(page, false);
    await fellBack(page, 'a context lost for good', RESTORE_TIMEOUT_MS + 3_000);
    await page.click('button[role="switch"]');
    await page.waitForFunction(() => document.querySelector('.scene-host')?.hasAttribute('data-ready'), null, { timeout: LOAD_TIMEOUT_MS });
    const again = await page.evaluate(() => ({ mounts: window.__needleDebug?.().canvasMounts, card: document.querySelector('.scene-fallback') !== null, stored: localStorage.getItem('needle-3d') }));
    step.check(again.mounts === 2 && !again.card && again.stored === 'on', `switched back on, a new Stage draws and the card goes (got ${JSON.stringify(again)})`);
    await takeCsp(page, step);
    await context.close();
  }

  // A context that comes back: the scene draws again, with no card.
  {
    const { context, page } = await openPage(browser, step);
    await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
    await page.bringToFront();
    await reachHomeIdle(page);
    await loseContext(page, true);
    await page.waitForFunction(() => window.__needleDebug?.().contextLost === false, null, { timeout: 5_000 });
    await page.waitForTimeout(RESTORE_TIMEOUT_MS + 500); // past the point where a context still lost would have failed it
    const pixel = await readCanvas(page);
    const card = await page.evaluate(() => document.querySelector('.scene-fallback') !== null);
    step.check(!card && drawn(pixel), `a restored context: no card, and the scene draws again (brightest ${pixel?.max}, on the compass's axis ${pixel?.axis})`);
    await takeCsp(page, step);
    await context.close();
  }

  // A scene that never arrives (its chunk never answers): the card after LOAD_TIMEOUT_MS.
  {
    const { context, page } = await openPage(browser, step);
    await page.route(STAGE_CHUNK, () => {}); // never fulfilled
    await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
    await fellBack(page, 'a scene that is never ready', LOAD_TIMEOUT_MS + 3_000);
    await takeCsp(page, step);
    await context.close();
  }
  return `a context lost for good, and a scene not ready in ${LOAD_TIMEOUT_MS / 1000} s, fall back to the card; a restored context draws again; 3D back on retries`;
}

async function noWebgl(browser, step) {
  const results = [];
  for (const [label, args, expected] of [
    ['WebGL off', NO_WEBGL, 'none'],
    ['software only', SOFTWARE_GL, 'software'],
  ]) {
    const own = await chromium.launch({ channel: 'msedge', headless: true, args });
    try {
      results.push(await noWebglOne(own, step, label, expected));
    } finally {
      await own.close();
    }
  }
  results.push(await sceneFailures(browser, step));
  return results.join('; ');
}

/**
 * Opens pages of `context` as a background tab: `document.visibilityState` is 'hidden' and requestAnimationFrame
 * callbacks are held, as a browser does for a tab that is not in front (headless Edge never hides a page itself).
 * `window.__toFront()` shows the page: 'visible', a `visibilitychange`, and the held callbacks run.
 */
const asBackgroundTab = (context) =>
  context.addInitScript(() => {
    const tab = { hidden: true, held: [], next: 1 };
    Object.defineProperty(Document.prototype, 'visibilityState', { configurable: true, get: () => (tab.hidden ? 'hidden' : 'visible') });
    Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get: () => tab.hidden });
    const raf = window.requestAnimationFrame.bind(window);
    const caf = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => {
      if (!tab.hidden) return raf(callback);
      const id = -tab.next++;
      tab.held.push([id, callback]);
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      if (id >= 0) return caf(id);
      const at = tab.held.findIndex(([held]) => held === id);
      if (at >= 0) tab.held.splice(at, 1);
    };
    window.__heldFrames = () => tab.held.length;
    window.__toFront = () => {
      tab.hidden = false;
      document.dispatchEvent(new Event('visibilitychange'));
      for (const [, callback] of tab.held.splice(0)) raf(callback);
    };
  });

/** A page opened in a background tab (a middle click) is not given up on while it waits there, however long. */
async function background(browser, step) {
  const { context, page } = await openPage(browser, step);
  await asBackgroundTab(context);
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await page.waitForTimeout(LOAD_TIMEOUT_MS + 2_000); // past the load timeout, all of it hidden
  const waiting = await page.evaluate(() => ({
    hidden: document.visibilityState,
    held: window.__heldFrames(),
    card: document.querySelector('.scene-fallback') !== null,
    threeD: document.documentElement.dataset['3d'],
    phase: window.__needleDebug?.().phase.kind ?? null,
  }));
  step.check(waiting.hidden === 'hidden' && waiting.held > 0, `the page waited in the background, its frames held (${JSON.stringify(waiting)})`);
  step.check(!waiting.card && waiting.threeD === 'on', `${(LOAD_TIMEOUT_MS + 2_000) / 1000} s in the background: no fallback card, 3D still on (got ${JSON.stringify(waiting)})`);
  await page.evaluate(() => window.__toFront());
  await page.bringToFront();
  const shownAt = Date.now();
  const reached = await reachHomeIdle(page).then(() => true, () => false);
  const after = await page.evaluate(() => ({
    phase: window.__needleDebug?.().phase.kind ?? null,
    ready: document.querySelector('.scene-host')?.hasAttribute('data-ready'),
    card: document.querySelector('.scene-fallback') !== null,
    threeD: document.documentElement.dataset['3d'],
    stored: localStorage.getItem('needle-3d'),
  }));
  step.check(
    reached && after.ready && !after.card && after.threeD === 'on' && after.stored === null,
    `brought to the front, the scene loads: HOME_IDLE ${Date.now() - shownAt} ms later, shown, 3D on, no card (got ${JSON.stringify(after)})`,
  );
  await takeCsp(page, step);
  await context.close();
  return `${(LOAD_TIMEOUT_MS + 2_000) / 1000} s in a background tab, then in front: the scene loads, no fallback`;
}

/**
 * Dutch text set in Unbounded with an IJ in it (the fallback card's KWIJT, any title): it is shaped with the font's
 * Dutch `locl` off, which would draw I + J as one glyph that reads as a U. Each such element is measured as shown, with
 * `locl` off and with it on; shown must equal off. Run without WebGL, so the NL card is on the home page.
 */
async function titleIj(_browser, step) {
  const own = await chromium.launch({ channel: 'msedge', headless: true, args: NO_WEBGL });
  const found = [];
  try {
    const { context, page } = await openPage(own, step);
    for (const { path, scene } of PAGES.filter((p) => p.lang === 'nl')) {
      await page.goto(BASE + path, { waitUntil: 'load' });
      // On a page with a scene the card is there once the probe has run: measure only after it is. A page without a
      // scene probes nothing and has no card: measure once it has hydrated.
      if (scene) await page.waitForSelector('.scene-fallback', { state: 'attached', timeout: 10_000 });
      else await pageReady(page, path);
      await page.evaluate(() => document.fonts.ready);
      const rows = await page.evaluate(() => {
        const measured = [];
        for (const element of document.querySelectorAll('body *')) {
          if (!/Unbounded/.test(getComputedStyle(element).fontFamily)) continue;
          const text = [...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent).join('');
          if (!/ij/i.test(text) || element.getBoundingClientRect().width === 0) continue;
          const width = (features) => {
            const clone = element.cloneNode(true);
            if (features !== null) clone.style.fontFeatureSettings = features;
            Object.assign(clone.style, { position: 'absolute', visibility: 'hidden', width: 'auto', maxWidth: 'none', whiteSpace: 'nowrap' });
            element.parentElement.append(clone);
            const w = clone.getBoundingClientRect().width;
            clone.remove();
            return w;
          };
          measured.push({ text: text.trim().slice(0, 48), lang: element.closest('[lang]')?.getAttribute('lang'), shown: width(null), off: width('"locl" 0'), on: width('normal') });
        }
        return measured;
      });
      for (const row of rows) found.push({ path, ...row });
      if (path === '/') {
        mkdirSync(STILLS, { recursive: true });
        await page.locator('.scene-fallback').screenshot({ path: join(STILLS, 'fallback-card-nl.png') });
      }
    }
    await takeCsp(page, step);
    await context.close();
  } finally {
    await own.close();
  }
  const card = found.find((row) => row.path === '/' && /KWIJT/i.test(row.text));
  step.check(card !== undefined, `the NL fallback title is among the Unbounded texts with an IJ (found ${found.length}: ${found.map((row) => `${row.path} "${row.text}"`).join(', ')})`);
  step.check(card !== undefined && Math.abs(card.on - card.off) > 1, `the check bites: with locl on, "${card?.text}" is ${card?.on.toFixed(1)} px, with it off ${card?.off.toFixed(1)} px`);
  for (const row of found) {
    step.check(Math.abs(row.shown - row.off) < 0.01, `${row.path} "${row.text}" (lang ${row.lang}) is shaped with locl off: ${row.shown.toFixed(2)} px shown, ${row.off.toFixed(2)} px off, ${row.on.toFixed(2)} px on`);
  }
  return `${found.length} Dutch Unbounded texts with an IJ, all shaped without the IJ digraph (card crop: ${join(STILLS, 'fallback-card-nl.png')})`;
}

/** The scrim's backgrounds of the poster and of the scene host on the page shown, as computed. */
const scrims = (page) =>
  page.evaluate(() => {
    const host = getComputedStyle(document.querySelector('.scene-host'), '::after');
    const poster = getComputedStyle(document.querySelector('.poster'), '::after');
    const alphas = (image) => [...image.matchAll(/rgba\([^)]*,\s*([\d.]+)\)/g)].map((m) => Number(m[1]));
    return {
      ready: document.querySelector('.scene-host').hasAttribute('data-ready'),
      content: host.content,
      opacity: host.opacity,
      host: host.backgroundImage,
      poster: poster.backgroundImage,
      least: Math.min(...alphas(host.backgroundImage)),
      posterLeast: Math.min(...alphas(poster.backgroundImage)),
      position: host.position,
      inset: [host.top, host.right, host.bottom, host.left].join(' '),
    };
  });

/**
 * Holds the Stage chunk's response until the answered `release()` is called, so the scene cannot become ready meanwhile:
 * a moment that is otherwise a race (the page's `load` against the scene's readiness) lasts as long as the harness needs.
 * Call it before the page navigates. `release()` lets the chunk through and takes the route down.
 */
async function holdStage(page) {
  let open = () => {};
  const gate = new Promise((resolve) => (open = resolve));
  const handler = async (route) => {
    await gate;
    await route.continue().catch(() => {}); // the page may have gone by now
  };
  await page.route(STAGE_CHUNK, handler);
  return async () => {
    open();
    await page.unroute(STAGE_CHUNK, handler);
  };
}

/** A page's file name stem from its path: its language, then the path with dashes: `nl-projects-funcial`, `en-home`. */
const stillName = (path) => `${langOf(path)}-${path.replace(/^\/en(?=\/|$)/, '').split('/').filter(Boolean).join('-') || 'home'}`;

/** The home page, in either language; every other page is a page of text. */
const isHome = (path) => path === '/' || path === '/en/';

/**
 * Waits until the page's opening has landed: its loader stands at `home` (on the home page the phase is HOME_IDLE with
 * it; on a project page the route has left LOADING already and the opening lands under the page's scrim).
 * The first page of a context plays the whole loader; later ones in it take the quick path.
 */
const landed = (page) =>
  page.waitForFunction(() => window.__needleDebug?.().loader.stage === 'home', null, { timeout: LOAD_TIMEOUT_MS + LOADER.giveUp * 1000 });

/**
 * Stills of every page of pagePaths() that the build produced, with the live scene, at 1440x900 and 390x844 (a phone:
 * touch, coarse pointer, two device pixels), and of the fallback, into PROOF_DIR/m2/, named after the page: `nl-home-1440x900.png`,
 * `en-projects-funcial-390x844.png`, `fallback-1440x900.png`. A page with a scene is taken once its opening has landed and the
 * hero (on the home page) has faded in; the fallback once its hero has.
 *
 * On a page of text the scene is under the same scrim as the poster: the scene host's ::after carries the poster's page
 * scrim over the whole canvas once the scene shows; the home page keeps the scene unveiled. Before the scene shows, only
 * the poster's own scrim is there: the Stage chunk is held (holdStage) while that is measured, so the scene cannot be
 * ready at the time, and then released.
 */
async function stills(browser, step) {
  const sizes = STILL_SIZES;
  const dir = STILLS;
  mkdirSync(dir, { recursive: true });
  const shots = [];
  for (const { width, height, options } of sizes) {
    const { context, page } = await openPage(browser, step, () => false, { width, height }, options);
    const scenery = sceneRequests(page);
    for (const { path, scene } of PAGES) {
      const text = !isHome(path);
      const at = `${path} at ${width}x${height}`;
      scenery.length = 0;
      if (!scene) {
        // A page of text alone (Lite, contact): no scene ever comes. The poster under the page's scrim is the picture.
        await page.goto(`${BASE}${path}?proof`, { waitUntil: 'load' });
        await page.bringToFront();
        await pageReady(page, path);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(1_200); // as long as a scene page is given to fade in: one would have come by now
        const plain = await scrims(page);
        const debug = await debugOf(page);
        const canvases = await page.locator('canvas').count();
        step.check(
          !plain.ready && canvases === 0 && debug?.canvasMounts === 0 && scenery.length === 0 && plain.posterLeast >= 0.5,
          `${at}: no scene loads (ready ${plain.ready}, ${canvases} canvas, ${debug?.canvasMounts} mounts, scene files ${scenery.join(' ') || 'none'}) and the poster carries the page's scrim (least alpha ${plain.posterLeast})`,
        );
        const file = join(dir, `${stillName(path)}-${width}x${height}.png`);
        await page.screenshot({ path: file });
        shots.push(file);
        await takeCsp(page, step);
        continue;
      }
      const release = text ? await holdStage(page) : async () => {};
      try {
        await page.goto(`${BASE}${path}?proof`, { waitUntil: 'load' });
        await page.bringToFront();
        if (text) {
          // While the scene is not there only the poster's scrim shows: the host's waits, invisible, for the scene.
          const loading = await scrims(page);
          step.check(
            !loading.ready && loading.opacity === '0' && loading.posterLeast >= 0.5,
            `${at}: while the scene loads only the poster's scrim shows, and it is the page's (ready ${loading.ready}, the host's opacity ${loading.opacity}, the poster's least alpha ${loading.posterLeast})`,
          );
        }
      } finally {
        await release();
      }
      await page.waitForFunction(() => document.querySelector('.scene-host')?.hasAttribute('data-ready'), null, { timeout: LOAD_TIMEOUT_MS + 3_000 });
      const arrived = await landed(page).then(() => true, () => false);
      step.check(arrived, `${at}: the opening lands (loader ${JSON.stringify((await debugOf(page))?.loader)})`);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1_200); // the canvas's and the scrim's fade-in, and the hero's after the landing
      const scrim = await scrims(page);
      if (text) {
        step.check(
          scrim.content !== 'none' && scrim.opacity === '1' && scrim.position === 'absolute' && scrim.inset === '0px 0px 0px 0px' && scrim.host === scrim.poster && scrim.least >= 0.5,
          `${at}: the shown scene is under the page scrim, the poster's own, fully (opacity ${scrim.opacity}; ${scrim.host}; least alpha ${scrim.least})`,
        );
      } else {
        step.check(scrim.content === 'none', `${at}: the home page keeps the scene unveiled (::after content ${scrim.content})`);
      }
      const debug = await debugOf(page);
      step.check(debug !== null && debug.canvasMounts === 1 && !debug.contextLost && debug.threeD, `${at}: one Stage, its context there, 3D on (got ${JSON.stringify(debug && { mounts: debug.canvasMounts, lost: debug.contextLost, threeD: debug.threeD })})`);
      const file = join(dir, `${stillName(path)}-${width}x${height}.png`);
      await page.screenshot({ path: file });
      shots.push(file);
      await takeCsp(page, step);
    }
    await context.close();
  }
  const own = await chromium.launch({ channel: 'msedge', headless: true, args: NO_WEBGL });
  try {
    for (const { width, height, options } of sizes) {
      const { context, page } = await openPage(own, step, () => false, { width, height }, options);
      await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
      await page.waitForSelector('.scene-fallback', { timeout: 10_000 });
      await page.evaluate(() => document.fonts.ready);
      // The hero fades in once the phase leaves LOADING: the still is of it whole, not half way.
      const hero = await page.waitForFunction(() => getComputedStyle(document.querySelector('.hero')).opacity === '1', null, { timeout: 5_000 }).then(() => true, () => false);
      step.check(hero, `the fallback at ${width}x${height}: the hero is shown whole`);
      const file = join(dir, `fallback-${width}x${height}.png`);
      await page.screenshot({ path: file });
      shots.push(file);
      await takeCsp(page, step);
      await context.close();
    }
  } finally {
    await own.close();
  }
  step.check(shots.length === PAGES.length * sizes.length + sizes.length, `${shots.length} stills: ${PAGES.length} pages at ${sizes.length} sizes, and the fallback at each`);
  console.log(`note: stills (${shots.length}) in ${dir}`);
  return `${shots.length} stills in ${dir}: ${PAGES.length} pages at 1440x900 and 390x844 once landed, the fallback; the page scrim over the scene on every page of text`;
}

/**
 * The call in the opening's load that the `load-throw` step makes throw: the four painted band strips uploaded to the
 * GPU (`gl.initTexture(strip)`, src/scene/bob/Opening.tsx), which runs only after the loader is shown, the strips are
 * painted and the compass is built from its file. It is a property call, so minifying keeps its name (three's own
 * definition of it lives in the three chunk, not the Stage's); the step fails if the built Stage chunk has it other
 * than once.
 */
const LOAD_THROW_AT = '.initTexture(';
const LOAD_THROW_MESSAGE = 'load-throw: the proof makes the compass load throw';

/**
 * A throw inside the opening's real load fails the scene: the real Stage chunk is served with that one call patched
 * to throw (no fault hook in the site). Expected: the fallback card, 3D off for the visit and not stored, LOADED
 * (HOME_IDLE), no `data-ready` and no canvas, all well inside the load timeout, and exactly one console error: the
 * host's own report of the failure.
 */
async function loadThrow(browser, step) {
  const reported = (message) => /^\[needle\] the compass load failed; showing the poster/.test(message.text());
  const { context, page } = await openPage(browser, step, reported);
  let patched = 0;
  let found = -1;
  await page.route(STAGE_CHUNK, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    found = body.split(LOAD_THROW_AT).length - 1;
    patched++;
    await route.fulfill({
      response,
      body: body.replace(LOAD_THROW_AT, `${LOAD_THROW_AT}(() => { throw new Error(${JSON.stringify(LOAD_THROW_MESSAGE)}); })(), `),
    });
  });
  const started = Date.now();
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  const card = await page.waitForSelector('.scene-fallback', { timeout: LOAD_TIMEOUT_MS / 2 }).then(() => true, () => false);
  const tookMs = Date.now() - started;
  await page.waitForTimeout(500); // anything late (a scene shown after all, a second report) would be here by now
  const state = await page.evaluate(() => ({
    title: document.querySelector('.scene-fallback-title')?.textContent ?? null,
    threeD: document.documentElement.dataset['3d'],
    stored: localStorage.getItem('needle-3d'),
    phase: window.__needleDebug?.().phase.kind ?? null,
    ready: document.querySelector('.scene-host')?.hasAttribute('data-ready') ?? null,
    canvases: document.querySelectorAll('canvas').length,
    mounts: window.__needleDebug?.().canvasMounts ?? 0,
  }));
  step.check(patched === 1 && found === 1, `the real Stage chunk was served with its one "${LOAD_THROW_AT}" call made to throw (served ${patched}, call found ${found} times)`);
  step.check(card, `a throwing load shows the fallback card, ${tookMs} ms after the page started (well inside the ${LOAD_TIMEOUT_MS / 1000} s load timeout: the throw, not the timer)`);
  step.check(state.threeD === 'off' && state.stored === null, `3D off for the visit, the stored choice untouched (data-3d ${state.threeD}, needle-3d ${state.stored})`);
  step.check(state.phase === 'HOME_IDLE', `LOADED was dispatched: the phase is HOME_IDLE (got ${state.phase})`);
  step.check(state.ready === false && state.canvases === 0 && state.mounts === 1, `no partial scene: no data-ready, the Stage that mounted is gone with its canvas (ready ${state.ready}, ${state.canvases} canvas, ${state.mounts} mount)`);
  step.check(
    step.expected.length === 1 && step.expected[0].includes(LOAD_THROW_MESSAGE),
    `exactly one console error, the host's report of the failed load with the thrown error (got ${step.expected.length}: ${step.expected.map((text) => text.split('\n')[0]).join(' | ')})`,
  );
  await takeCsp(page, step);
  await context.close();
  return `a throw inside the opening's load (${LOAD_THROW_AT}): the card in ${tookMs} ms, 3D off and not stored, HOME_IDLE, no partial scene, one reported error`;
}

async function fps(browser, step) {
  const { context, page } = await openPage(browser, step);
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await page.bringToFront(); // a page in the background has its frames throttled
  await reachHomeIdle(page);
  await page.waitForTimeout(3_000);
  // The scene draws while the home's idle motion runs; a pointer move stirs it (and the parallax) again.
  await page.mouse.move(700, 420);
  await page.mouse.move(760, 440, { steps: 6 });
  const times = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const seen = [];
        const tick = (now) => {
          seen.push(now);
          if (seen.length < 121) requestAnimationFrame(tick);
          else resolve(seen);
        };
        requestAnimationFrame(tick);
      }),
  );
  const span = times[times.length - 1] - times[0];
  const mean = Math.round((120 / span) * 1000 * 10) / 10;
  const pixel = await readCanvas(page);
  step.check(drawn(pixel), `the canvas holds the scene: read back through toDataURL, its brightest channel is ${pixel?.max}, ${pixel?.axis} on the compass's axis`);
  step.check(Number.isFinite(mean) && mean > 0, `120 frames sampled over ${Math.round(span)} ms`);

  // The site's own meter (window.__needleDebug().fps, a rolling mean over the last 60 frames the canvas drew) and what
  // else the bridge reports of the canvas. Reported, not gated, except that they are there.
  const debug = await debugOf(page);
  step.check(debug !== null && debug.fps > 0, `the bridge reports the canvas's own rolling fps (got ${debug?.fps})`);
  step.check(debug !== null && debug.dpr >= 1 && debug.dpr <= 1.75, `and its pixel ratio, within the ladder's 1 to 1.75 (got ${debug?.dpr})`);
  step.check(debug !== null && debug.camera.fov > 0 && debug.camera.position.every(Number.isFinite), `and its camera (got ${JSON.stringify(debug?.camera)})`);
  step.check(debug !== null && ['high', 'medium', 'low'].includes(debug.tier), `and the quality tier (got ${debug?.tier})`);
  console.log(`note: fps on / at 1440x900 (GPU): mean ${mean} over 120 frames (${Math.round(span)} ms); the scene's own meter ${debug?.fps?.toFixed(1)} fps, dpr ${debug?.dpr}, tier ${debug?.tier}`);
  step.fps = mean;
  step.rollingFps = debug?.fps ?? null;
  step.quality = debug ? { tier: debug.tier, dpr: debug.dpr } : null;
  await takeCsp(page, step);
  await context.close();
  return `mean ${mean} fps over 120 frames (the scene's own meter ${debug?.fps?.toFixed(1)}), tier ${debug?.tier}, dpr ${debug?.dpr}, the canvas is not blank (brightest ${pixel?.max})`;
}

// ---------------------------------------------------------------- the BOB opening, the dark look, the aim, the hero

/**
 * The opening's six moments for the stills: the loader's clock held at each (`seekLoader`: the full show of a load that
 * had landed from the start), the stage each must show and what the moment is, against the preview's stills
 * (docs/design/bob-compass/p01-p05; src/engine/bob/loaderTimeline.ts, SCRIPT): the first B being cut, the second B, the
 * circle, the iris opening, the compass rising, and the home it lands on.
 */
const LOADER_MOMENTS = [
  { seconds: 1.75, stage: 'engrave', what: 'the first B' },
  { seconds: 5.0, stage: 'engrave', what: 'the second B' },
  { seconds: 8.25, stage: 'engrave', what: 'the circle' },
  { seconds: 9.75, stage: 'open', what: 'the iris' },
  { seconds: 11.0, stage: 'rise', what: 'the rise' },
  { seconds: SCRIPT.home, stage: 'home', what: 'home' },
];

/** How much of the name a loader state has cut, the five marks summed (0 to 5). */
const cutOf = (loader) => (loader?.strokes ?? []).reduce((sum, share) => sum + share, 0);

/**
 * Holds the opening's clock at `seconds` through the bridge (`seekLoader`; -1 lets go) and waits until the scene has
 * drawn that moment: the bridge reports it (the held seconds, or the live clock at home again), then a few frames go
 * by. Answers `loader` as the bridge then reports it. Seek only after HOME_IDLE: the real load is done by then.
 */
async function seekLoader(page, seconds) {
  await page.evaluate((s) => window.__needleDebug.seekLoader(s), seconds);
  if (seconds >= 0) await page.waitForFunction((s) => window.__needleDebug().loader.elapsed === s, seconds, { timeout: 5_000 });
  else await page.waitForFunction(() => window.__needleDebug().loader.stage === 'home', null, { timeout: 5_000 });
  await page.waitForTimeout(400); // the held moment drawn through the post chain
  return (await debugOf(page)).loader;
}

/**
 * The loader stills of this run, once taken: `loader-stills` takes them, `home-look` gates their luminance (and, run
 * without `loader-stills`, takes them itself first).
 */
let loaderShots = null;

/**
 * At each still size, in a fresh context: `/?proof` loaded and landed (HOME_IDLE, so the real load is done), then the
 * opening's clock held at each of LOADER_MOMENTS, its `loader.stage` checked and a still taken into
 * `m2/loader-<n>-<size>.png`; then let go. The phase stays HOME_IDLE throughout (Ruling 2), so the page would show the
 * hero and the header over the held loader, which no visitor sees: while the clock is held the harness sets
 * `<html data-loading>`, the page's own mark of a playing opening, which hides them as it does while the phase is
 * LOADING, and checks that the header is gone, so the stills show no text but the engraving. The last moment is the
 * home itself, so it is taken with the header shown, as the visitor sees it land. Answers the stills.
 */
async function takeLoaderStills(browser, step) {
  if (loaderShots) return loaderShots;
  mkdirSync(STILLS, { recursive: true });
  const shots = [];
  for (const size of STILL_SIZES) {
    const at = sizeName(size);
    const { context, page } = await openPage(browser, step, () => false, { width: size.width, height: size.height }, size.options);
    await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
    await page.bringToFront();
    await reachHomeIdle(page);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => document.documentElement.setAttribute('data-loading', ''));
    const hidden = await page.evaluate(() => ({ header: getComputedStyle(document.querySelector('.site-header')).opacity, hero: getComputedStyle(document.querySelector('.hero')).opacity }));
    step.check(hidden.header === '0' && hidden.hero === '0', `${at}: under <html data-loading> the header and the hero are hidden, so the loader shows no text but the engraving (opacity ${hidden.header}, ${hidden.hero})`);
    for (const [index, { seconds, stage, what }] of LOADER_MOMENTS.entries()) {
      // The home is the home as it lands: the header back (it fades in over 0.9 s).
      if (stage === 'home') {
        await page.evaluate(() => document.documentElement.removeAttribute('data-loading'));
        await page.waitForTimeout(1_000);
      }
      const loader = await seekLoader(page, seconds);
      const phase = (await debugOf(page)).phase.kind;
      step.check(
        loader.stage === stage && phase === 'HOME_IDLE',
        `${at}: the clock held at ${seconds.toFixed(2)} s (${what}) shows ${stage}, the phase still HOME_IDLE (got ${loader.stage}, cut ${cutOf(loader).toFixed(2)} of 5 marks, ${phase})`,
      );
      const file = join(STILLS, `loader-${index + 1}-${at}.png`);
      await page.screenshot({ path: file });
      shots.push({ file, size: at, seconds, what, stage: loader.stage, cut: cutOf(loader), kind: stage === 'home' ? 'home' : 'loader' });
    }
    await page.evaluate(() => document.documentElement.removeAttribute('data-loading'));
    const back = await seekLoader(page, -1);
    const after = await debugOf(page);
    step.check(back.stage === 'home' && after.phase.kind === 'HOME_IDLE', `${at}: let go, the opening is back at home, HOME_IDLE (got ${back.stage}, ${after.phase.kind})`);
    await takeCsp(page, step);
    await context.close();
  }
  loaderShots = shots;
  return shots;
}

async function loaderStills(browser, step) {
  const shots = await takeLoaderStills(browser, step);
  console.log(`note: loader stills (${shots.length}) in ${STILLS}`);
  return `${shots.length} stills of the held opening in ${STILLS}: ${shots
    .filter((shot) => shot.size === sizeName(STILL_SIZES[0]))
    .map((shot) => `${shot.seconds.toFixed(2)} s ${shot.stage} (${shot.what}, cut ${shot.cut.toFixed(2)})`)
    .join(', ')}, at ${STILL_SIZES.map(sizeName).join(' and ')}`;
}

/**
 * The dark look's gate (spec §4, the plan's global constraints): the mean Rec. 709 luma of a home still and of a loader
 * still at most `home` and `loader`, and at most `clipped` of any still's pixels at luma `clip` or more. Only the look
 * may be turned down to pass it (src/scene/bob/look.ts's exposure, bloom and lights, the glass's, the compass's, the
 * engraving's and the smoke's looks), never these numbers.
 *
 * And its floor (Ruling 13, Task 14b): dark but real. Every gated still's mean is above `floor.mean`, and at least one
 * pixel of the scene's middle (`floor.region`, shares of the still's width and height: below the hero's name and the
 * header, above the scroll cue, at both sizes) reaches `floor.peak`. The page's
 * own text is bright (the header, the hero), so a peak taken over the whole still would pass a canvas that drew
 * nothing; in the middle only the scene can make it. (The night alone is a mean of about 0.0115.)
 */
const LUMA_GATE = {
  home: 0.11,
  loader: 0.07,
  clip: 0.98,
  clipped: 0.004,
  floor: { mean: 0.002, peak: 0.3, region: { x: [0.15, 0.85], y: [0.48, 0.85] } },
};

/**
 * How many home stills the gate takes at each size, a quarter of the engraving's breath apart (src/scene/bob/look.ts,
 * BREATHE.period: its glow swells and falls 5 % either way over 4 s), all within the idle motion's IDLE_SECONDS: the gate
 * holds for the worst of them, so it sees the breath's peak and not one moment of it (Ruling 13). The first is `m2/home-<size>.png`; the rest go to `m2/samples/`.
 */
const HOME_SAMPLES = 4;

/**
 * The luminance of a PNG, measured in `page` with no image library: the file as a data URL in an <img>, drawn on a
 * canvas at its own size and read back with getImageData. Luma is Rec. 709's weights on the stored sRGB values, 0..1:
 * `mean` over every pixel, `clipped`, the share of pixels at LUMA_GATE.clip or more, and `peak`, the luma of the
 * brightest pixel in the scene's middle (LUMA_GATE.floor.region).
 */
async function lumaOf(page, file) {
  const url = `data:image/png;base64,${readFileSync(file).toString('base64')}`;
  return page.evaluate(
    async ([url, clip, region]) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(image, 0, 0);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let sum = 0;
      let clipped = 0;
      let peak = 0;
      const [x0, x1] = region.x.map((share) => Math.round(share * canvas.width));
      const [y0, y1] = region.y.map((share) => Math.round(share * canvas.height));
      for (let i = 0; i < data.length; i += 4) {
        const y = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
        sum += y;
        if (y >= clip) clipped++;
        const p = i / 4;
        const px = p % canvas.width;
        const py = (p - px) / canvas.width;
        if (y > peak && px >= x0 && px < x1 && py >= y0 && py < y1) peak = y;
      }
      const pixels = data.length / 4;
      return { mean: sum / pixels, clipped: clipped / pixels, peak, width: canvas.width, height: canvas.height };
    },
    [url, LUMA_GATE.clip, LUMA_GATE.floor.region],
  );
}

/**
 * Measures each still in `shots` (`{ file, kind }`, kind `home` or `loader`) in a page of its own context (no site
 * page, so no policy of the site's stands between the data URL and the canvas) and gates it by LUMA_GATE: its kind's
 * ceiling, the clipped share, and the floor. Prints each still's numbers and answers their rows, for results.json.
 */
async function gateLuma(browser, step, shots) {
  const meter = await browser.newContext();
  const page = await meter.newPage();
  const percent = (share) => `${(share * 100).toFixed(3)} %`;
  const { floor } = LUMA_GATE;
  const rows = [];
  for (const shot of shots) {
    const name = shot.file.split(/[\\/]/).pop();
    const luma = await lumaOf(page, shot.file);
    const limit = LUMA_GATE[shot.kind];
    rows.push({ still: name, kind: shot.kind, mean: Number(luma.mean.toFixed(4)), peak: Number(luma.peak.toFixed(3)), clipped: Number(luma.clipped.toFixed(6)), pixels: `${luma.width}x${luma.height}` });
    step.check(luma.mean <= limit, `${name}: mean luma ${luma.mean.toFixed(4)}, at most ${limit} for a ${shot.kind} still`);
    step.check(luma.clipped <= LUMA_GATE.clipped, `${name}: ${percent(luma.clipped)} of the pixels at luma ${LUMA_GATE.clip} or more, at most ${percent(LUMA_GATE.clipped)}`);
    step.check(
      luma.mean > floor.mean && luma.peak >= floor.peak,
      `${name}: dark but drawn, mean luma ${luma.mean.toFixed(4)} above ${floor.mean} and the brightest pixel of the scene's middle at luma ${luma.peak.toFixed(3)}, ${floor.peak} or more`,
    );
    console.log(`note: luma ${name} (${luma.width}x${luma.height}): mean ${luma.mean.toFixed(4)} (gate ${limit}, floor ${floor.mean}), scene peak ${luma.peak.toFixed(3)} (floor ${floor.peak}), clipped ${percent(luma.clipped)} (gate ${percent(LUMA_GATE.clipped)})`);
  }
  await meter.close();
  return rows;
}

/** The worst mean luma of the rows of a kind, and the brightest pixel over them, as the steps' summaries print them. */
const lumaSummary = (rows, kind) => {
  const of = rows.filter((row) => row.kind === kind);
  return `${kind} mean luma at most ${Math.max(...of.map((row) => row.mean)).toFixed(4)} (gate ${LUMA_GATE[kind]}) and at least ${Math.min(...of.map((row) => row.mean)).toFixed(4)} (floor ${LUMA_GATE.floor.mean})`;
};

/**
 * The home once landed, at each still size in a fresh context (`m2/home-<size>.png`, the hero shown whole, and
 * HOME_SAMPLES - 1 more a quarter of the engraving's breath apart in `m2/samples/`), and the luminance of every home and
 * loader still gated by LUMA_GATE, its floor too: the home's ceiling holds for the worst of its samples. The numbers
 * are printed and kept in results.json.
 */
async function homeLook(browser, step) {
  mkdirSync(join(STILLS, 'samples'), { recursive: true });
  const homes = [];
  for (const size of STILL_SIZES) {
    const at = sizeName(size);
    const { context, page } = await openPage(browser, step, () => false, { width: size.width, height: size.height }, size.options);
    await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
    await page.bringToFront();
    await reachHomeIdle(page);
    const hero = await page.waitForFunction(() => getComputedStyle(document.querySelector('.hero')).opacity === '1', null, { timeout: 5_000 }).then(() => true, () => false);
    await page.evaluate(() => document.fonts.ready);
    // The first still is the home as it landed, the needle setting off on its drift (no pointer has moved); the later
    // samples catch the engraving's breath at its peak and trough.
    await page.waitForTimeout(500);
    step.check(hero, `${at}: landed on the home, the hero shown whole`);
    for (let k = 0; k < HOME_SAMPLES; k++) {
      if (k > 0) await page.waitForTimeout((BREATHE.period * 1000) / HOME_SAMPLES);
      const file = k === 0 ? join(STILLS, `home-${at}.png`) : join(STILLS, 'samples', `home-${at}-${k}.png`);
      await page.screenshot({ path: file });
      homes.push({ file, size: at, kind: 'home' });
    }
    await takeCsp(page, step);
    await context.close();
  }
  // The held home (the last moment) is gated as a home still, the five before it as loader stills.
  const loaders = await takeLoaderStills(browser, step);
  const rows = await gateLuma(browser, step, [...homes, ...loaders]);
  step.luma = rows;
  return `${rows.length} stills measured (${HOME_SAMPLES} home samples a size): ${lumaSummary(rows, 'home')}, ${lumaSummary(rows, 'loader')}, the scene's peak at least ${Math.min(...rows.map((row) => row.peak)).toFixed(3)} (floor ${LUMA_GATE.floor.peak}), clipped at most ${(Math.max(...rows.map((row) => row.clipped)) * 100).toFixed(3)} % (gate ${LUMA_GATE.clipped * 100} %)`;
}

/**
 * Where the needle's pivot is on the screen at home, in CSS pixels: the middle of the viewport. The home shot looks at
 * the compass's centre (src/engine/bob/shots.ts, FRAMES.home and .homePortrait: target (0, 0.55, 0)), and the pivot is
 * the armillary's origin there (COMPASS_LOOK.homeY), so it is where the shot looks; the parallax moves it a few pixels,
 * which does not turn a pointer far to its right off pi/2 by anything the check sees.
 */
const pivotOf = (viewport) => ({ x: viewport.width / 2, y: viewport.height / 2 });

/**
 * The aim (spec §2.2): at 1440x900 once landed, the mouse moved to the right of the pivot, on its row, turns the needle
 * toward it with the spring's slight, heavy delay, to within AIM.tolerance of pi/2 within AIM.within ms
 * (`needleAngle`); a still of it (`m2/aim-right-1440x900.png`), gated as a home still by LUMA_GATE. On a touch phone
 * (390x844), with no cursor, the needle drifts on its own: `needleAngle` changes over 3 s.
 */
const AIM = { tolerance: 0.1, within: 1_500, drift: 3_000 };

async function aim(browser, step) {
  mkdirSync(STILLS, { recursive: true });
  const { context, page } = await openPage(browser, step);
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await page.bringToFront();
  await reachHomeIdle(page);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.hero')).opacity === '1', null, { timeout: 5_000 }).catch(() => {});
  const viewport = page.viewportSize();
  const pivot = pivotOf(viewport);
  const before = (await debugOf(page)).needleAngle;
  const to = { x: Math.round(pivot.x + 0.3 * viewport.width), y: Math.round(pivot.y) };
  await page.mouse.move(to.x, to.y, { steps: 8 });
  const moved = Date.now();
  const trail = [];
  let angle = before;
  while (Date.now() - moved < AIM.within) {
    await page.waitForTimeout(100);
    angle = (await debugOf(page)).needleAngle;
    trail.push(Number(angle.toFixed(3)));
  }
  const off = Math.abs(angle - Math.PI / 2);
  step.check(
    Number.isFinite(angle) && off <= AIM.tolerance,
    `the mouse to the right of the pivot (${to.x}, ${to.y}; pivot at ${pivot.x}, ${pivot.y}): within ${AIM.within / 1000} s the needle points at it, ${angle.toFixed(3)} rad, ${off.toFixed(3)} off pi/2 (at most ${AIM.tolerance}), from ${before.toFixed(3)} (${trail.join(' ')})`,
  );
  step.check(trail.length > 2 && Math.abs(trail[0] - Math.PI / 2) > off, `and it swung there with a delay, not at once (first 100 ms: ${trail[0]}, at ${AIM.within / 1000} s: ${angle.toFixed(3)})`);
  const file = join(STILLS, 'aim-right-1440x900.png');
  await page.screenshot({ path: file });
  await takeCsp(page, step);
  await context.close();

  const phone = STILL_SIZES[1];
  const touch = await openPage(browser, step, () => false, { width: phone.width, height: phone.height }, phone.options);
  await touch.page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await touch.page.bringToFront();
  await reachHomeIdle(touch.page);
  await touch.page.waitForTimeout(300);
  const first = (await debugOf(touch.page)).needleAngle;
  await touch.page.waitForTimeout(AIM.drift);
  const later = (await debugOf(touch.page)).needleAngle;
  step.check(
    Number.isFinite(first) && Number.isFinite(later) && Math.abs(later - first) > 0.05,
    `on a touch phone (${sizeName(phone)}), with no cursor, the needle drifts on its own: ${first.toFixed(3)} rad, then ${later.toFixed(3)} rad ${AIM.drift / 1000} s later`,
  );
  await takeCsp(touch.page, step);
  await touch.context.close();

  const rows = await gateLuma(browser, step, [{ file, kind: 'home' }]);
  step.luma = rows;
  return `the mouse to the right of the pivot turns the needle to ${angle.toFixed(3)} rad (pi/2 is 1.571) within ${AIM.within / 1000} s; on touch it drifts ${first.toFixed(3)} → ${later.toFixed(3)} in ${AIM.drift / 1000} s; ${lumaSummary(rows, 'home')} for the aimed still`;
}

/**
 * Records, from the document's start, what the opening shows every `everyMs` ms until a little after the phase is
 * HOME_IDLE: `window.__loaderSamples` (performance.now() ms, the bridge's loader stage, its seconds and how much of the
 * name is cut, the camera, the phase), when the scene first showed (`window.__readyAt`, `data-ready` on the scene host),
 * when the fallback card first showed (`window.__cardAt`) and when HOME_IDLE came (`window.__idleAt`). A timer, not
 * frames: it asks for no frame of its own.
 */
const watchLoader = (context, everyMs) =>
  context.addInitScript((everyMs) => {
    window.__loaderSamples = [];
    window.__readyAt = null;
    window.__idleAt = null;
    window.__cardAt = null;
    const timer = setInterval(() => {
      const now = performance.now();
      if (window.__readyAt === null && document.querySelector('.scene-host')?.hasAttribute('data-ready')) window.__readyAt = now;
      if (window.__cardAt === null && document.querySelector('.scene-fallback')) window.__cardAt = now;
      if (typeof window.__needleDebug !== 'function') return;
      const { loader, phase, camera } = window.__needleDebug();
      window.__loaderSamples.push({
        t: Math.round(now),
        stage: loader.stage,
        elapsed: loader.elapsed,
        cut: loader.strokes.reduce((sum, share) => sum + share, 0),
        camera: { position: camera.position, fov: camera.fov },
        phase: phase.kind,
      });
      if (phase.kind === 'HOME_IDLE' && window.__idleAt === null) window.__idleAt = now;
      if (window.__idleAt !== null && now - window.__idleAt > 600) clearInterval(timer);
    }, everyMs);
  }, everyMs);

/** What watchLoader recorded, once its own sample has seen HOME_IDLE (it may lag the phase by one interval). */
async function loaderRecord(page) {
  await page.waitForFunction(() => window.__idleAt !== null, null, { timeout: 5_000 });
  return page.evaluate(() => ({ samples: window.__loaderSamples, readyAt: window.__readyAt, idleAt: window.__idleAt }));
}

/** The stages a record went through, in order, each once per run of it; the null before an opening mounts is no stage. */
const stagesOf = (samples) => {
  const stages = [];
  for (const { stage } of samples) if (stage !== null && stage !== stages.at(-1)) stages.push(stage);
  return stages;
};

/** Waits until the opening's clock has run `seconds` (the bridge's `loader.elapsed`), the full show playing. */
const loaderAtLeast = (page, seconds) =>
  page.waitForFunction((s) => (window.__needleDebug?.().loader.elapsed ?? 0) >= s, seconds, { timeout: LOAD_TIMEOUT_MS + 5_000, polling: 20 });

/** How long a skip may take to land, ms: the loader's fast-forward (LOADER.skip, 1 s) and the brief's margin. */
const SKIP_WITHIN_MS = 1_600;

/**
 * The skip (spec §2.1): any click, tap, scroll or key fast-forwards the rest of the full show to the home in about a
 * second, with no button and no text, and the input that skips is used up by the skip. A first visit (nothing stored):
 * a click 3 s into the show (`loader.elapsed`, while it engraves) lands on HOME_IDLE within SKIP_WITHIN_MS. Then the
 * same page reloaded with the seen flag cleared, so the full show plays again: 40 wheel events over 1 s from 3 s in
 * land on the home too, and the story's progress and target stay 0 through the burst and after it, the page
 * unscrolled.
 */
async function loaderSkip(browser, step) {
  const { context, page } = await openPage(browser, step);
  await watchLoader(context, 20);
  await context.addInitScript(() => {
    window.__inputAt = null;
    for (const type of ['pointerdown', 'wheel']) {
      window.addEventListener(type, () => (window.__inputAt ??= performance.now()), { capture: true, passive: true });
    }
  });
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await page.bringToFront();
  await loaderAtLeast(page, 3);
  const at = (await debugOf(page)).loader;
  await page.mouse.click(720, 450);
  const clicked = await reachHomeIdle(page).then(() => true, () => false);
  const record = await loaderRecord(page);
  const inputAt = await page.evaluate(() => window.__inputAt);
  const took = inputAt !== null && record.idleAt !== null ? Math.round(record.idleAt - inputAt) : null;
  step.check(at.stage === 'engrave' && at.elapsed >= 3 && at.elapsed < 3.3, `a first visit plays the full show: 3 s in it engraves (stage ${at.stage} at ${at.elapsed.toFixed(2)} s, cut ${cutOf(at).toFixed(2)} of 5)`);
  step.check(clicked && took !== null && took >= 0 && took <= SKIP_WITHIN_MS, `a click at 3 s lands on HOME_IDLE ${took} ms later (within ${SKIP_WITHIN_MS} ms; the stages ${stagesOf(record.samples).join(' → ')})`);
  await page.waitForTimeout(500);
  const afterClick = await debugOf(page);
  step.check(afterClick.loader.stage === 'home' && cutOf(afterClick.loader) === 5, `and the home stands whole: the five marks cut (got ${afterClick.loader.stage}, cut ${cutOf(afterClick.loader)})`);
  await takeCsp(page, step);

  // The wheel: the full show again (the flag cleared), and a burst from 3 s in.
  await page.evaluate((key) => localStorage.removeItem(key), LOADER_SEEN_KEY);
  await page.reload({ waitUntil: 'load' });
  await loaderAtLeast(page, 3);
  const second = (await debugOf(page)).loader;
  await page.mouse.move(720, 450);
  const progress = [];
  const burstStart = Date.now();
  for (let i = 0; i < 40; i++) {
    await page.mouse.wheel(0, 100);
    await page.waitForTimeout(Math.max(0, burstStart + (i + 1) * 25 - Date.now()));
    if (i % 8 === 7) progress.push((await frameOf(page)).progress);
  }
  const burst = Date.now() - burstStart;
  const landed = await reachHomeIdle(page).then(() => true, () => false);
  const wheelRecord = await loaderRecord(page);
  const wheelAt = await page.evaluate(() => window.__inputAt);
  await page.waitForTimeout(1_500); // a story the burst had moved would be moving by now
  const rest = await frameOf(page);
  progress.push(rest.progress);
  const scrollY = await page.evaluate(() => window.scrollY);
  step.check(second.stage === 'engrave' && second.elapsed >= 3, `reloaded with ${LOADER_SEEN_KEY} cleared, the full show plays again (stage ${second.stage} at ${second.elapsed.toFixed(2)} s)`);
  step.check(
    landed && wheelRecord.idleAt !== null,
    `40 wheel events over ${burst} ms from 3 s in land on the home (HOME_IDLE ${wheelAt === null ? '?' : Math.round(wheelRecord.idleAt - wheelAt)} ms after the first)`,
  );
  step.check(
    progress.every((p) => p === 0) && rest.target === 0 && scrollY === 0,
    `and the burst never scrolls: the story's progress stays 0 through it and after (${progress.join(' ')}), target ${rest.target}, scrollY ${scrollY}`,
  );
  await takeCsp(page, step);
  await context.close();
  return `a click at 3 s lands in ${took} ms; a 40-event wheel burst at 3 s lands with the story at 0 (target ${rest.target}, scrollY ${scrollY})`;
}

/** How late the quick path may land after the load, s: its whole length, QUICK.home, and the brief's margin. */
const QUICK_WITHIN = QUICK.home + 0.5;

/**
 * The quick path (spec §2.1, a later visit): a fresh context plays the full show (it engraves) and, landed, marks the
 * loader seen in this browser (`bob-loader-seen` = 1 in localStorage). Reloaded with the flag set, the opening never
 * engraves (dark until the load, then open, rise, home) and reaches HOME_IDLE within QUICK_WITHIN s of the load: of the
 * first sample past `dark`, which comes at the load (the quick path's spans run from it).
 */
async function quickLoader(browser, step) {
  const { context, page } = await openPage(browser, step);
  await watchLoader(context, 25);
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await page.bringToFront();
  await reachHomeIdle(page);
  const first = stagesOf((await loaderRecord(page)).samples);
  const seen = await page.evaluate((key) => localStorage.getItem(key), LOADER_SEEN_KEY);
  step.check(first.includes('engrave') && seen === '1', `a first visit engraves (${first.join(' → ')}) and, landed, marks the loader seen in this browser (${LOADER_SEEN_KEY} ${seen})`);
  await takeCsp(page, step);

  await page.reload({ waitUntil: 'load' });
  await reachHomeIdle(page);
  const again = await loaderRecord(page);
  const stages = stagesOf(again.samples);
  step.check(stages.length > 0 && !stages.includes('engrave') && stages.at(-1) === 'home', `with ${LOADER_SEEN_KEY} set it never engraves: the quick path (${stages.join(' → ')})`);
  const loadedAt = again.samples.find((sample) => sample.stage !== null && sample.stage !== 'dark')?.t ?? null;
  const took = loadedAt !== null && again.idleAt !== null ? Math.round(again.idleAt - loadedAt) : null;
  step.check(
    took !== null && took >= 0 && took <= QUICK_WITHIN * 1000,
    `and HOME_IDLE comes ${took} ms after the load (the first moment past dark, ${loadedAt} ms), within QUICK.home + 0.5 s = ${QUICK_WITHIN * 1000} ms (ready at ${Math.round(again.readyAt)} ms, HOME_IDLE at ${Math.round(again.idleAt)} ms)`,
  );
  const whole = again.samples.filter((sample) => sample.stage !== null && sample.stage !== 'dark');
  step.check(whole.length > 0 && whole.every((sample) => sample.cut === 5), `the name is engraved whole from the first frame it shows (cut ${[...new Set(whole.map((sample) => sample.cut))].join(' ')} of 5)`);
  await takeCsp(page, step);
  await context.close();
  return `a first visit: ${first.join(' → ')}; with the flag: ${stages.join(' → ')}, HOME_IDLE ${took} ms after the load (limit ${QUICK_WITHIN * 1000})`;
}

/** Two camera samples are the same shot: position and field of view, to a millionth. */
const sameShot = (a, b) => a.fov > 0 && Math.abs(a.fov - b.fov) < 1e-6 && a.position.every((value, i) => Math.abs(value - b.position[i]) < 1e-6);

/**
 * Reduced motion (spec §2.1: the engraved name and the compass fade in within about a second): the opening never
 * engraves (dark until the load, the fade, home), the name is whole whenever it shows, the camera is the home shot
 * throughout (three samples identical: the first with a camera once the opening shows, one half way, and the landed
 * home), and the fade marks nothing seen (a later visit is one after the full show has played).
 */
async function loaderReduced(browser, step) {
  const { context, page } = await openPage(browser, step, () => false, { width: 1440, height: 900 }, { reducedMotion: 'reduce' });
  await watchLoader(context, 50);
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await page.bringToFront();
  step.check(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), 'the page asks for reduced motion');
  await reachHomeIdle(page);
  await page.waitForTimeout(700); // the watcher's last samples, of the landed home
  const { samples, readyAt } = await page.evaluate(() => ({ samples: window.__loaderSamples, readyAt: window.__readyAt }));
  const stages = stagesOf(samples);
  step.check(!stages.includes('engrave') && !stages.includes('open') && stages.at(-1) === 'home', `the opening never engraves: ${stages.join(' → ')} over ${samples.length} samples`);
  const shown = samples.filter((sample) => sample.stage !== null && sample.stage !== 'dark');
  step.check(shown.length > 0 && shown.every((sample) => sample.cut === 5), `the name is whole whenever it shows (cut ${[...new Set(shown.map((sample) => sample.cut))].join(' ')} of 5)`);
  // From the moment the canvas shows (data-ready): before it, the Stage's camera stands where three made it, unseen.
  const framed = samples.filter((sample) => readyAt !== null && sample.t > readyAt && sample.stage !== null && sample.camera.fov > 0);
  const three = framed.length >= 3 ? [framed[0], framed[Math.floor(framed.length / 2)], framed.at(-1)] : framed;
  step.check(
    three.length === 3 && three.every((sample) => sameShot(sample.camera, three[0].camera)),
    `once the canvas shows (${Math.round(readyAt)} ms), the camera shot is the same in three samples (${three.map((sample) => `${sample.stage} at ${sample.t} ms: [${sample.camera.position.map((v) => v.toFixed(3)).join(', ')}] fov ${sample.camera.fov.toFixed(2)}`).join('; ')})`,
  );
  const seen = await page.evaluate((key) => localStorage.getItem(key), LOADER_SEEN_KEY);
  step.check(seen === null, `the reduced fade marks nothing seen (${LOADER_SEEN_KEY} ${seen})`);
  await takeCsp(page, step);
  await context.close();
  return `${stages.join(' → ')} over ${samples.length} samples, the camera still across ${three.length} samples, nothing marked seen`;
}

/**
 * When the card must show, s from the page's start: the loader's give-up (LOADER.giveUp, 25 visible seconds of its own
 * clock, which starts once the scene is built, under a second in) and two seconds more.
 */
const GIVE_UP_WINDOW = [LOADER.giveUp, LOADER.giveUp + 2];

/**
 * Giving up (spec §2.1): the compass's file (/models/bob-compass.glb) never answers, so the home never loads. On /en/,
 * the fallback card ("THE NEEDLE LOST NORTH", the English copy's title) with its link to Lite shows between 25 and 27 s
 * after the page started (performance.now(), the document's own clock), not before; the time from the scene's
 * data-ready (the loader showing) is reported beside it. SceneHost's report of the give-up is a warning, not an error.
 */
async function giveUp(browser, step) {
  const { t } = new Translator('en');
  const { context, page } = await openPage(browser, step);
  await watchLoader(context, 25);
  let asked = 0;
  await page.route('**/models/bob-compass.glb', () => {
    asked++; // never answered
  });
  await page.goto(`${BASE}/en/?proof`, { waitUntil: 'load' });
  await page.bringToFront();
  const card = await page.waitForSelector('.scene-fallback', { timeout: (GIVE_UP_WINDOW[1] + 15) * 1000 }).then(() => true, () => false);
  await page.waitForFunction(() => window.__cardAt !== null, null, { timeout: 2_000 }).catch(() => {});
  const timing = await page.evaluate(() => ({ readyAt: window.__readyAt, cardAt: window.__cardAt }));
  const at = timing.cardAt !== null ? timing.cardAt / 1000 : null;
  const afterReady = timing.readyAt !== null && at !== null ? at - timing.readyAt / 1000 : null;
  const state = await page.evaluate(() => ({
    title: document.querySelector('.scene-fallback-title')?.textContent ?? null,
    link: document.querySelector('.scene-fallback a')?.getAttribute('href') ?? null,
    canvases: document.querySelectorAll('canvas').length,
    phase: window.__needleDebug?.().phase.kind ?? null,
  }));
  step.check(asked >= 1, `the page asked for the compass's file and got no answer (${asked} requests)`);
  step.check(
    card && at !== null && at >= GIVE_UP_WINDOW[0] && at <= GIVE_UP_WINDOW[1],
    `the fallback card shows ${at?.toFixed(2)} s after the page started, between ${GIVE_UP_WINDOW[0]} and ${GIVE_UP_WINDOW[1]} s (${afterReady?.toFixed(2)} s after the loader showed, at ${Math.round(timing.readyAt)} ms)`,
  );
  step.check(state.title === t.needle.fallback.title && state.link === '/en/lite/', `it says "${t.needle.fallback.title}", with Lite one link away (got "${state.title}", ${state.link})`);
  step.check(state.canvases === 0 && state.phase === 'HOME_IDLE', `no canvas is left, and the page is out of LOADING (${state.canvases} canvas, ${state.phase})`);
  await takeCsp(page, step);
  await context.close();
  return `the file never answers: "${state.title}" ${at?.toFixed(2)} s after the page started, ${afterReady?.toFixed(2)} s after the loader showed (window ${GIVE_UP_WINDOW.join('-')} s)`;
}

/**
 * Landed and left alone, with no input at all, the canvas runs the home's idle motion and then draws nothing: no
 * requestAnimationFrame of the page's for a whole second, within DRIFT_RUN + SLEEP_WITHIN_MS of the landing. With no
 * pointer moved the needle is on its drift, which runs on past the idle while to its next rest (DRIFT_RUN, 14 s), so the
 * canvas must not fall quiet before DRIFT_RUN - 2 s.
 */
async function sleep(browser, step) {
  const { context, page } = await openPage(browser, step);
  await countAllFrames(context);
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await page.bringToFront();
  await reachHomeIdle(page);
  const limit = DRIFT_RUN * 1000 + SLEEP_WITHIN_MS;
  const slept = await sleepWithin(page, limit);
  step.check(slept !== null, `landed and left alone, the canvas draws nothing for a whole second from ${slept} ms after the landing (within DRIFT_RUN + SLEEP_WITHIN_MS = ${limit} ms)`);
  step.check(slept !== null && slept >= (DRIFT_RUN - 2) * 1000, `and it ran the drift on to its rest first: it fell quiet ${slept} ms after the landing (the drift rests at ${DRIFT_RUN} s)`);
  await takeCsp(page, step);
  await context.close();
  return `the idle motion and the drift ran to the drift's rest, then the canvas slept ${slept} ms after the landing (limit ${limit} ms)`;
}

/** The entry chunk of the client bundle: without it the page never hydrates. */
const ENTRY_CHUNK = /\/assets\/entry\.client-[^/]+\.js$/;

/**
 * Records the hero every 50 ms from the document's start in `window.__heroSamples`: performance.now() ms, its computed
 * opacity and the header's (`header`, which goes and comes with it on the home page), the page's `data-route` (set once
 * it hydrates) and the phase where the bridge answers.
 */
const watchHero = (context) =>
  context.addInitScript(() => {
    window.__heroSamples = [];
    setInterval(() => {
      const hero = document.querySelector('.hero');
      const header = document.querySelector('.site-header');
      if (!hero || !header) return;
      window.__heroSamples.push({
        t: Math.round(performance.now()),
        opacity: Number(getComputedStyle(hero).opacity),
        header: Number(getComputedStyle(header).opacity),
        route: document.documentElement.getAttribute('data-route'),
        phase: window.__needleDebug?.().phase.kind ?? null,
      });
    }, 50);
  });

/** Whether watchHero has recorded the hero and the header whole (opacity 1) within `timeout` ms: read from its samples, not the live style, which they may lag. */
const heroWhole = (page, timeout) =>
  page.waitForFunction(() => window.__heroSamples.some((sample) => sample.opacity === 1 && sample.header === 1), null, { timeout, polling: 100 }).then(() => true, () => false);

/**
 * The hero's CSS fail-safe (Ruling 9a), and the header's with it. With JavaScript on but the entry chunk refused (the
 * route aborts it), the page never hydrates: the hero and the header are hidden (scripting is on, so the page waits for
 * the bundle) and then shown by the fail-safe, 8 s in, faded in over 0.9 s. The step expects the browser's report of
 * the refused chunk and of the failed import, and nothing else. With the page working, the hero and the header stay
 * hidden until the phase is HOME_IDLE (the opening has landed: the loader has no text but the engraving) and then show.
 */
async function heroFailsafe(browser, step) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__cspViolations.push({ directive: e.violatedDirective, blocked: e.blockedURI, sample: e.sample });
    });
  });
  await watchHero(context);
  const page = await context.newPage();
  const reports = { load: 0, import: 0 };
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const refused = message.text() === 'Failed to load resource: net::ERR_FAILED' && ENTRY_CHUNK.test(message.location().url ?? '');
    if (refused) reports.load++;
    (refused ? step.expected : step.errors).push(message.text());
  });
  page.on('pageerror', (error) => {
    const failed = /^Failed to fetch dynamically imported module: \S*\/assets\/entry\.client-/.test(error.message);
    if (failed) reports.import++;
    (failed ? step.expected : step.errors).push(error.message);
  });
  let refused = 0;
  await page.route(ENTRY_CHUNK, (route) => {
    refused++;
    return route.abort();
  });
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  const shown = await heroWhole(page, 12_000);
  const broken = await page.evaluate(() => ({ samples: window.__heroSamples, name: document.querySelector('.hero h1')?.textContent ?? null }));
  const firstShown = broken.samples.find((sample) => sample.opacity > 0)?.t ?? null;
  const whole = broken.samples.find((sample) => sample.opacity === 1)?.t ?? null;
  const headerFirst = broken.samples.find((sample) => sample.header > 0)?.t ?? null;
  const headerWhole = broken.samples.find((sample) => sample.header === 1)?.t ?? null;
  step.check(refused >= 1 && broken.samples.length > 0 && broken.samples.every((sample) => sample.route === null), `the entry chunk refused (${refused} requests): the page never hydrates (no data-route in ${broken.samples.length} samples)`);
  step.check(reports.load >= 1 && reports.import === 1, `the browser reports the refused chunk and the failed import, and nothing else (${reports.load} "Failed to load resource", ${reports.import} failed import)`);
  step.check(firstShown !== null && firstShown >= 7_900, `the hero stays hidden until the fail-safe, about 8 s in: first shown at ${firstShown} ms`);
  step.check(shown && whole !== null && whole <= 10_500 && broken.name === HOME_H1, `then it shows, whole at ${whole} ms (8 s and a 0.9 s fade), "${broken.name}"`);
  step.check(
    headerFirst !== null && headerFirst >= 7_900 && headerWhole !== null && headerWhole <= 10_500,
    `the header goes with it: hidden until the fail-safe (first shown at ${headerFirst} ms), then whole at ${headerWhole} ms`,
  );
  await takeCsp(page, step);
  await context.close();

  // Working: the hero and the header wait for the landing.
  const working = await openPage(browser, step);
  await watchHero(working.context);
  await working.page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await working.page.bringToFront();
  await reachHomeIdle(working.page);
  const appears = await heroWhole(working.page, 3_000);
  const { samples } = await working.page.evaluate(() => ({ samples: window.__heroSamples }));
  const before = samples.filter((sample) => sample.phase !== 'HOME_IDLE');
  const idleAt = samples.find((sample) => sample.phase === 'HOME_IDLE')?.t ?? null;
  const wholeAt = samples.find((sample) => sample.opacity === 1)?.t ?? null;
  const headerAt = samples.find((sample) => sample.header === 1)?.t ?? null;
  const peeked = before.filter((sample) => sample.opacity > 0);
  const headerPeeked = before.filter((sample) => sample.header > 0);
  step.check(before.length > 10 && peeked.length === 0, `working, the hero is hidden until HOME_IDLE: ${before.length} samples before it (from the first paint, through hydration and the opening), ${peeked.length} with the hero showing (${JSON.stringify(peeked.slice(0, 2))})`);
  step.check(appears && idleAt !== null && wholeAt !== null && wholeAt - idleAt <= 1_500, `and it shows once landed: HOME_IDLE at ${idleAt} ms, the hero whole at ${wholeAt} ms`);
  step.check(
    headerPeeked.length === 0 && headerAt !== null && idleAt !== null && headerAt - idleAt <= 1_500,
    `the header too: the loader shows no text but the engraving (${headerPeeked.length} of ${before.length} samples before HOME_IDLE with the header showing), and it is whole at ${headerAt} ms`,
  );
  await takeCsp(working.page, step);
  await working.context.close();
  return `entry chunk refused: the hero and the header hidden, then shown by the fail-safe at ${firstShown} / ${headerFirst} ms (whole at ${whole} / ${headerWhole} ms); working: both hidden until HOME_IDLE (${idleAt} ms), whole at ${wholeAt} / ${headerAt} ms`;
}

// ---------------------------------------------------------------- the debug bridge, the keyboard, a language switch, reduced motion

/** Every proof hook the site has had; today the bridge is the only one. */
const HOOK_NAMES = ['__needleDebug', '__needleScene', '__needleFrame', '__needleMounts', '__needleScrollRequest'];
/** The fields of the bridge's state (src/debug/needleDebug.ts, NeedleDebugState), sorted. */
const STATE_KEYS = ['camera', 'canvasMounts', 'chapter', 'contextLost', 'dpr', 'fps', 'loader', 'locale', 'needleAngle', 'phase', 'progress', 'route', 'target', 'threeD', 'tier', 'velocity'];
/** The last chapter of the home scroll, and the place its story ends. */
const LAST_UNIT = HOME_CHAPTERS.units.length - 1;
const STORY_END = HOME_CHAPTERS.total;
const LAST_CATEGORY = HOME_CHAPTERS.units[LAST_UNIT].category;

/**
 * The debug bridge exists under `?proof` and nowhere else. Without it, nothing of the site reads or writes a proof hook,
 * not even through the opening's landing and a scroll gesture's frames (every hook the site has had is trapped on the
 * window, and a gesture and a pause go by); with it, the state has every field and the actions act: `.set` puts the
 * story somewhere, `.dispatch` sends an event, and the old hooks are gone.
 */
async function bridge(browser, step) {
  // No ?proof: a trap on every hook name records any read or write of it.
  {
    const { context, page } = await openPage(browser, step);
    await context.addInitScript((names) => {
      window.__touched = [];
      for (const name of names) {
        Object.defineProperty(window, name, {
          configurable: true,
          get() {
            window.__touched.push(`get ${name}`);
            return undefined;
          },
          set() {
            window.__touched.push(`set ${name}`);
          },
        });
      }
    }, HOOK_NAMES);
    await page.goto(`${BASE}/`, { waitUntil: 'load' });
    // The wheel moves the story from HOME_IDLE on, not while the opening plays. With no bridge to read the phase, the
    // page says it: the scene shows (data-ready) and <html data-loading> (set while the phase is LOADING) is gone.
    const landedAt = await page
      .waitForFunction(
        () => document.querySelector('.scene-host')?.hasAttribute('data-ready') && document.documentElement.hasAttribute('data-route') && !document.documentElement.hasAttribute('data-loading'),
        null,
        { timeout: LANDED_WITHIN_MS },
      )
      .then(() => true, () => false);
    step.check(landedAt, 'without ?proof the opening lands: the scene shows and the page is no longer data-loading');
    await page.evaluate(() => {
      window.__wheels = [];
      window.addEventListener('wheel', (event) => window.__wheels.push(event.defaultPrevented), { passive: true });
    });
    await page.mouse.move(720, 450);
    for (let i = 0; i < 10; i++) {
      await page.mouse.wheel(0, 120);
      await page.waitForTimeout(16);
    }
    await page.waitForTimeout(1_500); // the glide and the damping run their frames
    const wheels = await page.evaluate(() => window.__wheels);
    step.check(wheels.length === 10 && wheels.every(Boolean), 'without ?proof the scroll loop still runs: the wheel is taken (10 of 10 prevented)');
    const touched = await page.evaluate(() => window.__touched);
    step.check(touched.length === 0, `without ?proof nothing of the site reads or writes a proof hook, through load, a scene, a wheel gesture and its frames (touched: ${touched.join(', ') || 'nothing'})`);
    await takeCsp(page, step);
    await context.close();
  }

  // ?proof: the bridge, the state, the actions.
  const { context, page } = await openPage(browser, step);
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await stageReady(page);
  await reachHomeIdle(page);
  await page.waitForFunction(() => document.querySelector('.scene-host')?.hasAttribute('data-ready'), null, { timeout: LOAD_TIMEOUT_MS + 3_000 });
  const old = await page.evaluate((names) => names.filter((name) => name !== '__needleDebug' && name in window), HOOK_NAMES);
  step.check(old.length === 0, `with ?proof the old hooks are gone (found: ${old.join(', ') || 'none'})`);
  const shape = await page.evaluate(() => ({
    isFunction: typeof window.__needleDebug === 'function',
    actions: [typeof window.__needleDebug.set, typeof window.__needleDebug.dispatch, typeof window.__needleDebug.seekLoader, typeof window.__needleDebug.scrollRequest],
  }));
  step.check(shape.isFunction && shape.actions.join() === 'function,function,function,function', `window.__needleDebug is a function with .set, .dispatch, .seekLoader and .scrollRequest (got ${JSON.stringify(shape)})`);

  const at = await debugOf(page);
  step.check(JSON.stringify(Object.keys(at).sort()) === JSON.stringify(STATE_KEYS), `its state has exactly these fields: ${STATE_KEYS.join(', ')} (got ${Object.keys(at).sort().join(', ')})`);
  step.check(at.phase.kind === 'HOME_IDLE' && at.progress === 0 && at.target === 0 && at.velocity === 0, `on / at rest: HOME_IDLE, progress 0, target 0, velocity 0 (got ${JSON.stringify([at.phase, at.progress, at.target, at.velocity])})`);
  step.check(JSON.stringify(at.chapter) === JSON.stringify({ index: 0, id: 'HOME', local: 0, category: null }), `the chapter is HOME, index 0, local 0 (got ${JSON.stringify(at.chapter)})`);
  step.check(at.route === 'home' && at.locale === 'nl' && at.threeD === true && at.contextLost === false && at.canvasMounts === 1, `route home, locale nl, 3D on, context there, one Stage (got ${JSON.stringify([at.route, at.locale, at.threeD, at.contextLost, at.canvasMounts])})`);
  step.check(['high', 'medium', 'low'].includes(at.tier) && at.dpr >= 1 && at.camera.fov > 0 && at.camera.position.length === 3, `a tier, a pixel ratio and a camera from the Stage (got ${at.tier}, dpr ${at.dpr}, ${JSON.stringify(at.camera)})`);
  step.check(
    at.loader.stage === 'home' && at.loader.strokes.length === 5 && at.loader.strokes.every((share) => share === 1) && at.loader.elapsed > 0,
    `landed, the opening stands at home with the five marks (two B letters, their bars, the circle) cut whole (got ${JSON.stringify(at.loader)})`,
  );
  step.check(Number.isFinite(at.needleAngle) && Math.abs(at.needleAngle) <= Math.PI * 2, `the needle's angle is reported, in radians (got ${at.needleAngle})`);

  // .set puts the story somewhere at once: progress and target there, nothing moving, the chapter and the phase with it.
  await page.evaluate(() => window.__needleDebug.set({ progress: 2.5 }));
  const mid = await debugOf(page);
  step.check(mid.progress === 2.5 && mid.target === 2.5 && mid.velocity === 0 && mid.chapter.index === 1 && mid.chapter.id === 'DISSECT' && mid.phase.kind === 'DISSECT', `.set({ progress: 2.5 }) puts the story in DISSECT at 2.5 (got ${JSON.stringify([mid.progress, mid.target, mid.chapter, mid.phase])})`);
  step.check(near(mid.chapter.local, (2.5 - 1) / 11, 1e-9), `and the chapter's local is how far through it (got ${mid.chapter.local})`);
  await page.evaluate(() => window.__needleDebug.set({ progress: 999 }));
  const end = await debugOf(page);
  step.check(end.target === STORY_END && end.chapter.index === LAST_UNIT && end.phase.kind === 'PROJECTS' && end.phase.category === LAST_CATEGORY, `.set past the end stops at the end, in the last chapter (got ${JSON.stringify([end.target, end.chapter.index, end.phase])})`);
  await page.evaluate(() => window.__needleDebug.set({ progress: 0 }));
  const start = await debugOf(page);
  step.check(start.target === 0 && start.chapter.index === 0 && start.phase.kind === 'HOME_IDLE', `.set({ progress: 0 }) is the start again (got ${JSON.stringify([start.target, start.chapter.index, start.phase])})`);

  // .dispatch sends a scene event, as the app's own parts do; the phase is the store's own object. A project opens from
  // the projects chapter, the end of the story.
  await page.evaluate(() => window.__needleDebug.set({ progress: 999 }));
  await page.evaluate(() => window.__needleDebug.dispatch({ type: 'OPEN_PROJECT', id: 'funcial' }));
  const focus = await debugOf(page);
  step.check(focus.phase.kind === 'PROJECT_FOCUS' && focus.phase.id === 'funcial', `.dispatch({ type: 'OPEN_PROJECT', id: 'funcial' }) from the projects focuses Funcial (got ${JSON.stringify(focus.phase)})`);
  step.check(await page.evaluate(() => window.__needleDebug().phase === window.__needleDebug().phase), 'two reads of the phase are the same object while nothing changed');
  await page.evaluate(() => window.__needleDebug.dispatch({ type: 'BACK' }));
  const back = (await debugOf(page)).phase;
  step.check(back.kind === 'PROJECTS' && back.category === null, `.dispatch({ type: BACK }) goes back to the projects (got ${JSON.stringify(back)})`);
  await page.evaluate(() => window.__needleDebug.set({ progress: 0 }));
  step.check((await debugOf(page)).phase.kind === 'HOME_IDLE', 'and .set({ progress: 0 }) is the home again');

  // The scroll loop's frames go through .scrollRequest: wrapped, the wrapper sees them.
  await watchFrames(page);
  await page.mouse.move(720, 450);
  await page.mouse.wheel(0, 120);
  await restAt(page);
  const frames = await takeFrames(page);
  step.check(frames.requests > 0 && frames.most === 1, `a wheel's frames are asked for through .scrollRequest, one at a time (${frames.requests} asked for, at most ${frames.most} callback in one frame)`);
  await page.keyboard.press('Home');
  await restAt(page);

  // The language is the page's.
  await page.click('a[href="/en/"]');
  await page.waitForFunction(() => document.documentElement.lang === 'en', null, { timeout: 5_000 });
  const en = await debugOf(page);
  step.check(en.locale === 'en' && en.route === 'home' && en.canvasMounts === 1, `after the language switch: locale en, route home, still one Stage (got ${JSON.stringify([en.locale, en.route, en.canvasMounts])})`);
  await takeCsp(page, step);
  await context.close();
  return 'no bridge and no hook touched without ?proof; with it the state has every field, .set and .dispatch act, the loop asks its frames through .scrollRequest';
}

/**
 * The keyboard on the home page with 3D on: Tab from the top reaches the skip link, then the header in its order (the
 * name, Work, About, Contact, the language switch, Lite and the 3D toggle), the language switch and the toggle each with a
 * visible focus ring on screen, and Shift+Tab goes back; End goes to the last
 * chapter (the end of the story, the last project category) and Home returns to the start, both from a focused control.
 */
async function keyboard(browser, step) {
  const { context, page } = await openPage(browser, step);
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await stageReady(page);
  await reachHomeIdle(page);

  const focused = () =>
    page.evaluate(() => {
      const element = document.activeElement;
      const style = getComputedStyle(element);
      const { top, bottom, left, right } = element.getBoundingClientRect();
      return {
        tag: element.tagName,
        href: element.getAttribute('href'),
        role: element.getAttribute('role'),
        hreflang: element.getAttribute('hreflang'),
        ring: style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2,
        onScreen: top >= 0 && left >= 0 && bottom <= window.innerHeight && right <= window.innerWidth && bottom > top,
      };
    });
  const isLang = (control) => control.tag === 'A' && control.hreflang === 'en';
  const isToggle = (control) => control.role === 'switch';

  const reached = [];
  for (let press = 0; press < 12; press++) {
    await page.keyboard.press('Tab');
    reached.push(await focused());
    if (isToggle(reached.at(-1))) break;
  }
  const langAt = reached.findIndex(isLang);
  const toggleAt = reached.findIndex(isToggle);
  step.check(reached[0]?.href === '#main', `the first Tab lands on the skip link (got ${JSON.stringify(reached[0])})`);
  step.check(langAt > 0 && toggleAt > langAt, `Tab reaches the language switch and then the 3D toggle (language switch at press ${langAt + 1}, toggle at press ${toggleAt + 1} of ${reached.length})`);
  // The header's order (spec §2.2): the name, then Work, About and Contact, the language switch, Lite, the 3D switch.
  const order = reached.map((control) => (isToggle(control) ? '3D' : isLang(control) ? 'EN' : control.href));
  const HEADER_ORDER = ['#main', '/', '/lite/#work', '/lite/#about', '/contact/', 'EN', '/lite/', '3D'];
  step.check(JSON.stringify(order) === JSON.stringify(HEADER_ORDER), `Tab goes through the header in its order: ${HEADER_ORDER.join(', ')} (got ${order.join(', ')})`);
  for (const [name, control] of [['the language switch', reached[langAt]], ['the 3D toggle', reached[toggleAt]]]) {
    step.check(control?.ring && control.onScreen, `${name} shows a focus ring (outline 2px or more) and is on screen when focused (got ${JSON.stringify(control)})`);
  }
  // The language switch shows "EN" and its name begins with it (WCAG 2.5.3, label in name).
  const lang = page.locator('.header-nav a[hreflang="en"]');
  const langName = await lang.getAttribute('aria-label');
  step.check(
    (await lang.textContent()) === 'EN' && /^EN – \S/.test(langName ?? '') && (await page.getByRole('link', { name: langName ?? '', exact: true }).count()) === 1,
    `the language switch shows "EN" and is named "${langName}", which begins with it`,
  );
  await page.keyboard.press('Shift+Tab');
  step.check((await focused()).href === '/lite/', 'Shift+Tab from the 3D toggle goes back to the Lite link before it');
  await page.keyboard.press('Shift+Tab');
  step.check(isLang(await focused()), 'and once more to the language switch');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  step.check(isToggle(await focused()), 'and Tab to the toggle again');

  // End and Home work from a focused control: a button keeps Space and Enter, not these.
  await page.keyboard.press('End');
  const last = await restAt(page);
  step.check(last.target === STORY_END && last.progress === STORY_END && last.chapterIndex === LAST_UNIT, `End jumps to the last chapter: the end of the story, ${STORY_END}, chapter ${LAST_UNIT} (got ${JSON.stringify(last)})`);
  await waitForPhase(page, 'PROJECTS');
  const atEnd = await debugOf(page);
  step.check(atEnd.chapter.id === 'PROJECTS' && atEnd.chapter.category === LAST_CATEGORY && atEnd.phase.category === LAST_CATEGORY, `and it is the last project category, ${LAST_CATEGORY} (got ${JSON.stringify([atEnd.chapter, atEnd.phase])})`);
  step.check(isToggle(await focused()), 'with the focus still on the 3D toggle');
  await page.keyboard.press('Home');
  const first = await restAt(page);
  step.check(first.target === 0 && first.progress === 0 && first.chapterIndex === 0, `Home returns to the start (got ${JSON.stringify(first)})`);
  await waitForPhase(page, 'HOME_IDLE');
  const atStart = await debugOf(page);
  step.check(atStart.chapter.id === 'HOME' && atStart.phase.kind === 'HOME_IDLE', `and to HOME, HOME_IDLE (got ${JSON.stringify([atStart.chapter, atStart.phase])})`);
  await takeCsp(page, step);
  await context.close();
  return `Tab: skip link, language switch (press ${langAt + 1}), 3D toggle (press ${toggleAt + 1}), each ringed and on screen; End goes to ${STORY_END} (${LAST_CATEGORY}), Home back to 0`;
}

/**
 * A language switch is not a step in the story: on /projects/funcial/ the phase is PROJECT_FOCUS funcial, and after a
 * client-side switch to /en/projects/funcial/ (and back) it is still PROJECT_FOCUS funcial, the very same state with no new
 * transition, in the other language, with the one canvas still the one Stage. The same on another project page.
 */
async function langKeepsPhase(browser, step) {
  const { context, page } = await openPage(browser, step);
  const documents = [];
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url());
  });
  const summary = [];

  for (const { path, other, route, phase, label } of [
    { path: '/projects/funcial/', other: '/en/projects/funcial/', route: 'project', phase: { kind: 'PROJECT_FOCUS', id: 'funcial' }, label: 'PROJECT_FOCUS funcial' },
    { path: '/projects/cookies-clicker/', other: '/en/projects/cookies-clicker/', route: 'project', phase: { kind: 'PROJECT_FOCUS', id: 'cookies-clicker' }, label: 'PROJECT_FOCUS cookies-clicker' },
  ]) {
    await page.goto(`${BASE}${path}?proof`, { waitUntil: 'load' });
    await stageReady(page);
    await page.evaluate(() => {
      document.querySelector('.scene-host canvas').dataset.id = 'lang-canvas';
    });
    documents.length = 0;
    await waitForProject(page, phase.id);
    const sameAs = (state) => state.phase.kind === phase.kind && state.phase.id === phase.id;
    const dutch = await debugOf(page);
    step.check(sameAs(dutch) && dutch.locale === 'nl' && dutch.route === route && dutch.canvasMounts === 1, `${path}: the phase is ${label}, locale nl, route ${route}, one Stage (got ${JSON.stringify([dutch.phase, dutch.locale, dutch.route, dutch.canvasMounts])})`);
    await page.evaluate(() => {
      window.__keptPhase = window.__needleDebug().phase;
    });

    for (const [to, lang] of [[other, 'en'], [path, 'nl']]) {
      await page.click(`.header-nav a[hreflang="${lang}"]`);
      await page.waitForFunction(([to, lang]) => location.pathname === to && document.documentElement.lang === lang, [to, lang], { timeout: 5_000 });
      await page.waitForTimeout(250); // a sync that wrongly moved the phase would have by now
      const now = await debugOf(page);
      const same = await page.evaluate(() => window.__needleDebug().phase === window.__keptPhase);
      const canvas = await page.evaluate(() => ({ canvases: document.querySelectorAll('canvas').length, tag: document.querySelector('.scene-host canvas')?.dataset.id ?? null }));
      step.check(sameAs(now) && same, `after the client-side switch to ${to}: the phase is still ${label}, the very same state with no new transition (got ${JSON.stringify(now.phase)}, same object ${same})`);
      step.check(now.locale === lang && now.route === route, `and the bridge says locale ${lang}, route ${route} (got ${now.locale}, ${now.route})`);
      step.check(now.canvasMounts === 1 && canvas.canvases === 1 && canvas.tag === 'lang-canvas', `and canvasMounts is 1, the same <canvas> (got ${now.canvasMounts} mounts, ${canvas.canvases} canvas, tag ${canvas.tag})`);
    }
    step.check(documents.length === 0, `${path}: switching language and back is client navigation, no document load (got ${documents.join(', ') || 'none'})`);
    summary.push(label);
    await takeCsp(page, step);
  }
  await context.close();
  return `${summary.join(' and ')} survive a switch to English and back: the same phase, one Stage, one canvas`;
}

/**
 * With `prefers-reduced-motion: reduce` (emulated before the page loads) a wheel event is a step, not a distance: one
 * event moves `target` to exactly the next stop, down through every stop of the story to its end, and one event up goes back
 * through them; the story arrives at each, and the chapter and phase are those of the stop.
 */
async function reducedMotion(browser, step) {
  const { context, page } = await openPage(browser, step);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await stageReady(page);
  step.check(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), 'the page asks for reduced motion');
  await reachHomeIdle(page);
  await page.mouse.move(720, 450);

  const places = stops(HOME_CHAPTERS); // 0, 1, 12, 14, 15, 16, 17, 18
  step.check(JSON.stringify(places) === '[0,1,12,14,15,16,17,18]', `the story's stops are as the plan has them (got ${JSON.stringify(places)})`);
  const arrive = async (stop, how) => {
    const rested = await restAt(page);
    const at = await debugOf(page);
    const unit = chapterAt(HOME_CHAPTERS, stop);
    step.check(
      rested.progress === stop && at.chapter.index === unit.index && at.chapter.id === unit.id && at.chapter.category === unit.category,
      `${how}: the story arrives at ${stop}, in chapter ${unit.index} (${unit.id}) (got progress ${rested.progress}, chapter ${JSON.stringify(at.chapter)})`,
    );
  };

  for (const stop of places.slice(1)) {
    await page.mouse.wheel(0, 40); // one event
    const target = (await frameOf(page)).target;
    step.check(target === stop, `one wheel event down moves the target to exactly the next stop, ${stop} (got ${target})`);
    await arrive(stop, 'down');
    await page.waitForTimeout(300); // the next event is the next gesture
  }
  await page.mouse.wheel(0, 40);
  step.check((await frameOf(page)).target === STORY_END, 'and one more at the end stays at the end');
  await page.waitForTimeout(300);
  for (const stop of places.slice(0, -1).reverse()) {
    await page.mouse.wheel(0, -40);
    const target = (await frameOf(page)).target;
    step.check(target === stop, `one wheel event up moves the target to exactly the previous stop, ${stop} (got ${target})`);
    await arrive(stop, 'up');
    await page.waitForTimeout(300);
  }
  await page.mouse.wheel(0, -40);
  step.check((await frameOf(page)).target === 0, 'and one more at the start stays at the start');
  await expectPhase(page, step, 'HOME_IDLE', 'and the phase is HOME_IDLE again');
  await takeCsp(page, step);
  await context.close();
  return `one wheel event a stop: ${places.join(', ')} down and back up, each arrived at`;
}

const STEPS = {
  routes,
  slash,
  bridge,
  persist,
  'lang-keeps-phase': langKeepsPhase,
  'not-found': notFound,
  'case-variant': caseVariant,
  'home-nav': homeNav,
  mobile,
  esc,
  'nav-focus': navFocus,
  lite,
  scroll,
  keyboard,
  'reduced-motion': reducedMotion,
  loaded,
  'no-scene': noScene,
  'no-webgl': noWebgl,
  fps,
  background,
  'title-ij': titleIj,
  stills,
  'loader-stills': loaderStills,
  'loader-skip': loaderSkip,
  'quick-loader': quickLoader,
  'loader-reduced': loaderReduced,
  'give-up': giveUp,
  'home-look': homeLook,
  aim,
  sleep,
  'hero-failsafe': heroFailsafe,
  'load-throw': loadThrow,
  'csp-enforced': cspEnforced,
};

// ---------------------------------------------------------------- run

const wanted = (process.env.STEPS ?? Object.keys(STEPS).join(','))
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const unknown = wanted.filter((id) => !(id in STEPS));
if (wanted.length === 0 || unknown.length > 0) {
  console.error(`STEPS must name one or more of ${Object.keys(STEPS).join(', ')} (unknown: ${unknown.join(', ') || 'none given'})`);
  process.exit(1);
}

/** A thrown error as one line: its message, and the system error under it (`fetch failed (ECONNREFUSED)`). */
const reasonOf = (error) => {
  const cause = error?.cause?.code ?? error?.cause?.message;
  return `${String(error?.message ?? error).split('\n')[0]}${cause ? ` (${cause})` : ''}`;
};

/** Writes results.json, whatever ran: the steps, or the setup failure that stopped them. */
function writeResults(results) {
  writeFileSync(
    join(OUT, 'results.json'),
    JSON.stringify(
      {
        base: BASE,
        ranAt: new Date().toISOString(),
        pages: PAGES.map((p) => p.path),
        skipped: SKIPPED,
        steps: results.map(({ id, pass, checks, errors, expected, csp, seconds, fps, rollingFps, quality, luma }) => ({
          id,
          pass,
          seconds,
          ...(fps === undefined ? {} : { fps, rollingFps, quality }),
          ...(luma === undefined ? {} : { luma }),
          checks,
          errors,
          expected,
          csp,
        })),
      },
      null,
      2,
    ),
  );
}

mkdirSync(OUT, { recursive: true });
console.log(`note: ${PAGES.length} pages checked: ${PAGES.map((p) => p.path).join(' ')}`);
console.log(`note: ${SKIPPED.length} pages of pagePaths() not built yet, skipped: ${SKIPPED.join(' ') || 'none'}`);

/**
 * Everything the steps need before the first one: a build to test, a server that answers, and an Edge that starts. A
 * failure here is reported like any step, as `FAIL setup <reason>`, with a results.json that holds it, so a run that could
 * not begin leaves a record instead of a stack trace. Answers the browser.
 */
async function setup() {
  if (PAGES.length === 0) throw new Error(`dist/client has none of the site's pages (${DIST}): run npm run build`);
  let response;
  try {
    response = await fetch(`${BASE}/`, { redirect: 'manual' });
  } catch (error) {
    throw new Error(`${BASE} does not answer: ${reasonOf(error)}; start it with npm run preview`);
  }
  if (response.status !== 200) throw new Error(`${BASE}/ answered ${response.status}, not 200: is npm run preview serving this build?`);
  try {
    return await chromium.launch({ channel: 'msedge', headless: true, args: GPU });
  } catch (error) {
    throw new Error(`Edge did not start: ${reasonOf(error)}`);
  }
}

const results = [];
let browser = null;
try {
  browser = await setup();
} catch (error) {
  const step = new Step('setup');
  step.check(false, reasonOf(error));
  step.seconds = 0;
  results.push(step);
  console.log(`FAIL setup ${reasonOf(error)}`);
}

if (browser) {
  try {
    for (const id of wanted) {
      const step = new Step(id);
      const started = Date.now();
      let summary = '';
      try {
        summary = await STEPS[id](browser, step);
      } catch (error) {
        step.check(false, `the step threw: ${error?.message?.split('\n')[0] ?? error}`);
      }
      step.check(step.errors.length === 0, `no console or page errors (got ${step.errors.length}: ${step.errors.join(' | ')})`);
      step.check(step.csp.length === 0, `no CSP violations (got ${step.csp.length}: ${JSON.stringify(step.csp)})`);
      step.seconds = Math.round((Date.now() - started) / 100) / 10;
      results.push(step);
      const failed = step.checks.filter((c) => !c.ok).map((c) => c.message);
      console.log(`${step.pass ? 'PASS' : 'FAIL'} ${id} ${step.pass ? `${summary} (${step.checks.length} checks, ${step.seconds}s)` : failed.join('; ')}`);
    }
  } finally {
    await browser.close();
  }
}

writeResults(results);
process.exitCode = results.length > 0 && results.every((step) => step.pass) ? 0 : 1;
