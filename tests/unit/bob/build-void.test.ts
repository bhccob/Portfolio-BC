import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { GLASS_LOOK } from '~/engine/bob/build/glassFloor';
import { TRACES_LOOK, TRACES_RENDER_ORDER } from '~/engine/bob/build/traces';
import { buildVoid, VOID_HAZE_ORDER, VOID_LOOK, type VoidModel } from '~/engine/bob/build/void';
import { TRACE, traceLayout } from '~/engine/bob/traces';
import { WORDMARK } from '~/engine/bob/wordmark';
import { palette } from '~/engine/palette';
import type { QualityTier } from '~/engine/quality';

const TIERS: readonly QualityTier[] = ['high', 'medium', 'low'];

/** The object called `name` under `root`, which must exist. */
function objectNamed<T extends THREE.Object3D>(root: THREE.Object3D, name: string): T {
  const found = root.getObjectByName(name);
  expect(found, name).toBeDefined();
  return found as T;
}

/** The void's mist sprites, in the order the group holds them. */
function sprites(v: VoidModel): THREE.Sprite[] {
  return objectNamed(v.group, 'void:mist').children.filter((o): o is THREE.Sprite => (o as THREE.Sprite).isSprite);
}

/** The dust: the points, and how many of them are drawn. */
function dust(v: VoidModel): { points: THREE.Points; drawn: number; at: (i: number) => THREE.Vector3 } {
  const points = objectNamed<THREE.Points>(v.group, 'void:dust');
  const position = points.geometry.getAttribute('position');
  const drawn = points.geometry.drawRange.count;
  return { points, drawn, at: (i) => new THREE.Vector3().fromBufferAttribute(position, i) };
}

/** The beam's material. */
function beamMaterial(v: VoidModel): THREE.MeshBasicMaterial {
  return objectNamed<THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>(v.group, 'void:beam').material;
}

/** A colour as a multiple of a palette hex, in linear light, as the builders make it. */
function times(hex: number, scale: number): THREE.Color {
  return new THREE.Color(hex).multiplyScalar(scale);
}

function expectColour(actual: THREE.Color, expected: THREE.Color): void {
  expect(actual.r).toBeCloseTo(expected.r, 6);
  expect(actual.g).toBeCloseTo(expected.g, 6);
  expect(actual.b).toBeCloseTo(expected.b, 6);
}

/** Everything drawn that two models should agree on if they are the same void: the mist and the dust, as numbers. */
function picture(v: VoidModel): number[] {
  const { at, drawn } = dust(v);
  return [
    ...sprites(v).flatMap((o) => [o.userData.layer as number, ...o.position.toArray(), o.material.opacity, o.scale.x, o.scale.y]),
    drawn,
    ...Array.from({ length: drawn }, (_, i) => at(i).toArray()).flat(),
    beamMaterial(v).opacity
  ];
}

/** The distance from `p` to the segment from `a` to `b`. */
function distanceToSegment(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number {
  const ab = b.clone().sub(a);
  const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / ab.lengthSq()));
  return p.distanceTo(a.clone().add(ab.multiplyScalar(t)));
}

describe('the void', () => {
  it('holds the named parts, on every tier', () => {
    for (const tier of TIERS) {
      const v = buildVoid(tier);
      expect(v.group.isGroup).toBe(true);
      expect(v.group.name).toBe('void');
      expect(v.group.children.map((o) => o.name)).toEqual(['void:ceiling', 'void:traces', 'void:ring', 'void:mist', 'void:dust', 'void:beam']);
      v.dispose();
    }
  });

  it('is the preview: the ceiling at 1.2 under the glass from the 1.585 hole out to 60, the traces at 0.35, 3 / 2 / 0 mist layers, 400 / 200 / 60 dust points', () => {
    expect(VOID_LOOK.ceiling.y).toBe(-1.2);
    expect(VOID_LOOK.ceiling.inner).toBe(1.585);
    expect(VOID_LOOK.ceiling.outer).toBe(60);
    expect(VOID_LOOK.traces.level).toBe(0.35);
    expect(VOID_LOOK.mist.layers).toEqual({ high: 3, medium: 2, low: 0 });
    expect(VOID_LOOK.dust.count).toEqual({ high: 400, medium: 200, low: 60 });
    // The glass's own numbers, so the ceiling and the glass stay one slab: the tunnel's foot and the hole and the floor's reach.
    expect(VOID_LOOK.ceiling.y).toBe(GLASS_LOOK.well.bottom);
    expect(VOID_LOOK.ceiling.inner).toBe(WORDMARK.hole);
    expect(VOID_LOOK.ceiling.outer).toBe(GLASS_LOOK.floor.outer);
  });
});

