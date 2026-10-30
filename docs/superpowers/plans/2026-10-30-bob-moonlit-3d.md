# Round 8: the moonlit storm, a polished compass and tower — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Bob's rule overrides the recommendation: "DO NOT use subagent". Execute inline (superpowers:executing-plans).

**Goal:** Replace the painted storm with plates rendered from real 3D moonlit clouds in Blender, and make the compass and the tower look machined: round rims, smoked glass with gold inlay, lacquered boards, gold and steel lips, rounded parts, brushed metal.

**Architecture:** A committed headless Blender script renders the storm's plates (wall, sea, a bank with alpha for the flats, two flash plates) into `src/assets/storm/`; the existing storm builder draws them as before, its flats taking coverage from the bank's alpha and its flash from the flash plates. The compass GLB is re-exported with round rims and a bevelled needle; its materials (compass.ts) and the boards (plate.ts) gain attenuation, an inlay mask, lacquer, lips and rounded parts, tiered.

**Tech Stack:** three 0.186 (MeshPhysicalMaterial attenuation, anisotropy, clearcoat; RoundedBoxGeometry), R3F, Vitest, Blender 5.2 Cycles (OptiX) headless, sharp 0.35 for WebP, the proof harness `tools/proof/needle.mjs` (playwright-core + Edge).

**Spec:** `docs/superpowers/specs/2026-10-30-bob-moonlit-3d-design.md`

## Global Constraints

- Branch `bob-stack-8` in the worktree `C:/Users/bhcco/Downloads/Portfolio-bob/.claude/worktrees/bob-dive`; never merge or push without Bob's word.
- No subagents. Never edit `.impeccable/config.json`; never run `impeccable hooks ignore-value`; never use port 4399.
- The dark gate: a still's mean luma at most 0.11 at home and the stops, 0.15 with a project open.
- The storm loads after the home has landed and never holds the loader; reduced motion, the low tier, a hidden tab: the storm stands still as now.
- All five storm plates together at most 1.2 MB; the compass GLB at most 900 kB (`COMPASS_GLB_BUDGET`, 700 kB today, raised only if the round rims need it).
- Low tier: today's look (no transmission, plain parts, no brushing), with the new plates.
- Targets: `.superpowers/r7/blender/home-moon.png` (start screen) and `.superpowers/r7/blender/world-new.png` (tower). The B render's settings: `.superpowers/r7/blender/concept_home.py` run with `moon` (git-ignored, local).
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Blender: `"/c/Program Files (x86)/Steam/steamapps/common/Blender/blender.exe" -b --factory-startup --python <script> -- <args>`.
- Proof: `BASE=http://localhost:4421 PLAYWRIGHT_CORE=C:/Users/bhcco/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright-core STEPS=<steps> node tools/proof/needle.mjs`, after `npm run build` (4421 serves `dist/client`).

## Review Focus

