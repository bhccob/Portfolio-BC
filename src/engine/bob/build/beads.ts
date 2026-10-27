/**
 * The three project beads as the void shows them (spec §2.4): the GLB from Blender (public/models/bob-beads.glb,
 * tools/blender/export_beads.py and the object scripts bead_funcial.py, bead_jontai.py and bead_cookies.py, whose headers
 * document every node, material, pivot and axis read here), readied for the site. Each bead gets the project's real
 * screenshot on its display, lit as part of the bead; its own light, from dim to lit (`setLit`); its porthole turned to
 * the path's camera (`setFacing`); a gentle hover (`setHover`); its object's motion (`setMotion`, the numbers of
 * ~/engine/bob/beadMotion); and for the light's path (spec 2026-10-27-bob-light-path-design.md) its fade into the dark
 * (`setFade`), its veins woken where the light has passed (`setWake`) and its object built with the scroll (`setBuild`,
 * ~/engine/bob/beadBuild); for the 3D world (spec 2026-10-27-bob-nebula-space-design.md) its float and turn (`setPose`),
 * its thick engraved gold frame and band (the file's, dressed with its light like every surface) and a thin engraved ring
 * round it in the look back (`setRings`). No React: the Void mounts the group and poses it from the journey every frame.
 *
 * The beads are the void's one focal point (Bob: dark, calm, one focal point), so a bead not in view stays dim or faded,
 * the hover only brightens a little and turns a few degrees, and every object holds still unless the scroll builds it.
 *
 * Lengths are world units, three's frame: a bead's porthole faces its root's +z and its up is +y, and its root is the
 * bead's centre (the body is a sphere of 0.95 about it).
 */
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { ProjectId } from '~/data/projects';
import {
  type CookiesMotion,
  cookiesMotion,
  type FuncialMotion,
  funcialMotion,
  type JontaiMotion,
  jontaiMotion
} from '~/engine/bob/beadMotion';
import { type BuildPose, buildPose, WAKE } from '~/engine/bob/beadBuild';
import { engravedMaterial, engravingTexture, ringGeometry } from '~/engine/bob/build/engraved';
import { palette } from '~/engine/palette';
import { lowerTier, type QualityTier } from '~/engine/quality';
import { BEADS } from '~/scene/bob/journey';

type Vec3 = readonly [number, number, number];

const DEG = Math.PI / 180;

/**
 * How the beads look. Starting values, kept low for the site's rule (dark, calm, one focal point); the proof
 * harness's luminance gate (LUMA_GATE: a void still is gated as a home still, mean <= 0.11, at most 0.4 % clipped) is
 * the judge of them, and the screen's level and the hover's brightening are the first to turn down.
 *
 * - `dim`: an unselected bead's light, as a share of its full light (`setLit(id, 0)`; `setLit(id, t)` is
 *   `mix(dim, 1, t)`, a straight line between its two ends): the floor a bead waiting ahead in the nebula is lit at
 *   (the 3D world's spec, goal 7: from its first mock-up, a black bead on the nebula reads as a hole; 0.38 there). "Its light" is all a bead's surfaces send: what they
 *   reflect of the room and the key, what the hollow's own warm light gives them, and their own glow (the veins, the gold, the screen, the objects' lights), each
 *   scaled the same, so a dim bead is the same bead in less light. Its inner light is not dimmed besides: that would
 *   dim the hollow twice.
 * - `hover`: a hovered bead's light is its light times 1 + `brighten`, and it turns toward the camera, at most `turn`
 *   (spec §2.4: "a bead turns slightly toward you and brightens a little"). The hover's amount (`setHover`) scales both,
 *   so the caller eases it in and out.
 * - `screen.level`: the screenshot's light on its display, as its emissive intensity in white, so it shows its own
 *   colours. The site's white at 0.3 sits in the bead's light (the hollow's lamp lights the parts beside it to about
 *   0.2-0.3) rather than glowing out of it: the spec's "lit as part of the bead, never a flat paste". Funcial's app
 *   screen is mostly white (a mean linear luminance of 0.9), Jontai's site dark (0.16), Cookies' between (0.5).
 * - `glass`: the porthole's glass. three's transmission costs a second render of every opaque object each frame, and
 *   nothing else in the void pays for it (the compass's bands, which do above the glass, are culled under it), so no
 *   tier's glass is transmissive. On high it has a cheap transmissive look: its reflection of the room is drawn whole
 *   over the hollow (not faded by its alpha, as a transparent surface's would be), and it hides the hollow behind it
 *   only by `high.opacity` face on, rising to its reflectance's edge (the file's specular, a quarter) at a grazing
 *   view, as glass does. Below high it is plain transparent glass at `plain.opacity`. Neither mirrors the key light
 *   (the file's near-mirror glass shows it as a hot fleck that blooms, Task 4's carry); the room's soft reflection is
 *   what reads as glass.
 * - `funcial`: the abacus beads slide `travel` up their rods (bead_funcial.py's ABACUS travel, to the top rail); the
 *   pulse runs the track at `pulse.gain` times its rest glow at its middle, `pulse.width` of the track's length wide
 *   (a Gaussian's), fading in over the first `pulse.edge` of its run and out over the last; the fifth bead, RESULT,
 *   lights in the gold light at `result.glow` as it arrives ("on focus, the fifth bead lights").
 * - `jontai.charged`: a charged cell glows this many times its rest glow (the file's, the site's glow green, dim). At
 *   12 the charged rows read as a vivid green panel in a scratch render (WebGL, a studio room, the bead lit); 8 keeps
 *   them a glow.
 */