describe('the ceiling', () => {
  it('is the glass seen from below: an annulus from the hole at 1.585 out to 60, flat at y -1.2', () => {
    const v = buildVoid('high');
    const ceiling = objectNamed<THREE.Mesh>(v.group, 'void:ceiling');
    const position = ceiling.geometry.getAttribute('position');
    let inner = Infinity;
    let outer = 0;
    for (let i = 0; i < position.count; i++) {
      const r = Math.hypot(position.getX(i), position.getZ(i));
      inner = Math.min(inner, r);
      outer = Math.max(outer, r);
      expect(position.getY(i) + ceiling.position.y).toBeCloseTo(-1.2, 9);
    }
    expect(inner).toBeCloseTo(1.585, 5);
    expect(outer).toBeCloseTo(60, 4);
    v.dispose();
  });

  it('faces down: every normal points to -y and every triangle is wound to be seen from below', () => {
    const v = buildVoid('high');
    const { geometry } = objectNamed<THREE.Mesh>(v.group, 'void:ceiling');
    const normal = geometry.getAttribute('normal');
    for (let i = 0; i < normal.count; i++) expect(normal.getY(i)).toBeCloseTo(-1, 6);
    const position = geometry.getAttribute('position');
    const index = geometry.getIndex()!;
    const [a, b, c] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    for (let t = 0; t < index.count; t += 3) {
      a.fromBufferAttribute(position, index.getX(t));
      b.fromBufferAttribute(position, index.getX(t + 1));
      c.fromBufferAttribute(position, index.getX(t + 2));
      expect(b.sub(a).cross(c.sub(a)).y, `triangle ${t / 3}`).toBeLessThan(0);
    }
    v.dispose();
  });

  it('is near-black glass, a single-sided slab seen from below: the home above it sees straight through to the void only at the hole', () => {
    const v = buildVoid('high');
    const ceiling = objectNamed<THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>>(v.group, 'void:ceiling');
    const m = ceiling.material;
    expect(m).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    expectColour(m.color, new THREE.Color(palette.black));
    expect(m.specularIntensity).toBe(GLASS_LOOK.floor.specular);
    expect(m.metalness).toBe(0);
    expect(m.side).toBe(THREE.FrontSide);
    // Opaque and writing depth, so the home above it is hidden from below; its fog is the scene's.
    expect(m.transparent).toBe(false);
    expect(m.depthWrite).toBe(true);
    expect(m.depthTest).toBe(true);
    expect(m.fog).toBe(true);
    v.dispose();
  });

  it('draws first of the void, before its traces, which draw without a depth test over it', () => {
    const v = buildVoid('high');
    const ceiling = objectNamed<THREE.Mesh>(v.group, 'void:ceiling');
    const lines = objectNamed<THREE.LineSegments>(v.group, 'void:traces:lines');
    expect(lines.renderOrder).toBe(TRACES_RENDER_ORDER);
    expect(ceiling.renderOrder).toBeLessThan(lines.renderOrder);
    v.dispose();
  });
});

describe('the traces under the ceiling', () => {
  const layout = traceLayout();

  it("are the glass's own layout, line for line, lying just under the ceiling", () => {
    const v = buildVoid('high');
    const traces = objectNamed<THREE.Group>(v.group, 'void:traces');
    const lines = objectNamed<THREE.LineSegments>(traces, 'void:traces:lines');
    expect(lines).toBeInstanceOf(THREE.LineSegments);
    const segments = layout.traces.reduce((sum, trace) => sum + trace.length - 1, 0) + layout.pads.length * TRACE.pad.segments;
    const position = lines.geometry.getAttribute('position');
    expect(position.count).toBe(segments * 2);
    // The same place on the floor plan, x and z, as the traces on the glass over them.
    expect(position.getX(0)).toBeCloseTo(layout.traces[0]![0]![0], 5);
    expect(position.getZ(0)).toBeCloseTo(layout.traces[0]![0]![1], 5);
    traces.updateMatrixWorld(true);
    const world = new THREE.Vector3().setFromMatrixPosition(lines.matrixWorld);
    expect(world.y).toBeLessThan(-1.2);
    expect(world.y).toBeGreaterThan(-1.2 - 0.05);
    v.dispose();
  });

  it('glow in the gold at 0.35, under the glass: drawn over the ceiling with no depth test and no depth write', () => {
    const v = buildVoid('high');
    const lines = objectNamed<THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>>(v.group, 'void:traces:lines');
    expectColour(lines.material.color, times(TRACES_LOOK.colour, 0.35));
    expect(lines.material.depthTest).toBe(false);
    expect(lines.material.depthWrite).toBe(false);
    v.dispose();
  });
});

