/**
 * The void as one three.js object: the dark space under the glass that the light falls into and the ring of projects
 * stands in (spec 2026-10-25-bob-light-dive-design.md). Its parts are the previs's (tools/blender/light_dive.py, "the
 * void: its mist band, more dust, clear paths"), in the site's frame (Blender's (x, y, z) is three's (x, z, -y)): the
 * ceiling, which is the glass's underside, the glass sky; the circuit traces under it; a gold ring at the hole's rim;
 * the violet mist band, a haze held to the camera at a set place on the frame; the ring of mist, the band's wisps
 * world-fixed on a cylinder round the ring's axis, which the band dissolves into at the landing; and the gold dust,
 * which streams toward the camera as the light flies on. The previs's band is a shader on a plane and its dust a
 * scatter of emissive spheres; here the band and the ring of mist are soft sprites (the shared haze,
 * ~/engine/bob/build/haze, which the smoke over the glass is too) and the dust is one `Points` draw. No React: the Void
 * (src/scene/bob/Void.tsx) mounts the group and poses it from the journey each frame.
 *
 * The void is the background and the light and the beads are the focus (Bob: dark, calm, one focal point), so
 * everything here is faint, and nothing in it writes depth where a bead could be hidden by it. The only parts that
 * write depth are the opaque ceiling and its ring, which lie behind every bead, from every camera in the void.
 *
 * The group lies at the world's origin and must be hidden (`group.visible = false`) while the camera is above the glass
 * and the glass still stands: on the high tier the floor lets 12 % of what lies under it through
 * (GLASS_LOOK.reflection), and the void's traces and dust would show there as a second set under the glass.
 */
import * as THREE from 'three';
import { GLASS_LOOK } from '~/engine/bob/build/glassFloor';
import { buildHaze, clamp01, mix } from '~/engine/bob/build/haze';
import { buildTraces, TRACES_RENDER_ORDER } from '~/engine/bob/build/traces';
import { traceLayout } from '~/engine/bob/traces';
import { WORDMARK } from '~/engine/bob/wordmark';
import { palette } from '~/engine/palette';
import { lowerTier, type QualityTier } from '~/engine/quality';
import { glowTexture, random, smokeTexture } from '~/engine/studio/noise';
import { beadRest, F, lightAt, RING, ringShot, streamAt, wayShot } from '~/scene/bob/lightDive';

/**
 * How far the dust keeps, in its own moving frame, from where the camera goes (the light dive's path on both sizes and
 * the ring camera's orbit), from where the light goes, and from the beads as they rise into the ring, m: the previs's
 * `CLEAR`. A speck the camera passed through would blow up into a disc, one on the light's path would flash past it,
 * and one inside a bead would show through its glass.
 */
export const CLEAR = { cam: 1.7, light: 0.9, bead: 1.3 } as const;

/**
 * How the void looks and moves, in metres and seconds. These are starting values, from the previs and then taken
 * down for the site's rule (dark, calm, one focal point); the proof harness's luminance gate is the judge of them.
 *
 * - `backdrop`: the void's depth, the site's night (the page's own, which the end page stands in too) on a sphere of
 *   `radius` round everything (inside the camera's far plane, 100, from wherever the void's cameras stand), seen from
 *   inside, coming in with the band: the previs's void is not black but a night.
 * - `ceiling`, `traces` and `ring`: the glass's underside, its traces and the gold ring at the hole's rim, as the dive's
 *   void had them: the glass's own numbers, so the two stay one slab.
 * - `band`: the mist band, the haze's sprites in one layer, in the haze (`colour` times `dim`), `puffs` across the frame.
 *   Its sizes are in the band's own units: x in half-widths of the frame where it hangs, y in its sigma (the fall-off
 *   of the previs's band, a share of the frame's height), so one band fits every screen; `setBand` scales it there.
 * - `ringMist`: the ring of mist, `count` sprites by tier (the first of one seeded set) on a cylinder of `radius` round
 *   the ring's axis (outside the ring camera's circle on both sizes, so the camera is always inside it), each `width`
 *   by `height`, `opacity` at full; turning once round every `turn` seconds, so the wisps drift as the band's do.
 * - `dust`: gold points, `count` by tier, the first of one seeded scatter in `box` (the previs's, in the site's frame),
 *   never within CLEAR of the paths less the drift's furthest stray; each `size` across at one metre, in the gold
 *   light times `dim` at `opacity` when its glow (`setDust`) is 1; each drifting a little (`drift.amplitude` the
 *   furthest it strays, a share of it per axis) once round every `drift.period` seconds.
 */
