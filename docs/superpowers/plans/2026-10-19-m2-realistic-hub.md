# Milestone 2: Realistic Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace milestone 1's toy device on `/lab/device/` (NL) and `/en/lab/device/` (EN) with the **realistic handheld** in a **dark product-launch studio**, and scrub it by scroll from closed to the **exploded hub** with gold callouts and a vertical "BOB CHUNG". Visitors can drag to turn it and hover the callouts. Bob judges the look before the transitions (milestone 3) are built on it.

**Architecture:**
- A pure `HubChoreography` maps scroll progress to explode and camera.
- A pure `DragTurn` spring gives drag-to-turn offsets.
- Device modules (`src/scripts/three/device/`) build the five layers with GPT Image textures and PBR materials.
- Studio modules (`src/scripts/three/studio/`) build the backdrop, reflective floor, light beam, dust and haze.
- `HubScene` owns the renderer, lights, quality ladder and picking.
- `HubStageController` and `Callouts` wire scroll, Lenis and the HTML labels, following milestone 1's controller pattern.
- Milestone 1's toy device, `Teardown` and `DeviceScene` are removed once the hub replaces them.

**Tech Stack:**
- Astro 7.3.8, TypeScript
- three 0.186.1 (`three/addons` Reflector, RoundedBoxGeometry, RoomEnvironment)
- GSAP 3.15.0 ScrollTrigger, Lenis 1.3.26
- Vitest 5.0.3
- `sharp` (already in `node_modules` through Astro) for one-off texture conversion from a scratch script

**Spec:** `docs/superpowers/specs/2026-10-18-portfolio-redesign-design.md` (revision 3: "Decided by Bob" hub and device rows; "My calls" 2, 3, 4 and 11; Build order step 2)

> **Amendment (2026-10-19, Task 4 review):** the floor mirror (Reflector) was removed — A/B renders showed its reflection was invisible (<0.5/255 mean difference) while it cost 13–16% of a frame. The floor is a gloss sheet with a warm pool and a faint purple sheen. The quality ladder therefore has no reflection rung: fine {1.75,600}→{1.75,300}→{1.25,200}→{1,150}, coarse {1.25,300}→{1.25,150}→{1,120}; `Quality` has no `reflection` field; PixelBudget takes { limit: 1/56, slowRun: 3 } in HubScene. Read the Task 4 and Review Focus 4 text below with that in mind.

## Global Constraints

- **Branch:** `redesign-bench` only. Never push or merge. Commit messages end with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **No new npm dependencies.**
- **Palette:**
  - board `#140a24` / `#1c1030`, signal yellow `#ffcf33`, cream `#f1e8d3`
  - PCB purple `#4b2a8a`, gold `#d9a520`, lilac `#b8aad8`, dim `#9789bb`
  - The studio is near-black purple; the beam, callouts and power button are yellow or gold.
- **Type:** Unbounded (titles, the vertical name), Geist (body), Martian Mono (callouts and labels, uppercase, tracking 0.12em). Nothing else.
- **Look:** realistic and premium, matching the approved hub image `C:\Users\bhcco\AppData\Local\Temp\claude\C--Users-bhcco-Downloads-Portfolio-bob\b56617be-0033-4513-b033-50ad14c6b88d\scratchpad\refs\hub-exploded.png` (implementers open it with the Read tool). The device detail also follows `refs\device-boot.png`. Reference only; it is never shipped.
- **Device geometry** (spec call 11):
  - A slim, wide slab of 3.2 × 1.83 world units (about 1.75 : 1) with small rounded corners (radius about 0.15). No D-pad or round buttons.
  - Layers, top to bottom: **screen** (glass), **frame**, **board**, **battery**, **back**.
  - **Frame:** a purple anodised ring with 4 brass screws at the corners. The **yellow round power button** is on the +X short end face. **USB-C**, a slot and speaker holes are on the +Z long side, near −X.
  - **Board:** the three project chips, a central **BC-2006** processor (not a project), an empty **Next** socket, and a gold ribbon cable from the board's connector down to the battery.
- **Assets:** all self-hosted; the CSP is not loosened; nothing from a CDN; textures under `public/textures/device/` total ≤ 1.5 MB.
- **Copy:** formal first person, NL (default) and EN; never invent facts. The real portrait only, shown nowhere in this milestone.
- **Motion:** transforms, opacity and WebGL only. Reduced motion gets no scrub.
- **Pages:** existing pages keep building. `/lab/device/` stays noindex and out of the sitemap.
- **Checks:**
  - `npx -p typescript tsc --noEmit`, `npm test` and `npm run build` succeed.
  - The Python auditor passes `--strict` through Pyodide (harness in the scratchpad `audit-py` folder).

