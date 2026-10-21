# SDD ledger — plan: docs/superpowers/plans/2026-10-20-needle-v3-m2-loader-home.md

Spec: docs/superpowers/specs/2026-10-20-needle-v3-design.md (approved by Bob 2026-10-20).
Branch needle-v3-m2, worktree .claude/worktrees/needle-v3-m2, from redesign-bench 55addff. Baseline: 711 tests pass.
Task order as written: 1, 2, 3, 4, 5, 6 (shots), 7 (aim), 8, 9, 10, 11, 12a, 12b, 13, 14, 15.

## Pre-flight scan

| Pair / task | Produces → consumes | Finding |
| --- | --- | --- |
| T1 ↔ T4 | GLASS_RINGS[i%4].y, DIAL.rules → ring arcs | ok: rules 0.23/0.41/0.57/0.71 fall in the gaps (hub 0.2, rings 0.24–1.0) |
| T1 ↔ T9 | GlassRing, HEXAGRAMS → strip painter | ok |
| T1 ↔ T11 | RingId → setRingMasks keys | ok |
| T2 ↔ T3 | pinsLit → LoaderClock.pins | ok |
| T2 ↔ T4 | pinPosition, CHIP → board paths, arc bearings | ok |
| T2 ↔ T8 | CHIP.board → city below glass | ok: -0.15 + 0.11 < 0 |
| T3 ↔ T12a/T14 | loaderAt, advanceClock, loaderGaveUp, loaderSeen, LOADER.quick | ok |
| T4 ↔ T10 | tracePoints/boardPath/ringPath, 48 pts → LineSegments | ok; exact endpoints required (T4 step 3) |
| T5 ↔ T6 | starPositions → framing tests | ok |
| T5 ↔ T7 | starPositions, pointedAt, PLACEMENTS → aim | **defect**: ray/cylinder rules misread stars (one pixel = near and far shell point; China tangent ≈119°) → Ruling 1 |
| T6 ↔ T7 | homeShotFor, applyCameraShot | ok (order fixed in plan: shots before aim) |
| T6 ↔ T12a | SHOTS, lerpCameraShot → cameraShotAt | ok |
| T8 ↔ T11 | Block, CITY_BLOCKS {fine, coarse} | ok |
| T9 ↔ T11/T12a/T14 | paintRingStrip → setRingMasks; LOAD_THROW_AT '.setRingMasks(' | ok |
| T10/T11 ↔ T12a | builders → Opening | ok |
| T11 ↔ T15 | room.ts ports CompassStudio room → T15 may delete CompassStudio | ok |
| T12a ↔ T12b | frame.shot, motion.loader/compass, Opening hands to Home | ok |
| T12a ↔ T13 | html[data-loading] → hero fade | ok |
| T12b ↔ T14 | bridge: loader, pointed, constellations, seekLoader | **gap**: seekLoader after a finished load would show all 64 pins at an early engraving moment → Ruling 2 |
| T1 self | tests vs values | ok |
| T2 self | ON fits chip (|x| ≤ 0.11 < 0.14); pinsLit(7)=64 | ok |
| T3 self | each test checked against the rules by hand | ok |
| T4 self | t=0.2 stagger: delay(i%8=7)=0.306 > 0.2 | ok |
| T5 self | wrap/front/beyond tests vs placements | ok |
| T6 self | numbers left to implementer, tests constrain | ok |
| T7 self | see Ruling 1 | fixed |
| T8 self | overlap test O(n²) at 900 | ok |
| T9 self | 36 / 4 / 360 / 576 marks from the data | ok |
| T10–T11 self | names, uniforms (uGlow) | ok |
| T12a self | "fix tests asserting M1 LOADED timing" | ok, report lists them |
| T13 self | guard test only | ok |
| T14 self | point step's empty-sky check relies on the gap 25°–57° | ok after Ruling 1 (sky rule) |
| T15 self | delete only importer-free modules | ok |

## Rulings

- Ruling 1: Task 7's pointerBearing snaps to the nearest constellation star within AIM_SNAP 0.07 (NDC, x scaled by aspect) before the ground and sky rules — the shell cylinder puts one pixel on both its near and far side, so a pure ray rule misreads either the low wrapped stars or the upper side stars (worked through at camera z 2.9: star 140° low = entry, 113° high = exit) — if wrong: the needle catches stars a little eagerly; tune AIM_SNAP. Plan edited (b6187e3).
- Ruling 2: seekLoader(seconds) holds a synthetic load (shown = min(1, s/engraveMin), loadedAt = engraveMin), the Opening poses from the held clock every frame, seekLoader(-1) releases; Task 14 waits for HOME_IDLE before seeking — stills must show pins filling with the engraving, not a finished load — if wrong: stills differ slightly from a live slow load. Plan edited (b6187e3).

