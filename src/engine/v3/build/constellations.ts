/**
 * The three constellations of the v3 home as three.js objects (spec §2.2,
 * frame 04): each country's stars, joined by thin gold lines like an old star
 * atlas, and their reflection in the compass's glass. The stars stand where
 * Task 5 places them (starPositions), so the needle's aim and the picture
 * agree. They rest dim; only the one the needle points at brightens
 * (`setGlow`), which Task 12b drives. No React.
 *
 * Every star is a soft round sprite drawn by its own shader: sized by its
 * magnitude and by its depth, so near stars are bigger, and softer, and far
 * ones smaller and sharper, as the spec asks.
 */
import * as THREE from 'three';
import { COUNTRY_IDS, countryDirection, type CountryId } from '~/data/directions';
import { palette } from '~/engine/palette';
import { GLASS_RINGS } from '~/engine/v3/compassSpec';
import { FIGURES, starPositions } from '~/engine/v3/constellations';

/** The glass's edges: the trigram ring's inner and the hexagram ring's outer. A reflection lands on glass only between them. */
const GLASS_INNER = GLASS_RINGS[0].inner;
const GLASS_OUTER = GLASS_RINGS[GLASS_RINGS.length - 1].outer;

/**
 * How the constellations look, in linear light (the scene's bloom starts at a
 * luminance of 1).
 *
 * - `rest` and `pointed`: a constellation's glow at rest and while the needle
 *   points at it; `setGlow` takes any level between.
 * - `size`: a magnitude-1 star's sprite, in world units at its depth; at the
 *   home's camera (Task 14b) that is about 27 CSS px across on the side
 *   figures and 14 on the ship, on a 900-px-tall picture (the core is a third
 *   to two fifths of that; the rest is halo), big enough that a star reads as
 *   a point of light and not a pixel on its line. `maxSize` caps a sprite in
 *   pixels.
 * - `depth`: the camera distances at which a star is softest (and its halo
 *   widest) and sharpest: the side figures' near feet and the ship.
 * - `core` and `halo`: a star is a cream core in a halo of its country's
 *   tint, falling off with the square of the distance to the sprite's edge;
 *   the halo adds `halo[0]` (far) to `halo[1]` (near) of the core's light at
 *   the centre.
 * - `intensity`: the star's light at glow 1. The brightest pixel of a
 *   pointed star (cream, luminance 0.81, times 1.6 near, times this) is about
 *   0.97: it nearly reaches the bloom and never clips. At rest, 0.29.
 * - `line`: the figure's lines, the palette's gold times `level` at glow 1:
 *   thin and dim, so that even the faintest star's core is more than three
 *   times as bright as a line (Task 14b; the stars, not the lines, draw the
 *   figure, as an old star atlas has them).
 * - `mirror`: the reflection in the glass, at `opacity` of the
 *   constellation's light, fading out over `fade` (world units) at the
 *   glass's inner and outer edges, so none of it shows on the hub or beyond
 *   the rim.
 * - `twinkle`: the share of the stars that twinkle (the rest hold still), how
 *   deep they dim, and their pace in radians a second: slow.
 */
export const STARS_LOOK = {
  rest: 0.3,
  pointed: 1,
  size: 0.085,
  maxSize: 64,
  depth: [1.6, 5],
  core: palette.cream,
  halo: [0.3, 0.6],
  intensity: 0.75,
  line: { colour: palette.gold, level: 0.28 },
  mirror: { opacity: 0.25, fade: 0.06 },
  twinkle: { share: 0.4, depth: 0.35, rate: [0.5, 1.5] }
} as const;

/** The draw order of the reflections' groups: before anything at the default order, the glass among it, which then lies over them. */
const MIRROR_RENDER_ORDER = -1;

