import * as THREE from 'three';
import { palette } from '../palette';
import { WIRE, clamp01, wirePath, type Point } from './wirePath';

/**
 * The wire: Ørsted's cable as a thin tube in the dial's frame, one of the
 * Rotterdam ring's painted bridge cables lifted off the ring and pulled
 * straight across the dial, winding into the voice coil in the change. The
 * path is wirePath's; this is the tube round it, 8 sides and WIRE.points
 * rings, built once with a fixed vertex count and rewritten in place when the
 * pose moves the path (nothing is allocated for the GPU per frame, and a set
 * with the same inputs touches nothing).
 *
 * The material is made transparent once (`opacity` is the pose's `show`), so
 * a fade never recompiles; the colour lerps cream to gold with the winding,
 * and a band of signal yellow runs along the tube where `pulse` says (a
 * `uPulse` uniform: it moves without a recompile, and below 0 there is none).
 * It builds and runs in node: nothing here needs a document or a canvas.
 */

/** The palette (global constraints): cream wire, gold coil, signal yellow pulses. */
const COLOR = { cream: palette.cream, gold: palette.gold, pulse: palette.yellow } as const;

/**
 * The pulse: how hard its core glows (a white-hot middle whose soft edges,
 * falling off, stay signal yellow), how far the wire's own colour gives way
 * under it to a deep yellow (so the glow keeps its hue rather than adding to
 * a cream the tone mapping would roll to white), and how much it swells the
 * tube at its middle, in radii: a bead of current running along the wire.
 */
const PULSE = { strength: 2.4, base: 0.35, swell: 1.4 } as const;

const SIDES = 8;
const RING_VERTICES = WIRE.points * SIDES;
/** The ring vertices, then the centre of the first cap, then of the last. */
const VERTICES = RING_VERTICES + 2;
/** A ring vertex's offset from its ring's centre, in units of the radius: cos and sin of its angle round the tube. */
const AROUND = Array.from({ length: SIDES }, (_, k): readonly [number, number] => [Math.cos((2 * Math.PI * k) / SIDES), Math.sin((2 * Math.PI * k) / SIDES)]);

/** What the wire is posed with: `show` fades it, `lift` pulls it off the ring, `wind` coils it, `pulse` is where a pulse of current is along it (below 0, none). */
export interface WirePose {
  show: number;
  lift: number;
  wind: number;
  pulse: number;
}

export interface WireModel {
  /** In the dial's frame; hidden until `set` is given a `show` above 0. */
  mesh: THREE.Mesh;
  /** Poses the wire. `anchor` and `axis` (the arm's tail point and direction, dial-local) are only read while it winds. */
  set(pose: WirePose, anchor: Point, axis: Point): void;
  /** Its material, for the warm-up. */
  materials(): THREE.Material[];
  dispose(): void;
}

/** Equal, or both NaN. */
function same(a: number, b: number): boolean {
  return a === b || (a !== a && b !== b);
}

/**
 * Lays the tube round `path` into `positions` and `normals` (ring i, vertex k
 * at i * SIDES + k, then the two cap centres). The rings are square to the
 * path and their frame is carried along it: each ring keeps the previous
 * ring's orientation as far as the new tangent allows, so the tube never
 * twists or flips, whatever the path does (a straight line, a helix).
 */
