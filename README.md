# bhccob.me: Bob Chung's portfolio

Personal portfolio of Bob Chung, a student software engineer in Rotterdam.
It's built with two languages, each doing the job it's best at:

| Part | Language | Where |
| --- | --- | --- |
| The site | **TypeScript** with [Astro](https://astro.build) (static, SEO-friendly HTML; every interactive feature is a class) | `src/` |
| The deploy guard | **Python** (stdlib only): audits every built page before release | `tools/` |

## Getting started

Requirements: Node.js 22.12 or newer.

```bash
npm install
npm run dev
```

The dev server runs at `http://localhost:5173`.

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the dev server |
| `npm run build` | `react-router build` (prerenders every page), then `tools/build/postbuild.mjs`; the site is `dist/client/` |
| `npm run preview` | Serves `dist/client/` at `http://localhost:4399/` the way GitHub Pages does (`/x` redirects to `/x/`, unknown URLs get `404.html`) |
| `npm run audit` | Runs the Python site auditor on `dist/client/` (needs Python 3.10+) |
| `npm test` | Runs the unit tests (Vitest) |
| `npm run build:icons -- --force` | Re-renders the app icons from `public/favicon.svg` |

To run the Python tests: `python -m unittest discover tools`.

### What the build does after the prerender

`tools/build/postbuild.mjs` (run with `tsx`, as it reads `src/data/*.ts`) finishes `dist/client/`, in this order:

1. renames React Router's `__spa-fallback.html` to `404.html` and marks it `noindex`
2. writes a redirect page for every old URL in `src/data/redirects.ts` (they are generated, never kept in `public/`)
3. writes `sitemap-index.xml` and `sitemap-0.xml` with Dutch, English and `x-default` alternates for every path in
   `pagePaths()` (`src/data/pages.ts`)
4. renders `og.jpg` (1200 × 630) from `src/assets/renders/compass-hero.webp`
5. writes the Content-Security-Policy into every `.html` file (see Security)
6. copies `CNAME`

`react-router.config.ts` prerenders every path of `pagePaths()`, and the sitemap lists the same paths, so a page is
built and listed by having an entry in `PAGES` (`src/data/pages.ts`). Each entry also needs a route in
`src/app/routes.ts` and its words in both languages; `tests/unit/routes.test.ts` fails if a page has no route.

## Project structure

```
src/
  data/            profile, categories and projects: the content lives here
  i18n/            English and Dutch copy (nl.ts is type-checked against en.ts)
  layouts/         BaseLayout: <head>, SEO, CSP, structured data, header/footer
  components/      Astro components (home sections, UI pieces, contact form)
  views/           Page bodies shared by the English and Dutch routes
  pages/           Routes: Dutch at / and English at /en/, plus the share-image endpoints in og/
  og/              Renders the 1200 × 630 share images at build time, in the site's own fonts
  scripts/         Client-side TypeScript: core/, ui/, hero/ (name reveal), contact/, fun/
  styles/          Design tokens and base styles
tools/             Python site auditor (+ unit tests) and the icon renderer
public/            Static files: CNAME, icons, manifest, security.txt, robots.txt, old-URL redirects
```

### Editing content

- **Text** (both languages): `src/i18n/en.ts` and `src/i18n/nl.ts`
- **Projects**: `src/data/projects.ts`: for each project its category, test points (labelled in both languages), palette,
  links and the words of its page in both languages. A screenshot, if it has one, goes in `src/assets/` and is named in
  `image`. A new project also needs a `project-<id>` entry in `PAGES` (`src/data/pages.ts`).
- **Categories**: `src/data/categories.ts` (a number and a label in each language)
- **The needle redesign's words** (hero, loader, compass parts, countries and their pages): the `needle` block of the
  dictionaries; they are copied from `docs/art-direction.md` § Copy budget, and `tests/unit/needle-copy.test.ts` checks that they match it.
- **Links / email / birthday**: `src/data/profile.ts` (the age on the site is calculated from the birthday)

## Contact form

The form sends messages through [Web3Forms](https://web3forms.com) (free). Create an access key with your email address, then:

- locally: copy `.env.example` to `.env` and set `PUBLIC_WEB3FORMS_KEY`
- on GitHub: **Settings → Secrets and variables → Actions → Variables**, add `PUBLIC_WEB3FORMS_KEY`

Without a key the form still works: it opens the visitor's email app with the message filled in.
A hidden honeypot field, a minimum fill time and a one-minute pause after sending keep spam bots out.

## Visitor statistics

The site can count visits with [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/): free, no
cookies, so no consent banner is needed. Add a site in Cloudflare, copy its token, and set it as the
`PUBLIC_CF_ANALYTICS_TOKEN` Actions variable (same place as the Web3Forms key). Without a token no analytics
script is loaded and the footer does not mention statistics.

## Security

- **Content-Security-Policy**: GitHub Pages cannot send response headers, so the build writes the policy into a
  `<meta>` tag on every page (`tools/build/csp.mjs`: the root layout renders the tag with a `__CSP__` placeholder,
  `applyCsp` fills it with the sha256 of every inline script and style the page holds). No `'unsafe-inline'` or
  `'unsafe-eval'` for scripts, no workers. `applyCsp` fails the build if a script comes before the tag or the page has
  an inline event handler or a `javascript:` URL. Only same-origin resources load, plus Web3Forms and the Cloudflare
  beacon.
- **What a meta tag cannot do**: `frame-ancestors` (clickjacking protection) and HSTS only work as headers. If the
  site ever moves behind a host or proxy that can set headers (for example Cloudflare), add them there.
- `public/.well-known/security.txt` tells people how to report a problem.
- The Python auditor fails the build if a page loses its CSP, links to a new tab without `rel="noopener"`, loads
  anything over plain `http://`, or if a redirect page is indexable.
- GitHub runs CodeQL on the TypeScript and Python code, and Dependabot opens weekly update pull requests.

## Deployment

Every push to `main` runs `.github/workflows/deploy.yml`: it checks dependencies with `npm audit`, builds, runs
the auditor tests, audits `dist/client/`, runs Lighthouse (accessibility, SEO and best practices must
score 95+, 95+ and 90+) and publishes `dist/client/` to GitHub Pages. One-time setup: **Settings → Pages → Build and
deployment → Source: GitHub Actions**, and tick **Enforce HTTPS**.

## Easter eggs

- Press <kbd>/</kbd> (or <kbd>Ctrl</kbd>+<kbd>K</kbd>) anywhere for a small terminal. Try `help`.
- Move over the name in the hero; click it.
- On a category page, <kbd>←</kbd> and <kbd>→</kbd> switch projects.
