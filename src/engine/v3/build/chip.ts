/**
 * The loader's chip as three.js objects: a blank black body on the board, its
 * 64 gold pins (the loader's progress ring) and the ON a laser engraves on its
 * top. The measurements, the pin order and the strokes are Task 2's
 * (src/engine/v3/chipSpec.ts), so the pins the loader fills and the letters it
 * cuts are the ones the tests check. No React: Task 12a mounts the group and
 * drives the setters from the loader's clock.
 */
import * as THREE from 'three';
import { palette } from '~/engine/palette';
import type { TracesModel } from '~/engine/v3/build/traces';
import { CHIP, ON_STROKES, PIN_COUNT, pinPosition, type Stroke, strokeLengths } from '~/engine/v3/chipSpec';
import { LOADER } from '~/engine/v3/loaderTimeline';

/**
 * How the chip looks. The scene's bloom starts at a luminance of 1 in linear
 * light, and gold has a luminance of about 0.42 per unit, so a gold glow
 * blooms only above about 2.4 times gold: the lit pins and the cooled ON stay
 * under it (lit, never blown out), and only the power-on pins and the hot tip
 * of a fresh cut reach just past it, for a soft glow.
 *
 * - `body`: near-black and matte, so the laser's point and the lit pins are
 *   the only strong light (spec §2.1).
 * - `pin`: the lead's thickness on the board, and the dark brass of an unlit
 *   pin, which the scene's lights shade.
 * - `glow`: a lit pin's glow as a multiple of gold, while loading (`lit`, low)
 *   and at full power (`power`, just over the bloom's threshold).
 * - `engraving`: the ribbon's width and its lift off the top (enough that it
 *   never z-fights the face), the cooled cut's gold and the fresh cut's hot
 *   amber as multiples, and the seconds a cut takes to cool.
 */
export const CHIP_LOOK = {
  body: { colour: 0x0c0a0f, roughness: 0.86, metalness: 0 },
  pin: { thickness: 0.005, colour: palette.brass, shade: 0.45, metalness: 0.85, roughness: 0.42 },
  glow: { lit: 0.9, power: 2.5 },
  engraving: { width: 0.006, lift: 0.0004, cold: 1, hot: 3.2, hotColour: 0xff7a1e, cool: 0.6 }
} as const;

/** The chip as the scene holds it. */
export interface ChipModel {
  /** The body, the pins (`chip:pins`) and the engraving (`chip:engraving`), in world units on the board plane. */
  group: THREE.Group;
  /** Lights the first `lit` pins (0..64) in their clockwise order, from the top side's left end. */
  setPins(lit: number): void;
  /**
   * Shows how much of each stroke is cut (one fraction 0..1 per stroke, as
   * `engraved` gives them) at `time` seconds; the fresh cut glows hot and
   * cools to gold over `CHIP_LOOK.engraving.cool` seconds. Any move of the
   * cut, forward or back (a seek), reads as the laser cutting there at
   * `time`. A `time` of -Infinity shows the cut already cooled, for an ON
   * that appears whole (reduced motion, the home).
   */
  setEngraving(fractions: readonly number[], time: number): void;
  /** Powers the chip up, 0..1: the lit pins and the linked traces rise to their dim power-on glow. */
  setPower(t: number): void;
  /** Frees every geometry and material the chip made. */
  dispose(): void;
}

/** What the chip may drive besides itself. */
export interface ChipOptions {
  /**
   * The board's traces: `setPower` sets their glow with its own, so the
   * current spreads from the pins along them as one. Leave it out if the
   * caller sets the traces' glow itself, or the two would fight.
   */
  traces?: Pick<TracesModel, 'setGlow'>;
}

/** `x` held to [0, 1]; NaN reads as 0. */
function clamp01(x: number): number {
  return x > 0 ? (x < 1 ? x : 1) : 0;
}

/** The chip's top face, the plane the ON is cut into. */
const TOP = CHIP.board + CHIP.height;

/** The strokes' lengths and the whole ON's. */
const LENGTHS = strokeLengths(ON_STROKES);
const TOTAL = LENGTHS.reduce((sum, length) => sum + length, 0);