## Review Focus

1. **A vertical swipe on a phone must scroll the page;** only a mostly horizontal drag turns the device. The stage uses `touch-action: pan-y`, and `DragTurn` starts only after 8 px of mostly horizontal movement. Tested in Task 6 with touch drags.
2. **Textures that load slowly or fail** (404, offline) still leave a complete device with plain materials, never a blank or black object. Tested in Task 3 (builds with no textures) and Task 6 (`page.route` aborts the texture requests).
3. **Callouts on a narrow screen** never cover the device or run off-screen: below 760 px they stack as a list under the device, with short leader lines. Tested in Task 6 at 390×844.
4. **A weak GPU sheds cost in a fixed order:** the reflection first, then dust, then the pixel ratio. Tested in Task 4 (`qualityFor(step)`).
5. **Reduced motion and no WebGL** show a stacked page with a still render of the hub and the callout list as text. Tested in Task 6.

---

### Task 1: Device textures and their manifest

**Files:**
- Create:
  - `public/textures/device/pcb.webp` (2048 px wide, quality 82)
  - `public/textures/device/battery.webp` (1536 px wide, quality 80)
  - `public/textures/device/aluminium.webp` (1024 × 1024, quality 80)
  - all converted with `sharp` from the scratchpad sources in `...\scratchpad\textures\`: `pcb-b.png` (the chosen board), `battery.png` and `aluminium.png`
- Create: `src/scripts/three/device/textures.ts`
- Test: `tests/unit/device-textures.test.ts`

**Interfaces:**
- Produces:

```ts
export type FootprintId = 'funcial' | 'jontai-energy' | 'cookies-clicker' | 'bc-2006' | 'next' | 'connector';
/** A rectangle in the board texture's UV space (0..1, origin top-left as in the image). */
export interface UvRect { u0: number; v0: number; u1: number; v1: number }
export const TEXTURE_FILES: { readonly pcb: string; readonly battery: string; readonly aluminium: string }; // '/textures/device/…'
export const FOOTPRINTS: Readonly<Record<FootprintId, UvRect>>;
export interface DeviceTextures { pcb?: THREE.Texture; battery?: THREE.Texture; aluminium?: THREE.Texture }
export function loadDeviceTextures(loader?: THREE.TextureLoader): Promise<DeviceTextures>; // never rejects; a failed file is simply absent
```

**Values:**
- **Footprints:** measured on `pcb-b.png` (2688 × 1520) and written as UV rectangles. The empty footprints are:
  - **U2** (top of the left column) = `funcial`
  - **U3** (middle) = `jontai-energy`
  - **U4** (bottom) = `cookies-clicker`
  - **U1** (the large centre one) = `bc-2006`
  - **U5** (right) = `next`
  - **J1** (the flex connector at the bottom edge) = `connector`
  - Measure each to the outer edge of its pad ring, to within about 4 px. Put the pixel numbers in a comment.
- **Provenance comment:** Higgsfield GPT Image 2.5 job IDs: pcb `2bc26e00-3756-4a32-baa3-9f100f91fe37`, battery `f2c420c9-8f07-488c-9de3-43da60e6e0e9`, aluminium `dd9ba35b-f6cf-4966-b0c9-bbe281e76f51`.
- **Colour space:** `colorSpace = SRGBColorSpace` on every loaded map. Set `anisotropy` later in Task 4 (it needs the renderer).

- [ ] **Step 1: Convert the three textures** with a scratch Node script (not committed) that uses `sharp`. Check the sizes: the total is ≤ 1.5 MB.
- [ ] **Step 2: Write the failing test.**

```ts
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { FOOTPRINTS, TEXTURE_FILES } from '../../src/scripts/three/device/textures';

