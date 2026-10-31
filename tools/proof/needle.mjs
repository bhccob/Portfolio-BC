#!/usr/bin/env node
/**
 * Proof harness for the Needle site (React Router + React Three Fiber).
 *
 * Drives a headless Edge through the built site, served the way GitHub Pages
 * serves it (npm run build, then npm run preview). It prints one
 * `PASS|FAIL <step> <detail>` line per step, writes results.json to PROOF_DIR,
 * and exits 1 if a step failed. Every step also fails on a console error, a
 * page error or a CSP violation.
 *
 * Nothing is ignored: the build writes the real policy into every page
 * (tools/build/postbuild.mjs), so a page that still holds the `__CSP__`
 * placeholder fails on Edge's parse error like any other console error. The
 * one console message a step may expect is named in the step itself and counted
 * (not-found: the browser's own "Failed to load resource" for each 404 document).
 *
 * A run that cannot begin (nothing built, the preview server not answering, Edge not starting) prints
 * `FAIL setup <reason>`, writes a results.json that holds that failure, and exits 1.
 *
 * THE DEBUG BRIDGE. The page's one proof hook is `window.__needleDebug()` (src/debug/needleDebug.ts), which the site
 * installs only when the first URL of the page has `?proof`. Every step that reads the site opens its page with
 * `?proof`. It answers the scene's phase, `progress`, `target`, `velocity`, the chapter (`index`, `id`, `local`,
 * `category`), the route and locale, the quality `tier`, the canvas's `dpr`, a rolling `fps`, the `camera`,
 * `canvasMounts`, `contextLost`, `threeD`, the opening's `loader` (`stage`, `elapsed`, and `strokes`: how much of each of
 * the five engraved marks is cut; the loader cuts the circle alone, so the four B marks stay 0 and only the circle, the
 * last, runs to 1), the compass's `needleAngle` (radians, 0 up the screen, clockwise positive) and the home's `scroll`
 * (`u`, the rise from the home to BOB seen from above, 0 to 1, and `letters`, `iris` and `needleDip`, each 0 to 1) and
 * the home's `journey` (`stretch`: `rise`, `light`, `land`, `area`, `look`, `qa` or `end`; `local`; the
 * bead of a travel or an arrival, `project`; the void's load, `voidState`: `idle`, `loading`, `ready` or `failed`;
 * the way `frame` in the light dive, the `sheet` (how far into the Q&A), the Q&A's ring (`qa`), the falling light's
 * parts and its traces' top (`circuit`), the `light`'s place (NDC), the `beads` on the screen (px centre and
 * radius, shown or not), the bead `label` beside the light and its opacity, and each bead's veins' `wake`, radians);
 * `.set({ progress })` puts the story somewhere, `.dispatch(event)` sends a scene event, `.seekLoader(seconds)` holds
 * the opening's clock at a moment (-1 lets go), and `.scrollRequest` is the scroll loop's requestAnimationFrame, which
 * `watchFrames` wraps. Without `?proof` there is no bridge and nothing of the site reads or writes a hook (step bridge).
 *
 *   routes     every page of pagePaths() that the build produced, each answers 200 with one <h1>
 *              (in its HTML and after hydration) and the right <html lang>, and a page without a scene
 *              (its route's handle.scene is null: Lite, contact) has no <canvas>; a page the build did
 *              not produce is listed and skipped
 *   slash      GET /projects/steady answers 301 to /projects/steady/; a browser opening /projects/steady loads
 *              /projects/steady/ once, with no reload
 *   bridge     the debug bridge: absent without ?proof, and with no proof hook of the site read or written through
 *              a load, the opening's landing and a wheel gesture's frames (every hook name is trapped on the window);
 *              with ?proof the old hooks are gone, the state has exactly its fields and sensible values (landed: the
 *              circle cut whole and no B mark cut, a needle angle, the scroll at 0, the journey on the rise), `.set` puts the story in a chapter
 *              (half way through Steady's travel, the path's first unit, and the journey says the travel, its beads and
 *              their wakes, and no ring; at fact 02's peak it reports way frame 121 and the light's place) and stops at the
 *              end (the ring's end mark, where the scroll ends: chapter END, the phase END, the journey's `end` stretch), `.dispatch` sends an
 *              event (a project opens from the last bead's stop), a wheel's frames go through `.scrollRequest`, and the language
 *              switch shows in the state
 *   persist    client navigation / → /projects/steady/ → /en/projects/steady/ (the language switch replaces the
 *              history entry), then history.back() to / and history.forward(): the Stage mounted once and
 *              the same <canvas> node throughout, with no document load after the first; the scene's phase
 *              is PROJECT_FOCUS steady on the project page, the language switch keeps that very phase (no new
 *              transition), going back to / puts it at Steady's area stop, and going forward restores it
 *   lang-keeps-phase  on /projects/steady/ the phase is PROJECT_FOCUS steady; after a client-side switch to
 *              /en/projects/steady/ (and back) it is still PROJECT_FOCUS steady, the very same state, with locale and
 *              route right, canvasMounts 1 and the same <canvas>; the same on /projects/cookies-clicker/
 *   not-found  an unknown URL (/does-not-exist/, /en/does-not-exist/) answers 404 with the build's
 *              404.html; after hydration it shows the not-found route's <h1> and the right <html lang>,
 *              and the browser loads one document, with no reload loop; the page has no scene, so it
 *              asks for none of the scene's files, mounts no Stage and still leaves LOADING
 *   home-nav   the home page's links to the four projects: visually hidden but reachable by keyboard while 3D is on
 *              (and shown while one has focus); the header has no 3D switch and no link to the light version (Bob took
 *              them away, 2026-10-29), and a choice the switch stored before is not read: 3D on, the Stage mounts
 *   mobile     every page at 390 px wide has no horizontal scroll
 *   phone-menu  on a touch phone the header is one row (the name, Menu); Menu opens the nav as a sheet under the header,
 *              its links 44 px high or more, the language switch its one other control; a link closes it, Escape closes it before
 *              going back; it opens with script off; a laptop has no Menu button and its nav is one row
 *   case-variant  a real page under another spelling (/Projects/Steady/, /en/projects/FUNCIAL/) is a 404 on
 *              GitHub Pages and shows the not-found page, not an error screen (the server here is
 *              case-sensitive too, so the fallback is what answers), with no scene, like any not-found page
 *              (the client router matches it to the page's route, ignoring case; the handle does not)
 *   esc        the back link on a project page: Escape goes by client navigation, unless focus is
 *              in a text field or the key was already handled. On a page the visit began on (a direct load)
 *              it goes to the home page of that language; on a page reached from the home page it steps back
 *              through the history (the page forward is still there). A replace navigation keeps a page the
 *              visit began on its place: after the language switch, or the contact form's ?sent=1 replaced by
 *              /contact/, Escape still goes home (in the current language). Clicking the link does what Escape
 *              does, in both cases, but a ctrl-, meta- or shift-click is left to the browser (its default is
 *              not prevented). The scene's phase follows: the page's on the page, and on the home page the stop
 *              of the page's bead after Escape or Back (Steady's arrival, PROJECTS app), but the
 *              home itself (HOME_IDLE at 0) after the header's name, a link, a deliberate "to the top". The "Esc" hint is aria-hidden
 *              and hidden on a touch screen
 *   nav-focus  a link (a push) opens the new page at its top with the focus moved to <main>: on /lite/ scrolled down to
 *              the projects, a click on one shows its <h1> at scrollY 0, and Tab goes on inside the new page; Back (a
 *              pop) returns near the place left; the language switch (a replace) keeps the place, the project on screen
 *              where it was; a push to a place in a page (/en/lite/#career, through React Router's own
 *              window.__reactRouterDataRouter) scrolls to it
 *   lite       /lite/ and /en/lite/: one <h1>, every section's heading (from the dictionary) in order and
 *              no skipped level, the real portrait loaded with its alt text and size, at least five
 *              <details> that open by keyboard with a visible focus ring, #career where the old /career/
 *              addresses land, the work section's own copy (intro, next slot linking to #career, the
 *              held-back note) around the projects in the old order, no terminal or engine-room copy,
 *              and the page complete with JavaScript off.
 *              /contact/ and /en/contact/: the one <h1> is the contact copy's title; an empty submit
 *              names the first bad field and moves focus to it; with no access key in the build, a filled
 *              form navigates to a mailto: link to Bob (the navigation is cancelled in the page, so no mail
 *              client opens) and shows the "almost there" panel; with a key (a CI build) the form carries
 *              it and, with Web3Forms answered by this harness (nothing is sent), posts once, shows
 *              success, holds the honeypot (success shown, nothing posted) and the pause, sends a form sent
 *              at once after the rest of three seconds (saying it is sending meanwhile; never dropped), shows
 *              the error of a failed post and moves focus to it, and, for a post nobody answers, sends one
 *              post for two submits and fails it after the 15 s timeout (Playwright's clock moved forward) so
 *              it can be retried
 *   scroll     the home page with 3D on does not scroll natively: <html data-route="home"> locks the root
 *              (overflow hidden, no overscroll, pinch-zoom only) and the wheel, the keys and a finger move
 *              `target` in viewport heights instead (window.__needleDebug). A direct load of / reaches HOME_IDLE
 *              once the scene is ready. 10 wheel events of 120 px raise it by 1200 px, and once the wheel is quiet
 *              the gesture, come up out of the rise less than a whole unit past its top, settles on the top, BOB from
 *              above (1): the damped `progress` catches up, the phase leaves HOME_IDLE for DIVE and the scroll loop goes back to
 *              sleep (no frame asked for at rest, and only one at a time while it runs: through a wheel gesture
 *              and through a touch glide, which lasts over a second; the loop's own requests are counted through
 *              window.__needleDebug.scrollRequest, apart from the canvas's, which renders on demand through R3F's own
 *              requestAnimationFrame); on the rise the arrows and Page Down move it by their distance up to its top,
 *              and past it each key is a stop (the arrows, Page Up and Down, Space); Home and End; a text
 *              field keeps its keys, a pinch (ctrl+wheel) is the browser's, and where 3D cannot run (Edge without
 *              WebGL) nothing is prevented and the page scrolls natively; `chapter.index` stays in step, and Back from a
 *              project page lands at that bead's stop, in PROJECTS, not on HOME_IDLE. With reduced motion a
 *              whole wheel gesture is one stop (1, 2, 3, ...) and so is a key press. On a touch screen
 *              (CDP touch events) a drag moves it, a slow flick glides on after the finger lifts on the rise,
 *              flicks past the rise rest on stops, and a tap and a sideways swipe do not move it
 *   scroll-bob the home's first unit of scroll, the rise from the compass to BOB seen from above (the bridge's `scroll`:
 *              `u`, `letters`, `iris`, `needleDip`), at 1440x900 (the wheel) and 390x844 (touch, coarse pointer), landed
 *              with the seen flag set: at rest `u` and `letters` are 0 and no B mark is cut; moved the whole unit (ten
 *              wheel notches, swipes) and at rest, `u`, `letters`, `iris` and `needleDip` are all 1 (the gesture settles on a
 *              stop past the rise), and at stop 1 (put there through `.set`) the camera is on the top shot, with a still of
 *              it (`m2/bob-from-above-<size>.png`) gated as a home still; one mid-rise still at `u` 0.6 put there
 *              through `.set` (`m2/bob-rising-<size>.png`, also gated as a home still); moved back from where the ten notches
 *              summed to, `u` and `letters` are exactly 0 and, at 1440, the needle aims at the pointer again within 1.5 s,
 *              eight real wheel notches (1.067, past the rise's top by more than the slop, less than a whole unit) rest on
 *              the top, BOB from above, 1, with the camera on the top shot, one more notch goes on into the light dive by
 *              its distance and rests there, and
 *              seven real arrow presses stop on the rise's top, 1, with the camera on the top shot. The hero's SCROLL
 *              cue leaves with the rise (no text during the scroll):
 *              shown at the home, gone (computed opacity 0, `<html data-rising>` set, still in the page) at `u` 1
 *              and mid-rise, and back at the home, with a 0.4 s opacity transition and none under reduced motion.
 *              With reduced motion (1440) one wheel event sets
 *              `<html data-step-fade>` with the pose still at the home, then lands on `u` 1 with the attribute gone
 *   light-dive  at 1440x900 and 390x844 (touch): the light where the mock-up's data puts it (tests/fixtures/light-dive)
 *              within 6 px at way frames 20, 60, 121 and 241, the dive running frames 1 to 256; at frames 72, 121 and
 *              201 the circuit light's frame, dial and five traces drawn, the traces above it on the screen; from BOB
 *              from above, notches (swipes) run the way frames up to the path and never back, and from the fall notches
 *              up run them back; stopped mid-fall the story rests where the input stopped, not on a stop, and the
 *              canvas draws the storm alone (STORM_FPS_MAX frames a second at most)
 *   letters    at 1440x900 and 390x844 (touch): the B letters as the compass's bands light on the rise, wheel notches
 *              from the home taking their share from 0 to 1, never back; a point on the right B's back and one on its
 *              foot farther out, projected through the rise's camera, both dark at share 0, the back lit and the foot
 *              dark half way (from the O outward), both lit at BOB from above
 *   light-facts  at 1440x900, 1366x657 and 390x844 (touch), in Dutch and English: at each fact's peak one label, its
 *              number and the dictionary's words in capitals ("/" a line break), never two at once through the fall;
 *              its words 13 px or more on a laptop, 11 on the phone; on a laptop level with the light on the side away
 *              from its move; on the phone below it, the line stepped aside away from the move, the picture under the line
 *              dark (mean luma 0.05 or less)
 *   world      the hologram world by real input at 1440x900 and 390x844 (touch), and at 1440 on /en/: from the last
 *              fact the arrow (slow swipes, then the bridge) brings the light down into the CPU and rests on the world's
 *              stop: the board dark as the light comes down, powering up to 1 and never falling back; every object framed
 *              inside the screen; each project's name on its line (the title in capitals, in Tab's reach, inside the
 *              screen under the header, a link to its page) and the hint in the page's words for a pointer or a touch
 *              screen; no area's words, no dots; a still through the home's luma gate; each name opens its project and
 *              the way out comes back to the world
 *   areas      at 1440x900 and 390x844 (touch): from the world a step (the arrow; the bridge) to each area's stop, the
 *              camera never nearer the board's centre than 3 m on the way (never across the CPU), the object framed, its
 *              words at the bottom left (category, name, open hint) and no other's, the dots shown with its own lit, the
 *              names gone; a still of each through the home's luma gate; the first dot glides back to the first area
 *              round the board
 *   qa-ring    the Q&A as a gold ring round the closing stack, at 1440x900, 1366x657, 390x844 (touch) and 1440 on
 *              /en/, from the look back's stop: one notch (swipe) closes the stack and rests on question 1 within 3.5 s;
 *              on a laptop ten notches in 200 ms step once, a notch 1.0 s after a step is dropped and one at 1.6 s steps,
 *              each turn at rest within 2.3 s; the next mark's button turns the ring to it; a mouse drag of 160 px turns it one
 *              question and lets go onto it; each answer the dictionary's; at 1440 a resize to 390x844 keeps the place;
 *              up from question 1 opens the stack back to the look back; a still of each mark through the home's luma
 *              gate (with reduced motion the reduced-motion step walks the ring)
 *   qa-end     the ring's end mark at 1440x900 and 390x844 (touch): the whole ring lit, "Einde van de site", "Stuur een
 *              bericht.", the line word for word and both buttons; the end unmistakable (<html data-qa-end>: the dark
 *              over the scene, 0.85 or more, the gold circle drawn whole within 3 s, the words in the screen's middle,
 *              the marks' numbers gone) and one input up leaves it with nothing of it left; "Naar contact" opens
 *              /contact/ with its form; "Terug naar het begin" takes the story to the home at 0; at 1440 the nav's
 *              .end-link goes to the end with the focus on #qa-end-title; where 3D cannot run (Edge without WebGL)
 *              #end is in the flow with its form, nothing of the ring left
 *   resize     at 1440x900 turned to 390x844: at fact 02's peak the way frame stays and the fact rides below the light;
 *              at Steady's area the place stays, its words shown whole and its object framed above them; between two
 *              areas the place stays and the camera stays off the CPU
 *   project-view  a project's own page, at 1440x900, 390x844 (touch) and 390x844 on /en/, from Steady's area: a
 *              click (a tap) on its object opens it within FLIGHT_MS and a little (the page still `/` with the open
 *              project's history entry, its words the dictionary's with "Lees meer", the way back shown and focused),
 *              the object in the torn top at the page's spot, its three phones (a row with dots on the phone); a still
 *              through the inside's luma gate (0.15); the wheel (a swipe) scrolls the page and never leaves it; "Lees
 *              meer" opens Steady's page and Back returns to it; → twice (the next project's button) opens the third
 *              project, replacing the entry, Portle with its one card; Escape, the way back and Back each close it
 *              at rest; with reduced motion in and out by the step fade
 *   nebula     the 3D nebula, at 1440x900 and 390x844 (touch): the bridge's levels (`journey.nebula`) are the rules' at
 *              the fall's frames 30, 72 and 121 (the fall's at its quieter level), on the land, at the world, on the way
 *              to each area and at it, the look back and into the Q&A; the fall's clouds 0.9 and its bands 0.85; stills
 *              of the fall, the world, Jontai Energy's area and the look back through the home's luma gate
 *   void-hold  the world's build held back (src/debug/worldGate.ts): a long wheel (flicks on the phone) plays the light dive and rests at
 *              LANDING_HOLD, the hand-over (way frame 256), with `voidState` `loading`, the light still, a still of it gated as a home
 *              still; up from the hold moves at once (three notches exactly their distance) and rests where it stopped;
 *              let through, the void is `ready` and the story goes on to the world; a direct arrival's Esc while the world
 *              is held waits at the hold, then reaches its stop
 *   void-fail  the world's build failed (src/debug/worldGate.ts): `voidState` `failed`; the light dive plays and the scroll holds at
 *              LANDING_HOLD, where (`<html data-held>`) `.home-nav` shows (fixed over the foot of the screen, its links
 *              on screen and reachable, its link to the questions with them) and no skip button does; a still of it gated as
 *              a home still; a link opens its page and Esc comes back to the hold, not to the project's stop; back at the
 *              home the nav is hidden again; no console error, and the Void's own line a warning
 *   (Every still of the two void steps is gated with the page's text masked, so the luma floor is the scene's, and the
 *   failure has a negative control: a still with the canvas hidden, whose masked floor must fail.)
 *   keyboard   Tab from the top of the home page reaches the skip link, then the header in its order (the name, Work,
 *              About, Contact, the language switch; no link to the light version, no 3D switch) and leaves it after
 *              the language switch, which has a focus ring (outline 2 px or more) and is on screen, and Shift+Tab goes
 *              back; the language switch shows "EN" and its name begins with it (WCAG 2.5.3, label in name); End
 *              jumps to the last chapter (the end of the story, the ring's end mark, END) and Home returns to the
 *              start, both by the step fade with the focus on the language switch; from BOB from above the arrows step
 *              every key stop (the facts, the world, each area, the look back, each mark on the ring); at Jontai
 *              Energy's board Tab from the language switch reaches its name, the dots, then the skip button, and Enter
 *              on it fades to the Q&A's first question with the focus on its mark
 *   reduced-motion  with prefers-reduced-motion: reduce (page.emulateMedia, before the load) one wheel event moves
 *              `target` to exactly the next key stop, through all nineteen (the home, BOB from above, the five facts
 *              at their peaks, the world, each area, the look back's own stop, each mark on the ring) and back, the
 *              Q&A's lock waited out on the ring, and the story arrives at each, in the right chapter, by the step fade,
 *              with no pose between the two stops; one more at the end's mark is no step (no fade at all)
 *   loaded     a direct load of / goes from LOADING to HOME_IDLE once the opening has landed, within the load
 *              timeout and with no navigation on the way; the canvas is shown then, and the wheel moves
 *              `frame.progress` straight away. The canvas renders on demand: after the home's idle motion it
 *              asks for no frame at all, and the pointer wakes it; over a project page a mouse wiggle wakes only the
 *              parallax. A choice the header's 3D switch stored before it went is not read: 3D on, the Stage mounts
 *   no-scene   Lite is the light version: a direct load of a page without a scene (/lite/, /contact/, /en/lite/,
 *              /en/contact/) asks for none of the scene's files (the Stage chunk, three.js, maath, the textures),
 *              mounts no <canvas>, probes no WebGL, shows no fallback card and leaves LOADING with 3D still on; from
 *              the home page to the contact page by client navigation the one canvas stays (canvasMounts 1, the same node) and
 *              sleeps: no requestAnimationFrame at all through 1.5 s of mouse moves, nor through scrolling (wheel and
 *              scrollTo) or the window's resize and the fonts' loadingdone events sent with no change of size; a real
 *              resize redraws it once at its new size and it sleeps again; back home the pointer wakes it
 *   no-webgl   Edge with WebGL switched off (--disable-webgl --disable-3d-apis): / and /en/ show the poster (the
 *              CSS panel of the night, no image, over the whole viewport) and
 *              the fallback card (THE NEEDLE LOST NORTH, in the page's language) with its link to Lite, no
 *              <canvas>, 3D off for the visit and nothing stored, the home page's links shown
 *              and the page scrolling natively, the phase out of LOADING; and with only a software rasteriser
 *              (SwiftShader) the same card. On the GPU the scene's own failures fall back to the same card: a
 *              context lost for good (after the restore timeout) and a scene never ready (its chunk never
 *              answers, after the load timeout); a reload tries again, and a context that comes
 *              back draws again with no card. Zero console errors throughout
 *   load-throw the real Stage chunk served with one call inside the opening's load (the band strips uploaded to the
 *              GPU, once the compass is built) made to throw: the fallback card well inside the load timeout, 3D off
 *              and not stored, HOME_IDLE, no data-ready and no canvas, and exactly one console error, the host's report
 *              of the failure
 *   background a direct load of / waiting in a background tab past the load timeout (visibility and frames
 *              emulated, as headless Edge never hides a page): no fallback; in front, the scene loads
 *   title-ij   every Dutch text set in Unbounded with an IJ is shaped with the font's Dutch locl off (no IJ digraph
 *              reading as a U); a crop of the NL card title into PROOF_DIR/m2/
 *   stills     every page of pagePaths() that the build produced, with 3D on, at 1440x900 and 390x844, once the
 *              opening has landed, and the fallback at both, into PROOF_DIR/m2/ (`nl-projects-steady-1440x900.png`,
 *              `en-home-390x844.png`, `fallback-390x844.png`); on a project page the poster's scrim is
 *              over the scene once it shows, and before then only the poster's own (the Stage chunk is held while
 *              that is measured, so it cannot race); on Lite and contact no scene loads and the poster carries the
 *              page scrim; and the light dive (way frames 60, 121, 241), each project's arrival, the look
 *              back and the Q&A's end at both sizes, gated by LUMA_GATE as home stills, with the page's text masked
 *   loader-stills  at 1440x900 and 390x844, in a fresh context, once the real load has landed (HOME_IDLE): the
 *              opening's clock held (`seekLoader`) at five moments of the BOB loader, which cuts the circle alone and
 *              runs 6.25 s: 0.5 s (dark: the probe coming down), 50/24 s (engrave: half the circle), 3.6 s (open: the
 *              iris), 4.6 s (rise) and SCRIPT.home, 6.25 s (home), each moment's `loader.stage` checked and a still
 *              taken (`m2/loader-<n>-<size>.png`); the phase stays HOME_IDLE throughout, and let go the opening is
 *              back at home
 *   loader-skip  a first visit's full show: a click 1.5 s in (inside the circle's cut) lands on HOME_IDLE within
 *              1.6 s; reloaded with the seen flag cleared, 40 wheel events over 1 s from 1.5 s in (the burst's real
 *              length checked, 0.9 to 1.4 s) land on the home too, and after the burst the story's progress and target
 *              stay 0 for 1.5 s (six samples), the page unscrolled: the input that skips never scrolls; and once more,
 *              Space (a real key press) 1.5 s in lands within 1.6 s and moves neither the story nor the page
 *   loader-lite  the skip listens only while a scene is shown: a first visit to /projects/steady/ with the compass's file held back (the load still out),
 *              its header's Work clicked 1.5 s into the loader: on Lite five wheel turns, Space and PageDown each scroll the
 *              page (scrollY above 0, nothing prevented); the file let through and back on the project page, the skip
 *              asked for at the link lands the show
 *   loader-skip-touch  on a touch phone (390x844): the loader never draws at the high tier (a coarse pointer starts on medium); a tap 1.5 s in
 *              lands on HOME_IDLE within 1.6 s, its touchstart not prevented; a tap on Menu, then on its Contact link, 1.5 s
 *              into a project page's show still navigates
 *   quick-loader  a first visit plays the full show and marks the loader seen (`bob-loader-seen` in localStorage);
 *              with the flag set, a load never engraves and reaches HOME_IDLE within QUICK.home + 0.5 s of the load
 *              (the first moment past `dark`)
 *   loader-reduced  with reduced motion the opening never engraves (dark, the fade, home), the camera is the home
 *              shot throughout (three samples identical: early, half way, landed), and nothing is marked seen
 *   give-up    the compass's file (/models/bob-compass.glb) never answers: the fallback card ("THE NEEDLE LOST
 *              NORTH", on /en/) shows between 25 and 27 s after the page started (the loader gives up 25 s in)
 *   home-look  the home once landed at both sizes (`m2/home-<size>.png`, and three more samples a quarter of the
 *              needle's 4 s breath apart in `m2/samples/`), and the luminance of every home and loader still,
 *              measured in a page (the PNG as a data URL in an <img>, drawn on a canvas, read with getImageData):
 *              mean Rec. 709 luma of the sRGB values (0..1) at most 0.11 on the home (every sample, so the breath's
 *              peak) and 0.07 on the loader, at most 0.4 % of the pixels at luma 0.98 or more (the dark look's gate),
 *              and dark but drawn: mean above 0.002 and some pixel of the scene's middle (where no page text stands)
 *              at luma 0.3 or more (its floor: a canvas that drew nothing cannot pass for a dark one)
 *   aim        at 1440x900, once landed: the mouse to the right of the compass's pivot (the screen's middle, where the
 *              home shot looks) turns the needle to within 0.1 of pi/2 within 1.5 s (`needleAngle`; a still,
 *              `m2/aim-right-1440x900.png`, gated as a home still); on a touch phone (390x844), with no cursor, the
 *              needle drifts on its own: `needleAngle` changes over 3 s
 *   sleep      landed and left alone (no input at all, so the needle drifts), the canvas runs its idle motion and the
 *              drift on to its next rest and then draws the storm alone (spec 2026-10-30-bob-storm-design.md): no more
 *              than STORM_FPS_MAX frames a second for a whole second within DRIFT_RUN + SLEEP_WITHIN_MS of the landing,
 *              and not before DRIFT_RUN - 2 s (DRIFT_RUN is the drift's first rest after the idle while,
 *              nextDriftRest(IDLE_SECONDS)); with reduced motion the storm stands still and the canvas draws nothing
 *              for a whole second within SLEEP_WITHIN_MS
 *   storm      the storm behind everything (spec 2026-10-30-bob-storm-design.md), at 1440x900 and 390x844 (touch):
 *              at the start screen it is in (its sky at STORM.sky.home, its flats whole) and moving, and the picture
 *              changes over 3 s; in the fall (way frame 110) its sky at STORM.sky.fall and no flats; at the world's stop
 *              at STORM.sky.void; left alone at the world it draws no more than STORM_FPS_MAX frames a second; on a
 *              project's page it stands still; with reduced motion it is in but stands still (its clock does not move)
 *   hero-failsafe  with JavaScript on but the entry chunk aborted (the page never hydrates), the hero (the hidden name
 *              and the scroll cue) and the header are hidden and then shown by the CSS fail-safe about 8 s in; with
 *              the page working, both stay hidden until the phase is HOME_IDLE and then show
 *   csp-enforced  the policy is in force, not only unbroken: on / and /lite/ after hydration, an injected inline
 *              <script> and an inline handler (<img onerror>) do not run, and the page reports a
 *              securitypolicyviolation for each (script-src-elem, script-src-attr); the browser's console refusal of
 *              each is expected and counted
 *   fps        on / (the GPU), 3 s after the scene is ready: 120 requestAnimationFrame frames while the scene
 *              draws, and their mean frame rate is reported, not gated, with the scene's own rolling fps, tier and
 *              pixel ratio from the bridge; it passes when the canvas holds the scene: read back through toDataURL
 *              right after a drawn frame, it has something bright, and the compass on its axis (the middle column)
 *
 * The harness reads src/data/pages.ts, src/app/handle.ts (which pages have a scene) and src/state/chapters.ts (through
 * tsx) and the build in dist/client to know which pages, scenes and stops to expect. The void's steps also read the
 * journey (src/scene/bob/journey.ts: the beads, the pure poses), the landing's hold (src/scene/bob/landingHold.ts), the
 * light dive's fixtures (tests/fixtures/light-dive),
 * the categories (src/data/categories.ts) and the Dutch dictionary (src/i18n/Translator.ts); the project titles are read
 * from the text of src/data/projects.ts, which cannot be imported here (it globs the screenshots with Vite).
 *
 * Environment:
 *   BASE             site to test, default http://localhost:4399
 *   PROOF_DIR        where results.json and the stills (m2/) go, default ./proof-out
 *   STEPS            comma list of steps to run, default all; an unknown step, or none, exits 1
 *   PLAYWRIGHT_CORE  path to a playwright-core package outside the repo (else normal resolution)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsImport } from 'tsx/esm/api';

const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_CORE ? require(resolve(process.env.PLAYWRIGHT_CORE)) : require('playwright-core');

const BASE = (process.env.BASE ?? 'http://localhost:4399').replace(/\/$/, '');
const OUT = resolve(process.env.PROOF_DIR ?? './proof-out');
const GPU = ['--use-angle=d3d11', '--enable-gpu'];
/** Edge with no WebGL at all, as Lighthouse's headless run or a locked-down machine has it. */
const NO_WEBGL = ['--disable-webgl', '--disable-3d-apis'];
/** Edge drawing WebGL in software only (SwiftShader), as a machine without a usable GPU does. */
const SOFTWARE_GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

const langOf = (path) => (path === '/en/' || path.startsWith('/en/') ? 'en' : 'nl');

// The site's pages come from src/data/pages.ts. A page the build has not produced
// is skipped, and listed when the harness starts. The build is read from disk, so a
// page the build made but the server fails to answer still fails; BASE only changes
// who is asked, not what is expected.
const DIST = resolve(fileURLToPath(new URL('../../dist/client', import.meta.url)));
const { PAGES: SITE_PAGES, pagePaths } = await tsImport('../../src/data/pages.ts', import.meta.url);
const { Translator, locales } = await tsImport('../../src/i18n/Translator.ts', import.meta.url);
const { HANDLES, PAGE_KINDS } = await tsImport('../../src/app/handle.ts', import.meta.url);
const { MIN_FILL_MS, SEND_TIMEOUT_MS } = await tsImport('../../src/ui/contactSubmit.ts', import.meta.url);
const { LOAD_TIMEOUT_MS, RESTORE_TIMEOUT_MS } = await tsImport('../../src/scene/timeouts.ts', import.meta.url);
const { HOME_CHAPTERS, WORLD_LAYOUT, areaStop, areasOnPath, chapterAt, keyStops, pathStart, placeOfFrame, qaStop, scrollEnd, lookStop, stops, worldStop } = await tsImport('../../src/state/chapters.ts', import.meta.url);
const { SETTLE_SLOP_PX } = await tsImport('../../src/input/target.ts', import.meta.url);
const { RING_MARKS } = await tsImport('../../src/data/qa.ts', import.meta.url);
const { QA_LOCK_MS } = await tsImport('../../src/input/scrollLoop.ts', import.meta.url);
const { RING_DRAG_PX } = await tsImport('../../src/input/ringDrag.ts', import.meta.url);
const { GESTURE_GAP_MS } = await tsImport('../../src/input/gesture.ts', import.meta.url);
const { LOADER, LOADER_SEEN_KEY, QUICK, SCRIPT } = await tsImport('../../src/engine/bob/loaderTimeline.ts', import.meta.url);
const { IDLE_SECONDS, BREATHE } = await tsImport('../../src/scene/bob/look.ts', import.meta.url);
const { nextDriftRest } = await tsImport('../../src/engine/bob/needleAim.ts', import.meta.url);
const { scrollPoseAt } = await tsImport('../../src/scene/bob/scrollPose.ts', import.meta.url);
const { FLIGHT_MS } = await tsImport('../../src/scene/bob/focus.ts', import.meta.url);
const { applyCameraShot, topShotFor } = await tsImport('../../src/engine/bob/shots.ts', import.meta.url);
const { PAGE_SPOT } = await tsImport('../../src/scene/bob/spot.ts', import.meta.url);
const { WORDMARK } = await tsImport('../../src/engine/bob/wordmark.ts', import.meta.url);
const { WORLD_PROJECTS, journeyAt, journeyPoseAt } = await tsImport('../../src/scene/bob/journey.ts', import.meta.url);
const { RISE_TOP, LANDING_HOLD, landingHoldFor } = await tsImport('../../src/scene/bob/landingHold.ts', import.meta.url);
const { categories } = await tsImport('../../src/data/categories.ts', import.meta.url);
const { engravedLevels } = await tsImport('../../src/scene/bob/engravedWay.ts', import.meta.url);
const { NEBULA, nebulaLevels } = await tsImport('../../src/scene/bob/nebulaWay.ts', import.meta.url);
const { worldPathFor } = await tsImport('../../src/scene/bob/worldPath.ts', import.meta.url);
const { projects: PROJECTS } = await tsImport('../../src/data/projects.ts', import.meta.url);
/**
 * How long the canvas may keep drawing after the last thing that stirred it, ms: the home's idle motion
 * (src/scene/bob/look.ts, IDLE_SECONDS: 12 s) and the needle's spring settling, with room to spare. Counted from the
 * stir, or from the landing for a home left alone (step sleep counts it from DRIFT_RUN instead).
 */
const SLEEP_WITHIN_MS = 20_000;
const { STORM } = await tsImport('../../src/scene/bob/storm.ts', import.meta.url);
/**
 * The storm behind everything (spec 2026-10-30-bob-storm-design.md) keeps the canvas drawing on the home page while it
 * moves, at STORM.fps when nothing else does: a home left alone draws no more than this many frames a second, where it
 * once drew none (with reduced motion it still draws none).
 */
const STORM_FPS_MAX = STORM.fps + 6;
/**
 * The frames the canvas drew over `ms`, a second: counted by the storm, which is posed on every frame the scene draws
 * (`journey.storm.frames`; window.__allRaf counts R3F's requests, more than one a frame as it starts and stops).
 */
const drawnFrames = (page) => page.evaluate(() => window.__needleDebug?.().journey.storm?.frames ?? null);
async function framesPerSecond(page, ms) {
  const before = await drawnFrames(page);
  await page.waitForTimeout(ms);
  return ((await drawnFrames(page)) - (before ?? 0)) / (ms / 1000);
}
/**
 * When, ms from now, a whole second first went by with no more than STORM_FPS_MAX frames drawn (the canvas drawing
 * the storm alone), looking for `limit` ms; null if none did. Read in 200 ms windows, a second's worth at a time.
 */
async function settlesToStorm(page, limit) {
  const start = Date.now();
  const marks = [];
  while (Date.now() - start < limit) {
    const n = await drawnFrames(page);
    // Not before the storm is in: until then nothing counts the frames.
    if (n === null) marks.length = 0;
    else marks.push({ t: Date.now(), n });
    const from = marks.find((m) => marks.at(-1).t - m.t <= 1_000);
    if (marks.length > 1 && marks.at(-1).t - marks[0].t >= 1_000 && from && marks.at(-1).t - from.t >= 800) {
      const rate = (marks.at(-1).n - from.n) / ((marks.at(-1).t - from.t) / 1000);
      if (rate <= STORM_FPS_MAX) return from.t - start;
    }
    await page.waitForTimeout(200);
  }
  return null;
}
/**
 * How long a home left alone, with no pointer ever moved, keeps its idle motion going, s: the needle drifts on its own,
 * and once the idle while is over it runs on to the drift's next rest (src/engine/bob/needleAim.ts, nextDriftRest), so
 * it falls asleep at rest. 14 s with today's numbers.
 */
const DRIFT_RUN = nextDriftRest(IDLE_SECONDS);
/** The milestone's stills: PROOF_DIR/m2/. */
const STILLS = join(OUT, 'm2');
/** The two sizes of the stills: a laptop, and a phone (touch, coarse pointer, two device pixels). */
const STILL_SIZES = [
  { width: 1440, height: 900, options: {} },
  { width: 390, height: 844, options: { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
];
const sizeName = ({ width, height }) => `${width}x${height}`;
const built = (path) => existsSync(join(DIST, path, 'index.html'));
/**
 * The scene of every page path: its route's `handle.scene`, from the site's one table (src/app/handle.ts). Null for a
 * page of text alone (Lite, contact), which loads no WebGL; an unknown URL (the not-found page) has none either.
 */
const SCENE_OF = new Map(
  locales.flatMap((locale) => Object.keys(SITE_PAGES).map((page) => [Translator.pathFor(locale, SITE_PAGES[page]), HANDLES[PAGE_KINDS[page]].scene])),
);
const hasScene = (path) => (SCENE_OF.get(path) ?? null) !== null;
const SKIPPED = pagePaths().filter((path) => !built(path));
const PAGES = pagePaths()
  .filter(built)
  .map((path) => ({ path, lang: langOf(path), scene: hasScene(path) }));
/** The h1 of the home page (visually hidden: the engraving is the name), and of the project page used to move between pages and languages. */
const HOME_H1 = 'BOB CHUNG';
const FUNCIAL_H1 = 'Steady';
/** The h1 of the not-found route (src/app/routes/not-found.tsx, in each language), as opposed to the root's HydrateFallback. */
const NOT_FOUND_H1 = { nl: 'Pagina niet gevonden', en: 'Page not found' };
/** Two URLs no page answers, one per language. */
const UNKNOWN = ['/does-not-exist/', '/en/does-not-exist/'];
/**
 * Real pages under another spelling. GitHub Pages is case-sensitive, so each is a 404 served the
 * fallback, but the router used to match them case-insensitively and a route module threw on them.
 */
const CASE_VARIANTS = ['/Projects/Steady/', '/en/projects/FUNCIAL/', '/Projects/Jontai-Energy/', '/en/Projects/cookies-clicker/'];
/** The links the home page lists: the four projects (the way to About is the header's). */
/** The home nav's projects, in the stack's order (src/data/projects.ts). */
const HOME_LINKS = ['/projects/steady/', '/projects/portle/', '/projects/jontai-energy/', '/projects/cookies-clicker/'];

// ---------------------------------------------------------------- the step runner

class Step {
  constructor(id) {
    this.id = id;
    this.checks = [];
    this.errors = [];
    this.expected = [];
    this.csp = [];
  }
  check(ok, message) {
    this.checks.push({ ok: !!ok, message });
    return !!ok;
  }
  get pass() {
    return this.checks.length > 0 && this.checks.every((c) => c.ok);
  }
}

/**
 * A fresh context and page that record console errors, page errors and CSP violations into the step.
 * `expected(message)` names a console error that is the designed outcome of the step, not a failure;
 * it is kept apart in step.expected, and the step must check that it happened as often as it should.
 */
async function openPage(browser, step, expected = () => false, viewport = { width: 1440, height: 900 }, contextOptions = {}) {
  const context = await browser.newContext({ viewport, ...contextOptions });
  await context.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__cspViolations.push({ directive: e.violatedDirective, blocked: e.blockedURI, sample: e.sample });
    });
  });
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    (expected(message) ? step.expected : step.errors).push(message.text());
  });
  page.on('pageerror', (error) => step.errors.push(error.message));
  return { context, page };
}

/** Moves the page's CSP violations into the step; call it before a document load replaces the window. */
async function takeCsp(page, step) {
  step.csp.push(...(await page.evaluate(() => window.__cspViolations.splice(0))));
}

/** Waits until the lazy Stage has mounted its <canvas>, then a moment for late errors. */
async function stageReady(page) {
  await page.waitForFunction(() => document.querySelector('.scene-host canvas'), null, { timeout: 15_000 });
  await page.waitForTimeout(500);
}

/**
 * Waits until the page at `path` has settled: on a page with a scene, until its Stage has mounted (stageReady); on a
 * page without one (Lite, contact, not found), which never mounts a Stage on a direct load, until it has hydrated
 * (`data-route` is set after hydration), then a moment for late errors.
 */
async function pageReady(page, path) {
  if (hasScene(path)) return stageReady(page);
  await page.waitForFunction(() => document.documentElement.hasAttribute('data-route'), null, { timeout: 15_000 });
  await page.waitForTimeout(500);
}

/** The files only the scene loads: the Stage chunk, three.js (its own chunk), maath (the scroll's easing) and the textures. */
const SCENE_FILE = /\/assets\/(?:Stage|three|maath[^/]*)-[^/]+\.js$|\/textures\//;

/** Records the URLs of the scene's files (SCENE_FILE) the page asks for, from now on; answers the list, which grows. */
const sceneRequests = (page) => {
  const asked = [];
  page.on('request', (request) => {
    if (SCENE_FILE.test(new URL(request.url()).pathname)) asked.push(new URL(request.url()).pathname);
  });
  return asked;
};

/**
 * The debug state of the page (window.__needleDebug(), present only when the page's first URL has `?proof`) as plain
 * data, or null where there is no bridge. The bridge's state is the site's one proof hook: see src/debug/needleDebug.ts.
 */
const debugOf = (page) => page.evaluate(() => (typeof window.__needleDebug === 'function' ? JSON.parse(JSON.stringify(window.__needleDebug())) : null));

/** The Stage chunk the site loads after hydration (a route on it holds, patches or refuses the scene). */
const STAGE_CHUNK = /\/assets\/Stage-[^/]+\.js$/;

const count = (text, pattern) => (text.match(pattern) ?? []).length;

// ---------------------------------------------------------------- the steps

async function routes(browser, step) {
  const { context, page } = await openPage(browser, step);
  for (const { path, lang, scene } of PAGES) {
    const response = await page.goto(BASE + path, { waitUntil: 'load' });
    step.check(response?.status() === 200, `${path} answers 200 (got ${response?.status()})`);
    const html = (await response?.text()) ?? '';
    const prerendered = count(html, /<h1[\s>]/g);
    step.check(prerendered === 1, `${path} has one <h1> in its HTML (got ${prerendered})`);
    await pageReady(page, path);
    const hydrated = await page.locator('h1').count();
    step.check(hydrated === 1, `${path} has one <h1> after hydration (got ${hydrated})`);
    const htmlLang = await page.getAttribute('html', 'lang');
    step.check(htmlLang === lang, `${path} has <html lang="${lang}"> (got ${htmlLang})`);
    if (!scene) {
      const canvases = await page.locator('canvas').count();
      step.check(canvases === 0, `${path} shows no scene: no <canvas> (got ${canvases})`);
    }
    await takeCsp(page, step);
  }
  await context.close();
  return `${PAGES.length} pages: 200, one <h1>, <html lang>; no canvas on ${PAGES.filter((p) => !p.scene).length} pages of text alone`;
}

async function slash(browser, step) {
  const bare = await fetch(`${BASE}/projects/steady`, { redirect: 'manual' });
  const location = bare.headers.get('location');
  const target = location ? new URL(location, BASE).href : null;
  step.check(bare.status === 301 && target === `${BASE}/projects/steady/`, `GET /projects/steady answers 301 to /projects/steady/ (got ${bare.status} ${location})`);

  const { context, page } = await openPage(browser, step);
  const documents = [];
  let loads = 0;
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url());
  });
  page.on('load', () => loads++);

  // `?proof` rides along: the server keeps the query through its 301, and the page can then answer for its Stage's mounts.
  await page.goto(`${BASE}/projects/steady?proof`, { waitUntil: 'load' });
  await stageReady(page);
  await page.waitForTimeout(1_500); // a reload loop would show by now
  const landed = documents.filter((url) => url === `${BASE}/projects/steady/?proof`).length;
  const { type, mounts } = await page.evaluate(() => ({
    type: performance.getEntriesByType('navigation')[0]?.type,
    mounts: window.__needleDebug?.().canvasMounts,
  }));
  step.check(page.url() === `${BASE}/projects/steady/?proof`, `the browser ends at /projects/steady/ (got ${page.url()})`);
  step.check(landed === 1 && documents.length === 2, `one document load of /projects/steady/, after the 301 (got ${documents.join(' → ')})`);
  step.check(loads === 1 && type === 'navigate', `one load event, not a reload (got ${loads}, ${type})`);
  step.check(mounts === 1, `the Stage mounted once (got ${mounts})`);
  await takeCsp(page, step);
  await context.close();
  return `/projects/steady → 301 /projects/steady/, loaded once (${documents.join(' → ')})`;
}

/** The scene's phase as `{ kind, dir }`, once it is `kind` (window.__needleDebug().phase: `?proof` in the page's first URL). */
const waitForPhase = async (page, kind) => {
  await page.waitForFunction((kind) => window.__needleDebug?.().phase.kind === kind, kind, { timeout: 5_000 });
  return page.evaluate(() => {
    const { kind, id, category } = window.__needleDebug().phase;
    return { kind, id, category };
  });
};

/**
 * The scene's phase once the story rests at the stop of project category `category` (`PROJECTS`, progress and target
 * on the stop), as `{ kind, category, progress, target }`: where Back or Escape from a project page lands (Task 12,
 * src/state/routeSync.ts). It waits up to `timeout` ms, as the story may first wait in the dive's hold for the void.
 */
const waitForStop = async (page, category, timeout = 15_000) => {
  await page
    .waitForFunction(
      (category) => {
        const s = window.__needleDebug?.();
        // The area's stop, inside its AREA. The hold at the path's start reads PROJECTS too, on the land.
        return s?.phase.kind === 'PROJECTS' && s.phase.category === category && s.progress === s.target && s.chapter.id === 'AREA' && s.chapter.local > 0;
      },
      category,
      { timeout },
    )
    .catch(() => {});
  return page.evaluate(() => {
    const { phase, progress, target } = window.__needleDebug();
    return { kind: phase.kind, category: phase.category, progress, target };
  });
};

/** The scene's phase once it is PROJECT_FOCUS on project `id` (a project page), as `{ kind, id }`. */
const waitForProject = async (page, id) => {
  await page
    .waitForFunction((id) => window.__needleDebug?.().phase.kind === 'PROJECT_FOCUS' && window.__needleDebug().phase.id === id, id, { timeout: 5_000 })
    .catch(() => {});
  return page.evaluate(() => {
    const { kind, id } = window.__needleDebug().phase;
    return { kind, id };
  });
};

/**
 * The void under the glass once it is in `state` (`journey.voidState`: `idle`, `loading`, `ready`, `failed`; the Void,
 * src/scene/bob/Void.tsx, says it), as the state the page then reports. The void loads once the home has landed (about a
 * quarter of a second on this machine) and until it is `ready` the scroll's target is held at LANDING_HOLD, so a step that
 * scrolls past the landing waits for it first. It waits up to `timeout` ms and swallows the timeout: the caller checks what it
 * returns (`expectVoid` does).
 */
const waitForVoid = async (page, state = 'ready', timeout = 15_000) => {
  await page.waitForFunction((state) => window.__needleDebug?.().journey.voidState === state, state, { timeout }).catch(() => {});
  return page.evaluate(() => window.__needleDebug().journey.voidState);
};

/** Waits for the void to be in `state` and says so as a check. */
async function expectVoid(page, step, state, message) {
  const reached = await waitForVoid(page, state);
  step.check(reached === state, `${message} (voidState ${reached})`);
}

/** The states the void's load can be in (`journey.voidState`, src/state/store.ts). */
const VOID_STATES = ['idle', 'loading', 'ready', 'failed'];

/**
 * The bridge's `journey` as a plain object, once it says `stretch`: the scene poses it on each frame it draws, so it follows
 * a `.set` by a frame. It waits up to `timeout` ms and swallows the timeout; the caller checks the stretch it gets.
 */
const journeyAfter = async (page, stretch, timeout = 3_000) => {
  await page.waitForFunction((stretch) => window.__needleDebug?.().journey.stretch === stretch, stretch, { timeout }).catch(() => {});
  return page.evaluate(() => JSON.parse(JSON.stringify(window.__needleDebug().journey)));
};

async function persist(browser, step) {
  const { context, page } = await openPage(browser, step);
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await stageReady(page);
  await page.evaluate(() => {
    document.querySelector('.scene-host canvas').dataset.id = 'needle-canvas';
  });

  const documents = [];
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url());
  });
  const visited = [];
  const expectSame = async (where, lang, h1) => {
    await page.waitForFunction(
      ([lang, h1]) => document.documentElement.lang === lang && document.querySelector('h1')?.textContent === h1,
      [lang, h1],
      { timeout: 5_000 },
    );
    const state = await page.evaluate(() => ({
      path: location.pathname,
      mounts: window.__needleDebug().canvasMounts,
      canvases: document.querySelectorAll('canvas').length,
      tag: document.querySelector('.scene-host canvas')?.dataset.id ?? null,
    }));
    visited.push(state.path);
    step.check(
      state.mounts === 1 && state.canvases === 1 && state.tag === 'needle-canvas',
      `${where}: the Stage mounted once and the same <canvas> (got mounts ${state.mounts}, ${state.canvases} canvas, tag ${state.tag})`,
    );
  };

  await expectSame('/', 'nl', HOME_H1);
  // The home page lists its pages in a nav that is visually hidden while 3D is on, so the way
  // to the project page is the keyboard's: focus its link and press Enter.
  await page.focus('.home-nav a[href="/projects/steady/"]');
  await page.keyboard.press('Enter');
  await page.waitForURL(`${BASE}/projects/steady/`);
  await expectSame('link to /projects/steady/', 'nl', FUNCIAL_H1);
  const phase = await waitForProject(page, 'steady');
  step.check(phase.id === 'steady', `on /projects/steady/ the scene's phase is PROJECT_FOCUS steady (got ${JSON.stringify(phase)})`);
  await page.evaluate(() => {
    window.__keptPhase = window.__needleDebug().phase;
  });
  // The scene keeps its phase, the very same state, while the language or the history changes under it.
  const keptPhase = async (where) => {
    await page.waitForTimeout(250); // a sync that wrongly moved the phase would have by now
    step.check(await page.evaluate(() => window.__needleDebug().phase === window.__keptPhase), `${where}: the scene keeps its phase, with no new transition`);
  };
  await page.click('.header-nav a[href="/en/projects/steady/"]'); // the header's language switch
  await page.waitForURL(`${BASE}/en/projects/steady/`);
  await expectSame('link to /en/projects/steady/', 'en', FUNCIAL_H1);
  await keptPhase('switching to English');
  // The switch replaces the history entry (it is not a step in the story), so Back from the English
  // page is the home page, not the Dutch page; Forward is the English page again.
  await page.evaluate(() => history.back());
  await page.waitForURL((url) => url.pathname === '/'); // the first URL was /?proof
  await expectSame('history.back() past the replaced entry to /', 'nl', HOME_H1);
  // Back from a project page lands at its bead's stop (spec §2.4), here Steady's, 3, once the void is in.
  const afterBack = await waitForStop(page, 'app');
  step.check(
    afterBack.kind === 'PROJECTS' && afterBack.category === 'app' && afterBack.progress === PROJECT_LIST[0].stop,
    `going back to / puts the scene at Steady's stop, PROJECTS app at ${PROJECT_LIST[0].stop} (got ${JSON.stringify(afterBack)})`,
  );
  await page.evaluate(() => history.forward());
  await page.waitForURL(`${BASE}/en/projects/steady/`);
  await expectSame('history.forward() to /en/projects/steady/', 'en', FUNCIAL_H1);
  const afterForward = await waitForProject(page, 'steady');
  step.check(afterForward.id === 'steady', `going forward puts the scene back on PROJECT_FOCUS steady (got ${JSON.stringify(afterForward)})`);

  step.check(documents.length === 0, `client navigation only, no document load (got ${documents.join(', ') || 'none'})`);
  await takeCsp(page, step);
  await context.close();
  return `${visited.join(' → ')}: one mount, one <canvas>`;
}

/** Each URL answers 404 with the fallback, and the not-found page shows once the router has taken over. */
async function expectNotFound(browser, step, urls) {
  // The one console error this check expects: Edge reports a document that answers 404 as
  // "Failed to load resource", for the page being loaded and for nothing else.
  let asking = null;
  const documentNotFound = (message) => /status of 404/.test(message.text()) && message.location().url === BASE + asking + '?proof';
  const { context, page } = await openPage(browser, step, documentNotFound);
  let documents = [];
  let loads = 0;
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url());
  });
  page.on('load', () => loads++);
  const scenery = sceneRequests(page);

  for (const path of urls) {
    documents = [];
    loads = 0;
    scenery.length = 0;
    const lang = langOf(path);
    asking = path;
    const response = await page.goto(`${BASE}${path}?proof`, { waitUntil: 'load' });
    step.check(response?.status() === 404, `${path} answers 404 (got ${response?.status()})`);
    const html = (await response?.text()) ?? '';
    step.check(html.includes('name="robots" content="noindex"'), `${path} is served noindex`);
    step.check(count(html, /<title>[^<]+<\/title>/g) === 1, `${path} has one <title> in its HTML`);
    step.check(!html.includes('__CSP__'), `${path} carries its real policy`);

    await pageReady(page, path);
    await page.waitForTimeout(1_500); // a reload loop would show by now
    const state = await page.evaluate(() => ({
      titles: document.querySelectorAll('title').length,
      h1: [...document.querySelectorAll('h1')].map((h1) => h1.textContent),
      lang: document.documentElement.lang,
      type: performance.getEntriesByType('navigation')[0]?.type,
      mounts: window.__needleDebug?.().canvasMounts,
      canvases: document.querySelectorAll('canvas').length,
      phase: window.__needleDebug?.().phase.kind,
      url: location.pathname,
    }));
    step.check(state.h1.length === 1 && state.h1[0] === NOT_FOUND_H1[lang], `${path} shows the not-found route's <h1> "${NOT_FOUND_H1[lang]}" after hydration (got ${JSON.stringify(state.h1)})`);
    step.check(state.titles <= 1, `${path} has at most one <title> after hydration (got ${state.titles})`);
    step.check(state.lang === lang, `${path} has <html lang="${lang}"> after hydration (got ${state.lang})`);
    step.check(state.url === path, `the browser stays at ${path} (got ${state.url})`);
    step.check(documents.length === 1 && loads === 1 && state.type === 'navigate', `${path} loads one document, no reload (got ${documents.length} requests, ${loads} loads, ${state.type})`);
    // The not-found page has no scene: a visit that begins there loads no WebGL, and still leaves LOADING.
    step.check(state.mounts === 0 && state.canvases === 0, `${path}: no Stage and no <canvas> (got ${state.mounts} mounts, ${state.canvases} canvas)`);
    step.check(scenery.length === 0, `${path}: none of the scene's files asked for (got ${scenery.join(' ') || 'none'})`);
    step.check(state.phase === 'HOME_IDLE', `${path}: the phase leaves LOADING all the same (got ${state.phase})`);
    await takeCsp(page, step);
  }
  step.check(step.expected.length === urls.length, `the browser reported the 404 of each URL once, and only those (got ${step.expected.length} for ${urls.length} URLs)`);
  await context.close();
  return `${urls.join(', ')}: 404, the not-found <h1>, one document load`;
}

const notFound = (browser, step) => expectNotFound(browser, step, UNKNOWN);
const caseVariant = (browser, step) => expectNotFound(browser, step, CASE_VARIANTS);

async function esc(browser, step) {
  const { context, page } = await openPage(browser, step);
  const documents = [];
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url());
  });
  const pathname = () => new URL(page.url()).pathname;
  const pressEscape = async () => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400); // a navigation would have happened by now
  };

  // On a project page the back link says what Escape does, and Escape does it through the router.
  await page.goto(`${BASE}/projects/steady/?proof`, { waitUntil: 'load' });
  await stageReady(page);
  documents.length = 0;
  const onProject = await waitForProject(page, 'steady');
  step.check(onProject.id === 'steady', `a direct load of /projects/steady/ puts the scene on PROJECT_FOCUS steady (got ${JSON.stringify(onProject)})`);
  step.check((await page.getByRole('link', { name: 'terug', exact: true }).count()) === 1, 'the back link is named "terug": the "Esc" hint is not part of its name');
  step.check((await page.getAttribute('a.back', 'aria-keyshortcuts')) === 'Escape', 'the back link names its shortcut, aria-keyshortcuts="Escape"');
  step.check((await page.getAttribute('a.back .back-hint', 'aria-hidden')) === 'true', 'the visible "Esc" hint is aria-hidden');

  // Not while someone is typing...
  await page.evaluate(() => {
    const input = document.createElement('input');
    input.id = 'esc-probe';
    document.body.append(input);
    input.focus();
  });
  await pressEscape();
  step.check(pathname() === '/projects/steady/', `Escape in a text field stays on the page (got ${pathname()})`);
  await page.evaluate(() => document.getElementById('esc-probe')?.remove());

  // ... nor when something else has already handled the key.
  await page.evaluate(() => {
    window.__eatEscape = (event) => event.preventDefault();
    window.addEventListener('keydown', window.__eatEscape, true);
  });
  await pressEscape();
  step.check(pathname() === '/projects/steady/', `Escape that was already handled stays on the page (got ${pathname()})`);
  await page.evaluate(() => window.removeEventListener('keydown', window.__eatEscape, true));

  // A direct load has no page before it in the visit, so Escape goes to the home page.
  await page.keyboard.press('Escape');
  await page.waitForURL(`${BASE}/`, { timeout: 5_000 });
  step.check((await page.textContent('h1')) === HOME_H1, 'a direct load of /projects/steady/ + Escape lands on the home page');
  step.check(documents.length === 0, `by client navigation, no document load (got ${documents.join(', ') || 'none'})`);
  const afterDirect = await waitForStop(page, 'app');
  step.check(
    afterDirect.kind === 'PROJECTS' && afterDirect.category === 'app' && afterDirect.progress === PROJECT_LIST[0].stop,
    `leaving the page for the home page puts the scene at the project's stop, Steady's ${PROJECT_LIST[0].stop} (got ${JSON.stringify(afterDirect)})`,
  );
  await takeCsp(page, step);

  // The header's name is a link to the home, not Back, a deliberate "to the top": it lands at the home, the top of the story, even
  // with the story at the project's stop, as after a flight in from it.
  await page.goto(`${BASE}/projects/steady/?proof`, { waitUntil: 'load' });
  await stageReady(page);
  await waitForProject(page, 'steady');
  await page.evaluate((progress) => window.__needleDebug.set({ progress }), PROJECT_LIST[0].stop);
  documents.length = 0;
  await page.click('.site-name');
  await page.waitForURL(`${BASE}/`, { timeout: 5_000 });
  await waitForPhase(page, 'HOME_IDLE').catch(() => {});
  const named = await debugOf(page);
  step.check(
    named.phase.kind === 'HOME_IDLE' && named.progress === 0 && named.target === 0,
    `the header's name on a project page lands at the home, 0, not at the project's stop (got ${JSON.stringify([named.phase, named.progress, named.target])})`,
  );
  step.check(documents.length === 0, `by client navigation, no document load (got ${documents.join(', ') || 'none'})`);
  await takeCsp(page, step);

  // A page reached from the home page has one before it: Escape steps back, it does not push the home page.
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await stageReady(page);
  documents.length = 0;
  await page.focus('.home-nav a[href="/projects/steady/"]'); // the home page's links are hidden while 3D is on, but take focus
  await page.keyboard.press('Enter');
  await page.waitForURL(`${BASE}/projects/steady/`, { timeout: 5_000 });
  await waitForProject(page, 'steady');
  await pressEscape();
  step.check(pathname() === '/', `a project page reached from the home page + Escape steps back to the home page (got ${pathname()})`);
  step.check(documents.length === 0, `by client navigation, no document load (got ${documents.join(', ') || 'none'})`);
  const steppedBack = await waitForStop(page, 'app');
  step.check(
    steppedBack.kind === 'PROJECTS' && steppedBack.category === 'app' && steppedBack.progress === PROJECT_LIST[0].stop,
    `Escape back to the home page from a page reached from it puts the scene at the project's stop, Steady's ${PROJECT_LIST[0].stop} (got ${JSON.stringify(steppedBack)})`,
  );
  await page.evaluate(() => history.forward());
  const forwarded = await page.waitForURL(`${BASE}/projects/steady/`, { timeout: 5_000 }).then(() => true, () => false);
  step.check(forwarded, 'the page forward is still in the history, so Escape went back and did not add the home page');
  if (forwarded) {
    const forward = await waitForProject(page, 'steady');
    step.check(forward.id === 'steady', `going forward again puts the scene back on PROJECT_FOCUS steady (got ${JSON.stringify(forward)})`);
  }
  await takeCsp(page, step);

  // A replace navigation keeps a page the visit began on "the first page of the visit". The language switch
  // is one (it is not a step in the story), so Escape after it goes home in the current language and does
  // not undo the switch.
  await page.goto(`${BASE}/projects/steady/?proof`, { waitUntil: 'load' });
  await stageReady(page);
  documents.length = 0;
  await waitForProject(page, 'steady');
  await page.click('a[href="/en/projects/steady/"]');
  await page.waitForFunction(() => location.pathname === '/en/projects/steady/' && document.documentElement.lang === 'en', null, { timeout: 5_000 });
  await pressEscape();
  step.check(pathname() === '/en/', `a direct load + the language switch + Escape lands on /en/, not back on the Dutch page (got ${pathname()})`);
  step.check(documents.length === 0, `by client navigation, no document load (got ${documents.join(', ') || 'none'})`);
  await takeCsp(page, step);

  // The contact form is the other one: a visitor who posted without script comes back to /contact/?sent=1,
  // and the page replaces that with /contact/.
  await page.goto(`${BASE}/contact/?sent=1&proof`, { waitUntil: 'load' });
  await pageReady(page, '/contact/');
  await page.waitForFunction(() => location.pathname === '/contact/' && location.search === '', null, { timeout: 5_000 });
  documents.length = 0;
  await pressEscape();
  step.check(pathname() === '/', `a direct load of /contact/?sent=1, replaced by /contact/, + Escape lands on the home page (got ${pathname()})`);
  step.check(documents.length === 0, `by client navigation, no document load (got ${documents.join(', ') || 'none'})`);
  await takeCsp(page, step);

  // The link is Escape for the mouse: it goes where Escape goes. A click that opens it elsewhere (ctrl, meta,
  // shift) is the browser's: the page must not prevent its default. A listener on window sees every click after
  // the page's own handlers; it records whether the click was already handled and then cancels it, so no tab opens.
  const watchClicks = () =>
    page.evaluate(() => {
      window.__clicks = [];
      window.addEventListener('click', (event) => {
        window.__clicks.push(event.defaultPrevented);
        event.preventDefault();
      });
    });
  await page.goto(`${BASE}/projects/steady/?proof`, { waitUntil: 'load' });
  await stageReady(page);
  await watchClicks();
  for (const modifier of ['Control', 'Meta', 'Shift']) await page.click('a.back', { modifiers: [modifier] });
  step.check(
    JSON.stringify(await page.evaluate(() => window.__clicks)) === JSON.stringify([false, false, false]),
    'a ctrl-, meta- or shift-click on the back link is not prevented: the page does not intercept it',
  );
  step.check(pathname() === '/projects/steady/', `and the click does not navigate in the page (got ${pathname()})`);
  documents.length = 0;
  await page.evaluate(() => (window.__clicks.length = 0));
  await page.click('a.back');
  await page.waitForURL(`${BASE}/`, { timeout: 5_000 });
  step.check((await page.evaluate(() => window.__clicks)).join() === 'true', 'a plain click on the back link is handled by the page (default prevented)');
  step.check((await page.textContent('h1')) === HOME_H1, 'a direct load of /projects/steady/ + a click on the back link lands on the home page');
  step.check(documents.length === 0, `by client navigation, no document load (got ${documents.join(', ') || 'none'})`);
  await takeCsp(page, step);

  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await stageReady(page);
  documents.length = 0;
  await page.focus('.home-nav a[href="/projects/steady/"]');
  await page.keyboard.press('Enter');
  await page.waitForURL(`${BASE}/projects/steady/`, { timeout: 5_000 });
  await page.click('a.back');
  await page.waitForURL((url) => url.pathname === '/', { timeout: 5_000 }); // back to /?proof
  step.check(documents.length === 0, `by client navigation, no document load (got ${documents.join(', ') || 'none'})`);
  await page.evaluate(() => history.forward());
  step.check(
    await page.waitForURL(`${BASE}/projects/steady/`, { timeout: 5_000 }).then(() => true, () => false),
    'a click on the back link of a page reached from the home page steps back, like Escape (the page forward is still there)',
  );
  await takeCsp(page, step);

  // The English pages go to the English home page.
  await page.goto(`${BASE}/en/projects/steady/`, { waitUntil: 'load' });
  await stageReady(page);
  step.check((await page.getByRole('link', { name: 'back', exact: true }).count()) === 1, 'the English back link is named "back"');
  await page.keyboard.press('Escape');
  await page.waitForURL(`${BASE}/en/`, { timeout: 5_000 });
  step.check((await page.textContent('h1')) === HOME_H1 && (await page.getAttribute('html', 'lang')) === 'en', 'Escape on /en/projects/steady/ lands on /en/');
  await takeCsp(page, step);
  await context.close();

  // A touch screen has no Escape key: the hint is hidden there, the link stays.
  const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const phone = await touch.newPage();
  phone.on('console', (message) => message.type() === 'error' && step.errors.push(message.text()));
  phone.on('pageerror', (error) => step.errors.push(error.message));
  await phone.goto(`${BASE}/projects/steady/`, { waitUntil: 'load' });
  await stageReady(phone);
  const hint = await phone.evaluate(() => getComputedStyle(document.querySelector('.back-hint')).display);
  step.check(hint === 'none', `on a coarse pointer the Esc hint is hidden (display ${hint})`);
  step.check((await phone.locator('a.back').isVisible()) === true, 'the back link itself stays visible on a phone');
  await touch.close();
  return 'Escape and a click go home (/ and /en/) or back by client navigation, also after a replace; not in a field, not once handled; a modified click is left alone; the hint is hidden on touch';
}

/** Where the page is: its scroll, whether its <h1> is in view, and where the focus is (in <main>, or on <main> itself). */
const placeOf = (page) =>
  page.evaluate(() => {
    const main = document.querySelector('main');
    const h1 = document.querySelector('h1');
    const box = h1?.getBoundingClientRect();
    return {
      path: location.pathname,
      y: Math.round(window.scrollY),
      h1InView: !!box && box.top >= 0 && box.bottom <= window.innerHeight,
      inMain: !!main && main.contains(document.activeElement),
      focus: document.activeElement === main ? 'main' : (document.activeElement?.tagName ?? null),
    };
  });

/**
 * A client navigation and the visitor's place. A link (a push) opens the new page at its top with the focus moved into
 * <main>: on /lite/ scrolled down to the projects, a click on one shows the project's <h1>, at scrollY 0, and Tab goes on
 * inside the new page. Back (a pop) is the browser's and returns near the place left; the language switch (a replace)
 * keeps the place; a push to a place in a page (/en/lite/#career, through the router) scrolls to it.
 */
async function navFocus(browser, step) {
  const { context, page } = await openPage(browser, step);
  const documents = [];
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url());
  });
  const project = '#work a[href="/projects/jontai-energy/"]';
  await page.goto(`${BASE}/lite/?proof`, { waitUntil: 'load' });
  await pageReady(page, '/lite/');
  await page.evaluate((selector) => document.querySelector(selector).scrollIntoView({ block: 'center' }), project);
  await page.waitForTimeout(200);
  const left = await placeOf(page);
  step.check(left.y > 300, `on /lite/ the visitor has scrolled down to the projects (scrollY ${left.y})`);

  // A link: the project page from its top, the focus in it.
  documents.length = 0;
  await page.click(project);
  await page.waitForFunction(() => location.pathname === '/projects/jontai-energy/' && document.documentElement.dataset.route === 'project', null, { timeout: 5_000 });
  await page.waitForTimeout(150);
  const opened = await placeOf(page);
  step.check(opened.y === 0 && opened.h1InView, `a click on a project opens its page at the top, its <h1> in view (got scrollY ${opened.y}, h1 in view ${opened.h1InView})`);
  step.check(opened.inMain && opened.focus === 'main', `and the focus is moved to <main>, not left on <body> (got ${opened.focus})`);
  await page.keyboard.press('Tab');
  const tabbed = await placeOf(page);
  step.check(tabbed.inMain, `Tab from there goes on inside the new page (got ${tabbed.focus}, in <main> ${tabbed.inMain})`);
  step.check(documents.length === 0, `by client navigation, no document load (got ${documents.join(', ') || 'none'})`);

  // Back: the browser puts the visitor where they were.
  await page.evaluate(() => history.back());
  await page.waitForFunction(() => location.pathname === '/lite/' && document.documentElement.dataset.route === 'lite', null, { timeout: 5_000 });
  await page.waitForTimeout(500);
  const back = await placeOf(page);
  step.check(Math.abs(back.y - left.y) <= 50, `Back returns near the place left (scrollY ${back.y}, left at ${left.y})`);

  // The language switch replaces the page with itself in the other language: the place stays, the project the visitor
  // was at still in view where it was (the English copy above it is a little shorter, and the browser's scroll anchoring
  // keeps what is on screen in place). Clicked in the page, as Playwright's own click would first scroll the header
  // (which scrolls with the page) back into view.
  const topOf = (href) => page.evaluate((href) => Math.round(document.querySelector(`#work a[href="${href}"]`).getBoundingClientRect().top), href);
  const wasAt = await topOf('/projects/jontai-energy/');
  await page.evaluate(() => document.querySelector('.header-nav a[hreflang="en"]').click());
  await page.waitForFunction(() => location.pathname === '/en/lite/' && document.documentElement.lang === 'en', null, { timeout: 5_000 });
  await page.waitForTimeout(200);
  const switched = await placeOf(page);
  const nowAt = await topOf('/en/projects/jontai-energy/');
  step.check(
    switched.y > 300 && Math.abs(nowAt - wasAt) <= 40,
    `the language switch keeps the place: not reset to the top (scrollY ${switched.y}, was ${back.y}), the project still where it was on screen (top ${nowAt} px, was ${wasAt} px)`,
  );

  // A push to a place in a page goes to that place, not to the top.
  await page.click('#work a[href="/en/projects/steady/"]');
  await page.waitForFunction(() => location.pathname === '/en/projects/steady/', null, { timeout: 5_000 });
  const routed = await page.evaluate(() => typeof window.__reactRouterDataRouter?.navigate === 'function');
  step.check(routed, "the router is there to push a place in a page (React Router's window.__reactRouterDataRouter)");
  if (routed) {
    await page.evaluate(() => window.__reactRouterDataRouter.navigate('/en/lite/#career'));
    await page.waitForFunction(() => location.pathname === '/en/lite/' && location.hash === '#career', null, { timeout: 5_000 });
    await page.waitForTimeout(200);
    const career = await page.evaluate(() => ({ top: Math.round(document.querySelector('#career').getBoundingClientRect().top), y: Math.round(window.scrollY) }));
    step.check(career.y > 0 && career.top > -5 && career.top < 450, `a push to /en/lite/#career scrolls #career into view (top ${career.top} px, scrollY ${career.y})`);
  }
  step.check(documents.length === 0, `all of it by client navigation, no document load (got ${documents.join(', ') || 'none'})`);
  await takeCsp(page, step);
  await context.close();
  return `a link opens the page at its top with the focus in <main> (from scrollY ${left.y}); Back returns to ${back.y}; the language switch keeps it; a push to #career scrolls there`;
}

/** The size of the first element matching `selector`, in CSS pixels; null if there is none. */
const boxOf = (page, selector) =>
  page.evaluate((selector) => {
    const element = document.querySelector(selector);
    if (!element) return null;
    const { width, height } = element.getBoundingClientRect();
    return { width, height };
  }, selector);
const visuallyHidden = (box) => box !== null && box.width <= 1 && box.height <= 1;

async function homeNav(browser, step) {
  const { context, page } = await openPage(browser, step);
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await stageReady(page);

  // 3D on (the default): the four links are in the HTML and reachable by keyboard, but not shown.
  const hrefs = await page.$$eval('.home-nav a', (links) => links.map((link) => link.getAttribute('href')));
  step.check(JSON.stringify(hrefs) === JSON.stringify(HOME_LINKS), `the home nav links the four projects (got ${hrefs.join(' ')})`);
  step.check((await page.getAttribute('html', 'data-3d')) === 'on', 'the page says data-3d="on" after hydration');
  step.check(visuallyHidden(await boxOf(page, '.home-nav')), 'with 3D on, the home nav is visually hidden');
  await page.focus('.home-nav a');
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('href'));
  step.check(focused === HOME_LINKS[0], `a hidden link can take focus (got ${focused})`);
  const shown = await boxOf(page, '.home-nav');
  step.check(shown !== null && shown.height > 100, `the nav is shown while a link has focus (got ${JSON.stringify(shown)})`);
  await page.evaluate(() => document.activeElement?.blur());

  // The header's 3D switch and its link to the light version went (Bob, 2026-10-29; spec
  // 2026-10-29-bob-stack-3-design.md, goal 2): neither is anywhere in the header.
  const { t } = new Translator('nl');
  const header = await page.evaluate(
    (lite) => ({
      switches: document.querySelectorAll('.site-header [role="switch"]').length,
      lite: [...document.querySelectorAll('.site-header a')].filter((a) => a.textContent.trim() === lite || a.getAttribute('href') === '/lite/').length,
    }),
    t.needle.liteLink,
  );
  step.check(header.switches === 0 && header.lite === 0, `the header has no 3D switch and no link to the light version (got ${JSON.stringify(header)})`);
  await takeCsp(page, step);

  // A choice the switch stored before it went is not read: 3D is on, the Stage mounts.
  await page.evaluate(() => localStorage.setItem('needle-3d', 'off'));
  await page.reload({ waitUntil: 'load' });
  await stageReady(page).catch(() => {});
  const stored = await page.evaluate(() => ({
    threeD: document.documentElement.dataset['3d'],
    mounts: window.__needleDebug?.().canvasMounts ?? 0,
    canvases: document.querySelectorAll('canvas').length,
  }));
  step.check(stored.threeD === 'on' && stored.mounts === 1 && stored.canvases === 1, `with needle-3d = off stored from before, 3D is on and the Stage mounts (got ${JSON.stringify(stored)})`);
  step.check(visuallyHidden(await boxOf(page, '.home-nav')), 'and the home nav is hidden, as with 3D on');
  await takeCsp(page, step);
  await context.close();
  return 'four links, hidden but focusable with 3D on; no 3D switch and no link to the light version; a stored "off" from before not read';
}

async function mobile(browser, step) {
  const { context, page } = await openPage(browser, step, () => false, { width: 390, height: 844 });
  for (const { path } of PAGES) {
    await page.goto(BASE + path, { waitUntil: 'load' });
    await pageReady(page, path);
    // The page clips sideways overflow (body { overflow-x: clip }), so scrollWidth alone proves nothing:
    // look for content that reaches past the right edge as well. Content inside a box of its own that clips or scrolls
    // sideways (a project page's row of phones, swiped) and itself ends inside the screen does not.
    const { scroll, client, wide } = await page.evaluate(() => {
      const client = document.documentElement.clientWidth;
      const contained = (element) => {
        for (let up = element.parentElement; up && up !== document.body; up = up.parentElement) {
          if (['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(up).overflowX) && up.getBoundingClientRect().right <= client + 0.5) return true;
        }
        return false;
      };
      const wide = [...document.querySelectorAll('header *, main *')]
        .filter((element) => {
          const { width, right } = element.getBoundingClientRect();
          return width > 1 && right > client + 0.5 && !contained(element);
        })
        .map((element) => `${element.tagName.toLowerCase()}.${element.className}`);
      return { scroll: document.documentElement.scrollWidth, client, wide };
    });
    step.check(scroll <= client && wide.length === 0, `${path} has no horizontal overflow at 390 px (scrollWidth ${scroll}, clientWidth ${client}, past the edge: ${wide.join(' ') || 'none'})`);
    await takeCsp(page, step);
  }
  await context.close();
  return `${PAGES.length} pages at 390 px: no horizontal scroll`;
}

/** What the phone menu looks like now: the header's height, the toggle's text, the nav's state and box, its links' boxes. */
const menuState = (page) =>
  page.evaluate(() => {
    const nav = document.querySelector('#site-menu');
    const toggle = document.querySelector('.menu-toggle');
    const box = (element) => {
      const { top, bottom, left, right, height } = element.getBoundingClientRect();
      return { top, bottom, left, right, height };
    };
    return {
      header: box(document.querySelector('.site-header')),
      toggleShown: getComputedStyle(toggle).display !== 'none',
      toggleText: toggle.innerText.trim().toLowerCase(),
      open: nav.matches(':popover-open'),
      navShown: getComputedStyle(nav).display !== 'none',
      nav: box(nav),
      links: [...nav.querySelectorAll('.menu-links a')].map((a) => ({ text: a.innerText.trim().toLowerCase(), ...box(a) })),
      controls: [...nav.querySelectorAll('.header-control')].map((c) => ({ shown: c.getClientRects().length > 0, ...box(c) })),
      viewport: innerHeight,
      path: location.pathname,
      hash: location.hash,
    };
  });

/**
 * The phone header (option A of Bob's mock-up, 2026-10-22): on a touch phone (390x844) the header is one row, the
 * name and Menu, the nav hidden; a tap on Menu opens it as a dark sheet from under the header to the bottom of the
 * screen with Work, About and Contact at least 44 px high, and the button says close; the language switch is its one
 * other control (no 3D switch, no link to the light version: 2026-10-29); a link follows and closes it; on a project
 * page Escape closes the open menu and stays on the page (the next Escape goes back); it opens with script off too (the browser's own popover); and on a laptop there is no Menu button, the nav
 * is its row.
 */
async function phoneMenu(browser, step) {
  const { t } = new Translator('nl');
  const phone = { width: 390, height: 844 };
  const { context, page } = await openPage(browser, step, () => false, phone, { hasTouch: true, isMobile: true });

  await page.goto(`${BASE}/lite/`, { waitUntil: 'load' });
  await pageReady(page, '/lite/');
  let s = await menuState(page);
  step.check(s.header.height <= 72, `the phone header is one row (${s.header.height} px high, at most 72)`);
  step.check(s.toggleShown && s.toggleText.startsWith(t.nav.menu.toLowerCase()), `the Menu button shows ("${s.toggleText}")`);
  step.check(!s.open && !s.navShown && s.controls.every((c) => !c.shown), 'closed, the nav and its links are hidden');

  await page.locator('.menu-toggle').tap();
  await page.waitForTimeout(150);
  s = await menuState(page);
  step.check(s.open && s.navShown, 'a tap on Menu opens the nav (:popover-open)');
  step.check(Math.abs(s.nav.top - s.header.bottom) <= 8 && Math.abs(s.nav.bottom - s.viewport) <= 1, `the sheet runs from under the header (${s.nav.top} against ${s.header.bottom}) to the bottom (${s.nav.bottom} of ${s.viewport})`);
  const expected = [t.nav.contact].map((text) => text.toLowerCase());
  step.check(JSON.stringify(s.links.map((l) => l.text)) === JSON.stringify(expected), `its links are ${expected.join(', ')} (got ${s.links.map((l) => l.text).join(', ')})`);
  step.check(s.links.every((l) => l.height >= 44 && l.left >= 0 && l.right <= phone.width), `each link is at least 44 px high, inside the screen (${s.links.map((l) => Math.round(l.height)).join(', ')} px)`);
  step.check(s.controls.every((c) => c.shown && c.bottom <= s.viewport), 'every control of the nav shows inside the sheet');
  step.check(s.toggleText === t.nav.close.toLowerCase(), `open, the button says "${t.nav.close}" (got "${s.toggleText}")`);

  // Its one control besides the links is the language switch: no 3D switch, no link to the light version (2026-10-29).
  const extras = await page.$$eval('#site-menu .menu-extras > *', (els) => els.map((el) => ({ role: el.getAttribute('role'), hreflang: el.getAttribute('hreflang') })));
  step.check(extras.length === 1 && extras[0].hreflang === 'en' && extras[0].role === null, `the sheet's one control besides the links is the language switch (got ${JSON.stringify(extras)})`);

  // Its one link is Contact (Work and About went, Bob 2026-10-30).
  await page.locator('#site-menu .menu-links a').first().tap();
  await page.waitForFunction(() => location.pathname === '/contact/', null, { timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(300);
  s = await menuState(page);
  step.check(s.path === '/contact/' && !s.open, `Contact follows to /contact/ and closes the menu (at ${s.path}${s.hash}, open ${s.open})`);
  await takeCsp(page, step);

  // A project page: Escape is the open menu's first, then the page's way back.
  await page.goto(`${BASE}/projects/steady/`, { waitUntil: 'load' });
  await pageReady(page, '/projects/steady/');
  await page.locator('.menu-toggle').tap();
  await page.waitForTimeout(150);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  s = await menuState(page);
  step.check(!s.open && s.path === '/projects/steady/', `on a project page Escape closes the menu and stays (at ${s.path}, open ${s.open})`);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => location.pathname !== '/projects/steady/', null, { timeout: 5_000 }).catch(() => {});
  s = await menuState(page);
  step.check(s.path === '/', `the next Escape goes back, home (at ${s.path})`);
  await takeCsp(page, step);
  await context.close();

  // Without script: the browser's popover alone.
  const bare = await browser.newContext({ viewport: phone, hasTouch: true, isMobile: true, javaScriptEnabled: false });
  const still = await bare.newPage();
  await still.goto(`${BASE}/lite/`, { waitUntil: 'load' });
  await still.locator('.menu-toggle').tap();
  await still.waitForTimeout(150);
  const noScript = await still.evaluate(() => document.querySelector('#site-menu').matches(':popover-open'));
  step.check(noScript, 'with script off, Menu still opens the nav');
  await bare.close();

  // A laptop: no Menu button, the nav is its row.
  const laptop = await openPage(browser, step, () => false);
  await laptop.page.goto(`${BASE}/lite/`, { waitUntil: 'load' });
  await pageReady(laptop.page, '/lite/');
  s = await menuState(laptop.page);
  const tops = s.controls.map((c) => Math.round(c.top));
  step.check(!s.toggleShown && s.navShown && !s.open && s.controls.every((c) => c.shown), 'at 1440 px there is no Menu button and the nav shows, not as a popover');
  step.check(Math.max(...tops) - Math.min(...tops) <= 4 && s.header.height <= 72, `the laptop nav is one row (tops ${tops.join(', ')}, header ${s.header.height} px)`);
  await takeCsp(laptop.page, step);
  await laptop.context.close();
  return 'one row on a phone; Menu opens the sheet (links 44 px+, says close, the language switch its one other control), a link closes it, Escape closes it before going back, works without script; a laptop keeps its row';
}

/** The copy of a heading as text: the dictionaries' only markup is <em>. */
const plain = (copy) => copy.replace(/<[^>]*>/g, '');
const LITE = { nl: '/lite/', en: '/en/lite/' };
const CONTACT = { nl: '/contact/', en: '/en/contact/' };

/** Lite: all the copy, in order, as plain HTML that needs no script and no 3D. */
async function liteOne(browser, step, lang) {
  const { t } = new Translator(lang);
  const path = LITE[lang];
  const { context, page } = await openPage(browser, step);
  await page.goto(BASE + path, { waitUntil: 'load' });
  await pageReady(page, path);

  // The sections, by their headings (the dictionary's own words), in the order of the page.
  const headings = [t.work.title, t.about.title, t.skills.title, t.career.title, t.life.title, t.compass.qa.title, t.cta.title].map(plain);
  const h1 = await page.$$eval('h1', (els) => els.map((el) => el.textContent));
  step.check(h1.length === 1 && h1[0] === t.needle.liteLink, `${path} has one <h1> "${t.needle.liteLink}" (got ${JSON.stringify(h1)})`);
  const h2 = await page.$$eval('main h2', (els) => els.map((el) => el.textContent));
  step.check(JSON.stringify(h2) === JSON.stringify(headings), `${path} has the section headings in order (got ${JSON.stringify(h2)})`);
  const levels = await page.$$eval('main h1, main h2, main h3, main h4, main h5, main h6', (els) => els.map((el) => Number(el.tagName[1])));
  const skipped = levels.filter((level, index) => index > 0 && level - levels[index - 1] > 1);
  step.check(levels[0] === 1 && skipped.length === 0, `${path} skips no heading level (levels ${levels.join('')})`);

  // The real portrait, loaded, with its alt text and the size it reserves.
  await page.locator('figure.portrait img').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const image = document.querySelector('figure.portrait img');
    return Boolean(image && image.complete && image.naturalWidth > 0);
  }, null, { timeout: 10_000 }).catch(() => {});
  const portrait = await page.$eval('figure.portrait img', (image) => ({
    natural: image.naturalWidth,
    alt: image.alt,
    width: image.getAttribute('width'),
    height: image.getAttribute('height'),
    src: image.currentSrc,
  }));
  step.check(portrait.natural > 0, `${path}: the portrait loaded (naturalWidth ${portrait.natural}, ${portrait.src})`);
  step.check(portrait.alt === t.about.portraitAlt, `${path}: the portrait's alt text is the dictionary's "${t.about.portraitAlt}" (got "${portrait.alt}")`);
  step.check(portrait.width === '572' && portrait.height === '1024', `${path}: the portrait has width and height attributes (got ${portrait.width}x${portrait.height})`);
  step.check(/portrait/.test(portrait.src) && !/pool/.test(portrait.src), `${path}: it is the real portrait file, not the pool image (${portrait.src})`);

  // The Q&A and the folded rows are <details>; the five questions are among them.
  const summaries = await page.$$eval('main details > summary', (els) => els.map((el) => el.textContent));
  step.check(summaries.length >= 5, `${path} has at least five <details> (got ${summaries.length})`);
  for (const question of t.compass.qa.items) step.check(summaries.some((text) => text.includes(question)), `${path}: "${question}" is a <summary>`);

  // Counted by the keyboard: Tab reaches a summary with a visible focus ring, and Enter opens it.
  let reached = null;
  for (let press = 0; press < 80 && !reached; press++) {
    await page.keyboard.press('Tab');
    reached = await page.evaluate(() => {
      const active = document.activeElement;
      if (active?.tagName !== 'SUMMARY') return null;
      const style = getComputedStyle(active);
      return { outline: style.outlineStyle, width: parseFloat(style.outlineWidth), open: active.parentElement.open };
    });
  }
  step.check(reached !== null, `${path}: Tab reaches a <summary>`);
  if (reached) {
    step.check(reached.outline !== 'none' && reached.width >= 2, `${path}: the focused <summary> has a visible ring (${reached.outline} ${reached.width}px)`);
    await page.keyboard.press('Enter');
    const opened = await page.evaluate(() => document.activeElement.parentElement.open);
    step.check(opened === !reached.open, `${path}: Enter toggles the focused <details> (open ${reached.open} -> ${opened})`);
  }

  // #career: the section the old /career/ addresses redirect to.
  const career = await page.$eval('#career', (el) => ({ tag: el.tagName, heading: el.querySelector('h2')?.textContent })).catch(() => null);
  step.check(career?.tag === 'SECTION' && career.heading === plain(t.career.title), `${path} has #career, a section headed "${plain(t.career.title)}" (got ${JSON.stringify(career)})`);
  await page.goto(`${BASE}${path}#career`, { waitUntil: 'load' });
  await pageReady(page, path);
  const top = await page.$eval('#career', (el) => el.getBoundingClientRect().top);
  step.check(top > -5 && top < 450, `${path}#career scrolls the section into view (top ${Math.round(top)} px)`);

  // The work section carries the old Projects section's own copy: the intro, the next slot (pointing on to the
  // career) and what is held back, with the three projects between them.
  // textContent, not innerText: the titles and labels are set in capitals by CSS, which innerText would apply.
  const work = await page.$eval('#work', (el) => el.textContent);
  const workOrder = [t.work.intro, ...['Steady', 'Jontai Energy', 'Cookies Clicker'], plain(t.work.nextTitle), t.work.nextText, t.work.nextLink, t.work.heldTitle, t.work.heldText].map((string) => work.indexOf(string));
  step.check(workOrder.every((place) => place >= 0) && workOrder.every((place, index) => index === 0 || place > workOrder[index - 1]), `${path}: #work has the intro, the projects, the next slot and the held-back note, in that order (${workOrder.join(' ')})`);
  step.check((await page.getAttribute('#work a.lite-more', 'href')) === '#career', `${path}: the next slot's link goes to #career`);
  await page.click('#work a.lite-more');
  await page.waitForFunction(() => location.hash === '#career', null, { timeout: 3_000 }).catch(() => {});
  const jumped = await page.$eval('#career', (el) => el.getBoundingClientRect().top);
  step.check(new URL(page.url()).hash === '#career' && jumped > -5 && jumped < 450, `${path}: following it lands on #career (${page.url()}, top ${Math.round(jumped)} px)`);

  // The words of the engine room and the terminal are not here.
  const body = await page.$eval('main', (el) => el.textContent);
  for (const string of [t.hood.title, t.hood.intro, t.terminal.welcome, t.about.clock.label].map(plain)) {
    step.check(!body.includes(string), `${path} does not carry "${string}"`);
  }

  // Every link in the page's own lists goes to a page of the site.
  const internal = await page.$$eval('main a[href^="/"]', (links) => links.map((link) => link.getAttribute('href')));
  const prefix = lang === 'en' ? '/en' : '';
  for (const href of [`${prefix}/projects/steady/`, `${prefix}/projects/jontai-energy/`, `${prefix}/projects/cookies-clicker/`, `${prefix}/contact/`]) {
    step.check(internal.includes(href), `${path} links to ${href}`);
  }
  await takeCsp(page, step);
  await context.close();
}

/** With no script at all the page is the same: the HTML the build wrote carries every section. */
async function liteWithoutScript(browser, step) {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  for (const lang of ['nl', 'en']) {
    const path = LITE[lang];
    const response = await page.goto(BASE + path, { waitUntil: 'load' });
    step.check(response?.status() === 200, `${path} answers 200 with JavaScript off`);
    step.check((await page.locator('h1').count()) === 1, `${path} has one <h1> with JavaScript off`);
    step.check((await page.locator('main h2').count()) === 7, `${path} has all seven sections with JavaScript off (got ${await page.locator('main h2').count()})`);
    step.check((await page.locator('main details').count()) >= 5, `${path} has its <details> with JavaScript off`);
    step.check((await page.locator('#career').count()) === 1, `${path} has #career with JavaScript off`);
    step.check((await page.locator('figure.portrait img').count()) === 1, `${path} has the portrait with JavaScript off`);
    // A <details> opens without script: that is the element's own behaviour.
    await page.locator('main details > summary').first().click();
    step.check(await page.$eval('main details', (el) => el.open), `${path}: a <summary> opens its <details> with JavaScript off`);
    const contact = await page.goto(BASE + CONTACT[lang], { waitUntil: 'load' });
    step.check(contact?.status() === 200, `${CONTACT[lang]} answers 200 with JavaScript off`);
    step.check((await page.locator('a[href="mailto:bhccob@gmail.com"]').count()) === 1, `${CONTACT[lang]} carries the direct mailto: link with JavaScript off`);
    const keyed = (await page.locator('input[name="access_key"]').count()) > 0;
    // With a key the form is plain HTML that posts to Web3Forms; without one there is no form until the page hydrates.
    step.check(
      keyed ? (await page.getAttribute('form.form', 'action')) === 'https://api.web3forms.com/submit' : (await page.locator('form').count()) === 0,
      `${CONTACT[lang]} with JavaScript off: ${keyed ? 'the form posts to Web3Forms' : 'no dead form without a key'}`,
    );
  }
  await context.close();
}

/**
 * Records in `window.__mailto` every navigation of the context's pages to a mailto: link, and cancels it. The Navigation API
 * sees every navigation before it happens, including one to mailto:, and a script can cancel it: the link is recorded and
 * no mail client opens. Call it before the page loads.
 */
const recordMailto = (context) =>
  context.addInitScript(() => {
    window.__mailto = [];
    navigation.addEventListener('navigate', (event) => {
      if (!event.destination.url.startsWith('mailto:')) return;
      window.__mailto.push(event.destination.url);
      event.preventDefault();
    });
  });

/** The contact form, with the Web3Forms key the build has (none on a local build) in a language. */
async function contactOne(browser, step, lang) {
  const { t } = new Translator(lang);
  const path = CONTACT[lang];
  const c = t.contact;
  const { context, page } = await openPage(browser, step);
  await recordMailto(context);
  await page.goto(BASE + path, { waitUntil: 'load' });
  await pageReady(page, path);
  // The form is there, and the page has hydrated: from then on the page validates, not the browser (noValidate).
  await page.waitForFunction(() => document.querySelector('form.form')?.noValidate === true, null, { timeout: 10_000 });
  const h1 = await page.$$eval('h1', (els) => els.map((el) => el.textContent));
  step.check(h1.length === 1 && h1[0] === plain(c.title), `${path} has one <h1>, the contact copy's title "${plain(c.title)}" (got ${JSON.stringify(h1)})`);
  step.check((await page.title()) === `${t.meta.contactTitle} | Bob Chung`, `${path}: the <title> stays "${t.meta.contactTitle} | Bob Chung" (got "${await page.title()}")`);
  const keyed = (await page.locator('input[name="access_key"]').count()) > 0;

  // An empty submit names the first bad field, in the dictionary's words, and moves focus to it.
  await page.click('button[type="submit"]');
  await page.waitForTimeout(200);
  const empty = await page.evaluate(() => ({
    focus: document.activeElement?.id,
    invalid: [...document.querySelectorAll('[aria-invalid="true"]')].map((el) => el.id),
    errors: [...document.querySelectorAll('.field-error')].map((el) => el.textContent),
    mailto: window.__mailto.length,
  }));
  step.check(empty.focus === 'contact-name', `${path}: an empty submit focuses the name field (got ${empty.focus})`);
  step.check(JSON.stringify(empty.invalid) === JSON.stringify(['contact-name', 'contact-email', 'contact-message']), `${path}: name, email and message are marked invalid (got ${empty.invalid.join(' ')})`);
  step.check(empty.errors[0] === c.errors.name && empty.errors[1] === c.errors.email && empty.errors[2] === c.errors.message, `${path}: the errors are the dictionary's (got ${JSON.stringify(empty.errors)})`);
  step.check(empty.mailto === 0, `${path}: an empty submit navigates nowhere`);
  const described = await page.getAttribute('#contact-name', 'aria-describedby');
  step.check(described === 'contact-name-error', `${path}: the name field points at its error with aria-describedby (got ${described})`);

  // An error goes as soon as its field is good enough.
  await page.fill('#contact-name', 'Ada Lovelace');
  step.check((await page.getAttribute('#contact-name', 'aria-invalid')) === null, `${path}: the name's error clears once the name is valid`);

  if (keyed) {
    const hidden = await page.$$eval('form.form input[type="hidden"]', (els) => Object.fromEntries(els.map((el) => [el.name, el.value])));
    step.check(Boolean(hidden.access_key) && hidden.redirect?.endsWith(`${path}?sent=1`), `${path}: the build's key is in the form, with the way back to ${path}?sent=1`);
    await takeCsp(page, step);
    await context.close();
    await contactKeyed(browser, step, lang);
    return `${path}: key present, posts to a mocked Web3Forms (success, guards, cooldown, failure)`;
  }

  // No key: a valid form hands the message to the email app. The mailto: navigation is cancelled above.
  await page.fill('#contact-email', 'ada@example.com');
  await page.fill('#contact-subject', 'A question');
  await page.fill('#contact-message', 'Hello Bob, I would like to talk about a project.');
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => window.__mailto.length > 0, null, { timeout: 5_000 }).catch(() => {});
  const mailto = await page.evaluate(() => window.__mailto);
  step.check(mailto.length === 1, `${path}: submitting a filled form navigates to a mailto: link once (got ${mailto.length})`);
  if (mailto.length > 0) {
    const url = new URL(mailto[0]);
    step.check(url.protocol === 'mailto:' && url.pathname === 'bhccob@gmail.com', `${path}: the link is to bhccob@gmail.com (got ${url.protocol}${url.pathname})`);
    step.check(url.searchParams.get('subject') === 'Portfolio: A question', `${path}: the subject is "Portfolio: A question" (got ${url.searchParams.get('subject')})`);
    const body = url.searchParams.get('body') ?? '';
    step.check(body.startsWith('Hello Bob, I would like to talk about a project.') && body.includes('Ada Lovelace') && body.includes('ada@example.com'), `${path}: the body has the message, the name and the address (got ${JSON.stringify(body)})`);
  }
  const done = await page.evaluate(() => ({ title: document.querySelector('.form-done h2')?.textContent, focused: document.activeElement?.classList.contains('form-done') }));
  step.check(done.title === c.mailtoTitle && done.focused === true, `${path}: the "${c.mailtoTitle}" panel is shown and focused (got ${JSON.stringify(done)})`);
  await page.click('.form-done button');
  step.check((await page.evaluate(() => document.activeElement?.id)) === 'contact-name', `${path}: "${c.again}" puts focus back in the name field`);
  await takeCsp(page, step);
  await context.close();
  return `${path}: no key, mailto: navigation recorded and cancelled`;
}

/**
 * A build with a Web3Forms key: the form posts in the background. Web3Forms is answered by this harness (the
 * request never leaves the machine), so nothing is sent: a post that works, the two guards against scripts
 * (a form filled in at once, a ticked honeypot), the pause after a sent message, an answer that fails, and
 * a post nobody answers (one post for two submits, the timeout, a retry).
 */
async function contactKeyed(browser, step, lang) {
  const { t } = new Translator(lang);
  const c = t.contact;
  const path = CONTACT[lang];
  const posts = [];
  let answer = { status: 200, body: { success: true } };
  // The console errors these posts are meant to end in: the page logs a failed post, and the browser logs the 500 or the abort.
  const failing = (message) => /Web3Forms answered 500|status of 500|abort|ERR_ABORTED/i.test(message.text());
  const { context, page } = await openPage(browser, step, failing);
  await context.route('https://api.web3forms.com/**', async (route) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    posts.push(JSON.parse(route.request().postData() ?? '{}'));
    return route.fulfill({ status: answer.status, headers: cors, contentType: 'application/json', body: JSON.stringify(answer.body) });
  });
  const open = async () => {
    await page.goto(BASE + path, { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelector('form.form')?.noValidate === true, null, { timeout: 10_000 });
  };
  const fill = async () => {
    await page.fill('#contact-name', 'Ada Lovelace');
    await page.fill('#contact-email', 'ada@example.com');
    await page.fill('#contact-subject', 'A question');
    await page.fill('#contact-message', 'Hello Bob, I would like to talk about a project.');
  };
  const title = () => page.evaluate(() => document.querySelector('.form-done h2')?.textContent ?? null);

  // A ticked honeypot is a script: it is told it worked, and nothing is posted, however long it took.
  await open();
  await fill();
  await page.evaluate(() => document.querySelector('input[name="botcheck"]').click());
  await page.click('button[type="submit"]');
  step.check((await title()) === c.successTitle && posts.length === 0, `${path}: a ticked honeypot shows success and posts nothing (posted ${posts.length})`);

  // A person: after three seconds, the post goes out with the key and the fields.
  await open();
  await page.waitForTimeout(3_200);
  await fill();
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => document.querySelector('.form-done'), null, { timeout: 5_000 }).catch(() => {});
  step.check(posts.length === 1, `${path}: a filled form posts once (posted ${posts.length})`);
  const sent = posts[0] ?? {};
  step.check(Boolean(sent.access_key) && sent.name === 'Ada Lovelace' && sent.email === 'ada@example.com' && sent.message?.startsWith('Hello Bob'), `${path}: the post carries the key and the three fields (got ${JSON.stringify(Object.keys(sent))})`);
  step.check(sent.subject === 'Portfolio: A question' && sent.from_name === 'bhccob.com portfolio', `${path}: the post has the site's subject and sender (got ${sent.subject}, ${sent.from_name})`);
  step.check((await title()) === c.successTitle, `${path}: the "${c.successTitle}" panel is shown`);

  // The next message waits a minute.
  await page.click('.form-done button');
  await page.waitForTimeout(3_200);
  await fill();
  await page.click('button[type="submit"]');
  await page.waitForTimeout(300);
  step.check(posts.length === 1 && (await page.textContent('.form-status')) === c.errors.cooldown, `${path}: a second message within a minute gets the pause notice and is not posted (posted ${posts.length})`);
  step.check(await page.evaluate(() => document.activeElement?.classList.contains('form-status')), `${path}: the pause notice takes focus`);
  await takeCsp(page, step);
  await context.close();

  // A form sent at once (a quick writer, the browser's autofill) is not dropped: it shows that it is sending, waits out
  // the rest of MIN_FILL_MS from the page opening, then posts. A tab of its own: the pause above is this tab's.
  const quick = await openPage(browser, step, failing);
  const quickPosts = [];
  await quick.context.route('https://api.web3forms.com/**', async (route) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    quickPosts.push(Date.now());
    return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });
  const fast = quick.page;
  await fast.goto(BASE + path, { waitUntil: 'load' });
  await fast.waitForFunction(() => document.querySelector('form.form')?.noValidate === true, null, { timeout: 10_000 });
  const readyAt = Date.now();
  await fast.fill('#contact-name', 'Ada Lovelace');
  await fast.fill('#contact-email', 'ada@example.com');
  await fast.fill('#contact-message', 'Hello Bob, I would like to talk about a project.');
  await fast.click('button[type="submit"]');
  const waiting = await fast.evaluate(() => {
    const button = document.querySelector('form.form button[type="submit"]');
    return { text: button?.textContent ?? null, disabled: button?.disabled ?? null, done: document.querySelector('.form-done') !== null };
  });
  step.check(
    waiting.text === c.sending && waiting.disabled === true && !waiting.done && quickPosts.length === 0,
    `${path}: a form sent at once says "${c.sending}" and waits, nothing posted yet (got ${JSON.stringify(waiting)}, posted ${quickPosts.length})`,
  );
  await fast.waitForFunction(() => document.querySelector('.form-done'), null, { timeout: MIN_FILL_MS + 5_000 }).catch(() => {});
  const quickTitle = await fast.evaluate(() => document.querySelector('.form-done h2')?.textContent ?? null);
  const after = quickPosts.length === 1 ? quickPosts[0] - readyAt : null;
  step.check(
    quickPosts.length === 1 && quickTitle === c.successTitle && after !== null && after >= MIN_FILL_MS - 200,
    `${path}: then it posts once, ${after} ms after the form was ready (no sooner than ${MIN_FILL_MS} ms after the page opened), and shows "${c.successTitle}" (posted ${quickPosts.length}, got "${quickTitle}")`,
  );
  await takeCsp(fast, step);
  await quick.context.close();

  // An answer that fails: the visitor is told, the form keeps what they wrote, and they can try again.
  answer = { status: 500, body: { success: false } };
  const failed = await openPage(browser, step, failing);
  await failed.context.route('https://api.web3forms.com/**', async (route) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    return route.fulfill({ status: answer.status, headers: cors, contentType: 'application/json', body: JSON.stringify(answer.body) });
  });
  const retry = failed.page;
  await retry.goto(BASE + path, { waitUntil: 'load' });
  await retry.waitForFunction(() => document.querySelector('form.form')?.noValidate === true, null, { timeout: 10_000 });
  await retry.waitForTimeout(3_200);
  await retry.fill('#contact-name', 'Ada Lovelace');
  await retry.fill('#contact-email', 'ada@example.com');
  await retry.fill('#contact-message', 'Hello Bob, I would like to talk about a project.');
  await retry.click('button[type="submit"]');
  await retry.waitForFunction(() => document.querySelector('.form-status')?.textContent, null, { timeout: 5_000 }).catch(() => {});
  step.check((await retry.textContent('.form-status')) === c.errors.generic, `${path}: a failing post shows the generic error (got "${await retry.textContent('.form-status')}")`);
  step.check((await retry.inputValue('#contact-name')) === 'Ada Lovelace' && (await retry.locator('button[type="submit"]').isEnabled()), `${path}: the form keeps what was written and can send again`);
  const failFocus = await retry.evaluate(() => ({ alert: document.activeElement?.classList.contains('form-status'), role: document.activeElement?.getAttribute('role') }));
  step.check(failFocus.alert === true && failFocus.role === 'alert', `${path}: after a failed post focus is on the alert, not lost to <body> (got ${JSON.stringify(failFocus)})`);
  await takeCsp(retry, step);
  await failed.context.close();

  // A post that is never answered: one goes out however often the form is submitted, and after fifteen seconds
  // (the page's clock is Playwright's, moved forward past the timeout) it fails like any other and can be retried.
  const hung = await openPage(browser, step, failing);
  const hangs = [];
  await hung.context.route('https://api.web3forms.com/**', async (route) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    hangs.push(route.request().postData());
    await new Promise(() => {}); // no answer, ever: the page's own timeout has to end it
  });
  const stuck = hung.page;
  await stuck.clock.install();
  await stuck.goto(BASE + path, { waitUntil: 'load' });
  await stuck.waitForFunction(() => document.querySelector('form.form')?.noValidate === true, null, { timeout: 10_000 });
  await stuck.waitForTimeout(3_200);
  await stuck.fill('#contact-name', 'Ada Lovelace');
  await stuck.fill('#contact-email', 'ada@example.com');
  await stuck.fill('#contact-message', 'Hello Bob, I would like to talk about a project.');
  // Two submit events in one go, as Enter pressed twice or a script would send them: the button cannot stop the second.
  await stuck.evaluate(() => {
    const form = document.querySelector('form.form');
    form.requestSubmit();
    form.requestSubmit();
  });
  await stuck.waitForFunction(() => document.querySelector('form.form button[type="submit"]')?.disabled, null, { timeout: 3_000 }).catch(() => {});
  await stuck.waitForTimeout(400);
  step.check(hangs.length === 1, `${path}: two submits at once post once (posted ${hangs.length})`);
  step.check((await stuck.textContent('form.form button[type="submit"]')) === c.sending, `${path}: while the post is out the button says "${c.sending}" and is off`);
  await stuck.clock.fastForward(SEND_TIMEOUT_MS + 1_000);
  await stuck.waitForFunction(() => document.querySelector('.form-status')?.textContent, null, { timeout: 5_000 }).catch(() => {});
  step.check((await stuck.textContent('.form-status')) === c.errors.generic, `${path}: a post nobody answers fails after fifteen seconds with the generic error (got "${await stuck.textContent('.form-status')}")`);
  step.check((await stuck.inputValue('#contact-message')).startsWith('Hello Bob') && (await stuck.locator('button[type="submit"]').isEnabled()), `${path}: after the timeout the form keeps the message and the button is on again`);
  step.check(await stuck.evaluate(() => document.activeElement?.classList.contains('form-status')), `${path}: after the timeout focus is on the alert`);
  await stuck.evaluate(() => document.querySelector('form.form').requestSubmit());
  await stuck.waitForTimeout(400);
  step.check(hangs.length === 2, `${path}: after a failure the form can send again (posted ${hangs.length})`);
  await hung.context.close();
}

async function lite(browser, step) {
  for (const lang of ['nl', 'en']) await liteOne(browser, step, lang);
  await liteWithoutScript(browser, step);
  const summaries = [];
  for (const lang of ['nl', 'en']) summaries.push(await contactOne(browser, step, lang));
  return `/lite/ and /en/lite/: seven sections, portrait, details, #career, no script needed; ${summaries.join('; ')}`;
}

// ---------------------------------------------------------------- scroll

/** The per-frame values of the scroll, from window.__needleDebug(): `chapterIndex` is its `chapter.index`. */
const frameOf = (page) =>
  page.evaluate(() => {
    const { progress, target, velocity, chapter } = window.__needleDebug();
    return { progress, target, velocity, chapterIndex: chapter.index };
  });
/** The scene's whole phase, as `{ kind, dir?, category?, id? }`. */
const phaseOf = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__needleDebug().phase)));

/** Waits until the story is at rest: progress on its target and the target no longer moving (a glide is over). */
async function restAt(page) {
  let previous = null;
  for (let i = 0; i < 80; i++) {
    const f = await frameOf(page);
    if (previous !== null && f.target === previous && Math.abs(f.target - f.progress) < 1e-4) return f;
    previous = f.target;
    await page.waitForTimeout(100);
  }
  throw new Error(`the story did not come to rest (${JSON.stringify(await frameOf(page))})`);
}

/**
 * Waits until a direct load of / is on HOME_IDLE, the phase the scroll moves from: the opening says LOADED once it has
 * landed on the home (or the host once it settles on no scene). Answers how long it took, in ms from the document's
 * start. A first visit plays the whole show (SCRIPT.home, 6.25 s, never shortened on a fast load) once the scene has
 * started, which it must within LOAD_TIMEOUT_MS: LANDED_WITHIN_MS.
 */
async function reachHomeIdle(page) {
  await page.waitForFunction(() => window.__needleDebug?.().phase.kind === 'HOME_IDLE', null, { timeout: LANDED_WITHIN_MS });
  return page.evaluate(() => Math.round(performance.now()));
}

/** How long a first visit may take from the document's start to HOME_IDLE, ms: the scene's start, the full show, and slack. */
const LANDED_WITHIN_MS = LOAD_TIMEOUT_MS + SCRIPT.home * 1000 + 3_000;

/** Waits for the scene to be in a phase of `kind` and says so as a check. */
async function expectPhase(page, step, kind, message) {
  const reached = await waitForPhase(page, kind).then(() => true, () => false);
  step.check(reached, `${message} (phase ${JSON.stringify(await phaseOf(page))})`);
}

/**
 * Counts the scroll loop's frame requests from now on in window.__raf, how many of its callbacks run at each frame
 * time in window.__rafRuns (two callbacks at one time are two frames asked for in the same frame), and records
 * whether each wheel was prevented in window.__wheels. Only the scroll loop's own requests are counted: it asks
 * through window.__needleDebug.scrollRequest (the bridge behind ?proof), which is wrapped here, while the canvas renders
 * on demand through R3F's own requestAnimationFrame, which may land in the same frame and is no business of the scroll's.
 */
const watchFrames = (page) =>
  page.evaluate(() => {
    window.__raf = 0;
    window.__rafRuns = {};
    const bridge = window.__needleDebug;
    if (!bridge) throw new Error('window.__needleDebug is missing: open the page with ?proof');
    const request = bridge.scrollRequest;
    bridge.scrollRequest = (callback) => {
      window.__raf++;
      return request((now) => {
        window.__rafRuns[now] = (window.__rafRuns[now] ?? 0) + 1;
        callback(now);
      });
    };
    window.__wheels = [];
    // A listener on window runs after the input's on the document element, so it sees the final defaultPrevented.
    window.addEventListener('wheel', (event) => window.__wheels.push(event.defaultPrevented), { passive: true });
  });

/** What watchFrames saw since it was started or last read: calls asked for, frames that ran, and the most callbacks in one frame. */
const takeFrames = (page) =>
  page.evaluate(() => {
    const runs = Object.values(window.__rafRuns);
    const report = { requests: window.__raf, frames: runs.length, most: Math.max(0, ...runs) };
    window.__raf = 0;
    window.__rafRuns = {};
    return report;
  });

const near = (a, b, tolerance = 1e-6) => Math.abs(a - b) <= tolerance;

async function scrollDesktop(browser, step) {
  const { context, page } = await openPage(browser, step);
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await stageReady(page);
  await reachHomeIdle(page);
  // The beads load once the home has landed, and until they are ready the landing holds the scroll at LANDING_HOLD: the
  // keys and the End below go past it, so the step starts with them in.
  await expectVoid(page, step, 'ready', 'the world under the glass is ready, so nothing holds the landing');
  await watchFrames(page);
  const vh = await page.evaluate(() => window.innerHeight);

  // The root is the scroll surface, and it is locked.
  const style = await page.evaluate(() => {
    const css = getComputedStyle(document.documentElement);
    return { route: document.documentElement.dataset.route, overflow: css.overflow, overscroll: css.overscrollBehaviorY, touchAction: css.touchAction };
  });
  step.check(style.route === 'home', `the home page says data-route="home" (got ${style.route})`);
  step.check(style.overflow === 'hidden' && style.overscroll === 'none', `with 3D on the root does not scroll and does not overscroll (got ${style.overflow}, ${style.overscroll})`);
  step.check(style.touchAction === 'pinch-zoom', `with 3D on a finger does not pan the page, a pinch still zooms it (touch-action ${style.touchAction})`);
  const start = await frameOf(page);
  step.check(start.progress === 0 && start.target === 0 && start.chapterIndex === 0, `the story starts at 0 (got ${JSON.stringify(start)})`);

  // 10 wheel events of 120 px: 1200 px of scroll, in viewport heights.
  await page.mouse.move(720, 450);
  for (let i = 0; i < 10; i++) {
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(16);
  }
  const pushed = await frameOf(page);
  step.check(near(pushed.target, 1200 / vh, 1e-9), `10 wheel events of 120 px move the target by 1200 px = ${1200 / vh} units (got ${pushed.target})`);
  step.check((await page.evaluate(() => window.__wheels)).length === 10 && (await page.evaluate(() => window.__wheels.every(Boolean))), 'every wheel event is prevented while the scroll is enabled');
  step.check((await page.evaluate(() => window.__raf)) > 0, 'the wheel woke the scroll loop');
  // Past the rise every gesture comes to rest on a stop: once the wheel has been quiet for GESTURE_GAP_MS, a gesture that came
  // up out of the rise and carried less than a whole unit past its top (1.33) settles back on the top, BOB from above.
  const rested = await restAt(page);
  step.check(rested.target === 1 && rested.progress === 1, `once the wheel is quiet the gesture, come up out of the rise to 1.33, settles on the rise's top, BOB from above, 1 (got target ${rested.target}, progress ${rested.progress})`);
  step.check(rested.chapterIndex === 1, `frame.chapterIndex is in step with the chapter: LIGHT is 1 (got ${rested.chapterIndex})`);
  const left = await phaseOf(page);
  step.check(left.kind === 'LIGHT', `the phase leaves HOME_IDLE for LIGHT (got ${JSON.stringify(left)})`);
  step.check((await page.evaluate(() => window.scrollY)) === 0, 'the page itself did not scroll');
  await page.waitForTimeout(150);
  const ran = await takeFrames(page);
  step.check(ran.most === 1 && ran.requests === ran.frames, `one frame asked for at a time through the wheel gesture: ${ran.requests} asked for, ${ran.frames} frames, at most ${ran.most} callback in one`);

  // Asleep at rest: the scroll loop asks for no frame at all while nothing moves (the canvas has its own sleep: step loaded).
  await page.waitForTimeout(600);
  step.check((await page.evaluate(() => window.__raf)) === 0, `the scroll loop sleeps at rest: no frame asked for in 600 ms (got ${await page.evaluate(() => window.__raf)})`);
  step.check((await frameOf(page)).velocity === 0, 'and the velocity is 0');

  // Keys. Home goes back to the start of the story and the phase with it.
  await page.keyboard.press('Home');
  const home = await restAt(page);
  step.check(home.progress === 0 && home.target === 0 && home.chapterIndex === 0, `Home goes to the start (got ${JSON.stringify(home)})`);
  await expectPhase(page, step, 'HOME_IDLE', 'and the phase is HOME_IDLE again');
  // On the rise a key moves by its distance, as M2a's did, never past the rise's top (stop 1); from the top on it steps
  // to the next stop or the one before.
  await page.keyboard.press('ArrowDown');
  step.check(near((await frameOf(page)).target, 0.15), 'on the rise an arrow moves 0.15 of a viewport');
  await page.keyboard.press('PageDown');
  step.check((await frameOf(page)).target === 1, 'and Page Down 0.9, held at the top of the rise: BOB from above, 1');
  const [F81, F121] = [placeOfFrame(81), placeOfFrame(121)];
  await page.keyboard.press('ArrowDown');
  step.check((await frameOf(page)).target === F81, `from the top an arrow steps to the next key stop, fact 01 at its peak, ${F81.toFixed(4)}`);
  await page.keyboard.press('Space');
  step.check((await frameOf(page)).target === F121, `Space steps to the next key stop too, fact 02, ${F121.toFixed(4)}`);
  await page.keyboard.press('Shift+Space');
  step.check((await frameOf(page)).target === F81, 'Shift+Space steps back, to fact 01');
  await page.keyboard.press('PageUp');
  step.check((await frameOf(page)).target === 1, 'Page Up steps back to the top of the rise, 1');
  await page.keyboard.press('PageUp');
  step.check(near((await frameOf(page)).target, 0.1), 'and from there moves 0.9 of a viewport back up the rise');
  await page.keyboard.press('ArrowUp');
  step.check(near((await frameOf(page)).target, 0), 'and the target stops at 0');
  await page.keyboard.press('End');
  const end = await restAt(page);
  step.check(end.target === STORY_END && end.progress === STORY_END, `End goes to the end of the story, ${STORY_END} (got ${JSON.stringify(end)})`);
  const last = await waitForPhase(page, 'END').then(() => phaseOf(page), () => phaseOf(page));
  step.check(last.kind === 'END', `the story ends on the end page, after the last project category (got ${JSON.stringify(last)})`);
  await page.mouse.wheel(0, 240);
  step.check((await frameOf(page)).target === STORY_END, 'and the target stops at the end (there the wheel is the end page\'s own scroll)');
  await page.keyboard.press('Home');
  await restAt(page);
  await waitForPhase(page, 'HOME_IDLE');
  await page.mouse.wheel(0, -120);
  step.check((await frameOf(page)).target === 0, 'a wheel up at the start stays at 0');

  // A visit to a page and back: Back from a project page lands at its bead's stop (Task 12), not where the scroll was, and
  // the scroll goes on from there.
  for (const key of ['PageDown', 'PageDown', 'ArrowDown']) await page.keyboard.press(key);
  const mid = await restAt(page);
  step.check(mid.progress === placeOfFrame(81) && mid.chapterIndex === 1, `the story rests on fact 01's peak, in LIGHT, ${placeOfFrame(81).toFixed(4)} (got ${JSON.stringify(mid)})`);
  await page.focus('.home-nav a[href="/projects/steady/"]');
  await page.keyboard.press('Enter');
  await page.waitForURL((url) => url.pathname === '/projects/steady/', { timeout: 5_000 });
  await waitForProject(page, 'steady');
  const onPage = await frameOf(page);
  await page.keyboard.press('PageDown'); // on the project page the keys are the page's
  step.check((await frameOf(page)).target === onPage.target, 'on a project page the keys do not move the story');
  await page.click('a.back');
  await page.waitForURL((url) => url.pathname === '/', { timeout: 5_000 });
  await expectPhase(page, step, 'PROJECTS', "coming back to / puts the scene on the scroll's phase, PROJECTS (Back lands at the project's stop), and not on HOME_IDLE");
  // Task 12: Back from a project page lands at its bead's stop (spec §2.4), not where the scroll was before the page.
  const back = await frameOf(page);
  const arrivalUnit = chapterAt(HOME_CHAPTERS, PROJECT_LIST[0].stop).index;
  step.check(near(back.progress, PROJECT_LIST[0].stop) && back.chapterIndex === arrivalUnit, `the story is at Steady's area stop, ${PROJECT_LIST[0].stop}, in its area (unit ${arrivalUnit}), where Back from its page lands (got ${JSON.stringify(back)})`);
  await page.keyboard.press('PageDown');
  const resumed = await restAt(page);
  const nextBoard = PROJECT_LIST.find((p) => p.index === PROJECT_LIST[0].index + 1);
  step.check(near(resumed.target, nextBoard.stop, 1e-9) && near(resumed.progress, nextBoard.stop, 1e-6), `and the scroll goes on from there, a step to the next board, ${nextBoard.id}'s, ${nextBoard.stop} (got target ${resumed.target}, progress ${resumed.progress})`);
  await page.keyboard.press('Home');
  await restAt(page);

  // A text field keeps its keys.
  await page.evaluate(() => {
    const input = document.createElement('input');
    input.id = 'scroll-probe';
    document.body.append(input);
    input.focus();
  });
  const before = await frameOf(page);
  await page.keyboard.press('PageDown');
  await page.keyboard.press('Space');
  await page.keyboard.press('End');
  step.check((await frameOf(page)).target === before.target, 'Page Down, Space and End typed into a text field do not move the story');
  step.check((await page.inputValue('#scroll-probe')) === ' ', 'and Space is typed into it');
  await page.evaluate(() => document.getElementById('scroll-probe')?.remove());

  // A pinch is the browser's.
  await page.evaluate(() => (window.__wheels.length = 0));
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, 100);
  await page.keyboard.up('Control');
  step.check(JSON.stringify(await page.evaluate(() => window.__wheels)) === '[false]', 'a wheel with ctrl held (a pinch) is not prevented');
  step.check((await frameOf(page)).target === 0, 'and it does not move the story');

  await takeCsp(page, step);
  await context.close();
}

/** With reduced motion every wheel gesture, swipe and key press is one key stop: BOB from above, a fact, a project, the end. */
async function scrollReduced(browser, step) {
  const { context, page } = await openPage(browser, step, () => false, { width: 1440, height: 900 }, { reducedMotion: 'reduce' });
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await stageReady(page);
  step.check(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), 'the page asks for reduced motion');
  await reachHomeIdle(page);
  await expectVoid(page, step, 'ready', 'the world under the glass is ready, so nothing holds the landing');
  await page.mouse.move(720, 450);

  // A gesture: ten events 16 ms apart. Then 300 ms of quiet, then another.
  for (let i = 0; i < 10; i++) {
    await page.mouse.wheel(0, 40);
    await page.waitForTimeout(16);
  }
  step.check((await frameOf(page)).target === 1, `a whole wheel gesture is one stop: BOB from above, the start of LIGHT (got ${(await frameOf(page)).target})`);
  await page.waitForTimeout(300);
  for (let i = 0; i < 10; i++) {
    await page.mouse.wheel(0, 40);
    await page.waitForTimeout(16);
  }
  step.check((await frameOf(page)).target === placeOfFrame(81), `the next gesture, after a quiet gap, is the next key stop: fact 01's peak (got ${(await frameOf(page)).target})`);
  const rested = await restAt(page);
  step.check(rested.progress === placeOfFrame(81) && rested.chapterIndex === 1, `the story arrives at the stop (got ${JSON.stringify(rested)})`);
  await expectPhase(page, step, 'LIGHT', 'and the phase is LIGHT');

  // Keys: one key stop a press, and a held key is one press.
  const visited = [];
  for (const key of ['PageDown', 'PageDown', 'PageDown']) {
    await page.keyboard.press(key);
    visited.push((await frameOf(page)).target);
  }
  const wantStops = [121, 161, 201].map(placeOfFrame);
  step.check(JSON.stringify(visited) === JSON.stringify(wantStops), `Page Down is a key stop a press, facts 02, 03 and 04 (got ${JSON.stringify(visited)})`);
  await page.keyboard.press('ArrowUp');
  step.check((await frameOf(page)).target === wantStops[1], 'an arrow up is the previous key stop');
  await page.keyboard.down('PageDown');
  await page.keyboard.down('PageDown'); // auto-repeat: keydown with repeat = true
  await page.keyboard.down('PageDown');
  await page.keyboard.up('PageDown');
  step.check((await frameOf(page)).target === wantStops[2], `a held key is one step (got ${(await frameOf(page)).target})`);
  await page.keyboard.press('Home');
  step.check((await frameOf(page)).target === 0, 'Home still goes to the start');
  await restAt(page);
  await expectPhase(page, step, 'HOME_IDLE', 'and the phase is HOME_IDLE again');
  await takeCsp(page, step);
  await context.close();
}

/** A finger on a touch screen (Chrome DevTools Protocol touch events). */
async function scrollTouch(browser, step) {
  const { context, page } = await openPage(browser, step, () => false, { width: 390, height: 844 }, { hasTouch: true, isMobile: true });
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await stageReady(page);
  await reachHomeIdle(page);
  await expectVoid(page, step, 'ready', 'the world under the glass is ready, so nothing holds the landing');
  await watchFrames(page);
  const cdp = await context.newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const vh = await page.evaluate(() => window.innerHeight);
  // What the page sees of each touchmove: was it cancelable, and did the input prevent it?
  await page.evaluate(() => {
    window.__moves = [];
    window.addEventListener('touchmove', (event) => window.__moves.push({ cancelable: event.cancelable, prevented: event.defaultPrevented }), { passive: true });
  });
  const style = await page.evaluate(() => getComputedStyle(document.documentElement).touchAction);
  step.check(style === 'pinch-zoom', `on a touch screen the root takes no one-finger pan (touch-action ${style})`);

  // A drag of 400 px up moves the story 400 / vh, and a finger that lets go while moving glides on.
  const drag = async (from, to, x = 195, stepPx = 40) => {
    await touch('touchStart', x, from);
    const sign = Math.sign(to - from);
    for (let y = from + sign * stepPx; sign > 0 ? y <= to : y >= to; y += sign * stepPx) {
      await touch('touchMove', x, y);
      await page.waitForTimeout(12);
    }
    await page.evaluate(() => {
      window.__raf = 0; // from the lift on: what the glide asks for
      window.__rafRuns = {};
    });
    await touch('touchEnd');
  };
  // The first drag is a slow one, 200 px in steps of 20, so that it and its glide stay on the rise, where a flick glides on
  // as M2a's did (past the rise a lift settles the story on a stop instead, below).
  await drag(700, 500, 195, 20);
  const lifted = await frameOf(page);
  const moves = await page.evaluate(() => window.__moves);
  step.check(moves.length > 0 && moves.every((m) => m.cancelable && m.prevented), `every touchmove of the drag is cancelable and the input prevents it (${JSON.stringify(moves.slice(0, 2))} ...)`);
  step.check(lifted.target >= 200 / vh - 1e-6, `the drag moved the story at least its length, ${200 / vh} units (got ${lifted.target})`);
  const rested = await restAt(page);
  step.check(rested.target > lifted.target + 0.05 && rested.target < 1, `on the rise the flick glides on after the finger lifts, and rests where the glide ends, short of the rise's top: ${lifted.target} then ${rested.target}`);
  await page.waitForTimeout(150);
  const glide = await takeFrames(page);
  // (the counters were reset at the lift, when one frame was already waiting: it runs without having been counted as asked for)
  step.check(glide.most === 1 && Math.abs(glide.requests - glide.frames) <= 1, `one frame asked for at a time through the glide: ${glide.requests} asked for, ${glide.frames} frames, at most ${glide.most} callback in one`);
  step.check(glide.frames >= 40, `and the glide goes on for dozens of frames, not the handful a re-entrant wake left it (${glide.frames} frames from the lift to rest)`);
  step.check((await frameOf(page)).velocity === 0, 'and the velocity is 0 at rest');
  await drag(700, 300);
  await restAt(page);
  await drag(700, 300);
  const far = await restAt(page);
  // The flicks and their glides carry the story out of the rise into the light dive, where a lift glides on as a page's
  // scroll would and rests where the glide ends (the glide's length is the finger's): the phase it leaves HOME_IDLE for is
  // that place's chapter, which the chapters' own table (`chapterAt`) says, and the page's chapter index must agree with it.
  const farChapter = chapterAt(HOME_CHAPTERS, far.progress);
  await expectPhase(page, step, farChapter.id, `the phase leaves HOME_IDLE for that of the chapter the story rests in, ${farChapter.id} (${far.progress} is in chapter ${farChapter.index})`);
  step.check(
    far.target > 1 && far.progress === far.target && far.chapterIndex === farChapter.index && farChapter.id !== 'HOME',
    `flicks take the story out of HOME_IDLE past the rise, to rest where the glide ends, the page's chapter index agreeing with the table's (got ${JSON.stringify(far)})`,
  );
  step.check((await page.evaluate(() => window.scrollY)) === 0, 'the page itself did not scroll');

  // A drag down goes back, to rest where its glide ends.
  await drag(200, 700);
  const returned = await restAt(page);
  step.check(returned.target < far.target && returned.progress === returned.target, `a drag down goes back (${far.target} then ${returned.target})`);

  // A sideways swipe is not the scroll's, and a tap is nobody's but the page's.
  const before = await frameOf(page);
  await touch('touchStart', 300, 400);
  for (const x of [270, 230, 190, 150, 110]) {
    await touch('touchMove', x, 395);
    await page.waitForTimeout(40);
  }
  await touch('touchEnd');
  await page.waitForTimeout(600); // a tap straight after a swipe is taken by the browser for the one that stops a fling
  step.check((await frameOf(page)).target === before.target, 'a swipe sideways does not move the story');
  await takeCsp(page, step);
  await context.close();
}

/**
 * Where 3D cannot run (Edge with WebGL off; the header's 3D switch went, 2026-10-29), nothing is prevented: the home page
 * scrolls natively under the wheel, and the keys do not move the story.
 */
async function scrollNoWebgl(step) {
  const own = await chromium.launch({ channel: 'msedge', headless: true, args: NO_WEBGL });
  try {
    const { context, page } = await openPage(own, step);
    await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
    await page.waitForSelector('.scene-fallback', { timeout: 10_000 });
    await page.evaluate(() => {
      window.__wheels = [];
      window.addEventListener('wheel', (event) => window.__wheels.push(event.defaultPrevented), { passive: true });
    });
    await page.mouse.move(720, 450);
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(300);
    step.check(JSON.stringify(await page.evaluate(() => window.__wheels)) === '[false]', 'without WebGL a wheel is not prevented');
    const natural = await page.evaluate(() => ({ y: window.scrollY, overflow: getComputedStyle(document.documentElement).overflow }));
    step.check(natural.y > 0 && natural.overflow === 'visible', `without WebGL the home page scrolls natively (scrollY ${natural.y}, overflow ${natural.overflow})`);
    await page.keyboard.press('PageDown');
    step.check((await frameOf(page)).target === 0, 'and the keys do not move the story');
    await takeCsp(page, step);
    await context.close();
  } finally {
    await own.close();
  }
}

async function scroll(browser, step) {
  await scrollDesktop(browser, step);
  await scrollReduced(browser, step);
  await scrollTouch(browser, step);
  await scrollNoWebgl(step);
  return 'locked root; 10 wheel events of 120 px settle on BOB from above; the loop sleeps at rest; keys by distance on the rise and by key stops past it, Home and End; text fields and pinch left to the browser, and everything where 3D cannot run; reduced motion steps by key stops; touch drag, glide on the rise and on into the light dive, tap';
}

// ---------------------------------------------------------------- the scene: loaded, no-webgl, fps

/** Counts every requestAnimationFrame call of the page from its start in window.__allRaf: the canvas's (R3F's) included. */
const countAllFrames = (context) =>
  context.addInitScript(() => {
    window.__allRaf = 0;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => {
      window.__allRaf++;
      return raf(callback);
    };
  });

/**
 * Waits until the page asks for no frame at all for a whole second; answers how long that took to begin (ms from
 * the call), or null if it did not within `limit` ms. Only page.evaluate and timers here: no requestAnimationFrame
 * polling of the harness's own.
 */
async function sleepWithin(page, limit) {
  const start = Date.now();
  let last = await page.evaluate(() => window.__allRaf);
  let quietSince = Date.now();
  while (Date.now() - start < limit) {
    await page.waitForTimeout(200);
    const now = await page.evaluate(() => window.__allRaf);
    if (now !== last) {
      last = now;
      quietSince = Date.now();
    } else if (Date.now() - quietSince >= 1_000) {
      return quietSince - start;
    }
  }
  return null;
}

async function loaded(browser, step) {
  const { context, page } = await openPage(browser, step);
  await countAllFrames(context);
  const documents = [];
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url());
  });
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await page.bringToFront();
  await page.waitForFunction(() => typeof window.__needleDebug === 'function', null, { timeout: 5_000 });
  const first = await page.evaluate(() => window.__needleDebug().phase.kind);
  step.check(first === 'LOADING', `a direct load of / starts in LOADING (got ${first})`);
  const at = await reachHomeIdle(page);
  const fullShow = SCRIPT.home * 1000;
  step.check(
    at >= fullShow && at <= LOAD_TIMEOUT_MS + fullShow,
    `and reaches HOME_IDLE once the opening has landed, ${at} ms after the document started: the whole show (${fullShow} ms, never shortened on a fast load) after a start within the ${LOAD_TIMEOUT_MS} ms load timeout`,
  );
  step.check(documents.length === 1 && new URL(page.url()).pathname === '/', `with no detour: one document, still on / (got ${documents.join(' → ')}, ${page.url()})`);
  const shown = await page.evaluate(() => ({
    ready: document.querySelector('.scene-host')?.hasAttribute('data-ready'),
    webgl: document.querySelector('.scene-host')?.getAttribute('data-webgl'),
    canvases: document.querySelectorAll('.scene-host canvas').length,
    mounts: window.__needleDebug().canvasMounts,
    card: document.querySelector('.scene-fallback') !== null,
  }));
  step.check(shown.ready && shown.webgl === 'ok' && shown.canvases === 1 && shown.mounts === 1 && !shown.card, `the scene is ready and shown, on WebGL 'ok', with no fallback card (got ${JSON.stringify(shown)})`);

  // The wheel moves the story straight away.
  await page.mouse.move(720, 450);
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(16);
  }
  const moved = await restAt(page);
  step.check(moved.target > 0 && near(moved.progress, moved.target, 1e-4), `wheel events on the freshly loaded / move frame.progress (target ${moved.target}, progress ${moved.progress})`);
  await page.keyboard.press('Home');
  await restAt(page);

  // The canvas renders on demand: once the home's idle motion is over, only the storm asks for frames, at its own gentle
  // pace (spec 2026-10-30-bob-storm-design.md); the pointer wakes the rest.
  const slept = await settlesToStorm(page, SLEEP_WITHIN_MS);
  step.check(slept !== null, `an idle page draws the storm alone: no more than ${STORM_FPS_MAX} frames a second for 1 s, from ${slept} ms after the last input (limit ${SLEEP_WITHIN_MS} ms)`);
  const before = await page.evaluate(() => window.__allRaf);
  await page.mouse.move(980, 320, { steps: 4 });
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => window.__allRaf);
  step.check(after > before, `a pointer move wakes the canvas (${after - before} frames asked for in 300 ms)`);

  // Over a page of text a mouse idling about wakes only the parallax, about a second, never the home's 12 s idle.
  await page.focus('.home-nav a[href="/projects/steady/"]');
  await page.keyboard.press('Enter');
  await page.waitForURL((url) => url.pathname === '/projects/steady/', { timeout: 5_000 });
  const settled = await sleepWithin(page, SLEEP_WITHIN_MS); // the phase change's own while first
  const wiggleFrom = await page.evaluate(() => window.__allRaf);
  for (const [x, y] of [[400, 300], [460, 340], [520, 300], [480, 360]]) await page.mouse.move(x, y, { steps: 3 });
  const woke = (await page.evaluate(() => window.__allRaf)) > wiggleFrom;
  // sleepWithin asks for a whole quiet second, so a limit of RESETTLE_MS + 1 s means quiet from at most RESETTLE_MS on.
  const RESETTLE_MS = 3_000;
  const resettled = await sleepWithin(page, RESETTLE_MS + 1_000);
  step.check(
    settled !== null && woke && resettled !== null,
    `on /projects/steady/ a mouse wiggle wakes the parallax only: the canvas falls quiet ${resettled} ms after it and stays so for 1 s (it must fall quiet within ${RESETTLE_MS} ms; the home's idle is ${IDLE_SECONDS} s)`,
  );
  await takeCsp(page, step);
  await context.close();

  // A choice the header's 3D switch stored before it went (2026-10-29) is not read: 3D on, the Stage mounts, no card.
  const old = await openPage(browser, step);
  await old.context.addInitScript(() => localStorage.setItem('needle-3d', 'off'));
  await old.page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  const oldAt = await reachHomeIdle(old.page);
  await old.page.waitForTimeout(500);
  const on = await old.page.evaluate(() => ({
    threeD: document.documentElement.dataset['3d'],
    mounts: window.__needleDebug?.().canvasMounts ?? 0,
    canvases: document.querySelectorAll('canvas').length,
    card: document.querySelector('.scene-fallback') !== null,
  }));
  step.check(on.threeD === 'on' && on.mounts === 1 && on.canvases === 1 && !on.card, `with needle-3d = off stored from before: HOME_IDLE after ${oldAt} ms with 3D on, one Stage, one <canvas>, no card (got ${JSON.stringify(on)})`);
  await takeCsp(old.page, step);
  await old.context.close();
  return `LOADING → HOME_IDLE in ${at} ms on a direct load, the wheel moves the story, the canvas draws the storm alone ${slept} ms after the last input and wakes on the pointer; a stored "off" from before: 3D on, HOME_IDLE in ${oldAt} ms`;
}

/**
 * The policy is in force, not only unbroken: every other step proves no violation happens, this one that a violation
 * is caught. On a page with a scene and one without, after hydration, an inline <script> is injected and an inline
 * event handler (an <img onerror>, on an image that cannot decode) is added: neither runs, and the page reports a
 * `securitypolicyviolation` for each (script-src-elem, script-src-attr). The browser's console refusal for each is the
 * expected outcome, counted, not an error.
 */
async function cspEnforced(browser, step) {
  const refused = (message) => /Content Security Policy/i.test(message.text());
  const summary = [];
  for (const path of ['/', '/lite/']) {
    const { context, page } = await openPage(browser, step, refused);
    await page.goto(`${BASE}${path}?proof`, { waitUntil: 'load' });
    await pageReady(page, path);
    await takeCsp(page, step); // the page's own load: no violation
    const before = step.expected.length;
    await page.evaluate(() => {
      const script = document.createElement('script');
      script.textContent = 'window.__injectedRan = true;';
      document.body.append(script);
      document.body.insertAdjacentHTML('beforeend', '<img alt="" src="data:image/png;base64,AAAA" onerror="window.__handlerRan = true">');
    });
    await page.waitForFunction(() => window.__cspViolations.length >= 2, null, { timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(300);
    const caught = await page.evaluate(() => ({
      ran: { script: window.__injectedRan === true, handler: window.__handlerRan === true },
      violations: window.__cspViolations.splice(0).map((v) => `${v.directive} ${v.blocked}`),
    }));
    step.check(!caught.ran.script && !caught.ran.handler, `${path}: an injected inline script and an inline handler do not run (got ${JSON.stringify(caught.ran)})`);
    step.check(
      caught.violations.some((v) => v.startsWith('script-src-elem inline')) && caught.violations.some((v) => v.startsWith('script-src-attr inline')),
      `${path}: the page reports both as policy violations (got ${caught.violations.join(', ') || 'none'})`,
    );
    step.check(step.expected.length - before === caught.violations.length, `${path}: the browser's console refused each once (got ${step.expected.length - before} for ${caught.violations.length} violations)`);
    summary.push(`${path} ${caught.violations.join(', ')}`);
    await context.close();
  }
  return `the policy refuses what it should: ${summary.join('; ')}`;
}

/** The pages of text alone a visit can begin on, in both languages: Lite and contact. */
const SCENELESS = PAGES.filter((p) => !p.scene).map((p) => p.path);

/**
 * Lite is the light version, and every page without a scene with it. A visit that begins on one fetches
 * none of the scene's files (the Stage chunk, three.js, maath, the textures), mounts no <canvas>, probes no WebGL and
 * shows no fallback card, and still leaves LOADING, with 3D left on. A canvas that came from the home page by client
 * navigation stays (one Stage, the same <canvas>) and sleeps behind the page: no requestAnimationFrame at all while the
 * mouse moves over it for 1.5 s. Back on the home page, the pointer wakes it again.
 */
async function noScene(browser, step) {
  for (const path of SCENELESS) {
    const { context, page } = await openPage(browser, step);
    const scenery = sceneRequests(page);
    await page.goto(`${BASE}${path}?proof`, { waitUntil: 'load' });
    const left = await page.waitForFunction(() => window.__needleDebug?.().phase.kind === 'HOME_IDLE', null, { timeout: 5_000 }).then(() => true, () => false);
    await page.mouse.move(400, 300);
    await page.mouse.move(700, 500, { steps: 5 });
    await page.waitForTimeout(1_500); // a Stage on its way would have asked for its chunk by now
    const state = await page.evaluate(() => ({
      canvases: document.querySelectorAll('canvas').length,
      mounts: window.__needleDebug?.().canvasMounts ?? null,
      webgl: document.querySelector('.scene-host')?.getAttribute('data-webgl') ?? null,
      card: document.querySelector('.scene-fallback') !== null,
      threeD: document.documentElement.dataset['3d'],
      phase: window.__needleDebug?.().phase.kind ?? null,
    }));
    step.check(scenery.length === 0, `${path}: a direct load asks for none of the scene's files (got ${scenery.join(' ') || 'none'})`);
    step.check(state.canvases === 0 && state.mounts === 0 && state.webgl === null, `${path}: no <canvas>, no Stage, no WebGL probe (got ${JSON.stringify(state)})`);
    step.check(left && state.phase === 'HOME_IDLE' && !state.card && state.threeD === 'on', `${path}: out of LOADING, no fallback card, 3D still on (got ${JSON.stringify(state)})`);
    await takeCsp(page, step);
    await context.close();
  }

  // From the home page to a page without a scene by client navigation: the canvas stays, and sleeps there.
  const { context, page } = await openPage(browser, step);
  await countAllFrames(context);
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await page.bringToFront();
  await reachHomeIdle(page);
  await page.waitForFunction(() => document.querySelector('.scene-host')?.hasAttribute('data-ready'), null, { timeout: LOAD_TIMEOUT_MS + 3_000 });
  await page.evaluate(() => {
    document.querySelector('.scene-host canvas').dataset.id = 'home-canvas';
  });
  await page.mouse.move(700, 400, { steps: 4 }); // the parallax and the needle are moving as the visitor leaves
  // The header's Contact, a page without a scene (its links to the light version, Work and About went, 2026-10-29 and 30).
  await page.click('.site-header a[href="/contact/"]');
  await page.waitForURL((url) => url.pathname === '/contact/', { timeout: 5_000 });
  await page.waitForTimeout(300); // the frame already asked for when the page changed runs
  const from = await page.evaluate(() => window.__allRaf);
  for (let i = 0; i < 15; i++) {
    await page.mouse.move(300 + ((i * 53) % 700), 200 + ((i * 37) % 500), { steps: 3 });
    await page.waitForTimeout(100);
  }
  const slept = (await page.evaluate(() => window.__allRaf)) - from;
  const kept = await page.evaluate(() => ({
    mounts: window.__needleDebug().canvasMounts,
    canvases: document.querySelectorAll('canvas').length,
    tag: document.querySelector('.scene-host canvas')?.dataset.id ?? null,
    route: window.__needleDebug().route,
  }));
  step.check(kept.route === 'contact' && kept.mounts === 1 && kept.canvases === 1 && kept.tag === 'home-canvas', `home → contact by client navigation: one Stage, the same <canvas> (got ${JSON.stringify(kept)})`);
  step.check(slept === 0, `on the contact page the canvas sleeps: no requestAnimationFrame in 1.5 s of the mouse moving over the page (got ${slept})`);

  // Scrolling, resizing and a font arriving on Lite wake nothing either (Task 14b, fix 1): Home stays mounted behind a
  // page without a scene, and its layout listeners must not ask for frames there. The page scrolled for real, by wheel
  // and by script; then the window's `resize` and the fonts' `loadingdone` sent as the browser sends them but with no
  // change of size, so only the page's own listeners can answer; then a real resize, which redraws the canvas once at
  // its new size (R3F's store and the Rig frame a new size: a wake the Heartbeat's contract names) and sleeps again.
  const frames = () => page.evaluate(() => window.__allRaf);
  let at = await frames();
  for (let i = 0; i < 10; i++) {
    await page.mouse.wheel(0, 240);
    await page.waitForTimeout(100);
  }
  for (let i = 0; i < 5; i++) {
    await page.evaluate((y) => window.scrollTo(0, y), 300 * i);
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(300);
  const scrolled = { frames: (await frames()) - at, moved: await page.evaluate(() => window.scrollY > 0) };
  at = await frames();
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => {
      window.dispatchEvent(new Event('resize'));
      document.fonts.dispatchEvent(new Event('loadingdone'));
    });
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(300);
  const nudged = (await frames()) - at;
  const viewport = page.viewportSize();
  at = await frames();
  await page.setViewportSize({ width: viewport.width - 160, height: viewport.height - 100 });
  await page.waitForTimeout(500);
  const resized = (await frames()) - at;
  at = await frames();
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel(0, -240);
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(500);
  const after = (await frames()) - at;
  step.check(scrolled.moved && scrolled.frames === 0, `on Lite scrolling (10 wheel turns, 5 scrollTo) asks for no frame (got ${scrolled.frames}, scrolled ${scrolled.moved})`);
  step.check(nudged === 0, `on Lite the window's resize event and the fonts' loadingdone, with no change of size, ask for no frame (got ${nudged})`);
  step.check(resized <= 2 && after === 0, `on Lite a real resize redraws the canvas once at its new size and it sleeps again: no frame in the scrolling after (got ${resized}, then ${after})`);
  await page.setViewportSize(viewport);
  await page.waitForTimeout(500);

  // Back on the home page the scene is shown again, and the pointer wakes it.
  await page.click('.site-header a.site-name');
  await page.waitForURL(`${BASE}/`, { timeout: 5_000 });
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => window.__allRaf);
  await page.mouse.move(900, 300, { steps: 4 });
  await page.waitForTimeout(300);
  const woke = (await page.evaluate(() => window.__allRaf)) - before;
  step.check(woke > 0, `back on the home page the pointer wakes the canvas again (${woke} frames asked for in 300 ms)`);
  await takeCsp(page, step);
  await context.close();
  return `${SCENELESS.join(', ')}: no scene file, no canvas, out of LOADING; home → Lite keeps the one canvas asleep (0 frames through mouse moves, scrolling, resize and font events; one redraw for a real resize), and home wakes it`;
}

/** A token's `#rrggbb` as the computed style writes the colour (`rgb(r, g, b)`); anything else as it is. */
const rgbOf = (hex) => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex ?? '');
  return m ? `rgb(${m.slice(1).map((h) => parseInt(h, 16)).join(', ')})` : hex;
};

async function noWebglOne(browser, step, label, expected) {
  const summary = [];
  for (const lang of ['nl', 'en']) {
    const { context, page } = await openPage(browser, step);
    const path = lang === 'nl' ? '/' : '/en/';
    const { t } = new Translator(lang);
    await page.goto(`${BASE}${path}?proof`, { waitUntil: 'load' });
    const card = await page.waitForSelector('.scene-fallback', { timeout: 10_000 }).then(() => true, () => false);
    step.check(card, `${label}, ${path}: the fallback card shows`);
    await page.waitForTimeout(1_000); // a Stage mounted by mistake would have its canvas by now
    const state = await page.evaluate(() => ({
      title: document.querySelector('.scene-fallback-title')?.textContent ?? null,
      link: document.querySelector('.scene-fallback a')?.getAttribute('href') ?? null,
      linkText: document.querySelector('.scene-fallback a')?.textContent ?? null,
      role: document.querySelector('.scene-fallback')?.getAttribute('role') ?? null,
      canvases: document.querySelectorAll('canvas').length,
      mounts: window.__needleDebug?.().canvasMounts ?? 0,
      webgl: document.querySelector('.scene-host')?.getAttribute('data-webgl') ?? null,
      threeD: document.documentElement.dataset['3d'],
      stored: localStorage.getItem('needle-3d'),
      overflow: getComputedStyle(document.documentElement).overflow,
      nav: document.querySelector('.home-nav')?.getBoundingClientRect().height ?? 0,
      poster: (() => {
        const poster = document.querySelector('.poster');
        if (!poster) return null;
        const css = getComputedStyle(poster);
        const box = poster.getBoundingClientRect();
        const { clientWidth, clientHeight } = document.documentElement;
        return {
          images: poster.querySelectorAll('img, picture, video').length,
          colour: css.backgroundColor,
          image: css.backgroundImage,
          night: getComputedStyle(document.documentElement).getPropertyValue('--night').trim(),
          covers: box.left === 0 && box.top === 0 && box.width === clientWidth && box.height === clientHeight,
          shown: css.display !== 'none' && css.visibility === 'visible' && css.opacity === '1',
        };
      })(),
      phase: window.__needleDebug?.().phase.kind ?? null,
    }));
    const lite = lang === 'nl' ? '/lite/' : '/en/lite/';
    step.check(state.title === t.needle.fallback.title, `${label}, ${path}: the card says "${t.needle.fallback.title}" (got ${state.title})`);
    step.check(state.link === lite && state.linkText === t.needle.fallback.lite && state.role === 'status', `${label}, ${path}: with a link to ${lite}, "${t.needle.fallback.lite}", as a status (got ${state.link}, ${state.linkText}, role ${state.role})`);
    step.check(state.canvases === 0 && state.mounts === 0, `${label}, ${path}: no <canvas> and no Stage (got ${state.canvases} canvas, ${state.mounts} mounts)`);
    step.check(state.webgl === expected, `${label}, ${path}: the probe found '${expected}' (got ${state.webgl})`);
    step.check(state.threeD === 'off' && state.stored === null, `${label}, ${path}: 3D off for the visit and nothing stored (data-3d ${state.threeD}, needle-3d ${state.stored})`);
    step.check(state.overflow === 'visible' && state.nav > 100, `${label}, ${path}: the page scrolls natively and the home page's links show (overflow ${state.overflow}, nav ${Math.round(state.nav)} px)`);
    const poster = state.poster;
    step.check(
      poster !== null && poster.images === 0 && poster.colour === rgbOf(poster.night) && /radial-gradient/.test(poster.image) && poster.covers && poster.shown,
      `${label}, ${path}: the poster is there, the CSS panel of the night (${poster?.night}) with its faint glow over the whole viewport, no image (got ${JSON.stringify(poster)})`,
    );
    step.check(state.phase === 'HOME_IDLE', `${label}, ${path}: the phase leaves LOADING (got ${state.phase})`);
    summary.push(`${path} "${state.title}"`);
    await takeCsp(page, step);
    await context.close();
  }
  return `${label}: ${summary.join(', ')}`;
}

/**
 * The scene's canvas read back through toDataURL in a frame callback right after the canvas drew (its drawing buffer is
 * not kept past the frame), at 96x54: its brightest channel (`max`) and the brightest channel on the compass's axis
 * (`axis`). The home camera stands on the compass's north-south line and looks at its centre (src/engine/bob/shots.ts),
 * so the axis is the picture's middle column; the pivot, the axis, the bands and the lit well lie on it between half way
 * and four fifths down. The pointer is moved first, so the scene is drawing; tried a few times. Answers null without a canvas.
 */
async function readCanvas(page) {
  let pixel = null;
  for (let attempt = 0; attempt < 5 && !(pixel && pixel.max > 60); attempt++) {
    await page.mouse.move(760 + attempt * 7, 440, { steps: 2 }); // keep it drawing
    pixel = await page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          requestAnimationFrame(() => {
            const canvas = document.querySelector('.scene-host canvas');
            if (!canvas) return resolve(null);
            const url = canvas.toDataURL('image/png');
            const image = new Image();
            image.onload = () => {
              const w = 96;
              const h = 54;
              const scratch = document.createElement('canvas');
              scratch.width = w;
              scratch.height = h;
              const ctx = scratch.getContext('2d');
              ctx.drawImage(image, 0, 0, w, h);
              const data = ctx.getImageData(0, 0, w, h).data;
              let max = 0;
              for (let i = 0; i < data.length; i += 4) max = Math.max(max, data[i], data[i + 1], data[i + 2]);
              let axis = 0;
              for (let row = Math.round(0.5 * h); row <= Math.round(0.8 * h); row++) {
                const k = (row * w + w / 2) * 4;
                axis = Math.max(axis, data[k], data[k + 1], data[k + 2]);
              }
              resolve({ max, axis });
            };
            image.onerror = () => reject(new Error('the data URL did not load'));
            image.src = url;
          });
        }),
    );
    if (pixel === null) return null;
  }
  return pixel;
}

/**
 * The canvas read back holds the scene: something bright (the engraving, the gilt) and the compass on its axis, well above
 * the night's own channels (palette.night, #040209: at most 9).
 */
const drawn = (pixel) => pixel !== null && pixel.max > 60 && pixel.axis > 30;

/** Loses the live canvas's WebGL context (WEBGL_lose_context); `restore` brings it back half a second later. */
const loseContext = (page, restore) =>
  page.evaluate(async (restore) => {
    const lose = document.querySelector('.scene-host canvas').getContext('webgl2').getExtension('WEBGL_lose_context');
    lose.loseContext();
    if (!restore) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
    lose.restoreContext();
  }, restore);

/** The scene's own failures, on the GPU: a context lost for good, a context that comes back, a scene that never loads. */
async function sceneFailures(browser, step) {
  const fellBack = async (page, what, within) => {
    const shown = await page.waitForSelector('.scene-fallback', { timeout: within }).then(() => true, () => false);
    const state = await page.evaluate(() => ({
      canvases: document.querySelectorAll('canvas').length,
      threeD: document.documentElement.dataset['3d'],
      stored: localStorage.getItem('needle-3d'),
      phase: window.__needleDebug?.().phase.kind ?? null,
    }));
    step.check(
      shown && state.canvases === 0 && state.threeD === 'off' && state.stored === null && state.phase === 'HOME_IDLE',
      `${what}: the fallback card within ${within} ms, no <canvas>, 3D off for the visit and not stored, out of LOADING (got ${JSON.stringify({ shown, ...state })})`,
    );
  };

  // A context lost for good: the card after RESTORE_TIMEOUT_MS. A reload tries again, with a new Stage (the header's
  // 3D switch, which tried again in place, went: 2026-10-29).
  {
    const { context, page } = await openPage(browser, step);
    await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
    await reachHomeIdle(page);
    await loseContext(page, false);
    await fellBack(page, 'a context lost for good', RESTORE_TIMEOUT_MS + 3_000);
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelector('.scene-host')?.hasAttribute('data-ready'), null, { timeout: LOAD_TIMEOUT_MS + 3_000 });
    const again = await page.evaluate(() => ({ mounts: window.__needleDebug?.().canvasMounts, card: document.querySelector('.scene-fallback') !== null, threeD: document.documentElement.dataset['3d'] }));
    step.check(again.mounts === 1 && !again.card && again.threeD === 'on', `a reload tries again: a new Stage draws and the card is gone (got ${JSON.stringify(again)})`);
    await takeCsp(page, step);
    await context.close();
  }

  // A context that comes back: the scene draws again, with no card.
  {
    const { context, page } = await openPage(browser, step);
    await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
    await page.bringToFront();
    await reachHomeIdle(page);
    await loseContext(page, true);
    await page.waitForFunction(() => window.__needleDebug?.().contextLost === false, null, { timeout: 5_000 });
    await page.waitForTimeout(RESTORE_TIMEOUT_MS + 500); // past the point where a context still lost would have failed it
    const pixel = await readCanvas(page);
    const card = await page.evaluate(() => document.querySelector('.scene-fallback') !== null);
    step.check(!card && drawn(pixel), `a restored context: no card, and the scene draws again (brightest ${pixel?.max}, on the compass's axis ${pixel?.axis})`);
    await takeCsp(page, step);
    await context.close();
  }

  // A scene that never arrives (its chunk never answers): the card after LOAD_TIMEOUT_MS.
  {
    const { context, page } = await openPage(browser, step);
    await page.route(STAGE_CHUNK, () => {}); // never fulfilled
    await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
    await fellBack(page, 'a scene that is never ready', LOAD_TIMEOUT_MS + 3_000);
    await takeCsp(page, step);
    await context.close();
  }
  return `a context lost for good, and a scene not ready in ${LOAD_TIMEOUT_MS / 1000} s, fall back to the card; a restored context draws again; a reload retries`;
}

async function noWebgl(browser, step) {
  const results = [];
  for (const [label, args, expected] of [
    ['WebGL off', NO_WEBGL, 'none'],
    ['software only', SOFTWARE_GL, 'software'],
  ]) {
    const own = await chromium.launch({ channel: 'msedge', headless: true, args });
    try {
      results.push(await noWebglOne(own, step, label, expected));
    } finally {
      await own.close();
    }
  }
  results.push(await sceneFailures(browser, step));
  return results.join('; ');
}

/**
 * Opens pages of `context` as a background tab: `document.visibilityState` is 'hidden' and requestAnimationFrame
 * callbacks are held, as a browser does for a tab that is not in front (headless Edge never hides a page itself).
 * `window.__toFront()` shows the page: 'visible', a `visibilitychange`, and the held callbacks run.
 */
const asBackgroundTab = (context) =>
  context.addInitScript(() => {
    const tab = { hidden: true, held: [], next: 1 };
    Object.defineProperty(Document.prototype, 'visibilityState', { configurable: true, get: () => (tab.hidden ? 'hidden' : 'visible') });
    Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get: () => tab.hidden });
    const raf = window.requestAnimationFrame.bind(window);
    const caf = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => {
      if (!tab.hidden) return raf(callback);
      const id = -tab.next++;
      tab.held.push([id, callback]);
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      if (id >= 0) return caf(id);
      const at = tab.held.findIndex(([held]) => held === id);
      if (at >= 0) tab.held.splice(at, 1);
    };
    window.__heldFrames = () => tab.held.length;
    window.__toFront = () => {
      tab.hidden = false;
      document.dispatchEvent(new Event('visibilitychange'));
      for (const [, callback] of tab.held.splice(0)) raf(callback);
    };
  });

/** A page opened in a background tab (a middle click) is not given up on while it waits there, however long. */
async function background(browser, step) {
  const { context, page } = await openPage(browser, step);
  await asBackgroundTab(context);
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await page.waitForTimeout(LOAD_TIMEOUT_MS + 2_000); // past the load timeout, all of it hidden
  const waiting = await page.evaluate(() => ({
    hidden: document.visibilityState,
    held: window.__heldFrames(),
    card: document.querySelector('.scene-fallback') !== null,
    threeD: document.documentElement.dataset['3d'],
    phase: window.__needleDebug?.().phase.kind ?? null,
  }));
  step.check(waiting.hidden === 'hidden' && waiting.held > 0, `the page waited in the background, its frames held (${JSON.stringify(waiting)})`);
  step.check(!waiting.card && waiting.threeD === 'on', `${(LOAD_TIMEOUT_MS + 2_000) / 1000} s in the background: no fallback card, 3D still on (got ${JSON.stringify(waiting)})`);
  await page.evaluate(() => window.__toFront());
  await page.bringToFront();
  const shownAt = Date.now();
  const reached = await reachHomeIdle(page).then(() => true, () => false);
  const after = await page.evaluate(() => ({
    phase: window.__needleDebug?.().phase.kind ?? null,
    ready: document.querySelector('.scene-host')?.hasAttribute('data-ready'),
    card: document.querySelector('.scene-fallback') !== null,
    threeD: document.documentElement.dataset['3d'],
    stored: localStorage.getItem('needle-3d'),
  }));
  step.check(
    reached && after.ready && !after.card && after.threeD === 'on' && after.stored === null,
    `brought to the front, the scene loads: HOME_IDLE ${Date.now() - shownAt} ms later, shown, 3D on, no card (got ${JSON.stringify(after)})`,
  );
  await takeCsp(page, step);
  await context.close();
  return `${(LOAD_TIMEOUT_MS + 2_000) / 1000} s in a background tab, then in front: the scene loads, no fallback`;
}

/**
 * Dutch text set in Unbounded with an IJ in it (the fallback card's KWIJT, any title): it is shaped with the font's
 * Dutch `locl` off, which would draw I + J as one glyph that reads as a U. Each such element is measured as shown, with
 * `locl` off and with it on; shown must equal off. Run without WebGL, so the NL card is on the home page.
 */
async function titleIj(_browser, step) {
  const own = await chromium.launch({ channel: 'msedge', headless: true, args: NO_WEBGL });
  const found = [];
  try {
    const { context, page } = await openPage(own, step);
    for (const { path, scene } of PAGES.filter((p) => p.lang === 'nl')) {
      await page.goto(BASE + path, { waitUntil: 'load' });
      // On a page with a scene the card is there once the probe has run: measure only after it is. A page without a
      // scene probes nothing and has no card: measure once it has hydrated.
      if (scene) await page.waitForSelector('.scene-fallback', { state: 'attached', timeout: 10_000 });
      else await pageReady(page, path);
      await page.evaluate(() => document.fonts.ready);
      const rows = await page.evaluate(() => {
        const measured = [];
        for (const element of document.querySelectorAll('body *')) {
          if (!/Unbounded/.test(getComputedStyle(element).fontFamily)) continue;
          const text = [...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent).join('');
          if (!/ij/i.test(text) || element.getBoundingClientRect().width === 0) continue;
          const width = (features) => {
            const clone = element.cloneNode(true);
            if (features !== null) clone.style.fontFeatureSettings = features;
            Object.assign(clone.style, { position: 'absolute', visibility: 'hidden', width: 'auto', maxWidth: 'none', whiteSpace: 'nowrap' });
            element.parentElement.append(clone);
            const w = clone.getBoundingClientRect().width;
            clone.remove();
            return w;
          };
          measured.push({ text: text.trim().slice(0, 48), lang: element.closest('[lang]')?.getAttribute('lang'), shown: width(null), off: width('"locl" 0'), on: width('normal') });
        }
        return measured;
      });
      for (const row of rows) found.push({ path, ...row });
      if (path === '/') {
        mkdirSync(STILLS, { recursive: true });
        await page.locator('.scene-fallback').screenshot({ path: join(STILLS, 'fallback-card-nl.png') });
      }
    }
    await takeCsp(page, step);
    await context.close();
  } finally {
    await own.close();
  }
  const card = found.find((row) => row.path === '/' && /KWIJT/i.test(row.text));
  step.check(card !== undefined, `the NL fallback title is among the Unbounded texts with an IJ (found ${found.length}: ${found.map((row) => `${row.path} "${row.text}"`).join(', ')})`);
  step.check(card !== undefined && Math.abs(card.on - card.off) > 1, `the check bites: with locl on, "${card?.text}" is ${card?.on.toFixed(1)} px, with it off ${card?.off.toFixed(1)} px`);
  for (const row of found) {
    step.check(Math.abs(row.shown - row.off) < 0.01, `${row.path} "${row.text}" (lang ${row.lang}) is shaped with locl off: ${row.shown.toFixed(2)} px shown, ${row.off.toFixed(2)} px off, ${row.on.toFixed(2)} px on`);
  }
  return `${found.length} Dutch Unbounded texts with an IJ, all shaped without the IJ digraph (card crop: ${join(STILLS, 'fallback-card-nl.png')})`;
}

/** The scrim's backgrounds of the poster and of the scene host on the page shown, as computed. */
const scrims = (page) =>
  page.evaluate(() => {
    const host = getComputedStyle(document.querySelector('.scene-host'), '::after');
    const poster = getComputedStyle(document.querySelector('.poster'), '::after');
    const alphas = (image) => [...image.matchAll(/rgba\([^)]*,\s*([\d.]+)\)/g)].map((m) => Number(m[1]));
    return {
      ready: document.querySelector('.scene-host').hasAttribute('data-ready'),
      content: host.content,
      opacity: host.opacity,
      host: host.backgroundImage,
      poster: poster.backgroundImage,
      least: Math.min(...alphas(host.backgroundImage)),
      posterLeast: Math.min(...alphas(poster.backgroundImage)),
      position: host.position,
      inset: [host.top, host.right, host.bottom, host.left].join(' '),
    };
  });

/**
 * Holds the Stage chunk's response until the answered `release()` is called, so the scene cannot become ready meanwhile:
 * a moment that is otherwise a race (the page's `load` against the scene's readiness) lasts as long as the harness needs.
 * Call it before the page navigates. `release()` lets the chunk through and takes the route down.
 */
async function holdStage(page) {
  let open = () => {};
  const gate = new Promise((resolve) => (open = resolve));
  const handler = async (route) => {
    await gate;
    await route.continue().catch(() => {}); // the page may have gone by now
  };
  await page.route(STAGE_CHUNK, handler);
  return async () => {
    open();
    await page.unroute(STAGE_CHUNK, handler);
  };
}

/** A page's file name stem from its path: its language, then the path with dashes: `nl-projects-steady`, `en-home`. */
const stillName = (path) => `${langOf(path)}-${path.replace(/^\/en(?=\/|$)/, '').split('/').filter(Boolean).join('-') || 'home'}`;

/** The home page, in either language; every other page is a page of text. */
const isHome = (path) => path === '/' || path === '/en/';

/**
 * Waits until the page's opening has landed: its loader stands at `home` (on the home page the phase is HOME_IDLE with
 * it; on a project page the route has left LOADING already and the opening lands under the page's scrim).
 * The first page of a context plays the whole loader; later ones in it take the quick path.
 */
const landed = (page) =>
  page.waitForFunction(() => window.__needleDebug?.().loader.stage === 'home', null, { timeout: LOAD_TIMEOUT_MS + LOADER.giveUp * 1000 });

/**
 * Stills of every page of pagePaths() that the build produced, with the live scene, at 1440x900 and 390x844 (a phone:
 * touch, coarse pointer, two device pixels), and of the fallback, into PROOF_DIR/m2/, named after the page: `nl-home-1440x900.png`,
 * `en-projects-steady-390x844.png`, `fallback-1440x900.png`. A page with a scene is taken once its opening has landed and the
 * hero (on the home page) has faded in; the fallback once its hero has.
 *
 * On a page of text the scene is under the same scrim as the poster: the scene host's ::after carries the poster's page
 * scrim over the whole canvas once the scene shows; the home page keeps the scene unveiled. Before the scene shows, only
 * the poster's own scrim is there: the Stage chunk is held (holdStage) while that is measured, so the scene cannot be
 * ready at the time, and then released.
 *
 * The light dive and the ring at both sizes, put there through the bridge: way frames 60, 121, 241 and 280
 * (`m2/light-<frame>-<size>.png`) and the ring at 0, 80 and 160 degrees (`m2/ring-<degrees>-<size>.png`), each gated by
 * LUMA_GATE as a home still, the page's text (the facts, the label, the skip button) masked from the floor.
 */
async function stills(browser, step) {
  const sizes = STILL_SIZES;
  const dir = STILLS;
  mkdirSync(dir, { recursive: true });
  const shots = [];
  for (const { width, height, options } of sizes) {
    const { context, page } = await openPage(browser, step, () => false, { width, height }, options);
    const scenery = sceneRequests(page);
    for (const { path, scene } of PAGES) {
      const text = !isHome(path);
      const at = `${path} at ${width}x${height}`;
      scenery.length = 0;
      if (!scene) {
        // A page of text alone (Lite, contact): no scene ever comes. The poster under the page's scrim is the picture.
        await page.goto(`${BASE}${path}?proof`, { waitUntil: 'load' });
        await page.bringToFront();
        await pageReady(page, path);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(1_200); // as long as a scene page is given to fade in: one would have come by now
        const plain = await scrims(page);
        const debug = await debugOf(page);
        const canvases = await page.locator('canvas').count();
        step.check(
          !plain.ready && canvases === 0 && debug?.canvasMounts === 0 && scenery.length === 0 && plain.posterLeast >= 0.5,
          `${at}: no scene loads (ready ${plain.ready}, ${canvases} canvas, ${debug?.canvasMounts} mounts, scene files ${scenery.join(' ') || 'none'}) and the poster carries the page's scrim (least alpha ${plain.posterLeast})`,
        );
        const file = join(dir, `${stillName(path)}-${width}x${height}.png`);
        await page.screenshot({ path: file });
        shots.push(file);
        await takeCsp(page, step);
        continue;
      }
      const release = text ? await holdStage(page) : async () => {};
      try {
        await page.goto(`${BASE}${path}?proof`, { waitUntil: 'load' });
        await page.bringToFront();
        if (text) {
          // While the scene is not there only the poster's scrim shows: the host's waits, invisible, for the scene.
          const loading = await scrims(page);
          step.check(
            !loading.ready && loading.opacity === '0' && loading.posterLeast >= 0.5,
            `${at}: while the scene loads only the poster's scrim shows, and it is the page's (ready ${loading.ready}, the host's opacity ${loading.opacity}, the poster's least alpha ${loading.posterLeast})`,
          );
        }
      } finally {
        await release();
      }
      await page.waitForFunction(() => document.querySelector('.scene-host')?.hasAttribute('data-ready'), null, { timeout: LOAD_TIMEOUT_MS + 3_000 });
      const arrived = await landed(page).then(() => true, () => false);
      step.check(arrived, `${at}: the opening lands (loader ${JSON.stringify((await debugOf(page))?.loader)})`);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1_200); // the canvas's and the scrim's fade-in, and the hero's after the landing
      // On the home, a project page left for it fades out with its scrim for 0.4 s (.page-ghost): wait for
      // that to be over before asking whether the home keeps the scene unveiled (at most 2 s; at once on a direct load).
      if (!text) await page.waitForFunction(() => !document.querySelector('.page-ghost'), null, { timeout: 2_000 }).catch(() => {});
      const scrim = await scrims(page);
      if (text) {
        step.check(
          scrim.content !== 'none' && scrim.opacity === '1' && scrim.position === 'absolute' && scrim.inset === '0px 0px 0px 0px' && scrim.host === scrim.poster && scrim.least >= 0.5,
          `${at}: the shown scene is under the page scrim, the poster's own, fully (opacity ${scrim.opacity}; ${scrim.host}; least alpha ${scrim.least})`,
        );
      } else {
        step.check(scrim.content === 'none', `${at}: the home page keeps the scene unveiled (::after content ${scrim.content})`);
      }
      const debug = await debugOf(page);
      step.check(debug !== null && debug.canvasMounts === 1 && !debug.contextLost && debug.threeD, `${at}: one Stage, its context there, 3D on (got ${JSON.stringify(debug && { mounts: debug.canvasMounts, lost: debug.contextLost, threeD: debug.threeD })})`);
      const file = join(dir, `${stillName(path)}-${width}x${height}.png`);
      await page.screenshot({ path: file });
      shots.push(file);
      await takeCsp(page, step);
    }
    await context.close();
  }
  // The light dive, the path's stops, the look back and the Q&A's end, through the luma gate: the scene's with the page's
  // text masked.
  const gated = [];
  for (const size of sizes) {
    const at = sizeName(size);
    const { context, page, touch } = await readyHome(browser, step, size);
    const places = [
      ...[32, 60, 121, 241].map((frame) => ({ name: `light-${frame}`, progress: placeOfFrame(frame) })),
      ...PROJECT_LIST.map((bead) => ({ name: `area-${bead.id}`, progress: bead.stop })),
      { name: 'look-back', progress: LOOK_STOP },
      // The end once its dark is up and its circle drawn (3 s; spec 2026-10-29-bob-stack-3-design.md, goal 4): the scene
      // lies under the dark on purpose, so its floor is met by the circle, read on a phone where it stands, above the words;
      // that the scene draws is the other stills' to show.
      { name: 'qa-end', progress: STORY_END, wait: 3_400, ...(touch ? { region: { x: [0.1, 0.9], y: [0.12, 0.5] } } : {}) },
    ];
    for (const place of places) {
      await poseAt(page, place.progress);
      await page.waitForTimeout(place.wait ?? (place.whole ? 900 : 500));
      const file = join(dir, `${place.name}-${at}.png`);
      await page.screenshot({ path: file });
      gated.push({ file, kind: place.kind ?? 'home', mask: place.whole ? null : await textMask(page), ...(place.region ? { region: place.region } : {}) });
    }
    await takeCsp(page, step);
    await context.close();
  }
  const rows = await gateLuma(browser, step, gated);
  step.luma = rows;
  const own = await chromium.launch({ channel: 'msedge', headless: true, args: NO_WEBGL });
  try {
    for (const { width, height, options } of sizes) {
      const { context, page } = await openPage(own, step, () => false, { width, height }, options);
      await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
      await page.waitForSelector('.scene-fallback', { timeout: 10_000 });
      await page.evaluate(() => document.fonts.ready);
      // The hero fades in once the phase leaves LOADING: the still is of it whole, not half way.
      const hero = await page.waitForFunction(() => getComputedStyle(document.querySelector('.hero')).opacity === '1', null, { timeout: 5_000 }).then(() => true, () => false);
      step.check(hero, `the fallback at ${width}x${height}: the hero is shown whole`);
      const file = join(dir, `fallback-${width}x${height}.png`);
      await page.screenshot({ path: file });
      shots.push(file);
      await takeCsp(page, step);
      await context.close();
    }
  } finally {
    await own.close();
  }
  step.check(shots.length === PAGES.length * sizes.length + sizes.length, `${shots.length} stills: ${PAGES.length} pages at ${sizes.length} sizes, and the fallback at each`);
  console.log(`note: stills (${shots.length}) in ${dir}`);
  return `${shots.length} stills in ${dir}: ${PAGES.length} pages at 1440x900 and 390x844 once landed, the fallback; the page scrim over the scene on every page of text; ${rows.length} stills of the light dive, the path's stops, the look back and the Q&A's end, ${lumaSummary(rows, 'home')}`;
}

/**
 * The call in the opening's load that the `load-throw` step makes throw: the four painted band strips uploaded to the
 * GPU (`gl.initTexture`, in `uploadTextures`, src/scene/bob/warm.ts, the scene's one upload, which the Opening's load
 * calls first, src/scene/bob/Opening.tsx; the Void's textures go through it later), which runs only after the loader is
 * shown, the strips are painted and the compass is built from its file. It is a property call, so minifying keeps its name (three's own
 * definition of it lives in the three chunk, not the Stage's); the step fails if the built Stage chunk has it other
 * than once.
 */
const LOAD_THROW_AT = '.initTexture(';
const LOAD_THROW_MESSAGE = 'load-throw: the proof makes the compass load throw';

/**
 * A throw inside the opening's real load fails the scene: the real Stage chunk is served with that one call patched
 * to throw (no fault hook in the site). Expected: the fallback card, 3D off for the visit and not stored, LOADED
 * (HOME_IDLE), no `data-ready` and no canvas, all well inside the load timeout, and exactly one console error: the
 * host's own report of the failure.
 */
async function loadThrow(browser, step) {
  const reported = (message) => /^\[needle\] the compass load failed; showing the poster/.test(message.text());
  const { context, page } = await openPage(browser, step, reported);
  let patched = 0;
  let found = -1;
  await page.route(STAGE_CHUNK, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    found = body.split(LOAD_THROW_AT).length - 1;
    patched++;
    await route.fulfill({
      response,
      body: body.replace(LOAD_THROW_AT, `${LOAD_THROW_AT}(() => { throw new Error(${JSON.stringify(LOAD_THROW_MESSAGE)}); })(), `),
    });
  });
  const started = Date.now();
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  const card = await page.waitForSelector('.scene-fallback', { timeout: LOAD_TIMEOUT_MS / 2 }).then(() => true, () => false);
  const tookMs = Date.now() - started;
  await page.waitForTimeout(500); // anything late (a scene shown after all, a second report) would be here by now
  const state = await page.evaluate(() => ({
    title: document.querySelector('.scene-fallback-title')?.textContent ?? null,
    threeD: document.documentElement.dataset['3d'],
    stored: localStorage.getItem('needle-3d'),
    phase: window.__needleDebug?.().phase.kind ?? null,
    ready: document.querySelector('.scene-host')?.hasAttribute('data-ready') ?? null,
    canvases: document.querySelectorAll('canvas').length,
    mounts: window.__needleDebug?.().canvasMounts ?? 0,
  }));
  step.check(patched === 1 && found === 1, `the real Stage chunk was served with its one "${LOAD_THROW_AT}" call made to throw (served ${patched}, call found ${found} times)`);
  step.check(card, `a throwing load shows the fallback card, ${tookMs} ms after the page started (well inside the ${LOAD_TIMEOUT_MS / 1000} s load timeout: the throw, not the timer)`);
  step.check(state.threeD === 'off' && state.stored === null, `3D off for the visit, the stored choice untouched (data-3d ${state.threeD}, needle-3d ${state.stored})`);
  step.check(state.phase === 'HOME_IDLE', `LOADED was dispatched: the phase is HOME_IDLE (got ${state.phase})`);
  step.check(state.ready === false && state.canvases === 0 && state.mounts === 1, `no partial scene: no data-ready, the Stage that mounted is gone with its canvas (ready ${state.ready}, ${state.canvases} canvas, ${state.mounts} mount)`);
  step.check(
    step.expected.length === 1 && step.expected[0].includes(LOAD_THROW_MESSAGE),
    `exactly one console error, the host's report of the failed load with the thrown error (got ${step.expected.length}: ${step.expected.map((text) => text.split('\n')[0]).join(' | ')})`,
  );
  await takeCsp(page, step);
  await context.close();
  return `a throw inside the opening's load (${LOAD_THROW_AT}): the card in ${tookMs} ms, 3D off and not stored, HOME_IDLE, no partial scene, one reported error`;
}

async function fps(browser, step) {
  const { context, page } = await openPage(browser, step);
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await page.bringToFront(); // a page in the background has its frames throttled
  await reachHomeIdle(page);
  await page.waitForTimeout(3_000);
  // The scene draws while the home's idle motion runs; a pointer move stirs it (and the parallax) again.
  await page.mouse.move(700, 420);
  await page.mouse.move(760, 440, { steps: 6 });
  const times = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const seen = [];
        const tick = (now) => {
          seen.push(now);
          if (seen.length < 121) requestAnimationFrame(tick);
          else resolve(seen);
        };
        requestAnimationFrame(tick);
      }),
  );
  const span = times[times.length - 1] - times[0];
  const mean = Math.round((120 / span) * 1000 * 10) / 10;
  const pixel = await readCanvas(page);
  step.check(drawn(pixel), `the canvas holds the scene: read back through toDataURL, its brightest channel is ${pixel?.max}, ${pixel?.axis} on the compass's axis`);
  step.check(Number.isFinite(mean) && mean > 0, `120 frames sampled over ${Math.round(span)} ms`);

  // The site's own meter (window.__needleDebug().fps, a rolling mean over the last 60 frames the canvas drew) and what
  // else the bridge reports of the canvas. Reported, not gated, except that they are there.
  const debug = await debugOf(page);
  step.check(debug !== null && debug.fps > 0, `the bridge reports the canvas's own rolling fps (got ${debug?.fps})`);
  step.check(debug !== null && debug.dpr >= 1 && debug.dpr <= 1.75, `and its pixel ratio, within the ladder's 1 to 1.75 (got ${debug?.dpr})`);
  step.check(debug !== null && debug.camera.fov > 0 && debug.camera.position.every(Number.isFinite), `and its camera (got ${JSON.stringify(debug?.camera)})`);
  step.check(debug !== null && ['high', 'medium', 'low'].includes(debug.tier), `and the quality tier (got ${debug?.tier})`);
  console.log(`note: fps on / at 1440x900 (GPU): mean ${mean} over 120 frames (${Math.round(span)} ms); the scene's own meter ${debug?.fps?.toFixed(1)} fps, dpr ${debug?.dpr}, tier ${debug?.tier}`);
  step.fps = mean;
  step.rollingFps = debug?.fps ?? null;
  step.quality = debug ? { tier: debug.tier, dpr: debug.dpr } : null;
  await takeCsp(page, step);
  await context.close();
  return `mean ${mean} fps over 120 frames (the scene's own meter ${debug?.fps?.toFixed(1)}), tier ${debug?.tier}, dpr ${debug?.dpr}, the canvas is not blank (brightest ${pixel?.max})`;
}

// ---------------------------------------------------------------- the BOB opening, the dark look, the aim, the hero

/**
 * The opening's five moments for the stills: the loader's clock held at each (`seekLoader`: the full show of a load that
 * had landed from the start), the stage each must show and what the moment is, against the preview's stills
 * (tools/blender/bob_animate_o.py; src/engine/bob/loaderTimeline.ts, SCRIPT). The show is 6.25 s and cuts the circle
 * alone: black with the probe coming down, half the circle cut, the iris opening, the compass rising, and the home it
 * lands on. The stages are those of SCRIPT's frames: `dark` to frame 26 (1.08 s), `engrave` to frame 74 (3.08 s, the
 * circle closed), `open` to frame 88 (3.67 s), `rise` to the home.
 */
const LOADER_MOMENTS = [
  { seconds: 0.5, stage: 'dark', what: 'black, the probe coming down' },
  { seconds: 50 / 24, stage: 'engrave', what: 'half the circle' },
  { seconds: 3.6, stage: 'open', what: 'the iris' },
  { seconds: 4.6, stage: 'rise', what: 'the rise' },
  { seconds: SCRIPT.home, stage: 'home', what: 'home' },
];

/**
 * The marks of a loader state are in STROKE_ORDER (the left B, its bar, the right B, its bar, the circle). The loader
 * cuts the circle alone: the last runs from 0 to 1 and the four before it are always 0.
 */
const CIRCLE_MARK = 4;

/** How much of the circle a loader state has cut, 0 to 1. */
const circleOf = (loader) => loader?.strokes?.[CIRCLE_MARK] ?? 0;

/** How much of anything else a loader state has cut, the four B marks summed: 0 at every moment of every path. */
const othersOf = (loader) => (loader?.strokes ?? []).reduce((sum, share, mark) => (mark === CIRCLE_MARK ? sum : sum + share), 0);

/** True when the loader state has the circle cut whole and nothing else cut: five marks, the last 1, the rest 0. */
const circleWhole = (loader) => loader?.strokes?.length === 5 && circleOf(loader) === 1 && othersOf(loader) === 0;

/**
 * How far into the full show the skip steps act, s: inside the circle's cut (SCRIPT.circle: 1.08 to 3.08 s), so the
 * stage is `engrave` and the circle part cut. (The old 3 s is past the circle's close at 3.08 s.)
 */
const CUT_AT = 1.5;

/** How far past CUT_AT a step may find the clock when it looks, s: the stage is `engrave` until 3.08 s. */
const CUT_WITHIN = 0.3;

/**
 * Holds the opening's clock at `seconds` through the bridge (`seekLoader`; -1 lets go) and waits until the scene has
 * drawn that moment: the bridge reports it (the held seconds, or the live clock at home again), then a few frames go
 * by. Answers `loader` as the bridge then reports it. Seek only after HOME_IDLE: the real load is done by then.
 */
async function seekLoader(page, seconds) {
  await page.evaluate((s) => window.__needleDebug.seekLoader(s), seconds);
  if (seconds >= 0) await page.waitForFunction((s) => window.__needleDebug().loader.elapsed === s, seconds, { timeout: 5_000 });
  else await page.waitForFunction(() => window.__needleDebug().loader.stage === 'home', null, { timeout: 5_000 });
  await page.waitForTimeout(400); // the held moment drawn through the post chain
  return (await debugOf(page)).loader;
}

/**
 * The loader stills of this run, once taken: `loader-stills` takes them, `home-look` gates their luminance (and, run
 * without `loader-stills`, takes them itself first).
 */
let loaderShots = null;

/**
 * At each still size, in a fresh context: `/?proof` loaded and landed (HOME_IDLE, so the real load is done), then the
 * opening's clock held at each of LOADER_MOMENTS, its `loader.stage` checked and a still taken into
 * `m2/loader-<n>-<size>.png`; then let go. The phase stays HOME_IDLE throughout (a seek holds the clock, not the phase), so the page would show the
 * hero and the header over the held loader, which no visitor sees: while the clock is held the harness sets
 * `<html data-loading>`, the page's own mark of a playing opening, which hides them as it does while the phase is
 * LOADING, and checks that the header is gone, so the stills show no text but the engraving. The last moment is the
 * home itself, so it is taken with the header shown, as the visitor sees it land. Answers the stills.
 */
async function takeLoaderStills(browser, step) {
  if (loaderShots) return loaderShots;
  mkdirSync(STILLS, { recursive: true });
  const shots = [];
  for (const size of STILL_SIZES) {
    const at = sizeName(size);
    const { context, page } = await openPage(browser, step, () => false, { width: size.width, height: size.height }, size.options);
    await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
    await page.bringToFront();
    await reachHomeIdle(page);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => document.documentElement.setAttribute('data-loading', ''));
    const hidden = await page.evaluate(() => ({ header: getComputedStyle(document.querySelector('.site-header')).opacity, hero: getComputedStyle(document.querySelector('.hero')).opacity }));
    step.check(hidden.header === '0' && hidden.hero === '0', `${at}: under <html data-loading> the header and the hero are hidden, so the loader shows no text but the engraving (opacity ${hidden.header}, ${hidden.hero})`);
    for (const [index, { seconds, stage, what }] of LOADER_MOMENTS.entries()) {
      // The home is the home as it lands: the header back (it fades in over 0.9 s).
      if (stage === 'home') {
        await page.evaluate(() => document.documentElement.removeAttribute('data-loading'));
        await page.waitForTimeout(1_000);
      }
      const loader = await seekLoader(page, seconds);
      const phase = (await debugOf(page)).phase.kind;
      step.check(
        loader.stage === stage && phase === 'HOME_IDLE',
        `${at}: the clock held at ${seconds.toFixed(2)} s (${what}) shows ${stage}, the phase still HOME_IDLE (got ${loader.stage}, circle cut ${circleOf(loader).toFixed(2)}, the B marks ${othersOf(loader)}, ${phase})`,
      );
      step.check(othersOf(loader) === 0, `${at}: at ${seconds.toFixed(2)} s no B mark is cut: the loader cuts the circle alone (got ${JSON.stringify(loader.strokes)})`);
      const file = join(STILLS, `loader-${index + 1}-${at}.png`);
      await page.screenshot({ path: file });
      shots.push({ file, size: at, seconds, what, stage: loader.stage, cut: circleOf(loader), kind: stage === 'home' ? 'home' : 'loader', dark: stage === 'dark' });
    }
    await page.evaluate(() => document.documentElement.removeAttribute('data-loading'));
    const back = await seekLoader(page, -1);
    const after = await debugOf(page);
    step.check(back.stage === 'home' && after.phase.kind === 'HOME_IDLE', `${at}: let go, the opening is back at home, HOME_IDLE (got ${back.stage}, ${after.phase.kind})`);
    await takeCsp(page, step);
    await context.close();
  }
  loaderShots = shots;
  return shots;
}

async function loaderStills(browser, step) {
  const shots = await takeLoaderStills(browser, step);
  console.log(`note: loader stills (${shots.length}) in ${STILLS}`);
  return `${shots.length} stills of the held opening in ${STILLS}: ${shots
    .filter((shot) => shot.size === sizeName(STILL_SIZES[0]))
    .map((shot) => `${shot.seconds.toFixed(2)} s ${shot.stage} (${shot.what}, circle cut ${shot.cut.toFixed(2)})`)
    .join(', ')}, at ${STILL_SIZES.map(sizeName).join(' and ')}`;
}

/**
 * The dark look's gate (spec §4, the plan's global constraints): the mean Rec. 709 luma of a home still and of a loader
 * still at most `home` and `loader`, and at most `clipped` of any still's pixels at luma `clip` or more. Only the look
 * may be turned down to pass it (src/scene/bob/look.ts's exposure, bloom and lights, the glass's, the compass's, the
 * engraving's and the smoke's looks), never these numbers.
 *
 * And its floor (Task 14b): dark but real, so a canvas that drew nothing cannot pass for a dark one. Every gated still's mean is above `floor.mean`, and at least one
 * pixel of the scene's middle (`floor.region`, shares of the still's width and height: below the hero's name and the
 * header, above the scroll cue, at both sizes) reaches `floor.peak`. The page's
 * own text is bright (the header, the hero), so a peak taken over the whole still would pass a canvas that drew
 * nothing; in the middle only the scene can make it. (The scene's black alone, the preview's, is a mean of about 0.001;
 * the page's night, which the poster shows, about 0.0115.)
 *
 * The one still that is black on purpose is the loader's first moment, `dark` (0.5 s: black, the probe coming down, a
 * thin wick at the top of the picture and the faint traces). It keeps the loader's ceiling and the clipped share, and
 * its floor is `darkPeak`: the brightest pixel of the whole still (the loader stills carry no page text: the hero and
 * the header are hidden while the clock is held) is the probe, at luma 0.2 or more (0.26 and 0.30 measured at the two
 * sizes), which a canvas that drew nothing cannot reach. The middle's floor does not apply: the probe is not there.
 *
 * A bead seen from inside is lit on purpose: its objects stand in the warm light under the glass. The approved light path
 * mock-up's insides measure up to 0.138 on a laptop (Steady's, the brightest), so they keep a ceiling of their own,
 * `inside`, a little above it; the clipped share and the floor are the home's.
 */
const LUMA_GATE = {
  home: 0.11,
  inside: 0.15,
  loader: 0.07,
  clip: 0.98,
  clipped: 0.004,
  floor: { mean: 0.002, peak: 0.3, region: { x: [0.15, 0.85], y: [0.48, 0.85] } },
  darkPeak: 0.2,
};

/**
 * How many home stills the gate takes at each size, a quarter of the needle's breath apart (src/scene/bob/look.ts,
 * BREATHE.period: its glow swells and falls 5 % either way over 4 s), all within the idle motion's IDLE_SECONDS: the gate
 * holds for the worst of them, so it sees the breath's peak and not one moment of it. The first is `m2/home-<size>.png`; the rest go to `m2/samples/`.
 */
const HOME_SAMPLES = 4;

/**
 * The luminance of a PNG, measured in `page` with no image library: the file as a data URL in an <img>, drawn on a
 * canvas at its own size and read back with getImageData. Luma is Rec. 709's weights on the stored sRGB values, 0..1:
 * `mean` over every pixel, `clipped`, the share of pixels at LUMA_GATE.clip or more, `peak`, the luma of the
 * brightest pixel in the scene's middle (LUMA_GATE.floor.region), and `peakAll`, the brightest pixel of the whole still.
 *
 * With a `mask` (`{ viewport: { width, height }, boxes: [{ left, top, right, bottom }] }`, the boxes in the page's CSS
 * pixels, as `getBoundingClientRect` gives them, the viewport the still was taken at), the pixels under the boxes are the
 * page's own text, not the scene: `peak` and `sceneMean` leave them out, so the floor (LUMA_GATE.floor) is the scene's. `mean`
 * and `clipped` still count the whole picture, as the visitor sees it, which is what the ceiling judges. `masked` is the
 * share of the picture under the boxes. Without a mask `sceneMean` is `mean` and `masked` is 0. A still whose scene stands
 * elsewhere (a phone's open project, its object above its words) names its own `region` for `peak`.
 */
async function lumaOf(page, file, mask = null, region = LUMA_GATE.floor.region) {
  const url = `data:image/png;base64,${readFileSync(file).toString('base64')}`;
  return page.evaluate(
    async ([url, clip, region, mask]) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(image, 0, 0);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // The mask, in the still's own pixels (a phone's still has two device pixels to a CSS pixel).
      const covered = new Uint8Array(canvas.width * canvas.height);
      if (mask !== null) {
        const scale = canvas.width / mask.viewport.width;
        for (const box of mask.boxes) {
          const bx0 = Math.max(0, Math.floor(box.left * scale));
          const bx1 = Math.min(canvas.width, Math.ceil(box.right * scale));
          const by0 = Math.max(0, Math.floor(box.top * scale));
          const by1 = Math.min(canvas.height, Math.ceil(box.bottom * scale));
          for (let py = by0; py < by1; py++) covered.fill(1, py * canvas.width + bx0, py * canvas.width + bx1);
        }
      }
      let sum = 0;
      let sceneSum = 0;
      let sceneCount = 0;
      let clipped = 0;
      let peak = 0;
      let peakAll = 0;
      const [x0, x1] = region.x.map((share) => Math.round(share * canvas.width));
      const [y0, y1] = region.y.map((share) => Math.round(share * canvas.height));
      for (let i = 0; i < data.length; i += 4) {
        const y = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
        sum += y;
        if (y >= clip) clipped++;
        if (y > peakAll) peakAll = y;
        const p = i / 4;
        if (covered[p] === 1) continue;
        sceneSum += y;
        sceneCount++;
        const px = p % canvas.width;
        const py = (p - px) / canvas.width;
        if (y > peak && px >= x0 && px < x1 && py >= y0 && py < y1) peak = y;
      }
      const pixels = data.length / 4;
      return { mean: sum / pixels, sceneMean: sceneCount > 0 ? sceneSum / sceneCount : 0, masked: 1 - sceneCount / pixels, clipped: clipped / pixels, peak, peakAll, width: canvas.width, height: canvas.height };
    },
    [url, LUMA_GATE.clip, region, mask],
  );
}

/**
 * The boxes of the page's own text in the picture, for `lumaOf`'s mask, as the page shows them now (CSS pixels, each
 * grown by 4 px for the glyphs' soft edges): the shown bead label, the home's nav where it is shown (not the 1 px box it
 * hides in with 3D on), the header, and the hero's visible text (its box is the whole screen, so it is its lines of text
 * that are taken, where they are not faded out or clipped away). The still's floor is then the scene's.
 */
const textMask = (page) =>
  page.evaluate(() => {
    const grow = 4;
    const boxes = [];
    const add = (el, by = grow) => {
      const box = el.getBoundingClientRect();
      // A hairline (the fact's line, a pixel tall) counts: its glow is around it.
      if (box.width > 0 && box.height > 0 && (box.width > 1 || box.height > 1)) boxes.push({ left: box.left - by, top: box.top - by, right: box.right + by, bottom: box.bottom + by });
    };
    // The header whole; the home's nav where it is shown (not the 1 px box it hides in with 3D on) by its lines of text,
    // its box reaching past them over the scene (with the void failed, over the light at the hold).
    for (const el of document.querySelectorAll('.site-header')) add(el);
    const nav = document.querySelector('.home-nav');
    if (nav !== null && nav.getBoundingClientRect().height > 1) for (const el of nav.querySelectorAll('h2, a, button')) add(el);
    // The world's words where they show: its names, the hint, an area's words, the dots, an open project's own page's
    // parts and its way back, and the Q&A's list (each question and the open reply) and the end's words.
    const showing = (el) => el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && Number(getComputedStyle(el).opacity) > 0.01;
    for (const el of document.querySelectorAll('.world-name, .world-hint, .area-caption, .area-dots, .project-view[data-shown] .pv-part, .pv-controls > *, .qa-answer:not([hidden]), .qa-ask, .qa-reply:not([hidden])')) {
      if (showing(el)) add(el);
    }
    // The light dive's shown fact (its words and its line, with their glow: fact 05 still fades out at the hand-over,
    // where the hold stands) and the skip button, where they show.
    for (const fact of document.querySelectorAll('.light-fact')) {
      if (Number(getComputedStyle(fact).opacity) > 0.01) for (const part of fact.querySelectorAll('.light-fact-words, .light-fact-line')) add(part, 16);
    }
    const skip = document.querySelector('.skip-button');
    if (skip && getComputedStyle(skip).visibility === 'visible') add(skip);
    const hero = document.querySelector('.hero');
    if (hero) {
      // A line of the hero's text counts where it can be seen: not faded out, and not inside a box clipped to a pixel.
      const clipped = (el) => {
        for (let e = el; e !== null && e !== hero.parentElement; e = e.parentElement) {
          const box = e.getBoundingClientRect();
          if (box.width <= 1 && box.height <= 1) return true;
        }
        return false;
      };
      const walker = document.createTreeWalker(hero, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        const parent = node.parentElement;
        if (!node.textContent.trim() || parent === null || clipped(parent) || !parent.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const box of range.getClientRects()) {
          if (box.width > 1 && box.height > 1) boxes.push({ left: box.left - grow, top: box.top - grow, right: box.right + grow, bottom: box.bottom + grow });
        }
      }
    }
    return { viewport: { width: window.innerWidth, height: window.innerHeight }, boxes };
  });

/**
 * Hides the scene's canvas for the length of `take`, which takes a still of the page without it (the poster's night and
 * the page's text), and puts the canvas back. Harness-only, as every step is: it is how the floor's negative control
 * is made. Answers what `take` answers.
 */
async function withoutCanvas(page, take) {
  await page.evaluate(() => {
    for (const canvas of document.querySelectorAll('.scene-host canvas')) canvas.style.display = 'none';
  });
  await page.waitForTimeout(300);
  try {
    return await take();
  } finally {
    await page.evaluate(() => {
      for (const canvas of document.querySelectorAll('.scene-host canvas')) canvas.style.display = '';
    });
    await page.waitForTimeout(300);
  }
}

/**
 * Measures each still in `shots` (`{ file, kind, dark?, mask? }`, kind `home` or `loader`; `dark` marks the loader's black
 * first moment; `mask` the boxes of the page's own text, `textMask`, which the floor leaves out so that it is the scene's)
 * in a page of its own context (no site page, so no policy of the site's stands between the data URL and
 * the canvas) and gates it by LUMA_GATE: its kind's ceiling, the clipped share, and the floor (the dark moment's own,
 * `darkPeak`). A shot of kind `control` is the floor's negative control, a still taken with the canvas hidden: it has no
 * ceiling, and its masked floor must FAIL, or the floor could not tell a scene from the page's text and its night.
 * Prints each still's numbers and answers their rows, for results.json.
 */
async function gateLuma(browser, step, shots) {
  const meter = await browser.newContext();
  const page = await meter.newPage();
  const percent = (share) => `${(share * 100).toFixed(3)} %`;
  const { floor } = LUMA_GATE;
  const rows = [];
  for (const shot of shots) {
    const name = shot.file.split(/[\\/]/).pop();
    const luma = await lumaOf(page, shot.file, shot.mask ?? null, shot.region);
    const limit = LUMA_GATE[shot.kind];
    const dark = shot.dark === true;
    const masked = shot.mask !== undefined;
    rows.push({
      still: name,
      kind: shot.kind,
      ...(dark ? { dark } : {}),
      mean: Number(luma.mean.toFixed(4)),
      ...(masked ? { sceneMean: Number(luma.sceneMean.toFixed(4)), masked: Number(luma.masked.toFixed(4)) } : {}),
      peak: Number(luma.peak.toFixed(3)),
      peakAll: Number(luma.peakAll.toFixed(3)),
      clipped: Number(luma.clipped.toFixed(6)),
      pixels: `${luma.width}x${luma.height}`,
    });
    const floorMean = masked ? luma.sceneMean : luma.mean;
    if (shot.kind === 'control') {
      // The negative control: the canvas hidden, the page's text masked: nothing of the scene is left, so the floor must fail.
      step.check(
        !(floorMean > floor.mean && luma.peak >= floor.peak),
        `${name}: negative control, the canvas hidden and the page's text masked (${percent(luma.masked)} of the still): the floor FAILS, as it must: the scene's mean ${floorMean.toFixed(4)} (floor ${floor.mean}), the brightest pixel of the scene's middle at luma ${luma.peak.toFixed(3)} (floor ${floor.peak})`,
      );
      console.log(`note: luma ${name} (${luma.width}x${luma.height}), the negative control: scene mean ${floorMean.toFixed(4)}, scene peak ${luma.peak.toFixed(3)} (floor ${floor.peak}), whole mean ${luma.mean.toFixed(4)}`);
      continue;
    }
    step.check(luma.mean <= limit, `${name}: mean luma ${luma.mean.toFixed(4)}, at most ${limit} for a ${shot.kind} still`);
    step.check(luma.clipped <= LUMA_GATE.clipped, `${name}: ${percent(luma.clipped)} of the pixels at luma ${LUMA_GATE.clip} or more, at most ${percent(LUMA_GATE.clipped)}`);
    if (dark) {
      step.check(
        luma.peakAll >= LUMA_GATE.darkPeak,
        `${name}: black on purpose but drawn, the brightest pixel of the whole still (the probe coming down) at luma ${luma.peakAll.toFixed(3)}, ${LUMA_GATE.darkPeak} or more (the mean is ${luma.mean.toFixed(4)})`,
      );
      console.log(`note: luma ${name} (${luma.width}x${luma.height}), the black first moment: mean ${luma.mean.toFixed(4)} (gate ${limit}), brightest pixel ${luma.peakAll.toFixed(3)} (floor ${LUMA_GATE.darkPeak}), clipped ${percent(luma.clipped)} (gate ${percent(LUMA_GATE.clipped)})`);
      continue;
    }
    step.check(
      floorMean > floor.mean && luma.peak >= floor.peak,
      masked
        ? `${name}: dark but drawn with the page's text masked (${percent(luma.masked)} of the still): the scene's mean luma ${floorMean.toFixed(4)} above ${floor.mean} and the brightest pixel of the scene's middle at luma ${luma.peak.toFixed(3)}, ${floor.peak} or more`
        : `${name}: dark but drawn, mean luma ${luma.mean.toFixed(4)} above ${floor.mean} and the brightest pixel of the scene's middle at luma ${luma.peak.toFixed(3)}, ${floor.peak} or more`,
    );
    console.log(`note: luma ${name} (${luma.width}x${luma.height}): mean ${luma.mean.toFixed(4)} (gate ${limit}, floor ${floor.mean}${masked ? `, scene mean ${floorMean.toFixed(4)} with ${percent(luma.masked)} masked` : ''}), scene peak ${luma.peak.toFixed(3)} (floor ${floor.peak}), clipped ${percent(luma.clipped)} (gate ${percent(LUMA_GATE.clipped)})`);
  }
  await meter.close();
  return rows;
}

/** The worst mean luma of the rows of a kind, and the brightest pixel over them, as the steps' summaries print them. */
const lumaSummary = (rows, kind) => {
  const of = rows.filter((row) => row.kind === kind);
  const lit = of.filter((row) => !row.dark);
  return `${kind} mean luma at most ${Math.max(...of.map((row) => row.mean)).toFixed(4)} (gate ${LUMA_GATE[kind]}) and at least ${Math.min(...lit.map((row) => row.mean)).toFixed(4)} (floor ${LUMA_GATE.floor.mean})`;
};

/**
 * The home once landed, at each still size in a fresh context (`m2/home-<size>.png`, the hero shown whole, and
 * HOME_SAMPLES - 1 more a quarter of the needle's breath apart in `m2/samples/`), and the luminance of every home and
 * loader still gated by LUMA_GATE, its floor too: the home's ceiling holds for the worst of its samples. The numbers
 * are printed and kept in results.json.
 */
async function homeLook(browser, step) {
  mkdirSync(join(STILLS, 'samples'), { recursive: true });
  const homes = [];
  for (const size of STILL_SIZES) {
    const at = sizeName(size);
    const { context, page } = await openPage(browser, step, () => false, { width: size.width, height: size.height }, size.options);
    await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
    await page.bringToFront();
    await reachHomeIdle(page);
    const hero = await page.waitForFunction(() => getComputedStyle(document.querySelector('.hero')).opacity === '1', null, { timeout: 5_000 }).then(() => true, () => false);
    await page.evaluate(() => document.fonts.ready);
    // The first still is the home as it landed, the needle setting off on its drift (no pointer has moved); the later
    // samples catch the needle's breath at its peak and trough.
    await page.waitForTimeout(500);
    step.check(hero, `${at}: landed on the home, the hero shown whole`);
    for (let k = 0; k < HOME_SAMPLES; k++) {
      if (k > 0) await page.waitForTimeout((BREATHE.period * 1000) / HOME_SAMPLES);
      const file = k === 0 ? join(STILLS, `home-${at}.png`) : join(STILLS, 'samples', `home-${at}-${k}.png`);
      await page.screenshot({ path: file });
      homes.push({ file, size: at, kind: 'home' });
    }
    await takeCsp(page, step);
    await context.close();
  }
  // The held home (the last moment) is gated as a home still, the four before it as loader stills.
  const loaders = await takeLoaderStills(browser, step);
  const rows = await gateLuma(browser, step, [...homes, ...loaders]);
  step.luma = rows;
  return `${rows.length} stills measured (${HOME_SAMPLES} home samples a size): ${lumaSummary(rows, 'home')}, ${lumaSummary(rows, 'loader')}, the scene's peak at least ${Math.min(...rows.filter((row) => !row.dark).map((row) => row.peak)).toFixed(3)} (floor ${LUMA_GATE.floor.peak}; the black first moment's brightest pixel at least ${Math.min(...rows.filter((row) => row.dark).map((row) => row.peakAll)).toFixed(3)}, floor ${LUMA_GATE.darkPeak}), clipped at most ${(Math.max(...rows.map((row) => row.clipped)) * 100).toFixed(3)} % (gate ${LUMA_GATE.clipped * 100} %)`;
}

/**
 * Where the needle's pivot is on the screen at home, in CSS pixels: the middle of the viewport. The home shot looks at
 * the compass's centre (src/engine/bob/shots.ts, FRAMES.home: target (0, 0.55, 0)), and the pivot is
 * the armillary's origin there (COMPASS_LOOK.homeY), so it is where the shot looks; the parallax moves it a few pixels,
 * which does not turn a pointer far to its right off pi/2 by anything the check sees.
 */
const pivotOf = (viewport) => ({ x: viewport.width / 2, y: viewport.height / 2 });

/**
 * The aim (spec §2.2): at 1440x900 once landed, the mouse moved to the right of the pivot, on its row, turns the needle
 * toward it with the spring's slight, heavy delay, to within AIM.tolerance of pi/2 within AIM.within ms
 * (`needleAngle`); a still of it (`m2/aim-right-1440x900.png`), gated as a home still by LUMA_GATE. On a touch phone
 * (390x844), with no cursor, the needle drifts on its own: `needleAngle` changes over 3 s. (`settle`, ms, is how much
 * longer step scroll-bob watches a needle that swung from far off: the spring overshoots by an eighth and takes about
 * two seconds, so it is on the pointer by `within` and resting on it `settle` later.)
 */
const AIM = { tolerance: 0.1, within: 1_500, drift: 3_000, settle: 1_500 };

async function aim(browser, step) {
  mkdirSync(STILLS, { recursive: true });
  const { context, page } = await openPage(browser, step);
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await page.bringToFront();
  await reachHomeIdle(page);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.hero')).opacity === '1', null, { timeout: 5_000 }).catch(() => {});
  const viewport = page.viewportSize();
  const pivot = pivotOf(viewport);
  const before = (await debugOf(page)).needleAngle;
  const to = { x: Math.round(pivot.x + 0.3 * viewport.width), y: Math.round(pivot.y) };
  await page.mouse.move(to.x, to.y, { steps: 8 });
  const moved = Date.now();
  const trail = [];
  let angle = before;
  while (Date.now() - moved < AIM.within) {
    await page.waitForTimeout(100);
    angle = (await debugOf(page)).needleAngle;
    trail.push(Number(angle.toFixed(3)));
  }
  const off = Math.abs(angle - Math.PI / 2);
  step.check(
    Number.isFinite(angle) && off <= AIM.tolerance,
    `the mouse to the right of the pivot (${to.x}, ${to.y}; pivot at ${pivot.x}, ${pivot.y}): within ${AIM.within / 1000} s the needle points at it, ${angle.toFixed(3)} rad, ${off.toFixed(3)} off pi/2 (at most ${AIM.tolerance}), from ${before.toFixed(3)} (${trail.join(' ')})`,
  );
  step.check(trail.length > 2 && Math.abs(trail[0] - Math.PI / 2) > off, `and it swung there with a delay, not at once (first 100 ms: ${trail[0]}, at ${AIM.within / 1000} s: ${angle.toFixed(3)})`);
  const file = join(STILLS, 'aim-right-1440x900.png');
  await page.screenshot({ path: file });
  await takeCsp(page, step);
  await context.close();

  const phone = STILL_SIZES[1];
  const touch = await openPage(browser, step, () => false, { width: phone.width, height: phone.height }, phone.options);
  await touch.page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await touch.page.bringToFront();
  await reachHomeIdle(touch.page);
  await touch.page.waitForTimeout(300);
  const first = (await debugOf(touch.page)).needleAngle;
  await touch.page.waitForTimeout(AIM.drift);
  const later = (await debugOf(touch.page)).needleAngle;
  step.check(
    Number.isFinite(first) && Number.isFinite(later) && Math.abs(later - first) > 0.05,
    `on a touch phone (${sizeName(phone)}), with no cursor, the needle drifts on its own: ${first.toFixed(3)} rad, then ${later.toFixed(3)} rad ${AIM.drift / 1000} s later`,
  );
  await takeCsp(touch.page, step);
  await touch.context.close();

  const rows = await gateLuma(browser, step, [{ file, kind: 'home' }]);
  step.luma = rows;
  return `the mouse to the right of the pivot turns the needle to ${angle.toFixed(3)} rad (pi/2 is 1.571) within ${AIM.within / 1000} s; on touch it drifts ${first.toFixed(3)} → ${later.toFixed(3)} in ${AIM.drift / 1000} s; ${lumaSummary(rows, 'home')} for the aimed still`;
}

// ---------------------------------------------------------------- the scroll's rise: from the home to BOB seen from above

/**
 * The rise of the home's first unit of scroll (src/scene/bob/scrollPose.ts), as the harness drives it. One wheel notch of
 * 120 px at 1440x900 is 0.133 of a viewport height, a seventh of the unit and under the letters' start (0.29 of the
 * rise), so the whole unit is ten notches (1.33 viewport heights: the rise ends at 1 and the story goes on into the
 * dive, whose camera leaves the top shot from 1.125; the compass holds at BOB from above). On the phone a swipe covers
 * 500 px (0.59 of the screen) and its glide on, and `swipesUntil` swipes until the pose says so. The camera check and
 * the still of BOB from above are made at stop 1, put there through `.set`, not where the gesture ended.
 */
const RISE = { notches: 10, notchPx: 120, notchGapMs: 16, swipePx: 500 };

/** The mid-rise still's place: 0.6 of the rise, put there through the bridge's `.set({ progress })`. */
const RISE_MID = 0.6;

/**
 * Notches of 120 px that take a real wheel gesture just past the rise's top (8 x 120 / 900 = 1.067), by more than the
 * settle's slop and less than a whole unit: it rests on BOB from above.
 */
const HOLD_NOTCHES = 8;

/** The bridge's `scroll` (src/debug/needleDebug.ts) as `u 1, letters 1, iris 1, needleDip 1`. */
const scrollText = (scroll) => `u ${scroll.u}, letters ${scroll.letters}, iris ${scroll.iris}, needleDip ${scroll.needleDip}`;

/** True when every share of the scroll's pose is `value`. */
const scrollAll = (scroll, value) => scroll.u === value && scroll.letters === value && scroll.iris === value && scroll.needleDip === value;

/**
 * Waits until the story is at rest (restAt) and exactly on its target with no speed, then a moment for the last pose to
 * be drawn through the post chain; answers the bridge's state. The rise is read from this, not from a state taken while
 * the damped progress is still catching up: `riseAt` snaps only within 1e-6 of an end.
 */
async function settledState(page) {
  await restAt(page);
  await page.waitForFunction(
    () => {
      const state = window.__needleDebug();
      return state.velocity === 0 && state.progress === state.target;
    },
    null,
    { timeout: 5_000 },
  );
  await page.waitForTimeout(400);
  return debugOf(page);
}

/** Ten wheel notches of 120 px, down (`sign` 1) or up (-1), at the pointer where it is. */
async function wheelNotches(page, sign) {
  for (let i = 0; i < RISE.notches; i++) {
    await page.mouse.wheel(0, sign * RISE.notchPx);
    await page.waitForTimeout(RISE.notchGapMs);
  }
}

/**
 * One swipe on a touch screen (CDP touch events), from `fromY` to `toY` along the middle of the screen, in steps of 40
 * px 12 ms apart, then the lift: the glide goes on from there (the scroll's Inertia).
 */
async function swipe(page, cdp, fromY, toY) {
  const touch = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: 195, y }] });
  await touch('touchStart', fromY);
  const sign = Math.sign(toY - fromY);
  for (let y = fromY + sign * 40; sign > 0 ? y <= toY : y >= toY; y += sign * 40) {
    await touch('touchMove', y);
    await page.waitForTimeout(12);
  }
  await touch('touchEnd');
}

/**
 * Swipes up (`direction` 1: the story goes down) or down (-1) until the rise stands where `done(scroll)` says, at rest,
 * at most four times; answers the settled state and how many swipes it took. The finger moves 500 px, 0.59 of the
 * screen, and the glide carries it on.
 */
async function swipesUntil(page, cdp, direction, done) {
  let state = await debugOf(page);
  let swipes = 0;
  while (swipes < 4 && !done(state.scroll)) {
    const from = direction > 0 ? 700 : 200;
    await swipe(page, cdp, from, from - direction * RISE.swipePx);
    state = await settledState(page);
    swipes++;
  }
  return { state, swipes };
}

/**
 * Records, from now on in `window.__rise`, what a reduced-motion step does to the page: whether `<html data-step-fade>`
 * was ever set (a MutationObserver, so a 150 ms fade is not missed between polls), the rise the bridge reported at the
 * moment it was first set, every distinct rise a 5 ms timer saw (reduced motion has stops, no travel: only 0 and 1),
 * and the lowest opacity of `.scene-host` (the host faded down).
 */
const watchStepFade = (page) =>
  page.evaluate(() => {
    const html = document.documentElement;
    const record = { fadeSeen: false, uAtFade: null, us: new Set(), minOpacity: 1 };
    window.__rise = record;
    new MutationObserver(() => {
      if (html.hasAttribute('data-step-fade') && !record.fadeSeen) {
        record.fadeSeen = true;
        record.uAtFade = window.__needleDebug().scroll.u;
      }
    }).observe(html, { attributes: true, attributeFilter: ['data-step-fade'] });
    const host = document.querySelector('.scene-host');
    setInterval(() => {
      record.us.add(window.__needleDebug().scroll.u);
      record.minOpacity = Math.min(record.minOpacity, Number(getComputedStyle(host).opacity));
    }, 5);
  });

/** What watchStepFade recorded since it was started (or last taken), and starts the next step's record fresh. */
const takeStepFade = (page) =>
  page.evaluate(() => {
    const record = window.__rise;
    const taken = { fadeSeen: record.fadeSeen, uAtFade: record.uAtFade, us: [...record.us], minOpacity: record.minOpacity };
    record.fadeSeen = false;
    record.uAtFade = null;
    record.us.clear();
    record.minOpacity = 1;
    return taken;
  });

/**
 * The hero's SCROLL cue as the page shows it now: whether `<html data-rising>` is set, the cue's own computed opacity and
 * transition (its own, not the word's pulse, which is on the word inside), that it is still in the page with its
 * text and displayed (it goes by opacity alone, so a screen reader keeps it), and the hero's opacity (1 whenever the
 * cue is meant to be the one that left). Null when there is no cue.
 */
const cueOf = (page) =>
  page.evaluate(() => {
    const cue = document.querySelector('.hero-cue');
    if (cue === null) return null;
    const style = getComputedStyle(cue);
    const word = cue.querySelector('.hero-cue-word');
    return {
      rising: document.documentElement.hasAttribute('data-rising'),
      opacity: Number(style.opacity),
      text: (cue.textContent ?? '').trim(),
      display: style.display,
      visibility: style.visibility,
      transitionProperty: style.transitionProperty,
      transitionDuration: style.transitionDuration,
      cueAnimation: style.animationName,
      wordAnimation: word === null ? null : getComputedStyle(word).animationName,
      heroOpacity: Number(getComputedStyle(document.querySelector('.hero')).opacity),
    };
  });

/** The cue (cueOf) once its computed opacity is `opacity`, which waits out the 0.4 s transition (up to 3 s, then as it is). */
const cueAt = async (page, opacity) => {
  await page
    .waitForFunction(
      (want) => {
        const cue = document.querySelector('.hero-cue');
        return cue !== null && Number(getComputedStyle(cue).opacity) === want;
      },
      opacity,
      { timeout: 3_000 },
    )
    .catch(() => {});
  return cueOf(page);
};

/** True when the cue has left and is still there to be read: hidden by opacity alone, with `<html data-rising>` set. */
const cueGone = (cue) => cue !== null && cue.rising && cue.opacity === 0 && cue.text.length > 0 && cue.display !== 'none' && cue.visibility === 'visible' && cue.heroOpacity === 1;

/** True when the cue shows: `<html data-rising>` unset, fully opaque, with its text. */
const cueShown = (cue) => cue !== null && !cue.rising && cue.opacity === 1 && cue.text.length > 0 && cue.display !== 'none' && cue.visibility === 'visible' && cue.heroOpacity === 1;

/** The cue as a line of text for a check's message. */
const cueText = (cue) =>
  cue === null ? 'no cue' : `data-rising ${cue.rising}, opacity ${cue.opacity}, "${cue.text}", display ${cue.display}, transition ${cue.transitionProperty} ${cue.transitionDuration}`;

/**
 * The first unit of scroll (spec §2.3, §2.1: the home's rise), at 1440x900 with the wheel and at 390x844 with a finger
 * (touch, coarse pointer), each in a fresh context that lands with the seen flag set (the quick path: the rise is the
 * scroll's, not the loader's):
 *
 * 1. At rest on the home `u` and `letters` are 0 (and `iris`, `needleDip`), and no B mark is cut.
 * 2. Moved the whole unit down (ten notches; swipes), at rest `u`, `letters`, `iris` and `needleDip` are all 1. The
 *    gesture ends past the unit and settles on a stop (BOB from above, 1, for a gesture come up out of the rise less than
 *    a whole unit past its top; past it for a fling), so the story is put on stop 1 through the bridge
 *    (`.set({ progress: 1 })`) whatever the gesture did, and there the camera stands on the top shot (`topShotFor`, the
 *    whole name across the picture, which the unit test pins). A still of it, `m2/bob-from-above-<size>.png`, is gated
 *    as a home still.
 * 3. A mid-rise still at `u` 0.6, put there through the bridge's `.set({ progress })`: `m2/bob-rising-<size>.png`, gated as
 *    a home still; the shares of the iris, the needle and the letters are those of the pure pose (`scrollPoseAt`), each between 0 and 1.
 * 4. The story put back where the ten notches summed to (the swipes: where they left it) and moved the whole unit up
 *    (ten notches, swipes): `u` and `letters` are exactly 0 (the wheel's summed deltas leave a residue that `riseAt` must
 *    snap away), the phase is HOME_IDLE and a still of the home again, `m2/bob-back-home-<size>.png`, is gated as a home
 *    still. At 1440 the pointer to the right of the pivot turns the needle to within AIM.tolerance of pi/2 within
 *    AIM.within ms, and it rests there AIM.settle ms later (the aim is back). Then eight real notches from the home
 *    (1.067, less than a whole unit past the top) rest on BOB from above, 1, once the wheel is quiet, with the camera on
 *    the top shot, and one more notch goes on to the overview, 2; and seven real arrow presses from the home stop on the
 *    rise's top, 1, with the camera on the top shot: BOB from above reached by real input, both ways.
 * 5. With reduced motion (1440 only), one wheel event down sets `<html data-step-fade>` with the pose still at the home,
 *    never shows a rise between 0 and 1 (no camera travel) and lands on `u` 1 with the attribute gone and the host
 *    shown again; one event up does the same back to 0.
 * 6. The hero's SCROLL cue leaves with the rise (spec §3 shows no text during the scroll): at the home it is
 *    shown (`<html data-rising>` unset, computed opacity 1), with a 0.4 s opacity transition of its own and its pulse on
 *    the word inside; at `u` 1 and at `u` 0.6 it is gone by opacity alone (opacity 0 after its transition,
 *    `data-rising` set, still in the page with its text, displayed and visible), and back at the home it is shown
 *    again. Under reduced motion it has no transition and does the same at the stops (1440).
 */
async function scrollBob(browser, step) {
  mkdirSync(STILLS, { recursive: true });
  const summary = [];
  const shots = [];
  for (const size of STILL_SIZES) {
    const at = sizeName(size);
    const touch = size.options.hasTouch === true;
    const aspect = size.width / size.height;
    const { context, page } = await openPage(browser, step, () => false, { width: size.width, height: size.height }, size.options);
    await context.addInitScript((key) => localStorage.setItem(key, '1'), LOADER_SEEN_KEY);
    await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
    await page.bringToFront();
    await reachHomeIdle(page);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.hero')).opacity === '1', null, { timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(500);
    const cdp = touch ? await context.newCDPSession(page) : null;

    // 1. At rest on the home.
    const rest = await debugOf(page);
    step.check(
      rest.phase.kind === 'HOME_IDLE' && scrollAll(rest.scroll, 0) && othersOf(rest.loader) === 0,
      `${at}: landed with ${LOADER_SEEN_KEY} set, the home at rest has the rise at 0: ${scrollText(rest.scroll)}, no B mark cut (the loader's marks ${JSON.stringify(rest.loader.strokes)}, phase ${rest.phase.kind})`,
    );
    const cueRest = await cueOf(page);
    step.check(
      cueShown(cueRest) && cueRest.transitionProperty === 'opacity' && cueRest.transitionDuration === '0.4s' && cueRest.cueAnimation === 'none' && cueRest.wordAnimation === 'hero-cue-pulse',
      `${at}: at the home the SCROLL cue shows (${cueText(cueRest)}), its opacity moves over 0.4 s, and the pulse is on the word inside it (${cueRest?.wordAnimation}), not on the cue (${cueRest?.cueAnimation})`,
    );

    // 2. The whole unit down: BOB from above.
    let swipesDown = 0;
    if (touch) {
      const moved = await swipesUntil(page, cdp, 1, (scroll) => scroll.u === 1);
      swipesDown = moved.swipes;
    } else {
      await page.mouse.move(size.width / 2, size.height / 2);
      await wheelNotches(page, 1);
    }
    const down = await settledState(page);
    step.check(
      scrollAll(down.scroll, 1),
      `${at}: moved the whole unit down (${touch ? `${swipesDown} swipes up` : `${RISE.notches} wheel notches of ${RISE.notchPx} px`}) and at rest, ${scrollText(down.scroll)} (phase ${down.phase.kind}, target ${down.target})`,
    );
    // The gesture goes the whole unit and on (a wheel's ten notches reach 1.33, a swipe's glide further) and, ended past the
    // rise, settles on a stop: BOB from above, 1, unless it carried more than a whole unit past the top. The story is put on
    // stop 1 through the bridge either way, as the mid-rise stop is, and the top-shot check and the still are of it.
    const restedProgress = down.progress;
    await page.evaluate(() => window.__needleDebug.set({ progress: 1 }));
    const atTop = await settledState(page);
    const top = topShotFor(aspect);
    const onTop = atTop.camera.position.every((value, i) => near(value, top.position[i], 1e-3)) && near(atTop.camera.fov, top.fov, 1e-3);
    step.check(
      atTop.progress === 1 && scrollAll(atTop.scroll, 1),
      `${at}: the gesture ended at progress ${restedProgress.toFixed(3)}, past the rise, and stop 1 (the rise's end), put there through .set, is the rise at 1: ${scrollText(atTop.scroll)} (progress ${atTop.progress})`,
    );
    step.check(
      onTop,
      `${at}: BOB from above (stop 1) stands on the top shot, the whole name across the picture: camera [${atTop.camera.position.map((v) => v.toFixed(3)).join(', ')}] fov ${atTop.camera.fov.toFixed(3)}, topShotFor(${aspect.toFixed(3)}) is [${top.position.map((v) => v.toFixed(3)).join(', ')}] fov ${top.fov.toFixed(3)}`,
    );
    const cueTop = await cueAt(page, 0);
    step.check(cueGone(cueTop), `${at}: BOB from above (u ${down.scroll.u}) has no SCROLL cue: it left by opacity alone and is still in the page (${cueText(cueTop)}, hero opacity ${cueTop?.heroOpacity})`);
    const fromAbove = join(STILLS, `bob-from-above-${at}.png`);
    await page.screenshot({ path: fromAbove });
    shots.push({ file: fromAbove, kind: 'home' });

    // 3. One mid-rise still, put at 0.6 of the rise through the bridge.
    await page.evaluate((progress) => window.__needleDebug.set({ progress }), RISE_MID);
    await page.waitForFunction((u) => Math.abs(window.__needleDebug().scroll.u - u) < 1e-9, RISE_MID, { timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(500);
    const mid = await debugOf(page);
    const pose = scrollPoseAt(RISE_MID, aspect);
    const between = [mid.scroll.iris, mid.scroll.needleDip, mid.scroll.letters].every((share) => share > 0 && share < 1);
    step.check(
      near(mid.scroll.u, RISE_MID, 1e-9) &&
        between &&
        near(mid.scroll.iris, pose.iris, 1e-9) &&
        near(mid.scroll.needleDip, pose.needleDip, 1e-9) &&
        near(mid.scroll.letters, pose.letters, 1e-9) &&
        mid.camera.position.every((value, i) => near(value, pose.shot.position[i], 1e-3)),
      `${at}: put at ${RISE_MID} of the rise through .set, the pose is the pure one, each share between 0 and 1: ${scrollText(mid.scroll)} (scrollPoseAt: iris ${pose.iris}, needleDip ${pose.needleDip}, letters ${pose.letters})`,
    );
    const cueMid = await cueAt(page, 0);
    step.check(cueGone(cueMid), `${at}: and mid-rise (u ${mid.scroll.u}) the cue is gone too (${cueText(cueMid)})`);
    const rising = join(STILLS, `bob-rising-${at}.png`);
    await page.screenshot({ path: rising });
    shots.push({ file: rising, kind: 'home' });

    // 4. Back up the whole unit: the home again. The wheel's way down settled on a stop past the rise (the gesture ended
    // there), so the story is put where its ten notches summed to before that, the very sum the scroll made (the deltas
    // added as the input adds them), and the way back sums the same deltas (the wheel's float residue is what the snap at
    // 0 is for). A finger's way back starts where the swipes left it: its last swipe down ends at 0, held there.
    const summed = touch
      ? restedProgress
      : await page.evaluate(({ notches, px, end }) => {
          let place = 0;
          for (let i = 0; i < notches; i++) place = Math.min(Math.max(place + px / Math.max(window.innerHeight, 1), 0), end);
          return place;
        }, { notches: RISE.notches, px: RISE.notchPx, end: STORY_END });
    await page.evaluate((progress) => window.__needleDebug.set({ progress }), summed);
    const again = await settledState(page);
    step.check(scrollAll(again.scroll, 1), `${at}: put back where ${touch ? 'the swipes left it' : 'the ten notches summed to'} (progress ${summed}), the rise is 1 again (${scrollText(again.scroll)})`);
    let swipesUp = 0;
    if (touch) {
      const moved = await swipesUntil(page, cdp, -1, (scroll) => scroll.u === 0);
      swipesUp = moved.swipes;
    } else {
      await wheelNotches(page, -1);
    }
    const up = await settledState(page);
    await waitForPhase(page, 'HOME_IDLE').catch(() => {});
    const home = await debugOf(page);
    step.check(
      scrollAll(home.scroll, 0) && home.phase.kind === 'HOME_IDLE' && home.target <= 1e-6,
      `${at}: moved the whole unit up (${touch ? `${swipesUp} swipes down` : `${RISE.notches} wheel notches`}): ${scrollText(home.scroll)} exactly, the phase ${home.phase.kind}, no B drawn (the story's target ${up.target})`,
    );
    const cueHome = await cueAt(page, 1);
    step.check(cueShown(cueHome), `${at}: back at the home (u ${home.scroll.u}) the SCROLL cue is back (${cueText(cueHome)})`);
    const backHome = join(STILLS, `bob-back-home-${at}.png`);
    await page.screenshot({ path: backHome });
    shots.push({ file: backHome, kind: 'home' });

    // The aim is back (a mouse only: a finger has no cursor).
    if (!touch) {
      const pivot = pivotOf(page.viewportSize());
      const to = { x: Math.round(pivot.x + 0.3 * size.width), y: Math.round(pivot.y) };
      await page.mouse.move(to.x, to.y, { steps: 8 });
      // The needle's spring (NEEDLE_SPRING) overshoots by an eighth and settles in about two seconds, so a big swing is
      // still easing in at AIM.within: the needle must have pointed at the pointer by then, and be resting on it
      // AIM.settle ms after.
      const moved = Date.now();
      const trail = [];
      let reachedAt = null;
      let angle = Number.NaN;
      while (Date.now() - moved < AIM.within + AIM.settle) {
        await page.waitForTimeout(100);
        angle = (await debugOf(page)).needleAngle;
        trail.push(Number(angle.toFixed(3)));
        if (reachedAt === null && Math.abs(angle - Math.PI / 2) <= AIM.tolerance) reachedAt = Date.now() - moved;
      }
      const off = Math.abs(angle - Math.PI / 2);
      step.check(
        reachedAt !== null && reachedAt <= AIM.within,
        `${at}: back at the home the needle aims at the pointer again: the mouse to the right of the pivot (${to.x}, ${to.y}), the needle points at it (within ${AIM.tolerance} of pi/2) ${reachedAt} ms later, within ${AIM.within} ms (${trail.join(' ')})`,
      );
      step.check(Number.isFinite(angle) && off <= AIM.tolerance, `and it comes to rest on it: ${angle.toFixed(3)} rad ${AIM.within + AIM.settle} ms after the move, ${off.toFixed(3)} off pi/2 (at most ${AIM.tolerance})`);

      // 5. Real gestures onto the rise's top and on, and real keys onto it. Eight notches of 120 px reach 960 / 900 = 1.067,
      // past the top by more than the settle's slop but a whole unit short of a fling, so once the wheel is quiet the gesture
      // rests on the top, BOB from above, which no `.set` put there, its camera on the top shot; one more notch from there
      // goes on to the overview. Real arrows from the home move by their distance and stop on the top too.
      await page.waitForFunction(() => window.__needleDebug().journey.voidState === 'ready', null, { timeout: 15_000 }).catch(() => {});
      for (let i = 0; i < HOLD_NOTCHES; i++) {
        await page.mouse.wheel(0, RISE.notchPx);
        await page.waitForTimeout(RISE.notchGapMs);
      }
      const asked = (await frameOf(page)).target;
      const settled = await settledState(page);
      const expectedAt = (HOLD_NOTCHES * RISE.notchPx) / size.height;
      const settledTop = settled.camera.position.every((value, i) => near(value, top.position[i], 1e-3)) && near(settled.camera.fov, top.fov, 1e-3);
      step.check(
        near(asked, expectedAt, 1e-9) && expectedAt - 1 > SETTLE_SLOP_PX / size.height && settled.progress === 1 && settled.target === 1 && scrollAll(settled.scroll, 1) && settledTop,
        `${at}: and ${HOLD_NOTCHES} real wheel notches move the target to ${asked.toFixed(4)} (${expectedAt.toFixed(4)}), past the rise's top by more than the slop (${(SETTLE_SLOP_PX / size.height).toFixed(4)}) and less than a whole unit, and once the wheel is quiet rest on the top, BOB from above, 1, with the camera on the top shot (progress ${settled.progress}, [${settled.camera.position.map((v) => v.toFixed(3)).join(', ')}] fov ${settled.camera.fov.toFixed(3)})`,
      );
      await page.mouse.wheel(0, RISE.notchPx);
      const onward = await settledState(page);
      step.check(
        near(onward.progress, 1 + RISE.notchPx / size.height, 1e-9) && onward.target === onward.progress && onward.journey.stretch === 'light',
        `${at}: and one more notch from BOB from above goes on into the light dive by its distance and rests there, ${(1 + RISE.notchPx / size.height).toFixed(4)} (progress ${onward.progress}, the journey ${onward.journey.stretch} at way frame ${onward.journey.frame})`,
      );
      await page.keyboard.press('Home');
      await settledState(page);
      for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowDown'); // 7 x 0.15 = 1.05, held at the top
      const keyed = await settledState(page);
      const keyedTop = keyed.camera.position.every((value, i) => near(value, top.position[i], 1e-3)) && near(keyed.camera.fov, top.fov, 1e-3);
      step.check(
        keyed.progress === 1 && keyed.target === 1 && scrollAll(keyed.scroll, 1) && keyedTop,
        `${at}: seven real arrow presses up the rise stop on its top, BOB from above (progress ${keyed.progress}), with the camera on the top shot: [${keyed.camera.position.map((v) => v.toFixed(3)).join(', ')}] fov ${keyed.camera.fov.toFixed(3)}`,
      );
    }
    await takeCsp(page, step);
    await context.close();
    summary.push(`${at}: ${touch ? `${swipesDown} swipes` : `${RISE.notches} notches`} down to u ${down.scroll.u} (the SCROLL cue gone), ${touch ? `${swipesUp} swipes` : `${RISE.notches} notches`} back to u ${home.scroll.u} (the cue back)${touch ? '' : `, ${HOLD_NOTCHES} notches rest on the top shot, one more goes on to the overview, and 7 arrows stop on the top shot`}`);
  }

  // 5. Reduced motion: one wheel event is one stop, and each step is a fade with the pose still at the stop it shows.
  const reduced = await openPage(browser, step, () => false, { width: 1440, height: 900 }, { reducedMotion: 'reduce' });
  const { page } = reduced;
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await page.bringToFront();
  step.check(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), 'the page asks for reduced motion');
  await reachHomeIdle(page);
  await page.waitForTimeout(500);
  await page.mouse.move(720, 450);
  const cueReducedRest = await cueOf(page);
  step.check(
    cueShown(cueReducedRest) && cueReducedRest.transitionProperty === 'none' && cueReducedRest.cueAnimation === 'none' && cueReducedRest.wordAnimation === 'none',
    `reduced motion: at the home the SCROLL cue shows and has no transition and no pulse (${cueText(cueReducedRest)}, the word's animation ${cueReducedRest?.wordAnimation})`,
  );
  await watchStepFade(page);
  await page.mouse.wheel(0, RISE.notchPx);
  const downState = await settledState(page);
  const downFade = await takeStepFade(page);
  const hostDown = await page.evaluate(() => ({ attribute: document.documentElement.hasAttribute('data-step-fade'), opacity: getComputedStyle(document.querySelector('.scene-host')).opacity }));
  step.check(
    downFade.fadeSeen && downFade.uAtFade === 0,
    `reduced motion: one wheel event down set <html data-step-fade> during the step, with the pose still at the home when it was set (u ${downFade.uAtFade})`,
  );
  step.check(downFade.minOpacity < 0.5, `and the scene host really faded down: its lowest opacity was ${downFade.minOpacity.toFixed(3)}, under 0.5`);
  step.check(downFade.us.every((u) => u === 0 || u === 1), `and the pose never travelled: the rise was only ever ${downFade.us.join(' / ')} (stops, no running front)`);
  step.check(
    scrollAll(downState.scroll, 1) && downState.target === 1 && !hostDown.attribute && hostDown.opacity === '1',
    `and the step lands on the stop: ${scrollText(downState.scroll)}, target ${downState.target}, the attribute gone and the host shown again (opacity ${hostDown.opacity})`,
  );
  const cueReducedTop = await cueAt(page, 0);
  step.check(cueGone(cueReducedTop), `reduced motion: on the stop at u ${downState.scroll.u} the cue is gone by opacity alone and still in the page (${cueText(cueReducedTop)})`);
  await page.waitForTimeout(300); // the next event is the next gesture
  await page.mouse.wheel(0, -RISE.notchPx);
  const upState = await settledState(page);
  const upFade = await takeStepFade(page);
  await waitForPhase(page, 'HOME_IDLE').catch(() => {});
  step.check(
    upFade.fadeSeen && upFade.uAtFade === 1 && upFade.us.every((u) => u === 0 || u === 1) && scrollAll(upState.scroll, 0) && upState.target === 0,
    `and one event up fades back to the home: the attribute set with the pose still at u ${upFade.uAtFade}, the rise only ever ${upFade.us.join(' / ')}, landing on ${scrollText(upState.scroll)}, target ${upState.target}`,
  );
  const cueReducedHome = await cueAt(page, 1);
  step.check(cueShown(cueReducedHome), `reduced motion: and back on the home stop the cue shows again (${cueText(cueReducedHome)})`);
  await takeCsp(page, step);
  await reduced.context.close();
  summary.push('reduced motion: one wheel event is one stop, faded, u 0 to 1 to 0 with no travel, the SCROLL cue gone at 1 and back at 0');

  const rows = await gateLuma(browser, step, shots);
  step.luma = rows;
  return `${summary.join('; ')}; ${lumaSummary(rows, 'home')} for the stills of BOB from above, mid-rise and the home again`;
}

/**
 * Records, from the document's start, what the opening shows every `everyMs` ms until a little after the phase is
 * HOME_IDLE: `window.__loaderSamples` (performance.now() ms, the bridge's loader stage, its seconds, how much of the
 * circle is cut and how much of the four B marks (always 0), the camera, the phase, the quality tier), when the scene first showed (`window.__readyAt`, `data-ready` on the scene host),
 * when the fallback card first showed (`window.__cardAt`) and when HOME_IDLE came (`window.__idleAt`). A timer, not
 * frames: it asks for no frame of its own.
 */
const watchLoader = (context, everyMs) =>
  context.addInitScript((everyMs) => {
    window.__loaderSamples = [];
    window.__readyAt = null;
    window.__idleAt = null;
    window.__cardAt = null;
    const timer = setInterval(() => {
      const now = performance.now();
      if (window.__readyAt === null && document.querySelector('.scene-host')?.hasAttribute('data-ready')) window.__readyAt = now;
      if (window.__cardAt === null && document.querySelector('.scene-fallback')) window.__cardAt = now;
      if (typeof window.__needleDebug !== 'function') return;
      const { loader, phase, camera, tier } = window.__needleDebug();
      window.__loaderSamples.push({
        t: Math.round(now),
        stage: loader.stage,
        elapsed: loader.elapsed,
        // The marks are in STROKE_ORDER, the circle last: the loader cuts the circle alone, so the four before it are 0.
        circle: loader.strokes[4],
        others: loader.strokes.slice(0, 4).reduce((sum, share) => sum + share, 0),
        camera: { position: camera.position, fov: camera.fov },
        phase: phase.kind,
        tier,
      });
      if (phase.kind === 'HOME_IDLE' && window.__idleAt === null) window.__idleAt = now;
      if (window.__idleAt !== null && now - window.__idleAt > 600) clearInterval(timer);
    }, everyMs);
  }, everyMs);

/** What watchLoader recorded, once its own sample has seen HOME_IDLE (it may lag the phase by one interval). */
async function loaderRecord(page) {
  await page.waitForFunction(() => window.__idleAt !== null, null, { timeout: 5_000 });
  return page.evaluate(() => ({ samples: window.__loaderSamples, readyAt: window.__readyAt, idleAt: window.__idleAt }));
}

/** The stages a record went through, in order, each once per run of it; the null before an opening mounts is no stage. */
const stagesOf = (samples) => {
  const stages = [];
  for (const { stage } of samples) if (stage !== null && stage !== stages.at(-1)) stages.push(stage);
  return stages;
};

/** Waits until the opening's clock has run `seconds` (the bridge's `loader.elapsed`), the full show playing. */
const loaderAtLeast = (page, seconds) =>
  page.waitForFunction((s) => (window.__needleDebug?.().loader.elapsed ?? 0) >= s, seconds, { timeout: LOAD_TIMEOUT_MS + 5_000, polling: 20 });

/** How long a skip may take to land, ms: the loader's fast-forward (LOADER.skip, 1 s) and the brief's margin. */
const SKIP_WITHIN_MS = 1_600;

/** How long the wheel burst (40 events paced 25 ms apart) may really take, ms: a 1 s gesture, give or take a slow event. */
const WHEEL_BURST_MS = [900, 1_400];

/**
 * The skip (spec §2.1): any click, tap, scroll or key fast-forwards the rest of the full show to the home in about a
 * second, with no button and no text, and the input that skips is used up by the skip. A first visit (nothing stored):
 * a click CUT_AT (1.5) s into the show (`loader.elapsed`, while the circle is being cut) lands on HOME_IDLE within
 * SKIP_WITHIN_MS. Then the same page reloaded with the seen flag cleared, so the full show plays again: 40 wheel events
 * over 1 s from CUT_AT s in land on the home too, and the story's progress and target stay 0 through the burst and
 * after it, the page unscrolled. Then once more with the flag cleared: a real key press, Space (a key that would scroll
 * the page), CUT_AT s in lands on HOME_IDLE within SKIP_WITHIN_MS too, and moves neither the story nor the page. The
 * home it lands on has the circle cut whole and no B mark cut.
 */
async function loaderSkip(browser, step) {
  const { context, page } = await openPage(browser, step);
  await watchLoader(context, 20);
  await context.addInitScript(() => {
    window.__inputAt = null;
    for (const type of ['pointerdown', 'wheel', 'keydown']) {
      window.addEventListener(type, () => (window.__inputAt ??= performance.now()), { capture: true, passive: true });
    }
  });
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await page.bringToFront();
  await loaderAtLeast(page, CUT_AT);
  const at = (await debugOf(page)).loader;
  await page.mouse.click(720, 450);
  const clicked = await reachHomeIdle(page).then(() => true, () => false);
  const record = await loaderRecord(page);
  const inputAt = await page.evaluate(() => window.__inputAt);
  const took = inputAt !== null && record.idleAt !== null ? Math.round(record.idleAt - inputAt) : null;
  step.check(
    at.stage === 'engrave' && at.elapsed >= CUT_AT && at.elapsed < CUT_AT + CUT_WITHIN && circleOf(at) > 0 && circleOf(at) < 1 && othersOf(at) === 0,
    `a first visit plays the full show: ${CUT_AT} s in it engraves, the circle part cut and no B (stage ${at.stage} at ${at.elapsed.toFixed(2)} s, circle cut ${circleOf(at).toFixed(2)}, the B marks ${othersOf(at)})`,
  );
  step.check(clicked && took !== null && took >= 0 && took <= SKIP_WITHIN_MS, `a click at ${CUT_AT} s lands on HOME_IDLE ${took} ms later (within ${SKIP_WITHIN_MS} ms; the stages ${stagesOf(record.samples).join(' → ')})`);
  await page.waitForTimeout(500);
  const afterClick = await debugOf(page);
  step.check(afterClick.loader.stage === 'home' && circleWhole(afterClick.loader), `and the home stands whole: the circle cut and nothing else (got ${afterClick.loader.stage}, strokes ${JSON.stringify(afterClick.loader.strokes)})`);
  await takeCsp(page, step);

  // The wheel: the full show again (the flag cleared), and a burst from CUT_AT s in.
  await page.evaluate((key) => localStorage.removeItem(key), LOADER_SEEN_KEY);
  await page.reload({ waitUntil: 'load' });
  await loaderAtLeast(page, CUT_AT);
  const second = (await debugOf(page)).loader;
  await page.mouse.move(720, 450);
  // The burst is paced against the clock, not by fixed waits, so a slow event does not stretch it; its real length is
  // checked (WHEEL_BURST_MS), so a run where the events came too slowly or all at once cannot pass for a 1 s gesture.
  const burstStart = Date.now();
  for (let i = 0; i < 40; i++) {
    await page.mouse.wheel(0, 100);
    await page.waitForTimeout(Math.max(0, burstStart + (i + 1) * 25 - Date.now()));
  }
  const burst = Date.now() - burstStart;
  const landed = await reachHomeIdle(page).then(() => true, () => false);
  const wheelRecord = await loaderRecord(page);
  const wheelAt = await page.evaluate(() => window.__inputAt);
  // From the burst's end on, while the swallow and any scroll it had let through would play out: six samples 250 ms
  // apart, each of progress and target, and the page's own scroll.
  const after = [];
  for (let k = 0; k < 6; k++) {
    await page.waitForTimeout(250);
    const f = await frameOf(page);
    after.push({ progress: f.progress, target: f.target });
  }
  const scrollY = await page.evaluate(() => window.scrollY);
  step.check(second.stage === 'engrave' && second.elapsed >= CUT_AT, `reloaded with ${LOADER_SEEN_KEY} cleared, the full show plays again (stage ${second.stage} at ${second.elapsed.toFixed(2)} s)`);
  step.check(burst >= WHEEL_BURST_MS[0] && burst <= WHEEL_BURST_MS[1], `the burst was 40 wheel events over ${burst} ms (a 1 s gesture: ${WHEEL_BURST_MS.join(' to ')} ms)`);
  step.check(
    landed && wheelRecord.idleAt !== null,
    `40 wheel events from ${CUT_AT} s in land on the home (HOME_IDLE ${wheelAt === null ? '?' : Math.round(wheelRecord.idleAt - wheelAt)} ms after the first)`,
  );
  step.check(
    after.every((s) => s.progress === 0 && s.target === 0) && scrollY === 0,
    `and the burst never scrolls: after it, the story's progress and target stay 0 for 1.5 s (${after.map((s) => `${s.progress}/${s.target}`).join(' ')}), scrollY ${scrollY}`,
  );
  await takeCsp(page, step);

  // A key: the full show again (the flag cleared), and Space CUT_AT s in, a real key press.
  await page.evaluate((key) => localStorage.removeItem(key), LOADER_SEEN_KEY);
  await page.reload({ waitUntil: 'load' });
  await loaderAtLeast(page, CUT_AT);
  const third = (await debugOf(page)).loader;
  await page.keyboard.press('Space');
  const keyed = await reachHomeIdle(page).then(
    () => true,
    () => false,
  );
  const keyRecord = await loaderRecord(page);
  const keyAt = await page.evaluate(() => window.__inputAt);
  const keyTook = keyAt !== null && keyRecord.idleAt !== null ? Math.round(keyRecord.idleAt - keyAt) : null;
  await page.waitForTimeout(500);
  const afterKey = await frameOf(page);
  const keyScrollY = await page.evaluate(() => window.scrollY);
  step.check(third.stage === 'engrave' && third.elapsed >= CUT_AT, `reloaded with ${LOADER_SEEN_KEY} cleared again, the full show plays (stage ${third.stage} at ${third.elapsed.toFixed(2)} s)`);
  step.check(
    keyed && keyTook !== null && keyTook >= 0 && keyTook <= SKIP_WITHIN_MS,
    `Space at ${CUT_AT} s, a real key press, lands on HOME_IDLE ${keyTook} ms later (within ${SKIP_WITHIN_MS} ms; the stages ${stagesOf(keyRecord.samples).join(' → ')})`,
  );
  step.check(
    afterKey.progress === 0 && afterKey.target === 0 && keyScrollY === 0,
    `and the key that skipped moves nothing: the story's progress ${afterKey.progress} and target ${afterKey.target}, scrollY ${keyScrollY}`,
  );
  await takeCsp(page, step);
  await context.close();
  return `a click at ${CUT_AT} s lands in ${took} ms; a 40-event wheel burst over ${burst} ms at ${CUT_AT} s lands with the story at 0 for 1.5 s after (scrollY ${scrollY}); Space at ${CUT_AT} s lands in ${keyTook} ms`;
}

/**
 * The skip listens only while a scene is shown, so a page of text reached mid-show scrolls. A first visit to a project page (nothing stored, so the full
 * show plays under the page's scrim), with the compass's file held back, so its load is still out when the visitor
 * leaves, as on a slow connection: CUT_AT (1.5) s into the loader a click on the header's Contact (/contact/; its links to
 * the light version, Work and About went in rounds 3 and 7; it also asks for the skip)
 * opens the contact page by client navigation, a page with no scene, where the show cannot land. (A load that is in by then lands
 * the show as the visitor leaves, as Lite's phase skips the rest of it, and the listener goes with it: that case passes
 * either way.) There the page is the visitor's: five wheel turns scroll it, and from the top again Space and then
 * PageDown each scroll it (scrollY above 0), with none of those events prevented. Then the file is let through and the
 * visitor goes back (history back): on the project page the skip asked for at the link lands the show on the home view
 * within LITE_BACK_WITHIN_MS.
 */
async function loaderLite(browser, step) {
  const { context, page } = await openPage(browser, step);
  await context.addInitScript(() => {
    window.__prevented = [];
    // In the bubble phase on the window, after every listener of the page has had the event: was it prevented?
    for (const type of ['wheel', 'keydown']) {
      window.addEventListener(type, (e) => window.__prevented.push({ type, key: e.key ?? null, prevented: e.defaultPrevented }), { passive: true });
    }
  });
  // The compass's file waits until Lite has been tried.
  let release = () => {};
  const held = new Promise((resolve) => {
    release = resolve;
  });
  let asked = 0;
  await page.route('**/models/bob-compass.glb', async (route) => {
    asked++;
    await held;
    await route.continue().catch(() => {});
  });
  await page.goto(`${BASE}/projects/steady/?proof`, { waitUntil: 'load' });
  await page.bringToFront();
  const flag = await page.evaluate((key) => localStorage.getItem(key), LOADER_SEEN_KEY);
  await loaderAtLeast(page, CUT_AT);
  const at = (await debugOf(page)).loader;
  await page.click('.site-header a[href="/contact/"]');
  const opened = await page.waitForURL((url) => url.pathname === '/contact/', { timeout: 5_000 }).then(
    () => true,
    () => false,
  );
  await page.waitForTimeout(500);
  const there = await debugOf(page);
  step.check(
    flag === null && at.stage === 'engrave' && at.elapsed >= CUT_AT && at.elapsed < CUT_AT + 2 * CUT_WITHIN && asked >= 1,
    `a first visit to /projects/steady/ plays the full show, its compass file held (${asked} asked): ${CUT_AT} s in it engraves (stage ${at.stage} at ${at.elapsed.toFixed(2)} s, ${LOADER_SEEN_KEY} ${flag})`,
  );
  step.check(
    opened && there.route === 'contact',
    `a click on the header's Contact ${CUT_AT} s in opens the contact page (${page.url()}, route ${there.route}; the opening stands at ${there.loader.stage}, ${there.loader.elapsed.toFixed(2)} s)`,
  );

  // The wheel, from the top of the contact page.
  await page.mouse.move(720, 450);
  const wheelFrom = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => window.__prevented.splice(0));
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel(0, 240);
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(600);
  const wheelY = await page.evaluate(() => window.scrollY);
  const wheels = await page.evaluate(() => window.__prevented.splice(0));
  step.check(
    wheelY > wheelFrom && wheels.length === 5 && wheels.every((e) => !e.prevented),
    `on the contact page five wheel turns scroll it: scrollY ${wheelFrom} → ${wheelY}, ${wheels.filter((e) => e.prevented).length} of ${wheels.length} prevented`,
  );

  // The keys, each from the top again.
  const byKey = async (key) => {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(300);
    const from = await page.evaluate(() => window.scrollY);
    await page.keyboard.press(key);
    await page.waitForTimeout(900);
    const events = await page.evaluate(() => window.__prevented.splice(0));
    const focus = await page.evaluate(() => document.activeElement?.tagName ?? null);
    return { from, to: await page.evaluate(() => window.scrollY), prevented: events.filter((e) => e.prevented).length, focus };
  };
  const keys = [];
  for (const key of ['Space', 'PageDown']) {
    const r = await byKey(key);
    keys.push(`${key} ${r.to}`);
    step.check(
      r.from === 0 && r.to > 0 && r.prevented === 0,
      `on Lite ${key} scrolls the page: scrollY ${r.from} → ${r.to}, not prevented (${r.prevented} prevented; focus on ${r.focus})`,
    );
  }

  // The file let through, and back on the project page the scene shows again, and the skip asked for at the link lands.
  const onLite = (await debugOf(page)).loader;
  release();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.goBack();
  const back = await page.waitForURL(`${BASE}/projects/steady/?proof`, { timeout: 5_000 }).then(
    () => true,
    () => false,
  );
  const backAt = Date.now();
  const landed = await page.waitForFunction(() => window.__needleDebug().loader.stage === 'home', null, { timeout: LITE_BACK_WITHIN_MS, polling: 20 }).then(
    () => true,
    () => false,
  );
  const landedIn = Date.now() - backAt;
  const home = await debugOf(page);
  step.check(
    back && landed && circleWhole(home.loader),
    `back on the project page, the file let through, the skip lands the show on the home view ${landedIn} ms later (within ${LITE_BACK_WITHIN_MS} ms; stage ${home.loader.stage}, circle cut ${circleOf(home.loader)}, the B marks ${othersOf(home.loader)}; on Lite it stood at ${onLite.stage}, ${onLite.elapsed.toFixed(2)} s)`,
  );
  await takeCsp(page, step);
  await context.close();
  return `Lite opened ${CUT_AT} s into a project page's show scrolls by wheel (${wheelY} px) and by key (${keys.join(', ')} px); back on the project the skip lands in ${landedIn} ms`;
}

/**
 * How long the skip may take to land once the project page is back (history back, a scene shown again) and the held
 * compass file let through, ms: the file, the bands' upload and the home's warm-up, then the skip's second, and slack.
 */
const LITE_BACK_WITHIN_MS = 6_000;

/**
 * The skip by touch, on a touch phone (390x844, touch, a coarse pointer). A first visit: from the moment the
 * scene shows until the tap, the tier is never high (a coarse pointer starts on the medium rung, without the
 * floor's reflection); a tap CUT_AT (1.5) s into the full show lands on HOME_IDLE within SKIP_WITHIN_MS, the tap's start
 * being the skip's and never prevented. Then a project page's full show (the seen flag cleared): a tap on the header's
 * Contact link CUT_AT s in still navigates, to /contact/.
 */
async function loaderSkipTouch(browser, step) {
  const { context, page } = await openPage(browser, step, () => false, { width: 390, height: 844 }, { hasTouch: true, isMobile: true });
  await watchLoader(context, 20);
  await context.addInitScript(() => {
    window.__inputAt = null;
    window.__starts = [];
    for (const type of ['pointerdown', 'touchstart']) {
      window.addEventListener(type, () => (window.__inputAt ??= performance.now()), { capture: true, passive: true });
    }
    // In the bubble phase: was the touch's start prevented by anything in the page?
    window.addEventListener('touchstart', (e) => window.__starts.push(e.defaultPrevented), { passive: true });
  });
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await page.bringToFront();
  await loaderAtLeast(page, CUT_AT);
  const at = (await debugOf(page)).loader;
  await page.touchscreen.tap(195, 422);
  const tapped = await reachHomeIdle(page).then(
    () => true,
    () => false,
  );
  const record = await loaderRecord(page);
  const inputAt = await page.evaluate(() => window.__inputAt);
  const starts = await page.evaluate(() => window.__starts);
  const took = inputAt !== null && record.idleAt !== null ? Math.round(record.idleAt - inputAt) : null;
  const shown = record.samples.filter((s) => record.readyAt !== null && s.t >= record.readyAt && inputAt !== null && s.t < inputAt);
  const tiers = [...new Set(shown.map((s) => s.tier))];
  step.check(
    shown.length > 0 && !tiers.includes('high'),
    `a touch phone draws the loader below the high tier, without the floor's reflection: tiers ${tiers.join(', ')} over ${shown.length} samples`,
  );
  step.check(at.stage === 'engrave' && at.elapsed >= CUT_AT && at.elapsed < CUT_AT + 2 * CUT_WITHIN, `a first visit plays the full show: ${CUT_AT} s in it engraves (stage ${at.stage} at ${at.elapsed.toFixed(2)} s)`);
  step.check(
    tapped && took !== null && took >= 0 && took <= SKIP_WITHIN_MS && starts.length > 0 && starts.every((prevented) => !prevented),
    `a tap at ${CUT_AT} s lands on HOME_IDLE ${took} ms later (within ${SKIP_WITHIN_MS} ms; the stages ${stagesOf(record.samples).join(' → ')}), its touchstart not prevented (${JSON.stringify(starts)})`,
  );
  await takeCsp(page, step);

  // A project page's full show: a tap on the menu's Contact link CUT_AT s in still navigates.
  await page.evaluate((key) => localStorage.removeItem(key), LOADER_SEEN_KEY);
  await page.goto(`${BASE}/projects/steady/?proof`, { waitUntil: 'load' });
  await loaderAtLeast(page, CUT_AT);
  const project = (await debugOf(page)).loader;
  // On a phone the links are in the menu (option A, 2026-10-22): the tap on Menu is the one that skips, then Contact.
  await page.tap('.menu-toggle');
  await page.tap('#site-menu a[href="/contact/"]');
  const navigated = await page.waitForURL(`${BASE}/contact/`, { timeout: 5_000 }).then(
    () => true,
    () => false,
  );
  const route = navigated ? (await debugOf(page)).route : null;
  step.check(
    project.stage === 'engrave' && project.elapsed >= CUT_AT,
    `a project page's first show plays in full: ${CUT_AT} s in it engraves (stage ${project.stage} at ${project.elapsed.toFixed(2)} s)`,
  );
  step.check(navigated && route === 'contact', `a tap on Menu, then on its Contact link, ${CUT_AT} s in still navigates (${page.url()}, route ${route})`);
  await takeCsp(page, step);
  await context.close();
  return `a phone's loader at tier ${tiers.join('/')}; a tap at ${CUT_AT} s lands in ${took} ms; a tap on a header link during a project page's show navigates`;
}

/** How late the quick path may land after the load, s: its whole length, QUICK.home, and the brief's margin. */
const QUICK_WITHIN = QUICK.home + 0.5;

/**
 * The quick path (spec §2.1, a later visit): a fresh context plays the full show (it engraves) and, landed, marks the
 * loader seen in this browser (`bob-loader-seen` = 1 in localStorage). Reloaded with the flag set, the opening never
 * engraves (dark until the load, then open, rise, home) and reaches HOME_IDLE within QUICK_WITHIN s of the load: of the
 * first sample past `dark`, which comes at the load (the quick path's spans run from it).
 */
async function quickLoader(browser, step) {
  const { context, page } = await openPage(browser, step);
  await watchLoader(context, 25);
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await page.bringToFront();
  await reachHomeIdle(page);
  const first = stagesOf((await loaderRecord(page)).samples);
  const seen = await page.evaluate((key) => localStorage.getItem(key), LOADER_SEEN_KEY);
  step.check(first.includes('engrave') && seen === '1', `a first visit engraves (${first.join(' → ')}) and, landed, marks the loader seen in this browser (${LOADER_SEEN_KEY} ${seen})`);
  await takeCsp(page, step);

  await page.reload({ waitUntil: 'load' });
  await reachHomeIdle(page);
  const again = await loaderRecord(page);
  const stages = stagesOf(again.samples);
  step.check(stages.length > 0 && !stages.includes('engrave') && stages.at(-1) === 'home', `with ${LOADER_SEEN_KEY} set it never engraves: the quick path (${stages.join(' → ')})`);
  const loadedAt = again.samples.find((sample) => sample.stage !== null && sample.stage !== 'dark')?.t ?? null;
  const took = loadedAt !== null && again.idleAt !== null ? Math.round(again.idleAt - loadedAt) : null;
  step.check(
    took !== null && took >= 0 && took <= QUICK_WITHIN * 1000,
    `and HOME_IDLE comes ${took} ms after the load (the first moment past dark, ${loadedAt} ms), within QUICK.home + 0.5 s = ${QUICK_WITHIN * 1000} ms (ready at ${Math.round(again.readyAt)} ms, HOME_IDLE at ${Math.round(again.idleAt)} ms)`,
  );
  const whole = again.samples.filter((sample) => sample.stage !== null && sample.stage !== 'dark');
  step.check(
    whole.length > 0 && whole.every((sample) => sample.circle === 1 && sample.others === 0),
    `the circle is cut whole from the first frame it shows, and nothing else is (circle ${[...new Set(whole.map((sample) => sample.circle))].join(' ')}, the B marks ${[...new Set(whole.map((sample) => sample.others))].join(' ')})`,
  );
  await takeCsp(page, step);
  await context.close();
  return `a first visit: ${first.join(' → ')}; with the flag: ${stages.join(' → ')}, HOME_IDLE ${took} ms after the load (limit ${QUICK_WITHIN * 1000})`;
}

/** Two camera samples are the same shot: position and field of view, to a millionth. */
const sameShot = (a, b) => a.fov > 0 && Math.abs(a.fov - b.fov) < 1e-6 && a.position.every((value, i) => Math.abs(value - b.position[i]) < 1e-6);

/**
 * Reduced motion (spec §2.1: the engraved name and the compass fade in within about a second): the opening never
 * engraves (dark until the load, the fade, home), the circle is whole whenever it shows, the camera is the home shot
 * throughout (three samples identical: the first with a camera once the opening shows, one half way, and the landed
 * home), and the fade marks nothing seen (a later visit is one after the full show has played).
 */
async function loaderReduced(browser, step) {
  const { context, page } = await openPage(browser, step, () => false, { width: 1440, height: 900 }, { reducedMotion: 'reduce' });
  await watchLoader(context, 50);
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await page.bringToFront();
  step.check(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), 'the page asks for reduced motion');
  await reachHomeIdle(page);
  await page.waitForTimeout(700); // the watcher's last samples, of the landed home
  const { samples, readyAt } = await page.evaluate(() => ({ samples: window.__loaderSamples, readyAt: window.__readyAt }));
  const stages = stagesOf(samples);
  step.check(!stages.includes('engrave') && !stages.includes('open') && stages.at(-1) === 'home', `the opening never engraves: ${stages.join(' → ')} over ${samples.length} samples`);
  const shown = samples.filter((sample) => sample.stage !== null && sample.stage !== 'dark');
  step.check(
    shown.length > 0 && shown.every((sample) => sample.circle === 1 && sample.others === 0),
    `the circle is whole whenever it shows, and nothing else is cut (circle ${[...new Set(shown.map((sample) => sample.circle))].join(' ')}, the B marks ${[...new Set(shown.map((sample) => sample.others))].join(' ')})`,
  );
  // From the moment the canvas shows (data-ready): before it, the Stage's camera stands where three made it, unseen.
  const framed = samples.filter((sample) => readyAt !== null && sample.t > readyAt && sample.stage !== null && sample.camera.fov > 0);
  const three = framed.length >= 3 ? [framed[0], framed[Math.floor(framed.length / 2)], framed.at(-1)] : framed;
  step.check(
    three.length === 3 && three.every((sample) => sameShot(sample.camera, three[0].camera)),
    `once the canvas shows (${Math.round(readyAt)} ms), the camera shot is the same in three samples (${three.map((sample) => `${sample.stage} at ${sample.t} ms: [${sample.camera.position.map((v) => v.toFixed(3)).join(', ')}] fov ${sample.camera.fov.toFixed(2)}`).join('; ')})`,
  );
  const seen = await page.evaluate((key) => localStorage.getItem(key), LOADER_SEEN_KEY);
  step.check(seen === null, `the reduced fade marks nothing seen (${LOADER_SEEN_KEY} ${seen})`);
  await takeCsp(page, step);
  await context.close();
  return `${stages.join(' → ')} over ${samples.length} samples, the camera still across ${three.length} samples, nothing marked seen`;
}

/**
 * When the card must show, s from the page's start: the loader's give-up (LOADER.giveUp, 25 visible seconds of its own
 * clock, which starts once the scene is built, under a second in) and two seconds more.
 */
const GIVE_UP_WINDOW = [LOADER.giveUp, LOADER.giveUp + 2];

/**
 * Giving up (spec §2.1): the compass's file (/models/bob-compass.glb) never answers, so the home never loads. On /en/,
 * the fallback card ("THE NEEDLE LOST NORTH", the English copy's title) with its link to Lite shows between 25 and 27 s
 * after the page started (performance.now(), the document's own clock), not before; the time from the scene's
 * data-ready (the loader showing) is reported beside it. SceneHost's report of the give-up is a warning, not an error.
 */
async function giveUp(browser, step) {
  const { t } = new Translator('en');
  const { context, page } = await openPage(browser, step);
  await watchLoader(context, 25);
  let asked = 0;
  await page.route('**/models/bob-compass.glb', () => {
    asked++; // never answered
  });
  await page.goto(`${BASE}/en/?proof`, { waitUntil: 'load' });
  await page.bringToFront();
  const card = await page.waitForSelector('.scene-fallback', { timeout: (GIVE_UP_WINDOW[1] + 15) * 1000 }).then(() => true, () => false);
  await page.waitForFunction(() => window.__cardAt !== null, null, { timeout: 2_000 }).catch(() => {});
  const timing = await page.evaluate(() => ({ readyAt: window.__readyAt, cardAt: window.__cardAt }));
  const at = timing.cardAt !== null ? timing.cardAt / 1000 : null;
  const afterReady = timing.readyAt !== null && at !== null ? at - timing.readyAt / 1000 : null;
  const state = await page.evaluate(() => ({
    title: document.querySelector('.scene-fallback-title')?.textContent ?? null,
    link: document.querySelector('.scene-fallback a')?.getAttribute('href') ?? null,
    canvases: document.querySelectorAll('canvas').length,
    phase: window.__needleDebug?.().phase.kind ?? null,
  }));
  step.check(asked >= 1, `the page asked for the compass's file and got no answer (${asked} requests)`);
  step.check(
    card && at !== null && at >= GIVE_UP_WINDOW[0] && at <= GIVE_UP_WINDOW[1],
    `the fallback card shows ${at?.toFixed(2)} s after the page started, between ${GIVE_UP_WINDOW[0]} and ${GIVE_UP_WINDOW[1]} s (${afterReady?.toFixed(2)} s after the loader showed, at ${Math.round(timing.readyAt)} ms)`,
  );
  step.check(state.title === t.needle.fallback.title && state.link === '/en/lite/', `it says "${t.needle.fallback.title}", with Lite one link away (got "${state.title}", ${state.link})`);
  step.check(state.canvases === 0 && state.phase === 'HOME_IDLE', `no canvas is left, and the page is out of LOADING (${state.canvases} canvas, ${state.phase})`);
  await takeCsp(page, step);
  await context.close();
  return `the file never answers: "${state.title}" ${at?.toFixed(2)} s after the page started, ${afterReady?.toFixed(2)} s after the loader showed (window ${GIVE_UP_WINDOW.join('-')} s)`;
}

/**
 * Landed and left alone, with no input at all, the canvas runs the home's idle motion and then draws nothing: no
 * requestAnimationFrame of the page's for a whole second, within DRIFT_RUN + SLEEP_WITHIN_MS of the landing. With no
 * pointer moved the needle is on its drift, which runs on past the idle while to its next rest (DRIFT_RUN, 14 s), so the
 * canvas must not fall quiet before DRIFT_RUN - 2 s.
 */
async function sleep(browser, step) {
  const { context, page } = await openPage(browser, step);
  await countAllFrames(context);
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await page.bringToFront();
  await reachHomeIdle(page);
  const limit = DRIFT_RUN * 1000 + SLEEP_WITHIN_MS;
  const slept = await settlesToStorm(page, limit);
  step.check(slept !== null, `landed and left alone, the canvas draws the storm alone, no more than ${STORM_FPS_MAX} frames a second for a whole second, from ${slept} ms after the landing (within DRIFT_RUN + SLEEP_WITHIN_MS = ${limit} ms)`);
  step.check(slept !== null && slept >= (DRIFT_RUN - 2) * 1000, `and it ran the drift on to its rest first: it settled ${slept} ms after the landing (the drift rests at ${DRIFT_RUN} s)`);
  await takeCsp(page, step);
  await context.close();

  // With reduced motion the storm stands still, and the canvas sleeps as it always did.
  const reduced = await openPage(browser, step);
  await countAllFrames(reduced.context);
  await reduced.page.emulateMedia({ reducedMotion: 'reduce' });
  await reduced.page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await reduced.page.bringToFront();
  await reachHomeIdle(reduced.page);
  const still = await sleepWithin(reduced.page, SLEEP_WITHIN_MS);
  const storm = (await debugOf(reduced.page))?.journey.storm ?? null;
  step.check(still !== null, `with reduced motion the canvas draws nothing for a whole second from ${still} ms after the landing (within ${SLEEP_WITHIN_MS} ms)`);
  step.check(storm !== null && storm.moving === false && storm.sky > 0, `and the storm is there but stands still (${JSON.stringify(storm)})`);
  await takeCsp(reduced.page, step);
  await reduced.context.close();
  return `the idle motion and the drift ran to the drift's rest, then the canvas drew the storm alone ${slept} ms after the landing (limit ${limit} ms); with reduced motion it slept ${still} ms after the landing, the storm still`;
}

/** The mean difference of two stills, 0..1 per channel, read in a page of its own (as lumaOf reads one). */
async function stillsDiffer(browser, a, b) {
  const meter = await browser.newContext();
  const page = await meter.newPage();
  const url = (file) => `data:image/png;base64,${readFileSync(file).toString('base64')}`;
  const diff = await page.evaluate(async ([ua, ub]) => {
    const load = (src) => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src; });
    const [ia, ib] = await Promise.all([load(ua), load(ub)]);
    const w = 360;
    const h = Math.round((ia.height / ia.width) * w);
    const read = (img) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(img, 0, 0, w, h); return g.getImageData(0, 0, w, h).data; };
    const da = read(ia);
    const db = read(ib);
    let sum = 0;
    for (let i = 0; i < da.length; i += 4) sum += Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
    return sum / ((da.length / 4) * 3 * 255);
  }, [url(a), url(b)]);
  await meter.close();
  return diff;
}

/** How much a still must change over 3 s for the storm to count as moving (mean, 0..1 per channel). */
const STORM_MOVES = 0.004;

/**
 * Round 8's glare guard (spec 2026-10-30-bob-moonlit-3d-design.md, an anti-goal: "white blocks of reflected light on the
 * glass bands"): in the compass's box at the start screen (the middle `box` of the still), at most `share` of its pixels
 * may be near white (luma above `luma`).
 */
const GLARE = { box: [0.5, 0.6], luma: 0.95, share: 0.002 };

/** The share of a still's pixels in its middle `box` (width, height shares) whose luma is above `over`, read at full size. */
async function clippedShare(browser, file, box, over) {
  const meter = await browser.newContext();
  const page = await meter.newPage();
  const share = await page.evaluate(
    async ([src, [bw, bh], limit]) => {
      const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
      const w = Math.round(img.width * bw);
      const h = Math.round(img.height * bh);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d');
      g.drawImage(img, Math.round((img.width - w) / 2), Math.round((img.height - h) / 2), w, h, 0, 0, w, h);
      const d = g.getImageData(0, 0, w, h).data;
      let hot = 0;
      for (let i = 0; i < d.length; i += 4) if ((0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255 > limit) hot++;
      return hot / (w * h);
    },
    [`data:image/png;base64,${readFileSync(file).toString('base64')}`, box, over]
  );
  await meter.close();
  return share;
}

/**
 * The storm behind everything (spec 2026-10-30-bob-storm-design.md): see the step list. Read through the bridge's
 * `journey.storm` (src/scene/bob/storm.ts's levels, faded in) and two stills 3 s apart.
 */
async function storm(browser, step) {
  const summary = [];
  for (const size of STILL_SIZES) {
    const at = sizeName(size);
    const { context, page, touch } = await readyHome(browser, step, size);
    await poseAt(page, 0);
    // In once its plates are, faded in over STORM.fadeIn.
    const came = await page.waitForFunction((home) => { const st = window.__needleDebug().journey.storm; return st !== null && st.sky >= home - 1e-9 && st.flats >= 1 - 1e-9; }, STORM.sky.home, { timeout: 15_000 }).then(() => true, () => false);
    let s = (await debugOf(page)).journey.storm;
    step.check(came && near(s.sky, STORM.sky.home, 1e-3) && near(s.flats, 1, 1e-3) && s.moving === true, `${at}: at the start screen the storm is in, its sky at ${STORM.sky.home} and its flats whole, and moving (${JSON.stringify(s)})`);
    const a = join(STILLS, `storm-home-a-${at}.png`);
    const b = join(STILLS, `storm-home-b-${at}.png`);
    await page.screenshot({ path: a });
    await page.waitForTimeout(3_000);
    await page.screenshot({ path: b });
    const moved = await stillsDiffer(browser, a, b);
    step.check(moved >= STORM_MOVES, `${at}: and the picture changes over 3 s (mean difference ${moved.toFixed(4)}, at least ${STORM_MOVES})`);
    const glare = Math.max(await clippedShare(browser, a, GLARE.box, GLARE.luma), await clippedShare(browser, b, GLARE.box, GLARE.luma));
    step.check(glare <= GLARE.share, `${at}: no glare on the compass, ${(glare * 100).toFixed(3)}% of its box near white (at most ${GLARE.share * 100}%)`);
    // Past the clouds coming in (way frame 95), the storm at its fall light.
    s = (await poseAt(page, placeOfFrame(110))).journey.storm;
    await page.waitForTimeout(300);
    s = (await debugOf(page)).journey.storm;
    step.check(near(s.sky, STORM.sky.fall, 1e-3) && s.flats === 0 && s.moving === true, `${at}: in the fall (way frame 110) its sky at ${STORM.sky.fall}, no flats, moving (${JSON.stringify(s)})`);
    await poseAt(page, worldStop(HOME_CHAPTERS));
    await page.waitForTimeout(300);
    s = (await debugOf(page)).journey.storm;
    step.check(near(s.sky, STORM.sky.void, 1e-3) && s.flats === 0, `${at}: at the world's stop its sky at ${STORM.sky.void} (${JSON.stringify(s)})`);
    // Left alone there: the world's clock runs IDLE_SECONDS after the move, then the storm draws alone.
    const settled = await settlesToStorm(page, (IDLE_SECONDS + 4) * 1000);
    const fps = await framesPerSecond(page, 2_000);
    step.check(settled !== null && fps <= STORM_FPS_MAX && fps >= STORM.fps / 3, `${at}: left alone there the canvas draws the storm alone, ${fps.toFixed(1)} frames a second (between ${STORM.fps / 3} and ${STORM_FPS_MAX})`);
    summary.push(`${at}: in at ${STORM.sky.home} and moving (${moved.toFixed(4)} over 3 s), ${STORM.sky.fall} in the fall, ${STORM.sky.void} at the world, ${fps.toFixed(1)} fps alone`);
    await takeCsp(page, step);
    await context.close();
  }

  // A project's page, reached by the home's own link: the storm behind it stands still.
  const { context, page } = await readyHome(browser, step, STILL_SIZES[0]);
  await page.focus('.home-nav a[href="/projects/steady/"]');
  await page.keyboard.press('Enter');
  await page.waitForURL((url) => url.pathname === '/projects/steady/', { timeout: 5_000 });
  await page.waitForTimeout(2_000);
  const first = (await debugOf(page)).journey.storm;
  await page.waitForTimeout(1_000);
  const then = (await debugOf(page)).journey.storm;
  step.check(first !== null && first.moving === false && then.clock === first.clock, `on /projects/steady/ the storm behind the page stands still (${JSON.stringify(first)} then ${JSON.stringify(then)})`);
  await takeCsp(page, step);
  await context.close();

  // Reduced motion, asked for before the page loads: in at once, and still.
  const reduced = await openPage(browser, step);
  await reduced.page.emulateMedia({ reducedMotion: 'reduce' });
  await reduced.page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await reachHomeIdle(reduced.page);
  await reduced.page.waitForFunction(() => window.__needleDebug().journey.storm !== null, null, { timeout: 15_000 }).catch(() => {});
  await reduced.page.waitForTimeout(1_500);
  const r1 = (await debugOf(reduced.page)).journey.storm;
  await reduced.page.waitForTimeout(1_000);
  const r2 = (await debugOf(reduced.page)).journey.storm;
  step.check(r1 !== null && r1.moving === false && near(r1.sky, STORM.sky.home, 1e-3) && r2.clock === r1.clock, `with reduced motion the storm is in at once and stands still (${JSON.stringify(r1)} then ${JSON.stringify(r2)})`);
  await takeCsp(reduced.page, step);
  await reduced.context.close();
  return `${summary.join('; ')}; still behind a project's page and with reduced motion`;
}

/** The entry chunk of the client bundle: without it the page never hydrates. */
const ENTRY_CHUNK = /\/assets\/entry\.client-[^/]+\.js$/;

/**
 * Records the hero every 50 ms from the document's start in `window.__heroSamples`: performance.now() ms, its computed
 * opacity and the header's (`header`, which goes and comes with it on the home page), the page's `data-route` (set once
 * it hydrates) and the phase where the bridge answers. Only from the first moment the page can paint: while a stylesheet
 * of the head is still loading, nothing is drawn (it blocks rendering) and the computed style is the browser's default,
 * opacity 1, which no visitor sees. (The home's head preloads its modules before its stylesheet, so its body is parsed
 * before the sheet has arrived.) The stylesheets that hold it back are the document's own, those there once it is parsed
 * (DOMContentLoaded): one a script inserts later (a lazy chunk's CSS) blocks no paint, and never pauses the watch.
 */
const watchHero = (context) =>
  context.addInitScript(() => {
    window.__heroSamples = [];
    const sheets = () => [...document.querySelectorAll('link[rel="stylesheet"]')];
    let parsed = null; // the document's own stylesheets, once it is parsed
    document.addEventListener('DOMContentLoaded', () => (parsed = sheets()), { once: true });
    setInterval(() => {
      const hero = document.querySelector('.hero');
      const header = document.querySelector('.site-header');
      if (!hero || !header) return;
      if ((parsed ?? sheets()).some((link) => link.sheet === null)) return; // not painted yet
      window.__heroSamples.push({
        t: Math.round(performance.now()),
        opacity: Number(getComputedStyle(hero).opacity),
        header: Number(getComputedStyle(header).opacity),
        route: document.documentElement.getAttribute('data-route'),
        phase: window.__needleDebug?.().phase.kind ?? null,
      });
    }, 50);
  });

/** Whether watchHero has recorded the hero and the header whole (opacity 1) within `timeout` ms: read from its samples, not the live style, which they may lag. */
const heroWhole = (page, timeout) =>
  page.waitForFunction(() => window.__heroSamples.some((sample) => sample.opacity === 1 && sample.header === 1), null, { timeout, polling: 100 }).then(() => true, () => false);

/**
 * The hero's CSS fail-safe, and the header's with it. With JavaScript on but the entry chunk refused (the
 * route aborts it), the page never hydrates: the hero and the header are hidden (scripting is on, so the page waits for
 * the bundle) and then shown by the fail-safe, 8 s in, faded in over 0.9 s. The step expects the browser's report of
 * the refused chunk and of the failed import, and nothing else. With the page working, the hero and the header stay
 * hidden until the phase is HOME_IDLE (the opening has landed: the loader has no text but the engraving) and then show.
 */
async function heroFailsafe(browser, step) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__cspViolations.push({ directive: e.violatedDirective, blocked: e.blockedURI, sample: e.sample });
    });
  });
  await watchHero(context);
  const page = await context.newPage();
  const reports = { load: 0, import: 0 };
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const refused = message.text() === 'Failed to load resource: net::ERR_FAILED' && ENTRY_CHUNK.test(message.location().url ?? '');
    if (refused) reports.load++;
    (refused ? step.expected : step.errors).push(message.text());
  });
  page.on('pageerror', (error) => {
    const failed = /^Failed to fetch dynamically imported module: \S*\/assets\/entry\.client-/.test(error.message);
    if (failed) reports.import++;
    (failed ? step.expected : step.errors).push(error.message);
  });
  let refused = 0;
  await page.route(ENTRY_CHUNK, (route) => {
    refused++;
    return route.abort();
  });
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  const shown = await heroWhole(page, 12_000);
  const broken = await page.evaluate(() => ({ samples: window.__heroSamples, name: document.querySelector('.hero h1')?.textContent ?? null }));
  const firstShown = broken.samples.find((sample) => sample.opacity > 0)?.t ?? null;
  const whole = broken.samples.find((sample) => sample.opacity === 1)?.t ?? null;
  const headerFirst = broken.samples.find((sample) => sample.header > 0)?.t ?? null;
  const headerWhole = broken.samples.find((sample) => sample.header === 1)?.t ?? null;
  step.check(refused >= 1 && broken.samples.length > 0 && broken.samples.every((sample) => sample.route === null), `the entry chunk refused (${refused} requests): the page never hydrates (no data-route in ${broken.samples.length} samples)`);
  step.check(reports.load >= 1 && reports.import === 1, `the browser reports the refused chunk and the failed import, and nothing else (${reports.load} "Failed to load resource", ${reports.import} failed import)`);
  step.check(firstShown !== null && firstShown >= 7_900, `the hero stays hidden until the fail-safe, about 8 s in: first shown at ${firstShown} ms`);
  step.check(shown && whole !== null && whole <= 10_500 && broken.name === HOME_H1, `then it shows, whole at ${whole} ms (8 s and a 0.9 s fade), "${broken.name}"`);
  step.check(
    headerFirst !== null && headerFirst >= 7_900 && headerWhole !== null && headerWhole <= 10_500,
    `the header goes with it: hidden until the fail-safe (first shown at ${headerFirst} ms), then whole at ${headerWhole} ms`,
  );
  await takeCsp(page, step);
  await context.close();

  // Working: the hero and the header wait for the landing.
  const working = await openPage(browser, step);
  await watchHero(working.context);
  await working.page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await working.page.bringToFront();
  await reachHomeIdle(working.page);
  const appears = await heroWhole(working.page, 3_000);
  const { samples } = await working.page.evaluate(() => ({ samples: window.__heroSamples }));
  const before = samples.filter((sample) => sample.phase !== 'HOME_IDLE');
  const idleAt = samples.find((sample) => sample.phase === 'HOME_IDLE')?.t ?? null;
  const wholeAt = samples.find((sample) => sample.opacity === 1)?.t ?? null;
  const headerAt = samples.find((sample) => sample.header === 1)?.t ?? null;
  const peeked = before.filter((sample) => sample.opacity > 0);
  const headerPeeked = before.filter((sample) => sample.header > 0);
  step.check(before.length > 10 && peeked.length === 0, `working, the hero is hidden until HOME_IDLE: ${before.length} samples before it (from the first paint, through hydration and the opening), ${peeked.length} with the hero showing (${JSON.stringify(peeked.slice(0, 2))})`);
  step.check(appears && idleAt !== null && wholeAt !== null && wholeAt - idleAt <= 1_500, `and it shows once landed: HOME_IDLE at ${idleAt} ms, the hero whole at ${wholeAt} ms`);
  step.check(
    headerPeeked.length === 0 && headerAt !== null && idleAt !== null && headerAt - idleAt <= 1_500,
    `the header too: the loader shows no text but the engraving (${headerPeeked.length} of ${before.length} samples before HOME_IDLE with the header showing), and it is whole at ${headerAt} ms`,
  );
  await takeCsp(working.page, step);
  await working.context.close();
  return `entry chunk refused: the hero and the header hidden, then shown by the fail-safe at ${firstShown} / ${headerFirst} ms (whole at ${whole} / ${headerWhole} ms); working: both hidden until HOME_IDLE (${idleAt} ms), whole at ${wholeAt} / ${headerAt} ms`;
}

/**
 * Two points on the right B's strokes on the glass (src/engine/bob/wordmark.ts): on its back, the stroke nearest the O,
 * and on its foot 3.3 m from the middle, farther out. The light runs out of the O past |x| = 1.9 (src/engine/bob/build/
 * engraving.ts `ENGRAVING_LOOK.letters`): the back lights first, the foot there only past half the way.
 */
const B_INNER = [WORDMARK.b.rightX, 0, 0.9];
const B_OUTER = [3.3, 0, WORDMARK.b.nearZ];
/** A point's brightest pixel at or under this is dark; at or over LETTER_LIT, lit. */
const LETTER_DARK = 0.12;
const LETTER_LIT = 0.2;

/**
 * The B letters made like the compass's bands (spec 2026-10-29-bob-stack-2-design.md, goal 5), at 1440x900 and 390x844
 * (touch): on a laptop wheel notches from the home light them from 0 to 1 and never back (the bridge's
 * `scroll.letters`); posed on the rise where they are dark (their share 0), half lit and whole, a point on the right B's
 * back and one on its foot, projected through the rise's camera, are dark at 0, the back lit and the foot still dark at
 * half (from the O outward), and both lit whole.
 */
async function letters(browser, step) {
  const THREE = await import('three');
  const meter = await browser.newContext();
  const meterPage = await meter.newPage();
  const summary = [];
  mkdirSync(STILLS, { recursive: true });
  for (const size of TWO_SIZES) {
    const at = sizeName(size);
    const aspect = size.width / size.height;
    const { context, page, touch } = await readyHome(browser, step, size);
    if (!touch) {
      const shares = [];
      for (let i = 0; i < RISE.notches; i++) {
        await page.mouse.wheel(0, RISE.notchPx);
        await page.waitForTimeout(80);
        shares.push((await debugOf(page)).scroll.letters);
      }
      await restAt(page);
      shares.push((await debugOf(page)).scroll.letters);
      step.check(shares[0] < 1 && shares.at(-1) === 1 && shares.every((v, i) => i === 0 || v >= shares[i - 1] - 1e-9), `${at}: wheel notches from the home light the letters from 0 to 1, never back (${shares.map((v) => v.toFixed(2)).join(' ')})`);
    }
    const read = {};
    for (const place of [
      { name: 'dark', u: 0.25 },
      { name: 'half', u: 0.6125 },
      { name: 'whole', u: 1 },
    ]) {
      const state = await poseAt(page, place.u);
      await page.waitForTimeout(400);
      const shot = scrollPoseAt(place.u, aspect).shot;
      const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 400);
      applyCameraShot(camera, shot, aspect);
      camera.updateMatrixWorld(true);
      const gap = Math.hypot(...state.camera.position.map((v, i) => v - shot.position[i]));
      const peakAt = async (point, name) => {
        const v = new THREE.Vector3(...point).project(camera);
        const x = ((v.x + 1) / 2) * size.width;
        const y = ((1 - v.y) / 2) * size.height;
        // Off the screen, or too near its edge for the box round it: nothing to read.
        if (!(x >= 12 && x <= size.width - 12 && y >= 12 && y <= size.height - 12)) return Number.NaN;
        const file = join(STILLS, `letters-${name}-${place.name}-${at}.png`);
        await page.screenshot({ path: file, clip: { x: x - 12, y: y - 12, width: 24, height: 24 } });
        return (await lumaOf(meterPage, file)).peakAll;
      };
      read[place.name] = { share: state.scroll.letters, inner: await peakAt(B_INNER, 'inner'), outer: await peakAt(B_OUTER, 'outer'), gap };
    }
    const { dark, half, whole } = read;
    const text = (r) => `share ${r.share.toFixed(2)}: the back ${r.inner.toFixed(3)}, the foot ${r.outer.toFixed(3)}`;
    // Near the rise's start the camera stood 0.13 m off the shot at 1440x900: a pixel or two at the B, from 15 m.
    step.check([dark, half, whole].every((r) => r.gap <= 0.25), `${at}: the camera within 0.25 m of the rise's shot at each place, where the points are projected (${[dark, half, whole].map((r) => r.gap.toFixed(4)).join(', ')} m)`);
    // At share 0 a phone's rise still has the foot at the screen's edge (NaN: not read); the back is in view at every place.
    step.check(dark.share === 0 && dark.inner <= LETTER_DARK && (Number.isNaN(dark.outer) || dark.outer <= LETTER_DARK), `${at}: nothing of a B shows at share 0 (${text(dark)}; ${LETTER_DARK} or less)`);
    step.check(half.share > 0.4 && half.share < 0.6 && half.inner >= LETTER_LIT && half.outer <= LETTER_DARK, `${at}: half way the B lights from the O outward: its back lit, its foot farther out still dark (${text(half)})`);
    step.check(whole.share === 1 && whole.inner >= LETTER_LIT && whole.outer >= LETTER_LIT, `${at}: at BOB from above the B is lit whole (${text(whole)}; ${LETTER_LIT} or more)`);
    summary.push(`${at}: ${text(dark)}; ${text(half)}; ${text(whole)}`);
    await context.close();
  }
  await meter.close();
  return summary.join('; ');
}

// ---------------------------------------------------------------- the debug bridge, the keyboard, a language switch, reduced motion

/** Every proof hook the site has had; today the bridge is the only one. */
const HOOK_NAMES = ['__needleDebug', '__needleScene', '__needleFrame', '__needleMounts', '__needleScrollRequest'];
/** The fields of the bridge's state (src/debug/needleDebug.ts, NeedleDebugState), sorted. */
const STATE_KEYS = ['camera', 'canvasMounts', 'chapter', 'contextLost', 'dpr', 'fps', 'journey', 'loader', 'locale', 'needleAngle', 'phase', 'progress', 'route', 'scroll', 'target', 'threeD', 'tier', 'velocity'];
/**
 * The last chapter of the home scroll, and the place its story ends: the last stop, the start of the last chapter, the
 * end page's (the last unit is END, after the last bead's, so the scroll never goes into it: past its start the end page
 * scrolls natively), and that chapter's id.
 */
const LAST_UNIT = HOME_CHAPTERS.units.length - 1;
const STORY_END = scrollEnd(HOME_CHAPTERS);
const LAST_CHAPTER = HOME_CHAPTERS.units[LAST_UNIT].id;

/**
 * The debug bridge exists under `?proof` and nowhere else. Without it, nothing of the site reads or writes a proof hook,
 * not even through the opening's landing and a scroll gesture's frames (every hook the site has had is trapped on the
 * window, and a gesture and a pause go by); with it, the state has every field and the actions act: `.set` puts the
 * story somewhere, `.dispatch` sends an event, and the old hooks are gone.
 */
async function bridge(browser, step) {
  // No ?proof: a trap on every hook name records any read or write of it.
  {
    const { context, page } = await openPage(browser, step);
    await context.addInitScript((names) => {
      window.__touched = [];
      for (const name of names) {
        Object.defineProperty(window, name, {
          configurable: true,
          get() {
            window.__touched.push(`get ${name}`);
            return undefined;
          },
          set() {
            window.__touched.push(`set ${name}`);
          },
        });
      }
    }, HOOK_NAMES);
    await page.goto(`${BASE}/`, { waitUntil: 'load' });
    // The wheel moves the story from HOME_IDLE on, not while the opening plays. With no bridge to read the phase, the
    // page says it: the scene shows (data-ready) and <html data-loading> (set while the phase is LOADING) is gone.
    const landedAt = await page
      .waitForFunction(
        () => document.querySelector('.scene-host')?.hasAttribute('data-ready') && document.documentElement.hasAttribute('data-route') && !document.documentElement.hasAttribute('data-loading'),
        null,
        { timeout: LANDED_WITHIN_MS },
      )
      .then(() => true, () => false);
    step.check(landedAt, 'without ?proof the opening lands: the scene shows and the page is no longer data-loading');
    await page.evaluate(() => {
      window.__wheels = [];
      window.addEventListener('wheel', (event) => window.__wheels.push(event.defaultPrevented), { passive: true });
    });
    await page.mouse.move(720, 450);
    for (let i = 0; i < 10; i++) {
      await page.mouse.wheel(0, 120);
      await page.waitForTimeout(16);
    }
    await page.waitForTimeout(1_500); // the glide and the damping run their frames
    const wheels = await page.evaluate(() => window.__wheels);
    step.check(wheels.length === 10 && wheels.every(Boolean), 'without ?proof the scroll loop still runs: the wheel is taken (10 of 10 prevented)');
    const touched = await page.evaluate(() => window.__touched);
    step.check(touched.length === 0, `without ?proof nothing of the site reads or writes a proof hook, through load, a scene, a wheel gesture and its frames (touched: ${touched.join(', ') || 'nothing'})`);
    await takeCsp(page, step);
    await context.close();
  }

  // ?proof: the bridge, the state, the actions.
  const { context, page } = await openPage(browser, step);
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await stageReady(page);
  await reachHomeIdle(page);
  await page.waitForFunction(() => document.querySelector('.scene-host')?.hasAttribute('data-ready'), null, { timeout: LOAD_TIMEOUT_MS + 3_000 });
  const old = await page.evaluate((names) => names.filter((name) => name !== '__needleDebug' && name in window), HOOK_NAMES);
  step.check(old.length === 0, `with ?proof the old hooks are gone (found: ${old.join(', ') || 'none'})`);
  const shape = await page.evaluate(() => ({
    isFunction: typeof window.__needleDebug === 'function',
    actions: [typeof window.__needleDebug.set, typeof window.__needleDebug.dispatch, typeof window.__needleDebug.seekLoader, typeof window.__needleDebug.scrollRequest],
  }));
  step.check(shape.isFunction && shape.actions.join() === 'function,function,function,function', `window.__needleDebug is a function with .set, .dispatch, .seekLoader and .scrollRequest (got ${JSON.stringify(shape)})`);

  const at = await debugOf(page);
  step.check(JSON.stringify(Object.keys(at).sort()) === JSON.stringify(STATE_KEYS), `its state has exactly these fields: ${STATE_KEYS.join(', ')} (got ${Object.keys(at).sort().join(', ')})`);
  step.check(at.phase.kind === 'HOME_IDLE' && at.progress === 0 && at.target === 0 && at.velocity === 0, `on / at rest: HOME_IDLE, progress 0, target 0, velocity 0 (got ${JSON.stringify([at.phase, at.progress, at.target, at.velocity])})`);
  step.check(JSON.stringify(at.chapter) === JSON.stringify({ index: 0, id: 'HOME', local: 0, category: null }), `the chapter is HOME, index 0, local 0 (got ${JSON.stringify(at.chapter)})`);
  step.check(at.route === 'home' && at.locale === 'nl' && at.threeD === true && at.contextLost === false && at.canvasMounts === 1, `route home, locale nl, 3D on, context there, one Stage (got ${JSON.stringify([at.route, at.locale, at.threeD, at.contextLost, at.canvasMounts])})`);
  step.check(['high', 'medium', 'low'].includes(at.tier) && at.dpr >= 1 && at.camera.fov > 0 && at.camera.position.length === 3, `a tier, a pixel ratio and a camera from the Stage (got ${at.tier}, dpr ${at.dpr}, ${JSON.stringify(at.camera)})`);
  step.check(
    at.loader.stage === 'home' && circleWhole(at.loader) && at.loader.elapsed > 0,
    `landed, the opening stands at home with the circle cut whole and no B mark cut: the loader cuts the circle alone (got ${JSON.stringify(at.loader)})`,
  );
  step.check(Number.isFinite(at.needleAngle) && Math.abs(at.needleAngle) <= Math.PI * 2, `the needle's angle is reported, in radians (got ${at.needleAngle})`);
  step.check(
    JSON.stringify(at.scroll) === JSON.stringify({ u: 0, letters: 0, iris: 0, needleDip: 0 }),
    `and the scroll's pose is reported, at the home before any scroll: u, letters, iris and needleDip all 0 (got ${JSON.stringify(at.scroll)})`,
  );
  step.check(
    at.journey.stretch === 'rise' && at.journey.local === 0 && at.journey.project === null && VOID_STATES.includes(at.journey.voidState),
    `and the journey is on the rise at its start, no project, the void in a state it can be in (got ${JSON.stringify(at.journey)})`,
  );

  // .set puts the story somewhere at once: progress and target there, nothing moving, the chapter and the phase with it.
  // Six tenths of the way through the land, just after the light has met the lid (the drop is the land's first 1.26 of
  // its 2.43 units since stack round 3, spec 2026-10-29-bob-stack-3-design.md, goal 1), the journey, which the scene poses
  // on the next frame it draws, says the same: the land, that far through, the world's objects on screen and its power
  // coming on.
  const LAND_AT = 0.6;
  const land = PATH_START + LAND_AT * WORLD_LAYOUT.land;
  await waitForVoid(page, 'ready');
  await page.evaluate((progress) => window.__needleDebug.set({ progress }), land);
  const mid = await debugOf(page);
  step.check(
    mid.progress === land && mid.target === land && mid.velocity === 0 && mid.chapter.index === 2 && mid.chapter.id === 'LAND' && mid.phase.kind === 'PROJECTS' && mid.phase.category === null,
    `.set({ progress: ${land.toFixed(4)} }) puts the story on the land, PROJECTS with no area yet (got ${JSON.stringify([mid.progress, mid.target, mid.chapter, mid.phase])})`,
  );
  step.check(near(mid.chapter.local, LAND_AT, 1e-9), `and the chapter's local is how far through it, ${LAND_AT} (got ${mid.chapter.local})`);
  const landing = await journeyAfter(page, 'land');
  step.check(
    landing.stretch === 'land' && near(landing.local, LAND_AT, 1e-9) && landing.project === null && landing.frame === null && landing.sheet === 0 && Array.isArray(landing.objects) && landing.objects.length === PROJECT_LIST.length && landing.world !== null && landing.world.power > 0 && landing.world.power < 1 && !('beads' in landing) && !('ring' in landing),
    `and the journey says so: the land half way, the world's objects on the screen and the board powering up, no beads and no ring (got ${JSON.stringify({ ...landing, objects: landing.objects?.length })})`,
  );
  await page.evaluate((place) => window.__needleDebug.set({ progress: place }), placeOfFrame(121));
  const falling = await journeyAfter(page, 'light');
  step.check(falling.stretch === 'light' && near(falling.frame, 121, 1e-6) && falling.light !== null, `and in the light dive it reports the way frame, 121 at fact 02's peak, and the light's place (got ${JSON.stringify(falling)})`);
  await page.evaluate(() => window.__needleDebug.set({ progress: 999 }));
  const end = await debugOf(page);
  step.check(
    end.target === STORY_END && end.chapter.index === LAST_UNIT && end.chapter.id === LAST_CHAPTER && LAST_CHAPTER === 'END' && end.phase.kind === 'END',
    `.set past the end stops at the end, ${STORY_END}, the end page's stop, in the last chapter, ${LAST_CHAPTER}, and the phase END (got ${JSON.stringify([end.target, end.chapter.index, end.chapter.id, end.phase])})`,
  );
  const last = await journeyAfter(page, 'end');
  step.check(last.stretch === 'end' && last.project === null && last.local === 0, `and the journey is on the end page, past the last area, no project (got ${JSON.stringify(last)})`);
  await page.evaluate(() => window.__needleDebug.set({ progress: 0 }));
  const start = await debugOf(page);
  step.check(start.target === 0 && start.chapter.index === 0 && start.phase.kind === 'HOME_IDLE', `.set({ progress: 0 }) is the start again (got ${JSON.stringify([start.target, start.chapter.index, start.phase])})`);

  // .dispatch sends a scene event, as the app's own parts do; the phase is the store's own object. A project opens from
  // the projects chapter: the last bead's stop, the story's last stop before the end page.
  await page.evaluate((progress) => window.__needleDebug.set({ progress }), PROJECT_LIST.at(-1).stop);
  await page.evaluate(() => window.__needleDebug.dispatch({ type: 'OPEN_PROJECT', id: 'steady' }));
  const focus = await debugOf(page);
  step.check(focus.phase.kind === 'PROJECT_FOCUS' && focus.phase.id === 'steady', `.dispatch({ type: 'OPEN_PROJECT', id: 'steady' }) from the projects focuses Steady (got ${JSON.stringify(focus.phase)})`);
  step.check(await page.evaluate(() => window.__needleDebug().phase === window.__needleDebug().phase), 'two reads of the phase are the same object while nothing changed');
  await page.evaluate(() => window.__needleDebug.dispatch({ type: 'BACK' }));
  const back = (await debugOf(page)).phase;
  step.check(back.kind === 'PROJECTS' && back.category === null, `.dispatch({ type: BACK }) goes back to the projects (got ${JSON.stringify(back)})`);
  await page.evaluate(() => window.__needleDebug.set({ progress: 0 }));
  step.check((await debugOf(page)).phase.kind === 'HOME_IDLE', 'and .set({ progress: 0 }) is the home again');

  // The scroll loop's frames go through .scrollRequest: wrapped, the wrapper sees them.
  await watchFrames(page);
  await page.mouse.move(720, 450);
  await page.mouse.wheel(0, 120);
  await restAt(page);
  const frames = await takeFrames(page);
  step.check(frames.requests > 0 && frames.most === 1, `a wheel's frames are asked for through .scrollRequest, one at a time (${frames.requests} asked for, at most ${frames.most} callback in one frame)`);
  await page.keyboard.press('Home');
  await restAt(page);

  // The language is the page's.
  await page.click('a[href="/en/"]');
  await page.waitForFunction(() => document.documentElement.lang === 'en', null, { timeout: 5_000 });
  const en = await debugOf(page);
  step.check(en.locale === 'en' && en.route === 'home' && en.canvasMounts === 1, `after the language switch: locale en, route home, still one Stage (got ${JSON.stringify([en.locale, en.route, en.canvasMounts])})`);
  await takeCsp(page, step);
  await context.close();
  return 'no bridge and no hook touched without ?proof; with it the state has every field, .set and .dispatch act, the loop asks its frames through .scrollRequest';
}

/**
 * The keyboard on the home page with 3D on: Tab from the top reaches the skip link, then the header in its order (the
 * name, Work, About, Contact and the language switch; its link to the light version and its 3D switch went,
 * 2026-10-29), the next Tab out of it, the language switch with a visible focus ring on screen, and Shift+Tab goes back; End goes to the last
 * chapter (the end of the story, the end page) and Home returns to the start, both from a focused control, each by the
 * step fade. From BOB from above the arrows step the facts (each at its peak), then the projects, then the end page.
 * At Jontai Energy's stop, Tab from the language switch (the header's last control since its 3D switch went,
 * 2026-10-29) reaches the front bead's label, then the skip button, and Enter on the skip button takes the story to the
 * end page and the focus to its title.
 */
async function keyboard(browser, step) {
  const { context, page } = await openPage(browser, step);
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await stageReady(page);
  await reachHomeIdle(page);
  // The End below goes past the landing's hold (LANDING_HOLD) once the beads are in; the Tab presses take longer than it does.
  await expectVoid(page, step, 'ready', 'the world under the glass is ready, so nothing holds the landing');
  /** Whether <html data-step-fade> is set at any moment from now until `fadeSeen()` is read. */
  const watchFade = () =>
    page.evaluate(() => {
      const html = document.documentElement;
      window.__fadeSeen = html.hasAttribute('data-step-fade');
      window.__fadeWatch?.disconnect();
      window.__fadeWatch = new MutationObserver(() => {
        if (html.hasAttribute('data-step-fade')) window.__fadeSeen = true;
      });
      window.__fadeWatch.observe(html, { attributes: true, attributeFilter: ['data-step-fade'] });
    });
  const fadeSeen = () => page.evaluate(() => window.__fadeSeen === true);

  const focused = () =>
    page.evaluate(() => {
      const element = document.activeElement;
      const style = getComputedStyle(element);
      const { top, bottom, left, right } = element.getBoundingClientRect();
      return {
        tag: element.tagName,
        href: element.getAttribute('href'),
        role: element.getAttribute('role'),
        hreflang: element.getAttribute('hreflang'),
        ring: style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2,
        onScreen: top >= 0 && left >= 0 && bottom <= window.innerHeight && right <= window.innerWidth && bottom > top,
      };
    });
  const isLang = (control) => control.tag === 'A' && control.hreflang === 'en';

  const reached = [];
  for (let press = 0; press < 12; press++) {
    await page.keyboard.press('Tab');
    reached.push(await focused());
    if (isLang(reached.at(-1))) break;
  }
  const langAt = reached.findIndex(isLang);
  step.check(reached[0]?.href === '#main', `the first Tab lands on the skip link (got ${JSON.stringify(reached[0])})`);
  // The header's order (spec §2.2; its link to the light version and its 3D switch went, Bob 2026-10-29, Work and About
  // 2026-10-30): the name, then Contact, and the language switch last.
  const order = reached.map((control) => (control.role === 'switch' ? '3D' : isLang(control) ? 'EN' : control.href));
  const HEADER_ORDER = ['#main', '/', '/contact/', 'EN'];
  step.check(JSON.stringify(order) === JSON.stringify(HEADER_ORDER), `Tab goes through the header in its order: ${HEADER_ORDER.join(', ')} (got ${order.join(', ')})`);
  step.check(reached[langAt]?.ring && reached[langAt].onScreen, `the language switch shows a focus ring (outline 2px or more) and is on screen when focused (got ${JSON.stringify(reached[langAt])})`);
  // Past the language switch the header ends: the next Tab leaves it.
  await page.keyboard.press('Tab');
  const past = await page.evaluate(() => ({
    inHeader: document.activeElement?.closest('.site-header') != null,
    role: document.activeElement?.getAttribute('role') ?? null,
    href: document.activeElement?.getAttribute('href') ?? null,
  }));
  step.check(!past.inHeader, `past the language switch Tab leaves the header (got ${JSON.stringify(past)})`);
  await page.keyboard.press('Shift+Tab');
  // The language switch shows "EN" and its name begins with it (WCAG 2.5.3, label in name).
  const lang = page.locator('.header-nav a[hreflang="en"]');
  const langName = await lang.getAttribute('aria-label');
  step.check(
    (await lang.textContent()) === 'EN' && /^EN – \S/.test(langName ?? '') && (await page.getByRole('link', { name: langName ?? '', exact: true }).count()) === 1,
    `the language switch shows "EN" and is named "${langName}", which begins with it`,
  );
  await page.keyboard.press('Shift+Tab');
  step.check((await focused()).href === '/contact/', 'Shift+Tab from the language switch goes back to Contact before it');
  await page.keyboard.press('Tab');
  step.check(isLang(await focused()), 'and Tab to the language switch again');

  // End and Home work from a focused control: a button keeps Space and Enter, not these.
  await watchFade();
  await page.keyboard.press('End');
  const last = await restAt(page);
  step.check(await fadeSeen(), 'End goes by the step fade');
  step.check(last.target === STORY_END && last.progress === STORY_END && last.chapterIndex === LAST_UNIT, `End jumps to the last chapter: the end of the story, ${STORY_END}, chapter ${LAST_UNIT} (got ${JSON.stringify(last)})`);
  const reachedEnd = await waitForPhase(page, 'END').then(() => true, () => false);
  const atEnd = await debugOf(page);
  step.check(reachedEnd && atEnd.chapter.id === LAST_CHAPTER && LAST_CHAPTER === 'END' && atEnd.phase.kind === 'END', `and it is the end page, ${LAST_CHAPTER} (got ${JSON.stringify([atEnd.chapter, atEnd.phase])})`);
  step.check(isLang(await focused()), 'with the focus still on the language switch');
  await watchFade();
  await page.keyboard.press('Home');
  const first = await restAt(page);
  step.check(first.target === 0 && first.progress === 0 && first.chapterIndex === 0, `Home returns to the start (got ${JSON.stringify(first)})`);
  step.check(await fadeSeen(), 'Home from the end page goes by the step fade');
  await waitForPhase(page, 'HOME_IDLE');
  const atStart = await debugOf(page);
  step.check(atStart.chapter.id === 'HOME' && atStart.phase.kind === 'HOME_IDLE', `and to HOME, HOME_IDLE (got ${JSON.stringify([atStart.chapter, atStart.phase])})`);

  // The arrows from BOB from above: each fact at its peak, the world, each area, the look back, each mark on the ring.
  await poseAt(page, RISE_TOP);
  const walk = keyStops(HOME_CHAPTERS).filter((stop) => stop > RISE_TOP);
  const reachedStops = [];
  for (const stop of walk) {
    await page.keyboard.press('ArrowDown');
    const rested = await restAt(page);
    reachedStops.push(rested.target);
    step.check(near(rested.target, stop, 1e-9) && near(rested.progress, rested.target, 1e-4), `ArrowDown steps to the next key stop, ${stop.toFixed(4)} (got ${rested.target})`);
    await page.waitForTimeout(150);
  }

  // At the Website board, Jontai Energy's: Tab from the language switch reaches its name in the board's words, then the
  // boards' dots, then the skip button; Enter on it.
  const jontai = PROJECT_LIST.find((p) => p.id === 'jontai-energy');
  await poseAt(page, jontai.stop);
  await restAt(page);
  const shownWords = await page
    .waitForFunction((index) => {
      const el = document.querySelector(`.area-caption[data-area="${index}"]`);
      return el !== null && Number(el.style.opacity) === 1 && !el.hasAttribute('inert');
    }, jontai.index, { timeout: 5_000 })
    .then(() => true, () => false);
  step.check(shownWords, "at Jontai Energy's board its words show whole");
  await page.locator('.header-nav a[hreflang="en"]').focus();
  const tabbed = [];
  /** How much of the board's words show while Tab is in them (round 11: unseen otherwise). */
  let tabSeen = null;
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Tab');
    const now = await page.evaluate(() => {
      const el = document.activeElement;
      if (el?.classList.contains('skip-button')) return { name: 'skip' };
      if (el?.classList.contains('area-dot')) return { name: 'dot' };
      const words = el?.closest('.area-caption');
      return words ? { name: `words:${el.textContent}`, seen: Number(getComputedStyle(words).opacity) } : { name: el?.className ?? null };
    });
    tabbed.push(now.name);
    if (now.seen !== undefined) tabSeen = now.seen;
  }
  step.check(
    JSON.stringify(tabbed) === JSON.stringify([`words:${jontai.title}`, 'dot', 'dot', 'dot', 'skip']),
    `Tab from the language switch reaches Jontai Energy's name in its board's words, then the three dots, then the skip button (${tabbed.join(', ')})`,
  );
  step.check(tabSeen === 1, `and the board's words show whole while Tab is in them (opacity ${tabSeen})`);
  await watchFade();
  await page.keyboard.press('Enter');
  const skipped = await ringRestsAt(page, 0, 8_000);
  await page.waitForFunction(() => document.activeElement?.id === 'qa-ask-0', null, { timeout: 5_000 }).catch(() => {});
  const focusedMark = await page.evaluate(() => document.activeElement?.id ?? null);
  step.check(skipped !== null && focusedMark === 'qa-ask-0' && (await fadeSeen()), `Enter on the skip button fades the story to the Q&A's first question (${skipped === null ? 'never' : `${skipped} ms`}) and the focus goes to its button in the list (${focusedMark})`);
  await takeCsp(page, step);
  await context.close();
  return `Tab: skip link, the header in its order to the language switch (press ${langAt + 1}), ringed and on screen, then out of it; End goes to ${STORY_END} (the end page, ${LAST_CHAPTER}), Home back to 0, both by the fade; the arrows walk ${reachedStops.length} key stops; Tab to Jontai Energy's name at its area, the dots, then the skip button, Enter to "Q&A"`;
}

/**
 * A language switch is not a step in the story: on /projects/steady/ the phase is PROJECT_FOCUS steady, and after a
 * client-side switch to /en/projects/steady/ (and back) it is still PROJECT_FOCUS steady, the very same state with no new
 * transition, in the other language, with the one canvas still the one Stage. The same on another project page.
 */
async function langKeepsPhase(browser, step) {
  const { context, page } = await openPage(browser, step);
  const documents = [];
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url());
  });
  const summary = [];

  for (const { path, other, route, phase, label } of [
    { path: '/projects/steady/', other: '/en/projects/steady/', route: 'project', phase: { kind: 'PROJECT_FOCUS', id: 'steady' }, label: 'PROJECT_FOCUS steady' },
    { path: '/projects/cookies-clicker/', other: '/en/projects/cookies-clicker/', route: 'project', phase: { kind: 'PROJECT_FOCUS', id: 'cookies-clicker' }, label: 'PROJECT_FOCUS cookies-clicker' },
  ]) {
    await page.goto(`${BASE}${path}?proof`, { waitUntil: 'load' });
    await stageReady(page);
    await page.evaluate(() => {
      document.querySelector('.scene-host canvas').dataset.id = 'lang-canvas';
    });
    documents.length = 0;
    await waitForProject(page, phase.id);
    const sameAs = (state) => state.phase.kind === phase.kind && state.phase.id === phase.id;
    const dutch = await debugOf(page);
    step.check(sameAs(dutch) && dutch.locale === 'nl' && dutch.route === route && dutch.canvasMounts === 1, `${path}: the phase is ${label}, locale nl, route ${route}, one Stage (got ${JSON.stringify([dutch.phase, dutch.locale, dutch.route, dutch.canvasMounts])})`);
    await page.evaluate(() => {
      window.__keptPhase = window.__needleDebug().phase;
    });

    for (const [to, lang] of [[other, 'en'], [path, 'nl']]) {
      await page.click(`.header-nav a[hreflang="${lang}"]`);
      await page.waitForFunction(([to, lang]) => location.pathname === to && document.documentElement.lang === lang, [to, lang], { timeout: 5_000 });
      await page.waitForTimeout(250); // a sync that wrongly moved the phase would have by now
      const now = await debugOf(page);
      const same = await page.evaluate(() => window.__needleDebug().phase === window.__keptPhase);
      const canvas = await page.evaluate(() => ({ canvases: document.querySelectorAll('canvas').length, tag: document.querySelector('.scene-host canvas')?.dataset.id ?? null }));
      step.check(sameAs(now) && same, `after the client-side switch to ${to}: the phase is still ${label}, the very same state with no new transition (got ${JSON.stringify(now.phase)}, same object ${same})`);
      step.check(now.locale === lang && now.route === route, `and the bridge says locale ${lang}, route ${route} (got ${now.locale}, ${now.route})`);
      step.check(now.canvasMounts === 1 && canvas.canvases === 1 && canvas.tag === 'lang-canvas', `and canvasMounts is 1, the same <canvas> (got ${now.canvasMounts} mounts, ${canvas.canvases} canvas, tag ${canvas.tag})`);
    }
    step.check(documents.length === 0, `${path}: switching language and back is client navigation, no document load (got ${documents.join(', ') || 'none'})`);
    summary.push(label);
    await takeCsp(page, step);
  }
  await context.close();
  return `${summary.join(' and ')} survive a switch to English and back: the same phase, one Stage, one canvas`;
}

/**
 * With `prefers-reduced-motion: reduce` (emulated before the page loads) a wheel event is a step, not a distance: one
 * event moves `target` to exactly the next key stop (BOB from above, each fact at its peak, each project, the end page),
 * down through every one of them to the end, and one event up goes back through them; the story arrives at each, the
 * chapter and phase those of the stop. Each step goes by the step fade, and the scene never shows a pose between two
 * stops: every pose the bridge reports on the way is the stop it left or the stop it comes to.
 */
async function reducedMotion(browser, step) {
  const { context, page } = await openPage(browser, step);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await stageReady(page);
  step.check(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), 'the page asks for reduced motion');
  await reachHomeIdle(page);
  // Under reduced motion the landing's hold is the last key stop under LANDING_HOLD (fact 05) while the world builds, and
  // every stop after it needs it: the step starts with it in.
  await expectVoid(page, step, 'ready', 'the world under the glass is ready, so nothing holds the story at the landing');
  await page.mouse.move(720, 450);

  // 0 home, 1 BOB from above, the five facts at their peaks, the world's stop, each area's, the look back's own stop,
  // then the Q&A's list (its first mark) and the end's (round 10: the ring's inner marks are no stops).
  const places = keyStops(HOME_CHAPTERS);
  step.check(
    places.length === 14 && places[0] === 0 && places[1] === 1 && places[7] === WORLD_STOP && places.at(-3) === LOOK_STOP && JSON.stringify(places.slice(-2)) === JSON.stringify([QA_STOPS[0], QA_STOPS.at(-1)]) && places.at(-1) === STORY_END && PROJECT_LIST.every((bead) => places.includes(bead.stop)),
    `the story's 14 key stops: the home, BOB from above, five facts, the world, three areas, the look back's, the Q&A's list and the end's last (got ${places.map((p) => p.toFixed(3)).join(', ')})`,
  );
  /** Waits out the Q&A's lock after a step on the ring (QA_LOCK_MS from its start), so the next event is heard. */
  const pastLock = (stop) => (stop >= LOOK_STOP - 1e-9 ? page.waitForTimeout(QA_LOCK_MS) : Promise.resolve());
  const sameAt = (a, b) => a.stretch === b.stretch && a.project === b.project && Math.abs(a.local - b.local) < 1e-6 && (a.frame === null ? b.frame === null : b.frame !== null && Math.abs(a.frame - b.frame) < 1e-6);
  /** Watches every pose the bridge reports (5 ms apart) and every step fade from now until `stopWatch()`. */
  const watchStep = () =>
    page.evaluate(() => {
      const html = document.documentElement;
      const seen = { faded: false, poses: [] };
      window.__step = seen;
      const observer = new MutationObserver(() => {
        if (html.hasAttribute('data-step-fade')) seen.faded = true;
      });
      observer.observe(html, { attributes: true, attributeFilter: ['data-step-fade'] });
      const timer = setInterval(() => {
        const { stretch, frame, local, project } = window.__needleDebug().journey;
        const last = seen.poses.at(-1);
        if (!last || last.stretch !== stretch || last.frame !== frame || last.local !== local || last.project !== project) seen.poses.push({ stretch, frame, local, project });
      }, 5);
      window.__stepStop = () => {
        observer.disconnect();
        clearInterval(timer);
        return seen;
      };
    });
  const stopWatch = () => page.evaluate(() => window.__stepStop());
  const arrive = async (stop, how, from) => {
    const rested = await restAt(page);
    await page.waitForTimeout(250); // the fade back up
    const at = await debugOf(page);
    const unit = chapterAt(HOME_CHAPTERS, stop);
    step.check(
      rested.progress === stop && at.chapter.index === unit.index && at.chapter.id === unit.id && at.chapter.category === unit.category,
      `${how}: the story arrives at ${stop.toFixed(4)}, in chapter ${unit.index} (${unit.id}) (got progress ${rested.progress}, chapter ${JSON.stringify(at.chapter)})`,
    );
    const seen = await stopWatch();
    const ends = [journeyAt(from), journeyAt(stop)];
    const between = seen.poses.filter((pose) => !ends.some((end) => sameAt(end, pose)));
    step.check(
      seen.faded && between.length === 0,
      `${how} to ${stop.toFixed(4)}: by the step fade (${seen.faded}), no pose between the two stops (${seen.poses.length} poses seen, ${between.length} between: ${JSON.stringify(between.slice(0, 3))})`,
    );
  };

  for (let i = 1; i < places.length; i++) {
    const stop = places[i];
    await watchStep();
    await page.mouse.wheel(0, 40); // one event
    const target = (await frameOf(page)).target;
    step.check(target === stop, `one wheel event down moves the target to exactly the next key stop, ${stop.toFixed(4)} (got ${target})`);
    await arrive(stop, 'down', places[i - 1]);
    await page.waitForTimeout(300); // the next event is the next gesture
    await pastLock(stop);
  }
  // A step down from the last stop is no step: nothing moves and the scene host does not fade down and back.
  const endRest = await page.evaluate(() => document.documentElement.getAttribute('data-qa-at'));
  step.check(endRest === String(QA_END), `at the last stop the ring rests at the end's mark, <html data-qa-at="${endRest}">`);
  await page.evaluate(() => {
    const html = document.documentElement;
    const host = document.querySelector('.scene-host');
    window.__endStep = { faded: html.hasAttribute('data-step-fade'), minOpacity: Number(getComputedStyle(host).opacity) };
    const observer = new MutationObserver(() => {
      if (html.hasAttribute('data-step-fade')) window.__endStep.faded = true;
    });
    observer.observe(html, { attributes: true, attributeFilter: ['data-step-fade'] });
    const timer = setInterval(() => (window.__endStep.minOpacity = Math.min(window.__endStep.minOpacity, Number(getComputedStyle(host).opacity))), 5);
    window.__endStepStop = () => {
      observer.disconnect();
      clearInterval(timer);
    };
  });
  await page.mouse.wheel(0, 40);
  step.check((await frameOf(page)).target === STORY_END, `and one more at the end, ${STORY_END}, stays at the end`);
  await page.waitForTimeout(600);
  const endStep = await page.evaluate(() => {
    window.__endStepStop();
    return window.__endStep;
  });
  step.check(!endStep.faded && endStep.minOpacity === 1, `and is no step at all: <html data-step-fade> never set, the scene host's opacity never below 1 (lowest ${endStep.minOpacity})`);
  await page.waitForTimeout(300); // the next event is the next gesture
  for (let i = places.length - 2; i >= 0; i--) {
    const stop = places[i];
    await watchStep();
    await page.mouse.wheel(0, -40);
    const target = (await frameOf(page)).target;
    step.check(target === stop, `one wheel event up moves the target to exactly the previous key stop, ${stop.toFixed(4)} (got ${target})`);
    await arrive(stop, 'up', places[i + 1]);
    await page.waitForTimeout(300);
    await pastLock(places[i + 1]);
  }
  await page.mouse.wheel(0, -40);
  step.check((await frameOf(page)).target === 0, 'and one more at the start stays at the start');
  await expectPhase(page, step, 'HOME_IDLE', 'and the phase is HOME_IDLE again');
  await takeCsp(page, step);
  await context.close();
  return `one wheel event a key stop: ${places.map((p) => p.toFixed(3)).join(', ')} down and back up, each arrived at by the fade, no pose between`;
}

// ---------------------------------------------------------------- the void: its journey, opening a bead, the hold, the failure

/**
 * The project titles, read from src/data/projects.ts rather than typed again: that module cannot be imported here (it
 * globs the screenshots with Vite's `import.meta.glob`), so the title that follows each `id` is read from its text. A
 * title not found is null, and the step that wants it fails on it.
 */
const PROJECTS_SOURCE = readFileSync(fileURLToPath(new URL('../../src/data/projects.ts', import.meta.url)), 'utf8');
const projectTitle = (id) => PROJECTS_SOURCE.match(new RegExp(`id: '${id}',\\s+title: '([^']+)'`))?.[1] ?? null;

/**
 * The projects on the hologram world in the areas' order (WORLD_PROJECTS, src/scene/bob/journey.ts; one area per
 * category, src/state/chapters.ts `areasOnPath`), each with its area's place among the areas (`index`), its category,
 * its area's stop (`areaStop`: the camera at rest on the area, its words shown, where Back from its page lands), the page
 * of the project (src/data/pages.ts) and its title.
 */
const PROJECT_LIST = areasOnPath().flatMap((area, index) =>
  area.projects.map((id) => ({
    id,
    index,
    category: area.category,
    stop: areaStop(HOME_CHAPTERS, area.category),
    path: SITE_PAGES[`project-${id}`],
    title: projectTitle(id),
  })),
);
/** The world's own stop: the whole board, its names and the hint shown. */
const WORLD_STOP = worldStop(HOME_CHAPTERS);

/** Where project `bead`'s AREA ends: the next area's start (or the look back's), past the pause after its stop. */
const areaEnd = (bead) => {
  const unit = HOME_CHAPTERS.units.find((u) => u.id === 'AREA' && u.category === bead.category);
  return unit.start + unit.length;
};

/** The path's start, the hand-over from the fall (way frame 256): the light path's places are counted from it. */
const PATH_START = pathStart(HOME_CHAPTERS);
/** The look back's own stop: the whole machine in view, where the Q&A's first unit starts. */
const LOOK_STOP = lookStop(HOME_CHAPTERS);

/** Where `poseOnTheFrame` puts the story: the rise (0.6), the fall (fact 03's peak), the land and Steady's area. */
const SAME_FRAME_AT = [0.6, placeOfFrame(161), PATH_START + 0.6, PATH_START + 1.9];

/** The site header's height, px: the world's words and objects stay under it. */
const HEADER_PX = 64;

/** The page's gate on the hologram world's build (src/debug/worldGate.ts, read under ?proof): 'hold', 'fail' or 'open'. */
const WORLD_GATE = '__needleWorldGate';
/** The pages whose loads read the gate. */
const gatedPages = new WeakSet();

/**
 * Sets the hologram world's build gate (src/debug/worldGate.ts) for the page's next loads: 'hold' keeps the void
 * `loading` until `openWorld(page)`, as a slow world would; 'fail' makes the world fail, as a broken one would. The world
 * is built in code from nothing fetched, so there is no file to hold or to answer 404. Call it before the page navigates;
 * on a page already on the site it takes effect from its next load. The gate lives in the page's session storage, so it
 * holds through the page's own navigations until it is opened.
 */
async function gateWorld(page, value) {
  if (!gatedPages.has(page)) {
    gatedPages.add(page);
    await page.addInitScript(
      ({ gate, first }) => {
        if (sessionStorage.getItem(`${gate}:set`) === null) {
          sessionStorage.setItem(`${gate}:set`, '1');
          sessionStorage.setItem(gate, first);
        }
        const now = sessionStorage.getItem(gate);
        if (now === 'hold' || now === 'fail') window[gate] = now;
      },
      { gate: WORLD_GATE, first: value },
    );
  } else {
    await page.evaluate(({ gate, value }) => sessionStorage.setItem(gate, value), { gate: WORLD_GATE, value });
  }
}

/** Opens the gate: a held build goes on now, and the page's later loads build the world at once. */
async function openWorld(page) {
  await page.evaluate((gate) => {
    sessionStorage.setItem(gate, 'open');
    delete window[gate];
  }, WORLD_GATE);
}

/** A context at one of the still sizes with the seen flag set (the quick path to the home, as `scroll-bob` takes it) and its page. */
async function openSeen(browser, step, size, expected = () => false) {
  const opened = await openPage(browser, step, expected, { width: size.width, height: size.height }, size.options);
  await opened.context.addInitScript((key) => localStorage.setItem(key, '1'), LOADER_SEEN_KEY);
  return opened;
}

/** Loads `path` (the home by default) with the bridge and waits for the opening to land on HOME_IDLE and the hero to show; answers whether the hero showed. */
async function landHome(page, path = '/') {
  await page.goto(`${BASE}${path}?proof`, { waitUntil: 'load' });
  await page.bringToFront();
  await reachHomeIdle(page);
  await page.evaluate(() => document.fonts.ready);
  const hero = await page.waitForFunction(() => getComputedStyle(document.querySelector('.hero')).opacity === '1', null, { timeout: 5_000 }).then(() => true, () => false);
  await page.waitForTimeout(500);
  return hero;
}

/**
 * Wheel notches that carry the story from the home to the hand-over (LANDING_HOLD) at 1440x900, where the long pushes
 * run, with a third more to spare, or back from it to the home: the hold's place in viewport heights at RISE.notchPx a
 * notch. It follows the fall's pace (FALL_PACE): twice the old 32 now the fall is twice as long.
 */
const PUSH_NOTCHES = Math.ceil((1.3 * LANDING_HOLD * 900) / RISE.notchPx);

/**
 * Pushes the story by hand in `direction` (1 down the story, -1 back): a long wheel at the pointer on a laptop, a run of
 * flicks on a phone. With `toEnd`, a phone flicks on (up to 30 in all) until the story's target is at that end, 0 or the
 * last stop, as a visitor would: a finger set down halts the settle of the flick before, so a quick run of flicks covers
 * less than each one's own reach.
 */
async function pushStory(page, cdp, direction, { notches = 60, flicks = 14, toEnd = false } = {}) {
  if (cdp === null) {
    for (let i = 0; i < notches; i++) {
      await page.mouse.wheel(0, direction * RISE.notchPx);
      await page.waitForTimeout(RISE.notchGapMs);
    }
    return `${notches} wheel notches`;
  }
  const [from, to] = direction > 0 ? [700, 200] : [200, 700];
  let done = 0;
  for (; done < flicks; done++) await swipe(page, cdp, from, to);
  const atEnd = async () => {
    await page.waitForTimeout(300);
    const { target } = await page.evaluate(() => window.__needleDebug());
    return direction > 0 ? target === STORY_END : target === 0;
  };
  while (toEnd && done < 30 && !(await atEnd())) {
    await swipe(page, cdp, from, to);
    done++;
  }
  return `${done} flicks`;
}

/** The camera of a bridge state is the pure journey's shot for `progress` on a screen of `aspect`: the position and the field. */
const onJourneyShot = (state, progress, aspect) => {
  const shot = journeyPoseAt(progress, aspect).shot;
  return state.camera.position.every((value, i) => near(value, shot.position[i], 1e-3)) && near(state.camera.fov, shot.fov, 1e-3);
};

/**
 * Puts the story at `progress` through the bridge and reads the bridge in the page on the first animation frame at which
 * the scene has posed the journey there (the stretch and `local` the pure journey gives, `journeyPoseAt`), within 12
 * frames: answers `{ tick, camera, before }`, or null if it did not, where `before` is the camera as it stood when the
 * story was put (the harness checks that it is NOT already on the new shot, or a camera that never moved would pass).
 * Task 10 gave the shot one writer, strictly before the Rig, so the camera of a frame stands on the shot of that same
 * frame; before, it came a frame late. The camera read here is the one of the very frame the journey was read on, in one
 * evaluation. The journey is posed there when its stretch, `local` and bead (`project`) are the pure journey's.
 */
async function poseOnTheFrame(page, progress, aspect) {
  const { at } = journeyPoseAt(progress, aspect);
  return page.evaluate(
    async ([progress, stretch, local, project]) => {
      const bridge = window.__needleDebug;
      const before = JSON.parse(JSON.stringify(bridge().camera));
      bridge.set({ progress });
      for (let tick = 0; tick < 12; tick++) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const state = bridge();
        if (state.journey.stretch === stretch && state.journey.project === project && Math.abs(state.journey.local - local) < 1e-9) return { tick, before, camera: JSON.parse(JSON.stringify(state.camera)) };
      }
      return null;
    },
    [progress, at.stretch, at.local, at.project],
  );
}

/**
 * The nebula (the 3D world's spec, goals 1, 2 and 8), at 1440x900 and 390x844 (touch): the bridge's levels
 * (`journey.nebula`: its clouds, its far bands, the look back's rings) are the rules' (`nebulaLevels`) at the fall's way
 * frames 30, 72 and 121, at each trip's middle and arrival, in the look back and into the Q&A; the clouds come in as
 * the camera turns to follow the light and are whole on the path; the fall's richer space (spec
 * 2026-10-29-bob-stack-2-design.md, goal 4): its clouds 0.9 and its bands 0.85 by fact 02's peak; stills of the fall (way frame 121), the second trip,
 * Jontai Energy's arrival and the look back through the home's luma gate, the page's text masked.
 */
async function nebula(browser, step) {
  const summary = [];
  const gated = [];
  mkdirSync(STILLS, { recursive: true });
  for (const size of TWO_SIZES) {
    const at = sizeName(size);
    const { context, page } = await readyHome(browser, step, size);
    const places = [
      ...[30, 72, 121].map((frame) => ({ name: `fall-${frame}`, progress: placeOfFrame(frame) })),
      { name: 'land', progress: PATH_START + 0.4 },
      { name: 'world', progress: WORLD_STOP },
      ...PROJECT_LIST.flatMap((bead) => [
        { name: `to-area-${bead.index + 1}`, progress: bead.stop - 0.4 },
        { name: `area-${bead.id}`, progress: bead.stop },
      ]),
      { name: 'look-back', progress: LOOK_STOP - 0.3 },
      { name: 'look-stop', progress: LOOK_STOP },
      { name: 'qa', progress: LOOK_STOP + 0.5 },
    ];
    const read = {};
    for (const place of places) {
      const state = await poseAt(page, place.progress);
      const got = state.journey.nebula;
      const pose = journeyPoseAt(place.progress, size.width / size.height);
      const want = nebulaLevels(pose.at, pose.path);
      read[place.name] = got;
      step.check(
        got !== null && near(got.clouds, want.clouds, 1e-9) && near(got.bands, want.bands, 1e-9) && near(got.rings, want.rings, 1e-9),
        `${at}: at ${place.name} the bridge's levels are the rules': ${JSON.stringify(got)} (${JSON.stringify(want)})`,
      );
      if (['fall-121', 'world', 'area-jontai-energy', 'look-stop'].includes(place.name)) {
        await page.waitForTimeout(500);
        const file = join(STILLS, `nebula-${place.name}-${at}.png`);
        await page.screenshot({ path: file });
        gated.push({ file, kind: 'home', mask: await textMask(page) });
      }
    }
    step.check(
      read['fall-30']?.clouds === 0 && near(read['fall-121']?.clouds ?? 0, NEBULA.FALL_LEVEL, 1e-9) && near(read.world?.clouds ?? 0, NEBULA.WORLD_LEVEL.world, 1e-9) && near(read['area-steady']?.clouds ?? 0, NEBULA.WORLD_LEVEL.area, 1e-9),
      `${at}: no clouds before the camera turns (frame 30: ${read['fall-30']?.clouds}), at the fall's ${NEBULA.FALL_LEVEL} behind the facts by fact 02's peak (${read['fall-121']?.clouds}), ${NEBULA.WORLD_LEVEL.world} round the whole world (${read.world?.clouds}) and ${NEBULA.WORLD_LEVEL.area} at an area (${read['area-steady']?.clouds})`,
    );
    step.check(
      near(NEBULA.FALL_LEVEL, 0.9) && near(NEBULA.FALL_BANDS, 0.85) && near(read['fall-121']?.clouds ?? 0, 0.9, 1e-9) && near(read['fall-121']?.bands ?? 0, 0.85, 1e-9),
      `${at}: the fall's clouds at 0.9 and its bands at 0.85 by fact 02's peak (${read['fall-121']?.clouds}, ${read['fall-121']?.bands})`,
    );
    step.check(Object.values(read).every((levels) => levels?.rings === 0), `${at}: no rings anywhere, which were the beads' (${Object.entries(read).filter(([, levels]) => levels?.rings !== 0).map(([name]) => name).join(', ') || 'none'} with any)`);
    await takeCsp(page, step);
    summary.push(`${at}: ${places.length} places`);
    await context.close();
  }
  step.luma = await gateLuma(browser, step, gated);
  return `${summary.join('; ')}; ${lumaSummary(step.luma, 'home')}`;
}

/**
 * The hold (spec: the landing waits for the world), at 1440x900 and 390x844 (touch): with the world's build held back, so
 * that the void stays `loading`, a long wheel (PUSH_NOTCHES; flicks on the phone) plays the light dive and rests at
 * LANDING_HOLD, the hand-over (way frame 256, where the path begins, on the journey's shot), the journey at its travel's start with
 * `voidState` `loading`, the light still and nothing creeping past it; a still of it (`m2/void-hold-<size>.png`) is gated
 * as a home still. Scrolling back from there moves the story at once (at 1440 exactly the notches' distance) and it rests
 * where the input stopped; down again it rests on the hold again. On release the void becomes `ready` and the story
 * goes on along the path. A direct arrival at a project's page whose Esc is pressed while the file is held waits at the
 * hold too, and reaches the project's stop once the file is let through.
 */
async function voidHold(browser, step) {
  mkdirSync(STILLS, { recursive: true });
  const shots = [];
  const summary = [];
  step.check(
    LANDING_HOLD === PATH_START && near(LANDING_HOLD, placeOfFrame(256), 1e-12) && landingHoldFor('idle') === LANDING_HOLD && landingHoldFor('loading') === LANDING_HOLD && landingHoldFor('ready') === STORY_END && landingHoldFor('failed') === LANDING_HOLD,
    `the hold is LANDING_HOLD, ${LANDING_HOLD}, the hand-over where the path begins (way frame 256), while the void is idle, loading or failed, and the end (${STORY_END}) once ready`,
  );
  for (const size of STILL_SIZES) {
    const at = sizeName(size);
    const touch = size.options.hasTouch === true;
    const aspect = size.width / size.height;
    const { context, page } = await openSeen(browser, step, size);
    const cdp = touch ? await context.newCDPSession(page) : null;
    await gateWorld(page, 'hold');
    step.check(await landHome(page), `${at}: landed on the home with the world's build held back, the hero shown whole`);
    const loading = await waitForVoid(page, 'loading', 5_000);
    step.check(loading === 'loading', `${at}: the void is built and the world held: the void is ${loading}`);
    if (!touch) await page.mouse.move(size.width / 2, size.height / 2);
    const vh = size.height;

    const pushed = await pushStory(page, cdp, 1, { notches: PUSH_NOTCHES, flicks: 16 });
    const rest = await settledState(page);
    step.check(
      near(rest.target, LANDING_HOLD, 1e-9) && rest.progress === rest.target && rest.journey.stretch === 'land' && rest.journey.local === 0 && rest.journey.project === null && rest.journey.voidState === 'loading' && rest.phase.kind === 'PROJECTS',
      `${at}: a long push (${pushed}) plays the light dive and rests at LANDING_HOLD, ${LANDING_HOLD}: progress ${rest.progress}, target ${rest.target}, the journey ${rest.journey.stretch} ${rest.journey.local}, voidState ${rest.journey.voidState}, the phase ${rest.phase.kind}`,
    );
    step.check(onJourneyShot(rest, LANDING_HOLD, aspect), `${at}: and the camera is on the journey's shot for it: [${rest.camera.position.map((v) => v.toFixed(3)).join(', ')}] fov ${rest.camera.fov.toFixed(3)}`);
    await page.waitForTimeout(1_000);
    const later = await debugOf(page);
    step.check(
      later.target === rest.target && later.progress === rest.progress && later.journey.voidState === 'loading' && JSON.stringify(later.journey.light) === JSON.stringify(rest.journey.light),
      `${at}: and a second later it has not crept and the light stands still: progress ${later.progress}, target ${later.target}, voidState ${later.journey.voidState}, the light ${JSON.stringify(later.journey.light)}`,
    );
    const still = join(STILLS, `void-hold-${at}.png`);
    await page.screenshot({ path: still });
    shots.push({ file: still, kind: 'home', mask: await textMask(page) });

    // Not stuck: up from the hold moves the story at once (nothing past the hold was stored to be undone first), the
    // gesture then settles on the stop above, BOB from above, and down again it comes to rest on the hold again.
    if (touch) await swipe(page, cdp, 200, 700);
    else for (let i = 0; i < 3; i++) await page.mouse.wheel(0, -RISE.notchPx);
    const moved = await frameOf(page);
    const up = await settledState(page);
    step.check(
      touch ? moved.target < LANDING_HOLD - 0.1 : near(moved.target, LANDING_HOLD - (3 * RISE.notchPx) / vh, 1e-9),
      `${at}: up from the hold the story moves at once${touch ? ' (a flick)' : ', exactly the 3 notches'}: target ${moved.target} from ${LANDING_HOLD}`,
    );
    step.check(
      up.progress === up.target && up.target < LANDING_HOLD - 0.1 && up.target > RISE_TOP,
      `${at}: and it rests where the input stopped, in the fall (progress ${up.progress}, target ${up.target})`,
    );
    await pushStory(page, cdp, 1, { notches: PUSH_NOTCHES, flicks: 16 });
    const again = await settledState(page);
    step.check(near(again.target, LANDING_HOLD, 1e-9) && again.progress === again.target && again.journey.voidState === 'loading', `${at}: and pushed down again it rests on the hold again (progress ${again.progress}, target ${again.target}, ${again.journey.voidState})`);

    // The world is let through: the void becomes ready and the story goes on to the world.
    await openWorld(page);
    const ready = await waitForVoid(page, 'ready');
    const through = await settledState(page);
    step.check(
      ready === 'ready' && through.target > LANDING_HOLD + 0.1 && through.progress === through.target && through.journey.voidState === 'ready' && ['land', 'area', 'look', 'qa', 'end'].includes(through.journey.stretch),
      `${at}: let through, the void is ${ready} and the story goes on to the world: progress ${through.progress}, target ${through.target}, the journey ${through.journey.stretch} ${through.journey.local.toFixed(3)}`,
    );
    step.check(onJourneyShot(through, through.progress, aspect), `${at}: with the camera on the journey's shot there`);

    // A direct arrival at a project's page, Esc while the world is still held: it waits at the hold, then reaches the stop.
    const target = PROJECT_LIST[2];
    await gateWorld(page, 'hold');
    await page.goto(`${BASE}${target.path}?proof`, { waitUntil: 'load' });
    await stageReady(page);
    const direct = await waitForProject(page, target.id);
    const settled = await landed(page).then(() => true, () => false);
    const stillLoading = await waitForVoid(page, 'loading', 10_000);
    step.check(
      direct.kind === 'PROJECT_FOCUS' && direct.id === target.id && settled && stillLoading === 'loading',
      `${at}: a direct load of ${target.path} with the world held puts the scene on PROJECT_FOCUS ${target.id}, the opening lands and the void is ${stillLoading} (got ${JSON.stringify(direct)}, landed ${settled})`,
    );
    await page.keyboard.press('Escape');
    await page.waitForURL(`${BASE}/`, { timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(1_500);
    const waiting = await debugOf(page);
    step.check(
      new URL(page.url()).pathname === '/' && near(waiting.target, LANDING_HOLD, 1e-9) && waiting.progress === waiting.target && waiting.journey.voidState === 'loading',
      `${at}: a direct load of ${target.path} (the world held again), then Esc: the story waits at the hold (progress ${waiting.progress}, target ${waiting.target}, voidState ${waiting.journey.voidState}, ${waiting.phase.kind})`,
    );
    await openWorld(page);
    const stopped = await waitForStop(page, target.category, 20_000);
    step.check(
      stopped.kind === 'PROJECTS' && stopped.category === target.category && stopped.progress === target.stop && stopped.target === target.stop,
      `${at}: and let through it goes on to ${target.id}'s stop, ${target.stop} (got ${JSON.stringify(stopped)})`,
    );
    await takeCsp(page, step);
    await context.close();
    summary.push(`${at}: held, a long push (${pushed}) rests at ${LANDING_HOLD.toFixed(4)} loading, up and down again, let through it goes on to the world (${through.target.toFixed(3)}), and a direct arrival's Esc waits at the hold then reaches stop ${target.stop}`);
  }
  const rows = await gateLuma(browser, step, shots);
  step.luma = rows;
  return `${summary.join('; ')}; ${rows.length} stills (m2/void-hold-*), ${lumaSummary(rows, 'home')}`;
}

/**
 * The failure (spec §2.1), at 1440x900 and 390x844 (touch): with the world's build failed (src/debug/worldGate.ts) the
 * void fails (`voidState` `failed`, `<html data-void>`), and the home goes on without it. At the home the nav stays hidden
 * as it is with 3D on; a long push plays the light dive and rests the scroll at LANDING_HOLD (the hand-over), and there
 * (`<html data-held>`) `.home-nav` shows, fixed over the foot of the screen, unclipped and opaque, its three links on
 * screen and each the element at its own middle, its end link with them; the skip button never shows; a still of it
 * (`m2/void-fail-<size>.png`) is gated as a home still. A link opens its project, and Esc brings the story back to the
 * hold, not to the project's stop; scrolled back to the home the nav is hidden again and the SCROLL cue is back. The console has no error for
 * it: the Void's own line is a warning, `[needle] the world could not be built`, and there is one, per size.
 */
async function voidFail(browser, step) {
  mkdirSync(STILLS, { recursive: true });
  const shots = [];
  const summary = [];
  for (const size of STILL_SIZES) {
    const at = sizeName(size);
    const touch = size.options.hasTouch === true;
    const { context, page } = await openSeen(browser, step, size);
    const cdp = touch ? await context.newCDPSession(page) : null;
    const warnings = [];
    page.on('console', (message) => {
      if (message.type() === 'warning' && /^\[needle\] the world could not be built/.test(message.text())) warnings.push(message.text());
    });
    await gateWorld(page, 'fail');
    const reportedBefore = step.expected.length;
    step.check(await landHome(page), `${at}: landed on the home with the world's build failing, the hero shown whole`);
    const failedState = await waitForVoid(page, 'failed', 10_000);
    step.check(failedState === 'failed', `${at}: the world could not be built and the void failed (voidState ${failedState})`);
    const flags = () => page.evaluate(() => ({ void: document.documentElement.dataset.void ?? null, held: document.documentElement.hasAttribute('data-held') }));
    const atHome = await flags();
    step.check(
      atHome.void === 'failed' && !atHome.held && visuallyHidden(await boxOf(page, '.home-nav')),
      `${at}: at the home <html data-void> says ${atHome.void}, nothing is held (data-held ${atHome.held}) and .home-nav stays hidden, as with 3D on (the SCROLL cue keeps the foot of the screen)`,
    );

    if (!touch) await page.mouse.move(size.width / 2, size.height / 2);
    const pushed = await pushStory(page, cdp, 1, { notches: PUSH_NOTCHES, flicks: 16 });
    const rest = await settledState(page);
    step.check(
      near(rest.target, LANDING_HOLD, 1e-9) && rest.progress === rest.target && rest.phase.kind === 'PROJECTS' && rest.journey.stretch === 'land' && rest.journey.local === 0 && rest.journey.voidState === 'failed',
      `${at}: a long push (${pushed}) plays the light dive and holds the scroll at LANDING_HOLD, ${LANDING_HOLD.toFixed(4)}: progress ${rest.progress}, target ${rest.target}, the phase ${rest.phase.kind}, the journey ${rest.journey.stretch} at way frame ${rest.journey.frame}`,
    );
    const navAt = () =>
      page.evaluate(() => {
        const nav = document.querySelector('.home-nav');
        const style = getComputedStyle(nav);
        const box = nav.getBoundingClientRect();
        const links = [...nav.querySelectorAll('a')].map((link) => {
          const r = link.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return { href: link.getAttribute('href'), onScreen: r.height > 0 && r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth, hit: hit === link || link.contains(hit) };
        });
        const endLink = nav.querySelector('.end-link');
        const skip = document.querySelector('.skip-button');
        return {
          void: document.documentElement.dataset.void ?? null,
          held: document.documentElement.hasAttribute('data-held'),
          position: style.position,
          clip: style.clipPath,
          opacity: Number(style.opacity),
          height: box.height,
          links,
          endLink: endLink === null ? null : { text: endLink.textContent, shown: endLink.getClientRects().length > 0 },
          skip: skip === null ? 'none' : getComputedStyle(skip).display,
        };
      });
    const nav = await navAt();
    step.check(
      nav.void === 'failed' && nav.held && nav.position === 'fixed' && nav.clip === 'none' && nav.opacity === 1 && nav.height > 100,
      `${at}: there .home-nav shows over the foot of the screen: ${nav.position}, clip-path ${nav.clip}, opacity ${nav.opacity}, ${Math.round(nav.height)} px high (data-void ${nav.void}, data-held ${nav.held})`,
    );
    step.check(nav.endLink !== null && nav.endLink.shown && nav.endLink.text === new Translator('nl').t.end.failLink, `${at}: with its link to the questions, "${nav.endLink?.text}"`);
    step.check(nav.skip === 'none', `${at}: and no skip button (display ${nav.skip})`);
    step.check(
      JSON.stringify(nav.links.map((link) => link.href)) === JSON.stringify(HOME_LINKS) && nav.links.every((link) => link.onScreen && link.hit),
      `${at}: with its four links on screen, each the element at its own middle (got ${JSON.stringify(nav.links)})`,
    );
    await page.waitForTimeout(500);
    const still = join(STILLS, `void-fail-${at}.png`);
    await page.screenshot({ path: still });
    const mask = await textMask(page);
    shots.push({ file: still, kind: 'home', mask });
    const control = join(STILLS, `void-control-fail-${at}.png`);
    await withoutCanvas(page, () => page.screenshot({ path: control }));
    shots.push({ file: control, kind: 'control', mask });

    // The home stays usable: a link opens its project, and Esc comes back to the hold, not to a world the void never showed.
    await page.click('.home-nav a[href="/projects/steady/"]');
    await page.waitForURL(`${BASE}/projects/steady/`, { timeout: 5_000 });
    const opened = await waitForProject(page, 'steady');
    step.check(opened.kind === 'PROJECT_FOCUS' && opened.id === 'steady', `${at}: a link of the nav opens Steady's page (got ${JSON.stringify(opened)})`);
    await page.keyboard.press('Escape');
    await page.waitForURL((url) => url.pathname === '/', { timeout: 5_000 }); // a page reached from the home steps back to /?proof
    const back = await settledState(page);
    step.check(
      near(back.target, LANDING_HOLD, 1e-9) && back.progress === back.target && back.journey.voidState === 'failed',
      `${at}: Esc brings the story back to the hold at ${LANDING_HOLD.toFixed(4)}, not to Steady's stop (progress ${back.progress}, target ${back.target}, voidState ${back.journey.voidState})`,
    );
    if (!touch) await page.mouse.move(size.width / 2, size.height / 2);
    await pushStory(page, cdp, -1, { notches: PUSH_NOTCHES, flicks: 8, toEnd: true });
    const home = await settledState(page);
    await waitForPhase(page, 'HOME_IDLE').catch(() => {});
    const cue = await cueAt(page, 1);
    const flagsHome = await flags();
    step.check(
      home.target <= 1e-6 && (await phaseOf(page)).kind === 'HOME_IDLE' && !flagsHome.held && visuallyHidden(await boxOf(page, '.home-nav')) && cueShown(cue),
      `${at}: scrolled back to the home the nav is hidden again, the SCROLL cue is back (${cueText(cue)}) and the phase is HOME_IDLE (target ${home.target})`,
    );

    // No reported error, and the Void's own line as a warning.
    step.check(
      step.expected.length - reportedBefore === 0 && warnings.length === 1,
      `${at}: the console has no error for it (${step.expected.length - reportedBefore}), and the Void's own line is a warning (${warnings.length}): ${warnings.join(' | ')}`,
    );
    await takeCsp(page, step);
    await context.close();
    summary.push(`${at}: failed, the scroll holds at ${LANDING_HOLD.toFixed(4)} (${pushed}) with .home-nav shown and usable, no skip button, back at the home it is hidden again; no error, one warning`);
  }
  const rows = await gateLuma(browser, step, shots);
  step.luma = rows;
  return `${summary.join('; ')}; ${rows.filter((row) => row.kind !== 'control').length} stills (m2/void-fail-*) and ${rows.filter((row) => row.kind === 'control').length} negative controls, ${lumaSummary(rows, 'home')}`;
}

// ---------------------------------------------------------------- the void's stops by real input, and the cross-task paths




// ---------------------------------------------------------------- the end page

/**
 * The page's own scroll once it has stopped moving (the browser's smooth scroll of a wheel or a key, a finger's fling):
 * `window.scrollY` unchanged for 200 ms, waited for up to 4 s. By timers alone: no requestAnimationFrame of the harness's.
 */
const scrollSettled = (page) =>
  page.evaluate(async () => {
    const began = performance.now();
    let last = window.scrollY;
    let still = began;
    while (performance.now() - began < 4_000) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      if (window.scrollY !== last) {
        last = window.scrollY;
        still = performance.now();
      } else if (performance.now() - still >= 200) break;
    }
    return window.scrollY;
  });


// ---------------------------------------------------------------- the light dive, its facts, the ring, its drag and the sheet

/** The light dive's sizes: a laptop, a short laptop and a phone (touch, coarse pointer, two device pixels). */
const DIVE_SIZES = [
  { width: 1440, height: 900, options: {} },
  { width: 1366, height: 657, options: {} },
  { width: 390, height: 844, options: { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
];

/** The laptop and the phone alone, for the steps that run at two sizes. */
const TWO_SIZES = [DIVE_SIZES[0], DIVE_SIZES[2]];

/** The mock-up's data per way frame (tests/fixtures/light-dive, the previs's export): the light's place on the frame, 0..1. */
const WAY_FIXTURE = {
  desk: JSON.parse(readFileSync(fileURLToPath(new URL('../../tests/fixtures/light-dive/way-desk.json', import.meta.url)), 'utf8')),
  phone: JSON.parse(readFileSync(fileURLToPath(new URL('../../tests/fixtures/light-dive/way-phone.json', import.meta.url)), 'utf8')),
};

/** The way frames each fact peaks at (01 to 05), and the side each fact's move takes the light to (-1 left, 1 right). */
const FACT_PEAKS = [81, 121, 161, 201, 241];
const FACT_SIDES = [-1, 1, -1, 1, -1];

/** The way frames the light is checked against the mock-up's data at, within LIGHT_PX. */
const LIGHT_FRAMES = [20, 60, 121, 241];
const LIGHT_PX = 6;

/** A point from the bridge's NDC (+y up) to CSS px on a screen of `size`. */
const ndcToPx = (ndc, size) => ({ x: ((ndc.x + 1) / 2) * size.width, y: ((1 - ndc.y) / 2) * size.height });

/**
 * A page at `size` with the seen flag set and every requestAnimationFrame counted (`window.__allRaf`), landed on the home
 * with the void ready; a CDP session for a touch screen. Answers `{ context, page, cdp, touch }`.
 */
async function readyHome(browser, step, size, path = '/') {
  const { context, page } = await openSeen(browser, step, size);
  await countAllFrames(context);
  const touch = size.options.hasTouch === true;
  const cdp = touch ? await context.newCDPSession(page) : null;
  await landHome(page, path);
  await page.waitForFunction(() => window.__needleDebug().journey.voidState === 'ready', null, { timeout: 30_000 });
  // A laptop's pointer, parked high; a phone has none (a mouse moved there would be a pointer the scene reads).
  if (!touch) await page.mouse.move(size.width * 0.5, size.height * 0.2);
  return { context, page, cdp, touch };
}

/** Puts the story at `progress` through the bridge and answers the bridge's state once the scene has posed it (three frames). */
const poseAt = (page, progress) =>
  page.evaluate(async (p) => {
    window.__needleDebug.set({ progress: p });
    for (let i = 0; i < 3; i++) await new Promise((resolve) => requestAnimationFrame(resolve));
    return JSON.parse(JSON.stringify(window.__needleDebug()));
  }, progress);

/**
 * A slow finger on a touch screen (CDP), from (x0, y0) to (x1, y1) in steps of 8 px 16 ms apart, held still `hold` ms
 * before the lift, so no glide goes on from it: the story rests where the finger stopped.
 */
async function slowTouch(page, cdp, [x0, y0], [x1, y1], hold = 250) {
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await touch('touchStart', x0, y0);
  const steps = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 8));
  for (let i = 1; i <= steps; i++) {
    await touch('touchMove', x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(hold);
  await touch('touchEnd', x1, y1);
}

/** One step down the story (1) or up it (-1) as a visitor gives it: a wheel notch, or on a phone a short swipe with no glide. */
async function nudge(page, cdp, direction, px = RISE.notchPx) {
  if (cdp === null) {
    await page.mouse.wheel(0, direction * px);
    return;
  }
  await slowTouch(page, cdp, [195, 500], [195, 500 - direction * px], 40);
}

/**
 * The light dive (spec §2): at 1440x900 and at 390x844 (touch), each in a fresh context with the void ready.
 * 1. The light stands where the mock-up's data puts it (tests/fixtures/light-dive/way-<desk|phone>.json) at way frames
 *    20, 60, 121 and 241, within LIGHT_PX: the bridge's `journey.light` (the pose projected) against the frame's. The
 *    dive runs frames 1 to 256, where the light's path takes over (step `path`).
 * 2. From BOB from above, wheel notches (swipes on the phone) run the way frames up to the path, never back; from the
 *    fall, notches up run them back, never forward.
 * 4. Stopped mid-fall (two notches from fact 03's frame), the story rests where the input stopped, not on a stop, and
 *    the canvas sleeps within a second.
 * 5. At 1440x900, the drop into the stack (spec 2026-10-29-bob-stack-3-design.md, goal 1: "a bit slower"): from the
 *    hand-over to the light on the lid (the world's power begins) takes nine wheel notches or more, rested after each.
 */
async function lightDive(browser, step) {
  const summary = [];
  for (const size of TWO_SIZES) {
    const at = sizeName(size);
    const { context, page, cdp, touch } = await readyHome(browser, step, size);
    const set = size.width < size.height ? 'phone' : 'desk';
    let worst = 0;
    for (const f of LIGHT_FRAMES) {
      const state = await poseAt(page, placeOfFrame(f));
      const want = WAY_FIXTURE[set][f - 1].light;
      const light = state.journey.light === null ? null : ndcToPx(state.journey.light, size);
      const off = light === null ? Number.POSITIVE_INFINITY : Math.hypot(light.x - want.x * size.width, light.y - want.y * size.height);
      worst = Math.max(worst, off);
      step.check(
        state.journey.stretch === 'light' && Math.round(state.journey.frame) === f && off <= LIGHT_PX,
        `${at}: way frame ${f} (the bridge's ${state.journey.frame?.toFixed(2)}): the light at ${light === null ? 'none' : `(${light.x.toFixed(1)}, ${light.y.toFixed(1)})`} px, ${off.toFixed(2)} px from the mock-up's (${(want.x * size.width).toFixed(1)}, ${(want.y * size.height).toFixed(1)}), at most ${LIGHT_PX}`,
      );
    }
    // The circuit light (spec 2026-10-29-bob-stack-2-design.md, goal 4): its frame, its dial and its five traces drawn,
    // the traces standing above it on the screen (the bridge's `journey.circuit`); and its wide aura, breathing round it
    // (spec 2026-10-29-bob-stack-3-design.md, goal 3: "B · Glow").
    for (const f of [72, 121, 201]) {
      const state = await poseAt(page, placeOfFrame(f));
      const c = state.journey.circuit ?? null;
      const light = state.journey.light;
      step.check(
        c !== null && ['light:aura', 'light:frame', 'light:dial'].every((part) => c.parts.includes(part)) && c.traces === 5 && c.top !== null && light !== null && c.top.y > light.y + 0.05,
        `${at}: at way frame ${f} the circuit light's aura, frame, dial and five traces are drawn (${c?.parts.join(', ')}; ${c?.traces} traces), the traces standing above it (their top at ${c?.top?.y.toFixed(3)}, the light at ${light?.y.toFixed(3)} NDC)`,
      );
    }
    // The camera of the first frame that poses the journey stands on that frame's shot (the same-frame check): on the
    // rise, in the fall, and on the path in a travel and an arrival, where the camera moves fastest.
    const aspect = size.width / size.height;
    for (const p of SAME_FRAME_AT) {
      const posed = await poseOnTheFrame(page, p, aspect);
      const shot = journeyPoseAt(p, aspect).shot;
      const on = posed !== null && posed.camera.position.every((v, i) => near(v, shot.position[i], 1e-3)) && near(posed.camera.fov, shot.fov, 1e-3);
      step.check(on, `${at}: at ${p.toFixed(3)} the first frame that poses the journey has its camera on that frame's shot (tick ${posed?.tick})`);
    }
    // 2. Down from BOB from above to the path, and back up from the fall.
    await poseAt(page, 1);
    const down = [];
    for (let i = 0; i < 60; i++) {
      if (touch) await swipe(page, cdp, 560, 400);
      else await page.mouse.wheel(0, RISE.notchPx);
      await page.waitForTimeout(touch ? 150 : 70);
      const s = await debugOf(page);
      down.push(s.journey.stretch === 'light' ? s.journey.frame : s.journey.stretch === 'land' ? 257 : s.journey.stretch === 'rise' ? 0 : 999);
      if (s.journey.stretch === 'land') break;
    }
    const monotone = (list, sign) => list.every((v, i) => i === 0 || sign * (v - list[i - 1]) >= -1e-6);
    step.check(monotone(down, 1) && down.at(-1) === 257 && down.length > 4, `${at}: ${touch ? 'swipes' : 'wheel notches'} from BOB from above run the way frames forward to the path, never back (${down.length} inputs: ${down.map((f) => Math.round(f)).join(' ')})`);
    await poseAt(page, placeOfFrame(220));
    const up = [];
    for (let i = 0; i < 6; i++) {
      if (touch) await swipe(page, cdp, 400, 560);
      else await page.mouse.wheel(0, -RISE.notchPx);
      await page.waitForTimeout(touch ? 150 : 70);
      const s = await debugOf(page);
      up.push(s.journey.stretch === 'light' ? s.journey.frame : 0);
    }
    step.check(monotone(up, -1) && up.at(-1) < 220, `${at}: scrolling up from way frame 220 runs it back, never forward (${up.map((f) => Math.round(f)).join(' ')})`);
    // 3. Stopped mid-fall.
    await poseAt(page, placeOfFrame(140));
    await nudge(page, cdp, 1);
    await nudge(page, cdp, 1);
    const rest = await restAt(page);
    const settledIn = await settlesToStorm(page, 4_000);
    const onStop = keyStops(HOME_CHAPTERS).some((stop) => near(stop, rest.target, 1e-3));
    step.check(!onStop && rest.target > placeOfFrame(140) && rest.target < PATH_START, `${at}: two inputs from way frame 140 rest where they stopped, ${rest.target.toFixed(4)}, not on a stop`);
    step.check(settledIn !== null && settledIn <= 1_000, `${at}: at rest mid-fall the canvas draws the storm alone within a second, no more than ${STORM_FPS_MAX} frames a second (from ${settledIn} ms on)`);
    // 5. The drop into the stack, notch by notch from the hand-over until the light is on the lid.
    let dropNotches = null;
    if (!touch) {
      await poseAt(page, PATH_START);
      await restAt(page);
      for (let n = 1; n <= 30; n++) {
        await page.mouse.wheel(0, RISE.notchPx);
        await restAt(page);
        const s = await debugOf(page);
        if ((s.journey.world?.power ?? 0) > 0) {
          dropNotches = n;
          break;
        }
      }
      step.check(dropNotches !== null && dropNotches >= 9, `${at}: from the hand-over to the light on the lid takes ${dropNotches ?? 'more than 30'} wheel notches, nine or more`);
    }
    summary.push(`${at}: the light within ${worst.toFixed(1)} px of the data, ${down.length} inputs to the path${dropNotches === null ? '' : `, ${dropNotches} notches from the hand-over to the lid`}`);
    await context.close();
  }
  return summary.join('; ');
}

/**
 * Bob's five facts beside the light (spec §3), at 1440x900, 1366x657 and 390x844 (touch), in Dutch and in English:
 * - at each fact's peak exactly one label shows, its number (01 to 05) and the dictionary's words in capitals, "/" a
 *   line break, in order; through the whole fall (every other way frame, 61 to 260) never two at once;
 * - its words at least 13 CSS px on a laptop and 11 on the phone;
 * - on a laptop the label rides level with the light on the side away from its move (01 right of it, 02 left, ...);
 * - on the phone it hangs below the light, its line stepped aside away from the move, and the picture under the line
 *   (the label hidden) is dark: mean luma at most 0.05, so the line never lies on the tail.
 */
/**
 * The most the picture under a fact's line on the phone may measure (mean luma): dark, never on the tail. It was 0.05
 * until stack round 3 gave the light its wide breathing aura (Bob's "B · Glow", spec 2026-10-29-bob-stack-3-design.md,
 * goal 3), which the line's top now passes through as it leaves the light (0.091 at fact 01, 0.051 at fact 05). A line on
 * the tail's traces would still fail it.
 */
const FACT_LINE_DARK = 0.1;

async function lightFacts(browser, step) {
  const meter = await browser.newContext();
  const meterPage = await meter.newPage();
  const summary = [];
  for (const size of DIVE_SIZES) {
    const at = sizeName(size);
    const phone = size.width < size.height;
    for (const lang of ['nl', 'en']) {
      const { t } = new Translator(lang);
      const { context, page } = await readyHome(browser, step, size, lang === 'nl' ? '/' : '/en/');
      for (let i = 0; i < 5; i++) {
        const state = await poseAt(page, placeOfFrame(FACT_PEAKS[i]));
        const shown = await page.evaluate(() =>
          [...document.querySelectorAll('.light-fact')]
            .map((el) => {
              const box = (part) => {
                const r = el.querySelector(part).getBoundingClientRect();
                return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
              };
              const text = el.querySelector('.light-fact-text');
              return {
                opacity: Number(getComputedStyle(el).opacity),
                n: el.querySelector('.light-fact-n').textContent,
                text: text.innerText,
                size: Number.parseFloat(getComputedStyle(text).fontSize),
                line: box('.light-fact-line'),
                words: box('.light-fact-words'),
              };
            })
            .filter((label) => label.opacity > 0.01),
        );
        const want = t.lightDive.facts[i].toUpperCase().split(' / ').join('\n');
        const label = shown[0];
        step.check(
          shown.length === 1 && label.n === `0${i + 1}` && label.text === want,
          `${at} ${lang}: at fact 0${i + 1}'s peak one label shows, 0${i + 1}, "${want.replace(/\n/g, ' / ')}" (got ${JSON.stringify(shown.map((l) => [l.n, l.text]))})`,
        );
        if (label === undefined) continue;
        step.check(label.size >= (phone ? 11 : 13), `${at} ${lang}: fact 0${i + 1}'s words at ${label.size} px, at least ${phone ? 11 : 13}`);
        const light = ndcToPx(state.journey.light, size);
        if (!phone) {
          const right = FACT_SIDES[i] < 0;
          step.check(
            right ? label.line.left > light.x && label.words.left > light.x : label.line.right < light.x && label.words.right < light.x,
            `${at} ${lang}: fact 0${i + 1} rides ${right ? 'right' : 'left'} of the light (x ${light.x.toFixed(0)}), away from its move: line ${label.line.left.toFixed(0)}-${label.line.right.toFixed(0)}, words ${label.words.left.toFixed(0)}-${label.words.right.toFixed(0)}`,
          );
          step.check(Math.abs((label.line.top + label.line.bottom) / 2 - light.y) <= 1.5, `${at} ${lang}: fact 0${i + 1}'s line is level with the light (y ${light.y.toFixed(1)}, line ${label.line.top.toFixed(1)})`);
        } else {
          const lineX = (label.line.left + label.line.right) / 2;
          const aside = (24 * size.width) / 585;
          step.check(
            label.words.top > light.y && near(lineX - light.x, -FACT_SIDES[i] * aside, 2),
            `${at} ${lang}: fact 0${i + 1} hangs below the light, its line ${(lineX - light.x).toFixed(1)} px aside (${(-FACT_SIDES[i] * aside).toFixed(1)}, away from the move), its words from y ${label.words.top.toFixed(0)}`,
          );
          if (lang === 'nl') {
            await page.evaluate(() => document.querySelector('.light-fact-layer').style.setProperty('visibility', 'hidden'));
            await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            const file = join(STILLS, `fact-line-${at}-${i + 1}.png`);
            mkdirSync(STILLS, { recursive: true });
            await page.screenshot({ path: file, clip: { x: label.line.left - 3, y: label.line.top, width: label.line.right - label.line.left + 6, height: label.line.bottom - label.line.top } });
            await page.evaluate(() => document.querySelector('.light-fact-layer').style.removeProperty('visibility'));
            const luma = await lumaOf(meterPage, file);
            step.check(luma.mean <= FACT_LINE_DARK, `${at}: the picture under fact 0${i + 1}'s line is dark, mean luma ${luma.mean.toFixed(4)}, at most ${FACT_LINE_DARK}`);
          }
        }
      }
      if (lang === 'nl' && size !== DIVE_SIZES[1]) {
        const most = await page.evaluate(async (places) => {
          let most = 0;
          for (const place of places) {
            window.__needleDebug.set({ progress: place });
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            most = Math.max(most, [...document.querySelectorAll('.light-fact')].filter((el) => Number(getComputedStyle(el).opacity) > 0.01).length);
          }
          return most;
        }, Array.from({ length: 100 }, (_, i) => placeOfFrame(61 + 2 * i))); // way frames 61 to 259, every other
        step.check(most <= 1, `${at}: through the fall, never two labels at once (at most ${most})`);
        // Fact 05 across the hand-over (way frame 256, where the path takes over): it fades out as it does in the fall,
        // never cut, and is gone by frame 260 on the path's own start.
        const tail = [];
        for (const f of [244, 248, 252, 254, 256, 257, 258, 259, 260, 262]) {
          await poseAt(page, placeOfFrame(f));
          tail.push(await page.evaluate(() => Math.max(0, ...[...document.querySelectorAll('.light-fact')].map((el) => Number(getComputedStyle(el).opacity)))));
        }
        const fading = tail.every((o, i) => i === 0 || o <= tail[i - 1] + 1e-3);
        step.check(fading && tail[4] > 0.05 && tail[4] < 0.95 && tail.at(-1) === 0, `${at}: fact 05 fades out across the hand-over, never cut: ${tail.map((o) => o.toFixed(2)).join(' ')} at frames 244 to 262 (part way at 256, gone by 262)`);
      }
      await context.close();
    }
    summary.push(`${at}: five facts, NL and EN`);
  }
  await meter.close();
  return summary.join('; ');
}

/**
 * The engraved way (spec 2026-10-27-bob-engraved-way-design.md), at 1440x900 and 390x844 (touch), each in a fresh
 * context landed with the void ready:
 * - from BOB from above, wheel notches (short swipes) run the fall: the shaft's throat (the bridge's
 *   `journey.engraved.throat`) lights as the light drops into the compass, and is 0 at every sample where one of Bob's
 *   facts shows;
 * - posed at way frames 32, 40, 72 and 121, the bridge's levels are the rules' (`engravedLevels`): the throat whole by
 *   40, the hall in as the camera turns (72) and given way to the nebula's clouds by fact 02's peak (the 3D world);
 * - from fact 01's peak to fact 05's by input: the way frame runs 299/6 frames a viewport height of input, half the
 *   first fall's pace, so the 160 frames take 3.21 viewport heights where they took 1.61;
 * - on the hologram world none of it shows: not on the land, at the world's stop, at any area's stop or between two,
 *   nor in the look back (the shaft gives way to the world, and the trips' lines went with the beads);
 * - stills at way frames 32 and 121 through the home's luma gate.
 */
async function engraved(browser, step) {
  const summary = [];
  const gated = [];
  const span = placeOfFrame(241) - placeOfFrame(81);
  for (const size of TWO_SIZES) {
    const at = sizeName(size);
    const { context, page, cdp, touch } = await readyHome(browser, step, size);
    const input = touch ? 'short swipes' : 'wheel notches';

    // Down the fall by real input, the throat out wherever a fact shows.
    await poseAt(page, 1);
    await restAt(page);
    const samples = [];
    for (let i = 0; i < 90; i++) {
      await nudge(page, cdp, 1);
      await page.waitForTimeout(touch ? 40 : 90);
      const sample = await page.evaluate(() => {
        const d = window.__needleDebug();
        const fact = [...document.querySelectorAll('.light-fact')].some((el) => Number(getComputedStyle(el).opacity) > 0.01);
        return { stretch: d.journey.stretch, frame: d.journey.frame, throat: d.journey.engraved?.throat ?? null, fact };
      });
      samples.push(sample);
      if (sample.stretch === 'land') break;
    }
    const fall = samples.filter((sample) => sample.stretch === 'light');
    const withFact = fall.filter((sample) => sample.fact);
    const crossed = withFact.filter((sample) => sample.throat !== 0);
    const most = Math.max(0, ...fall.map((sample) => sample.throat ?? 0));
    step.check(
      samples.at(-1)?.stretch === 'land' && withFact.length >= 5 && crossed.length === 0,
      `${at}: ${samples.length} ${input} from BOB from above run down the fall to the path; the throat is 0 at every one of the ${withFact.length} samples where a fact shows (not at ${crossed.map((sample) => `frame ${sample.frame?.toFixed(0)}: ${sample.throat}`).join(', ') || 'any'})`
    );
    step.check(most > 0.5, `${at}: and the throat shows as the light drops into the compass (at most ${most.toFixed(3)} on the way down)`);

    // Posed: the rules' levels.
    const posed = {};
    for (const f of [32, 40, 72, 121]) {
      const state = await poseAt(page, placeOfFrame(f));
      const got = state.journey.engraved;
      const want = engravedLevels({ stretch: 'light', frame: state.journey.frame });
      posed[f] = got;
      step.check(
        got !== null && near(got.throat, want.throat, 1e-9) && near(got.hall, want.hall, 1e-9) && got.trips.length === 0,
        `${at}: at way frame ${f} the bridge's levels are the rules': throat ${got?.throat.toFixed(4)} (${want.throat.toFixed(4)}), hall ${got?.hall.toFixed(4)} (${want.hall.toFixed(4)}), trips ${JSON.stringify(got?.trips)}`
      );
    }
    step.check(
      posed[40]?.throat > 0.9 && posed[72]?.hall > 0.9 && posed[121]?.hall === 0 && posed[121]?.throat === 0,
      `${at}: the throat whole by way frame 40 (${posed[40]?.throat}), the hall in as the camera turns (${posed[72]?.hall}), and at fact 02's peak the hall given way to the clouds and the throat gone (${posed[121]?.hall}, ${posed[121]?.throat})`
    );

    // The pace, by input: fact 01's peak to past fact 05's.
    await poseAt(page, placeOfFrame(81));
    await restAt(page);
    let inputs = 0;
    while (inputs < 60 && (await debugOf(page)).target < placeOfFrame(241)) {
      await nudge(page, cdp, 1);
      inputs++;
      await page.waitForTimeout(touch ? 40 : 60);
    }
    const rest = await restAt(page);
    const restState = await debugOf(page);
    const moved = rest.target - placeOfFrame(81);
    const perHeight = (restState.journey.frame - 81) / moved;
    const wheelExact = touch || near(moved, (inputs * RISE.notchPx) / size.height, 1e-6);
    step.check(
      restState.journey.stretch === 'light' && restState.journey.frame >= 241 && near(perHeight, 299 / 6, 0.05) && wheelExact,
      `${at}: from fact 01's peak, ${inputs} ${input} of ${RISE.notchPx} px reach fact 05's (frame ${restState.journey.frame?.toFixed(1)}) over ${moved.toFixed(3)} viewport heights: ${perHeight.toFixed(2)} frames a height, 299/6 = ${(299 / 6).toFixed(2)}, half the first fall's ${(299 / 3).toFixed(2)}; fact 01 to 05 is ${span.toFixed(3)} heights, twice ${(span / 2).toFixed(3)}`
    );

    // On the world none of it shows.
    const worldPlaces = [
      ['on the land', PATH_START + 0.4],
      ["at the world's stop", WORLD_STOP],
      ...PROJECT_LIST.flatMap((bead) => [
        [`at ${bead.id}'s area`, bead.stop],
        [`in the pause after ${bead.id}'s area`, (bead.stop + areaEnd(bead)) / 2],
      ]),
      ['in the look back', LOOK_STOP],
    ];
    for (const [where, place] of worldPlaces) {
      const there = await poseAt(page, place);
      const lv = there.journey.engraved;
      step.check(
        lv !== null && lv.throat === 0 && lv.hall === 0 && lv.trips.length === 0,
        `${at}: ${where} none of it shows (${there.journey.stretch} ${there.journey.local.toFixed(2)}, ${JSON.stringify(lv)})`
      );
    }

    // Stills: the fall's through the home's luma gate.
    mkdirSync(STILLS, { recursive: true });
    for (const [name, progress] of [['fall-32', placeOfFrame(32)], ['fall-121', placeOfFrame(121)]]) {
      await poseAt(page, progress);
      await page.waitForTimeout(500);
      const file = join(STILLS, `engraved-${name}-${at}.png`);
      await page.screenshot({ path: file });
      gated.push({ file, kind: 'home', mask: await textMask(page) });
    }
    await takeCsp(page, step);
    summary.push(`${at}: ${samples.length} inputs down the fall, ${inputs} from fact 01 to 05`);
    await context.close();
  }
  step.luma = await gateLuma(browser, step, gated);
  return `${summary.join('; ')}; ${lumaSummary(step.luma, 'home')}`;
}

/**
 * The story to `place`, the next key stop down the story: on a laptop by the arrow key (past the rise each arrow is a
 * stop); on a phone through the bridge, as a finger on the path rests where it stops, as in the fall, and has no key.
 * Answers the rest.
 */
async function stepStop(page, cdp, place) {
  if (cdp === null) await page.keyboard.press('ArrowDown');
  else await page.evaluate((p) => window.__needleDebug.set({ progress: p }), place);
  return restAt(page);
}

// ---------------------------------------------------------------- the hologram world

/** The stack's axis on a screen of `aspect` (src/scene/bob/worldPath.ts): the CPU and the spine, which no camera crosses. */
const boardCentre = (aspect) => worldPathFor(aspect).centre;

/** The least level distance (m) from the board's centre among camera positions `seen`. */
const nearestToCentre = (seen, centre) => Math.min(...seen.map((p) => Math.hypot(p[0] - centre[0], p[2] - centre[2])));

/** The words a project's own page should say in `locale` (src/ui/ProjectView.tsx): its kind of work, its name and its summary. */
const viewWords = (id, locale) => {
  const project = PROJECTS.byId(id);
  return { kind: project.category.heading(locale), title: project.title, summary: project.copy(locale).summary };
};

/** Starts recording the camera's position and the world's state every 16 ms (`window.__worldSeen`). */
const watchWorld = (page) =>
  page.evaluate(() => {
    window.__worldSeen = [];
    window.__worldTimer = setInterval(() => {
      const d = window.__needleDebug();
      window.__worldSeen.push({ p: d.progress, camera: d.camera.position, stretch: d.journey.stretch, power: d.journey.world?.power ?? null, explode: d.journey.world?.explode ?? null, light: d.journey.light });
    }, 16);
  });

/** Stops the recording and answers it. */
const worldSeen = (page) =>
  page.evaluate(() => {
    clearInterval(window.__worldTimer);
    return window.__worldSeen;
  });

/**
 * The world's words as the page shows them now (src/ui/WorldNames.tsx, AreaCaption.tsx, AreaDots.tsx): each name (its
 * text, whether it shows, its opacity, its place in Tab's order, its box and link), the hint, each area's words and the
 * dots. The hint's and an area's words are those a visitor sees (the pointer's or the touch screen's).
 */
const worldWordsOf = (page) =>
  page.evaluate(() => {
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    };
    const seen = (el) => [...el.querySelectorAll('span')].filter((s) => getComputedStyle(s).display !== 'none').map((s) => s.textContent).join('');
    const hint = document.querySelector('.world-hint');
    const nav = document.querySelector('.area-dots');
    return {
      names: [...document.querySelectorAll('.world-name')].map((el) => ({
        id: el.dataset.project,
        // The name itself (round 10: its floor's heading over it and how to open it under it, aria-hidden).
        text: el.querySelector('.world-name-title')?.textContent ?? el.textContent,
        kicker: el.querySelector('.world-name-kicker')?.textContent ?? null,
        open: el.querySelector('.world-name-open .world-hint-fine')?.textContent ?? null,
        shown: el.hasAttribute('data-shown') && getComputedStyle(el).visibility === 'visible',
        opacity: Number(el.style.opacity),
        tab: el.tabIndex,
        href: el.getAttribute('href'),
        box: box(el),
      })),
      hint: { opacity: Number(hint.style.opacity), text: seen(hint) },
      captions: [...document.querySelectorAll('.area-caption')].map((el) => ({
        area: Number(el.dataset.area),
        opacity: Number(el.style.opacity),
        seen: Number(getComputedStyle(el).opacity),
        pointer: getComputedStyle(el).pointerEvents,
        inert: el.hasAttribute('inert'),
        category: el.querySelector('.area-caption-category')?.textContent ?? null,
        titles: [...el.querySelectorAll('.area-caption-title')].map((a) => a.textContent),
        hint: seen(el.querySelector('.area-caption-hint')),
        box: box(el),
      })),
      dots: { opacity: Number(nav.style.opacity), inert: nav.hasAttribute('inert'), current: [...nav.querySelectorAll('button')].map((b) => b.getAttribute('aria-current') === 'true') },
    };
  });

/** True when `b` (a box) lies inside a screen of `size`, under the header, with a pixel of rounding. */
const boxInside = (b, size) => b.left >= -1 && b.right <= size.width + 1 && b.top >= HEADER_PX - 1 && b.bottom <= size.height + 1;

/**
 * An open project as the page shows it now (src/ui/ProjectView.tsx): whether `<html data-inside>` is set, the open
 * project the history's entry carries (React Router keeps a navigation's state in `history.state.usr`), the history's
 * length, the page's path, the project's own page shown whole (its words, its link to the longer page, its phones, the
 * phones' dots shown, its picture blocks, its torn top's box and its own scroll), the way back (shown, its words and box),
 * the focus, the story's place and the scene's phase.
 */
const openOf = (page) =>
  page.evaluate(() => {
    const d = window.__needleDebug();
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    };
    const shown = (el) => el !== null && el !== undefined && el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    const view = [...document.querySelectorAll('.project-view')].find((el) => Number(el.style.opacity) > 0.99 && !el.hasAttribute('inert')) ?? null;
    const text = (sel) => view?.querySelector(sel)?.textContent ?? null;
    const back = document.querySelector('.pv-back');
    return {
      open: document.documentElement.hasAttribute('data-inside'),
      state: history.state?.usr?.['bob-inside'] ?? null,
      entries: history.length,
      path: location.pathname,
      view:
        view === null
          ? null
          : {
              id: view.dataset.project,
              kind: text('.pv-kind'),
              title: text('.pv-title'),
              summary: text('.pv-lead'),
              more: text('.pv-more'),
              href: view.querySelector('.pv-more')?.getAttribute('href') ?? null,
              phones: view.querySelectorAll('.pv-phone').length,
              dots: view.querySelector('.pv-dots') !== null && getComputedStyle(view.querySelector('.pv-dots')).display !== 'none',
              media: view.querySelectorAll('.pv-media').length,
              cards: view.querySelectorAll('.pv-card.pv-wide').length,
              top: box(view.querySelector('.pv-top')),
              scrollTop: view.scrollTop,
            },
      back: shown(back) ? { text: back.textContent, box: box(back) } : null,
      focus: document.activeElement?.className ?? null,
      progress: d.progress,
      target: d.target,
      phase: d.phase.kind,
    };
  });

/** Waits until project `id` is open and its own page whole (or `ms` passes); answers the time it took, or null. */
const openWithin = (page, id, ms = 6_000) => {
  const began = Date.now();
  return page
    .waitForFunction(
      (id) => {
        const view = document.querySelector(`.project-view[data-project="${id}"]`);
        return document.documentElement.hasAttribute('data-inside') && history.state?.usr?.['bob-inside'] === id && view !== null && Number(view.style.opacity) > 0.99;
      },
      id,
      { timeout: ms },
    )
    .then(() => Date.now() - began, () => null);
};

/**
 * Does `act` (a click, a tap or a key that opens project `id`) and checks the open project that follows: within
 * FLIGHT_MS and a little its own page whole, the page still `home` with the open project's own history entry, on the
 * scroll's phase, its words the dictionary's (`locale`) with "Lees meer", the way back shown and the focus on it.
 * Answers the time it took (ms), or null.
 */
async function opensProject(page, step, at, id, how, act, home = '/') {
  const locale = home === '/en/' ? 'en' : 'nl';
  const words = new Translator(locale).t.needle.page;
  await act();
  const took = await openWithin(page, id);
  await page.waitForTimeout(300);
  const s = await openOf(page);
  const want = viewWords(id, locale);
  step.check(took !== null && took <= FLIGHT_MS + 800, `${at}: ${how}: ${id} open within ${FLIGHT_MS + 800} ms, its own page whole (${took === null ? 'never' : `${took} ms`})`);
  step.check(s.path === home && s.state === id && s.phase === 'PROJECTS', `${at}: ${how}: the page still ${home}, its history entry the open project's (${s.state}), on the scroll's phase (${s.phase})`);
  step.check(
    s.view !== null && s.view.id === id && s.view.kind === want.kind && s.view.title === want.title && s.view.summary === want.summary && s.view.more === words.readMore,
    `${at}: ${how}: its page says "${want.kind}", "${want.title}", its summary and "${words.readMore}" (got ${JSON.stringify(s.view && [s.view.kind, s.view.title, s.view.more])})`,
  );
  step.check(s.back !== null && s.back.text.includes(words.back) && s.focus?.includes('pv-back') === true, `${at}: ${how}: "${words.back}" shown, the focus on it (${s.focus})`);
  return took;
}

/**
 * Does `act` (a way out of an open project) and checks that the visitor is back out at `place`, at rest, the story not
 * moved on and the page gone; then waits out the flight back (FLIGHT_MS).
 */
async function leavesProject(page, step, at, place, how, act) {
  await act();
  const out = await page
    .waitForFunction(
      (place) => {
        const d = window.__needleDebug();
        return !document.documentElement.hasAttribute('data-inside') && d.phase.kind === 'PROJECTS' && Math.abs(d.progress - place) < 1e-9 && Math.abs(d.target - place) < 1e-9;
      },
      place,
      { timeout: 5_000 },
    )
    .then(() => true, () => false);
  await page.waitForTimeout(FLIGHT_MS + 300);
  const after = await openOf(page);
  step.check(out && !after.open && after.view === null && Math.abs(after.progress - place) < 1e-9, `${at}: ${how}: back out at ${place.toFixed(4)}, at rest and not moved on (progress ${after.progress}, target ${after.target}, open ${after.open}, page ${after.view?.id ?? 'none'})`);
}


/** Where an open project's middle stands on a screen of this size, its own page's torn top (src/scene/bob/spot.ts `PAGE_SPOT`), NDC. */
const spotNdc = (size) => (size.width / size.height < 0.8 ? PAGE_SPOT.phone.ndc : PAGE_SPOT.desk.ndc);

/** Project `id`'s object's middle on the screen now (its click's sphere, as the bridge places it), NDC; null if none. */
const objectNdc = async (page, size, id) => {
  const object = (await debugOf(page)).journey.objects?.find((o) => o.id === id);
  return object === undefined ? null : [(object.x / size.width) * 2 - 1, 1 - (object.y / size.height) * 2];
};

/** The ids of the names shown now. */
const namesShown = (words) => words.names.filter((n) => n.shown && n.opacity > 0).map((n) => n.id);

/** A click (a tap on a touch screen) at the middle of project `id`'s object, as the bridge places it on the screen. */
async function pressObject(page, touch, id) {
  const object = (await debugOf(page)).journey.objects?.find((o) => o.id === id);
  if (object === undefined) return false;
  if (touch) await page.touchscreen.tap(object.x, object.y);
  else await page.mouse.click(object.x, object.y);
  return true;
}

/**
 * The world (spec 2026-10-28-bob-quantum-stack-design.md, goals 1, 2 and 6), at 1440x900 and 390x844 (touch), and at
 * 1440 on /en/: from the last fact a step (the arrow; on the phone slow swipes, then the bridge to the stop) brings the
 * light down into the CPU and rests on the world's stop: on the way the power comes up from dark once the light is down
 * and never falls back, and the stack opens from closed to open and never closes again; at rest every object framed
 * inside the screen (the whole machine); no name shows until the mouse is on a project, then its alone (the title in
 * capitals, in Tab's reach, inside the screen and under the header, a link to its page), and none on a touch screen;
 * the hint below in the page's words for a pointer or a touch screen; a still through the home's luma gate; each
 * project's object opens it (a click, a tap) and the way out comes back to the world's stop.
 */
async function worldStep(browser, step) {
  const summary = [];
  const shots = [];
  mkdirSync(STILLS, { recursive: true });
  const runs = [...TWO_SIZES.map((size) => ({ size, path: '/' })), { size: TWO_SIZES[0], path: '/en/' }];
  for (const { size, path } of runs) {
    const english = path === '/en/';
    const locale = english ? 'en' : 'nl';
    const at = `${sizeName(size)}${english ? ' /en/' : ''}`;
    const { context, page, cdp, touch } = await readyHome(browser, step, size, path);
    const t = new Translator(locale).t.needle.world;
    const lastFact = keyStops(HOME_CHAPTERS).filter((p) => p < WORLD_STOP).at(-1);
    await poseAt(page, lastFact);
    await restAt(page);
    if (!touch) await page.mouse.move(4, size.height - 4);
    await watchWorld(page);
    if (touch) {
      for (let i = 0; i < 12 && (await restAt(page)).target < WORLD_STOP - 0.35; i++) await slowTouch(page, cdp, [195, 600], [195, 400], 250);
      await restAt(page);
    }
    const rest = await stepStop(page, cdp, WORLD_STOP);
    await page.waitForTimeout(400);
    const seen = await worldSeen(page);
    const state = await debugOf(page);
    step.check(
      near(rest.target, WORLD_STOP, 1e-9) && state.journey.stretch === 'land' && state.journey.world?.power === 1 && state.journey.world?.names === 1 && state.journey.world?.explode === 1,
      `${at}: ${touch ? 'slow swipes, then the bridge,' : 'a press of the arrow'} from the last fact (${lastFact.toFixed(3)}) rests on the world's stop, ${WORLD_STOP.toFixed(4)} (got ${rest.target.toFixed(4)}, ${state.journey.stretch}), the stack open (${state.journey.world?.explode}), powered (${state.journey.world?.power}) and the names free to show (${state.journey.world?.names})`,
    );
    const powers = seen.filter((s) => s.stretch === 'land' && s.power !== null).map((s) => s.power);
    const dark = powers.findIndex((p) => p <= 0.05);
    const fell = powers.some((p, k) => k > 0 && p < powers[k - 1] - 1e-6);
    step.check(dark >= 0 && !fell && powers.at(-1) === 1, `${at}: on the way the stack is dark as the light comes down (${dark >= 0 ? `power ${powers[dark].toFixed(3)} at sample ${dark}` : 'never dark'}) and powers up to 1 without falling back (${powers.length} samples on the land)`);
    const opens = seen.filter((s) => s.stretch === 'land' && s.explode !== null).map((s) => s.explode);
    const shut = opens.findIndex((e) => e <= 0.01);
    const closing = opens.some((e, k) => k > 0 && e < opens[k - 1] - 1e-6);
    step.check(shut >= 0 && !closing && opens.at(-1) === 1, `${at}: the stack closed as the light comes in (${shut >= 0 ? `at sample ${shut}` : 'never closed'}), then exploding open to 1 and never closing again (${opens.length} samples)`);
    const objects = state.journey.objects ?? [];
    step.check(
      objects.length === PROJECT_LIST.length && objects.every((o) => o.visible && o.x - o.r >= 0 && o.x + o.r <= size.width && o.y - o.r >= HEADER_PX && o.y + o.r <= size.height),
      `${at}: every object framed inside the screen (${objects.map((o) => `${o.id} ${Math.round(o.x)},${Math.round(o.y)} r ${Math.round(o.r)}`).join('; ')})`,
    );
    const words = await worldWordsOf(page);
    step.check(namesShown(words).length === 0 && words.names.every((n) => n.tab === -1), `${at}: no name shows with no pointer on a project${touch ? ' (a touch screen, at the world)' : ''} (shown: ${namesShown(words).join(', ') || 'none'})`);
    if (!touch) {
      // The mouse on each project's object: its name alone, on its line, in Tab's reach, a link to its page.
      for (const project of PROJECT_LIST) {
        const object = state.journey.objects?.find((o) => o.id === project.id);
        if (object === undefined) continue;
        await page.mouse.move(object.x, object.y, { steps: 4 });
        await page.waitForTimeout(1400);
        const under = await worldWordsOf(page);
        const name = under.names.find((n) => n.id === project.id);
        step.check(
          name !== undefined && name.shown && name.opacity > 0.95 && name.tab === 0 && name.text === project.title.toUpperCase() && boxInside(name.box, size) && name.href === `${english ? '/en' : ''}${project.path}` && namesShown(under).length === 1,
          `${at}: the mouse on ${project.id}: its name alone shows on its line, "${project.title.toUpperCase()}", in Tab's reach, inside the screen under the header, a link to ${project.path} (got ${JSON.stringify(name && [name.text, name.shown, name.opacity, name.tab, name.href, Object.values(name.box).map(Math.round)])}; shown ${namesShown(under).join(', ')})`,
        );
      }
      await page.mouse.move(4, size.height - 4, { steps: 4 });
      await page.waitForTimeout(700);
    }
    const hint = touch ? t.hint.tap : t.hint.click;
    step.check(words.hint.opacity === 1 && words.hint.text === hint, `${at}: and the hint below says "${hint}" (got "${words.hint.text}", opacity ${words.hint.opacity})`);
    step.check(words.captions.every((c) => c.opacity === 0 && c.inert) && words.dots.opacity === 0 && words.dots.inert, `${at}: no area's words and no dots at the world (${words.captions.map((c) => c.opacity).join(', ')}; dots ${words.dots.opacity})`);
    if (!english) {
      const file = join(STILLS, `world-${sizeName(size)}.png`);
      await page.screenshot({ path: file });
      shots.push({ file, kind: 'home', mask: await textMask(page) });
    }
    // Each project's object opens it where the camera stands; the way out comes back to the world.
    const opening = english ? PROJECT_LIST.slice(0, 1) : PROJECT_LIST;
    for (const project of opening) {
      await opensProject(page, step, at, project.id, `${touch ? 'a tap' : 'a click'} on ${project.id}'s object`, () => pressObject(page, touch, project.id), path);
      await leavesProject(page, step, at, WORLD_STOP, touch ? `"${new Translator(locale).t.needle.page.back}"` : 'Escape', () => (touch ? page.locator('.pv-back').tap() : page.keyboard.press('Escape')));
      if (!touch) await page.mouse.move(4, size.height - 4, { steps: 2 });
    }
    await page.waitForTimeout(700);
    const again = await worldWordsOf(page);
    step.check(namesShown(again).length === 0, `${at}: back at the world no name shows with no pointer on a project (shown: ${namesShown(again).join(', ') || 'none'})`);
    await takeCsp(page, step);
    summary.push(`${at}: the land by ${touch ? 'swipes' : 'the arrow'} to the world, the stack open, ${opening.length} project${opening.length > 1 ? 's' : ''} opened and left`);
    await context.close();
  }
  step.luma = await gateLuma(browser, step, shots);
  return `${summary.join('; ')}; ${lumaSummary(step.luma, 'home')}`;
}

/**
 * The boards (spec 2026-10-28-bob-quantum-stack-design.md, goals 3 and 6), at 1440x900 and 390x844 (touch): from the
 * world a step (the arrow; on the phone the bridge) rests on each board's stop in turn, the camera on the way never
 * within 2.2 m of the stack's axis (never through the spine), at rest in front of the stack as at the whole machine, not
 * turned to a project (round 11), each of its projects framed inside the screen, its words at the bottom left (the
 * category, its projects' names, the open hint for a pointer or a touch screen) and only its in Tab's reach but unseen
 * and out of the pointer's way (round 11: a project's name only under the mouse), the dots shown with its own lit; the
 * names gone under a mouse away from them, and on a touch screen its own projects' names shown and no other; a still of
 * each through the home's luma gate; left alone at the last board the canvas sleeps within IDLE_SECONDS and a second;
 * then the first dot (a click, a tap) glides back to the first board round the stack, and its words show again.
 */
async function areasStep(browser, step) {
  const summary = [];
  const shots = [];
  mkdirSync(STILLS, { recursive: true });
  const areaStops = [...new Map(PROJECT_LIST.map((p) => [p.index, p])).values()];
  for (const size of TWO_SIZES) {
    const at = sizeName(size);
    const { context, page, cdp, touch } = await readyHome(browser, step, size);
    const centre = boardCentre(size.width / size.height);
    const t = new Translator('nl').t.needle.world;
    await poseAt(page, WORLD_STOP);
    await restAt(page);
    if (!touch) await page.mouse.move(4, size.height - 4);
    for (const area of areaStops) {
      await watchWorld(page);
      const rest = await stepStop(page, cdp, area.stop);
      await page.waitForTimeout(500);
      const seen = await worldSeen(page);
      const nearest = nearestToCentre(seen.map((s) => s.camera), centre);
      const state = await debugOf(page);
      step.check(near(rest.target, area.stop, 1e-9) && state.journey.stretch === 'area' && state.journey.project === area.index, `${at}: ${touch ? 'put' : 'a press of the arrow'} rests on area ${area.index + 1}'s stop, ${area.stop.toFixed(4)} (got ${rest.target.toFixed(4)}, ${state.journey.stretch} ${state.journey.project})`);
      step.check(nearest > 2.2, `${at}: on the way the camera stays ${nearest.toFixed(2)} m from the stack's axis, never through the spine (more than 2.2 m, ${seen.length} samples)`);
      const tops = state.journey.world?.tops ?? [];
      const [ex, ey, ez] = state.camera.position;
      step.check(
        tops.length > area.index + 1 && Math.abs(ex - centre[0]) < 0.01 && ez > centre[2] && ey > tops[area.index + 1],
        `${at}: the camera rests in front of the stack as at the whole machine, not turned to a project (x ${(ex - centre[0]).toFixed(3)} m off the axis, z ${(ez - centre[2]).toFixed(2)} m out), over the board in view (eye ${ey.toFixed(2)}, its top ${tops[area.index + 1]?.toFixed(2)})`,
      );
      const own = PROJECT_LIST.filter((p) => p.index === area.index);
      for (const project of own) {
        const object = state.journey.objects?.find((o) => o.id === project.id);
        step.check(object !== undefined && object.visible && object.x - object.r >= 0 && object.x + object.r <= size.width && object.y - object.r >= HEADER_PX && object.y + object.r <= size.height, `${at}: ${project.id}'s object framed inside the screen (${object === undefined ? 'none' : `${Math.round(object.x)},${Math.round(object.y)} r ${Math.round(object.r)}`})`);
      }
      const words = await worldWordsOf(page);
      const caption = words.captions.find((c) => c.area === area.index);
      const want = { category: categories.byId(area.category).heading('nl'), titles: PROJECT_LIST.filter((p) => p.index === area.index).map((p) => p.title), hint: touch ? t.open.tap : t.open.click };
      step.check(
        caption !== undefined && caption.opacity === 1 && !caption.inert && caption.seen === 0 && caption.pointer === 'none' && caption.category === want.category && JSON.stringify(caption.titles) === JSON.stringify(want.titles) && caption.hint === want.hint && boxInside(caption.box, size) && caption.box.left < size.width / 2,
        `${at}: its words at the bottom left say "${want.category}", ${want.titles.map((n) => `"${n}"`).join(', ')}, "${want.hint}", in Tab's reach but unseen and out of the pointer's way until Tab is in them (got ${JSON.stringify(caption && [caption.category, caption.titles, caption.hint, caption.opacity, caption.seen, caption.pointer, Object.values(caption.box).map(Math.round)])})`,
      );
      step.check(words.hint.opacity === 0, `${at}: the whole machine's hint is gone at a board, whose own words say how to open (opacity ${words.hint.opacity})`);
      step.check(words.captions.filter((c) => c.area !== area.index).every((c) => c.opacity === 0 && c.inert), `${at}: and no other area's words (${words.captions.map((c) => c.opacity).join(', ')})`);
      step.check(words.dots.opacity === 1 && !words.dots.inert && words.dots.current.every((on, k) => on === (k === area.index)), `${at}: the dots shown, area ${area.index + 1}'s lit (${JSON.stringify(words.dots.current)})`);
      const ownIds = PROJECT_LIST.filter((p) => p.index === area.index).map((p) => p.id);
      if (touch) step.check(JSON.stringify(namesShown(words).sort()) === JSON.stringify([...ownIds].sort()), `${at}: a touch screen shows this board's names, ${ownIds.join(', ')}, and no other (shown: ${namesShown(words).join(', ') || 'none'})`);
      else step.check(namesShown(words).length === 0 && words.names.every((n) => n.tab === -1), `${at}: with the mouse away no name shows, none in Tab's reach (shown: ${namesShown(words).join(', ') || 'none'})`);
      const file = join(STILLS, `area-${area.index + 1}-${at}.png`);
      await page.screenshot({ path: file });
      shots.push({ file, kind: 'home', mask: await textMask(page) });
    }
    // Left alone at an area the world stands still: its clock runs IDLE_SECONDS after the last stir, and then the canvas
    // draws the storm alone (spec 2026-10-30-bob-storm-design.md).
    const slept = await settlesToStorm(page, (IDLE_SECONDS + 4) * 1000);
    step.check(slept !== null && slept <= (IDLE_SECONDS + 1) * 1000, `${at}: left alone at the last area the canvas draws the storm alone within ${IDLE_SECONDS + 1} s, no more than ${STORM_FPS_MAX} frames a second (from ${slept === null ? 'never' : `${(slept / 1000).toFixed(1)} s`} on)`);
    // A dot back to the first area: a glide round the board.
    const first = areaStops[0];
    await watchWorld(page);
    const dot = page.locator('.area-dot').first();
    if (touch) await dot.tap();
    else await dot.click();
    const back = await restAt(page);
    await page.waitForTimeout(500);
    const seen = await worldSeen(page);
    const nearest = nearestToCentre(seen.map((s) => s.camera), centre);
    const words = await worldWordsOf(page);
    step.check(near(back.target, first.stop, 1e-9) && words.captions[0].opacity === 1, `${at}: ${touch ? 'a tap' : 'a click'} on the first dot goes back to area 1, ${first.stop.toFixed(4)} (got ${back.target.toFixed(4)}), its words shown again`);
    step.check(seen.length > 10 && nearest > 2.2, `${at}: by a glide (${seen.length} samples) round the stack, ${nearest.toFixed(2)} m from its axis at the nearest, never through the spine`);
    await takeCsp(page, step);
    summary.push(`${at}: ${areaStops.length} boards by ${touch ? 'the bridge' : 'the arrow'}, back by a dot round the stack (${nearest.toFixed(2)} m from its axis at the nearest)`);
    await context.close();
  }
  step.luma = await gateLuma(browser, step, shots);
  return `${summary.join('; ')}; ${lumaSummary(step.luma, 'home')}`;
}

/**
 * A project's own page over the stack (spec 2026-10-29-bob-stack-2-design.md, goal 2), at 1440x900, 390x844 (touch)
 * and 390x844 on /en/, from Steady's area: a click (a tap) on its object opens its page within FLIGHT_MS and a little
 * (`opensProject`: its words, "Lees meer", the way back, the focus), its object in the torn top within 0.05 NDC of the
 * page's spot, its three phones there (on the phone a row with its dots); a still through the inside's luma gate (0.15);
 * the wheel (a swipe) scrolls the page and never leaves it; "Lees meer" opens Steady's own page and Back returns to the
 * open page; → twice quickly (on the phone the next project's button twice) opens the third project, replacing the
 * history entry, and Portle on the way shows its one card; Escape (a laptop), the way back and Back each close it at
 * rest; with reduced motion in and out by the step fade.
 */
async function projectView(browser, step) {
  const summary = [];
  const shots = [];
  mkdirSync(STILLS, { recursive: true });
  const runs = [...TWO_SIZES.map((size) => ({ size, path: '/' })), { size: TWO_SIZES[1], path: '/en/' }];
  for (const { size, path } of runs) {
    const english = path === '/en/';
    const locale = english ? 'en' : 'nl';
    const at = `${sizeName(size)}${english ? ' /en/' : ''}`;
    const { context, page, cdp, touch } = await readyHome(browser, step, size, path);
    const words = new Translator(locale).t.needle.page;
    const [first, second, third] = PROJECT_LIST;
    await poseAt(page, first.stop);
    await restAt(page);
    await page.waitForTimeout(600);
    // Round 10 (Bob: the projects glow "so users know where to hover"): at its floor its projects breathe.
    const breath = await glowBreathes(page, first.id);
    step.check(breath >= GLOW_MOVES, `${at}: at its floor ${first.id} breathes: the light round its object changes ${breath.toFixed(4)} over a breath (at least ${GLOW_MOVES})`);
    const by = touch ? 'a tap on its object' : 'a click on its object';
    const openFirst = () => opensProject(page, step, at, first.id, by, () => pressObject(page, touch, first.id), path);
    const took = await openFirst();
    {
      await page.waitForTimeout(300);
      const s = await openOf(page);
      const middle = await objectNdc(page, size, first.id);
      const spot = spotNdc(size);
      const inTop = middle !== null && s.view !== null && ((1 - middle[1]) / 2) * size.height < s.view.top.bottom;
      step.check(middle !== null && Math.abs(middle[0] - spot[0]) <= 0.05 && Math.abs(middle[1] - spot[1]) <= 0.05 && inTop, `${at}: ${first.id}'s object stands in the torn top, within 0.05 of the page's spot ${spot.join(', ')} (got ${middle?.map((v) => v.toFixed(3)).join(', ')}; the top's foot at ${Math.round(s.view?.top.bottom ?? -1)} px)`);
      step.check(s.view?.phones === 3 && s.view.media === 1 && s.view.dots === touch, `${at}: its three phones are there (${s.view?.phones}), ${touch ? 'a row with its dots shown' : 'side by side, no dots'} (dots shown ${s.view?.dots})`);
    }
    if (!english) {
      const file = join(STILLS, `project-view-${first.id}-${sizeName(size)}.png`);
      await page.screenshot({ path: file });
      // The scene is in the torn top, where the object turns: its floor is read there.
      shots.push({ file, kind: 'inside', mask: await textMask(page), region: touch ? { x: [0.15, 0.85], y: [0.08, 0.42] } : { x: [0.3, 0.7], y: [0.06, 0.5] } });
    }

    // The wheel (a swipe) scrolls the page, and never leaves it.
    {
      const before = await openOf(page);
      if (touch) await slowTouch(page, cdp, [195, 700], [195, 350], 40);
      else {
        await page.mouse.move(size.width / 2, size.height * 0.6);
        for (let i = 0; i < 3; i++) {
          await page.mouse.wheel(0, RISE.notchPx);
          await page.waitForTimeout(RISE.notchGapMs);
        }
      }
      await page.waitForTimeout(800);
      const s = await openOf(page);
      step.check(s.open && s.view?.id === first.id && s.view.scrollTop > 0 && s.progress === before.progress && s.target === before.target, `${at}: the ${touch ? 'swipe' : 'wheel'} scrolls the page (scrollTop ${s.view?.scrollTop}) and never leaves it (open ${s.open}, the story at ${s.progress} still)`);
    }

    // "Lees meer": Steady's own page; Back returns to the open page.
    {
      const more = page.locator(`.project-view[data-project="${first.id}"] .pv-more`);
      if (touch) await more.tap();
      else await more.click();
      await page.waitForURL((url) => url.pathname.endsWith(`/projects/${first.id}/`), { timeout: FLIGHT_MS + 3_000 }).catch(() => {});
      const onPage = await waitForProject(page, first.id);
      const heading = await page.locator('main h1').first().textContent();
      step.check(onPage.kind === 'PROJECT_FOCUS' && heading?.trim() === first.title, `${at}: "${words.readMore}" opens ${first.id}'s own page (${new URL(page.url()).pathname}), its heading "${heading?.trim()}"`);
      await page.goBack();
      const backIn = await openWithin(page, first.id);
      step.check(backIn !== null, `${at}: Back from there returns to the open page (${backIn === null ? 'never' : `${backIn} ms`})`);
      await page.waitForTimeout(FLIGHT_MS);
    }

    // On twice quickly: the third project, its entry replacing the open one's; Portle on the way, with its one card.
    {
      const before = await openOf(page);
      let portle = null;
      if (touch) {
        await page.locator(`.project-view[data-project="${first.id}"] .pv-onward`).tap();
        await openWithin(page, second.id);
        portle = await openOf(page);
        await page.locator(`.project-view[data-project="${second.id}"] .pv-onward`).tap();
      } else {
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(150);
        await page.keyboard.press('ArrowRight');
      }
      const turned = await openWithin(page, third.id);
      await page.waitForTimeout(FLIGHT_MS);
      const s = await openOf(page);
      step.check(turned !== null && s.view?.id === third.id && s.state === third.id && s.entries === before.entries, `${at}: ${touch ? "the next project's button twice" : '→ twice quickly'} opens ${third.id}, its entry replacing the open one's (history ${before.entries} then ${s.entries})`);
      if (!touch) {
        await page.keyboard.press('ArrowLeft');
        await openWithin(page, second.id);
        await page.waitForTimeout(FLIGHT_MS);
        portle = await openOf(page);
      }
      step.check(
        portle?.view?.id === second.id && second.id === 'portle' && portle.view.media === 1 && portle.view.cards === 1,
        `${at}: ${second.id}'s page shows its one card (${portle?.view?.media} picture blocks, ${portle?.view?.cards} cards, on ${portle?.view?.id})`,
      );
      // On a phone the turns ended on the third project; on a laptop ← went back to the second.
      await leavesProject(page, step, at, touch ? third.stop : second.stop, `"${words.back}" after the turns`, () => (touch ? page.locator('.pv-back').tap() : page.locator('.pv-back').click()));
      await poseAt(page, first.stop);
      await restAt(page);
      await page.waitForTimeout(600);
    }

    // Every way out, each from the first project opened again.
    const ways = [
      [`"${words.back}"`, () => (touch ? page.locator('.pv-back').tap() : page.locator('.pv-back').click())],
      ...(touch ? [] : [['Escape', () => page.keyboard.press('Escape')]]),
      ["the browser's Back", () => page.goBack()],
    ];
    for (const [how, act] of ways) {
      await openFirst();
      await leavesProject(page, step, at, first.stop, how, act);
    }
    await takeCsp(page, step);
    summary.push(`${at}: opened by ${by} in ${took} ms, scrolled, "${words.readMore}" and back, turned twice, out by ${ways.map(([how]) => how).join(', ')}`);
    await context.close();
  }

  // Reduced motion: in and out by the step fade, no flight.
  {
    const size = TWO_SIZES[0];
    const { context, page } = await openSeen(browser, step, size);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await landHome(page);
    await page.waitForFunction(() => window.__needleDebug().journey.voidState === 'ready', null, { timeout: 30_000 });
    const first = PROJECT_LIST[0];
    await poseAt(page, first.stop);
    await restAt(page);
    await page.waitForTimeout(400);
    // Round 10: the floor's glow stands still with reduced motion.
    const breath = await glowBreathes(page, first.id);
    step.check(breath < GLOW_MOVES / 2, `reduced motion: the floor's glow stands still (the light round ${first.id}'s object changes ${breath.toFixed(4)})`);
    const watchFade = () =>
      page.evaluate(() => {
        window.__fadeSeen = false;
        new MutationObserver(() => {
          if (document.documentElement.hasAttribute('data-focus-fade')) window.__fadeSeen = true;
        }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-focus-fade'] });
      });
    await watchFade();
    await pressObject(page, false, first.id);
    const took = await openWithin(page, first.id);
    const fadeIn = await page.evaluate(() => window.__fadeSeen);
    step.check(took !== null && fadeIn, `reduced motion: a click opens ${first.id}'s page by the step fade (<html data-focus-fade> seen ${fadeIn}, ${took} ms)`);
    await page.waitForTimeout(400);
    await watchFade();
    await leavesProject(page, step, 'reduced motion', first.stop, 'Escape', () => page.keyboard.press('Escape'));
    const fadeOut = await page.evaluate(() => window.__fadeSeen);
    step.check(fadeOut, `reduced motion: and Escape closes it by the step fade (<html data-focus-fade> seen ${fadeOut})`);
    await takeCsp(page, step);
    summary.push('reduced motion: in and out by the step fade');
    await context.close();
  }
  step.luma = await gateLuma(browser, step, shots);
  return `${summary.join('; ')}; ${lumaSummary(step.luma, 'inside')}`;
}

/** How much the light round a project's object must change over half the glow's breath to count (mean luma, 0..1). */
const GLOW_MOVES = 0.004;

/** The mean luma change in a 120 px box round project `id`'s object over half the floor glow's period. */
async function glowBreathes(page, id) {
  const object = (await debugOf(page)).journey.objects?.find((o) => o.id === id);
  if (object === undefined) return 0;
  const clip = { x: Math.max(0, object.x - 60), y: Math.max(0, object.y - 60), width: 120, height: 120 };
  const lumaOf = async () => {
    const png = await page.screenshot({ clip });
    return page.evaluate(async (src) => {
      const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      return sum / (d.length / 4) / 255;
    }, `data:image/png;base64,${png.toString('base64')}`);
  };
  let low = Infinity;
  let high = -Infinity;
  // Over a whole breath, sampled: the change between its darkest and brightest.
  for (let k = 0; k < 8; k++) {
    const l = await lumaOf();
    low = Math.min(low, l);
    high = Math.max(high, l);
    await page.waitForTimeout(FLOOR_GLOW_PERIOD_MS / 8);
  }
  return high - low;
}

/** The floor glow's breath, ms (src/scene/bob/floorGlow.ts). */
const FLOOR_GLOW_PERIOD_MS = 2_800;

/** Each mark's stop on the Q&A's ring (src/state/chapters.ts `qaStop`): 0 is question 1, the last the end's. */
const QA_STOPS = Array.from({ length: RING_MARKS }, (_, k) => qaStop(HOME_CHAPTERS, k));
/** The end's mark: the last on the ring. */
const QA_END = RING_MARKS - 1;

/**
 * Where the Q&A's ring stands now: the bridge's `journey.qa` (null off the ring), `<html data-qa>` and `data-qa-at`
 * (null unset), the list's open question (round 10: its mark, count, question and text; how many are open), the words'
 * frame's box, the section's `inert`, the story's place and the journey's stretch.
 */
const ringOf = (page) =>
  page.evaluate(() => {
    const d = window.__needleDebug();
    const root = document.documentElement;
    const at = root.getAttribute('data-qa-at');
    const open = [...document.querySelectorAll('.qa-item')].filter((item) => item.querySelector('.qa-ask')?.getAttribute('aria-expanded') === 'true');
    const shown = open.length === 1 && !open[0].querySelector('.qa-reply').hidden ? open[0] : null;
    const text = (sel) => shown?.querySelector(sel)?.textContent ?? null;
    const frame = document.querySelector('.qa-frame')?.getBoundingClientRect() ?? null;
    return {
      qa: d.journey.qa ? { ...d.journey.qa } : null,
      on: root.hasAttribute('data-qa'),
      at: at === null ? null : Number(at),
      shown: shown === null ? null : { k: Number(shown.dataset.k), count: text('.qa-count'), question: text('.qa-ask'), text: text('.qa-text') },
      opened: open.length,
      frame: frame === null ? null : { left: frame.left, top: frame.top, right: frame.right, bottom: frame.bottom },
      focus: document.activeElement?.id ?? null,
      inert: document.getElementById('qa')?.inert ?? null,
      progress: d.progress,
      target: d.target,
      stretch: d.journey.stretch,
    };
  });

/** Waits until the ring rests at mark `k` (the story at its stop, `data-qa-at` k); answers the ms it took from now, or null. */
const ringRestsAt = (page, k, ms = 6_000) => {
  const began = Date.now();
  return page
    .waitForFunction(
      ([k, stop]) => {
        const d = window.__needleDebug();
        return Math.abs(d.progress - stop) < 1e-9 && Math.abs(d.target - stop) < 1e-9 && document.documentElement.getAttribute('data-qa-at') === String(k);
      },
      [k, QA_STOPS[k]],
      { timeout: ms },
    )
    .then(() => Date.now() - began, () => null);
};

/** The story's target once the scroll has taken the input before it: two frames on. */
const targetNow = (page) =>
  page.evaluate(async () => {
    for (let i = 0; i < 2; i++) await new Promise((resolve) => requestAnimationFrame(resolve));
    return window.__needleDebug().target;
  });

/** Whether the open question is question `k`'s in `t` (the dictionary's): its count, its question and its answer, or the placeholder. */
const answerIs = (shown, k, t) => {
  const { question, answer } = t.end.questions[k];
  const two = (n) => String(n).padStart(2, '0');
  const count = t.end.ring.count.replace('{n}', two(k + 1)).replace('{total}', two(t.end.questions.length));
  const given = typeof answer === 'string' && answer.trim() !== '';
  return shown?.k === k && shown.count === count && shown.question === question && (given ? shown.text === answer : shown.text?.startsWith(t.end.placeholder) === true);
};

/**
 * The Q&A as one list beside the tower (round 10, spec 2026-10-30-bob-qa-list-floors-design.md; Bob picked "A · One
 * list"), by real input at 1440x900, 1366x657, 390x844 (touch) and 1440 on /en/, from the look back's stop:
 * - one notch (one swipe) closes the stack and rests on the list, question 1 open, within 3.5 s;
 * - a click (a tap) on each other question turns the ring to its mark and opens it, the others closed, the list inside
 *   the screen (on a phone too, with the longest answer open);
 * - Enter on a question (the keyboard) opens it, the focus kept on it;
 * - from a question opened in the list one notch goes on to the end, and one up from it back to the list's stop;
 * - at 1440 a resize to 390x844 keeps the place; up from the list opens the stack back to the look back's stop;
 * - stills of the list, a question opened and the end through the home's luma gate, the words masked.
 */
async function qaRing(browser, step) {
  const summary = [];
  const shots = [];
  mkdirSync(STILLS, { recursive: true });
  const runs = [...DIVE_SIZES.map((size) => ({ size, path: '/' })), { size: DIVE_SIZES[0], path: '/en/' }];
  for (const { size, path } of runs) {
    const english = path === '/en/';
    const t = new Translator(english ? 'en' : 'nl').t;
    const at = `${sizeName(size)}${english ? ' /en/' : ''}`;
    const { context, page, cdp, touch } = await readyHome(browser, step, size, path);
    await poseAt(page, LOOK_STOP);
    await restAt(page);
    if (!touch) await page.mouse.move(size.width * 0.5, size.height * 0.92);
    const opened = [];

    // 1. One input: the stack closes and the ring rests on the list, question 1 open.
    await nudge(page, cdp, 1);
    const into = await ringRestsAt(page, 0, 8_000);
    let s = await ringOf(page);
    step.check(into !== null && into <= 3_500 && s.qa !== null && s.qa.close >= 0.999 && s.at === 0 && s.inert === false, `${at}: one ${touch ? 'swipe' : 'notch'} from the look back's stop closes the stack and rests on the list within 3.5 s (${into === null ? 'never' : `${into} ms`}; closed ${s.qa?.close}, data-qa-at ${s.at})`);
    step.check(answerIs(s.shown, 0, t) && s.opened === 1, `${at}: question 1 open in the list, the dictionary's (${JSON.stringify(s.shown)})`);
    opened.push(0);

    // 2. A click (a tap) on each other question turns the ring to its mark and opens it; the list stays on the screen.
    for (let k = 1; k < QA_END; k++) {
      await page.waitForTimeout(400);
      const ask = page.locator(`#qa-ask-${k}`);
      if (touch) await ask.tap();
      else await ask.click();
      const took = await ringRestsAt(page, k, 5_000);
      s = await ringOf(page);
      const inside = s.frame !== null && s.frame.top >= 0 && s.frame.bottom <= size.height + 1 && s.frame.left >= 0 && s.frame.right <= size.width + 1;
      step.check(took !== null && answerIs(s.shown, k, t) && s.opened === 1 && inside, `${at}: a ${touch ? 'tap' : 'click'} on question ${k + 1} turns the ring to it and opens it alone, the list on the screen (${took === null ? 'never' : `${took} ms`}; ${s.shown?.question}; ${s.opened} open; the list ${JSON.stringify(s.frame && Object.values(s.frame).map(Math.round))})`);
      opened.push(k);
    }

    // 3. The keyboard: Enter on a question opens it, the focus kept on it.
    if (!touch) {
      await page.focus('#qa-ask-2');
      await page.keyboard.press('Enter');
      const took = await ringRestsAt(page, 2, 5_000);
      s = await ringOf(page);
      step.check(took !== null && answerIs(s.shown, 2, t) && s.focus === 'qa-ask-2', `${at}: Enter on question 3 opens it, the focus kept on it (${took === null ? 'never' : `${took} ms`}; focus ${s.focus})`);
    }

    // 4. From a question opened in the list: one notch on goes to the end, and one up from a question back to the list.
    await page.waitForTimeout(QA_LOCK_MS);
    await poseAt(page, QA_STOPS[3]);
    await restAt(page);
    await page.waitForTimeout(GESTURE_GAP_MS + 100);
    await nudge(page, cdp, 1);
    const onward = await ringRestsAt(page, QA_END, 6_000);
    step.check(onward !== null, `${at}: one ${touch ? 'swipe' : 'notch'} from question 4 goes on to the end (${onward === null ? 'never' : `${onward} ms`})`);
    await page.waitForTimeout(QA_LOCK_MS);
    await poseAt(page, QA_STOPS[3]);
    await restAt(page);
    await page.waitForTimeout(GESTURE_GAP_MS + 100);
    await nudge(page, cdp, -1);
    const back = await ringRestsAt(page, 0, 6_000);
    step.check(back !== null, `${at}: one ${touch ? 'swipe' : 'notch'} up from question 4 comes back to the list's stop (${back === null ? 'never' : `${back} ms`})`);

    // 5. At 1440 a resize to 390x844 keeps the place.
    if (size.width === 1440 && !english) {
      const before = await ringOf(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(700);
      const after = await ringOf(page);
      step.check(near(after.progress, before.progress, 1e-9) && near(after.target, before.target, 1e-9) && after.at === before.at && answerIs(after.shown, before.at, t), `${at}: resized to 390x844 the ring keeps its place (mark ${before.at} then ${after.at}, progress ${before.progress} then ${after.progress})`);
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.waitForTimeout(500);
    }

    // 6. Up from the list (put there through the bridge) opens the stack back to the look back.
    await page.waitForTimeout(QA_LOCK_MS);
    await poseAt(page, QA_STOPS[0]);
    await restAt(page);
    await nudge(page, cdp, -1);
    const look = await page
      .waitForFunction((stop) => {
        const d = window.__needleDebug();
        return Math.abs(d.progress - stop) < 1e-9 && Math.abs(d.target - stop) < 1e-9 && !document.documentElement.hasAttribute('data-qa-at');
      }, LOOK_STOP, { timeout: 8_000 })
      .then(() => true, () => false);
    s = await ringOf(page);
    step.check(look && (s.qa === null || s.qa.close <= 1e-6), `${at}: up from the list opens the stack back to the look back's stop, ${LOOK_STOP.toFixed(3)} (${look ? 'there' : JSON.stringify(s)}; the stack's close ${s.qa?.close ?? 'none'})`);

    // 7. Stills: the list, a question opened (the longest answer's, on a phone), the end.
    if (!english && size !== DIVE_SIZES[1]) {
      for (const k of [0, 3, QA_END]) {
        await poseAt(page, QA_STOPS[k]);
        await page.waitForTimeout(k === QA_END ? 3_400 : 700);
        const file = join(STILLS, `qa-${k + 1}-${sizeName(size)}.png`);
        await page.screenshot({ path: file });
        shots.push({ file, kind: 'home', mask: await textMask(page), ...(touch ? { region: { x: [0.1, 0.9], y: [0.12, 0.5] } } : {}) });
      }
    }
    await takeCsp(page, step);
    summary.push(`${at}: into the list in ${into} ms, opened ${opened.map((k) => k + 1).join(', ')}, on to the end and back`);
    await context.close();
  }

  step.luma = await gateLuma(browser, step, shots);
  return `${summary.join('; ')}; ${lumaSummary(step.luma, 'home')}`;
}

/**
 * The end's mark on the ring (spec 2026-10-29-bob-stack-2-design.md, goal 1), at 1440x900 and 390x844 (touch): from
 * question 6 one input (a notch, a swipe) turns the ring to it, the whole ring lit (`journey.qa.lit` 0.99 or more), its
 * words "Einde van de site", "Stuur een bericht.", the line word for word and both buttons; "Naar contact" opens
 * /contact/ with its form; "Terug naar het begin" takes the story back to the home, at 0. The end is unmistakable (spec
 * 2026-10-29-bob-stack-3-design.md, goal 4; Bob picked "2 · Circle"): `<html data-qa-end>`, the dark over the scene
 * (its opacity times its colour's alpha 0.85 or more), the gold circle drawn whole (`--qa-draw` 360deg) within 3 s, the
 * words' middle within 2 % of the screen's (on a phone across, the circle above them), the marks' numbers gone; one
 * input up and nothing of it is left. At 1440 once: the nav's `.end-link`, reached by Tab, goes to the end's mark with
 * the focus on `#qa-end-title`. Where 3D cannot run (Edge without WebGL; the header's 3D switch went, 2026-10-29)
 * `#end` is in the home's flow with its form, and nothing of the ring is left (`data-qa`, `data-qa-at`,
 * `data-qa-end`, `#qa`).
 */
async function qaEnd(browser, step) {
  const summary = [];
  const t = new Translator('nl').t;
  const ring = t.end.ring;
  for (const size of TWO_SIZES) {
    const at = sizeName(size);
    const { context, page, cdp, touch } = await readyHome(browser, step, size);
    const toEnd = async () => {
      await poseAt(page, LOOK_STOP);
      await restAt(page);
      if (!touch) await page.mouse.move(size.width * 0.5, size.height * 0.92);
      await nudge(page, cdp, 1);
      await ringRestsAt(page, 0, 8_000);
      await poseAt(page, QA_STOPS[QA_END - 1]);
      await restAt(page);
      await nudge(page, cdp, 1);
      return ringRestsAt(page, QA_END, 5_000);
    };
    const took = await toEnd();
    const s = await ringOf(page);
    const words = await page.evaluate(() => {
      const end = document.querySelector('.qa-end:not([hidden])');
      const text = (sel) => end?.querySelector(sel)?.textContent?.trim() ?? null;
      return {
        kicker: text('.qa-count'),
        title: text('#qa-end-title'),
        line: text('.qa-text'),
        contact: end?.querySelector('.qa-buttons a.button')?.textContent?.trim() ?? null,
        again: end?.querySelector('.qa-buttons button.again')?.textContent?.trim() ?? null,
      };
    });
    step.check(took !== null && s.qa !== null && s.qa.lit >= 0.99, `${at}: from question 6 one ${touch ? 'swipe' : 'notch'} turns the ring to the end, the whole ring lit (${s.qa?.lit}, ${took === null ? 'never' : `${took} ms`})`);
    step.check(
      words.kicker === ring.endKicker && words.title === 'Stuur een bericht.' && words.line === ring.endLine && words.contact?.startsWith(ring.toContact) === true && words.again?.endsWith(ring.toStart) === true,
      `${at}: the end says "${ring.endKicker}", "Stuur een bericht.", the line word for word, and "${ring.toContact}" and "${ring.toStart}" (got ${JSON.stringify(words)})`,
    );

    // The end unmistakable: the dark, the circle drawn whole, the words in the middle, the marks' numbers gone.
    const sealed = await page
      .waitForFunction(() => getComputedStyle(document.querySelector('.qa-seal')).getPropertyValue('--qa-draw').trim() === '360deg', null, { timeout: 3_000 })
      .then(() => true, () => false);
    await page.waitForTimeout(1_500); // the dark's fade (1.4 s) and the marks' are over
    const theEnd = () =>
      page.evaluate(() => {
        const css = (sel) => (document.querySelector(sel) ? getComputedStyle(document.querySelector(sel)) : null);
        const box = (sel) => document.querySelector(sel)?.getBoundingClientRect() ?? null;
        const veil = css('.qa-veil');
        const alpha = Number(/,\s*([\d.]+)\)$/.exec(veil?.backgroundColor ?? '')?.[1] ?? 1);
        const frame = box('.qa-frame');
        const seal = box('.qa-seal');
        return {
          end: document.documentElement.hasAttribute('data-qa-end'),
          dark: veil === null ? 0 : Number(veil.opacity) * alpha,
          seal: css('.qa-seal') === null ? 0 : Number(css('.qa-seal').opacity),
          // The list (round 10): how much of it shows, and how many of its questions a visitor can still reach.
          marks: css('.qa-list') === null ? null : Number(css('.qa-list').opacity),
          reach: [...document.querySelectorAll('.qa-ask')].filter((b) => b.checkVisibility({ visibilityProperty: true, opacityProperty: true })).length,
          frame: frame && { x: frame.left + frame.width / 2, y: frame.top + frame.height / 2, top: frame.top },
          sealBottom: seal?.bottom ?? null,
          vw: innerWidth,
          vh: innerHeight,
        };
      });
    const e = await theEnd();
    const across = e.frame !== null && Math.abs(e.frame.x - e.vw / 2) <= 0.02 * e.vw;
    const middle = touch ? e.sealBottom !== null && e.frame !== null && e.sealBottom <= e.frame.top : e.frame !== null && Math.abs(e.frame.y - e.vh / 2) <= 0.02 * e.vh;
    step.check(
      e.end && e.dark >= 0.85 && sealed && e.seal === 1 && e.marks === 0 && e.reach === 0 && across && middle,
      `${at}: the end is unmistakable: data-qa-end, the dark at ${e.dark.toFixed(2)} (0.85 or more), the circle drawn whole within 3 s (${sealed}), the words' middle at (${e.frame?.x.toFixed(0)}, ${e.frame?.y.toFixed(0)}) ${touch ? `across the middle, under the circle (its foot at ${e.sealBottom?.toFixed(0)}, the words from ${e.frame?.top.toFixed(0)})` : 'in the middle'} of ${e.vw}x${e.vh}, the list at ${e.marks} and ${e.reach} of its questions in reach`,
    );
    // One input up: back on the list (round 10: its inner marks are no stops), and nothing of the end left.
    await nudge(page, cdp, -1);
    const up = await ringRestsAt(page, 0, 6_000);
    await page.waitForTimeout(1_600);
    const left = await theEnd();
    step.check(up !== null && !left.end && left.dark === 0 && left.seal === 0 && left.marks !== 0 && left.reach > 0, `${at}: one ${touch ? 'swipe' : 'notch'} up rests on the list (${up === null ? 'never' : `${up} ms`}) and leaves nothing of the end: data-qa-end ${left.end}, the dark ${left.dark}, the circle ${left.seal}, the list ${left.marks}`);
    await toEnd();

    // "Naar contact": /contact/ with its form.
    const contact = page.locator('.qa-end .qa-buttons a.button');
    if (touch) await contact.tap();
    else await contact.click();
    await page.waitForURL((url) => url.pathname === '/contact/', { timeout: 5_000 }).catch(() => {});
    const form = await page.locator('form #contact-name').count();
    step.check(new URL(page.url()).pathname === '/contact/' && form === 1, `${at}: "${ring.toContact}" opens /contact/ with its form (${new URL(page.url()).pathname}, the name field ${form})`);
    await landHome(page);
    await page.waitForFunction(() => window.__needleDebug().journey.voidState === 'ready', null, { timeout: 30_000 });

    // "Terug naar het begin": the home, at 0.
    await toEnd();
    const again = page.locator('.qa-end .qa-buttons button.again');
    if (touch) await again.tap();
    else await again.click();
    const home = await page
      .waitForFunction(() => {
        const d = window.__needleDebug();
        return d.progress === 0 && d.target === 0 && !document.documentElement.hasAttribute('data-qa');
      }, null, { timeout: 15_000 })
      .then(() => true, () => false);
    step.check(home, `${at}: "${ring.toStart}" takes the story back to the home, at 0 (${home ? 'there' : JSON.stringify(await frameOf(page))})`);
    await takeCsp(page, step);
    summary.push(`${at}: the end in ${took} ms, lit, its words and both buttons`);
    await context.close();
  }

  // At 1440 once: the nav's link.
  {
    const size = TWO_SIZES[0];
    const { context, page } = await readyHome(browser, step, size);
    await page.mouse.move(size.width - 8, size.height - 8);
    await page.focus('a[href="#main"]');
    let presses = 0;
    const onLink = () => page.evaluate(() => document.activeElement?.classList.contains('end-link') === true);
    while (presses < 20 && !(await onLink())) {
      await page.keyboard.press('Tab');
      presses++;
    }
    step.check(await onLink(), `1440x900: Tab from the skip link reaches the nav's .end-link (${presses} presses)`);
    await page.keyboard.press('Enter');
    const arrived = await ringRestsAt(page, QA_END, 20_000);
    await page.waitForTimeout(300);
    const focus = await page.evaluate(() => document.activeElement?.id ?? null);
    step.check(arrived !== null && focus === 'qa-end-title', `1440x900: the nav's link goes to the end's mark (${arrived === null ? 'never' : `${arrived} ms`}) with the focus on #qa-end-title (${focus})`);
    // With the keyboard in the header, the header stands over the end's dark (the Q&A is at z-index 3), its link not hidden.
    await page.focus('.site-header a[href="/contact/"]');
    const over = await page.evaluate(() => ({
      end: document.documentElement.hasAttribute('data-qa-end'),
      header: Number(getComputedStyle(document.querySelector('.site-header')).zIndex),
      qa: Number(getComputedStyle(document.querySelector('.qa')).zIndex),
    }));
    step.check(over.end && over.header > over.qa, `1440x900: at the end, with the keyboard in the header, it stands over the dark (z-index ${over.header} over the Q&A's ${over.qa}, data-qa-end ${over.end})`);

    await takeCsp(page, step);
    await context.close();
    summary.push(`the nav's link to the end with the focus on its title (${presses} Tabs)`);
  }

  // Where 3D cannot run (Edge without WebGL): #end in the home's flow with its form, nothing of the ring.
  {
    const own = await chromium.launch({ channel: 'msedge', headless: true, args: NO_WEBGL });
    try {
      const { context, page } = await openPage(own, step);
      await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
      await page.waitForSelector('.scene-fallback', { timeout: 10_000 });
      await page.waitForTimeout(800);
      const off = await page.evaluate(() => {
        const end = document.getElementById('end');
        const nav = document.querySelector('.home-nav');
        const html = document.documentElement;
        return {
          threeD: html.getAttribute('data-3d'),
          inFlow: end !== null && nav !== null && (nav.compareDocumentPosition(end) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0 && end.checkVisibility({ visibilityProperty: true }) && getComputedStyle(end).position !== 'fixed',
          form: end?.querySelector('form') != null,
          qa: html.hasAttribute('data-qa') || html.hasAttribute('data-qa-at') || html.hasAttribute('data-qa-end') || document.getElementById('qa') !== null,
        };
      });
      step.check(off.threeD === 'off' && off.inFlow && off.form && !off.qa, `1440x900 without WebGL: #end is in the home's flow after the nav with its form, and nothing of the ring is left (${JSON.stringify(off)})`);
      await takeCsp(page, step);
      await context.close();
      summary.push('without WebGL #end in the flow');
    } finally {
      await own.close();
    }
  }
  return summary.join('; ');
}

/**
 * A portrait resize mid-fall and on the world (spec: the words readable at every size), at 1440x900 turned to 390x844:
 * - at fact 02's peak the way frame stays, and the fact still rides by the light, now below it;
 * - at Steady's area the place stays, its words stay shown whole inside the screen and its object framed;
 * - half way between the first two areas the place stays, and the camera stays off the CPU, 3 m or more from the board's
 *   centre for the new shape.
 */
async function resize(browser, step) {
  const { context, page } = await readyHome(browser, step, DIVE_SIZES[0]);
  const phone = { width: 390, height: 844 };
  const before = await poseAt(page, placeOfFrame(121));
  await page.setViewportSize(phone);
  await page.waitForTimeout(600);
  const after = await debugOf(page);
  const label = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.light-fact')].find((f) => Number(getComputedStyle(f).opacity) > 0.01);
    if (!el) return null;
    const r = el.querySelector('.light-fact-words').getBoundingClientRect();
    return { side: el.dataset.side, left: r.left, right: r.right, top: r.top };
  });
  const light = after.journey.light === null ? null : ndcToPx(after.journey.light, phone);
  step.check(near(after.journey.frame, before.journey.frame, 1e-6), `the way frame stays through the resize: ${before.journey.frame?.toFixed(2)} then ${after.journey.frame?.toFixed(2)}`);
  step.check(
    label !== null && light !== null && label.side === 'below' && label.top > light.y && label.left < light.x + 40 && label.right > light.x - 40,
    `the fact stays on the light, below it now: ${JSON.stringify(label)}, the light at ${light === null ? 'none' : `(${light.x.toFixed(0)}, ${light.y.toFixed(0)})`}`,
  );

  // At Steady's area: its words in Tab's reach (unseen since round 11), then the turn.
  const steady = PROJECT_LIST[0];
  const wideSize = { width: DIVE_SIZES[0].width, height: DIVE_SIZES[0].height };
  await page.setViewportSize(wideSize);
  await page.waitForTimeout(400);
  await poseAt(page, steady.stop);
  await page.waitForTimeout(500);
  const wide = (await worldWordsOf(page)).captions[steady.index];
  await page.setViewportSize(phone);
  await page.waitForTimeout(700);
  const turned = await debugOf(page);
  const tall = (await worldWordsOf(page)).captions[steady.index];
  const object = turned.journey.objects?.find((o) => o.id === steady.id);
  step.check(turned.progress === steady.stop && turned.target === steady.stop && turned.journey.stretch === 'area', `at Steady's area the place stays through the resize: ${steady.stop.toFixed(4)}, then ${turned.progress} (${turned.journey.stretch})`);
  step.check(
    wide.opacity === 1 && boxInside(wide.box, wideSize) && tall.opacity === 1 && boxInside(tall.box, phone) && object !== undefined && object.visible && object.x - object.r >= 0 && object.x + object.r <= phone.width && object.y - object.r >= HEADER_PX && object.y + object.r <= phone.height,
    `and its words stay in Tab's reach inside the screen (${Object.values(wide.box).map(Math.round).join(', ')} at 1440, ${Object.values(tall.box).map(Math.round).join(', ')} at 390), its object framed inside it (${object === undefined ? 'none' : `${Math.round(object.x)}, ${Math.round(object.y)} r ${Math.round(object.r)}`})`,
  );

  // Between two areas: the place stays and the camera off the CPU through the turn.
  await page.setViewportSize(wideSize);
  await page.waitForTimeout(400);
  const between = (PROJECT_LIST[0].stop + PROJECT_LIST[1].stop) / 2;
  await poseAt(page, between);
  await page.setViewportSize(phone);
  await page.waitForTimeout(700);
  const mid = await debugOf(page);
  const off = nearestToCentre([mid.camera.position], boardCentre(phone.width / phone.height));
  step.check(mid.progress === between && mid.journey.stretch === 'area' && off >= 3, `half way between the first two areas the place stays through the turn (${mid.progress.toFixed(4)}, ${mid.journey.stretch}) and the camera stays ${off.toFixed(2)} m from the board's centre, off the CPU`);
  await context.close();
  return `fact 02 at frame ${after.journey.frame?.toFixed(1)}, below the light after the turn; Steady's words and object kept through the turn; between two areas the camera ${off.toFixed(2)} m off the centre`;
}

const STEPS = {
  routes,
  slash,
  bridge,
  persist,
  'lang-keeps-phase': langKeepsPhase,
  'not-found': notFound,
  'case-variant': caseVariant,
  'home-nav': homeNav,
  mobile,
  'phone-menu': phoneMenu,
  esc,
  'nav-focus': navFocus,
  lite,
  scroll,
  'scroll-bob': scrollBob,
  letters,
  'light-dive': lightDive,
  'light-facts': lightFacts,
  engraved,
  world: worldStep,
  areas: areasStep,
  'qa-ring': qaRing,
  resize,
  'project-view': projectView,
  nebula,
  'void-hold': voidHold,
  'void-fail': voidFail,
  'qa-end': qaEnd,
  storm,
  keyboard,
  'reduced-motion': reducedMotion,
  loaded,
  'no-scene': noScene,
  'no-webgl': noWebgl,
  fps,
  background,
  'title-ij': titleIj,
  stills,
  'loader-stills': loaderStills,
  'loader-skip': loaderSkip,
  'loader-lite': loaderLite,
  'loader-skip-touch': loaderSkipTouch,
  'quick-loader': quickLoader,
  'loader-reduced': loaderReduced,
  'give-up': giveUp,
  'home-look': homeLook,
  aim,
  sleep,
  'hero-failsafe': heroFailsafe,
  'load-throw': loadThrow,
  'csp-enforced': cspEnforced,
};

// ---------------------------------------------------------------- run

const wanted = (process.env.STEPS ?? Object.keys(STEPS).join(','))
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const unknown = wanted.filter((id) => !(id in STEPS));
if (wanted.length === 0 || unknown.length > 0) {
  console.error(`STEPS must name one or more of ${Object.keys(STEPS).join(', ')} (unknown: ${unknown.join(', ') || 'none given'})`);
  process.exit(1);
}

/** A thrown error as one line: its message, and the system error under it (`fetch failed (ECONNREFUSED)`). */
const reasonOf = (error) => {
  const cause = error?.cause?.code ?? error?.cause?.message;
  return `${String(error?.message ?? error).split('\n')[0]}${cause ? ` (${cause})` : ''}`;
};

/** Writes results.json, whatever ran: the steps, or the setup failure that stopped them. */
function writeResults(results) {
  writeFileSync(
    join(OUT, 'results.json'),
    JSON.stringify(
      {
        base: BASE,
        ranAt: new Date().toISOString(),
        pages: PAGES.map((p) => p.path),
        skipped: SKIPPED,
        steps: results.map(({ id, pass, checks, errors, expected, csp, seconds, fps, rollingFps, quality, luma }) => ({
          id,
          pass,
          seconds,
          ...(fps === undefined ? {} : { fps, rollingFps, quality }),
          ...(luma === undefined ? {} : { luma }),
          checks,
          errors,
          expected,
          csp,
        })),
      },
      null,
      2,
    ),
  );
}

mkdirSync(OUT, { recursive: true });
console.log(`note: ${PAGES.length} pages checked: ${PAGES.map((p) => p.path).join(' ')}`);
console.log(`note: ${SKIPPED.length} pages of pagePaths() not built yet, skipped: ${SKIPPED.join(' ') || 'none'}`);

/**
 * Everything the steps need before the first one: a build to test, a server that answers, and an Edge that starts. A
 * failure here is reported like any step, as `FAIL setup <reason>`, with a results.json that holds it, so a run that could
 * not begin leaves a record instead of a stack trace. Answers the browser.
 */
async function setup() {
  if (PAGES.length === 0) throw new Error(`dist/client has none of the site's pages (${DIST}): run npm run build`);
  let response;
  try {
    response = await fetch(`${BASE}/`, { redirect: 'manual' });
  } catch (error) {
    throw new Error(`${BASE} does not answer: ${reasonOf(error)}; start it with npm run preview`);
  }
  if (response.status !== 200) throw new Error(`${BASE}/ answered ${response.status}, not 200: is npm run preview serving this build?`);
  try {
    return await chromium.launch({ channel: 'msedge', headless: true, args: GPU });
  } catch (error) {
    throw new Error(`Edge did not start: ${reasonOf(error)}`);
  }
}

const results = [];
let browser = null;
try {
  browser = await setup();
} catch (error) {
  const step = new Step('setup');
  step.check(false, reasonOf(error));
  step.seconds = 0;
  results.push(step);
  console.log(`FAIL setup ${reasonOf(error)}`);
}

if (browser) {
  try {
    for (const id of wanted) {
      const step = new Step(id);
      const started = Date.now();
      let summary = '';
      try {
        summary = await STEPS[id](browser, step);
      } catch (error) {
        step.check(false, `the step threw: ${error?.message?.split('\n')[0] ?? error}`);
      }
      step.check(step.errors.length === 0, `no console or page errors (got ${step.errors.length}: ${step.errors.join(' | ')})`);
      step.check(step.csp.length === 0, `no CSP violations (got ${step.csp.length}: ${JSON.stringify(step.csp)})`);
      step.seconds = Math.round((Date.now() - started) / 100) / 10;
      results.push(step);
      const failed = step.checks.filter((c) => !c.ok).map((c) => c.message);
      console.log(`${step.pass ? 'PASS' : 'FAIL'} ${id} ${step.pass ? `${summary} (${step.checks.length} checks, ${step.seconds}s)` : failed.join('; ')}`);
    }
  } finally {
    await browser.close();
  }
}

writeResults(results);
process.exitCode = results.length > 0 && results.every((step) => step.pass) ? 0 : 1;
