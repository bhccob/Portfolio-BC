import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DIAL, onDial } from '../../src/scripts/three/instrument/dialSpec';
import { WIRE, coilPath, lyingPath, straightPath, wirePath, type Point } from '../../src/scripts/three/instrument/wirePath';
import { buildWire } from '../../src/scripts/three/instrument/Wire';

const ANCHOR: Point = [0.6, 0.06, 0.55];
const AXIS: Point = [0.6, 0, 0.8];

const dot = (a: Point, b: Point): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a: Point): number => Math.hypot(a[0], a[1], a[2]);
const unit = (a: Point): Point => [a[0] / norm(a), a[1] / norm(a), a[2] / norm(a)];

/** The largest distance any point of `a` is from the same-index point of `b`. */
function farthest(a: readonly Point[], b: readonly Point[]): number {
  return Math.max(...a.map((p, i) => norm(sub(p, b[i]))));
}

describe('the wire paths', () => {
  const paths: Record<string, Point[]> = {
    lying: lyingPath(),
    straight: straightPath(),
    coil: coilPath(ANCHOR, AXIS),
    mid: wirePath(0.5, 0.5, ANCHOR, AXIS)
  };

  it('has WIRE.points finite points on every path', () => {
    expect(WIRE.points).toBe(96);
    for (const path of Object.values(paths)) {
      expect(path).toHaveLength(WIRE.points);
      for (const p of path) {
        expect(p).toHaveLength(3);
        p.forEach((v) => expect(Number.isFinite(v)).toBe(true));
      }
    }
  });

  it('lays the cable on the Rotterdam ring, on the face', () => {
    const lying = paths.lying;
    for (const [x, y, z] of lying) {
      const r = Math.hypot(x, z);
      expect(r).toBeGreaterThanOrEqual(DIAL.rings.pattern[0]);
      expect(r).toBeLessThanOrEqual(DIAL.rings.pattern[1]);
      expect(y).toBeCloseTo(0.002, 9);
    }
    const [fx, fz] = onDial(WIRE.lying.from[0], WIRE.lying.from[1]);
    const [tx, tz] = onDial(WIRE.lying.to[0], WIRE.lying.to[1]);
    expect(lying[0][0]).toBeCloseTo(fx, 9); expect(lying[0][2]).toBeCloseTo(fz, 9);
    expect(lying[95][0]).toBeCloseTo(tx, 9); expect(lying[95][2]).toBeCloseTo(tz, 9);
    // A straight chord: every point sits on the line between the ends.
    const dir = unit(sub(lying[95], lying[0]));
    for (const p of lying) {
      const off = sub(p, lying[0]);
      const along = dot(off, dir);
      expect(norm(sub(off, [dir[0] * along, dir[1] * along, dir[2] * along]))).toBeLessThan(1e-9);
    }
  });

  it('pulls Ørsted\'s wire from the north rim to the south rim above the needle', () => {
    const straight = paths.straight;
    expect(straight[0]).toEqual([0, WIRE.height, -DIAL.rim]);
    expect(straight[95][0]).toBeCloseTo(0, 12); expect(straight[95][1]).toBeCloseTo(0.11, 12); expect(straight[95][2]).toBeCloseTo(DIAL.rim, 12);
    for (const [x, y] of straight) {
      expect(x).toBe(0);
      expect(y).toBeCloseTo(0.11, 12);
    }
    const zs = straight.map((p) => p[2]);
    expect(zs.every((z, i) => i === 0 || z > zs[i - 1])).toBe(true);
  });

  it('winds the coil round the axis, WIRE.coil.radius out, centred on the anchor', () => {
    const axis = unit(AXIS);
    const coil = paths.coil;
    const alongs: number[] = [];
    const angles: number[] = [];
    let u: Point | null = null;
    let v: Point = [0, 0, 0];
    for (const p of coil) {
      const off = sub(p, ANCHOR);
      const along = dot(off, axis);
      alongs.push(along);
      const radial = sub(off, [axis[0] * along, axis[1] * along, axis[2] * along]);
      expect(norm(radial)).toBeCloseTo(WIRE.coil.radius, 9);
      if (!u) {
        u = unit(radial);
        v = [axis[1] * u[2] - axis[2] * u[1], axis[2] * u[0] - axis[0] * u[2], axis[0] * u[1] - axis[1] * u[0]];
      }
      angles.push(Math.atan2(dot(radial, v), dot(radial, u)));
    }
    expect(Math.min(...alongs)).toBeCloseTo(-WIRE.coil.length / 2, 9);
    expect(Math.max(...alongs)).toBeCloseTo(WIRE.coil.length / 2, 9);
    expect(alongs.every((a, i) => i === 0 || a > alongs[i - 1])).toBe(true);
    // Unwrap the angle: it runs WIRE.coil.turns full turns, all one way.
    let total = 0;
    for (let i = 1; i < angles.length; i++) {
      let d = angles[i] - angles[i - 1];
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      total += d;
    }
    expect(Math.abs(total)).toBeCloseTo(WIRE.coil.turns * 2 * Math.PI, 6);
  });

  it('winds a coil for any axis: a zero one falls back to +X, a long one counts as a unit, one along the dial\'s normal still works', () => {
    expect(coilPath(ANCHOR, [0, 0, 0])).toEqual(coilPath(ANCHOR, [1, 0, 0]));
    expect(coilPath(ANCHOR, [0, 0, 5])).toEqual(coilPath(ANCHOR, [0, 0, 1]));
    expect(coilPath(ANCHOR, [Number.NaN, 0, 0])).toEqual(coilPath(ANCHOR, [1, 0, 0]));
    for (const axis of [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0]] as Point[]) {
      for (const p of coilPath(ANCHOR, axis)) {
        const off = sub(p, ANCHOR);
        const along = dot(off, axis);
        expect(norm(sub(off, [axis[0] * along, axis[1] * along, axis[2] * along]))).toBeCloseTo(WIRE.coil.radius, 9);
      }
    }
  });

  it('is the lying path at (0, 0), the straight one at (1, 0) and the coil at (1, 1)', () => {
    expect(wirePath(0, 0, ANCHOR, AXIS)).toEqual(lyingPath());
    expect(wirePath(1, 0, ANCHOR, AXIS)).toEqual(straightPath());
    expect(wirePath(1, 1, ANCHOR, AXIS)).toEqual(coilPath(ANCHOR, AXIS));
  });

  it('clamps lift and wind to [0, 1] and reads NaN as 0', () => {
    expect(wirePath(-3, -1, ANCHOR, AXIS)).toEqual(wirePath(0, 0, ANCHOR, AXIS));
    expect(wirePath(7, 9, ANCHOR, AXIS)).toEqual(wirePath(1, 1, ANCHOR, AXIS));
    expect(wirePath(Number.NaN, Number.NaN, ANCHOR, AXIS)).toEqual(wirePath(0, 0, ANCHOR, AXIS));
    expect(wirePath(0.4, Number.NaN, ANCHOR, AXIS)).toEqual(wirePath(0.4, 0, ANCHOR, AXIS));
  });

  it('arcs up as it pulls: never below the straight blend of cable and wire, more mid-lift than near either end', () => {
    const half = wirePath(0.5, 0, ANCHOR, AXIS);
    const flat = lyingPath();
    const straight = straightPath();
    for (let i = 0; i < WIRE.points; i++) {
      const linear = (flat[i][1] + straight[i][1]) / 2;
      expect(half[i][1]).toBeGreaterThanOrEqual(linear - 1e-12);
    }
    // The belly is clearly above the straight line between where the cable lies and where it ends up.
    const belly = Math.max(...half.map((p, i) => p[1] - (flat[i][1] + straight[i][1]) / 2));
    expect(belly).toBeGreaterThan(0.1);
    const lifted = (lift: number): number => Math.max(...wirePath(lift, 0, ANCHOR, AXIS).map((p, i) => p[1] - (flat[i][1] * (1 - lift) + straight[i][1] * lift)));
    expect(lifted(0.5)).toBeGreaterThan(lifted(0.1));
    expect(lifted(0.5)).toBeGreaterThan(lifted(0.9));
  });

  it('is continuous: no point moves 0.05 between lift values 0.01 apart, nor between wind values', () => {
    for (let k = 0; k < 100; k++) {
      const a = wirePath(k / 100, 0, ANCHOR, AXIS);
      const b = wirePath((k + 1) / 100, 0, ANCHOR, AXIS);
      expect(farthest(a, b)).toBeLessThan(0.05);
      const c = wirePath(1, k / 100, ANCHOR, AXIS);
      const d = wirePath(1, (k + 1) / 100, ANCHOR, AXIS);
      expect(farthest(c, d)).toBeLessThan(0.05);
    }
  });

  it('winds point by point, eased: halfway is not the coil\'s halfway', () => {
    const straight = straightPath();
    const coil = coilPath(ANCHOR, AXIS);
    const quarter = wirePath(1, 0.25, ANCHOR, AXIS);
    const eased = 0.25 * 0.25 * (3 - 2 * 0.25);
    for (let i = 0; i < WIRE.points; i++) {
      for (let c = 0; c < 3; c++) expect(quarter[i][c]).toBeCloseTo(straight[i][c] * (1 - eased) + coil[i][c] * eased, 12);
    }
  });

  it('hands back fresh arrays, so a caller cannot change the cable for the next one', () => {
    const a = lyingPath();
    a.pop();
    expect(lyingPath()).toHaveLength(WIRE.points);
    const b = straightPath();
    b.length = 0;
    expect(straightPath()).toHaveLength(WIRE.points);
  });
});

