# BOB End Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scrolling past the last bead, Cookies Clicker, moves "into the night" to a seventh stop: an ordinary 2D page holding six placeholder questions about Bob and the contact page's message form. That page scrolls like any page, and from its top it scrolls back to the bead.

**Architecture:**
- **The end stop.** An `END` chapter after the projects makes stop 6 the scroll's end. The last project's stretch (5→6) stops holding Cookies and becomes the move. The journey pose gains `night` (0..1).
- **The page.** It is server-rendered on the home after `.home-nav` (`EndPage.tsx`).
- **The move on screen.** Home writes the night's share to `<html>` as `--end` each frame, and sets `<html data-end>` to `moving` during the move and `rest` once the story rests at the end. The stylesheet draws way A from these: the scene sinks under a night overlay that leaves a faint trace at the top, and the page rises from below.
- **At rest.** The page stands in the normal flow and the document scrolls natively.
- **The seam.** `VirtualScroll` gets a direction-aware `yields`, so at the end the page's own scroll is the browser's.

**Tech Stack:** React Router 8 (prerendered NL/EN), React Three Fiber 9.8, three 0.186, zustand, Vitest, TypeScript, Playwright-core harness (`tools/proof/needle.mjs`).

**Spec:** `docs/superpowers/specs/2026-10-24-bob-end-page-design.md` (builds on `docs/superpowers/specs/2026-10-21-bob-compass-design.md` §2.3–§2.4). The approved mock-up is `.superpowers/brainstorm/2211-1792824374/content/bob-end-page.html` in the main checkout (git-excluded). Where it differs from the spec, the spec and the real `ContactForm` win.

## Global Constraints

- NL is the default at `/`, EN at `/en/`. Every visible word comes from `src/i18n/nl.ts` and `src/i18n/en.ts`; `nl.ts` is typed against `en.ts`.
- Copy is formal. No answer invents a fact about Bob: a missing answer shows the placeholder.
- The Cookies Clicker classmate is never named anywhere.
- The strict CSP stays as it is. No inline script, and no new directive.
- The pace rules hold (spec §2.3 "The pace"):
  - the rise keeps smooth time 0.25;
  - the dive keeps 1.1;
  - every move from the overview on, the move into the night included, keeps 0.7;
  - input that turns a moving story back takes over at once (`letGo`).
- The scroll has one shot writer, the Opening's frame callback (`SHOT_PRIORITY` −1).
- There is one `journeyPoseAt` per frame (`handover.pose`).
- The hold while the void loads (`diveHoldFor`) still binds.
- The home's stills pass `LUMA_GATE` (home mean ≤ 0.11, ≤ 0.4 % clipped).
- Gates before every commit:
  - `npx vitest run`;
  - `npm run typecheck`;
  - `npm run build`;
  - `"/c/Program Files (x86)/Steam/steamapps/common/Blender/5.2/python/bin/python.exe" -I tools/site_audit.py dist/client`, which must report 0 errors and 0 warnings.
- Harness:
  - run against `PORT=4421 npm run preview`, with `BASE=http://localhost:4421`, `PLAYWRIGHT_CORE=C:/Users/bhcco/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright-core` and `PROOF_DIR` in the scratchpad;
  - run in the foreground, and stop the server afterwards;
  - never use port 4399.
- Every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A fling up the page to its top must stop there.** One gesture that began while the page was scrolled down stays the browser's to its end, even after `scrollY` reaches 0. Only a new gesture at the top takes the story back to Cookies. *Test:* Task 4, "keeps a gesture begun in the page with the page".
2. **Tab never lands in the end page while it is not shown.** With 3D on and the story anywhere but the end, the page is inert. At the end, Tab reaches the questions and then the form. *Test:* Task 3, "keeps the end page inert until the story rests at it".
3. **A reload at the end page starts at the home.** A reload lands at story 0 with the document at its top, and nothing is left half-shown. *Test:* Task 6, `end-page` step, "a reload at the end lands on the home".
4. **Turning a phone, or resizing, at the end page.** The story stays at 6, the page stays in flow, and nothing jumps. *Test:* Task 6, `end-page` step, "a resize at the end keeps the page".
5. **The form at the end behaves as on `/contact/`.** An empty send shows the same errors, and the ids are unique on the page. *Test:* Task 2, "renders the contact form once, with its own ids", and Task 6, "an empty send shows the form's errors".

---

### Task 1: The end stop: chapter, phase and journey