1. A plate saved without its alpha (the bank as opaque WebP): the flats would stand as black walls over the sky. Pinned in Task 1 (the bank's alpha and real transparent share).
2. The plates' orientation mirrored or flipped against the sky's mapping: the flash would light empty sky, the horizon would sit off the glass. Pinned in Task 1 (a marker render) and Task 3 (the flash lands on cloud).
3. Glare: a white block of reflected light on the glass bands or the lips (the anti-goal). Pinned in Task 7 (clipped share in the compass's box).
4. Phones: the rounded parts' vertex count, the plates' size, the GLB's size. Pinned in Tasks 1, 4 and 6 (tier and budget tests).
5. The low tier quietly changed (transmission, brushing or rounded parts leaking into it). Pinned in Tasks 5 and 6.

---

### Task 1: The storm plates, rendered from real clouds

**Files:**
- Create: `tools/blender/storm_plates.py`, `tools/storm_webp.mjs`
- Replace: `src/assets/storm/storm-wall.webp`, `src/assets/storm/storm-sea.webp`
- Create: `src/assets/storm/storm-bank.webp`, `src/assets/storm/storm-wall-flash.webp`, `src/assets/storm/storm-bank-flash.webp`
- Test: `tests/unit/bob/storm-assets.test.ts`

**Interfaces:**
- Produces: the five files above. Mapping (the sky shader's, `src/engine/bob/build/storm.ts`): `u` 0..1 ↔ azimuth −112.5°..+112.5° measured from straight behind the compass (three's −z) toward +x; wall and bank `v` 0..1 (image bottom to top) ↔ elevation −0.32..0.48 rad; sea `v` ↔ −0.48..0.32 rad. Wall, sea and bank 2688 × 1152; flash plates 1344 × 576. Bank and flashes carry alpha / are black where nothing glows.

- [ ] **Step 1: Write the failing test** `tests/unit/bob/storm-assets.test.ts`, reading the files with sharp:

```ts
describe('the storm plates rendered from real clouds', () => {
  it('has all five plates, wall, sea and bank at 2688 x 1152, the flashes at 1344 x 576');
  it('keeps the five within 1.2 MB together');
  it("gives the bank its own alpha, with the sky let through: at least 30% of its pixels below alpha 0.1 and 15% above 0.9");
  it('keeps the wall and the sea opaque, and the flash plates black but for their glow (median luma under 0.02, peak over 0.5)');
});
```

- [ ] **Step 2: Run it to see it fail.** Run: `npx vitest run tests/unit/bob/storm-assets.test.ts`. Expected: FAIL (no `storm-bank.webp`).

- [ ] **Step 3: Write `tools/blender/storm_plates.py`**: `-- <plate> <out.png> [samples] [scale%]`, `plate` one of `wall | sea | bank | wall-flash | bank-flash`. Cycles, OptiX, AgX "Medium High Contrast", the B render's volume material (world-space noise, carve, edge fade), cloud colour `(0.46, 0.36, 0.78)`, moons `(1.6, 2.6)` at the B render's angles. Camera: panoramic equirectangular at three's origin 1 m up (Blender `(0, 0, 1)`), longitude and latitude ranges from the Interfaces block, facing three's −z (Blender +y). Scenes:
  - `wall`: a ring of storm round the camera, inner radius 24 m, outer 95 m, from 1 m below the horizon to 30 m up (a box with a radial clear in the density), plus a far layer; opaque world.
  - `sea`: a slab of storm 2 to 22 m below the camera, clear within 6 m of it.
  - `bank`: one ring of storm 30 to 48 m out, standing from the floor to 14 m, `film_transparent` on, nothing else.
  - `wall-flash`, `bank-flash`: the same volumes, moons off, world black, the clouds' emission alone: seven glow sites at azimuths −90, −60, −30, 0, 30, 60, 90° inside the cloud (radius 5 m, the B render's colour `(1.0, 0.5, 0.16)`).

- [ ] **Step 4: Check orientation before rendering all.** Render `wall` at 25% with a 2 m emissive cube placed at three's `(+30, 4, -30)` (Blender `(30, 30, 4)`); expected: it shows in the right half, above the middle (u ≈ 0.7, v ≈ 0.6). Remove the cube.

- [ ] **Step 5: Render the five** at 100%, 256 samples, into the scratchpad; then `tools/storm_webp.mjs <in dir> src/assets/storm` turns each PNG into WebP (quality 82, `alphaQuality` 90 for the bank, flash plates resized to half), printing each size.

- [ ] **Step 6: Run the test.** Expected: PASS 4/4; if over 1.2 MB, lower quality in `storm_webp.mjs`, never the resolution.

- [ ] **Step 7: Commit** the script, the converter, the five plates and the test: `storm: plates rendered from real moonlit clouds in Blender (Bob picked B)`.

### Task 2: The storm draws the new plates

**Files:**
- Modify: `src/scene/bob/stormPlates.ts`, `src/engine/bob/build/storm.ts`, `src/scene/bob/Void.tsx:664-672` (type only)
- Test: `tests/unit/bob/build-storm.test.ts`

**Interfaces:**
- Consumes: Task 1's files.
- Produces: `export interface StormPlates { wall: THREE.Texture; sea: THREE.Texture; bank: THREE.Texture; wallFlash: THREE.Texture; bankFlash: THREE.Texture }`; `loadStormPlates(): Promise<StormPlates>`; `buildStorm(plates: StormPlates): StormModel`; `STORM.flash.gain: number` in `src/scene/bob/storm.ts`.

- [ ] **Step 1: Write the failing tests** in `build-storm.test.ts` (its `plates()` helper gains the three new textures):
  - `"gives the flats the bank plate, its coverage by the bank's own alpha"`: each flat's `uBank.value === plates.bank`, no `uWall` uniform on flats, and the flat fragment shader reads `texture2D(uBank` and does not contain `smoothstep(0.004, 0.05, lum)`.
  - `"lights the flash from the flash plates, never by brightening warm pixels"`: the sky has `uWallFlash`, each flat `uBankFlash`; neither fragment contains `colour.r - colour.b` or `c.r - c.b`; both contain `uFlashGain`, whose value is `STORM.flash.gain`.
  - extend `'frees its geometries, materials and plates on dispose'` to all five plates.
- [ ] **Step 2: Run** `npx vitest run tests/unit/bob/build-storm.test.ts`. Expected: FAIL on the new tests.
- [ ] **Step 3: Implement.** `loadStormPlates` loads the five (sRGB, mirrored wrap, anisotropy 4; the bank keeps its alpha; premultiplied off). Sky: above the horizon add `texture(uWallFlash, uv).rgb * exp(-off*off) * uFlash * uFlashGain`; the sea gets no flash. Flats: `vec4 b = texture2D(uBank, uv + n.xy * 0.01)`, coverage `a = b.a` times the existing edge fades, flash `texture2D(uBankFlash, uv).rgb * exp(-off*off) * uFlash * uFlashGain`. `STORM.flash.gain` starts at 1 (tuned in Task 3).
- [ ] **Step 4: Run** the file, then `npx vitest run` and `npx tsc --noEmit`. Expected: all pass.
- [ ] **Step 5: Commit**: `storm: draws the rendered plates, the flats covered by the bank's alpha, the flash from its own plates`.

### Task 3: The storm's levels against the dark gate

**Files:**
- Modify: `src/scene/bob/storm.ts` (`STORM.sky`, `STORM.flats[].level` and `.foot`, `STORM.flash.gain`), `src/engine/bob/build/storm.ts` (`STORM_SKY.light`)
- Test: `tests/unit/scene/bob-storm.test.ts`, `tests/unit/bob/build-storm.test.ts`

- [ ] **Step 1: Measure.** `npm run build`, then the harness with `STEPS=storm,stills`; save the start screen, the fall (way frame 60 and 121), the tower and an open project at 1440 × 900 and 390 × 844 (the `storm` step writes `proof-out/m2/storm-*`); read each mean luma from the log. Put the start screen beside `home-moon.png` (sharp, side by side, in `.superpowers/stack-8/`). Take one still at a flash's peak (the storm's clock from `__needleDebug`, `stormFlash`) and one between flashes: the gold must sit inside a cloud, not in empty sky.
- [ ] **Step 2: Choose the numbers**: the sky's `home`, `fall`, `void`, `open`, `STORM_SKY.light`, each flat's `level` and `foot` (the bank's base, the horizon, sits at plate v = 0.4: a flat's `foot` puts its bottom edge there or just under) and `STORM.flash.gain` (the flash a faint gold glow in one cloud, as B), so the start screen reads as `home-moon.png` and every still holds its gate with at least 0.005 to spare. Keep the existing orderings the tests pin (nearer flats brighter; void above fall).
- [ ] **Step 3: Update the pins first** in `bob-storm.test.ts` (`STORM.sky.home`, `.fall`, `.void`, `STORM.sea.fall` stays 0.15) and add `expect(STORM.flash.gain).toBe(<chosen>)`; run; expected: FAIL on the changed numbers.
- [ ] **Step 4: Set the constants**; run the two test files, then the harness `STEPS=storm,stills,sleep`. Expected: PASS, every still within its gate.
- [ ] **Step 5: Commit**: `storm: levels for the moonlit plates, under the dark gate`.