describe('device textures', () => {
  it('ships every texture file', () => {
    Object.values(TEXTURE_FILES).forEach((path) => expect(existsSync(`public${path}`)).toBe(true));
  });
  it('keeps footprints inside the board and apart from each other', () => {
    const rects = Object.values(FOOTPRINTS);
    rects.forEach((r) => {
      expect(r.u0).toBeGreaterThanOrEqual(0); expect(r.v0).toBeGreaterThanOrEqual(0);
      expect(r.u1).toBeLessThanOrEqual(1); expect(r.v1).toBeLessThanOrEqual(1);
      expect(r.u1).toBeGreaterThan(r.u0); expect(r.v1).toBeGreaterThan(r.v0);
    });
    rects.forEach((a, i) => rects.slice(i + 1).forEach((b) => {
      const overlap = a.u0 < b.u1 && b.u0 < a.u1 && a.v0 < b.v1 && b.v0 < a.v1;
      expect(overlap).toBe(false);
    }));
  });
  it('puts the three project footprints in a left column, top to bottom', () => {
    const { funcial, 'jontai-energy': je, 'cookies-clicker': ck, 'bc-2006': cpu } = FOOTPRINTS;
    expect(funcial.v0).toBeLessThan(je.v0); expect(je.v0).toBeLessThan(ck.v0);
    [funcial, je, ck].forEach((r) => expect(r.u1).toBeLessThan(cpu.u0));
  });
});
```

- [ ] **Step 3: Run `npm test`.**
  - Expected: FAIL (the module is missing).
- [ ] **Step 4: Implement `textures.ts`** to the values above.
- [ ] **Step 5: Run `npm test`.**
  - Expected: PASS.
- [ ] **Step 6: Commit:** `git add public/textures src/scripts/three/device/textures.ts tests/unit/device-textures.test.ts`, with the message "Redesign: realistic device textures and board footprints".

### Task 2: Hub choreography and drag-to-turn

**Files:**
- Create: `src/scripts/three/HubChoreography.ts`, `src/scripts/three/DragTurn.ts`
- Test: `tests/unit/hub-choreography.test.ts`, `tests/unit/drag-turn.test.ts`

**Interfaces:**
- Produces:

```ts
// HubChoreography.ts
export type HubLayerId = 'screen' | 'frame' | 'board' | 'battery' | 'back';
export const HUB_LAYERS: readonly HubLayerId[]; // top → bottom
export type Vec3 = readonly [number, number, number];
export interface HubPose { explode: number; offsets: Record<HubLayerId, number>; camera: { position: Vec3; target: Vec3 }; callouts: number }
export function hubPoseAt(progress: number): HubPose;
// DragTurn.ts
export interface TurnLimits { yaw: number; pitch: number }
export class DragTurn {
  constructor(limits?: TurnLimits); // default { yaw: 0.436 (25°), pitch: 0.14 (8°) }
  down(x: number, y: number): void;
  move(x: number, y: number, width: number): void; // engages only after 8 px with |dx| > |dy|
  up(): void;
  get engaged(): boolean;
  step(dt: number): { yaw: number; pitch: number }; // critically damped spring (ω = 6) back to 0 when released
}
```

**Values:**
- **Closed heights** (the bottom of each layer): back 0, battery 0.05, board 0.19, frame 0.05, screen 0.29. The frame ring rises from 0.05 to 0.29 around the board and battery when closed.
- **Explode:**
  - `explode = smoothstep(0.1, 0.5, p)`
  - `offset = closed + explode × index-from-bottom × 1.0`, with indices back 0, battery 1, board 2, frame 3, screen 4.
- **Camera:**
  - closed (explode 0): position `[3.4, 2.6, 4.4]`, target `[0, 0.15, 0]`
  - hub (explode 1): position `[5.2, 6.0, 7.4]`, target `[0.4, 2.0, 0]`
  - Lerp with `explode` as t.
  - These are **starting values**: Task 4 may tune them to match the reference framing and must update the tests to its final numbers.
- **Callouts:** `callouts = smoothstep(0.42, 0.55, p)` (their fade-in).
- **Clamping:** progress is clamped to [0, 1], and NaN is treated as 0.
- **Drag:** yaw = clamp(dx / width × 1.6, ±yaw limit); pitch = clamp(dy / width × 0.6, ±pitch limit).

- [ ] **Step 1: Write the failing tests.**

```ts
// hub-choreography.test.ts
import { describe, expect, it } from 'vitest';
import { HUB_LAYERS, hubPoseAt } from '../../src/scripts/three/HubChoreography';
describe('hubPoseAt', () => {
  it('is closed at 0 and fully apart at 1', () => {
    expect(hubPoseAt(0).explode).toBe(0);
    expect(hubPoseAt(0).offsets).toEqual({ screen: 0.29, frame: 0.05, board: 0.19, battery: 0.05, back: 0 });
    expect(hubPoseAt(1).explode).toBe(1);
  });
  it('orders the layers top to bottom when apart', () => {
    const ys = HUB_LAYERS.map((l) => hubPoseAt(1).offsets[l]);
    ys.slice(1).forEach((y, k) => expect(y).toBeLessThan(ys[k]));
  });
  it('clamps and never returns NaN', () => {
    expect(hubPoseAt(-1)).toEqual(hubPoseAt(0)); expect(hubPoseAt(2)).toEqual(hubPoseAt(1));
    expect(hubPoseAt(Number.NaN)).toEqual(hubPoseAt(0)); expect(hubPoseAt(Infinity)).toEqual(hubPoseAt(1));
    for (let i = 0; i <= 100; i++) {
      const p = hubPoseAt(i / 100);
      [...p.camera.position, ...p.camera.target, p.explode, p.callouts].forEach((n) => expect(Number.isFinite(n)).toBe(true));
    }
  });
  it('opens monotonically and shows callouts only near the hub', () => {
    let last = -1;
    for (let i = 0; i <= 100; i++) { const e = hubPoseAt(i / 100).explode; expect(e).toBeGreaterThanOrEqual(last); last = e; }
    expect(hubPoseAt(0.3).callouts).toBe(0); expect(hubPoseAt(0.6).callouts).toBe(1);
  });
});
```

```ts
// drag-turn.test.ts
import { describe, expect, it } from 'vitest';
import { DragTurn } from '../../src/scripts/three/DragTurn';
describe('DragTurn', () => {
  it('ignores small and mostly vertical moves', () => {
    const d = new DragTurn(); d.down(100, 100); d.move(104, 100, 1000); expect(d.engaged).toBe(false);
    d.move(110, 160, 1000); expect(d.engaged).toBe(false);
  });
  it('turns within the limits while dragging and springs back after release', () => {
    const d = new DragTurn(); d.down(0, 0); d.move(5000, 0, 1000);
    expect(d.engaged).toBe(true);
    expect(Math.abs(d.step(1 / 60).yaw)).toBeLessThanOrEqual(0.436 + 1e-9);
    d.up(); let t = { yaw: 1, pitch: 1 };
    for (let i = 0; i < 90; i++) t = d.step(1 / 60);
    expect(Math.abs(t.yaw)).toBeLessThan(0.01);
  });
  it('stays finite for a zero time step', () => {
    const d = new DragTurn(); const t = d.step(0); expect(Number.isFinite(t.yaw) && Number.isFinite(t.pitch)).toBe(true);
  });
});
```

- [ ] **Step 2: Run `npm test`.**
  - Expected: FAIL (the modules are missing).
- [ ] **Step 3: Implement both modules** to the values above.
- [ ] **Step 4: Run `npm test`.**
  - Expected: PASS.
- [ ] **Step 5: Commit** with the message "Redesign: hub choreography and drag-to-turn".

### Task 3: The realistic handheld

**Files:**
- Create: `src/scripts/three/device/{materials,Frame,Screen,Board,Battery,BackPlate,Handheld}.ts`
- Test: `tests/unit/handheld.test.ts`

**Interfaces:**
- Consumes: `HubLayerId`, `HUB_LAYERS`, `HubPose` and `hubPoseAt` (Task 2); `DeviceTextures` and `FOOTPRINTS` (Task 1); `palette` (`src/scripts/three/palette.ts`); `paintSilkscreen` and `mono` (`src/scripts/three/labels.ts`, adapt if needed).
- Produces:

```ts
export const PROJECT_CHIPS: readonly ['funcial', 'jontai-energy', 'cookies-clicker', 'next'];
export interface HandheldModel {
  group: THREE.Group;
  layers: Record<HubLayerId, THREE.Object3D>;
  chips: THREE.Mesh[];          // PROJECT_CHIPS order, userData.slug set, children of layers.board, raycastable
  processor: THREE.Mesh;        // userData.slug = 'bc-2006', NOT in chips
  powerButton: THREE.Mesh;      // on the frame's +X end face
  applyPose(pose: HubPose): void;          // layers[id].position.y = pose.offsets[id]; ribbon cable stretches board↔battery
  setHighlight(layer: HubLayerId | null): void; // a subtle gold rim/emissive on that layer, off for the rest
  setTextures(textures: DeviceTextures): void;  // swap in maps after they load; safe to call more than once
  dispose(): void;
}
export function buildHandheld(textures?: DeviceTextures, labels?: Readonly<Record<string, string>>): HandheldModel;
```

**Design values** (realism comes from bevels, PBR and the textures; match the reference):
- **Materials** (`materials.ts`, shared, not duplicated per part):
  - **Anodised purple:** `MeshPhysicalMaterial`, colour around `#5b2d8e`, metalness 0.75, roughness 0.32, clearcoat 0.4. The aluminium texture is tiled as `map` and also used as a faint `roughnessMap` or `bumpMap`.
  - **Brass:** colour around `#c9a24a`, metalness 1, roughness 0.3.
  - **Black epoxy** (chips): roughness 0.6.
  - **Gold:** `palette.gold`, metalness 1, roughness 0.25.
  - **Glass:** transparent, with a slight dark tint and high clearcoat. No transmission; it costs too much.