/**
 * The pace the laser cuts at when the load does not hold it back: the whole
 * ON in `LOADER.engraveMin` seconds. The glow reads a point's age off its
 * distance behind the cut at this pace (see `setEngraving`).
 */
const PACE = TOTAL / LOADER.engraveMin;

/**
 * A pin's glow goes in its instance colour, which this patch moves from the
 * diffuse colour (where three puts it) to the emitted light: the pin stays
 * brass, shaded by the scene's lights, and a lit one glows on top. An unlit
 * pin's instance colour is black, so it glows not at all.
 */
function patchPinGlow(shader: { fragmentShader: string }): void {
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <color_fragment>', '')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += vColor.rgb;');
}

/** The pins: one instanced lead per pin, flat on the board from the body's edge outward. */
function buildPins(): THREE.InstancedMesh<THREE.BoxGeometry, THREE.MeshStandardMaterial> {
  const { thickness } = CHIP_LOOK.pin;
  // Along x the lead's length, along z its width: a pin on the left or right side as it is, on the top or bottom turned a quarter.
  const geometry = new THREE.BoxGeometry(CHIP.pinLength, thickness, CHIP.pinWidth);
  const material = new THREE.MeshStandardMaterial({
    name: 'chip:pins',
    color: new THREE.Color(CHIP_LOOK.pin.colour).multiplyScalar(CHIP_LOOK.pin.shade),
    metalness: CHIP_LOOK.pin.metalness,
    roughness: CHIP_LOOK.pin.roughness
  });
  material.onBeforeCompile = patchPinGlow;
  material.customProgramCacheKey = () => 'chip:pins';

  const pins = new THREE.InstancedMesh(geometry, material, PIN_COUNT);
  pins.name = 'chip:pins';
  const matrix = new THREE.Matrix4();
  const black = new THREE.Color(0, 0, 0);
  for (let i = 0; i < PIN_COUNT; i++) {
    const { x, z, side } = pinPosition(i);
    matrix.makeRotationY(side === 'top' || side === 'bottom' ? Math.PI / 2 : 0);
    matrix.setPosition(x, CHIP.board + thickness / 2, z);
    pins.setMatrixAt(i, matrix);
    // Every pin gets a colour now, so the shader is built with instance colours from the first frame.
    pins.setColorAt(i, black);
  }
  pins.instanceMatrix.needsUpdate = true;
  return pins;
}

/**
 * One stroke as a flat ribbon `width` wide in the plane y = `y`, facing up.
 * Two vertices per station along the stroke, with `along` (0..1, the share of
 * the stroke's length up to that station) and `across` (-1 one edge, +1 the
 * other, for the soft edge). Joints are mitred. A closed stroke (the O, whose
 * last point is its first) mitres its seam and has no ends; an open one is
 * squared off half a width past each end, so the N's strokes meet without a
 * notch at its corners. The squared ends carry the end's `along`, so the
 * first one shows as soon as the stroke has started and the last only once
 * it is whole.
 */