### Task 4: The compass file: round rims, a bevelled needle

**Files:**
- Modify: `tools/blender/export_compass.py` (`RIM_RES`, the needle), `public/models/bob-compass.glb`, maybe `src/engine/bob/glb.ts` (`COMPASS_GLB_BUDGET`)
- Test: `tests/unit/bob/compass-glb.test.ts`

- [ ] **Step 1: Write the failing tests:**
  - `'makes each rim a round tube: at least 16 sides round it'`: `rim_1`..`rim_4` each have at least `2 * 96 * 16` positions (two edge splines, `RIM_SEG` 96 round, 16 sides).
  - `'bevels the needle: its edges rounded, not six points'`: `needle` has at least 60 positions.
- [ ] **Step 2: Run** `npx vitest run tests/unit/bob/compass-glb.test.ts`. Expected: FAIL on both.
- [ ] **Step 3: Change the export**: `RIM_RES = 3` (4 + 4·3 = 16 sides) for the rims (the axis may stay 1), smooth-shaded; the needle keeps its diamond section and gets a bevel modifier (width 0.006, 2 segments, harden normals) applied on export; node names, UVs and the `rise` clip as they are. Re-export: `blender -b --factory-startup --python tools/blender/export_compass.py -- public/models/bob-compass.glb`.
- [ ] **Step 4: Run** the GLB test and `tests/unit/bob/build-compass.test.ts`. Expected: PASS; if only the budget fails, raise `COMPASS_GLB_BUDGET` to `900_000` (no further) and lower `RIM_SEG` before going past it.
- [ ] **Step 5: Commit**: `compass: round rims and a bevelled needle in the file`.

