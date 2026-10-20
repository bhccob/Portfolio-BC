# Project discovery (§7A)

Status: **approved by Bob on 2026-10-20**: all three proposals as sketched. His answers are
recorded at the end. Project assets (A07 plates, A08 meshes) may now be planned within the credit
budget.

What this covers, for Funcial, Jontai Energy and Cookies Clicker:
- the facts: purpose, audience, stack, role, links, dates
- 3–5 architecture layers, each `verified` (with the file it was seen in) or `inferred`
- a proposed category, object, palette accent, motion signature and hover behaviour
- a proposed `src/data/projects.ts` block (text only; the file is not created here)

**Sources** (read only, nothing in them was changed):

| Project | Source read | State |
|---|---|---|
| Funcial | `C:\Users\bhcco\Downloads\Funcial` (bhccob/Funcial) | `HEAD` (clean working tree); screenshots from its local builds `dist/` and `site-dist/` of 2026-10-18 |
| Jontai Energy | `C:\Users\bhcco\Documents\JE` (bhccob/JE) | `HEAD` only, exported with `git archive`; the uncommitted work is described separately and is not used |
| Cookies Clicker | a fresh clone of bhccob/Cookies-Clicker, `CookieClicker13-main/` | `HEAD` (`284ae97`) |

**Screenshots** are in [`docs/discovery/`](discovery/). Each project was served statically from a
scratch folder and captured with playwright-core and the installed Edge: 1440×900 for websites,
390×844 @2x for the phone app.

**Rule for every row below:** a fact is in the table only if it was seen in the code, the UI or the
git history. Anything else is `[FILL: …]`.

---

## 01 · FUNCIAL

### Facts

| | |
|---|---|
| Title | **Funcial**. `package.json` `name: "funcial"`, the page title and the README. Renamed from "Funancial" on 2026-10-18 (`fee214c`). |
| Purpose | A gamified personal finance tracker. It covers expenses, salary (with freezes), subscriptions, limits, goals, a stock/ETF portfolio with dividends and news, and a "Should I buy it?" check. All of it is wrapped in XP, levels, quests, streaks and badges, and it is local-first and encrypted on the device (README). |
| Audience | At first "Just them" (the owner): the design spec says *"Personal tool"*. Later it went out to friends: version 0.8 is the "first release to friends", with an account so that a friend can move to a new phone (accounts spec, 2026-10-17). |
| Stack | React 19, TypeScript, Vite 8, Tailwind CSS v4, React Router 8, Zustand, Zod, Dexie (IndexedDB) and Motion. On the phone: Capacitor 8 (Android), `@capacitor-community/sqlite` (SQLCipher) and native biometric unlock. Crypto: Web Crypto (AES-GCM, AES-KW, PBKDF2) and `hash-wasm` (Argon2id). Server: Vercel Functions and Upstash Redis. Tests: Vitest and Playwright (165 test files). **No AI:** the advisor was removed on 2026-10-16 (`ec0fb39`, "refactor: remove the AI advisor"). |
| Role | Sole developer: all 337 commits are by Bob (`bob`, `bhccob`). |
| Links | Live (download page, Bob approved linking it on 2026-10-18): https://funcial.vercel.app/get · Repo: https://github.com/bhccob/Funcial |
| Dates | Repo created 2026-10-14; last push 2026-10-18. The release is APK 0.8. |

### Architecture layers (test points)