const SIDES = 8;
const RING_VERTICES = WIRE.points * SIDES;

/** The rings' centres, read off the tube's positions. */
function ringCentres(position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): Point[] {
  const centres: Point[] = [];
  for (let i = 0; i < WIRE.points; i++) {
    let x = 0, y = 0, z = 0;
    for (let k = 0; k < SIDES; k++) {
      x += position.getX(i * SIDES + k); y += position.getY(i * SIDES + k); z += position.getZ(i * SIDES + k);
    }
    centres.push([x / SIDES, y / SIDES, z / SIDES]);
  }
  return centres;
}

describe('the wire tube', () => {
  const pose = { show: 1, lift: 0.4, wind: 0.3, pulse: 0.5 };

  it('builds in node, invisible and finite, a tube of WIRE.points rings', () => {
    const wire = buildWire();
    expect(wire.mesh).toBeInstanceOf(THREE.Mesh);
    expect(wire.mesh.visible).toBe(false);
    const geometry = wire.mesh.geometry;
    const position = geometry.getAttribute('position');
    expect(position.count).toBeGreaterThanOrEqual(RING_VERTICES);
    for (const name of ['position', 'normal', 'uv']) {
      const array = geometry.getAttribute(name).array;
      for (let i = 0; i < array.length; i++) expect(Number.isFinite(array[i])).toBe(true);
    }
    wire.dispose();
  });

  it('stays invisible at show 0, shows at show > 0 and fades with opacity', () => {
    const wire = buildWire();
    wire.set({ ...pose, show: 0 }, ANCHOR, AXIS);
    expect(wire.mesh.visible).toBe(false);
    wire.set({ ...pose, show: 0.5 }, ANCHOR, AXIS);
    expect(wire.mesh.visible).toBe(true);
    const material = wire.materials()[0] as THREE.MeshStandardMaterial;
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBeCloseTo(0.5, 12);
    wire.set({ ...pose, show: 1 }, ANCHOR, AXIS);
    expect(material.opacity).toBe(1);
    wire.set({ ...pose, show: Number.NaN }, ANCHOR, AXIS);
    expect(wire.mesh.visible).toBe(false);
    wire.set({ ...pose, show: 0 }, ANCHOR, AXIS);
    expect(wire.mesh.visible).toBe(false);
    expect(material.opacity).toBe(0);
  });

  it('keeps the vertex count and the buffers across set calls', () => {
    const wire = buildWire();
    const geometry = wire.mesh.geometry;
    const position = geometry.getAttribute('position');
    const array = position.array;
    const count = position.count;
    const indexCount = geometry.getIndex()!.count;
    for (const p of [pose, { ...pose, lift: 1, wind: 1 }, { ...pose, lift: 0, wind: 0 }, { ...pose, lift: 0.7, wind: 0.2 }]) wire.set(p, ANCHOR, AXIS);
    expect(wire.mesh.geometry).toBe(geometry);
    expect(geometry.getAttribute('position')).toBe(position);
    expect(position.array).toBe(array);
    expect(position.count).toBe(count);
    expect(geometry.getIndex()!.count).toBe(indexCount);
  });

  it('follows the path: each ring is centred on its path point, WIRE.radius round it and square to the cable', () => {
    const wire = buildWire();
    for (const [lift, wind] of [[0, 0], [0.4, 0.3], [1, 0], [1, 0.6], [1, 1]]) {
      wire.set({ ...pose, lift, wind }, ANCHOR, AXIS);
      const position = wire.mesh.geometry.getAttribute('position');
      const path = wirePath(lift, wind, ANCHOR, AXIS);
      const centres = ringCentres(position);
      for (let i = 0; i < WIRE.points; i++) {
        for (let c = 0; c < 3; c++) expect(centres[i][c]).toBeCloseTo(path[i][c], 5);
        const tangent = sub(path[Math.min(i + 1, WIRE.points - 1)], path[Math.max(i - 1, 0)]);
        for (let k = 0; k < SIDES; k++) {
          const off = sub([position.getX(i * SIDES + k), position.getY(i * SIDES + k), position.getZ(i * SIDES + k)], path[i]);
          expect(norm(off)).toBeCloseTo(WIRE.radius, 5);
          expect(Math.abs(dot(off, unit(tangent)))).toBeLessThan(1e-5);
        }
      }
    }
  });

  it('has unit normals pointing out of the tube, and u running 0..1 along the path', () => {
    const wire = buildWire();
    for (const [lift, wind] of [[1, 0], [0.4, 0.3], [1, 1]]) {
      wire.set({ ...pose, lift, wind }, ANCHOR, AXIS);
      const geometry = wire.mesh.geometry;
      const position = geometry.getAttribute('position');
      const normal = geometry.getAttribute('normal');
      const uv = geometry.getAttribute('uv');
      const path = wirePath(lift, wind, ANCHOR, AXIS);
      for (let i = 0; i < WIRE.points; i++) {
        for (let k = 0; k < SIDES; k++) {
          const at = i * SIDES + k;
          const n: Point = [normal.getX(at), normal.getY(at), normal.getZ(at)];
          expect(norm(n)).toBeCloseTo(1, 5);
          const off = sub([position.getX(at), position.getY(at), position.getZ(at)], path[i]);
          expect(dot(n, unit(off))).toBeCloseTo(1, 4);
          expect(uv.getX(at)).toBeCloseTo(i / (WIRE.points - 1), 6);
        }
      }
      expect(uv.getX(0)).toBe(0);
      expect(uv.getX(RING_VERTICES - 1)).toBe(1);
      for (let at = 0; at < uv.count; at++) {
        expect(uv.getX(at)).toBeGreaterThanOrEqual(0);
        expect(uv.getX(at)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('winds its sides outward, and closes its ends', () => {
    const wire = buildWire();
    wire.set({ ...pose, lift: 1, wind: 0 }, ANCHOR, AXIS);
    const geometry = wire.mesh.geometry;
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const index = geometry.getIndex()!;
    const at = (i: number): THREE.Vector3 => new THREE.Vector3(position.getX(i), position.getY(i), position.getZ(i));
    let sides = 0;
    const caps: THREE.Vector3[] = [];
    for (let t = 0; t < index.count; t += 3) {
      const [a, b, c] = [index.getX(t), index.getX(t + 1), index.getX(t + 2)];
      const face = new THREE.Vector3().subVectors(at(b), at(a)).cross(new THREE.Vector3().subVectors(at(c), at(a))).normalize();
      if (Math.max(a, b, c) < RING_VERTICES) {
        const out = new THREE.Vector3(normal.getX(a) + normal.getX(b) + normal.getX(c), normal.getY(a) + normal.getY(b) + normal.getY(c), normal.getZ(a) + normal.getZ(b) + normal.getZ(c));
        expect(face.dot(out)).toBeGreaterThan(0);
        sides++;
      } else {
        caps.push(face);
      }
    }
    expect(sides).toBe((WIRE.points - 1) * SIDES * 2);
    // The straight wire runs north to south (+Z): its first cap faces north, its last south.
    expect(caps).toHaveLength(SIDES * 2);
    expect(caps.slice(0, SIDES).every((f) => f.z < -0.99)).toBe(true);
    expect(caps.slice(SIDES).every((f) => f.z > 0.99)).toBe(true);
    for (let i = 0; i < index.count; i++) expect(index.getX(i)).toBeLessThan(position.count);
  });

  it('survives awkward input: a zero axis, an axis along the normal, NaN poses', () => {
    const wire = buildWire();
    const poses = [
      { show: 1, lift: 1, wind: 1, pulse: 0.2 },
      { show: 1, lift: Number.NaN, wind: Number.NaN, pulse: Number.NaN },
      { show: 2, lift: -4, wind: 9, pulse: -1 }
    ];
    for (const p of poses) {
      for (const axis of [[0, 0, 0], [0, 1, 0], [1, 0, 0]] as Point[]) {
        wire.set(p, ANCHOR, axis);
        for (const name of ['position', 'normal']) {
          const array = wire.mesh.geometry.getAttribute(name).array;
          for (let i = 0; i < array.length; i++) expect(Number.isFinite(array[i])).toBe(true);
        }
      }
    }
  });

  it('colours cream at rest and gold wound, without touching the program', () => {
    const wire = buildWire();
    const material = wire.materials()[0] as THREE.MeshStandardMaterial;
    expect(material.metalness).toBeCloseTo(0.6, 12);
    expect(material.roughness).toBeCloseTo(0.35, 12);
    wire.set({ ...pose, wind: 0 }, ANCHOR, AXIS);
    expect(material.color.getHex()).toBe(0xf1e8d3);
    wire.set({ ...pose, wind: 1 }, ANCHOR, AXIS);
    expect(material.color.getHex()).toBe(0xd9a520);
    wire.set({ ...pose, wind: 0.5 }, ANCHOR, AXIS);
    const cream = new THREE.Color(0xf1e8d3);
    const gold = new THREE.Color(0xd9a520);
    expect(material.color.r).toBeCloseTo((cream.r + gold.r) / 2, 6);
    expect(material.color.g).toBeCloseTo((cream.g + gold.g) / 2, 6);
    expect(material.color.b).toBeCloseTo((cream.b + gold.b) / 2, 6);
  });

  it('does not touch the position buffer when its inputs have not changed', () => {
    const wire = buildWire();
    const position = wire.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const normal = wire.mesh.geometry.getAttribute('normal') as THREE.BufferAttribute;
    wire.set(pose, ANCHOR, AXIS);
    const versions = [position.version, normal.version];
    wire.set(pose, ANCHOR, AXIS);
    wire.set({ ...pose }, [...ANCHOR], [...AXIS]);
    expect([position.version, normal.version]).toEqual(versions);
    // The pulse, the opacity and a NaN that stays NaN are not the geometry's inputs.
    wire.set({ ...pose, pulse: 0.9, show: 0.4 }, ANCHOR, AXIS);
    wire.set({ ...pose, lift: Number.NaN }, ANCHOR, AXIS);
    const nan = [position.version, normal.version];
    wire.set({ ...pose, lift: Number.NaN }, ANCHOR, AXIS);
    expect([position.version, normal.version]).toEqual(nan);
    // A real change does rewrite.
    wire.set({ ...pose, lift: 0.8 }, ANCHOR, AXIS);
    expect(position.version).toBeGreaterThan(nan[0]);
    expect(normal.version).toBeGreaterThan(nan[1]);
  });

  it('leaves the anchor out of the geometry until the wire starts to wind', () => {
    const wire = buildWire();
    const position = wire.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    wire.set({ ...pose, wind: 0 }, ANCHOR, AXIS);
    const version = position.version;
    wire.set({ ...pose, wind: 0 }, [0.2, 0.06, 0.9], [0, 0, 1]);
    expect(position.version).toBe(version);
    wire.set({ ...pose, wind: 0.2 }, [0.2, 0.06, 0.9], [0, 0, 1]);
    const wound = position.version;
    expect(wound).toBeGreaterThan(version);
    wire.set({ ...pose, wind: 0.2 }, [0.3, 0.06, 0.9], [0, 0, 1]);
    expect(position.version).toBeGreaterThan(wound);
  });

  it('never changes the material\'s version across set calls, so nothing recompiles', () => {
    const wire = buildWire();
    const material = wire.materials()[0];
    const version = material.version;
    const poses = [
      { show: 0, lift: 0, wind: 0, pulse: -1 },
      { show: 1, lift: 0.5, wind: 0, pulse: 0.1 },
      { show: 0.6, lift: 1, wind: 0.5, pulse: 0.9 },
      { show: 1, lift: 1, wind: 1, pulse: -1 },
      { show: 0, lift: 1, wind: 1, pulse: Number.NaN }
    ];
    for (const p of poses) wire.set(p, ANCHOR, AXIS);
    expect(material.version).toBe(version);
    expect(material.transparent).toBe(true);
  });

  it('offers its one material for the warm-up, and frees geometry and material on dispose', () => {
    const wire = buildWire();
    const materials = wire.materials();
    expect(materials).toEqual([wire.mesh.material]);
    let freed = 0;
    wire.mesh.geometry.addEventListener('dispose', () => freed++);
    materials[0].addEventListener('dispose', () => freed++);
    wire.dispose();
    expect(freed).toBe(2);
  });

  it('moves the pulse through a uniform, none below 0, and patches the shader once for all poses', () => {
    const wire = buildWire();
    const material = wire.materials()[0];
    const shader = {
      uniforms: {} as Record<string, THREE.IUniform>,
      vertexShader: '#include <common>\nvoid main() {\n#include <begin_vertex>\n}',
      fragmentShader: '#include <common>\nvoid main() {\n vec3 totalEmissiveRadiance = vec3( 0.0 );\n#include <emissivemap_fragment>\n}'
    };
    material.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, undefined as never);
    expect(shader.uniforms.uPulse).toBeDefined();
    expect(shader.uniforms.uPulseWidth.value).toBe(WIRE.pulseWidth);
    expect(shader.fragmentShader).toContain('uniform float uPulse;');
    expect(shader.fragmentShader).toContain('uniform float uPulseWidth;');
    expect(shader.fragmentShader).toContain('2.4');
    expect(shader.vertexShader).toContain('vWireU = uv.x;');
    expect(shader.fragmentShader).toContain('varying float vWireU;');
    expect(shader.vertexShader).toContain('varying float vWireU;');
    // Nothing but the pulse is left unpatched.
    expect(shader.fragmentShader).not.toContain('#include <emissivemap_fragment>\n#include');

    expect(shader.uniforms.uPulse.value).toBe(-1);
    wire.set({ ...pose, pulse: 0.5 }, ANCHOR, AXIS);
    expect(shader.uniforms.uPulse.value).toBe(0.5);
    wire.set({ ...pose, pulse: -0.2 }, ANCHOR, AXIS);
    expect(shader.uniforms.uPulse.value).toBeLessThan(0);
    wire.set({ ...pose, pulse: Number.NaN }, ANCHOR, AXIS);
    expect(shader.uniforms.uPulse.value).toBeLessThan(0);
    wire.set({ ...pose, pulse: 0 }, ANCHOR, AXIS);
    expect(shader.uniforms.uPulse.value).toBe(0);
    expect(material.customProgramCacheKey()).toBe('compass:wire');
  });
});
