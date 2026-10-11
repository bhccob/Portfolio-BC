# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A mixed audience with no single priority visitor; the owner confirmed it should work for everyone equally. That includes internship providers and future employers looking at a student developer, MBO 4 teachers and assessors, peers, and anyone arriving from Bob's GitHub (`bhccob`) or Instagram (`@bhccob`). Visitors use both desktop and phone.

## Product Purpose

The personal portfolio of Bob Chung at bhccob.me. It introduces who he is, his current occupation (student software engineer at MBO 4 in Rotterdam), the projects he has built and the direction he is heading, and it lets visitors message him directly from the site.

**Success means the visitor remembers him.** The confirmed primary goal is a distinct, memorable personal impression, unlike a template student portfolio. Contact and project case studies are supporting capabilities, not the success measure.

## Positioning

A student software engineer building toward systems and firmware security work, whose portfolio is itself the proof:

- The site is engineered across three languages, each in the role it suits: TypeScript/Astro for the site, a C physics engine compiled to WebAssembly for the playable hero, and a Python auditor that guards every deploy.
- It pairs that with a story no neighbouring portfolio can copy: born and raised in Aruba, Chinese by heritage, living in Rotterdam since 18, and a former powerlifter and table tennis player.

## Operating Context

- **Languages:** English at `/` (default) and Dutch at `/nl/`, as separate crawlable pages.
- **Contact:** a dedicated `/contact` page. Messages go through Web3Forms, and the form falls back to `mailto:` until an access key is configured. GitHub, Instagram and email (bhccob@gmail.com) are the visible channels.
- **Hosting:** a static site on GitHub Pages under the custom domain bhccob.me (behind Cloudflare), built and deployed by GitHub Actions.
- **Maintainer:** Bob edits content himself. Copy lives in `src/i18n/en.ts` and `src/i18n/nl.ts`, and projects, skills and profile data live in `src/data/`.

## Capabilities and Constraints

- **Home page:**
  - A departures-board hero: the name and project rows on split-flap tiles that flip in, live Rotterdam and Aruba clocks, and typing that spells across the board.
  - Numbered projects, each on its own skill "line": #01 Cookies Clicker (game development), #02 Jontai Energy (web development), #03 "next build boarding soon", plus a note that earlier work exists but is not listed.
  - About, with the route China → Aruba → Rotterdam.
  - Toolkit.
  - Off duty: hobbies and the physics playground (ping-pong rally mini-game and gravity toggle, C/WebAssembly).
  - Current build & roadmap (future roles labelled as possibilities).
  - Engine room ("this site is a project too").
  - Final call to the contact page.
- **Other pages and extras:** a case-study page per project, a contact page, a 404 page, a `/` terminal easter egg and the Konami code.
- **Owner constraints:**
  - The career section must **not** be the main focus.
  - No collaboration wording for now.
  - The site stays highly interactive, SEO-friendly and object-oriented in code.
  - Projects are shown separately because they are different kinds of work, and the site states that more projects are coming and that earlier, unlisted projects exist.
  - Future roles are presented as possible destinations, not fixed plans.
  - No heavy bordered boxes: rows, rules and tiles instead.
- **Terminology:**
  - Current occupation: "Student Software Engineer".
  - Future careers: "Systems Engineer" and "Firmware Security Automation Engineer". The owner wrote "System Engineer"; the site uses the standard title "Systems Engineer".
  - Projects are labelled "Project #01", "#02", and so on.
- **Technical:** static output only, so there is no server-side code. The local toolchain is Node only: C compiles through `@yowasp/clang`, and the Python tooling runs in CI.
- **Open decisions:**
  - The school's name is not stated (only "MBO 4, Rotterdam").
  - The Web3Forms key is not configured yet.
  - The GitHub Pages source still has to be switched to GitHub Actions.
  - Future projects are not yet chosen.

## Brand Commitments

- **Identity:** the name Bob Chung, the handle `bhccob` and the domain bhccob.me.
- **Colours:** purple and yellow are the main colours, with dark purple preferred. This is the owner's binding constraint.
- **Motifs:** low-key maths, tech and sports objects around the site. They are present but never dominant: "minimalistic, yet fun, modern and unique".
- **Voice:** first person, professional and formal, but personal. The owner asked for polished wording over casual phrasing.
- **Owner's own lines:**
  - "I build with curiosity and test with honesty."
  - "Home isn't one place for me. It's a blend of cultures and the questions I keep chasing."
  - "Overthinking is fear pretending to be logic."

## Evidence on Hand

- **Cookies Clicker:** a web game built as a **school project** in 2025.
  - Repo: https://github.com/bhccob/Cookies-Clicker. Screenshot: `src/assets/cookies.png`.
  - Built with HTML, CSS and JavaScript: a reusable AutoClicker class, timed boosts, random bonus events and saved progress via localStorage.
- **Jontai Energy:** a **personal project**: a practice website for a self-chosen solar-energy company, built in 2026. It is **not client work** and must never be described as such.
  - Repo: https://github.com/bhccob/JE. Screenshot: `src/assets/jontai-energy.png`.
  - Over 15 pages, built with HTML, Tailwind CSS and JavaScript, in English, Spanish and Chinese, with PowerShell scripts automating the translation markup.
- **Portrait:** `src/assets/portrait.jpg`.
- **Personal facts:**
  - Born 27-04-2006 (the site calculates his age).
  - Born and raised in Aruba, Chinese heritage, moved to the Netherlands at 18, lives in Rotterdam.
  - MBO 4 student.
  - Former powerlifter and table tennis player; now runs, goes to the gym and games.
- **Skills:**
  - Comfortable: HTML, CSS, JavaScript, PHP, Laravel, SQL, Godot.
  - Learning: C#.
  - Exploring next: C, Python, embedded systems, electronics.
- **Absent, so never fabricate:** testimonials, clients, employers, internships, awards, certificates, grades, usage statistics, the school's name and sports records.

## Product Principles

1. **Memorable over generic.** Every section should leave an impression of Bob as a specific person, not a template student.
2. **Show, don't claim.** The working site (physics engine, audited deploys, bilingual pages) is the proof of skill; experience is never inflated.
3. **Label work honestly.** Personal and practice projects are called exactly that, and no proof is invented.
4. **Person first, career second.** The career roadmap is present but never the headline.
5. **Clear at a glance, rewarding up close.** The audience is mixed, so the first viewport must say who Bob is without prior context, and deeper sections reward the curious.
