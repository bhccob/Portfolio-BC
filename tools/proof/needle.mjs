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
 *   routes     every page of pagePaths() that the build produced, each answers 200 with one <h1>
 *              (in its HTML and after hydration) and the right <html lang>; a page the build did
 *              not produce is listed and skipped
 *   slash      GET /about/china answers 301 to /about/china/; a browser opening /about/china loads
 *              /about/china/ once, with no reload
 *   persist    client navigation / → /about/china/ → /en/about/china/, then history.back(): the Stage
 *              mounted once and the same <canvas> node throughout, with no document load after the first
 *   not-found  an unknown URL (/does-not-exist/, /en/does-not-exist/) answers 404 with the build's
 *              404.html; after hydration it shows the not-found route's <h1> and the right <html lang>,
 *              and the browser loads one document, with no reload loop
 *   home-nav   the home page's links to the three countries and three projects: visually hidden but
 *              reachable by keyboard while 3D is on (and shown while one has focus), visible once the
 *              3D switch is turned off, and the choice persists in localStorage across a reload
 *   mobile     every page at 390 px wide has no horizontal scroll
 *
 * The harness reads src/data/pages.ts (through tsx) and the build in dist/client
 * to know which pages to expect.
 *
 * Environment:
 *   BASE             site to test, default http://localhost:4399
 *   PROOF_DIR        where results.json goes, default ./proof-out
 *   STEPS            comma list of steps to run, default all; an unknown step, or none, exits 1
 *   PLAYWRIGHT_CORE  path to a playwright-core package outside the repo (else normal resolution)
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsImport } from 'tsx/esm/api';

const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_CORE ? require(resolve(process.env.PLAYWRIGHT_CORE)) : require('playwright-core');

const BASE = (process.env.BASE ?? 'http://localhost:4399').replace(/\/$/, '');
const OUT = resolve(process.env.PROOF_DIR ?? './proof-out');
const GPU = ['--use-angle=d3d11', '--enable-gpu'];

const langOf = (path) => (path === '/en/' || path.startsWith('/en/') ? 'en' : 'nl');

// The site's pages come from src/data/pages.ts. A page the build has not produced
// is skipped, and listed when the harness starts. The build is read from disk, so a
// page the build made but the server fails to answer still fails; BASE only changes
// who is asked, not what is expected.
const DIST = resolve(fileURLToPath(new URL('../../dist/client', import.meta.url)));
const { pagePaths } = await tsImport('../../src/data/pages.ts', import.meta.url);
const built = (path) => existsSync(join(DIST, path, 'index.html'));
const SKIPPED = pagePaths().filter((path) => !built(path));
const PAGES = pagePaths()
  .filter(built)
  .map((path) => ({ path, lang: langOf(path) }));
/** The h1 of the home page, and of the country page used to move between pages and languages. */
const HOME_H1 = 'BOB CHUNG';
const CHINA_H1 = 'China';
/** The h1 of the not-found route (src/app/routes/not-found.tsx, in each language), as opposed to the root's HydrateFallback. */
const NOT_FOUND_H1 = { nl: 'Pagina niet gevonden', en: 'Page not found' };
/** Two URLs no page answers, one per language. */
const UNKNOWN = ['/does-not-exist/', '/en/does-not-exist/'];
/** The links the home page lists: three countries and three projects. */
const HOME_LINKS = ['/about/china/', '/about/netherlands/', '/about/aruba/', '/projects/funcial/', '/projects/jontai-energy/', '/projects/cookies-clicker/'];

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
async function openPage(browser, step, expected = () => false, viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ viewport });
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
  await page.waitForFunction(() => (window.__needleMounts ?? 0) >= 1 && document.querySelector('.scene-host canvas'), null, { timeout: 15_000 });
  await page.waitForTimeout(500);
}

const count = (text, pattern) => (text.match(pattern) ?? []).length;

// ---------------------------------------------------------------- the steps

async function routes(browser, step) {
  const { context, page } = await openPage(browser, step);
  for (const { path, lang } of PAGES) {
    const response = await page.goto(BASE + path, { waitUntil: 'load' });
    step.check(response?.status() === 200, `${path} answers 200 (got ${response?.status()})`);
    const html = (await response?.text()) ?? '';
    const prerendered = count(html, /<h1[\s>]/g);
    step.check(prerendered === 1, `${path} has one <h1> in its HTML (got ${prerendered})`);
    await stageReady(page);
    const hydrated = await page.locator('h1').count();
    step.check(hydrated === 1, `${path} has one <h1> after hydration (got ${hydrated})`);
    const htmlLang = await page.getAttribute('html', 'lang');
    step.check(htmlLang === lang, `${path} has <html lang="${lang}"> (got ${htmlLang})`);
    await takeCsp(page, step);
  }
  await context.close();
  return `${PAGES.length} pages: 200, one <h1>, <html lang>`;
}

