# BOB · the light's path through the projects, and the credits

*2026-10-27. This builds on the light dive design (`2026-10-25-bob-light-dive-design.md`) as built on `bob-dive`. Everything up to the end of the fall still holds: the way in, the light flowing into depth, the five facts and their side moves, the void's loading behind the fall, both languages and the facts in the HTML (its goals 1–3 and 6–8). This document replaces three things:*
- *its ring of projects (goal 4);*
- *its end sheet (goal 4b);*
- *its skip button's place (goal 5).*

*It also replaces the end page's look (`2026-10-24-bob-end-page-design.md`). The end page's contents stay.*

## Intent

Bob, in his words, in order:
- 2026-10-26, after the ring was built: "i dont like the project area its like so bland and not 3d animations with scroll, now its just like 2d to rotate. if you have other ideas you can propose i would like to hear it and the beggining and the light movers i like only the project area i dont"
- On my proposal: "lets go wit hwhat you think is right"
- On the storyboard (`project-path.html`) he picked "Close, but something's off", and then: "3 and 8 idk just come up with stuff you can think of"
- On the six mock-ups for pictures 3 and 8: "3A & 8A , though idk how it will be when theres more projects"
- "i dont like how the vragen over mij is displayed maybe make it just a simple text in Q&A area like a movie ending"
- On the three endings: "yeah A, but vragen overmij, wie ik ben wat ik doe en waar ik naartoe wil i want it to just be simple Q&A text / and maybe the text generally a bit smallerr?"
- On the simpler credits: "Yes, the simpler credits are right."

He keeps the beginning and the light. The ring goes, because it reads as a flat picture turning. The projects become places the light leads to, one after another, each moving in 3D with the scroll. The end becomes plain text that rolls past like the end credits of a film.

## The approved look

All of it is on the visual companion, in git-excluded folders of the main checkout:
- **`.superpowers/brainstorm/9920-1793054095/content/`**
  - **`project-path.html`**, the storyboard. Pictures 1, 2 and 4–7 stand as captioned. Pictures 3 and 8 are replaced by 3A and 8A.
  - **`arrival-and-end.html`**, the moving mock-ups.
    - **3A, "The light circles it"**, approved.
    - **8A, "Look back"**: its first half is approved, where the camera pulls back over the trail and the beads. Its second half is replaced by the credits below: the questions page rising with the beads on its right.
    - 3B, 3C, 8B and 8C were turned down and are kept as history.
- **`.superpowers/brainstorm/200-1793084968/content/`**
  - **`more-projects.html`**, the look back and the length of the way with 3 to 12 projects, in two ways.
  - **`movie-ending.html`**: A, the end credits, was picked. B and C are history.
  - **`credits-simple.html`**, A simplified, approved as "right".

The mock-ups are flat cut-outs of the site's own stills. They set the moves, the order, the framing, the type and the sizes. They are not the final geometry: on the site all of it is real 3D.

## Goals

1. **Up to the end of the fall, nothing changes.** It runs from the home through BOB seen from above, the way in through the O, and the light flowing into depth with the five facts beside it.

2. **No ring: the light leads on to the first project.**
   - The light keeps its speed after the last fact and swings toward the first project, which waits ahead in the dark. The bead lights up only as the light comes near.
   - The other projects are out of sight, beyond the dark, until the light leads to them. Only one project is in view at a time.
   - The light stays a light from here to the end. There is no needle among the projects.
   - Nothing joins the light to a bead, as before.

3. **At each project, the light circles it (3A).**
   - The camera comes in on the bead and keeps pushing in gently as the visitor scrolls.
   - The light swings in and circles the bead a little more than once on a tilted path. It passes behind the bead, where the bead hides it, and in front of it, so the bead reads as round and solid.
   - **Where the light passes, the bead's gold veins wake up.** The marbled gold on the shell lights up in the light's colour and stays lit, softly. The bead is dim before the light reaches it and awake after.
   - The light comes to rest beside the bead, on its right. The bead's label appears next to the light, as today: the category line, the title, and "Klik om te openen" / "Click to open".
   - The scroll drives all of it continuously. Stopping mid-way holds it there, and scrolling back runs it in reverse.
   - A click on the bead or its label, or Enter, still flies into the project's page. Esc or back returns to the same place on the path.

4. **Into the bead (storyboard picture 4).**
   - Scrolling on takes the camera through the bead's glass window. Inside, the project's objects move with the scroll, not by themselves:
     - **Funcial:** the abacus builds itself rod by rod, its beads sliding into place, and the phone's screen lights up.
     - **Jontai Energy:** the solar module's cells light up one by one, and the panel tilts toward the light.
     - **Cookies Clicker:** the clockwork's gears fit together and start to turn.
   - A few short labels say what it is: the project's own touch points, as `projects.ts` has them (for Funcial: Log, Game layer, Money rules, Vault, Result).

