#!/usr/bin/env node
/**
 * Proof harness for the compass review page (/lab/compass/, /en/lab/compass/).
 *
 * Drives a real (headless) Edge through the page and checks, step by step,
 * what milestone 3 promises. It prints one PASS or FAIL line per step, writes
 * screenshots, `scrub.webm` and `results.json` to PROOF_DIR, and exits 1 if a
 * step failed. Frame rates and the quality step are reported, never gated.
 *
 *   1  first visit: the loader hunts, settles on the pearl, hands over, the intro lands
 *   2  scrub down and back up through the sections
 *   3  the pearl and the needle follow the mouse; Tab moves the pearl to the focused control
 *   4  drag: spin clockwise, coast, settle on a whole turn; tip, never past tipLimit
 *   5  phone (390x844 and 844x390, touch): swipe scrolls, sideways spins, touch never tips
 *   6  reload at aruba: no loader, aruba's ring and needle at once
 *   7  failures: no textures (plain materials); no three.js chunk (the stacked page)
 *   8  reduced motion and --disable-3d-apis: the stacked page with the stills, no loader
 *   9  fps over a full scrub (GPU, SwiftShader), the quality step, the idle check
 *   10 record scrub.webm (1440x900)
 *   stills  (not in the default run) capture the four stills at 1600x900 as PNG
 *
 * Environment:
 *   BASE             site to test, default http://localhost:4399 (npm run build, then astro preview --port 4399)
 *   COMPASS_PATH     page to test, default /lab/compass/ (use /en/lab/compass/ for English)
 *   PROOF_DIR        where the output goes, default ./proof-out
 *   STEPS            comma list of steps to run, default 1,2,3,4,5,6,7,8,9,10 (add `stills` to capture them)
 *   PLAYWRIGHT_CORE  path to a playwright-core package, outside the repo (else normal resolution)
 *   EDGE             the browser, default C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe
 *
 * The GPU flags are the Windows ANGLE/D3D11 ones; on another system set EDGE
 * to a Chromium and expect the GPU numbers to be that machine's.
 */

import { createRequire } from 'node:module';
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_CORE ? require(resolve(process.env.PLAYWRIGHT_CORE)) : require('playwright-core');

const BASE = (process.env.BASE ?? 'http://localhost:4399').replace(/\/$/, '');
const PAGE_PATH = process.env.COMPASS_PATH ?? '/lab/compass/';
const URL_PROOF = `${BASE}${PAGE_PATH}?proof`;
const OUT = resolve(process.env.PROOF_DIR ?? './proof-out');
const EDGE = process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const WANTED = new Set((process.env.STEPS ?? '1,2,3,4,5,6,7,8,9,10').split(',').map((s) => s.trim()));

const GPU = ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'];
const SOFTWARE = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------- numbers the product owns
// Kept in step by hand with the product (Choreography.ts, CameraRig.ts, FreeTurn.ts); a drift shows as a failing check.
const OFF_AXIS = { max: 35, lean: 5 };
const tipLimit = (tiltDeg) => (Math.max(0, OFF_AXIS.max - tiltDeg - OFF_AXIS.lean) * Math.PI) / 180;
const HERO_TILT = 22;
const SETTLED_TILT = 18;
const TAU = Math.PI * 2;
const dialLayout = (w, h) => (w >= 1.2 * h ? { x: w * 0.62, y: h * 0.5, diameter: Math.min(h * 0.64, w * 0.52) } : { x: w * 0.5, y: h * 0.3, diameter: Math.min(w * 0.8, h * 0.46) });

// ---------------------------------------------------------------- small helpers
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const wrap = (a) => {
  let x = a % TAU;
  if (x > Math.PI) x -= TAU;
  if (x <= -Math.PI) x += TAU;
  return x;
};
const deg = (rad) => (rad * 180) / Math.PI;
const fix = (n, d = 3) => (Number.isFinite(n) ? Number(n.toFixed(d)) : n);
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN;
};
const percentile = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN;
};

class Step {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.checks = [];
    this.notes = [];
    this.data = {};
  }
  check(ok, message) {
    this.checks.push({ ok: !!ok, message });
    return !!ok;
  }
  note(message) {
    this.notes.push(message);
  }
  get pass() {
    return this.checks.length > 0 && this.checks.every((c) => c.ok);
  }
}

const results = [];

async function runStep(id, name, body) {
  const step = new Step(id, name);
  const started = Date.now();
  try {
    await body(step);
  } catch (error) {
    step.check(false, `the step threw: ${error?.stack?.split('\n').slice(0, 3).join(' | ') ?? error}`);
  }
  step.seconds = Math.round((Date.now() - started) / 100) / 10;
  results.push(step);
  const passed = step.checks.filter((c) => c.ok).length;
  console.log(`${step.pass ? 'PASS' : 'FAIL'}  ${String(id).padEnd(6)} ${name} (${passed}/${step.checks.length} checks, ${step.seconds}s)`);
  for (const c of step.checks) if (!c.ok) console.log(`          FAIL: ${c.message}`);
  for (const n of step.notes) console.log(`          note: ${n}`);
  return step;
}

const shot = async (page, name, options = {}) => {
  await page.screenshot({ path: join(OUT, name), ...options });
};

// ---------------------------------------------------------------- the page's side of the harness
/**
 * Runs in every page before the page's own scripts. Seeds the session's
 * "seen" mark (skipping the loader), watches the loader's phases and the
 * hand-over's two needles, samples the scene's first frames after a load,
 * and (with `hold`) lets the harness freeze requestAnimationFrame for a
 * clean screenshot of a moment that lasts a few frames.
 */
function pageRecorder({ seen, hold, poll }) {
  try {
    if (seen) window.sessionStorage.setItem('bob-compass-seen', '1');
  } catch {
    // storage that cannot be written counts as a first visit
  }
  const raf = window.requestAnimationFrame.bind(window);
  const caf = window.cancelAnimationFrame.bind(window);
  const proof = (window.__proof = { phases: [], needle: [], boot: [], hunt: [], held: null });
  const t0 = performance.now();
  const now = () => Math.round(performance.now() - t0);

  if (hold) {
    const queue = [];
    const cancelled = new Set();
    window.requestAnimationFrame = (callback) => {
      const id = raf((time) => {
        if (cancelled.has(id)) return;
        if (window.__hold) {
          window.__held = true;
          queue.push(() => {
            if (!cancelled.has(id)) callback(performance.now());
          });
          return;
        }
        callback(time);
      });
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      cancelled.add(id);
      caf(id);
    };
    window.__release = () => {
      window.__hold = false;
      window.__held = false;
      raf(() => {
        for (const run of queue.splice(0)) run();
      });
    };
  }

  if (!poll) return;
  let overlaySeen = false;
  let lastPhase = null;
  let lastFrames = 0;
  const step = () => {
    const t = now();
    if (t > 9000) return;
    raf(step);
    const overlay = document.querySelector('[data-compass-loader]');
    if (overlay) overlaySeen = true;
    const phase = overlay ? (overlay.dataset.phase ?? 'pre') : overlaySeen ? 'gone' : null;
    if (phase !== null && phase !== lastPhase) {
      proof.phases.push([phase, t]);
      lastPhase = phase;
    }
    const svg = overlay?.querySelector('[data-loader-needle]');
    const turn = svg ? /rotate\(([-\d.]+)\)/.exec(svg.getAttribute('transform') ?? '') : null;
    if (phase === 'hunt' && turn) proof.hunt.push(Number(turn[1]));

    const hw = window.__holdWhen;
    if (hw && overlay && overlay.dataset.phase === hw.phase && t >= (hw.after ?? 0)) {
      const fade = Number(overlay.style.getPropertyValue('--fade') || 1);
      if (hw.fadeBelow === undefined || fade <= hw.fadeBelow) {
        window.__hold = true;
        window.__holdWhen = null;
        proof.held = { phase: hw.phase, t, fade, readout: overlay.querySelector('[data-loader-readout]')?.textContent ?? null };
      }
    }

    const debug = typeof window.__compassDebug === 'function' ? window.__compassDebug() : null;
    if (debug) {
      // The first moments after a load, for the reload check.
      if (proof.boot.length < 200) proof.boot.push({ t, section: debug.section, local: debug.local, bearing: debug.bearing, frames: debug.frames });
      // The first 3D frames drawn while the drawing is still there: both needles read in the same callback.
      if (overlay && debug.frames > lastFrames && proof.needle.length < 6) {
        const rim = overlay.querySelector('[data-dial-rim]')?.getBoundingClientRect();
        const canvas = document.querySelector('[data-compass-canvas]')?.getBoundingClientRect();
        proof.needle.push({
          t,
          phase,
          frames: debug.frames,
          svgDeg: turn ? Number(turn[1]) : null,
          sceneRad: debug.bearing,
          sceneRim: debug.rim,
          loaderRim: rim && canvas ? { x: rim.left + rim.width / 2 - canvas.left, y: rim.top + rim.height / 2 - canvas.top, diameter: rim.width } : null
        });
      }
      lastFrames = debug.frames;
    }
  };
  raf(step);
}

