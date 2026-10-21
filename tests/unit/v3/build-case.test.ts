import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { DIAL } from '~/engine/instrument/dialSpec';
import { palette } from '~/engine/palette';
import { buildCase, CASE_LOOK } from '~/engine/v3/build/case';
import { CITY, CITY_BLOCKS, cityLayout } from '~/engine/v3/chipCity';
import { CHIP } from '~/engine/v3/chipSpec';
import { GLASS_RINGS } from '~/engine/v3/compassSpec';

/** The object called `name` under `root`, which must exist. */
function named<T extends THREE.Object3D>(root: THREE.Object3D, name: string): T {
  const found = root.getObjectByName(name);
  expect(found, name).toBeDefined();
  return found as T;
}

/** A world-space box round a mesh's own geometry. */
function worldBox(mesh: THREE.Mesh): THREE.Box3 {
  mesh.updateWorldMatrix(true, false);
  mesh.geometry.computeBoundingBox();
  return mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
}

/** The farthest any vertex of a mesh lies from the compass's axis, and the nearest, in world units. */
function radii(mesh: THREE.Mesh): { min: number; max: number } {
  mesh.updateWorldMatrix(true, false);
  const position = mesh.geometry.getAttribute('position');
  const v = new THREE.Vector3();
  let min = Infinity;
  let max = 0;
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
    const r = Math.hypot(v.x, v.z);
    min = Math.min(min, r);
    max = Math.max(max, r);
  }
  return { min, max };
}

/** The glass's lowest underside over all four rings, and the top of the outer ring, whose edge meets the wall. */
const GLASS_BOTTOM = Math.min(...GLASS_RINGS.map((ring) => ring.y - ring.thickness / 2));
const OUTER = GLASS_RINGS[GLASS_RINGS.length - 1];
const GLASS_TOP = OUTER.y + OUTER.thickness / 2;