5. **Out and on (picture 5).** The camera pulls back out through the window and the bead dims behind it. The light leads on, deeper and to the side, to the next project, where goal 3 repeats.

6. **Which projects the light visits** (Way 2 on `more-projects.html`; see My calls).
   - With up to five projects, the light visits them all, in the order of `projects.ts`. Today that is Funcial, Jontai Energy, then Cookies Clicker.
   - With more than five, it visits the five Bob picks. The rest are not on the way. They show in the look back (goal 7) as small lights beside the trail, and on the Werk page as now.
   - Each visited project adds about two scroll stops: the arrival, and the inside. So the way from the top to the credits is about 15 stops with three projects and at most about 19 with five.

7. **The look back (8A).**
   - After the last project, scrolling on pulls the camera back and up, and the whole way shows. The light's trail winds back into the distance, with every visited project's bead on it: the first far and small, the last close by, all awake. Projects not on the way are small lights beside the trail.
   - The trail fades in as the camera pulls back. The light rests at the last bead.
   - Each bead and light is a link to its project. Its label shows on hover and focus, and a click opens it.
   - It holds still at the end of its pull-back. Scrolling on fades it to black, into the credits.
   - With many projects the trail winds further, and the beads keep from overlapping by sitting at even steps along it. Checked with 3 to 12 on `more-projects.html`.

8. **The credits: the questions as the end of a film** (`credits-simple.html`).
   - **Black.** One narrow column in the middle of the screen, centred text.
   - **It opens with a small "Q&A"** in the label face, gold and widely tracked. There is no big title, no "Vragen" label and no intro line.
   - **Then the six questions,** each a small line of gold capitals in the label face, like a credit. Its answer sits under it in plain reading text. Every answer is simply there: nothing opens or closes, and there are no plus signs. A missing answer shows the placeholder, as today.
   - After the last answer: a short gold rule and **"BOB CHUNG"** in the label face.
   - Then **"Stuur een bericht." / "Send a message."**, small, in the title face, with the message form and the direct links under it. It comes to rest in the middle of the screen when the scroll reaches the end.
   - **It rolls with the scroll.** The column moves up as the visitor scrolls. Text fades in at the bottom edge of the screen and out at the top, as credits do.
   - **The sizes are a step smaller than the end page today.** In the mock-up at 1440 wide: answers 19 px, questions 13 px, "Q&A" and the name 15 px, the column 580 px. They scale down for phones by the site's type scale and stay readable at 390×844.
   - **It is ordinary text that scrolls.** The credits are the end page, restyled, so reading, selecting text, the form, the keyboard and screen readers work as on any page.
   - Scrolling back up past the credits' top brings the look back in again.

9. **The skip button: "Snel naar vragen ↓" / "Skip to questions ↓".**
   - It shows from the first project's arrival through the look back. It is gone in the fall, in the credits, and on the project pages.
   - One click, tap or Enter goes straight to the credits' start by the step fade. The focus moves to the "Q&A" heading.
   - Its look, its place at the bottom right, and its rule never to cover a label stay as they are.

10. **Both languages.** NL at `/`, EN at `/en/`, with every word in the dictionaries. The heading is "Q&A" in both.

## A video and a mock-up first (Bob's rule)

Before anything of this goes into the site's code, Bob sees and approves two things:
- **a mock-up:** a standalone, throwaway, real-time 3D page outside the site that he can scroll;
- **a video** recorded from it.

Together they show, at 1440×900 and on a phone:
- the end of the fall flowing on to Funcial;
- the light circling it and the veins waking;
- into the bead and out again;
- on to Jontai Energy and Cookies Clicker;
- the look back;
- the fade to black and the credits rolling to the message form.

The site build waits for his OK. Anything he changes goes back through the mock-up first.

## Non-goals

- Any change to the loader, the home, the rise, BOB seen from above, the way in, the fall, or the facts.
- The project pages and the flight into them (M3 is separate).
- Lite, the contact page, and sound. The exception is the end page's text, which is the same HTML everywhere (goal 8).
- New projects. Adding one stays a data change, and goal 6 says how the way takes it.
- Words beyond Bob's. The questions and answers stay his, word for word, in both languages.

## Anti-goals

These would make it a failure even if it worked:
- **Anything that reads as a flat picture turning:** a ring, a carousel, a bead that only spins in place.
- **Two projects competing:** more than one bead lit and in focus at once on the way. (The look back is the one exception, and its beads sit along one trail.)
- **A busy or bright moment:** a flash, a burst, a strobe, a glow that outshines the bead, or colour beyond gold and violet.
- **Anything joining the light to a bead.**
- **The credits turning back into a designed page:** a big title, the intro line, cards, accordions, plus signs, or text larger than the mock-up's.
- **A changed or invented word** in the questions, the answers or a fact.
- **A way that feels like work:** too many stops between the facts and the credits, or a scroll that fights the visitor or will not go back.
- **The skip button missing at the projects,** or covering a label.
- **Building into the site before Bob has seen the video and the mock-up.**

