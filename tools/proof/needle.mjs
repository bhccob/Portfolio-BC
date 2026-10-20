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
 *   case-variant  a real page under another spelling (/About/China/, /en/projects/FUNCIAL/) is a 404 on
 *              GitHub Pages and shows the not-found page, not an error screen (the server here is
 *              case-sensitive too, so the fallback is what answers)
 *   esc        the back link on a country or project page: Escape goes to the home page of that
 *              language by client navigation, unless focus is in a text field or the key was already
 *              handled; the "Esc" hint is aria-hidden and hidden on a touch screen
 *   lite       /lite/ and /en/lite/: one <h1>, every section's heading (from the dictionary) in order and
 *              no skipped level, the real portrait loaded with its alt text and size, at least five
 *              <details> that open by keyboard with a visible focus ring, #career where the old /career/
 *              addresses land, no terminal or engine-room copy, and the page complete with JavaScript off.
 *              /contact/ and /en/contact/: an empty submit names the first bad field and moves focus to
 *              it; with no access key in the build, a filled form navigates to a mailto: link to Bob (the
 *              navigation is cancelled in the page, so no mail client opens) and shows the "almost
 *              there" panel; with a key (a CI build) the form carries it and, with Web3Forms answered by
 *              this harness (nothing is sent), posts once, shows success, holds the guards against scripts
 *              and the pause, and shows the error of a failed post
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
const { Translator } = await tsImport('../../src/i18n/Translator.ts', import.meta.url);
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
/**
 * Real pages under another spelling. GitHub Pages is case-sensitive, so each is a 404 served the
 * fallback, but the router used to match them case-insensitively and a route module threw on them.
 */
const CASE_VARIANTS = ['/About/China/', '/en/About/China/', '/Projects/Funcial/', '/en/projects/FUNCIAL/'];
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

/** Each URL answers 404 with the fallback, and the not-found page shows once the router has taken over. */
async function expectNotFound(browser, step, urls) {
  // The one console error this check expects: Edge reports a document that answers 404 as
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

  for (const path of urls) {
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

  // On a country page the back link says what Escape does, and Escape does it through the router.
  await page.goto(`${BASE}/about/china/`, { waitUntil: 'load' });
  await stageReady(page);
  documents.length = 0;
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
  step.check(pathname() === '/about/china/', `Escape in a text field stays on the page (got ${pathname()})`);
  await page.evaluate(() => document.getElementById('esc-probe')?.remove());

  // ... nor when something else has already handled the key.
  await page.evaluate(() => {
    window.__eatEscape = (event) => event.preventDefault();
    window.addEventListener('keydown', window.__eatEscape, true);
  });
  await pressEscape();
  step.check(pathname() === '/about/china/', `Escape that was already handled stays on the page (got ${pathname()})`);
  await page.evaluate(() => window.removeEventListener('keydown', window.__eatEscape, true));

  await page.keyboard.press('Escape');
  await page.waitForURL(`${BASE}/`, { timeout: 5_000 });
  step.check((await page.textContent('h1')) === HOME_H1, 'Escape on /about/china/ lands on the home page');
  step.check(documents.length === 0, `by client navigation, no document load (got ${documents.join(', ') || 'none'})`);
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
  await phone.goto(`${BASE}/about/china/`, { waitUntil: 'load' });
  await stageReady(phone);
  const hint = await phone.evaluate(() => getComputedStyle(document.querySelector('.back-hint')).display);
  step.check(hint === 'none', `on a coarse pointer the Esc hint is hidden (display ${hint})`);
  step.check((await phone.locator('a.back').isVisible()) === true, 'the back link itself stays visible on a phone');
  await touch.close();
  return 'Escape goes home (/ and /en/) by client navigation; not in a field, not once handled; the hint is hidden on touch';
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
  await stageReady(page);

  // The sections, by their headings (the dictionary's own words), in the order of the page.
  const headings = [t.nav.about, t.nav.work, t.about.title, t.skills.title, t.career.title, t.life.title, t.compass.qa.title, t.cta.title].map(plain);
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
  await stageReady(page);
  const top = await page.$eval('#career', (el) => el.getBoundingClientRect().top);
  step.check(top > -5 && top < 450, `${path}#career scrolls the section into view (top ${Math.round(top)} px)`);

  // The words of the engine room and the terminal are not here.
  const body = await page.innerText('main');
  for (const string of [t.hood.title, t.hood.intro, t.terminal.welcome, t.about.clock.label].map(plain)) {
    step.check(!body.includes(string), `${path} does not carry "${string}"`);
  }

  // Every link in the page's own lists goes to a page of the site.
  const internal = await page.$$eval('main a[href^="/"]', (links) => links.map((link) => link.getAttribute('href')));
  const prefix = lang === 'en' ? '/en' : '';
  for (const href of [`${prefix}/about/china/`, `${prefix}/about/netherlands/`, `${prefix}/about/aruba/`, `${prefix}/projects/funcial/`, `${prefix}/projects/jontai-energy/`, `${prefix}/projects/cookies-clicker/`, `${prefix}/contact/`]) {
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
    step.check((await page.locator('main h2').count()) === 8, `${path} has all eight sections with JavaScript off (got ${await page.locator('main h2').count()})`);
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
  await stageReady(page);
  // The form is there, and the page has hydrated: from then on the page validates, not the browser (noValidate).
  await page.waitForFunction(() => document.querySelector('form.form')?.noValidate === true, null, { timeout: 10_000 });
  step.check((await page.locator('h1').count()) === 1, `${path} has one <h1>`);
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
 * (a form filled in at once, a ticked honeypot), the pause after a sent message, and an answer that fails.
 */
async function contactKeyed(browser, step, lang) {
  const { t } = new Translator(lang);
  const c = t.contact;
  const path = CONTACT[lang];
  const posts = [];
  let answer = { status: 200, body: { success: true } };
  const failing = (message) => /Web3Forms answered 500|status of 500/.test(message.text());
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

  // A form filled in at once is a script: it is told it worked, and nothing is posted.
  await open();
  await fill();
  await page.click('button[type="submit"]');
  step.check((await title()) === c.successTitle && posts.length === 0, `${path}: a form filled in at once shows success and posts nothing (posted ${posts.length})`);

  // A ticked honeypot is a script too, however long it took.
  await open();
  await page.waitForTimeout(3_200);
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
  await takeCsp(page, step);
  await context.close();

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
  await takeCsp(retry, step);
  await failed.context.close();
}

async function lite(browser, step) {
  for (const lang of ['nl', 'en']) await liteOne(browser, step, lang);
  await liteWithoutScript(browser, step);
  const summaries = [];
  for (const lang of ['nl', 'en']) summaries.push(await contactOne(browser, step, lang));
  return `/lite/ and /en/lite/: eight sections, portrait, details, #career, no script needed; ${summaries.join('; ')}`;
}

const STEPS = { routes, slash, persist, 'not-found': notFound, 'case-variant': caseVariant, 'home-nav': homeNav, mobile, esc, lite };

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