async function slash(browser, step) {
  const bare = await fetch(`${BASE}/about/china`, { redirect: 'manual' });
  const location = bare.headers.get('location');
  const target = location ? new URL(location, BASE).href : null;
  step.check(bare.status === 301 && target === `${BASE}/about/china/`, `GET /about/china answers 301 to /about/china/ (got ${bare.status} ${location})`);

  const { context, page } = await openPage(browser, step);
  const documents = [];
  let loads = 0;
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url());
  });
  page.on('load', () => loads++);

  await page.goto(`${BASE}/about/china`, { waitUntil: 'load' });
  await stageReady(page);
  await page.waitForTimeout(1_500); // a reload loop would show by now
  const landed = documents.filter((url) => url === `${BASE}/about/china/`).length;
  const { type, mounts } = await page.evaluate(() => ({
    type: performance.getEntriesByType('navigation')[0]?.type,
    mounts: window.__needleMounts,
  }));
  step.check(page.url() === `${BASE}/about/china/`, `the browser ends at /about/china/ (got ${page.url()})`);
  step.check(landed === 1 && documents.length === 2, `one document load of /about/china/, after the 301 (got ${documents.join(' → ')})`);
  step.check(loads === 1 && type === 'navigate', `one load event, not a reload (got ${loads}, ${type})`);
  step.check(mounts === 1, `the Stage mounted once (got ${mounts})`);
  await takeCsp(page, step);
  await context.close();
  return `/about/china → 301 /about/china/, loaded once (${documents.join(' → ')})`;
}

async function persist(browser, step) {
  const { context, page } = await openPage(browser, step);
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
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
      mounts: window.__needleMounts,
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
  // to the country page is the keyboard's: focus its link and press Enter.
  await page.focus('a[href="/about/china/"]');
  await page.keyboard.press('Enter');
  await page.waitForURL(`${BASE}/about/china/`);
  await expectSame('link to /about/china/', 'nl', CHINA_H1);
  await page.click('a[href="/en/about/china/"]'); // the header's language switch
  await page.waitForURL(`${BASE}/en/about/china/`);
  await expectSame('link to /en/about/china/', 'en', CHINA_H1);
  await page.evaluate(() => history.back());
  await page.waitForURL(`${BASE}/about/china/`);
  await expectSame('history.back() to /about/china/', 'nl', CHINA_H1);

  step.check(documents.length === 0, `client navigation only, no document load (got ${documents.join(', ') || 'none'})`);
  await takeCsp(page, step);
  await context.close();
  return `${visited.join(' → ')}: one mount, one <canvas>`;
}