| TP | Label | Status | What the code does | Evidence |
|---|---|---|---|---|
| TP1 | **LOG** | verified | Expenses and income are entered and written as encrypted records. | `src/features/add/` (AddScreen, ExpenseForm, IncomeForm), `src/store/financeActions.ts`, `src/data/repository.ts` |
| TP2 | **GAME LAYER** | verified | Every write is settled into XP, levels, quests, streaks, badges, challenges and a cosmetic shop. A logged expense pays 10 XP, for at most 5 a day. Coins have no money value. | `src/domain/game/{engine,ledger,levels,quests,streaks,badges,challenges,shop,rules}.ts` |
| TP3 | **MONEY RULES** | verified | Budgets and limits have the levels ok, warn, over and way-over (the download page names the 80%, 100% and 120% warnings). Also here: salary with freezes, goals, income, recurrence, alerts, and the buy rules. | `src/domain/{budget,salary,goals,income,recurrence,alerts}.ts`, `src/domain/advisor/rules.ts` |
| TP4 | **VAULT** | verified | Each record is encrypted with AES-GCM-256 and bound to its slot by AAD. The data key is wrapped by a device key (AES-KW) or by a PIN or passphrase (PBKDF2, 600,000 iterations). On Android the store is SQLCipher, with biometric unlock. The account copy is sealed with Argon2id (64 MiB, 3 passes): the server sees only an auth key, the wrapped key and sealed copies. | `src/data/{crypto,keys,keyring,sqliteStorage,accountCrypto}.ts`, `src/platform/android/biometric.ts` |
| — | **RESULT** | verified (as the buy-meter verdict) | No layer is called "result". **Bob's choice: RESULT is the buy-meter verdict.** The buy meter reads the other layers (limits, available balance, emergency fund, goals) and gives a 0–100 meter. Its zones are skip (0–33), wait (34–66) and buy (67–100); guards cap it at wait. The verdict is buy, wait, cheaper or skip, each with a confidence. On focus, the fifth bead lights and the phone shows the meter. | `src/domain/advisor/meter.ts`, `rules.ts`; screenshot `funcial-app-verdict.webp` |

### Screenshots

| File | What it shows |
|---|---|
| `funcial-get-hero.webp` | The download page (live at funcial.vercel.app/get), first view |
| `funcial-get-story.webp` | The download page's scroll story: the "02 · Budget" beat on the canvas phone (`site/get/screens.ts`) |
| `funcial-app-welcome.webp` | The app's welcome screen (390×844) |
| `funcial-app-home.webp` | Home with demo money: available to spend, the streak, coins and level ring, the spending donut |
| `funcial-app-budget.webp` | Budget limits |
| `funcial-app-buy.webp` | "Should I buy it?" ask form |
| `funcial-app-verdict.webp` | A buy-meter answer: 55%, "Wait a few days", confidence low, with its facts |
| `funcial-app-quests.webp` | Quests: level 6 "Bronze Saver", XP bar, streaks |

### Proposal (given by the brief, refined)

