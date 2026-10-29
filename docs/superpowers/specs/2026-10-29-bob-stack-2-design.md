# The stack, second round: the Q&A ring, the project page, the gyroscope, the circuit light and the B

**Status:** chosen by Bob on 2026-10-29, one change at a time, each from a throwaway mock-up he tried. His five asks, after the
quantum stack's review:

> "make it so the text takes the whole screen when clicking on the project and also put pictures and make go back option
> more visiblew so user can easily exit the project"
>
> "also need more gold rings"
>
> "and for the Q&A it still doesnt look like it moves with the dimension/universe, come with other idea for it doesnt
> have to be movie style i want it to be sort of like interactive 3d but not too much"
>
> "the background dimensions/udomain looks a bit pale/bland still same counts for the when light falling to enter
> project maybe give the light a better design in generakl and also the trail like it belongs to the tech domain"
>
> "The B in the beginning page should match the O design of the compass"

How each was settled is under its goal. Nothing is built until he has read the plan.

**Builds on:** `2026-10-28-bob-quantum-stack-design.md`, built on `bob-stack` (through 32f4f72, with his two earlier asks
of that day in: the nearer look back with the credits rising as one move, and the gas drawn into the stack by depth).
`bob-stack` was merged into `redesign-bench` on 2026-10-29 (Bob: "Merge it now"); this round is built on a new branch,
`bob-stack-2`, from it.

## The references

All five are throwaway pages in the `bob-dive` worktree's `.superpowers/` (git-ignored), each with a review page at
`/review/`. Their look, sizes, timing and words are the reference; their code is not the build. The build is written test
first into the site's own modules.

| Change | Mock-up | Port | His last word |
| --- | --- | --- | --- |
| Q&A | `qa-mockup/`, `?v=mix` | 4449 | "Yes, next change" after the mix's second round |
| Project page | `project-mockup/` | 4454 | "Yes, next change" after the quiet next project and the bigger words |
| Gold rings | `rings-mockup/`, `?rings=gyro` | 4455 | "wait actually ill just go with the gyroscope", then "Yes, next change" |
| Falling light | `fall-mockup/`, `?light=circuit` | 4456 | "1 · Circuit" |
| The B | `b-mockup/`, `?b=rings` | 4457 | "2 · Ringen" |

## Goals

### 1. The Q&A is a gold ring round the stack (the mix)

How it was settled: two ideas (questions as stars in the nebula; questions on a gold ring); he: "the ring is such creative
and good idea (possibly a mix ...)", "make so the project object closes when reach the Q&A", the stars "around but just
for decoration maybe even better looking stars"; then "can the stars in background be more 3D also maybe so the ring is
always visible and so that the text are bigger and rotating snaps and is slower and make it clear in stuur een bericht
is the end of the website".