/** Freezes the page's animation frames when `when` is met, screenshots, and lets them go. */
async function shotAtMoment(page, when, name) {
  await page.evaluate((w) => {
    window.__holdWhen = w;
  }, when);
  await page.waitForFunction(() => window.__held === true, null, { polling: 20, timeout: 15000 });
  await shot(page, name);
  const held = await page.evaluate(() => window.__proof?.held ?? null);
  await page.evaluate(() => window.__release());
  return held;
}

// ---------------------------------------------------------------- browsers, pages, watching
let gpu = null;
async function gpuBrowser() {
  gpu ??= await chromium.launch({ executablePath: EDGE, headless: true, args: GPU });
  return gpu;
}

/** Console errors, page errors, failed requests and bad responses on a page; warnings apart. */
function watch(page) {
  const w = { errors: [], warnings: [], failed: [] };
  page.on('console', (m) => {
    if (m.type() === 'error') w.errors.push(m.text().slice(0, 240));
    else if (m.type() === 'warning') w.warnings.push(m.text().slice(0, 160));
  });
  page.on('pageerror', (e) => w.errors.push(`pageerror: ${e.message}`.slice(0, 240)));
  page.on('requestfailed', (r) => w.failed.push(`${r.failure()?.errorText ?? 'failed'} ${r.url()}`));
  page.on('response', (r) => {
    if (r.status() >= 400) w.errors.push(`http ${r.status()} ${r.url()}`);
  });
  return w;
}

/** The warnings the GPU's shader compiler gives (ANGLE/D3D, X4122) are the machine's, not the page's. */
const shaderNoise = (text) => /Program Info Log|X4122|X3550|X4000/.test(text);
const warningSummary = (w) => {
  const noise = w.warnings.filter(shaderNoise).length;
  const other = w.warnings.filter((t) => !shaderNoise(t));
  return { shaderCompilerWarnings: noise, otherWarnings: other };
};

async function newPage(browser, { seen = true, hold = false, poll = true, viewport = { width: 1440, height: 900 }, ...options } = {}) {
  const context = await browser.newContext({ viewport, ...options });
  await context.addInitScript(pageRecorder, { seen, hold, poll });
  const page = await context.newPage();
  await page.bringToFront();
  return { context, page, w: watch(page) };
}

/** What WebGL the browser has: the renderer's name, and whether the page's own support test (a GPU, no major performance caveat) passes. */
async function glInfo(browser) {
  const page = await browser.newPage();
  try {
    await page.goto('about:blank');
    return await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      const ext = gl?.getExtension('WEBGL_debug_renderer_info');
      const renderer = gl && ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null;
      let strict = null;
      try {
        strict = document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat: true });
      } catch {
        strict = null;
      }
      return { renderer, webgl2: gl !== null, passesCaveatTest: strict !== null };
    });
  } finally {
    await page.close();
  }
}

const debug = (page) => page.evaluate(() => window.__compassDebug?.() ?? null);
const bench = (page) => page.evaluate(() => document.documentElement.dataset.bench ?? null);

async function openCompass(page, { path = PAGE_PATH } = {}) {
  await page.goto(`${BASE}${path}?proof`, { waitUntil: 'domcontentloaded' });
}

/** Waits for the live scene: bench live, the loader gone, the intro done, and a drawn frame. */
async function waitLive(page, timeout = 30000) {
  await page.waitForFunction(
    () => {
      const root = document.documentElement;
      return root.dataset.bench === 'live' && !document.querySelector('[data-compass-loader]') && !root.classList.contains('compass-intro') && (window.__compassDebug?.().frames ?? 0) > 3;
    },
    null,
    { polling: 50, timeout }
  );
}

// ---------------------------------------------------------------- the track, scroll and touch
async function layout(page) {
  return page.evaluate(() => {
    const track = document.querySelector('[data-compass-track]');
    const top = track.getBoundingClientRect().top + window.scrollY;
    const secs = [...track.querySelectorAll('[data-section]')].map((s) => ({ id: s.dataset.section, len: Number(s.style.getPropertyValue('--len')) }));
    let at = 0;
    for (const s of secs) {
      s.start = at;
      at += s.len;
    }
    return { top, span: track.offsetHeight - window.innerHeight, inner: window.innerHeight, secs, total: at };
  });
}

/** The scrollY that puts the page at `local` (0..1) of section `id`; local 1 is the pixel before the next section's. */
function scrollYFor(L, id, local) {
  const i = L.secs.findIndex((s) => s.id === id);
  const s = L.secs[i];
  const y = L.top + ((s.start + Math.min(1, local) * s.len) / L.total) * L.span;
  return Math.round(local >= 1 && i < L.secs.length - 1 ? y - 1 : y);
}

/** Scrolls to a section's `local` and waits for the eased progress; answers the scene's state. */
async function goTo(page, id, local, settle = 1700) {
  const L = await layout(page);
  await page.evaluate((y) => window.scrollTo(0, y), scrollYFor(L, id, local));
  await sleep(settle);
  return debug(page);
}

/** Scrolls with mouse wheel events (through Lenis), `dy` px every `every` ms, until `target`; answers the scrollY reached. */
async function wheelTo(page, target, { dy = 24, every = 30, lead = 110 } = {}) {
  let y = await page.evaluate(() => window.scrollY);
  const dir = target > y ? 1 : -1;
  for (let i = 0; i < 4000; i++) {
    if (i % 6 === 0) {
      y = await page.evaluate(() => window.scrollY);
      // Lenis trails the wheel by about a tenth of a second; stop sending a little short of the target.
      if (dir > 0 ? y + lead >= target : y - lead <= target) break;
    }
    await page.mouse.wheel(0, dir * dy);
    await sleep(every);
  }
  return page.evaluate(() => window.scrollY);
}

async function waitScrollRest(page, timeout = 4000) {
  let last = -1;
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const y = await page.evaluate(() => window.scrollY);
    if (Math.abs(y - last) < 0.5) return y;
    last = y;
    await sleep(150);
  }
  return last;
}

