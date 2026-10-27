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
 * the home's `journey` (`stretch`: `rise`, `light`, `travel`, `orbit`, `inside`, `look`, `sheet` or `end`; `local`; the
 * bead of a travel, an orbit or an inside, `project`; the void's load, `voidState`: `idle`, `loading`, `ready` or `failed`;
 * the way `frame` in the light dive, the `sheet`, the `light`'s place (NDC), the `beads` on the screen (px centre and
 * radius, shown or not), the bead `label` beside the light and its opacity, and each bead's veins' `wake`, radians);
 * `.set({ progress })` puts the story somewhere, `.dispatch(event)` sends a scene event, `.seekLoader(seconds)` holds
 * the opening's clock at a moment (-1 lets go), and `.scrollRequest` is the scroll loop's requestAnimationFrame, which
 * `watchFrames` wraps. Without `?proof` there is no bridge and nothing of the site reads or writes a hook (step bridge).
 *
 *   routes     every page of pagePaths() that the build produced, each answers 200 with one <h1>
 *              (in its HTML and after hydration) and the right <html lang>, and a page without a scene
 *              (its route's handle.scene is null: Lite, contact) has no <canvas>; a page the build did
 *              not produce is listed and skipped
 *   slash      GET /projects/funcial answers 301 to /projects/funcial/; a browser opening /projects/funcial loads
 *              /projects/funcial/ once, with no reload
 *   bridge     the debug bridge: absent without ?proof, and with no proof hook of the site read or written through
 *              a load, the opening's landing and a wheel gesture's frames (every hook name is trapped on the window);
 *              with ?proof the old hooks are gone, the state has exactly its fields and sensible values (landed: the
 *              circle cut whole and no B mark cut, a needle angle, the scroll at 0, the journey on the rise), `.set` puts the story in a chapter
 *              (half way through Funcial's travel, the path's first unit, and the journey says the travel, its beads and
 *              their wakes, and no ring; at fact 02's peak it reports way frame 121 and the light's place) and stops at the
 *              end (the credits' stop, where the scroll ends: chapter END, the phase END, the journey's `end` stretch), `.dispatch` sends an
 *              event (a project opens from the last bead's stop), a wheel's frames go through `.scrollRequest`, and the language
 *              switch shows in the state
 *   persist    client navigation / → /projects/funcial/ → /en/projects/funcial/ (the language switch replaces the
 *              history entry), then history.back() to / and history.forward(): the Stage mounted once and
 *              the same <canvas> node throughout, with no document load after the first; the scene's phase
 *              is PROJECT_FOCUS funcial on the project page, the language switch keeps that very phase (no new
 *              transition), going back to / puts it at Funcial's arrival stop, and going forward restores it
 *   lang-keeps-phase  on /projects/funcial/ the phase is PROJECT_FOCUS funcial; after a client-side switch to
 *              /en/projects/funcial/ (and back) it is still PROJECT_FOCUS funcial, the very same state, with locale and
 *              route right, canvasMounts 1 and the same <canvas>; the same on /projects/cookies-clicker/
 *   not-found  an unknown URL (/does-not-exist/, /en/does-not-exist/) answers 404 with the build's
 *              404.html; after hydration it shows the not-found route's <h1> and the right <html lang>,
 *              and the browser loads one document, with no reload loop; the page has no scene, so it
 *              asks for none of the scene's files, mounts no Stage and still leaves LOADING
 *   home-nav   the home page's links to the three projects: visually hidden but
 *              reachable by keyboard while 3D is on (and shown while one has focus), visible once the
 *              3D switch is turned off, and the choice persists in localStorage across a reload, where
 *              the page with 3D off mounts no WebGL at all and still leaves LOADING; the 3D switch is named
 *              "3D" on and off (role=switch and aria-checked carry the state, WCAG 2.5.3)
 *   mobile     every page at 390 px wide has no horizontal scroll
 *   phone-menu  on a touch phone the header is one row (the name, Menu); Menu opens the nav as a sheet under the header,
 *              its links 44 px high or more; the 3D switch keeps it open, a link closes it, Escape closes it before
 *              going back; it opens with script off; a laptop has no Menu button and its nav is one row
 *   case-variant  a real page under another spelling (/Projects/Funcial/, /en/projects/FUNCIAL/) is a 404 on
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
 *              of the page's bead after Escape or Back (Funcial's arrival, PROJECTS secure-element), but the
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
 *              field keeps its keys, a pinch (ctrl+wheel) is the browser's, and with 3D off nothing is
 *              prevented and the page scrolls natively; `chapter.index` stays in step, and Back from a
 *              project page lands at that bead's stop, in PROJECTS, not on HOME_IDLE. With reduced motion a
 *              whole wheel gesture is one stop (1, 2, 3, ...) and so is a key press. On a touch screen
 *              (CDP touch events) a drag moves it, a slow flick glides on after the finger lifts on the rise,
 *              flicks past the rise rest on stops, a tap and a sideways swipe do not move it, and the 3D switch
 *              still takes a tap
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
 *              within 6 px at way frames 20, 60, 121 and 241, the dive running frames 1 to 256; from BOB from above,
 *              notches (swipes) run the way frames up to the path and never back, and from the fall notches up run them
 *              back; stopped mid-fall the story rests where the input stopped, not on a stop, and the canvas sleeps
 *              within a second
 *   light-facts  at 1440x900, 1366x657 and 390x844 (touch), in Dutch and English: at each fact's peak one label, its
 *              number and the dictionary's words in capitals ("/" a line break), never two at once through the fall;
 *              its words 13 px or more on a laptop, 11 on the phone; on a laptop level with the light on the side away
 *              from its move; on the phone below it, the line stepped aside away from the move, the picture under the line
 *              dark (mean luma 0.05 or less)
 *   path       the light's path by real input at 1440x900 and 390x844 (touch), and at 1440 on /en/: from the fall's end
 *              notches (slow swipes) run on into Funcial's travel with no stop at the hand-over; at most one bead shown
 *              with a fade of 0.5 or more all the way; along Funcial's orbit the veins' wake grows with each notch and
 *              runs back with each one up; a step (the arrow; a flick) to each arrival rests there, its label whole within
 *              1 s, right of the light on a laptop and under the bead on a phone, in the page's language; the next to its
 *              inside, the label gone and its touch points shown inside the screen (five, four, five); stopped anywhere
 *              it rests there and the canvas sleeps within a second
 *   look-back  at 1440x900, 390x844 (touch) and 1440 on /en/: a step from the last inside rests on the look back's own
 *              stop, all three beads shown inside the screen and the way's line whole; on a laptop the pointer over each
 *              bead shows its label, Tab goes Funcial, Jontai Energy, Cookies Clicker, the skip button, each label shown
 *              on focus, Enter opens Jontai Energy's page and Back returns to the look back; on a phone a tap opens one
 *   credits    at 1440x900, 1366x657, 390x844 (touch) and 1440 on /en/: from the look back's stop one input fades to
 *              black, then raises the credits, at rest within 3 s with "Q&A" at 55 % of the screen (2 px) on the pixel
 *              the rise brings it to; the wheel (a swipe) then scrolls the document natively; at its end the message part
 *              in the middle under the header (5 %) where it fits, else its foot on the screen's, the edge fades lifted
 *              off it; the mock-up's type at 1440 (19, 13, 15 px, the column 580), answers 16 px or more on a phone; the
 *              edge fades there, and none with reduced motion; at the document's top an input up goes back to the look
 *              back; on /en/ the English dictionary's words
 *   resize     at 1440x900 turned to 390x844: at fact 02's peak the way frame stays and the fact rides below the light;
 *              late in Funcial's orbit the place stays and its label goes from right of the light to under the bead
 *   bead-open  opening a bead, at 1440x900 and 390x844 (touch): at each project's arrival the label shows whole inside
 *              the screen with the Dutch dictionary's text (the category line, the title, the hint for the pointer), Tab
 *              reaches it with a focus ring and Enter flies into the porthole (the page still `/` 120 ms on, then the
 *              router goes to `/projects/<slug>/` after the flight (FLIGHT_MS)) and Esc returns to that arrival; a click
 *              or a tap on a label (Back returns to Jontai Energy's arrival, its label shown) and on a bead open too;
 *              Jontai Energy's bead opened in its inside and in the look back, Back returning to the very place each
 *              time; all by client navigation; a direct load of `/projects/cookies-clicker/` then Esc lands at its arrival
 *   void-hold  `bob-beads.glb` held back: a long wheel (flicks on the phone) plays the light dive and rests at
 *              LANDING_HOLD, the hand-over (way frame 256), with `voidState` `loading`, the light still, a still of it gated as a home
 *              still; up from the hold moves at once (three notches exactly their distance) and rests where it stopped;
 *              let through, the void is `ready` and the story goes on into the ring; a direct arrival's Esc while the file
 *              is held waits at the hold, then reaches its stop
 *   void-fail  `bob-beads.glb` answering 404: `voidState` `failed`; the light dive plays and the scroll holds at
 *              LANDING_HOLD, where (`<html data-held>`) `.home-nav` shows (fixed over the foot of the screen, its links
 *              on screen and reachable, its link to the questions with them) and no skip button does; a still of it gated as
 *              a home still; a link opens its page and Esc comes back to the hold, not to the bead's stop; back at the home
 *              the nav is hidden again; exactly one console error (the browser's report of the 404, per size) and the
 *              Void's own line a warning
 *   (Every still of the two void steps is gated with the page's text masked, so the luma floor is the scene's, and the
 *   failure has a negative control: a still with the canvas hidden, whose masked floor must fail.)
 *   end-page   the credits, the last stop, by real input at 1440x900, 1366x657 and 390x844 (touch), from the look
 *              back's own stop: one wheel notch and ArrowDown on a laptop, one swipe on the phone; <html data-end="rest">
 *              within 3 s of the input (of the swipe's lift) and the page's words moving at most 0.5 px between the last
 *              frame of the move and the first at rest (Ruling 18); at rest #end-title ("Q&A") in the viewport, .end-page
 *              not inert, no frame asked for in 600 ms, a still `m2/end-<size>.png` gated as a home still; the page's own
 *              scroll (three notches or swipes down scroll it with the story at the end, End to its bottom, back up to
 *              scrollY 0 with the story still at the end, one more notch or swipe after a pause back to the look back); a
 *              burst of notches up (a long drag) begun at scrollY 300 stays the page's; the six questions and the Dutch
 *              dictionary's answers, all there, nothing to open; an empty send shows the form's errors
 *              (#contact-name-error) as on /contact/; Tab from the header reaches the form's fields; at 1440 a resize to
 *              1000x700 and back keeps the page; a reload at the end lands on the home (story 0, scrollY 0, no data-end);
 *              the header's name at the end goes to the home (the same). At 1440 once: /en/ in English; the pointer
 *              moved at the home (the needle turned) then End: at rest no frame asked for in 600 ms (Ruling 19); 3D off,
 *              #end in the flow after .home-nav, reached by native scroll; the nav's .end-link with the void ready by
 *              End's fade, "Q&A" in view at scrollY 0; the void failed, its .end-link button to the end by a fade
 *              (data-step-fade seen, no progress between, the focus on "Q&A") and ArrowUp at the top back to the landing
 *              hold by a fade; reduced motion, the look back to the end and back by fades
 *   keyboard   Tab from the top of the home page reaches the skip link, then the language switch and the 3D toggle in
 *              that order, each with a focus ring (outline 2 px or more) and on screen, and Shift+Tab goes back; the
 *              language switch shows "EN" and its name begins with it (WCAG 2.5.3, label in name); End
 *              jumps to the last chapter (the end of the story, the credits' stop, END) and Home returns to the
 *              start, both by the step fade with the focus on the toggle; from BOB from above the arrows step every key
 *              stop (the facts, each arrival and inside, the look back, the credits); at Jontai Energy's arrival Tab from
 *              the toggle reaches its label, then the skip button, and Enter on it fades to the credits with the focus on
 *              "Q&A"
 *   reduced-motion  with prefers-reduced-motion: reduce (page.emulateMedia, before the load) one wheel event moves
 *              `target` to exactly the next key stop, through all fifteen (the home, BOB from above, the five facts at
 *              their peaks, each project's arrival and inside, the look back's own stop, the credits) and back, and the
 *              story arrives at each, in the right chapter, by the step fade, with no pose between the two stops; one
 *              more at the end is no step (no fade at all): it is the credits' own scroll, and one up takes the page back
 *              to its top before the walk back up
 *   loaded     a direct load of / goes from LOADING to HOME_IDLE once the opening has landed, within the load
 *              timeout and with no navigation on the way; the canvas is shown then, and the wheel moves
 *              `frame.progress` straight away. The canvas renders on demand: after the home's idle motion it
 *              asks for no frame at all, and the pointer wakes it; over a project page a mouse wiggle wakes only the
 *              parallax. With 3D stored off, a direct load mounts no WebGL and leaves LOADING all the same
 *   no-scene   Lite is the light version: a direct load of a page without a scene (/lite/, /contact/, /en/lite/,
 *              /en/contact/) asks for none of the scene's files (the Stage chunk, three.js, maath, the textures),
 *              mounts no <canvas>, probes no WebGL, shows no fallback card and leaves LOADING with 3D still on; from
 *              the home page to Lite by client navigation the one canvas stays (canvasMounts 1, the same node) and
 *              sleeps: no requestAnimationFrame at all through 1.5 s of mouse moves, nor through scrolling (wheel and
 *              scrollTo) or the window's resize and the fonts' loadingdone events sent with no change of size; a real
 *              resize redraws it once at its new size and it sleeps again; back home the pointer wakes it
 *   no-webgl   Edge with WebGL switched off (--disable-webgl --disable-3d-apis): / and /en/ show the poster (the
 *              CSS panel of the night, no image, over the whole viewport) and
 *              the fallback card (THE NEEDLE LOST NORTH, in the page's language) with its link to Lite, no
 *              <canvas>, 3D off for the visit without touching the stored choice, the home page's links shown
 *              and the page scrolling natively, the phase out of LOADING; and with only a software rasteriser
 *              (SwiftShader) the same card. On the GPU the scene's own failures fall back to the same card: a
 *              context lost for good (after the restore timeout) and a scene never ready (its chunk never
 *              answers, after the load timeout); switching 3D back on tries again, and a context that comes
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
 *              opening has landed, and the fallback at both, into PROOF_DIR/m2/ (`nl-projects-funcial-1440x900.png`,
 *              `en-home-390x844.png`, `fallback-390x844.png`); on a project page the poster's scrim is
 *              over the scene once it shows, and before then only the poster's own (the Stage chunk is held while
 *              that is measured, so it cannot race); on Lite and contact no scene loads and the poster carries the
 *              page scrim; and the light dive (way frames 60, 121, 241), each project's arrival and inside, the look
 *              back and the credits at both sizes, gated by LUMA_GATE as home stills, with the page's text masked but
 *              on the credits, whose text is the only picture there
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
 *   loader-lite  the skip listens only while a scene is shown: a first visit to /projects/funcial/ with the compass's file held back (the load still out),
 *              its Lite link clicked 1.5 s into the loader: on Lite five wheel turns, Space and PageDown each scroll the
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
 *              drift on to its next rest and then draws nothing: no requestAnimationFrame for a whole second within
 *              DRIFT_RUN + SLEEP_WITHIN_MS of the landing, and not before DRIFT_RUN - 2 s (DRIFT_RUN is the drift's
 *              first rest after the idle while, nextDriftRest(IDLE_SECONDS))
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
const { HOME_CHAPTERS, arrivalStop, chapterAt, insideStop, keyStops, lookStart, pathStart, placeOfFrame, scrollEnd, sheetStart, stops } = await tsImport('../../src/state/chapters.ts', import.meta.url);
const { SETTLE_SLOP_PX } = await tsImport('../../src/input/target.ts', import.meta.url);
const { SHEET_FINISH_MS } = await tsImport('../../src/input/scrollLoop.ts', import.meta.url);
const { GESTURE_GAP_MS } = await tsImport('../../src/input/gesture.ts', import.meta.url);
const { LOADER, LOADER_SEEN_KEY, QUICK, SCRIPT } = await tsImport('../../src/engine/bob/loaderTimeline.ts', import.meta.url);
const { IDLE_SECONDS, BREATHE } = await tsImport('../../src/scene/bob/look.ts', import.meta.url);
const { nextDriftRest } = await tsImport('../../src/engine/bob/needleAim.ts', import.meta.url);
const { scrollPoseAt } = await tsImport('../../src/scene/bob/scrollPose.ts', import.meta.url);
const { FLIGHT_MS } = await tsImport('../../src/scene/bob/focus.ts', import.meta.url);
const { topShotFor } = await tsImport('../../src/engine/bob/shots.ts', import.meta.url);
const { BEADS, journeyAt, journeyPoseAt } = await tsImport('../../src/scene/bob/journey.ts', import.meta.url);
const { RISE_TOP, LANDING_HOLD, landingHoldFor } = await tsImport('../../src/scene/bob/landingHold.ts', import.meta.url);
const { categories } = await tsImport('../../src/data/categories.ts', import.meta.url);
const { engravedLevels } = await tsImport('../../src/scene/bob/engravedWay.ts', import.meta.url);
/**
 * How long the canvas may keep drawing after the last thing that stirred it, ms: the home's idle motion
 * (src/scene/bob/look.ts, IDLE_SECONDS: 12 s) and the needle's spring settling, with room to spare. Counted from the
 * stir, or from the landing for a home left alone (step sleep counts it from DRIFT_RUN instead).
 */
const SLEEP_WITHIN_MS = 20_000;
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
const FUNCIAL_H1 = 'Funcial';
/** The h1 of the not-found route (src/app/routes/not-found.tsx, in each language), as opposed to the root's HydrateFallback. */
const NOT_FOUND_H1 = { nl: 'Pagina niet gevonden', en: 'Page not found' };
/** Two URLs no page answers, one per language. */
const UNKNOWN = ['/does-not-exist/', '/en/does-not-exist/'];
/**
 * Real pages under another spelling. GitHub Pages is case-sensitive, so each is a 404 served the
 * fallback, but the router used to match them case-insensitively and a route module threw on them.
 */
const CASE_VARIANTS = ['/Projects/Funcial/', '/en/projects/FUNCIAL/', '/Projects/Jontai-Energy/', '/en/Projects/cookies-clicker/'];
/** The links the home page lists: the three projects (the way to About is the header's). */
const HOME_LINKS = ['/projects/funcial/', '/projects/jontai-energy/', '/projects/cookies-clicker/'];

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
  const bare = await fetch(`${BASE}/projects/funcial`, { redirect: 'manual' });
  const location = bare.headers.get('location');
  const target = location ? new URL(location, BASE).href : null;
  step.check(bare.status === 301 && target === `${BASE}/projects/funcial/`, `GET /projects/funcial answers 301 to /projects/funcial/ (got ${bare.status} ${location})`);

  const { context, page } = await openPage(browser, step);
  const documents = [];
  let loads = 0;
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url());
  });
  page.on('load', () => loads++);

  // `?proof` rides along: the server keeps the query through its 301, and the page can then answer for its Stage's mounts.
  await page.goto(`${BASE}/projects/funcial?proof`, { waitUntil: 'load' });
  await stageReady(page);
  await page.waitForTimeout(1_500); // a reload loop would show by now
  const landed = documents.filter((url) => url === `${BASE}/projects/funcial/?proof`).length;
  const { type, mounts } = await page.evaluate(() => ({
    type: performance.getEntriesByType('navigation')[0]?.type,
    mounts: window.__needleDebug?.().canvasMounts,
  }));
  step.check(page.url() === `${BASE}/projects/funcial/?proof`, `the browser ends at /projects/funcial/ (got ${page.url()})`);
  step.check(landed === 1 && documents.length === 2, `one document load of /projects/funcial/, after the 301 (got ${documents.join(' → ')})`);
  step.check(loads === 1 && type === 'navigate', `one load event, not a reload (got ${loads}, ${type})`);
  step.check(mounts === 1, `the Stage mounted once (got ${mounts})`);
  await takeCsp(page, step);
  await context.close();
  return `/projects/funcial → 301 /projects/funcial/, loaded once (${documents.join(' → ')})`;
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
        // The arrival: the inside's start. The hold at the path's start reads PROJECTS too, at its travel's start.
        return s?.phase.kind === 'PROJECTS' && s.phase.category === category && s.progress === s.target && s.chapter.id === 'INSIDE' && s.chapter.local === 0;
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
  await page.focus('.home-nav a[href="/projects/funcial/"]');
  await page.keyboard.press('Enter');
  await page.waitForURL(`${BASE}/projects/funcial/`);
  await expectSame('link to /projects/funcial/', 'nl', FUNCIAL_H1);
  const phase = await waitForProject(page, 'funcial');
  step.check(phase.id === 'funcial', `on /projects/funcial/ the scene's phase is PROJECT_FOCUS funcial (got ${JSON.stringify(phase)})`);
  await page.evaluate(() => {
    window.__keptPhase = window.__needleDebug().phase;
  });
  // The scene keeps its phase, the very same state, while the language or the history changes under it.
  const keptPhase = async (where) => {
    await page.waitForTimeout(250); // a sync that wrongly moved the phase would have by now
    step.check(await page.evaluate(() => window.__needleDebug().phase === window.__keptPhase), `${where}: the scene keeps its phase, with no new transition`);
  };
  await page.click('.header-nav a[href="/en/projects/funcial/"]'); // the header's language switch
  await page.waitForURL(`${BASE}/en/projects/funcial/`);
  await expectSame('link to /en/projects/funcial/', 'en', FUNCIAL_H1);
  await keptPhase('switching to English');
  // The switch replaces the history entry (it is not a step in the story), so Back from the English
  // page is the home page, not the Dutch page; Forward is the English page again.
  await page.evaluate(() => history.back());
  await page.waitForURL((url) => url.pathname === '/'); // the first URL was /?proof
  await expectSame('history.back() past the replaced entry to /', 'nl', HOME_H1);
  // Back from a project page lands at its bead's stop (spec §2.4), here Funcial's, 3, once the void is in.
  const afterBack = await waitForStop(page, 'secure-element');
  step.check(
    afterBack.kind === 'PROJECTS' && afterBack.category === 'secure-element' && afterBack.progress === BEAD_LIST[0].stop,
    `going back to / puts the scene at Funcial's stop, PROJECTS secure-element at ${BEAD_LIST[0].stop} (got ${JSON.stringify(afterBack)})`,
  );
  await page.evaluate(() => history.forward());
  await page.waitForURL(`${BASE}/en/projects/funcial/`);
  await expectSame('history.forward() to /en/projects/funcial/', 'en', FUNCIAL_H1);
  const afterForward = await waitForProject(page, 'funcial');
  step.check(afterForward.id === 'funcial', `going forward puts the scene back on PROJECT_FOCUS funcial (got ${JSON.stringify(afterForward)})`);

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
  await page.goto(`${BASE}/projects/funcial/?proof`, { waitUntil: 'load' });
  await stageReady(page);
  documents.length = 0;
  const onProject = await waitForProject(page, 'funcial');
  step.check(onProject.id === 'funcial', `a direct load of /projects/funcial/ puts the scene on PROJECT_FOCUS funcial (got ${JSON.stringify(onProject)})`);
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
  step.check(pathname() === '/projects/funcial/', `Escape in a text field stays on the page (got ${pathname()})`);
  await page.evaluate(() => document.getElementById('esc-probe')?.remove());

  // ... nor when something else has already handled the key.
  await page.evaluate(() => {
    window.__eatEscape = (event) => event.preventDefault();
    window.addEventListener('keydown', window.__eatEscape, true);
  });
  await pressEscape();
  step.check(pathname() === '/projects/funcial/', `Escape that was already handled stays on the page (got ${pathname()})`);
  await page.evaluate(() => window.removeEventListener('keydown', window.__eatEscape, true));

  // A direct load has no page before it in the visit, so Escape goes to the home page.
  await page.keyboard.press('Escape');
  await page.waitForURL(`${BASE}/`, { timeout: 5_000 });
  step.check((await page.textContent('h1')) === HOME_H1, 'a direct load of /projects/funcial/ + Escape lands on the home page');
  step.check(documents.length === 0, `by client navigation, no document load (got ${documents.join(', ') || 'none'})`);
  const afterDirect = await waitForStop(page, 'secure-element');
  step.check(
    afterDirect.kind === 'PROJECTS' && afterDirect.category === 'secure-element' && afterDirect.progress === BEAD_LIST[0].stop,
    `leaving the page for the home page puts the scene at the bead's stop, Funcial's ${BEAD_LIST[0].stop} (got ${JSON.stringify(afterDirect)})`,
  );
  await takeCsp(page, step);

  // The header's name is a link to the home, not Back, a deliberate "to the top": it lands at the home, the top of the story, even
  // with the story at the bead's stop, as after a flight in from it.
  await page.goto(`${BASE}/projects/funcial/?proof`, { waitUntil: 'load' });
  await stageReady(page);
  await waitForProject(page, 'funcial');
  await page.evaluate((progress) => window.__needleDebug.set({ progress }), BEAD_LIST[0].stop);
  documents.length = 0;
  await page.click('.site-name');
  await page.waitForURL(`${BASE}/`, { timeout: 5_000 });
  await waitForPhase(page, 'HOME_IDLE').catch(() => {});
  const named = await debugOf(page);
  step.check(
    named.phase.kind === 'HOME_IDLE' && named.progress === 0 && named.target === 0,
    `the header's name on a project page lands at the home, 0, not at the bead's stop (got ${JSON.stringify([named.phase, named.progress, named.target])})`,
  );
  step.check(documents.length === 0, `by client navigation, no document load (got ${documents.join(', ') || 'none'})`);
  await takeCsp(page, step);

  // A page reached from the home page has one before it: Escape steps back, it does not push the home page.
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await stageReady(page);
  documents.length = 0;
  await page.focus('.home-nav a[href="/projects/funcial/"]'); // the home page's links are hidden while 3D is on, but take focus
  await page.keyboard.press('Enter');
  await page.waitForURL(`${BASE}/projects/funcial/`, { timeout: 5_000 });
  await waitForProject(page, 'funcial');
  await pressEscape();
  step.check(pathname() === '/', `a project page reached from the home page + Escape steps back to the home page (got ${pathname()})`);
  step.check(documents.length === 0, `by client navigation, no document load (got ${documents.join(', ') || 'none'})`);
  const steppedBack = await waitForStop(page, 'secure-element');
  step.check(
    steppedBack.kind === 'PROJECTS' && steppedBack.category === 'secure-element' && steppedBack.progress === BEAD_LIST[0].stop,
    `Escape back to the home page from a page reached from it puts the scene at the bead's stop, Funcial's ${BEAD_LIST[0].stop} (got ${JSON.stringify(steppedBack)})`,
  );
  await page.evaluate(() => history.forward());
  const forwarded = await page.waitForURL(`${BASE}/projects/funcial/`, { timeout: 5_000 }).then(() => true, () => false);
  step.check(forwarded, 'the page forward is still in the history, so Escape went back and did not add the home page');
  if (forwarded) {
    const forward = await waitForProject(page, 'funcial');
    step.check(forward.id === 'funcial', `going forward again puts the scene back on PROJECT_FOCUS funcial (got ${JSON.stringify(forward)})`);
  }
  await takeCsp(page, step);

  // A replace navigation keeps a page the visit began on "the first page of the visit". The language switch
  // is one (it is not a step in the story), so Escape after it goes home in the current language and does
  // not undo the switch.
  await page.goto(`${BASE}/projects/funcial/?proof`, { waitUntil: 'load' });
  await stageReady(page);
  documents.length = 0;
  await waitForProject(page, 'funcial');
  await page.click('a[href="/en/projects/funcial/"]');
  await page.waitForFunction(() => location.pathname === '/en/projects/funcial/' && document.documentElement.lang === 'en', null, { timeout: 5_000 });
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
  await page.goto(`${BASE}/projects/funcial/?proof`, { waitUntil: 'load' });
  await stageReady(page);
  await watchClicks();
  for (const modifier of ['Control', 'Meta', 'Shift']) await page.click('a.back', { modifiers: [modifier] });
  step.check(
    JSON.stringify(await page.evaluate(() => window.__clicks)) === JSON.stringify([false, false, false]),
    'a ctrl-, meta- or shift-click on the back link is not prevented: the page does not intercept it',
  );
  step.check(pathname() === '/projects/funcial/', `and the click does not navigate in the page (got ${pathname()})`);
  documents.length = 0;
  await page.evaluate(() => (window.__clicks.length = 0));
  await page.click('a.back');
  await page.waitForURL(`${BASE}/`, { timeout: 5_000 });
  step.check((await page.evaluate(() => window.__clicks)).join() === 'true', 'a plain click on the back link is handled by the page (default prevented)');
  step.check((await page.textContent('h1')) === HOME_H1, 'a direct load of /projects/funcial/ + a click on the back link lands on the home page');
  step.check(documents.length === 0, `by client navigation, no document load (got ${documents.join(', ') || 'none'})`);
  await takeCsp(page, step);

  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await stageReady(page);
  documents.length = 0;
  await page.focus('.home-nav a[href="/projects/funcial/"]');
  await page.keyboard.press('Enter');
  await page.waitForURL(`${BASE}/projects/funcial/`, { timeout: 5_000 });
  await page.click('a.back');
  await page.waitForURL((url) => url.pathname === '/', { timeout: 5_000 }); // back to /?proof
  step.check(documents.length === 0, `by client navigation, no document load (got ${documents.join(', ') || 'none'})`);
  await page.evaluate(() => history.forward());
  step.check(
    await page.waitForURL(`${BASE}/projects/funcial/`, { timeout: 5_000 }).then(() => true, () => false),
    'a click on the back link of a page reached from the home page steps back, like Escape (the page forward is still there)',
  );
  await takeCsp(page, step);

  // The English pages go to the English home page.
  await page.goto(`${BASE}/en/projects/funcial/`, { waitUntil: 'load' });
  await stageReady(page);
  step.check((await page.getByRole('link', { name: 'back', exact: true }).count()) === 1, 'the English back link is named "back"');
  await page.keyboard.press('Escape');
  await page.waitForURL(`${BASE}/en/`, { timeout: 5_000 });
  step.check((await page.textContent('h1')) === HOME_H1 && (await page.getAttribute('html', 'lang')) === 'en', 'Escape on /en/projects/funcial/ lands on /en/');
  await takeCsp(page, step);
  await context.close();

  // A touch screen has no Escape key: the hint is hidden there, the link stays.
  const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const phone = await touch.newPage();
  phone.on('console', (message) => message.type() === 'error' && step.errors.push(message.text()));
  phone.on('pageerror', (error) => step.errors.push(error.message));
  await phone.goto(`${BASE}/projects/funcial/`, { waitUntil: 'load' });
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
  await page.click('#work a[href="/en/projects/funcial/"]');
  await page.waitForFunction(() => location.pathname === '/en/projects/funcial/', null, { timeout: 5_000 });
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

  // 3D on (the default): the three links are in the HTML and reachable by keyboard, but not shown.
  const hrefs = await page.$$eval('.home-nav a', (links) => links.map((link) => link.getAttribute('href')));
  step.check(JSON.stringify(hrefs) === JSON.stringify(HOME_LINKS), `the home nav links the three projects (got ${hrefs.join(' ')})`);
  step.check((await page.getAttribute('html', 'data-3d')) === 'on', 'the page says data-3d="on" after hydration');
  step.check(visuallyHidden(await boxOf(page, '.home-nav')), 'with 3D on, the home nav is visually hidden');
  await page.focus('.home-nav a');
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('href'));
  step.check(focused === HOME_LINKS[0], `a hidden link can take focus (got ${focused})`);
  const shown = await boxOf(page, '.home-nav');
  step.check(shown !== null && shown.height > 100, `the nav is shown while a link has focus (got ${JSON.stringify(shown)})`);
  await page.evaluate(() => document.activeElement?.blur());

  // The switch is named "3D" whatever its state (WCAG 2.5.3): role=switch and aria-checked say whether it is on.
  const named = async (state) => {
    const control = page.getByRole('switch', { name: '3D', exact: true });
    return (await control.count()) === 1 && (await control.getAttribute('aria-checked')) === state;
  };
  step.check(await named('true'), 'the 3D switch is named "3D", aria-checked="true" (its visible words are not its name)');

  // 3D off: the nav is shown, and the choice survives a reload.
  await page.click('button[role="switch"]');
  step.check((await page.getAttribute('html', 'data-3d')) === 'off', 'the switch sets data-3d="off"');
  step.check(await named('false'), 'switched off it is still named "3D", now aria-checked="false"');
  step.check((await page.evaluate(() => localStorage.getItem('needle-3d'))) === 'off', 'the switch stores needle-3d = off');
  const open = await boxOf(page, '.home-nav');
  step.check(open !== null && open.height > 100, `with 3D off, the home nav is shown (got ${JSON.stringify(open)})`);
  await takeCsp(page, step);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.getAttribute('data-3d') === 'off', null, { timeout: 5_000 });
  step.check((await page.textContent('button[role="switch"]')) === '3D uit', 'after a reload, the switch still says "3D uit"');
  // A visitor who switched 3D off never mounts WebGL, not even during hydration, and the page still leaves LOADING.
  await page.waitForTimeout(1_000); // a Stage mounted by mistake would have its canvas by now
  const off = await page.evaluate(() => ({ mounts: window.__needleDebug?.().canvasMounts ?? 0, canvases: document.querySelectorAll('canvas').length }));
  step.check(off.mounts === 0 && off.canvases === 0, `with 3D stored off, no Stage and no <canvas> (got ${off.mounts} mounts, ${off.canvases} canvas)`);
  const offPhase = await waitForPhase(page, 'HOME_IDLE').then((phase) => phase.kind, () => null);
  step.check(offPhase === 'HOME_IDLE', `with 3D stored off, the phase still leaves LOADING for HOME_IDLE (got ${JSON.stringify(await page.evaluate(() => window.__needleDebug?.().phase))})`);

  // And back on: the Stage mounts now.
  await page.click('button[role="switch"]');
  step.check((await page.evaluate(() => localStorage.getItem('needle-3d'))) === 'on', 'switching back stores needle-3d = on');
  step.check(visuallyHidden(await boxOf(page, '.home-nav')), 'with 3D on again, the home nav is hidden again');
  await stageReady(page);
  step.check((await page.evaluate(() => window.__needleDebug?.().canvasMounts)) === 1, 'switched on, the Stage mounts');
  await takeCsp(page, step);
  await context.close();
  return 'three links; hidden but focusable with 3D on, shown with 3D off, the choice stored';
}