describe('the gold ring', () => {
  it('rings the hole at the rim: a 0.02 tube at 1.635, a hair under the ceiling, in the lip\'s gold', () => {
    const v = buildVoid('high');
    const ring = objectNamed<THREE.Mesh<THREE.TorusGeometry, THREE.MeshStandardMaterial>>(v.group, 'void:ring');
    expect(ring.geometry.parameters.radius).toBeCloseTo(1.585 + 0.05, 9);
    expect(ring.geometry.parameters.tube).toBe(0.02);
    expect(ring.position.y).toBeCloseTo(-1.2 - 0.01, 9);
    // Lying flat: every vertex within a tube's width of the ring's plane.
    const position = ring.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i += 37) expect(Math.abs(position.getY(i))).toBeLessThanOrEqual(0.02 + 1e-9);
    const m = ring.material;
    expectColour(m.color, new THREE.Color(GLASS_LOOK.lip.colour));
    expectColour(m.emissive, new THREE.Color(GLASS_LOOK.lip.emissive));
    expect(m.emissiveIntensity).toBe(GLASS_LOOK.lip.emissiveIntensity);
    expect(m.metalness).toBeGreaterThan(0.5);
    v.dispose();
  });
});

describe('the mist', () => {
  it('lies in 3 layers on high, 2 on medium and none on low', () => {
    const layersOf = (v: VoidModel) => [...new Set(sprites(v).map((o) => o.userData.layer as number))];
    const high = buildVoid('high');
    const medium = buildVoid('medium');
    const low = buildVoid('low');
    expect(layersOf(high)).toEqual([0, 1, 2]);
    expect(layersOf(medium)).toEqual([0, 1]);
    expect(layersOf(low)).toEqual([]);
    expect(sprites(high)).toHaveLength(3 * VOID_LOOK.mist.puffs);
    expect(sprites(medium)).toHaveLength(2 * VOID_LOOK.mist.puffs);
    expect(sprites(low)).toHaveLength(0);
    // Medium is the high tier's mist, thinned: the same puffs where it keeps them.
    expect(sprites(medium).map((o) => o.position.toArray())).toEqual(sprites(high).filter((o) => (o.userData.layer as number) < 2).map((o) => o.position.toArray()));
    for (const v of [high, medium, low]) v.dispose();
  });

  it('is layers, not balls: soft sprites far wider than tall, from the beads back, each layer deeper than the last', () => {
    const v = buildVoid('high');
    const depth = (layer: number) => sprites(v).filter((o) => o.userData.layer === layer).map((o) => o.position.z);
    for (const o of sprites(v)) {
      expect(o.scale.x).toBeGreaterThan(1.5 * o.scale.y);
      expect(o.material.map).toBeInstanceOf(THREE.DataTexture);
    }
    // The farthest bead (Cookies) stands at z -13: the haze is its backdrop, never in front of any bead.
    for (const o of sprites(v)) expect(o.position.z + VOID_LOOK.mist.sway.z).toBeLessThan(-13.5);
    expect(Math.max(...depth(1))).toBeLessThan(Math.min(...depth(0)));
    expect(Math.max(...depth(2))).toBeLessThan(Math.min(...depth(1)));
    // Under the ceiling, wholly.
    for (const o of sprites(v)) expect(o.position.y + o.scale.y / 2).toBeLessThan(VOID_LOOK.ceiling.y);
    v.dispose();
  });

  it('is the haze, dimmed, added to what is behind: writes no depth, tests it, and stays out of the fog', () => {
    const v = buildVoid('high');
    const expected = new THREE.Color(palette.haze).multiplyScalar(VOID_LOOK.mist.dim);
    expect(VOID_LOOK.mist.colour).toBe(palette.haze);
    const textures = new Set<THREE.Texture | null>();
    for (const o of sprites(v)) {
      const m = o.material;
      expectColour(m.color, expected);
      expect(m.blending).toBe(THREE.AdditiveBlending);
      expect(m.transparent).toBe(true);
      expect(m.depthWrite).toBe(false);
      expect(m.depthTest).toBe(true);
      expect(m.fog).toBe(false);
      textures.add(m.map);
    }
    expect(textures.size).toBe(1);
    v.dispose();
  });

  it('drifts on its period: the same picture a period on, a different one in between, from the time alone, slowly', () => {
    const v = buildVoid('high');
    v.setLight(1, 1);
    const mist = () => sprites(v).flatMap((o) => [o.position.x, o.position.y, o.position.z, o.material.opacity]);
    const random = vi.spyOn(Math, 'random');
    v.setTime(17);
    const first = mist();
    v.setTime(17 + VOID_LOOK.mist.period / 2.5);
    const between = mist();
    v.setTime(17 + VOID_LOOK.mist.period);
    const later = mist();
    expect(random).not.toHaveBeenCalled();
    random.mockRestore();
    later.forEach((x, i) => expect(x).toBeCloseTo(first[i]!, 6));
    expect(between).not.toEqual(first);
    v.setTime(17 + 1 / 60);
    const next = mist();
    for (let i = 0; i < first.length; i += 4) expect(Math.abs(next[i]! - first[i]!)).toBeLessThan(0.01);
    v.dispose();
  });
});