- **Frame:**
  - A rounded-rectangle ring (`ExtrudeGeometry` from a `Shape` with a hole, with a small bevel). Outer 3.2 × 1.83, inner opening inset 0.11, height 0.24.
  - 4 brass screw heads with a cross slot, plus short threaded standoffs below, at the corners.
  - The power button: a yellow emissive disc with a power-icon canvas texture, slightly raised, in a dark recessed bezel, on the +X end face.
  - USB-C (a dark rounded recess with a metal tongue), a slot and 4 speaker holes on the +Z side near −X.
- **Screen:**
  - A 3.06 × 1.69 × 0.03 glass slab with rounded corners.
  - An emissive display plane just under the glass, with a canvas texture: a near-black purple gradient, a few thin gold contour lines, and a small Martian Mono "BC-2006" bottom-left. No time, no fake UI text.
- **Board:**
  - A 3.0 × 1.69 × 0.04 slab with `pcb.webp` as `map` and as `bumpMap` (small scale).
  - **Chips** sit exactly on `FOOTPRINTS`, mapping UV to board local XZ with the image's top as −Z:
    - The three project chips and BC-2006 are black epoxy blocks with a slight bevel and their names silkscreened in white Martian Mono: FUNCIAL, JONTAI ENERGY, COOKIES CLICKER, BC-2006. Labels come from `labels` if given.
    - BC-2006 is larger and has a faint gold pin ring.
  - **The next socket:** a low socket frame (a dark ring with gold contacts) and no chip.
  - **The ribbon cable:** a thin gold-brown flex strip from `FOOTPRINTS.connector` down to the battery connector. `applyPose` resizes it so it always spans the gap; it folds flat when closed.