function ribbon(stroke: Stroke, width: number, y: number): THREE.BufferGeometry {
  const points = stroke.points;
  const n = points.length;
  const closed = n > 2 && points[0][0] === points[n - 1][0] && points[0][1] === points[n - 1][1];
  const cumulative = [0];
  for (let k = 1; k < n; k++) cumulative.push(cumulative[k - 1] + Math.hypot(points[k][0] - points[k - 1][0], points[k][1] - points[k - 1][1]));
  const length = cumulative[n - 1];

  /** The unit direction of segment k (from point k to k + 1). */
  const direction = (k: number): [number, number] => {
    const dx = points[k + 1][0] - points[k][0];
    const dz = points[k + 1][1] - points[k][1];
    const d = Math.hypot(dx, dz);
    return [dx / d, dz / d];
  };

  // Stations: x, z, the unit offset to the +1 edge (scaled for the mitre), and along.
  const stations: [x: number, z: number, ox: number, oz: number, along: number][] = [];
  const half = width / 2;
  for (let k = 0; k < n; k++) {
    // The segments either side of point k; at a closed stroke's seam they wrap round, at an open one's end there is one.
    const before = k > 0 ? direction(k - 1) : closed ? direction(n - 2) : direction(0);
    const after = k < n - 1 ? direction(k) : closed ? direction(0) : direction(n - 2);
    // Each segment's offset: its direction turned a quarter in the plane, (dx, dz) -> (-dz, dx).
    const mx = -before[1] - after[1];
    const mz = before[0] + after[0];
    const m = Math.hypot(mx, mz);
    // The mitre: the averaged offset, lengthened so the edges stay `half` from both segments.
    const scale = half / Math.max(0.2, (mx / m) * -before[1] + (mz / m) * before[0]);
    stations.push([points[k][0], points[k][1], (mx / m) * scale, (mz / m) * scale, cumulative[k] / length]);
  }
  if (!closed) {
    const [sx, sz] = direction(0);
    const [ex, ez] = direction(n - 2);
    const first = stations[0];
    const last = stations[n - 1];
    stations.unshift([first[0] - sx * half, first[1] - sz * half, first[2], first[3], 0]);
    stations.push([last[0] + ex * half, last[1] + ez * half, last[2], last[3], 1]);
  }

  const positions = new Float32Array(stations.length * 2 * 3);
  const along = new Float32Array(stations.length * 2);
  const across = new Float32Array(stations.length * 2);
  stations.forEach(([x, z, ox, oz, a], s) => {
    // Vertex 2s is the +1 edge, 2s + 1 the -1 edge.
    positions.set([x + ox, y, z + oz, x - ox, y, z - oz], s * 6);
    along.set([a, a], s * 2);
    across.set([1, -1], s * 2);
  });
  const index: number[] = [];
  for (let s = 0; s < stations.length - 1; s++) {
    const a = s * 2;
    // Wound counter-clockwise seen from above, so the faces look up.
    index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('along', new THREE.BufferAttribute(along, 1));
  geometry.setAttribute('across', new THREE.BufferAttribute(across, 1));
  geometry.setIndex(index);
  return geometry;
}

const engravingVertex = /* glsl */ `
attribute float along;
attribute float across;
varying float vAlong;
varying float vAcross;
void main() {
  vAlong = along;
  vAcross = across;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

/**
 * The cut shows where `along <= uFraction`. A point's age is how long ago the
 * laser passed it: the seconds since the cut last moved (`uFrontAge`) plus its
 * distance behind the cut (along the whole ON, `uCut` less the point's own
 * place, `uStart + along * uLength`) at the laser's pace. Its heat falls from
 * 1 at the cut to 0 at `uCoolSeconds`, squared, so the hot amber is a short
 * bright tip that fades into the gold.
 */
const engravingFragment = /* glsl */ `
uniform float uFraction;
uniform float uStart;
uniform float uLength;
uniform float uCut;
uniform float uFrontAge;
uniform float uPace;
uniform float uCoolSeconds;
uniform vec3 uCold;
uniform vec3 uHot;
varying float vAlong;
varying float vAcross;
void main() {
  if (uFraction <= 0.0 || vAlong > uFraction) discard;
  float behind = max(0.0, uCut - (uStart + vAlong * uLength));
  float age = uFrontAge + behind / uPace;
  float heat = 1.0 - clamp(age / uCoolSeconds, 0.0, 1.0);
  heat *= heat;
  float core = 1.0 - smoothstep(0.4, 1.0, abs(vAcross));
  gl_FragColor = vec4(mix(uCold, uHot, heat), core);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** One stroke of the engraving: its mesh, and its material's uniforms. */
interface StrokePart {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  fraction: THREE.IUniform<number>;
}

/**
 * Builds the chip: the body standing on the board plane (bottom at
 * `CHIP.board`, top at `CHIP.board + CHIP.height`) at the compass's centre,
 * the 64 pins unlit, the ON not yet cut and the power off.
 */
export function buildChip(options: ChipOptions = {}): ChipModel {
  const group = new THREE.Group();
  group.name = 'chip';

  const bodyGeometry = new THREE.BoxGeometry(CHIP.size, CHIP.height, CHIP.size);
  bodyGeometry.translate(0, CHIP.board + CHIP.height / 2, 0);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    name: 'chip:body',
    color: CHIP_LOOK.body.colour,
    roughness: CHIP_LOOK.body.roughness,
    metalness: CHIP_LOOK.body.metalness
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.name = 'chip:body';

  const pins = buildPins();

  // The uniforms all four strokes share: one cut along the whole ON, so the glow runs on across a stroke's end.
  const { engraving: look } = CHIP_LOOK;
  const shared = {
    uCut: { value: 0 },
    uFrontAge: { value: look.cool as number },
    uPace: { value: PACE },
    uCoolSeconds: { value: look.cool },
    uCold: { value: new THREE.Color(palette.gold).multiplyScalar(look.cold) },
    uHot: { value: new THREE.Color(look.hotColour).multiplyScalar(look.hot) }
  };
  const engraving = new THREE.Group();
  engraving.name = 'chip:engraving';
  let start = 0;
  const strokes: StrokePart[] = ON_STROKES.map((stroke, k) => {
    const fraction = { value: 0 };
    const material = new THREE.ShaderMaterial({
      name: `chip:stroke:${k}`,
      uniforms: { ...shared, uFraction: fraction, uStart: { value: start }, uLength: { value: LENGTHS[k] } },
      vertexShader: engravingVertex,
      fragmentShader: engravingFragment,
      transparent: true,
      depthWrite: false
    });
    start += LENGTHS[k];
    const mesh = new THREE.Mesh(ribbon(stroke, look.width, TOP + look.lift), material);
    mesh.name = `chip:stroke:${k}`;
    mesh.visible = false;
    engraving.add(mesh);
    return { mesh, fraction };
  });

  group.add(body, pins, engraving);

  // The pins' state as painted, so a clock that holds still repaints nothing.
  const gold = new THREE.Color(palette.gold);
  const glow = new THREE.Color();
  const black = new THREE.Color(0, 0, 0);
  let lit = 0;
  let power = 0;
  let paintedLit = -1;
  let paintedPower = -1;
  const paint = (): void => {
    if (paintedLit === lit && paintedPower === power) return;
    glow.copy(gold).multiplyScalar(CHIP_LOOK.glow.lit + (CHIP_LOOK.glow.power - CHIP_LOOK.glow.lit) * power);
    for (let i = 0; i < PIN_COUNT; i++) pins.setColorAt(i, i < lit ? glow : black);
    pins.instanceColor!.needsUpdate = true;
    paintedLit = lit;
    paintedPower = power;
  };
  paint();

  // Where the cut stood when it last moved, along the whole ON, and when. Never cut: long cooled.
  let cut = 0;
  let cutAt = -Infinity;

  return {
    group,
    setPins(count) {
      lit = Number.isFinite(count) ? Math.min(PIN_COUNT, Math.max(0, Math.floor(count))) : 0;
      paint();
    },
    setEngraving(fractions, time) {
      let total = 0;
      strokes.forEach(({ mesh, fraction }, k) => {
        const f = clamp01(fractions[k]);
        fraction.value = f;
        // A stroke not yet started draws nothing at all.
        mesh.visible = f > 0;
        total += f * LENGTHS[k];
      });
      if (total !== cut) {
        cut = total;
        cutAt = time;
      }
      // NaN or an infinity (a time of -Infinity, say, to show a finished ON already cool) reads as long cooled.
      const age = time - cutAt;
      shared.uCut.value = cut;
      shared.uFrontAge.value = Number.isFinite(age) ? Math.min(look.cool, Math.max(0, age)) : look.cool;
    },
    setPower(t) {
      power = clamp01(t);
      paint();
      options.traces?.setGlow(power);
    },
    dispose() {
      bodyGeometry.dispose();
      bodyMaterial.dispose();
      pins.geometry.dispose();
      pins.material.dispose();
      pins.dispose();
      for (const { mesh } of strokes) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
    }
  };
}
