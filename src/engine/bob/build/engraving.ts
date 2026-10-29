/**
 * The engraved gold lines as three.js objects: the circle (a tube), the 144
 * ticks round it and the thin outer ring, and the two B letters made like the
 * compass's bands (spec 2026-10-29-bob-stack-2-design.md, goal 5, "Ringen":
 * ~/engine/bob/letterBands). The measurements and the paths are Task 1's
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
import { COMPASS_LOOK } from '~/engine/bob/build/compass';
import { letterStrip, RINGEN, tickPlaces } from '~/engine/bob/letterBands';
import { circlePath, type Point2, type StrokeId, strokePath, tickSegments, WORDMARK } from '~/engine/bob/wordmark';
import { palette } from '~/engine/palette';

/**
 * How the engraving looks. Task 12 tuned the numbers against the Blender
 * preview's stills under the luminance gate; each change says why.
 *
 * - `colour`, `gain`: every part is the palette's gold light (the preview's
 *   GOLD_EMIT) times `gain` times the part's `share` times the glow `setGlow` is
 *   given, in linear light, so a glow of 1 is the engraving at rest. The shares
 *   keep the preview's order of strength: the letters and the circle (its
 *   emission 3.0 and 3.2), then the ticks (1.8), then the outer ring (1.2).
 *   Task 12: the hot amber read bright orange where the preview's lines read a
 *   pale warm gold; at this gain the shoulder rolls the gold light off to that.
 * - `tube`: the strokes' tubes have `radial` sides and about `perMetre`
 *   segments to each metre of path.
 * - `outer`: the outer ring's tube radius, half a stroke's.
 * - `letters`: the light that runs out of the O into the two B letters on the
 *   scroll (the preview's `REVEAL == 'glow'` in tools/blender/bob_reveal_b.py).
 *   The front stands `mix(from, to, share)` metres past `|x| = inner`; the
 *   letters lie from 2.15 (the inner edge, nearest the compass) to 4.25 (the
 *   outer), so it runs the length of each. A point `ramp` behind the front is
 *   lit in full and one on the front not at all. `edge` is the extra brightness
 *   in the feather between the two, the preview's `mask * (1 - mask) * 10` over
 *   its emission of 3: the light there is `k * (k + edge * k * (1 - k))` of the
 *   rest (the preview mixes its emission with a transparent shader by the same
 *   mask, which is the outer `k`), so it peaks at about 1.08 times the rest near
 *   `k` 0.87, just behind the front, and is the rest itself from `ramp` behind it.
 * - `ticks`: a tick is a flat quad `width` wide, `lift` over the glass so it
 *   cannot z-fight the floor. Task 12: 0.009 read under a pixel at the home
 *   framing (2.3 px across the front of the ring at 1440x900, half a pixel on
 *   its sides, under a pixel everywhere on a phone) and broke up; 0.013 holds.
 * - `ringen`: the B letters' bands (~/engine/bob/letterBands), lit by the
 *   compass's own room (the scene's environment): the glass the compass's band
 *   glass times `glass.shade`, the rims the compass's gold at its own emissive
 *   (so the B reads as the O), the ticks the gold light times `ticks`, the
 *   mock-up's; the emissives and the ticks scale with the glow. The mock-up's
 *   "BOB from above" measured 0.16 over the darkness gate's 0.11 under its own
 *   room and bloom; in the site's scene these measure 0.064 (1440x900) and
 *   0.020 (390x844). Task 15 started at 0.05, 0.12 and 0.5 (0.058), where the
 *   rims read brown beside the O.
 */