- **Battery:**
  - A pouch about 2.5 × 1.3 × 0.1, a rounded box with soft edges, with `battery.webp` on top.
  - Gold tape faces on its ±X ends.
  - Red and black wires to a small white connector at −X.
- **Back plate:** a rounded slab, 3.2 × 1.83 × 0.05, anodised, with 4 brass screws.
- **Fallback:** with no textures, every part keeps its plain colour.

- [ ] **Step 1: Write the failing tests.**

```ts
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildHandheld, PROJECT_CHIPS } from '../../src/scripts/three/device/Handheld';
import { HUB_LAYERS, hubPoseAt } from '../../src/scripts/three/HubChoreography';
describe('buildHandheld', () => {
  const h = buildHandheld();
  it('has the five layers inside the group', () => HUB_LAYERS.forEach((id) => expect(h.layers[id].parent).toBe(h.group)));
  it('carries the project chips in order, apart from the processor', () => {
    expect(h.chips.map((c) => c.userData.slug)).toEqual([...PROJECT_CHIPS]);
    expect(h.processor.userData.slug).toBe('bc-2006');
    expect(h.chips).not.toContain(h.processor);
    h.chips.forEach((c) => expect(c.parent === h.layers.board || c.parent?.parent === h.layers.board).toBe(true));
  });
  it('applies a pose to layer heights', () => {
    const pose = hubPoseAt(0.7); h.applyPose(pose);
    HUB_LAYERS.forEach((id) => expect(h.layers[id].position.y).toBeCloseTo(pose.offsets[id]));
  });
  it('has finite geometry everywhere', () => {
    h.group.traverse((o) => {
      const g = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
      const pos = g?.getAttribute?.('position');
      if (pos) for (let i = 0; i < pos.array.length; i++) expect(Number.isFinite(pos.array[i])).toBe(true);
    });
  });
  it('stacks screen, board, battery and back without overlapping when closed', () => {
    h.applyPose(hubPoseAt(0)); h.group.updateMatrixWorld(true);
    const span = (id: 'screen' | 'board' | 'battery' | 'back') => new THREE.Box3().setFromObject(h.layers[id]);
    const order = (['back', 'battery', 'board', 'screen'] as const).map(span);
    order.slice(1).forEach((b, k) => expect(b.min.y).toBeGreaterThanOrEqual(order[k].max.y - 1e-3));
  });
});
```

