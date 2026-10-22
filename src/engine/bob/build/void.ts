/**
 * The void as one three.js object: the dark space under the glass that the camera dives into, and where the project
 * beads float (spec §2.3, §2.4 and §7). Its parts are the Blender preview's (tools/blender/bob_scroll.py, "the void
 * below the tunnel"), in the site's frame (Blender's (x, y, z) is three's (x, z, -y)): the ceiling, which is the
 * glass's underside; the circuit traces under it; a gold ring at the hole's rim; the faint violet haze; the drifting
 * gold dust; and the build's own addition, a soft beam of light falling from the opening (spec §2.4: "the build adds
 * depth layers of mist and a soft beam of light falling from the opening"). The preview's haze is a volume and its
 * dust a scatter of emissive spheres; here the haze is layered soft sprites (as the smoke over the glass is,
 * ~/engine/bob/build/smoke) and the dust is one `Points` draw. No React: the Void (Task 11) mounts the group, poses
 * the light from the journey and drifts the haze and the dust with `setTime`.
 *
 * The void is the background and the beads are the focus (Bob: dark, calm, one focal point), so everything here
 * is faint, and nothing in it writes depth where a bead could be hidden by it. The only parts that write depth
 * are the opaque ceiling and its ring, which lie behind every bead, from every camera in the void.
 *
 * The group lies at the world's origin and must be hidden (`group.visible = false`) while the camera is on the rise
 * and has not yet dived: it is built for a camera in or just above the opening. Above the glass, on the high tier, the
 * floor lets 12 % of what lies under it through (GLASS_LOOK.reflection), and the void's traces and dust would show
 * there as a second set under the glass.
 */
import * as THREE from 'three';
import { GLASS_LOOK } from '~/engine/bob/build/glassFloor';
import { buildTraces, TRACES_RENDER_ORDER } from '~/engine/bob/build/traces';
import { traceLayout } from '~/engine/bob/traces';
import { WORDMARK } from '~/engine/bob/wordmark';
import { palette } from '~/engine/palette';
import { lowerTier, type QualityTier } from '~/engine/quality';
import { glowTexture, random, smokeTexture } from '~/engine/studio/noise';

/**
 * How the void looks and moves, in metres and seconds. These are starting values, from the preview and then taken
 * down for the site's rule (dark, calm, one focal point: the haze is faint, the beam dim, the ceiling near-black);
 * the proof harness's luminance gate (LUMA_GATE: home <= 0.11 mean, at most 0.4 % clipped) is the judge of them, and
 * the first to turn down.
 *
 * - `ceiling`: the glass's underside, an annulus from the hole out to the floor's reach, at the foot of the tunnel
 *   (`GLASS_LOOK.well.bottom`, the preview's WELL_BOTTOM), the glass's own numbers so the two stay one slab. It is
 *   the floor's near-black glass (`roughness`, and the `specular` that keeps its grazing reflection to 5 %), one
 *   ring of `segments` sides to match the well's wall above it. It faces down and is single-sided, so from above (the
 *   dive's first half) it is not there and the void shows through the hole.
 * - `traces`: the glass's own trace layout (~/engine/bob/traces) laid under the ceiling in the gold, at `level` of
 *   it (`TracesModel.setLevel`'s units): the preview's 0.35 emission, against 0.65 under the home's glass, which
 *   the floor's 88 % dims to a tenth of the brightness these are seen in.
 * - `ring`: the preview's `bob_ceiling_ring`, a `tube` radius gold ring `radius` round the axis (the hole and 0.05)
 *   `drop` under the ceiling, in the gold of the lip round the home's opening (GLASS_LOOK.lip: colour, emissive).
 * - `mist`: `layers` of sprites in the haze (`colour` times `dim`), `puffs` each, the high tier's three layers
 *   at the depths `z` (z is the camera's way forward in the void: behind the farthest bead, at z -13, so the haze is
 *   the beads' backdrop and never lies over one), the puffs across `x` and within `y` (bottom, top, under the
 *   ceiling), `width` by `height` each (a layer far wider than tall, not a ball), `opacity` each at light 1 (faint),
 *   swaying `sway` along x and z once round every `period` seconds, and breathing up to `breathe` of their
 *   opacity down and back twice a period. Medium keeps the two nearest layers; low none. `seed`: the scatter.
 * - `dust`: gold points, `count` by tier, the first of one seeded scatter in `box` (the preview's, taken in the
 *   site's frame, with the top 0.6 under the ceiling; drift is taken off its edges) but never within `avoid.radius` of
 *   the camera's way (the preview's two segments, down the opening and out of it: "where it would blow up
 *   into bokeh"), each `size` across at one metre, in the gold light times `dim` at `opacity`. Each drifts a
 *   little (`drift.amplitude` is the furthest it strays, a share of it per axis) once round every
 *   `drift.period` seconds, so it never moves faster than a few centimetres a second.
 * - `beam`: a cone from the opening (the hole's radius at the ceiling) widening to `reach` over `length` below it,
 *   in the gold light times `dim` at `opacity` when `setLight`'s beam is 1. Its edge fades with how squarely a
 *   face looks at the camera (to the power `edge`) so it has no outline, and its light with the power
 *   `fall` of how far from the opening, so it dies out in the dark below. Measured in a scratch render (1280x720, the
 *   journey's overview shot, stand-in beads, the renderer's own tone mapping, no post chain): the beam at 0.12 filled
 *   the picture with a brown haze (mean luma 0.066) and was taken down to 0.04; with it, the mist and the dust all
 *   lit and no beads the void's mean luma is 0.028 (0.002 with the light off), against the gate's 0.11 for a home still.
 */
