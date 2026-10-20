import * as THREE from 'three';
import { palette } from '../palette';
import { DRIVE, armBearing, headPoint } from './drive';
import type { InstrumentMaterials } from './materials';

/**
 * The hard drive's own parts and finishes, for the compass that turns into
 * one (Instrument): the mirror wipe the face and the pattern ring wear, the
 * steel the needle's blade turns to, the platters' edges, the hub, and the
 * actuator's magnets and the park ramp on the chassis. Everything is in the
 * dial's frame (dialSpec): the face at y = 0, north -Z, east +X.
 *
 * The parts appear by scale (from nothing) or are hidden, never by a change
 * of program: the shader patches read uniforms only, so a pose recompiles
 * nothing. All of it builds and runs in node.
 */

/** The ring meshes that become the three platters, top to bottom. */
export type PlatterId = 'pattern' | 'direction' | 'degree';

/**
 * The platters' mirror steel: its colour, roughness with a fine concentric
 * grain of ± `grain` (one value per 1/`grainRings` of radius, faded out where
 * a ring would be finer than the screen can draw it, so it never shimmers),
 * and the soft edge of the wipe, the pattern sweep's own (sweepCoverage).
 */
export const MIRROR = { color: 0xe4e6ec, roughness: 0.06, grain: 0.012, grainRings: 160, soft: 0.015 } as const;

/** Steel: the platters' edges, the hub, the clamp, the screws, and the arm once it has formed. */
export const STEEL = { color: 0xc4c8d0, roughness: 0.28 } as const;

/** The chassis: brushed aluminium, a neutral metal (its image's grey, not its colour, is tinted to this). */
export const ALUMINIUM = { color: 0x9da1a8, roughness: 0.45 } as const;

/**
 * The drive's own light room, seen only in its polished metal: the mirror,
 * the steel, and faintly the magnets (`cover`). The compass's room
 * (CompassStudio) is dark straight ahead of the face, where its glossy
 * lacquer reflects it, so a mirror there reads black; the drive's metal
 * reflects these soft boxes in the same directions instead, and the compass
 * is lit as it was. Directions are the world's, about the reflected ray:
 * `az` degrees from straight ahead (+Z, toward the viewer) to the right (+X),
 * `el` degrees up. A tilted drive sees about az ±10° and el −20° to −38°.
 * A floor of dull light, a warm wash low ahead, and tall strips (`az` ± `half`,
 * `el` from `low` to `high`), each `radiance` times its colour; their edges
 * soften by `blur.min` plus the surface's roughness² times `blur.rough`
 * (radians). It dims with the studio (scene.environmentIntensity).
 */
export const DRIVE_ROOM = {
  floor: { color: 0xd8d4e8, radiance: 0.025 },
  wash: { az: 0, el: -28, width: 14, height: 10, color: 0xffe2bd, radiance: 0.14 },
  strips: [
    { az: -9, half: 0.7, low: -70, high: -4, color: 0xfff1e0, radiance: 2.6 },
    { az: -4.5, half: 1.6, low: -70, high: -25, color: 0xffffff, radiance: 1.3 },
    { az: 1.5, half: 0.35, low: -70, high: -4, color: 0xffffff, radiance: 2.2 },
    { az: 5, half: 0.8, low: -70, high: -4, color: 0xb59cff, radiance: 1.6 },
    { az: 10, half: 2, low: -30, high: -4, color: 0xffd9a8, radiance: 0.9 },
    // A broad soft panel to the right, past the platter's view: the arm's and the screws' facets turned that way catch it.
    { az: 19, half: 5, low: -70, high: 0, color: 0xfff1e0, radiance: 0.7 }
  ],
  blur: { min: 0.008, rough: 1.2 },
  cover: { mirror: 1, steel: 1, magnet: 0.35 }
} as const;

/**
 * The actuator's magnet, dark metal, a U round the coil's sweep behind the
 * pivot: two blocks either side of it (their size: long side north-south,
 * then height, then across; where each stands from the pivot, west and east
 * of it and both south of the arm's broad root) on a low plate under the
 * coil joining them (`plate`: its height). Clear of the arm and of its coil
 * on every track and on the ramp, and inside the chassis's corner.
 */
export const MAGNET = {
  size: [0.17, 0.09, 0.06],
  west: -0.095,
  east: 0.125,
  south: 0.105,
  plate: 0.02,
  color: palette.boardDeep,
  metalness: 0.7,
  roughness: 0.4
} as const;

/** The park ramp: across the arm, its height (just under the parked head's slider), and along the arm. */
export const RAMP = { size: [0.05, 0.03, 0.1] } as const;

