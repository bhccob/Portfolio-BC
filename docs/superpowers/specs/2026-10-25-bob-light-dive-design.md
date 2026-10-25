# BOB · the light dive and the ring of projects

*2026-10-25. Builds on the BOB compass design (`2026-10-21-bob-compass-design.md`), especially §2.3 ("The dive", "The scroll's stretches", "The pace") and §2.4, and on the end page design (`2026-10-24-bob-end-page-design.md`). Everything they say still holds unless this document says otherwise. This one changes the dive and the projects' layout.*

## Intent

Bob, 2026-10-25, in his words, in order:
- "when diving into the project make there to be unique animation transition and a place to travel to following a light or something (you can come up with) and when scrolling while diving into project there will be facts about me (3d) as they scroll and then finally end up in project dimension and also a button to completely fast travel to Q&A"
- which dive: "when it dives to O from bob but if you have better idea just let me know"
- "not like that per se, but more so when user keep scrolling they will see a few random facts about me as they are scrolling to reach the projects (small 3d texts) and then fast pass to Q&A would be in project"
- "yes but i want them to show 1 by one", with his five facts; "The national titles were in Aruba."
- "i want the text to feel a part of the light thats dropping down"; "the light can be electricity-like too representing my mechatronic role"
- "the text needs to displayed seaminglessly as the light is falling so its just continuos till they reach the project maybe also make the light bigger and more zoomed and focused to it"
- "no ther text looks too childish it just have to glow synced up with the light". His reference is a clip, YouTube `5nYfR36QHyo`, 0:13–0:17 only: "something similair but not exact the same i like the idea of it where the light will just flow and then when user scroll new stuff about me would appear".
- his answers:
  - "Keep the light and the streaks in the site's gold and violet."
  - "Calmer than the clip: the light flows, the streaks drift past softly, it stays dark."
  - "Small and thin, like the site's labels: quiet text that glows as the light passes."
  - "Each fact travels along with the light while it is shown."
  - "No burst: the light just flows out into the void and becomes the needle."
- "yes this feels much better". He wanted the light to come from above and fall down, and he said of the projects: "i dont like that design that the thing is physically connected to the beads give me better styling". Then: "A: the light becomes a free-floating needle that points at the bead from a distance."
- "the background is unecessary since it has to be the same void as the project and maybe make the light so it moves to sides like in the video but not as much", and: "when diving the compass to this it should have a really creative and seamless transition".
- On the way-in frame: "the start of the fall is the sides of the compass so it wont feel natural when transition and not smooth it has to flow iwth the vbiewers eyes". On the needle frame: "the needle is just like randomly placed there, this is a 3d animation where user should be able to rotate 360 when theres enough projects".
- "Yes: the projects in a ring around the needle, the ring turns 360° and the needle points at the one in front."
- "yes this is good enough though dont immediately build it to website when you do animation show me a video or and a mockup before building it to website"

Today the dive from BOB seen from above is one quick scroll stop: the camera drops through the O and out under the glass into the void, where three project beads float at different depths and a large needle points at them. It says nothing about Bob. He wants the way down to become a journey of its own, and he wants the projects to become a place.

The journey: the compass's own needle becomes a falling light, and a few facts about him ride beside it one after another. It ends in a ring of his projects that turns all the way round, with the needle at its centre. Once there, a visitor who wants to reach him can skip straight to the questions and the message form.

## The approved look

On the companion, 2026-10-25:
- **`bob-light-dive-9.html`**, the whole way, approved as "good enough":
  1. BOB seen from above, the needle at the O's centre lighting up (`lightdive-t1.webp`);
  2. the light held at the centre of the screen as the compass slides away and the void fades in (`lightdive-t2b.webp`);
  3. the fall through the void with a fact beside it (`lightdive-v1.webp`, of which Bob said "the fall is good");
  4. the ring of projects with the needle at its centre pointing at the front one (`lightdive-ring2.webp`);
  5. two top-down diagrams of the ring turning.
- **`bob-light-dive-6.html`:** the facts as small, thin labels on a fine gold line beside the light ("this feels much better").

The frames are generated concept stills. The labels, the button and the diagrams are drawn over them in the site's fonts. They set the mood, the light's look, the placement, the type and the layout. They are not the final geometry.

## Goals