export const VOID_LOOK = {
  ceiling: {
    y: GLASS_LOOK.well.bottom,
    inner: WORDMARK.hole,
    outer: GLASS_LOOK.floor.outer,
    segments: GLASS_LOOK.segments,
    colour: GLASS_LOOK.floor.colour,
    roughness: GLASS_LOOK.floor.roughness,
    specular: GLASS_LOOK.floor.specular
  },
  traces: { level: 0.35 },
  ring: { radius: WORDMARK.hole + 0.05, tube: 0.02, drop: 0.01, tubeSegments: 12, metalness: 0.9, roughness: 0.25 },
  mist: {
    colour: palette.haze,
    dim: 0.7,
    layers: { high: 3, medium: 2, low: 0 },
    puffs: 3,
    z: [-15, -23, -33],
    x: 24,
    y: [-14, -3],
    width: [18, 30],
    height: [6, 10],
    opacity: [0.05, 0.1],
    sway: { x: 1.5, z: 0.5 },
    period: 60,
    breathe: 0.25,
    seed: 1033
  },
  dust: {
    count: { high: 400, medium: 200, low: 60 },
    box: { x: [-16, 16], y: [-18, GLASS_LOOK.well.bottom - 0.6], z: [-26, 8] },
    avoid: {
      radius: 2.2,
      path: [
        [
          [0, 2, 0],
          [0, -3, 0]
        ],
        [
          [0, -2.6, 0],
          [0, -5.5, 4]
        ]
      ]
    },
    size: 0.08,
    colour: palette.goldLight,
    dim: 0.45,
    opacity: 0.6,
    drift: { amplitude: [0.3, 0.9], period: 90 },
    seed: 7
  },
  beam: { colour: palette.goldLight, dim: 0.5, opacity: 0.04, reach: 8, length: 18, segments: 64, edge: 1.5, fall: 1.6 }
} as const;

/**
 * The haze's draw order (mist, dust and beam): before the default, so a bead's glass, which draws at the default
 * order, lies over the haze that is behind it; and the haze, which writes no depth, never lies over a glass that is
 * in front of it. The void's group has no order of its own. The ceiling draws one before the traces
 * (`TRACES_RENDER_ORDER`, which draw without a depth test and so would be painted over by a slab that came after).
 */
export const VOID_HAZE_ORDER = -1;

