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

- The site is engineered across two languages, each in the role it suits: TypeScript/Astro for the site and a Python auditor that guards every deploy.
- It pairs that with a story no neighbouring portfolio can copy: born and raised in Aruba, Chinese by heritage, living in Rotterdam since 18, and a former powerlifter and table tennis player.

## Operating Context

- **Languages:** Dutch at `/` (the default, at the owner's request) and English at `/en/`, as separate crawlable pages. The old `/nl/` addresses redirect to the root.
- **Contact:** a dedicated `/contact` page. Messages go through Web3Forms, and the form falls back to `mailto:` until an access key is configured. GitHub, Instagram and email (bhccob@gmail.com) are the visible channels.
- **Hosting:** a static site on GitHub Pages under the custom domain bhccob.me (behind Cloudflare), built and deployed by GitHub Actions.
- **Maintainer:** Bob edits content himself. Copy lives in `src/i18n/en.ts` and `src/i18n/nl.ts`, and projects, skills and profile data live in `src/data/`.

## Capabilities and Constraints

- **Home page:**
  - A name-first hero (chosen 2026-10-12): BOB CHUNG as giant outlined type with a yellow lens that follows the pointer, the ping-pong ball as the O in BOB, the motto and role line beneath.
  - Work as category prints only: Web development (Jontai Energy, Cookies Clicker) and Game development (Cookies Clicker), plus an empty slot for a future "systems & security" category and a note that earlier work exists but is not listed. The home page never lists the projects themselves.
  - About, with the route China → Aruba → Rotterdam.
  - Toolkit.
  - Off duty: hobbies, current and former, as departure rows.
  - Current build & roadmap: MBO 4 now, an HBO degree in a technical field next (programme not chosen yet), then possible future roles behind a dropdown.
  - Engine room ("this site is a project too").
  - Final call to the contact page.
- **Other pages and extras:** a page per category (`/projects/web-development/`, `/projects/game-development/`) that opens on its newest project and switches between the projects in that category with tabs, Previous / Next, arrow keys and swipes; a contact page; a 404 page; a `/` terminal easter egg. Every page has a share image rendered at build time.
- **Owner constraints:**
  - The career section must **not** be the main focus.
  - No collaboration wording for now.
  - The site stays highly interactive, SEO-friendly and object-oriented in code.
  - No playable game on the site itself (owner, 2026-10-13): the off-duty physics playground, its trick-shots mini-game, the C/WebAssembly engine behind it and the Konami code were removed at the owner's request. Game projects such as Cookies Clicker stay listed.
  - Projects are grouped by software discipline (owner, 2026-10-12); a project may sit in more than one category (Cookies Clicker is both a web and a game project) and is indexed at its first category. The site states that more projects are coming and that earlier, unlisted projects exist.
  - The site must feel smooth on ordinary laptops; heavy effects only animate transforms, opacity or clips.
  - Future roles are presented as possible destinations, not fixed plans.
  - No heavy bordered boxes: rows, rules and tiles instead.
- **Terminology:**
  - Current occupation: "Student Software Engineer".
  - Next step: an HBO degree in technology after the MBO 4 ("HBO · Technologie"); the specific programme is open.
  - Possible future careers (interests, never presented as plans): "Systems Engineer", "Firmware Security Automation Engineer", "Security Engineer", "Site Reliability Engineer (SRE)", "Data Engineer" and "MLOps Engineer". The owner wrote "System Engineer"; the site uses the standard title "Systems Engineer". On the site they sit behind one "Possible future roles" dropdown so the roadmap stays uncluttered.
  - Projects are labelled "Project #01", "#02", and so on.
- **Technical:** static output only, so there is no server-side code. Security headers are impossible on GitHub Pages, so the Content-Security-Policy ships as a meta tag. Visitor statistics are cookie-free (Cloudflare Web Analytics) and only load when a token is configured. The local toolchain is Node only; the Python tooling runs in CI.
- **Open decisions:**
  - The school's name is not stated (only "MBO 4, Rotterdam").
  - The Web3Forms key is not configured yet.
  - The Cloudflare Web Analytics token is not configured yet.
  - The exact HBO programme is not chosen yet (the site names example directions: HBO-ICT, Computer Science, Embedded Systems Engineering).
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

- **Cookies Clicker:** a web game built as a **school project** in 2025. Listed under game development (its home) and web development.
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
- **Skills** (owner's own framing, 2026-10-11):
  - A solid full-stack foundation: core languages (HTML, CSS, JavaScript, PHP, C#), SQL, Godot and frameworks (Laravel, Tailwind CSS).
  - Specialising toward the possible future roles (systems, firmware, security, automation).
  - Currently learning to use AI as an advantage in their work.
  - Curious about embedded systems and electronics.
- **Absent, so never fabricate:** testimonials, clients, employers, internships, awards, certificates, grades, usage statistics, the school's name and sports records.

## Product Principles

1. **Memorable over generic.** Every section should leave an impression of Bob as a specific person, not a template student.
2. **Show, don't claim.** The working site (audited deploys, bilingual pages) is the proof of skill; experience is never inflated.
3. **Label work honestly.** Personal and practice projects are called exactly that, and no proof is invented.
4. **Person first, career second.** The career roadmap is present but never the headline.
5. **Clear at a glance, rewarding up close.** The audience is mixed, so the first viewport must say who Bob is without prior context, and deeper sections reward the curious.