/** How thick a platter shows at its edge. */
export const PLATTER_EDGE = 0.012;

/** The clamp's height above the face: just above the top platter. */
export const CLAMP_HEIGHT = DRIVE.platter.rise + 0.015;

/** The top of the hub, a little proud of the clamp. */
export const HUB_TOP = CLAMP_HEIGHT + 0.008;

/**
 * The clamp's six screws, on the platter so they turn with it: how far out,
 * their head's radius and height, and the clamp's share from which they grow
 * in (whole at 1).
 */
export const CLAMP_SCREWS = { count: 6, radius: 0.16, head: 0.012, height: 0.006, from: 0.85 } as const;

/**
 * The cover screws on the chassis's rim, dial-local (x, z): its corners and
 * the middles of its sides, but the actuator's corner; their head's radius and height.
 */
export const CHASSIS_SCREWS = {
  at: [[-1.11, -1.11], [1.11, -1.11], [-1.11, 1.11], [0, -1.125], [-1.125, 0], [0, 1.125], [1.125, 0]],
  head: 0.022,
  height: 0.008
} as const;

/**
 * The read head: the last stretch of the blade that keeps the needle's glow
 * (`glow`), and the small slider at its tip, in the same glow, that shows as
 * the arm forms: across, tall, along the arm, and how far its top stands
 * above the blade's axis (it hangs below, just clear of the top platter).
 */
export const READ_HEAD = { glow: 0.06, size: [0.03, 0.03, 0.04], top: 0.005 } as const;

const DEG = Math.PI / 180;

/** A number as a GLSL float. */
function glsl(value: number): string {
  const text = String(value);
  return /[.e]/.test(text) ? text : `${text}.0`;
}

/** A hex colour, linear, as a GLSL vec3, `times` as bright. */
function vec3(hex: number, times = 1): string {
  const color = new THREE.Color(hex).multiplyScalar(times);
  return `vec3( ${color.r.toFixed(5)}, ${color.g.toFixed(5)}, ${color.b.toFixed(5)} )`;
}

/** What onBeforeCompile hands a patch. */
interface Shader {
  uniforms: Record<string, THREE.IUniform>;
  vertexShader: string;
  fragmentShader: string;
}

/** DRIVE_ROOM as GLSL: driveRoom( the reflected ray in world space, roughness ), the light it meets. */
function driveRoomGlsl(): string {
  const { floor, wash, strips, blur } = DRIVE_ROOM;
  const rad = (degrees: number): string => glsl(Number((degrees * DEG).toFixed(6)));
  return [
    'float driveRoomBox( float x, float lo, float hi, float soft ) {',
    '\treturn smoothstep( lo - soft, lo + soft, x ) * ( 1.0 - smoothstep( hi - soft, hi + soft, x ) );',
    '}',
    'vec3 driveRoom( vec3 dir, float roughness ) {',
    '\tfloat az = atan( dir.x, dir.z );',
    '\tfloat el = asin( clamp( dir.y, -1.0, 1.0 ) );',
    `\tfloat soft = ${glsl(blur.min)} + pow2( roughness ) * ${glsl(blur.rough)};`,
    `\tvec3 light = ${vec3(floor.color, floor.radiance)};`,
    `\tlight += ${vec3(wash.color, wash.radiance)} * exp( - pow2( ( az - ${rad(wash.az)} ) / ${rad(wash.width)} ) - pow2( ( el - ${rad(wash.el)} ) / ${rad(wash.height)} ) );`,
    ...strips.map(
      (s) =>
        `\tlight += ${vec3(s.color, s.radiance)} * driveRoomBox( az, ${rad(s.az - s.half)}, ${rad(s.az + s.half)}, soft ) * driveRoomBox( el, ${rad(s.low)}, ${rad(s.high)}, 2.0 * soft );`
    ),
    '\treturn light;',
    '}'
  ].join('\n');
}

/**
 * The drive's light room (DRIVE_ROOM) in a lit material's reflections, as
 * much as `cover` (a GLSL float expression, evaluated after the lights'
 * setup) says: added to the image-based radiance the material's specular
 * then takes, so its colour, Fresnel and roughness apply as to any
 * reflection, and scaled by the environment's intensity, so it dims with
 * the studio. At cover 0 nothing changes.
 */