async function mobile(browser, step) {
  const { context, page } = await openPage(browser, step, () => false, { width: 390, height: 844 });
  for (const { path } of PAGES) {
    await page.goto(BASE + path, { waitUntil: 'load' });
    await pageReady(page, path);
    // The page clips sideways overflow (body { overflow-x: clip }), so scrollWidth alone proves nothing:
    // look for content that reaches past the right edge as well.
    const { scroll, client, wide } = await page.evaluate(() => {
      const client = document.documentElement.clientWidth;
      const wide = [...document.querySelectorAll('header *, main *')]
        .filter((element) => {
          const { width, right } = element.getBoundingClientRect();
          return width > 1 && right > client + 0.5;
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
 * screen with Work, About and Contact at least 44 px high, and the button says close; the 3D switch leaves it open, a
 * link follows and closes it; on a project page Escape closes the open menu and stays on the page (the next Escape goes
 * back); it opens with script off too (the browser's own popover); and on a laptop there is no Menu button, the nav
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
  const expected = [t.nav.work, t.nav.about, t.nav.contact].map((text) => text.toLowerCase());
  step.check(JSON.stringify(s.links.map((l) => l.text)) === JSON.stringify(expected), `its links are ${expected.join(', ')} (got ${s.links.map((l) => l.text).join(', ')})`);
  step.check(s.links.every((l) => l.height >= 44 && l.left >= 0 && l.right <= phone.width), `each link is at least 44 px high, inside the screen (${s.links.map((l) => Math.round(l.height)).join(', ')} px)`);
  step.check(s.controls.every((c) => c.shown && c.bottom <= s.viewport), 'every control of the nav shows inside the sheet');
  step.check(s.toggleText === t.nav.close.toLowerCase(), `open, the button says "${t.nav.close}" (got "${s.toggleText}")`);

  await page.locator('#site-menu [role="switch"]').tap();
  await page.waitForTimeout(150);
  s = await menuState(page);
  step.check(s.open, 'the 3D switch leaves the menu open');
  await page.locator('#site-menu [role="switch"]').tap();

  await page.locator('#site-menu .menu-links a').first().tap();
  await page.waitForFunction(() => location.hash === '#work', null, { timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(300);
  s = await menuState(page);
  step.check(s.path === '/lite/' && s.hash === '#work' && !s.open, `Werk follows to /lite/#work and closes the menu (at ${s.path}${s.hash}, open ${s.open})`);
  await takeCsp(page, step);

  // A project page: Escape is the open menu's first, then the page's way back.
  await page.goto(`${BASE}/projects/funcial/`, { waitUntil: 'load' });
  await pageReady(page, '/projects/funcial/');
  await page.locator('.menu-toggle').tap();
  await page.waitForTimeout(150);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  s = await menuState(page);
  step.check(!s.open && s.path === '/projects/funcial/', `on a project page Escape closes the menu and stays (at ${s.path}, open ${s.open})`);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => location.pathname !== '/projects/funcial/', null, { timeout: 5_000 }).catch(() => {});
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
  return 'one row on a phone; Menu opens the sheet (links 44 px+, says close), 3D keeps it open, a link closes it, Escape closes it before going back, works without script; a laptop keeps its row';
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
  const workOrder = [t.work.intro, ...['Funcial', 'Jontai Energy', 'Cookies Clicker'], plain(t.work.nextTitle), t.work.nextText, t.work.nextLink, t.work.heldTitle, t.work.heldText].map((string) => work.indexOf(string));
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
  for (const href of [`${prefix}/projects/funcial/`, `${prefix}/projects/jontai-energy/`, `${prefix}/projects/cookies-clicker/`, `${prefix}/contact/`]) {
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
  step.check(sent.subject === 'Portfolio: A question' && sent.from_name === 'bhccob.me portfolio', `${path}: the post has the site's subject and sender (got ${sent.subject}, ${sent.from_name})`);
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
  await expectVoid(page, step, 'ready', 'the beads under the glass are ready, so nothing holds the landing');
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
  await page.focus('.home-nav a[href="/projects/funcial/"]');
  await page.keyboard.press('Enter');
  await page.waitForURL((url) => url.pathname === '/projects/funcial/', { timeout: 5_000 });
  await waitForProject(page, 'funcial');
  const onPage = await frameOf(page);
  await page.keyboard.press('PageDown'); // on the project page the keys are the page's
  step.check((await frameOf(page)).target === onPage.target, 'on a project page the keys do not move the story');
  await page.click('a.back');
  await page.waitForURL((url) => url.pathname === '/', { timeout: 5_000 });
  await expectPhase(page, step, 'PROJECTS', "coming back to / puts the scene on the scroll's phase, PROJECTS (Back lands at the bead's stop), and not on HOME_IDLE");
  // Task 12: Back from a project page lands at its bead's stop (spec §2.4), not where the scroll was before the page.
  const back = await frameOf(page);
  const arrivalUnit = chapterAt(HOME_CHAPTERS, BEAD_LIST[0].stop).index;
  step.check(near(back.progress, BEAD_LIST[0].stop) && back.chapterIndex === arrivalUnit, `the story is at Funcial's arrival stop, ${BEAD_LIST[0].stop}, in its inside (unit ${arrivalUnit}), where Back from its page lands (got ${JSON.stringify(back)})`);
  await page.keyboard.press('PageDown');
  const resumed = await restAt(page);
  step.check(resumed.target === BEAD_LIST[0].inside && resumed.progress === BEAD_LIST[0].inside, `and the scroll goes on from there, a step to Funcial's inside stop, ${BEAD_LIST[0].inside} (got ${resumed.target})`);
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

  // The 3D switch takes Space (a button press), and with 3D off nothing is prevented: the page scrolls natively.
  await page.focus('button[role="switch"]');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.documentElement.dataset['3d'] === 'off', null, { timeout: 5_000 });
  step.check((await frameOf(page)).target === 0, 'Space on the 3D switch presses it and does not move the story');
  await page.evaluate(() => {
    window.__wheels.length = 0;
    document.activeElement?.blur();
  });
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(300);
  step.check(JSON.stringify(await page.evaluate(() => window.__wheels)) === '[false]', 'with 3D off a wheel is not prevented');
  const natural = await page.evaluate(() => ({ y: window.scrollY, overflow: getComputedStyle(document.documentElement).overflow }));
  step.check(natural.y > 0 && natural.overflow === 'visible', `with 3D off the home page scrolls natively (scrollY ${natural.y}, overflow ${natural.overflow})`);
  await page.keyboard.press('PageDown');
  step.check((await frameOf(page)).target === 0, 'and the keys do not move the story');

  // Switched back on, the root is locked again and the wheel is the scene's.
  await page.focus('button[role="switch"]');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.documentElement.dataset['3d'] === 'on', null, { timeout: 5_000 });
  await page.evaluate(() => {
    window.__wheels.length = 0;
    document.activeElement?.blur();
  });
  // Read once the page's scroll has stopped: the Page Down pressed with 3D off may still be scrolling it smoothly.
  const onAgainAt = await scrollSettled(page);
  step.check(onAgainAt === 0, `with 3D on again the page is back at the top, and stays there once its scroll has stopped (scrollY ${onAgainAt})`);
  await page.mouse.wheel(0, 120);
  step.check((await frameOf(page)).target > 0 && JSON.stringify(await page.evaluate(() => window.__wheels)) === '[true]', 'and the wheel moves the story again');
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
  await expectVoid(page, step, 'ready', 'the beads under the glass are ready, so nothing holds the landing');
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
  await expectVoid(page, step, 'ready', 'the beads under the glass are ready, so nothing holds the landing');
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
  // On a phone the 3D switch is in the menu (option A, 2026-10-22): a tap opens it, another presses the switch.
  await page.tap('.menu-toggle');
  await page.tap('#site-menu button[role="switch"]');
  await page.waitForFunction(() => document.documentElement.dataset['3d'] === 'off', null, { timeout: 5_000 });
  step.check((await page.getAttribute('html', 'data-3d')) === 'off', 'a tap on Menu, then on the 3D switch, still presses it');
  await page.tap('#site-menu button[role="switch"]');
  await page.waitForFunction(() => document.documentElement.dataset['3d'] === 'on', null, { timeout: 5_000 });
  await page.tap('.menu-toggle');
  await takeCsp(page, step);
  await context.close();
}

async function scroll(browser, step) {
  await scrollDesktop(browser, step);
  await scrollReduced(browser, step);
  await scrollTouch(browser, step);
  return 'locked root; 10 wheel events of 120 px settle on BOB from above; the loop sleeps at rest; keys by distance on the rise and by key stops past it, Home and End; text fields, pinch and 3D off left to the browser; reduced motion steps by key stops; touch drag, glide on the rise and on into the light dive, tap';
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

  // The canvas renders on demand: once the home's idle motion is over, nothing asks for a frame; the pointer wakes it.
  const slept = await sleepWithin(page, SLEEP_WITHIN_MS);
  step.check(slept !== null, `an idle page draws nothing: no requestAnimationFrame at all for 1 s, from ${slept} ms after the last input (limit ${SLEEP_WITHIN_MS} ms)`);
  const before = await page.evaluate(() => window.__allRaf);
  await page.mouse.move(980, 320, { steps: 4 });
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => window.__allRaf);
  step.check(after > before, `a pointer move wakes the canvas (${after - before} frames asked for in 300 ms)`);

  // Over a page of text a mouse idling about wakes only the parallax, about a second, never the home's 12 s idle.
  await page.focus('.home-nav a[href="/projects/funcial/"]');
  await page.keyboard.press('Enter');
  await page.waitForURL((url) => url.pathname === '/projects/funcial/', { timeout: 5_000 });
  const settled = await sleepWithin(page, SLEEP_WITHIN_MS); // the phase change's own while first
  const wiggleFrom = await page.evaluate(() => window.__allRaf);
  for (const [x, y] of [[400, 300], [460, 340], [520, 300], [480, 360]]) await page.mouse.move(x, y, { steps: 3 });
  const woke = (await page.evaluate(() => window.__allRaf)) > wiggleFrom;
  // sleepWithin asks for a whole quiet second, so a limit of RESETTLE_MS + 1 s means quiet from at most RESETTLE_MS on.
  const RESETTLE_MS = 3_000;
  const resettled = await sleepWithin(page, RESETTLE_MS + 1_000);
  step.check(
    settled !== null && woke && resettled !== null,
    `on /projects/funcial/ a mouse wiggle wakes the parallax only: the canvas falls quiet ${resettled} ms after it and stays so for 1 s (it must fall quiet within ${RESETTLE_MS} ms; the home's idle is ${IDLE_SECONDS} s)`,
  );
  await takeCsp(page, step);
  await context.close();

  // 3D stored off: no WebGL, and the phase still leaves LOADING.
  const off = await openPage(browser, step);
  await off.context.addInitScript(() => localStorage.setItem('needle-3d', 'off'));
  await off.page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  const offAt = await reachHomeIdle(off.page);
  await off.page.waitForTimeout(500);
  const none = await off.page.evaluate(() => ({ mounts: window.__needleDebug?.().canvasMounts ?? 0, canvases: document.querySelectorAll('canvas').length, card: document.querySelector('.scene-fallback') !== null }));
  step.check(none.mounts === 0 && none.canvases === 0 && !none.card, `with 3D stored off: HOME_IDLE after ${offAt} ms, no Stage, no <canvas>, no card (got ${JSON.stringify(none)})`);
  await takeCsp(off.page, step);
  await off.context.close();
  return `LOADING → HOME_IDLE in ${at} ms on a direct load, the wheel moves the story, the canvas sleeps ${slept} ms after the last input and wakes on the pointer; 3D off: HOME_IDLE in ${offAt} ms, no WebGL`;
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

  // From the home page to Lite by client navigation: the canvas stays, and sleeps there.
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
  await page.click('.site-header a[href="/lite/"]');
  await page.waitForURL(`${BASE}/lite/`, { timeout: 5_000 });
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
  step.check(kept.route === 'lite' && kept.mounts === 1 && kept.canvases === 1 && kept.tag === 'home-canvas', `home → Lite by client navigation: one Stage, the same <canvas> (got ${JSON.stringify(kept)})`);
  step.check(slept === 0, `on Lite the canvas sleeps: no requestAnimationFrame in 1.5 s of the mouse moving over the page (got ${slept})`);

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
    step.check(state.threeD === 'off' && state.stored === null, `${label}, ${path}: 3D off for the visit, the stored choice untouched (data-3d ${state.threeD}, needle-3d ${state.stored})`);
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

  // A context lost for good: the card after RESTORE_TIMEOUT_MS. Switching 3D back on tries again, with a new Stage.
  {
    const { context, page } = await openPage(browser, step);
    await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
    await reachHomeIdle(page);
    await loseContext(page, false);
    await fellBack(page, 'a context lost for good', RESTORE_TIMEOUT_MS + 3_000);
    await page.click('button[role="switch"]');
    await page.waitForFunction(() => document.querySelector('.scene-host')?.hasAttribute('data-ready'), null, { timeout: LOAD_TIMEOUT_MS });
    const again = await page.evaluate(() => ({ mounts: window.__needleDebug?.().canvasMounts, card: document.querySelector('.scene-fallback') !== null, stored: localStorage.getItem('needle-3d') }));
    step.check(again.mounts === 2 && !again.card && again.stored === 'on', `switched back on, a new Stage draws and the card goes (got ${JSON.stringify(again)})`);
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
  return `a context lost for good, and a scene not ready in ${LOAD_TIMEOUT_MS / 1000} s, fall back to the card; a restored context draws again; 3D back on retries`;
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

/** A page's file name stem from its path: its language, then the path with dashes: `nl-projects-funcial`, `en-home`. */
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
 * `en-projects-funcial-390x844.png`, `fallback-1440x900.png`. A page with a scene is taken once its opening has landed and the
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
  // The light dive, the path's stops and the credits, through the luma gate: the scene's with the page's text masked; the
  // credits whole, their text the only picture on the night.
  const gated = [];
  for (const size of sizes) {
    const at = sizeName(size);
    const { context, page } = await readyHome(browser, step, size);
    const places = [
      ...[32, 60, 121, 241].map((frame) => ({ name: `light-${frame}`, progress: placeOfFrame(frame) })),
      ...BEAD_LIST.flatMap((bead) => [
        { name: `arrival-${bead.id}`, progress: bead.stop },
        { name: `inside-${bead.id}`, progress: bead.inside, kind: 'inside' },
      ]),
      { name: 'look-back', progress: LOOK_STOP },
      { name: 'credits', progress: STORY_END, whole: true },
    ];
    for (const place of places) {
      await poseAt(page, place.progress);
      await page.waitForTimeout(place.whole ? 900 : 500);
      const file = join(dir, `${place.name}-${at}.png`);
      await page.screenshot({ path: file });
      gated.push({ file, kind: place.kind ?? 'home', mask: place.whole ? null : await textMask(page) });
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
  return `${shots.length} stills in ${dir}: ${PAGES.length} pages at 1440x900 and 390x844 once landed, the fallback; the page scrim over the scene on every page of text; ${rows.length} stills of the light dive, the path's stops and the credits, ${lumaSummary(rows, 'home')}; ${lumaSummary(rows, 'inside')}`;
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
 * mock-up's insides measure up to 0.138 on a laptop (Funcial's, the brightest), so they keep a ceiling of their own,
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
 * share of the picture under the boxes. Without a mask `sceneMean` is `mean` and `masked` is 0.
 */
async function lumaOf(page, file, mask = null) {
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
    [url, LUMA_GATE.clip, LUMA_GATE.floor.region, mask],
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
    for (const el of document.querySelectorAll('.bead-label[data-shown], .home-nav, .site-header')) add(el);
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
    const luma = await lumaOf(page, shot.file, shot.mask ?? null);
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
 * leaves, as on a slow connection: CUT_AT (1.5) s into the loader a click on the header's Lite link (which also asks for the skip)
 * opens Lite by client navigation, a page with no scene, where the show cannot land. (A load that is in by then lands
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
  await page.goto(`${BASE}/projects/funcial/?proof`, { waitUntil: 'load' });
  await page.bringToFront();
  const flag = await page.evaluate((key) => localStorage.getItem(key), LOADER_SEEN_KEY);
  await loaderAtLeast(page, CUT_AT);
  const at = (await debugOf(page)).loader;
  await page.click('.site-header a[href="/lite/"]');
  const opened = await page.waitForURL(`${BASE}/lite/`, { timeout: 5_000 }).then(
    () => true,
    () => false,
  );
  await page.waitForTimeout(500);
  const there = await debugOf(page);
  step.check(
    flag === null && at.stage === 'engrave' && at.elapsed >= CUT_AT && at.elapsed < CUT_AT + 2 * CUT_WITHIN && asked >= 1,
    `a first visit to /projects/funcial/ plays the full show, its compass file held (${asked} asked): ${CUT_AT} s in it engraves (stage ${at.stage} at ${at.elapsed.toFixed(2)} s, ${LOADER_SEEN_KEY} ${flag})`,
  );
  step.check(
    opened && there.route === 'lite',
    `a click on the header's Lite link ${CUT_AT} s in opens Lite (${page.url()}, route ${there.route}; the opening stands at ${there.loader.stage}, ${there.loader.elapsed.toFixed(2)} s)`,
  );

  // The wheel, from the top of Lite.
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
    wheelFrom === 0 && wheelY > 0 && wheels.length === 5 && wheels.every((e) => !e.prevented),
    `on Lite five wheel turns scroll the page: scrollY ${wheelFrom} → ${wheelY}, ${wheels.filter((e) => e.prevented).length} of ${wheels.length} prevented`,
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
  const back = await page.waitForURL(`${BASE}/projects/funcial/?proof`, { timeout: 5_000 }).then(
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
  await page.goto(`${BASE}/projects/funcial/?proof`, { waitUntil: 'load' });
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
  const slept = await sleepWithin(page, limit);
  step.check(slept !== null, `landed and left alone, the canvas draws nothing for a whole second from ${slept} ms after the landing (within DRIFT_RUN + SLEEP_WITHIN_MS = ${limit} ms)`);
  step.check(slept !== null && slept >= (DRIFT_RUN - 2) * 1000, `and it ran the drift on to its rest first: it fell quiet ${slept} ms after the landing (the drift rests at ${DRIFT_RUN} s)`);
  await takeCsp(page, step);
  await context.close();
  return `the idle motion and the drift ran to the drift's rest, then the canvas slept ${slept} ms after the landing (limit ${limit} ms)`;
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
    `and the journey is on the rise at its start, no bead, the void in a state it can be in (got ${JSON.stringify(at.journey)})`,
  );

  // .set puts the story somewhere at once: progress and target there, nothing moving, the chapter and the phase with it.
  // Half way through Funcial's travel (the path's first unit, the third of the story) the journey, which the scene poses
  // on the next frame it draws, says the same: the travel, half way, Funcial the bead it goes to, and the beads on screen.
  const travel = PATH_START + 0.625;
  await waitForVoid(page, 'ready');
  await page.evaluate((progress) => window.__needleDebug.set({ progress }), travel);
  const mid = await debugOf(page);
  step.check(
    mid.progress === travel && mid.target === travel && mid.velocity === 0 && mid.chapter.index === 2 && mid.chapter.id === 'TRAVEL' && mid.phase.kind === 'PROJECTS' && mid.phase.category === BEAD_LIST[0].category,
    `.set({ progress: ${travel.toFixed(4)} }) puts the story in Funcial's travel, PROJECTS ${BEAD_LIST[0].category} (got ${JSON.stringify([mid.progress, mid.target, mid.chapter, mid.phase])})`,
  );
  step.check(near(mid.chapter.local, 0.5, 1e-9), `and the chapter's local is how far through it, half way (got ${mid.chapter.local})`);
  const travelling = await journeyAfter(page, 'travel');
  step.check(
    travelling.stretch === 'travel' && near(travelling.local, 0.5, 1e-9) && travelling.project === 0 && travelling.frame === null && travelling.sheet === 0 && Array.isArray(travelling.beads) && travelling.beads.length === BEAD_LIST.length && Array.isArray(travelling.wake) && !('angle' in travelling) && !('ring' in travelling),
    `and the journey says so: the travel half way to Funcial, its beads on the screen and their wakes, no ring (got ${JSON.stringify(travelling)})`,
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
  step.check(last.stretch === 'end' && last.project === null && last.local === 0, `and the journey is on the end page, past the last bead, no bead (got ${JSON.stringify(last)})`);
  await page.evaluate(() => window.__needleDebug.set({ progress: 0 }));
  const start = await debugOf(page);
  step.check(start.target === 0 && start.chapter.index === 0 && start.phase.kind === 'HOME_IDLE', `.set({ progress: 0 }) is the start again (got ${JSON.stringify([start.target, start.chapter.index, start.phase])})`);

  // .dispatch sends a scene event, as the app's own parts do; the phase is the store's own object. A project opens from
  // the projects chapter: the last bead's stop, the story's last stop before the end page.
  await page.evaluate((progress) => window.__needleDebug.set({ progress }), BEAD_LIST.at(-1).stop);
  await page.evaluate(() => window.__needleDebug.dispatch({ type: 'OPEN_PROJECT', id: 'funcial' }));
  const focus = await debugOf(page);
  step.check(focus.phase.kind === 'PROJECT_FOCUS' && focus.phase.id === 'funcial', `.dispatch({ type: 'OPEN_PROJECT', id: 'funcial' }) from the projects focuses Funcial (got ${JSON.stringify(focus.phase)})`);
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
 * name, Work, About, Contact, the language switch, Lite and the 3D toggle), the language switch and the toggle each with a
 * visible focus ring on screen, and Shift+Tab goes back; End goes to the last
 * chapter (the end of the story, the end page) and Home returns to the start, both from a focused control, each by the
 * step fade. From BOB from above the arrows step the facts (each at its peak), then the projects, then the end page.
 * At Jontai Energy's stop, Tab from the 3D toggle reaches the front bead's label, then the skip button, and Enter on the
 * skip button takes the story to the end page and the focus to its title.
 */
async function keyboard(browser, step) {
  const { context, page } = await openPage(browser, step);
  await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
  await stageReady(page);
  await reachHomeIdle(page);
  // The End below goes past the landing's hold (LANDING_HOLD) once the beads are in; the Tab presses take longer than it does.
  await expectVoid(page, step, 'ready', 'the beads under the glass are ready, so nothing holds the landing');
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
  const isToggle = (control) => control.role === 'switch';

  const reached = [];
  for (let press = 0; press < 12; press++) {
    await page.keyboard.press('Tab');
    reached.push(await focused());
    if (isToggle(reached.at(-1))) break;
  }
  const langAt = reached.findIndex(isLang);
  const toggleAt = reached.findIndex(isToggle);
  step.check(reached[0]?.href === '#main', `the first Tab lands on the skip link (got ${JSON.stringify(reached[0])})`);
  step.check(langAt > 0 && toggleAt > langAt, `Tab reaches the language switch and then the 3D toggle (language switch at press ${langAt + 1}, toggle at press ${toggleAt + 1} of ${reached.length})`);
  // The header's order (spec §2.2): the name, then Work, About and Contact, the language switch, Lite, the 3D switch.
  const order = reached.map((control) => (isToggle(control) ? '3D' : isLang(control) ? 'EN' : control.href));
  const HEADER_ORDER = ['#main', '/', '/lite/#work', '/lite/#about', '/contact/', 'EN', '/lite/', '3D'];
  step.check(JSON.stringify(order) === JSON.stringify(HEADER_ORDER), `Tab goes through the header in its order: ${HEADER_ORDER.join(', ')} (got ${order.join(', ')})`);
  for (const [name, control] of [['the language switch', reached[langAt]], ['the 3D toggle', reached[toggleAt]]]) {
    step.check(control?.ring && control.onScreen, `${name} shows a focus ring (outline 2px or more) and is on screen when focused (got ${JSON.stringify(control)})`);
  }
  // The language switch shows "EN" and its name begins with it (WCAG 2.5.3, label in name).
  const lang = page.locator('.header-nav a[hreflang="en"]');
  const langName = await lang.getAttribute('aria-label');
  step.check(
    (await lang.textContent()) === 'EN' && /^EN – \S/.test(langName ?? '') && (await page.getByRole('link', { name: langName ?? '', exact: true }).count()) === 1,
    `the language switch shows "EN" and is named "${langName}", which begins with it`,
  );
  await page.keyboard.press('Shift+Tab');
  step.check((await focused()).href === '/lite/', 'Shift+Tab from the 3D toggle goes back to the Lite link before it');
  await page.keyboard.press('Shift+Tab');
  step.check(isLang(await focused()), 'and once more to the language switch');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  step.check(isToggle(await focused()), 'and Tab to the toggle again');

  // End and Home work from a focused control: a button keeps Space and Enter, not these.
  await watchFade();
  await page.keyboard.press('End');
  const last = await restAt(page);
  step.check(await fadeSeen(), 'End goes by the step fade');
  step.check(last.target === STORY_END && last.progress === STORY_END && last.chapterIndex === LAST_UNIT, `End jumps to the last chapter: the end of the story, ${STORY_END}, chapter ${LAST_UNIT} (got ${JSON.stringify(last)})`);
  const reachedEnd = await waitForPhase(page, 'END').then(() => true, () => false);
  const atEnd = await debugOf(page);
  step.check(reachedEnd && atEnd.chapter.id === LAST_CHAPTER && LAST_CHAPTER === 'END' && atEnd.phase.kind === 'END', `and it is the end page, ${LAST_CHAPTER} (got ${JSON.stringify([atEnd.chapter, atEnd.phase])})`);
  step.check(isToggle(await focused()), 'with the focus still on the 3D toggle');
  await watchFade();
  await page.keyboard.press('Home');
  const first = await restAt(page);
  step.check(first.target === 0 && first.progress === 0 && first.chapterIndex === 0, `Home returns to the start (got ${JSON.stringify(first)})`);
  step.check(await fadeSeen(), 'Home from the end page goes by the step fade');
  await waitForPhase(page, 'HOME_IDLE');
  const atStart = await debugOf(page);
  step.check(atStart.chapter.id === 'HOME' && atStart.phase.kind === 'HOME_IDLE', `and to HOME, HOME_IDLE (got ${JSON.stringify([atStart.chapter, atStart.phase])})`);

  // The arrows from BOB from above: each fact at its peak, each project's arrival and inside, the look back, the credits.
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

  // At Jontai Energy's arrival: Tab from the 3D toggle reaches its label, then the skip button; Enter on it.
  await poseAt(page, BEAD_LIST[1].stop);
  const jontai = await waitForLabel(page, 'jontai-energy');
  step.check(jontai !== null, "at Jontai Energy's arrival its label shows whole");
  await page.getByRole('switch', { name: '3D', exact: true }).focus();
  await page.keyboard.press('Tab');
  const onLabel = await page.evaluate(() => document.activeElement?.closest('.bead-label')?.getAttribute('data-bead') ?? null);
  await page.keyboard.press('Tab');
  const onSkip = await page.evaluate(() => document.activeElement?.classList.contains('skip-button') ?? false);
  step.check(onLabel === 'jontai-energy' && onSkip, `Tab from the 3D toggle reaches the arrived bead's label (${onLabel}), then the skip button (${onSkip})`);
  await watchFade();
  await page.keyboard.press('Enter');
  const endState = await endViewAt(page, 'rest');
  await page.waitForFunction(() => document.activeElement?.id === 'end-title', null, { timeout: 5_000 }).catch(() => {});
  const focusedTitle = await page.evaluate(() => document.activeElement?.id ?? null);
  step.check(endState === 'rest' && focusedTitle === 'end-title' && (await fadeSeen()), `Enter on the skip button fades the story to the credits (data-end ${endState}) and the focus goes to "Q&A" (${focusedTitle})`);
  await takeCsp(page, step);
  await context.close();
  return `Tab: skip link, language switch (press ${langAt + 1}), 3D toggle (press ${toggleAt + 1}), each ringed and on screen; End goes to ${STORY_END} (the end page, ${LAST_CHAPTER}), Home back to 0, both by the fade; the arrows walk ${reachedStops.length} key stops; Tab to Jontai Energy's label at its arrival, then the skip button, Enter to "Q&A"`;
}

/**
 * A language switch is not a step in the story: on /projects/funcial/ the phase is PROJECT_FOCUS funcial, and after a
 * client-side switch to /en/projects/funcial/ (and back) it is still PROJECT_FOCUS funcial, the very same state with no new
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
    { path: '/projects/funcial/', other: '/en/projects/funcial/', route: 'project', phase: { kind: 'PROJECT_FOCUS', id: 'funcial' }, label: 'PROJECT_FOCUS funcial' },
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
  // Under reduced motion the landing's hold is the last key stop under LANDING_HOLD (fact 05) while the beads load, and
  // every stop after it needs them: the step starts with them in.
  await expectVoid(page, step, 'ready', 'the beads under the glass are ready, so nothing holds the story at the landing');
  await page.mouse.move(720, 450);

  // 0 home, 1 BOB from above, the five facts at their peaks, each project's arrival and inside, the look back's own stop,
  // the credits.
  const places = keyStops(HOME_CHAPTERS);
  step.check(
    places.length === 15 && places[0] === 0 && places[1] === 1 && places.at(-2) === LOOK_STOP && places.at(-1) === STORY_END && BEAD_LIST.every((bead) => places.includes(bead.stop) && places.includes(bead.inside)),
    `the story's fifteen key stops: the home, BOB from above, five facts, three arrivals and insides, the look back's and the credits' (got ${places.map((p) => p.toFixed(3)).join(', ')})`,
  );
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
  }
  // A step down from the last stop is no step: nothing moves and the scene host does not fade down and back.
  const endRest = await endViewAt(page, 'rest');
  step.check(endRest === 'rest', `at the last stop the end page is at rest, <html data-end="${endRest}">`);
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
  // At the end page the wheel is the page's own scroll: that one event scrolled the page, and one up takes it back to its
  // top with the story still at the end; the walk back up starts from there, a new gesture at the page's top.
  const scrolled = await scrollSettled(page);
  await page.mouse.wheel(0, -40);
  const topAgain = await scrollSettled(page);
  step.check(
    scrolled > 0 && topAgain === 0 && (await frameOf(page)).target === STORY_END,
    `and at the end page the wheel is the page's own scroll: that event scrolled it to ${scrolled}, and one up back to ${topAgain}, the story still at the end`,
  );
  await page.waitForTimeout(300); // the next event is the next gesture
  for (let i = places.length - 2; i >= 0; i--) {
    const stop = places[i];
    await watchStep();
    await page.mouse.wheel(0, -40);
    const target = (await frameOf(page)).target;
    step.check(target === stop, `one wheel event up moves the target to exactly the previous key stop, ${stop.toFixed(4)} (got ${target})`);
    await arrive(stop, 'up', places[i + 1]);
    await page.waitForTimeout(300);
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
 * The three beads in the way's order (BEADS, src/scene/bob/journey.ts) with the arrival stop of each (`arrivalStop`: the
 * light round it, its label whole, where Back from its page lands) and its inside stop (`insideStop`: its objects built),
 * the page of the project (src/data/pages.ts) and its title.
 */
const BEAD_LIST = BEADS.map((bead, index) => ({
  id: bead.id,
  index,
  category: bead.category,
  stop: arrivalStop(HOME_CHAPTERS, bead.category),
  inside: insideStop(HOME_CHAPTERS, bead.category),
  path: SITE_PAGES[`project-${bead.id}`],
  title: projectTitle(bead.id),
}));

/** The path's start, the hand-over from the fall (way frame 256): the light path's places are counted from it. */
const PATH_START = pathStart(HOME_CHAPTERS);
/** The look back's start (the last inside's end) and its own stop (the sheet's start, where the credits begin to come). */
const LOOK_START = lookStart(HOME_CHAPTERS);
const LOOK_STOP = sheetStart(HOME_CHAPTERS);

/**
 * What the journey says at each of the story's key stops, 0 to the end (`journey.stretch` and `journey.project`; `local`
 * is 0 at each), from the pure journey: the home, BOB from above, the facts, each project's arrival (`inside`, its label
 * whole) and inside (the next travel's start, or the look back's), the look back's own stop (`sheet`) and the credits
 * (`end`, the end of the scroll: past its start the page scrolls natively).
 */
const JOURNEY_STOPS = keyStops(HOME_CHAPTERS).map((stop) => {
  const at = journeyAt(stop);
  return { stop, stretch: at.stretch, project: at.project };
});

/** Where `poseOnTheFrame` puts the story: the rise (0.6), the fall (fact 03's peak), Funcial's travel and its orbit. */
const SAME_FRAME_AT = [0.6, placeOfFrame(161), PATH_START + 0.6, PATH_START + 1.9];

/** The pixels from the screen's edges the label keeps, and the header it stays under (src/ui/BeadLabel.tsx, `labelMargin`, `HEADER`). */
const labelMarginOf = (width) => (width < 720 ? 24 : 16);
const HEADER_PX = 64;

/** The file the void's beads come from (public/models/bob-beads.glb, under the site's base). */
const BEADS_GLB = /\/models\/bob-beads\.glb$/;

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
 * Holds `bob-beads.glb` back: every request for it waits until `release()`, so the void stays `loading`. `asked()` says how
 * many requests the page made. Call it before the page navigates.
 */
async function holdBeads(page) {
  let open = () => {};
  const gate = new Promise((resolve) => (open = resolve));
  let asked = 0;
  const handler = async (route) => {
    asked++;
    await gate;
    await route.continue().catch(() => {}); // the page may have gone by now
  };
  await page.route(BEADS_GLB, handler);
  return {
    asked: () => asked,
    release: async () => {
      open();
      await page.unroute(BEADS_GLB, handler);
    },
  };
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
 * Bead `id`'s label as the page shows it now (src/ui/BeadLabel.tsx): whether it is `shown` (in the page) and `rest` (whole,
 * at the bead's stop), its opacity, its tabindex, its link, its box and the viewport, its four lines' text, and which of the
 * two hints the stylesheet shows. Null where the page has no such label.
 */
const labelOf = (page, id) =>
  page.evaluate((id) => {
    const el = document.querySelector(`.bead-label[data-bead="${id}"]`);
    if (el === null) return null;
    const box = el.getBoundingClientRect();
    const text = (selector) => el.querySelector(selector)?.textContent ?? null;
    const displayed = (selector) => {
      const part = el.querySelector(selector);
      return part !== null && getComputedStyle(part).display !== 'none';
    };
    return {
      shown: el.hasAttribute('data-shown'),
      rest: el.hasAttribute('data-rest'),
      opacity: Number(getComputedStyle(el).opacity),
      tabindex: el.getAttribute('tabindex'),
      href: el.getAttribute('href'),
      box: { left: box.left, top: box.top, right: box.right, bottom: box.bottom },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      category: text('.bead-label-category'),
      title: text('.bead-label-title'),
      hintFine: text('.bead-label-hint-fine'),
      hintTouch: text('.bead-label-hint-touch'),
      fineShown: displayed('.bead-label-hint-fine'),
      touchShown: displayed('.bead-label-hint-touch'),
    };
  }, id);

/** Bead `id`'s label once it is shown whole (`data-shown`, `data-rest`, opacity 1: its 0.4 s fade is over); null if it never is within `timeout` ms. */
async function waitForLabel(page, id, timeout = 5_000) {
  const shown = await page
    .waitForFunction(
      (id) => {
        const el = document.querySelector(`.bead-label[data-bead="${id}"]`);
        return el !== null && el.hasAttribute('data-shown') && el.hasAttribute('data-rest') && Number(getComputedStyle(el).opacity) === 1;
      },
      id,
      { timeout },
    )
    .then(() => true, () => false);
  return shown ? labelOf(page, id) : null;
}

/** True when the label's box is inside the screen with the margin the site keeps (src/ui/BeadLabel.tsx), and under the header; a pixel of rounding is allowed. */
const labelInside = (label) => {
  const margin = labelMarginOf(label.viewport.width);
  const { left, top, right, bottom } = label.box;
  return left >= margin - 1 && right <= label.viewport.width - margin + 1 && top >= HEADER_PX + margin - 1 && bottom <= label.viewport.height - margin + 1;
};

/**
 * Opening a bead (spec §2.4), at 1440x900 and at 390x844 (touch), each in a fresh context that lands with the seen flag set
 * and the void ready. The bridge has no field for a bead being opened, so the step reads the page: the label
 * (`.bead-label`, src/ui/BeadLabel.tsx), the URL and the scene's phase.
 *
 * 1. At each ring stop (4, 5, 6, put there through `.set`) the label shows whole, inside the screen with the margin the
 *    site keeps, and its lines are the Dutch dictionary's: the category line (`categories`), the title (read from
 *    src/data/projects.ts), the hint and the touch hint (`t.needle.bead`), the one for the pointer shown; it is the link to
 *    the project's page.
 * 2. Tab reaches the label (from the skip link, within 14 presses) with a focus ring, and Enter opens the project: 120 ms
 *    on the page is still `/` with the camera flying into the porthole (`<html data-bead-open>`, PROJECT_FOCUS), the router
 *    goes to `/projects/<slug>/` once the flight (FLIGHT_MS) is over, and the scene is PROJECT_FOCUS on that bead. Esc returns to
 *    that bead's stop (the story at it, at rest, PROJECTS in its category) and its label shows again. All three beads.
 * 3. The other two hands: a click (a tap on the phone) on the label of Jontai Energy, which the browser's Back brings
 *    back to its arrival, its label shown; and on the bead itself of Cookies Clicker, where the bridge's `journey.beads`
 *    puts it on the screen, which Esc brings back to its arrival. Then Jontai Energy's bead clicked (tapped) in its inside
 *    and in the look back: Back returns to the very place each time.
 * 4. None of it loads a document: it is all client navigation.
 * 5. A direct load of `/projects/cookies-clicker/`, then Esc once the opening has landed (the void may still be loading: the
 *    hold carries the story on), lands at stop 6, Cookies Clicker's, with its label.
 */
async function beadOpen(browser, step) {
  const dutch = new Translator('nl').t.needle.bead;
  const summary = [];
  step.check(
    BEAD_LIST.every((bead) => bead.title !== null && bead.path === `/projects/${bead.id}/`),
    `the beads' titles are read from src/data/projects.ts and their pages from src/data/pages.ts: ${BEAD_LIST.map((bead) => `${bead.id} "${bead.title}" ${bead.path}`).join(', ')}`,
  );
  for (const size of STILL_SIZES) {
    const at = sizeName(size);
    const touch = size.options.hasTouch === true;
    const { context, page } = await openSeen(browser, step, size);
    const documents = [];
    page.on('request', (request) => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url());
    });
    step.check(await landHome(page), `${at}: landed on the home, the hero shown whole`);
    await expectVoid(page, step, 'ready', `${at}: the void under the glass is ready`);
    documents.length = 0;
    const pathNow = () => new URL(page.url()).pathname;

    /** The story at a bead's stop, and its label once it shows whole. */
    const arriveAt = async (bead) => {
      await page.evaluate((progress) => window.__needleDebug.set({ progress }), bead.stop);
      await settledState(page);
      return waitForLabel(page, bead.id);
    };
    /** From a bead's page, Esc: back at the home on that bead's stop, at rest, its label shown again. */
    const escapeTo = async (bead, how) => {
      await page.keyboard.press('Escape');
      const stopped = await waitForStop(page, bead.category, 15_000);
      step.check(
        pathNow() === '/' && stopped.kind === 'PROJECTS' && stopped.category === bead.category && stopped.progress === bead.stop && stopped.target === bead.stop,
        `${at}: ${how}: Esc returns to ${bead.id}'s stop, ${bead.stop}, at rest (path ${pathNow()}, got ${JSON.stringify(stopped)})`,
      );
      const again = await waitForLabel(page, bead.id);
      step.check(again !== null && labelInside(again), `${at}: ${how}: and its label shows again, whole and inside the screen`);
    };
    /** From a bead's page, the browser's Back: back at the home on that bead's stop, at rest, it in front and its label shown again. */
    const backTo = async (bead, how) => {
      await page.goBack();
      const stopped = await waitForStop(page, bead.category, 15_000);
      const state = await debugOf(page);
      step.check(
        pathNow() === '/' && stopped.kind === 'PROJECTS' && stopped.category === bead.category && stopped.progress === bead.stop && stopped.target === bead.stop && state.journey.project === bead.index,
        `${at}: ${how}: Back returns to ${bead.id}'s stop, ${bead.stop}, at rest, ${bead.id} in front (path ${pathNow()}, got ${JSON.stringify(stopped)}, project ${state.journey.project})`,
      );
      const again = await waitForLabel(page, bead.id);
      step.check(again !== null && labelInside(again), `${at}: ${how}: and its label shows again, whole and inside the screen`);
    };
    /** Does `act` and checks what follows: the flight into the porthole, the page, the scene on that bead. */
    const opens = async (bead, how, act) => {
      const began = Date.now();
      await act();
      await page.waitForTimeout(120);
      const mid = await page.evaluate(() => {
        const { phase } = window.__needleDebug();
        return { path: location.pathname, opening: document.documentElement.hasAttribute('data-bead-open'), kind: phase.kind, id: phase.id };
      });
      const arrived = await page.waitForURL(`${BASE}${bead.path}`, { timeout: 5_000 }).then(() => true, () => false);
      const took = Date.now() - began;
      step.check(
        mid.path === '/' && mid.opening && mid.kind === 'PROJECT_FOCUS' && mid.id === bead.id,
        `${at}: ${how}: 120 ms on, the camera is still flying into ${bead.id}: the page is still ${mid.path}, <html data-bead-open> ${mid.opening}, the phase ${mid.kind} ${mid.id}`,
      );
      step.check(arrived && took >= FLIGHT_MS - 100 && took <= FLIGHT_MS + 2_200, `${at}: ${how}: the router goes to ${bead.path} once the ${FLIGHT_MS / 1000} s flight is over, ${took} ms after the press (at least ${FLIGHT_MS - 100}, at most ${FLIGHT_MS + 2_200})`);
      const project = await waitForProject(page, bead.id);
      const heading = await page.textContent('h1');
      step.check(project.kind === 'PROJECT_FOCUS' && project.id === bead.id && heading === bead.title, `${at}: ${how}: on the page the scene is PROJECT_FOCUS ${bead.id} and the heading is "${heading}" (got ${JSON.stringify(project)})`);
    };

    // 1 + 2. Each bead's stop: the label, Tab and Enter, Esc.
    for (const bead of BEAD_LIST) {
      const label = await arriveAt(bead);
      step.check(label !== null && label.shown && label.rest && label.opacity === 1 && labelInside(label), `${at}: at ${bead.id}'s stop, ${bead.stop}, the label shows whole inside the screen: ${label === null ? 'never shown' : `[${Object.values(label.box).map((v) => Math.round(v)).join(', ')}] in ${label.viewport.width}x${label.viewport.height}, margin ${labelMarginOf(label.viewport.width)} and the header ${HEADER_PX}`}`);
      const want = { category: categories.byId(bead.category).heading('nl'), title: bead.title, hintFine: dutch.hint, hintTouch: dutch.hintTouch };
      step.check(
        label !== null && label.category === want.category && label.title === want.title && label.hintFine === want.hintFine && label.hintTouch === want.hintTouch && label.href === bead.path,
        `${at}: and it says what the Dutch dictionary says, "${want.category}", "${want.title}", "${want.hintFine}" / "${want.hintTouch}", and links to ${bead.path} (got ${JSON.stringify(label && [label.category, label.title, label.hintFine, label.hintTouch, label.href])})`,
      );
      step.check(label !== null && label.fineShown === !touch && label.touchShown === touch, `${at}: and the hint for ${touch ? 'a finger' : 'a pointer'} is the one shown (pointer's ${label?.fineShown}, finger's ${label?.touchShown})`);

      await page.focus('a[href="#main"]');
      let reached = 0;
      for (let press = 1; press <= 14 && reached === 0; press++) {
        await page.keyboard.press('Tab');
        if (await page.evaluate((id) => document.activeElement?.getAttribute('data-bead') === id, bead.id)) reached = press;
      }
      const ringed = await page.evaluate(() => {
        const style = getComputedStyle(document.activeElement);
        return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2;
      });
      step.check(reached > 0 && ringed, `${at}: Tab from the skip link reaches ${bead.id}'s label after ${reached} presses, with a focus ring (outline 2 px or more)`);
      await opens(bead, 'Tab and Enter', () => page.keyboard.press('Enter'));
      await escapeTo(bead, 'Tab and Enter');
    }

    // 3. A click or a tap: on a label, and on a bead.
    const onLabel = BEAD_LIST[1];
    await arriveAt(onLabel);
    const labelAt = page.locator(`.bead-label[data-bead="${onLabel.id}"]`);
    await opens(onLabel, touch ? 'a tap on the label' : 'a click on the label', () => (touch ? labelAt.tap() : labelAt.click()));
    await backTo(onLabel, touch ? 'a tap on the label' : 'a click on the label');
    const onBead = BEAD_LIST[2];
    await arriveAt(onBead);
    const onScreen = (await debugOf(page)).journey.beads?.[onBead.index];
    const [beadX, beadY] = onScreen === undefined ? [size.width / 2, size.height / 2] : [onScreen.x, onScreen.y];
    await opens(onBead, touch ? 'a tap on the bead' : 'a click on the bead', () => (touch ? page.touchscreen.tap(beadX, beadY) : page.mouse.click(beadX, beadY)));
    await escapeTo(onBead, touch ? 'a tap on the bead' : 'a click on the bead');

    // Jontai Energy opened from its inside and from the look back: Back returns to the very place each time.
    const jontai = BEAD_LIST[1];
    for (const [place, where] of [
      [jontai.stop + 0.6, 'its inside'],
      [LOOK_STOP, 'the look back'],
    ]) {
      await page.evaluate((progress) => window.__needleDebug.set({ progress }), place);
      await settledState(page);
      const b = (await debugOf(page)).journey.beads?.[jontai.index];
      // A pointer comes onto the bead before it clicks: the hover follows it within a frame.
      if (!touch && b !== undefined) {
        await page.mouse.move(b.x, b.y);
        await page.waitForTimeout(300);
      }
      const how = `${touch ? 'a tap' : 'a click'} on its bead in ${where}`;
      await opens(jontai, how, () => (b === undefined ? Promise.resolve() : touch ? page.touchscreen.tap(b.x, b.y) : page.mouse.click(b.x, b.y)));
      await page.goBack();
      const backAt = await page
        .waitForFunction((place) => { const s = window.__needleDebug(); return s.progress === place && s.target === place; }, place, { timeout: 15_000 })
        .then(() => true, () => false);
      step.check(backAt && pathNow() === '/', `${at}: ${how}: Back returns to the very place it was opened from, ${place.toFixed(4)} (${backAt ? 'there' : JSON.stringify(await frameOf(page))})`);
      // The flight out of the porthole over before the next move: the opening's mark gone, the scroll's phase again.
      await page
        .waitForFunction(() => !document.documentElement.hasAttribute('data-bead-open') && window.__needleDebug().phase.kind === 'PROJECTS', null, { timeout: 5_000 })
        .catch(() => {});
    }

    // 4. All of it by client navigation.
    step.check(documents.length === 0, `${at}: all of it by client navigation, no document load (got ${documents.join(', ') || 'none'})`);

    // 5. A direct load of a project's page, then Esc.
    const direct = BEAD_LIST[2];
    await page.goto(`${BASE}${direct.path}?proof`, { waitUntil: 'load' });
    await stageReady(page);
    const onPage = await waitForProject(page, direct.id);
    const arrived = await landed(page).then(() => true, () => false);
    const voidAtEsc = await page.evaluate(() => window.__needleDebug().journey.voidState);
    documents.length = 0;
    const pressed = Date.now();
    await page.keyboard.press('Escape');
    const stopped = await waitForStop(page, direct.category, 25_000);
    const took = Date.now() - pressed;
    step.check(onPage.id === direct.id && arrived, `${at}: a direct load of ${direct.path} puts the scene on PROJECT_FOCUS ${direct.id} and the opening lands (got ${JSON.stringify(onPage)}, landed ${arrived})`);
    step.check(
      pathNow() === '/' && stopped.kind === 'PROJECTS' && stopped.category === direct.category && stopped.progress === direct.stop && stopped.target === direct.stop,
      `${at}: and Esc (the void ${voidAtEsc} when it was pressed) lands at stop ${direct.stop}, ${direct.id}'s, ${took} ms later (path ${pathNow()}, got ${JSON.stringify(stopped)})`,
    );
    const landedLabel = await waitForLabel(page, direct.id);
    step.check(landedLabel !== null && labelInside(landedLabel), `${at}: with its label shown whole inside the screen`);
    step.check(documents.length === 0, `${at}: by client navigation, no document load (got ${documents.join(', ') || 'none'})`);
    await takeCsp(page, step);
    await context.close();
    summary.push(`${at}: each bead's label (NL text, inside the screen), Tab and Enter, a ${touch ? 'tap' : 'click'} on a label and on a bead, Esc back to the stop, and a direct load then Esc to stop ${direct.stop} (${took} ms, void ${voidAtEsc})`);
  }
  return summary.join('; ');
}

/**
 * The hold (spec: the landing waits for the beads), at 1440x900 and 390x844 (touch): with `bob-beads.glb` held back, so
 * that the void stays `loading`, a long wheel (PUSH_NOTCHES; flicks on the phone) plays the light dive and rests at
 * LANDING_HOLD, the hand-over (way frame 256, where the path begins, on the journey's shot), the journey at its travel's start with
 * `voidState` `loading`, the light still and nothing creeping past it; a still of it (`m2/void-hold-<size>.png`) is gated
 * as a home still. Scrolling back from there moves the story at once (at 1440 exactly the notches' distance) and it rests
 * where the input stopped; down again it rests on the hold again. On release the void becomes `ready` and the story
 * goes on into the ring. A direct arrival at a project's page whose Esc is pressed while the file is held waits at the
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
    const held = await holdBeads(page);
    step.check(await landHome(page), `${at}: landed on the home with bob-beads.glb held back, the hero shown whole`);
    const loading = await waitForVoid(page, 'loading', 5_000);
    step.check(loading === 'loading' && held.asked() >= 1, `${at}: the page asked for the file (${held.asked()} requests) and the void is ${loading}`);
    if (!touch) await page.mouse.move(size.width / 2, size.height / 2);
    const vh = size.height;

    const pushed = await pushStory(page, cdp, 1, { notches: PUSH_NOTCHES, flicks: 16 });
    const rest = await settledState(page);
    step.check(
      near(rest.target, LANDING_HOLD, 1e-9) && rest.progress === rest.target && rest.journey.stretch === 'travel' && rest.journey.local === 0 && rest.journey.project === 0 && rest.journey.voidState === 'loading' && rest.phase.kind === 'PROJECTS',
      `${at}: a long push (${pushed}) plays the light dive and rests at LANDING_HOLD, ${LANDING_HOLD}: progress ${rest.progress}, target ${rest.target}, the journey ${rest.journey.stretch} ${rest.journey.local} toward bead ${rest.journey.project}, voidState ${rest.journey.voidState}, the phase ${rest.phase.kind}`,
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

    // The file is let through: the void becomes ready and the story goes on along the path.
    await held.release();
    const ready = await waitForVoid(page, 'ready');
    const through = await settledState(page);
    step.check(
      ready === 'ready' && through.target > LANDING_HOLD + 0.1 && through.progress === through.target && through.journey.voidState === 'ready' && ['travel', 'orbit', 'inside', 'look', 'sheet', 'end'].includes(through.journey.stretch),
      `${at}: let through, the void is ${ready} and the story goes on along the path: progress ${through.progress}, target ${through.target}, the journey ${through.journey.stretch} ${through.journey.local.toFixed(3)}`,
    );
    step.check(onJourneyShot(through, through.progress, aspect), `${at}: with the camera on the journey's shot there`);

    // A direct arrival at a project's page, Esc while the file is still held: it waits at the hold, then reaches the stop.
    const target = BEAD_LIST[2];
    const heldAgain = await holdBeads(page);
    await page.goto(`${BASE}${target.path}?proof`, { waitUntil: 'load' });
    await stageReady(page);
    const direct = await waitForProject(page, target.id);
    const settled = await landed(page).then(() => true, () => false);
    const stillLoading = await waitForVoid(page, 'loading', 10_000);
    step.check(
      direct.kind === 'PROJECT_FOCUS' && direct.id === target.id && settled && stillLoading === 'loading',
      `${at}: a direct load of ${target.path} with the file held puts the scene on PROJECT_FOCUS ${target.id}, the opening lands and the void is ${stillLoading} (got ${JSON.stringify(direct)}, landed ${settled})`,
    );
    await page.keyboard.press('Escape');
    await page.waitForURL(`${BASE}/`, { timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(1_500);
    const waiting = await debugOf(page);
    step.check(
      heldAgain.asked() >= 1 && new URL(page.url()).pathname === '/' && near(waiting.target, LANDING_HOLD, 1e-9) && waiting.progress === waiting.target && waiting.journey.voidState === 'loading',
      `${at}: a direct load of ${target.path} (the file held again, ${heldAgain.asked()} requests), then Esc: the story waits at the hold (progress ${waiting.progress}, target ${waiting.target}, voidState ${waiting.journey.voidState}, ${waiting.phase.kind})`,
    );
    await heldAgain.release();
    const stopped = await waitForStop(page, target.category, 20_000);
    step.check(
      stopped.kind === 'PROJECTS' && stopped.category === target.category && stopped.progress === target.stop && stopped.target === target.stop,
      `${at}: and let through it goes on to ${target.id}'s stop, ${target.stop} (got ${JSON.stringify(stopped)})`,
    );
    await takeCsp(page, step);
    await context.close();
    summary.push(`${at}: held, a long push (${pushed}) rests at ${LANDING_HOLD.toFixed(4)} loading, up and down again, let through it goes on along the path (${through.target.toFixed(3)}), and a direct arrival's Esc waits at the hold then reaches stop ${target.stop}`);
  }
  const rows = await gateLuma(browser, step, shots);
  step.luma = rows;
  return `${summary.join('; ')}; ${rows.length} stills (m2/void-hold-*), ${lumaSummary(rows, 'home')}`;
}

/**
 * The failure (spec §2.1), at 1440x900 and 390x844 (touch): with `bob-beads.glb` answering 404 the
 * void fails (`voidState` `failed`, `<html data-void>`), and the home goes on without it. At the home the nav stays hidden
 * as it is with 3D on; a long push plays the light dive and rests the scroll at LANDING_HOLD (the hand-over), and there
 * (`<html data-held>`) `.home-nav` shows, fixed over the foot of the screen, unclipped and opaque, its three links on
 * screen and each the element at its own middle, its end link with them; the skip button never shows; a still of it
 * (`m2/void-fail-<size>.png`) is gated as a home still. A link opens its project, and Esc brings the story back to the
 * hold, not to the bead's stop; scrolled back to the home the nav is hidden again and the SCROLL cue is back. The console has exactly one error for it, the browser's own report of the 404 (the
 * Void's own line is a warning, `[needle] the beads could not be loaded`, and there is one), per size.
 */
async function voidFail(browser, step) {
  mkdirSync(STILLS, { recursive: true });
  const shots = [];
  const summary = [];
  const report = (message) => /^Failed to load resource: the server responded with a status of 404/.test(message.text()) && BEADS_GLB.test(message.location().url ?? '');
  for (const size of STILL_SIZES) {
    const at = sizeName(size);
    const touch = size.options.hasTouch === true;
    const { context, page } = await openSeen(browser, step, size, report);
    const cdp = touch ? await context.newCDPSession(page) : null;
    const warnings = [];
    page.on('console', (message) => {
      if (message.type() === 'warning' && /^\[needle\] the beads could not be loaded/.test(message.text())) warnings.push(message.text());
    });
    let answered = 0;
    await page.route(BEADS_GLB, (route) => {
      answered++;
      return route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' });
    });
    const reportedBefore = step.expected.length;
    step.check(await landHome(page), `${at}: landed on the home with bob-beads.glb answering 404, the hero shown whole`);
    const failedState = await waitForVoid(page, 'failed', 10_000);
    step.check(failedState === 'failed' && answered >= 1, `${at}: the page asked for the file (${answered} requests) and the void failed (voidState ${failedState})`);
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
      near(rest.target, LANDING_HOLD, 1e-9) && rest.progress === rest.target && rest.phase.kind === 'PROJECTS' && rest.journey.stretch === 'travel' && rest.journey.local === 0 && rest.journey.voidState === 'failed',
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
      `${at}: with its three links on screen, each the element at its own middle (got ${JSON.stringify(nav.links)})`,
    );
    await page.waitForTimeout(500);
    const still = join(STILLS, `void-fail-${at}.png`);
    await page.screenshot({ path: still });
    const mask = await textMask(page);
    shots.push({ file: still, kind: 'home', mask });
    const control = join(STILLS, `void-control-fail-${at}.png`);
    await withoutCanvas(page, () => page.screenshot({ path: control }));
    shots.push({ file: control, kind: 'control', mask });

    // The home stays usable: a link opens its project, and Esc comes back to the hold, not to a bead the void never showed.
    await page.click('.home-nav a[href="/projects/funcial/"]');
    await page.waitForURL(`${BASE}/projects/funcial/`, { timeout: 5_000 });
    const opened = await waitForProject(page, 'funcial');
    step.check(opened.kind === 'PROJECT_FOCUS' && opened.id === 'funcial', `${at}: a link of the nav opens Funcial's page (got ${JSON.stringify(opened)})`);
    await page.keyboard.press('Escape');
    await page.waitForURL((url) => url.pathname === '/', { timeout: 5_000 }); // a page reached from the home steps back to /?proof
    const back = await settledState(page);
    step.check(
      near(back.target, LANDING_HOLD, 1e-9) && back.progress === back.target && back.journey.voidState === 'failed',
      `${at}: Esc brings the story back to the hold at ${LANDING_HOLD.toFixed(4)}, not to Funcial's stop (progress ${back.progress}, target ${back.target}, voidState ${back.journey.voidState})`,
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

    // The one reported error, and the Void's own line as a warning.
    step.check(
      step.expected.length - reportedBefore === 1 && warnings.length === 1,
      `${at}: the console has exactly one error for it, the browser's report of the 404 (${step.expected.length - reportedBefore}), and the Void's own line is a warning (${warnings.length}): ${step.expected.slice(reportedBefore).join(' | ')}`,
    );
    await takeCsp(page, step);
    await context.close();
    summary.push(`${at}: 404, the scroll holds at ${LANDING_HOLD.toFixed(4)} (${pushed}) with .home-nav shown and usable, no skip button, back at the home it is hidden again; one reported error, one warning`);
  }
  const rows = await gateLuma(browser, step, shots);
  step.luma = rows;
  return `${summary.join('; ')}; ${rows.filter((row) => row.kind !== 'control').length} stills (m2/void-fail-*) and ${rows.filter((row) => row.kind === 'control').length} negative controls, ${lumaSummary(rows, 'home')}`;
}

// ---------------------------------------------------------------- the void's stops by real input, and the cross-task paths

/** The sizes the void's stops are reached at by real input: a laptop, a window of a 1366x768 screen (an odd height), a phone. */
const STOP_SIZES = [
  STILL_SIZES[0],
  { width: 1366, height: 657, options: {} },
  STILL_SIZES[1],
];

/** The stop after `place` down the story, or the end. */
const nextStopAfter = (place) => stops(HOME_CHAPTERS).find((stop) => stop > place + 1e-6) ?? STORY_END;

/**
 * One deliberate swipe on a touch screen (CDP touch events): the finger moves `px` up the screen (a negative `px` down)
 * in 12 steps 16 ms apart along the middle, and stops 150 ms before it lifts, so the lift leaves no glide: the swipe's own
 * distance is all it moves the story.
 */
async function swipeStill(page, cdp, px) {
  const touch = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: 195, y }] });
  const from = px > 0 ? 650 : 250;
  await touch('touchStart', from);
  for (let i = 1; i <= 12; i++) {
    await touch('touchMove', from - (px * i) / 12);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(150);
  await touch('touchEnd');
}

// ---------------------------------------------------------------- the end page

/** `<html data-end>` once it is `state` (null: unset), waited for up to `timeout` ms; answers it as it then stands (null when unset). */
async function endViewAt(page, state, timeout = 8_000) {
  await page.waitForFunction((state) => document.documentElement.getAttribute('data-end') === state, state, { timeout }).catch(() => {});
  return page.evaluate(() => document.documentElement.getAttribute('data-end'));
}

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

/**
 * The end page (src/ui/EndPage.tsx) as the page shows it now: where the story is and its phase, `<html data-end>`, the
 * section's `inert` and whether it is shown at all (`checkVisibility`: not `display: none`, as it is with 3D on away from
 * the end, nor `visibility: hidden`), whether its title is seen whole inside the viewport, and the page's scroll and its bottom.
 */
const endPageOf = (page) =>
  page.evaluate(() => {
    const { progress, target, phase } = window.__needleDebug();
    const section = document.getElementById('end');
    const title = document.getElementById('end-title');
    const box = title?.getBoundingClientRect();
    return {
      progress,
      target,
      phase: phase.kind,
      end: document.documentElement.getAttribute('data-end'),
      inert: section?.inert ?? null,
      shown: section ? section.checkVisibility({ visibilityProperty: true }) : false,
      titleIn:
        box !== undefined &&
        box.height > 0 &&
        box.top >= 0 &&
        box.left >= 0 &&
        box.bottom <= window.innerHeight &&
        box.right <= window.innerWidth &&
        title.checkVisibility({ opacityProperty: true, visibilityProperty: true }),
      scrollY: window.scrollY,
      bottom: document.documentElement.scrollHeight - window.innerHeight,
    };
  });

/** The end page's state (`endPageOf`) as a line for a check's message. */
const endText = (s) => `story ${s.progress} → ${s.target} (${s.phase}), data-end ${s.end}, inert ${s.inert}, ${s.shown ? 'shown' : 'not shown'}, title in view ${s.titleIn}, scrollY ${s.scrollY} of ${s.bottom}`;

/** True when the story rests at the end page: progress and target on the end, `<html data-end="rest">`, the phase END. */
const restsAtEnd = (s) => s.progress === STORY_END && s.target === STORY_END && s.end === 'rest' && s.phase === 'END';

/**
 * Records, from now on in `window.__endFade`, what a move to or from the end page does: how often `<html data-step-fade>`
 * was set (a MutationObserver installed before the input, so a fade of 150 ms is not missed) and every progress a 5 ms
 * timer saw. `takeEndFade` reads the record and starts it afresh.
 */
const watchEndFade = (page) =>
  page.evaluate(() => {
    const record = { fades: 0, progress: new Set(), opacity: new Set() };
    window.__endFade = record;
    new MutationObserver((mutations) => {
      for (const mutation of mutations) if (mutation.oldValue === null) record.fades++; // it was not there: it was set
    }).observe(document.documentElement, { attributes: true, attributeOldValue: true, attributeFilter: ['data-step-fade'] });
    const end = document.getElementById('end');
    setInterval(() => {
      record.progress.add(window.__needleDebug().progress);
      record.opacity.add(Number(getComputedStyle(end).opacity));
    }, 5);
  });

/**
 * What watchEndFade recorded since it was started or last taken: the fades set, the progress seen, and the end page's
 * computed opacities (`fading`: those strictly between 0 and 1, the page caught part way through a fade, not cut in or out).
 */
const takeEndFade = (page) =>
  page.evaluate(() => {
    const record = window.__endFade;
    const opacity = [...record.opacity];
    const taken = { fades: record.fades, progress: [...record.progress], fading: opacity.filter((o) => o > 0 && o < 1).length, opacities: opacity.length };
    record.fades = 0;
    record.progress.clear();
    record.opacity.clear();
    return taken;
  });

/**
 * Waits until a step fade has lifted from the end page (no `<html data-step-fade>`, the page's computed opacity 1), up to
 * 3 s, so a record taken then holds the whole fade-in; the checks that follow judge what was seen.
 */
const fadeLifted = (page) =>
  page
    .waitForFunction(() => !document.documentElement.hasAttribute('data-step-fade') && getComputedStyle(document.getElementById('end')).opacity === '1', null, { timeout: 3_000 })
    .catch(() => {});

/**
 * How soon after the input that sends it there `<html data-end="rest">` must arrive, in seconds (Ruling 18): the move into
 * the night covers 99 % of its way about 2.55 s after a wheel notch, and the page is live from there. The arrival within
 * 1e-4 took about 4.3 s, the page looking arrived but inert, and its wheel the story's, for the last 1.8 s.
 */
const REST_WITHIN_S = 3.0;

/** How far the page's words may move between the last frame of the sheet's move and the first at rest, px (Ruling 18). */
const SEAM_PX = 0.5;

/**
 * Starts timing a move into the night, from now on in `window.__endArrival`: when the first wheel, key or finger came
 * (performance.now() in a capture listener on window, the first to hear it), when a finger lifted, when `<html
 * data-end>` first said `rest`, and the top of the end page's words (its first line, the label over the title, its
 * transform included: the sheet stands from the screen's top while it moves, a header higher than the page at rest, its
 * words where they stand at rest) on the last frame `moving` and the first `rest`: a MutationObserver on `data-end` and the style that carries `--end`, both written by
 * Home's end view in one frame, its callback after that frame's writes. `takeArrival` reads the record and stops it.
 */
const watchArrival = (page) =>
  page.evaluate(() => {
    window.__endArrivalStop?.();
    const record = { input: null, lift: null, rest: null, movingTop: null, movingEnd: null, restTop: null, moving: 0 };
    window.__endArrival = record;
    const first = () => {
      record.input ??= performance.now();
    };
    const lift = () => {
      record.lift = performance.now();
    };
    const options = { capture: true, passive: true };
    for (const type of ['wheel', 'keydown', 'touchstart']) window.addEventListener(type, first, options);
    window.addEventListener('touchend', lift, options);
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      if (record.rest !== null) return;
      const state = root.getAttribute('data-end');
      const top = document.getElementById('end').firstElementChild.getBoundingClientRect().top;
      if (state === 'moving') {
        record.movingTop = top;
        record.movingEnd = root.style.getPropertyValue('--end-rise');
        record.moving++;
      } else if (state === 'rest') {
        record.rest = performance.now();
        record.restTop = top;
      }
    });
    observer.observe(root, { attributes: true, attributeFilter: ['data-end', 'style'] });
    window.__endArrivalStop = () => {
      observer.disconnect();
      for (const type of ['wheel', 'keydown', 'touchstart']) window.removeEventListener(type, first, options);
      window.removeEventListener('touchend', lift, options);
      window.__endArrivalStop = undefined;
    };
  });

/** What watchArrival recorded, the recorder stopped: the times (ms, the page's clock) and the page's tops (px). */
const takeArrival = (page) =>
  page.evaluate(() => {
    window.__endArrivalStop?.();
    return { ...window.__endArrival };
  });

/** The progress samples strictly between `from` and `to` (with 0.01 to spare at each end): a camera move where none may be. */
const between = (samples, from, to) => samples.filter((p) => p > from + 0.01 && p < to - 0.01);

/**
 * Waits, polling every 10 ms (no requestAnimationFrame of the harness's), until `<html data-end>` says `moving` with the
 * story's progress at `from` or past it toward `to`; answers the progress then, or null if it never did within 8 s.
 */
const movingAt = (page, from, to) =>
  page
    .waitForFunction(
      ([from, to]) => {
        const { progress } = window.__needleDebug();
        return document.documentElement.getAttribute('data-end') === 'moving' && (to > from ? progress >= from : progress <= from) ? progress : false;
      },
      [from, to],
      { timeout: 8_000, polling: 10 },
    )
    .then((handle) => handle.jsonValue(), () => null);

/**
 * The end page's way in for a keyboard and a screen reader with the void ready (the final review's I2), at 1440x900: the
 * nav's `.end-link`, hidden with the nav while 3D is on and shown with it while it has the focus, as the nav's links are.
 * From the home's start Tab reaches it (from the skip link, within 20 presses), and focused it shows on screen, the
 * element at its own middle, with the dictionary's words. Enter takes the story from the home to the end page by End's own
 * path, the step fade (no progress between 1 and the end), and once it rests there the focus is on the page's title
 * (`#end-title`), the title in view at `scrollY` 0 (the Tab through the nav's links had scrolled the document to them);
 * the next Tab is the first question.
 *
 * Then 3D switched off there, by the header's switch (the final review's M1): the scene goes, and the end page stands in
 * the 3D-off home's flow after the hero and the project links. It is brought into view, `#end-title` inside the viewport
 * at a `scrollY` past 0, not left at the document's top, the hero's.
 */
async function navLinkToTheEnd(browser, step, nl) {
  const size = STILL_SIZES[0];
  const { context, page } = await openSeen(browser, step, size);
  step.check(await landHome(page), "the nav's link: landed on the home");
  await expectVoid(page, step, 'ready', "the nav's link: the void is ready");
  await page.mouse.move(size.width - 8, size.height - 8);
  await page.focus('a[href="#main"]');
  let presses = 0;
  const onLink = () => page.evaluate(() => document.activeElement?.classList.contains('end-link') === true);
  while (presses < 20 && !(await onLink())) {
    await page.keyboard.press('Tab');
    presses++;
  }
  const link = await page.evaluate(() => {
    const button = document.querySelector('.home-nav .end-link');
    const box = button?.getBoundingClientRect();
    const hit = box ? document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2) : null;
    return {
      focused: button !== null && document.activeElement === button,
      text: button?.textContent ?? null,
      shown: button?.checkVisibility({ opacityProperty: true, visibilityProperty: true }) ?? false,
      onScreen: box !== undefined && box.width > 1 && box.height > 1 && box.top >= 0 && box.bottom <= window.innerHeight,
      hit: hit !== null && (hit === button || button.contains(hit)),
      nav: Math.round(document.querySelector('.home-nav').getBoundingClientRect().height),
      progress: window.__needleDebug().progress,
    };
  });
  step.check(
    link.focused && link.shown && link.onScreen && link.hit && link.nav > 100 && link.text === nl.end.failLink && link.progress === 0,
    `the nav's link: with the void ready, Tab from the skip link reaches .end-link (${presses} presses) at the home, and focused it shows on screen as the nav's links do, the nav ${link.nav} px high, "${link.text}" (got ${JSON.stringify(link)})`,
  );
  await watchEndFade(page);
  await page.keyboard.press('Enter');
  const view = await endViewAt(page, 'rest', 20_000);
  await page.waitForTimeout(200); // the observer's focus, a task after the rest is written
  const way = await takeEndFade(page);
  const there = await endPageOf(page);
  const focus = await page.evaluate(() => document.activeElement?.id ?? null);
  const travelled = between(way.progress, 1, STORY_END).length;
  step.check(
    view === 'rest' && restsAtEnd(there) && way.fades >= 1 && travelled === 0,
    `the nav's link: Enter takes the story from the home to the end page by End's step fade (${travelled} of ${way.progress.length} progress samples between 1 and ${STORY_END}, data-step-fade set ${way.fades} times), and it rests there (${endText(there)})`,
  );
  step.check(
    focus === 'end-title' && there.titleIn && there.scrollY === 0,
    `the nav's link: at rest the focus is on the end page's title, in view at scrollY 0 (focus ${focus}, title in view ${there.titleIn}, scrollY ${there.scrollY})`,
  );
  await page.keyboard.press('Tab');
  const next = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName || null);
  step.check(next === 'contact-name', `the nav's link: the next Tab from "Q&A" reaches the form's first field, the questions being text (got ${next})`);

  // 3D switched off at the end: the page in the 3D-off home's flow, brought into view.
  await page.click('.site-header button[role="switch"]');
  await page
    .waitForFunction(() => document.documentElement.getAttribute('data-3d') === 'off' && !document.documentElement.hasAttribute('data-end') && !document.querySelector('.scene-host canvas'), null, { timeout: 5_000 })
    .catch(() => {});
  await page.waitForTimeout(300);
  const off = await page.evaluate(() => {
    const title = document.getElementById('end-title').getBoundingClientRect();
    return {
      threeD: document.documentElement.getAttribute('data-3d'),
      end: document.documentElement.getAttribute('data-end'),
      scrollY: window.scrollY,
      top: Math.round(title.top),
      bottom: Math.round(title.bottom),
      header: Math.round(document.querySelector('.site-header').getBoundingClientRect().bottom),
      titleIn: title.height > 0 && title.top >= 0 && title.bottom <= window.innerHeight,
    };
  });
  step.check(
    off.threeD === 'off' && off.end === null && off.titleIn && off.scrollY > 0,
    `3D switched off at the end: the end page is brought into view in the 3D-off home's flow, #end-title inside the viewport (top ${off.top}, bottom ${off.bottom}, the header's bottom ${off.header}) at scrollY ${off.scrollY}, not the hero at the top (got ${JSON.stringify(off)})`,
  );
  await takeCsp(page, step);
  await context.close();
}

/**
 * The quickest real way to the end page, at 1440x900 (Ruling 19): the pointer moved at the home, so the needle aims at it
 * and swings (its spring takes about 3.5 s to settle), then End, which reaches the end page in about 1.4 s. Once `<html
 * data-end="rest">` the page asks for no frame at all in 600 ms: at the end page the needle, out of view behind the page,
 * stands on its target. The positive controls: the pointer turned the needle (its angle moved in the 150 ms before End),
 * and the move asked for frames. Answers the line for the summary.
 */
async function endFromTheHome(browser, step) {
  const size = STILL_SIZES[0];
  const { context, page } = await openSeen(browser, step, size);
  await countAllFrames(context);
  step.check(await landHome(page), 'End from the home: landed on the home');
  await expectVoid(page, step, 'ready', 'End from the home: the void is ready');
  const needleAt = () => page.evaluate(() => window.__needleDebug().needleAngle);
  const before = await needleAt();
  await page.mouse.move(8, size.height - 8, { steps: 5 }); // the bottom left: a long way round from the drift's rest
  await page.waitForTimeout(150);
  const turned = await needleAt();
  const framesBefore = await page.evaluate(() => window.__allRaf);
  await page.keyboard.press('End');
  const view = await endViewAt(page, 'rest', 20_000);
  const there = await endPageOf(page);
  const moved = (await page.evaluate(() => window.__allRaf)) - framesBefore;
  await page.waitForTimeout(100); // past the frame that wrote the rest, and the one after it
  const from = await page.evaluate(() => window.__allRaf);
  await page.waitForTimeout(600);
  const frames = (await page.evaluate(() => window.__allRaf)) - from;
  step.check(
    Math.abs(turned - before) > 0.05 && moved > 0 && view === 'rest' && restsAtEnd(there),
    `End from the home: the pointer moved at the home turns the needle (${before.toFixed(3)} to ${turned.toFixed(3)} rad in 150 ms), and End takes the story to the end page, asking for frames (${moved}), where it rests (${endText(there)})`,
  );
  step.check(frames === 0, `End from the home: at rest the page asks for no frame at all in 600 ms, the needle's swing from the home stood on its target behind the page (got ${frames})`);
  await takeCsp(page, step);
  await context.close();
  return `End from the home after a pointer move rests asleep (${frames} frames in 600 ms)`;
}

/**
 * Part 10 of the end page's step (`endPage`), at 1440x900 and on the phone: a click (a tap) on the rising page during the
 * move into the night opens nothing. The page is inert while it moves, and an inert page lets the pointer through to
 * what lies under it, the scene, where Cookies Clicker's bead stands in the middle of the picture (where bead-open clicks
 * it); no bead reads the pointer once the night has begun (src/scene/bob/voidPose.ts `hoversAt`), so the click lands on
 * nothing. Pass: the URL stays on the home, and the story rests at the end page, `data-end` at rest.
 *
 * On a laptop the pointer stands on the bead from its stop on, so its hover is lit as the move begins: it eases out on
 * the way, and at rest the page asks for no frame in 600 ms. Then the same click on the way out, 6 to 5: the story rests
 * on Cookies Clicker's stop, on the home. On the phone the tap waits until the move is past half way: a finger set down
 * while a settle eases halts it there, and its lift settles on the nearer stop (the scroll's own rule for a finger,
 * src/input/scrollLoop.ts `onTouchDown`), so a tap in the first half takes the story back to 5, opening nothing either.
 */
async function pressThroughTheNight(page, step, { at, touch, size, cdp, toLook, allFrames }) {
  const middle = { x: size.width / 2, y: size.height / 2 };
  const press = () => (touch ? page.touchscreen.tap(middle.x, middle.y) : page.mouse.click(middle.x, middle.y));
  const how = touch ? 'a tap' : 'a click';
  const pathname = () => new URL(page.url()).pathname;
  if (!touch) await page.mouse.move(middle.x, middle.y); // over the look back's middle once the story stands at its stop
  await toLook();
  if (touch) await swipeStill(page, cdp, 300);
  else await page.mouse.wheel(0, RISE.notchPx);
  const pressedAt = await movingAt(page, touch ? LOOK_STOP + 0.6 : LOOK_STOP, STORY_END);
  await press();
  const view = await endViewAt(page, 'rest');
  await page.waitForTimeout(100); // past the frame that wrote the rest, and the one after it
  const from = await allFrames();
  await page.waitForTimeout(600);
  const frames = (await allFrames()) - from;
  await page.waitForTimeout(500); // a bead's flight (0.8 s from the press) would have left the home by now
  const there = await endPageOf(page);
  step.check(
    pressedAt !== null && view === 'rest' && restsAtEnd(there) && pathname() === '/',
    `${at}: ${how} on the rising page over the look back's middle, with data-end moving at progress ${pressedAt}, opens nothing: the story rests at the end page at ${pathname()}, <html data-end="${view}"> (${endText(there)})`,
  );
  if (touch) return;
  step.check(frames === 0, `${at}: the pointer over the look back's middle from its stop on: at rest the page asks for no frame in 600 ms, any hover gone on the way (got ${frames})`);

  // The way out: one notch up at the page's top, a new gesture, and the same click while the page goes.
  await page.waitForTimeout(GESTURE_GAP_MS + 50);
  await page.mouse.wheel(0, -RISE.notchPx);
  const outAt = await movingAt(page, STORY_END - 0.001, LOOK_STOP);
  await page.mouse.click(middle.x, middle.y);
  const back = await settledState(page).catch(() => debugOf(page)); // a story that never rests is the check's to report
  await page.waitForTimeout(1_000); // a bead's flight would have left the home by now
  const gone = await page.evaluate(() => document.documentElement.getAttribute('data-end'));
  step.check(
    outAt !== null && back.progress === LOOK_STOP && back.target === LOOK_STOP && gone === null && pathname() === '/' && back.phase.kind === 'PROJECTS',
    `${at}: ${how} on the page as it goes, the end to the look back (data-end moving at progress ${outAt}), opens nothing either: the story rests on the look back's stop at ${pathname()} (progress ${back.progress}, target ${back.target}, ${back.phase.kind}, data-end ${gone})`,
  );
}

/**
 * The end page (spec 2026-10-24-bob-end-page-design.md), the story's seventh stop and an ordinary page, by real input, at
 * 1440x900, 1366x657 and 390x844 (touch), each in a fresh context landed with the seen flag set and the void ready, the
 * story put on Cookies Clicker's stop through `.set` (the pointer parked in the bottom corner, off the beads and the header):
 *
 * 1. From there the end page is reached by real input alone: one wheel notch, and ArrowDown, on a laptop; one swipe on the
 *    phone. `<html data-end="rest">` arrives within REST_WITHIN_S of the input (of the swipe's lift), and the page's top
 *    moves at most SEAM_PX between the last frame of the move and the first at rest (Ruling 18). At rest `#end-title` is
 *    seen whole in the viewport, `.end-page` is not inert, and the page asks for no frame at all in 600 ms; a still,
 *    `m2/end-<size>.png`, is gated as a home still with the page's text masked as the void's stills mask it.
 * 2. The page's own scroll: three wheel notches down (three swipes) scroll it, the wheel not prevented, the story still at
 *    6; End reaches the page's bottom (a laptop); the wheel up (swipes down) brings it back to scrollY 0 with the story
 *    still at 6; one more notch (swipe), a new gesture after a pause at the top, goes back to 5 with Cookies Clicker's
 *    label shown whole at rest.
 * 3. A gesture begun in the page stays the page's: from scrollY 300 a burst of notches up with no pause (one long drag on
 *    the phone, lifted while moving) ends at scrollY 0 with the story still at 6.
 * 4. The questions: none open on arrival; a click (a tap) opens the first, one on the second opens it and closes the
 *    first, and its answer shows the Dutch dictionary's own answer, with no placeholder.
 * 5. An empty send shows the form's errors as on /contact/: `#contact-name-error` shown, the dictionary's three errors,
 *    the focus on the name, no mailto: navigation.
 * 6. Tab from the header's last control (the 3D switch; Menu on the phone) reaches the six questions, then the form's fields.
 * 7. At 1440 a resize to 1000x700 and back keeps the story at 6, `data-end` at rest and the title in view, at scrollY 0.
 * 8. A reload at the end, scrolled 300 px down, lands on the home: the story at 0, scrollY 0, no `data-end`, the page
 *    hidden and inert again.
 * 9. The header's name at the end, scrolled 300 px down, goes to the home: the story at 0, scrollY 0, no `data-end`.
 *
 * And at 1440x900, once each: /en/ (the title and the first question in English); the nav's link (`navLinkToTheEnd`);
 * End from the home just after a pointer move there, asleep at rest (`endFromTheHome`, Ruling 19); 3D off (`#end` in the home's flow after
 * `.home-nav`, reached by native wheel scroll); the void failed (bob-beads.glb answering 404: the scroll held at BOB from
 * above, the nav's `.end-link` button shows and goes to the end page by the step fade, no progress between, the focus on
 * its title, and ArrowUp at the page's top comes back to BOB from above by a fade); reduced motion (5 to 6 and back to 5,
 * each by a fade).
 */
async function endPage(browser, step) {
  mkdirSync(STILLS, { recursive: true });
  const shots = [];
  const summary = [];
  const nl = new Translator('nl').t;
  const en = new Translator('en').t;
  const places = stops(HOME_CHAPTERS);
  step.check(
    places.at(-1) === STORY_END && places.at(-2) === LOOK_STOP && JOURNEY_STOPS.at(-1).stretch === 'end' && JOURNEY_STOPS.at(-2).stretch === 'sheet',
    `the end page's stop, ${STORY_END}, is the story's last, right after the look back's own, ${LOOK_STOP} (stops ${JSON.stringify(places)})`,
  );
  const corner = (size) => ({ x: size.width - 8, y: size.height - 8 });

  for (const size of STOP_SIZES) {
    const at = sizeName(size);
    const touch = size.options.hasTouch === true;
    const { context, page } = await openSeen(browser, step, size);
    await countAllFrames(context);
    await recordMailto(context);
    const cdp = touch ? await context.newCDPSession(page) : null;
    /** A click on a laptop, a tap on the phone. */
    const press = (locator) => (touch ? locator.tap() : locator.click());
    step.check(await landHome(page), `${at}: landed on the home, the hero shown whole`);
    await expectVoid(page, step, 'ready', `${at}: the void under the glass is ready`);
    // The pointer out of the way: a bead under it at the look back would keep its hover drawing past the rest.
    if (!touch) await page.mouse.move(corner(size).x, corner(size).y);
    await page.evaluate(() => {
      window.__endWheels = [];
      // A listener on window runs after the input's on the document element, so it sees the final defaultPrevented.
      window.addEventListener('wheel', (event) => window.__endWheels.push(event.defaultPrevented), { passive: true });
    });
    const takeWheels = () => page.evaluate(() => window.__endWheels.splice(0));

    /** The story put on the look back's own stop, at rest: the bridge's state there. */
    const toLook = async () => {
      await page.evaluate((progress) => window.__needleDebug.set({ progress }), LOOK_STOP);
      return settledState(page);
    };
    /** The page's count of requestAnimationFrame calls so far (countAllFrames). */
    const allFrames = () => page.evaluate(() => window.__allRaf);
    /** When the end page came to rest after each input of part 1 (Ruling 18), for the summary. */
    const restTimes = [];
    /**
     * The checks at rest at the end page, after `how` brought the story there; `framesBefore` is the page's frame count
     * before the input, which came with `watchArrival` started. The move asked for frames (the positive control of the
     * quiet that follows: a count that never moved could not tell a sleeping scene from a counter that sees nothing).
     * `<html data-end="rest">` arrives within REST_WITHIN_S of the input (of the swipe's lift on the phone), and the
     * page's top moves no more than SEAM_PX between the last frame of the move and the first at rest (Ruling 18).
     */
    const atRest = async (how, framesBefore) => {
      const view = await endViewAt(page, 'rest');
      const arrival = await takeArrival(page);
      const state = await endPageOf(page);
      const moved = (await allFrames()) - framesBefore;
      step.check(moved > 0, `${at}: ${how}: the move to the end page asked for frames, as the count sees (${moved})`);
      step.check(view === 'rest' && restsAtEnd(state), `${at}: ${how} from the look back's stop reaches the end page and rests there: <html data-end="${view}"> (${endText(state)})`);
      // A notch or a key is an instant; a swipe ends at its lift, where the settle takes the story on. The swipe's own length
      // is the visitor's (swipeStill holds the finger still 150 ms before it, and its moves go out one CDP call at a time:
      // about 0.65 s from the first touch), so the time runs from the lift.
      const sent = touch ? arrival.lift : arrival.input;
      const after = sent !== null && arrival.rest !== null ? (arrival.rest - sent) / 1000 : null;
      const touched =
        touch && arrival.input !== null && arrival.lift !== null ? ` (the swipe's own length, ${((arrival.lift - arrival.input) / 1000).toFixed(2)} s from its first touch, is the visitor's)` : '';
      restTimes.push(`${how} ${after === null ? 'never' : `${after.toFixed(2)} s`}`);
      step.check(
        after !== null && after <= REST_WITHIN_S,
        `${at}: ${how}: <html data-end="rest"> arrives ${after === null ? 'never (input or rest not seen)' : `${after.toFixed(2)} s`} after the ${touch ? "swipe's lift" : 'input'}${touched}, within ${REST_WITHIN_S} s: the page is live once it looks arrived`,
      );
      const seam = arrival.movingTop !== null && arrival.restTop !== null ? Math.abs(arrival.restTop - arrival.movingTop) : null;
      step.check(
        seam !== null && arrival.moving > 10 && seam <= SEAM_PX,
        `${at}: ${how}: the seam: the page's top on the last frame of the move (${arrival.movingTop}, --end-rise ${arrival.movingEnd}, ${arrival.moving} frames moving) and on the first at rest (${arrival.restTop}) differ by ${seam === null ? 'unknown' : seam.toPrecision(3)} px, at most ${SEAM_PX}`,
      );
      step.check(state.titleIn, `${at}: ${how}: at rest #end-title is seen whole inside the viewport`);
      step.check(state.inert === false, `${at}: ${how}: at rest .end-page is not inert (inert ${state.inert})`);
      await page.waitForTimeout(100); // past the frame that wrote the rest, and the one after it
      const from = await page.evaluate(() => window.__allRaf);
      await page.waitForTimeout(600);
      const frames = (await page.evaluate(() => window.__allRaf)) - from;
      step.check(frames === 0, `${at}: ${how}: at rest the page asks for no frame at all in 600 ms, the scene asleep behind it (got ${frames})`);
    };

    // 1. One wheel notch, or one swipe, from the look back's own stop.
    const look = await toLook();
    step.check(look.progress === LOOK_STOP && look.journey.stretch === 'sheet' && look.journey.sheet === 0, `${at}: on the look back's own stop, ${LOOK_STOP} (${look.journey.stretch}, sheet ${look.journey.sheet})`);
    const first = touch ? 'one swipe' : 'one wheel notch';
    const beforeFirst = await allFrames();
    await watchArrival(page);
    if (touch) await swipeStill(page, cdp, 300);
    else await page.mouse.wheel(0, RISE.notchPx);
    await atRest(first, beforeFirst);
    const still = join(STILLS, `end-${at}.png`);
    await page.screenshot({ path: still });
    shots.push({ file: still, kind: 'home', mask: await textMask(page) });

    // 2. The page's own scroll: down, to its bottom, back to its top, and a new gesture at the top back to the look back.
    await takeWheels();
    if (touch) {
      for (let i = 0; i < 3; i++) await swipeStill(page, cdp, 300);
    } else {
      for (let i = 0; i < 3; i++) {
        await page.mouse.wheel(0, RISE.notchPx);
        await page.waitForTimeout(RISE.notchGapMs);
      }
    }
    const down = await scrollSettled(page);
    const scrolled = await endPageOf(page);
    const wheels = await takeWheels();
    step.check(
      down > 0 && restsAtEnd(scrolled) && (touch || (wheels.length === 3 && wheels.every((prevented) => !prevented))),
      `${at}: three ${touch ? 'swipes up the glass' : 'wheel notches down'} scroll the page itself to scrollY ${down} while the story stays at the end${touch ? '' : `, the wheel not prevented (${JSON.stringify(wheels)})`} (${endText(scrolled)})`,
    );
    if (!touch) {
      await page.keyboard.press('End');
      const bottom = await scrollSettled(page);
      const atBottom = await endPageOf(page);
      step.check(atBottom.bottom > 0 && Math.abs(bottom - atBottom.bottom) <= 1 && restsAtEnd(atBottom), `${at}: End reaches the page's bottom, scrollY ${bottom} of ${atBottom.bottom}, the story still at the end`);
    }
    let upBy = '';
    if (touch) {
      let swipes = 0;
      for (; swipes < 12 && (await page.evaluate(() => window.scrollY)) > 0; swipes++) {
        await swipeStill(page, cdp, -300);
        await scrollSettled(page);
      }
      upBy = `${swipes} swipes down the glass, each one gesture,`;
    } else {
      const notches = Math.ceil((await page.evaluate(() => window.scrollY)) / RISE.notchPx) + 4;
      for (let i = 0; i < notches; i++) {
        await page.mouse.wheel(0, -RISE.notchPx);
        await page.waitForTimeout(RISE.notchGapMs);
      }
      upBy = `${notches} wheel notches up, one gesture that reaches the top with notches to spare,`;
    }
    const top = await scrollSettled(page);
    await page.waitForTimeout(GESTURE_GAP_MS + 100); // the gesture's quiet: whatever it would settle, it has
    const atTop = await endPageOf(page);
    step.check(top === 0 && restsAtEnd(atTop), `${at}: ${upBy} bring the page back to scrollY ${top}, and the story is still at the end (${endText(atTop)})`);
    await page.waitForTimeout(GESTURE_GAP_MS + 50); // a new gesture, after a pause
    if (touch) await swipeStill(page, cdp, -300);
    else await page.mouse.wheel(0, -RISE.notchPx);
    const back = await settledState(page);
    const gone = await endViewAt(page, null);
    step.check(
      back.progress === LOOK_STOP && back.target === LOOK_STOP && gone === null && back.journey.sheet === 0,
      `${at}: one more ${touch ? 'swipe down' : 'notch up'}, a new gesture after a pause at the page's top, goes back to the look back's own stop, ${LOOK_STOP}, at rest (progress ${back.progress}, target ${back.target}, data-end ${gone}, sheet ${back.journey.sheet})`,
    );

    // ArrowDown from the look back's stop on a laptop; on the phone a swipe again, as a phone has no keys.
    const second = touch ? 'a swipe again' : 'ArrowDown';
    const beforeSecond = await allFrames();
    await watchArrival(page);
    if (touch) await swipeStill(page, cdp, 300);
    else await page.keyboard.press('ArrowDown');
    await atRest(second, beforeSecond);

    // 3. A gesture begun in the page is the page's to its end, past the page's top too.
    await page.evaluate(() => window.scrollTo(0, 300));
    const from = await scrollSettled(page);
    await page.waitForTimeout(GESTURE_GAP_MS + 50);
    if (touch) {
      await swipe(page, cdp, 150, 750);
    } else {
      for (let i = 0; i < 12; i++) {
        await page.mouse.wheel(0, -RISE.notchPx);
        await page.waitForTimeout(RISE.notchGapMs);
      }
    }
    const burstTop = await scrollSettled(page);
    await page.waitForTimeout(GESTURE_GAP_MS * 2);
    const burst = await endPageOf(page);
    step.check(
      Math.abs(from - 300) <= 1 && burstTop === 0 && restsAtEnd(burst),
      `${at}: keeps a gesture begun in the page with the page: from scrollY ${from}, ${touch ? 'one drag down of 600 px, lifted while moving,' : `a burst of 12 notches up (${12 * RISE.notchPx} px) with no pause`} ends at scrollY ${burstTop} with the story still at the end (${endText(burst)})`,
    );

    // 7. A resize at the end keeps the page (a laptop's window; a phone turned is the same rule).
    if (size.width === STILL_SIZES[0].width && size.height === STILL_SIZES[0].height) {
      for (const viewport of [{ width: 1000, height: 700 }, { width: size.width, height: size.height }]) {
        await page.setViewportSize(viewport);
        await page.waitForTimeout(600);
        const resized = await endPageOf(page);
        step.check(
          restsAtEnd(resized) && resized.titleIn && resized.scrollY === 0,
          `${at}: a resize at the end keeps the page: at ${viewport.width}x${viewport.height} the story stays at ${resized.progress}, data-end ${resized.end}, #end-title in view ${resized.titleIn}, scrollY ${resized.scrollY}`,
        );
      }
    }

    // 4. The questions: all six there at once, each with its answer, nothing to open.
    const read = await page.evaluate(() => ({
      asked: [...document.querySelectorAll('#end .end-q')].map((q) => q.textContent),
      answers: [...document.querySelectorAll('#end .end-a')].map((a) => ({ text: a.textContent, placeholder: a.classList.contains('is-placeholder'), seen: a.checkVisibility({ opacityProperty: true, visibilityProperty: true }) })),
      opening: document.querySelectorAll('#end details, #end summary').length,
    }));
    step.check(
      JSON.stringify(read.asked) === JSON.stringify(nl.end.questions.map((q) => q.question)) && read.opening === 0,
      `${at}: the credits ask the Dutch dictionary's ${nl.end.questions.length} questions, nothing to open or close (${read.opening} details)`,
    );
    step.check(
      JSON.stringify(read.answers.map((a) => a.text)) === JSON.stringify(nl.end.questions.map((q) => q.answer)) && read.answers.every((a) => !a.placeholder && a.seen),
      `${at}: each answer under its question, shown, the Dutch dictionary's own, with no placeholder`,
    );

    // 5. An empty send. The build has no Web3Forms key, so the form is the page's own once it has hydrated (its mailto:
    // mode, as on /contact/), and the mailto: navigation it could make is recorded and cancelled (recordMailto).
    const hydrated = await page.waitForFunction(() => document.querySelector('#end form.form')?.noValidate === true, null, { timeout: 10_000 }).then(() => true, () => false);
    step.check(hydrated, `${at}: the end page's form is there, the page hydrated (no access key in this build: the mailto: mode, as on /contact/)`);
    await press(page.locator('#end button[type="submit"]'));
    await page.waitForTimeout(200);
    const empty = await page.evaluate(() => {
      const error = document.getElementById('contact-name-error');
      return {
        shown: error?.checkVisibility({ opacityProperty: true, visibilityProperty: true }) ?? false,
        text: error?.textContent ?? null,
        errors: [...document.querySelectorAll('#end .field-error')].map((el) => el.textContent),
        focus: document.activeElement?.id ?? null,
        mailto: window.__mailto.length,
        names: document.querySelectorAll('#contact-name').length,
      };
    });
    const c = nl.contact;
    step.check(empty.shown && empty.text === c.errors.name, `${at}: an empty send shows the form's errors: #contact-name-error shown, "${empty.text}"`);
    step.check(
      JSON.stringify(empty.errors) === JSON.stringify([c.errors.name, c.errors.email, c.errors.message]) && empty.focus === 'contact-name' && empty.mailto === 0 && empty.names === 1,
      `${at}: as on /contact/: the dictionary's errors for the name, the email and the message, the focus on the name field, no mailto: navigation, and one #contact-name in the page (got ${JSON.stringify(empty)})`,
    );

    // 6. Tab from the header at the end.
    const lastControl = touch ? '.site-header .menu-toggle' : '.site-header button[role="switch"]';
    await page.focus(lastControl);
    const tabbed = [];
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
      tabbed.push(
        await page.evaluate(() => {
          const el = document.activeElement;
          return el?.id || el?.tagName || null;
        }),
      );
    }
    const tabWant = ['contact-name', 'contact-email', 'contact-subject', 'contact-message'];
    step.check(
      JSON.stringify(tabbed) === JSON.stringify(tabWant),
      `${at}: Tab from the header's last control (${touch ? 'Menu' : 'the 3D switch'}) at the end reaches the form's fields, in order: the questions are text, nothing to focus (got ${tabbed.join(', ')})`,
    );

    // 8. A reload at the end, the page scrolled down.
    await page.evaluate(() => {
      document.activeElement?.blur?.();
      window.scrollTo(0, 300);
    });
    const reloadFrom = await scrollSettled(page);
    const beforeReload = await endPageOf(page);
    await takeCsp(page, step);
    await page.reload({ waitUntil: 'load' });
    const relanded = await reachHomeIdle(page).then(() => true, () => false);
    await page.waitForTimeout(1_000); // a late scroll restoration would have moved the page by now
    const reloaded = await endPageOf(page);
    step.check(
      Math.abs(reloadFrom - 300) <= 1 &&
        restsAtEnd(beforeReload) &&
        relanded &&
        reloaded.progress === 0 &&
        reloaded.target === 0 &&
        reloaded.phase === 'HOME_IDLE' &&
        reloaded.scrollY === 0 &&
        reloaded.end === null &&
        reloaded.inert === true &&
        reloaded.shown === false,
      `${at}: a reload at the end (scrollY ${reloadFrom}) lands on the home, nothing of the end page left: ${endText(reloaded)}`,
    );

    // 9. The header's name at the end, the page scrolled down.
    await expectVoid(page, step, 'ready', `${at}: after the reload the void is ready again`);
    if (!touch) await page.mouse.move(corner(size).x, corner(size).y);
    await toLook();
    if (touch) await swipeStill(page, cdp, 300);
    else await page.mouse.wheel(0, RISE.notchPx);
    const atEndAgain = await endViewAt(page, 'rest');
    await page.evaluate(() => window.scrollTo(0, 300));
    const nameFrom = await scrollSettled(page);
    await press(page.locator('.site-header .site-name'));
    await page
      .waitForFunction(
        () => {
          const { progress, target } = window.__needleDebug();
          return progress === 0 && target === 0 && window.scrollY === 0 && !document.documentElement.hasAttribute('data-end');
        },
        null,
        { timeout: 8_000 },
      )
      .catch(() => {});
    const named = await endPageOf(page);
    step.check(
      atEndAgain === 'rest' && Math.abs(nameFrom - 300) <= 1 && named.progress === 0 && named.target === 0 && named.scrollY === 0 && named.end === null,
      `${at}: the header's name at the end (data-end ${atEndAgain}, scrollY ${nameFrom}) goes to the home: ${endText(named)}, at ${new URL(page.url()).pathname}`,
    );

    // 10. A click or a tap on the rising page during the move into the night opens nothing (1440 and the phone).
    const pressed = touch || (size.width === STILL_SIZES[0].width && size.height === STILL_SIZES[0].height);
    if (pressed) await pressThroughTheNight(page, step, { at, touch, size, cdp, toLook, allFrames });
    await takeCsp(page, step);
    await context.close();
    summary.push(
      `${at}: ${first} and ${second} from the look back rest at the end asleep (at rest after ${restTimes.join(', ')}); the page scrolls (to ${down} px${touch ? '' : ', End to its bottom'}) and back with the story at the end, a new gesture at the top back to the look back; a burst from 300 px stays the page's; the questions, an empty send, Tab, ${size.width === STILL_SIZES[0].width && !touch ? 'a resize, ' : ''}a reload and the header's name${pressed ? `; a ${touch ? 'tap' : 'click'} on the rising page opens nothing${touch ? '' : ', in and out, the hover gone before the rest'}` : ''}`,
    );
  }

  // /en/ at the end.
  {
    const size = STILL_SIZES[0];
    const { context, page } = await openSeen(browser, step, size);
    step.check(await landHome(page, '/en/'), '/en/: landed on the English home');
    await expectVoid(page, step, 'ready', '/en/: the void is ready');
    await page.mouse.move(corner(size).x, corner(size).y);
    await page.evaluate((progress) => window.__needleDebug.set({ progress }), LOOK_STOP);
    await settledState(page);
    await page.keyboard.press('ArrowDown');
    const view = await endViewAt(page, 'rest');
    const words = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      title: document.getElementById('end-title')?.textContent ?? null,
      first: document.querySelector('#end .end-q')?.textContent ?? null,
    }));
    step.check(
      view === 'rest' && words.lang === 'en' && words.title === en.end.head && words.first === en.end.questions[0].question,
      `/en/: at the end page (data-end ${view}) "${en.end.head}" and the first question are the English dictionary's, "${en.end.questions[0].question}" (got ${JSON.stringify(words)})`,
    );
    await takeCsp(page, step);
    await context.close();
  }

  // The nav's link to the end page with the void ready, a keyboard's and a screen reader's way there from the home; then
  // 3D switched off at the end.
  await navLinkToTheEnd(browser, step, nl);

  // End from the home just after a pointer move there: the needle's swing does not keep the canvas drawing at the end.
  const fromHome = await endFromTheHome(browser, step);

  // 3D off: the end page in the home's flow, after the project links, reached by the page's own scroll.
  {
    const { context, page } = await openPage(browser, step);
    await context.addInitScript(() => localStorage.setItem('needle-3d', 'off'));
    await page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
    const landed = await reachHomeIdle(page).then(() => true, () => false);
    await page.waitForTimeout(500);
    const flow = await page.evaluate(() => {
      const nav = document.querySelector('.home-nav');
      const end = document.getElementById('end');
      const navBox = nav.getBoundingClientRect();
      const endBox = end.getBoundingClientRect();
      const style = getComputedStyle(end);
      return {
        threeD: document.documentElement.dataset['3d'] ?? null,
        after: Boolean(nav.compareDocumentPosition(end) & Node.DOCUMENT_POSITION_FOLLOWING),
        below: endBox.top >= navBox.bottom - 1,
        position: style.position,
        visibility: style.visibility,
        inert: end.inert,
        end: document.documentElement.getAttribute('data-end'),
        canvases: document.querySelectorAll('canvas').length,
      };
    });
    step.check(
      landed && flow.threeD === 'off' && flow.after && flow.below && flow.position === 'static' && flow.visibility === 'visible' && !flow.inert && flow.end === null && flow.canvases === 0,
      `3D off: / shows #end in the home's flow after .home-nav, below it, shown and not inert, with no scene (got ${JSON.stringify(flow)})`,
    );
    await page.mouse.move(720, 450);
    await page.evaluate(() => {
      window.__endWheels = [];
      window.addEventListener('wheel', (event) => window.__endWheels.push(event.defaultPrevented), { passive: true });
    });
    let seen = false;
    for (let i = 0; i < 30 && !seen; i++) {
      await page.mouse.wheel(0, 400);
      await scrollSettled(page);
      seen = await page.evaluate(() => {
        const box = document.getElementById('end-title').getBoundingClientRect();
        return box.top >= 0 && box.bottom <= window.innerHeight;
      });
    }
    const native = await page.evaluate(() => ({ y: window.scrollY, wheels: window.__endWheels, target: window.__needleDebug().target }));
    step.check(
      seen && native.y > 0 && native.wheels.length > 0 && native.wheels.every((prevented) => !prevented) && native.target === 0,
      `3D off: real wheel notches scroll the home natively down to the end page's title (scrollY ${native.y}, ${native.wheels.length} wheels, none prevented, the story's target ${native.target})`,
    );
    await takeCsp(page, step);
    await context.close();
  }

  // The void failed: the nav's link to the end page, by the step fade, and back up by a fade.
  {
    const size = STILL_SIZES[0];
    const report = (message) => /^Failed to load resource: the server responded with a status of 404/.test(message.text()) && BEADS_GLB.test(message.location().url ?? '');
    const { context, page } = await openSeen(browser, step, size, report);
    await page.route(BEADS_GLB, (route) => route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' }));
    const reportedBefore = step.expected.length;
    step.check(await landHome(page), 'void failed: landed on the home with bob-beads.glb answering 404');
    const failed = await waitForVoid(page, 'failed', 10_000);
    await page.mouse.move(size.width / 2, size.height / 2);
    await pushStory(page, null, 1, { notches: PUSH_NOTCHES });
    const held = await settledState(page);
    const link = await page.evaluate(() => {
      const button = document.querySelector('.home-nav .end-link');
      const box = button?.getBoundingClientRect();
      const hit = box ? document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2) : null;
      return {
        void: document.documentElement.dataset.void ?? null,
        text: button?.textContent ?? null,
        shown: button?.checkVisibility({ opacityProperty: true, visibilityProperty: true }) ?? false,
        onScreen: box !== undefined && box.height > 0 && box.top >= 0 && box.bottom <= window.innerHeight,
        hit: hit !== null && (hit === button || button.contains(hit)),
      };
    });
    step.check(
      failed === 'failed' && link.void === 'failed' && near(held.target, LANDING_HOLD, 1e-9) && held.progress === held.target && link.shown && link.onScreen && link.hit && link.text === nl.end.failLink,
      `void failed: the scroll holds at the landing, ${LANDING_HOLD.toFixed(4)} (progress ${held.progress}), and the nav's .end-link button shows on screen, "${nl.end.failLink}", the element at its own middle (got ${JSON.stringify(link)})`,
    );
    await watchEndFade(page);
    await page.click('.home-nav .end-link');
    await page.mouse.move(corner(size).x, corner(size).y); // off the button, whose hover is gold
    const view = await endViewAt(page, 'rest');
    await fadeLifted(page);
    const into = await takeEndFade(page);
    const there = await endPageOf(page);
    const focus = await page.evaluate(() => document.activeElement?.id ?? null);
    const travelIn = between(into.progress, LANDING_HOLD, STORY_END);
    step.check(
      view === 'rest' && restsAtEnd(there) && into.fades >= 1 && into.progress.length > 0 && travelIn.length === 0,
      `void failed: the button goes to the end page by a fade: <html data-step-fade> set ${into.fades} time(s), no progress between ${LANDING_HOLD} and ${STORY_END} (${travelIn.length} of ${into.progress.length} samples between), and it rests there (${endText(there)})`,
    );
    step.check(into.fading > 0, `void failed: the end page fades in with the scene, not cut in: ${into.fading} of ${into.opacities} opacities seen strictly between 0 and 1`);
    step.check(focus === 'end-title', `void failed: after the button's move the focus is on the end page's title (got ${focus})`);
    await page.keyboard.press('ArrowUp');
    const upFrom = await settledState(page);
    const gone = await endViewAt(page, null);
    const out = await takeEndFade(page);
    const travelOut = between(out.progress, LANDING_HOLD, STORY_END);
    step.check(
      near(upFrom.target, LANDING_HOLD, 1e-9) && upFrom.progress === upFrom.target && gone === null && out.fades >= 1 && out.progress.length > 0 && travelOut.length === 0,
      `void failed: ArrowUp at the page's top comes back to the landing hold, ${LANDING_HOLD.toFixed(4)}, by a fade (data-step-fade set ${out.fades} time(s), ${travelOut.length} of ${out.progress.length} progress samples between), data-end ${gone} (progress ${upFrom.progress}, target ${upFrom.target})`,
    );
    step.check(out.fading > 0, `void failed: the end page fades out with the scene, not cut out: ${out.fading} of ${out.opacities} opacities seen strictly between 0 and 1`);
    step.check(step.expected.length - reportedBefore === 1, `void failed: the console has one error for it, the browser's report of the 404 (${step.expected.slice(reportedBefore).join(' | ')})`);
    await takeCsp(page, step);
    await context.close();
  }

  // Reduced motion: to the end page and back by fades.
  {
    const size = STILL_SIZES[0];
    const { context, page } = await openPage(browser, step, () => false, { width: size.width, height: size.height }, { reducedMotion: 'reduce' });
    await context.addInitScript((key) => localStorage.setItem(key, '1'), LOADER_SEEN_KEY);
    step.check(await landHome(page), 'reduced motion: landed on the home');
    await expectVoid(page, step, 'ready', 'reduced motion: the void is ready');
    await page.mouse.move(corner(size).x, corner(size).y);
    await page.evaluate((progress) => window.__needleDebug.set({ progress }), LOOK_STOP);
    await settledState(page);
    await watchEndFade(page);
    await page.mouse.wheel(0, RISE.notchPx);
    // The fade jumps the scene to the end page while the story's progress still eases under it: the rest is read once
    // both are there, the end view's and the story's.
    const view = await endViewAt(page, 'rest');
    await settledState(page);
    await fadeLifted(page);
    const into = await takeEndFade(page);
    const there = await endPageOf(page);
    step.check(
      view === 'rest' && restsAtEnd(there) && into.fades >= 1,
      `reduced motion: one wheel notch from the look back's stop goes to the end page by a fade (<html data-step-fade> set ${into.fades} time(s)) and rests there (${endText(there)})`,
    );
    step.check(into.fading > 0, `reduced motion: the end page fades in with the scene, not cut in: ${into.fading} of ${into.opacities} opacities seen strictly between 0 and 1`);
    await page.waitForTimeout(GESTURE_GAP_MS + 50); // a new gesture
    await page.mouse.wheel(0, -RISE.notchPx);
    const gone = await endViewAt(page, null);
    const back = await settledState(page);
    const out = await takeEndFade(page);
    step.check(
      gone === null && back.progress === LOOK_STOP && back.target === LOOK_STOP && out.fades >= 1,
      `reduced motion: and one notch up at the page's top comes back to the look back's stop, ${LOOK_STOP}, by a fade (data-step-fade set ${out.fades} time(s)) (progress ${back.progress}, data-end ${gone})`,
    );
    step.check(out.fading > 0, `reduced motion: the end page fades out with the scene, not cut out: ${out.fading} of ${out.opacities} opacities seen strictly between 0 and 1`);
    await takeCsp(page, step);
    await context.close();
  }
  summary.push(`/en/ in English; the nav's link from the home with the focus to the title, and 3D switched off there in view; ${fromHome}; 3D off in the flow; a failed void by its link and back by fades; reduced motion by fades`);

  const rows = await gateLuma(browser, step, shots);
  step.luma = rows;
  return `${summary.join('; ')}; ${rows.length} stills (m2/end-*), ${lumaSummary(rows, 'home')}`;
}

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
    // The camera of the first frame that poses the journey stands on that frame's shot (the same-frame check): on the
    // rise, in the fall, and on the path in a travel and an orbit, where the camera moves fastest.
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
      down.push(s.journey.stretch === 'light' ? s.journey.frame : s.journey.stretch === 'travel' ? 257 : s.journey.stretch === 'rise' ? 0 : 999);
      if (s.journey.stretch === 'travel') break;
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
    const sleptIn = await sleepWithin(page, 4_000);
    const onStop = keyStops(HOME_CHAPTERS).some((stop) => near(stop, rest.target, 1e-3));
    step.check(!onStop && rest.target > placeOfFrame(140) && rest.target < PATH_START, `${at}: two inputs from way frame 140 rest where they stopped, ${rest.target.toFixed(4)}, not on a stop`);
    step.check(sleptIn !== null && sleptIn <= 1_000, `${at}: at rest mid-fall the canvas sleeps within a second (asked for no frame from ${sleptIn} ms on)`);
    summary.push(`${at}: the light within ${worst.toFixed(1)} px of the data, ${down.length} inputs to the path`);
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
            step.check(luma.mean <= 0.05, `${at}: the picture under fact 0${i + 1}'s line is dark, mean luma ${luma.mean.toFixed(4)}, at most 0.05`);
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

