# SDD ledger — plan: docs/superpowers/plans/2026-10-20-needle-m1-foundation.md

Spec: C:\Users\bhcco\Downloads\portfolio-prompt-v2-pack\MASTER-PROMPT-v2.md (+ approved roadmap C:\Users\bhcco\.claude\plans\i-want-a-redesign-distributed-tarjan.md)
Branch needle, worktree .claude/worktrees/needle; plan head at start: e3e8987

## Pre-flight scan

| Pair / task | Produces → consumes | Finding |
|---|---|---|
| T1 ↔ T2 | T1 deletes core/{App,Component,dom,Motion,Signal}, compass/{Controller,live,reading}, ui/**; T2 moves three/**, core/{Handlers,deadline,SafeStorage}, compass/loading | consistent; remaining three/* import only kept modules (checked import map) |
| T1 ↔ T2 | both delete pearl-spec.test.ts | overlap → Ruling 1 |
| T1 ↔ T3 | T1 static prerender list; T3 `prerender: pagePaths()` | T3 would prerender 14 paths with no route yet → Ruling 2 |
| T1 ↔ T4a | T1 creates home.tsx, not-found.tsx; T4a lists them under Create | Ruling 3 (T4a modifies) |
| T1 ↔ T4a | T1 edits projects.ts/categories.ts minimally; T4a rewrites them | consistent sequence |
| T1 (self) | root renders CSP meta `__CSP__`; T3 rewrites content at build → hydration attribute mismatch | Ruling 4 (suppressHydrationWarning) |
| T1 (self) | launch.json "keep the astro entries" but `npm run dev` on this branch is react-router on 5173 | Ruling 5 |
| T3 ↔ T4a | T3 sitemap/stubs point at pages T4a builds; T3 Step 5 expects auditor issues for them | Ruling 2 covers |
| T3 ↔ T4b | `/career/*` → `/lite/#career`; T4b adds id="career" | consistent (test strips hash) |
| T4a ↔ T5 | directions.ts CountryId, localeFromPath, PAGES | consistent order |
| T4a ↔ T6 | categories ids → chapter spec | consistent (secure-element, front-panel, oscillator) |
| T5 ↔ T6 | frame, chapterAt, stops, CHAPTER event, reducedMotion | consistent; checked stops/chapterAt test values against lengths 1/11/2/1/3 → total 18 ✓ |
| T5 ↔ T7 | frame.contextLost | present in T5 frame ✓ |
| T6 ↔ T8 | `window.__needleFrame` added T6, removed T8 | consistent |
| T7 ↔ T2 | compassPoseAt/nominalSpans/applyPose/buildInstrument etc. | names match import map ✓ |
| T7 (self) | needs SHOULDER exported from CompassStudio | T7 modifies it ✓ |
| T8 ↔ T5 | lang-keeps-phase relies on ROUTE dispatch | consistent |
| T2 (self) | moves Choreography/applyPose/overlay that roadmap called "dropped" | intended: placeholder pose for M1, removed in M2 (plan text says so) |
| T6 (self) | normalizeWheel test values vs rules | checked: 48/mouse, 100→mouse, 4.5→trackpad, 800→240 ✓ |

## Rulings

- Ruling 1: T2 deletes pearl-spec.test.ts only if T1 has not — no conflict in outcome — costs nothing if wrong.
- Ruling 2: T3 keeps `prerender` at T1's list and writes pages.ts + tests; T4a switches the config to `pagePaths()`. In T3 the sitemap lists all `pagePaths()` and auditor findings that point only at not-yet-built pages are expected and listed in the T3 report; T4a must bring the auditor to 0 — prerendering routes that do not exist would fail or emit 404 HTML at real URLs — if wrong: T3's audit is less complete for one task.
- Ruling 3: T4a modifies (not creates) home.tsx and not-found.tsx — files exist from T1 — none.
- Ruling 4: the CSP meta gets `suppressHydrationWarning` (React 19 attribute mismatch after build-time rewrite) — avoids a hydration console error — if wrong: one harmless prop.
- Ruling 5: on branch needle, .claude/launch.json drops the astro entries and has only needle-dev (5173) and needle-pages (4399); Bob's main checkout keeps its own file — astro entries would start the wrong server on this branch — if wrong: Bob re-adds two lines.

## Models
T1 opus · T2 sonnet · T3 sonnet · T4a sonnet · T4b sonnet · T5 sonnet · T6 sonnet · T7 opus · T8 sonnet · reviews sonnet (T1, T7, final: opus)

## Progress
Task 1: dispatched (base e3e8987, implementer opus)
Task 1: implementer DONE_WITH_CONCERNS d22beaf (CSP meta prerender-only; placeholder console error until T3; deleted 1 loading.test case reading BenchLayout; 404 lang + HydrateFallback → T3/T4a; THREE.Clock deprecation warning from R3F)
Task 1: review dispatched (opus) on review-t1-trimmed.diff
Task 1: review — spec ✅, Approved; 1 Important (plan-mandated): npm run audit points at dist
Ruling 6: route the audit-script fix into Task 3 (package.json "audit": "python tools/site_audit.py dist/client") alongside deploy.yml — brief said keep it unchanged; T3 owns the dist/client path change — if wrong: one-line script stays broken a task longer.
Ruling 7: CSP constraint reads "before any <script>" (React emits viewport meta first; charset, viewport, CSP order is fine) — applyCsp checks scripts only — none.
Task 1: minor (deferred → T3): delete the harness __CSP__ console exemption; derive harness PAGES from pagePaths(); drop .astro/ from .gitignore
Task 1: minor (deferred → T7): memo SceneHost / module-level Canvas prop constants; THREE.Clock deprecation warning; Vite chunk-size warning for Stage chunk
Task 1: minor (deferred → T8): harness setup failure (server down / launch fail) writes no FAIL line or results.json
Task 1: minor (deferred → M2): restore a check that the new boot/loader script reads SEEN_KEY
Task 1: minor (deferred): node types leak into src (tsconfig types); serve-pages case-insensitive on Windows vs Pages case-sensitive; suppressHydrationWarning now a no-op (Ruling 4 superseded by SSR-only meta)
Task 1: complete (commits e3e8987..d22beaf, review clean)
Task 2: dispatched (base d22beaf, implementer sonnet)
Task 2: implementer DONE_WITH_CONCERNS 5ffe867 (262 tests; repointed tracks.ts + qa/tracks-data tests to moved drive; stale src/scripts paths in tools/proof/README.md:109-110 left; trailer says Sonnet 5.5 — accurate for that subagent, left as is)
Task 2: review dispatched (sonnet) on review-t2-trimmed.diff
Task 2: review — spec ✅, Approved, 0 Important
Task 2: minor (deferred → M2): doc comments name deleted modules (applyPose.ts:9, overlay.ts:10, instrument/textures.ts:54, loading.ts:11 CompassScene; quality.ts:3 PixelBudget); stillness.ts pearl vocabulary (→ T7 decides when wiring Heartbeat)
Task 2: minor (deferred → T8): tools/proof/README.md:109-110 stale src/scripts paths
Task 2: complete (commits d22beaf..5ffe867, review clean)
Ruling 8: T3 adds a root HydrateFallback (static bilingual not-found notice) + proof step not-found (404 status, h1 after hydration, no reload loop, no console/CSP errors) — the SPA fallback renamed to 404.html needs content and a test; Review Focus-like failure (unknown URL) — if wrong: one small component.
Task 3: dispatched (base 5ffe867, implementer sonnet); auditor runner: scratchpad/audit-needle.mjs
Task 3: implementer DONE_WITH_CONCERNS 1bacc85 (303 tests; auditor 82 errors all expected until T4a incl. / and /en/ SEO head; Layout sets html lang in effect; lighthouserc future pages fail CI until T4a)
Task 3: review dispatched (sonnet) on review-t3-trimmed.diff
Task 3: review — spec ✅, Approved, 0 Important; 2 deviations for controller acceptance
Ruling 9: accept applyCsp checking tag attributes (on* names, javascript: values) instead of a raw-text regex — the literal rule would reject visible copy like "JavaScript:"; CSP itself blocks both forms — if wrong: a handler in a script/comment edge case goes unflagged by the lint (CSP still blocks it).
Ruling 10: accept the not-found step's narrow allowance for the browser's own 404-document console message (exact URL + 'status of 404', counted) — a real 404 status cannot avoid it; fails closed — if wrong: a differently worded Edge build fails the step.
Task 3: minor (deferred → final review): csp.mjs:16-17 HAS_SRC/JSON_LD regexes match data-src/data-type (anchor on (?:^|\s)); csp.mjs:82-84 strip script/style bodies before comments; test gaps (raw 404 notice text, writeRedirects overwrite guard, makeNotFound)
Task 3: minor (deferred → T4a): site_audit.py default/doc still 'dist' (lines 1,13,550); README says build 'prerenders every page' (true after T4a); 404 notice English half lacks lang=en; Duplicate CNAME copy (harmless, brief-mandated)
Task 3: complete (commits 5ffe867..1bacc85, review clean)
Task 4a: dispatched (base 1bacc85, implementer sonnet)
Task 4a: implementer DONE_WITH_CONCERNS 159ad2c (356 tests; 18 pages prerendered; auditor 0 on 41 pages; proof 6 steps PASS; self-written copy to show Bob: Cookies role 'Development, with a classmate', Funcial/Cookies type, Funcial role, Lite meta description, title patterns; Lite placeholder has id=career; main swallows canvas pointer events → T6/T7)
Task 4a: review dispatched (sonnet) on review-t4a-trimmed.diff
Task 4a: review — spec mostly ✅; Needs fixes: 2 Important (Esc·back hint with no Esc handler; Cookies role 'Development' unbacked)
Ruling 11: Cookies role becomes neutral 'With a classmate' / 'Samen met een klasgenoot' until Bob states his part — discovery leaves his part [FILL]; never claim unbacked work — if wrong: Bob supplies the real role later.
Ruling 12: fix round adds a shared src/ui/BackLink.tsx (one link, Esc key binding to the same target, key hint aria-hidden and hidden on coarse pointers); T5's routeSync later swaps the target logic (history vs home) — the hint is approved copy and must work now — if wrong: small component reworked in T5.
Ruling 13: include reviewer Minor 2 (case-variant URL crash in countryOf/projectOf → render not-found instead of throwing) in the fix round — a crash is visitor-facing and cheap to fix — none.
Task 4a: minor (deferred → final review): meta preamble duplicated across 6 route modules; head.ts/structured.ts use new Translator not translatorFor; not-found suffix re-implemented; LangSwitch aria-label lacks visible 'NL'/'EN' (WCAG 2.5.3); ThreeDToggle label + aria-checked double-signal; projects.ts eager glob emits unused screenshots/portrait to dist; projectLd puts stack in programmingLanguage; no unit test over route meta for unique titles; tokens.css omits scene-only tokens
Task 4a: cross-task (→ T5/T6/T7): main/.site-header z-index above canvas swallow pointer events (pointer-events none + auto on interactive); store must read needle-3d before Stage mounts; WebGL failure sets 3D-off behaviour so nav shows; focus/announce on client route change
Task 4a: fix round 1 dispatched (resume implementer) — base 159ad2c
Task 4a: fix round 1 implementer DONE_WITH_CONCERNS 67deb7c (367 tests; audit 0; 8 proof steps PASS; extra: serve-pages case-sensitive, routes caseSensitive); re-review dispatched (sonnet)
Task 4a: fix round 1/5 (3 addressed, 0 open — Esc BackLink, neutral Cookies role, case-variant not-found; commits 159ad2c..67deb7c)
Task 4a: minor (deferred → final review): serve-pages top-level realpath(ROOT) crashes if dist/client missing; BackLink Escape has no modifier guard; not-found home link not a BackLink
Task 4a: complete (commits 1bacc85..67deb7c, review clean after 1 fix round)
Task 4b: dispatched (base 67deb7c, implementer sonnet)
Task 4b: implementer DONE_WITH_CONCERNS e16ba2b (417 tests; audit 0; 9 proof steps PASS; CSP blocks mailto: form action → no-JS no-key path uses plain mailto link; contactPayload adds optional subject; real Web3Forms untested); review dispatched (sonnet)
Task 4b: review — Needs fixes: 1 Important (t.contact.title not rendered; contact h1 uses nav.contact)
Ruling 14: Lite's work section also renders t.work intro, heldTitle/heldText and nextTitle/nextText — Bob asked that Lite carry ALL of today's copy, and these were on the old home Projects section — if wrong: three short lines to remove.
Ruling 15: fix round includes reviewer Minor 3 (submit re-entry guard, AbortController timeout, focus to status after failure) and Minor 5 (pair <summary> matches; assert funcial defined) — cheap robustness on a visitor-facing form — none.
Task 4b: minor (deferred → final review): no-key JS-off contact intro says 'write it below' with no form (production needs PUBLIC_WEB3FORMS_KEY — Bob's pending action); looksAutomated 3s from mount can swallow a fast autofill send; ?sent=1 comment overstated; useRef<HTMLDivElement> on <section>; contactSubmit.ts relative import; :empty display toggle on role=alert; external-link new-tab cue; keyed build at 390px unproven; ContactForm state machine only e2e-tested
Task 4b: fix round 1 dispatched (resume implementer) — base e16ba2b
Task 4b: fix round 1 implementer DONE_WITH_CONCERNS 67f87ba (426 tests; audit 0; 9 proof steps PASS; work h2 now t.work.title; category-card labels countOne/countMany/view/rail not carried); re-review dispatched (sonnet)
Task 4b: fix round 1/5 (4 addressed, 0 open — contact title h1, full work copy, form guard/timeout/focus, test looseness; commits e16ba2b..67f87ba)
Task 4b: minor (deferred → final review): LiteWorld h2 uses t.nav.about above the t.about section (heading clarity); keyed-proof console filter widened for abort; programmatic focus ring on .form-status depends on :focus-visible; category-card labels (work.countOne/countMany/view/rail) not on Lite
Task 4b: complete (commits 67deb7c..67f87ba, review clean after 1 fix round)
Ruling 16: BackLink's Esc/click use routeSync.backTarget(arrivedDirect) — 'history' → navigate(-1), 'home' → locale home; href stays home for no-JS; BackLink's helper renamed homeTarget; arrivedDirect = first document load of the tab — matches the plan's 'Esc goes back, or home on a direct arrival' — if wrong: Esc returns home instead of back.
Task 5: dispatched (base 67f87ba, implementer sonnet)
Task 5: implementer DONE_WITH_CONCERNS 2a1f04c (507 tests; audit 0; 9 proof steps PASS; extras samePhase/HOME_CHAPTERS/syncRoute/arrivedDirectly/readClientPrefs/useThreeDAttribute/goBack/isPlainClick; T6 must use HOME_CHAPTERS and keep frame.chapterIndex current; T7 must not treat leaving LOADING as assets ready); review dispatched (sonnet)
Task 5: review — spec ✅; Needs fixes: 3 Important (arrivedDirect breaks on REPLACE e.g. ContactForm ?sent=1; Esc after language switch undoes the switch; hydration gating hand-off to T7 undocumented)
Ruling 17: LangSwitch navigates with replace (a language switch is the same page, not a story step) and syncRoute carries loadedOn forward on REPLACE navigations — fixes both Important 1 and 2 with one rule — residual: after client-navigating and then switching language, Esc steps back to the previous entry in its original language (accepted edge case) — if wrong: Bob sees one language flip on Esc.
Task 5: minor (deferred → final review): root-chunk size delta unmeasured; HOME_CHAPTERS couples chapters.ts to data modules; resetRouteSync test-only export; React hook in store module
Task 5: fix round 1 dispatched (resume implementer) — base 2a1f04c
Task 5: fix round 1 implementer DONE a4e4c07 (518 tests; audit 0; 9 proof steps PASS; LangSwitch replace everywhere; persist reworked); re-review dispatched (sonnet)
Task 5: fix round 1/5 (4 addressed, 0 open — replace keeps loadedOn, LangSwitch replace, hydration-gating note, small items; commits 2a1f04c..a4e4c07)
Task 5: complete (commits 67f87ba..a4e4c07, review clean after 1 fix round)
Ruling 18: VirtualScroll binds to document.documentElement (not .scene-host) — the DOM overlay (main/header, z-index 2) covers the canvas, so wheel/touch never reach .scene-host; with home + 3D on the page has overflow hidden so the root is the right target — if wrong: input binds one element higher than needed.
Task 6: dispatched (base a4e4c07, implementer sonnet)
Task 6: implementer DONE_WITH_CONCERNS 557270a (604 tests; audit 0; 10 proof steps PASS; touch-action pinch-zoom on html[data-route=home][data-3d=on]; data-route from Shell effect; maath damp dynamic-imported)
Task 6: cross-task (→ T7): dispatch LOADED when the Stage is ready AND when SceneHost decides no Stage (3D off / no WebGL) so a direct load of / leaves LOADING; Heartbeat must invalidate() while frame.progress != frame.target
Task 6: cross-task (→ M4): reduced-motion stops are chapter starts, so the 11 DISSECT parts pass in one step; consider per-part stops when the dissect lands
Task 6: review dispatched (sonnet)
Task 6: review — spec ✅ (CSS deviation accepted under Ruling 18); Needs fixes: Important 1 rAF re-entrancy (wake() inside tick double-schedules during touch glide; leaks; post-dispose ticks); Important 2 cross-task LOADING dead zone (→ T7)
Ruling 19: T7 must dispatch LOADED when the scene is ready; on scene failure or a load timeout, turn 3D off (store) so native scroll returns; add proof step 'direct load of / then wheel moves the story' — a stuck LOADING locks the home page — if wrong: a visitor on a slow device cannot scroll until 3D loads.
Ruling 20: fix round folds in Minor 1 (zero frame.velocity on cleanup), Minor 2 (stop inertia when pinned at a bound), Minor 4 (snap progress to target if the maath import fails) — same loop, cheap, prevents Task 7 rendering on stale signals — none.
Task 6: minor (deferred → final review / M4): reduced motion damps across 11 DISSECT parts (consider snapping); reduced-motion gesture grouping not direction-aware; route-name test does not read routes.ts; onWheel preventDefault before px===0 check; maath __damp velocity persists in frame
Task 6: fix round 1 dispatched (resume implementer) — base 557270a
Task 6: fix round 1 implementer DONE 92225a3 (623 tests; audit 0; 10 proof steps PASS; scrollLoop.ts extracted; proof fails with guard removed); re-review dispatched (sonnet)
Task 6: fix round 1/5 (2 addressed, 0 open — single pending rAF via ScrollLoop, Ruling 20 items; commits 557270a..92225a3)
Task 6: minor (deferred → T7): proof watchFrames counts every rAF caller; R3F's own rAF will break most===1 — scope the counter to the scroll loop's request
Task 6: minor (deferred → final review): no unit test for input/dispose during pending maath import (fuzz-verified correct); failed import stays on snap for the mount's lifetime
Task 6: complete (commits a4e4c07..92225a3, review clean after 1 fix round)
Ruling 21: M1 pointer parallax reads a window pointermove into frame.pointer; the overlay pointer-events rework (main/header above the canvas) waits for M3, when arms get hover/click raycasts — M1 has no 3D hit targets — if wrong: M3 adds the CSS then.
Task 7: dispatched (base 92225a3, implementer opus; Rulings 19, 21 carried; T1/T2/T6 deferred items folded in)
Task 7: implementer DONE_WITH_CONCERNS 226e7b8 (649 tests; audit 0; 13 proof steps PASS; ~180 fps 1440x900; screenshots proof-out/m1/)
Task 7: controller visual check — CONFIRMED gap: fallback title renders 'DE NAALD IS HET NOORDEN KWUT' (Unbounded joins Dutch IJ into a U-like ligature under lang=nl); goes into the fix round with the reviewer's findings
Task 7: controller visual note (→ M2): at 1440x900 the placeholder dial overlaps the G of BOB CHUNG; M2 rebuilds the hero layout (south arm aimed at the nameplate)
Task 7: review dispatched (opus)
Task 7: review — spec ✅ with 1 plan-mandated conflict; Needs fixes: 3 Important (background-tab load timeout; text pages lose scrim over the opaque canvas; async-load throw shows partial scene instead of fallback) + Important 4 plan-mandated Bloom values
Ruling 22: Bloom follows docs/art-direction.md (luminanceThreshold 1.0 in linear HDR; intensity 0.7 on high, 0.5 on medium), not the plan's 0.85/0.6 — the art direction is sampled from Bob's references and says a blooming brass specular means a light is too hot; the plan's values predate it — if wrong: glow is subtler than intended.
Ruling 23: Dutch 'IJ' renders as two letters everywhere Unbounded is used (disable the ligature/locl feature that joins it) — 'KWIJT' reads as 'KWUT', a visible typo, against the brief's 'never a typo' rule — if wrong: a typographic nicety is lost.
Ruling 24: fix round folds in reviewer Minors: pointer moves wake only the parallax (not the 10 s drift); one-line Clock-deprecation comment at the Canvas; reword the vite chunkSizeWarningLimit comment — cheap, perf-relevant — none.
Task 7: minor (deferred → final review / M2): addAfterEffect release not flushed on unmount; partial build not disposed on throw; context restore does not re-warm; per-frame allocations in Rig/applyPose; banned-imports test gaps (namespace import, export *, comments in braces, deep paths with extension); React.lazy caches a failed Stage chunk; low-tier switch recompiles all programs; useFrame throws escape StageBoundary
Task 7: fix round 1 dispatched (resume implementer) — base 226e7b8
Task 7: fix round 1 implementer DONE_WITH_CONCERNS 499de74 (661 tests; audit 0; 16 proof steps PASS; controller checked stills: KWIJT correct, content pages legible)
Ruling 25: the remaining brass-specular bloom on the M1 placeholder comes from the key light; leave the studio for M2's art-direction lighting rather than retune a placeholder — M2 rebuilds the hero and its lighting — if wrong: one visible glint on the M1 review screenshot.
Task 7: re-review dispatched (sonnet)
Task 7: fix round 1/5 (5 addressed, 1 open — load-throw proof missing: settleLoad unit test does not exercise Compass's load/fail wiring; commits 226e7b8..499de74)
Task 7: fix round 2 dispatched (resume implementer) — base 499de74; also: double scrim during load (key host scrim to data-ready), loaded proof label 3000 vs 4000 ms
Task 7: fix round 2 implementer DONE 84eff3c (661 tests; audit 0; 17 proof steps PASS incl. load-throw via patched Stage chunk, RED on two mutations); re-review dispatched (sonnet)
Task 7: fix round 2/5 (3 addressed, 0 open — load-throw proof via patched Stage chunk, scrim keyed to data-ready, label; commits 499de74..84eff3c)
Task 7: minor (deferred → T8): scene-stills pre-ready scrim check is timing-sensitive (fails if the scene is ready before the post-load evaluate)
Task 7: complete (commits 92225a3..84eff3c, review clean after 2 fix rounds; brass glint → M2 per Ruling 25)
Task 8: dispatched (base 84eff3c, implementer sonnet)
Task 8: implementer DONE_WITH_CONCERNS 110802f (687 tests; audit 0; 2 full proof runs, 21 steps, 687 checks, 0 console/CSP errors; 180 fps headless); review dispatched (sonnet)
Task 8: review — spec ✅, Approved, 0 Important (velocity field + bridge step accepted as extras)
Task 8: minor (deferred → final review): setup-failure catch misses require(playwright-core)/tsImport before setup(); stills count check compares PAGES to itself; stills waits on a clock (1.2 s) and never clears m1/; frameOf chapterIndex derived not raw (message wording); '?? 0' bridge fallbacks; harness hard-codes M1 stops and dpr range; debug modules ship to every visitor (static import); README omits stills' NO_WEBGL Edge; stray &proof on esc URL
Task 8: complete (commits 84eff3c..110802f, review clean)
Final review: dispatched (opus) on e3e8987..110802f, review-final-trimmed.diff
Final review: With fixes — 0 Critical, 4 Important (client nav keeps scroll/no focus move; Lite and text pages boot + draw the full WebGL scene, handle.scene unread; Cloudflare analytics beacon dropped silently; README/docs/audit.md stale) + minors triaged
Ruling 26: restore the Cloudflare beacon when PUBLIC_CF_ANALYTICS_TOKEN is set (as the live site does) rather than drop it — keeps Bob's existing behaviour; CSP hosts and CI var already assume it — if wrong: remove 1 script tag + 2 CSP hosts.
Ruling 27: gate the FIRST Stage mount on the matched route's handle.scene !== null (Lite, contact, not-found boot no WebGL); once mounted the canvas persists; Rig/Heartbeat skip parallax where scene is null; handle.scene becomes the single source (routeName derives from it or vice versa) — Lite is the light version; M2's loader builds on this gate — if wrong: Lite loses a backdrop no one sees behind a 0.94 scrim.
Ruling 28: the final fix wave also takes these cheap pre-merge items: CI typecheck step; LangSwitch label-in-name; ThreeDToggle stable '3D' name; projectLd stack → keywords; looksAutomated waits out the rest of 3 s instead of faking success; Ruling 7 note for the image preload; one positive CSP step (injected inline script → violation); remove no-op suppressHydrationWarning; docs/audit.md tracks.ts line — all small, all before merge — none.
Final review: ledger gaps recorded — 4a 'focus/announce on route change' was never ruled (now Important 1); analytics drop unrecorded (now Ruling 26)
Final review: fix wave dispatched (one subagent, opus) — base 110802f
Final review: fix wave DONE_WITH_CONCERNS 110802f..0fab5b9 (711 tests; audit 0 with/without token; 2 full proof runs 24/24, 0 console/CSP errors; ScrollRestoration now owns scroll, hook moves focus; caseSensitive ignored client-side → handleOf gives not-found); scoped re-review dispatched (sonnet)
Final review: fix wave re-review — all 5 findings ADDRESSED, no new Critical/Important (commits 110802f..0fab5b9)
Final review: parked — README.md:5-6 says 'every other page is text over a still poster' but country/project pages keep the live canvas — Ruling: real, cosmetic doc wording, no second fix wave per process; carry to M2's first task — if wrong: one sentence misleads a reader until M2.
Final review: carried (→ M2+): 3D off→on on a scene-less page waits for the next scene page; keyed contact quick-send proven on a dummy-key build only; nav-focus relies on window.__reactRouterDataRouter; docs/audit.md patterns.ts wording
M1: complete (e3e8987..0fab5b9)