/** The constellations as the scene holds them. */
export interface ConstellationsModel {
  /**
   * `constellations`, in the dial's frame: for each country its stars
   * (`stars:<id>`), its lines (`lines:<id>`) and its reflection
   * (`mirror:<id>`, holding `mirror:stars:<id>` and `mirror:lines:<id>`).
   */
  group: THREE.Group;
  /**
   * A constellation's glow, its stars, lines and reflection together: rest is
   * STARS_LOOK.rest, pointed STARS_LOOK.pointed. Held to 0..1; NaN reads as
   * rest. A uniform, so a frame of a fade uploads nothing else.
   */
  setGlow(id: CountryId, level: number): void;
  /** The stars' twinkle at `time` seconds, or none (reduced motion, or asleep) with `on` false. NaN reads as 0. */
  setTwinkle(time: number, on: boolean): void;
  /**
   * Where a constellation's label goes: the centroid of its stars, in the
   * group's frame. Written into `target` when one is given, as three's own
   * getters do, so a label can follow it every frame without a new vector.
   */
  anchor(id: CountryId, target?: THREE.Vector3): THREE.Vector3;
  /** Frees every geometry and material the constellations made. */
  dispose(): void;
}

/**
 * The reflection's projection, shared by the stars and the lines. The copy is
 * the constellation turned upside down about the dial's plane (its group's
 * scale.y is -1), where a mirror shows it; but it is drawn where the eye sees
 * it, on the glass: the point where the ray from the eye to the copy crosses
 * y = 0. The picture is the same, the depth is the glass's, so the needle and
 * the hub over the glass hide the reflection and the city under it does not.
 * A crossing off the glass (over the hub, or past the rim) fades out, for
 * there is no glass there to reflect anything: `uGlassEdge` holds the radii
 * the reflection fades in between (x to y) and out between (z to w).
 */
const MIRROR_GLSL = /* glsl */ `
#ifdef MIRROR
uniform vec4 uGlassEdge;
varying float vGlass;
vec3 onGlass(vec3 p) {
  // The copy's frame is the dial's turned over, so an eye above the dial is below the plane here.
  vec3 eye = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
  if (eye.y >= 0.0 || p.y <= 0.0) {
    vGlass = 0.0;
    return p;
  }
  vec3 crossing = eye + (p - eye) * (eye.y / (eye.y - p.y));
  float r = length(crossing.xz);
  vGlass = smoothstep(uGlassEdge.x, uGlassEdge.y, r) * (1.0 - smoothstep(uGlassEdge.z, uGlassEdge.w, r));
  return crossing;
}
#endif
`;

/**
 * A star: its sprite's size in pixels is its world size (by `aMag`) times the
 * projection's focal scale times half the picture's height (`uScale`) over its
 * depth, and under a pixel it is drawn at one and dimmed by the area it lacks.
 * `vSoft` is 1 at the near depth and 0 at the far. Twinkling stars (an
 * `aSeed` past the share that hold still) dim and recover slowly, each at its
 * own pace and phase.
 */
const STAR_VERTEX = /* glsl */ `
attribute float aMag;
attribute float aSeed;
uniform float uSize;
uniform float uScale;
uniform float uMaxSize;
uniform vec2 uDepth;
uniform float uTime;
uniform float uTwinkle;
uniform vec3 uTwinkleShape;
uniform vec2 uTwinkleRate;
varying float vSoft;
varying float vLight;
${MIRROR_GLSL}
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float depth = max(0.05, -mv.z);
  float size = uSize * aMag * projectionMatrix[1][1] * uScale / depth;
  vSoft = 1.0 - clamp((depth - uDepth.x) / (uDepth.y - uDepth.x), 0.0, 1.0);
  float twinkles = step(uTwinkleShape.x, aSeed);
  float pace = mix(uTwinkleRate.x, uTwinkleRate.y, fract(aSeed * 7.31));
  float dip = uTwinkle * twinkles * uTwinkleShape.y * (0.5 + 0.5 * sin(uTime * pace + aSeed * 6.2832));
  vLight = mix(0.55, 1.0, aMag) * (1.0 - dip) * min(1.0, size * size);
  gl_PointSize = clamp(size, 1.0, uMaxSize);
#ifdef MIRROR
  gl_Position = projectionMatrix * modelViewMatrix * vec4(onGlass(position), 1.0);
#else
  gl_Position = projectionMatrix * mv;
#endif
}`;

