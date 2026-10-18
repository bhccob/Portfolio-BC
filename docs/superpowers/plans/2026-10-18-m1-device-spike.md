# Milestone 1: Foundation and Device Spike Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the solid, stylised 3D handheld in Three.js with the new type and colours. Its teardown (screen → board → battery → back plate) is scrubbed by scroll on a review page, `/lab/device/` (NL) and `/en/lab/device/` (EN), so Bob can judge the look and the motion before any Higgsfield credits are spent.

**Architecture:**
- **Pure choreography:** a pure TypeScript module maps scroll progress (0–1) to a `Pose`: layer heights, camera, focused layer and section. It is unit-tested with Vitest.
- **Model:** a model builder turns the palette and the part builders into a `THREE.Group` that `applyPose()` can drive.
- **Renderer:** a `DeviceScene` class owns the renderer, lighting, the eased progress and chip raycasting.
- **Review page:** the page uses a new `BenchLayout` (the seed of the redesign's layout, reused in milestone 3) and a GSAP ScrollTrigger scrub with Lenis.
- **Existing pages:** untouched in this milestone.

**Tech Stack:**
- Astro 7.3.8 and TypeScript
- three 0.186.1 (with `three/addons`)
- GSAP 3.15.0 ScrollTrigger and Lenis 1.3.26 (already installed)
- Vitest 5.0.3
- @fontsource-variable/unbounded 5.3.0, @fontsource-variable/geist 5.3.0, @fontsource-variable/martian-mono (installed)

**Spec:** `docs/superpowers/specs/2026-10-18-portfolio-redesign-design.md` (milestone "1. Device spike")

## Global Constraints

- **Branch:** work on `redesign-bench`. Never push or merge to `main` without Bob's explicit OK.
- **Dependency versions:** pinned exactly, with no `^` (house style of `package.json`): `three` 0.186.1, `@types/three` 0.186.0, `vitest` 5.0.3, `@fontsource-variable/unbounded` 5.3.0, `@fontsource-variable/geist` 5.3.0.
- **Palette:**
  - board `#140a24` / `#1c1030`, signal yellow `#ffcf33`, cream `#f1e8d3`
  - PCB purple `#4b2a8a`, gold contacts `#d9a520`
  - lilac text `#b8aad8`, dim `#9789bb`
- **Type:**
  - Unbounded for titles and names
  - Geist for body text
  - Martian Mono (uppercase, 11–12px, tracking 0.12em) for HUD labels
  - nothing else
- **3D look:** solid and stylised (toy-like rounded shapes, smooth matte to satin materials). Not wireframe, not realistic textures.
- **Assets:** all self-hosted. The CSP in `astro.config.mjs` is not loosened, and nothing loads from a CDN.
- **Portrait:** the real `src/assets/portrait.jpg` only.
- **Copy:** formal first person, in NL (default, `/`) and EN (`/en/`). Never invent facts.
- **Motion:** only transforms, opacity and the WebGL canvas. Reduced motion gets no scrub.
- **Existing pages** (`/`, `/en/`, `/contact/`, project pages, 404) keep building and looking exactly as before.
- **Checks:**
  - `npx -p typescript tsc --noEmit` and `npm run build` succeed
  - `npm test` passes
  - the Python auditor passes `--strict` (run through Pyodide locally)

## Review Focus

1. **Progress outside 0–1, or NaN.** Lenis and macOS/iOS rubber-band overscroll report values below 0 or above 1. The pose must clamp, and must never produce NaN. Tested in Task 1.
2. **No WebGL** (blocked GPU, `--disable-3d-apis`, a lost context). The page must still show every section's text and a closed-device still, with no uncaught error. Tested in Task 5 (Edge launched with `--disable-3d-apis`).
3. **Reduced motion.** No scrub and no pinning. All section text shows as a normal page, with the device in its closed pose. Tested in Task 5.
4. **Resize or orientation change mid-scroll.** The canvas matches the new size and aspect, with no stretched frame, and the pose stays at the current progress. Tested in Task 5.
5. **Hidden tab or stage scrolled away.** The render loop stops scheduling frames. Tested in Task 3 (`RenderLoop`) and Task 5.

---

### Task 1: Teardown choreography (with test tooling)

**Files:**
- Modify: `package.json`. Add the devDependencies `vitest` 5.0.3 and `@types/three` 0.186.0, the dependencies `three` 0.186.1, `@fontsource-variable/unbounded` 5.3.0 and `@fontsource-variable/geist` 5.3.0, and the script `"test": "vitest run"`.
- Create: `vitest.config.ts`, with `test.include: ['tests/unit/**/*.test.ts']` and `environment: 'node'`.
- Modify: `.github/workflows/deploy.yml`. Add a step `- name: Unit tests` / `run: npm test` right after "Install dependencies".
- Create: `src/scripts/three/Teardown.ts`
- Test: `tests/unit/teardown.test.ts`

**Interfaces:**
- Produces:

```ts
export type LayerId = 'shell' | 'screen' | 'board' | 'battery' | 'back';
export type SectionId = 'hello' | 'about' | 'projects' | 'offduty' | 'spec';
export type Vec3 = readonly [number, number, number];
export interface Pose {
  explode: number;                       // 0 closed … 1 fully apart
  offsets: Record<LayerId, number>;      // world-space Y of each layer
  focus: LayerId | null;                 // layer the camera is on
  section: SectionId;
  camera: { position: Vec3; target: Vec3 };
}
export const LAYERS: readonly LayerId[];                 // top → bottom: shell, screen, board, battery, back
export const SECTIONS: readonly { id: SectionId; from: number; layer: LayerId | null }[];
export function sectionAt(progress: number): SectionId;
export function poseAt(progress: number): Pose;
```

**Values the spec pins (use exactly):**
- **`SECTIONS`:**
  - hello `0` (layer null)
  - about `0.16` (screen)
  - projects `0.34` (board)
  - offduty `0.66` (battery)
  - spec `0.84` (back)
- **Closed heights:** shell `0.30`, screen `0.24`, board `0.12`, battery `0.04`, back `0`.
- **Exploded offset:** `closed + explode × index-from-bottom × 0.9`. The indexes are back 0, battery 1, board 2, screen 3, shell 4.
- **`explode`:** `smoothstep(0.06, 0.20, p)`.
- **Camera:**
  - **hello:** position `[3.2, 3.0, 4.2]`, target `[0, 0.15, 0]`.
  - **Every other section:** target `[0, offsets[layer], 0]`, position `target + [0, 2.6, 3.4]`.
  - **Moving between sections:** ease with smoothstep over the first 40% of the next section's span.
- Progress is clamped to [0, 1] first, and NaN is treated as 0.

- [ ] **Step 1: Install and wire Vitest.** Run `npm install` after editing `package.json`.
  - Expected: the lockfile updates, with no errors.
- [ ] **Step 2: Write the failing tests** in `tests/unit/teardown.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { LAYERS, poseAt, sectionAt } from '../../src/scripts/three/Teardown';

describe('poseAt', () => {
  it('starts closed on hello', () => {
    const p = poseAt(0);
    expect(p.explode).toBe(0);
    expect(p.section).toBe('hello');
    expect(p.focus).toBeNull();
    expect(p.offsets).toEqual({ shell: 0.3, screen: 0.24, board: 0.12, battery: 0.04, back: 0 });
    expect(p.camera.position).toEqual([3.2, 3.0, 4.2]);
  });
  it('ends fully apart on the back plate', () => {
    const p = poseAt(1);
    expect(p.explode).toBe(1);
    expect(p.section).toBe('spec');
    expect(p.focus).toBe('back');
  });
  it('clamps out-of-range and NaN progress', () => {
    expect(poseAt(-0.5)).toEqual(poseAt(0));
    expect(poseAt(1.7)).toEqual(poseAt(1));
    expect(poseAt(Number.NaN)).toEqual(poseAt(0));
  });
  it('keeps layers ordered, finite, and opening monotonically', () => {
    let last = -1;
    for (let i = 0; i <= 100; i++) {
      const p = poseAt(i / 100);
      expect(p.explode).toBeGreaterThanOrEqual(last);
      last = p.explode;
      const ys = LAYERS.map((l) => p.offsets[l]);
      ys.slice(1).forEach((y, k) => expect(y).toBeLessThan(ys[k]));
      [...p.camera.position, ...p.camera.target].forEach((n) => expect(Number.isFinite(n)).toBe(true));
    }
  });
});

describe('sectionAt', () => {
  it.each([
    [0.159, 'hello'], [0.16, 'about'], [0.339, 'about'], [0.34, 'projects'],
    [0.66, 'offduty'], [0.84, 'spec'], [1, 'spec']
  ])('%f → %s', (p, id) => expect(sectionAt(p)).toBe(id));
});
```

- [ ] **Step 3: Run `npm test` and check it fails.**
  - Expected: FAIL with "Failed to resolve import ../../src/scripts/three/Teardown".
- [ ] **Step 4: Implement `Teardown.ts`** with the values above. Include a local `smoothstep(a, b, x)` and a `lerp` for camera vectors.
- [ ] **Step 5: Run `npm test`.**
  - Expected: all tests PASS.
- [ ] **Step 6: Commit.**

```bash
git add package.json package-lock.json vitest.config.ts .github/workflows/deploy.yml src/scripts/three/Teardown.ts tests/unit/teardown.test.ts
git commit -m "Redesign: teardown choreography and unit tests"
```

### Task 2: Palette, part builders and the device model

**Files:**
- Create: `src/scripts/three/palette.ts`
- Create: `src/scripts/three/parts/slab.ts`, `src/scripts/three/parts/chip.ts`, `src/scripts/three/parts/trace.ts`
- Create: `src/scripts/three/Device.ts`
- Test: `tests/unit/device.test.ts`

**Interfaces:**
- Consumes: `LayerId`, `LAYERS` and `Pose` from Task 1.
- Produces:

```ts
// palette.ts
export const palette: { board: number; boardDeep: number; yellow: number; cream: number; pcb: number; gold: number; lilac: number; ink: number };
// parts/slab.ts — rounded box (RoundedBoxGeometry from 'three/addons/geometries/RoundedBoxGeometry.js'), satin material
export function slab(width: number, height: number, depth: number, radius: number, color: number): THREE.Mesh;
// parts/chip.ts — chip body with gold pins on two sides; userData.slug = slug
export function chip(slug: string, width: number, depth: number): THREE.Mesh;
// parts/trace.ts — flat gold trace following XZ points at the board's top
export function trace(points: readonly [number, number][], y: number): THREE.Mesh;
// Device.ts
export const CHIP_SLUGS: readonly ['funcial', 'jontai-energy', 'cookies-clicker', 'next'];
export interface DeviceTextures { screen?: THREE.Texture; spec?: THREE.Texture }
export interface DeviceModel {
  group: THREE.Group;
  layers: Record<LayerId, THREE.Object3D>;
  chips: THREE.Mesh[];          // in CHIP_SLUGS order
  powerButton: THREE.Mesh;
  applyPose(pose: Pose): void;  // sets each layers[id].position.y = pose.offsets[id]
}
export function buildDevice(textures?: DeviceTextures): DeviceModel;
```

**Design values:**
- **Handheld body:** a landscape handheld, 3.2 wide (x) by 1.8 deep (z), corner radius 0.32.
- **shell:** the purple `pcb`-toned top case, 0.06 thick, with a screen opening.
  - a raised D-pad (cream) on the left
  - two round buttons (cream) on the right
  - **power button:** a yellow sphere, radius 0.09, on the top-right edge. It is the ball mark.
- **screen:** a 1.5 × 0.95 display module in board-deep, with an emissive plane where `textures.screen` goes.
- **board:** a pcb-purple slab with gold traces and four chips:
  - `funcial` 0.55 × 0.4
  - `jontai-energy` 0.55 × 0.34
  - `cookies-clicker` 0.45 × 0.4
  - `next`: an empty socket, an outline in dim lilac
- **battery:** a cream slab with a yellow band.
- **back:** a board-colour plate with a label plane for `textures.spec`.
- **Materials:** `MeshPhysicalMaterial`, roughness 0.45–0.6, clearcoat 0.3 on the case parts.

- [ ] **Step 1: Write the failing test** `tests/unit/device.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildDevice, CHIP_SLUGS } from '../../src/scripts/three/Device';
import { LAYERS, poseAt } from '../../src/scripts/three/Teardown';
import { palette } from '../../src/scripts/three/palette';

describe('buildDevice', () => {
  const device = buildDevice();
  it('has every layer inside the group', () => {
    LAYERS.forEach((id) => expect(device.layers[id].parent).toBe(device.group));
  });
  it('carries the four chips in order', () => {
    expect(device.chips.map((c) => c.userData.slug)).toEqual([...CHIP_SLUGS]);
    device.chips.forEach((c) => expect(c.parent).not.toBeNull());
  });
  it('uses the yellow ball as the power button', () => {
    const material = device.powerButton.material as { color: { getHex(): number } };
    expect(material.color.getHex()).toBe(palette.yellow);
  });
  it('applies a pose to layer heights', () => {
    const pose = poseAt(0.5);
    device.applyPose(pose);
    LAYERS.forEach((id) => expect(device.layers[id].position.y).toBeCloseTo(pose.offsets[id]));
  });
});
```

- [ ] **Step 2: Run `npm test`.**
  - Expected: FAIL (the module is missing).
- [ ] **Step 3: Implement** `palette.ts`, the three part builders and `Device.ts` to the values above. Chips are children of `layers.board`.
- [ ] **Step 4: Run `npm test`.**
  - Expected: PASS.
- [ ] **Step 5: Commit.**

```bash
git add src/scripts/three tests/unit/device.test.ts
git commit -m "Redesign: stylised handheld model and part builders"
```

### Task 3: Render loop and DeviceScene

**Files:**
- Create: `src/scripts/three/RenderLoop.ts`
- Create: `src/scripts/three/DeviceScene.ts`
- Test: `tests/unit/render-loop.test.ts`

**Interfaces:**
- Consumes: `buildDevice` and `DeviceModel` (Task 2), `poseAt` (Task 1).
- Produces:

```ts
export class RenderLoop {
  constructor(tick: (dtSeconds: number) => void,
              raf?: (cb: FrameRequestCallback) => number,
              caf?: (id: number) => void);
  setActive(active: boolean): void;   // idempotent; never two loops
  get running(): boolean;
}
export class DeviceScene {
  static supported(): boolean;        // WebGL2 context can be created
  constructor(canvas: HTMLCanvasElement, options: { finePointer: boolean; screen?: HTMLImageElement; specLines: readonly string[] });
  setProgress(progress: number): void; // target; eased toward in tick with damp λ = 8
  setActive(active: boolean): void;    // forwards to RenderLoop
  resize(): void;                      // reads canvas.clientWidth/Height
  onChip(handler: (slug: string | null, kind: 'hover' | 'click') => void): void;
  dispose(): void;
}
```

**Renderer settings:**
- `antialias: true`, `outputColorSpace` sRGB, ACES filmic tone mapping with exposure 1.0
- pixel ratio capped at 1.75 (fine pointer) or 1.25 (coarse)
- environment: `RoomEnvironment` through `PMREMGenerator`
- one directional key light
- a soft contact shadow: a ground plane with a radial-gradient `CanvasTexture`
- camera: FOV 35

**Behaviour:**
- **Idle sway:** ±3° on Y in the hello section only.
- **Chip hover:** the hovered chip lifts 0.06 and gets a yellow emissive at 0.25 intensity.
- **Textures:** the spec label (two lines from `specLines`, Martian Mono, yellow on board) and the screen (the portrait, cover-cropped) are drawn into `CanvasTexture`s.

- [ ] **Step 1: Write the failing test** `tests/unit/render-loop.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { RenderLoop } from '../../src/scripts/three/RenderLoop';

describe('RenderLoop', () => {
  it('runs one loop however often it is activated, and stops when inactive', () => {
    const queue: FrameRequestCallback[] = [];
    const raf = vi.fn((cb: FrameRequestCallback) => queue.push(cb));
    const caf = vi.fn();
    const tick = vi.fn();
    const loop = new RenderLoop(tick, raf, caf);
    loop.setActive(true);
    loop.setActive(true);
    expect(raf).toHaveBeenCalledTimes(1);
    queue.shift()!(16);
    expect(tick).toHaveBeenCalledTimes(1);
    loop.setActive(false);
    expect(loop.running).toBe(false);
    expect(caf).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run `npm test`.**
  - Expected: FAIL (the module is missing).
- [ ] **Step 3: Implement `RenderLoop`.** Then implement `DeviceScene` to the settings above. `DeviceScene` has no unit test; it is verified in Task 5.
- [ ] **Step 4: Run `npm test` and `npx -p typescript tsc --noEmit`.**
  - Expected: PASS, and 0 type errors.
- [ ] **Step 5: Commit.**

```bash
git add src/scripts/three/RenderLoop.ts src/scripts/three/DeviceScene.ts tests/unit/render-loop.test.ts
git commit -m "Redesign: device scene renderer and render loop"
```

### Task 4: BenchLayout, tokens and the lab review page

**Files:**
- Create: `src/layouts/BenchLayout.astro`. It takes the same props and head as `src/layouts/BaseLayout.astro` (title, description, canonical or noindex, hreflang, Open Graph, JSON-LD, CSP-friendly inline boot script), with these changes:
  - fonts: Unbounded, Geist and Martian Mono only
  - Unbounded is preloaded
  - no Header, LoadingScreen, Terminal, blueprint or grain
  - it imports the new styles
  - its script bootstraps `src/scripts/bench-main.ts`
- Create: `src/styles/bench-tokens.css` (the palette and type tokens above as CSS custom properties) and `src/styles/bench-base.css` (reset, body, `.hud-label`, `.title`, `.lead`, skip link, focus ring in yellow).
- Create: `src/components/bench/DeviceStage.astro`. It renders:
  - a scroll track of 500svh
  - a sticky full-viewport stage with `<canvas data-device-canvas aria-hidden="true">`
  - five `<section data-section="hello|about|projects|offduty|spec">` text blocks, with exactly one `<h1>` (the name, in hello)
  - a still `<img>` of the portrait for the no-WebGL and reduced-motion fallback (real `alt`)
- Create: `src/scripts/bench/DeviceStageController.ts` (extends `Component`) and `src/scripts/bench-main.ts`.
- Create: `src/pages/lab/device.astro` and `src/pages/en/lab/device.astro` (`noindex`).
- Modify: `src/i18n/en.ts` and `src/i18n/nl.ts`. Add a `bench` key (copy below; `nl.ts` is typed against `en.ts`).
- Modify: `astro.config.mjs`. The sitemap filter also excludes `/lab/`.

**Interfaces:**
- Consumes:
  - `DeviceScene` (Task 3)
  - `sectionAt` (Task 1)
  - `Component` (`src/scripts/core/Component.ts`)
  - `App` (`src/scripts/core/App.ts`)
  - `Motion.reduced` and `Motion.finePointer` (`src/scripts/core/Motion.ts`)
- Produces:
  - `BenchLayout` props, identical to `BaseLayout`'s
  - the `bench` dictionary keys used again in milestone 3

**Controller behaviour:**
- **Motion allowed and `DeviceScene.supported()`:**
  - create the Lenis smooth scroll (lerp 0.1) and connect it to `ScrollTrigger.update`
  - one ScrollTrigger on the track (`start: 'top top'`, `end: 'bottom bottom'`, `scrub: true`) calls `scene.setProgress(self.progress)`
  - set `data-active` on the section for `sectionAt(progress)`; CSS fades that section's text in (opacity and translateY only)
  - an `IntersectionObserver` on the stage calls `scene.setActive`
  - `resize` calls `scene.resize()` and `ScrollTrigger.refresh()`
- **Otherwise:** add `data-fallback` to the stage. CSS then drops the pin and shows every section stacked, with the still portrait. No Lenis, no scene.
- **Chip events:** they update a small HUD line (`data-chip-readout`) with the hovered chip's name.

**Copy (EN; NL in the same spirit, formal):**
- **hello:** h1 "Bob Chung"; label "Student software engineer · Rotterdam"
- **about:** "I build software, and I want to understand the hardware it runs on." The label reads "Born in Aruba · Chinese heritage · Rotterdam since eighteen".
- **projects:** label "The board"; title "Projects"; one line, "Each chip is a project. Open one to see how it works." Chip names: Funcial, Jontai Energy, Cookies Clicker, Next socket.
- **offduty:** title "What keeps me charged"; "Running, the gym and gaming. Formerly powerlifting and table tennis."
- **spec:** title "What I work with"; spec lines "Full-stack foundation", "Working with AI"
- **Page meta:**
  - title "Device study | Bob Chung" (NL "Apparaatstudie | Bob Chung")
  - description "A preview of the redesigned portfolio: the device that opens as you scroll." (NL to match)

- [ ] **Step 1: Write the layout, styles, component, controller, pages and i18n keys** described above.
- [ ] **Step 2: Run `npx -p typescript tsc --noEmit`, `npm test` and `npm run build`.**
  - Expected: 0 type errors, the tests pass, and the build writes `dist/lab/device/index.html` and `dist/en/lab/device/index.html`.
- [ ] **Step 3: Check that the sitemap leaves the lab out.** Run `grep -c "/lab/" dist/sitemap-0.xml`.
  - Expected: `0`.
- [ ] **Step 4: Run the auditor through Pyodide,** as in the project memory: mount `dist/` and `tools/`, then run `unittest discover tools` and `site_audit.main(['dist','--strict'])`.
  - Expected: all auditor tests pass, and "0 issues".
- [ ] **Step 5: Commit.**

```bash
git add src/layouts/BenchLayout.astro src/styles/bench-*.css src/components/bench src/scripts/bench src/scripts/bench-main.ts src/pages/lab src/pages/en/lab src/i18n astro.config.mjs
git commit -m "Redesign: bench layout, tokens and the device review page"
```

### Task 5: Verify in headless Edge and record proof for Bob

**Files:**
- Create (scratchpad, not committed): `edge-check.mjs`. It uses `playwright-core` with `executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'` and runs against `npm run preview`.

- [ ] **Step 1: Scrub test** (1440×900, `page.bringToFront()`).
  - Scroll the track to progress 0, 0.25, 0.5, 0.75 and 1, then back to 0. Take a screenshot at each stop.
  - At each stop, read the active section's `data-section`.
  - Expected: hello, about, projects, offduty, spec, hello; no console errors.
- [ ] **Step 2: FPS.** Scroll the whole track over 6 s with `mouse.wheel` steps, counting `requestAnimationFrame` callbacks.
  - Expected: a median of ≥ 55 fps (report the number either way).
- [ ] **Step 3: Chip hover.** At progress 0.5, move the mouse over the projected centre of the `funcial` chip.
  - Expected: the HUD readout shows "Funcial".
- [ ] **Step 4: Resize.** At progress 0.5, resize to 900×1200.
  - Expected: canvas `width / height` equals the viewport ratio within 2%, and the section is still "projects".
- [ ] **Step 5: Reduced motion and no WebGL.** Load once with `reducedMotion: 'reduce'`, and once with Edge launched with `--disable-3d-apis`.
  - Expected: the stage has `data-fallback`, all five sections are visible, the portrait still loads, and there are no page errors.
- [ ] **Step 6: Phone.** At 390×844 with touch, drag up through the track with `Input.dispatchTouchEvent`.
  - Expected: the sections advance and there are no errors.
- [ ] **Step 7: Proof.** Record a short video of Step 1's scrub (Playwright `recordVideo`) and keep the five screenshots in the scratchpad. Send them to Bob.
- [ ] **Step 8: Commit** any fixes from Steps 1–6, with messages naming what changed.

## Later milestones

Each later milestone gets its own plan, written after Bob reviews the one before it, because each depends on his picks:
- milestone 2 on the device he approves
- milestone 3 on the bench art and video he approves
- milestone 4 on the wording he approves

They are listed with their scope in the spec's "Build order".