/** A touch gesture through CDP (Playwright has taps only). */
class Finger {
  constructor(cdp) {
    this.cdp = cdp;
  }
  async send(type, x, y) {
    await this.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  }
  async swipe(from, to, { steps = 12, every = 16 } = {}) {
    await this.send('touchStart', from[0], from[1]);
    for (let i = 1; i <= steps; i++) {
      await this.send('touchMove', from[0] + ((to[0] - from[0]) * i) / steps, from[1] + ((to[1] - from[1]) * i) / steps);
      await sleep(every);
    }
    await this.send('touchEnd');
  }
  async down(x, y) {
    await this.send('touchStart', x, y);
  }
  async move(x, y) {
    await this.send('touchMove', x, y);
  }
  async up() {
    await this.send('touchEnd');
  }
  async tap(x, y) {
    await this.down(x, y);
    await sleep(60);
    await this.up();
  }
}

/** Polls until the spin is back on a whole turn and still; answers the seconds it took, or null. */
async function settleSpin(page, timeoutMs = 5000) {
  const started = Date.now();
  let a = null;
  let b = null;
  while (Date.now() - started < timeoutMs) {
    const s = (await debug(page)).spin;
    if (a !== null && b !== null && Math.abs(s) < 0.02 && Math.abs(s - a) < 0.003 && Math.abs(a - b) < 0.003) return (Date.now() - started) / 1000;
    b = a;
    a = s;
    await sleep(200);
  }
  return null;
}

// ================================================================ the steps
let main = null;
async function mainPage({ seen = true } = {}) {
  if (main) return main;
  const browser = await gpuBrowser();
  main = await newPage(browser, { seen });
  await openCompass(main.page);
  await waitLive(main.page);
  await sleep(800);
  return main;
}
async function closeMain() {
  if (main) await main.context.close();
  main = null;
}

// ---------------------------------------------------------------- 1. first visit
async function step1(step) {
  const browser = await gpuBrowser();
  main = await newPage(browser, { seen: false, hold: true });
  const { page, w } = main;
  const started = Date.now();
  await openCompass(page);

  // A mouse over the dial from the start: the loader's pearl is on it, and the needle will settle on it.
  const pearlAt = [1150, 290];
  await page.mouse.move(700, 600);
  await page.mouse.move(pearlAt[0], pearlAt[1], { steps: 10 });

  const hunting = await page.evaluate(() => document.querySelector('[data-compass-loader]')?.dataset.phase ?? null);
  step.check(hunting === 'hunt', `the loader shows and hunts at the start (phase ${hunting})`);
  const huntHeld = await shotAtMoment(page, { phase: 'hunt', after: 1000 }, '1-loader.png');
  step.data.loaderReadout = huntHeld?.readout;
  step.check(/\d+%/.test(huntHeld?.readout ?? ''), `the loader reads a percentage (${huntHeld?.readout})`);

  // The hand-over: the drawing half faded, the live dial under it.
  const faded = await shotAtMoment(page, { phase: 'fading', fadeBelow: 0.65 }, '2-handover.png');
  step.data.handoverFrozenAt = faded;

  await page.waitForFunction(() => document.documentElement.dataset.bench === 'live' && !document.querySelector('[data-compass-loader]') && !document.documentElement.classList.contains('compass-intro'), null, { polling: 50, timeout: 20000 });
  step.data.secondsToHero = fix((Date.now() - started) / 1000, 1);
  await sleep(1500);
  await shot(page, '3-hero.png');

  const proof = await page.evaluate(() => window.__proof);
  const seq = proof.phases.map((p) => p[0]);
  step.data.phases = proof.phases;
  step.check(['hunt', 'settle', 'fading', 'gone'].every((p) => seq.includes(p)) && seq.indexOf('hunt') < seq.indexOf('settle') && seq.indexOf('settle') < seq.indexOf('fading') && seq.indexOf('fading') < seq.indexOf('gone'), `the loader runs hunt, settle, hand-over, gone in order (${seq.join(' > ')})`);
  const hunt = proof.hunt;
  step.check(hunt.length > 5 && Math.max(...hunt) - Math.min(...hunt) > 90, `the needle hunts (${hunt.length} samples spanning ${fix(Math.max(...hunt) - Math.min(...hunt), 0)} degrees)`);

  const session = await page.evaluate(() => ({
    seen: window.sessionStorage.getItem('bob-compass-seen'),
    classes: document.documentElement.className,
    bench: document.documentElement.dataset.bench
  }));
  step.check(session.bench === 'live' && !/compass-loading|compass-intro/.test(session.classes), `the scene is live and the loader's classes are off (${session.classes})`);
  step.check(session.seen === '1', 'the session remembers the visit');

  // Needle continuity: both needles read in the same animation frame, the first frames the live scene drew.
  const n = proof.needle;
  step.data.needleSamples = n.map((s) => ({ ...s, diffDeg: s.svgDeg === null ? null : fix(deg(wrap(s.sceneRad - (s.svgDeg * Math.PI) / 180)), 2) }));
  if (n.length) {
    const first = step.data.needleSamples[0];
    step.data.needleContinuityDeg = first.diffDeg;
    step.note(`needle continuity at the first 3D frame after the hand-over: SVG ${first.svgDeg} deg, scene ${fix(deg(first.sceneRad), 2)} deg, difference ${first.diffDeg} deg (frame ${first.frames}, phase ${first.phase}; next frames ${step.data.needleSamples.slice(1, 4).map((s) => s.diffDeg).join(', ')})`);
    step.check(first.diffDeg !== null && Math.abs(first.diffDeg) < 2, `the needles agree at the hand-over (${first.diffDeg} deg)`);
    const l = first.loaderRim;
    const s = first.sceneRim;
    if (l) {
      const off = Math.hypot(l.x - s.x, l.y - s.y);
      step.data.rimMatch = { px: fix(off, 2), diameterDiff: fix(l.diameter - s.diameter, 2) };
      step.check(off < 3 && Math.abs(l.diameter - s.diameter) < 3, `the live dial is on the drawn one (centre off ${fix(off, 2)} px, diameter off ${fix(l.diameter - s.diameter, 2)} px)`);
    }
  } else {
    step.check(false, 'no 3D frame was seen while the drawing was still up, so the needle continuity could not be read');
  }

  const d = await debug(page);
  const want = dialLayout(1440, 900);
  step.data.hero = d;
  step.check(d.section === 'hero' && Math.abs(d.rim.x - want.x) < 2 && Math.abs(d.rim.y - want.y) < 2 && Math.abs(d.rim.diameter - want.diameter) < 2, `the intro lands on the hero's frame (rim ${fix(d.rim.x, 1)}, ${fix(d.rim.y, 1)}, ${fix(d.rim.diameter, 1)}; wanted ${want.x}, ${want.y}, ${want.diameter})`);
  step.check(Math.hypot(d.pearl[0] - pearlAt[0], d.pearl[1] - pearlAt[1]) < 5, `the pearl is where the mouse was (${fix(d.pearl[0], 1)}, ${fix(d.pearl[1], 1)})`);
  const shownText = await page.evaluate(() => Number(getComputedStyle(document.querySelector('[data-section="hero"] .compass__text')).opacity));
  step.check(shownText > 0.95, `the hero's words are shown (opacity ${fix(shownText, 2)})`);

  step.check(w.errors.length === 0, `no console errors (${w.errors.length}: ${w.errors.slice(0, 3).join(' | ')})`);
  step.check(w.failed.length === 0, `no failed requests (${w.failed.slice(0, 3).join(' | ')})`);
  step.data.warnings = warningSummary(w);
  if (w.warnings.length) step.note(`${w.warnings.filter(shaderNoise).length} GPU shader-compiler warnings (the machine's, not the page's); other warnings: ${warningSummary(w).otherWarnings.length}`);
}