async function notFound(browser, step) {
  // The one console error this step expects: Edge reports a document that answers 404 as
  // "Failed to load resource", for the page being loaded and for nothing else.
  let asking = null;
  const documentNotFound = (message) => /status of 404/.test(message.text()) && message.location().url === BASE + asking;
  const { context, page } = await openPage(browser, step, documentNotFound);
  let documents = [];
  let loads = 0;
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url());
  });
  page.on('load', () => loads++);

  for (const path of UNKNOWN) {
    documents = [];
    loads = 0;
    const lang = langOf(path);
    asking = path;
    const response = await page.goto(BASE + path, { waitUntil: 'load' });
    step.check(response?.status() === 404, `${path} answers 404 (got ${response?.status()})`);
    const html = (await response?.text()) ?? '';
    step.check(html.includes('name="robots" content="noindex"'), `${path} is served noindex`);
    step.check(count(html, /<title>[^<]+<\/title>/g) === 1, `${path} has one <title> in its HTML`);
    step.check(!html.includes('__CSP__'), `${path} carries its real policy`);

    await stageReady(page);
    await page.waitForTimeout(1_500); // a reload loop would show by now
    const state = await page.evaluate(() => ({
      titles: document.querySelectorAll('title').length,
      h1: [...document.querySelectorAll('h1')].map((h1) => h1.textContent),
      lang: document.documentElement.lang,
      type: performance.getEntriesByType('navigation')[0]?.type,
      mounts: window.__needleMounts,
      url: location.pathname,
    }));
    step.check(state.h1.length === 1 && state.h1[0] === NOT_FOUND_H1[lang], `${path} shows the not-found route's <h1> "${NOT_FOUND_H1[lang]}" after hydration (got ${JSON.stringify(state.h1)})`);
    step.check(state.titles <= 1, `${path} has at most one <title> after hydration (got ${state.titles})`);
    step.check(state.lang === lang, `${path} has <html lang="${lang}"> after hydration (got ${state.lang})`);
    step.check(state.url === path, `the browser stays at ${path} (got ${state.url})`);
    step.check(documents.length === 1 && loads === 1 && state.type === 'navigate', `${path} loads one document, no reload (got ${documents.length} requests, ${loads} loads, ${state.type})`);
    step.check(state.mounts === 1, `${path}: the Stage mounted once (got ${state.mounts})`);
    await takeCsp(page, step);
  }
  step.check(step.expected.length === UNKNOWN.length, `the browser reported the 404 of each unknown URL once, and only those (got ${step.expected.length} for ${UNKNOWN.length} URLs)`);
  await context.close();
  return `${UNKNOWN.join(', ')}: 404, the not-found <h1>, one document load`;
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
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await stageReady(page);

  // 3D on (the default): the six links are in the HTML and reachable by keyboard, but not shown.
  const hrefs = await page.$$eval('.home-nav a', (links) => links.map((link) => link.getAttribute('href')));
  step.check(JSON.stringify(hrefs) === JSON.stringify(HOME_LINKS), `the home nav links the three countries and three projects (got ${hrefs.join(' ')})`);
  step.check((await page.getAttribute('html', 'data-3d')) === 'on', 'the page says data-3d="on" after hydration');
  step.check(visuallyHidden(await boxOf(page, '.home-nav')), 'with 3D on, the home nav is visually hidden');
  await page.focus('.home-nav a');
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('href'));
  step.check(focused === HOME_LINKS[0], `a hidden link can take focus (got ${focused})`);
  const shown = await boxOf(page, '.home-nav');
  step.check(shown !== null && shown.height > 100, `the nav is shown while a link has focus (got ${JSON.stringify(shown)})`);
  await page.evaluate(() => document.activeElement?.blur());

  // 3D off: the nav is shown, and the choice survives a reload.
  await page.click('button[role="switch"]');
  step.check((await page.getAttribute('html', 'data-3d')) === 'off', 'the switch sets data-3d="off"');
  step.check((await page.evaluate(() => localStorage.getItem('needle-3d'))) === 'off', 'the switch stores needle-3d = off');
  const open = await boxOf(page, '.home-nav');
  step.check(open !== null && open.height > 100, `with 3D off, the home nav is shown (got ${JSON.stringify(open)})`);
  await takeCsp(page, step);
  await page.reload({ waitUntil: 'load' });
  await stageReady(page);
  await page.waitForFunction(() => document.documentElement.getAttribute('data-3d') === 'off', null, { timeout: 5_000 });
  step.check((await page.textContent('button[role="switch"]')) === '3D uit', 'after a reload, the switch still says "3D uit"');

  // And back on.
  await page.click('button[role="switch"]');
  step.check((await page.evaluate(() => localStorage.getItem('needle-3d'))) === 'on', 'switching back stores needle-3d = on');
  step.check(visuallyHidden(await boxOf(page, '.home-nav')), 'with 3D on again, the home nav is hidden again');
  await takeCsp(page, step);
  await context.close();
  return 'six links; hidden but focusable with 3D on, shown with 3D off, the choice stored';
}

async function mobile(browser, step) {
  const { context, page } = await openPage(browser, step, () => false, { width: 390, height: 844 });
  for (const { path } of PAGES) {
    await page.goto(BASE + path, { waitUntil: 'load' });
    await stageReady(page);
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

const STEPS = { routes, slash, persist, 'not-found': notFound, 'home-nav': homeNav, mobile };

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

mkdirSync(OUT, { recursive: true });
console.log(`note: ${PAGES.length} pages checked: ${PAGES.map((p) => p.path).join(' ')}`);
console.log(`note: ${SKIPPED.length} pages of pagePaths() not built yet, skipped: ${SKIPPED.join(' ') || 'none'}`);
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: GPU });
const results = [];
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

writeFileSync(
  join(OUT, 'results.json'),
  JSON.stringify(
    {
      base: BASE,
      ranAt: new Date().toISOString(),
      pages: PAGES.map((p) => p.path),
      skipped: SKIPPED,
      steps: results.map(({ id, pass, checks, errors, expected, csp, seconds }) => ({ id, pass, seconds, checks, errors, expected, csp })),
    },
    null,
    2,
  ),
);
process.exitCode = results.every((step) => step.pass) ? 0 : 1;
