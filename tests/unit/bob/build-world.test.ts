import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { projects, type ProjectId } from '~/data/projects';
import { buildWorld, WORLD_LOOK, type WorldModel, type WorldPose } from '~/engine/bob/build/world';
import { worldPlaces } from '~/scene/bob/worldLayout';
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

const PLACES = worldPlaces(areasOnPath());
const IDS = PLACES.flatMap((a) => a.projects.map((p) => p.id));

function build(tier: 'high' | 'medium' | 'low' = 'high'): WorldModel {
  return buildWorld(PLACES, tier, canvas);
}

const each = <T>(value: T): Record<ProjectId, T> => Object.fromEntries(IDS.map((id) => [id, value])) as Record<ProjectId, T>;
const pose = (over: Partial<WorldPose> = {}): WorldPose => ({ power: 1, flash: 0, clock: 0, levels: each(1), open: each(0), float: 1, world: 1, ...over });
const named = (model: WorldModel, name: string): THREE.Object3D => {
  const found = model.group.getObjectByName(name);
  if (!found) throw new Error(`no part named ${name}`);
  return found;
};

describe('the hologram world, built in code: the board, the CPU with the compass, the pads and the objects', () => {
  it('names its board, its CPU, and a pad and an object for each project', () => {
    const model = build();
    expect(model.group.name).toBe('world');
    for (const name of ['world:board', 'world:cpu']) expect(named(model, name)).toBeTruthy();
    for (const id of IDS) {
      expect(named(model, `world:pad:${id}`)).toBeTruthy();
      expect(named(model, `world:object:${id}`)).toBeTruthy();
    }
    // One thing to click per project, each saying whose it is.
    expect(model.hits.map((h) => h.userData.id)).toEqual(IDS);
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

  it("lifts Steady's lid as it opens and sets it back as it closes", () => {
    const model = build();
    const lid = named(model, 'world:object:steady:lid');
    model.pose(pose());
    const shut = lid.position.y;
    model.pose(pose({ open: { ...each(0), steady: 1 } }));
    expect(lid.position.y).toBeGreaterThan(shut + 0.25);
    model.pose(pose({ open: { ...each(0), steady: 0.5 } }));
    expect(lid.position.y).toBeGreaterThan(shut);
    model.pose(pose());
    expect(lid.position.y).toBeCloseTo(shut, 9);
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

  it("dims the board, the CPU and the pads with the world's level", () => {
    const model = build();
    const circuit = (named(model, 'world:board:circuit') as THREE.Mesh).material as THREE.ShaderMaterial;
    model.pose(pose());
    expect(circuit.uniforms.uLevel!.value).toBe(1);
    model.pose(pose({ world: 0.25 }));
    expect(circuit.uniforms.uLevel!.value).toBe(0.25);
  });

  it('draws the circuit smaller and sparer on the lower tiers', () => {
    expect(WORLD_LOOK.circuit.size).toEqual({ high: 2048, medium: 1024, low: 1024 });
    expect(WORLD_LOOK.circuit.traces).toEqual({ high: 380, medium: 240, low: 140 });
    const map = (tier: 'high' | 'low') =>
      (((named(build(tier), 'world:board:circuit') as THREE.Mesh).material as THREE.ShaderMaterial).uniforms.uMap!.value as THREE.Texture).image as HTMLCanvasElement;
    expect(map('high').width).toBe(2048);
    expect(map('low').width).toBe(1024);
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
    model.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh && !(o as THREE.LineSegments).isLineSegments) return;
      spies.push(vi.spyOn(mesh.geometry, 'dispose'));
      for (const m of ([] as THREE.Material[]).concat(mesh.material)) spies.push(vi.spyOn(m, 'dispose'));
    });
    expect(spies.length).toBeGreaterThan(20);
    model.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalled();
  });
});