/**
 * A star's sprite: a cream core, wider and softer on a near star, in a halo
 * of its country's tint that falls to nothing at the sprite's edge; added to
 * what is behind it.
 */
const STAR_FRAGMENT = /* glsl */ `
uniform vec3 uTint;
uniform vec3 uCore;
uniform vec2 uHalo;
uniform float uGlow;
uniform float uIntensity;
uniform float uOpacity;
varying float vSoft;
varying float vLight;
#ifdef MIRROR
varying float vGlass;
#endif
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d >= 1.0) discard;
  float radius = mix(0.26, 0.42, vSoft);
  float core = 1.0 - smoothstep(radius * mix(0.5, 0.1, vSoft), radius, d);
  float halo = 1.0 - d;
  halo *= halo;
  vec3 light = mix(uTint, uCore, core) * (core + halo * mix(uHalo.x, uHalo.y, vSoft));
  float level = uGlow * uIntensity * uOpacity * vLight;
#ifdef MIRROR
  level *= vGlass;
#endif
  gl_FragColor = vec4(light * level, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const LINE_VERTEX = /* glsl */ `
${MIRROR_GLSL}
void main() {
#ifdef MIRROR
  gl_Position = projectionMatrix * modelViewMatrix * vec4(onGlass(position), 1.0);
#else
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
#endif
}`;

const LINE_FRAGMENT = /* glsl */ `
uniform vec3 uLine;
uniform float uGlow;
uniform float uOpacity;
#ifdef MIRROR
varying float vGlass;
#endif
void main() {
  float level = uGlow * uOpacity;
#ifdef MIRROR
  level *= vGlass;
#endif
  gl_FragColor = vec4(uLine * level, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** `x` held to [0, 1]; NaN reads as the resting glow. */
function glowLevel(x: number): number {
  if (Number.isNaN(x)) return STARS_LOOK.rest;
  return x > 0 ? (x < 1 ? x : 1) : 0;
}

/** One country's parts. */
interface Figure {
  glow: THREE.IUniform<number>;
  centroid: THREE.Vector3;
  geometries: THREE.BufferGeometry[];
  materials: THREE.ShaderMaterial[];
}

/**
 * Builds the three constellations at rest (STARS_LOOK.rest), not twinkling.
 * Each country has one buffer of stars and one of lines, which its reflection
 * draws as well, and four materials sharing that country's glow: stars, lines,
 * and the two of the reflection.
 */
export function buildConstellations(): ConstellationsModel {
  const look = STARS_LOOK;
  const group = new THREE.Group();
  group.name = 'constellations';

  // What every star shares: the clock, the picture's size, the sprite's shape.
  const shared = {
    uSize: { value: look.size },
    uScale: { value: 450 },
    uMaxSize: { value: look.maxSize },
    uDepth: { value: new THREE.Vector2(look.depth[0], look.depth[1]) },
    uTime: { value: 0 },
    uTwinkle: { value: 0 },
    uTwinkleShape: { value: new THREE.Vector3(1 - look.twinkle.share, look.twinkle.depth, 0) },
    uTwinkleRate: { value: new THREE.Vector2(look.twinkle.rate[0], look.twinkle.rate[1]) },
    uHalo: { value: new THREE.Vector2(look.halo[0], look.halo[1]) },
    uCore: { value: new THREE.Color(look.core) },
    uIntensity: { value: look.intensity },
    uLine: { value: new THREE.Color(look.line.colour).multiplyScalar(look.line.level) }
  };
  const glassEdge = { value: new THREE.Vector4(GLASS_INNER - look.mirror.fade, GLASS_INNER, GLASS_OUTER - look.mirror.fade, GLASS_OUTER) };

  // A sprite's size in pixels needs the picture's height, whatever it is drawn into (the screen or the post chain's buffer).
  const viewport = new THREE.Vector4();
  const measure = (renderer: THREE.WebGLRenderer): void => {
    renderer.getCurrentViewport(viewport);
    if (viewport.w > 0) shared.uScale.value = viewport.w / 2;
  };

  const figures = new Map<CountryId, Figure>();
  COUNTRY_IDS.forEach((id, country) => {
    const figure = FIGURES[id];
    const positions = starPositions(id);
    const n = figure.stars.length;

    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeometry.setAttribute('aMag', new THREE.BufferAttribute(new Float32Array(figure.stars.map(([, , mag]) => mag)), 1));
    // A fixed seed per star (the golden ratio's steps), so which stars twinkle, and how, is the same on every visit.
    starGeometry.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(n).map((_, k) => (k * 0.618034 + country * 0.31) % 1), 1));
    starGeometry.computeBoundingSphere();

    const linePositions = new Float32Array(figure.lines.length * 6);
    figure.lines.forEach(([a, b], k) => {
      linePositions.set(positions.subarray(a * 3, a * 3 + 3), k * 6);
      linePositions.set(positions.subarray(b * 3, b * 3 + 3), k * 6 + 3);
    });
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    lineGeometry.computeBoundingSphere();

    const glow = { value: look.rest };
    const tint = { value: new THREE.Color(countryDirection(id).accent) };
    const starMaterial = (mirror: boolean): THREE.ShaderMaterial =>
      new THREE.ShaderMaterial({
        name: `${mirror ? 'mirror:' : ''}stars:${id}`,
        defines: mirror ? { MIRROR: '' } : {},
        uniforms: { ...shared, uGlow: glow, uTint: tint, uOpacity: { value: mirror ? look.mirror.opacity : 1 }, uGlassEdge: glassEdge },
        vertexShader: STAR_VERTEX,
        fragmentShader: STAR_FRAGMENT,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
    const lineMaterial = (mirror: boolean): THREE.ShaderMaterial =>
      new THREE.ShaderMaterial({
        name: `${mirror ? 'mirror:' : ''}lines:${id}`,
        defines: mirror ? { MIRROR: '' } : {},
        uniforms: { uLine: shared.uLine, uGlow: glow, uOpacity: { value: mirror ? look.mirror.opacity : 1 }, uGlassEdge: glassEdge },
        vertexShader: LINE_VERTEX,
        fragmentShader: LINE_FRAGMENT,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });

    const materials = [starMaterial(false), lineMaterial(false), starMaterial(true), lineMaterial(true)];
    const stars = new THREE.Points(starGeometry, materials[0]);
    stars.name = `stars:${id}`;
    stars.onBeforeRender = measure;
    const lines = new THREE.LineSegments(lineGeometry, materials[1]);
    lines.name = `lines:${id}`;

    const mirror = new THREE.Group();
    mirror.name = `mirror:${id}`;
    mirror.scale.y = -1;
    mirror.renderOrder = MIRROR_RENDER_ORDER;
    const mirrorStars = new THREE.Points(starGeometry, materials[2]);
    mirrorStars.name = `mirror:stars:${id}`;
    mirrorStars.onBeforeRender = measure;
    const mirrorLines = new THREE.LineSegments(lineGeometry, materials[3]);
    mirrorLines.name = `mirror:lines:${id}`;
    mirror.add(mirrorStars, mirrorLines);

    group.add(stars, lines, mirror);

    const centroid = new THREE.Vector3();
    for (let k = 0; k < n; k++) centroid.add(new THREE.Vector3().fromArray(positions, k * 3));
    centroid.divideScalar(n);
    figures.set(id, { glow, centroid, geometries: [starGeometry, lineGeometry], materials });
  });

  /** The figure for `id`, which every country has. */
  const figureOf = (id: CountryId): Figure => figures.get(id)!;

  return {
    group,
    setGlow(id, level) {
      figureOf(id).glow.value = glowLevel(level);
    },
    setTwinkle(time, on) {
      shared.uTime.value = Number.isFinite(time) ? time : 0;
      shared.uTwinkle.value = on ? 1 : 0;
    },
    anchor(id, target = new THREE.Vector3()) {
      return target.copy(figureOf(id).centroid);
    },
    dispose() {
      for (const figure of figures.values()) {
        for (const geometry of figure.geometries) geometry.dispose();
        for (const material of figure.materials) material.dispose();
      }
    }
  };
}