1. **The way in: the needle becomes the light, and the eye never has to move.**
   - **The needle lights up.** Seen from above, the compass's needle is the small gold point at the centre of the O. Scrolling down from BOB seen from above makes that point ignite into the light, which starts to sink into the opening.
   - **The light holds still on screen.** The camera follows the light down through the O, and the light stays where the eye already is, at the centre of the screen. Everything else moves around it:
     - the B letters and the compass slide away past the edges, soft and blurred, gone within moments;
     - they never frame the screen like a porthole;
     - the violet void of the projects fades in around the light.
   - **There is no cut** anywhere between BOB seen from above and the projects.
2. **The fall happens in the projects' own void.**
   - There is no tunnel and no streaks: only the void's violet mist, its drifting gold dust and the faint traces on the glass sky above. It is the same space the projects are in.
   - The light falls from above, its long, smooth trail streaming up above it, as in `lightdive-v1.webp`.
   - It sways gently from side to side as it falls, so its trail curves into a soft S. That is like the reference clip but much less: a slow drift either side of the middle of the screen, never a zigzag.
   - The light is an orb of gold light with a soft white-gold core and a gentle halo. The camera is close and focused on it. A few delicate electric filaments flicker around it, for Bob's mechatronics, never strobing or flashing.
   - Only gold and violet are used, on the near-black. It is calmer than the clip, and the void stays dark. The light is a little smaller and softer than in the concept frame.
   - **It follows the scroll continuously,** with no stops in it, like the rise from the home to BOB. A visitor can stop anywhere and it waits there. Scrolling back up runs it in reverse, at once.
   - **Every input that reaches the rise reaches it:** the wheel, the trackpad, a swipe and the keys. End and Home keep their meaning.
3. **Bob's five facts ride beside the light, one after another.**
   - **One at a time, without a gap.** Each fact is shown while the light falls through its part of the fall, travelling with the light, held to it by a fine gold line from the light's side. Then it dims and lets go as the next one comes up on the line, so the stream runs continuously from the first fact to the projects.
   - **Small, thin, quiet labels,** in the site's label face (Martian Mono, a light weight, capitals, widely tracked), with a small number above each (01 to 05). They are never big, heavy or fiery.
   - **The glow is synced to the light.** The words glow softly in the light's colour and follow its brightness.
   - **They are readable** at 1440×900, at 1366×657 and on a 390×844 phone.
   - The copy, made formal from Bob's words. It is shown as capitals, with a line break where the label needs one:

     | | NL | EN |
     | --- | --- | --- |
     | 01 | 20 jaar | 20 years old |
     | 02 | Chinees van afkomst / geboren en getogen op Aruba / woont in Nederland | Chinese by descent / born and raised in Aruba / living in the Netherlands |
     | 03 | Hakka-erfgoed | Hakka heritage |
     | 04 | Oud-nationaal kampioen powerliften van Aruba | Former national powerlifting champion of Aruba |
     | 05 | Oud-nationaal kampioen tafeltennis van Aruba | Former national table tennis champion of Aruba |

4. **The ring of projects, with the needle at its centre.**
   - **The layout.** The project beads float in a ring around a common centre, evenly spaced like the points of a compass. Today the three are 120° apart. Each project added later is one more bead, and the ring respaces evenly until it is a full circle.
   - **The camera** looks slightly down at the ring from outside it, as in `lightdive-ring2.webp`: the front bead is near and large, and the others sit to the back, smaller and dimmer.
   - **The light lands at the centre** of the ring and becomes the needle there: slender, gold, balanced on its pivot in the open, with nothing holding it. It points at the bead in front, and that bead answers with a soft glow along its gold band and porthole.
   - **Nothing joins the needle to a bead:** no line, no beam, no ribbon, no drawn ring.
   - **Turning the ring,** through 360°:
     - scroll turns it one project at a time, and the next project comes round to the front and rests there;
     - a drag (a mouse, or a sideways swipe on a phone) spins it freely in either direction, and it settles on the project nearest the front;
     - the arrow keys turn it.
     - Each way, the needle keeps pointing at the bead in front.
   - **What stays as now:**
     - the bead in front carries its label, with the category line, the title and "Klik om te openen" / "Click to open";
     - a click on it or Enter flies into the project, and Esc or back returns to the same bead in front;
     - the beads keep their objects and real screens, and their motion runs only for the bead in front or hovered.
   - **After the last project** in the ring, scrolling on goes into the night and the end page, as now.
   - **It replaces the void's layout.** The three beads at different depths, the overview stop and the large pointer give way to this ring. The ring's first position, with Funcial in front, is where the fall ends, and it shows all the projects at once.