- [ ] **Step 2: Run `npm test`.**
  - Expected: FAIL.
- [ ] **Step 3: Implement the device modules** to the values above. Render-check them in headless Edge from the scratchpad: build a throwaway HTML harness in the scratchpad `edge-check` folder that imports the model through Vite, or render through Task 4's scene if it is easier to do both. Compare against the reference images at a closed and an exploded pose. Save the renders as `...\scratchpad\proof-m2\task3-*.png`.
- [ ] **Step 4: Run `npm test` and `npx -p typescript tsc --noEmit`.**
  - Expected: PASS, with 0 errors.
- [ ] **Step 5: Commit** with the message "Redesign: the realistic handheld".

### Task 4: The studio and HubScene

**Files:**
- Create:
  - `src/scripts/three/studio/{Backdrop,Floor,Beam,Dust}.ts`
  - `src/scripts/three/HubScene.ts`
  - `src/scripts/three/quality.ts`
- Test: `tests/unit/quality.test.ts`

**Interfaces:**
- Consumes:
  - `buildHandheld` and `HandheldModel` (Task 3)
  - `hubPoseAt`, `HubLayerId` and `DragTurn` (Task 2)
  - `loadDeviceTextures` (Task 1)
  - `RenderLoop`, `PixelBudget` and `ChipPointer` (existing, `src/scripts/three/`)
- Produces:

```ts
// quality.ts
export interface Quality { pixelRatio: number; reflection: boolean; dust: number }
export function qualityFor(step: number, finePointer: boolean): Quality; // step 0 = best
// HubScene.ts
export class HubScene {
  static supported(): boolean; // WebGL2 with failIfMajorPerformanceCaveat, as DeviceScene did
  constructor(canvas: HTMLCanvasElement, options: { finePointer: boolean; labels?: Readonly<Record<string, string>> });
  setProgress(progress: number, options?: { immediate?: boolean }): void;
  setActive(active: boolean): void;
  setInteractive(on: boolean): void;
  resize(): void;
  highlightLayer(id: HubLayerId | null): void;
  onLayer(handler: (id: HubLayerId | null, kind: 'hover' | 'click') => void): void; // layer under the pointer
  anchors(): Record<HubLayerId, { x: number; y: number; visible: boolean }>; // callout anchor (the layer's +X/+Z edge) in CSS px
  pointerDown(x: number, y: number): void; pointerMove(x: number, y: number): void; pointerUp(): void; // forwarded to DragTurn
  dispose(): void;
}
```

**Values:**
- **Quality ladder** (fine pointer, steps 0 → 3):
  - `{1.75, true, 600}`
  - `{1.25, true, 400}`
  - `{1.25, false, 400}`
  - `{1, false, 200}`

  Coarse pointer, steps 0 → 2:
  - `{1.25, false, 300}`
  - `{1, false, 200}`
  - `{1, false, 120}`

  `PixelBudget` steps advance the ladder. The reflection goes first on a fine pointer; phones start without it.
- **Studio:**
  - **Backdrop:** a large inner-facing sphere with a radial gradient, `#1c1030` glow behind the device fading to `#07040d`.
  - **Floor:** a `Reflector` at y = −0.55, at half resolution and dark-tinted. A dark, slightly transparent plane above it carries a procedural noise alpha, to break the mirror into a wet, streaky gloss as in the reference. When the reflection is off, only that plane remains, with a soft radial highlight.
  - **Beam:** an open cone from above (apex about y 9, radius about 2.2 at the floor). Additive shader: a vertical falloff, soft edges and slow noise drift, in yellow-gold `#ffcf33` at low intensity.
  - **Dust:** `Points` drifting slowly, brighter inside the beam, additive, size-attenuated.
  - **Haze:** `FogExp2` around `#160c26`, density about 0.035, plus 2–3 large soft purple smoke sprites (procedural canvas noise) at the sides.
