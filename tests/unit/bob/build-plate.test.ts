import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { buildPlate, PLATE_LOOK, plateLayout, type PlateSpec } from '~/engine/bob/build/plate';
import { STACK, stackPlaces } from '~/scene/bob/worldLayout';
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

/** The stack's boards as the plates are made from them: the power board, then a board per category. */
const BOARDS = stackPlaces(areasOnPath());
function specOf(k: number): PlateSpec {
  const b = BOARDS[k]!;
  return {
    radius: b.radius,
    hole: b.hole,
    cpu: k === 0,
    sockets: b.sockets.map((s) => s.at),
    firstSocket: 1 + BOARDS.slice(0, k).reduce((n, o) => n + o.sockets.length, 0),
    label: b.category ?? '',
    facing: b.facing,
    seed: 2025 + k * 31
  };
}
const POWER = specOf(0);
const APP = specOf(1);
const flat = (x: number, z: number): number => Math.hypot(x, z);
/** A part's four corners on the board. */
function corners(p: { x: number; z: number; yaw: number; half: [number, number] }): [number, number][] {
  const c = Math.cos(p.yaw);
  const s = Math.sin(p.yaw);
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1]
  ].map(([a, b]) => {
    const lx = a! * p.half[0];
    const lz = b! * p.half[1];
    return [p.x + lx * c + lz * s, p.z - lx * s + lz * c];
  });
}
/** The grid the layout keeps parts apart on gives this much at an edge. */
const CELL_GIVE = 0.05;