export const BEADS_LOOK = {
  dim: 0.38,
  hover: { brighten: 0.15, turn: 8 * DEG },
  screen: { level: 0.3 },
  glass: { high: { opacity: 0.04 }, plain: { opacity: 0.1 } },
  funcial: {
    travel: 0.3,
    pulse: { gain: 1.5, width: 0.04, edge: 0.1 },
    result: { colour: palette.goldLight, glow: 0.5 }
  },
  jontai: { charged: 8 }
} as const;

/**
 * The look-back ring round each bead (the 3D world's spec, goal 8; the first mock-up's): `radius` and `width` (m), the
 * engraving `repeat` times round it, its `tilt` (radians, about x, y and z in the bead's frame), the engraved way's
 * `look` (a faint base, no glow by the light) and its fog (m, view depth).
 */
const LOOK_RING = {
  radius: 1.8,
  width: 0.05,
  repeat: 14,
  tilt: [0.22, 0, -0.12] as [number, number, number],
  look: { base: 0.5, glow: 0, reach: 1 },
  fog: [40, 90] as [number, number]
} as const;

/** Each bead's shell parts, `bead_<id>_<part>` in the GLB: the body, halo, rim, frame, band, glass, display, object slot and inner light. */
export const BEAD_PARTS = ['body', 'halo', 'rim', 'frame', 'band', 'glass', 'display', 'object', 'inner'] as const;

/** The nodes each object's motion drives (the object scripts' headers), found by name under the bead's root. */
const OBJECT_PARTS: Readonly<Record<ProjectId, readonly string[]>> = {
  funcial: ['funcial_platter', 'funcial_track', ...[1, 2, 3, 4, 5].map((k) => `funcial_bead_${k}`)],
  'jontai-energy': ['jontai_module', ...Array.from({ length: 16 }, (_, k) => `jontai_cell_${k + 1}`)],
  'cookies-clicker': [...Array.from({ length: 8 }, (_, k) => `cookies_wheel_${k + 1}`), 'cookies_balance']
};

/** The beads as the scene holds them. */
export interface BeadsModel {
  /**
   * `beads`: the three bead roots (`bead_<id>`, each with its parts as the GLB names them), each at its journey stop
   * (`BEADS`), dim, at rest and facing +z. Every part draws at render order 0, after the void's haze (-1).
   */
  group: THREE.Group;
  /** Each bead's root and its body, the lacquer shell, for the pointer's ray (the body's open front holds the cavity). */
  beads: Readonly<Record<ProjectId, { root: THREE.Object3D; body: THREE.Mesh }>>;
  /** Puts each bead's centre at its position in the group's frame (built at the journey's `BEADS`); its facing and hover turn stay on top. */
  place(positions: Readonly<Record<ProjectId, Vec3>>): void;
  /**
   * Turns bead `id`'s porthole (its +z) to `towards`, a world point (the ring's camera), its up kept on the world's up so
   * the display never rolls; `null`, or a point on the bead itself, turns it back to its rest, facing +z. The hover's turn
   * stays on top. Taken from the bead's place as it stands: after a `place`, face it again.
   */
  setFacing(id: ProjectId, towards: THREE.Vector3Like | null): void;
  /** Lights bead `id`, 0..1 (held to it, NaN as 0): `mix(BEADS_LOOK.dim, 1, t)` of its full light. */
  setLit(id: ProjectId, t: number): void;
  /**
   * Hovers bead `id` by `amount`, 0..1 (default 1; held to it, NaN as 0), and lets every other bead go; `null` lets them
   * all go. A hovered bead brightens by `amount` × `BEADS_LOOK.hover.brighten` and turns its porthole toward `towards`
   * (a world point, the camera's position) by `amount` × the smaller of 8° and how far off its axis the point is, so it
   * never turns past it. With no point it does not turn, and only brightens.
   * The amount is the caller's to ease (springs, no snapping); one bead at a time, so a hover moving to another bead
   * eases the first out before the next comes in. The turn is about the bead's centre, on top of its facing.
   */
  setHover(id: ProjectId | null, amount?: number, towards?: THREE.Vector3Like): void;
  /**
   * Poses bead `id`'s object at `time` seconds of its clock (NaN as 0), as beadMotion has it: Funcial's platter, pulse,
   * abacus and fifth bead's light; Jontai's module tilt and cells' charge; Cookies' wheels and balance. Time 0 is the
   * rest pose. Funcial's abacus and its fifth bead's light read `slide` instead where it is given (the Void
   * counts it up while the bead is selected or hovered and back down after, so the beads slide back down rather than
   * snap); the other beads have no use for it. Uniforms, intensities and transforms only, so a frame of it compiles
   * nothing.
   */
  setMotion(id: ProjectId, time: number, slide?: number): void;
  /**
   * Fades bead `id` into the dark or out of it, `fade` 0..1 (held to it, NaN as 0): every material of it draws at its
   * light times the fade's square root, so a bead coming in out of the dark is soon seen, dimly. Its parts' showing and
   * its inner light are the caller's (the Void's, which keeps the scene's light count).
   */
  setFade(id: ProjectId, fade: number): void;
  /**
   * Floats and turns bead `id` (../../../scene/bob/beadFloat.ts): its root `y` (m) above its place, and turned by
   * `yaw` (its porthole to the screen's right), `pitch` (up) and `roll` (about the porthole's own axis), radians, in
   * the frame its facing gives it, on top of its facing and under the hover's turn. Its parts go with it. All 0 is its
   * place and facing exactly; a value that is not a number is 0.
   */
  setPose(id: ProjectId, pose: { y: number; roll: number; pitch: number; yaw: number }): void;
  /**
   * Lights every bead's look-back ring (`bead_<id>_lookring`, the engraved way's engraving on a thin ring round the
   * bead, tilted a little, a child of its root so it floats and turns with it) at `level`, 0..1 (held to it, NaN as 0):
   * by its level alone, not the bead's light, fade or hover.
   */
  setRings(level: number): void;
  /**
   * The veins on bead `id`'s shell, as the light's sweep round it has woken them (spec 2026-10-27-bob-light-path-design.md,
   * 3A): the shell's emissive times `WAKE.rest` where the light has not passed, `WAKE.lit` where it has, and `hot` more
   * just behind it, by the angle round the bead's centre in the camera's view. Uniforms only: nothing compiles.
   */
  setWake(id: ProjectId, wake: BeadWake): void;
  /**
   * Builds bead `id`'s object to `b`, 0..1, as the camera goes into the bead (../beadBuild.ts `buildPose`): its motion's
   * time, Funcial's abacus rising and its beads' slide, Cookies Clicker's wheels coming together, and its screen's light.
   * Transforms, intensities and uniforms only: nothing compiles.
   */
  setBuild(id: ProjectId, b: number): void;
  /**
   * Steps the glass down to `tier`'s (the quality ladder's step), as beads built for it would have: from
   * high's cheap transmissive look to plain transparent glass, which compiles the three glasses once. A tier above the
   * one it stands at changes nothing: the ladder never climbs back within a page view.
   */
  setTier(tier: QualityTier): void;
  /**
   * Frees every material it made and its copies of the inner lights. The glTF (its geometries, materials and vein
   * maps) and the screens stay the caller's to free.
   */
  dispose(): void;
}

