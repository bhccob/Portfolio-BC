/**
 * The engraved gold lines as three.js objects: the two B outlines and their
 * bars and the circle (one tube each), the 144 ticks round the circle and the
 * thin outer ring. The measurements and the paths are Task 1's
 * (~/engine/bob/wordmark), so what the scene draws is what the wordmark tests
 * check. No React: the Opening (Task 10) mounts the group and poses it from the
 * loader's clock through the setters.
 *
 * "Engraving is a thin, softly glowing gold line, half sunk into the glass"
 * (spec section 4): each stroke is a thin tube centred on y = 0, the glass
 * plane, so the floor hides its lower half. A stroke is revealed from its start
 * by drawing only the first part of its triangles (`revealCount`); the tube's
 * rings are equal steps of arc length, so a stroke is cut at constant speed.
 */
import * as THREE from 'three';
import { palette } from '~/engine/palette';
import { circlePath, type Point2, STROKE_ORDER, type StrokeId, strokePath, tickSegments, WORDMARK } from '~/engine/bob/wordmark';

/**
 * How the engraving looks. The numbers are first values: a later task tunes
 * them under the luminance gate.
 *
 * - `colour`, `gain`: every part is the palette's hot amber times `gain` times
 *   the part's `share` times the glow `setGlow` is given, in linear light, so a
 *   glow of 1 is the engraving at rest. The shares keep the preview's order of
 *   strength: the letters and the circle (its emission 3.0 and 3.2), then the
 *   ticks (1.8), then the outer ring (1.2).
 * - `tube`: the strokes' tubes have `radial` sides and about `perMetre`
 *   segments to each metre of path.
 * - `outer`: the outer ring's tube radius, half a stroke's.
 * - `ticks`: a tick is a flat quad `width` wide, `lift` over the glass so it
 *   cannot z-fight the floor.
 */
export const ENGRAVING_LOOK = {
  colour: palette.amber,
  gain: 2,
  share: { stroke: 1, ticks: 0.6, outer: 0.4 },
  tube: { radial: 6, perMetre: 120 },
  outer: { radius: 0.0055 },
  ticks: { width: 0.009, lift: 0.0006 }
} as const;

/** `x` held to [0, 1]; NaN reads as 0. */
function clamp01(x: number): number {
  return x > 0 ? (x < 1 ? x : 1) : 0;
}

/**
 * How many indices of a tube to draw to show `fraction` (0..1, held to that;
 * NaN reads as nothing) of it. A tube of `tubular` segments of `radial` sides
 * is drawn segment by segment, each side two triangles (6 indices), so
 * showing the first `k` segments is `k * radial * 6` indices. The fraction is
 * rounded down to a whole segment.
 */
export function revealCount(fraction: number, tubular: number, radial: number): number {
  return Math.floor(clamp01(fraction) * tubular) * radial * 6;
}

/**
 * A polyline on the glass as a three.js curve, parametrised by arc length: a
 * point `t` of the way along is `t` of the path's length from its start. Three's
 * own curves for this (a CurvePath of lines) find a point by walking every
 * segment and estimate tangents numerically; a tube asks for both at every
 * ring, and the circle has 240 segments, so this one looks a point up by
 * bisection and reads a tangent off the segment it lies on.
 */
class PolylineCurve extends THREE.Curve<THREE.Vector3> {
  private readonly points: Point2[];
  /** The arc length at each point: 0 at the first. */
  private readonly distance: number[];
  private readonly total: number;

  constructor(path: readonly Point2[]) {
    super();
    // Repeated points make zero-length segments, which have no direction.
    this.points = path.filter((p, i) => i === 0 || p[0] !== path[i - 1][0] || p[1] !== path[i - 1][1]);
    this.distance = [0];
    for (let i = 1; i < this.points.length; i++) {
      this.distance.push(this.distance[i - 1] + Math.hypot(this.points[i][0] - this.points[i - 1][0], this.points[i][1] - this.points[i - 1][1]));
    }
    this.total = this.distance[this.distance.length - 1];
  }

