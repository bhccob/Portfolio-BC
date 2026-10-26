/**
 * The falling light as one three.js object (spec 2026-10-25-bob-light-dive-design.md: the compass's needle becomes a
 * light that falls through the glass into the void, the facts riding beside it, and at the ring it becomes the needle
 * again). Its parts are the previs's (tools/blender/light_dive.py, "the light: core, shell, halo, filaments, glow"):
 * a hot core; a glassy shell, its rim bright and its face faint; a halo facing the camera; thin filaments crawling round
 * it; a tapered trail of where it passed; and a warm lamp. Gold only: the palette's gold and gold light, strong enough
 * that the tone mapping and the bloom whiten the core as the previs's AgX did. No React: the Opening (Task 8) mounts it
 * with the void and poses it from the journey each frame.
 *
 * Nothing in it writes depth or takes a ray: it is light added to what is behind (additive), so it never hides a bead
 * and the pointer picks through it. Its body (core, shell, halo, filaments) is in the light's own units, a radius of
 * 1, posed by `setPose` to the light's place, size, turn and stretch; the trail is in the world, rebuilt in place each
 * frame from the journey's points. The lamp stands apart from the body and is never hidden, only dimmed, so the
 * scene's light count stays the same from the first frame to the last (three compiles every lit material for it).
 */
import * as THREE from 'three';
import { clamp01 } from '~/engine/bob/build/haze';
import { palette } from '~/engine/palette';
import { lowerTier, type QualityTier } from '~/engine/quality';
import { glowTexture } from '~/engine/studio/noise';
import type { LightPose } from '~/scene/bob/journey';
import { filamentsAt } from '~/scene/bob/lightDive';

/** The trail tube's sides, the previs's. */
export const TRAIL_SIDES = 10;

/** The most points a trail holds: the previs's 110 frames of memory, and the light's own place. */
const TRAIL_RINGS = 111;

/**
 * How the light looks, in its own units (a radius of 1) and the palette's golds; each `level` is its strength at a glow
 * of 1, the previs's own weights taken to the site's tone mapping. Starting values, matched by eye to the mock-up's
 * frames (Task 8) and held by the harness's luminance gate (Task 13).
 * - `core`: a sphere of `radius`, flat gold light, the white-hot middle once the bloom has it.
 * - `shell`: the sphere of radius 1, its rim `rim.weight` times the face's angle to the power `rim.power`, and `rim.face`
 *   over its whole face.
 * - `halo`: a sprite `radius` across each way from the middle, the glow texture's soft fall-off.
 * - `filaments`: the journey's threads round the light, each at its brightness.
 * - `trail`: a tube `width` wide at the light, narrowing as `(1 - u)` to the power `taper` toward its tail; its light
 *   falls with its age as `(1 - u)` to the power `age` and toward its edges as the face's angle to the power `core`; gold
 *   light at its head, gold from `head` of the way on.
 * - `lamp`: a point light in gold light, `distance` its reach.
 * - `stretch`: as it becomes the needle the body is drawn out `along` times its stretch along the needle's axis (three's
 *   z: the previs's y), and thinned `across` times it across.
 */
export const LIGHT_LOOK = {
  core: { radius: 0.32, colour: palette.goldLight, level: 8, segments: [32, 16] as const },
  shell: { colour: palette.gold, level: 1.4, rim: { power: 2.2, weight: 0.85, face: 0.12 }, segments: [48, 24] as const },
  halo: { radius: 5, colour: palette.gold, level: 0.75 },
  filaments: { colour: palette.goldLight, level: 2.2 },
  trail: { width: 0.5, taper: 1.35, colour: palette.gold, headColour: palette.goldLight, head: 0.15, level: 1.6, age: 1.7, core: 1.6 },
  lamp: { colour: palette.goldLight, level: 30, distance: 12 },
  stretch: { along: 3, across: 0.65 }
} as const;

/** The light as the scene holds it. */
export interface LightModel {
  /**
   * `light`: `light:body` (`light:core`, `light:shell`, `light:halo`, `light:filaments`), `light:trail` and
   * `light:lamp`, in that order. It builds dark: the body and the trail hidden, the lamp at 0.
   */
  group: THREE.Group;
  /**
   * Poses the light at the journey's `pose` (src/scene/bob/journey.ts `LightPose`): the body at its place, `radius` in
   * size, turned by the camera's `yaw`, drawn out along the needle by its `stretch`, every part's strength times its
   * `glow` (at 0 the body and the trail are hidden, the lamp at 0); the filaments laid from its `filaments`; the trail
   * rebuilt in place from its `trail`, at its `trailLevel`. The camera is the one the frame is drawn from: the halo, a
   * sprite, faces it of itself, and the shaders read the view from it.
   */
  setPose(pose: LightPose, camera: THREE.Camera): void;
  /** Steps the light down to `tier`'s: the low tier drops the filaments, and nothing climbs back. */
  setTier(tier: QualityTier): void;
  /** Frees every geometry, material and texture the light made. */
  dispose(): void;
}

