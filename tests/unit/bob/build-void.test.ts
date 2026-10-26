import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { GLASS_LOOK } from '~/engine/bob/build/glassFloor';
import { TRACES_LOOK, TRACES_RENDER_ORDER } from '~/engine/bob/build/traces';
import { buildVoid, CLEAR, VOID_HAZE_ORDER, VOID_LOOK, type VoidModel } from '~/engine/bob/build/void';
import { applyCameraShot } from '~/engine/bob/shots';
import { TRACE, traceLayout } from '~/engine/bob/traces';
import { WORDMARK } from '~/engine/bob/wordmark';
import { palette } from '~/engine/palette';
import type { QualityTier } from '~/engine/quality';
import { beadRest, F, lightAt, RING, ringShot, streamAt, wayShot } from '~/scene/bob/lightDive';

const TIERS: readonly QualityTier[] = ['high', 'medium', 'low'];
const DESK = 1440 / 900;
const PHONE = 390 / 844;

/** The object called `name` under `root`, which must exist. */
function objectNamed<T extends THREE.Object3D>(root: THREE.Object3D, name: string): T {
  const found = root.getObjectByName(name);
  expect(found, name).toBeDefined();
  return found as T;
}

/** The sprites under the part called `name`, in the order its group holds them. */
function spritesOf(v: VoidModel, name: string): THREE.Sprite[] {
  return objectNamed(v.group, name).children.filter((o): o is THREE.Sprite => (o as THREE.Sprite).isSprite);
}
const band = (v: VoidModel) => spritesOf(v, 'void:band');
const ringMist = (v: VoidModel) => spritesOf(v, 'void:ringMist');

/** The dust: its group, the points, how many of them are drawn, and each one's place in the dust's own frame. */
function dust(v: VoidModel): { group: THREE.Object3D; points: THREE.Points; drawn: number; at: (i: number) => THREE.Vector3 } {
  const group = objectNamed(v.group, 'void:dust');
  const points = objectNamed<THREE.Points>(v.group, 'void:dust:points');
  const position = points.geometry.getAttribute('position');
  const drawn = points.geometry.drawRange.count;
  return { group, points, drawn, at: (i) => new THREE.Vector3().fromBufferAttribute(position, i) };
}

/** A camera on `shot` for a screen of `aspect`. */
function cameraOn(shot: Parameters<typeof applyCameraShot>[1], aspect: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 400);
  applyCameraShot(camera, shot, aspect);
  camera.updateMatrixWorld(true);
  return camera;
}

