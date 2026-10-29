# Stack round 3: a slower drop, a glowing light, a clear end, no switches, Portle

Date: 2026-10-29. Branch `bob-stack-3`, from `main` at b4623fc (the redesign as it went live on bhccob.me that day).

## Why

Bob looked at the live site the evening it went up and asked for five things: the light "drops down too fast to the
project", "the lichte versie and 3d option to turn off should be removed", "the light is a bit too light and not bright",
"when it ends on stuur bericht i want it to be more obvious that it ends", and "update my project to current projects".
Each was settled with him in turn; the two that are seen were picked from mock-ups (the real site in a throwaway copy,
`?light=` and `?end=`, review page `.superpowers/stack-3-mockup/`).

## Goals

### 1. The drop into the stack, slower

Measured on the live build: after the last fact the light falls about 9 m into the CPU within the first 0.35 of the land
(`LAND_HIT`), about 0.6 of a screen of scroll, four or five wheel notches, most of it in two. Bob: "Into the stack" is the
part that is too fast (the fall past the five facts is not).

- The drop takes about twice the scroll it takes now (about nine or ten notches), with no sudden plunge: it speeds up
  gently and settles gently into the CPU.
- The five facts before it and the power-up after it are unchanged; the story grows by about half a screen.
- The flash, the column on the CPU and the power coming up keep their moments relative to the light's arrival.

### 2. No "Lichte versie" and no 3D switch in the header

- Both leave the header: on a laptop's row and in the phone's menu.
- 3D is always on wherever a device can run it. A visitor who switched it off before (the stored choice) gets 3D back:
  the stored choice is no longer read.
- The light version stays as the safety net: when a device cannot run the scene (no WebGL, a context lost for good, the
  scene not ready in time) the card that appears still offers it, the page still exists for search engines and for
  readers without script, and the home's visually hidden list of projects stays for keyboards and crawlers.
- Keyboard and reduced motion behave as before.

### 3. The light glows: "B · Glow"

The falling light (spec 2026-10-29-bob-stack-2, goal 4) keeps its make (the hot point in the turning frame with pins,
the dial, the five traces with vias and pulses) and takes the mock-up's B · Glow look, through the whole fall, the drop
and the landing:

- the hot point in the site's own deep gold (`palette.gold`, not the pale gold light), at 3.8 times its strength;
- the halo in gold, at 0.95, half as large again;
- the frame's lines at 2.2 and the dial's at 1.8 times gold, so they glow;
- the traces gold, their pulses gold light at 2.4 times, the middle trace at full and the four others at 0.8;
- the lamp gold, at 5;
- a wide soft aura round it, 3.4 times the halo's size, at 0.34, breathing slowly (about 4 s a breath).

Measured on the mock-up: the fall's stills at 0.022–0.025 mean luma (today's 0.013–0.016), far under the 0.11 limit.

### 4. The end is unmistakable: "2 · Circle"

When the ring reaches its last mark ("Stuur een bericht."):

- the dark comes up over the scene (to 0.9, over about 1.4 s);
- one gold circle draws itself round, clockwise from the top, over about 2.2 s once the dark is half up, with a soft gold
  glow: the site ends as it began, with the loader's circle;
- the end's words stand in the middle, inside the circle on a laptop (the circle up to 88% of the screen's shorter side,
  at most 720 px; the words 440 px wide), under it on a phone (the circle 64% of the width, its middle at 31% of the
  height; the words at the foot);
- the marks' numbers fade away; the two buttons ("Naar contact", "Terug naar het begin") stay, centred;
- one scroll up leaves it: the dark and the circle go and the ring turns back to question 6;
- with reduced motion the circle stands whole at once and the dark comes without a fade.

Measured on the mock-up: 0.027 (laptop) and 0.038 (phone) mean luma.

### 5. The projects: Portle in place of Porfael

