# bhccob.me: Bob Chung's portfolio

Personal portfolio of Bob Chung, a student software engineer in Rotterdam.
It's built with three languages, each doing the job it's best at:

| Part | Language | Where |
| --- | --- | --- |
| The site | **TypeScript** with [Astro](https://astro.build) (static, SEO-friendly HTML; every interactive feature is a class) | `src/` |
| The playground physics | **C**, compiled to WebAssembly | `native/` |
| The deploy guard | **Python** (stdlib only): audits every built page before release | `tools/` |

## Getting started

Requirements: Node.js 22.12 or newer. You don't need a C compiler: the C code is compiled by
[`@yowasp/clang`](https://www.npmjs.com/package/@yowasp/clang), a version of Clang that runs inside Node.

```bash
npm install
npm run dev
```

The dev server runs at `http://localhost:4321`.

| Command | What it does |
| --- | --- |
| `npm run dev` | Compiles `native/physics.c` (if changed), then starts the dev server |
| `npm run build` | Compiles the WebAssembly and builds the static site into `dist/` |
| `npm run preview` | Serves the production build locally |
| `npm test` | Runs the physics engine tests (`tests/physics.test.mjs`) against the compiled `.wasm` |
| `npm run audit` | Runs the Python site auditor on `dist/` (needs Python 3.10+) |
| `npm run build:og -- --force` | Regenerates the social preview image `public/og.png` |

To run the Python tests: `python -m unittest discover tools`.

## Project structure

```
native/            C physics engine (physics.c / physics.h) + build script
src/
  data/            profile, projects and skills: the content lives here
  i18n/            English and Dutch copy (nl.ts is type-checked against en.ts)
  layouts/         BaseLayout: <head>, SEO, structured data, header/footer
  components/      Astro components (home sections, UI pieces, contact form)
  views/           Page bodies shared by the English and Dutch routes
  pages/           Routes: Dutch at / and English at /en/ (thin wrappers around views)
  scripts/         Client-side TypeScript: core/, ui/ (flap board, loader, cursor, grid, scroll), hero/ (physics playground), contact/, fun/
  styles/          Design tokens and base styles
tests/             Node tests for the WebAssembly physics engine
tools/             Python site auditor (+ unit tests) and the OG image generator
public/            Static files: CNAME, favicon, og.png, robots.txt, old-URL redirects
```

### Editing content

- **Text** (both languages): `src/i18n/en.ts` and `src/i18n/nl.ts`
- **Projects**: `src/data/projects.ts`. Add an entry with an image in `src/assets/` and it gets a numbered chapter on the home page plus its own case-study page at `/projects/<slug>/`, in both languages.
- **Skills**: `src/data/skills.ts`
- **Links / email / birthday**: `src/data/profile.ts` (the age on the site is calculated from the birthday)

## Contact form

The form sends messages through [Web3Forms](https://web3forms.com) (free). Create an access key with your email address, then:

- locally: copy `.env.example` to `.env` and set `PUBLIC_WEB3FORMS_KEY`
- on GitHub: **Settings → Secrets and variables → Actions → Variables**, add `PUBLIC_WEB3FORMS_KEY`

Without a key the form still works: it opens the visitor's email app with the message filled in.

## Deployment

Every push to `main` runs `.github/workflows/deploy.yml`, which builds, runs the physics and auditor
tests, audits `dist/` and publishes it to GitHub Pages. One-time setup: **Settings → Pages → Build and
deployment → Source: GitHub Actions**.

## Easter eggs

- Press <kbd>/</kbd> (or <kbd>Ctrl</kbd>+<kbd>K</kbd>) anywhere for a small terminal. Try `help`.
- On the home page, type anything while the departures board is in view: the board spells it.
- Press <kbd>G</kbd> while the Off duty playground is in view to toggle gravity.
- Keep the ping-pong ball in the air for a rally score.
- ↑ ↑ ↓ ↓ ← → ← → B A
