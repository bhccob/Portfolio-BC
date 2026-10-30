import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { buildSpine, SPINE_LOOK, type SpineSpec } from '~/engine/bob/build/spine';
import { boardTops, STACK, stackPlaces } from '~/scene/bob/worldLayout';
import { areasOnPath } from '~/state/chapters';

const BOARDS = stackPlaces(areasOnPath());
const OPEN = boardTops(BOARDS, 1);
const CLOSED = boardTops(BOARDS, 0);
const SPEC: SpineSpec = { tops: OPEN, hole: STACK.hole, thick: STACK.thick };
const span = (spine: ReturnType<typeof buildSpine>, k: number): THREE.Object3D => {
  const found = spine.group.getObjectByName(`spine:span${k}`);
  if (!found) throw new Error(`no span ${k}`);
  return found;
};
const tubes = (o: THREE.Object3D): number => {
  let n = 0;
  o.traverse((c) => {
    if ((c as THREE.Mesh).geometry instanceof THREE.TubeGeometry) n++;
  });
  return n;
};

describe('the quantum spine in code: flanges, cable bundles, the glass core, the guide lines', () => {
  it('keeps the look of the mock-up', () => {
    expect(SPINE_LOOK).toEqual({ bundles: { high: 24, medium: 16, low: 10 }, tip: 3.4, lamp: 3.6 });
  });

  it('makes a span under every board, the last one with the tip', () => {
    const spine = buildSpine(SPEC, 'high', null);
    expect(spine.group.name).toBe('spine');
    for (let k = 0; k < OPEN.length; k++) expect(span(spine, k)).toBeTruthy();
    expect(spine.group.getObjectByName(`spine:span${OPEN.length}`)).toBeUndefined();
    const tip = spine.group.getObjectByName('spine:tip');
    expect(tip).toBeTruthy();
    let o: THREE.Object3D | null = tip!;
    while (o && o.name !== `spine:span${OPEN.length - 1}`) o = o.parent;
    expect(o, 'the tip is in the last span').not.toBeNull();
  });

  it('squeezes each span to the gap between the boards it is posed with', () => {
    const spine = buildSpine(SPEC, 'high', null);
    for (const tops of [OPEN, CLOSED, boardTops(BOARDS, 0.5)]) {
      spine.pose(tops);
      for (let k = 0; k < tops.length; k++) {
        const piece = span(spine, k);
        // Its top under its board.
        expect(piece.position.y).toBeCloseTo(tops[k]! - STACK.thick, 9);
        if (k + 1 < tops.length) {
          const height = OPEN[k]! - STACK.thick - OPEN[k + 1]! - 0.1;
          const gap = tops[k]! - STACK.thick - tops[k + 1]! - 0.1;
          expect(piece.scale.y).toBeCloseTo(Math.max(0.02, gap / height), 9);
          // Its bottom over the next board.
          expect(piece.position.y - height * piece.scale.y).toBeGreaterThanOrEqual(tops[k + 1]! - 1e-9);
        } else {
          expect(piece.scale.y).toBe(1);
        }
      }
    }
  });

  // Bob (2026-10-30): the tower's strings "too busy"; he picked B, two thick rings and no dashed lines.
  it('draws no dashed guide lines between the boards', () => {
    const spine = buildSpine(SPEC, 'high', null);
    for (let k = 0; k < OPEN.length; k++) {
      const lines = span(spine, k).children.filter((c) => (c as THREE.Line).isLine);
      expect(lines).toHaveLength(0);
    }
  });

  it('lights its spans from the top down as the power runs', () => {
    const spine = buildSpine(SPEC, 'high', null);
    spine.pose(OPEN);
    const lamps = (): number[] => OPEN.map((_, k) => (spine.group.getObjectByName(`spine:lamp${k}`) as THREE.PointLight).intensity);
    spine.set(0, 0, 1);
    expect(lamps().every((v) => v === 0)).toBe(true);
    spine.set(0, 0.5, 1);
    const half = lamps();
    for (let k = 0; k + 1 < half.length; k++) expect(half[k]!, `lamp ${k}`).toBeGreaterThanOrEqual(half[k + 1]!);
    expect(half[0]).toBeGreaterThan(half.at(-1)!);
    spine.set(0, 1, 1);
    const whole = lamps();
    for (const v of whole) expect(v).toBeCloseTo(SPINE_LOOK.lamp, 9);
    // Dim while a project is open.
    spine.set(0, 1, 0.2);
    expect(lamps()[0]).toBeLessThan(whole[0]!);
  });

  it('uses fewer bundles on the lower tiers', () => {
    const count = (tier: 'high' | 'medium' | 'low') => tubes(span(buildSpine(SPEC, tier, null), 1));
    expect(count('high')).toBe(24 * 4);
    expect(count('medium')).toBe(16 * 4);
    expect(count('low')).toBe(10 * 4);
  });

  it('turns its reflections with the camera', () => {
    const room = new THREE.Texture();
    const spine = buildSpine(SPEC, 'high', room);
    const reflecting = new Set<THREE.MeshStandardMaterial>();
    spine.group.traverse((o) => {
      for (const m of ([] as THREE.Material[]).concat((o as THREE.Mesh).material ?? [])) if ((m as THREE.MeshStandardMaterial).envMap === room) reflecting.add(m as THREE.MeshStandardMaterial);
    });
    expect(reflecting.size).toBeGreaterThanOrEqual(4);
    spine.turn(-1.2);
    for (const m of reflecting) expect(m.envMapRotation.y).toBe(-1.2);
  });

  it("holds every shader pow's base at zero or more", () => {
    const source = readFileSync(fileURLToPath(new URL('../../../src/engine/bob/build/spine.ts', import.meta.url)), 'utf8');
    const pows = [...source.matchAll(/pow\(\s*([a-z]+)\(/g)];
    expect(source.match(/pow\(/g)?.length ?? 0).toBeGreaterThan(0);
    expect(pows.length).toBe(source.match(/pow\(/g)!.length);
    for (const m of pows) expect(['max', 'clamp']).toContain(m[1]);
  });

  it('frees its geometries and materials on dispose', () => {
    const spine = buildSpine(SPEC, 'high', null);
    const spies: ReturnType<typeof vi.spyOn>[] = [];
    const seen = new Set<object>();
    spine.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.geometry) return;
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
    expect(spies.length).toBeGreaterThan(30);
    spine.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalled();
  });
});