**Files:**
- Modify: `src/state/chapters.ts`, `src/state/machine.ts`, `src/state/frame.ts:51` (the `Stretch` type it names), `src/scene/bob/journey.ts`
- Modify: `docs/superpowers/specs/2026-10-21-bob-compass-design.md`. Below "That makes six stops in all" add one line: "*2026-10-24: a seventh, the end page, follows Cookies Clicker; see `2026-10-24-bob-end-page-design.md`.*"
- Test: `tests/unit/state/chapters.test.ts`, `tests/unit/state/machine.test.ts`, `tests/unit/scene/bob-journey.test.ts`. Also update every existing test that pins the old end at 5 or six stops to the new truth: grep `scrollEnd`, `toBe(5)` near End, and "six stops".

**Interfaces:**
- Produces:
  - `ChapterId` gains `'END'`, and `buildChapters` appends `{ id: 'END', length: 1, category: null }`. So `stops(HOME_CHAPTERS)` is `[0, 1, 2, 3, 4, 5, 6]`, `scrollEnd(HOME_CHAPTERS)` is `6` and `HOME_CHAPTERS.total` is `7`.
  - `Phase` gains `{ kind: 'END' }`. It is in `SCROLL_PHASES`, and `phaseOfChapter('END')` returns it.
  - `Stretch` gains `'end'`, with `STRETCHES.END = 'end'`.
  - `JourneyPose` gains `night: number`.
  - `journeyAt(p)` changes:
    - On the last project's stretch (5..6) it returns its real `local`, so 5.5 is `{ stretch: 'project', local: 0.5, project: 2 }`.
    - At 6 and above it returns `{ stretch: 'end', local: 0, project: null }`.
  - `journeyPoseAt` changes:
    - On the last project's stretch the shot holds Cookies' bead shot (`beadKey(2, aspect)`), its needle, forward and lit, as at 5.
    - `night` is `smoothstep(local)` there.
    - On `'end'` it is Cookies' pose with `night: 1`.
    - Everywhere before the last project's stretch, `night` is 0.

- [ ] **Step 1: Write the failing tests**
  - `chapters`:
    - `stops(HOME_CHAPTERS)` equals `[0,1,2,3,4,5,6]`.
    - `scrollEnd(HOME_CHAPTERS)` is `6`.
    - `chapterAt(HOME_CHAPTERS, 6).id` is `'END'`.
    - `chapterAt(HOME_CHAPTERS, 5.5)` has `id` `'PROJECTS'` and `category` `'oscillator'`.
  - `machine`:
    - `transition({kind:'PROJECTS',category:'oscillator'}, {type:'CHAPTER', chapter:'END', category:null})` gives `{kind:'END'}`.
    - `SCROLL_PHASES.has('END')`.
  - `journey`:
    - `journeyAt(5.5)` equals `{stretch:'project', local:0.5, project:2}`.
    - `journeyAt(6)` equals `{stretch:'end', local:0, project:null}`.
    - `journeyPoseAt(5.5, 16/9).night` is `0.5`.
    - `journeyPoseAt(5.5, 16/9).shot` equals `journeyPoseAt(5, 16/9).shot`.
    - `journeyPoseAt(6, a).night` is `1`.
    - `journeyPoseAt(p, a).night` is `0` for `p` in `[0, 1, 1.475, 2, 3, 4, 4.9]`.
    - `journeyPoseAt(6, a).shot` equals `journeyPoseAt(5, a).shot`, at 16/9 and 390/844.