/** Each project's travel on the home's chapters, in the way's order: where it starts and how long it is. */
const TRAVELS = HOME_CHAPTERS.units.filter((unit) => unit.id === 'TRAVEL');

/** The middle of the travel to bead `index` (0 Funcial). */
const tripMiddle = (index) => TRAVELS[index].start + TRAVELS[index].length / 2;

/**
 * The engraved way (spec 2026-10-27-bob-engraved-way-design.md), at 1440x900 and 390x844 (touch), each in a fresh
 * context landed with the void ready:
 * - from BOB from above, wheel notches (short swipes) run the fall: the shaft's throat (the bridge's
 *   `journey.engraved.throat`) lights as the light drops into the compass, and is 0 at every sample where one of Bob's
 *   facts shows;
 * - posed at way frames 32, 40 and 121, the bridge's levels are the rules' (`engravedLevels`): the throat whole by 40,
 *   the hall whole at fact 02's peak;
 * - from fact 01's peak to fact 05's by input: the way frame runs 299/6 frames a viewport height of input, half the
 *   first fall's pace, so the 160 frames take 3.21 viewport heights where they took 1.61;
 * - each trip's line whole at its travel's middle, the others out; none half way through a bead's inside, nor at its
 *   inside stop, where the next trip begins (a phone sees past the bead there); in the look back every line faint, 0.32
 *   at most;
 * - stills at way frames 32 and 121 through the home's luma gate, and at the second trip's middle under its ceiling
 *   (0.11): there the light is small and dim on a phone, as the approved light path has it, so the floor's bright pixel
 *   in the scene's middle is not asked of it.
 */