export const VOID_LOOK = {
  backdrop: { colour: palette.night, radius: 80, segments: [32, 16] as const, order: -100 },
  ceiling: {
    y: GLASS_LOOK.well.bottom,
    inner: WORDMARK.hole,
    outer: GLASS_LOOK.floor.outer,
    segments: GLASS_LOOK.segments,
    colour: GLASS_LOOK.floor.colour,
    roughness: 0.45,
    specular: GLASS_LOOK.floor.specular
  },
  traces: { level: 0.35 },
  ring: { radius: WORDMARK.hole + 0.05, tube: 0.02, drop: 0.01, tubeSegments: 12, metalness: 0.9, roughness: 0.25 },
  band: {
    colour: palette.haze,
    dim: 0.9,
    puffs: 7,
    box: { x: 1, y: [-2, 2] as const },
    width: [0.8, 1.2] as const,
    height: [3, 4] as const,
    opacity: [0.3, 0.45] as const,
    sway: { x: 0.06, z: 0 },
    period: 60,
    breathe: 0.25,
    seed: 1033
  },
  ringMist: {
    colour: palette.haze,
    dim: 0.9,
    radius: 20,
    count: { high: 12, medium: 8, low: 0 },
    width: [14, 20] as const,
    height: [4, 6] as const,
    opacity: [0.08, 0.14] as const,
    turn: 600,
    seed: 2027
  },
  dust: {
    count: { high: 400, medium: 200, low: 60 },
    box: { x: [-14, 14] as const, y: [-18, -1.7] as const, z: [-32, 9] as const },
    size: 0.2,
    colour: palette.goldLight,
    dim: 3,
    opacity: 0.9,
    drift: { amplitude: [0.3, 0.9] as const, period: 90 },
    seed: 7
  }
} as const;

/**
 * The haze's draw order (the band, the ring of mist and the dust): before the default, so a bead's glass, which draws
 * at the default order, lies over the haze that is behind it; and the haze, which writes no depth, never lies over a
 * glass that is in front of it. The void's group has no order of its own. The ceiling draws one before the traces
 * (`TRACES_RENDER_ORDER`, which draw without a depth test and so would be painted over by a slab that came after).
 */
export const VOID_HAZE_ORDER = -1;

/** The mist band as the journey places it on the frame (src/scene/bob/lightDive.ts `voidAt`). */
export interface BandPose {
  /** Whether the band is there at all (the journey is past the rise). */
  shown: boolean;
  /** Where its middle is on the frame, from the top, a share of the height. */
  y: number;
  /** Its fall-off, a share of the frame's height. */
  sigma: number;
  /** Its strength, 0..1. */
  strength: number;
  /** How far ahead of the camera it hangs, m (12 by default). */
  distance?: number;
}

/** The void as the scene holds it. */
export interface VoidModel {
  /**
   * `void`: the parts `void:backdrop`, `void:ceiling`, `void:traces` (its lines `void:traces:lines`), `void:ring`, `void:band` (its
   * sprites `void:band:<i>`), `void:ringMist` (its sprites `void:ringMist:<i>`) and `void:dust` (its points
   * `void:dust:points`), in that order. Nothing in it takes a ray. It builds dark: no band, no ring of mist, no dust.
   */
  group: THREE.Group;
  /**
   * Holds the mist band to `camera` (its place, turn and field, read now) at the journey's place on the frame: its middle
   * `y` of the way down the frame, `distance` ahead, as wide as the frame there and `sigma` of its height in fall-off,
   * at `strength` less what has dissolved into the ring of mist. And lays the ring of mist at the band's height: where
   * the camera's ray through the band's middle meets the cylinder.
   */
  setBand(band: BandPose, camera: THREE.Camera): void;
  /** How far the band's wisps have dissolved into the ring of mist, 0..1 (held to it; NaN reads as 0). */
  setRingMist(share: number): void;
  /** The dust's glow, 0..1 (held to it; NaN reads as 0): at 0 it is not drawn. */
  setDust(level: number): void;
  /** How far the void has streamed toward the camera, m: the dust's group moves that far along +z (NaN reads as 0). */
  setStream(metres: number): void;
  /**
   * Shows or hides the glass sky (the ceiling, its traces and its ring): out while the camera is above it, where it would
   * stand round the hole as a second rim (the previs's SKY_OBJECTS), back once the camera is under it.
   */
  setSky(shown: boolean): void;
  /** Drifts the haze and the dust to where they are at `t` seconds (NaN reads as 0); the same time is the same picture. */
  setTime(t: number): void;
  /**
   * Steps the void down to `tier`'s (the quality ladder's step), as a void built for it would be: the ring of mist
   * sheds the sprites the tier lacks, freeing their materials (and the texture, with the last), and the dust draws
   * fewer of its points. A tier above the one it stands at changes nothing: the ladder never climbs back.
   */
  setTier(tier: QualityTier): void;
  /** Frees every geometry, material and texture the void made; the sprites' quad is three's own. */
  dispose(): void;
}