/**
 * The light's sweep round a bead in the camera's view (src/scene/bob/lightPath.ts `wakeSweep`): the bead's centre there
 * (x, y), the angle the sweep began at, how far it has gone (radians; 0 asleep, 2π and more all awake), its way round
 * (+1 or -1), and the glow added just behind the light (0 once it has passed).
 */
export interface BeadWake {
  centre: readonly [number, number];
  start: number;
  span: number;
  dir: 1 | -1;
  hot: number;
}

/** `x` held to [0, 1]; NaN reads as 0. */
function clamp01(x: number): number {
  return x > 0 ? (x < 1 ? x : 1) : 0;
}

/** `x` held to [0, 1] and eased in and out, 3x² - 2x³. */
function smoothstep01(x: number): number {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
}

// ---------------------------------------------------------------- the shaders' patches

/** What a bead material adds to three's physical program, once, at its first compile. */
type Dress = 'surface' | 'shell' | 'screen' | 'track' | 'glass-high' | 'glass-plain';

/**
 * `source` with its one `anchor` replaced: a three update that renames a chunk fails here, loudly, rather than
 * drawing the bead unpatched. (A function replacer, so a `$` in the GLSL is never read as a pattern.)
 */
function swap(source: string, anchor: string, replacement: string): string {
  if (!source.includes(anchor)) throw new Error(`a bead's shader has no "${anchor}" to patch: three's physical program has changed`);
  return source.replace(anchor, () => replacement);
}

/** The light every surface of a bead sends, scaled by its bead's light just before it is written. */
const SCALE_LIGHT = 'outgoingLight *= uBeadLight;\n#include <opaque_fragment>';

/** The glass sees the room, never a light: no mirror of the key, which on near-mirror glass is a hot fleck. */
const SPECULAR = 'vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;';
const SOFT_SPECULAR = 'vec3 totalSpecular = reflectedLight.indirectSpecular;';

/**
 * High's glass, drawn with ONE, ONE_MINUS_SRC_ALPHA: its reflection is added whole, and the hollow behind it is
 * dimmed by its alpha alone, its opacity face on rising to its reflectance's edge (F90, the file's specular) at a
 * grazing view, as glass hides more of what is behind it the more it mirrors.
 */
const GLASS_HIGH = [
  'float glassEdge = pow( 1.0 - saturate( dot( geometryNormal, geometryViewDir ) ), 5.0 );',
  'float glassAlpha = mix( diffuseColor.a, material.specularF90, glassEdge );',
  'gl_FragColor = vec4( ( totalSpecular + totalEmissiveRadiance ) * uBeadLight, glassAlpha );'
].join('\n');

/**
 * The screenshot is the display's emissive map, and the bezel's UV runs past 0..1 by the same map: outside the
 * screen's square the emission is masked off, its edge a pixel soft, so the screenshot's edge never smears over the
 * bezel under clamping (export_beads.py).
 */
const SCREEN_EMISSION = [
  'vec2 screenEdge = min( vEmissiveMapUv, 1.0 - vEmissiveMapUv ) / max( fwidth( vEmissiveMapUv ), vec2( 1e-5 ) );',
  '\tfloat screenInside = clamp( min( screenEdge.x, screenEdge.y ) + 0.5, 0.0, 1.0 );',
  '\ttotalEmissiveRadiance *= emissiveColor.rgb * screenInside;'
].join('\n');

/**
 * Funcial's track pulse: a Gaussian of the track's own glow along its u (0 at TP1, 1 at TP4), `uBeadPulse` its centre
 * (x), its added strength (y) and its width (z). `bead:track` has no texture, so its program has no `vUv`: the track's
 * u comes in a varying of its own.
 */