async function engraved(browser, step) {
  const summary = [];
  const gated = [];
  const ceilingOnly = [];
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
      if (sample.stretch === 'travel') break;
    }
    const fall = samples.filter((sample) => sample.stretch === 'light');
    const withFact = fall.filter((sample) => sample.fact);
    const crossed = withFact.filter((sample) => sample.throat !== 0);
    const most = Math.max(0, ...fall.map((sample) => sample.throat ?? 0));
    step.check(
      samples.at(-1)?.stretch === 'travel' && withFact.length >= 5 && crossed.length === 0,
      `${at}: ${samples.length} ${input} from BOB from above run down the fall to the path; the throat is 0 at every one of the ${withFact.length} samples where a fact shows (not at ${crossed.map((sample) => `frame ${sample.frame?.toFixed(0)}: ${sample.throat}`).join(', ') || 'any'})`
    );
    step.check(most > 0.5, `${at}: and the throat shows as the light drops into the compass (at most ${most.toFixed(3)} on the way down)`);

    // Posed: the rules' levels.
    const posed = {};
    for (const f of [32, 40, 121]) {
      const state = await poseAt(page, placeOfFrame(f));
      const got = state.journey.engraved;
      const want = engravedLevels({ stretch: 'light', frame: state.journey.frame }, null, BEAD_LIST.length);
      posed[f] = got;
      step.check(
        got !== null && near(got.throat, want.throat, 1e-9) && near(got.hall, want.hall, 1e-9) && got.trips.length === BEAD_LIST.length && got.trips.every((level) => level === 0),
        `${at}: at way frame ${f} the bridge's levels are the rules': throat ${got?.throat.toFixed(4)} (${want.throat.toFixed(4)}), hall ${got?.hall.toFixed(4)} (${want.hall.toFixed(4)}), trips ${JSON.stringify(got?.trips)}`
      );
    }
    step.check(posed[40]?.throat > 0.9 && posed[121]?.hall > 0.9 && posed[121]?.throat === 0, `${at}: the throat whole by way frame 40 (${posed[40]?.throat}), the hall whole at fact 02's peak and the throat gone (${posed[121]?.hall}, ${posed[121]?.throat})`);

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

    // The trips' lines.
    for (const bead of BEAD_LIST) {
      const mid = await poseAt(page, tripMiddle(bead.index));
      const trips = mid.journey.engraved?.trips ?? [];
      step.check(
        mid.journey.stretch === 'travel' && mid.journey.project === bead.index && trips.length === BEAD_LIST.length && trips.every((level, k) => level === (k === bead.index ? 1 : 0)),
        `${at}: half way to ${bead.id} its own line is whole and the others out (${JSON.stringify(trips)})`
      );
      for (const [where, place] of [['half way through', (bead.stop + bead.inside) / 2], ['at the stop of', bead.inside]]) {
        const inside = await poseAt(page, place);
        const lv = inside.journey.engraved;
        step.check(
          lv !== null && lv.throat === 0 && lv.hall === 0 && lv.trips.every((level) => level === 0),
          `${at}: ${where} ${bead.id}'s inside none of it shows (${inside.journey.stretch} ${inside.journey.local.toFixed(2)}, ${JSON.stringify(lv)})`
        );
      }
    }
    const look = await poseAt(page, LOOK_STOP);
    const faint = look.journey.engraved?.trips ?? [];
    step.check(faint.length === BEAD_LIST.length && faint.every((level) => level > 0 && level <= 0.32 + 1e-9), `${at}: in the look back every line shows, faint: ${faint.map((level) => level.toFixed(3)).join(', ')}, 0.32 at most`);

    // Stills: the fall's through the home's luma gate, the trip's under its ceiling.
    mkdirSync(STILLS, { recursive: true });
    for (const [name, progress] of [['fall-32', placeOfFrame(32)], ['fall-121', placeOfFrame(121)], ['trip-2', tripMiddle(1)]]) {
      await poseAt(page, progress);
      await page.waitForTimeout(500);
      const file = join(STILLS, `engraved-${name}-${at}.png`);
      await page.screenshot({ path: file });
      if (name === 'trip-2') ceilingOnly.push(file);
      else gated.push({ file, kind: 'home', mask: await textMask(page) });
    }
    await takeCsp(page, step);
    summary.push(`${at}: ${samples.length} inputs down the fall, ${inputs} from fact 01 to 05`);
    await context.close();
  }
  step.luma = await gateLuma(browser, step, gated);
  const meter = await browser.newContext();
  const meterPage = await meter.newPage();
  for (const file of ceilingOnly) {
    const luma = await lumaOf(meterPage, file);
    const name = file.split(/[\\/]/).pop();
    step.luma.push({ still: name, kind: 'home', mean: Number(luma.mean.toFixed(4)), peak: Number(luma.peak.toFixed(3)), clipped: Number(luma.clipped.toFixed(6)), ceilingOnly: true });
    step.check(luma.mean <= LUMA_GATE.home && luma.clipped <= LUMA_GATE.clipped, `${name}: mean luma ${luma.mean.toFixed(4)}, at most ${LUMA_GATE.home}, and ${(luma.clipped * 100).toFixed(3)} % of it clipped, at most ${(LUMA_GATE.clipped * 100).toFixed(3)} %`);
  }
  await meter.close();
  return summary.join('; ');
}