- **Lights:**
  - `RoomEnvironment` through PMREM, with `environmentIntensity` about 0.35.
  - A warm key `SpotLight` from the beam's apex, with a soft 1024 shadow (shadows fall on a `ShadowMaterial` plane just above the floor).
  - A purple rim light from behind-left.
  - NeutralToneMapping, exposure about 1.
- **Camera:** `hubPoseAt` plus the `DragTurn` yaw and pitch orbit around the target. FOV 30. Above aspect 1.2, frame the device left of centre so the callouts fit on the right; below it, centre the device.
- **Picking:** hover and click over a layer's meshes give its `HubLayerId` (a `ChipPointer`-style rest pick). `highlightLayer` forwards to `setHighlight`.
- **Behaviour as in milestone 1's `DeviceScene`:** load textures in the background and call `setTextures` when they arrive; dispose fully; pause when inactive.

- [ ] **Step 1: Write the failing test:** `quality.test.ts` asserts the exact ladder values above, that steps past the end clamp to the last entry, and that the reflection is off from step 2 on a fine pointer and at every step on a coarse one.
- [ ] **Step 2: Run `npm test`.**
  - Expected: FAIL.
- [ ] **Step 3: Implement** the studio modules, `quality.ts` and `HubScene`. Render-check in headless Edge at the closed and hub poses, judging against `refs\hub-exploded.png`: the wet-floor reflection, the beam, dust, haze, realistic metal and readable chip names. Iterate until it holds, then save `...\scratchpad\proof-m2\task4-*.png`.
  - If the camera values from Task 2 change, update `hub-choreography.test.ts` to the final numbers in the same commit.
- [ ] **Step 4: Run `npm test` and `npx -p typescript tsc --noEmit`.**
  - Expected: PASS.
- [ ] **Step 5: Commit** with the message "Redesign: product-launch studio and hub scene".

### Task 5: The hub page: callouts, vertical name and controller; remove the toy device

**Files:**
- Create: `src/components/bench/HubStage.astro`, `src/scripts/bench/HubStageController.ts`, `src/scripts/ui/Callouts.ts`
- Modify:
  - `src/pages/lab/device.astro` and `src/pages/en/lab/device.astro` (use `HubStage`)
  - `src/scripts/bench-main.ts` (register `HubStageController`)
  - `src/i18n/en.ts` and `src/i18n/nl.ts` (add a `hub` key group)
- Delete:
  - `src/components/bench/DeviceStage.astro`, `src/scripts/bench/DeviceStageController.ts`
  - `src/scripts/three/{Teardown,Device,DeviceScene}.ts`, `src/scripts/three/parts/`
  - `tests/unit/{teardown,device,device-scene}.test.ts`
  - Keep `ChipPointer`, `PixelBudget`, `RenderLoop`, `labels` and `palette`, and their tests. If `ChipPointer`'s test imported from `DeviceScene`, move what it needs.

**Interfaces:**
- Consumes: `HubScene` (Task 4), `hubPoseAt` (Task 2), `Component`/`App`/`Motion` (`src/scripts/core/`), and milestone 1's controller pattern. Read the deleted `DeviceStageController.ts` first and keep its behaviour:
  - Lenis feeding ScrollTrigger
  - one scrubbed trigger
  - the IntersectionObserver with the last entry
  - the resize guard and rAF debounce
  - the immediate first progress
  - try/catch with a fallback
  - `data-bench` live/fallback with the boot failsafe
  - a 300svh track instead of 500svh
- Produces: `Callouts`:

```ts
export class Callouts {
  constructor(root: HTMLElement); // root contains [data-callout="screen|frame|board|battery|back"] items with a label and an <svg> leader
  update(anchors: Record<HubLayerId, { x: number; y: number; visible: boolean }>, opacity: number, narrow: boolean): void; // transform/opacity only
  onHover(handler: (id: HubLayerId | null) => void): void;
  onClick(handler: (id: HubLayerId) => void): void;
}
```

**Content and behaviour:**
- **Callouts:** four, for screen, board, battery and back (the frame has none in this milestone).
  - EN: "SCREEN — ABOUT", "BOARD — PROJECTS", "BATTERY — OFF DUTY", "BACK PLATE — WHAT I WORK WITH"
  - NL: "SCHERM — OVER MIJ", "PRINTPLAAT — PROJECTEN", "ACCU — BUITEN DIENST", "ACHTERPLAAT — WAARMEE IK WERK"
  - Each is a Martian Mono label in gold `#d9a520` text with a 1px gold leader from the projected anchor: a short diagonal, then a horizontal run to a right-aligned column at about 72% of the width, as in the reference.
  - Hovering a label highlights its layer, and hovering a layer highlights its label. Clicking a label pins the highlight; milestone 3 turns this into a jump.
  - Below 760 px wide, the labels become a list under the device with short leaders.