const TRACK_PULSE = [
  '#include <emissivemap_fragment>',
  '\tfloat beadPulseAt = ( vBeadTrackU - uBeadPulse.x ) / uBeadPulse.z;',
  '\ttotalEmissiveRadiance *= 1.0 + uBeadPulse.y * exp( - beadPulseAt * beadPulseAt );'
].join('\n');

/**
 * The shell's veins woken by the light's sweep (the light path mock-up's patch): the fragment's place in the camera's
 * view, and the emissive times the wake's level there. `uWakeA` is the bead's centre in the view (x, y), the angle the
 * sweep began at and how far it has gone; `uWakeB` the veins' level asleep and awake, the glow behind the light, and the
 * sweep's way round. A span of 2π or more is all awake, of 0 all asleep.
 */
const WAKE_VERTEX = '#include <project_vertex>\n\tvWakeView = mvPosition.xyz;';
const WAKE_FRAGMENT = [
  '#include <emissivemap_fragment>',
  '\t{',
  '\t\tvec2 wd = vWakeView.xy - uWakeA.xy;',
  '\t\tfloat wa = atan( wd.y, wd.x );',
  '\t\tfloat span = uWakeA.w;',
  '\t\tfloat d = mod( uWakeB.w * ( wa - uWakeA.z ), 6.2831853 );',
  '\t\tfloat lit = span >= 6.2831853 ? 1.0 : ( span <= 0.0 ? 0.0 : 1.0 - smoothstep( span - 0.3, span + 0.02, d ) );',
  '\t\tfloat head = uWakeA.z + uWakeB.w * span;',
  '\t\tfloat behind = mod( uWakeB.w * ( head - wa ), 6.2831853 );',
  '\t\tfloat hot = uWakeB.z > 0.0 && span > 0.0 ? exp( - pow( behind / 0.55, 2.0 ) ) : 0.0;',
  '\t\ttotalEmissiveRadiance *= mix( uWakeB.x, uWakeB.y, lit ) + uWakeB.z * hot;',
  '\t}'
].join('\n');

/** A shell's wake uniforms (`WAKE_FRAGMENT`): its bead's own. */
interface WakeUniforms {
  a: THREE.IUniform<THREE.Vector4>;
  b: THREE.IUniform<THREE.Vector4>;
}

/**
 * Dresses `material` for its first compile: its bead's light (`light`, every kind), and the screen's mask, the
 * track's pulse (`pulse`) or the glass's look. The program key names the dress, so the materials of one dress share a
 * program across the beads, each with its own uniforms. Run again (with `needsUpdate`) only when the glass steps down.
 */
function dress(material: THREE.MeshStandardMaterial, kind: Dress, light: THREE.IUniform<number>, pulse?: THREE.IUniform<THREE.Vector3>, wake?: WakeUniforms): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uBeadLight = light;
    const declare = ['uniform float uBeadLight;'];
    if (kind === 'shell') {
      shader.uniforms.uWakeA = wake!.a;
      shader.uniforms.uWakeB = wake!.b;
      declare.push('varying vec3 vWakeView;', 'uniform vec4 uWakeA;', 'uniform vec4 uWakeB;');
      shader.vertexShader = swap(swap(shader.vertexShader, '#include <common>', '#include <common>\nvarying vec3 vWakeView;'), '#include <project_vertex>', WAKE_VERTEX);
    }
    if (kind === 'track') {
      shader.uniforms.uBeadPulse = pulse!;
      declare.push('uniform vec3 uBeadPulse;', 'varying float vBeadTrackU;');
      shader.vertexShader = swap(
        swap(shader.vertexShader, '#include <common>', '#include <common>\nvarying float vBeadTrackU;'),
        '#include <uv_vertex>',
        '#include <uv_vertex>\n\tvBeadTrackU = uv.x;'
      );
    }
    let fragment = swap(shader.fragmentShader, '#include <common>', `#include <common>\n${declare.join('\n')}`);
    if (kind === 'screen') {
      const chunk = swap(THREE.ShaderChunk.emissivemap_fragment, 'totalEmissiveRadiance *= emissiveColor.rgb;', SCREEN_EMISSION);
      fragment = swap(fragment, '#include <emissivemap_fragment>', chunk);
    }
    if (kind === 'track') fragment = swap(fragment, '#include <emissivemap_fragment>', TRACK_PULSE);
    if (kind === 'shell') fragment = swap(fragment, '#include <emissivemap_fragment>', WAKE_FRAGMENT);
    if (kind === 'glass-high' || kind === 'glass-plain') fragment = swap(fragment, SPECULAR, SOFT_SPECULAR);
    fragment = swap(fragment, '#include <opaque_fragment>', kind === 'glass-high' ? GLASS_HIGH : SCALE_LIGHT);
    shader.fragmentShader = fragment;
  };
  material.customProgramCacheKey = () => `bob-bead:${kind}`;
}

/** The glass's dress on `tier`: high's cheap transmissive look, or plain transparent glass below it. */
function glassDress(tier: QualityTier): Dress {
  return tier === 'high' ? 'glass-high' : 'glass-plain';
}

/**
 * Dresses a bead's glass for `tier` (see `BEADS_LOOK.glass`): never transmissive, so three runs no transmission pass;
 * transparent at every tier, writing no depth, so the hollow and the haze behind it stay whole.
 */