/** The void as the scene holds it. */
export interface VoidModel {
  /**
   * `void`: the parts `void:ceiling`, `void:traces` (its lines `void:traces:lines`), `void:ring`, `void:mist` (the
   * sprites `void:mist:<i>`, each with its layer in `userData.layer`), `void:dust` and `void:beam`, in that order.
   * Nothing in it takes a ray. It builds dark: the beam and the mist are off until `setLight`.
   */
  group: THREE.Group;
  /**
   * Lights the beam and the mist, each 0..1 (held to it; NaN reads as 0): the beam's opacity is its look's times
   * `beam`, the mist's puffs are theirs times `mist`. At 0 a part has opacity 0 and is not drawn.
   */
  setLight(beam: number, mist: number): void;
  /** Drifts the mist and the dust to where they are at `t` seconds (NaN reads as 0); the same time is the same picture. */
  setTime(t: number): void;
  /**
   * Steps the void down to `tier`'s (the quality ladder's step, Ruling 25), as a void built for it would be: the mist
   * sheds the layers the tier lacks, freeing their materials (and the texture, with the last), and the dust draws
   * fewer of its points. A tier above the one it stands at changes nothing: the ladder never climbs back.
   */
  setTier(tier: QualityTier): void;
  /** Frees every geometry, material and texture the void made; the sprites' quad is three's own. */
  dispose(): void;
}

/** One puff of mist: where it rests, its size and opacity, and its phases round the period. */
interface Puff {
  layer: number;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  opacity: number;
  rotation: number;
  phase: [x: number, z: number, breathe: number];
}

/** `x` held to [0, 1]; NaN reads as 0. */
function clamp01(x: number): number {
  return x > 0 ? (x < 1 ? x : 1) : 0;
}

/** `a` and `b` mixed: `a` at `t` = 0 and `b` at `t` = 1. */
function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** A number as a GLSL float literal, to three places. */
function glsl(n: number): string {
  return n.toFixed(3);
}

/** Nothing: the void's objects ignore the pointer, so a bead behind the haze is still the one that is picked. */
function ignoreRays(object: THREE.Object3D): void {
  object.raycast = () => {};
}

/**
 * Every puff of the full set (the high tier's layers), seeded. Each layer lies at its own depth and its puffs share
 * the width between them, each somewhere in its own share, so a layer covers the width without lumps or gaps; a
 * puff's sway is taken off the edges first, so it never drifts out.
 */
function puffs(): Puff[] {
  const look = VOID_LOOK.mist;
  const next = random(look.seed);
  const reach = look.x - look.sway.x;
  const span = look.y[1] - look.y[0];
  const out: Puff[] = [];
  for (let layer = 0; layer < look.layers.high; layer++) {
    for (let j = 0; j < look.puffs; j++) {
      const height = mix(look.height[0], look.height[1], next());
      out.push({
        layer,
        x: -reach + ((j + 0.2 + 0.6 * next()) / look.puffs) * 2 * reach,
        y: look.y[0] + height / 2 + next() * (span - height),
        z: look.z[layer]!,
        width: mix(look.width[0], look.width[1], next()),
        height,
        opacity: mix(look.opacity[0], look.opacity[1], next()),
        rotation: next() < 0.5 ? 0 : Math.PI,
        phase: [next() * 2 * Math.PI, next() * 2 * Math.PI, next() * 2 * Math.PI]
      });
    }
  }
  return out;
}

/** The distance from the point (`x`, `y`, `z`) to the segment from `a` to `b`. */
function distanceToSegment(x: number, y: number, z: number, a: readonly number[], b: readonly number[]): number {
  const abx = b[0]! - a[0]!;
  const aby = b[1]! - a[1]!;
  const abz = b[2]! - a[2]!;
  const apx = x - a[0]!;
  const apy = y - a[1]!;
  const apz = z - a[2]!;
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby + apz * abz) / (abx * abx + aby * aby + abz * abz)));
  return Math.hypot(apx - abx * t, apy - aby * t, apz - abz * t);
}

/** The dust's cloud: where each point rests, how far it strays, and its phases round the period. */
interface Cloud {
  rest: Float64Array;
  amplitude: Float64Array;
  phase: Float64Array;
}

/**
 * The first `count` points of the dust's one seeded scatter, so a lower tier's dust is the higher tier's thinned. A
 * point rests in the box less the drift's furthest stray, and never within `avoid.radius` of the camera's way less
 * that stray, so a drifting point is in the box and off the way at every moment.
 */