function layTube(path: readonly Point[], positions: Float32Array, normals: Float32Array): void {
  const last = path.length - 1;
  let tx = 1, ty = 0, tz = 0; // the tangent; kept where the path stands still
  let nx = 0, ny = 1, nz = 0; // the frame's normal, carried along; up to begin with
  let startX = 1, startY = 0, startZ = 0;
  for (let i = 0; i <= last; i++) {
    const before = path[Math.max(i - 1, 0)];
    const after = path[Math.min(i + 1, last)];
    const dx = after[0] - before[0];
    const dy = after[1] - before[1];
    const dz = after[2] - before[2];
    const length = Math.hypot(dx, dy, dz);
    if (length > 1e-9) {
      tx = dx / length; ty = dy / length; tz = dz / length;
    }
    if (i === 0) { startX = tx; startY = ty; startZ = tz; }

    // Square the carried normal to the new tangent.
    let along = nx * tx + ny * ty + nz * tz;
    nx -= tx * along; ny -= ty * along; nz -= tz * along;
    let size = Math.hypot(nx, ny, nz);
    if (size < 1e-6) {
      // The tangent has come onto the normal (or the first tangent is straight up): start again from up, or east where that is as bad.
      const rx = Math.abs(ty) < 0.9 ? 0 : 1;
      const ry = 1 - rx;
      along = rx * tx + ry * ty;
      nx = rx - tx * along; ny = ry - ty * along; nz = -tz * along;
      size = Math.hypot(nx, ny, nz);
    }
    nx /= size; ny /= size; nz /= size;
    // The binormal, t x n, so that (n, b, t) is right-handed.
    const bx = ty * nz - tz * ny;
    const by = tz * nx - tx * nz;
    const bz = tx * ny - ty * nx;

    const p = path[i];
    for (let k = 0; k < SIDES; k++) {
      const [c, s] = AROUND[k];
      const ox = c * nx + s * bx;
      const oy = c * ny + s * by;
      const oz = c * nz + s * bz;
      const at = (i * SIDES + k) * 3;
      normals[at] = ox; normals[at + 1] = oy; normals[at + 2] = oz;
      positions[at] = p[0] + WIRE.radius * ox; positions[at + 1] = p[1] + WIRE.radius * oy; positions[at + 2] = p[2] + WIRE.radius * oz;
    }
  }
  // The caps close the ends: each centre sits on the path's end and faces away along the tangent.
  const first = path[0];
  const end = path[last];
  positions.set(first, RING_VERTICES * 3);
  normals.set([-startX, -startY, -startZ], RING_VERTICES * 3);
  positions.set(end, (RING_VERTICES + 1) * 3);
  normals.set([tx, ty, tz], (RING_VERTICES + 1) * 3);
}

/** The tube's triangles, wound to face outward: the sides ring by ring, then the first cap, then the last. */
function tubeIndex(): number[] {
  const index: number[] = [];
  for (let i = 0; i < WIRE.points - 1; i++) {
    for (let k = 0; k < SIDES; k++) {
      const a = i * SIDES + k;
      const a2 = i * SIDES + ((k + 1) % SIDES);
      const b = a + SIDES;
      const b2 = a2 + SIDES;
      index.push(a, a2, b, a2, b2, b);
    }
  }
  const lastRing = (WIRE.points - 1) * SIDES;
  for (let k = 0; k < SIDES; k++) index.push(RING_VERTICES, (k + 1) % SIDES, k);
  for (let k = 0; k < SIDES; k++) index.push(RING_VERTICES + 1, lastRing + k, lastRing + ((k + 1) % SIDES));
  return index;
}

/** A GLSL vec3 of a linear colour. */
function vec3(color: THREE.Color): string {
  return `vec3( ${color.r.toFixed(5)}, ${color.g.toFixed(5)}, ${color.b.toFixed(5)} )`;
}