function dressGlass(glass: THREE.MeshPhysicalMaterial, tier: QualityTier, light: THREE.IUniform<number>): void {
  const high = tier === 'high';
  glass.transmission = 0;
  glass.transparent = true;
  glass.depthWrite = false;
  glass.premultipliedAlpha = false;
  glass.opacity = high ? BEADS_LOOK.glass.high.opacity : BEADS_LOOK.glass.plain.opacity;
  if (high) {
    glass.blending = THREE.CustomBlending;
    glass.blendEquation = THREE.AddEquation;
    glass.blendSrc = THREE.OneFactor;
    glass.blendDst = THREE.OneMinusSrcAlphaFactor;
  } else {
    glass.blending = THREE.NormalBlending;
  }
  dress(glass, glassDress(tier), light);
}

/**
 * Readies a screenshot for its display. The screen's UV has v = 0 at its top edge (glTF's orientation), so the texture
 * is not flipped; it is colour (sRGB) and clamped at its edges; its filtering holds up on a screen seen at an angle.
 * Set outright, whatever it came with, and uploaded again.
 */
function readyScreen(texture: THREE.Texture): void {
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = Math.max(texture.anisotropy, 4);
  texture.needsUpdate = true;
}

/** Funcial's pulse's strength along its run: faded in from TP1 and out at TP4, so a new run never pops on. */
function pulseStrength(pulse: number): number {
  const { gain, edge } = BEADS_LOOK.funcial.pulse;
  return gain * smoothstep01(pulse / edge) * smoothstep01((1 - pulse) / edge);
}

// ---------------------------------------------------------------- the model

/** One bead as the model poses it. */
interface Bead {
  id: ProjectId;
  root: THREE.Object3D;
  body: THREE.Mesh;
  inner: THREE.PointLight;
  /** The root's rest turn (none, in the file), its facing (`setFacing`) on top of it, and its place, light and hover. */
  rest: THREE.Quaternion;
  facing: THREE.Quaternion;
  place: THREE.Vector3;
  /** Its float and turn (`setPose`): a lift over its place, and a turn in its facing's frame. */
  lift: number;
  offset: THREE.Quaternion;
  lit: number;
  hover: number;
  /** How much of it shows as it fades into the dark or out of it (`setFade`). */
  fade: number;
  /** Its light, the uniform every one of its materials reads. */
  light: THREE.IUniform<number>;
  /** Its shell's wake (`setWake`). */
  wake: WakeUniforms;
  glass: THREE.MeshPhysicalMaterial;
  /** Writes its object's parts for a time of its clock (and Funcial's abacus for `slide`, where given). */
  move(time: number, slide?: number): void;
  /** Writes what its object's build adds to its motion: Funcial's abacus's height, Cookies Clicker's wheels, the screen. */
  build(pose: BuildPose): void;
}

/** The first object called `name` under `root` (pre-order, so a node is found before a mesh of its own of that name). */
function find(root: THREE.Object3D, name: string): THREE.Object3D | undefined {
  return root.getObjectByName(name);
}

/** The first mesh under `root` (itself included) wearing a material called `material`. */
function meshWearing(root: THREE.Object3D, material: string): THREE.Mesh | undefined {
  let found: THREE.Mesh | undefined;
  root.traverse((o) => {
    if (!found && (o as THREE.Mesh).isMesh && ((o as THREE.Mesh).material as THREE.Material).name === material) found = o as THREE.Mesh;
  });
  return found;
}

/**
 * Every problem with the glTF's beads, worded for the message: each node it lacks, and each of the wrong kind (the
 * light must be a point light; the body, glass, track and cells meshes; the display must hold the screen and the fifth
 * abacus bead its lacquer; every material three's standard or physical one, which the patches extend).
 */
function problems(scene: THREE.Object3D): string[] {
  const missing: string[] = [];
  const wrong: string[] = [];
  for (const { id } of BEADS) {
    const rootName = `bead_${id}`;
    const root = find(scene, rootName);
    if (!root) {
      missing.push(rootName);
      continue;
    }
    for (const name of [...BEAD_PARTS.map((part) => `${rootName}_${part}`), ...OBJECT_PARTS[id]]) {
      const node = find(root, name);
      if (!node) {
        missing.push(name);
        continue;
      }
      const isMesh = (node as THREE.Mesh).isMesh === true;
      if (name.endsWith('_inner') && (node as THREE.PointLight).isPointLight !== true) wrong.push(`"${name}" must be a point light`);
      if (/_(body|glass)$|^funcial_track$|^jontai_cell_\d+$/.test(name) && !isMesh) wrong.push(`"${name}" must be a mesh`);
      const worn = isMesh ? ((node as THREE.Mesh).material as THREE.MeshPhysicalMaterial) : undefined;
      if (name.endsWith('_glass') && worn && (worn.isMeshPhysicalMaterial !== true || worn.name !== 'bead:glass')) {
        wrong.push(`"${name}" must wear the physical "bead:glass"`);
      }
      if (name.endsWith('_display') && !meshWearing(node, 'bead:display')) wrong.push(`"${name}" must hold a screen in "bead:display"`);
      if (name === 'funcial_bead_5' && !meshWearing(node, 'bead:abacus')) wrong.push(`"${name}" must hold a bead in "bead:abacus"`);
    }
    root.traverse((o) => {
      const material = (o as THREE.Mesh).isMesh ? ((o as THREE.Mesh).material as THREE.MeshStandardMaterial) : undefined;
      if (material && material.isMeshStandardMaterial !== true) wrong.push(`"${o.name}" must wear a standard or physical material`);
    });
  }
  return [...(missing.length > 0 ? [`has no ${missing.map((name) => `"${name}"`).join(', ')}`] : []), ...wrong];
}