/** The touch points each bead shows inside it, in the way's order (src/scene/bob/touchPoints.ts): Funcial, Jontai Energy, Cookies Clicker. */
const POINT_COUNTS = [5, 4, 5];

/** How much of each bead the pure pose shows at `progress` on a screen of `aspect` (its fade, 0 where it is not drawn). */
const fadesAt = (progress, aspect) => journeyPoseAt(progress, aspect).path?.beads.map((bead) => (bead.visible ? bead.fade : 0)) ?? [];

/** The touch points of bead `id` as the page shows them now: shown or not, their opacity, and each point's box. */
const touchPointsOf = (page, id) =>
  page.evaluate((id) => {
    const el = document.querySelector(`.touch-points[data-bead="${id}"]`);
    if (el === null) return null;
    const points = [...el.querySelectorAll('.touch-point')].map((point) => {
      const box = point.getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
    });
    return { shown: el.hasAttribute('data-shown'), opacity: Number(getComputedStyle(el).opacity), points, width: window.innerWidth, height: window.innerHeight };
  }, id);

/** Bead `id`'s label's side (`data-side`: `right` of the light on a laptop, `below` the bead on a phone) and whether it is quiet (the look back's). */
const labelSideOf = (page, id) =>
  page.evaluate((id) => {
    const el = document.querySelector(`.bead-label[data-bead="${id}"]`);
    return el === null ? null : { side: el.getAttribute('data-side'), quiet: el.hasAttribute('data-quiet'), hover: el.hasAttribute('data-hover') };
  }, id);