/** Where `p` (world) falls on the frame through `camera`: x, y from the top left in shares of the width and height. */
function onFrame(p: THREE.Vector3, camera: THREE.Camera): { x: number; y: number } {
  const v = p.clone().project(camera);
  return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
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

/** Everything drawn that two models should agree on if they are the same void: the haze and the dust, as numbers. */
function picture(v: VoidModel): number[] {
  const { at, drawn } = dust(v);
  return [
    ...[...band(v), ...ringMist(v)].flatMap((o) => [...o.position.toArray(), o.material.opacity, o.scale.x, o.scale.y]),
    drawn,
    ...Array.from({ length: drawn }, (_, i) => at(i).toArray()).flat()
  ];
}

describe('the void', () => {
  it('holds the named parts, on every tier', () => {
    for (const tier of TIERS) {
      const v = buildVoid(tier);
      expect(v.group.isGroup).toBe(true);
      expect(v.group.name).toBe('void');
      expect(v.group.children.map((o) => o.name)).toEqual(['void:backdrop', 'void:ceiling', 'void:traces', 'void:ring', 'void:band', 'void:ringMist', 'void:dust']);
      v.dispose();
    }
  });

  it('is the preview: the ceiling at 1.2 under the glass from the 1.585 hole out to 60, the traces at 0.35, 400 / 200 / 60 dust points, a ring of mist 20 m round', () => {
    expect(VOID_LOOK.ceiling.y).toBe(-1.2);
    expect(VOID_LOOK.ceiling.inner).toBe(1.585);
    expect(VOID_LOOK.ceiling.outer).toBe(60);
    expect(VOID_LOOK.traces.level).toBe(0.35);
    expect(VOID_LOOK.dust.count).toEqual({ high: 400, medium: 200, low: 60 });
    expect(VOID_LOOK.ringMist.radius).toBe(20);
    // Enough puffs, wide enough, that the band runs unbroken round the ring even in a phone's narrow view (the mock-up's).
    expect(VOID_LOOK.ringMist.count).toEqual({ high: 24, medium: 16, low: 0 });
    expect(CLEAR).toEqual({ cam: 1.7, light: 0.9, bead: 1.3 });
    // The glass's own numbers, so the ceiling and the glass stay one slab: the tunnel's foot and the hole and the floor's reach.
    expect(VOID_LOOK.ceiling.y).toBe(GLASS_LOOK.well.bottom);
    expect(VOID_LOOK.ceiling.inner).toBe(WORDMARK.hole);
    expect(VOID_LOOK.ceiling.outer).toBe(GLASS_LOOK.floor.outer);
  });

  it('has no beam and no setLight: the light dive has no beam', () => {
    const v = buildVoid('high');
    expect(v.group.getObjectByName('void:beam')).toBeUndefined();
    expect((v as unknown as { setLight?: unknown }).setLight).toBeUndefined();
    v.dispose();
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

describe('the mist band', () => {
  const chase = (aspect: number) => cameraOn(wayShot(121, aspect), aspect);

  it('is the haze in one layer, dimmed and added to what is behind, on every tier, hidden until it is shown', () => {
    for (const tier of TIERS) {
      const v = buildVoid(tier);
      expect(band(v)).toHaveLength(VOID_LOOK.band.puffs);
      for (const o of band(v)) {
        const m = o.material;
        expectColour(m.color, times(VOID_LOOK.band.colour, VOID_LOOK.band.dim));
        expect(m.blending).toBe(THREE.AdditiveBlending);
        expect(m.depthWrite).toBe(false);
        expect(m.depthTest).toBe(true);
        expect(m.fog).toBe(false);
        expect(o.visible).toBe(false);
      }
      v.dispose();
    }
    expect(VOID_LOOK.band.colour).toBe(palette.haze);
  });

  it('follows the camera: its middle at y of the frame, across it, `distance` ahead, on a desk and on a phone', () => {
    for (const aspect of [DESK, PHONE]) {
      const v = buildVoid('high');
      const camera = chase(aspect);
      v.setBand({ shown: true, y: 0.3, sigma: 0.075, strength: 1, distance: 12 }, camera);
      v.group.updateMatrixWorld(true);
      const group = objectNamed(v.group, 'void:band');
      const middle = group.getWorldPosition(new THREE.Vector3());
      const at = onFrame(middle, camera);
      expect(at.x).toBeCloseTo(0.5, 9);
      expect(at.y).toBeCloseTo(0.3, 9);
      const ahead = middle.clone().sub(camera.position).dot(camera.getWorldDirection(new THREE.Vector3()));
      expect(ahead).toBeCloseTo(12, 9);
      // As wide as the frame there, and its sigma a share of the frame's height there.
      const halfHeight = 12 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      expect(group.scale.x).toBeCloseTo(halfHeight * aspect, 9);
      expect(group.scale.y).toBeCloseTo(0.075 * 2 * halfHeight, 9);
      v.dispose();
    }
  });

  it('shows at its strength, less what has dissolved into the ring of mist, and not at all unless shown', () => {
    const v = buildVoid('high');
    const camera = chase(DESK);
    v.setTime(5);
    v.setBand({ shown: true, y: 0.3, sigma: 0.075, strength: 1, distance: 12 }, camera);
    const full = band(v).map((o) => o.material.opacity);
    for (const o of band(v)) expect(o.visible).toBe(true);
    v.setBand({ shown: true, y: 0.3, sigma: 0.075, strength: 0.5, distance: 12 }, camera);
    band(v).forEach((o, i) => expect(o.material.opacity).toBeCloseTo(full[i]! / 2, 9));
    v.setRingMist(0.5);
    band(v).forEach((o, i) => expect(o.material.opacity).toBeCloseTo(full[i]! / 4, 9));
    v.setRingMist(1);
    for (const o of band(v)) expect(o.visible).toBe(false);
    v.setRingMist(0);
    v.setBand({ shown: false, y: 0.3, sigma: 0.075, strength: 1, distance: 12 }, camera);
    for (const o of band(v)) expect(o.visible).toBe(false);
    v.dispose();
  });
});

describe('the ring of mist', () => {
  it("goes all the way round the ring at every tier that has it: no gap between two puffs wider than 45 degrees", () => {
    // A phone starts on the medium tier: its puffs, the first of the seeded set, must ring the axis too, or the band
    // goes missing for a third of the turn.
    for (const tier of ['high', 'medium'] as const) {
      const v = buildVoid(tier);
      const angles = ringMist(v)
        .map((sprite) => (((Math.atan2(sprite.position.x, sprite.position.z) * 180) / Math.PI) + 360) % 360)
        .sort((a, b) => a - b);
      expect(angles.length, tier).toBe(VOID_LOOK.ringMist.count[tier]);
      const gaps = angles.map((a, i) => (i === 0 ? a + 360 - angles.at(-1)! : a - angles[i - 1]!));
      expect(Math.max(...gaps), tier).toBeLessThanOrEqual(45);
      v.dispose();
    }
  });

  it('is world-fixed haze on a cylinder 20 m round the ring\'s axis, hidden until the band dissolves into it', () => {
    const v = buildVoid('high');
    expect(ringMist(v)).toHaveLength(VOID_LOOK.ringMist.count.high);
    for (const o of ringMist(v)) {
      expect(Math.hypot(o.position.x, o.position.z)).toBeCloseTo(VOID_LOOK.ringMist.radius, 6);
      expect(o.visible).toBe(false);
      expect(o.material.blending).toBe(THREE.AdditiveBlending);
      expect(o.material.depthWrite).toBe(false);
    }
    v.dispose();
  });

  it('makes up for the puffs a lower tier has not: each as much brighter as there are fewer, so the band is as strong', () => {
    const camera = cameraOn(ringShot(60, DESK), DESK);
    const opacities = (tier: 'high' | 'medium') => {
      const v = buildVoid(tier);
      v.setBand({ shown: true, y: 0.36, sigma: 0.075, strength: 1, distance: 26 }, camera);
      v.setRingMist(1);
      const all = ringMist(v).map((o) => o.material.opacity);
      v.dispose();
      return all;
    };
    const high = opacities('high');
    const medium = opacities('medium');
    const fill = VOID_LOOK.ringMist.count.high / VOID_LOOK.ringMist.count.medium;
    medium.forEach((o, i) => expect(o, `puff ${i}`).toBeCloseTo(Math.min(1, high[i]! * fill), 12));
  });

  it("lies at the band's height: the cylinder's point ahead of a ring camera stands on the band's middle", () => {
    for (const aspect of [DESK, PHONE]) {
      const v = buildVoid('high');
      const camera = cameraOn(ringShot(60, aspect), aspect);
      v.setBand({ shown: true, y: 0.36, sigma: 0.075, strength: 1, distance: 26 }, camera);
      v.group.updateMatrixWorld(true);
      const ring = objectNamed(v.group, 'void:ringMist');
      const forward = camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize();
      // From the camera along its forward on the ground, to the cylinder.
      const c = camera.position;
      const b = c.x * forward.x + c.z * forward.z;
      const t = -b + Math.sqrt(b * b - (c.x * c.x + c.z * c.z - VOID_LOOK.ringMist.radius ** 2));
      const ahead = new THREE.Vector3(c.x + forward.x * t, ring.position.y, c.z + forward.z * t);
      expect(onFrame(ahead, camera).y).toBeCloseTo(0.36, 6);
      v.dispose();
    }
  });

  it('dissolves in as the band dissolves out, at the band\'s strength', () => {
    const v = buildVoid('high');
    const camera = cameraOn(ringShot(0, DESK), DESK);
    v.setBand({ shown: true, y: 0.36, sigma: 0.075, strength: 1, distance: 26 }, camera);
    v.setRingMist(1);
    const full = ringMist(v).map((o) => o.material.opacity);
    for (const o of ringMist(v)) expect(o.visible).toBe(true);
    v.setRingMist(0.5);
    ringMist(v).forEach((o, i) => expect(o.material.opacity).toBeCloseTo(full[i]! / 2, 9));
    v.setRingMist(Number.NaN);
    for (const o of ringMist(v)) expect(o.visible).toBe(false);
    v.dispose();
  });
});

describe('the stream', () => {
  it('moves the dust toward the camera, and not the ring of mist nor the band', () => {
    const v = buildVoid('high');
    const camera = cameraOn(ringShot(0, DESK), DESK);
    v.setBand({ shown: true, y: 0.36, sigma: 0.075, strength: 1, distance: 26 }, camera);
    const ringAt = objectNamed(v.group, 'void:ringMist').position.toArray();
    const bandAt = objectNamed(v.group, 'void:band').position.toArray();
    const rest = dust(v).at(0).toArray();
    v.setStream(2);
    expect(dust(v).group.position.toArray()).toEqual([0, 0, 2]);
    expect(dust(v).at(0).toArray()).toEqual(rest); // the points keep their places in the dust's own frame
    expect(objectNamed(v.group, 'void:ringMist').position.toArray()).toEqual(ringAt);
    expect(objectNamed(v.group, 'void:band').position.toArray()).toEqual(bandAt);
    v.setStream(Number.NaN);
    expect(dust(v).group.position.z).toBe(0);
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

  it('is gold points added to what is behind, writing no depth and out of the fog, dark until its glow comes in', () => {
    const v = buildVoid('high');
    const { points } = dust(v);
    const m = points.material as THREE.PointsMaterial;
    expectColour(m.color, times(VOID_LOOK.dust.colour, VOID_LOOK.dust.dim));
    expect(VOID_LOOK.dust.colour).toBe(palette.goldLight);
    expect(m.blending).toBe(THREE.AdditiveBlending);
    expect(m.depthWrite).toBe(false);
    expect(m.depthTest).toBe(true);
    expect(m.fog).toBe(false);
    expect(m.map).toBeInstanceOf(THREE.DataTexture);
    expect(points.frustumCulled).toBe(false);
    expect(points.visible).toBe(false);
    v.setDust(1);
    expect([points.visible, m.opacity]).toEqual([true, VOID_LOOK.dust.opacity]);
    v.setDust(0.5);
    expect(m.opacity).toBeCloseTo(VOID_LOOK.dust.opacity / 2, 12);
    v.setDust(Number.NaN);
    expect(points.visible).toBe(false);
    v.dispose();
  });

  it("keeps clear, in its own moving frame, of the camera's path on both sizes, the light's, the ring camera's orbit and the beads' rise", () => {
    const shift = (p: readonly number[], f: number) => new THREE.Vector3(p[0], p[1], p[2]! - streamAt(f));
    const cam: THREE.Vector3[] = [];
    const light: THREE.Vector3[] = [];
    for (const aspect of [DESK, PHONE]) {
      for (let f = 1; f <= F.END; f++) {
        cam.push(shift(wayShot(f, aspect).position, f));
        light.push(shift(lightAt(f, aspect).position, f));
      }
      for (let angle = 0; angle < 360; angle += 3) cam.push(shift(ringShot(angle, aspect).position, F.END));
    }
    const beads: THREE.Vector3[] = [];
    for (const angle of [0, 120, 240]) for (let k = 0; k <= 12; k++) beads.push(shift(beadRest(angle), F.END).sub(new THREE.Vector3(0, (RING.rise * k) / 12, 0)));
    const nearest = (p: THREE.Vector3, path: THREE.Vector3[]) => Math.min(...path.map((q) => p.distanceTo(q)));
    const v = buildVoid('high');
    for (const t of [0, 23, 45, 71]) {
      v.setTime(t);
      const { at, drawn } = dust(v);
      for (let i = 0; i < drawn; i++) {
        const p = at(i);
        expect(nearest(p, cam), `point ${i} at ${t} s from the camera`).toBeGreaterThanOrEqual(CLEAR.cam);
        expect(nearest(p, light), `point ${i} at ${t} s from the light`).toBeGreaterThanOrEqual(CLEAR.light);
        expect(nearest(p, beads), `point ${i} at ${t} s from a bead`).toBeGreaterThanOrEqual(CLEAR.bead);
        expect(p.y).toBeLessThan(VOID_LOOK.ceiling.y);
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
    v.setTime(0);
    const zero = cloud().map((p) => p.toArray());
    v.setTime(Number.NaN);
    expect(cloud().map((p) => p.toArray())).toEqual(zero);
    v.dispose();
  });
});

describe('under the beads', () => {
  it('writes no depth through the beads: the haze, the dust and the traces never write it', () => {
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

  it("draws its haze before the default order, so the beads' glass lies over it and the haze never over a bead's glass", () => {
    const v = buildVoid('high');
    expect(VOID_HAZE_ORDER).toBeLessThan(0);
    for (const name of ['void:band', 'void:ringMist', 'void:dust:points']) expect(objectNamed(v.group, name).renderOrder, name).toBe(VOID_HAZE_ORDER);
    expect(v.group.renderOrder).toBe(0);
    v.dispose();
  });

  it('is never hit by the pointer: nothing in it takes a ray, so a bead behind the mist is still picked', () => {
    const v = buildVoid('high');
    const camera = cameraOn(ringShot(0, DESK), DESK);
    v.setBand({ shown: true, y: 0.36, sigma: 0.075, strength: 1, distance: 26 }, camera);
    v.setRingMist(1);
    v.setDust(1);
    v.group.updateMatrixWorld(true);
    const raycaster = new THREE.Raycaster();
    raycaster.camera = camera;
    for (const [x, y] of [[0, 0], [0, 0.3], [0.5, -0.2], [-0.7, 0.1]] as const) {
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
      expect(raycaster.intersectObject(v.group, true)).toHaveLength(0);
    }
    v.dispose();
  });
});

describe('the tier', () => {
  /** The void at one frame's light dive pose, the same for every model. */
  const pose = (v: VoidModel) => {
    v.setBand({ shown: true, y: 0.36, sigma: 0.075, strength: 0.8, distance: 26 }, cameraOn(ringShot(0, DESK), DESK));
    v.setRingMist(0.6);
    v.setDust(0.7);
    v.setTime(23);
  };

  it("sheds the lower tiers' ring of mist and dust as it steps down, the same void as one built for that tier", () => {
    for (const from of ['high', 'medium'] as const) {
      for (const to of ['medium', 'low'] as const) {
        if (from === to) continue;
        const v = buildVoid(from);
        v.setTier(to);
        const built = buildVoid(to);
        for (const model of [v, built]) pose(model);
        expect(picture(v), `${from} to ${to}`).toEqual(picture(built));
        v.dispose();
        built.dispose();
      }
    }
  });

  it("frees what it sheds, once: the ring's sprites' materials, and its texture when none is left", () => {
    const v = buildVoid('high');
    const all = ringMist(v);
    const texture = all[0]!.material.map!;
    const textureSpy = vi.spyOn(texture, 'dispose');
    const spies = all.map((o) => vi.spyOn(o.material, 'dispose'));
    v.setTier('medium');
    spies.forEach((spy, i) => expect(spy, `sprite ${i}`).toHaveBeenCalledTimes(i < VOID_LOOK.ringMist.count.medium ? 0 : 1));
    expect(textureSpy).not.toHaveBeenCalled();
    v.setTier('low');
    for (const spy of spies) expect(spy).toHaveBeenCalledOnce();
    expect(textureSpy).toHaveBeenCalledOnce();
    expect(ringMist(v)).toHaveLength(0);
    expect(dust(v).drawn).toBe(60);
    v.dispose();
    for (const spy of [...spies, textureSpy]) expect(spy).toHaveBeenCalledOnce();
  });

  it('only steps down: a tier above the one it stands at changes nothing', () => {
    const v = buildVoid('high');
    v.setTier('medium');
    expect(ringMist(v)).toHaveLength(VOID_LOOK.ringMist.count.medium);
    expect(dust(v).drawn).toBe(200);
    v.setTier('high');
    expect(ringMist(v)).toHaveLength(VOID_LOOK.ringMist.count.medium);
    expect(dust(v).drawn).toBe(200);
    v.dispose();
  });

  it('keeps the ceiling, the traces, the ring and the band whatever the tier', () => {
    const v = buildVoid('high');
    const before = ['void:ceiling', 'void:traces', 'void:ring', 'void:band'].map((name) => objectNamed(v.group, name));
    v.setTier('low');
    for (const part of before) expect(part.parent).toBe(v.group);
    expect(band(v)).toHaveLength(VOID_LOOK.band.puffs);
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

  it("frees every geometry, material and texture it made, and not the sprites' shared quad", () => {
    const v = buildVoid('high');
    const parts = resources(v.group);
    // Backdrop (2), ceiling (2), traces (2), ring (2), the band's sprites and their texture, the ring of mist's and theirs, dust (3).
    expect(parts.size).toBe(2 + 2 + 2 + 2 + (VOID_LOOK.band.puffs + 1) + (VOID_LOOK.ringMist.count.high + 1) + 3);
    const spies = [...parts].map((part) => vi.spyOn(part, 'dispose'));
    const shared = vi.spyOn(band(v)[0]!.geometry, 'dispose');
    v.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalled();
    expect(shared).not.toHaveBeenCalled();
  });
});

describe("the builders' colours", () => {
  it('are named in no builder: no hex colour and no colour made from bare numbers', () => {
    const source = readFileSync(fileURLToPath(new URL('../../../src/engine/bob/build/void.ts', import.meta.url)), 'utf8');
    expect(source).not.toMatch(/\b0x[0-9a-f]{6}\b/i);
    expect(source).not.toMatch(/Color\(\s*[\d.]+\s*,/);
  });
});

describe('the glass sky', () => {
  it('takes the ceiling, its traces and its ring out while the camera is above them, and back once it is under', () => {
    const v = buildVoid('high');
    const sky = ['void:ceiling', 'void:traces', 'void:ring'].map((name) => objectNamed(v.group, name));
    v.setSky(false);
    for (const part of sky) expect(part.visible, part.name).toBe(false);
    expect(objectNamed(v.group, 'void:band').visible).toBe(true); // the haze and the dust are not the sky's
    expect(objectNamed(v.group, 'void:dust').visible).toBe(true);
    v.setSky(true);
    for (const part of sky) expect(part.visible, part.name).toBe(true);
    v.dispose();
  });
});

describe('the backdrop', () => {
  it("is the site's night round everything, seen from inside, behind it all, coming in with the band", () => {
    const v = buildVoid('high');
    const backdrop = objectNamed<THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>>(v.group, 'void:backdrop');
    expect(VOID_LOOK.backdrop.colour).toBe(palette.night);
    expectColour(backdrop.material.color, new THREE.Color(palette.night));
    expect(backdrop.material.side).toBe(THREE.BackSide);
    expect(backdrop.material.depthWrite).toBe(false);
    expect(backdrop.renderOrder).toBeLessThan(VOID_HAZE_ORDER);
    expect(backdrop.visible).toBe(false);
    v.setBand({ shown: true, y: 0.3, sigma: 0.075, strength: 0.6, distance: 12 }, cameraOn(wayShot(121, DESK), DESK));
    expect([backdrop.visible, backdrop.material.opacity]).toEqual([true, 0.6]);
    v.setRingMist(1); // the backdrop stays as the band's wisps go into the ring of mist
    expect(backdrop.material.opacity).toBe(0.6);
    v.dispose();
  });
});
