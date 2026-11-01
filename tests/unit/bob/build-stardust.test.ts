import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { buildStardust, sampleStardust, stardustCount, stardustPose, type StardustSpec } from '~/engine/bob/build/stardust';
import { easeInOutQuart } from '~/input/scrollLoop';
import { WAY_OUT, wayOutAt } from '~/scene/bob/wayOut';
import { boardCentre, boardTops, STACK, stackPlaces } from '~/scene/bob/worldLayout';
import { areasOnPath } from '~/state/chapters';

const TOPS = boardTops(stackPlaces(areasOnPath()), 0);
const SPEC: StardustSpec = { centre: boardCentre(), tops: TOPS, core: STACK.core, radius: STACK.radius };
const FOOT = TOPS[TOPS.length - 1]! - STACK.thick;
/** The place in the Q&A `g` seconds into the dissolve. */
const inDissolve = (g: number): number => -1 + easeInOutQuart(g / WAY_OUT.dissolve);

describe('the stardust: the tower as points of light, and the field they settle in (round 15)', () => {
  it('has 70 000 points on high, 35 000 on medium and 18 000 on low', () => {
    expect(stardustCount('high')).toBe(70_000);
    expect(stardustCount('medium')).toBe(35_000);
    expect(stardustCount('low')).toBe(18_000);
  });

  it("stands every point on the closed tower first: a board's top or its rim", () => {
    const { tower } = sampleStardust(SPEC, 70_000);
    const [cx, , cz] = SPEC.centre;
    for (let i = 0; i < 70_000; i++) {
      const x = tower[i * 3]! - cx;
      const y = tower[i * 3 + 1]!;
      const z = tower[i * 3 + 2]! - cz;
      const r = Math.hypot(x, z);
      const b = TOPS.findIndex((top) => y <= top + 1e-6 && y >= top - STACK.thick - 1e-6);
      expect(b, `point ${i} at y ${y}`).toBeGreaterThanOrEqual(0);
      expect(r, `point ${i}`).toBeLessThanOrEqual((b === 0 ? STACK.core : STACK.radius) + 1e-6);
    }
  });

  it('settles each in a disc 7 m under the tower\'s foot, 9 to 109 m out, at its own angle give or take 25°', () => {
    const { tower, field } = sampleStardust(SPEC, 70_000);
    const [cx, , cz] = SPEC.centre;
    for (let i = 0; i < 70_000; i++) {
      const fx = field[i * 3]! - cx;
      const fz = field[i * 3 + 2]! - cz;
      const r = Math.hypot(fx, fz);
      expect(r).toBeGreaterThanOrEqual(9 - 1e-6);
      expect(r).toBeLessThanOrEqual(109 + 1e-6);
      expect(Math.abs(field[i * 3 + 1]! - (FOOT - 7))).toBeLessThanOrEqual(0.25 + 1e-6);
      const tx = tower[i * 3]! - cx;
      const tz = tower[i * 3 + 2]! - cz;
      if (Math.hypot(tx, tz) < 0.2) continue; // on the axis, a point has no angle of its own
      const turn = Math.atan2(Math.sin(Math.atan2(fz, fx) - Math.atan2(tz, tx)), Math.cos(Math.atan2(fz, fx) - Math.atan2(tz, tx)));
      expect(Math.abs(turn)).toBeLessThanOrEqual((25 * Math.PI) / 180 + 1e-6);
    }
  });

  it('is violet, three in ten gold', () => {
    const { colour } = sampleStardust(SPEC, 70_000);
    let gold = 0;
    for (let i = 0; i < 70_000; i++) if (colour[i * 3]! === 1 && Math.abs(colour[i * 3 + 1]! - 0.66) < 1e-6) gold++;
    expect(gold / 70_000).toBeGreaterThan(0.28);
    expect(gold / 70_000).toBeLessThan(0.32);
  });

  it('is posed by the way out: none before 2.5 s of the dissolve, then its points and their flight', () => {
    expect(stardustPose(null, 3, false, 900)).toBeNull();
    expect(stardustPose(wayOutAt(-1), 3, false, 900)).toBeNull();
    expect(stardustPose(wayOutAt(inDissolve(2.4)), 3, false, 900)).toBeNull();
    const at3 = stardustPose(wayOutAt(inDissolve(3)), 12, false, 900)!;
    expect(at3.show).toBeCloseTo(5 / 7, 9);
    expect(at3.flight).toBe(0);
    expect(at3.clock).toBe(12);
    expect(at3.scale).toBe(900);
    const q3 = stardustPose(wayOutAt(3), 12, false, 900)!;
    expect([q3.show, q3.flight]).toEqual([1, 1]);
    // Still with reduced motion: the field does not turn.
    expect(stardustPose(wayOutAt(3), 12, true, 900)!.clock).toBe(0);
  });

  it('builds one points object with its attributes, and frees them', () => {
    const model = buildStardust(SPEC, 'low');
    expect(model.points).toBeInstanceOf(THREE.Points);
    const geometry = model.points.geometry;
    expect(geometry.getAttribute('position').count).toBe(18_000);
    for (const name of ['aField', 'aRand', 'aCol']) expect(geometry.getAttribute(name).count, name).toBe(18_000);
    const material = model.points.material as THREE.ShaderMaterial;
    expect(material.blending).toBe(THREE.AdditiveBlending);
    expect(material.depthWrite).toBe(false);
    model.pose({ show: 0.5, flight: 0.25, clock: 3, scale: 800 });
    expect(material.uniforms.uShow!.value).toBe(0.5);
    expect(material.uniforms.uA!.value).toBe(0.25);
    const freeGeometry = vi.spyOn(geometry, 'dispose');
    const freeMaterial = vi.spyOn(material, 'dispose');
    model.dispose();
    expect(freeGeometry).toHaveBeenCalled();
    expect(freeMaterial).toHaveBeenCalled();
  });
});