/** Nothing: the light ignores the pointer. */
function ignoreRays(object: THREE.Object3D): void {
  object.raycast = () => {};
}

/** A number as a GLSL float literal, to three places. */
function glsl(n: number): string {
  return n.toFixed(3);
}

/** Additive light that writes no depth: what every part of the light is drawn with. */
const ADDED = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, fog: false } as const;

/**
 * The shell's rim: a face looking squarely at the camera is faint and one at the silhouette bright, so it reads as a
 * glassy sphere with no hard edge. The base of the power is held to 0..1, so no fragment is ever NaN.
 */
function patchShell(shader: { vertexShader: string; fragmentShader: string }): void {
  const { power, weight, face } = LIGHT_LOOK.shell.rim;
  const varyings = 'varying vec3 vRimNormal;\nvarying vec3 vRimView;';
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${varyings}`)
    .replace('#include <project_vertex>', '#include <project_vertex>\n\tvRimNormal = normalize( normalMatrix * normal );\n\tvRimView = - mvPosition.xyz;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${varyings}`)
    .replace(
      '#include <color_fragment>',
      `#include <color_fragment>\n\tfloat rimFacing = clamp( abs( dot( normalize( vRimNormal ), normalize( vRimView ) ) ), 0.0, 1.0 );\n\tdiffuseColor.a *= ${glsl(weight)} * pow( clamp( 1.0 - rimFacing, 0.0, 1.0 ), ${glsl(power)} ) + ${glsl(face)};`
    );
}

/**
 * The trail's light: gold light at its head turning gold `head` of the way back, falling with its age (`aAge`, 0 at the
 * light, 1 at its tail) and toward the tube's edges, so it is a soft streak with no outline.
 */
function patchTrail(uniforms: { uHead: THREE.IUniform<THREE.Color> }) {
  return (shader: { uniforms: Record<string, THREE.IUniform>; vertexShader: string; fragmentShader: string }): void => {
    const { age, core, head } = LIGHT_LOOK.trail;
    shader.uniforms.uHead = uniforms.uHead;
    const varyings = 'varying vec3 vTrailNormal;\nvarying vec3 vTrailView;\nvarying float vTrailAge;';
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nattribute float aAge;\n${varyings}`)
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\n\tvTrailNormal = normalize( normalMatrix * normal );\n\tvTrailView = - mvPosition.xyz;\n\tvTrailAge = aAge;'
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform vec3 uHead;\n${varyings}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>\n\tfloat trailAge = clamp( vTrailAge, 0.0, 1.0 );\n\tdiffuseColor.rgb = mix( uHead, diffuseColor.rgb, smoothstep( 0.0, ${glsl(head)}, trailAge ) );\n\tfloat trailFacing = clamp( abs( dot( normalize( vTrailNormal ), normalize( vTrailView ) ) ), 0.0, 1.0 );\n\tdiffuseColor.a *= pow( clamp( 1.0 - trailAge, 0.0, 1.0 ), ${glsl(age)} ) * pow( trailFacing, ${glsl(core)} );`
      );
  };
}

// Scratch for the trail's frames: nothing is made per frame.
const tangent = new THREE.Vector3();
const normal = new THREE.Vector3();
const binormal = new THREE.Vector3();
const aside = new THREE.Vector3();
const a = new THREE.Vector3();
const b = new THREE.Vector3();