describe('the dust', () => {
  it('has 400 points on high, 200 on medium and 60 on low, the lower tiers the same dust thinned', () => {
    const counts = TIERS.map((tier) => {
      const v = buildVoid(tier);
      const d = dust(v);
      expect(d.points).toBeInstanceOf(THREE.Points);
      v.dispose();
      return d.drawn;
    });
    expect(counts).toEqual([400, 200, 60]);
    const high = buildVoid('high');
    const low = buildVoid('low');
    for (let i = 0; i < 60; i++) expect(dust(low).at(i).toArray()).toEqual(dust(high).at(i).toArray());
    high.dispose();
    low.dispose();
  });

  it('is gold points added to what is behind, writing no depth and out of the fog', () => {
    const v = buildVoid('high');
    const { points } = dust(v);
    const m = points.material as THREE.PointsMaterial;
    expectColour(m.color, times(VOID_LOOK.dust.colour, VOID_LOOK.dust.dim));
    expect(VOID_LOOK.dust.colour).toBe(palette.goldLight);
    expect(m.blending).toBe(THREE.AdditiveBlending);
    expect(m.transparent).toBe(true);
    expect(m.depthWrite).toBe(false);
    expect(m.depthTest).toBe(true);
    expect(m.fog).toBe(false);
    expect(m.map).toBeInstanceOf(THREE.DataTexture);
    // The drift moves every point, so it is never culled by a box taken before it moved.
    expect(points.frustumCulled).toBe(false);
    v.dispose();
  });

  it("scatters through the void's own box, under the ceiling, and never on the camera's way down and out", () => {
    const v = buildVoid('high');
    const { at, drawn } = dust(v);
    const { box, avoid } = VOID_LOOK.dust;
    const [a0, b0] = avoid.path[0]!.map((p) => new THREE.Vector3(...p)) as [THREE.Vector3, THREE.Vector3];
    const [a1, b1] = avoid.path[1]!.map((p) => new THREE.Vector3(...p)) as [THREE.Vector3, THREE.Vector3];
    expect(avoid.radius).toBe(2.2);
    for (const t of [0, 11, 23, 37, 45, 60, 71, 89.5]) {
      v.setTime(t);
      for (let i = 0; i < drawn; i++) {
        const p = at(i);
        expect(p.y).toBeLessThan(VOID_LOOK.ceiling.y);
        // The drift is taken off the box's edges, so a point is in the box at every moment.
        expect(p.x).toBeGreaterThanOrEqual(box.x[0] - 1e-4);
        expect(p.x).toBeLessThanOrEqual(box.x[1] + 1e-4);
        expect(p.y).toBeGreaterThanOrEqual(box.y[0] - 1e-4);
        expect(p.y).toBeLessThanOrEqual(box.y[1] + 1e-4);
        expect(p.z).toBeGreaterThanOrEqual(box.z[0] - 1e-4);
        expect(p.z).toBeLessThanOrEqual(box.z[1] + 1e-4);
        expect(distanceToSegment(p, a0, b0)).toBeGreaterThanOrEqual(avoid.radius - 1e-6);
        expect(distanceToSegment(p, a1, b1)).toBeGreaterThanOrEqual(avoid.radius - 1e-6);
      }
    }
    v.dispose();
  });

  it('drifts slowly, from the time alone: the same picture a period on, never more than a centimetre a frame', () => {
    const v = buildVoid('medium');
    const cloud = () => Array.from({ length: dust(v).drawn }, (_, i) => dust(v).at(i));
    const random = vi.spyOn(Math, 'random');
    v.setTime(31);
    const first = cloud();
    v.setTime(31 + VOID_LOOK.dust.drift.period / 3);
    const between = cloud();
    v.setTime(31 + VOID_LOOK.dust.drift.period);
    const later = cloud();
    expect(random).not.toHaveBeenCalled();
    random.mockRestore();
    later.forEach((p, i) => expect(p.distanceTo(first[i]!)).toBeLessThan(1e-4));
    expect(between.some((p, i) => p.distanceTo(first[i]!) > 0.05)).toBe(true);
    v.setTime(31 + 1 / 60);
    cloud().forEach((p, i) => expect(p.distanceTo(first[i]!)).toBeLessThan(0.01));
    // NaN reads as 0.
    v.setTime(0);
    const zero = cloud().map((p) => p.toArray());
    v.setTime(Number.NaN);
    expect(cloud().map((p) => p.toArray())).toEqual(zero);
    v.dispose();
  });
});