## Constraints

Everything binding on the light dive still binds:
- the strict CSP: no inline script or style, `worker-src 'none'`, and no new source;
- the luma gate;
- NL as the default;
- formal copy;
- the Cookies Clicker classmate is never named;
- the pace rules;
- the scroll's one shot writer;
- one pose per frame;
- the canvas asleep when nothing moves;
- the beads' motion only where it is seen;
- the harness passing in full, at the three sizes, by real input.

## Decided by Bob

- The beginning and the light stay. The ring goes.
- The storyboard's direction:
  - the light leads from project to project;
  - the camera goes into each bead, whose objects move in 3D with the scroll;
  - the camera comes back out and the light leads on.
- The arrival is 3A: the light circles the bead.
- The end starts with 8A's look back over the whole way.
- The questions become a movie ending: A, end credits, made simpler. Plain Q&A text with no "Vragen over mij." title or intro line, and all text a step smaller.

## My calls (Bob may change any)

- **Way 2 for more projects.** At most five on the way, and the rest as small lights in the look back. Bob asked how it scales but did not choose between the two ways; this follows my recommendation. Way 1 (every project on the way) would only lift the cap.
- **How a project gets on the way:** a flag in `projects.ts`. While there are five or fewer, all are on it.
- **No needle among the projects.** The light stays the light to the end, so the earlier "needle, light, needle" becomes "needle, light".
- **The light rests on the bead's right** with the label beside it, as in the mock-up. On a phone, the label goes where it fits beside or below the bead.
- **The veins stay lit after the light passes,** a little calmer than at the moment it passes.
- **The look back's beads are links,** with their labels on hover and focus.
- **The credits:**
  - the direct links stay under the form, and the contact intro line goes;
  - "Q&A" is the heading in both languages;
  - the skip button and the failed void's "Vragen & contact" link focus the "Q&A" heading.
- **The order** follows `projects.ts`.
- **Reduced motion:**
  - each arrival, inside, and the look back become steps by the step fade: the bead awake with its label, the inside with its objects built, the whole way;
  - the light does not circle;
  - the credits are the same page with no fade at the edges.
- **3D off, no WebGL, or the fallback card:** the credits are the end page as a normal centred page. The project links stay as they are today.
- **The keys:**
  - a key moves to the next or previous stop (an arrival, an inside, the look back), as the fall's keys move a fact;
  - End goes to the credits' start by the step fade, as the skip button does, and Home goes to the home;
  - the ring's drag goes with the ring.
- **Inside a bead,** its label gives way to the touch-point labels and comes back on the way out.
- **Coming back from a project** opened at its arrival, its inside or the look back returns to that same place.
- **The site header** stays over the credits, as it is over the end page today. The credits' top fade sits below it.
- **The beads' loading:**
  - the light holds just before the first project until the beads are ready, as it held above the ring;
  - with a failed void, the story holds there, and the home nav with its "Vragen & contact" link shows, as today;
  - the skip button does not show, because there are no projects.

## Left to the builder

- **The path:** where each bead sits in depth, the light's curve between them, and the camera's moves along it. Each next project sits deeper and to the side, as on the storyboard.
- **The orbit:** its tilt, size and turns, how the bead hides the light behind it, and how the veins light up. For example, a mask or emissive term on the bead's shell, swept by the light's angle.
- **The inside:** driving each object's existing moving parts (`beadMotion.ts`) by the scroll instead of the clock. Where a move the storyboard names has no part yet (the abacus rods appearing, the gears coming together), the builder decides whether to rig the GLB or to stage it with what is there, and says which in the mock-up.
- **The look back's camera,** the trail's look, the small lights' placement, and the fade to black.
- **The credits' roll:**
  - how the fade at the edges is done within the CSP (a mask on the scrolling container, for example);
  - how the end page's scroll joins the story's.
- **The scroll structure in code:** the chapters and stops that replace the ring and the sheet, and the exact lengths and timings within the pace.
- **The mock-up** and how it is recorded. It can share code with the site build, but nothing is merged into the site before Bob's OK.
- **The harness steps that prove it,** by real input at the three sizes:
  - the fall running on to the first project;
  - the orbit and the veins, and their reverse;
  - into and out of each bead;
  - all projects in order;
  - the look back and its links;
  - the credits rolling to the form;
  - the skip button's place, its fade and its focus;
  - opening a project and coming back;
  - reduced motion;
  - 3D off;
  - EN;
  - the failed void.