## Progress
Tasks 1+2 (batched): dispatched (base b6187e3, implementer sonnet, report task-1-report.md)
Tasks 1+2: implementer DONE 921a4b9, 8dab925 (720 tests, typecheck clean; concerns: TRIGRAMS unused, O = 48 pts incl. repeat, pinPosition no range guard); review dispatched (sonnet)
Tasks 1+2: review — spec ✅, quality Approved; ⚠️ build/auditor not run → resolved: modules unreferenced; next dispatch must run build + auditor
Task 1-2: minor (deferred): pinPosition has no range guard (NaN for bad i) — Task 10 drives it from computed indices
Task 1-2: minor (deferred): pin order (0 = top-left, clockwise) and ON extent untested; HEXAGRAMS.length not tied to PIN_COUNT
Task 1-2: minor (deferred): O has 47 distinct points (odd → flat bottom edge, 0.00014 units); style nits (strokeLengths JSDoc, SIDES union duplicated, extra parens)
Task 1-2: minor (deferred): v3 rings read DIAL.rings — keep dialSpec in Task 15; tests don't pin exact radii
Task 1: complete (commits b6187e3..921a4b9, review clean)
Task 2: complete (commits 921a4b9..8dab925, review clean)
Plan fix d2e3291: auditor runner needs the worktree path argument (default points at the deleted needle worktree) — none
Tasks 3+4 (batched): dispatched (base d2e3291, implementer sonnet, report task-3-report.md; build + auditor required)
Tasks 3+4: implementer DONE_WITH_CONCERNS 5e4c884, 7a59027 (762 tests, typecheck, build, auditor 0); concerns: quick wins over reduced; quick path reports engraving/pins 0 even at home; engrave local = engraving share; arcs lean with trace; uneven pin bearings → 22.5° arcs overlap ≤3.6°/gap ≤2.6°; traces cache + RangeError guards; review dispatched (sonnet)
Ruling 3: at stage 'home' the Opening shows the chip dimmed with ON fully engraved and all pins lit, whatever path (full, quick, reduced) ran — the quick path's engraving/pins 0 describe the loader moment, not the home's ground; the chip under the hub must look the same on every visit — if wrong: a quick-path visitor sees a blank chip under the hub. Carry into Task 12a.
Tasks 3+4: review — spec ✅, quality Approved; ⚠️ items: tests/build/auditor are the implementer's evidence (accepted); drawing + Stage behaviour → Tasks 10/12a
Ruling 4: quick path wins over reduced; when reduced is set the Opening draws stage 'land' as a 0.6–0.8 s crossfade with no camera move (whatever path) — a returning reduced-motion visitor must never get a camera flight — if wrong: a reduced visitor's quick landing differs slightly from the first-visit fade. Carry into Task 12a.
Task 3-4: minor (deferred → Task 10/12a visual): ring arc sweeps opposite to the board path's bearing drift (ends cross during the lerp); flip arc() sign if it reads wrong on screen
Task 3-4: minor (deferred): give-up measured on the clamped clock (slow below 10 fps; plan-mandated); NaN loadedAt read differently by loaderAt vs loaderGaveUp
Task 3-4: minor (deferred): ringPath JSDoc says 'under the glass' but the rule radius is 0.01 inside the ring's inner edge; quick/reduced exact boundaries and odd loadedAt untested; clearance assertion loose; clamp01 copied thrice
Task 3: complete (commits d2e3291..5e4c884, review clean)
Task 4: complete (commits 5e4c884..7a59027, review clean)
Task 5: dispatched (base 7a59027, implementer opus — figure authoring needs visual judgment; report task-5-report.md with ASCII figures)
Task 5: implementer DONE_WITH_CONCERNS 2ba2a46 (777 tests, typecheck/build/auditor ok); concerns: China/Aruba nearly edge-on from a south camera; tree crown streams NW; cloud may read as a curl; side stars never overlap rim on screen
Ruling 5: constellation placement changes to camera-facing vertical planes at onDial(bearing, distance), lower stars curving forward (bend) and inward round the rim; china/aruba distance 1.65 width 0.85 bend 0.95 inward 0.5, NL distance 2.7; AIM_SHELL 1.65 — the plan's shell placement put the side figures edge-on (correctness of the design, raised by the implementer) — if wrong: figures may need retuning after the Task 14 stills. Plan edited; concern addressed before review via resume.
Task 5: rework DONE b8a6185 (778 tests, gates ok; ranges China [80,129], NL [-18,18], Aruba [-143,-81]; concerns: frame must reach x=2.075 (Task 6), ship small at width 0.75, cloud may read as a curl); review dispatched (sonnet)
Task 5: review — spec ✅, quality Approved; ⚠️ looks (China may read as a crown over a zigzag; ship small at width 0.75; Aruba max bearing 268.6° so due west sits in the margin) → Task 14 stills, Bob's call
Task 5: minor (deferred): wrapPi duplicates AngleSpring.wrapAngle; caching comment oversells (starPositions copies per call); bearingRange tuple not frozen; 'tops on the E-W line' test vacuous for Aruba; range-edge closure and to<=π premise untested
Task 5: complete (commits 7a59027..b8a6185, review clean)
Tasks 6+7 (batched): dispatched (base b8a6185, implementer sonnet, report task-6-report.md; extra tests asked: sky rule → null sector, ground rule → near south)
Tasks 6+7: implementer DONE_WITH_CONCERNS 6677d57, a1e1774, da27179 (837 tests, gates ok); concerns: needle jumps 35-40° at the horizon (ground→sky switch), 4:3 crops outer stars (homeShotFor fixed for aspect>=1), extra loaderShotFor(id, aspect), ray missing the shell → nearest point on ray to axis, portrait home small
Ruling 6: pointerBearing uses the ground point only when it lies within AIM_SHELL of the axis; beyond it the sky rule (cylinder exit) applies — makes the needle continuous across the horizon — if wrong: a cursor on the far ground reads the shell's side instead of the ray's direction (imperceptible).
Ruling 7: homeShotFor fits every aspect, landscape included (pull back below the design aspect so all stars stay in frame at 4:3) — 4:3 laptops/tablets are common — if wrong: the compass is slightly smaller at 4:3.
Ruling 8: keep the implementer's loaderShotFor(id, aspect); Task 12a's cameraShotAt must use it for the loader shots — without it a phone crops the chip — if wrong: one extra exported helper.
Tasks 6+7: fix commit 6c65db1 (852 tests, gates ok)
Ruling 6 (amended): the ground point counts when the ray reaches the ground no later than its sky (cylinder-exit) point; otherwise the sky rule — the literal radius test sent the board in front of the shell to the far side (~126° jump, bottom 19% of the picture); identical to the radius test elsewhere — if wrong: none visible.
Task 6-7: minor (deferred): loader macro's off-centre chip crops for aspects ~1.0–1.2 (loaderShotFor covers portrait) — check in Task 14 stills if a square viewport is added
Tasks 6+7: review dispatched (sonnet, package b8a6185..6c65db1)
Tasks 6+7: review — spec ✅, quality Approved; ⚠️ frame match and small phone home (rim ≈0.47 of half-width, ship small) → Task 14 stills, Bob's call
Task 6-7: minor (deferred): loaderShotFor snaps at aspect 1 and crops 1.0–1.2 (untested seam); misleading 'Ruling 6' source comment in aim.ts:137-140 (cites ledger; contradicts the rule); star-aim tests at 0.05 rad tolerance; horizon sweep only at 16:10; SHOTS.home returned shared+mutable (freeze); per-call allocations in shot helpers; mix declared after use
Task 6: complete (commits b8a6185..6677d57 + doc fix da27179 + 6c65db1, review clean)
Task 7: complete (commits 6677d57..6c65db1, review clean)
Tasks 8+9 (batched): dispatched (base 6c65db1, implementer sonnet, report task-8-report.md)
Tasks 8+9: implementer DONE 53651e8, 63e00e8 (878 tests, gates ok; bright share 8%); notes: commit trailers say Sonnet 5.5 (subagent's own attribution) — leave history as is; extra exports CITY_STREETS, RING_STRIP; city sparse (14-22% cover; FILL/MIN_FILL/avenueWidth tune); blocks keep out of the chip+pins square; seam marks drawn twice → Task 11 must set wrapS = RepeatWrapping on the strips
Tasks 8+9: review dispatched (sonnet, package 6c65db1..63e00e8)
Tasks 8+9: review — Task 8 ✅; Task 9 ❌ Important: trigram bars 0.011 off DIAL_ART.bar.at (centre vs edge), test cements it; fix round 1 sent (resume implementer)
Task 8-9: minor (deferred): cityLayout loops forever for counts ≳6000 (JSDoc promises RangeError); bright threshold unnamed (BRIGHT_MIN); tests restate literals instead of DIAL_ART/GLASS_RINGS; brittle parity/fillStyle assertions; shifted() assumes M/L/Q absolute (guard test for GLYPHS); header comment placement; AVENUE_NORMALS halves avenues silently; tautological CITY_BLOCKS test
Task 8-9: note for Task 11: read the mask's alpha channel (alphaMap reads green; un-premultiplied anti-aliased white uploads G=255) — use the mask as alpha, or premultiply
Task 9: fix round 1/5 implementer 82333fa (bars centred on DIAL_ART.bar.at; tests derive from DIAL_ART); re-review dispatched (haiku)
Task 9: fix round 1/5 (1 addressed, 0 open; commits 63e00e8..82333fa)
Task 8: complete (commits 6c65db1..53651e8, review clean)
Task 9: complete (commits 53651e8..82333fa, review clean after 1 fix round)
Task 10: dispatched (base 82333fa, implementer opus, report task-10-report.md)
Task 10: implementer DONE_WITH_CONCERNS 25fa7d0 (903 tests, gates ok, real WebGL compile ok); 12a wiring notes: build chip with buildChip({ traces }) and let setPower drive trace glow (don't also set it); chip has no dim API for Ruling 3's home — 12a adds a small setDim/setRest on chip.ts; call setEngraving(fractions, -Infinity) on reduced and quick-home paths (no hot N); stills watch: pins may look too yellow/blocky, 1-px traces, black body vanishes without the room, probe black, smoke invisible
Task 10: review dispatched (opus, package 82333fa..25fa7d0)
Task 10: review — ❌ Important: engraving can overdraw the laser's additive glow (transparent sort flips as the tip moves); colours outside palette (body, hot amber twice, smoke); fix round 1 sent (resume implementer)
Task 10: minor (deferred): traces setT allocates subarray views per frame of the rise; engraving ShaderMaterial ignores fog; point sprite clipped by chip top (lift 0.008 < 0.011); sparks hover past the chip edge; heat curve only in GLSL (no JS mirror test); chip→traces setGlow link fights other callers (12a picks one driver); THREE_CJS_DEPRECATED warning in the suite comes from elsewhere — trace it
Task 10: ⚠️ for Task 14 stills: power-on pins ≈1.04 linear (just past bloom threshold); loading pins may read as strong yellow blocks; spark reach 0.18–0.225 on a 0.28 chip
Task 10: fix round 1/5 implementer 1ff035f (laser group renderOrder 1; palette.amber; body palette.ink; smoke from lilac); re-review dispatched (sonnet). Note for 12a: the laser now draws after order-0 transparents (mist) — raise mist's renderOrder if it must veil the probe
Task 10: fix round 1/5 (2 addressed, 0 open; commits 25fa7d0..1ff035f)
Task 10: complete (commits 82333fa..1ff035f, review clean after 1 fix round)
Task 11: dispatched (base 1ff035f, implementer opus, report task-11-report.md; carried: mask alpha via .a not alphaMap, wrapS Repeat, palette tokens for glass/violet/nebula, room ported from CompassStudio)
Task 11: implementer DONE_WITH_CONCERNS 7f93d9d (953 tests, gates ok, real WebGL2 compile ok); palette tokens glass/violet/nebula/night (12a: LOOK.background = palette.night); mask .a via onBeforeCompile on alphaMap; looks for stills: nebula barely visible at 0.18, glass sheen from the room's violet back card hides the city, needle glint tamed, stars small at DPR 1, rough luma home 0.018 / loader 0.042 (may be too dark rather than too bright)
Task 11: review dispatched (opus, package 1ff035f..7f93d9d)
Task 11: review — ❌ Critical: city emissive guarded by USE_INSTANCING_COLOR (vertex-only define) so the city never glows; Important: sky dither in linear light on the composer path (~11x grain); fix round 1 sent (resume implementer, WebGL re-check required)
Task 11: minor (deferred): ring draw-order doc premise wrong (degree ring sits above direction); mirror gate at y=0 vs glass tops 0.009–0.045 (reflection over the hub gap / cut early); room port changed M1's card colours (warm soft-box → cream; rim; back card) — add M1's colours as tokens if gold reads flat; sky shader recomputes per-layer constants per pixel; mist depthTest false adds over needle/gold
Task 11: fix round 1/5 implementer fa5736f (city guard USE_COLOR, base glow 0.6→0.35; sky dither dropped; 955 tests; WebGL check: city glows, setGlow scales it, home luma 0.017); re-review dispatched (sonnet)
Task 11: fix round 1/5 (2 addressed, 0 open; commits 7f93d9d..fa5736f)
Task 11: minor (deferred): CITY_LOOK.side 0.15 tuned under the unlit-body misreading — recheck in Task 14; M1 Backdrop.ts has the same post-encode dither (retired in Task 15)
Task 11: complete (commits 1ff035f..fa5736f, review clean after 1 fix round)
Task 12a: dispatched (base fa5736f, implementer opus, report task-12a-report.md; carried Rulings 3, 4, 8 + Task 10/11/4 notes; chip gets a setRest-style dim setter)
Task 12a: implementer DONE_WITH_CONCERNS b344069, a5b7fd8, 4c35b00 (985 tests, gates ok; harness 254/259: no-webgl x4 look for the removed poster image, bridge x1 wheels during LOADING — both M1-specific → Task 14); arc sign flipped in traces.ts after seeing X-folds on screen; extras: city rises out of the board during circuit, hero hidden before hydration where scripts run (if JS never loads, name stays hidden — check), frame.shot typed CameraShot|null; looks: hero overlaps Aruba at 1440, city band visible, probe dark, home luma 0.019; controller viewed loader stills: dark and right, pins read bright-yellow (Task 14 gate/tuning)
Task 12a: review dispatched (opus, package fa5736f..4c35b00)
Task 12a: review — spec ✅, quality Approved; harness failures confirmed M1-only (no-webgl reads .poster img; bridge wheels during LOADING, nothing scrolls); ⚠️ give-up/load-throw end-to-end and readout reaching 1 → Task 14
Ruling 9: carry three 12a minors forward instead of a fix round — (a) Task 13 adds a CSS-only fail-safe so the hero shows if the bundle never runs (html:not([data-route]) .hero animates in after ~8 s); (b) Task 12b adds a SceneHost backstop visibleTimeout from onReady until the phase leaves LOADING (LOADER.giveUp + longest timeline + margin) → fail; (c) Task 12b: an Opening mounted while the phase is already HOME_IDLE (3D toggled back on, remount after leaving home mid-opening) skips straight to home instead of replaying under a visible hero — all three are visitor-facing robustness and fit the next tasks' files — if wrong: small rework there.
Task 12a: minor (deferred): per-frame small allocations in the opening (~10 objects/frame for ~7 s); breathe() setTimeout(0) doesn't guarantee a frame between ring paints; partial-build leak if a builder throws; unmount resets frame.loader.stage only; Studio leaves scene.environmentIntensity; stale poster comment in tools/build/csp.mjs; D3D X4122 double-precision shader warning untraced (Task 14 clean console); quick path compiles home programs on a drawn frame; no reduced-path sweep test asserting never-a-flight
Task 12a: complete (commits fa5736f..4c35b00, review clean)
Task 12b: dispatched (base 4c35b00, implementer opus, report task-12b-report.md; carried Rulings 2, 9b, 9c)
Task 12b: implementer DONE_WITH_CONCERNS 50cf822, 8587abb (1034 tests, gates ok; harness loaded/routes pass, bridge 2 expected fails → Task 14; smoke: pointing per constellation ~0.65 s, labels, seekLoader, remount skip, touch drift, reduced, sleep); concerns: ARUBA label collides with hero at 1440 (→ Task 13 layout), first 16 pins hidden behind chip from macro (Task 14 look), skipped mount must load home within the 12 s load timeout, backstop 26 s could fail a <6 fps device, Ruling 9c extended (a playing opening skips the rest on return once loaded)
Task 12b: review dispatched (opus, package 4c35b00..8587abb)
Task 12b: review — ❌ Important: skipped mount must load the whole home within the 12 s LOAD_TIMEOUT_MS (every visit starting on Lite/contact/404 — budget halves from ~27 s); fix round 1 sent (option 1: readiness at loader warm, unshown until home warm, separate LOADER.giveUp visible budget)
Task 12b: minor (deferred): per-frame allocations (idleRuns literal, driftLeg objects); label placer reads offsetWidth/Height every frame (cache on t change); timeouts.ts now pulls loaderTimeline into the entry bundle (comment in needleDebug.ts:2 false); seekLoader during LOADING lets the backstop fail (pause while held — optional in fix); held stills keep Home's last breath/twinkle (reset setTipGlow on hold); Home hand-over/stir/hold logic and the 9c-extension decision untested; Aruba label vs hero → Task 13 (labelSpot is the lever)
Task 12b: fix round 1/5 implementer 4db70dc (started at loader warm stops the 12 s timer; skipped mount unshown until home warm under a 15 s visible budget; backstop re-arms while held; 1038 tests; smoke lite→home ok up to 13.4 s, stuck paint gives up at 15.5 s); re-review dispatched (sonnet)
Task 12b: fix round 1/5 (1 addressed + optional Minor 4, 0 open; commits 8587abb..4db70dc)
Task 12b: minor (deferred): SceneHost started/ready gating has no direct unit test (pure parts + smoke cover it); late hold release can fail at once on a ?proof page; doc comment line wrap in SceneHost ~84
Task 12b: complete (commits 4c35b00..4db70dc, review clean after 1 fix round)
Ruling 10: Task 13 owns the hero/Aruba-label collision at 1440×900 — keep the hero where prototype ui-02 puts it (upper left) if it fits, otherwise move the label via Home's labelSpot (its above-figure fallback) rather than the approved hero layout; verify with a pointed-Aruba screenshot at 1440×900 and 390×844 — Bob approved ui-02's hero position; labels are ours to place — if wrong: Bob may prefer the hero moved instead.
Task 13: dispatched (base 4db70dc, implementer sonnet, report task-13-report.md; carried Rulings 9a, 10)
Task 13: implementer DONE_WITH_CONCERNS e154bfe, c6b97eb (1048 tests, gates ok; contrast 9.6/9.6/6.5:1; fail-safe ~9.5 s; clearOfHero moves labels under their figure within 80 px of hero text); concerns: ui-02 shows the name CENTRED and gold-cream (plan said upper-left, lilac); --dim token added to tokens.css; placer reads 3 DOM boxes per label per frame; phone name moved to upper left; Aruba label 25 px from the left edge
Controller look at proof-13 stills (1440): dark mood right; BUT composition far from frame 04 — compass small mid-screen (camera pulled back to fit every star), chip city hangs below the disc like a floating island (no case around it), stars barely visible (lines dominate), hero upper-left with the ship constellation beside it
Ruling 11: hero stays upper-left (ui-02's centred name would sit on the ship constellation, which now holds the top centre); its colour follows ui-02 — the name in palette.cream / light gold, the tagline in gold, the cue dim — Bob approved ui-02's look; position change flagged for Bob in the milestone review — if wrong: Bob may want it centred and the ship moved.
Ruling 12: insert Task 14b (composition pass toward frame 04) after Task 14 and before Task 15 — targets: compass larger and camera lower (rim spans ≥ 45% of the width at 1440×900, horizon near the upper third); constellations closer round the compass while every star stays in frame; stars clearly brighter than their lines; a dark case (outer wall + floor) so the city reads as under the glass, never hanging below the rim; update Task 5/6 tests to the new targets; iterate with Task 14's stills and luminance gate — the M2 home must look like the frame Bob picked before he reviews it (M1 was rejected on sight) — if wrong: extra tuning time.
Task 13: review — spec ✅, quality Approved; hero alignment/colour → Ruling 11 (Task 14b)
Task 13: minor (deferred): placer does up to 9 getBoundingClientRect per frame + querySelector misses (cache on size/t/fonts.ready → 14b); stale 'makes no objects' comment; no committed guard for the 9a fail-safe (→ Task 14 adds a harness step); cue pulse nearly invisible (revisit with recolour in 14b); HERO_ROOM 80 viewport cliff (ship label under at 1440/1536, above at 1600) — tune in 14b; phone scrim gradient built for a hero at the foot; header test exact on purpose (edit when sound arrives)
Task 13: complete (commits 4db70dc..c6b97eb, review clean)
Task 14: dispatched (base 3cb7362, implementer opus, report task-14-report.md; carried: rewrite no-webgl poster checks + bridge wheel-after-HOME_IDLE + STATE_KEYS, hero-failsafe step, trace X4122 warning)
Task 14: implementer DONE 92a4339 (harness 31/31 steps, 834 checks, errors/csp empty; 1048 tests; luma home 0.0195/0.0156, loader peak 0.0525, no clipping; X4122 is three's own PMREM shader — console warning, not ours); concerns: home far from frame 04 (→14b), pins bright yellow blocks + probe a dark stick (→14b), quick-reload 2.8 s budget (1.5 s measured), loader stills set data-loading while held, small extras (point-none still, bridge field checks, canvas read-back on v3 compass, IJ crop moved to m2/)
Task 14: review dispatched (sonnet, package 3cb7362..92a4339)
Task 14: review — spec ✅, quality Approved (X4122 confirmed three's PMREM GGX loop)
Ruling 13: Task 14b adds a luminance floor to home-look (dark but real: mean > 0.002 and some pixel above luma 0.3) and gates the point-* stills and the worst of a few home samples (pulse) — 14b brightens stars/city, so the gate must see the peak and must not pass a blank canvas — if wrong: one more harness tweak.
Task 14: minor (deferred): loader-stills cache makes STEPS order matter (README); point is order-dependent (assert pointed !== id before each move) and swallows a hero wait; loader-reduced doesn't prove a fill (≥3 distinct pin values); CSS poster check allows url() backgrounds; hero-failsafe absolute wall-clock bounds (~1.5 s margin); readCanvas axis check weaker than comment; README gaps (sleep lower bound, clipped is a fraction)
Task 14: complete (commits 3cb7362..92a4339, review clean)
Task 14b: dispatched (base 92a4339, implementer opus, report task-14b-report.md; carried Rulings 11, 12, 13 + deferred look items: pins, probe, placer DOM caching, HERO_ROOM cliff, cue pulse, Aruba edge)
Task 14b: implementer DONE_WITH_CONCERNS c2a3461, b0318ae, 8907d2e, 1939124 (1073 tests, gates ok, harness 31/31 876 checks; rim 64.6% width at 1440, horizon 36% down, phone rim 82%; luma home ≤0.031, loader ≤0.0617); concerns: phone centres margin 0.005 with side figures set back + wide fov, China/Aruba ranges now start ~50° from north; 3D wrap modest (figures beside the rim); earlier tests changed (rim clearance 0.15→0.04, portrait every-star → centres, aim samples, ship label always under hull); still open: circuit busier than frame 03, outer gold ring reads as bars, first 16 pins hidden at 0.6 s
Controller look at proof-14b: large compass low in frame, city enclosed under the glass, stars visible as points, hero cream/gold — reads like frame 04, darker; phone crops side constellations at the edges (honest note for Bob)
Task 14b: review dispatched (opus, package 92a4339..1939124)
Task 14b: review — ✅ targets/rulings met, each test relaxation justified (stars ≥1.08 from axis, ranges China [50,107] NL [-18,18] Aruba [-112,-53] with ≥20° dark sky), case keeps reflections; ❌ Important: Home's scroll/resize/fonts listeners invalidate() on sceneless pages (breaks the Heartbeat sleep contract); fix round 1 sent (resume implementer, extend no-scene to scroll/resize)
Task 14b: minor (deferred → final review triage): gate's floor peak region overlaps the 'Nederland' label on a phone (DOM text can satisfy the floor — exclude label boxes; fix comment); stale constellations.ts docs (inward curve, now 0); HERO_ROOM doc vs Aruba at 1024×768 (check NL); China/Aruba centres now ~72°/288° (needle ~15° short of 東 on the figure centre) — Bob's eye; ship stars read as line corners on phone
Task 14b: fix round 1/5 implementer 7024fa0 (layoutWakes(labelsLive, phase, scene) gates invalidate; no-scene step scrolls/resizes/fonts after client nav — mutation run fails it; 1076 tests; real resize ≤2 frames is R3F/Rig pre-existing); re-review dispatched (sonnet)
Task 14b: fix round 1/5 (1 addressed, 0 open; commits 1939124..7024fa0)
Task 14b: minor (deferred): a real window resize on a sceneless page still draws ≤2 frames (Rig.tsx:90 unconditional invalidate, pre-existing); relayout wiring covered only by the harness
Task 14b: complete (commits 92a4339..7024fa0, review clean after 1 fix round)
Task 15: dispatched (base 7024fa0, implementer sonnet, report task-15-report.md)
Task 15: implementer DONE_WITH_CONCERNS 80fcdeb (-8309 lines; tests 1076→870 with removed modules; gates + full harness 31/31 pass; Stage chunk 346.58→346.43 kB); shoulder()/SHOULDER moved to src/engine/studio/shoulder.ts; compass-hero.webp kept for og.mjs; Annulus tests moved; dialSvg tests dropped with dialSvg; core/Handlers + deadline kept per brief though unused
Ruling 14: accept removing qa.test.ts's toHaveLength(DRIVE.sectors) — the line above asserts toHaveLength(5) and DRIVE (deleted) was 5, so the guarantee stays — if wrong: none.
Task 15: review dispatched (sonnet, package 7024fa0..80fcdeb)
Task 15: review — spec ✅, quality Approved
Task 15: minor (deferred): ShoulderToneMapping.ts:22 stale 'COMPASS_STUDIO.exposure'; noise.ts noiseTexture now unimported + stale 'haze sprites' doc; palette.ts paletteCss / stillness.ts docs name removed consumers; docs/audit.md lists removed modules as kept (historical); og.jpg still cut from the revision-4 compass-hero.webp (share image shows the old compass); core/Handlers + deadline unimported
Task 15: complete (commits 7024fa0..80fcdeb, review clean)
Final review: dispatched (opus, range 55addff..80fcdeb, triage of deferred minors + rulings check)
Final review: With fixes — Important: (1) touch drift never reaches Aruba (idle sleeps after 12 s, mid-cycle); (2) header shows during the loader (spec: no text but ON); (3) needle end-on at landing (bearing 0, camera due south) reads as a spire. Minor: loader macro crop 1.0–1.25 (→M3), tablet mouse never steers (aimSource needs finePointer), rare hard cut on mid-opening return (accept), stale comments sweep, CSS fail-safe in old browsers (trivial). Triage: doc sweep before merge; og.jpg is an M6 launch blocker; rest stays deferred. Rulings 1–14 all judged sound.
Ruling 15: the landing rests the needle side-on at bearing 60° (empty sky between the ship and China, no label lit) so its length reads at first sight; touch drift starts from there toward China — spec says 'the needle is long and gold' and the camera must look north, so a north rest is inherently end-on — if wrong: Bob prefers it resting on the ship; one constant.
Ruling 16: hide the header under html[data-loading] (fade in with the hero), but show it on :focus-within so keyboard users keep the Lite/3D escape — spec §2.1/§3: the loader has no text — if wrong: Bob wants the header visible as the way out.
Ruling 17: touch/no-pointer drift keeps idling until it has visited all three constellations (≥ one DRIFT_CYCLE after each stir) before resting; aimSource uses 'pointer' whenever a mouse/pen has moved (no finePointer requirement) — spec §2.2 drift between the three; tablets with a mouse — if wrong: phones idle longer (power).
Final fix wave: dispatched (base 80fcdeb, implementer opus, report final-fix-report.md; Rulings 15–17 + Minor 5 + doc sweep; full harness to proof-final)
Final fix wave: implementer done 1e9d5a0, 352d78c, ed530b2, 9628ae7 (881 tests, gates ok, harness 31/31; needle full length 365 px at landing, loader text-free)
Ruling 15 (amended): landing bearing 40° instead of 60° — China's range starts at 50.1° after 14b, so 60° would light China; 40° keeps a 10° margin in the empty sky — if wrong: one constant in aim.ts.
Final fix wave: notes — reduced-motion phones never drift so never name a constellation (acceptable: reduced motion = no idle motion); drifting home draws ~30 s before sleeping (was ~14 s); hidden header takes no clicks during the loader (keyboard focus reveals it)
Final fix wave: re-review — all 5 findings ADDRESSED, no new Critical/Important (minor: reduced-motion touch phones never name a constellation; hidden header takes no mouse clicks during the loader; plan text still says IDLE_SECONDS 12 for drift)
Final review: clean after one fix wave (commits 80fcdeb..9628ae7)