  override getLength(): number {
    return this.total;
  }

  /** The segment (the index of its first point) that arc length `d` lies on: the last one for the end. */
  private segmentAt(d: number): number {
    let low = 0;
    let high = this.points.length - 2;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (this.distance[mid] <= d) low = mid;
      else high = mid - 1;
    }
    return low;
  }

  override getPoint(t: number, target: THREE.Vector3 = new THREE.Vector3()): THREE.Vector3 {
    const d = clamp01(t) * this.total;
    const i = this.segmentAt(d);
    const length = this.distance[i + 1] - this.distance[i];
    const f = length > 0 ? (d - this.distance[i]) / length : 0;
    const a = this.points[i];
    const b = this.points[i + 1];
    return target.set(a[0] + (b[0] - a[0]) * f, 0, a[1] + (b[1] - a[1]) * f);
  }

  override getPointAt(u: number, target?: THREE.Vector3): THREE.Vector3 {
    return this.getPoint(u, target);
  }

  override getTangentAt(u: number, target: THREE.Vector3 = new THREE.Vector3()): THREE.Vector3 {
    const i = this.segmentAt(clamp01(u) * this.total);
    const a = this.points[i];
    const b = this.points[i + 1];
    return target.set(b[0] - a[0], 0, b[1] - a[1]).normalize();
  }
}

/** A tube along `path` with its first ring on the path's start, drawing nothing yet. */
function tubeAlong(path: readonly Point2[], radius: number): THREE.TubeGeometry {
  const curve = new PolylineCurve(path);
  const { radial, perMetre } = ENGRAVING_LOOK.tube;
  const geometry = new THREE.TubeGeometry(curve, Math.max(2, Math.ceil(curve.getLength() * perMetre)), radius, radial, false);
  geometry.setDrawRange(0, 0);
  return geometry;
}

/**
 * The 144 ticks as one geometry of flat quads, four vertices each, running
 * from the tick's inner end to its outer end. `along` is 0 at the inner end
 * and 1 at the outer, so the shader can grow every tick outward at once. The
 * quads face up (counter-clockwise seen from above) and lie `lift` over y = 0.
 */