describe('the beam', () => {
  it("is a cone of light from the opening: open, widening from the hole's radius at the ceiling down into the void", () => {
    const v = buildVoid('high');
    const beam = objectNamed<THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>>(v.group, 'void:beam');
    const { parameters } = beam.geometry;
    expect(parameters.openEnded).toBe(true);
    expect(parameters.radiusTop).toBe(1.585);
    expect(parameters.radiusBottom).toBe(VOID_LOOK.beam.reach);
    expect(VOID_LOOK.beam.reach).toBeGreaterThan(parameters.radiusTop);
    expect(parameters.height).toBe(VOID_LOOK.beam.length);
    expect(beam.position.y).toBeCloseTo(-1.2, 9);
    // Its apex ring is at the opening and the rest hangs below it.
    beam.geometry.computeBoundingBox();
    expect(beam.geometry.boundingBox!.max.y).toBeCloseTo(0, 6);
    expect(beam.geometry.boundingBox!.min.y).toBeCloseTo(-VOID_LOOK.beam.length, 6);
    v.dispose();
  });

  it("is dim gold light, added to what is behind, seen from inside or out, writing no depth, out of the fog", () => {
    const v = buildVoid('high');
    const m = beamMaterial(v);
    expectColour(m.color, times(VOID_LOOK.beam.colour, VOID_LOOK.beam.dim));
    expect(VOID_LOOK.beam.colour).toBe(palette.goldLight);
    expect(m.blending).toBe(THREE.AdditiveBlending);
    expect(m.transparent).toBe(true);
    expect(m.depthWrite).toBe(false);
    expect(m.depthTest).toBe(true);
    expect(m.side).toBe(THREE.DoubleSide);
    expect(m.fog).toBe(false);
    expect(VOID_LOOK.beam.opacity).toBeGreaterThan(0);
    expect(VOID_LOOK.beam.opacity).toBeLessThanOrEqual(0.2);
    v.dispose();
  });

  it('softens its edge and fades along its length in the material\'s own shader, keeping the rest of three\'s', () => {
    const v = buildVoid('high');
    const m = beamMaterial(v);
    const shader = { uniforms: {} as Record<string, THREE.IUniform>, vertexShader: THREE.ShaderLib.basic.vertexShader, fragmentShader: THREE.ShaderLib.basic.fragmentShader };
    m.onBeforeCompile(shader as never, {} as never);
    // Both stages declare what they share, the vertex stage fills it and the fragment stage reads it.
    for (const stage of [shader.vertexShader, shader.fragmentShader]) {
      expect(stage).toContain('varying vec3 vBeamNormal;');
      expect(stage).toContain('varying vec3 vBeamView;');
      expect(stage).toContain('varying float vBeamAlong;');
    }
    expect(shader.vertexShader).toContain('vBeamNormal =');
    expect(shader.vertexShader).toContain('vBeamView =');
    expect(shader.vertexShader).toContain('vBeamAlong =');
    expect(shader.fragmentShader).toContain('diffuseColor.a *=');
    // Three's chunks are all still there, so tone mapping, colour space and the clipping planes work.
    for (const chunk of ['#include <project_vertex>', '#include <begin_vertex>']) expect(shader.vertexShader).toContain(chunk);
    for (const chunk of ['#include <color_fragment>', '#include <opaque_fragment>', '#include <tonemapping_fragment>', '#include <colorspace_fragment>']) {
      expect(shader.fragmentShader).toContain(chunk);
    }
    // The patch gets a program of its own, apart from every plain MeshBasicMaterial.
    expect(m.customProgramCacheKey()).toBe('bob-void-beam');
    v.dispose();
  });

  it('holds the base of every power in its patch to 0..1, so no fragment is ever NaN', () => {
    // An interpolated varying can stray an ulp past the ends of what the vertices hold: 1.0 - vBeamAlong a hair under 0
    // at the far end of the beam, whose pow() is NaN; the bloom's mip chain then spreads one NaN pixel over the whole
    // frame, black (a phone's overview, Task 11).
    const v = buildVoid('high');
    const m = beamMaterial(v);
    const shader = { uniforms: {} as Record<string, THREE.IUniform>, vertexShader: THREE.ShaderLib.basic.vertexShader, fragmentShader: THREE.ShaderLib.basic.fragmentShader };
    m.onBeforeCompile(shader as never, {} as never);
    const patch = shader.fragmentShader.slice(shader.fragmentShader.indexOf('diffuseColor.a *='));
    const bases = [...patch.matchAll(/pow\(\s*(clamp\()?/g)];
    expect(bases.length).toBe(2);
    for (const base of bases) expect(base[1], base[0]).toBe('clamp(');
    expect(patch).toContain('clamp( 1.0 - vBeamAlong, 0.0, 1.0 )');
    v.dispose();
  });
});

describe('the light', () => {
  it('hides the beam and the mist at setLight(0, 0): opacity 0 and not drawn', () => {
    const v = buildVoid('high');
    v.setLight(0, 0);
    expect(beamMaterial(v).opacity).toBe(0);
    expect(objectNamed(v.group, 'void:beam').visible).toBe(false);
    for (const o of sprites(v)) {
      expect(o.material.opacity).toBe(0);
      expect(o.visible).toBe(false);
    }
    // The mist keeps its place and keeps drifting while hidden, so showing it again shows the picture of that time.
    v.setTime(9);
    for (const o of sprites(v)) expect(o.material.opacity).toBe(0);
    v.dispose();
  });

  it("shows them at the look's levels at setLight(1, 1)", () => {
    const v = buildVoid('high');
    v.setLight(1, 1);
    expect(beamMaterial(v).opacity).toBe(VOID_LOOK.beam.opacity);
    expect(objectNamed(v.group, 'void:beam').visible).toBe(true);
    const [low, high] = VOID_LOOK.mist.opacity;
    for (const o of sprites(v)) {
      expect(o.visible).toBe(true);
      // The puff's own opacity at its breath: never above the look's top, never below its bottom less the breath.
      expect(o.material.opacity).toBeGreaterThan(low * (1 - VOID_LOOK.mist.breathe) - 1e-9);
      expect(o.material.opacity).toBeLessThanOrEqual(high + 1e-9);
    }
    v.dispose();
  });

  it('scales the beam and the mist with their own level, independently, held to 0..1 (NaN is 0)', () => {
    const v = buildVoid('medium');
    v.setTime(5);
    v.setLight(1, 1);
    const full = sprites(v).map((o) => o.material.opacity);
    v.setLight(0.5, 0.25);
    expect(beamMaterial(v).opacity).toBeCloseTo(VOID_LOOK.beam.opacity / 2, 9);
    sprites(v).forEach((o, i) => expect(o.material.opacity).toBeCloseTo(full[i]! / 4, 9));
    v.setLight(1, 0);
    expect(beamMaterial(v).opacity).toBe(VOID_LOOK.beam.opacity);
    for (const o of sprites(v)) expect(o.material.opacity).toBe(0);
    v.setLight(0, 1);
    expect(beamMaterial(v).opacity).toBe(0);
    sprites(v).forEach((o, i) => expect(o.material.opacity).toBeCloseTo(full[i]!, 9));
    v.setLight(7, 7);
    expect(beamMaterial(v).opacity).toBe(VOID_LOOK.beam.opacity);
    sprites(v).forEach((o, i) => expect(o.material.opacity).toBeCloseTo(full[i]!, 9));
    v.setLight(Number.NaN, -3);
    expect(beamMaterial(v).opacity).toBe(0);
    for (const o of sprites(v)) expect(o.material.opacity).toBe(0);
    v.dispose();
  });

  it('keeps the dust, the ceiling and the traces as they are, whatever the light', () => {
    const v = buildVoid('high');
    const before = dust(v).points.visible;
    v.setLight(0, 0);
    expect(dust(v).points.visible).toBe(before);
    expect(objectNamed(v.group, 'void:ceiling').visible).toBe(true);
    expect(objectNamed(v.group, 'void:traces').visible).toBe(true);
    expect(objectNamed(v.group, 'void:ring').visible).toBe(true);
    v.dispose();
  });
});

describe('under the beads', () => {
  it('writes no depth through the beads: the mist, the dust, the beam and the traces never write it', () => {
    const v = buildVoid('high');
    const writes: string[] = [];
    v.group.traverse((o) => {
      const material = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (material && material.depthWrite) writes.push(o.name);
    });
    // Only the opaque slab and its ring write depth, and both lie behind every bead, from every camera in the void.
    expect(writes.sort()).toEqual(['void:ceiling', 'void:ring']);
    v.dispose();
  });

  it('draws its haze before the default order, so the beads\' glass lies over it and the haze never over a bead\'s glass', () => {
    const v = buildVoid('high');
    expect(VOID_HAZE_ORDER).toBeLessThan(0);
    for (const name of ['void:mist', 'void:dust', 'void:beam']) expect(objectNamed(v.group, name).renderOrder, name).toBe(VOID_HAZE_ORDER);
    // The void's own group adds no order of its own.
    expect(v.group.renderOrder).toBe(0);
    v.dispose();
  });

  it('is never hit by the pointer: nothing in it takes a ray, so a bead behind the mist is still picked', () => {
    const v = buildVoid('high');
    v.setLight(1, 1);
    v.group.updateMatrixWorld(true);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, -3, 4);
    camera.updateMatrixWorld(true);
    const raycaster = new THREE.Raycaster(new THREE.Vector3(0, -3, 4), new THREE.Vector3(0, -0.2, -1).normalize());
    raycaster.camera = camera;
    expect(raycaster.intersectObject(v.group, true)).toHaveLength(0);
    // And straight up through the ceiling and down the beam.
    for (const direction of [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0)]) {
      const r = new THREE.Raycaster(new THREE.Vector3(0.3, -3, 0.2), direction);
      r.camera = camera;
      expect(r.intersectObject(v.group, true)).toHaveLength(0);
    }
    v.dispose();
  });
});