- **Always there:** from the look back on, a large gold ring circles the open stack (the mock-up's `RING_R` 11.5 m, a
  little above the machine's middle, tipped 7° toward the camera), with a fine dial of ticks and one mark per question
  plus a last mark. It comes in as the camera draws back to the look back.
- **Into the Q&A:** a scroll past the look back closes the stack: the boards slide back together a hand's width apart, as
  before the light landed, and the projects sink into their sockets. The ring draws in and up with it (to 9.6 m). The
  camera moves to the ring's own view.
- **A question at a time:** each scroll turns the ring one question, slowly (about 1.9 s, eased in and out), and it lands
  on the mark with a small click, a little past and back, the mark flashing as it lands. A drag turns it by hand and lets
  go onto the nearest question. A click on a mark goes to it. The answer shows beside the ring when the ring is still:
  "Q&A · 02 / 06", the question in gold capitals, the answer in reading text (23 px on a laptop, 18 px on a phone),
  over a soft dark so it reads.
- **The end:** the last mark is bigger, with a gold ring standing on it. When it is reached the whole ring lights all the
  way round, and the words read "Einde van de site", a larger "Stuur een bericht.", a line under it, and two buttons:
  "Naar contact" and "Terug naar het begin" (to the very top).
- **Scroll back up:** from the first question back to the look back, the stack opens again.
- **Stars for decoration:** 3D stars round it all, each a solid star with points along its three axes and four short ones
  between, turning slowly; at many distances; about one in three with two thin gold gyroscope rings turning round it. A
  star behind the answer's words fades while they show. Nothing about them is clickable.
- **Replaces:** the credits sheet (the look back fading under the rising Q&A) on the home with 3D on.

### 2. A project opens as its own page over the stack

How it was settled: a first version with a gallery; he: "theres too much image ... just fading image ... only 1 or 2 that
fits the whole screen ... text bigger and in the middle same as the website reference"; then "below dont need to have so
much unecessary text also when click on it at first you can keep the original idea of making the text to the side";
then "try to copy this website more https://overworldaudio.com/work/star-wars-survivor"; then "for mobile apps it gotta
be slightly different styling so it doesnt look too small"; then "make the next project less visible ... also the text
should be bigger and spaced a little further from each other".

- **What opens it:** as today (a click or tap on a project or its name, at rest). The project still lifts toward the
  camera; then its page fades in over the stack, full screen.
- **The page, in the reference's order** (the mock-up's `full.ts`, `full.css`):
  1. **The top:** the dark with a torn, ragged hole (a canvas-made noise mask, edges dry-brushed), through which the
     project's own 3D object turns in the stack, in the middle.
  2. **The words to the side:** the kind of work and the name on the left (up to 88 px); on the right the summary (up to
     31 px, line height 1.6) and the facts: year, role, tools, type (19 px), the link "Bekijk op GitHub →", and under it,
     quieter, "Lees meer" to the project's own page with its longer text (Bob: "Add a 'Lees meer' link"). Nothing else:
     no longer text, no list of touch points.
  3. **One picture:** a website or a game in one rounded 16:9 card with a small line under it. A mobile app instead: three
     of its screens standing as phones, nearly the screen's height, the middle one forward and lit, the two beside it a
     step back and dimmer; on a phone, one screen nearly the screen's width, swiped to the others, a dot for each.
  4. **The next project, quiet:** far below, under a thin line: a small dim picture with "Volgend project" and the name in
     grey, which light only under the mouse. A website's picture dissolves into the dark in a torn blot; an app's whole
     screen stands, torn at its edges.
  5. **Pinned all the way down:** "Terug naar de stack" with its "Esc" bottom left, gold and large; a thin line bottom
     right for how far down. Escape and the browser's Back leave too; ← → go to the other projects.
- Each part below the top fades up as it is reached.
- **The pictures** (made from each project's own code on this computer, see below): Steady three screens; Jontai Energy
  its homepage; Cookies Clicker the game being played; Porfael none yet, so its page goes from its words to the next
  project.
- **Replaces:** the side panel and the touch-point columns of an open project on the home.

### 3. Gold rings round the stack: the gyroscope

How it was settled: two ways round the stack (gyroscope; a ring per board); he wanted them to "cross the dimension and not
be so bright", orbs "more realistic like unique stars"; several rounds of rings across the space; then "just go with second
option and maybe make the outrside ring automatically slow rotates", then "wait actually ill just go with the gyroscope".

- Three large gold rings round the machine's middle, each tipped its own way (the mock-up's radii 12.5, 14.6 and 16.8 m),
  each turning slowly on its own axis, with a fine dashed ring beside each and a few small lights riding on them.