// ---------------------------------------------------------------- 2. scrub
async function step2(step) {
  const { page, w } = await mainPage();
  await page.mouse.move(1150, 290);
  const L = await layout(page);
  step.data.track = { top: L.top, span: L.span, sections: L.secs };

  // A wheel scroll first: Lenis eases it, the stage follows.
  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 600);
  await sleep(1500);
  const after = await page.evaluate(() => window.scrollY);
  step.check(after > before + 300, `a wheel scrolls the page (${before} to ${after})`);
  await goTo(page, 'hero', 0);

  const stops = [
    { id: 'about', local: 0.55, file: '4-pool.png' },
    { id: 'china', local: 0.85, file: '5-china.png' },
    { id: 'aruba', local: 0.6, file: '8-sweep.png' },
    { id: 'aruba', local: 0.85, file: '6-aruba.png' },
    { id: 'rotterdam', local: 0.9, file: '7-rotterdam.png' }
  ];
  const down = {};
  let heroDiameter = (await debug(page)).rim.diameter;
  for (const s of stops) {
    const d = await goTo(page, s.id, s.local);
    const shown = await page.evaluate((id) => Number(getComputedStyle(document.querySelector(`[data-section="${id}"]`)).getPropertyValue('--shown')), s.id);
    down[`${s.id}@${s.local}`] = { section: d.section, local: fix(d.local), step: d.step, diameter: fix(d.rim.diameter, 1), bearing: fix(d.bearing), text: fix(shown, 2) };
    step.check(d.section === s.id && Math.abs(d.local - s.local) < 0.03, `${s.id} at ${s.local}: the scene is at ${d.section} ${fix(d.local)}`);
    step.check(shown > 0.95, `${s.id} at ${s.local}: the section's words are shown (${fix(shown, 2)})`);
    await shot(page, s.file);
    if (s.id === 'about') step.check(d.rim.diameter > heroDiameter * 2, `the about push comes close (rim ${fix(d.rim.diameter, 0)} px from ${fix(heroDiameter, 0)})`);
  }
  step.data.down = down;

  // Back up through the same places.
  const up = {};
  for (const s of [...stops].reverse()) {
    const d = await goTo(page, s.id, s.local, 1400);
    up[`${s.id}@${s.local}`] = { section: d.section, local: fix(d.local) };
    step.check(d.section === s.id && Math.abs(d.local - s.local) < 0.03, `back up at ${s.id} ${s.local}: ${d.section} ${fix(d.local)}`);
  }
  const top = await goTo(page, 'hero', 0, 1700);
  step.data.up = up;
  step.check(top.section === 'hero' && Math.abs(top.rim.diameter - heroDiameter) < 3, `back at the hero with the rim at ${fix(top.rim.diameter, 1)} px (it was ${fix(heroDiameter, 1)})`);
  step.check(w.errors.length === 0, `no console errors in the scrub (${w.errors.slice(0, 3).join(' | ')})`);
}