/** Nothing: the void's objects ignore the pointer, so a bead behind the haze is still the one that is picked. */
function ignoreRays(object: THREE.Object3D): void {
  object.raycast = () => {};
}

/** The dust's cloud: where each point rests, how far it strays, and its phases round the period. */
interface Cloud {
  rest: Float64Array;
  amplitude: Float64Array;
  phase: Float64Array;
}

/** The sizes the light dive is checked on: a desk's and a phone's (src/scene/bob/lightDive.ts `sizeFor`). */
const SIZES = [1440 / 900, 390 / 844] as const;

/**
 * The places the dust keeps clear of, in its own frame (the stream at each frame taken off), one list per kind: the
 * camera's path down the light dive and round the ring's orbit on both sizes, the light's path, and each bead's rise
 * into the ring. Made once, on the first build.
 */
let paths: Record<keyof typeof CLEAR, Float64Array> | null = null;

function clearPaths(): Record<keyof typeof CLEAR, Float64Array> {
  if (paths) return paths;
  const cam: number[] = [];
  const light: number[] = [];
  const bead: number[] = [];
  const end = streamAt(F.END);
  for (const aspect of SIZES) {
    for (let f = 1; f <= F.END; f++) {
      const back = streamAt(f);
      const c = wayShot(f, aspect).position;
      cam.push(c[0], c[1], c[2] - back);
      const l = lightAt(f, aspect).position;
      light.push(l[0], l[1], l[2] - back);
    }
    for (let angle = 0; angle < 360; angle += 1.5) {
      const c = ringShot(angle, aspect).position;
      cam.push(c[0], c[1], c[2] - end);
    }
  }
  for (const angle of [0, 120, 240]) {
    const c = beadRest(angle);
    for (let k = 0; k <= 12; k++) bead.push(c[0], c[1] - (RING.rise * k) / 12, c[2] - end);
  }
  paths = { cam: Float64Array.from(cam), light: Float64Array.from(light), bead: Float64Array.from(bead) };
  return paths;
}

/** Whether (`x`, `y`, `z`) lies nearer than `clear` to any point of `path`. */
function near(path: Float64Array, x: number, y: number, z: number, clear: number): boolean {
  const c2 = clear * clear;
  for (let i = 0; i < path.length; i += 3) {
    const dx = x - path[i]!;
    const dy = y - path[i + 1]!;
    const dz = z - path[i + 2]!;
    if (dx * dx + dy * dy + dz * dz < c2) return true;
  }
  return false;
}

/**
 * The first `count` points of the dust's one seeded scatter, so a lower tier's dust is the higher tier's thinned. A
 * point rests in the box less the drift's furthest stray, and never within CLEAR (plus that stray) of the paths, so a
 * drifting point is in the box and clear of them at every moment.
 */
function cloud(count: number): Cloud {
  const look = VOID_LOOK.dust;
  const way = clearPaths();
  const next = random(look.seed);
  const rest = new Float64Array(count * 3);
  const amplitude = new Float64Array(count);
  const phase = new Float64Array(count * 3);
  const stray = look.drift.amplitude[1];
  const axes = [look.box.x, look.box.y, look.box.z] as const;
  let placed = 0;
  // The scatter is sparse around the paths, so it finds each point in a few tries; the cap only bounds a bad edit.
  for (let tries = 0; placed < count && tries < count * 100; tries++) {
    const x = mix(axes[0][0] + stray, axes[0][1] - stray, next());
    const y = mix(axes[1][0] + stray, axes[1][1] - stray, next());
    const z = mix(axes[2][0] + stray, axes[2][1] - stray, next());
    if (near(way.cam, x, y, z, CLEAR.cam + stray) || near(way.light, x, y, z, CLEAR.light + stray) || near(way.bead, x, y, z, CLEAR.bead + stray)) continue;
    rest.set([x, y, z], placed * 3);
    amplitude[placed] = mix(look.drift.amplitude[0], look.drift.amplitude[1], next());
    phase.set([next() * 2 * Math.PI, next() * 2 * Math.PI, next() * 2 * Math.PI], placed * 3);
    placed++;
  }
  return { rest, amplitude, phase };
}