- The outermost, with a dial of ticks, also swings slowly round the stack on its own, about one turn every two minutes.
- A little see-through and softer than gold metal at full strength (the mock-up's alpha 0.62, level 0.8).
- They come on with the power when the light lands; at a board they step back to 42% so the board is the focus; they
  fade where they pass near the camera.
- **The stars:** the realistic stars from the rings rounds stand round the stack (44 of them): each its own colour by its
  temperature, from blue-white to deep orange, the cooler and smaller ones most common; its own size and brightness and
  twinkle; the brightest with a telescope's six-pointed spikes; a few in pairs; two in a faint shell of gas.
- The Q&A's ring (goal 1) is a fourth ring of the same make, there from the look back on.

### 4. The falling light is a signal on a circuit, through a richer space

How it was settled: two designs against today's; he: "1 · Circuit".

- **The light** (the mock-up's `light.ts`, `circuit`): a hot point inside a small square frame with pins on each side,
  turning slowly, and a fine dial of ticks round it; gold.
- **Its trail:** five circuit traces, routed as a board's are: straight runs that jog at 45°, a via (a small ring) at each
  jog, bright pulses running down them into the light. The middle trace under the light, two beside it, two thin ones
  further out. Drawn only above the light, where it has been, fading higher up.
- **The space it falls through:** the site's nebula and its band, the 3D gas, and the realistic stars, kept far enough out
  (42 m and more) that none crosses the light.
- **Replaces:** the gold orb, its glassy shell, its filaments and sparks, and its soft tube trail, all through the fall.
  The light's landing in the CPU, the flash and the column on the CPU keep their moments and take the new light's look.

### 5. The B letters are made like the compass: Ringen

How it was settled: two ways (one band; three nested bands); he: "2 · Ringen".

- Each stroke of both B letters (`leftB`, `leftBar`, `rightB`, `rightBar` in `src/engine/bob/wordmark.ts`) becomes three
  thin bands side by side (the mock-up's offsets −0.14, 0, +0.14 m, each 0.075 m wide), of the compass's smoked violet
  band glass, gold rims along both edges of each, and the band's fine ticks (one every 4.5 cm, a longer one every sixth)
  on the outer edges.
- They follow the letters' paths exactly, the corners kept sharp.
- They still light on the scroll as the engraved letters do now, from the O outward.
- **Replaces:** the thin engraved gold tubes of the B letters. The O, its circle, its ticks and the outer ring stay.

## Non-goals

- No new words about Bob: every answer, fact, summary and role is the site's own data.
- No change to the fall's five facts, the stack's boards, the projects' 3D objects or the categories.
- No change to the Lite page, the contact page or the project pages beyond Jontai Energy's GitHub link (Bob's answer 3).
- The quality ladder, the governor and the darkness gate stay as they are.

## Anti-goals (a failure even if it works)

- **Busy or bright:** more than one bright thing in a view; any still at a stop over the darkness limit.
- **Words over words:** the Q&A's answer over a mark's name, the fact over the light, a project's words over its picture.
- **Stuck:** in the Q&A, or in an open project, on any device.
- **A ring or a star across the thing in focus:** the board at its stop, the open project, the answer.
- **A picture that shows anyone's real data.** Steady's screens hold only stand-in details (see below).
- **The old orb anywhere in the fall.**

## Constraints

- **The darkness limit:** every still at a stop, mean luma 0.11 at most; an open project 0.15 at most. Measured on the
  mock-ups' stills (sRGB mean, 0–1): the Q&A 0.086–0.094, the gyroscope 0.064–0.067, the fall 0.027–0.039, an open
  project 0.046. **The Ringen B from above measured 0.16**, so the build lights the B letters less than the mock-up (less
  glow and bloom on them) until "BOB from above" is under 0.11. Bob sees the result before the merge.
- **Reduced motion:** the ring turns straight to a question without the ease or the click; the outer gyroscope ring and
  the stars stand still and do not twinkle; the traces' pulses stand still; the project page's parts show without fading
  up.
- **The canvas sleeps:** the rings' turns, the stars' twinkle and the pulses run on the scene's clock only for the idle
  seconds after the last input, as everything else does.
- **The quality ladder:** low draws no gas, half the stars and no stars' gyroscope rings; the rings and the traces are on
  every tier.
- **3D off, no WebGL, the poster:** the home's end page (`src/ui/EndPage.tsx`) stays in the HTML as it is, for these and
  for crawlers; only with 3D on does the ring take its place on the screen. The project pages stay for the same reason.
- **Words:** Dutch first, English at /en/ for every new word on the screen (below). The Cookies Clicker classmate is never
  named.
- **How it is built:** no subagents; test first; the proof harness (`tools/proof/needle.mjs`) proves each goal by real
  input; nothing merged or pushed without Bob's word.

## Decided for the builder (my calls, from the mock-ups he chose)

- **The new words**, Dutch with English:
  - Q&A: "Q&A · 02 / 06"; "Einde van de site" / "End of the site"; "Stuur een bericht." / "Send a message."; the line
    under it (Bob's answer 4); "Naar contact" / "To contact"; "Terug naar het begin" / "Back to the start".
  - Project page: "Terug naar de stack" / "Back to the stack"; "Volgend project" / "Next project"; "Scroll" / "Scroll";
    "Lees meer" / "Read more";
    the picture lines as in the mock-up, in English beside them (for example "De homepagina van Jontai Energy" / "Jontai
    Energy's homepage").
- **The pictures** go into `src/assets/projects/` at the sizes the page uses (WebP, a phone screen 1170 × 2532 and a
  website 1440 × 900 at most), with alt text in both languages:
  - **Steady:** run from a copy of its last commit on the web, with stand-in details only: the name "Sam" (the app's
    own example), one "Vitamin D" reminder, no health conditions and no contacts. The welcome, the home with the streak
    and the gentle reminders screens.
  - **Jontai Energy:** its last committed static site (the "Power Your Future" homepage), the cookie banner answered
    "Essential Only". Its newer uncommitted night design is left alone.
  - **Cookies Clicker:** the game from Bob's public repo, played a while.
- **The Q&A's place on the scroll:** the look back's stop stays; each question is a stop after it, and the end's mark is
  the last stop (the scroll's end). The credits' sheet and its stop go.
- **The message form:** at the ring's end it is one click away, on the contact page, by "Naar contact", as in the
  mock-up he chose; with 3D off the end page keeps its form where it is.
- **The ring's view:** the mock-up's `ringPose` (from in front of the closed stack, a little up), per screen shape.
- **The light's sizes:** the mock-up's (the frame 1.24 m across, the dial 1.05 m from its middle, the traces 0.02–0.042 m
  wide). It replaces the orb in `src/engine/bob/build/light.ts`.
- **The richer space in the fall:** the clouds come up to 0.9 over the fall (today `NEBULA.FALL_LEVEL` 0.6) and the far
  bands to 0.85 (today none in the fall), as in the mock-up; 170 of the realistic stars between 42 and 120 m from the
  light's line. The five facts' words keep the page's scrim and must read as well as today.
- **The Q&A's ring and the gyroscope:** the Q&A's ring keeps its own look from the mock-up (solid gold, a little brighter,
  since in the Q&A it is the focus); in the Q&A the three gyroscope rings step back to 42%, as at a board.
- **Both kinds of star:** the realistic stars stand round the stack from the light's landing on; the Q&A's solid 3D stars
  join them only in the Q&A, coming in as the stack closes. Bob sees the two together on the review page.
- **The Q&A for keys and screen readers:** each mark is a button named by its question; the answer is real text on the
  page; the arrow keys and Page Up and Page Down move between questions as the scroll does.
- **A project's history:** opening a project adds one entry to the browser's history, so Back closes it; going to the
  next project from its page replaces that entry. After the last project, "Volgend project" is the first.
- **The torn masks** are drawn once on a canvas at load, as in the mock-up.

## Left to the builder

The modules, names and tests; how the new pieces sit in `Void.tsx`, `Home.tsx` and the post chain; the harness's new and
changed steps (the credits and end-page steps become the Q&A ring's; the open step becomes the project page's; the
light-dive step checks the new light; a check that the B letters light on the scroll).

## Bob's answers (2026-10-29)

1. **The merge:** "Merge it now". `bob-stack` was fast-forwarded into `redesign-bench` (to 32f4f72) the same day, the
   unit suite green on the merged result (1728 of 1728); this round builds on it.
2. **The project pages** keep their longer text for people without 3D and for search, and the new view links to them:
   "Add a 'Lees meer' link" (goal 2).
3. **Jontai Energy's GitHub link** is `github.com/bhccob/Jontai-Energy` (today the site links `github.com/bhccob/JE`):
   changed in the site's project data (`src/data/projects.ts`), so the view, the project page and the Lite page all carry it.
4. **The end's line** under "Stuur een bericht.": "Keep that line": "Dit is het einde van de site. Staat je vraag er niet
   tussen, of wil je iets anders vragen? Stuur me een bericht." In English: "This is the end of the site. Is your question
   not among them, or would you like to ask something else? Send me a message."

Still open from before, not blocking: Porfael's tools and link; the boards' print in Dutch only or per language.