export function patchRoom(shader: Shader, cover: string): void {
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${driveRoomGlsl()}`)
    .replace(
      '#include <lights_fragment_maps>',
      [
        '#include <lights_fragment_maps>',
        '#if defined( RE_IndirectSpecular )',
        '{',
        `\tfloat roomCover = ${cover};`,
        '\tif ( roomCover > 0.0 ) {',
        '\t\tvec3 roomDir = inverseTransformDirection( reflect( - geometryViewDir, geometryNormal ), viewMatrix );',
        '\t\tvec3 roomLight = roomCover * driveRoom( roomDir, material.roughness );',
        '#ifdef USE_ENVMAP',
        '\t\troomLight *= envMapIntensity;',
        '#endif',
        '\t\tradiance += roomLight;',
        '\t}',
        '}',
        '#endif'
      ].join('\n')
    );
}

export interface MirrorUniforms {
  /** 0 no mirror … 1 all of it. */
  uMirror: THREE.IUniform<number>;
  /** Where the wipe starts, as a share of a turn clockwise from north. */
  uMirrorOrigin: THREE.IUniform<number>;
}

export function mirrorUniforms(): MirrorUniforms {
  return { uMirror: { value: 0 }, uMirrorOrigin: { value: DRIVE.mirrorFrom / 360 } };
}

/**
 * The mirror wipe, patched into a lit material (standard or physical) whose
 * mesh lies in the dial's plane: the cover is sweepCoverage's, with u the
 * fragment's bearing / 360 read off its local position (the face rings' UVs
 * are planar, so not from them), spreading both ways from uMirrorOrigin. A
 * covered fragment is mirror steel: MIRROR's colour, metal, its roughness
 * grained by radius, no clear coat, and the drive's room in its reflections
 * (patchRoom). At uMirror 0 nothing changes.
 */
export function patchMirror(shader: Shader, uniforms: MirrorUniforms): void {
  const soft = glsl(MIRROR.soft);
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vDialPos;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvDialPos = position;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vDialPos;\nuniform float uMirror;\nuniform float uMirrorOrigin;')
    .replace(
      '#include <metalnessmap_fragment>',
      [
        '#include <metalnessmap_fragment>',
        'float mirrorCover = 0.0;',
        '{',
        // sweepCoverage(u, origin, sweep, soft), the same steps as the pattern's sweep.
        '  float around = fract( atan( vDialPos.x, -vDialPos.z ) / 6.283185307179586 - uMirrorOrigin );',
        '  float d = min( around, 1.0 - around );',
        `  float front = uMirror * ( 0.5 + ${soft} );`,
        `  mirrorCover = 1.0 - smoothstep( front - ${soft}, front, d );`,
        // Each fine ring of the turning a little rougher or smoother than the next; faded out where a ring is finer than
        // about two pixels, so the grain shows close up and never shimmers from afar.
        `  float grainRing = length( vDialPos.xz ) * ${glsl(MIRROR.grainRings)};`,
        '  float grainShown = 1.0 - smoothstep( 0.25, 0.6, fwidth( grainRing ) );',
        '  float grain = fract( sin( floor( grainRing ) * 12.9898 ) * 43758.5453 );',
        `  diffuseColor.rgb = mix( diffuseColor.rgb, ${vec3(MIRROR.color)}, mirrorCover );`,
        '  metalnessFactor = mix( metalnessFactor, 1.0, mirrorCover );',
        `  roughnessFactor = mix( roughnessFactor, ${glsl(MIRROR.roughness)} + ${glsl(MIRROR.grain)} * ( 2.0 * grain - 1.0 ) * grainShown, mirrorCover );`,
        '}'
      ].join('\n')
    )
    .replace(
      '#include <lights_physical_fragment>',
      ['#include <lights_physical_fragment>', '#ifdef USE_CLEARCOAT', '\tmaterial.clearcoat *= 1.0 - mirrorCover;', '#endif'].join('\n')
    );
  patchRoom(shader, `mirrorCover * ${glsl(DRIVE_ROOM.cover.mirror)}`);
}

export interface BladeUniforms {
  /** 0 the needle's own finish … 1 steel, all but the head. */
  uSteel: THREE.IUniform<number>;
  /** Where the head starts along the blade: 0 at the pivot, 1 at the tip. */
  uHeadFrom: THREE.IUniform<number>;
}

export function bladeUniforms(): BladeUniforms {
  return { uSteel: { value: 0 }, uHeadFrom: { value: 0 } };
}

/**
 * The needle's tip half as it becomes the arm: built from its pivot (z 0) to
 * its tip (z -`length`), the blade turns to steel by uSteel except its last
 * stretch from uHeadFrom on, which keeps the needle's yellow and its glow and
 * becomes the read head. At uSteel 0 nothing changes.
 */
export function patchBlade(shader: Shader, uniforms: BladeUniforms, length: number): void {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying float vBlade;')
    .replace('#include <begin_vertex>', `#include <begin_vertex>\n\tvBlade = clamp( -position.z / ${glsl(length)}, 0.0, 1.0 );`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vBlade;\nuniform float uSteel;\nuniform float uHeadFrom;')
    .replace(
      '#include <emissivemap_fragment>',
      [
        '#include <emissivemap_fragment>',
        'float bladeSteel = uSteel * ( 1.0 - smoothstep( uHeadFrom - 0.01, uHeadFrom, vBlade ) );',
        `diffuseColor.rgb = mix( diffuseColor.rgb, ${vec3(STEEL.color)}, bladeSteel );`,
        'metalnessFactor = mix( metalnessFactor, 1.0, bladeSteel );',
        `roughnessFactor = mix( roughnessFactor, ${glsl(STEEL.roughness)}, bladeSteel );`,
        'totalEmissiveRadiance *= 1.0 - bladeSteel;'
      ].join('\n')
    );
  patchRoom(shader, `bladeSteel * ${glsl(DRIVE_ROOM.cover.steel)}`);
}