- **Vertical name:** "BOB CHUNG" in Unbounded, yellow `#ffcf33`, rotated to read bottom-to-top along the left edge, at about 80% of the viewport height. It is the page's single `<h1>`.
  - The role line ("Student software engineer · Rotterdam" / "Student software engineer · Rotterdam") sits small at the bottom-left.
- **Scroll:** 0 → 0.5 scrubs closed → exploded; the callouts fade in at the end; the hub holds to 1.
- **Interaction:** drag events on the stage go to `HubScene`. `touch-action: pan-y` on the stage. Layer events are interactive only once the callouts are visible.
- **Fallback:** the stacked page shows the callout list as text, plus a still `<img>` with alt text "The handheld taken apart into its layers" / "Het apparaat uit elkaar gehaald in zijn lagen". It points at `src/assets/renders/hub.webp`, which Task 6 creates; until then, a 1×1 placeholder is acceptable.
- **Meta title:** "Device study | Bob Chung" / "Apparaatstudie | Bob Chung", unchanged.

- [ ] **Step 1: Implement** the files above and delete the toy files and tests.
- [ ] **Step 2: Run `npx -p typescript tsc --noEmit`, `npm test` and `npm run build`.**
  - Expected: 0 errors, tests pass, `dist/lab/device/index.html` and `dist/en/lab/device/index.html` built, no `/lab/` in `dist/sitemap-0.xml`.
- [ ] **Step 3: Run the Pyodide auditor** (`unittest discover tools`, then `site_audit.main(['dist','--strict'])`).
  - Expected: tests pass, 0 issues.
- [ ] **Step 4: Commit** with the message "Redesign: the realistic hub page with callouts and the vertical name".

### Task 6: Verify in headless Edge, make the fallback still and record proof

**Files:**
- Create: `src/assets/renders/hub.webp` (a still of the hub at progress 0.6, 1600 px wide, captured from the page), wired into `HubStage.astro`'s fallback `<img>` through `astro:assets`.
- Scratch, not committed: Edge scripts in the scratchpad `edge-check` folder; proof in `...\scratchpad\proof-m2\`.

- [ ] **Step 1: Scrub test** at 1440×900 on the GPU: screenshots at progress 0, 0.25, 0.5 and 0.8 (`1-closed.png`, `2-opening.png`, `3-hub.png`, `4-hub-hold.png`), back to 0, with no console errors.
- [ ] **Step 2: Callout hover.** Hover each label in turn.
  - Expected: the matching layer highlights (`5-hover-board.png`).
  - Then hover the board layer itself: its label lights.
- [ ] **Step 3: Drag.** Mouse-drag 300 px horizontally at the hub.
  - Expected: the device turns (`6-drag.png`) and springs back within about 1.5 s after release.
- [ ] **Step 4: Phone.** At 390×844 with touch:
  - a vertical drag scrolls the page
  - a horizontal drag turns the device
  - the callouts stack under it (`7-phone-hub.png`)
- [ ] **Step 5: Textures blocked.** Abort `**/textures/device/**`.
  - Expected: the device still renders complete in plain materials, with no errors (`8-no-textures.png`).
- [ ] **Step 6: Reduced motion and `--disable-3d-apis`.**
  - Expected: the stacked fallback, with the still and the callout list.
  - Capture the still for `hub.webp` from the live hub at progress 0.6 before this step, and rebuild.
- [ ] **Step 7: FPS.** The median during a full scrub on the GPU, and on SwiftShader (reported, not gated). Also record the quality step reached.
- [ ] **Step 8: Record** `scrub.webm` (1440×900, down and back up, with a drag at the hub).
- [ ] **Step 9: Run `npm test` and `npm run build` again,** plus the auditor if `HubStage` changed. Commit the still and the wiring with the message "Redesign: hub fallback still". Write the proof report to `...\scratchpad\proof-m2\report.md` (pass or fail per step, fps, quality step) if the harness allows; otherwise include it in the final reply.

## Later milestones

Transitions (milestone 3), the loader (4), replacing the home (5), project pages (6) and hardening (7) each get their own plan after Bob reviews the one before.
