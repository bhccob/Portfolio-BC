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

The dev server runs at `http://localhost:4321`.

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the dev server |
| `npm run build` | Builds the static site into `dist/`, share images included |
| `npm run preview` | Serves the production build locally |
| `npm run audit` | Runs the Python site auditor on `dist/` (needs Python 3.10+) |
| `npm run build:icons -- --force` | Re-renders the app icons from `public/favicon.svg` |

To run the Python tests: `python -m unittest discover tools`.

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
- **Projects**: `src/data/projects.ts`. Put the screenshot in `src/assets/`, name its file in `image`, and list the
  categories the project belongs to (the first one is its home). It appears on that category's page in both
  languages, gets its own share image, and the category print on the home page counts it.
- **Categories**: `src/data/categories.ts` (title, intro and icon per category)
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

- **Content-Security-Policy**: GitHub Pages cannot send response headers, so Astro writes the policy into a
  `<meta>` tag on every page, with hashes of every script and style it emits (`security.csp` in
  `astro.config.mjs`). Only same-origin resources load, plus Web3Forms and the Cloudflare beacon.
- **What a meta tag cannot do**: `frame-ancestors` (clickjacking protection) and HSTS only work as headers. If the
  site ever moves behind a host or proxy that can set headers (for example Cloudflare), add them there.
- `public/.well-known/security.txt` tells people how to report a problem.
- The Python auditor fails the build if a page loses its CSP, links to a new tab without `rel="noopener"`, loads
  anything over plain `http://`, or if a redirect page is indexable.
- GitHub runs CodeQL on the TypeScript and Python code, and Dependabot opens weekly update pull requests.

## Deployment

Every push to `main` runs `.github/workflows/deploy.yml`: it checks dependencies with `npm audit`, builds, runs
the auditor tests, audits `dist/`, runs Lighthouse (accessibility, SEO and best practices must
score 95+, 95+ and 90+) and publishes the site to GitHub Pages. One-time setup: **Settings → Pages → Build and
deployment → Source: GitHub Actions**, and tick **Enforce HTTPS**.

## Easter eggs

- Press <kbd>/</kbd> (or <kbd>Ctrl</kbd>+<kbd>K</kbd>) anywhere for a small terminal. Try `help`.
- Move over the name in the hero; click it.
- On a category page, <kbd>←</kbd> and <kbd>→</kbd> switch projects.
