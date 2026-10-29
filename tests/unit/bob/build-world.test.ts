import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { projects, type ProjectId } from '~/data/projects';
import { buildWorld, type WorldModel, type WorldPose } from '~/engine/bob/build/world';
import type { CameraShot } from '~/engine/bob/shots';
import { spotFor } from '~/scene/bob/spot';
import { boardCentre, boardTops, STACK, stackPlaces } from '~/scene/bob/worldLayout';
import { areasOnPath } from '~/state/chapters';

/** A canvas as a test hands it over: every drawing call does nothing, its size is kept. */
function canvas(): HTMLCanvasElement {
  const noop = () => {};
  const gradient = { addColorStop: noop };
  const ctx = new Proxy({} as Record<string | symbol, unknown>, {
    get: (target, key) => (key in target ? target[key] : key === 'createRadialGradient' || key === 'createLinearGradient' ? () => gradient : noop),
    set: (target, key, value) => {
      target[key] = value;
      return true;
    }
  }) as unknown as CanvasRenderingContext2D;
  return { width: 0, height: 0, getContext: (kind: string) => (kind === '2d' ? ctx : null) } as unknown as HTMLCanvasElement;
}

const BOARDS = stackPlaces(areasOnPath());
const IDS = BOARDS.flatMap((b) => b.sockets.map((s) => s.id));
const OPEN = boardTops(BOARDS, 1);
const CLOSED = boardTops(BOARDS, 0);
const C = boardCentre();

function build(tier: 'high' | 'medium' | 'low' = 'high', room: THREE.Texture | null = null): WorldModel {
  return buildWorld(BOARDS, tier, room, canvas);
}

const each = <T>(value: T): Record<ProjectId, T> => Object.fromEntries(IDS.map((id) => [id, value])) as Record<ProjectId, T>;
const pose = (over: Partial<WorldPose> = {}): WorldPose => ({
  power: 1,
  flash: 0,
  clock: 0,
  levels: each(1),
  open: each(0),
  float: 0,
  world: 1,
  tops: OPEN,
  boardPower: BOARDS.map(() => 1),
  boardLight: BOARDS.map(() => 1),
  lift: each(0),
  spot: null,
  sink: 0,
  ...over
});
const named = (model: WorldModel, name: string): THREE.Object3D => {
  const found = model.group.getObjectByName(name);
  if (!found) throw new Error(`no part named ${name}`);
  return found;
};
const worldOf = (o: THREE.Object3D): THREE.Vector3 => {
  o.updateWorldMatrix(true, false);
  return new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
};
const hitOf = (model: WorldModel, id: ProjectId): THREE.Mesh => model.hits.find((h) => h.userData.id === id) as THREE.Mesh;
/** A board's stop, roughly: the camera out and up from the app board. */
const SHOT: CameraShot = { position: [-11.4, OPEN[1]! + 5.4, 13.6], target: [-0.4, OPEN[1]! + 0.2, 0.5], fov: 38, up: [0, 1, 0] };
const SPOT = spotFor(SHOT, 1.6, 1, 0);