// ---------------------------------------------------------------- 3. pearl and needle
async function step3(step) {
  const { page, w } = await mainPage();
  await goTo(page, 'hero', 0, 800);
  const d0 = await debug(page);
  const c = d0.rim;
  const r = c.diameter * 0.45;
  const points = { north: [c.x, c.y - r], east: [c.x + r, c.y], south: [c.x, c.y + r], west: [c.x - r, c.y] };
  const rows = {};
  let from = [700, 650];
  await page.mouse.move(from[0], from[1]);
  for (const [name, p] of Object.entries(points)) {
    await page.mouse.move(p[0], p[1], { steps: 8 });
    await sleep(1500);
    const d = await debug(page);
    const want = Math.atan2(p[0] - c.x, -(p[1] - c.y));
    const off = wrap(d.bearing - want);
    rows[name] = { mouse: p.map((v) => fix(v, 0)), wantRad: fix(want), needleRad: fix(d.bearing), offRad: fix(off), pearl: d.pearl.map((v) => fix(v, 0)) };
    step.check(Math.abs(off) < 0.1, `the needle follows the mouse to the ${name}: ${fix(d.bearing)} rad for ${fix(want)} (off ${fix(off)})`);
    step.check(Math.hypot(d.pearl[0] - p[0], d.pearl[1] - p[1]) < 4, `the pearl is on the mouse at the ${name}`);
    if (name === 'west') await shot(page, '9-pearl-west.png');
  }
  step.data.follow = rows;

  // The keyboard: Tab goes to the skip link; the pearl goes to it.
  await page.evaluate(() => document.activeElement?.blur?.());
  const focusables = await page.evaluate(() =>
    [...document.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')].map((e) => ({ tag: e.tagName.toLowerCase(), text: (e.textContent ?? '').trim().slice(0, 40), cls: e.className }))
  );
  step.data.focusables = focusables;
  step.note(`the page has ${focusables.length} focusable control${focusables.length === 1 ? '' : 's'}: ${focusables.map((f) => `${f.tag} "${f.text}"`).join(', ')}`);
  for (let i = 0; i < focusables.length; i++) {
    await page.keyboard.press('Tab');
    await sleep(1600);
    const f = await page.evaluate(() => {
      const a = document.activeElement;
      const rect = a.getBoundingClientRect();
      return { tag: a.tagName.toLowerCase(), text: (a.textContent ?? '').trim().slice(0, 40), cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2, visible: a.matches(':focus-visible') };
    });
    const d = await debug(page);
    const dist = Math.hypot(d.pearl[0] - f.cx, d.pearl[1] - f.cy);
    step.data[`focus${i}`] = { ...f, pearl: d.pearl.map((v) => fix(v, 1)), distance: fix(dist, 1) };
    step.check(f.visible && dist < 30, `Tab ${i + 1} focuses ${f.tag} "${f.text}" and the pearl goes to it (${fix(dist, 1)} px off its centre)`);
    if (i === 0) await shot(page, '9-focus.png');
  }
  await page.evaluate(() => document.activeElement?.blur?.());
  step.check(w.errors.length === 0, `no console errors (${w.errors.slice(0, 3).join(' | ')})`);
}

// ---------------------------------------------------------------- 4. drag
async function step4(step) {
  const { page, w } = await mainPage();
  await goTo(page, 'hero', 0, 800);
  const start = [1000, 450];

  // Sideways 400 px: a clockwise spin (a negative angle), a coast after release, rest on a whole turn.
  await page.mouse.move(start[0], start[1]);
  await sleep(300);
  await page.mouse.down();
  let mid = null;
  for (let i = 1; i <= 24; i++) {
    await page.mouse.move(start[0] + (400 * i) / 24, start[1]);
    await sleep(8);
    if (i === 12) mid = await debug(page);
  }
  const end = await debug(page);
  await page.mouse.up();
  const released = Date.now();
  await sleep(60);
  await shot(page, '10-spin.png');
  const s1 = (await debug(page)).spin;
  await sleep(300);
  const s2 = (await debug(page)).spin;
  step.data.spin = { midDrag: fix(mid.spin), endOfDrag: fix(end.spin), afterRelease: fix(s1), later: fix(s2), expectedAtEnd: fix(wrap((-400 / (0.8 * 1440)) * TAU)) };
  step.check(mid.spin < -0.5 && mid.spin > -Math.PI, `a drag to the right spins the dial clockwise (spin ${fix(mid.spin)} half way, ${fix(end.spin)} at the end)`);
  step.check(Math.abs(end.spin - wrap((-400 / (0.8 * 1440)) * TAU)) < 0.15, `400 px is ${fix(deg(-end.spin), 0)} degrees of turn (the free turn gives ${fix(deg((400 / (0.8 * 1440)) * TAU), 0)})`);
  step.check(Math.abs(wrap(s2 - s1)) > 0.1, `the dial coasts after release (${fix(s1)} then ${fix(s2)})`);
  const seconds = await settleSpin(page, 5000);
  step.data.settleSeconds = seconds === null ? null : fix((Date.now() - released) / 1000 , 1);
  step.check(seconds !== null, `it settles on a whole turn within 5 s of the release (${seconds === null ? 'did not' : fix((Date.now() - released) / 1000, 1) + ' s'})`);

  // Tipping: a vertical mouse drag tips, held to tipLimit, and springs back.
  const tipAt = async (framing, limit, label) => {
    const rows = {};
    for (const [name, dy] of [['small', 60], ['down', 500], ['up', -500]]) {
      const y0 = name === 'up' ? 700 : 150;
      await page.mouse.move(start[0], y0);
      await page.mouse.down();
      for (let i = 1; i <= 15; i++) {
        await page.mouse.move(start[0], y0 + (dy * i) / 15);
        await sleep(10);
      }
      await sleep(250);
      const held = await debug(page);
      if (name === 'down' && label === 'hero') await shot(page, '10-tip.png');
      await page.mouse.up();
      await sleep(1500);
      const back = await debug(page);
      rows[name] = { tip: fix(held.tip, 4), spin: fix(held.spin, 4), afterRelease: fix(back.tip, 4), limit: fix(limit, 4) };
      if (name === 'small') step.check(Math.abs(held.tip - (dy / 900) * 1.2) < 0.01, `${label}: a short drag tips in proportion (${fix(held.tip, 3)} for ${fix((dy / 900) * 1.2, 3)})`);
      else step.check(Math.abs(Math.abs(held.tip) - limit) < 0.003 && Math.abs(held.tip) <= limit + 1e-6, `${label}: a long drag ${name} tips ${fix(deg(held.tip), 2)} degrees, held to tipLimit ${fix(deg(limit), 2)}`);
      step.check(Math.abs(held.spin) < 0.02, `${label}: a vertical drag does not spin (${fix(held.spin, 4)})`);
      step.check(Math.abs(back.tip) < 0.005, `${label}: the tip springs back (${fix(back.tip, 4)})`);
    }
    step.data[`tip_${label}`] = rows;
  };
  await tipAt(HERO_TILT, tipLimit(HERO_TILT), 'hero');
  await goTo(page, 'aruba', 0.5, 1700);
  await tipAt(SETTLED_TILT, tipLimit(SETTLED_TILT), 'aruba');
  await goTo(page, 'hero', 0, 1500);
  step.check(w.errors.length === 0, `no console errors (${w.errors.slice(0, 3).join(' | ')})`);
}

// ---------------------------------------------------------------- 6. reload at aruba
async function step6(step) {
  const { page, w } = await mainPage();
  await goTo(page, 'aruba', 0.85, 1700);
  const before = await debug(page);
  step.check(before.section === 'aruba', `scrolled to aruba (${before.section} ${fix(before.local)})`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.bench === 'live' && (window.__compassDebug?.().frames ?? 0) > 2, null, { polling: 20, timeout: 20000 });
  const proof = await page.evaluate(() => window.__proof);
  const state = await page.evaluate(() => ({ loader: !!document.querySelector('[data-compass-loader]'), classes: document.documentElement.className, bench: document.documentElement.dataset.bench }));
  step.check(!state.loader && !/compass-loading/.test(state.classes) && /compass-seen/.test(state.classes), `no loader on a reload in the same session (${state.classes})`);
  const aruba = (270 * Math.PI) / 180;
  const first = proof.boot[0];
  const drawn = proof.boot.find((b) => b.frames > 0);
  step.data.firstSample = first;
  step.data.firstDrawnSample = drawn;
  step.check(first && first.section === 'aruba', `the scene's first state is aruba's (${first?.section} ${fix(first?.local ?? NaN)})`);
  step.check(proof.boot.every((b) => b.section === 'aruba'), `it stays at aruba through the first ${proof.boot.length} frames (${[...new Set(proof.boot.map((b) => b.section))].join(', ')})`);
  step.check(proof.boot.every((b) => Math.abs(wrap(b.bearing - aruba)) < 0.05), `the needle is at aruba's bearing from the first frame to the last (worst ${fix(Math.max(...proof.boot.map((b) => Math.abs(wrap(b.bearing - aruba)))), 4)} rad off west)`);
  await sleep(1200);
  await shot(page, '12-reload.png');
  const after = await debug(page);
  step.check(after.section === 'aruba' && Math.abs(after.local - before.local) < 0.03, `the page is where it was (${after.section} ${fix(after.local)}, was ${fix(before.local)})`);
  step.check(w.errors.length === 0, `no console errors across the reload (${w.errors.slice(0, 3).join(' | ')})`);
}

// ---------------------------------------------------------------- 5. phone
async function phone(step, { width, height, tag }) {
  const browser = await gpuBrowser();
  const { context, page, w } = await newPage(browser, { seen: true, viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  try {
    await openCompass(page);
    await waitLive(page);
    await sleep(1200);
    const finger = new Finger(await context.newCDPSession(page));
    const media = await page.evaluate(() => ({ fine: matchMedia('(pointer: fine) and (hover: hover)').matches, coarse: matchMedia('(pointer: coarse)').matches, w: innerWidth, h: innerHeight }));
    step.check(!media.fine && media.coarse, `${tag}: the page sees a touch screen (${media.w}x${media.h})`);
    const want = dialLayout(width, height);
    const d0 = await debug(page);
    step.check(Math.abs(d0.rim.diameter - want.diameter) < 2 && Math.abs(d0.rim.x - want.x) < 2 && Math.abs(d0.rim.y - want.y) < 2, `${tag}: the dial is laid out for ${width}x${height} (rim ${fix(d0.rim.x, 0)}, ${fix(d0.rim.y, 0)}, ${fix(d0.rim.diameter, 0)})`);
    await shot(page, `11-phone-${tag}-hero.png`);

    // The pearl drifts on its own...
    const path = [];
    for (let i = 0; i < 6; i++) {
      path.push((await debug(page)).pearl);
      await sleep(700);
    }
    let travelled = 0;
    for (let i = 1; i < path.length; i++) travelled += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    step.data[`${tag}Drift`] = { travelledPx: fix(travelled, 1) };
    step.check(travelled > 15, `${tag}: the pearl drifts untouched (${fix(travelled, 0)} px in 4 s)`);

    // ...and goes to a tap.
    const tap = [Math.round(width * 0.25), Math.round(height * 0.85)];
    await finger.tap(tap[0], tap[1]);
    await sleep(600);
    const dt = await debug(page);
    step.check(Math.hypot(dt.pearl[0] - tap[0], dt.pearl[1] - tap[1]) < 20, `${tag}: the pearl goes to a tap (${fix(dt.pearl[0], 0)}, ${fix(dt.pearl[1], 0)} for ${tap.join(', ')})`);
    await shot(page, `11-phone-${tag}-tap.png`);
    await sleep(2800);
    const dback = await debug(page);
    step.check(Math.hypot(dback.pearl[0] - tap[0], dback.pearl[1] - tap[1]) > 10, `${tag}: it lets go of the tap and drifts again`);

    // A horizontal swipe spins (clockwise for a swipe to the right), and a touch never tips.
    const spinFrom = [Math.round(width * 0.2), Math.round(height * 0.55)];
    await finger.down(spinFrom[0], spinFrom[1]);
    const dx = Math.round(width * 0.3);
    for (let i = 1; i <= 12; i++) {
      await finger.move(spinFrom[0] + (dx * i) / 12, spinFrom[1] + (i % 2 ? 6 : -6));
      await sleep(16);
    }
    const held = await debug(page);
    await shot(page, `11-phone-${tag}-spin.png`);
    await finger.up();
    step.data[`${tag}Swipe`] = { spin: fix(held.spin), tip: fix(held.tip, 5), dx };
    step.check(held.spin < -0.3 && held.spin > -Math.PI, `${tag}: a horizontal swipe of ${dx} px spins the dial clockwise (${fix(held.spin)} rad)`);
    step.check(held.tip === 0, `${tag}: a touch does not tip (${held.tip})`);
    const settled = await settleSpin(page, 5000);
    step.check(settled !== null, `${tag}: the spin settles on a whole turn`);

    // A vertical swipe scrolls the page, and neither spins nor tips.
    const y0 = await page.evaluate(() => window.scrollY);
    await finger.swipe([Math.round(width / 2), Math.round(height * 0.75)], [Math.round(width / 2), Math.round(height * 0.3)], { steps: 14, every: 16 });
    await sleep(900);
    const y1 = await page.evaluate(() => window.scrollY);
    const ds = await debug(page);
    step.data[`${tag}Scroll`] = { from: y0, to: y1, spin: fix(ds.spin, 4), tip: fix(ds.tip, 5) };
    step.check(y1 > y0 + 100, `${tag}: a vertical swipe scrolls the page (${fix(y0, 0)} to ${fix(y1, 0)})`);
    step.check(Math.abs(ds.spin) < 0.02 && ds.tip === 0, `${tag}: the vertical swipe neither spins nor tips (spin ${fix(ds.spin, 4)}, tip ${ds.tip})`);
    await sleep(1200);
    await shot(page, `11-phone-${tag}-scrolled.png`);
    step.check(w.errors.length === 0, `${tag}: no console errors (${w.errors.slice(0, 3).join(' | ')})`);
  } finally {
    await context.close();
  }
}

async function step5(step) {
  await phone(step, { width: 390, height: 844, tag: 'portrait' });
  await phone(step, { width: 844, height: 390, tag: 'landscape' });
}

// ---------------------------------------------------------------- 7. failures
async function step7(step) {
  const browser = await gpuBrowser();

  // 7a: no textures, no portrait; the loader runs (a first visit), the scene is plain.
  {
    const { context, page, w } = await newPage(browser, { seen: false });
    const aborted = [];
    await context.route(/\/textures\/instrument\/|portrait-pool/, (route) => {
      aborted.push(route.request().url());
      return route.abort();
    });
    await openCompass(page);
    await waitLive(page, 25000);
    await sleep(1200);
    const phases = (await page.evaluate(() => window.__proof.phases)).map((p) => p[0]);
    step.data.noTexturesPhases = phases;
    step.check(phases.includes('gone') && (await bench(page)) === 'live', `with no textures the loader still hands over and the scene is live (${phases.join(' > ')})`);
    step.check(aborted.length >= 3, `the textures and the portrait were refused (${aborted.length} requests)`);
    const pageErrors = w.errors.filter((e) => e.startsWith('pageerror'));
    const unexpected = w.errors.filter((e) => !/Failed to load resource|ERR_FAILED|ERR_BLOCKED/.test(e));
    step.check(pageErrors.length === 0 && unexpected.length === 0, `no uncaught errors, only the refused loads (${unexpected.slice(0, 3).join(' | ') || 'none other'})`);
    const dh = await debug(page);
    step.check(dh.section === 'hero' && dh.frames > 10, `frames are drawn (${dh.frames})`);
    await shot(page, '13-no-textures-hero.png');
    const dp = await goTo(page, 'about', 0.55, 2000);
    step.check(dp.section === 'about', `the pool push works without the portrait (${dp.section} ${fix(dp.local)})`);
    await shot(page, '13-no-textures.png');
    await goTo(page, 'china', 0.85, 1800);
    await shot(page, '13-no-textures-china.png');
    step.data.noTexturesErrors = { expectedRefusals: w.errors.length, kinds: [...new Set(w.errors.map((e) => e.slice(0, 80)))] };
    await context.close();
  }

  // 7b: the three.js chunk is refused: the stacked page, quickly.
  {
    const { context, page, w } = await newPage(browser, { seen: false });
    await context.route(/\/_astro\/live\.[^/]*\.js/, (route) => route.abort());
    const started = Date.now();
    await openCompass(page);
    await page.waitForFunction(() => document.documentElement.dataset.bench === 'fallback', null, { polling: 50, timeout: 10000 });
    const seconds = (Date.now() - started) / 1000;
    step.data.noChunkSeconds = fix(seconds, 2);
    step.check(seconds < 10, `the stacked page is there ${fix(seconds, 1)} s after the load, inside the 10 s limit`);
    await sleep(500);
    const state = await page.evaluate(() => ({
      loader: !!document.querySelector('[data-compass-loader]'),
      classes: document.documentElement.className,
      stageDisplay: getComputedStyle(document.querySelector('[data-compass-stage]')).display,
      fallback: document.querySelector('[data-compass-stage]').hasAttribute('data-fallback')
    }));
    step.check(!state.loader && !/compass-loading/.test(state.classes) && state.fallback && state.stageDisplay === 'none', `the loader is gone, the stage hidden (${state.classes}; stage ${state.stageDisplay})`);
    await scrollThrough(page);
    const stills = await stillsState(page);
    step.data.noChunkStills = stills;
    step.check(stills.length === 4 && stills.every((s) => s.loaded && s.width > 200), `the four stills show (${stills.map((s) => `${s.id} ${s.width}px`).join(', ')})`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(300);
    await shot(page, '14-no-chunk.png', { fullPage: true });
    step.data.noChunkErrors = [...new Set(w.errors.map((e) => e.slice(0, 100)))];
    step.check(w.errors.filter((e) => e.startsWith('pageerror')).length === 0, 'no uncaught errors with the chunk refused');
    await context.close();
  }
}

/** Scrolls the stacked page top to bottom, so its lazy stills load. */
async function scrollThrough(page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= height; y += 400) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await sleep(120);
  }
  await sleep(700);
}

async function stillsState(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('[data-section]')]
      .map((s) => {
        const img = s.querySelector('.compass__still img');
        return img ? { id: s.dataset.section, loaded: img.complete && img.naturalWidth > 0, natural: `${img.naturalWidth}x${img.naturalHeight}`, width: Math.round(img.getBoundingClientRect().width), eager: img.getAttribute('loading') } : null;
      })
      .filter(Boolean)
  );
}

