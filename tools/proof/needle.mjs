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
 * One exception, which turns itself off: while the served HTML still carries
 * the CSP meta's bare `__CSP__` placeholder (the post-build step that fills it
 * has not run), Edge's "directive name '__CSP__'" parse error is printed as a
 * note and not counted. Once the build fills the policy, that error counts.
 *
 *   routes   every prerendered page answers 200 with one <h1> (in its HTML and after hydration)
 *            and the right <html lang>
 *   slash    GET /probe answers 301 to /probe/; a browser opening /probe loads /probe/ once, with no reload
 *   persist  client links / → /probe/ → /en/probe/, then history.back(): the Stage mounted once and
 *            the same <canvas> node throughout, with no document load after the first
 *
 * Environment:
 *   BASE             site to test, default http://localhost:4399
 *   PROOF_DIR        where results.json goes, default ./proof-out
 *   STEPS            comma list of steps to run, default all; an unknown step, or none, exits 1
 *   PLAYWRIGHT_CORE  path to a playwright-core package outside the repo (else normal resolution)
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_CORE ? require(resolve(process.env.PLAYWRIGHT_CORE)) : require('playwright-core');

const BASE = (process.env.BASE ?? 'http://localhost:4399').replace(/\/$/, '');
const OUT = resolve(process.env.PROOF_DIR ?? './proof-out');
const GPU = ['--use-angle=d3d11', '--enable-gpu'];

/** Every prerendered page and its <html lang>, kept in step with react-router.config.ts by hand. */
const PAGES = [
  { path: '/', lang: 'nl' },
  { path: '/probe/', lang: 'nl' },
  { path: '/en/', lang: 'en' },
  { path: '/en/probe/', lang: 'en' },
];
const PROBE_H1 = 'Needle probe';
/** Edge's console error for the unfilled CSP placeholder. */
const UNFILLED_CSP_ERROR = /directive name '__CSP__'/;

// ---------------------------------------------------------------- the step runner

class Step {
  constructor(id) {
    this.id = id;
    this.checks = [];
    this.errors = [];
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

/** A fresh context and page that record console errors, page errors and CSP violations into the step. */
async function openPage(browser, step) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__cspViolations.push({ directive: e.violatedDirective, blocked: e.blockedURI, sample: e.sample });
    });
  });
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') step.errors.push(message.text());
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
  const bare = await fetch(`${BASE}/probe`, { redirect: 'manual' });
  const location = bare.headers.get('location');
  const target = location ? new URL(location, BASE).href : null;
  step.check(bare.status === 301 && target === `${BASE}/probe/`, `GET /probe answers 301 to /probe/ (got ${bare.status} ${location})`);

  const { context, page } = await openPage(browser, step);
  const documents = [];
  let loads = 0;
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url());
  });
  page.on('load', () => loads++);

  await page.goto(`${BASE}/probe`, { waitUntil: 'load' });
  await stageReady(page);
  await page.waitForTimeout(1_500); // a reload loop would show by now
  const landed = documents.filter((url) => url === `${BASE}/probe/`).length;
  const { type, mounts } = await page.evaluate(() => ({
    type: performance.getEntriesByType('navigation')[0]?.type,
    mounts: window.__needleMounts,
  }));
  step.check(page.url() === `${BASE}/probe/`, `the browser ends at /probe/ (got ${page.url()})`);
  step.check(landed === 1 && documents.length === 2, `one document load of /probe/, after the 301 (got ${documents.join(' → ')})`);
  step.check(loads === 1 && type === 'navigate', `one load event, not a reload (got ${loads}, ${type})`);
  step.check(mounts === 1, `the Stage mounted once (got ${mounts})`);
  await takeCsp(page, step);
  await context.close();
  return `/probe → 301 /probe/, loaded once (${documents.join(' → ')})`;
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

  await expectSame('/', 'nl', 'Bob Chung');
  await page.click('a[href="/probe/"]');
  await page.waitForURL(`${BASE}/probe/`);
  await expectSame('link to /probe/', 'nl', PROBE_H1);
  await page.click('a[href="/en/probe/"]');
  await page.waitForURL(`${BASE}/en/probe/`);
  await expectSame('link to /en/probe/', 'en', PROBE_H1);
  await page.evaluate(() => history.back());
  await page.waitForURL(`${BASE}/probe/`);
  await expectSame('history.back() to /probe/', 'nl', PROBE_H1);

  step.check(documents.length === 0, `client navigation only, no document load (got ${documents.join(', ') || 'none'})`);
  await takeCsp(page, step);
  await context.close();
  return `${visited.join(' → ')}: one mount, one <canvas>`;
}

const STEPS = { routes, slash, persist };

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
const cspUnfilled = (await (await fetch(`${BASE}/`)).text()).includes('content="__CSP__"');
if (cspUnfilled) console.log("note: the CSP placeholder is not filled yet; Edge's parse error for it is not counted");
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
    const errors = cspUnfilled ? step.errors.filter((text) => !UNFILLED_CSP_ERROR.test(text)) : step.errors;
    step.check(errors.length === 0, `no console or page errors (got ${errors.length}: ${errors.join(' | ')})`);
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
      cspUnfilled,
      steps: results.map(({ id, pass, checks, errors, csp, seconds }) => ({ id, pass, seconds, checks, errors, csp })),
    },
    null,
    2,
  ),
);
process.exitCode = results.every((step) => step.pass) ? 0 : 1;