- [ ] **Step 2:** Run `npx vitest run tests/unit/state tests/unit/scene/bob-journey.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement as the Interfaces say. `diveHoldFor('ready')` already returns `scrollEnd(HOME_CHAPTERS)`, so it becomes 6 with no change. Update the doc comments that say "six stops", "ends on the last bead" or "holds Cookies" to say what is true now.
- [ ] **Step 4:** Run `npx vitest run`. Expected: PASS, with the updated old tests saying 6 and seven stops for the stated reason.
- [ ] **Step 5:** Run the gates, then commit: `bob: a seventh stop after Cookies Clicker, the end page, and the move into the night`.

### Task 2: The end page in the HTML

**Files:**
- Create: `src/ui/EndPage.tsx`
- Modify: `src/i18n/en.ts`, `src/i18n/nl.ts` (a new `end` block), `src/app/routes/home.tsx` (render `<EndPage />` after `.home-nav`), `src/styles/base.css` (the page's look)
- Test: `tests/unit/ui/end-page.test.ts`

**Interfaces:**
- Produces the copy, typed in `en.ts` and mirrored in `nl.ts`:
  ```ts
  end: {
    label: string;              // 'Questions' | 'Vragen'
    title: string;              // 'Questions <em>about me.</em>' | 'Vragen <em>over mij.</em>' (Markup)
    questions: EndQuestions;    // exactly six { question: string; answer: string | null }
    placeholder: string;        // 'Answer to follow.' | 'Antwoord volgt.'
    placeholderTag: string;     // 'placeholder' | 'placeholder'
    messageTitle: string;       // 'Send a <em>message.</em>' | 'Stuur een <em>bericht.</em>' (Markup)
    failLink: string;           // 'Questions & contact' | 'Vragen & contact' (Task 5 uses it)
  }
  ```
  - `export type EndQuestions` is a six-tuple. The six questions are the spec's table, in that order, in each language. Every `answer` is `null`.
- Produces `EndPage(): JSX.Element`, rendering `<section className="end-page" id="end" aria-labelledby="end-title">` with:
  - the label (`.label`) and the title (`h2#end-title.page-title`, through `Markup`);
  - six `<details name="end-qa" className="end-q">`, none open, each with a `<summary>` holding the question and, inside, the answer:
    - when the answer is present, the answer itself;
    - when it is `null`, `<p className="end-a is-placeholder">{placeholder}<span className="end-tag">{placeholderTag}</span></p>`;
  - the message part: `h2.end-message-title` (Markup), `p.lead` with `t.contact.intro`, `<ContactForm accessKey={…} />` with the same key source as `contact.tsx` (`import.meta.env.PUBLIC_WEB3FORMS_KEY`), then `ul.links` of `profile.socials`, as `contact.tsx` renders them.
- The look follows the mock-up's page:
  - a left column of at most 44rem;
  - hairlines `rgb(228 190 127 / 0.22)` between questions;
  - a gold `+` that turns to `−` when open, drawn in CSS on `summary::after`;
  - the placeholder in `--ink-dim` italic;
  - the tag as a small pill in `--font-label`;
  - titles with `--font-title` and `--font-title-features`.
- In this task the section is simply in the flow, visible with 3D off. Task 3 hides it with 3D on until the end.

- [ ] **Step 1: Write the failing tests.** Use `renderToString` on `EndPage` under each locale's translator, as the existing page tests do.
  - "renders the label, the title and six closed questions in NL and EN":
    - six `details[name="end-qa"]`;
    - none has `open`;
    - the summaries' texts equal the spec's table, in order.
  - "shows the placeholder for a missing answer and the answer when there is one":
    - with every answer null, six `.end-a.is-placeholder` reading "Antwoord volgt." plus the tag;
    - with a test translator whose first answer is "X", the first answer reads "X" with no tag.
  - "renders the contact form once, with its own ids":
    - exactly one `form`;
    - `#contact-name` occurs once;
    - the three social links in the order of `profile.socials`.
  - "has no word outside the dictionaries": every text node equals a dictionary string, through the same check the other page tests use, or equivalent.
- [ ] **Step 2:** Run `npx vitest run tests/unit/ui/end-page.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `EndPage`, the copy and the stylesheet's look. Render it in `home.tsx` after `.home-nav`.
- [ ] **Step 4:** Run `npx vitest run`, then `npm run build`. Check the prerendered `dist/client/index.html` and `dist/client/en/index.html` contain `id="end"` and the six questions. Expected: PASS.
- [ ] **Step 5:** Run the gates, then commit: `bob: the end page in the home's HTML: placeholder questions and the message form`.

### Task 3: Way A on the screen

**Files:**
- Create: `src/scene/bob/endView.ts`
- Modify: `src/scene/bob/Home.tsx` (write the end view each frame, only on change, and clear it on unmount or let-go), `src/styles/base.css`
- Test: `tests/unit/scene/bob-end-view.test.ts`