/** Builds the light for `tier`, dark. */
export function buildLight(tier: QualityTier): LightModel {
  const look = LIGHT_LOOK;
  let standing: QualityTier = tier;
  const group = new THREE.Group();
  group.name = 'light';
  const body = new THREE.Group();
  body.name = 'light:body';
  body.visible = false;

  const coreGeometry = new THREE.SphereGeometry(look.core.radius, look.core.segments[0], look.core.segments[1]);
  const coreMaterial = new THREE.MeshBasicMaterial({ name: 'light:core', color: look.core.colour, ...ADDED });
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  core.name = 'light:core';

  const shellGeometry = new THREE.SphereGeometry(1, look.shell.segments[0], look.shell.segments[1]);
  const shellMaterial = new THREE.MeshBasicMaterial({ name: 'light:shell', color: look.shell.colour, ...ADDED });
  shellMaterial.onBeforeCompile = patchShell;
  shellMaterial.customProgramCacheKey = () => 'bob-light-shell';
  const shell = new THREE.Mesh(shellGeometry, shellMaterial);
  shell.name = 'light:shell';

  const haloTexture = glowTexture(64);
  const haloMaterial = new THREE.SpriteMaterial({ name: 'light:halo', map: haloTexture, color: look.halo.colour, ...ADDED });
  const halo = new THREE.Sprite(haloMaterial);
  halo.name = 'light:halo';
  halo.scale.set(2 * look.halo.radius, 2 * look.halo.radius, 1);

  // The filaments: one draw of every thread's segments, each vertex's strength a grey on the material's gold.
  const filamentCount = filamentsAt(1).length;
  const filamentPoints = filamentsAt(1)[0]!.points.length;
  const segments = filamentCount * (filamentPoints - 1);
  const filamentPositions = new THREE.BufferAttribute(new Float32Array(segments * 2 * 3), 3);
  filamentPositions.setUsage(THREE.DynamicDrawUsage);
  const filamentColours = new THREE.BufferAttribute(new Float32Array(segments * 2 * 3), 3);
  filamentColours.setUsage(THREE.DynamicDrawUsage);
  const filamentGeometry = new THREE.BufferGeometry();
  filamentGeometry.setAttribute('position', filamentPositions);
  filamentGeometry.setAttribute('color', filamentColours);
  const filamentMaterial = new THREE.LineBasicMaterial({ name: 'light:filaments', color: look.filaments.colour, vertexColors: true, ...ADDED });
  const filaments = new THREE.LineSegments(filamentGeometry, filamentMaterial);
  filaments.name = 'light:filaments';
  filaments.frustumCulled = false;

  // The trail: a tube of TRAIL_RINGS rings at most, its places, normals and ages written in place each frame.
  const trailPositions = new THREE.BufferAttribute(new Float32Array(TRAIL_RINGS * TRAIL_SIDES * 3), 3);
  trailPositions.setUsage(THREE.DynamicDrawUsage);
  const trailNormals = new THREE.BufferAttribute(new Float32Array(TRAIL_RINGS * TRAIL_SIDES * 3), 3);
  trailNormals.setUsage(THREE.DynamicDrawUsage);
  const trailAges = new THREE.BufferAttribute(new Float32Array(TRAIL_RINGS * TRAIL_SIDES), 1);
  trailAges.setUsage(THREE.DynamicDrawUsage);
  const index: number[] = [];
  for (let i = 0; i < TRAIL_RINGS - 1; i++) {
    for (let s = 0; s < TRAIL_SIDES; s++) {
      const s1 = (s + 1) % TRAIL_SIDES;
      const p = i * TRAIL_SIDES;
      const q = (i + 1) * TRAIL_SIDES;
      index.push(p + s, p + s1, q + s1, p + s, q + s1, q + s);
    }
  }
  const trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute('position', trailPositions);
  trailGeometry.setAttribute('normal', trailNormals);
  trailGeometry.setAttribute('aAge', trailAges);
  trailGeometry.setIndex(index);
  trailGeometry.setDrawRange(0, 0);
  const trailUniforms = { uHead: { value: new THREE.Color(look.trail.headColour) } };
  const trailMaterial = new THREE.MeshBasicMaterial({ name: 'light:trail', color: look.trail.colour, side: THREE.DoubleSide, ...ADDED });
  trailMaterial.userData.uniforms = trailUniforms;
  trailMaterial.onBeforeCompile = patchTrail(trailUniforms);
  trailMaterial.customProgramCacheKey = () => 'bob-light-trail';
  const trail = new THREE.Mesh(trailGeometry, trailMaterial);
  trail.name = 'light:trail';
  trail.frustumCulled = false;
  trail.visible = false;

  const lamp = new THREE.PointLight(look.lamp.colour, 0, look.lamp.distance, 2);
  lamp.name = 'light:lamp';

  for (const part of [core, shell, halo, filaments, trail]) ignoreRays(part);
  body.add(core, shell, halo, filaments);
  group.add(body, trail, lamp);

  /** Rebuilds the trail from the journey's points at a light of `radius`: answers how many rings it laid. */
  const layTrail = (points: LightPose['trail'], radius: number): number => {
    const n = Math.min(points.length, TRAIL_RINGS);
    if (n < 2) return 0;
    const out = trailPositions.array as Float32Array;
    const normals = trailNormals.array as Float32Array;
    const ages = trailAges.array as Float32Array;
    // The first ring's frame, then each carried along the tube (parallel transport), so the tube never twists.
    for (let i = 0; i < n; i++) {
      const before = points[Math.max(i - 1, 0)]!.point;
      const after = points[Math.min(i + 1, n - 1)]!.point;
      tangent.set(after[0] - before[0], after[1] - before[1], after[2] - before[2]).normalize();
      if (i === 0) {
        normal.crossVectors(tangent, aside.set(1, 0, 0));
        if (normal.lengthSq() < 1e-6) normal.crossVectors(tangent, aside.set(0, 1, 0));
      }
      normal.addScaledVector(tangent, -normal.dot(tangent)).normalize();
      binormal.crossVectors(tangent, normal).normalize();
      const { point, u } = points[i]!;
      const ring = radius * look.trail.width * Math.pow(Math.max(1 - u, 0), look.trail.taper) + 1e-5;
      for (let s = 0; s < TRAIL_SIDES; s++) {
        const turn = (2 * Math.PI * s) / TRAIL_SIDES;
        a.copy(normal).multiplyScalar(Math.cos(turn)).addScaledVector(binormal, Math.sin(turn));
        const k = (i * TRAIL_SIDES + s) * 3;
        b.set(point[0], point[1], point[2]).addScaledVector(a, ring);
        out[k] = b.x;
        out[k + 1] = b.y;
        out[k + 2] = b.z;
        normals[k] = a.x;
        normals[k + 1] = a.y;
        normals[k + 2] = a.z;
        ages[i * TRAIL_SIDES + s] = u;
      }
    }
    trailPositions.needsUpdate = true;
    trailNormals.needsUpdate = true;
    trailAges.needsUpdate = true;
    return n;
  };

  /** Lays the filaments from the journey's threads, each segment's two ends at the thread's brightness. */
  const layFilaments = (threads: LightPose['filaments']): void => {
    const out = filamentPositions.array as Float32Array;
    const grey = filamentColours.array as Float32Array;
    let v = 0;
    for (let k = 0; k < filamentCount; k++) {
      const thread = threads[k];
      for (let i = 0; i < filamentPoints - 1; i++) {
        for (const j of [i, i + 1]) {
          const p = thread?.points[j];
          const strength = thread ? Math.max(thread.brightness, 0) : 0;
          out[v * 3] = p?.[0] ?? 0;
          out[v * 3 + 1] = p?.[1] ?? 0;
          out[v * 3 + 2] = p?.[2] ?? 0;
          grey[v * 3] = grey[v * 3 + 1] = grey[v * 3 + 2] = strength;
          v++;
        }
      }
    }
    filamentPositions.needsUpdate = true;
    filamentColours.needsUpdate = true;
  };

  return {
    group,
    setPose(pose, _camera) {
      const glow = clamp01(pose.glow);
      const lit = glow > 0;
      body.visible = lit;
      lamp.position.set(pose.position[0], pose.position[1], pose.position[2]);
      lamp.intensity = look.lamp.level * glow;
      if (!lit) {
        trail.visible = false;
        return;
      }
      const r = Math.max(pose.radius, 1e-6);
      const s = clamp01(pose.stretch);
      body.position.set(pose.position[0], pose.position[1], pose.position[2]);
      body.rotation.set(0, pose.yaw, 0);
      body.scale.set(r * (1 - look.stretch.across * s), r * (1 - look.stretch.across * s), r * (1 + look.stretch.along * s));
      coreMaterial.color.set(look.core.colour).multiplyScalar(look.core.level * glow);
      shellMaterial.color.set(look.shell.colour).multiplyScalar(look.shell.level * glow);
      haloMaterial.color.set(look.halo.colour).multiplyScalar(look.halo.level * glow);
      filaments.visible = standing !== 'low';
      if (filaments.visible) {
        filamentMaterial.color.set(look.filaments.colour).multiplyScalar(look.filaments.level * glow);
        layFilaments(pose.filaments);
      }
      const level = clamp01(pose.trailLevel) * glow * look.trail.level;
      const rings = level > 0 ? layTrail(pose.trail, r) : 0;
      trailGeometry.setDrawRange(0, Math.max(rings - 1, 0) * TRAIL_SIDES * 6);
      trail.visible = rings >= 2;
      trailMaterial.color.set(look.trail.colour).multiplyScalar(level);
      trailUniforms.uHead.value.set(look.trail.headColour).multiplyScalar(level);
    },
    setTier(next) {
      standing = lowerTier(standing, next);
      if (standing === 'low') filaments.visible = false;
    },
    dispose() {
      for (const geometry of [coreGeometry, shellGeometry, filamentGeometry, trailGeometry]) geometry.dispose();
      for (const material of [coreMaterial, shellMaterial, haloMaterial, filamentMaterial, trailMaterial]) material.dispose();
      haloTexture.dispose();
    }
  };
}