/**
 * The needle's tail half and hub as they turn to steel with the blade: the
 * drive's room in their reflections as far as the blade's `uSteel` (the
 * same uniform object) has gone. At uSteel 0 nothing changes.
 */
export function patchTail(shader: Shader, uniforms: BladeUniforms): void {
  shader.uniforms.uSteel = uniforms.uSteel;
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uSteel;');
  patchRoom(shader, `uSteel * ${glsl(DRIVE_ROOM.cover.steel)}`);
}

export interface DriveParts {
  /** The steel band under each platter's outer edge, to be added to its ring's mesh. */
  edges: Record<PlatterId, THREE.Mesh>;
  /** The spindle's hub: a steel post on the dial's axis. */
  hub: THREE.Mesh;
  /** The clamp's steel band: a short wall round its outer edge, from the top platter up to it, so it reads as a solid ring. */
  clampBand: THREE.Mesh;
  /** The clamp's screws, to be added to the turning platter. */
  clampScrews: THREE.Group;
  /** The actuator's magnets, round the arm's pivot on the chassis. */
  magnets: THREE.Group;
  /** The ramp the head parks on, at the platter's edge. */
  ramp: THREE.Mesh;
  /** The chassis's cover screws. */
  screws: THREE.Group;
  /** Each edge as wide as its ring's outer radius and PLATTER_EDGE * `grow` deep; hidden at grow 0. */
  setEdges(outer: Record<PlatterId, number>, grow: number): void;
  /** The hub from `bottom` up to `top`, hidden while it has no height. */
  setHub(bottom: number, top: number): void;
  /**
   * The clamp's band `outer` round, from `bottom` (the top platter) up to `top` (the clamp), hidden while it has no
   * height; the screws on the clamp at `top`, grown in over the last of `clamp` (CLAMP_SCREWS.from to 1).
   */
  setClamp(outer: number, bottom: number, top: number, clamp: number): void;
  /** The magnets, the ramp and the cover screws, each grown in its own place from nothing with the chassis. */
  setChassis(chassis: number): void;
}

/** Hermite ease from 0 at `a` to 1 at `b`. */
function smooth(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** A screw's head: a low, slightly domed steel cylinder `radius` round and `height` tall, its foot at y 0. */
function screwHead(radius: number, height: number): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(radius * 0.82, radius, height, 24).translate(0, height / 2, 0);
}