export const ENGRAVING_LOOK = {
  colour: palette.goldLight,
  gain: 2.4,
  share: { stroke: 1, ticks: 0.6, outer: 0.4 },
  tube: { radial: 6, perMetre: 120 },
  outer: { radius: 0.0055 },
  letters: { inner: 1.9, from: -0.6, to: 2.9, ramp: 0.45, edge: 3.3 },
  ticks: { width: 0.013, lift: 0.0006 },
  ringen: {
    glass: { shade: 0.32, opacity: 0.78, roughness: 0.32, metalness: 0.15, emissive: 0.08 },
    rims: { emissive: 0.22 },
    ticks: 0.75
  }
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

/** The strokes of the two B letters: all but the circle. */
const LETTER_IDS: readonly StrokeId[] = ['leftB', 'leftBar', 'rightB', 'rightBar'];

/** One geometry from flat parts on the glass, all facing up. */
function mergedFlat(parts: readonly { position: Float32Array; uv: Float32Array; index: Uint32Array }[]): THREE.BufferGeometry {
  const vertices = parts.reduce((n, p) => n + p.position.length / 3, 0);
  const position = new Float32Array(vertices * 3);
  const uv = new Float32Array(vertices * 2);
  const index = new Uint32Array(parts.reduce((n, p) => n + p.index.length, 0));
  let v = 0;
  let i = 0;
  for (const part of parts) {
    position.set(part.position, v * 3);
    uv.set(part.uv, v * 2);
    for (let k = 0; k < part.index.length; k++) index[i + k] = part.index[k]! + v;
    v += part.position.length / 3;
    i += part.index.length;
  }
  const normal = new Float32Array(vertices * 3);
  for (let k = 0; k < vertices; k++) normal[k * 3 + 1] = 1;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  return geometry;
}

/** A band's ticks as flat quads `y` over the glass, laid out as a strip's steps: the near side first, facing up. */
function tickQuads(places: ReturnType<typeof tickPlaces>, y: number): { position: Float32Array; uv: Float32Array; index: Uint32Array } {
  const position = new Float32Array(places.length * 12);
  const uv = new Float32Array(places.length * 8);
  const index = new Uint32Array(places.length * 6);
  places.forEach(({ at, angle, length, width }, k) => {
    // Along the path (x turned by the angle) and across it toward the bands' middle (the path's normal).
    const [tx, tz] = [Math.cos(angle), -Math.sin(angle)];
    const [nx, nz] = [-tz, tx];
    const [ax, az] = [(tx * width) / 2, (tz * width) / 2];
    const [cx, cz] = [(nx * length) / 2, (nz * length) / 2];
    position.set(
      [at[0] - ax - cx, y, at[1] - az - cz, at[0] - ax + cx, y, at[1] - az + cz, at[0] + ax - cx, y, at[1] + az - cz, at[0] + ax + cx, y, at[1] + az + cz],
      k * 12
    );
    uv.set([0, 0, 0, 1, 1, 0, 1, 1], k * 8);
    const v = k * 4;
    index.set([v, v + 1, v + 2, v + 1, v + 3, v + 2], k * 6);
  });
  return { position, uv, index };
}

/** The B letters' glass, rims and ticks: three bands to a stroke, two rims to a band, the ticks on the outer edges of the outer bands. */
function letterGeometries(): { glass: THREE.BufferGeometry; rims: THREE.BufferGeometry; ticks: THREE.BufferGeometry } {
  const { bands, width, rim, lift, ticks } = RINGEN;
  const half = width / 2;
  const glass: ReturnType<typeof letterStrip>[] = [];
  const rims: ReturnType<typeof letterStrip>[] = [];
  const marks: ReturnType<typeof tickQuads>[] = [];
  for (const id of LETTER_IDS) {
    const path = strokePath(id);
    for (const d of bands) {
      glass.push(letterStrip(path, d - half, d + half, lift.glass));
      for (const edge of [d - half, d + half]) rims.push(letterStrip(path, edge - rim / 2, edge + rim / 2, lift.rim));
    }
    for (const edge of [bands[0] - half, bands[bands.length - 1]! + half]) marks.push(tickQuads(tickPlaces(path, edge, ticks.reach * width), lift.ticks));
  }
  return { glass: mergedFlat(glass), rims: mergedFlat(rims), ticks: mergedFlat(marks) };
}

/**
 * The letters' light front, added to three's own shaders (the bands' glass, their rims and their ticks). The vertex
 * shader hands over the world x (worked out from the model matrix, since
 * `worldpos_vertex` defines a world position only under some defines); the
 * fragment shader works out `k` from it: 0 ahead of the front, 1 `ramp` behind
 * it. Where `k` is 0 nothing is drawn; the rest is the material's light times
 * `k * (k + edge * k * (1 - k))` (the preview's emission, mixed with a
 * transparent shader by the same mask) and its alpha times `k` (so the glass
 * fades with the light, not darkening what is under it), before it is
 * tone-mapped and fogged as the material's own shader does. The front and the look are uniforms the setter and the
 * build hold, so a frame of the front compiles nothing.
 */
function patchLetters(front: THREE.IUniform<number>, look: THREE.IUniform<THREE.Vector3>) {
  return (shader: { uniforms: Record<string, THREE.IUniform>; vertexShader: string; fragmentShader: string }): void => {
    shader.uniforms.uFront = front;
    shader.uniforms.uLook = look;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vLetterX;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvLetterX = ( modelMatrix * vec4( transformed, 1.0 ) ).x;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uFront;\nuniform vec3 uLook;\nvarying float vLetterX;')
      .replace(
        '#include <opaque_fragment>',
        [
          'float k = clamp( ( uFront - ( abs( vLetterX ) - uLook.x ) ) / uLook.y, 0.0, 1.0 );',
          'if ( k <= 0.0 ) discard;',
          '#include <opaque_fragment>',
          'gl_FragColor.rgb *= k * ( k + uLook.z * k * ( 1.0 - k ) );',
          'gl_FragColor.a *= k;'
        ].join('\n')
      );
  };
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

/** Each tick shows from its inner end out to `uGrown` of its length, flat gold light, tone-mapped and fogged as a basic material is. */
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
  /**
   * Shows the first `drawn` (0..1, held to that; NaN reads as 0) of the circle, by whole tube segments. The four B
   * strokes are bands, not tubes, and show only through `setLetters`: for them this does nothing.
   */
  setStroke(id: StrokeId, drawn: number): void;
  /**
   * Runs the light out of the O into the two B letters, `share` (0..1, held to that; NaN reads as 0) of the way:
   * nothing of the B letters' bands is drawn at 0; above it they are drawn whole, their glass, rims and ticks lit up to
   * a front `mix(from, to, share)` metres past `|x| = inner` (`ENGRAVING_LOOK.letters`), from each letter's inner
   * edge to its outer, and nothing past it. It moves a uniform, so a frame of it compiles nothing.
   */
  setLetters(share: number): void;
  /** Grows the ticks outward to `grown` (0..1) of their length; none are drawn at 0. */
  setTicks(grown: number): void;
  /** Shows the first `drawn` (0..1) of the outer ring, as a stroke. */
  setOuter(drawn: number): void;
  /** Sets every part to the gold light times `level` (held to 0 or more; NaN reads as 0), each by its share; 1 is the engraving at rest. */
  setGlow(level: number): void;
  /** Frees every geometry and material the engraving made. */
  dispose(): void;
}

/**
 * Builds the engraving with nothing drawn yet (the circle at 0, no ticks, no
 * outer ring, no B letter) at a glow of 1. The circle has a basic material; the
 * outer ring and the ticks have theirs, for their shares; all three are opaque,
 * tone-mapped and fogged. The B letters (`letters`) are three parts, each with
 * the light front (`setLetters`): the bands' glass (`letters:glass`, the
 * compass's band glass, see-through), their gold rims (`letters:rims`) and
 * their ticks (`letters:ticks`, flat gold light).
 */
export function buildEngraving(): EngravingModel {
  const look = ENGRAVING_LOOK;
  const group = new THREE.Group();
  group.name = 'engraving';

  const base = new THREE.Color(look.colour);
  const strokeMaterial = new THREE.MeshBasicMaterial({ name: 'engraving:stroke', color: base.clone() });
  const front: THREE.IUniform<number> = { value: look.letters.from };
  const lettersLook: THREE.IUniform<THREE.Vector3> = { value: new THREE.Vector3(look.letters.inner, look.letters.ramp, look.letters.edge) };
  const { glass: glassLook, rims: rimsLook } = look.ringen;
  const bandGlass = COMPASS_LOOK.bandGlass;
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    name: 'engraving:letters:glass',
    color: new THREE.Color(bandGlass.colour).multiplyScalar(glassLook.shade),
    transmission: 0,
    roughness: glassLook.roughness,
    metalness: glassLook.metalness,
    ior: bandGlass.ior,
    thickness: bandGlass.thickness,
    iridescence: bandGlass.iridescence,
    emissive: bandGlass.emissive,
    emissiveIntensity: glassLook.emissive,
    transparent: true,
    opacity: glassLook.opacity,
    side: THREE.DoubleSide
  });
  const gold = COMPASS_LOOK.gold;
  const rimsMaterial = new THREE.MeshStandardMaterial({
    name: 'engraving:letters:rims',
    color: gold.colour,
    metalness: gold.metalness,
    roughness: gold.roughness,
    emissive: gold.emissive,
    emissiveIntensity: rimsLook.emissive,
    side: THREE.DoubleSide
  });
  const marksMaterial = new THREE.MeshBasicMaterial({ name: 'engraving:letters:ticks', color: base.clone(), side: THREE.DoubleSide });
  const letterMaterials = [glassMaterial, rimsMaterial, marksMaterial];
  for (const material of letterMaterials) {
    material.onBeforeCompile = patchLetters(front, lettersLook);
    material.customProgramCacheKey = () => 'bob-letters';
  }
  const outerMaterial = new THREE.MeshBasicMaterial({ name: 'engraving:outer', color: base.clone() });
  const tickMaterial = new THREE.ShaderMaterial({
    name: 'engraving:ticks',
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uColour: { value: base.clone() }, uGrown: { value: 0 } }]),
    vertexShader: tickVertex,
    fragmentShader: tickFragment,
    fog: true,
    side: THREE.DoubleSide
  });

  const circle = new THREE.Mesh(tubeAlong(strokePath('circle'), WORDMARK.engrave), strokeMaterial);
  circle.name = 'stroke:circle';
  group.add(circle);

  const letters = new THREE.Group();
  letters.name = 'letters';
  letters.visible = false;
  const shapes = letterGeometries();
  const letterParts = [
    new THREE.Mesh(shapes.glass, glassMaterial),
    new THREE.Mesh(shapes.rims, rimsMaterial),
    new THREE.Mesh(shapes.ticks, marksMaterial)
  ];
  letterParts.forEach((mesh, k) => {
    mesh.name = `letters:${['glass', 'rims', 'ticks'][k]}`;
    letters.add(mesh);
  });
  group.add(letters);

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
      if (id === 'circle') reveal(circle, drawn);
    },
    setLetters(share) {
      const s = clamp01(share);
      front.value = look.letters.from + (look.letters.to - look.letters.from) * s;
      // Drawn whole above 0: the front hides what it has not reached.
      letters.visible = s > 0;
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
      glassMaterial.emissiveIntensity = glassLook.emissive * k;
      rimsMaterial.emissiveIntensity = rimsLook.emissive * k;
      marksMaterial.color.copy(base).multiplyScalar(look.ringen.ticks * k);
      outerMaterial.color.copy(base).multiplyScalar(look.gain * look.share.outer * k);
      (tickMaterial.uniforms.uColour.value as THREE.Color).copy(base).multiplyScalar(look.gain * look.share.ticks * k);
    },
    dispose() {
      for (const mesh of [circle, outer, ticks, ...letterParts]) mesh.geometry.dispose();
      strokeMaterial.dispose();
      for (const material of letterMaterials) material.dispose();
      outerMaterial.dispose();
      tickMaterial.dispose();
    }
  };
  model.setGlow(1);
  return model;
}