### Task 5: The compass's glass, inlay and gold

**Files:**
- Create: `src/engine/bob/build/brushed.ts`
- Modify: `src/engine/bob/build/compass.ts` (`COMPASS_LOOK`, `patchMarks`, `loadCompass`), `src/engine/bob/build/room.ts` (`ROOM_LOOK`)
- Test: `tests/unit/bob/build-compass.test.ts`, `tests/unit/bob/brushed.test.ts`

**Interfaces:**
- Produces: `brushedTexture(seed: number): THREE.DataTexture` (a small roughness map of fine streaks along u, 256 × 32 RGBA bytes, the value in the green channel as three reads roughness, repeat-wrapped, `NoColorSpace`; data, so it needs no canvas and runs in the tests); `COMPASS_LOOK.bandGlass.attenuation: { colour: number; distance: number }`; `COMPASS_LOOK.bandMarks.inlay: { colour: number; metalness: 1; roughness: number }`; `COMPASS_LOOK.gold.anisotropy: number`, `.brushed: { roughness: [number, number] }`. Task 6 consumes `brushedTexture`.

- [ ] **Step 1: Write the failing tests:**
  - `brushed.test.ts`: `'is the same streaks for the same seed, repeat-wrapped, without colour space'` and `'streaks along u: rows vary far more than columns'`.
  - `build-compass.test.ts`:
    - `'smokes the glass: violet attenuation where light passes, on the tiers that see through it'`: high and medium bands have `attenuationDistance === COMPASS_LOOK.bandGlass.attenuation.distance` and `attenuationColor` equal to its colour; low has `attenuationDistance === Infinity` and `transmission === 0`.
    - `'inlays the marks in gold: metal and not see-through where the strip has a mark'`: run the band's `onBeforeCompile` on `{ uniforms: {}, fragmentShader: THREE.ShaderLib.physical.fragmentShader }`; the result reads `markCover` once before `roughnessFactor` is used, and contains `metalnessFactor = mix(`, `roughnessFactor = mix(`, `diffuseColor.rgb = mix(` and `material.transmission = transmission * ( 1.0 - markCover )`.
    - `'brushes the gold on high and medium, as before on low'`: high/medium gold is `MeshPhysicalMaterial` with `anisotropy === COMPASS_LOOK.gold.anisotropy` and a `roughnessMap`; low gold is the `MeshStandardMaterial` of today.
- [ ] **Step 2: Run** both files. Expected: FAIL.
- [ ] **Step 3: Implement.** `patchMarks` reads `markCover` at `#include <roughnessmap_fragment>` (it comes first), mixes roughness, metalness and the diffuse colour toward the inlay, keeps the existing emissive add (at a lower `bandMarks.intensity` if the stills need it) and alpha raise, and replaces `#include <transmission_fragment>` with `THREE.ShaderChunk.transmission_fragment` whose `material.transmission = transmission;` becomes the line the test pins. Attenuation only where transmission > 0. Starting values: attenuation colour `palette.violet`, distance 0.08; inlay roughness 0.3; gold anisotropy 0.5, brushed roughness 0.16..0.3.
- [ ] **Step 4: Tune the light against the target.** `npm run build`, harness `STEPS=stills,storm`; compare the start screen with `home-moon.png`. If the glass shows a white patch, lower the cream soft-box card's radiance in `ROOM_LOOK`; make the back card a pale violet (`palette.lilac`) for the moon's rim. Pin the chosen `ROOM_LOOK` numbers in `tests/unit/bob/build-room.test.ts`, test first.
- [ ] **Step 5: Run** `npx vitest run` and `npx tsc --noEmit`. Expected: all pass.
- [ ] **Step 6: Commit**: `compass: smoked glass, gold inlay marks, brushed gold`.

### Task 6: The tower: lacquer, lips, rounded parts, brushed metal

**Files:**
- Modify: `src/engine/bob/build/plate.ts` (`PLATE_LOOK`, `buildPlate`, `buildParts`, `partMaterials`), maybe `src/engine/bob/build/world.ts` (a soft key light)
- Test: `tests/unit/bob/build-plate.test.ts`