// Scratch for the band's placement: nothing is made per frame.
const camAt = new THREE.Vector3();
const camTurn = new THREE.Quaternion();
const ahead = new THREE.Vector3();
const upward = new THREE.Vector3();
const ray = new THREE.Vector3();

/**
 * Builds the void for `tier`, dark (no band, no ring of mist, no dust) and at time 0. The haze and the dust test depth
 * and write none, and draw before the beads' glass (`VOID_HAZE_ORDER`): an opaque bead hides the haze behind it, a
 * bead's glass is painted over the haze whether it is behind or in front, and nothing in the void can hide a bead.
 */
export function buildVoid(tier: QualityTier): VoidModel {
  const look = VOID_LOOK;
  const group = new THREE.Group();
  group.name = 'void';

  // The backdrop: the night round everything, seen from inside, behind all of it, never in the way. Added to what is
  // there (the black it stands in, and the haze in front, which three may draw before it), so it lifts the dark into the
  // night and paints over nothing.
  const backdropGeometry = new THREE.SphereGeometry(look.backdrop.radius, look.backdrop.segments[0], look.backdrop.segments[1]);
  const backdropMaterial = new THREE.MeshBasicMaterial({
    name: 'void:backdrop',
    color: look.backdrop.colour,
    side: THREE.BackSide,
    transparent: true,
    blending: THREE.AdditiveBlending,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
    fog: false
  });
  const backdrop = new THREE.Mesh(backdropGeometry, backdropMaterial);
  backdrop.name = 'void:backdrop';
  backdrop.renderOrder = look.backdrop.order;
  backdrop.frustumCulled = false;
  backdrop.visible = false;
  ignoreRays(backdrop);

  // The ceiling: the glass's ring again, turned to face down. Opaque and writing depth, so that from below it hides
  // the home above it; it draws first of the void so the traces (no depth test) lie over it.
  const ceilingGeometry = new THREE.RingGeometry(look.ceiling.inner, look.ceiling.outer, look.ceiling.segments, 1);
  ceilingGeometry.rotateX(Math.PI / 2);
  const ceilingMaterial = new THREE.MeshPhysicalMaterial({
    name: 'void:ceiling',
    color: look.ceiling.colour,
    metalness: 0,
    roughness: look.ceiling.roughness,
    specularIntensity: look.ceiling.specular
  });
  const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
  ceiling.name = 'void:ceiling';
  ceiling.position.y = look.ceiling.y;
  ceiling.renderOrder = TRACES_RENDER_ORDER - 1;
  ignoreRays(ceiling);

  // The traces: the glass's own layout, under the ceiling the way they lie under the glass.
  const traces = buildTraces(traceLayout(), true);
  traces.setLevel(look.traces.level);
  traces.group.name = 'void:traces';
  traces.group.position.y = look.ceiling.y;
  const lines = traces.group.getObjectByName('traces:lines')!;
  lines.name = 'void:traces:lines';
  ignoreRays(lines);

  // The gold ring at the hole's rim, lying flat a hair under the ceiling.
  const ringGeometry = new THREE.TorusGeometry(look.ring.radius, look.ring.tube, look.ring.tubeSegments, look.ceiling.segments);
  ringGeometry.rotateX(Math.PI / 2);
  const ringMaterial = new THREE.MeshStandardMaterial({
    name: 'void:ring',
    color: GLASS_LOOK.lip.colour,
    metalness: look.ring.metalness,
    roughness: look.ring.roughness,
    emissive: GLASS_LOOK.lip.emissive,
    emissiveIntensity: GLASS_LOOK.lip.emissiveIntensity
  });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.name = 'void:ring';
  ring.position.y = look.ceiling.y - look.ring.drop;
  ignoreRays(ring);

  // The band: the shared haze in one layer, in the band's own units (half-widths across, sigmas up), held to the camera.
  const bandHaze = buildHaze(
    {
      name: 'void:band',
      look: look.band,
      depths: [0],
      keeps: () => true,
      textureSeed: 41,
      order: VOID_HAZE_ORDER,
      level: 0,
      hideAtZero: true
    },
    tier
  );

  // The ring of mist: the first sprites of one seeded set by tier, on the cylinder, world-fixed.
  const ringGroup = new THREE.Group();
  ringGroup.name = 'void:ringMist';
  ringGroup.renderOrder = VOID_HAZE_ORDER;
  const ringLook = look.ringMist;
  const ringCount = ringLook.count[tier];
  let ringTexture: THREE.DataTexture | undefined = ringCount > 0 ? smokeTexture(128, ringLook.seed) : undefined;
  const ringColour = new THREE.Color(ringLook.colour).multiplyScalar(ringLook.dim);
  const nextRing = random(ringLook.seed);
  const ringPuffs = Array.from({ length: ringLook.count.high }, (_, i) => ({
    angle: ((i + 0.2 + 0.6 * nextRing()) / ringLook.count.high) * 2 * Math.PI,
    width: mix(ringLook.width[0], ringLook.width[1], nextRing()),
    height: mix(ringLook.height[0], ringLook.height[1], nextRing()),
    opacity: mix(ringLook.opacity[0], ringLook.opacity[1], nextRing()),
    lift: (nextRing() - 0.5) * 1.2,
    rotation: nextRing() < 0.5 ? 0 : Math.PI
  }));
  let ringSprites = ringPuffs.slice(0, ringCount).map((puff, i) => {
    const material = new THREE.SpriteMaterial({
      name: `void:ringMist:${i}`,
      map: ringTexture,
      color: ringColour,
      opacity: 0,
      rotation: puff.rotation,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      fog: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.name = `void:ringMist:${i}`;
    sprite.scale.set(puff.width, puff.height, 1);
    sprite.position.set(Math.sin(puff.angle) * ringLook.radius, puff.lift, Math.cos(puff.angle) * ringLook.radius);
    sprite.visible = false;
    ignoreRays(sprite);
    ringGroup.add(sprite);
    return sprite;
  });

  // The dust: one `Points` draw of the tier's points in a group the stream moves, the lower tiers' drawn by range.
  const dustGroup = new THREE.Group();
  dustGroup.name = 'void:dust';
  const dustCount = look.dust.count[tier];
  const dust = cloud(dustCount);
  let drawn: number = dustCount;
  const dustPositions = new THREE.BufferAttribute(new Float32Array(dustCount * 3), 3);
  dustPositions.setUsage(THREE.DynamicDrawUsage);
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', dustPositions);
  const dustTexture = glowTexture(32);
  const dustMaterial = new THREE.PointsMaterial({
    name: 'void:dust',
    map: dustTexture,
    color: new THREE.Color(look.dust.colour).multiplyScalar(look.dust.dim),
    size: look.dust.size,
    sizeAttenuation: true,
    opacity: 0,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    fog: false
  });
  const points = new THREE.Points(dustGeometry, dustMaterial);
  points.name = 'void:dust:points';
  // An object's own order (the haze's is its group's): see `VOID_HAZE_ORDER`.
  points.renderOrder = VOID_HAZE_ORDER;
  // The drift moves every point, and the cloud fills the void: it is not culled by a box taken before they moved.
  points.frustumCulled = false;
  points.visible = false;
  ignoreRays(points);
  dustGroup.add(points);

  group.add(backdrop, ceiling, traces.group, ring, bandHaze.group, ringGroup, dustGroup);

  let seconds = 0;
  let bandShown = false;
  let strength = 0;
  let dissolved = 0;
  const dustOmega = (2 * Math.PI) / look.dust.drift.period;
  /** A drifting point strays at most its amplitude, a share of it on each axis. */
  const perAxis = 1 / Math.sqrt(3);

  // Run on every frame the void draws: indexed loops and indexed reads, so they make no iterator.
  const poseDust = (): void => {
    const turn = dustOmega * seconds;
    const out = dustPositions.array as Float32Array;
    for (let i = 0; i < drawn; i++) {
      const k = i * 3;
      const a = dust.amplitude[i]! * perAxis;
      out[k] = dust.rest[k]! + a * Math.sin(turn + dust.phase[k]!);
      out[k + 1] = dust.rest[k + 1]! + a * Math.sin(turn + dust.phase[k + 1]!);
      out[k + 2] = dust.rest[k + 2]! + a * Math.sin(turn + dust.phase[k + 2]!);
    }
    dustPositions.needsUpdate = true;
  };
  /** The band at its strength less what has dissolved, and the ring of mist at what has. */
  const poseHaze = (): void => {
    const level = bandShown ? strength : 0;
    backdropMaterial.opacity = level;
    backdrop.visible = level > 0;
    bandHaze.setLevel(level * (1 - dissolved));
    const ringLevel = level * dissolved;
    for (let i = 0; i < ringSprites.length; i++) {
      const sprite = ringSprites[i]!;
      sprite.material.opacity = ringPuffs[i]!.opacity * ringLevel;
      sprite.visible = ringLevel > 0;
    }
  };
  dustGeometry.setDrawRange(0, drawn);
  poseDust();
  poseHaze();

  return {
    group,
    setBand(pose, camera) {
      bandShown = pose.shown;
      strength = clamp01(pose.strength);
      const distance = pose.distance ?? 12;
      const fov = (camera as THREE.PerspectiveCamera).fov ?? 50;
      const aspect = (camera as THREE.PerspectiveCamera).aspect ?? 1;
      const halfHeight = distance * Math.tan(THREE.MathUtils.degToRad(fov / 2));
      const lift = (1 - 2 * pose.y) * halfHeight;
      camera.getWorldPosition(camAt);
      camera.getWorldQuaternion(camTurn);
      camera.getWorldDirection(ahead);
      upward.set(0, 1, 0).applyQuaternion(camTurn);
      const held = bandHaze.group;
      held.position.copy(camAt).addScaledVector(ahead, distance).addScaledVector(upward, lift);
      held.quaternion.copy(camTurn);
      held.scale.set(halfHeight * aspect, Math.max(pose.sigma, 1e-6) * 2 * halfHeight, 1);
      // The ring of mist at the band's height: where the ray through the band's middle meets the cylinder, from inside.
      ray.copy(held.position).sub(camAt).normalize();
      const a = ray.x * ray.x + ray.z * ray.z;
      if (a > 1e-6) {
        const b = camAt.x * ray.x + camAt.z * ray.z;
        const k = camAt.x * camAt.x + camAt.z * camAt.z - ringLook.radius * ringLook.radius;
        const t = (Math.sqrt(Math.max(b * b - a * k, 0)) - b) / a;
        ringGroup.position.y = camAt.y + ray.y * t;
      }
      poseHaze();
    },
    setRingMist(share) {
      dissolved = clamp01(share);
      poseHaze();
    },
    setDust(level) {
      const glow = clamp01(level);
      dustMaterial.opacity = look.dust.opacity * glow;
      points.visible = glow > 0;
    },
    setStream(metres) {
      dustGroup.position.z = Number.isFinite(metres) ? metres : 0;
    },
    setSky(shown) {
      ceiling.visible = shown;
      traces.group.visible = shown;
      ring.visible = shown;
    },
    setTime(t) {
      seconds = Number.isFinite(t) ? t : 0;
      bandHaze.setTime(seconds);
      ringGroup.rotation.y = (2 * Math.PI * seconds) / ringLook.turn;
      poseDust();
    },
    setTier(next) {
      bandHaze.setTier(next);
      const keep = Math.min(ringSprites.length, ringLook.count[lowerTier(tier, next)]);
      for (const sprite of ringSprites.slice(keep)) {
        ringGroup.remove(sprite);
        sprite.material.dispose();
      }
      ringSprites = ringSprites.slice(0, keep);
      if (ringSprites.length === 0 && ringTexture) {
        ringTexture.dispose();
        ringTexture = undefined;
      }
      drawn = Math.min(drawn, look.dust.count[lowerTier(tier, next)]);
      dustGeometry.setDrawRange(0, drawn);
      poseHaze();
    },
    dispose() {
      traces.dispose();
      for (const geometry of [backdropGeometry, ceilingGeometry, ringGeometry, dustGeometry]) geometry.dispose();
      for (const material of [backdropMaterial, ceilingMaterial, ringMaterial, dustMaterial]) material.dispose();
      bandHaze.dispose();
      for (const sprite of ringSprites) sprite.material.dispose();
      ringSprites = [];
      ringTexture?.dispose();
      ringTexture = undefined;
      dustTexture.dispose();
    }
  };
}