5. **The skip button: "Snel naar vragen ↓" / "Skip to questions ↓".**
   - **Where it shows.** It shows while the story is at the ring, the turns between projects included. It is gone everywhere else: in the rise, the way in, the fall, the move into the night, at the end page, and on the project pages.
   - **What it does.** One click, tap, or Enter takes the visitor straight to the end page by the step fade (out, the story placed at the end page, in), never by turning through the ring. On arrival the focus moves to the end page's title.
   - **How it looks and behaves.** It sits at the bottom right in the site's label style: a small pill with a gold hairline. It sits above the phone's safe area and never covers the front bead's label. It is a real button: the keyboard reaches it, it shows the site's focus ring, and a screen reader reads it.
6. **The void's loading hides behind the fall.**
   - The light and its facts play regardless, and only the landing in the ring waits: the light holds just above the ring until the beads are ready, then flows on. A visitor who scrolls at an ordinary pace never meets the hold.
   - The way in, the light and the labels must not wait on the beads' file.
7. **Both languages.** NL at `/` and EN at `/en/`, with every word in the dictionaries.
8. **The facts are in the HTML.** They are server-rendered in the home's page as a short list, so screen readers and crawlers have them and they exist without JavaScript.
   - With 3D on, the list is visually hidden, the way `.home-nav` is.
   - With 3D off, no WebGL, or the fallback card, it shows in the home's normal flow before the project links.

## A video and a mock-up first (Bob's rule)

Bob: "dont immediately build it to website when you do animation show me a video or and a mockup before building it to website".

Before anything of this goes into the site's code, Bob sees and approves:
- **a mock-up:** a standalone, throwaway real-time page outside the site, on the companion, that he can scroll and drag;
- **a video:** a recording of that mock-up.

Together they show:
- the needle lighting up and the light held at the centre through the O;
- the fall through the void with its sway and two or three facts;
- the landing in the ring as the needle;
- the ring turning by scroll and by drag;
- all of it at 1440×900 and on a phone.

The site build waits for his OK, and anything he changes goes back through the mock-up first.

## Non-goals

- The project pages' 3D interiors (M3), which follow this.
- Any change to the loader, the home, the rise, BOB seen from above, the bead objects and screens, opening a project, or the end page. The exceptions:
  - the ring's layout (goal 4);
  - the skip button arriving at the end page;
  - the stops moving along the scroll, which shifts their place but not what they do.
- Lite, contact and sound.
- Facts beyond Bob's five, and random selection: every visitor sees all five, in his order.

## Anti-goals

These would make it a failure even if it worked:
- **A changed or invented fact.**
- **Childish text:** big, heavy, fiery or cartoon letters.
- **A way in the eye has to chase:**
  - the light jumping across the screen;
  - the compass framing the screen;
  - a cut.
- **A busy or bright moment:**
  - two facts at once;
  - a strobe, a hard flicker, a flash or a burst;
  - colour beyond gold and violet;
  - streaks or a tunnel;
  - the light outshining the words or the void losing its dark.
- **Anything physically joining the needle or the light to a bead.**
- **A needle that looks placed at random.** It is always at the ring's centre.
- **A chore or a trap:**
  - a fall so long that reaching the projects feels like work;
  - a scroll or a drag that fights the visitor or will not go back;
  - a fact that cannot be read on a phone;
  - a ring that can be spun out of reach of its labels.
- **A stall with nothing to look at** while the beads load.
- **The skip button anywhere but at the ring,** or covering the front bead's label.
- **Building into the site before Bob has seen the video and the mock-up.**

## Constraints

Everything binding on M2b and on the end page still binds:
- the strict CSP (no inline script or style, `worker-src 'none'`, and no new source the policy does not allow);
- the luma gate for the home's stills, which also judges these stills;
- NL as the default;
- formal copy;
- the Cookies Clicker classmate is never named;
- the pace rules (§2.3 "The pace") and the end page's arrival at the move's 99 %;
- the scroll's one shot writer;
- one pose per frame;
- the canvas asleep when nothing moves;
- the harness passing in full, at the three sizes, by real input.

## Decided by Bob

- The journey is the dive through the O, from BOB seen from above down to the projects, following a light.
- His five facts ride beside it one by one, in one continuous flow, with the national titles in Aruba.
- The light is electricity-like, for his mechatronics role.
- The look follows his clip (0:13–0:17), "similar but not exactly the same":
  - gold and violet;
  - calmer and dark;
  - the light falling from above with the camera close on it;
  - a gentle sway, less than the clip.