**Interfaces:**
- Consumes: `brushedTexture` (Task 5).
- Produces: `PLATE_LOOK.lacquer: { clearcoat: number; clearcoatRoughness: number }`, `PLATE_LOOK.lip: { tube: number; gold: number; steel: number }` (colours), `PLATE_LOOK.round: { radius: number; segments: number }`; meshes `plate:lip:top`, `plate:lip:bottom`; `buildParts(parts, mats, tier: QualityTier)`.

- [ ] **Step 1: Write the failing tests:**
  - `'lacquers the board: a full, nearly smooth clear coat'`: `plate:top`'s material `clearcoat === PLATE_LOOK.lacquer.clearcoat` (1) and `clearcoatRoughness === PLATE_LOOK.lacquer.clearcoatRoughness` (at most 0.08).
  - `'lines each plate with a gold lip on top and a steel lip below, hugging the edge'`: both meshes present on every tier, torus centres on the axis, the top one at y in `[-tube, 0]`, the bottom one at y in `[-THICK, -THICK + tube]`, major radius within `tube` of the plate's radius; the top lip's material metalness 1 and colour `PLATE_LOOK.lip.gold`; both dim with the board (`set(clock, 0, 1)` darkens their colour, as the test `'stands dark until its power comes'` checks for the others); on low the lips are plain `MeshStandardMaterial` metal without a roughness map.
  - `'rounds the box parts on the high tier only'`: on high, `plate:qfp`'s geometry has more than 24 positions; on medium and low exactly 24.
- [ ] **Step 2: Run** `npx vitest run tests/unit/bob/build-plate.test.ts`. Expected: FAIL on the three.
- [ ] **Step 3: Implement.** Top material takes `PLATE_LOOK.lacquer`. Lips: `TorusGeometry(R - tube * 0.3, tube, 12, 256)` laid flat; gold lip `MeshPhysicalMaterial` metal, `anisotropy` 0.5 with `brushedTexture` as roughness map on high/medium; steel lip the same in steel; both in `dimming`, given the room. The edge keeps its maps, its roughness floor above the lips' (a little rougher, as the spec says). `buildParts` takes `tier` and its `box` helper makes `RoundedBoxGeometry(w, h, d, PLATE_LOOK.round.segments, min(PLATE_LOOK.round.radius, min(w, h, d) / 2.5))` on high. Starting values: tube 0.022, round radius 0.006, segments 2, lacquer 1 / 0.05.
- [ ] **Step 4: Tune against `world-new.png`.** `npm run build`, harness `STEPS=stills,storm` (the tower and an open project); if the boards and lips do not read, add one soft `DirectionalLight` from the front left above to the world (`world.ts`), dimmed with the board's power, and pin its direction and intensity in the world's test, test first. Every still within its gate.
- [ ] **Step 5: Run** `npx vitest run` and `npx tsc --noEmit`. Expected: all pass.
- [ ] **Step 6: Commit**: `tower: lacquered boards, gold and steel lips, rounded parts`.

### Task 7: Proof, review page, build notes

**Files:**
- Modify: `tools/proof/needle.mjs`, `docs/superpowers/specs/2026-10-30-bob-moonlit-3d-design.md` (a "Build notes" section)
- Create: `.superpowers/stack-8-site-review/` (git-ignored)

- [ ] **Step 1: Add the glare guard** to the harness's `storm` step: at the start screen, in the compass's box (the canvas's middle 50% × 60%), the share of pixels with luma above 0.95 is at most 0.002, on both sizes. Run `STEPS=storm`; expected: PASS (if FAIL, back to Task 5 Step 4).
- [ ] **Step 2: Run the full harness** in the background (about 20 minutes) and the suite. Expected: every step PASS (a step that fails only in the full run is rerun alone and named in the report), the suite green, `tsc` clean.
- [ ] **Step 3: Write the build notes** in the spec: the plates' sizes, the chosen levels and their stills' lumas, the rim sides and GLB size, the lips, any key light, the frame rate the storm step reads.
- [ ] **Step 4: Make the review page** on port 4473: for home, the fall, the tower and an open project at 1440 × 900 and 390 × 844, the site's still beside the render Bob picked (or beside today's live still where no render exists), and how to open the live build on 4421.
- [ ] **Step 5: Commit** the harness and the notes: `proof: the glare guard; round 8 build notes`. Then stop: Bob looks before anything is merged.