export function buildWire(): WireModel {
  const positions = new Float32Array(VERTICES * 3);
  const normals = new Float32Array(VERTICES * 3);
  const uvs = new Float32Array(VERTICES * 2);
  for (let i = 0; i < WIRE.points; i++) {
    for (let k = 0; k < SIDES; k++) uvs.set([i / (WIRE.points - 1), k / SIDES], (i * SIDES + k) * 2);
  }
  uvs.set([0, 0.5], RING_VERTICES * 2);
  uvs.set([1, 0.5], (RING_VERTICES + 1) * 2);

  const geometry = new THREE.BufferGeometry();
  const position = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
  const normal = new THREE.BufferAttribute(normals, 3).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', position);
  geometry.setAttribute('normal', normal);
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(tubeIndex());

  const cream = new THREE.Color(COLOR.cream);
  const gold = new THREE.Color(COLOR.gold);
  const material = new THREE.MeshStandardMaterial({
    name: 'compass:wire',
    color: COLOR.cream,
    metalness: 0.6,
    roughness: 0.35,
    // Transparent from the start (opacity is the pose's `show`), so a fade never flips the program.
    transparent: true,
    opacity: 0
  });
  const uniforms = {
    uPulse: { value: -1 },
    uPulseWidth: { value: WIRE.pulseWidth }
  };
  const glow = vec3(new THREE.Color(COLOR.pulse));
  material.userData.uniforms = uniforms;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vWireU;\nuniform float uPulse;\nuniform float uPulseWidth;')
      .replace(
        '#include <begin_vertex>',
        [
          '#include <begin_vertex>',
          '\tvWireU = uv.x;',
          // The glow's own band: the tube swells under it, out along its normals.
          '\tfloat wireSwell = step( 0.0, uPulse ) * ( 1.0 - smoothstep( 0.0, 0.5 * uPulseWidth, abs( uv.x - uPulse ) ) );',
          `\ttransformed += objectNormal * ${(WIRE.radius * PULSE.swell).toFixed(5)} * wireSwell;`
        ].join('\n')
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vWireU;\nuniform float uPulse;\nuniform float uPulseWidth;')
      .replace(
        '#include <emissivemap_fragment>',
        [
          '#include <emissivemap_fragment>',
          // A band of signal yellow, centred on uPulse and uPulseWidth wide, strongest in the middle and soft to its edges; none below 0.
          '\tfloat wirePulse = step( 0.0, uPulse ) * ( 1.0 - smoothstep( 0.0, 0.5 * uPulseWidth, abs( vWireU - uPulse ) ) );',
          `\tdiffuseColor.rgb = mix( diffuseColor.rgb, ${glow} * ${PULSE.base.toFixed(2)}, wirePulse );`,
          `\ttotalEmissiveRadiance += ${glow} * ${PULSE.strength.toFixed(1)} * wirePulse;`
        ].join('\n')
      );
  };
  material.customProgramCacheKey = () => 'compass:wire';

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'compass:wire';

  // What the tube was last laid for: lift, wind, and (while it winds) anchor and axis.
  const laidFor = new Float64Array(8);
  const next = new Float64Array(8);
  let laid = false;

  const model: WireModel = {
    mesh,
    set(pose, anchor, axis) {
      const show = clamp01(pose.show);
      mesh.visible = show > 0;
      material.opacity = show;
      uniforms.uPulse.value = pose.pulse >= 0 ? pose.pulse : -1;

      const lift = clamp01(pose.lift);
      const wind = clamp01(pose.wind);
      material.color.lerpColors(cream, gold, wind);

      // The anchor and axis shape the wire only once it winds, so a moving arm costs nothing before that.
      const winding = wind > 0;
      next[0] = lift;
      next[1] = wind;
      for (let c = 0; c < 3; c++) {
        next[2 + c] = winding ? anchor[c] : 0;
        next[5 + c] = winding ? axis[c] : 0;
      }
      let unchanged = laid;
      for (let c = 0; unchanged && c < next.length; c++) unchanged = same(next[c], laidFor[c]);
      if (unchanged) return;
      laidFor.set(next);
      laid = true;

      layTube(wirePath(lift, wind, anchor, axis), positions, normals);
      position.needsUpdate = true;
      normal.needsUpdate = true;
      geometry.boundingBox = null;
      geometry.boundingSphere = null;
    },
    materials: () => [material],
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
  model.set({ show: 0, lift: 0, wind: 0, pulse: -1 }, [0, 0, 0], [1, 0, 0]);
  return model;
}