function cloud(count: number): Cloud {
  const look = VOID_LOOK.dust;
  const next = random(look.seed);
  const rest = new Float64Array(count * 3);
  const amplitude = new Float64Array(count);
  const phase = new Float64Array(count * 3);
  const stray = look.drift.amplitude[1];
  const clear = look.avoid.radius + stray;
  const axes = [look.box.x, look.box.y, look.box.z] as const;
  let placed = 0;
  // The scatter is sparse around the way, so it finds each point in a few tries; the cap only bounds a bad edit.
  for (let tries = 0; placed < count && tries < count * 100; tries++) {
    const p = axes.map((axis) => mix(axis[0] + stray, axis[1] - stray, next()));
    if (look.avoid.path.some(([a, b]) => distanceToSegment(p[0]!, p[1]!, p[2]!, a, b) < clear)) continue;
    rest.set(p, placed * 3);
    amplitude[placed] = mix(look.drift.amplitude[0], look.drift.amplitude[1], next());
    phase.set([next() * 2 * Math.PI, next() * 2 * Math.PI, next() * 2 * Math.PI], placed * 3);
    placed++;
  }
  return { rest, amplitude, phase };
}

/**
 * The beam softens its edge and fades along its length. The cone's shell, seen from the side, would end in a hard
 * line where the shell turns away; a face looking squarely at the camera is bright and one at the silhouette is not,
 * so the light thins to nothing at the outline. `vBeamAlong` is 0 at the opening and 1 at the cone's far end (the
 * geometry hangs from the origin down), and the light falls as `(1 - along)^fall`. Both stages declare the varyings
 * once; the rest of three's basic shader (the clipping planes, the tone mapping, the colour space) is as it was.
 */
function patchBeam(shader: { vertexShader: string; fragmentShader: string }): void {
  const { edge, fall, length } = VOID_LOOK.beam;
  const varyings = 'varying vec3 vBeamNormal;\nvarying vec3 vBeamView;\nvarying float vBeamAlong;';
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${varyings}`)
    .replace(
      '#include <project_vertex>',
      `#include <project_vertex>\n\tvBeamNormal = normalize( normalMatrix * normal );\n\tvBeamView = - mvPosition.xyz;\n\tvBeamAlong = clamp( - position.y / ${glsl(length)}, 0.0, 1.0 );`
    );
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${varyings}`)
    .replace(
      '#include <color_fragment>',
      `#include <color_fragment>\n\tdiffuseColor.a *= pow( abs( dot( normalize( vBeamNormal ), normalize( vBeamView ) ) ), ${glsl(edge)} ) * pow( 1.0 - vBeamAlong, ${glsl(fall)} );`
    );
}

/**
 * Builds the void for `tier`, dark (no beam, no mist) and at time 0. The mist, the dust and the beam test depth and
 * write none: a bead hides the haze behind it, and the haze in front lies faintly over it, so nothing in the void can
 * hide a bead.
 */