**Interfaces:**
- Consumes: `JourneyPose.night` (Task 1), `scrollEnd` (Task 1) and the `.end-page` section (Task 2).
- Produces:
  - `endViewFor(night: number, progress: number, target: number, end: number): { share: number; state: 'none' | 'moving' | 'rest' }`.
    - `share` is `night` held to 0..1, with NaN read as 0.
    - `state` is `'rest'` when `progress === end && target === end`, `'moving'` when `share > 0` otherwise, and `'none'` when `share` is 0.
  - Home writes the view to `<html>`:
    - `--end` through `document.documentElement.style.setProperty('--end', String(share))`, removed when `share` is 0;
    - `<html data-end="moving">` or `<html data-end="rest">`, removed for `'none'`;
    - the `inert` property of `#end`: true unless the state is `'rest'`.
  - It writes only when the value changes. All three are cleared on let-go and on unmount, as `showRising` is: no `--end`, no `data-end`, and `#end` not inert, so 3D off finds the page usable.
  - When the state leaves `'rest'` for any reason, Home calls `window.scrollTo(0, 0)` first if `scrollY > 0`. That covers the Home key, the header's name link (story 0), and the scroll handing back to Cookies, so the scene never comes back over a page scrolled down.
- The stylesheet draws way A from the attributes:
  - `html[data-3d='on']:not([data-end]) .end-page`: `visibility: hidden`. It stays in the HTML for crawlers, and with 3D off it is simply in the flow.
  - During the move, `html[data-end='moving']`:
    - `.end-page` is `position: fixed` at its in-flow place, `translateY(calc((1 - var(--end)) * 40vh))`, with opacity `var(--end)`;
    - the scene host's night overlay has opacity `calc(var(--end) * 0.86)`, plus a top mask that leaves the scene showing faintly (about 14 %) over the top third, as the mock-up's end frame does.
  - At rest, `html[data-route='home'][data-3d='on'][data-end='rest']`:
    - `overflow-y: auto; touch-action: auto` on `html`;
    - `.end-page` back in the normal flow at the same screen position, so the frame before rest and the frame at rest match within 1 px;
    - the overlay at its end strength;
    - `.bead-label` hidden.
- The canvas sleeps at the end. `selectedBead` is null on `'end'`, so no bead's motion keeps it drawing. Nothing new is needed; the tests pin it.

- [ ] **Step 1: Write the failing tests**
  - `endViewFor(0, 5, 5, 6)` is `{share:0, state:'none'}`.
  - `endViewFor(0.5, 5.5, 6, 6)` is `{share:0.5, state:'moving'}`.
  - `endViewFor(1, 6, 6, 6)` is `{share:1, state:'rest'}`.
  - `endViewFor(NaN, 6, 5, 6)` is `{share:0, state:'none'}`.
  - "keeps the end page inert until the story rests at it": drive Home's frame with poses at 5, 5.5 and 6, then back to 5, using the same harnessing as the existing Home tests. Check after each:
    - `<html data-end>`;
    - the `--end` property;
    - `document.getElementById('end').inert`.

    Expected:
    - at 5: absent, unset, inert;
    - at 5.5: `moving`, 0.5, inert;
    - at 6: `rest`, 1, not inert;
    - back at 5: absent, unset, inert.
  - "scrolls the page back to its top when the story leaves the end": at 6, with `window.scrollY` stubbed to 300, a pose at 5.5 calls `window.scrollTo(0, 0)` once.
  - "clears the end view on let-go and unmount": no `data-end`, no `--end`, not inert.
  - "selects no bead at the end, so nothing keeps drawing": `selectedBead(journeyAt(6))` is null.
- [ ] **Step 2:** Run the new tests. Expected: FAIL.
- [ ] **Step 3:** Implement `endView.ts`, Home's writes and the stylesheet.
- [ ] **Step 4:** Run `npx vitest run`. Expected: PASS. Then by hand, a throwaway playwright script on the built site at 1440×900:
  1. set the story to 5;
  2. wheel one notch;
  3. take stills at about 30 %, 60 % and at rest into the scratchpad;
  4. compare the end page's `getBoundingClientRect().top` on the last moving frame and at rest: within 1 px.

  Name the stills in the commit message body.
- [ ] **Step 5:** Run the gates, then commit: `bob: into the night: the void sinks and the end page rises, and rests in the page's flow`.

### Task 4: The seam, the page's own scroll

**Files:**
- Modify: `src/input/VirtualScroll.ts`, `src/input/useHomeScroll.ts`, `src/input/scrollLoop.ts`
- Test: `tests/unit/input/virtual-scroll.test.ts`, `tests/unit/input/scroll-loop.test.ts`