function tickGeometry(): THREE.BufferGeometry {
  const segments = tickSegments();
  const half = ENGRAVING_LOOK.ticks.width / 2;
  const positions = new Float32Array(segments.length * 4 * 3);
  const along = new Float32Array(segments.length * 4);
  const index: number[] = [];
  segments.forEach(([inner, outer], k) => {
    const dx = outer[0] - inner[0];
    const dz = outer[1] - inner[1];
    const length = Math.hypot(dx, dz);
    // The unit direction turned a quarter: the quad's width runs across the tick.
    const ox = (-dz / length) * half;
    const oz = (dx / length) * half;
    const y = ENGRAVING_LOOK.ticks.lift;
    positions.set([inner[0] + ox, y, inner[1] + oz, inner[0] - ox, y, inner[1] - oz, outer[0] + ox, y, outer[1] + oz, outer[0] - ox, y, outer[1] - oz], k * 12);
    along.set([0, 0, 1, 1], k * 4);
    const v = k * 4;
    index.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('along', new THREE.BufferAttribute(along, 1));
  geometry.setIndex(index);
  return geometry;
}

const tickVertex = /* glsl */ `
attribute float along;
varying float vAlong;
#include <fog_pars_vertex>
void main() {
  vAlong = along;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

/** Each tick shows from its inner end out to `uGrown` of its length, flat amber, tone-mapped and fogged as a basic material is. */
const tickFragment = /* glsl */ `
uniform vec3 uColour;
uniform float uGrown;
varying float vAlong;
#include <fog_pars_fragment>
void main() {
  if (vAlong > uGrown) discard;
  gl_FragColor = vec4(uColour, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

/** The engraving as the scene holds it. */
export interface EngravingModel {
  /** `engraving`: the strokes (`stroke:<id>`), the ticks (`ticks`) and the outer ring (`outer`), in world units on the glass plane. */
  group: THREE.Group;
  /** Shows the first `drawn` (0..1, held to that; NaN reads as 0) of a stroke, by whole tube segments. */
  setStroke(id: StrokeId, drawn: number): void;
  /** Grows the ticks outward to `grown` (0..1) of their length; none are drawn at 0. */
  setTicks(grown: number): void;
  /** Shows the first `drawn` (0..1) of the outer ring, as a stroke. */
  setOuter(drawn: number): void;
  /** Sets every part to the amber times `level` (held to 0 or more; NaN reads as 0), each by its share; 1 is the engraving at rest. */
  setGlow(level: number): void;
  /** Frees every geometry and material the engraving made. */
  dispose(): void;
}

/**
 * Builds the engraving with nothing drawn yet (every stroke at 0, no ticks, no
 * outer ring) at a glow of 1. The five strokes share one basic material (the
 * letters and the circle are the same strength); the outer ring and the ticks
 * have their own, for their shares. All three are opaque, tone-mapped and
 * fogged.
 */
export function buildEngraving(): EngravingModel {
  const look = ENGRAVING_LOOK;
  const group = new THREE.Group();
  group.name = 'engraving';

  const base = new THREE.Color(look.colour);
  const strokeMaterial = new THREE.MeshBasicMaterial({ name: 'engraving:stroke', color: base.clone() });
  const outerMaterial = new THREE.MeshBasicMaterial({ name: 'engraving:outer', color: base.clone() });
  const tickMaterial = new THREE.ShaderMaterial({
    name: 'engraving:ticks',
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uColour: { value: base.clone() }, uGrown: { value: 0 } }]),
    vertexShader: tickVertex,
    fragmentShader: tickFragment,
    fog: true,
    side: THREE.DoubleSide
  });

  const strokes = new Map<StrokeId, THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial>>();
  for (const id of STROKE_ORDER) {
    const mesh = new THREE.Mesh(tubeAlong(strokePath(id), WORDMARK.engrave), strokeMaterial);
    mesh.name = `stroke:${id}`;
    strokes.set(id, mesh);
    group.add(mesh);
  }

  const ticks = new THREE.Mesh(tickGeometry(), tickMaterial);
  ticks.name = 'ticks';
  ticks.visible = false;
  group.add(ticks);

  const outer = new THREE.Mesh(tubeAlong(circlePath(WORDMARK.outer), look.outer.radius), outerMaterial);
  outer.name = 'outer';
  group.add(outer);

  const reveal = (mesh: THREE.Mesh<THREE.TubeGeometry, THREE.Material>, drawn: number): void => {
    mesh.geometry.setDrawRange(0, revealCount(drawn, mesh.geometry.parameters.tubularSegments, mesh.geometry.parameters.radialSegments));
  };

  const model: EngravingModel = {
    group,
    setStroke(id, drawn) {
      reveal(strokes.get(id)!, drawn);
    },
    setTicks(grown) {
      const g = clamp01(grown);
      tickMaterial.uniforms.uGrown.value = g;
      ticks.visible = g > 0;
    },
    setOuter(drawn) {
      reveal(outer, drawn);
    },
    setGlow(level) {
      const k = Number.isFinite(level) && level > 0 ? level : 0;
      strokeMaterial.color.copy(base).multiplyScalar(look.gain * look.share.stroke * k);
      outerMaterial.color.copy(base).multiplyScalar(look.gain * look.share.outer * k);
      (tickMaterial.uniforms.uColour.value as THREE.Color).copy(base).multiplyScalar(look.gain * look.share.ticks * k);
    },
    dispose() {
      for (const mesh of [...strokes.values(), outer, ticks]) mesh.geometry.dispose();
      strokeMaterial.dispose();
      outerMaterial.dispose();
      tickMaterial.dispose();
    }
  };
  model.setGlow(1);
  return model;
}