/**
 * The beads from the glTF GLTFLoader (or drei's useGLTF) handed over, readied for `tier`, with `screens[id]` on each
 * bead's display. Built at the journey's places (`BEADS`), dim, at rest, facing +z and still.
 *
 * The glTF's scene is copied, sharing its geometries, so a cached model builds the same beads every time; the copy's
 * materials are the beads' own:
 * - every bead its own copy of each material it wears (the file shares them between beads and parts), so each is lit
 *   alone; the copies of one kind share a program;
 * - on top of those, a copy each for Jontai's 16 cells (they charge one by one) and Funcial's fifth abacus bead (it
 *   lights alone); the display's is its screen's, and the glass's is dressed for the tier.
 * The screens are readied (not flipped, sRGB, clamped) and stay the caller's.
 *
 * @throws TypeError naming every node the glTF lacks, or that is of the wrong kind.
 */
export function loadBeads(
  gltf: Pick<GLTF, 'scene'>,
  tier: QualityTier,
  screens: Readonly<Record<ProjectId, THREE.Texture>>,
  canvas: () => HTMLCanvasElement = () => document.createElement('canvas')
): BeadsModel {
  const look = BEADS_LOOK;
  const scene = gltf.scene.clone();
  const found = problems(scene);
  if (found.length > 0) throw new TypeError(`the beads glTF ${found.join('; ')}`);
  const unseen = BEADS.filter(({ id }) => (screens[id] as THREE.Texture | undefined)?.isTexture !== true).map(({ id }) => `"${id}"`);
  if (unseen.length > 0) throw new TypeError(`the beads need a screen texture for ${unseen.join(', ')}`);

  const group = new THREE.Group();
  group.name = 'beads';
  /** Every material the model made, each once, for `dispose`. */
  const made: THREE.Material[] = [];
  let standing: QualityTier = tier;

  // Scratch, shared by every per-frame path: nothing below allocates once built.
  const X = new THREE.Vector3(1, 0, 0);
  const Y = new THREE.Vector3(0, 1, 0);
  const Z = new THREE.Vector3(0, 0, 1);
  const turn = new THREE.Quaternion();
  const lookAt = new THREE.Matrix4();
  const origin = new THREE.Vector3();
  const base = new THREE.Quaternion();
  const offsetTurn = new THREE.Euler();
  const towards = new THREE.Vector3();
  let aiming = false;
  const facing = new THREE.Vector3();
  const toward = new THREE.Vector3();
  const axis = new THREE.Vector3();

  /** A dressed copy of `source` for a bead, counted for `dispose`. */
  const copy = <M extends THREE.MeshStandardMaterial>(source: M, kind: Dress, light: THREE.IUniform<number>, pulse?: THREE.IUniform<THREE.Vector3>, wake?: WakeUniforms): M => {
    const material = source.clone() as M;
    dress(material, kind, light, pulse, wake);
    made.push(material);
    return material;
  };

  const beads = BEADS.map(({ id, centre }): Bead => {
    const root = find(scene, `bead_${id}`)!;
    const part = (name: string) => find(root, name)!;
    const light: THREE.IUniform<number> = { value: look.dim };
    // Asleep until the path writes it: a span of 0 (a Vector4 is made with w 1, a sweep of a radian).
    const wake: WakeUniforms = { a: { value: new THREE.Vector4(0, 0, 0, 0) }, b: { value: new THREE.Vector4(WAKE.rest, WAKE.lit, 0, 1) } };
    const body = part(`bead_${id}_body`) as THREE.Mesh;
    /** The shell's lacquer, as the file has it: every part of this bead that wears it shares the shell's copy, and its wake. */
    const shellSource = body.material as THREE.Material;
    const glassMesh = part(`bead_${id}_glass`) as THREE.Mesh;
    const screenMesh = meshWearing(part(`bead_${id}_display`), 'bead:display')!;

    // The parts with a material of their own; every other mesh shares its bead's copy of what it wore.
    const own = new Map<THREE.Mesh, THREE.MeshStandardMaterial>();
    const glass = (glassMesh.material as THREE.MeshPhysicalMaterial).clone();
    dressGlass(glass, tier, light);
    made.push(glass);
    own.set(glassMesh, glass);

    readyScreen(screens[id]);
    const screen = copy(screenMesh.material as THREE.MeshStandardMaterial, 'screen', light);
    // White, so the screenshot shows its own colours.
    screen.emissive.setScalar(1);
    screen.emissiveMap = screens[id];
    screen.emissiveIntensity = look.screen.level;
    own.set(screenMesh, screen);
    /** The screen's light as the build sets it: lit with its level, unless the build has dimmed it. */
    const lightScreen = (share: number): void => {
      screen.emissiveIntensity = look.screen.level * share;
    };

    let build: (pose: BuildPose) => void;

    let move: (time: number, slide?: number) => void;
    if (id === 'funcial') {
      const track = part('funcial_track') as THREE.Mesh;
      const pulse: THREE.IUniform<THREE.Vector3> = { value: new THREE.Vector3(0, 0, look.funcial.pulse.width) };
      own.set(track, copy(track.material as THREE.MeshStandardMaterial, 'track', light, pulse));
      const fifthMesh = meshWearing(part('funcial_bead_5'), 'bead:abacus')!;
      const fifth = copy(fifthMesh.material as THREE.MeshStandardMaterial, 'surface', light);
      fifth.emissive.set(look.funcial.result.colour);
      fifth.emissiveIntensity = 0;
      own.set(fifthMesh, fifth);
      const platter = part('funcial_platter');
      const platterRest = platter.quaternion.clone();
      const abacus = [1, 2, 3, 4, 5].map((k) => part(`funcial_bead_${k}`));
      const abacusRest = abacus.map((bead) => bead.position.y);
      const motion: FuncialMotion = funcialMotion(0);
      const sliding: FuncialMotion = funcialMotion(0);
      move = (time, slide) => {
        funcialMotion(time, motion);
        // The abacus by its own clock where one is given: the same motion, read at another time.
        const abacusAt = slide === undefined ? motion : funcialMotion(slide, sliding);
        // About its own up: rest · Ry(angle), so the lean holds.
        platter.quaternion.copy(platterRest).multiply(turn.setFromAxisAngle(Y, motion.platter));
        pulse.value.set(motion.pulse, pulseStrength(motion.pulse), look.funcial.pulse.width);
        for (let k = 0; k < abacus.length; k++) abacus[k]!.position.y = abacusRest[k]! + abacusAt.abacus[k]! * look.funcial.travel;
        fifth.emissiveIntensity = look.funcial.result.glow * abacusAt.abacus[4]!;
      };
      // The abacus rises from the platter as one piece: its height, a share of its own.
      const frame = part('funcial_abacus');
      const frameRest = frame.scale.clone();
      build = (pose) => {
        frame.scale.set(frameRest.x, frameRest.y * (pose.abacus ?? 1), frameRest.z);
        lightScreen(pose.screen);
      };
    } else if (id === 'jontai-energy') {
      const cells = Array.from({ length: 16 }, (_, k) => {
        const mesh = part(`jontai_cell_${k + 1}`) as THREE.Mesh;
        const material = copy(mesh.material as THREE.MeshStandardMaterial, 'surface', light);
        own.set(mesh, material);
        return material;
      });
      const module = part('jontai_module');
      const moduleRest = module.quaternion.clone();
      const motion: JontaiMotion = jontaiMotion(0);
      move = (time) => {
        jontaiMotion(time, motion);
        // About its own x: rest · Rx(tilt), its rest turn having y and z parts too.
        module.quaternion.copy(moduleRest).multiply(turn.setFromAxisAngle(X, motion.tilt));
        for (let k = 0; k < cells.length; k++) cells[k]!.emissiveIntensity = 1 + (look.jontai.charged - 1) * motion.cells[k]!;
      };
      build = (pose) => lightScreen(pose.screen);
    } else {
      const wheels = Array.from({ length: 8 }, (_, k) => part(`cookies_wheel_${k + 1}`));
      const wheelRest = wheels.map((wheel) => wheel.quaternion.clone());
      const balance = part('cookies_balance');
      const balanceRest = balance.quaternion.clone();
      const motion: CookiesMotion = cookiesMotion(0);
      move = (time) => {
        cookiesMotion(time, motion);
        // Each about its own centre and z (no turn of its own in the file): rest · Rz(angle).
        for (let k = 0; k < wheels.length; k++) wheels[k]!.quaternion.copy(wheelRest[k]!).multiply(turn.setFromAxisAngle(Z, motion.wheels[k]!));
        balance.quaternion.copy(balanceRest).multiply(turn.setFromAxisAngle(Z, motion.balance));
      };
      // The wheels come in from apart: each from its rest out from the train's middle, 0.16 across and a little forward,
      // a wheel at the middle itself to one side.
      const wheelPlace = wheels.map((wheel) => wheel.position.clone());
      const middle = wheelPlace.reduce((sum, at) => sum.add(at), new THREE.Vector3()).multiplyScalar(1 / wheels.length);
      const apart = wheelPlace.map((at, k) => {
        const out = at.clone().sub(middle);
        out.z = 0;
        if (out.lengthSq() < 1e-6) out.set(k % 2 ? 1 : -1, 0.3, 0);
        return out.normalize().multiplyScalar(0.16).add(new THREE.Vector3(0, 0, 0.1 + 0.04 * (k % 3)));
      });
      build = (pose) => {
        const away = pose.apart ?? 0;
        for (let k = 0; k < wheels.length; k++) wheels[k]!.position.copy(wheelPlace[k]!).addScaledVector(apart[k]!, away);
        lightScreen(pose.screen);
      };
    }

    const shared = new Map<THREE.Material, THREE.MeshStandardMaterial>();
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      let material = own.get(mesh);
      if (!material) {
        const source = mesh.material as THREE.MeshStandardMaterial;
        material = shared.get(source);
        if (!material) {
          material = source === shellSource ? copy(source, 'shell', light, undefined, wake) : copy(source, 'surface', light);
          shared.set(source, material);
        }
      }
      mesh.material = material;
    });

    group.add(root);
    return {
      id,
      root,
      body,
      inner: part(`bead_${id}_inner`) as THREE.PointLight,
      rest: root.quaternion.clone(),
      place: new THREE.Vector3(...centre),
      facing: new THREE.Quaternion(),
      lift: 0,
      offset: new THREE.Quaternion(),
      lit: 0,
      hover: 0,
      fade: 1,
      light,
      wake,
      glass,
      move,
      build
    };
  });

  const byId = Object.fromEntries(beads.map((bead) => [bead.id, bead])) as Record<ProjectId, Bead>;
  const bead = (id: ProjectId): Bead => {
    const found = byId[id];
    if (!found) throw new TypeError(`there is no bead "${id}"`);
    return found;
  };

  /** Its light: dim to lit, brightened by its hover, faded into the dark by its fade's root. */
  const light = (b: Bead): void => {
    b.light.value = (look.dim + (1 - look.dim) * b.lit) * (1 + look.hover.brighten * b.hover) * Math.sqrt(b.fade);
  };

  /**
   * Its place with its float's lift, its facing with its float's turn, and its hover's turn: its porthole (its rest +z)
   * turned toward the hover's point (or the stop's camera) by its hover's share of the smaller of the hover's turn and
   * the angle between them, about the axis square to both, so it neither rolls nor turns past the point. Scratch
   * vectors only.
   */
  const pose = (b: Bead): void => {
    b.root.position.copy(b.place);
    b.root.position.y += b.lift;
    base.copy(b.facing).multiply(b.offset).multiply(b.rest);
    b.root.quaternion.copy(base);
    if (b.hover <= 0 || !aiming) return;
    toward.subVectors(towards, b.root.position);
    const length = toward.length();
    if (!(length > 1e-9)) return;
    toward.divideScalar(length);
    facing.copy(Z).applyQuaternion(base);
    const angle = facing.angleTo(toward);
    axis.crossVectors(facing, toward);
    const sine = axis.length();
    // Straight ahead there is nothing to turn; straight behind any axis square to the porthole's will do.
    if (sine < 1e-9) {
      if (angle < Math.PI / 2) return;
      axis.copy(Y).applyQuaternion(base);
    } else {
      axis.divideScalar(sine);
    }
    turn.setFromAxisAngle(axis, Math.min(angle, look.hover.turn) * b.hover);
    b.root.quaternion.premultiply(turn);
  };

  for (const b of beads) {
    light(b);
    pose(b);
    b.move(0);
  }

  // The look-back rings: one engraving for the three, each ring its own material, dark until `setRings`.
  const ringMap = engravingTexture(canvas());
  const rings = beads.map((b) => {
    const material = engravedMaterial(ringMap, LOOK_RING.look, [0, 0, 0]);
    material.uniforms.uFog!.value.set(...LOOK_RING.fog);
    made.push(material);
    const ring = new THREE.Mesh(ringGeometry(LOOK_RING.radius, LOOK_RING.width, LOOK_RING.repeat), material);
    ring.name = `bead_${b.id}_lookring`;
    ring.rotation.set(...LOOK_RING.tilt);
    ring.frustumCulled = false;
    b.root.add(ring);
    return ring;
  });

  return {
    group,
    beads: Object.fromEntries(beads.map((b) => [b.id, { root: b.root, body: b.body }])) as BeadsModel['beads'],
    place(positions) {
      for (let i = 0; i < beads.length; i++) {
        const b = beads[i]!;
        const p = positions[b.id];
        b.place.set(p[0], p[1], p[2]);
        pose(b);
      }
    },
    setFacing(id, at) {
      const b = bead(id);
      b.facing.identity();
      if (at != null) {
        // The point in the group's frame, where the beads' places are; the porthole's +z along the way to it, up kept up.
        group.updateWorldMatrix(true, false);
        group.worldToLocal(toward.set(at.x, at.y, at.z)).sub(b.place);
        if (toward.lengthSq() > 1e-18) b.facing.setFromRotationMatrix(lookAt.lookAt(toward, origin, Y));
      }
      pose(b);
    },
    setLit(id, t) {
      const b = bead(id);
      b.lit = clamp01(t);
      light(b);
    },
    setHover(id, amount = 1, at) {
      // A point given (null and undefined alike are none): the bead turns toward it, else it does not turn.
      aiming = at != null;
      if (at != null) {
        // The point in the group's frame, where the beads' places are.
        group.updateWorldMatrix(true, false);
        group.worldToLocal(towards.set(at.x, at.y, at.z));
      }
      const share = clamp01(amount);
      for (let i = 0; i < beads.length; i++) {
        const b = beads[i]!;
        b.hover = b.id === id ? share : 0;
        light(b);
        pose(b);
      }
    },
    setMotion(id, time, slide) {
      bead(id).move(time, slide);
    },
    setFade(id, fade) {
      const b = bead(id);
      b.fade = clamp01(fade);
      light(b);
    },
    setRings(level) {
      const at = clamp01(level);
      for (const ring of rings) ring.material.uniforms.uLevel!.value = at;
    },
    setPose(id, { y, roll, pitch, yaw }) {
      const b = bead(id);
      const n = (v: number): number => (Number.isFinite(v) ? v : 0);
      b.lift = n(y);
      // In the facing's frame: +x the screen's right, +y up, +z the porthole toward the camera. Up turns +z toward +y,
      // a turn about +x by minus the pitch.
      b.offset.setFromEuler(offsetTurn.set(-n(pitch), n(yaw), n(roll), 'YXZ'));
      pose(b);
    },
    setWake(id, wake) {
      const b = bead(id);
      b.wake.a.value.set(wake.centre[0], wake.centre[1], wake.start, wake.span);
      b.wake.b.value.set(WAKE.rest, WAKE.lit, wake.hot, wake.dir);
    },
    setBuild(id, b) {
      const pose = buildPose(id, b);
      const one = bead(id);
      one.move(pose.time, pose.slide);
      one.build(pose);
    },
    setTier(next) {
      const to = lowerTier(standing, next);
      if (to === standing) return;
      const recompile = glassDress(to) !== glassDress(standing);
      standing = to;
      if (!recompile) return;
      for (const b of beads) {
        dressGlass(b.glass, to, b.light);
        b.glass.needsUpdate = true;
      }
    },
    dispose() {
      for (const material of made) material.dispose();
      for (const b of beads) b.inner.dispose();
      for (const ring of rings) ring.geometry.dispose();
      ringMap.dispose();
    }
  };
}