**Interfaces:**
- Consumes: `<html data-end="rest">` (Task 3) and `scrollEnd` (Task 1).
- Produces:
  - `VirtualScrollOptions.yields?: (direction: 1 | -1) => boolean`. It is asked at every event the input would take, after `enabled`. When true the event is left to the browser and nothing is prevented.
  - The answer is decided once per gesture:
    - a wheel gesture's first event decides it for the whole gesture, until GESTURE_GAP_MS of quiet;
    - a drag's first movement past the touch slop decides it for the whole drag, and a yielded drag starts no glide;
    - each key decides alone.
  - `startHomeScroll` passes `yields: (d) => atEnd() && (d > 0 || window.scrollY > 0)`, where `atEnd()` is `document.documentElement.getAttribute('data-end') === 'rest'`.
  - Keys at the end:
    - ArrowDown, PageDown, Space and End are the browser's.
    - ArrowUp, PageUp and Shift+Space are the browser's while `scrollY > 0`. At `scrollY` 0 they move the story to the stop before, 5.
    - Home moves the story to 0, and `window.scrollTo(0, 0)` first.
  - A glide coming from Cookies stops at the end stop and never carries into the page's scroll; `pinnedAtEnd` already ends it.

- [ ] **Step 1: Write the failing tests** (the VirtualScroll tests use a fake `yields`)
  - "leaves a wheel down at the end to the browser": `yields` true for +1. Wheel `deltaY` 120: not `defaultPrevented`, and `onDelta` not called.
  - "takes a wheel up at the page's top": `yields` false for −1. Prevented, and `onDelta` called with a negative value.
  - "keeps a gesture begun in the page with the page": `yields` is true for the first event and false for the next two, fired within GESTURE_GAP_MS. None is prevented, and `onDelta` is never called. After a quiet of GESTURE_GAP_MS + 1 ms, an up event with `yields` false is taken.
  - "leaves a drag that began in the page to the browser for the whole drag, with no glide".
  - "keys at the end": with `yields` true, ArrowDown is not prevented. With `yields` false (at the top), ArrowUp is prevented and steps the story from 6 to 5.
  - scroll loop: "a story at 6 with the page at its top goes back to 5 on one wheel notch up, and rests on 5".
- [ ] **Step 2:** Run the input tests. Expected: FAIL.
- [ ] **Step 3:** Implement as the Interfaces say.
- [ ] **Step 4:** Run `npx vitest run`. Expected: PASS.
- [ ] **Step 5:** Run the gates, then commit: `bob: at the end page the page's own scroll is the browser's, and its top hands back to the beads`.

### Task 5: A failed void, and reduced motion

**Files:**
- Modify:
  - `src/app/routes/home.tsx`: in `.home-nav`, add `<button type="button" className="end-link">{t.end.failLink}</button>`.
  - `src/styles/base.css`: the button shows only while `html[data-void='failed']`.
  - `src/input/useHomeScroll.ts` and `src/input/target.ts`.
- Test: `tests/unit/input/scroll-loop.test.ts`, `tests/unit/input/target.test.ts`, `tests/unit/home-page.test.ts`

**Interfaces:**
- Produces `stopsFor(c: Chapters, voidState: VoidState): number[]`:
  - `stops(c)` for every state but `'failed'`;
  - `[0, riseTop(c), scrollEnd(c)]` for `'failed'`.
- When failed:
  - The keys and the settle step among these stops. From the end, ArrowUp, PageUp, or a wheel up at the top goes to 1.
  - The hold still keeps wheels and swipes at 1. Only the button, or a key or jump that targets the end from 1, goes to 6.
  - Every move between 1 and 6, either way, is the step fade (`<html data-step-fade>`, the existing reduced-motion path), whether or not reduced motion is on. It is never a camera move through a void that is not there.
- The button calls `goToEnd()`, exported from `useHomeScroll`'s module. It places the story at `scrollEnd` by that fade.
- Reduced motion: 5↔6 is a step and a fade, as every stop is. Nothing new is expected; the tests pin it.