- The facts are small, thin labels like the site's, glowing in sync with the light, each travelling with it while shown.
- No tunnel: the fall is in the projects' own void.
- The way in is creative and seamless and flows with the viewer's eye.
- No burst. The light becomes a free-floating needle that points from a distance, with nothing joined to a bead.
- The projects form a ring around the needle that turns 360°, and the needle points at the one in front.
- The skip button to the Q&A lives among the projects.
- A video and a mock-up before any building into the site.

## My calls (Bob may change any)

- **The needle becomes the light at the O's centre,** and the light becomes the needle at the ring's centre: needle, light, needle.
- **The light held at the centre of the screen** through the way in, and near it through the fall.
- **The ring's controls:**
  - scroll turns one project at a time, with rests;
  - a drag spins freely and settles on the nearest project;
  - the arrows turn it;
  - the first ring position replaces the overview stop.
- **The ring's camera,** slightly above and outside it, as in the frame.
- **The fine gold line and the small numbers on the labels,** and the wording in the table: "Chinees van afkomst", "Hakka-erfgoed" / "Hakka heritage", "van Aruba", and no full stops on labels.
- **"20 jaar" is fixed text,** to be changed on Bob's birthday.
- **About four screen heights of scroll** from BOB seen from above to the ring. The fall follows the scroll with a gentle lag of about 0.45 s, a key moves about one fact's length, and End, Home and the skip button keep their own moves. All of it is tuned in the mock-up.
- **The button.** Its words and the ↓; a fade rather than a turn through the ring; the focus moving to the end page's title.
- **Reduced motion.**
  - The way in and the fall become steps: BOB seen from above, then each fact, then the ring, each by the step fade.
  - The ring turns by a fade from one project to the next, not a spin.
  - The light does not fall.
- **The facts as an HTML list** for screen readers and 3D off.
- **A failed void.**
  - The way in and the fall still play, and the story holds where the ring would be.
  - The home nav, with its "Vragen & contact" link, shows there as it shows at the hold today.
  - The skip button does not show, because there is no ring.

## The visual reference

On the companion, `.superpowers/brainstorm/625-1792939158/content/` in the main checkout (git-excluded, copied from the earlier folder `1850-1792919258`):
- **The approved look:** `bob-light-dive-9.html`, with its frames `lightdive-t1.webp`, `lightdive-t2b.webp`, `lightdive-v1.webp` and `lightdive-ring2.webp`, and its diagrams.
- **The labels:** `bob-light-dive-6.html`.
- **Bob's clip:** YouTube `5nYfR36QHyo`, 0:13–0:17. A light streaks through dark space past speed lines, then through curving trails and a tunnel of streaks, to a white burst. He kept the flow and turned down the colours, the intensity, the streaks and the burst.
- **Turned down along the way, kept as history:** `bob-light-dive.html` and `-2` to `-5` (panes, drifting words, one by one, 3D letters, big written letters), `-7`'s options and `-8`'s way-in and needle frames.

Where they differ from this document, this document wins.

## Left to the builder

- **How the mock-up is made** (Bob's rule) and how it is recorded. It can share code with the later site build, as long as nothing is merged into the site before Bob's OK.
- **How the labels are drawn.** For example, as DOM text placed each frame at the light's projected position, or as text in the scene, within the CSP (no workers) and the canvas's frame budget, with their glow following the light.
- **The scroll structure in code.** The fall goes in the chapter and stop structure as a continuous stretch like the rise, between BOB seen from above and the ring; the builder decides that, and how the ring's positions become stops.
- **The scene.**
  - the camera's path through the O and down into the void;
  - how the compass slides away around the held light;
  - how the light, its filaments and its trail are drawn;
  - how the sway moves;
  - where each label sits on each screen size.
- **The ring.** Its radius, height and spacing; how the beads' existing objects and screens sit in it; the needle's model, how the light turns into it, and how it follows the ring; and the drag's feel and settling.
- **The hold and the failed void:** how the hold moves to just above the ring, and how the failed void reaches the same place.
- **The exact lengths and timings,** within the pace.
- **The harness steps that prove it in the site,** by real input at the three sizes:
  - the way in with the light held in place;
  - the fall and its reverse;
  - the five facts one at a time and in order;
  - stopping mid-way;
  - the keys;
  - the ring turning by scroll, by drag and by keys, all the way round, with the needle on the front bead;
  - opening a project from the ring and coming back;
  - the hold;
  - the failed void;
  - reduced motion;
  - 3D off;
  - EN;
  - nothing touching a bead;
  - the skip button's place, its fade and its focus.