describe('the tier', () => {
  it("sheds the lower tiers' mist layers and dust as it steps down, the same void as one built for that tier", () => {
    for (const from of ['high', 'medium'] as const) {
      for (const to of ['medium', 'low'] as const) {
        if (from === to) continue;
        const v = buildVoid(from);
        v.setTier(to);
        const built = buildVoid(to);
        for (const model of [v, built]) {
          model.setLight(0.8, 0.6);
          model.setTime(23);
        }
        expect(picture(v), `${from} to ${to}`).toEqual(picture(built));
        v.dispose();
        built.dispose();
      }
    }
  });

  it('frees what it sheds, once: the layers\' materials, and the mist\'s texture when no layer is left', () => {
    const v = buildVoid('high');
    const all = sprites(v);
    const shedOnMedium = all.filter((o) => o.userData.layer === 2);
    const kept = all.filter((o) => o.userData.layer !== 2);
    const texture = all[0]!.material.map!;
    const textureSpy = vi.spyOn(texture, 'dispose');
    const shedSpies = shedOnMedium.map((o) => vi.spyOn(o.material, 'dispose'));
    const keptSpies = kept.map((o) => vi.spyOn(o.material, 'dispose'));
    v.setTier('medium');
    for (const spy of shedSpies) expect(spy).toHaveBeenCalledOnce();
    for (const o of shedOnMedium) expect(o.parent).toBeNull();
    for (const spy of keptSpies) expect(spy).not.toHaveBeenCalled();
    expect(textureSpy).not.toHaveBeenCalled();
    v.setTier('low');
    for (const spy of keptSpies) expect(spy).toHaveBeenCalledOnce();
    expect(textureSpy).toHaveBeenCalledOnce();
    expect(sprites(v)).toHaveLength(0);
    expect(dust(v).drawn).toBe(60);
    // Freeing the void frees nothing a second time.
    v.dispose();
    for (const spy of [...shedSpies, ...keptSpies, textureSpy]) expect(spy).toHaveBeenCalledOnce();
  });

  it('only steps down: a tier above the one it stands at changes nothing, and a layer once shed does not come back', () => {
    const v = buildVoid('high');
    v.setTier('high');
    expect(sprites(v)).toHaveLength(3 * VOID_LOOK.mist.puffs);
    expect(dust(v).drawn).toBe(400);
    v.setTier('medium');
    expect(sprites(v)).toHaveLength(2 * VOID_LOOK.mist.puffs);
    expect(dust(v).drawn).toBe(200);
    v.setTier('high');
    expect(sprites(v)).toHaveLength(2 * VOID_LOOK.mist.puffs);
    expect(dust(v).drawn).toBe(200);
    v.setTier('low');
    v.setTier('medium');
    v.setTier('high');
    expect(sprites(v)).toHaveLength(0);
    expect(dust(v).drawn).toBe(60);
    v.dispose();

    const medium = buildVoid('medium');
    medium.setTier('high');
    expect(sprites(medium)).toHaveLength(2 * VOID_LOOK.mist.puffs);
    expect(dust(medium).drawn).toBe(200);
    medium.dispose();
  });

  it('keeps the ceiling, the traces, the ring and the beam whatever the tier', () => {
    const v = buildVoid('high');
    const before = ['void:ceiling', 'void:traces', 'void:ring', 'void:beam'].map((name) => objectNamed(v.group, name));
    v.setTier('low');
    for (const part of before) expect(part.parent).toBe(v.group);
    v.dispose();
  });
});