- [ ] **Step 1: Write the failing tests**
  - `stopsFor(HOME_CHAPTERS,'ready')` is `[0,1,2,3,4,5,6]`.
  - `stopsFor(HOME_CHAPTERS,'failed')` is `[0,1,6]`.
  - "failed: goToEnd places the story at 6 by a fade, and ArrowUp at the top goes back to 1 by a fade". The progress jumps once the host is dark: there are no frames between 1 and 6.
  - "failed: a long wheel down still rests at 1".
  - "reduced motion: one wheel step from 5 goes to 6 by a fade, and one up goes back to 5".
  - `home-page`: "the failed-void link is in .home-nav with the copy, NL and EN".
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npx vitest run`. Expected: PASS.
- [ ] **Step 5:** Run the gates, then commit: `bob: a failed void reaches the end page by its link and a fade; reduced motion steps to it`.

### Task 6: The harness

**Files:**
- Modify: `tools/proof/needle.mjs`, `tools/proof/README.md`

**Interfaces:**
- Consumes everything above.
- The expectations come from imports wherever the harness already imports them (`scrollEnd`, `stops`, `HOME_CHAPTERS`, the dictionaries), never as retyped numbers.

- [ ] **Step 1: Retime what the seventh stop changes.**
  - `keyboard`: End goes to 6, the end page.
  - `reduced-motion`: the stops are 0..6.
  - `void-stops`: each walk ends `… 5 6 6` at all three sizes.
  - `void-journey`: down to 6 and back.
  - `bridge`, and any other check that names 5 as the end.

  Each keeps its intent. Change only what is now false.
- [ ] **Step 2: Add the step `end-page`**, at 1440×900, 1366×657, and 390×844 with touch. Every check must hold, and a timeout counts as a failure.
  - It reaches the end from Cookies by real input only, once each:
    - one wheel notch;
    - ArrowDown;
    - one swipe on the phone.
  - At rest:
    - `<html data-end="rest">` is set;
    - `#end-title` is visible in the viewport;
    - `.end-page` is not `inert`;
    - the canvas asks for no frame in 600 ms;
    - a still `m2/end-<size>.png` passes `LUMA_GATE` as a home still, masked as `void-journey` masks text.
  - The page's own scroll:
    - three wheel notches down make `window.scrollY` grow while the story stays at 6;
    - End reaches the page's bottom;
    - wheel up returns to `scrollY` 0, and the story is still at 6;
    - one more notch, as a new gesture after a pause, goes to 5, with Cookies' label shown at rest.
  - "keeps a gesture begun in the page with the page": a burst of notches up with no pause, from `scrollY` 300, ends with `scrollY` 0 and the story at 6.
  - The questions:
    - a click on the first summary opens it;
    - a click on the second opens it and closes the first;
    - the placeholder reads "Antwoord volgt.".
  - "an empty send shows the form's errors": the send button, with fields empty, shows `#contact-name-error`.
  - Tab from the header at the end reaches the first summary, then the form's fields.
  - "a resize at the end keeps the page": 1440×900 → 1000×700 → 1440×900. The story stays 6, `data-end` stays, and `#end-title` is still in the viewport.
  - "a reload at the end lands on the home": story 0, `scrollY` 0, no `data-end`.
  - "the header's name at the end goes to the home": from `scrollY` 300 at the end, a click on the name lands at story 0, with `scrollY` 0 and no `data-end`.
  - `/en/` at the end: the title and the first question in English.
  - 3D off: `/` with 3D off shows `#end` in the flow after `.home-nav`, reachable by native scroll.
  - Void failed (GLB 404): the `.end-link` button shows and goes to the end by a fade (`data-step-fade` seen), and ArrowUp at the top returns to 1.
  - Reduced motion: 5 → 6 → 5 by fades.
  - `errors: []` and `csp: []` throughout.
- [ ] **Step 3:** Run the full harness on :4421 in the foreground, then stop the server. Expected: every step passes. Report each step's line in the commit body.
- [ ] **Step 4:** Commit: `proof: the seventh stop, and the end page by real input: its scroll, its questions, its form, 3D off and a failed void`.

### Task 7: The review page for Bob

**Files:** none in the repo. Write `.superpowers/brainstorm/<the companion's current id>/content/bob-end-review.html`, which is git-excluded. Restart the companion server if it is down, and copy what the page needs into the folder it serves.

- [ ] **Step 1: Record** at 1440×900 by real input on the built site (CDP screencast at 24 fps, encoded through Blender `bob_encode_w.py` at 1280×800 LOW):
  1. from Cookies, one notch into the night;
  2. scroll the page down, open a question and scroll to the form;
  3. scroll back to the top, and one notch back to Cookies.
- [ ] **Step 2: Write the page.** It holds:
  - the recording beside the mock-up's three way A frames;
  - stills at 1440×900 and 390×844 of the move at about 50 % and at rest, NL and EN;
  - the harness numbers from `results.json`;
  - a short "for you" list: the six placeholder questions waiting for Bob's answers, the calls in the spec's "My calls", and the option of using the Lite page's existing five-question Q&A (`src/data/qa.ts`, answered from his own career text) instead of the placeholders.
- [ ] **Step 3:** Report the page's link. No commit.