describe('the case round the chip city (Task 14b)', () => {
  it('walls the city in at the rim, from below the board up past the glass, so no block shows below or outside the rim', () => {
    const model = buildCase();
    expect(model.group.name).toBe('case');
    const wall = named<THREE.Mesh>(model.group, 'case:wall');
    const box = worldBox(wall);
    expect(box.min.y).toBeLessThanOrEqual(CHIP.board);
    expect(box.max.y).toBeGreaterThanOrEqual(GLASS_TOP);
    const { min, max } = radii(wall);
    expect(min).toBeGreaterThanOrEqual(CITY.outer - 1e-6);
    expect(max).toBeCloseTo(DIAL.rim, 6);
    model.dispose();
  });

  it("caps the wall with a brass lip at the glass's edge, the compass's rim, a hair over the glass", () => {
    const model = buildCase();
    const lip = named<THREE.Mesh>(model.group, 'case:lip');
    const box = worldBox(lip);
    expect(box.min.y).toBeGreaterThan(GLASS_TOP);
    expect(box.max.y - GLASS_TOP).toBeLessThan(0.01);
    const { min, max } = radii(lip);
    // From the hexagram ring's outer edge to the rim: it closes the gap between the glass and the wall.
    expect(min).toBeLessThanOrEqual(GLASS_RINGS[GLASS_RINGS.length - 1].outer + 1e-6);
    expect(max).toBeCloseTo(DIAL.rim, 6);
    const material = lip.material as THREE.MeshStandardMaterial;
    expect(material.color.getHex()).toBe(palette.brass);
    expect(material.metalness).toBeGreaterThanOrEqual(0.8);
    expect(material.transparent).toBe(false);
    model.dispose();
  });

  it('closes it with a dark floor just under the board, reaching the wall', () => {
    const model = buildCase();
    const floor = named<THREE.Mesh>(model.group, 'case:floor');
    const box = worldBox(floor);
    expect(box.max.y).toBeLessThan(CHIP.board);
    expect(box.max.y).toBeGreaterThan(CHIP.board - 0.01);
    expect(radii(floor).max).toBeGreaterThanOrEqual(CITY.outer - 1e-6);
    const wallBottom = worldBox(named<THREE.Mesh>(model.group, 'case:wall')).min.y;
    expect(wallBottom).toBeLessThanOrEqual(box.min.y);
    model.dispose();
  });

  it('holds every block of the city inside it, under the glass, so a block is only ever seen through the glass', () => {
    const model = buildCase();
    const wall = named<THREE.Mesh>(model.group, 'case:wall');
    const inner = radii(wall).min;
    const floorTop = worldBox(named<THREE.Mesh>(model.group, 'case:floor')).max.y;
    for (const count of [CITY_BLOCKS.fine, CITY_BLOCKS.coarse]) {
      for (const block of cityLayout(count)) {
        const far = Math.hypot(Math.abs(block.x) + block.w / 2, Math.abs(block.z) + block.d / 2);
        expect(far).toBeLessThan(inner);
        expect(CHIP.board + block.h).toBeLessThan(GLASS_BOTTOM);
        expect(CHIP.board).toBeGreaterThanOrEqual(floorTop);
      }
    }
    model.dispose();
  });

  it('is solid and dark: opaque, writing depth, in the palette, so it hides what lies behind it', () => {
    const model = buildCase();
    const wall = named<THREE.Mesh>(model.group, 'case:wall').material as THREE.MeshStandardMaterial;
    const floor = named<THREE.Mesh>(model.group, 'case:floor').material as THREE.MeshStandardMaterial;
    for (const material of [wall, floor]) {
      expect(material.transparent).toBe(false);
      expect(material.depthWrite).toBe(true);
    }
    expect(wall.color.getHex()).toBe(CASE_LOOK.wall.colour);
    expect(floor.color.getHex()).toBe(CASE_LOOK.floor.colour);
    expect([palette.ink, palette.boardDeep, palette.board, palette.glass]).toContain(CASE_LOOK.wall.colour);
    expect([palette.ink, palette.boardDeep, palette.board, palette.night]).toContain(CASE_LOOK.floor.colour);
    // Its walls face both ways (a wall seen from inside, through the glass, is not a hole).
    expect(wall.side).toBe(THREE.DoubleSide);
    model.dispose();
  });

  it('rises with the city from the floor: hidden at 0, its wall and lip scaled up from the floor, held to 0..1', () => {
    const model = buildCase();
    const wall = named<THREE.Mesh>(model.group, 'case:wall');
    const lip = named<THREE.Mesh>(model.group, 'case:lip');
    const full = worldBox(wall);
    model.setRise(0);
    expect(model.group.visible).toBe(false);
    model.setRise(0.5);
    expect(model.group.visible).toBe(true);
    const half = worldBox(wall);
    expect(half.min.y).toBeCloseTo(full.min.y, 6);
    expect(half.max.y).toBeCloseTo(full.min.y + (full.max.y - full.min.y) / 2, 6);
    expect(worldBox(lip).max.y).toBeLessThan(full.max.y);
    model.setRise(2);
    expect(worldBox(wall).max.y).toBeCloseTo(full.max.y, 6);
    model.setRise(Number.NaN);
    expect(model.group.visible).toBe(false);
    model.dispose();
  });

  it("lights its brass rim with the glass's forming: the wall's dark at 0, brass at 1, held to 0..1", () => {
    const model = buildCase();
    const lip = named<THREE.Mesh>(model.group, 'case:lip').material as THREE.MeshStandardMaterial;
    expect(lip.color.getHex()).toBe(palette.brass);
    model.setRim(0);
    expect(lip.color.getHex()).toBe(CASE_LOOK.wall.colour);
    expect(lip.emissiveIntensity).toBe(0);
    model.setRim(0.5);
    const brass = new THREE.Color(palette.brass);
    const dark = new THREE.Color(CASE_LOOK.wall.colour);
    expect(lip.color.r).toBeCloseTo((brass.r + dark.r) / 2, 6);
    expect(lip.emissiveIntensity).toBeCloseTo(CASE_LOOK.lip.emissive / 2, 9);
    model.setRim(4);
    expect(lip.color.getHex()).toBe(palette.brass);
    expect(lip.emissiveIntensity).toBe(CASE_LOOK.lip.emissive);
    model.setRim(Number.NaN);
    expect(lip.emissiveIntensity).toBe(0);
    // Quiet: a little light of its own, under the gold engraving's.
    expect(CASE_LOOK.lip.emissive).toBeLessThanOrEqual(0.1);
    model.dispose();
  });

  it('frees its geometries and its materials', () => {
    const model = buildCase();
    const parts: (THREE.BufferGeometry | THREE.Material)[] = [];
    model.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) parts.push(mesh.geometry, mesh.material as THREE.Material);
    });
    expect(parts.length).toBe(6);
    const spies = [...new Set(parts)].map((part) => vi.spyOn(part, 'dispose'));
    model.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalled();
  });
});