// ---------------------------------------------------------------- 8. reduced motion and no 3D APIs
async function stacked(step, { label, file, context: contextOf }) {
  const { context, page, w } = await contextOf();
  try {
    const started = Date.now();
    await openCompass(page);
    await page.waitForFunction(() => document.documentElement.dataset.bench === 'fallback', null, { polling: 50, timeout: 10000 });
    step.data[`${label}Seconds`] = fix((Date.now() - started) / 1000, 2);
    await sleep(1500);
    const proof = await page.evaluate(() => window.__proof);
    const state = await page.evaluate(() => ({
      loader: !!document.querySelector('[data-compass-loader]'),
      classes: document.documentElement.className,
      stage: getComputedStyle(document.querySelector('[data-compass-stage]')).display,
      canvasLive: document.documentElement.dataset.bench === 'live'
    }));
    const shownLoader = proof.phases.map((p) => p[0]);
    step.data[`${label}LoaderPhases`] = proof.phases;
    step.check(!state.loader && !/compass-loading|compass-intro/.test(state.classes), `${label}: no loader in the end (${state.classes})`);
    if (proof.phases.length) {
      const first = proof.phases[0][1];
      const last = proof.phases[proof.phases.length - 1][1];
      step.note(`${label}: the loader drawing was up for ${last - first} ms before the page fell back (phases ${shownLoader.join(' > ')})`);
    } else step.note(`${label}: the loader never showed`);
    step.check(state.stage === 'none' && !state.canvasLive, `${label}: the stage is hidden, the page is stacked`);
    await scrollThrough(page);
    const stills = await stillsState(page);
    step.data[`${label}Stills`] = stills;
    step.check(stills.length === 4 && stills.every((s) => s.loaded && s.width > 200), `${label}: the four stills show (${stills.map((s) => `${s.id} ${s.natural}`).join(', ')})`);
    const heroEager = stills.find((s) => s.id === 'hero')?.eager;
    step.check(heroEager === 'eager' && stills.filter((s) => s.id !== 'hero').every((s) => s.eager === 'lazy'), `${label}: the hero still is eager, the others lazy (${stills.map((s) => `${s.id}:${s.eager}`).join(' ')})`);
    const portrait = await page.evaluate(() => {
      const img = document.querySelector('.compass__portrait img');
      return !!img && img.complete && img.naturalWidth > 0;
    });
    step.check(portrait, `${label}: the real portrait shows`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(300);
    await shot(page, file, { fullPage: true });
    step.check(w.errors.filter((e) => e.startsWith('pageerror')).length === 0, `${label}: no uncaught errors (${w.errors.slice(0, 2).join(' | ')})`);
  } finally {
    await context.close();
  }
}

async function step8(step) {
  const browser = await gpuBrowser();
  await stacked(step, { label: 'reduced motion', file: '15-reduced-motion.png', context: () => newPage(browser, { seen: false, reducedMotion: 'reduce' }) });
  const noApis = await chromium.launch({ executablePath: EDGE, headless: true, args: [...GPU, '--disable-3d-apis'] });
  try {
    await stacked(step, { label: 'disable-3d-apis', file: '15-no-3d-apis.png', context: () => newPage(noApis, { seen: false }) });
  } finally {
    await noApis.close();
  }
}

// ---------------------------------------------------------------- 9. fps, quality, idle
/** One full scrub, down and back up, with wheel events; answers the frame intervals and the quality steps. */
async function scrub(page) {
  const L = await layout(page);
  await page.evaluate(() => {
    const dts = [];
    const steps = [];
    let last = null;
    let running = true;
    const tick = (t) => {
      if (!running) return;
      if (last !== null) dts.push(t - last);
      last = t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const timer = setInterval(() => {
      const d = window.__compassDebug?.();
      if (d) steps.push(d.step);
    }, 400);
    window.__fps = {
      start: window.__compassDebug?.().frames ?? 0,
      began: performance.now(),
      stop() {
        running = false;
        clearInterval(timer);
        return { dts, steps, frames: (window.__compassDebug?.().frames ?? 0) - this.start, ms: performance.now() - this.began };
      }
    };
  });
  await wheelTo(page, L.top + L.span, { dy: 24, every: 24 });
  await sleep(600);
  await wheelTo(page, L.top, { dy: 24, every: 24 });
  await sleep(1500);
  return page.evaluate(() => window.__fps.stop());
}

const fpsSummary = (r) => {
  const median_ms = median(r.dts);
  return {
    intervals: r.dts.length,
    medianFps: fix(1000 / median_ms, 1),
    medianMs: fix(median_ms, 2),
    p95Ms: fix(percentile(r.dts, 0.95), 2),
    over25ms: fix(r.dts.filter((d) => d > 25).length / r.dts.length, 3),
    drawnFrames: r.frames,
    drawnFps: fix((r.frames * 1000) / r.ms, 1),
    seconds: fix(r.ms / 1000, 1),
    stepReached: Math.max(0, ...r.steps),
    stepAtEnd: r.steps[r.steps.length - 1] ?? 0
  };
};

async function step9(step) {
  await closeMain();
  const browser = await gpuBrowser();
  step.data.gpuGl = await glInfo(browser);
  step.note(`GPU browser: ${step.data.gpuGl.renderer}; the page's support test ${step.data.gpuGl.passesCaveatTest ? 'passes' : 'fails'}`);
  {
    const { context, page, w } = await newPage(browser, { seen: true, poll: false });
    await openCompass(page);
    await waitLive(page);
    await sleep(1500);
    await page.mouse.move(1150, 290);
    await page.bringToFront();
    const r = await scrub(page);
    const s = fpsSummary(r);
    step.data.gpu = s;
    step.note(`GPU, full scrub (${s.seconds} s): median ${s.medianFps} fps (${s.medianMs} ms), p95 ${s.p95Ms} ms, ${fix(s.over25ms * 100, 1)}% of frames over 25 ms; ${s.drawnFrames} frames drawn (${s.drawnFps} fps); quality step reached ${s.stepReached} (at the end ${s.stepAtEnd})`);
    step.check(s.drawnFrames > 100, `the scene drew frames through the scrub (${s.drawnFrames})`);

    // Idle: untouched, the scene draws, then after 20 s it stops.
    await page.mouse.move(1150, 290);
    await sleep(500);
    const t0 = Date.now();
    const frames = async () => (await debug(page)).frames;
    await sleep(4000);
    const a = await frames();
    await sleep(2000);
    const b = await frames();
    step.check(b - a > 30, `while the page is fresh the scene still draws (${b - a} frames in 2 s)`);
    await sleep(Math.max(0, 25000 - (Date.now() - t0)));
    const c = await frames();
    await sleep(4000);
    const d = await frames();
    const idleStep = (await debug(page)).step;
    step.data.idle = { at25s: c, at29s: d, rendered: d - c, drawingBefore: b - a };
    step.check(d - c === 0, `after 25 s untouched no frames are drawn (${d - c} in the next 4 s, from ${c})`);
    // A movement wakes it again.
    await page.mouse.move(900, 600, { steps: 5 });
    await sleep(700);
    const e = await frames();
    step.data.idle.afterWake = e - d;
    step.check(e - d > 5, `a mouse move wakes it (${e - d} frames in 0.7 s)`);
    step.data.idle.stepAfterIdle = idleStep;
    step.check(w.errors.length === 0, `no console errors in the run (${w.errors.slice(0, 3).join(' | ')})`);
    await context.close();
  }

  // SwiftShader: the compass wants a GPU (failIfMajorPerformanceCaveat), so software drawing gets the stacked page.
  {
    const soft = await chromium.launch({ executablePath: EDGE, headless: true, args: SOFTWARE });
    try {
      step.data.softGl = await glInfo(soft);
      step.note(`SwiftShader browser: ${step.data.softGl.renderer}; the page's support test ${step.data.softGl.passesCaveatTest ? 'passes' : 'fails'}`);
      const { context, page } = await newPage(soft, { seen: true, poll: false });
      await openCompass(page);
      await page.waitForFunction(() => document.documentElement.dataset.bench === 'live' || document.documentElement.dataset.bench === 'fallback', null, { polling: 100, timeout: 20000 });
      const mode = await bench(page);
      step.data.swiftshader = { bench: mode };
      if (mode === 'fallback') {
        step.note('SwiftShader: fps n/a: stacked fallback (the page declines software WebGL, as designed)');
        await scrollThrough(page);
        const stills = await stillsState(page);
        step.check(stills.length === 4 && stills.every((s) => s.loaded), 'SwiftShader gets the stacked page with its four stills');
        await page.evaluate(() => window.scrollTo(0, 0));
        await sleep(300);
        await shot(page, '9-swiftshader-stacked.png', { fullPage: true });
      } else {
        await waitLive(page, 60000);
        await sleep(1500);
        await page.bringToFront();
        const r = await scrub(page);
        const s = fpsSummary(r);
        step.data.swiftshader = { bench: mode, ...s };
        step.note(`SwiftShader (live, unexpectedly): median ${s.medianFps} fps, quality step reached ${s.stepReached}`);
        step.check(true, 'SwiftShader measured');
      }
      await context.close();
    } finally {
      await soft.close();
    }
  }
}

// ---------------------------------------------------------------- 10. record
async function step10(step) {
  await closeMain();
  const browser = await gpuBrowser();
  const dir = join(OUT, 'video-tmp');
  rmSync(dir, { recursive: true, force: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir, size: { width: 1440, height: 900 } } });
  const page = await context.newPage();
  const w = watch(page);
  await page.bringToFront();
  let video = null;
  try {
    video = page.video();
    await openCompass(page);

    // The loader: the mouse circles the dial, the pearl on it, until the needle settles and the hand-over is done.
    const centre = dialLayout(1440, 900);
    const orbit = async (seconds, radius = 0.5, phase = 0) => {
      const until = Date.now() + seconds * 1000;
      while (Date.now() < until) {
        const a = phase + (Date.now() / 1000) * 0.9;
        await page.mouse.move(centre.x + Math.cos(a) * centre.diameter * radius, centre.y + Math.sin(a) * centre.diameter * radius * 0.85);
        await sleep(40);
      }
    };
    await page.mouse.move(centre.x + centre.diameter * 0.5, centre.y);
    while (await page.evaluate(() => !!document.querySelector('[data-compass-loader]'))) await orbit(0.2);
    await page.waitForFunction(() => !document.documentElement.classList.contains('compass-intro'), null, { polling: 50, timeout: 10000 });
    await orbit(3.5);

    // A slow scroll down through the sections, pausing in each, and back up.
    const L = await layout(page);
    const stops = [
      ['about', 0.55, 1.6],
      ['china', 0.85, 1.6],
      ['aruba', 0.85, 1.6],
      ['rotterdam', 0.9, 1.6]
    ].map(([id, local, pause]) => ({ y: scrollYFor(L, id, local), pause }));
    for (const stop of stops) {
      await wheelTo(page, stop.y);
      await waitScrollRest(page);
      await orbit(stop.pause, 0.55, 1);
    }
    await wheelTo(page, L.top + L.span);
    await waitScrollRest(page);
    await orbit(1.2, 0.55, 2);
    for (const stop of [...stops].reverse().slice(1)) {
      await wheelTo(page, stop.y, { dy: 30, every: 24 });
      await waitScrollRest(page);
      await orbit(0.9, 0.55, 3);
    }
    await wheelTo(page, L.top, { dy: 30, every: 24 });
    await waitScrollRest(page);
    await orbit(1.8, 0.5, 0);

    // A drag spin at the hero, then a tip.
    const grab = [centre.x + centre.diameter * 0.15, centre.y + centre.diameter * 0.55];
    await page.mouse.move(grab[0], grab[1], { steps: 8 });
    await sleep(500);
    await page.mouse.down();
    for (let i = 1; i <= 30; i++) {
      await page.mouse.move(grab[0] + (400 * i) / 30, grab[1]);
      await sleep(10);
    }
    await page.mouse.up();
    await sleep(4200);
    await page.mouse.move(grab[0], grab[1] - 120, { steps: 8 });
    await page.mouse.down();
    for (let i = 1; i <= 15; i++) {
      await page.mouse.move(grab[0], grab[1] - 120 + (260 * i) / 15);
      await sleep(14);
    }
    await sleep(900);
    await page.mouse.up();
    await sleep(1500);
    await orbit(2.5, 0.5, 4);
    step.check(w.errors.length === 0, `no console errors while recording (${w.errors.slice(0, 3).join(' | ')})`);
  } finally {
    await context.close();
  }
  const path = await video.path();
  renameSync(path, join(OUT, 'scrub.webm'));
  rmSync(dir, { recursive: true, force: true });
  step.check(true, `scrub.webm written (1440x900)`);
}

// ---------------------------------------------------------------- stills
async function stills(step) {
  const browser = await gpuBrowser();
  const { context, page, w } = await newPage(browser, { seen: true, poll: false, viewport: { width: 1600, height: 900 } });
  try {
    await openCompass(page);
    await waitLive(page);
    await sleep(1500);
    // The words are the page's, not the picture's: hidden through the style API, which the page's CSP does not govern.
    await page.evaluate(() => {
      for (const text of document.querySelectorAll('.compass__text')) text.style.visibility = 'hidden';
    });
    mkdirSync(join(OUT, 'stills'), { recursive: true });
    const stops = [
      { name: 'hero', id: 'hero', local: 0.5 },
      { name: 'china', id: 'china', local: 1 },
      { name: 'aruba', id: 'aruba', local: 1 },
      { name: 'rotterdam', id: 'rotterdam', local: 1 }
    ];
    for (const s of stops) {
      const d = await goTo(page, s.id, s.local, 2600);
      step.data[s.name] = { section: d.section, local: fix(d.local, 4), step: d.step, rim: d.rim };
      step.check(d.section === s.id && Math.abs(d.local - s.local) < 0.01 && d.step === 0, `${s.name}: ${d.section} at local ${fix(d.local, 3)}, quality step ${d.step}`);
      await shot(page, `stills/compass-${s.name}.png`);
    }
    step.check(w.errors.length === 0, 'no console errors');
  } finally {
    await context.close();
  }
}

// ================================================================ run
const plan = [
  ['1', 'first visit: loader, hand-over, intro', step1],
  ['2', 'scrub down and back', step2],
  ['3', 'pearl, needle and focus', step3],
  ['4', 'drag: spin, coast, settle, tip', step4],
  ['6', 'reload at aruba', step6],
  ['5', 'phone: swipe, spin, drift, tap', step5],
  ['7', 'failures: no textures, no chunk', step7],
  ['8', 'reduced motion and no 3D APIs', step8],
  ['9', 'fps, quality step, idle', step9],
  ['10', 'record scrub.webm', step10],
  ['stills', 'capture the four stills (1600x900 PNG)', stills]
];

console.log(`compass proof: ${URL_PROOF}\noutput: ${OUT}\n`);
try {
  for (const [id, name, body] of plan) if (WANTED.has(id)) await runStep(id, name, body);
} finally {
  await closeMain().catch(() => {});
  await gpu?.close().catch(() => {});
}

const order = (s) => (s.id === 'stills' ? 99 : Number(s.id));
results.sort((a, b) => order(a) - order(b));
writeFileSync(join(OUT, 'results.json'), JSON.stringify({ base: URL_PROOF, steps: results.map((s) => ({ id: s.id, name: s.name, pass: s.pass, seconds: s.seconds, checks: s.checks, notes: s.notes, data: s.data })) }, null, 2));
const failed = results.filter((s) => !s.pass);
console.log(`\n${results.length - failed.length}/${results.length} steps pass${failed.length ? `; failing: ${failed.map((s) => s.id).join(', ')}` : ''}. Results: ${join(OUT, 'results.json')}`);
process.exit(failed.length ? 1 : 0);