/** Bead `id`'s label once its computed opacity is 1 and it is shown (`data-shown`), waited for up to `timeout` ms; null if it never is. */
const labelWhole = (page, id, timeout) =>
  page
    .waitForFunction(
      (id) => {
        const el = document.querySelector(`.bead-label[data-bead="${id}"]`);
        return el !== null && el.hasAttribute('data-shown') && Number(getComputedStyle(el).opacity) === 1;
      },
      id,
      { timeout },
    )
    .then(() => labelOf(page, id), () => null);

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

/**
 * The light's path (spec 2026-10-27-bob-light-path-design.md), by real input at 1440x900 and 390x844 (touch), each in a
 * fresh context landed with the void ready; at 1440 once more on /en/:
 * - from the fall's end, wheel notches (slow swipes) run the story on into Funcial's travel with no stop at the
 *   hand-over: it rests past it, where the input stopped;
 * - through the whole way (the travels, orbits and insides, every 0.02 of a unit, and every place a real run passed), at
 *   most one bead is shown with a fade of 0.5 or more;
 * - along Funcial's orbit the veins' wake (the bridge's `journey.wake`) grows with each notch, and runs back with each
 *   notch up;
 * - a step to Funcial's arrival stop (the arrow; a flick) rests there with its label whole within 1 s, right of the
 *   light on a laptop, under the bead on a phone; the next step, its inside, the label gone and its five touch points
 *   shown, each inside the screen; then Jontai Energy (four) and Cookies Clicker (five), in order;
 * - stopped anywhere on the way, it rests where the input stopped, and the canvas sleeps within a second.
 */