| | |
|---|---|
| Category | `01 — SECURE ELEMENT` (given; it fits: a secure element is the chip that keeps keys, and the VAULT layer is the heart of the app) |
| Object | **A hard-drive platter with a glowing track and four pins (TP1–TP4), plus a lacquered abacus and a phone**, as in ref-04 and ref-05. The abacus beads are the same layers shown a second way. The phone plays the app's real screens: the four canvas screens of `site/get/screens.ts` (Home, Budget, Buy it?, Levels) are drawn on a canvas texture, as demo money, never AI. |
| Material | Mirror-polished platter aluminium; purple lacquer with gold leaf for the abacus; black glass for the phone |
| Palette | accent `#7c5cff` (the app's own XP violet, `--color-xp` in its `tokens.css`) · glow: the ref-04 track gold (exact value from `docs/art-direction.md`) |
| Motion signature | **Continuous spin**: the platter turns slowly while a light pulse runs along the track from TP1 to TP4. On focus, the abacus beads slide up one by one. |
| Hover | Lift and glow. The read arm swings in over the track, and one pulse runs the length of the track. |

---

## 02 · JONTAI ENERGY

### Facts

| | |
|---|---|
| Title | **Jontai Energy** (the logo text `JONTAI ENERGY` and the page titles) |
| Purpose | A multi-page website for Jontai Energy, a solar and LED lighting company in Oranjestad, Aruba. The home page says it is *"Built for Aruba's climate, demand profile, and uptime expectations"*, and the contact page gives the address on Cumana. It introduces the business and its services and guides visitors to a quote. Its About page calls the company *"A Family Business Built on Clean Energy"*. It is a **personal project**, not client work. |
| Audience | Homes and businesses looking at solar or LED. The quote page's own wording is "Homes & business sites" and "Interior & exterior upgrades". |
| Stack | HTML, Tailwind CSS v4 (`@tailwindcss/cli`, `input.css` → `output.css`), CSS custom properties, vanilla JavaScript, and PowerShell (the i18n patch scripts) |
| Role | Design and front-end development. 28 of the 31 commits are Bob's. His brother Bryan made 3 small ones: two slogan tweaks, and a personal photo plus `.gitignore`. |
| Links | Repo: https://github.com/bhccob/JE. **No live link:** jontaienergy.com is Bryan's build and is not linked as Bob's. |
| Dates | First commit 2026-01-19; last push 2026-06-01. One local commit of 2026-10-18 (stop tracking `node_modules`) is not pushed. |

### Architecture layers (test points)

| TP | Label | Status | What the code does | Evidence |
|---|---|---|---|---|
| TP1 | **16 PAGES** | verified | The home page plus 15 pages: about, accessibility, contact, faq, location, news, privacy, quote, returns, service, socials, terms, warranty, why-us and work-with-us. They share one header (with a "Discover" dropdown) and one footer. | `index.html`, `pages/*/index.html` |
| TP2 | **DESIGN SYSTEM** | verified | Tailwind v4 with one component layer: about 9,100 lines in `input.css`, with green brand tokens (`--primary-green #00a650` … `--deep-green #002e16`). It is compiled to `output.css`. | `assets/css/input.css`, `package.json` scripts `build:css` / `watch:css` |
| TP3 | **THREE LANGUAGES** | verified | English, Spanish and Chinese dictionaries (`TRANSLATIONS.en/.es/.zh`), applied through `data-i18n` attributes (38–60 per page). The choice is kept in `localStorage` (`je_lang`). Two PowerShell scripts added the attributes across every page. Coverage is partial in the committed state: the navigation and headings switch, but some body copy stays English (see `je-home-zh.webp`). | `assets/js/main.js` (lines 64–647), `update-i18n.ps1`, `update-i18n-v2.ps1` |
| TP4 | **QUOTE PATH** | verified | The quote page offers three paths (Solar, LED, Combined). Each opens the contact page with `?type=…`, and the form there asks for topic, product type, installation type, property type, budget range and timeline. It is front-end only: the form's `action` is `#`, and no script reads `?type` yet. | `pages/quote/index.html`, `pages/contact/index.html` |
| (option) | CONSENT | verified | A cookie banner and a preferences modal (accept all, essential only, manage), saved as `je_cookie_consent_v1`, plus the legal pages. Kept as a possible fifth point; not in the proposal. | `assets/js/main.js` (lines 667–870) |

### Screenshots

| File | What it shows |
|---|---|
| `je-home.webp` | The home page: "Power Your Future", the "Operational snapshot" panel |
| `je-home-zh.webp` | The same page in Chinese: the headline and navigation switch |
| `je-quote.webp` | The quote page: "What Are You Looking For?" and its three steps |
| `je-enquiry-form.webp` | The contact page and its enquiry form |

### Uncommitted work (left out, Bob's choice)

The working copy in `Documents\JE` holds a large uncommitted change: 19 modified files
(+2,567 / −2,445 lines), new `site.css`, `home.css`, `pages.css` and `assets/media/*.webp`, and a new
page, **`pages/rewards/`**, called "Jontai Rewards". It is a loyalty-card demo:
- three tiers (Spark, Glow from 500 points, Radiant from 1,500)
- a points calculator ("example rate: 1 point for every Afl. 10")
- a card preview on joining, and a "Grid unstable / Solar online" toggle

Its script says *"Frontend only: nothing is sent anywhere"*. Because it is not committed, it is not
in the repo that the portfolio links to. **Bob: leave it out for now** and revisit once it is
committed and pushed. Then a REWARDS test point and new screenshots of the new look can be added.

### Proposal

| | |
|---|---|
| Category | `02 — FRONT PANEL`: the face of a device, the side the public sees and touches. Websites are a business's front panel. This also scales to later web projects. |
| Object | **A solar (photovoltaic) module of 16 cells, 4 × 4: one cell per page.** Silver busbars run across every cell: that is the one shared design system. A junction box on the frame has **three leads** (EN · ES · 中), the three languages. One output cable ends in a connector: the quote path, where the energy goes. |
| Material | Blue-black monocrystalline cells with silver fingers under anti-reflective glass; a satin anodised aluminium frame; a white backsheet at the edge |
| Palette | accent `#00a650` (the site's own `--primary-green`) · glow `#00d16a` (its `--accent-green`) |
| Motion signature | **Sun sweep and single-axis tilt** (no spin): a slow arc of light crosses the module, and the cells charge one by one in page order. The module turns a few degrees after the light, like a solar tracker. |
| Hover | The module tilts toward the cursor (tracker), the cell under the cursor charges green, and the busbars carry the glow to the junction box. On focus, the cells turn over one by one to show the real pages (screenshots as textures). |

---

## 03 · COOKIES CLICKER

### Facts

| | |
|---|---|
| Title | **Cookies Clicker** (Bob's choice). The page `<title>` says "Cookie Clicker", but the repo is "Cookies-Clicker" and the files are `Cookies_Clicker.js/.css`; the README says "CookieClicker13". "Cookies Clicker" matches today's site and the old URL `/projects/cookies-clicker/`, and keeps it apart from the well-known commercial game "Cookie Clicker". |
| Purpose | An incremental browser game: click the cookie, buy producers that bake automatically, add boosts and upgrades, and watch production compound. |
| Audience | A school project made for Web Game Development (Bob, 2026-10-20). |
| Stack | HTML, CSS, vanilla JavaScript, Bootstrap 5.3 (from a CDN) and `localStorage`. Bootstrap is not in today's portfolio stack; it is verified in `index.html`. |
| Role | Made **with a classmate, Yunis** (Bob, 2026-10-20). Bob's own part: `[FILL: which parts Bob built]`. Whether Yunis is named on the public site: `[FILL: ask Bob]`. Today's portfolio says "Design & development". |
| Links | Repo: https://github.com/bhccob/Cookies-Clicker. No live link: the repo has no GitHub Pages. |
| Dates | **2025** (confirmed by Bob). The repo history only starts 2026-09-15 ("whole project cloned from my school github"). |

### Architecture layers (test points)

| TP | Label | Status | What the code does | Evidence |
|---|---|---|---|---|
| TP1 | **CLICK LOOP** | verified | Each click adds the current click power, counts the click and pulses the cookie. The "CPS" upgrade raises click power, and its price grows ×3.25 each time. | `Cookies_Clicker.js` (cookie click handler, `buyMultiplier`) |
| TP2 | **8 PRODUCERS** | verified | One reusable `AutoClicker` class (base cost, output, cost growth ×1.1–1.3) with eight instances: Grandma, Supplier, Pastry Chef, Bakkerij, Bank, Fabriek, Temple and Corporation. Their output is paid on one production tick of 1,000 ms. | `Cookies_Clicker.js` lines 58–116, `startAutoProduction` |
| TP3 | **BOOSTS & EVENTS** | verified | The Chef Boost halves the tick for 15 s, then has a 5-minute cooldown. Random events: a 10%-a-second Grandma bonus roll and timed Supplier drops. There are 10 enhancements, and a Bakkerij × Pastry Chef synergy. | `Cookies_Clicker.js` (`chefBoost…`, `startGrandmaBonusTimer`, `startSupplierDropTimer`, `enh…`) |
| TP4 | **SAVE** | verified | The game state is saved to `localStorage` (`cookieGameSave`) every 15 s, with manual save, load and reset. Bought enhancements are kept as `enh_*` keys. | `Cookies_Clicker.js` (`getSaveData`, `saveGame`, `loadGame`, `resetGame`) |
| TP5 | **STATS** | verified | A statistics window with 13 counters: totals, current CPS, clicks, one count per producer, cookies spent and all-time. | `index.html` `#statsWindow`, `updateStats` |

### Screenshots

| File | What it shows |
|---|---|
| `cookies-start.webp` | A new game: the cookie, the store of eight producers plus CPS, Boosts and Enhancements |
| `cookies-playing.webp` | After 160 clicks, a CPS upgrade and a Grandma, with the statistics window open |

### Proposal

| | |
|---|---|
| Category | `03 — OSCILLATOR`: the part that makes a device tick. This game runs on timers (a 1,000 ms production tick, a 1 s bonus roll, a 15 s autosave), and games in general run on a loop. |
| Object | **An open clockwork movement.** The crown on its side is the click. A train of **eight wheels** that grow in size is the eight producers. The escapement and balance wheel beat once a second: the production tick, which beats twice as fast during a Chef Boost. A mainspring barrel is the save: it holds the stored state. The dial with sub-dials is the stats. |
| Material | Copper and caramel-toned wheels on a dark bridge, with ruby jewels. It is warm, but clearly not the void's gold. |
| Palette | accent `#c69255` (the game's own caramel, the first stop of its background gradient in `Cookies_Clicker.css`) · glow `[PROPOSE: ember orange, around #ff8a3d, checked against art-direction.md]` |
| Motion signature | **A discrete tick** (stop-start, not a smooth spin): the escapement beats at 1 Hz and the train moves one step per beat. Under a "boost" the beat doubles for a moment. |
| Hover | The crown presses in once (one click, with a soft tick if sound is on), and the whole train steps forward one beat. Lift, plus a caramel glow on the wheels. |

---

## Uniqueness check

| | Funcial | Jontai Energy | Cookies Clicker |
|---|---|---|---|
| Silhouette | a round mirror disc + an upright abacus + a phone | a flat rectangular 4 × 4 grid | an open stack of toothed wheels |
| Material | mirror aluminium, purple lacquer, glass | glass, silicon cells, anodised aluminium | copper, ruby jewels, a dark bridge |
| Accent | XP violet `#7c5cff` | solar green `#00a650` | caramel `#c69255` |
| Motion | continuous spin + a track pulse | light sweep + single-axis tilt | a discrete 1 Hz tick |
| Hover | the read arm swings in, a pulse runs | it tilts to the cursor, the cell charges | the crown presses, the train steps |
| Test points | 4 + RESULT (the buy-meter verdict) | 4 | 5 |

Labels in Dutch, suggested for the NL route (the copy is approved later, in M6):
- Categories: SECURE ELEMENT stays as it is, FRONTPANEEL, OSCILLATOR.
- Funcial: LOG, GAMELAAG, GELDREGELS, KLUIS, RESULTAAT.
- Jontai Energy: 16 PAGINA'S, DESIGNSYSTEEM, DRIE TALEN, OFFERTEPAD.
- Cookies Clicker: KLIKLUS, 8 PRODUCENTEN, BOOSTS & EVENTS, OPSLAG, STATISTIEKEN.

---

## Proposed `src/data/projects.ts` block

This is text only: the main session writes the file. Bob approved its content on 2026-10-20. The test-point
positions are placeholders in each object's local frame (units ≈ object radius), to be tuned in M5.
Palette values marked "art-direction" are filled in from `docs/art-direction.md`.

```ts
export type Project = {
  id: string; title: string; categoryId: string; compassPartId?: string; order: number;
  object: { glb?: string; plate?: string; video?: string; fallbackGeometry: string };
  testPoints: { id: string; label: string; position: [number, number, number] }[];
  palette: { accent: string; glow: string };
  motion: string;
  summary: string; stack: string[]; links: { live?: string; repo?: string };
};

export type Category = { id: string; number: number; label: string };

export const categories: Category[] = [
  { id: 'secure-element', number: 1, label: 'SECURE ELEMENT' },
  { id: 'front-panel', number: 2, label: 'FRONT PANEL' },
  { id: 'oscillator', number: 3, label: 'OSCILLATOR' },
];

export const projects: Project[] = [
  {
    id: 'funcial',
    title: 'FUNCIAL',
    categoryId: 'secure-element',
    order: 1,
    object: { fallbackGeometry: 'platter-track+abacus+phone' }, // plates A04/A05 after approval
    testPoints: [
      { id: 'tp1', label: 'LOG', position: [-0.62, 0.02, 0.48] },
      { id: 'tp2', label: 'GAME LAYER', position: [-0.31, 0.02, 0.71] },
      { id: 'tp3', label: 'MONEY RULES', position: [0.05, 0.02, 0.78] },
      { id: 'tp4', label: 'VAULT', position: [0.4, 0.02, 0.66] },
      { id: 'result', label: 'RESULT', position: [0.7, 0.02, 0.38] }, // the buy-meter verdict (Bob, 2026-10-20)
    ],
    palette: { accent: '#7c5cff', glow: '/* art-direction: ref-04 track gold */' },
    motion: 'slow platter spin + track pulse TP1→TP4; abacus beads slide up one by one on focus',
    summary: 'A gamified personal finance app for Android that keeps every record encrypted on the phone.',
    stack: ['React 19', 'TypeScript', 'Tailwind CSS v4', 'Zustand', 'Capacitor', 'SQLCipher', 'Web Crypto', 'Vercel Functions'],
    links: { live: 'https://funcial.vercel.app/get', repo: 'https://github.com/bhccob/Funcial' },
  },
  {
    id: 'jontai-energy',
    title: 'JONTAI ENERGY',
    categoryId: 'front-panel',
    order: 2,
    object: { fallbackGeometry: 'pv-module-4x4+junction-box' },
    testPoints: [
      { id: 'tp1', label: '16 PAGES', position: [-0.45, 0.03, -0.2] },
      { id: 'tp2', label: 'DESIGN SYSTEM', position: [0.0, 0.03, 0.05] },
      { id: 'tp3', label: 'THREE LANGUAGES', position: [0.62, 0.06, 0.55] },
      { id: 'tp4', label: 'QUOTE PATH', position: [0.95, 0.0, 0.8] },
    ],
    palette: { accent: '#00a650', glow: '#00d16a' },
    motion: 'sun sweep: a light arc crosses the module, cells charge in page order; single-axis tracker tilt',
    summary: 'A sixteen-page website in three languages for Jontai Energy, a solar and LED company in Aruba.',
    stack: ['HTML', 'Tailwind CSS v4', 'JavaScript', 'PowerShell'],
    links: { repo: 'https://github.com/bhccob/JE' }, // no live link: jontaienergy.com is not Bob's build
  },
  {
    id: 'cookies-clicker',
    title: 'COOKIES CLICKER', // Bob's choice over the page's own "Cookie Clicker" (2026-10-20)
    categoryId: 'oscillator',
    order: 3,
    object: { fallbackGeometry: 'clockwork-movement-8-wheels' },
    testPoints: [
      { id: 'tp1', label: 'CLICK LOOP', position: [0.92, 0.0, 0.0] },
      { id: 'tp2', label: '8 PRODUCERS', position: [-0.2, 0.08, 0.3] },
      { id: 'tp3', label: 'BOOSTS & EVENTS', position: [0.35, 0.1, -0.45] },
      { id: 'tp4', label: 'SAVE', position: [-0.55, 0.06, -0.35] },
      { id: 'tp5', label: 'STATS', position: [0.0, 0.14, 0.0] },
    ],
    palette: { accent: '#c69255', glow: '/* proposal: ember orange ≈ #ff8a3d, checked in art-direction */' },
    motion: 'discrete 1 Hz escapement tick, gear train steps per beat; beat doubles briefly on boost',
    summary: 'A browser incremental game: one click loop, eight producers and timed boosts, saved in the browser.',
    stack: ['HTML', 'CSS', 'JavaScript', 'Bootstrap 5', 'localStorage'],
    links: { repo: 'https://github.com/bhccob/Cookies-Clicker' },
  },
];
```

---

## Bob's answers

Asked on 2026-10-20, after inline sketches of the three objects (the platter, abacus and phone;
the 16-cell module; the clockwork movement), each with its motion signature animated.

| Question | Answer |
|---|---|
| Funcial: category, object and test points | **Approved as sketched**: `01 — SECURE ELEMENT`; platter + abacus + phone; TP1 LOG · TP2 GAME LAYER · TP3 MONEY RULES · TP4 VAULT; accent `#7c5cff` with the reference gold as glow |
| Funcial: what RESULT means, or drop it | **RESULT is the buy-meter verdict** (skip, wait, cheaper or buy, from `advisor/meter.ts` + `rules.ts`) |
| Jontai Energy: category, object and test points | **Approved as sketched**: `02 — FRONT PANEL`; the 16-cell solar module; 16 PAGES · DESIGN SYSTEM · THREE LANGUAGES · QUOTE PATH; accent `#00a650` (CONSENT not added) |
| Jontai Energy: does the uncommitted Rewards work belong in it? | **Leave it out for now**; revisit once it is committed and pushed |
| Cookies: category, object and test points | **Approved as sketched**: `03 — OSCILLATOR`; the clockwork movement; CLICK LOOP · 8 PRODUCERS · BOOSTS & EVENTS · SAVE · STATS; accent `#c69255` |
| Cookies: the title | **Cookies Clicker** |
| Cookies: context (asked in addition) | Made for **Web Game Development** at school |
| Cookies: alone or in a group (asked in addition) | **With a classmate, Yunis**. Bob's own part and whether Yunis is named on the site are still `[FILL]` |
| Cookies: year (asked in addition) | **2025** confirmed |

Still open after this round (none of it blocks M5):
- Cookies: Bob's own part in the build, and whether to name Yunis on the public site.
- The glow values marked "art-direction" are taken from `docs/art-direction.md` when it lands.
- Cookies' ember-orange glow (`≈ #ff8a3d`) is a proposal to check against that palette.