export function buildDriveParts(m: InstrumentMaterials): DriveParts {
  // A unit band, its top at y 0: scaled to each ring's radius and the platter's thickness.
  const band = new THREE.CylinderGeometry(1, 1, PLATTER_EDGE, 128, 1, true).translate(0, -PLATTER_EDGE / 2, 0);
  const edge = (id: PlatterId): THREE.Mesh => {
    const mesh = new THREE.Mesh(band, m.steel);
    mesh.name = `compass:edge-${id}`;
    mesh.visible = false;
    return mesh;
  };
  const edges: Record<PlatterId, THREE.Mesh> = { pattern: edge('pattern'), direction: edge('direction'), degree: edge('degree') };

  // A unit-high post, its foot at y 0, closed at both ends.
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(DRIVE.hub, DRIVE.hub, 1, 48).translate(0, 0.5, 0), m.steel);
  hub.name = 'compass:hub';
  hub.visible = false;

  // A unit wall, its foot at y 0, open at both ends: scaled to the clamp's radius and the gap under it.
  const clampBand = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 96, 1, true).translate(0, 0.5, 0), m.steel);
  clampBand.name = 'compass:clamp-band';
  clampBand.visible = false;

  // The clamp's screws, evenly round it.
  const clampScrews = new THREE.Group();
  clampScrews.name = 'compass:clamp-screws';
  const clampHead = screwHead(CLAMP_SCREWS.head, CLAMP_SCREWS.height);
  for (let k = 0; k < CLAMP_SCREWS.count; k++) {
    const screw = new THREE.Mesh(clampHead, m.steel);
    screw.name = `compass:clamp-screw-${k}`;
    const a = (2 * Math.PI * k) / CLAMP_SCREWS.count;
    screw.position.set(CLAMP_SCREWS.radius * Math.sin(a), 0, -CLAMP_SCREWS.radius * Math.cos(a));
    clampScrews.add(screw);
  }
  clampScrews.visible = false;

  // Each block stands on the chassis (its foot at y 0) with its long side north-south, either side of the coil.
  const [long, tall, across] = MAGNET.size;
  const block = new THREE.BoxGeometry(long, tall, across).translate(0, tall / 2, 0);
  const magnets = new THREE.Group();
  magnets.name = 'compass:magnets';
  magnets.position.set(DRIVE.pivot[0], 0, DRIVE.pivot[1]);
  const blocks = (['west', 'east'] as const).map((side) => {
    const magnet = new THREE.Mesh(block, m.magnet);
    magnet.name = `compass:magnet-${side}`;
    magnet.rotation.y = Math.PI / 2;
    magnet.position.set(MAGNET[side], 0, MAGNET.south);
    magnets.add(magnet);
    return magnet;
  });
  // The plate under the coil, from the west block's outer face to the east one's, just under the coil's lowest turn.
  const span = MAGNET.east - MAGNET.west + across;
  const plate = new THREE.Mesh(new THREE.BoxGeometry(span, MAGNET.plate, long).translate(0, MAGNET.plate / 2, 0), m.magnet);
  plate.name = 'compass:magnet-plate';
  plate.position.set((MAGNET.west + MAGNET.east) / 2, 0, MAGNET.south);
  magnets.add(plate);
  blocks.push(plate);
  magnets.visible = false;

  // The ramp under the parked head, its long side along the arm.
  const [rampAcross, rampTall, rampAlong] = RAMP.size;
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(rampAcross, rampTall, rampAlong).translate(0, rampTall / 2, 0), m.magnet);
  ramp.name = 'compass:ramp';
  const parkBearing = armBearing(DRIVE.parkRadius) ?? 0;
  const [parkX, parkZ] = headPoint(parkBearing);
  ramp.position.set(parkX, 0, parkZ);
  ramp.rotation.y = -parkBearing * DEG;
  ramp.visible = false;

  // The cover screws on the chassis's rim.
  const screws = new THREE.Group();
  screws.name = 'compass:screws';
  const coverHead = screwHead(CHASSIS_SCREWS.head, CHASSIS_SCREWS.height);
  CHASSIS_SCREWS.at.forEach(([x, z], k) => {
    const screw = new THREE.Mesh(coverHead, m.steel);
    screw.name = `compass:screw-${k}`;
    screw.position.set(x, 0, z);
    screws.add(screw);
  });
  screws.visible = false;

  return {
    edges,
    hub,
    clampBand,
    clampScrews,
    magnets,
    ramp,
    screws,
    setEdges(outer, grow) {
      // Never quite zero deep, so no matrix is singular while they are hidden.
      const deep = Math.max(grow, 1e-4);
      for (const id of Object.keys(edges) as PlatterId[]) {
        edges[id].scale.set(outer[id], deep, outer[id]);
        edges[id].visible = grow > 0;
      }
    },
    setHub(bottom, top) {
      const height = top - bottom;
      hub.visible = height > 1e-4;
      hub.position.y = bottom;
      hub.scale.y = Math.max(height, 1e-4);
    },
    setClamp(outer, bottom, top, clamp) {
      const height = top - bottom;
      clampBand.visible = height > 1e-4;
      clampBand.position.y = bottom;
      clampBand.scale.set(outer, Math.max(height, 1e-4), outer);
      const shown = smooth(CLAMP_SCREWS.from, 1, Number.isFinite(clamp) ? clamp : 0);
      clampScrews.visible = shown > 0;
      clampScrews.position.y = top;
      for (const screw of clampScrews.children) screw.scale.setScalar(Math.max(shown, 1e-4));
    },
    setChassis(chassis) {
      magnets.visible = ramp.visible = screws.visible = chassis > 0;
      // Each part grows about its own foot, so none passes through the coil or the arm on its way; never quite zero, so
      // no matrix is singular while they are hidden.
      const scale = Math.max(chassis, 1e-4);
      for (const part of [...blocks, ramp, ...screws.children]) part.scale.setScalar(scale);
    }
  };
}