async function lightPath(browser, step) {
  const summary = [];
  const runs = [...TWO_SIZES.map((size) => ({ size, path: '/' })), { size: TWO_SIZES[0], path: '/en/' }];
  for (const { size, path } of runs) {
    const english = path === '/en/';
    const at = `${sizeName(size)}${english ? ' /en/' : ''}`;
    const { context, page, cdp, touch } = await readyHome(browser, step, size, path);
    const aspect = size.width / size.height;
    const t = new Translator(english ? 'en' : 'nl').t.needle.bead;

    if (!english) {
      // Into the path from the fall's end, with no stop at the hand-over.
      await poseAt(page, PATH_START - 0.4);
      await page.evaluate(() => {
        window.__seen = new Set();
        window.__seenTimer = setInterval(() => window.__seen.add(window.__needleDebug().progress), 5);
      });
      const inputs = touch ? 3 : 6;
      for (let i = 0; i < inputs; i++) {
        if (touch) await slowTouch(page, cdp, [195, 560], [195, 360], 60);
        else await page.mouse.wheel(0, RISE.notchPx);
        await page.waitForTimeout(touch ? 60 : RISE.notchGapMs * 4);
      }
      const into = await restAt(page);
      const intoState = await debugOf(page);
      step.check(
        intoState.journey.stretch === 'travel' && intoState.journey.project === 0 && into.target > PATH_START + 0.2 && !keyStops(HOME_CHAPTERS).some((stop) => near(stop, into.target, 1e-3)),
        `${at}: ${touch ? 'three slow swipes' : 'six wheel notches'} from the fall's end run on into Funcial's travel with no stop at the hand-over (${PATH_START.toFixed(3)}): at rest at ${into.target.toFixed(3)}, ${intoState.journey.stretch} ${intoState.journey.project}`,
      );

      // At most one bead shown at a time, all the way.
      const dense = [];
      for (let p = PATH_START; p < LOOK_START; p += 0.02) dense.push(p);
      const seen = await page.evaluate(() => {
        clearInterval(window.__seenTimer);
        return [...window.__seen];
      });
      const crowded = [...dense, ...seen.filter((p) => p >= PATH_START && p < LOOK_START)].filter((p) => fadesAt(p, aspect).filter((fade) => fade >= 0.5).length > 1);
      step.check(crowded.length === 0, `${at}: on the way (${dense.length} places every 0.02 and ${seen.length} the run passed) at most one bead is shown with a fade of 0.5 or more (more than one at ${crowded.slice(0, 5).map((p) => p.toFixed(3)).join(', ') || 'none'})`);

      // The veins wake along Funcial's orbit, and run back.
      await poseAt(page, PATH_START + 1.3);
      await restAt(page);
      const wakeNow = async () => {
        await page.waitForTimeout(200);
        return debugOf(page);
      };
      const wakes = [(await wakeNow()).journey.wake[0]];
      for (let i = 0; i < 6; i++) {
        await nudge(page, cdp, 1, touch ? 80 : RISE.notchPx);
        await restAt(page);
        const s = await wakeNow();
        if (s.journey.stretch !== 'orbit') break;
        wakes.push(s.journey.wake[0]);
      }
      const up = [wakes.at(-1)];
      for (let i = 0; i < wakes.length - 1; i++) {
        await nudge(page, cdp, -1, touch ? 80 : RISE.notchPx);
        await restAt(page);
        const s = await wakeNow();
        if (s.journey.stretch !== 'orbit') break;
        up.push(s.journey.wake[0]);
      }
      const rising = wakes.every((w, i) => i === 0 || w >= wakes[i - 1] - 0.01) && wakes.at(-1) > wakes[0] + 0.3;
      const falling = up.every((w, i) => i === 0 || w <= up[i - 1] + 0.01) && up.at(-1) < up[0] - 0.3;
      step.check(rising && wakes.length >= 4, `${at}: along Funcial's orbit the veins' wake grows with each ${touch ? 'swipe' : 'notch'}: ${wakes.map((w) => w.toFixed(2)).join(' ')} rad`);
      step.check(falling, `${at}: and runs back with each one up: ${up.map((w) => w.toFixed(2)).join(' ')} rad`);
    }

    // Each project's arrival and inside, in order, a step at a time from Funcial's orbit, the pointer off the beads.
    if (!touch) await page.mouse.move(4, size.height - 4);
    await poseAt(page, PATH_START + 1.9);
    await restAt(page);
    for (const bead of BEAD_LIST) {
      const arrival = await stepStop(page, cdp, bead.stop);
      const restedAt = Date.now();
      const label = await labelWhole(page, bead.id, 1_000);
      const shownIn = Date.now() - restedAt;
      const side = await labelSideOf(page, bead.id);
      const state = await debugOf(page);
      const light = state.journey.light === null ? null : ndcToPx(state.journey.light, size);
      const onScreen = state.journey.beads?.[bead.index];
      const placed = label !== null && (touch ? side?.side === 'below' && onScreen !== undefined && label.box.top >= onScreen.y + onScreen.r - 1 : side?.side === 'right' && light !== null && label.box.left > light.x);
      step.check(
        near(arrival.target, bead.stop, 1e-9) && label !== null && shownIn <= 1_000,
        `${at}: ${touch ? 'put' : 'a press of the arrow'} rests on ${bead.id}'s arrival, ${bead.stop.toFixed(3)} (got ${arrival.target.toFixed(3)}), its label whole within 1 s of the rest (${label === null ? 'never' : `${shownIn} ms`})`,
      );
      step.check(placed, `${at}: and the label stands ${touch ? 'under the bead' : 'right of the light'} (data-side ${side?.side}, its box [${label === null ? '-' : Object.values(label.box).map((v) => Math.round(v)).join(', ')}], the light ${light === null ? 'none' : Math.round(light.x)}, the bead ${onScreen === undefined ? 'none' : `${Math.round(onScreen.y)} r ${Math.round(onScreen.r)}`})`);
      if (bead.index === 0) {
        const want = { category: categories.byId(bead.category).heading(english ? 'en' : 'nl'), hint: touch ? t.hintTouch : t.hint };
        step.check(
          label !== null && label.category === want.category && label.title === bead.title && (touch ? label.hintTouch : label.hintFine) === want.hint,
          `${at}: and it says what the ${english ? 'English' : 'Dutch'} dictionary says, "${want.category}", "${bead.title}", "${want.hint}" (got ${JSON.stringify(label && [label.category, label.title, touch ? label.hintTouch : label.hintFine])})`,
        );
      }
      const inside = await stepStop(page, cdp, bead.inside);
      await page.waitForTimeout(500);
      const gone = await labelOf(page, bead.id);
      const points = await touchPointsOf(page, bead.id);
      const within = points !== null && points.points.every((box) => box.left >= 0 && box.top >= 0 && box.right <= points.width && box.bottom <= points.height);
      step.check(near(inside.target, bead.inside, 1e-9) && (gone === null || !gone.shown || gone.opacity === 0), `${at}: the next step rests in ${bead.id}'s inside, ${bead.inside.toFixed(3)} (got ${inside.target.toFixed(3)}), its label gone (${gone === null ? 'none' : `shown ${gone.shown}, opacity ${gone.opacity}`})`);
      step.check(
        points !== null && points.shown && points.opacity === 1 && points.points.length === POINT_COUNTS[bead.index] && within,
        `${at}: and its ${POINT_COUNTS[bead.index]} touch points show, each inside the screen (got ${points === null ? 'none' : `${points.points.length}, shown ${points.shown}, opacity ${points.opacity}, inside ${within}`})`,
      );
    }

    if (!english) {
      // Stopped anywhere on the way, it rests there and the canvas sleeps.
      await poseAt(page, BEAD_LIST[1].stop - 0.9);
      await restAt(page);
      await nudge(page, cdp, 1);
      await nudge(page, cdp, 1);
      const rest = await restAt(page);
      const sleptIn = await sleepWithin(page, 4_000);
      const onStop = keyStops(HOME_CHAPTERS).some((stop) => near(stop, rest.target, 1e-3));
      step.check(!onStop && rest.target > BEAD_LIST[1].stop - 0.9 && rest.target < BEAD_LIST[1].stop, `${at}: two inputs in Jontai Energy's travel rest where they stopped, ${rest.target.toFixed(4)}, not on a stop`);
      step.check(sleptIn !== null && sleptIn <= 1_000, `${at}: at rest on the way the canvas sleeps within a second (asked for no frame from ${sleptIn} ms on)`);
    }
    summary.push(`${at}: three arrivals and insides by ${touch ? 'the bridge' : 'the arrow'}`);
    await context.close();
  }
  return summary.join('; ');
}