describe('the world as the stack: its boards, the spine, the socketed CPU, the sockets and the objects', () => {
  it('names a board per category below the power board, the spine and the CPU', () => {
    const model = build();
    expect(model.group.name).toBe('world');
    for (let k = 0; k < BOARDS.length; k++) expect(named(model, `world:board:${k}`)).toBeTruthy();
    expect(model.group.getObjectByName(`world:board:${BOARDS.length}`)).toBeUndefined();
    for (const name of ['world:spine', 'world:cpu', 'world:beam', 'world:showLight']) expect(named(model, name), name).toBeTruthy();
    // The CPU stands on the power board.
    let o: THREE.Object3D | null = named(model, 'world:cpu');
    while (o && o.name !== 'world:board:0') o = o.parent;
    expect(o).not.toBeNull();
    for (const id of IDS) {
      expect(named(model, `world:socket:${id}`)).toBeTruthy();
      expect(named(model, `world:object:${id}`)).toBeTruthy();
    }
    // One thing to click per project, each saying whose it is.
    expect(model.hits.map((h) => h.userData.id)).toEqual(IDS);
    // No round board and no pads are left.
    for (const gone of ['world:board', 'world:board:circuit', 'world:pad:steady']) expect(model.group.getObjectByName(gone)).toBeUndefined();
  });

  it("gives each project one anchor per touch point, in the data's order", () => {
    const model = build();
    for (const id of IDS) {
      const anchors = model.anchors(id);
      expect(anchors).toHaveLength(projects.byId(id)!.testPoints.length);
      for (const a of anchors) {
        let o: THREE.Object3D | null = a;
        while (o && o.name !== `world:object:${id}`) o = o.parent;
        expect(o, `${id}'s anchors are in its object`).not.toBeNull();
      }
      expect(model.top(id)).toBeInstanceOf(THREE.Object3D);
    }
  });

  it("marks Steady's streak blocks one after another and lights its trophy as it opens", () => {
    const model = build();
    const lit = (k: number) => ((named(model, `world:object:steady:block:${k}`) as THREE.Mesh).material as THREE.ShaderMaterial).uniforms.uLit!.value as number;
    const trophy = (named(model, 'world:object:steady:trophy') as THREE.Mesh).material as THREE.MeshStandardMaterial;
    model.pose(pose());
    expect([0, 1, 2, 3, 4, 5, 6].map(lit)).toEqual([1, 1, 1, 0, 0, 0, 0]);
    const dim = trophy.emissiveIntensity;
    model.pose(pose({ open: { ...each(0), steady: 0.5 } }));
    expect(lit(3)).toBeGreaterThan(lit(6));
    model.pose(pose({ open: { ...each(0), steady: 1 } }));
    for (let k = 0; k < 7; k++) expect(lit(k)).toBe(1);
    expect(trophy.emissiveIntensity).toBeGreaterThan(dim * 4);
  });

  it("parts Porfael's arcs and lights its relic as it opens", () => {
    const model = build();
    const arc = named(model, 'world:object:porfael:arc:0');
    const relic = (named(model, 'world:object:porfael:relic') as THREE.Mesh).material as THREE.MeshStandardMaterial;
    model.pose(pose());
    expect(arc.position.length()).toBe(0);
    const dim = relic.emissiveIntensity;
    model.pose(pose({ open: { ...each(0), porfael: 1 } }));
    expect(arc.position.length()).toBeCloseTo(0.05, 9);
    expect(relic.emissiveIntensity).toBeGreaterThan(dim * 4);
    // Five arcs, the shares of a portfolio; never an amount.
    for (let k = 0; k < 5; k++) expect(named(model, `world:object:porfael:arc:${k}`)).toBeTruthy();
  });

  it("lights Jontai Energy's cells in turn as it opens", () => {
    const model = build();
    const lit = (k: number) => ((named(model, `world:object:jontai-energy:cell:${k}`) as THREE.Mesh).material as THREE.ShaderMaterial).uniforms.uLit!.value as number;
    model.pose(pose());
    expect(lit(0)).toBe(0);
    model.pose(pose({ open: { ...each(0), 'jontai-energy': 0.3 } }));
    expect(lit(0)).toBeGreaterThan(lit(15));
    model.pose(pose({ open: { ...each(0), 'jontai-energy': 1 } }));
    for (let k = 0; k < 16; k++) expect(lit(k)).toBe(1);
  });

  it('turns the gears only by the clock it is given', () => {
    const model = build();
    const gear = named(model, 'world:object:cookies-clicker:gear:big');
    model.pose(pose({ clock: 7.4 }));
    const once = gear.rotation.z;
    model.pose(pose({ clock: 3 }));
    model.pose(pose({ clock: 7.4 }));
    expect(gear.rotation.z).toBe(once);
    // A tick a second: between ticks it stands still.
    model.pose(pose({ clock: 7.6 }));
    const a = gear.rotation.z;
    model.pose(pose({ clock: 7.9 }));
    expect(gear.rotation.z).toBe(a);
    model.pose(pose({ clock: 8.5 }));
    expect(gear.rotation.z).not.toBe(a);
    const source = readFileSync(fileURLToPath(new URL('../../../src/engine/bob/build/world.ts', import.meta.url)), 'utf8');
    expect(source).not.toMatch(/Date\.now|performance\.now/);
  });

  it('places each board at the tops it is posed with', () => {
    const model = build();
    for (const tops of [CLOSED, OPEN]) {
      model.pose(pose({ tops }));
      for (let k = 0; k < BOARDS.length; k++) expect(worldOf(named(model, `world:board:${k}`)).y, `board ${k}`).toBeCloseTo(tops[k]!, 9);
      // The spine telescopes with them.
      expect(worldOf(named(model, 'spine:span1')).y).toBeCloseTo(tops[1]! - STACK.thick, 9);
      // A socket rides on its board.
      expect(worldOf(named(model, 'world:socket:jontai-energy')).y).toBeCloseTo(tops[2]!, 9);
    }
  });

  it('sinks the objects into their sockets', () => {
    const model = build();
    model.pose(pose({ sink: 0.5 }));
    BOARDS.forEach((board, k) => {
      for (const s of board.sockets) {
        const object = named(model, `world:object:${s.id}`);
        expect(object.visible, s.id).toBe(true);
        expect(worldOf(object).y, s.id).toBeLessThan(OPEN[k]! + STACK.hover);
        expect(object.scale.x, s.id).toBeCloseTo(STACK.scale * 0.5, 9);
      }
    });
    model.pose(pose({ sink: 1 }));
    for (const board of BOARDS) for (const s of board.sockets) expect(named(model, `world:object:${s.id}`).visible, s.id).toBe(false);
    model.pose(pose({ sink: 0 }));
    for (const board of BOARDS) for (const s of board.sockets) expect(named(model, `world:object:${s.id}`).visible, s.id).toBe(true);
  });

  it('stands each object on its socket on its board, and in the spot when lifted', () => {
    const model = build();
    model.pose(pose());
    BOARDS.forEach((board, k) => {
      for (const s of board.sockets) {
        const at = worldOf(named(model, `world:object:${s.id}`));
        expect(at.x, s.id).toBeCloseTo(C[0] + s.at[0], 9);
        expect(at.z, s.id).toBeCloseTo(C[2] + s.at[1], 9);
        expect(at.y, s.id).toBeCloseTo(OPEN[k]! + STACK.hover, 9);
        expect(named(model, `world:object:${s.id}`).scale.x).toBeCloseTo(STACK.scale, 9);
      }
    });
    // Lifted all the way, its middle is in the spot, and its size the spot's.
    model.pose(pose({ lift: { ...each(0), steady: 1 }, spot: SPOT }));
    const hit = hitOf(model, 'steady');
    const middle = worldOf(hit);
    SPOT.centre.forEach((v, k) => expect(middle.getComponent(k)).toBeCloseTo(v, 6));
    const radius = (hit.geometry as THREE.SphereGeometry).parameters.radius / 1.05;
    expect(radius * named(model, 'world:object:steady').scale.x).toBeCloseTo(SPOT.scale, 6);
    // The others stay on their sockets.
    const jontai = worldOf(named(model, 'world:object:jontai-energy'));
    expect(jontai.y).toBeCloseTo(OPEN[2]! + STACK.hover, 9);
    // Half way, it is up off the socket, above the straight way.
    model.pose(pose({ lift: { ...each(0), steady: 0.5 }, spot: SPOT }));
    const half = worldOf(hit);
    expect(half.y).toBeGreaterThan(OPEN[1]! + STACK.hover + 1);
  });

  it("moves a project's click sphere with its object", () => {
    const model = build();
    model.pose(pose());
    const before = worldOf(hitOf(model, 'cookies-clicker'));
    expect(Math.hypot(before.x - C[0], before.z - C[2])).toBeCloseTo(STACK.ring, 0);
    model.pose(pose({ lift: { ...each(0), 'cookies-clicker': 1 }, spot: SPOT }));
    const after = worldOf(hitOf(model, 'cookies-clicker'));
    SPOT.centre.forEach((v, k) => expect(after.getComponent(k)).toBeCloseTo(v, 6));
  });

  it("aims the beam from the spine at the project's board to the lifted object, and lights it with the lift", () => {
    const model = build();
    const beam = named(model, 'world:beam') as THREE.Mesh;
    const level = () => (beam.material as THREE.ShaderMaterial).uniforms.uLevel!.value as number;
    model.pose(pose());
    expect(level()).toBe(0);
    model.pose(pose({ lift: { ...each(0), 'jontai-energy': 1 }, spot: SPOT }));
    expect(level()).toBeGreaterThan(0);
    const base = worldOf(beam);
    expect(base.x).toBeCloseTo(C[0], 9);
    expect(base.z).toBeCloseTo(C[2], 9);
    expect(base.y).toBeCloseTo(OPEN[2]! + 0.25, 9);
    beam.updateWorldMatrix(true, false);
    const end = new THREE.Vector3(0, 1, 0).applyMatrix4(beam.matrixWorld);
    const middle = worldOf(hitOf(model, 'jontai-energy'));
    expect(end.distanceTo(middle)).toBeLessThan(1e-6);
    // The open one's lamp lights with it, on the camera's side of it.
    const lamp = named(model, 'world:showLight') as THREE.PointLight;
    expect(lamp.intensity).toBeGreaterThan(0);
    model.pose(pose());
    expect(lamp.intensity).toBe(0);
  });

  it("dims the boards, the spine, the CPU and the sockets with the world's level", () => {
    const model = build();
    const plateLevel = (k: number) => ((named(model, `world:board:${k}`).getObjectByName('plate:light') as THREE.Mesh).material as THREE.ShaderMaterial).uniforms.uLevel!.value as number;
    const core = (named(model, 'spine:core0') as THREE.Mesh).material as THREE.ShaderMaterial;
    const lidTop = (named(model, 'world:cpu:lid') as THREE.Mesh).material as THREE.Material[];
    const lid = lidTop[2] as THREE.MeshStandardMaterial;
    const glow = (named(model, 'world:socket:steady:glow') as THREE.Mesh).material as THREE.MeshBasicMaterial;
    model.pose(pose());
    const bright = { plate: plateLevel(1), core: core.uniforms.uLevel!.value as number, lid: lid.emissiveIntensity, glow: glow.opacity };
    expect(bright.plate).toBe(1);
    model.pose(pose({ world: 0.25 }));
    expect(plateLevel(1)).toBe(0.25);
    expect(core.uniforms.uLevel!.value).toBeLessThan(bright.core);
    expect(lid.emissiveIntensity).toBeLessThan(bright.lid);
    expect(glow.opacity).toBeLessThan(bright.glow);
    // Each board as lit as the path has it: the board in view whole, the others stepped back.
    model.pose(pose({ boardLight: [0.7, 1, 0.45, 0.45] }));
    expect([0, 1, 2, 3].map(plateLevel)).toEqual([0.7, 1, 0.45, 0.45]);
  });

  it('turns its reflections with the camera', () => {
    const room = new THREE.Texture();
    const model = build('high', room);
    const reflecting = new Set<THREE.MeshStandardMaterial>();
    model.group.traverse((o) => {
      for (const m of ([] as THREE.Material[]).concat((o as THREE.Mesh).material ?? [])) if ((m as THREE.MeshStandardMaterial).envMap === room) reflecting.add(m as THREE.MeshStandardMaterial);
    });
    expect(reflecting.size).toBeGreaterThan(10);
    model.turn(2.1);
    for (const m of reflecting) expect(m.envMapRotation.y).toBe(2.1);
  });

  it("holds every shader pow's base at zero or more", () => {
    const source = readFileSync(fileURLToPath(new URL('../../../src/engine/bob/build/world.ts', import.meta.url)), 'utf8');
    const pows = [...source.matchAll(/pow\(\s*([a-z]+)\(/g)];
    expect(source.match(/pow\(/g)?.length ?? 0).toBeGreaterThan(0);
    expect(pows.length).toBe(source.match(/pow\(/g)!.length);
    for (const m of pows) expect(['max', 'clamp']).toContain(m[1]);
  });

  it('frees its geometries, materials and textures on dispose', () => {
    const model = build();
    const spies: ReturnType<typeof vi.spyOn>[] = [];
    const seen = new Set<object>();
    model.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh && !(o as THREE.LineSegments).isLineSegments) return;
      if (!seen.has(mesh.geometry)) {
        seen.add(mesh.geometry);
        spies.push(vi.spyOn(mesh.geometry, 'dispose'));
      }
      for (const m of ([] as THREE.Material[]).concat(mesh.material)) {
        if (seen.has(m)) continue;
        seen.add(m);
        spies.push(vi.spyOn(m, 'dispose'));
      }
    });
    expect(spies.length).toBeGreaterThan(60);
    model.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalled();
  });
});