export function buildVoid(tier: QualityTier): VoidModel {
  const look = VOID_LOOK;
  const group = new THREE.Group();
  group.name = 'void';

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

  // The mist: layers of soft sprites, the tier's share of the full set. The low tier has none, and so no texture.
  const mist = new THREE.Group();
  mist.name = 'void:mist';
  mist.renderOrder = VOID_HAZE_ORDER;
  let standing: QualityTier = tier;
  let kept = puffs().filter((puff) => puff.layer < look.mist.layers[tier]);
  let mistTexture: THREE.DataTexture | undefined = kept.length > 0 ? smokeTexture(128, 33) : undefined;
  const mistColour = new THREE.Color(look.mist.colour).multiplyScalar(look.mist.dim);
  let sprites = kept.map((puff, i) => {
    const material = new THREE.SpriteMaterial({
      name: `void:mist:${i}`,
      map: mistTexture,
      color: mistColour,
      opacity: 0,
      rotation: puff.rotation,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      fog: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.name = `void:mist:${i}`;
    sprite.scale.set(puff.width, puff.height, 1);
    sprite.userData.layer = puff.layer;
    sprite.visible = false;
    ignoreRays(sprite);
    mist.add(sprite);
    return sprite;
  });

  // The dust: one `Points` draw of the tier's points, the lower tiers' drawn by range, not rebuilt.
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
    opacity: look.dust.opacity,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    fog: false
  });
  const points = new THREE.Points(dustGeometry, dustMaterial);
  points.name = 'void:dust';
  points.renderOrder = VOID_HAZE_ORDER;
  // The drift moves every point, and the cloud fills the void: it is not culled by a box taken before they moved.
  points.frustumCulled = false;
  ignoreRays(points);

  // The beam: an open cone hanging from the opening at the ceiling, its apex ring at the origin of its own frame.
  const beamGeometry = new THREE.CylinderGeometry(look.ceiling.inner, look.beam.reach, look.beam.length, look.beam.segments, 1, true);
  beamGeometry.translate(0, -look.beam.length / 2, 0);
  const beamMaterial = new THREE.MeshBasicMaterial({
    name: 'void:beam',
    color: new THREE.Color(look.beam.colour).multiplyScalar(look.beam.dim),
    opacity: 0,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    fog: false
  });
  beamMaterial.onBeforeCompile = patchBeam;
  beamMaterial.customProgramCacheKey = () => 'bob-void-beam';
  const beam = new THREE.Mesh(beamGeometry, beamMaterial);
  beam.name = 'void:beam';
  beam.position.y = look.ceiling.y;
  beam.renderOrder = VOID_HAZE_ORDER;
  beam.visible = false;
  ignoreRays(beam);

  group.add(ceiling, traces.group, ring, mist, points, beam);

  let beamLevel = 0;
  let mistLevel = 0;
  let seconds = 0;
  const mistOmega = (2 * Math.PI) / look.mist.period;
  const dustOmega = (2 * Math.PI) / look.dust.drift.period;
  /** A drifting point strays at most its amplitude, a share of it on each axis. */
  const perAxis = 1 / Math.sqrt(3);

  // Run on every frame the void draws: indexed loops and indexed reads, so they make no iterator.
  const poseMist = (): void => {
    const turn = mistOmega * seconds;
    for (let i = 0; i < sprites.length; i++) {
      const puff = kept[i]!;
      const phase = puff.phase;
      sprites[i]!.position.set(puff.x + Math.sin(turn + phase[0]) * look.mist.sway.x, puff.y, puff.z + Math.sin(turn + phase[1]) * look.mist.sway.z);
      // Down by at most `breathe` of the puff's opacity and back, twice round the period.
      const breath = 1 - look.mist.breathe * 0.5 * (1 - Math.sin(2 * turn + phase[2]));
      sprites[i]!.material.opacity = puff.opacity * breath * mistLevel;
      sprites[i]!.visible = mistLevel > 0;
    }
  };
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
  const poseBeam = (): void => {
    beamMaterial.opacity = look.beam.opacity * beamLevel;
    beam.visible = beamLevel > 0;
  };
  dustGeometry.setDrawRange(0, drawn);
  poseMist();
  poseDust();
  poseBeam();

  return {
    group,
    setLight(beamIn, mistIn) {
      beamLevel = clamp01(beamIn);
      mistLevel = clamp01(mistIn);
      poseBeam();
      poseMist();
    },
    setTime(t) {
      seconds = Number.isFinite(t) ? t : 0;
      poseMist();
      poseDust();
    },
    setTier(next) {
      const to = lowerTier(standing, next);
      if (to === standing) return;
      standing = to;
      const stay = kept.map((puff) => puff.layer < look.mist.layers[to]);
      for (let i = 0; i < sprites.length; i++) {
        if (stay[i]) continue;
        mist.remove(sprites[i]!);
        sprites[i]!.material.dispose();
      }
      sprites = sprites.filter((_, i) => stay[i]);
      kept = kept.filter((_, i) => stay[i]);
      if (sprites.length === 0) {
        mistTexture?.dispose();
        mistTexture = undefined;
      }
      drawn = Math.min(drawn, look.dust.count[to]);
      dustGeometry.setDrawRange(0, drawn);
      poseMist();
    },
    dispose() {
      traces.dispose();
      for (const geometry of [ceilingGeometry, ringGeometry, dustGeometry, beamGeometry]) geometry.dispose();
      for (const material of [ceilingMaterial, ringMaterial, dustMaterial, beamMaterial]) material.dispose();
      for (const sprite of sprites) sprite.material.dispose();
      mistTexture?.dispose();
      dustTexture.dispose();
    }
  };
}