describe('freeing', () => {
  /** Every geometry, material and texture the drawn objects under `root` hold, once each; the sprites' shared quad is three's, not ours. */
  function resources(root: THREE.Object3D): Set<{ dispose(): void }> {
    const parts = new Set<{ dispose(): void }>();
    root.traverse((o) => {
      const drawn = o as THREE.Mesh;
      if (drawn.geometry && !(o as THREE.Sprite).isSprite) parts.add(drawn.geometry);
      for (const material of [drawn.material].flat() as (THREE.Material & { map?: THREE.Texture | null })[]) {
        if (!material) continue;
        parts.add(material);
        if (material.map) parts.add(material.map);
      }
    });
    return parts;
  }

  it('frees every geometry, material and texture it made, and not the sprites\' shared quad', () => {
    const v = buildVoid('high');
    const parts = resources(v.group);
    // Ceiling (2), traces (2), ring (2), nine sprite materials and their texture (10), dust (geometry, material, texture: 3), beam (2).
    expect(parts.size).toBe(2 + 2 + 2 + 10 + 3 + 2);
    const spies = [...parts].map((part) => vi.spyOn(part, 'dispose'));
    const shared = vi.spyOn(sprites(v)[0]!.geometry, 'dispose');
    v.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalled();
    expect(shared).not.toHaveBeenCalled();
  });

  it('has no mist texture to make or free on the low tier', () => {
    const v = buildVoid('low');
    const parts = resources(v.group);
    expect(parts.size).toBe(2 + 2 + 2 + 3 + 2);
    const spies = [...parts].map((part) => vi.spyOn(part, 'dispose'));
    v.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalled();
  });
});

describe("the builders' colours", () => {
  it('are named in no builder: no hex colour and no colour made from bare numbers', () => {
    const source = readFileSync(fileURLToPath(new URL('../../../src/engine/bob/build/void.ts', import.meta.url)), 'utf8');
    expect(source).not.toMatch(/\b0x[0-9a-f]{6}\b/i);
    expect(source).not.toMatch(/Color\(\s*[\d.]+\s*,/);
  });
});