From Bob's GitHub and this computer (2026-10-29): Porfael was renamed Portle (its repository's first commit is
"Scaffold Porfael"). Steady, Jontai Energy and Cookies Clicker stay as they are; Funcial and the private second-brain
vault stay off the site.

- Everywhere the site names Porfael (its board on the world, its own page over the stack, its longer project page, the
  Lite page, the home's list, both languages): **Portle**.
- Its words from its own README and PRODUCT.md, nothing added: "A private archive for your portfolio, your investment
  theses, and the friends you trust with them", and what it combines (a portfolio tracker across accounts, an archive of
  investment theses with their revisions, a paper-trading lab, a journal, and a friends-first social layer with Guilds
  and Relics; exact values private by default). Dutch the same words in Dutch.
- Type: a web app, a personal project in early access; 2026; sole developer; still on the App board beside Steady.
- Tools: Next.js, React, TypeScript, Tailwind CSS, Drizzle, PostgreSQL, Better Auth.
- Links: GitHub `github.com/bhccob/Portle` and the live early-access site `portle-azure.vercel.app`.
- Its address `/projects/portle/` (and `/en/projects/portle/`); the old `/projects/porfael/` addresses forward to it.
- Its 3D object (the ring with the relic) stays: Relics are still Portle's.
- **Pictures** (Bob: "Looks right"): made by running Portle on this computer with its own example members (ada, ben,
  cleo: sample portfolios, theses, a Guild; no real data), from a scratch copy of its last commit with its own example
  settings, so Bob's Portle folder is not touched, as Steady's were made from its own code. A web app, so one
  16:9 card on its own page, like Jontai Energy's.

## Non-goals

- No change to the fall past the facts, the world, the boards, the Q&A's questions or the project pages' other content.
- No live link for Jontai Energy (not asked for).
- No change to the quality ladder, the darkness gate, or the fallback card's own look.

## Anti-goals

- Bright or busy: the glow must stay one warm point in the dark, not light the page; every still under the gates.
- A visitor stuck with 3D off and no way back: with the switch gone, nothing may leave 3D off but a device that cannot
  run it.
- Any fact about Portle not in its own repository.

## Constraints

- The darkness limit: every still at a stop 0.11 mean luma at most; the harness's floors and gates as they are.
- Bob's standing rules: no subagents; never push without his word; NL the default, EN at /en/.

## Left to the builder

- The drop's curve and the land's new length, within "about twice the scroll, eased in and out".
- How the stored 3D choice is retired (ignored or cleared) and how the tests that switched 3D off reach that state now.
- Which of Portle's screens is the card, among the example members' (the portfolio overview first).

## Build notes (2026-10-29)

Calls made while building that change what the spec says or add to it:

- **The drop** is 1.26 units long (it was 0.63), from the hand-over to the light on the lid: ten wheel notches on a
  laptop where it was five. Its curve carries the fall's speed in and settles onto the lid instead of quickening into it.
  Every moment after the hit (the flash, the power, the stack opening, the names, the world's stop) stands as far after
  the hit as it did before.
- **The stored 3D choice** is retired by never reading or writing it: a visitor who switched 3D off before is shown 3D.
  The key stays in that visitor's browser, unread. The card where 3D cannot run is the one way to Lite now, and it stays.
- **The aura** of the light reaches under the top of a fact's line on a phone: the patch under that line measures up to
  0.09 (it was under 0.05), the line and its words still clear. The harness's limit there is 0.10 now; the aura was kept
  as Bob picked it.
- **The end** places its words on the screen the visitor sees (dvh, a phone's browser toolbar left out). Its marks'
  numbers go out of reach as well as out of sight, and with the keyboard in the header, the header stands over the dark.
- **A live site's link** reads "Naar de site" / "Visit the site" (Portle's is its web app, not a download), on its own
  page and on its page over the stack.
- **Portle's picture** is the dark colour scheme of its portfolio overview, from a scratch copy of its last commit run on
  its own example members (Ada), on other ports than Bob's own Portle, which was running.