describe("the stack's boards in code: mask, copper, gold, print, parts and their buses", () => {
  it('keeps the look of the mock-up', () => {
    expect(PLATE_LOOK).toEqual({
      size: { high: 2048, medium: 1024, low: 1024 },
      parts: { high: 1, medium: 0.6, low: 0.35 },
      thick: 0.2,
      dark: 0.22,
      // Round 8: the polish Bob picked.
      lacquer: { clearcoat: 1, clearcoatRoughness: 0.05 },
      lip: { tube: 0.022, gold: 0xe2a54a, steel: 0x8c8798, roughness: 0.24, anisotropy: 0.5, brushed: [0.14, 0.3] },
      round: { radius: 0.006, segments: 2 }
    });
    expect(PLATE_LOOK.thick).toBe(STACK.thick);
  });

  it('lays a bus to every socket and to every heat-sunk processor', () => {
    for (const spec of [POWER, APP, specOf(2), specOf(3)]) {
      const { parts, buses } = plateLayout(spec, 'high');
      const sinks = parts.filter((p) => p.kind === 'sink');
      expect(sinks.length, `${spec.label}'s processors`).toBeGreaterThanOrEqual(2);
      expect(buses).toHaveLength(spec.sockets.length + sinks.length);
      spec.sockets.forEach(([x, z], i) => {
        const lines = buses[i]!;
        expect(lines).toHaveLength(16);
        for (const line of lines) {
          const end = line.at(-1)!;
          expect(flat(end[0] - x, end[1] - z)).toBeLessThan(1.4);
          // From the middle: the spine's ring on a category board, the CPU's side on the power board.
          expect(flat(...line[0]!)).toBeLessThan(spec.cpu ? 1.8 : spec.hole + 0.5);
        }
      });
      sinks.forEach((sink, k) => {
        const lines = buses[spec.sockets.length + k]!;
        expect(lines).toHaveLength(8);
        for (const line of lines) expect(flat(line.at(-1)![0] - sink.x, line.at(-1)![1] - sink.z)).toBeLessThan(0.6);
      });
    }
  });

  it("keeps every part out of the spine's hole, off the sockets and inside the rim", () => {
    // A board with three projects is the busiest a board gets.
    const busy: PlateSpec = { ...APP, sockets: [-0.773, 0, 0.773].map((d) => [Math.sin(APP.facing + d) * 4.4, Math.cos(APP.facing + d) * 4.4] as [number, number]) };
    for (const spec of [POWER, APP, busy]) {
      const { parts } = plateLayout(spec, 'high');
      expect(parts.length).toBeGreaterThan(300);
      for (const p of parts) {
        for (const [x, z] of corners(p)) {
          expect(flat(x, z), `${p.kind} inside the rim`).toBeLessThanOrEqual(spec.radius - 0.68 + CELL_GIVE);
          if (!spec.cpu) expect(flat(x, z), `${p.kind} off the hole`).toBeGreaterThanOrEqual(spec.hole + 0.14 - CELL_GIVE);
          for (const [sx, sz] of spec.sockets) expect(flat(x - sx, z - sz), `${p.kind} off a socket`).toBeGreaterThanOrEqual(1.08 - CELL_GIVE);
        }
        if (spec.cpu) expect(Math.max(Math.abs(p.x), Math.abs(p.z)), `${p.kind} off the CPU`).toBeGreaterThan(1.32);
      }
    }
  });

  it("gives the power board the CPU's power stage and a category board the spine's connector ring", () => {
    const power = plateLayout(POWER, 'high').parts;
    // Capacitors, chokes and switches in square rings round the CPU.
    const ringOf = (kind: string, h: number) => power.filter((p) => p.kind === kind && Math.abs(Math.max(Math.abs(p.x), Math.abs(p.z)) - h) < 0.02);
    expect(ringOf('elec', 1.5).length).toBeGreaterThanOrEqual(20);
    expect(ringOf('choke', 1.86).length).toBeGreaterThanOrEqual(16);
    expect(ringOf('soic', 2.2).length).toBeGreaterThanOrEqual(16);
    const app = plateLayout(APP, 'high').parts;
    // Chokes round the spine's hole where its buses leave room, and switches outside them; no CPU power stage.
    expect(app.filter((p) => p.kind === 'choke' && Math.abs(flat(p.x, p.z) - (APP.hole + 0.42)) < 0.02).length).toBeGreaterThanOrEqual(8);
    expect(app.filter((p) => p.kind === 'soic' && Math.abs(flat(p.x, p.z) - (APP.hole + 0.86)) < 0.02).length).toBeGreaterThanOrEqual(16);
    expect(app.filter((p) => p.kind === 'elec')).toHaveLength(0);
    // Rows of standing memory and big capacitors read from afar.
    expect(app.filter((p) => p.kind === 'dimm').length).toBeGreaterThanOrEqual(4);
    expect(app.filter((p) => p.kind === 'bigcap').length).toBeGreaterThanOrEqual(3);
  });

  it('lays fewer small parts on the lower tiers', () => {
    const small = (tier: 'high' | 'medium' | 'low') => plateLayout(APP, tier).parts.filter((p) => p.kind === 'r' || p.kind === 'c').length;
    const high = small('high');
    expect(high).toBeGreaterThan(200);
    expect(Math.abs(small('medium') / high - 0.6)).toBeLessThan(0.12);
    expect(Math.abs(small('low') / high - 0.35)).toBeLessThan(0.12);
    // The big parts stay on every tier.
    const big = (tier: 'high' | 'low') => plateLayout(APP, tier).parts.filter((p) => ['sink', 'dimm', 'bga', 'bigcap'].includes(p.kind)).length;
    expect(big('low')).toBe(big('high'));
  });

  it('lays the same board every time for the same spec', () => {
    expect(plateLayout(APP, 'high')).toEqual(plateLayout(APP, 'high'));
  });

  it('names its parts, and turns its reflections with the camera', () => {
    const room = new THREE.Texture();
    const plate = buildPlate(APP, 'high', room, canvas);
    for (const name of ['plate:top', 'plate:light', 'plate:edge', 'plate:parts']) expect(plate.group.getObjectByName(name), name).toBeTruthy();
    const reflecting: THREE.MeshStandardMaterial[] = [];
    plate.group.traverse((o) => {
      for (const m of ([] as THREE.Material[]).concat((o as THREE.Mesh).material ?? [])) {
        if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial && (m as THREE.MeshStandardMaterial).envMap === room) reflecting.push(m as THREE.MeshStandardMaterial);
      }
    });
    expect(reflecting.length).toBeGreaterThan(5);
    plate.turn(0.7);
    for (const m of reflecting) expect(m.envMapRotation.y).toBe(0.7);
    // The power and the level reach its light and its dimming.
    plate.set(3, 0.5, 0.4);
    const light = (plate.group.getObjectByName('plate:light') as THREE.Mesh).material as THREE.ShaderMaterial;
    expect(light.uniforms.uPower!.value).toBe(0.5);
    expect(light.uniforms.uLevel!.value).toBe(0.4);
    expect(light.uniforms.uTime!.value).toBe(3);
    // Its textures by tier.
    const map = (tier: 'high' | 'low') => (light.uniforms.uMap!.value as THREE.Texture).image as HTMLCanvasElement;
    expect(map('high').width).toBe(2048);
    const low = buildPlate(APP, 'low', null, canvas);
    expect(((((low.group.getObjectByName('plate:light') as THREE.Mesh).material as THREE.ShaderMaterial).uniforms.uMap!.value as THREE.Texture).image as HTMLCanvasElement).width).toBe(1024);
  });

  // Round 8 (spec 2026-10-30-bob-moonlit-3d-design.md): Bob found the tower "doesnt look polished", and picked the
  // polished test render: a lacquered board, a gold lip on top and a steel one below, rounded parts.
  it('lacquers the board: a full, nearly smooth clear coat', () => {
    const plate = buildPlate(APP, 'high', new THREE.Texture(), canvas);
    const top = (plate.group.getObjectByName('plate:top') as THREE.Mesh).material as THREE.MeshPhysicalMaterial;
    expect(PLATE_LOOK.lacquer.clearcoat).toBe(1);
    expect(PLATE_LOOK.lacquer.clearcoatRoughness).toBeLessThanOrEqual(0.08);
    expect(top.clearcoat).toBe(PLATE_LOOK.lacquer.clearcoat);
    expect(top.clearcoatRoughness).toBe(PLATE_LOOK.lacquer.clearcoatRoughness);
  });

  it('lines each plate with a gold lip on top and a steel lip below, hugging the edge', () => {
    const tube = PLATE_LOOK.lip.tube;
    for (const tier of ['high', 'medium', 'low'] as const) {
      const plate = buildPlate(APP, tier, new THREE.Texture(), canvas);
      const top = plate.group.getObjectByName('plate:lip:top') as THREE.Mesh;
      const bottom = plate.group.getObjectByName('plate:lip:bottom') as THREE.Mesh;
      expect(top, tier).toBeTruthy();
      expect(bottom, tier).toBeTruthy();
      for (const lip of [top, bottom]) {
        const g = (lip.geometry as THREE.TorusGeometry).parameters;
        expect(Math.abs(g.radius - APP.radius), tier).toBeLessThanOrEqual(tube);
        expect(g.tube).toBe(tube);
        expect([lip.position.x, lip.position.z]).toEqual([0, 0]);
      }
      expect(top.position.y).toBeGreaterThanOrEqual(-tube);
      expect(top.position.y).toBeLessThanOrEqual(0);
      expect(bottom.position.y).toBeGreaterThanOrEqual(-PLATE_LOOK.thick);
      expect(bottom.position.y).toBeLessThanOrEqual(-PLATE_LOOK.thick + tube);
      const gold = top.material as THREE.MeshStandardMaterial;
      expect(gold.metalness).toBe(1);
      expect(gold.color.getHex()).toBe(new THREE.Color(PLATE_LOOK.lip.gold).getHex());
      expect((bottom.material as THREE.MeshStandardMaterial).color.getHex()).toBe(new THREE.Color(PLATE_LOOK.lip.steel).getHex());
      // They dim with the board.
      plate.set(0, 1, 1);
      const lit = gold.color.r;
      plate.set(0, 0, 1);
      expect(gold.color.r).toBeLessThan(lit);
      if (tier === 'low') {
        expect(gold).not.toBeInstanceOf(THREE.MeshPhysicalMaterial);
      } else {
        expect(gold, tier).toBeInstanceOf(THREE.MeshPhysicalMaterial);
        expect((gold as THREE.MeshPhysicalMaterial).anisotropy).toBeGreaterThan(0);
        expect(top.geometry.getAttribute('tangent'), tier).toBeTruthy();
      }
    }
  });

  it('rounds the box parts on the high tier only', () => {
    const count = (tier: 'high' | 'medium' | 'low') =>
      ((buildPlate(APP, tier, null, canvas).group.getObjectByName('plate:qfp') as THREE.Mesh).geometry.getAttribute('position')).count;
    expect(count('high')).toBeGreaterThan(24);
    expect(count('medium')).toBe(24);
    expect(count('low')).toBe(24);
  });

  // Bob (2026-10-30): "when it reach the cpu chip it slowly powers (light on) the tower". A board stands dark until its
  // power comes, its body at `PLATE_LOOK.dark` of its light, and lights with it; its level still dims it as before.
  it('stands dark until its power comes, and lights with it', () => {
    const room = new THREE.Texture();
    const plate = buildPlate(APP, 'high', room, canvas);
    const top = (plate.group.getObjectByName('plate:top') as THREE.Mesh).material as THREE.MeshPhysicalMaterial;
    const shade = (power: number, level: number): [number, number] => {
      plate.set(0, power, level);
      return [top.color.r, top.envMapIntensity];
    };
    const [lit, litReflects] = shade(1, 1);
    expect(lit).toBeGreaterThan(0);
    const [off, offReflects] = shade(0, 1);
    expect(off / lit).toBeCloseTo(0.22, 6);
    expect(offReflects / litReflects).toBeCloseTo(0.22, 6);
    expect(shade(0.5, 1)[0] / lit).toBeCloseTo(0.22 + 0.78 * 0.5, 6);
    expect(shade(1, 0)[0] / lit).toBeCloseTo(0.06, 6);
  });

  // The power's front a bright ring as it reaches out, and the copper behind it surging and settling, so the light can be
  // seen running out over the board from the CPU.
  it('runs a bright front out from the middle with a surge behind it', () => {
    const source = readFileSync(fileURLToPath(new URL('../../../src/engine/bob/build/plate.ts', import.meta.url)), 'utf8');
    expect(source).toMatch(/float surge = exp\(-max\(reach - r, 0\.0\) \* 0\.7\) \* \(1\.0 - step\(0\.999, uPower\)\);/);
    expect(source).toMatch(/c = c \* on \* \(1\.0 \+ 1\.6 \* surge\) \+ uGold \* \(t\.r \+ t\.g \* 0\.5 \+ t\.b \* 0\.5\) \* front \* 3\.0 \+ uGold \* front \* 0\.1;/);
  });

  it("holds every shader pow's base at zero or more", () => {
    const source = readFileSync(fileURLToPath(new URL('../../../src/engine/bob/build/plate.ts', import.meta.url)), 'utf8');
    const pows = [...source.matchAll(/pow\(\s*([a-z]+)\(/g)];
    expect(source.match(/pow\(/g)?.length ?? 0).toBeGreaterThan(0);
    expect(pows.length).toBe(source.match(/pow\(/g)!.length);
    for (const m of pows) expect(['max', 'clamp']).toContain(m[1]);
  });

  it('frees its geometries, materials and textures on dispose', () => {
    const plate = buildPlate(APP, 'high', null, canvas);
    const spies: ReturnType<typeof vi.spyOn>[] = [];
    const textures = new Set<THREE.Texture>();
    plate.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      spies.push(vi.spyOn(mesh.geometry, 'dispose'));
      for (const m of ([] as THREE.Material[]).concat(mesh.material)) {
        spies.push(vi.spyOn(m, 'dispose'));
        for (const value of Object.values(m)) if ((value as THREE.Texture)?.isTexture) textures.add(value as THREE.Texture);
        const uniforms = (m as THREE.ShaderMaterial).uniforms;
        if (uniforms) for (const u of Object.values(uniforms)) if ((u.value as THREE.Texture)?.isTexture) textures.add(u.value as THREE.Texture);
      }
    });
    for (const t of textures) spies.push(vi.spyOn(t, 'dispose'));
    expect(spies.length).toBeGreaterThan(30);
    expect(textures.size).toBeGreaterThanOrEqual(5);
    plate.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalled();
  });
});