/**
 * The look back (spec 2026-10-27-bob-light-path-design.md), at 1440x900 and 390x844 (touch), and at 1440 on /en/: from
 * the last inside a step (the arrow; a flick) rests on the look back's own stop, where all three beads stand shown inside
 * the screen and the way's line is drawn whole. On a laptop the pointer over each bead shows its label, Tab goes Funcial,
 * Jontai Energy, Cookies Clicker and then the skip button, each label shown as it takes the focus, and Enter on Jontai
 * Energy's opens its page; Back returns to the look back. On the phone a tap on Cookies Clicker's bead opens its page.
 */
async function lookBack(browser, step) {
  const summary = [];
  const runs = [...TWO_SIZES.map((size) => ({ size, path: '/' })), { size: TWO_SIZES[0], path: '/en/' }];
  for (const { size, path } of runs) {
    const english = path === '/en/';
    const at = `${sizeName(size)}${english ? ' /en/' : ''}`;
    const { context, page, cdp, touch } = await readyHome(browser, step, size, path);
    const home = english ? '/en/' : '/';
    await poseAt(page, LOOK_START);
    await restAt(page);
    const rest = await stepStop(page, cdp, LOOK_STOP);
    await page.waitForTimeout(600);
    const state = await debugOf(page);
    const beads = state.journey.beads ?? [];
    const inside = beads.length === 3 && beads.every((b) => b.visible && b.x - b.r >= 0 && b.x + b.r <= size.width && b.y - b.r >= 0 && b.y + b.r <= size.height);
    step.check(near(rest.target, LOOK_STOP, 1e-9) && state.journey.stretch === 'sheet' && state.journey.sheet === 0, `${at}: ${touch ? 'put' : 'a press of the arrow'} from the last inside rests on the look back's own stop, ${LOOK_STOP.toFixed(3)} (got ${rest.target.toFixed(3)}, ${state.journey.stretch})`);
    step.check(inside, `${at}: all three beads stand shown inside the screen: ${beads.map((b) => `(${Math.round(b.x)}, ${Math.round(b.y)}) r ${Math.round(b.r)} ${b.visible ? 'shown' : 'hidden'}`).join(', ')}`);
    const way = journeyPoseAt(LOOK_STOP, size.width / size.height).path?.way ?? 0;
    step.check(way === 1, `${at}: and the way's line is drawn whole (its share ${way})`);

    if (!touch) {
      for (const bead of BEAD_LIST) {
        const b = beads[bead.index];
        await page.mouse.move(b.x, b.y);
        const label = await labelWhole(page, bead.id, 1_500);
        const side = await labelSideOf(page, bead.id);
        step.check(label !== null && side?.hover === true && side.quiet, `${at}: the pointer over ${bead.id}'s bead shows its label (${label === null ? 'not shown' : `opacity ${label.opacity}`}, data-hover ${side?.hover})`);
        if (english && bead.index === 0) {
          const want = categories.byId(bead.category).heading('en');
          step.check(label !== null && label.category === want && label.title === bead.title, `${at}: in English: "${want}", "${bead.title}" (got ${JSON.stringify(label && [label.category, label.title])})`);
        }
      }
      await page.mouse.move(4, size.height - 4);
      await page.waitForTimeout(500);
      await page.focus('a[href="#main"]');
      const order = [];
      const shownOnFocus = [];
      for (let press = 0; press < 30 && order.length < 4; press++) {
        await page.keyboard.press('Tab');
        const now = await page.evaluate(() => {
          const el = document.activeElement;
          return el?.classList.contains('skip-button') ? 'skip' : (el?.getAttribute('data-bead') ?? null);
        });
        if (now !== null && !order.includes(now)) {
          order.push(now);
          if (now !== 'skip') shownOnFocus.push((await labelWhole(page, now, 1_500)) !== null);
        }
      }
      const want = [...BEAD_LIST.map((bead) => bead.id), 'skip'];
      step.check(JSON.stringify(order) === JSON.stringify(want), `${at}: Tab goes ${want.join(', ')} (got ${order.join(', ')})`);
      step.check(shownOnFocus.length === 3 && shownOnFocus.every(Boolean), `${at}: each label shows as it takes the focus (${shownOnFocus.join(', ')})`);
      if (!english) {
        const jontai = BEAD_LIST[1];
        await page.focus(`.bead-label[data-bead="${jontai.id}"]`);
        await page.keyboard.press('Enter');
        const opened = await page.waitForURL(`${BASE}${jontai.path}`, { timeout: FLIGHT_MS + 4_000 }).then(() => true, () => false);
        step.check(opened, `${at}: Enter on ${jontai.id}'s label opens ${jontai.path}`);
        await page.goBack();
        const back = await page
          .waitForFunction((stop) => Math.abs(window.__needleDebug().target - stop) < 1e-9 && window.__needleDebug().progress === window.__needleDebug().target, LOOK_STOP, { timeout: 15_000 })
          .then(() => true, () => false);
        step.check(back && new URL(page.url()).pathname === home, `${at}: Back returns to the look back's stop (${back ? 'there' : JSON.stringify(await frameOf(page))})`);
      }
    } else {
      const cookies = BEAD_LIST[2];
      const b = beads[cookies.index];
      await page.touchscreen.tap(b.x, b.y);
      const opened = await page.waitForURL(`${BASE}${cookies.path}`, { timeout: FLIGHT_MS + 4_000 }).then(() => true, () => false);
      step.check(opened, `${at}: a tap on ${cookies.id}'s bead opens ${cookies.path}`);
    }
    summary.push(`${at}: three beads in view, ${touch ? 'a tap opens' : 'hover, Tab and Enter'}`);
    await context.close();
  }
  return summary.join('; ');
}

/**
 * Starts recording, in `window.__credits`, every write of the credits' move (a MutationObserver on <html>'s `data-end`
 * and style): the time, `data-end`, `--end-black`, `--end-rise` and the top of "Q&A". `takeCredits` reads it and stops.
 */
const watchCredits = (page) =>
  page.evaluate(() => {
    const root = document.documentElement;
    const rows = [];
    window.__credits = rows;
    window.__creditsInput = null;
    const first = () => (window.__creditsInput ??= performance.now());
    for (const type of ['wheel', 'keydown', 'touchstart']) window.addEventListener(type, first, { capture: true, passive: true });
    const observer = new MutationObserver(() => {
      const head = document.getElementById('end-title');
      rows.push({
        t: performance.now(),
        end: root.getAttribute('data-end'),
        black: Number(root.style.getPropertyValue('--end-black') || 0),
        rise: Number(root.style.getPropertyValue('--end-rise') || 0),
        top: head ? head.getBoundingClientRect().top : null,
      });
    });
    observer.observe(root, { attributes: true, attributeFilter: ['data-end', 'style'] });
    window.__creditsStop = () => observer.disconnect();
  });
const takeCredits = (page) =>
  page.evaluate(() => {
    window.__creditsStop?.();
    return { rows: window.__credits, input: window.__creditsInput };
  });

/** The credits' edge fades as computed now: each one's display and opacity. */
const edgesOf = (page) =>
  page.evaluate(() => {
    const end = document.getElementById('end');
    const read = (pseudo) => {
      const style = getComputedStyle(end, pseudo);
      return { display: style.display, content: style.content, opacity: Number(style.opacity), position: style.position };
    };
    return { before: read('::before'), after: read('::after'), final: end.hasAttribute('data-final') };
  });

/**
 * The credits (spec 2026-10-27-bob-light-path-design.md, goal 8), by real input at 1440x900, 1366x657 and 390x844
 * (touch), and at 1440 on /en/:
 * - from the look back's own stop one notch (a short swipe) fades the look back to black and then raises the credits:
 *   the black whole before the rise begins, both only growing, at rest within REST_WITHIN_S;
 * - at rest "Q&A" stands at 55 % of the screen's height (2 px either way), on the pixel the rise brings it to;
 * - the wheel (a swipe) then scrolls the document natively, the story still at the end;
 * - at the document's end the message part rests in the middle of the space under the header (within 5 % of it) where it
 *   is shorter than that space, else its foot on the screen's, and the edge fades lifted off it (`data-final`);
 * - at 1440 the type is the mock-up's: answers 19 px, questions 13 px, "Q&A" and the name 15 px, the column 580 px; on
 *   the phone the answers 16 px or more;
 * - the edge fades are there (fixed, at the screen's top and foot), and not with reduced motion;
 * - back at the document's top an input up takes the story back to the look back's stop;
 * - on /en/ "Q&A" and the questions and answers are the English dictionary's.
 */
async function credits(browser, step) {
  const summary = [];
  const runs = [...DIVE_SIZES.map((size) => ({ size, path: '/' })), { size: DIVE_SIZES[0], path: '/en/' }];
  for (const { size, path } of runs) {
    const english = path === '/en/';
    const at = `${sizeName(size)}${english ? ' /en/' : ''}`;
    const { context, page, cdp, touch } = await readyHome(browser, step, size, path);
    await poseAt(page, LOOK_STOP);
    await restAt(page);
    await page.mouse.move(size.width * 0.5, size.height * 0.5);
    await watchCredits(page);
    await nudge(page, cdp, 1);
    const rested = await endViewAt(page, 'rest', 8_000);
    const { rows, input } = await takeCredits(page);
    const restRow = rows.find((row) => row.end === 'rest');
    const tookS = restRow === undefined || input === null ? null : (restRow.t - input) / 1000;
    step.check(rested === 'rest' && tookS !== null && tookS <= REST_WITHIN_S, `${at}: one ${touch ? 'short swipe' : 'notch'} from the look back's stop brings the credits to rest within ${REST_WITHIN_S} s (${tookS === null ? 'never' : `${tookS.toFixed(2)} s`})`);
    const moving = rows.filter((row) => row.end === 'moving');
    const firstRise = moving.find((row) => row.rise > 0);
    const blacks = moving.map((row) => row.black);
    const rises = moving.map((row) => row.rise);
    const only = (list) => list.every((v, i) => i === 0 || v >= list[i - 1] - 1e-9);
    step.check(
      moving.length > 3 && firstRise !== undefined && firstRise.black === 1 && only(blacks) && only(rises),
      `${at}: the look back fades to black first and the credits rise after it, both only growing (${moving.length} frames moving; the black at the rise's first frame ${firstRise?.black})`,
    );
    const height = size.height;
    const restTop = await page.evaluate(() => document.getElementById('end-title').getBoundingClientRect().top);
    const lastMoving = moving.at(-1);
    const projected = lastMoving === undefined ? null : lastMoving.top - (1 - lastMoving.rise) * 0.45 * height;
    step.check(Math.abs(restTop - 0.55 * height) <= 2, `${at}: at rest "Q&A" stands at 55 % of the screen's height: ${restTop.toFixed(1)} px, ${(0.55 * height).toFixed(1)} wanted`);
    step.check(projected !== null && Math.abs(projected - restTop) <= 1, `${at}: on the pixel the rise brings it to: the last frame moving at ${lastMoving?.top?.toFixed(1)} px with the rise at ${lastMoving?.rise.toFixed(3)}, ${projected?.toFixed(1)} at its whole, ${restTop.toFixed(1)} at rest`);

    // The fades at the edges, there at the top.
    const edges = await edgesOf(page);
    step.check(
      edges.before.display !== 'none' && edges.after.display !== 'none' && edges.before.position === 'fixed' && edges.before.opacity === 1 && edges.after.opacity === 1 && !edges.final,
      `${at}: the edge fades are there at the screen's top and foot (${JSON.stringify(edges)})`,
    );

    if (english) {
      const words = await page.evaluate(() => ({ head: document.getElementById('end-title').textContent, q: [...document.querySelectorAll('.end-q')].map((q) => q.textContent), a: [...document.querySelectorAll('.end-a')].map((a) => a.textContent) }));
      const en = new Translator('en').t.end;
      step.check(
        words.head === 'Q&A' && JSON.stringify(words.q) === JSON.stringify(en.questions.map((q) => q.question)) && JSON.stringify(words.a) === JSON.stringify(en.questions.map((q) => q.answer)),
        `${at}: "Q&A" and the six questions and answers are the English dictionary's (first "${words.q[0]}")`,
      );
    } else if (size.width === 1440) {
      const type = await page.evaluate(() => {
        const px = (selector) => parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
        return { answer: px('.end-a'), question: px('.end-q'), head: px('.end-head'), name: px('.end-name'), column: document.querySelector('.end-roll').getBoundingClientRect().width };
      });
      step.check(type.answer === 19 && type.question === 13 && type.head === 15 && type.name === 15 && type.column === 580, `${at}: the type is the mock-up's: answers ${type.answer} px, questions ${type.question}, "Q&A" ${type.head}, the name ${type.name}, the column ${type.column}`);
    } else if (touch) {
      const answer = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.end-a')).fontSize));
      step.check(answer >= 16, `${at}: the answers ${answer} px, 16 or more`);
    }

    // The document's own scroll, and its end.
    if (touch) await swipe(page, cdp, 600, 300);
    else for (let i = 0; i < 3; i++) await page.mouse.wheel(0, RISE.notchPx);
    await scrollSettled(page);
    const scrolled = await page.evaluate(() => ({ y: window.scrollY, target: window.__needleDebug().target, end: document.documentElement.getAttribute('data-end') }));
    step.check(scrolled.y > 0 && scrolled.target === STORY_END && scrolled.end === 'rest', `${at}: the ${touch ? 'swipe' : 'wheel'} then scrolls the document natively: scrollY ${scrolled.y}, the story still at the end (${scrolled.target}, ${scrolled.end})`);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await scrollSettled(page);
    await page.waitForTimeout(600);
    const final = await page.evaluate(() => {
      const box = document.querySelector('.end-final').getBoundingClientRect();
      const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height'));
      return { top: box.top, bottom: box.bottom, height: box.height, header, viewport: window.innerHeight };
    });
    const space = final.viewport - final.header;
    const middle = final.header + space / 2;
    const centre = final.top + final.height / 2;
    const lifted = await edgesOf(page);
    step.check(
      final.height <= space ? Math.abs(centre - middle) <= 0.05 * space : Math.abs(final.bottom - final.viewport) <= 1,
      `${at}: at the document's end the message part (${Math.round(final.height)} px) ${final.height <= space ? `rests in the middle of the ${Math.round(space)} px under the header: its centre ${centre.toFixed(1)}, the middle ${middle.toFixed(1)}` : `is taller than the ${Math.round(space)} px under the header, its foot on the screen's: ${final.bottom.toFixed(1)} of ${final.viewport}`}`,
    );
    step.check(lifted.final && lifted.before.opacity === 0 && lifted.after.opacity === 0, `${at}: and the edge fades are lifted off it (data-final ${lifted.final}, opacities ${lifted.before.opacity} and ${lifted.after.opacity})`);

    // Back at the top, an input up takes the story back to the look back.
    await page.evaluate(() => window.scrollTo(0, 0));
    await scrollSettled(page);
    await page.waitForTimeout(300);
    await nudge(page, cdp, -1);
    const backAt = await page
      .waitForFunction((stop) => document.documentElement.getAttribute('data-end') === null && window.__needleDebug().target === stop && window.__needleDebug().progress === stop, LOOK_STOP, { timeout: 8_000 })
      .then(() => true, () => false);
    step.check(backAt, `${at}: at the document's top an input up takes the story back to the look back's stop, ${LOOK_STOP.toFixed(3)} (${backAt ? 'there' : JSON.stringify(await frameOf(page))})`);
    summary.push(`${at}: at rest ${tookS?.toFixed(2)} s after the input, "Q&A" at ${restTop.toFixed(0)} px`);
    await context.close();
  }

  // Reduced motion: no fades at the edges.
  const reduced = { ...DIVE_SIZES[0], options: { reducedMotion: 'reduce' } };
  const { context, page } = await readyHome(browser, step, reduced);
  await page.evaluate((p) => window.__needleDebug.set({ progress: p }), STORY_END);
  await endViewAt(page, 'rest', 8_000);
  const edges = await edgesOf(page);
  step.check(edges.before.display === 'none' && edges.after.display === 'none', `1440x900 reduced motion: no edge fades (${edges.before.display}, ${edges.after.display})`);
  await context.close();
  return summary.join('; ');
}

/**
 * A portrait resize mid-fall and mid-orbit (spec: the labels readable at every size), at 1440x900 turned to 390x844:
 * - at fact 02's peak the way frame stays, and the fact still rides by the light, now below it;
 * - late in Funcial's orbit, its label whole right of the light, the place stays and the label stays with the bead,
 *   now under it;
 * - half way to Jontai Energy, its engraved line stays whole through the turn (the engraved way built for the new aspect).
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

  // Mid-orbit: Funcial's label whole beside the light, then the turn.
  const funcial = BEAD_LIST[0];
  const orbit = funcial.stop - 0.015;
  await page.setViewportSize({ width: DIVE_SIZES[0].width, height: DIVE_SIZES[0].height });
  await page.waitForTimeout(400);
  await poseAt(page, orbit);
  const wide = await labelWhole(page, funcial.id, 2_000);
  const wideSide = await labelSideOf(page, funcial.id);
  await page.setViewportSize(phone);
  await page.waitForTimeout(700);
  const turned = await debugOf(page);
  const tall = await labelWhole(page, funcial.id, 2_000);
  const tallSide = await labelSideOf(page, funcial.id);
  const bead = turned.journey.beads?.[funcial.index];
  step.check(turned.progress === orbit && turned.target === orbit && turned.journey.stretch === 'orbit', `mid-orbit the place stays through the resize: ${orbit.toFixed(4)}, then ${turned.progress} (${turned.journey.stretch})`);
  step.check(
    wide !== null && wideSide?.side === 'right' && tall !== null && tallSide?.side === 'below' && bead !== undefined && tall.box.top >= bead.y + bead.r - 1 && tall.box.left < bead.x && tall.box.right > bead.x,
    `and Funcial's label stays with it: right of the light at 1440 (${wideSide?.side}), under the bead at 390 (${tallSide?.side}, its box [${tall === null ? '-' : Object.values(tall.box).map((v) => Math.round(v)).join(', ')}], the bead at ${bead === undefined ? 'none' : `(${Math.round(bead.x)}, ${Math.round(bead.y)}) r ${Math.round(bead.r)}`})`,
  );

  // Mid-trip: the line of the trip in view stays whole through the turn.
  await page.setViewportSize({ width: DIVE_SIZES[0].width, height: DIVE_SIZES[0].height });
  await page.waitForTimeout(400);
  const wideTrip = await poseAt(page, tripMiddle(1));
  await page.setViewportSize(phone);
  await page.waitForTimeout(700);
  const tallTrip = await debugOf(page);
  step.check(
    wideTrip.journey.engraved?.trips[1] === 1 && tallTrip.journey.engraved?.trips[1] === 1 && tallTrip.journey.stretch === 'travel' && tallTrip.progress === tripMiddle(1),
    `half way to Jontai Energy its engraved line stays whole through the turn: ${JSON.stringify(wideTrip.journey.engraved?.trips)} at 1440, ${JSON.stringify(tallTrip.journey.engraved?.trips)} at 390 (${tallTrip.journey.stretch})`
  );
  await context.close();
  return `fact 02 at frame ${after.journey.frame?.toFixed(1)}, below the light after the turn; Funcial's label right of the light, then under its bead; the trip's line whole through the turn`;
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
  'light-dive': lightDive,
  'light-facts': lightFacts,
  engraved,
  path: lightPath,
  'look-back': lookBack,
  credits,
  resize,
  'bead-open': beadOpen,
  'void-hold': voidHold,
  'void-fail': voidFail,
  'end-page': endPage,
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
